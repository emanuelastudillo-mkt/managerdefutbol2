# Características internas de versión · V3.16

## Enfoque

Mejora visual de empleados contratados.

## Cambios principales

- Se agregó una sección visual de **Empleados contratados** similar a **Tus jugadores destacados**.
- Los empleados contratados muestran:
  - foto,
  - nombre,
  - puesto,
  - calidad,
  - costo de temporada.
- No se muestran efectos internos ni multiplicadores de rendimiento.
- La pantalla **Empleados** muestra cards visuales para Psicólogo motivacional y Kinesiólogo si están contratados.
- La pantalla **Academia** muestra card visual para Preparador de juveniles si está contratado.
- El inicio muestra un panel de empleados contratados si existe al menos uno activo.
- `data/empleados.json` ahora contiene rutas de imagen por puesto y calidad.
- Se creó `img/empleados/README_IMAGENES.txt` con la lista de nombres esperados.
- Se centró la barra de progreso de avance y se ajustó al ancho del botón.
- El texto fijo debajo del avance fue reemplazado por frases rotativas configurables cada 10 segundos.

## Imágenes esperadas

- `img/empleados/psicologo-regular.webp`
- `img/empleados/psicologo-bueno.webp`
- `img/empleados/psicologo-elite.webp`
- `img/empleados/kinesiologo-regular.webp`
- `img/empleados/kinesiologo-bueno.webp`
- `img/empleados/kinesiologo-elite.webp`
- `img/empleados/preparador-juveniles-regular.webp`
- `img/empleados/preparador-juveniles-bueno.webp`
- `img/empleados/preparador-juveniles-elite.webp`

## Archivos modificados

- `config.js`
- `index.html`
- `app.js`
- `style.css`
- `data/empleados.json`
- `js/game/10-academy-employees.js`
- `js/ui/06-render-home-messages.js`
- `README.md`
- `VERSION.md`
- `CARACTERISTICAS_VERSION.md`

## Compatibilidad

- No cambia reglas de juego.
- No cambia costos ni rendimiento real de empleados.
- No afecta partidas guardadas existentes.

## Ajuste adicional antes de implementación

- La creación de partida se reorganizó con campos de manager, país, liga y equipo.
- El nombre del manager se guarda localmente y se copia a la partida nueva para el ranking.
- Los desplegables de Liga y Equipo se actualizan según la selección anterior.
- El ranking permite subir el estado actual de la temporada en cualquier momento.
- Se bloquean nuevos envíos durante 77 días de juego desde el último envío.
- El cooldown queda configurable en `config.js` mediante `ranking.cooldownCargaDias`.

## Ajuste interno V3.16 · Curva de dificultad de habilidades

Se agregó una segunda comprobación en `improveRandomSkill()`.

Flujo actual:

1. El entrenamiento intenso realiza la tirada base de mejora.
2. Si esa tirada sale positiva, se calcula la dificultad por habilidad actual.
3. La mejora +1 sólo se aplica si supera la comprobación final.

Regla:

```txt
probabilidad_final = (100 - habilidad_actual) / 100
```

Ejemplos:

```txt
Habilidad 40 => 60% final
Habilidad 70 => 30% final
Habilidad 80 => 20% final
Habilidad 90 => 10% final
```

Esto no toca sueldos, cláusulas ni medias base. Sólo afecta la probabilidad de que una mejora de entrenamiento se concrete.
