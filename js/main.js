// js/main.js
import { initStore } from './core/store.js';
import { initAuth, doLogin, doLogout } from './core/auth.js';
import { initUI, openModal, closeModal, goView, closeDropdowns } from './modules/ui.js';

// 1. EXPOSICIÓN GLOBAL PARA EL HTML (onclick="")
window.openModal = openModal;
window.closeModal = closeModal;
window.goView = goView;
window.doLogin = () => doLogin(window.auth);
window.doLogout = () => doLogout(window.auth, closeDropdowns);
window.closeDropdowns = closeDropdowns; // Para el botón de notificaciones

// 2. FUNCIÓN MAESTRA DE RENDERIZADO
// Aquí iremos llamando a los "renders" de cada módulo que vayamos separando.
window.renderAll = function() {
    console.log("¡Sesión iniciada correctamente! Datos listos.");
    
    // Aquí pondremos: renderTicketsTable(), renderCajaView(), etc...
}

// 3. INICIALIZACIÓN DE LA APLICACIÓN
document.addEventListener('DOMContentLoaded', () => {
    initUI();
    
    initStore(window.db, () => {
        initAuth(window.auth, window.renderAll);
    });
});