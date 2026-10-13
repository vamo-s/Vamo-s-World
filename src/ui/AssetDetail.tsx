import { useState } from 'react';
import { TEMPLATES } from '../domain/attributes';
import { activeSpaces, archiveAsset, moveAsset } from '../domain/inventory';
import { ASSET_KINDS, ASSET_TENURE, CONDITIONS } from '../domain/labels';
import { groupById } from '../domain/taxonomy';
import { useStore } from '../state/store';
import { AssetForm } from './AssetForm';
import { OriginBadge, Sheet, fmtARS, fmtDate } from './common';
import { TaskDetail, TaskForm, TaskList } from './Tasks';

export function AssetDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, run, notify } = useStore();
  const [editing, setEditing] = useState(false);
  const [newTask, setNewTask] = useState(false);
  const [taskId, setTaskId] = useState<string>();
  const a = state.assets.find((x) => x.id === id);
  if (!a) return null;
  const space = state.spaces.find((s) => s.id === a.spaceId);
  const events = state.events.filter((e) => e.assetId === id).slice().reverse();
  const defs = TEMPLATES[a.templateId].attributes;

  if (newTask) return <Sheet title={`Tarea para ${a.name}`} onClose={() => setNewTask(false)}><TaskForm assetId={a.id} spaceId={a.spaceId} onDone={() => setNewTask(false)} /></Sheet>;
  if (taskId) return <TaskDetail id={taskId} onClose={() => setTaskId(undefined)} />;
  const tasks = state.tasks.filter((t) => t.assetId === id);
  if (editing) {
    return <Sheet title={`Editar ${a.name}`} onClose={() => setEditing(false)}><AssetForm asset={a} onDone={() => setEditing(false)} /></Sheet>;
  }

  const rows: [string, string | undefined][] = [
    ['Categoría', `${groupById(a.groupId)?.name ?? a.groupId} › ${a.subcategory}`],
    ['Tipo', ASSET_KINDS[a.kind]],
    ['Tenencia', ASSET_TENURE[a.tenure]],
    ['Estado declarado', a.condition && CONDITIONS[a.condition]],
    ['Titular', a.owner], ['Custodia', a.custodian],
    ['Cantidad', a.quantity !== undefined ? `${a.quantity} ${a.unit ?? ''}` : undefined],
    ['Marca / modelo', [a.brand, a.model].filter(Boolean).join(' ') || undefined],
    ['N° de serie', a.serial], ['Compra', a.acquiredAt],
    ['Costo', a.cost && fmtARS(a.cost.amount)],
    ...defs.filter((d) => a.attributes[d.key] !== undefined).map((d): [string, string] => {
      const v = a.attributes[d.key];
      return [d.label, typeof v === 'boolean' ? (v ? 'Sí' : 'No') : `${v}${d.unit ? ' ' + d.unit : ''}`];
    }),
  ];

  return (
    <Sheet title={a.name} onClose={onClose}>
      <div className="detail-head">
        {a.photo && <img src={a.photo} alt="" className="photo" />}
        <div>
          <OriginBadge origin={a.origin} /> {a.archivedAt && <span className="badge">Archivado</span>}
          <p className="muted">📍 {space?.name ?? 'Sin ubicación'}</p>
          {a.description && <p>{a.description}</p>}
        </div>
      </div>
      <dl className="specs">
        {rows.filter(([, v]) => v).map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
      </dl>
      {!a.archivedAt && (
        <label className="field">
          <span>Mover a</span>
          <select value={a.spaceId ?? ''} onChange={(e) => {
            if (run((s, c) => moveAsset(s, c, id, e.target.value || undefined))) notify('Movido');
          }}>
            <option value="">Sin ubicación</option>
            {activeSpaces(state).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
      )}
      <div className="actions">
        <button className="btn" onClick={() => setEditing(true)}>Editar</button>
        <button className="btn ghost" onClick={() => {
          if (run((s, c) => archiveAsset(s, c, id, !a.archivedAt))) notify(a.archivedAt ? 'Restaurado' : 'Archivado (podés restaurarlo)');
        }}>{a.archivedAt ? 'Restaurar' : 'Archivar'}</button>
      </div>
      <h3>Mantenimiento</h3>
      {tasks.length > 0 && <TaskList tasks={tasks} onOpen={setTaskId} />}
      <button className="btn" onClick={() => setNewTask(true)}>＋ Tarea de mantenimiento</button>
      <h3>Historial</h3>
      <ul className="timeline">
        {events.map((e) => (<li key={e.id}><time>{fmtDate(e.at)}</time> {e.detail}</li>))}
      </ul>
      <p className="fine">Las acciones físicas (mover, estado) son declaradas por vos; la app no las verifica.</p>
    </Sheet>
  );
}
