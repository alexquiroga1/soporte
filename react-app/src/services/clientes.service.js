import {
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  updateDoc,
  writeBatch,
} from "firebase/firestore";

import { db } from "./firebase.js";

function cleanText(value) {
  return String(value ?? "").trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function onlyNumbers(value) {
  return cleanText(value).replace(/\D/g, "");
}

function normalizeEmail(value) {
  return cleanText(value).toLowerCase();
}

function addDaysISO(days, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}

function clientMatchesRecord(client, record) {
  if (!client || !record) return false;

  if (
    record.clienteId &&
    record.clienteId === client.id
  ) {
    return true;
  }

  const recordName =
    cleanText(
      record.cliente
    ).toLowerCase();

  const clientName =
    getClientDisplayName(
      client
    ).toLowerCase();

  return Boolean(
    recordName &&
    clientName &&
    recordName === clientName
  );
}

/* =========================================
   NOMBRE CLIENTE
========================================= */

export function getClientDisplayName(
  client,
  fallback = "Cliente"
) {
  if (!client) {
    return fallback;
  }

  return (
    cleanText(
      client.razonSocial
    ) ||
    cleanText(
      `${
        client.nombre || ""
      } ${
        client.apellido || ""
      }`
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

/* =========================================
   DOCUMENTO CLIENTE
========================================= */

export function getClientDocument(
  client
) {
  return (
    cleanText(
      client?.cuit
    ) ||
    cleanText(
      client?.dni
    ) ||
    cleanText(
      client?.doc
    ) ||
    "—"
  );
}

/* =========================================
   CLIENTES REALTIME
========================================= */

export function subscribeToClients(
  onData,
  onError
) {
  return onSnapshot(
    collection(
      db,
      "clientes"
    ),

    (snapshot) => {
      const rows =
        snapshot.docs.map(
          (snapshotDoc) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),
          })
        );

      rows.sort(
        (a, b) =>
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

/* =========================================
   ÍNDICE DE ACTIVIDAD
========================================= */

export function subscribeToClientActivityIndex(
  onData,
  onError
) {
  let tickets = [];
  let sales = [];
  let credits = [];

  const emit =
    () => {
      onData({
        tickets,
        sales,
        credits,
      });
    };

  const unsubTickets =
    onSnapshot(
      collection(
        db,
        "tickets"
      ),

      (snapshot) => {
        tickets =
          snapshot.docs.map(
            (item) => ({
              id:
                item.id,

              ...item.data(),
            })
          );

        emit();
      },

      onError
    );

  const unsubSales =
    onSnapshot(
      collection(
        db,
        "ventas"
      ),

      (snapshot) => {
        sales =
          snapshot.docs.map(
            (item) => ({
              id:
                item.id,

              ...item.data(),
            })
          );

        emit();
      },

      onError
    );

  const unsubCredits =
    onSnapshot(
      collection(
        db,
        "creditos"
      ),

      (snapshot) => {
        credits =
          snapshot.docs.map(
            (item) => ({
              id:
                item.id,

              ...item.data(),
            })
          );

        emit();
      },

      onError
    );

  return () => {
    unsubTickets();
    unsubSales();
    unsubCredits();
  };
}

/* =========================================
   ACTIVIDAD CLIENTE
========================================= */

export function getClientActivity(
  client,
  index
) {
  const tickets =
    (
      index?.tickets ||
      []
    ).filter(
      (row) =>
        clientMatchesRecord(
          client,
          row
        )
    );

  const sales =
    (
      index?.sales ||
      []
    ).filter(
      (row) =>
        clientMatchesRecord(
          client,
          row
        )
    );

  const credits =
    (
      index?.credits ||
      []
    ).filter(
      (row) =>
        clientMatchesRecord(
          client,
          row
        )
    );

  const activeCredits =
    credits.filter(
      (row) =>
        toNumber(
          row.saldo
        ) > 0
    );

  const paidCredits =
    credits.filter(
      (row) =>
        toNumber(
          row.saldo
        ) <= 0
    );

  const debt =
    activeCredits.reduce(
      (sum, row) =>
        sum +
        toNumber(
          row.saldo
        ),

      0
    );

  const purchases =
    sales.reduce(
      (sum, row) =>
        sum +
        toNumber(
          row.total
        ),

      0
    );

  const limit =
    toNumber(
      client?.limiteCredito
    );

  return {
    tickets,
    sales,
    credits,
    activeCredits,
    paidCredits,
    debt,
    purchases,
    limit,

    availableCredit:
      Math.max(
        0,
        limit -
        debt
      ),
  };
}

/* =========================================
   CREAR CLIENTE
========================================= */

export async function createClient({
  nombre,
  apellido = "",
  dni = "",
  cuit = "",
  direccion = "",
  provincia = "",
  localidad = "",
  barrio = "",
  tel = "",
  email = "",
  limiteCredito = 0,
  author = "Sistema",
}) {
  const cleanName =
    cleanText(
      nombre
    );

  const cleanLastName =
    cleanText(
      apellido
    );

  const cleanDni =
    onlyNumbers(
      dni
    );

  const cleanCuit =
    onlyNumbers(
      cuit
    );

  const cleanPhone =
    onlyNumbers(
      tel
    );

  const cleanEmail =
    normalizeEmail(
      email
    );

  const numericLimit =
    Math.max(
      0,
      toNumber(
        limiteCredito
      )
    );

  if (!cleanName) {
    throw new Error(
      "CLIENT_NAME_REQUIRED"
    );
  }

  /* =======================================
     CONTROL DUPLICADOS
  ======================================= */

  const existingSnapshot =
    await getDocs(
      collection(
        db,
        "clientes"
      )
    );

  const duplicate =
    existingSnapshot.docs.find(
      (snapshotDoc) => {
        const row =
          snapshotDoc.data();

        if (
          cleanCuit &&
          onlyNumbers(
            row.cuit
          ) === cleanCuit
        ) {
          return true;
        }

        if (
          cleanDni &&
          onlyNumbers(
            row.dni
          ) === cleanDni
        ) {
          return true;
        }

        if (
          cleanEmail &&
          normalizeEmail(
            row.email
          ) === cleanEmail
        ) {
          return true;
        }

        if (
          cleanPhone &&
          onlyNumbers(
            row.tel
          ) === cleanPhone
        ) {
          return true;
        }

        return false;
      }
    );

  if (duplicate) {
    const error =
      new Error(
        "CLIENT_DUPLICATE"
      );

    error.clientId =
      duplicate.id;

    throw error;
  }

  /* =======================================
     CREAR DOCUMENTO
  ======================================= */

  const clientRef =
    doc(
      collection(
        db,
        "clientes"
      )
    );

  const nowISO =
    new Date()
      .toISOString();

  const client = {
    id:
      clientRef.id,

    nombre:
      cleanName,

    apellido:
      cleanLastName,

    dni:
      cleanDni,

    cuit:
      cleanCuit,

    tipo:
      "Regular",

    contacto:
      cleanName,

    direccion:
      cleanText(
        direccion
      ) ||
      "—",

    provincia:
      cleanText(
        provincia
      ),

    localidad:
      cleanText(
        localidad
      ),

    barrio:
      cleanText(
        barrio
      ),

    tel:
      cleanText(
        tel
      ) ||
      "—",

    email:
      cleanEmail ||
      "—",

    equipos:
      [],

    compras:
      [],

    notas:
      [],

    limiteCredito:
      numericLimit,

    saldoAFavor:
      0,

    archivado:
      false,

    creadoEn:
      nowISO,

    actualizadoEn:
      nowISO,

    usuario:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await setDoc(
    clientRef,
    client
  );

  return client;
}

/* =========================================
   EDITAR CLIENTE
========================================= */

export async function updateClient(
  clientId,
  {
    nombre,
    apellido = "",
    dni = "",
    cuit = "",
    direccion = "",
    provincia = "",
    localidad = "",
    barrio = "",
    tel = "",
    email = "",
    author = "Sistema",
  }
) {
  const id =
    cleanText(
      clientId
    );

  if (!id) {
    throw new Error(
      "CLIENT_ID_REQUIRED"
    );
  }

  const cleanName =
    cleanText(
      nombre
    );

  if (!cleanName) {
    throw new Error(
      "CLIENT_NAME_REQUIRED"
    );
  }

  const updates = {
    nombre:
      cleanName,

    apellido:
      cleanText(
        apellido
      ),

    dni:
      onlyNumbers(
        dni
      ),

    cuit:
      onlyNumbers(
        cuit
      ),

    contacto:
      cleanName,

    direccion:
      cleanText(
        direccion
      ) ||
      "—",

    provincia:
      cleanText(
        provincia
      ),

    localidad:
      cleanText(
        localidad
      ),

    barrio:
      cleanText(
        barrio
      ),

    tel:
      cleanText(
        tel
      ) ||
      "—",

    email:
      normalizeEmail(
        email
      ) ||
      "—",

    actualizadoEn:
      new Date()
        .toISOString(),

    actualizadoPor:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await updateDoc(
    doc(
      db,
      "clientes",
      id
    ),

    updates
  );

  return updates;
}

/* =========================================
   ARCHIVAR / RESTAURAR CLIENTE

   Archivar NO elimina historial.

   Se bloquea si el cliente todavía tiene:
   - Tickets abiertos
   - Créditos con saldo
   - Cobros pendientes
   - Saldo a favor
========================================= */

export async function setClientArchived(
  client,
  archived = true,
  author = "Sistema"
) {
  if (!client?.id) {
    throw new Error(
      "CLIENT_ID_REQUIRED"
    );
  }

  const nextArchived =
    Boolean(
      archived
    );

  const nowISO =
    new Date()
      .toISOString();

  const authorName =
    cleanText(
      author
    ) ||
    "Sistema";

  /* =======================================
     VALIDACIONES PARA ARCHIVAR
  ======================================= */

  if (
    nextArchived
  ) {
    const balance =
      toNumber(
        client.saldoAFavor
      );

    if (
      Math.abs(
        balance
      ) > 0.0001
    ) {
      const error =
        new Error(
          "CLIENT_ARCHIVE_BLOCKED"
        );

      error.reasons = [
        `Tiene saldo a favor pendiente (${balance}).`,
      ];

      throw error;
    }

    const [
      ticketsSnapshot,
      creditsSnapshot,
      cashSnapshot,
    ] =
      await Promise.all([
        getDocs(
          collection(
            db,
            "tickets"
          )
        ),

        getDocs(
          collection(
            db,
            "creditos"
          )
        ),

        getDocs(
          collection(
            db,
            "caja_pendientes"
          )
        ),
      ]);

    const closedTicketStages = [
      "entregado",
      "cancelado",
      "noreparable",
    ];

    const closedCashStates = [
      "cobrado",
      "pagado",
      "procesado",
      "finalizado",
      "cancelado",
    ];

    const activeTickets =
      ticketsSnapshot.docs
        .map(
          (snapshotDoc) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),
          })
        )
        .filter(
          (row) =>
            clientMatchesRecord(
              client,
              row
            ) &&
            !closedTicketStages.includes(
              cleanText(
                row.stage
              ).toLowerCase()
            )
        );

    const activeCredits =
      creditsSnapshot.docs
        .map(
          (snapshotDoc) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),
          })
        )
        .filter(
          (row) =>
            clientMatchesRecord(
              client,
              row
            ) &&
            toNumber(
              row.saldo
            ) >
              0
        );

    const pendingCash =
      cashSnapshot.docs
        .map(
          (snapshotDoc) => ({
            id:
              snapshotDoc.id,

            ...snapshotDoc.data(),
          })
        )
        .filter(
          (row) => {
            if (
              !clientMatchesRecord(
                client,
                row
              )
            ) {
              return false;
            }

            const status =
              cleanText(
                row.estado ||
                  row.status
              ).toLowerCase();

            return (
              !closedCashStates.includes(
                status
              )
            );
          }
        );

    const reasons = [];

    if (
      activeTickets.length
    ) {
      reasons.push(
        `Tiene ${
          activeTickets.length
        } ticket${
          activeTickets.length === 1
            ? ""
            : "s"
        } todavía abierto${
          activeTickets.length === 1
            ? ""
            : "s"
        }.`
      );
    }

    if (
      activeCredits.length
    ) {
      const debt =
        activeCredits.reduce(
          (sum, credit) =>
            sum +
            toNumber(
              credit.saldo
            ),

          0
        );

      reasons.push(
        `Tiene ${
          activeCredits.length
        } crédito${
          activeCredits.length === 1
            ? ""
            : "s"
        } con saldo pendiente por ${debt}.`
      );
    }

    if (
      pendingCash.length
    ) {
      reasons.push(
        `Tiene ${
          pendingCash.length
        } operación${
          pendingCash.length === 1
            ? ""
            : "es"
        } pendiente${
          pendingCash.length === 1
            ? ""
            : "s"
        } en Caja.`
      );
    }

    if (
      reasons.length
    ) {
      const error =
        new Error(
          "CLIENT_ARCHIVE_BLOCKED"
        );

      error.reasons =
        reasons;

      error.activeTickets =
        activeTickets.length;

      error.activeCredits =
        activeCredits.length;

      error.pendingCash =
        pendingCash.length;

      throw error;
    }
  }

  /* =======================================
     ACTUALIZAR ESTADO
  ======================================= */

  const updates =
    nextArchived
      ? {
          archivado:
            true,

          archivadoEn:
            nowISO,

          archivadoPor:
            authorName,

          actualizadoEn:
            nowISO,

          actualizadoPor:
            authorName,
        }
      : {
          archivado:
            false,

          restauradoEn:
            nowISO,

          restauradoPor:
            authorName,

          actualizadoEn:
            nowISO,

          actualizadoPor:
            authorName,
        };

  await updateDoc(
    doc(
      db,
      "clientes",
      client.id
    ),

    updates
  );

  return {
    id:
      client.id,

    archived:
      nextArchived,

    ...updates,
  };
}

/* =========================================
   ELIMINAR CLIENTE

   SOLO PERMITE BORRAR UN CLIENTE
   SIN HISTORIAL ASOCIADO.
========================================= */

export async function deleteClient(
  client
) {
  if (!client?.id) {
    throw new Error(
      "CLIENT_ID_REQUIRED"
    );
  }

  const balance =
    toNumber(
      client.saldoAFavor
    );

  if (
    Math.abs(
      balance
    ) > 0.0001
  ) {
    const error =
      new Error(
        "CLIENT_BALANCE_EXISTS"
      );

    error.balance =
      balance;

    throw error;
  }

  const collectionsToCheck = [
    [
      "tickets",
      "tickets",
    ],

    [
      "creditos",
      "creditos",
    ],

    [
      "ventas",
      "ventas",
    ],

    [
      "facturas",
      "facturas",
    ],

    [
      "presupuestos",
      "presupuestos",
    ],

    [
      "caja_pendientes",
      "cajaPendientes",
    ],

    [
      "cuenta_corriente",
      "cuentaCorriente",
    ],
  ];

  const snapshots =
    await Promise.all(
      collectionsToCheck.map(
        ([collectionName]) =>
          getDocs(
            collection(
              db,
              collectionName
            )
          )
      )
    );

  const references = {};

  collectionsToCheck.forEach(
    (
      [, key],
      index
    ) => {
      references[key] =
        snapshots[
          index
        ].docs.filter(
          (
            snapshotDoc
          ) =>
            clientMatchesRecord(
              client,

              {
                id:
                  snapshotDoc.id,

                ...snapshotDoc.data(),
              }
            )
        ).length;
    }
  );

  const totalReferences =
    Object.values(
      references
    ).reduce(
      (sum, value) =>
        sum +
        toNumber(
          value
        ),

      0
    );

  if (
    totalReferences >
    0
  ) {
    const error =
      new Error(
        "CLIENT_HAS_ACTIVITY"
      );

    error.references =
      references;

    error.totalReferences =
      totalReferences;

    throw error;
  }

  await deleteDoc(
    doc(
      db,
      "clientes",
      client.id
    )
  );

  return {
    id:
      client.id,

    deleted:
      true,
  };
}

/* =========================================
   LÍMITE DE CRÉDITO
========================================= */

export async function updateClientCreditLimit(
  clientId,
  limit,
  author = "Sistema"
) {
  const id =
    cleanText(
      clientId
    );

  const numericLimit =
    Math.max(
      0,
      toNumber(
        limit
      )
    );

  if (!id) {
    throw new Error(
      "CLIENT_ID_REQUIRED"
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
        numericLimit,

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

  return numericLimit;
}

/* =========================================
   NOTAS CLIENTE
========================================= */

export async function addClientNote(
  clientId,
  text,
  author = "Sistema"
) {
  const id =
    cleanText(
      clientId
    );

  const noteText =
    cleanText(
      text
    );

  if (!id) {
    throw new Error(
      "CLIENT_ID_REQUIRED"
    );
  }

  if (!noteText) {
    throw new Error(
      "CLIENT_NOTE_REQUIRED"
    );
  }

  const note = {
    texto:
      noteText,

    fecha:
      new Date()
        .toISOString(),

    autor:
      cleanText(
        author
      ) ||
      "Sistema",
  };

  await updateDoc(
    doc(
      db,
      "clientes",
      id
    ),

    {
      notas:
        arrayUnion(
          note
        ),

      actualizadoEn:
        new Date()
          .toISOString(),
    }
  );

  return note;
}

/* =========================================
   CREAR CRÉDITO DESDE CLIENTE
========================================= */

export async function createClientCredit({
  client,
  concept = "Otorgamiento de Crédito",
  capital,
  advance = 0,
  interest = 0,
  installments = 1,
  firstDueDate = "",
  author = "Sistema",
}) {
  if (!client?.id) {
    throw new Error(
      "CLIENT_REQUIRED"
    );
  }

  /*
   * Un cliente archivado conserva
   * el historial, pero no puede generar
   * nuevas operaciones.
   */
  if (
    client.archivado ===
    true
  ) {
    throw new Error(
      "CLIENT_ARCHIVED"
    );
  }

  const numericCapital =
    Math.max(
      0,
      toNumber(
        capital
      )
    );

  const numericAdvance =
    Math.max(
      0,
      toNumber(
        advance
      )
    );

  const numericInterest =
    Math.max(
      0,
      toNumber(
        interest
      )
    );

  const installmentCount =
    Math.max(
      1,

      Math.min(
        24,

        Math.trunc(
          toNumber(
            installments
          )
        ) ||
          1
      )
    );

  if (
    numericCapital <=
    0
  ) {
    throw new Error(
      "CREDIT_CAPITAL_INVALID"
    );
  }

  if (
    numericAdvance >=
    numericCapital
  ) {
    throw new Error(
      "CREDIT_ADVANCE_INVALID"
    );
  }

  /* =======================================
     CRÉDITOS ACTIVOS
  ======================================= */

  const allCredits =
    await getDocs(
      collection(
        db,
        "creditos"
      )
    );

  const activeCredits =
    allCredits.docs
      .map(
        (item) => ({
          id:
            item.id,

          ...item.data(),
        })
      )
      .filter(
        (row) =>
          clientMatchesRecord(
            client,
            row
          ) &&
          toNumber(
            row.saldo
          ) >
            0
      );

  const currentDebt =
    activeCredits.reduce(
      (sum, row) =>
        sum +
        toNumber(
          row.saldo
        ),

      0
    );

  const available =
    Math.max(
      0,

      toNumber(
        client.limiteCredito
      ) -
        currentDebt
    );

  /* =======================================
     MONTO FINANCIADO
  ======================================= */

  const financedBase =
    numericCapital -
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
    available
  ) {
    const error =
      new Error(
        "CREDIT_LIMIT_EXCEEDED"
      );

    error.available =
      available;

    error.required =
      totalFinanced;

    throw error;
  }

  /* =======================================
     CUOTAS
  ======================================= */

  const firstDue =
    cleanText(
      firstDueDate
    ) ||
    addDaysISO(
      30
    );

  const installmentAmount =
    totalFinanced /
    installmentCount;

  const installmentsArray =
    [];

  let due =
    new Date(
      `${firstDue}T12:00:00`
    );

  for (
    let index = 1;
    index <=
    installmentCount;
    index += 1
  ) {
    installmentsArray.push({
      numero:
        index,

      importe:
        installmentAmount,

      pagado:
        0,

      capitalPagado:
        0,

      punitoriosPagados:
        0,

      vence:
        due
          .toISOString()
          .split(
            "T"
          )[0],
    });

    due.setDate(
      due.getDate() +
        30
    );
  }

  /* =======================================
     CRÉDITO
  ======================================= */

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
    getClientDisplayName(
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

    capital:
      numericCapital,

    anticipo:
      numericAdvance,

    interesGlobal:
      numericInterest,

    original:
      totalFinanced,

    saldo:
      totalFinanced,

    abonos:
      [],

    cuotas:
      installmentsArray,

    creadoEn:
      nowISO,

    usuario:
      authorName,
  };

  const batch =
    writeBatch(
      db
    );

  batch.set(
    creditRef,
    credit
  );

  /* =======================================
     ANTICIPO EN CAJA
  ======================================= */

  if (
    numericAdvance >
    0
  ) {
    const cashRef =
      doc(
        db,
        "negocio",
        "caja_activa"
      );

    batch.set(
      cashRef,

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
              "Efectivo",

            usuario:
              authorName,
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
   REFINANCIAR DEUDA
========================================= */

export async function refinanceClientDebt({
  client,
  interest = 0,
  installments = 1,
  firstDueDate = "",
  author = "Sistema",
}) {
  if (!client?.id) {
    throw new Error(
      "CLIENT_REQUIRED"
    );
  }

  if (
    client.archivado ===
    true
  ) {
    throw new Error(
      "CLIENT_ARCHIVED"
    );
  }

  const allCredits =
    await getDocs(
      collection(
        db,
        "creditos"
      )
    );

  const activeCredits =
    allCredits.docs
      .map(
        (item) => ({
          id:
            item.id,

          ...item.data(),
        })
      )
      .filter(
        (row) =>
          clientMatchesRecord(
            client,
            row
          ) &&
          toNumber(
            row.saldo
          ) >
            0
      );

  if (
    !activeCredits.length
  ) {
    throw new Error(
      "CLIENT_NO_ACTIVE_DEBT"
    );
  }

  const debt =
    activeCredits.reduce(
      (sum, row) =>
        sum +
        toNumber(
          row.saldo
        ),

      0
    );

  const numericInterest =
    Math.max(
      0,
      toNumber(
        interest
      )
    );

  const installmentCount =
    Math.max(
      1,

      Math.min(
        24,

        Math.trunc(
          toNumber(
            installments
          )
        ) ||
          1
      )
    );

  const totalFinanced =
    debt *
    (
      1 +
      numericInterest /
        100
    );

  const installmentAmount =
    totalFinanced /
    installmentCount;

  const firstDue =
    cleanText(
      firstDueDate
    ) ||
    addDaysISO(
      30
    );

  const installmentsArray =
    [];

  let due =
    new Date(
      `${firstDue}T12:00:00`
    );

  for (
    let index = 1;
    index <=
    installmentCount;
    index += 1
  ) {
    installmentsArray.push({
      numero:
        index,

      importe:
        installmentAmount,

      pagado:
        0,

      capitalPagado:
        0,

      punitoriosPagados:
        0,

      vence:
        due
          .toISOString()
          .split(
            "T"
          )[0],
    });

    due.setDate(
      due.getDate() +
        30
    );
  }

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

  /* =======================================
     CERRAR CRÉDITOS ANTERIORES
  ======================================= */

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

          concepto:
            `${
              cleanText(
                credit.concepto
              ) ||
              "Crédito"
            } (Refinanciado)`,

          refinanciadoEn:
            nowISO,

          refinanciadoPor:
            authorName,
        }
      );
    }
  );

  /* =======================================
     CREAR NUEVA CARPETA
  ======================================= */

  const newCreditRef =
    doc(
      collection(
        db,
        "creditos"
      )
    );

  const newCredit = {
    id:
      newCreditRef.id,

    clienteId:
      client.id,

    cliente:
      getClientDisplayName(
        client
      ),

    concepto:
      "Refinanciación de Deuda Anterior",

    fechaOrigen:
      nowISO.split(
        "T"
      )[0],

    original:
      totalFinanced,

    saldo:
      totalFinanced,

    interesGlobal:
      numericInterest,

    deudaRefinanciada:
      debt,

    creditosOrigen:
      activeCredits.map(
        (row) =>
          row.id
      ),

    abonos:
      [],

    cuotas:
      installmentsArray,

    creadoEn:
      nowISO,

    usuario:
      authorName,
  };

  batch.set(
    newCreditRef,
    newCredit
  );

  await batch.commit();

  return newCredit;
}