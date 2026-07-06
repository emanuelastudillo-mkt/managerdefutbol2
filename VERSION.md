# Versión V3.18

## Tipo de actualización

Balance y generación de mercado libre.

## Cambios principales

- Cantidad inicial de jugadores libres: **300**.
- Jugadores libres regulares con media entre **40 y 62**.
- Edad inicial de libres regulares: **19 a 30 años**.
- Distribución de libres regulares por línea:
  - 10% porteros
  - 35% defensores
  - 35% mediocampistas
  - 20% delanteros
- Al iniciar una nueva temporada se crean **3 jóvenes libres por club**.
- Los jóvenes libres tienen **17 o 18 años**.
- Los jóvenes libres usan la generación normal de calidad, por lo que conservan la baja probabilidad de salir con media muy alta.
- El mercado libre regular se rellena hasta un máximo objetivo de **200 libres** cuando queda por debajo.
- Los libres viejos se limpian sólo si el mercado supera los 200 jugadores.
- Se conservan los libres menores de **32 años**.
- Los jugadores libres también pueden retirarse con la misma edad de retiro que el resto.

## Compatibilidad

- Las partidas existentes conservan sus jugadores actuales.
- Las nuevas reglas se aplican a nuevas partidas y a la renovación del mercado al cambiar de temporada.
- No se modifican sueldos ni cláusulas por este ajuste.

## Ajustes acumulados dentro de V3.16 que se mantienen

- Cards visuales de empleados contratados.
- Frases rotativas debajo de la barra de avance.
- Nueva partida con nombre de manager, país, liga y equipo.
- Ranking con cooldown de 77 días.
- Curva de dificultad para subidas de habilidad por entrenamiento.


## Ajuste V3.18 · Ranking online

- El envío al ranking ahora espera confirmación real del servicio online antes de guardar el cooldown local.
- Si el envío falla, no se bloquea el siguiente intento.
- El ranking online ahora usa lectura/escritura confirmada por callback.
- El Apps Script acepta lectura y envío desde `doGet`, además de mantener compatibilidad con `doPost`.
- Se corrige el caso donde el juego mostraba un registro local aunque la hoja no hubiera recibido datos.
