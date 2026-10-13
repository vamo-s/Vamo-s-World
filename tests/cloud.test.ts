import { describe, expect, it } from 'vitest';
import { fingerprint, joinBlobs, splitBlobs } from '../src/cloud/blobs';
import { addAsset, setupHousehold } from '../src/domain/inventory';
import { setSketch } from '../src/domain/layout';
import { emptyState } from '../src/domain/types';
import { fakeClock } from './helpers';

const c = fakeClock();
const img = (n: number) => 'data:image/jpeg;base64,' + 'A'.repeat(n);

describe('nube: imágenes fuera del documento principal', () => {
  it('separa fotos y boceto y los vuelve a unir igual', () => {
    let s = setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
    s = addAsset(s, c, { name: 'Mate', kind: 'activo', groupId: 'equipamiento', subcategory: 'Mueble', templateId: 'generico', tenure: 'propio', origin: 'declarado', photo: img(5000) });
    s = addAsset(s, c, { name: 'Pava', kind: 'activo', groupId: 'equipamiento', subcategory: 'Mueble', templateId: 'generico', tenure: 'propio', origin: 'declarado' });
    s = setSketch(s, c, { image: img(8000), x: 0, y: 0, w: 1000, opacity: 0.5 });
    const { state, blobs } = splitBlobs(s);
    expect(Object.keys(blobs).sort()).toEqual([`asset_${s.assets[0].id}`, 'sketch']);
    expect(JSON.stringify(state).length).toBeLessThan(JSON.stringify(s).length - 12000);
    expect(joinBlobs(state, blobs)).toEqual(s);
  });
  it('si falta la imagen del boceto, se quita en vez de romper', () => {
    let s = setupHousehold(emptyState(), c, { alias: 'V', homeName: 'Casa', tenure: 'propia' });
    s = setSketch(s, c, { image: img(10), x: 0, y: 0, w: 1000, opacity: 0.5 });
    expect(joinBlobs(splitBlobs(s).state, {}).household!.sketch).toBeUndefined();
  });
  it('la huella cambia si cambia la imagen', () => {
    expect(fingerprint(img(500))).not.toBe(fingerprint(img(501)));
  });
});
