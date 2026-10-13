import type { FirebaseOptions } from 'firebase/app';

/**
 * Configuración web de Firebase (login con Google + Firestore). Es pública por diseño:
 * lo que protege los datos son las reglas de Firestore (ver HANDOFF.md).
 * Mientras sea null, la app funciona como siempre: solo en este dispositivo.
 */
export const firebaseConfig: FirebaseOptions | null = null;
