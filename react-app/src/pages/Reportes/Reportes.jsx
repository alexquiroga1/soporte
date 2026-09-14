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
  BarChart3,
  Boxes,
  CalendarRange,
  ChartNoAxesCombined,
  CircleDollarSign,
  CreditCard,
  Download,
  FileCheck2,
  PackageSearch,
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
  { id: "month", label: "Mes actual" },
  { id: "30d", label: "30 días" },
  { id: "90d", label: "90 días" },
  { id: "year", label: "Año actual" },
  { id: "all", label: "Todo" },
];

const TABS = [
  ["overview", "Resumen"],
  ["commercial", "Comercial"],
  ["operations", "Operación"],
  ["finance", "Finanzas"],
];

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatDate(value) {
  if (!value) return "—";
  const date = value instanceof Date
    ? value
    : new Date(String(value).length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function getBudgetStatus(budget) {
  return budget.respuesta || budget.estado || "Pendiente";
}

function getInvoicePaymentStatus(invoice) {
  return invoice.estadoPago || invoice.paymentStatus || "—";
}

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadCsv(report) {
  const rows = [
    ["Tipo", "ID", "Fecha", "Cliente / Concepto", "Estado / Medio", "Importe"],
  ];

  report.invoiceRows.forEach((invoice) => rows.push([
    "Factura",
    invoice.id,
    formatDate(invoice.reportDate),
    invoice.cliente || "—",
    getInvoicePaymentStatus(invoice),
    Number(invoice.total || 0),
  ]));

  report.budgetRows.forEach((budget) => rows.push([
    "Presupuesto",
    budget.id,
    formatDate(budget.reportDate),
    budget.cliente || budget.clienteNombre || "—",
    getBudgetStatus(budget),
    Number(budget.reportTotal || 0),
  ]));

  report.creditPayments.forEach((payment) => rows.push([
    "Cobranza crédito",
    payment.creditId,
    formatDate(payment.reportDate),
    payment.cliente || "—",
    payment.metodo || "—",
    Number(payment.total || 0),
  ]));

  report.cashMovements.forEach((movement) => rows.push([
    "Caja",
    movement.id || "—",
    formatDate(movement.reportDate),
    movement.concepto || "Movimiento",
    movement.tipo || "—",
    Number(movement.monto || 0),
  ]));

  const csv = rows.map((row) => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `servix-reportes-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function EmptyState({ children }) {
  return <div className="reports-empty">{children}</div>;
}

export default function Reportes() {
  const navigate = useNavigate();
  const [sourceData, setSourceData] = useState({
    credits: [],
    clients: [],
    invoices: [],
    sales: [],
    tickets: [],
    products: [],
    budgets: [],
    cashCuts: [],
    currentCash: null,
  });
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");
  const [tab, setTab] = useState("overview");

  useEffect(() => {
    const unsubscribe = subscribeToReports(
      (data) => {
        setSourceData(data);
        setLoading(false);
      },
      (error) => {
        console.error(error);
        setLoading(false);
        notify.error("Reportes", "No se pudieron cargar todos los datos del negocio.");
      }
    );

    return unsubscribe;
  }, []);

  const report = useMemo(
    () => buildReportData(sourceData, period),
    [sourceData, period]
  );

  const { metrics } = report;
  const riskPercent = metrics.activePortfolio > 0
    ? (metrics.overduePortfolio / metrics.activePortfolio) * 100
    : 0;

  if (loading) {
    return (
      <main className="reports-page">
        <div className="reports-loading">Consolidando datos del negocio...</div>
      </main>
    );
  }

  return (
    <main className="reports-page">
      <div className="reports-shell">
        <header className="reports-header">
          <div>
            <button type="button" className="reports-back" onClick={() => navigate("/dashboard")}>
              <ArrowLeft size={17} /> Dashboard
            </button>
            <span className="reports-eyebrow">Analítica / Dirección</span>
            <h1>Reportes</h1>
            <p>Ventas, caja, facturación, créditos, tickets, presupuestos e inventario en una sola lectura.</p>
          </div>

          <div className="reports-header-actions">
            <label className="reports-period">
              <CalendarRange size={16} />
              <select value={period} onChange={(event) => setPeriod(event.target.value)}>
                {PERIODS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>

            <button type="button" className="reports-action" onClick={() => downloadCsv(report)}>
              <Download size={16} /> Exportar CSV
            </button>

            <button type="button" className="reports-action primary" onClick={() => window.print()}>
              <Printer size={16} /> Imprimir
            </button>
          </div>
        </header>

        <div className="reports-period-label">
          <CalendarRange size={14} /> {report.period.label}
        </div>

        <section className="reports-kpis">
          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <div className="reports-kpi-icon income"><TrendingUp size={19} /></div>
            <span>Ingresos de Caja</span>
            <strong>{formatMoney(metrics.cashIncome)}</strong>
            <small>Ingresos reales del período</small>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .03 }}>
            <div className="reports-kpi-icon billed"><ReceiptText size={19} /></div>
            <span>Facturación</span>
            <strong>{formatMoney(metrics.invoiced)}</strong>
            <small>{metrics.invoicesCount} facturas válidas</small>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .06 }}>
            <div className="reports-kpi-icon net"><ChartNoAxesCombined size={19} /></div>
            <span>Resultado de Caja</span>
            <strong className={metrics.netCash < 0 ? "negative" : ""}>{formatMoney(metrics.netCash)}</strong>
            <small>Ingresos − egresos</small>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .09 }}>
            <div className="reports-kpi-icon portfolio"><WalletCards size={19} /></div>
            <span>Cartera activa</span>
            <strong>{formatMoney(metrics.activePortfolio)}</strong>
            <small>Saldo pendiente total</small>
          </motion.article>

          <motion.article className={metrics.overduePortfolio > 0 ? "risk" : ""} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .12 }}>
            <div className="reports-kpi-icon overdue"><AlertTriangle size={19} /></div>
            <span>Cartera en mora</span>
            <strong>{formatMoney(metrics.overduePortfolio)}</strong>
            <small>{formatPercent(riskPercent)} de la cartera</small>
          </motion.article>

          <motion.article initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: .15 }}>
            <div className="reports-kpi-icon inventory"><Boxes size={19} /></div>
            <span>Inventario a costo</span>
            <strong>{formatMoney(metrics.inventoryCost)}</strong>
            <small>{metrics.lowStockProducts} SKU con alerta</small>
          </motion.article>
        </section>

        <div className="reports-tabs">
          {TABS.map(([key, label]) => (
            <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
              {key === "overview" && <BarChart3 size={15} />}
              {key === "commercial" && <FileCheck2 size={15} />}
              {key === "operations" && <Wrench size={15} />}
              {key === "finance" && <CreditCard size={15} />}
              {label}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <>
            <section className="reports-secondary">
              <article><FileCheck2 size={18} /><div><span>Conversión presupuestos</span><strong>{formatPercent(metrics.budgetConversion)}</strong><small>{metrics.budgetsAccepted} aceptados de {metrics.budgetsCreated} creados</small></div></article>
              <article><CircleDollarSign size={18} /><div><span>Ticket promedio</span><strong>{formatMoney(metrics.averageSale)}</strong><small>{metrics.salesCount} ventas procesadas</small></div></article>
              <article><Wrench size={18} /><div><span>Entrega de tickets</span><strong>{formatPercent(metrics.deliveryRate)}</strong><small>{metrics.deliveredTickets} entregados de {metrics.ticketsCreated}</small></div></article>
              <article><Boxes size={18} /><div><span>Inventario a venta</span><strong>{formatMoney(metrics.inventoryRetail)}</strong><small>Valor potencial del stock actual</small></div></article>
            </section>

            <div className="reports-overview-grid">
              <section className="reports-panel">
                <div className="reports-panel-head"><div><span>Comercial</span><h2>Presupuestos</h2></div><strong>{formatMoney(metrics.openBudgetValue)} abiertos</strong></div>
                <div className="reports-mini-stats">
                  <div><span>Creados</span><strong>{metrics.budgetsCreated}</strong></div>
                  <div><span>Aceptados</span><strong>{metrics.budgetsAccepted}</strong></div>
                  <div><span>Conversión</span><strong>{formatPercent(metrics.budgetConversion)}</strong></div>
                </div>
              </section>

              <section className={`reports-panel ${metrics.overdueClients ? "reports-overdue-panel" : ""}`}>
                <div className="reports-panel-head"><div><span>Riesgo</span><h2>Morosidad</h2></div><strong>{metrics.overdueClients} clientes</strong></div>
                <div className="reports-mini-stats">
                  <div><span>Saldo en mora</span><strong>{formatMoney(metrics.overduePortfolio)}</strong></div>
                  <div><span>Capital vencido</span><strong>{formatMoney(metrics.overdueCapital)}</strong></div>
                  <div><span>Índice</span><strong>{formatPercent(riskPercent)}</strong></div>
                </div>
              </section>
            </div>

            <section className="reports-panel">
              <div className="reports-panel-head"><div><span>Ventas</span><h2>Productos y conceptos más vendidos</h2></div><strong>{report.topProducts.length} destacados</strong></div>
              {report.topProducts.length ? (
                <div className="reports-ranking">
                  {report.topProducts.map((product, index) => (
                    <div key={product.name} className="reports-rank-row">
                      <span className="reports-rank-number">{index + 1}</span>
                      <div><strong>{product.name}</strong><small>{product.quantity} unidades / conceptos</small></div>
                      <strong>{formatMoney(product.amount)}</strong>
                    </div>
                  ))}
                </div>
              ) : <EmptyState>Sin detalle de artículos vendido en el período.</EmptyState>}
            </section>
          </>
        )}

        {tab === "commercial" && (
          <>
            <section className="reports-panel">
              <div className="reports-panel-head"><div><span>Presupuestos</span><h2>Actividad comercial</h2></div><strong>{report.budgetRows.length} registros</strong></div>
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th>Fecha</th><th>Presupuesto</th><th>Cliente</th><th>Origen</th><th>Estado</th><th>Total</th></tr></thead>
                  <tbody>
                    {report.budgetRows.map((budget) => (
                      <tr key={budget.id}><td>{formatDate(budget.reportDate)}</td><td className="mono">{budget.id}</td><td>{budget.cliente || budget.clienteNombre || "—"}</td><td>{budget.origen || "Manual"}</td><td>{getBudgetStatus(budget)}</td><td className="money">{formatMoney(budget.reportTotal)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.budgetRows.length && <EmptyState>No hay presupuestos en el período.</EmptyState>}
            </section>

            <section className="reports-panel">
              <div className="reports-panel-head"><div><span>Facturación</span><h2>Facturas emitidas</h2></div><strong>{report.invoiceRows.length} documentos</strong></div>
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th>Fecha</th><th>Factura</th><th>Cliente</th><th>Origen</th><th>Cobro</th><th>Total</th></tr></thead>
                  <tbody>
                    {report.invoiceRows.map((invoice) => (
                      <tr key={invoice.id}><td>{formatDate(invoice.reportDate)}</td><td className="mono">{invoice.id}</td><td>{invoice.cliente || "—"}</td><td>{invoice.refModulo || invoice.origen || "—"}</td><td>{getInvoicePaymentStatus(invoice)}</td><td className="money">{formatMoney(invoice.total)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.invoiceRows.length && <EmptyState>No hay facturas válidas en el período.</EmptyState>}
            </section>
          </>
        )}

        {tab === "operations" && (
          <>
            <section className="reports-panel">
              <div className="reports-panel-head"><div><span>Soporte técnico</span><h2>Tickets del período</h2></div><strong>{report.ticketRows.length} ingresados</strong></div>
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th>Ingreso</th><th>Ticket</th><th>Cliente</th><th>Equipo / falla</th><th>Estado</th><th>Total</th></tr></thead>
                  <tbody>
                    {report.ticketRows.slice(0, 50).map((ticket) => (
                      <tr key={ticket.id}><td>{formatDate(ticket.reportDate)}</td><td className="mono">{ticket.id}</td><td>{ticket.cliente || ticket.clienteNombre || "—"}</td><td><span className="reports-table-main">{ticket.equipo || ticket.dispositivo || "Equipo"}</span><span className="reports-table-sub">{ticket.falla || ticket.problema || "—"}</span></td><td>{ticket.stage || ticket.estado || "—"}</td><td className="money">{formatMoney(ticket.total || ticket.presupuestoTotal || 0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.ticketRows.length && <EmptyState>No hay tickets en el período.</EmptyState>}
            </section>

            <section className="reports-panel">
              <div className="reports-panel-head"><div><span>Inventario</span><h2>Alertas de stock</h2></div><strong>{report.lowStockProducts.length} SKU</strong></div>
              <div className="reports-stock-grid">
                {report.lowStockProducts.slice(0, 12).map((product) => (
                  <article key={product.id}><PackageSearch size={18} /><div><strong>{product.nombre || product.descripcion || product.id}</strong><span>{product.sku || "Sin SKU"}</span></div><div><span>Disponible</span><strong>{product.available}</strong></div><div><span>Mínimo</span><strong>{product.minimum}</strong></div></article>
                ))}
              </div>
              {!report.lowStockProducts.length && <EmptyState>El inventario no presenta alertas de mínimo.</EmptyState>}
            </section>
          </>
        )}

        {tab === "finance" && (
          <>
            <section className="reports-secondary">
              <article><CreditCard size={18} /><div><span>Créditos otorgados</span><strong>{formatMoney(metrics.creditsGranted)}</strong><small>{report.creditRows.length} carpetas del período</small></div></article>
              <article><CircleDollarSign size={18} /><div><span>Cobranzas de créditos</span><strong>{formatMoney(metrics.creditCollections)}</strong><small>Capital {formatMoney(metrics.capitalCollected)} · Punitorios {formatMoney(metrics.penaltiesCollected)}</small></div></article>
              <article><TrendingDown size={18} /><div><span>Egresos de Caja</span><strong>{formatMoney(metrics.cashExpenses)}</strong><small>Movimientos egreso del período</small></div></article>
              <article><AlertTriangle size={18} /><div><span>Capital vencido</span><strong>{formatMoney(metrics.overdueCapital)}</strong><small>{metrics.overdueClients} clientes en mora</small></div></article>
            </section>

            <section className="reports-panel">
              <div className="reports-panel-head"><div><span>Financiamiento</span><h2>Créditos otorgados</h2></div><strong>{report.creditRows.length} registros</strong></div>
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th>Fecha</th><th>Carpeta</th><th>Cliente</th><th>Concepto</th><th>Capital</th><th>Saldo</th></tr></thead>
                  <tbody>
                    {report.creditRows.map((credit) => (
                      <tr key={credit.id}><td>{formatDate(credit.reportDate)}</td><td className="mono">{credit.id}</td><td>{credit.cliente || "—"}</td><td>{credit.concepto || "Crédito"}</td><td className="money">{formatMoney(credit.original)}</td><td className={`money ${Number(credit.saldo || 0) > 0 ? "warning" : "paid"}`}>{formatMoney(credit.saldo)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.creditRows.length && <EmptyState>No hay créditos otorgados en el período.</EmptyState>}
            </section>

            <section className="reports-panel reports-overdue-panel">
              <div className="reports-panel-head"><div><span>Cobranzas</span><h2>Clientes en mora</h2></div><strong>{report.overdueClients.length} clientes</strong></div>
              <div className="reports-table-wrap">
                <table className="reports-table">
                  <thead><tr><th>Cliente</th><th>Teléfono</th><th>Días mora</th><th>Capital vencido</th><th>Saldo total</th><th>Carpetas</th></tr></thead>
                  <tbody>
                    {report.overdueClients.map((client) => (
                      <tr key={client.key}><td>{client.cliente}</td><td>{client.telefono || "—"}</td><td><span className="reports-overdue-badge">{client.diasMora} días</span></td><td className="money danger">{formatMoney(client.vencido)}</td><td className="money danger">{formatMoney(client.saldo)}</td><td>{client.carpetas}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!report.overdueClients.length && <EmptyState>No hay clientes con mora activa.</EmptyState>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
