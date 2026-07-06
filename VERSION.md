# Versión V3.16

## Tipo de actualización

Mejora visual menor sobre empleados.

## Cambios

- Nueva sección visual de empleados contratados.
- Cards con foto, nombre, puesto, calidad y costo de temporada.
- Soporte para 9 imágenes `.webp` por puesto y calidad.
- Ocultos los valores internos de rendimiento.
- Ajuste visual: barra de progreso de avance centrada y frases rotativas cada 10 segundos debajo del botón.

## Notas

Esta versión no modifica el balance de empleados ni reglas económicas. El ajuste de frases sólo afecta la presentación del avance.

## Ajuste adicional antes de implementación

- La pantalla **Nueva partida** ahora permite cargar el nombre del manager.
- El nombre queda guardado para usarlo luego en el ranking online.
- Se agregaron desplegables encadenados para **País**, **Liga** y **Equipo**.
- El ranking online ya no exige finalizar la temporada para subir resultado.
- Se agregó cooldown de **77 días de juego** entre envíos al ranking.

## Ajuste V3.16 · Curva de entrenamiento

- Agregada comprobación final de mejora por valor actual de habilidad.
- Fórmula simple: probabilidad final de subida = `100 - habilidad actual`.
- Ejemplo: habilidad 80 permite sólo 20% de probabilidad final si el entrenamiento ya había definido mejora.
- Configuración editable en `config.js`:
  - `entrenamiento.curvaHabilidadActual`
  - `entrenamiento.probabilidadMinimaSubidaHabilidad`
