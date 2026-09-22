# SERVIX — Revisión integral, segunda pasada

Fecha: 2026-09-21

Esta versión parte de `soporte_revision_integral_corregido.zip` y agrega una segunda auditoría enfocada en integridad financiera, permisos, datos legacy, aislamiento entre usuarios y errores JSX.

## Correcciones funcionales y de integridad

- **Productos.jsx:** corregido un cierre `}}` duplicado en el botón **Limpiar** de la pestaña Movimientos. Era un error JSX capaz de impedir la compilación/renderizado del módulo.
- **SKU duplicados:** el catálogo detecta y marca visualmente SKU repetidos. También muestra la cantidad en el resumen operativo.
- **SKU ambiguo:** `product-reference.service.js` ya no elige arbitrariamente un documento cuando dos productos comparten SKU; lanza `PRODUCT_REFERENCE_AMBIGUOUS` y bloquea la operación.
- **ID Firestore:** en los mapeos de snapshots, el ID real del documento queda por encima de posibles campos `id` legacy almacenados dentro del documento.
- **Fechas comerciales:** eliminado el patrón UTC `toISOString().split("T")[0]` en servicios activos. Las fechas `YYYY-MM-DD` de operación usan fecha local.
- **Créditos:** cuotas distribuidas a centavos para que la suma sea exactamente igual al total financiado. Pagos, punitorios, capital y saldos se redondean a 2 decimales.
- **POS:** subtotal, descuento, base imponible, impuesto y total se redondean a centavos antes de persistirse/enviarse a Caja.
- **Caja:** los totales operativos y los importes principales se normalizan a centavos.
- **Importes en UI:** los formateadores monetarios principales permiten mostrar hasta 2 decimales sin obligar `,00`.

## Permisos y reglas Firestore

- **Productos:** Ventas ya no puede modificar libremente SKU, nombre, costo, precio, categoría ni otros metadatos. Solo puede modificar campos de stock requeridos por el cobro. El permiso Productos conserva la administración del catálogo.
- **UI Productos:** un usuario con solo Ventas puede consultar catálogo/stock/movimientos/promociones, pero las acciones de alta, edición, desactivar/reactivar, ingreso, ajuste y administración de promociones quedan reservadas a `Editar catálogo de productos`.
- **Promociones:** crear/editar promociones requiere permiso Productos; Ventas mantiene lectura para poder aplicarlas en POS.
- **Movimientos de stock:** Ventas solo puede crear salidas ligadas a una factura existente o movimientos Reserva/Liberación usados por Tickets/Presupuestos. El libro sigue siendo inmutable.
- **Ventas:** documentos históricos no pueden borrarse y las actualizaciones se limitan a campos de anulación/cancelación/estado.
- **Facturas:** eliminaciones físicas bloqueadas; actualizaciones limitadas a campos usados por pagos, rectificaciones, cancelaciones y notas de crédito.
- **Cuenta corriente:** convertida en append-only para usuarios normales.
- **Caja activa:** Ventas/Créditos solo pueden modificar `movs` y `actualizadoEn`; fondo y sesión quedan bajo permiso Caja.
- **Cortes de caja:** crear cortes requiere el permiso específico Caja; no se actualizan ni eliminan.
- **Clientes:** archivar/restaurar queda alineado entre UI y reglas; exige los permisos definidos por la aplicación.
- **Contadores:** Tickets y Ventas solo pueden tocar sus propios consecutivos; `nda` queda reservado a administrador.
- **Presupuestos públicos:** lectura pública bloqueada si el enlace está inactivo o vencido; borrado físico reservado al administrador.

## Aislamiento por usuario

- **Notificaciones Dashboard:** el estado “leída” en `localStorage` ahora se guarda por UID/email. Un usuario ya no hereda las notificaciones marcadas por otro usuario de la misma PC.
- En la pasada anterior ya se aplicó el mismo criterio al carrito POS y al borrador de Nuevo Ticket.

## Metadatos y accesibilidad

- `index.html` usa `lang="es-AR"`.
- Título actualizado a `SERVIX · Gestión de Soporte Técnico`.
- Agregada meta descripción de la aplicación.

## Código legacy detectado (conservado)

No se eliminó automáticamente código grande no utilizado para evitar borrar flujos que quieras recuperar:

- `src/pages/Tickets/NewTicketModal.jsx`
- `src/pages/Facturacion/Presupuestos-manual.jsx`

También siguen existiendo algunas exportaciones de servicios sin consumidores actuales. Conviene limpiarlas en una etapa separada, después de probar esta versión.

## Validaciones realizadas

- Todos los archivos `src/**/*.js`: **OK** con `node --check`.
- Todos los archivos `src/**/*.jsx`: **OK** al parsear con TypeScript (`--jsx preserve --noResolve`).
- Imports relativos `.js/.jsx/.css`: **OK**, no se detectaron rutas locales inexistentes.
- `firestore.rules`: balance estructural de llaves **OK**.
- Búsqueda de fechas comerciales UTC (`toISOString().split("T")[0]`): **0 coincidencias**.
- Búsqueda de mapeos `{ id: snapshot.id, ...data }`: **0 coincidencias**.
- Búsqueda de accesos directos peligrosos `productos/{sku}`: **0 coincidencias**.
- `node_modules` no se incluye en el paquete.

## Limitación de validación

No fue posible completar `npm ci`/`npm install` en el entorno, por lo que no se ejecutó un `vite build` real ni el linter del proyecto. La sintaxis JS/JSX sí fue validada como se describe arriba.

## Antes de publicar

En una PC con dependencias disponibles:

```bash
npm install
npm run build
npm run lint
```

Como se modificó `firestore.rules`, publicar también las reglas:

```bash
firebase deploy --only firestore:rules
```

Conviene probar al menos estos perfiles por separado:

1. Administrador.
2. Solo Tickets.
3. Solo Ventas.
4. Solo Productos.
5. Solo Créditos.
6. Solo Caja.
7. Ventas + Caja.

Y ejecutar el flujo: Producto -> Presupuesto/Ticket -> reserva -> POS/Caja -> Factura -> anulación/nota de crédito -> stock/cuenta corriente.
