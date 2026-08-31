// =========================================================
// js/main.js - ORQUESTADOR PRINCIPAL DE SERVIX
// =========================================================

// 1. IMPORTACIONES: CORE Y AUTENTICACIÓN
import { initStore } from './core/store.js';
import { initAuth, doLogin, doLogout } from './core/auth.js';
import { initUI, openModal, closeModal, goView, closeDropdowns } from './modules/ui.js';

// 2. IMPORTACIONES: MÓDULOS DE NEGOCIO
import { renderTicketsTable, renderTicketsKanban, onClientSearchInput, selectClientForTicket, printTicket, openTicketModal, togglePresupuesto, updateChecklist, sendWhatsAppNotice, saveDiagnostico, addPiezaToTicket, removePiezaFromTicket, enviarAFacturacion, addTicketNota, changeTicketStage, createTicket } from './modules/tickets.js';
import { renderClientesTable, switchClientTab, openClientModal, saveClientLimit, createCliente, populateClienteSelectPOS } from './modules/clientes.js';
import { renderProductosTabs, setProductoFiltro, renderProductosTable, createProducto, editProducto, saveEditProducto, eliminarProducto, renderPromocionesTable, togglePromocion, createPromocion } from './modules/productos.js';
import { renderPayMethods, setPayMethod, populatePOSPromos, renderPOSProducts, addToCart, changeQty, removeFromCart, renderCart, checkout, renderVentasHistorial } from './modules/pos.js';
import { renderCajaPendientes, abrirModalCobro, setCobroMetodo, calcularCambio, procesarCobroFinal, renderCajaView, addMovimiento, abrirModalCierre, cerrarCorte, renderCreditosTable, openCreditModal, registerPayment, openNuevoCreditoModal, populateClienteSelectCredito, simularCredito, createCreditoManual, printCupones } from './modules/caja.js';
import { renderCRMKanban, createOportunidad } from './modules/crm.js';
import { renderConfig, saveConfigNegocio, createUsuario, toggleUsuario, createRol } from './modules/config.js';
import { renderDashboard, renderReportes } from './modules/dashboard.js';

// =========================================================
// EXPOSICIÓN GLOBAL (Para que el HTML pueda ejecutar funciones)
// =========================================================

// UI y Sesión
window.openModal = openModal; window.closeModal = closeModal; window.goView = goView;
window.doLogin = () => doLogin(window.auth); window.doLogout = () => doLogout(window.auth, closeDropdowns);
window.closeDropdowns = closeDropdowns;

// Tickets
window.onClientSearchInput = onClientSearchInput; window.selectClientForTicket = selectClientForTicket;
window.printTicket = printTicket; window.openTicketModal = openTicketModal;
window.togglePresupuesto = togglePresupuesto; window.updateChecklist = updateChecklist;
window.sendWhatsAppNotice = sendWhatsAppNotice; window.saveDiagnostico = saveDiagnostico;
window.addPiezaToTicket = addPiezaToTicket; window.removePiezaFromTicket = removePiezaFromTicket;
window.enviarAFacturacion = enviarAFacturacion; window.addTicketNota = addTicketNota;
window.changeTicketStage = changeTicketStage; window.createTicket = createTicket;
window.renderTicketsTable = renderTicketsTable;

// Clientes
window.renderClientesTable = renderClientesTable; window.switchClientTab = switchClientTab;
window.openClientModal = openClientModal; window.saveClientLimit = saveClientLimit;
window.createCliente = createCliente; window.populateClienteSelectPOS = populateClienteSelectPOS;

// Productos y Promociones
window.setProductoFiltro = setProductoFiltro; window.createProducto = createProducto;
window.editProducto = editProducto; window.saveEditProducto = saveEditProducto;
window.eliminarProducto = eliminarProducto; window.togglePromocion = togglePromocion;
window.createPromocion = createPromocion; window.renderProductosTable = renderProductosTable;
window.renderPOSProducts = renderPOSProducts; window.populatePOSPromos = populatePOSPromos;
window.renderCart = renderCart;

// POS / Ventas
window.setPayMethod = setPayMethod; window.addToCart = addToCart;
window.changeQty = changeQty; window.removeFromCart = removeFromCart;
window.checkout = checkout; window.renderVentasHistorial = renderVentasHistorial;

// Caja y Créditos (Módulo Financiero Avanzado)
window.abrirModalCobro = abrirModalCobro; window.setCobroMetodo = setCobroMetodo;
window.calcularCambio = calcularCambio; window.procesarCobroFinal = procesarCobroFinal;
window.addMovimiento = addMovimiento; window.abrirModalCierre = abrirModalCierre; 
window.cerrarCorte = cerrarCorte; window.renderCajaView = renderCajaView; 
window.renderCreditosTable = renderCreditosTable; window.openCreditModal = openCreditModal;
window.registerPayment = registerPayment; window.openNuevoCreditoModal = openNuevoCreditoModal; 
window.populateClienteSelectCredito = populateClienteSelectCredito; 
window.simularCredito = simularCredito; window.createCreditoManual = createCreditoManual; 
window.printCupones = printCupones;

// Lógica para cambiar pestañas dentro del modal de créditos
window.switchCreditoTab = function(tabId, el) {
  const group = el.parentElement;
  group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const container = document.getElementById('modal-credito').querySelector('.modal-body');
  container.querySelectorAll('.credito-subview').forEach(sv=>{
    sv.style.display = sv.id === tabId ? 'block' : 'none';
  });
};

// CRM, Configuración y Otros
window.createOportunidad = createOportunidad; window.saveConfigNegocio = saveConfigNegocio;
window.createUsuario = createUsuario; window.toggleUsuario = toggleUsuario;
window.createRol = createRol;

// =========================================================
// FUNCIÓN MAESTRA DE RENDERIZADO
// =========================================================
window.renderAll = function() {
    console.log("Pintando la aplicación completa desde los módulos...");
    
    renderDashboard();
    renderTicketsTable(); 
    renderTicketsKanban();
    
    renderClientesTable(); 
    populateClienteSelectPOS();
    
    renderProductosTabs(); 
    renderProductosTable(); 
    renderPromocionesTable();
    
    renderPayMethods();
    populatePOSPromos();
    renderPOSProducts();
    renderCart();
    renderVentasHistorial();
    
    renderCajaView();
    renderCreditosTable();
    
    renderCRMKanban();
    renderReportes();
    renderConfig();
}

// =========================================================
// INICIALIZACIÓN AL CARGAR EL DOM
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    
    // 🚀 FIX MÁGICO: Tomamos a Firebase por la fuerza desde el navegador
    if (window.firebase) {
        window.db = window.firebase.firestore();
        window.auth = window.firebase.auth();
    } else {
        console.error("No se detectó Firebase. Revisa los scripts del index.html");
        return;
    }

    // Iniciamos la base de datos y la sesión
    initStore(window.db, () => {
        initAuth(window.auth, window.renderAll);
    });
});

// En js/main.js, asegurate de importar y exponer estas funciones de caja.js:

import { generarPlanesDePago, seleccionarPlanDePago, nuevoCreditoDesdePerfil, refinanciarDeudaPerfil, renderCuotasCreditoActual } from './modules/caja.js';

window.generarPlanesDePago = generarPlanesDePago;
window.seleccionarPlanDePago = seleccionarPlanDePago;
window.nuevoCreditoDesdePerfil = nuevoCreditoDesdePerfil;
window.refinanciarDeudaPerfil = refinanciarDeudaPerfil;
window.renderCuotasCreditoActual = renderCuotasCreditoActual;