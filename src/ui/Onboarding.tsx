import { useAccount } from '../cloud/account';
import { useRef, useState } from 'react';
import { seedDemo } from '../domain/demo';
import { setupHousehold } from '../domain/inventory';
import { HOME_TENURE } from '../domain/labels';
import type { HomeTenure } from '../domain/types';
import { importJSON, ImportError } from '../persistence/backup';
import { useStore } from '../state/store';
import { Field } from './common';

export function Onboarding() {
  const { run, replace, notify } = useStore();
  const account = useAccount();
  const file = useRef<HTMLInputElement>(null);
  const [alias, setAlias] = useState('');
  const [homeName, setHomeName] = useState('');
  const [tenure, setTenure] = useState<HomeTenure>('alquilada');
  const [demo, setDemo] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    run((s, c) => (demo ? seedDemo(s, c, alias, homeName, tenure) : setupHousehold(s, c, { alias, homeName, tenure })));
  };

  return (
    <main className="onboarding">
      <div className="logo" aria-hidden>🏠</div>
      <h1>Vamo's House</h1>
      <p className="muted">Tu casa real, jugada como un tycoon. Registrá lo que tenés, planificá mejoras y ganá experiencia.</p>
      {account.enabled && !account.user && (
        <button className="btn google" onClick={() => account.signIn().catch(() => notify('No se pudo conectar con Google. Probá de nuevo.'))}>
          Entrar con Google y traer mi casa
        </button>
      )}
      <form onSubmit={submit} className="card form">
        <Field label="Tu alias de jugador">
          <input value={alias} onChange={(e) => setAlias(e.target.value)} required maxLength={40} autoComplete="nickname" />
        </Field>
        <Field label="Nombre del hogar">
          <input value={homeName} onChange={(e) => setHomeName(e.target.value)} required maxLength={60} placeholder="Ej: Depto Nueva Córdoba" />
        </Field>
        <fieldset className="choice">
          <legend>¿Cómo vivís?</legend>
          {(Object.keys(HOME_TENURE) as HomeTenure[]).map((t) => (
            <label key={t} className={tenure === t ? 'on' : ''}>
              <input type="radio" name="tenure" checked={tenure === t} onChange={() => setTenure(t)} />
              {HOME_TENURE[t]}
            </label>
          ))}
        </fieldset>
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
          Cargar habitaciones y objetos de ejemplo (quedan marcados como DEMO)
        </label>
        <button className="btn primary" type="submit">Entrar a mi casa</button>
      </form>
      <button type="button" className="link" onClick={() => file.current?.click()}>¿Tenés un respaldo? Restauralo</button>
      <input ref={file} type="file" accept="application/json,.json" hidden aria-label="Archivo de respaldo" onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = '';
        if (!f) return;
        try { replace(importJSON(await f.text())); notify('Respaldo importado'); }
        catch (err) { notify(err instanceof ImportError ? err.message : 'No se pudo leer el archivo'); }
      }} />
      <p className="fine">{account.user ? `Tu casa se guarda en la cuenta ${account.user.email}.`
        : account.enabled ? 'Sin cuenta, tus datos quedan solo en este dispositivo.'
        : 'Tus datos quedan solo en este dispositivo: exportá un respaldo desde Perfil.'}</p>
    </main>
  );
}
