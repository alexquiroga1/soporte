// js/core/store.js
import { toast } from './utils.js';
import { aplicarPermisosEnUI } from './auth.js';

export const TICKET_STAGES = [

  {key:'pendiente',   label:'Recibido',            color:'#F2A93B', badge:'pend'},
  {key:'diagnostico', label:'En diagnóstico',      color:'#6D5DD3', badge:'info'},
  {key:'presupuesto', label:'Esperando Aprob.',    color:'#E17A2D', badge:'wait'}, // NUEVO
  {key:'reparacion',  label:'En reparación',       color:'#4368E8', badge:'prog'},
  {key:'repuesto',    label:'Esperando repuesto',  color:'#A5520F', badge:'wait'},
  {key:'listo',       label:'Listo para entrega',  color:'#25CE9E', badge:'ready'},
  {key:'entregado',   label:'Entregado',           color:'#17B893', badge:'done'},
  {key:'noreparable', label:'No reparable',        color:'#E14848', badge:'urg'},  // NUEVO
  {key:'cancelado',   label:'Cancelado/Retirado',  color:'#8891A3', badge:'urg'},  // NUEVO
  {key:'garantia',    label:'Garantía',            color:'#6D5DD3', badge:'info'}  // NUEVO
];


export const CRM_STAGES = [
  {key:'prospecto',   label:'Prospecto',    color:'#8891A3'},
  {key:'contactado',  label:'Contactado',   color:'#F2A93B'},
  {key:'propuesta',   label:'Propuesta',    color:'#6D5DD3'},
  {key:'negociacion', label:'Negociación',  color:'#4368E8'},
  {key:'ganado',      label:'Ganado',       color:'#17B893'},
  {key:'perdido',     label:'Perdido',      color:'#E14848'}
];

export let DATA = {
  negocio: { nombre: "Cargando...", rfc: "", telefono: "", correo: "", direccion: "", impuesto: 21 },
  roles: [], usuarios: [], clientes: [], tickets: [], creditos: [],
  productos: [], promociones: [], crm: [], ventas: [],
  caja: { fondo: 0, movs: [] }, caja_pendientes: [], caja_cortes: [],
  facturas: [], // Preparado para Fase Facturación
  counters: { tickets: 1000, ventas: 1000 }
};

let unsubscribes = [];

export function initStore(db, renderCallback) {
  const colecciones = ['clientes', 'tickets', 'creditos', 'productos', 'promociones', 'crm', 'ventas', 'facturas', 'usuarios', 'roles', 'caja_pendientes', 'caja_cortes'];

  colecciones.forEach(colName => {
    const unsub = db.collection(colName).onSnapshot((snapshot) => {
      const arrayTemporal = [];
      snapshot.forEach(doc => {
        arrayTemporal.push({ id: doc.id, ...doc.data() });
      });
      DATA[colName] = arrayTemporal;

      if (colName === 'roles') aplicarPermisosEnUI(DATA.roles);
      if (renderCallback) renderCallback();
    }, error => console.error(`Error en ${colName}:`, error));
    unsubscribes.push(unsub);
  });

  db.collection('negocio').doc('configuracion').onSnapshot(doc => {
    if(doc.exists) { DATA.negocio = doc.data(); if (renderCallback) renderCallback(); }
  });

  db.collection('negocio').doc('caja_activa').onSnapshot(doc => {
    if(doc.exists) { DATA.caja = doc.data(); }
    else { DATA.caja = { fondo: 0, movs: [], estado: 'cerrada' }; }
    if (renderCallback) renderCallback();
  });

  db.collection('negocio').doc('contadores').onSnapshot(doc => {
    if(doc.exists) DATA.counters = doc.data();
  });
}

// Obsoleto intencionalmente. Todo es atómico ahora.
export function saveToLocal() {}

