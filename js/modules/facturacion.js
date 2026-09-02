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
            : (f.estado === 'Cancelada' ? `<span class="badge" style="background:var(--muted); color:#fff;">⚪ CANCELADA</span>` 
            : `<span class="badge" style="background:var(--red-dim); color:var(--red);">🔴 ANULADA</span>`);
            
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
    const btnAnular = document.getElementById('btn-fd-anular'); // Reutilizado para botones dinámicos
    
    let actionsHtml = '';

    if (f.estado === 'Emitida' && f.tipo === 'Factura') {
        badgeEl.innerHTML = `<span class="badge" style="background:var(--teal-dim); color:var(--teal);">🟢 EMITIDA</span>`;
        
        if (f.estadoPago === 'Pendiente') {
            actionsHtml = `<button class="btn btn-ghost" style="color:var(--muted); border-color:var(--line);" onclick="cancelarFacturaActual()">⚪ Cancelar (Sin Pago)</button>`;
        } else {
            actionsHtml = `<button class="btn btn-ghost" style="color:var(--red); border-color:var(--red);" onclick="anularFacturaActual()">🔴 Anular y Devolver a Saldo</button>`;
        }
        actionsHtml += `<button class="btn btn-ghost" style="color:var(--amber); border-color:var(--amber); margin-left:8px;" onclick="rectificarFacturaActual()">📝 Rectificar</button>`;
        
    } else if (f.tipo === 'Nota de Crédito') {
        badgeEl.innerHTML = `<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🟣 NC APLICADA</span>`;
    } else if (f.estado === 'Cancelada') {
        badgeEl.innerHTML = `<span class="badge" style="background:var(--muted); color:#fff;">⚪ CANCELADA</span>`;
    } else {
        badgeEl.innerHTML = `<span class="badge" style="background:var(--red-dim); color:var(--red);">🔴 ANULADA</span>`;
    }

    // Inyectar botones dinámicos en la vista (remplazar el viejo botón de anular)
    const actionContainer = document.getElementById('btn-fd-anular').parentElement;
    // Mantenemos solo Imprimir y Volver, y agregamos las nuevas acciones
    actionContainer.innerHTML = actionsHtml + `
      <button class="btn btn-primary" style="margin-left:8px;" onclick="window.print()">🖨️ Imprimir / PDF</button>
      <button class="btn btn-ghost" onclick="goView('facturacion')">← Volver</button>
    `;

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

// 1. ANULAR Y DEVOLVER A SALDO (Facturas Pagadas)
export async function anularFacturaActual() {
    if (!currentFacturaId) return;
    const original = DATA.facturas.find(x => x.id === currentFacturaId);
    if (!original || original.estado !== 'Emitida') return;

    if (!confirm(`¿Estás seguro de ANULAR el comprobante ${original.id}?\nSe generará una Nota de Crédito por ${fmt(original.total)} y ese dinero quedará a favor en la cuenta del cliente.`)) return;

    try {
        const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
        const now = new Date();
        const fDateStr = now.toISOString().split('T')[0];
        const hTimeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
        const logDate = fDate(fDateStr) + ' ' + hTimeStr;

        const batch = window.db.batch();

        // Actualizar factura original
        const facRef = window.db.collection('facturas').doc(original.id);
        batch.update(facRef, {
            estado: 'Anulada',
            historial: window.firebase.firestore.FieldValue.arrayUnion({ fecha: logDate, accion: 'Comprobante Anulado', detalle: `NC y Devolución a Saldo de Cliente. Usuario: ${user}` })
        });
        original.estado = 'Anulada';

        // Generar Nota de Crédito
        let nuevoNum = 1;
        const contadoresRef = window.db.collection('negocio').doc('contadores');
        const countDoc = await contadoresRef.get();
        if (countDoc.exists && countDoc.data().nc) nuevoNum = countDoc.data().nc + 1;
        batch.set(contadoresRef, { nc: nuevoNum }, { merge: true });
        
        const ncId = 'NC-' + nuevoNum.toString().padStart(4, '0');
        const ncData = {
            id: ncId, fecha: fDateStr, hora: hTimeStr,
            cliente: original.cliente, doc: original.doc, clienteId: original.clienteId,
            tipo: 'Nota de Crédito', refModulo: 'Factura', refId: original.id, refPago: original.refPago,
            estado: 'Emitida', total: original.total, items: original.items, usuario: user, estadoPago: 'Aplicada',
            historial: [{ fecha: logDate, accion: 'Emisión NC', detalle: `Anula comprobante ${original.id}. Acreditado a Saldo. Usuario: ${user}` }]
        };
        const ncRef = window.db.collection('facturas').doc(ncId);
        batch.set(ncRef, ncData);
        
        // Sumar al Saldo a Favor del Cliente
        if (original.clienteId) {
            const cliRef = window.db.collection('clientes').doc(original.clienteId);
            batch.update(cliRef, {
                saldoAFavor: window.firebase.firestore.FieldValue.increment(original.total)
            });
        }

        await batch.commit();

        if(!DATA.facturas) DATA.facturas = [];
        DATA.facturas.push(ncData);

        toast(`✅ Anulación exitosa y devolución agregada al cliente`);
        openFacturaDetalle(original.id); 
        
    } catch (e) { console.error(e); toast("❌ Error al procesar anulación"); }
}

// 2. CANCELAR (Facturas Pendientes, no mueve plata)
window.cancelarFacturaActual = async function() {
    if (!currentFacturaId) return;
    const original = DATA.facturas.find(x => x.id === currentFacturaId);
    if (!original || original.estado !== 'Emitida' || original.estadoPago === 'Pagado Total') return;

    if (!confirm(`¿Cancelar comprobante ${original.id}?\nAl estar pendiente de pago, no se moverá dinero en caja.`)) return;

    try {
        const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
        const logDate = fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        await window.db.collection('facturas').doc(original.id).update({
            estado: 'Cancelada',
            historial: window.firebase.firestore.FieldValue.arrayUnion({ fecha: logDate, accion: 'Cancelado', detalle: `Operación cancelada sin movimientos. Usuario: ${user}` })
        });
        original.estado = 'Cancelada';
        toast(`✅ Factura cancelada`);
        openFacturaDetalle(original.id);
    } catch(e) { toast("❌ Error al cancelar"); }
}

// 3. RECTIFICAR (Agregar notas/correcciones formales)
window.rectificarFacturaActual = async function() {
    if (!currentFacturaId) return;
    const original = DATA.facturas.find(x => x.id === currentFacturaId);
    
    const obs = prompt(`Ingresa la observación para rectificar el comprobante ${original.id} (Ej. Corrección de DNI o Dirección):`);
    if(!obs || obs.trim() === '') return;

    try {
        const user = currentUserProfile ? currentUserProfile.nombre : 'Sistema';
        const logDate = fDate(new Date().toISOString().split('T')[0]) + ' ' + new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

        await window.db.collection('facturas').doc(original.id).update({
            historial: window.firebase.firestore.FieldValue.arrayUnion({ fecha: logDate, accion: 'Rectificación', detalle: `Nota: ${obs.trim()} - Usuario: ${user}` })
        });
        
        if(!original.historial) original.historial = [];
        original.historial.push({ fecha: logDate, accion: 'Rectificación', detalle: `Nota: ${obs.trim()} - Usuario: ${user}` });
        
        toast(`✅ Rectificación agregada`);
        openFacturaDetalle(original.id);
    } catch(e) { toast("❌ Error al rectificar"); }
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
        hideNuevaFactura();
        renderFacturasTable();

    } catch (e) { toast('❌ Error al emitir el comprobante'); }
}