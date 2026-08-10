/* V8.08 · Sobrescrituras opcionales de balance.
   config.js es la única fuente de valores base.
   Este objeto debe contener únicamente diferencias intencionales y rutas ya existentes.
*/
window.GAME_BALANCE_MODIFICADORES = {
  // Ejemplo: entrenamiento: { multiplicadorSubidaHabilidades: 2 }
};
window.GAME_BALANCE_MODIFICADORES_METADATA = {
  version:'V8.47',
  nombre:'Capa opcional de balance',
  nota:'Sin sobrescrituras activas; todos los valores vigentes están centralizados en config.js.'
};
if(typeof window.applyGameConfigOverrides === 'function'){
  window.applyGameConfigOverrides('balance-modificadores.js', window.GAME_BALANCE_MODIFICADORES);
  window.validateGameConfig?.();
}else{
  console.error('[CONFIG] balance-modificadores.js debe cargarse después de config.js.');
}
