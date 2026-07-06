# Fútbol Manager MVP V3.09

Versión basada en V3.08 con nueva pantalla de Ranking Online.

## Cambios V3.09

- Nueva sección lateral: **Ranking Online**.
- Campo para cargar el **Nombre del manager**.
- Botón **Subir temporada al ranking**.
- Envío de resumen de temporada a Google Sheets mediante Apps Script.
- Lectura pública del ranking desde el juego usando la URL del Web App.
- Tabla ordenable por:
  - puntaje manager,
  - división,
  - club,
  - puntos,
  - presupuesto final.
- El ranking incluye:
  - presupuesto inicial,
  - presupuesto final,
  - variación de presupuesto,
  - posición final,
  - puntos,
  - partidos ganados, empatados y perdidos,
  - goles a favor, goles en contra y diferencia de gol,
  - títulos,
  - código de partida.
- El envío se habilita sólo cuando la temporada está finalizada.
- Se agrega `apps-script-ranking.gs` como plantilla para pegar en Apps Script.

## Configuración del ranking

En `config.js` se agregó:

```js
ranking: {
  appsScriptUrl: '',
  token: '',
  resultadosPorPagina: 100,
  nombreRanking: 'Ranking Online'
}
```

La URL también puede pegarse directamente desde la pantalla **Ranking Online** y queda guardada en ese navegador.

## Validación

- Scripts JS validados con `node --check`.
- JSON principales validados.
- ZIP verificado.


## Ajuste de configuración ranking online

- Google Sheet configurada: `1ADONE8c3AOAhmrF0MKKRC9oJsGOJJG-pZaqm-NM5OeI`.
- Web App Apps Script configurada en `config.js` para lectura y envío del ranking online.
- `apps-script-ranking.gs` queda con el ID de hoja ya cargado.
