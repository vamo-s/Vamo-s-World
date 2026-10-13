# Pruebas

Última corrida: 2026-10-13. Entorno: contenedor Linux, Node 22.22, Chromium headless.

## Ejecutado de verdad
- `npm run build`: chequeo de tipos estricto + build OK.
- `npm test`: 44 tests en verde.
  - Inventario (10): hogar/espacios, validaciones, archivar espacio, registro rápido, 5 objetos + filtros, mover con evento, estado/tenencia, archivar/restaurar, atributos inválidos, demo marcado.
  - Persistencia (5): IndexedDB guardar/recuperar/borrar, exportar → borrar → importar sin pérdida, rechazos de respaldos inválidos, CSV.
  - Plano (5): ubicación automática sin superposición, cambiar ancho/largo fijando las demás, rechazo de superposición y rangos, archivada libera lugar, forma en el respaldo.
  - Muebles (6): ubicar dentro de la habitación, rechazos (fuera, medidas no múltiplo de 0,5), arrastrar a otra habitación muda el objeto con evento, mover desde la ficha lo saca del plano, lugar libre y recorte, respaldo.
  - Hito 0 parte 2 (18): tarea con bitácora y evidencia, fechas no inventadas, orden de tareas; saldo real sin flotantes ni simulado, validaciones, presupuestos; misiones incompletas/duplicadas, demo no cuenta, documentar habitación, niveles; festividad DEMO única tras recargar/reimportar, zona horaria de Córdoba (01:00 UTC del 9/7 sigue siendo 8/7), ventana de reclamo, cambio de año, desactivadas y personalizadas; migración v1 → v2, XP duplicado en respaldo manipulado.
- `npm run e2e` (Chromium, iPhone 390×844 y escritorio 1280×800): onboarding, habitaciones, mantener apretada una habitación y estirar su ancho con la manija + largo con el botón (persiste tras recargar), toque corto sigue abriendo la habitación, capa Muebles: ubicar la Heladera desde la bandeja, agrandarla, arrastrarla a la Pieza (queda mudada) y tocarla para abrir su ficha, 5 objetos, recarga, mover, puerta con ficha, tarea creada y completada con evidencia, ingreso 500.000 y gasto 123.456,50 → saldo 376.543,50, dos misiones reclamadas (90 XP), festividad DEMO reclamada una sola vez y persistente tras recargar, exportar/borrar/restaurar con XP incluido, DEMO etiquetado, sin scroll horizontal, sin errores de consola.

## No probado
- Safari/iPhone real (instalación, offline, mantener apretado con el dedo). Chromium no es WebKit; el e2e usa mouse, no touch.
- Service worker sin conexión.
- Fotos reales de cámara (HEIC).
- Lectores de pantalla.
- Migración v1 → v2 sobre datos reales en IndexedDB (probada sobre respaldo JSON, el código es el mismo).

## Errores conocidos / límites
- Más de ~9 habitaciones achican la casa en móvil.
- El borde de la habitación seleccionada puede quedar tapado por la vecina.
- Los datos dependen del navegador: sin respaldo, se pueden perder.
- La festividad depende del reloj del dispositivo (documentado; el XP no vale dinero).
