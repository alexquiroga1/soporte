import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Copy,
  Download,
  Eye,
  FileClock,
  FilePlus2,
  FileText,
  History,
  Info,
  Link2,
  ListChecks,
  PencilLine,
  PhoneCall,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Share2,
  Ticket,
  UserRound,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import { MODULE_ACCESS, PERMISSIONS } from "../../security/permissions.js";

import {
  acceptBudget,
  registerBudgetFollowUp,
  rejectBudget,
  subscribeToBudgets,
} from "../../services/presupuestos.service.js";

import { sendBudgetToCash } from "../../services/caja-pendientes.service.js";

import {
  applyPublicBudgetResponse,
  getPublicBudget,
  getPublicBudgetUrl,
  publishBudget,
} from "../../services/presupuesto-publico.service.js";

import "./Presupuestos.css";

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(number(value));
}

function formatCompactMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(number(value));
}

function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  const parts = text.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return date.toLocaleDateString("es-AR");
  }

  return text;
}

function normalizeOrigin(value) {
  return String(value || "").trim().toLowerCase() === "ticket"
    ? "Ticket"
    : "Manual";
}

function isExpired(budget) {
  if (!budget?.fechaVencimiento || budget?.estado !== "Pendiente") return false;

  const expiration = new Date(`${budget.fechaVencimiento}T23:59:59`);
  if (Number.isNaN(expiration.getTime())) return false;

  return expiration.getTime() < Date.now();
}

function daysUntil(value) {
  if (!value) return null;
  const target = new Date(`${value}T23:59:59`);
  if (Number.isNaN(target.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function getBudgetStatus(budget) {
  if (isExpired(budget)) {
    return { label: "Vencido", className: "expired" };
  }

  if (
    budget?.requiereAprobacionInterna === true &&
    String(budget?.aprobacionInternaEstado || "Pendiente") === "Pendiente"
  ) {
    return { label: "Revisión", className: "review" };
  }

  switch (budget?.estado) {
    case "Pendiente":
      return { label: "Pendiente", className: "pending" };
    case "Aceptado":
      return { label: "Aceptado", className: "accepted" };
    case "Rechazado":
      return { label: "Rechazado", className: "rejected" };
    case "Facturado":
      return { label: "Facturado", className: "billed" };
    case "En edición":
      return { label: "En edición", className: "review" };
    default:
      return {
        label: budget?.estado || "Pendiente",
        className: "neutral",
      };
  }
}

function getOperationError(error) {
  if (error?.message === "STOCK_RESERVATION_INSUFFICIENT") {
    const productName = error?.productName || error?.sku || "un repuesto";
    const available = number(error?.available);
    const required = number(error?.required);
    return `Stock insuficiente para reservar ${productName}. Disponible: ${available}; requerido: ${required}.`;
  }

  const map = {
    BUDGET_REQUIRED: "Seleccioná un presupuesto.",
    BUDGET_NOT_FOUND: "El presupuesto ya no existe.",
    BUDGET_NOT_PENDING: "Este presupuesto ya fue procesado.",
    BUDGET_EXPIRED: "El presupuesto se encuentra vencido.",
    BUDGET_ALREADY_IN_CASH: "El presupuesto ya fue enviado a Caja.",
    BUDGET_ALREADY_BILLED: "El presupuesto ya fue facturado.",
    AUTH_REQUIRED: "Tenés que iniciar sesión para realizar esta operación.",
    PUBLIC_TOKEN_INVALID: "El enlace público no es válido.",
    PUBLIC_BUDGET_NOT_FOUND: "No encontramos el presupuesto público.",
    PUBLIC_RESPONSE_PENDING: "El cliente todavía no respondió el presupuesto.",
    PUBLIC_RESPONSE_UNAPPLIED: "El cliente ya respondió este enlace. Aplicá esa respuesta antes de volver a publicar o editar.",
    PUBLIC_RESPONSE_CONFLICT: "El cliente registró la decisión opuesta desde el enlace público.",
    BUDGET_NOT_ACCEPTED: "El presupuesto debe estar aceptado antes de enviarlo a Caja.",
    BUDGET_TICKET_USE_TICKET_FLOW: "Los presupuestos vinculados a Tickets se envían a Caja desde el detalle del Ticket.",
    BUDGET_INVALID_TOTAL: "El presupuesto no tiene un total válido para cobrar.",
    CASH_PENDING_EXISTS: "Este presupuesto ya tiene un cobro pendiente en Caja.",
  };

  return map[error?.message] || error?.message || "Ocurrió un error inesperado.";
}

async function copyText(value) {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return true;
  }

  window.prompt("Copiá este enlace:", value);
  return false;
}

function AuroraToast({ toast, onClose }) {
  const timerRef = useRef(null);
  const startedRef = useRef(Date.now());
  const remainingRef = useRef(4200);

  const startTimer = useCallback(() => {
    startedRef.current = Date.now();
    timerRef.current = window.setTimeout(onClose, remainingRef.current);
  }, [onClose]);

  useEffect(() => {
    startTimer();
    return () => window.clearTimeout(timerRef.current);
  }, [startTimer]);

  const pause = () => {
    window.clearTimeout(timerRef.current);
    remainingRef.current = Math.max(
      500,
      remainingRef.current - (Date.now() - startedRef.current)
    );
  };

  const resume = () => {
    window.clearTimeout(timerRef.current);
    startTimer();
  };

  const Icon =
    toast.type === "error"
      ? XCircle
      : toast.type === "warning"
        ? AlertTriangle
        : toast.type === "info"
          ? Info
          : CheckCircle2;

  return (
    <motion.div
      className={`budgets-aurora-toast ${toast.type}`}
      initial={{ opacity: 0, y: 18, x: 12, scale: 0.94, rotate: 0.8 }}
      animate={{ opacity: 1, y: 0, x: 0, scale: 1, rotate: 0 }}
      exit={{ opacity: 0, x: 26, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 420, damping: 28 }}
      onMouseEnter={pause}
      onMouseLeave={resume}
    >
      <div className="budgets-aurora-toast-icon">
        <Icon size={21} />
      </div>

      <div className="budgets-aurora-toast-copy">
        <strong>{toast.title}</strong>
        <span>{toast.description}</span>
      </div>

      <button
        type="button"
        className="budgets-aurora-toast-close"
        onClick={onClose}
        aria-label="Cerrar notificación"
      >
        <X size={14} />
      </button>

      <div className="budgets-aurora-toast-progress">
        <span />
      </div>
    </motion.div>
  );
}

export default function Presupuestos() {
  const navigate = useNavigate();
  const location = useLocation();
  const authContext = useAuth();
  const { profile, userProfile, user, hasAnyPermission } = authContext || {};

  const canOpenTickets = Boolean(hasAnyPermission?.([PERMISSIONS.TICKETS]));
  const canOpenFacturacion = Boolean(
    hasAnyPermission?.(MODULE_ACCESS.facturacion || [])
  );
  const canSendManualToCash = Boolean(
    hasAnyPermission?.([PERMISSIONS.SALES])
  );

  const author =
    profile?.nombre ||
    profile?.name ||
    userProfile?.nombre ||
    userProfile?.name ||
    user?.email ||
    "Sistema";

  const backPath = canOpenFacturacion ? "/facturacion" : "/tickets";
  const backTitle = canOpenFacturacion
    ? "Volver a Facturación"
    : "Volver a Tickets";

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("budgets");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [sortMode, setSortMode] = useState("recent");

  const [previewBudgetId, setPreviewBudgetId] = useState(null);
  const [decisionModal, setDecisionModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [cashConfirmBudget, setCashConfirmBudget] = useState(null);
  const [followModal, setFollowModal] = useState(null);
  const [followType, setFollowType] = useState("Llamada");
  const [followNote, setFollowNote] = useState("");
  const [followDate, setFollowDate] = useState("");

  const [processingBudgetId, setProcessingBudgetId] = useState(null);
  const [publicBusyId, setPublicBusyId] = useState(null);
  const [cashBusyId, setCashBusyId] = useState(null);
  const [followBusy, setFollowBusy] = useState(false);

  const [toasts, setToasts] = useState([]);

  const pushToast = useCallback((type, title, description) => {
    const id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`;

    setToasts((current) =>
      [...current, { id, type, title, description }].slice(-4)
    );
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToBudgets(
      (data) => {
        setBudgets(data);
        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        console.error(firebaseError);
        setError(firebaseError);
        setLoading(false);
        pushToast(
          "error",
          "No pudimos cargar los presupuestos",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    return () => unsubscribe();
  }, [pushToast]);

  useEffect(() => {
    const requestedId = location.state?.budgetId;
    if (!requestedId || budgets.length === 0) return;

    if (budgets.some((budget) => budget.id === requestedId)) {
      setPreviewBudgetId(requestedId);
      navigate(location.pathname, {
        replace: true,
        state: null,
      });
    }
  }, [budgets, location.pathname, location.state, navigate]);

  useEffect(() => {
    if (!previewBudgetId) return undefined;

    const handler = (event) => {
      if (event.key === "Escape") setPreviewBudgetId(null);
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [previewBudgetId]);

  const previewBudget = useMemo(
    () => budgets.find((budget) => budget.id === previewBudgetId) || null,
    [budgets, previewBudgetId]
  );

  const metrics = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const open = budgets.filter(
      (budget) => budget.estado === "Pendiente" && !isExpired(budget)
    );

    const acceptedThisMonth = budgets.filter((budget) => {
      if (budget.estado !== "Aceptado") return false;
      const date = new Date(budget.actualizadoEn || budget.creadoEn || budget.fecha);
      return (
        !Number.isNaN(date.getTime()) &&
        date.getMonth() === currentMonth &&
        date.getFullYear() === currentYear
      );
    }).length;

    const decided = budgets.filter((budget) =>
      ["Aceptado", "Rechazado"].includes(budget.estado)
    ).length;
    const accepted = budgets.filter((budget) => budget.estado === "Aceptado").length;
    const conversion = decided > 0 ? Math.round((accepted / decided) * 100) : 0;

    const expiring = open.filter((budget) => {
      const days = daysUntil(budget.fechaVencimiento);
      return days !== null && days >= 0 && days <= 7;
    }).length;

    const review = budgets.filter(
      (budget) =>
        budget.requiereAprobacionInterna === true &&
        String(budget.aprobacionInternaEstado || "Pendiente") === "Pendiente"
    ).length;

    return {
      open: open.length,
      acceptedThisMonth,
      conversion,
      expiring,
      negotiation: open.reduce((sum, budget) => sum + number(budget.total), 0),
      review,
    };
  }, [budgets]);

  const filteredBudgets = useMemo(() => {
    const query = search.trim().toLowerCase();

    const rows = budgets.filter((budget) => {
      const status = getBudgetStatus(budget).label;
      const origin = normalizeOrigin(budget.origen);
      const text = [
        budget.id,
        budget.numero,
        budget.cliente,
        budget.doc,
        budget.ticketId,
        budget.ticketNumero,
        budget.revision,
        origin,
        status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || text.includes(query)) &&
        (!statusFilter || status === statusFilter) &&
        (!originFilter || origin === originFilter)
      );
    });

    return [...rows].sort((a, b) => {
      if (sortMode === "amount") {
        return number(b.total) - number(a.total);
      }

      if (sortMode === "expires") {
        return String(a.fechaVencimiento || "9999-12-31").localeCompare(
          String(b.fechaVencimiento || "9999-12-31")
        );
      }

      if (sortMode === "oldest") {
        return String(a.actualizadoEn || a.creadoEn || a.fecha || "").localeCompare(
          String(b.actualizadoEn || b.creadoEn || b.fecha || "")
        );
      }

      return String(b.actualizadoEn || b.creadoEn || b.fecha || "").localeCompare(
        String(a.actualizadoEn || a.creadoEn || a.fecha || "")
      );
    });
  }, [budgets, originFilter, search, sortMode, statusFilter]);

  const followUpBudgets = useMemo(() => {
    return budgets
      .filter((budget) => {
        const status = getBudgetStatus(budget).label;
        return ["Pendiente", "Vencido", "Revisión"].includes(status);
      })
      .sort((a, b) => {
        const aNext = String(a.proximoSeguimiento || a.fechaVencimiento || "9999-12-31");
        const bNext = String(b.proximoSeguimiento || b.fechaVencimiento || "9999-12-31");
        return aNext.localeCompare(bNext);
      });
  }, [budgets]);

  function openRevision(budget) {
    if (!budget?.id) return;
    navigate(`/facturacion/presupuestos/nuevo?revision=${encodeURIComponent(budget.id)}`);
  }

  async function handlePublishBudget(budget) {
    if (!budget?.id || publicBusyId) return;

    try {
      setPublicBusyId(budget.id);
      let url = "";

      if (budget.publicToken) {
        url = getPublicBudgetUrl(budget.publicToken);
      } else {
        const result = await publishBudget(budget.id, author);
        url = result.url;
      }

      await copyText(url);
      pushToast(
        "success",
        budget.publicToken ? "Enlace copiado" : "Enlace público creado",
        "Quedó listo para compartir con el cliente."
      );
    } catch (operationError) {
      console.error(operationError);
      pushToast("error", "No se pudo compartir", getOperationError(operationError));
    } finally {
      setPublicBusyId(null);
    }
  }

  function handleOpenPublicLink(budget) {
    if (!budget?.publicToken) return;
    const url = getPublicBudgetUrl(budget.publicToken);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleApplyPublicResponse(budget) {
    if (!budget?.publicToken || publicBusyId) {
      pushToast("info", "Sin enlace público", "Primero compartí este presupuesto.");
      return;
    }

    try {
      setPublicBusyId(budget.id);
      const publicBudget = await getPublicBudget(budget.publicToken);

      if (!publicBudget) {
        pushToast("error", "Enlace no disponible", "No encontramos el documento público.");
        return;
      }

      if (!publicBudget.respuesta) {
        pushToast("info", "Sin respuesta todavía", "El cliente aún no aceptó ni rechazó el presupuesto.");
        return;
      }

      if (publicBudget.aplicadoEn) {
        pushToast("info", "Respuesta ya aplicada", `${publicBudget.respuesta} ya fue sincronizado.`);
        return;
      }

      const result = await applyPublicBudgetResponse(budget.publicToken, author);
      pushToast(
        "success",
        result.response === "Aceptado" ? "Aprobación aplicada" : "Rechazo aplicado",
        result.ticketUpdated
          ? `${budget.id} y el Ticket ${result.ticketId} fueron actualizados.`
          : `${budget.id} fue actualizado correctamente.`
      );
    } catch (operationError) {
      console.error(operationError);
      pushToast("error", "No se pudo aplicar la respuesta", getOperationError(operationError));
    } finally {
      setPublicBusyId(null);
    }
  }

  async function confirmDecision() {
    const budget = decisionModal?.budget;
    if (!budget || processingBudgetId) return;

    try {
      setProcessingBudgetId(budget.id);

      if (decisionModal.type === "accept") {
        const result = await acceptBudget(budget.id, author);
        pushToast(
          "success",
          "Presupuesto aceptado",
          result?.ticketUpdated
            ? `${budget.id} aprobado. El Ticket ${result.ticketId} pasó a reparación.`
            : `${budget.id} fue aprobado correctamente.`
        );
      } else {
        const result = await rejectBudget(budget.id, rejectionReason, author);
        pushToast(
          "success",
          "Presupuesto rechazado",
          result?.ticketUpdated
            ? `${budget.id} rechazado. El Ticket ${result.ticketId} fue actualizado.`
            : `${budget.id} fue rechazado correctamente.`
        );
      }

      setDecisionModal(null);
      setRejectionReason("");
    } catch (operationError) {
      console.error(operationError);
      pushToast("error", "No se pudo procesar", getOperationError(operationError));
    } finally {
      setProcessingBudgetId(null);
    }
  }

  async function confirmSendToCash() {
    const budget = cashConfirmBudget;
    if (!budget?.id || cashBusyId || !canSendManualToCash) return;

    try {
      setCashBusyId(budget.id);
      const result = await sendBudgetToCash(budget.id, author);
      pushToast(
        "success",
        "Enviado a Caja",
        `${result.budgetId} quedó pendiente de cobro por ${formatMoney(result.total)}.`
      );
      setCashConfirmBudget(null);
    } catch (operationError) {
      console.error(operationError);
      pushToast("error", "No se pudo enviar a Caja", getOperationError(operationError));
    } finally {
      setCashBusyId(null);
    }
  }

  function openFollowModal(budget) {
    setFollowModal(budget);
    setFollowType("Llamada");
    setFollowNote("");
    setFollowDate(budget?.proximoSeguimiento || "");
  }

  async function saveFollowUp() {
    if (!followModal?.id || followBusy) return;

    try {
      setFollowBusy(true);
      await registerBudgetFollowUp(
        followModal.id,
        {
          type: followType,
          note: followNote,
          nextFollowUp: followDate,
        },
        author
      );

      pushToast(
        "success",
        "Gestión registrada",
        followDate
          ? `Próximo seguimiento: ${formatDate(followDate)}.`
          : "La gestión quedó registrada en el historial."
      );
      setFollowModal(null);
    } catch (operationError) {
      console.error(operationError);
      pushToast("error", "No se pudo registrar", getOperationError(operationError));
    } finally {
      setFollowBusy(false);
    }
  }

  function exportCsv() {
    const rows = [
      ["Presupuesto", "Cliente", "Documento", "Origen", "Versión", "Estado", "Vencimiento", "Total"],
      ...filteredBudgets.map((budget) => [
        budget.numero || budget.id,
        budget.cliente || "Cliente",
        budget.doc || "",
        normalizeOrigin(budget.origen),
        `v${Math.max(1, number(budget.revision) || 1)}`,
        getBudgetStatus(budget).label,
        budget.fechaVencimiento || "",
        number(budget.total),
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([`\ufeff${csv}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `servix-presupuestos-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="budgets-page">
      <header className="budgets-topbar">
        <div className="budgets-brand">
          <button
            type="button"
            className="budgets-icon-button"
            onClick={() => navigate(backPath)}
            title={backTitle}
          >
            <ArrowLeft size={20} />
          </button>

          <motion.div
            className="budgets-brand-icon"
            animate={{ y: [0, -3, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <FileText size={20} />
          </motion.div>

          <div>
            <strong>Presupuestos</strong>
            <span>SERVIX · Facturación / Gestión comercial</span>
          </div>
        </div>

        <div className="budgets-top-actions">
          <div className="budgets-sync-pill">
            <span />
            Sincronizado
          </div>

          <button type="button" className="budgets-user-pill">
            <span className="budgets-user-avatar">{String(author).slice(0, 2).toUpperCase()}</span>
            <strong>{author}</strong>
          </button>
        </div>
      </header>

      <section className="budgets-page-head">
        <div>
          <span className="budgets-eyebrow">
            <ListChecks size={15} /> Gestión comercial
          </span>
          <h1>Presupuestos</h1>
          <p>Versionado, seguimiento comercial, aprobación, stock e impresión profesional.</p>
        </div>

        <div className="budgets-head-actions">
          <button type="button" className="budgets-secondary-button" onClick={exportCsv}>
            <Download size={16} /> Exportar
          </button>
          <motion.button
            type="button"
            className="budgets-primary-button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => navigate("/facturacion/presupuestos/nuevo")}
          >
            <Plus size={17} /> Nuevo presupuesto
          </motion.button>
        </div>
      </section>

      <section className="budgets-metrics">
        <article>
          <div><span>Presupuestos abiertos</span><FileClock size={17} /></div>
          <strong>{metrics.open}</strong>
          <small>Esperando decisión</small>
        </article>
        <article>
          <div><span>Aceptados este mes</span><CheckCircle2 size={17} /></div>
          <strong>{metrics.acceptedThisMonth}</strong>
          <small>Conversión comercial {metrics.conversion}%</small>
        </article>
        <article>
          <div><span>Vencen en 7 días</span><CalendarDays size={17} /></div>
          <strong>{metrics.expiring}</strong>
          <small>Requieren seguimiento</small>
        </article>
        <article>
          <div><span>En negociación</span><CircleDollarSign size={17} /></div>
          <strong>{formatCompactMoney(metrics.negotiation)}</strong>
          <small>Presupuestos vigentes</small>
        </article>
        <article>
          <div><span>Revisión interna</span><AlertTriangle size={17} /></div>
          <strong>{metrics.review}</strong>
          <small>Margen o descuento sensible</small>
        </article>
      </section>

      <section className="budgets-workspace">
        <div className="budgets-tabs-bar">
          <div className="budgets-tabs">
            <button
              type="button"
              className={activeTab === "budgets" ? "active" : ""}
              onClick={() => setActiveTab("budgets")}
            >
              <FileText size={16} /> Presupuestos
            </button>
            <button
              type="button"
              className={activeTab === "follow" ? "active" : ""}
              onClick={() => setActiveTab("follow")}
            >
              <FileClock size={16} /> Seguimiento
            </button>
          </div>
        </div>

        {activeTab === "budgets" ? (
          <>
            <div className="budgets-filters-row">
              <div className="budgets-search-box">
                <Search size={17} />
                <input
                  type="search"
                  placeholder="Buscar número, cliente, DNI/CUIT, ticket..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
                {search && (
                  <button type="button" onClick={() => setSearch("")}>
                    <X size={14} />
                  </button>
                )}
              </div>

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="Aceptado">Aceptado</option>
                <option value="Revisión">Revisión</option>
                <option value="Rechazado">Rechazado</option>
                <option value="Facturado">Facturado</option>
                <option value="Vencido">Vencido</option>
              </select>

              <select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)}>
                <option value="">Todos los orígenes</option>
                <option value="Ticket">Ticket</option>
                <option value="Manual">Manual</option>
              </select>

              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
                <option value="recent">Más recientes</option>
                <option value="oldest">Más antiguos</option>
                <option value="amount">Mayor importe</option>
                <option value="expires">Próximo a vencer</option>
              </select>
            </div>

            <div className="budgets-table-wrap">
              <div className="budgets-table-head">
                <div>Presupuesto</div>
                <div>Cliente</div>
                <div>Origen</div>
                <div>Versión</div>
                <div>Estado</div>
                <div>Vence</div>
                <div>Total</div>
                <div>Acciones</div>
              </div>

              {loading && (
                <div className="budgets-empty-state">
                  <RefreshCcw className="spin" size={24} />
                  <strong>Cargando presupuestos</strong>
                  <span>Sincronizando con Firebase...</span>
                </div>
              )}

              {!loading && error && (
                <div className="budgets-empty-state error">
                  <XCircle size={24} />
                  <strong>No se pudieron cargar</strong>
                  <span>Revisá la conexión y los permisos.</span>
                </div>
              )}

              {!loading && !error && filteredBudgets.length === 0 && (
                <div className="budgets-empty-state">
                  <FileText size={24} />
                  <strong>Sin resultados</strong>
                  <span>No encontramos presupuestos para estos filtros.</span>
                </div>
              )}

              <AnimatePresence initial={false}>
                {!loading &&
                  !error &&
                  filteredBudgets.map((budget, index) => {
                    const status = getBudgetStatus(budget);
                    const origin = normalizeOrigin(budget.origen);
                    const canRevise = ![
                      "Aceptado",
                      "Facturado",
                    ].includes(budget.estado) && ![
                      "Pendiente",
                      "Cobrado",
                      "Financiado",
                    ].includes(budget.estadoCaja);

                    return (
                      <motion.div
                        layout
                        key={budget.id}
                        className="budget-list-row"
                        role="button"
                        tabIndex={0}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2, delay: Math.min(index, 5) * 0.025 }}
                        onClick={() => setPreviewBudgetId(budget.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setPreviewBudgetId(budget.id);
                          }
                        }}
                      >
                        <div className="budget-ref">
                          <strong>{budget.numero || budget.id}</strong>
                          <span>{formatDate(budget.fecha)}</span>
                        </div>

                        <div className="budget-client-cell">
                          <strong>{budget.cliente || "Cliente"}</strong>
                          <span>{budget.doc || "C.F."}</span>
                        </div>

                        <div>
                          <span className={`budget-origin ${origin.toLowerCase()}`}>{origin}</span>
                        </div>

                        <div>
                          <span className="budget-version">v{Math.max(1, number(budget.revision) || 1)}</span>
                        </div>

                        <div>
                          <span className={`budget-status ${status.className}`}>{status.label}</span>
                        </div>

                        <div className="budget-date-cell">{formatDate(budget.fechaVencimiento)}</div>
                        <div className="budget-total-cell">{formatMoney(budget.total)}</div>

                        <div className="budget-row-actions" onClick={(event) => event.stopPropagation()}>
                          <button
                            type="button"
                            className="preview"
                            title="Vista previa"
                            onClick={() => setPreviewBudgetId(budget.id)}
                          >
                            <Eye size={16} />
                          </button>

                          <button
                            type="button"
                            title="Compartir"
                            disabled={status.label !== "Pendiente" || publicBusyId === budget.id}
                            onClick={() => handlePublishBudget(budget)}
                          >
                            <Share2 size={16} />
                          </button>

                          <button
                            type="button"
                            title="Nueva revisión"
                            disabled={!canRevise}
                            onClick={() => openRevision(budget)}
                          >
                            <PencilLine size={16} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          </>
        ) : (
          <div className="budgets-follow-grid">
            {followUpBudgets.length === 0 ? (
              <div className="budgets-empty-state full">
                <CheckCircle2 size={24} />
                <strong>Seguimiento al día</strong>
                <span>No hay presupuestos pendientes de gestión.</span>
              </div>
            ) : (
              followUpBudgets.map((budget) => {
                const status = getBudgetStatus(budget);
                const next = budget.proximoSeguimiento || budget.fechaVencimiento;

                return (
                  <motion.article
                    key={budget.id}
                    className="budget-follow-card"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  >
                    <div className="budget-follow-top">
                      <div>
                        <strong>{budget.numero || budget.id}</strong>
                        <span>{budget.cliente || "Cliente"}</span>
                      </div>
                      <span className={`budget-status ${status.className}`}>{status.label}</span>
                    </div>

                    <p>
                      {status.label === "Vencido"
                        ? "Presupuesto vencido. Podés generar una nueva revisión con vigencia actual."
                        : budget.proximoSeguimiento
                          ? "Tiene una gestión comercial programada."
                          : "Todavía no registra una próxima gestión comercial."}
                    </p>

                    <div className="budget-follow-meta">
                      <span>Próximo seguimiento</span>
                      <strong>{next ? formatDate(next) : "Sin fecha"}</strong>
                    </div>

                    <div className="budget-follow-actions">
                      <button type="button" onClick={() => setPreviewBudgetId(budget.id)}>
                        <Eye size={15} /> Ver
                      </button>
                      <button type="button" onClick={() => openFollowModal(budget)}>
                        <PhoneCall size={15} /> Registrar gestión
                      </button>
                      {status.label === "Vencido" && (
                        <button type="button" onClick={() => openRevision(budget)}>
                          <RefreshCcw size={15} /> Renovar
                        </button>
                      )}
                    </div>
                  </motion.article>
                );
              })
            )}
          </div>
        )}
      </section>

      <AnimatePresence>
        {previewBudget && (
          <BudgetPreview
            budget={previewBudget}
            canOpenTickets={canOpenTickets}
            canSendManualToCash={canSendManualToCash}
            processing={processingBudgetId === previewBudget.id}
            publicBusy={publicBusyId === previewBudget.id}
            cashBusy={cashBusyId === previewBudget.id}
            onClose={() => setPreviewBudgetId(null)}
            onShare={() => handlePublishBudget(previewBudget)}
            onOpenPublic={() => handleOpenPublicLink(previewBudget)}
            onApplyPublic={() => handleApplyPublicResponse(previewBudget)}
            onRevision={() => openRevision(previewBudget)}
            onAccept={() => {
              setDecisionModal({ type: "accept", budget: previewBudget });
              setRejectionReason("");
            }}
            onReject={() => {
              setDecisionModal({ type: "reject", budget: previewBudget });
              setRejectionReason("");
            }}
            onSendCash={() => setCashConfirmBudget(previewBudget)}
            onOpenTicket={() => navigate(`/tickets/${previewBudget.ticketId}`)}
            onFollow={() => openFollowModal(previewBudget)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {decisionModal && (
          <div className="budgets-modal-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !processingBudgetId) {
              setDecisionModal(null);
            }
          }}>
            <motion.div
              className="budgets-modal"
              initial={{ opacity: 0, y: 10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
            >
              <div className="budgets-modal-icon">
                {decisionModal.type === "accept" ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
              </div>
              <span>{decisionModal.budget.numero || decisionModal.budget.id}</span>
              <h3>{decisionModal.type === "accept" ? "Aceptar presupuesto" : "Rechazar presupuesto"}</h3>
              <p>
                {decisionModal.type === "accept"
                  ? "Al aceptar, SERVIX reservará el stock de los productos vinculados."
                  : "El rechazo quedará registrado en el historial comercial."}
              </p>

              {decisionModal.type === "reject" && (
                <label className="budgets-modal-field">
                  <span>Motivo</span>
                  <textarea
                    value={rejectionReason}
                    onChange={(event) => setRejectionReason(event.target.value)}
                    placeholder="Opcional..."
                    disabled={Boolean(processingBudgetId)}
                  />
                </label>
              )}

              <div className="budgets-modal-actions">
                <button type="button" disabled={Boolean(processingBudgetId)} onClick={() => setDecisionModal(null)}>
                  Cancelar
                </button>
                <button
                  type="button"
                  className={decisionModal.type === "accept" ? "accept" : "reject"}
                  disabled={Boolean(processingBudgetId)}
                  onClick={confirmDecision}
                >
                  {processingBudgetId ? "Procesando..." : decisionModal.type === "accept" ? "Aceptar" : "Rechazar"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {cashConfirmBudget && (
          <div className="budgets-modal-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cashBusyId) setCashConfirmBudget(null);
          }}>
            <motion.div className="budgets-modal" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.98 }}>
              <div className="budgets-modal-icon cash"><WalletCards size={22} /></div>
              <span>{cashConfirmBudget.numero || cashConfirmBudget.id}</span>
              <h3>Enviar a Caja</h3>
              <p>El presupuesto quedará como pendiente de cobro. El dinero se registra únicamente en Caja.</p>
              <div className="budgets-modal-summary">
                <span>Total</span>
                <strong>{formatMoney(cashConfirmBudget.total)}</strong>
              </div>
              <div className="budgets-modal-actions">
                <button type="button" disabled={Boolean(cashBusyId)} onClick={() => setCashConfirmBudget(null)}>Cancelar</button>
                <button type="button" className="accept" disabled={Boolean(cashBusyId)} onClick={confirmSendToCash}>
                  {cashBusyId ? "Enviando..." : "Enviar a Caja"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {followModal && (
          <div className="budgets-modal-overlay" onMouseDown={(event) => {
            if (event.target === event.currentTarget && !followBusy) setFollowModal(null);
          }}>
            <motion.div className="budgets-modal" initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: 0.98 }}>
              <div className="budgets-modal-icon follow"><PhoneCall size={22} /></div>
              <span>{followModal.numero || followModal.id}</span>
              <h3>Registrar gestión comercial</h3>
              <p>La gestión queda en el historial y no modifica el total ni el estado del presupuesto.</p>

              <label className="budgets-modal-field">
                <span>Tipo</span>
                <select value={followType} onChange={(event) => setFollowType(event.target.value)}>
                  <option>Llamada</option>
                  <option>Email</option>
                  <option>Visita</option>
                  <option>Seguimiento</option>
                </select>
              </label>

              <label className="budgets-modal-field">
                <span>Observación</span>
                <textarea value={followNote} onChange={(event) => setFollowNote(event.target.value)} placeholder="Ej.: cliente solicita revisar el presupuesto el viernes..." />
              </label>

              <label className="budgets-modal-field">
                <span>Próximo seguimiento</span>
                <input type="date" value={followDate} onChange={(event) => setFollowDate(event.target.value)} />
              </label>

              <div className="budgets-modal-actions">
                <button type="button" disabled={followBusy} onClick={() => setFollowModal(null)}>Cancelar</button>
                <button type="button" className="accept" disabled={followBusy} onClick={saveFollowUp}>
                  {followBusy ? "Guardando..." : "Guardar gestión"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="budgets-toast-area" aria-live="polite">
        <AnimatePresence>
          {toasts.map((toast) => (
            <AuroraToast
              key={toast.id}
              toast={toast}
              onClose={() => removeToast(toast.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </main>
  );
}

function BudgetPreview({
  budget,
  canOpenTickets,
  canSendManualToCash,
  processing,
  publicBusy,
  cashBusy,
  onClose,
  onShare,
  onOpenPublic,
  onApplyPublic,
  onRevision,
  onAccept,
  onReject,
  onSendCash,
  onOpenTicket,
  onFollow,
}) {
  const status = getBudgetStatus(budget);
  const origin = normalizeOrigin(budget.origen);
  const items = Array.isArray(budget.items) ? budget.items : [];
  const revision = Math.max(1, number(budget.revision) || 1);
  const discount = number(budget.descuentoImporte ?? budget.descuento);
  const canDecide = status.label === "Pendiente" && !isExpired(budget);
  const canRevise = !["Aceptado", "Facturado"].includes(budget.estado) && ![
    "Pendiente",
    "Cobrado",
    "Financiado",
  ].includes(budget.estadoCaja);
  const canSendCash =
    origin === "Manual" &&
    budget.estado === "Aceptado" &&
    !["Pendiente", "Cobrado", "Financiado"].includes(budget.estadoCaja) &&
    canSendManualToCash;

  return (
    <motion.section
      className="budget-preview-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <header className="budget-preview-toolbar no-print">
        <div className="budget-preview-toolbar-left">
          <button type="button" className="budgets-icon-button" onClick={onClose}>
            <ArrowLeft size={20} />
          </button>
          <div>
            <strong>Vista previa del presupuesto</strong>
            <span>Documento completo · pantalla completa</span>
          </div>
        </div>

        <div className="budget-preview-toolbar-actions">
          {canOpenTickets && budget.ticketId && (
            <button type="button" onClick={onOpenTicket}>
              <Ticket size={16} /> Ticket
            </button>
          )}
          <button type="button" disabled={!canRevise} onClick={onRevision}>
            <PencilLine size={16} /> Nueva revisión
          </button>
          <button type="button" disabled={publicBusy || status.label !== "Pendiente"} onClick={onShare}>
            <Share2 size={16} /> {publicBusy ? "Procesando..." : "Compartir"}
          </button>
          <button type="button" className="primary" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir
          </button>
        </div>
      </header>

      <div className="budget-preview-scroll">
        <motion.article
          className="budget-print-document"
          initial={{ opacity: 0, y: 14, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 28 }}
        >
          <div className="budget-print-head">
            <div className="budget-print-company">
              <div className="budget-print-logo"><FileText size={24} /></div>
              <div>
                <strong>SERVIX</strong>
                <span>Servicio técnico · Soluciones informáticas</span>
                <span>Presupuesto comercial</span>
              </div>
            </div>

            <div className="budget-print-number">
              <span>Presupuesto</span>
              <strong>{budget.numero || budget.id} · v{revision}</strong>
              <span className={`budget-status ${status.className}`}>{status.label}</span>
            </div>
          </div>

          <div className="budget-print-info-grid">
            <section>
              <span>Cliente</span>
              <strong>{budget.cliente || "Cliente"}</strong>
              <small>{budget.doc || "C.F."}</small>
              <small>Origen: {origin}{budget.ticketId ? ` · Ticket ${budget.ticketNumero || budget.ticketId}` : ""}</small>
            </section>
            <section>
              <span>Información</span>
              <strong>Fecha: {formatDate(budget.fecha)}</strong>
              <small>Vigencia: {budget.validezDias ? `${budget.validezDias} días` : formatDate(budget.fechaVencimiento)}</small>
              <small>Vence: {formatDate(budget.fechaVencimiento)}</small>
            </section>
          </div>

          <div className="budget-print-table">
            <div className="budget-print-table-head">
              <div>Descripción</div>
              <div>Cant.</div>
              <div>Unitario</div>
              <div>Subtotal</div>
            </div>

            {items.length === 0 ? (
              <div className="budget-print-empty">Sin conceptos registrados.</div>
            ) : (
              items.map((item, index) => (
                <div className="budget-print-row" key={`${item.sku || item.descripcion}-${index}`}>
                  <div>
                    <strong>{item.descripcion || item.nombre || "Concepto"}</strong>
                    <small>{item.sku ? `SKU ${item.sku}` : item.tipo || "Concepto manual"}</small>
                  </div>
                  <div>{number(item.cantidad || item.cant || 1)}</div>
                  <div>{formatMoney(item.precio ?? item.costo)}</div>
                  <div>{formatMoney(item.subtotal ?? number(item.cantidad || item.cant || 1) * number(item.precio ?? item.costo))}</div>
                </div>
              ))
            )}
          </div>

          <div className="budget-print-totals">
            <div><span>Subtotal</span><strong>{formatMoney(budget.subtotal)}</strong></div>
            <div><span>Descuento {number(budget.descuentoPorcentaje)}%</span><strong>− {formatMoney(discount)}</strong></div>
            <div className="grand"><span>Total presupuestado</span><strong>{formatMoney(budget.total)}</strong></div>
          </div>

          <section className="budget-print-conditions">
            <h3>Condiciones comerciales</h3>
            <div>
              <article><span>Validez</span><strong>{budget.validezDias ? `${budget.validezDias} días` : "—"}</strong></article>
              <article><span>Plazo estimado</span><strong>{budget.plazoEstimado || "A coordinar"}</strong></article>
              <article><span>Garantía</span><strong>{budget.garantia || "Según trabajo realizado"}</strong></article>
              <article><span>Forma de pago</span><strong>Se define al momento del cobro en Caja</strong></article>
            </div>
          </section>

          {budget.observaciones && (
            <section className="budget-print-observations">
              <strong>Observaciones</strong>
              <p>{budget.observaciones}</p>
            </section>
          )}

          <div className="budget-print-note">
            Este documento constituye una propuesta comercial y no acredita pago. La disponibilidad de productos se valida al momento de la aceptación. Los cobros se registran en Caja y la documentación fiscal se gestiona desde Facturación.
          </div>

          <div className="budget-print-signatures">
            <div>Firma / conformidad del cliente</div>
            <div>SERVIX · Responsable</div>
          </div>
        </motion.article>

        <div className="budget-preview-business no-print">
          <div className="budget-preview-actions-card">
            <div>
              <span>Acciones comerciales</span>
              <strong>{budget.numero || budget.id}</strong>
            </div>

            <div className="budget-preview-action-buttons">
              {canDecide && (
                <>
                  <button type="button" className="accept" disabled={processing} onClick={onAccept}>
                    <CheckCircle2 size={16} /> Aceptar
                  </button>
                  <button type="button" className="reject" disabled={processing} onClick={onReject}>
                    <XCircle size={16} /> Rechazar
                  </button>
                </>
              )}

              {canSendCash && (
                <button type="button" className="cash" disabled={cashBusy} onClick={onSendCash}>
                  <WalletCards size={16} /> Enviar a Caja
                </button>
              )}

              <button type="button" onClick={onFollow}>
                <PhoneCall size={16} /> Registrar gestión
              </button>

              {budget.publicToken && (
                <>
                  <button type="button" onClick={onOpenPublic}>
                    <Link2 size={16} /> Abrir enlace
                  </button>
                  {canDecide && (
                    <button type="button" disabled={publicBusy} onClick={onApplyPublic}>
                      <RefreshCcw size={16} /> Aplicar respuesta
                    </button>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="budget-preview-history-card">
            <div className="budget-preview-history-head">
              <History size={17} />
              <div>
                <strong>Actividad y auditoría</strong>
                <span>Últimos eventos del presupuesto</span>
              </div>
            </div>

            <div className="budget-preview-history-list">
              {(Array.isArray(budget.historial) ? [...budget.historial].reverse().slice(0, 6) : []).map((entry, index) => (
                <div key={`${entry.fecha || index}-${entry.accion || index}`}>
                  <span />
                  <div>
                    <strong>{entry.accion || "Evento"}</strong>
                    <p>{entry.detalle || "Sin detalle."}</p>
                  </div>
                  <time>{entry.fecha || "—"}</time>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
