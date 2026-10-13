import { useState } from 'react';
import { activeSpaces, filterAssets } from '../domain/inventory';
import { TAXONOMY } from '../domain/taxonomy';
import { useStore } from '../state/store';
import { AssetDetail } from './AssetDetail';
import { AssetForm } from './AssetForm';
import { AssetList } from './AssetList';
import { Empty, Sheet } from './common';

export function InventoryView() {
  const { state } = useStore();
  const [text, setText] = useState('');
  const [groupId, setGroupId] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [archived, setArchived] = useState(false);
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string>();
  const list = filterAssets(state, { text, groupId: groupId || undefined, spaceId: spaceId || undefined, includeArchived: archived });
  const total = filterAssets(state, {}).length;
  const byGroup = Object.fromEntries(TAXONOMY.map((g) => [g.id, filterAssets(state, { groupId: g.id }).length]));

  return (
    <main className="view">
      <header className="hero">
        <div><h1>Inventario</h1><p className="muted">{total} objetos activos</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}>＋ Registrar</button>
      </header>
      <div className="chips" role="tablist" aria-label="Grupos">
        <button className={!groupId ? 'on' : ''} onClick={() => setGroupId('')}>Todo</button>
        {TAXONOMY.map((g) => (
          <button key={g.id} className={groupId === g.id ? 'on' : ''} onClick={() => setGroupId(g.id)}>
            {g.name.split(' ')[0]} <small>{byGroup[g.id]}</small>
          </button>
        ))}
      </div>
      <div className="filters">
        <input type="search" placeholder="Buscar por nombre, marca, modelo…" value={text} onChange={(e) => setText(e.target.value)} aria-label="Buscar" />
        <select value={spaceId} onChange={(e) => setSpaceId(e.target.value)} aria-label="Filtrar por espacio">
          <option value="">Todos los espacios</option>
          <option value="none">Sin ubicación</option>
          {activeSpaces(state).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <label className="check"><input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} /> Ver archivados</label>
      </div>
      {list.length ? <AssetList assets={list} onOpen={setOpen} /> : total === 0 ? (
        <Empty icon="🧾" title="Todavía no registraste nada">
          <p>Con nombre y categoría alcanza; los detalles los completás después.</p>
          <button className="btn primary" onClick={() => setAdding(true)}>Registrar el primero</button>
        </Empty>
      ) : <Empty icon="🔍" title="Nada coincide con el filtro" />}
      {adding && <Sheet title="Registrar objeto" onClose={() => setAdding(false)}><AssetForm onDone={() => setAdding(false)} /></Sheet>}
      {open && <AssetDetail id={open} onClose={() => setOpen(undefined)} />}
    </main>
  );
}
