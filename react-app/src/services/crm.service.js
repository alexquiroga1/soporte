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
  { key: "prospecto", label: "Prospecto" },
  { key: "contactado", label: "Contactado" },
  { key: "propuesta", label: "Propuesta" },
  { key: "negociacion", label: "Negociación" },
  { key: "ganado", label: "Ganado" },
  { key: "perdido", label: "Perdido" },
];

export const CRM_ACTIVITY_TYPES = [
  "Llamada",
  "Email",
  "Reunión",
  "WhatsApp",
  "Nota",
];

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

function normalizeStage(value) {
  const stage = cleanText(value).toLowerCase();
  return CRM_STAGES.some((item) => item.key === stage)
    ? stage
    : "prospecto";
}

function getStageLabel(stage) {
  return CRM_STAGES.find((item) => item.key === normalizeStage(stage))?.label || "Prospecto";
}

function normalizeOpportunity(snapshotDoc) {
  const data = snapshotDoc.data() || {};
  return {
    id: snapshotDoc.id,
    ...data,
    stage: normalizeStage(data.stage),
    valor: Math.max(0, toNumber(data.valor)),
    probabilidad: clamp(toNumber(data.probabilidad || 0), 0, 100),
    archivado: data.archivado === true,
    historial: Array.isArray(data.historial) ? data.historial : [],
  };
}

export function subscribeToCRM(onData, onError) {
  return onSnapshot(
    collection(db, "crm"),
    (snapshot) => {
      const rows = snapshot.docs.map(normalizeOpportunity);
      rows.sort((a, b) =>
        String(b.actualizadoEn || b.creadoEn || "").localeCompare(
          String(a.actualizadoEn || a.creadoEn || "")
        )
      );
      onData(rows);
    },
    onError
  );
}

export function subscribeToCRMClients(onData, onError) {
  return onSnapshot(
    collection(db, "clientes"),
    (snapshot) => {
      const rows = snapshot.docs
        .map((snapshotDoc) => ({ id: snapshotDoc.id, ...snapshotDoc.data() }))
        .filter((client) => client.archivado !== true)
        .sort((a, b) => {
          const nameA = cleanText(a.razonSocial || `${a.nombre || ""} ${a.apellido || ""}`);
          const nameB = cleanText(b.razonSocial || `${b.nombre || ""} ${b.apellido || ""}`);
          return nameA.localeCompare(nameB, "es");
        });
      onData(rows);
    },
    onError
  );
}

export async function createOpportunity({
  clientId = null,
  contacto,
  empresa = "",
  telefono = "",
  email = "",
  interes,
  valor = 0,
  probabilidad = 10,
  fecha = "",
  proximoSeguimiento = "",
  origen = "Directo",
  stage = "prospecto",
  author = "Sistema",
}) {
  const cleanContact = cleanText(contacto);
  const cleanInterest = cleanText(interes);

  if (!cleanContact) throw new Error("CRM_CONTACT_REQUIRED");
  if (!cleanInterest) throw new Error("CRM_INTEREST_REQUIRED");

  const opportunityRef = doc(collection(db, "crm"));
  const nowISO = new Date().toISOString();
  const normalizedStage = normalizeStage(stage);

  const opportunity = {
    id: opportunityRef.id,
    clientId: cleanText(clientId) || null,
    contacto: cleanContact,
    empresa: cleanText(empresa) || "—",
    telefono: cleanText(telefono),
    email: cleanText(email).toLowerCase(),
    interes: cleanInterest,
    valor: Math.max(0, toNumber(valor)),
    probabilidad: clamp(toNumber(probabilidad), 0, 100),
    fecha: cleanText(fecha),
    proximoSeguimiento: cleanText(proximoSeguimiento),
    origen: cleanText(origen) || "Directo",
    stage: normalizedStage,
    archivado: false,
    creadoEn: nowISO,
    actualizadoEn: nowISO,
    usuario: cleanText(author) || "Sistema",
    historial: [
      {
        fecha: nowISO,
        tipo: "Sistema",
        accion: "Oportunidad creada",
        detalle: `Etapa inicial: ${getStageLabel(normalizedStage)}`,
        autor: cleanText(author) || "Sistema",
      },
    ],
  };

  await setDoc(opportunityRef, opportunity);
  return opportunity;
}

export async function updateOpportunity(
  opportunityId,
  {
    clientId = null,
    contacto,
    empresa = "",
    telefono = "",
    email = "",
    interes,
    valor = 0,
    probabilidad = 0,
    fecha = "",
    proximoSeguimiento = "",
    origen = "Directo",
    author = "Sistema",
  }
) {
  const id = cleanText(opportunityId);
  if (!id) throw new Error("CRM_ID_REQUIRED");

  const cleanContact = cleanText(contacto);
  const cleanInterest = cleanText(interes);
  if (!cleanContact) throw new Error("CRM_CONTACT_REQUIRED");
  if (!cleanInterest) throw new Error("CRM_INTEREST_REQUIRED");

  const updates = {
    clientId: cleanText(clientId) || null,
    contacto: cleanContact,
    empresa: cleanText(empresa) || "—",
    telefono: cleanText(telefono),
    email: cleanText(email).toLowerCase(),
    interes: cleanInterest,
    valor: Math.max(0, toNumber(valor)),
    probabilidad: clamp(toNumber(probabilidad), 0, 100),
    fecha: cleanText(fecha),
    proximoSeguimiento: cleanText(proximoSeguimiento),
    origen: cleanText(origen) || "Directo",
    actualizadoEn: new Date().toISOString(),
    actualizadoPor: cleanText(author) || "Sistema",
  };

  await updateDoc(doc(db, "crm", id), updates);
  return updates;
}

export async function updateOpportunityStage(opportunity, nextStage, author = "Sistema") {
  if (!opportunity?.id) throw new Error("CRM_ID_REQUIRED");

  const normalizedStage = normalizeStage(nextStage);
  if (opportunity.stage === normalizedStage) return normalizedStage;

  const nowISO = new Date().toISOString();
  const previousHistory = Array.isArray(opportunity.historial) ? opportunity.historial : [];
  const closing = ["ganado", "perdido"].includes(normalizedStage);

  await updateDoc(doc(db, "crm", opportunity.id), {
    stage: normalizedStage,
    actualizadoEn: nowISO,
    actualizadoPor: cleanText(author) || "Sistema",
    cerradoEn: closing ? nowISO : null,
    historial: [
      ...previousHistory,
      {
        fecha: nowISO,
        tipo: "Sistema",
        accion: "Cambio de etapa",
        detalle: `Oportunidad movida a “${getStageLabel(normalizedStage)}”`,
        autor: cleanText(author) || "Sistema",
      },
    ],
  });

  return normalizedStage;
}

export async function addOpportunityActivity(
  opportunity,
  {
    type = "Nota",
    note,
    nextFollowUp = "",
    author = "Sistema",
  }
) {
  if (!opportunity?.id) throw new Error("CRM_ID_REQUIRED");
  const cleanNote = cleanText(note);
  if (!cleanNote) throw new Error("CRM_ACTIVITY_REQUIRED");

  const nowISO = new Date().toISOString();
  const history = Array.isArray(opportunity.historial) ? opportunity.historial : [];
  const activity = {
    fecha: nowISO,
    tipo: cleanText(type) || "Nota",
    accion: "Gestión comercial",
    detalle: cleanNote,
    proximoSeguimiento: cleanText(nextFollowUp),
    autor: cleanText(author) || "Sistema",
  };

  await updateDoc(doc(db, "crm", opportunity.id), {
    historial: [...history, activity],
    proximoSeguimiento: cleanText(nextFollowUp) || opportunity.proximoSeguimiento || "",
    ultimaGestionEn: nowISO,
    actualizadoEn: nowISO,
    actualizadoPor: cleanText(author) || "Sistema",
  });

  return activity;
}

export async function archiveOpportunity(opportunity, author = "Sistema") {
  if (!opportunity?.id) throw new Error("CRM_ID_REQUIRED");
  const nowISO = new Date().toISOString();
  const history = Array.isArray(opportunity.historial) ? opportunity.historial : [];
  await updateDoc(doc(db, "crm", opportunity.id), {
    archivado: true,
    archivadoEn: nowISO,
    actualizadoEn: nowISO,
    actualizadoPor: cleanText(author) || "Sistema",
    historial: [
      ...history,
      {
        fecha: nowISO,
        tipo: "Sistema",
        accion: "Oportunidad archivada",
        detalle: "El registro se conserva para auditoría comercial.",
        autor: cleanText(author) || "Sistema",
      },
    ],
  });
}

export async function restoreOpportunity(opportunity, author = "Sistema") {
  if (!opportunity?.id) throw new Error("CRM_ID_REQUIRED");
  const nowISO = new Date().toISOString();
  const history = Array.isArray(opportunity.historial) ? opportunity.historial : [];
  await updateDoc(doc(db, "crm", opportunity.id), {
    archivado: false,
    archivadoEn: null,
    actualizadoEn: nowISO,
    actualizadoPor: cleanText(author) || "Sistema",
    historial: [
      ...history,
      {
        fecha: nowISO,
        tipo: "Sistema",
        accion: "Oportunidad restaurada",
        detalle: "La oportunidad volvió al pipeline activo.",
        autor: cleanText(author) || "Sistema",
      },
    ],
  });
}

/* Compatibilidad con código anterior. La UI nueva no borra oportunidades. */
export async function deleteOpportunity(opportunityId) {
  const id = cleanText(opportunityId);
  if (!id) throw new Error("CRM_ID_REQUIRED");
  await deleteDoc(doc(db, "crm", id));
  return id;
}
