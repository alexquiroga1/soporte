import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  motion,
} from "motion/react";

import {
  Camera,
  Cpu,
  MapPin,
  Save,
  ShieldCheck,
  UserRound,
  Wifi,
  Wrench,
  X,
} from "lucide-react";

import {
  createTicket,
  getClientDisplayName,
  getClientSecondaryText,
  subscribeToClients,
} from "../../services/ticket-create.service.js";

import {
  notify,
} from "../../services/notifications.js";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import "./NewTicketModal.css";

/* =========================================
   FORMULARIO BASE
========================================= */

function createInitialForm() {
  return {
    clienteId:
      "",

    cliente:
      "",

    tipoServicio:
      "Taller",

    equipo:
      "Notebook",

    marca:
      "",

    modelo:
      "",

    serie:
      "",

    pin:
      "",

    specs:
      "",

    condicion:
      "",

    falla:
      "",

    prioridad:
      "P2",

    tecnico:
      "Sin asignar",

    estadoFisico: {
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

    accesoriosObj: {
      cargador:
        false,

      funda:
        false,

      cable:
        false,
    },

    datosDomicilio: {
      direccion:
        "",

      fecha:
        "",

      hora:
        "",

      contacto:
        "",
    },

    datosRemoto: {
      plataforma:
        "",

      idConexion:
        "",

      clave:
        "",
    },

    photos: [],
  };
}

/* =========================================
   COMPONENTE
========================================= */

export default function NewTicketModal({
  open,
  onClose,
  onCreated,
  technicians = [],
}) {
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
     FORM
  ======================================= */

  const [
    form,
    setForm,
  ] = useState(
    createInitialForm
  );

  /* =======================================
     CLIENTES
  ======================================= */

  const [
    clients,
    setClients,
  ] = useState([]);

  const [
    clientsLoading,
    setClientsLoading,
  ] = useState(false);

  const [
    clientSearch,
    setClientSearch,
  ] = useState("");

  /* =======================================
     GUARDADO
  ======================================= */

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* =======================================
     RESET AL ABRIR
  ======================================= */

  useEffect(() => {
    if (
      !open
    ) {
      return;
    }

    setForm(
      createInitialForm()
    );

    setClientSearch("");
  }, [
    open,
  ]);

  /* =======================================
     FIREBASE CLIENTES
  ======================================= */

  useEffect(() => {
    if (
      !open
    ) {
      return undefined;
    }

    setClientsLoading(
      true
    );

    const unsubscribe =
      subscribeToClients(
        (
          data
        ) => {
          setClients(
            data
          );

          setClientsLoading(
            false
          );
        },

        (
          error
        ) => {
          console.error(
            error
          );

          setClientsLoading(
            false
          );

          notify.error(
            "No pudimos cargar clientes",
            "Podés crear el ticket igualmente como Mostrador."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [
    open,
  ]);

  /* =======================================
     ESCAPE
  ======================================= */

  useEffect(() => {
    if (
      !open
    ) {
      return undefined;
    }

    const handleKeyDown =
      (
        event
      ) => {
        if (
          event.key ===
          "Escape" &&
          !saving
        ) {
          onClose();
        }
      };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [
    open,
    saving,
    onClose,
  ]);

  /* =======================================
     BUSCADOR CLIENTES
  ======================================= */

  const filteredClients =
    useMemo(() => {
      const query =
        clientSearch
          .trim()
          .toLowerCase();

      if (
        !query
      ) {
        return [];
      }

      return clients
        .filter(
          (
            client
          ) => {
            const source = [
              getClientDisplayName(
                client
              ),

              client.dni,

              client.cuit,

              client.documento,

              client.doc,

              client.email,

              client.tel,

              client.telefono,

              client.celular,
            ]
              .filter(
                Boolean
              )
              .join(" ")
              .toLowerCase();

            return source.includes(
              query
            );
          }
        )

        /*
         * Evitamos una lista enorme
         * cubriendo todo el formulario.
         */

        .slice(
          0,
          8
        );
    }, [
      clients,
      clientSearch,
    ]);

  /* =======================================
     CAMPO SIMPLE
  ======================================= */

  const updateField =
    (
      field,
      value
    ) => {
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

  /* =======================================
     CAMPO ANIDADO
  ======================================= */

  const updateNested =
    (
      section,
      field,
      value
    ) => {
      setForm(
        (
          current
        ) => ({
          ...current,

          [section]: {
            ...current[
              section
            ],

            [field]:
              value,
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
      const displayName =
        getClientDisplayName(
          client
        );

      setForm(
        (
          current
        ) => ({
          ...current,

          clienteId:
            client.id,

          cliente:
            displayName,
        })
      );

      setClientSearch(
        displayName
      );
    };

  /* =======================================
     QUITAR CLIENTE
  ======================================= */

  const clearClient =
    () => {
      setForm(
        (
          current
        ) => ({
          ...current,

          clienteId:
            "",

          cliente:
            "",
        })
      );

      setClientSearch("");
    };

  /* =======================================
     CAMBIAR BÚSQUEDA
  ======================================= */

  const handleClientSearchChange =
    (
      event
    ) => {
      const value =
        event.target.value;

      setClientSearch(
        value
      );

      /*
       * Si ya había seleccionado
       * un cliente y empieza a escribir
       * otra cosa, liberamos la selección.
       */

      if (
        form.clienteId
      ) {
        setForm(
          (
            current
          ) => ({
            ...current,

            clienteId:
              "",

            cliente:
              "",
          })
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
          event.target.files ||
          []
        ).slice(
          0,
          3
        );

      updateField(
        "photos",
        files
      );
    };

  /* =======================================
     SUBMIT
  ======================================= */

  const handleSubmit =
    async (
      event
    ) => {
      event.preventDefault();

      /* =================================
         VALIDACIÓN
      ================================= */

      if (
        !form.falla.trim()
      ) {
        notify.warning(
          "Falta el motivo de consulta",
          "Ingresá la falla o el motivo por el que se recibe el equipo."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        /* =================================
           CREAR
        ================================= */

        const ticket =
          await createTicket(
            {
              ...form,

              cliente:
                form.cliente ||
                clientSearch ||
                "Mostrador",
            },

            author
          );

        notify.success(
          "Ticket creado",
          `${ticket.id} fue registrado correctamente.`
        );

        if (
          typeof onCreated ===
          "function"
        ) {
          onCreated(
            ticket
          );
        }
      } catch (
        error
      ) {
        console.error(
          error
        );

        /* =================================
           FALLA OBLIGATORIA
        ================================= */

        if (
          error?.message ===
          "TICKET_FAILURE_REQUIRED"
        ) {
          notify.warning(
            "Falta el motivo de consulta",
            "Ingresá la falla antes de crear el ticket."
          );

          return;
        }

        /* =================================
           FOTO GRANDE
        ================================= */

        if (
          error?.message ===
          "PHOTO_TOO_LARGE"
        ) {
          notify.warning(
            "Imagen demasiado grande",
            "Cada fotografía puede pesar como máximo 8 MB."
          );

          return;
        }

        /* =================================
           TIPO FOTO
        ================================= */

        if (
          error?.message ===
          "PHOTO_INVALID_TYPE"
        ) {
          notify.warning(
            "Archivo no válido",
            "Las fotografías deben ser archivos de imagen."
          );

          return;
        }

        /* =================================
           ERROR GENERAL
        ================================= */

        notify.error(
          "No se pudo crear el ticket",
          error?.message ||
            "Firestore rechazó la operación."
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  /* =======================================
     NO RENDER
  ======================================= */

  if (
    !open
  ) {
    return null;
  }

  /* =========================================
     RENDER
  ========================================= */

  return (
    <div
      className="new-ticket-overlay"

      onMouseDown={(event) => {
        if (
          event.target ===
            event.currentTarget &&
          !saving
        ) {
          onClose();
        }
      }}
    >
      <motion.div
        className="new-ticket-modal"

        initial={{
          opacity: 0,
          scale: 0.97,
          y: 12,
        }}

        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}

        transition={{
          duration: 0.18,
        }}
      >

        {/* =================================
            HEADER
        ================================= */}

        <header className="new-ticket-header">

          <div className="new-ticket-header-left">

            <div className="new-ticket-header-icon">

              <Wrench
                size={21}
              />

            </div>

            <div>

              <span>
                Soporte técnico
              </span>

              <h2>
                Nuevo ticket
              </h2>

            </div>

          </div>

          <button
            type="button"

            className="new-ticket-close"

            onClick={
              onClose
            }

            disabled={
              saving
            }

            aria-label="Cerrar"
          >
            <X
              size={19}
            />
          </button>

        </header>

        {/* =================================
            FORMULARIO
        ================================= */}

        <form
          className="new-ticket-form"

          onSubmit={
            handleSubmit
          }
        >

          <div className="new-ticket-form-scroll">

            {/* =================================
                CLIENTE
            ================================= */}

            <section className="new-ticket-section">

              <div className="new-ticket-section-heading">

                <UserRound
                  size={18}
                />

                <div>

                  <span>
                    Cliente
                  </span>

                  <h3>
                    Datos del propietario
                  </h3>

                </div>

              </div>

              <div className="new-ticket-client-search">

                <label>

                  <span>
                    Buscar cliente
                  </span>

                  <input
                    type="search"

                    placeholder={
                      clientsLoading
                        ? "Cargando clientes..."
                        : "Nombre, DNI, CUIT, teléfono o email..."
                    }

                    value={
                      clientSearch
                    }

                    disabled={
                      saving
                    }

                    onChange={
                      handleClientSearchChange
                    }
                  />

                </label>

                {/* =================================
                    RESULTADOS
                ================================= */}

                {clientSearch &&
                  !form.clienteId &&
                  filteredClients.length >
                    0 && (

                  <div className="new-ticket-client-results">

                    {filteredClients.map(
                      (
                        client
                      ) => (

                        <button
                          type="button"

                          key={
                            client.id
                          }

                          onClick={() =>
                            selectClient(
                              client
                            )
                          }
                        >

                          <strong>
                            {getClientDisplayName(
                              client
                            )}
                          </strong>

                          <span>
                            {getClientSecondaryText(
                              client
                            )}
                          </span>

                        </button>

                      )
                    )}

                  </div>

                )}

                {/* =================================
                    SIN RESULTADOS
                ================================= */}

                {clientSearch &&
                  !form.clienteId &&
                  !clientsLoading &&
                  filteredClients.length ===
                    0 && (

                  <div className="new-ticket-client-help">

                    No encontramos coincidencias.
                    Podés continuar y usar este nombre como cliente de Mostrador.

                  </div>

                )}

                {/* =================================
                    CLIENTE SELECCIONADO
                ================================= */}

                {form.clienteId && (

                  <div className="new-ticket-selected-client">

                    <div>

                      <strong>
                        {form.cliente}
                      </strong>

                      <span>
                        Cliente registrado
                      </span>

                    </div>

                    <button
                      type="button"

                      onClick={
                        clearClient
                      }
                    >
                      Cambiar
                    </button>

                  </div>

                )}

                {!form.clienteId && (

                  <small className="new-ticket-client-help">

                    Si no seleccionás un cliente registrado,
                    se usará el texto ingresado o “Mostrador”.

                  </small>

                )}

              </div>

            </section>

            {/* =================================
                SERVICIO
            ================================= */}

            <section className="new-ticket-section">

              <div className="new-ticket-section-heading">

                <ShieldCheck
                  size={18}
                />

                <div>

                  <span>
                    Servicio
                  </span>

                  <h3>
                    Tipo de atención
                  </h3>

                </div>

              </div>

              <div className="new-ticket-grid three">

                <label>

                  <span>
                    Tipo de servicio
                  </span>

                  <select
                    value={
                      form.tipoServicio
                    }

                    disabled={
                      saving
                    }

                    onChange={(event) =>
                      updateField(
                        "tipoServicio",
                        event.target.value
                      )
                    }
                  >

                    <option value="Taller">
                      Taller
                    </option>

                    <option value="Domicilio">
                      Domicilio
                    </option>

                    <option value="Remoto">
                      Remoto
                    </option>

                  </select>

                </label>

                <label>

                  <span>
                    Prioridad
                  </span>

                  <select
                    value={
                      form.prioridad
                    }

                    disabled={
                      saving
                    }

                    onChange={(event) =>
                      updateField(
                        "prioridad",
                        event.target.value
                      )
                    }
                  >

                    <option value="P1">
                      P1 · Urgente
                    </option>

                    <option value="P2">
                      P2 · Normal
                    </option>

                    <option value="P3">
                      P3 · Baja
                    </option>

                  </select>

                </label>

                <label>

                  <span>
                    Técnico
                  </span>

                  <select
                    value={
                      form.tecnico
                    }

                    disabled={
                      saving
                    }

                    onChange={(event) =>
                      updateField(
                        "tecnico",
                        event.target.value
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

              {/* =================================
                  DOMICILIO
              ================================= */}

              {form.tipoServicio ===
                "Domicilio" && (

                <div className="new-ticket-conditional">

                  <div className="new-ticket-conditional-title">

                    <MapPin
                      size={16}
                    />

                    Datos de visita

                  </div>

                  <div className="new-ticket-grid four">

                    <label>

                      <span>
                        Dirección
                      </span>

                      <input
                        type="text"

                        value={
                          form
                            .datosDomicilio
                            .direccion
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosDomicilio",
                            "direccion",
                            event.target.value
                          )
                        }
                      />

                    </label>

                    <label>

                      <span>
                        Fecha
                      </span>

                      <input
                        type="date"

                        value={
                          form
                            .datosDomicilio
                            .fecha
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosDomicilio",
                            "fecha",
                            event.target.value
                          )
                        }
                      />

                    </label>

                    <label>

                      <span>
                        Hora
                      </span>

                      <input
                        type="time"

                        value={
                          form
                            .datosDomicilio
                            .hora
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosDomicilio",
                            "hora",
                            event.target.value
                          )
                        }
                      />

                    </label>

                    <label>

                      <span>
                        Contacto
                      </span>

                      <input
                        type="text"

                        value={
                          form
                            .datosDomicilio
                            .contacto
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosDomicilio",
                            "contacto",
                            event.target.value
                          )
                        }
                      />

                    </label>

                  </div>

                </div>

              )}

              {/* =================================
                  REMOTO
              ================================= */}

              {form.tipoServicio ===
                "Remoto" && (

                <div className="new-ticket-conditional">

                  <div className="new-ticket-conditional-title">

                    <Wifi
                      size={16}
                    />

                    Acceso remoto

                  </div>

                  <div className="new-ticket-grid three">

                    <label>

                      <span>
                        Plataforma
                      </span>

                      <input
                        type="text"

                        placeholder="AnyDesk, RustDesk..."

                        value={
                          form
                            .datosRemoto
                            .plataforma
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosRemoto",
                            "plataforma",
                            event.target.value
                          )
                        }
                      />

                    </label>

                    <label>

                      <span>
                        ID de conexión
                      </span>

                      <input
                        type="text"

                        value={
                          form
                            .datosRemoto
                            .idConexion
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosRemoto",
                            "idConexion",
                            event.target.value
                          )
                        }
                      />

                    </label>

                    <label>

                      <span>
                        Clave temporal
                      </span>

                      <input
                        type="text"

                        value={
                          form
                            .datosRemoto
                            .clave
                        }

                        onChange={(event) =>
                          updateNested(
                            "datosRemoto",
                            "clave",
                            event.target.value
                          )
                        }
                      />

                    </label>

                  </div>

                </div>

              )}

            </section>

            {/* =================================
                EQUIPO
            ================================= */}

            <section className="new-ticket-section">

              <div className="new-ticket-section-heading">

                <Cpu
                  size={18}
                />

                <div>

                  <span>
                    Equipo
                  </span>

                  <h3>
                    Identificación técnica
                  </h3>

                </div>

              </div>

              <div className="new-ticket-grid four">

                <label>

                  <span>
                    Tipo de equipo
                  </span>

                  <select
                    value={
                      form.equipo
                    }

                    disabled={
                      saving
                    }

                    onChange={(event) =>
                      updateField(
                        "equipo",
                        event.target.value
                      )
                    }
                  >

                    <option value="Notebook">
                      Notebook
                    </option>

                    <option value="PC">
                      PC
                    </option>

                    <option value="All in One">
                      All in One
                    </option>

                    <option value="Celular">
                      Celular
                    </option>

                    <option value="Tablet">
                      Tablet
                    </option>

                    <option value="Impresora">
                      Impresora
                    </option>

                    <option value="Consola">
                      Consola
                    </option>

                    <option value="Otro">
                      Otro
                    </option>

                  </select>

                </label>

                <label>

                  <span>
                    Marca
                  </span>

                  <input
                    type="text"

                    disabled={
                      saving
                    }

                    value={
                      form.marca
                    }

                    onChange={(event) =>
                      updateField(
                        "marca",
                        event.target.value
                      )
                    }
                  />

                </label>

                <label>

                  <span>
                    Modelo
                  </span>

                  <input
                    type="text"

                    disabled={
                      saving
                    }

                    value={
                      form.modelo
                    }

                    onChange={(event) =>
                      updateField(
                        "modelo",
                        event.target.value
                      )
                    }
                  />

                </label>

                <label>

                  <span>
                    Serie
                  </span>

                  <input
                    type="text"

                    disabled={
                      saving
                    }

                    value={
                      form.serie
                    }

                    onChange={(event) =>
                      updateField(
                        "serie",
                        event.target.value
                      )
                    }
                  />

                </label>

              </div>

              <div className="new-ticket-grid two">

                <label>

                  <span>
                    PIN / contraseña
                  </span>

                  <input
                    type="text"

                    disabled={
                      saving
                    }

                    value={
                      form.pin
                    }

                    onChange={(event) =>
                      updateField(
                        "pin",
                        event.target.value
                      )
                    }
                  />

                </label>

                <label>

                  <span>
                    Especificaciones
                  </span>

                  <input
                    type="text"

                    disabled={
                      saving
                    }

                    placeholder="CPU, RAM, almacenamiento..."

                    value={
                      form.specs
                    }

                    onChange={(event) =>
                      updateField(
                        "specs",
                        event.target.value
                      )
                    }
                  />

                </label>

              </div>

            </section>

            {/* =================================
                RECEPCIÓN
            ================================= */}

            <section className="new-ticket-section">

              <div className="new-ticket-section-heading">

                <Wrench
                  size={18}
                />

                <div>

                  <span>
                    Recepción
                  </span>

                  <h3>
                    Estado y motivo de consulta
                  </h3>

                </div>

              </div>

              <div className="new-ticket-grid two">

                <label>

                  <span>
                    Condición de ingreso
                  </span>

                  <textarea
                    rows={4}

                    disabled={
                      saving
                    }

                    placeholder="Estado general del equipo al recibirlo..."

                    value={
                      form.condicion
                    }

                    onChange={(event) =>
                      updateField(
                        "condicion",
                        event.target.value
                      )
                    }
                  />

                </label>

                <label>

                  <span>
                    Falla / motivo *
                  </span>

                  <textarea
                    rows={4}

                    required

                    disabled={
                      saving
                    }

                    placeholder="Describí el problema informado por el cliente..."

                    value={
                      form.falla
                    }

                    onChange={(event) =>
                      updateField(
                        "falla",
                        event.target.value
                      )
                    }
                  />

                </label>

              </div>

              {/* =================================
                  CHECKS
              ================================= */}

              <div className="new-ticket-check-groups">

                <div>

                  <strong>
                    Estado físico
                  </strong>

                  <div className="new-ticket-checks">

                    {[
                      [
                        "pantalla",
                        "Pantalla",
                      ],

                      [
                        "carcasa",
                        "Carcasa",
                      ],

                      [
                        "teclado",
                        "Teclado",
                      ],

                      [
                        "cargador",
                        "Cargador",
                      ],

                      [
                        "bateria",
                        "Batería",
                      ],

                      [
                        "puertos",
                        "Puertos",
                      ],
                    ].map(
                      ([
                        key,
                        label,
                      ]) => (

                        <label
                          key={
                            key
                          }
                        >

                          <input
                            type="checkbox"

                            disabled={
                              saving
                            }

                            checked={
                              form
                                .estadoFisico[
                                key
                              ]
                            }

                            onChange={(event) =>
                              updateNested(
                                "estadoFisico",
                                key,
                                event.target.checked
                              )
                            }
                          />

                          <span>
                            {label}
                          </span>

                        </label>

                      )
                    )}

                  </div>

                </div>

                <div>

                  <strong>
                    Accesorios recibidos
                  </strong>

                  <div className="new-ticket-checks">

                    {[
                      [
                        "cargador",
                        "Cargador",
                      ],

                      [
                        "funda",
                        "Funda",
                      ],

                      [
                        "cable",
                        "Cable",
                      ],
                    ].map(
                      ([
                        key,
                        label,
                      ]) => (

                        <label
                          key={
                            key
                          }
                        >

                          <input
                            type="checkbox"

                            disabled={
                              saving
                            }

                            checked={
                              form
                                .accesoriosObj[
                                key
                              ]
                            }

                            onChange={(event) =>
                              updateNested(
                                "accesoriosObj",
                                key,
                                event.target.checked
                              )
                            }
                          />

                          <span>
                            {label}
                          </span>

                        </label>

                      )
                    )}

                  </div>

                </div>

              </div>

            </section>

            {/* =================================
                FOTOS
            ================================= */}

            <section className="new-ticket-section">

              <div className="new-ticket-section-heading">

                <Camera
                  size={18}
                />

                <div>

                  <span>
                    Evidencia
                  </span>

                  <h3>
                    Fotografías de ingreso
                  </h3>

                </div>

              </div>

              <label className="new-ticket-photo-input">

                <Camera
                  size={19}
                />

                <div>

                  <strong>
                    Seleccionar imágenes
                  </strong>

                  <span>
                    Hasta 3 fotos · máximo 8 MB cada una
                  </span>

                </div>

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

              </label>

              {form.photos.length >
                0 && (

                <div className="new-ticket-photo-list">

                  {form.photos.map(
                    (
                      file
                    ) => (

                      <span
                        key={
                          `${file.name}-${file.size}`
                        }
                      >
                        {file.name}
                      </span>

                    )
                  )}

                </div>

              )}

            </section>

          </div>

          {/* =================================
              FOOTER
          ================================= */}

          <footer className="new-ticket-footer">

            <div>

              <ShieldCheck
                size={16}
              />

              El ticket será guardado en Firebase.

            </div>

            <div>

              <button
                type="button"

                className="new-ticket-cancel"

                onClick={
                  onClose
                }

                disabled={
                  saving
                }
              >
                Cancelar
              </button>

              <button
                type="submit"

                className="new-ticket-save"

                disabled={
                  saving
                }
              >

                <Save
                  size={17}
                />

                {saving
                  ? "Creando ticket..."
                  : "Registrar ingreso"}

              </button>

            </div>

          </footer>

        </form>

      </motion.div>

    </div>
  );
}