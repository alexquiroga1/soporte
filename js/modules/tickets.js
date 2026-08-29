// js/modules/tickets.js
import { DATA, saveToLocal, TICKET_STAGES } from '../core/store.js';
import { fDate, fmt, initials, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal } from './ui.js';
import { currentUserProfile } from '../core/auth.js';

// Variables locales del módulo
let currentTicketId = null;
let nextTicketNum = 1000;

// Utilidad local para obtener info del estado
export const stageInfo = key => TICKET_STAGES.find(s=>s.key===key);

// Llenar técnicos en los select
export function populateTecnicos() {
    const selFilter = document.getElementById('tk-filter-tecnico');
    const selNew = document.getElementById('nt-tecnico');
    const tecnicos = DATA.usuarios.filter(u => u.activo);
    
    const options = tecnicos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
    
    if(selFilter) selFilter.innerHTML = '<option value="">Todos los técnicos</option><option value="Sin asignar">Sin asignar</option>' + options;
    if(selNew) selNew.innerHTML = '<option value="Sin asignar">Sin asignar</option>' + options;
}

// Pintar la tabla
export function renderTicketsTable(){
  populateTecnicos();
  const q = (document.getElementById('tk-search').value || '').toLowerCase();
  const fEstado = document.getElementById('tk-filter-estado').value;
  const fPrio = document.getElementById('tk-filter-prio').value;
  const fTecnico = document.getElementById('tk-filter-tecnico').value;

  const rows = DATA.tickets.filter(t=>{
    const matchQ = !q || t.cliente.toLowerCase().includes(q) || t.equipo.toLowerCase().includes(q) || t.id.toLowerCase().includes(q);
    const matchE = !fEstado || t.stage===fEstado;
    const matchP = !fPrio || t.prioridad===fPrio;
    const matchT = !fTecnico || t.tecnico===fTecnico;
    return matchQ && matchE && matchP && matchT;
  });

  document.getElementById('tickets-table-body').innerHTML = rows.map(t=>{
    const st = stageInfo(t.stage);
    const presupBadge = t.presupuestoAprobado ? '<span style="color:var(--teal); font-size:10px; font-weight:700;">✓ Aprobado</span>' : '<span style="color:var(--amber); font-size:10px; font-weight:700;">⏳ Pendiente</span>';
    return `<tr class="tbl-row" onclick="openTicketModal('${t.id}')">
      <td><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></td>
      <td class="mono">#${t.id}</td>
      <td>${t.cliente}<br>${presupBadge}</td>
      <td>${t.equipo}</td>
      <td class="mono">${t.ingreso}</td>
      <td><span class="badge ${st.badge}">${st.label}</span></td>
      <td>${t.tecnico}</td>
      <td onclick="event.stopPropagation()">
        <button class="btn btn-ghost btn-sm" onclick="openTicketModal('${t.id}')" title="Consultar detalle" style="padding:4px 8px; margin-right:4px;">👁️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:26px;">No hay tickets con estos filtros.</td></tr>';

  const abiertos = DATA.tickets.filter(t=>t.stage!=='entregado').length;
  document.getElementById('tickets-meta').textContent = DATA.tickets.length + ' TOTALES · ' + abiertos + ' ABIERTOS';
  document.getElementById('badge-tickets').textContent = abiertos;
}

// Abrir el modal del ticket
export function openTicketModal(id){
  const t = DATA.tickets.find(x=>x.id===id);
  if(!t) return;
  currentTicketId = id;
  document.getElementById('mt-id').textContent = '#'+t.id;
  document.getElementById('mt-ingreso').textContent = 'Ingresó el ' + t.ingreso;
  document.getElementById('mt-cliente').textContent = t.cliente;
  document.getElementById('mt-equipo').textContent = t.equipo;
  document.getElementById('mt-estado-select').value = t.stage;
  
  openModal('modal-ticket');
}