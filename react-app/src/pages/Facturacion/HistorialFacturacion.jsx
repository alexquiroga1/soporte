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
  ClipboardList,
  FilePenLine,
  FileText,
  History,
  ReceiptText,
  RotateCcw,
  Search,
  UserRound,
  X,
} from "lucide-react";

import {
  subscribeToInvoices,
} from "../../services/facturas.service.js";

import {
  subscribeToBudgets,
} from "../../services/presupuestos.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./HistorialFacturacion.css";

/* =========================================
   FECHAS
========================================= */

function parseEventDate(value) {
  if (!value) {
    return 0;
  }

  const text =
    String(value).trim();

  /*
   * ISO
   */

  const iso =
    new Date(text);

  if (
    !Number.isNaN(
      iso.getTime()
    )
  ) {
    return iso.getTime();
  }

  /*
   * DD/MM/YYYY HH:mm
   */

  const match =
    text.match(
      /^(\d{2})\/(\d{2})\/(\d{4})(?:[,\s]+(\d{1,2}):(\d{2}))?/
    );

  if (match) {
    const [
      ,
      day,
      month,
      year,
      hour = "0",
      minute = "0",
    ] = match;

    return new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute)
    ).getTime();
  }

  return 0;
}

/* =========================================
   ICONO / CLASE
========================================= */

function getEventStyle(event) {
  const action =
    String(
      event.accion ||
      ""
    ).toLowerCase();

  if (
    action.includes(
      "rectific"
    )
  ) {
    return {
      icon: FilePenLine,
      className: "audit-event-rectification",
    };
  }

  if (
    action.includes("anulad") ||
    action.includes("cancel")
  ) {
    return {
      icon: X,
      className: "audit-event-danger",
    };
  }

  if (
    action.includes("crédito") ||
    action.includes("credito")
  ) {
    return {
      icon: RotateCcw,
      className: "audit-event-credit",
    };
  }

  return {
    icon: History,
    className: "audit-event-default",
  };
}

/* =========================================
   COMPONENTE
========================================= */

export default function HistorialFacturacion() {
  const navigate =
    useNavigate();

  const [
    invoices,
    setInvoices,
  ] = useState([]);

  const [
    budgets,
    setBudgets,
  ] = useState([]);

  const [
    invoicesLoading,
    setInvoicesLoading,
  ] = useState(true);

  const [
    budgetsLoading,
    setBudgetsLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    sourceFilter,
    setSourceFilter,
  ] = useState("");

  /* =======================================
     FACTURAS
  ======================================= */

  useEffect(() => {
    const unsubscribe =
      subscribeToInvoices(
        (data) => {
          setInvoices(data);
          setInvoicesLoading(false);
        },

        (error) => {
          console.error(error);

          setInvoicesLoading(false);

          notify.error(
            "Error de auditoría",
            "No pudimos cargar los comprobantes."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  /* =======================================
     PRESUPUESTOS
  ======================================= */

  useEffect(() => {
    const unsubscribe =
      subscribeToBudgets(
        (data) => {
          setBudgets(data);
          setBudgetsLoading(false);
        },

        (error) => {
          console.error(error);

          setBudgetsLoading(false);

          notify.error(
            "Error de auditoría",
            "No pudimos cargar los presupuestos."
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, []);

  const loading =
    invoicesLoading ||
    budgetsLoading;

  /* =======================================
     ARMAR EVENTOS
  ======================================= */

  const events =
    useMemo(() => {
      const invoiceEvents =
        invoices.flatMap(
          (document) => {
            const history =
              Array.isArray(
                document.historial
              )
                ? document.historial
                : [];

            const type =
              document.tipo ===
                "Nota de Crédito"
                ? "Nota de Crédito"
                : "Factura";

            return history.map(
              (event, index) => ({
                id:
                  `${type}-${document.id}-${index}`,

                source: type,

                documentId:
                  document.id,

                cliente:
                  document.cliente ||
                  "Consumidor Final",

                fecha:
                  event.fecha ||
                  document.actualizadoEn ||
                  document.creadoEn ||
                  "",

                accion:
                  event.accion ||
                  "Actividad",

                detalle:
                  event.detalle ||
                  "",

                usuario:
                  event.autor ||
                  document.usuario ||
                  "Sistema",
              })
            );
          }
        );

      const budgetEvents =
        budgets.flatMap(
          (budget) => {
            const history =
              Array.isArray(
                budget.historial
              )
                ? budget.historial
                : [];

            return history.map(
              (event, index) => ({
                id:
                  `Presupuesto-${budget.id}-${index}`,

                source:
                  "Presupuesto",

                documentId:
                  budget.id,

                cliente:
                  budget.cliente ||
                  "Consumidor Final",

                fecha:
                  event.fecha ||
                  budget.actualizadoEn ||
                  budget.creadoEn ||
                  "",

                accion:
                  event.accion ||
                  "Actividad",

                detalle:
                  event.detalle ||
                  "",

                usuario:
                  event.autor ||
                  budget.usuario ||
                  "Sistema",
              })
            );
          }
        );

      return [
        ...invoiceEvents,
        ...budgetEvents,
      ].sort(
        (a, b) =>
          parseEventDate(
            b.fecha
          ) -
          parseEventDate(
            a.fecha
          )
      );
    }, [
      invoices,
      budgets,
    ]);

  /* =======================================
     FILTROS
  ======================================= */

  const filteredEvents =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return events.filter(
        (event) => {
          const source = [
            event.documentId,
            event.cliente,
            event.accion,
            event.detalle,
            event.usuario,
            event.source,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          const matchesSearch =
            !query ||
            source.includes(
              query
            );

          const matchesSource =
            !sourceFilter ||
            event.source ===
              sourceFilter;

          return (
            matchesSearch &&
            matchesSource
          );
        }
      );
    }, [
      events,
      search,
      sourceFilter,
    ]);

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics =
    useMemo(
      () => ({
        total:
          events.length,

        invoices:
          events.filter(
            (event) =>
              event.source ===
              "Factura"
          ).length,

        budgets:
          events.filter(
            (event) =>
              event.source ===
              "Presupuesto"
          ).length,

        creditNotes:
          events.filter(
            (event) =>
              event.source ===
              "Nota de Crédito"
          ).length,
      }),

      [events]
    );

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="billing-history-page">

      {/* HEADER */}

      <header className="billing-history-header">

        <div className="billing-history-header-left">

          <button
            type="button"
            onClick={() =>
              navigate(
                "/facturacion"
              )
            }
          >
            <ArrowLeft size={20} />
          </button>

          <div className="billing-history-logo">
            <History size={20} />
          </div>

          <div>
            <span>
              Facturación
            </span>

            <h1>
              Historial y auditoría
            </h1>
          </div>

        </div>

        <div className="billing-history-live">
          <span />
          Firestore en tiempo real
        </div>

      </header>

      <div className="billing-history-content">

        {/* INTRO */}

        <motion.section
          className="billing-history-intro"
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
        >
          <span>
            Trazabilidad
          </span>

          <h2>
            Registro central de operaciones
          </h2>

          <p>
            Actividad de presupuestos, facturas,
            Notas de Crédito, anulaciones y rectificaciones.
          </p>
        </motion.section>

        {/* STATS */}

        <section className="billing-history-stats">

          <article>
            <History size={17} />
            <span>Eventos</span>
            <strong>{metrics.total}</strong>
          </article>

          <article>
            <ReceiptText size={17} />
            <span>Facturas</span>
            <strong>{metrics.invoices}</strong>
          </article>

          <article>
            <ClipboardList size={17} />
            <span>Presupuestos</span>
            <strong>{metrics.budgets}</strong>
          </article>

          <article>
            <RotateCcw size={17} />
            <span>Notas de crédito</span>
            <strong>{metrics.creditNotes}</strong>
          </article>

        </section>

        {/* TOOLBAR */}

        <section className="billing-history-workspace">

          <div className="billing-history-toolbar">

            <div className="billing-history-search">

              <Search size={17} />

              <input
                type="search"
                placeholder="Buscar documento, cliente, usuario o acción..."
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

            <select
              value={sourceFilter}
              onChange={(event) =>
                setSourceFilter(
                  event.target.value
                )
              }
            >
              <option value="">
                Todos los módulos
              </option>

              <option value="Factura">
                Facturas
              </option>

              <option value="Presupuesto">
                Presupuestos
              </option>

              <option value="Nota de Crédito">
                Notas de crédito
              </option>
            </select>

          </div>

          {/* LIST */}

          <div className="billing-history-list">

            {loading && (
              <div className="billing-history-state">
                <div className="billing-history-loader" />

                <strong>
                  Cargando auditoría
                </strong>
              </div>
            )}

            {!loading &&
              filteredEvents.length ===
                0 && (
              <div className="billing-history-state">
                <History size={30} />

                <strong>
                  No hay eventos
                </strong>

                <span>
                  No encontramos actividad con estos filtros.
                </span>
              </div>
            )}

            {!loading &&
              filteredEvents.map(
                (event) => {
                  const style =
                    getEventStyle(
                      event
                    );

                  const Icon =
                    style.icon;

                  return (
                    <motion.article
                      layout
                      key={event.id}
                      className={
                        `billing-history-event ${style.className}`
                      }
                    >
                      <div className="billing-history-event-icon">
                        <Icon size={17} />
                      </div>

                      <div className="billing-history-event-main">

                        <div className="billing-history-event-top">

                          <div>
                            <span>
                              {event.source}
                            </span>

                            <strong>
                              {event.documentId}
                            </strong>
                          </div>

                          <time>
                            {event.fecha ||
                              "—"}
                          </time>

                        </div>

                        <h3>
                          {event.accion}
                        </h3>

                        {event.detalle && (
                          <p>
                            {event.detalle}
                          </p>
                        )}

                        <footer>
                          <span>
                            <UserRound size={13} />
                            {event.usuario}
                          </span>

                          <span>
                            <FileText size={13} />
                            {event.cliente}
                          </span>
                        </footer>

                      </div>

                    </motion.article>
                  );
                }
              )}

          </div>

        </section>

      </div>

    </main>
  );
}