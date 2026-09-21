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
  refinanceClientCredits,
  saveCreditSettings,
  simulateCreditPlans,
  subscribeToCreditClients,
  subscribeToCreditSettings,
  subscribeToCredits,
  updateCreditLimit,
} from "../../services/creditos.service.js";

import {
  sendCreditPaymentToCash,
} from "../../services/caja-pendientes.service.js";

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

function parseDateSafe(value) {
  if (!value) return null;
  const text = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2}/.test(text)
    ? `${text.slice(0, 10)}T12:00:00`
    : text;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysFromToday(value) {
  const date = parseDateSafe(value);
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date - today) / 86400000);
}

function creditSituation(status, financials) {
  if (!status) return "Sin evaluar";
  if (status.key === "saldado") return "Saldado";
  if (status.key === "refinanciado") return "Refinanciado";
  if (status.overdue) {
    const days = Number(financials?.maxDaysLate || 0);
    if (days > 30) return "Mora alta";
    if (days > 7) return "Mora moderada";
    return "Mora temprana";
  }
  const dueIn = daysFromToday(financials?.nextInstallment?.vence);
  if (dueIn !== null && dueIn >= 0 && dueIn <= 7) return "Próximo vencimiento";
  return "Al día";
}

function statusClass(status) {
  return `credit-status credit-status-${status?.tone || "neutral"}`;
}

function errorMessage(error) {
  const map = {
    CREDIT_CLIENT_REQUIRED: "Seleccioná un cliente.",
    CLIENT_ARCHIVED: "El cliente está archivado. Restauralo antes de crear o refinanciar un crédito.",
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
    CASH_PENDING_EXISTS: "Este crédito ya tiene un cobro pendiente en Caja.",
    CASH_PENDING_AMOUNT_INVALID: "Ingresá un importe válido para enviar a Caja.",
    CASH_PENDING_AMOUNT_EXCEEDS_DEBT: `El importe supera la deuda exigible actual. Máximo: ${formatMoney(error?.available)}.`,
    CREDIT_CLOSED: "El crédito no admite nuevos cobros.",
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
  const [mainTab, setMainTab] = useState("portfolio");
  const [movementSearch, setMovementSearch] = useState("");

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
    let dueNext7 = 0;
    let collectedThisMonth = 0;
    let activePromises = 0;

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();

    credits.forEach((credit) => {
      const status = getCreditStatus(credit, settings);
      const financials = getCreditFinancials(credit, settings);

      if (status.key === "saldado") {
        paidCount += 1;
      } else if (status.key !== "refinanciado") {
        activeBalance += financials.capitalBalance;

        if (status.overdue) {
          overdueCount += 1;
          overdueBalance += financials.capitalBalance;
        } else {
          currentCount += 1;
        }

        const dueIn = daysFromToday(financials.nextInstallment?.vence);
        if (dueIn !== null && dueIn >= 0 && dueIn <= 7) {
          dueNext7 += Number(financials.nextInstallment?.totalDue || 0);
        }
      }

      (credit.abonos || []).forEach((payment) => {
        const date = parseDateSafe(payment.creadoEn || payment.fecha);
        if (date && date.getMonth() === month && date.getFullYear() === year) {
          collectedThisMonth += Number(payment.monto || 0);
        }
      });

      activePromises += (credit.promesasPago || []).filter(
        (promise) => String(promise.estado || "Pendiente").toLowerCase() === "pendiente"
      ).length;
    });

    return {
      activeBalance,
      overdueBalance,
      currentCount,
      overdueCount,
      paidCount,
      dueNext7,
      collectedThisMonth,
      activePromises,
    };
  }, [credits, settings]);

  const aging = useMemo(() => {
    const buckets = {
      current: { amount: 0, count: 0 },
      early: { amount: 0, count: 0 },
      medium: { amount: 0, count: 0 },
      late: { amount: 0, count: 0 },
    };

    credits.forEach((credit) => {
      const status = getCreditStatus(credit, settings);
      if (["saldado", "refinanciado", "cancelado", "anulado"].includes(status.key)) return;

      const financials = getCreditFinancials(credit, settings);
      const days = Number(financials.maxDaysLate || 0);
      const target = days <= 0 ? "current" : days <= 7 ? "early" : days <= 30 ? "medium" : "late";
      buckets[target].amount += financials.capitalBalance;
      buckets[target].count += 1;
    });

    return buckets;
  }, [credits, settings]);

  const collectionQueue = useMemo(() => {
    const rows = [];

    credits.forEach((credit) => {
      const status = getCreditStatus(credit, settings);
      if (["saldado", "refinanciado", "cancelado", "anulado"].includes(status.key)) return;

      const financials = getCreditFinancials(credit, settings);
      const dueIn = daysFromToday(financials.nextInstallment?.vence);

      if (financials.maxDaysLate > 0) {
        rows.push({
          id: `late-${credit.id}`,
          creditId: credit.id,
          type: "overdue",
          client: credit.cliente || "Cliente",
          label: `Cuota vencida · ${financials.maxDaysLate} día(s) de mora`,
          amount: Number(financials.nextInstallment?.totalDue || financials.totalDue || 0),
          sort: 1000 + Number(financials.maxDaysLate || 0),
        });
      } else if (dueIn !== null && dueIn >= 0 && dueIn <= 7) {
        rows.push({
          id: `due-${credit.id}`,
          creditId: credit.id,
          type: "upcoming",
          client: credit.cliente || "Cliente",
          label: dueIn === 0 ? "Vence hoy" : `Vence en ${dueIn} día(s)`,
          amount: Number(financials.nextInstallment?.totalDue || 0),
          sort: 700 - dueIn,
        });
      }

      (credit.promesasPago || [])
        .filter((promise) => String(promise.estado || "Pendiente").toLowerCase() === "pendiente")
        .forEach((promise) => {
          rows.push({
            id: promise.id || `promise-${credit.id}-${promise.fechaPromesa}`,
            creditId: credit.id,
            type: "promise",
            client: credit.cliente || "Cliente",
            label: `Compromiso ${formatDate(promise.fechaPromesa)}`,
            amount: Number(promise.monto || 0),
            sort: 850,
          });
        });
    });

    return rows.sort((a, b) => b.sort - a.sort).slice(0, 12);
  }, [credits, settings]);

  const creditMovements = useMemo(() => {
    const query = movementSearch.trim().toLowerCase();
    const rows = credits.flatMap((credit) =>
      (credit.abonos || []).map((payment, index) => ({
        id: payment.id || `${credit.id}-${index}`,
        creditId: credit.id,
        client: credit.cliente || "Cliente",
        amount: Number(payment.monto || 0),
        capital: Number(payment.capital || 0),
        lateFees: Number(payment.punitorios || 0),
        method: payment.metodo || "—",
        date: payment.creadoEn || payment.fecha || "",
        createdAt: parseDateSafe(payment.creadoEn || payment.fecha)?.getTime() || 0,
      }))
    ).sort((a, b) => b.createdAt - a.createdAt);

    if (!query) return rows;
    return rows.filter((row) =>
      [row.id, row.creditId, row.client, row.method]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [credits, movementSearch]);

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

      const result = await sendCreditPaymentToCash(
        selectedCredit.id,
        paymentForm.amount,
        {
          forgiveLateFees: paymentForm.forgiveLateFees,
          author,
        }
      );

      setPaymentOpen(false);

      notify.success(
        "Cobro enviado a Caja",
        `${result.creditId} · ${formatMoney(result.total)} quedó pendiente para que Caja registre el medio de pago.`
      );
    } catch (error) {
      console.error(error);
      notify.error("No se pudo enviar a Caja", errorMessage(error));
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
            <td>${installment.daysLate > 0 ? `${installment.daysLate} días` : installment.capitalPending <= 0 ? "Pagada" : "Pendiente"}</td>
          </tr>
        `
      )
      .join("");

    const paymentRows = (selectedCredit.abonos || [])
      .slice()
      .reverse()
      .map(
        (payment) => `
          <tr>
            <td>${payment.fecha || formatDate(payment.creadoEn)}</td>
            <td>${payment.metodo || "—"}</td>
            <td>${formatMoney(payment.capital)}</td>
            <td>${formatMoney(payment.punitorios)}</td>
            <td>${formatMoney(payment.monto)}</td>
          </tr>
        `
      )
      .join("");

    openPrintable(
      `Estado de cuenta ${selectedCredit.id}`,
      `
        <h1>Estado de cuenta</h1>
        <p class="muted">Crédito ${selectedCredit.id}</p>
        <div class="box">
          <p><b>Cliente:</b> ${selectedCredit.cliente || "Cliente"}</p>
          <p><b>Concepto:</b> ${selectedCredit.concepto || "Crédito"}</p>
          <p><b>Fecha de origen:</b> ${formatDate(selectedCredit.fechaOrigen)}</p>
          <p><b>Total financiado:</b> ${formatMoney(selectedCredit.original)}</p>
          <p><b>Capital pendiente:</b> ${formatMoney(selectedFinancials.capitalBalance)}</p>
          <p><b>Punitorios actuales:</b> ${formatMoney(selectedFinancials.pendingLateFees)}</p>
        </div>
        <h3>Plan de cuotas</h3>
        <table>
          <thead><tr><th>Cuota</th><th>Vencimiento</th><th>Importe</th><th>Pagado</th><th>Pendiente</th><th>Estado</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <h3 style="margin-top:24px">Pagos registrados</h3>
        <table>
          <thead><tr><th>Fecha</th><th>Medio</th><th>Capital</th><th>Punitorios</th><th>Total</th></tr></thead>
          <tbody>${paymentRows || '<tr><td colspan="5">Sin pagos registrados</td></tr>'}</tbody>
        </table>
      `
    );
  };

  const printPaymentMovement = (movement) => {
    openPrintable(
      `Movimiento ${movement.id}`,
      `
        <h1>Movimiento de crédito</h1>
        <p class="muted">Comprobante interno SERVIX</p>
        <div class="box">
          <p><b>Movimiento:</b> ${movement.id}</p>
          <p><b>Crédito:</b> ${movement.creditId}</p>
          <p><b>Cliente:</b> ${movement.client}</p>
          <p><b>Fecha:</b> ${movement.date || "—"}</p>
          <p><b>Medio:</b> ${movement.method}</p>
          <p><b>Capital:</b> ${formatMoney(movement.capital)}</p>
          <p><b>Punitorios:</b> ${formatMoney(movement.lateFees)}</p>
          <p><b>Total aplicado:</b> ${formatMoney(movement.amount)}</p>
        </div>
        <p class="muted">Este comprobante documenta un movimiento interno del crédito y no reemplaza documentación fiscal.</p>
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
      <main className="credits-page credits-pro-page">
        <div className="credits-loading">Cargando cartera de créditos...</div>
      </main>
    );
  }

  const selectedSituation = creditSituation(selectedStatus, selectedFinancials);
  const selectedPaid = Math.max(
    0,
    Number(selectedCredit?.original || 0) - Number(selectedFinancials?.capitalBalance || 0)
  );
  const selectedProgress = Number(selectedCredit?.original || 0) > 0
    ? Math.min(100, Math.max(0, (selectedPaid / Number(selectedCredit.original)) * 100))
    : 0;

  return (
    <main className="credits-page credits-pro-page">
      <div className="credits-pro-shell">
        <header className="credits-pro-topbar">
          <div className="credits-pro-brand">
            <button
              type="button"
              className="credits-pro-icon-button"
              onClick={() => navigate(returnTo || "/dashboard")}
              title="Volver"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="credits-pro-brand-icon">
              <CreditCard size={22} />
            </div>

            <div>
              <strong>Créditos y Cobranzas</strong>
              <span>SERVIX · Cartera, vencimientos y seguimiento</span>
            </div>
          </div>

          <div className="credits-pro-top-actions">
            {isAdmin && (
              <button
                type="button"
                className="credits-pro-action soft"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings size={16} />
                Parámetros
              </button>
            )}

            <button type="button" className="credits-pro-action primary" onClick={openNewCredit}>
              <Plus size={16} />
              Nuevo crédito
            </button>
          </div>
        </header>

        <section className="credits-pro-heading">
          <div>
            <span className="credits-pro-eyebrow">Créditos</span>
            <h1>Cartera y cobranzas</h1>
            <p>Controlá saldos, cuotas, mora y compromisos de pago con trazabilidad completa.</p>
          </div>

          <button type="button" className="credits-pro-action" onClick={printPlan} disabled={!selectedCredit}>
            <FileText size={16} />
            Estado de cuenta
          </button>
        </section>

        <section className="credits-pro-metrics">
          <article>
            <div className="credits-pro-metric-icon"><WalletCards size={18} /></div>
            <span>Capital pendiente</span>
            <strong>{formatMoney(metrics.activeBalance)}</strong>
            <small>{metrics.currentCount + metrics.overdueCount} crédito(s) activo(s)</small>
          </article>

          <article className="danger">
            <div className="credits-pro-metric-icon"><AlertTriangle size={18} /></div>
            <span>Saldo vencido</span>
            <strong>{formatMoney(metrics.overdueBalance)}</strong>
            <small>{metrics.overdueCount} cliente(s) con mora</small>
          </article>

          <article>
            <div className="credits-pro-metric-icon"><CalendarClock size={18} /></div>
            <span>Vence en 7 días</span>
            <strong>{formatMoney(metrics.dueNext7)}</strong>
            <small>Próximas cuotas</small>
          </article>

          <article>
            <div className="credits-pro-metric-icon"><HandCoins size={18} /></div>
            <span>Cobrado este mes</span>
            <strong>{formatMoney(metrics.collectedThisMonth)}</strong>
            <small>Pagos aplicados</small>
          </article>

          <article>
            <div className="credits-pro-metric-icon"><CalendarClock size={18} /></div>
            <span>Compromisos activos</span>
            <strong>{metrics.activePromises}</strong>
            <small>Seguimiento pendiente</small>
          </article>
        </section>

        <div className="credits-pro-grid">
          <section className="credits-pro-main-card">
            <header className="credits-pro-card-head">
              <div className="credits-pro-card-title">
                <div className="credits-pro-card-icon"><CreditCard size={18} /></div>
                <div>
                  <strong>Centro de Créditos</strong>
                  <span>Cartera, cobranza y movimientos</span>
                </div>
              </div>

              <nav className="credits-pro-tabs">
                <button
                  type="button"
                  className={mainTab === "portfolio" ? "active" : ""}
                  onClick={() => setMainTab("portfolio")}
                >
                  <WalletCards size={15} /> Cartera
                </button>
                <button
                  type="button"
                  className={mainTab === "collections" ? "active" : ""}
                  onClick={() => setMainTab("collections")}
                >
                  <PhoneCall size={15} /> Cobranza
                </button>
                <button
                  type="button"
                  className={mainTab === "movements" ? "active" : ""}
                  onClick={() => setMainTab("movements")}
                >
                  <History size={15} /> Movimientos
                </button>
              </nav>
            </header>

            {mainTab === "portfolio" && (
              <div className="credits-pro-card-body">
                <div className="credits-pro-toolbar">
                  <label className="credits-pro-search">
                    <Search size={16} />
                    <input
                      value={search}
                      placeholder="Buscar cliente, crédito o concepto..."
                      onChange={(event) => setSearch(event.target.value)}
                    />
                  </label>

                  <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                    {FILTERS.map(([id, label]) => (
                      <option key={id} value={id}>{label}</option>
                    ))}
                  </select>
                </div>

                <div className="credits-pro-list-wrap">
                  <div className="credits-pro-list-head">
                    <span>Crédito</span><span>Cliente / origen</span><span>Estado</span><span>Saldo</span><span>Próxima cuota</span><span>Mora</span><span />
                  </div>

                  {filteredCredits.map((credit) => {
                    const financials = getCreditFinancials(credit, settings);
                    const status = getCreditStatus(credit, settings);
                    const dueIn = daysFromToday(financials.nextInstallment?.vence);

                    return (
                      <motion.button
                        type="button"
                        layout
                        key={credit.id}
                        className={`credits-pro-list-row ${selectedCreditId === credit.id ? "active" : ""}`}
                        onClick={() => {
                          setSelectedCreditId(credit.id);
                          setDetailTab("installments");
                        }}
                      >
                        <span className="ref"><strong>{credit.id}</strong><small>{formatDate(credit.fechaOrigen)}</small></span>
                        <span className="client"><strong>{credit.cliente || "Cliente"}</strong><small>{credit.facturaId || credit.concepto || "Crédito"}</small></span>
                        <span><b className={statusClass(status)}>{status.label}</b></span>
                        <span className="money">{formatMoney(financials.capitalBalance)}</span>
                        <span className="money">{formatMoney(financials.nextInstallment?.totalDue || 0)}</span>
                        <span>
                          {financials.maxDaysLate > 0 ? (
                            <b className="credits-pro-alert-pill danger">{financials.maxDaysLate} días</b>
                          ) : dueIn !== null && dueIn >= 0 && dueIn <= 7 ? (
                            <b className="credits-pro-alert-pill amber">{dueIn === 0 ? "Hoy" : `${dueIn} días`}</b>
                          ) : (
                            <b className="credits-pro-alert-pill ok">Al día</b>
                          )}
                        </span>
                        <ChevronRight size={16} />
                      </motion.button>
                    );
                  })}

                  {!filteredCredits.length && (
                    <div className="credits-empty">
                      <CreditCard size={28} />
                      <strong>Sin créditos para mostrar</strong>
                      <span>Cambiá el filtro o creá un nuevo crédito.</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {mainTab === "collections" && (
              <div className="credits-pro-card-body">
                <div className="credits-pro-aging">
                  <article><span>Al día</span><strong>{formatMoney(aging.current.amount)}</strong><small>{aging.current.count} crédito(s)</small></article>
                  <article className="amber"><span>1–7 días</span><strong>{formatMoney(aging.early.amount)}</strong><small>{aging.early.count} crédito(s)</small></article>
                  <article className="coral"><span>8–30 días</span><strong>{formatMoney(aging.medium.amount)}</strong><small>{aging.medium.count} crédito(s)</small></article>
                  <article className="danger"><span>31+ días</span><strong>{formatMoney(aging.late.amount)}</strong><small>{aging.late.count} crédito(s)</small></article>
                </div>

                <div className="credits-pro-queue">
                  {collectionQueue.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className={`credits-pro-queue-row ${item.type}`}
                      onClick={() => {
                        setSelectedCreditId(item.creditId);
                        setDetailTab("management");
                      }}
                    >
                      <span className="icon">
                        {item.type === "overdue" ? <AlertTriangle size={17} /> : item.type === "promise" ? <CalendarClock size={17} /> : <RefreshCcw size={17} />}
                      </span>
                      <span className="content"><strong>{item.client} · {item.creditId}</strong><small>{item.label}</small></span>
                      <strong className="amount">{formatMoney(item.amount)}</strong>
                      <ChevronRight size={16} />
                    </button>
                  ))}

                  {!collectionQueue.length && (
                    <div className="credits-empty compact">
                      <Check size={24} />
                      <strong>Sin acciones urgentes de cobranza</strong>
                    </div>
                  )}
                </div>

                <div className="credits-pro-note">
                  <strong>Seguimiento profesional:</strong> la cola prioriza mora real, próximos vencimientos y compromisos. Los recargos se calculan según los parámetros configurados y nunca se ocultan al operador.
                </div>
              </div>
            )}

            {mainTab === "movements" && (
              <div className="credits-pro-card-body">
                <div className="credits-pro-toolbar single">
                  <label className="credits-pro-search">
                    <Search size={16} />
                    <input
                      value={movementSearch}
                      placeholder="Buscar pago, crédito, cliente o medio..."
                      onChange={(event) => setMovementSearch(event.target.value)}
                    />
                  </label>
                </div>

                <div className="credits-pro-movement-wrap">
                  <div className="credits-pro-movement-head">
                    <span>Movimiento</span><span>Fecha</span><span>Cliente / crédito</span><span>Medio</span><span>Capital</span><span>Punitorios</span><span>Total</span><span />
                  </div>

                  {creditMovements.map((movement) => (
                    <div className="credits-pro-movement-row" key={movement.id}>
                      <span><strong>{movement.id}</strong></span>
                      <span>{movement.date || "—"}</span>
                      <span><strong>{movement.client}</strong><small>{movement.creditId}</small></span>
                      <span>{movement.method}</span>
                      <span>{formatMoney(movement.capital)}</span>
                      <span>{formatMoney(movement.lateFees)}</span>
                      <span className="positive">{formatMoney(movement.amount)}</span>
                      <button type="button" title="Imprimir" onClick={() => printPaymentMovement(movement)}><Printer size={15} /></button>
                    </div>
                  ))}

                  {!creditMovements.length && (
                    <div className="credits-empty compact">
                      <History size={24} />
                      <strong>Sin movimientos para mostrar</strong>
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>

          <aside className={`credits-pro-detail-card ${!selectedCredit ? "is-empty" : ""}`}> 
            {!selectedCredit ? (
              <div className="credits-empty compact">
                <UserRound size={30} />
                <strong>Seleccioná un crédito</strong>
                <span>Vas a ver cuotas, deuda y seguimiento.</span>
              </div>
            ) : (
              <>
                <header className="credits-pro-card-head detail">
                  <div className="credits-pro-card-title">
                    <div className="credits-pro-card-icon coral"><UserRound size={18} /></div>
                    <div><strong>{selectedCredit.id}</strong><span>Detalle del crédito</span></div>
                  </div>
                </header>

                <div className="credits-pro-detail-body">
                  <div className="credits-pro-customer">
                    <div className="avatar">{(selectedCredit.cliente || "CL").split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()}</div>
                    <div className="identity"><strong>{selectedCredit.cliente || "Cliente"}</strong><span>{selectedClient ? `Documento ${getClientDocument(selectedClient)}` : selectedCredit.concepto || "Crédito"}</span></div>
                    <div className="situation"><span>Situación</span><strong>{selectedSituation}</strong></div>
                  </div>

                  <div className="credits-pro-summary">
                    <div><span>Origen</span><strong>{selectedCredit.facturaId || selectedCredit.origen || selectedCredit.concepto || "Crédito"}</strong></div>
                    <div><span>Monto financiado</span><strong>{formatMoney(selectedCredit.original)}</strong></div>
                    <div><span>Total pagado</span><strong>{formatMoney(selectedPaid)}</strong></div>
                    <div><span>Plan</span><strong>{selectedCredit.cantidadCuotas || selectedFinancials?.installments?.length || 0} cuota(s)</strong></div>
                    <div><span>Próximo / vencido</span><strong>{formatDate(selectedFinancials?.nextInstallment?.vence)}</strong></div>
                    <div className="total"><span>Saldo pendiente</span><strong>{formatMoney(selectedFinancials?.capitalBalance)}</strong><b className={statusClass(selectedStatus)}>{selectedStatus?.label}</b></div>
                  </div>

                  <div className="credits-pro-progress">
                    <div><span>Progreso del plan</span><strong>{Math.round(selectedProgress)}%</strong></div>
                    <div className="bar"><span style={{ width: `${selectedProgress}%` }} /></div>
                  </div>

                  {selectedClient && (
                    <div className="credits-pro-limit">
                      <div><span>Límite de crédito</span><strong>{formatMoney(selectedEvaluation?.creditLimit)}</strong></div>
                      <div><span>Disponible</span><strong>{formatMoney(selectedEvaluation?.available)}</strong></div>
                      <div className="editor"><input type="number" min="0" value={limitValue} onChange={(event) => setLimitValue(event.target.value)} /><button type="button" disabled={savingLimit} onClick={handleSaveLimit}>{savingLimit ? "..." : "Actualizar"}</button></div>
                    </div>
                  )}

                  <nav className="credits-pro-detail-tabs">
                    <button type="button" className={detailTab === "installments" ? "active" : ""} onClick={() => setDetailTab("installments")}>Cuotas</button>
                    <button type="button" className={detailTab === "payments" ? "active" : ""} onClick={() => setDetailTab("payments")}>Pagos</button>
                    <button type="button" className={detailTab === "management" ? "active" : ""} onClick={() => setDetailTab("management")}>Gestiones</button>
                  </nav>

                  {detailTab === "installments" && (
                    <div className="credits-pro-installments">
                      {(selectedFinancials?.installments || []).map((installment) => {
                        const paid = installment.capitalPending <= 0;
                        const late = installment.daysLate > 0 && !paid;
                        return (
                          <article key={installment.numero} className={`${paid ? "paid" : ""} ${late ? "late" : ""}`}>
                            <span className="num">{installment.numero}</span>
                            <span className="info"><strong>Cuota {installment.numero}</strong><small>Vence {formatDate(installment.vence)}{late ? ` · ${installment.daysLate} días de mora` : ""}</small></span>
                            <strong className="amount">{formatMoney(installment.totalDue || installment.capitalPending || installment.importe)}</strong>
                            <b className={`credits-pro-alert-pill ${paid ? "ok" : late ? "danger" : "blue"}`}>{paid ? "Pagada" : late ? "Vencida" : "Pendiente"}</b>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {detailTab === "payments" && (
                    <div className="credits-pro-history">
                      {(selectedCredit.abonos || []).slice().reverse().map((payment, index) => (
                        <article key={payment.id || `${payment.fecha}-${index}`}>
                          <History size={16} />
                          <span><strong>{formatMoney(payment.monto)}</strong><small>{payment.fecha || "—"} · {payment.metodo || "—"}</small></span>
                          <span className="right"><small>Capital {formatMoney(payment.capital)}</small><small>Punitorios {formatMoney(payment.punitorios)}</small></span>
                        </article>
                      ))}
                      {!(selectedCredit.abonos || []).length && <div className="credits-empty compact"><History size={22} /><strong>Sin pagos registrados</strong></div>}
                    </div>
                  )}

                  {detailTab === "management" && (
                    <div className="credits-pro-history">
                      {(selectedCredit.promesasPago || []).slice().reverse().map((promise) => (
                        <article key={promise.id}>
                          <CalendarClock size={16} />
                          <span><strong>Compromiso de pago</strong><small>{formatDate(promise.fechaPromesa)} · {formatMoney(promise.monto)}{promise.nota ? ` · ${promise.nota}` : ""}</small></span>
                          <b className="credits-pro-alert-pill amber">{promise.estado || "Pendiente"}</b>
                        </article>
                      ))}
                      {(selectedCredit.gestiones || []).slice().reverse().map((action) => (
                        <article key={action.id}>
                          <MessageSquareText size={16} />
                          <span><strong>{action.tipo || "Gestión"}</strong><small>{action.nota || "—"}</small></span>
                          <small>{action.fecha ? new Date(action.fecha).toLocaleDateString("es-AR") : "—"}</small>
                        </article>
                      ))}
                      {!(selectedCredit.gestiones || []).length && !(selectedCredit.promesasPago || []).length && <div className="credits-empty compact"><MessageSquareText size={22} /><strong>Sin gestiones registradas</strong></div>}
                    </div>
                  )}

                  {! ["saldado", "refinanciado", "cancelado", "anulado"].includes(selectedStatus?.key) && (
                    <div className="credits-pro-actions-grid">
                      <button type="button" className="amber" onClick={() => setPromiseOpen(true)}><CalendarClock size={15} />Compromiso</button>
                      <button type="button" onClick={() => setManagementOpen(true)}><PhoneCall size={15} />Gestión</button>
                      <button
                        type="button"
                        className="soft"
                        onClick={() => {
                          setRefinanceForm({
                            ...EMPTY_REFINANCE,
                            firstDueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
                          });
                          setRefinanceOpen(true);
                        }}
                      ><RefreshCcw size={15} />Refinanciar</button>
                      <button type="button" onClick={printPlan}><FileText size={15} />Estado de cuenta</button>
                      <button type="button" onClick={printPromissory}><Printer size={15} />Pagaré / plan</button>
                      <button type="button" className="primary" onClick={openPayment}><HandCoins size={16} />Enviar cobro a Caja</button>
                    </div>
                  )}

                  <div className="credits-pro-note">
                    <strong>Separación financiera:</strong> este módulo administra deuda, cuotas, mora, compromisos y refinanciaciones. El dinero se registra en Caja; al cobrar, Caja actualiza el crédito y la factura vinculada.
                  </div>
                </div>
              </>
            )}
          </aside>
        </div>
      </div>

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
                <span>Cobranza</span>
                <h3>Enviar cobro a Caja</h3>
                <p>Crédito {selectedCredit.id}</p>
              </div>
              <button type="button" disabled={savingPayment} onClick={() => setPaymentOpen(false)}>
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
                <span>Importe a cobrar *</span>
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

              <label className="credits-check-label">
                <input
                  type="checkbox"
                  checked={paymentForm.forgiveLateFees}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    const nextInstallment = selectedFinancials?.nextInstallment;
                    setPaymentForm((current) => ({
                      ...current,
                      forgiveLateFees: checked,
                      amount: nextInstallment
                        ? String(
                            Math.round(
                              Number(
                                checked
                                  ? nextInstallment.capitalPending
                                  : nextInstallment.totalDue
                              ) * 100
                            ) / 100
                          )
                        : current.amount,
                    }));
                  }}
                />
                No cobrar punitorios actuales
              </label>

              <div className="credits-pro-modal-note">
                <strong>El medio de pago se elige en Caja.</strong>
                <span>Acá solo preparás el importe. Caja registrará efectivo, transferencia, tarjeta o saldo a favor y luego actualizará este crédito.</span>
              </div>
            </div>

            <footer>
              <button type="button" className="ghost" disabled={savingPayment} onClick={() => setPaymentOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="primary" disabled={savingPayment} onClick={handlePayment}>
                {savingPayment ? "Enviando..." : "Enviar a Caja"}
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
