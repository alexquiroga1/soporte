import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ClipboardList,
  Download,
  FilePenLine,
  History,
  ReceiptText,
  RotateCcw,
  Search,
  X,
} from "lucide-react";

import { subscribeToInvoices } from "../../services/facturas.service.js";
import { subscribeToBudgets } from "../../services/presupuestos.service.js";
import { notify } from "../../services/notifications.js";

import "./FacturacionSuite.css";

function parseDate(value) {
  if (!value) return 0;
  const direct = new Date(value);
  if (!Number.isNaN(direct.getTime())) return direct.getTime();
  const match = String(value).match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[^\d]+(\d{1,2}):(\d{2}))?/);
  if (!match) return 0;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0)).getTime();
}

function eventType(action = "") {
  const value = String(action).toLowerCase();
  if (value.includes("rectific")) return "Rectificación";
  if (value.includes("crédito") || value.includes("credito")) return "Nota de Crédito";
  if (value.includes("anulad") || value.includes("cancel")) return "Anulación";
  if (value.includes("cobro") || value.includes("pago")) return "Cobro";
  if (value.includes("presupuesto")) return "Presupuesto";
  if (value.includes("emisión") || value.includes("emision") || value.includes("factur")) return "Emisión";
  return "Otro";
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function HistorialFacturacion() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [invoiceLoading, setInvoiceLoading] = useState(true);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToInvoices(
      (data) => { setInvoices(data); setInvoiceLoading(false); },
      (error) => { console.error(error); setInvoiceLoading(false); notify.error("Error de auditoría", "No pudimos cargar los comprobantes."); }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeToBudgets(
      (data) => { setBudgets(data); setBudgetLoading(false); },
      (error) => { console.error(error); setBudgetLoading(false); notify.error("Error de auditoría", "No pudimos cargar los presupuestos."); }
    );
    return () => unsubscribe();
  }, []);

  const events = useMemo(() => {
    const invoiceEvents = invoices.flatMap((document) => {
      const history = Array.isArray(document.historial) ? document.historial : [];
      return history.map((entry, index) => ({
        key: `invoice-${document.id}-${index}`,
        source: document.tipo === "Nota de Crédito" ? "Nota de Crédito" : "Factura",
        documentId: document.id,
        client: document.cliente || "Consumidor Final",
        doc: document.doc || "C.F.",
        action: entry.accion || "Evento",
        detail: entry.detalle || "Sin detalle",
        author: entry.autor || document.usuario || "Sistema",
        date: entry.fecha || document.actualizadoEn || document.creadoEn || document.fecha || "—",
        timestamp: parseDate(entry.fecha || document.actualizadoEn || document.creadoEn || document.fecha),
        type: eventType(entry.accion),
        route: document.tipo === "Nota de Crédito" ? "/facturacion/notas-credito" : "/facturacion/facturas",
      }));
    });

    const budgetEvents = budgets.flatMap((budget) => {
      const history = Array.isArray(budget.historial) ? budget.historial : [];
      return history.map((entry, index) => ({
        key: `budget-${budget.id}-${index}`,
        source: "Presupuesto",
        documentId: budget.id,
        client: budget.cliente || budget.clienteNombre || "Cliente",
        doc: budget.doc || budget.clienteDoc || "—",
        action: entry.accion || entry.action || "Evento",
        detail: entry.detalle || entry.detail || "Sin detalle",
        author: entry.autor || entry.author || budget.usuario || "Sistema",
        date: entry.fecha || entry.date || budget.actualizadoEn || budget.creadoEn || budget.fecha || "—",
        timestamp: parseDate(entry.fecha || entry.date || budget.actualizadoEn || budget.creadoEn || budget.fecha),
        type: eventType(entry.accion || entry.action),
        route: "/facturacion/presupuestos",
      }));
    });

    return [...invoiceEvents, ...budgetEvents].sort((a, b) => b.timestamp - a.timestamp);
  }, [invoices, budgets]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return events.filter((event) => {
      const haystack = [event.documentId, event.client, event.doc, event.action, event.detail, event.author].join(" ").toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesSource = !sourceFilter || event.source === sourceFilter;
      const matchesType = !typeFilter || event.type === typeFilter;
      return matchesSearch && matchesSource && matchesType;
    });
  }, [events, search, sourceFilter, typeFilter]);

  const selected = useMemo(() => events.find((event) => event.key === selectedKey) || null, [events, selectedKey]);

  const metrics = useMemo(() => ({
    total: events.length,
    invoices: events.filter((event) => event.source === "Factura").length,
    budgets: events.filter((event) => event.source === "Presupuesto").length,
    rectifications: events.filter((event) => event.type === "Rectificación").length,
    creditNotes: events.filter((event) => event.source === "Nota de Crédito" || event.type === "Nota de Crédito").length,
  }), [events]);

  const exportCsv = () => {
    const rows = [
      ["Fecha", "Fuente", "Documento", "Cliente", "Acción", "Detalle", "Usuario"],
      ...filtered.map((event) => [event.date, event.source, event.documentId, event.client, event.action, event.detail, event.author]),
    ];
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "servix-auditoria-facturacion.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const loading = invoiceLoading || budgetLoading;

  return (
    <main className="fb-page">
      <div className="fb-shell">
        <header className="fb-topbar">
          <div className="fb-brand">
            <button className="fb-icon-button" type="button" onClick={() => navigate("/facturacion")}><ArrowLeft size={19} /></button>
            <div className="fb-brand-icon"><History size={21} /></div>
            <div className="fb-brand-copy"><strong>Historial y auditoría</strong><span>SERVIX · Registro central de facturación</span></div>
          </div>
          <div className="fb-status"><span className="fb-status-dot" />Solo lectura</div>
        </header>

        <section className="fb-page-head">
          <div>
            <div className="fb-kicker"><History size={15} />Auditoría central</div>
            <h1>Historial de Facturación</h1>
            <p>Unificá en una sola línea temporal las acciones de presupuestos, facturas y Notas de Crédito.</p>
          </div>
          <div className="fb-actions"><button className="fb-button soft" type="button" onClick={exportCsv}><Download size={16} />Exportar CSV</button></div>
        </section>

        <section className="fb-metrics">
          <Metric label="Eventos" value={metrics.total} hint="Historial consolidado" icon={History} />
          <Metric label="Facturas" value={metrics.invoices} hint="Eventos de comprobantes" icon={ReceiptText} tone="mint" />
          <Metric label="Presupuestos" value={metrics.budgets} hint="Eventos comerciales" icon={ClipboardList} tone="violet" />
          <Metric label="Rectificaciones" value={metrics.rectifications} hint="Correcciones formales" icon={FilePenLine} tone="amber" />
          <Metric label="Notas de Crédito" value={metrics.creditNotes} hint="Créditos y anulaciones" icon={RotateCcw} tone="pink" />
        </section>

        <section className="fb-workspace">
          <div className="fb-workspace-head"><div className="fb-workspace-title"><strong>Línea temporal</strong><span>Los eventos se consultan; no se editan ni se eliminan</span></div></div>
          <div className="fb-filters">
            <div className="fb-search"><Search size={17} /><input className="fb-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar documento, cliente, acción o usuario..." /></div>
            <select className="fb-select" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}><option value="">Todas las fuentes</option><option value="Factura">Factura</option><option value="Nota de Crédito">Nota de Crédito</option><option value="Presupuesto">Presupuesto</option></select>
            <select className="fb-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="">Todos los eventos</option><option value="Emisión">Emisión</option><option value="Cobro">Cobro</option><option value="Rectificación">Rectificación</option><option value="Anulación">Anulación</option><option value="Nota de Crédito">Nota de Crédito</option><option value="Presupuesto">Presupuesto</option><option value="Otro">Otro</option></select>
            <div className="fb-inline" style={{ justifyContent: "flex-end", color: "var(--fb-muted)", fontSize: ".55rem" }}>{filtered.length} eventos</div>
          </div>

          {loading ? <State icon={History} title="Cargando auditoría" text="Consolidando documentos y eventos..." />
            : filtered.length === 0 ? <State icon={History} title="Sin eventos" text="No hay resultados para los filtros seleccionados." />
            : (
              <div className="fb-table-wrap">
                <div className="fb-table-head fb-audit-row"><div>Fecha</div><div>Fuente</div><div>Documento</div><div>Acción / detalle</div><div>Cliente</div><div>Usuario</div><div></div></div>
                {filtered.map((event) => (
                  <motion.div key={event.key} className="fb-table-row fb-audit-row clickable" role="button" tabIndex={0} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelectedKey(event.key)}>
                    <div className="fb-cell"><strong>{event.date}</strong><span>{event.type}</span></div>
                    <div><span className={`fb-badge ${event.source === "Factura" ? "blue" : event.source === "Nota de Crédito" ? "violet" : "amber"}`}>{event.source}</span></div>
                    <div className="fb-cell"><strong>{event.documentId}</strong></div>
                    <div className="fb-cell"><strong>{event.action}</strong><span>{event.detail}</span></div>
                    <div className="fb-cell"><strong>{event.client}</strong><span>{event.doc}</span></div>
                    <div className="fb-cell"><strong>{event.author}</strong></div>
                    <div className="fb-row-actions"><button className="fb-row-button preview" type="button" onClick={(e) => { e.stopPropagation(); setSelectedKey(event.key); }}><History size={16} /></button></div>
                  </motion.div>
                ))}
              </div>
            )}
        </section>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.section className="fb-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <header className="fb-screen-toolbar">
              <div className="fb-brand"><button className="fb-icon-button" type="button" onClick={() => setSelectedKey(null)}><ArrowLeft size={19} /></button><div className="fb-screen-title"><strong>{selected.documentId}</strong><span>Detalle del evento de auditoría</span></div></div>
              <div className="fb-toolbar-actions"><button className="fb-button soft" type="button" onClick={() => navigate(selected.route)}><ReceiptText size={16} />Abrir módulo</button></div>
            </header>
            <div className="fb-screen-scroll">
              <article className="fb-document">
                <div className="fb-document-head">
                  <div className="fb-doc-brand"><div className="fb-doc-logo"><History size={22} /></div><div><strong>SERVIX</strong><span>Evento de auditoría</span><span>Registro de solo lectura</span></div></div>
                  <div className="fb-doc-number"><span>{selected.source}</span><strong>{selected.documentId}</strong><span className="fb-badge blue">{selected.type}</span></div>
                </div>
                <div className="fb-doc-grid">
                  <Doc label="Fecha" strong={selected.date} lines={[`Usuario: ${selected.author}`]} />
                  <Doc label="Cliente" strong={selected.client} lines={[selected.doc]} />
                  <Doc label="Acción" strong={selected.action} lines={[selected.source]} />
                  <Doc label="Documento" strong={selected.documentId} lines={[`Fuente: ${selected.source}`]} />
                </div>
                <div className="fb-doc-section"><h3>Detalle registrado</h3><div className="fb-doc-box"><strong>{selected.detail}</strong></div></div>
                <div className="fb-note">Este registro se construye a partir del historial almacenado en los documentos de SERVIX. La auditoría no modifica los comprobantes originales.</div>
              </article>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function Metric({ label, value, hint, icon: Icon, tone = "" }) { return <article className={`fb-metric ${tone}`}><div className="fb-metric-top"><span className="fb-metric-label">{label}</span><div className="fb-metric-icon"><Icon size={18} /></div></div><strong>{value}</strong><small>{hint}</small></article>; }
function State({ icon: Icon, title, text }) { return <div className="fb-empty"><Icon size={24} /><strong>{title}</strong><span>{text}</span></div>; }
function Doc({ label, strong, lines = [] }) { return <div className="fb-doc-box"><label>{label}</label><strong>{strong}</strong>{lines.map((line) => <span key={line}>{line}</span>)}</div>; }
