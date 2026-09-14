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
  Banknote,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Eye,
  FileText,
  History,
  Landmark,
  MinusCircle,
  Plus,
  PlusCircle,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
  X,
  XCircle,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  PERMISSIONS,
} from "../../security/permissions.js";

import {
  addCashMovement,
  getCashSummary,
  getPaymentEligibility,
  processCashPayment,
  subscribeToCashCuts,
  subscribeToCashPendings,
  subscribeToCashRegister,
} from "../../services/caja.service.js";

import {
  cancelCashPending,
} from "../../services/caja-pendientes.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Caja.css";

const PAYMENT_METHODS = [
  {
    id: "Efectivo",
    label: "Efectivo",
    helper: "Cobro completo",
    icon: Banknote,
  },
  {
    id: "Transferencia",
    label: "Transferencia",
    helper: "Con referencia",
    icon: Landmark,
  },
  {
    id: "Mercado Pago",
    label: "Mercado Pago",
    helper: "QR / referencia",
    icon: QrCode,
  },
  {
    id: "Tarjeta",
    label: "Tarjeta",
    helper: "Débito / crédito",
    icon: CreditCard,
  },
  {
    id: "Saldo a Favor",
    label: "Saldo a favor",
    helper: "Usar crédito disponible",
    icon: WalletCards,
  },
  {
    id: "Préstamo personal",
    label: "Financiar",
    helper: "Generar crédito",
    icon: CalendarClock,
  },
];

function formatMoney(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getLocalISODate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function movementTimestamp(movement) {
  if (movement?.creadoEn) {
    const direct = new Date(movement.creadoEn).getTime();
    if (Number.isFinite(direct)) return direct;
  }

  const date = String(movement?.fecha || "").trim();
  const time = String(movement?.hora || "00:00").trim();
  const fallback = new Date(`${date}T${time}`).getTime();
  return Number.isFinite(fallback) ? fallback : 0;
}

function movementContext(movement) {
  const concept = String(movement?.concepto || "Movimiento");
  const legacyMatch = concept.match(/^Cobro\s+(.+?)\s+#(.+?)\s+\((.+)\)$/i);

  return {
    origin:
      movement?.origen ||
      legacyMatch?.[1] ||
      movement?.subcategoria ||
      "Caja",
    ref:
      movement?.origenRef ||
      legacyMatch?.[2] ||
      movement?.referencia ||
      "—",
    client:
      movement?.cliente ||
      legacyMatch?.[3] ||
      "—",
    concept,
  };
}

function receiptCode(movementId, fallback = "COB") {
  const clean = String(movementId || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  if (!clean) return `${fallback}-SERVIX`;
  return `${fallback}-${clean.slice(-8)}`;
}

function paymentErrorMessage(error) {
  const map = {
    CASH_PENDING_ID_REQUIRED: "No se indicó la operación a cobrar.",
    CASH_PENDING_NOT_FOUND: "La operación ya no está pendiente en Caja.",
    PAYMENT_METHOD_INVALID: "El medio de pago no es válido.",
    CASH_RECEIVED_INSUFFICIENT: "El dinero recibido no alcanza para completar el cobro.",
    PAYMENT_REFERENCE_REQUIRED: "Ingresá la referencia o número de comprobante.",
    CARD_LAST4_INVALID: "Ingresá los últimos 4 números de la tarjeta.",
    CARD_AUTH_REQUIRED: "Ingresá el número de autorización de la tarjeta.",
    PAYMENT_NOT_ELIGIBLE: error?.eligibility?.reason || "El cliente no cumple las condiciones para este medio de pago.",
    CLIENT_REQUIRED: "Este medio de pago requiere un cliente registrado.",
    CLIENT_BALANCE_INSUFFICIENT: "El saldo a favor cambió y ahora resulta insuficiente.",
    PAYMENT_TOTAL_INVALID: "La operación tiene un total inválido.",
    STOCK_INSUFFICIENT: `Stock insuficiente para ${error?.productName || "un producto"}.`,
    CREDIT_NOT_FOUND: "El crédito ya no existe.",
    CREDIT_ALREADY_PAID: "El crédito ya fue saldado.",
    PAYMENT_NOT_APPLIED: "El importe no pudo aplicarse al crédito.",
    PAYMENT_CLIENT_REQUIRED: "El crédito necesita un cliente válido para usar saldo a favor.",
    PAYMENT_CREDIT_BALANCE_INSUFFICIENT: "El saldo a favor del cliente resulta insuficiente.",
    CASH_PENDING_CREDIT_MISMATCH: "El pendiente no coincide con el crédito que se intenta cobrar.",
  };

  return map[error?.message] || error?.message || "Ocurrió un error al procesar el cobro.";
}

export default function Caja() {
  const navigate = useNavigate();
  const {
    profile,
    user,
    hasPermission,
  } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Caja";

  const [pendings, setPendings] = useState([]);
  const [cash, setCash] = useState({ fondo: 0, movs: [], sesion: null });
  const [legacyCuts, setLegacyCuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [originFilter, setOriginFilter] = useState("");
  const [movementSearch, setMovementSearch] = useState("");
  const [movementMethod, setMovementMethod] = useState("");
  const [activeTab, setActiveTab] = useState("pendings");

  const [paymentItem, setPaymentItem] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [paymentDetails, setPaymentDetails] = useState({
    received: "",
    reference: "",
    last4: "",
    authorization: "",
  });
  const [eligibility, setEligibility] = useState({ eligible: true });
  const [checkingEligibility, setCheckingEligibility] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);

  const [cancelItem, setCancelItem] = useState(null);
  const [cancellingPendingId, setCancellingPendingId] = useState(null);

  const [movementForm, setMovementForm] = useState({
    concept: "",
    type: "egreso",
    amount: "",
  });
  const [movementModalOpen, setMovementModalOpen] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);

  const [selectedMovement, setSelectedMovement] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);

  useEffect(() => {
    let pendingReady = false;
    let cashReady = false;

    const updateLoading = () => {
      if (pendingReady && cashReady) setLoading(false);
    };

    const unsubscribePendings = subscribeToCashPendings(
      (data) => {
        setPendings(data);
        pendingReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        pendingReady = true;
        updateLoading();
        notify.error("No pudimos cargar Caja", "Falló la lectura de cobros pendientes.");
      }
    );

    const unsubscribeCash = subscribeToCashRegister(
      (data) => {
        setCash(data);
        cashReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        cashReady = true;
        updateLoading();
        notify.error("No pudimos cargar Caja", "Falló la lectura de la caja activa.");
      }
    );

    // Los cortes dejan de mostrarse como módulo. Se leen únicamente para
    // conservar los movimientos históricos creados antes de este rediseño.
    const unsubscribeLegacyCuts = subscribeToCashCuts(
      setLegacyCuts,
      (error) => console.error(error)
    );

    return () => {
      unsubscribePendings();
      unsubscribeCash();
      unsubscribeLegacyCuts();
    };
  }, []);

  const summary = useMemo(() => getCashSummary(cash), [cash]);

  const canRegisterSales = hasPermission(PERMISSIONS.SALES);
  const canManageCash = hasPermission(PERMISSIONS.CASH);
  const canCancelPending = canRegisterSales;
  const canGrantCredit =
    canRegisterSales &&
    hasPermission(PERMISSIONS.CREDITS);

  const availablePaymentMethods = useMemo(
    () =>
      PAYMENT_METHODS.filter((method) => {
        if (
          paymentItem?.origen === "Crédito" &&
          method.id === "Préstamo personal"
        ) {
          return false;
        }

        return (
          method.id !== "Préstamo personal" ||
          canGrantCredit
        );
      }),
    [canGrantCredit, paymentItem]
  );

  const pendingAmount = useMemo(
    () => pendings.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [pendings]
  );

  const filteredPendings = useMemo(() => {
    const query = search.trim().toLowerCase();

    return pendings.filter((item) => {
      const text = [
        item.id,
        item.ref,
        item.cliente,
        item.concepto,
        item.origen,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatches = !query || text.includes(query);
      const originMatches = !originFilter || item.origen === originFilter;
      return searchMatches && originMatches;
    });
  }, [pendings, search, originFilter]);

  const allMovements = useMemo(() => {
    const current = (Array.isArray(cash?.movs) ? cash.movs : []).map((movement, index) => ({
      ...movement,
      _historySource: "actual",
      _rowKey: movement.id || `actual-${index}-${movement.creadoEn || movement.hora || ""}`,
    }));

    const archived = legacyCuts.flatMap((cut) =>
      (Array.isArray(cut?.movs) ? cut.movs : []).map((movement, index) => ({
        ...movement,
        _historySource: "legacy",
        _cutId: cut.id,
        _rowKey: movement.id || `${cut.id}-${index}-${movement.creadoEn || movement.hora || ""}`,
      }))
    );

    const deduped = new Map();
    [...archived, ...current].forEach((movement) => {
      const key = movement.id || movement._rowKey;
      deduped.set(key, movement);
    });

    return [...deduped.values()].sort(
      (a, b) => movementTimestamp(b) - movementTimestamp(a)
    );
  }, [cash, legacyCuts]);

  const filteredMovements = useMemo(() => {
    const query = movementSearch.trim().toLowerCase();

    return allMovements.filter((movement) => {
      const context = movementContext(movement);
      const text = [
        movement.id,
        movement.facturaId,
        movement.ventaId,
        movement.usuario,
        movement.medioPago,
        movement.referencia,
        context.origin,
        context.ref,
        context.client,
        context.concept,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const searchMatches = !query || text.includes(query);
      const methodMatches = !movementMethod || movement.medioPago === movementMethod;
      return searchMatches && methodMatches;
    });
  }, [allMovements, movementSearch, movementMethod]);

  const todayStats = useMemo(() => {
    const today = getLocalISODate();
    const todayMovements = allMovements.filter((movement) => movement.fecha === today);

    const isPaymentMovement = (movement) =>
      movement.clase === "cobro" ||
      /^Cobro\s/i.test(String(movement.concepto || ""));

    const collected = todayMovements
      .filter((movement) => movement.tipo === "ingreso" && isPaymentMovement(movement))
      .reduce((sum, movement) => sum + Number(movement.monto || 0), 0);

    const balanceUsed = todayMovements
      .filter((movement) => movement.medioPago === "Saldo a Favor")
      .reduce((sum, movement) => sum + Number(movement.monto || 0), 0);

    const financed = todayMovements
      .filter((movement) => movement.medioPago === "Préstamo personal")
      .reduce((sum, movement) => sum + Number(movement.monto || 0), 0);

    return {
      collected,
      balanceUsed,
      financed,
    };
  }, [allMovements]);

  useEffect(() => {
    if (paymentItem) {
      const stillPending = pendings.some((item) => item.id === paymentItem.id);
      if (!stillPending && !processingPayment) setPaymentItem(null);
    }
  }, [pendings, paymentItem, processingPayment]);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      if (!paymentItem) return;

      if (!["Saldo a Favor", "Préstamo personal"].includes(paymentMethod)) {
        setEligibility({ eligible: true, method: paymentMethod });
        return;
      }

      try {
        setCheckingEligibility(true);
        const result = await getPaymentEligibility(paymentItem, paymentMethod);
        if (!cancelled) setEligibility(result);
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setEligibility({
            eligible: false,
            reason: "No se pudo evaluar al cliente.",
          });
        }
      } finally {
        if (!cancelled) setCheckingEligibility(false);
      }
    }

    check();

    return () => {
      cancelled = true;
    };
  }, [paymentItem, paymentMethod]);

  const openPayment = (item) => {
    if (!canRegisterSales) {
      notify.warning(
        "Acción no habilitada",
        "Tu perfil puede consultar Caja, pero no registrar ventas y cobros."
      );
      return;
    }

    setPaymentItem(item);
    setPaymentMethod("Efectivo");
    setPaymentDetails({
      received: "",
      reference: "",
      last4: "",
      authorization: "",
    });
    setEligibility({ eligible: true });
  };

  const paymentCanConfirm = useMemo(() => {
    if (!paymentItem || processingPayment || checkingEligibility) return false;
    if (!eligibility?.eligible) return false;

    const total = Number(paymentItem.total || 0);

    if (paymentMethod === "Efectivo") {
      return Number(paymentDetails.received || 0) >= total;
    }

    if (["Transferencia", "Mercado Pago"].includes(paymentMethod)) {
      return Boolean(paymentDetails.reference.trim());
    }

    if (paymentMethod === "Tarjeta") {
      return /^\d{4}$/.test(paymentDetails.last4.trim()) &&
        Boolean(paymentDetails.authorization.trim());
    }

    return true;
  }, [
    paymentItem,
    paymentMethod,
    paymentDetails,
    eligibility,
    checkingEligibility,
    processingPayment,
  ]);

  const buildPendingReceipt = (item, overrides = {}) => ({
    kind: "cobro",
    receiptNumber: overrides.receiptNumber || "VISTA PREVIA",
    movementId: overrides.movementId || "PENDIENTE",
    operationRef: item?.ref || item?.id || "—",
    origin: item?.origen || "Operación",
    client: item?.cliente || "Consumidor Final",
    concept: item?.concepto || "Servicio",
    method: overrides.method || paymentMethod,
    total: Number(overrides.total ?? item?.total ?? 0),
    invoiceId: overrides.invoiceId || null,
    author,
    dateTime: overrides.dateTime || new Date().toISOString(),
    change: Number(overrides.change || 0),
  });

  const handlePayment = async () => {
    if (!paymentItem || !paymentCanConfirm) return;

    const itemBeingPaid = paymentItem;

    try {
      setProcessingPayment(true);

      const result = await processCashPayment({
        pendingId: itemBeingPaid.id,
        method: paymentMethod,
        details: paymentDetails,
        author,
      });

      const receipt = buildPendingReceipt(itemBeingPaid, {
        receiptNumber: receiptCode(result.movementId || result.invoiceId, "COB"),
        movementId: result.movementId || "—",
        method: result.method,
        total: result.total,
        invoiceId: result.invoiceId,
        change: result.change,
        dateTime: new Date().toISOString(),
      });

      setReceiptPreview(receipt);
      setPaymentItem(null);

      if (result.kind === "credit-payment") {
        notify.success(
          "Pago de crédito registrado",
          `${result.creditId} · ${formatMoney(result.total)} aplicado. Saldo restante: ${formatMoney(result.balance)}.`
        );
      } else {
        notify.success(
          result.paymentState === "Financiado"
            ? "Financiación registrada"
            : "Cobro procesado",
          result.paymentState === "Financiado"
            ? `${result.invoiceId} emitida y crédito ${result.creditId} generado por ${formatMoney(result.total)}.`
            : `${result.invoiceId} emitida por ${formatMoney(result.total)}.`
        );
      }
    } catch (error) {
      console.error(error);
      notify.error("No se pudo cobrar", paymentErrorMessage(error));
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCancelPending = async () => {
    const item = cancelItem;
    if (!item?.id || !canCancelPending || cancellingPendingId) return;

    try {
      setCancellingPendingId(item.id);
      await cancelCashPending(item.id, author);

      notify.success(
        "Pendiente cancelado",
        item.ticketId
          ? `El Ticket ${item.ticketId} volvió a quedar sin envío a Caja.`
          : `La operación ${item.presupuestoId || item.ref || item.id} volvió a quedar sin envío a Caja.`
      );

      if (paymentItem?.id === item.id) setPaymentItem(null);
      setCancelItem(null);
    } catch (error) {
      console.error(error);
      notify.error(
        "No se pudo cancelar",
        error?.message === "CASH_PENDING_NOT_FOUND"
          ? "La operación ya no está pendiente; probablemente fue cobrada o cancelada desde otra pantalla."
          : error?.message || "Ocurrió un error inesperado."
      );
    } finally {
      setCancellingPendingId(null);
    }
  };

  const handleAddMovement = async () => {
    if (!canManageCash) {
      notify.warning(
        "Acción no habilitada",
        "Necesitás permiso de administración de Caja para registrar movimientos manuales."
      );
      return;
    }

    try {
      setSavingMovement(true);

      await addCashMovement({
        concept: movementForm.concept,
        type: movementForm.type,
        amount: movementForm.amount,
        author,
      });

      setMovementForm({
        concept: "",
        type: "egreso",
        amount: "",
      });
      setMovementModalOpen(false);
      notify.success("Movimiento registrado", "El movimiento quedó incorporado al historial de Caja.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo registrar", error?.message || "Revisá los datos del movimiento.");
    } finally {
      setSavingMovement(false);
    }
  };

  const openMovement = (movement) => {
    setSelectedMovement(movement);
  };

  const printMovement = (movement) => {
    const context = movementContext(movement);

    setReceiptPreview({
      kind: "movimiento",
      receiptNumber: receiptCode(movement.id, "MOV"),
      movementId: movement.id || "MOV-LEGACY",
      operationRef: context.ref,
      origin: context.origin,
      client: context.client,
      concept: context.concept,
      method: movement.medioPago || "Movimiento manual",
      total: Number(movement.monto || 0) * (movement.tipo === "egreso" ? -1 : 1),
      invoiceId: movement.facturaId || null,
      author: movement.usuario || "Sistema",
      dateTime: movement.creadoEn || `${movement.fecha || ""}T${movement.hora || "00:00"}`,
      change: 0,
      movementType: movement.tipo,
      reference: movement.referencia || null,
    });
  };

  const movementNavigation = (movement) => {
    const context = movementContext(movement);
    const origin = String(context.origin || "").toLowerCase();

    if (origin.includes("ticket") && context.ref && context.ref !== "—") {
      return {
        label: "Ver ticket",
        path: `/tickets/${encodeURIComponent(context.ref)}`,
      };
    }

    if (origin.includes("presupuesto")) {
      return {
        label: "Ver presupuestos",
        path: "/facturacion/presupuestos",
      };
    }

    if (origin.includes("crédito") || origin.includes("credito")) {
      return {
        label: "Ver crédito",
        path: "/creditos",
      };
    }

    if (origin.includes("pos") || origin.includes("venta")) {
      return {
        label: "Ir a Punto de Venta",
        path: "/pos",
      };
    }

    if (movement?.facturaId) {
      return {
        label: "Ver facturas",
        path: "/facturacion/facturas",
      };
    }

    return null;
  };

  const selectedMovementNavigation = selectedMovement
    ? movementNavigation(selectedMovement)
    : null;

  return (
    <main className="cash-page">
      <div className="cash-shell">
        <header className="cash-topbar">
          <div className="cash-brand">
            <button
              type="button"
              className="cash-icon-button"
              onClick={() => navigate("/dashboard")}
              aria-label="Volver al dashboard"
            >
              <ArrowLeft size={20} />
            </button>

            <div className="cash-brand-icon">
              <CircleDollarSign size={22} />
            </div>

            <div className="cash-brand-copy">
              <strong>Caja</strong>
              <span>SERVIX · Cobros y movimientos</span>
            </div>
          </div>

          <div className="cash-top-actions">
            <div className="cash-online-status">
              <span />
              Caja operativa
            </div>

            <div className="cash-user-pill">
              <span>{String(author).slice(0, 2).toUpperCase()}</span>
              <strong>{author}</strong>
            </div>
          </div>
        </header>

        <motion.section
          className="cash-page-head"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="cash-eyebrow">
              <CircleDollarSign size={15} />
              Caja
            </span>
            <h1>Cobros</h1>
            <p>
              Gestioná pendientes, confirmá pagos y consultá movimientos con trazabilidad completa.
            </p>
          </div>

          <div className="cash-page-actions">
            <button
              type="button"
              className="cash-button soft"
              onClick={() => setActiveTab("movements")}
            >
              <History size={16} />
              Movimientos
            </button>

            <button
              type="button"
              className="cash-button mint"
              onClick={() => notify.success("Caja actualizada", "La información se sincroniza en tiempo real.")}
            >
              <RefreshCw size={16} />
              Actualizar
            </button>
          </div>
        </motion.section>

        <section className="cash-metrics">
          <article>
            <div className="cash-metric-top">
              <span>Pendientes de cobro</span>
              <div className="cash-metric-icon"><WalletCards size={18} /></div>
            </div>
            <strong>{pendings.length}</strong>
            <small>{formatMoney(pendingAmount)} por cobrar</small>
          </article>

          <article>
            <div className="cash-metric-top">
              <span>Cobrado hoy</span>
              <div className="cash-metric-icon"><Banknote size={18} /></div>
            </div>
            <strong>{formatMoney(todayStats.collected)}</strong>
            <small>Ingresos reales confirmados</small>
          </article>

          <article>
            <div className="cash-metric-top">
              <span>Saldo a favor utilizado</span>
              <div className="cash-metric-icon"><WalletCards size={18} /></div>
            </div>
            <strong>{formatMoney(todayStats.balanceUsed)}</strong>
            <small>Aplicado hoy en cobros</small>
          </article>

          <article>
            <div className="cash-metric-top">
              <span>Financiado hoy</span>
              <div className="cash-metric-icon"><CalendarClock size={18} /></div>
            </div>
            <strong>{formatMoney(todayStats.financed)}</strong>
            <small>Créditos generados desde Caja</small>
          </article>
        </section>

        <section className="cash-layout">
          <div className="cash-main-column">
            <section className="cash-card cash-center-card">
              <div className="cash-card-head cash-center-head">
                <div className="cash-card-title">
                  <div className="cash-card-title-icon"><CircleDollarSign size={18} /></div>
                  <div>
                    <strong>Centro de Caja</strong>
                    <span>Pendientes y movimientos en un mismo módulo</span>
                  </div>
                </div>

                <div className="cash-tabs">
                  <button
                    type="button"
                    className={activeTab === "pendings" ? "active" : ""}
                    onClick={() => setActiveTab("pendings")}
                  >
                    <WalletCards size={15} />
                    Pendientes
                    <b>{pendings.length}</b>
                  </button>

                  <button
                    type="button"
                    className={activeTab === "movements" ? "active" : ""}
                    onClick={() => setActiveTab("movements")}
                  >
                    <ReceiptText size={15} />
                    Movimientos
                  </button>
                </div>
              </div>

              {activeTab === "pendings" && (
                <div className="cash-card-body">
                  <div className="cash-toolbar">
                    <div className="cash-search">
                      <Search size={17} />
                      <input
                        type="search"
                        value={search}
                        placeholder="Buscar cliente, ticket, presupuesto..."
                        onChange={(event) => setSearch(event.target.value)}
                      />
                      {search && (
                        <button type="button" onClick={() => setSearch("")}>
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <select
                      value={originFilter}
                      onChange={(event) => setOriginFilter(event.target.value)}
                    >
                      <option value="">Todos los orígenes</option>
                      <option value="POS">POS</option>
                      <option value="Ticket">Ticket</option>
                      <option value="Presupuesto">Presupuesto</option>
                    </select>
                  </div>

                  {loading ? (
                    <div className="cash-empty">
                      <div className="cash-loader" />
                      <strong>Cargando Caja</strong>
                      <span>Sincronizando operaciones...</span>
                    </div>
                  ) : filteredPendings.length === 0 ? (
                    <div className="cash-empty">
                      <CheckCircle2 size={30} />
                      <strong>No hay cobros pendientes</strong>
                      <span>Los envíos desde POS, Tickets y Presupuestos aparecerán automáticamente.</span>
                    </div>
                  ) : (
                    <div className="cash-pending-list">
                      {filteredPendings.map((item) => {
                        const selected = paymentItem?.id === item.id;

                        return (
                          <motion.article
                            layout
                            key={item.id}
                            className={`cash-pending-row ${selected ? "selected" : ""}`}
                            onClick={() => openPayment(item)}
                          >
                            <div className="cash-pending-code">
                              <strong>#{item.ref || item.id}</strong>
                              <span>{item.creadoEn ? formatDateTime(item.creadoEn) : "Pendiente"}</span>
                            </div>

                            <div className="cash-pending-client">
                              <strong>{item.cliente || "Consumidor Final"}</strong>
                              <span>{item.concepto || "Sin detalle"}</span>
                            </div>

                            <span className={`cash-badge ${item.origen === "Ticket" ? "violet" : item.origen === "Presupuesto" ? "amber" : "blue"}`}>
                              {item.origen || "Operación"}
                            </span>

                            <span className="cash-badge green">Listo</span>

                            <strong className="cash-pending-amount">{formatMoney(item.total)}</strong>

                            <div className="cash-pending-row-actions">
                              {canCancelPending && (
                                <button
                                  type="button"
                                  className="cash-row-action danger"
                                  title="Cancelar pendiente"
                                  disabled={cancellingPendingId === item.id || processingPayment}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setCancelItem(item);
                                  }}
                                >
                                  <XCircle size={16} />
                                </button>
                              )}

                              <button
                                type="button"
                                className="cash-row-action"
                                title="Seleccionar"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openPayment(item);
                                }}
                              >
                                <ChevronRight size={17} />
                              </button>
                            </div>
                          </motion.article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "movements" && (
                <div className="cash-card-body">
                  <div className="cash-toolbar movements">
                    <div className="cash-search">
                      <Search size={17} />
                      <input
                        type="search"
                        value={movementSearch}
                        placeholder="Buscar movimiento, cliente, referencia..."
                        onChange={(event) => setMovementSearch(event.target.value)}
                      />
                      {movementSearch && (
                        <button type="button" onClick={() => setMovementSearch("")}>
                          <X size={14} />
                        </button>
                      )}
                    </div>

                    <select
                      value={movementMethod}
                      onChange={(event) => setMovementMethod(event.target.value)}
                    >
                      <option value="">Todos los medios</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="Tarjeta">Tarjeta</option>
                      <option value="Saldo a Favor">Saldo a favor</option>
                      <option value="Préstamo personal">Financiado</option>
                    </select>

                    <button
                      type="button"
                      className="cash-button soft compact"
                      disabled={!canManageCash}
                      title={
                        canManageCash
                          ? "Registrar movimiento manual"
                          : "Requiere permiso de administración de Caja"
                      }
                      onClick={() => setMovementModalOpen(true)}
                    >
                      <Plus size={15} />
                      Registrar movimiento
                    </button>
                  </div>

                  {filteredMovements.length === 0 ? (
                    <div className="cash-empty">
                      <ReceiptText size={28} />
                      <strong>Sin movimientos</strong>
                      <span>No encontramos movimientos con estos filtros.</span>
                    </div>
                  ) : (
                    <div className="cash-movements-table-wrap">
                      <div className="cash-movements-head">
                        <span>Movimiento</span>
                        <span>Fecha</span>
                        <span>Cliente / concepto</span>
                        <span>Medio</span>
                        <span>Estado</span>
                        <span>Importe</span>
                        <span>Acciones</span>
                      </div>

                      {filteredMovements.map((movement) => {
                        const context = movementContext(movement);
                        const isExpense = movement.tipo === "egreso";
                        const isInfo = movement.tipo === "informativo";
                        const status =
                          movement.medioPago === "Préstamo personal"
                            ? "Financiado"
                            : movement.medioPago === "Saldo a Favor"
                              ? "Saldo aplicado"
                              : isExpense
                                ? "Egreso"
                                : movement.clase === "manual"
                                  ? "Manual"
                                  : "Confirmado";

                        return (
                          <article
                            key={movement._rowKey}
                            className={`cash-movement-row ${selectedMovement?._rowKey === movement._rowKey ? "selected" : ""}`}
                            onClick={() => openMovement(movement)}
                          >
                            <div className="cash-movement-ref">
                              <strong>{movement.id || "MOV-LEGACY"}</strong>
                              <span>{context.ref}</span>
                            </div>

                            <div className="cash-movement-date">
                              <strong>{movement.fecha || "—"}</strong>
                              <span>{movement.hora || "—"}</span>
                            </div>

                            <div className="cash-movement-client">
                              <strong>{context.client !== "—" ? context.client : context.origin}</strong>
                              <span>{context.concept}</span>
                            </div>

                            <span className="cash-movement-method">{movement.medioPago || "Manual"}</span>

                            <span className={`cash-badge ${isExpense ? "red" : isInfo ? "amber" : "green"}`}>
                              {status}
                            </span>

                            <strong className={`cash-movement-amount ${isExpense ? "negative" : isInfo ? "neutral" : "positive"}`}>
                              {isExpense ? "− " : isInfo ? "" : "+ "}
                              {formatMoney(movement.monto)}
                            </strong>

                            <div className="cash-movement-actions">
                              <button
                                type="button"
                                className="cash-row-action"
                                title="Consultar movimiento"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  openMovement(movement);
                                }}
                              >
                                <Eye size={16} />
                              </button>

                              <button
                                type="button"
                                className="cash-row-action"
                                title="Imprimir movimiento"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  printMovement(movement);
                                }}
                              >
                                <Printer size={16} />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>

          <aside className="cash-side-column">
            {activeTab === "pendings" ? (
              <section className="cash-card cash-payment-panel">
                <div className="cash-card-head">
                  <div className="cash-card-title">
                    <div className="cash-card-title-icon coral"><CircleDollarSign size={18} /></div>
                    <div>
                      <strong>Cobrar operación</strong>
                      <span>{paymentItem ? `#${paymentItem.ref || paymentItem.id}` : "Seleccioná un pendiente"}</span>
                    </div>
                  </div>
                </div>

                <div className="cash-card-body">
                  {!paymentItem ? (
                    <div className="cash-side-empty">
                      <CircleDollarSign size={34} />
                      <strong>Seleccioná una operación</strong>
                      <span>Elegí un pendiente de la lista para revisar el total y registrar el cobro.</span>
                    </div>
                  ) : (
                    <>
                      <div className="cash-customer-card">
                        <div className="cash-customer-left">
                          <div className="cash-customer-avatar">
                            {String(paymentItem.cliente || "CF")
                              .split(" ")
                              .filter(Boolean)
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <strong>{paymentItem.cliente || "Consumidor Final"}</strong>
                            <span>{paymentItem.origen || "Operación"} #{paymentItem.ref || paymentItem.id}</span>
                          </div>
                        </div>

                        {eligibility?.balance !== undefined && (
                          <div className="cash-customer-balance">
                            <span>Saldo a favor</span>
                            <strong>{formatMoney(eligibility.balance)}</strong>
                          </div>
                        )}
                      </div>

                      <div className="cash-payment-summary-card">
                        <div><span>Origen</span><strong>{paymentItem.origen || "Operación"}</strong></div>
                        <div><span>Concepto</span><strong>{paymentItem.concepto || "Servicio"}</strong></div>
                        {paymentItem.descuentoPorcentaje !== undefined && Number(paymentItem.descuentoPorcentaje) > 0 && (
                          <div><span>Descuento POS</span><strong>{Number(paymentItem.descuentoPorcentaje)}%</strong></div>
                        )}
                        <div className="total"><span>Total a cobrar</span><strong>{formatMoney(paymentItem.total)}</strong></div>
                      </div>

                      <span className="cash-payment-label">Medio de pago</span>

                      <div className="cash-payment-grid">
                        {availablePaymentMethods.map((method) => {
                          const Icon = method.icon;
                          return (
                            <button
                              type="button"
                              key={method.id}
                              className={paymentMethod === method.id ? "active" : ""}
                              onClick={() => setPaymentMethod(method.id)}
                            >
                              <Icon size={19} />
                              <strong>{method.label}</strong>
                              <span>{method.helper}</span>
                            </button>
                          );
                        })}
                      </div>

                      <div className="cash-payment-dynamic">
                        {paymentMethod === "Efectivo" && (
                          <>
                            <label>
                              <span>Dinero recibido</span>
                              <input
                                type="number"
                                min="0"
                                value={paymentDetails.received}
                                placeholder="0"
                                onChange={(event) =>
                                  setPaymentDetails((current) => ({ ...current, received: event.target.value }))
                                }
                              />
                            </label>

                            <div className="cash-change">
                              <span>Vuelto</span>
                              <strong>
                                {Number(paymentDetails.received || 0) >= Number(paymentItem.total || 0)
                                  ? formatMoney(Number(paymentDetails.received || 0) - Number(paymentItem.total || 0))
                                  : "Importe insuficiente"}
                              </strong>
                            </div>
                          </>
                        )}

                        {["Transferencia", "Mercado Pago"].includes(paymentMethod) && (
                          <label>
                            <span>Comprobante / referencia</span>
                            <input
                              value={paymentDetails.reference}
                              placeholder="Ej: REF-88392011"
                              onChange={(event) =>
                                setPaymentDetails((current) => ({ ...current, reference: event.target.value }))
                              }
                            />
                          </label>
                        )}

                        {paymentMethod === "Tarjeta" && (
                          <div className="cash-card-fields">
                            <label>
                              <span>Últimos 4</span>
                              <input
                                maxLength={4}
                                value={paymentDetails.last4}
                                placeholder="4242"
                                onChange={(event) =>
                                  setPaymentDetails((current) => ({
                                    ...current,
                                    last4: event.target.value.replace(/\D/g, "").slice(0, 4),
                                  }))
                                }
                              />
                            </label>

                            <label>
                              <span>Autorización</span>
                              <input
                                value={paymentDetails.authorization}
                                placeholder="AUTH-9921"
                                onChange={(event) =>
                                  setPaymentDetails((current) => ({ ...current, authorization: event.target.value }))
                                }
                              />
                            </label>
                          </div>
                        )}

                        {["Saldo a Favor", "Préstamo personal"].includes(paymentMethod) && (
                          <div className={`cash-eligibility ${eligibility?.eligible ? "approved" : "rejected"}`}>
                            <ShieldCheck size={18} />
                            <div>
                              <strong>
                                {checkingEligibility
                                  ? "Evaluando cliente..."
                                  : eligibility?.eligible
                                    ? "Operación habilitada"
                                    : "Operación no disponible"}
                              </strong>
                              <span>{checkingEligibility ? "Consultando Firestore" : eligibility?.reason || "—"}</span>
                              {paymentMethod === "Saldo a Favor" && eligibility?.balance !== undefined && (
                                <small>Disponible: {formatMoney(eligibility.balance)}</small>
                              )}
                              {paymentMethod === "Préstamo personal" && eligibility?.available !== undefined && (
                                <small>Cupo disponible: {formatMoney(eligibility.available)}</small>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="cash-professional-note">
                        <strong>Registro trazable</strong>
                        <span>
                          Al confirmar, SERVIX genera un movimiento único con fecha, operador, origen y medio de pago. Si hay un error, se corrige con una reversión; no se borra el movimiento original.
                        </span>
                      </div>

                      <div className="cash-payment-actions">
                        <button
                          type="button"
                          className="cash-button soft"
                          onClick={() => setReceiptPreview(buildPendingReceipt(paymentItem))}
                        >
                          <Eye size={15} />
                          Previsualizar
                        </button>

                        <button
                          type="button"
                          className="cash-button"
                          onClick={() => setPaymentItem(null)}
                        >
                          Dejar pendiente
                        </button>

                        <button
                          type="button"
                          className="cash-button primary wide"
                          disabled={!paymentCanConfirm}
                          onClick={handlePayment}
                        >
                          <CheckCircle2 size={16} />
                          {processingPayment
                            ? "Procesando..."
                            : paymentMethod === "Préstamo personal"
                              ? "Financiar y emitir factura"
                              : "Confirmar cobro"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </section>
            ) : (
              <section className="cash-card cash-movement-detail-card">
                <div className="cash-card-head">
                  <div className="cash-card-title">
                    <div className="cash-card-title-icon coral"><FileText size={18} /></div>
                    <div>
                      <strong>Detalle de movimiento</strong>
                      <span>{selectedMovement?.id || "Seleccioná un movimiento"}</span>
                    </div>
                  </div>
                </div>

                <div className="cash-card-body">
                  {!selectedMovement ? (
                    <div className="cash-side-empty">
                      <History size={34} />
                      <strong>Consultá cualquier movimiento</strong>
                      <span>Podés ver el detalle, imprimirlo y volver al origen cuando esté disponible.</span>
                    </div>
                  ) : (() => {
                    const context = movementContext(selectedMovement);
                    const isExpense = selectedMovement.tipo === "egreso";

                    return (
                      <>
                        <div className="cash-movement-detail-grid">
                          <div><span>Movimiento</span><strong>{selectedMovement.id || "MOV-LEGACY"}</strong></div>
                          <div><span>Fecha / hora</span><strong>{selectedMovement.fecha || "—"} · {selectedMovement.hora || "—"}</strong></div>
                          <div><span>Origen</span><strong>{context.origin}</strong></div>
                          <div><span>Referencia</span><strong>{context.ref}</strong></div>
                          <div><span>Cliente</span><strong>{context.client}</strong></div>
                          <div><span>Medio</span><strong>{selectedMovement.medioPago || "Manual"}</strong></div>
                          <div><span>Operador</span><strong>{selectedMovement.usuario || "Sistema"}</strong></div>
                          <div><span>Factura</span><strong>{selectedMovement.facturaId || "—"}</strong></div>
                        </div>

                        <div className="cash-movement-concept-box">
                          <span>Concepto</span>
                          <strong>{context.concept}</strong>
                        </div>

                        <div className={`cash-movement-detail-total ${isExpense ? "negative" : ""}`}>
                          <span>Importe</span>
                          <strong>{isExpense ? "− " : ""}{formatMoney(selectedMovement.monto)}</strong>
                        </div>

                        <div className="cash-professional-note">
                          <strong>Historial inmutable</strong>
                          <span>
                            Este registro queda como parte de la trazabilidad de Caja. Una corrección debe generar otro movimiento de reversión, no eliminar éste.
                          </span>
                        </div>

                        <div className="cash-detail-actions">
                          {selectedMovementNavigation && (
                            <button
                              type="button"
                              className="cash-button soft"
                              onClick={() => navigate(selectedMovementNavigation.path)}
                            >
                              <ChevronRight size={15} />
                              {selectedMovementNavigation.label}
                            </button>
                          )}

                          {selectedMovement.facturaId && (
                            <button
                              type="button"
                              className="cash-button"
                              onClick={() => navigate("/facturacion/facturas")}
                            >
                              <ReceiptText size={15} />
                              Ver facturas
                            </button>
                          )}

                          <button
                            type="button"
                            className="cash-button primary wide"
                            onClick={() => printMovement(selectedMovement)}
                          >
                            <Printer size={16} />
                            Imprimir movimiento
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </section>
            )}

            <section className="cash-card cash-compact-summary">
              <div className="cash-card-body">
                <div className="cash-summary-line"><span>Fondo actual</span><strong>{formatMoney(summary.fund)}</strong></div>
                <div className="cash-summary-line"><span>Ingresos manuales / cobros</span><strong>{formatMoney(summary.income)}</strong></div>
                <div className="cash-summary-line"><span>Egresos</span><strong>{formatMoney(summary.expenses)}</strong></div>
                <div className="cash-summary-line total"><span>Efectivo esperado</span><strong>{formatMoney(summary.cashExpected)}</strong></div>
              </div>
            </section>
          </aside>
        </section>
      </div>

      {cancelItem && (
        <div
          className="cash-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !cancellingPendingId) setCancelItem(null);
          }}
        >
          <motion.div
            className="cash-modal cash-confirm-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="cash-modal-heading">
              <div className="cash-modal-icon danger"><XCircle size={20} /></div>
              <section>
                <span>Acción administrativa</span>
                <h3>Cancelar pendiente</h3>
              </section>
              <button type="button" disabled={Boolean(cancellingPendingId)} onClick={() => setCancelItem(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="cash-confirm-copy">
              <strong>{cancelItem.cliente || "Cliente"}</strong>
              <span>{cancelItem.origen || "Operación"} #{cancelItem.ref || cancelItem.id}</span>
              <b>{formatMoney(cancelItem.total)}</b>
              <p>La operación dejará de estar pendiente en Caja y volverá a su estado anterior cuando corresponda.</p>
            </div>

            <div className="cash-modal-actions">
              <button type="button" disabled={Boolean(cancellingPendingId)} onClick={() => setCancelItem(null)}>
                Volver
              </button>
              <button
                type="button"
                className="danger"
                disabled={Boolean(cancellingPendingId)}
                onClick={handleCancelPending}
              >
                {cancellingPendingId ? "Cancelando..." : "Cancelar pendiente"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {movementModalOpen && (
        <div
          className="cash-modal-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !savingMovement) setMovementModalOpen(false);
          }}
        >
          <motion.div
            className="cash-modal cash-manual-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="cash-modal-heading">
              <div className="cash-modal-icon"><PlusCircle size={20} /></div>
              <section>
                <span>Movimientos</span>
                <h3>Registrar movimiento manual</h3>
              </section>
              <button type="button" disabled={savingMovement} onClick={() => setMovementModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <label className="cash-field">
              <span>Concepto</span>
              <input
                value={movementForm.concept}
                placeholder="Ej: Compra de insumos"
                onChange={(event) =>
                  setMovementForm((current) => ({ ...current, concept: event.target.value }))
                }
              />
            </label>

            <div className="cash-field-grid">
              <label className="cash-field">
                <span>Tipo</span>
                <select
                  value={movementForm.type}
                  onChange={(event) =>
                    setMovementForm((current) => ({ ...current, type: event.target.value }))
                  }
                >
                  <option value="ingreso">Ingreso</option>
                  <option value="egreso">Egreso</option>
                </select>
              </label>

              <label className="cash-field">
                <span>Monto</span>
                <input
                  type="number"
                  min="0"
                  value={movementForm.amount}
                  placeholder="0"
                  onChange={(event) =>
                    setMovementForm((current) => ({ ...current, amount: event.target.value }))
                  }
                />
              </label>
            </div>

            <div className="cash-modal-actions">
              <button type="button" disabled={savingMovement} onClick={() => setMovementModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingMovement} onClick={handleAddMovement}>
                <Plus size={15} />
                {savingMovement ? "Guardando..." : "Registrar movimiento"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {receiptPreview && (
        <div className="cash-modal-overlay cash-receipt-overlay">
          <motion.div
            className="cash-modal cash-receipt-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="cash-modal-heading no-print">
              <div className="cash-modal-icon graphite"><ReceiptText size={20} /></div>
              <section>
                <span>{receiptPreview.kind === "movimiento" ? "Movimiento" : "Cobro"}</span>
                <h3>{receiptPreview.kind === "movimiento" ? "Comprobante de movimiento" : "Comprobante de cobro"}</h3>
              </section>
              <button type="button" onClick={() => setReceiptPreview(null)}>
                <X size={18} />
              </button>
            </div>

            <div className="cash-print-sheet" id="cash-print-sheet">
              <div className="cash-receipt-brand">
                <strong>ALEX SOPORTE TÉCNICO</strong>
                <span>Comprobante interno SERVIX</span>
                <b>{receiptPreview.receiptNumber}</b>
              </div>

              <div className="cash-receipt-grid">
                <div><span>Fecha</span><strong>{formatDateTime(receiptPreview.dateTime)}</strong></div>
                <div><span>Cliente</span><strong>{receiptPreview.client}</strong></div>
                <div><span>Origen</span><strong>{receiptPreview.origin} · {receiptPreview.operationRef}</strong></div>
                <div><span>Movimiento</span><strong>{receiptPreview.movementId || "—"}</strong></div>
                <div><span>Medio</span><strong>{receiptPreview.method || "—"}</strong></div>
                <div><span>Operador</span><strong>{receiptPreview.author || "Sistema"}</strong></div>
                {receiptPreview.invoiceId && (
                  <div><span>Factura</span><strong>{receiptPreview.invoiceId}</strong></div>
                )}
                {receiptPreview.reference && (
                  <div><span>Referencia</span><strong>{receiptPreview.reference}</strong></div>
                )}
              </div>

              <div className="cash-receipt-concept">
                <span>Concepto</span>
                <strong>{receiptPreview.concept}</strong>
              </div>

              <div className={`cash-receipt-total ${Number(receiptPreview.total) < 0 ? "negative" : ""}`}>
                <span>{receiptPreview.kind === "movimiento" ? "Importe" : "Total cobrado"}</span>
                <strong>{formatMoney(receiptPreview.total)}</strong>
              </div>

              {receiptPreview.change > 0 && (
                <div className="cash-receipt-change">
                  <span>Vuelto</span>
                  <strong>{formatMoney(receiptPreview.change)}</strong>
                </div>
              )}

              <p className="cash-receipt-note">
                Comprobante interno SERVIX. No reemplaza una factura o comprobante fiscal.
                El registro queda guardado en Caja y puede consultarse o reimprimirse posteriormente.
              </p>
            </div>

            <div className="cash-modal-actions no-print">
              {receiptPreview.invoiceId && (
                <button type="button" onClick={() => navigate("/facturacion/facturas")}>
                  <ReceiptText size={15} />
                  Ver facturas
                </button>
              )}
              <button type="button" onClick={() => setReceiptPreview(null)}>
                Cerrar
              </button>
              <button type="button" className="primary" onClick={() => window.print()}>
                <Printer size={16} />
                Imprimir comprobante
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
