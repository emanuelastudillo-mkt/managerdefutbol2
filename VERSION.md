# Versión V3.15

## Tipo de versión

Actualización funcional del sistema de empleados.

## Cambios

- Se agregó `data/empleados.json` como catálogo editable de empleados.
- Los empleados disponibles quedan estructurados por categoría:
  - Regular
  - Bueno
  - Elite
- El costo regular mantiene los valores existentes.
- La categoría Bueno cuesta 4 veces más que Regular.
- La categoría Elite cuesta 50 veces más que Regular.
- Al contratar un empleado se abre una ventana con 3 opciones disponibles.
- Se agregó contrato por temporada para:
  - Psicólogo motivacional
  - Kinesiólogo
  - Preparador de juveniles

## Rendimiento por categoría

- Regular: rendimiento estándar.
- Bueno: rendimiento x2.
- Elite: rendimiento x3.

## Aplicación práctica

- Psicólogo motivacional:
  - Regular mantiene la mejora estándar de moral.
  - Bueno duplica la mejora.
  - Elite triplica la mejora.
- Kinesiólogo:
  - Regular reduce 7 días de lesión si el tratamiento sale bien.
  - Bueno reduce 14 días.
  - Elite reduce 21 días.
- Preparador de juveniles:
  - Regular revela la cantidad estándar de habilidades.
  - Bueno revela el doble.
  - Elite revela el triple.

## Compatibilidad

- Las partidas anteriores siguen funcionando.
- Los contratos antiguos de kinesiólogo y preparador de juveniles se interpretan como Regular.
- Los costos base se editan desde `data/empleados.json`; `config.js` conserva valores de respaldo.

## Archivos modificados

- `config.js`
- `index.html`
- `style.css`
- `data/empleados.json`
- `js/core/01-config-constants.js`
- `js/data/04-data-storage.js`
- `js/game/05-state-season.js`
- `js/game/10-academy-employees.js`
- `README.md`
- `VERSION.md`
- `CARACTERISTICAS_VERSION.md`
