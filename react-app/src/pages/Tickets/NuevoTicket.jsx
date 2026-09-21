import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom";

import { AnimatePresence, motion } from "motion/react";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowUp,
  CalendarDays,
  Check,
  CircleDollarSign,
  Clock3,
  Cpu,
  Eye,
  FileText,
  Home,
  Laptop,
  MessageCircle,
  Monitor,
  Package,
  Plus,
  Save,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  UserRound,
  Wifi,
  Wrench,
  X,
} from "lucide-react";

import { createTicket } from "../../services/tickets.service.js";
import {
  createClient,
  getClientDisplayName,
  subscribeToClients,
} from "../../services/clientes.service.js";
import { notify } from "../../services/notifications.js";
import { useAuth } from "../../context/AuthContext.jsx";

import technicianCharacter from "./assets/technician-character.png";
import "./NuevoTicket.css";

const EQUIPMENT_TYPES = [
  "Notebook",
  "PC Escritorio",
  "Smartphone",
  "Tablet",
  "Impresora",
  "Consola",
  "Otro",
];

const JOB_TYPES = [
  "Reparación",
  "Diagnóstico",
  "Mantenimiento",
  "Instalación",
  "Soporte",
];

const SERVICE_TYPES = [
  { id: "Taller", label: "Taller", icon: Monitor },
  { id: "Domicilio", label: "Domicilio", icon: Home },
  { id: "Remoto", label: "Remoto", icon: Wifi },
];

const PHYSICAL_ITEMS = [
  ["pantalla", "Pantalla"],
  ["carcasa", "Carcasa"],
  ["teclado", "Teclado"],
  ["puertos", "Puertos"],
  ["bateria", "Batería"],
];

const ACCESSORY_ITEMS = [
  ["cargador", "Cargador"],
  ["funda", "Funda / bolso"],
  ["cable", "Cable"],
];

const EMPTY_NEW_CLIENT = {
  nombre: "",
  apellido: "",
  dni: "",
  cuit: "",
  tel: "",
  email: "",
};

function createEmptyForm() {
  return {
    arrivalStatus: "received",
    jobType: "Reparación",
    serviceType: "Taller",
    equipment: "Notebook",
    brand: "",
    model: "",
    serial: "",
    pin: "",
    specs: "",
    condition: "Buen estado general",
    issue: "",
    visibleObservations: "",
    priority: "P2",
    technician: "Alex",
    estimatedDate: "",
    estimatedBudget: "",
    advance: "",
    paymentMethod: "A definir",
    internalNotes: "",
    warrantyDays: "90",
    physicalState: {
      pantalla: false,
      carcasa: false,
      teclado: false,
      puertos: false,
      bateria: false,
    },
    accessories: {
      cargador: false,
      funda: false,
      cable: false,
    },
    homeService: {
      direccion: "",
      fecha: "",
      hora: "",
      contacto: "",
    },
    remoteService: {
      plataforma: "AnyDesk",
      idConexion: "",
      clave: "",
    },
  };
}

function normalizeText(value) {
  return String(value ?? "").trim().toLowerCase();
}

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function errorMessage(error) {
  const map = {
    TICKET_CLIENT_ARCHIVED: "Ese cliente está archivado. Restauralo antes de crear un ticket.",
    TICKET_HOME_ADDRESS_REQUIRED: "Ingresá la dirección donde se realizará el servicio.",
    TICKET_REMOTE_ID_REQUIRED: "Ingresá el ID o código de conexión remota.",
  };

  return map[error?.message] || error?.message || "No se pudo crear el ticket.";
}

export default function NuevoTicket() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { profile, user } = useAuth();
  const preselectedApplied = useRef(false);

  const author = profile?.nombre || profile?.name || user?.email || "Sistema";

  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [form, setForm] = useState(createEmptyForm);
  const [clientQuery, setClientQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [newClientOpen, setNewClientOpen] = useState(false);
  const [newClientForm, setNewClientForm] = useState(EMPTY_NEW_CLIENT);
  const [savingNewClient, setSavingNewClient] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToClients(
      (data) => {
        setClients(data);
        setLoadingClients(false);
      },
      (error) => {
        console.error(error);
        setLoadingClients(false);
        notify.error("Clientes", "No se pudo cargar la base de clientes.");
      }
    );

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (preselectedApplied.current || !clients.length) return;

    const clientId = searchParams.get("cliente");
    if (!clientId) {
      preselectedApplied.current = true;
      return;
    }

    const client = clients.find((item) => item.id === clientId);
    if (client) {
      setSelectedClient(client);
      setClientQuery(getClientDisplayName(client));
    }

    preselectedApplied.current = true;
  }, [clients, searchParams]);

  const clientSuggestions = useMemo(() => {
    const query = normalizeText(clientQuery);

    const source = query
      ? clients.filter((client) => {
          const haystack = [
            getClientDisplayName(client),
            client.dni,
            client.cuit,
            client.tel,
            client.email,
            client.localidad,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return haystack.includes(query);
        })
      : clients;

    return source.slice(0, 8);
  }, [clients, clientQuery]);

  const selectedClientName = selectedClient
    ? getClientDisplayName(selectedClient)
    : clientQuery.trim() || "Sin seleccionar";

  const priorityLabel = form.priority === "P1" ? "Alta" : form.priority === "P3" ? "Baja" : "Media";
  const initialStage = form.arrivalStatus === "pending" ? "pendiente_ingreso" : "pendiente";

  const updateField = (field, value) => {
    setDirty(true);
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateNestedField = (group, field, value) => {
    setDirty(true);
    setForm((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [field]: value,
      },
    }));
  };

  const toggleObjectField = (group, field) => {
    setDirty(true);
    setForm((current) => ({
      ...current,
      [group]: {
        ...current[group],
        [field]: !current[group][field],
      },
    }));
  };

  const selectClient = (client) => {
    if (client.archivado === true) {
      notify.warning("Cliente archivado", "Restauralo desde Clientes antes de generar un nuevo ticket.");
      return;
    }

    setSelectedClient(client);
    setClientQuery(getClientDisplayName(client));
    setClientSearchOpen(false);
    setDirty(true);
  };

  const clearClient = () => {
    setSelectedClient(null);
    setClientQuery("");
    setClientSearchOpen(false);
    setDirty(true);
  };

  const handleClientInput = (value) => {
    setClientQuery(value);
    setClientSearchOpen(true);
    setDirty(true);

    if (
      selectedClient &&
      normalizeText(value) !== normalizeText(getClientDisplayName(selectedClient))
    ) {
      setSelectedClient(null);
    }
  };

  const openNewClient = () => {
    setNewClientForm({ ...EMPTY_NEW_CLIENT, nombre: clientQuery.trim() });
    setClientSearchOpen(false);
    setNewClientOpen(true);
  };

  const closeNewClient = () => {
    if (savingNewClient) return;
    setNewClientOpen(false);
    setNewClientForm(EMPTY_NEW_CLIENT);
  };

  const updateNewClientField = (field, value) => {
    setNewClientForm((current) => ({ ...current, [field]: value }));
  };

  const handleCreateClient = async () => {
    const name = newClientForm.nombre.trim();

    if (!name) {
      notify.warning("Nombre requerido", "Ingresá al menos el nombre del cliente.");
      return;
    }

    try {
      setSavingNewClient(true);
      const created = await createClient({ ...newClientForm, author });
      setSelectedClient(created);
      setClientQuery(getClientDisplayName(created));
      setNewClientOpen(false);
      setNewClientForm(EMPTY_NEW_CLIENT);
      setDirty(true);
      notify.success("Cliente creado", `${getClientDisplayName(created)} quedó seleccionado para este ticket.`);
    } catch (error) {
      console.error(error);
      if (error?.message === "CLIENT_DUPLICATE") {
        notify.warning("Cliente ya registrado", "Ya existe un cliente con el mismo DNI, CUIT, teléfono o email.");
      } else {
        notify.error("No se pudo crear el cliente", error?.message || "Revisá los datos e intentá nuevamente.");
      }
    } finally {
      setSavingNewClient(false);
    }
  };

  const handleBack = () => {
    if (dirty && !saving) {
      const confirmed = window.confirm("Hay datos sin guardar. ¿Descartar el nuevo ticket?");
      if (!confirmed) return;
    }

    navigate("/tickets");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;

    if (selectedClient?.archivado === true) {
      notify.warning("Cliente archivado", "Restauralo antes de crear una nueva operación.");
      return;
    }

    if (form.serviceType === "Domicilio" && !form.homeService.direccion.trim()) {
      notify.warning("Falta la dirección", "Ingresá dónde se realizará el servicio.");
      return;
    }

    if (form.serviceType === "Remoto" && !form.remoteService.idConexion.trim()) {
      notify.warning("Falta el ID remoto", "Ingresá el ID o código para la conexión.");
      return;
    }

    try {
      setSaving(true);

      const created = await createTicket({
        client: selectedClient,
        clientName: clientQuery.trim() || "Mostrador",
        serviceType: form.serviceType,
        jobType: form.jobType,
        initialStage,
        equipment: form.equipment,
        brand: form.brand,
        model: form.model,
        serial: form.serial,
        pin: form.pin,
        specs: form.specs,
        physicalState: form.physicalState,
        accessories: form.accessories,
        condition: form.condition,
        issue: form.issue,
        visibleObservations: form.visibleObservations,
        initialDiagnosis: "",
        priority: form.priority,
        technician: form.technician,
        estimatedDate: form.estimatedDate,
        estimatedBudget: form.estimatedBudget,
        advance: form.advance,
        paymentMethod: form.paymentMethod,
        internalNotes: form.internalNotes,
        consents: {},
        homeService: form.homeService,
        remoteService: form.remoteService,
        warrantyDays: Number(form.warrantyDays || 90),
        author,
      });

      setDirty(false);
      notify.success(
        "Ticket creado",
        form.arrivalStatus === "pending"
          ? `${created.id} quedó abierto como Pendiente de ingreso.`
          : `${created.id} fue registrado en Recepción.`
      );

      navigate(`/tickets/${encodeURIComponent(created.id)}`, {
        replace: true,
        state: { returnTo: "/tickets" },
      });
    } catch (error) {
      console.error(error);
      notify.error("No se pudo crear el ticket", errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = () => {
    try {
      localStorage.setItem(
        "servix-ticket-draft",
        JSON.stringify({
          form,
          clientQuery,
          selectedClientId: selectedClient?.id || null,
        })
      );
      notify.success("Borrador guardado", "El formulario quedó guardado en este navegador.");
    } catch (draftError) {
      console.error(draftError);
      notify.error("No se pudo guardar", "El navegador no permitió guardar el borrador local.");
    }
  };

  const handleClearForm = () => {
    if (saving) return;
    const confirmed = window.confirm("¿Limpiar todos los datos cargados del nuevo ticket?");
    if (!confirmed) return;

    setForm(createEmptyForm());
    setClientQuery("");
    setSelectedClient(null);
    setClientSearchOpen(false);
    setDirty(false);
  };

  return (
    <main className="new-ticket-page">
      <div className="new-ticket-shell">
        <motion.header
          className="new-ticket-hero new-ticket-hero-dom"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <button type="button" className="new-ticket-back-pill" onClick={handleBack}>
            <ArrowLeft size={17} />
            Volver a Tickets
          </button>

          <div className="new-ticket-hero-copy">
            <motion.div
              className="new-ticket-hero-mark"
              animate={{ y: [0, -4, 0], rotate: [0, -2, 2, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
            >
              <Plus size={24} />
              <FileText size={30} />
            </motion.div>
            <div>
              <h1>Nuevo Ticket</h1>
              <p>Registra un ingreso técnico completo</p>
            </div>
          </div>

          <div className="new-ticket-hero-live" aria-label="Cabecera editable">
            <motion.span className="new-ticket-float-icon phone" animate={{ y: [0, -7, 0] }} transition={{ duration: 3.1, repeat: Infinity }}>
              <Monitor size={24} />
            </motion.span>
            <motion.span className="new-ticket-float-icon gear" animate={{ rotate: [0, 12, 0], y: [0, 5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
              <Settings size={25} />
            </motion.span>
            <motion.span className="new-ticket-float-icon chat" animate={{ y: [0, -6, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3.4, repeat: Infinity }}>
              <MessageCircle size={24} />
            </motion.span>

            <img className="new-ticket-technician" src={technicianCharacter} alt="Técnico de soporte" />

            <div className="new-ticket-hero-quote">
              <Sparkles size={15} />
              <span>“Cada reparación</span>
              <strong>empieza con un buen ingreso”</strong>
            </div>
          </div>
        </motion.header>

        <section className="new-ticket-summary-strip">
          <motion.article whileHover={{ y: -3 }} className="new-ticket-summary-card tone-client">
            <span className="new-ticket-summary-icon"><UserRound size={23} /></span>
            <div><small>Cliente seleccionado</small><strong>{selectedClientName}</strong><span>{selectedClient?.id || "Elegí o creá un cliente"}</span></div>
            {selectedClient && <Check className="new-ticket-summary-check" size={18} />}
          </motion.article>

          <motion.article whileHover={{ y: -3 }} className="new-ticket-summary-card tone-service">
            <span className="new-ticket-summary-icon"><Laptop size={23} /></span>
            <div><small>Tipo de trabajo</small><strong>{form.jobType}</strong><span>{form.serviceType}</span></div>
          </motion.article>

          <motion.article whileHover={{ y: -3 }} className="new-ticket-summary-card tone-priority">
            <span className="new-ticket-summary-icon"><ArrowUp size={23} /></span>
            <div><small>Prioridad</small><strong>{priorityLabel}</strong><span>{form.priority === "P1" ? "Atención preferencial" : "Prioridad de trabajo"}</span></div>
          </motion.article>

          <motion.article whileHover={{ y: -3 }} className="new-ticket-summary-card tone-warranty">
            <span className="new-ticket-summary-icon"><ShieldCheck size={23} /></span>
            <div><small>Garantía del servicio</small><strong>{Number(form.warrantyDays || 0) > 0 ? `${form.warrantyDays} días` : "Sin garantía"}</strong><span>Predeterminado: 90 días</span></div>
          </motion.article>
        </section>

        <section className="new-ticket-arrival-toggle-card">
          <div className="new-ticket-arrival-copy">
            <span className="new-ticket-arrival-icon"><Clock3 size={20} /></span>
            <div>
              <strong>Ingreso del equipo</strong>
              <span>Este estado es opcional: usalo solo cuando el cliente avisó pero todavía no trajo el equipo.</span>
            </div>
          </div>

          <div className="new-ticket-arrival-toggle" role="group" aria-label="Estado inicial del ticket">
            <button
              type="button"
              className={form.arrivalStatus === "received" ? "active" : ""}
              onClick={() => updateField("arrivalStatus", "received")}
            >
              {form.arrivalStatus === "received" && <motion.span layoutId="arrival-active" className="new-ticket-toggle-bg" />}
              <Check size={16} />
              <span>Ya ingresó</span>
              <small>Recepción</small>
            </button>

            <button
              type="button"
              className={form.arrivalStatus === "pending" ? "active pending" : ""}
              onClick={() => updateField("arrivalStatus", "pending")}
            >
              {form.arrivalStatus === "pending" && <motion.span layoutId="arrival-active" className="new-ticket-toggle-bg" />}
              <Clock3 size={16} />
              <span>Pendiente de ingreso</span>
              <small>Aún no llegó</small>
            </button>
          </div>
        </section>

        <form className="new-ticket-layout" onSubmit={handleSubmit}>
          <div className="new-ticket-main-column">
            <div className="new-ticket-top-grid">
              <section className="new-ticket-card">
                <div className="new-ticket-card-head">
                  <div className="new-ticket-card-title">
                    <span className="new-ticket-card-icon client"><UserRound size={19} /></span>
                    <div><strong>Datos del cliente</strong><span>Buscá uno existente o crealo sin salir del ticket.</span></div>
                  </div>
                  <button type="button" className="new-ticket-outline-action" onClick={() => setClientSearchOpen(true)}>
                    <Search size={15} /> Buscar / seleccionar
                  </button>
                </div>

                <div className="new-ticket-card-body">
                  <label className="new-ticket-field new-ticket-client-field">
                    <span>Cliente <b>*</b></span>
                    <div className="new-ticket-input-with-icon">
                      <UserRound size={15} />
                      <input
                        value={clientQuery}
                        onFocus={() => setClientSearchOpen(true)}
                        onChange={(event) => handleClientInput(event.target.value)}
                        placeholder={loadingClients ? "Cargando clientes..." : "Nombre, DNI, teléfono o email"}
                        disabled={saving}
                        autoComplete="off"
                      />
                      {clientQuery && <button type="button" onClick={clearClient}><X size={14} /></button>}
                    </div>

                    <AnimatePresence>
                      {clientSearchOpen && (
                        <motion.div
                          className="new-ticket-client-results"
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                        >
                          {clientSuggestions.length ? (
                            clientSuggestions.map((client) => (
                              <button key={client.id} type="button" onClick={() => selectClient(client)}>
                                <span>{String(getClientDisplayName(client)).slice(0, 2).toUpperCase()}</span>
                                <div><strong>{getClientDisplayName(client)}</strong><small>{[client.dni || client.cuit, client.tel, client.email].filter(Boolean).join(" · ") || client.id}</small></div>
                              </button>
                            ))
                          ) : (
                            <div className="new-ticket-client-empty">No encontramos coincidencias.</div>
                          )}

                          <button type="button" className="new-ticket-create-client" onClick={openNewClient}>
                            <UserPlus size={15} /> Crear cliente nuevo
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </label>

                  <div className="new-ticket-grid-2">
                    <label className="new-ticket-field">
                      <span>Documento</span>
                      <input value={selectedClient?.dni || selectedClient?.cuit || ""} readOnly placeholder="—" />
                    </label>
                    <label className="new-ticket-field">
                      <span>Teléfono</span>
                      <input value={selectedClient?.tel || ""} readOnly placeholder="—" />
                    </label>
                    <label className="new-ticket-field new-ticket-span-2">
                      <span>Email</span>
                      <input value={selectedClient?.email || ""} readOnly placeholder="—" />
                    </label>
                  </div>
                </div>
              </section>

              <section className="new-ticket-card">
                <div className="new-ticket-card-head">
                  <div className="new-ticket-card-title">
                    <span className="new-ticket-card-icon equipment"><Cpu size={19} /></span>
                    <div><strong>Datos del equipo</strong><span>Identificación y recepción física del equipo.</span></div>
                  </div>
                </div>

                <div className="new-ticket-card-body">
                  <div className="new-ticket-grid-3">
                    <label className="new-ticket-field">
                      <span>Tipo de equipo <b>*</b></span>
                      <select value={form.equipment} onChange={(event) => updateField("equipment", event.target.value)} disabled={saving}>
                        {EQUIPMENT_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="new-ticket-field">
                      <span>Marca</span>
                      <input value={form.brand} onChange={(event) => updateField("brand", event.target.value)} placeholder="Lenovo, HP, Samsung..." disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Modelo</span>
                      <input value={form.model} onChange={(event) => updateField("model", event.target.value)} placeholder="Modelo del equipo" disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Número de serie</span>
                      <input value={form.serial} onChange={(event) => updateField("serial", event.target.value)} placeholder="Serie / S/N" disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Contraseña / PIN</span>
                      <input value={form.pin} onChange={(event) => updateField("pin", event.target.value)} placeholder="Opcional" disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Estado general</span>
                      <input value={form.condition} onChange={(event) => updateField("condition", event.target.value)} placeholder="Buen estado general" disabled={saving} />
                    </label>
                  </div>

                  <div className="new-ticket-equipment-flags">
                    <div>
                      <span className="new-ticket-sub-label">Detalles físicos</span>
                      <div className="new-ticket-chip-toggle-row">
                        {PHYSICAL_ITEMS.map(([key, label]) => (
                          <motion.button
                            key={key}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            className={form.physicalState[key] ? "active warning" : ""}
                            onClick={() => toggleObjectField("physicalState", key)}
                          >
                            <AlertTriangle size={13} /> {label}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="new-ticket-sub-label">Accesorios recibidos</span>
                      <div className="new-ticket-chip-toggle-row accessories">
                        {ACCESSORY_ITEMS.map(([key, label]) => (
                          <motion.button
                            key={key}
                            type="button"
                            whileTap={{ scale: 0.96 }}
                            className={form.accessories[key] ? "active" : ""}
                            onClick={() => toggleObjectField("accessories", key)}
                          >
                            <Package size={13} /> {label}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="new-ticket-bottom-grid">
              <section className="new-ticket-card">
                <div className="new-ticket-card-head">
                  <div className="new-ticket-card-title">
                    <span className="new-ticket-card-icon fault"><Wrench size={19} /></span>
                    <div><strong>Falla reportada</strong><span>Lo que informa el cliente al momento de abrir la orden.</span></div>
                  </div>
                </div>

                <div className="new-ticket-card-body">
                  <label className="new-ticket-field">
                    <span>Problema informado por el cliente <b>*</b></span>
                    <textarea
                      value={form.issue}
                      onChange={(event) => updateField("issue", event.target.value)}
                      placeholder="Ej: La notebook no enciende desde esta mañana..."
                      disabled={saving}
                    />
                  </label>

                  <label className="new-ticket-field">
                    <span>Observaciones visibles</span>
                    <textarea
                      value={form.visibleObservations}
                      onChange={(event) => updateField("visibleObservations", event.target.value)}
                      placeholder="Estado exterior, marcas, faltantes u observaciones de recepción."
                      disabled={saving}
                    />
                  </label>

                  <div className="new-ticket-diagnosis-hint">
                    <Search size={17} />
                    <div>
                      <strong>El diagnóstico no se carga acá.</strong>
                      <span>Se registra una sola vez desde Detalle del Ticket. Después, cada avance se guarda como nota de bitácora con fecha y hora.</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="new-ticket-card">
                <div className="new-ticket-card-head">
                  <div className="new-ticket-card-title">
                    <span className="new-ticket-card-icon service"><Settings size={19} /></span>
                    <div><strong>Servicio y presupuesto</strong><span>Organización inicial de la orden.</span></div>
                  </div>
                </div>

                <div className="new-ticket-card-body">
                  <div className="new-ticket-grid-2">
                    <label className="new-ticket-field">
                      <span>Tipo de trabajo</span>
                      <select value={form.jobType} onChange={(event) => updateField("jobType", event.target.value)} disabled={saving}>
                        {JOB_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                      </select>
                    </label>
                    <label className="new-ticket-field">
                      <span>Modalidad</span>
                      <select value={form.serviceType} onChange={(event) => updateField("serviceType", event.target.value)} disabled={saving}>
                        {SERVICE_TYPES.map((type) => <option key={type.id} value={type.id}>{type.label}</option>)}
                      </select>
                    </label>
                    <label className="new-ticket-field">
                      <span>Técnico asignado</span>
                      <input value={form.technician} onChange={(event) => updateField("technician", event.target.value)} placeholder="Técnico" disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Prioridad</span>
                      <select value={form.priority} onChange={(event) => updateField("priority", event.target.value)} disabled={saving}>
                        <option value="P1">Alta</option>
                        <option value="P2">Media</option>
                        <option value="P3">Baja</option>
                      </select>
                    </label>
                    <label className="new-ticket-field">
                      <span>Fecha estimada</span>
                      <input type="date" value={form.estimatedDate} onChange={(event) => updateField("estimatedDate", event.target.value)} disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Garantía del servicio</span>
                      <select value={form.warrantyDays} onChange={(event) => updateField("warrantyDays", event.target.value)} disabled={saving}>
                        <option value="0">Sin garantía</option>
                        <option value="30">30 días</option>
                        <option value="60">60 días</option>
                        <option value="90">90 días / 3 meses</option>
                        <option value="180">180 días</option>
                      </select>
                    </label>
                    <label className="new-ticket-field">
                      <span>Presupuesto estimado</span>
                      <input type="number" min="0" value={form.estimatedBudget} onChange={(event) => updateField("estimatedBudget", event.target.value)} placeholder="0" disabled={saving} />
                    </label>
                    <label className="new-ticket-field">
                      <span>Adelanto</span>
                      <input type="number" min="0" value={form.advance} onChange={(event) => updateField("advance", event.target.value)} placeholder="0" disabled={saving} />
                    </label>
                    <label className="new-ticket-field new-ticket-span-2">
                      <span>Forma de pago</span>
                      <select value={form.paymentMethod} onChange={(event) => updateField("paymentMethod", event.target.value)} disabled={saving}>
                        <option value="A definir">A definir</option>
                        <option value="Transferencia">Transferencia</option>
                        <option value="Efectivo">Efectivo</option>
                        <option value="Tarjeta">Tarjeta</option>
                        <option value="Cuenta corriente">Cuenta corriente</option>
                      </select>
                    </label>
                  </div>

                  {form.serviceType === "Domicilio" && (
                    <motion.div className="new-ticket-conditional-box" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="new-ticket-grid-2">
                        <label className="new-ticket-field new-ticket-span-2">
                          <span>Dirección del servicio <b>*</b></span>
                          <input value={form.homeService.direccion} onChange={(event) => updateNestedField("homeService", "direccion", event.target.value)} placeholder="Dirección" />
                        </label>
                        <label className="new-ticket-field"><span>Fecha</span><input type="date" value={form.homeService.fecha} onChange={(event) => updateNestedField("homeService", "fecha", event.target.value)} /></label>
                        <label className="new-ticket-field"><span>Hora</span><input type="time" value={form.homeService.hora} onChange={(event) => updateNestedField("homeService", "hora", event.target.value)} /></label>
                      </div>
                    </motion.div>
                  )}

                  {form.serviceType === "Remoto" && (
                    <motion.div className="new-ticket-conditional-box" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}>
                      <div className="new-ticket-grid-2">
                        <label className="new-ticket-field"><span>Plataforma</span><input value={form.remoteService.plataforma} onChange={(event) => updateNestedField("remoteService", "plataforma", event.target.value)} /></label>
                        <label className="new-ticket-field"><span>ID de conexión <b>*</b></span><input value={form.remoteService.idConexion} onChange={(event) => updateNestedField("remoteService", "idConexion", event.target.value)} /></label>
                      </div>
                    </motion.div>
                  )}
                </div>
              </section>
            </div>

            <section className="new-ticket-card new-ticket-notes-card">
              <div className="new-ticket-card-head">
                <div className="new-ticket-card-title">
                  <span className="new-ticket-card-icon note"><FileText size={19} /></span>
                  <div><strong>Nota interna inicial</strong><span>Opcional. Queda registrada en la bitácora con fecha, hora y autor.</span></div>
                </div>
              </div>
              <div className="new-ticket-card-body">
                <label className="new-ticket-field">
                  <textarea
                    value={form.internalNotes}
                    onChange={(event) => updateField("internalNotes", event.target.value)}
                    placeholder="Ej: Cliente avisa que necesita el equipo para el viernes. Se coordinó revisión prioritaria."
                    disabled={saving}
                  />
                </label>
              </div>
            </section>
          </div>

          <aside className="new-ticket-side-column">
            <section className="new-ticket-side-card new-ticket-live-summary">
              <div className="new-ticket-side-head">
                <div><Eye size={18} /><strong>Resumen en vivo</strong></div>
                <span>Borrador</span>
              </div>

              <div className="new-ticket-preview-code">
                <motion.span animate={{ rotate: [0, -5, 5, 0] }} transition={{ duration: 3, repeat: Infinity }}><FileText size={22} /></motion.span>
                <strong>TK-00XXX</strong>
              </div>

              <dl>
                <div><dt><UserRound size={15} /> Cliente</dt><dd>{selectedClientName}</dd></div>
                <div><dt><Cpu size={15} /> Equipo</dt><dd>{[form.equipment, form.brand, form.model].filter(Boolean).join(" · ")}</dd></div>
                <div><dt><Clock3 size={15} /> Estado inicial</dt><dd>{initialStage === "pendiente_ingreso" ? "Pendiente de ingreso" : "Recepción"}</dd></div>
                <div><dt><Wrench size={15} /> Trabajo</dt><dd>{form.jobType}</dd></div>
                <div><dt><AlertTriangle size={15} /> Prioridad</dt><dd>{priorityLabel}</dd></div>
                <div><dt><CircleDollarSign size={15} /> Costo estimado</dt><dd>{formatMoney(form.estimatedBudget)}</dd></div>
              </dl>
            </section>

            <section className="new-ticket-side-card new-ticket-side-info">
              <div className="new-ticket-side-head"><div><ShieldCheck size={18} /><strong>Reglas del ingreso</strong></div></div>
              <div className="new-ticket-rule-list">
                <span><Check size={14} /> El número de ticket se genera automáticamente.</span>
                <span><Check size={14} /> Pendiente de ingreso es opcional.</span>
                <span><Check size={14} /> El diagnóstico se registra una sola vez después.</span>
                <span><Check size={14} /> Las notas posteriores forman la bitácora cronológica.</span>
              </div>
            </section>

            <section className="new-ticket-side-card new-ticket-side-actions">
              <div className="new-ticket-side-head"><div><Save size={18} /><strong>Acciones</strong></div></div>
              <button type="button" onClick={handleSaveDraft}><Save size={15} /> Guardar borrador</button>
              <motion.button type="submit" className="primary" disabled={saving} whileTap={{ scale: 0.98 }}>
                <Plus size={15} /> {saving ? "Creando..." : "Crear ticket"}
              </motion.button>
              <button type="button" className="danger" disabled={saving} onClick={handleClearForm}><Trash2 size={15} /> Limpiar formulario</button>
            </section>
          </aside>
        </form>
      </div>

      {newClientOpen && (
        <div className="new-ticket-client-modal-backdrop" onMouseDown={closeNewClient}>
          <motion.div
            className="new-ticket-client-modal"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-ticket-client-modal-head">
              <div>
                <span className="new-ticket-client-modal-icon"><UserPlus size={20} /></span>
                <div><strong>Dar de alta cliente</strong><span>Crealo sin salir del nuevo ticket.</span></div>
              </div>
              <button type="button" onClick={closeNewClient} disabled={savingNewClient}><X size={18} /></button>
            </div>

            <div className="new-ticket-client-modal-body">
              <div className="new-ticket-grid-2">
                <label className="new-ticket-field"><span>Nombre <b>*</b></span><input value={newClientForm.nombre} onChange={(event) => updateNewClientField("nombre", event.target.value)} autoFocus disabled={savingNewClient} /></label>
                <label className="new-ticket-field"><span>Apellido</span><input value={newClientForm.apellido} onChange={(event) => updateNewClientField("apellido", event.target.value)} disabled={savingNewClient} /></label>
                <label className="new-ticket-field"><span>DNI</span><input value={newClientForm.dni} onChange={(event) => updateNewClientField("dni", event.target.value)} disabled={savingNewClient} /></label>
                <label className="new-ticket-field"><span>CUIT</span><input value={newClientForm.cuit} onChange={(event) => updateNewClientField("cuit", event.target.value)} disabled={savingNewClient} /></label>
                <label className="new-ticket-field"><span>Teléfono</span><input value={newClientForm.tel} onChange={(event) => updateNewClientField("tel", event.target.value)} disabled={savingNewClient} /></label>
                <label className="new-ticket-field"><span>Email</span><input type="email" value={newClientForm.email} onChange={(event) => updateNewClientField("email", event.target.value)} disabled={savingNewClient} /></label>
              </div>
            </div>

            <div className="new-ticket-client-modal-actions">
              <button type="button" className="secondary" onClick={closeNewClient} disabled={savingNewClient}>Cancelar</button>
              <button type="button" className="primary" onClick={handleCreateClient} disabled={savingNewClient}>
                <UserPlus size={17} /> {savingNewClient ? "Creando..." : "Crear y seleccionar"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
