import { useState } from 'react';
import { TEMPLATES } from '../domain/attributes';
import { activeSpaces, addAsset, updateAsset, type AssetInput } from '../domain/inventory';
import { ASSET_KINDS, ASSET_TENURE, CONDITIONS } from '../domain/labels';
import { TAXONOMY, groupById, suggestFor } from '../domain/taxonomy';
import type { Asset, AssetKind, AssetTenure, Condition, TemplateId } from '../domain/types';
import { useStore } from '../state/store';
import { Field } from './common';

/** Reduce la foto a 480px JPEG para no inflar el almacenamiento local. */
async function shrinkPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, ko) => {
      const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = url;
    });
    const k = Math.min(1, 480 / Math.max(img.width, img.height));
    const cv = document.createElement('canvas');
    cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
    cv.getContext('2d')!.drawImage(img, 0, 0, cv.width, cv.height);
    return cv.toDataURL('image/jpeg', 0.7);
  } finally { URL.revokeObjectURL(url); }
}

type Draft = Record<string, string>;

const toDraft = (a?: Asset, spaceId?: string): Draft => ({
  name: a?.name ?? '', groupId: a?.groupId ?? 'equipamiento', subcategory: a?.subcategory ?? '',
  kind: a?.kind ?? '', templateId: a?.templateId ?? '', spaceId: a?.spaceId ?? spaceId ?? '',
  tenure: a?.tenure ?? 'propio', condition: a?.condition ?? '', quantity: a?.quantity?.toString() ?? '',
  unit: a?.unit ?? '', brand: a?.brand ?? '', model: a?.model ?? '', serial: a?.serial ?? '',
  acquiredAt: a?.acquiredAt ?? '', cost: a?.cost?.amount.toString() ?? '', description: a?.description ?? '',
  owner: a?.owner ?? '', custodian: a?.custodian ?? '', origin: a?.origin === 'estimado' ? 'estimado' : 'declarado',
});

export function AssetForm({ asset, spaceId, onDone }: { asset?: Asset; spaceId?: string; onDone: () => void }) {
  const { state, run, notify } = useStore();
  const [d, setD] = useState<Draft>(() => toDraft(asset, spaceId));
  const [attrs, setAttrs] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(asset?.attributes ?? {}).map(([k, v]) => [k, String(v)])));
  const [photo, setPhoto] = useState<string | undefined>(asset?.photo);
  const [more, setMore] = useState(!!asset);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setD((x) => ({ ...x, [k]: e.target.value }));

  const sug = suggestFor(d.groupId, d.subcategory);
  const templateId = (d.templateId || sug.template) as TemplateId;
  const kind = (d.kind || sug.kind) as AssetKind;
  const group = groupById(d.groupId);
  const num = (v: string) => (v.trim() === '' ? undefined : Number(v.replace(',', '.')));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const cost = num(d.cost);
    const input: AssetInput = {
      name: d.name, groupId: d.groupId, subcategory: d.subcategory.trim() || (group?.name ?? 'Otro'),
      kind, templateId, spaceId: d.spaceId || undefined, tenure: d.tenure as AssetTenure,
      condition: (d.condition || undefined) as Condition | undefined,
      quantity: num(d.quantity), unit: d.unit || undefined, brand: d.brand || undefined, model: d.model || undefined,
      serial: d.serial || undefined, acquiredAt: d.acquiredAt || undefined,
      cost: cost === undefined ? undefined : { amount: cost, currency: 'ARS' },
      description: d.description || undefined, owner: d.owner || undefined, custodian: d.custodian || undefined,
      origin: asset?.origin === 'demo' ? 'demo' : (d.origin as 'declarado' | 'estimado'), attributes: attrs, photo,
    };
    const ok = run((s, c) => (asset ? updateAsset(s, c, asset.id, input) : addAsset(s, c, input)));
    if (ok) { notify(asset ? 'Cambios guardados' : `${d.name.trim()} registrado`); onDone(); }
  };

  return (
    <form className="form" onSubmit={submit}>
      <Field label="Nombre *">
        <input value={d.name} onChange={set('name')} required maxLength={80} autoFocus={!asset} placeholder="Ej: Pava eléctrica" />
      </Field>
      <div className="row2">
        <Field label="Grupo *">
          <select value={d.groupId} onChange={(e) => setD((x) => ({ ...x, groupId: e.target.value, subcategory: '', templateId: '', kind: '' }))}>
            {TAXONOMY.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </Field>
        <Field label="Subcategoría" hint="Elegí o escribí una nueva">
          <input list="subcats" value={d.subcategory} onChange={(e) => setD((x) => ({ ...x, subcategory: e.target.value, templateId: '' }))} maxLength={60} />
          <datalist id="subcats">{group?.subcategories.map((s) => <option key={s.name} value={s.name} />)}</datalist>
        </Field>
      </div>
      <Field label="¿Dónde está?">
        <select value={d.spaceId} onChange={set('spaceId')}>
          <option value="">Sin ubicación</option>
          {activeSpaces(state).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </Field>

      {TEMPLATES[templateId].attributes.length > 0 && (
        <fieldset className="attrs">
          <legend>Ficha de {TEMPLATES[templateId].name.toLowerCase()} <small>(todo opcional)</small></legend>
          <div className="row2">
            {TEMPLATES[templateId].attributes.map((a) => (
              <Field key={a.key} label={a.unit ? `${a.label} (${a.unit})` : a.label}>
                {a.type === 'select' || a.type === 'boolean' ? (
                  <select value={attrs[a.key] ?? ''} onChange={(e) => setAttrs((x) => ({ ...x, [a.key]: e.target.value }))}>
                    <option value="">—</option>
                    {a.type === 'boolean'
                      ? [<option key="t" value="true">Sí</option>, <option key="f" value="false">No</option>]
                      : a.options!.map((o) => <option key={o}>{o}</option>)}
                  </select>
                ) : (
                  <input type={a.type === 'number' ? 'text' : a.type} inputMode={a.type === 'number' ? 'decimal' : undefined}
                    value={attrs[a.key] ?? ''} onChange={(e) => setAttrs((x) => ({ ...x, [a.key]: e.target.value }))} />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
      )}

      <button type="button" className="link" onClick={() => setMore(!more)} aria-expanded={more}>
        {more ? '▾ Menos detalles' : '▸ Más detalles (tenencia, estado, costo, foto…)'}
      </button>
      {more && (
        <div className="more">
          <div className="row2">
            <Field label="Tipo">
              <select value={kind} onChange={set('kind')}>
                {(Object.keys(ASSET_KINDS) as AssetKind[]).map((k) => <option key={k} value={k}>{ASSET_KINDS[k]}</option>)}
              </select>
            </Field>
            <Field label="Ficha">
              <select value={templateId} onChange={set('templateId')}>
                {(Object.keys(TEMPLATES) as TemplateId[]).map((t) => <option key={t} value={t}>{TEMPLATES[t].name}</option>)}
              </select>
            </Field>
            <Field label="Tenencia" hint="Registrar no prueba propiedad legal">
              <select value={d.tenure} onChange={set('tenure')}>
                {(Object.keys(ASSET_TENURE) as AssetTenure[]).map((t) => <option key={t} value={t}>{ASSET_TENURE[t]}</option>)}
              </select>
            </Field>
            <Field label="Estado declarado">
              <select value={d.condition} onChange={set('condition')}>
                <option value="">—</option>
                {(Object.keys(CONDITIONS) as Condition[]).map((t) => <option key={t} value={t}>{CONDITIONS[t]}</option>)}
              </select>
            </Field>
            <Field label="Titular"><input value={d.owner} onChange={set('owner')} maxLength={60} /></Field>
            <Field label="Custodia"><input value={d.custodian} onChange={set('custodian')} maxLength={60} /></Field>
            <Field label="Cantidad"><input inputMode="decimal" value={d.quantity} onChange={set('quantity')} /></Field>
            <Field label="Unidad"><input value={d.unit} onChange={set('unit')} placeholder="u, kg, l…" maxLength={12} /></Field>
            <Field label="Marca"><input value={d.brand} onChange={set('brand')} maxLength={60} /></Field>
            <Field label="Modelo"><input value={d.model} onChange={set('model')} maxLength={60} /></Field>
            <Field label="N° de serie"><input value={d.serial} onChange={set('serial')} maxLength={80} /></Field>
            <Field label="Fecha de compra"><input type="date" value={d.acquiredAt} onChange={set('acquiredAt')} /></Field>
            <Field label="Costo (ARS)"><input inputMode="decimal" value={d.cost} onChange={set('cost')} /></Field>
            {asset?.origin !== 'demo' && (
              <Field label="El costo/dato es" hint="'Verificado' queda para validaciones externas futuras">
                <select value={d.origin} onChange={set('origin')}>
                  <option value="declarado">Declarado por mí</option>
                  <option value="estimado">Estimado</option>
                </select>
              </Field>
            )}
          </div>
          <Field label="Notas"><textarea value={d.description} onChange={set('description')} rows={2} maxLength={500} /></Field>
          <Field label="Foto (opcional, queda en este dispositivo)">
            <input type="file" accept="image/*" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) { try { setPhoto(await shrinkPhoto(f)); } catch { notify('No pude leer la foto'); } }
            }} />
          </Field>
          {photo && (
            <div className="photo-row">
              <img src={photo} alt="Foto del objeto" className="thumb" />
              <button type="button" className="btn ghost" onClick={() => setPhoto(undefined)}>Quitar foto</button>
            </div>
          )}
        </div>
      )}
      <button className="btn primary" type="submit">{asset ? 'Guardar cambios' : 'Registrar'}</button>
    </form>
  );
}
