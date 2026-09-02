// js/modules/clientes.js
import { DATA } from '../core/store.js';
import { getFullName, toast, fmt, fDate } from '../core/utils.js';
import { openModal, closeModal, goView } from './ui.js';

let currentClientId = null;

export function renderClientesTable() {
    const q = document.getElementById('cl-search').value.toLowerCase();
    const tbody = document.getElementById('clientes-table-body');
    if (!tbody) return;

    let match = DATA.clientes.filter(c => getFullName(c).toLowerCase().includes(q) || (c.tel || '').includes(q) || (c.dni || '').includes(q));
    
    document.getElementById('clientes-meta').textContent = DATA.clientes.length + ' REGISTRADOS';

    // Ajuste de tabla: Se agrega columna Saldo a Favor
    tbody.innerHTML = match.map(c => {
        const tks = DATA.tickets.filter(t => t.clienteId === c.id || t.cliente === getFullName(c)).length;
        const disp = c.limiteCredito !== undefined ? c.limiteCredito : 5000;
        const saldoFav = c.saldoAFavor || 0;
        
        return `<tr>
          <td><b>${getFullName(c)}</b><br><span style="font-size:11px;color:var(--muted);">${c.dni||'Sin DNI'}</span></td>
          <td class="mono">${c.tel || '—'}</td>
          <td class="mono">${tks}</td>
          <td class="mono" style="color:${saldoFav > 0 ? 'var(--teal)' : 'var(--ink)'}; font-weight:${saldoFav > 0 ? 'bold' : 'normal'}">${fmt(saldoFav)}</td>
          <td class="mono" style="color:var(--copper);">${fmt(disp)}</td>
          <td><button class="btn btn-ghost btn-sm" onclick="openClientModal('${c.id}')">Ver Perfil CRM</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">No hay clientes registrados.</td></tr>';
}

export function openClientModal(id) {
    const c = DATA.clientes.find(x => x.id === id);
    if (!c) return;
    currentClientId = id;
    
    document.getElementById('mc-nombre').textContent = getFullName(c);
    document.getElementById('mc-id-header').textContent = 'ID: ' + c.id;
    document.getElementById('mc-tel').textContent = c.tel || '—';
    document.getElementById('mc-email').textContent = c.email || '—';
    const dirFull = [c.direccion, c.barrio, c.localidad, c.provincia].filter(Boolean).join(', ');
    document.getElementById('mc-direccion').textContent = dirFull || '—';
    document.getElementById('mc-limite-input').value = c.limiteCredito !== undefined ? c.limiteCredito : 5000;

    const cliName = getFullName(c);
    const tickets = DATA.tickets.filter(t => t.clienteId === id || t.cliente === cliName);
    const ventas = DATA.ventas.filter(v => v.clienteId === id || v.cliente === cliName);
    const creditos = DATA.creditos.filter(cr => cr.clienteId === id || cr.cliente === cliName);

    const ltv = ventas.reduce((acc, v) => acc + (v.total || 0), 0); 
    const deuda = creditos.reduce((acc, cr) => acc + (cr.saldo || 0), 0);
    
    let ultima = '—';
    const fechas = [...tickets.map(t => t.ingreso), ...ventas.map(v => v.fecha)].filter(Boolean).sort().reverse();
    if (fechas.length > 0) ultima = fechas[0];

    document.getElementById('mc-kpi-tickets').textContent = tickets.length;
    // Adaptamos el LTV original para mostrar el Saldo a Favor también
    document.getElementById('mc-kpi-ltv').innerHTML = `${fmt(c.saldoAFavor || 0)} <span style="font-size:10px; display:block; color:var(--muted); font-weight:normal;">Saldo a Favor</span>`;
    document.getElementById('mc-kpi-ltv').style.color = (c.saldoAFavor || 0) > 0 ? 'var(--teal)' : 'var(--ink)';
    
    document.getElementById('mc-kpi-deuda').textContent = fmt(deuda);
    document.getElementById('mc-kpi-ultima').textContent = fDate(ultima);

    const equiposUnicos = [];
    tickets.forEach(t => {
        if(t.equipo) {
            const hash = `${t.equipo}-${t.marca}-${t.modelo}-${t.serie}`;
            if(!equiposUnicos.some(eq => eq.hash === hash)) {
                equiposUnicos.push({ hash, eq: t.equipo, marca: t.marca||'', mod: t.modelo||'', serie: t.serie||'S/N no reg.' });
            }
        }
    });

    const eqContainer = document.getElementById('mc-equipos-list');
    let eqHtml = equiposUnicos.map(e => `
        <div style="min-width:200px; border:1px solid var(--line); border-radius:12px; padding:16px; background:#fff; transition:0.2s;">
            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
              <span style="font-size:24px;">${e.eq.toLowerCase().includes('phone') || e.eq.toLowerCase().includes('cel') ? '📱' : '💻'}</span>
            </div>
            <div style="font-weight:700; font-size:14px; margin-bottom:4px; line-height:1.2;">${e.eq} ${e.marca} ${e.mod}</div>
            <div class="mono" style="font-size:10px; color:var(--muted); margin-bottom:12px;">S/N: ${e.serie}</div>
            <button class="btn btn-ghost btn-sm" style="width:100%; justify-content:center; font-size:11px; padding:6px;" onclick="openTicketWithDevice('${c.id}', '${e.eq}', '${e.marca}', '${e.mod}', '${e.serie}')">+ Ingresar Ticket</button>
        </div>
    `).join('');
    
    eqHtml += `
        <div style="min-width:180px; border:2px dashed var(--line); border-radius:12px; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; background:transparent; padding:20px; transition:0.2s;" onclick="openTicketWithDevice('${c.id}', '', '', '', '')">
           <div style="font-size:24px; color:var(--muted); margin-bottom:8px; line-height:1;">+</div>
           <div style="font-size:11px; font-weight:600; color:var(--muted); text-transform:uppercase;">Ingresar Equipo Nuevo</div>
        </div>`;
    eqContainer.innerHTML = eqHtml;

    document.getElementById('mc-tickets-lista').innerHTML = tickets.length > 0 
        ? tickets.sort((a,b)=>a.id<b.id?1:-1).map(t => {
            const cl = t.stage === 'entregado' ? 'teal' : 'amber';
            return `<tr><td class="mono">${t.ingreso}</td><td class="mono">#${t.id}</td><td>${t.equipo} ${t.marca||''} <br><span style="font-size:10px; color:var(--muted);">${t.falla}</span></td><td><span class="badge" style="background:var(--${cl}-dim); color:var(--${cl});">${t.stage}</span></td><td class="mono" style="font-weight:bold;">${fmt(t.presupuestoEstimado||0)}</td></tr>`;
          }).join('')
        : '<tr><td colspan="5" style="text-align:center; padding:20px; color:var(--muted);">No hay tickets registrados.</td></tr>';

    document.getElementById('mc-ventas-list').innerHTML = ventas.length > 0 
        ? ventas.sort((a,b)=>a.folio<b.folio?1:-1).map(v => {
            const numItems = (v.items || v.articulosCart || v.articulos || []).length;
            return `<tr><td class="mono">#${v.folio}</td><td class="mono">${v.fecha} ${v.hora||''}</td><td>${numItems} articulos</td><td class="mono" style="color:var(--teal); font-weight:bold;">${fmt(v.total)}</td></tr>`;
          }).join('')
        : '<tr><td colspan="4" style="text-align:center; padding:20px; color:var(--muted);">Sin historial de compras.</td></tr>';

    const activas = creditos.filter(x => x.saldo > 0);
    const finalizadas = creditos.filter(x => x.saldo <= 0);

    const renderCred = (arr) => arr.map(c => `<div style="background:var(--bg); padding:10px; border-radius:6px; margin-bottom:6px; font-size:13px; display:flex; justify-content:space-between;"><div><b>Carpeta #${c.id}</b> - ${c.concepto}</div><div class="mono" style="font-weight:bold; color:var(--copper);">${fmt(c.saldo)}</div></div>`).join('');
    
    document.getElementById('mc-prestamos-activos').innerHTML = activas.length ? renderCred(activas) : '<div style="color:var(--muted); font-size:12px;">Sin carpetas activas.</div>';
    document.getElementById('mc-prestamos-finalizados').innerHTML = finalizadas.length ? renderCred(finalizadas) : '<div style="color:var(--muted); font-size:12px;">Sin historial.</div>';

    openModal('modal-cliente');
}

export function openTicketWithDevice(cliId, eq, marca, mod, serie) {
    closeModal('modal-cliente');
    
    // Nueva navegación a la Vista de Pantalla Completa
    goView('nuevo-ticket');
    
    const c = DATA.clientes.find(x => x.id === cliId);
    if(c) {
        setTimeout(() => { 
            if(document.getElementById('nt-cliente-id')) document.getElementById('nt-cliente-id').value = cliId;
            if(document.getElementById('nt-cliente-input')) document.getElementById('nt-cliente-input').value = getFullName(c);
            
            const selEq = document.getElementById('nt-tipo-equipo');
            if(selEq) {
                let found = Array.from(selEq.options).some(opt => opt.value === eq);
                selEq.value = found ? eq : 'Otro';
            }
            
            if(document.getElementById('nt-marca')) document.getElementById('nt-marca').value = marca || '';
            if(document.getElementById('nt-modelo')) document.getElementById('nt-modelo').value = mod || '';
            if(document.getElementById('nt-serie')) document.getElementById('nt-serie').value = serie !== 'S/N no reg.' ? serie : '';
            
            const fallaInput = document.getElementById('nt-falla');
            if(fallaInput) fallaInput.focus(); 
        }, 150);
    }
}

export function switchClientTab(tabId, element) {
    const group = element.parentElement;
    group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    element.classList.add('active');

    const container = document.getElementById('modal-cliente').querySelector('.modal-body');
    container.querySelectorAll('.client-subview').forEach(sv => sv.style.display = 'none');
    document.getElementById(tabId).style.display = 'block';
}

export async function saveClientLimit() {
    if (!currentClientId) return;
    const val = parseFloat(document.getElementById('mc-limite-input').value);
    if (isNaN(val) || val < 0) return toast('Monto inválido');
    
    try {
        await window.db.collection('clientes').doc(currentClientId).update({ limiteCredito: val });
        const c = DATA.clientes.find(x => x.id === currentClientId);
        if(c) c.limiteCredito = val;
        toast('Límite de crédito actualizado');
        renderClientesTable();
    } catch(e) { toast('Error guardando límite'); }
}

export async function createCliente() {
    const nombre = document.getElementById('ncl-nombre').value.trim();
    const dni = document.getElementById('ncl-dni').value.trim();
    if (!nombre) return toast('El nombre es obligatorio');
    
    const limiteStr = document.getElementById('ncl-limite').value;
    const limiteCredito = parseFloat(limiteStr) || 5000;

    const cliente = {
        nombre,
        apellido: document.getElementById('ncl-apellido').value.trim(),
        dni,
        direccion: document.getElementById('ncl-direccion').value.trim(),
        provincia: document.getElementById('ncl-provincia').value.trim(),
        localidad: document.getElementById('ncl-localidad').value.trim(),
        barrio: document.getElementById('ncl-barrio').value.trim(),
        tel: document.getElementById('ncl-tel').value.trim(),
        email: document.getElementById('ncl-email').value.trim(),
        limiteCredito,
        saldoAFavor: 0, // Inicia en cero
        fechaRegistro: new Date().toISOString()
    };

    try {
        const docRef = await window.db.collection('clientes').add(cliente);
        cliente.id = docRef.id;
        DATA.clientes.push(cliente);
        
        ['ncl-nombre','ncl-apellido','ncl-dni','ncl-direccion','ncl-provincia','ncl-localidad','ncl-barrio','ncl-tel','ncl-email'].forEach(id => document.getElementById(id).value = '');
        document.getElementById('ncl-limite').value = '5000';
        
        closeModal('modal-nuevo-cliente');
        toast('Cliente guardado');
        renderClientesTable();
        populateClienteSelectPOS();
        
        const b = document.getElementById('nt-cliente-input');
        if (b && b.offsetParent !== null) { 
            document.getElementById('nt-cliente-id').value = cliente.id;
            b.value = getFullName(cliente);
            if(document.getElementById('nt-client-suggestions')) document.getElementById('nt-client-suggestions').style.display='none';
        }
    } catch (e) { toast('Error guardando cliente'); }
}

export function populateClienteSelectPOS() {
    const s = document.getElementById('pos-cliente');
    if (!s) return;
    s.innerHTML = '<option value="Mostrador">Cliente: Mostrador</option>' + DATA.clientes.map(c => `<option value="${c.id}">Cliente: ${getFullName(c)}</option>`).join('');
}

export function nuevoCreditoDesdePerfil() {
    if(!currentClientId) return;
    closeModal('modal-cliente');
    if(window.openNuevoCreditoModal) window.openNuevoCreditoModal(currentClientId);
}

export function refinanciarDeudaPerfil() {
    toast("Módulo de Refinanciación en construcción.");
}