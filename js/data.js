/* =========================================================
   DATOS (Base de datos simulada y variables de estado)
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

// Funciones globales para manejo de Nombres y Fechas reales
const getFullName = (c) => c.apellido ? `${c.nombre} ${c.apellido}` : c.nombre;

const _hoy = new Date();
const addDays = (d) => {
  const nd = new Date(_hoy);
  nd.setDate(nd.getDate() + d);
  return nd.toISOString().split('T')[0];
};

const INITIAL_DATA = {
  clientes: [
    {id:'c1', nombre:'Distribuidora', apellido:'López', direccion:'Av. Central 1024, Local B', tel:'555-201-3344', email:'contacto@distrilopez.com',
      equipos:[{tipo:'PC de escritorio', marca:'Dell OptiPlex 3080', serie:'DL-3080-9921'},{tipo:'Impresora', marca:'HP LaserJet Pro', serie:'HP-LJ-4410'}],
      limiteCredito:5000, notas:['Cliente corporativo desde 2022, paga a 30 días.']},
    {id:'c2', nombre:'Marta', apellido:'Cabrera', direccion:'Calle Las Flores 441', tel:'555-330-1187', email:'marta.cabrera@mail.com',
      equipos:[{tipo:'Laptop', marca:'HP Pavilion 15', serie:'HPX-2291'},{tipo:'Impresora', marca:'Epson L3250', serie:'EPL-7723'}],
      limiteCredito:1000, notas:['Prefiere contacto por WhatsApp.']},
    {id:'c3', nombre:'Carlos', apellido:'Núñez', direccion:'Paseo del Valle 90', tel:'555-402-9981', email:'carlos.nunez@mail.com',
      equipos:[{tipo:'PC de escritorio armada', marca:'Custom build', serie:'CN-0001'},{tipo:'Monitor', marca:'LG 24MK430', serie:'LG24-5581'}],
      limiteCredito:0, notas:['Cliente nuevo, referido por Marta Cabrera.']},
    {id:'c4', nombre:'Taller Sánchez', apellido:'', direccion:'Blvd. Industrial 3er Anillo', tel:'555-118-2260', email:'teo@tallersanchez.com',
      equipos:[{tipo:'Servidor', marca:'Dell PowerEdge T340', serie:'PE-T340-0087'},{tipo:'PC de escritorio (x4)', marca:'Lenovo ThinkCentre', serie:'Varios'}],
      limiteCredito:8000, notas:['Plan de soporte mensual activo (ver CRM).']}
  ],

  tickets: [
    {id:'TK-2231', clienteId:'c1', cliente:'Distribuidora López', equipo:'PC de escritorio Dell OptiPlex', accesorios:'Cable de poder', condicion:'Buen estado general', presupuestoAprobado:true, checklist:{encendido:true, respaldo:true, memoria:true}, falla:'No enciende — se sospecha fuente de poder dañada por sobrecarga eléctrica.', prioridad:'P1', stage:'repuesto', tecnico:'J. Peña', ingreso:'20 Ago',
      diagnostico:'Fuente de poder quemada confirmada. Se solicitó autorización al cliente para reemplazo; pieza en pedido con proveedor.',
      piezas:[{nombre:'Fuente 500W', cant:1, costo:720}],
      historial:[{estado:'Recibido',fecha:'20 Ago 09:10',autor:'Mostrador'},{estado:'En diagnóstico',fecha:'20 Ago 10:30',autor:'J. Peña'},{estado:'Esperando repuesto',fecha:'20 Ago 11:15',autor:'J. Peña'}],
      notas:[{autor:'J. Peña',fecha:'20 Ago 11:20',texto:'Cliente notificado por teléfono, autoriza cambio de fuente.'}]}
  ],

  creditos: [
    {cliente:'Taller Sánchez', concepto:'Reparación de servidor', original:3500, saldo:1200, vence: addDays(5), abonos:[{fecha:'10 Ago',monto:1000,metodo:'Transferencia'},{fecha:'15 Ago',monto:1300,metodo:'Efectivo'}]},
    {cliente:'Distribuidora López', concepto:'Compra de equipos', original:5200, saldo:5200, vence: addDays(12), abonos:[]}
  ],

  productos: [
    {sku:'SKU-1180', nombre:'SSD NVMe 480GB', categoria:'Componentes', precio:680, stock:34, stockMax:50, proveedor:'TecnoImport S.A.', vendidos:22},
    {sku:'SKU-0942', nombre:'Memoria RAM DDR4 8GB', categoria:'Componentes', precio:480, stock:27, stockMax:50, proveedor:'TecnoImport S.A.', vendidos:31},
    {sku:'SKU-0311', nombre:'Fuente de poder 500W', categoria:'Componentes', precio:720, stock:7, stockMax:50, proveedor:'Componentes del Norte', vendidos:14},
    {sku:'SKU-0075', nombre:'Cable HDMI 2m', categoria:'Accesorios', precio:95, stock:46, stockMax:50, proveedor:'PC Wholesale', vendidos:40},
    {sku:'SKU-1204', nombre:'Pasta térmica premium', categoria:'Insumos', precio:150, stock:0, stockMax:30, proveedor:'Componentes del Norte', vendidos:18},
    {sku:'SKU-0588', nombre:'Mouse óptico inalámbrico', categoria:'Perifericos', precio:210, stock:33, stockMax:50, proveedor:'PC Wholesale', vendidos:27},
    {sku:'SKU-0220', nombre:'Servicio de formateo + respaldo', categoria:'Servicios', precio:250, stock:999, stockMax:999, proveedor:'—', vendidos:19}
  ],
  
  // NUEVO APARTADO: PROMOCIONES
  promociones: [
    {id: 'PRM-001', nombre: 'Descuento Mantenimientos', tipo: 'Porcentaje (%)', valor: 15, aplicaA: 'Servicios', vence: addDays(15), activa: true},
    {id: 'PRM-002', nombre: 'Promo Teclados y Mouse', tipo: 'Monto Fijo ($)', valor: 50, aplicaA: 'Perifericos', vence: addDays(5), activa: true}
  ],

  crm: [
    {contacto:'Fabiola Ríos', empresa:'Ferretería Ríos', interes:'Renovación de equipos', valor:9800, fecha:'22 Ago', stage:'prospecto'}
  ],

  ventas: [
    {folio:'V-1042', cliente:'Mostrador', articulos:'Cable HDMI, mouse óptico', pago:'Efectivo', total:210.00, hora:'09:12'}
  ],

  caja: {
    fondo: 800,
    movs: [
      {hora:'08:00', concepto:'Apertura de caja', tipo:'fondo', monto:800}
    ]
  },

  cajaPendientes: [],

  usuarios: [
    {nombre:'Mario Rossi', rol:'Administrador', email:'mario@servix.com', activo:true},
    {nombre:'Julián Peña', rol:'Técnico senior', email:'julian@servix.com', activo:true}
  ]
};

const ventasSemana = [{l:'Lun',v:2100},{l:'Mar',v:1800},{l:'Mié',v:2600},{l:'Jue',v:2300},{l:'Vie',v:3240},{l:'Sáb',v:1900},{l:'Dom',v:0}];
const ventasMensuales = [{l:'Mar',v:31200},{l:'Abr',v:28800},{l:'May',v:35400},{l:'Jun',v:33100},{l:'Jul',v:41200},{l:'Ago',v:48200}];

let cart = [];
let payMethod = 'Efectivo';
let currentTicketId = null, currentClientId = null, currentCreditIdx = null, currentCobroIdx = null;

// =========================================================
// LÓGICA DE GUARDADO LOCAL (LOCALSTORAGE)
// =========================================================
let DATA = JSON.parse(localStorage.getItem('servix_data')) || INITIAL_DATA;

// Corrección por si el usuario ya tenía datos guardados sin el array de promociones
if (!DATA.promociones) {
    DATA.promociones = INITIAL_DATA.promociones;
    saveToLocal();
}

function saveToLocal() {
    localStorage.setItem('servix_data', JSON.stringify(DATA));
}

function resetLocalData() {
    localStorage.removeItem('servix_data');
    location.reload();
}