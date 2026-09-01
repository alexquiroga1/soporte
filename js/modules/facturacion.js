// js/modules/facturacion.js
import { DATA } from '../core/store.js';
import { fmt, toast } from '../core/utils.js';
import { openModal, closeModal } from './ui.js';

let currentFacturaId = null;

export function renderFacturasTable() {
    const searchEl = document.getElementById('fac-search');
    const search = searchEl ? searchEl.value.toLowerCase() : '';
    const tbody = document.getElementById('facturacion-table-body');
    if(!tbody) return;

    const facturas = (DATA.ventas || []).filter(v => 
        !search || (v.folio||'').toLowerCase().includes(search) || (v.cliente||'').toLowerCase().includes(search)
    ).sort((a, b) => b.folio.localeCompare(a.folio));

    tbody.innerHTML = facturas.map(f => {
        const anulada = f.estado === 'Anulada';
        const badge = anulada ? '<span class="badge urg">Anulada</span>' : '<span class="badge done">Emitida</span>';
        return `<tr class="tbl-row" onclick="openFacturaModal('${f.id}')">
            <td class="mono">${f.folio}</td>
            <td class="mono">${f.hora || ''}</td>
            <td><b>${f.cliente}</b></td>
            <td class="mono" style="${anulada ? 'text-decoration: line-through; color:var(--muted);' : ''}">${fmt(f.total)}</td>
            <td>${badge}</td>
            <td><button class="btn btn-ghost btn-sm" onclick="event.stopPropagation(); openFacturaModal('${f.id}')">Ver Detalle</button></td>
        </tr>`;
    }).join('') || '<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--muted);">Sin facturas registradas.</td></tr>';
}

export function openFacturaModal(id) {
    currentFacturaId = id;
    const f = DATA.ventas.find(x => x.id === id);
    if(!f) return;

    document.getElementById('mf-folio').textContent = f.folio;
    document.getElementById('mf-cliente').textContent = f.cliente;
    document.getElementById('mf-fecha').textContent = f.hora || '';
    document.getElementById('mf-articulos').textContent = f.articulos;
    document.getElementById('mf-total').textContent = fmt(f.total);
    
    const btnAnular = document.getElementById('btn-anular-fac');
    if(f.estado === 'Anulada') {
        btnAnular.style.display = 'none';
        document.getElementById('mf-estado').innerHTML = '<span class="badge urg" style="font-size:12px;">Factura Anulada (Nota de Crédito)</span>';
    } else {
        btnAnular.style.display = 'block';
        document.getElementById('mf-estado').innerHTML = '<span class="badge done" style="font-size:12px;">Emitida y Cobrada</span>';
    }

    openModal('modal-factura');
}

export async function anularFactura() {
    const f = DATA.ventas.find(x => x.id === currentFacturaId);
    if(!f) return;

    const confirmacion = confirm(`¿Estás seguro de anular la factura ${f.folio}?\nEsto marcará el documento como anulado y registrará un egreso en la Caja Activa (Nota de Crédito).`);
    if(!confirmacion) return;

    try {
        const batch = window.db.batch();
        
        // Marcamos la venta como Anulada
        const fRef = window.db.collection('ventas').doc(f.id);
        batch.update(fRef, { estado: 'Anulada' });

        // Registramos la Nota de Crédito en la Caja Activa
        const mov = {
            id: window.db.collection('negocio').doc().id,
            hora: new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}),
            concepto: `Nota de Crédito FAC ${f.folio} (${f.cliente})`, 
            tipo: 'egreso', 
            monto: f.total, 
            subcategoria: 'Devolución'
        };
        
        const cajaRef = window.db.collection('negocio').doc('caja_activa');
        batch.update(cajaRef, {
            movs: window.firebase.firestore.FieldValue.arrayUnion(mov)
        });

        await batch.commit();
        
        closeModal('modal-factura');
        toast(`Factura ${f.folio} anulada con éxito`);
        if(window.renderAll) window.renderAll();
    } catch(e) {
        console.error("Error al anular", e);
        toast('Hubo un error al anular la factura.');
    }
}

export function imprimirFactura() {
    const f = DATA.ventas.find(x => x.id === currentFacturaId);
    if(!f) return;
    const neg = DATA.negocio?.nombre || 'EMPRESA';
    const win = window.open('', '', 'width=800,height=700');
    win.document.write(`
        <html><head><title>Factura ${f.folio}</title>
        <style>body{font-family: monospace; padding:40px; font-size:14px;} .center{text-align:center;} .divider{border-bottom:1px dashed #000; margin:15px 0;}</style></head>
        <body>
        <h2 class="center">${neg.toUpperCase()}</h2>
        <div class="center">Documento Comercial / Factura</div>
        <div class="divider"></div>
        <p><b>Folio:</b> ${f.folio}</p>
        <p><b>Fecha/Hora:</b> ${f.hora}</p>
        <p><b>Cliente:</b> ${f.cliente}</p>
        <p><b>Condición de Pago:</b> ${f.pago}</p>
        <div class="divider"></div>
        <p><b>Artículos y Servicios:</b><br><br>${f.articulos.replace(/, /g, '<br>')}</p>
        <div class="divider"></div>
        <h3 style="text-align:right;">Total: ${fmt(f.total)}</h3>
        ${f.estado === 'Anulada' ? '<br><h2 class="center" style="color:red; border:2px solid red; padding:10px;">DOCUMENTO ANULADO</h2>' : ''}
        <script>window.onload=function(){window.print();}</script>
        </body></html>
    `);
    win.document.close();
}