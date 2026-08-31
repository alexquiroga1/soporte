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
      const uRole = currentUserProfile ? currentUserProfile.rol : 'Usuario';
      
      document.getElementById('sidebar-avatar').textContent = initials(uName);
      document.getElementById('sidebar-user-name').textContent = uName;
      document.getElementById('sidebar-user-role').textContent = uRole;
      document.getElementById('btn-user').textContent = initials(uName);
      
      toast(`Bienvenido, ${uName.split(' ')[0]}`);
      
      // NUEVO: Ocultamos las pestañas a las que no tiene permiso
      aplicarPermisosEnUI();
      
      // Ejecutamos la lógica de renderizado principal
      if(typeof onAppReady === 'function') onAppReady();
    } else {
      loginScreen.style.display = 'flex';
      appContainer.style.display = 'none';
    }
  });
}

// Función que aplica la seguridad visual
export function aplicarPermisosEnUI() {
    if(!currentUserProfile) return;
    
    // Buscamos el rol del usuario en la base de datos
    const roleObj = DATA.roles.find(r => r.nombre === currentUserProfile.rol);
    const perms = roleObj ? roleObj.permisos : [];
    const isAdmin = perms.includes('Acceso total al sistema');

    // Función auxiliar para mostrar/ocultar botones del menú
    const setAcceso = (view, condition) => {
        const btn = document.querySelector(`.nav-item[data-view="${view}"]`);
        if (btn) btn.style.display = (isAdmin || condition) ? 'flex' : 'none';
    };

    // Dashboard, Clientes y CRM lo ven todos por defecto
    setAcceso('dashboard', true);
    setAcceso('clientes', true);
    setAcceso('crm', true);

    // Ocultar o mostrar según los permisos específicos
    setAcceso('tickets', perms.includes('Ver y actualizar tickets asignados'));
    setAcceso('ventas', perms.includes('Registrar ventas y cobros'));
    setAcceso('caja', perms.includes('Abrir y cerrar corte de caja') || perms.includes('Registrar ventas y cobros'));
    setAcceso('creditos', perms.includes('Aprobar créditos y descuentos'));
    setAcceso('productos', perms.includes('Editar catálogo de productos') || perms.includes('Registrar ventas y cobros'));
    setAcceso('erp', perms.includes('Ver reportes financieros'));
    setAcceso('reportes', perms.includes('Ver reportes financieros'));
    setAcceso('config', perms.includes('Gestionar usuarios y roles'));
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
    window.location.reload(); // Forzar recarga para limpiar memoria
  }).catch((error) => {
    toast('No se pudo cerrar la sesión');
  });
}