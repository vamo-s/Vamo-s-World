import { useState } from 'react';
import { activeSpaces, archiveSpace, filterAssets } from '../domain/inventory';
import { HOME_TENURE, SPACE_KINDS } from '../domain/labels';
import { useStore } from '../state/store';
import { AssetDetail } from './AssetDetail';
import { AssetForm } from './AssetForm';
import { AssetList } from './AssetList';
import { DemoBadge, Empty, SPACE_ICON, Sheet } from './common';
import { IsoHouse, type Layer } from './IsoHouse';
import { PlanEditor } from './PlanEditor';
import { ProjectsCard } from './DoorProject';
import { SpaceForm } from './SpaceForm';
import { TaskDetail, TaskForm, TaskList } from './Tasks';
import { localDate } from '../domain/dates';
import { monthSummary } from '../domain/economy';
import { level, totalXP, upcoming } from '../domain/progress';
import { openTasks } from '../domain/tasks';
import { fmtARS } from './common';

export function HouseView({ go }: { go: (tab: 'misiones' | 'economia') => void }) {
  const { state, run, notify, ask } = useStore();
  const [selected, setSelected] = useState<string>();
  const [sheet, setSheet] = useState<null | 'newSpace' | 'editSpace' | 'newZone' | 'newAsset' | 'newTask'>(null);
  const [taskId, setTaskId] = useState<string>();
  const [layer, setLayer] = useState<Layer>('espacios');
  const [assetId, setAssetId] = useState<string>();
  const [build, setBuild] = useState(false);
  const h = state.household!;
  const rooms = activeSpaces(state).filter((s) => !s.parentId);
  const live = filterAssets(state, {});
  const counts: Record<string, number> = {};
  for (const a of live) if (a.spaceId) {
    const sp = state.spaces.find((s) => s.id === a.spaceId);
    const key = sp?.parentId ?? a.spaceId;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  const room = rooms.find((r) => r.id === selected);
  const nowIso = new Date().toISOString();
  const xp = totalXP(state);
  const lv = level(xp);
  const month = monthSummary(state, localDate(nowIso).slice(0, 7));
  const pending = openTasks(state);
  const claimable = upcoming(state, nowIso).filter((h) => h.eligible).length;
  const zones = room ? activeSpaces(state).filter((z) => z.parentId === room.id) : [];
  const roomAssets = room ? live.filter((a) => a.spaceId === room.id || zones.some((z) => z.id === a.spaceId)) : [];

  return (
    <main className="view">
      <header className="hero">
        <div>
          <h1>{h.name} {h.isDemo && <DemoBadge />}</h1>
          <p className="muted">{HOME_TENURE[h.tenure]} · {rooms.length} espacios · {live.length} objetos</p>
        </div>
      </header>

      <div className="stats">
        <button className="stat" onClick={() => go('misiones')}>
          <small>Nivel {lv.level}</small><strong>{xp} XP</strong>
          <span className="bar" aria-hidden><span style={{ width: `${lv.into}%` }} /></span>
        </button>
        <button className="stat" onClick={() => go('economia')}>
          <small>Saldo del mes</small><strong className="num">{fmtARS(month.balance)}</strong>
        </button>
        <a className="stat" href="#mantenimiento">
          <small>Tareas abiertas</small><strong>{pending.length}</strong>
        </a>
        {claimable > 0 && (
          <button className="stat festive" onClick={() => go('misiones')}>
            <small>Festividad</small><strong>🎉 Reclamá XP</strong>
          </button>
        )}
      </div>
      {rooms.length === 0 ? (
        <Empty icon="🧱" title="Tu casa está vacía">
          <p>Empezá por la habitación donde más tiempo pasás.</p>
          <div className="actions" style={{ justifyContent: 'center' }}>
            <button className="btn primary" onClick={() => setBuild(true)}>🏗️ Dibujar mi casa a medida</button>
            <button className="btn" onClick={() => setSheet('newSpace')}>Agregar habitación sin medidas</button>
          </div>
        </Empty>
      ) : (
        <>
          <div className="card house-card">
            <div className="layers" role="tablist" aria-label="Capas del plano">
              <button role="tab" aria-selected={layer === 'espacios'} className={layer === 'espacios' ? 'on' : ''} onClick={() => setLayer('espacios')}>🧱 Espacios</button>
              <button role="tab" aria-selected={layer === 'muebles'} className={layer === 'muebles' ? 'on' : ''} onClick={() => setLayer('muebles')}>🛋️ Muebles</button>
            </div>
            <IsoHouse rooms={rooms} counts={counts} selected={selected} onSelect={setSelected} onOpenAsset={setAssetId} alias={state.player?.alias ?? ''} layer={layer} />
          </div>
          <div className="actions">
            <button className="btn primary build-btn" onClick={() => setBuild(true)}>🏗️ Modo construcción</button>
            <button className="btn" onClick={() => setSheet('newSpace')}>＋ Habitación o espacio</button>
          </div>
          {live.filter((a) => !a.spaceId).length > 0 && (
            <p className="muted">📦 {live.filter((a) => !a.spaceId).length} objeto(s) sin ubicación: asignalos desde Inventario.</p>
          )}
        </>
      )}

      <section className="card" id="mantenimiento">
        <div className="section-head"><h2>Mantenimiento</h2><button className="btn" onClick={() => setSheet('newTask')}>＋ Tarea</button></div>
        {state.tasks.length ? <TaskList tasks={state.tasks.filter((t) => t.status !== 'cancelada').slice(0, 50)} onOpen={setTaskId} />
          : <p className="muted">Sin tareas. Anotá algo que tengas pendiente en la casa, sin fecha si no la sabés.</p>}
      </section>

      <ProjectsCard />

      {room && !sheet && !assetId && (
        <Sheet title={<>{SPACE_ICON[room.kind]} {room.name} {room.isDemo && <DemoBadge />}</>} onClose={() => setSelected(undefined)}>
          <p className="muted">{SPACE_KINDS[room.kind]}{zones.length > 0 && ` · zonas: ${zones.map((z) => z.name).join(', ')}`}</p>
          {roomAssets.length ? <AssetList assets={roomAssets} onOpen={setAssetId} showSpace={zones.length > 0} />
            : <Empty icon="🔍" title="Nada registrado acá todavía"><p>Registrá lo primero que veas.</p></Empty>}
          <div className="actions">
            <button className="btn primary" onClick={() => setSheet('newAsset')}>＋ Objeto</button>
            <button className="btn" onClick={() => setSheet('newZone')}>＋ Zona/estante</button>
            <button className="btn ghost" onClick={() => setSheet('editSpace')}>Editar</button>
            <button className="btn ghost" onClick={async () => {
              if (await ask(`¿Archivar ${room.name}? Sus objetos quedan en el inventario, sin ubicación.`, 'Archivar')
                && run((s, c) => archiveSpace(s, c, room.id))) { notify('Espacio archivado'); setSelected(undefined); }
            }}>Archivar</button>
          </div>
        </Sheet>
      )}
      {sheet === 'newSpace' && <Sheet title="Nuevo espacio" onClose={() => setSheet(null)}><SpaceForm onDone={() => setSheet(null)} /></Sheet>}
      {sheet === 'editSpace' && room && <Sheet title="Editar espacio" onClose={() => setSheet(null)}><SpaceForm space={room} onDone={() => setSheet(null)} /></Sheet>}
      {sheet === 'newZone' && room && <Sheet title={`Zona en ${room.name}`} onClose={() => setSheet(null)}><SpaceForm parentId={room.id} onDone={() => setSheet(null)} /></Sheet>}
      {sheet === 'newAsset' && <Sheet title="Registrar objeto" onClose={() => setSheet(null)}><AssetForm spaceId={room?.id} onDone={() => setSheet(null)} /></Sheet>}
      {sheet === 'newTask' && <Sheet title="Nueva tarea" onClose={() => setSheet(null)}><TaskForm onDone={() => setSheet(null)} /></Sheet>}
      {taskId && <TaskDetail id={taskId} onClose={() => setTaskId(undefined)} />}
      {assetId && <AssetDetail id={assetId} onClose={() => setAssetId(undefined)} />}
      {build && <PlanEditor onClose={() => setBuild(false)} />}
    </main>
  );
}
