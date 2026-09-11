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
  FilePenLine,
  FileText,
  History,
  Plus,
  ReceiptText,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  subscribeToInvoices,
} from "../../services/facturas.service.js";

import {
  addInvoiceRectification,
} from "../../services/rectificaciones.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Rectificaciones.css";

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style:
        "currency",

      currency:
        "ARS",

      maximumFractionDigits:
        0,
    }
  ).format(
    Number(
      value ||
      0
    )
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parts =
    String(
      value
    ).split("-");

  if (
    parts.length ===
    3
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

function isRectificationEvent(
  event
) {
  return String(
    event?.accion ||
    ""
  )
    .toLowerCase()
    .includes(
      "rectific"
    );
}

function getEventAuthor(
  event,
  invoice
) {
  if (
    event?.autor
  ) {
    return event.autor;
  }

  const detail =
    String(
      event?.detalle ||
      ""
    );

  const match =
    detail.match(
      /Usuario:\s*(.+)$/i
    );

  if (
    match?.[1]
  ) {
    return match[1].trim();
  }

  return (
    invoice?.usuario ||
    "Sistema"
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function Rectificaciones() {
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
    documents,
    setDocuments,
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
    search,
    setSearch,
  ] = useState("");

  const [
    selectedInvoiceId,
    setSelectedInvoiceId,
  ] = useState(null);

  /* =======================================
     MODAL
  ======================================= */

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    targetInvoiceId,
    setTargetInvoiceId,
  ] = useState("");

  const [
    observation,
    setObservation,
  ] = useState("");

  const [
    saving,
    setSaving,
  ] = useState(false);

  /* =======================================
     FIREBASE
  ======================================= */

  useEffect(() => {
    setLoading(
      true
    );

    const unsubscribe =
      subscribeToInvoices(
        (
          data
        ) => {
          setDocuments(
            data
          );

          setError(
            null
          );

          setLoading(
            false
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
            "No pudimos cargar las rectificaciones",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     FACTURAS
  ======================================= */

  const invoices =
    useMemo(
      () =>
        documents.filter(
          (
            document
          ) =>
            !document.tipo ||
            document.tipo ===
              "Factura"
        ),

      [
        documents,
      ]
    );

  /* =======================================
     FACTURAS RECTIFICADAS
  ======================================= */

  const rectifiedInvoices =
    useMemo(
      () =>
        invoices.filter(
          (
            invoice
          ) =>
            Array.isArray(
              invoice.historial
            ) &&
            invoice.historial.some(
              isRectificationEvent
            )
        ),

      [
        invoices,
      ]
    );

  /* =======================================
     EVENTOS
  ======================================= */

  const rectifications =
    useMemo(
      () =>
        rectifiedInvoices.flatMap(
          (
            invoice
          ) =>
            invoice.historial
              .filter(
                isRectificationEvent
              )
              .map(
                (
                  event,
                  index
                ) => ({
                  id:
                    `${invoice.id}-${index}`,

                  invoiceId:
                    invoice.id,

                  cliente:
                    invoice.cliente ||
                    "Consumidor Final",

                  total:
                    Number(
                      invoice.total ||
                      0
                    ),

                  estado:
                    invoice.estado ||
                    "—",

                  fechaFactura:
                    invoice.fecha,

                  fecha:
                    event.fecha,

                  detalle:
                    event.detalle ||
                    "",

                  autor:
                    getEventAuthor(
                      event,
                      invoice
                    ),
                })
              )
        ),

      [
        rectifiedInvoices,
      ]
    );

  /* =======================================
     FILTRADO
  ======================================= */

  const filteredInvoices =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return rectifiedInvoices;
      }

      return rectifiedInvoices.filter(
        (
          invoice
        ) => {
          const historyText =
            Array.isArray(
              invoice.historial
            )
              ? invoice.historial
                  .filter(
                    isRectificationEvent
                  )
                  .map(
                    (
                      event
                    ) =>
                      `${event.accion || ""} ${event.detalle || ""}`
                  )
                  .join(" ")
              : "";

          const source = [
            invoice.id,
            invoice.cliente,
            invoice.doc,
            invoice.refId,
            invoice.estado,
            historyText,
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
      );
    }, [
      rectifiedInvoices,
      search,
    ]);

  /* =======================================
     SELECCIÓN
  ======================================= */

  useEffect(() => {
    if (
      selectedInvoiceId &&
      rectifiedInvoices.some(
        (
          invoice
        ) =>
          invoice.id ===
          selectedInvoiceId
      )
    ) {
      return;
    }

    setSelectedInvoiceId(
      rectifiedInvoices[0]?.id ||
      null
    );
  }, [
    rectifiedInvoices,
    selectedInvoiceId,
  ]);

  const selectedInvoice =
    useMemo(
      () =>
        rectifiedInvoices.find(
          (
            invoice
          ) =>
            invoice.id ===
            selectedInvoiceId
        ) ||
        null,

      [
        rectifiedInvoices,
        selectedInvoiceId,
      ]
    );

  const selectedEvents =
    useMemo(() => {
      if (
        !selectedInvoice
      ) {
        return [];
      }

      return selectedInvoice.historial
        .filter(
          isRectificationEvent
        )
        .slice()
        .reverse();
    }, [
      selectedInvoice,
    ]);

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(
      () => ({
        total:
          rectifications.length,

        invoices:
          rectifiedInvoices.length,

        available:
          invoices.filter(
            (
              invoice
            ) =>
              invoice.estado ===
              "Emitida"
          ).length,

        amount:
          rectifiedInvoices.reduce(
            (
              total,
              invoice
            ) =>
              total +
              Number(
                invoice.total ||
                0
              ),

            0
          ),
      }),

      [
        invoices,
        rectifications,
        rectifiedInvoices,
      ]
    );

  /* =======================================
     NUEVA RECTIFICACIÓN
  ======================================= */

  const openNewRectification =
    (
      invoiceId = ""
    ) => {
      setTargetInvoiceId(
        invoiceId
      );

      setObservation(
        ""
      );

      setModalOpen(
        true
      );
    };

  const closeModal =
    () => {
      if (
        saving
      ) {
        return;
      }

      setModalOpen(
        false
      );

      setTargetInvoiceId(
        ""
      );

      setObservation(
        ""
      );
    };

  /* =======================================
     GUARDAR
  ======================================= */

  const handleSave =
    async () => {
      if (
        !targetInvoiceId
      ) {
        notify.warning(
          "Seleccioná una factura",
          "Elegí el comprobante que querés rectificar."
        );

        return;
      }

      if (
        !observation.trim()
      ) {
        notify.warning(
          "Falta la observación",
          "Indicá qué dato se está rectificando."
        );

        return;
      }

      try {
        setSaving(
          true
        );

        await addInvoiceRectification(
          targetInvoiceId,
          observation,
          author
        );

        setSelectedInvoiceId(
          targetInvoiceId
        );

        notify.success(
          "Rectificación registrada",
          `${targetInvoiceId} conserva sus importes y suma la observación al historial.`
        );

        setModalOpen(
          false
        );

        setTargetInvoiceId(
          ""
        );

        setObservation(
          ""
        );
      } catch (
        saveError
      ) {
        console.error(
          saveError
        );

        const messages = {
          INVOICE_ID_REQUIRED:
            "Seleccioná una factura.",

          RECTIFICATION_REQUIRED:
            "Ingresá la observación.",

          INVOICE_NOT_FOUND:
            "No encontramos la factura en Firestore.",

          INVOICE_INVALID_TYPE:
            "El documento seleccionado no es una factura.",

          INVOICE_NOT_ISSUED:
            "La factura ya fue anulada o cancelada y no admite nuevas rectificaciones.",
        };

        notify.error(
          "No se pudo rectificar",
          messages[
            saveError?.message
          ] ||
            saveError?.message ||
            "Ocurrió un error al guardar la rectificación."
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
    <main className="rectifications-page">

      {/* =================================
          HEADER
      ================================= */}

      <header className="rectifications-header">

        <div className="rectifications-header-left">

          <button
            type="button"
            className="rectifications-back"

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

          <div className="rectifications-header-icon">

            <FilePenLine
              size={20}
            />

          </div>

          <div>

            <span>
              Facturación
            </span>

            <h1>
              Rectificaciones
            </h1>

          </div>

        </div>

        <button
          type="button"

          className="rectifications-new"

          onClick={() =>
            openNewRectification()
          }
        >
          <Plus
            size={17}
          />

          Nueva rectificación
        </button>

      </header>

      {/* =================================
          CONTENIDO
      ================================= */}

      <div className="rectifications-content">

        <motion.section
          className="rectifications-intro"

          initial={{
            opacity: 0,
            y: 8,
          }}

          animate={{
            opacity: 1,
            y: 0,
          }}
        >

          <div>

            <span className="rectifications-kicker">
              Correcciones formales
            </span>

            <h2>
              Rectificaciones de comprobantes
            </h2>

            <p>
              Registrá observaciones administrativas sin modificar
              importes, pagos ni movimientos de Caja.
            </p>

          </div>

          <div className="rectifications-info">

            <History
              size={18}
            />

            <div>

              <strong>
                Sólo trazabilidad
              </strong>

              <span>
                La factura original se conserva
              </span>

            </div>

          </div>

        </motion.section>

        {/* =================================
            MÉTRICAS
        ================================= */}

        <section className="rectifications-stats">

          <article>

            <span>
              Rectificaciones
            </span>

            <strong>
              {metrics.total}
            </strong>

            <small>
              Observaciones registradas
            </small>

          </article>

          <article>

            <span>
              Facturas rectificadas
            </span>

            <strong>
              {metrics.invoices}
            </strong>

            <small>
              Comprobantes afectados
            </small>

          </article>

          <article>

            <span>
              Emitidas disponibles
            </span>

            <strong>
              {metrics.available}
            </strong>

            <small>
              Para nuevas correcciones
            </small>

          </article>

          <article>

            <span>
              Valor documental
            </span>

            <strong className="rectifications-money">
              {formatMoney(
                metrics.amount
              )}
            </strong>

            <small>
              No implica movimiento económico
            </small>

          </article>

        </section>

        {/* =================================
            WORKSPACE
        ================================= */}

        <section className="rectifications-workspace">

          <div className="rectifications-toolbar">

            <div className="rectifications-search">

              <Search
                size={17}
              />

              <input
                type="search"

                placeholder="Buscar factura, cliente o rectificación..."

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
                >
                  <X
                    size={14}
                  />
                </button>

              )}

            </div>

            <span className="rectifications-count">
              {filteredInvoices.length} comprobantes
            </span>

          </div>

          <div className="rectifications-layout">

            {/* =================================
                LISTA
            ================================= */}

            <section className="rectifications-list">

              {loading && (

                <div className="rectifications-state">

                  <div className="rectifications-loader" />

                  <strong>
                    Cargando rectificaciones
                  </strong>

                  <span>
                    Sincronizando con Firestore...
                  </span>

                </div>

              )}

              {!loading &&
                error && (

                <div className="rectifications-state">

                  <strong>
                    No pudimos cargar los datos
                  </strong>

                  <span>
                    Revisá conexión y permisos.
                  </span>

                </div>

              )}

              {!loading &&
                !error &&
                filteredInvoices.length ===
                  0 && (

                <div className="rectifications-state">

                  <FilePenLine
                    size={28}
                  />

                  <strong>
                    Todavía no hay rectificaciones
                  </strong>

                  <span>
                    Podés registrar la primera desde el botón superior.
                  </span>

                </div>

              )}

              {!loading &&
                !error &&
                filteredInvoices.map(
                  (
                    invoice
                  ) => {
                    const rectificationCount =
                      invoice.historial.filter(
                        isRectificationEvent
                      ).length;

                    const active =
                      invoice.id ===
                      selectedInvoiceId;

                    return (
                      <motion.button
                        type="button"

                        layout

                        key={
                          invoice.id
                        }

                        className={
                          `rectification-row ${
                            active
                              ? "active"
                              : ""
                          }`
                        }

                        onClick={() =>
                          setSelectedInvoiceId(
                            invoice.id
                          )
                        }
                      >

                        <div>

                          <div className="rectification-row-top">

                            <strong>
                              {invoice.id}
                            </strong>

                            <span>
                              {rectificationCount}
                              {" "}
                              {rectificationCount ===
                              1
                                ? "rectificación"
                                : "rectificaciones"}
                            </span>

                          </div>

                          <h3>
                            {invoice.cliente ||
                              "Consumidor Final"}
                          </h3>

                          <small>
                            {formatDate(
                              invoice.fecha
                            )}
                          </small>

                        </div>

                        <div className="rectification-row-total">

                          <strong>
                            {formatMoney(
                              invoice.total
                            )}
                          </strong>

                          <span>
                            {invoice.estado ||
                              "—"}
                          </span>

                        </div>

                        <ChevronRight
                          size={17}
                        />

                      </motion.button>
                    );
                  }
                )}

            </section>

            {/* =================================
                DETALLE
            ================================= */}

            <aside className="rectifications-detail">

              {!selectedInvoice ? (

                <div className="rectifications-detail-empty">

                  <FilePenLine
                    size={30}
                  />

                  <strong>
                    Seleccioná una factura
                  </strong>

                  <span>
                    Acá aparecerá su historial de rectificaciones.
                  </span>

                </div>

              ) : (

                <>
                  <div className="rectifications-detail-header">

                    <div>

                      <span>
                        Factura
                      </span>

                      <h2>
                        {selectedInvoice.id}
                      </h2>

                    </div>

                    {selectedInvoice.estado ===
                      "Emitida" && (

                      <button
                        type="button"

                        onClick={() =>
                          openNewRectification(
                            selectedInvoice.id
                          )
                        }
                      >
                        <Plus
                          size={15}
                        />

                        Agregar
                      </button>

                    )}

                  </div>

                  <div className="rectifications-client">

                    <UserRound
                      size={18}
                    />

                    <div>

                      <span>
                        Cliente
                      </span>

                      <strong>
                        {selectedInvoice.cliente ||
                          "Consumidor Final"}
                      </strong>

                    </div>

                  </div>

                  <div className="rectifications-summary">

                    <div>

                      <CalendarDays
                        size={15}
                      />

                      <span>
                        Fecha factura
                      </span>

                      <strong>
                        {formatDate(
                          selectedInvoice.fecha
                        )}
                      </strong>

                    </div>

                    <div>

                      <CheckCircle2
                        size={15}
                      />

                      <span>
                        Estado
                      </span>

                      <strong>
                        {selectedInvoice.estado ||
                          "—"}
                      </strong>

                    </div>

                    <div>

                      <FileText
                        size={15}
                      />

                      <span>
                        Total
                      </span>

                      <strong>
                        {formatMoney(
                          selectedInvoice.total
                        )}
                      </strong>

                    </div>

                  </div>

                  <button
                    type="button"

                    className="rectifications-open-invoice"

                    onClick={() =>
                      navigate(
                        "/facturacion/facturas"
                      )
                    }
                  >
                    <ReceiptText
                      size={16}
                    />

                    Ver en Facturas
                  </button>

                  <section className="rectifications-history">

                    <span className="rectifications-label">
                      Historial de rectificaciones
                    </span>

                    {selectedEvents.map(
                      (
                        event,
                        index
                      ) => (

                        <article
                          key={
                            `${event.fecha}-${index}`
                          }
                        >

                          <div className="rectification-dot" />

                          <section>

                            <header>

                              <strong>
                                Rectificación
                              </strong>

                              <span>
                                {event.fecha ||
                                  "—"}
                              </span>

                            </header>

                            <p>
                              {event.detalle ||
                                "Sin detalle."}
                            </p>

                            <small>
                              {getEventAuthor(
                                event,
                                selectedInvoice
                              )}
                            </small>

                          </section>

                        </article>

                      )
                    )}

                  </section>

                </>

              )}

            </aside>

          </div>

        </section>

      </div>

      {/* =================================
          MODAL
      ================================= */}

      {modalOpen && (

        <div
          className="rectification-modal-overlay"

          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !saving
            ) {
              closeModal();
            }
          }}
        >

          <motion.div
            className="rectification-modal"

            initial={{
              opacity: 0,
              scale: 0.97,
              y: 8,
            }}

            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >

            <div className="rectification-modal-heading">

              <div>

                <FilePenLine
                  size={20}
                />

              </div>

              <section>

                <span>
                  Corrección formal
                </span>

                <h3>
                  Nueva rectificación
                </h3>

              </section>

              <button
                type="button"

                disabled={
                  saving
                }

                onClick={
                  closeModal
                }
              >
                <X
                  size={18}
                />
              </button>

            </div>

            <label className="rectification-field">

              <span>
                Factura
              </span>

              <select
                value={
                  targetInvoiceId
                }

                disabled={
                  saving
                }

                onChange={(event) =>
                  setTargetInvoiceId(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Seleccionar factura...
                </option>

                {invoices
                  .filter(
                    (
                      invoice
                    ) =>
                      invoice.estado ===
                      "Emitida"
                  )
                  .map(
                    (
                      invoice
                    ) => (

                      <option
                        key={
                          invoice.id
                        }

                        value={
                          invoice.id
                        }
                      >
                        {invoice.id}
                        {" · "}
                        {invoice.cliente ||
                          "Consumidor Final"}
                        {" · "}
                        {formatMoney(
                          invoice.total
                        )}
                      </option>

                    )
                  )}

              </select>

            </label>

            <label className="rectification-field">

              <span>
                Observación
              </span>

              <textarea
                rows={5}

                disabled={
                  saving
                }

                placeholder="Ej: Corrección de DNI. Donde dice 30111222 debe decir 30111333."

                value={
                  observation
                }

                onChange={(event) =>
                  setObservation(
                    event.target.value
                  )
                }
              />

            </label>

            <div className="rectification-warning">

              <History
                size={16}
              />

              <span>
                Esta acción no cambia el total ni el pago.
                Sólo incorpora la corrección al historial.
              </span>

            </div>

            <div className="rectification-modal-actions">

              <button
                type="button"

                disabled={
                  saving
                }

                onClick={
                  closeModal
                }
              >
                Cancelar
              </button>

              <button
                type="button"

                className="primary"

                disabled={
                  saving
                }

                onClick={
                  handleSave
                }
              >
                {saving
                  ? "Guardando..."
                  : "Registrar rectificación"}
              </button>

            </div>

          </motion.div>

        </div>

      )}

    </main>
  );
}