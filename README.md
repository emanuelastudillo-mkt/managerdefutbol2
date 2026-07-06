# Fútbol Manager MVP V3.13

Versión basada en V3.12.

## Cambios V3.13

- Nueva pantalla de **Entrenamiento** con planificación semanal.
- 7 días visibles por semana.
- 4 casillas por día:
  - Pre turno
  - Turno mañana
  - Turno tarde
  - Turno noche
- Cada casilla permite elegir un entrenamiento.
- Se agregaron tonos de color por tipo de entrenamiento.
- La efectividad por casilla baja al 50%.
- El avance sigue siendo semanal, por eso el juego convierte el plan a 7 días al avanzar.
- Usar las 4 casillas diarias permite alcanzar hasta el doble de carga semanal del sistema anterior.
- La planificación afecta al primer equipo completo.
- La tabla de jugadores queda como lectura de estado físico, moral y media.

## Configuración principal

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

## Archivos principales modificados

- `config.js`
- `style.css`
- `js/core/01-config-constants.js`
- `js/game/05-state-season.js`
- `js/game/09-simulation-economy-training.js`
- `README.md`
- `VERSION.md`
- `CARACTERISTICAS_VERSION.md`

## Validación

- Scripts JS validados con `node --check`.
- Archivo Apps Script validado como JavaScript.
- JSON principales validados.
- ZIP verificado.
