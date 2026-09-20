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

import {
  motion,
} from "motion/react";

import {
  ArrowLeft,
  Clock3,
  Check,
  CircleAlert,
  Cpu,
  Home,
  MapPin,
  Monitor,
  Save,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Wifi,
  Wrench,
  X,
} from "lucide-react";

import {
  createTicket,
  subscribeToTickets,
} from "../../services/tickets.service.js";

import {
  createClient,
  getClientDisplayName,
  subscribeToClients,
} from "../../services/clientes.service.js";

import {
  subscribeToBusinessConfig,
} from "../../services/configuracion.service.js";

import {
  notify,
} from "../../services/notifications.js";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import "./NuevoTicket.css";

/* =========================================
   CONSTANTES
========================================= */

const EQUIPMENT_TYPES = [
  "Notebook",
  "PC Escritorio",
  "Smartphone",
  "Tablet",
  "Impresora",
  "Consola",
  "Otro",
];

const SERVICE_TYPES = [
  {
    id: "Taller",
    label: "Taller",
    description: "El equipo ingresa al taller.",
    icon: Monitor,
  },
  {
    id: "Domicilio",
    label: "Domicilio",
    description: "Servicio en la ubicación del cliente.",
    icon: Home,
  },
  {
    id: "Remoto",
    label: "Remoto",
    description: "Asistencia mediante conexión remota.",
    icon: Wifi,
  },
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
  ["funda", "Funda"],
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

/* =========================================
   FORMULARIO VACÍO
========================================= */

function createEmptyForm(
  warrantyDays = 30
) {
  return {
    serviceType:
      "Taller",

    equipment:
      "Notebook",

    brand:
      "",

    model:
      "",

    serial:
      "",

    pin:
      "",

    specs:
      "",

    condition:
      "",

    warrantyDays:
      String(
        warrantyDays
      ),

    physicalState: {
      pantalla:
        false,

      carcasa:
        false,

      teclado:
        false,

      cargador:
        false,

      bateria:
        false,

      puertos:
        false,
    },

    accessories: {
      cargador:
        false,

      funda:
        false,

      cable:
        false,
    },

    homeService: {
      direccion:
        "",

      fecha:
        "",

      hora:
        "",

      contacto:
        "",
    },

    remoteService: {
      plataforma:
        "AnyDesk",

      idConexion:
        "",

      clave:
        "",
    },
  };
}

/* =========================================
   HELPERS
========================================= */

function normalizeText(
  value
) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      String(value).length ===
      10
        ? `${value}T12:00:00`
        : value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(
    date
  );
}

function errorMessage(
  error
) {
  const map = {
    TICKET_CLIENT_ARCHIVED:
      "Ese cliente está archivado. Restauralo antes de crear un ticket.",

    TICKET_HOME_ADDRESS_REQUIRED:
      "Ingresá la dirección donde se realizará el servicio.",

    TICKET_REMOTE_ID_REQUIRED:
      "Ingresá el ID o código de conexión remota.",

  };

  return (
    map[
      error?.message
    ] ||
    error?.message ||
    "No se pudo crear el ticket."
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function NuevoTicket() {
  const navigate =
    useNavigate();

  const [
    searchParams,
  ] =
    useSearchParams();

  const {
    profile,
    user,
  } =
    useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  /* =======================================
     DATOS FIREBASE
  ======================================= */

  const [
    clients,
    setClients,
  ] =
    useState([]);

  const [
    tickets,
    setTickets,
  ] =
    useState([]);

  const [
    loadingClients,
    setLoadingClients,
  ] =
    useState(true);

  const [
    defaultWarrantyDays,
    setDefaultWarrantyDays,
  ] =
    useState(30);

  /* =======================================
     FORMULARIO
  ======================================= */

  const [
    form,
    setForm,
  ] =
    useState(
      () =>
        createEmptyForm(
          30
        )
    );

  const [
    clientQuery,
    setClientQuery,
  ] =
    useState("");

  const [
    selectedClient,
    setSelectedClient,
  ] =
    useState(null);

  const [
    clientSearchOpen,
    setClientSearchOpen,
  ] =
    useState(false);

  const [
    newClientOpen,
    setNewClientOpen,
  ] =
    useState(false);

  const [
    newClientForm,
    setNewClientForm,
  ] =
    useState(EMPTY_NEW_CLIENT);

  const [
    savingNewClient,
    setSavingNewClient,
  ] =
    useState(false);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    dirty,
    setDirty,
  ] =
    useState(false);

  const preselectedApplied =
    useRef(false);

  /* =======================================
     SUSCRIPCIONES
  ======================================= */

  useEffect(
    () => {
      const unsubscribe =
        subscribeToClients(
          (
            data
          ) => {
            setClients(
              data
            );

            setLoadingClients(
              false
            );
          },

          (
            error
          ) => {
            console.error(
              error
            );

            setLoadingClients(
              false
            );

            notify.error(
              "Clientes",
              "No se pudo cargar la base de clientes."
            );
          }
        );

      return () => {
        unsubscribe();
      };
    },
    []
  );

  useEffect(
    () => {
      const unsubscribe =
        subscribeToTickets(
          (
            data
          ) => {
            setTickets(
              data
            );
          },

          (
            error
          ) => {
            console.error(
              error
            );
          }
        );

      return () => {
        unsubscribe();
      };
    },
    []
  );

  useEffect(
    () => {
      const unsubscribe =
        subscribeToBusinessConfig(
          (
            config
          ) => {
            const days =
              Number(
                config
                  ?.garantiaDias
              );

            if (
              Number.isFinite(
                days
              ) &&
              days >= 0
            ) {
              const normalized =
                Math.trunc(
                  days
                );

              setDefaultWarrantyDays(
                normalized
              );

              setForm(
                (
                  current
                ) => {
                  if (
                    current
                      .warrantyDays !==
                      "30"
                  ) {
                    return current;
                  }

                  return {
                    ...current,

                    warrantyDays:
                      String(
                        normalized
                      ),
                  };
                }
              );
            }
          },

          (
            error
          ) => {
            console.error(
              error
            );
          }
        );

      return () => {
        unsubscribe();
      };
    },
    []
  );

  /* =======================================
     CLIENTE PRESELECCIONADO POR URL
     /tickets/nuevo?cliente=ID
  ======================================= */

  useEffect(
    () => {
      if (
        preselectedApplied
          .current ||
        !clients.length
      ) {
        return;
      }

      const clientId =
        searchParams.get(
          "cliente"
        );

      if (!clientId) {
        preselectedApplied.current =
          true;

        return;
      }

      const client =
        clients.find(
          (
            item
          ) =>
            item.id ===
            clientId
        );

      if (client) {
        setSelectedClient(
          client
        );

        setClientQuery(
          getClientDisplayName(
            client
          )
        );
      }

      preselectedApplied.current =
        true;
    },
    [
      clients,
      searchParams,
    ]
  );

  /* =======================================
     SUGERENCIAS CLIENTE
  ======================================= */

  const clientSuggestions =
    useMemo(
      () => {
        const query =
          normalizeText(
            clientQuery
          );

        if (
          !query
        ) {
          return clients
            .slice(
              0,
              8
            );
        }

        return clients
          .filter(
            (
              client
            ) => {
              const source =
                [
                  getClientDisplayName(
                    client
                  ),

                  client.dni,

                  client.cuit,

                  client.tel,

                  client.email,

                  client.localidad,
                ]
                  .filter(
                    Boolean
                  )
                  .join(
                    " "
                  )
                  .toLowerCase();

              return source.includes(
                query
              );
            }
          )
          .slice(
            0,
            8
          );
      },
      [
        clients,
        clientQuery,
      ]
    );

  /* =======================================
     GARANTÍAS VIGENTES
  ======================================= */

  const activeWarranties =
    useMemo(
      () => {
        if (
          !selectedClient
        ) {
          return [];
        }

        const today =
          new Date()
            .toISOString()
            .split(
              "T"
            )[0];

        const clientName =
          normalizeText(
            getClientDisplayName(
              selectedClient
            )
          );

        return tickets.filter(
          (
            ticket
          ) => {
            const sameClient =
              ticket.clienteId
                ? ticket.clienteId ===
                  selectedClient.id
                : normalizeText(
                    ticket.cliente
                  ) ===
                  clientName;

            return (
              sameClient &&
              ticket
                .garantiaVencimiento &&
              ticket
                .garantiaVencimiento >=
                today
            );
          }
        );
      },
      [
        selectedClient,
        tickets,
      ]
    );

  /* =======================================
     HELPERS FORM
  ======================================= */

  const updateField =
    (
      field,
      value
    ) => {
      setDirty(
        true
      );

      setForm(
        (
          current
        ) => ({
          ...current,

          [field]:
            value,
        })
      );
    };

  const updateNestedField =
    (
      group,
      field,
      value
    ) => {
      setDirty(
        true
      );

      setForm(
        (
          current
        ) => ({
          ...current,

          [group]: {
            ...current[
              group
            ],

            [field]:
              value,
          },
        })
      );
    };

  const togglePhysical =
    (
      field
    ) => {
      setDirty(
        true
      );

      setForm(
        (
          current
        ) => ({
          ...current,

          physicalState: {
            ...current
              .physicalState,

            [field]:
              !current
                .physicalState[
                  field
                ],
          },
        })
      );
    };

  const toggleAccessory =
    (
      field
    ) => {
      setDirty(
        true
      );

      setForm(
        (
          current
        ) => ({
          ...current,

          accessories: {
            ...current
              .accessories,

            [field]:
              !current
                .accessories[
                  field
                ],
          },
        })
      );
    };

  /* =======================================
     SELECCIONAR CLIENTE
  ======================================= */

  const selectClient =
    (
      client
    ) => {
      if (
        client.archivado ===
        true
      ) {
        notify.warning(
          "Cliente archivado",
          "Restauralo desde Clientes antes de generar un nuevo ticket."
        );

        return;
      }

      setSelectedClient(
        client
      );

      setClientQuery(
        getClientDisplayName(
          client
        )
      );

      setClientSearchOpen(
        false
      );

      setDirty(
        true
      );
    };

  const clearClient =
    () => {
      setSelectedClient(
        null
      );

      setClientQuery(
        ""
      );

      setClientSearchOpen(
        false
      );

      setDirty(
        true
      );
    };

  const handleClientInput =
    (
      value
    ) => {
      setClientQuery(
        value
      );

      setClientSearchOpen(
        true
      );

      setDirty(
        true
      );

      if (
        selectedClient &&
        normalizeText(
          value
        ) !==
          normalizeText(
            getClientDisplayName(
              selectedClient
            )
          )
      ) {
        setSelectedClient(
          null
        );
      }
    };

  const openNewClient =
    () => {
      setNewClientForm({
        ...EMPTY_NEW_CLIENT,
        nombre:
          clientQuery.trim(),
      });

      setClientSearchOpen(false);
      setNewClientOpen(true);
    };

  const closeNewClient =
    () => {
      if (savingNewClient) {
        return;
      }

      setNewClientOpen(false);
      setNewClientForm(EMPTY_NEW_CLIENT);
    };

  const updateNewClientField =
    (field, value) => {
      setNewClientForm((current) => ({
        ...current,
        [field]: value,
      }));
    };

  const handleCreateClient =
    async () => {
      const name =
        newClientForm.nombre.trim();

      if (!name) {
        notify.warning(
          "Nombre requerido",
          "Ingresá al menos el nombre del cliente."
        );
        return;
      }

      try {
        setSavingNewClient(true);

        const created =
          await createClient({
            ...newClientForm,
            author,
          });

        setSelectedClient(created);
        setClientQuery(
          getClientDisplayName(created)
        );
        setClientSearchOpen(false);
        setNewClientOpen(false);
        setNewClientForm(EMPTY_NEW_CLIENT);
        setDirty(true);

        notify.success(
          "Cliente creado",
          `${getClientDisplayName(created)} quedó seleccionado para este ticket.`
        );
      } catch (error) {
        console.error(error);

        if (error?.message === "CLIENT_DUPLICATE") {
          notify.warning(
            "Cliente ya registrado",
            "Ya existe un cliente con el mismo DNI, CUIT, teléfono o email."
          );
        } else {
          notify.error(
            "No se pudo crear el cliente",
            error?.message || "Revisá los datos e intentá nuevamente."
          );
        }
      } finally {
        setSavingNewClient(false);
      }
    };

  /* =======================================
     VOLVER
  ======================================= */

  const handleBack =
    () => {
      if (
        dirty &&
        !saving
      ) {
        const confirmed =
          window.confirm(
            "Hay datos sin guardar. ¿Descartar el nuevo ticket?"
          );

        if (
          !confirmed
        ) {
          return;
        }
      }

      navigate(
        "/tickets"
      );
    };

  /* =======================================
     CREAR TICKET
  ======================================= */

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      if (
        saving
      ) {
        return;
      }

      if (
        selectedClient
          ?.archivado ===
        true
      ) {
        notify.warning(
          "Cliente archivado",
          "Restauralo antes de crear una nueva operación."
        );

        return;
      }

      if (
        form.serviceType ===
          "Domicilio" &&
        !form
          .homeService
          .direccion
          .trim()
      ) {
        notify.warning(
          "Falta la dirección",
          "Ingresá dónde se realizará el servicio."
        );

        return;
      }

      if (
        form.serviceType ===
          "Remoto" &&
        !form
          .remoteService
          .idConexion
          .trim()
      ) {
        notify.warning(
          "Falta el ID remoto",
          "Ingresá el ID o código para la conexión."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        const created =
          await createTicket({
            client:
              selectedClient,

            clientName:
              clientQuery.trim() ||
              "Mostrador",

            serviceType:
              form.serviceType,

            equipment:
              form.equipment,

            brand:
              form.brand,

            model:
              form.model,

            serial:
              form.serial,

            pin:
              form.pin,

            specs:
              form.specs,

            physicalState:
              form.physicalState,

            accessories:
              form.accessories,

            condition:
              form.condition,

            homeService:
              form.homeService,

            remoteService:
              form.remoteService,

            warrantyDays:
              Number(
                form
                  .warrantyDays ||
                  defaultWarrantyDays
              ),

            author,
          });

        setDirty(
          false
        );

        notify.success(
          "Ticket creado",
          `${created.id} fue registrado correctamente.`
        );

        navigate(
          `/tickets/${encodeURIComponent(
            created.id
          )}`,

          {
            replace:
              true,

            state: {
              returnTo:
                "/tickets",
            },
          }
        );
      } catch (
        error
      ) {
        console.error(
          error
        );

        notify.error(
          "No se pudo crear el ticket",
          errorMessage(
            error
          )
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =========================================
     ESTADO VISUAL DEL ALTA
  ========================================= */

  const serviceReady =
    form.serviceType ===
    "Domicilio"
      ? Boolean(
          form
            .homeService
            .direccion
            .trim()
        )
      : form.serviceType ===
          "Remoto"
        ? Boolean(
            form
              .remoteService
              .idConexion
              .trim()
          )
        : true;

  const clientReady =
    Boolean(
      clientQuery.trim()
    );

  const equipmentReady =
    Boolean(
      form.equipment &&
        (
          form.brand.trim() ||
          form.model.trim()
        )
    );

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="new-ticket-page">
      <form
        className="new-ticket-shell"
        onSubmit={
          handleSubmit
        }
      >
        {/* =================================
            HEADER
        ================================= */}

        <header className="new-ticket-header">
          <div className="new-ticket-header-left">
            <button
              type="button"
              className="new-ticket-back"
              onClick={
                handleBack
              }
              disabled={
                saving
              }
              title="Volver a Tickets"
            >
              <ArrowLeft
                size={
                  19
                }
              />
            </button>

            <div className="new-ticket-header-icon">
              <Wrench
                size={
                  20
                }
              />
            </div>

            <div className="new-ticket-header-copy">
              <strong>
                Nuevo ticket
              </strong>

              <span>
                SERVIX · Ingreso de servicio técnico
              </span>
            </div>
          </div>

          <div className="new-ticket-header-actions">
            <button
              type="button"
              className="new-ticket-discard"
              onClick={
                handleBack
              }
              disabled={
                saving
              }
            >
              Descartar
            </button>

            <motion.button
              type="submit"
              className="new-ticket-save"
              disabled={
                saving
              }
              whileHover={
                saving
                  ? undefined
                  : {
                      y: -2,
                    }
              }
              whileTap={
                saving
                  ? undefined
                  : {
                      scale:
                        0.98,
                    }
              }
            >
              {saving ? (
                <>
                  <span className="new-ticket-spinner" />
                  Creando...
                </>
              ) : (
                <>
                  <Save
                    size={
                      17
                    }
                  />
                  Crear ticket
                </>
              )}
            </motion.button>
          </div>
        </header>

        {/* =================================
            INTRO
        ================================= */}

        <section className="new-ticket-intro">
          <div>
            <span className="new-ticket-eyebrow">
              <Wrench
                size={
                  14
                }
              />
              Operación técnica
            </span>

            <h1>
              Ingreso de nuevo servicio
            </h1>

            <p>
              Registrá modalidad, cliente y equipo en una sola pantalla sin perder trazabilidad técnica.
            </p>
          </div>

          <div className="new-ticket-draft-state">
            <span />
            <div>
              <strong>
                {dirty
                  ? "Cambios sin guardar"
                  : "Formulario listo"}
              </strong>
              <small>
                {saving
                  ? "Guardando en Firebase..."
                  : "Se registrará al crear el ticket"}
              </small>
            </div>
          </div>
        </section>

        {/* =================================
            GARANTÍA VIGENTE
        ================================= */}

        {activeWarranties.length >
          0 && (
          <section className="new-ticket-warranty-alert">
            <div className="new-ticket-warranty-icon">
              <ShieldCheck
                size={
                  21
                }
              />
            </div>

            <div>
              <strong>
                El cliente tiene garantía vigente
              </strong>

              <p>
                Revisá si este ingreso corresponde a una reparación anterior antes de crear una nueva operación.
              </p>

              <div className="new-ticket-warranty-list">
                {activeWarranties.map(
                  (
                    ticket
                  ) => (
                    <span
                      key={
                        ticket.id
                      }
                    >
                      <b>
                        {ticket.id}
                      </b>
                      {" · "}
                      {ticket.equipo ||
                        "Equipo"}
                      {" · vence "}
                      {formatDate(
                        ticket
                          .garantiaVencimiento
                      )}
                    </span>
                  )
                )}
              </div>
            </div>
          </section>
        )}

        {/* =================================
            LAYOUT PRINCIPAL
        ================================= */}

        <div className="new-ticket-layout">
          <div className="new-ticket-main-column">
            {/* ===============================
                1. MODALIDAD
            =============================== */}

            <section className="new-ticket-card">
              <div className="new-ticket-card-head">
                <div className="new-ticket-card-title">
                  <div className="new-ticket-card-icon service">
                    <Wrench
                      size={
                        19
                      }
                    />
                  </div>

                  <div>
                    <strong>
                      1. Modalidad del servicio
                    </strong>
                    <span>
                      Definí cómo se va a realizar el trabajo
                    </span>
                  </div>
                </div>

                <span className="new-ticket-badge violet">
                  Paso inicial
                </span>
              </div>

              <div className="new-ticket-card-body">
                <div className="new-ticket-progress-rail">
                  <div className={`new-ticket-progress-step ${serviceReady ? "done" : "active"}`}>
                    <Wrench size={17} />
                    Modalidad
                  </div>

                  <div className={`new-ticket-progress-step ${clientReady ? "done" : serviceReady ? "active" : ""}`}>
                    <UserRound size={17} />
                    Cliente
                  </div>

                  <div className={`new-ticket-progress-step ${equipmentReady ? "done" : clientReady ? "active" : ""}`}>
                    <Cpu size={17} />
                    Equipo
                  </div>

                </div>

                <div className="new-ticket-service-grid">
                  {SERVICE_TYPES.map(
                    (
                      service
                    ) => {
                      const Icon =
                        service.icon;

                      const active =
                        form.serviceType ===
                        service.id;

                      return (
                        <button
                          key={
                            service.id
                          }
                          type="button"
                          className={
                            active
                              ? "active"
                              : ""
                          }
                          disabled={
                            saving
                          }
                          onClick={() =>
                            updateField(
                              "serviceType",
                              service.id
                            )
                          }
                        >
                          {active && (
                            <span className="new-ticket-choice-check">
                              <Check size={13} />
                            </span>
                          )}

                          <span className="new-ticket-choice-icon">
                            <Icon
                              size={
                                20
                              }
                            />
                          </span>

                          <strong>
                            {service.label}
                          </strong>

                          <span>
                            {service.description}
                          </span>
                        </button>
                      );
                    }
                  )}
                </div>

                {form.serviceType ===
                  "Domicilio" && (
                  <div className="new-ticket-service-panel home">
                    <div className="new-ticket-service-panel-title">
                      <MapPin
                        size={
                          17
                        }
                      />
                      <strong>
                        Datos del servicio a domicilio
                      </strong>
                    </div>

                    <div className="new-ticket-four-columns">
                      <label className="new-ticket-field">
                        <span>
                          Dirección *
                        </span>
                        <input
                          type="text"
                          value={
                            form
                              .homeService
                              .direccion
                          }
                          placeholder="Calle, número, localidad"
                          disabled={
                            saving
                          }
                          onChange={
                            (
                              event
                            ) =>
                              updateNestedField(
                                "homeService",
                                "direccion",
                                event
                                  .target
                                  .value
                              )
                          }
                        />
                      </label>

                      <label className="new-ticket-field">
                        <span>
                          Fecha
                        </span>
                        <input
                          type="date"
                          value={
                            form
                              .homeService
                              .fecha
                          }
                          disabled={
                            saving
                          }
                          onChange={
                            (
                              event
                            ) =>
                              updateNestedField(
                                "homeService",
                                "fecha",
                                event
                                  .target
                                  .value
                              )
                          }
                        />
                      </label>

                      <label className="new-ticket-field">
                        <span>
                          Hora
                        </span>
                        <div className="new-ticket-icon-input">
                          <Clock3 size={15} />
                          <input
                            type="time"
                            value={
                              form
                                .homeService
                                .hora
                            }
                            disabled={
                              saving
                            }
                            onChange={
                              (
                                event
                              ) =>
                                updateNestedField(
                                  "homeService",
                                  "hora",
                                  event
                                    .target
                                    .value
                                )
                            }
                          />
                        </div>
                      </label>

                      <label className="new-ticket-field">
                        <span>
                          Contacto
                        </span>
                        <input
                          type="text"
                          value={
                            form
                              .homeService
                              .contacto
                          }
                          placeholder="Persona de contacto"
                          disabled={
                            saving
                          }
                          onChange={
                            (
                              event
                            ) =>
                              updateNestedField(
                                "homeService",
                                "contacto",
                                event
                                  .target
                                  .value
                              )
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}

                {form.serviceType ===
                  "Remoto" && (
                  <div className="new-ticket-service-panel remote">
                    <div className="new-ticket-service-panel-title">
                      <Wifi
                        size={
                          17
                        }
                      />
                      <strong>
                        Datos de acceso remoto
                      </strong>
                    </div>

                    <div className="new-ticket-three-columns">
                      <label className="new-ticket-field">
                        <span>
                          Plataforma
                        </span>
                        <select
                          value={
                            form
                              .remoteService
                              .plataforma
                          }
                          disabled={
                            saving
                          }
                          onChange={
                            (
                              event
                            ) =>
                              updateNestedField(
                                "remoteService",
                                "plataforma",
                                event
                                  .target
                                  .value
                              )
                          }
                        >
                          <option value="AnyDesk">
                            AnyDesk
                          </option>
                          <option value="TeamViewer">
                            TeamViewer
                          </option>
                          <option value="RustDesk">
                            RustDesk
                          </option>
                          <option value="Otra">
                            Otra
                          </option>
                        </select>
                      </label>

                      <label className="new-ticket-field">
                        <span>
                          ID / código *
                        </span>
                        <input
                          type="text"
                          className="new-ticket-mono"
                          value={
                            form
                              .remoteService
                              .idConexion
                          }
                          placeholder="123 456 789"
                          disabled={
                            saving
                          }
                          onChange={
                            (
                              event
                            ) =>
                              updateNestedField(
                                "remoteService",
                                "idConexion",
                                event
                                  .target
                                  .value
                              )
                          }
                        />
                      </label>

                      <label className="new-ticket-field">
                        <span>
                          Clave temporal
                        </span>
                        <input
                          type="text"
                          className="new-ticket-mono"
                          value={
                            form
                              .remoteService
                              .clave
                          }
                          placeholder="Opcional"
                          disabled={
                            saving
                          }
                          onChange={
                            (
                              event
                            ) =>
                              updateNestedField(
                                "remoteService",
                                "clave",
                                event
                                  .target
                                  .value
                              )
                          }
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* ===============================
                2. CLIENTE
            =============================== */}

            <section className={`new-ticket-card new-ticket-client-card ${clientSearchOpen ? "search-open" : ""}`}>
              <div className="new-ticket-card-head">
                <div className="new-ticket-card-title">
                  <div className="new-ticket-card-icon client">
                    <UserRound
                      size={
                        19
                      }
                    />
                  </div>

                  <div>
                    <strong>
                      2. Cliente
                    </strong>
                    <span>
                      Buscá un cliente existente o escribí un nombre de mostrador
                    </span>
                  </div>
                </div>

                <div className="new-ticket-client-head-actions">
                  {selectedClient && (
                    <span className="new-ticket-badge green">
                      Cliente seleccionado
                    </span>
                  )}

                  {!selectedClient && (
                    <button
                      type="button"
                      className="new-ticket-inline-create-client"
                      onClick={openNewClient}
                      disabled={saving || savingNewClient}
                    >
                      <UserPlus size={16} />
                      Dar de alta
                    </button>
                  )}
                </div>
              </div>

              <div className="new-ticket-card-body">
                <label className="new-ticket-field">
                  <span>
                    Cliente
                  </span>

                  <div className="new-ticket-client-search">
                    <Search
                      size={
                        18
                      }
                    />

                    <input
                      type="text"
                      value={
                        clientQuery
                      }
                      placeholder="Buscar por nombre, DNI, CUIT o teléfono..."
                      autoComplete="off"
                      disabled={
                        saving
                      }
                      onFocus={() =>
                        setClientSearchOpen(
                          true
                        )
                      }
                      onChange={
                        (
                          event
                        ) =>
                          handleClientInput(
                            event
                              .target
                              .value
                          )
                      }
                    />

                    {clientQuery && (
                      <button
                        type="button"
                        onClick={
                          clearClient
                        }
                        title="Limpiar cliente"
                      >
                        <X
                          size={
                            15
                          }
                        />
                      </button>
                    )}

                    {clientSearchOpen && (
                      <div className="new-ticket-client-results">
                        {loadingClients ? (
                          <div className="new-ticket-client-empty">
                            Cargando clientes...
                          </div>
                        ) : clientSuggestions.length ===
                          0 ? (
                          <div className="new-ticket-client-empty new-ticket-client-empty-create">
                            <div>
                              <strong>
                                No encontramos ese cliente
                              </strong>
                              <span>
                                Podés registrarlo ahora y SERVIX lo seleccionará automáticamente para este ticket.
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={openNewClient}
                              disabled={saving || savingNewClient}
                            >
                              <UserPlus size={16} />
                              Dar de alta cliente
                            </button>
                          </div>
                        ) : (
                          clientSuggestions.map(
                            (
                              client
                            ) => (
                              <button
                                key={
                                  client.id
                                }
                                type="button"
                                className={
                                  client.archivado ===
                                  true
                                    ? "archived"
                                    : ""
                                }
                                disabled={
                                  client.archivado ===
                                  true
                                }
                                onClick={() =>
                                  selectClient(
                                    client
                                  )
                                }
                              >
                                <div className="new-ticket-client-result-avatar">
                                  {getClientDisplayName(
                                    client
                                  )
                                    .split(
                                      " "
                                    )
                                    .slice(
                                      0,
                                      2
                                    )
                                    .map(
                                      (
                                        part
                                      ) =>
                                        part[0] ||
                                        ""
                                    )
                                    .join(
                                      ""
                                    )
                                    .toUpperCase()}
                                </div>

                                <div>
                                  <strong>
                                    {getClientDisplayName(
                                      client
                                    )}
                                  </strong>
                                  <span>
                                    {client.tel &&
                                    client.tel !==
                                      "—"
                                      ? client.tel
                                      : "Sin teléfono"}
                                    {client.dni
                                      ? ` · DNI ${client.dni}`
                                      : client.cuit
                                        ? ` · CUIT ${client.cuit}`
                                        : ""}
                                  </span>
                                </div>

                                {client.archivado ===
                                true ? (
                                  <small>
                                    Archivado
                                  </small>
                                ) : (
                                  <Check
                                    size={
                                      15
                                    }
                                  />
                                )}
                              </button>
                            )
                          )
                        )}
                      </div>
                    )}
                  </div>
                </label>

                {selectedClient && (
                  <div className="new-ticket-selected-client">
                    <div className="new-ticket-selected-avatar">
                      {getClientDisplayName(
                        selectedClient
                      )
                        .split(
                          " "
                        )
                        .slice(
                          0,
                          2
                        )
                        .map(
                          (
                            part
                          ) =>
                            part[0] ||
                            ""
                        )
                        .join(
                          ""
                        )
                        .toUpperCase()}
                    </div>

                    <div>
                      <span>
                        Cliente seleccionado
                      </span>
                      <strong>
                        {getClientDisplayName(
                          selectedClient
                        )}
                      </strong>
                    </div>

                    <button
                      type="button"
                      onClick={
                        clearClient
                      }
                      disabled={
                        saving
                      }
                    >
                      Cambiar
                    </button>
                  </div>
                )}
              </div>
            </section>

            {/* ===============================
                3. EQUIPO
            =============================== */}

            <section className="new-ticket-card">
              <div className="new-ticket-card-head">
                <div className="new-ticket-card-title">
                  <div className="new-ticket-card-icon equipment">
                    <Cpu
                      size={
                        19
                      }
                    />
                  </div>

                  <div>
                    <strong>
                      3. Equipo
                    </strong>
                    <span>
                      Identificación técnica y condición de ingreso
                    </span>
                  </div>
                </div>

                <span className="new-ticket-badge blue">
                  Datos del dispositivo
                </span>
              </div>

              <div className="new-ticket-card-body">
                <div className="new-ticket-four-columns">
                  <label className="new-ticket-field">
                    <span>
                      Tipo de equipo
                    </span>
                    <select
                      value={
                        form.equipment
                      }
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateField(
                            "equipment",
                            event
                              .target
                              .value
                          )
                      }
                    >
                      {EQUIPMENT_TYPES.map(
                        (
                          type
                        ) => (
                          <option
                            key={
                              type
                            }
                            value={
                              type
                            }
                          >
                            {type}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="new-ticket-field">
                    <span>
                      Marca
                    </span>
                    <input
                      type="text"
                      value={
                        form.brand
                      }
                      placeholder="Lenovo"
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateField(
                            "brand",
                            event
                              .target
                              .value
                          )
                      }
                    />
                  </label>

                  <label className="new-ticket-field">
                    <span>
                      Modelo
                    </span>
                    <input
                      type="text"
                      value={
                        form.model
                      }
                      placeholder="IdeaPad 3"
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateField(
                            "model",
                            event
                              .target
                              .value
                          )
                      }
                    />
                  </label>

                  <label className="new-ticket-field">
                    <span>
                      Nº de serie / IMEI
                    </span>
                    <input
                      type="text"
                      className="new-ticket-mono"
                      value={
                        form.serial
                      }
                      placeholder="PF3A8ZQ"
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateField(
                            "serial",
                            event
                              .target
                              .value
                          )
                      }
                    />
                  </label>
                </div>

                <div className="new-ticket-three-columns new-ticket-equipment-extra">
                  <label className="new-ticket-field">
                    <span>
                      PIN / clave del equipo
                    </span>
                    <input
                      type="text"
                      className="new-ticket-mono"
                      value={
                        form.pin
                      }
                      placeholder="Opcional"
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateField(
                            "pin",
                            event
                              .target
                              .value
                          )
                      }
                    />
                    <small>
                      Solo si es necesario para el servicio.
                    </small>
                  </label>

                  <label className="new-ticket-field">
                    <span>
                      Especificaciones rápidas
                    </span>
                    <input
                      type="text"
                      value={
                        form.specs
                      }
                      placeholder="Ryzen 5 · 8 GB · SSD 256 GB"
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) =>
                          updateField(
                            "specs",
                            event
                              .target
                              .value
                          )
                      }
                    />
                  </label>

                  <label className="new-ticket-field">
                    <span>
                      Garantía sugerida
                    </span>
                    <div className="new-ticket-warranty-input">
                      <input
                        type="number"
                        min="0"
                        max="3650"
                        value={
                          form.warrantyDays
                        }
                        disabled={
                          saving
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "warrantyDays",
                              event
                                .target
                                .value
                            )
                        }
                      />
                      <span>
                        días
                      </span>
                    </div>
                    <small>
                      Se activa al entregar el ticket.
                    </small>
                  </label>
                </div>

                {form.serviceType ===
                  "Taller" && (
                  <>
                    <div className="new-ticket-field new-ticket-check-section">
                      <span>
                        Estado físico OK
                      </span>
                      <small>
                        Marcá los componentes que ingresan sin daños visibles.
                      </small>

                      <div className="new-ticket-check-grid">
                        {PHYSICAL_ITEMS.map(
                          (
                            [
                              key,
                              label,
                            ]
                          ) => (
                            <button
                              key={
                                key
                              }
                              type="button"
                              className={
                                form
                                  .physicalState[
                                  key
                                ]
                                  ? "active"
                                  : ""
                              }
                              disabled={
                                saving
                              }
                              onClick={() =>
                                togglePhysical(
                                  key
                                )
                              }
                            >
                              <span className="new-ticket-check-box">
                                {form
                                  .physicalState[
                                  key
                                ] && (
                                  <Check size={13} />
                                )}
                              </span>
                              {label}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <div className="new-ticket-field new-ticket-check-section">
                      <span>
                        Accesorios entregados
                      </span>

                      <div className="new-ticket-check-grid accessories">
                        {ACCESSORY_ITEMS.map(
                          (
                            [
                              key,
                              label,
                            ]
                          ) => (
                            <button
                              key={
                                key
                              }
                              type="button"
                              className={
                                form
                                  .accessories[
                                  key
                                ]
                                  ? "active"
                                  : ""
                              }
                              disabled={
                                saving
                              }
                              onClick={() =>
                                toggleAccessory(
                                  key
                                )
                              }
                            >
                              <span className="new-ticket-check-box">
                                {form
                                  .accessories[
                                  key
                                ] && (
                                  <Check size={13} />
                                )}
                              </span>
                              {label}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <label className="new-ticket-field">
                      <span>
                        Observaciones físicas
                      </span>
                      <input
                        type="text"
                        value={
                          form.condition
                        }
                        placeholder="Rayones, golpes, tornillos faltantes..."
                        disabled={
                          saving
                        }
                        onChange={
                          (
                            event
                          ) =>
                            updateField(
                              "condition",
                              event
                                .target
                                .value
                            )
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            </section>

          </div>

        </div>
      </form>

      {newClientOpen && (
        <div className="new-ticket-client-modal-backdrop" onMouseDown={closeNewClient}>
          <motion.div
            className="new-ticket-client-modal"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.2 }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="new-ticket-client-modal-head">
              <div>
                <span className="new-ticket-client-modal-icon">
                  <UserPlus size={20} />
                </span>
                <div>
                  <strong>Dar de alta cliente</strong>
                  <span>Crealo sin salir del nuevo ticket.</span>
                </div>
              </div>

              <button type="button" onClick={closeNewClient} disabled={savingNewClient} title="Cerrar">
                <X size={18} />
              </button>
            </div>

            <div className="new-ticket-client-modal-body">
              <div className="new-ticket-grid-2">
                <label className="new-ticket-field">
                  <span>Nombre <b>*</b></span>
                  <input value={newClientForm.nombre} onChange={(event) => updateNewClientField("nombre", event.target.value)} placeholder="Nombre" autoFocus disabled={savingNewClient} />
                </label>
                <label className="new-ticket-field">
                  <span>Apellido</span>
                  <input value={newClientForm.apellido} onChange={(event) => updateNewClientField("apellido", event.target.value)} placeholder="Apellido" disabled={savingNewClient} />
                </label>
                <label className="new-ticket-field">
                  <span>DNI</span>
                  <input value={newClientForm.dni} onChange={(event) => updateNewClientField("dni", event.target.value)} placeholder="Documento" inputMode="numeric" disabled={savingNewClient} />
                </label>
                <label className="new-ticket-field">
                  <span>CUIT</span>
                  <input value={newClientForm.cuit} onChange={(event) => updateNewClientField("cuit", event.target.value)} placeholder="CUIT" inputMode="numeric" disabled={savingNewClient} />
                </label>
                <label className="new-ticket-field">
                  <span>Teléfono</span>
                  <input value={newClientForm.tel} onChange={(event) => updateNewClientField("tel", event.target.value)} placeholder="+54 9 ..." disabled={savingNewClient} />
                </label>
                <label className="new-ticket-field">
                  <span>Email</span>
                  <input type="email" value={newClientForm.email} onChange={(event) => updateNewClientField("email", event.target.value)} placeholder="cliente@email.com" disabled={savingNewClient} />
                </label>
              </div>

              <div className="new-ticket-client-modal-note">
                <CircleAlert size={17} />
                <span>DNI, CUIT, teléfono o email ayudan a evitar clientes duplicados.</span>
              </div>
            </div>

            <div className="new-ticket-client-modal-actions">
              <button type="button" className="secondary" onClick={closeNewClient} disabled={savingNewClient}>Cancelar</button>
              <button type="button" className="primary" onClick={handleCreateClient} disabled={savingNewClient}>
                <UserPlus size={17} />
                {savingNewClient ? "Creando..." : "Crear y seleccionar"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
