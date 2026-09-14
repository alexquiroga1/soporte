import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase.js";

export const PRODUCT_CATEGORIES = [
  "Componentes",
  "Almacenamiento",
  "Memorias",
  "Perifericos",
  "Accesorios",
  "Insumos",
  "Repuestos",
  "Equipos",
  "Servicios",
];

export const PROMOTION_TYPES = [
  "Porcentaje (%)",
  "Monto Fijo ($)",
];

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toInteger(value) {
  return Math.max(0, Math.trunc(toNumber(value)));
}

function normalizeSku(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function addDaysISO(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function buildRandomSku() {
  return `SKU-${Math.floor(Math.random() * 9000 + 1000)}`;
}

function buildStockMovementId() {
  const now = new Date();
  const compact = now
    .toISOString()
    .replace(/[-:TZ.]/g, "")
    .slice(0, 14);
  const suffix = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `STK-${compact}-${suffix}`;
}

function isServiceCategory(category) {
  return cleanText(category).toLowerCase() === "servicios";
}

function normalizeProductType(category, explicitType) {
  if (cleanText(explicitType).toLowerCase() === "servicio") {
    return "Servicio";
  }

  return isServiceCategory(category) ? "Servicio" : "Producto";
}

function buildCostHistory(previous = [], oldCost, newCost, author, reason) {
  const history = Array.isArray(previous) ? [...previous] : [];
  const before = Math.max(0, toNumber(oldCost));
  const after = Math.max(0, toNumber(newCost));

  if (before === after) {
    return history;
  }

  history.push({
    anterior: before,
    nuevo: after,
    motivo: cleanText(reason) || "Actualización de costo",
    usuario: cleanText(author) || "Sistema",
    fecha: new Date().toISOString(),
  });

  return history.slice(-40);
}

function createMovementData({
  id,
  type,
  product,
  quantity,
  stockBefore,
  stockAfter,
  reservedBefore,
  reservedAfter,
  origin,
  reference,
  supplier,
  unitCost,
  note,
  author,
}) {
  const now = new Date();

  return {
    id,
    tipo: cleanText(type) || "Ajuste",
    sku: cleanText(product?.sku || product?.id),
    producto: cleanText(product?.nombre) || "Producto",
    categoria: cleanText(product?.categoria),
    cantidad: toNumber(quantity),
    stockAntes: toNumber(stockBefore),
    stockDespues: toNumber(stockAfter),
    reservadoAntes: toNumber(reservedBefore),
    reservadoDespues: toNumber(reservedAfter),
    origen: cleanText(origin) || "Inventario",
    referencia: cleanText(reference),
    proveedor: cleanText(supplier),
    costoUnitario: Math.max(0, toNumber(unitCost)),
    observacion: cleanText(note),
    usuario: cleanText(author) || "Sistema",
    fecha: now.toISOString().split("T")[0],
    hora: now.toLocaleTimeString("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    creadoEn: now.toISOString(),
  };
}

export function subscribeToProducts(onData, onError) {
  return onSnapshot(
    collection(db, "productos"),
    (snapshot) => {
      const rows = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      rows.sort((a, b) =>
        cleanText(a.nombre).localeCompare(cleanText(b.nombre), "es")
      );

      onData(rows);
    },
    onError
  );
}

export function subscribeToStockMovements(onData, onError) {
  return onSnapshot(
    collection(db, "stock_movimientos"),
    (snapshot) => {
      const rows = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      rows.sort((a, b) =>
        cleanText(b.creadoEn).localeCompare(cleanText(a.creadoEn))
      );

      onData(rows);
    },
    onError
  );
}

export function subscribeToPromotions(onData, onError) {
  return onSnapshot(
    collection(db, "promociones"),
    (snapshot) => {
      const rows = snapshot.docs.map((documentSnapshot) => ({
        id: documentSnapshot.id,
        ...documentSnapshot.data(),
      }));

      rows.sort((a, b) => {
        const left = cleanText(a.vence);
        const right = cleanText(b.vence);

        if (left !== right) {
          return right.localeCompare(left);
        }

        return cleanText(a.nombre).localeCompare(cleanText(b.nombre), "es");
      });

      onData(rows);
    },
    onError
  );
}

export async function createProduct({
  nombre,
  sku,
  categoria,
  tipo,
  costo = 0,
  precio,
  stock,
  stockMin = 0,
  proveedor = "—",
  ubicacion = "",
  codigoBarras = "",
  author = "Sistema",
}) {
  const cleanName = cleanText(nombre);
  const cleanCategory = cleanText(categoria);
  const cleanSupplier = cleanText(proveedor) || "—";
  const cleanAuthor = cleanText(author) || "Sistema";
  const normalizedSku = normalizeSku(sku) || buildRandomSku();
  const cleanType = normalizeProductType(cleanCategory, tipo);
  const numericCost = Math.max(0, toNumber(costo));
  const numericPrice = Math.max(0, toNumber(precio));
  const numericStock = toInteger(stock);
  const numericMinStock = toInteger(stockMin);
  const service = cleanType === "Servicio";

  if (!cleanName) {
    throw new Error("PRODUCT_NAME_REQUIRED");
  }

  if (!PRODUCT_CATEGORIES.includes(cleanCategory)) {
    throw new Error("PRODUCT_CATEGORY_INVALID");
  }

  if (numericPrice <= 0) {
    throw new Error("PRODUCT_PRICE_REQUIRED");
  }

  const productRef = doc(db, "productos", normalizedSku);
  const movementId = buildStockMovementId();
  const movementRef = doc(db, "stock_movimientos", movementId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productRef);

    if (snapshot.exists()) {
      throw new Error("PRODUCT_SKU_EXISTS");
    }

    const nowISO = new Date().toISOString();
    const effectiveStock = service ? 0 : numericStock;
    const effectiveMinStock = service ? 0 : numericMinStock;

    const product = {
      id: normalizedSku,
      sku: normalizedSku,
      nombre: cleanName,
      categoria: service ? "Servicios" : cleanCategory,
      tipo: service ? "Servicio" : "Producto",
      costo: numericCost,
      precio: numericPrice,
      stock: effectiveStock,
      stockReservado: 0,
      stockMin: effectiveMinStock,
      stockMax: service
        ? 0
        : Math.max(effectiveStock, effectiveMinStock * 2, 10),
      proveedor: cleanSupplier,
      ubicacion: cleanText(ubicacion),
      codigoBarras: cleanText(codigoBarras),
      vendidos: 0,
      activo: true,
      costoHistorial: [],
      ultimaCompra: effectiveStock > 0 ? nowISO : null,
      creadoEn: nowISO,
      actualizadoEn: nowISO,
      usuario: cleanAuthor,
      actualizadoPor: cleanAuthor,
    };

    transaction.set(productRef, product);

    if (!service && effectiveStock > 0) {
      transaction.set(
        movementRef,
        createMovementData({
          id: movementId,
          type: "Ingreso",
          product,
          quantity: effectiveStock,
          stockBefore: 0,
          stockAfter: effectiveStock,
          reservedBefore: 0,
          reservedAfter: 0,
          origin: "Alta de producto",
          reference: normalizedSku,
          supplier: cleanSupplier,
          unitCost: numericCost,
          note: "Stock inicial registrado al crear el artículo.",
          author: cleanAuthor,
        })
      );
    }

    return product;
  });
}

export async function updateProduct(
  sku,
  {
    nombre,
    categoria,
    tipo,
    costo = 0,
    precio,
    stockMin = 0,
    proveedor = "—",
    ubicacion = "",
    codigoBarras = "",
    author = "Sistema",
  }
) {
  const normalizedSku = normalizeSku(sku);
  const cleanName = cleanText(nombre);
  const cleanCategory = cleanText(categoria);
  const cleanSupplier = cleanText(proveedor) || "—";
  const cleanAuthor = cleanText(author) || "Sistema";
  const cleanType = normalizeProductType(cleanCategory, tipo);
  const numericCost = Math.max(0, toNumber(costo));
  const numericPrice = Math.max(0, toNumber(precio));
  const numericMinStock = toInteger(stockMin);

  if (!normalizedSku) {
    throw new Error("PRODUCT_SKU_REQUIRED");
  }

  if (!cleanName) {
    throw new Error("PRODUCT_NAME_REQUIRED");
  }

  if (!PRODUCT_CATEGORIES.includes(cleanCategory)) {
    throw new Error("PRODUCT_CATEGORY_INVALID");
  }

  if (numericPrice <= 0) {
    throw new Error("PRODUCT_PRICE_REQUIRED");
  }

  const productRef = doc(db, "productos", normalizedSku);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productRef);

    if (!snapshot.exists()) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const previous = snapshot.data();
    const service = cleanType === "Servicio";
    const nowISO = new Date().toISOString();

    if (
      service &&
      (toNumber(previous.stock) > 0 || toNumber(previous.stockReservado) > 0)
    ) {
      throw new Error("PRODUCT_HAS_STOCK");
    }

    const updates = {
      nombre: cleanName,
      categoria: service ? "Servicios" : cleanCategory,
      tipo: service ? "Servicio" : "Producto",
      costo: numericCost,
      precio: numericPrice,
      stockMin: service ? 0 : numericMinStock,
      proveedor: cleanSupplier,
      ubicacion: cleanText(ubicacion),
      codigoBarras: cleanText(codigoBarras),
      stock: service ? 0 : toInteger(previous.stock),
      stockReservado: service ? 0 : toInteger(previous.stockReservado),
      stockMax: service
        ? 0
        : Math.max(
            toInteger(previous.stockMax),
            toInteger(previous.stock),
            numericMinStock * 2,
            10
          ),
      costoHistorial: buildCostHistory(
        previous.costoHistorial,
        previous.costo,
        numericCost,
        cleanAuthor,
        "Edición de ficha"
      ),
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthor,
    };

    transaction.update(productRef, updates);

    return {
      id: normalizedSku,
      sku: normalizedSku,
      ...previous,
      ...updates,
    };
  });
}

export async function registerStockEntry({
  sku,
  cantidad,
  costoUnitario,
  proveedor = "",
  referencia = "",
  observacion = "",
  author = "Sistema",
}) {
  const normalizedSku = normalizeSku(sku);
  const quantity = toInteger(cantidad);
  const unitCost = Math.max(0, toNumber(costoUnitario));
  const cleanAuthor = cleanText(author) || "Sistema";

  if (!normalizedSku) {
    throw new Error("PRODUCT_SKU_REQUIRED");
  }

  if (quantity <= 0) {
    throw new Error("STOCK_QUANTITY_INVALID");
  }

  const productRef = doc(db, "productos", normalizedSku);
  const movementId = buildStockMovementId();
  const movementRef = doc(db, "stock_movimientos", movementId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productRef);

    if (!snapshot.exists()) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const product = snapshot.data();

    if (isServiceCategory(product.categoria) || product.tipo === "Servicio") {
      throw new Error("SERVICE_HAS_NO_STOCK");
    }

    const stockBefore = toInteger(product.stock);
    const stockAfter = stockBefore + quantity;
    const reserved = toInteger(product.stockReservado);
    const nowISO = new Date().toISOString();
    const supplier = cleanText(proveedor) || cleanText(product.proveedor) || "—";
    const effectiveCost = unitCost > 0 ? unitCost : Math.max(0, toNumber(product.costo));

    const updates = {
      stock: stockAfter,
      stockMax: Math.max(toInteger(product.stockMax), stockAfter, 10),
      proveedor: supplier,
      costo: effectiveCost,
      ultimaCompra: nowISO,
      costoHistorial: buildCostHistory(
        product.costoHistorial,
        product.costo,
        effectiveCost,
        cleanAuthor,
        cleanText(referencia) || "Ingreso de stock"
      ),
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthor,
    };

    transaction.update(productRef, updates);
    transaction.set(
      movementRef,
      createMovementData({
        id: movementId,
        type: "Ingreso",
        product: { ...product, sku: normalizedSku },
        quantity,
        stockBefore,
        stockAfter,
        reservedBefore: reserved,
        reservedAfter: reserved,
        origin: "Ingreso manual",
        reference: referencia,
        supplier,
        unitCost: effectiveCost,
        note: observacion,
        author: cleanAuthor,
      })
    );

    return {
      movementId,
      stockBefore,
      stockAfter,
      product: {
        id: normalizedSku,
        sku: normalizedSku,
        ...product,
        ...updates,
      },
    };
  });
}

export async function adjustStock({
  sku,
  conteoFisico,
  motivo,
  observacion = "",
  author = "Sistema",
}) {
  const normalizedSku = normalizeSku(sku);
  const targetStock = toInteger(conteoFisico);
  const cleanReason = cleanText(motivo);
  const cleanAuthor = cleanText(author) || "Sistema";

  if (!normalizedSku) {
    throw new Error("PRODUCT_SKU_REQUIRED");
  }

  if (!cleanReason) {
    throw new Error("STOCK_REASON_REQUIRED");
  }

  const productRef = doc(db, "productos", normalizedSku);
  const movementId = buildStockMovementId();
  const movementRef = doc(db, "stock_movimientos", movementId);

  return runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(productRef);

    if (!snapshot.exists()) {
      throw new Error("PRODUCT_NOT_FOUND");
    }

    const product = snapshot.data();

    if (isServiceCategory(product.categoria) || product.tipo === "Servicio") {
      throw new Error("SERVICE_HAS_NO_STOCK");
    }

    const stockBefore = toInteger(product.stock);
    const reserved = toInteger(product.stockReservado);

    if (targetStock < reserved) {
      throw new Error("STOCK_BELOW_RESERVED");
    }

    const difference = targetStock - stockBefore;

    if (difference === 0) {
      throw new Error("STOCK_NO_CHANGE");
    }

    const nowISO = new Date().toISOString();

    transaction.update(productRef, {
      stock: targetStock,
      stockMax: Math.max(toInteger(product.stockMax), targetStock, 10),
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthor,
    });

    transaction.set(
      movementRef,
      createMovementData({
        id: movementId,
        type: "Ajuste",
        product: { ...product, sku: normalizedSku },
        quantity: difference,
        stockBefore,
        stockAfter: targetStock,
        reservedBefore: reserved,
        reservedAfter: reserved,
        origin: "Ajuste manual",
        reference: cleanReason,
        supplier: product.proveedor,
        unitCost: product.costo,
        note: observacion,
        author: cleanAuthor,
      })
    );

    return {
      movementId,
      difference,
      stockBefore,
      stockAfter: targetStock,
    };
  });
}


/* =========================================
   RESERVAS DE STOCK POR TICKET
   Se usan dentro de transacciones de Presupuestos/Tickets para que
   una pieza aprobada deje de estar disponible para una venta directa.
========================================= */

function aggregateTicketPieces(pieces = []) {
  const result = new Map();

  for (const piece of Array.isArray(pieces) ? pieces : []) {
    const sku = normalizeSku(piece?.sku);
    const quantity = Math.max(0, Math.trunc(toNumber(piece?.cant ?? piece?.cantidad)));

    if (!sku || quantity <= 0) continue;
    result.set(sku, (result.get(sku) || 0) + quantity);
  }

  return result;
}

export async function reserveTicketStockInTransaction(
  transaction,
  {
    ticketId,
    pieces = [],
    author = "Sistema",
    reference = "",
  } = {}
) {
  const cleanTicketId = cleanText(ticketId);
  const cleanAuthor = cleanText(author) || "Sistema";
  const requested = aggregateTicketPieces(pieces);

  if (!cleanTicketId || requested.size === 0) {
    return { reserved: 0, items: [] };
  }

  // Firestore exige realizar todas las lecturas antes de las escrituras.
  const reads = [];

  for (const [sku, quantity] of requested.entries()) {
    const productRef = doc(db, "productos", sku);
    const snapshot = await transaction.get(productRef);
    reads.push({ sku, quantity, productRef, snapshot });
  }

  const prepared = [];

  for (const { sku, quantity, productRef, snapshot } of reads) {
    // Un concepto con SKU histórico/manual que ya no existe en catálogo
    // no debe bloquear la aprobación del presupuesto. Simplemente no
    // participa de la reserva automática.
    if (!snapshot.exists()) {
      continue;
    }

    const product = snapshot.data();

    if (isServiceCategory(product.categoria) || product.tipo === "Servicio") {
      continue;
    }

    const stock = toInteger(product.stock);
    const reservations =
      product.stockReservas && typeof product.stockReservas === "object"
        ? { ...product.stockReservas }
        : {};
    const previousForTicket = Math.max(0, toInteger(reservations[cleanTicketId]));
    const reservedBefore = Math.max(0, toInteger(product.stockReservado));
    const reservedOther = Math.max(0, reservedBefore - previousForTicket);
    const availableForTicket = Math.max(0, stock - reservedOther);

    if (quantity > availableForTicket) {
      const error = new Error("STOCK_RESERVATION_INSUFFICIENT");
      error.productName = product.nombre || sku;
      error.sku = sku;
      error.available = availableForTicket;
      error.required = quantity;
      throw error;
    }

    reservations[cleanTicketId] = quantity;
    const reservedAfter = reservedOther + quantity;
    const delta = quantity - previousForTicket;

    prepared.push({
      sku,
      quantity,
      delta,
      product,
      productRef,
      reservations,
      stock,
      reservedBefore,
      reservedAfter,
    });
  }

  const nowISO = new Date().toISOString();
  let totalDelta = 0;

  for (const item of prepared) {
    transaction.update(item.productRef, {
      stockReservas: item.reservations,
      stockReservado: item.reservedAfter,
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthor,
    });

    if (item.delta !== 0) {
      const movementId = buildStockMovementId();
      const movementRef = doc(db, "stock_movimientos", movementId);

      transaction.set(
        movementRef,
        createMovementData({
          id: movementId,
          type: "Reserva",
          product: { ...item.product, sku: item.sku },
          quantity: item.delta,
          stockBefore: item.stock,
          stockAfter: item.stock,
          reservedBefore: item.reservedBefore,
          reservedAfter: item.reservedAfter,
          origin: "Ticket",
          reference: cleanText(reference) || cleanTicketId,
          supplier: item.product.proveedor,
          unitCost: item.product.costo,
          note: `Reserva de stock para Ticket ${cleanTicketId}.`,
          author: cleanAuthor,
        })
      );
    }

    totalDelta += item.delta;
  }

  return {
    reserved: totalDelta,
    items: prepared.map((item) => ({
      sku: item.sku,
      quantity: item.quantity,
      delta: item.delta,
    })),
  };
}

export async function releaseTicketStockInTransaction(
  transaction,
  {
    ticketId,
    pieces = [],
    author = "Sistema",
    reference = "",
    reason = "Reserva liberada",
  } = {}
) {
  const cleanTicketId = cleanText(ticketId);
  const requested = aggregateTicketPieces(pieces);
  const cleanAuthor = cleanText(author) || "Sistema";

  if (!cleanTicketId || requested.size === 0) {
    return { released: 0, items: [] };
  }

  const reads = [];

  for (const sku of requested.keys()) {
    const productRef = doc(db, "productos", sku);
    const snapshot = await transaction.get(productRef);
    reads.push({ sku, productRef, snapshot });
  }

  const prepared = [];

  for (const { sku, productRef, snapshot } of reads) {
    if (!snapshot.exists()) continue;

    const product = snapshot.data();
    if (isServiceCategory(product.categoria) || product.tipo === "Servicio") continue;

    const reservations =
      product.stockReservas && typeof product.stockReservas === "object"
        ? { ...product.stockReservas }
        : {};
    const existing = Math.max(0, toInteger(reservations[cleanTicketId]));

    if (existing <= 0) continue;

    delete reservations[cleanTicketId];

    const reservedBefore = Math.max(0, toInteger(product.stockReservado));
    const reservedAfter = Math.max(0, reservedBefore - existing);

    prepared.push({
      sku,
      product,
      productRef,
      reservations,
      existing,
      stock: toInteger(product.stock),
      reservedBefore,
      reservedAfter,
    });
  }

  const nowISO = new Date().toISOString();
  let released = 0;

  for (const item of prepared) {
    transaction.update(item.productRef, {
      stockReservas: item.reservations,
      stockReservado: item.reservedAfter,
      actualizadoEn: nowISO,
      actualizadoPor: cleanAuthor,
    });

    const movementId = buildStockMovementId();
    const movementRef = doc(db, "stock_movimientos", movementId);

    transaction.set(
      movementRef,
      createMovementData({
        id: movementId,
        type: "Liberación",
        product: { ...item.product, sku: item.sku },
        quantity: -item.existing,
        stockBefore: item.stock,
        stockAfter: item.stock,
        reservedBefore: item.reservedBefore,
        reservedAfter: item.reservedAfter,
        origin: "Ticket",
        reference: cleanText(reference) || cleanTicketId,
        supplier: item.product.proveedor,
        unitCost: item.product.costo,
        note: `${cleanText(reason) || "Reserva liberada"}. Ticket ${cleanTicketId}.`,
        author: cleanAuthor,
      })
    );

    released += item.existing;
  }

  return {
    released,
    items: prepared.map((item) => ({ sku: item.sku, quantity: item.existing })),
  };
}

export async function deleteProduct(sku) {
  const normalizedSku = normalizeSku(sku);

  if (!normalizedSku) {
    throw new Error("PRODUCT_SKU_REQUIRED");
  }

  await deleteDoc(doc(db, "productos", normalizedSku));

  return normalizedSku;
}

/* =========================================
   PROMOCIONES
   Se conserva la API porque otros módulos/registro histórico
   todavía pueden depender de ella, aunque la nueva vista de
   Catálogo y Stock ya no las usa como eje principal.
========================================= */

export async function createPromotion({
  nombre,
  tipo,
  valor,
  aplicaA = "Todos",
  vence,
  author = "Sistema",
}) {
  const cleanName = cleanText(nombre);
  const cleanType = cleanText(tipo);
  const cleanApplies = cleanText(aplicaA) || "Todos";
  const cleanAuthor = cleanText(author) || "Sistema";
  const numericValue = Math.max(0, toNumber(valor));
  const expiration = cleanText(vence) || addDaysISO(30);

  if (!cleanName) {
    throw new Error("PROMOTION_NAME_REQUIRED");
  }

  if (!PROMOTION_TYPES.includes(cleanType)) {
    throw new Error("PROMOTION_TYPE_INVALID");
  }

  if (numericValue <= 0) {
    throw new Error("PROMOTION_VALUE_INVALID");
  }

  if (cleanType === "Porcentaje (%)" && numericValue > 100) {
    throw new Error("PROMOTION_PERCENT_INVALID");
  }

  if (
    cleanApplies !== "Todos" &&
    !PRODUCT_CATEGORIES.includes(cleanApplies)
  ) {
    throw new Error("PROMOTION_CATEGORY_INVALID");
  }

  const id = `PRM-${Date.now()}`;
  const promoRef = doc(db, "promociones", id);
  const nowISO = new Date().toISOString();

  const promotion = {
    id,
    nombre: cleanName,
    tipo: cleanType,
    valor: numericValue,
    aplicaA: cleanApplies,
    vence: expiration,
    activa: true,
    creadoEn: nowISO,
    actualizadoEn: nowISO,
    usuario: cleanAuthor,
  };

  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(promoRef);

    if (snapshot.exists()) {
      throw new Error("PROMOTION_ID_EXISTS");
    }

    transaction.set(promoRef, promotion);
  });

  return promotion;
}

export async function togglePromotion(promotion) {
  if (!promotion?.id) {
    throw new Error("PROMOTION_NOT_FOUND");
  }

  const nextState = !Boolean(promotion.activa);

  await updateDoc(doc(db, "promociones", promotion.id), {
    activa: nextState,
    actualizadoEn: new Date().toISOString(),
  });

  return nextState;
}
