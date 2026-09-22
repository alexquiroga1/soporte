import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  CalendarDays,
  Download,
  FileText,
  History,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import {
  normalizeInvoiceItems,
  subscribeToInvoices,
} from "../../services/facturas.service.js";
import { notify } from "../../services/notifications.js";

import "./FacturacionSuite.css";

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";
  const text = String(value);
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  return text;
}

function eventDate(event) {
  return event?.fecha || "—";
}

function csvEscape(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

export default function NotasCredito() {
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
        notify.error(
          "No pudimos cargar las Notas de Crédito",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  const creditNotes = useMemo(
    () => documents.filter((document) => document.tipo === "Nota de Crédito"),
    [documents]
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();

    return creditNotes.filter((note) => {
      const haystack = [
        note.id,
        note.cliente,
        note.doc,
        note.facturaOrigenId,
        note.refId,
        note.motivo,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !term || haystack.includes(term);
      const matchesStatus = !statusFilter || String(note.estadoPago || note.estado || "") === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [creditNotes, search, statusFilter]);

  const selected = useMemo(
    () => creditNotes.find((note) => note.id === selectedId) || null,
    [creditNotes, selectedId]
  );

  const metrics = useMemo(() => {
    const totalIssued = creditNotes.reduce((sum, note) => sum + Number(note.total || 0), 0);
    const credited = creditNotes.reduce(
      (sum, note) => sum + Number(note.montoAcreditado ?? note.total ?? 0),
      0
    );
    const withReason = creditNotes.filter((note) => String(note.motivo || "").trim()).length;

    return {
      count: creditNotes.length,
      totalIssued,
      credited,
      withReason,
      linked: creditNotes.filter((note) => note.facturaOrigenId || note.refId).length,
    };
  }, [creditNotes]);

  const exportCsv = () => {
    const rows = [
      ["Nota", "Fecha", "Cliente", "Documento", "Factura origen", "Total", "Acreditado", "Estado", "Motivo"],
      ...filtered.map((note) => [
        note.id,
        formatDate(note.fecha),
        note.cliente || "",
        note.doc || "",
        note.facturaOrigenId || note.refId || "",
        Number(note.total || 0),
        Number(note.montoAcreditado ?? note.total ?? 0),
        note.estadoPago || note.estado || "",
        note.motivo || "",
      ]),
    ];

    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
    const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "servix-notas-credito.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const items = selected ? normalizeInvoiceItems(selected) : [];

  return (
    <main className="fb-page">
      <div className="fb-shell">
        <header className="fb-topbar">
          <div className="fb-brand">
            <button className="fb-icon-button" type="button" onClick={() => navigate("/facturacion")}>
              <ArrowLeft size={19} />
            </button>
            <div className="fb-brand-icon"><RotateCcw size={21} /></div>
            <div className="fb-brand-copy">
              <strong>Notas de Crédito</strong>
              <span>SERVIX · Devoluciones y anulaciones documentadas</span>
            </div>
          </div>
          <div className="fb-status"><span className="fb-status-dot" />Trazabilidad activa</div>
        </header>

        <section className="fb-page-head">
          <div>
            <div className="fb-kicker"><RotateCcw size={15} />Documentos compensatorios</div>
            <h1>Notas de Crédito</h1>
            <p>Consultá cada crédito emitido, su factura de origen y el importe realmente acreditado.</p>
          </div>
          <div className="fb-actions">
            <button className="fb-button soft" type="button" onClick={exportCsv}>
              <Download size={16} />Exportar CSV
            </button>
            <button className="fb-button" type="button" onClick={() => navigate("/facturacion/facturas")}>
              <ReceiptText size={16} />Ir a Facturas
            </button>
          </div>
        </section>

        <section className="fb-metrics">
          <Metric label="Notas emitidas" value={metrics.count} hint="Documentos registrados" icon={RotateCcw} />
          <Metric label="Importe documentado" value={formatMoney(metrics.totalIssued)} hint="Total nominal de NC" icon={FileText} tone="violet" />
          <Metric label="Saldo acreditado" value={formatMoney(metrics.credited)} hint="Importe realmente reconocido" icon={WalletCards} tone="mint" />
          <Metric label="Con motivo" value={metrics.withReason} hint="NC con justificación registrada" icon={History} tone="amber" />
          <Metric label="Vinculadas" value={metrics.linked} hint="Con factura de origen" icon={ReceiptText} tone="pink" />
        </section>

        <section className="fb-workspace">
          <div className="fb-workspace-head">
            <div className="fb-workspace-title">
              <strong>Registro de Notas de Crédito</strong>
              <span>Documento original conservado · sin borrado destructivo</span>
            </div>
          </div>

          <div className="fb-filters" style={{ gridTemplateColumns: "minmax(0,1fr) 190px 160px 160px" }}>
            <div className="fb-search">
              <Search size={17} />
              <input
                className="fb-input"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar NC, cliente, factura o motivo..."
              />
            </div>
            <select className="fb-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">Todos los estados</option>
              <option value="Aplicada">Aplicada</option>
              <option value="Emitida">Emitida</option>
            </select>
            <div />
            <div className="fb-inline" style={{ justifyContent: "flex-end", color: "var(--fb-muted)", fontSize: ".55rem" }}>
              {filtered.length} resultados
            </div>
          </div>

          {loading ? (
            <StateBox icon={RotateCcw} title="Cargando Notas de Crédito" text="Sincronizando documentos..." />
          ) : error ? (
            <StateBox icon={X} title="No pudimos cargar los documentos" text="Revisá permisos o conexión." className="fb-error" />
          ) : filtered.length === 0 ? (
            <StateBox icon={RotateCcw} title="Sin Notas de Crédito" text="No hay documentos que coincidan con los filtros." />
          ) : (
            <div className="fb-table-wrap">
              <div className="fb-table-head fb-nc-row">
                <div>Nota</div><div>Cliente</div><div>Factura origen</div><div>Total NC</div><div>Acreditado</div><div>Fecha</div><div>Acciones</div>
              </div>
              {filtered.map((note) => (
                <motion.div
                  key={note.id}
                  className="fb-table-row fb-nc-row clickable"
                  role="button"
                  tabIndex={0}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => setSelectedId(note.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") setSelectedId(note.id);
                  }}
                >
                  <div className="fb-cell"><strong>{note.id}</strong><span>{note.estadoPago || note.estado || "Aplicada"}</span></div>
                  <div className="fb-cell"><strong>{note.cliente || "Consumidor Final"}</strong><span>{note.doc || "C.F."}</span></div>
                  <div className="fb-cell"><strong>{note.facturaOrigenId || note.refId || "—"}</strong><span>Factura</span></div>
                  <div className="fb-money">{formatMoney(note.total)}</div>
                  <div className="fb-money">{formatMoney(note.montoAcreditado ?? note.total)}</div>
                  <div className="fb-cell"><strong>{formatDate(note.fecha)}</strong><span>{note.hora || ""}</span></div>
                  <div className="fb-row-actions">
                    <button className="fb-row-button preview" type="button" title="Ver detalle" onClick={(event) => { event.stopPropagation(); setSelectedId(note.id); }}>
                      <FileText size={16} />
                    </button>
                    <button className="fb-row-button" type="button" title="Imprimir" onClick={(event) => { event.stopPropagation(); setSelectedId(note.id); setTimeout(() => window.print(), 120); }}>
                      <Printer size={16} />
                    </button>
                  </div>
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
              <div className="fb-brand">
                <button className="fb-icon-button" type="button" onClick={() => setSelectedId(null)}><ArrowLeft size={19} /></button>
                <div className="fb-screen-title"><strong>Nota de Crédito {selected.id}</strong><span>Detalle completo y auditable</span></div>
              </div>
              <div className="fb-toolbar-actions">
                <button className="fb-button soft" type="button" onClick={() => navigate("/facturacion/facturas")}><ReceiptText size={16} />Ver Facturas</button>
                <button className="fb-button primary" type="button" onClick={() => window.print()}><Printer size={16} />Imprimir</button>
              </div>
            </header>

            <div className="fb-screen-scroll">
              <article className="fb-document">
                <div className="fb-document-head">
                  <div className="fb-doc-brand">
                    <div className="fb-doc-logo"><RotateCcw size={22} /></div>
                    <div><strong>SERVIX</strong><span>Nota de Crédito interna</span><span>Documento compensatorio</span></div>
                  </div>
                  <div className="fb-doc-number"><span>Nota de Crédito</span><strong>{selected.id}</strong><span className="fb-badge violet">{selected.estadoPago || selected.estado || "Aplicada"}</span></div>
                </div>

                <div className="fb-doc-grid">
                  <DocBox label="Cliente" strong={selected.cliente || "Consumidor Final"} lines={[selected.doc || "C.F.", `Cliente ID: ${selected.clienteId || "—"}`]} />
                  <DocBox label="Origen" strong={selected.facturaOrigenId || selected.refId || "—"} lines={[`Fecha: ${formatDate(selected.fecha)}`, `Medio original: ${selected.refPago || "—"}`]} />
                  <DocBox label="Importe nominal" strong={formatMoney(selected.total)} lines={["Total documentado por la NC"]} />
                  <DocBox label="Importe acreditado" strong={formatMoney(selected.montoAcreditado ?? selected.total)} lines={["Saldo efectivamente reconocido al cliente"]} />
                </div>

                <div className="fb-doc-section">
                  <h3>Conceptos</h3>
                  <div className="fb-doc-table">
                    <div className="fb-doc-table-head"><div>Descripción</div><div>Cant.</div><div className="fb-right">Unitario</div><div className="fb-right">Subtotal</div></div>
                    {items.length ? items.map((item, index) => (
                      <div className="fb-doc-table-row" key={`${item.description}-${index}`}>
                        <div><strong>{item.description}</strong></div><div>{item.quantity}</div><div className="fb-right">{formatMoney(item.price)}</div><div className="fb-right">{formatMoney(item.subtotal)}</div>
                      </div>
                    )) : (
                      <div className="fb-doc-table-row"><div><strong>Sin detalle de ítems</strong><small>Registro legacy o documento resumido.</small></div><div>—</div><div className="fb-right">—</div><div className="fb-right">{formatMoney(selected.total)}</div></div>
                    )}
                  </div>
                  <div className="fb-doc-totals">
                    <div className="fb-doc-total grand"><span>Total Nota de Crédito</span><strong>{formatMoney(selected.total)}</strong></div>
                  </div>
                </div>

                <div className="fb-doc-section">
                  <h3>Motivo</h3>
                  <div className="fb-doc-box"><strong>{selected.motivo || "Sin motivo adicional informado"}</strong></div>
                </div>

                <div className="fb-doc-section">
                  <h3>Historial</h3>
                  <Timeline entries={selected.historial} />
                </div>
              </article>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

function Metric({ label, value, hint, icon: Icon, tone = "" }) {
  return (
    <article className={`fb-metric ${tone}`}>
      <div className="fb-metric-top"><span className="fb-metric-label">{label}</span><div className="fb-metric-icon"><Icon size={18} /></div></div>
      <strong>{value}</strong><small>{hint}</small>
    </article>
  );
}

function StateBox({ icon: Icon, title, text, className = "fb-empty" }) {
  return <div className={className}><Icon size={24} /><strong>{title}</strong><span>{text}</span></div>;
}

function DocBox({ label, strong, lines = [] }) {
  return <div className="fb-doc-box"><label>{label}</label><strong>{strong}</strong>{lines.map((line) => <span key={line}>{line}</span>)}</div>;
}

function Timeline({ entries }) {
  const list = Array.isArray(entries) ? [...entries].reverse() : [];
  if (!list.length) return <div className="fb-doc-box"><span>Sin eventos históricos adicionales.</span></div>;

  return (
    <div className="fb-timeline">
      {list.map((entry, index) => (
        <div className="fb-timeline-item" key={`${eventDate(entry)}-${index}`}>
          <div className="fb-timeline-icon"><History size={15} /></div>
          <div className="fb-timeline-copy"><strong>{entry.accion || "Evento"}</strong><span>{entry.detalle || "Sin detalle"}</span></div>
          <time>{entry.fecha || "—"}</time>
        </div>
      ))}
    </div>
  );
}
