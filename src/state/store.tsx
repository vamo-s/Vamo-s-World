import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { DomainError, systemClock, type Clock } from '../domain/inventory';
import { migrate } from '../domain/migrate';
import { SCHEMA_VERSION, emptyState, type AppState } from '../domain/types';
import type { StateRepository } from '../persistence/repository';

// Estado global: un único documento que se guarda en el repositorio tras cada cambio.

interface Store {
  state: AppState;
  /** Aplica una operación de dominio; si falla, muestra el error y devuelve false. */
  run: (op: (s: AppState, c: Clock) => AppState) => boolean;
  replace: (s: AppState) => void;
  reset: () => Promise<void>;
  toast: string | null;
  notify: (msg: string) => void;
  saveError: boolean;
  /** Confirmación dentro de la app (algunos visores bloquean window.confirm). */
  ask: (msg: string, okLabel?: string) => Promise<boolean>;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ repo, children }: { repo: StateRepository; children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [saveError, setSaveError] = useState(false);
  const [question, setQuestion] = useState<{ msg: string; ok: string; done: (v: boolean) => void } | null>(null);
  const timer = useRef<number>();
  const loaded = useRef(false);
  /** Si no se pudo leer lo guardado, no pisarlo nunca con un estado vacío. */
  const loadFailed = useRef(false);
  const current = useRef<AppState | null>(null);
  current.current = state;

  useEffect(() => {
    repo.load().then((s) => setState(!s ? emptyState()
      : (s.schemaVersion ?? 1) < SCHEMA_VERSION ? (migrate(s as unknown as Record<string, unknown>, s.schemaVersion ?? 1) as unknown as AppState) : s)).catch(() => { loadFailed.current = true; setSaveError(true); setState(emptyState()); });
  }, [repo]);

  useEffect(() => {
    if (!state) return;
    if (!loaded.current) { loaded.current = true; return; }
    if (loadFailed.current) return;
    repo.save(state).then(() => setSaveError(false)).catch(() => setSaveError(true));
  }, [state, repo]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const run = useCallback((op: (s: AppState, c: Clock) => AppState) => {
    try {
      const next = op(current.current!, systemClock);
      current.current = next;
      setState(next);
      return true;
    } catch (e) {
      notify(e instanceof DomainError ? e.message : 'Algo falló. No se guardó el cambio.');
      return false;
    }
  }, [notify]);

  if (!state) return <div className="loading">Cargando tu casa…</div>;
  const value: Store = {
    state, run, toast, notify, saveError,
    ask: (msg, ok = 'Sí, seguir') => new Promise<boolean>((done) => setQuestion({ msg, ok, done })),
    replace: (s) => setState(s),
    reset: async () => { await repo.clear(); loaded.current = false; setState(emptyState()); },
  };
  const answer = (v: boolean) => { question?.done(v); setQuestion(null); };
  return (
    <Ctx.Provider value={value}>
      {children}
      {question && (
        <div className="sheet-backdrop confirm" onClick={() => answer(false)}>
          <section className="sheet" role="alertdialog" aria-modal="true" aria-label="Confirmar" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-body">
              <p className="confirm-msg">{question.msg}</p>
              <div className="actions">
                <button className="btn primary" onClick={() => answer(true)} autoFocus>{question.ok}</button>
                <button className="btn ghost" onClick={() => answer(false)}>Cancelar</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('useStore fuera de StoreProvider');
  return s;
}
