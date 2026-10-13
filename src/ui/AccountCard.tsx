import { useState } from 'react';
import { useAccount } from '../cloud/account';
import { level, totalXP } from '../domain/progress';
import { useStore } from '../state/store';

const SYNC: Record<string, string> = {
  sincronizado: '☁️ Guardado en tu cuenta', pendiente: '⏳ Cambios por subir', subiendo: '⏫ Subiendo…',
  'sin-conexion': '📴 Sin conexión: se sube cuando vuelva', error: '⚠️ No se pudo subir. Se reintenta con el próximo cambio.',
};

/** Cuenta + personaje: nivel, XP y dónde se guarda la partida. */
export function AccountCard() {
  const { enabled, user, sync, signIn, signOut } = useAccount();
  const { state, notify, ask } = useStore();
  const [busy, setBusy] = useState(false);
  const xp = totalXP(state);
  const lv = level(xp);
  const go = async (fn: () => Promise<void>) => {
    setBusy(true);
    try { await fn(); } catch { notify('No se pudo conectar con Google. Probá de nuevo.'); } finally { setBusy(false); }
  };
  return (
    <section className="card account">
      <div className="account-row">
        {user?.photo ? <img src={user.photo} alt="" className="account-pic" referrerPolicy="no-referrer" /> : <span className="account-pic" aria-hidden>🧑</span>}
        <div className="grow">
          <strong>{state.player?.alias ?? 'Jugador'}</strong> <span className="badge">Nivel {lv.level}</span>
          <span className="bar" aria-hidden><span style={{ width: `${lv.into}%` }} /></span>
          <small className="muted">{xp} XP · {user ? user.email : 'Invitado en este dispositivo'}</small>
        </div>
      </div>
      {!enabled ? (
        <p className="fine">Iniciar sesión con Google se activa cuando se cargue la configuración de Firebase. Mientras tanto, tu partida queda en este dispositivo.</p>
      ) : user ? (
        <>
          <p className="fine">{sync ? SYNC[sync] : ''} · Tu casa y tu nivel se guardan en tu cuenta y aparecen en cualquier dispositivo donde entres.</p>
          <button className="btn ghost" disabled={busy} onClick={async () => {
            if (await ask('¿Cerrar sesión? En este dispositivo vas a ver la casa de invitado.', 'Cerrar sesión')) go(signOut);
          }}>Cerrar sesión</button>
        </>
      ) : (
        <>
          <p className="fine">Entrá con Google para guardar tu casa y tu nivel en tu cuenta. Si tu cuenta es nueva, se lleva la casa de este dispositivo.</p>
          <button className="btn primary" disabled={busy} onClick={() => go(signIn)}>Entrar con Google</button>
        </>
      )}
    </section>
  );
}
