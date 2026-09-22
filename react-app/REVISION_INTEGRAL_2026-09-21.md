# Revisión integral SERVIX — 21/09/2026

Esta revisión parte de la versión donde ya se había corregido el módulo Productos.

## Correcciones aplicadas

### Inventario / referencias de productos
- Se agregó `src/services/product-reference.service.js` para resolver productos por `docId/productId` real de Firestore y mantener compatibilidad con registros legacy cuyo documento no coincide con el SKU.
- POS, Caja y reservas/liberaciones de Tickets/Presupuestos preservan y utilizan el `productId` real cuando está disponible.
- Caja ya no continúa silenciosamente si falta un producto de catálogo durante un cobro: aborta la operación para proteger la integridad del stock.
- Al cobrar un Ticket, la disponibilidad contempla la reserva propia del Ticket más el stock realmente libre, sin consumir reservas de otros Tickets.

### POS
- Se conectaron las promociones activas de Firestore al POS.
- El operador puede elegir una promoción activa o usar descuento manual; no se combinan ambos accidentalmente.
- Las promociones por monto fijo quedan limitadas al subtotal al que realmente aplican.
- El stock mostrado y el límite de carrito usan `stock - stockReservado`.
- El carrito temporal se guarda por UID de usuario y se migra el carrito legacy cuando corresponde.

### Caja
- Se recuperó la acción visible `Cerrar caja` para perfiles autorizados.
- Se agregó resumen de cierre y fondo inicial de la próxima sesión.
- Se agregó manejo explícito del error de producto inexistente al confirmar cobro.

### Tickets
- `Guardar borrador` ahora tiene restauración real.
- El borrador se guarda por UID, evitando que otro usuario de la misma PC lo herede.
- El borrador se elimina al crear el Ticket o limpiar el formulario.

### Facturación / permisos
- Presupuestos mantiene acceso para Tickets o Ventas.
- Facturas, Notas de Crédito, Rectificaciones, Anulaciones e Historial requieren permiso de Ventas, alineado con Firestore.

### Fechas
- Se agregó `src/utils/date.js` para fechas comerciales locales `YYYY-MM-DD`.
- Caja, Productos, Clientes y Créditos dejan de usar UTC para fechas comerciales.
- Las exportaciones CSV también usan fecha local en el nombre del archivo.
- Los timestamps técnicos continúan usando ISO/UTC deliberadamente.

### Firestore Rules
- Facturas: borrado físico deshabilitado.
- Ventas: borrado físico deshabilitado.
- Cortes de caja: solo creación; actualización/borrado deshabilitados.
- Cuenta corriente: borrado físico deshabilitado.
- Productos, Tickets y Presupuestos: borrado físico reservado al administrador.
- Créditos: borrado físico reservado al administrador.
- Presupuestos públicos: una lectura pública requiere token válido, enlace activo y no vencido. El borrado físico queda reservado al administrador.

## Validaciones realizadas
- Todos los archivos `.js` de `src/` pasan `node --check`.
- Los 27 archivos `.jsx` pasan validación sintáctica con TypeScript en modo de parseo/no-resolve.
- Todos los imports relativos apuntan a archivos existentes.
- Se verificó balance de llaves en `firestore.rules`, `POS.css` y `Caja.css`.
- Se revisó que no queden accesos directos peligrosos `productos/{sku}` en POS/Caja/reservas.

## Limitación de esta revisión
El ZIP recibido no traía `node_modules`. La instalación de dependencias no pudo completarse dentro del límite del entorno, por lo que no fue posible ejecutar un `npm run build` real con Vite ni el compilador oficial de reglas de Firebase aquí.

En tu PC, antes de publicar, ejecutar desde `react-app`:

```bash
npm install
npm run build
npm run lint
```

Y desplegar las reglas modificadas con tu Firebase CLI/configuración habitual, por ejemplo:

```bash
firebase deploy --only firestore:rules
```

## Cambios deliberadamente pendientes
No se eliminó código legacy ni se dividieron todavía componentes grandes como `TicketDetail.jsx`, `Clientes.jsx`, `Caja.jsx` o `POS.jsx`. Ese refactor conviene hacerlo en una etapa separada después de verificar estos flujos con tu Firestore real.
