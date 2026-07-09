# V5.30 - Centro de Ojeo enriquecido

## Cambios principales

- Reorganizada la pantalla de **Centro de Ojeo** en una estructura de bloques: lista activa como bloque principal y panel lateral para controles.
- Agregado icono visual de **binoculares** como marca principal del apartado.
- Agregados iconos acumulables de **edificios** para que las oficinas contratadas se vean progresivamente.
- Agregados símbolos de **personas** para que los ojeadores contratados se visualicen como equipo acumulado.
- Reorganizado el resumen superior en tarjetas compactas: jugadores listados, ojeadores, oficinas e informes guardados.
- El jefe de ojeadores, infraestructura, personal y actividad diaria quedan en tarjetas laterales más claras.
- Se compactaron tarjetas, paddings, listas y grillas para mejorar lectura y uso del espacio.

## Alcance técnico

- Se modificó el render visual del Centro de Ojeo y sus estilos CSS asociados.
- Se agregaron helpers visuales para iconos repetidos y binoculares dibujados por CSS.
- No se cambiaron costos, cupos, reglas de revelación, persistencia de informes, contratación ni procesamiento diario.

## Compatibilidad

Se implementa solo. No requiere reiniciar partida. Los cambios son visuales y mantienen los mismos datos guardados de oficinas, ojeadores, jefe de ojeadores, lista activa e informes.
