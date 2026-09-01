// js/modules/productos.js
import { DATA } from '../core/store.js';
import { fmt, fmtK, toast, fDate, addDays } from '../core/utils.js';
import { openModal, closeModal } from './ui.js';

const CATEGORIAS = ['Todos','Componentes','Perifericos','Accesorios','Insumos','Servicios'];
let productoFiltro = 'Todos';
let currentEditProductSku = null;

export function renderProductosTabs(){
  document.getElementById('productos-tabs').innerHTML = CATEGORIAS.map(cat=>`<div class="tab ${cat===productoFiltro?'active':''}" onclick="setProductoFiltro('${cat}')">${cat}</div>`).join('');
}

export function setProductoFiltro(cat){ 
  productoFiltro = cat; 
  renderProductosTabs(); 
  renderProductosTable(); 
}

export function renderProductosTable(){
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
  
  const kpis = document.getElementById('productos-kpis');
  if(kpis) {
      kpis.innerHTML = `
        <div class="kpi c-copper"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8l-9-5-9 5 9 5 9-5z"/></svg></div><div class="label">SKU en catálogo</div><div class="value">${skus}</div><div class="delta flat">Activos</div></div>
        <div class="kpi c-teal"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2v20M2 12h20"/></svg></div><div class="label">Valor de inventario</div><div class="value">${fmtK(valorInv)}</div><div class="delta up">Costo de reposición</div></div>
        <div class="kpi c-amber"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg></div><div class="label">Stock bajo</div><div class="value">${stockBajo}</div><div class="delta down">Reabastecer pronto</div></div>
        <div class="kpi c-red"><div class="icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></div><div class="label">Agotados</div><div class="value">${agotados}</div><div class="delta down">Sin existencias</div></div>`;
  }
  const meta = document.getElementById('productos-meta');
  if(meta) meta.textContent = skus + ' SKU EN CATÁLOGO';
}

// NUEVO: Creación Atómica de Producto
export async function createProducto(){
  const nombre = document.getElementById('np-nombre').value.trim();
  const sku = document.getElementById('np-sku').value.trim() || ('SKU-'+Math.floor(Math.random()*9000+1000));
  const precio = parseFloat(document.getElementById('np-precio').value) || 0;
  const stock = parseInt(document.getElementById('np-stock').value) || 0;
  if(!nombre){ toast('Ingresa un nombre de producto'); return; }
  
  const nuevoProd = {
    id: sku, // Usamos el SKU como ID en Firebase para búsquedas directas
    sku, nombre, categoria: document.getElementById('np-categoria').value, 
    precio, stock, stockMax: Math.max(stock, 10), proveedor: '—', vendidos: 0
  };

  try {
    await window.db.collection('productos').doc(sku).set(nuevoProd);
    ['np-nombre','np-sku','np-precio','np-stock'].forEach(i=>document.getElementById(i).value='');
    closeModal('modal-nuevo-producto');
    if(window.renderPOSProducts) window.renderPOSProducts();
    toast('Producto agregado al catálogo');
  } catch (error) {
    console.error("Error al crear producto:", error);
    toast('No se pudo guardar el producto en la nube.');
  }
}

export function editProducto(sku) {
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

// NUEVO: Edición Atómica
export async function saveEditProducto() {
    if(!currentEditProductSku) return;
    const p = DATA.productos.find(x => x.sku === currentEditProductSku);
    if(!p) return;
    
    const nombre = document.getElementById('ep-nombre').value.trim();
    const precio = parseFloat(document.getElementById('ep-precio').value) || 0;
    const stock = parseInt(document.getElementById('ep-stock').value) || 0;
    const categoria = document.getElementById('ep-categoria').value;
    
    if(!nombre) { toast('El nombre no puede estar vacío'); return; }
    
    try {
      await window.db.collection('productos').doc(currentEditProductSku).update({
        nombre, precio, stock,
        stockMax: Math.max(stock, (p.stockMax || 10)),
        categoria
      });
      closeModal('modal-editar-producto');
      if(window.renderPOSProducts) window.renderPOSProducts();
      toast('Producto actualizado con éxito');
    } catch(error) {
      console.error("Error actualizando producto:", error);
      toast('Error al actualizar.');
    }
}

// NUEVO: Eliminación con Confirmación Real (Punto 18) y Atómica
export async function eliminarProducto(sku) {
    const p = DATA.productos.find(x => x.sku === sku);
    if(!p) return;

    const confirma = confirm(`¿Estás seguro de que deseas eliminar el producto "${p.nombre}"?\nEsta acción es irreversible y borrará el artículo del catálogo.`);
    if (confirma) {
        try {
            await window.db.collection('productos').doc(sku).delete();
            if(window.renderPOSProducts) window.renderPOSProducts();
            toast('Producto eliminado permanentemente');
        } catch(error) {
            console.error("Error eliminando:", error);
            toast("No se pudo eliminar el producto.");
        }
    }
}

export function renderPromocionesTable() {
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
      <td><button class="btn btn-ghost btn-sm" onclick="togglePromocion('${p.id}')">${p.activa ? 'Desactivar' : 'Activar'}</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--muted);">No hay promociones configuradas.</td></tr>';
}

// NUEVO: Toggle Atómico por ID en vez de index
export async function togglePromocion(promoId) {
  const p = DATA.promociones.find(x => x.id === promoId);
  if(!p) return;
  
  try {
    await window.db.collection('promociones').doc(promoId).update({
      activa: !p.activa
    });
    if(window.populatePOSPromos) window.populatePOSPromos(); 
    if(window.renderCart) window.renderCart(); 
    toast(p.activa ? 'Promoción desactivada' : 'Promoción activada');
  } catch (error) {
    console.error("Error", error);
    toast("No se pudo cambiar el estado de la promo.");
  }
}

// NUEVO: Creación de Promo Atómica
export async function createPromocion() {
  const nombre = document.getElementById('npr-nombre').value.trim();
  const tipo = document.getElementById('npr-tipo').value;
  const valor = parseFloat(document.getElementById('npr-valor').value);
  let vence = document.getElementById('npr-vence').value;
  const aplicaA = document.getElementById('npr-aplica').value;

  if(!nombre || !valor || valor <= 0) { toast('Completa el nombre y un valor válido'); return; }
  if(!vence) vence = addDays(30); 

  const id = 'PRM-' + Date.now().toString().slice(-4);
  
  try {
    await window.db.collection('promociones').doc(id).set({
      id, nombre, tipo, valor, aplicaA, vence, activa: true
    });
    
    ['npr-nombre','npr-valor','npr-vence'].forEach(i=>document.getElementById(i).value='');
    closeModal('modal-nueva-promocion');
    
    if(window.populatePOSPromos) window.populatePOSPromos(); 
    toast('Promoción creada con éxito');
  } catch(error) {
    console.error("Error:", error);
    toast("No se pudo guardar la promoción.");
  }
}