# Características internas de versión · V3.15

## Objetivo

Pasar el sistema de empleados a una base JSON editable y agregar categorías de contratación con impacto real en costos y rendimiento.

## Nuevo archivo

### `data/empleados.json`

Contiene:

- categorías de empleados,
- multiplicadores de costo,
- multiplicadores de rendimiento,
- empleados disponibles,
- costo base regular,
- descripción funcional de cada empleado.

## Categorías

| Categoría | Costo | Rendimiento |
|---|---:|---:|
| Regular | x1 | x1 |
| Bueno | x4 | x2 |
| Elite | x50 | x3 |

## Empleados incluidos

- Psicólogo motivacional.
- Kinesiólogo.
- Preparador de juveniles.

## Cambios de lógica

- El botón de contratación abre una ventana con las tres categorías.
- La categoría elegida se guarda en `game.staffContracts`.
- Los empleados se contratan por temporada.
- Al cambiar de temporada, los contratos se desactivan.
- Se mantiene compatibilidad con datos viejos de `staffActions` y `academy.youthPreparer`.

## Efectos

- Psicólogo motivacional: multiplica la mejora de moral.
- Kinesiólogo: multiplica los días reducidos por tratamiento exitoso.
- Preparador de juveniles: multiplica la cantidad de habilidades reveladas por informe.
