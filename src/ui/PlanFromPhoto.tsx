import { useState } from 'react';
import { SPACE_KINDS } from '../domain/labels';
import { PLAN_KINDS, draftBounds, dropDraftRoom, importPlan, scaleDraft, type PlanDraft } from '../domain/planImport';
import { openingSegment } from '../domain/openings';
import type { Sketch, SpaceKind } from '../domain/types';
import { useStore } from '../state/store';
import { ROOM_FILL, Sheet } from './common';

// Plano desde una foto: foto → la IA propone habitaciones en cm → el usuario revisa → se guarda.

type Photo = Awaited<ReturnType<typeof import('../cloud/planFromPhoto').photoForAI>>;
type Step = { at: 'pick' } | { at: 'reading' } | { at: 'review'; draft: PlanDraft; photo: Photo } | { at: 'error'; msg: string };

const m = (cm: number) => (cm / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 });

/** Calcula dónde va la foto de fondo para que coincida con el plano (si la IA marcó el edificio). */
function sketchFor(d: PlanDraft, p: Photo, image: string): Sketch | undefined {
  if (!d.box) return undefined;
  const bw = ((d.box.x1 - d.box.x0) / 1000) * p.w;
  const cmPerPx = draftBounds(d.rooms).w / bw;
  const w = Math.round(p.w * cmPerPx);
  if (!Number.isFinite(w) || w < 100 || w > 6000) return undefined;
  return { image, w, x: Math.round(-(d.box.x0 / 1000) * w), y: Math.round(-(d.box.y0 / 1000) * p.h * cmPerPx), opacity: 0.35 };
}

async function smallImage(dataUrl: string) {
  const img = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const k = Math.min(1, 1200 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.7);
}

export function PlanFromPhoto({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { state, run, notify, ask } = useStore();
  const [step, setStep] = useState<Step>({ at: 'pick' });
  const [front, setFront] = useState('');
  const hasRooms = state.spaces.some((x) => !x.archivedAt && !x.parentId);

  const read = async (f?: File) => {
    if (!f) return;
    setStep({ at: 'reading' });
    const mod = await import('../cloud/planFromPhoto');
    try {
      const photo = await mod.photoForAI(f);
      const cm = Math.round(Number(front.replace(',', '.')) * 100);
      const draft = await mod.readPlanFromPhoto(photo, cm > 0 ? cm : undefined);
      setStep({ at: 'review', draft, photo });
    } catch (e) {
      setStep({ at: 'error', msg: mod.aiErrorMessage(e) });
    }
  };

  const apply = async (draft: PlanDraft, photo: Photo, replace: boolean) => {
    if (replace && !(await ask('Las habitaciones actuales se archivan (se pueden restaurar desde el inventario) y el plano queda como el de la foto.', 'Reemplazar plano'))) return;
    const sketch = sketchFor(draft, photo, await smallImage(photo.dataUrl));
    if (run((s, c) => importPlan(s, c, draft, { replace, sketch }))) {
      notify(`Plano cargado: ${draft.rooms.length} habitaciones. Ajustá lo que haga falta.`);
      onDone();
    }
  };

  return (
    <Sheet title="🤖 Plano desde una foto" onClose={onClose}>
      {step.at === 'pick' && (
        <div className="form">
          <p className="muted">Sacale una foto a un plano o a un croquis a mano. La IA lo pasa a habitaciones con medidas en centímetros y después lo revisás antes de guardarlo.</p>
          <ul className="fine tips">
            <li>Foto derecha, desde arriba y con buena luz.</li>
            <li>Si el plano tiene medidas escritas, mejor: las usa.</li>
          </ul>
          <label className="field"><span>Frente total en metros (opcional, si lo sabés)</span>
            <input inputMode="decimal" value={front} onChange={(e) => setFront(e.target.value)} placeholder="Ej: 8,66" />
          </label>
          <label className="btn primary">📷 Elegir o sacar foto
            <input type="file" accept="image/*" hidden onChange={(e) => read(e.target.files?.[0])} />
          </label>
          <p className="fine">La foto se manda a Gemini (Google) solo para leer el plano. Usa la cuota gratis.</p>
        </div>
      )}

      {step.at === 'reading' && <p className="reading" role="status">🤖 Leyendo el plano… puede tardar unos segundos.</p>}

      {step.at === 'error' && (
        <div className="form">
          <p className="warn" role="alert">{step.msg}</p>
          <button className="btn" onClick={() => setStep({ at: 'pick' })}>Probar de nuevo</button>
        </div>
      )}

      {step.at === 'review' && (
        <Review draft={step.draft} photo={step.photo} hasRooms={hasRooms}
          onChange={(draft) => setStep({ ...step, draft })}
          onRetry={() => setStep({ at: 'pick' })}
          onApply={(replace) => apply(step.draft, step.photo, replace)} />
      )}
    </Sheet>
  );
}

function Review({ draft, photo, hasRooms, onChange, onRetry, onApply }: {
  draft: PlanDraft; photo: Photo; hasRooms: boolean;
  onChange: (d: PlanDraft) => void; onRetry: () => void; onApply: (replace: boolean) => void;
}) {
  const { notify } = useStore();
  const b = draftBounds(draft.rooms);
  const [front, setFront] = useState(m(b.w));
  const pad = Math.max(b.w, b.d) * 0.04;
  const setRoom = (i: number, patch: { name?: string; kind?: SpaceKind }) =>
    onChange({ ...draft, rooms: draft.rooms.map((r, k) => (k === i ? { ...r, ...patch } : r)) });
  const rescale = () => {
    const cm = Math.round(Number(front.replace(',', '.')) * 100);
    if (!(cm > 0) || cm === b.w) return;
    try { onChange(scaleDraft(draft, cm / b.w)); notify(`Escalado a ${m(cm)} m de frente`); } catch (e) { notify((e as Error).message); }
  };

  return (
    <div className="form plan-review">
      <div className="pr-compare">
        <img src={photo.dataUrl} alt="Foto original" />
        <svg viewBox={`${-pad} ${-pad} ${b.w + pad * 2} ${b.d + pad * 2}`} role="img" aria-label="Plano propuesto">
          {draft.rooms.map((r, i) => (
            <g key={i}>
              <rect x={r.x} y={r.y} width={r.w} height={r.d} fill={ROOM_FILL[r.kind]} className="pr-room" />
              <text x={r.x + r.w / 2} y={r.y + r.d / 2} className="pr-label" fontSize={Math.max(b.w, b.d) / 28}>{r.name}</text>
            </g>
          ))}
          {draft.openings.map((o, i) => {
            const [x1, y1, x2, y2] = openingSegment(o, draft.rooms[o.room]);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={`pr-open ${o.kind}`} strokeWidth={Math.max(b.w, b.d) / 70} />;
          })}
        </svg>
      </div>
      {draft.notes && <p className="fine">🤖 {draft.notes}</p>}
      {draft.dropped > 0 && <p className="fine">Se descartaron {draft.dropped} ambientes que no cerraban; los podés dibujar después.</p>}

      <div className="nums">
        <label className="num"><span>Frente total</span><input inputMode="decimal" value={front} onChange={(e) => setFront(e.target.value)} onBlur={rescale} /><small>m</small></label>
        <div className="num"><span>Fondo</span><strong>{m(b.d)}</strong><small>m</small></div>
      </div>
      <p className="fine">Si sabés cuánto mide el frente de verdad, corregilo y todo se escala.</p>

      <ul className="pr-rooms">
        {draft.rooms.map((r, i) => (
          <li key={i}>
            <input aria-label="Nombre" value={r.name} maxLength={40} onChange={(e) => setRoom(i, { name: e.target.value })} />
            <select aria-label="Tipo" value={r.kind} onChange={(e) => setRoom(i, { kind: e.target.value as SpaceKind })}>
              {PLAN_KINDS.map((k) => <option key={k} value={k}>{SPACE_KINDS[k]}</option>)}
            </select>
            <small>{m(r.w)} × {m(r.d)} m</small>
            <button className="icon-btn" aria-label={`Quitar ${r.name}`} onClick={() => onChange(dropDraftRoom(draft, i))}>✕</button>
          </li>
        ))}
      </ul>

      <div className="actions">
        <button className="btn ghost" onClick={onRetry}>Otra foto</button>
        {hasRooms ? (
          <>
            <button className="btn" disabled={!draft.rooms.length} onClick={() => onApply(false)}>Sumar al lado</button>
            <button className="btn primary" disabled={!draft.rooms.length} onClick={() => onApply(true)}>Reemplazar mi plano</button>
          </>
        ) : <button className="btn primary" disabled={!draft.rooms.length || draft.rooms.some((r) => !r.name.trim())} onClick={() => onApply(false)}>Usar este plano</button>}
      </div>
      <p className="fine">Después ajustás medidas exactas, puertas y ventanas en el Modo construcción. La foto queda de fondo para comparar.</p>
    </div>
  );
}
