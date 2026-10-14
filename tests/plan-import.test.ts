import { describe, expect, it } from 'vitest';
import { setupHousehold } from '../src/domain/inventory';
import { addRoomAt, lotOf } from '../src/domain/layout';
import { liveOpenings } from '../src/domain/openings';
import { dropDraftRoom, importPlan, normalizeDraft, scaleDraft } from '../src/domain/planImport';
import { emptyState } from '../src/domain/types';
import { fakeClock } from './helpers';

const c = fakeClock();
const home = () => setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
// Respuesta típica de la IA: medidas sueltas, una pared que se pisa 20 cm y algo inválido.
const ai = {
  rooms: [
    { name: 'Living comedor', kind: 'living', x: 13, y: 8, w: 503, d: 398 },
    { name: 'Cocina', kind: 'cocina', x: 496, y: 8, w: 300, d: 400 },
    { name: 'Baño', kind: 'bano', x: 13, y: 406, w: 180, d: 220 },
    { name: 'Fantasma', kind: 'sotano', x: 100, y: 100, w: 300, d: 300 },
    { name: 'Raro', kind: 'otro', x: 'a', y: 0, w: 10, d: 10 },
  ],
  openings: [
    { room: 0, kind: 'puerta', side: 's', offset: 300, width: 90 },
    { room: 1, kind: 'ventana', side: 'n', offset: 900, width: 120 },
    { room: 3, kind: 'puerta', side: 'n', offset: 0, width: 80 },
  ],
  box: { x0: 100, y0: 50, x1: 900, y1: 950 },
  notes: 'El baño se estimó.',
};

describe('plano desde una foto', () => {
  it('limpia la respuesta de la IA', () => {
    const d = normalizeDraft(ai);
    expect(d.rooms.map((r) => r.name)).toEqual(['Living comedor', 'Cocina', 'Baño']);
    expect(d.rooms[0]).toMatchObject({ x: 0, y: 0, w: 500, d: 400 });
    // La cocina pisaba 10 cm (tras redondear): se recorta y queda pegada al living.
    expect(d.rooms[1]).toMatchObject({ x: 500, y: 0, w: 290, d: 400 });
    expect(d.rooms[2]).toMatchObject({ x: 0, y: 400, kind: 'bano' });
    expect(d.dropped).toBe(2);
    // La ventana con offset fuera de la pared se acomoda; la del ambiente descartado se va.
    expect(d.openings).toEqual([
      { room: 0, kind: 'puerta', side: 's', offset: 300, width: 90 },
      { room: 1, kind: 'ventana', side: 'n', offset: 170, width: 120 },
    ]);
    expect(normalizeDraft(null).rooms).toEqual([]);
  });

  it('escala y quita habitaciones del borrador', () => {
    const d = scaleDraft(normalizeDraft(ai), 2);
    expect(d.rooms[1]).toMatchObject({ x: 1000, w: 580, d: 800 });
    const e = dropDraftRoom(d, 0);
    expect(e.rooms).toHaveLength(2);
    expect(e.openings).toEqual([{ room: 0, kind: 'ventana', side: 'n', offset: 340, width: 120 }]);
  });

  it('carga el plano en una casa vacía y agranda el terreno', () => {
    const s = importPlan(home(), c, normalizeDraft(ai), { replace: false });
    const rooms = s.spaces.filter((x) => !x.archivedAt);
    expect(rooms.map((r) => r.layout)).toEqual([
      { x: 0, y: 0, w: 500, d: 400 }, { x: 500, y: 0, w: 290, d: 400 }, { x: 0, y: 400, w: 180, d: 220 },
    ]);
    expect(liveOpenings(s)).toHaveLength(2);
    expect(s.assets.filter((a) => a.templateId === 'puerta')).toHaveLength(1);
    expect(lotOf(s).w).toBe(1000);
  });

  it('reemplaza (archivando) o suma al lado', () => {
    let s = addRoomAt(home(), c, { name: 'Vieja', kind: 'otro', rect: { x: 0, y: 0, w: 300, d: 300 } });
    const side = importPlan(s, c, normalizeDraft(ai), { replace: false });
    expect(side.spaces.find((x) => x.name === 'Living comedor')!.layout!.x).toBe(400);
    s = importPlan(s, c, normalizeDraft(ai), { replace: true });
    expect(s.spaces.find((x) => x.name === 'Vieja')!.archivedAt).toBeTruthy();
    expect(s.spaces.find((x) => x.name === 'Living comedor')!.layout!.x).toBe(0);
    expect(() => importPlan(s, c, normalizeDraft({ rooms: [] }), { replace: false })).toThrow('no tiene habitaciones');
  });
});
