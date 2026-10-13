# Vamo's House 0.2

Life tycoon: tu casa real, jugada como un tycoon. Web app instalable (PWA) para iPhone y escritorio.
Sin cuentas, sin nube, sin pagos: los datos quedan en el navegador del dispositivo.

## Qué hace hoy
- Onboarding: alias, tipo de vivienda (propia/alquilada/compartida), nombre del hogar, datos DEMO opcionales.
- Casa isométrica en SVG con dos capas: Espacios (mantener apretado para mover y cambiar ancho/largo de cada habitación) y Muebles (ubicar y dimensionar los objetos del inventario dentro de cada habitación).
- Espacios: crear, editar, archivar; zonas/estantes dentro de un espacio.
- Inventario universal: 6 grupos, subcategorías ampliables, fichas específicas (puerta, computadora, alimento, prenda) y genérica, tenencia, custodia, estado declarado, costo, foto opcional, historial de eventos. Buscar, filtrar, mover, archivar/restaurar.
- Respaldo JSON versionado (exportar/importar/restaurar desde el inicio), CSV de inventario, borrar todo.
- Mantenimiento: tareas con objeto/espacio, fecha opcional, prioridad, responsable, estado, evidencia y bitácora.
- Economía manual en ARS: ingresos, gastos, categorías, presupuestos mensuales y saldo; lo simulado se muestra aparte.
- Misiones y XP sin valor monetario, niveles, historial.
- Festividades: calendario de Argentina configurable, festividad DEMO, reclamo único por año, reglas visibles.
- PWA: manifest, iconos propios, offline para lo local (service worker).

Falta para cerrar el MVP: proyecto DEMO "Cambiar una puerta". Después: Vamo's Pets (ver ROADMAP.md).

## Requisitos
Node.js 20 o superior (probado con 22.22) y npm.

## Instalar, correr y probar
```bash
npm install
npm run dev        # http://localhost:5173 (y la IP de tu red para el celular)
npm test           # tests unitarios (vitest)
npm run build      # chequeo de tipos + build en dist/
npm run preview    # sirve dist/ en http://localhost:4173
CHROMIUM_PATH=/ruta/a/chrome npm run e2e   # recorrido completo en navegador real (con preview corriendo)
```

## Abrir en iPhone
1. Publicá `dist/` (ver Despliegue) para tener una URL https.
2. Abrila en Safari > botón Compartir > "Agregar a pantalla de inicio".
3. Queda como app con icono propio y funciona sin conexión para lo ya cargado.

Para probar en la red local sin publicar: `npm run dev` y abrí `http://IP-de-tu-PC:5173` en el iPhone (sin https no hay modo offline ni instalación completa).

## Despliegue de bajo costo (gratis)
- **Netlify Drop** (sin cuenta de GitHub): `npm run build` y arrastrá la carpeta `dist/` a https://app.netlify.com/drop.
- **GitHub Pages / Cloudflare Pages / Vercel**: subí el repo; comando de build `npm run build`, carpeta `dist`.
El build usa rutas relativas, así que funciona en cualquier subcarpeta.

## Tus datos
- Viven en IndexedDB de ese navegador. Si borrás los datos de Safari, cambiás de teléfono o usás modo privado, se pierden.
- Perfil > "Exportar respaldo (JSON)" seguido. Se restaura desde Perfil o desde la pantalla de inicio.
- No cargues información muy sensible: no hay autenticación ni cifrado en esta versión.

## Estructura
```
src/domain/       reglas puras: tipos, taxonomía, atributos, operaciones de inventario, demo
src/persistence/  repositorio (IndexedDB / memoria) y respaldo JSON/CSV
src/state/        store React: aplica operaciones de dominio y guarda
src/ui/           pantallas y componentes
tests/            unitarios (vitest) y e2e (playwright-core)
public/           manifest, service worker, iconos (scripts/make-icons.py los regenera)
```
Más contexto: DECISIONS.md, ROADMAP.md, TESTING.md, HANDOFF.md.
