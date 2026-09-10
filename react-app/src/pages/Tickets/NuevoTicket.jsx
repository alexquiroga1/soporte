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
  Camera,
  Check,
  CircleAlert,
  Clock3,
  Cpu,
  Home,
  MapPin,
  Monitor,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
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
  getClientDisplayName,
  subscribeToClients,
} from "../../services/clientes.service.js";

import {
  subscribeToBusinessConfig,
  subscribeToSystemUsers,
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

const PRIORITIES = [
  {
    id: "P3",
    label: "Baja",
    description: "Sin urgencia",
  },
  {
    id: "P2",
    label: "Media",
    description: "Prioridad normal",
  },
  {
    id: "P1",
    label: "Urgente",
    description: "Atención prioritaria",
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

/* =========================================
   FORMULARIO VACÍO
========================================= */

function createEmptyForm(
  warrantyDays = 30
) {
  return {
    serviceType:
      "Taller",

    priority:
      "P2",

    technician:
      "Sin asignar",

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

    issue:
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
    TICKET_ISSUE_REQUIRED:
      "Ingresá la falla o motivo de consulta.",

    TICKET_CLIENT_ARCHIVED:
      "Ese cliente está archivado. Restauralo antes de crear un ticket.",

    TICKET_HOME_ADDRESS_REQUIRED:
      "Ingresá la dirección donde se realizará el servicio.",

    TICKET_REMOTE_ID_REQUIRED:
      "Ingresá el ID o código de conexión remota.",

    TICKET_PHOTO_INVALID:
      "Solo se permiten imágenes como evidencia.",

    TICKET_PHOTO_TOO_LARGE:
      "Una de las imágenes supera los 8 MB.",
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
    systemUsers,
    setSystemUsers,
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
    photos,
    setPhotos,
  ] =
    useState([]);

  const [
    photoPreviews,
    setPhotoPreviews,
  ] =
    useState([]);

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
        subscribeToSystemUsers(
          (
            data
          ) => {
            setSystemUsers(
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
     PREVIEW FOTOS
  ======================================= */

  useEffect(
    () => {
      const previews =
        photos.map(
          (
            file
          ) => ({
            file,

            url:
              URL.createObjectURL(
                file
              ),
          })
        );

      setPhotoPreviews(
        previews
      );

      return () => {
        previews.forEach(
          (
            preview
          ) => {
            URL.revokeObjectURL(
              preview.url
            );
          }
        );
      };
    },
    [
      photos,
    ]
  );

  /* =======================================
     TÉCNICOS
  ======================================= */

  const technicians =
    useMemo(
      () => {
        const names =
          systemUsers
            .filter(
              (
                systemUser
              ) =>
                systemUser
                  .activo !==
                false
            )
            .map(
              (
                systemUser
              ) =>
                String(
                  systemUser
                    .nombre ||
                    systemUser
                      .email ||
                    ""
                ).trim()
            )
            .filter(
              Boolean
            );

        return [
          ...new Set(
            names
          ),
        ].sort(
          (
            a,
            b
          ) =>
            a.localeCompare(
              b,
              "es"
            )
        );
      },
      [
        systemUsers,
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

  /* =======================================
     FOTOS
  ======================================= */

  const handlePhotos =
    (
      event
    ) => {
      const files =
        Array.from(
          event.target
            .files ||
            []
        );

      const images =
        files.filter(
          (
            file
          ) =>
            file.type.startsWith(
              "image/"
            )
        );

      if (
        images.length !==
        files.length
      ) {
        notify.warning(
          "Archivos omitidos",
          "Solo se permiten imágenes."
        );
      }

      const validImages =
        images.filter(
          (
            file
          ) =>
            file.size <=
            8 *
              1024 *
              1024
        );

      if (
        validImages.length !==
        images.length
      ) {
        notify.warning(
          "Imagen demasiado grande",
          "Cada foto puede pesar hasta 8 MB."
        );
      }

      const limited =
        validImages.slice(
          0,
          8
        );

      if (
        validImages.length >
        8
      ) {
        notify.info(
          "Límite de fotos",
          "Se utilizarán las primeras 8 imágenes."
        );
      }

      setPhotos(
        limited
      );

      setDirty(
        true
      );

      event.target.value =
        "";
    };

  const removePhoto =
    (
      index
    ) => {
      setPhotos(
        (
          current
        ) =>
          current.filter(
            (
              _,
              photoIndex
            ) =>
              photoIndex !==
              index
          )
      );

      setDirty(
        true
      );
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
        !form.issue.trim()
      ) {
        notify.warning(
          "Falta la falla",
          "Indicá el problema o motivo de consulta."
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

            priority:
              form.priority,

            technician:
              form.technician,

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

            issue:
              form.issue,

            homeService:
              form.homeService,

            remoteService:
              form.remoteService,

            photos,

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

            <div>
              <span>
                Ingreso de equipo
              </span>

              <h1>
                Nuevo Ticket
              </h1>
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
                      y: -1,
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
              <Save
                size={
                  17
                }
              />

              {saving
                ? "Registrando..."
                : "Registrar ingreso"}
            </motion.button>
          </div>
        </header>

        {/* =================================
            INTRO
        ================================= */}

        <section className="new-ticket-intro">
          <div>
            <span className="new-ticket-eyebrow">
              Recepción técnica
            </span>

            <h2>
              Registrar nuevo ingreso
            </h2>

            <p>
              Cargá los datos del cliente, equipo y
              motivo del servicio.
            </p>
          </div>

          <div className="new-ticket-live">
            <span />

            <div>
              <strong>
                Firebase activo
              </strong>

              <small>
                Guardado en producción
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
            <ShieldCheck
              size={
                22
              }
            />

            <div>
              <strong>
                Atención: el cliente tiene garantía vigente
              </strong>

              <p>
                Revisá si este ingreso corresponde a una
                reparación anterior.
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
            GRID PRINCIPAL
        ================================= */}

        <div className="new-ticket-grid">
          {/* =================================
              1. CLIENTE
          ================================= */}

          <section className="new-ticket-card">
            <div className="new-ticket-card-head">
              <div className="new-ticket-card-icon">
                <UserRound
                  size={
                    18
                  }
                />
              </div>

              <div>
                <span>
                  Paso 1
                </span>

                <h3>
                  Cliente y operación
                </h3>
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
                      17
                    }
                  />

                  <input
                    type="text"
                    value={
                      clientQuery
                    }
                    placeholder="Buscar por nombre, DNI, teléfono..."
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
                        <div className="new-ticket-client-empty">
                          <strong>
                            No encontrado
                          </strong>

                          <span>
                            Podés usar el nombre escrito como
                            cliente de mostrador o crearlo desde
                            Clientes.
                          </span>
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
                  <div>
                    <UserRound
                      size={
                        16
                      }
                    />
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

                  <Check
                    size={
                      17
                    }
                  />
                </div>
              )}

              <div className="new-ticket-field">
                <span>
                  Tipo de servicio
                </span>

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
                          <Icon
                            size={
                              18
                            }
                          />

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
              </div>

              <div className="new-ticket-field">
                <span>
                  Prioridad
                </span>

                <div className="new-ticket-priority-grid">
                  {PRIORITIES.map(
                    (
                      priority
                    ) => (
                      <button
                        key={
                          priority.id
                        }
                        type="button"
                        className={
                          `${
                            form.priority ===
                            priority.id
                              ? "active"
                              : ""
                          } priority-${priority.id.toLowerCase()}`
                        }
                        disabled={
                          saving
                        }
                        onClick={() =>
                          updateField(
                            "priority",
                            priority.id
                          )
                        }
                      >
                        <strong>
                          {priority.id}
                        </strong>

                        <div>
                          <b>
                            {priority.label}
                          </b>

                          <span>
                            {priority.description}
                          </span>
                        </div>
                      </button>
                    )
                  )}
                </div>
              </div>

              <label className="new-ticket-field">
                <span>
                  Técnico asignado
                </span>

                <select
                  value={
                    form.technician
                  }
                  disabled={
                    saving
                  }
                  onChange={
                    (
                      event
                    ) =>
                      updateField(
                        "technician",
                        event
                          .target
                          .value
                      )
                  }
                >
                  <option value="Sin asignar">
                    Sin asignar
                  </option>

                  {technicians.map(
                    (
                      technician
                    ) => (
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
          </section>

          {/* =================================
              2. EQUIPO
          ================================= */}

          <section className="new-ticket-card">
            <div className="new-ticket-card-head">
              <div className="new-ticket-card-icon">
                <Cpu
                  size={
                    18
                  }
                />
              </div>

              <div>
                <span>
                  Paso 2
                </span>

                <h3>
                  Datos del equipo
                </h3>
              </div>
            </div>

            <div className="new-ticket-card-body">
              <div className="new-ticket-two-columns">
                <label className="new-ticket-field">
                  <span>
                    Tipo
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
                    placeholder="Ej. Lenovo"
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
              </div>

              <div className="new-ticket-two-columns">
                <label className="new-ticket-field">
                  <span>
                    Modelo
                  </span>

                  <input
                    type="text"
                    value={
                      form.model
                    }
                    placeholder="Ej. IdeaPad 3"
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
                    Nº Serie / IMEI
                  </span>

                  <input
                    type="text"
                    className="new-ticket-mono"
                    value={
                      form.serial
                    }
                    placeholder="S/N"
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

              <label className="new-ticket-field">
                <span>
                  Especificaciones rápidas
                </span>

                <input
                  type="text"
                  value={
                    form.specs
                  }
                  placeholder="Ej. Windows 11, Core i5, 8 GB RAM..."
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

              <label className="new-ticket-field new-ticket-pin-field">
                <span>
                  Contraseña / PIN
                </span>

                <input
                  type="text"
                  className="new-ticket-mono"
                  value={
                    form.pin
                  }
                  placeholder="Vacío si no tiene"
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
                  Guardalo únicamente si es necesario para
                  realizar el servicio.
                </small>
              </label>

              <label className="new-ticket-field">
                <span>
                  Garantía de reparación
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
                  Se activará cuando el ticket pase a
                  Entregado.
                </small>
              </label>
            </div>
          </section>

          {/* =================================
              3. CONDICIÓN / FALLA
          ================================= */}

          <section className="new-ticket-card">
            <div className="new-ticket-card-head">
              <div className="new-ticket-card-icon">
                <Wrench
                  size={
                    18
                  }
                />
              </div>

              <div>
                <span>
                  Paso 3
                </span>

                <h3>
                  Condición y falla
                </h3>
              </div>
            </div>

            <div className="new-ticket-card-body">
              {form.serviceType ===
                "Taller" && (
                <>
                  <div className="new-ticket-field">
                    <span>
                      Estado físico OK
                    </span>

                    <small>
                      Marcá los componentes que ingresan sin
                      daños visibles.
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
                                <Check
                                  size={
                                    13
                                  }
                                />
                              )}
                            </span>

                            {label}
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  <div className="new-ticket-field">
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
                                <Check
                                  size={
                                    13
                                  }
                                />
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
                      placeholder="Rayones, tornillos faltantes, golpes..."
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

              {/* ============================
                  DOMICILIO
              ============================ */}

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
                      Datos de la visita
                    </strong>
                  </div>

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
                      placeholder="Dirección del servicio"
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

                  <div className="new-ticket-two-columns">
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
                        <Clock3
                          size={
                            15
                          }
                        />

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
                  </div>

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
                      placeholder="Persona que recibirá al técnico"
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
              )}

              {/* ============================
                  REMOTO
              ============================ */}

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
                      Acceso remoto
                    </strong>
                  </div>

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
                      ID de conexión *
                    </span>

                    <input
                      type="text"
                      className="new-ticket-mono"
                      value={
                        form
                          .remoteService
                          .idConexion
                      }
                      placeholder="Ej. 123 456 789"
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
                      Clave
                    </span>

                    <input
                      type="text"
                      className="new-ticket-mono"
                      value={
                        form
                          .remoteService
                          .clave
                      }
                      placeholder="Clave de sesión"
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
              )}

              {/* ============================
                  FALLA
              ============================ */}

              <label className="new-ticket-field new-ticket-issue">
                <span>
                  Falla declarada por el cliente *

                  <b>
                    Requerido
                  </b>
                </span>

                <textarea
                  rows={
                    5
                  }
                  value={
                    form.issue
                  }
                  placeholder="Describí el problema, síntomas o motivo de consulta..."
                  disabled={
                    saving
                  }
                  onChange={
                    (
                      event
                    ) =>
                      updateField(
                        "issue",
                        event
                          .target
                          .value
                      )
                  }
                />
              </label>
            </div>
          </section>
        </div>

        {/* =================================
            EVIDENCIA
        ================================= */}

        <section className="new-ticket-evidence">
          <div className="new-ticket-evidence-head">
            <div>
              <Camera
                size={
                  19
                }
              />

              <div>
                <span>
                  Evidencia
                </span>

                <h3>
                  Fotografías del ingreso
                </h3>
              </div>
            </div>

            <small>
              Máximo 8 imágenes · 8 MB cada una
            </small>
          </div>

          <label className="new-ticket-upload">
            <input
              type="file"
              accept="image/*"
              multiple
              disabled={
                saving
              }
              onChange={
                handlePhotos
              }
            />

            <div>
              <Upload
                size={
                  25
                }
              />

              <strong>
                Agregar fotografías
              </strong>

              <span>
                Seleccioná imágenes del equipo y su estado al
                momento del ingreso.
              </span>
            </div>
          </label>

          {photoPreviews.length >
            0 && (
            <div className="new-ticket-photo-grid">
              {photoPreviews.map(
                (
                  preview,
                  index
                ) => (
                  <article
                    key={
                      `${
                        preview
                          .file
                          .name
                      }-${
                        preview
                          .file
                          .lastModified
                      }-${index}`
                    }
                  >
                    <img
                      src={
                        preview.url
                      }
                      alt={
                        `Evidencia ${
                          index +
                          1
                        }`
                      }
                    />

                    <button
                      type="button"
                      disabled={
                        saving
                      }
                      onClick={() =>
                        removePhoto(
                          index
                        )
                      }
                      title="Quitar foto"
                    >
                      <Trash2
                        size={
                          15
                        }
                      />
                    </button>

                    <span>
                      {preview
                        .file
                        .name}
                    </span>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        {/* =================================
            RESUMEN / FOOTER
        ================================= */}

        <section className="new-ticket-summary">
          <div className="new-ticket-summary-info">
            <CircleAlert
              size={
                18
              }
            />

            <div>
              <strong>
                Antes de registrar
              </strong>

              <span>
                El ticket se creará inicialmente como
                <b> Recibido </b>
                y con pago pendiente.
              </span>
            </div>
          </div>

          <div className="new-ticket-summary-actions">
            <button
              type="button"
              className="new-ticket-bottom-cancel"
              disabled={
                saving
              }
              onClick={
                handleBack
              }
            >
              Cancelar
            </button>

            <motion.button
              type="submit"
              className="new-ticket-bottom-save"
              disabled={
                saving
              }
              whileHover={
                saving
                  ? undefined
                  : {
                      y: -1,
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
                  Registrando...
                </>
              ) : (
                <>
                  <Save
                    size={
                      17
                    }
                  />

                  Registrar ingreso
                </>
              )}
            </motion.button>
          </div>
        </section>
      </form>
    </main>
  );
}