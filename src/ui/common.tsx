import type { ReactNode } from 'react';
import { ORIGINS } from '../domain/labels';
import type { DataOrigin, SpaceKind } from '../domain/types';

export const SPACE_ICON: Record<SpaceKind, string> = {
  cocina: '🍳', dormitorio: '🛏️', bano: '🛁', lavadero: '🧺', escritorio: '💻',
  living: '🛋️', garaje: '🚗', patio: '🌿', deposito: '📦', otro: '🚪',
};

export function OriginBadge({ origin }: { origin: DataOrigin }) {
  return <span className={`badge badge-${origin}`} title={`Dato ${ORIGINS[origin].toLowerCase()}`}>{ORIGINS[origin]}</span>;
}

export function DemoBadge() {
  return <span className="badge badge-demo" title="Dato ficticio de ejemplo">DEMO</span>;
}

export function Sheet({ title, onClose, children }: { title: ReactNode; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="sheet" role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </header>
        <div className="sheet-body">{children}</div>
      </section>
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

export function Empty({ icon, title, children }: { icon: string; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <div className="empty-icon" aria-hidden>{icon}</div>
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { timeZone: 'America/Argentina/Cordoba', dateStyle: 'short', timeStyle: 'short' });

export const fmtARS = (n: number) => n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
