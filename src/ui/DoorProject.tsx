import { useState } from 'react';
import { DEMO_DOORS, DOOR_TOOLS } from '../domain/catalog';
import { localDate } from '../domain/dates';
import { cancelProject, compatibleDoors, demoBudget, doorAssets, planProject, projectStatus, startDoorProject, updateProject } from '../domain/projects';
import { updateAsset } from '../domain/inventory';
import type { ImprovementProject } from '../domain/types';
import { useStore } from '../state/store';
import { DemoBadge, Sheet, fmtARS } from './common';

// Recorrido DEMO "Cambiar una puerta": puerta → medidas → modelos DEMO → vista previa →
// presupuesto → instalación → herramientas → tutorial (pendiente) → fecha.

const STEPS = ['Puerta', 'Medidas', 'Modelo', 'Presupuesto', 'Instalación', 'Fecha'] as const;
const STATUS: Record<ImprovementProject['status'], string> = { borrador: 'Borrador', planificado: 'Planificado', hecho: 'Hecho', cancelado: 'Cancelado' };

/** Tarjeta de proyectos de mejora para la pantalla Casa. */
export function ProjectsCard() {
  const { state, run } = useStore();
  const [open, setOpen] = useState<string>();
  const list = state.projects.filter((p) => p.status !== 'cancelado');
  const start = () => {
    let id = '';
    if (run((s, c) => { const n = startDoorProject(s, c, doorAssets(s)[0]?.id); id = n.projects.at(-1)!.id; return n; })) setOpen(id);
  };
  return (
    <section className="card">
      <div className="section-head"><h2>Mejoras <DemoBadge /></h2><button className="btn" onClick={start}>🚪 Cambiar una puerta</button></div>
      {list.length ? (
        <ul className="plain-list">
          {list.map((p) => (
            <li key={p.id}><button className="row-btn" onClick={() => setOpen(p.id)}>
              <strong>{p.title}</strong> <small className="muted">{STATUS[projectStatus(state, p)]}{p.plannedDate ? ` · ${p.plannedDate.split('-').reverse().join('/')}` : ''}</small>
            </button></li>
          ))}
        </ul>
      ) : <p className="muted">Planificá un cambio paso a paso. Catálogo y precios son de ejemplo: no se compra nada desde acá.</p>}
      {open && <DoorProject id={open} onClose={() => setOpen(undefined)} />}
    </section>
  );
}

export function DoorProject({ id, onClose }: { id: string; onClose: () => void }) {
  const { state, run, notify, ask } = useStore();
  const p = state.projects.find((x) => x.id === id);
  const [step, setStep] = useState(0);
  const [date, setDate] = useState('');
  if (!p) return null;
  const doors = doorAssets(state);
  const target = doors.find((d) => d.id === p.targetAssetId);
  const fits = compatibleDoors(target);
  const product = DEMO_DOORS.find((d) => d.id === p.productId);
  const budget = demoBudget(p);
  const locked = p.status !== 'borrador';
  const set = (patch: Parameters<typeof updateProject>[3]) => run((s, c) => updateProject(s, c, id, patch));
  const today = localDate(new Date().toISOString());
  const canNext = [!!target, !!(target?.attributes.ancho && target?.attributes.alto), !!product, true, !!p.install, false][step];

  return (
    <Sheet title={<>🚪 Cambiar una puerta <DemoBadge /></>} onClose={onClose}>
      {locked ? (
        <div className="form">
          <p><strong>{STATUS[projectStatus(state, p)]}</strong>{p.plannedDate && ` para el ${p.plannedDate.split('-').reverse().join('/')}`}.</p>
          <p className="muted">{target?.name} → {product?.name} · instalación {p.install === 'profesional' ? 'profesional' : 'propia'} · total ilustrativo {fmtARS(budget.total)}</p>
          <p className="fine">La tarea quedó en Mantenimiento. Cuando la marques como hecha, el proyecto pasa a “Hecho”.</p>
          {p.status === 'planificado' && <button className="btn ghost" onClick={async () => { if (await ask('¿Cancelar el proyecto? La tarea queda en Mantenimiento.', 'Cancelar proyecto')) { run((s, c) => cancelProject(s, c, id)); onClose(); } }}>Cancelar proyecto</button>}
        </div>
      ) : (
        <div className="form">
          <ol className="stepper" aria-label="Pasos">
            {STEPS.map((s, i) => <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>{s}</li>)}
          </ol>

          {step === 0 && (doors.length ? (
            <div className="choice-list">
              {doors.map((d) => (
                <button key={d.id} className={d.id === p.targetAssetId ? 'on' : ''} onClick={() => set({ targetAssetId: d.id })}>
                  <strong>{d.name}</strong> {d.origin === 'demo' && <DemoBadge />}
                  <small>{d.attributes.ancho && d.attributes.alto ? `${d.attributes.ancho} × ${d.attributes.alto} cm` : 'Sin medidas'}</small>
                </button>
              ))}
            </div>
          ) : <p className="muted">No hay puertas en el inventario. Agregá una desde el Modo construcción (herramienta Puerta) o registrala en Inventario.</p>)}

          {step === 1 && target && <Measures assetId={target.id} />}

          {step === 2 && (
            <>
              <div className="choice-list">
                {fits.map(({ door, fits: ok, note }) => (
                  <button key={door.id} className={door.id === p.productId ? 'on' : ''} onClick={() => set({ productId: door.id })}>
                    <strong>{door.name}</strong> <DemoBadge />
                    <small>{door.width} × {door.height} cm · {door.material} · {fmtARS(door.price)} (ilustrativo)</small>
                    <small className={ok ? 'ok' : 'warn'}>{ok ? '✓ ' : '⚠ '}{note}</small>
                  </button>
                ))}
              </div>
              {product && target && <Preview width={product.width} height={product.height} current={{ w: Number(target.attributes.ancho), h: Number(target.attributes.alto) }} />}
            </>
          )}

          {step === 3 && (
            <table className="budget">
              <tbody>
                {budget.lines.map((l) => <tr key={l.label}><td>{l.label}</td><td className="num">{fmtARS(l.amount)}</td></tr>)}
                <tr className="total"><td>Total ilustrativo</td><td className="num">{fmtARS(budget.total)}</td></tr>
              </tbody>
              <caption className="fine">Precios DEMO, no son ofertas reales. La colocación profesional se suma si la elegís en el paso siguiente.</caption>
            </table>
          )}

          {step === 4 && (
            <>
              <div className="choice-list">
                <button className={p.install === 'profesional' ? 'on' : ''} onClick={() => set({ install: 'profesional' })}>
                  <strong>Que la coloque un profesional</strong><small>Recomendado si hay que tocar el marco o es una puerta de entrada.</small>
                </button>
                <button className={p.install === 'propia' ? 'on' : ''} onClick={() => set({ install: 'propia' })}>
                  <strong>Colocarla yo</strong><small>Solo si la hoja nueva entra en el marco existente.</small>
                </button>
              </div>
              {p.install === 'propia' && (
                <>
                  <h3>Herramientas</h3>
                  <ul className="tools">{DOOR_TOOLS.map((t) => <li key={t}>{t}</li>)}</ul>
                  <div className="tutorial"><strong>Tutorial</strong> <DemoBadge /><p className="fine">Contenido pendiente de revisión por alguien del oficio. Por ahora, no hay pasos publicados.</p></div>
                </>
              )}
            </>
          )}

          {step === 5 && (
            <>
              <label className="field"><span>¿Qué día lo hacés?</span><input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} /></label>
              <p className="fine">Se crea una tarea en Mantenimiento con esa fecha. No se compra ni se paga nada.</p>
              <button className="btn primary" disabled={!date} onClick={() => {
                if (run((s, c) => planProject(s, c, id, date))) notify('Proyecto planificado: reclamá la misión en Misiones');
              }}>Planificar</button>
            </>
          )}

          <div className="actions">
            {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>← Atrás</button>}
            {step < STEPS.length - 1 && <button className="btn primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Siguiente →</button>}
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Measures({ assetId }: { assetId: string }) {
  const { state, run, notify } = useStore();
  const a = state.assets.find((x) => x.id === assetId)!;
  const [w, setW] = useState(String(a.attributes.ancho ?? ''));
  const [h, setH] = useState(String(a.attributes.alto ?? ''));
  const opening = state.openings.find((o) => o.assetId === assetId && !o.archivedAt);
  return (
    <>
      <p className="muted">Medí la hoja (la parte que se mueve), no el marco. Ancho de lado a lado y alto desde el piso.</p>
      <div className="nums">
        <label className="num"><span>Ancho</span><input inputMode="numeric" value={w} onChange={(e) => setW(e.target.value)} /><small>cm</small></label>
        <label className="num"><span>Alto</span><input inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} /><small>cm</small></label>
      </div>
      <button className="btn" onClick={() => {
        if (run((s, c) => updateAsset(s, c, assetId, { attributes: { ...a.attributes, ancho: Number(w), alto: Number(h) } }))) notify('Medidas guardadas en la ficha');
      }}>Guardar medidas</button>
      {opening && <p className="fine">Está en el plano: si cambiás el ancho acá, ajustalo también en el Modo construcción.</p>}
    </>
  );
}

/** Vista previa a escala: puerta actual (línea punteada) y modelo DEMO elegido. */
function Preview({ width, height, current }: { width: number; height: number; current: { w: number; h: number } }) {
  const W = Math.max(width, current.w) + 40, H = Math.max(height, current.h) + 20;
  return (
    <svg className="door-preview" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Modelo ${width} × ${height} cm sobre tu puerta de ${current.w} × ${current.h} cm`}>
      <rect x="0" y={H - 4} width={W} height="4" className="dp-floor" />
      <rect x={20} y={H - 4 - height} width={width} height={height} className="dp-new" />
      <circle cx={20 + width - 8} cy={H - 4 - height / 2} r="3" className="dp-knob" />
      <rect x={20} y={H - 4 - current.h} width={current.w} height={current.h} className="dp-cur" />
    </svg>
  );
}
