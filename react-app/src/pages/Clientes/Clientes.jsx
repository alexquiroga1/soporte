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
  Search,
  ShoppingBag,
  Ticket,
  Trash2,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  addClientNote,
  createClient,
  deleteClient,
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

  const canDeleteClient =
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
    ],
    [
      canTickets,
      canSales,
      canInvoices,
      canCredits,
      canBudgets,
      canAccount,
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
  const [deletingClient, setDeletingClient] = useState(false);
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

  const handleDeleteClient = async () => {
    if (
      !selectedClient ||
      !canDeleteClient
    ) {
      return;
    }

    const name =
      getClientDisplayName(
        selectedClient
      );

    const confirmed =
      window.confirm(
        `¿Eliminar definitivamente a ${name}?\n\nSolo se permitirá si no tiene tickets, créditos, ventas, facturas, presupuestos, movimientos de Caja o cuenta corriente asociados.`
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingClient(true);

      await deleteClient(
        selectedClient
      );

      setClientContext(
        null
      );

      uiNotify.success(
        "Cliente eliminado",
        `${name} fue eliminado de la base de clientes.`
      );
    } catch (error) {
      console.error(error);

      uiNotify.error(
        "No se pudo eliminar",
        errorMessage(error)
      );
    } finally {
      setDeletingClient(false);
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
              <header className="clients-topbar">
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
                    <strong>SERVIX</strong>
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
              </header>

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
              <header className="clients-topbar profile">
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

                  {canDeleteClient && (
                    <button
                      type="button"
                      className="clients-action danger"
                      disabled={deletingClient || archivingClient}
                      onClick={handleDeleteClient}
                    >
                      <Trash2 size={16} />
                      Eliminar
                    </button>
                  )}
                </div>
              </header>

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
