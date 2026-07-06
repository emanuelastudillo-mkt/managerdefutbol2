# Características internas de versión · V3.13

## Objetivo

Transformar la sección **Entrenamiento** en una planificación semanal basada en días y franjas horarias, aprovechando la migración previa del juego a calendario anual.

## Pantalla de entrenamiento

- La pantalla muestra 7 días consecutivos desde la fecha actual.
- Cada día tiene 4 casillas:
  - Pre turno
  - Turno mañana
  - Turno tarde
  - Turno noche
- Cada casilla permite seleccionar un tipo de entrenamiento.
- Los colores diferencian rápidamente recuperación, carga intensa, táctica, descanso y masajes.

## Conversión de efectos

- El avance todavía equivale a 7 días.
- Cada casilla aplica el 50% de una sesión diaria.
- La escala interna usada al avanzar es:
  - `efectividadPorCasilla / diasPorAvance`
- Con 4 casillas por día durante 7 días, la carga máxima equivale a 2x el sistema anterior.

## Efectos por tipo

- Regenerativo: mejora forma física.
- Masajista: mejora forma física y moral.
- Intenso: puede mejorar habilidades, pero reduce forma física y moral.
- Táctico: puede mejorar cohesión.
- Día libre: mejora forma física y moral.

## Compatibilidad

- Se agrega `trainingSchedule` al estado de partida.
- Si una partida anterior no tiene `trainingSchedule`, se genera automáticamente.
- Se conserva `trainingPlan` para compatibilidad con partidas viejas y datos heredados.

## Notas

- No se implementó todavía avance día por día.
- El sistema queda preparado para que más adelante cada día pueda procesarse de forma individual.
