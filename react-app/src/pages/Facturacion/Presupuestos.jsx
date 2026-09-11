import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  Copy,
  ExternalLink,
  FileText,
  Filter,
  Link2,
  Plus,
  ReceiptText,
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
  rejectBudget,
  subscribeToBudgets,
} from "../../services/presupuestos.service.js";
import {
  sendBudgetToCash,
} from "../../services/caja-pendientes.service.js";
import {
  applyPublicBudgetResponse,
  getPublicBudget,
  getPublicBudgetUrl,
  publishBudget,
} from "../../services/presupuesto-publico.service.js";
import { notify } from "../../services/notifications.js";
import "./Presupuestos.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  const parts = text.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiration = new Date(`${budget.fechaVencimiento}T00:00:00`);
  if (Number.isNaN(expiration.getTime())) return false;
  return expiration < today;
}

function getBudgetStatus(budget) {
  if (isExpired(budget)) {
    return { label: "Vencido", className: "budget-status-expired" };
  }

  switch (budget?.estado) {
    case "Pendiente":
      return { label: "Pendiente", className: "budget-status-pending" };
    case "Aceptado":
      return { label: "Aceptado", className: "budget-status-accepted" };
    case "Rechazado":
      return { label: "Rechazado", className: "budget-status-rejected" };
    case "Facturado":
      return { label: "Facturado", className: "budget-status-billed" };
    case "En edición":
      return { label: "En edición", className: "budget-status-editing" };
    default:
      return {
        label: budget?.estado || "Pendiente",
        className: "budget-status-neutral",
      };
  }
}

function getOperationError(error) {
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
    PUBLIC_RESPONSE_CONFLICT: "El cliente ya registró la decisión opuesta desde el enlace público. Aplicá primero esa respuesta.",
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

export default function Presupuestos() {
  const navigate = useNavigate();
  const authContext = useAuth();
  const {
    profile,
    userProfile,
    user,
    hasAnyPermission,
  } = authContext || {};

  const canOpenTickets = Boolean(
    hasAnyPermission?.([PERMISSIONS.TICKETS])
  );

  const canOpenFacturacion = Boolean(
    hasAnyPermission?.(MODULE_ACCESS.facturacion || [])
  );

  const canSendManualToCash = Boolean(
    hasAnyPermission?.([PERMISSIONS.SALES])
  );

  const backPath = canOpenFacturacion
    ? "/facturacion"
    : "/tickets";

  const backTitle = canOpenFacturacion
    ? "Volver a Facturación"
    : "Volver a Tickets";

  const author =
    profile?.nombre ||
    profile?.name ||
    userProfile?.nombre ||
    userProfile?.name ||
    user?.email ||
    "Sistema";

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBudgetId, setSelectedBudgetId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [originFilter, setOriginFilter] = useState("");

  const [decisionModal, setDecisionModal] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [processingBudgetId, setProcessingBudgetId] = useState(null);
  const [publicBusyId, setPublicBusyId] = useState(null);
  const [cashBusyId, setCashBusyId] = useState(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToBudgets(
      (data) => {
        setBudgets(data);
        setError(null);
        setLoading(false);
        setSelectedBudgetId((current) => {
          if (current && data.some((budget) => budget.id === current)) return current;
          return data[0]?.id || null;
        });
      },
      (firebaseError) => {
        console.error(firebaseError);
        setError(firebaseError);
        setLoading(false);
        notify.error(
          "No pudimos cargar los presupuestos",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const filteredBudgets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return budgets.filter((budget) => {
      const effectiveStatus = getBudgetStatus(budget).label;
      const origin = normalizeOrigin(budget.origen);
      const text = [
        budget.id,
        budget.numero,
        budget.cliente,
        budget.doc,
        budget.ticketId,
        budget.ticketNumero,
        origin,
        effectiveStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || text.includes(query)) &&
        (!statusFilter || effectiveStatus === statusFilter) &&
        (!originFilter || origin === originFilter)
      );
    });
  }, [budgets, search, statusFilter, originFilter]);

  const selectedBudget = useMemo(
    () => budgets.find((budget) => budget.id === selectedBudgetId) || null,
    [budgets, selectedBudgetId]
  );

  const metrics = useMemo(
    () => ({
      total: budgets.length,
      pending: budgets.filter(
        (budget) => budget.estado === "Pendiente" && !isExpired(budget)
      ).length,
      accepted: budgets.filter((budget) => budget.estado === "Aceptado").length,
      rejected: budgets.filter((budget) => budget.estado === "Rechazado").length,
      expired: budgets.filter(isExpired).length,
    }),
    [budgets]
  );

  const hasFilters = Boolean(search || statusFilter || originFilter);

  function clearFilters() {
    setSearch("");
    setStatusFilter("");
    setOriginFilter("");
  }

  function openTicket(ticketId) {
    if (ticketId) navigate(`/tickets/${ticketId}`);
  }

  function openAcceptModal(budget) {
    setDecisionModal({ type: "accept", budget });
    setRejectionReason("");
  }

  function openRejectModal(budget) {
    setDecisionModal({ type: "reject", budget });
    setRejectionReason("");
  }

  function closeDecisionModal() {
    if (processingBudgetId) return;
    setDecisionModal(null);
    setRejectionReason("");
  }

  async function confirmDecision() {
    const budget = decisionModal?.budget;
    if (!budget || processingBudgetId) return;

    try {
      setProcessingBudgetId(budget.id);

      if (decisionModal.type === "accept") {
        const result = await acceptBudget(budget.id, author);
        notify.success(
          "Presupuesto aceptado",
          result?.ticketUpdated
            ? `${budget.id} aprobado. El Ticket ${result.ticketId} pasó a reparación.`
            : `${budget.id} fue aprobado correctamente.`
        );
      } else {
        const result = await rejectBudget(budget.id, rejectionReason, author);
        notify.success(
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
      notify.error("No se pudo procesar", getOperationError(operationError));
    } finally {
      setProcessingBudgetId(null);
    }
  }

  async function handleSendManualToCash(budget) {
    if (!budget?.id || cashBusyId || !canSendManualToCash) return;

    const confirmed = window.confirm(
      `¿Enviar ${budget.id} a Caja?\n\nTotal a cobrar: ${formatMoney(budget.total)}`
    );

    if (!confirmed) return;

    try {
      setCashBusyId(budget.id);

      const result = await sendBudgetToCash(budget.id, author);

      notify.success(
        "Enviado a Caja",
        `${result.budgetId} quedó pendiente de cobro por ${formatMoney(result.total)}.`
      );
    } catch (operationError) {
      console.error(operationError);
      notify.error("No se pudo enviar a Caja", getOperationError(operationError));
    } finally {
      setCashBusyId(null);
    }
  }

  async function handlePublishBudget(budget) {
    if (!budget?.id || publicBusyId) return;

    try {
      setPublicBusyId(budget.id);
      const result = await publishBudget(budget.id, author);
      await copyText(result.url);

      notify.success(
        result.reused ? "Enlace actualizado" : "Enlace público creado",
        "El enlace quedó copiado y listo para compartir."
      );
    } catch (operationError) {
      console.error(operationError);
      notify.error("No se pudo publicar", getOperationError(operationError));
    } finally {
      setPublicBusyId(null);
    }
  }

  async function handleCopyPublicLink(budget) {
    if (!budget?.publicToken) {
      await handlePublishBudget(budget);
      return;
    }

    const url = getPublicBudgetUrl(budget.publicToken);

    try {
      await copyText(url);
      notify.success("Enlace copiado", "Ya podés compartirlo con el cliente.");
    } catch (copyError) {
      console.error(copyError);
      notify.error("No se pudo copiar", "Copiá el enlace manualmente.");
    }
  }

  function handleOpenPublicLink(budget) {
    if (!budget?.publicToken) return;
    const url = getPublicBudgetUrl(budget.publicToken);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function handleApplyPublicResponse(budget) {
    if (!budget?.publicToken || publicBusyId) {
      notify.info("Sin enlace público", "Primero publicá este presupuesto.");
      return;
    }

    try {
      setPublicBusyId(budget.id);

      const publicBudget = await getPublicBudget(budget.publicToken);

      if (!publicBudget) {
        notify.error("Enlace no disponible", "No encontramos el documento público.");
        return;
      }

      if (!publicBudget.respuesta) {
        notify.info(
          "Sin respuesta todavía",
          "El cliente aún no aceptó ni rechazó el presupuesto."
        );
        return;
      }

      if (publicBudget.aplicadoEn) {
        notify.info(
          "Respuesta ya aplicada",
          `${publicBudget.respuesta} ya fue sincronizado con el sistema.`
        );
        return;
      }

      const result = await applyPublicBudgetResponse(budget.publicToken, author);

      notify.success(
        result.response === "Aceptado"
          ? "Aprobación aplicada"
          : "Rechazo aplicado",
        result.ticketUpdated
          ? `${budget.id} y el Ticket ${result.ticketId} fueron actualizados.`
          : `${budget.id} fue actualizado correctamente.`
      );
    } catch (operationError) {
      console.error(operationError);
      notify.error(
        "No se pudo aplicar la respuesta",
        getOperationError(operationError)
      );
    } finally {
      setPublicBusyId(null);
    }
  }

  return (
    <main className="budgets-page">
      <header className="budgets-header">
        <div className="budgets-header-left">
          <button
            type="button"
            className="budgets-back"
            onClick={() => navigate(backPath)}
            title={backTitle}
          >
            <ArrowLeft size={20} />
          </button>

          <div className="budgets-header-icon">
            <ClipboardList size={20} />
          </div>

          <div>
            <span>Facturación</span>
            <h1>Presupuestos</h1>
          </div>
        </div>

        <motion.button
          type="button"
          className="budgets-new"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => navigate("/facturacion/presupuestos/nuevo")}
        >
          <Plus size={17} />
          Nuevo presupuesto
        </motion.button>
      </header>

      <div className="budgets-content">
        <section className="budgets-intro">
          <div>
            <span className="budgets-kicker">Gestión comercial</span>
            <h2>Presupuestos</h2>
            <p>Presupuestos generados desde tickets y operaciones manuales.</p>
          </div>

          <div className="budgets-sync">
            <span />
            <div>
              <strong>Sincronizado</strong>
              <small>Firebase en tiempo real</small>
            </div>
          </div>
        </section>

        <section className="budgets-stats">
          <article className="budget-stat-card">
            <div><span>Total</span><FileText size={16} /></div>
            <strong>{metrics.total}</strong>
            <small>Presupuestos registrados</small>
          </article>

          <article className="budget-stat-card stat-pending">
            <div><span>Pendientes</span><Clock3 size={16} /></div>
            <strong>{metrics.pending}</strong>
            <small>Esperando respuesta</small>
          </article>

          <article className="budget-stat-card stat-accepted">
            <div><span>Aceptados</span><CheckCircle2 size={16} /></div>
            <strong>{metrics.accepted}</strong>
            <small>Aprobados por cliente</small>
          </article>

          <article className="budget-stat-card stat-rejected">
            <div><span>Rechazados</span><XCircle size={16} /></div>
            <strong>{metrics.rejected}</strong>
            <small>No aprobados</small>
          </article>

          <article className="budget-stat-card stat-expired">
            <div><span>Vencidos</span><CalendarDays size={16} /></div>
            <strong>{metrics.expired}</strong>
            <small>Fuera de vigencia</small>
          </article>
        </section>

        <section className="budgets-workspace">
          <div className="budgets-toolbar">
            <div className="budgets-search">
              <Search size={17} />
              <input
                type="search"
                placeholder="Buscar presupuesto, cliente o ticket..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="budgets-filters">
              <Filter size={15} />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="Pendiente">Pendiente</option>
                <option value="En edición">En edición</option>
                <option value="Aceptado">Aceptado</option>
                <option value="Rechazado">Rechazado</option>
                <option value="Facturado">Facturado</option>
                <option value="Vencido">Vencido</option>
              </select>

              <select
                value={originFilter}
                onChange={(event) => setOriginFilter(event.target.value)}
              >
                <option value="">Todos los orígenes</option>
                <option value="Ticket">Ticket</option>
                <option value="Manual">Manual</option>
              </select>

              {hasFilters && (
                <button type="button" className="budgets-clear" onClick={clearFilters}>
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="budgets-layout">
            <section className="budgets-list-panel">
              <div className="budgets-list-title">
                <div>
                  <strong>{filteredBudgets.length}</strong>
                  <span>
                    {filteredBudgets.length === 1 ? "presupuesto" : "presupuestos"}
                  </span>
                </div>
              </div>

              {loading && (
                <div className="budgets-state">
                  <div className="budgets-loader" />
                  <strong>Cargando presupuestos</strong>
                  <span>Sincronizando con Firebase...</span>
                </div>
              )}

              {!loading && error && (
                <div className="budgets-state budgets-error">
                  <strong>No se pudieron cargar</strong>
                  <span>Revisá conexión y permisos.</span>
                </div>
              )}

              {!loading && !error && filteredBudgets.length === 0 && (
                <div className="budgets-state">
                  <FileText size={25} />
                  <strong>Sin presupuestos</strong>
                  <span>No encontramos resultados para estos filtros.</span>
                </div>
              )}

              {!loading &&
                !error &&
                filteredBudgets.map((budget) => {
                  const status = getBudgetStatus(budget);
                  const selected = selectedBudgetId === budget.id;
                  const origin = normalizeOrigin(budget.origen);

                  return (
                    <button
                      type="button"
                      key={budget.id}
                      className={`budget-row ${selected ? "active" : ""}`}
                      onClick={() => setSelectedBudgetId(budget.id)}
                    >
                      <div className="budget-row-main">
                        <div className="budget-row-top">
                          <strong>{budget.numero || budget.id}</strong>
                          <span className={`budget-status ${status.className}`}>
                            {status.label}
                          </span>
                        </div>

                        <h3>{budget.cliente || "Consumidor Final"}</h3>

                        <div className="budget-row-meta">
                          <span>{origin}</span>
                          {budget.publicToken && (
                            <>
                              <i />
                              <span className="budget-public-row-badge">Enlace público</span>
                            </>
                          )}
                          {budget.ticketId && (
                            <>
                              <i />
                              <span>Ticket {budget.ticketId}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="budget-row-side">
                        <strong>{formatMoney(budget.total)}</strong>
                        <span>{formatDate(budget.fecha)}</span>
                      </div>

                      <ChevronRight size={17} />
                    </button>
                  );
                })}
            </section>

            <aside className="budget-detail-panel">
              {!selectedBudget ? (
                <div className="budget-detail-empty">
                  <ReceiptText size={28} />
                  <strong>Seleccioná un presupuesto</strong>
                  <span>El detalle aparecerá en este panel.</span>
                </div>
              ) : (
                <BudgetDetail
                  budget={selectedBudget}
                  onOpenTicket={openTicket}
                  canOpenTicket={canOpenTickets}
                  onAccept={openAcceptModal}
                  onReject={openRejectModal}
                  onPublish={handlePublishBudget}
                  onCopyPublicLink={handleCopyPublicLink}
                  onOpenPublicLink={handleOpenPublicLink}
                  onApplyPublicResponse={handleApplyPublicResponse}
                  onSendToCash={handleSendManualToCash}
                  canSendManualToCash={canSendManualToCash}
                  busy={processingBudgetId === selectedBudget.id}
                  publicBusy={publicBusyId === selectedBudget.id}
                  cashBusy={cashBusyId === selectedBudget.id}
                />
              )}
            </aside>
          </div>
        </section>
      </div>

      {decisionModal && (
        <div
          className="budget-decision-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDecisionModal();
          }}
        >
          <motion.div
            className="budget-decision-modal"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.17 }}
          >
            <div className="budget-decision-icon">
              {decisionModal.type === "accept" ? (
                <CheckCircle2 size={22} />
              ) : (
                <XCircle size={22} />
              )}
            </div>

            <div className="budget-decision-copy">
              <span>{decisionModal.budget.id}</span>
              <h3>
                {decisionModal.type === "accept"
                  ? "Aceptar presupuesto"
                  : "Rechazar presupuesto"}
              </h3>
              <p>
                {decisionModal.type === "accept"
                  ? "El presupuesto quedará aprobado. Si nació desde un Ticket, el Ticket también será actualizado."
                  : "El presupuesto quedará rechazado. Si está vinculado a un Ticket, también se actualizará su estado."}
              </p>
            </div>

            <div className="budget-decision-summary">
              <div>
                <span>Cliente</span>
                <strong>{decisionModal.budget.cliente || "Consumidor Final"}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>{formatMoney(decisionModal.budget.total)}</strong>
              </div>
            </div>

            {decisionModal.type === "reject" && (
              <label className="budget-rejection-field">
                <span>Motivo del rechazo</span>
                <textarea
                  placeholder="Opcional..."
                  value={rejectionReason}
                  disabled={Boolean(processingBudgetId)}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </label>
            )}

            <div className="budget-decision-actions">
              <button
                type="button"
                className="budget-decision-cancel"
                disabled={Boolean(processingBudgetId)}
                onClick={closeDecisionModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className={
                  decisionModal.type === "accept"
                    ? "budget-decision-confirm accept"
                    : "budget-decision-confirm reject"
                }
                disabled={Boolean(processingBudgetId)}
                onClick={confirmDecision}
              >
                {decisionModal.type === "accept" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <XCircle size={16} />
                )}
                {processingBudgetId
                  ? "Procesando..."
                  : decisionModal.type === "accept"
                    ? "Aceptar presupuesto"
                    : "Rechazar presupuesto"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function BudgetDetail({
  budget,
  onOpenTicket,
  canOpenTicket,
  onAccept,
  onReject,
  onPublish,
  onCopyPublicLink,
  onOpenPublicLink,
  onApplyPublicResponse,
  onSendToCash,
  canSendManualToCash,
  busy,
  publicBusy,
  cashBusy,
}) {
  const status = getBudgetStatus(budget);
  const items = Array.isArray(budget.items) ? budget.items : [];
  const history = Array.isArray(budget.historial) ? [...budget.historial].reverse() : [];
  const discount = Number(budget.descuento ?? budget.descuentoImporte ?? 0);
  const canDecide = status.label === "Pendiente";
  const hasPublicLink = Boolean(budget.publicToken);
  const origin = normalizeOrigin(budget.origen);
  const isManualAccepted =
    origin === "Manual" &&
    status.label === "Aceptado" &&
    !budget.facturaId;
  const pendingInCash = budget.estadoCaja === "Pendiente";
  const cashResolved = ["Cobrado", "Financiado"].includes(budget.estadoCaja);
  const canQueueManualCash =
    isManualAccepted &&
    !pendingInCash &&
    !cashResolved &&
    canSendManualToCash;

  return (
    <div className="budget-detail">
      <div className="budget-detail-header">
        <div>
          <span>Presupuesto</span>
          <h2>{budget.numero || budget.id}</h2>
        </div>
        <span className={`budget-status ${status.className}`}>{status.label}</span>
      </div>

      {canDecide && (
        <div className="budget-detail-actions">
          <button
            type="button"
            className="budget-accept-button"
            disabled={busy || publicBusy}
            onClick={() => onAccept(budget)}
          >
            <CheckCircle2 size={15} />
            Aceptar
          </button>

          <button
            type="button"
            className="budget-reject-button"
            disabled={busy || publicBusy}
            onClick={() => onReject(budget)}
          >
            <XCircle size={15} />
            Rechazar
          </button>
        </div>
      )}

      {isManualAccepted && (
        <div className="budget-detail-actions">
          <button
            type="button"
            className="budget-accept-button"
            disabled={!canQueueManualCash || cashBusy}
            title={
              pendingInCash
                ? "Ya está pendiente de cobro en Caja"
                : canSendManualToCash
                  ? "Crear pendiente de cobro en Caja"
                  : "Requiere permiso para registrar ventas y cobros"
            }
            onClick={() => onSendToCash(budget)}
          >
            <WalletCards size={15} />
            {cashBusy
              ? "Enviando..."
              : pendingInCash
                ? "Pendiente en Caja"
                : "Enviar a Caja"}
          </button>
        </div>
      )}

      {canDecide && (
        <div className="budget-public-tools">
          <div className="budget-public-tools-head">
            <div>
              <Share2 size={16} />
              <span>Respuesta del cliente</span>
            </div>
            {hasPublicLink && <small>Enlace activo</small>}
          </div>

          <p>
            Compartí un enlace para que el cliente vea el presupuesto y registre su decisión.
          </p>

          <div className="budget-public-buttons">
            {!hasPublicLink ? (
              <button
                type="button"
                className="budget-public-primary"
                disabled={publicBusy || busy}
                onClick={() => onPublish(budget)}
              >
                <Share2 size={15} />
                {publicBusy ? "Publicando..." : "Crear y copiar enlace"}
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="budget-public-primary"
                  disabled={publicBusy || busy}
                  onClick={() => onCopyPublicLink(budget)}
                >
                  <Copy size={15} />
                  Copiar enlace
                </button>

                <button
                  type="button"
                  className="budget-public-secondary"
                  disabled={publicBusy || busy}
                  onClick={() => onOpenPublicLink(budget)}
                >
                  <ExternalLink size={15} />
                  Abrir
                </button>

                <button
                  type="button"
                  className="budget-public-secondary"
                  disabled={publicBusy || busy}
                  onClick={() => onPublish(budget)}
                >
                  <Share2 size={15} />
                  {publicBusy ? "Actualizando..." : "Actualizar enlace"}
                </button>

                <button
                  type="button"
                  className="budget-public-sync"
                  disabled={publicBusy || busy}
                  onClick={() => onApplyPublicResponse(budget)}
                >
                  <RefreshCcw size={15} />
                  {publicBusy ? "Consultando..." : "Aplicar respuesta"}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="budget-detail-section">
        <span className="budget-detail-label">Cliente</span>
        <div className="budget-client">
          <div><UserRound size={17} /></div>
          <div>
            <strong>{budget.cliente || "Consumidor Final"}</strong>
            <span>{budget.doc || "C.F."}</span>
          </div>
        </div>
      </div>

      <div className="budget-detail-grid">
        <div>
          <span>Fecha</span>
          <strong>{formatDate(budget.fecha)}</strong>
        </div>
        <div>
          <span>Vencimiento</span>
          <strong>{formatDate(budget.fechaVencimiento || budget.vigencia)}</strong>
        </div>
        <div>
          <span>Origen</span>
          <strong>{origin}</strong>
        </div>
        <div>
          <span>Usuario</span>
          <strong>{budget.usuario || "Sistema"}</strong>
        </div>
      </div>

      {budget.ticketId && canOpenTicket && (
        <button
          type="button"
          className="budget-ticket-link"
          onClick={() => onOpenTicket(budget.ticketId)}
        >
          <Ticket size={16} />
          <div>
            <span>Ticket asociado</span>
            <strong>{budget.ticketNumero || budget.ticketId}</strong>
          </div>
          <Link2 size={15} />
        </button>
      )}

      <div className="budget-detail-section">
        <span className="budget-detail-label">Conceptos</span>

        {items.length === 0 ? (
          <div className="budget-no-items">Sin conceptos registrados.</div>
        ) : (
          <div className="budget-items">
            {items.map((item, index) => {
              const quantity = Number(item.cantidad || 0);
              const price = Number(item.precio || 0);
              const subtotal = item.subtotal ?? quantity * price;

              return (
                <div
                  key={`${item.descripcion || "item"}-${index}`}
                  className="budget-item"
                >
                  <div>
                    <strong>{item.descripcion || "Concepto"}</strong>
                    <span>{quantity} × {formatMoney(price)}</span>
                  </div>
                  <strong>{formatMoney(subtotal)}</strong>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="budget-totals">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(budget.subtotal)}</strong>
        </div>

        {discount > 0 && (
          <div className="budget-total-discount">
            <span>
              Descuento
              {Number(budget.descuentoPorcentaje || 0) > 0 &&
                ` (${budget.descuentoPorcentaje}%)`}
            </span>
            <strong>- {formatMoney(discount)}</strong>
          </div>
        )}

        <div className="budget-total-final">
          <span>Total</span>
          <strong>{formatMoney(budget.total)}</strong>
        </div>
      </div>

      {budget.observaciones && (
        <div className="budget-detail-section">
          <span className="budget-detail-label">Observaciones</span>
          <p className="budget-observations">{budget.observaciones}</p>
        </div>
      )}

      <div className="budget-detail-section">
        <span className="budget-detail-label">Actividad</span>

        {history.length === 0 ? (
          <div className="budget-no-items">Sin actividad registrada.</div>
        ) : (
          <div className="budget-history">
            {history.slice(0, 8).map((event, index) => (
              <article key={`${event.fecha || "evento"}-${index}`}>
                <div className="budget-history-dot" />
                <div>
                  <div>
                    <strong>{event.accion || "Actividad"}</strong>
                    <span>{event.fecha || "—"}</span>
                  </div>
                  {event.detalle && <p>{event.detalle}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
