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

// 2. FUNCIÓN DE RENDERIZADO GLOBAL (Temporal hasta modularizar las demás vistas)
window.renderAll = function() {
    console.log("¡Los datos están listos para pintar en pantalla!");
    // En el próximo paso traeremos aquí los renders de Tickets, POS, Caja, etc.
}

// 3. INICIALIZACIÓN DE LA APLICACIÓN
document.addEventListener('DOMContentLoaded', () => {
    // Iniciamos la interfaz (clicks, modales, menú móvil)
    initUI();
    
    // Conectamos a Firestore. Una vez descargada la BD, inicia Firebase Auth
    initStore(window.db, () => {
        initAuth(window.auth, window.renderAll);
    });
});