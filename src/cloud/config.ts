import type { FirebaseOptions } from 'firebase/app';

/**
 * Configuración web de Firebase (login con Google + Firestore). Es pública por diseño:
 * lo que protege los datos son las reglas de Firestore (ver HANDOFF.md).
 * Si fuera null, la app funciona solo en el dispositivo. Sin Analytics a propósito (privacidad).
 */
export const firebaseConfig: FirebaseOptions | null = {
  apiKey: 'AIzaSyDnVjVpvibV5mIXrEx5LLYGhyD8m09qhNo',
  authDomain: 'vamo-shouse.firebaseapp.com',
  projectId: 'vamo-shouse',
  storageBucket: 'vamo-shouse.firebasestorage.app',
  messagingSenderId: '270836778382',
  appId: '1:270836778382:web:0ad071a4893b5eae8d50df',
};
