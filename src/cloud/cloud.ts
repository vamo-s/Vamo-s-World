import type { User } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

// Acceso a Firebase cargado a demanda: si no hay configuración, no se descarga nada.

export const cloudEnabled = () => firebaseConfig !== null;

export interface CloudUser { uid: string; name: string; email: string; photo?: string }

let ready: Promise<{ app: import('firebase/app').FirebaseApp; auth: import('firebase/auth').Auth; db: Firestore }> | null = null;

export function cloud() {
  if (!firebaseConfig) throw new Error('Firebase sin configurar');
  ready ??= (async () => {
    const [{ initializeApp }, { getAuth }, { initializeFirestore, persistentLocalCache }] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
    ]);
    const app = initializeApp(firebaseConfig!);
    const db = initializeFirestore(app, { localCache: persistentLocalCache() });
    return { app, auth: getAuth(app), db };
  })();
  return ready;
}

const toUser = (u: User): CloudUser => ({ uid: u.uid, name: u.displayName ?? 'Jugador', email: u.email ?? '', photo: u.photoURL ?? undefined });

export async function watchUser(cb: (u: CloudUser | null) => void): Promise<() => void> {
  const { auth } = await cloud();
  const { onAuthStateChanged } = await import('firebase/auth');
  return onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
}

export async function signInWithGoogle(): Promise<void> {
  const { auth } = await cloud();
  const { GoogleAuthProvider, signInWithPopup, signInWithRedirect } = await import('firebase/auth');
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') await signInWithRedirect(auth, provider);
    else if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') throw e;
  }
}

export async function signOutCloud(): Promise<void> {
  const { auth } = await cloud();
  const { signOut } = await import('firebase/auth');
  await signOut(auth);
}
