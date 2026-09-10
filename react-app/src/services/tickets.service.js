import {
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { db } from "./firebase.js";


/* =========================================
   ESTADOS DE TICKET
========================================= */

const TICKET_STAGE_LABELS = {
  pendiente: "Recibido",
  diagnostico: "En diagnóstico",
  presupuesto: "Esperando aprobación",
  presupuesto_rechazado: "Presupuesto rechazado",
  reparacion: "En reparación",
  repuesto: "Esperando repuesto",
  listo: "Listo para entrega",
  entregado: "Entregado",
  noreparable: "No reparable",
  cancelado: "Cancelado / Retirado",
  garantia: "Garantía",
};

/* =========================================
   HELPERS
========================================= */

function getStageLabel(stage) {
  return (
    TICKET_STAGE_LABELS[stage] ||
    stage ||
    "Sin estado"
  );
}

function pad(value) {
  return String(value).padStart(
    2,
    "0"
  );
}

function formatDateYMD(date) {
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-");
}

function formatTimeAR(
  date = new Date()
) {
  return date.toLocaleTimeString(
    "es-AR",
    {
      hour: "2-digit",
      minute: "2-digit",
    }
  );
}

function formatHistoryDate(
  date = new Date()
) {
  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  const day = pad(
    date.getDate()
  );

  const month =
    months[date.getMonth()];

  const year =
    date.getFullYear();

  const hours = pad(
    date.getHours()
  );

  const minutes = pad(
    date.getMinutes()
  );

  return `${day} ${month} ${year} ${hours}:${minutes}`;
}

function formatDisplayYMD(value) {
  if (!value) {
    return "";
  }

  const parts =
    String(value).split("-");

  if (parts.length !== 3) {
    return value;
  }

  const [
    year,
    month,
    day,
  ] = parts;

  const months = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];

  const monthIndex =
    Number(month) - 1;

  return `${day} ${
    months[monthIndex] || month
  } ${year}`;
}

function addDays(
  date,
  days
) {
  const result =
    new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function cleanAuthor(author) {
  const value =
    String(
      author || ""
    ).trim();

  return value || "Sistema";
}

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function normalizeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : fallback;
}

function clamp(
  value,
  min,
  max
) {
  return Math.min(
    max,
    Math.max(min, value)
  );
}

function roundMoney(value) {
  return (
    Math.round(
      (
        Number(value) +
        Number.EPSILON
      ) * 100
    ) / 100
  );
}

function createHistoryEntry({
  author,
  action,
  detail = "",
}) {
  return {
    fecha:
      formatHistoryDate(),

    autor:
      cleanAuthor(author),

    accion:
      action,

    detalle:
      String(
        detail || ""
      ).trim(),
  };
}

function createBudgetHistoryEntry({
  author,
  action,
  detail = "",
}) {
  return {
    fecha:
      formatHistoryDate(),

    autor:
      cleanAuthor(author),

    accion:
      action,

    detalle:
      String(
        detail || ""
      ).trim(),
  };
}

function calculatePiecesTotal(
  pieces
) {
  if (!Array.isArray(pieces)) {
    return 0;
  }

  return roundMoney(
    pieces.reduce(
      (
        total,
        piece
      ) => {
        const quantity =
          Math.max(
            0,
            normalizeNumber(
              piece?.cant,
              0
            )
          );

        const price =
          Math.max(
            0,
            normalizeNumber(
              piece?.costo,
              0
            )
          );

        return (
          total +
          quantity * price
        );
      },
      0
    )
  );
}

/* =========================================
   ITEMS PRESUPUESTO
========================================= */

function buildBudgetItems(
  pieces,
  labor
) {
  const items = [];

  if (Array.isArray(pieces)) {
    pieces.forEach(
      (piece) => {
        const description =
          String(
            piece?.nombre ||
              "Ítem"
          ).trim();

        const quantity =
          Math.max(
            1,
            normalizeNumber(
              piece?.cant,
              1
            )
          );

        const price =
          Math.max(
            0,
            normalizeNumber(
              piece?.costo,
              0
            )
          );

        items.push({
          descripcion:
            description,

          cantidad:
            quantity,

          precio:
            price,

          subtotal:
            roundMoney(
              quantity *
                price
            ),

          sku:
            String(
              piece?.sku ||
                ""
            ).trim(),

          tipo:
            "Repuesto / Servicio",
        });
      }
    );
  }

  if (labor > 0) {
    items.push({
      descripcion:
        "Mano de obra",

      cantidad: 1,

      precio:
        labor,

      subtotal:
        labor,

      sku: "",

      tipo:
        "Mano de obra",
    });
  }

  return items;
}

/* =========================================
   BUSCAR PRESUPUESTO POR TICKET
========================================= */

async function findBudgetIdByTicket(
  ticketId
) {
  if (!ticketId) {
    return null;
  }

  const presupuestoQuery =
    query(
      collection(
        db,
        "presupuestos"
      ),
      where(
        "ticketId",
        "==",
        String(ticketId)
      ),
      limit(1)
    );

  const snapshot =
    await getDocs(
      presupuestoQuery
    );

  if (snapshot.empty) {
    return null;
  }

  return snapshot.docs[0].id;
}

/* =========================================
   VALIDAR PRESUPUESTO
========================================= */

function assertBudgetCanBeModified(
  budget
) {
  if (!budget) {
    return;
  }

  const billed =
    budget.estado ===
      "Facturado" ||
    budget.estadoCaja ===
      "Cobrado" ||
    Boolean(
      budget.facturaId
    );

  if (billed) {
    throw new Error(
      "BUDGET_ALREADY_BILLED"
    );
  }

  if (
    budget.estadoCaja ===
    "Pendiente"
  ) {
    throw new Error(
      "BUDGET_ALREADY_IN_CASH"
    );
  }
}

/* =========================================
   FOTOS
========================================= */

async function uploadTicketPhotos(
  _ticketId,
  _files = []
) {
  /*
   * Firebase Storage queda desactivado de forma intencional.
   * Se conserva el campo fotos en los documentos para mantener
   * compatibilidad con datos existentes, pero no se suben nuevas.
   */
  return [];
}

/* =========================================
   PRÓXIMO NÚMERO DE TICKET
========================================= */

async function getNextTicketId() {
  const counterRef =
    doc(
      db,
      "negocio",
      "contadores"
    );

  let ticketNumber = 1000;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          counterRef
        );

      if (
        !snapshot.exists()
      ) {
        ticketNumber = 1000;

        transaction.set(
          counterRef,

          {
            tickets: 1001,
          },

          {
            merge: true,
          }
        );

        return;
      }

      const current =
        Number(
          snapshot
            .data()
            ?.tickets
        );

      ticketNumber =
        Number.isFinite(
          current
        ) &&
        current >= 1000
          ? current
          : 1000;

      transaction.update(
        counterRef,

        {
          tickets:
            ticketNumber + 1,
        }
      );
    }
  );

  return `TK-${ticketNumber}`;
}

/* =========================================
   CREAR TICKET
========================================= */

export async function createTicket({
  client = null,
  clientName = "",
  serviceType = "Taller",

  priority = "P2",

  technician =
    "Sin asignar",

  equipment = "Otro",

  brand = "",
  model = "",
  serial = "",
  pin = "",
  specs = "",

  physicalState = {},

  accessories = {},

  condition = "",

  issue = "",

  homeService = {},

  remoteService = {},

  photos = [],

  warrantyDays = 30,

  author = "Sistema",
} = {}) {
  const normalizedIssue =
    cleanText(issue);

  if (!normalizedIssue) {
    throw new Error(
      "TICKET_ISSUE_REQUIRED"
    );
  }

  if (
    client?.archivado ===
    true
  ) {
    throw new Error(
      "TICKET_CLIENT_ARCHIVED"
    );
  }

  const allowedServiceTypes =
    [
      "Taller",
      "Domicilio",
      "Remoto",
    ];

  const normalizedServiceType =
    allowedServiceTypes.includes(
      serviceType
    )
      ? serviceType
      : "Taller";

  const allowedPriorities =
    [
      "P1",
      "P2",
      "P3",
    ];

  const normalizedPriority =
    allowedPriorities.includes(
      priority
    )
      ? priority
      : "P2";

  if (
    normalizedServiceType ===
      "Domicilio" &&
    !cleanText(
      homeService?.direccion
    )
  ) {
    throw new Error(
      "TICKET_HOME_ADDRESS_REQUIRED"
    );
  }

  if (
    normalizedServiceType ===
      "Remoto" &&
    !cleanText(
      remoteService?.idConexion
    )
  ) {
    throw new Error(
      "TICKET_REMOTE_ID_REQUIRED"
    );
  }

  const id =
    await getNextTicketId();

  const now =
    new Date();

  const createdAt =
    now.toISOString();

  const ingreso =
    formatDisplayYMD(
      formatDateYMD(now)
    );

  const resolvedClientName =
    cleanText(
      clientName
    ) ||
    cleanText(
      client?.razonSocial
    ) ||
    cleanText(
      `${
        client?.nombre ||
        ""
      } ${
        client?.apellido ||
        ""
      }`
    ) ||
    cleanText(
      client?.name
    ) ||
    "Mostrador";

  const photoUrls =
    await uploadTicketPhotos(
      id,
      photos
    );

  const ticket = {
    id,

    clienteId:
      client?.id ||
      null,

    cliente:
      resolvedClientName,

    tipoServicio:
      normalizedServiceType,

    estadoPago:
      "Pendiente",

    estadoFacturacion:
      "No facturado",

    estadoCaja:
      "No enviado",

    equipo:
      cleanText(
        equipment
      ) ||
      "Otro",

    marca:
      cleanText(brand),

    modelo:
      cleanText(model),

    serie:
      cleanText(serial),

    pin:
      cleanText(pin),

    specs:
      cleanText(specs),

    estadoFisico: {
      pantalla:
        Boolean(
          physicalState?.pantalla
        ),

      carcasa:
        Boolean(
          physicalState?.carcasa
        ),

      teclado:
        Boolean(
          physicalState?.teclado
        ),

      cargador:
        Boolean(
          physicalState?.cargador
        ),

      bateria:
        Boolean(
          physicalState?.bateria
        ),

      puertos:
        Boolean(
          physicalState?.puertos
        ),
    },

    accesoriosObj: {
      cargador:
        Boolean(
          accessories?.cargador
        ),

      funda:
        Boolean(
          accessories?.funda
        ),

      cable:
        Boolean(
          accessories?.cable
        ),
    },

    condicion:
      cleanText(condition),

    falla:
      normalizedIssue,

    fotos:
      photoUrls,

    datosDomicilio: {
      direccion:
        cleanText(
          homeService?.direccion
        ),

      fecha:
        cleanText(
          homeService?.fecha
        ),

      hora:
        cleanText(
          homeService?.hora
        ),

      contacto:
        cleanText(
          homeService?.contacto
        ),
    },

    datosRemoto: {
      plataforma:
        cleanText(
          remoteService
            ?.plataforma
        ) ||
        "AnyDesk",

      idConexion:
        cleanText(
          remoteService
            ?.idConexion
        ),

      clave:
        cleanText(
          remoteService?.clave
        ),
    },

    presupuestoFijado:
      false,

    presupuestoEstimado:
      0,

    presupuestoAprobado:
      false,

    presupuestoEstado:
      "Pendiente",

    prioridad:
      normalizedPriority,

    stage:
      "pendiente",

    tecnico:
      cleanText(
        technician
      ) ||
      "Sin asignar",

    ingreso,

    creadoEn:
      createdAt,

    actualizadoEn:
      createdAt,

    garantiaDias:
      Math.max(
        0,
        Math.trunc(
          normalizeNumber(
            warrantyDays,
            30
          )
        )
      ),

    diagnostico:
      "Pendiente de revisión inicial.",

    piezas: [],

    historial: [
      createHistoryEntry({
        author,

        action:
          "Ticket creado",

        detail:
          `Check-in inicial. Servicio: ${normalizedServiceType}`,
      }),
    ],

    notas: [],
  };

  await setDoc(
    doc(
      db,
      "tickets",
      id
    ),

    ticket
  );

  return ticket;
}

/* =========================================
   ESCUCHAR TODOS LOS TICKETS
========================================= */

export function subscribeToTickets(
  onData,
  onError
) {
  const ticketsRef =
    collection(
      db,
      "tickets"
    );

  const unsubscribe =
    onSnapshot(
      ticketsRef,

      (
        snapshot
      ) => {
        const tickets =
          snapshot.docs.map(
            (
              document
            ) => ({
              id:
                document.id,

              ...document.data(),
            })
          );

        tickets.sort(
          (
            a,
            b
          ) => {
            const matchA =
              String(
                a.id || ""
              ).match(
                /(\d+)$/
              );

            const matchB =
              String(
                b.id || ""
              ).match(
                /(\d+)$/
              );

            const numberA =
              Number(
                matchA?.[1]
              );

            const numberB =
              Number(
                matchB?.[1]
              );

            if (
              Number.isFinite(
                numberA
              ) &&
              Number.isFinite(
                numberB
              )
            ) {
              return (
                numberB -
                numberA
              );
            }

            return String(
              b.id
            ).localeCompare(
              String(a.id)
            );
          }
        );

        onData?.(
          tickets
        );
      },

      (
        error
      ) => {
        console.error(
          "Error escuchando tickets:",
          error
        );

        onError?.(
          error
        );
      }
    );

  return unsubscribe;
}

/* =========================================
   ESCUCHAR UN TICKET
========================================= */

export function subscribeToTicket(
  ticketId,
  onData,
  onError
) {
  if (!ticketId) {
    return () => {};
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticketId)
    );

  return onSnapshot(
    ticketRef,

    (
      snapshot
    ) => {
      if (
        !snapshot.exists()
      ) {
        onData?.(
          null
        );

        return;
      }

      onData?.({
        id:
          snapshot.id,

        ...snapshot.data(),
      });
    },

    (
      error
    ) => {
      console.error(
        `Error escuchando ticket ${ticketId}:`,
        error
      );

      onError?.(
        error
      );
    }
  );
}

/* =========================================
   CAMBIAR ESTADO
========================================= */

export async function updateTicketStage(
  ticket,
  newStage,
  author
) {
  if (!ticket?.id) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (!newStage) {
    throw new Error(
      "STAGE_REQUIRED"
    );
  }

  const currentStage =
    ticket.stage ||
    "pendiente";

  if (
    currentStage ===
    newStage
  ) {
    return {
      changed: false,
      stage: newStage,
    };
  }

  const oldStageLabel =
    getStageLabel(
      currentStage
    );

  const newStageLabel =
    getStageLabel(
      newStage
    );

  const updates = {
    stage:
      newStage,

    actualizadoEn:
      new Date()
        .toISOString(),
  };

  let logDetail =
    `${oldStageLabel} → ${newStageLabel}`;

  if (
    newStage === "listo"
  ) {
    updates.fechaListo =
      new Date()
        .toISOString();
  }

  if (
    newStage ===
    "entregado"
  ) {
    const warrantyDays =
      Math.max(
        0,
        normalizeNumber(
          ticket
            .garantiaDias,
          30
        )
      );

    const expiration =
      new Date();

    expiration.setDate(
      expiration.getDate() +
        warrantyDays
    );

    const expirationYMD =
      formatDateYMD(
        expiration
      );

    updates.garantiaDias =
      warrantyDays;

    updates.garantiaVencimiento =
      expirationYMD;

    logDetail +=
      ` | Garantía activada por ${warrantyDays} días` +
      ` (hasta ${formatDisplayYMD(
        expirationYMD
      )}).`;
  }

  const historyEntry =
    createHistoryEntry({
      author,

      action:
        "Estado cambiado",

      detail:
        logDetail,
    });

  updates.historial =
    arrayUnion(
      historyEntry
    );

  await updateDoc(
    doc(
      db,
      "tickets",
      String(
        ticket.id
      )
    ),

    updates
  );

  return {
    changed: true,

    stage:
      newStage,

    stageLabel:
      newStageLabel,

    historyEntry,
  };
}

/* =========================================
   DIAGNÓSTICO
========================================= */

export async function updateTicketDiagnosis(
  ticketId,
  diagnosis,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanDiagnosis =
    String(
      diagnosis || ""
    ).trim();

  if (!cleanDiagnosis) {
    throw new Error(
      "DIAGNOSIS_REQUIRED"
    );
  }

  const historyEntry =
    createHistoryEntry({
      author,

      action:
        "Diagnóstico actualizado",

      detail:
        cleanDiagnosis,
    });

  await updateDoc(
    doc(
      db,
      "tickets",
      String(ticketId)
    ),

    {
      diagnostico:
        cleanDiagnosis,

      actualizadoEn:
        new Date()
          .toISOString(),

      historial:
        arrayUnion(
          historyEntry
        ),
    }
  );

  return {
    diagnosis:
      cleanDiagnosis,

    historyEntry,
  };
}

/* =========================================
   NOTA MANUAL
========================================= */

export async function addTicketNote(
  ticketId,
  note,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanNote =
    String(
      note || ""
    ).trim();

  if (!cleanNote) {
    throw new Error(
      "NOTE_REQUIRED"
    );
  }

  const historyEntry =
    createHistoryEntry({
      author,

      action:
        "Nota manual",

      detail:
        cleanNote,
    });

  await updateDoc(
    doc(
      db,
      "tickets",
      String(ticketId)
    ),

    {
      historial:
        arrayUnion(
          historyEntry
        ),

      actualizadoEn:
        new Date()
          .toISOString(),
    }
  );

  return {
    note:
      cleanNote,

    historyEntry,
  };
}

/* =========================================
   AGREGAR REPUESTO / SERVICIO
========================================= */

export async function addTicketPiece(
  ticketId,
  piece,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const name =
    String(
      piece?.nombre || ""
    ).trim();

  if (!name) {
    throw new Error(
      "PIECE_NAME_REQUIRED"
    );
  }

  const quantity =
    Math.max(
      1,
      normalizeNumber(
        piece?.cant,
        1
      )
    );

  const price =
    Math.max(
      0,
      normalizeNumber(
        piece?.costo,
        0
      )
    );

  const sku =
    String(
      piece?.sku || ""
    ).trim();

  const newPiece = {
    nombre:
      name,

    sku,

    cant:
      quantity,

    costo:
      price,
  };

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticketId)
    );

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      const currentPieces =
        Array.isArray(
          data.piezas
        )
          ? data.piezas
          : [];

      const updatedPieces =
        [
          ...currentPieces,
          newPiece,
        ];

      const subtotal =
        roundMoney(
          quantity *
            price
        );

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio agregado",

          detail:
            `${name} · Cantidad: ${quantity} · Importe: ${subtotal}`,
        });

      const currentHistory =
        Array.isArray(
          data.historial
        )
          ? data.historial
          : [];

      transaction.update(
        ticketRef,

        {
          piezas:
            updatedPieces,

          actualizadoEn:
            new Date()
              .toISOString(),

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );
    }
  );

  return newPiece;
}

/* =========================================
   EDITAR REPUESTO
========================================= */

export async function updateTicketPiece(
  ticketId,
  pieceIndex,
  changes,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (
    !Number.isInteger(
      pieceIndex
    ) ||
    pieceIndex < 0
  ) {
    throw new Error(
      "INVALID_PIECE_INDEX"
    );
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticketId)
    );

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      const pieces =
        Array.isArray(
          data.piezas
        )
          ? [
              ...data.piezas,
            ]
          : [];

      if (
        !pieces[
          pieceIndex
        ]
      ) {
        throw new Error(
          "PIECE_NOT_FOUND"
        );
      }

      const previous =
        pieces[
          pieceIndex
        ];

      const updated = {
        ...previous,

        nombre:
          changes.nombre !==
          undefined
            ? String(
                changes.nombre
              ).trim()
            : previous.nombre,

        sku:
          changes.sku !==
          undefined
            ? String(
                changes.sku
              ).trim()
            : previous.sku,

        cant:
          changes.cant !==
          undefined
            ? Math.max(
                1,
                normalizeNumber(
                  changes.cant,
                  1
                )
              )
            : Math.max(
                1,
                normalizeNumber(
                  previous.cant,
                  1
                )
              ),

        costo:
          changes.costo !==
          undefined
            ? Math.max(
                0,
                normalizeNumber(
                  changes.costo,
                  0
                )
              )
            : Math.max(
                0,
                normalizeNumber(
                  previous.costo,
                  0
                )
              ),
      };

      if (!updated.nombre) {
        throw new Error(
          "PIECE_NAME_REQUIRED"
        );
      }

      pieces[
        pieceIndex
      ] = updated;

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio actualizado",

          detail:
            `${updated.nombre} · Cantidad: ${updated.cant} · Precio: ${updated.costo}`,
        });

      const currentHistory =
        Array.isArray(
          data.historial
        )
          ? data.historial
          : [];

      transaction.update(
        ticketRef,

        {
          piezas,

          actualizadoEn:
            new Date()
              .toISOString(),

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );
    }
  );
}

/* =========================================
   ELIMINAR REPUESTO
========================================= */

export async function removeTicketPiece(
  ticketId,
  pieceIndex,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  if (
    !Number.isInteger(
      pieceIndex
    ) ||
    pieceIndex < 0
  ) {
    throw new Error(
      "INVALID_PIECE_INDEX"
    );
  }

  const ticketRef =
    doc(
      db,
      "tickets",
      String(ticketId)
    );

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const snapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !snapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const data =
        snapshot.data();

      if (
        data.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      const pieces =
        Array.isArray(
          data.piezas
        )
          ? [
              ...data.piezas,
            ]
          : [];

      const removed =
        pieces[
          pieceIndex
        ];

      if (!removed) {
        throw new Error(
          "PIECE_NOT_FOUND"
        );
      }

      pieces.splice(
        pieceIndex,
        1
      );

      const historyEntry =
        createHistoryEntry({
          author,

          action:
            "Repuesto / servicio eliminado",

          detail:
            `${
              removed.nombre ||
              "Ítem"
            } eliminado del ticket.`,
        });

      const currentHistory =
        Array.isArray(
          data.historial
        )
          ? data.historial
          : [];

      transaction.update(
        ticketRef,

        {
          piezas,

          actualizadoEn:
            new Date()
              .toISOString(),

          historial: [
            ...currentHistory,
            historyEntry,
          ],
        }
      );
    }
  );
}

/* =========================================
   FIJAR PRESUPUESTO
========================================= */

export async function fixTicketBudget(
  ticketId,
  {
    labor = 0,
    discountPercent = 0,
  },
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanTicketId =
    String(ticketId);

  const cleanAuthorValue =
    cleanAuthor(author);

  const cleanLabor =
    Math.max(
      0,
      normalizeNumber(
        labor,
        0
      )
    );

  const cleanDiscount =
    clamp(
      normalizeNumber(
        discountPercent,
        0
      ),
      0,
      100
    );

  const linkedBudgetId =
    await findBudgetIdByTicket(
      cleanTicketId
    );

  const ticketRef =
    doc(
      db,
      "tickets",
      cleanTicketId
    );

  const counterRef =
    doc(
      db,
      "negocio",
      "contadores"
    );

  let result = null;

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const ticketSnapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !ticketSnapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const ticketData =
        ticketSnapshot.data();

      if (
        ticketData.presupuestoFijado ===
        true
      ) {
        throw new Error(
          "BUDGET_LOCKED"
        );
      }

      let presupuestoId =
        ticketData
          .presupuestoId ||
        linkedBudgetId ||
        null;

      let budgetRef = null;
      let existingBudget =
        null;

      if (presupuestoId) {
        budgetRef =
          doc(
            db,
            "presupuestos",
            presupuestoId
          );

        const budgetSnapshot =
          await transaction.get(
            budgetRef
          );

        if (
          budgetSnapshot.exists()
        ) {
          existingBudget =
            budgetSnapshot.data();

          assertBudgetCanBeModified(
            existingBudget
          );
        }
      }

      let nextCounter =
        null;

      if (!presupuestoId) {
        const counterSnapshot =
          await transaction.get(
            counterRef
          );

        const currentCounter =
          counterSnapshot.exists()
            ? normalizeNumber(
                counterSnapshot
                  .data()
                  .presupuestos,
                0
              )
            : 0;

        nextCounter =
          currentCounter + 1;

        presupuestoId =
          `PRE-${String(
            nextCounter
          ).padStart(
            6,
            "0"
          )}`;

        budgetRef =
          doc(
            db,
            "presupuestos",
            presupuestoId
          );
      }

      const pieces =
        Array.isArray(
          ticketData.piezas
        )
          ? ticketData.piezas
          : [];

      const piecesTotal =
        calculatePiecesTotal(
          pieces
        );

      const subtotal =
        roundMoney(
          piecesTotal +
            cleanLabor
        );

      if (subtotal <= 0) {
        throw new Error(
          "BUDGET_EMPTY"
        );
      }

      const discountAmount =
        roundMoney(
          subtotal *
            (
              cleanDiscount /
              100
            )
        );

      const total =
        roundMoney(
          Math.max(
            0,
            subtotal -
              discountAmount
          )
        );

      const items =
        buildBudgetItems(
          pieces,
          cleanLabor
        );

      const now =
        new Date();

      const nowISO =
        now.toISOString();

      const today =
        formatDateYMD(now);

      const validityDays =
        Math.max(
          1,
          normalizeNumber(
            existingBudget
              ?.validezDias,
            7
          )
        );

      const budgetDate =
        existingBudget
          ?.fecha ||
        today;

      const expiryDate =
        existingBudget
          ?.fechaVencimiento ||
        formatDateYMD(
          addDays(
            now,
            validityDays
          )
        );

      const isNewBudget =
        !existingBudget;

      const budgetHistoryEntry =
        createBudgetHistoryEntry({
          author:
            cleanAuthorValue,

          action:
            isNewBudget
              ? "Presupuesto creado"
              : "Presupuesto actualizado",

          detail:
            isNewBudget
              ? `Generado desde Ticket ${cleanTicketId}. Total: ${total}.`
              : `Actualizado desde Ticket ${cleanTicketId}. Total: ${total}.`,
        });

      const previousBudgetHistory =
        Array.isArray(
          existingBudget
            ?.historial
        )
          ? existingBudget
              .historial
          : [];

      const presupuestoData =
        {
          id:
            presupuestoId,

          numero:
            presupuestoId,

          fecha:
            budgetDate,

          hora:
            existingBudget
              ?.hora ||
            formatTimeAR(now),

          fechaVencimiento:
            expiryDate,

          validezDias:
            validityDays,

          clienteId:
            ticketData
              .clienteId ||
            existingBudget
              ?.clienteId ||
            null,

          cliente:
            ticketData
              .cliente ||
            existingBudget
              ?.cliente ||
            "Consumidor Final",

          doc:
            ticketData.dni ||
            ticketData.documento ||
            existingBudget
              ?.doc ||
            "C.F.",

          ticketId:
            cleanTicketId,

          origen:
            "Ticket",

          estado:
            "Pendiente",

          presupuestoFijado:
            true,

          items,

          subtotal,

          descuento:
            discountAmount,

          descuentoPorcentaje:
            cleanDiscount,

          descuentoImporte:
            discountAmount,

          manoObra:
            cleanLabor,

          total,

          observaciones:
            existingBudget
              ?.observaciones ||
            "",

          usuario:
            cleanAuthorValue,

          creadoEn:
            existingBudget
              ?.creadoEn ||
            nowISO,

          actualizadoEn:
            nowISO,

          historial: [
            ...previousBudgetHistory,
            budgetHistoryEntry,
          ],
        };

      const detailParts =
        [
          `Presupuesto ${presupuestoId}`,
          `Repuestos/servicios: ${piecesTotal}`,
          `Mano de obra: ${cleanLabor}`,
          `Subtotal: ${subtotal}`,
        ];

      if (
        cleanDiscount > 0
      ) {
        detailParts.push(
          `Descuento: ${cleanDiscount}% (-${discountAmount})`
        );
      }

      detailParts.push(
        `Total: ${total}`
      );

      const ticketHistoryEntry =
        createHistoryEntry({
          author:
            cleanAuthorValue,

          action:
            isNewBudget
              ? "Presupuesto generado"
              : "Presupuesto actualizado",

          detail:
            detailParts.join(
              " · "
            ),
        });

      const previousTicketHistory =
        Array.isArray(
          ticketData.historial
        )
          ? ticketData.historial
          : [];

      if (
        nextCounter !==
        null
      ) {
        transaction.set(
          counterRef,

          {
            presupuestos:
              nextCounter,
          },

          {
            merge: true,
          }
        );
      }

      transaction.set(
        budgetRef,

        presupuestoData,

        {
          merge: true,
        }
      );

      transaction.update(
        ticketRef,

        {
          presupuestoId,

          stage:
            "presupuesto",

          presupuestoEstado:
            "Pendiente",

          manoObra:
            cleanLabor,

          descuentoPorcentaje:
            cleanDiscount,

          presupuestoSubtotal:
            subtotal,

          descuentoImporte:
            discountAmount,

          presupuestoEstimado:
            total,

          presupuestoFijado:
            true,

          presupuestoAprobado:
            deleteField(),

          actualizadoEn:
            nowISO,

          historial: [
            ...previousTicketHistory,
            ticketHistoryEntry,
          ],
        }
      );

      result = {
        budgetId:
          presupuestoId,

        created:
          isNewBudget,

        piecesTotal,

        labor:
          cleanLabor,

        subtotal,

        discountPercent:
          cleanDiscount,

        discountAmount,

        total,

        fixed: true,
      };
    }
  );

  return result;
}

/* =========================================
   DESBLOQUEAR PRESUPUESTO
========================================= */

export async function unlockTicketBudget(
  ticketId,
  author
) {
  if (!ticketId) {
    throw new Error(
      "TICKET_REQUIRED"
    );
  }

  const cleanTicketId =
    String(ticketId);

  const linkedBudgetId =
    await findBudgetIdByTicket(
      cleanTicketId
    );

  const ticketRef =
    doc(
      db,
      "tickets",
      cleanTicketId
    );

  let result = {
    changed: false,
    budgetId: null,
  };

  await runTransaction(
    db,

    async (
      transaction
    ) => {
      const ticketSnapshot =
        await transaction.get(
          ticketRef
        );

      if (
        !ticketSnapshot.exists()
      ) {
        throw new Error(
          "TICKET_NOT_FOUND"
        );
      }

      const ticketData =
        ticketSnapshot.data();

      const presupuestoId =
        ticketData
          .presupuestoId ||
        linkedBudgetId ||
        null;

      let budgetRef = null;
      let budgetData = null;

      if (presupuestoId) {
        budgetRef =
          doc(
            db,
            "presupuestos",
            presupuestoId
          );

        const budgetSnapshot =
          await transaction.get(
            budgetRef
          );

        if (
          budgetSnapshot.exists()
        ) {
          budgetData =
            budgetSnapshot.data();

          assertBudgetCanBeModified(
            budgetData
          );
        }
      }

      if (
        ticketData
          .presupuestoFijado !==
          true &&
        !budgetData
      ) {
        return;
      }

      const nowISO =
        new Date()
          .toISOString();

      const ticketHistoryEntry =
        createHistoryEntry({
          author,

          action:
            "Presupuesto desbloqueado",

          detail:
            presupuestoId
              ? `Se habilitó la edición del presupuesto ${presupuestoId}.`
              : "Se habilitó nuevamente la edición del presupuesto.",
        });

      const ticketHistory =
        Array.isArray(
          ticketData.historial
        )
          ? ticketData.historial
          : [];

      transaction.update(
        ticketRef,

        {
          presupuestoFijado:
            false,

          presupuestoEstado:
            "En edición",

          presupuestoAprobado:
            deleteField(),

          actualizadoEn:
            nowISO,

          historial: [
            ...ticketHistory,
            ticketHistoryEntry,
          ],
        }
      );

      if (
        budgetRef &&
        budgetData
      ) {
        const budgetHistoryEntry =
          createBudgetHistoryEntry({
            author,

            action:
              "Presupuesto desbloqueado",

            detail:
              `Se habilitó la edición desde Ticket ${cleanTicketId}.`,
          });

        const budgetHistory =
          Array.isArray(
            budgetData.historial
          )
            ? budgetData.historial
            : [];

        transaction.update(
          budgetRef,

          {
            estado:
              "En edición",

            presupuestoFijado:
              false,

            actualizadoEn:
              nowISO,

            historial: [
              ...budgetHistory,
              budgetHistoryEntry,
            ],
          }
        );
      }

      result = {
        changed: true,

        budgetId:
          presupuestoId,
      };
    }
  );

  return result;
}