import { describe, expect, it } from 'vitest';
import { addSpace, setupHousehold } from '../src/domain/inventory';
import { addRoomAt, setSpaceLayout } from '../src/domain/layout';
import { addOpening, fitOpening, liveOpenings, openingSegment, removeOpening, updateOpening } from '../src/domain/openings';
import { cancelProject, compatibleDoors, demoBudget, planProject, startDoorProject, updateProject } from '../src/domain/projects';
import { claimMission } from '../src/domain/progress';
import { setTaskStatus } from '../src/domain/tasks';
import { projectStatus } from '../src/domain/projects';
import { emptyState } from '../src/domain/types';
import { exportJSON, importJSON } from '../src/persistence/backup';
import { fakeClock } from './helpers';

const c = fakeClock();
function house() {
  let s = setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
  s = addRoomAt(s, c, { name: 'Living', kind: 'living', rect: { x: 0, y: 0, w: 420, d: 350 } });
  return s;
}
const door = { kind: 'puerta' as const, side: 's' as const, offset: 100, width: 80, height: 205 };

describe('modo construcción', () => {
  it('dibuja una habitación a medida sin mover las automáticas', () => {
    let s = setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
    s = addSpace(s, c, { name: 'Vieja', kind: 'otro' });
    s = addRoomAt(s, c, { name: 'Nueva', kind: 'cocina', rect: { x: 300, y: 0, w: 255, d: 310 } });
    expect(s.spaces[0].layout).toEqual({ x: 0, y: 0, w: 300, d: 300 });
    expect(s.spaces[1].layout).toEqual({ x: 300, y: 0, w: 255, d: 310 });
    expect(() => addRoomAt(s, c, { name: 'X', kind: 'otro', rect: { x: 100, y: 100, w: 300, d: 300 } })).toThrow('Se superpone');
    expect(() => addRoomAt(s, c, { name: 'X', kind: 'otro', rect: { x: 1000, y: 0, w: 20, d: 300 } })).toThrow('fuera de rango');
  });
});

describe('puertas y ventanas', () => {
  it('una puerta queda en la pared y en el inventario con sus medidas', () => {
    let s = house();
    s = addOpening(s, c, { spaceId: s.spaces[0].id, ...door });
    const o = s.openings[0];
    expect(o.assetId).toBe(s.assets[0].id);
    expect(s.assets[0]).toMatchObject({ templateId: 'puerta', tenure: 'del_inmueble', attributes: { ancho: 80, alto: 205 } });
    expect(openingSegment(o, s.spaces[0].layout!)).toEqual([100, 350, 180, 350]);
  });
  it('valida que entre en la pared y que no pise otra abertura', () => {
    let s = house();
    const id = s.spaces[0].id;
    expect(() => addOpening(s, c, { spaceId: id, ...door, offset: 360 })).toThrow('No entra');
    expect(() => addOpening(s, c, { spaceId: id, ...door, width: 30 })).toThrow('Ancho');
    expect(() => addOpening(s, c, { spaceId: id, ...door, offset: 10.5 })).toThrow('enteros');
    s = addOpening(s, c, { spaceId: id, ...door });
    expect(() => addOpening(s, c, { spaceId: id, kind: 'ventana', side: 's', offset: 150, width: 100, height: 100 })).toThrow('Se superpone');
    s = addOpening(s, c, { spaceId: id, kind: 'ventana', side: 'n', offset: 150, width: 100, height: 100 });
    expect(s.assets).toHaveLength(1);
  });
  it('editar la puerta actualiza la ficha; quitarla la archiva', () => {
    let s = house();
    s = addOpening(s, c, { spaceId: s.spaces[0].id, ...door });
    s = updateOpening(s, c, s.openings[0].id, { width: 90 });
    expect(s.assets[0].attributes.ancho).toBe(90);
    s = removeOpening(s, c, s.openings[0].id);
    expect(liveOpenings(s)).toHaveLength(0);
    expect(s.assets[0].archivedAt).toBeTruthy();
  });
  it('si la habitación se achica, la abertura se corre al dibujar', () => {
    let s = house();
    s = addOpening(s, c, { spaceId: s.spaces[0].id, ...door, offset: 300 });
    s = setSpaceLayout(s, c, s.spaces[0].id, { x: 0, y: 0, w: 320, d: 350 });
    expect(fitOpening(s.openings[0], s.spaces[0].layout!)).toMatchObject({ offset: 240, width: 80 });
  });
  it('sobrevive al respaldo', () => {
    let s = house();
    s = addOpening(s, c, { spaceId: s.spaces[0].id, ...door });
    expect(importJSON(exportJSON(s)).openings[0]).toMatchObject(door);
  });
});

describe('proyecto DEMO cambiar una puerta', () => {
  function withDoor() {
    let s = house();
    s = addOpening(s, c, { spaceId: s.spaces[0].id, ...door, width: 70, height: 200 });
    return s;
  }
  it('sugiere productos DEMO compatibles primero', () => {
    const s = withDoor();
    const fits = compatibleDoors(s.assets[0]);
    expect(fits[0]).toMatchObject({ fits: true, door: { width: 70, isDemo: true } });
    expect(fits.filter((f) => f.fits)).toHaveLength(2);
    expect(compatibleDoors(undefined)[0].fits).toBe(false);
  });
  it('presupuesto DEMO suma en pesos enteros', () => {
    expect(demoBudget({ productId: 'demo-placa-70', install: 'profesional' }).total).toBe(95000 + 28000 + 85000);
    expect(demoBudget({ productId: 'demo-placa-70', install: 'propia' }).total).toBe(123000);
  });
  it('planificar crea la tarea con la fecha del usuario y desbloquea la misión', () => {
    let s = withDoor();
    s = startDoorProject(s, c, s.assets[0].id);
    const id = s.projects[0].id;
    expect(() => planProject(s, c, id, '2026-11-01')).toThrow('Faltan pasos');
    s = updateProject(s, c, id, { productId: 'demo-placa-70', install: 'propia' });
    expect(() => planProject(s, c, id, '')).toThrow('fecha');
    s = planProject(s, c, id, '2026-11-01');
    expect(s.projects[0]).toMatchObject({ status: 'planificado', plannedDate: '2026-11-01' });
    expect(s.tasks[0]).toMatchObject({ dueDate: '2026-11-01', assetId: s.assets[0].id });
    s = claimMission(s, c, 'planificar-mejora');
    expect(s.xp.at(-1)!.xp).toBe(50);
    s = setTaskStatus(s, c, s.tasks[0].id, 'hecha');
    expect(projectStatus(s, s.projects[0])).toBe('hecho');
  });
  it('cambiar de puerta borra el modelo elegido; cancelar no toca la tarea', () => {
    let s = withDoor();
    s = addOpening(s, c, { spaceId: s.spaces[0].id, ...door, side: 'n' });
    s = startDoorProject(s, c, s.assets[0].id);
    const id = s.projects[0].id;
    s = updateProject(s, c, id, { productId: 'demo-placa-70' });
    s = updateProject(s, c, id, { targetAssetId: s.assets[1].id });
    expect(s.projects[0].productId).toBeUndefined();
    s = cancelProject(s, c, id);
    expect(s.projects[0].status).toBe('cancelado');
  });
});

describe('terreno', () => {
  it('sin dato, abarca la casa con margen; con dato, limita lo que se construye', async () => {
    const { lotOf, setLot } = await import('../src/domain/layout');
    let s = house();
    expect(lotOf(s)).toEqual({ w: 1000, d: 1000 });
    expect(() => setLot(s, c, { w: 400, d: 1000 })).toThrow('afuera');
    expect(() => setLot(s, c, { w: 100, d: 1000 })).toThrow('terreno va');
    s = setLot(s, c, { w: 800, d: 1200 });
    expect(lotOf(s)).toEqual({ w: 800, d: 1200 });
    expect(() => addRoomAt(s, c, { name: 'Afuera', kind: 'otro', rect: { x: 500, y: 0, w: 400, d: 300 } })).toThrow('Se sale del terreno');
    expect(() => setSpaceLayout(s, c, s.spaces[0].id, { x: 0, y: 0, w: 900, d: 350 })).toThrow('Se sale del terreno');
    expect(importJSON(exportJSON(s)).household!.lot).toEqual({ w: 800, d: 1200 });
  });
});
