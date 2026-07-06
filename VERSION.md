# Versión V3.14

## Tipo de versión

Ajuste visual y funcional sobre la pantalla de entrenamiento semanal de V3.13.

## Cambios

- La grilla semanal de entrenamiento ahora es más compacta.
- Se eliminaron los selectores desplegables de cada casilla.
- Cada casilla se muestra como una pieza rectangular con:
  - cinta gris superior con el nombre del turno,
  - entrenamiento elegido debajo con color propio.
- Al hacer click en una casilla se abre una ventana pequeña con tarjetas de entrenamiento.
- Al elegir una tarjeta, el entrenamiento se aplica a esa casilla y la ventana se cierra.
- “Día libre” pasa a llamarse **Turno libre**.
- Se ocultó el texto explicativo técnico de carga semanal.
- Se conserva el resumen visible por tipo de entrenamiento:
  - Regenerativo
  - Entrenamiento intenso
  - Entrenamiento táctico
  - Turno libre

## Compatibilidad

- No cambia la lógica de efectos del entrenamiento.
- No cambia la efectividad del 50% por casilla.
- No cambia el avance semanal de domingo a domingo.
- Las partidas anteriores siguen cargando el plan semanal existente.

## Archivos modificados

- `config.js`
- `index.html`
- `style.css`
- `js/core/01-config-constants.js`
- `js/game/09-simulation-economy-training.js`
- `README.md`
- `VERSION.md`
- `CARACTERISTICAS_VERSION.md`
