/* =========================================================
   DATOS (Estructura Limpia para Producción)
========================================================= */
const TICKET_STAGES = [
  {key:'pendiente',   label:'Pendiente',           color:'#F2A93B', badge:'pend'},
  {key:'diagnostico', label:'En diagnóstico',      color:'#6D5DD3', badge:'info'},
  {key:'reparacion',  label:'En reparación',       color:'#4368E8', badge:'prog'},
  {key:'repuesto',    label:'Esperando repuesto',  color:'#E17A2D', badge:'wait'},
  {key:'listo',       label:'Listo para entrega',  color:'#25CE9E', badge:'ready'},
  {key:'entregado',   label:'Entregado',           color:'#17B893', badge:'done'}
];

const CRM_STAGES = [
  {key:'prospecto',   label:'Prospecto',    color:'#8891A3'},
  {key:'contactado',  label:'Contactado',   color:'#F2A93B'},
  {key:'propuesta',   label:'Propuesta',    color:'#6D5DD3'},
  {key:'negociacion', label:'Negociación',  color:'#4368E8'},
  {key:'ganado',      label:'Ganado',       color:'#17B893'},
  {key:'perdido',     label:'Perdido',      color:'#E14848'}
];

let nextTicketNum = 1000; // Reiniciamos el contador de tickets

const getFullName = (c) => c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre;

const _hoy = new Date();
const addDays = (d) => {
  const nd = new Date(_hoy);
  nd.setDate(nd.getDate() + d);
  return nd.toISOString().split('T')[0];
};

// ESTRUCTURA 100% VACÍA
const INITIAL_DATA = {
  negocio: {
      nombre: "Nombre de tu Empresa",
      rfc: "",
      telefono: "",
      correo: "",
      direccion: ""
  },
  roles: [
    {nombre:'Administrador', desc:'Acceso total al sistema.', permisos:['Acceso total al sistema']}
  ],
  usuarios: [
    {nombre:'Admin', rol:'Administrador', email:'admin@empresa.com', activo:true}
  ],
  clientes: [],
  tickets: [],
  creditos: [],
  productos: [],
  promociones: [],
  crm: [],
  ventas: [],
  caja: { fondo: 0, movs: [] },
  cajaPendientes: []
};

// Para las gráficas del inicio (las vaciamos también)
const ventasSemana = [{l:'Lun',v:0},{l:'Mar',v:0},{l:'Mié',v:0},{l:'Jue',v:0},{l:'Vie',v:0},{l:'Sáb',v:0},{l:'Dom',v:0}];
const ventasMensuales = [{l:'Mes 1',v:0},{l:'Mes 2',v:0},{l:'Mes 3',v:0}];

let cart = [];
let payMethod = 'Efectivo';
let currentTicketId = null, currentClientId = null, currentCreditIdx = null, currentCobroIdx = null;

// =========================================================
// CONEXIÓN A FIREBASE Y RESPALDO LOCAL (MODO PRODUCCIÓN)
// =========================================================
let DATA = INITIAL_DATA; 

// Cambiamos el documento a "servix_produccion" para empezar de cero en la nube
db.collection("sistema").doc("servix_produccion").get().then((doc) => {
    if (doc.exists) {
        DATA = doc.data(); 
        console.log("☁️ Base de datos real sincronizada.");
    } else {
        console.log("🌱 Creando nueva base de datos limpia...");
        db.collection("sistema").doc("servix_produccion").set(DATA);
    }
    
    if (typeof renderAll === 'function') renderAll();

}).catch((error) => {
    console.error("❌ Falló conexión a la nube.", error);
    DATA = JSON.parse(localStorage.getItem('servix_prod_data')) || INITIAL_DATA;
    if (typeof renderAll === 'function') renderAll();
});

function saveToLocal() {
    db.collection("sistema").doc("servix_produccion").set(DATA)
        .catch(err => console.error("No se guardó en Firebase:", err));

    localStorage.setItem('servix_prod_data', JSON.stringify(DATA));
}

function resetLocalData() {
    localStorage.removeItem('servix_prod_data');
    location.reload();
}
