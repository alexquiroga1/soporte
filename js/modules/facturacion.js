// js/modules/facturacion.js
import { DATA } from '../core/store.js';
import { fmt, fDate, toast } from '../core/utils.js';
import { currentUserProfile } from '../core/auth.js';
import { goView } from './ui.js';

let currentFacturaId = null;

// =====================================
// RENDERIZAR TABLA PRINCIPAL
// =====================================
export function renderFacturasTable() {
    if (!DATA.facturas) DATA.facturas = [];
    const tbody = document.getElementById('facturacion-table-body');
    if (!tbody) return;

    const q = (document.getElementById('fac-search')?.value || '').toLowerCase();
    const fTipo = document.getElementById('fac-filter-tipo')?.value;
    const fEst = document.getElementById('fac-filter-estado')?.value;

    let match = DATA.facturas.filter(f => {
        const passQ = !q || f.cliente.toLowerCase().includes(q) || f.doc.includes(q) || f.refId.toLowerCase().includes(q) || f.id.toLowerCase().includes(q);
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
          <td><button class="btn btn-ghost btn-sm" onclick="openFacturaDetalle('${f.id}')">👁️ Ver</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--muted);">No hay comprobantes con estos filtros.</td></tr>';
}

// =====================================
// ABRIR VISTA DETALLE DE COMPROBANTE
// =====================================
export function openFacturaDetalle(id) {
    const f = DATA.facturas.find(x => x.id === id);
    if (!f) return;
    currentFacturaId = id;

    document.getElementById('fd-id').textContent = f.id;
    document.getElementById('fd-fecha').textContent = `Fecha de emisión: ${fDate(f.fecha)} · ${f.hora} hs`;
    
    // Badge y Anulación
    const badgeEl = document.getElementById('fd-badge-estado');
    const btnAnular = document.getElementById('btn-fd-anular');
    if (f.estado === 'Emitida' && f.tipo === 'Factura') {
        badgeEl.innerHTML = `<span class="badge" style="background:var(--teal-dim); color:var(--teal);">🟢 EMITIDA</span>`;
        btnAnular.style.display = 'inline-flex';
    } else if (f.tipo === 'Nota de Crédito') {
        badgeEl.innerHTML = `<span class="badge" style="background:#e3f2fd; color:#0d47a1;">🟣 NOTA DE CRÉDITO</span>`;
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
        <td>${i.desc}</td><td class="mono">${i.cant}</td><td class="mono">${fmt(i.precio)}</td><td class="mono" style="text-align:right; font-weight:bold;">${fmt(i.cant * i.precio)}</td>
    </tr>`).join('');
    document.getElementById('fd-items').innerHTML = itemsHtml || '<tr><td colspan="4" style="text-align:center;">Sin conceptos</td></tr>';

    let totalStr = f.tipo === 'Nota de Crédito' ? `-${fmt(f.total)}` : fmt(f.total);
    document.getElementById('fd-total').textContent = totalStr;

    // Historial
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

// =====================================
// CREAR NOTA DE CRÉDITO (ANULAR)
// =====================================
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

        // 1. Marcar original como anulada
        await window.db.collection('facturas').doc(original.id).update({
            estado: 'Anulada',
            historial: window.firebase.firestore.FieldValue.arrayUnion({ fecha: logDate, accion: 'Comprobante Anulado', detalle: `Se generó Nota de Crédito. Usuario: ${user}` })
        });
        original.estado = 'Anulada';

        // 2. Generar el nuevo ID de la NC
        let nuevoNum = 1;
        const contadoresRef = window.db.collection('negocio').doc('contadores');
        await window.db.runTransaction(async (transaction) => {
            const doc = await transaction.get(contadoresRef);
            if (doc.exists && doc.data().nc) nuevoNum = doc.data().nc + 1;
            transaction.set(contadoresRef, { nc: nuevoNum }, { merge: true });
        });
        const ncId = 'NC-' + nuevoNum.toString().padStart(4, '0');

        // 3. Crear la Nota de Crédito
        const ncData = {
            id: ncId,
            fecha: fDateStr, hora: hTimeStr,
            cliente: original.cliente, doc: original.doc, clienteId: original.clienteId,
            tipo: 'Nota de Crédito', refModulo: 'Factura', refId: original.id, refPago: original.refPago,
            estado: 'Emitida', total: original.total, items: original.items, usuario: user, estadoPago: 'Aplicada',
            historial: [{ fecha: logDate, accion: 'Emisión NC', detalle: `Anula comprobante ${original.id}. Usuario: ${user}` }]
        };
        await window.db.collection('facturas').doc(ncId).set(ncData);
        if(!DATA.facturas) DATA.facturas = [];
        DATA.facturas.push(ncData);

        // 4. (Opcional Futuro) Devolver saldo a la cuenta corriente del cliente en CRM
        // Si tiene clienteId, podríamos ir a su perfil y sumarle saldo. Por ahora lo dejamos listo.

        toast(`✅ Nota de Crédito ${ncId} generada exitosamente`);
        openFacturaDetalle(original.id); // Recargar la vista actual para ver el badge rojo
        
    } catch (e) {
        console.error(e);
        toast("❌ Error al procesar anulación");
    }
}

// =====================================
// GENERAR FACTURA AUTOMÁTICA (Desde Caja)
// =====================================
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

        // Buscar DOC (DNI) del cliente si existe en BD
        let docCliente = 'C.F.';
        if(clienteId) {
            const cli = DATA.clientes.find(c => c.id === clienteId);
            if(cli && cli.dni) docCliente = cli.dni;
        }

        const facData = {
            id: facId, fecha: fDateStr, hora: hTimeStr,
            cliente: clienteNombre, doc: docCliente, clienteId: clienteId,
            tipo: 'Factura', refModulo: origen, refId: refId, refPago: refPago,
            estado: 'Emitida', total: total, items: items, usuario: user, estadoPago: estadoPago,
            historial: [{ fecha: logDate, accion: 'Emisión de Comprobante', detalle: `Emitido exitosamente. Origen: ${origen}. Usuario: ${user}` }]
        };

        await window.db.collection('facturas').doc(facId).set(facData);
        if(!DATA.facturas) DATA.facturas = [];
        DATA.facturas.push(facData);

        return facId; // Retorna el ID para que la Caja sepa qué comprobante generó
    } catch (e) {
        console.error("Error emitiendo factura interna", e);
        return null;
    }
}