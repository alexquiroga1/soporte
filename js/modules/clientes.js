// js/modules/clientes.js
import { DATA, saveToLocal } from '../core/store.js';
import { fmt, initials, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal } from './ui.js';
import { stageInfo } from './tickets.js';

let currentClientId = null;

export function renderClientesTable(){
  const searchEl = document.getElementById('cl-search');
  const q = (searchEl ? searchEl.value : '').toLowerCase();
  
  const rows = DATA.clientes.filter(c => {
    const full = getFullName(c) || '';
    const tel = c.tel || '';
    const dni = c.dni || '';
    return !q || full.toLowerCase().includes(q) || tel.toLowerCase().includes(q) || dni.toLowerCase().includes(q);
  });
  
  const tbody = document.getElementById('clientes-table-body');
  if(!tbody) return;

  tbody.innerHTML = rows.map(c=>{
    const nTickets = DATA.tickets ? DATA.tickets.filter(t=>t.clienteId===c.id).length : 0;
    const totalCompras = (c.compras || []).reduce((s,p)=>s+p.monto,0);
    const nombreSeguro = c.nombre || 'Sin Nombre';
    const direccionSegura = c.direccion || '—';
    const localidadSegura = c.localidad ? ` - ${c.localidad}` : '';
    
    return `<tr class="tbl-row" onclick="openClientModal('${c.id}')">
      <td><div class="cust"><div class="ci">${initials(nombreSeguro)}</div><div><b>${getFullName(c)}</b><span>${direccionSegura}${localidadSegura}</span></div></div></td>
      <td class="mono">${c.tel || '—'}</td>
      <td class="mono">${nTickets}</td>
      <td class="mono">${fmt(totalCompras)}</td>
      <td class="mono">${fmt(c.limiteCredito || 0)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openClientModal('${c.id}')">Ver perfil</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:26px;">Sin resultados o lista vacía.</td></tr>';
  
  const meta = document.getElementById('clientes-meta');
  if(meta) meta.textContent = DATA.clientes.length + ' REGISTRADOS';
}

export function switchClientTab(tabId, el){
  const group = el.parentElement;
  group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  const container = group.parentElement;
  container.querySelectorAll('.client-subview').forEach(sv=>{
    sv.style.display = sv.id === tabId ? 'block' : 'none';
  });
}

export function openClientModal(id){
  const c = DATA.clientes.find(x=>x.id===id);
  if(!c) return;
  currentClientId = id;
  const fullName = getFullName(c);
  
  document.getElementById('mc-nombre').textContent = fullName;
  document.getElementById('mc-email-header').textContent = (c.dni ? 'DNI: ' + c.dni : '') + ' | ' + (c.email || 'Sin correo');
  document.getElementById('mc-tel').textContent = c.tel || '—';
  
  let dirCompleta = c.direccion || '—';
  if(c.localidad) dirCompleta += `, ${c.localidad}`;
  if(c.provincia) dirCompleta += ` (${c.provincia})`;
  document.getElementById('mc-direccion').textContent = dirCompleta;
  
  const limInput = document.getElementById('mc-limite-input');
  if(limInput) limInput.value = c.limiteCredito || 0;

  const misTickets = DATA.tickets ? DATA.tickets.filter(t => t.clienteId === id || t.cliente === fullName) : [];
  const elNtickets = document.getElementById('mc-ntickets');
  if(elNtickets) elNtickets.textContent = misTickets.length;
  
  const tkAbiertos = misTickets.filter(t => t.stage !== 'entregado');
  const tkCerrados = misTickets.filter(t => t.stage === 'entregado');
  
  const renderTk = (arr) => arr.length ? arr.map(t=>{
    const st = stageInfo(t.stage);
    return `<div class="note-item" style="cursor:pointer; display:flex; justify-content:space-between;" onclick="closeModal('modal-cliente'); if(window.openTicketModal) window.openTicketModal('${t.id}')">
      <span><b>#${t.id}</b> — ${t.equipo}</span> <span class="badge ${st ? st.badge : 'pend'}">${st ? st.label : 'Pendiente'}</span>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:12.5px;">Sin tickets en esta categoría.</div>';
  
  const elTkAbiertos = document.getElementById('mc-tickets-abiertos');
  if(elTkAbiertos) elTkAbiertos.innerHTML = renderTk(tkAbiertos);
  const elTkCerrados = document.getElementById('mc-tickets-finalizados');
  if(elTkCerrados) elTkCerrados.innerHTML = renderTk(tkCerrados);

  const misVentas = DATA.ventas ? DATA.ventas.filter(v => v.cliente === fullName) : [];
  const elVentas = document.getElementById('mc-ventas-list');
  if(elVentas) {
      elVentas.innerHTML = misVentas.length ? misVentas.map(v=>`
        <tr><td class="mono">${v.folio}</td><td class="mono">${v.hora}</td><td>${v.articulos}</td><td class="mono">${fmt(v.total)}</td></tr>
      `).join('') : '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px;">Sin compras registradas.</td></tr>';
  }

  const misCreditos = DATA.creditos ? DATA.creditos.filter(cr => cr.cliente === fullName) : [];
  const crActivos = misCreditos.filter(cr => cr.saldo > 0);
  const crPagados = misCreditos.filter(cr => cr.saldo <= 0);

  const renderCr = (arr) => arr.length ? arr.map(cr=>`
    <div class="note-item" style="border-left:3px solid ${cr.saldo>0?'var(--red)':'var(--teal)'}; border-radius:4px 9px 9px 4px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <b>${cr.concepto}</b> <span class="mono">Carpeta: ${cr.id || ''}</span>
      </div>
      <div style="font-size:11.5px; color:var(--muted);">
        Deuda Histórica: ${fmt(cr.original)} | Saldo actual: <b style="color:${cr.saldo>0?'var(--red)':'var(--teal)'};">${fmt(cr.saldo)}</b>
      </div>
    </div>
  `).join('') : '<div style="color:var(--muted);font-size:12.5px;">Sin carpetas de crédito.</div>';

  const elCrActivos = document.getElementById('mc-prestamos-activos');
  if(elCrActivos) elCrActivos.innerHTML = renderCr(crActivos);
  const elCrFin = document.getElementById('mc-prestamos-finalizados');
  if(elCrFin) elCrFin.innerHTML = renderCr(crPagados);

  const primerTab = document.querySelector('#modal-cliente .tabs .tab');
  if(primerTab) switchClientTab('mc-tab-prestamos', primerTab);

  openModal('modal-cliente');
}

export function saveClientLimit(){
  if(!currentClientId) return;
  const c = DATA.clientes.find(x => x.id === currentClientId);
  if(c){
    c.limiteCredito = parseFloat(document.getElementById('mc-limite-input').value) || 0;
    saveToLocal();
    renderClientesTable();
    toast('Límite de crédito actualizado a ' + fmt(c.limiteCredito));
  }
}

export function createCliente(){
  const elNombre = document.getElementById('ncl-nombre');
  if(!elNombre || !elNombre.value.trim()){ toast('El nombre es obligatorio'); return; }
  
  const getVal = (id) => document.getElementById(id) ? document.getElementById(id).value.trim() : '';
  const nombre = elNombre.value.trim();
  const id = 'c' + (DATA.clientes.length + 1) + '_' + Date.now().toString().slice(-4);
  
  const nuevoCliente = {
    id, nombre, apellido: getVal('ncl-apellido'), dni: getVal('ncl-dni'),
    tipo: 'Regular', contacto: nombre,
    direccion: getVal('ncl-direccion') || '—', provincia: getVal('ncl-provincia'),
    localidad: getVal('ncl-localidad'), barrio: getVal('ncl-barrio'),
    tel: getVal('ncl-tel') || '—', email: getVal('ncl-email') || '—',
    equipos:[], compras:[], notas:[],
    limiteCredito: parseFloat(getVal('ncl-limite')) || 0
  };
  
  DATA.clientes.unshift(nuevoCliente);
  saveToLocal();

  ['ncl-nombre','ncl-apellido','ncl-dni','ncl-direccion','ncl-provincia','ncl-localidad','ncl-barrio','ncl-tel','ncl-email','ncl-limite'].forEach(i=>{
      if(document.getElementById(i)) document.getElementById(i).value='';
  });
  
  closeModal('modal-nuevo-cliente');
  renderClientesTable(); 
  if(window.populateClienteSelectPOS) window.populateClienteSelectPOS();
  
  if(document.getElementById('modal-nuevo-ticket') && document.getElementById('modal-nuevo-ticket').classList.contains('active')){
    if(window.selectClientForTicket) window.selectClientForTicket(nuevoCliente.id, getFullName(nuevoCliente));
  }
  toast('Cliente guardado con éxito');
}

export function populateClienteSelectPOS(){
  const sel = document.getElementById('pos-cliente');
  if(sel) {
      sel.innerHTML = '<option value="Mostrador">Cliente: Mostrador</option>' + DATA.clientes.map(c=>`<option>Cliente: ${getFullName(c)}</option>`).join('');
  }
}

// ====== NUEVAS FUNCIONES DE PRÉSTAMOS DESDE EL PERFIL ======

export function nuevoCreditoDesdePerfil() {
    const elNombre = document.getElementById('mc-nombre').textContent;
    closeModal('modal-cliente');
    if(window.openNuevoCreditoModal) window.openNuevoCreditoModal();
    
    setTimeout(() => {
        const sel = document.getElementById('ncr-cliente');
        if(sel) {
            for(let i=0; i<sel.options.length; i++) {
                if(sel.options[i].text.includes(elNombre)) { sel.selectedIndex = i; break; }
            }
        }
    }, 100);
}

export function refinanciarDeudaPerfil() {
    const elNombre = document.getElementById('mc-nombre').textContent;
    const activos = DATA.creditos.filter(cr => cr.cliente === elNombre && cr.saldo > 0);
    
    if(activos.length === 0) { toast('El cliente no tiene deuda activa para refinanciar'); return; }
    
    let deudaTotal = activos.reduce((s, c) => s + c.saldo, 0);
    
    activos.forEach(c => {
        c.saldo = 0;
        c.concepto += ' (Refinanciado)';
    });
    saveToLocal();

    closeModal('modal-cliente');
    if(window.openNuevoCreditoModal) window.openNuevoCreditoModal();
    
    setTimeout(() => {
        const sel = document.getElementById('ncr-cliente');
        if(sel) {
            for(let i=0; i<sel.options.length; i++) {
                if(sel.options[i].text.includes(elNombre)) { sel.selectedIndex = i; break; }
            }
        }
        const elConcepto = document.getElementById('ncr-concepto');
        const elMonto = document.getElementById('ncr-monto');
        if(elConcepto) elConcepto.value = 'Refinanciación de Deuda Anterior';
        if(elMonto) elMonto.value = deudaTotal.toFixed(2);
        toast('Deuda unificada. Genere el nuevo préstamo.');
    }, 100);
}