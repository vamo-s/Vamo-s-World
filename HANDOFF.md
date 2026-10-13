# Handoff

Estado (2026-10-13): Hito 0 casi completo. Hecho y probado: inventario, mantenimiento, economía, misiones/XP, festividades (ver TESTING.md). Esquema v2.

Para retomar:
```bash
cd vamos-house && npm install && npm test && npm run dev
```

Próximo paso exacto:
1. Proyecto DEMO "Cambiar una puerta" (cierra el MVP v0.3): entidad `ImprovementProject` con items de un catálogo DEMO (`src/domain/catalog.ts`, marcas genéricas, precios ilustrativos), flujo elegir puerta → ficha y medidas → colocar en habitación → presupuesto DEMO → instalación profesional o propia → herramientas → tutorial placeholder → planificar. Al planificar, habilitar la misión `planificar-mejora` (hoy `progress: () => null` en `src/domain/progress.ts`). Subir esquema a v3 con `migrations[2]` en `src/domain/migrate.ts`.
2. Vamo's Pets local (ROADMAP.md, Hito 1).
3. Publicar: falta cuenta de GitHub o Netlify de Vamo.
