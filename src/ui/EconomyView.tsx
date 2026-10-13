import { useState } from 'react';
import { localDate } from '../domain/dates';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, addMoney, archiveMoney, entriesOfMonth, monthSummary, setBudget } from '../domain/economy';
import type { MoneyType } from '../domain/types';
import { useStore } from '../state/store';
import { Empty, Field, Sheet, fmtARS } from './common';

const shiftMonth = (m: string, d: number) => {
  const [y, mo] = m.split('-').map(Number);
  const t = new Date(Date.UTC(y, mo - 1 + d, 1));
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`;
};
const monthName = (m: string) => new Date(m + '-15T12:00:00Z').toLocaleDateString('es-AR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const num = (v: string) => Number(v.replace(/\./g, '').replace(',', '.'));

export function EconomyView() {
  const { state, run, notify, ask } = useStore();
  const today = localDate(new Date().toISOString());
  const [month, setMonth] = useState(today.slice(0, 7));
  const [form, setForm] = useState<MoneyType | null>(null);
  const [budgets, setBudgets] = useState(false);
  const [d, setD] = useState({ amount: '', date: today, category: '', note: '', nature: 'real' as 'real' | 'simulado' });
  const sum = monthSummary(state, month);
  const list = entriesOfMonth(state, month);
  const activeBudgets = state.budgets.filter((b) => !b.archivedAt);

  return (
    <main className="view">
      <header className="hero"><div><h1>Economía</h1><p className="muted">Todo manual: nada se conecta a bancos.</p></div></header>
      <div className="month-nav">
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Mes anterior">‹</button>
        <strong>{monthName(month)}</strong>
        <button className="icon-btn" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Mes siguiente">›</button>
      </div>
      <section className="card money">
        <div><small>Ingresos</small><strong className="num pos">{fmtARS(sum.income)}</strong></div>
        <div><small>Gastos</small><strong className="num">{fmtARS(sum.expense)}</strong></div>
        <div className="total"><small>Saldo real</small><strong className="num">{fmtARS(sum.balance)}</strong></div>
      </section>
      {(sum.simIncome > 0 || sum.simExpense > 0) && (
        <p className="sim">Simulado aparte (no suma al saldo): ingresos {fmtARS(sum.simIncome)} · gastos {fmtARS(sum.simExpense)} · saldo {fmtARS(sum.simBalance)}</p>
      )}
      <div className="actions">
        <button className="btn primary" onClick={() => { setForm('ingreso'); setD((x) => ({ ...x, category: INCOME_CATEGORIES[0] })); }}>＋ Ingreso</button>
        <button className="btn primary" onClick={() => { setForm('gasto'); setD((x) => ({ ...x, category: EXPENSE_CATEGORIES[0] })); }}>＋ Gasto</button>
        <button className="btn" onClick={() => setBudgets(true)}>Presupuestos</button>
      </div>

      {activeBudgets.length > 0 && (
        <section className="card">
          <h2>Presupuesto del mes</h2>
          <ul className="budgets">
            {activeBudgets.map((b) => {
              const spent = sum.byCategory[b.category] ?? 0;
              const pct = Math.min(100, (spent / b.monthly) * 100);
              return (
                <li key={b.id}>
                  <div className="level-row"><span>{b.category}</span><span className="num">{fmtARS(spent)} de {fmtARS(b.monthly)}</span></div>
                  <span className={`bar${spent > b.monthly ? ' over' : ''}`}><span style={{ width: `${pct}%` }} /></span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="card">
        <h2>Movimientos</h2>
        {list.length ? (
          <ul className="list moves">
            {list.map((m) => (
              <li key={m.id} className="move">
                <span className="grow">
                  <strong>{m.category}</strong> {m.nature === 'simulado' && <span className="badge badge-estimado">Simulado</span>}
                  <small>{m.date.split('-').reverse().join('/')}{m.note && ` · ${m.note}`}</small>
                </span>
                <strong className={`num ${m.type === 'ingreso' ? 'pos' : ''}`}>{m.type === 'ingreso' ? '+' : '−'}{fmtARS(m.amount)}</strong>
                <button className="icon-btn" aria-label="Quitar movimiento" onClick={async () => {
                  if (await ask('¿Quitar este movimiento?', 'Quitar') && run((s, c) => archiveMoney(s, c, m.id))) notify('Movimiento quitado');
                }}>✕</button>
              </li>
            ))}
          </ul>
        ) : <Empty icon="🪙" title="Sin movimientos este mes"><p>Cargá un ingreso o un gasto que ya hayas hecho.</p></Empty>}
      </section>

      {form && (
        <Sheet title={form === 'ingreso' ? 'Nuevo ingreso' : 'Nuevo gasto'} onClose={() => setForm(null)}>
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            if (run((s, c) => addMoney(s, c, { type: form, amount: num(d.amount), date: d.date, category: d.category, note: d.note, nature: d.nature }))) {
              notify(form === 'ingreso' ? 'Ingreso cargado' : 'Gasto cargado');
              setForm(null); setD((x) => ({ ...x, amount: '', note: '' }));
              setMonth(d.date.slice(0, 7));
            }
          }}>
            <div className="row2">
              <Field label="Monto (ARS) *"><input id="money-amount" inputMode="decimal" value={d.amount} onChange={(e) => setD({ ...d, amount: e.target.value })} required autoFocus placeholder="Ej: 25000" /></Field>
              <Field label="Fecha"><input id="money-date" type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} required /></Field>
              <Field label="Categoría">
                <input id="money-cat" list="money-cats" value={d.category} onChange={(e) => setD({ ...d, category: e.target.value })} required maxLength={40} />
                <datalist id="money-cats">{(form === 'ingreso' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c} value={c} />)}</datalist>
              </Field>
              <Field label="Es" hint="Lo simulado no cambia tu saldo real">
                <select id="money-nature" value={d.nature} onChange={(e) => setD({ ...d, nature: e.target.value as 'real' | 'simulado' })}>
                  <option value="real">Real (ya pasó)</option>
                  <option value="simulado">Simulado (plan o prueba)</option>
                </select>
              </Field>
            </div>
            <Field label="Nota"><input id="money-note" value={d.note} onChange={(e) => setD({ ...d, note: e.target.value })} maxLength={120} /></Field>
            <button className="btn primary" type="submit">Guardar</button>
          </form>
        </Sheet>
      )}
      {budgets && (
        <Sheet title="Presupuestos mensuales" onClose={() => setBudgets(false)}>
          <p className="muted">Límite de gasto real por categoría. Dejalo vacío o en 0 para quitarlo.</p>
          <form className="form" onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            let ok = true;
            for (const cat of EXPENSE_CATEGORIES) {
              const v = String(fd.get(cat) ?? '').trim();
              const cur = activeBudgets.find((b) => b.category === cat)?.monthly ?? 0;
              const n = v === '' ? 0 : num(v);
              if (n !== cur) ok = run((s, c) => setBudget(s, c, cat, n)) && ok;
            }
            if (ok) { notify('Presupuestos guardados'); setBudgets(false); }
          }}>
            <div className="row2">
              {EXPENSE_CATEGORIES.map((cat) => (
                <Field key={cat} label={cat}>
                  <input id={`budget-${cat}`} name={cat} inputMode="decimal" defaultValue={activeBudgets.find((b) => b.category === cat)?.monthly ?? ''} />
                </Field>
              ))}
            </div>
            <button className="btn primary" type="submit">Guardar presupuestos</button>
          </form>
        </Sheet>
      )}
    </main>
  );
}
