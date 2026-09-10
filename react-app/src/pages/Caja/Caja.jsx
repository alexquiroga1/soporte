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
  CircleDollarSign,
  CreditCard,
  FileText,
  Landmark,
  MinusCircle,
  Plus,
  PlusCircle,
  QrCode,
  ReceiptText,
  Search,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  addCashMovement,
  closeCashRegister,
  getCashSummary,
  getPaymentEligibility,
  processCashPayment,
  subscribeToCashCuts,
  subscribeToCashPendings,
  subscribeToCashRegister,
} from "../../services/caja.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Caja.css";

const PAYMENT_METHODS = [
  {
    id: "Efectivo",
    label: "Efectivo",
    icon: Banknote,
  },
  {
    id: "Transferencia",
    label: "Transferencia",
    icon: Landmark,
  },
  {
    id: "Mercado Pago",
    label: "Mercado Pago",
    icon: QrCode,
  },
  {
    id: "Tarjeta",
    label: "Tarjeta",
    icon: CreditCard,
  },
  {
    id: "Saldo a Favor",
    label: "Saldo a favor",
    icon: WalletCards,
  },
  {
    id: "Préstamo personal",
    label: "Crédito",
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
  };

  return map[error?.message] || error?.message || "Ocurrió un error al procesar el cobro.";
}

export default function Caja() {
  const navigate = useNavigate();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Caja";

  const [pendings, setPendings] = useState([]);
  const [cash, setCash] = useState({ fondo: 0, movs: [], sesion: null });
  const [cuts, setCuts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
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

  const [movementForm, setMovementForm] = useState({
    concept: "",
    type: "egreso",
    amount: "",
  });
  const [savingMovement, setSavingMovement] = useState(false);

  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [newFund, setNewFund] = useState("0");
  const [closing, setClosing] = useState(false);

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

    const unsubscribeCuts = subscribeToCashCuts(
      setCuts,
      (error) => console.error(error)
    );

    return () => {
      unsubscribePendings();
      unsubscribeCash();
      unsubscribeCuts();
    };
  }, []);

  const summary = useMemo(() => getCashSummary(cash), [cash]);

  const pendingAmount = useMemo(
    () => pendings.reduce((sum, item) => sum + Number(item.total || 0), 0),
    [pendings]
  );

  const filteredPendings = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return pendings;

    return pendings.filter((item) =>
      [
        item.id,
        item.ref,
        item.cliente,
        item.concepto,
        item.origen,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [pendings, search]);

  const movements = useMemo(() => {
    const rows = Array.isArray(cash?.movs) ? [...cash.movs] : [];
    return rows.reverse();
  }, [cash]);

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

  const closePayment = () => {
    if (processingPayment) return;
    setPaymentItem(null);
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

  const handlePayment = async () => {
    if (!paymentItem || !paymentCanConfirm) return;

    try {
      setProcessingPayment(true);

      const result = await processCashPayment({
        pendingId: paymentItem.id,
        method: paymentMethod,
        details: paymentDetails,
        author,
      });

      notify.success(
        "Cobro procesado",
        `${result.invoiceId} emitida por ${formatMoney(result.total)}.`
      );

      setPaymentItem(null);
    } catch (error) {
      console.error(error);
      notify.error("No se pudo cobrar", paymentErrorMessage(error));
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleAddMovement = async () => {
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

      notify.success("Movimiento registrado", "La caja activa fue actualizada.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo registrar", error?.message || "Revisá los datos del movimiento.");
    } finally {
      setSavingMovement(false);
    }
  };

  const handleCloseCash = async () => {
    try {
      setClosing(true);

      const result = await closeCashRegister({
        newFund,
        author,
      });

      notify.success(
        "Corte cerrado",
        `${result.cutId} guardado. Nuevo fondo: ${formatMoney(result.newFund)}.`
      );

      setCloseModalOpen(false);
      setNewFund("0");
      setActiveTab("cuts");
    } catch (error) {
      console.error(error);

      notify.error(
        "No se pudo cerrar Caja",
        error?.message === "NEW_FUND_EXCEEDS_CASH"
          ? "El fondo a dejar no puede superar el efectivo esperado."
          : error?.message || "Ocurrió un error al cerrar el turno."
      );
    } finally {
      setClosing(false);
    }
  };

  return (
    <main className="cash-page">
      <header className="cash-header">
        <div className="cash-header-left">
          <button type="button" className="cash-back" onClick={() => navigate("/dashboard")}>
            <ArrowLeft size={20} />
          </button>

          <div className="cash-header-icon">
            <CircleDollarSign size={21} />
          </div>

          <div>
            <span>Administración</span>
            <h1>Caja</h1>
          </div>
        </div>

        <button
          type="button"
          className="cash-close-shift"
          onClick={() => {
            setNewFund("0");
            setCloseModalOpen(true);
          }}
        >
          <ReceiptText size={16} />
          Cerrar turno
        </button>
      </header>

      <div className="cash-content">
        <motion.section
          className="cash-intro"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div>
            <span className="cash-kicker">Operación diaria</span>
            <h2>Cobros y movimientos</h2>
            <p>
              Los tickets listos llegan acá, se cobra el medio elegido y la factura se genera automáticamente.
            </p>
          </div>

          <div className="cash-live">
            <span />
            <div>
              <strong>Caja activa</strong>
              <small>Firestore en tiempo real</small>
            </div>
          </div>
        </motion.section>

        <section className="cash-stats">
          <article>
            <WalletCards size={18} />
            <span>Pendientes</span>
            <strong>{pendings.length}</strong>
            <small>{formatMoney(pendingAmount)}</small>
          </article>

          <article>
            <PlusCircle size={18} />
            <span>Ingresos</span>
            <strong>{formatMoney(summary.income)}</strong>
            <small>Turno actual</small>
          </article>

          <article>
            <MinusCircle size={18} />
            <span>Egresos</span>
            <strong>{formatMoney(summary.expenses)}</strong>
            <small>Turno actual</small>
          </article>

          <article className="cash-stat-primary">
            <Banknote size={18} />
            <span>Efectivo esperado</span>
            <strong>{formatMoney(summary.cashExpected)}</strong>
            <small>Fondo + efectivo − egresos</small>
          </article>
        </section>

        <section className="cash-workspace">
          <div className="cash-tabs">
            <button
              type="button"
              className={activeTab === "pendings" ? "active" : ""}
              onClick={() => setActiveTab("pendings")}
            >
              <WalletCards size={16} />
              Pendientes
              <span>{pendings.length}</span>
            </button>

            <button
              type="button"
              className={activeTab === "movements" ? "active" : ""}
              onClick={() => setActiveTab("movements")}
            >
              <CircleDollarSign size={16} />
              Movimientos
            </button>

            <button
              type="button"
              className={activeTab === "cuts" ? "active" : ""}
              onClick={() => setActiveTab("cuts")}
            >
              <FileText size={16} />
              Cortes
            </button>
          </div>

          {activeTab === "pendings" && (
            <div className="cash-tab-content">
              <div className="cash-toolbar">
                <div className="cash-search">
                  <Search size={17} />
                  <input
                    type="search"
                    value={search}
                    placeholder="Buscar ticket, cliente o concepto..."
                    onChange={(event) => setSearch(event.target.value)}
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch("")}>
                      <X size={14} />
                    </button>
                  )}
                </div>
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
                  <span>Los tickets enviados a Caja aparecerán automáticamente.</span>
                </div>
              ) : (
                <div className="cash-pending-list">
                  {filteredPendings.map((item) => (
                    <motion.article layout key={item.id} className="cash-pending-card">
                      <div className="cash-pending-origin">
                        <span>{item.origen || "Operación"}</span>
                        <strong>#{item.ref || item.id}</strong>
                      </div>

                      <div className="cash-pending-main">
                        <h3>{item.cliente || "Consumidor Final"}</h3>
                        <p>{item.concepto || "Sin detalle"}</p>
                        {item.presupuestoId && <small>Presupuesto {item.presupuestoId}</small>}
                      </div>

                      <div className="cash-pending-total">
                        <span>Total</span>
                        <strong>{formatMoney(item.total)}</strong>
                      </div>

                      <button type="button" onClick={() => openPayment(item)}>
                        <CircleDollarSign size={16} />
                        Cobrar
                      </button>
                    </motion.article>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "movements" && (
            <div className="cash-tab-content cash-movements-layout">
              <section className="cash-movement-panel">
                <div className="cash-section-heading">
                  <div>
                    <span>Turno actual</span>
                    <h3>Movimientos de Caja</h3>
                  </div>
                </div>

                {movements.length === 0 ? (
                  <div className="cash-empty compact">
                    <CircleDollarSign size={26} />
                    <strong>Sin movimientos</strong>
                  </div>
                ) : (
                  <div className="cash-movement-list">
                    {movements.map((movement, index) => (
                      <article key={movement.id || `${movement.hora}-${index}`}>
                        <div className={`cash-movement-icon ${movement.tipo}`}>
                          {movement.tipo === "egreso" ? (
                            <MinusCircle size={16} />
                          ) : (
                            <PlusCircle size={16} />
                          )}
                        </div>

                        <div>
                          <strong>{movement.concepto || "Movimiento"}</strong>
                          <span>
                            {movement.hora || "—"}
                            {movement.medioPago ? ` · ${movement.medioPago}` : ""}
                          </span>
                        </div>

                        <strong className={movement.tipo === "egreso" ? "negative" : "positive"}>
                          {movement.tipo === "egreso" ? "− " : "+ "}
                          {formatMoney(movement.monto)}
                        </strong>
                      </article>
                    ))}
                  </div>
                )}
              </section>

              <aside className="cash-manual-panel">
                <div className="cash-section-heading">
                  <div>
                    <span>Manual</span>
                    <h3>Registrar movimiento</h3>
                  </div>
                </div>

                <label>
                  <span>Concepto</span>
                  <input
                    value={movementForm.concept}
                    placeholder="Ej: Compra de insumos"
                    onChange={(event) =>
                      setMovementForm((current) => ({ ...current, concept: event.target.value }))
                    }
                  />
                </label>

                <div className="cash-manual-grid">
                  <label>
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

                  <label>
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

                <button
                  type="button"
                  className="cash-manual-save"
                  disabled={savingMovement}
                  onClick={handleAddMovement}
                >
                  <Plus size={16} />
                  {savingMovement ? "Guardando..." : "Registrar movimiento"}
                </button>

                <div className="cash-summary-box">
                  <div><span>Fondo inicial</span><strong>{formatMoney(summary.fund)}</strong></div>
                  <div><span>Ingresos</span><strong>{formatMoney(summary.income)}</strong></div>
                  <div><span>Egresos</span><strong>{formatMoney(summary.expenses)}</strong></div>
                  <div className="total"><span>Efectivo esperado</span><strong>{formatMoney(summary.cashExpected)}</strong></div>
                </div>
              </aside>
            </div>
          )}

          {activeTab === "cuts" && (
            <div className="cash-tab-content">
              {cuts.length === 0 ? (
                <div className="cash-empty">
                  <FileText size={28} />
                  <strong>Sin cortes registrados</strong>
                  <span>Los cierres de turno aparecerán acá.</span>
                </div>
              ) : (
                <div className="cash-cuts-list">
                  {cuts.map((cut) => (
                    <article key={cut.id}>
                      <div className="cash-cut-icon"><ReceiptText size={17} /></div>
                      <div>
                        <strong>{cut.id}</strong>
                        <span>{formatDateTime(cut.cierre)} · {cut.usuario || "Sistema"}</span>
                      </div>
                      <div><span>Ingresos</span><strong>{formatMoney(cut.ingresos)}</strong></div>
                      <div><span>Egresos</span><strong>{formatMoney(cut.egresos)}</strong></div>
                      <div><span>Cierre</span><strong>{formatMoney(cut.efectivoEsperado)}</strong></div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {paymentItem && (
        <div className="cash-modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget) closePayment();
        }}>
          <motion.div
            className="cash-payment-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="cash-modal-heading">
              <div className="cash-modal-icon"><CircleDollarSign size={21} /></div>
              <section>
                <span>Cobro</span>
                <h3>{paymentItem.origen || "Operación"} #{paymentItem.ref || paymentItem.id}</h3>
              </section>
              <button type="button" onClick={closePayment} disabled={processingPayment}>
                <X size={18} />
              </button>
            </div>

            <div className="cash-payment-summary">
              <div><span>Cliente</span><strong>{paymentItem.cliente || "Consumidor Final"}</strong></div>
              <div><span>Concepto</span><strong>{paymentItem.concepto || "Servicio"}</strong></div>
              <div className="total"><span>Total a cobrar</span><strong>{formatMoney(paymentItem.total)}</strong></div>
            </div>

            <span className="cash-payment-label">Medio de pago</span>

            <div className="cash-payment-methods">
              {PAYMENT_METHODS.map((method) => {
                const Icon = method.icon;
                return (
                  <button
                    type="button"
                    key={method.id}
                    className={paymentMethod === method.id ? "active" : ""}
                    onClick={() => setPaymentMethod(method.id)}
                  >
                    <Icon size={17} />
                    {method.label}
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
                      autoFocus
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

            <div className="cash-modal-actions">
              <button type="button" onClick={closePayment} disabled={processingPayment}>
                Cancelar
              </button>
              <button
                type="button"
                className="primary"
                disabled={!paymentCanConfirm}
                onClick={handlePayment}
              >
                <ReceiptText size={16} />
                {processingPayment ? "Procesando..." : "Cobrar y emitir factura"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {closeModalOpen && (
        <div className="cash-modal-overlay" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !closing) setCloseModalOpen(false);
        }}>
          <motion.div
            className="cash-close-modal"
            initial={{ opacity: 0, scale: 0.97, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="cash-modal-heading">
              <div className="cash-modal-icon graphite"><ReceiptText size={20} /></div>
              <section>
                <span>Turno actual</span>
                <h3>Cerrar Caja</h3>
              </section>
              <button type="button" disabled={closing} onClick={() => setCloseModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="cash-summary-box modal">
              <div><span>Fondo inicial</span><strong>{formatMoney(summary.fund)}</strong></div>
              <div><span>Ingresos</span><strong>{formatMoney(summary.income)}</strong></div>
              <div><span>Egresos</span><strong>{formatMoney(summary.expenses)}</strong></div>
              <div className="total"><span>Efectivo esperado</span><strong>{formatMoney(summary.cashExpected)}</strong></div>
            </div>

            <label className="cash-close-field">
              <span>Fondo a dejar para el próximo turno</span>
              <input
                type="number"
                min="0"
                value={newFund}
                onChange={(event) => setNewFund(event.target.value)}
              />
            </label>

            <div className="cash-modal-actions">
              <button type="button" disabled={closing} onClick={() => setCloseModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary graphite" disabled={closing} onClick={handleCloseCash}>
                {closing ? "Cerrando..." : "Confirmar cierre"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </main>
  );
}
