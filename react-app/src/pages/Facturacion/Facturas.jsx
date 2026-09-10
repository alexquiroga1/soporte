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
  BadgeDollarSign,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  FileText,
  Filter,
  Link2,
  ReceiptText,
  RotateCcw,
  Search,
  Ticket,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  annulInvoice,
  cancelInvoice,
  normalizeInvoiceItems,
  subscribeToInvoices,
} from "../../services/facturas.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Facturas.css";

/* =========================================
   HELPERS
========================================= */

function formatMoney(
  value
) {
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

function formatDate(
  value
) {
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

function getInvoiceStatus(
  invoice
) {
  switch (
    invoice?.estado
  ) {
    case "Emitida":
      return {
        label:
          "Emitida",

        className:
          "invoice-status-issued",
      };

    case "Anulada":
      return {
        label:
          "Anulada",

        className:
          "invoice-status-cancelled",
      };

    case "Cancelada":
      return {
        label:
          "Cancelada",

        className:
          "invoice-status-cancelled",
      };

    case "Rectificada":
      return {
        label:
          "Rectificada",

        className:
          "invoice-status-adjusted",
      };

    default:
      return {
        label:
          invoice?.estado ||
          "Sin estado",

        className:
          "invoice-status-neutral",
      };
  }
}

function isInvoicePaid(
  invoice
) {
  return (
    invoice?.estadoPago ===
      "Pagado Total" ||
    invoice?.estadoPago ===
      "Pagado"
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function Facturas() {
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
    selectedInvoiceId,
    setSelectedInvoiceId,
  ] = useState(null);

  /* =======================================
     FILTROS
  ======================================= */

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    originFilter,
    setOriginFilter,
  ] = useState("");

  /* =======================================
     OPERACIONES
  ======================================= */

  const [
    operationModal,
    setOperationModal,
  ] = useState(null);

  const [
    operationReason,
    setOperationReason,
  ] = useState("");

  const [
    processing,
    setProcessing,
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

          const invoices =
            data.filter(
              (
                document
              ) =>
                !document.tipo ||
                document.tipo ===
                  "Factura"
            );

          setSelectedInvoiceId(
            (
              current
            ) => {
              if (
                current &&
                invoices.some(
                  (
                    invoice
                  ) =>
                    invoice.id ===
                    current
                )
              ) {
                return current;
              }

              return (
                invoices[0]?.id ||
                null
              );
            }
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
            "No pudimos cargar las facturas",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     SOLO FACTURAS
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
     FILTRADAS
  ======================================= */

  const filteredInvoices =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return invoices.filter(
        (
          invoice
        ) => {
          const source = [
            invoice.id,
            invoice.cliente,
            invoice.doc,
            invoice.refId,
            invoice.refModulo,
            invoice.refPago,
            invoice.estado,
            invoice.estadoPago,
          ]
            .filter(
              Boolean
            )
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            source.includes(
              query
            );

          const matchesStatus =
            !statusFilter ||
            invoice.estado ===
              statusFilter;

          const matchesOrigin =
            !originFilter ||
            invoice.refModulo ===
              originFilter;

          return (
            matchesSearch &&
            matchesStatus &&
            matchesOrigin
          );
        }
      );
    }, [
      invoices,
      search,
      statusFilter,
      originFilter,
    ]);

  /* =======================================
     FACTURA SELECCIONADA
  ======================================= */

  const selectedInvoice =
    useMemo(
      () =>
        invoices.find(
          (
            invoice
          ) =>
            invoice.id ===
            selectedInvoiceId
        ) ||
        null,

      [
        invoices,
        selectedInvoiceId,
      ]
    );

  /* =======================================
     NOTAS DE CRÉDITO RELACIONADAS
  ======================================= */

  const linkedCreditNotes =
    useMemo(() => {
      if (
        !selectedInvoice
      ) {
        return [];
      }

      return documents.filter(
        (
          document
        ) =>
          document.tipo ===
            "Nota de Crédito" &&
          document.refModulo ===
            "Factura" &&
          document.refId ===
            selectedInvoice.id
      );
    }, [
      documents,
      selectedInvoice,
    ]);

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(() => {
      const issued =
        invoices.filter(
          (
            invoice
          ) =>
            invoice.estado ===
            "Emitida"
        );

      return {
        total:
          invoices.length,

        issued:
          issued.length,

        cancelled:
          invoices.filter(
            (
              invoice
            ) =>
              invoice.estado ===
                "Anulada" ||
              invoice.estado ===
                "Cancelada"
          ).length,

        amount:
          issued.reduce(
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

        creditNotes:
          documents.filter(
            (
              document
            ) =>
              document.tipo ===
              "Nota de Crédito"
          ).length,
      };
    }, [
      invoices,
      documents,
    ]);

  /* =======================================
     FILTROS
  ======================================= */

  const clearFilters =
    () => {
      setSearch("");

      setStatusFilter("");

      setOriginFilter("");
    };

  const hasFilters =
    Boolean(
      search ||
      statusFilter ||
      originFilter
    );

  /* =======================================
     ABRIR OPERACIÓN
  ======================================= */

  const openAnnul =
    (
      invoice
    ) => {
      setOperationReason(
        ""
      );

      setOperationModal({
        type:
          "annul",

        invoice,
      });
    };

  const openCancel =
    (
      invoice
    ) => {
      setOperationReason(
        ""
      );

      setOperationModal({
        type:
          "cancel",

        invoice,
      });
    };

  const closeOperation =
    () => {
      if (
        processing
      ) {
        return;
      }

      setOperationModal(
        null
      );

      setOperationReason(
        ""
      );
    };

  /* =======================================
     CONFIRMAR OPERACIÓN
  ======================================= */

  const confirmInvoiceOperation =
    async () => {
      const invoice =
        operationModal?.invoice;

      const type =
        operationModal?.type;

      if (
        !invoice ||
        !type
      ) {
        return;
      }

      try {
        setProcessing(
          true
        );

        /* =================================
           ANULAR
        ================================= */

        if (
          type ===
          "annul"
        ) {
          const result =
            await annulInvoice(
              invoice.id,
              operationReason,
              author
            );

          notify.success(
            "Factura anulada",

            result.balanceCredited
              ? `${result.creditNoteId} generada. ${formatMoney(
                  result.amount
                )} acreditados como saldo a favor.`
              : `${result.creditNoteId} generada. No había un cliente vinculado para acreditar saldo.`
          );
        }

        /* =================================
           CANCELAR
        ================================= */

        if (
          type ===
          "cancel"
        ) {
          await cancelInvoice(
            invoice.id,
            operationReason,
            author
          );

          notify.success(
            "Factura cancelada",
            `${invoice.id} fue cancelada sin movimiento de dinero.`
          );
        }

        setOperationModal(
          null
        );

        setOperationReason(
          ""
        );
      } catch (
        operationError
      ) {
        console.error(
          operationError
        );

        const code =
          operationError?.message;

        const messages = {
          INVOICE_ALREADY_CREDITED:
            "Esta factura ya tiene una Nota de Crédito asociada.",

          INVOICE_ALREADY_CLOSED:
            "La factura ya se encuentra cerrada.",

          INVOICE_NOT_PAID:
            "Esta factura no está pagada. En ese caso corresponde cancelarla.",

          INVOICE_IS_PAID:
            "Esta factura ya fue pagada. Debe anularse mediante Nota de Crédito.",

          INVOICE_NOT_ISSUED:
            "La factura ya no se encuentra en estado Emitida.",

          INVOICE_NOT_FOUND:
            "No encontramos la factura en Firestore.",

          INVOICE_INVALID_TYPE:
            "El documento seleccionado no es una factura.",

          INVOICE_ID_REQUIRED:
            "No se pudo determinar el número de factura.",
        };

        notify.error(
          "No se pudo completar",

          messages[code] ||
            code ||
            "Ocurrió un error al procesar el comprobante."
        );
      } finally {
        setProcessing(
          false
        );
      }
    };

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="invoices-page">

      {/* =================================
          HEADER
      ================================= */}

      <header className="invoices-header">

        <div className="invoices-header-left">

          <button
            type="button"

            className="invoices-back"

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

          <div className="invoices-header-icon">

            <ReceiptText
              size={20}
            />

          </div>

          <div>

            <span>
              Facturación
            </span>

            <h1>
              Facturas
            </h1>

          </div>

        </div>

        <div className="invoices-sync">

          <span />

          <div>

            <strong>
              Sincronizado
            </strong>

            <small>
              Firestore en tiempo real
            </small>

          </div>

        </div>

      </header>

      {/* =================================
          CONTENT
      ================================= */}

      <div className="invoices-content">

        {/* =================================
            INTRO
        ================================= */}

        <motion.section
          className="invoices-intro"

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

            <span className="invoices-kicker">
              Comprobantes internos
            </span>

            <h2>
              Facturas emitidas
            </h2>

            <p>
              Comprobantes generados desde Caja y operaciones
              registradas en el sistema.
            </p>

          </div>

          <div className="invoices-intro-note">

            <BadgeDollarSign
              size={18}
            />

            <div>

              <strong>
                Caja → Facturación
              </strong>

              <span>
                La factura nace después del cobro
              </span>

            </div>

          </div>

        </motion.section>

        {/* =================================
            MÉTRICAS
        ================================= */}

        <section className="invoices-stats">

          <article className="invoice-stat-card">

            <div>

              <span>
                Facturas
              </span>

              <FileText
                size={17}
              />

            </div>

            <strong>
              {metrics.total}
            </strong>

            <small>
              Comprobantes registrados
            </small>

          </article>

          <article className="invoice-stat-card stat-issued">

            <div>

              <span>
                Emitidas
              </span>

              <CheckCircle2
                size={17}
              />

            </div>

            <strong>
              {metrics.issued}
            </strong>

            <small>
              Actualmente vigentes
            </small>

          </article>

          <article className="invoice-stat-card stat-amount">

            <div>

              <span>
                Facturado
              </span>

              <CircleDollarSign
                size={17}
              />

            </div>

            <strong className="invoice-stat-money">
              {formatMoney(
                metrics.amount
              )}
            </strong>

            <small>
              Total de facturas emitidas
            </small>

          </article>

          <article className="invoice-stat-card stat-cancelled">

            <div>

              <span>
                Anuladas
              </span>

              <XCircle
                size={17}
              />

            </div>

            <strong>
              {metrics.cancelled}
            </strong>

            <small>
              Con operación posterior
            </small>

          </article>

          <article className="invoice-stat-card stat-credit">

            <div>

              <span>
                Notas crédito
              </span>

              <RotateCcw
                size={17}
              />

            </div>

            <strong>
              {metrics.creditNotes}
            </strong>

            <small>
              Documentos asociados
            </small>

          </article>

        </section>

        {/* =================================
            WORKSPACE
        ================================= */}

        <section className="invoices-workspace">

          {/* =================================
              TOOLBAR
          ================================= */}

          <div className="invoices-toolbar">

            <div className="invoices-search">

              <Search
                size={17}
              />

              <input
                type="search"

                placeholder="Buscar factura, cliente, ticket o medio de pago..."

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

                  aria-label="Limpiar búsqueda"
                >
                  <X
                    size={14}
                  />
                </button>

              )}

            </div>

            <div className="invoices-filters">

              <Filter
                size={15}
              />

              <select
                value={
                  statusFilter
                }

                onChange={(event) =>
                  setStatusFilter(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Todos los estados
                </option>

                <option value="Emitida">
                  Emitida
                </option>

                <option value="Anulada">
                  Anulada
                </option>

                <option value="Cancelada">
                  Cancelada
                </option>

                <option value="Rectificada">
                  Rectificada
                </option>

              </select>

              <select
                value={
                  originFilter
                }

                onChange={(event) =>
                  setOriginFilter(
                    event.target.value
                  )
                }
              >

                <option value="">
                  Todos los orígenes
                </option>

                <option value="Ticket">
                  Ticket
                </option>

                <option value="Venta">
                  Venta
                </option>

                <option value="Manual">
                  Manual
                </option>

              </select>

              {hasFilters && (

                <button
                  type="button"

                  className="invoices-clear"

                  onClick={
                    clearFilters
                  }
                >
                  Limpiar
                </button>

              )}

            </div>

          </div>

          {/* =================================
              LAYOUT
          ================================= */}

          <div className="invoices-layout">

            {/* =================================
                LISTA
            ================================= */}

            <section className="invoices-list-panel">

              <div className="invoices-list-title">

                <strong>
                  {filteredInvoices.length}
                </strong>

                <span>
                  {filteredInvoices.length ===
                  1
                    ? "factura"
                    : "facturas"}
                </span>

              </div>

              {/* LOADING */}

              {loading && (

                <div className="invoices-state">

                  <div className="invoices-loader" />

                  <strong>
                    Cargando facturas
                  </strong>

                  <span>
                    Sincronizando con Firestore...
                  </span>

                </div>

              )}

              {/* ERROR */}

              {!loading &&
                error && (

                <div className="invoices-state invoices-error">

                  <strong>
                    No se pudieron cargar
                  </strong>

                  <span>
                    Revisá conexión y permisos.
                  </span>

                </div>

              )}

              {/* VACÍO */}

              {!loading &&
                !error &&
                filteredInvoices.length ===
                  0 && (

                <div className="invoices-state">

                  <ReceiptText
                    size={28}
                  />

                  <strong>
                    No hay facturas
                  </strong>

                  <span>
                    No encontramos comprobantes con estos filtros.
                  </span>

                </div>

              )}

              {/* FILAS */}

              {!loading &&
                !error &&
                filteredInvoices.map(
                  (
                    invoice
                  ) => {
                    const status =
                      getInvoiceStatus(
                        invoice
                      );

                    const active =
                      selectedInvoiceId ===
                      invoice.id;

                    return (
                      <motion.button
                        type="button"

                        layout

                        key={
                          invoice.id
                        }

                        className={
                          `invoice-row ${
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

                        <div className="invoice-row-main">

                          <div className="invoice-row-top">

                            <strong>
                              {invoice.id}
                            </strong>

                            <span
                              className={
                                `invoice-status ${status.className}`
                              }
                            >
                              {
                                status.label
                              }
                            </span>

                          </div>

                          <h3>
                            {invoice.cliente ||
                              "Consumidor Final"}
                          </h3>

                          <div className="invoice-row-meta">

                            <span>
                              {invoice.refModulo ||
                                "Manual"}
                            </span>

                            {invoice.refId &&
                              invoice.refId !==
                                "—" && (

                                <>
                                  <i />

                                  <span>
                                    {
                                      invoice.refId
                                    }
                                  </span>
                                </>

                              )}

                          </div>

                        </div>

                        <div className="invoice-row-side">

                          <strong>
                            {formatMoney(
                              invoice.total
                            )}
                          </strong>

                          <span>
                            {formatDate(
                              invoice.fecha
                            )}
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

            <aside className="invoice-detail-panel">

              {!selectedInvoice ? (

                <div className="invoice-detail-empty">

                  <ReceiptText
                    size={30}
                  />

                  <strong>
                    Seleccioná una factura
                  </strong>

                  <span>
                    El detalle aparecerá acá.
                  </span>

                </div>

              ) : (

                <InvoiceDetail
                  invoice={
                    selectedInvoice
                  }

                  creditNotes={
                    linkedCreditNotes
                  }

                  onOpenTicket={(
                    ticketId
                  ) =>
                    navigate(
                      `/tickets/${ticketId}`
                    )
                  }

                  onAnnul={
                    openAnnul
                  }

                  onCancel={
                    openCancel
                  }
                />

              )}

            </aside>

          </div>

        </section>

      </div>

      {/* =================================
          MODAL OPERACIÓN
      ================================= */}

      {operationModal && (

        <div
          className="invoice-operation-overlay"

          onMouseDown={(event) => {
            if (
              event.target ===
                event.currentTarget &&
              !processing
            ) {
              closeOperation();
            }
          }}
        >

          <motion.div
            className="invoice-operation-modal"

            initial={{
              opacity: 0,
              scale: 0.96,
              y: 8,
            }}

            animate={{
              opacity: 1,
              scale: 1,
              y: 0,
            }}
          >

            {/* ICONO */}

            <div className="invoice-operation-icon">

              {operationModal.type ===
              "annul" ? (

                <RotateCcw
                  size={22}
                />

              ) : (

                <XCircle
                  size={22}
                />

              )}

            </div>

            {/* COPY */}

            <div className="invoice-operation-copy">

              <span>
                {
                  operationModal
                    .invoice.id
                }
              </span>

              <h3>
                {operationModal.type ===
                "annul"
                  ? "Anular factura"
                  : "Cancelar comprobante"}
              </h3>

              <p>
                {operationModal.type ===
                "annul"
                  ? "Se generará una Nota de Crédito por el total y, si existe un cliente asociado, el importe quedará como saldo a favor."
                  : "El comprobante se cancelará sin generar movimiento de dinero."}
              </p>

            </div>

            {/* TOTAL */}

            <div className="invoice-operation-summary">

              <span>
                Total
              </span>

              <strong>
                {formatMoney(
                  operationModal
                    .invoice.total
                )}
              </strong>

            </div>

            {/* MOTIVO */}

            <label className="invoice-operation-reason">

              <span>
                Motivo
              </span>

              <textarea
                rows={3}

                placeholder="Ej: devolución del equipo, error de carga, operación cancelada..."

                disabled={
                  processing
                }

                value={
                  operationReason
                }

                onChange={(event) =>
                  setOperationReason(
                    event.target.value
                  )
                }
              />

            </label>

            {/* BOTONES */}

            <div className="invoice-operation-buttons">

              <button
                type="button"

                disabled={
                  processing
                }

                onClick={
                  closeOperation
                }
              >
                Volver
              </button>

              <button
                type="button"

                className={
                  operationModal.type ===
                  "annul"
                    ? "danger"
                    : "warning"
                }

                disabled={
                  processing
                }

                onClick={
                  confirmInvoiceOperation
                }
              >

                {processing
                  ? "Procesando..."
                  : operationModal.type ===
                    "annul"
                    ? "Confirmar anulación"
                    : "Confirmar cancelación"}

              </button>

            </div>

          </motion.div>

        </div>

      )}

    </main>
  );
}

/* =========================================
   DETALLE FACTURA
========================================= */

function InvoiceDetail({
  invoice,
  creditNotes,
  onOpenTicket,
  onAnnul,
  onCancel,
}) {
  const status =
    getInvoiceStatus(
      invoice
    );

  const items =
    normalizeInvoiceItems(
      invoice
    );

  const history =
    Array.isArray(
      invoice.historial
    )
      ? [
          ...invoice.historial,
        ].reverse()
      : [];

  const isTicket =
    invoice.refModulo ===
      "Ticket" &&
    invoice.refId &&
    invoice.refId !==
      "—";

  const paid =
    isInvoicePaid(
      invoice
    );

  const canOperate =
    invoice.estado ===
    "Emitida";

  return (
    <div className="invoice-detail">

      {/* =================================
          HEADER
      ================================= */}

      <div className="invoice-detail-header">

        <div>

          <span>
            Factura
          </span>

          <h2>
            {invoice.id}
          </h2>

        </div>

        <span
          className={
            `invoice-status ${status.className}`
          }
        >
          {status.label}
        </span>

      </div>

      {/* =================================
          ACCIONES
      ================================= */}

      {canOperate && (

        <div className="invoice-detail-actions">

          {paid ? (

            <button
              type="button"

              className="invoice-annul-button"

              onClick={() =>
                onAnnul(
                  invoice
                )
              }
            >

              <RotateCcw
                size={16}
              />

              Anular y generar NC

            </button>

          ) : (

            <button
              type="button"

              className="invoice-cancel-button"

              onClick={() =>
                onCancel(
                  invoice
                )
              }
            >

              <XCircle
                size={16}
              />

              Cancelar comprobante

            </button>

          )}

        </div>

      )}

      {/* =================================
          CLIENTE
      ================================= */}

      <section className="invoice-detail-section">

        <span className="invoice-detail-label">
          Cliente
        </span>

        <div className="invoice-client">

          <div className="invoice-client-icon">

            <UserRound
              size={18}
            />

          </div>

          <div>

            <strong>
              {invoice.cliente ||
                "Consumidor Final"}
            </strong>

            <span>
              {invoice.doc ||
                "C.F."}
            </span>

          </div>

        </div>

      </section>

      {/* =================================
          DATOS
      ================================= */}

      <div className="invoice-detail-grid">

        <div>

          <CalendarDays
            size={15}
          />

          <span>
            Fecha
          </span>

          <strong>
            {formatDate(
              invoice.fecha
            )}
          </strong>

        </div>

        <div>

          <CreditCard
            size={15}
          />

          <span>
            Medio de pago
          </span>

          <strong>
            {invoice.refPago ||
              "—"}
          </strong>

        </div>

        <div>

          <CheckCircle2
            size={15}
          />

          <span>
            Estado pago
          </span>

          <strong>
            {invoice.estadoPago ||
              "—"}
          </strong>

        </div>

        <div>

          <BadgeDollarSign
            size={15}
          />

          <span>
            Origen
          </span>

          <strong>
            {invoice.refModulo ||
              "Manual"}
          </strong>

        </div>

      </div>

      {/* =================================
          TICKET
      ================================= */}

      {isTicket && (

        <button
          type="button"

          className="invoice-ticket-link"

          onClick={() =>
            onOpenTicket(
              invoice.refId
            )
          }
        >

          <Ticket
            size={17}
          />

          <div>

            <span>
              Ticket asociado
            </span>

            <strong>
              {invoice.refId}
            </strong>

          </div>

          <Link2
            size={16}
          />

        </button>

      )}

      {/* =================================
          ITEMS
      ================================= */}

      <section className="invoice-detail-section">

        <span className="invoice-detail-label">
          Conceptos
        </span>

        {items.length ===
        0 ? (

          <div className="invoice-no-items">

            Sin conceptos registrados.

          </div>

        ) : (

          <div className="invoice-items">

            {items.map(
              (
                item,
                index
              ) => (

                <div
                  className="invoice-item"

                  key={
                    `${item.description}-${index}`
                  }
                >

                  <div>

                    <strong>
                      {
                        item.description
                      }
                    </strong>

                    <span>
                      {item.quantity} ×{" "}
                      {formatMoney(
                        item.price
                      )}
                    </span>

                  </div>

                  <strong>
                    {formatMoney(
                      item.subtotal
                    )}
                  </strong>

                </div>

              )
            )}

          </div>

        )}

      </section>

      {/* =================================
          TOTAL
      ================================= */}

      <div className="invoice-total">

        <span>
          Total
        </span>

        <strong>
          {formatMoney(
            invoice.total
          )}
        </strong>

      </div>

      {/* =================================
          NOTAS DE CRÉDITO
      ================================= */}

      {creditNotes.length >
        0 && (

        <section className="invoice-detail-section">

          <span className="invoice-detail-label">
            Documentos asociados
          </span>

          <div className="invoice-credit-notes">

            {creditNotes.map(
              (
                note
              ) => (

                <article
                  key={
                    note.id
                  }
                >

                  <RotateCcw
                    size={16}
                  />

                  <div>

                    <strong>
                      {note.id}
                    </strong>

                    <span>
                      Nota de Crédito ·{" "}
                      {formatMoney(
                        note.total
                      )}
                    </span>

                  </div>

                  <span>
                    {note.estado ||
                      "Emitida"}
                  </span>

                </article>

              )
            )}

          </div>

        </section>

      )}

      {/* =================================
          AUDITORÍA
      ================================= */}

      <section className="invoice-detail-section">

        <span className="invoice-detail-label">
          Auditoría
        </span>

        <div className="invoice-audit">

          <UserRound
            size={16}
          />

          <div>

            <span>
              Emitida por
            </span>

            <strong>
              {invoice.usuario ||
                "Sistema"}
            </strong>

          </div>

        </div>

      </section>

      {/* =================================
          HISTORIAL
      ================================= */}

      <section className="invoice-detail-section">

        <span className="invoice-detail-label">
          Historial
        </span>

        {history.length ===
        0 ? (

          <div className="invoice-no-items">

            Sin actividad registrada.

          </div>

        ) : (

          <div className="invoice-history">

            {history
              .slice(
                0,
                10
              )
              .map(
                (
                  event,
                  index
                ) => (

                  <article
                    key={
                      `${event.fecha}-${index}`
                    }
                  >

                    <div className="invoice-history-dot" />

                    <div>

                      <div className="invoice-history-top">

                        <strong>
                          {event.accion ||
                            "Actividad"}
                        </strong>

                        <span>
                          {event.fecha ||
                            "—"}
                        </span>

                      </div>

                      {event.detalle && (

                        <p>
                          {event.detalle}
                        </p>

                      )}

                    </div>

                  </article>

                )
              )}

          </div>

        )}

      </section>

    </div>
  );
}