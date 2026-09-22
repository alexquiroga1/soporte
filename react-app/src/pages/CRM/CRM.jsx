import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  ChartLine,
  CircleDollarSign,
  Clock3,
  Handshake,
  History,
  Mail,
  MessageSquareText,
  Pencil,
  Phone,
  Plus,
  Search,
  Target,
  UserRound,
  Users,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  CRM_ACTIVITY_TYPES,
  CRM_STAGES,
  addOpportunityActivity,
  archiveOpportunity,
  createOpportunity,
  restoreOpportunity,
  subscribeToCRM,
  subscribeToCRMClients,
  updateOpportunity,
  updateOpportunityStage,
} from "../../services/crm.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./CRM.css";

const EMPTY_FORM = {
  clientId: "",
  contacto: "",
  empresa: "",
  telefono: "",
  email: "",
  interes: "",
  valor: "",
  probabilidad: "20",
  fecha: "",
  proximoSeguimiento: "",
  origen: "Directo",
  stage: "prospecto",
};

const EMPTY_ACTIVITY = {
  type: "Llamada",
  note: "",
  nextFollowUp: "",
};

const VIEW_TABS = [
  ["pipeline", "Pipeline"],
  ["followup", "Seguimiento"],
  ["archived", "Archivadas"],
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  const date = new Date(text.length === 10 ? `${text}T12:00:00` : text);
  if (Number.isNaN(date.getTime())) return text;
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getStageLabel(stage) {
  return CRM_STAGES.find((item) => item.key === stage)?.label || stage || "Prospecto";
}

function getClientName(client) {
  return (
    cleanText(client?.razonSocial) ||
    cleanText(`${client?.nombre || ""} ${client?.apellido || ""}`) ||
    "Cliente"
  );
}

function getClientDoc(client) {
  return cleanText(client?.cuit || client?.dni || client?.doc) || "—";
}

function isDueOrPast(value) {
  if (!value) return false;
  const date = new Date(`${String(value).slice(0, 10)}T23:59:59`);
  return !Number.isNaN(date.getTime()) && date <= new Date();
}

function errorMessage(error) {
  const map = {
    CRM_CONTACT_REQUIRED: "Ingresá el nombre del contacto.",
    CRM_INTEREST_REQUIRED: "Indicá el interés o necesidad comercial.",
    CRM_ACTIVITY_REQUIRED: "Escribí el detalle de la gestión.",
    CRM_ID_REQUIRED: "No pudimos identificar la oportunidad.",
  };

  return map[error?.message] || error?.message || "Ocurrió un error inesperado.";
}

export default function CRM() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const [opportunities, setOpportunities] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [clientSearch, setClientSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOpportunity, setEditingOpportunity] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [movingId, setMovingId] = useState(null);
  const [draggingId, setDraggingId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [activity, setActivity] = useState(EMPTY_ACTIVITY);
  const [activitySaving, setActivitySaving] = useState(false);
  const [showActivityForm, setShowActivityForm] = useState(false);

  useEffect(() => {
    let crmReady = false;
    let clientsReady = false;

    const resolveLoading = () => {
      if (crmReady && clientsReady) setLoading(false);
    };

    const unsubscribeCRM = subscribeToCRM(
      (rows) => {
        setOpportunities(rows);
        crmReady = true;
        resolveLoading();
      },
      (error) => {
        console.error(error);
        crmReady = true;
        resolveLoading();
        notify.error("CRM", "No se pudieron cargar las oportunidades.");
      }
    );

    const unsubscribeClients = subscribeToCRMClients(
      (rows) => {
        setClients(rows);
        clientsReady = true;
        resolveLoading();
      },
      (error) => {
        console.error(error);
        clientsReady = true;
        resolveLoading();
        notify.error("CRM", "No se pudo cargar el índice de clientes.");
      }
    );

    return () => {
      unsubscribeCRM();
      unsubscribeClients();
    };
  }, []);

  useEffect(() => {
    if (!selected?.id) return;
    const latest = opportunities.find((item) => item.id === selected.id);
    if (latest) setSelected(latest);
  }, [opportunities, selected?.id]);

  const activeOpportunities = useMemo(
    () => opportunities.filter((item) => item.archivado !== true),
    [opportunities]
  );

  const metrics = useMemo(() => {
    const open = activeOpportunities.filter(
      (item) => !["ganado", "perdido"].includes(item.stage)
    );
    const pipeline = open.reduce((sum, item) => sum + Number(item.valor || 0), 0);
    const weighted = open.reduce(
      (sum, item) => sum + Number(item.valor || 0) * (Number(item.probabilidad || 0) / 100),
      0
    );
    const won = activeOpportunities.filter((item) => item.stage === "ganado");
    const lost = activeOpportunities.filter((item) => item.stage === "perdido");
    const decided = won.length + lost.length;
    const winRate = decided ? (won.length / decided) * 100 : 0;
    const due = open.filter((item) => isDueOrPast(item.proximoSeguimiento)).length;

    return {
      pipeline,
      weighted,
      won: won.length,
      winRate,
      due,
      total: open.length,
    };
  }, [activeOpportunities]);

  const normalizedSearch = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    const source = view === "archived"
      ? opportunities.filter((item) => item.archivado === true)
      : activeOpportunities;

    return source.filter((item) => {
      if (!normalizedSearch) return true;
      return [
        item.contacto,
        item.empresa,
        item.interes,
        item.email,
        item.telefono,
        item.origen,
        getStageLabel(item.stage),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [activeOpportunities, normalizedSearch, opportunities, view]);

  const followUpRows = useMemo(
    () => filtered
      .filter((item) => item.proximoSeguimiento && !["ganado", "perdido"].includes(item.stage))
      .sort((a, b) => String(a.proximoSeguimiento).localeCompare(String(b.proximoSeguimiento))),
    [filtered]
  );

  const clientMatches = useMemo(() => {
    const query = clientSearch.trim().toLowerCase();
    if (query.length < 2) return [];
    return clients
      .filter((client) => [
        getClientName(client),
        getClientDoc(client),
        client.tel,
        client.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query))
      .slice(0, 7);
  }, [clientSearch, clients]);

  const openNew = () => {
    setEditingOpportunity(null);
    setClientSearch("");
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (opportunity) => {
    setEditingOpportunity(opportunity);
    setClientSearch("");
    setForm({
      clientId: opportunity.clientId || "",
      contacto: opportunity.contacto || "",
      empresa: opportunity.empresa === "—" ? "" : opportunity.empresa || "",
      telefono: opportunity.telefono || "",
      email: opportunity.email || "",
      interes: opportunity.interes || "",
      valor: opportunity.valor ?? "",
      probabilidad: String(opportunity.probabilidad ?? 0),
      fecha: opportunity.fecha || "",
      proximoSeguimiento: opportunity.proximoSeguimiento || "",
      origen: opportunity.origen || "Directo",
      stage: opportunity.stage || "prospecto",
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingOpportunity(null);
    setClientSearch("");
    setForm(EMPTY_FORM);
  };

  const selectClient = (client) => {
    setForm((current) => ({
      ...current,
      clientId: client.id,
      contacto: getClientName(client),
      empresa: cleanText(client.razonSocial) || current.empresa,
      telefono: cleanText(client.tel),
      email: cleanText(client.email),
    }));
    setClientSearch("");
    notify.success("Cliente vinculado", `${getClientName(client)} quedó asociado a la oportunidad.`);
  };

  const clearClient = () => {
    setForm((current) => ({ ...current, clientId: "" }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      if (editingOpportunity) {
        await updateOpportunity(editingOpportunity.id, { ...form, author });
        if (form.stage !== editingOpportunity.stage) {
          await updateOpportunityStage(editingOpportunity, form.stage, author);
        }
        notify.success("Oportunidad actualizada", "Los cambios se guardaron correctamente.");
      } else {
        await createOpportunity({ ...form, author });
        notify.success("Oportunidad creada", "La oportunidad ya forma parte del pipeline.");
      }

      closeModal();
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleMove = async (opportunity, stage) => {
    if (!opportunity || opportunity.stage === stage) return;
    try {
      setMovingId(opportunity.id);
      await updateOpportunityStage(opportunity, stage, author);
      notify.success("Etapa actualizada", `${opportunity.contacto} pasó a ${getStageLabel(stage)}.`);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo mover", errorMessage(error));
    } finally {
      setMovingId(null);
    }
  };

  const handleAddActivity = async () => {
    if (!selected) return;
    try {
      setActivitySaving(true);
      await addOpportunityActivity(selected, { ...activity, author });
      setActivity(EMPTY_ACTIVITY);
      setShowActivityForm(false);
      notify.success("Gestión registrada", "La actividad quedó guardada en el historial comercial.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo registrar", errorMessage(error));
    } finally {
      setActivitySaving(false);
    }
  };

  const handleArchive = async (opportunity) => {
    try {
      await archiveOpportunity(opportunity, author);
      if (selected?.id === opportunity.id) setSelected(null);
      notify.success("Oportunidad archivada", "El historial se conserva para auditoría.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo archivar", errorMessage(error));
    }
  };

  const handleRestore = async (opportunity) => {
    try {
      await restoreOpportunity(opportunity, author);
      notify.success("Oportunidad restaurada", "Volvió al pipeline activo.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo restaurar", errorMessage(error));
    }
  };

  if (loading) {
    return (
      <main className="crm-page">
        <div className="crm-loading">Cargando CRM...</div>
      </main>
    );
  }

  return (
    <main className="crm-page">
      <div className="crm-shell">
        <header className="crm-header">
          <div>
            <button type="button" className="crm-back" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={17} /> Dashboard
            </button>
            <span className="crm-eyebrow">Comercial / Relación con clientes</span>
            <h1>CRM y Oportunidades</h1>
            <p>Pipeline, seguimiento, clientes vinculados y actividad comercial sin perder trazabilidad.</p>
          </div>

          <button type="button" className="crm-primary" onClick={openNew}>
            <Plus size={17} /> Nueva oportunidad
          </button>
        </header>

        <section className="crm-metrics">
          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <span><CircleDollarSign size={17} /> Pipeline abierto</span>
            <strong>{formatMoney(metrics.pipeline)}</strong>
            <small>{metrics.total} oportunidades activas</small>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .04 }}>
            <span><Target size={17} /> Pipeline ponderado</span>
            <strong>{formatMoney(metrics.weighted)}</strong>
            <small>Valor × probabilidad</small>
          </motion.article>

          <motion.article className={metrics.due ? "attention" : ""} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .08 }}>
            <span><CalendarClock size={17} /> Seguimientos vencidos</span>
            <strong>{metrics.due}</strong>
            <small>Contactos que requieren acción</small>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
            <span><ChartLine size={17} /> Conversión</span>
            <strong>{metrics.winRate.toFixed(1)}%</strong>
            <small>{metrics.won} oportunidades ganadas</small>
          </motion.article>
        </section>

        <section className="crm-panel">
          <div className="crm-toolbar">
            <div className="crm-tabs">
              {VIEW_TABS.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={view === key ? "active" : ""}
                  onClick={() => setView(key)}
                >
                  {key === "pipeline" && <BriefcaseBusiness size={15} />}
                  {key === "followup" && <Clock3 size={15} />}
                  {key === "archived" && <Archive size={15} />}
                  {label}
                </button>
              ))}
            </div>

            <label className="crm-search">
              <Search size={16} />
              <input
                value={search}
                placeholder="Cliente, empresa, interés, email..."
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          {view === "pipeline" && (
            <div className="crm-board">
              {CRM_STAGES.map((stage) => {
                const stageItems = filtered.filter((item) => item.stage === stage.key);
                const stageTotal = stageItems.reduce((sum, item) => sum + Number(item.valor || 0), 0);

                return (
                  <section
                    key={stage.key}
                    className={`crm-column crm-column-${stage.key}`}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      const opportunity = opportunities.find((item) => item.id === draggingId);
                      if (opportunity) handleMove(opportunity, stage.key);
                      setDraggingId(null);
                    }}
                  >
                    <header>
                      <div><span className="crm-dot" /><strong>{stage.label}</strong><b>{stageItems.length}</b></div>
                      <small>{formatMoney(stageTotal)}</small>
                    </header>

                    <div className="crm-cards">
                      {stageItems.map((opportunity) => (
                        <motion.article
                          layout
                          key={opportunity.id}
                          className={`crm-card ${movingId === opportunity.id ? "is-moving" : ""}`}
                          draggable
                          onDragStart={() => setDraggingId(opportunity.id)}
                          onDragEnd={() => setDraggingId(null)}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          onClick={() => setSelected(opportunity)}
                        >
                          <div className="crm-card-head">
                            <div className="crm-card-avatar"><UserRound size={16} /></div>
                            <div className="crm-card-person">
                              <strong>{opportunity.contacto}</strong>
                              <span>{opportunity.empresa || "—"}</span>
                            </div>
                            <span className={`crm-probability p-${Math.min(100, Math.ceil(Number(opportunity.probabilidad || 0) / 25) * 25)}`}>
                              {Number(opportunity.probabilidad || 0)}%
                            </span>
                          </div>

                          <p>{opportunity.interes}</p>

                          <div className="crm-card-meta">
                            <span><CircleDollarSign size={14} /> {formatMoney(opportunity.valor)}</span>
                            <span className={isDueOrPast(opportunity.proximoSeguimiento) ? "is-due" : ""}>
                              <CalendarClock size={14} /> {opportunity.proximoSeguimiento ? formatDate(opportunity.proximoSeguimiento) : "Sin seguimiento"}
                            </span>
                          </div>

                          <div className="crm-card-foot">
                            <span>{opportunity.origen || "Directo"}</span>
                            <select
                              value={opportunity.stage}
                              disabled={movingId === opportunity.id}
                              onClick={(event) => event.stopPropagation()}
                              onChange={(event) => handleMove(opportunity, event.target.value)}
                            >
                              {CRM_STAGES.map((option) => (
                                <option key={option.key} value={option.key}>{option.label}</option>
                              ))}
                            </select>
                          </div>
                        </motion.article>
                      ))}

                      {!stageItems.length && (
                        <div className="crm-column-empty"><BriefcaseBusiness size={21} /><span>Sin oportunidades</span></div>
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {view === "followup" && (
            <div className="crm-follow-list">
              {followUpRows.map((opportunity) => (
                <button key={opportunity.id} type="button" className="crm-follow-row" onClick={() => setSelected(opportunity)}>
                  <span className={`crm-follow-icon ${isDueOrPast(opportunity.proximoSeguimiento) ? "due" : ""}`}><CalendarClock size={17} /></span>
                  <span className="crm-follow-main">
                    <strong>{opportunity.contacto}</strong>
                    <small>{opportunity.interes}</small>
                  </span>
                  <span><small>Etapa</small><strong>{getStageLabel(opportunity.stage)}</strong></span>
                  <span><small>Próximo contacto</small><strong className={isDueOrPast(opportunity.proximoSeguimiento) ? "danger" : ""}>{formatDate(opportunity.proximoSeguimiento)}</strong></span>
                  <span className="money">{formatMoney(opportunity.valor)}</span>
                </button>
              ))}

              {!followUpRows.length && (
                <div className="crm-empty-large"><CalendarClock size={28} /><strong>Sin seguimientos pendientes</strong><span>Las próximas gestiones aparecerán acá.</span></div>
              )}
            </div>
          )}

          {view === "archived" && (
            <div className="crm-follow-list">
              {filtered.map((opportunity) => (
                <div key={opportunity.id} className="crm-follow-row archived">
                  <span className="crm-follow-icon"><Archive size={17} /></span>
                  <span className="crm-follow-main"><strong>{opportunity.contacto}</strong><small>{opportunity.interes}</small></span>
                  <span><small>Etapa final</small><strong>{getStageLabel(opportunity.stage)}</strong></span>
                  <span><small>Valor</small><strong>{formatMoney(opportunity.valor)}</strong></span>
                  <button type="button" className="crm-restore" onClick={() => handleRestore(opportunity)}><ArchiveRestore size={15} /> Restaurar</button>
                </div>
              ))}

              {!filtered.length && (
                <div className="crm-empty-large"><Archive size={28} /><strong>Sin oportunidades archivadas</strong><span>Los registros archivados conservan su historial.</span></div>
              )}
            </div>
          )}
        </section>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div className="crm-modal-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="crm-modal" initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }}>
              <header>
                <div>
                  <span>{editingOpportunity ? "Editar" : "Nueva"}</span>
                  <h2>{editingOpportunity ? "Editar oportunidad" : "Nueva oportunidad comercial"}</h2>
                </div>
                <button type="button" onClick={closeModal}><X size={18} /></button>
              </header>

              <div className="crm-modal-body">
                <div className="crm-client-link">
                  <label>
                    <span>Vincular cliente existente</span>
                    <div className="crm-client-search-field"><Search size={15} /><input value={clientSearch} onChange={(event) => setClientSearch(event.target.value)} placeholder="Nombre, DNI/CUIT, teléfono o email..." /></div>
                  </label>

                  {clientMatches.length > 0 && (
                    <div className="crm-client-results">
                      {clientMatches.map((client) => (
                        <button key={client.id} type="button" onClick={() => selectClient(client)}>
                          <div><strong>{getClientName(client)}</strong><span>{getClientDoc(client)} · {client.tel || "Sin teléfono"}</span></div>
                          <span>Seleccionar</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {form.clientId && (
                    <div className="crm-linked-client"><Users size={16} /><span>Cliente SERVIX vinculado</span><button type="button" onClick={clearClient}>Desvincular</button></div>
                  )}
                </div>

                <div className="crm-form-grid">
                  <label><span>Contacto / cliente *</span><input value={form.contacto} onChange={(event) => setForm((current) => ({ ...current, contacto: event.target.value }))} /></label>
                  <label><span>Empresa</span><input value={form.empresa} onChange={(event) => setForm((current) => ({ ...current, empresa: event.target.value }))} /></label>
                  <label><span>Teléfono</span><input value={form.telefono} onChange={(event) => setForm((current) => ({ ...current, telefono: event.target.value }))} /></label>
                  <label><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} /></label>
                  <label className="wide"><span>Necesidad / oportunidad *</span><textarea rows="3" value={form.interes} onChange={(event) => setForm((current) => ({ ...current, interes: event.target.value }))} /></label>
                  <label><span>Valor estimado</span><input type="number" min="0" value={form.valor} onChange={(event) => setForm((current) => ({ ...current, valor: event.target.value }))} /></label>
                  <label><span>Probabilidad (%)</span><input type="number" min="0" max="100" value={form.probabilidad} onChange={(event) => setForm((current) => ({ ...current, probabilidad: event.target.value }))} /></label>
                  <label><span>Fecha estimada de cierre</span><input type="date" value={form.fecha} onChange={(event) => setForm((current) => ({ ...current, fecha: event.target.value }))} /></label>
                  <label><span>Próximo seguimiento</span><input type="date" value={form.proximoSeguimiento} onChange={(event) => setForm((current) => ({ ...current, proximoSeguimiento: event.target.value }))} /></label>
                  <label><span>Origen</span><select value={form.origen} onChange={(event) => setForm((current) => ({ ...current, origen: event.target.value }))}><option>Directo</option><option>Cliente existente</option><option>Recomendación</option><option>Web</option><option>Ticket</option><option>Presupuesto</option><option>Otro</option></select></label>
                  <label><span>Etapa</span><select value={form.stage} onChange={(event) => setForm((current) => ({ ...current, stage: event.target.value }))}>{CRM_STAGES.map((stage) => <option key={stage.key} value={stage.key}>{stage.label}</option>)}</select></label>
                </div>
              </div>

              <footer>
                <button type="button" className="crm-secondary" onClick={closeModal} disabled={saving}>Cancelar</button>
                <button type="button" className="crm-primary" onClick={handleSave} disabled={saving}>{saving ? "Guardando..." : editingOpportunity ? "Guardar cambios" : "Crear oportunidad"}</button>
              </footer>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selected && (
          <motion.section className="crm-detail-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <header className="crm-detail-toolbar">
              <div className="crm-detail-toolbar-left">
                <button type="button" className="crm-icon-button" onClick={() => setSelected(null)}><ArrowLeft size={18} /></button>
                <div><strong>{selected.contacto}</strong><span>{selected.empresa || "—"} · {getStageLabel(selected.stage)}</span></div>
              </div>
              <div className="crm-detail-actions">
                <button type="button" className="crm-secondary" onClick={() => openEdit(selected)}><Pencil size={15} /> Editar</button>
                {selected.archivado ? (
                  <button type="button" className="crm-secondary" onClick={() => handleRestore(selected)}><ArchiveRestore size={15} /> Restaurar</button>
                ) : (
                  <button type="button" className="crm-secondary" onClick={() => handleArchive(selected)}><Archive size={15} /> Archivar</button>
                )}
              </div>
            </header>

            <div className="crm-detail-scroll">
              <div className="crm-detail-grid">
                <div className="crm-detail-main">
                  <section className="crm-detail-card">
                    <div className="crm-detail-card-head"><div><span>Oportunidad</span><h2>{selected.interes}</h2></div><span className={`crm-stage-badge stage-${selected.stage}`}>{getStageLabel(selected.stage)}</span></div>
                    <div className="crm-detail-kpis">
                      <div><span>Valor estimado</span><strong>{formatMoney(selected.valor)}</strong></div>
                      <div><span>Probabilidad</span><strong>{Number(selected.probabilidad || 0)}%</strong></div>
                      <div><span>Cierre estimado</span><strong>{formatDate(selected.fecha)}</strong></div>
                      <div><span>Próximo seguimiento</span><strong className={isDueOrPast(selected.proximoSeguimiento) ? "danger" : ""}>{formatDate(selected.proximoSeguimiento)}</strong></div>
                    </div>
                  </section>

                  <section className="crm-detail-card">
                    <div className="crm-detail-card-head"><div><span>Actividad</span><h2>Historial comercial</h2></div><button type="button" className="crm-primary small" onClick={() => setShowActivityForm((current) => !current)}><Plus size={15} /> Registrar gestión</button></div>

                    {showActivityForm && (
                      <div className="crm-activity-form">
                        <select value={activity.type} onChange={(event) => setActivity((current) => ({ ...current, type: event.target.value }))}>{CRM_ACTIVITY_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
                        <input type="date" value={activity.nextFollowUp} onChange={(event) => setActivity((current) => ({ ...current, nextFollowUp: event.target.value }))} />
                        <textarea rows="3" placeholder="Detalle de la llamada, reunión, email o próxima acción..." value={activity.note} onChange={(event) => setActivity((current) => ({ ...current, note: event.target.value }))} />
                        <div><button type="button" className="crm-secondary" onClick={() => setShowActivityForm(false)}>Cancelar</button><button type="button" className="crm-primary" onClick={handleAddActivity} disabled={activitySaving}>{activitySaving ? "Guardando..." : "Guardar gestión"}</button></div>
                      </div>
                    )}

                    <div className="crm-timeline">
                      {[...(selected.historial || [])].reverse().map((entry, index) => (
                        <div key={`${entry.fecha || "event"}-${index}`} className="crm-timeline-item">
                          <span className="crm-timeline-icon">
                            {entry.tipo === "Llamada" ? <Phone size={15} /> : entry.tipo === "Email" ? <Mail size={15} /> : entry.accion === "Cambio de etapa" ? <Handshake size={15} /> : <MessageSquareText size={15} />}
                          </span>
                          <div><strong>{entry.accion || entry.tipo || "Actividad"}</strong><p>{entry.detalle || "—"}</p><small>{entry.autor || "Sistema"}</small></div>
                          <time>{formatDateTime(entry.fecha)}</time>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                <aside className="crm-detail-side">
                  <section className="crm-detail-card">
                    <span className="crm-side-label">Contacto</span>
                    <div className="crm-contact-line"><UserRound size={16} /><div><strong>{selected.contacto}</strong><span>{selected.empresa || "—"}</span></div></div>
                    <div className="crm-contact-line"><Phone size={16} /><div><strong>{selected.telefono || "Sin teléfono"}</strong><span>Teléfono</span></div></div>
                    <div className="crm-contact-line"><Mail size={16} /><div><strong>{selected.email || "Sin email"}</strong><span>Email</span></div></div>
                    <div className="crm-contact-line"><Target size={16} /><div><strong>{selected.origen || "Directo"}</strong><span>Origen comercial</span></div></div>
                    {selected.clientId && <button type="button" className="crm-client-button" onClick={() => navigate(`/clientes?cliente=${selected.clientId}`)}>Ver cliente en SERVIX</button>}
                  </section>

                  <section className="crm-detail-card">
                    <span className="crm-side-label">Mover oportunidad</span>
                    <div className="crm-stage-list">
                      {CRM_STAGES.map((stage) => (
                        <button key={stage.key} type="button" className={selected.stage === stage.key ? "active" : ""} onClick={() => handleMove(selected, stage.key)} disabled={movingId === selected.id}>{stage.label}</button>
                      ))}
                    </div>
                  </section>
                </aside>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}
