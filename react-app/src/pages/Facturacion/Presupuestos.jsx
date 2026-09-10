import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Filter,
  Link2,
  Plus,
  ReceiptText,
  Search,
  Ticket,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  acceptBudget,
  rejectBudget,
  subscribeToBudgets,
} from "../../services/presupuestos.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Presupuestos.css";

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(
      value || 0
    )
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parts =
    String(value).split("-");

  if (
    parts.length === 3
  ) {
    const [
      year,
      month,
      day,
    ] = parts;

    return `${day}/${month}/${year}`;
  }

  return value;
}

function isExpired(budget) {
  if (
    !budget?.fechaVencimiento ||
    budget?.estado !== "Pendiente"
  ) {
    return false;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const expiration =
    new Date(
      `${budget.fechaVencimiento}T00:00:00`
    );

  if (
    Number.isNaN(
      expiration.getTime()
    )
  ) {
    return false;
  }

  return (
    expiration <
    today
  );
}

function getBudgetStatus(
  budget
) {
  if (
    isExpired(
      budget
    )
  ) {
    return {
      label:
        "Vencido",

      className:
        "budget-status-expired",
    };
  }

  switch (
    budget?.estado
  ) {
    case "Pendiente":
      return {
        label:
          "Pendiente",

        className:
          "budget-status-pending",
      };

    case "Aceptado":
      return {
        label:
          "Aceptado",

        className:
          "budget-status-accepted",
      };

    case "Rechazado":
      return {
        label:
          "Rechazado",

        className:
          "budget-status-rejected",
      };

    case "Facturado":
      return {
        label:
          "Facturado",

        className:
          "budget-status-billed",
      };

    case "En edición":
      return {
        label:
          "En edición",

        className:
          "budget-status-editing",
      };

    default:
      return {
        label:
          budget?.estado ||
          "Pendiente",

        className:
          "budget-status-neutral",
      };
  }
}

/* =========================================
   COMPONENTE
========================================= */

export default function Presupuestos() {
  const navigate =
    useNavigate();

  const {
    profile,
    user,
  } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  /* =======================================
     DATOS
  ======================================= */

  const [
    budgets,
    setBudgets,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState(null);

  const [
    selectedBudgetId,
    setSelectedBudgetId,
  ] = useState(null);

  /* =======================================
     FILTROS
  ======================================= */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    originFilter,
    setOriginFilter,
  ] = useState("");

  /* =======================================
     DECISIONES
  ======================================= */

  const [
    decisionModal,
    setDecisionModal,
  ] = useState(null);

  const [
    rejectionReason,
    setRejectionReason,
  ] = useState("");

  const [
    processingBudgetId,
    setProcessingBudgetId,
  ] = useState(null);

  /* =======================================
     FIREBASE REALTIME
  ======================================= */

  useEffect(() => {
    setLoading(
      true
    );

    const unsubscribe =
      subscribeToBudgets(
        (data) => {
          setBudgets(
            data
          );

          setError(
            null
          );

          setLoading(
            false
          );

          setSelectedBudgetId(
            (
              current
            ) => {
              if (
                current &&
                data.some(
                  (
                    budget
                  ) =>
                    budget.id ===
                    current
                )
              ) {
                return current;
              }

              return (
                data[0]?.id ||
                null
              );
            }
          );
        },

        (
          firebaseError
        ) => {
          console.error(
            firebaseError
          );

          setError(
            firebaseError
          );

          setLoading(
            false
          );

          notify.error(
            "No pudimos cargar los presupuestos",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     FILTRADO
  ======================================= */

  const filteredBudgets =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return budgets.filter(
        (
          budget
        ) => {
          const effectiveStatus =
            getBudgetStatus(
              budget
            ).label;

          const text = [
            budget.id,
            budget.numero,
            budget.cliente,
            budget.doc,
            budget.ticketId,
            budget.origen,
            budget.estado,
          ]
            .filter(
              Boolean
            )
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            text.includes(
              query
            );

          const matchesStatus =
            !statusFilter ||
            effectiveStatus ===
              statusFilter;

          const matchesOrigin =
            !originFilter ||
            budget.origen ===
              originFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesOrigin
          );
        }
      );
    }, [
      budgets,
      search,
      statusFilter,
      originFilter,
    ]);

  /* =======================================
     PRESUPUESTO SELECCIONADO
  ======================================= */

  const selectedBudget =
    useMemo(() => {
      return (
        budgets.find(
          (
            budget
          ) =>
            budget.id ===
            selectedBudgetId
        ) ||
        null
      );
    }, [
      budgets,
      selectedBudgetId,
    ]);

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(() => {
      return {
        total:
          budgets.length,

        pending:
          budgets.filter(
            (
              budget
            ) =>
              budget.estado ===
                "Pendiente" &&
              !isExpired(
                budget
              )
          ).length,

        accepted:
          budgets.filter(
            (
              budget
            ) =>
              budget.estado ===
              "Aceptado"
          ).length,

        rejected:
          budgets.filter(
            (
              budget
            ) =>
              budget.estado ===
              "Rechazado"
          ).length,

        expired:
          budgets.filter(
            isExpired
          ).length,
      };
    }, [
      budgets,
    ]);

  const hasFilters =
    Boolean(
      search ||
      statusFilter ||
      originFilter
    );

  /* =======================================
     LIMPIAR FILTROS
  ======================================= */

  const clearFilters =
    () => {
      setSearch("");

      setStatusFilter("");

      setOriginFilter("");
    };

  /* =======================================
     NUEVO PRESUPUESTO
  ======================================= */

  const handleNewBudget =
    () => {
      notify.info(
        "Presupuesto manual",
        "El formulario manual lo incorporamos en el próximo paso."
      );
    };

  /* =======================================
     ABRIR TICKET
  ======================================= */

  const openTicket =
    (
      ticketId
    ) => {
      if (
        !ticketId
      ) {
        return;
      }

      navigate(
        `/tickets/${ticketId}`
      );
    };

  /* =======================================
     ACEPTAR
  ======================================= */

  const openAcceptModal =
    (
      budget
    ) => {
      setDecisionModal({
        type:
          "accept",

        budget,
      });

      setRejectionReason("");
    };

  /* =======================================
     RECHAZAR
  ======================================= */

  const openRejectModal =
    (
      budget
    ) => {
      setDecisionModal({
        type:
          "reject",

        budget,
      });

      setRejectionReason("");
    };

  /* =======================================
     CERRAR MODAL
  ======================================= */

  const closeDecisionModal =
    () => {
      if (
        processingBudgetId
      ) {
        return;
      }

      setDecisionModal(
        null
      );

      setRejectionReason("");
    };

  /* =======================================
     CONFIRMAR DECISIÓN
  ======================================= */

  const confirmDecision =
    async () => {
      const budget =
        decisionModal?.budget;

      if (
        !budget
      ) {
        return;
      }

      const type =
        decisionModal.type;

      try {
        setProcessingBudgetId(
          budget.id
        );

        /* =================================
           ACEPTAR
        ================================= */

        if (
          type ===
          "accept"
        ) {
          const operation =
            acceptBudget(
              budget.id,
              author
            );

          notify.promise(
            operation,
            {
              loadingTitle:
                "Aceptando presupuesto...",

              loadingDescription:
                budget.id,

              successTitle:
                "Presupuesto aceptado",

              successDescription:
                (
                  result
                ) =>
                  result.ticketUpdated
                    ? `${budget.id} aprobado. El Ticket ${result.ticketId} pasó a reparación.`
                    : `${budget.id} fue aprobado correctamente.`,

              errorTitle:
                "No se pudo aceptar",

              errorDescription:
                (
                  operationError
                ) => {
                  if (
                    operationError?.message ===
                    "BUDGET_EXPIRED"
                  ) {
                    return "El presupuesto se encuentra vencido.";
                  }

                  if (
                    operationError?.message ===
                    "BUDGET_NOT_PENDING"
                  ) {
                    return "Este presupuesto ya fue procesado.";
                  }

                  return (
                    operationError?.message ||
                    "Ocurrió un error al aceptar el presupuesto."
                  );
                },
            }
          );

          await operation;
        }

        /* =================================
           RECHAZAR
        ================================= */

        if (
          type ===
          "reject"
        ) {
          const operation =
            rejectBudget(
              budget.id,
              rejectionReason,
              author
            );

          notify.promise(
            operation,
            {
              loadingTitle:
                "Rechazando presupuesto...",

              loadingDescription:
                budget.id,

              successTitle:
                "Presupuesto rechazado",

              successDescription:
                (
                  result
                ) =>
                  result.ticketUpdated
                    ? `${budget.id} rechazado. El Ticket ${result.ticketId} fue actualizado.`
                    : `${budget.id} fue rechazado correctamente.`,

              errorTitle:
                "No se pudo rechazar",

              errorDescription:
                (
                  operationError
                ) => {
                  if (
                    operationError?.message ===
                    "BUDGET_EXPIRED"
                  ) {
                    return "El presupuesto se encuentra vencido.";
                  }

                  if (
                    operationError?.message ===
                    "BUDGET_NOT_PENDING"
                  ) {
                    return "Este presupuesto ya fue procesado.";
                  }

                  return (
                    operationError?.message ||
                    "Ocurrió un error al rechazar el presupuesto."
                  );
                },
            }
          );

          await operation;
        }

        setDecisionModal(
          null
        );

        setRejectionReason("");
      } catch (
        decisionError
      ) {
        console.error(
          decisionError
        );
      } finally {
        setProcessingBudgetId(
          null
        );
      }
    };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="budgets-page">

      {/* =================================
          HEADER
      ================================= */}

      <header className="budgets-header">

        <div className="budgets-header-left">

          <button
            type="button"

            className="budgets-back"

            onClick={() =>
              navigate(
                "/facturacion"
              )
            }

            title="Volver a Facturación"
          >
            <ArrowLeft
              size={20}
            />
          </button>

          <div className="budgets-header-icon">

            <ClipboardList
              size={20}
            />

          </div>

          <div>

            <span>
              Facturación
            </span>

            <h1>
              Presupuestos
            </h1>

          </div>

        </div>

        <motion.button
          type="button"

          className="budgets-new"

          whileHover={{
            y: -1,
          }}

          whileTap={{
            scale: 0.98,
          }}

          onClick={
            handleNewBudget
          }
        >
          <Plus
            size={17}
          />

          Nuevo presupuesto
        </motion.button>

      </header>

      {/* =================================
          CONTENIDO
      ================================= */}

      <div className="budgets-content">

        {/* =================================
            INTRO
        ================================= */}

        <section className="budgets-intro">

          <div>

            <span className="budgets-kicker">
              Gestión comercial
            </span>

            <h2>
              Presupuestos
            </h2>

            <p>
              Presupuestos generados desde tickets y operaciones manuales.
            </p>

          </div>

          <div className="budgets-sync">

            <span />

            <div>

              <strong>
                Sincronizado
              </strong>

              <small>
                Firebase en tiempo real
              </small>

            </div>

          </div>

        </section>

        {/* =================================
            MÉTRICAS
        ================================= */}

        <section className="budgets-stats">

          <article className="budget-stat-card">

            <div>

              <span>
                Total
              </span>

              <FileText
                size={16}
              />

            </div>

            <strong>
              {metrics.total}
            </strong>

            <small>
              Presupuestos registrados
            </small>

          </article>

          <article className="budget-stat-card stat-pending">

            <div>

              <span>
                Pendientes
              </span>

              <Clock3
                size={16}
              />

            </div>

            <strong>
              {metrics.pending}
            </strong>

            <small>
              Esperando respuesta
            </small>

          </article>

          <article className="budget-stat-card stat-accepted">

            <div>

              <span>
                Aceptados
              </span>

              <CheckCircle2
                size={16}
              />

            </div>

            <strong>
              {metrics.accepted}
            </strong>

            <small>
              Aprobados por cliente
            </small>

          </article>

          <article className="budget-stat-card stat-rejected">

            <div>

              <span>
                Rechazados
              </span>

              <XCircle
                size={16}
              />

            </div>

            <strong>
              {metrics.rejected}
            </strong>

            <small>
              No aprobados
            </small>

          </article>

          <article className="budget-stat-card stat-expired">

            <div>

              <span>
                Vencidos
              </span>

              <CalendarDays
                size={16}
              />

            </div>

            <strong>
              {metrics.expired}
            </strong>

            <small>
              Fuera de vigencia
            </small>

          </article>

        </section>

        {/* =================================
            WORKSPACE
        ================================= */}

        <section className="budgets-workspace">

          {/* =================================
              TOOLBAR
          ================================= */}

          <div className="budgets-toolbar">

            <div className="budgets-search">

              <Search
                size={17}
              />

              <input
                type="search"

                placeholder="Buscar presupuesto, cliente o ticket..."

                value={
                  search
                }

                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
              />

              {search && (
                <button
                  type="button"

                  onClick={() =>
                    setSearch("")
                  }

                  aria-label="Limpiar búsqueda"
                >
                  <X
                    size={14}
                  />
                </button>
              )}

            </div>

            <div className="budgets-filters">

              <Filter
                size={15}
              />

              <select
                value={
                  statusFilter
                }

                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Todos los estados
                </option>

                <option value="Pendiente">
                  Pendiente
                </option>

                <option value="En edición">
                  En edición
                </option>

                <option value="Aceptado">
                  Aceptado
                </option>

                <option value="Rechazado">
                  Rechazado
                </option>

                <option value="Facturado">
                  Facturado
                </option>

                <option value="Vencido">
                  Vencido
                </option>

              </select>

              <select
                value={
                  originFilter
                }

                onChange={(event) =>
                  setOriginFilter(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Todos los orígenes
                </option>

                <option value="Ticket">
                  Ticket
                </option>

                <option value="Manual">
                  Manual
                </option>

              </select>

              {hasFilters && (
                <button
                  type="button"

                  className="budgets-clear"

                  onClick={
                    clearFilters
                  }
                >
                  Limpiar
                </button>
              )}

            </div>

          </div>

          {/* =================================
              LAYOUT
          ================================= */}

          <div className="budgets-layout">

            {/* =================================
                LISTA
            ================================= */}

            <section className="budgets-list-panel">

              <div className="budgets-list-title">

                <div>

                  <strong>
                    {filteredBudgets.length}
                  </strong>

                  <span>
                    {filteredBudgets.length === 1
                      ? "presupuesto"
                      : "presupuestos"}
                  </span>

                </div>

              </div>

              {loading && (
                <div className="budgets-state">

                  <div className="budgets-loader" />

                  <strong>
                    Cargando presupuestos
                  </strong>

                  <span>
                    Sincronizando con Firebase...
                  </span>

                </div>
              )}

              {!loading &&
                error && (
                  <div className="budgets-state budgets-error">

                    <strong>
                      No se pudieron cargar
                    </strong>

                    <span>
                      Revisá conexión y permisos.
                    </span>

                  </div>
                )}

              {!loading &&
                !error &&
                filteredBudgets.length === 0 && (
                  <div className="budgets-state">

                    <FileText
                      size={25}
                    />

                    <strong>
                      Sin presupuestos
                    </strong>

                    <span>
                      No encontramos resultados para estos filtros.
                    </span>

                  </div>
                )}

              {!loading &&
                !error &&
                filteredBudgets.map(
                  (
                    budget
                  ) => {
                    const status =
                      getBudgetStatus(
                        budget
                      );

                    const selected =
                      selectedBudgetId ===
                      budget.id;

                    return (
                      <button
                        type="button"

                        key={
                          budget.id
                        }

                        className={
                          `budget-row ${
                            selected
                              ? "active"
                              : ""
                          }`
                        }

                        onClick={() =>
                          setSelectedBudgetId(
                            budget.id
                          )
                        }
                      >

                        <div className="budget-row-main">

                          <div className="budget-row-top">

                            <strong>
                              {budget.id}
                            </strong>

                            <span
                              className={
                                `budget-status ${status.className}`
                              }
                            >
                              {
                                status.label
                              }
                            </span>

                          </div>

                          <h3>
                            {budget.cliente ||
                              "Consumidor Final"}
                          </h3>

                          <div className="budget-row-meta">

                            <span>
                              {budget.origen ||
                                "Manual"}
                            </span>

                            {budget.ticketId && (
                              <>
                                <i />

                                <span>
                                  Ticket{" "}
                                  {
                                    budget.ticketId
                                  }
                                </span>
                              </>
                            )}

                          </div>

                        </div>

                        <div className="budget-row-side">

                          <strong>
                            {formatMoney(
                              budget.total
                            )}
                          </strong>

                          <span>
                            {formatDate(
                              budget.fecha
                            )}
                          </span>

                        </div>

                        <ChevronRight
                          size={17}
                        />

                      </button>
                    );
                  }
                )}

            </section>

            {/* =================================
                DETALLE
            ================================= */}

            <aside className="budget-detail-panel">

              {!selectedBudget ? (
                <div className="budget-detail-empty">

                  <ReceiptText
                    size={28}
                  />

                  <strong>
                    Seleccioná un presupuesto
                  </strong>

                  <span>
                    El detalle aparecerá en este panel.
                  </span>

                </div>
              ) : (
                <BudgetDetail
                  budget={
                    selectedBudget
                  }

                  onOpenTicket={
                    openTicket
                  }

                  onAccept={
                    openAcceptModal
                  }

                  onReject={
                    openRejectModal
                  }

                  busy={
                    processingBudgetId ===
                    selectedBudget.id
                  }
                />
              )}

            </aside>

          </div>

        </section>

      </div>

      {/* =================================
          MODAL
      ================================= */}

      {decisionModal && (
        <div
          className="budget-decision-overlay"

          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              closeDecisionModal();
            }
          }}
        >

          <motion.div
            className="budget-decision-modal"

            initial={{
              opacity: 0,
              scale: 0.96,
              y: 8,
            }}

            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}

            transition={{
              duration: 0.17,
            }}
          >

            <div className="budget-decision-icon">

              {decisionModal.type ===
              "accept" ? (
                <CheckCircle2
                  size={22}
                />
              ) : (
                <XCircle
                  size={22}
                />
              )}

            </div>

            <div className="budget-decision-copy">

              <span>
                {decisionModal.budget.id}
              </span>

              <h3>
                {decisionModal.type ===
                "accept"
                  ? "Aceptar presupuesto"
                  : "Rechazar presupuesto"}
              </h3>

              <p>
                {decisionModal.type ===
                "accept"
                  ? "El presupuesto quedará aprobado. Si nació desde un Ticket, el Ticket también será actualizado."
                  : "El presupuesto quedará rechazado. Si está vinculado a un Ticket, también se actualizará su estado."}
              </p>

            </div>

            <div className="budget-decision-summary">

              <div>

                <span>
                  Cliente
                </span>

                <strong>
                  {decisionModal.budget.cliente ||
                    "Consumidor Final"}
                </strong>

              </div>

              <div>

                <span>
                  Total
                </span>

                <strong>
                  {formatMoney(
                    decisionModal.budget.total
                  )}
                </strong>

              </div>

            </div>

            {decisionModal.type ===
              "reject" && (
              <label className="budget-rejection-field">

                <span>
                  Motivo del rechazo
                </span>

                <textarea
                  placeholder="Opcional..."

                  value={
                    rejectionReason
                  }

                  disabled={
                    Boolean(
                      processingBudgetId
                    )
                  }

                  onChange={(event) =>
                    setRejectionReason(
                      event.target.value
                    )
                  }
                />

              </label>
            )}

            <div className="budget-decision-actions">

              <button
                type="button"

                className="budget-decision-cancel"

                disabled={
                  Boolean(
                    processingBudgetId
                  )
                }

                onClick={
                  closeDecisionModal
                }
              >
                Cancelar
              </button>

              <button
                type="button"

                className={
                  decisionModal.type ===
                  "accept"
                    ? "budget-decision-confirm accept"
                    : "budget-decision-confirm reject"
                }

                disabled={
                  Boolean(
                    processingBudgetId
                  )
                }

                onClick={
                  confirmDecision
                }
              >

                {decisionModal.type ===
                "accept" ? (
                  <CheckCircle2
                    size={16}
                  />
                ) : (
                  <XCircle
                    size={16}
                  />
                )}

                {processingBudgetId
                  ? "Procesando..."
                  : decisionModal.type ===
                    "accept"
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

/* =========================================
   DETALLE
========================================= */

function BudgetDetail({
  budget,
  onOpenTicket,
  onAccept,
  onReject,
  busy,
}) {
  const status =
    getBudgetStatus(
      budget
    );

  const items =
    Array.isArray(
      budget.items
    )
      ? budget.items
      : [];

  const history =
    Array.isArray(
      budget.historial
    )
      ? [
          ...budget.historial,
        ].reverse()
      : [];

  const discount =
    Number(
      budget.descuento ||
      budget.descuentoImporte ||
      0
    );

  const canDecide =
    status.label ===
    "Pendiente";

  return (
    <div className="budget-detail">

      {/* HEADER */}

      <div className="budget-detail-header">

        <div>

          <span>
            Presupuesto
          </span>

          <h2>
            {budget.id}
          </h2>

        </div>

        <span
          className={
            `budget-status ${status.className}`
          }
        >
          {status.label}
        </span>

      </div>

      {/* ACEPTAR / RECHAZAR */}

      {canDecide && (
        <div className="budget-detail-actions">

          <button
            type="button"

            className="budget-accept-button"

            disabled={
              busy
            }

            onClick={() =>
              onAccept(
                budget
              )
            }
          >
            <CheckCircle2
              size={15}
            />

            Aceptar
          </button>

          <button
            type="button"

            className="budget-reject-button"

            disabled={
              busy
            }

            onClick={() =>
              onReject(
                budget
              )
            }
          >
            <XCircle
              size={15}
            />

            Rechazar
          </button>

        </div>
      )}

      {/* CLIENTE */}

      <div className="budget-detail-section">

        <span className="budget-detail-label">
          Cliente
        </span>

        <div className="budget-client">

          <div>

            <UserRound
              size={17}
            />

          </div>

          <div>

            <strong>
              {budget.cliente ||
                "Consumidor Final"}
            </strong>

            <span>
              {budget.doc ||
                "C.F."}
            </span>

          </div>

        </div>

      </div>

      {/* DATOS */}

      <div className="budget-detail-grid">

        <div>

          <span>
            Fecha
          </span>

          <strong>
            {formatDate(
              budget.fecha
            )}
          </strong>

        </div>

        <div>

          <span>
            Vencimiento
          </span>

          <strong>
            {formatDate(
              budget.fechaVencimiento
            )}
          </strong>

        </div>

        <div>

          <span>
            Origen
          </span>

          <strong>
            {budget.origen ||
              "Manual"}
          </strong>

        </div>

        <div>

          <span>
            Usuario
          </span>

          <strong>
            {budget.usuario ||
              "Sistema"}
          </strong>

        </div>

      </div>

      {/* TICKET */}

      {budget.ticketId && (
        <button
          type="button"

          className="budget-ticket-link"

          onClick={() =>
            onOpenTicket(
              budget.ticketId
            )
          }
        >
          <Ticket
            size={16}
          />

          <div>

            <span>
              Ticket asociado
            </span>

            <strong>
              {budget.ticketId}
            </strong>

          </div>

          <Link2
            size={15}
          />

        </button>
      )}

      {/* CONCEPTOS */}

      <div className="budget-detail-section">

        <span className="budget-detail-label">
          Conceptos
        </span>

        {items.length === 0 ? (
          <div className="budget-no-items">
            Sin conceptos registrados.
          </div>
        ) : (
          <div className="budget-items">

            {items.map(
              (
                item,
                index
              ) => (
                <div
                  key={
                    `${item.descripcion}-${index}`
                  }

                  className="budget-item"
                >

                  <div>

                    <strong>
                      {item.descripcion ||
                        "Concepto"}
                    </strong>

                    <span>
                      {Number(
                        item.cantidad ||
                        0
                      )}{" "}
                      ×{" "}
                      {formatMoney(
                        item.precio
                      )}
                    </span>

                  </div>

                  <strong>
                    {formatMoney(
                      item.subtotal ??
                      Number(
                        item.cantidad ||
                        0
                      ) *
                      Number(
                        item.precio ||
                        0
                      )
                    )}
                  </strong>

                </div>
              )
            )}

          </div>
        )}

      </div>

      {/* TOTALES */}

      <div className="budget-totals">

        <div>

          <span>
            Subtotal
          </span>

          <strong>
            {formatMoney(
              budget.subtotal
            )}
          </strong>

        </div>

        {discount > 0 && (
          <div className="budget-total-discount">

            <span>
              Descuento
              {Number(
                budget.descuentoPorcentaje ||
                0
              ) > 0 &&
                ` (${budget.descuentoPorcentaje}%)`}
            </span>

            <strong>
              -{" "}
              {formatMoney(
                discount
              )}
            </strong>

          </div>
        )}

        <div className="budget-total-final">

          <span>
            Total
          </span>

          <strong>
            {formatMoney(
              budget.total
            )}
          </strong>

        </div>

      </div>

      {/* OBSERVACIONES */}

      {budget.observaciones && (
        <div className="budget-detail-section">

          <span className="budget-detail-label">
            Observaciones
          </span>

          <p className="budget-observations">
            {budget.observaciones}
          </p>

        </div>
      )}

      {/* HISTORIAL */}

      <div className="budget-detail-section">

        <span className="budget-detail-label">
          Actividad
        </span>

        {history.length === 0 ? (
          <div className="budget-no-items">
            Sin actividad registrada.
          </div>
        ) : (
          <div className="budget-history">

            {history
              .slice(
                0,
                8
              )
              .map(
                (
                  event,
                  index
                ) => (
                  <article
                    key={
                      `${event.fecha || "evento"}-${index}`
                    }
                  >

                    <div className="budget-history-dot" />

                    <div>

                      <div>

                        <strong>
                          {event.accion ||
                            "Actividad"}
                        </strong>

                        <span>
                          {event.fecha ||
                            "—"}
                        </span>

                      </div>

                      {event.detalle && (
                        <p>
                          {event.detalle}
                        </p>
                      )}

                    </div>

                  </article>
                )
              )}

          </div>
        )}

      </div>

    </div>
  );
}