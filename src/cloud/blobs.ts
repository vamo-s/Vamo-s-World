import type { AppState } from '../domain/types';

// Firestore limita cada documento a 1 MiB: las imágenes (fotos de objetos y boceto) van
// en documentos aparte y el estado principal queda liviano.

export type Blobs = Record<string, string>;

export function splitBlobs(s: AppState): { state: AppState; blobs: Blobs } {
  const blobs: Blobs = {};
  const assets = s.assets.map((a) => {
    if (!a.photo) return a;
    blobs[`asset_${a.id}`] = a.photo;
    return { ...a, photo: `blob:asset_${a.id}` };
  });
  let household = s.household;
  if (household?.sketch) {
    blobs.sketch = household.sketch.image;
    household = { ...household, sketch: { ...household.sketch, image: 'blob:sketch' } };
  }
  return { state: { ...s, assets, household }, blobs };
}

export function joinBlobs(s: AppState, blobs: Blobs): AppState {
  const get = (ref?: string) => (ref?.startsWith('blob:') ? blobs[ref.slice(5)] : ref);
  const assets = s.assets.map((a) => (a.photo?.startsWith('blob:') ? { ...a, photo: get(a.photo) } : a));
  let household = s.household;
  if (household?.sketch?.image.startsWith('blob:')) {
    const image = get(household.sketch.image);
    household = image ? { ...household, sketch: { ...household.sketch, image } } : { ...household, sketch: undefined };
  }
  return { ...s, assets, household };
}

/** Huella barata para no volver a subir una imagen que no cambió. */
export const fingerprint = (v: string) => {
  let h = 0;
  for (let i = 0; i < v.length; i += 97) h = (h * 31 + v.charCodeAt(i)) | 0;
  return `${v.length}:${h}`;
};
