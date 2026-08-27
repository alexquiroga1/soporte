/* =========================================================
   DATOS (Base de datos y estructura)
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

let nextTicketNum = 2232;

// Funciones globales para manejo de Nombres y Fechas
const getFullName = (c) => c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre;

const _hoy = new Date();
const addDays = (d) => {
  const nd = new Date(_hoy);
  nd.setDate(nd.getDate() + d);
  return nd.toISOString().split('T')[0];
};

const INITIAL_DATA = {
  // --- CONFIGURACIÓN DE NEGOCIO Y ROLES ---
  negocio: {
      nombre: "SERVIX — Soporte técnico PC",
      rfc: "SVX-860412-QW1",
      telefono: "+52 555 900 1122",
      correo: "contacto@servix.com",
      direccion: "Av. Tecnológico 450, Local 3"
  },
  roles: [
    {nombre:'Administrador', desc:'Acceso total al sistema y configuración.', permisos:['Gestionar usuarios y roles','Ver reportes financieros','Editar catálogo de productos','Aprobar créditos y descuentos']},
    {nombre:'Técnico', desc:'Gestiona tickets y diagnósticos.', permisos:['Ver y actualizar tickets asignados','Registrar piezas y diagnósticos','Agregar notas internas']},
    {nombre:'Ventas / Caja', desc:'Opera el punto de venta y caja diaria.', permisos:['Registrar ventas y cobros','Abrir y cerrar corte de caja','Consultar clientes y créditos']}
  ],
  usuarios: [
    {nombre:'Mario Rossi', rol:'Administrador', email:'mario@servix.com', activo:true},
    {nombre:'Julián Peña', rol:'Técnico', email:'julian@servix.com', activo:true}
  ],

  // --- RESTO DE LOS MÓDULOS ---
  clientes: [
    {id:'c1', nombre:'Distribuidora', apellido:'López', direccion:'Av. Central 1024, Local B', tel:'555-201-3344', email:'contacto@distrilopez.com', equipos:[], limiteCredito:5000, notas:[]},
    {id:'c2', nombre:'Marta', apellido:'Cabrera', direccion:'Calle Las Flores 441', tel:'555-330-1187', email:'marta.cabrera@mail.com', equipos:[], limiteCredito:1000, notas:[]},
    {id:'c3', nombre:'Carlos', apellido:'Núñez', direccion:'Paseo del Valle 90', tel:'555-402-9981', email:'carlos.nunez@mail.com', equipos:[], limiteCredito:0, notas:[]}
  ],
  tickets: [
    {id:'TK-2231', clienteId:'c1', cliente:'Distribuidora López', equipo:'PC de escritorio Dell OptiPlex', accesorios:'Cable de poder', condicion:'Buen estado', presupuestoAprobado:true, checklist:{encendido:true, respaldo:true, memoria:true}, falla:'No enciende', prioridad:'P1', stage:'repuesto', tecnico:'J. Peña', ingreso:'20 Ago', diagnostico:'Fuente de poder quemada', piezas:[{nombre:'Fuente 500W', cant:1, costo:720}], historial:[], notas:[]}
  ],
  creditos: [
    {cliente:'Distribuidora López', concepto:'Compra de equipos', original:5200, saldo:5200, vence: addDays(12), abonos:[]}
  ],
  productos: [
    {sku:'SKU-1180', nombre:'SSD NVMe 480GB', categoria:'Componentes', precio:680, stock:34, stockMax:50, proveedor:'TecnoImport S.A.', vendidos:22},
    {sku:'SKU-0942', nombre:'Memoria RAM DDR4 8GB', categoria:'Componentes', precio:480, stock:27, stockMax:50, proveedor:'TecnoImport S.A.', vendidos:31},
    {sku:'SKU-0220', nombre:'Servicio de formateo + respaldo', categoria:'Servicios', precio:250, stock:999, stockMax:999, proveedor:'—', vendidos:19}
  ],
  promociones: [
    {id: 'PRM-001', nombre: 'Descuento Mantenimientos', tipo: 'Porcentaje (%)', valor: 15, aplicaA: 'Servicios', vence: addDays(15), activa: true}
  ],
  crm: [],
  ventas: [],
  caja: { fondo: 800, movs: [{hora:'08:00', concepto:'Apertura de caja', tipo:'fondo', monto:800}] },
  cajaPendientes: []
};

const ventasSemana = [{l:'Lun',v:2100},{l:'Mar',v:1800},{l:'Mié',v:2600},{l:'Jue',v:2300},{l:'Vie',v:3240},{l:'Sáb',v:1900},{l:'Dom',v:0}];
const ventasMensuales = [{l:'Mar',v:31200},{l:'Abr',v:28800},{l:'May',v:35400},{l:'Jun',v:33100},{l:'Jul',v:41200},{l:'Ago',v:48200}];

let cart = [];
let payMethod = 'Efectivo';
let currentTicketId = null, currentClientId = null, currentCreditIdx = null, currentCobroIdx = null;

// =========================================================
// CONEXIÓN A FIREBASE Y RESPALDO LOCAL
// =========================================================
let DATA = INITIAL_DATA; // Arrancamos con los datos base para que no se rompa la UI

// 1. Descargar los datos desde Firebase en la nube
db.collection("sistema").doc("servix_db").get().then((doc) => {
    if (doc.exists) {
        DATA = doc.data(); // Reemplazamos la base de datos local con la real
        console.log("☁️ Base de datos sincronizada desde la Nube.");
    } else {
        console.log("🌱 Creando primer registro en la base de datos...");
        db.collection("sistema").doc("servix_db").set(DATA);
    }
    
    // Al descargar la información, volvemos a dibujar toda la pantalla
    if (typeof renderAll === 'function') renderAll();

}).catch((error) => {
    console.error("❌ Falló conexión a la nube, usando memoria local.", error);
    // Si falla el internet, usamos lo último guardado en el navegador
    DATA = JSON.parse(localStorage.getItem('servix_data')) || INITIAL_DATA;
    if (typeof renderAll === 'function') renderAll();
});

// 2. Función maestra para guardar en la nube
function saveToLocal() {
    // Intentamos subir el cambio a Firestore
    db.collection("sistema").doc("servix_db").set(DATA)
        .catch(err => console.error("No se pudo guardar en Firebase:", err));

    // Por seguridad, siempre guardamos una copia de respaldo en el navegador
    localStorage.setItem('servix_data', JSON.stringify(DATA));
}

function resetLocalData() {
    localStorage.removeItem('servix_data');
    location.reload();
}
