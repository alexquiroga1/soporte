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
  AlertTriangle,
  ArrowLeft,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  Printer,
  ReceiptText,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Wrench,
} from "lucide-react";

import {
  buildReportData,
  subscribeToReports,
} from "../../services/reportes.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Reportes.css";

const PERIODS = [
  {
    id: "month",
    label: "Mes actual",
  },
  {
    id: "30d",
    label: "30 días",
  },
  {
    id: "90d",
    label: "90 días",
  },
  {
    id: "year",
    label: "Año actual",
  },
  {
    id: "all",
    label: "Todo",
  },
];

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
  if (
    !value
  ) {
    return "—";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(
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
    return String(
      value
    );
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",
    }
  ).format(
    date
  );
}

function EmptyTable({
  colSpan,
  message,
}) {
  return (
    <tr>
      <td
        colSpan={
          colSpan
        }
      >
        <div className="reports-table-empty">
          {
            message
          }
        </div>
      </td>
    </tr>
  );
}

export default function Reportes() {
  const navigate =
    useNavigate();

  const [
    sourceData,
    setSourceData,
  ] =
    useState({
      credits: [],
      clients: [],
      invoices: [],
      sales: [],
      tickets: [],
      cashCuts: [],
      currentCash: null,
    });

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    period,
    setPeriod,
  ] =
    useState(
      "month"
    );

  /* =======================================
     FIRESTORE
  ======================================= */

  useEffect(
    () => {
      const unsubscribe =
        subscribeToReports(
          (
            data
          ) => {
            setSourceData(
              data
            );

            setLoading(
              false
            );
          },

          (
            error
          ) => {
            console.error(
              error
            );

            setLoading(
              false
            );

            notify.error(
              "Reportes",
              "No se pudieron cargar todos los datos financieros."
            );
          }
        );

      return unsubscribe;
    },
    []
  );

  /* =======================================
     REPORTE
  ======================================= */

  const report =
    useMemo(
      () =>
        buildReportData(
          sourceData,
          period
        ),
      [
        sourceData,
        period,
      ]
    );

  const {
    metrics,
  } =
    report;

  const riskPercent =
    metrics.activePortfolio >
    0
      ? (
          metrics.overduePortfolio /
          metrics.activePortfolio
        ) *
        100
      : 0;

  /* =========================================
     RENDER
  ========================================= */

  return (
    <main className="reports-page">
      <div className="reports-shell">

        <header className="reports-header">
          <div>
            <button
              type="button"
              className="reports-back"
              onClick={() =>
                navigate(
                  "/dashboard"
                )
              }
            >
              <ArrowLeft
                size={17}
              />
              Dashboard
            </button>

            <span className="reports-eyebrow">
              Analítica / Finanzas
            </span>

            <h1>
              Reportes
            </h1>

            <p>
              Cobranzas, créditos, morosidad y resultados del negocio.
            </p>
          </div>

          <div className="reports-header-actions">
            <label className="reports-period">
              <CalendarRange
                size={16}
              />

              <select
                value={
                  period
                }
                onChange={(
                  event
                ) =>
                  setPeriod(
                    event.target.value
                  )
                }
              >
                {PERIODS.map(
                  (
                    item
                  ) => (
                    <option
                      key={
                        item.id
                      }
                      value={
                        item.id
                      }
                    >
                      {
                        item.label
                      }
                    </option>
                  )
                )}
              </select>
            </label>

            <button
              type="button"
              className="reports-print"
              onClick={() =>
                window.print()
              }
            >
              <Printer
                size={17}
              />
              Imprimir
            </button>
          </div>
        </header>

        <div className="reports-period-label">
          <CalendarRange
            size={15}
          />
          {
            report.period
              .label
          }
        </div>

        {loading ? (
          <div className="reports-loading">
            Cargando información financiera...
          </div>
        ) : (
          <>
            <section className="reports-kpis">
              <motion.article
                initial={{
                  opacity:
                    0,

                  y:
                    8,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
              >
                <div className="reports-kpi-icon income">
                  <TrendingUp
                    size={19}
                  />
                </div>

                <span>
                  Ingresos de caja
                </span>

                <strong>
                  {formatMoney(
                    metrics.cashIncome
                  )}
                </strong>

                <small>
                  Movimientos de ingreso
                </small>
              </motion.article>

              <motion.article
                initial={{
                  opacity:
                    0,

                  y:
                    8,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
                transition={{
                  delay:
                    0.03,
                }}
              >
                <div className="reports-kpi-icon expense">
                  <TrendingDown
                    size={19}
                  />
                </div>

                <span>
                  Egresos de caja
                </span>

                <strong>
                  {formatMoney(
                    metrics.cashExpenses
                  )}
                </strong>

                <small>
                  Gastos registrados
                </small>
              </motion.article>

              <motion.article
                initial={{
                  opacity:
                    0,

                  y:
                    8,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
                transition={{
                  delay:
                    0.06,
                }}
              >
                <div className="reports-kpi-icon net">
                  <ChartNoAxesCombined
                    size={19}
                  />
                </div>

                <span>
                  Resultado de caja
                </span>

                <strong
                  className={
                    metrics.netCash <
                    0
                      ? "negative"
                      : ""
                  }
                >
                  {formatMoney(
                    metrics.netCash
                  )}
                </strong>

                <small>
                  Ingresos menos egresos
                </small>
              </motion.article>

              <motion.article
                initial={{
                  opacity:
                    0,

                  y:
                    8,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
                transition={{
                  delay:
                    0.09,
                }}
              >
                <div className="reports-kpi-icon billed">
                  <ReceiptText
                    size={19}
                  />
                </div>

                <span>
                  Facturado
                </span>

                <strong>
                  {formatMoney(
                    metrics.invoiced
                  )}
                </strong>

                <small>
                  {
                    metrics.invoicesCount
                  } comprobantes
                </small>
              </motion.article>

              <motion.article
                initial={{
                  opacity:
                    0,

                  y:
                    8,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
                transition={{
                  delay:
                    0.12,
                }}
              >
                <div className="reports-kpi-icon portfolio">
                  <WalletCards
                    size={19}
                  />
                </div>

                <span>
                  Cartera activa
                </span>

                <strong>
                  {formatMoney(
                    metrics.activePortfolio
                  )}
                </strong>

                <small>
                  Saldo pendiente total
                </small>
              </motion.article>

              <motion.article
                className={
                  metrics.overduePortfolio >
                  0
                    ? "risk"
                    : ""
                }
                initial={{
                  opacity:
                    0,

                  y:
                    8,
                }}
                animate={{
                  opacity:
                    1,

                  y:
                    0,
                }}
                transition={{
                  delay:
                    0.15,
                }}
              >
                <div className="reports-kpi-icon overdue">
                  <AlertTriangle
                    size={19}
                  />
                </div>

                <span>
                  Cartera en mora
                </span>

                <strong>
                  {formatMoney(
                    metrics.overduePortfolio
                  )}
                </strong>

                <small>
                  {riskPercent.toFixed(
                    1
                  )}
                  % de la cartera
                </small>
              </motion.article>
            </section>

            <section className="reports-secondary">
              <article>
                <CreditCard
                  size={18}
                />

                <div>
                  <span>
                    Créditos otorgados
                  </span>

                  <strong>
                    {formatMoney(
                      metrics.creditsGranted
                    )}
                  </strong>

                  <small>
                    {
                      report
                        .creditRows
                        .length
                    } carpetas
                  </small>
                </div>
              </article>

              <article>
                <CircleDollarSign
                  size={18}
                />

                <div>
                  <span>
                    Cobranzas de créditos
                  </span>

                  <strong>
                    {formatMoney(
                      metrics.creditCollections
                    )}
                  </strong>

                  <small>
                    Capital{" "}
                    {formatMoney(
                      metrics.capitalCollected
                    )}{" "}
                    · Punitorios{" "}
                    {formatMoney(
                      metrics.penaltiesCollected
                    )}
                  </small>
                </div>
              </article>

              <article>
                <ReceiptText
                  size={18}
                />

                <div>
                  <span>
                    Ventas procesadas
                  </span>

                  <strong>
                    {
                      metrics.salesCount
                    }
                  </strong>

                  <small>
                    Operaciones del período
                  </small>
                </div>
              </article>

              <article>
                <Wrench
                  size={18}
                />

                <div>
                  <span>
                    Tickets entregados
                  </span>

                  <strong>
                    {
                      metrics.deliveredTickets
                    }
                  </strong>

                  <small>
                    Finalizados en el período
                  </small>
                </div>
              </article>
            </section>

            <section className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <span>
                    Financiamiento
                  </span>

                  <h2>
                    Créditos otorgados
                  </h2>
                </div>

                <strong>
                  {
                    report
                      .creditRows
                      .length
                  }{" "}
                  registros
                </strong>
              </div>

              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>
                        Fecha origen
                      </th>
                      <th>
                        Nº carpeta
                      </th>
                      <th>
                        Cliente
                      </th>
                      <th>
                        Concepto
                      </th>
                      <th>
                        Capital otorgado
                      </th>
                      <th>
                        Saldo actual
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.creditRows.map(
                      (
                        credit
                      ) => (
                        <tr
                          key={
                            credit.id
                          }
                        >
                          <td>
                            {formatDate(
                              credit.reportDate
                            )}
                          </td>

                          <td className="mono">
                            {
                              credit.id
                            }
                          </td>

                          <td>
                            {
                              credit.cliente ||
                              "—"
                            }
                          </td>

                          <td>
                            {
                              credit.concepto ||
                              "Crédito"
                            }
                          </td>

                          <td className="money">
                            {formatMoney(
                              credit.original
                            )}
                          </td>

                          <td
                            className={
                              Number(
                                credit.saldo ||
                                0
                              ) >
                              0
                                ? "money pending"
                                : "money paid"
                            }
                          >
                            {formatMoney(
                              credit.saldo
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {!report
                      .creditRows
                      .length && (
                      <EmptyTable
                        colSpan={
                          6
                        }
                        message="No hay créditos otorgados en el período seleccionado."
                      />
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-panel">
              <div className="reports-panel-head">
                <div>
                  <span>
                    Recuperación
                  </span>

                  <h2>
                    Cobranzas de créditos
                  </h2>
                </div>

                <strong>
                  {
                    report
                      .creditPayments
                      .length
                  }{" "}
                  pagos
                </strong>
              </div>

              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>
                        Fecha
                      </th>
                      <th>
                        Carpeta / cliente
                      </th>
                      <th>
                        Método
                      </th>
                      <th>
                        Capital
                      </th>
                      <th>
                        Punitorios
                      </th>
                      <th>
                        Total cobrado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.creditPayments.map(
                      (
                        payment
                      ) => (
                        <tr
                          key={
                            payment.id
                          }
                        >
                          <td>
                            {payment.fecha ||
                              formatDate(
                                payment.reportDate
                              )}
                          </td>

                          <td>
                            <strong className="reports-table-main">
                              {
                                payment.cliente
                              }
                            </strong>

                            <span className="reports-table-sub">
                              {
                                payment.creditId
                              }{" "}
                              ·{" "}
                              {
                                payment.concepto
                              }
                            </span>
                          </td>

                          <td>
                            {
                              payment.metodo
                            }
                          </td>

                          <td className="money">
                            {formatMoney(
                              payment.capital
                            )}
                          </td>

                          <td className="money warning">
                            {formatMoney(
                              payment.punitorios
                            )}
                          </td>

                          <td className="money paid">
                            {formatMoney(
                              payment.total
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {!report
                      .creditPayments
                      .length && (
                      <EmptyTable
                        colSpan={
                          6
                        }
                        message="No hay cobranzas de créditos en el período seleccionado."
                      />
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="reports-panel reports-overdue-panel">
              <div className="reports-panel-head">
                <div>
                  <span>
                    Riesgo
                  </span>

                  <h2>
                    Clientes morosos
                  </h2>
                </div>

                <strong>
                  {
                    metrics.overdueClients
                  }{" "}
                  clientes
                </strong>
              </div>

              <div className="reports-overdue-summary">
                <div>
                  <span>
                    Saldo total de clientes con mora
                  </span>

                  <strong>
                    {formatMoney(
                      metrics.overduePortfolio
                    )}
                  </strong>
                </div>

                <div>
                  <span>
                    Capital actualmente vencido
                  </span>

                  <strong>
                    {formatMoney(
                      metrics.overdueCapital
                    )}
                  </strong>
                </div>
              </div>

              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead>
                    <tr>
                      <th>
                        Cliente
                      </th>
                      <th>
                        Teléfono
                      </th>
                      <th>
                        Carpetas
                      </th>
                      <th>
                        Días de mora
                      </th>
                      <th>
                        Capital vencido
                      </th>
                      <th>
                        Saldo a reclamar
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {report.overdueClients.map(
                      (
                        client
                      ) => (
                        <tr
                          key={
                            client.key
                          }
                        >
                          <td>
                            <strong className="reports-table-main">
                              {
                                client.cliente
                              }
                            </strong>
                          </td>

                          <td>
                            {
                              client.telefono
                            }
                          </td>

                          <td>
                            {
                              client.carpetas
                            }
                          </td>

                          <td>
                            <span className="reports-overdue-badge">
                              {
                                client.diasMora
                              }{" "}
                              días
                            </span>
                          </td>

                          <td className="money warning">
                            {formatMoney(
                              client.vencido
                            )}
                          </td>

                          <td className="money danger">
                            {formatMoney(
                              client.saldo
                            )}
                          </td>
                        </tr>
                      )
                    )}

                    {!report
                      .overdueClients
                      .length && (
                      <EmptyTable
                        colSpan={
                          6
                        }
                        message="No hay clientes con cuotas vencidas pendientes."
                      />
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
