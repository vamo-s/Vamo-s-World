import { chromium } from 'playwright-core';
// Recorrido de aceptación en un Chromium real. Requiere 'npm run build' y 'npm run preview' en otra terminal.
// Uso: CHROMIUM_PATH=/ruta/a/chromium npm run e2e [carpeta-capturas]
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? 'e2e-out';
mkdirSync(out, { recursive: true });
const BASE = process.env.BASE_URL ?? 'http://localhost:4173/';
const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--headless=new'], headless: false });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, acceptDownloads: true });
const p = await ctx.newPage();
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('dialog', (d) => d.accept());
const yes = async () => p.locator('.confirm .btn.primary').click();
const log = (m) => console.log('✓', m);
await p.goto(BASE);
await p.getByLabel('Tu alias de jugador').fill('Vamo');
await p.getByLabel('Nombre del hogar').fill('Depto Centro');
await p.getByText('Alquilada').click();
await p.getByRole('button', { name: 'Entrar a mi casa' }).click();
await p.getByText('Tu casa está vacía').waitFor(); log('onboarding: hogar creado');
for (const [n, k] of [['Cocina', 'Cocina'], ['Pieza', 'Dormitorio']]) {
  await p.getByRole('button', { name: /Agregar habitación|Habitación o espacio/ }).click();
  await p.getByLabel('Nombre').fill(n);
  await p.getByRole('button', { name: k, exact: true }).click();
  await p.getByRole('button', { name: 'Agregar', exact: true }).click();
}
await p.screenshot({ path: `${out}/1-casa.png` }); log('2 habitaciones creadas');
// plano: mantener apretado y estirar
{
  const room = p.getByRole('button', { name: /^Pieza, 0 objetos/ });
  const bb = await room.boundingBox();
  await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await p.mouse.down(); await p.waitForTimeout(650);
  await p.locator('.edit-bar').waitFor();
  await p.mouse.up();
  const h = await p.locator('.handle').first().boundingBox();
  await p.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await p.mouse.down();
  await p.mouse.move(h.x + 60, h.y + 40, { steps: 8 }); await p.mouse.up();
  const txt = await p.locator('.edit-bar strong').innerText();
  const w = Number(txt.match(/(\d+) × (\d+)/)[1]);
  if (!(w > 300)) throw new Error('el ancho no cambió: ' + txt);
  await p.getByRole('button', { name: 'Más largo' }).click();
  await p.waitForTimeout(300); await p.screenshot({ path: `${out}/1b-editando-plano.png` });
  await p.getByRole('button', { name: 'Listo' }).click();
  await p.reload();
  await p.getByRole('button', { name: new RegExp(`^Pieza, 0 objetos, ${w} por 310 centímetros`) }).waitFor();
  log(`plano: Pieza estirada a ${w} × 310 cm con mantener apretado y persiste`);
  // un toque corto sigue abriendo la habitación
  await p.getByRole('button', { name: /^Cocina, 0 objetos/ }).click();
  await p.getByText('Nada registrado acá todavía').waitFor();
  await p.getByLabel('Cerrar').click();
  log('toque corto abre la habitación');
}
await p.getByRole('button', { name: 'Inventario', exact: true }).click();
const items = ['Pava', 'Heladera', 'Silla', 'Escoba', 'Mate'];
for (const n of items) {
  await p.getByRole('button', { name: /Registrar/ }).first().click();
  await p.getByLabel('Nombre *').fill(n);
  await p.getByLabel('¿Dónde está?').selectOption({ label: 'Cocina' });
  await p.getByRole('button', { name: 'Registrar', exact: true }).last().click();
  await p.getByText(`${n} registrado`).waitFor();
}
log('5 objetos registrados');
await p.reload();
await p.getByRole('button', { name: 'Inventario', exact: true }).click();
for (const n of items) await p.getByText(n, { exact: true }).waitFor();
log('los 5 objetos siguen tras recargar');
await p.getByText('Silla', { exact: true }).click();
await p.getByLabel('Mover a').selectOption({ label: 'Pieza' });
await p.getByText('Cocina → Pieza').waitFor(); log('objeto movido con evento en historial');
await p.screenshot({ path: `${out}/2-ficha.png` });
await p.getByLabel('Cerrar').click();
// puerta con ficha específica
await p.getByRole('button', { name: /Registrar/ }).first().click();
await p.getByLabel('Nombre *').fill('Puerta pieza');
await p.getByLabel('Grupo *').selectOption('vivienda');
await p.getByLabel('Subcategoría').fill('Puerta');
await p.getByLabel('Alto (cm)').fill('200');
await p.getByLabel('Material').selectOption('MDF');
await p.waitForTimeout(500); await p.screenshot({ path: `${out}/3-form-puerta.png` });
await p.getByRole('button', { name: 'Registrar', exact: true }).last().click();
await p.getByText('Puerta pieza registrado').waitFor(); log('puerta con atributos específicos');
await p.getByRole('button', { name: 'Casa', exact: true }).click();
await p.getByRole('button', { name: /Pieza, 1 objetos/ }).click();
await p.getByText('Silla').waitFor(); log('tocar habitación muestra sus objetos');
await p.waitForTimeout(500); await p.screenshot({ path: `${out}/4-habitacion.png` });
await p.getByLabel('Cerrar').click();
// capa de muebles
await p.getByRole('tab', { name: /Muebles/ }).click();
await p.locator('.tray .chips button', { hasText: 'Heladera' }).click();
await p.locator('.edit-bar').getByText(/Heladera · 60 × 60 cm/).waitFor();
await p.getByRole('button', { name: 'Más largo' }).click();
await p.locator('.edit-bar').getByText(/Heladera · 60 × 65 cm/).waitFor();
await p.getByRole('button', { name: 'Listo' }).click();
log('capa muebles: Heladera ubicada en la Cocina y agrandada a 60 × 65 cm');
{
  const it = await p.getByRole('button', { name: /^Heladera, 60 por 65 centímetros/ }).boundingBox();
  const pz = await p.getByRole('button', { name: /^Pieza, / }).boundingBox();
  await p.mouse.move(it.x + it.width / 2, it.y + it.height / 2); await p.mouse.down(); await p.waitForTimeout(650);
  await p.mouse.move(pz.x + pz.width / 2, pz.y + pz.height / 2, { steps: 12 }); await p.mouse.up();
  await p.getByRole('button', { name: 'Listo' }).click();
  await p.getByRole('tab', { name: /Espacios/ }).click();
  await p.getByRole('button', { name: /^Pieza, 2 objetos/ }).waitFor();
  log('arrastrar el mueble a otra habitación lo muda (Pieza: 2 objetos)');
}
await p.getByRole('tab', { name: /Muebles/ }).click();
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/4b-muebles.png` });
await p.getByRole('button', { name: /^Heladera, / }).click();
await p.getByText('Cocina → Pieza').first().waitFor(); log('tocar el mueble abre su ficha con el historial');
await p.getByLabel('Cerrar').click();
await p.getByRole('tab', { name: /Espacios/ }).click();
// mantenimiento
await p.getByRole('button', { name: '＋ Tarea' }).click();
await p.locator('#task-title').fill('Limpiar heladera');
await p.locator('#task-asset').selectOption({ label: 'Heladera' });
await p.getByRole('button', { name: 'Crear tarea' }).click();
await p.getByText('Limpiar heladera').click();
await p.locator('#task-evidence').fill('quedó impecable');
await p.getByRole('button', { name: 'Marcar como hecha' }).click();
await p.getByText('Completada (declarado) · evidencia: quedó impecable').waitFor(); log('tarea de mantenimiento creada y completada');
await p.getByLabel('Cerrar').click();
// economía
await p.getByRole('button', { name: 'Economía', exact: true }).click();
await p.getByRole('button', { name: '＋ Ingreso' }).click();
await p.locator('#money-amount').fill('500000');
await p.getByRole('button', { name: 'Guardar' }).click();
await p.getByRole('button', { name: '＋ Gasto' }).click();
await p.locator('#money-amount').fill('123456,50');
await p.locator('#money-cat').fill('Supermercado');
await p.getByRole('button', { name: 'Guardar' }).click();
await p.locator('.money .total strong').filter({ hasText: '376.543,50' }).waitFor(); log('ingreso y gasto: saldo 376.543,50 correcto');
await p.waitForTimeout(400); await p.screenshot({ path: `${out}/6-economia.png` });
// misiones y festividad
await p.getByRole('button', { name: 'Misiones', exact: true }).click();
await p.locator('.missions li', { hasText: 'Registrar 5 objetos' }).getByRole('button', { name: 'Reclamar' }).click();
await p.locator('.missions li', { hasText: 'Completar un mantenimiento' }).getByRole('button', { name: 'Reclamar' }).click();
await p.locator('.level-row').getByText('90 XP').waitFor(); log('2 misiones reclamadas: 90 XP');
await p.locator('.festive-card').getByRole('button', { name: 'Reclamar' }).click();
await p.locator('.level-row').getByText('100 XP').waitFor();
await p.reload(); await p.getByRole('button', { name: 'Misiones', exact: true }).click();
await p.locator('.festive-card').getByText('Reclamada').waitFor();
if (await p.locator('.festive-card').getByRole('button', { name: 'Reclamar' }).count()) throw new Error('festividad reclamable dos veces');
await p.getByText('Festividad: Festividad DEMO (DEMO)').waitFor(); log('festividad DEMO reclamada una vez, sigue tras recargar y figura en historial');
await p.waitForTimeout(400); await p.screenshot({ path: `${out}/7-misiones.png` });
await p.getByRole('button', { name: 'Casa', exact: true }).click();
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/8-casa-resumen.png`, fullPage: true });
// modo construcción: dibujar habitación, puerta a medida, mueble a medida
await p.getByRole('button', { name: /Modo construcción/ }).click();
await p.getByRole('button', { name: 'Ver toda la casa' }).click();
await p.getByRole('button', { name: 'Alejar' }).click();
await p.getByRole('button', { name: 'Alejar' }).click();
await p.locator('.plan-tools').getByRole('button', { name: 'Habitación' }).click();
{
  const sv = await p.locator('svg.plan').boundingBox();
  await p.mouse.move(sv.x + sv.width * 0.55, sv.y + sv.height * 0.6); await p.mouse.down();
  await p.mouse.move(sv.x + sv.width * 0.9, sv.y + sv.height * 0.75, { steps: 10 }); await p.mouse.up();
}
await p.getByRole('dialog', { name: 'Nueva habitación' }).waitFor();
await p.getByLabel('Nombre').fill('Quincho');
await p.locator('.sheet .num input').first().fill('420');
await p.locator('.sheet .num input').nth(1).fill('350');
await p.getByRole('button', { name: 'Agregar al plano' }).click();
await p.locator('svg.plan .p-dims').getByText('420 cm').waitFor(); await p.locator('svg.plan .p-dims').getByText('350 cm').waitFor(); log('modo construcción: Quincho dibujado y ajustado a 420 × 350 cm');
await p.locator('.inspector').getByLabel('Ancho').waitFor();
await p.locator('.num', { hasText: 'Ancho' }).locator('input').fill('450');
await p.locator('.num', { hasText: 'Ancho' }).locator('input').press('Enter');
await p.locator('svg.plan .p-dims').getByText('450 cm').waitFor(); log('medida exacta desde el inspector: 450 cm');
{
  // puerta: tocar el borde de abajo del Quincho
  await p.locator('.plan-tools').getByRole('button', { name: 'Puerta' }).click();
  await p.waitForTimeout(200);
  const q = await p.locator('.p-room .p-floor').last().boundingBox();
  await p.mouse.click(q.x + q.width / 2, q.y + q.height - 1);
  await p.getByText('Puerta agregada').waitFor();
  await p.locator('.num', { hasText: 'Ancho' }).locator('input').fill('70');
  await p.locator('.num', { hasText: 'Ancho' }).locator('input').press('Enter');
  await p.locator('.num', { hasText: 'Alto' }).locator('input').fill('200');
  await p.locator('.num', { hasText: 'Alto' }).locator('input').press('Enter');
  await p.waitForTimeout(200);
  log('puerta de 70 × 200 cm en la pared de abajo');
  // mueble a medida
  await p.locator('.plan-tools').getByRole('button', { name: 'Mueble' }).click();
  await p.waitForTimeout(200);
  await p.mouse.click(q.x + q.width / 2, q.y + q.height / 2);
  await p.getByLabel('Nombre').fill('Mesa');
  await p.locator('.sheet .num input').first().fill('160');
  await p.locator('.sheet .num input').nth(1).fill('90');
  await p.getByRole('button', { name: 'Agregar', exact: true }).click();
  await p.getByText('Mesa agregado al plano').waitFor(); log('mueble a medida: Mesa 160 × 90 cm');
}
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/9-modo-construccion.png` });
await p.getByRole('button', { name: '← Listo' }).click();
// proyecto DEMO puerta
await p.getByRole('button', { name: '🚪 Cambiar una puerta' }).click();
await p.locator('.choice-list button', { hasText: 'Puerta Quincho' }).click();
await p.getByRole('button', { name: 'Siguiente →' }).click();
await p.getByRole('button', { name: 'Siguiente →' }).click();
await p.locator('.choice-list button', { hasText: 'Puerta placa genérica 70 cm' }).getByText('Mismas medidas').waitFor();
await p.locator('.choice-list button', { hasText: 'Puerta placa genérica 70 cm' }).click();
await p.locator('.door-preview').waitFor();
await p.getByRole('button', { name: 'Siguiente →' }).click();
await p.getByRole('button', { name: 'Siguiente →' }).click();
await p.getByRole('button', { name: /Colocarla yo/ }).click();
await p.getByText('Destornillador plano y Phillips').waitFor();
await p.getByRole('button', { name: 'Siguiente →' }).click();
await p.locator('.sheet input[type=date]').fill('2030-01-15');
await p.getByRole('button', { name: 'Planificar' }).click();
await p.getByText('Proyecto planificado').waitFor();
await p.screenshot({ path: `${out}/10-proyecto-puerta.png` });
await p.getByLabel('Cerrar').click();
await p.getByText(/Cambiar Puerta Quincho .* \(proyecto DEMO\)/).first().waitFor(); log('proyecto DEMO planificado: tarea creada con la fecha elegida');
await p.getByRole('button', { name: 'Misiones', exact: true }).click();
await p.locator('.missions li', { hasText: 'Planificar una mejora' }).getByRole('button', { name: 'Reclamar' }).click();
await p.locator('.level-row').getByText('150 XP').waitFor(); log('misión de mejora reclamada: 150 XP');
await p.getByRole('button', { name: 'Casa', exact: true }).click();
await p.waitForTimeout(300); await p.screenshot({ path: `${out}/11-casa-iso-puerta.png` });
// export -> borrar -> import
await p.getByRole('button', { name: 'Perfil', exact: true }).click();
const [dl] = await Promise.all([p.waitForEvent('download'), p.getByRole('button', { name: 'Exportar respaldo (JSON)' }).click()]);
const file = `${out}/backup.json`; await dl.saveAs(file);
await p.getByRole('button', { name: 'Borrar todo' }).click(); await yes();
await p.getByRole('button', { name: 'Entrar a mi casa' }).waitFor(); log('borrado: vuelve al onboarding');
await p.reload(); await p.getByRole('button', { name: 'Entrar a mi casa' }).waitFor();
await p.locator('input[type=file]').setInputFiles(file);
await p.getByText('Respaldo importado').waitFor();
await p.getByRole('button', { name: 'Inventario', exact: true }).click();
await p.getByText('8 objetos activos').waitFor();
await p.getByRole('button', { name: 'Misiones', exact: true }).click(); await p.locator('.level-row').getByText('150 XP').waitFor();
log('importación recupera objetos y XP');
await p.reload(); await p.getByText('Depto Centro').waitFor(); log('estado importado persiste');
await ctx.close();
// escritorio
const d = await b.newPage({ viewport: { width: 1280, height: 800 } });
await d.goto(BASE);
await d.getByLabel('Tu alias de jugador').fill('Vamo'); await d.getByLabel('Nombre del hogar').fill('Casa demo');
await d.getByText('Cargar habitaciones').click();
await d.getByRole('button', { name: 'Entrar a mi casa' }).click();
await d.getByText('DEMO').first().waitFor(); log('modo demo etiquetado');
await d.screenshot({ path: `${out}/5-escritorio-demo.png` });
const overflow = await d.evaluate(() => document.documentElement.scrollWidth > innerWidth);
console.log(overflow ? '✗ scroll horizontal en escritorio' : '✓ sin scroll horizontal');
console.log(errs.length ? 'ERRORES: ' + errs.join(' | ') : '✓ sin errores de consola');
await b.close();
