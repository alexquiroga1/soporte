import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  AnimatePresence,
  motion,
} from "motion/react";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  Banknote,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  Download,
  FilePenLine,
  FileText,
  History,
  Landmark,
  Link2,
  Printer,
  ReceiptText,
  RotateCcw,
  Search,
  Share2,
  Ticket,
  UserRound,
  WalletCards,
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
  addInvoiceRectification,
} from "../../services/rectificaciones.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Facturas.css";

/* =========================================
   HELPERS
========================================= */

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const text = String(value);
  const parts = text.split("-");

  if (parts.length === 3 && parts[0].length === 4) {
    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }

  return text;
}

function normalizeDate(value) {
  if (!value) return null;

  if (value?.toDate instanceof Function) {
    return value.toDate();
  }

  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00`)
    : new Date(text);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isCurrentMonth(value) {
  const date = normalizeDate(value);
  if (!date) return false;

  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

function getInvoiceDocumentStatus(invoice) {
  if (invoice?.estado === "Anulada") {
    return {
      label: "Anulada",
      className: "invoice-badge-danger",
    };
  }

  if (invoice?.estado === "Cancelada") {
    return {
      label: "Cancelada",
      className: "invoice-badge-danger",
    };
  }

  if (
    invoice?.estado === "Rectificada" ||
    invoice?.rectificadoEn ||
    invoice?.ultimaRectificacion
  ) {
    return {
      label: "Rectificada",
      className: "invoice-badge-violet",
    };
  }

  if (invoice?.estado === "Emitida") {
    return {
      label: "Emitida",
      className: "invoice-badge-success",
    };
  }

  return {
    label: invoice?.estado || "Sin estado",
    className: "invoice-badge-neutral",
  };
}

function getPaymentStatus(invoice) {
  const state = String(invoice?.estadoPago || "").trim();

  switch (state) {
    case "Pagado Total":
    case "Pagado":
      return {
        label: "Pagada",
        className: "invoice-badge-success",
      };

    case "Pago Parcial":
      return {
        label: "Pago parcial",
        className: "invoice-badge-warning",
      };

    case "Financiado":
      return {
        label: "Financiada",
        className: "invoice-badge-violet",
      };

    case "Pendiente":
      return {
        label: "Pendiente",
        className: "invoice-badge-warning",
      };

    case "Anulado":
    case "Cancelado":
      return {
        label: "Revertida",
        className: "invoice-badge-neutral",
      };

    default:
      return {
        label: state || "—",
        className: "invoice-badge-neutral",
      };
  }
}

function isInvoicePaid(invoice) {
  return [
    "Pagado Total",
    "Pagado",
  ].includes(invoice?.estadoPago);
}

function isInvoicePartiallyPaid(invoice) {
  return invoice?.estadoPago === "Pago Parcial";
}

function getCollectedAmount(invoice) {
  if (Number.isFinite(Number(invoice?.montoCobrado))) {
    return Math.max(0, Number(invoice.montoCobrado));
  }

  return isInvoicePaid(invoice)
    ? Math.max(0, Number(invoice?.total || 0))
    : 0;
}

function getPendingAmount(invoice) {
  if (Number.isFinite(Number(invoice?.saldoPendiente))) {
    return Math.max(0, Number(invoice.saldoPendiente));
  }

  const total = Math.max(0, Number(invoice?.total || 0));
  return Math.max(0, total - getCollectedAmount(invoice));
}

function getOriginLabel(invoice) {
  return String(invoice?.refModulo || "Caja").trim() || "Caja";
}

function getOriginClass(invoice) {
  const source = getOriginLabel(invoice).toLowerCase();

  if (source.includes("ticket")) return "invoice-origin-ticket";
  if (source.includes("presupuesto")) return "invoice-origin-budget";
  if (source.includes("pos") || source.includes("venta")) {
    return "invoice-origin-pos";
  }

  return "invoice-origin-neutral";
}

function getPaymentDetail(invoice) {
  const details = invoice?.detallesPago || {};

  if (details.referencia) {
    return `Ref. ${details.referencia}`;
  }

  if (details.ultimos4) {
    return `Terminación ${details.ultimos4}${
      details.autorizacion ? ` · Aut. ${details.autorizacion}` : ""
    }`;
  }

  if (Number(details.recibido) > 0) {
    return `Recibido ${formatMoney(details.recibido)} · Vuelto ${formatMoney(
      details.vuelto || 0
    )}`;
  }

  return "";
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function getInvoiceSortTime(invoice) {
  const date = normalizeDate(
    invoice?.creadoEn || invoice?.fecha || invoice?.actualizadoEn
  );

  return date?.getTime() || 0;
}

/* =========================================
   COMPONENTE
========================================= */

export default function Facturas() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [activeTab, setActiveTab] = useState("invoices");
  const [search, setSearch] = useState("");
  const [documentStatusFilter, setDocumentStatusFilter] = useState("");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("");
  const [sortMode, setSortMode] = useState("recent");

  const [previewInvoiceId, setPreviewInvoiceId] = useState(null);
  const [printAfterOpen, setPrintAfterOpen] = useState(false);

  const [operationModal, setOperationModal] = useState(null);
  const [operationReason, setOperationReason] = useState("");
  const [processing, setProcessing] = useState(false);

  /* =======================================
     FIREBASE
  ======================================= */

  useEffect(() => {
    setLoading(true);

    const unsubscribe = subscribeToInvoices(
      (data) => {
        setDocuments(data);
        setError(null);
        setLoading(false);
      },
      (firebaseError) => {
        console.error(firebaseError);
        setError(firebaseError);
        setLoading(false);

        notify.error(
          "No pudimos cargar las facturas",
          "Revisá la conexión o los permisos de Firestore."
        );
      }
    );

    return () => unsubscribe();
  }, []);

  /* =======================================
     DOCUMENTOS
  ======================================= */

  const invoices = useMemo(
    () =>
      documents.filter(
        (document) => !document.tipo || document.tipo === "Factura"
      ),
    [documents]
  );

  const creditNotes = useMemo(
    () =>
      documents.filter(
        (document) => document.tipo === "Nota de Crédito"
      ),
    [documents]
  );

  const previewInvoice = useMemo(
    () =>
      invoices.find((invoice) => invoice.id === previewInvoiceId) || null,
    [invoices, previewInvoiceId]
  );

  const linkedCreditNotes = useMemo(() => {
    if (!previewInvoice) return [];

    return creditNotes.filter(
      (note) =>
        note.facturaOrigenId === previewInvoice.id ||
        (note.refModulo === "Factura" && note.refId === previewInvoice.id)
    );
  }, [creditNotes, previewInvoice]);

  /* =======================================
     FILTROS / ORDEN
  ======================================= */

  const filteredInvoices = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = invoices.filter((invoice) => {
      const documentStatus = getInvoiceDocumentStatus(invoice).label;
      const paymentStatus = getPaymentStatus(invoice).label;

      const searchable = [
        invoice.id,
        invoice.numero,
        invoice.cliente,
        invoice.doc,
        invoice.refModulo,
        invoice.refId,
        invoice.refPago,
        invoice.ventaId,
        invoice.presupuestoId,
        invoice.creditoId,
        documentStatus,
        paymentStatus,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchable.includes(query)) &&
        (!documentStatusFilter || documentStatus === documentStatusFilter) &&
        (!paymentStatusFilter || paymentStatus === paymentStatusFilter)
      );
    });

    return [...filtered].sort((a, b) => {
      if (sortMode === "oldest") {
        return getInvoiceSortTime(a) - getInvoiceSortTime(b);
      }

      if (sortMode === "amount") {
        return Number(b.total || 0) - Number(a.total || 0);
      }

      return getInvoiceSortTime(b) - getInvoiceSortTime(a);
    });
  }, [
    invoices,
    search,
    documentStatusFilter,
    paymentStatusFilter,
    sortMode,
  ]);

  /* =======================================
     MÉTRICAS
  ======================================= */

  const metrics = useMemo(() => {
    const monthInvoices = invoices.filter((invoice) => isCurrentMonth(invoice.fecha));
    const validMonthInvoices = monthInvoices.filter(
      (invoice) => !["Anulada", "Cancelada"].includes(invoice.estado)
    );
    const monthCreditNotes = creditNotes.filter((note) => isCurrentMonth(note.fecha));

    return {
      issuedThisMonth: validMonthInvoices.length,
      billedThisMonth: validMonthInvoices.reduce(
        (total, invoice) => total + Number(invoice.total || 0),
        0
      ),
      pendingCollection: invoices
        .filter((invoice) => !["Anulada", "Cancelada"].includes(invoice.estado))
        .reduce((total, invoice) => total + getPendingAmount(invoice), 0),
      creditNotesAmount: monthCreditNotes.reduce(
        (total, note) => total + Number(note.total || 0),
        0
      ),
      rectified: invoices.filter(
        (invoice) =>
          Boolean(invoice.rectificadoEn || invoice.ultimaRectificacion) ||
          invoice.estado === "Rectificada"
      ).length,
    };
  }, [invoices, creditNotes]);

  /* =======================================
     VISTA COMPLETA
  ======================================= */

  const openInvoice = (invoice, shouldPrint = false) => {
    if (!invoice?.id) return;

    setPreviewInvoiceId(invoice.id);
    setPrintAfterOpen(Boolean(shouldPrint));
  };

  const closeInvoice = () => {
    setPreviewInvoiceId(null);
    setPrintAfterOpen(false);
  };

  useEffect(() => {
    if (!previewInvoice || !printAfterOpen) return;

    const timer = window.setTimeout(() => {
      window.print();
      setPrintAfterOpen(false);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [previewInvoice, printAfterOpen]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === "Escape" && previewInvoiceId) {
        closeInvoice();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [previewInvoiceId]);

  /* =======================================
     COMPARTIR
  ======================================= */

  const shareInvoice = async (invoice) => {
    if (!invoice) return;

    const text = [
      `Factura ${invoice.id}`,
      invoice.cliente ? `Cliente: ${invoice.cliente}` : "",
      `Total: ${formatMoney(invoice.total)}`,
      `Fecha: ${formatDate(invoice.fecha)}`,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Factura ${invoice.id}`,
          text,
        });

        return;
      }

      await navigator.clipboard.writeText(text);
      notify.success("Datos copiados", "La factura quedó lista para compartir.");
    } catch (shareError) {
      if (shareError?.name === "AbortError") return;

      console.error(shareError);
      notify.error("No se pudo compartir", "Copiá los datos manualmente.");
    }
  };

  /* =======================================
     EXPORTAR CSV
  ======================================= */

  const exportInvoices = () => {
    if (!filteredInvoices.length) {
      notify.info("Sin datos para exportar", "No hay facturas con los filtros actuales.");
      return;
    }

    const rows = [
      [
        "Factura",
        "Fecha",
        "Cliente",
        "Documento",
        "Origen",
        "Referencia",
        "Estado documento",
        "Estado cobro",
        "Medio de pago",
        "Total",
        "Cobrado",
        "Saldo pendiente",
      ],
      ...filteredInvoices.map((invoice) => [
        invoice.id,
        invoice.fecha || "",
        invoice.cliente || "Consumidor Final",
        invoice.doc || "C.F.",
        getOriginLabel(invoice),
        invoice.refId || "",
        getInvoiceDocumentStatus(invoice).label,
        getPaymentStatus(invoice).label,
        invoice.refPago || "",
        Number(invoice.total || 0),
        getCollectedAmount(invoice),
        getPendingAmount(invoice),
      ]),
    ];

    const csv = rows
      .map((row) => row.map(csvCell).join(";"))
      .join("\n");

    const blob = new Blob(["\uFEFF", csv], {
      type: "text/csv;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `SERVIX_facturas_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);

    notify.success(
      "Facturas exportadas",
      `${filteredInvoices.length} comprobante${filteredInvoices.length === 1 ? "" : "s"} incluidos.`
    );
  };

  /* =======================================
     OPERACIONES
  ======================================= */

  const openRectification = (invoice) => {
    setOperationReason("");
    setOperationModal({ type: "rectify", invoice });
  };

  const openAnnul = (invoice) => {
    setOperationReason("");
    setOperationModal({ type: "annul", invoice });
  };

  const openCancel = (invoice) => {
    setOperationReason("");
    setOperationModal({ type: "cancel", invoice });
  };

  const closeOperation = () => {
    if (processing) return;

    setOperationModal(null);
    setOperationReason("");
  };

  const confirmInvoiceOperation = async () => {
    const invoice = operationModal?.invoice;
    const type = operationModal?.type;

    if (!invoice || !type) return;

    if (type === "rectify" && !operationReason.trim()) {
      notify.warning(
        "Falta el detalle",
        "Explicá qué se rectifica antes de confirmar."
      );
      return;
    }

    try {
      setProcessing(true);

      if (type === "rectify") {
        await addInvoiceRectification(invoice.id, operationReason, author);

        notify.success(
          "Rectificación registrada",
          `${invoice.id} conserva el documento original y suma la observación al historial.`
        );
      }

      if (type === "annul") {
        const result = await annulInvoice(invoice.id, operationReason, author);

        notify.success(
          "Factura anulada",
          result.balanceCredited
            ? `${result.creditNoteId} generada por ${formatMoney(
                result.amount
              )}. ${formatMoney(
                result.refundableAmount
              )} acreditados como saldo a favor.`
            : `${result.creditNoteId} generada. No había un importe cobrado y cliente vinculado para acreditar saldo.`
        );

        if (previewInvoiceId === invoice.id) {
          closeInvoice();
        }
      }

      if (type === "cancel") {
        await cancelInvoice(invoice.id, operationReason, author);

        notify.success(
          "Factura cancelada",
          `${invoice.id} fue cancelada sin generar movimiento de dinero.`
        );

        if (previewInvoiceId === invoice.id) {
          closeInvoice();
        }
      }

      setOperationModal(null);
      setOperationReason("");
    } catch (operationError) {
      console.error(operationError);

      const code = operationError?.message;

      const messages = {
        RECTIFICATION_REQUIRED:
          "Ingresá el detalle de la rectificación.",
        INVOICE_ALREADY_CREDITED:
          "Esta factura ya tiene una Nota de Crédito asociada.",
        INVOICE_ALREADY_CLOSED:
          "La factura ya se encuentra cerrada.",
        INVOICE_NOT_PAID:
          "Esta factura no está pagada. En ese caso corresponde cancelarla.",
        INVOICE_IS_PAID:
          "Esta factura ya fue pagada. Debe anularse mediante Nota de Crédito.",
        INVOICE_PARTIALLY_PAID:
          "La financiación ya tiene pagos aplicados. Debe anularse mediante Nota de Crédito, no cancelarse.",
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
        messages[code] || code || "Ocurrió un error al procesar el comprobante."
      );
    } finally {
      setProcessing(false);
    }
  };

  /* =======================================
     RENDER
  ======================================= */

  return (
    <main className="invoices-page">
      <header className="invoices-header">
        <div className="invoices-brand">
          <button
            type="button"
            className="invoices-back"
            onClick={() => navigate("/facturacion")}
            title="Volver a Facturación"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="invoices-brand-icon">
            <ReceiptText size={20} />
          </div>

          <div>
            <strong>Facturas</strong>
            <span>SERVIX · Facturación / Documentos emitidos</span>
          </div>
        </div>

        <div className="invoices-header-actions">
          <div className="invoices-sync">
            <i />
            <span>Sincronizado</span>
          </div>

          <div className="invoices-user-pill">
            <div>{String(author).slice(0, 2).toUpperCase()}</div>
            <strong>{author}</strong>
          </div>
        </div>
      </header>

      <div className="invoices-shell">
        <section className="invoices-hero">
          <div>
            <span className="invoices-kicker">
              <Landmark size={14} />
              Gestión documental
            </span>
            <h1>Facturas</h1>
            <p>
              Emisión, cobro, rectificación y Notas de Crédito con trazabilidad completa.
            </p>
          </div>

          <div className="invoices-hero-actions">
            <button type="button" className="invoice-btn soft" onClick={exportInvoices}>
              <Download size={16} />
              Exportar
            </button>

            <button
              type="button"
              className="invoice-btn primary"
              onClick={() => navigate("/caja")}
            >
              <CircleDollarSign size={16} />
              Emitir desde Caja
            </button>
          </div>
        </section>

        <section className="invoices-metrics">
          <MetricCard
            label="Emitidas este mes"
            value={metrics.issuedThisMonth}
            note="Documentos vigentes"
            icon={<ReceiptText size={17} />}
            tone="blue"
          />

          <MetricCard
            label="Facturación del mes"
            value={formatMoney(metrics.billedThisMonth)}
            note="Total bruto vigente"
            icon={<CircleDollarSign size={17} />}
            tone="mint"
          />

          <MetricCard
            label="Pendiente de cobro"
            value={formatMoney(metrics.pendingCollection)}
            note="Parcial, financiado o pendiente"
            icon={<WalletCards size={17} />}
            tone="amber"
          />

          <MetricCard
            label="Notas de Crédito"
            value={formatMoney(metrics.creditNotesAmount)}
            note="Aplicadas este mes"
            icon={<RotateCcw size={17} />}
            tone="violet"
          />

          <MetricCard
            label="Rectificadas"
            value={metrics.rectified}
            note="Con observaciones registradas"
            icon={<FilePenLine size={17} />}
            tone="pink"
          />
        </section>

        <section className="invoices-workspace">
          <div className="invoices-workspace-top">
            <div className="invoice-tabs">
              <button
                type="button"
                className={activeTab === "invoices" ? "active" : ""}
                onClick={() => setActiveTab("invoices")}
              >
                <ReceiptText size={16} />
                Facturas
              </button>

              <button
                type="button"
                className={activeTab === "credit-notes" ? "active" : ""}
                onClick={() => setActiveTab("credit-notes")}
              >
                <RotateCcw size={16} />
                Notas de Crédito
              </button>
            </div>

            <button
              type="button"
              className="invoice-btn compact"
              onClick={() => navigate("/facturacion/historial")}
            >
              <History size={15} />
              Auditoría
            </button>
          </div>

          {activeTab === "invoices" ? (
            <>
              <div className="invoice-filters">
                <label className="invoice-search">
                  <Search size={17} />
                  <input
                    type="search"
                    placeholder="Buscar factura, cliente, DNI/CUIT, Ticket, POS..."
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button
                      type="button"
                      onClick={() => setSearch("")}
                      aria-label="Limpiar búsqueda"
                    >
                      <X size={14} />
                    </button>
                  )}
                </label>

                <select
                  value={documentStatusFilter}
                  onChange={(event) => setDocumentStatusFilter(event.target.value)}
                >
                  <option value="">Estado del documento</option>
                  <option value="Emitida">Emitida</option>
                  <option value="Rectificada">Rectificada</option>
                  <option value="Anulada">Anulada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>

                <select
                  value={paymentStatusFilter}
                  onChange={(event) => setPaymentStatusFilter(event.target.value)}
                >
                  <option value="">Estado de cobro</option>
                  <option value="Pagada">Pagada</option>
                  <option value="Pago parcial">Pago parcial</option>
                  <option value="Financiada">Financiada</option>
                  <option value="Pendiente">Pendiente</option>
                  <option value="Revertida">Revertida</option>
                </select>

                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value)}
                >
                  <option value="recent">Más recientes</option>
                  <option value="oldest">Más antiguas</option>
                  <option value="amount">Mayor importe</option>
                </select>
              </div>

              <InvoiceTable
                invoices={filteredInvoices}
                loading={loading}
                error={error}
                onOpen={openInvoice}
                onRectify={openRectification}
                onAnnul={openAnnul}
                onCancel={openCancel}
              />
            </>
          ) : (
            <CreditNotesPanel
              notes={creditNotes}
              invoices={invoices}
              onOpenInvoice={openInvoice}
              onOpenModule={() => navigate("/facturacion/notas-credito")}
            />
          )}
        </section>
      </div>

      <AnimatePresence>
        {previewInvoice && (
          <InvoiceFullscreen
            key={previewInvoice.id}
            invoice={previewInvoice}
            linkedCreditNotes={linkedCreditNotes}
            onClose={closeInvoice}
            onShare={shareInvoice}
            onRectify={openRectification}
            onAnnul={openAnnul}
            onCancel={openCancel}
            onOpenTicket={(ticketId) => navigate(`/tickets/${ticketId}`)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {operationModal && (
          <InvoiceOperationModal
            key={`${operationModal.type}-${operationModal.invoice.id}`}
            operation={operationModal}
            reason={operationReason}
            processing={processing}
            onReasonChange={setOperationReason}
            onClose={closeOperation}
            onConfirm={confirmInvoiceOperation}
          />
        )}
      </AnimatePresence>
    </main>
  );
}

/* =========================================
   METRIC CARD
========================================= */

function MetricCard({ label, value, note, icon, tone }) {
  return (
    <motion.article
      className={`invoice-metric tone-${tone}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      whileHover={{ y: -3 }}
    >
      <div>
        <span>{label}</span>
        <div className="invoice-metric-icon">{icon}</div>
      </div>
      <strong>{value}</strong>
      <small>{note}</small>
    </motion.article>
  );
}

/* =========================================
   TABLA
========================================= */

function InvoiceTable({
  invoices,
  loading,
  error,
  onOpen,
  onRectify,
  onAnnul,
  onCancel,
}) {
  if (loading) {
    return (
      <div className="invoice-list-state">
        <div className="invoice-loader" />
        <strong>Cargando facturas</strong>
        <span>Sincronizando con Firestore...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="invoice-list-state error">
        <AlertTriangle size={25} />
        <strong>No pudimos cargar las facturas</strong>
        <span>Revisá la conexión y los permisos de Firestore.</span>
      </div>
    );
  }

  if (!invoices.length) {
    return (
      <div className="invoice-list-state">
        <ReceiptText size={27} />
        <strong>Sin resultados</strong>
        <span>No encontramos facturas con los filtros actuales.</span>
      </div>
    );
  }

  return (
    <div className="invoice-table-scroll">
      <div className="invoice-table-head">
        <div>Factura</div>
        <div>Cliente</div>
        <div>Origen</div>
        <div>Documento</div>
        <div>Cobro</div>
        <div>Fecha</div>
        <div>Total</div>
        <div>Acciones</div>
      </div>

      <div className="invoice-table-body">
        {invoices.map((invoice, index) => {
          const documentStatus = getInvoiceDocumentStatus(invoice);
          const paymentStatus = getPaymentStatus(invoice);
          const canOperate = invoice.estado === "Emitida";
          const paid = isInvoicePaid(invoice);
          const partiallyPaid = isInvoicePartiallyPaid(invoice);

          return (
            <motion.div
              key={invoice.id}
              className="invoice-table-row"
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.025, 0.16) }}
              onClick={() => onOpen(invoice)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onOpen(invoice);
                }
              }}
            >
              <div className="invoice-number-cell">
                <strong>{invoice.numero || invoice.id}</strong>
                <span>{invoice.tipo || "Factura"} SERVIX</span>
              </div>

              <div className="invoice-client-cell">
                <strong>{invoice.cliente || "Consumidor Final"}</strong>
                <span>{invoice.doc || "C.F."}</span>
              </div>

              <div>
                <span className={`invoice-origin ${getOriginClass(invoice)}`}>
                  {getOriginLabel(invoice)}
                </span>
              </div>

              <div>
                <span className={`invoice-badge ${documentStatus.className}`}>
                  {documentStatus.label}
                </span>
              </div>

              <div>
                <span className={`invoice-badge ${paymentStatus.className}`}>
                  {paymentStatus.label}
                </span>
              </div>

              <div className="invoice-date-cell">{formatDate(invoice.fecha)}</div>

              <div className="invoice-money-cell">{formatMoney(invoice.total)}</div>

              <div className="invoice-row-actions">
                <button
                  type="button"
                  className="preview"
                  title="Ver factura"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(invoice);
                  }}
                >
                  <FileText size={15} />
                </button>

                <button
                  type="button"
                  title="Imprimir"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpen(invoice, true);
                  }}
                >
                  <Printer size={15} />
                </button>

                {canOperate && (
                  <button
                    type="button"
                    title="Rectificar"
                    onClick={(event) => {
                      event.stopPropagation();
                      onRectify(invoice);
                    }}
                  >
                    <FilePenLine size={15} />
                  </button>
                )}

                {canOperate && (paid || partiallyPaid) && (
                  <button
                    type="button"
                    className="danger"
                    title="Anular y generar Nota de Crédito"
                    onClick={(event) => {
                      event.stopPropagation();
                      onAnnul(invoice);
                    }}
                  >
                    <RotateCcw size={15} />
                  </button>
                )}

                {canOperate && !paid && !partiallyPaid && (
                  <button
                    type="button"
                    className="warning"
                    title="Cancelar comprobante"
                    onClick={(event) => {
                      event.stopPropagation();
                      onCancel(invoice);
                    }}
                  >
                    <XCircle size={15} />
                  </button>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================================
   NOTAS DE CRÉDITO
========================================= */

function CreditNotesPanel({ notes, invoices, onOpenInvoice, onOpenModule }) {
  const sortedNotes = useMemo(
    () => [...notes].sort((a, b) => getInvoiceSortTime(b) - getInvoiceSortTime(a)),
    [notes]
  );

  return (
    <div className="credit-notes-panel">
      <div className="credit-notes-heading">
        <div>
          <strong>Notas de Crédito</strong>
          <span>
            Documentos de anulación y devolución vinculados a las facturas originales.
          </span>
        </div>

        <button type="button" className="invoice-btn compact" onClick={onOpenModule}>
          <Link2 size={15} />
          Abrir módulo completo
        </button>
      </div>

      {!sortedNotes.length ? (
        <div className="invoice-list-state">
          <RotateCcw size={27} />
          <strong>Sin Notas de Crédito</strong>
          <span>Todavía no hay documentos asociados.</span>
        </div>
      ) : (
        <div className="credit-note-grid">
          {sortedNotes.map((note, index) => {
            const originId = note.facturaOrigenId || note.refId;
            const originInvoice = invoices.find((invoice) => invoice.id === originId);
            const credited = Number(note.montoAcreditado || 0);

            return (
              <motion.article
                key={note.id}
                className="credit-note-card"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(index * 0.035, 0.2) }}
              >
                <div className="credit-note-card-top">
                  <div>
                    <strong>{note.id}</strong>
                    <span>{formatDate(note.fecha)}</span>
                  </div>
                  <span className="invoice-badge invoice-badge-violet">
                    {note.estadoPago || note.estado || "Aplicada"}
                  </span>
                </div>

                <p>
                  {note.motivo ||
                    `Nota de Crédito vinculada a ${originId || "una factura"}.`}
                </p>

                <div className="credit-note-data">
                  <div>
                    <span>Factura origen</span>
                    <strong>{originId || "—"}</strong>
                  </div>
                  <div>
                    <span>Importe NC</span>
                    <strong>{formatMoney(note.total)}</strong>
                  </div>
                  <div>
                    <span>Cliente</span>
                    <strong>{note.cliente || "Consumidor Final"}</strong>
                  </div>
                  <div>
                    <span>Saldo acreditado</span>
                    <strong>{formatMoney(credited)}</strong>
                  </div>
                </div>

                {originInvoice && (
                  <button
                    type="button"
                    className="credit-note-origin-button"
                    onClick={() => onOpenInvoice(originInvoice)}
                  >
                    <FileText size={14} />
                    Ver factura origen
                  </button>
                )}
              </motion.article>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================================
   FULLSCREEN
========================================= */

function InvoiceFullscreen({
  invoice,
  linkedCreditNotes,
  onClose,
  onShare,
  onRectify,
  onAnnul,
  onCancel,
  onOpenTicket,
}) {
  const documentStatus = getInvoiceDocumentStatus(invoice);
  const paymentStatus = getPaymentStatus(invoice);
  const items = normalizeInvoiceItems(invoice);
  const history = Array.isArray(invoice.historial)
    ? [...invoice.historial].reverse()
    : [];

  const collected = getCollectedAmount(invoice);
  const pending = getPendingAmount(invoice);
  const paymentDetail = getPaymentDetail(invoice);

  const canOperate = invoice.estado === "Emitida";
  const paid = isInvoicePaid(invoice);
  const partiallyPaid = isInvoicePartiallyPaid(invoice);
  const isTicket =
    getOriginLabel(invoice).toLowerCase().includes("ticket") &&
    invoice.refId &&
    invoice.refId !== "—";

  return (
    <motion.section
      className="invoice-fullscreen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.18 }}
    >
      <header className="invoice-fullscreen-toolbar no-print">
        <div className="invoice-fullscreen-toolbar-left">
          <button type="button" className="invoices-back" onClick={onClose}>
            <ArrowLeft size={20} />
          </button>

          <div>
            <strong>Detalle de factura</strong>
            <span>Documento completo · trazabilidad SERVIX</span>
          </div>
        </div>

        <div className="invoice-fullscreen-toolbar-actions">
          <button
            type="button"
            className="invoice-btn soft"
            onClick={() => onShare(invoice)}
          >
            <Share2 size={16} />
            Compartir
          </button>

          <button
            type="button"
            className="invoice-btn primary"
            onClick={() => window.print()}
          >
            <Printer size={16} />
            Imprimir
          </button>
        </div>
      </header>

      <div className="invoice-fullscreen-scroll">
        <motion.article
          className="invoice-document"
          initial={{ opacity: 0, y: 14, scale: 0.988 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="invoice-document-head">
            <div className="invoice-company">
              <div className="invoice-company-logo">
                <ReceiptText size={24} />
              </div>

              <div>
                <strong>SERVIX</strong>
                <span>Servicio técnico · Soluciones informáticas</span>
                <span>Comprobante interno de operación</span>
              </div>
            </div>

            <div className="invoice-document-number">
              <span>Factura</span>
              <strong>{invoice.numero || invoice.id}</strong>
              <span className={`invoice-badge ${documentStatus.className}`}>
                {documentStatus.label}
              </span>
            </div>
          </div>

          <div className="invoice-document-info-grid">
            <section className="invoice-document-box">
              <label>Cliente</label>
              <strong>{invoice.cliente || "Consumidor Final"}</strong>
              <span>{invoice.doc || "C.F."}</span>
              <span>
                Origen: {getOriginLabel(invoice)}
                {invoice.refId && invoice.refId !== "—" ? ` · ${invoice.refId}` : ""}
              </span>
            </section>

            <section className="invoice-document-box">
              <label>Información</label>
              <strong>Fecha: {formatDate(invoice.fecha)}</strong>
              <span>Cobro: {paymentStatus.label}</span>
              <span>Medio: {invoice.refPago || "—"}</span>
              {paymentDetail && <span>{paymentDetail}</span>}
            </section>
          </div>

          <section className="invoice-payment-summary">
            <div>
              <WalletCards size={17} />
              <span>Estado de cobro</span>
              <strong>{paymentStatus.label}</strong>
            </div>
            <div>
              <Banknote size={17} />
              <span>Cobrado</span>
              <strong>{formatMoney(collected)}</strong>
            </div>
            <div>
              <BadgeDollarSign size={17} />
              <span>Saldo pendiente</span>
              <strong>{formatMoney(pending)}</strong>
            </div>
          </section>

          <div className="invoice-document-table">
            <div className="invoice-document-table-head">
              <div>Descripción</div>
              <div>Cant.</div>
              <div className="align-right">Unitario</div>
              <div className="align-right">Subtotal</div>
            </div>

            {items.length ? (
              items.map((item, index) => (
                <div
                  className="invoice-document-item"
                  key={`${item.description}-${index}`}
                >
                  <div>
                    <strong>{item.description}</strong>
                    {item.sku && <small>SKU {item.sku}</small>}
                  </div>
                  <div>{item.quantity}</div>
                  <div className="align-right">{formatMoney(item.price)}</div>
                  <div className="align-right">{formatMoney(item.subtotal)}</div>
                </div>
              ))
            ) : (
              <div className="invoice-document-item">
                <div>
                  <strong>Sin conceptos detallados</strong>
                  <small>Comprobante migrado o registro histórico.</small>
                </div>
                <div>—</div>
                <div className="align-right">—</div>
                <div className="align-right">{formatMoney(invoice.total)}</div>
              </div>
            )}
          </div>

          <div className="invoice-document-totals">
            <div>
              <span>Total</span>
              <strong>{formatMoney(invoice.total)}</strong>
            </div>
          </div>

          <section className="invoice-traceability">
            <div className="invoice-document-section-head">
              <div>
                <Link2 size={16} />
                <strong>Trazabilidad</strong>
              </div>
              <span>Referencias reales de la operación</span>
            </div>

            <div className="invoice-trace-grid">
              <TraceItem label="Origen" value={getOriginLabel(invoice)} />
              <TraceItem label="Referencia" value={invoice.refId || "—"} />
              <TraceItem label="Venta" value={invoice.ventaId || "—"} />
              <TraceItem label="Presupuesto" value={invoice.presupuestoId || "—"} />
              <TraceItem label="Crédito" value={invoice.creditoId || "—"} />
              <TraceItem label="Usuario" value={invoice.usuario || "Sistema"} />
            </div>

            {isTicket && (
              <button
                type="button"
                className="invoice-open-origin no-print"
                onClick={() => onOpenTicket(invoice.refId)}
              >
                <Ticket size={15} />
                Abrir Ticket {invoice.refId}
              </button>
            )}
          </section>

          {linkedCreditNotes.length > 0 && (
            <section className="invoice-linked-documents">
              <div className="invoice-document-section-head">
                <div>
                  <RotateCcw size={16} />
                  <strong>Notas de Crédito asociadas</strong>
                </div>
                <span>{linkedCreditNotes.length} documento(s)</span>
              </div>

              <div className="invoice-linked-list">
                {linkedCreditNotes.map((note) => (
                  <article key={note.id}>
                    <div>
                      <strong>{note.id}</strong>
                      <span>{formatDate(note.fecha)} · {note.estadoPago || note.estado || "Aplicada"}</span>
                    </div>
                    <strong>{formatMoney(note.total)}</strong>
                  </article>
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section className="invoice-history-section">
              <div className="invoice-document-section-head">
                <div>
                  <History size={16} />
                  <strong>Auditoría</strong>
                </div>
                <span>Últimos movimientos del documento</span>
              </div>

              <div className="invoice-history-list">
                {history.slice(0, 8).map((event, index) => (
                  <article key={`${event.fecha || "event"}-${index}`}>
                    <i />
                    <div>
                      <div>
                        <strong>{event.accion || "Actividad"}</strong>
                        <span>{event.fecha || "—"}</span>
                      </div>
                      {event.detalle && <p>{event.detalle}</p>}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          <div className="invoice-document-note">
            Este documento es un comprobante interno SERVIX. El estado del documento y el estado del cobro se administran por separado. Las anulaciones se conservan mediante Nota de Crédito; el documento original nunca se elimina del historial.
          </div>

          {canOperate && (
            <section className="invoice-document-actions no-print">
              <button
                type="button"
                className="invoice-btn soft"
                onClick={() => onRectify(invoice)}
              >
                <FilePenLine size={16} />
                Rectificar
              </button>

              {paid || partiallyPaid ? (
                <button
                  type="button"
                  className="invoice-btn danger"
                  onClick={() => onAnnul(invoice)}
                >
                  <RotateCcw size={16} />
                  {partiallyPaid
                    ? "Anular financiación y generar NC"
                    : "Anular y generar NC"}
                </button>
              ) : (
                <button
                  type="button"
                  className="invoice-btn warning"
                  onClick={() => onCancel(invoice)}
                >
                  <XCircle size={16} />
                  Cancelar comprobante
                </button>
              )}
            </section>
          )}
        </motion.article>
      </div>
    </motion.section>
  );
}

function TraceItem({ label, value }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

/* =========================================
   MODAL OPERACIÓN
========================================= */

function InvoiceOperationModal({
  operation,
  reason,
  processing,
  onReasonChange,
  onClose,
  onConfirm,
}) {
  const { type, invoice } = operation;

  const partiallyPaid = isInvoicePartiallyPaid(invoice);
  const title =
    type === "rectify"
      ? "Rectificar factura"
      : type === "annul"
        ? "Generar Nota de Crédito"
        : "Cancelar comprobante";

  const description =
    type === "rectify"
      ? "La factura original se conserva. La observación queda registrada en su historial sin alterar el total ni el estado del cobro."
      : type === "annul"
        ? partiallyPaid
          ? "Se generará una Nota de Crédito por el total. Solo el importe realmente cobrado se acreditará como saldo a favor y el saldo financiado pendiente quedará cancelado."
          : "Se generará una Nota de Crédito por el total de la factura. Si corresponde, el importe cobrado quedará como saldo a favor del cliente."
        : "El comprobante se cancelará sin movimiento de dinero. Esta acción solo corresponde cuando todavía no hubo cobro.";

  const Icon =
    type === "rectify"
      ? FilePenLine
      : type === "annul"
        ? RotateCcw
        : XCircle;

  return (
    <motion.div
      className="invoice-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !processing) {
          onClose();
        }
      }}
    >
      <motion.div
        className={`invoice-modal invoice-modal-${type}`}
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 6 }}
        transition={{ duration: 0.18 }}
      >
        <div className="invoice-modal-icon">
          <Icon size={22} />
        </div>

        <div className="invoice-modal-copy">
          <span>{invoice.id}</span>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        <div className="invoice-modal-summary">
          <div>
            <span>Total factura</span>
            <strong>{formatMoney(invoice.total)}</strong>
          </div>
          <div>
            <span>Cobrado</span>
            <strong>{formatMoney(getCollectedAmount(invoice))}</strong>
          </div>
          <div>
            <span>Saldo pendiente</span>
            <strong>{formatMoney(getPendingAmount(invoice))}</strong>
          </div>
        </div>

        <label className="invoice-modal-field">
          <span>{type === "rectify" ? "Detalle de la rectificación *" : "Motivo"}</span>
          <textarea
            rows={4}
            value={reason}
            disabled={processing}
            placeholder={
              type === "rectify"
                ? "Ej.: corregir razón social, aclarar descripción, registrar ajuste administrativo..."
                : "Ej.: devolución del equipo, error de carga, operación cancelada..."
            }
            onChange={(event) => onReasonChange(event.target.value)}
          />
        </label>

        {type === "annul" && (
          <div className="invoice-modal-alert danger">
            <AlertTriangle size={16} />
            <span>
              La Nota de Crédito no borra el cobro de Caja. SERVIX conserva la trazabilidad y acredita únicamente el importe que corresponda.
            </span>
          </div>
        )}

        {type === "cancel" && (
          <div className="invoice-modal-alert warning">
            <AlertTriangle size={16} />
            <span>
              Si hubo un cobro o pagos de una financiación, la operación debe resolverse mediante Nota de Crédito.
            </span>
          </div>
        )}

        <div className="invoice-modal-actions">
          <button type="button" disabled={processing} onClick={onClose}>
            Volver
          </button>

          <button
            type="button"
            className={type === "annul" ? "danger" : type === "cancel" ? "warning" : "primary"}
            disabled={processing || (type === "rectify" && !reason.trim())}
            onClick={onConfirm}
          >
            {processing
              ? "Procesando..."
              : type === "rectify"
                ? "Registrar rectificación"
                : type === "annul"
                  ? "Generar Nota de Crédito"
                  : "Cancelar comprobante"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
