import { useState } from 'react';
import { addSpace, updateSpace } from '../domain/inventory';
import { SPACE_KINDS } from '../domain/labels';
import type { Space, SpaceKind } from '../domain/types';
import { useStore } from '../state/store';
import { Field } from './common';

export function SpaceForm({ space, parentId, onDone }: { space?: Space; parentId?: string; onDone: () => void }) {
  const { run, notify } = useStore();
  const [name, setName] = useState(space?.name ?? '');
  const [kind, setKind] = useState<SpaceKind>(space?.kind ?? 'dormitorio');
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = run((s, c) => (space ? updateSpace(s, c, space.id, { name, kind }) : addSpace(s, c, { name, kind, parentId })));
    if (ok) { notify(space ? 'Espacio actualizado' : `${name.trim()} agregado`); onDone(); }
  };
  return (
    <form className="form" onSubmit={submit}>
      <Field label={parentId ? 'Nombre de la zona o estante' : 'Nombre'}>
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={40} autoFocus placeholder={parentId ? 'Ej: Alacena alta' : 'Ej: Pieza de Vamo'} />
      </Field>
      {!parentId && (
        <div className="kind-grid">
          {(Object.keys(SPACE_KINDS) as SpaceKind[]).map((k) => (
            <button type="button" key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)} aria-pressed={kind === k}>
              {SPACE_KINDS[k]}
            </button>
          ))}
        </div>
      )}
      <button className="btn primary" type="submit">{space ? 'Guardar' : 'Agregar'}</button>
    </form>
  );
}
