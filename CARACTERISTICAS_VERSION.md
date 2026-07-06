# Características internas de versión · V3.19

## Enfoque

Ajuste de mercado libre inicial y renovación anual de jugadores libres.

## Reglas nuevas de jugadores libres

### Mercado libre inicial

- Se generan **300 jugadores libres** al crear una partida.
- Media visible objetivo: **40 a 62**.
- Edad inicial: **19 a 30 años**.
- Distribución por línea:
  - `POR`: 10%
  - `DEF`: 35%
  - `MED`: 35%
  - `DEL`: 20%

### Renovación por temporada

- Al iniciar cada temporada se crean **3 jóvenes libres por club**.
- Edad de jóvenes libres: **17 o 18 años**.
- Estos juveniles usan las reglas normales de generación de media, sin forzar el rango 40-62.
- Esto conserva la probabilidad mínima de aparición de jugadores de media muy alta.

### Mercado libre regular anual

- Luego de retiros y limpieza, el mercado regular puede rellenarse hasta **200 jugadores libres**.
- Los nuevos libres regulares de temporada usan el mismo rango que los iniciales: media 40 a 62.
- Los jugadores liberados por clubes pueden acumularse en el mercado.

### Limpieza de libres

- Si el mercado supera los 200 libres, se eliminan primero jugadores libres de **32 años o más**.
- Se conservan los libres menores de 32 años aunque el mercado supere temporalmente los 200.
- Los libres también pasan por la edad de retiro al finalizar temporada.

## Configuración agregada o ajustada

En `config.js`, bloque `plantel`:

```js
agentesLibresIniciales: 300,
agentesLibresMediaMin: 40,
agentesLibresMediaMax: 62,
agentesLibresEdadMin: 19,
agentesLibresEdadMax: 30,
agentesLibresMaximosPorTemporada: 200,
agentesLibresPosiciones: {
  POR: 0.10,
  DEF: 0.35,
  MED: 0.35,
  DEL: 0.20
},
jovenesLibresNuevosPorEquipoTemporada: 3,
jovenesLibresEdadMin: 17,
jovenesLibresEdadMax: 18
```

## Archivos modificados

- `config.js`
- `js/core/01-config-constants.js`
- `js/ui/06-render-home-messages.js`
- `js/game/05-state-season.js`
- `README.md`
- `VERSION.md`
- `CARACTERISTICAS_VERSION.md`

## Validación esperada

- Validación sintáctica de JavaScript.
- Validación de JSON.
- Verificación de ZIP.


## Ajuste V3.19 · Ranking online

- El envío al ranking ahora espera confirmación real del servicio online antes de guardar el cooldown local.
- Si el envío falla, no se bloquea el siguiente intento.
- El ranking online ahora usa lectura/escritura confirmada por callback.
- El Apps Script acepta lectura y envío desde `doGet`, además de mantener compatibilidad con `doPost`.
- Se corrige el caso donde el juego mostraba un registro local aunque la hoja no hubiera recibido datos.


## Ajuste V3.19

- El ranking usa primero la URL configurada en `config.js` y evita que una URL vieja guardada en el navegador la pise.
- El Apps Script acepta lectura y envío con acciones GET más tolerantes para evitar el error `Acción GET no reconocida`.
- Si llega una acción desconocida sin payload, responde con la lectura del ranking en vez de bloquear la tabla.
