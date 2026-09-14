import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  createPortal,
} from "react-dom";

import {
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BadgeDollarSign,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  FileClock,
  FileText,
  MonitorSmartphone,
  NotebookPen,
  Pencil,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShoppingBag,
  Ticket,
  Trash2,
  UserRound,
  WalletCards,
  ShieldCheck,
  ShieldAlert,
  History,
  CircleDollarSign,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  addClientNote,
  createClient,
  getClientActivity,
  getClientDisplayName,
  getClientDocument,
  setClientArchived,
  subscribeToClientActivityIndex,
  subscribeToClients,
  updateClient,
  updateClientCreditLimit,
} from "../../services/clientes.service.js";

import {
  createCredit,
  getCreditStatus,
  refinanceClientCredits,
} from "../../services/creditos.service.js";

import {
  createAuditCreditNote,
  reverseAuditCreditNote,
  reverseLegacyClientBalance,
  deleteClientByAudit,
  deleteTicketByAudit,
  subscribeToClientAudit,
} from "../../services/client-audit.service.js";

import {
  PERMISSIONS,
  profileHasPermission,
} from "../../security/permissions.js";

import "./Clientes.css";

const EMPTY_CLIENT = {
  nombre: "",
  apellido: "",
  dni: "",
  cuit: "",
  direccion: "",
  provincia: "",
  localidad: "",
  barrio: "",
  tel: "",
  email: "",
  limiteCredito: "",
};

const EMPTY_CREDIT = {
  concept: "",
  capital: "",
  advance: "0",
  interest: "0",
  installments: "1",
  firstDueDate: "",
};

const STAGES = {
  pendiente: "Recibido",
  diagnostico: "Diagnóstico",
  presupuesto: "Presupuesto",
  presupuesto_rechazado: "Presupuesto rechazado",
  reparacion: "Reparación",
  repuesto: "Esperando repuesto",
  listo: "Listo",
  entregado: "Entregado",
  noreparable: "No reparable",
  cancelado: "Cancelado",
  garantia: "Garantía",
};

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(
    String(value).length === 10
      ? `${value}T12:00:00`
      : value
  );

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function initials(name) {
  return String(name || "C")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getDebtAlert(activity) {
  const activeCredits =
    activity?.activeCredits ||
    [];

  if (!activeCredits.length) {
    return {
      tone: "ok",
      label: "Al día",
      overdue: false,
    };
  }

  const statuses =
    activeCredits.map((credit) =>
      getCreditStatus(credit)
    );

  const overdue =
    statuses.find((status) =>
      status.overdue
    );

  if (overdue) {
    return {
      tone: "critical",
      label: overdue.label,
      overdue: true,
    };
  }

  return {
    tone: "warning",
    label: "Deuda activa",
    overdue: false,
  };
}

function recordDate(record) {
  return (
    record?.fecha ||
    record?.fechaOrigen ||
    record?.fechaEmision ||
    record?.creadoEn ||
    record?.createdAt ||
    ""
  );
}

function errorMessage(error) {
  if (
    error?.message ===
    "CLIENT_HAS_ACTIVITY"
  ) {
    const labels = {
      tickets: "tickets",
      creditos: "créditos",
      ventas: "ventas",
      facturas: "facturas",
      presupuestos: "presupuestos",
      cajaPendientes: "operaciones de Caja",
      cuentaCorriente: "movimientos de cuenta corriente",
    };

    const detail =
      Object.entries(
        error.references || {}
      )
        .filter(([, count]) => Number(count) > 0)
        .map(([key, count]) => `${count} ${labels[key] || key}`)
        .join(", ");

    return detail
      ? `No se puede eliminar porque tiene historial asociado: ${detail}.`
      : "No se puede eliminar porque el cliente tiene historial asociado.";
  }

  if (
    error?.message ===
    "CLIENT_ARCHIVE_BLOCKED"
  ) {
    const reasons =
      Array.isArray(
        error?.reasons
      )
        ? error.reasons
        : [];

    return reasons.length
      ? `No se puede archivar todavía: ${reasons.join(" ")}`
      : "No se puede archivar porque el cliente todavía tiene operaciones pendientes.";
  }

  const map = {
    CLIENT_NAME_REQUIRED: "Ingresá el nombre o razón social.",
    CLIENT_DUPLICATE: "Ya existe un cliente con el mismo DNI, CUIT, teléfono o correo.",
    CLIENT_ID_REQUIRED: "No pudimos identificar al cliente.",
    CLIENT_NOTE_REQUIRED: "Escribí una nota.",
    CLIENT_REQUIRED: "Seleccioná un cliente.",
    CLIENT_BALANCE_EXISTS: `No se puede eliminar un cliente con saldo a favor (${formatMoney(error?.balance)}).`,
    CLIENT_ARCHIVED: "El cliente está archivado. Restauralo antes de crear nuevas operaciones.",
    CREDIT_CAPITAL_INVALID: "El capital debe ser mayor a cero.",
    CREDIT_AMOUNT_INVALID: "El capital debe ser mayor a cero.",
    CREDIT_CLIENT_REQUIRED: "Seleccioná un cliente.",
    CREDIT_ADVANCE_INVALID: "El anticipo debe ser menor que el capital.",
    CREDIT_LIMIT_EXCEEDED: `Cupo insuficiente. Disponible: ${formatMoney(error?.available)}.`,
    CREDIT_CLIENT_BLOCKED: `El cliente registra ${error?.daysLate || 0} días de mora. Gestioná la excepción desde Créditos.`,
    CREDIT_NO_ACTIVE_DEBT: "El cliente no tiene deuda activa para refinanciar.",
    CLIENT_NO_ACTIVE_DEBT: "El cliente no tiene deuda activa para refinanciar.",
    AUDIT_AMOUNT_INVALID: "Ingresá un monto mayor a cero.",
    AUDIT_CREDIT_NOTE_REQUIRED: "Seleccioná la acreditación que querés revertir.",
    AUDIT_CREDIT_NOTE_NOT_FOUND: "No se encontró la Nota de Crédito original.",
    AUDIT_CREDIT_NOTE_INVALID: "La acreditación seleccionada no pertenece a este cliente o no fue creada por Auditoría.",
    AUDIT_CREDIT_NOT_REVERSIBLE: "Esta acreditación ya no tiene saldo disponible para revertir.",
    AUDIT_BALANCE_NOT_AVAILABLE: "El cliente no tiene saldo a favor disponible para revertir.",
    AUDIT_REVERSAL_EXCEEDS_AVAILABLE: `Solo podés revertir hasta ${formatMoney(error?.available)}.`,
    AUDIT_REASON_REQUIRED: "Ingresá un motivo administrativo.",
    AUDIT_CONFIRM_REQUIRED: "Escribí ELIMINAR para confirmar la operación.",
    AUDIT_TOO_MANY_TICKETS: `Hay demasiados tickets asociados (${error?.count || 0}). Eliminá algunos tickets desde Auditoría antes de borrar el cliente.`,
    CLIENT_NOT_FOUND: "El cliente ya no existe.",
    TICKET_ID_REQUIRED: "No pudimos identificar el ticket.",
    TICKET_NOT_FOUND: "El ticket ya no existe.",
    TICKET_CLIENT_MISMATCH: "El ticket no pertenece al cliente seleccionado.",
  };

  return map[error?.message] || error?.message || "Ocurrió un error inesperado.";
}

export default function Clientes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile, user } = useAuth();

  const canTickets =
    profileHasPermission(
      profile,
      PERMISSIONS.TICKETS
    );

  const canSales =
    profileHasPermission(
      profile,
      PERMISSIONS.SALES
    );

  const canCredits =
    profileHasPermission(
      profile,
      PERMISSIONS.CREDITS
    );

  const canSeeFinancials =
    canSales ||
    canCredits;

  const canBudgets =
    canTickets ||
    canSales;

  const canInvoices =
    canSales ||
    canCredits;

  const canAccount =
    canSales ||
    canCredits;

  const canManageClientLifecycle =
    canTickets &&
    canSales &&
    canCredits;

  const canAudit =
    profileHasPermission(
      profile,
      PERMISSIONS.ALL
    );


  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const availableTabs = useMemo(
    () => [
      "summary",
      ...(canTickets ? ["tickets", "devices"] : []),
      ...(canSales || canInvoices ? ["sales"] : []),
      ...(canCredits ? ["credits"] : []),
      ...(canBudgets ? ["budgets"] : []),
      ...(canAccount ? ["account"] : []),
      ...(canAudit ? ["audit"] : []),
    ],
    [
      canTickets,
      canSales,
      canInvoices,
      canCredits,
      canBudgets,
      canAccount,
      canAudit,
    ]
  );

  const [clients, setClients] = useState([]);
  const [index, setIndex] = useState({
    tickets: [],
    sales: [],
    credits: [],
    budgets: [],
    invoices: [],
    account: [],
  });

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("active");

  const [selectedClientId, setSelectedClientId] = useState(
    () => searchParams.get("cliente") || null
  );
  const [activeTab, setActiveTab] = useState(
    () => {
      const tab = searchParams.get("tab");
      return availableTabs.includes(tab)
        ? tab
        : "summary";
    }
  );

  const [clientModal, setClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState(false);
  const [clientForm, setClientForm] = useState(EMPTY_CLIENT);
  const [savingClient, setSavingClient] = useState(false);
  const [archivingClient, setArchivingClient] = useState(false);

  const [creditModal, setCreditModal] = useState(false);
  const [creditMode, setCreditMode] = useState("new");
  const [creditForm, setCreditForm] = useState(EMPTY_CREDIT);
  const [savingCredit, setSavingCredit] = useState(false);

  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [limitValue, setLimitValue] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  const [toasts, setToasts] = useState([]);

  const [auditRows, setAuditRows] = useState([]);
  const [auditAction, setAuditAction] = useState(null);
  const [auditReason, setAuditReason] = useState("");
  const [auditConfirmText, setAuditConfirmText] = useState("");
  const [auditAmount, setAuditAmount] = useState("");
  const [savingAudit, setSavingAudit] = useState(false);

  const dismissToast = useCallback((toastId) => {
    setToasts((current) =>
      current.filter((item) => item.id !== toastId)
    );
  }, []);

  const pushToast = useCallback(
    (type, title, description = "") => {
      const id =
        globalThis.crypto?.randomUUID?.() ||
        `${Date.now()}-${Math.random()}`;

      setToasts((current) => [
        ...current.slice(-3),
        {
          id,
          type,
          title,
          description,
        },
      ]);

      window.setTimeout(
        () => dismissToast(id),
        type === "error" ? 6500 : 4300
      );

      return id;
    },
    [dismissToast]
  );

  const uiNotify = useMemo(
    () => ({
      success: (title, description = "") =>
        pushToast("success", title, description),
      error: (title, description = "") =>
        pushToast("error", title, description),
      warning: (title, description = "") =>
        pushToast("warning", title, description),
      info: (title, description = "") =>
        pushToast("info", title, description),
    }),
    [pushToast]
  );

  useEffect(() => {
    const unsubscribeClients = subscribeToClients(
      setClients,
      (error) => {
        console.error(error);
        uiNotify.error("Clientes", "No se pudieron cargar los clientes.");
      }
    );

    const unsubscribeIndex = subscribeToClientActivityIndex(
      setIndex,
      (error) => {
        console.error(error);
      },
      {
        includeTickets:
          canTickets,
        includeSales:
          canSales,
        includeCredits:
          canCredits,
        includeBudgets:
          canBudgets,
        includeInvoices:
          canInvoices,
        includeAccount:
          canAccount,
      }
    );

    return () => {
      unsubscribeClients();
      unsubscribeIndex();
    };
  }, [
    canTickets,
    canSales,
    canCredits,
    canBudgets,
    canInvoices,
    canAccount,
    uiNotify,
  ]);

  useEffect(() => {
    if (!canAudit || !selectedClientId) {
      setAuditRows([]);
      return undefined;
    }

    return subscribeToClientAudit(
      selectedClientId,
      setAuditRows,
      (error) => {
        console.error(error);
        uiNotify.error(
          "Auditoría interna",
          "No se pudo cargar el historial de auditoría."
        );
      }
    );
  }, [canAudit, selectedClientId, uiNotify]);

  /* =======================================
     CONTEXTO DE CLIENTE EN LA URL
     Permite volver al mismo perfil y pestaña.
  ======================================= */

  useEffect(() => {
    const clientId =
      searchParams.get("cliente") ||
      null;

    const requestedTab =
      searchParams.get("tab");

    const tab =
      availableTabs.includes(
        requestedTab
      )
        ? requestedTab
        : "summary";

    setSelectedClientId(clientId);
    setActiveTab(tab);
  }, [
    searchParams,
    availableTabs,
  ]);

  const setClientContext = (
    clientId,
    tab = "summary"
  ) => {
    const next =
      new URLSearchParams(
        searchParams
      );

    if (clientId) {
      next.set(
        "cliente",
        clientId
      );

      next.set(
        "tab",
        availableTabs.includes(
          tab
        )
          ? tab
          : "summary"
      );
    } else {
      next.delete("cliente");
      next.delete("tab");
    }

    setSearchParams(
      next,
      { replace: true }
    );
  };

  const selectedClient = useMemo(
    () =>
      clients.find((client) => client.id === selectedClientId) ||
      null,
    [clients, selectedClientId]
  );

  const selectedActivity = useMemo(
    () =>
      selectedClient
        ? getClientActivity(selectedClient, index)
        : null,
    [selectedClient, index]
  );

  const reversibleAuditCredits = useMemo(() => {
    const reversedByNote = new Map();

    auditRows
      .filter((row) => row.accion === "SALDO_ACREDITACION_REVERTIDA")
      .forEach((row) => {
        const noteId = String(row.notaCreditoId || "").trim();
        if (!noteId) return;

        reversedByNote.set(
          noteId,
          (reversedByNote.get(noteId) || 0) + Number(row.monto || 0)
        );
      });

    return auditRows
      .filter((row) => row.accion === "SALDO_ACREDITADO_NC" && row.notaCreditoId)
      .map((row) => {
        const original = Number(row.monto || 0);
        const reversed = Number(reversedByNote.get(row.notaCreditoId) || 0);
        return {
          ...row,
          originalAmount: original,
          reversedAmount: reversed,
          remainingAmount: Math.max(0, original - reversed),
        };
      })
      .filter((row) => row.remainingAmount > 0.0001);
  }, [auditRows]);


  const selectedDevices = useMemo(() => {
    const devices = new Map();

    (selectedActivity?.tickets || []).forEach((ticket) => {
      const name =
        ticket.equipo ||
        ticket.dispositivo ||
        [ticket.marca, ticket.modelo]
          .filter(Boolean)
          .join(" ") ||
        "Equipo";

      const serial =
        ticket.serie ||
        ticket.numeroSerie ||
        ticket.serial ||
        "";

      const key =
        `${name}::${serial}`.toLowerCase();

      const current =
        devices.get(key);

      if (current) {
        current.services += 1;

        if (
          recordDate(ticket) >
          recordDate(current.lastTicket)
        ) {
          current.lastTicket =
            ticket;
        }

        return;
      }

      devices.set(key, {
        key,
        name,
        serial,
        details:
          ticket.detalleEquipo ||
          ticket.descripcionEquipo ||
          ticket.tipoEquipo ||
          "",
        services: 1,
        lastTicket: ticket,
      });
    });

    return Array.from(
      devices.values()
    );
  }, [selectedActivity]);

  const selectedDebtAlert =
    useMemo(
      () =>
        getDebtAlert(
          selectedActivity
        ),
      [selectedActivity]
    );

  useEffect(() => {
    if (selectedClient) {
      setLimitValue(String(Number(selectedClient.limiteCredito || 0)));
    }
  }, [selectedClient]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const archived =
        client.archivado ===
        true;

      const matchesFilter =
        clientFilter === "all" ||
        (clientFilter === "archived"
          ? archived
          : !archived);

      if (!matchesFilter) {
        return false;
      }

      if (!query) {
        return true;
      }

      return [
        getClientDisplayName(client),
        getClientDocument(client),
        client.tel,
        client.email,
        client.localidad,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    clients,
    search,
    clientFilter,
  ]);

  const metrics = useMemo(() => {
    let debt = 0;
    let purchases = 0;

    clients.forEach((client) => {
      const activity = getClientActivity(client, index);
      debt += activity.debt;
      purchases += activity.purchases;
    });

    return {
      total: clients.length,
      active: clients.filter(
        (client) =>
          client.archivado !==
          true
      ).length,
      archived: clients.filter(
        (client) =>
          client.archivado ===
          true
      ).length,
      debt,
      purchases,
      creditBalance: clients.reduce(
        (sum, client) => sum + Number(client.saldoAFavor || 0),
        0
      ),
    };
  }, [clients, index]);

  const openClient = (client) => {
    setClientContext(
      client.id,
      "summary"
    );
  };

  const openNewClient = () => {
    setEditingClient(false);
    setClientForm(EMPTY_CLIENT);
    setClientModal(true);
  };

  const openEditClient = () => {
    if (!selectedClient) return;

    setEditingClient(true);
    setClientForm({
      nombre: selectedClient.nombre || selectedClient.razonSocial || "",
      apellido: selectedClient.apellido || "",
      dni: selectedClient.dni || "",
      cuit: selectedClient.cuit || "",
      direccion: selectedClient.direccion === "—" ? "" : selectedClient.direccion || "",
      provincia: selectedClient.provincia || "",
      localidad: selectedClient.localidad || "",
      barrio: selectedClient.barrio || "",
      tel: selectedClient.tel === "—" ? "" : selectedClient.tel || "",
      email: selectedClient.email === "—" ? "" : selectedClient.email || "",
      limiteCredito: selectedClient.limiteCredito || 0,
    });
    setClientModal(true);
  };

  const handleSaveClient = async () => {
    try {
      setSavingClient(true);

      if (editingClient && selectedClient) {
        await updateClient(
          selectedClient.id,
          {
            ...clientForm,
            author,
          }
        );

        uiNotify.success("Cliente actualizado", "Los datos se guardaron correctamente.");
      } else {
        const created = await createClient({
          ...clientForm,
          limiteCredito:
            canCredits
              ? clientForm.limiteCredito
              : 0,
          author,
        });

        setClientContext(
          created.id,
          "summary"
        );
        uiNotify.success("Cliente creado", `${getClientDisplayName(created)} fue registrado.`);
      }

      setClientModal(false);
      setClientForm(EMPTY_CLIENT);
    } catch (error) {
      console.error(error);
      uiNotify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingClient(false);
    }
  };

  const openAuditAction = (type, payload = null) => {
    let nextPayload = payload;

    if (type === "credit-reverse" && !nextPayload) {
      nextPayload = reversibleAuditCredits[0] || {
        legacy: true,
        notaCreditoId: "__legacy__",
        remainingAmount: Number(selectedClient?.saldoAFavor || 0),
      };
    }

    setAuditAction({ type, payload: nextPayload });
    setAuditReason("");
    setAuditConfirmText("");

    if (type === "credit-reverse" && nextPayload) {
      const maxAmount = nextPayload.legacy
        ? Number(selectedClient?.saldoAFavor || 0)
        : Math.min(
            Number(nextPayload.remainingAmount || nextPayload.monto || 0),
            Number(selectedClient?.saldoAFavor || 0)
          );
      setAuditAmount(maxAmount > 0 ? String(maxAmount) : "");
    } else {
      setAuditAmount("");
    }
  };

  const closeAuditAction = () => {
    if (savingAudit) return;
    setAuditAction(null);
    setAuditReason("");
    setAuditConfirmText("");
    setAuditAmount("");
  };

  const handleAuditAction = async () => {
    if (!selectedClient || !canAudit || !auditAction) {
      return;
    }

    const reason = auditReason.trim();

    if (!reason) {
      uiNotify.warning(
        "Motivo obligatorio",
        "Indicá por qué se realiza esta acción administrativa."
      );
      return;
    }

    try {
      setSavingAudit(true);

      if (auditAction.type === "credit") {
        const amount = Number(auditAmount);

        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("AUDIT_AMOUNT_INVALID");
        }

        const result = await createAuditCreditNote({
          clientId: selectedClient.id,
          amount,
          reason,
          author,
          actorUid: user?.uid || null,
        });

        uiNotify.success(
          "Saldo acreditado",
          `${result.noteId} · +${formatMoney(result.amount)} · Nuevo saldo ${formatMoney(result.balance)}`
        );
      }

      if (auditAction.type === "credit-reverse") {
        const amount = Number(auditAmount);
        const source = auditAction.payload;

        if (!source) {
          throw new Error("AUDIT_CREDIT_NOTE_REQUIRED");
        }

        if (!Number.isFinite(amount) || amount <= 0) {
          throw new Error("AUDIT_AMOUNT_INVALID");
        }

        const result = source.legacy
          ? await reverseLegacyClientBalance({
              clientId: selectedClient.id,
              amount,
              reason,
              author,
              actorUid: user?.uid || null,
            })
          : await reverseAuditCreditNote({
              clientId: selectedClient.id,
              creditAudit: source,
              amount,
              reason,
              author,
              actorUid: user?.uid || null,
            });

        uiNotify.success(
          source.legacy ? "Saldo anterior revertido" : "Acreditación revertida",
          `${result.debitNoteId} · -${formatMoney(result.amount)} · Nuevo saldo ${formatMoney(result.balance)}`
        );
      }

      if (auditAction.type === "ticket-delete") {
        if (auditConfirmText.trim().toUpperCase() !== "ELIMINAR") {
          throw new Error("AUDIT_CONFIRM_REQUIRED");
        }

        const ticket = auditAction.payload;

        await deleteTicketByAudit({
          ticketId: ticket?.id,
          clientId: selectedClient.id,
          clientName: getClientDisplayName(selectedClient),
          reason,
          author,
          actorUid: user?.uid || null,
        });

        uiNotify.success(
          "Ticket eliminado",
          `${ticket?.numero || ticket?.codigo || ticket?.id || "Ticket"} quedó registrado en Auditoría.`
        );
      }

      if (auditAction.type === "client-delete") {
        if (auditConfirmText.trim().toUpperCase() !== "ELIMINAR") {
          throw new Error("AUDIT_CONFIRM_REQUIRED");
        }

        const name = getClientDisplayName(selectedClient);

        const result = await deleteClientByAudit({
          client: selectedClient,
          reason,
          summary: {
            tickets: selectedActivity?.tickets.length || 0,
            ventas: selectedActivity?.sales.length || 0,
            facturas: selectedActivity?.invoices.length || 0,
            creditos: selectedActivity?.credits.length || 0,
            presupuestos: selectedActivity?.budgets.length || 0,
            cuentaCorriente: selectedActivity?.account.length || 0,
            deuda: selectedActivity?.debt || 0,
          },
          author,
          actorUid: user?.uid || null,
        });

        setAuditAction(null);
        setClientContext(null);

        const deletedTickets = Number(result?.deletedTickets || 0);

        uiNotify.success(
          "Cliente eliminado por auditoría",
          `${name} fue eliminado junto con ${deletedTickets} ${deletedTickets === 1 ? "ticket asociado" : "tickets asociados"}. El historial financiero y la Auditoría se conservan.`
        );

        return;
      }

      closeAuditAction();
    } catch (error) {
      console.error(error);
      uiNotify.error(
        "Auditoría interna",
        errorMessage(error)
      );
    } finally {
      setSavingAudit(false);
    }
  };

  const handleArchiveClient = async () => {
    if (
      !selectedClient ||
      !canManageClientLifecycle
    ) {
      return;
    }

    const archived =
      selectedClient.archivado ===
      true;

    const name =
      getClientDisplayName(
        selectedClient
      );

    const confirmed =
      window.confirm(
        archived
          ? `¿Restaurar a ${name}?\n\nEl cliente volverá a quedar habilitado para nuevas operaciones.`
          : `¿Archivar a ${name}?\n\nEl historial no se elimina. Solo podrá archivarse si no tiene tickets abiertos, créditos con saldo, operaciones pendientes en Caja ni saldo a favor.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setArchivingClient(
        true
      );

      await setClientArchived(
        selectedClient,
        !archived,
        author
      );

      if (archived) {
        setClientFilter(
          "active"
        );

        uiNotify.success(
          "Cliente restaurado",
          `${name} volvió a quedar activo.`
        );
      } else {
        setClientFilter(
          "archived"
        );

        uiNotify.success(
          "Cliente archivado",
          `${name} quedó archivado sin perder su historial.`
        );
      }
    } catch (error) {
      console.error(
        error
      );

      uiNotify.error(
        archived
          ? "No se pudo restaurar"
          : "No se pudo archivar",
        errorMessage(
          error
        )
      );
    } finally {
      setArchivingClient(
        false
      );
    }
  };

  const handleSaveLimit = async () => {
    if (
      !selectedClient ||
      !canCredits
    ) {
      return;
    }

    try {
      setSavingLimit(true);

      const value = await updateClientCreditLimit(
        selectedClient.id,
        limitValue,
        author
      );

      uiNotify.success("Límite actualizado", `Nuevo límite: ${formatMoney(value)}.`);
    } catch (error) {
      console.error(error);
      uiNotify.error("No se pudo actualizar", errorMessage(error));
    } finally {
      setSavingLimit(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedClient) return;

    try {
      setSavingNote(true);

      await addClientNote(
        selectedClient.id,
        note,
        author
      );

      setNote("");
      uiNotify.success("Nota agregada", "Quedó registrada en el perfil del cliente.");
    } catch (error) {
      console.error(error);
      uiNotify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingNote(false);
    }
  };

  const openCredit = (mode) => {
    if (
      !selectedClient ||
      !canCredits
    ) {
      return;
    }

    if (
      selectedClient.archivado ===
      true
    ) {
      uiNotify.warning(
        "Cliente archivado",
        "Restauralo antes de crear o refinanciar un crédito."
      );

      return;
    }

    setCreditMode(mode);
    setCreditForm({
      ...EMPTY_CREDIT,
      concept:
        mode === "refinance"
          ? "Refinanciación de Deuda Anterior"
          : "Otorgamiento de Crédito",
    });
    setCreditModal(true);
  };

  const handleSaveCredit = async () => {
    if (
      !selectedClient ||
      !canCredits
    ) {
      return;
    }

    try {
      setSavingCredit(true);

      if (creditMode === "refinance") {
        await refinanceClientCredits({
          client:
            selectedClient,
          credits:
            selectedActivity?.activeCredits ||
            [],
          interest:
            creditForm.interest,
          installments:
            creditForm.installments,
          firstDueDate:
            creditForm.firstDueDate,
          author,
        });

        uiNotify.success("Deuda refinanciada", "Se creó una nueva carpeta con la deuda unificada.");
      } else {
        await createCredit({
          client:
            selectedClient,
          concept:
            creditForm.concept,
          capital:
            creditForm.capital,
          advance:
            creditForm.advance,
          interest:
            creditForm.interest,
          installments:
            creditForm.installments,
          firstDueDate:
            creditForm.firstDueDate,
          author,
        });

        uiNotify.success("Crédito creado", "La nueva carpeta fue registrada.");
      }

      setCreditModal(false);
      setCreditForm(EMPTY_CREDIT);
      setClientContext(
        selectedClient.id,
        "credits"
      );
    } catch (error) {
      console.error(error);
      uiNotify.error("No se pudo procesar", errorMessage(error));
    } finally {
      setSavingCredit(false);
    }
  };

  const openTicketFromClient = (ticket) => {
    if (!selectedClient) return;

    const returnTo =
      `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=tickets`;

    navigate(
      `/tickets/${ticket.id}`,
      {
        state: {
          returnTo,
          fromClient: {
            clientId: selectedClient.id,
            tab: "tickets",
          },
        },
      }
    );
  };

  const openCreditFromClient = (credit) => {
    if (!selectedClient) return;

    const returnTo =
      `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=credits`;

    navigate(
      "/creditos",
      {
        state: {
          creditId: credit.id,
          returnTo,
          fromClient: {
            clientId: selectedClient.id,
            tab: "credits",
          },
        },
      }
    );
  };


  const openSaleFromClient = (sale) => {
    if (!selectedClient) return;

    navigate(
      "/facturacion/facturas",
      {
        state: {
          saleId: sale.id,
          returnTo:
            `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=sales`,
        },
      }
    );
  };

  const openInvoiceFromClient = (invoice) => {
    if (!selectedClient) return;

    navigate(
      "/facturacion/facturas",
      {
        state: {
          invoiceId: invoice.id,
          returnTo:
            `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=sales`,
        },
      }
    );
  };

  const openBudgetFromClient = (budget) => {
    if (!selectedClient) return;

    navigate(
      "/facturacion/presupuestos",
      {
        state: {
          budgetId: budget.id,
          returnTo:
            `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=budgets`,
        },
      }
    );
  };

  const openNewTicketForClient = (device = null) => {
    if (
      !selectedClient ||
      !canTickets
    ) {
      return;
    }

    navigate(
      "/tickets/nuevo",
      {
        state: {
          clienteId:
            selectedClient.id,
          device:
            device
              ? {
                  name:
                    device.name,
                  serial:
                    device.serial,
                }
              : null,
          returnTo:
            `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=${device ? "devices" : "summary"}`,
        },
      }
    );
  };

  return (
    <main className="clients-page">
      <div className="clients-shell">
        {typeof document !== "undefined" &&
          createPortal(
            <header className={`clients-topbar${selectedClient ? " profile" : ""}`}>
              {!selectedClient ? (
                <>
                  <div className="clients-brand">
                    <button
                      type="button"
                      className="clients-icon-button"
                      onClick={() => navigate("/dashboard")}
                      title="Volver al Dashboard"
                    >
                      <ArrowLeft size={18} />
                    </button>
            
                    <div className="clients-brand-mark">
                      <UserRound size={20} />
                    </div>
            
                    <div>
                      <strong>ALEX SOPORTE TECNICO</strong>
                      <span>Clientes</span>
                    </div>
                  </div>
            
                  <button
                    type="button"
                    className="clients-action primary"
                    onClick={openNewClient}
                  >
                    <Plus size={17} />
                    Nuevo cliente
                  </button>
                </>
              ) : (
                <>
                  <div className="clients-brand">
                    <button
                      type="button"
                      className="clients-icon-button"
                      onClick={() => setClientContext(null)}
                      title="Volver a Clientes"
                    >
                      <ArrowLeft size={18} />
                    </button>
            
                    <div className="clients-brand-mark profile">
                      {initials(getClientDisplayName(selectedClient))}
                    </div>
            
                    <div>
                      <strong>{getClientDisplayName(selectedClient)}</strong>
                      <span>Perfil de cliente</span>
                    </div>
                  </div>
            
                  <div className="clients-profile-top-actions">
                    <button
                      type="button"
                      className="clients-action"
                      onClick={openEditClient}
                    >
                      <Pencil size={16} />
                      Editar
                    </button>
            
                    {canManageClientLifecycle && (
                      <button
                        type="button"
                        className={`clients-action ${
                          selectedClient.archivado === true
                            ? "restore"
                            : "archive"
                        }`}
                        disabled={archivingClient}
                        onClick={handleArchiveClient}
                      >
                        {selectedClient.archivado === true ? (
                          <ArchiveRestore size={16} />
                        ) : (
                          <Archive size={16} />
                        )}
                        {selectedClient.archivado === true ? "Restaurar" : "Archivar"}
                      </button>
                    )}
            
                  </div>
                </>
              )}
            </header>
            ,
            document.body
          )}


        <AnimatePresence mode="wait">
          {!selectedClient ? (
            <motion.section
              key="directory"
              className="clients-directory-view"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >


              <div className="clients-directory-title">
                <div>
                  <span className="clients-eyebrow">Directorio comercial</span>
                  <h1>Clientes</h1>
                  <p>
                    {metrics.active} activos · {metrics.archived} archivados · {metrics.total} registrados
                  </p>
                </div>
              </div>

              <div className="clients-alert-criteria" aria-label="Criterio de alertas">
                <strong>Criterio</strong>
                <span className="ok"><i />Al día</span>
                <span className="warning"><i />Deuda activa</span>
                <span className="critical"><i />Mora / vencimiento</span>
                <span className="info"><i />Informativo</span>
              </div>

              <section className="clients-directory-panel">
                <div className="clients-directory-toolbar">
                  <label className="clients-search">
                    <Search size={18} />
                    <input
                      value={search}
                      placeholder="Buscar por nombre, DNI, CUIT, teléfono o correo..."
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <div className="clients-directory-filters">
                    {[
                      ["active", "Activos"],
                      ["archived", "Archivados"],
                      ["all", "Todos"],
                    ].map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        className={clientFilter === id ? "active" : ""}
                        onClick={() => setClientFilter(id)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="clients-list-head">
                  <span>Cliente</span>
                  <span>Contacto</span>
                  <span>Actividad</span>
                  <span>Finanzas</span>
                  <span />
                </div>

                <div className="clients-list">
                  <AnimatePresence initial={false}>
                    {rows.map((client, rowIndex) => {
                      const activity = getClientActivity(client, index);
                      const name = getClientDisplayName(client);
                      const alert = getDebtAlert(activity);

                      return (
                        <motion.div
                          layout
                          key={client.id}
                          className={[
                            "clients-list-row",
                            client.archivado === true ? "archived" : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          role="button"
                          tabIndex={0}
                          onClick={() => openClient(client)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openClient(client);
                            }
                          }}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{
                            duration: 0.2,
                            delay: Math.min(rowIndex * 0.025, 0.18),
                          }}
                        >
                          <div className="clients-person">
                            <div className="clients-avatar">
                              {initials(name)}
                            </div>
                            <section>
                              <strong>{name}</strong>
                              <span>
                                {getClientDocument(client)}
                                {client.archivado === true && (
                                  <em className="clients-inline-status archived">
                                    Archivado
                                  </em>
                                )}
                                {client.archivado !== true && (
                                  <em className="clients-inline-status active">
                                    Activo
                                  </em>
                                )}
                              </span>
                            </section>
                          </div>

                          <div className="clients-contact-cell">
                            <strong>{client.tel || "Sin teléfono"}</strong>
                            <span>{client.email || client.localidad || "Sin contacto adicional"}</span>
                          </div>

                          <div className="clients-activity-cell">
                            <strong>
                              {canTickets ? `${activity.tickets.length} tickets` : "Historial"}
                              {canSales ? ` · ${activity.sales.length} ventas` : ""}
                            </strong>
                            <span>
                              {canBudgets
                                ? `${activity.budgets.length} presupuestos`
                                : "Consultar perfil"}
                            </span>
                          </div>

                          <div className="clients-finance-cell">
                            {canSeeFinancials ? (
                              <>
                                <div>
                                  <span>Deuda</span>
                                  <strong className={activity.debt > 0 ? "negative" : ""}>
                                    {formatMoney(activity.debt)}
                                  </strong>
                                  {canCredits && (
                                    <em className={`clients-debt-alert ${alert.tone}`}>
                                      <i />
                                      {alert.label}
                                    </em>
                                  )}
                                </div>

                                <div>
                                  <span>A favor</span>
                                  <strong className={Number(client.saldoAFavor || 0) > 0 ? "positive" : ""}>
                                    {formatMoney(client.saldoAFavor)}
                                  </strong>
                                </div>
                              </>
                            ) : (
                              <div>
                                <span>Estado</span>
                                <strong>{client.archivado === true ? "Archivado" : "Activo"}</strong>
                              </div>
                            )}
                          </div>

                          <div className="clients-row-actions">
                            <button
                              type="button"
                              className="clients-record-button"
                              onClick={(event) => {
                                event.stopPropagation();
                                openClient(client);
                              }}
                            >
                              <UserRound size={15} />
                              Ver cliente
                            </button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {!rows.length && (
                    <div className="clients-empty clients-empty-directory">
                      <UserRound size={28} />
                      <strong>Sin resultados</strong>
                      <span>No encontramos clientes con ese filtro.</span>
                    </div>
                  )}
                </div>
              </section>
            </motion.section>
          ) : (
            <motion.section
              key={`profile-${selectedClient.id}`}
              className="clients-profile-view"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.24 }}
            >


              <section className="clients-profile-hero">
                <div className="clients-profile-identity">
                  <div className="clients-profile-avatar">
                    {initials(getClientDisplayName(selectedClient))}
                  </div>

                  <div>
                    <h1>{getClientDisplayName(selectedClient)}</h1>
                    <p>
                      {getClientDocument(selectedClient)}
                      {selectedClient.tel ? ` · ${selectedClient.tel}` : ""}
                      {selectedClient.email ? ` · ${selectedClient.email}` : ""}
                    </p>

                    <div className="clients-profile-chips">
                      <span className={selectedClient.archivado === true ? "archived" : "active"}>
                        {selectedClient.archivado === true ? "Archivado" : "Activo"}
                      </span>

                      {canCredits && selectedDebtAlert.overdue && (
                        <span className="critical">
                          <AlertTriangle size={13} />
                          {selectedDebtAlert.label}
                        </span>
                      )}

                      {canCredits && !selectedDebtAlert.overdue && selectedActivity?.debt > 0 && (
                        <span className="warning">
                          <AlertTriangle size={13} />
                          Deuda activa
                        </span>
                      )}

                      {canCredits && selectedActivity?.debt <= 0 && (
                        <span className="success">
                          <CheckCircle2 size={13} />
                          Al día
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="clients-profile-main-actions">
                  {canTickets && (
                    <button
                      type="button"
                      className="clients-action soft-blue"
                      disabled={selectedClient.archivado === true}
                      onClick={() => openNewTicketForClient()}
                    >
                      <Ticket size={16} />
                      Nuevo ticket
                    </button>
                  )}

                  {canSales && (
                    <button
                      type="button"
                      className="clients-action soft-green"
                      disabled={selectedClient.archivado === true}
                      onClick={() =>
                        navigate(
                          "/caja",
                          {
                            state: {
                              clienteId:
                                selectedClient.id,
                              returnTo:
                                `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=sales`,
                            },
                          }
                        )
                      }
                    >
                      <ShoppingBag size={16} />
                      Nueva venta
                    </button>
                  )}

                  {canCredits && (
                    <button
                      type="button"
                      className="clients-action soft-purple"
                      disabled={selectedClient.archivado === true}
                      onClick={() => openCredit("new")}
                    >
                      <BadgeDollarSign size={16} />
                      Nuevo crédito
                    </button>
                  )}
                </div>
              </section>

              {selectedClient.archivado === true && (
                <div className="clients-archived-notice">
                  <Archive size={17} />
                  <div>
                    <strong>Cliente archivado</strong>
                    <span>
                      El historial continúa disponible, pero las nuevas operaciones
                      permanecen bloqueadas hasta restaurarlo.
                    </span>
                  </div>
                </div>
              )}

              <section className="clients-summary-strip">
                {canTickets && (
                  <motion.article whileHover={{ y: -4, rotateX: 1.2, rotateY: -1.2 }}>
                    <div className="icon blue"><Ticket size={19} /></div>
                    <span>Tickets</span>
                    <strong>{selectedActivity?.tickets.length || 0}</strong>
                    <small>Servicios vinculados</small>
                  </motion.article>
                )}

                {canSales && (
                  <motion.article whileHover={{ y: -4, rotateX: 1.2, rotateY: 1.2 }}>
                    <div className="icon green"><ReceiptText size={19} /></div>
                    <span>Compras acumuladas</span>
                    <strong>{formatMoney(selectedActivity?.purchases)}</strong>
                    <small>{selectedActivity?.sales.length || 0} ventas registradas</small>
                  </motion.article>
                )}

                {canCredits && (
                  <motion.article
                    className={selectedActivity?.debt > 0 ? "has-alert" : ""}
                    whileHover={{ y: -4, rotateX: -1.2, rotateY: 1.2 }}
                  >
                    <div className="icon pink"><CreditCard size={19} /></div>
                    <span>Deuda actual</span>
                    <strong>{formatMoney(selectedActivity?.debt)}</strong>
                    <small>{selectedActivity?.activeCredits.length || 0} carpetas con saldo</small>
                    {selectedActivity?.debt > 0 && (
                      <em className={`clients-summary-alert ${selectedDebtAlert.overdue ? "critical" : "warning"}`}>
                        <i />
                        {selectedDebtAlert.label}
                      </em>
                    )}
                  </motion.article>
                )}

                {canSeeFinancials && (
                  <motion.article whileHover={{ y: -4, rotateX: -1.2, rotateY: -1.2 }}>
                    <div className="icon purple"><WalletCards size={19} /></div>
                    <span>Saldo a favor</span>
                    <strong>{formatMoney(selectedClient.saldoAFavor)}</strong>
                    <small>Disponible para aplicar</small>
                  </motion.article>
                )}
              </section>

              <nav className="clients-module-tabs">
                {[
                  ["summary", "Resumen", UserRound],
                  ...(canTickets
                    ? [
                        ["tickets", `Tickets ${selectedActivity?.tickets.length || 0}`, Ticket],
                        ["devices", `Equipos ${selectedDevices.length}`, MonitorSmartphone],
                      ]
                    : []),
                  ...(canSales || canInvoices
                    ? [["sales", "Ventas / Facturas", ReceiptText]]
                    : []),
                  ...(canCredits
                    ? [["credits", `Créditos ${selectedActivity?.credits.length || 0}`, CreditCard]]
                    : []),
                  ...(canBudgets
                    ? [["budgets", `Presupuestos ${selectedActivity?.budgets.length || 0}`, FileText]]
                    : []),
                  ...(canAccount
                    ? [["account", "Cuenta corriente", WalletCards]]
                    : []),
                  ...(canAudit
                    ? [["audit", "Auditoría interna", ShieldCheck]]
                    : []),
                ].map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    className={activeTab === id ? "active" : ""}
                    onClick={() => setClientContext(selectedClient.id, id)}
                  >
                    <Icon size={16} />
                    {label}
                  </button>
                ))}
              </nav>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  className="clients-module-content"
                  initial={{ opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "summary" && (
                    <div className="clients-overview-grid">
                      <section className="clients-module-card">
                        <header>
                          <div>
                            <span>Información</span>
                            <h3>Datos del cliente</h3>
                          </div>
                          <UserRound size={19} />
                        </header>

                        <div className="clients-info-grid">
                          <div>
                            <span>Documento</span>
                            <strong>{getClientDocument(selectedClient)}</strong>
                          </div>
                          <div>
                            <span>Teléfono</span>
                            <strong>{selectedClient.tel || "—"}</strong>
                          </div>
                          <div>
                            <span>Correo</span>
                            <strong>{selectedClient.email || "—"}</strong>
                          </div>
                          <div>
                            <span>Dirección</span>
                            <strong>
                              {[selectedClient.direccion, selectedClient.localidad, selectedClient.provincia]
                                .filter((value) => value && value !== "—")
                                .join(", ") || "—"}
                            </strong>
                          </div>
                        </div>

                        {canCredits && (
                          <div className="clients-credit-limit">
                            <div>
                              <span>Límite de crédito</span>
                              <strong>{formatMoney(limitValue)}</strong>
                            </div>
                            <div className="clients-limit-row">
                              <input
                                type="number"
                                min="0"
                                value={limitValue}
                                disabled={selectedClient.archivado === true}
                                onChange={(event) => setLimitValue(event.target.value)}
                              />
                              <button
                                type="button"
                                disabled={savingLimit || selectedClient.archivado === true}
                                onClick={handleSaveLimit}
                              >
                                {savingLimit ? "Guardando..." : "Actualizar"}
                              </button>
                            </div>
                          </div>
                        )}
                      </section>

                      <section className="clients-module-card notes">
                        <header>
                          <div>
                            <span>Bitácora</span>
                            <h3>Notas del cliente</h3>
                          </div>
                          <NotebookPen size={19} />
                        </header>

                        <textarea
                          rows="3"
                          value={note}
                          placeholder="Ej: Prefiere contacto telefónico por la tarde..."
                          onChange={(event) => setNote(event.target.value)}
                        />

                        <button
                          type="button"
                          className="clients-note-save"
                          disabled={savingNote || !note.trim()}
                          onClick={handleAddNote}
                        >
                          {savingNote ? "Guardando..." : "Agregar nota"}
                        </button>

                        <div className="clients-notes-list">
                          {(selectedClient.notas || [])
                            .slice()
                            .reverse()
                            .map((item, indexNote) => {
                              const data =
                                typeof item === "string"
                                  ? { texto: item }
                                  : item;

                              return (
                                <article key={`${data.fecha || "nota"}-${indexNote}`}>
                                  <strong>{data.texto || data.detalle || "Nota"}</strong>
                                  <span>
                                    {data.autor || "Sistema"}
                                    {data.fecha ? ` · ${formatDate(data.fecha)}` : ""}
                                  </span>
                                </article>
                              );
                            })}

                          {!(selectedClient.notas || []).length && (
                            <small>Sin notas registradas.</small>
                          )}
                        </div>
                      </section>
                    </div>
                  )}

                  {activeTab === "tickets" && (
                    <section className="clients-module-card data">
                      <header>
                        <div>
                          <span>Fuente: Tickets</span>
                          <h3>Tickets del cliente</h3>
                        </div>
                        <Ticket size={19} />
                      </header>

                      <div className="clients-record-list">
                        {selectedActivity?.tickets.map((ticket) => (
                          <article key={ticket.id} className="clients-record-row">
                            <div>
                              <strong>#{ticket.id}</strong>
                              <span>{formatDate(recordDate(ticket))}</span>
                            </div>
                            <div className="grow">
                              <strong>{ticket.equipo || "Equipo"}</strong>
                              <span>{ticket.falla || "Sin falla informada"}</span>
                            </div>
                            <span className="clients-state blue">
                              {STAGES[ticket.stage] || ticket.stage || "Pendiente"}
                            </span>
                            <button
                              type="button"
                              className="clients-record-button"
                              onClick={() => openTicketFromClient(ticket)}
                            >
                              <ExternalLink size={14} />
                              Ver ticket
                            </button>
                          </article>
                        ))}

                        {!selectedActivity?.tickets.length && (
                          <div className="clients-empty compact">
                            <Ticket size={23} />
                            <strong>Sin tickets</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {activeTab === "sales" && (
                    <div className="clients-data-stack">
                      {canSales && (
                        <section className="clients-module-card data">
                          <header>
                            <div>
                              <span>Fuente: Caja / Ventas</span>
                              <h3>Ventas</h3>
                            </div>
                            <ShoppingBag size={19} />
                          </header>

                          <div className="clients-record-list">
                            {selectedActivity?.sales.map((sale) => (
                              <article key={sale.id} className="clients-record-row">
                                <div>
                                  <strong>{sale.folio || sale.id}</strong>
                                  <span>{formatDate(recordDate(sale))}</span>
                                </div>
                                <div className="grow">
                                  <strong>{sale.articulos || sale.concepto || "Venta"}</strong>
                                  <span>{sale.medioPago || sale.formaPago || "Operación registrada"}</span>
                                </div>
                                <strong className="clients-money">{formatMoney(sale.total)}</strong>
                                <button
                                  type="button"
                                  className="clients-record-button"
                                  onClick={() => openSaleFromClient(sale)}
                                >
                                  <ExternalLink size={14} />
                                  Ver venta
                                </button>
                              </article>
                            ))}

                            {!selectedActivity?.sales.length && (
                              <div className="clients-empty compact">
                                <ReceiptText size={23} />
                                <strong>Sin ventas registradas</strong>
                              </div>
                            )}
                          </div>
                        </section>
                      )}

                      {canInvoices && (
                        <section className="clients-module-card data">
                          <header>
                            <div>
                              <span>Fuente: Facturación</span>
                              <h3>Facturas</h3>
                            </div>
                            <ReceiptText size={19} />
                          </header>

                          <div className="clients-record-list">
                            {selectedActivity?.invoices.map((invoice) => (
                              <article key={invoice.id} className="clients-record-row">
                                <div>
                                  <strong>{invoice.numero || invoice.folio || invoice.id}</strong>
                                  <span>{formatDate(recordDate(invoice))}</span>
                                </div>
                                <div className="grow">
                                  <strong>{invoice.concepto || "Factura"}</strong>
                                  <span>{invoice.estado || invoice.estadoPago || "Emitida"}</span>
                                </div>
                                <strong className="clients-money">{formatMoney(invoice.total)}</strong>
                                <button
                                  type="button"
                                  className="clients-record-button"
                                  onClick={() => openInvoiceFromClient(invoice)}
                                >
                                  <ExternalLink size={14} />
                                  Ver factura
                                </button>
                              </article>
                            ))}

                            {!selectedActivity?.invoices.length && (
                              <div className="clients-empty compact">
                                <ReceiptText size={23} />
                                <strong>Sin facturas registradas</strong>
                              </div>
                            )}
                          </div>
                        </section>
                      )}
                    </div>
                  )}

                  {activeTab === "credits" && (
                    <section className="clients-module-card data">
                      <header>
                        <div>
                          <span>Fuente: Créditos</span>
                          <h3>Carpetas de crédito</h3>
                        </div>

                        <div className="clients-card-actions">
                          <button
                            type="button"
                            className="clients-action soft-purple"
                            disabled={selectedClient.archivado === true}
                            onClick={() => openCredit("new")}
                          >
                            <Plus size={15} />
                            Nuevo
                          </button>
                          <button
                            type="button"
                            className="clients-action"
                            disabled={
                              selectedClient.archivado === true ||
                              !selectedActivity?.activeCredits.length
                            }
                            onClick={() => openCredit("refinance")}
                          >
                            <FileClock size={15} />
                            Refinanciar
                          </button>
                        </div>
                      </header>

                      <div className="clients-record-list">
                        {selectedActivity?.credits.map((credit) => {
                          const status = getCreditStatus(credit);

                          return (
                            <article key={credit.id} className="clients-record-row credit">
                              <div>
                                <span className={`clients-state ${status.overdue ? "critical" : status.key === "saldado" ? "green" : "purple"}`}>
                                  {status.label}
                                </span>
                                <strong>{credit.id}</strong>
                                <span>{formatDate(credit.fechaOrigen)}</span>
                              </div>
                              <div className="grow">
                                <strong>{credit.concepto || "Crédito"}</strong>
                                <span>
                                  Original {formatMoney(credit.original)} · Saldo {formatMoney(credit.saldo)}
                                </span>
                              </div>
                              <strong className={Number(credit.saldo || 0) > 0 ? "clients-money negative" : "clients-money positive"}>
                                {formatMoney(credit.saldo)}
                              </strong>
                              <button
                                type="button"
                                className="clients-record-button"
                                onClick={() => openCreditFromClient(credit)}
                              >
                                <ExternalLink size={14} />
                                Ver crédito
                              </button>
                            </article>
                          );
                        })}

                        {!selectedActivity?.credits.length && (
                          <div className="clients-empty compact">
                            <CreditCard size={23} />
                            <strong>Sin carpetas de crédito</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {activeTab === "budgets" && (
                    <section className="clients-module-card data">
                      <header>
                        <div>
                          <span>Fuente: Presupuestos</span>
                          <h3>Presupuestos</h3>
                        </div>
                        <FileText size={19} />
                      </header>

                      <div className="clients-record-list">
                        {selectedActivity?.budgets.map((budget) => (
                          <article key={budget.id} className="clients-record-row">
                            <div>
                              <strong>{budget.numero || budget.folio || budget.id}</strong>
                              <span>{formatDate(recordDate(budget))}</span>
                            </div>
                            <div className="grow">
                              <strong>{budget.titulo || budget.concepto || "Presupuesto"}</strong>
                              <span>{budget.ticketId ? `Ticket ${budget.ticketId}` : "Presupuesto manual"}</span>
                            </div>
                            <span className="clients-state purple">
                              {budget.estado || budget.status || "Pendiente"}
                            </span>
                            <strong className="clients-money">{formatMoney(budget.total)}</strong>
                            <button
                              type="button"
                              className="clients-record-button"
                              onClick={() => openBudgetFromClient(budget)}
                            >
                              <ExternalLink size={14} />
                              Ver presupuesto
                            </button>
                          </article>
                        ))}

                        {!selectedActivity?.budgets.length && (
                          <div className="clients-empty compact">
                            <FileText size={23} />
                            <strong>Sin presupuestos</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {activeTab === "devices" && (
                    <section className="clients-module-card data">
                      <header>
                        <div>
                          <span>Fuente: Tickets</span>
                          <h3>Equipos registrados</h3>
                        </div>
                        <MonitorSmartphone size={19} />
                      </header>

                      <div className="clients-record-list">
                        {selectedDevices.map((device) => (
                          <article key={device.key} className="clients-record-row">
                            <div className="grow">
                              <strong>{device.name}</strong>
                              <span>
                                {device.details || "Equipo asociado a servicios anteriores"}
                              </span>
                            </div>
                            <div>
                              <strong>{device.serial || "Sin serie"}</strong>
                              <span>{device.services} servicios</span>
                            </div>
                            <button
                              type="button"
                              className="clients-record-button"
                              disabled={selectedClient.archivado === true}
                              onClick={() => openNewTicketForClient(device)}
                            >
                              <Plus size={14} />
                              Nuevo ticket
                            </button>
                          </article>
                        ))}

                        {!selectedDevices.length && (
                          <div className="clients-empty compact">
                            <MonitorSmartphone size={23} />
                            <strong>Sin equipos registrados</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {activeTab === "account" && (
                    <section className="clients-module-card data">
                      <header>
                        <div>
                          <span>Fuente: Cuenta corriente</span>
                          <h3>Movimientos</h3>
                        </div>
                        <WalletCards size={19} />
                      </header>

                      <div className="clients-record-list">
                        {selectedActivity?.account.map((movement) => (
                          <article key={movement.id} className="clients-record-row">
                            <div>
                              <strong>{formatDate(recordDate(movement))}</strong>
                              <span>{movement.refId || movement.origen || "Movimiento"}</span>
                            </div>
                            <div className="grow">
                              <strong>{movement.concepto || "Cuenta corriente"}</strong>
                              <span>
                                Saldo posterior {formatMoney(movement.saldoPosterior)}
                              </span>
                            </div>
                            <strong className={`clients-money ${String(movement.tipo || "").toLowerCase().includes("crédito") ? "positive" : "negative"}`}>
                              {String(movement.tipo || "").toLowerCase().includes("crédito") ? "+" : "-"} {formatMoney(movement.importe)}
                            </strong>
                          </article>
                        ))}

                        {!selectedActivity?.account.length && (
                          <div className="clients-empty compact">
                            <WalletCards size={23} />
                            <strong>Sin movimientos de cuenta corriente</strong>
                          </div>
                        )}
                      </div>
                    </section>
                  )}

                  {activeTab === "audit" && canAudit && (
                    <div className="clients-audit-layout">
                      <section className="clients-audit-hero">
                        <div className="clients-audit-hero-icon">
                          <ShieldCheck size={28} />
                        </div>
                        <div>
                          <span>Acceso administrativo</span>
                          <h3>Auditoría interna</h3>
                          <p>
                            Las acciones de esta sección son sensibles. Cada operación
                            exige un motivo y queda registrada con usuario, fecha y datos
                            de respaldo.
                          </p>
                        </div>
                      </section>

                      <div className="clients-audit-grid">
                        <section className="clients-audit-card credit">
                          <header>
                            <div>
                              <span>Ajuste financiero</span>
                              <h3>Acreditar saldo</h3>
                            </div>
                            <CircleDollarSign size={22} />
                          </header>

                          <p>
                            Agrega saldo a favor y genera automáticamente una Nota de
                            Crédito interna, un movimiento de cuenta corriente y un
                            registro de auditoría.
                          </p>

                          <div className="clients-audit-value">
                            <span>Saldo actual</span>
                            <strong>{formatMoney(selectedClient.saldoAFavor)}</strong>
                          </div>

                          <div className="clients-audit-credit-actions">
                            <button
                              type="button"
                              className="clients-audit-button credit"
                              onClick={() => openAuditAction("credit")}
                            >
                              <Plus size={16} />
                              Acreditar con Nota de Crédito
                            </button>

                            <button
                              type="button"
                              className="clients-audit-button reverse"
                              disabled={Number(selectedClient.saldoAFavor || 0) <= 0}
                              onClick={() => openAuditAction("credit-reverse")}
                              title={
                                Number(selectedClient.saldoAFavor || 0) > 0
                                  ? "Revertir una acreditación registrada o saldo anterior"
                                  : "El cliente no tiene saldo a favor disponible"
                              }
                            >
                              <RotateCcw size={16} />
                              Revertir acreditación
                            </button>
                          </div>
                        </section>

                        <section className="clients-audit-card danger">
                          <header>
                            <div>
                              <span>Zona crítica</span>
                              <h3>Eliminar cliente</h3>
                            </div>
                            <ShieldAlert size={22} />
                          </header>

                          <p>
                            Permite eliminar el cliente aunque tenga saldo a favor. También se
                            eliminan sus tickets asociados, dejando una copia completa en
                            Auditoría. Los comprobantes y movimientos financieros no se eliminan.
                          </p>

                          <div className="clients-audit-danger-summary">
                            <span>{selectedActivity?.tickets.length || 0} tickets</span>
                            <span>{selectedActivity?.credits.length || 0} créditos</span>
                            <span>Deuda {formatMoney(selectedActivity?.debt)}</span>
                            <span>Saldo {formatMoney(selectedClient.saldoAFavor)}</span>
                          </div>

                          <button
                            type="button"
                            className="clients-audit-button danger"
                            onClick={() => openAuditAction("client-delete")}
                          >
                            <Trash2 size={16} />
                            Eliminar cliente por auditoría
                          </button>
                        </section>
                      </div>

                      <section className="clients-audit-panel">
                        <header>
                          <div>
                            <span>Eliminación controlada</span>
                            <h3>Tickets vinculados</h3>
                          </div>
                          <Ticket size={20} />
                        </header>

                        <div className="clients-audit-ticket-list">
                          {(selectedActivity?.tickets || []).map((ticket) => (
                            <article key={ticket.id}>
                              <div>
                                <strong>
                                  {ticket.numero || ticket.codigo || ticket.nro || ticket.id}
                                </strong>
                                <span>
                                  {ticket.equipo || ticket.dispositivo || ticket.modelo || "Equipo"}
                                  {ticket.estado ? ` · ${STAGES[ticket.estado] || ticket.estado}` : ""}
                                </span>
                              </div>

                              <div className="clients-audit-ticket-actions">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/tickets/${ticket.id}`)}
                                >
                                  <ExternalLink size={15} />
                                  Ver ticket
                                </button>
                                <button
                                  type="button"
                                  className="danger"
                                  onClick={() => openAuditAction("ticket-delete", ticket)}
                                >
                                  <Trash2 size={15} />
                                  Eliminar por auditoría
                                </button>
                              </div>
                            </article>
                          ))}

                          {!selectedActivity?.tickets.length && (
                            <div className="clients-empty compact">
                              <Ticket size={23} />
                              <strong>Sin tickets vinculados</strong>
                            </div>
                          )}
                        </div>
                      </section>

                      <section className="clients-audit-panel history">
                        <header>
                          <div>
                            <span>Trazabilidad</span>
                            <h3>Historial de auditoría</h3>
                          </div>
                          <History size={20} />
                        </header>

                        <div className="clients-audit-history">
                          {auditRows.map((row) => (
                            <article key={row.id}>
                              <div className={`clients-audit-history-icon ${
                                String(row.accion || "").includes("ELIMINADO")
                                  ? "danger"
                                  : ["SALDO_ACREDITACION_REVERTIDA", "SALDO_EXISTENTE_REVERTIDO"].includes(row.accion)
                                    ? "reverse"
                                    : "credit"
                              }`}>
                                {String(row.accion || "").includes("ELIMINADO") ? (
                                  <Trash2 size={16} />
                                ) : ["SALDO_ACREDITACION_REVERTIDA", "SALDO_EXISTENTE_REVERTIDO"].includes(row.accion) ? (
                                  <RotateCcw size={16} />
                                ) : (
                                  <CircleDollarSign size={16} />
                                )}
                              </div>
                              <div className="grow">
                                <strong>
                                  {row.accion === "CLIENTE_ELIMINADO"
                                    ? "Cliente eliminado"
                                    : row.accion === "TICKET_ELIMINADO"
                                      ? `Ticket eliminado · ${row.ticketNumero || row.entidadId || ""}`
                                      : row.accion === "SALDO_ACREDITADO_NC"
                                        ? `Saldo acreditado · ${row.notaCreditoId || "NC"}`
                                        : row.accion === "SALDO_ACREDITACION_REVERTIDA"
                                          ? `Acreditación revertida · ${row.notaDebitoId || "NDA"}`
                                          : row.accion === "SALDO_EXISTENTE_REVERTIDO"
                                            ? `Saldo anterior revertido · ${row.notaDebitoId || "NDA"}`
                                            : row.accion || "Acción administrativa"}
                                </strong>
                                <span>{row.motivo || "Sin detalle"}</span>
                                <small>
                                  {formatDate(row.creadoEn)} · {row.actorNombre || "Sistema"}
                                </small>
                              </div>
                              {Number(row.monto || 0) > 0 && (
                                <strong className={`clients-money ${["SALDO_ACREDITACION_REVERTIDA", "SALDO_EXISTENTE_REVERTIDO"].includes(row.accion) ? "negative" : "positive"}`}>
                                  {["SALDO_ACREDITACION_REVERTIDA", "SALDO_EXISTENTE_REVERTIDO"].includes(row.accion) ? "−" : "+"} {formatMoney(row.monto)}
                                </strong>
                              )}
                              {row.accion === "SALDO_ACREDITADO_NC" && Number(selectedClient.saldoAFavor || 0) > 0 && reversibleAuditCredits.some((item) => item.id === row.id) && (
                                <button
                                  type="button"
                                  className="clients-audit-history-reverse"
                                  onClick={() => openAuditAction(
                                    "credit-reverse",
                                    reversibleAuditCredits.find((item) => item.id === row.id)
                                  )}
                                >
                                  <RotateCcw size={14} />
                                  Revertir
                                </button>
                              )}
                            </article>
                          ))}

                          {!auditRows.length && (
                            <div className="clients-empty compact">
                              <History size={23} />
                              <strong>Todavía no hay acciones registradas</strong>
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      <div className="clients-toast-stack" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              className={`clients-toast ${toast.type}`}
              initial={{ opacity: 0, y: 18, x: 10, scale: 0.95, filter: "blur(4px)" }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 10, x: 12, scale: 0.97, filter: "blur(3px)" }}
              transition={{ type: "spring", stiffness: 430, damping: 30 }}
            >
              <div className="clients-toast-icon">
                {toast.type === "success" ? (
                  <CheckCircle2 size={20} />
                ) : (
                  <AlertTriangle size={20} />
                )}
              </div>

              <div className="clients-toast-copy">
                <strong>{toast.title}</strong>
                {toast.description && <span>{toast.description}</span>}
              </div>

              <button
                type="button"
                onClick={() => dismissToast(toast.id)}
                aria-label="Cerrar notificación"
              >
                <X size={16} />
              </button>

              <i className="clients-toast-progress" />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {clientModal && (
        <div
          className="clients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingClient) {
              setClientModal(false);
            }
          }}
        >
          <motion.div
            className="clients-modal"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <header>
              <div>
                <span>{editingClient ? "Editar" : "Alta"}</span>
                <h3>{editingClient ? "Editar cliente" : "Nuevo cliente"}</h3>
              </div>

              <button
                type="button"
                disabled={savingClient}
                onClick={() => setClientModal(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="clients-form">
              <label className="wide">
                <span>Nombre / Razón social *</span>
                <input
                  value={clientForm.nombre}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Apellido</span>
                <input
                  value={clientForm.apellido}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      apellido: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>DNI</span>
                <input
                  value={clientForm.dni}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      dni: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>CUIT</span>
                <input
                  value={clientForm.cuit}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      cuit: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Teléfono</span>
                <input
                  value={clientForm.tel}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      tel: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="wide">
                <span>Correo</span>
                <input
                  type="email"
                  value={clientForm.email}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                />
              </label>

              <label className="wide">
                <span>Dirección</span>
                <input
                  value={clientForm.direccion}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      direccion: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Provincia</span>
                <input
                  value={clientForm.provincia}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      provincia: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Localidad</span>
                <input
                  value={clientForm.localidad}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      localidad: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Barrio / Zona</span>
                <input
                  value={clientForm.barrio}
                  onChange={(event) =>
                    setClientForm((current) => ({
                      ...current,
                      barrio: event.target.value,
                    }))
                  }
                />
              </label>

              {!editingClient && canCredits && (
                <label>
                  <span>Límite de crédito</span>
                  <input
                    type="number"
                    min="0"
                    value={clientForm.limiteCredito}
                    onChange={(event) =>
                      setClientForm((current) => ({
                        ...current,
                        limiteCredito: event.target.value,
                      }))
                    }
                  />
                </label>
              )}
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingClient}
                onClick={() => setClientModal(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingClient}
                onClick={handleSaveClient}
              >
                {savingClient ? "Guardando..." : "Guardar cliente"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {auditAction && canAudit && selectedClient && (
        <div
          className="clients-modal-overlay audit"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeAuditAction();
            }
          }}
        >
          <motion.div
            className={`clients-audit-modal ${auditAction.type === "credit" ? "credit" : auditAction.type === "credit-reverse" ? "reverse" : "danger"}`}
            initial={{ opacity: 0, scale: 0.96, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.98, y: 8 }}
          >
            <header>
              <div className="clients-audit-modal-icon">
                {auditAction.type === "credit" ? (
                  <CircleDollarSign size={24} />
                ) : auditAction.type === "credit-reverse" ? (
                  <RotateCcw size={24} />
                ) : (
                  <ShieldAlert size={24} />
                )}
              </div>
              <div>
                <span>Auditoría interna</span>
                <h3>
                  {auditAction.type === "credit"
                    ? "Acreditar saldo con Nota de Crédito"
                    : auditAction.type === "credit-reverse"
                      ? "Revertir acreditación"
                    : auditAction.type === "ticket-delete"
                      ? "Eliminar ticket permanentemente"
                      : "Eliminar cliente permanentemente"}
                </h3>
              </div>
              <button
                type="button"
                className="clients-audit-modal-close"
                disabled={savingAudit}
                onClick={closeAuditAction}
              >
                <X size={18} />
              </button>
            </header>

            <div className="clients-audit-modal-body">
              {auditAction.type === "credit" ? (
                <>
                  <div className="clients-audit-balance-preview">
                    <span>Saldo actual</span>
                    <strong>{formatMoney(selectedClient.saldoAFavor)}</strong>
                  </div>

                  <label>
                    <span>Monto a acreditar *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={auditAmount}
                      onChange={(event) => setAuditAmount(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <div className="clients-audit-info-box">
                    <FileText size={18} />
                    <span>
                      Se generará una Nota de Crédito interna y el importe se
                      acreditará automáticamente en la cuenta corriente del cliente.
                    </span>
                  </div>
                </>
              ) : auditAction.type === "credit-reverse" ? (
                <>
                  <div className="clients-audit-balance-preview reverse">
                    <span>Saldo actual</span>
                    <strong>{formatMoney(selectedClient.saldoAFavor)}</strong>
                  </div>

                  <label>
                    <span>Acreditación original *</span>
                    <select
                      value={auditAction.payload?.notaCreditoId || ""}
                      onChange={(event) => {
                        const selectedValue = event.target.value;
                        const nextSource = selectedValue === "__legacy__"
                          ? {
                              legacy: true,
                              notaCreditoId: "__legacy__",
                              remainingAmount: Number(selectedClient.saldoAFavor || 0),
                            }
                          : reversibleAuditCredits.find(
                              (item) => item.notaCreditoId === selectedValue
                            );
                        setAuditAction({ type: "credit-reverse", payload: nextSource || null });
                        const maxAmount = nextSource?.legacy
                          ? Number(selectedClient.saldoAFavor || 0)
                          : Math.min(
                              Number(nextSource?.remainingAmount || 0),
                              Number(selectedClient.saldoAFavor || 0)
                            );
                        setAuditAmount(maxAmount > 0 ? String(maxAmount) : "");
                      }}
                    >
                      {reversibleAuditCredits.map((item) => (
                        <option key={item.id} value={item.notaCreditoId}>
                          {item.notaCreditoId} · acreditado {formatMoney(item.originalAmount)} · disponible {formatMoney(Math.min(item.remainingAmount, Number(selectedClient.saldoAFavor || 0)))}
                        </option>
                      ))}
                      <option value="__legacy__">
                        Saldo existente anterior / sin NC de Auditoría · disponible {formatMoney(selectedClient.saldoAFavor)}
                      </option>
                    </select>
                  </label>

                  <label>
                    <span>Monto a revertir *</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      max={auditAction.payload?.legacy
                        ? Number(selectedClient.saldoAFavor || 0)
                        : Math.min(
                            Number(auditAction.payload?.remainingAmount || 0),
                            Number(selectedClient.saldoAFavor || 0)
                          )}
                      value={auditAmount}
                      onChange={(event) => setAuditAmount(event.target.value)}
                      placeholder="0"
                    />
                  </label>

                  <div className="clients-audit-info-box reverse">
                    <RotateCcw size={18} />
                    <span>
                      {auditAction.payload?.legacy
                        ? "SERVIX descontará saldo existente anterior, generará una Nota de Débito interna y dejará registrado que la reversión no tenía una NC de Auditoría asociada."
                        : "No se borra la acreditación original. SERVIX generará una Nota de Débito interna, descontará el saldo y registrará la reversión en cuenta corriente y Auditoría."}
                    </span>
                  </div>
                </>
              ) : (
                <div className="clients-audit-delete-preview">
                  <AlertTriangle size={20} />
                  <div>
                    <strong>
                      {auditAction.type === "ticket-delete"
                        ? auditAction.payload?.numero || auditAction.payload?.codigo || auditAction.payload?.id
                        : getClientDisplayName(selectedClient)}
                    </strong>
                    <span>
                      Esta acción es permanente. El evento y los datos de respaldo
                      quedarán conservados en Auditoría interna.
                    </span>
                  </div>
                </div>
              )}

              <label>
                <span>Motivo administrativo *</span>
                <textarea
                  rows="3"
                  value={auditReason}
                  onChange={(event) => setAuditReason(event.target.value)}
                  placeholder="Ej.: cliente duplicado, ticket creado por error, compensación comercial..."
                />
              </label>

              {!["credit", "credit-reverse"].includes(auditAction.type) && (
                <label>
                  <span>Escribí ELIMINAR para confirmar *</span>
                  <input
                    value={auditConfirmText}
                    onChange={(event) => setAuditConfirmText(event.target.value)}
                    placeholder="ELIMINAR"
                    autoComplete="off"
                  />
                </label>
              )}
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingAudit}
                onClick={closeAuditAction}
              >
                Cancelar
              </button>
              <button
                type="button"
                className={auditAction.type === "credit" ? "audit-credit" : auditAction.type === "credit-reverse" ? "audit-reverse" : "audit-danger"}
                disabled={savingAudit}
                onClick={handleAuditAction}
              >
                {savingAudit
                  ? "Procesando..."
                  : auditAction.type === "credit"
                    ? "Generar crédito + NC"
                    : auditAction.type === "credit-reverse"
                      ? "Revertir saldo + NDA"
                    : auditAction.type === "ticket-delete"
                      ? "Eliminar ticket"
                      : "Eliminar cliente"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {creditModal &&
        canCredits &&
        selectedClient &&
        selectedClient.archivado !== true && (
        <div
          className="clients-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingCredit) {
              setCreditModal(false);
            }
          }}
        >
          <motion.div
            className="clients-modal credit"
            initial={{ opacity: 0, scale: 0.98, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <header>
              <div>
                <span>Financiación</span>
                <h3>
                  {creditMode === "refinance"
                    ? "Refinanciar deuda"
                    : "Nueva carpeta de crédito"}
                </h3>
                <p>{getClientDisplayName(selectedClient)}</p>
              </div>

              <button
                type="button"
                disabled={savingCredit}
                onClick={() => setCreditModal(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="clients-form">
              {creditMode === "new" && (
                <>
                  <label className="wide">
                    <span>Concepto</span>
                    <input
                      value={creditForm.concept}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          concept: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Capital</span>
                    <input
                      type="number"
                      min="0"
                      value={creditForm.capital}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          capital: event.target.value,
                        }))
                      }
                    />
                  </label>

                  <label>
                    <span>Anticipo en efectivo</span>
                    <input
                      type="number"
                      min="0"
                      value={creditForm.advance}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          advance: event.target.value,
                        }))
                      }
                    />
                  </label>
                </>
              )}

              {creditMode === "refinance" && (
                <div className="clients-refinance-summary wide">
                  <span>Deuda a refinanciar</span>
                  <strong>{formatMoney(selectedActivity?.debt)}</strong>
                </div>
              )}

              <label>
                <span>Interés global (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={creditForm.interest}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      interest: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Cuotas</span>
                <select
                  value={creditForm.installments}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      installments: event.target.value,
                    }))
                  }
                >
                  {[1, 2, 3, 4, 5, 6, 9, 12, 18, 24].map((value) => (
                    <option key={value} value={value}>
                      {value} {value === 1 ? "cuota" : "cuotas"}
                    </option>
                  ))}
                </select>
              </label>

              <label className="wide">
                <span>Primer vencimiento</span>
                <input
                  type="date"
                  value={creditForm.firstDueDate}
                  onChange={(event) =>
                    setCreditForm((current) => ({
                      ...current,
                      firstDueDate: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingCredit}
                onClick={() => setCreditModal(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingCredit}
                onClick={handleSaveCredit}
              >
                {savingCredit
                  ? "Procesando..."
                  : creditMode === "refinance"
                    ? "Confirmar refinanciación"
                    : "Crear crédito"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </main>
  );
}
