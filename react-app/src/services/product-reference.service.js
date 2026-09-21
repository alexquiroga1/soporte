import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  where,
} from "firebase/firestore";

import { db } from "./firebase.js";

function cleanText(value) {
  return String(value ?? "").trim();
}

function normalizeSku(value) {
  return cleanText(value)
    .toUpperCase()
    .replace(/\s+/g, "-")
    .replace(/[^A-Z0-9_-]/g, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

/**
 * Resuelve el documento real de un producto durante una transacción.
 *
 * Los registros nuevos usan productId/docId. Para datos legacy donde el ID de
 * Firestore no coincide con el SKU, hace fallback por los campos `sku` e `id`.
 * El documento final se vuelve a leer con transaction.get() para que el stock
 * quede protegido por la transacción.
 */
export async function resolveProductForTransaction(transaction, identity = {}) {
  const rawSku = cleanText(identity?.sku);
  const normalizedSku = normalizeSku(rawSku);
  const explicitDocId = cleanText(identity?.productId || identity?.productoId || identity?.docId);
  const directId = explicitDocId || normalizedSku || rawSku;

  let directRef = null;
  let directSnapshot = null;

  if (directId) {
    directRef = doc(db, "productos", directId);
    directSnapshot = await transaction.get(directRef);

    if (directSnapshot.exists()) {
      return {
        ref: directRef,
        snapshot: directSnapshot,
        docId: directSnapshot.id,
        sku: cleanText(directSnapshot.data()?.sku) || normalizedSku || rawSku,
      };
    }
  }

  const skuCandidates = unique([rawSku, normalizedSku]);

  for (const field of ["sku", "id"]) {
    for (const candidate of skuCandidates) {
      const lookup = query(
        collection(db, "productos"),
        where(field, "==", candidate),
        limit(2)
      );
      const matches = await getDocs(lookup);

      if (!matches.empty) {
        const matchedRef = matches.docs[0].ref;
        const matchedSnapshot = await transaction.get(matchedRef);

        if (matchedSnapshot.exists()) {
          return {
            ref: matchedRef,
            snapshot: matchedSnapshot,
            docId: matchedSnapshot.id,
            sku: cleanText(matchedSnapshot.data()?.sku) || normalizedSku || rawSku,
          };
        }
      }
    }
  }

  return {
    ref: directRef,
    snapshot: directSnapshot,
    docId: directId || null,
    sku: normalizedSku || rawSku || null,
  };
}
