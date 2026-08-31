// js/modules/tickets.js
import { DATA, saveToLocal, TICKET_STAGES } from '../core/store.js';
import { fDate, fmt, initials, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal, wireKanbanDrag } from './ui.js';
import { currentUserProfile } from '../core/auth.js';

let currentTicketId = null;
let nextTicketNum = 1000;

export const stageInfo = key => TICKET_STAGES.find(s=>s.key===key);

export function onClientSearchInput(){
  const q = document.getElementById('nt-cliente-input').value.toLowerCase().trim();
  const box = document.getElementById('nt-client-suggestions');
  if(!q){ box.style.display='none'; return; }

  const match = DATA.clientes.filter(c => {
    const full = getFullName(c);
    return full.toLowerCase().includes(q) || c.tel.includes(q);
  });
  
  if(match.length > 0){
    box.style.display = 'block';
    box.innerHTML = match.map(c => `
      <div style="padding:8px 12px; cursor:pointer; border-bottom:1px solid var(--line); font-size:13px;" onclick="selectClientForTicket('${c.id}', '${getFullName(c)}')">
        <b>${getFullName(c)}</b> <span style="color:var(--muted); font-size:11px;">(${c.tel})</span>
      </div>
    `).join('');
  } else {
    box.style.display = 'block';
    box.innerHTML = `
      <div style="padding:10px 12px; font-size:12.5px; color:var(--muted);">
        No encontrado. <span style="color:var(--copper); font-weight:600; cursor:pointer;" onclick="openModal('modal-nuevo-cliente'); document.getElementById('nt-client-suggestions').style.display='none';">¿Crear nuevo cliente?</span>
      </div>
    `;
  }
}

export function selectClientForTicket(id, nombre){
  document.getElementById('nt-cliente-id').value = id;
  document.getElementById('nt-cliente-input').value = nombre;
  document.getElementById('nt-client-suggestions').style.display = 'none';
}

export function populateTecnicos() {
    const selFilter = document.getElementById('tk-filter-tecnico');
    const selNew = document.getElementById('nt-tecnico');
    const tecnicos = DATA.usuarios.filter(u => u.activo);
    const options = tecnicos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
    
    if(selFilter) selFilter.innerHTML = '<option value="">Todos los técnicos</option><option value="Sin asignar">Sin asignar</option>' + options;
    if(selNew) selNew.innerHTML = '<option value="Sin asignar">Sin asignar</option>' + options;
}

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
        <button class="btn btn-ghost btn-sm" onclick="printTicket('${t.id}')" title="Imprimir / Exportar PDF" style="padding:4px 8px;">🖨️</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:26px;">No hay tickets con estos filtros.</td></tr>';

  const abiertos = DATA.tickets.filter(t=>t.stage!=='entregado').length;
  document.getElementById('tickets-meta').textContent = DATA.tickets.length + ' TOTALES · ' + abiertos + ' ABIERTOS';
  document.getElementById('badge-tickets').textContent = abiertos;
}

export function printTicket(id){
  const t = DATA.tickets.find(x => x.id === id);
  if(!t) return;
  const total = (t.piezas || []).reduce((acc, p) => acc + (p.costo * p.cant), 0);
  
  const win = window.open('', '', 'width=800,height=700');
  win.document.write(`
    <html>
    <head>
      <title>Orden de Servicio #${t.id}</title>
      <style>
        body { font-family: 'Inter', sans-serif; padding: 30px; color: #171A21; background: #fff; }
        h2 { margin-bottom: 2px; color: #12151C; }
        .mono { font-family: monospace; color: #8891A3; font-size: 13px; }
        .box { border: 1px solid #E4E6EC; padding: 16px; border-radius: 8px; margin: 16px 0; background: #FAFBFC; }
        .box p { margin: 6px 0; font-size: 13.5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { border: 1px solid #E4E6EC; padding: 10px; text-align: left; font-size: 13px; }
        th { background: #F3F4F7; font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
        .total-section { text-align: right; margin-top: 15px; font-size: 16px; font-weight: bold; color: #FF6A3D; font-family: monospace; }
        .footer-note { margin-top: 40px; font-size: 11px; color: #8891A3; text-align: center; border-top: 1px dashed #E4E6EC; padding-top: 10px; }
      </style>
    </head>
    <body>
      <h2>${DATA.negocio.nombre} · Orden de Servicio #${t.id}</h2>
      <div class="mono">Fecha de ingreso: ${t.ingreso} · Prioridad: ${t.prioridad} · Presupuesto: ${t.presupuestoAprobado ? 'APROBADO' : 'PENDIENTE'}</div>
      <div class="box">
        <p><b>Cliente:</b> ${t.cliente}</p><p><b>Equipo:</b> ${t.equipo}</p><p><b>Accesorios recibidos:</b> ${t.accesorios || 'Ninguno'}</p>
        <p><b>Condición física:</b> ${t.condicion || 'Sin registrar'}</p><p><b>Falla reportada:</b> ${t.falla}</p><p><b>Diagnóstico técnico:</b> ${t.diagnostico || 'Pendiente'}</p>
      </div>
      <h3>Repuestos / Servicios aplicados</h3>
      <table>
        <thead><tr><th>Artículo</th><th>Cant.</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${(t.piezas || []).length ? (t.piezas || []).map(p => `<tr><td>${p.nombre}</td><td>${p.cant}</td><td>$${(p.costo * p.cant).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center; color:#8891A3;">Sin repuestos registrados</td></tr>'}
        </tbody>
      </table>
      <div class="total-section">Total estimado: $${total.toFixed(2)}</div>
      <div class="footer-note">Presentar este ticket o comprobante al momento de retirar su equipo. No nos hacemos responsables por equipos con más de 90 días sin recoger. Firma de conformidad: ___________________________</div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}

export function renderTicketsKanban(){
  const board = document.getElementById('tickets-kanban');
  board.innerHTML = TICKET_STAGES.map(s=>{
    const items = DATA.tickets.filter(t=>t.stage===s.key);
    const cards = items.map(t=>`
      <div class="kanban-card" draggable="true" data-id="${t.id}" onclick="openTicketModal('${t.id}')">
        <div class="kc-top"><span class="kc-id">#${t.id}</span><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></div>
        <b>${t.cliente}</b><div class="kc-sub">${t.equipo}</div>
        <div class="kc-foot"><span>${t.tecnico}</span><span>${t.ingreso}</span></div>
      </div>`).join('');
    return `<div class="kanban-col" data-stage="${s.key}">
        <div class="kanban-col-head"><span class="dot" style="background:${s.color}"></span>${s.label}<b>${items.length}</b></div>
        ${cards}
      </div>`;
  }).join('');
  
  wireKanbanDrag(board, (id, newStage)=>{
    const t = DATA.tickets.find(x=>x.id===id);
    if(t && t.stage!==newStage){
      t.stage = newStage;
      const user = currentUserProfile ? currentUserProfile.nombre : 'Usuario';
      t.historial.push({estado: stageInfo(newStage).label, fecha: fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), autor: user});
      saveToLocal();
      renderTicketsKanban(); renderTicketsTable(); 
      if(window.renderAll) window.renderAll(); // Para actualizar Dashboard
      checkBillingButtonVisibility(t);
      toast('Ticket #'+id+' movido a "'+stageInfo(newStage).label+'"');
    }
  });
}

export function openTicketModal(id){
  const t = DATA.tickets.find(x=>x.id===id);
  if(!t) return;
  currentTicketId = id;
  document.getElementById('mt-id').textContent = '#'+t.id;
  document.getElementById('mt-ingreso').textContent = 'Ingresó el ' + t.ingreso;
  document.getElementById('mt-cliente').textContent = t.cliente;
  document.getElementById('mt-equipo').textContent = t.equipo;
  document.getElementById('mt-accesorios').textContent = t.accesorios || 'Ninguno';
  document.getElementById('mt-condicion').textContent = t.condicion || 'Sin registrar';
  document.getElementById('mt-prioridad').innerHTML = `<div class="prio ${t.prioridad.toLowerCase()}" style="display:inline-flex;">${t.prioridad}</div>`;
  document.getElementById('mt-tecnico').textContent = t.tecnico;
  document.getElementById('mt-falla').textContent = t.falla;
  document.getElementById('mt-estado-select').value = t.stage;
  document.getElementById('mt-presupuesto-chk').checked = !!t.presupuestoAprobado;

  if(!t.checklist) t.checklist = {encendido:false, respaldo:false, memoria:false};
  document.getElementById('chk-encendido').checked = !!t.checklist.encendido;
  document.getElementById('chk-respaldo').checked = !!t.checklist.respaldo;
  document.getElementById('chk-memoria').checked = !!t.checklist.memoria;

  document.getElementById('mt-diagnostico-input').value = t.diagnostico || '';
  
  populateRepuestosSelect();
  renderTicketPiezas(t);
  checkBillingButtonVisibility(t);

  document.getElementById('mt-historial').innerHTML = t.historial.map(h=>`<div class="tl-item"><b>${h.estado}</b><span>${h.fecha} · ${h.autor}</span></div>`).join('');
  renderTicketNotas(t);
  openModal('modal-ticket');
}

export function togglePresupuesto(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  t.presupuestoAprobado = document.getElementById('mt-presupuesto-chk').checked;
  saveToLocal();
  renderTicketsTable();
  toast(t.presupuestoAprobado ? 'Presupuesto marcado como aprobado' : 'Presupuesto pendiente');
}

export function updateChecklist(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  t.checklist = {
    encendido: document.getElementById('chk-encendido').checked,
    respaldo: document.getElementById('chk-respaldo').checked,
    memoria: document.getElementById('chk-memoria').checked
  };
  saveToLocal();
  toast('Checklist actualizado');
}

export function sendWhatsAppNotice(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  toast(`Simulación: Mensaje de WhatsApp enviado a #${t.id}`);
}

export function checkBillingButtonVisibility(t){
  const btn = document.getElementById('btn-facturar-ticket');
  if(t.stage === 'listo'){
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

export function saveDiagnostico(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  t.diagnostico = document.getElementById('mt-diagnostico-input').value.trim();
  saveToLocal();
  toast('Diagnóstico guardado con éxito');
}

export function populateRepuestosSelect(){
  const sel = document.getElementById('mt-repuesto-select');
  sel.innerHTML = DATA.productos.map(p => `<option value="${p.sku}">${p.nombre} (${fmt(p.precio)})</option>`).join('');
}

export function renderTicketPiezas(t){
  if(!t.piezas) t.piezas = [];
  document.getElementById('mt-piezas').innerHTML = t.piezas.length ? t.piezas.map((p, idx)=>`
    <tr><td>${p.nombre}</td><td class="mono">${p.cant}</td><td class="mono">${fmt(p.costo * p.cant)}</td><td><button class="btn btn-ghost btn-sm" onclick="removePiezaFromTicket(${idx})" style="color:var(--red); padding:2px 6px;">✕</button></td></tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--muted);">Sin repuestos o servicios añadidos.</td></tr>';

  const total = t.piezas.reduce((acc, p) => acc + (p.costo * p.cant), 0);
  document.getElementById('mt-total-costo').textContent = fmt(total);
}

export function addPiezaToTicket(){
  const sku = document.getElementById('mt-repuesto-select').value;
  const prod = DATA.productos.find(p => p.sku === sku);
  if(!prod) return;

  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const existing = t.piezas.find(p => p.nombre === prod.nombre);
  if(existing){ existing.cant++; } else { t.piezas.push({ nombre: prod.nombre, cant: 1, costo: prod.precio }); }
  saveToLocal();
  renderTicketPiezas(t);
  toast('Artículo añadido al ticket');
}

export function removePiezaFromTicket(idx){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  t.piezas.splice(idx, 1);
  saveToLocal();
  renderTicketPiezas(t);
  toast('Artículo removido');
}

export function enviarAFacturacion(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  
  const total = (t.piezas || []).reduce((acc, p) => acc + (p.costo * p.cant), 0);
  
  // AHORA EL SISTEMA TE AVISARÁ SI EL TICKET ESTÁ EN CERO
  if(total <= 0){ 
      alert('ATENCIÓN: El ticket está en $0.00. Debes agregar al menos un repuesto o servicio (ej. "Revisión") en la sección de Repuestos antes de enviarlo a Caja.'); 
      return; 
  }

  const yaExiste = DATA.cajaPendientes.some(p => p.ref === t.id);
  if(yaExiste){ 
      alert('Este ticket ya fue enviado a facturación previamente.'); 
      return; 
  }

  DATA.cajaPendientes.push({
    origen: 'Ticket', ref: t.id, clienteId: t.clienteId, cliente: t.cliente,
    concepto: t.piezas.map(p => `${p.cant}x ${p.nombre}`).join(', '), total: total
  });

  saveToLocal();
  closeModal('modal-ticket');
  if(window.renderAll) window.renderAll(); 
  alert('¡Éxito! El ticket #' + t.id + ' se envió a la pestaña de CAJA para su cobro.');
}

export function renderTicketNotas(t){
  document.getElementById('mt-notas').innerHTML = t.notas.length ? t.notas.map(n=>`<div class="note-item"><b>${n.autor}</b><span class="t">${n.fecha}</span><div>${n.texto}</div></div>`).join('') : '<div style="color:var(--muted);font-size:12.5px;">Sin notas todavía.</div>';
}

export function addTicketNota(){
  const input = document.getElementById('mt-nota-input');
  const texto = input.value.trim();
  if(!texto) return;
  const t = DATA.tickets.find(x=>x.id===currentTicketId);
  const user = currentUserProfile ? currentUserProfile.nombre : 'Usuario';
  t.notas.push({autor:user, fecha:'Ahora', texto});
  saveToLocal();
  input.value = '';
  renderTicketNotas(t);
  toast('Nota agregada');
}

export function changeTicketStage(){
  const newStage = document.getElementById('mt-estado-select').value;
  const t = DATA.tickets.find(x=>x.id===currentTicketId);
  if(t.stage===newStage) return;
  t.stage = newStage;
  const user = currentUserProfile ? currentUserProfile.nombre : 'Usuario';
  t.historial.push({estado: stageInfo(newStage).label, fecha:fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), autor:user});
  saveToLocal();
  document.getElementById('mt-historial').innerHTML = t.historial.map(h=>`<div class="tl-item"><b>${h.estado}</b><span>${h.fecha} · ${h.autor}</span></div>`).join('');
  renderTicketsTable(); renderTicketsKanban(); 
  if(window.renderAll) window.renderAll();
  checkBillingButtonVisibility(t);
  toast('Estado actualizado a "'+stageInfo(newStage).label+'"');
}

export function createTicket(){
  const clienteId = document.getElementById('nt-cliente-id').value;
  const clienteInputVal = document.getElementById('nt-cliente-input').value.trim();
  const cliente = clienteId ? DATA.clientes.find(c=>c.id===clienteId) : null;
  const clienteNombre = cliente ? getFullName(cliente) : (clienteInputVal || 'Mostrador');

  const equipo = document.getElementById('nt-equipo').value.trim();
  const accesorios = document.getElementById('nt-accesorios').value.trim();
  const condicion = document.getElementById('nt-condicion').value.trim();
  const falla = document.getElementById('nt-falla').value.trim();
  
  if(!equipo || !falla){ toast('Completa equipo y falla'); return; }
  const id = 'TK-' + (nextTicketNum++);
  const user = currentUserProfile ? currentUserProfile.nombre : 'Mostrador';
  
  const t = {
    id, clienteId: cliente?cliente.id:null, cliente: clienteNombre,
    equipo, accesorios, condicion, presupuestoAprobado: false,
    checklist: {encendido:false, respaldo:false, memoria:false},
    falla, prioridad: document.getElementById('nt-prioridad').value, stage:'pendiente',
    tecnico: document.getElementById('nt-tecnico').value, ingreso: fDate(new Date().toISOString().split('T')[0]),
    diagnostico:'Pendiente de revisión inicial.', piezas:[],
    historial:[{estado:'Recibido', fecha:fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), autor:user}], notas:[]
  };
  DATA.tickets.unshift(t);
  saveToLocal();
  document.getElementById('nt-equipo').value=''; 
  document.getElementById('nt-accesorios').value='';
  document.getElementById('nt-condicion').value='';
  document.getElementById('nt-falla').value='';
  document.getElementById('nt-cliente-input').value='';
  document.getElementById('nt-cliente-id').value='';
  closeModal('modal-nuevo-ticket');
  
  renderTicketsTable(); renderTicketsKanban(); 
  if(window.renderAll) window.renderAll();
  toast('Ticket #'+id+' creado');
}
