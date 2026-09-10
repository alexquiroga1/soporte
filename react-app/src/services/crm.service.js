import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { db } from "./firebase.js";

export const CRM_STAGES = [
  {
    key: "prospecto",
    label: "Prospecto",
  },
  {
    key: "contactado",
    label: "Contactado",
  },
  {
    key: "propuesta",
    label: "Propuesta",
  },
  {
    key: "negociacion",
    label: "Negociación",
  },
  {
    key: "ganado",
    label: "Ganado",
  },
  {
    key: "perdido",
    label: "Perdido",
  },
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

function normalizeStage(value) {
  const stage =
    cleanText(value)
      .toLowerCase();

  return CRM_STAGES.some(
    (item) =>
      item.key === stage
  )
    ? stage
    : "prospecto";
}

/* =========================================
   SUSCRIPCIÓN EN TIEMPO REAL
========================================= */

export function subscribeToCRM(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "crm"
    ),

    (snapshot) => {
      const rows =
        snapshot.docs.map(
          (
            snapshotDoc
          ) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),

            stage:
              normalizeStage(
                snapshotDoc
                  .data()
                  ?.stage
              ),
          })
        );

      rows.sort(
        (
          a,
          b
        ) =>
          String(
            b.actualizadoEn ||
            b.creadoEn ||
            ""
          ).localeCompare(
            String(
              a.actualizadoEn ||
              a.creadoEn ||
              ""
            )
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
   CREAR OPORTUNIDAD
========================================= */

export async function createOpportunity({
  contacto,
  empresa = "—",
  interes,
  valor = 0,
  fecha = "Sin fecha",
  stage = "prospecto",
  author = "Sistema",
}) {
  const cleanContact =
    cleanText(
      contacto
    );

  const cleanInterest =
    cleanText(
      interes
    );

  if (
    !cleanContact
  ) {
    throw new Error(
      "CRM_CONTACT_REQUIRED"
    );
  }

  if (
    !cleanInterest
  ) {
    throw new Error(
      "CRM_INTEREST_REQUIRED"
    );
  }

  const opportunityRef =
    doc(
      collection(
        db,
        "crm"
      )
    );

  const nowISO =
    new Date()
      .toISOString();

  const normalizedStage =
    normalizeStage(
      stage
    );

  const stageLabel =
    CRM_STAGES.find(
      (item) =>
        item.key ===
        normalizedStage
    )?.label ||
    "Prospecto";

  const opportunity = {
    id:
      opportunityRef.id,

    contacto:
      cleanContact,

    empresa:
      cleanText(
        empresa
      ) ||
      "—",

    interes:
      cleanInterest,

    valor:
      Math.max(
        0,
        toNumber(
          valor
        )
      ),

    fecha:
      cleanText(
        fecha
      ) ||
      "Sin fecha",

    stage:
      normalizedStage,

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      cleanText(
        author
      ) ||
      "Sistema",

    historial: [
      {
        fecha:
          nowISO,

        accion:
          "Oportunidad creada",

        detalle:
          `Etapa inicial: ${stageLabel}`,

        autor:
          cleanText(
            author
          ) ||
          "Sistema",
      },
    ],
  };

  await setDoc(
    opportunityRef,
    opportunity
  );

  return opportunity;
}

/* =========================================
   ACTUALIZAR DATOS
========================================= */

export async function updateOpportunity(
  opportunityId,
  {
    contacto,
    empresa = "—",
    interes,
    valor = 0,
    fecha = "Sin fecha",
    author = "Sistema",
  }
) {
  const id =
    cleanText(
      opportunityId
    );

  if (
    !id
  ) {
    throw new Error(
      "CRM_ID_REQUIRED"
    );
  }

  const cleanContact =
    cleanText(
      contacto
    );

  const cleanInterest =
    cleanText(
      interes
    );

  if (
    !cleanContact
  ) {
    throw new Error(
      "CRM_CONTACT_REQUIRED"
    );
  }

  if (
    !cleanInterest
  ) {
    throw new Error(
      "CRM_INTEREST_REQUIRED"
    );
  }

  const nowISO =
    new Date()
      .toISOString();

  const updates = {
    contacto:
      cleanContact,

    empresa:
      cleanText(
        empresa
      ) ||
      "—",

    interes:
      cleanInterest,

    valor:
      Math.max(
        0,
        toNumber(
          valor
        )
      ),

    fecha:
      cleanText(
        fecha
      ) ||
      "Sin fecha",

    actualizadoEn:
      nowISO,

    actualizadoPor:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await updateDoc(
    doc(
      db,
      "crm",
      id
    ),
    updates
  );

  return updates;
}

/* =========================================
   CAMBIAR ETAPA
========================================= */

export async function updateOpportunityStage(
  opportunity,
  nextStage,
  author = "Sistema"
) {
  if (
    !opportunity?.id
  ) {
    throw new Error(
      "CRM_ID_REQUIRED"
    );
  }

  const normalizedStage =
    normalizeStage(
      nextStage
    );

  if (
    opportunity.stage ===
    normalizedStage
  ) {
    return normalizedStage;
  }

  const stageLabel =
    CRM_STAGES.find(
      (item) =>
        item.key ===
        normalizedStage
    )?.label ||
    normalizedStage;

  const nowISO =
    new Date()
      .toISOString();

  const previousHistory =
    Array.isArray(
      opportunity.historial
    )
      ? opportunity.historial
      : [];

  await updateDoc(
    doc(
      db,
      "crm",
      opportunity.id
    ),

    {
      stage:
        normalizedStage,

      actualizadoEn:
        nowISO,

      actualizadoPor:
        cleanText(
          author
        ) ||
        "Sistema",

      historial: [
        ...previousHistory,

        {
          fecha:
            nowISO,

          accion:
            "Cambio de etapa",

          detalle:
            `Oportunidad movida a "${stageLabel}"`,

          autor:
            cleanText(
              author
            ) ||
            "Sistema",
        },
      ],
    }
  );

  return normalizedStage;
}

/* =========================================
   ELIMINAR OPORTUNIDAD
========================================= */

export async function deleteOpportunity(
  opportunityId
) {
  const id =
    cleanText(
      opportunityId
    );

  if (
    !id
  ) {
    throw new Error(
      "CRM_ID_REQUIRED"
    );
  }

  await deleteDoc(
    doc(
      db,
      "crm",
      id
    )
  );

  return id;
}