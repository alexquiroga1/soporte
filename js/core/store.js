// js/core/store.js
import { toast } from './utils.js';

export const TICKET_STAGES = [
  {key:'pendiente',   label:'Pendiente',           color:'#F2A93B', badge:'pend'},
  {key:'diagnostico', label:'En diagnóstico',      color:'#6D5DD3', badge:'info'},
  {key:'reparacion',  label:'En reparación',       color:'#4368E8', badge:'prog'},
  {key:'repuesto',    label:'Esperando repuesto',  color:'#E17A2D', badge:'wait'},
  {key:'listo',       label:'Listo para entrega',  color:'#25CE9E', badge:'ready'},
  {key:'entregado',   label:'Entregado',           color:'#17B893', badge:'done'}
];

export const CRM_STAGES = [
  {key:'prospecto',   label:'Prospecto',    color:'#8891A3'},
  {key:'contactado',  label:'Contactado',   color:'#F2A93B'},
  {key:'propuesta',   label:'Propuesta',    color:'#6D5DD3'},
  {key:'negociacion', label:'Negociación',  color:'#4368E8'},
  {key:'ganado',      label:'Ganado',       color:'#17B893'},
  {key:'perdido',     label:'Perdido',      color:'#E14848'}
];

const INITIAL_DATA = {
  negocio: { nombre: "Nombre de tu Empresa", rfc: "", telefono: "", correo: "", direccion: "" },
  roles: [{nombre:'Administrador', desc:'Acceso total al sistema.', permisos:['Acceso total al sistema']}],
  usuarios: [{nombre:'Admin', rol:'Administrador', email:'admin@empresa.com', activo:true}],
  clientes: [], tickets: [], creditos: [], productos: [], promociones: [], crm: [], ventas: [],
  caja: { fondo: 0, movs: [] }, cajaPendientes: [],
  counters: { tickets: 1000, ventas: 1000 } // NUEVO: Contadores globales
};

export let DATA = { ...INITIAL_DATA };

// Bandera para evitar que nuestro propio guardado dispare un bucle
let isSaving = false;

// Inicializa la base de datos en TIEMPO REAL
export function initStore(db, renderCallback) {
  const docRef = db.collection("sistema").doc("servix_produccion");

  // onSnapshot escucha cambios en la nube al instante
  docRef.onSnapshot((doc) => {
    if (isSaving) return; // Si yo fui quien guardó, ignoro la alerta

    if (doc.exists) {
        DATA = doc.data(); 
        
        // 🛡️ PARCHE DE SEGURIDAD: Estructura garantizada
        if (!DATA.cajaPendientes) DATA.cajaPendientes = [];
        if (!DATA.creditos) DATA.creditos = [];
        if (!DATA.ventas) DATA.ventas = [];
        if (!DATA.tickets) DATA.tickets = [];
        if (!DATA.clientes) DATA.clientes = [];
        if (!DATA.productos) DATA.productos = [];
        if (!DATA.promociones) DATA.promociones = [];
        if (!DATA.crm) DATA.crm = [];
        if (!DATA.caja) DATA.caja = { fondo: 0, movs: [] };
        if (!DATA.caja.movs) DATA.caja.movs = [];
        if (!DATA.counters) DATA.counters = { tickets: 1000, ventas: 1000 };
        
        console.log("☁️ Nube sincronizada en tiempo real.");
        localStorage.setItem('servix_prod_data', JSON.stringify(DATA));
        if (renderCallback) renderCallback();
    } else {
        console.log("🌱 Creando base de datos inicial...");
        docRef.set(DATA);
    }
  }, (error) => {
    console.error("❌ Falló conexión a la nube.", error);
    // Modo offline temporal
    DATA = JSON.parse(localStorage.getItem('servix_prod_data')) || INITIAL_DATA;
    if (!DATA.counters) DATA.counters = { tickets: 1000, ventas: 1000 };
    if (renderCallback) renderCallback();
  });
}

// Guarda en Firebase y avisa al sistema
export function saveToLocal() {
    isSaving = true; // Activo la bandera
    if (window.db) {
        window.db.collection("sistema").doc("servix_produccion").set(DATA)
            .then(() => {
                setTimeout(() => isSaving = false, 500); // Apago la bandera
            })
            .catch(err => {
                console.error("No se guardó en Firebase:", err);
                isSaving = false;
            });
    } else {
        isSaving = false;
    }
    localStorage.setItem('servix_prod_data', JSON.stringify(DATA));
}