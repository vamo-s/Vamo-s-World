import type { Asset } from '../domain/types';
import { useStore } from '../state/store';
import { OriginBadge } from './common';

export function AssetList({ assets, onOpen, showSpace = true }: { assets: Asset[]; onOpen: (id: string) => void; showSpace?: boolean }) {
  const { state } = useStore();
  return (
    <ul className="list">
      {assets.map((a) => (
        <li key={a.id}>
          <button onClick={() => onOpen(a.id)} className={a.archivedAt ? 'archived' : ''}>
            {a.photo ? <img src={a.photo} alt="" className="mini" /> : <span className="mini ph" aria-hidden>{a.name[0]?.toUpperCase()}</span>}
            <span className="grow">
              <strong>{a.name}</strong>
              <small>{a.subcategory}{showSpace && ` · ${state.spaces.find((s) => s.id === a.spaceId)?.name ?? 'Sin ubicación'}`}{a.quantity !== undefined && ` · ${a.quantity} ${a.unit ?? ''}`}</small>
            </span>
            {a.origin !== 'declarado' && <OriginBadge origin={a.origin} />}
          </button>
        </li>
      ))}
    </ul>
  );
}
