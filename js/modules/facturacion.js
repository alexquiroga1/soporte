// js/modules/facturacion.js
import { DATA } from '../core/store.js';
import { fmt, fDate, toast, getFullName } from '../core/utils.js';
import { currentUserProfile } from '../core/auth.js';
import { goView } from './ui.js';

let currentFacturaId = null;

export function renderFacturasTable() {
    if (!DATA.facturas) DATA.facturas = [];
    const tbody = document.getElementById('facturacion-table-body');
    if (!tbody) return;

    const q = (document.getElementById('fac-search')?.value || '').toLowerCase();
    const fTipo = document.getElementById('fac-filter-tipo')?.value;
    const fEst = document.getElementById('fac-filter-estado')?.value;

    let match = DATA.facturas.filter(f => {
        const passQ = !q || f.cliente.toLowerCase().includes(q) || f.doc.includes(q) || (f.refId || '').toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
        const passTipo = !fTipo || f.tipo === fTipo;
        const passEst = !fEst || f.estado === fEst;
        return passQ && passTipo && passEst;
    });

    match.sort((a, b) => b.id.localeCompare(a.id));

    tbody.innerHTML = match.map(f => {
        let estBadge = f.estado === 'Emitida' 
            ? `<span class="badge" style="background:var(--teal-dim); color:var(--teal);">🟢 EMITIDA</span>` 
            : `<span class="badge" style="background:var(--red-dim); color:var(--red);">🔴 ANULADA</span>`;
        if (f.tipo === 'Nota de Crédito') estBadge = `<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🟣 NC APLICADA</span>`;

        let colorRef = f.refModulo === 'Ticket' ? 'var(--copper)' : 'var(--ink)';
        let colorTot = f.tipo === 'Nota de Crédito' ? 'var(--red)' : 'var(--ink)';
        let signo = f.tipo === 'Nota de Crédito' ? '-' : '';

        return `<tr>
          <td class="mono" style="color:var(--muted);">${fDate(f.fecha)}</td>
          <td class="mono" style="font-weight:700;">${f.id}</td>
          <td><b>${f.cliente}</b><br><span style="font-size:10px; color:var(--muted);">DOC: ${f.doc || 'C.F.'}</span></td>
          <td>${f.tipo}</td>
          <td class="mono" style="color:${colorRef}; font-weight:600;">${f.refId}</td>
          <td>${estBadge}</td>
          <td class="mono" style="font-weight:700; color:${colorTot}; font-size:13.5px;">${signo}${fmt(f.total)}</td>
          <td><button class="btn btn-ghost btn-sm" style="padding:6px 10px; font-size:11px;" onclick="openFacturaDetalle('${f.id}')">👁️ Ver</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--muted);">No hay comprobantes con estos filtros.</td></tr>';
}

export function openFacturaDetalle(id) {
    const f = DATA.facturas.find(x => x.id === id);
    if (!f) return;
    currentFacturaId = id;

    document.getElementById('fd-id').textContent = f.id;
    document.getElementById('fd-fecha').textContent = `Fecha de emisión: ${fDate(f.fecha)} · ${f.hora} hs`;
    
    const badgeEl = document.getElementById('fd-badge-estado');
    const btnAnular = document.getElementById('btn-fd-anular');
    if (f.estado === 'Emitida' && f.tipo === 'Factura') {
        badgeEl.innerHTML = `<span class="badge" style="background:var(--teal-dim); color:var(--teal);">🟢 EMITIDA</span>`;
        btnAnular.style.display = 'inline-flex';
    } else if (f.tipo === 'Nota de Crédito') {
        badgeEl.innerHTML = `<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🟣 NC APLICADA</span>`;
        btnAnular.style.display = 'none';
    } else {
        badgeEl.innerHTML = `<span class="badge" style="background:var(--red-dim); color:var(--red);">🔴 ANULADA</span>`;
        btnAnular.style.display = 'none';
    }

    document.getElementById('fd-origen').textContent = f.refModulo || 'Manual';
    document.getElementById('fd-ref').textContent = f.refId || 'N/A';
    document.getElementById('fd-caja').textContent = f.refPago || 'Sin pago asociado';
    
    document.getElementById('fd-cliente').textContent = f.cliente || 'Consumidor Final';
    document.getElementById('fd-doc').textContent = f.doc || 'N/A';
    
    document.getElementById('fd-usuario').textContent = f.usuario || 'Sistema';
    
    const pSt = document.getElementById('fd-pago-status');
    pSt.textContent = f.estadoPago || 'Pendiente';
    pSt.style.color = f.estadoPago === 'Pagado Total' ? 'var(--teal)' : 'var(--amber)';

    let itemsHtml = (f.items || []).map(i => `<tr>
        <td style="padding:10px 14px; border-bottom:1px solid var(--line);">${i.desc}</td>
        <td class="mono" style="padding:10px 14px; border-bottom:1px solid var(--line);">${i.cant}</td>
        <td class="mono" style="padding:10px 14px; border-bottom:1px solid var(--line);">${fmt(i.precio)}</td>
        <td class="mono" style="padding:10px 14px; border-bottom:1px solid var(--line); text-align:right; font-weight:bold;">${fmt(i.cant * i.precio)}</td>
    </tr>`).join('');
    document.getElementById('fd-items').innerHTML = itemsHtml || '<tr><td colspan="4" style="text-align:center; color:var(--muted); padding:20px;">Sin conceptos</td></tr>';

    let totalStr = f.tipo === 'Nota de Crédito' ? `-${fmt(f.total)}` : fmt(f.total);
    document.getElementById('fd-total').textContent = totalStr;

    const hist = f.historial || [];
    document.getElementById('fd-historial').innerHTML = hist.slice().reverse().map(h => `
        <div style="background:var(--bg); padding:10px; border-radius:8px; border-left:3px solid var(--copper);">
          <div style="display:flex; justify-content:space-between; margin-bottom:2px; font-size:11px;">
            <b style="color:var(--ink);">${h.accion}</b> <span style="color:var(--muted);">${h.fecha}</span>
          </div>
          <div style="font-size:11.5px; color:var(--muted);">${h.detalle}</div>
        </div>
    `).join('');

    goView('facturacion-detalle');
}

export async function anularFacturaActual() {
    if (!currentFacturaId) return;
    const original = DATA.facturas.find(x => x.id === currentFacturaId);
    if (!original || original.estado !== 'Emitida') return;

    if (!confirm(`¿Estás seguro de anular el comprobante ${original.id}?\nSe generará una Nota de Crédito por ${fmt(original.total)} y el saldo volverá a favor del cliente.`)) return;

    try {
        const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
        const now = new Date();
        const fDateStr = now.toISOString().split('T')[0];
        const hTimeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const logDate = fDate(fDateStr) + ' ' + hTimeStr;

        await window.db.collection('facturas').doc(original.id).update({
            estado: 'Anulada',
            historial: window.firebase.firestore.FieldValue.arrayUnion({ fecha: logDate, accion: 'Comprobante Anulado', detalle: `Se generó Nota de Crédito. Usuario: ${user}` })
        });
        original.estado = 'Anulada';

        let nuevoNum = 1;
        const contadoresRef = window.db.collection('negocio').doc('contadores');
        await window.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(contadoresRef);
            if (doc.exists && doc.data().nc) nuevoNum = doc.data().nc + 1;
            transaction.set(contadoresRef, { nc: nuevoNum }, { merge: true });
        });
        const ncId = 'NC-' + nuevoNum.toString().padStart(4, '0');

        const ncData = {
            id: ncId, fecha: fDateStr, hora: hTimeStr,
            cliente: original.cliente, doc: original.doc, clienteId: original.clienteId,
            tipo: 'Nota de Crédito', refModulo: 'Factura', refId: original.id, refPago: original.refPago,
            estado: 'Emitida', total: original.total, items: original.items, usuario: user, estadoPago: 'Aplicada',
            historial: [{ fecha: logDate, accion: 'Emisión NC', detalle: `Anula comprobante ${original.id}. Usuario: ${user}` }]
        };
        await window.db.collection('facturas').doc(ncId).set(ncData);
        if(!DATA.facturas) DATA.facturas = [];
        DATA.facturas.push(ncData);

        toast(`✅ Nota de Crédito ${ncId} generada`);
        openFacturaDetalle(original.id); 
        
    } catch (e) { toast("❌ Error al procesar anulación"); }
}

export async function emitirComprobanteInterno(origen, refId, refPago, clienteId, clienteNombre, items, total, estadoPago) {
    try {
        const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
        const now = new Date();
        const fDateStr = now.toISOString().split('T')[0];
        const hTimeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const logDate = fDate(fDateStr) + ' ' + hTimeStr;

        let nuevoNum = 1;
        const contadoresRef = window.db.collection('negocio').doc('contadores');
        await window.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(contadoresRef);
            if (doc.exists && doc.data().facturas) nuevoNum = doc.data().facturas + 1;
            transaction.set(contadoresRef, { facturas: nuevoNum }, { merge: true });
        });
        const facId = 'FAC-' + nuevoNum.toString().padStart(6, '0');

        let docCliente = 'C.F.';
        if(clienteId) {
            const cli = DATA.clientes.find(c => c.id === clienteId);
            if(cli && cli.dni) docCliente = cli.dni;
        }

        const facData = {
            id: facId, fecha: fDateStr, hora: hTimeStr,
            cliente: clienteNombre, doc: docCliente, clienteId: clienteId || null,
            tipo: 'Factura', refModulo: origen, refId: refId || '—', refPago: refPago || '—',
            estado: 'Emitida', total: total, items: items, usuario: user, estadoPago: estadoPago,
            historial: [{ fecha: logDate, accion: 'Emisión de Comprobante', detalle: `Emitido exitosamente. Origen: ${origen}. Usuario: ${user}` }]
        };

        await window.db.collection('facturas').doc(facId).set(facData);
        if(!DATA.facturas) DATA.facturas = [];
        DATA.facturas.push(facData);

        return facId; 
    } catch (e) { return null; }
}

// === NUEVAS FUNCIONES PARA LA PANTALLA COMPLETA (SIN MODAL) ===
export function showNuevaFactura() {
    const sel = document.getElementById('nf-cliente');
    if (sel) {
        sel.innerHTML = '<option value="">Consumidor Final (Sin registrar)</option>' + 
            DATA.clientes.map(c => `<option value="${c.id}">${getFullName(c)} (DNI: ${c.dni || 'N/A'})</option>`).join('');
    }
    document.getElementById('nf-concepto').value = '';
    document.getElementById('nf-total').value = '';
    
    document.getElementById('fac-lista').style.display = 'none';
    document.getElementById('fac-nueva').style.display = 'block';
}

export function hideNuevaFactura() {
    document.getElementById('fac-nueva').style.display = 'none';
    document.getElementById('fac-lista').style.display = 'block';
}

export async function emitirFacturaManual() {
    const clienteId = document.getElementById('nf-cliente').value;
    let clienteNombre = 'Consumidor Final';
    let docCliente = 'C.F.';
    
    if (clienteId) {
        const c = DATA.clientes.find(x => x.id === clienteId);
        if (c) {
            clienteNombre = getFullName(c);
            docCliente = c.dni || 'C.F.';
        }
    }
    
    const tipo = document.getElementById('nf-tipo').value;
    const estadoPago = document.getElementById('nf-pago').value;
    const concepto = document.getElementById('nf-concepto').value.trim();
    const total = parseFloat(document.getElementById('nf-total').value);

    if (!concepto || isNaN(total) || total <= 0) {
        toast('Completá el concepto y un total válido mayor a 0');
        return;
    }

    const items = [{ desc: concepto, cant: 1, precio: total }];

    try {
        const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
        const now = new Date();
        const fDateStr = now.toISOString().split('T')[0];
        const hTimeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const logDate = fDate(fDateStr) + ' ' + hTimeStr;

        let nuevoNum = 1;
        const contadoresRef = window.db.collection('negocio').doc('contadores');
        await window.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(contadoresRef);
            if (doc.exists && doc.data().facturas) nuevoNum = doc.data().facturas + 1;
            transaction.set(contadoresRef, { facturas: nuevoNum }, { merge: true });
        });
        
        const prefix = tipo === 'Nota de Crédito' ? 'NC-' : 'FAC-';
        const facId = prefix + nuevoNum.toString().padStart(6, '0');

        const facData = {
            id: facId, fecha: fDateStr, hora: hTimeStr,
            cliente: clienteNombre, doc: docCliente, clienteId: clienteId || null,
            tipo: tipo, refModulo: 'Manual', refId: '—', refPago: '—',
            estado: 'Emitida', total: total, items: items, usuario: user, estadoPago: estadoPago,
            historial: [{ fecha: logDate, accion: 'Emisión Manual', detalle: `Emitido por ${user} desde panel de Facturación.` }]
        };

        await window.db.collection('facturas').doc(facId).set(facData);
        if(!DATA.facturas) DATA.facturas = [];
        DATA.facturas.push(facData);

        toast(`✅ ${tipo} emitido con éxito`);
        hideNuevaFactura(); // Cierra la pantalla y vuelve a la lista
        renderFacturasTable();

    } catch (e) { toast('❌ Error al emitir el comprobante'); }
}