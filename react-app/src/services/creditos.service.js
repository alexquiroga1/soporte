import {
  arrayUnion,
  collection,
  doc,
  getDocs,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase.js";

/* =========================================
   CONSTANTES
========================================= */

export const CREDIT_PAYMENT_METHODS = [
  "Efectivo",
  "Transferencia",
  "Tarjeta",
  "Mercado Pago",
  "Saldo a Favor",
];

export const COLLECTION_ACTION_TYPES = [
  "Llamada",
  "Mensaje",
  "Visita",
  "Promesa de pago",
  "Observación",
];

export const DEFAULT_CREDIT_SETTINGS = {
  creditoPunitorioDiario: 1,
  creditoDiasGracia: 0,
  creditoBloqueoMoraDias: 30,
  creditoPlanesDisponibles: [1, 2, 3, 4, 6, 9, 12],
};

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dateOnly(value) {
  if (!value) return "";

  if (
    typeof value === "object" &&
    typeof value.toDate === "function"
  ) {
    return value.toDate().toISOString().split("T")[0];
  }

  const text = cleanText(value);

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const arMatch = text.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})/
  );

  if (arMatch) {
    const [, day, month, year] = arMatch;

    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  const parsed = new Date(text);

  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toISOString().split("T")[0];
}

function parseDate(value) {
  const iso = dateOnly(value);

  if (!iso) return null;

  const date = new Date(`${iso}T12:00:00`);

  return Number.isNaN(date.getTime())
    ? null
    : date;
}

function addDaysISO(days, from = new Date()) {
  const date = new Date(from);

  date.setDate(
    date.getDate() + Number(days || 0)
  );

  return date.toISOString().split("T")[0];
}

function getFullName(client) {
  if (!client) return "Cliente";

  return (
    cleanText(client.razonSocial) ||
    cleanText(`${client.nombre || ""} ${client.apellido || ""}`) ||
    cleanText(client.cliente) ||
    "Cliente"
  );
}

function sameClient(client, credit) {
  if (!client || !credit) return false;

  if (
    credit.clienteId &&
    credit.clienteId === client.id
  ) {
    return true;
  }

  const creditName = cleanText(credit.cliente).toLowerCase();
  const clientName = getFullName(client).toLowerCase();

  return Boolean(
    creditName &&
    clientName &&
    creditName === clientName
  );
}

function normalizeSettings(data = {}) {
  const plans =
    Array.isArray(data.creditoPlanesDisponibles) &&
    data.creditoPlanesDisponibles.length
      ? data.creditoPlanesDisponibles
          .map((value) =>
            Math.max(1, Math.trunc(toNumber(value)))
          )
          .filter(
            (value, index, array) =>
              value <= 36 &&
              array.indexOf(value) === index
          )
      : DEFAULT_CREDIT_SETTINGS.creditoPlanesDisponibles;

  return {
    creditoPunitorioDiario: Math.max(
      0,
      toNumber(
        data.creditoPunitorioDiario ??
          DEFAULT_CREDIT_SETTINGS.creditoPunitorioDiario
      )
    ),

    creditoDiasGracia: Math.max(
      0,
      Math.trunc(
        toNumber(
          data.creditoDiasGracia ??
            DEFAULT_CREDIT_SETTINGS.creditoDiasGracia
        )
      )
    ),

    creditoBloqueoMoraDias: Math.max(
      0,
      Math.trunc(
        toNumber(
          data.creditoBloqueoMoraDias ??
            DEFAULT_CREDIT_SETTINGS.creditoBloqueoMoraDias
        )
      )
    ),

    creditoPlanesDisponibles: plans,
  };
}

/* =========================================
   SUSCRIPCIONES
========================================= */

export function subscribeToCredits(onData, onError) {
  return onSnapshot(
    collection(db, "creditos"),

    (snapshot) => {
      const rows = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));

      rows.sort((a, b) =>
        String(
          b.creadoEn ||
            b.fechaOrigen ||
            ""
        ).localeCompare(
          String(
            a.creadoEn ||
              a.fechaOrigen ||
              ""
          )
        )
      );

      onData(rows);
    },

    onError
  );
}

export function subscribeToCreditClients(onData, onError) {
  return onSnapshot(
    collection(db, "clientes"),

    (snapshot) => {
      const rows = snapshot.docs.map((snapshotDoc) => ({
        id: snapshotDoc.id,
        ...snapshotDoc.data(),
      }));

      rows.sort((a, b) =>
        getFullName(a).localeCompare(
          getFullName(b),
          "es"
        )
      );

      onData(rows);
    },

    onError
  );
}

export function subscribeToCreditSettings(onData, onError) {
  return onSnapshot(
    doc(db, "negocio", "configuracion"),

    (snapshot) => {
      const data = snapshot.exists()
        ? snapshot.data()
        : {};

      onData(
        normalizeSettings(data)
      );
    },

    onError
  );
}

/* =========================================
   CUOTAS / MORA
========================================= */

export function normalizeInstallment(installment) {
  const importe = Math.max(
    0,
    toNumber(installment?.importe)
  );

  const capitalPaid =
    installment?.capitalPagado !== undefined
      ? clamp(
          toNumber(installment.capitalPagado),
          0,
          importe
        )
      : clamp(
          toNumber(installment?.pagado),
          0,
          importe
        );

  const lateFeesPaid = Math.max(
    0,
    toNumber(installment?.punitoriosPagados)
  );

  return {
    ...installment,

    numero: Math.max(
      1,
      Math.trunc(
        toNumber(installment?.numero) || 1
      )
    ),

    importe,
    capitalPagado: capitalPaid,
    punitoriosPagados: lateFeesPaid,
    pagado: capitalPaid + lateFeesPaid,
    vence: dateOnly(installment?.vence),
  };
}

export function getInstallmentFinancials(
  installment,
  settings = DEFAULT_CREDIT_SETTINGS,
  {
    forgiveLateFees = false,
    today = new Date(),
  } = {}
) {
  const normalized = normalizeInstallment(installment);

  const capitalPending = Math.max(
    0,
    normalized.importe - normalized.capitalPagado
  );

  const dueDate = parseDate(normalized.vence);
  const normalizedSettings = normalizeSettings(settings);

  let daysLate = 0;
  let generatedLateFees = 0;

  if (capitalPending > 0 && dueDate) {
    const comparison = new Date(today);
    comparison.setHours(0, 0, 0, 0);

    const chargeStart = new Date(dueDate);
    chargeStart.setHours(0, 0, 0, 0);

    chargeStart.setDate(
      chargeStart.getDate() +
        normalizedSettings.creditoDiasGracia
    );

    if (comparison > chargeStart) {
      daysLate = Math.max(
        1,
        Math.floor(
          (comparison - chargeStart) / 86400000
        )
      );

      generatedLateFees =
        capitalPending *
        (normalizedSettings.creditoPunitorioDiario / 100) *
        daysLate;
    }
  }

  const pendingLateFees = forgiveLateFees
    ? 0
    : Math.max(
        0,
        generatedLateFees -
          normalized.punitoriosPagados
      );

  let status = "A vencer";

  if (capitalPending <= 0) {
    status = "Saldada";
  } else if (daysLate > 0) {
    status = "Vencida";
  }

  return {
    ...normalized,
    capitalPending,
    daysLate,
    generatedLateFees,
    pendingLateFees,

    totalDue:
      capitalPending +
      pendingLateFees,

    status,
  };
}

function legacyInstallments(credit) {
  if (
    Array.isArray(credit?.cuotas) &&
    credit.cuotas.length
  ) {
    return credit.cuotas;
  }

  const original = Math.max(
    0,
    toNumber(credit?.original)
  );

  const saldo = Math.max(
    0,
    toNumber(credit?.saldo)
  );

  const importe =
    original ||
    saldo;

  const paid = Math.max(
    0,
    importe - saldo
  );

  return [
    {
      numero: 1,

      importe,

      capitalPagado:
        paid,

      punitoriosPagados:
        0,

      pagado:
        paid,

      vence:
        dateOnly(
          credit?.vence ||
            credit?.fechaOrigen
        ),
    },
  ];
}

export function getCreditFinancials(
  credit,
  settings = DEFAULT_CREDIT_SETTINGS
) {
  const installments = legacyInstallments(credit)
    .map((installment) =>
      getInstallmentFinancials(
        installment,
        settings
      )
    )
    .sort((a, b) =>
      String(a.vence).localeCompare(
        String(b.vence)
      )
    );

  const capitalBalance = installments.reduce(
    (sum, installment) =>
      sum + installment.capitalPending,
    0
  );

  const pendingLateFees = installments.reduce(
    (sum, installment) =>
      sum + installment.pendingLateFees,
    0
  );

  const maxDaysLate = installments.reduce(
    (max, installment) =>
      Math.max(
        max,
        installment.daysLate
      ),
    0
  );

  const nextInstallment =
    installments.find(
      (installment) =>
        installment.capitalPending > 0
    ) || null;

  return {
    installments,
    capitalBalance,
    pendingLateFees,

    totalDue:
      capitalBalance +
      pendingLateFees,

    maxDaysLate,
    nextInstallment,
  };
}

/* =========================================
   ESTADO DEL CRÉDITO
========================================= */

export function getCreditStatus(
  credit,
  settings = DEFAULT_CREDIT_SETTINGS
) {
  const financials = getCreditFinancials(
    credit,
    settings
  );

  const explicitState = cleanText(
    credit?.estado
  ).toLowerCase();

  const concept = cleanText(
    credit?.concepto
  ).toLowerCase();

  if (
    explicitState === "refinanciado" ||
    concept.includes("refinanciad")
  ) {
    return {
      key: "refinanciado",
      label: "Refinanciado",
      tone: "violet",
      overdue: false,
    };
  }

  const hasExplicitBalance =
    credit?.saldo !== undefined &&
    credit?.saldo !== null &&
    credit?.saldo !== "";

  if (
    financials.capitalBalance <= 0 ||
    (
      hasExplicitBalance &&
      toNumber(credit.saldo) <= 0
    )
  ) {
    return {
      key: "saldado",
      label: "Saldado",
      tone: "teal",
      overdue: false,
    };
  }

  const days =
    financials.maxDaysLate;

  if (days > 90) {
    return {
      key: "prelegal",
      label: "Pre-Legal",
      tone: "red",
      overdue: true,
    };
  }

  if (days > 60) {
    return {
      key: "mora60",
      label: "Mora 61-90",
      tone: "red",
      overdue: true,
    };
  }

  if (days > 30) {
    return {
      key: "mora30",
      label: "Mora 31-60",
      tone: "orange",
      overdue: true,
    };
  }

  if (days > 0) {
    return {
      key: "moratemprana",
      label: "Mora temprana",
      tone: "amber",
      overdue: true,
    };
  }

  return {
    key: "corriente",
    label: "Al corriente",
    tone: "blue",
    overdue: false,
  };
}

/* =========================================
   EVALUACIÓN INTERNA
========================================= */

export function evaluateClientCredit(
  client,
  credits,
  settings = DEFAULT_CREDIT_SETTINGS
) {
  if (!client) {
    return {
      debt: 0,
      creditLimit: 0,
      available: 0,
      activeCount: 0,
      overdueCount: 0,
      maxDaysLate: 0,
      risk: "Sin evaluar",
      tone: "neutral",
      score: 0,
      blocked: true,
    };
  }

  const clientCredits = (credits || []).filter(
    (credit) =>
      sameClient(
        client,
        credit
      )
  );

  const activeCredits = clientCredits.filter(
    (credit) => {
      const status =
        getCreditStatus(
          credit,
          settings
        );

      return ![
        "saldado",
        "refinanciado",
      ].includes(
        status.key
      );
    }
  );

  const statuses = activeCredits.map(
    (credit) => ({
      credit,

      status:
        getCreditStatus(
          credit,
          settings
        ),

      financials:
        getCreditFinancials(
          credit,
          settings
        ),
    })
  );

  const debt = activeCredits.reduce(
    (sum, credit) => {
      const financials =
        getCreditFinancials(
          credit,
          settings
        );

      return (
        sum +
        financials.capitalBalance
      );
    },

    0
  );

  const creditLimit = Math.max(
    0,
    toNumber(
      client.limiteCredito
    )
  );

  const available = Math.max(
    0,
    creditLimit - debt
  );

  const overdue = statuses.filter(
    (item) =>
      item.status.overdue
  );

  const maxDaysLate = statuses.reduce(
    (max, item) =>
      Math.max(
        max,
        item.financials.maxDaysLate
      ),

    0
  );

  const utilization =
    creditLimit > 0
      ? debt / creditLimit
      : debt > 0
        ? 1
        : 0;

  let score =
    100;

  score -= Math.min(
    45,
    maxDaysLate * 0.5
  );

  score -= Math.min(
    25,
    overdue.length * 8
  );

  score -= Math.min(
    20,
    utilization * 20
  );

  score = Math.round(
    clamp(
      score,
      0,
      100
    )
  );

  let risk =
    "Bajo";

  let tone =
    "teal";

  if (maxDaysLate > 90) {
    risk =
      "Crítico";

    tone =
      "red";
  } else if (
    maxDaysLate > 30 ||
    score < 45
  ) {
    risk =
      "Alto";

    tone =
      "orange";
  } else if (
    maxDaysLate > 0 ||
    score < 70
  ) {
    risk =
      "Medio";

    tone =
      "amber";
  }

  const normalizedSettings =
    normalizeSettings(
      settings
    );

  return {
    debt,
    creditLimit,
    available,

    activeCount:
      activeCredits.length,

    overdueCount:
      overdue.length,

    maxDaysLate,
    risk,
    tone,
    score,

    clientCredits,
    activeCredits,

    blocked:
      normalizedSettings.creditoBloqueoMoraDias >
        0 &&
      maxDaysLate >=
        normalizedSettings.creditoBloqueoMoraDias,
  };
}

/* =========================================
   SIMULACIÓN DE PLANES
========================================= */

export function simulateCreditPlans({
  capital,
  advance = 0,
  interest = 0,
  firstDueDate = "",
  plans = DEFAULT_CREDIT_SETTINGS.creditoPlanesDisponibles,
}) {
  const requested = Math.max(
    0,
    toNumber(capital)
  );

  const numericAdvance = Math.max(
    0,
    toNumber(advance)
  );

  const globalInterest = Math.max(
    0,
    toNumber(interest)
  );

  const financedBase = Math.max(
    0,
    requested -
      numericAdvance
  );

  const total =
    financedBase *
    (
      1 +
      globalInterest /
      100
    );

  const interestAmount = Math.max(
    0,
    total -
      financedBase
  );

  const firstDue =
    dateOnly(
      firstDueDate
    ) ||
    addDaysISO(
      30
    );

  return (
    Array.isArray(
      plans
    )
      ? plans
      : []
  )
    .map(
      (count) => {
        const installments = Math.max(
          1,
          Math.trunc(
            toNumber(count)
          )
        );

        return {
          installments,

          installmentAmount:
            installments > 0
              ? total /
                installments
              : 0,

          requested,

          advance:
            numericAdvance,

          financedBase,

          interest:
            globalInterest,

          interestAmount,

          total,

          firstDueDate:
            firstDue,
        };
      }
    )
    .filter(
      (plan) =>
        plan.installments > 0
    );
}

function buildInstallments({
  total,
  installments,
  firstDueDate,
}) {
  const count = Math.max(
    1,
    Math.trunc(
      toNumber(
        installments
      )
    )
  );

  const amount =
    total /
    count;

  const rows =
    [];

  let due =
    new Date(
      `${
        dateOnly(
          firstDueDate
        ) ||
        addDaysISO(
          30
        )
      }T12:00:00`
    );

  for (
    let index = 1;
    index <= count;
    index += 1
  ) {
    rows.push({
      numero:
        index,

      importe:
        amount,

      pagado:
        0,

      capitalPagado:
        0,

      punitoriosPagados:
        0,

      vence:
        due
          .toISOString()
          .split("T")[0],
    });

    due.setDate(
      due.getDate() +
        30
    );
  }

  return rows;
}

/* =========================================
   CREAR CRÉDITO
========================================= */

export async function createCredit({
  client,
  concept = "Otorgamiento de Crédito",
  capital,
  advance = 0,
  interest = 0,
  installments = 1,
  firstDueDate = "",
  authorization = "",
  overrideRisk = false,
  advanceMethod = "Efectivo",
  author = "Sistema",
  settings = DEFAULT_CREDIT_SETTINGS,
}) {
  if (!client?.id) {
    throw new Error(
      "CREDIT_CLIENT_REQUIRED"
    );
  }

  const requested = Math.max(
    0,
    toNumber(
      capital
    )
  );

  const numericAdvance = Math.max(
    0,
    toNumber(
      advance
    )
  );

  const numericInterest = Math.max(
    0,
    toNumber(
      interest
    )
  );

  const count = Math.max(
    1,
    Math.trunc(
      toNumber(
        installments
      )
    )
  );

  if (requested <= 0) {
    throw new Error(
      "CREDIT_AMOUNT_INVALID"
    );
  }

  if (
    numericAdvance >=
    requested
  ) {
    throw new Error(
      "CREDIT_ADVANCE_INVALID"
    );
  }

  const creditsSnapshot =
    await getDocs(
      collection(
        db,
        "creditos"
      )
    );

  const allCredits =
    creditsSnapshot.docs.map(
      (snapshotDoc) => ({
        id:
          snapshotDoc.id,

        ...snapshotDoc.data(),
      })
    );

  const evaluation =
    evaluateClientCredit(
      client,
      allCredits,
      settings
    );

  const financedBase =
    requested -
    numericAdvance;

  const totalFinanced =
    financedBase *
    (
      1 +
      numericInterest /
      100
    );

  if (
    totalFinanced >
    evaluation.available
  ) {
    const error =
      new Error(
        "CREDIT_LIMIT_EXCEEDED"
      );

    error.available =
      evaluation.available;

    error.required =
      totalFinanced;

    throw error;
  }

  if (
    evaluation.blocked &&
    !overrideRisk
  ) {
    const error =
      new Error(
        "CREDIT_CLIENT_BLOCKED"
      );

    error.daysLate =
      evaluation.maxDaysLate;

    throw error;
  }

  if (
    evaluation.blocked &&
    overrideRisk &&
    !cleanText(
      authorization
    )
  ) {
    throw new Error(
      "CREDIT_AUTHORIZATION_REQUIRED"
    );
  }

  const firstDue =
    dateOnly(
      firstDueDate
    ) ||
    addDaysISO(
      30
    );

  const installmentRows =
    buildInstallments({
      total:
        totalFinanced,

      installments:
        count,

      firstDueDate:
        firstDue,
    });

  const creditRef =
    doc(
      collection(
        db,
        "creditos"
      )
    );

  const now =
    new Date();

  const nowISO =
    now.toISOString();

  const authorName =
    cleanText(
      author
    ) ||
    "Sistema";

  const clientName =
    getFullName(
      client
    );

  const credit = {
    id:
      creditRef.id,

    clienteId:
      client.id,

    cliente:
      clientName,

    concepto:
      cleanText(
        concept
      ) ||
      "Otorgamiento de Crédito",

    fechaOrigen:
      nowISO.split(
        "T"
      )[0],

    capitalSolicitado:
      requested,

    anticipo:
      numericAdvance,

    capitalFinanciado:
      financedBase,

    interesGlobal:
      numericInterest,

    interesMonto:
      totalFinanced -
      financedBase,

    original:
      totalFinanced,

    saldo:
      totalFinanced,

    cantidadCuotas:
      count,

    primerVencimiento:
      firstDue,

    cuotas:
      installmentRows,

    abonos:
      [],

    gestiones:
      [],

    promesasPago:
      [],

    estado:
      "Activo",

    estadoAprobacion:
      "Aprobado",

    autorizacion:
      cleanText(
        authorization
      ) ||
      "Automática por cupo",

    excepcionRiesgo:
      Boolean(
        overrideRisk &&
        evaluation.blocked
      ),

    evaluacionInicial: {
      fecha:
        nowISO,

      scoreInterno:
        evaluation.score,

      riesgo:
        evaluation.risk,

      deudaPrevia:
        evaluation.debt,

      cupoDisponible:
        evaluation.available,

      moraMaxima:
        evaluation.maxDaysLate,
    },

    origen:
      "Módulo Créditos",

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      authorName,

    historial: [
      {
        fecha:
          nowISO,

        accion:
          "Crédito otorgado",

        detalle:
          `${count} cuota(s) · Total financiado ${totalFinanced.toFixed(2)}`,

        autor:
          authorName,
      },
    ],
  };

  const batch =
    writeBatch(
      db
    );

  batch.set(
    creditRef,
    credit
  );

  if (
    numericAdvance >
    0
  ) {
    const cajaRef =
      doc(
        db,
        "negocio",
        "caja_activa"
      );

    batch.set(
      cajaRef,

      {
        movs:
          arrayUnion({
            id:
              doc(
                collection(
                  db,
                  "negocio"
                )
              ).id,

            fecha:
              nowISO.split(
                "T"
              )[0],

            hora:
              now.toLocaleTimeString(
                "es-AR",
                {
                  hour:
                    "2-digit",

                  minute:
                    "2-digit",
                }
              ),

            creadoEn:
              nowISO,

            concepto:
              `Anticipo Crédito - ${clientName}`,

            tipo:
              "ingreso",

            monto:
              numericAdvance,

            subcategoria:
              "Capital",

            medioPago:
              cleanText(
                advanceMethod
              ) ||
              "Efectivo",

            usuario:
              authorName,

            referencia:
              creditRef.id,
          }),

        actualizadoEn:
          nowISO,
      },

      {
        merge:
          true,
      }
    );
  }

  await batch.commit();

  return credit;
}

/* =========================================
   REGISTRAR PAGO
========================================= */

export async function registerCreditPayment({
  creditId,
  amount,
  method = "Efectivo",
  forgiveLateFees = false,
  author = "Sistema",
  settings = DEFAULT_CREDIT_SETTINGS,
}) {
  const id =
    cleanText(
      creditId
    );

  const inputAmount = Math.max(
    0,
    toNumber(
      amount
    )
  );

  if (!id) {
    throw new Error(
      "CREDIT_ID_REQUIRED"
    );
  }

  if (
    inputAmount <=
    0
  ) {
    throw new Error(
      "PAYMENT_AMOUNT_INVALID"
    );
  }

  const normalizedMethod =
    cleanText(
      method
    ) ||
    "Efectivo";

  if (
    !CREDIT_PAYMENT_METHODS.includes(
      normalizedMethod
    )
  ) {
    throw new Error(
      "PAYMENT_METHOD_INVALID"
    );
  }

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      /*
       * IMPORTANTE:
       * primero hacemos todas las lecturas
       * y recién después las escrituras.
       */

      const creditRef =
        doc(
          db,
          "creditos",
          id
        );

      const creditSnapshot =
        await transaction.get(
          creditRef
        );

      if (
        !creditSnapshot.exists()
      ) {
        throw new Error(
          "CREDIT_NOT_FOUND"
        );
      }

      const credit = {
        id:
          creditSnapshot.id,

        ...creditSnapshot.data(),
      };

      if (
        credit?.saldo !== undefined &&
        credit?.saldo !== null &&
        toNumber(
          credit.saldo
        ) <=
          0
      ) {
        throw new Error(
          "CREDIT_ALREADY_PAID"
        );
      }

      let clientRef =
        null;

      let clientSnapshot =
        null;

      if (
        normalizedMethod ===
        "Saldo a Favor"
      ) {
        if (
          !credit.clienteId
        ) {
          throw new Error(
            "PAYMENT_CLIENT_REQUIRED"
          );
        }

        clientRef =
          doc(
            db,
            "clientes",
            credit.clienteId
          );

        clientSnapshot =
          await transaction.get(
            clientRef
          );

        if (
          !clientSnapshot.exists()
        ) {
          throw new Error(
            "PAYMENT_CLIENT_REQUIRED"
          );
        }
      }

      const installments =
        legacyInstallments(
          credit
        )
          .map(
            normalizeInstallment
          )
          .sort(
            (a, b) =>
              String(
                a.vence
              ).localeCompare(
                String(
                  b.vence
                )
              )
          );

      let remaining =
        inputAmount;

      let capitalPaid =
        0;

      let lateFeesPaid =
        0;

      for (
        const installment of
        installments
      ) {
        if (
          remaining <=
          0
        ) {
          break;
        }

        const financial =
          getInstallmentFinancials(
            installment,
            settings,
            {
              forgiveLateFees,
            }
          );

        if (
          financial.capitalPending <=
          0
        ) {
          continue;
        }

        /*
         * Primero punitorios.
         */
        const lateFeePayment =
          Math.min(
            remaining,
            financial.pendingLateFees
          );

        if (
          lateFeePayment >
          0
        ) {
          installment.punitoriosPagados +=
            lateFeePayment;

          lateFeesPaid +=
            lateFeePayment;

          remaining -=
            lateFeePayment;
        }

        /*
         * Después capital.
         */
        if (
          remaining >
          0
        ) {
          const currentCapitalPending =
            Math.max(
              0,
              installment.importe -
                installment.capitalPagado
            );

          const capitalPayment =
            Math.min(
              remaining,
              currentCapitalPending
            );

          installment.capitalPagado +=
            capitalPayment;

          capitalPaid +=
            capitalPayment;

          remaining -=
            capitalPayment;
        }

        installment.pagado =
          installment.capitalPagado +
          installment.punitoriosPagados;
      }

      const applied =
        capitalPaid +
        lateFeesPaid;

      if (
        applied <=
        0
      ) {
        throw new Error(
          "PAYMENT_NOT_APPLIED"
        );
      }

      const balance =
        installments.reduce(
          (
            sum,
            installment
          ) =>
            sum +
            Math.max(
              0,
              installment.importe -
                installment.capitalPagado
            ),

          0
        );

      /*
       * Validamos saldo a favor antes
       * de comenzar las escrituras.
       */
      if (
        normalizedMethod ===
        "Saldo a Favor"
      ) {
        const availableBalance =
          Math.max(
            0,
            toNumber(
              clientSnapshot.data()
                ?.saldoAFavor
            )
          );

        if (
          availableBalance <
          applied
        ) {
          const error =
            new Error(
              "PAYMENT_CREDIT_BALANCE_INSUFFICIENT"
            );

          error.available =
            availableBalance;

          throw error;
        }
      }

      const now =
        new Date();

      const nowISO =
        now.toISOString();

      const authorName =
        cleanText(
          author
        ) ||
        "Sistema";

      const payment = {
        id:
          doc(
            collection(
              db,
              "creditos"
            )
          ).id,

        fecha:
          `${now.toLocaleDateString(
            "es-AR"
          )} ${now.toLocaleTimeString(
            "es-AR",
            {
              hour:
                "2-digit",

              minute:
                "2-digit",
            }
          )}`,

        creadoEn:
          nowISO,

        monto:
          applied,

        capital:
          capitalPaid,

        punitorios:
          lateFeesPaid,

        saldoCapital:
          balance,

        metodo:
          normalizedMethod +
          (
            forgiveLateFees
              ? " (Sin Punitorios)"
              : ""
          ),

        usuario:
          authorName,

        sinPunitorios:
          Boolean(
            forgiveLateFees
          ),
      };

      const previousHistory =
        Array.isArray(
          credit.historial
        )
          ? credit.historial
          : [];

      transaction.update(
        creditRef,

        {
          cuotas:
            installments,

          saldo:
            balance,

          abonos: [
            ...(
              Array.isArray(
                credit.abonos
              )
                ? credit.abonos
                : []
            ),

            payment,
          ],

          estado:
            balance <=
            0
              ? "Saldado"
              : "Activo",

          actualizadoEn:
            nowISO,

          actualizadoPor:
            authorName,

          historial: [
            ...previousHistory,

            {
              fecha:
                nowISO,

              accion:
                "Cobranza",

              detalle:
                `Pago ${applied.toFixed(2)} · Capital ${capitalPaid.toFixed(2)} · Punitorios ${lateFeesPaid.toFixed(2)}`,

              autor:
                authorName,
            },
          ],
        }
      );

      /*
       * SALDO A FAVOR:
       * descuenta el saldo del cliente.
       * No genera un ingreso nuevo de Caja.
       */
      if (
        normalizedMethod ===
        "Saldo a Favor"
      ) {
        const availableBalance =
          Math.max(
            0,
            toNumber(
              clientSnapshot.data()
                ?.saldoAFavor
            )
          );

        transaction.update(
          clientRef,

          {
            saldoAFavor:
              availableBalance -
              applied,

            actualizadoEn:
              nowISO,
          }
        );
      } else {
        /*
         * COBRO NORMAL:
         * genera movimientos de Caja.
         */
        const movements =
          [];

        if (
          capitalPaid >
          0
        ) {
          movements.push({
            id:
              doc(
                collection(
                  db,
                  "negocio"
                )
              ).id,

            fecha:
              nowISO.split(
                "T"
              )[0],

            hora:
              now.toLocaleTimeString(
                "es-AR",
                {
                  hour:
                    "2-digit",

                  minute:
                    "2-digit",
                }
              ),

            creadoEn:
              nowISO,

            concepto:
              `Cobro Capital - Carpeta ${id}`,

            tipo:
              "ingreso",

            monto:
              capitalPaid,

            subcategoria:
              "Capital",

            medioPago:
              normalizedMethod,

            usuario:
              authorName,

            referencia:
              id,
          });
        }

        if (
          lateFeesPaid >
          0
        ) {
          movements.push({
            id:
              doc(
                collection(
                  db,
                  "negocio"
                )
              ).id,

            fecha:
              nowISO.split(
                "T"
              )[0],

            hora:
              now.toLocaleTimeString(
                "es-AR",
                {
                  hour:
                    "2-digit",

                  minute:
                    "2-digit",
                }
              ),

            creadoEn:
              nowISO,

            concepto:
              `Cobro Punitorios - Carpeta ${id}`,

            tipo:
              "ingreso",

            monto:
              lateFeesPaid,

            subcategoria:
              "Intereses/Punitorios",

            medioPago:
              normalizedMethod,

            usuario:
              authorName,

            referencia:
              id,
          });
        }

        if (
          movements.length
        ) {
          transaction.set(
            doc(
              db,
              "negocio",
              "caja_activa"
            ),

            {
              movs:
                arrayUnion(
                  ...movements
                ),

              actualizadoEn:
                nowISO,
            },

            {
              merge:
                true,
            }
          );
        }
      }

      return {
        creditId:
          id,

        payment,

        balance,

        capitalPaid,

        lateFeesPaid,

        unapplied:
          Math.max(
            0,
            remaining
          ),
      };
    }
  );
}

/* =========================================
   GESTIÓN DE COBRANZA
========================================= */

export async function addCollectionAction({
  creditId,
  type = "Observación",
  note,
  author = "Sistema",
}) {
  const id =
    cleanText(
      creditId
    );

  const cleanNote =
    cleanText(
      note
    );

  if (!id) {
    throw new Error(
      "CREDIT_ID_REQUIRED"
    );
  }

  if (!cleanNote) {
    throw new Error(
      "COLLECTION_NOTE_REQUIRED"
    );
  }

  const normalizedType =
    COLLECTION_ACTION_TYPES.includes(
      type
    )
      ? type
      : "Observación";

  const nowISO =
    new Date()
      .toISOString();

  const action = {
    id:
      doc(
        collection(
          db,
          "creditos"
        )
      ).id,

    tipo:
      normalizedType,

    nota:
      cleanNote,

    fecha:
      nowISO,

    usuario:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await updateDoc(
    doc(
      db,
      "creditos",
      id
    ),

    {
      gestiones:
        arrayUnion(
          action
        ),

      actualizadoEn:
        nowISO,
    }
  );

  return action;
}

/* =========================================
   PROMESA DE PAGO
========================================= */

export async function addPaymentPromise({
  creditId,
  date,
  amount,
  note = "",
  author = "Sistema",
}) {
  const id =
    cleanText(
      creditId
    );

  const promiseDate =
    dateOnly(
      date
    );

  const numericAmount =
    Math.max(
      0,
      toNumber(
        amount
      )
    );

  if (!id) {
    throw new Error(
      "CREDIT_ID_REQUIRED"
    );
  }

  if (!promiseDate) {
    throw new Error(
      "PROMISE_DATE_REQUIRED"
    );
  }

  if (
    numericAmount <=
    0
  ) {
    throw new Error(
      "PROMISE_AMOUNT_INVALID"
    );
  }

  const nowISO =
    new Date()
      .toISOString();

  const authorName =
    cleanText(
      author
    ) ||
    "Sistema";

  const promise = {
    id:
      doc(
        collection(
          db,
          "creditos"
        )
      ).id,

    fechaPromesa:
      promiseDate,

    monto:
      numericAmount,

    nota:
      cleanText(
        note
      ),

    estado:
      "Pendiente",

    creadoEn:
      nowISO,

    usuario:
      authorName,
  };

  const management = {
    id:
      doc(
        collection(
          db,
          "creditos"
        )
      ).id,

    tipo:
      "Promesa de pago",

    nota:
      `Promesa ${promiseDate} por ${numericAmount.toFixed(2)}${
        cleanText(
          note
        )
          ? ` · ${cleanText(
              note
            )}`
          : ""
      }`,

    fecha:
      nowISO,

    usuario:
      authorName,
  };

  await updateDoc(
    doc(
      db,
      "creditos",
      id
    ),

    {
      promesasPago:
        arrayUnion(
          promise
        ),

      gestiones:
        arrayUnion(
          management
        ),

      actualizadoEn:
        nowISO,
    }
  );

  return promise;
}

/* =========================================
   REFINANCIAR
========================================= */

export async function refinanceClientCredits({
  client,
  credits,
  interest = 0,
  installments = 1,
  firstDueDate = "",
  authorization = "",
  author = "Sistema",
}) {
  if (!client?.id) {
    throw new Error(
      "CREDIT_CLIENT_REQUIRED"
    );
  }

  const activeCredits =
    (credits || []).filter(
      (credit) => {
        if (
          !sameClient(
            client,
            credit
          )
        ) {
          return false;
        }

        const explicitState =
          cleanText(
            credit.estado
          ).toLowerCase();

        if (
          explicitState ===
          "refinanciado"
        ) {
          return false;
        }

        const financials =
          getCreditFinancials(
            credit
          );

        return (
          financials.capitalBalance >
          0
        );
      }
    );

  if (
    !activeCredits.length
  ) {
    throw new Error(
      "CREDIT_NO_ACTIVE_DEBT"
    );
  }

  const debt =
    activeCredits.reduce(
      (sum, credit) =>
        sum +
        getCreditFinancials(
          credit
        ).capitalBalance,

      0
    );

  const numericInterest =
    Math.max(
      0,
      toNumber(
        interest
      )
    );

  const count =
    Math.max(
      1,
      Math.trunc(
        toNumber(
          installments
        )
      )
    );

  const total =
    debt *
    (
      1 +
      numericInterest /
      100
    );

  const firstDue =
    dateOnly(
      firstDueDate
    ) ||
    addDaysISO(
      30
    );

  const rows =
    buildInstallments({
      total,

      installments:
        count,

      firstDueDate:
        firstDue,
    });

  const batch =
    writeBatch(
      db
    );

  const nowISO =
    new Date()
      .toISOString();

  const authorName =
    cleanText(
      author
    ) ||
    "Sistema";

  const newRef =
    doc(
      collection(
        db,
        "creditos"
      )
    );

  activeCredits.forEach(
    (credit) => {
      batch.update(
        doc(
          db,
          "creditos",
          credit.id
        ),

        {
          saldo:
            0,

          estado:
            "Refinanciado",

          refinanciadoEn:
            nowISO,

          refinanciadoPor:
            authorName,

          refinanciadoEnCreditoId:
            newRef.id,

          actualizadoEn:
            nowISO,
        }
      );
    }
  );

  const newCredit = {
    id:
      newRef.id,

    clienteId:
      client.id,

    cliente:
      getFullName(
        client
      ),

    concepto:
      "Refinanciación de Deuda",

    fechaOrigen:
      nowISO.split(
        "T"
      )[0],

    deudaRefinanciada:
      debt,

    capitalFinanciado:
      debt,

    interesGlobal:
      numericInterest,

    interesMonto:
      total -
      debt,

    original:
      total,

    saldo:
      total,

    cantidadCuotas:
      count,

    primerVencimiento:
      firstDue,

    cuotas:
      rows,

    abonos:
      [],

    gestiones:
      [],

    promesasPago:
      [],

    estado:
      "Activo",

    estadoAprobacion:
      "Aprobado",

    autorizacion:
      cleanText(
        authorization
      ) ||
      "Refinanciación",

    creditosOrigen:
      activeCredits.map(
        (credit) =>
          credit.id
      ),

    origen:
      "Refinanciación",

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      authorName,

    historial: [
      {
        fecha:
          nowISO,

        accion:
          "Refinanciación",

        detalle:
          `${activeCredits.length} carpeta(s) consolidadas`,

        autor:
          authorName,
      },
    ],
  };

  batch.set(
    newRef,
    newCredit
  );

  await batch.commit();

  return newCredit;
}

/* =========================================
   CUPO DEL CLIENTE
========================================= */

export async function updateCreditLimit(
  clientId,
  amount,
  author = "Sistema"
) {
  const id =
    cleanText(
      clientId
    );

  const numericAmount =
    Math.max(
      0,
      toNumber(
        amount
      )
    );

  if (!id) {
    throw new Error(
      "CREDIT_CLIENT_REQUIRED"
    );
  }

  await updateDoc(
    doc(
      db,
      "clientes",
      id
    ),

    {
      limiteCredito:
        numericAmount,

      actualizadoEn:
        new Date()
          .toISOString(),

      actualizadoPor:
        cleanText(
          author
        ) ||
        "Sistema",
    }
  );

  return numericAmount;
}

/* =========================================
   PARÁMETROS DE CRÉDITO
========================================= */

export async function saveCreditSettings({
  creditoPunitorioDiario,
  creditoDiasGracia,
  creditoBloqueoMoraDias,
  creditoPlanesDisponibles,
  author = "Sistema",
}) {
  const normalized =
    normalizeSettings({
      creditoPunitorioDiario,
      creditoDiasGracia,
      creditoBloqueoMoraDias,
      creditoPlanesDisponibles,
    });

  await setDoc(
    doc(
      db,
      "negocio",
      "configuracion"
    ),

    {
      ...normalized,

      actualizadoEn:
        new Date()
          .toISOString(),

      actualizadoPor:
        cleanText(
          author
        ) ||
        "Sistema",
    },

    {
      merge:
        true,
    }
  );

  return normalized;
}