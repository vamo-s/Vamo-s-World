import { useState } from 'react';
import { MISSIONS, addHoliday, claimHoliday, claimMission, hasKey, level, toggleHoliday, totalXP, upcoming } from '../domain/progress';
import type { HolidayKind } from '../domain/types';
import { useStore } from '../state/store';
import { DemoBadge, Field, Sheet, fmtDate } from './common';

const KIND: Record<HolidayKind, string> = { feriado: 'Feriado nacional', cultural: 'Celebración cultural', juego: 'Evento del juego' };
const fmtDay = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', timeZone: 'UTC' });

export function MissionsView() {
  const { state, run, notify } = useStore();
  const [celebrate, setCelebrate] = useState<string>();
  const [calendar, setCalendar] = useState(false);
  const [adding, setAdding] = useState(false);
  const [nh, setNh] = useState({ name: '', date: '', kind: 'juego' as HolidayKind });
  const now = new Date().toISOString();
  const xp = totalXP(state);
  const lv = level(xp);
  const fest = upcoming(state, now);
  const today = fest.filter((f) => f.eligible || (f.claimed && f.holiday.alwaysToday));

  const claim = (fn: () => boolean, msg: string) => { if (fn()) { setCelebrate(msg); notify(msg); setTimeout(() => setCelebrate(undefined), 1600); } };

  return (
    <main className="view">
      <header className="hero"><div><h1>Misiones</h1><p className="muted">XP sin valor en dinero: mide lo que hiciste en tu casa.</p></div></header>
      <section className="card level">
        <div className="level-row"><strong>Nivel {lv.level}</strong><span className="num">{xp} XP</span></div>
        <span className="bar big" role="progressbar" aria-valuenow={lv.into} aria-valuemin={0} aria-valuemax={100} aria-label="Progreso al próximo nivel"><span style={{ width: `${lv.into}%` }} /></span>
        <small className="muted">{lv.next - lv.into} XP para el nivel {lv.level + 1}</small>
        {celebrate && <div className="burst" aria-hidden>✨ +XP ✨</div>}
      </section>

      {today.length > 0 && (
        <section className="card festive-card">
          <h2>🎉 Hoy se celebra</h2>
          {today.map((f) => (
            <div key={f.holiday.id} className="fest-row">
              <div className="grow">
                <strong>{f.holiday.name}</strong> {f.holiday.isDemo && <DemoBadge />}
                <br /><small className="muted">{KIND[f.holiday.kind]} · +{f.holiday.xp} XP simbólicos</small>
              </div>
              {f.claimed ? <span className="badge">Reclamada</span>
                : <button className="btn primary" onClick={() => claim(() => run((s, c) => claimHoliday(s, c, f.holiday.id)), `+${f.holiday.xp} XP por ${f.holiday.name}`)}>Reclamar</button>}
            </div>
          ))}
        </section>
      )}

      <section className="card">
        <h2>Misiones</h2>
        <ul className="missions">
          {MISSIONS.map((m) => {
            const p = m.progress(state);
            const done = hasKey(state, `mision:${m.id}`);
            const ready = !!p && p.value >= p.goal && !done;
            return (
              <li key={m.id} className={done ? 'done' : !p ? 'locked' : ''}>
                <div className="grow">
                  <strong>{done ? '✓ ' : ''}{m.title}</strong> <span className="badge">+{m.xp} XP</span>
                  <br /><small className="muted">{p ? m.description : m.lockedNote}</small>
                  {p && !done && <span className="bar" aria-label={`${p.value} de ${p.goal}`}><span style={{ width: `${(p.value / p.goal) * 100}%` }} /></span>}
                </div>
                {ready && <button className="btn primary" onClick={() => claim(() => run((s, c) => claimMission(s, c, m.id)), `+${m.xp} XP: ${m.title}`)}>Reclamar</button>}
                {p && !done && !ready && <span className="num muted">{p.value}/{p.goal}</span>}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="actions">
        <button className="btn" onClick={() => setCalendar(true)}>📅 Calendario de festividades</button>
      </div>

      <section className="card">
        <h2>Historial de XP</h2>
        {state.xp.length ? (
          <ul className="timeline">
            {state.xp.slice().reverse().map((e) => <li key={e.id}><time>{fmtDate(e.at)}</time> +{e.xp} XP · {e.reason}</li>)}
          </ul>
        ) : <p className="muted">Todavía no ganaste XP. Empezá por registrar 5 objetos.</p>}
      </section>

      {calendar && (
        <Sheet title="Festividades" onClose={() => setCalendar(false)}>
          <details className="rules">
            <summary>Reglas</summary>
            <ul>
              <li>Cada festividad da XP simbólico una vez por año, en su fecha o hasta 3 días después.</li>
              <li>No hace falta comprar, invitar ni compartir nada.</li>
              <li>Se usa la fecha de Córdoba de este dispositivo. Sin servidor, cambiar el reloj del teléfono puede alterar la fecha: el XP no tiene valor, así que no se controla más.</li>
              <li>Los feriados trasladables (Carnaval, Semana Santa, Güemes, San Martín, etc.) cambian cada año: agregalos vos con la fecha oficial.</li>
            </ul>
          </details>
          <ul className="list fests">
            {fest.map((f) => (
              <li key={f.holiday.id} className="fest-row">
                <div className="grow">
                  <strong>{f.holiday.name}</strong> {f.holiday.isDemo && <DemoBadge />}
                  <br /><small className="muted">{f.holiday.alwaysToday ? 'Siempre hoy (prueba)' : fmtDay(f.date)} · {KIND[f.holiday.kind]} · {f.holiday.source}{f.claimed ? ' · reclamada' : ''}</small>
                </div>
                <label className="switch"><input type="checkbox" checked={f.holiday.active} onChange={(e) => run((s) => toggleHoliday(s, f.holiday.id, e.target.checked))} aria-label={`Activar ${f.holiday.name}`} /> Activa</label>
              </li>
            ))}
          </ul>
          {adding ? (
            <form className="form" onSubmit={(e) => {
              e.preventDefault();
              if (run((s, c) => addHoliday(s, c, { name: nh.name, monthDay: nh.date.slice(5), kind: nh.kind }))) { setAdding(false); setNh({ name: '', date: '', kind: 'juego' }); notify('Festividad agregada'); }
            }}>
              <div className="row2">
                <Field label="Nombre"><input id="fest-name" value={nh.name} onChange={(e) => setNh({ ...nh, name: e.target.value })} required maxLength={60} /></Field>
                <Field label="Fecha (se repite cada año)"><input id="fest-date" type="date" value={nh.date} onChange={(e) => setNh({ ...nh, date: e.target.value })} required /></Field>
                <Field label="Tipo">
                  <select id="fest-kind" value={nh.kind} onChange={(e) => setNh({ ...nh, kind: e.target.value as HolidayKind })}>
                    {(Object.keys(KIND) as HolidayKind[]).map((k) => <option key={k} value={k}>{KIND[k]}</option>)}
                  </select>
                </Field>
              </div>
              <button className="btn primary" type="submit">Agregar</button>
            </form>
          ) : <button className="btn" onClick={() => setAdding(true)}>＋ Agregar festividad</button>}
        </Sheet>
      )}
    </main>
  );
}
