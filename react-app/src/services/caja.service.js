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
import { resolveProductForTransaction } from "./product-reference.service.js";
import { addDaysLocalISO, toLocalISODate } from "../utils/date.js";

import {
  registerCreditPayment,
} from "./creditos.service.js";

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

function roundMoney(value) {
  return Math.round((toNumber(value) + Number.EPSILON) * 100) / 100;
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
  return toLocalISODate(date);
}

function getISOTime(date = new Date()) {
  return date.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addDaysISO(days) {
  return addDaysLocalISO(days);
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
      sku: cleanText(item.sku) || null,
      productId: cleanText(item.productId || item.docId) || null,
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
        ...documentSnapshot.data(),
              id: documentSnapshot.id,
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
          ? { ...snapshot.data(), id: snapshot.id }
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
        ...documentSnapshot.data(),
              id: documentSnapshot.id,
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
    fund: roundMoney(fund),
    income: roundMoney(income),
    expenses: roundMoney(expenses),
    cashIncome: roundMoney(cashIncome),
    cashExpected: roundMoney(fund + cashIncome - expenses),
    movements,
  };
}

export async function getPaymentEligibility(pending, method) {
  const total = roundMoney(pending?.total);

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
    ...clientSnapshot.data(),
              id: clientSnapshot.id,
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

  // Los créditos nuevos se vinculan por clienteId. El fallback por nombre
  // se conserva únicamente para registros legacy que todavía no tengan id.
  let creditsSnapshot = await getDocs(
    query(
      collection(db, "creditos"),
      where("clienteId", "==", pending.clienteId)
    )
  );

  if (creditsSnapshot.empty) {
    creditsSnapshot = await getDocs(
      query(
        collection(db, "creditos"),
        where("cliente", "==", clientName)
      )
    );
  }

  const activeCredits = creditsSnapshot.docs
    .map((creditSnapshot) => ({
      ...creditSnapshot.data(),
              id: creditSnapshot.id,
    }))
    .filter((credit) => {
      const state = cleanText(credit.estado).toLowerCase();

      return (
        toNumber(credit.saldo) > 0 &&
        state !== "cancelado" &&
        state !== "anulado" &&
        state !== "refinanciado"
      );
    });

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
  const isFinanced = cleanMethod === "Préstamo personal";

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
    ...previewSnapshot.data(),
              id: previewSnapshot.id,
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

  /* =======================================
     COBRANZA DE CRÉDITO EXISTENTE
     No genera una nueva venta ni una nueva factura.
  ======================================= */

  if (
    cleanText(preview.origen).toLowerCase() === "crédito" &&
    cleanText(preview.creditoId)
  ) {
    if (cleanMethod === "Préstamo personal") {
      throw new Error("PAYMENT_METHOD_INVALID");
    }

    const settingsSnapshot = await getDoc(
      doc(db, "negocio", "configuracion")
    );

    const result = await registerCreditPayment({
      creditId: preview.creditoId,
      amount: preview.total,
      method: cleanMethod,
      forgiveLateFees: Boolean(preview.forgiveLateFees),
      author: cleanAuthor,
      settings: settingsSnapshot.exists() ? settingsSnapshot.data() : undefined,
      cashPendingId: cleanPendingId,
      paymentDetails: details,
    });

    return {
      kind: "credit-payment",
      pendingId: cleanPendingId,
      creditId: preview.creditoId,
      invoiceId: preview.facturaId || null,
      method: cleanMethod,
      paymentState: result.balance <= 0 ? "Pagado Total" : "Pago Parcial",
      movementId: result.payment?.id || null,
      total: result.payment?.monto || result.capitalPaid + result.lateFeesPaid,
      capitalPaid: result.capitalPaid,
      lateFeesPaid: result.lateFeesPaid,
      balance: result.balance,
      change:
        cleanMethod === "Efectivo"
          ? Math.max(0, toNumber(details.received) - toNumber(preview.total))
          : 0,
    };
  }

  const saleRef = doc(collection(db, "ventas"));
  const creditRef = doc(collection(db, "creditos"));

  return runTransaction(db, async (transaction) => {
    const pendingSnapshot = await transaction.get(pendingRef);

    if (!pendingSnapshot.exists()) {
      throw new Error("CASH_PENDING_NOT_FOUND");
    }

    const pending = {
      ...pendingSnapshot.data(),
              id: pendingSnapshot.id,
    };

    const total = roundMoney(pending.total);
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
      if ((!item?.sku && !item?.productId && !item?.docId) || item?.manual === true) continue;

      const resolvedProduct = await resolveProductForTransaction(
        transaction,
        item
      );

      productReads.push({
        item: {
          ...item,
          productId: resolvedProduct.docId || item.productId || item.docId || null,
        },
        productRef: resolvedProduct.ref,
        productSnapshot: resolvedProduct.snapshot,
      });
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
        !productSnapshot?.exists()
      ) {
        const error = new Error("STOCK_PRODUCT_NOT_FOUND");
        error.productName = item.nombre || item.sku || "Producto";
        throw error;
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

      const reserved =
        Math.max(
          0,
          toNumber(
            product.stockReservado
          )
        );

      // Una venta directa/POS no puede consumir unidades reservadas.
      // Un Ticket puede consumir su propia reserva más el stock que siga libre,
      // pero nunca las unidades reservadas por otros tickets.
      const reservations =
        product.stockReservas && typeof product.stockReservas === "object"
          ? product.stockReservas
          : {};
      const ownReservation =
        pending.origen === "Ticket" && pending.ref
          ? Math.max(0, toNumber(reservations[pending.ref]))
          : 0;
      const reservedByOthers = Math.max(0, reserved - ownReservation);
      const available = Math.max(0, stock - reservedByOthers);

      if (
        quantity > 0 &&
        available < quantity
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
          available;

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
        !productSnapshot?.exists()
      ) {
        const error = new Error("STOCK_PRODUCT_NOT_FOUND");
        error.productName = item.nombre || item.sku || "Producto";
        throw error;
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

      const stockBefore =
        toNumber(
          product.stock
        );

      const reservedBefore =
        Math.max(
          0,
          toNumber(
            product.stockReservado
          )
        );

      const reservations =
        product.stockReservas &&
        typeof product.stockReservas ===
          "object"
          ? {
              ...product.stockReservas,
            }
          : {};

      const ticketReservation =
        pending.origen ===
          "Ticket" &&
        pending.ref
          ? Math.max(
              0,
              toNumber(
                reservations[
                  pending.ref
                ]
              )
            )
          : 0;

      const reservationConsumed =
        Math.min(
          ticketReservation,
          quantity
        );

      if (
        reservationConsumed >
          0 &&
        pending.ref
      ) {
        const remainingReservation =
          ticketReservation -
          reservationConsumed;

        if (
          remainingReservation >
          0
        ) {
          reservations[
            pending.ref
          ] =
            remainingReservation;
        } else {
          delete reservations[
            pending.ref
          ];
        }
      }

      const stockAfter =
        stockBefore -
        quantity;

      const reservedAfter =
        Math.max(
          0,
          reservedBefore -
            reservationConsumed
        );

      transaction.update(
        productRef,
        {
          stock:
            stockAfter,

          stockReservado:
            reservedAfter,

          stockReservas:
            reservations,

          actualizadoEn:
            nowISO,

          actualizadoPor:
            cleanAuthor,
        }
      );

      const stockMovementRef =
        doc(
          collection(
            db,
            "stock_movimientos"
          )
        );

      transaction.set(
        stockMovementRef,
        {
          id:
            stockMovementRef.id,

          tipo:
            "Salida",

          sku:
            cleanText(
              item.sku
            ),

          producto:
            product.nombre ||
            item.nombre ||
            item.sku,

          categoria:
            cleanText(
              product.categoria
            ),

          cantidad:
            -quantity,

          stockAntes:
            stockBefore,

          stockDespues:
            stockAfter,

          reservadoAntes:
            reservedBefore,

          reservadoDespues:
            reservedAfter,

          origen:
            pending.origen ||
            "Venta",

          referencia:
            cleanText(
              pending.ref ||
              pending.folio ||
              pending.id
            ),

          facturaId:
            invoiceId,

          observacion:
            pending.origen ===
            "Ticket"
              ? "Salida por cobro de Ticket."
              : "Salida por venta cobrada en Caja.",

          usuario:
            cleanAuthor,

          fecha:
            date,

          hora:
            time,

          creadoEn:
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

      const firstDueDate =
        addDaysISO(
          30
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

          capitalSolicitado:
            total,

          anticipo:
            0,

          capitalFinanciado:
            total,

          interesGlobal:
            0,

          interesMonto:
            0,

          original:
            total,

          saldo:
            total,

          cantidadCuotas:
            1,

          primerVencimiento:
            firstDueDate,

          abonos:
            [],

          gestiones:
            [],

          promesasPago:
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
                firstDueDate,
            },
          ],

          estado:
            "Activo",

          estadoAprobacion:
            "Aprobado",

          autorizacion:
            "Automática por cupo disponible",

          origen:
            "Caja",

          facturaId:
            invoiceId,

          ventaId:
            saleRef.id,

          ticketId:
            pending.origen ===
            "Ticket"
              ? pending.ref ||
                null
              : null,

          presupuestoId:
            pending.presupuestoId ||
            null,

          creadoEn:
            nowISO,

          actualizadoEn:
            nowISO,

          usuario:
            cleanAuthor,

          historial: [
            {
              fecha:
                nowISO,

              accion:
                "Crédito otorgado desde Caja",

              detalle:
                `Factura ${invoiceId} · Total financiado $${total.toLocaleString(
                  "es-AR"
                )}`,

              autor:
                cleanAuthor,
            },
          ],
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
      const previousBalance =
        toNumber(
          clientSnapshot
            .data()
            .saldoAFavor
        );

      const nextBalance =
        previousBalance -
        total;

      transaction.update(
        clientRef,
        {
          saldoAFavor:
            nextBalance,

          actualizadoEn:
            nowISO,
        }
      );

      const accountMovementId =
        `uso_factura_${invoiceId}`;

      transaction.set(
        doc(
          db,
          "cuenta_corriente",
          accountMovementId
        ),
        {
          id:
            accountMovementId,

          clienteId:
            pending.clienteId,

          cliente:
            pending.cliente ||
            "Cliente",

          tipo:
            "Débito",

          concepto:
            `Aplicación de saldo a favor · Factura ${invoiceId}`,

          importe:
            total,

          saldoAnterior:
            previousBalance,

          saldoPosterior:
            nextBalance,

          origen:
            "Cobro con saldo a favor",

          refId:
            invoiceId,

          facturaId:
            invoiceId,

          ventaId:
            saleRef.id,

          ticketId:
            pending.origen ===
            "Ticket"
              ? pending.ref ||
                null
              : null,

          fecha:
            toLocalISODate(now),

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

          usuario:
            cleanAuthor,
        }
      );
    }

    /* =======================================
       MOVIMIENTO DE CAJA
       
       Desde este punto todos los cobros generan un registro trazable.
       Los medios que representan ingreso real siguen usando tipo "ingreso".
       Saldo a favor y financiación quedan como "informativo" para que
       aparezcan en Movimientos sin alterar los totales de efectivo/ingresos.
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

    const cashMovementId =
      doc(
        collection(
          db,
          "negocio"
        )
      ).id;

    const movement = {
      id:
        cashMovementId,

      fecha:
        date,

      hora:
        time,

      creadoEn:
        nowISO,

      clase:
        "cobro",

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
        REAL_INCOME_METHODS.has(
          cleanMethod
        )
          ? "ingreso"
          : "informativo",

      monto:
        total,

      subcategoria:
        isFinanced
          ? "Financiación"
          : cleanMethod ===
              "Saldo a Favor"
            ? "Saldo a favor"
            : "Capital",

      medioPago:
        cleanMethod,

      referencia:
        cleanText(
          details.reference
        ) ||
        null,

      usuario:
        cleanAuthor,

      origen:
        pending.origen ||
        "Operación",

      origenRef:
        pending.ref ||
        pending.id,

      cliente:
        pending.cliente ||
        "Cliente",

      clienteId:
        pending.clienteId ||
        null,

      facturaId:
        invoiceId,

      ventaId:
        saleRef.id,

      ticketId:
        pending.origen ===
        "Ticket"
          ? pending.ref ||
            null
          : null,

      presupuestoId:
        pending.presupuestoId ||
        null,
    };

    transaction.set(
      cashRef,
      {
        // Una venta solo agrega movimientos. El fondo y la sesión de caja
        // pertenecen al permiso específico de Caja y no se reescriben desde Ventas.
        movs: [
          ...movements,
          movement,
        ],

        actualizadoEn:
          nowISO,
      },
      {
        merge: true,
      }
    );

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

        estadoPago:
          isFinanced
            ? "Financiado"
            : "Pagado",

        montoIngresado:
          REAL_INCOME_METHODS.has(
            cleanMethod
          )
            ? total
            : 0,

        montoFinanciado:
          isFinanced
            ? total
            : 0,

        creditoId:
          isFinanced
            ? creditRef.id
            : null,

        presupuestoId:
          pending.presupuestoId ||
          null,
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
          cleanText(
            clientSnapshot?.data()?.cuit ||
            clientSnapshot?.data()?.dni
          ) ||
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
          isFinanced
            ? "Financiado"
            : "Pagado Total",

        condicionPago:
          isFinanced
            ? "Financiado"
            : "Cancelado",

        montoCobrado:
          isFinanced
            ? 0
            : total,

        saldoPendiente:
          isFinanced
            ? total
            : 0,

        creditoId:
          isFinanced
            ? creditRef.id
            : null,

        ventaId:
          saleRef.id,

        presupuestoId:
          pending.presupuestoId ||
          null,

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
            isFinanced
              ? "Financiado"
              : "Pagado",

          estadoCaja:
            isFinanced
              ? "Financiado"
              : "Cobrado",

          estadoFacturacion:
            invoiceId,

          facturaId:
            invoiceId,

          creditoId:
            isFinanced
              ? creditRef.id
              : null,

          facturaAnulada:
            false,

          facturaAnuladaId:
            null,

          notaCreditoId:
            null,

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
                isFinanced
                  ? "Venta financiada y facturada"
                  : "Cobro registrado y Facturado",

              detalle:
                isFinanced
                  ? `Crédito ${creditRef.id} por $${total.toLocaleString(
                      "es-AR"
                    )} - Factura: ${invoiceId}`
                  : `Medio: ${cleanMethod} - Importe: $${total.toLocaleString(
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
            isFinanced
              ? "Financiado"
              : "Cobrado",

          estadoPago:
            isFinanced
              ? "Financiado"
              : "Pagado",

          facturaId:
            invoiceId,

          creditoId:
            isFinanced
              ? creditRef.id
              : null,

          facturaAnuladaId:
            null,

          notaCreditoId:
            null,

          actualizadoEn:
            nowISO,

          historial: [
            ...history,

            {
              fecha:
                historyDate,

              accion:
                isFinanced
                  ? "Financiado y facturado"
                  : "Cobrado y facturado",

              detalle:
                isFinanced
                  ? `Factura ${invoiceId}. Crédito ${creditRef.id}. Usuario: ${cleanAuthor}`
                  : `Factura ${invoiceId}. Medio: ${cleanMethod}. Usuario: ${cleanAuthor}`,
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

      paymentState:
        isFinanced
          ? "Financiado"
          : "Pagado",

      total,

      movementId:
        cashMovementId,

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
    roundMoney(
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

        clase:
          "manual",

        origen:
          "Caja",

        origenRef:
          null,
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
    roundMoney(
      Math.max(
        0,
        toNumber(
          newFund
        )
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