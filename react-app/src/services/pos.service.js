import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
} from "firebase/firestore";

import { db } from "./firebase.js";

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
}

export function getClientDisplayName(
  client,
  fallback = "Mostrador"
) {
  if (!client) {
    return fallback;
  }

  return (
    cleanText(
      client.razonSocial
    ) ||
    cleanText(
      `${client.nombre || ""} ${client.apellido || ""}`
    ) ||
    cleanText(
      client.name
    ) ||
    cleanText(
      client.cliente
    ) ||
    fallback
  );
}

function isService(product) {
  return (
    cleanText(
      product?.categoria
    ).toLowerCase() ===
    "servicios"
  );
}

function isPromotionActive(
  promotion
) {
  if (!promotion) {
    return false;
  }

  if (
    promotion.activa === false ||
    promotion.activo === false
  ) {
    return false;
  }

  const expiration =
    cleanText(
      promotion.vence ||
      promotion.fechaVencimiento ||
      promotion.vigencia
    );

  if (!expiration) {
    return true;
  }

  const today =
    new Date();

  today.setHours(
    0,
    0,
    0,
    0
  );

  const date =
    new Date(
      `${expiration}T00:00:00`
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return true;
  }

  return date >= today;
}

function promotionAppliesToProduct(
  promotion,
  product
) {
  if (
    !promotion ||
    !product
  ) {
    return false;
  }

  const appliesTo =
    cleanText(
      promotion.aplicaA ||
      promotion.aplica ||
      promotion.categoria ||
      "Todos"
    );

  if (
    !appliesTo ||
    appliesTo.toLowerCase() ===
      "todos"
  ) {
    return true;
  }

  return (
    appliesTo.toLowerCase() ===
    cleanText(
      product.categoria
    ).toLowerCase()
  );
}

/* =========================================
   SUSCRIPCIONES
========================================= */

export function subscribeToPosProducts(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "productos"
    ),

    (
      snapshot
    ) => {
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

export function subscribeToPosPromotions(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "promociones"
    ),

    (
      snapshot
    ) => {
      const rows =
        snapshot.docs
          .map(
            (
              documentSnapshot
            ) => ({
              id:
                documentSnapshot.id,

              ...documentSnapshot.data(),
            })
          )
          .filter(
            isPromotionActive
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

export function subscribeToPosClients(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "clientes"
    ),

    (
      snapshot
    ) => {
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
          getClientDisplayName(
            a
          ).localeCompare(
            getClientDisplayName(
              b
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

export function subscribeToPosSales(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "ventas"
    ),

    (
      snapshot
    ) => {
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
            `${a.fecha || ""} ${a.hora || ""}`;

          const right =
            `${b.fecha || ""} ${b.hora || ""}`;

          return right.localeCompare(
            left
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

export function subscribeToPosBusiness(
  onData,
  onError
) {
  return onSnapshot(
    doc(
      db,
      "negocio",
      "configuracion"
    ),

    (
      snapshot
    ) => {
      onData(
        snapshot.exists()
          ? {
              id:
                snapshot.id,

              ...snapshot.data(),
            }
          : {
              impuesto:
                21,
            }
      );
    },

    onError
  );
}

/* =========================================
   TOTALES
========================================= */

export function calculatePosTotals({
  cart = [],
  promotion = null,
  taxRate = 21,
}) {
  const safeCart =
    Array.isArray(
      cart
    )
      ? cart
      : [];

  const subtotal =
    safeCart.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Math.max(
          0,
          toNumber(
            item.precio
          )
        ) *
        Math.max(
          0,
          toNumber(
            item.cantidad
          )
        ),
      0
    );

  let discount =
    0;

  if (
    promotion &&
    isPromotionActive(
      promotion
    ) &&
    safeCart.length
  ) {
    const type =
      cleanText(
        promotion.tipo
      ).toLowerCase();

    const value =
      Math.max(
        0,
        toNumber(
          promotion.valor
        )
      );

    const applicableSubtotal =
      safeCart.reduce(
        (
          sum,
          item
        ) => {
          if (
            !promotionAppliesToProduct(
              promotion,
              item
            )
          ) {
            return sum;
          }

          return (
            sum +
            Math.max(
              0,
              toNumber(
                item.precio
              )
            ) *
              Math.max(
                0,
                toNumber(
                  item.cantidad
                )
              )
          );
        },
        0
      );

    if (
      type.includes(
        "porcentaje"
      )
    ) {
      discount =
        applicableSubtotal *
        (
          Math.min(
            100,
            value
          ) /
          100
        );
    } else if (
      type.includes(
        "monto"
      )
    ) {
      discount =
        applicableSubtotal > 0
          ? value
          : 0;
    }
  }

  discount =
    Math.min(
      subtotal,
      Math.max(
        0,
        discount
      )
    );

  const taxableBase =
    Math.max(
      0,
      subtotal -
        discount
    );

  const normalizedTaxRate =
    Math.max(
      0,
      toNumber(
        taxRate
      )
    );

  const tax =
    taxableBase *
    (
      normalizedTaxRate /
      100
    );

  const total =
    taxableBase +
    tax;

  return {
    subtotal,
    discount,
    taxableBase,
    taxRate:
      normalizedTaxRate,
    tax,
    total,
  };
}

/* =========================================
   ENVIAR VENTA A CAJA
========================================= */

export async function sendPosSaleToCash({
  cart,
  client = null,
  promotion = null,
  taxRate = 21,
  author = "Mostrador",
}) {
  const safeCart =
    Array.isArray(
      cart
    )
      ? cart
      : [];

  const cleanAuthor =
    cleanText(
      author
    ) ||
    "Mostrador";

  if (
    !safeCart.length
  ) {
    throw new Error(
      "POS_CART_EMPTY"
    );
  }

  const normalizedCart =
    safeCart.map(
      (
        item
      ) => ({
        productId:
          cleanText(
            item.productId ||
            item.id ||
            item.sku
          ),

        sku:
          cleanText(
            item.sku
          ),

        nombre:
          cleanText(
            item.nombre
          ) ||
          "Producto",

        categoria:
          cleanText(
            item.categoria
          ),

        cantidad:
          Math.max(
            1,
            Math.trunc(
              toNumber(
                item.cantidad
              )
            ) ||
              1
          ),

        precio:
          Math.max(
            0,
            toNumber(
              item.precio
            )
          ),
      })
    );

  if (
    normalizedCart.some(
      (
        item
      ) =>
        !item.sku
    )
  ) {
    throw new Error(
      "POS_PRODUCT_INVALID"
    );
  }

  const totals =
    calculatePosTotals({
      cart:
        normalizedCart,

      promotion,

      taxRate,
    });

  if (
    totals.total <= 0
  ) {
    throw new Error(
      "POS_TOTAL_INVALID"
    );
  }

  const countersRef =
    doc(
      db,
      "negocio",
      "contadores"
    );

  return runTransaction(
    db,

    async (
      transaction
    ) => {
      /* =====================================
         CONTADORES
      ===================================== */

      const countersSnapshot =
        await transaction.get(
          countersRef
        );

      /* =====================================
         PRODUCTOS
      ===================================== */

      const productReads =
        [];

      for (
        const item of
        normalizedCart
      ) {
        /*
         * El proyecto actual utiliza
         * productos/{sku}.
         *
         * Acá solamente validamos stock.
         * El stock se descuenta cuando Caja
         * confirma efectivamente el cobro.
         */

        const productRef =
          doc(
            db,
            "productos",
            item.sku
          );

        const productSnapshot =
          await transaction.get(
            productRef
          );

        productReads.push({
          item,
          productRef,
          productSnapshot,
        });
      }

      /* =====================================
         VALIDAR EXISTENCIA Y STOCK
      ===================================== */

      for (
        const {
          item,
          productSnapshot,
        } of productReads
      ) {
        if (
          !productSnapshot.exists()
        ) {
          const error =
            new Error(
              "POS_PRODUCT_NOT_FOUND"
            );

          error.productName =
            item.nombre;

          throw error;
        }

        const product =
          productSnapshot.data();

        /*
         * Servicios no manejan stock físico.
         */

        if (
          isService(
            product
          )
        ) {
          continue;
        }

        const stock =
          Math.max(
            0,
            toNumber(
              product.stock
            )
          );

        if (
          stock <
          item.cantidad
        ) {
          const error =
            new Error(
              "POS_STOCK_INSUFFICIENT"
            );

          error.productName =
            product.nombre ||
            item.nombre;

          error.available =
            stock;

          error.required =
            item.cantidad;

          throw error;
        }
      }

      /* =====================================
         NÚMERO DE VENTA
      ===================================== */

      const currentCounter =
        countersSnapshot.exists()
          ? toNumber(
              countersSnapshot
                .data()
                ?.ventas
            )
          : 0;

      const folioNumber =
        currentCounter > 0
          ? currentCounter
          : 1000;

      const nextCounter =
        folioNumber +
        1;

      const folio =
        `V-${folioNumber}`;

      /* =====================================
         PENDIENTE DE CAJA
      ===================================== */

      const pendingId =
        `venta_${folio.replace(
          /[^a-zA-Z0-9_-]/g,
          "_"
        )}`;

      const pendingRef =
        doc(
          db,
          "caja_pendientes",
          pendingId
        );

      const pendingSnapshot =
        await transaction.get(
          pendingRef
        );

      if (
        pendingSnapshot.exists()
      ) {
        throw new Error(
          "POS_PENDING_EXISTS"
        );
      }

      /* =====================================
         CLIENTE
      ===================================== */

      const now =
        new Date();

      const nowISO =
        now.toISOString();

      const clientName =
        client
          ? getClientDisplayName(
              client,
              "Mostrador"
            )
          : "Mostrador";

      /* =====================================
         PROMOCIÓN
      ===================================== */

      const promoName =
        promotion
          ? cleanText(
              promotion.nombre
            )
          : "";

      const promoText =
        promoName &&
        totals.discount > 0
          ? ` (Promo aplicada: ${promoName})`
          : "";

      /* =====================================
         CONCEPTO
      ===================================== */

      const concept =
        normalizedCart
          .map(
            (
              item
            ) =>
              `${item.cantidad}x ${item.nombre}`
          )
          .join(
            ", "
          ) +
        promoText;

      /* =====================================
         DATOS PARA CAJA
      ===================================== */

      const pendingData = {
        id:
          pendingId,

        origen:
          "Venta",

        ref:
          folio,

        clienteId:
          client?.id ||
          null,

        cliente:
          clientName,

        concepto:
          concept,

        total:
          totals.total,

        subtotal:
          totals.subtotal,

        descuento:
          totals.discount,

        baseImponible:
          totals.taxableBase,

        impuestoPorcentaje:
          totals.taxRate,

        impuestoMonto:
          totals.tax,

        promocionId:
          promotion?.id ||
          null,

        promocionNombre:
          promoName ||
          null,

        articulosCart:
          normalizedCart,

        estado:
          "Pendiente",

        creadoEn:
          nowISO,

        actualizadoEn:
          nowISO,

        usuario:
          cleanAuthor,
      };

      /* =====================================
         GUARDAR
      ===================================== */

      transaction.set(
        countersRef,
        {
          ventas:
            nextCounter,
        },
        {
          merge:
            true,
        }
      );

      transaction.set(
        pendingRef,
        pendingData
      );

      /* =====================================
         RESULTADO
      ===================================== */

      return {
        pendingId,
        folio,
        total:
          totals.total,
        clientName,
      };
    }
  );
}