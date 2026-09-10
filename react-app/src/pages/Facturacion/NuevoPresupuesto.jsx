import {
  useEffect,
  useMemo,
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
  Calculator,
  CalendarDays,
  Check,
  CircleAlert,
  ClipboardList,
  Plus,
  Save,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import {
  createManualBudget,
} from "../../services/presupuestos.service.js";

import {
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

import "./NuevoPresupuesto.css";

/* =========================================
   ITEM VACÍO
========================================= */

function createItem() {
  return {
    id:
      typeof crypto !== "undefined" &&
      crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random()}`,

    descripcion: "",
    cantidad: 1,
    precio: "",
  };
}

/* =========================================
   HELPERS
========================================= */

function normalizeText(value) {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase();
}

function money(value) {
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

function errorMessage(error) {
  const map = {
    BUDGET_CLIENT_REQUIRED:
      "Seleccioná un cliente.",

    BUDGET_CLIENT_ARCHIVED:
      "El cliente está archivado. Restauralo antes de crear el presupuesto.",

    BUDGET_ITEMS_REQUIRED:
      "Agregá al menos un concepto.",

    BUDGET_ITEM_INVALID:
      "Revisá los conceptos: descripción, cantidad y precio deben ser válidos.",

    BUDGET_TOTAL_INVALID:
      "El total del presupuesto debe ser mayor que cero.",
  };

  return (
    map[
      error?.message
    ] ||
    error?.message ||
    "No se pudo crear el presupuesto."
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function NuevoPresupuesto() {
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
     CLIENTES
  ======================================= */

  const [
    clients,
    setClients,
  ] =
    useState([]);

  const [
    loadingClients,
    setLoadingClients,
  ] =
    useState(true);

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

  /* =======================================
     PRESUPUESTO
  ======================================= */

  const [
    items,
    setItems,
  ] =
    useState([
      createItem(),
    ]);

  const [
    discountPercent,
    setDiscountPercent,
  ] =
    useState("0");

  const [
    validityDays,
    setValidityDays,
  ] =
    useState("15");

  const [
    observations,
    setObservations,
  ] =
    useState("");

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

  /* =======================================
     FIREBASE - CLIENTES
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

      return unsubscribe;
    },
    []
  );

  /* =======================================
     CONFIGURACIÓN DEL NEGOCIO
  ======================================= */

  useEffect(
    () => {
      const unsubscribe =
        subscribeToBusinessConfig(
          (
            config
          ) => {
            const days =
              Number(
                config?.presupuestoValidezDias
              );

            if (
              Number.isFinite(
                days
              ) &&
              days > 0
            ) {
              setValidityDays(
                String(
                  Math.trunc(
                    days
                  )
                )
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

      return unsubscribe;
    },
    []
  );

  /* =======================================
     CLIENTE PRESELECCIONADO
     ?cliente=ID
  ======================================= */

  useEffect(
    () => {
      if (
        !clients.length
      ) {
        return;
      }

      const clientId =
        searchParams.get(
          "cliente"
        );

      if (
        !clientId
      ) {
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

      if (
        client &&
        client.archivado !==
          true
      ) {
        setSelectedClient(
          client
        );

        setClientQuery(
          getClientDisplayName(
            client
          )
        );
      }
    },
    [
      clients,
      searchParams,
    ]
  );

  /* =======================================
     SUGERENCIAS DE CLIENTES
  ======================================= */

  const clientSuggestions =
    useMemo(
      () => {
        const query =
          normalizeText(
            clientQuery
          );

        const source =
          query
            ? clients.filter(
                (
                  client
                ) => {
                  const text =
                    [
                      getClientDisplayName(
                        client
                      ),
                      client.dni,
                      client.cuit,
                      client.tel,
                      client.email,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " "
                      )
                      .toLowerCase();

                  return text.includes(
                    query
                  );
                }
              )
            : clients;

        return source.slice(
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
     TOTALES
  ======================================= */

  const totals =
    useMemo(
      () => {
        const subtotal =
          items.reduce(
            (
              sum,
              item
            ) => {
              const quantity =
                Math.max(
                  0,
                  Number(
                    item.cantidad ||
                    0
                  )
                );

              const price =
                Math.max(
                  0,
                  Number(
                    item.precio ||
                    0
                  )
                );

              return (
                sum +
                quantity *
                  price
              );
            },
            0
          );

        const discount =
          Math.min(
            100,
            Math.max(
              0,
              Number(
                discountPercent ||
                0
              )
            )
          );

        const discountAmount =
          subtotal *
          (
            discount /
            100
          );

        return {
          subtotal,
          discount,
          discountAmount,

          total:
            Math.max(
              0,
              subtotal -
                discountAmount
            ),
        };
      },
      [
        items,
        discountPercent,
      ]
    );

  /* =======================================
     CLIENTE
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
          "Restauralo antes de crear un presupuesto."
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
     ITEMS
  ======================================= */

  const updateItem =
    (
      itemId,
      field,
      value
    ) => {
      setItems(
        (
          current
        ) =>
          current.map(
            (
              item
            ) =>
              item.id ===
              itemId
                ? {
                    ...item,

                    [field]:
                      value,
                  }
                : item
          )
      );

      setDirty(
        true
      );
    };

  const addItem =
    () => {
      setItems(
        (
          current
        ) => [
          ...current,
          createItem(),
        ]
      );

      setDirty(
        true
      );
    };

  const removeItem =
    (
      itemId
    ) => {
      setItems(
        (
          current
        ) => {
          if (
            current.length ===
            1
          ) {
            return [
              createItem(),
            ];
          }

          return current.filter(
            (
              item
            ) =>
              item.id !==
              itemId
          );
        }
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
            "Hay cambios sin guardar. ¿Descartar el presupuesto?"
          );

        if (
          !confirmed
        ) {
          return;
        }
      }

      navigate(
        "/facturacion/presupuestos"
      );
    };

  /* =======================================
     GUARDAR
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
        !selectedClient
      ) {
        notify.warning(
          "Falta el cliente",
          "Seleccioná un cliente de la base."
        );

        return;
      }

      if (
        selectedClient.archivado ===
        true
      ) {
        notify.warning(
          "Cliente archivado",
          "Restauralo antes de crear el presupuesto."
        );

        return;
      }

      const cleanItems =
        items.map(
          (
            item
          ) => ({
            descripcion:
              String(
                item.descripcion ||
                ""
              ).trim(),

            cantidad:
              Number(
                item.cantidad ||
                0
              ),

            precio:
              Number(
                item.precio ||
                0
              ),
          })
        );

      if (
        cleanItems.some(
          (
            item
          ) =>
            !item.descripcion ||
            item.cantidad <=
              0 ||
            item.precio <
              0
        )
      ) {
        notify.warning(
          "Revisá los conceptos",
          "Cada concepto necesita descripción, cantidad y precio válidos."
        );

        return;
      }

      if (
        totals.total <=
        0
      ) {
        notify.warning(
          "Total inválido",
          "El presupuesto debe tener un total mayor que cero."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        const budget =
          await createManualBudget({
            client:
              selectedClient,

            items:
              cleanItems,

            discountPercent:
              totals.discount,

            validityDays:
              Number(
                validityDays ||
                15
              ),

            observations,

            author,
          });

        setDirty(
          false
        );

        notify.success(
          "Presupuesto creado",
          `${budget.id} fue generado correctamente.`
        );

        navigate(
          "/facturacion/presupuestos",
          {
            replace:
              true,

            state: {
              budgetId:
                budget.id,
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
          "No se pudo crear el presupuesto",
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
    <main className="manual-budget-page">

      <form
        className="manual-budget-shell"
        onSubmit={
          handleSubmit
        }
      >

        {/* =================================
            HEADER
        ================================= */}

        <header className="manual-budget-header">

          <div className="manual-budget-header-left">

            <button
              type="button"
              className="manual-budget-back"
              onClick={
                handleBack
              }
              disabled={
                saving
              }
              title="Volver a Presupuestos"
            >
              <ArrowLeft
                size={19}
              />
            </button>

            <div className="manual-budget-header-icon">
              <ClipboardList
                size={20}
              />
            </div>

            <div>
              <span>
                Facturación
              </span>

              <h1>
                Nuevo presupuesto
              </h1>
            </div>

          </div>

          <motion.button
            type="submit"
            className="manual-budget-save"
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
              size={17}
            />

            {saving
              ? "Guardando..."
              : "Crear presupuesto"}
          </motion.button>

        </header>

        {/* =================================
            INTRO
        ================================= */}

        <section className="manual-budget-intro">

          <div>
            <span>
              Operación manual
            </span>

            <h2>
              Presupuesto independiente
            </h2>

            <p>
              Creá un presupuesto comercial sin necesidad de
              vincularlo a un ticket.
            </p>
          </div>

          <div className="manual-budget-origin">
            <Check
              size={15}
            />

            Origen: Manual
          </div>

        </section>

        {/* =================================
            LAYOUT
        ================================= */}

        <div className="manual-budget-layout">

          <div className="manual-budget-main">

            {/* =================================
                CLIENTE
            ================================= */}

            <section className="manual-budget-card">

              <div className="manual-budget-card-head">

                <UserRound
                  size={18}
                />

                <div>
                  <span>
                    Cliente
                  </span>

                  <h3>
                    Datos comerciales
                  </h3>
                </div>

              </div>

              <div className="manual-budget-card-body">

                <label className="manual-budget-field">

                  <span>
                    Buscar cliente *
                  </span>

                  <div className="manual-budget-client-search">

                    <Search
                      size={16}
                    />

                    <input
                      type="text"
                      value={
                        clientQuery
                      }
                      placeholder="Nombre, DNI, CUIT, teléfono..."
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
                          size={14}
                        />
                      </button>
                    )}

                    {clientSearchOpen && (
                      <div className="manual-budget-client-results">

                        {loadingClients ? (
                          <div className="manual-budget-client-empty">
                            Cargando clientes...
                          </div>
                        ) : clientSuggestions.length ===
                          0 ? (
                          <div className="manual-budget-client-empty">
                            No encontramos coincidencias.
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
                                    {client.dni
                                      ? `DNI ${client.dni}`
                                      : client.cuit
                                        ? `CUIT ${client.cuit}`
                                        : "Sin documento"}

                                    {client.tel
                                      ? ` · ${client.tel}`
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
                                    size={15}
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
                  <div className="manual-budget-selected-client">

                    <div>
                      <UserRound
                        size={16}
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
                      size={17}
                    />

                  </div>
                )}

              </div>

            </section>

            {/* =================================
                CONCEPTOS
            ================================= */}

            <section className="manual-budget-card">

              <div className="manual-budget-card-head manual-budget-items-head">

                <div>

                  <Plus
                    size={18}
                  />

                  <div>
                    <span>
                      Conceptos
                    </span>

                    <h3>
                      Ítems del presupuesto
                    </h3>
                  </div>

                </div>

                <button
                  type="button"
                  onClick={
                    addItem
                  }
                  disabled={
                    saving
                  }
                >
                  <Plus
                    size={15}
                  />

                  Agregar concepto
                </button>

              </div>

              <div className="manual-budget-items">

                <div className="manual-budget-item-header">
                  <span>
                    Descripción
                  </span>

                  <span>
                    Cantidad
                  </span>

                  <span>
                    Precio unitario
                  </span>

                  <span>
                    Subtotal
                  </span>

                  <span />
                </div>

                {items.map(
                  (
                    item,
                    index
                  ) => {
                    const itemSubtotal =
                      Number(
                        item.cantidad ||
                        0
                      ) *
                      Number(
                        item.precio ||
                        0
                      );

                    return (
                      <div
                        className="manual-budget-item-row"
                        key={
                          item.id
                        }
                      >

                        <label>

                          <span>
                            Concepto{" "}
                            {index + 1}
                          </span>

                          <input
                            type="text"
                            value={
                              item.descripcion
                            }
                            placeholder="Ej. Cambio de disco SSD"
                            disabled={
                              saving
                            }
                            onChange={
                              (
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "descripcion",
                                  event
                                    .target
                                    .value
                                )
                            }
                          />

                        </label>

                        <label>

                          <span>
                            Cantidad
                          </span>

                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={
                              item.cantidad
                            }
                            disabled={
                              saving
                            }
                            onChange={
                              (
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "cantidad",
                                  event
                                    .target
                                    .value
                                )
                            }
                          />

                        </label>

                        <label>

                          <span>
                            Precio
                          </span>

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              item.precio
                            }
                            placeholder="0"
                            disabled={
                              saving
                            }
                            onChange={
                              (
                                event
                              ) =>
                                updateItem(
                                  item.id,
                                  "precio",
                                  event
                                    .target
                                    .value
                                )
                            }
                          />

                        </label>

                        <div className="manual-budget-item-subtotal">

                          <span>
                            Subtotal
                          </span>

                          <strong>
                            {money(
                              itemSubtotal
                            )}
                          </strong>

                        </div>

                        <button
                          type="button"
                          className="manual-budget-item-delete"
                          onClick={() =>
                            removeItem(
                              item.id
                            )
                          }
                          disabled={
                            saving
                          }
                          title="Eliminar concepto"
                        >
                          <Trash2
                            size={16}
                          />
                        </button>

                      </div>
                    );
                  }
                )}

              </div>

            </section>

            {/* =================================
                OBSERVACIONES
            ================================= */}

            <section className="manual-budget-card">

              <div className="manual-budget-card-head">

                <CircleAlert
                  size={18}
                />

                <div>
                  <span>
                    Detalle
                  </span>

                  <h3>
                    Observaciones
                  </h3>
                </div>

              </div>

              <div className="manual-budget-card-body">

                <label className="manual-budget-field">

                  <span>
                    Observaciones para el cliente
                  </span>

                  <textarea
                    rows={4}
                    value={
                      observations
                    }
                    placeholder="Condiciones, aclaraciones, tiempos estimados, alcance del trabajo..."
                    disabled={
                      saving
                    }
                    onChange={
                      (
                        event
                      ) => {
                        setObservations(
                          event
                            .target
                            .value
                        );

                        setDirty(
                          true
                        );
                      }
                    }
                  />

                </label>

              </div>

            </section>

          </div>

          {/* =================================
              SIDEBAR RESUMEN
          ================================= */}

          <aside className="manual-budget-sidebar">

            <section className="manual-budget-summary-card">

              <div className="manual-budget-summary-head">

                <Calculator
                  size={18}
                />

                <div>
                  <span>
                    Resumen
                  </span>

                  <h3>
                    Totales
                  </h3>
                </div>

              </div>

              <div className="manual-budget-summary-body">

                {/* VALIDEZ */}

                <label className="manual-budget-field">

                  <span>
                    Validez
                  </span>

                  <div className="manual-budget-inline-input">

                    <CalendarDays
                      size={15}
                    />

                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={
                        validityDays
                      }
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) => {
                          setValidityDays(
                            event
                              .target
                              .value
                          );

                          setDirty(
                            true
                          );
                        }
                      }
                    />

                    <b>
                      días
                    </b>

                  </div>

                </label>

                {/* DESCUENTO */}

                <label className="manual-budget-field">

                  <span>
                    Descuento
                  </span>

                  <div className="manual-budget-inline-input">

                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={
                        discountPercent
                      }
                      disabled={
                        saving
                      }
                      onChange={
                        (
                          event
                        ) => {
                          setDiscountPercent(
                            event
                              .target
                              .value
                          );

                          setDirty(
                            true
                          );
                        }
                      }
                    />

                    <b>
                      %
                    </b>

                  </div>

                </label>

                {/* TOTALES */}

                <div className="manual-budget-totals">

                  <div>

                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {money(
                        totals.subtotal
                      )}
                    </strong>

                  </div>

                  <div>

                    <span>
                      Descuento (
                      {
                        totals.discount
                      }
                      %)
                    </span>

                    <strong className="discount">
                      -
                      {money(
                        totals.discountAmount
                      )}
                    </strong>

                  </div>

                  <div className="total">

                    <span>
                      Total
                    </span>

                    <strong>
                      {money(
                        totals.total
                      )}
                    </strong>

                  </div>

                </div>

                {/* ESTADO */}

                <div className="manual-budget-status-note">

                  <CircleAlert
                    size={16}
                  />

                  <span>
                    El presupuesto se guardará como{" "}
                    <b>
                      Pendiente
                    </b>{" "}
                    hasta su aceptación o rechazo.
                  </span>

                </div>

                {/* GUARDAR */}

                <motion.button
                  type="submit"
                  className="manual-budget-summary-save"
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
                    size={17}
                  />

                  {saving
                    ? "Guardando..."
                    : "Crear presupuesto"}
                </motion.button>

              </div>

            </section>

          </aside>

        </div>

      </form>

    </main>
  );
}