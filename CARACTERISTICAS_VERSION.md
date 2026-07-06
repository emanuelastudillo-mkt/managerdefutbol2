# Características internas de versión · V3.09

## Objetivo

Agregar una primera versión de ranking comunitario online usando Google Sheets + Apps Script, manteniendo GitHub Pages como frontend estático.

## Nueva pantalla: Ranking Online

Se agrega una nueva pestaña en el menú lateral:

```txt
Ranking Online
```

La pantalla contiene:

- campo `Nombre del manager`,
- botón `Subir temporada al ranking`,
- configuración de URL de Apps Script,
- lectura pública del ranking,
- tabla ordenable.

## Envío de temporada

El envío queda habilitado sólo si:

- existe una partida activa,
- la temporada está finalizada,
- hay URL de Apps Script configurada,
- hay nombre de manager,
- esa temporada no fue enviada ya desde el mismo navegador.

El juego no sube la partida completa. Sólo envía un resumen de temporada.

## Datos enviados

- Nombre del manager.
- Club usado.
- Temporada.
- División.
- Posición final.
- Puntos.
- Partidos ganados.
- Partidos empatados.
- Partidos perdidos.
- Goles a favor.
- Goles en contra.
- Diferencia de gol.
- Presupuesto inicial.
- Presupuesto final.
- Variación de presupuesto.
- Cantidad de títulos.
- Fecha de envío.
- Código de partida.
- Puntaje manager.
- Versión del juego.

## Puntaje manager

Se calcula con una fórmula simple:

```txt
Puntos de liga
+ bonus por división
+ bonus por posición final
+ bonus por título de temporada
+ diferencia de gol x 2
+ ajuste por variación de presupuesto
```

## Apps Script

Se agrega `apps-script-ranking.gs` como backend simple.

El Web App soporta:

- `GET ?action=list&callback=...` para lectura pública con JSONP.
- `POST action=submit` para agregar una fila al Google Sheet.

## Notas técnicas

- La lectura usa JSONP para evitar problemas de CORS entre GitHub Pages y Apps Script.
- El envío usa un formulario oculto hacia un iframe para evitar bloqueos CORS.
- El ranking es comunitario/casual; no es antitrampas fuerte porque el juego corre en navegador.


## Ajuste de configuración ranking online

- Google Sheet configurada: `1ADONE8c3AOAhmrF0MKKRC9oJsGOJJG-pZaqm-NM5OeI`.
- Web App Apps Script configurada en `config.js` para lectura y envío del ranking online.
- `apps-script-ranking.gs` queda con el ID de hoja ya cargado.
