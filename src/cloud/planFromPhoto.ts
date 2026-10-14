import { PLAN_KINDS, normalizeDraft, type PlanDraft } from '../domain/planImport';
import { cloud } from './cloud';

// Lee una foto de un plano o croquis con Gemini (Firebase AI Logic, API gratuita para desarrolladores)
// y devuelve un borrador en centímetros. La foto no se guarda en ningún servidor propio.

const MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];

const PROMPT = `Sos un dibujante de planos. La imagen es una foto de un plano o croquis de una vivienda (puede estar dibujado a mano).
Digitalizalo como habitaciones rectangulares vistas desde arriba, en CENTÍMETROS.
- Origen (0,0) en la esquina superior izquierda del edificio tal como se ve en la foto; x hacia la derecha, y hacia abajo.
- Si hay medidas escritas (en m o cm), usalas. Si no hay, estimá con medidas típicas (puerta 80 cm, cama 140 × 190 cm, baño 150 × 200 cm).
- Habitaciones con forma de L: partilas en dos rectángulos con el mismo nombre seguido de "(parte 2)".
- Habitaciones vecinas comparten pared: que no se superpongan ni dejen huecos.
- kind: uno de ${PLAN_KINDS.join(', ')}. Pasillos, halls y circulación van como "otro".
- name: en español rioplatense, corto (ej. "Cocina", "Dormitorio 1", "Pasillo").
- openings: puertas y ventanas que se vean. room = índice de la habitación en la lista, side = lado de esa habitación (n arriba, e derecha, s abajo, w izquierda), offset = cm desde la esquina izquierda (lados n/s) o superior (lados e/w), width en cm.
- box: rectángulo que ocupa el edificio en la imagen, en milésimos del ancho y alto de la foto (0 a 1000).
- notes: una frase corta si algo no se entendía o se estimó.`;

function schema(S: typeof import('firebase/ai').Schema) {
  const n = () => S.integer();
  return S.object({
    properties: {
      rooms: S.array({ items: S.object({ properties: { name: S.string(), kind: S.enumString({ enum: PLAN_KINDS }), x: n(), y: n(), w: n(), d: n() } }) }),
      openings: S.array({
        items: S.object({ properties: { room: n(), kind: S.enumString({ enum: ['puerta', 'ventana'] }), side: S.enumString({ enum: ['n', 'e', 's', 'w'] }), offset: n(), width: n() } }),
      }),
      box: S.object({ properties: { x0: n(), y0: n(), x1: n(), y1: n() } }),
      notes: S.string(),
    },
    optionalProperties: ['openings', 'box', 'notes'],
  });
}

/** Mensaje entendible para los errores más comunes de la IA. */
export function aiErrorMessage(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? e);
  if (/has not been used|is disabled|SERVICE_DISABLED|API_NOT_ACTIVATED|firebasevertexai/i.test(m) && /403|disabled|not been used/i.test(m))
    return 'La IA todavía no está activada en Firebase (AI Logic). Hay que activarla una vez desde la consola.';
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(m)) return 'Se llegó al límite gratis de la IA por ahora. Probá de nuevo en un rato.';
  if (/network|fetch|Failed to fetch|offline/i.test(m)) return 'Sin conexión: la lectura del plano necesita internet.';
  if (/SAFETY|blocked/i.test(m)) return 'La IA no quiso leer esa imagen. Probá con otra foto del plano.';
  return 'No se pudo leer el plano. Probá con una foto más derecha y con buena luz.';
}

export async function readPlanFromPhoto(image: { base64: string; mimeType: string }, frontCm?: number): Promise<PlanDraft> {
  const [{ app }, ai] = await Promise.all([cloud(), import('firebase/ai')]);
  const inst = ai.getAI(app, { backend: new ai.GoogleAIBackend() });
  const hint = frontCm ? `\nDato del usuario: el frente (ancho total de la vivienda en la foto) mide ${frontCm} cm.` : '';
  let last: unknown;
  for (const model of MODELS) {
    try {
      const m = ai.getGenerativeModel(inst, {
        model,
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema(ai.Schema), temperature: 0.2 },
      });
      const res = await m.generateContent([PROMPT + hint, { inlineData: { data: image.base64, mimeType: image.mimeType } }]);
      const draft = normalizeDraft(JSON.parse(res.response.text()));
      if (!draft.rooms.length) throw new Error('sin habitaciones');
      return draft;
    } catch (e) {
      last = e;
      // Si el modelo no existe más, probar el siguiente; cualquier otro error se informa.
      if (!/404|not found|is not supported/i.test(String((e as Error)?.message))) break;
    }
  }
  throw last;
}

/** Achica la foto (lado mayor 1600 px) para mandarla rápido y gastar menos cuota. */
export async function photoForAI(f: File): Promise<{ base64: string; mimeType: string; dataUrl: string; w: number; h: number }> {
  const img = await createImageBitmap(f);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
  const dataUrl = cv.toDataURL('image/jpeg', 0.8);
  return { base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl, w: cv.width, h: cv.height };
}
