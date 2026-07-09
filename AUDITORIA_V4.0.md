# Auditoría V5.01 - Manager de Fútbol

> Nota: este archivo conserva el nombre histórico `AUDITORIA_V4.0.md`, pero el contenido fue actualizado para la base V5.01.

## Resultado general

La versión queda marcada como `V5.01`. Se aplicaron los ajustes pendientes de la auditoría V5.00: separación de Everton por país, mejora de carga con partidas guardadas, compatibilidad de snapshots y documentación de archivos eliminables.

Validación realizada:

- JSON revisados: todos los archivos de `data/*.json` cargan correctamente.
- JavaScript revisado: `node --check` sin errores en `config.js`, `simulador-2.0.js`, `app.js` y módulos de `js/`.
- Datos activos detectados: 162 clubes y 9 divisiones de liga.
- Rutas de escudos activas: sólo quedan pendientes `everton-chi.png` y `everton-eng.png`, porque requieren crear/copiar esos dos PNG manualmente.
- El juego sigue teniendo fallback visual a `img/escudos/everton.png` si todavía no se crearon `everton-chi.png` y `everton-eng.png`.

## Cambios aplicados en V5.01

### Rutas de escudos argentinos

- Se corrigió una conclusión errónea de V5.00: los archivos reales del ZIP para varios clubes argentinos usan marcadores `#U00xx`, no nombres acentuados directos.
- `data/Liga Argentina.json` vuelve a apuntar a las rutas existentes, por ejemplo `V#U00e9lez.png`, `Hurac#U00e1n.png` y equivalentes.
- `normalizeClubCrestPath()` conserva los marcadores `#U00xx` y sólo normaliza `%23U` a `#U`, evitando una petición fallida inicial.

### Everton Chile / Everton Inglaterra

- `data/Liga Chile.json` ahora apunta Everton de Viña del Mar a `img/escudos/everton-chi.png`.
- `data/Liga Inglaterra.json` ahora apunta Everton de Liverpool a `img/escudos/everton-eng.png`.
- `normalizeClubCrestPath()` redirige partidas guardadas antiguas con `everton.png` hacia la ruta nueva según país.
- La función de fallback de escudos ya intentaba `img/escudos/everton.png`, por lo que no se rompe el escudo si los PNG nuevos todavía no fueron creados.

### Rendimiento y guardado

- `init()` revisa si existe una partida guardada con snapshots completos antes de cargar la base.
- Si existe snapshot completo, se evita cargar `data/jugadores.json` en el arranque.
- `data/jugadores.json` vuelve a cargarse cuando se necesita crear partida nueva o al resetear partida local.
- `loadLocal()` permite cargar partidas aunque cambie la firma de seed, siempre que el guardado tenga snapshots completos de clubes y jugadores.
- `resetLocal()` recarga la base completa para evitar que una nueva partida herede snapshots modificados por una partida anterior.

## Archivos candidatos a eliminar en versión completa

Escudos no referenciados por ninguna liga activa:

- `img/escudos/Atenas_Río_Cuarto.png`
- `img/escudos/Ciudad_de_Bolívar.png`
- `img/escudos/Deportivo_Rincón.png`
- `img/escudos/Ituzaingó.png`
- `img/escudos/San_Martín_de_Formosa.png`
- `img/escudos/Sarmiento_La_Banda.png`

JSON legacy no referenciados por la configuración activa:

- `data/estadios.json`
- `data/hinchas.json`

En un ZIP incremental estos archivos no se eliminan automáticamente del repositorio. Para quitarlos hay que borrarlos manualmente o pedir una versión completa limpia.

## Acción manual para Everton

Crear o copiar los archivos:

- `img/escudos/everton-chi.png`
- `img/escudos/everton-eng.png`

Conviene copiar primero el `everton.png` actual y luego reemplazar manualmente el que corresponda por el escudo correcto de cada club. Si se deja `everton.png`, funciona como fallback.
