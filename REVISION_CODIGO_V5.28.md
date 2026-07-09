# Revisión de código V5.28

## Alcance revisado

- Estructura general del ZIP V5.27 completo.
- Carga y validez de archivos JSON en `data/`.
- Sintaxis de todos los archivos `.js` cargados por `index.html`.
- Referencias principales entre `index.html`, `config.js`, `simulador-2.0.js`, módulos de `js/` y documentación.
- Búsqueda estática de funciones declaradas con baja o nula referencia interna.

## Validaciones realizadas

- `node --check` ejecutado sobre `config.js`, `simulador-2.0.js`, `app.js` y todos los módulos de `js/`: sin errores de sintaxis.
- Parseo JSON de los 29 archivos en `data/`: sin errores.
- Conteo de clubes en ligas cargables: 162 clubes en 9 divisiones.
- Revisión de rutas de escudos declaradas en las ligas: sin faltantes detectados.
- Revisión de duplicidad nominal: sólo se repite `Everton`, correctamente separado por país y escudo (`everton-chi.png` / `everton-eng.png`).

## Limpieza aplicada

### `js/game/11-match-engine.js`

Se retiró código heredado del motor alternativo que ya no participaba del flujo actual:

- `expectedGoals()`
- `makeMatchStats()`
- `makeMatchContext()`
- `poisson()`
- `weightedPick()`
- `scorerWeight()`
- `cardWeight()`
- `makeGoal()`
- `makeCards()`
- `makeInjuries()`

Motivo: `simulateMatch()` ya delega en `window.Simulator20.simulateMatch(match)`. Esos helpers pertenecían al cálculo viejo y no eran llamados por el motor actual.

Se conservó `pitchEffect()` porque todavía se usa desde `js/game/09-simulation-economy-training.js` para efectos de campo, desgaste y economía.

También se conservaron los helpers globales que `simulador-2.0.js` usa desde fuera de su IIFE:

- `makeSubstitutions()`
- `makeInjurySubstitutions()`
- `scoreAtMinute()`
- `applyResultToTables()`
- `applyPlayerStats()`
- `applyAvailability()`
- `collectOwnProblems()`
- `removeOwnUnavailableFromTactic()`
- `showMatchReveal()` y funciones asociadas posteriores.

### `js/game/09-simulation-economy-training.js`

Se retiraron wrappers heredados:

- `advanceOneDay()`
- `goToNextMatch()`

Motivo: el flujo actual usa directamente `advanceCalendarOneStep()` desde el botón unificado `advanceUnifiedBtn`.

### Documentación y versión

- Actualizado `README.md` con V5.28 arriba del historial.
- Actualizado `VERSION.md`.
- Actualizado `CARACTERISTICAS_VERSION.md`.
- Actualizado `config.js`, `index.html` y cache-busting a V5.28.
- Actualizado comentario de `app.js`.

## Código que parece eliminable pero no se retiró todavía

Estos elementos aparecen sin llamadas internas directas o con uso muy débil. No los eliminé porque pueden estar relacionados con pantallas en transición, compatibilidad de partidas, acciones futuras o rutas de UI que conviene probar manualmente antes de borrar:

- `apps-script-ranking.gs`: parece un backend alternativo anterior para Google Apps Script. Si el ranking queda definitivamente en Cloudflare Workers, puede moverse a documentación histórica o eliminarse del deploy web.
- `AUDITORIA_V4.0.md`: el nombre es histórico y genera ruido porque la línea actual ya es V5. Puede conservarse sólo como archivo histórico, pero no debería tomarse como auditoría vigente.
- `matchInstructionControls()`: la UI de instrucciones de partido ya no se renderiza en táctica y `saveTacticFromScreen()` guarda instrucciones normales por defecto. Si no se reactivará esa pantalla, puede eliminarse junto con estilos asociados.
- `rankingEndpointPanelMarkup()`, `rankingSubmitPanelMarkup()`, `submitCurrentSeasonToRanking()`, `rankingUploadCooldownInfo()`, `setRankingStoredEndpoint()` y `setRankingStoredManagerName()`: parecen restos del flujo de carga manual del ranking. La lógica actual indica carga automática y manual bloqueada.
- Helpers visuales aislados como `dashboardDonut()`, `fitnessRingSvg()`, `injuryRulesTable()`, `mainBannerMarkup()`, `trainingOptionsMarkup()`, `tacticPlayerRow()`, `playerDragCard()` y `clubAbbrev()`: conviene revisar en navegador si alguna pantalla heredada todavía los necesita antes de removerlos.

## Contradicciones o deudas detectadas

- Hay documentación vieja mezclada en el historial (`AUDITORIA_V4.0.md`, comentarios V3/V4 en algunos módulos). No rompe el juego, pero dificulta mantenimiento.
- `apps-script-ranking.gs` mantiene un `SPREADSHEET_ID` concreto. Si no se usa, no conviene dejarlo como parte de una entrega pública.
- El ranking tiene nombres de configuración heredados (`appsScriptUrl`) aunque ahora apunta a un Worker. Funciona, pero el nombre puede confundir.
- La pantalla de Táctica conserva lógica interna para instrucciones de partido, pero la UI visible actual guarda valores normales. Esto no rompe, pero deja lógica parcialmente muerta.
- El CSS acumula bloques versionados V4/V5. Es normal por evolución incremental, pero puede compactarse cuando se haga una limpieza visual grande.

## Mejoras de rendimiento recomendadas

- Dividir `data/jugadores.json` o cargar jugadores bajo demanda. Es el archivo de datos más pesado y afecta el primer inicio.
- Mantener `data.cacheMode: 'default'` en producción. Usar `no-store` sólo durante pruebas porque empeora carga.
- Separar imágenes pesadas de escudos no usados si se publican ligas opcionales.
- Revisar si todos los `.webp` y `.png` de `img/` son necesarios para la versión pública.
- Evitar llamar reparaciones completas de plantel en renders frecuentes salvo que haya un flag de partida que indique necesidad real.

## Resultado

La V5.28 queda como limpieza segura. No cambia reglas de partido, calendario, planteles, rankings ni economía. La compatibilidad con partidas V5.27 debería mantenerse.
