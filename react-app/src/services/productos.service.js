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
  "Perifericos",
  "Accesorios",
  "Insumos",
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

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

function normalizeSku(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function addDaysISO(days) {
  const date = new Date();

  date.setDate(
    date.getDate() + days
  );

  return date
    .toISOString()
    .split("T")[0];
}

function buildRandomSku() {
  return `SKU-${Math.floor(
    Math.random() * 9000 + 1000
  )}`;
}

/* =========================================
   PRODUCTOS - SUSCRIPCIÓN
========================================= */

export function subscribeToProducts(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "productos"
    ),

    (snapshot) => {
      const rows =
        snapshot.docs.map(
          (
            documentSnapshot
          ) => ({
            id:
              documentSnapshot.id,

            ...documentSnapshot.data(),
          })
        );

      rows.sort(
        (
          a,
          b
        ) =>
          cleanText(
            a.nombre
          ).localeCompare(
            cleanText(
              b.nombre
            ),
            "es"
          )
      );

      onData(
        rows
      );
    },

    onError
  );
}

/* =========================================
   PROMOCIONES - SUSCRIPCIÓN
========================================= */

export function subscribeToPromotions(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "promociones"
    ),

    (snapshot) => {
      const rows =
        snapshot.docs.map(
          (
            documentSnapshot
          ) => ({
            id:
              documentSnapshot.id,

            ...documentSnapshot.data(),
          })
        );

      rows.sort(
        (
          a,
          b
        ) => {
          const left =
            cleanText(
              a.vence
            );

          const right =
            cleanText(
              b.vence
            );

          if (
            left !== right
          ) {
            return right.localeCompare(
              left
            );
          }

          return cleanText(
            a.nombre
          ).localeCompare(
            cleanText(
              b.nombre
            ),
            "es"
          );
        }
      );

      onData(
        rows
      );
    },

    onError
  );
}

/* =========================================
   CREAR PRODUCTO
========================================= */

export async function createProduct({
  nombre,
  sku,
  categoria,
  precio,
  stock,
  proveedor = "—",
  author = "Sistema",
}) {
  const cleanName =
    cleanText(
      nombre
    );

  const cleanCategory =
    cleanText(
      categoria
    );

  const cleanSupplier =
    cleanText(
      proveedor
    ) ||
    "—";

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  const normalizedSku =
    normalizeSku(
      sku
    ) ||
    buildRandomSku();

  const numericPrice =
    Math.max(
      0,
      toNumber(
        precio
      )
    );

  const numericStock =
    Math.max(
      0,
      Math.trunc(
        toNumber(
          stock
        )
      )
    );

  if (
    !cleanName
  ) {
    throw new Error(
      "PRODUCT_NAME_REQUIRED"
    );
  }

  if (
    !PRODUCT_CATEGORIES.includes(
      cleanCategory
    )
  ) {
    throw new Error(
      "PRODUCT_CATEGORY_INVALID"
    );
  }

  const productRef =
    doc(
      db,
      "productos",
      normalizedSku
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          productRef
        );

      if (
        snapshot.exists()
      ) {
        throw new Error(
          "PRODUCT_SKU_EXISTS"
        );
      }

      const service =
        cleanCategory ===
        "Servicios";

      const nowISO =
        new Date()
          .toISOString();

      const product = {
        id:
          normalizedSku,

        sku:
          normalizedSku,

        nombre:
          cleanName,

        categoria:
          cleanCategory,

        precio:
          numericPrice,

        stock:
          service
            ? 0
            : numericStock,

        stockMax:
          service
            ? 0
            : Math.max(
                numericStock,
                10
              ),

        proveedor:
          cleanSupplier,

        vendidos:
          0,

        creadoEn:
          nowISO,

        actualizadoEn:
          nowISO,

        usuario:
          cleanAuthor,
      };

      transaction.set(
        productRef,
        product
      );

      return product;
    }
  );
}

/* =========================================
   ACTUALIZAR PRODUCTO
========================================= */

export async function updateProduct(
  sku,
  {
    nombre,
    categoria,
    precio,
    stock,
    proveedor = "—",
    author = "Sistema",
  }
) {
  const normalizedSku =
    normalizeSku(
      sku
    );

  const cleanName =
    cleanText(
      nombre
    );

  const cleanCategory =
    cleanText(
      categoria
    );

  const cleanSupplier =
    cleanText(
      proveedor
    ) ||
    "—";

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  const numericPrice =
    Math.max(
      0,
      toNumber(
        precio
      )
    );

  const numericStock =
    Math.max(
      0,
      Math.trunc(
        toNumber(
          stock
        )
      )
    );

  if (
    !normalizedSku
  ) {
    throw new Error(
      "PRODUCT_SKU_REQUIRED"
    );
  }

  if (
    !cleanName
  ) {
    throw new Error(
      "PRODUCT_NAME_REQUIRED"
    );
  }

  if (
    !PRODUCT_CATEGORIES.includes(
      cleanCategory
    )
  ) {
    throw new Error(
      "PRODUCT_CATEGORY_INVALID"
    );
  }

  const productRef =
    doc(
      db,
      "productos",
      normalizedSku
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          productRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "PRODUCT_NOT_FOUND"
        );
      }

      const previous =
        snapshot.data();

      const service =
        cleanCategory ===
        "Servicios";

      const nowISO =
        new Date()
          .toISOString();

      const updates = {
        nombre:
          cleanName,

        categoria:
          cleanCategory,

        precio:
          numericPrice,

        stock:
          service
            ? 0
            : numericStock,

        stockMax:
          service
            ? 0
            : Math.max(
                numericStock,
                toNumber(
                  previous.stockMax
                ) ||
                  10
              ),

        proveedor:
          cleanSupplier,

        actualizadoEn:
          nowISO,

        actualizadoPor:
          cleanAuthor,
      };

      transaction.update(
        productRef,
        updates
      );

      return {
        id:
          normalizedSku,

        sku:
          normalizedSku,

        ...previous,

        ...updates,
      };
    }
  );
}

/* =========================================
   ELIMINAR PRODUCTO
========================================= */

export async function deleteProduct(
  sku
) {
  const normalizedSku =
    normalizeSku(
      sku
    );

  if (
    !normalizedSku
  ) {
    throw new Error(
      "PRODUCT_SKU_REQUIRED"
    );
  }

  await deleteDoc(
    doc(
      db,
      "productos",
      normalizedSku
    )
  );

  return normalizedSku;
}

/* =========================================
   CREAR PROMOCIÓN
========================================= */

export async function createPromotion({
  nombre,
  tipo,
  valor,
  aplicaA = "Todos",
  vence,
  author = "Sistema",
}) {
  const cleanName =
    cleanText(
      nombre
    );

  const cleanType =
    cleanText(
      tipo
    );

  const cleanApplies =
    cleanText(
      aplicaA
    ) ||
    "Todos";

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Sistema";

  const numericValue =
    Math.max(
      0,
      toNumber(
        valor
      )
    );

  const expiration =
    cleanText(
      vence
    ) ||
    addDaysISO(
      30
    );

  if (
    !cleanName
  ) {
    throw new Error(
      "PROMOTION_NAME_REQUIRED"
    );
  }

  if (
    !PROMOTION_TYPES.includes(
      cleanType
    )
  ) {
    throw new Error(
      "PROMOTION_TYPE_INVALID"
    );
  }

  if (
    numericValue <= 0
  ) {
    throw new Error(
      "PROMOTION_VALUE_INVALID"
    );
  }

  if (
    cleanType ===
      "Porcentaje (%)" &&
    numericValue > 100
  ) {
    throw new Error(
      "PROMOTION_PERCENT_INVALID"
    );
  }

  if (
    cleanApplies !==
      "Todos" &&
    !PRODUCT_CATEGORIES.includes(
      cleanApplies
    )
  ) {
    throw new Error(
      "PROMOTION_CATEGORY_INVALID"
    );
  }

  const id =
    `PRM-${Date.now()}`;

  const promoRef =
    doc(
      db,
      "promociones",
      id
    );

  const nowISO =
    new Date()
      .toISOString();

  const promotion = {
    id,

    nombre:
      cleanName,

    tipo:
      cleanType,

    valor:
      numericValue,

    aplicaA:
      cleanApplies,

    vence:
      expiration,

    activa:
      true,

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      cleanAuthor,
  };

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          promoRef
        );

      if (
        snapshot.exists()
      ) {
        throw new Error(
          "PROMOTION_ID_EXISTS"
        );
      }

      transaction.set(
        promoRef,
        promotion
      );
    }
  );

  return promotion;
}

/* =========================================
   ACTIVAR / DESACTIVAR PROMOCIÓN
========================================= */

export async function togglePromotion(
  promotion
) {
  if (
    !promotion?.id
  ) {
    throw new Error(
      "PROMOTION_NOT_FOUND"
    );
  }

  const nextState =
    !Boolean(
      promotion.activa
    );

  await updateDoc(
    doc(
      db,
      "promociones",
      promotion.id
    ),

    {
      activa:
        nextState,

      actualizadoEn:
        new Date()
          .toISOString(),
    }
  );

  return nextState;
}