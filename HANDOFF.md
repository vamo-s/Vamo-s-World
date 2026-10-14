# Handoff

Estado (2026-10-13): Hito 0 completo. Esquema v3 (plano en centímetros). Hecho y probado: inventario, mantenimiento, economía, misiones/XP, festividades, modo construcción (habitaciones, puertas, ventanas, muebles a medida, boceto de fondo), proyecto DEMO "Cambiar una puerta", plano desde una foto con IA (Gemini vía Firebase AI Logic). Login con Google y casa por usuario: activo con el proyecto Firebase `vamo-shouse` (falta probarlo en un teléfono real).

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

## Activar la IA (plano desde una foto)
Consola de Firebase → proyecto `vamo-shouse` → IA → AI Logic → Comenzar → Gemini Developer API. Sin eso, la app muestra "La IA todavía no está activada". La e2e simula la respuesta de Gemini; la prueba real es con una foto en el teléfono.

## Próximo paso
1. Activar cuentas (arriba) y probar sincronización real en dos dispositivos.
2. Vamo's Pets local (ROADMAP.md, Hito 1).
