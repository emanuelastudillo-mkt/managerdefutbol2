/* V9.05 · Vista previa reversible de la nueva interfaz. */
(function(){
  'use strict';

  var ATTRIBUTE = 'data-interface-preview';
  var PREVIEW_VALUE = 'modern';
  var root = document.documentElement;

  function getButton(){
    return document.getElementById('interfacePreviewToggle');
  }

  function isEnabled(){
    return root.getAttribute(ATTRIBUTE) === PREVIEW_VALUE;
  }

  function updateButton(enabled){
    var button = getButton();
    if(!button) return;

    button.setAttribute('aria-pressed', String(enabled));
    button.setAttribute('aria-label', enabled ? 'Volver a la interfaz actual' : 'Activar vista previa de la nueva interfaz');
    button.setAttribute('title', enabled ? 'Volver a la interfaz actual' : 'Activar vista previa de la nueva interfaz');
    button.classList.toggle('is-active', enabled);

    var label = button.querySelector('.interface-preview-label');
    var state = button.querySelector('.interface-preview-state');
    if(label) label.textContent = enabled ? 'Interfaz actual' : 'Nueva interfaz';
    if(state) state.textContent = enabled ? 'Vista previa activa' : 'Vista previa';
  }

  function apply(enabled){
    if(enabled){
      root.setAttribute(ATTRIBUTE, PREVIEW_VALUE);
    }else{
      root.removeAttribute(ATTRIBUTE);
    }

    updateButton(Boolean(enabled));

    try{
      window.dispatchEvent(new CustomEvent('game-interface-preview-change', {
        detail:{ enabled:Boolean(enabled), mode:enabled ? PREVIEW_VALUE : 'current' }
      }));
    }catch(error){
      // La vista previa ya fue aplicada aunque CustomEvent no esté disponible.
    }

    return Boolean(enabled);
  }

  function bind(){
    var button = getButton();
    if(!button || button.dataset.interfacePreviewBound === '1') return;

    button.dataset.interfacePreviewBound = '1';
    apply(false);
    button.addEventListener('click', function(){
      apply(!isEnabled());
    });
  }

  window.GameInterfacePreview = {
    get:isEnabled,
    set:function(enabled){ return apply(Boolean(enabled)); },
    toggle:function(){ return apply(!isEnabled()); }
  };

  if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', bind, { once:true });
  }else{
    bind();
  }
})();
