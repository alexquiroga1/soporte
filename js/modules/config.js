// js/modules/config.js
import { DATA, saveToLocal } from '../core/store.js';
import { initials, toast } from '../core/utils.js';
import { closeModal } from './ui.js';

export function renderConfig() {
  if(DATA.negocio) {
      document.getElementById('cfg-nombre').value = DATA.negocio.nombre || '';
      document.getElementById('cfg-rfc').value = DATA.negocio.rfc || '';
      document.getElementById('cfg-tel').value = DATA.negocio.telefono || '';
      document.getElementById('cfg-email').value = DATA.negocio.correo || '';
      document.getElementById('cfg-dir').value = DATA.negocio.direccion || '';
  }

  const usersBody = document.getElementById('config-users-body');
  if(usersBody) {
      usersBody.innerHTML = DATA.usuarios.map((u,i)=>`
        <tr><td><div class="cust"><div class="ci">${initials(u.nombre)}</div><b>${u.nombre}</b></div></td><td>${u.rol}</td><td class="mono">${u.email}</td>
        <td><div class="toggle ${u.activo?'on':''}" onclick="toggleUsuario(${i})"><div class="knob"></div></div></td></tr>`).join('');
      document.getElementById('config-users-meta').textContent = DATA.usuarios.filter(u=>u.activo).length + ' activos de ' + DATA.usuarios.length;
  }

  const rolesContainer = document.getElementById('config-roles');
  if(rolesContainer) {
      rolesContainer.innerHTML = DATA.roles.map(r=>`
        <div class="role-card"><h4>${r.nombre}</h4><p>${r.desc}</p><ul>${r.permisos.map(p=>'<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'+p+'</li>').join('')}</ul></div>`).join('');
  }

  const selRol = document.getElementById('nu-rol');
  if(selRol) {
      selRol.innerHTML = DATA.roles.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('');
  }
}

export function saveConfigNegocio() {
    DATA.negocio = {
        nombre: document.getElementById('cfg-nombre').value.trim(), rfc: document.getElementById('cfg-rfc').value.trim(),
        telefono: document.getElementById('cfg-tel').value.trim(), correo: document.getElementById('cfg-email').value.trim(),
        direccion: document.getElementById('cfg-dir').value.trim()
    };
    saveToLocal();
    document.getElementById('dash-title-negocio').textContent = DATA.negocio.nombre;
    toast('Datos del negocio guardados en la nube');
}

export function createUsuario() {
    const nombre = document.getElementById('nu-nombre').value.trim();
    const email = document.getElementById('nu-email').value.trim();
    const rol = document.getElementById('nu-rol').value;

    if(!nombre || !email) { toast('Completa todos los campos'); return; }
    DATA.usuarios.push({ nombre, email, rol, activo: true });
    saveToLocal();

    document.getElementById('nu-nombre').value = ''; document.getElementById('nu-email').value = '';
    closeModal('modal-nuevo-usuario');
    renderConfig();
    toast('Usuario creado. (Regístralo también en Firebase Auth)');
}

export function toggleUsuario(i){ 
  DATA.usuarios[i].activo = !DATA.usuarios[i].activo; 
  saveToLocal();
  renderConfig(); 
  toast(DATA.usuarios[i].activo?'Usuario activado':'Usuario desactivado'); 
}

export function createRol() {
    const nombre = document.getElementById('nr-nombre').value.trim();
    const desc = document.getElementById('nr-desc').value.trim();
    const checkboxes = document.querySelectorAll('.chk-permiso:checked');
    const permisos = Array.from(checkboxes).map(chk => chk.value);

    if(!nombre || permisos.length === 0) { toast('Escribe un nombre y selecciona al menos 1 permiso'); return; }

    DATA.roles.push({ nombre, desc, permisos });
    saveToLocal();

    document.getElementById('nr-nombre').value = ''; document.getElementById('nr-desc').value = '';
    document.querySelectorAll('.chk-permiso').forEach(chk => chk.checked = false);
    closeModal('modal-nuevo-rol');
    renderConfig();
    toast('Nuevo rol creado con éxito');
}