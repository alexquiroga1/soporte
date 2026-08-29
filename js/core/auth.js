// js/core/auth.js
import { DATA } from './store.js';
import { initials, toast } from './utils.js';

export let currentUserProfile = null;

// Observador de sesión
export function initAuth(authInstance, onAppReady) {
  authInstance.onAuthStateChanged(user => {
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');

    if (user) {
      loginScreen.style.display = 'none';
      appContainer.style.display = 'flex';
      
      currentUserProfile = DATA.usuarios.find(u => u.email === user.email);
      const uName = currentUserProfile ? currentUserProfile.nombre : user.email;
      const uRole = currentUserProfile ? currentUserProfile.rol : 'Admin';
      
      document.getElementById('sidebar-avatar').textContent = initials(uName);
      document.getElementById('sidebar-user-name').textContent = uName;
      document.getElementById('sidebar-user-role').textContent = uRole;
      document.getElementById('btn-user').textContent = initials(uName);
      
      toast(`Bienvenido, ${uName.split(' ')[0]}`);
      
      // Ejecutamos la lógica de renderizado principal
      if(typeof onAppReady === 'function') onAppReady();
    } else {
      loginScreen.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  });
}

// Iniciar sesión
export function doLogin(authInstance) {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  
  if(!email || !pass) { toast('Completa tus datos'); return; }
  
  const btn = document.querySelector('.login-btn');
  const btnText = btn.textContent;
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  authInstance.signInWithEmailAndPassword(email, pass)
    .then(() => {
        btn.textContent = btnText;
        btn.disabled = false;
        document.getElementById('login-pass').value = '';
    })
    .catch((error) => {
        btn.textContent = btnText;
        btn.disabled = false;
        toast('Error: Verifica tu correo y contraseña');
        console.error(error);
    });
}

// Cerrar sesión
export function doLogout(authInstance, closeDropdownsCallback) {
  authInstance.signOut().then(() => {
    if(closeDropdownsCallback) closeDropdownsCallback();
  }).catch((error) => {
    toast('No se pudo cerrar la sesión');
  });
}