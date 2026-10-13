import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { IndexedDbRepository, type StateRepository } from '../persistence/repository';
import { CloudRepository, type SyncStatus } from './CloudRepository';
import { cloudEnabled, signInWithGoogle, signOutCloud, watchUser, type CloudUser } from './cloud';

// Cuenta del jugador. Sin sesión: la casa vive solo en este dispositivo (invitado).
// Con Google: cada usuario tiene su propia casa, guardada en la nube y en el dispositivo.

interface Account {
  enabled: boolean;
  user: CloudUser | null;
  sync: SyncStatus | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Account>({ enabled: false, user: null, sync: null, signIn: async () => {}, signOut: async () => {} });
export const useAccount = () => useContext(Ctx);

const guestRepo = new IndexedDbRepository();

export function AccountProvider({ children }: { children: (repo: StateRepository, key: string) => ReactNode }) {
  const enabled = cloudEnabled();
  const [user, setUser] = useState<CloudUser | null | undefined>(enabled ? undefined : null);
  const [sync, setSync] = useState<SyncStatus | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let stop: (() => void) | undefined;
    watchUser(setUser).then((s) => { stop = s; }).catch(() => setUser(null));
    return () => stop?.();
  }, [enabled]);

  const repo = useMemo<StateRepository>(() => (user ? new CloudRepository(user.uid, guestRepo) : guestRepo), [user?.uid]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (repo instanceof CloudRepository) return repo.onStatus(setSync);
    setSync(null);
  }, [repo]);

  if (user === undefined) return <div className="loading">Conectando tu cuenta…</div>;
  const value: Account = {
    enabled, user, sync,
    signIn: signInWithGoogle,
    signOut: async () => { if (repo instanceof CloudRepository) await repo.flush(); await signOutCloud(); },
  };
  return <Ctx.Provider value={value}>{children(repo, user?.uid ?? 'invitado')}</Ctx.Provider>;
}
