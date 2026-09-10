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
  CircleDollarSign,
  FileText,
  Link2,
  ReceiptText,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  normalizeInvoiceItems,
  subscribeToInvoices,
} from "../../services/facturas.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./NotasCredito.css";

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

function isCurrentMonth(
  value
) {
  if (!value) {
    return false;
  }

  const date =
    new Date(
      `${value}T12:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return false;
  }

  const now =
    new Date();

  return (
    date.getMonth() ===
      now.getMonth() &&
    date.getFullYear() ===
      now.getFullYear()
  );
}

/* =========================================
   COMPONENTE
========================================= */

export default function NotasCredito() {
  const navigate =
    useNavigate();

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
    selectedId,
    setSelectedId,
  ] = useState(null);

  /* =======================================
     BÚSQUEDA
  ======================================= */

  const [
    search,
    setSearch,
  ] = useState("");

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

          setLoading(
            false
          );

          setError(
            null
          );

          const notes =
            data.filter(
              (
                document
              ) =>
                document.tipo ===
                "Nota de Crédito"
            );

          setSelectedId(
            (
              current
            ) => {
              if (
                current &&
                notes.some(
                  (
                    note
                  ) =>
                    note.id ===
                    current
                )
              ) {
                return current;
              }

              return (
                notes[0]?.id ||
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
            "No pudimos cargar las Notas de Crédito",
            "Revisá la conexión o los permisos de Firestore."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     NOTAS
  ======================================= */

  const creditNotes =
    useMemo(
      () =>
        documents.filter(
          (
            document
          ) =>
            document.tipo ===
            "Nota de Crédito"
        ),

      [
        documents,
      ]
    );

  /* =======================================
     FILTRADAS
  ======================================= */

  const filteredNotes =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (
        !query
      ) {
        return creditNotes;
      }

      return creditNotes.filter(
        (
          note
        ) => {
          const source = [
            note.id,
            note.cliente,
            note.doc,
            note.refId,
            note.refPago,
            note.estado,
            note.motivo,
            note.usuario,
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
      creditNotes,
      search,
    ]);

  /* =======================================
     SELECCIONADA
  ======================================= */

  const selectedNote =
    useMemo(
      () =>
        creditNotes.find(
          (
            note
          ) =>
            note.id ===
            selectedId
        ) ||
        null,

      [
        creditNotes,
        selectedId,
      ]
    );

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(() => {
      const totalAmount =
        creditNotes.reduce(
          (
            total,
            note
          ) =>
            total +
            Number(
              note.total ||
              0
            ),

          0
        );

      const currentMonth =
        creditNotes.filter(
          (
            note
          ) =>
            isCurrentMonth(
              note.fecha
            )
        );

      return {
        total:
          creditNotes.length,

        amount:
          totalAmount,

        month:
          currentMonth.length,

        monthAmount:
          currentMonth.reduce(
            (
              total,
              note
            ) =>
              total +
              Number(
                note.total ||
                0
              ),

            0
          ),

        linked:
          creditNotes.filter(
            (
              note
            ) =>
              Boolean(
                note.refId
              )
          ).length,
      };
    }, [
      creditNotes,
    ]);

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="credit-notes-page">

      {/* =================================
          HEADER
      ================================= */}

      <header className="credit-notes-header">

        <div className="credit-notes-header-left">

          <button
            type="button"

            className="credit-notes-back"

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

          <div className="credit-notes-header-icon">

            <RotateCcw
              size={20}
            />

          </div>

          <div>

            <span>
              Facturación
            </span>

            <h1>
              Notas de Crédito
            </h1>

          </div>

        </div>

        <div className="credit-notes-sync">

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

      <div className="credit-notes-content">

        {/* =================================
            INTRO
        ================================= */}

        <motion.section
          className="credit-notes-intro"

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

            <span className="credit-notes-kicker">
              Correcciones económicas
            </span>

            <h2>
              Notas de Crédito emitidas
            </h2>

            <p>
              Documentos generados sobre facturas anuladas,
              devoluciones y ajustes económicos.
            </p>

          </div>

          <div className="credit-notes-info">

            <CheckCircle2
              size={18}
            />

            <div>

              <strong>
                Trazabilidad activa
              </strong>

              <span>
                Cada nota mantiene referencia a su comprobante original
              </span>

            </div>

          </div>

        </motion.section>

        {/* =================================
            MÉTRICAS
        ================================= */}

        <section className="credit-notes-stats">

          <article className="credit-note-stat">

            <div>

              <span>
                Total
              </span>

              <RotateCcw
                size={17}
              />

            </div>

            <strong>
              {metrics.total}
            </strong>

            <small>
              Notas registradas
            </small>

          </article>

          <article className="credit-note-stat accent-purple">

            <div>

              <span>
                Importe acreditado
              </span>

              <CircleDollarSign
                size={17}
              />

            </div>

            <strong className="credit-note-stat-money">
              {formatMoney(
                metrics.amount
              )}
            </strong>

            <small>
              Acumulado histórico
            </small>

          </article>

          <article className="credit-note-stat accent-month">

            <div>

              <span>
                Este mes
              </span>

              <CalendarDays
                size={17}
              />

            </div>

            <strong>
              {metrics.month}
            </strong>

            <small>
              {formatMoney(
                metrics.monthAmount
              )}
            </small>

          </article>

          <article className="credit-note-stat accent-linked">

            <div>

              <span>
                Vinculadas
              </span>

              <Link2
                size={17}
              />

            </div>

            <strong>
              {metrics.linked}
            </strong>

            <small>
              Con factura de origen
            </small>

          </article>

        </section>

        {/* =================================
            WORKSPACE
        ================================= */}

        <section className="credit-notes-workspace">

          {/* =================================
              TOOLBAR
          ================================= */}

          <div className="credit-notes-toolbar">

            <div className="credit-notes-search">

              <Search
                size={17}
              />

              <input
                type="search"

                placeholder="Buscar nota, factura, cliente o motivo..."

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

            <div className="credit-notes-results">

              <strong>
                {filteredNotes.length}
              </strong>

              <span>
                resultados
              </span>

            </div>

          </div>

          {/* =================================
              LAYOUT
          ================================= */}

          <div className="credit-notes-layout">

            {/* =================================
                LISTADO
            ================================= */}

            <section className="credit-notes-list">

              {loading && (

                <div className="credit-notes-state">

                  <div className="credit-notes-loader" />

                  <strong>
                    Cargando Notas de Crédito
                  </strong>

                  <span>
                    Sincronizando con Firestore...
                  </span>

                </div>

              )}

              {!loading &&
                error && (

                <div className="credit-notes-state">

                  <strong>
                    No se pudieron cargar
                  </strong>

                  <span>
                    Revisá conexión y permisos.
                  </span>

                </div>

              )}

              {!loading &&
                !error &&
                filteredNotes.length ===
                  0 && (

                <div className="credit-notes-state">

                  <RotateCcw
                    size={29}
                  />

                  <strong>
                    No hay Notas de Crédito
                  </strong>

                  <span>
                    Todavía no existen documentos para mostrar.
                  </span>

                </div>

              )}

              {!loading &&
                !error &&
                filteredNotes.map(
                  (
                    note
                  ) => {
                    const active =
                      selectedId ===
                      note.id;

                    return (
                      <motion.button
                        type="button"

                        layout

                        key={
                          note.id
                        }

                        className={
                          `credit-note-row ${
                            active
                              ? "active"
                              : ""
                          }`
                        }

                        onClick={() =>
                          setSelectedId(
                            note.id
                          )
                        }
                      >

                        <div className="credit-note-row-main">

                          <div className="credit-note-row-top">

                            <strong>
                              {note.id}
                            </strong>

                            <span>
                              {note.estado ||
                                "Emitida"}
                            </span>

                          </div>

                          <h3>
                            {note.cliente ||
                              "Consumidor Final"}
                          </h3>

                          <div className="credit-note-row-meta">

                            <span>
                              Factura
                            </span>

                            <strong>
                              {note.refId ||
                                "—"}
                            </strong>

                          </div>

                        </div>

                        <div className="credit-note-row-side">

                          <strong>
                            {formatMoney(
                              note.total
                            )}
                          </strong>

                          <span>
                            {formatDate(
                              note.fecha
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

            <aside className="credit-note-detail-panel">

              {!selectedNote ? (

                <div className="credit-note-empty">

                  <RotateCcw
                    size={30}
                  />

                  <strong>
                    Seleccioná una Nota de Crédito
                  </strong>

                  <span>
                    El detalle aparecerá acá.
                  </span>

                </div>

              ) : (

                <CreditNoteDetail
                  note={
                    selectedNote
                  }

                  onOpenInvoices={() =>
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

function CreditNoteDetail({
  note,
  onOpenInvoices,
}) {
  const items =
    normalizeInvoiceItems(
      note
    );

  const history =
    Array.isArray(
      note.historial
    )
      ? [
          ...note.historial,
        ].reverse()
      : [];

  return (
    <div className="credit-note-detail">

      {/* HEADER */}

      <div className="credit-note-detail-header">

        <div>

          <span>
            Nota de Crédito
          </span>

          <h2>
            {note.id}
          </h2>

        </div>

        <span className="credit-note-status">
          {note.estado ||
            "Emitida"}
        </span>

      </div>

      {/* CLIENTE */}

      <section className="credit-note-section">

        <span className="credit-note-label">
          Cliente
        </span>

        <div className="credit-note-client">

          <div>

            <UserRound
              size={18}
            />

          </div>

          <section>

            <strong>
              {note.cliente ||
                "Consumidor Final"}
            </strong>

            <span>
              {note.doc ||
                "C.F."}
            </span>

          </section>

        </div>

      </section>

      {/* DATOS */}

      <div className="credit-note-detail-grid">

        <div>

          <CalendarDays
            size={15}
          />

          <span>
            Fecha
          </span>

          <strong>
            {formatDate(
              note.fecha
            )}
          </strong>

        </div>

        <div>

          <ReceiptText
            size={15}
          />

          <span>
            Factura origen
          </span>

          <strong>
            {note.refId ||
              "—"}
          </strong>

        </div>

        <div>

          <CheckCircle2
            size={15}
          />

          <span>
            Aplicación
          </span>

          <strong>
            {note.estadoPago ||
              "Aplicada"}
          </strong>

        </div>

        <div>

          <UserRound
            size={15}
          />

          <span>
            Usuario
          </span>

          <strong>
            {note.usuario ||
              "Sistema"}
          </strong>

        </div>

      </div>

      {/* FACTURA ORIGINAL */}

      {note.refId && (

        <button
          type="button"

          className="credit-note-original"

          onClick={
            onOpenInvoices
          }
        >

          <FileText
            size={17}
          />

          <div>

            <span>
              Comprobante original
            </span>

            <strong>
              {note.refId}
            </strong>

          </div>

          <Link2
            size={16}
          />

        </button>

      )}

      {/* MOTIVO */}

      <section className="credit-note-section">

        <span className="credit-note-label">
          Motivo
        </span>

        <div className="credit-note-reason">

          {note.motivo ||
            "Sin motivo específico registrado."}

        </div>

      </section>

      {/* ITEMS */}

      <section className="credit-note-section">

        <span className="credit-note-label">
          Conceptos acreditados
        </span>

        {items.length ===
        0 ? (

          <div className="credit-note-no-items">

            Sin conceptos registrados.

          </div>

        ) : (

          <div className="credit-note-items">

            {items.map(
              (
                item,
                index
              ) => (

                <div
                  className="credit-note-item"

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

      {/* TOTAL */}

      <div className="credit-note-total">

        <span>
          Total acreditado
        </span>

        <strong>
          {formatMoney(
            note.total
          )}
        </strong>

      </div>

      {/* HISTORIAL */}

      <section className="credit-note-section">

        <span className="credit-note-label">
          Historial
        </span>

        {history.length ===
        0 ? (

          <div className="credit-note-no-items">

            Sin actividad registrada.

          </div>

        ) : (

          <div className="credit-note-history">

            {history.map(
              (
                event,
                index
              ) => (

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

        )}

      </section>

    </div>
  );
}