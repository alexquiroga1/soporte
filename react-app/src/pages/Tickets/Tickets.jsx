import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  Clock3,
  Download,
  Eye,
  Filter,
  Laptop,
  Columns3,
  Package,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import { subscribeToTickets } from "../../services/tickets.service.js";
import { cleanupTicketsFromDeletedClients } from "../../services/client-audit.service.js";
import { PERMISSIONS, profileHasPermission } from "../../security/permissions.js";
import { notify } from "../../services/notifications.js";
import { useAuth } from "../../context/AuthContext.jsx";

import ticketsHero from "./assets/tickets-hero.png";
import { toLocalISODate } from "../../utils/date.js";

import "./Tickets.css";

const TICKET_STAGES = {
  pendiente_ingreso: {
    label: "Pendiente de ingreso",
    shortLabel: "Pendiente",
    className: "stage-awaiting",
    icon: Clock3,
  },
  pendiente: {
    label: "Recepción",
    shortLabel: "Recepción",
    className: "stage-pending",
    icon: ClipboardList,
  },
  diagnostico: {
    label: "En diagnóstico",
    shortLabel: "Diagnóstico",
    className: "stage-diagnostic",
    icon: Search,
  },
  presupuesto: {
    label: "Presupuesto",
    shortLabel: "Presupuesto",
    className: "stage-budget",
    icon: ClipboardList,
  },
  presupuesto_rechazado: {
    label: "Presupuesto rechazado",
    shortLabel: "Rechazado",
    className: "stage-danger",
    icon: AlertTriangle,
  },
  reparacion: {
    label: "En reparación",
    shortLabel: "Reparación",
    className: "stage-repair",
    icon: Wrench,
  },
  repuesto: {
    label: "Esperando repuesto",
    shortLabel: "Repuesto",
    className: "stage-part",
    icon: Package,
  },
  listo: {
    label: "Listo para entrega",
    shortLabel: "Listo",
    className: "stage-ready",
    icon: CheckCircle2,
  },
  entregado: {
    label: "Entregado",
    shortLabel: "Entregado",
    className: "stage-delivered",
    icon: Package,
  },
  garantia: {
    label: "Garantía",
    shortLabel: "Garantía",
    className: "stage-warranty",
    icon: ShieldAlert,
  },
  noreparable: {
    label: "No reparable",
    shortLabel: "No reparable",
    className: "stage-danger",
    icon: AlertTriangle,
  },
  cancelado: {
    label: "Cancelado / Retirado",
    shortLabel: "Cancelado",
    className: "stage-cancelled",
    icon: X,
  },
};

const PREVIEW_FLOW = [
  "pendiente_ingreso",
  "pendiente",
  "diagnostico",
  "presupuesto",
  "reparacion",
  "repuesto",
  "listo",
  "entregado",
];

function getStage(stage) {
  return (
    TICKET_STAGES[stage] || {
      label: stage || "Sin estado",
      shortLabel: stage || "Sin estado",
      className: "stage-cancelled",
      icon: CircleDot,
    }
  );
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function getTicketDevice(ticket) {
  return [ticket?.equipo, ticket?.marca, ticket?.modelo]
    .filter(Boolean)
    .join(" · ");
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) return "--";

  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");
}

function getPriorityMeta(priority) {
  const normalized = String(priority || "P2").toUpperCase();

  if (normalized === "P1") {
    return { label: "Alta", className: "high", icon: ArrowUp };
  }

  if (normalized === "P3") {
    return { label: "Baja", className: "low", icon: ArrowRight };
  }

  return { label: "Media", className: "medium", icon: AlertTriangle };
}

function StageBadge({ stageKey, compact = false }) {
  const stage = getStage(stageKey);
  const Icon = stage.icon;
  const isAnimated = ["pendiente_ingreso", "diagnostico", "reparacion", "repuesto", "listo"].includes(stageKey);

  return (
    <motion.span
      className={`ticket-stage ticket-stage-motion ${stage.className} ${compact ? "compact" : ""}`}
      animate={
        isAnimated
          ? { y: [0, -1.5, 0], scale: [1, 1.018, 1] }
          : { y: 0, scale: 1 }
      }
      transition={{ duration: 2.15, repeat: Infinity, ease: "easeInOut" }}
    >
      <motion.span
        className="ticket-stage-icon"
        animate={
          stageKey === "reparacion"
            ? { rotate: [0, -9, 9, 0] }
            : stageKey === "listo"
              ? { scale: [1, 1.13, 1] }
              : { opacity: [0.78, 1, 0.78] }
        }
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon size={compact ? 13 : 14} />
      </motion.span>
      {stage.label}
    </motion.span>
  );
}

function ProgressStage({ stageKey, currentStage, index, currentIndex }) {
  const stage = getStage(stageKey);
  const Icon = stage.icon;
  const isDone = currentIndex >= 0 && index < currentIndex;
  const isCurrent = stageKey === currentStage;

  return (
    <div className={`tickets-preview-step ${isDone ? "done" : ""} ${isCurrent ? "current" : ""}`}>
      <motion.span
        className="tickets-preview-step-marker"
        animate={
          isCurrent
            ? { scale: [1, 1.14, 1], boxShadow: ["0 0 0 0 rgba(35,104,255,.16)", "0 0 0 9px rgba(35,104,255,0)", "0 0 0 0 rgba(35,104,255,0)"] }
            : {}
        }
        transition={{ duration: 1.65, repeat: Infinity, ease: "easeOut" }}
      >
        {isDone ? <CheckCircle2 size={16} /> : <Icon size={15} />}
      </motion.span>
      <strong>{stage.shortLabel}</strong>
      <small>{isDone ? "Completado" : isCurrent ? "En curso" : "Pendiente"}</small>
    </div>
  );
}

export default function Tickets() {
  const navigate = useNavigate();
  const summaryRef = useRef(null);
  const { profile, user } = useAuth();

  const author = profile?.nombre || profile?.name || user?.email || "Sistema";
  const canAudit = profileHasPermission(profile, PERMISSIONS.ALL);

  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [technicianFilter, setTechnicianFilter] = useState("");
  const [deviceFilter, setDeviceFilter] = useState("");
  const [view, setView] = useState("table");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState(null);

  const [cleanupOpen, setCleanupOpen] = useState(false);
  const [cleanupConfirm, setCleanupConfirm] = useState("");
  const [cleaningOrphans, setCleaningOrphans] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToTickets(
      (data) => {
        setTickets(data);
        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        console.error(firebaseError);
        setError(firebaseError);
        setLoading(false);
        notify.error(
          "No pudimos cargar los tickets",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const technicians = useMemo(() => {
    const values = tickets
      .map((ticket) => ticket.tecnico)
      .filter(Boolean)
      .filter((technician) => technician !== "Sin asignar");

    return [...new Set(values)].sort((a, b) => a.localeCompare(b, "es"));
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const source = [
        ticket.id,
        ticket.cliente,
        ticket.clienteId,
        ticket.equipo,
        ticket.marca,
        ticket.modelo,
        ticket.falla,
        ticket.tecnico,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || source.includes(query)) &&
        (!stageFilter || ticket.stage === stageFilter) &&
        (!priorityFilter || ticket.prioridad === priorityFilter) &&
        (!technicianFilter || ticket.tecnico === technicianFilter) &&
        (!deviceFilter || ticket.equipo === deviceFilter)
      );
    });
  }, [tickets, search, stageFilter, priorityFilter, technicianFilter, deviceFilter]);

  const deviceTypes = [...new Set(tickets.map((ticket) => ticket.equipo).filter(Boolean))].sort();

  const metrics = useMemo(
    () => ({
      total: tickets.length,
      awaiting: tickets.filter((ticket) => ticket.stage === "pendiente_ingreso").length,
      received: tickets.filter((ticket) => ticket.stage === "pendiente").length,
      diagnostic: tickets.filter((ticket) => ticket.stage === "diagnostico").length,
      repair: tickets.filter((ticket) => ticket.stage === "reparacion").length,
      parts: tickets.filter((ticket) => ticket.stage === "repuesto").length,
      ready: tickets.filter((ticket) => ticket.stage === "listo").length,
      delivered: tickets.filter((ticket) => ticket.stage === "entregado").length,
      urgent: tickets.filter((ticket) => ticket.prioridad === "P1").length,
    }),
    [tickets]
  );

  const selectedTicket = useMemo(
    () => filteredTickets.find((ticket) => ticket.id === selectedTicketId) || filteredTickets[0] || null,
    [filteredTickets, selectedTicketId]
  );

  const hasActiveFilters = Boolean(search || stageFilter || priorityFilter || technicianFilter || deviceFilter);

  const clearFilters = () => {
    setSearch("");
    setStageFilter("");
    setPriorityFilter("");
    setTechnicianFilter("");
    setDeviceFilter("");
  };

  const openTicket = (ticket) => navigate(`/tickets/${ticket.id}`);
  const handleNewTicket = () => navigate("/tickets/nuevo");

  const showTicketSummary = (ticket) => {
    setSelectedTicketId(ticket.id);
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    });
  };

  const handleExport = () => {
    const rows = [
      ["Ticket", "Cliente", "Equipo", "Estado", "Prioridad", "Tecnico", "Presupuesto", "Ingreso"],
      ...filteredTickets.map((ticket) => [
        ticket.id || "",
        ticket.cliente || "",
        getTicketDevice(ticket),
        getStage(ticket.stage).label,
        getPriorityMeta(ticket.prioridad).label,
        ticket.tecnico || "",
        Number(ticket.presupuestoEstimado || 0),
        ticket.ingreso || "",
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`).join(";"))
      .join("\n");

    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `tickets-${toLocalISODate()}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCleanupOrphans = async () => {
    if (!canAudit || cleaningOrphans) return;

    if (cleanupConfirm.trim().toUpperCase() !== "LIMPIAR") {
      notify.warning("Confirmación requerida", "Escribí LIMPIAR para ejecutar la limpieza.");
      return;
    }

    setCleaningOrphans(true);

    try {
      const result = await cleanupTicketsFromDeletedClients({
        author,
        actorUid: user?.uid || null,
      });

      const count = Number(result?.deletedTickets || 0);

      notify.success(
        count > 0 ? "Tickets huérfanos eliminados" : "Sin tickets huérfanos",
        count > 0
          ? `Se eliminaron ${count} ${count === 1 ? "ticket" : "tickets"} de clientes ya eliminados.`
          : "No encontramos tickets pendientes de limpieza."
      );

      setCleanupOpen(false);
      setCleanupConfirm("");
    } catch (cleanupError) {
      console.error(cleanupError);
      notify.error(
        "No se pudo completar la limpieza",
        "Revisá los permisos de Firestore e intentá nuevamente."
      );
    } finally {
      setCleaningOrphans(false);
    }
  };

  const previewCurrentIndex = selectedTicket
    ? PREVIEW_FLOW.indexOf(selectedTicket.stage === "presupuesto_rechazado" ? "presupuesto" : selectedTicket.stage)
    : -1;

  return (
    <main className="tickets-page">
      <div className="tickets-shell">
        <motion.section
          className="tickets-hero tickets-hero-dom"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button type="button" className="tickets-back-pill" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={17} />
            Volver al Menú
          </button>

          <div className="tickets-hero-copy">
            <motion.div
              className="tickets-hero-mark tickets-hero-mark-3d"
              animate={{ y: [0, -4, 0], rotate: [0, -2, 1, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              <ClipboardList size={34} />
            </motion.div>
            <div>
              <h1>Tickets</h1>
              <p>Gestioná ingresos, diagnósticos, estados y entregas.</p>
            </div>
          </div>

          <div className="tickets-hero-art" aria-hidden="true"><img src={ticketsHero} alt="" /></div>
          <div className="tickets-hero-quote"><span>“Soporte hoy,</span><strong>tranquilidad mañana”</strong></div>

          {canAudit && (
            <button
              type="button"
              className="tickets-audit-cleanup-button"
              onClick={() => {
                setCleanupConfirm("");
                setCleanupOpen(true);
              }}
              title="Eliminar tickets pertenecientes a clientes que ya fueron eliminados"
            >
              <ShieldAlert size={15} />
              Auditoría
            </button>
          )}
        </motion.section>

        <section className="tickets-stats tickets-stats-six">
          <motion.article className="ticket-stat-card tone-violet" whileHover={{ y: -4 }}>
            <div className="ticket-stat-icon"><ClipboardList size={25} /></div>
            <div><span>Tickets Totales</span><strong>{metrics.total}</strong><small>Seguimiento general</small></div>
          </motion.article>
          <motion.article className="ticket-stat-card tone-orange" whileHover={{ y: -4 }}>
            <div className="ticket-stat-icon"><Search size={25} /></div>
            <div><span>En diagnóstico</span><strong>{metrics.diagnostic}</strong><small>{metrics.total ? Math.round((metrics.diagnostic / metrics.total) * 100) : 0}% del total</small></div>
          </motion.article>
          <motion.article className="ticket-stat-card tone-blue" whileHover={{ y: -4 }}>
            <div className="ticket-stat-icon"><Wrench size={25} /></div>
            <div><span>En reparación</span><strong>{metrics.repair}</strong><small>{metrics.total ? Math.round((metrics.repair / metrics.total) * 100) : 0}% del total</small></div>
          </motion.article>
          <motion.article className="ticket-stat-card tone-green" whileHover={{ y: -4 }}>
            <div className="ticket-stat-icon"><CheckCircle2 size={25} /></div>
            <div><span>Listos para entrega</span><strong>{metrics.ready}</strong><small>{metrics.total ? Math.round((metrics.ready / metrics.total) * 100) : 0}% del total</small></div>
          </motion.article>
          <motion.article className="ticket-stat-card tone-cyan" whileHover={{ y: -4 }}>
            <div className="ticket-stat-icon"><Package size={25} /></div>
            <div><span>Entregados</span><strong>{metrics.delivered}</strong><small>{metrics.total ? Math.round((metrics.delivered / metrics.total) * 100) : 0}% del total</small></div>
          </motion.article>
          <motion.article className="ticket-stat-card tone-red" whileHover={{ y: -4 }}>
            <div className="ticket-stat-icon"><AlertTriangle size={25} /></div>
            <div><span>Urgentes</span><strong>{metrics.urgent}</strong><small>{metrics.total ? Math.round((metrics.urgent / metrics.total) * 100) : 0}% del total</small></div>
          </motion.article>
        </section>

        <section className="tickets-workspace tickets-workspace-2026">
          <div className="tickets-toolbar tickets-toolbar-2026">
            <div className="tickets-search tickets-search-2026">
              <Search size={18} />
              <input
                type="search"
                aria-label="Buscar tickets"
                placeholder="Buscar por código, cliente, equipo o falla..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} aria-label="Limpiar búsqueda">
                  <X size={15} />
                </button>
              )}
            </div>

            <label className="tickets-select-filter">
              <select aria-label="Etapa" value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
                <option value="">Todas las etapas</option>
                {Object.entries(TICKET_STAGES).map(([key, item]) => (
                  <option key={key} value={key}>{item.label}</option>
                ))}
              </select>
            </label>

            <label className="tickets-select-filter">
              <select aria-label="Técnico" value={technicianFilter} onChange={(event) => setTechnicianFilter(event.target.value)}>
                <option value="">Todos los técnicos</option>
                {technicians.map((technician) => (
                  <option key={technician} value={technician}>{technician}</option>
                ))}
              </select>
            </label>

            <label className="tickets-select-filter">
              <select aria-label="Tipo de equipo" value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}>
                <option value="">Todos los tipos</option>
                {deviceTypes.map((device) => <option key={device} value={device}>{device}</option>)}
              </select>
            </label>

            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="tickets-more-filters"
              className={`tickets-filter-toggle ${filtersOpen ? "active" : ""}`}
              onClick={() => setFiltersOpen((current) => !current)}
            >
              <SlidersHorizontal size={17} />
              Más filtros
            </button>
          </div>

          <div className="tickets-quickbar">
            <div className="tickets-quick-filters">
              <button type="button" className={!stageFilter ? "active" : ""} onClick={() => setStageFilter("")}>
                <UserRound size={16} /> Todos <span>{metrics.total}</span>
              </button>
              <button type="button" className={stageFilter === "pendiente_ingreso" ? "active" : ""} onClick={() => setStageFilter("pendiente_ingreso")}>
                <Clock3 size={16} /> Pendiente ingreso <span>{metrics.awaiting}</span>
              </button>
              <button type="button" className={stageFilter === "pendiente" ? "active" : ""} onClick={() => setStageFilter("pendiente")}>
                <ClipboardList size={16} /> Recepción <span>{metrics.received}</span>
              </button>
              <button type="button" className={stageFilter === "diagnostico" ? "active" : ""} onClick={() => setStageFilter("diagnostico")}>
                <Search size={16} /> Diagnóstico <span>{metrics.diagnostic}</span>
              </button>
              <button type="button" className={stageFilter === "reparacion" ? "active" : ""} onClick={() => setStageFilter("reparacion")}>
                <Wrench size={16} /> En reparación <span>{metrics.repair}</span>
              </button>
              <button type="button" className={stageFilter === "repuesto" ? "active" : ""} onClick={() => setStageFilter("repuesto")}>
                <Package size={16} /> Esperando repuesto <span>{metrics.parts}</span>
              </button>
              <button type="button" className={stageFilter === "listo" ? "active" : ""} onClick={() => setStageFilter("listo")}>
                <CheckCircle2 size={16} /> Listo para entrega <span>{metrics.ready}</span>
              </button>
              <button type="button" className={stageFilter === "entregado" ? "active" : ""} onClick={() => setStageFilter("entregado")}><Package size={16} /> Entregado <span>{metrics.delivered}</span></button>
            </div>

            <div className="tickets-quick-actions">
              <button type="button" onClick={handleExport}><Download size={16} /> Exportar</button>
              <button type="button" aria-pressed={view === "kanban"} onClick={() => setView(view === "table" ? "kanban" : "table")}><Columns3 size={16} /> {view === "table" ? "Vista Kanban" : "Vista tabla"}</button>
              <motion.button
                type="button"
                className="tickets-new-button"
                whileHover={{ y: -2, scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleNewTicket}
              >
                <Plus size={18} /> Nuevo ticket
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {filtersOpen && (
              <motion.div
                id="tickets-more-filters" className="tickets-filters-panel open tickets-filters-compact"
                initial={{ opacity: 0, height: 0, y: -5 }}
                animate={{ opacity: 1, height: "auto", y: 0 }}
                exit={{ opacity: 0, height: 0, y: -5 }}
              >
                <div className="tickets-filter-title">
                  <div><Filter size={14} /><span>Filtros activos</span></div>
                  {hasActiveFilters && <button type="button" onClick={clearFilters}>Limpiar todo</button>}
                </div>
                <label className="tickets-extra-priority">Prioridad
                  <select aria-label="Prioridad" value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
                    <option value="">Todas las prioridades</option>
                    <option value="P1">Alta</option><option value="P2">Media</option><option value="P3">Baja</option>
                  </select>
                </label>
              </motion.div>
            )}
          </AnimatePresence>

          {loading && (
            <div className="tickets-state">
              <RefreshCw className="tickets-spinner" size={25} />
              <strong>Cargando tickets</strong>
              <span>Sincronizando con Firebase...</span>
            </div>
          )}

          {!loading && error && (
            <div className="tickets-state tickets-error">
              <strong>No pudimos cargar los tickets</strong>
              <span>Revisá la conexión o los permisos.</span>
            </div>
          )}

          {!loading && !error && view === "table" && (
            <div className="tickets-table-card" role="table" aria-label="Tickets de soporte">
              <div className="tickets-table-head" role="row">
                <span role="columnheader">#</span>
                <span role="columnheader">Cliente</span>
                <span role="columnheader">Equipo</span>
                <span role="columnheader">Estado</span>
                <span role="columnheader">Prioridad</span>
                <span role="columnheader">Técnico</span>
                <span role="columnheader">Presupuesto</span>
                <span role="columnheader">Ingreso</span>
                <span role="columnheader">Acciones</span>
              </div>

              {filteredTickets.length === 0 ? (
                <div className="tickets-empty">
                  <Search size={24} />
                  <strong>No encontramos tickets</strong>
                  <span>Probá modificando la búsqueda o los filtros.</span>
                  {hasActiveFilters && <button type="button" onClick={clearFilters}>Limpiar filtros</button>}
                </div>
              ) : (
                <div className="tickets-table-body" role="rowgroup">
                  {filteredTickets.map((ticket, index) => {
                    const priority = getPriorityMeta(ticket.prioridad);
                    const PriorityIcon = priority.icon;
                    const selected = selectedTicket?.id === ticket.id;

                    return (
                      <motion.article
                        key={ticket.id}
                        role="row" className={`tickets-table-row ${selected ? "selected" : ""}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(index * 0.018, 0.18) }}
                      >
                        <strong role="cell" className="tickets-code">{ticket.id}</strong>

                        <div role="cell" className="tickets-client-cell">
                          <span className="tickets-avatar">{getInitials(ticket.cliente)}</span>
                          <div>
                            <strong>{ticket.cliente || "Sin cliente"}</strong>
                            <small>{ticket.clienteId || "Cliente sin ID"}</small>
                          </div>
                        </div>

                        <div role="cell" className="tickets-device-cell">
                          <motion.span
                            className="tickets-device-icon"
                            animate={{ rotateY: [0, 9, 0], y: [0, -2, 0] }}
                            transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Laptop size={16} />
                          </motion.span>
                          <div>
                            <strong title={getTicketDevice(ticket)}>{getTicketDevice(ticket) || "Equipo"}</strong>
                            <small>{ticket.falla || "Sin detalle"}</small>
                          </div>
                        </div>

                        <div role="cell"><StageBadge stageKey={ticket.stage} compact /></div>

                        <motion.span
                          role="cell" className={`tickets-priority ${priority.className}`}
                          animate={ticket.prioridad === "P1" ? { y: [0, -2, 0] } : {}}
                          transition={{ duration: 1.45, repeat: Infinity }}
                        >
                          <PriorityIcon size={13} /> {priority.label}
                        </motion.span>

                        <div role="cell" className="tickets-tech-cell">
                          <span>{getInitials(ticket.tecnico)}</span>
                          <strong>{ticket.tecnico || "Sin asignar"}</strong>
                        </div>

                        <strong role="cell" className="ticket-money">
                          {Number(ticket.presupuestoEstimado || 0) > 0 ? formatMoney(ticket.presupuestoEstimado) : "—"}
                        </strong>

                        <div role="cell" className="tickets-date-cell">
                          <strong>{ticket.stage === "pendiente_ingreso" ? "Pendiente" : ticket.ingreso || "—"}</strong>
                          <small>{ticket.stage === "pendiente_ingreso" ? "Aún no ingresó" : "Ingreso"}</small>
                        </div>

                        <div role="cell" className="tickets-row-actions">
                          <motion.button
                            type="button"
                            className="tickets-detail-button"
                            whileTap={{ scale: 0.97 }}
                            onClick={() => showTicketSummary(ticket)}
                          >
                            Ver detalle
                          </motion.button>
                          <motion.button
                            type="button"
                            className="tickets-icon-button"
                            aria-label={`Abrir ticket ${ticket.id}`}
                            title="Abrir ticket completo"
                            whileHover={{ y: -2, scale: 1.05 }}
                            whileTap={{ scale: 0.94 }}
                            onClick={() => openTicket(ticket)}
                          >
                            <Eye size={16} />
                          </motion.button>
                        </div>
                      </motion.article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!loading && !error && view === "kanban" && (
            <div className="tickets-kanban" aria-label="Tickets por etapa">
              {Object.entries(TICKET_STAGES).filter(([key]) => !stageFilter || key === stageFilter).map(([key, stage]) => {
                const items = filteredTickets.filter((ticket) => ticket.stage === key);
                return <section className="tickets-kanban-column" key={key}>
                  <h2>{stage.label}<span>{items.length}</span></h2>
                  {items.length === 0 && <p className="tickets-kanban-empty">Sin tickets en esta etapa</p>}
                  {items.map((ticket) => <button type="button" key={ticket.id} className={`tickets-kanban-ticket ${selectedTicket?.id === ticket.id ? "selected" : ""}`} onClick={() => showTicketSummary(ticket)}>
                    <span>{ticket.id}</span><strong>{ticket.cliente || "Sin cliente"}</strong>
                    <span>{getTicketDevice(ticket)}</span><small>{ticket.falla || "Sin detalle"}</small>
                    <span>{ticket.tecnico || "Sin asignar"} · {getPriorityMeta(ticket.prioridad).label}</span>
                  </button>)}
                </section>;
              })}
            </div>
          )}
          <div ref={summaryRef} />
          <AnimatePresence mode="wait">
            {selectedTicket && (
              <motion.section
                key={selectedTicket.id}
                className="tickets-selected-summary"
                initial={{ opacity: 0, y: 22, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.985 }}
                transition={{ type: "spring", stiffness: 250, damping: 24 }}
              >
                <div className="tickets-selected-head">
                  <div>
                    <span className="tickets-selected-accent" />
                    <div>
                      <h2 className="tickets-preview-label">Resumen del ticket seleccionado</h2>
                      <div className="tickets-selected-title">
                        <strong>{selectedTicket.id}</strong>
                        <StageBadge stageKey={selectedTicket.stage} />
                      </div>
                    </div>
                  </div>

                  <button type="button" onClick={() => openTicket(selectedTicket)}>
                    Ver ticket completo <ArrowRight size={15} />
                  </button>
                </div>

                <div className="tickets-selected-grid">
                  <article className="tickets-selected-device">
                    <motion.div
                      className="tickets-selected-device-icon"
                      animate={{ y: [0, -5, 0], rotateY: [0, 8, 0] }}
                      transition={{ duration: 3.7, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <Laptop size={34} />
                    </motion.div>
                    <div>
                      <h3>{selectedTicket.equipo || "Equipo sin especificar"}</h3>
                      <p>{[selectedTicket.marca, selectedTicket.modelo].filter(Boolean).join(" · ") || selectedTicket.falla || "Orden de servicio"}</p>
                      <span><UserRound size={14} /> {selectedTicket.cliente || "Sin cliente"}</span>
                      <span><Clock3 size={14} /> {selectedTicket.stage === "pendiente_ingreso" ? "Esperando ingreso físico del equipo" : `Ingreso: ${selectedTicket.ingreso || "sin fecha"}`}</span>
                    </div>
                  </article>

                  <div className="tickets-selected-info-grid">
                    <article>
                      <span className="selected-info-icon blue"><Search size={20} /></span>
                      <div><span>Diagnóstico</span><strong>{selectedTicket.diagnosticoInicial || "Pendiente de diagnóstico"}</strong></div>
                    </article>
                    <article>
                      <span className="selected-info-icon orange"><ShieldAlert size={20} /></span>
                      <div><span>Garantía del servicio</span><strong>{Number(selectedTicket.garantiaDias ?? 90) > 0 ? `${selectedTicket.garantiaDias ?? 90} días` : "Sin garantía"}</strong></div>
                    </article>
                    <article>
                      <span className="selected-info-icon green"><ClipboardList size={20} /></span>
                      <div><span>Presupuesto</span><strong>{Number(selectedTicket.presupuestoEstimado || 0) > 0 ? formatMoney(selectedTicket.presupuestoEstimado) : "Pendiente"}</strong></div>
                    </article>
                    <article>
                      <span className="selected-info-icon violet"><UserRound size={20} /></span>
                      <div><span>Técnico</span><strong>{selectedTicket.tecnico || "Sin asignar"}</strong></div>
                    </article>
                  </div>
                </div>

                <div className="tickets-preview-timeline-wrap">
                  <div className="tickets-preview-timeline-title">
                    <div><Sparkles size={15} /><strong>Seguimiento del ticket</strong></div>
                    <small>{getStage(selectedTicket.stage).label}</small>
                  </div>
                  <div className="tickets-preview-timeline">
                    <span className="tickets-preview-flow-line" />
                    <motion.span
                      className="tickets-preview-flow-light"
                      animate={{ x: ["0%", "650%"] }}
                      transition={{ duration: 4.2, repeat: Infinity, ease: "linear" }}
                    />
                    {PREVIEW_FLOW.map((stageKey, index) => (
                      <ProgressStage
                        key={stageKey}
                        stageKey={stageKey}
                        currentStage={selectedTicket.stage}
                        index={index}
                        currentIndex={previewCurrentIndex}
                      />
                    ))}
                  </div>
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </section>
      </div>

      {cleanupOpen && canAudit && (
        <div
          className="tickets-cleanup-overlay"
          role="presentation"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target && !cleaningOrphans) {
              setCleanupOpen(false);
              setCleanupConfirm("");
            }
          }}
        >
          <motion.section
            className="tickets-cleanup-modal"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
          >
            <div className="tickets-cleanup-icon"><ShieldAlert size={24} /></div>
            <div className="tickets-cleanup-copy">
              <span>Auditoría interna</span>
              <h3>Limpiar tickets huérfanos</h3>
              <p>Busca tickets vinculados a clientes eliminados y conserva el respaldo correspondiente en Auditoría.</p>
            </div>
            <label className="tickets-cleanup-confirm">
              <span>Escribí LIMPIAR para confirmar</span>
              <input
                type="text"
                value={cleanupConfirm}
                onChange={(event) => setCleanupConfirm(event.target.value)}
                placeholder="LIMPIAR"
                disabled={cleaningOrphans}
                autoComplete="off"
              />
            </label>
            <div className="tickets-cleanup-actions">
              <button type="button" className="secondary" disabled={cleaningOrphans} onClick={() => { setCleanupOpen(false); setCleanupConfirm(""); }}>
                Cancelar
              </button>
              <button
                type="button"
                className="danger"
                disabled={cleaningOrphans || cleanupConfirm.trim().toUpperCase() !== "LIMPIAR"}
                onClick={handleCleanupOrphans}
              >
                {cleaningOrphans ? <RefreshCw size={15} className="tickets-cleanup-spinning" /> : <ShieldAlert size={15} />}
                {cleaningOrphans ? "Limpiando..." : "Eliminar huérfanos"}
              </button>
            </div>
          </motion.section>
        </div>
      )}
    </main>
  );
}
