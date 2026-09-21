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
  AlertTriangle,
  Archive,
  ArchiveRestore,
  ArrowDownRight,
  ArrowLeft,
  ArrowUpRight,
  BadgeDollarSign,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  FileClock,
  FileText,
  Filter,
  History,
  Mail,
  MapPin,
  MonitorSmartphone,
  MoreVertical,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  ReceiptText,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  ShoppingBag,
  Tag,
  Ticket,
  Trash2,
  UserRound,
  UsersRound,
  WalletCards,
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
  pendiente_ingreso: "Pendiente de ingreso",
  pendiente: "Recepción",
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

function safeDate(value) {
  if (!value) return null;

  const raw = String(value);
  const date = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function clientKind(client) {
  const explicit = String(
    client?.tipoCliente || client?.tipo || client?.categoria || ""
  ).toLowerCase();

  if (explicit.includes("empresa") || explicit.includes("juríd") || explicit.includes("jurid")) {
    return "Empresa";
  }

  if (explicit.includes("particular") || explicit.includes("persona")) {
    return "Particular";
  }

  const displayName = String(
    client?.razonSocial || client?.nombre || ""
  ).toLowerCase();

  if (
    client?.esEmpresa === true ||
    client?.razonSocial ||
    (client?.cuit && !client?.dni) ||
    /\b(s\.?a\.?s?|s\.?r\.?l\.?|empresa|sociedad)\b/i.test(displayName)
  ) {
    return "Empresa";
  }

  return "Particular";
}

function clientCode(client, clients = []) {
  const explicit = client?.codigoCliente || client?.codigo || client?.numeroCliente;
  if (explicit) return String(explicit);

  const index = clients.findIndex((item) => item.id === client?.id);
  const number = index >= 0 ? index + 1 : 1;
  return `CL-${String(number).padStart(3, "0")}`;
}

function latestByDate(records = []) {
  return [...records].sort((a, b) => {
    const dateA = safeDate(recordDate(a))?.getTime() || 0;
    const dateB = safeDate(recordDate(b))?.getTime() || 0;
    return dateB - dateA;
  })[0] || null;
}

function daysAgoLabel(value) {
  const date = safeDate(value);
  if (!date) return "Sin fecha";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diff = Math.max(0, Math.round((today - target) / 86400000));

  if (diff === 0) return "Hoy";
  if (diff === 1) return "Hace 1 día";
  return `Hace ${diff} días`;
}

function directoryStatus(client, activity) {
  if (client?.archivado === true) {
    return { key: "archived", label: "Archivado" };
  }

  const limit = Number(client?.limiteCredito || 0);
  const debt = Number(activity?.debt || 0);

  if (limit > 0 && debt > limit) {
    return { key: "critical", label: "Límite excedido" };
  }

  if (debt > 0) {
    return { key: "debt", label: "Con deuda" };
  }

  if ((activity?.activeCredits || []).length > 0) {
    return { key: "credit", label: "Crédito activo" };
  }

  if (!(activity?.tickets || []).length && !(activity?.sales || []).length) {
    return { key: "new", label: "Nuevo" };
  }

  return { key: "ok", label: "Al día" };
}

function invoiceStatus(invoice) {
  const raw = String(invoice?.estadoPago || invoice?.estado || "").toLowerCase();
  if (raw.includes("venc") || raw.includes("pend")) return { key: "overdue", label: invoice?.estadoPago || invoice?.estado || "Pendiente" };
  if (raw.includes("pag") || raw.includes("cob")) return { key: "paid", label: invoice?.estadoPago || invoice?.estado || "Pagada" };
  return { key: "issued", label: invoice?.estadoPago || invoice?.estado || "Emitida" };
}

function buildBillingSeries(invoices = []) {
  const now = new Date();
  const months = [];

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    months.push({
      year: date.getFullYear(),
      month: date.getMonth(),
      label: new Intl.DateTimeFormat("es-AR", { month: "short" })
        .format(date)
        .replace(".", "")
        .replace(/^./, (char) => char.toUpperCase()),
      total: 0,
    });
  }

  invoices.forEach((invoice) => {
    const date = safeDate(recordDate(invoice));
    if (!date) return;

    const bucket = months.find(
      (item) => item.year === date.getFullYear() && item.month === date.getMonth()
    );

    if (bucket) {
      bucket.total += Number(invoice?.total || invoice?.importe || invoice?.monto || 0);
    }
  });

  return months;
}

function csvValue(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
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
      "history",
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
  const [clientFilter, setClientFilter] = useState("all");
  const [zoneFilter, setZoneFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showNoteComposer, setShowNoteComposer] = useState(false);
  const [editingLimit, setEditingLimit] = useState(false);

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

  const zones = useMemo(() => {
    return Array.from(
      new Set(
        clients
          .map((client) => client.localidad || client.provincia || "")
          .filter(Boolean)
      )
    ).sort((a, b) => String(a).localeCompare(String(b), "es"));
  }, [clients]);

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return clients.filter((client) => {
      const activity = getClientActivity(client, index);
      const kind = clientKind(client);
      const status = directoryStatus(client, activity);
      const zone = client.localidad || client.provincia || "";

      const matchesQuickFilter =
        clientFilter === "all" ||
        (clientFilter === "active" && client.archivado !== true) ||
        (clientFilter === "archived" && client.archivado === true) ||
        (clientFilter === "debt" && Number(activity.debt || 0) > 0) ||
        (clientFilter === "credit" && (activity.activeCredits || []).length > 0) ||
        (clientFilter === "company" && kind === "Empresa") ||
        (clientFilter === "individual" && kind === "Particular");

      const matchesZone = zoneFilter === "all" || zone === zoneFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "ok" && status.key === "ok") ||
        (statusFilter === "debt" && ["debt", "critical"].includes(status.key)) ||
        (statusFilter === "credit" && (activity.activeCredits || []).length > 0) ||
        (statusFilter === "archived" && status.key === "archived");
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "company" && kind === "Empresa") ||
        (typeFilter === "individual" && kind === "Particular");

      if (!matchesQuickFilter || !matchesZone || !matchesStatus || !matchesType) {
        return false;
      }

      if (!query) return true;

      return [
        getClientDisplayName(client),
        getClientDocument(client),
        client.tel,
        client.email,
        client.localidad,
        client.provincia,
        kind,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [
    clients,
    index,
    search,
    clientFilter,
    zoneFilter,
    statusFilter,
    typeFilter,
  ]);

  const metrics = useMemo(() => {
    let debt = 0;
    let purchases = 0;
    let debtClients = 0;
    let creditActive = 0;
    let companies = 0;
    let particulars = 0;

    clients.forEach((client) => {
      const activity = getClientActivity(client, index);
      debt += activity.debt;
      purchases += activity.purchases;

      if (Number(activity.debt || 0) > 0) debtClients += 1;
      if ((activity.activeCredits || []).length > 0) creditActive += 1;

      if (clientKind(client) === "Empresa") companies += 1;
      else particulars += 1;
    });

    const active = clients.filter((client) => client.archivado !== true).length;
    const archived = clients.length - active;

    return {
      total: clients.length,
      active,
      archived,
      debt,
      purchases,
      debtClients,
      creditActive,
      companies,
      particulars,
      creditBalance: clients.reduce(
        (sum, client) => sum + Number(client.saldoAFavor || 0),
        0
      ),
    };
  }, [clients, index]);

  const selectedLatestTicket = useMemo(
    () => latestByDate(selectedActivity?.tickets || []),
    [selectedActivity]
  );

  const selectedRecentTickets = useMemo(() => {
    return [...(selectedActivity?.tickets || [])]
      .sort((a, b) => {
        const dateA = safeDate(recordDate(a))?.getTime() || 0;
        const dateB = safeDate(recordDate(b))?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 4);
  }, [selectedActivity]);

  const selectedBillingSeries = useMemo(
    () => buildBillingSeries(selectedActivity?.invoices || []),
    [selectedActivity]
  );

  const selectedBillingMax = useMemo(
    () => Math.max(1, ...selectedBillingSeries.map((item) => item.total)),
    [selectedBillingSeries]
  );

  const selectedDocuments = useMemo(() => {
    return [...(selectedActivity?.invoices || [])]
      .sort((a, b) => {
        const dateA = safeDate(recordDate(a))?.getTime() || 0;
        const dateB = safeDate(recordDate(b))?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 4);
  }, [selectedActivity]);

  const selectedMovements = useMemo(() => {
    return [...(selectedActivity?.account || [])]
      .sort((a, b) => {
        const dateA = safeDate(recordDate(a))?.getTime() || 0;
        const dateB = safeDate(recordDate(b))?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 4);
  }, [selectedActivity]);

  const historyRows = useMemo(() => {
    if (!selectedActivity) return [];

    const rows = [
      ...(selectedActivity.tickets || []).map((item) => ({
        key: `ticket-${item.id}`,
        type: "ticket",
        title: `Ticket #${item.id}`,
        description: item.equipo || item.falla || "Servicio técnico",
        date: recordDate(item),
        payload: item,
      })),
      ...(selectedActivity.sales || []).map((item) => ({
        key: `sale-${item.id}`,
        type: "sale",
        title: item.folio || `Venta ${item.id}`,
        description: item.articulos || item.concepto || "Venta registrada",
        date: recordDate(item),
        amount: item.total,
        payload: item,
      })),
      ...(selectedActivity.invoices || []).map((item) => ({
        key: `invoice-${item.id}`,
        type: "invoice",
        title: item.numero || item.folio || `Factura ${item.id}`,
        description: item.concepto || "Factura emitida",
        date: recordDate(item),
        amount: item.total,
        payload: item,
      })),
      ...(selectedActivity.credits || []).map((item) => ({
        key: `credit-${item.id}`,
        type: "credit",
        title: item.id,
        description: item.concepto || "Crédito",
        date: item.fechaOrigen || recordDate(item),
        amount: item.saldo,
        payload: item,
      })),
      ...(selectedActivity.budgets || []).map((item) => ({
        key: `budget-${item.id}`,
        type: "budget",
        title: item.numero || item.folio || `Presupuesto ${item.id}`,
        description: item.titulo || item.concepto || "Presupuesto",
        date: recordDate(item),
        amount: item.total,
        payload: item,
      })),
    ];

    return rows
      .sort((a, b) => {
        const dateA = safeDate(a.date)?.getTime() || 0;
        const dateB = safeDate(b.date)?.getTime() || 0;
        return dateB - dateA;
      })
      .slice(0, 30);
  }, [selectedActivity]);

  const selectedLimit = Number(selectedClient?.limiteCredito || 0);
  const selectedDebt = Number(selectedActivity?.debt || 0);
  const selectedAvailable = Math.max(0, selectedLimit - selectedDebt);
  const selectedCreditUsage = selectedLimit > 0
    ? Math.min(100, Math.round((selectedDebt / selectedLimit) * 100))
    : 0;
  const selectedKind = selectedClient ? clientKind(selectedClient) : "";
  const selectedClientCode = selectedClient ? clientCode(selectedClient, clients) : "";
  const selectedLatestNote = selectedClient
    ? [...(selectedClient.notas || [])].reverse()[0] || null
    : null;
  const currentBilling = Number(selectedBillingSeries.at(-1)?.total || 0);
  const previousBilling = Number(selectedBillingSeries.at(-2)?.total || 0);
  const billingDelta = previousBilling > 0
    ? Math.round(((currentBilling - previousBilling) / previousBilling) * 100)
    : currentBilling > 0
      ? 100
      : 0;

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

  const openEditClient = (client = selectedClient) => {
    if (!client) return;

    if (client.id !== selectedClientId) {
      setClientContext(client.id, "summary");
    }

    setEditingClient(true);
    setClientForm({
      nombre: client.nombre || client.razonSocial || "",
      apellido: client.apellido || "",
      dni: client.dni || "",
      cuit: client.cuit || "",
      direccion: client.direccion === "—" ? "" : client.direccion || "",
      provincia: client.provincia || "",
      localidad: client.localidad || "",
      barrio: client.barrio || "",
      tel: client.tel === "—" ? "" : client.tel || "",
      email: client.email === "—" ? "" : client.email || "",
      limiteCredito: client.limiteCredito || 0,
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

  const handleExportClients = () => {
    const headers = [
      "Código",
      "Cliente",
      "Documento",
      "Tipo",
      "Teléfono",
      "Email",
      "Zona",
      "Estado",
      "Deuda",
      "Límite de crédito",
      "Tickets",
      "Último servicio",
    ];

    const csvRows = rows.map((client) => {
      const activity = getClientActivity(client, index);
      const latest = latestByDate(activity.tickets);
      const status = directoryStatus(client, activity);

      return [
        clientCode(client, clients),
        getClientDisplayName(client),
        getClientDocument(client),
        clientKind(client),
        client.tel || "",
        client.email || "",
        client.localidad || client.provincia || "",
        status.label,
        Number(activity.debt || 0),
        Number(client.limiteCredito || 0),
        activity.tickets.length,
        latest ? formatDate(recordDate(latest)) : "",
      ];
    });

    const csv = [headers, ...csvRows]
      .map((row) => row.map(csvValue).join(","))
      .join("\n");

    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `clientes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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
    <main className="clients-page clients-reference-ui">
      <div className="clients-shell">
        <AnimatePresence mode="wait">
          {!selectedClient ? (
            <motion.section
              key="directory"
              className="clients-directory-view clients-reference-directory"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22 }}
            >
              <section className="clients-directory-visual-hero">
                <button
                  type="button"
                  className="clients-reference-back clients-reference-back-dashboard"
                  onClick={() => navigate("/dashboard")}
                  title="Volver al Dashboard"
                >
                  <ArrowLeft size={16} />
                </button>

                <div className="clients-directory-heading">
                  <div className="clients-directory-heading-icon" aria-hidden="true" />
                  <div>
                    <h1>Clientes</h1>
                    <p>Gestiona tus clientes, historial, deuda y servicios.</p>
                  </div>
                </div>
                <div className="clients-directory-hero-art" aria-hidden="true" />
              </section>

              <section className="clients-kpi-grid" aria-label="Resumen de clientes">
                <article className="clients-kpi-card blue">
                  <div className="clients-kpi-icon"><UsersRound size={27} /></div>
                  <div>
                    <span>Total de Clientes</span>
                    <strong>{metrics.total}</strong>
                    <small className="positive"><ArrowUpRight size={13} />Base registrada</small>
                  </div>
                </article>

                <article className="clients-kpi-card green">
                  <div className="clients-kpi-icon"><CheckCircle2 size={27} /></div>
                  <div>
                    <span>Clientes Activos</span>
                    <strong>{metrics.active}</strong>
                    <small><i className="dot green" />{metrics.total ? Math.round((metrics.active / metrics.total) * 100) : 0}% del total</small>
                  </div>
                </article>

                <article className="clients-kpi-card orange">
                  <div className="clients-kpi-icon"><AlertTriangle size={27} /></div>
                  <div>
                    <span>Con Deuda</span>
                    <strong>{metrics.debtClients}</strong>
                    <small><i className="dot orange" />{metrics.total ? Math.round((metrics.debtClients / metrics.total) * 100) : 0}% del total</small>
                  </div>
                </article>

                <article className="clients-kpi-card purple">
                  <div className="clients-kpi-icon"><CreditCard size={27} /></div>
                  <div>
                    <span>Crédito Activo</span>
                    <strong>{metrics.creditActive}</strong>
                    <small><i className="dot purple" />{metrics.total ? Math.round((metrics.creditActive / metrics.total) * 100) : 0}% del total</small>
                  </div>
                </article>

                <article className="clients-kpi-card cyan">
                  <div className="clients-kpi-icon"><Building2 size={27} /></div>
                  <div>
                    <span>Empresas</span>
                    <strong>{metrics.companies}</strong>
                    <small><i className="dot blue" />{metrics.total ? Math.round((metrics.companies / metrics.total) * 100) : 0}% del total</small>
                  </div>
                </article>

                <article className="clients-kpi-card pink">
                  <div className="clients-kpi-icon"><UserRound size={27} /></div>
                  <div>
                    <span>Particulares</span>
                    <strong>{metrics.particulars}</strong>
                    <small><i className="dot pink" />{metrics.total ? Math.round((metrics.particulars / metrics.total) * 100) : 0}% del total</small>
                  </div>
                </article>
              </section>

              <section className="clients-directory-controls">
                <div className="clients-reference-filter-row">
                  <label className="clients-reference-search">
                    <Search size={18} />
                    <input
                      value={search}
                      placeholder="Buscar por nombre, documento, teléfono o email..."
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <label className="clients-reference-select">
                    <MapPin size={17} />
                    <select value={zoneFilter} onChange={(event) => setZoneFilter(event.target.value)}>
                      <option value="all">Todas las zonas</option>
                      {zones.map((zone) => <option key={zone} value={zone}>{zone}</option>)}
                    </select>
                    <ChevronDown size={15} />
                  </label>

                  <label className="clients-reference-select">
                    <Tag size={17} />
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                      <option value="all">Todos los estados</option>
                      <option value="ok">Al día</option>
                      <option value="debt">Con deuda</option>
                      <option value="credit">Crédito activo</option>
                      <option value="archived">Archivados</option>
                    </select>
                    <ChevronDown size={15} />
                  </label>

                  <label className="clients-reference-select type">
                    <UsersRound size={17} />
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
                      <option value="all">Todos los tipos</option>
                      <option value="company">Empresas</option>
                      <option value="individual">Particulares</option>
                    </select>
                    <ChevronDown size={15} />
                  </label>

                  <button
                    type="button"
                    className={`clients-more-filters${showAdvancedFilters ? " active" : ""}`}
                    onClick={() => setShowAdvancedFilters((current) => !current)}
                  >
                    <Filter size={17} />
                    Más filtros
                  </button>
                </div>

                {showAdvancedFilters && (
                  <div className="clients-advanced-filter-panel">
                    <button type="button" className={clientFilter === "archived" ? "active" : ""} onClick={() => setClientFilter(clientFilter === "archived" ? "all" : "archived")}>
                      <Archive size={15} /> Archivados
                    </button>
                    <button type="button" onClick={() => { setSearch(""); setZoneFilter("all"); setStatusFilter("all"); setTypeFilter("all"); setClientFilter("all"); }}>
                      <RotateCcw size={15} /> Limpiar filtros
                    </button>
                  </div>
                )}

                <div className="clients-reference-action-row">
                  <div className="clients-reference-quick-filters">
                    <button type="button" className={clientFilter === "all" ? "active all" : ""} onClick={() => setClientFilter("all")}>
                      <UsersRound size={17} /> Todos <span>{metrics.total}</span>
                    </button>
                    <button type="button" className={clientFilter === "debt" ? "active" : ""} onClick={() => setClientFilter("debt")}>
                      <AlertTriangle size={17} /> Con deuda <span>{metrics.debtClients}</span>
                    </button>
                    <button type="button" className={clientFilter === "active" ? "active" : ""} onClick={() => setClientFilter("active")}>
                      <UserRound size={17} /> Activos <span>{metrics.active}</span>
                    </button>
                    <button type="button" className={clientFilter === "credit" ? "active" : ""} onClick={() => setClientFilter("credit")}>
                      <CreditCard size={17} /> Crédito activo <span>{metrics.creditActive}</span>
                    </button>
                    <button type="button" className={clientFilter === "company" ? "active" : ""} onClick={() => setClientFilter("company")}>
                      <Building2 size={17} /> Empresas <span>{metrics.companies}</span>
                    </button>
                    <button type="button" className={clientFilter === "individual" ? "active" : ""} onClick={() => setClientFilter("individual")}>
                      <UserRound size={17} /> Particulares <span>{metrics.particulars}</span>
                    </button>
                  </div>

                  <div className="clients-reference-main-actions">
                    <button type="button" className="secondary" onClick={handleExportClients}>
                      <Download size={17} /> Exportar
                    </button>
                    {canSales && (
                      <button type="button" className="payment" onClick={() => navigate("/caja")}>
                        <WalletCards size={17} /> Registrar pago
                      </button>
                    )}
                    <button type="button" className="new" onClick={openNewClient}>
                      <Plus size={19} /> Nuevo cliente
                    </button>
                  </div>
                </div>
              </section>

              <section className="clients-reference-table-card">
                <div className="clients-reference-table-head">
                  <span>#</span>
                  <span>Cliente</span>
                  <span>Tipo</span>
                  <span>Estado</span>
                  <span>Deuda Actual</span>
                  <span>Límite de Crédito</span>
                  <span>Tickets</span>
                  <span>Último servicio</span>
                  <span>Acciones</span>
                </div>

                <div className="clients-reference-table-body">
                  <AnimatePresence initial={false}>
                    {rows.map((client, rowIndex) => {
                      const activity = getClientActivity(client, index);
                      const name = getClientDisplayName(client);
                      const kind = clientKind(client);
                      const status = directoryStatus(client, activity);
                      const latest = latestByDate(activity.tickets);

                      return (
                        <motion.article
                          layout
                          key={client.id}
                          className="clients-reference-table-row"
                          role="button"
                          tabIndex={0}
                          onClick={() => openClient(client)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              openClient(client);
                            }
                          }}
                          initial={{ opacity: 0, y: 7 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          transition={{ duration: 0.18, delay: Math.min(rowIndex * 0.02, 0.16) }}
                        >
                          <span className="clients-code">{clientCode(client, clients)}</span>

                          <div className="clients-table-person">
                            <div className={`clients-table-avatar avatar-${rowIndex % 6}`}>{initials(name)}</div>
                            <div>
                              <strong>{name}</strong>
                              <span>{client.tel || "Sin teléfono"}{client.email && client.email !== "—" ? `  |  ${client.email}` : ""}</span>
                            </div>
                          </div>

                          <span className={`clients-type-pill ${kind === "Empresa" ? "company" : "individual"}`}>
                            {kind === "Empresa" ? <Building2 size={14} /> : <UserRound size={14} />}
                            {kind}
                          </span>

                          <span className={`clients-status-pill ${status.key}`}>
                            <i /> {status.label}
                          </span>

                          <strong className={`clients-table-money ${Number(activity.debt || 0) > 0 ? "negative" : ""}`}>
                            {formatMoney(activity.debt)}
                          </strong>

                          <span className="clients-table-limit">{formatMoney(client.limiteCredito)}</span>

                          <span className="clients-ticket-count"><Ticket size={14} /> {activity.tickets.length}</span>

                          <div className="clients-table-last-service">
                            <strong>{latest ? formatDate(recordDate(latest)) : "—"}</strong>
                            <span>{latest ? (latest.equipo || latest.falla || STAGES[latest.stage] || "Servicio técnico") : "Sin servicios"}</span>
                          </div>

                          <div className="clients-table-actions" onClick={(event) => event.stopPropagation()}>
                            <button type="button" className="detail" onClick={() => openClient(client)}>Ver detalle</button>
                            <button type="button" title="Ver cliente" onClick={() => openClient(client)}><Eye size={16} /></button>
                            <button type="button" title="Editar" onClick={() => openEditClient(client)}><Pencil size={15} /></button>
                            <button type="button" title="Más opciones" onClick={() => openClient(client)}><MoreVertical size={16} /></button>
                          </div>
                        </motion.article>
                      );
                    })}
                  </AnimatePresence>

                  {!rows.length && (
                    <div className="clients-empty clients-reference-empty">
                      <UsersRound size={29} />
                      <strong>Sin resultados</strong>
                      <span>No encontramos clientes con los filtros seleccionados.</span>
                    </div>
                  )}
                </div>
              </section>
            </motion.section>
          ) : (
            <motion.section
              key={`profile-${selectedClient.id}`}
              className="clients-profile-view clients-reference-profile"
              initial={{ opacity: 0, x: 18 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.24 }}
            >
              <section className="clients-reference-profile-hero">
                <button type="button" className="clients-reference-back" onClick={() => setClientContext(null)}>
                  <ArrowLeft size={16} /> Volver a Clientes
                </button>

                <div className="clients-reference-profile-identity">
                  <div className="clients-reference-profile-avatar">
                    {initials(getClientDisplayName(selectedClient))}
                    <i />
                  </div>
                  <div className="clients-reference-profile-name">
                    <h1>{getClientDisplayName(selectedClient)}</h1>
                    <div>
                      <span>Cliente {selectedKind}</span>
                      <em>{selectedClientCode}</em>
                    </div>
                  </div>

                  <div className={`clients-reference-debt-badge ${selectedDebt > 0 ? "debt" : "ok"}`}>
                    {selectedDebt > 0 ? <AlertTriangle size={24} /> : <CheckCircle2 size={24} />}
                    <div>
                      <strong>{selectedDebt > 0 ? "Con deuda" : "Al día"}</strong>
                      <span>{selectedDebt > 0 ? "Tiene pagos pendientes" : "Sin pagos pendientes"}</span>
                    </div>
                  </div>
                </div>

                <div className="clients-profile-hero-art" aria-hidden="true" />
              </section>

              {selectedClient.archivado === true && (
                <div className="clients-archived-notice">
                  <Archive size={17} />
                  <div>
                    <strong>Cliente archivado</strong>
                    <span>El historial continúa disponible, pero las nuevas operaciones permanecen bloqueadas hasta restaurarlo.</span>
                  </div>
                </div>
              )}

              <nav className="clients-reference-tabs">
                <button type="button" className={activeTab === "summary" ? "active" : ""} onClick={() => setClientContext(selectedClient.id, "summary")}>
                  <UserRound size={17} /> Resumen
                </button>
                <button type="button" className={activeTab === "history" ? "active" : ""} onClick={() => setClientContext(selectedClient.id, "history")}>
                  <Clock3 size={17} /> Historial
                </button>
                {canTickets && (
                  <button type="button" className={activeTab === "tickets" ? "active" : ""} onClick={() => setClientContext(selectedClient.id, "tickets")}>
                    <Ticket size={17} /> Tickets
                  </button>
                )}
                {(canSales || canInvoices) && (
                  <button type="button" className={activeTab === "sales" ? "active" : ""} onClick={() => setClientContext(selectedClient.id, "sales")}>
                    <ReceiptText size={17} /> Facturación
                  </button>
                )}
                {canAccount && (
                  <button type="button" className={activeTab === "account" ? "active" : ""} onClick={() => setClientContext(selectedClient.id, "account")}>
                    <WalletCards size={17} /> Cuenta Corriente
                  </button>
                )}
              </nav>

              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  className="clients-module-content clients-reference-module-content"
                  initial={{ opacity: 0, y: 9 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                >
                  {activeTab === "summary" && (
                    <div className="clients-reference-summary">
                      <section className="clients-profile-kpi-grid">
                        <article className="pink">
                          <div className="clients-profile-kpi-icon"><CircleDollarSign size={27} /></div>
                          <div>
                            <span>Deuda Actual</span>
                            <strong>{formatMoney(selectedDebt)}</strong>
                            <small className={selectedDebt > 0 ? "negative" : "positive"}>
                              {selectedDebt > 0 ? <ArrowUpRight size={13} /> : <CheckCircle2 size={13} />}
                              {selectedDebt > 0 ? `${selectedActivity?.activeCredits.length || 0} créditos con saldo` : "Sin deuda pendiente"}
                            </small>
                          </div>
                        </article>

                        <article className="blue">
                          <div className="clients-profile-kpi-icon"><WalletCards size={27} /></div>
                          <div>
                            <span>Límite de Crédito</span>
                            <strong>{formatMoney(selectedLimit)}</strong>
                            <small>Disponible {formatMoney(selectedAvailable)}</small>
                          </div>
                        </article>

                        <article className="purple">
                          <div className="clients-profile-kpi-icon"><FileText size={27} /></div>
                          <div>
                            <span>Tickets Totales</span>
                            <strong>{selectedActivity?.tickets.length || 0}</strong>
                            <small className="positive"><ArrowUpRight size={13} />Servicios vinculados</small>
                          </div>
                        </article>

                        <article className="green">
                          <div className="clients-profile-kpi-icon"><CalendarDays size={27} /></div>
                          <div>
                            <span>Último Servicio</span>
                            <strong>{selectedLatestTicket ? formatDate(recordDate(selectedLatestTicket)) : "—"}</strong>
                            <small><CalendarDays size={13} />{selectedLatestTicket ? daysAgoLabel(recordDate(selectedLatestTicket)) : "Sin servicios"}</small>
                          </div>
                        </article>
                      </section>

                      <section className="clients-reference-dashboard-grid">
                        <article className="clients-reference-card clients-contact-card">
                          <header>
                            <h3>Información de Contacto</h3>
                            <button type="button" onClick={() => openEditClient()}><Pencil size={14} /> Editar</button>
                          </header>
                          <div className="clients-contact-list">
                            <div><span className="orange"><Phone size={18} /></span><p><strong>{selectedClient.tel || "—"}</strong><small>Celular</small></p></div>
                            <div><span className="blue"><Mail size={18} /></span><p><strong>{selectedClient.email || "—"}</strong><small>Email</small></p></div>
                            <div><span className="orange"><MapPin size={18} /></span><p><strong>{[selectedClient.localidad, selectedClient.provincia].filter(Boolean).join(", ") || selectedClient.direccion || "—"}</strong><small>Zona</small></p></div>
                            <div><span className="green"><UserRound size={18} /></span><p><strong>{getClientDocument(selectedClient)}</strong><small>Documento</small></p></div>
                            <div><span className="purple"><CalendarDays size={18} /></span><p><strong>Cliente desde {formatDate(selectedClient.creadoEn)}</strong><small>Fecha de alta</small></p></div>
                            <div><span className="cyan"><Tag size={18} /></span><p><strong>{selectedKind}</strong><small>Tipo de cliente</small></p></div>
                          </div>
                        </article>

                        <div className="clients-reference-middle-stack">
                          <article className="clients-reference-card clients-credit-card">
                            <header>
                              <h3>Límite de Crédito</h3>
                              <button type="button" onClick={() => setEditingLimit((current) => !current)}>Configurar</button>
                            </header>
                            <div className="clients-credit-main"><strong>{formatMoney(selectedDebt)}</strong><span>de {formatMoney(selectedLimit)}</span><em>{selectedCreditUsage}%</em></div>
                            <div className="clients-credit-progress"><i style={{ width: `${selectedCreditUsage}%` }} /></div>
                            <div className="clients-credit-breakdown">
                              <span><i className="available" />Disponible <strong>{formatMoney(selectedAvailable)}</strong></span>
                              <span><i className="used" />Utilizado <strong>{formatMoney(selectedDebt)}</strong></span>
                            </div>
                            {editingLimit && (
                              <div className="clients-reference-limit-editor">
                                <input type="number" min="0" value={limitValue} disabled={selectedClient.archivado === true} onChange={(event) => setLimitValue(event.target.value)} />
                                <button type="button" disabled={savingLimit || selectedClient.archivado === true} onClick={async () => { await handleSaveLimit(); setEditingLimit(false); }}>
                                  {savingLimit ? "Guardando..." : "Guardar"}
                                </button>
                              </div>
                            )}
                          </article>

                          <article className="clients-reference-card clients-reference-notes-card">
                            <header>
                              <h3>Notas</h3>
                              <button type="button" onClick={() => setShowNoteComposer((current) => !current)}>{showNoteComposer ? "Cerrar" : "Agregar nota"}</button>
                            </header>
                            {showNoteComposer && (
                              <div className="clients-reference-note-composer">
                                <textarea rows="2" value={note} placeholder="Escribí una nota..." onChange={(event) => setNote(event.target.value)} />
                                <button type="button" disabled={savingNote || !note.trim()} onClick={async () => { await handleAddNote(); setShowNoteComposer(false); }}>{savingNote ? "Guardando..." : "Guardar"}</button>
                              </div>
                            )}
                            {!showNoteComposer && (
                              <div className="clients-reference-note-preview">
                                <span><NotebookPen size={19} /></span>
                                <p>
                                  <strong>{typeof selectedLatestNote === "string" ? selectedLatestNote : selectedLatestNote?.texto || selectedLatestNote?.detalle || "Sin notas registradas."}</strong>
                                  <small>{typeof selectedLatestNote === "object" && selectedLatestNote ? `${selectedLatestNote.fecha ? formatDate(selectedLatestNote.fecha) : ""}${selectedLatestNote.autor ? ` · ${selectedLatestNote.autor}` : ""}` : "Podés agregar una nota desde este panel."}</small>
                                </p>
                                <MoreVertical size={17} />
                              </div>
                            )}
                          </article>
                        </div>

                        <article className="clients-reference-card clients-latest-services-card">
                          <header>
                            <h3>Últimos Servicios</h3>
                            <button type="button" onClick={() => setClientContext(selectedClient.id, "tickets")}>Ver todos</button>
                          </header>
                          <div className="clients-latest-services-list">
                            {selectedRecentTickets.map((ticket, ticketIndex) => (
                              <button type="button" key={ticket.id} onClick={() => openTicketFromClient(ticket)}>
                                <span className={`service-icon service-${ticketIndex % 4}`}><MonitorSmartphone size={18} /></span>
                                <p><strong>#{ticket.id}</strong><small>{ticket.equipo || ticket.falla || "Servicio técnico"}<br />{formatDate(recordDate(ticket))}</small></p>
                                <em>{STAGES[ticket.stage] === "Entregado" || ticket.stage === "entregado" ? "Finalizado" : STAGES[ticket.stage] || "Activo"}</em>
                              </button>
                            ))}
                            {!selectedRecentTickets.length && <div className="clients-reference-inline-empty">Sin servicios registrados.</div>}
                          </div>
                        </article>

                        <article className="clients-reference-card clients-billing-chart-card">
                          <header>
                            <h3>Gráfico de Facturación</h3>
                            <span>Últimos 6 meses <ChevronDown size={14} /></span>
                          </header>
                          <div className="clients-reference-chart">
                            <div className="clients-chart-y-axis"><span>{formatMoney(selectedBillingMax)}</span><span>{formatMoney(selectedBillingMax * 0.66)}</span><span>{formatMoney(selectedBillingMax * 0.33)}</span><span>$ 0</span></div>
                            <div className="clients-chart-bars">
                              {selectedBillingSeries.map((item, chartIndex) => (
                                <div className="clients-chart-column" key={`${item.year}-${item.month}`}>
                                  <div className="bar-shell"><i className={`bar bar-${chartIndex}`} style={{ height: `${Math.max(8, Math.round((item.total / selectedBillingMax) * 100))}%` }} title={formatMoney(item.total)} /></div>
                                  <span>{item.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="clients-chart-insight">
                            <span><ArrowUpRight size={19} /></span>
                            <p><strong>{billingDelta >= 0 ? "+" : ""}{billingDelta}%</strong><small>vs. período anterior</small></p>
                            <em>Crecimiento en facturación del cliente</em>
                          </div>
                        </article>

                        <article className="clients-reference-card clients-financial-card">
                          <header>
                            <h3>Cuenta Corriente / Estado Financiero</h3>
                            <button type="button" onClick={() => setClientContext(selectedClient.id, "account")}>Ver cuenta completa</button>
                          </header>
                          <div className="clients-financial-content">
                            <div className="clients-financial-balance">
                              <span className="coin-icon"><CircleDollarSign size={30} /></span>
                              <div><small>Saldo Actual</small><strong>{formatMoney(selectedDebt)}</strong><em className={selectedDebt > 0 ? "debt" : "ok"}>{selectedDebt > 0 ? "Con deuda" : "Al día"}</em>
                                <p><i className="red" />{selectedActivity?.activeCredits.length || 0} créditos con saldo</p>
                                <p><i className="orange" />Saldo a favor {formatMoney(selectedClient.saldoAFavor)}</p>
                              </div>
                            </div>
                            <div className="clients-financial-movements">
                              <strong>Últimos movimientos</strong>
                              {selectedMovements.map((movement) => {
                                const isCredit = String(movement.tipo || "").toLowerCase().includes("crédito");
                                return <div key={movement.id}><span className={isCredit ? "up" : "down"}>{isCredit ? <ArrowUpRight size={15} /> : <ArrowDownRight size={15} />}</span><p><strong>{movement.concepto || movement.refId || "Movimiento"}</strong></p><b>{formatMoney(movement.importe)}</b><small>{formatDate(recordDate(movement))}</small></div>;
                              })}
                              {!selectedMovements.length && <div className="clients-reference-inline-empty">Sin movimientos registrados.</div>}
                            </div>
                          </div>
                        </article>

                        <article className="clients-reference-card clients-documents-card">
                          <header>
                            <h3>Documentos / Facturación</h3>
                            <button type="button" onClick={() => setClientContext(selectedClient.id, "sales")}>Ver todos</button>
                          </header>
                          <div className="clients-documents-list">
                            {selectedDocuments.map((invoice, invoiceIndex) => {
                              const status = invoiceStatus(invoice);
                              return (
                                <div key={invoice.id}>
                                  <span className={`document-icon doc-${invoiceIndex % 3}`}><FileText size={17} /></span>
                                  <strong>{invoice.numero || invoice.folio || invoice.id}</strong>
                                  <span>{invoice.tipoComprobante || "Factura"}</span>
                                  <b>{formatMoney(invoice.total)}</b>
                                  <small>{formatDate(recordDate(invoice))}</small>
                                  <em className={status.key}><i />{status.label}</em>
                                  <button type="button" onClick={() => openInvoiceFromClient(invoice)} title="Abrir documento"><Eye size={15} /></button>
                                  <button type="button" onClick={() => openInvoiceFromClient(invoice)} title="Más opciones"><MoreVertical size={15} /></button>
                                </div>
                              );
                            })}
                            {!selectedDocuments.length && <div className="clients-reference-inline-empty">Sin documentos emitidos.</div>}
                          </div>
                        </article>
                      </section>
                    </div>
                  )}

                  {activeTab === "history" && (
                    <section className="clients-reference-history-view">
                      <div className="clients-reference-history-shortcuts">
                        {canTickets && <button type="button" disabled={selectedClient.archivado === true} onClick={() => openNewTicketForClient()}><Plus size={16} /> Nuevo ticket</button>}
                        {canSales && <button type="button" disabled={selectedClient.archivado === true} onClick={() => navigate("/caja", { state: { clienteId: selectedClient.id, returnTo: `/clientes?cliente=${encodeURIComponent(selectedClient.id)}&tab=history` } })}><ShoppingBag size={16} /> Nueva venta</button>}
                        {canCredits && <button type="button" disabled={selectedClient.archivado === true} onClick={() => openCredit("new")}><BadgeDollarSign size={16} /> Nuevo crédito</button>}
                        {canCredits && <button type="button" onClick={() => setClientContext(selectedClient.id, "credits")}><CreditCard size={16} /> Créditos</button>}
                        {canBudgets && <button type="button" onClick={() => setClientContext(selectedClient.id, "budgets")}><FileText size={16} /> Presupuestos</button>}
                        {canTickets && <button type="button" onClick={() => setClientContext(selectedClient.id, "devices")}><MonitorSmartphone size={16} /> Equipos</button>}
                        {canAudit && <button type="button" onClick={() => setClientContext(selectedClient.id, "audit")}><ShieldCheck size={16} /> Auditoría</button>}
                        {canManageClientLifecycle && <button type="button" disabled={archivingClient} onClick={handleArchiveClient}>{selectedClient.archivado === true ? <ArchiveRestore size={16} /> : <Archive size={16} />}{selectedClient.archivado === true ? "Restaurar cliente" : "Archivar cliente"}</button>}
                      </div>
                      <section className="clients-module-card data clients-reference-history-card">
                        <header><div><span>Actividad consolidada</span><h3>Historial del cliente</h3></div><History size={20} /></header>
                        <div className="clients-reference-history-list">
                          {historyRows.map((row) => (
                            <article key={row.key}>
                              <span className={`history-icon ${row.type}`}>{row.type === "ticket" ? <Ticket size={17} /> : row.type === "invoice" ? <ReceiptText size={17} /> : row.type === "sale" ? <ShoppingBag size={17} /> : row.type === "credit" ? <CreditCard size={17} /> : <FileText size={17} />}</span>
                              <div><strong>{row.title}</strong><span>{row.description}</span></div>
                              {row.amount !== undefined && <b>{formatMoney(row.amount)}</b>}
                              <small>{formatDate(row.date)}</small>
                              <button type="button" onClick={() => {
                                if (row.type === "ticket") openTicketFromClient(row.payload);
                                if (row.type === "sale") openSaleFromClient(row.payload);
                                if (row.type === "invoice") openInvoiceFromClient(row.payload);
                                if (row.type === "credit") openCreditFromClient(row.payload);
                                if (row.type === "budget") openBudgetFromClient(row.payload);
                              }}><ExternalLink size={14} /> Ver</button>
                            </article>
                          ))}
                          {!historyRows.length && <div className="clients-empty compact"><History size={23} /><strong>Sin actividad registrada</strong></div>}
                        </div>
                      </section>
                    </section>
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
