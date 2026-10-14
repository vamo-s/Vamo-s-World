# Decisiones técnicas

| Decisión | Por qué | Trade-off / descarte |
|---|---|---|
| TypeScript + React 18 + Vite 5 | Stack pedido, liviano, build estático gratis de hospedar | Sin framework de rutas: 3 pestañas no lo justifican |
| Sin vite-plugin-pwa; manifest y `sw.js` a mano | Una dependencia pesada (workbox) menos; el SW tiene 25 líneas | Estrategia simple red-primero; sin precache de versiones |
| `idb` (1 KB) sobre IndexedDB | Biblioteca mantenida, más espacio que localStorage, sirve para fotos | Se guarda el estado como un solo documento: simple y atómico; si crece mucho habrá que partirlo por entidad |
| Interfaz `StateRepository` | Permite pasar a Supabase/PostgreSQL sin tocar dominio ni UI | Hoy no hay sincronización ni conflictos multi-dispositivo |
| Dominio puro (`src/domain`) con reloj inyectable | Testeable sin navegador; la UI no tiene reglas de negocio | Operaciones inmutables copian arrays: irrelevante a esta escala |
| Atributos por plantilla con validación (`attributes.ts`) | Ni columnas vacías ni JSON arbitrario; claves desconocidas se descartan | Agregar una plantilla nueva requiere código (categorías del usuario sí son libres) |
| Subcategoría texto libre con sugerencias | Categorías definidas por el usuario sin migrar esquema | Puede haber duplicados por tipeo ("Ropa"/"ropa") |
| Eventos de objeto siempre `origin: 'declarado'` | La app no verifica el mundo físico | — |
| "Verificado" no lo puede elegir el usuario | Reservado para validaciones externas futuras | — |
| Fotos reducidas a 480 px JPEG en el dispositivo | Evita llenar el almacenamiento | Calidad limitada; no sirven como comprobante legal |
| Respaldo JSON con `schemaVersion` y tabla de migraciones | Importar respaldos viejos cuando cambie el esquema | Respaldos de versiones más nuevas se rechazan |
| Emojis del sistema como iconos de habitación | Cero assets de terceros ni licencias | Se ven distinto según el sistema operativo |
| Sin autenticación | MVP local de un solo usuario | No es multiusuario seguro: está aclarado en la UI |

## Hipótesis (no validadas)
- Vivienda como "mapa" isométrico de baldosas alcanza para la sensación de juego en el MVP.
- Registro rápido (nombre + grupo) baja la fricción lo suficiente para llegar a 5 objetos.

## Migración futura a nube (Fase 2)
Supabase Auth + PostgreSQL con tablas por entidad (households, spaces, assets, asset_events), RLS por `household_id`,
storage con políticas para fotos, migraciones versionadas. Implementar `SupabaseRepository` con la misma interfaz.

## Hito 0, segunda parte (2026-10-13)
| Decisión | Por qué | Trade-off |
|---|---|---|
| Esquema v2 con `migrations[1]` aplicado tanto al importar como al leer IndexedDB | Usuarios con datos v1 no pierden nada | Si la lectura falla, la app no guarda encima (protege lo guardado) |
| Montos en ARS sumados en centavos enteros | 0,1 + 0,2 no da 0,30000000000000004 | Máximo 2 decimales |
| Movimientos "simulado" separados del saldo real | Principio de no mezclar real con simulación | — |
| Misiones calculadas a partir del estado, XP como eventos con clave única | Sin contadores que se desincronicen; reclamar dos veces es imposible, también en respaldos importados | La misión no se "pierde" si se borran objetos después de reclamarla |
| Festividades: solo feriados de fecha fija + 2 culturales + DEMO "siempre hoy" | No inventar fechas de feriados trasladables; el usuario los agrega | Hay que cargar Carnaval, Semana Santa, etc. a mano |
| Fecha local de Córdoba vía `Intl` | Evita que un reclamo a las 22 h caiga en el día siguiente UTC | Sin servidor, cambiar el reloj del teléfono altera la fecha; aceptable porque XP no vale dinero |
| Ventana de reclamo 3 días (0 para DEMO), clave `fest:<id>:<año>` | Accesible sin forzar entrar el día exacto | — |
| Tareas sin fecha por defecto | No generar fechas técnicas sin fuente | — |
| Confirmaciones dentro de la app, no `window.confirm` | Algunos visores (y la vista previa) bloquean diálogos del navegador | — |

## Expansión v0.4 (Pets, Friends, Sports, World): decisiones de modelo
- No se crearon tablas ni pantallas vacías. Solo se dejó el modelo preparado:
  - Todas las entidades tienen `id` UUID estable, `householdId` cuando corresponde, `schemaVersion` y borrado lógico: es lo que necesita una sync futura.
  - Mascotas reutilizarán `MaintenanceTask` (rutinas), `MoneyEntry` (gastos, con un futuro `petId` opcional) y `Asset` (alimento, accesorios). `Pet` será una entidad propia, no un `Asset`, porque no es un objeto ni tiene tenencia.
  - Identidad pública (`PublicPlayerProfile`) irá separada de `Player`: nada privado se publica por defecto. Visibilidad por recurso con `PrivacyGrant`, no un flag global.
  - Comercios: una `Offer` base con variantes tipadas (producto, servicio, recurso reservable, alquiler, experiencia) en tablas propias, no una tabla gigante.
  - Reservas: estados explícitos + `BookingStatusEvent` auditable; la prevención de solapamientos necesita backend con transacciones (no se puede garantizar offline).
- Hipótesis comercial (no validada): primer piloto con un solo complejo deportivo de Córdoba.

## Plano editable (2026-10-13)
- Cada habitación guarda `layout {x, y, w, d}` (desde el esquema v3, en centímetros enteros; ver abajo).
- Sin `layout`, se ubica sola en filas de 3 × 3 m; al editar una por primera vez se fijan todas para que no salten.
- Mantener apretado 450 ms entra en edición; arrastrar mueve, las manijas ↔ ↕ cambian ancho y largo. Botones +/− y flechas como alternativa accesible.
- No se permiten superposiciones ni medidas fuera de 1-15 m. Las paredes se dibujan detrás de los pisos, así solo se ven las del contorno.
- Dos capas en el plano: **Espacios** (forma de habitaciones, grilla 1 m) y **Muebles** (objetos del inventario, grilla 0,5 m). Mismo gesto en ambas: tocar abre, mantener apretado edita.
- La ubicación del mueble (`Asset.place`) es relativa a su habitación: si la habitación se mueve, los muebles van con ella; si se achica, se dibujan recortados.
- Arrastrar un mueble a otra habitación cambia su `spaceId` y deja evento "movido". Mover el objeto desde la ficha lo saca del plano (vuelve a la bandeja "Sin ubicar").
- Los muebles pueden superponerse (una tele sobre un mueble); las habitaciones no.

## Modo construcción, puertas y cuentas (2026-10-13, esquema v3)
Organización de la tecnología, pensada como un juego de construcción tipo Sims pero sin motor de juego:

| Capa | Elección | Por qué | Trade-off |
|---|---|---|---|
| Unidades | Centímetros enteros en todo el plano (`migrations[2]` multiplica por 100 lo que había en metros) | Muebles y puertas se miden en cm; enteros evitan errores de redondeo | Un cambio de esquema (v3); probado con test de migración |
| Plano editable | SVG vista desde arriba con `viewBox` en cm (`PlanEditor.tsx`) | Medidas exactas, cotas, texto nítido a cualquier zoom, accesible, cero dependencias | No es 3D; la vista isométrica de la casa sigue para "jugar" |
| Gestos | Pointer Events propios: un dedo desplaza, dos dedos hacen zoom, rueda en PC; solo se arrastra lo ya elegido | Lo que se toca no se mueve sin querer al desplazarse | Hay que tocar una vez para elegir y después arrastrar |
| Herramientas | Elegir, Habitación (dibujar rectángulo con imán de 10 cm), Puerta y Ventana (tocar una pared), Mueble (tocar dentro de una habitación) + inspector con campos en cm | Del boceto rápido a la medida exacta en dos pasos | Solo habitaciones rectangulares (una "L" se arma con dos) |
| Boceto | Foto del dibujo a mano como fondo (reducida a 1200 px JPEG) con ancho real y posición en cm | Calcar el plano encima | Se guarda en el hogar (`household.sketch`) |
| Aberturas | Entidad `Opening` por lado de habitación (`n/e/s/w`, `offset`, `width`, `height`, bisagras) | Validar que entre en la pared y no pise otra | Una puerta entre dos habitaciones se carga en una sola de ellas |
| Puerta ↔ inventario | Cada puerta nueva crea su ficha (plantilla Puerta, tenencia "del inmueble"); editar medidas actualiza la ficha; quitarla la archiva | Una sola verdad para el proyecto "Cambiar una puerta" | — |
| Proyecto DEMO | `ImprovementProject` + catálogo genérico en `catalog.ts`, precios ilustrativos en pesos enteros, sin botón de compra | Cierra el MVP v0.3 sin inventar ofertas reales | Tutorial de colocación vacío a propósito: falta revisión de alguien del oficio |
| Cuentas | Firebase Authentication (Google) + Cloud Firestore, cargado a demanda (`src/cloud/`) | Gratis en el plan Spark, sin servidor propio, funciona desde GitHub Pages | Depende de Google; los datos quedan en `southamerica-east1` |
| Datos por usuario | `users/{uid}/state/main` (estado como JSON) + `users/{uid}/blobs/{clave}` (fotos y boceto, para no pasar 1 MiB) | Las reglas permiten leer/escribir solo `request.auth.uid == userId` | Última escritura gana entre dispositivos |
| Sin conexión | Copia local por usuario en IndexedDB (`vamos-house-<uid>`), subida 1,5 s después del último cambio y al ocultar la app | Se puede jugar sin señal | Si dos dispositivos editan sin conexión a la vez, gana el que guardó último |
| Invitado → cuenta | Si la cuenta es nueva, se sube la casa del dispositivo; si ya tenía datos, se usan los de la cuenta y la casa de invitado queda intacta | No se pierde nada al entrar | — |
| Progresión | XP y nivel viven en el estado: viajan con la cuenta. Misiones nuevas: primera puerta en el plano, amueblar a medida | "Subir de nivel" con la propia casa | El nivel es local hasta que se configure Firebase |

## Muebles estilo Habbo (2026-10-14)
- Cada mueble se dibuja con cajas isométricas en SVG (`src/ui/isoFurniture.tsx`): colores planos en tres tonos, contorno oscuro fino y sombra, como Habbo, pero sin sprites ni imágenes (cero descargas extra, nítido en cualquier pantalla).
- El tipo se deduce del nombre y la subcategoría (cama, sillón, silla, mesa, escritorio, heladera, tele, ropero, planta, lámpara, lavarropas, cocina, inodoro, compu); si no reconoce, es una caja. Respaldo/cabecera van sobre el lado largo de atrás.
- Toque futurista: pantallas, luces y filos con brillo neón (un solo filtro SVG compartido) que late suave; se apaga con "reducir movimiento". Piso en damero de 50 cm con líneas finas tipo "piso inteligente". Paredes más altas (Habbo).
- Las puertas no aparecen en la bandeja de muebles: se ubican desde el Modo construcción.
