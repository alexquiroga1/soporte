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
  caja: { fondo: 0, movs: [] }, cajaPendientes: []
};

// Nuestro estado global reactivo
export let DATA = { ...INITIAL_DATA };

// Inicializa la base de datos
export async function initStore(db, renderCallback) {
  try {
    const doc = await db.collection("sistema").doc("servix_produccion").get();
    if (doc.exists) {
        DATA = doc.data(); 
        console.log("☁️ Base de datos real sincronizada.");
    } else {
        console.log("🌱 Creando nueva base de datos limpia...");
        await db.collection("sistema").doc("servix_produccion").set(DATA);
    }
    if (renderCallback) renderCallback();
  } catch (error) {
    console.error("❌ Falló conexión a la nube.", error);
    DATA = JSON.parse(localStorage.getItem('servix_prod_data')) || INITIAL_DATA;
    toast("Modo Offline activado", "warning");
    if (renderCallback) renderCallback();
  }
}

// FIX: La función verifica que la BD exista para no trabar el programa
export function saveToLocal() {
    if (window.db) {
        window.db.collection("sistema").doc("servix_produccion").set(DATA)
            .catch(err => console.error("No se guardó en Firebase:", err));
    }
    localStorage.setItem('servix_prod_data', JSON.stringify(DATA));
}