# Fútbol Manager MVP V3.16

## Cambios V3.16

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

## Ajuste V3.16 antes de implementación

La pantalla **Nueva partida** incluye nombre del manager, país, liga y equipo. El nombre se guarda para el ranking online.

El ranking permite subir resultados durante la temporada, con un cooldown de 77 días de juego entre envíos.

## Ajuste V3.16 · Curva de dificultad de habilidades

- El entrenamiento intenso conserva la lógica previa de intento de mejora.
- Si el entrenamiento define que una habilidad debe subir +1, ahora pasa por una comprobación final.
- La probabilidad final depende del valor actual de la habilidad:
  - habilidad 20: 80% de probabilidad final.
  - habilidad 50: 50% de probabilidad final.
  - habilidad 80: 20% de probabilidad final.
- Los sueldos, medias base y tipos de entrenamiento no se modifican.
- El ajuste vuelve más difícil mejorar jugadores que ya tienen habilidades altas.
