import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CheckCircle2,
  FilePenLine,
  History,
  Plus,
  Printer,
  ReceiptText,
  Search,
  X,
} from "lucide-react";

import { useAuth } from "../../context/AuthContext.jsx";
import { subscribeToInvoices } from "../../services/facturas.service.js";
import { addInvoiceRectification } from "../../services/rectificaciones.service.js";
import { notify } from "../../services/notifications.js";

import "./FacturacionSuite.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : String(value);
}

function isRectificationEvent(event) {
  return String(event?.accion || "").toLowerCase().includes("rectific");
}

function rectificationEvents(invoice) {
  return (Array.isArray(invoice?.historial) ? invoice.historial : []).filter(isRectificationEvent);
}

export default function Rectificaciones() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();
  const author = profile?.nombre || profile?.name || user?.email || "Sistema";

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [targetInvoiceId, setTargetInvoiceId] = useState("");
  const [observation, setObservation] = useState("");
  const [saving, setSaving] = useState(false);

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
        notify.error("No pudimos cargar las rectificaciones", "Revisá la conexión o los permisos de Firestore.");
      }
    );
    return () => unsubscribe();
  }, []);

  const invoices = useMemo(
    () => documents.filter((document) => !document.tipo || document.tipo === "Factura"),
    [documents]
  );

  const rectified = useMemo(
    () => invoices.filter((invoice) => rectificationEvents(invoice).length > 0 || invoice.ultimaRectificacion),
    [invoices]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rectified;
    return rectified.filter((invoice) => [invoice.id, invoice.cliente, invoice.doc, invoice.refId, invoice.ultimaRectificacion]
      .filter(Boolean).join(" ").toLowerCase().includes(term));
  }, [rectified, search]);

  const eligible = useMemo(
    () => invoices.filter((invoice) => invoice.estado === "Emitida"),
    [invoices]
  );

  const pickerResults = useMemo(() => {
    const term = pickerSearch.trim().toLowerCase();
    if (!term) return eligible.slice(0, 8);
    return eligible.filter((invoice) => [invoice.id, invoice.cliente, invoice.doc, invoice.refId]
      .filter(Boolean).join(" ").toLowerCase().includes(term)).slice(0, 8);
  }, [eligible, pickerSearch]);

  const selected = useMemo(
    () => invoices.find((invoice) => invoice.id === selectedId) || null,
    [invoices, selectedId]
  );

  const selectedEvents = selected ? rectificationEvents(selected) : [];
  const allEvents = useMemo(() => rectified.flatMap(rectificationEvents), [rectified]);

  const openNew = (invoiceId = "") => {
    setTargetInvoiceId(invoiceId);
    setObservation("");
    setPickerSearch(invoiceId);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!targetInvoiceId) {
      notify.warning("Seleccioná una factura", "Elegí el comprobante que querés rectificar.");
      return;
    }
    if (!observation.trim()) {
      notify.warning("Falta el detalle", "Explicá qué dato formal se corrige.");
      return;
    }

    try {
      setSaving(true);
      await addInvoiceRectification(targetInvoiceId, observation, author);
      notify.success("Rectificación registrada", `${targetInvoiceId} conserva el comprobante original y suma la corrección al historial.`);
      setModalOpen(false);
      setSelectedId(targetInvoiceId);
    } catch (saveError) {
      console.error(saveError);
      const messages = {
        INVOICE_NOT_FOUND: "No encontramos la factura.",
        INVOICE_NOT_ISSUED: "Solo se puede rectificar una factura emitida.",
        RECTIFICATION_REQUIRED: "Ingresá el detalle de la rectificación.",
      };
      notify.error("No se pudo rectificar", messages[saveError?.message] || "Ocurrió un error al guardar la rectificación.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="fb-page">
      <div className="fb-shell">
        <header className="fb-topbar">
          <div className="fb-brand">
            <button className="fb-icon-button" type="button" onClick={() => navigate("/facturacion")}><ArrowLeft size={19} /></button>
            <div className="fb-brand-icon"><FilePenLine size={21} /></div>
            <div className="fb-brand-copy"><strong>Rectificaciones</strong><span>SERVIX · Correcciones formales auditables</span></div>
          </div>
          <div className="fb-status"><span className="fb-status-dot" />Sin alterar importes</div>
        </header>

        <section className="fb-page-head">
          <div>
            <div className="fb-kicker"><FilePenLine size={15} />Control documental</div>
            <h1>Rectificaciones</h1>
            <p>Corregí datos formales de una factura sin cambiar total, cobro ni historial económico.</p>
          </div>
          <div className="fb-actions">
            <button className="fb-button blue" type="button" onClick={() => openNew()}><Plus size={16} />Nueva rectificación</button>
          </div>
        </section>

        <section className="fb-metrics">
          <Metric label="Facturas rectificadas" value={rectified.length} hint="Con una o más correcciones" icon={FilePenLine} />
          <Metric label="Rectificaciones" value={allEvents.length} hint="Eventos registrados" icon={History} tone="violet" />
          <Metric label="Habilitadas" value={eligible.length} hint="Facturas emitidas" icon={CheckCircle2} tone="mint" />
          <Metric label="Última actividad" value={rectified[0] ? formatDate(rectified[0].fecha) : "—"} hint="Según comprobantes registrados" icon={ReceiptText} tone="amber" />
          <Metric label="Política" value="No destructiva" hint="El original se conserva" icon={History} tone="pink" />
        </section>

        <section className="fb-workspace">
          <div className="fb-workspace-head">
            <div className="fb-workspace-title"><strong>Historial de rectificaciones</strong><span>Una factura puede acumular varias correcciones formales</span></div>
            <button className="fb-button small" type="button" onClick={() => navigate("/facturacion/facturas")}><ReceiptText size={15} />Facturas</button>
          </div>

          <div className="fb-filters" style={{ gridTemplateColumns: "minmax(0,1fr) 180px 180px 130px" }}>
            <div className="fb-search"><Search size={17} /><input className="fb-input" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar factura, cliente o corrección..." /></div>
            <div />
            <div />
            <div className="fb-inline" style={{ justifyContent: "flex-end", color: "var(--fb-muted)", fontSize: ".55rem" }}>{filtered.length} resultados</div>
          </div>

          {loading ? <State icon={FilePenLine} title="Cargando rectificaciones" text="Sincronizando comprobantes..." />
            : error ? <State icon={X} title="No pudimos cargar la información" text="Revisá conexión o permisos." />
            : filtered.length === 0 ? <State icon={FilePenLine} title="Sin rectificaciones" text="Todavía no hay correcciones registradas." />
            : (
              <div className="fb-table-wrap">
                <div className="fb-table-head fb-rect-row"><div>Factura</div><div>Cliente</div><div>Cant.</div><div>Fecha factura</div><div>Total</div><div>Última corrección</div><div>Acciones</div></div>
                {filtered.map((invoice) => {
                  const events = rectificationEvents(invoice);
                  const last = events[events.length - 1];
                  return (
                    <motion.div key={invoice.id} className="fb-table-row fb-rect-row clickable" role="button" tabIndex={0} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} onClick={() => setSelectedId(invoice.id)}>
                      <div className="fb-cell"><strong>{invoice.id}</strong><span className="fb-badge violet">Rectificada</span></div>
                      <div className="fb-cell"><strong>{invoice.cliente || "Consumidor Final"}</strong><span>{invoice.doc || "C.F."}</span></div>
                      <div className="fb-money">{events.length || 1}</div>
                      <div className="fb-cell"><strong>{formatDate(invoice.fecha)}</strong><span>{invoice.hora || ""}</span></div>
                      <div className="fb-money">{formatMoney(invoice.total)}</div>
                      <div className="fb-cell"><strong>{invoice.ultimaRectificacion || last?.detalle || "Rectificación registrada"}</strong><span>{last?.fecha || invoice.rectificadoEn || "—"}</span></div>
                      <div className="fb-row-actions">
                        <button className="fb-row-button preview" type="button" title="Ver" onClick={(e) => { e.stopPropagation(); setSelectedId(invoice.id); }}><FilePenLine size={16} /></button>
                        {invoice.estado === "Emitida" && <button className="fb-row-button" type="button" title="Agregar rectificación" onClick={(e) => { e.stopPropagation(); openNew(invoice.id); }}><Plus size={16} /></button>}
                      </div>
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
              <div className="fb-brand"><button className="fb-icon-button" type="button" onClick={() => setSelectedId(null)}><ArrowLeft size={19} /></button><div className="fb-screen-title"><strong>{selected.id}</strong><span>Historial de rectificaciones</span></div></div>
              <div className="fb-toolbar-actions">
                {selected.estado === "Emitida" && <button className="fb-button soft" type="button" onClick={() => openNew(selected.id)}><Plus size={16} />Agregar rectificación</button>}
                <button className="fb-button primary" type="button" onClick={() => window.print()}><Printer size={16} />Imprimir</button>
              </div>
            </header>
            <div className="fb-screen-scroll">
              <article className="fb-document">
                <div className="fb-document-head">
                  <div className="fb-doc-brand"><div className="fb-doc-logo"><FilePenLine size={22} /></div><div><strong>SERVIX</strong><span>Informe de rectificaciones</span><span>Factura original conservada</span></div></div>
                  <div className="fb-doc-number"><span>Factura</span><strong>{selected.id}</strong><span className="fb-badge violet">{selectedEvents.length} corrección{selectedEvents.length === 1 ? "" : "es"}</span></div>
                </div>
                <div className="fb-doc-grid">
                  <Doc label="Cliente" strong={selected.cliente || "Consumidor Final"} line={selected.doc || "C.F."} />
                  <Doc label="Factura" strong={formatMoney(selected.total)} line={`${formatDate(selected.fecha)} · Estado: ${selected.estado || "Emitida"}`} />
                </div>
                <div className="fb-doc-section"><h3>Historial de rectificaciones</h3><Timeline entries={selectedEvents} /></div>
                <div className="fb-note">Las rectificaciones son internas y formales: no modifican el total, el estado de pago ni generan Nota de Crédito.</div>
              </article>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalOpen && (
          <motion.div className="fb-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className="fb-modal" initial={{ y: 14, scale: 0.98 }} animate={{ y: 0, scale: 1 }} exit={{ y: 10, scale: 0.98 }}>
              <div className="fb-modal-head"><div><strong>Nueva rectificación</strong><span>Seleccioná una factura emitida</span></div><button className="fb-icon-button" type="button" onClick={() => setModalOpen(false)}><X size={18} /></button></div>
              <div className="fb-modal-body">
                {!targetInvoiceId ? (
                  <>
                    <div className="fb-search"><Search size={17} /><input className="fb-input" value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)} placeholder="Buscar factura, cliente, DNI/CUIT..." /></div>
                    <div className="fb-picker-results">
                      {pickerResults.length ? pickerResults.map((invoice) => (
                        <button key={invoice.id} className="fb-picker-result" type="button" onClick={() => { setTargetInvoiceId(invoice.id); setPickerSearch(invoice.id); }}>
                          <div><strong>{invoice.id} · {invoice.cliente || "Consumidor Final"}</strong><span>{invoice.doc || "C.F."} · {formatMoney(invoice.total)}</span></div><span>Seleccionar</span>
                        </button>
                      )) : <div className="fb-empty" style={{ padding: 20 }}><strong>Sin coincidencias</strong><span>No encontramos facturas emitidas.</span></div>}
                    </div>
                  </>
                ) : (
                  <div className="fb-doc-box"><label>Factura seleccionada</label><strong>{targetInvoiceId}</strong><button className="fb-button small" type="button" style={{ marginTop: 8 }} onClick={() => setTargetInvoiceId("")}>Cambiar</button></div>
                )}
                <div className="fb-field" style={{ marginTop: 12 }}><label>Detalle de la rectificación *</label><textarea className="fb-textarea" value={observation} onChange={(e) => setObservation(e.target.value)} placeholder="Ej.: corrección de domicilio, CUIT, descripción o dato formal..." /></div>
                <div className="fb-note warning">No uses rectificación para modificar importes. Si cambia el valor económico corresponde resolverlo mediante el flujo de Facturas / Nota de Crédito.</div>
              </div>
              <div className="fb-modal-foot"><button className="fb-button" type="button" onClick={() => setModalOpen(false)}>Cancelar</button><button className="fb-button primary" type="button" disabled={saving} onClick={handleSave}>{saving ? "Guardando..." : "Registrar rectificación"}</button></div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function Metric({ label, value, hint, icon: Icon, tone = "" }) {
  return <article className={`fb-metric ${tone}`}><div className="fb-metric-top"><span className="fb-metric-label">{label}</span><div className="fb-metric-icon"><Icon size={18} /></div></div><strong>{value}</strong><small>{hint}</small></article>;
}
function State({ icon: Icon, title, text }) { return <div className="fb-empty"><Icon size={24} /><strong>{title}</strong><span>{text}</span></div>; }
function Doc({ label, strong, line }) { return <div className="fb-doc-box"><label>{label}</label><strong>{strong}</strong><span>{line}</span></div>; }
function Timeline({ entries }) {
  if (!entries.length) return <div className="fb-doc-box"><span>Sin eventos de rectificación.</span></div>;
  return <div className="fb-timeline">{[...entries].reverse().map((entry, index) => <div className="fb-timeline-item" key={`${entry.fecha}-${index}`}><div className="fb-timeline-icon"><History size={15} /></div><div className="fb-timeline-copy"><strong>{entry.accion || "Rectificación"}</strong><span>{entry.detalle || "Sin detalle"}</span></div><time>{entry.fecha || "—"}</time></div>)}</div>;
}
