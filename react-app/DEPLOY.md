# Cierre React + Firebase — orden seguro de despliegue

> IMPORTANTE: la app React usa el mismo proyecto Firebase que la versión Vanilla. No publiques las reglas estrictas antes de migrar al menos tu cuenta Administrador al documento `usuarios/{uid}`.

## 1. Reemplazar archivos y probar build local

Desde:

```powershell
cd C:\Users\Alex\Desktop\soporte\react-app
npm install
npm run build
npm run dev
```

El build debe terminar con `✓ built in ...`.

## 2. Iniciar sesión como Administrador ANTES de cambiar reglas

Con las reglas actuales todavía publicadas:

1. Abrí la app React local.
2. Iniciá sesión con tu cuenta Administrador.
3. El nuevo `AuthContext` buscará primero `usuarios/{uid}`.
4. Si tu perfil todavía tiene un ID antiguo, lo migrará al UID real de Firebase Authentication.
5. Entrá a **Configuración → Usuarios internos** y verificá que tu cuenta figure **Vinculado**.

Si existen otros usuarios antiguos que ya usan el sistema, cada uno debe iniciar sesión una vez antes de publicar las reglas estrictas. Los usuarios nuevos creados desde esta versión ya nacen vinculados por UID.

## 3. Probar permisos localmente

Como Administrador comprobá:

- Dashboard abre normalmente.
- Tickets, Clientes, Caja y Facturación siguen funcionando.
- Configuración abre y lista usuarios/roles.
- Crear un usuario nuevo pide contraseña temporal y crea Authentication + perfil Firestore.
- El enlace público `/presupuesto/:token` sigue abriendo sin login.

## 4. Publicar primero SOLO Hosting

El `firebase.json` incluido usa `dist` y agrega el rewrite SPA a `/index.html`.

Si todavía no elegiste el proyecto en esta carpeta:

```powershell
firebase login
firebase projects:list
firebase use --add
```

Después:

```powershell
npm run build
firebase deploy --only hosting
```

Probá en Hosting:

- `/login`
- `/dashboard`
- `/tickets`
- una URL real `/presupuesto/TOKEN`
- F5 dentro de una ruta interna y dentro del presupuesto público

## 5. Publicar reglas Firestore

Solo después de confirmar que tu Administrador está vinculado por UID:

```powershell
firebase deploy --only firestore:rules
```

Volvé a probar login, Tickets, Caja, Facturación y Configuración.

## 6. Publicar reglas Storage

Cuando Firestore ya funciona con las reglas nuevas:

```powershell
firebase deploy --only storage
```

Probá crear un ticket con fotografía y agregar una foto a un ticket existente.

## 7. Commit final

```powershell
git add .
git commit -m "feat: finaliza seguridad permisos y deploy React"
git push origin migracion-react
```

Cuando todo esté validado en Hosting, recién ahí decidí el merge de `migracion-react` hacia `main`.
