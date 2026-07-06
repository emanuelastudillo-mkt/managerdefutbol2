# Fútbol Manager MVP · V3.17

## Cambios V3.17

- Mercado libre inicial ajustado a 300 jugadores.
- Libres regulares con media 40 a 62 y edad 19 a 30.
- Distribución de libres: 10% POR, 35% DEF, 35% MED, 20% DEL.
- Cada nueva temporada suma 3 jóvenes libres por club, de 17 o 18 años.
- Los jóvenes libres mantienen la generación normal de calidad, incluida la baja probabilidad de media muy alta.
- El mercado libre regular se rellena hasta 200 jugadores si queda por debajo.
- Si supera 200, se eliminan primero libres de 32 años o más.
- Los libres menores de 32 años se conservan.
- Los libres también pueden retirarse al final de temporada.

---


## Cambios V3.17

- Cards visuales para empleados contratados.
- Integración de fotos por puesto y calidad desde `data/empleados.json`.
- Nueva sección de empleados contratados en Inicio.
- Cards visuales en Empleados y Academia cuando un empleado está activo.
- No se muestran multiplicadores ni efectos internos.
- Barra de progreso de avance centrada, con frases rotativas cada 10 segundos.

## Imágenes de empleados

Colocar las imágenes en:

```txt
img/empleados/
```

Nombres esperados:

```txt
psicologo-regular.webp
psicologo-bueno.webp
psicologo-elite.webp
kinesiologo-regular.webp
kinesiologo-bueno.webp
kinesiologo-elite.webp
preparador-juveniles-regular.webp
preparador-juveniles-bueno.webp
preparador-juveniles-elite.webp
```

Formato recomendado: `.webp`, 512x512 px.

## Validación

- JavaScript validado con `node --check`.
- JSON validado.
- ZIP verificado.

## Ajuste V3.17 antes de implementación

La pantalla **Nueva partida** incluye nombre del manager, país, liga y equipo. El nombre se guarda para el ranking online.

El ranking permite subir resultados durante la temporada, con un cooldown de 77 días de juego entre envíos.

## Ajuste V3.17 · Curva de dificultad de habilidades

- El entrenamiento intenso conserva la lógica previa de intento de mejora.
- Si el entrenamiento define que una habilidad debe subir +1, ahora pasa por una comprobación final.
- La probabilidad final depende del valor actual de la habilidad:
  - habilidad 20: 80% de probabilidad final.
  - habilidad 50: 50% de probabilidad final.
  - habilidad 80: 20% de probabilidad final.
- Los sueldos, medias base y tipos de entrenamiento no se modifican.
- El ajuste vuelve más difícil mejorar jugadores que ya tienen habilidades altas.

## Cambios V3.17 · Mercado libre inicial y renovaciones

- La nueva partida genera 300 jugadores libres iniciales.
- Los jugadores libres regulares se generan con medias equilibradas entre 40 y 62.
- Los libres regulares usan edades de 18 a 35 años.
- Al iniciar una nueva temporada, el mercado libre se limpia y se limita a un máximo de 200 jugadores disponibles.
- Cada temporada se generan 3 jóvenes libres por club, de 17 o 18 años.
- Los jóvenes libres de temporada usan las reglas generales de calidad de jugadores, por lo que allí puede aparecer una probabilidad baja de jugadores de nivel muy alto.
- Si después de agregar jóvenes quedan menos de 200 libres, el juego completa el mercado con jugadores regulares de media 40 a 62.
- La distribución por posición mantiene la regla general: 10% porteros, 30% defensores, 30% mediocampistas y 30% delanteros.
