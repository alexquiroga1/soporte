/* =========================================================
   HELPERS Y UTILIDADES
========================================================= */
const fmt = n => '$' + Number(n).toLocaleString('es-MX',{minimumFractionDigits:2, maximumFractionDigits:2});
const fmtK = n => n>=1000 ? '$'+(n/1000).toFixed(1)+'k' : '$'+n;
const stageInfo = key => TICKET_STAGES.find(s=>s.key===key);
const crmStageInfo = key => CRM_STAGES.find(s=>s.key===key);
const initials = name => name.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();

function fDate(ymd) {
  if(!ymd || !ymd.includes('-')) return ymd;
  const [y, m, d] = ymd.split('-');
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${d} ${months[parseInt(m)-1]} ${y}`;
}

function toast(msg, type){
  const wrap = document.getElementById('toast-wrap');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg><span>'+msg+'</span>';
  wrap.appendChild(el);
  setTimeout(()=>{ el.style.opacity='0'; el.style.transition='opacity .3s'; setTimeout(()=>el.remove(),300); }, 2800);
}

/* =========================================================
   SISTEMA DE LOGIN (AUTENTICACIÓN FIREBASE)
========================================================= */
let currentUserProfile = null;

// Escuchamos los cambios en el estado de autenticación
auth.onAuthStateChanged(user => {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.getElementById('app-container');

  if (user) {
    // Usuario logueado: Ocultamos el login y mostramos la app
    loginScreen.style.display = 'none';
    appContainer.style.display = 'flex';
    
    // Tratamos de buscar su nombre en nuestra lista de usuarios de Configuración
    currentUserProfile = DATA.usuarios.find(u => u.email === user.email);
    
    const uName = currentUserProfile ? currentUserProfile.nombre : user.email;
    const uRole = currentUserProfile ? currentUserProfile.rol : 'Admin';
    
    // Actualizar avatares en la UI
    document.getElementById('sidebar-avatar').textContent = initials(uName);
    document.getElementById('sidebar-user-name').textContent = uName;
    document.getElementById('sidebar-user-role').textContent = uRole;
    document.getElementById('btn-user').textContent = initials(uName);
    
    // Renderizamos la app
    if(typeof renderAll === 'function') renderAll();
    toast(`Bienvenido de nuevo, ${uName.split(' ')[0]}`);
  } else {
    // No hay usuario: Mostramos el login y ocultamos la app
    loginScreen.style.display = 'flex';
    appContainer.style.display = 'none';
  }
});

function doLogin() {
  const email = document.getElementById('login-email').value;
  const pass = document.getElementById('login-pass').value;
  
  if(!email || !pass) { toast('Completa tus datos'); return; }
  
  // Usamos el botón para mostrar que está cargando
  const btn = document.querySelector('.login-btn');
  const btnText = btn.textContent;
  btn.textContent = 'Verificando...';
  btn.disabled = true;

  auth.signInWithEmailAndPassword(email, pass)
    .then(() => {
        // El onAuthStateChanged se encargará de mostrar la app
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

function doLogout() {
  auth.signOut().then(() => {
    closeDropdowns();
  }).catch((error) => {
    toast('No se pudo cerrar la sesión');
  });
}

/* =========================================================
   LÓGICA DEL MENÚ MÓVIL (HAMBURGUESA)
========================================================= */
document.addEventListener('DOMContentLoaded', () => {
  const menuBtn = document.getElementById('mobile-menu-btn');
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');

  if(menuBtn && sidebar && backdrop) {
    menuBtn.addEventListener('click', () => {
      sidebar.classList.add('open');
      backdrop.classList.add('show');
    });
    
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
    });
  }
});

/* Modal y Dropdowns */
function openModal(id){ document.getElementById(id).classList.add('active'); }
function closeModal(id){ document.getElementById(id).classList.remove('active'); }
document.querySelectorAll('.modal-overlay').forEach(ov=>{
  ov.addEventListener('click', e=>{ if(e.target===ov) ov.classList.remove('active'); });
});

function closeDropdowns(){ document.getElementById('dd-notif').classList.remove('open'); document.getElementById('dd-user').classList.remove('open'); }
document.getElementById('btn-notif').addEventListener('click', e=>{ e.stopPropagation(); const dd=document.getElementById('dd-notif'); const wasOpen=dd.classList.contains('open'); closeDropdowns(); if(!wasOpen) dd.classList.add('open'); });
document.getElementById('btn-user').addEventListener('click', e=>{ e.stopPropagation(); const dd=document.getElementById('dd-user'); const wasOpen=dd.classList.contains('open'); closeDropdowns(); if(!wasOpen) dd.classList.add('open'); });
document.addEventListener('click', closeDropdowns);

/* Navegación Principal */
function goView(name){
  document.querySelectorAll('.nav-item').forEach(i=>i.classList.toggle('active', i.getAttribute('data-view')===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active', v.id==='view-'+name));
  closeDropdowns();
  
  const sidebar = document.querySelector('.sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  if(window.innerWidth <= 768 && sidebar && backdrop) {
      sidebar.classList.remove('open');
      backdrop.classList.remove('show');
  }
}
document.querySelectorAll('.nav-item').forEach(it=>{ it.addEventListener('click', ()=>goView(it.getAttribute('data-view'))); });

/* Sub-tabs genérico */
document.querySelectorAll('.tab').forEach(tab=>{
  tab.addEventListener('click', ()=>{
    if(tab.getAttribute('onclick')) return;
    
    const group = tab.parentElement;
    group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    tab.classList.add('active');
    const targetId = tab.getAttribute('data-sub');
    const target = document.getElementById(targetId);
    if(!target) return;
    const siblingsContainer = target.parentElement;
    siblingsContainer.querySelectorAll('.subview').forEach(sv=>{ sv.style.display = sv.id===targetId ? '' : 'none'; });
  });
});

/* =========================================================
   GRÁFICOS (SVG BAR CHART & DONUT)
========================================================= */
function svgBarChart(data, opts){
  opts = opts || {};
  const w = opts.width || 480, h = opts.height || 170, pad = 26, gap = opts.gap || 16;
  const max = Math.max(...data.map(d=>d.v)) * 1.2 || 1;
  const bw = (w - pad*1.4) / data.length - gap;
  let bars = '', labels = '';
  data.forEach((d,i)=>{
    const bh = max ? (d.v/max) * (h-38) : 0;
    const x = pad + i*(bw+gap);
    const y = h - 28 - bh;
    const color = opts.color || 'var(--copper)';
    bars += '<rect x="'+x+'" y="'+y+'" width="'+bw+'" height="'+bh+'" rx="5" fill="'+color+'" opacity="'+(i===data.length-1?1:0.55)+'"></rect>';
    bars += '<text x="'+(x+bw/2)+'" y="'+(y-7)+'" text-anchor="middle" class="chart-val">'+(opts.fmt?opts.fmt(d.v):d.v)+'</text>';
    labels += '<text x="'+(x+bw/2)+'" y="'+(h-8)+'" text-anchor="middle" class="chart-lbl">'+d.l+'</text>';
  });
  return '<svg viewBox="0 0 '+w+' '+h+'" class="bar-svg"><line x1="'+(pad-6)+'" y1="'+(h-28)+'" x2="'+(w-4)+'" y2="'+(h-28)+'" stroke="var(--line)" stroke-width="1"></line>'+bars+labels+'</svg>';
}

function renderDonut(containerEl, segments){
  const total = segments.reduce((s,x)=>s+x.value,0) || 1;
  let acc = 0;
  const stops = segments.map(s=>{
    const start = acc/total*360; acc += s.value; const end = acc/total*360;
    return s.color+' '+start.toFixed(1)+'deg '+end.toFixed(1)+'deg';
  }).join(', ');
  containerEl.querySelector('.donut-ring').style.background = 'conic-gradient('+stops+')';
  containerEl.querySelector('.donut-center b').textContent = total;
  containerEl.querySelector('.donut-legend').innerHTML = segments.map(s=>
    '<div class="dl-item"><span class="dl-dot" style="background:'+s.color+'"></span>'+s.label+'<b>'+s.value+'</b></div>'
  ).join('');
}

function renderHBars(container, data, opts){
  opts = opts || {};
  const max = Math.max(...data.map(d=>d.v)) || 1;
  container.innerHTML = data.map(d=>
    '<div class="hbar-row"><div class="hbar-lbl">'+d.l+'</div><div class="hbar-track"><div class="hbar-fill" style="width:'+(d.v/max*100).toFixed(0)+'%"></div></div><div class="hbar-val">'+d.v+'</div></div>'
  ).join('');
}

/* =========================================================
   DASHBOARD
========================================================= */
function renderDashboard(){
  const abiertos = DATA.tickets.filter(t=>t.stage!=='entregado').length;
  const ventasHoy = DATA.ventas.reduce((s,v)=>s+v.total,0);
  const creditoTotal = DATA.creditos.reduce((s,c)=>s+c.saldo,0);
  const slaRiesgo = DATA.tickets.filter(t=>t.prioridad==='P1' && t.stage!=='entregado').length;
  
  // Actualizar Título del negocio dinámico
  document.getElementById('dash-title-negocio').textContent = DATA.negocio.nombre || 'Panel general';

  document.getElementById('dash-kpis').innerHTML = `
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Tickets abiertos</div><div class="value">${abiertos}</div><div class="delta up">↑ activos hoy</div></div>
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2.5 3h2l2.6 12.4a2 2 0 002 1.6h8.4a2 2 0 002-1.6L21 8H6"/></svg></div><div class="label">Ventas del día</div><div class="value">${fmt(ventasHoy)}</div><div class="delta up">↑ 12.4%</div></div>
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg></div><div class="label">Créditos activos</div><div class="value">${fmt(creditoTotal)}</div><div class="delta down">↓ 2.1%</div></div>
    <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">SLA en riesgo</div><div class="value">${slaRiesgo}</div><div class="delta down">Requiere atención</div></div>`;

  document.getElementById('dash-week-total').textContent = fmt(ventasSemana.reduce((s,d)=>s+d.v,0)) + ' esta semana';
  document.getElementById('dash-bar-chart').innerHTML = svgBarChart(ventasSemana.map(d=>({l:d.l,v:d.v})), {fmt:fmtK, height:150});

  const porEstado = TICKET_STAGES.map(s=>({label:s.label, value:DATA.tickets.filter(t=>t.stage===s.key).length, color:s.color})).filter(s=>s.value>0);
  renderDonut(document.getElementById('dash-donut'), porEstado);

  document.getElementById('dash-tickets-body').innerHTML = DATA.tickets.slice(0,5).map(t=>{
    const st = stageInfo(t.stage);
    return `<tr class="tbl-row" onclick="openTicketModal('${t.id}')"><td><div class="prio ${t.prioridad.toLowerCase()}">${t.prioridad}</div></td><td class="mono">#${t.id}</td><td><div class="cust"><div class="ci">${initials(t.cliente)}</div><div><b>${t.cliente}</b><span>${t.ingreso}</span></div></div></td><td>${t.equipo}</td><td><span class="badge ${st.badge}">${st.label}</span></td><td>${t.tecnico}</td></tr>`;
  }).join('');

  const ingresos = DATA.caja.movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const egresos = DATA.caja.movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  const totalCaja = DATA.caja.fondo + ingresos - egresos;
  document.getElementById('dash-caja').innerHTML = `
    <div class="caja-line"><span class="l">Fondo inicial</span><span class="v">${fmt(DATA.caja.fondo)}</span></div>
    <div class="caja-line"><span class="l">Ingresos</span><span class="v">${fmt(ingresos)}</span></div>
    <div class="caja-line"><span class="l">Egresos</span><span class="v">-${fmt(egresos)}</span></div>
    <div class="caja-total"><span class="l">Total en caja</span><span class="v">${fmt(totalCaja)}</span></div>`;
}

/* =========================================================
   TICKETS
========================================================= */
function onClientSearchInput(){
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
        No encontrado. <a href="#" onclick="openModal('modal-nuevo-cliente'); document.getElementById('nt-client-suggestions').style.display='none';" style="color:var(--copper); font-weight:600;">¿Crear nuevo cliente?</a>
      </div>
    `;
  }
}

function selectClientForTicket(id, nombre){
  document.getElementById('nt-cliente-id').value = id;
  document.getElementById('nt-cliente-input').value = nombre;
  document.getElementById('nt-client-suggestions').style.display = 'none';
}

function populateTecnicos() {
    const selFilter = document.getElementById('tk-filter-tecnico');
    const selNew = document.getElementById('nt-tecnico');
    
    // Obtenemos los usuarios que tienen un rol diferente a 'Ventas / Caja' para ser considerados técnicos
    const tecnicos = DATA.usuarios.filter(u => u.activo);
    
    if(selFilter) {
        selFilter.innerHTML = '<option value="">Todos los técnicos</option><option value="Sin asignar">Sin asignar</option>' +
        tecnicos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
    }
    
    if(selNew) {
        selNew.innerHTML = '<option value="Sin asignar">Sin asignar</option>' +
        tecnicos.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
    }
}

function renderTicketsTable(){
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

function printTicket(id){
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
        <p><b>Cliente:</b> ${t.cliente}</p>
        <p><b>Equipo:</b> ${t.equipo}</p>
        <p><b>Accesorios recibidos:</b> ${t.accesorios || 'Ninguno'}</p>
        <p><b>Condición física:</b> ${t.condicion || 'Sin registrar'}</p>
        <p><b>Falla reportada:</b> ${t.falla}</p>
        <p><b>Diagnóstico técnico:</b> ${t.diagnostico || 'Pendiente'}</p>
      </div>

      <h3>Repuestos / Servicios aplicados</h3>
      <table>
        <thead><tr><th>Artículo</th><th>Cant.</th><th>Subtotal</th></tr></thead>
        <tbody>
          ${(t.piezas || []).length ? (t.piezas || []).map(p => `<tr><td>${p.nombre}</td><td>${p.cant}</td><td>$${(p.costo * p.cant).toFixed(2)}</td></tr>`).join('') : '<tr><td colspan="3" style="text-align:center; color:#8891A3;">Sin repuestos registrados</td></tr>'}
        </tbody>
      </table>

      <div class="total-section">Total estimado: $${total.toFixed(2)}</div>

      <div class="footer-note">
        Presentar este ticket o comprobante al momento de retirar su equipo. No nos hacemos responsables por equipos con más de 90 días sin recoger. Firma de conformidad: ___________________________
      </div>

      <script>
        window.onload = function() { window.print(); }
      </script>
    </body>
    </html>
  `);
  win.document.close();
}

function renderTicketsKanban(){
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
      renderTicketsKanban(); renderTicketsTable(); renderDashboard();
      checkBillingButtonVisibility(t);
      toast('Ticket #'+id+' movido a "'+stageInfo(newStage).label+'"');
    }
  });
}

function wireKanbanDrag(board, onDrop){
  board.querySelectorAll('.kanban-card').forEach(card=>{
    card.addEventListener('dragstart', e=>{ card.classList.add('dragging'); e.dataTransfer.setData('text/plain', card.getAttribute('data-id')); });
    card.addEventListener('dragend', ()=> card.classList.remove('dragging'));
  });
  board.querySelectorAll('.kanban-col').forEach(col=>{
    col.addEventListener('dragover', e=>{ e.preventDefault(); col.classList.add('drag-over'); });
    col.addEventListener('dragleave', ()=> col.classList.remove('drag-over'));
    col.addEventListener('drop', e=>{
      e.preventDefault(); col.classList.remove('drag-over');
      const id = e.dataTransfer.getData('text/plain');
      onDrop(id, col.getAttribute('data-stage'));
    });
  });
}

function openTicketModal(id){
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

function togglePresupuesto(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  t.presupuestoAprobado = document.getElementById('mt-presupuesto-chk').checked;
  saveToLocal();
  renderTicketsTable();
  toast(t.presupuestoAprobado ? 'Presupuesto marcado como aprobado' : 'Presupuesto pendiente');
}

function updateChecklist(){
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

function sendWhatsAppNotice(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  toast(`Simulación: Mensaje de WhatsApp enviado a #${t.id} sobre estado "${stageInfo(t.stage).label}"`);
}

function checkBillingButtonVisibility(t){
  const btn = document.getElementById('btn-facturar-ticket');
  if(t.stage === 'listo'){
    btn.style.display = 'inline-flex';
  } else {
    btn.style.display = 'none';
  }
}

function saveDiagnostico(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  const texto = document.getElementById('mt-diagnostico-input').value.trim();
  t.diagnostico = texto;
  saveToLocal();
  toast('Diagnóstico guardado con éxito');
}

function populateRepuestosSelect(){
  const sel = document.getElementById('mt-repuesto-select');
  sel.innerHTML = DATA.productos.map(p => `<option value="${p.sku}">${p.nombre} (${fmt(p.precio)})</option>`).join('');
}

function renderTicketPiezas(t){
  if(!t.piezas) t.piezas = [];
  document.getElementById('mt-piezas').innerHTML = t.piezas.length ? t.piezas.map((p, idx)=>`
    <tr><td>${p.nombre}</td><td class="mono">${p.cant}</td><td class="mono">${fmt(p.costo * p.cant)}</td><td><button class="btn btn-ghost btn-sm" onclick="removePiezaFromTicket(${idx})" style="color:var(--red); padding:2px 6px;">✕</button></td></tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--muted);">Sin repuestos o servicios añadidos.</td></tr>';

  const total = t.piezas.reduce((acc, p) => acc + (p.costo * p.cant), 0);
  document.getElementById('mt-total-costo').textContent = fmt(total);
}

function addPiezaToTicket(){
  const sku = document.getElementById('mt-repuesto-select').value;
  const prod = DATA.productos.find(p => p.sku === sku);
  if(!prod) return;

  const t = DATA.tickets.find(x => x.id === currentTicketId);
  const existing = t.piezas.find(p => p.nombre === prod.nombre);
  if(existing){
    existing.cant++;
  } else {
    t.piezas.push({ nombre: prod.nombre, cant: 1, costo: prod.precio });
  }
  saveToLocal();
  renderTicketPiezas(t);
  toast('Artículo añadido al ticket');
}

function removePiezaFromTicket(idx){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  t.piezas.splice(idx, 1);
  saveToLocal();
  renderTicketPiezas(t);
  toast('Artículo removido');
}

function enviarAFacturacion(){
  const t = DATA.tickets.find(x => x.id === currentTicketId);
  if(!t) return;
  const total = t.piezas.reduce((acc, p) => acc + (p.costo * p.cant), 0);
  if(total <= 0){
    toast('Agrega al menos un repuesto o servicio antes de facturar');
    return;
  }

  const yaExiste = DATA.cajaPendientes.some(p => p.ref === t.id);
  if(yaExiste){
    toast('Este ticket ya fue enviado a facturación');
    return;
  }

  DATA.cajaPendientes.push({
    origen: 'Ticket',
    ref: t.id,
    clienteId: t.clienteId,
    cliente: t.cliente,
    concepto: t.piezas.map(p => `${p.cant}x ${p.nombre}`).join(', '),
    total: total
  });

  saveToLocal();
  closeModal('modal-ticket');
  renderCajaView();
  toast('Ticket #' + t.id + ' enviado a Caja como pendiente de cobro');
}

function renderTicketNotas(t){
  document.getElementById('mt-notas').innerHTML = t.notas.length ? t.notas.map(n=>`<div class="note-item"><b>${n.autor}</b><span class="t">${n.fecha}</span><div>${n.texto}</div></div>`).join('') : '<div style="color:var(--muted);font-size:12.5px;">Sin notas todavía.</div>';
}
function addTicketNota(){
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
function changeTicketStage(){
  const newStage = document.getElementById('mt-estado-select').value;
  const t = DATA.tickets.find(x=>x.id===currentTicketId);
  if(t.stage===newStage) return;
  t.stage = newStage;
  const user = currentUserProfile ? currentUserProfile.nombre : 'Usuario';
  t.historial.push({estado: stageInfo(newStage).label, fecha:fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), autor:user});
  saveToLocal();
  document.getElementById('mt-historial').innerHTML = t.historial.map(h=>`<div class="tl-item"><b>${h.estado}</b><span>${h.fecha} · ${h.autor}</span></div>`).join('');
  renderTicketsTable(); renderTicketsKanban(); renderDashboard();
  checkBillingButtonVisibility(t);
  toast('Estado actualizado a "'+stageInfo(newStage).label+'"');
}

function createTicket(){
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
  renderTicketsTable(); renderTicketsKanban(); renderDashboard();
  toast('Ticket #'+id+' creado');
}

/* =========================================================
   VENTAS / POS (CON PROMOCIONES)
========================================================= */
const PAY_OPTIONS = ['Efectivo','Tarjeta','Transferencia','Préstamo personal'];
function renderPayMethods(){
  document.getElementById('pay-methods').innerHTML = PAY_OPTIONS.map(m=>`<div class="pay-btn ${m===payMethod?'active':''}" onclick="setPayMethod('${m}')">${m}</div>`).join('');
}
function setPayMethod(m){ payMethod = m; renderPayMethods(); }

function populatePOSPromos() {
  const sel = document.getElementById('pos-promo');
  if(!sel) return;
  const today = new Date().toISOString().split('T')[0];
  const activas = DATA.promociones.filter(p => p.activa && p.vence >= today);
  
  sel.innerHTML = '<option value="">Sin promoción / descuento</option>' + 
     activas.map(p => {
         const dStr = p.tipo === 'Porcentaje (%)' ? `${p.valor}%` : fmt(p.valor);
         return `<option value="${p.id}">${p.nombre} (-${dStr})</option>`;
     }).join('');
}

function renderPOSProducts(){
  const q = (document.getElementById('pos-search').value || '').toLowerCase();
  const items = DATA.productos.filter(p=> !q || p.nombre.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q));
  document.getElementById('pos-products').innerHTML = items.map(p=>{
    const soldOut = p.categoria!=='Servicios' && p.stock<=0;
    const clickAttr = soldOut ? '' : `onclick="addToCart('${p.sku}')"`;
    const addBtn = soldOut
      ? '<span class="mono" style="color:var(--red);font-size:10px;">AGOTADO</span>'
      : `<button class="pp-add" onclick="event.stopPropagation();addToCart('${p.sku}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg></button>`;
    return `<div class="pos-product ${soldOut?'disabled':''}" ${clickAttr}>
      <div class="sku">${p.sku}</div><h5>${p.nombre}</h5>
      <div class="pp-foot"><span class="price">${fmt(p.precio)}</span>${addBtn}</div>
    </div>`;
  }).join('') || '<div style="color:var(--muted);padding:20px;">Sin resultados.</div>';
}

function addToCart(sku){
  const p = DATA.productos.find(x=>x.sku===sku);
  if(!p) return;
  const existing = cart.find(c=>c.sku===sku);
  if(existing){
    if(p.categoria!=='Servicios' && existing.cantidad>=p.stock){ toast('Sin más stock disponible'); return; }
    existing.cantidad++;
  } else {
    cart.push({sku:p.sku, nombre:p.nombre, precio:p.precio, cantidad:1});
  }
  renderCart();
}
function changeQty(sku, delta){
  const item = cart.find(c=>c.sku===sku);
  if(!item) return;
  const p = DATA.productos.find(x=>x.sku===sku);
  item.cantidad += delta;
  if(item.cantidad<=0){ cart = cart.filter(c=>c.sku!==sku); }
  else if(p.categoria!=='Servicios' && item.cantidad>p.stock){ item.cantidad = p.stock; toast('Sin más stock disponible'); }
  renderCart();
}
function removeFromCart(sku){ cart = cart.filter(c=>c.sku!==sku); renderCart(); }

function renderCart(){
  const wrap = document.getElementById('cart-items');
  document.getElementById('cart-count').textContent = cart.reduce((s,c)=>s+c.cantidad,0) + ' items';
  wrap.innerHTML = cart.length ? cart.map(c=>`
    <div class="cart-item">
      <div class="ci-name"><b>${c.nombre}</b><span>${fmt(c.precio)} c/u</span></div>
      <div class="qty-ctrl"><button class="qty-btn" onclick="changeQty('${c.sku}',-1)">−</button><span>${c.cantidad}</span><button class="qty-btn" onclick="changeQty('${c.sku}',1)">+</button></div>
      <button class="ci-remove" onclick="removeFromCart('${c.sku}')"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0l-1 14a2 2 0 01-2 2H7a2 2 0 01-2-2L4 6"/></svg></button>
    </div>`).join('') : '<div class="cart-empty">El carrito está vacío.<br>Agrega productos desde la izquierda.</div>';
  
  const subtotal = cart.reduce((s,c)=>s+c.precio*c.cantidad,0);
  let descuentoTotal = 0;
  
  const promoId = document.getElementById('pos-promo').value;
  if(promoId && cart.length > 0) {
      const promo = DATA.promociones.find(p => p.id === promoId);
      if(promo) {
          cart.forEach(c => {
              const p = DATA.productos.find(x => x.sku === c.sku);
              if(promo.aplicaA === 'Todos' || (p && p.categoria === promo.aplicaA)) {
                  if(promo.tipo === 'Porcentaje (%)') {
                      descuentoTotal += (c.precio * c.cantidad) * (promo.valor / 100);
                  }
              }
          });

          if(promo.tipo === 'Monto Fijo ($)') {
              const hasApplicable = promo.aplicaA === 'Todos' || cart.some(c => {
                  const p = DATA.productos.find(x => x.sku === c.sku);
                  return p && p.categoria === promo.aplicaA;
              });
              if(hasApplicable) {
                  descuentoTotal += promo.valor;
              }
          }
      }
  }

  if(descuentoTotal > subtotal) descuentoTotal = subtotal;

  const base = subtotal - descuentoTotal;
  const iva = base * 0.16;
  const total = base + iva;

  document.getElementById('ct-subtotal').textContent = fmt(subtotal);
  
  const descLine = document.getElementById('ct-desc-line');
  if(descuentoTotal > 0) {
      descLine.style.display = 'flex';
      document.getElementById('ct-descuento').textContent = '-' + fmt(descuentoTotal);
  } else {
      descLine.style.display = 'none';
  }

  document.getElementById('ct-iva').textContent = fmt(iva);
  document.getElementById('ct-total').textContent = fmt(total);
}

let nextVenta = 1043;
function checkout(){
  if(!cart.length){ toast('Agrega productos al carrito'); return; }
  
  const subtotal = cart.reduce((s,c)=>s+c.precio*c.cantidad,0);
  let descuentoTotal = 0;
  let descuentoTexto = '';
  
  const promoId = document.getElementById('pos-promo').value;
  if(promoId) {
      const promo = DATA.promociones.find(p => p.id === promoId);
      if(promo) {
          cart.forEach(c => {
              const p = DATA.productos.find(x => x.sku === c.sku);
              if(promo.aplicaA === 'Todos' || (p && p.categoria === promo.aplicaA)) {
                  if(promo.tipo === 'Porcentaje (%)') descuentoTotal += (c.precio * c.cantidad) * (promo.valor / 100);
              }
          });
          if(promo.tipo === 'Monto Fijo ($)') {
              const hasApplicable = promo.aplicaA === 'Todos' || cart.some(c => {
                  const p = DATA.productos.find(x => x.sku === c.sku);
                  return p && p.categoria === promo.aplicaA;
              });
              if(hasApplicable) descuentoTotal += promo.valor;
          }
          if(descuentoTotal > 0) descuentoTexto = ` (Promo aplicada: ${promo.nombre})`;
      }
  }
  
  if(descuentoTotal > subtotal) descuentoTotal = subtotal;
  const base = subtotal - descuentoTotal;
  const total = base * 1.16; 

  const clienteSel = document.getElementById('pos-cliente');
  const clienteNombre = clienteSel.options[clienteSel.selectedIndex].text.replace('Cliente: ','');
  
  const clienteObj = DATA.clientes.find(c => getFullName(c) === clienteNombre || c.nombre === clienteNombre);
  const folio = 'V-' + (nextVenta++);

  DATA.cajaPendientes.push({
    origen: 'Venta',
    ref: folio,
    clienteId: clienteObj ? clienteObj.id : null,
    cliente: clienteNombre,
    concepto: cart.map(c => `${c.cantidad}x ${c.nombre}`).join(', ') + descuentoTexto,
    total: total,
    articulosCart: [...cart]
  });

  saveToLocal();
  cart = [];
  document.getElementById('pos-promo').value = ''; 
  renderCart();
  renderCajaView();
  toast('Venta ' + folio + ' enviada a Caja para su cobro');
}

function renderVentasHistorial(){
  document.getElementById('ventas-historial-body').innerHTML = DATA.ventas.map(v=>{
    const badgeClass = v.pago==='Efectivo'?'done':v.pago==='Tarjeta'?'prog':v.pago==='Préstamo personal'?'wait':'pend';
    return `<tr class="tbl-row"><td class="mono">${v.folio}</td><td>${v.cliente}</td><td>${v.articulos}</td><td><span class="badge ${badgeClass}">${v.pago}</span></td><td class="mono">${fmt(v.total)}</td><td class="mono">${v.hora}</td></tr>`;
  }).join('');
  document.getElementById('ventas-meta').textContent = DATA.ventas.length + ' TRANSACCIONES HOY';
}

/* =========================================================
   CAJA & PASARELA DE COBRO REAL
========================================================= */
let selectedCobroMetodo = 'Efectivo';

function renderCajaPendientes(){
  const container = document.getElementById('caja-pendientes-body');
  if(!container) return;
  container.innerHTML = DATA.cajaPendientes.length ? DATA.cajaPendientes.map((p, idx)=>`
    <tr>
      <td><span class="badge ${p.origen==='Ticket'?'prog':'done'}">${p.origen}</span></td>
      <td class="mono">#${p.ref}</td>
      <td><b>${p.cliente}</b></td>
      <td>${p.concepto}</td>
      <td class="mono">${fmt(p.total)}</td>
      <td><button class="btn btn-primary btn-sm" onclick="abrirModalCobro(${idx})">Cobrar</button></td>
    </tr>
  `).join('') : '<tr><td colspan="6" style="text-align:center; color:var(--muted); padding:16px;">No hay facturaciones pendientes de cobro.</td></tr>';
}

function abrirModalCobro(idx){
  currentCobroIdx = idx;
  const item = DATA.cajaPendientes[idx];
  
  let clienteTel = '—';
  if(item.clienteId){
    const cli = DATA.clientes.find(c => c.id === item.clienteId);
    if(cli) clienteTel = cli.tel;
  } else {
    const cli = DATA.clientes.find(c => getFullName(c) === item.cliente || c.nombre === item.cliente);
    if(cli) clienteTel = cli.tel;
  }

  document.getElementById('mcc-referencia').textContent = (item.origen === 'Ticket' ? 'Ticket #' : 'Venta ') + item.ref;
  document.getElementById('mcc-cliente').textContent = item.cliente;
  document.getElementById('mcc-tel').textContent = clienteTel;
  document.getElementById('mcc-concepto').textContent = item.concepto;
  document.getElementById('mcc-total').textContent = fmt(item.total);

  selectedCobroMetodo = 'Efectivo';
  document.querySelectorAll('#mcc-metodos-pago .pay-btn').forEach(btn=>{
    btn.classList.toggle('active', btn.textContent === 'Efectivo');
  });

  renderCobroDynamicFields();
  openModal('modal-cobro-caja');
}

function setCobroMetodo(el, metodo){
  document.querySelectorAll('#mcc-metodos-pago .pay-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  selectedCobroMetodo = metodo;
  renderCobroDynamicFields();
}

function renderCobroDynamicFields(){
  const container = document.getElementById('mcc-dynamic-fields');
  const item = DATA.cajaPendientes[currentCobroIdx];
  if(!item) return;

  const btnConfirm = document.getElementById('btn-confirmar-cobro');
  btnConfirm.disabled = false;

  if(selectedCobroMetodo === 'Efectivo'){
    container.innerHTML = `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div>
          <label>Dinero recibido ($)</label>
          <input type="number" id="mcc-dinero-recibido" class="inp" placeholder="0.00" oninput="calcularCambio(${item.total})" style="width:100%;">
        </div>
        <div style="font-size:14px; font-weight:600; margin-top:4px;">
          Cambio / Vuelto: <span id="mcc-cambio-txt" style="font-family:'IBM Plex Mono',monospace; color:var(--teal);">$0.00</span>
        </div>
      </div>
    `;
  } else if(selectedCobroMetodo === 'Tarjeta'){
    container.innerHTML = `
      <div class="form-grid">
        <div>
          <label>Número de Tarjeta (Últimos 4 dígitos)</label>
          <input type="text" id="mcc-tarjeta-num" class="inp" placeholder="Ej. 4242" maxlength="4">
        </div>
        <div>
          <label>Nº de Autorización / Voucher</label>
          <input type="text" id="mcc-tarjeta-auth" class="inp" placeholder="Ej. AUTH-9921">
        </div>
      </div>
    `;
  } else if(selectedCobroMetodo === 'Transferencia'){
    container.innerHTML = `
      <div class="form-grid" style="grid-template-columns:1fr;">
        <div>
          <label>Número de Comprobante / Referencia Bancaria</label>
          <input type="text" id="mcc-trans-ref" class="inp" placeholder="Ej. REF-88392011">
        </div>
      </div>
    `;
  } else if(selectedCobroMetodo === 'Préstamo personal'){
    let clienteObj = null;
    if(item.clienteId){
      clienteObj = DATA.clientes.find(c => c.id === item.clienteId);
    } else {
      clienteObj = DATA.clientes.find(c => getFullName(c) === item.cliente || c.nombre === item.cliente);
    }

    const cNombre = clienteObj ? getFullName(clienteObj) : item.cliente;
    const activeLoans = DATA.creditos.filter(cr => cr.cliente === cNombre && cr.saldo > 0);
    
    const numLoans = activeLoans.length;
    const currentDebt = activeLoans.reduce((s, cr) => s + cr.saldo, 0);
    const limite = clienteObj ? (clienteObj.limiteCredito || 0) : 0;
    const available = limite - currentDebt;

    const today = new Date();
    const overdue30 = activeLoans.some(cr => {
      if(!cr.vence || cr.vence === 'A convenir') return false;
      const vDate = new Date(cr.vence);
      if(vDate >= today) return false;
      const diffDays = (today - vDate) / (1000 * 60 * 60 * 24);
      return diffDays > 30;
    });

    const cond1 = available >= item.total;
    const cond2 = numLoans < 2;
    const cond3 = !overdue30;
    const esEligible = cond1 && cond2 && cond3;

    if(!esEligible) btnConfirm.disabled = true;

    container.innerHTML = `
      <div style="font-size:13px; line-height:1.4;">
        <p><b>Evaluación de Elegibilidad:</b></p>
        <ul style="list-style:none; padding:0; margin:8px 0;">
          <li style="color:${cond1?'var(--teal)':'var(--red)'}">
            ${cond1?'✅':'❌'} Crédito disp: <b>${fmt(available)}</b> (Límite: ${fmt(limite)})
          </li>
          <li style="color:${cond2?'var(--teal)':'var(--red)'}">
            ${cond2?'✅':'❌'} Préstamos activos: <b>${numLoans}</b> / 2 máximo
          </li>
          <li style="color:${cond3?'var(--teal)':'var(--red)'}">
            ${cond3?'✅':'❌'} Historial de pagos (Sin atrasos > 30 días)
          </li>
        </ul>
        <p style="margin-top:6px;">Estado: <span class="badge ${esEligible ? 'done' : 'urg'}">${esEligible ? 'Elegible para Préstamo' : 'Crédito Rechazado'}</span></p>
      </div>
    `;
  }
}

function calcularCambio(total){
  const recibido = parseFloat(document.getElementById('mcc-dinero-recibido').value) || 0;
  const cambio = recibido - total;
  document.getElementById('mcc-cambio-txt').textContent = cambio >= 0 ? fmt(cambio) : 'Insuficiente';
}

function procesarCobroFinal(){
  if(currentCobroIdx === null || currentCobroIdx === undefined) return;
  const item = DATA.cajaPendientes[currentCobroIdx];

  if(selectedCobroMetodo === 'Préstamo personal'){
    let clienteObj = item.clienteId ? DATA.clientes.find(c => c.id === item.clienteId) : DATA.clientes.find(c => getFullName(c) === item.cliente || c.nombre === item.cliente);
    
    DATA.creditos.unshift({
      cliente: clienteObj ? getFullName(clienteObj) : item.cliente,
      concepto: 'Préstamo por ' + (item.origen === 'Ticket' ? 'Ticket #'+item.ref : 'Venta '+item.ref),
      original: item.total,
      saldo: item.total,
      vence: addDays(30), 
      abonos: []
    });
  }

  if(item.articulosCart){
    item.articulosCart.forEach(c=>{
      const p = DATA.productos.find(x=>x.sku===c.sku);
      if(p && p.categoria!=='Servicios') p.stock = Math.max(0, p.stock - c.cantidad);
    });
  }

  if(selectedCobroMetodo !== 'Préstamo personal') {
    DATA.caja.movs.push({
      hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}),
      concepto: `Cobro ${item.origen} #${item.ref} (${item.cliente})`,
      tipo: 'ingreso',
      monto: item.total
    });
  }

  DATA.ventas.unshift({
    folio: item.origen === 'Ticket' ? 'FAC-' + item.ref : item.ref,
    cliente: item.cliente,
    articulos: item.concepto,
    pago: selectedCobroMetodo,
    total: item.total,
    hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})
  });

  DATA.cajaPendientes.splice(currentCobroIdx, 1);
  currentCobroIdx = null;

  saveToLocal();
  closeModal('modal-cobro-caja');
  renderCajaView();
  renderDashboard();
  renderVentasHistorial();
  renderProductosTable();
  renderCreditosTable();
  toast('Cobro procesado con éxito vía ' + selectedCobroMetodo);
}

function renderCajaView(){
  renderCajaPendientes();
  document.getElementById('caja-mov-body').innerHTML = DATA.caja.movs.slice().reverse().map(m=>{
    const badge = m.tipo==='ingreso'?'done':m.tipo==='egreso'?'urg':'prog';
    const sign = m.tipo==='egreso'?'-':m.tipo==='ingreso'?'+':'';
    return `<tr class="tbl-row"><td class="mono">${m.hora}</td><td>${m.concepto}</td><td><span class="badge ${badge}">${m.tipo.charAt(0).toUpperCase()+m.tipo.slice(1)}</span></td><td class="mono">${sign}${fmt(m.monto)}</td></tr>`;
  }).join('');
  const ingresos = DATA.caja.movs.filter(m=>m.tipo==='ingreso').reduce((s,m)=>s+m.monto,0);
  const egresos = DATA.caja.movs.filter(m=>m.tipo==='egreso').reduce((s,m)=>s+m.monto,0);
  const total = DATA.caja.fondo + ingresos - egresos;
  document.getElementById('caja-resumen').innerHTML = `
    <div class="caja-line"><span class="l">Fondo inicial</span><span class="v">${fmt(DATA.caja.fondo)}</span></div>
    <div class="caja-line"><span class="l">Ingresos</span><span class="v">${fmt(ingresos)}</span></div>
    <div class="caja-line"><span class="l">Egresos</span><span class="v">-${fmt(egresos)}</span></div>
    <div class="caja-total"><span class="l">Efectivo esperado</span><span class="v">${fmt(total)}</span></div>`;
}

function addMovimiento(){
  const concepto = document.getElementById('mov-concepto').value.trim();
  const tipo = document.getElementById('mov-tipo').value;
  const monto = parseFloat(document.getElementById('mov-monto').value);
  if(!concepto || !monto || monto<=0){ toast('Completa el concepto y un monto válido'); return; }
  DATA.caja.movs.push({hora:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto, tipo, monto});
  saveToLocal();
  document.getElementById('mov-concepto').value=''; document.getElementById('mov-monto').value='';
  renderCajaView(); renderDashboard();
  toast('Movimiento registrado');
}
function cerrarCorte(){
  saveToLocal();
  closeModal('modal-cierre');
  toast('Corte cerrado correctamente');
}

/* =========================================================
   CRM — kanban
========================================================= */
function renderCRMKanban(){
  const board = document.getElementById('crm-kanban');
  board.innerHTML = CRM_STAGES.map(s=>{
    const items = DATA.crm.filter(o=>o.stage===s.key);
    const cards = items.map((o,idx)=>`
      <div class="kanban-card" draggable="true" data-id="${o.contacto}|${o.empresa}">
        <b>${o.contacto}</b><div class="kc-sub">${o.empresa}</div>
        <div class="kc-sub" style="margin-top:4px;">${o.interes}</div>
        <div class="kc-foot"><span class="kc-val">${fmt(o.valor)}</span><span>${o.fecha}</span></div>
      </div>`).join('');
    return `<div class="kanban-col" data-stage="${s.key}">
      <div class="kanban-col-head"><span class="dot" style="background:${s.color}"></span>${s.label}<b>${items.length}</b></div>
      ${cards}
    </div>`;
  }).join('');
  wireKanbanDrag(board, (idKey, newStage)=>{
    const [contacto, empresa] = idKey.split('|');
    const o = DATA.crm.find(x=>x.contacto===contacto && x.empresa===empresa);
    if(o && o.stage!==newStage){
      o.stage = newStage;
      saveToLocal();
      renderCRMKanban();
      toast('Oportunidad movida a "'+crmStageInfo(newStage).label+'"');
    }
  });
  document.getElementById('crm-total').textContent = fmt(DATA.crm.filter(o=>o.stage!=='perdido').reduce((s,o)=>s+o.valor,0)) + ' en pipeline activo';
}
function createOportunidad(){
  const contacto = document.getElementById('no-contacto').value.trim();
  const empresa = document.getElementById('no-empresa').value.trim() || '—';
  const interes = document.getElementById('no-interes').value.trim();
  const valor = parseFloat(document.getElementById('no-valor').value) || 0;
  const fecha = document.getElementById('no-fecha').value.trim() || 'Sin fecha';
  if(!contacto || !interes){ toast('Completa contacto e interés'); return; }
  DATA.crm.unshift({contacto, empresa, interes, valor, fecha, stage:'prospecto'});
  saveToLocal();
  ['no-contacto','no-empresa','no-interes','no-valor','no-fecha'].forEach(id=>document.getElementById(id).value='');
  closeModal('modal-nueva-oportunidad');
  renderCRMKanban();
  toast('Oportunidad creada');
}

/* =========================================================
   CLIENTES
========================================================= */
function renderClientesTable(){
  const q = (document.getElementById('cl-search').value || '').toLowerCase();
  const rows = DATA.clientes.filter(c => {
    const full = getFullName(c);
    return !q || full.toLowerCase().includes(q) || c.tel.includes(q);
  });
  
  document.getElementById('clientes-table-body').innerHTML = rows.map(c=>{
    const nTickets = DATA.tickets.filter(t=>t.clienteId===c.id).length;
    const totalCompras = (c.compras || []).reduce((s,p)=>s+p.monto,0);
    
    return `<tr class="tbl-row" onclick="openClientModal('${c.id}')">
      <td><div class="cust"><div class="ci">${initials(c.nombre)}</div><div><b>${getFullName(c)}</b><span>${c.direccion}</span></div></div></td>
      <td class="mono">${c.tel}</td>
      <td class="mono">${nTickets}</td>
      <td class="mono">${fmt(totalCompras)}</td>
      <td class="mono">${fmt(c.limiteCredito || 0)}</td>
      <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openClientModal('${c.id}')">Ver perfil</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:26px;">Sin resultados.</td></tr>';
  
  document.getElementById('clientes-meta').textContent = DATA.clientes.length + ' REGISTRADOS';
}

function switchClientTab(tabId, el){
  const group = el.parentElement;
  group.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  el.classList.add('active');
  
  const container = group.parentElement;
  container.querySelectorAll('.client-subview').forEach(sv=>{
    sv.style.display = sv.id === tabId ? 'block' : 'none';
  });
}

function openClientModal(id){
  const c = DATA.clientes.find(x=>x.id===id);
  if(!c) return;
  currentClientId = id;
  const fullName = getFullName(c);
  
  document.getElementById('mc-nombre').textContent = fullName;
  document.getElementById('mc-email-header').textContent = c.email || 'Sin correo';
  document.getElementById('mc-tel').textContent = c.tel || '—';
  document.getElementById('mc-direccion').textContent = c.direccion || '—';
  
  document.getElementById('mc-limite-input').value = c.limiteCredito || 0;

  const misTickets = DATA.tickets.filter(t => t.clienteId === id || t.cliente === fullName);
  document.getElementById('mc-ntickets').textContent = misTickets.length;
  
  const tkAbiertos = misTickets.filter(t => t.stage !== 'entregado');
  const tkCerrados = misTickets.filter(t => t.stage === 'entregado');
  
  const renderTk = (arr) => arr.length ? arr.map(t=>{
    const st = stageInfo(t.stage);
    return `<div class="note-item" style="cursor:pointer; display:flex; justify-content:space-between;" onclick="closeModal('modal-cliente');openTicketModal('${t.id}')">
      <span><b>#${t.id}</b> — ${t.equipo}</span> <span class="badge ${st.badge}">${st.label}</span>
    </div>`;
  }).join('') : '<div style="color:var(--muted);font-size:12.5px;">Sin tickets en esta categoría.</div>';
  
  document.getElementById('mc-tickets-abiertos').innerHTML = renderTk(tkAbiertos);
  document.getElementById('mc-tickets-finalizados').innerHTML = renderTk(tkCerrados);

  const misVentas = DATA.ventas.filter(v => v.cliente === fullName);
  document.getElementById('mc-ventas-list').innerHTML = misVentas.length ? misVentas.map(v=>`
    <tr><td class="mono">${v.folio}</td><td class="mono">${v.hora}</td><td>${v.articulos}</td><td class="mono">${fmt(v.total)}</td></tr>
  `).join('') : '<tr><td colspan="4" style="color:var(--muted);text-align:center;padding:16px;">Sin compras registradas.</td></tr>';

  const misCreditos = DATA.creditos.filter(cr => cr.cliente === fullName);
  const crActivos = misCreditos.filter(cr => cr.saldo > 0);
  const crPagados = misCreditos.filter(cr => cr.saldo <= 0);

  const renderCr = (arr) => arr.length ? arr.map(cr=>`
    <div class="note-item" style="border-left:3px solid ${cr.saldo>0?'var(--red)':'var(--teal)'}; border-radius:4px 9px 9px 4px;">
      <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
        <b>${cr.concepto}</b> <span class="mono">${fDate(cr.vence)}</span>
      </div>
      <div style="font-size:11.5px; color:var(--muted);">
        Monto original: ${fmt(cr.original)} | Saldo pendiente: <b style="color:${cr.saldo>0?'var(--red)':'var(--teal)'};">${fmt(cr.saldo)}</b>
      </div>
    </div>
  `).join('') : '<div style="color:var(--muted);font-size:12.5px;">Sin préstamos.</div>';

  document.getElementById('mc-prestamos-activos').innerHTML = renderCr(crActivos);
  document.getElementById('mc-prestamos-finalizados').innerHTML = renderCr(crPagados);

  const primerTab = document.querySelector('#modal-cliente .tabs .tab');
  if(primerTab) switchClientTab('mc-tab-tickets', primerTab);

  openModal('modal-cliente');
}

function saveClientLimit(){
  if(!currentClientId) return;
  const c = DATA.clientes.find(x => x.id === currentClientId);
  if(c){
    c.limiteCredito = parseFloat(document.getElementById('mc-limite-input').value) || 0;
    saveToLocal();
    renderClientesTable();
    toast('Límite de crédito actualizado a ' + fmt(c.limiteCredito));
  }
}

function createCliente(){
  const nombre = document.getElementById('ncl-nombre').value.trim();
  const apellido = document.getElementById('ncl-apellido').value.trim();
  
  if(!nombre){ toast('El nombre es obligatorio'); return; }
  
  const id = 'c' + (DATA.clientes.length + 1) + '_' + Date.now().toString().slice(-4);
  const nuevoCliente = {
    id, nombre, apellido, 
    tipo: 'Regular', 
    contacto: nombre,
    direccion: document.getElementById('ncl-direccion').value.trim() || '—',
    tel: document.getElementById('ncl-tel').value.trim() || '—',
    email: document.getElementById('ncl-email').value.trim() || '—',
    equipos:[], compras:[], 
    limiteCredito: parseFloat(document.getElementById('ncl-limite').value) || 0,
    notas:[]
  };
  
  DATA.clientes.unshift(nuevoCliente);
  saveToLocal();

  ['ncl-nombre','ncl-apellido','ncl-direccion','ncl-tel','ncl-email','ncl-limite'].forEach(i=>document.getElementById(i).value='');
  
  closeModal('modal-nuevo-cliente');
  renderClientesTable(); populateClienteSelectPOS();
  
  if(document.getElementById('modal-nuevo-ticket').classList.contains('active')){
    selectClientForTicket(nuevoCliente.id, getFullName(nuevoCliente));
  }
  toast('Cliente guardado con éxito');
}

function populateClienteSelectPOS(){
  const sel = document.getElementById('pos-cliente');
  sel.innerHTML = '<option value="Mostrador">Cliente: Mostrador</option>' + DATA.clientes.map(c=>`<option>Cliente: ${getFullName(c)}</option>`).join('');
}

/* =========================================================
   CRÉDITOS Y CASTIGOS POR MORA
========================================================= */
function creditEstado(c){
  if(c.saldo<=0) return {label:'Liquidado', cls:'done'};
  
  const today = new Date();
  const vDate = new Date(c.vence);
  
  if(vDate < today){
    const diffDays = (today - vDate) / (1000 * 60 * 60 * 24);
    if(diffDays > 30) return {label:'Atrasado > 1 mes', cls:'urg', isOverdue: true};
    return {label:'Vencido', cls:'urg', isOverdue: true};
  }
  return {label:'Al corriente', cls:'prog', isOverdue: false};
}

function renderCreditosTable(){
  const totalSaldo = DATA.creditos.reduce((s,c)=>s+c.saldo,0);
  const vencidos = DATA.creditos.filter(c=>creditEstado(c).isOverdue).length;
  const alCorriente = DATA.creditos.filter(c=>c.saldo > 0 && !creditEstado(c).isOverdue).length;
  const liquidados = DATA.creditos.filter(c=>c.saldo<=0).length;
  
  document.getElementById('creditos-kpis').innerHTML = `
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Saldo total</div><div class="value">${fmt(totalSaldo)}</div><div class="delta flat">${DATA.creditos.length} créditos</div></div>
    <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">Vencidos</div><div class="value">${vencidos}</div><div class="delta down">Requiere seguimiento</div></div>
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="label">Al corriente</div><div class="value">${alCorriente}</div><div class="delta up">En regla</div></div>
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></div><div class="label">Liquidados</div><div class="value">${liquidados}</div><div class="delta flat">Histórico</div></div>`;
  document.getElementById('creditos-meta').textContent = 'SALDO TOTAL POR COBRAR ' + fmt(totalSaldo);

  document.getElementById('creditos-table-body').innerHTML = DATA.creditos.map((c,i)=>{
    const e = creditEstado(c);
    return `<tr class="tbl-row" onclick="openCreditModal(${i})"><td>${c.cliente}</td><td>${c.concepto}</td><td class="mono">${fmt(c.original)}</td><td class="mono" style="${e.isOverdue ? 'color:var(--red); font-weight:bold;' : ''}">${fmt(c.saldo)}</td><td class="mono">${fDate(c.vence)}</td><td><span class="badge ${e.cls}">${e.label}</span></td></tr>`;
  }).join('');
}

function openCreditModal(idx){
  currentCreditIdx = idx;
  const c = DATA.creditos[idx];
  document.getElementById('mcr-cliente').textContent = c.cliente;
  document.getElementById('mcr-concepto').textContent = c.concepto;
  document.getElementById('mcr-original').textContent = fmt(c.original);
  document.getElementById('mcr-vence').textContent = fDate(c.vence);
  document.getElementById('mcr-saldo').textContent = fmt(c.saldo);
  document.getElementById('mcr-progress').style.width = Math.min(100, ((c.original-c.saldo)/c.original*100)).toFixed(0) + '%';
  
  const estado = creditEstado(c);
  const btnMora = document.getElementById('btn-aplicar-mora');
  if(estado.isOverdue && c.saldo > 0){
    btnMora.style.display = 'inline-flex';
  } else {
    btnMora.style.display = 'none';
  }

  document.getElementById('mcr-abonos').innerHTML = c.abonos.length ? c.abonos.map(a=>`<tr><td class="mono">${a.fecha}</td><td class="mono" style="${a.metodo.includes('Recargo') ? 'color:var(--red);' : ''}">${fmt(a.monto)}</td><td>${a.metodo}</td></tr>`).join('') : '<tr><td colspan="3" style="color:var(--muted);">Sin abonos registrados.</td></tr>';
  document.getElementById('mcr-monto-input').value = '';
  openModal('modal-credito');
}

function aplicarInteresMora(){
  if(currentCreditIdx === null) return;
  const c = DATA.creditos[currentCreditIdx];
  const recargo = c.saldo * 0.05; 
  
  c.saldo += recargo;
  c.original += recargo; 
  
  c.abonos.push({
    fecha: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), 
    monto: recargo, 
    metodo: 'Recargo 5% por Mora'
  });
  
  saveToLocal();
  openCreditModal(currentCreditIdx);
  renderCreditosTable();
  toast('Recargo del 5% aplicado al saldo');
}

function registerPayment(){
  const c = DATA.creditos[currentCreditIdx];
  const monto = parseFloat(document.getElementById('mcr-monto-input').value);
  if(!monto || monto<=0){ toast('Ingresa un monto válido'); return; }
  const aplicado = Math.min(monto, c.saldo);
  c.saldo = Math.max(0, c.saldo - monto);
  c.abonos.push({fecha: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), monto:aplicado, metodo: document.getElementById('mcr-metodo-input').value});
  DATA.caja.movs.push({hora:new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}), concepto:'Abono de '+c.cliente, tipo:'ingreso', monto:aplicado});
  
  saveToLocal();
  openCreditModal(currentCreditIdx);
  renderCreditosTable(); renderCajaView(); renderDashboard();
  toast('Abono de '+fmt(aplicado)+' registrado');
}

function openNuevoCreditoModal(){
  populateClienteSelectCredito();
  openModal('modal-nuevo-credito');
}

function populateClienteSelectCredito(){
  const sel = document.getElementById('ncr-cliente');
  sel.innerHTML = '<option value="">Selecciona un cliente...</option>' + 
    DATA.clientes.map(c => `<option value="${c.id}">${getFullName(c)} (Límite: ${fmt(c.limiteCredito||0)})</option>`).join('');
}

function createCreditoManual(){
  const clienteId = document.getElementById('ncr-cliente').value;
  const concepto = document.getElementById('ncr-concepto').value.trim();
  const monto = parseFloat(document.getElementById('ncr-monto').value);
  let vence = document.getElementById('ncr-vence').value;

  if(!clienteId || !concepto || !monto || monto <= 0) {
    toast('Completa todos los campos obligatorios'); return;
  }

  const clienteObj = DATA.clientes.find(c => c.id === clienteId);
  if(!clienteObj) return;

  const cNombre = getFullName(clienteObj);
  const activeLoans = DATA.creditos.filter(cr => cr.cliente === cNombre && cr.saldo > 0);
  const currentDebt = activeLoans.reduce((s, cr) => s + cr.saldo, 0);
  const available = (clienteObj.limiteCredito || 0) - currentDebt;

  if(activeLoans.length >= 2){
    toast('El cliente ya tiene el máximo de 2 préstamos activos permitidos'); return;
  }

  const today = new Date();
  const overdue30 = activeLoans.some(cr => {
    if(!cr.vence || cr.vence === 'A convenir') return false;
    const vDate = new Date(cr.vence);
    if(vDate >= today) return false;
    const diffDays = (today - vDate) / (1000 * 60 * 60 * 24);
    return diffDays > 30;
  });

  if(overdue30){
    toast('Crédito bloqueado: El cliente tiene préstamos atrasados por más de 30 días'); return;
  }

  if(monto > available){
    toast(`Monto rechazado: El cliente solo dispone de ${fmt(available)}`); return;
  }

  if(!vence) vence = addDays(30);

  DATA.creditos.unshift({
    cliente: cNombre,
    concepto: concepto,
    original: monto,
    saldo: monto,
    vence: vence,
    abonos: []
  });

  saveToLocal();

  document.getElementById('ncr-concepto').value = '';
  document.getElementById('ncr-monto').value = '';
  document.getElementById('ncr-vence').value = '';

  closeModal('modal-nuevo-credito');
  renderCreditosTable();
  renderClientesTable();
  toast('Préstamo manual otorgado con éxito');
}

/* =========================================================
   PRODUCTOS Y PROMOCIONES (VISTA TABLA)
========================================================= */
const CATEGORIAS = ['Todos','Componentes','Perifericos','Accesorios','Insumos','Servicios'];
let productoFiltro = 'Todos';

function renderProductosTabs(){
  document.getElementById('productos-tabs').innerHTML = CATEGORIAS.map(cat=>`<div class="tab ${cat===productoFiltro?'active':''}" onclick="setProductoFiltro('${cat}')">${cat}</div>`).join('');
}

function setProductoFiltro(cat){ 
  productoFiltro = cat; 
  renderProductosTabs(); 
  renderProductosTable(); 
}

function renderProductosTable(){
  const items = DATA.productos.filter(p=> productoFiltro==='Todos' || p.categoria===productoFiltro);
  
  document.getElementById('productos-table-body').innerHTML = items.map((p)=>{
    const isService = p.categoria==='Servicios';
    const badgeClass = p.stock===0 && !isService ? 'urg' : (!isService && p.stock/p.stockMax<0.25) ? 'pend' : 'done';
    const badgeLabel = p.stock===0 && !isService ? 'Agotado' : (!isService && p.stock/p.stockMax<0.25) ? 'Bajo' : (isService?'Servicio':'Stock');
    const stockDisplay = isService ? '—' : `${p.stock} / ${p.stockMax}`;
    
    return `<tr class="tbl-row">
      <td><b>${p.nombre}</b><br><span class="mono">${p.sku}</span></td>
      <td>${p.categoria}</td>
      <td class="mono">${fmt(p.precio)}</td>
      <td class="mono">${stockDisplay}</td>
      <td><span class="badge ${badgeClass}">${badgeLabel}</span></td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="editProducto('${p.sku}')" style="padding:4px 8px; margin-right:4px;">✏️ Editar</button>
        <button class="btn btn-ghost btn-sm" onclick="eliminarProducto('${p.sku}')" style="color:var(--red); padding:4px 8px;">✕ Borrar</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">Sin productos en esta categoría.</td></tr>';

  const skus = DATA.productos.length;
  const valorInv = DATA.productos.filter(p=>p.categoria!=='Servicios').reduce((s,p)=>s+p.precio*p.stock,0);
  const stockBajo = DATA.productos.filter(p=>p.categoria!=='Servicios' && p.stock>0 && p.stock/p.stockMax<0.25).length;
  const agotados = DATA.productos.filter(p=>p.categoria!=='Servicios' && p.stock===0).length;
  document.getElementById('productos-kpis').innerHTML = `
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5z"/></svg></div><div class="label">SKU en catálogo</div><div class="value">${skus}</div><div class="delta flat">Activos</div></div>
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></div><div class="label">Valor de inventario</div><div class="value">${fmtK(valorInv)}</div><div class="delta up">Costo de reposición</div></div>
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">Stock bajo</div><div class="value">${stockBajo}</div><div class="delta down">Reabastecer pronto</div></div>
    <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></div><div class="label">Agotados</div><div class="value">${agotados}</div><div class="delta down">Sin existencias</div></div>`;
  document.getElementById('productos-meta').textContent = skus + ' SKU EN CATÁLOGO';
}

function createProducto(){
  const nombre = document.getElementById('np-nombre').value.trim();
  const sku = document.getElementById('np-sku').value.trim() || ('SKU-'+Math.floor(Math.random()*9000+1000));
  const precio = parseFloat(document.getElementById('np-precio').value) || 0;
  const stock = parseInt(document.getElementById('np-stock').value) || 0;
  
  if(!nombre){ toast('Ingresa un nombre de producto'); return; }
  
  DATA.productos.unshift({sku, nombre, categoria: document.getElementById('np-categoria').value, precio, stock, stockMax: Math.max(stock,10), proveedor:'—', vendidos:0});
  saveToLocal();
  
  ['np-nombre','np-sku','np-precio','np-stock'].forEach(i=>document.getElementById(i).value='');
  closeModal('modal-nuevo-producto');
  
  renderProductosTable(); 
  renderPOSProducts();
  toast('Producto agregado al catálogo');
}

let currentEditProductSku = null;

function editProducto(sku) {
    const p = DATA.productos.find(x => x.sku === sku);
    if(!p) return;
    currentEditProductSku = sku;
    
    document.getElementById('ep-nombre').value = p.nombre;
    document.getElementById('ep-sku').value = p.sku;
    document.getElementById('ep-categoria').value = p.categoria;
    document.getElementById('ep-precio').value = p.precio;
    document.getElementById('ep-stock').value = p.stock;
    
    openModal('modal-editar-producto');
}

function saveEditProducto() {
    if(!currentEditProductSku) return;
    
    const realIdx = DATA.productos.findIndex(p => p.sku === currentEditProductSku);
    if(realIdx === -1) return;
    
    const nombre = document.getElementById('ep-nombre').value.trim();
    const precio = parseFloat(document.getElementById('ep-precio').value) || 0;
    const stock = parseInt(document.getElementById('ep-stock').value) || 0;
    const categoria = document.getElementById('ep-categoria').value;
    
    if(!nombre) { toast('El nombre no puede estar vacío'); return; }
    
    DATA.productos[realIdx].nombre = nombre;
    DATA.productos[realIdx].precio = precio;
    DATA.productos[realIdx].stock = stock;
    
    if(stock > DATA.productos[realIdx].stockMax) {
        DATA.productos[realIdx].stockMax = stock; 
    }
    
    DATA.productos[realIdx].categoria = categoria;
    
    saveToLocal();
    closeModal('modal-editar-producto');
    renderProductosTable();
    renderPOSProducts();
    toast('Producto actualizado con éxito');
}

function eliminarProducto(sku) {
    const realIdx = DATA.productos.findIndex(p => p.sku === sku);
    if(realIdx > -1) {
        DATA.productos.splice(realIdx, 1);
        saveToLocal();
        renderProductosTable();
        renderPOSProducts();
        toast('Producto eliminado');
    }
}


function renderPromocionesTable() {
  const tbody = document.getElementById('promos-table-body');
  if(!tbody) return;
  const today = new Date().toISOString().split('T')[0];
  
  tbody.innerHTML = DATA.promociones.map((p, idx) => {
    const isExpired = p.vence < today;
    const statusBadge = !p.activa ? '<span class="badge urg">Inactiva</span>' : (isExpired ? '<span class="badge wait">Vencida</span>' : '<span class="badge done">Activa</span>');
    const valorStr = p.tipo === 'Porcentaje (%)' ? p.valor + '%' : fmt(p.valor);
    
    return `<tr class="tbl-row">
      <td><b>${p.nombre}</b><br><span class="mono">${p.id}</span></td>
      <td class="mono" style="color:var(--teal); font-weight:bold;">-${valorStr}</td>
      <td>${p.aplicaA}</td>
      <td class="mono">${fDate(p.vence)}</td>
      <td>${statusBadge}</td>
      <td>
        <button class="btn btn-ghost btn-sm" onclick="togglePromocion(${idx})">${p.activa ? 'Desactivar' : 'Activar'}</button>
      </td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No hay promociones configuradas.</td></tr>';
}

function togglePromocion(idx) {
  DATA.promociones[idx].activa = !DATA.promociones[idx].activa;
  saveToLocal();
  renderPromocionesTable();
  populatePOSPromos(); 
  renderCart(); 
  toast(DATA.promociones[idx].activa ? 'Promoción activada' : 'Promoción desactivada');
}

function createPromocion() {
  const nombre = document.getElementById('npr-nombre').value.trim();
  const tipo = document.getElementById('npr-tipo').value;
  const valor = parseFloat(document.getElementById('npr-valor').value);
  let vence = document.getElementById('npr-vence').value;
  const aplicaA = document.getElementById('npr-aplica').value;

  if(!nombre || !valor || valor <= 0) {
    toast('Completa el nombre y un valor válido'); return;
  }
  if(!vence) {
    vence = addDays(30); 
  }

  DATA.promociones.unshift({
    id: 'PRM-' + Date.now().toString().slice(-4),
    nombre, tipo, valor, aplicaA, vence, activa: true
  });
  
  saveToLocal();
  
  ['npr-nombre','npr-valor','npr-vence'].forEach(i=>document.getElementById(i).value='');
  closeModal('modal-nueva-promocion');
  
  renderPromocionesTable();
  populatePOSPromos(); 
  toast('Promoción creada con éxito');
}


/* =========================================================
   REPORTES
========================================================= */
function renderReportes(){
  const ingresosMes = ventasMensuales[ventasMensuales.length-1].v;
  document.getElementById('reportes-kpis').innerHTML = `
    <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M23 6l-9.5 9.5-5-5L1 18"/></svg></div><div class="label">Ingresos del mes</div><div class="value">${fmtK(ingresosMes)}</div><div class="delta up">↑ 17% vs Jul</div></div>
    <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7a2 2 0 012-2h12a2 2 0 012 2v3a2 2 0 000 4v3a2 2 0 01-2 2H6a2 2 0 01-2-2v-3a2 2 0 000-4V7z"/></svg></div><div class="label">Ticket promedio</div><div class="value">4.2 días</div><div class="delta up">Tiempo de resolución</div></div>
    <div class="kpi c-violet"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg></div><div class="label">Satisfacción</div><div class="value">94%</div><div class="delta up">↑ 2 pts</div></div>
    <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="5" width="20" height="14" rx="2"/></svg></div><div class="label">Cuentas por cobrar</div><div class="value">${fmt(DATA.creditos.reduce((s,c)=>s+c.saldo,0))}</div><div class="delta flat">${DATA.creditos.length} créditos</div></div>`;

  document.getElementById('reportes-bar-ventas').innerHTML = svgBarChart(ventasMensuales.map(d=>({l:d.l,v:d.v})), {fmt:fmtK, color:'var(--copper)'});

  const porTecnico = {};
  DATA.tickets.forEach(t=>{ porTecnico[t.tecnico] = (porTecnico[t.tecnico]||0) + 1; });
  const tecData = Object.keys(porTecnico).map(k=>({l:k.split(' ')[0], v:porTecnico[k]}));
  document.getElementById('reportes-bar-tecnico').innerHTML = svgBarChart(tecData, {color:'var(--teal)'});

  const porEstado = TICKET_STAGES.map(s=>({label:s.label, value:DATA.tickets.filter(t=>t.stage===s.key).length, color:s.color})).filter(s=>s.value>0);
  renderDonut(document.getElementById('reportes-donut'), porEstado);

  const top = DATA.productos.slice().sort((a,b)=>b.vendidos-a.vendidos).slice(0,5).map(p=>({l:p.nombre, v:p.vendidos}));
  renderHBars(document.getElementById('reportes-top-productos'), top);
}

/* =========================================================
   CONFIGURACIÓN (NEGOCIO, USUARIOS Y ROLES REALES)
========================================================= */

function renderConfig() {
  if(DATA.negocio) {
      document.getElementById('cfg-nombre').value = DATA.negocio.nombre || '';
      document.getElementById('cfg-rfc').value = DATA.negocio.rfc || '';
      document.getElementById('cfg-tel').value = DATA.negocio.telefono || '';
      document.getElementById('cfg-email').value = DATA.negocio.correo || '';
      document.getElementById('cfg-dir').value = DATA.negocio.direccion || '';
  }

  document.getElementById('config-users-body').innerHTML = DATA.usuarios.map((u,i)=>`
    <tr><td><div class="cust"><div class="ci">${initials(u.nombre)}</div><b>${u.nombre}</b></div></td><td>${u.rol}</td><td class="mono">${u.email}</td>
    <td><div class="toggle ${u.activo?'on':''}" onclick="toggleUsuario(${i})"><div class="knob"></div></div></td></tr>`).join('');
  document.getElementById('config-users-meta').textContent = DATA.usuarios.filter(u=>u.activo).length + ' activos de ' + DATA.usuarios.length;

  document.getElementById('config-roles').innerHTML = DATA.roles.map(r=>`
    <div class="role-card"><h4>${r.nombre}</h4><p>${r.desc}</p><ul>${r.permisos.map(p=>'<li><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 6L9 17l-5-5"/></svg>'+p+'</li>').join('')}</ul></div>`).join('');

  const selRol = document.getElementById('nu-rol');
  if(selRol) {
      selRol.innerHTML = DATA.roles.map(r => `<option value="${r.nombre}">${r.nombre}</option>`).join('');
  }
}

function saveConfigNegocio() {
    DATA.negocio = {
        nombre: document.getElementById('cfg-nombre').value.trim(),
        rfc: document.getElementById('cfg-rfc').value.trim(),
        telefono: document.getElementById('cfg-tel').value.trim(),
        correo: document.getElementById('cfg-email').value.trim(),
        direccion: document.getElementById('cfg-dir').value.trim()
    };
    saveToLocal();
    document.getElementById('dash-title-negocio').textContent = DATA.negocio.nombre;
    toast('Datos del negocio guardados en la nube');
}

function createUsuario() {
    const nombre = document.getElementById('nu-nombre').value.trim();
    const email = document.getElementById('nu-email').value.trim();
    const rol = document.getElementById('nu-rol').value;

    if(!nombre || !email) { toast('Completa todos los campos'); return; }

    DATA.usuarios.push({ nombre, email, rol, activo: true });
    saveToLocal();

    document.getElementById('nu-nombre').value = '';
    document.getElementById('nu-email').value = '';
    
    closeModal('modal-nuevo-usuario');
    renderConfig();
    toast('Usuario creado. (Regístralo también en Firebase Auth)');
}

function toggleUsuario(i){ 
  DATA.usuarios[i].activo = !DATA.usuarios[i].activo; 
  saveToLocal();
  renderConfig(); 
  toast(DATA.usuarios[i].activo?'Usuario activado':'Usuario desactivado'); 
}

function createRol() {
    const nombre = document.getElementById('nr-nombre').value.trim();
    const desc = document.getElementById('nr-desc').value.trim();
    
    const checkboxes = document.querySelectorAll('.chk-permiso:checked');
    const permisos = Array.from(checkboxes).map(chk => chk.value);

    if(!nombre || permisos.length === 0) { 
        toast('Escribe un nombre y selecciona al menos 1 permiso'); 
        return; 
    }

    DATA.roles.push({ nombre, desc, permisos });
    saveToLocal();

    document.getElementById('nr-nombre').value = '';
    document.getElementById('nr-desc').value = '';
    document.querySelectorAll('.chk-permiso').forEach(chk => chk.checked = false);

    closeModal('modal-nuevo-rol');
    renderConfig();
    toast('Nuevo rol creado con éxito');
}

/* =========================================================
   LA FUNCIÓN MAESTRA: Se ejecuta cuando se detecta usuario
========================================================= */
function renderAll(){
  renderDashboard();
  renderTicketsTable(); renderTicketsKanban();
  populateClienteSelectPOS();
  renderPayMethods(); 
  populatePOSPromos(); 
  renderPOSProducts(); renderCart();
  renderVentasHistorial();
  renderCajaView();
  renderCRMKanban();
  renderClientesTable();
  renderCreditosTable();
  renderProductosTabs(); renderProductosTable(); 
  renderPromocionesTable(); 
  renderReportes();
  renderConfig(); 
}
