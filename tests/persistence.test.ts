import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { seedDemo } from '../src/domain/demo';
import { moveAsset } from '../src/domain/inventory';
import { emptyState } from '../src/domain/types';
import { exportJSON, importJSON, inventoryCSV } from '../src/persistence/backup';
import { IndexedDbRepository } from '../src/persistence/repository';
import { fakeClock } from './helpers';

const c = fakeClock();
const demo = () => seedDemo(emptyState(), c, 'Vamo', 'Casa', 'propia');

describe('persistencia IndexedDB', () => {
  it('guarda y recupera el estado al "reabrir" la app', async () => {
    const s = demo();
    await new IndexedDbRepository('t1').save(s);
    const reopened = await new IndexedDbRepository('t1').load();
    expect(reopened).toEqual(s);
  });
  it('borrar deja la base vacía', async () => {
    const r = new IndexedDbRepository('t2');
    await r.save(demo());
    await r.clear();
    expect(await r.load()).toBeNull();
  });
});

describe('respaldo JSON', () => {
  it('exportar → borrar → importar recupera el estado sin pérdida', async () => {
    let s = demo();
    s = moveAsset(s, c, s.assets[0].id, s.spaces[0].id);
    const json = exportJSON(s);
    const r = new IndexedDbRepository('t3');
    await r.clear();
    const back = importJSON(json);
    await r.save(back);
    expect(await r.load()).toEqual(s);
    expect(back.assets[0].attributes).toEqual(s.assets[0].attributes);
  });
  it('rechaza archivos ajenos, rotos o de versiones futuras', () => {
    expect(() => importJSON('no json')).toThrow('JSON');
    expect(() => importJSON('{"app":"otra"}')).toThrow("Vamo's House");
    expect(() => importJSON(JSON.stringify({ app: 'vamos-house', schemaVersion: 99, data: {} }))).toThrow('más nueva');
    const s = demo();
    s.assets[0].spaceId = 'fantasma';
    expect(() => importJSON(exportJSON(s))).toThrow('espacio inexistente');
    const t = demo();
    (t.assets[1].attributes as Record<string, unknown>).ram = 'mucha';
    expect(() => importJSON(exportJSON(t))).toThrow('atributos');
  });
  it('genera CSV con encabezado y una fila por objeto', () => {
    const lines = inventoryCSV(demo()).split('\n');
    expect(lines[0]).toMatch(/^id,nombre,grupo/);
    expect(lines).toHaveLength(6);
  });
});
