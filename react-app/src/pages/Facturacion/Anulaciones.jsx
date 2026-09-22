import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Ban,
  History,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Undo2,
  X,
} from "lucide-react";

import { subscribeToInvoices } from "../../services/facturas.service.js";
import { notify } from "../../services/notifications.js";

import "./FacturacionSuite.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

function isClosed(invoice) {
  return invoice?.estado === "Anulada" || invoice?.estado === "Cancelada";
}

export default function Anulaciones() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    const unsubscribe = subscribeToInvoices(
      (data) => {
        setDocuments(data);
        setLoading(false);
        setError(null);
      },
      (firebaseError) => {
        console.error(firebaseError);
        setError(firebaseError);
        setLoading(false);
        notify.error("No pudimos cargar las anulaciones", "Revisá la conexión o los permisos de Firestore.");
      }
    );
    return () => unsubscribe();
  }, []);

  const invoices = useMemo(
    () => documents.filter((document) => (!document.tipo || document.tipo === "Factura") && isClosed(document)),
    [documents]
  );

  const notes = useMemo(
    () => documents.filter((document) => document.tipo === "Nota de Crédito"),
    [documents]
  );

  const noteByInvoice = useMemo(() => {
    const map = new Map();
    notes.forEach((note) => {
      const key = note.facturaOrigenId || note.refId;
      if (key) map.set(key, note);
    });
    return map;
  }, [notes]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return invoices.filter((invoice) => {
      const haystack = [invoice.id, invoice.cliente, invoice.doc, invoice.refId, invoice.notaCreditoId]
        .filter(Boolean).join(" ").toLowerCase();
      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus = !statusFilter || invoice.estado === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [invoices, search, statusFilter]);

  const selected = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedId) || null,
    [invoices, selectedId]
  );

  const selectedNote = selected ? noteByInvoice.get(selected.id) || null : null;

  const metrics = useMemo(() => ({
    total: invoices.length,
    annulled: invoices.filter((invoice) => invoice.estado === "Anulada").length,
    cancelled: invoices.filter((invoice) => invoice.estado === "Cancelada").length,
    credited: invoices.reduce((sum, invoice) => sum + Number(noteByInvoice.get(invoice.id)?.montoAcreditado || 0), 0),
    withNote: invoices.filter((invoice) => noteByInvoice.has(invoice.id) || invoice.notaCreditoId).length,
  }), [invoices, noteByInvoice]);

  return (
    <main className="fb-page">
      <div className="fb-shell">
        <header className="fb-topbar">
          <div className="fb-brand">
            <button className="fb-icon-button" type="button" onClick={() => navigate("/facturacion")}><ArrowLeft size={19} /></button>
            <div className="fb-brand-icon"><Undo2 size={21} /></div>
            <div className="fb-brand-copy"><strong>Anulaciones</strong><span>SERVIX · Comprobantes cerrados y trazabilidad</span></div>
          </div>
          <div className="fb-status"><span className="fb-status-dot" />Auditoría activa</div>
        </header>

        <section className="fb-page-head">
          <div>
            <div className="fb-kicker"><Ban size={15} />Control de cierre</div>
            <h1>Anulaciones y cancelaciones</h1>
            <p>Revisá qué comprobantes fueron cerrados, por qué y qué Nota de Crédito los compensa.</p>
          </div>
          <div className="fb-actions">
            <button className="fb-button" type="button" onClick={() => navigate("/facturacion/facturas")}><ReceiptText size={16} />Ir a Facturas</button>
            <button className="fb-button soft" type="button" onClick={() => navigate("/facturacion/notas-credito")}><RotateCcw size={16} />Notas de Crédito</button>
          </div>
        </section>

        <section className="fb-metrics">
          <Metric label="Comprobantes cerrados" value={metrics.total} hint="Anulados + cancelados" icon={Undo2} />
          <Metric label="Anulados" value={metrics.annulled} hint="Con operación económica revertida" icon={RotateCcw} tone="pink" />
          <Metric label="Cancelados" value={metrics.cancelled} hint="Sin cobro efectivo" icon={Ban} tone="amber" />
          <Metric label="Con Nota de Crédito" value={metrics.withNote} hint="Documento compensatorio" icon={ReceiptText} tone="violet" />
          <Metric label="Saldo acreditado" value={formatMoney(metrics.credited)} hint="Importe efectivamente reconocido" icon={History} tone="mint" />
        </section>

        <section className="fb-workspace">
          <div className="fb-workspace-head"><div className="fb-workspace-title"><strong>Comprobantes cerrados</strong><span>La factura original permanece visible y auditable</span></div></div>
          <div className="fb-filters" style={{ gridTemplateColumns: "minmax(0,1fr) 190px 180px 130px" }}>
            <div className="fb-search"><Search size={17} /><input className="fb-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar factura, cliente o Nota de Crédito..." /></div>
            <select className="fb-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="">Todos los estados</option><option value="Anulada">Anulada</option><option value="Cancelada">Cancelada</option></select>
            <div />
            <div className="fb-inline" style={{ justifyContent: "flex-end", color: "var(--fb-muted)", fontSize: ".55rem" }}>{filtered.length} resultados</div>
          </div>

          {loading ? <State icon={Undo2} title="Cargando anulaciones" text="Sincronizando comprobantes..." />
            : error ? <State icon={X} title="No pudimos cargar la información" text="Revisá conexión o permisos." />
            : filtered.length === 0 ? <State icon={Undo2} title="Sin comprobantes cerrados" text="No hay resultados para los filtros seleccionados." />
            : (
              <div className="fb-table-wrap">
                <div className="fb-table-head fb-annul-row"><div>Factura</div><div>Cliente</div><div>Estado</div><div>Nota de Crédito</div><div>Fecha</div><div>Total</div><div>Acciones</div></div>
                {filtered.map((invoice) => {
                  const note = noteByInvoice.get(invoice.id);
                  return (
                    <motion.div key={invoice.id} className="fb-table-row fb-annul-row clickable" role="button" tabIndex={0} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelectedId(invoice.id)}>
                      <div className="fb-cell"><strong>{invoice.id}</strong><span>{invoice.refModulo || "Factura"}</span></div>
                      <div className="fb-cell"><strong>{invoice.cliente || "Consumidor Final"}</strong><span>{invoice.doc || "C.F."}</span></div>
                      <div><span className={`fb-badge ${invoice.estado === "Anulada" ? "red" : "amber"}`}>{invoice.estado}</span></div>
                      <div className="fb-cell"><strong>{invoice.notaCreditoId || note?.id || "—"}</strong><span>{note ? formatMoney(note.montoAcreditado ?? note.total) : "Sin NC"}</span></div>
                      <div className="fb-cell"><strong>{formatDate(invoice.fecha)}</strong><span>{invoice.anuladaEn || invoice.actualizadoEn ? "Cierre registrado" : ""}</span></div>
                      <div className="fb-money">{formatMoney(invoice.total)}</div>
                      <div className="fb-row-actions"><button className="fb-row-button preview" type="button" title="Ver detalle" onClick={(e) => { e.stopPropagation(); setSelectedId(invoice.id); }}><History size={16} /></button><button className="fb-row-button" type="button" title="Imprimir" onClick={(e) => { e.stopPropagation(); setSelectedId(invoice.id); setTimeout(() => window.print(), 120); }}><Printer size={16} /></button></div>
                    </motion.div>
                  );
                })}
              </div>
            )}
        </section>
      </div>

      <AnimatePresence>
        {selected && (
          <motion.section className="fb-screen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <header className="fb-screen-toolbar">
              <div className="fb-brand"><button className="fb-icon-button" type="button" onClick={() => setSelectedId(null)}><ArrowLeft size={19} /></button><div className="fb-screen-title"><strong>{selected.id}</strong><span>Informe de cierre documental</span></div></div>
              <div className="fb-toolbar-actions"><button className="fb-button soft" type="button" onClick={() => navigate("/facturacion/notas-credito")}><RotateCcw size={16} />Notas de Crédito</button><button className="fb-button primary" type="button" onClick={() => window.print()}><Printer size={16} />Imprimir</button></div>
            </header>
            <div className="fb-screen-scroll">
              <article className="fb-document">
                <div className="fb-document-head">
                  <div className="fb-doc-brand"><div className="fb-doc-logo"><Undo2 size={22} /></div><div><strong>SERVIX</strong><span>Informe de anulación / cancelación</span><span>Comprobante original conservado</span></div></div>
                  <div className="fb-doc-number"><span>Factura</span><strong>{selected.id}</strong><span className={`fb-badge ${selected.estado === "Anulada" ? "red" : "amber"}`}>{selected.estado}</span></div>
                </div>
                <div className="fb-doc-grid">
                  <Doc label="Cliente" strong={selected.cliente || "Consumidor Final"} lines={[selected.doc || "C.F.", `Cliente ID: ${selected.clienteId || "—"}`]} />
                  <Doc label="Operación original" strong={formatMoney(selected.total)} lines={[`${formatDate(selected.fecha)} · ${selected.estadoPago || "—"}`, `${selected.refModulo || "Origen"}: ${selected.refId || "—"}`]} />
                  <Doc label="Nota de Crédito" strong={selected.notaCreditoId || selectedNote?.id || "No corresponde"} lines={[selectedNote ? `Importe acreditado: ${formatMoney(selectedNote.montoAcreditado ?? selectedNote.total)}` : "Cancelación sin cobro / sin NC"]} />
                  <Doc label="Motivo" strong={selectedNote?.motivo || "Ver historial"} lines={[selected.anuladaEn || selected.actualizadoEn || "Fecha de cierre no disponible"]} />
                </div>
                <div className="fb-doc-section"><h3>Historial del comprobante</h3><Timeline entries={selected.historial} /></div>
                {selectedNote && <div className="fb-note">La Nota de Crédito {selectedNote.id} conserva su propio historial. El importe acreditado puede ser menor al total si la factura tenía pagos parciales.</div>}
                {!selectedNote && selected.estado === "Cancelada" && <div className="fb-note warning">La cancelación corresponde a una factura sin cobro efectivo. No se genera saldo a favor porque no hubo dinero ingresado.</div>}
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
function Timeline({ entries }) {
  const list = Array.isArray(entries) ? [...entries].reverse() : [];
  if (!list.length) return <div className="fb-doc-box"><span>Sin historial adicional.</span></div>;
  return <div className="fb-timeline">{list.map((entry, index) => <div className="fb-timeline-item" key={`${entry.fecha}-${index}`}><div className="fb-timeline-icon"><History size={15} /></div><div className="fb-timeline-copy"><strong>{entry.accion || "Evento"}</strong><span>{entry.detalle || "Sin detalle"}</span></div><time>{entry.fecha || "—"}</time></div>)}</div>;
}
