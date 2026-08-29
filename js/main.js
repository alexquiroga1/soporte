// js/main.js
import { initStore } from './core/store.js';
import { initAuth, doLogin, doLogout } from './core/auth.js';
import { initUI, openModal, closeModal, goView, closeDropdowns } from './modules/ui.js';

// Importamos TODO lo de tickets
import { 
    renderTicketsTable, renderTicketsKanban, onClientSearchInput, selectClientForTicket,
    printTicket, openTicketModal, togglePresupuesto, updateChecklist, sendWhatsAppNotice,
    saveDiagnostico, addPiezaToTicket, removePiezaFromTicket, enviarAFacturacion,
    addTicketNota, changeTicketStage, createTicket 
} from './modules/tickets.js';

// 1. EXPOSICIÓN GLOBAL DE LA INTERFAZ
window.openModal = openModal;
window.closeModal = closeModal;
window.goView = goView;
window.doLogin = () => doLogin(window.auth);
window.doLogout = () => doLogout(window.auth, closeDropdowns);
window.closeDropdowns = closeDropdowns;

// 2. EXPOSICIÓN GLOBAL DE LOS TICKETS (Para que funcionen los botones en el HTML)
window.onClientSearchInput = onClientSearchInput;
window.selectClientForTicket = selectClientForTicket;
window.printTicket = printTicket;
window.openTicketModal = openTicketModal;
window.togglePresupuesto = togglePresupuesto;
window.updateChecklist = updateChecklist;
window.sendWhatsAppNotice = sendWhatsAppNotice;
window.saveDiagnostico = saveDiagnostico;
window.addPiezaToTicket = addPiezaToTicket;
window.removePiezaFromTicket = removePiezaFromTicket;
window.enviarAFacturacion = enviarAFacturacion;
window.addTicketNota = addTicketNota;
window.changeTicketStage = changeTicketStage;
window.createTicket = createTicket;
window.renderTicketsTable = renderTicketsTable; // Para el buscador del HTML

// 3. FUNCIÓN MAESTRA DE RENDERIZADO
window.renderAll = function() {
    console.log("Datos cargados. Pintando módulo de Tickets...");
    
    // Pintamos la tabla y el tablero Kanban de los tickets
    renderTicketsTable();
    renderTicketsKanban();
    
    // (NOTA: Para las otras vistas como Caja, Dashboard, etc., el código antiguo sigue 
    // estando en app.js. A medida que creemos caja.js, pos.js, los importaremos aquí).
}

// 4. INICIALIZACIÓN DE LA APLICACIÓN
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    
    // 1. Cargamos datos, 2. Verificamos usuario, 3. Renderizamos
    initStore(window.db, () => {
        initAuth(window.auth, window.renderAll);
    });
});