// js/modules/tickets.js
import { DATA, TICKET_STAGES } from '../core/store.js';
import { fDate, fmt, initials, toast, getFullName } from '../core/utils.js';
import { openModal, closeModal, wireKanbanDrag } from './ui.js';
import { currentUserProfile } from '../core/auth.js';

let currentTicketId = null;
let isCreatingTicket = false;

// Fallback por si algún estado no existe
export const stageInfo = key => TICKET_STAGES.find(s=>s.key===key) || {label: key, color:'#8891A3', badge:'pend'};

// ==========================================
// SISTEMA DE BITÁCORA / AUDITORÍA
// ==========================================
export async function logTicketEvent(ticketId, accion, detalle = '') {
  const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
  const fechaStr = fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
  const logEntry = { fecha: fechaStr, autor: user, accion, detalle };
  
  try {
      await window.db.collection('tickets').doc(ticketId).update({
          historial: window.firebase.firestore.FieldValue.arrayUnion(logEntry)
      });
      
      const t = DATA.tickets.find(x => x.id === ticketId);
      if(t){
          if(!t.historial) t.historial = [];
          t.historial.push(logEntry);
          if(currentTicketId === ticketId) renderTicketNotas(t);
      }
  } catch (e) {
      console.error("Error registrando historial", e);
  }
}

export function renderTicketNotas(t){
  const hist = t.historial || [];
  document.getElementById('mt-notas').innerHTML = hist.slice().reverse().map(h=>`
    <div style="background:var(--bg); padding:10px; border-radius:8px; border-left:3px solid var(--copper); margin-bottom:8px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px; font-size:11px;">
        <b style="color:var(--ink);">${h.accion}</b> 
        <span style="color:var(--muted);">${h.fecha}</span>
      </div>
      <div style="font-size:12px; color:var(--ink);">
        ${h.detalle ? `<div style="margin-bottom:4px; line-height:1.4;">${h.detalle}</div>` : ''}
        <div style="font-size:10px; color:var(--muted); margin-top:6px; font-family:'IBM Plex Mono', monospace;">Usuario: ${h.autor}</div>
      </div>
    </div>
  `).join('') || '<div style="color:var(--muted);font-size:11px;text-align:center;padding:10px;">Sin historial.</div>';
}

export async function addTicketNota(){
  const input = document.getElementById('mt-nota-input');
  const texto = input.value.trim();
  if(!texto) return;
  
  await logTicketEvent(currentTicketId, 'Nota manual', texto);
  input.value = '';
  toast('Nota guardada');
}

// ==========================================
// BÚSQUEDA Y LISTADO
// ==========================================

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
    box.innerHTML = `<div style="padding:10px 12px; font-size:12.5px; color:var(--muted);">No encontrado. <span style="color:var(--copper); font-weight:600; cursor:pointer;" onclick="openModal('modal-nuevo-cliente'); document.getElementById('nt-client-suggestions').style.display='none';">¿Crear nuevo cliente?</span></div>`;
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
    const presupText = t.presupuestoFijado 
        ? `<span style="color:var(--teal); font-family:'IBM Plex Mono',monospace; font-weight:700;">${fmt(t.presupuestoEstimado)}</span>` 
        : `<span style="color:var(--amber); font-size:10.5px; font-weight:700;">PENDIENTE</span>`;
        
    return `<tr class="tbl-row" onclick="openTicketModal('${t.id}')">
      <td><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></td>
      <td class="mono">#${t.id}</td>
      <td>${t.cliente}</td>
      <td>${t.equipo}</td>
      <td class="mono">${t.ingreso}</td>
      <td>${presupText}</td>
      <td><span class="badge ${st.badge}">${st.label}</span></td>
      <td>${t.tecnico}</td>
      <td onclick="event.stopPropagation()"><button class="btn btn-ghost btn-sm" onclick="openTicketModal('${t.id}')" title="Consultar detalle" style="padding:4px 8px; margin-right:4px;">👁️</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:26px;">No hay tickets con estos filtros.</td></tr>';

  const abiertos = DATA.tickets.filter(t=>t.stage!=='entregado' && t.stage!=='cancelado' && t.stage!=='noreparable').length;
  document.getElementById('tickets-meta').textContent = DATA.tickets.length + ' TOTALES · ' + abiertos + ' ABIERTOS';
  document.getElementById('badge-tickets').textContent = abiertos;
}

// ==========================================
// COMPROBANTE CHECK-IN / IMPRESIÓN
// ==========================================
export function printTicket(id){
  const t = DATA.tickets.find(x => x.id === id);
  if(!t) return;
  const negNombre = DATA.negocio ? DATA.negocio.nombre : 'EMPRESA';
  const check = (val) => val ? '☑' : '☐';

  const win = window.open('', '', 'width=800,height=900');
  win.document.write(`
    <html>
    <head><title>Comprobante de Recepción #${t.id}</title><style>body { font-family: 'Inter', Helvetica, sans-serif; padding: 40px; color: #171A21; background: #fff; font-size: 13px; line-height: 1.5; } .header { text-align: center; margin-bottom: 20px; padding-bottom: 20px; border-bottom: 2px solid #171A21; } .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; } .header h2 { margin: 5px 0 0 0; font-size: 16px; color: #565E70; } .row { display: flex; justify-content: space-between; margin-bottom: 10px; } .box { border: 1px solid #E4E6EC; padding: 15px; border-radius: 8px; margin-bottom: 20px; } .box-title { font-weight: bold; text-transform: uppercase; font-size: 11px; color: #8891A3; margin-bottom: 10px; border-bottom: 1px solid #E4E6EC; padding-bottom: 5px; } .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; } .check-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; } .check-item { display: flex; align-items: center; gap: 6px; } .signatures { margin-top: 50px; display: flex; justify-content: space-between; } .sig-box { width: 45%; text-align: center; border-top: 1px solid #171A21; padding-top: 10px; } .legal { font-size: 10px; color: #8891A3; text-align: justify; margin-top: 30px; }</style></head>
    <body>
      <div class="header"><h1>${negNombre}</h1><h2>COMPROBANTE DE INGRESO / CHECK-IN</h2></div>
      <div class="row"><div><b>Ticket Nº:</b> ${t.id}</div><div><b>Fecha/Hora:</b> ${t.historial && t.historial.length ? t.historial[0].fecha : t.ingreso}</div></div>
      <div class="row"><div><b>Técnico Receptor:</b> ${t.tecnico}</div><div><b>Prioridad:</b> ${t.prioridad}</div></div>
      <div class="box"><div class="box-title">1. Datos del Cliente</div><p><b>Nombre/Razón Social:</b> ${t.cliente}</p></div>
      <div class="box"><div class="box-title">2. Ficha Técnica del Equipo</div><div class="grid-2"><div><b>Equipo:</b> ${t.equipo} ${t.marca || ''} ${t.modelo || ''}</div><div><b>Nº Serie/IMEI:</b> ${t.serie || 'N/A'}</div><div><b>S.O. / Specs:</b> ${t.os ? t.os+' | ' : ''}${t.specs || 'N/A'}</div><div><b>PIN/Pass:</b> ${t.pin || 'N/A'}</div></div></div>
      <div class="box"><div class="box-title">3. Estado Físico y Accesorios al Ingreso</div><div class="grid-2"><div><div style="font-weight:bold; margin-bottom:6px;">Estado Físico (OK / Sin Daños):</div><div class="check-list"><div class="check-item">${check(t.estadoFisico?.pantalla)} Pantalla</div><div class="check-item">${check(t.estadoFisico?.carcasa)} Carcasa</div><div class="check-item">${check(t.estadoFisico?.teclado)} Teclado</div><div class="check-item">${check(t.estadoFisico?.touchpad)} Touchpad</div><div class="check-item">${check(t.estadoFisico?.bisagras)} Bisagras</div><div class="check-item">${check(t.estadoFisico?.puertos)} Puertos</div><div class="check-item">${check(t.estadoFisico?.cargador)} Cargador (Est.)</div><div class="check-item">${check(t.estadoFisico?.bateria)} Batería</div></div></div><div><div style="font-weight:bold; margin-bottom:6px;">Accesorios Recibidos:</div><div class="check-list"><div class="check-item">${check(t.accesoriosObj?.cargador)} Cargador</div><div class="check-item">${check(t.accesoriosObj?.mouse)} Mouse</div><div class="check-item">${check(t.accesoriosObj?.funda)} Funda/Maletín</div><div class="check-item">${check(t.accesoriosObj?.cable)} Cable</div></div><div style="margin-top:6px;"><b>Otros:</b> ${t.accesoriosObj?.otro || 'Ninguno'}</div></div></div><div style="margin-top:15px; border-top:1px dashed #E4E6EC; padding-top:10px;"><b>Observaciones Adicionales (Rayones, golpes, etc.):</b><br>${t.condicion || 'Sin observaciones.'}</div></div>
      <div class="box"><div class="box-title">4. Falla Declarada por el Cliente</div><p>${t.falla}</p></div>
      <div class="legal"><b>TÉRMINOS Y CONDICIONES DE RECEPCIÓN:</b> El cliente declara que los datos del equipo, accesorios y estado físico detallados en este comprobante son correctos y corresponden al estado en que se entrega el dispositivo. ${negNombre} no se responsabiliza por fallas ocultas o intermitentes no declaradas al momento del ingreso, ni por la pérdida de datos y/o información contenida en los dispositivos de almacenamiento. Se recomienda realizar una copia de seguridad previa. Todo equipo abandonado por más de 90 días será considerado en abandono.</div>
      <div class="signatures"><div class="sig-box">Firma y Aclaración Cliente</div><div class="sig-box">Firma Técnico Receptor</div></div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  win.document.close();
}

// ==========================================
// KANBAN Y ESTADOS
// ==========================================

export function renderTicketsKanban(){
  const board = document.getElementById('tickets-kanban');
  if(!board) return;
  board.innerHTML = TICKET_STAGES.map(s=>{
    const items = DATA.tickets.filter(t=>t.stage===s.key);
    const cards = items.map(t=>`
      <div class="kanban-card" draggable="true" data-id="${t.id}" onclick="openTicketModal('${t.id}')">
        <div class="kc-top"><span class="kc-id">#${t.id}</span><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></div>
        <b>${t.cliente}</b><div class="kc-sub">${t.equipo}</div>
        <div class="kc-foot"><span>${t.tecnico}</span><span>${t.ingreso}</span></div>
      </div>`).join('');
    return `<div class="kanban-col" data-stage="${s.key}"><div class="kanban-col-head"><span class="dot" style="background:${s.color}"></span>${s.label}<b>${items.length}</b></div>${cards}</div>`;
  }).join('');
  
  wireKanbanDrag(board, (id, newStage)=> changeTicketStageAt(id, newStage));
}

export async function changeTicketStageAt(id, newStage) {
    const t = DATA.tickets.find(x=>x.id===id);
    if(t && t.stage !== newStage){
        const oldStageStr = stageInfo(t.stage).label;
        const newStageStr = stageInfo(newStage).label;
        
        try {
            await window.db.collection('tickets').doc(id).update({ stage: newStage });
            await logTicketEvent(id, 'Estado cambiado', `${oldStageStr} → ${newStageStr}`);
            toast(`Ticket movido a "${newStageStr}"`);
        } catch(error) {
            toast("No se pudo actualizar el estado.");
        }
    }
}

export function changeTicketStage(){
    const newStage = document.getElementById('mt-estado-select').value;
    changeTicketStageAt(currentTicketId, newStage);
}

// ==========================================
// VISTA DETALLE DEL TICKET
// ==========================================

export function openTicketModal(id){
  const t = DATA.tickets.find(x=>x.id===id);
  if(!t) return;
  currentTicketId = id;

  const setText = (elId, text) => { const el = document.getElementById(elId); if(el) el.textContent = text; };
  const setHTML = (elId, html) => { const el = document.getElementById(elId); if(el) el.innerHTML = html; };
  const setVal  = (elId, val)  => { const el = document.getElementById(elId); if(el) el.value = val; };
  
  setText('mt-id', '#'+t.id);
  setText('mt-ingreso', 'Ingresó el ' + t.ingreso);
  setText('mt-cliente', t.cliente);
  
  setText('mt-equipo', t.equipo || 'Equipo');
  setText('mt-marca-modelo', (t.marca || '') + ' ' + (t.modelo || ''));
  setText('mt-serie', t.serie || 'N/A');
  setText('mt-specs', (t.os ? t.os + ' | ' : '') + (t.specs || 'N/A'));
  setText('mt-pin', t.pin || 'N/A');
  
  const efContainer = document.getElementById('mt-estado-fisico');
  if(t.estadoFisico && efContainer) {
      let efHtml = '';
      if(t.estadoFisico.pantalla) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Pantalla</span>';
      if(t.estadoFisico.carcasa) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Carcasa</span>';
      if(t.estadoFisico.teclado) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Teclado</span>';
      if(t.estadoFisico.touchpad) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Touchpad</span>';
      if(t.estadoFisico.bisagras) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Bisagras</span>';
      if(t.estadoFisico.puertos) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Puertos</span>';
      if(t.estadoFisico.cargador) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Cargador</span>';
      if(t.estadoFisico.bateria) efHtml += '<span class="badge" style="background:#f0f0f0; color:#333;">Batería</span>';
      efContainer.innerHTML = efHtml || '<span style="font-size:11px; color:var(--muted);">Sin detalles OK</span>';
  } else if (efContainer) { efContainer.innerHTML = '<span style="font-size:11px; color:var(--muted);">N/A</span>'; }

  const accContainer = document.getElementById('mt-accesorios-obj');
  if(t.accesoriosObj && accContainer) {
      let accHtml = '';
      if(t.accesoriosObj.cargador) accHtml += '<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🔌 Cargador</span>';
      if(t.accesoriosObj.mouse) accHtml += '<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🖱️ Mouse</span>';
      if(t.accesoriosObj.funda) accHtml += '<span class="badge" style="background:#e3f2fd; color:#0d47a1;">💼 Funda</span>';
      if(t.accesoriosObj.cable) accHtml += '<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🪢 Cable</span>';
      if(t.accesoriosObj.otro) accHtml += `<span class="badge" style="background:#e3f2fd; color:#0d47a1;">➕ ${t.accesoriosObj.otro}</span>`;
      accContainer.innerHTML = accHtml || '<span style="font-size:11px; color:var(--muted);">Ninguno</span>';
  } else if (accContainer) { accContainer.innerHTML = '<span style="font-size:11px; color:var(--muted);">N/A</span>'; }

  setText('mt-condicion', t.condicion ? `${t.condicion}` : 'Sin observaciones adicionales');
  setHTML('mt-prioridad', `<span class="badge ${t.prioridad.toLowerCase()}">${t.prioridad}</span>`);
  setHTML('mt-tecnico', `<span style="background:var(--ink); color:#fff; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; font-size:9px; font-weight:bold; margin-right:6px;">${initials(t.tecnico)}</span> ${t.tecnico}`);
  setText('mt-falla', t.falla);
  setVal('mt-estado-select', t.stage);
  setVal('mt-diagnostico-input', t.diagnostico || '');
  
  const fotosContainer = document.getElementById('mt-fotos-container');
  const fotosGallery = document.getElementById('mt-fotos-gallery');
  if(t.fotos && t.fotos.length > 0 && fotosContainer && fotosGallery) {
      fotosContainer.style.display = 'block';
      fotosGallery.innerHTML = t.fotos.map(url => `
          <a href="${url}" target="_blank" title="Ver foto completa">
            <img src="${url}" style="width: 70px; height: 70px; object-fit: cover; border-radius: 8px; border: 1px solid var(--line);">
          </a>
      `).join('');
  } else if (fotosContainer) { fotosContainer.style.display = 'none'; }
  
  // LÓGICA INTELIGENTE DEL STEPPER
  const linearStages = ['pendiente', 'diagnostico', 'presupuesto', 'reparacion', 'repuesto', 'listo', 'entregado'];
  const currentIndex = linearStages.indexOf(t.stage);
  
  document.querySelectorAll('#mt-stepper .step-sm').forEach(el => {
    const stepKey = el.getAttribute('data-step');
    const stepIndex = linearStages.indexOf(stepKey);
    el.className = 'step-sm'; 
    
    if(t.stage === 'entregado') { 
        el.classList.add('completed'); 
    } else if (t.stage === 'cancelado' || t.stage === 'noreparable') {
        if(stepIndex === 0) el.classList.add('completed'); 
    } else if (t.stage === 'garantia') {
        if(stepKey === 'reparacion') el.classList.add('active');
    } else {
        if(stepKey === t.stage) el.classList.add('active');
        else if (stepIndex < currentIndex && currentIndex !== -1) el.classList.add('completed');
    }
  });

  if(!t.presupuestoFijado) t.presupuestoFijado = false;
  setVal('input-presupuesto', t.presupuestoEstimado || '');
  
  const elTxtPresupuesto = document.getElementById('txt-presupuesto-fijado');
  const viewEdit = document.getElementById('view-edit-budget');
  const viewLocked = document.getElementById('view-locked-budget');

  if(t.presupuestoFijado) {
    if(elTxtPresupuesto) elTxtPresupuesto.textContent = fmt(t.presupuestoEstimado);
    if(viewEdit) viewEdit.style.display = 'none';
    if(viewLocked) viewLocked.style.display = 'block';
  } else {
    if(viewLocked) viewLocked.style.display = 'none';
    if(viewEdit) viewEdit.style.display = 'flex';
  }
  
  populateRepuestosSelect();
  renderTicketPiezas(t);
  checkBillingButtonVisibility(t);
  renderTicketNotas(t);
  
  if(window.goView) window.goView('ticket-detalle');
}

// ==========================================
// FINANZAS Y REPUESTOS DEL TICKET
// ==========================================

export async function fijarPresupuesto() {
  const val = parseFloat(document.getElementById('input-presupuesto').value);
  if(!val || val <= 0) { toast('Ingresa un monto válido'); return; }
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({
          presupuestoEstimado: val,
          presupuestoFijado: true
      });
      document.getElementById('txt-presupuesto-fijado').textContent = fmt(val);
      document.getElementById('view-edit-budget').style.display = 'none';
      document.getElementById('view-locked-budget').style.display = 'block';
      
      await logTicketEvent(currentTicketId, 'Presupuesto fijado', `Cotizado: ${fmt(val)}`);
      toast('Presupuesto fijado exitosamente');
  } catch(e) { toast('Error al fijar presupuesto'); }
}

export async function desbloquearPresupuesto() {
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ presupuestoFijado: false });
      document.getElementById('view-locked-budget').style.display = 'none';
      document.getElementById('view-edit-budget').style.display = 'flex';
      
      await logTicketEvent(currentTicketId, 'Presupuesto editado', 'Se habilitó la modificación del monto');
  } catch(e) { toast('Error al desbloquear'); }
}

export function sendWhatsAppNotice(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  const cli = DATA.clientes.find(c => c.id === t.clienteId || getFullName(c) === t.cliente);
  
  if(!cli || !cli.tel || cli.tel === '—') { alert('⚠️ El cliente no tiene un número de teléfono registrado.'); return; }
  
  let phone = cli.tel.replace(/\D/g, '');
  if (!phone.startsWith('54') && phone.length === 10) { phone = '549' + phone; }
  
  const empresa = DATA.negocio?.nombre || 'nuestro servicio técnico';
  const estadoStr = stageInfo(t.stage).label;
  const msg = `Hola ${t.cliente}, te escribimos de *${empresa}*.\n\nTe informamos que tu equipo *${t.equipo}* (Ticket #${t.id}) se encuentra actualmente en estado: *${estadoStr}*.\n\nCualquier consulta estamos a tu disposición.`;
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  
  window.open(url, '_blank');
  logTicketEvent(currentTicketId, 'Notificación enviada', 'El cliente fue notificado vía WhatsApp');
}

export function checkBillingButtonVisibility(t){
  const btn = document.getElementById('btn-facturar-ticket');
  if(t.stage === 'listo'){ btn.style.display = 'inline-flex'; } else { btn.style.display = 'none'; }
}

export async function saveDiagnostico(){
  const diagnostico = document.getElementById('mt-diagnostico-input').value.trim();
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ diagnostico });
      await logTicketEvent(currentTicketId, 'Diagnóstico actualizado', diagnostico);
      toast('Diagnóstico guardado con éxito');
  } catch(e) { toast('Error al guardar diagnóstico'); }
}

export function populateRepuestosSelect(){
  const sel = document.getElementById('mt-repuesto-select');
  if (!sel) return;
  if (!DATA.productos || DATA.productos.length === 0) { sel.innerHTML = '<option value="">(Catálogo vacío)</option>'; return; }
  sel.innerHTML = '<option value="">Selecciona repuesto...</option>' + DATA.productos.map(p => `<option value="${p.sku}">${p.nombre} (${fmt(p.precio)})</option>`).join('');
}

export function renderTicketPiezas(t){
  if(!t.piezas) t.piezas = [];
  document.getElementById('mt-piezas').innerHTML = t.piezas.length ? t.piezas.map((p, idx)=>`
    <tr>
      <td style="padding:6px;">${p.nombre}</td><td style="padding:6px;"><b>${p.cant}</b></td>
      <td style="padding:6px;"><input type="number" class="inp" style="width:70px; padding:4px; font-family:var(--font-mono); font-size:11px;" value="${p.costo}" onchange="updatePiezaPrice(${idx}, this.value)"></td>
      <td style="text-align: right; padding:6px;"><button class="btn btn-ghost btn-sm" onclick="removePiezaFromTicket(${idx})" style="color:var(--red); padding:2px 6px; border:none; background:transparent;">✕</button></td>
    </tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--muted); text-align:center; padding:10px;">Sin repuestos.</td></tr>';
  const total = t.piezas.reduce((acc, p) => acc + (p.costo * p.cant), 0);
  document.getElementById('mt-total-costo').textContent = fmt(total);
}

export async function updatePiezaPrice(idx, newPrice) {
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const val = parseFloat(newPrice);
  if(isNaN(val) || val < 0) return;
  
  const nuevasPiezas = [...t.piezas];
  nuevasPiezas[idx].costo = val;
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ piezas: nuevasPiezas });
      await logTicketEvent(currentTicketId, 'Costo modificado', `El precio de "${nuevasPiezas[idx].nombre}" se ajustó a ${fmt(val)}`);
      toast('Costo actualizado');
  } catch(e) { toast('Error actualizando costo'); }
}

export async function addPiezaToTicket(){
  const sku = document.getElementById('mt-repuesto-select').value;
  if(!sku) { toast('Selecciona un repuesto válido'); return; }
  
  const prod = DATA.productos.find(p => p.sku === sku);
  if(!prod) return;

  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const nuevasPiezas = [...(t.piezas || [])];
  
  const existing = nuevasPiezas.find(p => (p.sku && p.sku === prod.sku) || (!p.sku && p.nombre === prod.nombre));
  if(existing){ existing.cant++; existing.sku = existing.sku || prod.sku; } 
  else { nuevasPiezas.push({ sku: prod.sku, nombre: prod.nombre, cant: 1, costo: prod.precio }); }
  
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ piezas: nuevasPiezas });
      document.getElementById('mt-repuesto-select').value = '';
      await logTicketEvent(currentTicketId, 'Repuesto agregado', `${prod.nombre} — ${fmt(prod.precio)}`);
      toast('Artículo añadido al ticket');
  } catch(e) { toast('Error añadiendo pieza'); }
}

export async function removePiezaFromTicket(idx){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const nuevasPiezas = [...t.piezas];
  const removida = nuevasPiezas[idx].nombre;
  nuevasPiezas.splice(idx, 1);
  try {
      await window.db.collection('tickets').doc(currentTicketId).update({ piezas: nuevasPiezas });
      await logTicketEvent(currentTicketId, 'Repuesto eliminado', `Se quitó el ítem: ${removida}`);
  } catch(e) { toast('Error eliminando repuesto'); }
}

export async function enviarAFacturacion(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  
  const total = (t.piezas || []).reduce((acc, p) => acc + (p.costo * p.cant), 0);
  if(total <= 0){ alert('ATENCIÓN: Debes agregar al menos un repuesto o servicio antes de enviarlo a Caja.'); return; }

  const yaExiste = (DATA.caja_pendientes || []).some(p => p.ref === t.id);
  if(yaExiste){ alert('Este ticket ya fue enviado a facturación previamente.'); return; }

  const cobroPendiente = {
    origen: 'Ticket', ref: t.id, clienteId: t.clienteId || null, cliente: t.cliente,
    concepto: t.piezas.map(p => `${p.cant}x ${p.nombre}`).join(', '),
    total: total, articulosCart: t.piezas.map(p => ({ sku: p.sku || null, nombre: p.nombre, cantidad: Number(p.cant) || 0, precio: Number(p.costo) || 0 }))
  };

  try {
      await window.db.collection('caja_pendientes').add(cobroPendiente);
      await logTicketEvent(currentTicketId, 'Enviado a Caja', `Monto a cobrar: ${fmt(total)}`);
      if(window.goView) window.goView('caja'); 
      toast('Enviado a CAJA para su cobro.');
  } catch(error) { toast('Error al enviar a caja'); }
}

// ==========================================
// CREACIÓN Y ELIMINACIÓN DE TICKETS
// ==========================================

async function uploadTicketFotos(files, ticketId) {
    if (!window.firebase.storage) { return []; }
    const urls = [];
    const storageRef = window.firebase.storage().ref();
    const limit = Math.min(files.length, 3);
    for (let i = 0; i < limit; i++) {
        const file = files[i];
        const fileRef = storageRef.child(`tickets/${ticketId}/${Date.now()}_${file.name}`);
        await fileRef.put(file);
        const url = await fileRef.getDownloadURL();
        urls.push(url);
    }
    return urls;
}

export async function createTicket(){
  if (isCreatingTicket) return; 

  const clienteId = document.getElementById('nt-cliente-id').value;
  const clienteInputVal = document.getElementById('nt-cliente-input').value.trim();
  const cliente = clienteId ? DATA.clientes.find(c=>c.id===clienteId) : null;
  const clienteNombre = cliente ? getFullName(cliente) : (clienteInputVal || 'Mostrador');

  const tipoServicio = document.getElementById('nt-tipo-servicio') ? document.getElementById('nt-tipo-servicio').value : 'Taller';
  const equipo = document.getElementById('nt-tipo-equipo') ? document.getElementById('nt-tipo-equipo').value : 'Otro';
  const marca = document.getElementById('nt-marca') ? document.getElementById('nt-marca').value.trim() : '';
  const modelo = document.getElementById('nt-modelo') ? document.getElementById('nt-modelo').value.trim() : '';
  const serie = document.getElementById('nt-serie') ? document.getElementById('nt-serie').value.trim() : '';
  const pin = document.getElementById('nt-pin') ? document.getElementById('nt-pin').value.trim() : '';
  const os = document.getElementById('nt-os') ? document.getElementById('nt-os').value.trim() : '';
  const specs = document.getElementById('nt-specs') ? document.getElementById('nt-specs').value.trim() : '';
  const condicion = document.getElementById('nt-condicion') ? document.getElementById('nt-condicion').value.trim() : '';
  const falla = document.getElementById('nt-falla') ? document.getElementById('nt-falla').value.trim() : '';
  
  const estadoFisico = {
      pantalla: document.getElementById('nt-chk-pantalla') ? document.getElementById('nt-chk-pantalla').checked : false,
      carcasa: document.getElementById('nt-chk-carcasa') ? document.getElementById('nt-chk-carcasa').checked : false,
      teclado: document.getElementById('nt-chk-teclado') ? document.getElementById('nt-chk-teclado').checked : false,
      touchpad: document.getElementById('nt-chk-touchpad') ? document.getElementById('nt-chk-touchpad').checked : false,
      bisagras: document.getElementById('nt-chk-bisagras') ? document.getElementById('nt-chk-bisagras').checked : false,
      puertos: document.getElementById('nt-chk-puertos') ? document.getElementById('nt-chk-puertos').checked : false,
      cargador: document.getElementById('nt-chk-est-cargador') ? document.getElementById('nt-chk-est-cargador').checked : false,
      bateria: document.getElementById('nt-chk-bateria') ? document.getElementById('nt-chk-bateria').checked : false,
  };

  const accesoriosObj = {
      cargador: document.getElementById('nt-acc-cargador') ? document.getElementById('nt-acc-cargador').checked : false,
      mouse: document.getElementById('nt-acc-mouse') ? document.getElementById('nt-acc-mouse').checked : false,
      funda: document.getElementById('nt-acc-funda') ? document.getElementById('nt-acc-funda').checked : false,
      cable: document.getElementById('nt-acc-cable') ? document.getElementById('nt-acc-cable').checked : false,
      otro: (document.getElementById('nt-acc-otro') && document.getElementById('nt-acc-otro').checked) ? document.getElementById('nt-acc-otro-texto').value : ''
  };

  if(!marca || !falla){ toast('Completa la marca y la falla al menos'); return; }
  
  const user = currentUserProfile ? currentUserProfile.nombre : 'Mostrador';
  const fechaIngreso = fDate(new Date().toISOString().split('T')[0]);
  const btn = document.getElementById('btn-crear-ticket');
  const originalText = btn ? btn.innerHTML : 'Crear ticket';

  try {
      isCreatingTicket = true;
      if (btn) { btn.disabled = true; btn.innerHTML = '⏳ Generando...'; }

      let nuevoNumero;
      const contadoresRef = window.db.collection('negocio').doc('contadores');
      
      await window.db.runTransaction(async (transaction) => {
          const doc = await transaction.get(contadoresRef);
          if (!doc.exists) { nuevoNumero = 1000; transaction.set(contadoresRef, { tickets: 1001, ventas: 1000 }); } 
          else { nuevoNumero = doc.data().tickets || 1000; transaction.update(contadoresRef, { tickets: nuevoNumero + 1 }); }
      });

      const id = 'TK-' + nuevoNumero;
      const fotosInput = document.getElementById('nt-fotos');
      let urlsFotos = [];
      if(fotosInput && fotosInput.files.length > 0) {
          if (btn) btn.innerHTML = '📷 Subiendo fotos...';
          urlsFotos = await uploadTicketFotos(fotosInput.files, id);
      }

      const t = {
        id, clienteId: cliente ? cliente.id : null, cliente: clienteNombre,
        tipoServicio, estadoPago: 'Pendiente', estadoFacturacion: 'No facturado',
        equipo, marca, modelo, serie, pin, os, specs,
        estadoFisico, accesoriosObj, condicion, falla, fotos: urlsFotos,
        presupuestoFijado: false, presupuestoEstimado: 0,
        prioridad: document.getElementById('nt-prioridad').value, stage:'pendiente',
        tecnico: document.getElementById('nt-tecnico').value, ingreso: fechaIngreso,
        diagnostico:'Pendiente de revisión inicial.', piezas:[],
        historial:[{
            accion:'Ticket creado', 
            detalle: 'Check-in inicial del equipo en ' + tipoServicio,
            fecha: fechaIngreso + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), 
            autor: user
        }], notas:[]
      };

      await window.db.collection('tickets').doc(id).set(t);

      ['nt-marca','nt-modelo','nt-serie','nt-pin','nt-os','nt-specs','nt-condicion','nt-falla','nt-cliente-input','nt-cliente-id'].forEach(id => {
          if(document.getElementById(id)) document.getElementById(id).value = '';
      });
      ['nt-chk-pantalla','nt-chk-carcasa','nt-chk-teclado','nt-chk-touchpad','nt-chk-bisagras','nt-chk-puertos','nt-chk-est-cargador','nt-chk-bateria','nt-acc-cargador','nt-acc-mouse','nt-acc-funda','nt-acc-cable','nt-acc-otro'].forEach(id => {
          if(document.getElementById(id)) document.getElementById(id).checked = false;
      });
      if(document.getElementById('nt-acc-otro-texto')) {
          document.getElementById('nt-acc-otro-texto').value = '';
          document.getElementById('nt-acc-otro-texto').disabled = true;
      }
      if(document.getElementById('nt-fotos')) document.getElementById('nt-fotos').value = '';
      
      closeModal('modal-nuevo-ticket');
      toast('✓ Ticket #'+id+' creado exitosamente');

  } catch (error) {
      console.error("Error en transacción:", error);
      toast('❌ Error al crear el ticket.');
  } finally {
      isCreatingTicket = false;
      if (btn) { btn.disabled = false; btn.innerHTML = originalText; }
  }
}

export async function eliminarTicketConCodigo() {
    if (!currentTicketId) return;
    const codigo = prompt("🔒 ACCIÓN PROTEGIDA\nPara eliminar este ticket de forma permanente, ingresa el código secreto:");
    if (codigo === null) return; 
    
    if (codigo === "780923") {
        const confirmacion = confirm("⚠️ ¿Estás 100% seguro? Esta acción borrará el ticket para siempre y no se puede deshacer.");
        if (confirmacion) {
            try {
                await window.db.collection('tickets').doc(currentTicketId).delete();
                toast('✅ Ticket eliminado correctamente');
                if (window.goView) window.goView('tickets');
            } catch (error) { toast('❌ Error al eliminar el ticket'); }
        }
    } else { alert("❌ Código incorrecto. Operación cancelada."); }
}