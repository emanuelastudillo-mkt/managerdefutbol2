# Versión V3.09

## Tipo de versión

Nueva función online sobre V3.08.

## Cambios

- Se agrega la pantalla **Ranking Online**.
- Se permite subir una temporada finalizada a Google Sheets mediante Apps Script.
- Se agrega campo de **Nombre del manager**.
- Se calcula un **Puntaje manager** para ordenar resultados.
- Se agregan al envío:
  - club usado,
  - temporada,
  - división,
  - posición final,
  - puntos,
  - ganados / empatados / perdidos,
  - goles a favor / goles en contra / diferencia de gol,
  - presupuesto inicial,
  - presupuesto final,
  - variación de presupuesto,
  - títulos,
  - fecha de envío,
  - código de partida.
- Se permite leer el ranking público desde el juego.
- La tabla online puede ordenarse por puntaje, división, club, puntos y presupuesto final.
- Se agrega `apps-script-ranking.gs` como plantilla de backend simple.

## Archivos modificados

- `config.js`
- `index.html`
- `app.js`
- `style.css`
- `js/core/01-config-constants.js`
- `js/game/05-state-season.js`
- `js/ui/06-render-home-messages.js`
- `README.md`
- `VERSION.md`
- `CARACTERISTICAS_VERSION.md`

## Archivos agregados

- `js/game/13-ranking-online.js`
- `apps-script-ranking.gs`


## Ajuste de configuración ranking online

- Google Sheet configurada: `1ADONE8c3AOAhmrF0MKKRC9oJsGOJJG-pZaqm-NM5OeI`.
- Web App Apps Script configurada en `config.js` para lectura y envío del ranking online.
- `apps-script-ranking.gs` queda con el ID de hoja ya cargado.
