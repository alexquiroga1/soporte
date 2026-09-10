PATCH SIN FIREBASE STORAGE

Objetivo:
- Mantener el proyecto sin activar Blaze ni facturación.
- No inicializar Firebase Storage en React.
- No intentar subir fotos.
- Mantener los tickets y el resto de la app funcionando.
- Mantener visibles las fotos antiguas que ya tengan URL en Firestore.
- Quitar Storage de firebase.json para que un deploy general no intente desplegarlo.

Instalación:
1. Extraer este ZIP sobre C:\Users\Alex\Desktop\soporte\react-app
2. Aceptar reemplazar archivos.
3. Ejecutar: npm run build
4. Si termina en ✓ built, ejecutar: npx firebase-tools deploy --only hosting

NO ejecutar:
  npx firebase-tools deploy --only storage

El archivo storage.rules viejo puede quedar en la carpeta; firebase.json ya no lo referencia.
