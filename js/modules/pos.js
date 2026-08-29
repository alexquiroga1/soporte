// js/modules/pos.js
import { DATA, saveToLocal } from '../core/store.js';
import { fmt, toast, getFullName } from '../core/utils.js';

let cart = [];
export let payMethod = 'Efectivo';
const PAY_OPTIONS = ['Efectivo','Tarjeta','Transferencia','Préstamo personal'];
let nextVenta = 1043;

export function renderPayMethods(){
  document.getElementById('pay-methods').innerHTML = PAY_OPTIONS.map(m=>`<div class="pay-btn ${m===payMethod?'active':''}" onclick="setPayMethod('${m}')">${m}</div>`).join('');
}

export function setPayMethod(m){ payMethod = m; renderPayMethods(); }

export function populatePOSPromos() {
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

export function renderPOSProducts(){
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

export function addToCart(sku){
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

export function changeQty(sku, delta){
  const item = cart.find(c=>c.sku===sku);
  if(!item) return;
  const p = DATA.productos.find(x=>x.sku===sku);
  item.cantidad += delta;
  if(item.cantidad<=0){ cart = cart.filter(c=>c.sku!==sku); }
  else if(p.categoria!=='Servicios' && item.cantidad>p.stock){ item.cantidad = p.stock; toast('Sin más stock disponible'); }
  renderCart();
}

export function removeFromCart(sku){ cart = cart.filter(c=>c.sku!==sku); renderCart(); }

export function renderCart(){
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

export function checkout(){
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
    origen: 'Venta', ref: folio, clienteId: clienteObj ? clienteObj.id : null,
    cliente: clienteNombre,
    concepto: cart.map(c => `${c.cantidad}x ${c.nombre}`).join(', ') + descuentoTexto,
    total: total, articulosCart: [...cart]
  });

  saveToLocal();
  cart = [];
  document.getElementById('pos-promo').value = ''; 
  renderCart();
  
  // Disparamos actualizaciones en otros módulos
  if(window.renderCajaView) window.renderCajaView();
  toast('Venta ' + folio + ' enviada a Caja para su cobro');
}

export function renderVentasHistorial(){
  document.getElementById('ventas-historial-body').innerHTML = DATA.ventas.map(v=>{
    const badgeClass = v.pago==='Efectivo'?'done':v.pago==='Tarjeta'?'prog':v.pago==='Préstamo personal'?'wait':'pend';
    return `<tr class="tbl-row"><td class="mono">${v.folio}</td><td>${v.cliente}</td><td>${v.articulos}</td><td><span class="badge ${badgeClass}">${v.pago}</span></td><td class="mono">${fmt(v.total)}</td><td class="mono">${v.hora}</td></tr>`;
  }).join('');
  document.getElementById('ventas-meta').textContent = DATA.ventas.length + ' TRANSACCIONES HOY';
}