# Versión V3.13

## Tipo de versión

Actualización funcional de entrenamiento sobre V3.12.

## Cambios

- Nueva pantalla de entrenamiento semanal por días.
- Cada semana muestra 7 días, de domingo a sábado.
- Cada día tiene 4 casillas:
  - Pre turno
  - Turno mañana
  - Turno tarde
  - Turno noche
- Cada casilla permite elegir un tipo de entrenamiento.
- Los tipos conservados son:
  - Regenerativo
  - Masajista
  - Entrenamiento intenso
  - Entrenamiento táctico
  - Día libre
- Cada tipo tiene tono visual propio para leer rápido la carga semanal.
- La efectividad de cada casilla baja al 50% de una sesión diaria.
- Como el avance actual sigue siendo semanal, el sistema convierte la planificación a 7 días.
- Si se usan las 4 casillas diarias, la carga máxima semanal puede llegar a 2x respecto del sistema anterior.
- El entrenamiento ahora afecta globalmente al primer equipo según el plan semanal.
- La tabla inferior de entrenamiento queda como estado del plantel, sin selector individual por jugador.

## Compatibilidad

- Las partidas anteriores cargan con un plan semanal inicial automático.
- Se conserva `trainingPlan` interno para no romper guardados antiguos, aunque la nueva pantalla usa `trainingSchedule`.
- El avance sigue siendo de domingo a domingo.

## Configuración nueva

En `config.js`:

```js
entrenamiento: {
  efectividadPorCasilla: 0.50,
  planSemanalInicial: {
    pre: 'regenerative',
    morning: 'intense',
    afternoon: 'tactical',
    night: 'dayoff'
  }
}
```

## Validación

- `node --check` correcto en todos los `.js`.
- `apps-script-ranking.gs` validado como JavaScript.
- JSON válidos.
- ZIP verificado.
