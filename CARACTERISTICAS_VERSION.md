# V5.28 - Revisión y limpieza de código

## Cambios principales

- Actualizada la base de versión de V5.27 a V5.28, incluyendo `config.js`, `index.html`, cache-busting, `VERSION.md`, `CARACTERISTICAS_VERSION.md` y `app.js`.
- Limpieza del puente de simulación en `js/game/11-match-engine.js`: se retiraron helpers antiguos del motor alternativo que ya no eran llamados por el flujo actual.
- Se conservó `pitchEffect()` porque todavía es usado por economía, entrenamiento, desgaste y efectos de campo.
- Se conservaron los helpers compartidos que usa `Simulator20`: cambios, estadísticas, sanciones, lesiones, aplicación de resultados y limpieza de táctica.
- Eliminados wrappers heredados `advanceOneDay()` y `goToNextMatch()` porque el flujo actual usa directamente `advanceCalendarOneStep()` desde el botón unificado.
- Agregado informe `REVISION_CODIGO_V5.28.md` con hallazgos de código eliminable, contradicciones y mejoras posibles.

## Compatibilidad

Se implementa solo. No requiere reiniciar partida. Es una limpieza de código y documentación; no cambia reglas de simulación, planteles, calendario ni datos guardados.
