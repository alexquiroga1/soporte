import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  where,
} from "firebase/firestore";

import { db } from "./firebase.js";

const REAL_INCOME_METHODS = new Set([
  "Efectivo",
  "Transferencia",
  "Mercado Pago",
  "Tarjeta",
]);

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDateTimeAR(date = new Date()) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getISODate(date = new Date()) {
  return date.toISOString().split("T")[0];
}

function getISOTime(date = new Date()) {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function getClientName(client, fallback = "Cliente") {
  if (!client) return fallback;

  return (
    cleanText(client.razonSocial) ||
    cleanText(`${client.nombre || ""} ${client.apellido || ""}`) ||
    cleanText(client.name) ||
    fallback
  );
}

function normalizeInvoiceItems(pending) {
  const cart = Array.isArray(pending?.articulosCart)
    ? pending.articulosCart
    : [];

  if (cart.length) {
    return cart.map((item) => ({
      desc: cleanText(item.nombre || item.descripcion || item.desc) || "Concepto",
      cant: Math.max(1, toNumber(item.cantidad ?? item.cant ?? 1) || 1),
      precio: Math.max(0, toNumber(item.precio ?? item.costo ?? 0)),
    }));
  }

  return [
    {
      desc: cleanText(pending?.concepto) || "Servicio",
      cant: 1,
      precio: Math.max(0, toNumber(pending?.total)),
    },
  ];
}

export function subscribeToCashPendings(onData, onError) {
  return onSnapshot(
    collection(db, "caja_pendientes"),
    (snapshot) => {
      const rows = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      rows.sort((a, b) =>
        String(b.creadoEn || "").localeCompare(String(a.creadoEn || ""))
      );

      onData(rows);
    },
    onError
  );
}

export function subscribeToCashRegister(onData, onError) {
  return onSnapshot(
    doc(db, "negocio", "caja_activa"),
    (snapshot) => {
      onData(
        snapshot.exists()
          ? { id: snapshot.id, ...snapshot.data() }
          : {
              id: "caja_activa",
              fondo: 0,
              movs: [],
              sesion: null,
            }
      );
    },
    onError
  );
}

export function subscribeToCashCuts(onData, onError) {
  return onSnapshot(
    collection(db, "caja_cortes"),
    (snapshot) => {
      const rows = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      rows.sort((a, b) =>
        String(b.cierre || "").localeCompare(String(a.cierre || ""))
      );

      onData(rows);
    },
    onError
  );
}

export function getCashSummary(cash) {
  const movements = Array.isArray(cash?.movs) ? cash.movs : [];

  const income = movements
    .filter((movement) => movement.tipo === "ingreso")
    .reduce((sum, movement) => sum + toNumber(movement.monto), 0);

  const expenses = movements
    .filter((movement) => movement.tipo === "egreso")
    .reduce((sum, movement) => sum + toNumber(movement.monto), 0);

  const cashIncome = movements
    .filter(
      (movement) =>
        movement.tipo === "ingreso" &&
        (!movement.medioPago || movement.medioPago === "Efectivo")
    )
    .reduce((sum, movement) => sum + toNumber(movement.monto), 0);

  const fund = toNumber(cash?.fondo);

  return {
    fund,
    income,
    expenses,
    cashIncome,
    cashExpected: fund + cashIncome - expenses,
    movements,
  };
}

export async function getPaymentEligibility(pending, method) {
  const total = toNumber(pending?.total);

  if (!["Saldo a Favor", "Préstamo personal"].includes(method)) {
    return {
      eligible: true,
      method,
    };
  }

  if (!pending?.clienteId) {
    return {
      eligible: false,
      method,
      reason: "El cobro requiere un cliente registrado.",
    };
  }

  const clientSnapshot = await getDoc(doc(db, "clientes", pending.clienteId));

  if (!clientSnapshot.exists()) {
    return {
      eligible: false,
      method,
      reason: "No encontramos el cliente asociado.",
    };
  }

  const client = {
    id: clientSnapshot.id,
    ...clientSnapshot.data(),
  };

  if (method === "Saldo a Favor") {
    const balance = toNumber(client.saldoAFavor);

    return {
      eligible: balance >= total,
      method,
      balance,
      required: total,
      reason:
        balance >= total
          ? "Saldo suficiente."
          : "El saldo a favor disponible es insuficiente.",
    };
  }

  const clientName = getClientName(client, pending.cliente || "Cliente");
  const creditsQuery = query(
    collection(db, "creditos"),
    where("cliente", "==", clientName)
  );

  const creditsSnapshot = await getDocs(creditsQuery);
  const activeCredits = creditsSnapshot.docs
    .map((creditSnapshot) => ({
      id: creditSnapshot.id,
      ...creditSnapshot.data(),
    }))
    .filter((credit) => toNumber(credit.saldo) > 0);

  const currentDebt = activeCredits.reduce(
    (sum, credit) => sum + toNumber(credit.saldo),
    0
  );

  const limit = toNumber(client.limiteCredito);
  const available = Math.max(0, limit - currentDebt);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let overdue30 = false;

  for (const credit of activeCredits) {
    const installments = Array.isArray(credit.cuotas) ? credit.cuotas : [];

    for (const installment of installments) {
      const amount = toNumber(installment.importe);
      const paid = toNumber(installment.pagado);

      if (paid >= amount || !installment.vence) continue;

      const dueDate = new Date(`${installment.vence}T00:00:00`);
      if (Number.isNaN(dueDate.getTime())) continue;

      const diffDays = Math.floor((today - dueDate) / 86400000);
      if (diffDays > 30) {
        overdue30 = true;
        break;
      }
    }

    if (overdue30) break;
  }

  const eligible = available >= total && !overdue30;

  return {
    eligible,
    method,
    limit,
    currentDebt,
    available,
    overdue30,
    required: total,
    reason: eligible
      ? "Crédito disponible."
      : overdue30
        ? "El cliente registra mora superior a 30 días."
        : "El cliente no dispone de cupo suficiente.",
  };
}

export async function processCashPayment({
  pendingId,
  method,
  details = {},
  author = "Caja",
}) {
  const cleanPendingId = cleanText(pendingId);
  const cleanMethod = cleanText(method);
  const cleanAuthor = cleanText(author) || "Caja";

  if (!cleanPendingId) throw new Error("CASH_PENDING_ID_REQUIRED");

  const allowedMethods = [
    "Efectivo",
    "Transferencia",
    "Mercado Pago",
    "Tarjeta",
    "Saldo a Favor",
    "Préstamo personal",
  ];

  if (!allowedMethods.includes(cleanMethod)) {
    throw new Error("PAYMENT_METHOD_INVALID");
  }

  const pendingRef = doc(db, "caja_pendientes", cleanPendingId);
  const previewSnapshot = await getDoc(pendingRef);

  if (!previewSnapshot.exists()) throw new Error("CASH_PENDING_NOT_FOUND");

  const preview = {
    id: previewSnapshot.id,
    ...previewSnapshot.data(),
  };

  if (cleanMethod === "Efectivo") {
    const received = toNumber(details.received);
    if (received < toNumber(preview.total)) {
      throw new Error("CASH_RECEIVED_INSUFFICIENT");
    }
  }

  if (["Transferencia", "Mercado Pago"].includes(cleanMethod)) {
    if (!cleanText(details.reference)) {
      throw new Error("PAYMENT_REFERENCE_REQUIRED");
    }
  }

  if (cleanMethod === "Tarjeta") {
    if (!/^\d{4}$/.test(cleanText(details.last4))) {
      throw new Error("CARD_LAST4_INVALID");
    }
    if (!cleanText(details.authorization)) {
      throw new Error("CARD_AUTH_REQUIRED");
    }
  }

  if (["Saldo a Favor", "Préstamo personal"].includes(cleanMethod)) {
    const eligibility = await getPaymentEligibility(preview, cleanMethod);
    if (!eligibility.eligible) {
      const error = new Error("PAYMENT_NOT_ELIGIBLE");
      error.eligibility = eligibility;
      throw error;
    }
  }

  const saleRef = doc(collection(db, "ventas"));
  const creditRef = doc(collection(db, "creditos"));

  return runTransaction(db, async (transaction) => {
    const pendingSnapshot = await transaction.get(pendingRef);

    if (!pendingSnapshot.exists()) {
      throw new Error("CASH_PENDING_NOT_FOUND");
    }

    const pending = {
      id: pendingSnapshot.id,
      ...pendingSnapshot.data(),
    };

    const total = toNumber(pending.total);
    if (total <= 0) throw new Error("PAYMENT_TOTAL_INVALID");

    const countersRef = doc(db, "negocio", "contadores");
    const cashRef = doc(db, "negocio", "caja_activa");

    const countersSnapshot = await transaction.get(countersRef);
    const cashSnapshot = await transaction.get(cashRef);

    const clientRef = pending.clienteId
      ? doc(db, "clientes", pending.clienteId)
      : null;
    const clientSnapshot = clientRef
      ? await transaction.get(clientRef)
      : null;

    const ticketRef =
      pending.origen === "Ticket" && pending.ref
        ? doc(db, "tickets", pending.ref)
        : null;
    const ticketSnapshot = ticketRef
      ? await transaction.get(ticketRef)
      : null;

    const budgetRef = pending.presupuestoId
      ? doc(db, "presupuestos", pending.presupuestoId)
      : null;
    const budgetSnapshot = budgetRef
      ? await transaction.get(budgetRef)
      : null;

    const productReads = [];
    const cart = Array.isArray(pending.articulosCart)
      ? pending.articulosCart
      : [];

    for (const item of cart) {
      if (!item?.sku) continue;
      const productRef = doc(db, "productos", item.sku);
      const productSnapshot = await transaction.get(productRef);
      productReads.push({ item, productRef, productSnapshot });
    }

    if (cleanMethod === "Saldo a Favor") {
      if (!clientRef || !clientSnapshot?.exists()) {
        throw new Error("CLIENT_REQUIRED");
      }
            const currentBalance = toNumber(clientSnapshot.data().saldoAFavor);

      if (currentBalance < total) {
        throw new Error(
          "CLIENT_BALANCE_INSUFFICIENT"
        );
      }
    }

    /* =======================================
       VALIDAR STOCK
    ======================================= */

    for (
      const {
        item,
        productSnapshot,
      } of productReads
    ) {
      if (
        !productSnapshot.exists()
      ) {
        continue;
      }

      const product =
        productSnapshot.data();

      if (
        cleanText(
          product.categoria
        ).toLowerCase() ===
        "servicios"
      ) {
        continue;
      }

      const quantity =
        Math.max(
          0,
          toNumber(
            item.cantidad
          )
        );

      const stock =
        toNumber(
          product.stock
        );

      if (
        quantity > 0 &&
        stock < quantity
      ) {
        const error =
          new Error(
            "STOCK_INSUFFICIENT"
          );

        error.productName =
          product.nombre ||
          item.nombre ||
          item.sku;

        error.available =
          stock;

        error.required =
          quantity;

        throw error;
      }
    }

    /* =======================================
       RESERVAR NÚMERO DE FACTURA
    ======================================= */

    let invoiceNumber =
      toNumber(
        countersSnapshot.data()?.facturas
      ) + 1;

    if (
      invoiceNumber <= 0
    ) {
      invoiceNumber = 1;
    }

    let invoiceId;
    let invoiceRef;
    let invoiceSnapshot;

    do {
      invoiceId =
        `FAC-${String(
          invoiceNumber
        ).padStart(
          6,
          "0"
        )}`;

      invoiceRef =
        doc(
          db,
          "facturas",
          invoiceId
        );

      invoiceSnapshot =
        await transaction.get(
          invoiceRef
        );

      if (
        invoiceSnapshot.exists()
      ) {
        invoiceNumber += 1;
      }
    } while (
      invoiceSnapshot.exists()
    );

    /* =======================================
       FECHAS
    ======================================= */

    const now =
      new Date();

    const nowISO =
      now.toISOString();

    const date =
      getISODate(
        now
      );

    const time =
      getISOTime(
        now
      );

    const historyDate =
      formatDateTimeAR(
        now
      );

    const invoiceItems =
      normalizeInvoiceItems(
        pending
      );

    /* =======================================
       DATOS DEL PAGO
    ======================================= */

    const paymentDetails = {
      ...(
        cleanMethod ===
        "Efectivo"
          ? {
              recibido:
                toNumber(
                  details.received
                ),

              vuelto:
                Math.max(
                  0,
                  toNumber(
                    details.received
                  ) -
                    total
                ),
            }
          : {}
      ),

      ...(
        [
          "Transferencia",
          "Mercado Pago",
        ].includes(
          cleanMethod
        )
          ? {
              referencia:
                cleanText(
                  details.reference
                ),
            }
          : {}
      ),

      ...(
        cleanMethod ===
        "Tarjeta"
          ? {
              ultimos4:
                cleanText(
                  details.last4
                ),

              autorizacion:
                cleanText(
                  details.authorization
                ),
            }
          : {}
      ),
    };

    /* =======================================
       RESTAR STOCK
    ======================================= */

    for (
      const {
        item,
        productRef,
        productSnapshot,
      } of productReads
    ) {
      if (
        !productSnapshot.exists()
      ) {
        continue;
      }

      const product =
        productSnapshot.data();

      if (
        cleanText(
          product.categoria
        ).toLowerCase() ===
        "servicios"
      ) {
        continue;
      }

      const quantity =
        Math.max(
          0,
          toNumber(
            item.cantidad
          )
        );

      if (
        quantity <= 0
      ) {
        continue;
      }

      transaction.update(
        productRef,
        {
          stock:
            toNumber(
              product.stock
            ) -
            quantity,

          actualizadoEn:
            nowISO,
        }
      );
    }

    /* =======================================
       PRÉSTAMO PERSONAL
    ======================================= */

    if (
      cleanMethod ===
      "Préstamo personal"
    ) {
      const clientData =
        clientSnapshot?.exists()
          ? clientSnapshot.data()
          : null;

      const clientName =
        getClientName(
          clientData,
          pending.cliente ||
            "Cliente"
        );

      transaction.set(
        creditRef,
        {
          id:
            creditRef.id,

          clienteId:
            pending.clienteId ||
            null,

          cliente:
            clientName,

          concepto:
            "Préstamo por " +
            (
              pending.origen ===
              "Ticket"
                ? `Ticket #${pending.ref}`
                : `Venta ${
                    pending.ref ||
                    pending.id
                  }`
            ),

          fechaOrigen:
            date,

          original:
            total,

          saldo:
            total,

          abonos:
            [],

          cuotas: [
            {
              numero:
                1,

              importe:
                total,

              pagado:
                0,

              capitalPagado:
                0,

              punitoriosPagados:
                0,

              vence:
                addDaysISO(
                  30
                ),
            },
          ],

          creadoEn:
            nowISO,

          usuario:
            cleanAuthor,
        }
      );
    }

    /* =======================================
       SALDO A FAVOR
    ======================================= */

    if (
      cleanMethod ===
        "Saldo a Favor" &&
      clientRef &&
      clientSnapshot?.exists()
    ) {
      transaction.update(
        clientRef,
        {
          saldoAFavor:
            toNumber(
              clientSnapshot
                .data()
                .saldoAFavor
            ) -
            total,

          actualizadoEn:
            nowISO,
        }
      );
    }

    /* =======================================
       MOVIMIENTO DE CAJA
    ======================================= */

    const cashData =
      cashSnapshot.exists()
        ? cashSnapshot.data()
        : {};

    const movements =
      Array.isArray(
        cashData.movs
      )
        ? cashData.movs
        : [];

    if (
      REAL_INCOME_METHODS.has(
        cleanMethod
      )
    ) {
      const movement = {
        id:
          doc(
            collection(
              db,
              "negocio"
            )
          ).id,

        fecha:
          date,

        hora:
          time,

        creadoEn:
          nowISO,

        concepto:
          `Cobro ${
            pending.origen ||
            "Operación"
          } #${
            pending.ref ||
            pending.id
          } (${
            pending.cliente ||
            "Cliente"
          })`,

        tipo:
          "ingreso",

        monto:
          total,

        subcategoria:
          "Capital",

        medioPago:
          cleanMethod,

        referencia:
          cleanText(
            details.reference
          ) ||
          null,

        usuario:
          cleanAuthor,
      };

      transaction.set(
        cashRef,
        {
          fondo:
            toNumber(
              cashData.fondo
            ),

          movs: [
            ...movements,
            movement,
          ],

          sesion:
            cashData.sesion ||
            {
              inicio:
                nowISO,

              fondoInicial:
                toNumber(
                  cashData.fondo
                ),

              usuario:
                cleanAuthor,
            },

          actualizadoEn:
            nowISO,
        },
        {
          merge: true,
        }
      );
    }

    /* =======================================
       VENTA
    ======================================= */

    transaction.set(
      saleRef,
      {
        id:
          saleRef.id,

        folio:
          pending.origen ===
          "Ticket"
            ? `V-TK-${pending.ref}`
            : pending.ref ||
              saleRef.id,

        cliente:
          pending.cliente ||
          "Consumidor Final",

        clienteId:
          pending.clienteId ||
          null,

        articulos:
          pending.concepto ||
          "Servicio",

        pago:
          cleanMethod,

        total,

        hora:
          time,

        fecha:
          date,

        creadoEn:
          nowISO,

        facturaId:
          invoiceId,
      }
    );

    /* =======================================
       FACTURA
    ======================================= */

    transaction.set(
      invoiceRef,
      {
        id:
          invoiceId,

        fecha:
          date,

        hora:
          time,

        cliente:
          pending.cliente ||
          "Consumidor Final",

        doc:
          "C.F.",

        clienteId:
          pending.clienteId ||
          null,

        tipo:
          "Factura",

        refModulo:
          pending.origen ||
          "Caja",

        refId:
          pending.ref ||
          pending.id,

        refPago:
          cleanMethod,

        estado:
          "Emitida",

        total,

        items:
          invoiceItems,

        usuario:
          cleanAuthor,

        estadoPago:
          "Pagado Total",

        condicionPago:
          cleanMethod ===
          "Préstamo personal"
            ? "Financiado"
            : "Cancelado",

        detallesPago:
          paymentDetails,

        creadoEn:
          nowISO,

        actualizadoEn:
          nowISO,

        historial: [
          {
            fecha:
              historyDate,

            accion:
              "Emisión Automática",

            detalle:
              `Cobro en Caja mediante ${cleanMethod}. Usuario: ${cleanAuthor}`,
          },
        ],
      }
    );

    /* =======================================
       CONTADOR
    ======================================= */

    transaction.set(
      countersRef,
      {
        facturas:
          invoiceNumber,
      },
      {
        merge: true,
      }
    );

    /* =======================================
       ACTUALIZAR TICKET
    ======================================= */

    if (
      ticketRef &&
      ticketSnapshot?.exists()
    ) {
      const ticket =
        ticketSnapshot.data();

      const history =
        Array.isArray(
          ticket.historial
        )
          ? ticket.historial
          : [];

      transaction.update(
        ticketRef,
        {
          estadoPago:
            "Pagado",

          estadoCaja:
            "Cobrado",

          estadoFacturacion:
            invoiceId,

          facturaId:
            invoiceId,

          cajaPendienteId:
            null,

          cobradoEn:
            nowISO,

          actualizadoEn:
            nowISO,

          historial: [
            ...history,

            {
              accion:
                "Cobro registrado y Facturado",

              detalle:
                `Medio: ${cleanMethod} - Importe: $${total.toLocaleString(
                  "es-AR"
                )} - Factura: ${invoiceId}`,

              fecha:
                historyDate,

              autor:
                cleanAuthor,
            },
          ],
        }
      );
    }

    /* =======================================
       ACTUALIZAR PRESUPUESTO
    ======================================= */

    if (
      budgetRef &&
      budgetSnapshot?.exists()
    ) {
      const budget =
        budgetSnapshot.data();

      const history =
        Array.isArray(
          budget.historial
        )
          ? budget.historial
          : [];

      transaction.update(
        budgetRef,
        {
          estado:
            "Facturado",

          estadoCaja:
            "Cobrado",

          facturaId:
            invoiceId,

          actualizadoEn:
            nowISO,

          historial: [
            ...history,

            {
              fecha:
                historyDate,

              accion:
                "Cobrado y facturado",

              detalle:
                `Factura ${invoiceId}. Medio: ${cleanMethod}. Usuario: ${cleanAuthor}`,
            },
          ],
        }
      );
    }

    /* =======================================
       ELIMINAR PENDIENTE
    ======================================= */

    transaction.delete(
      pendingRef
    );

    /* =======================================
       RESULTADO
    ======================================= */

    return {
      pendingId:
        cleanPendingId,

      invoiceId,

      saleId:
        saleRef.id,

      creditId:
        cleanMethod ===
        "Préstamo personal"
          ? creditRef.id
          : null,

      method:
        cleanMethod,

      total,

      change:
        cleanMethod ===
        "Efectivo"
          ? Math.max(
              0,
              toNumber(
                details.received
              ) -
                total
            )
          : 0,
    };
  });
}

/* =========================================
   MOVIMIENTO MANUAL
========================================= */

export async function addCashMovement({
  concept,
  type,
  amount,
  author = "Sistema",
}) {
  const cleanConcept =
    cleanText(
      concept
    );

  const cleanType =
    cleanText(
      type
    );

  const numericAmount =
    toNumber(
      amount
    );

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  if (
    !cleanConcept
  ) {
    throw new Error(
      "MOVEMENT_CONCEPT_REQUIRED"
    );
  }

  if (
    ![
      "ingreso",
      "egreso",
    ].includes(
      cleanType
    )
  ) {
    throw new Error(
      "MOVEMENT_TYPE_INVALID"
    );
  }

  if (
    numericAmount <= 0
  ) {
    throw new Error(
      "MOVEMENT_AMOUNT_INVALID"
    );
  }

  const cashRef =
    doc(
      db,
      "negocio",
      "caja_activa"
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          cashRef
        );

      const cash =
        snapshot.exists()
          ? snapshot.data()
          : {};

      const movements =
        Array.isArray(
          cash.movs
        )
          ? cash.movs
          : [];

      const now =
        new Date();

      const movement = {
        id:
          doc(
            collection(
              db,
              "negocio"
            )
          ).id,

        fecha:
          getISODate(
            now
          ),

        hora:
          getISOTime(
            now
          ),

        creadoEn:
          now.toISOString(),

        concepto:
          cleanConcept,

        tipo:
          cleanType,

        monto:
          numericAmount,

        subcategoria:
          cleanType ===
          "egreso"
            ? "Gastos"
            : "Otros ingresos",

        medioPago:
          "Efectivo",

        usuario:
          cleanAuthor,
      };

      transaction.set(
        cashRef,
        {
          fondo:
            toNumber(
              cash.fondo
            ),

          movs: [
            ...movements,
            movement,
          ],

          sesion:
            cash.sesion ||
            {
              inicio:
                now.toISOString(),

              fondoInicial:
                toNumber(
                  cash.fondo
                ),

              usuario:
                cleanAuthor,
            },

          actualizadoEn:
            now.toISOString(),
        },
        {
          merge: true,
        }
      );

      return movement;
    }
  );
}

/* =========================================
   CERRAR CAJA
========================================= */

export async function closeCashRegister({
  newFund = 0,
  author = "Sistema",
}) {
  const numericNewFund =
    Math.max(
      0,
      toNumber(
        newFund
      )
    );

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  const cashRef =
    doc(
      db,
      "negocio",
      "caja_activa"
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      const cashSnapshot =
        await transaction.get(
          cashRef
        );

      const cash =
        cashSnapshot.exists()
          ? cashSnapshot.data()
          : {};

      const summary =
        getCashSummary(
          cash
        );

      if (
        numericNewFund >
        Math.max(
          0,
          summary.cashExpected
        )
      ) {
        throw new Error(
          "NEW_FUND_EXCEEDS_CASH"
        );
      }

      const now =
        new Date();

      const cutId =
        `COR-${now.getTime()}`;

      const cutRef =
        doc(
          db,
          "caja_cortes",
          cutId
        );

      transaction.set(
        cutRef,
        {
          id:
            cutId,

          apertura:
            cash?.sesion?.inicio ||
            null,

          cierre:
            now.toISOString(),

          usuario:
            cleanAuthor,

          fondoInicial:
            summary.fund,

          ingresos:
            summary.income,

          ingresosEfectivo:
            summary.cashIncome,

          egresos:
            summary.expenses,

          efectivoEsperado:
            summary.cashExpected,

          nuevoFondo:
            numericNewFund,

          movs:
            summary.movements,
        }
      );

      transaction.set(
        cashRef,
        {
          movs:
            [],

          fondo:
            numericNewFund,

          sesion: {
            inicio:
              now.toISOString(),

            fondoInicial:
              numericNewFund,

            usuario:
              cleanAuthor,
          },

          actualizadoEn:
            now.toISOString(),
        }
      );

      return {
        cutId,

        ...summary,

        newFund:
          numericNewFund,
      };
    }
  );
}