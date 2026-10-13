# Roadmap

Numeración: los "hitos" del prompt v0.4 empiezan en 0. Equivalencias abajo.

## Hito 0: MVP v0.3 (en curso)
- [x] Hogar, espacios con zonas, casa isométrica, inventario universal con fichas, eventos, persistencia IndexedDB, respaldo JSON/CSV, PWA. *(antes "Hito 1")*
- [x] Mantenimiento con bitácora y evidencia declarada; economía manual con presupuesto y simulado aparte; misiones y XP; festividades con reclamo único. *(antes "Hito 2")*
- [ ] Proyecto DEMO "Cambiar una puerta" + catálogo DEMO + misión "Planificar una mejora". *(antes "Hito 3")*
- [ ] Publicar en URL propia (GitHub Pages o Netlify; necesita una cuenta de Vamo).

## Hito 1: Vamo's Pets local
Perfiles (nombre, especie, raza, nacimiento o edad estimada, foto, tutor), rutinas (alimentación, paseos, higiene, medicación, veterinario, vacunas) como tareas reutilizando `MaintenanceTask`, gastos vía `MoneyEntry`, insumos vía `Asset`, misiones de cuidado.
Sin GPS, sin diagnósticos, sin culpa si no se abre la app. Distinguir declarado de certificado por profesional.
Aceptación: dos mascotas, editar fichas, registrar un cuidado, reabrir sin pérdida.

## Hito 2: cuentas y sincronización opcional
Supabase Auth + PostgreSQL con RLS por hogar; `SupabaseRepository` con la misma interfaz. Perfil público mínimo separado del privado.

## Hito 3: Friends básico
Solicitudes (pendiente, aceptada, rechazada, bloqueada), nunca auto-aceptadas; visibilidad por recurso; bloqueo. Sin chat ni tiempo real.
Casas virtuales: solo habitaciones/objetos publicados a propósito; nunca dirección, rutinas, ingresos, documentos ni ubicación de mascotas.

## Hito 4: Vamo's World DEMO
Mapa o lista de establecimientos ficticios rotulados DEMO, búsqueda manual por ciudad/zona (sin pedir geolocalización).

## Hito 5: Vamo's Sports DEMO
Establecimiento > sede > recurso reservable > disponibilidad > reglas > precio > reserva, con estados borrador → consultada → retenida → pendiente → confirmada/cancelada/completada/no-show. Sin solapamientos, cambios auditables, una reserva DEMO nunca parece confirmada.

## Hito 6: piloto real con un complejo deportivo
Con acuerdo explícito: disponibilidad administrada por el complejo, confirmaciones, cancelaciones y soporte.

## Después
Pagos reales (proveedor externo, webhooks, idempotencia), comercios de otros rubros con oferta unificada (producto, servicio, recurso reservable, alquiler, experiencia), panel del comerciante, logística Girasol, alquiler de herramientas, Vamo's Rewards con puntos financiados, IoT verificado.
Módulos sobre el mismo inventario: Laundry (reemplazaría a la base Notion "Inventario de ropa"), Food, Cleaning, Tech, Desk, Garden, Mobility.
Nunca implementar todas las fases a la vez.
