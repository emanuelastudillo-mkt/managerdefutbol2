/*
  Carga sin caché del archivo semanal de códigos.
  Se ejecuta durante el parseo del documento antes de los módulos diferidos del juego.
*/
window.GAME_WEEKLY_CODES = {
  version: 1,
  activo: false,
  semana: '',
  validoDesde: '',
  validoHasta: '',
  codigos: []
};
(function loadWeeklyCodes(){
  const cacheBuster = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  document.write(`<script src="data/codigos-semanales.js?t=${encodeURIComponent(cacheBuster)}"><\/script>`);
})();
