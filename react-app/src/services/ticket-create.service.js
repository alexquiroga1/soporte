import {
  collection,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
} from "firebase/firestore";


import { db } from "./firebase.js";

/* =========================================
   HELPERS
========================================= */

function cleanText(value) {
  return String(
    value ?? ""
  ).trim();
}

function onlyNumbers(value) {
  return cleanText(
    value
  ).replace(
    /\D/g,
    ""
  );
}

function formatDateAR(date) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(
    date
  );
}

function formatDateTimeAR(date) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    date
  );
}

/* =========================================
   NOMBRE DEL CLIENTE
========================================= */

export function getClientDisplayName(
  client
) {
  if (!client) {
    return "";
  }

  const razonSocial =
    cleanText(
      client.razonSocial
    );

  if (
    razonSocial
  ) {
    return razonSocial;
  }

  const fullName = [
    cleanText(
      client.nombre
    ),

    cleanText(
      client.apellido
    ),
  ]
    .filter(
      Boolean
    )
    .join(" ");

  if (
    fullName
  ) {
    return fullName;
  }

  return (
    cleanText(
      client.name
    ) ||
    cleanText(
      client.cliente
    ) ||
    "Cliente"
  );
}

/* =========================================
   TEXTO SECUNDARIO
========================================= */

export function getClientSecondaryText(
  client
) {
  if (!client) {
    return "";
  }

  const cuit =
    cleanText(
      client.cuit
    );

  if (
    cuit
  ) {
    return `CUIT: ${cuit}`;
  }

  const dni =
    cleanText(
      client.dni ||
      client.documento ||
      client.doc
    );

  if (
    dni
  ) {
    return `DNI: ${dni}`;
  }

  const phone =
    cleanText(
      client.tel ||
      client.telefono ||
      client.celular
    );

  if (
    phone
  ) {
    return `Tel: ${phone}`;
  }

  const email =
    cleanText(
      client.email
    );

  if (
    email
  ) {
    return email;
  }

  /*
   * Si el cliente viejo no tiene
   * documento, teléfono ni email,
   * mostramos una parte del ID
   * para poder distinguirlo.
   */

  return `Registro ${String(
    client.id ||
    ""
  ).slice(
    -6
  )}`;
}

/* =========================================
   IDENTIDAD PARA DEDUPLICACIÓN
========================================= */

function getClientIdentity(
  client
) {
  /*
   * IMPORTANTE:
   *
   * Nunca deduplicamos solamente
   * por nombre.
   *
   * Dos personas distintas pueden
   * llamarse exactamente igual.
   */

  const cuit =
    onlyNumbers(
      client.cuit
    );

  if (
    cuit
  ) {
    return `cuit:${cuit}`;
  }

  const dni =
    onlyNumbers(
      client.dni ||
      client.documento ||
      client.doc
    );

  if (
    dni
  ) {
    return `dni:${dni}`;
  }

  const email =
    cleanText(
      client.email
    ).toLowerCase();

  if (
    email
  ) {
    return `email:${email}`;
  }

  const phone =
    onlyNumbers(
      client.tel ||
      client.telefono ||
      client.celular
    );

  if (
    phone
  ) {
    return `phone:${phone}`;
  }

  /*
   * Sin un identificador confiable
   * conservamos el documento.
   */

  return `id:${client.id}`;
}

/* =========================================
   CLIENTES REALTIME
========================================= */

export function subscribeToClients(
  onData,
  onError
) {
  const clientesRef =
    collection(
      db,
      "clientes"
    );

  return onSnapshot(
    clientesRef,

    (
      snapshot
    ) => {
      const rawClients =
        snapshot.docs.map(
          (
            documentSnapshot
          ) => ({
            id:
              documentSnapshot.id,

            ...documentSnapshot.data(),
          })
        );

      /* =====================================
         QUITAR DUPLICADOS REALES
      ===================================== */

      const seen =
        new Set();

      const clients =
        rawClients
          .filter(
            (
              client
            ) => {
              const identity =
                getClientIdentity(
                  client
                );

              if (
                seen.has(
                  identity
                )
              ) {
                console.warn(
                  "Cliente duplicado ignorado en selector:",
                  identity,
                  client.id
                );

                return false;
              }

              seen.add(
                identity
              );

              return true;
            }
          )
          .sort(
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
                "es",
                {
                  sensitivity:
                    "base",
                }
              )
          );

      onData(
        clients
      );
    },

    (
      error
    ) => {
      if (
        typeof onError ===
        "function"
      ) {
        onError(
          error
        );
      }
    }
  );
}

/* =========================================
   RESERVAR ID TICKET
========================================= */

async function reserveTicketId() {
  const counterRef =
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
      const snapshot =
        await transaction.get(
          counterRef
        );

      let nextNumber =
        1000;

      if (
        snapshot.exists()
      ) {
        const current =
          Number(
            snapshot.data()
              ?.tickets
          );

        nextNumber =
          Number.isFinite(
            current
          )
            ? current
            : 1000;
      }

      transaction.set(
        counterRef,

        {
          tickets:
            nextNumber +
            1,
        },

        {
          merge: true,
        }
      );

      return `TK-${nextNumber}`;
    }
  );
}

/* =========================================
   FOTOS
========================================= */

async function uploadTicketPhotos(
  _files,
  _ticketId
) {
  /*
   * Firebase Storage queda desactivado de forma intencional.
   * Los tickets continúan creándose normalmente, pero no se
   * intentan subir fotografías ni se requiere un bucket.
   */
  return [];
}

/* =========================================
   CREAR TICKET
========================================= */

export async function createTicket(
  formData,
  author = "Sistema"
) {
  const failure =
    cleanText(
      formData?.falla
    );

  /* =======================================
     VALIDACIÓN
  ======================================= */

  if (
    !failure
  ) {
    throw new Error(
      "TICKET_FAILURE_REQUIRED"
    );
  }

  /* =======================================
     ID
  ======================================= */

  const ticketId =
    await reserveTicketId();

  /* =======================================
     FOTOS
  ======================================= */

  const photos =
    await uploadTicketPhotos(
      formData?.photos,
      ticketId
    );

  /* =======================================
     DATOS GENERALES
  ======================================= */

  const now =
    new Date();

  const serviceType =
    cleanText(
      formData?.tipoServicio
    ) ||
    "Taller";

  const clientName =
    cleanText(
      formData?.cliente
    ) ||
    "Mostrador";

  /* =======================================
     DOCUMENTO
  ======================================= */

  const ticket = {
    id:
      ticketId,

    /* =====================================
       CLIENTE
    ===================================== */

    clienteId:
      cleanText(
        formData?.clienteId
      ) ||
      null,

    cliente:
      clientName,

    /* =====================================
       SERVICIO
    ===================================== */

    tipoServicio:
      serviceType,

    estadoPago:
      "Pendiente",

    estadoFacturacion:
      "No facturado",

    /* =====================================
       EQUIPO
    ===================================== */

    equipo:
      cleanText(
        formData?.equipo
      ) ||
      "Otro",

    marca:
      cleanText(
        formData?.marca
      ),

    modelo:
      cleanText(
        formData?.modelo
      ),

    serie:
      cleanText(
        formData?.serie
      ),

    pin:
      cleanText(
        formData?.pin
      ),

    specs:
      cleanText(
        formData?.specs
      ),

    /* =====================================
       RECEPCIÓN
    ===================================== */

    condicion:
      cleanText(
        formData?.condicion
      ),

    falla:
      failure,

    /* =====================================
       ESTADO FÍSICO
    ===================================== */

    estadoFisico: {
      pantalla:
        Boolean(
          formData
            ?.estadoFisico
            ?.pantalla
        ),

      carcasa:
        Boolean(
          formData
            ?.estadoFisico
            ?.carcasa
        ),

      teclado:
        Boolean(
          formData
            ?.estadoFisico
            ?.teclado
        ),

      cargador:
        Boolean(
          formData
            ?.estadoFisico
            ?.cargador
        ),

      bateria:
        Boolean(
          formData
            ?.estadoFisico
            ?.bateria
        ),

      puertos:
        Boolean(
          formData
            ?.estadoFisico
            ?.puertos
        ),
    },

    /* =====================================
       ACCESORIOS
    ===================================== */

    accesoriosObj: {
      cargador:
        Boolean(
          formData
            ?.accesoriosObj
            ?.cargador
        ),

      funda:
        Boolean(
          formData
            ?.accesoriosObj
            ?.funda
        ),

      cable:
        Boolean(
          formData
            ?.accesoriosObj
            ?.cable
        ),
    },

    /* =====================================
       DOMICILIO
    ===================================== */

    datosDomicilio: {
      direccion:
        serviceType ===
        "Domicilio"
          ? cleanText(
              formData
                ?.datosDomicilio
                ?.direccion
            )
          : "",

      fecha:
        serviceType ===
        "Domicilio"
          ? cleanText(
              formData
                ?.datosDomicilio
                ?.fecha
            )
          : "",

      hora:
        serviceType ===
        "Domicilio"
          ? cleanText(
              formData
                ?.datosDomicilio
                ?.hora
            )
          : "",

      contacto:
        serviceType ===
        "Domicilio"
          ? cleanText(
              formData
                ?.datosDomicilio
                ?.contacto
            )
          : "",
    },

    /* =====================================
       REMOTO
    ===================================== */

    datosRemoto: {
      plataforma:
        serviceType ===
        "Remoto"
          ? cleanText(
              formData
                ?.datosRemoto
                ?.plataforma
            )
          : "",

      idConexion:
        serviceType ===
        "Remoto"
          ? cleanText(
              formData
                ?.datosRemoto
                ?.idConexion
            )
          : "",

      clave:
        serviceType ===
        "Remoto"
          ? cleanText(
              formData
                ?.datosRemoto
                ?.clave
            )
          : "",
    },

    /* =====================================
       FOTOS
    ===================================== */

    fotos:
      photos,

    /* =====================================
       PRIORIDAD / ESTADO
    ===================================== */

    prioridad:
      cleanText(
        formData?.prioridad
      ) ||
      "P2",

    stage:
      "pendiente",

    tecnico:
      cleanText(
        formData?.tecnico
      ) ||
      "Sin asignar",

    ingreso:
      formatDateAR(
        now
      ),

    /* =====================================
       DIAGNÓSTICO
    ===================================== */

    diagnostico:
      "Pendiente de revisión inicial.",

    piezas: [],

    notas: [],

    /* =====================================
       PRESUPUESTO
    ===================================== */

    presupuestoFijado:
      false,

    presupuestoEstimado:
      0,

    presupuestoAprobado:
      null,

    presupuestoEstado:
      null,

    presupuestoId:
      null,

    manoObra:
      0,

    descuentoPorcentaje:
      0,

    /* =====================================
       GARANTÍA
    ===================================== */

    garantiaDias:
      0,

    /* =====================================
       HISTORIAL
    ===================================== */

    historial: [
      {
        accion:
          "Ticket creado",

        detalle:
          `Check-in inicial. Servicio: ${serviceType}`,

        fecha:
          formatDateTimeAR(
            now
          ),

        autor:
          cleanText(
            author
          ) ||
          "Sistema",
      },
    ],

    /* =====================================
       AUDITORÍA
    ===================================== */

    creadoEn:
      now.toISOString(),

    actualizadoEn:
      now.toISOString(),
  };

  /* =======================================
     GUARDAR
  ======================================= */

  await setDoc(
    doc(
      db,
      "tickets",
      ticketId
    ),
    ticket
  );

  return ticket;
}