import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  motion,
} from "motion/react";

import {
  AlertTriangle,
  ArrowLeft,
  BadgeDollarSign,
  CalendarClock,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Gauge,
  HandCoins,
  History,
  MessageSquareText,
  PhoneCall,
  Plus,
  Printer,
  RefreshCcw,
  Search,
  Settings,
  ShieldAlert,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";

import {
  useAuth,
} from "../../context/AuthContext.jsx";

import {
  COLLECTION_ACTION_TYPES,
  CREDIT_PAYMENT_METHODS,
  DEFAULT_CREDIT_SETTINGS,
  addCollectionAction,
  addPaymentPromise,
  createCredit,
  evaluateClientCredit,
  getCreditFinancials,
  getCreditStatus,
  registerCreditPayment,
  refinanceClientCredits,
  saveCreditSettings,
  simulateCreditPlans,
  subscribeToCreditClients,
  subscribeToCreditSettings,
  subscribeToCredits,
  updateCreditLimit,
} from "../../services/creditos.service.js";

import {
  notify,
} from "../../services/notifications.js";

import "./Creditos.css";

const FILTERS = [
  ["active", "Cartera activa"],
  ["current", "Al corriente"],
  ["overdue", "En mora"],
  ["paid", "Saldados"],
  ["refinanced", "Refinanciados"],
  ["all", "Todos"],
];

const EMPTY_CREDIT = {
  clientId: "",
  concept: "Otorgamiento de Crédito",
  capital: "",
  advance: "0",
  interest: "0",
  firstDueDate: "",
  installments: "",
  authorization: "",
  overrideRisk: false,
  advanceMethod: "Efectivo",
};

const EMPTY_PAYMENT = {
  amount: "",
  method: "Efectivo",
  forgiveLateFees: false,
};

const EMPTY_MANAGEMENT = {
  type: "Llamada",
  note: "",
};

const EMPTY_PROMISE = {
  date: "",
  amount: "",
  note: "",
};

const EMPTY_REFINANCE = {
  interest: "0",
  installments: "3",
  firstDueDate: "",
  authorization: "",
};

function formatMoney(value) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 0,
    }
  ).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "—";

  const text = String(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    const [year, month, day] = text.slice(0, 10).split("-");
    return `${day}/${month}/${year}`;
  }

  return text;
}

function getClientName(client) {
  return (
    client?.razonSocial ||
    `${client?.nombre || ""} ${client?.apellido || ""}`.trim() ||
    "Cliente"
  );
}

function getClientDocument(client) {
  return client?.cuit || client?.dni || client?.doc || "—";
}

function statusClass(status) {
  return `credit-status credit-status-${status?.tone || "neutral"}`;
}

function errorMessage(error) {
  const map = {
    CREDIT_CLIENT_REQUIRED: "Seleccioná un cliente.",
    CREDIT_AMOUNT_INVALID: "Ingresá un monto válido.",
    CREDIT_ADVANCE_INVALID: "El anticipo debe ser menor al monto solicitado.",
    CREDIT_LIMIT_EXCEEDED: `Cupo insuficiente. Disponible: ${formatMoney(error?.available)}.`,
    CREDIT_CLIENT_BLOCKED: `El cliente registra ${error?.daysLate || 0} días de mora. Requiere una autorización de excepción.`,
    CREDIT_AUTHORIZATION_REQUIRED: "Indicá quién autoriza la excepción.",
    CREDIT_NOT_FOUND: "La carpeta ya no existe.",
    CREDIT_ALREADY_PAID: "El crédito ya está saldado.",
    PAYMENT_AMOUNT_INVALID: "Ingresá un importe de cobro válido.",
    PAYMENT_METHOD_INVALID: "Seleccioná un medio de pago válido.",
    PAYMENT_NOT_APPLIED: "No quedó deuda disponible para imputar el pago.",
    PAYMENT_CLIENT_REQUIRED: "No se pudo identificar al cliente para usar saldo a favor.",
    PAYMENT_CREDIT_BALANCE_INSUFFICIENT: `Saldo a favor insuficiente. Disponible: ${formatMoney(error?.available)}.`,
    COLLECTION_NOTE_REQUIRED: "Ingresá el detalle de la gestión.",
    PROMISE_DATE_REQUIRED: "Seleccioná una fecha para la promesa.",
    PROMISE_AMOUNT_INVALID: "Ingresá el importe prometido.",
    CREDIT_NO_ACTIVE_DEBT: "El cliente no tiene deuda activa para refinanciar.",
  };

  return map[error?.message] || error?.message || "Ocurrió un error inesperado.";
}

function openPrintable(title, body) {
  const win = window.open("", "", "width=900,height=760");

  if (!win) {
    notify.error("Impresión", "El navegador bloqueó la ventana de impresión.");
    return;
  }

  win.document.write(`
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body{font-family:Arial,sans-serif;padding:34px;color:#111827}
          h1,h2,h3{margin:0 0 10px}
          p{line-height:1.45}
          table{width:100%;border-collapse:collapse;margin-top:18px}
          th,td{border:1px solid #d1d5db;padding:8px;font-size:12px;text-align:left}
          th{background:#f3f4f6}
          .box{border:1px solid #111827;padding:14px;margin:14px 0}
          .muted{color:#6b7280}
          .sign{margin-top:70px;display:flex;justify-content:space-between;gap:30px}
          .sign div{width:45%;text-align:center;border-top:1px solid #111827;padding-top:7px}
        </style>
      </head>
      <body>
        ${body}
        <script>window.onload=()=>window.print()</script>
      </body>
    </html>
  `);

  win.document.close();
}

export default function Creditos() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, user } = useAuth();

  const author =
    profile?.nombre ||
    profile?.name ||
    user?.email ||
    "Sistema";

  const isAdmin =
    (profile?.rol || profile?.role || "") === "Administrador";

  const [credits, setCredits] = useState([]);
  const [clients, setClients] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_CREDIT_SETTINGS);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("active");

  const [selectedCreditId, setSelectedCreditId] = useState(null);
  const [detailTab, setDetailTab] = useState("installments");
  const [initialCreditConsumed, setInitialCreditConsumed] = useState(false);

  const [creditOpen, setCreditOpen] = useState(false);
  const [creditForm, setCreditForm] = useState(EMPTY_CREDIT);
  const [savingCredit, setSavingCredit] = useState(false);

  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT);
  const [savingPayment, setSavingPayment] = useState(false);

  const [managementOpen, setManagementOpen] = useState(false);
  const [managementForm, setManagementForm] = useState(EMPTY_MANAGEMENT);
  const [savingManagement, setSavingManagement] = useState(false);

  const [promiseOpen, setPromiseOpen] = useState(false);
  const [promiseForm, setPromiseForm] = useState(EMPTY_PROMISE);
  const [savingPromise, setSavingPromise] = useState(false);

  const [refinanceOpen, setRefinanceOpen] = useState(false);
  const [refinanceForm, setRefinanceForm] = useState(EMPTY_REFINANCE);
  const [savingRefinance, setSavingRefinance] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState(DEFAULT_CREDIT_SETTINGS);
  const [savingSettings, setSavingSettings] = useState(false);

  const [limitValue, setLimitValue] = useState("");
  const [savingLimit, setSavingLimit] = useState(false);

  useEffect(() => {
    let creditsReady = false;
    let clientsReady = false;
    let settingsReady = false;

    const updateLoading = () => {
      if (creditsReady && clientsReady && settingsReady) {
        setLoading(false);
      }
    };

    const unsubCredits = subscribeToCredits(
      (rows) => {
        setCredits(rows);
        creditsReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        creditsReady = true;
        updateLoading();
        notify.error("Créditos", "No se pudieron cargar las carpetas.");
      }
    );

    const unsubClients = subscribeToCreditClients(
      (rows) => {
        setClients(rows);
        clientsReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        clientsReady = true;
        updateLoading();
        notify.error("Créditos", "No se pudieron cargar los clientes.");
      }
    );

    const unsubSettings = subscribeToCreditSettings(
      (data) => {
        setSettings(data);
        setSettingsForm(data);
        settingsReady = true;
        updateLoading();
      },
      (error) => {
        console.error(error);
        settingsReady = true;
        updateLoading();
      }
    );

    return () => {
      unsubCredits();
      unsubClients();
      unsubSettings();
    };
  }, []);

  /* =======================================
     CRÉDITO ABIERTO DESDE CLIENTES
  ======================================= */

  const requestedCreditId =
    location.state?.creditId ||
    null;

  const returnTo =
    location.state?.returnTo ||
    null;

  useEffect(() => {
    if (
      initialCreditConsumed ||
      !requestedCreditId ||
      !credits.some(
        (credit) =>
          credit.id ===
          requestedCreditId
      )
    ) {
      return;
    }

    setFilter("all");
    setSelectedCreditId(
      requestedCreditId
    );
    setDetailTab(
      "installments"
    );
    setInitialCreditConsumed(
      true
    );
  }, [
    credits,
    initialCreditConsumed,
    requestedCreditId,
  ]);

  const selectedCredit = useMemo(
    () =>
      credits.find((credit) => credit.id === selectedCreditId) || null,
    [credits, selectedCreditId]
  );

  const selectedClient = useMemo(() => {
    if (!selectedCredit) return null;

    return (
      clients.find((client) => client.id === selectedCredit.clienteId) ||
      clients.find(
        (client) =>
          getClientName(client).toLowerCase() ===
          String(selectedCredit.cliente || "").toLowerCase()
      ) ||
      null
    );
  }, [clients, selectedCredit]);

  const selectedFinancials = useMemo(
    () =>
      selectedCredit
        ? getCreditFinancials(selectedCredit, settings)
        : null,
    [selectedCredit, settings]
  );

  const selectedStatus = useMemo(
    () =>
      selectedCredit
        ? getCreditStatus(selectedCredit, settings)
        : null,
    [selectedCredit, settings]
  );

  const selectedEvaluation = useMemo(
    () =>
      selectedClient
        ? evaluateClientCredit(selectedClient, credits, settings)
        : null,
    [selectedClient, credits, settings]
  );

  useEffect(() => {
    if (selectedClient) {
      setLimitValue(String(Number(selectedClient.limiteCredito || 0)));
    }
  }, [selectedClient]);

  const metrics = useMemo(() => {
    let activeBalance = 0;
    let overdueBalance = 0;
    let currentCount = 0;
    let overdueCount = 0;
    let paidCount = 0;

    credits.forEach((credit) => {
      const status = getCreditStatus(credit, settings);
      const financials = getCreditFinancials(credit, settings);

      if (status.key === "saldado") {
        paidCount += 1;
        return;
      }

      if (status.key === "refinanciado") {
        return;
      }

      activeBalance += financials.capitalBalance;

      if (status.overdue) {
        overdueCount += 1;
        overdueBalance += financials.capitalBalance;
      } else {
        currentCount += 1;
      }
    });

    return {
      activeBalance,
      overdueBalance,
      currentCount,
      overdueCount,
      paidCount,
    };
  }, [credits, settings]);

  const filteredCredits = useMemo(() => {
    const query = search.trim().toLowerCase();

    return credits.filter((credit) => {
      const status = getCreditStatus(credit, settings);

      const matches =
        !query ||
        [
          credit.id,
          credit.cliente,
          credit.concepto,
          credit.clienteId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(query);

      if (!matches) return false;
      if (filter === "all") return true;

      if (filter === "active") {
        return !["saldado", "refinanciado"].includes(status.key);
      }

      if (filter === "current") {
        return status.key === "corriente";
      }

      if (filter === "overdue") {
        return status.overdue;
      }

      if (filter === "paid") {
        return status.key === "saldado";
      }

      if (filter === "refinanced") {
        return status.key === "refinanciado";
      }

      return true;
    });
  }, [credits, search, filter, settings]);

  const newClient = useMemo(
    () =>
      clients.find((client) => client.id === creditForm.clientId) || null,
    [clients, creditForm.clientId]
  );

  const newEvaluation = useMemo(
    () =>
      newClient
        ? evaluateClientCredit(newClient, credits, settings)
        : null,
    [newClient, credits, settings]
  );

  const plans = useMemo(
    () =>
      simulateCreditPlans({
        capital: creditForm.capital,
        advance: creditForm.advance,
        interest: creditForm.interest,
        firstDueDate: creditForm.firstDueDate,
        plans: settings.creditoPlanesDisponibles,
      }),
    [
      creditForm.capital,
      creditForm.advance,
      creditForm.interest,
      creditForm.firstDueDate,
      settings.creditoPlanesDisponibles,
    ]
  );

  const selectedPlan =
    plans.find(
      (plan) =>
        String(plan.installments) === String(creditForm.installments)
    ) || null;

  const openNewCredit = () => {
    setCreditForm({
      ...EMPTY_CREDIT,
      firstDueDate: new Date(Date.now() + 30 * 86400000)
        .toISOString()
        .split("T")[0],
    });

    setCreditOpen(true);
  };

  const handleCreateCredit = async () => {
    try {
      setSavingCredit(true);

      const created = await createCredit({
        client: newClient,
        concept: creditForm.concept,
        capital: creditForm.capital,
        advance: creditForm.advance,
        interest: creditForm.interest,
        installments: creditForm.installments,
        firstDueDate: creditForm.firstDueDate,
        authorization: creditForm.authorization,
        overrideRisk: creditForm.overrideRisk,
        advanceMethod: creditForm.advanceMethod,
        author,
        settings,
      });

      setCreditOpen(false);
      setSelectedCreditId(created.id);

      notify.success(
        "Crédito otorgado",
        `Carpeta ${created.id} creada correctamente.`
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo otorgar", errorMessage(error));
    } finally {
      setSavingCredit(false);
    }
  };

  const openPayment = () => {
    setPaymentForm({
      ...EMPTY_PAYMENT,
      amount: selectedFinancials?.nextInstallment?.totalDue
        ? String(
            Math.round(
              selectedFinancials.nextInstallment.totalDue * 100
            ) / 100
          )
        : "",
    });

    setPaymentOpen(true);
  };

  const handlePayment = async () => {
    try {
      setSavingPayment(true);

      const result = await registerCreditPayment({
        creditId: selectedCredit.id,
        amount: paymentForm.amount,
        method: paymentForm.method,
        forgiveLateFees: paymentForm.forgiveLateFees,
        author,
        settings,
      });

      setPaymentOpen(false);

      notify.success(
        "Pago registrado",
        `Capital ${formatMoney(result.capitalPaid)} · Punitorios ${formatMoney(result.lateFeesPaid)}${
          result.unapplied > 0
            ? ` · Sin imputar ${formatMoney(result.unapplied)}`
            : ""
        }`
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo cobrar", errorMessage(error));
    } finally {
      setSavingPayment(false);
    }
  };

  const handleManagement = async () => {
    try {
      setSavingManagement(true);

      await addCollectionAction({
        creditId: selectedCredit.id,
        type: managementForm.type,
        note: managementForm.note,
        author,
      });

      setManagementOpen(false);
      setManagementForm(EMPTY_MANAGEMENT);
      setDetailTab("management");

      notify.success("Gestión registrada", "Quedó asentada en la carpeta.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingManagement(false);
    }
  };

  const handlePromise = async () => {
    try {
      setSavingPromise(true);

      await addPaymentPromise({
        creditId: selectedCredit.id,
        date: promiseForm.date,
        amount: promiseForm.amount,
        note: promiseForm.note,
        author,
      });

      setPromiseOpen(false);
      setPromiseForm(EMPTY_PROMISE);
      setDetailTab("management");

      notify.success("Promesa registrada", "La fecha y el importe quedaron asentados.");
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingPromise(false);
    }
  };

  const handleRefinance = async () => {
    const confirmed = window.confirm(
      `Se consolidarán todas las carpetas activas de ${getClientName(
        selectedClient
      )}. ¿Continuar?`
    );

    if (!confirmed) return;

    try {
      setSavingRefinance(true);

      const created = await refinanceClientCredits({
        client: selectedClient,
        credits,
        interest: refinanceForm.interest,
        installments: refinanceForm.installments,
        firstDueDate: refinanceForm.firstDueDate,
        authorization: refinanceForm.authorization,
        author,
      });

      setRefinanceOpen(false);
      setSelectedCreditId(created.id);

      notify.success(
        "Refinanciación creada",
        `Nueva carpeta ${created.id}.`
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo refinanciar", errorMessage(error));
    } finally {
      setSavingRefinance(false);
    }
  };

  const handleSaveLimit = async () => {
    try {
      setSavingLimit(true);

      await updateCreditLimit(
        selectedClient.id,
        limitValue,
        author
      );

      notify.success(
        "Cupo actualizado",
        `Nuevo límite: ${formatMoney(limitValue)}.`
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo actualizar", errorMessage(error));
    } finally {
      setSavingLimit(false);
    }
  };

  const handleSettings = async () => {
    try {
      setSavingSettings(true);

      await saveCreditSettings({
        ...settingsForm,
        author,
      });

      setSettingsOpen(false);

      notify.success(
        "Parámetros actualizados",
        "Los cálculos de mora usarán la nueva configuración."
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo guardar", errorMessage(error));
    } finally {
      setSavingSettings(false);
    }
  };

  const printPlan = () => {
    if (!selectedCredit || !selectedFinancials) return;

    const rows = selectedFinancials.installments
      .map(
        (installment) => `
          <tr>
            <td>${installment.numero}</td>
            <td>${formatDate(installment.vence)}</td>
            <td>${formatMoney(installment.importe)}</td>
            <td>${formatMoney(installment.capitalPagado)}</td>
            <td>${formatMoney(installment.capitalPending)}</td>
          </tr>
        `
      )
      .join("");

    openPrintable(
      `Plan ${selectedCredit.id}`,
      `
        <h1>Plan de pagos</h1>
        <p class="muted">Carpeta ${selectedCredit.id}</p>
        <div class="box">
          <p><b>Cliente:</b> ${selectedCredit.cliente || "Cliente"}</p>
          <p><b>Concepto:</b> ${selectedCredit.concepto || "Crédito"}</p>
          <p><b>Fecha de origen:</b> ${formatDate(selectedCredit.fechaOrigen)}</p>
          <p><b>Total financiado:</b> ${formatMoney(selectedCredit.original)}</p>
          <p><b>Saldo actual:</b> ${formatMoney(selectedFinancials.capitalBalance)}</p>
        </div>
        <table>
          <thead>
            <tr>
              <th>Cuota</th>
              <th>Vencimiento</th>
              <th>Importe</th>
              <th>Capital pagado</th>
              <th>Capital pendiente</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      `
    );
  };

  const printPromissory = () => {
    if (!selectedCredit) return;

    openPrintable(
      `Pagaré ${selectedCredit.id}`,
      `
        <h1>SOLICITUD DE CRÉDITO / PAGARÉ</h1>
        <p class="muted">
          Modelo interno. Conviene revisar el texto contractual y su validez jurídica
          antes de utilizarlo como instrumento exigible.
        </p>
        <div class="box">
          <p><b>Carpeta:</b> ${selectedCredit.id}</p>
          <p><b>Fecha:</b> ${formatDate(selectedCredit.fechaOrigen)}</p>
          <p><b>Cliente:</b> ${selectedCredit.cliente || "Cliente"}</p>
          <p><b>Documento:</b> ${getClientDocument(selectedClient)}</p>
          <p><b>Total financiado:</b> ${formatMoney(selectedCredit.original)}</p>
          <p><b>Plan:</b> ${selectedCredit.cantidadCuotas || selectedCredit.cuotas?.length || 1} cuota(s)</p>
        </div>
        <p>
          El cliente declara conocer el monto financiado y el plan de pagos indicado.
          Las tasas, cargos, punitorios y restantes condiciones deben constar en la
          documentación contractual aplicable.
        </p>
        <div class="sign">
          <div>Firma del cliente</div>
          <div>Aclaración / DNI</div>
        </div>
      `
    );
  };

  if (loading) {
    return (
      <main className="credits-page">
        <div className="credits-loading">
          Cargando cartera de créditos...
        </div>
      </main>
    );
  }

  return (
    <main className="credits-page">
      <div className="credits-shell">
        <header className="credits-header">
          <div>
            <button
              type="button"
              className="credits-back"
              onClick={() =>
                navigate(
                  returnTo ||
                  "/dashboard"
                )
              }
            >
              <ArrowLeft size={17} />
              {returnTo
                ? "Cliente"
                : "Dashboard"}
            </button>

            <span className="credits-eyebrow">
              Financiamiento / Cobranzas
            </span>

            <h1>Créditos</h1>
            <p>
              Cartera, planes de pago, cobranzas, mora y gestión del cliente.
            </p>
          </div>

          <div className="credits-header-actions">
            {isAdmin && (
              <button
                type="button"
                className="credits-secondary"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={16} />
                Parámetros
              </button>
            )}

            <button
              type="button"
              className="credits-primary"
              onClick={openNewCredit}
            >
              <Plus size={17} />
              Nuevo crédito
            </button>
          </div>
        </header>

        <section className="credits-kpis">
          <article>
            <div className="credits-kpi-icon portfolio">
              <WalletCards size={19} />
            </div>
            <span>Cartera activa</span>
            <strong>{formatMoney(metrics.activeBalance)}</strong>
            <small>Capital pendiente</small>
          </article>

          <article className="danger">
            <div className="credits-kpi-icon overdue">
              <AlertTriangle size={19} />
            </div>
            <span>Cartera en mora</span>
            <strong>{formatMoney(metrics.overdueBalance)}</strong>
            <small>{metrics.overdueCount} carpeta(s)</small>
          </article>

          <article>
            <div className="credits-kpi-icon current">
              <Check size={19} />
            </div>
            <span>Al corriente</span>
            <strong>{metrics.currentCount}</strong>
            <small>Carpetas sin atraso</small>
          </article>

          <article>
            <div className="credits-kpi-icon paid">
              <BadgeDollarSign size={19} />
            </div>
            <span>Saldados</span>
            <strong>{metrics.paidCount}</strong>
            <small>Historial cancelado</small>
          </article>
        </section>

        <section className="credits-panel">
          <div className="credits-toolbar">
            <div>
              <span>Cartera</span>
              <h2>Carpetas de crédito</h2>
            </div>

            <label className="credits-search">
              <Search size={16} />
              <input
                value={search}
                placeholder="Cliente, carpeta, concepto..."
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>

          <nav className="credits-filters">
            {FILTERS.map(([id, label]) => (
              <button
                type="button"
                key={id}
                className={filter === id ? "active" : ""}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="credits-table-wrap">
            <table className="credits-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Carpeta</th>
                  <th>Total original</th>
                  <th>Saldo</th>
                  <th>Próximo vencimiento</th>
                  <th>Mora</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>

              <tbody>
                {filteredCredits.map((credit) => {
                  const financials = getCreditFinancials(credit, settings);
                  const status = getCreditStatus(credit, settings);

                  return (
                    <motion.tr
                      key={credit.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      onClick={() => {
                        setSelectedCreditId(credit.id);
                        setDetailTab("installments");
                      }}
                    >
                      <td>
                        <strong className="credits-client-name">
                          {credit.cliente || "Cliente"}
                        </strong>
                        <span className="credits-cell-sub">
                          {credit.concepto || "Crédito"}
                        </span>
                      </td>

                      <td className="credits-mono">{credit.id}</td>
                      <td className="credits-money">{formatMoney(credit.original)}</td>
                      <td className="credits-money">{formatMoney(financials.capitalBalance)}</td>
                      <td>{formatDate(financials.nextInstallment?.vence)}</td>

                      <td>
                        {financials.maxDaysLate > 0 ? (
                          <span className="credits-days-late">
                            {financials.maxDaysLate} días
                          </span>
                        ) : (
                          <span className="credits-no-late">En regla</span>
                        )}
                      </td>

                      <td>
                        <span className={statusClass(status)}>
                          {status.label}
                        </span>
                      </td>

                      <td><ChevronRight size={17} /></td>
                    </motion.tr>
                  );
                })}

                {!filteredCredits.length && (
                  <tr>
                    <td colSpan="8">
                      <div className="credits-empty">
                        <CreditCard size={28} />
                        <strong>Sin carpetas para mostrar</strong>
                        <span>Cambiá el filtro o creá un nuevo crédito.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedCredit && (
        <div
          className="credits-drawer-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedCreditId(null);
            }
          }}
        >
          <motion.aside
            className="credits-drawer"
            initial={{ opacity: 0, x: 35 }}
            animate={{ opacity: 1, x: 0 }}
          >
            <header className="credits-drawer-head">
              <div>
                <span>Estado de cuenta</span>
                <h2>{selectedCredit.cliente || "Cliente"}</h2>
                <p>Carpeta {selectedCredit.id}</p>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCreditId(null)}
              >
                <X size={18} />
              </button>
            </header>

            <section className="credits-account-summary">
              <article>
                <span>Total original</span>
                <strong>{formatMoney(selectedCredit.original)}</strong>
              </article>

              <article>
                <span>Capital pendiente</span>
                <strong>{formatMoney(selectedFinancials?.capitalBalance)}</strong>
              </article>

              <article>
                <span>Punitorios hoy</span>
                <strong>{formatMoney(selectedFinancials?.pendingLateFees)}</strong>
              </article>

              <article>
                <span>Estado</span>
                <strong>
                  <span className={statusClass(selectedStatus)}>
                    {selectedStatus?.label}
                  </span>
                </strong>
              </article>
            </section>

            {selectedClient && (
              <section className="credits-risk-card">
                <div className="credits-risk-head">
                  <div>
                    <span>Evaluación interna</span>
                    <strong>Riesgo {selectedEvaluation?.risk}</strong>
                  </div>

                  <div className={`credits-score tone-${selectedEvaluation?.tone || "neutral"}`}>
                    <Gauge size={17} />
                    {selectedEvaluation?.score}/100
                  </div>
                </div>

                <div className="credits-risk-grid">
                  <div>
                    <span>Cupo</span>
                    <strong>{formatMoney(selectedEvaluation?.creditLimit)}</strong>
                  </div>
                  <div>
                    <span>Deuda</span>
                    <strong>{formatMoney(selectedEvaluation?.debt)}</strong>
                  </div>
                  <div>
                    <span>Disponible</span>
                    <strong>{formatMoney(selectedEvaluation?.available)}</strong>
                  </div>
                  <div>
                    <span>Mora máxima</span>
                    <strong>{selectedEvaluation?.maxDaysLate || 0} días</strong>
                  </div>
                </div>

                <div className="credits-limit-editor">
                  <input
                    type="number"
                    min="0"
                    value={limitValue}
                    onChange={(event) => setLimitValue(event.target.value)}
                  />

                  <button
                    type="button"
                    disabled={savingLimit}
                    onClick={handleSaveLimit}
                  >
                    {savingLimit ? "Guardando..." : "Actualizar cupo"}
                  </button>
                </div>
              </section>
            )}

            <section className="credits-drawer-actions">
              {!["saldado", "refinanciado"].includes(selectedStatus?.key) && (
                <>
                  <button type="button" className="primary" onClick={openPayment}>
                    <HandCoins size={16} />
                    Cobrar
                  </button>

                  <button type="button" onClick={() => setPromiseOpen(true)}>
                    <CalendarClock size={16} />
                    Promesa
                  </button>

                  <button type="button" onClick={() => setManagementOpen(true)}>
                    <PhoneCall size={16} />
                    Gestión
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setRefinanceForm({
                        ...EMPTY_REFINANCE,
                        firstDueDate: new Date(Date.now() + 30 * 86400000)
                          .toISOString()
                          .split("T")[0],
                      });
                      setRefinanceOpen(true);
                    }}
                  >
                    <RefreshCcw size={16} />
                    Refinanciar
                  </button>
                </>
              )}

              <button type="button" onClick={printPlan}>
                <Printer size={16} />
                Plan
              </button>

              <button type="button" onClick={printPromissory}>
                <FileText size={16} />
                Pagaré
              </button>
            </section>

            <nav className="credits-detail-tabs">
              {[
                ["installments", "Cuotas"],
                ["payments", "Pagos"],
                ["management", "Gestión"],
              ].map(([id, label]) => (
                <button
                  type="button"
                  key={id}
                  className={detailTab === id ? "active" : ""}
                  onClick={() => setDetailTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="credits-detail-body">
              {detailTab === "installments" && (
                <div className="credits-installments">
                  {selectedFinancials?.installments.map((installment) => (
                    <article
                      key={installment.numero}
                      className={
                        installment.status === "Vencida"
                          ? "overdue"
                          : installment.status === "Saldada"
                            ? "paid"
                            : ""
                      }
                    >
                      <div>
                        <span>Cuota {installment.numero}</span>
                        <strong>{formatDate(installment.vence)}</strong>
                      </div>
                      <div>
                        <span>Importe</span>
                        <strong>{formatMoney(installment.importe)}</strong>
                      </div>
                      <div>
                        <span>Capital pendiente</span>
                        <strong>{formatMoney(installment.capitalPending)}</strong>
                      </div>
                      <div>
                        <span>Punitorios</span>
                        <strong>{formatMoney(installment.pendingLateFees)}</strong>
                      </div>
                      <div>
                        <span>Estado</span>
                        <strong>
                          {installment.status}
                          {installment.daysLate > 0
                            ? ` · ${installment.daysLate} días`
                            : ""}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {detailTab === "payments" && (
                <div className="credits-history-list">
                  {(selectedCredit.abonos || [])
                    .slice()
                    .reverse()
                    .map((payment, index) => (
                      <article key={payment.id || `${payment.fecha}-${index}`}>
                        <History size={16} />
                        <section>
                          <strong>{formatMoney(payment.monto)}</strong>
                          <span>
                            {payment.fecha || "—"} · {payment.metodo || "—"}
                          </span>
                        </section>
                        <div>
                          <span>Capital {formatMoney(payment.capital)}</span>
                          <span>Punitorios {formatMoney(payment.punitorios)}</span>
                        </div>
                      </article>
                    ))}

                  {!(selectedCredit.abonos || []).length && (
                    <div className="credits-empty compact">
                      <History size={24} />
                      <strong>Sin pagos registrados</strong>
                    </div>
                  )}
                </div>
              )}

              {detailTab === "management" && (
                <div className="credits-management-list">
                  {(selectedCredit.promesasPago || [])
                    .slice()
                    .reverse()
                    .map((promise) => (
                      <article key={promise.id} className="promise">
                        <CalendarClock size={17} />
                        <section>
                          <strong>Promesa de pago</strong>
                          <span>
                            {formatDate(promise.fechaPromesa)} · {formatMoney(promise.monto)}
                          </span>
                          {promise.nota && <p>{promise.nota}</p>}
                        </section>
                        <span className="credits-promise-status">
                          {promise.estado || "Pendiente"}
                        </span>
                      </article>
                    ))}

                  {(selectedCredit.gestiones || [])
                    .slice()
                    .reverse()
                    .map((action) => (
                      <article key={action.id}>
                        <MessageSquareText size={17} />
                        <section>
                          <strong>{action.tipo || "Gestión"}</strong>
                          <span>
                            {action.fecha
                              ? new Date(action.fecha).toLocaleString("es-AR")
                              : "—"}
                          </span>
                          <p>{action.nota}</p>
                        </section>
                      </article>
                    ))}

                  {!(selectedCredit.gestiones || []).length &&
                    !(selectedCredit.promesasPago || []).length && (
                      <div className="credits-empty compact">
                        <MessageSquareText size={24} />
                        <strong>Sin gestiones registradas</strong>
                      </div>
                    )}
                </div>
              )}
            </div>
          </motion.aside>
        </div>
      )}

      {creditOpen && (
        <div className="credits-modal-overlay">
          <motion.div
            className="credits-modal large"
            initial={{ opacity: 0, scale: 0.985, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <header>
              <div>
                <span>Alta / Evaluación</span>
                <h3>Nuevo crédito</h3>
              </div>
              <button
                type="button"
                disabled={savingCredit}
                onClick={() => setCreditOpen(false)}
              >
                <X size={18} />
              </button>
            </header>

            <div className="credits-new-layout">
              <section className="credits-new-form">
                <label className="wide">
                  <span>Cliente *</span>
                  <select
                    value={creditForm.clientId}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        clientId: event.target.value,
                        installments: "",
                      }))
                    }
                  >
                    <option value="">Seleccionar cliente...</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {getClientName(client)} · {getClientDocument(client)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="wide">
                  <span>Concepto</span>
                  <input
                    value={creditForm.concept}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        concept: event.target.value,
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Monto solicitado *</span>
                  <input
                    type="number"
                    min="0"
                    value={creditForm.capital}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        capital: event.target.value,
                        installments: "",
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Anticipo</span>
                  <input
                    type="number"
                    min="0"
                    value={creditForm.advance}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        advance: event.target.value,
                        installments: "",
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Interés global (%)</span>
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={creditForm.interest}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        interest: event.target.value,
                        installments: "",
                      }))
                    }
                  />
                </label>

                <label>
                  <span>Primer vencimiento</span>
                  <input
                    type="date"
                    value={creditForm.firstDueDate}
                    onChange={(event) =>
                      setCreditForm((current) => ({
                        ...current,
                        firstDueDate: event.target.value,
                      }))
                    }
                  />
                </label>

                {Number(creditForm.advance || 0) > 0 && (
                  <label className="wide">
                    <span>Medio del anticipo</span>
                    <select
                      value={creditForm.advanceMethod}
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          advanceMethod: event.target.value,
                        }))
                      }
                    >
                      {CREDIT_PAYMENT_METHODS
                        .filter((method) => method !== "Saldo a Favor")
                        .map((method) => (
                          <option key={method} value={method}>
                            {method}
                          </option>
                        ))}
                    </select>
                  </label>
                )}

                <div className="credits-plan-picker wide">
                  <span>Plan de pago</span>
                  <div className="credits-plan-grid">
                    {plans.map((plan) => (
                      <button
                        type="button"
                        key={plan.installments}
                        className={
                          String(creditForm.installments) ===
                          String(plan.installments)
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          setCreditForm((current) => ({
                            ...current,
                            installments: String(plan.installments),
                          }))
                        }
                      >
                        <span>{plan.installments} cuota(s)</span>
                        <strong>{formatMoney(plan.installmentAmount)}</strong>
                        <small>Total {formatMoney(plan.total)}</small>
                      </button>
                    ))}
                  </div>
                </div>

                {newEvaluation?.blocked && (
                  <div className="credits-exception wide">
                    <ShieldAlert size={18} />
                    <div>
                      <strong>Requiere revisión manual</strong>
                      <span>
                        El cliente registra {newEvaluation.maxDaysLate} días de mora.
                      </span>
                    </div>

                    <label className="credits-check-label">
                      <input
                        type="checkbox"
                        checked={creditForm.overrideRisk}
                        onChange={(event) =>
                          setCreditForm((current) => ({
                            ...current,
                            overrideRisk: event.target.checked,
                          }))
                        }
                      />
                      Autorizar excepción
                    </label>
                  </div>
                )}

                {(creditForm.overrideRisk || newEvaluation?.blocked) && (
                  <label className="wide">
                    <span>Autorización / responsable</span>
                    <input
                      value={creditForm.authorization}
                      placeholder="Ej: Administrador"
                      onChange={(event) =>
                        setCreditForm((current) => ({
                          ...current,
                          authorization: event.target.value,
                        }))
                      }
                    />
                  </label>
                )}
              </section>

              <aside className="credits-evaluation-panel">
                {!newClient ? (
                  <div className="credits-empty compact">
                    <UserRound size={28} />
                    <strong>Seleccioná un cliente</strong>
                    <span>Vamos a evaluar cupo y situación de pago.</span>
                  </div>
                ) : (
                  <>
                    <div className="credits-eval-client">
                      <UserRound size={20} />
                      <div>
                        <span>Cliente</span>
                        <strong>{getClientName(newClient)}</strong>
                        <small>{getClientDocument(newClient)}</small>
                      </div>
                    </div>

                    <div className="credits-eval-score">
                      <div>
                        <span>Score interno</span>
                        <strong>{newEvaluation?.score}/100</strong>
                      </div>
                      <span className={`tone-${newEvaluation?.tone || "neutral"}`}>
                        Riesgo {newEvaluation?.risk}
                      </span>
                    </div>

                    <div className="credits-eval-grid">
                      <div>
                        <span>Límite</span>
                        <strong>{formatMoney(newEvaluation?.creditLimit)}</strong>
                      </div>
                      <div>
                        <span>Deuda actual</span>
                        <strong>{formatMoney(newEvaluation?.debt)}</strong>
                      </div>
                      <div>
                        <span>Disponible</span>
                        <strong>{formatMoney(newEvaluation?.available)}</strong>
                      </div>
                      <div>
                        <span>Mora máxima</span>
                        <strong>{newEvaluation?.maxDaysLate || 0} días</strong>
                      </div>
                    </div>

                    {selectedPlan && (
                      <div className="credits-selected-plan">
                        <span>Operación simulada</span>
                        <strong>
                          {selectedPlan.installments} cuotas de{" "}
                          {formatMoney(selectedPlan.installmentAmount)}
                        </strong>

                        <div>
                          <span>Capital financiado</span>
                          <b>{formatMoney(selectedPlan.financedBase)}</b>
                        </div>
                        <div>
                          <span>Interés</span>
                          <b>{formatMoney(selectedPlan.interestAmount)}</b>
                        </div>
                        <div>
                          <span>Total</span>
                          <b>{formatMoney(selectedPlan.total)}</b>
                        </div>

                        {selectedPlan.total > Number(newEvaluation?.available || 0) && (
                          <div className="credits-plan-error">
                            <AlertTriangle size={15} />
                            Supera el cupo disponible
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </aside>
            </div>

            <footer>
              <button
                type="button"
                className="ghost"
                disabled={savingCredit}
                onClick={() => setCreditOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="primary"
                disabled={savingCredit || !newClient || !selectedPlan}
                onClick={handleCreateCredit}
              >
                {savingCredit ? "Otorgando..." : "Autorizar y otorgar"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {paymentOpen && selectedCredit && (
        <div className="credits-modal-overlay">
          <motion.div className="credits-modal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <header>
              <div>
                <span>Cobranzas</span>
                <h3>Registrar pago</h3>
                <p>Carpeta {selectedCredit.id}</p>
              </div>
              <button type="button" onClick={() => setPaymentOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="credits-modal-form">
              <div className="credits-payment-summary">
                <div>
                  <span>Capital pendiente</span>
                  <strong>{formatMoney(selectedFinancials?.capitalBalance)}</strong>
                </div>
                <div>
                  <span>Punitorios actuales</span>
                  <strong>{formatMoney(selectedFinancials?.pendingLateFees)}</strong>
                </div>
              </div>

              <label>
                <span>Importe recibido *</span>
                <input
                  type="number"
                  min="0"
                  value={paymentForm.amount}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Medio de pago</span>
                <select
                  value={paymentForm.method}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      method: event.target.value,
                    }))
                  }
                >
                  {CREDIT_PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </label>

              <label className="credits-check-label">
                <input
                  type="checkbox"
                  checked={paymentForm.forgiveLateFees}
                  onChange={(event) =>
                    setPaymentForm((current) => ({
                      ...current,
                      forgiveLateFees: event.target.checked,
                    }))
                  }
                />
                No cobrar punitorios actuales
              </label>
            </div>

            <footer>
              <button type="button" className="ghost" onClick={() => setPaymentOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingPayment} onClick={handlePayment}>
                {savingPayment ? "Procesando..." : "Registrar cobro"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {managementOpen && selectedCredit && (
        <div className="credits-modal-overlay">
          <motion.div className="credits-modal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <header>
              <div>
                <span>Cobranza</span>
                <h3>Registrar gestión</h3>
              </div>
              <button type="button" onClick={() => setManagementOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="credits-modal-form">
              <label>
                <span>Tipo</span>
                <select
                  value={managementForm.type}
                  onChange={(event) =>
                    setManagementForm((current) => ({
                      ...current,
                      type: event.target.value,
                    }))
                  }
                >
                  {COLLECTION_ACTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Detalle *</span>
                <textarea
                  rows="5"
                  value={managementForm.note}
                  placeholder="Ej: Se contactó al cliente; solicita volver a llamar el viernes..."
                  onChange={(event) =>
                    setManagementForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <footer>
              <button type="button" className="ghost" onClick={() => setManagementOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingManagement} onClick={handleManagement}>
                {savingManagement ? "Guardando..." : "Registrar gestión"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {promiseOpen && selectedCredit && (
        <div className="credits-modal-overlay">
          <motion.div className="credits-modal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <header>
              <div>
                <span>Seguimiento</span>
                <h3>Promesa de pago</h3>
              </div>
              <button type="button" onClick={() => setPromiseOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="credits-modal-form">
              <label>
                <span>Fecha comprometida *</span>
                <input
                  type="date"
                  value={promiseForm.date}
                  onChange={(event) =>
                    setPromiseForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Importe *</span>
                <input
                  type="number"
                  min="0"
                  value={promiseForm.amount}
                  onChange={(event) =>
                    setPromiseForm((current) => ({
                      ...current,
                      amount: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Observación</span>
                <textarea
                  rows="4"
                  value={promiseForm.note}
                  onChange={(event) =>
                    setPromiseForm((current) => ({
                      ...current,
                      note: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <footer>
              <button type="button" className="ghost" onClick={() => setPromiseOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingPromise} onClick={handlePromise}>
                {savingPromise ? "Guardando..." : "Guardar promesa"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {refinanceOpen && selectedClient && (
        <div className="credits-modal-overlay">
          <motion.div className="credits-modal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <header>
              <div>
                <span>Refinanciación</span>
                <h3>Consolidar deuda</h3>
                <p>{getClientName(selectedClient)}</p>
              </div>
              <button type="button" onClick={() => setRefinanceOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="credits-modal-form">
              <div className="credits-refinance-total">
                <span>Deuda activa actual</span>
                <strong>{formatMoney(selectedEvaluation?.debt)}</strong>
              </div>

              <label>
                <span>Interés global (%)</span>
                <input
                  type="number"
                  min="0"
                  value={refinanceForm.interest}
                  onChange={(event) =>
                    setRefinanceForm((current) => ({
                      ...current,
                      interest: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Cuotas</span>
                <select
                  value={refinanceForm.installments}
                  onChange={(event) =>
                    setRefinanceForm((current) => ({
                      ...current,
                      installments: event.target.value,
                    }))
                  }
                >
                  {settings.creditoPlanesDisponibles.map((value) => (
                    <option key={value} value={value}>
                      {value} cuota(s)
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>Primer vencimiento</span>
                <input
                  type="date"
                  value={refinanceForm.firstDueDate}
                  onChange={(event) =>
                    setRefinanceForm((current) => ({
                      ...current,
                      firstDueDate: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Autorización</span>
                <input
                  value={refinanceForm.authorization}
                  onChange={(event) =>
                    setRefinanceForm((current) => ({
                      ...current,
                      authorization: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <footer>
              <button type="button" className="ghost" onClick={() => setRefinanceOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingRefinance} onClick={handleRefinance}>
                {savingRefinance ? "Procesando..." : "Crear refinanciación"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}

      {settingsOpen && (
        <div className="credits-modal-overlay">
          <motion.div className="credits-modal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <header>
              <div>
                <span>Parámetros</span>
                <h3>Configuración de crédito</h3>
              </div>
              <button type="button" onClick={() => setSettingsOpen(false)}>
                <X size={18} />
              </button>
            </header>

            <div className="credits-modal-form">
              <label>
                <span>Punitorio diario (%)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={settingsForm.creditoPunitorioDiario}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      creditoPunitorioDiario: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Días de gracia</span>
                <input
                  type="number"
                  min="0"
                  value={settingsForm.creditoDiasGracia}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      creditoDiasGracia: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Bloqueo automático desde (días de mora)</span>
                <input
                  type="number"
                  min="0"
                  value={settingsForm.creditoBloqueoMoraDias}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      creditoBloqueoMoraDias: event.target.value,
                    }))
                  }
                />
              </label>

              <label>
                <span>Planes disponibles</span>
                <input
                  value={settingsForm.creditoPlanesDisponibles.join(", ")}
                  onChange={(event) =>
                    setSettingsForm((current) => ({
                      ...current,
                      creditoPlanesDisponibles: event.target.value
                        .split(",")
                        .map((value) => Number(value.trim()))
                        .filter(
                          (value) =>
                            Number.isFinite(value) &&
                            value > 0
                        ),
                    }))
                  }
                  placeholder="1, 2, 3, 4, 6, 9, 12"
                />
              </label>
            </div>

            <footer>
              <button type="button" className="ghost" onClick={() => setSettingsOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingSettings} onClick={handleSettings}>
                {savingSettings ? "Guardando..." : "Guardar parámetros"}
              </button>
            </footer>
          </motion.div>
        </div>
      )}
    </main>
  );
}
