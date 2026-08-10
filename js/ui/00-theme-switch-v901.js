/* V9.01 · Selector persistente de modo claro y oscuro. */
(function(){
  'use strict';

  var STORAGE_KEY = 'una-vida-manager-theme';
  var root = document.documentElement;

  function normalizeTheme(value){
    return value === 'light' ? 'light' : 'dark';
  }

  function readTheme(){
    try{
      return normalizeTheme(localStorage.getItem(STORAGE_KEY));
    }catch(error){
      return 'dark';
    }
  }

  function persistTheme(theme){
    try{
      localStorage.setItem(STORAGE_KEY, theme);
    }catch(error){
      // El modo sigue funcionando durante la sesión aunque el almacenamiento esté bloqueado.
    }
  }

  function updateThemeMeta(theme){
    var themeColor = document.querySelector('meta[name="theme-color"]');
    var colorScheme = document.querySelector('meta[name="color-scheme"]');
    if(themeColor){
      themeColor.setAttribute('content', theme === 'light' ? '#eef2f7' : '#09090b');
    }
    if(colorScheme){
      colorScheme.setAttribute('content', theme + ' ' + (theme === 'light' ? 'dark' : 'light'));
    }
  }

  function updateToggle(theme){
    var toggle = document.getElementById('themeToggle');
    if(!toggle) return;
    var light = theme === 'light';
    var targetLabel = light ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro';
    toggle.setAttribute('aria-checked', String(light));
    toggle.setAttribute('aria-label', targetLabel);
    toggle.setAttribute('title', targetLabel);
    var label = toggle.querySelector('.theme-switch-label');
    if(label) label.textContent = light ? 'Claro' : 'Oscuro';
  }

  function applyTheme(theme, shouldPersist){
    theme = normalizeTheme(theme);
    root.setAttribute('data-theme', theme);
    root.style.colorScheme = theme;
    updateThemeMeta(theme);
    updateToggle(theme);
    if(shouldPersist !== false) persistTheme(theme);
    try{
      window.dispatchEvent(new CustomEvent('game-theme-change', { detail:{ theme:theme } }));
    }catch(error){
      // Compatibilidad con navegadores antiguos: el cambio visual ya fue aplicado.
    }
    return theme;
  }

  function bindToggle(){
    var toggle = document.getElementById('themeToggle');
    if(!toggle || toggle.dataset.themeBound === '1') return;
    toggle.dataset.themeBound = '1';
    updateToggle(root.getAttribute('data-theme') || 'dark');
    toggle.addEventListener('click', function(){
      var current = root.getAttribute('data-theme') || 'dark';
      applyTheme(current === 'light' ? 'dark' : 'light', true);
    });
  }

  window.GameTheme = {
    get:function(){ return normalizeTheme(root.getAttribute('data-theme')); },
    set:function(theme){ return applyTheme(theme, true); },
    toggle:function(){
      return applyTheme((root.getAttribute('data-theme') || 'dark') === 'light' ? 'dark' : 'light', true);
    }
  };

  applyTheme(readTheme(), false);
  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bindToggle, { once:true });
  }else{
    bindToggle();
  }
})();
