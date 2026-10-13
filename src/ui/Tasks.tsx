import { useState } from 'react';
import { localDate } from '../domain/dates';
import { activeSpaces } from '../domain/inventory';
import { addTask, addTaskNote, setTaskStatus, sortTasks } from '../domain/tasks';
import type { MaintenanceTask, Priority, TaskStatus } from '../domain/types';
import { useStore } from '../state/store';
import { Field, Sheet, fmtDate } from './common';

const PRIORITY: Record<Priority, string> = { alta: 'Alta', media: 'Media', baja: 'Baja' };
const STATUS: Record<TaskStatus, string> = { pendiente: 'Pendiente', en_curso: 'En curso', hecha: 'Hecha', cancelada: 'Cancelada' };
const fmtDay = (d: string) => d.split('-').reverse().join('/');

export function TaskForm({ assetId, spaceId, onDone }: { assetId?: string; spaceId?: string; onDone: () => void }) {
  const { state, run, notify } = useStore();
  const [d, setD] = useState({ title: '', description: '', assetId: assetId ?? '', spaceId: spaceId ?? '', dueDate: '', priority: 'media', assignee: '' });
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD((x) => ({ ...x, [k]: e.target.value }));
  return (
    <form className="form" onSubmit={(e) => {
      e.preventDefault();
      if (run((s, c) => addTask(s, c, { ...d, priority: d.priority as Priority }))) { notify('Tarea creada'); onDone(); }
    }}>
      <Field label="¿Qué hay que hacer? *"><input id="task-title" value={d.title} onChange={set('title')} required maxLength={80} autoFocus placeholder="Ej: Limpiar filtro del lavarropas" /></Field>
      <div className="row2">
        <Field label="Objeto">
          <select id="task-asset" value={d.assetId} onChange={set('assetId')}>
            <option value="">Ninguno</option>
            {state.assets.filter((a) => !a.archivedAt).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </Field>
        <Field label="Espacio">
          <select id="task-space" value={d.spaceId} onChange={set('spaceId')}>
            <option value="">Ninguno</option>
            {activeSpaces(state).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Field>
        <Field label="Fecha (opcional)" hint="La ponés vos; la app no inventa plazos técnicos"><input id="task-due" type="date" value={d.dueDate} onChange={set('dueDate')} /></Field>
        <Field label="Prioridad">
          <select id="task-prio" value={d.priority} onChange={set('priority')}>
            {(Object.keys(PRIORITY) as Priority[]).map((p) => <option key={p} value={p}>{PRIORITY[p]}</option>)}
          </select>
        </Field>
        <Field label="Responsable"><input id="task-who" value={d.assignee} onChange={set('assignee')} maxLength={40} /></Field>
      </div>
      <Field label="Detalle"><textarea id="task-desc" value={d.description} onChange={set('description')} rows={2} maxLength={500} /></Field>
      <p className="fine">Para gas o electricidad, la app no da instrucciones: llamá a un profesional matriculado.</p>
      <button className="btn primary" type="submit">Crear tarea</button>
    </form>
  );
}

export function TaskList({ tasks, onOpen }: { tasks: MaintenanceTask[]; onOpen: (id: string) => void }) {
  const today = localDate(new Date().toISOString());
  return (
    <ul className="list">
      {sortTasks(tasks).map((t) => (
        <li key={t.id}>
          <button onClick={() => onOpen(t.id)} className={t.status === 'hecha' || t.status === 'cancelada' ? 'archived' : ''}>
            <span className={`dot prio-${t.priority}`} aria-hidden />
            <span className="grow">
              <strong>{t.status === 'hecha' ? '✓ ' : ''}{t.title}</strong>
              <small>{STATUS[t.status]}{t.dueDate && ` · ${t.dueDate < today && t.status !== 'hecha' ? 'era para el' : 'para el'} ${fmtDay(t.dueDate)}`}{t.assignee && ` · ${t.assignee}`}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function TaskDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, run, notify } = useStore();
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState('');
  const t = state.tasks.find((x) => x.id === id);
  if (!t) return null;
  const asset = state.assets.find((a) => a.id === t.assetId);
  const space = state.spaces.find((s) => s.id === t.spaceId);
  const open = t.status === 'pendiente' || t.status === 'en_curso';
  const status = (st: TaskStatus, ev?: string) => run((s, c) => setTaskStatus(s, c, id, st, ev)) && notify(st === 'hecha' ? '¡Hecho! Bien ahí' : STATUS[st]);
  return (
    <Sheet title={t.title} onClose={onClose}>
      <p className="muted">
        {STATUS[t.status]} · prioridad {PRIORITY[t.priority].toLowerCase()}
        {t.dueDate && ` · para el ${fmtDay(t.dueDate)}`}{t.assignee && ` · ${t.assignee}`}
      </p>
      {(asset || space) && <p className="muted">🔗 {[asset?.name, space?.name].filter(Boolean).join(' · ')}</p>}
      {t.description && <p>{t.description}</p>}
      {t.evidence && <p><strong>Evidencia declarada:</strong> {t.evidence}</p>}
      {open ? (
        <>
          <Field label="Evidencia al completar (opcional)"><input id="task-evidence" value={evidence} onChange={(e) => setEvidence(e.target.value)} maxLength={200} placeholder="Ej: filtro limpio, ticket del repuesto" /></Field>
          <div className="actions">
            <button className="btn primary" onClick={() => status('hecha', evidence)}>Marcar como hecha</button>
            {t.status === 'pendiente' && <button className="btn" onClick={() => status('en_curso')}>Empezar</button>}
            <button className="btn ghost" onClick={() => status('cancelada')}>Cancelar tarea</button>
          </div>
        </>
      ) : (
        <div className="actions"><button className="btn" onClick={() => status('pendiente')}>Reabrir</button></div>
      )}
      <h3>Bitácora</h3>
      <form className="inline-form" onSubmit={(e) => { e.preventDefault(); if (run((s, c) => addTaskNote(s, c, id, note))) setNote(''); }}>
        <input id="task-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregar nota" maxLength={200} aria-label="Nota" />
        <button className="btn" type="submit">Anotar</button>
      </form>
      <ul className="timeline">
        {t.log.slice().reverse().map((l, i) => <li key={i}><time>{fmtDate(l.at)}</time> {l.text}</li>)}
      </ul>
    </Sheet>
  );
}
