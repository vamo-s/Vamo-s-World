import { useState } from 'react';
import { useStore } from './state/store';
import { HouseView } from './ui/HouseView';
import { EconomyView } from './ui/EconomyView';
import { InventoryView } from './ui/InventoryView';
import { MissionsView } from './ui/MissionsView';
import { Onboarding } from './ui/Onboarding';
import { ProfileView } from './ui/ProfileView';

const TABS = [
  { id: 'casa', label: 'Casa', icon: '🏠' },
  { id: 'inventario', label: 'Inventario', icon: '🧾' },
  { id: 'misiones', label: 'Misiones', icon: '⭐' },
  { id: 'economia', label: 'Economía', icon: '🪙' },
  { id: 'perfil', label: 'Perfil', icon: '👤' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function App() {
  const { state, toast } = useStore();
  const [tab, setTab] = useState<Tab>('casa');
  return (
    <>
      {!state.household ? <Onboarding /> : (
        <>
          {tab === 'casa' && <HouseView go={setTab} />}
          {tab === 'inventario' && <InventoryView />}
          {tab === 'misiones' && <MissionsView />}
          {tab === 'economia' && <EconomyView />}
          {tab === 'perfil' && <ProfileView />}
          <nav className="tabbar" aria-label="Secciones">
            {TABS.map((t) => (
              <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}>
                <span aria-hidden>{t.icon}</span>{t.label}
              </button>
            ))}
          </nav>
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
