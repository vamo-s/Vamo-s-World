import { useRef, useState } from 'react';
import { updateHousehold } from '../domain/inventory';
import { HOME_TENURE } from '../domain/labels';
import type { HomeTenure } from '../domain/types';
import { exportJSON, importJSON, inventoryCSV, ImportError } from '../persistence/backup';
import { useStore } from '../state/store';
import { Field } from './common';

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const embedded = (() => { try { return window.self !== window.top; } catch { return true; } })();

const ROADMAP = [
  ['Proyecto “Cambiar una puerta”', 'Recorrido DEMO completo con catálogo ficticio', 'Próximo'],
  ['Vamo’s Pets', 'Fichas y rutinas de tus mascotas, guardadas en el dispositivo', 'Próximo'],
  ['Amigos y casas virtuales', 'Solo lo que elijas mostrar; requiere cuentas', 'Futuro'],
  ['Vamo’s World y Sports', 'Comercios y canchas adheridos, primero en DEMO', 'Futuro'],
  ['Laundry, Food, Cleaning, Tech, Desk', 'Módulos sobre el mismo inventario', 'Futuro'],
  ['Nube y cuentas', 'Sincronizar entre dispositivos y compartir con la familia', 'Futuro'],
];

export function ProfileView() {
  const { state, run, replace, reset, notify, saveError, ask } = useStore();
  const [alias, setAlias] = useState(state.player?.alias ?? '');
  const [name, setName] = useState(state.household?.name ?? '');
  const [tenure, setTenure] = useState<HomeTenure>(state.household?.tenure ?? 'alquilada');
  const file = useRef<HTMLInputElement>(null);
  const stamp = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Argentina/Cordoba' });

  return (
    <main className="view">
      <header className="hero"><div><h1>Perfil</h1><p className="muted">Jugador: {state.player?.alias}</p></div></header>
      <form className="card form" onSubmit={(e) => {
        e.preventDefault();
        if (run((s, c) => updateHousehold(s, c, { alias, name, tenure }))) notify('Guardado');
      }}>
        <Field label="Alias"><input value={alias} onChange={(e) => setAlias(e.target.value)} required maxLength={40} /></Field>
        <Field label="Hogar"><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} /></Field>
        <Field label="Vivienda">
          <select value={tenure} onChange={(e) => setTenure(e.target.value as HomeTenure)}>
            {(Object.keys(HOME_TENURE) as HomeTenure[]).map((t) => <option key={t} value={t}>{HOME_TENURE[t]}</option>)}
          </select>
        </Field>
        <button className="btn" type="submit">Guardar</button>
      </form>

      <section className="card">
        <h2>Tus datos</h2>
        <p className={saveError ? 'warn' : 'muted'}>
          {saveError ? '⚠️ No se pudo guardar en este dispositivo. Exportá un respaldo ya.'
            : 'Se guardan solo en este navegador. Si borrás los datos del navegador o cambiás de teléfono, se pierden: exportá un respaldo seguido.'}
        </p>
        {embedded && <p className="warn">Estás en la vista previa: acá exportar no descarga archivos. En la app publicada o instalada sí.</p>}
        <div className="actions">
          <button className="btn primary" onClick={() => download(`vamos-house-${stamp}.json`, exportJSON(state), 'application/json')}>Exportar respaldo (JSON)</button>
          <button className="btn" onClick={() => download(`inventario-${stamp}.csv`, inventoryCSV(state), 'text/csv')}>Inventario (CSV)</button>
          <button className="btn" onClick={() => file.current?.click()}>Importar respaldo</button>
          <input ref={file} type="file" accept="application/json,.json" hidden onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              const s = importJSON(await f.text());
              if (await ask('Importar reemplaza todos los datos actuales por los del respaldo. ¿Seguimos?', 'Importar')) { replace(s); notify('Respaldo importado'); }
            } catch (err) { notify(err instanceof ImportError ? err.message : 'No se pudo leer el archivo'); }
          }} />
          <button className="btn danger" onClick={async () => {
            if (await ask('Esto borra TODOS los datos de este dispositivo y no se puede deshacer. ¿Exportaste un respaldo?', 'Borrar todo')) await reset();
          }}>Borrar todo</button>
        </div>
      </section>

      <section className="card">
        <h2>Lo que viene</h2>
        <p className="muted">Todavía no funcionan; los mostramos para que sepas hacia dónde va.</p>
        <ul className="roadmap">
          {ROADMAP.map(([t, d, when]) => <li key={t}><strong>{t}</strong> <span className="badge">{when}</span><br /><small>{d}</small></li>)}
        </ul>
      </section>
      <p className="fine center">Vamo's House 0.1 · sin cuentas, sin nube, sin pagos. Nada de lo que ves compra o contrata algo real.</p>
    </main>
  );
}
