// js/core/store.js

import { toast } from './utils.js';
import { aplicarPermisosEnUI } from './auth.js';


export const TICKET_STAGES = [

  {
    key: 'pendiente',
    label: 'Recibido',
    color: '#F2A93B',
    badge: 'pend'
  },

  {
    key: 'diagnostico',
    label: 'En diagnóstico',
    color: '#6D5DD3',
    badge: 'info'
  },

  {
    key: 'presupuesto',
    label: 'Esperando Aprob.',
    color: '#E17A2D',
    badge: 'wait'
  },

  {
    key: 'reparacion',
    label: 'En reparación',
    color: '#4368E8',
    badge: 'prog'
  },

  {
    key: 'repuesto',
    label: 'Esperando repuesto',
    color: '#A5520F',
    badge: 'wait'
  },

  {
    key: 'listo',
    label: 'Listo para entrega',
    color: '#25CE9E',
    badge: 'ready'
  },

  {
    key: 'entregado',
    label: 'Entregado',
    color: '#17B893',
    badge: 'done'
  },

  {
    key: 'noreparable',
    label: 'No reparable',
    color: '#E14848',
    badge: 'urg'
  },

  {
    key: 'cancelado',
    label: 'Cancelado/Retirado',
    color: '#8891A3',
    badge: 'urg'
  },

  {
    key: 'garantia',
    label: 'Garantía',
    color: '#6D5DD3',
    badge: 'info'
  }

];


export const CRM_STAGES = [

  {
    key: 'prospecto',
    label: 'Prospecto',
    color: '#8891A3'
  },

  {
    key: 'contactado',
    label: 'Contactado',
    color: '#F2A93B'
  },

  {
    key: 'propuesta',
    label: 'Propuesta',
    color: '#6D5DD3'
  },

  {
    key: 'negociacion',
    label: 'Negociación',
    color: '#4368E8'
  },

  {
    key: 'ganado',
    label: 'Ganado',
    color: '#17B893'
  },

  {
    key: 'perdido',
    label: 'Perdido',
    color: '#E14848'
  }

];



/* =========================================================
   ESTADO GLOBAL DE LA APLICACIÓN
   ========================================================= */

export let DATA = {

  negocio: {
    nombre: "Cargando...",
    rfc: "",
    telefono: "",
    correo: "",
    direccion: "",
    impuesto: 21
  },


  /* =========================
     USUARIOS Y SEGURIDAD
     ========================= */

  roles: [],
  usuarios: [],


  /* =========================
     CLIENTES
     ========================= */

  clientes: [],


  /* =========================
     TICKETS
     ========================= */

  tickets: [],


  /* =========================
     CRÉDITOS
     ========================= */

  creditos: [],


  /* =========================
     PRODUCTOS Y VENTAS
     ========================= */

  productos: [],
  promociones: [],
  crm: [],
  ventas: [],


  /* =========================
     CAJA
     ========================= */

  caja: {
    fondo: 0,
    movs: []
  },

  caja_pendientes: [],

  caja_cortes: [],


  /* =========================
     FACTURACIÓN
     ========================= */

  facturas: [],


  /* =========================================================
     CUENTA CORRIENTE

     Aquí se guardarán todos los movimientos financieros
     relacionados con el saldo a favor de los clientes.

     Ejemplos:

     + Nota de crédito
     + Saldo a favor
     + Anticipo

     - Uso del saldo para pagar un ticket
     - Devolución
     - Ajuste
     ========================================================= */


  /* PRESUPUESTOS */
  presupuestos: [],


  
  cuenta_corriente: [],


  /* =========================
     CONTADORES
     ========================= */

  counters: {
    tickets: 1000,
    ventas: 1000
  }

};



/* =========================================================
   SUSCRIPCIONES FIREBASE
   ========================================================= */

let unsubscribes = [];



/* =========================================================
   INICIALIZAR STORE
   ========================================================= */

export function initStore(db, renderCallback) {


  /* =======================================================
     COLECCIONES QUE SE ESCUCHAN EN TIEMPO REAL
     ======================================================= */

  const colecciones = [

    'clientes',

    'tickets',

    'presupuestos',

    'creditos',

    'productos',

    'promociones',

    'crm',

    'ventas',

    'facturas',

    'usuarios',

    'roles',

    'caja_pendientes',

    'caja_cortes',


    /* NUEVO
       Historial financiero de los clientes */
    'cuenta_corriente'

  ];



  /* =======================================================
     ESCUCHAR COLECCIONES
     ======================================================= */

  colecciones.forEach(colName => {


    const unsub = db
      .collection(colName)
      .onSnapshot(


        (snapshot) => {


          const arrayTemporal = [];


          snapshot.forEach(doc => {

            arrayTemporal.push({
              id: doc.id,
              ...doc.data()
            });

          });


          /* Guardar datos en el estado global */

          DATA[colName] = arrayTemporal;


          /* Aplicar permisos cuando se actualicen los roles */

          if (colName === 'roles') {

            aplicarPermisosEnUI(DATA.roles);

          }


          /* Volver a renderizar la interfaz */

          if (renderCallback) {

            renderCallback();

          }

        },


        (error) => {

          console.error(
            `Error en ${colName}:`,
            error
          );

        }

      );


    /* Guardar función para cancelar la suscripción */

    unsubscribes.push(unsub);


  });



  /* =======================================================
     CONFIGURACIÓN DEL NEGOCIO
     ======================================================= */

  db
    .collection('negocio')
    .doc('configuracion')
    .onSnapshot(doc => {


      if (doc.exists) {

        DATA.negocio = doc.data();


        if (renderCallback) {

          renderCallback();

        }

      }

    });



  /* =======================================================
     CAJA ACTIVA
     ======================================================= */

  db
    .collection('negocio')
    .doc('caja_activa')
    .onSnapshot(doc => {


      if (doc.exists) {

        DATA.caja = doc.data();

      } else {


        DATA.caja = {

          fondo: 0,

          movs: [],

          estado: 'cerrada'

        };

      }


      if (renderCallback) {

        renderCallback();

      }

    });



  /* =======================================================
     CONTADORES
     ======================================================= */

  db
    .collection('negocio')
    .doc('contadores')
    .onSnapshot(doc => {


      if (doc.exists) {

        DATA.counters = doc.data();

      }

    });


}



/* =========================================================
   COMPATIBILIDAD

   Obsoleto intencionalmente.
   Todo se guarda directamente en Firebase.
   ========================================================= */

export function saveToLocal() { }
