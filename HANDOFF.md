# Handoff

Estado (2026-10-13): Hito 0 completo. Esquema v3 (plano en centímetros). Hecho y probado: inventario, mantenimiento, economía, misiones/XP, festividades, modo construcción (habitaciones, puertas, ventanas, muebles a medida, boceto de fondo), proyecto DEMO "Cambiar una puerta". Login con Google y casa por usuario: código listo, desactivado hasta tener la config de Firebase.

Para retomar:
```bash
npm install && npm test && npm run dev
```

## Activar cuentas (Firebase)
1. En la consola de Firebase: Authentication → Google activado; dominio autorizado `vamo-s.github.io`; Firestore en `southamerica-east1`, modo producción; registrar app web.
2. Reglas de Firestore:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
3. Pegar el objeto `firebaseConfig` en `src/cloud/config.ts` (es público; lo que protege son las reglas). PR, merge, y Actions publica.
4. Probar en el teléfono: Perfil → Entrar con Google → cargar algo → abrir en otro dispositivo con la misma cuenta.

## Próximo paso
1. Activar cuentas (arriba) y probar sincronización real en dos dispositivos.
2. Vamo's Pets local (ROADMAP.md, Hito 1).
