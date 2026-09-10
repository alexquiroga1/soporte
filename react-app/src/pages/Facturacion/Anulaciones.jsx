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
  Ban,
  CalendarDays,
  ChevronRight,
  CircleDollarSign,
  FileText,
  Link2,
  ReceiptText,
  RotateCcw,
  Search,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

import {
  subscribeToInvoices,
} from "../../services/facturas.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Anulaciones.css";

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }
  ).format(
    Number(value || 0)
  );
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const parts =
    String(value).split("-");

  if (parts.length === 3) {
    const [
      year,
      month,
      day,
    ] = parts;

    return `${day}/${month}/${year}`;
  }

  return value;
}

function isClosedInvoice(invoice) {
  return (
    invoice?.estado === "Anulada" ||
    invoice?.estado === "Cancelada"
  );
}

function getStatusData(invoice) {
  if (
    invoice?.estado === "Anulada"
  ) {
    return {
      label: "Anulada",
      className: "annulment-status-annulled",
    };
  }

  return {
    label: "Cancelada",
    className: "annulment-status-cancelled",
  };
}

/* =========================================
   COMPONENTE
========================================= */

export default function Anulaciones() {
  const navigate =
    useNavigate();

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
    selectedId,
    setSelectedId,
  ] = useState(null);

  /* =======================================
     FIREBASE
  ======================================= */

  useEffect(() => {
    setLoading(true);

    const unsubscribe =
      subscribeToInvoices(
        (data) => {
          setDocuments(data);

          setLoading(false);

          setError(null);
        },

        (firebaseError) => {
          console.error(
            firebaseError
          );

          setError(
            firebaseError
          );

          setLoading(false);

          notify.error(
            "No pudimos cargar anulaciones",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     FACTURAS CERRADAS
  ======================================= */

  const closedInvoices =
    useMemo(
      () =>
        documents.filter(
          (document) =>
            (
              !document.tipo ||
              document.tipo === "Factura"
            ) &&
            isClosedInvoice(document)
        ),

      [documents]
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
        return closedInvoices;
      }

      return closedInvoices.filter(
        (invoice) => {
          const source = [
            invoice.id,
            invoice.cliente,
            invoice.doc,
            invoice.refId,
            invoice.estado,
            invoice.refPago,
            invoice.notaCreditoId,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return source.includes(
            query
          );
        }
      );
    }, [
      closedInvoices,
      search,
    ]);

  /* =======================================
     SELECCIÓN
  ======================================= */

  useEffect(() => {
    if (
      selectedId &&
      closedInvoices.some(
        (invoice) =>
          invoice.id ===
          selectedId
      )
    ) {
      return;
    }

    setSelectedId(
      closedInvoices[0]?.id ||
      null
    );
  }, [
    closedInvoices,
    selectedId,
  ]);

  const selectedInvoice =
    useMemo(
      () =>
        closedInvoices.find(
          (invoice) =>
            invoice.id ===
            selectedId
        ) ||
        null,

      [
        closedInvoices,
        selectedId,
      ]
    );

  /* =======================================
     NC ASOCIADAS
  ======================================= */

  const linkedCreditNotes =
    useMemo(() => {
      if (!selectedInvoice) {
        return [];
      }

      return documents.filter(
        (document) =>
          document.tipo ===
            "Nota de Crédito" &&
          (
            document.refId ===
              selectedInvoice.id ||
            document.facturaOrigenId ===
              selectedInvoice.id
          )
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
      const annulled =
        closedInvoices.filter(
          (invoice) =>
            invoice.estado ===
            "Anulada"
        );

      const cancelled =
        closedInvoices.filter(
          (invoice) =>
            invoice.estado ===
            "Cancelada"
        );

      return {
        total:
          closedInvoices.length,

        annulled:
          annulled.length,

        cancelled:
          cancelled.length,

        amount:
          annulled.reduce(
            (total, invoice) =>
              total +
              Number(
                invoice.total ||
                0
              ),

            0
          ),
      };
    }, [
      closedInvoices,
    ]);

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="annulments-page">

      {/* HEADER */}

      <header className="annulments-header">

        <div className="annulments-header-left">

          <button
            type="button"
            className="annulments-back"
            onClick={() =>
              navigate(
                "/facturacion"
              )
            }
          >
            <ArrowLeft size={20} />
          </button>

          <div className="annulments-header-icon">
            <Ban size={20} />
          </div>

          <div>
            <span>Facturación</span>
            <h1>Anulaciones</h1>
          </div>

        </div>

        <div className="annulments-sync">
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

      <div className="annulments-content">

        {/* INTRO */}

        <motion.section
          className="annulments-intro"
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
            <span className="annulments-kicker">
              Control documental
            </span>

            <h2>
              Comprobantes cerrados
            </h2>

            <p>
              Consulta de facturas anuladas o canceladas
              manteniendo su trazabilidad original.
            </p>
          </div>

          <div className="annulments-info">
            <FileText size={18} />

            <div>
              <strong>
                Sin eliminación
              </strong>

              <span>
                Los documentos permanecen auditables
              </span>
            </div>
          </div>

        </motion.section>

        {/* MÉTRICAS */}

        <section className="annulments-stats">

          <article>
            <span>
              Operaciones cerradas
            </span>

            <strong>
              {metrics.total}
            </strong>

            <small>
              Total histórico
            </small>
          </article>

          <article className="annulled">
            <span>
              Anuladas
            </span>

            <strong>
              {metrics.annulled}
            </strong>

            <small>
              Con devolución económica
            </small>
          </article>

          <article className="cancelled">
            <span>
              Canceladas
            </span>

            <strong>
              {metrics.cancelled}
            </strong>

            <small>
              Sin movimiento económico
            </small>
          </article>

          <article className="amount">
            <span>
              Importe anulado
            </span>

            <strong className="annulments-money">
              {formatMoney(
                metrics.amount
              )}
            </strong>

            <small>
              Asociado a anulaciones
            </small>
          </article>

        </section>

        {/* WORKSPACE */}

        <section className="annulments-workspace">

          <div className="annulments-toolbar">

            <div className="annulments-search">

              <Search size={17} />

              <input
                type="search"
                placeholder="Buscar factura, cliente, ticket o NC..."
                value={search}
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
                  <X size={14} />
                </button>
              )}

            </div>

            <span className="annulments-results">
              {filteredInvoices.length} comprobantes
            </span>

          </div>

          <div className="annulments-layout">

            {/* LISTA */}

            <section className="annulments-list">

              {loading && (
                <div className="annulments-state">
                  <div className="annulments-loader" />

                  <strong>
                    Cargando operaciones
                  </strong>

                  <span>
                    Sincronizando con Firestore...
                  </span>
                </div>
              )}

              {!loading &&
                error && (
                <div className="annulments-state">
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
                <div className="annulments-state">
                  <Ban size={29} />

                  <strong>
                    No hay operaciones cerradas
                  </strong>

                  <span>
                    Las anulaciones y cancelaciones aparecerán acá.
                  </span>
                </div>
              )}

              {!loading &&
                !error &&
                filteredInvoices.map(
                  (invoice) => {
                    const status =
                      getStatusData(
                        invoice
                      );

                    const active =
                      invoice.id ===
                      selectedId;

                    return (
                      <motion.button
                        type="button"
                        layout
                        key={invoice.id}
                        className={
                          `annulment-row ${
                            active
                              ? "active"
                              : ""
                          }`
                        }
                        onClick={() =>
                          setSelectedId(
                            invoice.id
                          )
                        }
                      >
                        <div>

                          <div className="annulment-row-top">
                            <strong>
                              {invoice.id}
                            </strong>

                            <span
                              className={
                                status.className
                              }
                            >
                              {status.label}
                            </span>
                          </div>

                          <h3>
                            {invoice.cliente ||
                              "Consumidor Final"}
                          </h3>

                          <small>
                            {invoice.refModulo ||
                              "Manual"}

                            {invoice.refId &&
                              ` · ${invoice.refId}`}
                          </small>

                        </div>

                        <div className="annulment-row-total">
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

            {/* DETALLE */}

            <aside className="annulments-detail">

              {!selectedInvoice ? (
                <div className="annulments-detail-empty">
                  <Ban size={30} />

                  <strong>
                    Seleccioná un comprobante
                  </strong>

                  <span>
                    El detalle aparecerá acá.
                  </span>
                </div>
              ) : (
                <AnnulmentDetail
                  invoice={
                    selectedInvoice
                  }
                  creditNotes={
                    linkedCreditNotes
                  }
                  onInvoices={() =>
                    navigate(
                      "/facturacion/facturas"
                    )
                  }
                />
              )}

            </aside>

          </div>

        </section>

      </div>

    </main>
  );
}

/* =========================================
   DETALLE
========================================= */

function AnnulmentDetail({
  invoice,
  creditNotes,
  onInvoices,
}) {
  const status =
    getStatusData(
      invoice
    );

  const history =
    Array.isArray(
      invoice.historial
    )
      ? [...invoice.historial]
          .reverse()
      : [];

  return (
    <div className="annulment-detail">

      <div className="annulment-detail-header">

        <div>
          <span>Factura</span>
          <h2>{invoice.id}</h2>
        </div>

        <span
          className={
            `annulment-detail-status ${status.className}`
          }
        >
          {status.label}
        </span>

      </div>

      <section className="annulment-section">

        <span className="annulment-label">
          Cliente
        </span>

        <div className="annulment-client">

          <UserRound size={18} />

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

      <div className="annulment-summary">

        <div>
          <CalendarDays size={15} />

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
          <CircleDollarSign size={15} />

          <span>
            Total
          </span>

          <strong>
            {formatMoney(
              invoice.total
            )}
          </strong>
        </div>

        <div>
          <ReceiptText size={15} />

          <span>
            Estado
          </span>

          <strong>
            {invoice.estado}
          </strong>
        </div>

      </div>

      {creditNotes.length > 0 && (
        <section className="annulment-section">

          <span className="annulment-label">
            Nota de Crédito
          </span>

          {creditNotes.map(
            (note) => (
              <div
                className="annulment-credit-note"
                key={note.id}
              >
                <RotateCcw size={17} />

                <div>
                  <strong>
                    {note.id}
                  </strong>

                  <span>
                    {formatMoney(
                      note.total
                    )}
                  </span>
                </div>

                <Link2 size={16} />
              </div>
            )
          )}

        </section>
      )}

      <button
        type="button"
        className="annulment-open-invoice"
        onClick={onInvoices}
      >
        <ReceiptText size={16} />
        Ver en Facturas
      </button>

      <section className="annulment-section">

        <span className="annulment-label">
          Historial
        </span>

        <div className="annulment-history">

          {history.map(
            (event, index) => (
              <article
                key={
                  `${event.fecha}-${index}`
                }
              >
                <div />

                <section>
                  <header>
                    <strong>
                      {event.accion ||
                        "Actividad"}
                    </strong>

                    <span>
                      {event.fecha ||
                        "—"}
                    </span>
                  </header>

                  {event.detalle && (
                    <p>
                      {event.detalle}
                    </p>
                  )}
                </section>

              </article>
            )
          )}

        </div>

      </section>

    </div>
  );
}