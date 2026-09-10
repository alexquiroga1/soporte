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
  ChevronRight,
  ClipboardList,
  Columns3,
  Filter,
  LayoutList,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import {
  subscribeToTickets,
} from "../../services/tickets.service.js";

import {
  notify,
} from "../../services/notifications.js";

import NewTicketModal from "./NewTicketModal.jsx";

import "./Tickets.css";

/* =========================================
   ESTADOS
========================================= */

const TICKET_STAGES = {
  pendiente: {
    label: "Recibido",
    className: "stage-pending",
  },

  diagnostico: {
    label: "En diagnóstico",
    className: "stage-diagnostic",
  },

  presupuesto: {
    label: "Esperando aprobación",
    className: "stage-budget",
  },

  reparacion: {
    label: "En reparación",
    className: "stage-repair",
  },

  repuesto: {
    label: "Esperando repuesto",
    className: "stage-part",
  },

  listo: {
    label: "Listo para entrega",
    className: "stage-ready",
  },

  entregado: {
    label: "Entregado",
    className: "stage-delivered",
  },

  noreparable: {
    label: "No reparable",
    className: "stage-danger",
  },

  cancelado: {
    label: "Cancelado / Retirado",
    className: "stage-cancelled",
  },

  garantia: {
    label: "Garantía",
    className: "stage-warranty",
  },
};

/* =========================================
   HELPERS
========================================= */

function getStage(stage) {
  return (
    TICKET_STAGES[stage] || {
      label:
        stage ||
        "Sin estado",

      className:
        "stage-cancelled",
    }
  );
}

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
      value ||
      0
    )
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function Tickets() {
  const navigate =
    useNavigate();

  const [
    tickets,
    setTickets,
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
    newTicketOpen,
    setNewTicketOpen,
  ] = useState(false);

  /* =======================================
     FILTROS
  ======================================= */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    stageFilter,
    setStageFilter,
  ] = useState("");

  const [
    priorityFilter,
    setPriorityFilter,
  ] = useState("");

  const [
    technicianFilter,
    setTechnicianFilter,
  ] = useState("");

  const [
    filtersOpen,
    setFiltersOpen,
  ] = useState(false);

  /* =======================================
     FIREBASE
  ======================================= */

  useEffect(() => {
    setLoading(true);

    const unsubscribe =
      subscribeToTickets(
        (data) => {
          setTickets(data);

          setError(null);

          setLoading(false);
        },

        (firebaseError) => {
          console.error(
            firebaseError
          );

          setError(
            firebaseError
          );

          setLoading(false);

          notify.error(
            "No pudimos cargar los tickets",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     TÉCNICOS
  ======================================= */

  const technicians =
    useMemo(() => {
      const values =
        tickets
          .map(
            (ticket) =>
              ticket.tecnico
          )
          .filter(Boolean)
          .filter(
            (technician) =>
              technician !==
              "Sin asignar"
          );

      return [
        ...new Set(values),
      ].sort();
    }, [tickets]);

  /* =======================================
     FILTRADO
  ======================================= */

  const filteredTickets =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return tickets.filter(
        (ticket) => {
          const source = [
            ticket.id,
            ticket.cliente,
            ticket.equipo,
            ticket.marca,
            ticket.modelo,
            ticket.serie,
            ticket.tecnico,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            source.includes(
              query
            );

          const matchesStage =
            !stageFilter ||
            ticket.stage ===
            stageFilter;

          const matchesPriority =
            !priorityFilter ||
            ticket.prioridad ===
            priorityFilter;

          const matchesTechnician =
            !technicianFilter ||
            ticket.tecnico ===
            technicianFilter;

          return (
            matchesSearch &&
            matchesStage &&
            matchesPriority &&
            matchesTechnician
          );
        }
      );
    }, [
      tickets,
      search,
      stageFilter,
      priorityFilter,
      technicianFilter,
    ]);

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(() => {
      const closedStages = [
        "entregado",
        "cancelado",
        "noreparable",
      ];

      return {
        total:
          tickets.length,

        active:
          tickets.filter(
            (ticket) =>
              !closedStages.includes(
                ticket.stage
              )
          ).length,

        diagnostic:
          tickets.filter(
            (ticket) =>
              ticket.stage ===
              "diagnostico"
          ).length,

        ready:
          tickets.filter(
            (ticket) =>
              ticket.stage ===
              "listo"
          ).length,

        p1:
          tickets.filter(
            (ticket) =>
              ticket.prioridad ===
              "P1"
          ).length,
      };
    }, [tickets]);

  /* =======================================
     FILTROS ACTIVOS
  ======================================= */

  const hasActiveFilters =
    Boolean(
      search ||
      stageFilter ||
      priorityFilter ||
      technicianFilter
    );

  const clearFilters =
    () => {
      setSearch("");

      setStageFilter("");

      setPriorityFilter("");

      setTechnicianFilter("");
    };

  /* =======================================
     ACCIONES
  ======================================= */

  const openTicket =
    (ticket) => {
      navigate(
        `/tickets/${ticket.id}`
      );
    };

  const handleNewTicket =
    () => {
      setNewTicketOpen(
        true
      );
    };

  const handleKanban =
    () => {
      notify.info(
        "Vista Kanban",
        "La activaremos con cambio de estado mediante drag & drop."
      );
    };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="tickets-page">

      {/* =================================
          HEADER
      ================================= */}

      <header className="tickets-header">

        <div className="tickets-header-left">

          <button
            type="button"
            className="tickets-back-button"
            onClick={() =>
              navigate(
                "/dashboard"
              )
            }
            aria-label="Volver al Dashboard"
          >
            <ArrowLeft
              size={19}
            />
          </button>

          <div className="tickets-header-icon">
            <ClipboardList
              size={21}
            />
          </div>

          <div className="tickets-header-copy">

            <span>
              Soporte técnico
            </span>

            <h1>
              Tickets
            </h1>

          </div>

        </div>

        <motion.button
          type="button"
          className="tickets-new-button"
          whileHover={{
            y: -1,
          }}
          whileTap={{
            scale: 0.98,
          }}
          onClick={
            handleNewTicket
          }
        >
          <Plus
            size={17}
          />

          <span>
            Nuevo ticket
          </span>
        </motion.button>

      </header>

      {/* =================================
          CONTENT
      ================================= */}

      <div className="tickets-content">

        {/* =================================
            INTRO
        ================================= */}

        <section className="tickets-intro">

          <div>

            <span className="tickets-intro-kicker">
              Centro de operaciones
            </span>

            <h2>
              Tickets de soporte
            </h2>

            <p>
              Seguimiento de ingresos, diagnósticos,
              reparaciones y entregas.
            </p>

          </div>

          <div className="tickets-sync">

            <span className="tickets-sync-dot" />

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
            STATS
        ================================= */}

        <section className="tickets-stats">

          <article className="ticket-stat-card">

            <div className="ticket-stat-label">
              <span>
                Total
              </span>

              <small>
                Todos
              </small>
            </div>

            <strong>
              {metrics.total}
            </strong>

            <p>
              Tickets registrados
            </p>

          </article>

          <article className="ticket-stat-card stat-active">

            <div className="ticket-stat-label">
              <span>
                Activos
              </span>

              <small>
                En curso
              </small>
            </div>

            <strong>
              {metrics.active}
            </strong>

            <p>
              Trabajos pendientes
            </p>

          </article>

          <article className="ticket-stat-card stat-diagnostic">

            <div className="ticket-stat-label">
              <span>
                Diagnóstico
              </span>

              <small>
                Taller
              </small>
            </div>

            <strong>
              {metrics.diagnostic}
            </strong>

            <p>
              En revisión técnica
            </p>

          </article>

          <article className="ticket-stat-card stat-ready">

            <div className="ticket-stat-label">
              <span>
                Listos
              </span>

              <small>
                Entrega
              </small>
            </div>

            <strong>
              {metrics.ready}
            </strong>

            <p>
              Esperando al cliente
            </p>

          </article>

          <article className="ticket-stat-card stat-priority">

            <div className="ticket-stat-label">
              <span>
                Prioridad
              </span>

              <small>
                P1
              </small>
            </div>

            <strong>
              {metrics.p1}
            </strong>

            <p>
              Requieren atención
            </p>

          </article>

        </section>

        {/* =================================
            WORKSPACE
        ================================= */}

        <section className="tickets-workspace">

          {/* TOOLBAR */}

          <div className="tickets-toolbar">

            <div className="tickets-search">

              <Search
                size={17}
              />

              <input
                type="search"
                placeholder="Buscar ticket, cliente, equipo, serie..."
                value={search}
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

            <div className="tickets-toolbar-right">

              <div className="tickets-view-switch">

                <button
                  type="button"
                  className="active"
                >
                  <LayoutList
                    size={15}
                  />

                  <span>
                    Listado
                  </span>
                </button>

                <button
                  type="button"
                  onClick={
                    handleKanban
                  }
                >
                  <Columns3
                    size={15}
                  />

                  <span>
                    Kanban
                  </span>
                </button>

              </div>

              <button
                type="button"
                className={
                  `tickets-filter-toggle ${filtersOpen
                    ? "active"
                    : ""
                  }`
                }
                onClick={() =>
                  setFiltersOpen(
                    (current) =>
                      !current
                  )
                }
              >
                <SlidersHorizontal
                  size={15}
                />

                Filtros
              </button>

            </div>

          </div>

          {/* =================================
              FILTERS
          ================================= */}

          <div
            className={
              `tickets-filters-panel ${filtersOpen
                ? "open"
                : ""
              }`
            }
          >

            <div className="tickets-filter-title">

              <div>
                <Filter
                  size={14}
                />

                <span>
                  Filtrar tickets
                </span>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={
                    clearFilters
                  }
                >
                  Limpiar
                </button>
              )}

            </div>

            <div className="tickets-filter-grid">

              <label>

                <span>
                  Estado
                </span>

                <select
                  value={
                    stageFilter
                  }
                  onChange={(event) =>
                    setStageFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Todos
                  </option>

                  {Object.entries(
                    TICKET_STAGES
                  ).map(
                    ([
                      key,
                      item,
                    ]) => (
                      <option
                        key={key}
                        value={key}
                      >
                        {item.label}
                      </option>
                    )
                  )}

                </select>

              </label>

              <label>

                <span>
                  Prioridad
                </span>

                <select
                  value={
                    priorityFilter
                  }
                  onChange={(event) =>
                    setPriorityFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Todas
                  </option>

                  <option value="P1">
                    P1 · Alta
                  </option>

                  <option value="P2">
                    P2 · Media
                  </option>

                  <option value="P3">
                    P3 · Normal
                  </option>
                </select>

              </label>

              <label>

                <span>
                  Técnico
                </span>

                <select
                  value={
                    technicianFilter
                  }
                  onChange={(event) =>
                    setTechnicianFilter(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Todos
                  </option>

                  {technicians.map(
                    (technician) => (
                      <option
                        key={
                          technician
                        }
                        value={
                          technician
                        }
                      >
                        {technician}
                      </option>
                    )
                  )}

                </select>

              </label>

            </div>

          </div>

          {/* RESULTS */}

          <div className="tickets-results">

            <div>
              <strong>
                {filteredTickets.length}
              </strong>

              <span>
                {filteredTickets.length === 1
                  ? "ticket"
                  : "tickets"}
              </span>

              {hasActiveFilters && (
                <small>
                  de {tickets.length}
                </small>
              )}
            </div>

            <span className="tickets-realtime">

              <RefreshCw
                size={12}
              />

              Actualización automática

            </span>

          </div>

          {/* =================================
              LOADING
          ================================= */}

          {loading && (
            <div className="tickets-state">

              <RefreshCw
                className="tickets-spinner"
                size={25}
              />

              <strong>
                Cargando tickets
              </strong>

              <span>
                Sincronizando con Firebase...
              </span>

            </div>
          )}

          {/* ERROR */}

          {!loading &&
            error && (
              <div className="tickets-state tickets-error">

                <strong>
                  No pudimos cargar los tickets
                </strong>

                <span>
                  Revisá la conexión o los permisos.
                </span>

              </div>
            )}

          {/* =================================
              LIST
          ================================= */}

          {!loading &&
            !error && (
              <div className="tickets-list">

                {filteredTickets.length === 0 ? (
                  <div className="tickets-empty">

                    <div>
                      <Search
                        size={22}
                      />
                    </div>

                    <strong>
                      No encontramos tickets
                    </strong>

                    <span>
                      Probá modificando la búsqueda o los filtros.
                    </span>

                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={
                          clearFilters
                        }
                      >
                        Limpiar filtros
                      </button>
                    )}

                  </div>
                ) : (
                  filteredTickets.map(
                    (
                      ticket,
                      index
                    ) => {
                      const stage =
                        getStage(
                          ticket.stage
                        );

                      const priority =
                        ticket.prioridad ||
                        "P2";

                      const device = [
                        ticket.equipo,
                        ticket.marca,
                        ticket.modelo,
                      ]
                        .filter(Boolean)
                        .join(" · ");

                      return (
                        <motion.article
                          key={
                            ticket.id
                          }
                          className="ticket-row"
                          initial={{
                            opacity: 0,
                            y: 4,
                          }}
                          animate={{
                            opacity: 1,
                            y: 0,
                          }}
                          transition={{
                            delay:
                              Math.min(
                                index *
                                0.015,
                                0.18
                              ),
                          }}
                          onClick={() =>
                            openTicket(
                              ticket
                            )
                          }
                        >

                          <div className="ticket-row-priority">

                            <span
                              className={
                                `priority-badge priority-${priority.toLowerCase()}`
                              }
                            >
                              {priority}
                            </span>

                          </div>

                          <div className="ticket-row-main">

                            <div className="ticket-row-top">

                              <strong className="ticket-number">
                                #{ticket.id}
                              </strong>

                              <span
                                className={
                                  `ticket-stage ${stage.className}`
                                }
                              >
                                {stage.label}
                              </span>

                            </div>

                            <h3>
                              {ticket.cliente ||
                                "Sin cliente"}
                            </h3>

                            <div className="ticket-device">

                              <Wrench
                                size={13}
                              />

                              <span>
                                {device ||
                                  "Equipo sin especificar"}
                              </span>

                            </div>

                          </div>

                          <div className="ticket-row-data">

                            <span>
                              Ingreso
                            </span>

                            <strong>
                              {ticket.ingreso ||
                                "—"}
                            </strong>

                          </div>

                          <div className="ticket-row-data">

                            <span>
                              Presupuesto
                            </span>

                            {ticket.presupuestoFijado ? (
                              <strong className="ticket-money">
                                {formatMoney(
                                  ticket.presupuestoEstimado
                                )}
                              </strong>
                            ) : (
                              <strong className="ticket-pending">
                                Pendiente
                              </strong>
                            )}

                          </div>

                          <div className="ticket-row-data ticket-technician">

                            <span>
                              Técnico
                            </span>

                            <strong>
                              <UserRound
                                size={12}
                              />

                              {ticket.tecnico ||
                                "Sin asignar"}
                            </strong>

                          </div>

                          <button
                            type="button"
                            className="ticket-open"
                            onClick={(event) => {
                              event.stopPropagation();

                              openTicket(
                                ticket
                              );
                            }}
                            aria-label={
                              `Abrir ticket ${ticket.id}`
                            }
                          >
                            <ChevronRight
                              size={18}
                            />
                          </button>

                        </motion.article>
                      );
                    }
                  )
                )}

              </div>
            )}

        </section>

           </div>

      <NewTicketModal
        open={
          newTicketOpen
        }

        technicians={
          technicians
        }

        onClose={() =>
          setNewTicketOpen(
            false
          )
        }

        onCreated={(
          ticket
        ) => {
          setNewTicketOpen(
            false
          );

          navigate(
            `/tickets/${ticket.id}`
          );
        }}
      />

    </main>
  );
}