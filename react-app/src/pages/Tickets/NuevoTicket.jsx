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
     RESUMEN VISUAL
  ========================================= */

  const selectedPriorityMeta =
    PRIORITIES.find(
      (
        priority
      ) =>
        priority.id ===
        form.priority
    ) ||
    PRIORITIES[1];

  const selectedServiceMeta =
    SERVICE_TYPES.find(
      (
        service
      ) =>
        service.id ===
        form.serviceType
    ) ||
    SERVICE_TYPES[0];

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

  const issueReady =
    Boolean(
      form.issue.trim()
    );

  const completionChecks = [
    serviceReady,
    clientReady,
    Boolean(
      form.equipment
    ),
    equipmentReady,
    issueReady,
  ];

  const completionPercent =
    Math.round(
      (
        completionChecks.filter(
          Boolean
        ).length /
        completionChecks.length
      ) *
        100
    );

  const equipmentSummary =
    [
      form.equipment,
      form.brand.trim(),
      form.model.trim(),
    ]
      .filter(
        Boolean
      )
      .join(
        " · "
      );

  const summaryClient =
    selectedClient
      ? getClientDisplayName(
          selectedClient
        )
      : clientQuery.trim() ||
        "Sin seleccionar";

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
              Registrá modalidad, cliente, equipo y falla en una sola pantalla sin perder trazabilidad técnica.
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

                  <div className={`new-ticket-progress-step ${issueReady ? "done" : equipmentReady ? "active" : ""}`}>
                    <CircleAlert size={17} />
                    Falla
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

            {/* ===============================
                4. FALLA / PRIORIDAD
            =============================== */}

            <section className="new-ticket-card">
              <div className="new-ticket-card-head">
                <div className="new-ticket-card-title">
                  <div className="new-ticket-card-icon issue">
                    <CircleAlert
                      size={
                        19
                      }
                    />
                  </div>

                  <div>
                    <strong>
                      4. Falla, prioridad y asignación
                    </strong>
                    <span>
                      Información que va a orientar el diagnóstico
                    </span>
                  </div>
                </div>
              </div>

              <div className="new-ticket-card-body">
                <div className="new-ticket-two-columns new-ticket-priority-assignment">
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
                            className={`${form.priority === priority.id ? "active" : ""} priority-${priority.id.toLowerCase()}`}
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
                            <span className="new-ticket-priority-icon">
                              {priority.id ===
                              "P1" ? (
                                <CircleAlert size={16} />
                              ) : priority.id ===
                                "P2" ? (
                                <Clock3 size={16} />
                              ) : (
                                <Check size={16} />
                              )}
                            </span>

                            <strong>
                              {priority.id} · {priority.label}
                            </strong>
                            <span>
                              {priority.description}
                            </span>
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
                    <small>
                      También podés asignarlo más adelante desde Tickets.
                    </small>
                  </label>
                </div>

                <label className="new-ticket-field new-ticket-issue">
                  <span className="new-ticket-issue-label">
                    <strong>
                      Falla o motivo de consulta *
                    </strong>
                    <b>
                      <CircleAlert size={14} />
                      Dato obligatorio
                    </b>
                  </span>

                  <textarea
                    rows={
                      5
                    }
                    value={
                      form.issue
                    }
                    placeholder="Ej.: El equipo no enciende. El cliente indica que dejó de cargar después de una baja de tensión..."
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
                  <small>
                    Registrá lo que informa el cliente sin convertirlo todavía en diagnóstico técnico.
                  </small>
                </label>
              </div>
            </section>

            {/* ===============================
                5. EVIDENCIA
            =============================== */}

            <section className="new-ticket-card new-ticket-evidence">
              <div className="new-ticket-card-head">
                <div className="new-ticket-card-title">
                  <div className="new-ticket-card-icon evidence">
                    <Camera
                      size={
                        19
                      }
                    />
                  </div>

                  <div>
                    <strong>
                      5. Evidencia de ingreso
                    </strong>
                    <span>
                      Fotografías opcionales del equipo y sus detalles
                    </span>
                  </div>
                </div>

                <span className="new-ticket-badge yellow">
                  Sin Storage
                </span>
              </div>

              <div className="new-ticket-card-body">
                <label className="new-ticket-upload disabled">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    disabled
                    aria-disabled="true"
                    onChange={
                      handlePhotos
                    }
                  />

                  <div className="new-ticket-upload-icon">
                    <Upload
                      size={
                        24
                      }
                    />
                  </div>

                  <div>
                    <strong>
                      Fotografías temporalmente desactivadas
                    </strong>
                    <span>
                      La interfaz queda preparada para evidencia, pero la carga continúa desactivada para no incorporar Firebase Storage.
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
                          key={`${preview.file.name}-${preview.file.lastModified}-${index}`}
                        >
                          <img
                            src={
                              preview.url
                            }
                            alt={`Evidencia ${index + 1}`}
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
                            <Trash2 size={15} />
                          </button>
                        </article>
                      )
                    )}
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* =================================
              RESUMEN LATERAL
          ================================= */}

          <aside className="new-ticket-side-column">
            <section className="new-ticket-summary-card">
              <h3>
                Resumen del nuevo ticket
              </h3>

              <div className="new-ticket-completeness">
                <div className="new-ticket-completeness-top">
                  <strong>
                    Formulario completo
                  </strong>
                  <b>
                    {completionPercent}%
                  </b>
                </div>

                <div className="new-ticket-completeness-bar">
                  <span
                    style={{
                      width:
                        `${completionPercent}%`,
                    }}
                  />
                </div>
              </div>

              <div className="new-ticket-summary-kv">
                <span>
                  Modalidad
                </span>
                <strong>
                  {selectedServiceMeta.label}
                </strong>
              </div>

              <div className="new-ticket-summary-kv">
                <span>
                  Cliente
                </span>
                <strong>
                  {summaryClient}
                </strong>
              </div>

              <div className="new-ticket-summary-kv">
                <span>
                  Equipo
                </span>
                <strong>
                  {equipmentSummary}
                </strong>
              </div>

              <div className="new-ticket-summary-kv">
                <span>
                  Prioridad
                </span>
                <strong className={`summary-priority priority-${form.priority.toLowerCase()}`}>
                  {form.priority} · {selectedPriorityMeta.label}
                </strong>
              </div>

              <div className="new-ticket-summary-kv">
                <span>
                  Técnico
                </span>
                <strong>
                  {form.technician}
                </strong>
              </div>

              <div className="new-ticket-summary-kv">
                <span>
                  Falla
                </span>
                <strong>
                  {issueReady
                    ? "Registrada"
                    : "Pendiente"}
                </strong>
              </div>

              <div className="new-ticket-summary-warning">
                <CircleAlert
                  size={
                    18
                  }
                />
                <div>
                  El ticket se crea inicialmente como <b>Recibido</b> y con pago pendiente. Diagnóstico y presupuesto se gestionan después desde el detalle.
                </div>
              </div>

              <motion.button
                type="submit"
                className="new-ticket-create-main"
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
                    Creando ticket...
                  </>
                ) : (
                  <>
                    <Save size={18} />
                    Crear ticket
                  </>
                )}
              </motion.button>
            </section>

            <section className="new-ticket-mini-card">
              <h4>
                Qué queda registrado
              </h4>

              <div className="new-ticket-mini-row">
                <span className="green" />
                <div>
                  <strong>
                    Ingreso y trazabilidad
                  </strong>
                  <small>
                    Fecha, autor, modalidad, cliente y equipo.
                  </small>
                </div>
              </div>

              <div className="new-ticket-mini-row">
                <span className="blue" />
                <div>
                  <strong>
                    Estado inicial
                  </strong>
                  <small>
                    Queda listo para diagnóstico y seguimiento técnico.
                  </small>
                </div>
              </div>

              <div className="new-ticket-mini-row">
                <span className="violet" />
                <div>
                  <strong>
                    Flujo SERVIX
                  </strong>
                  <small>
                    Presupuesto, Caja, factura y garantía continúan vinculados al ticket.
                  </small>
                </div>
              </div>
            </section>
          </aside>
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
