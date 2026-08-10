/* V8.46 · Navegación móvil aislada. No modifica estado ni lógica de la partida. */
(() => {
  'use strict';

  const MOBILE_QUERY = '(max-width: 767px)';

  function initMobileNavigation(){
    const body = document.body;
    const menuButton = document.getElementById('mobileMenuBtn');
    const actionsButton = document.getElementById('mobileActionsBtn');
    const closeButton = document.getElementById('mobileMenuClose');
    const backdrop = document.getElementById('mobileNavBackdrop');
    const sidebar = document.getElementById('sidebarPanel');
    const media = window.matchMedia(MOBILE_QUERY);

    if(!body || !menuButton || !actionsButton || !backdrop || !sidebar) return;

    let lastFocusedElement = null;

    const isMobile = () => media.matches;
    const navIsOpen = () => body.classList.contains('mobile-nav-open');
    const actionsAreOpen = () => body.classList.contains('mobile-actions-open');

    function syncOverlayState(){
      const open = navIsOpen() || actionsAreOpen();
      body.classList.toggle('mobile-overlay-open', open && isMobile());
      backdrop.setAttribute('aria-hidden', open && isMobile() ? 'false' : 'true');
    }

    function closeNavigation({ restoreFocus = true } = {}){
      body.classList.remove('mobile-nav-open');
      menuButton.setAttribute('aria-expanded', 'false');
      sidebar.setAttribute('aria-hidden', isMobile() ? 'true' : 'false');
      syncOverlayState();
      if(restoreFocus && isMobile() && lastFocusedElement instanceof HTMLElement){
        lastFocusedElement.focus({ preventScroll:true });
      }
    }

    function closeActions({ restoreFocus = false } = {}){
      body.classList.remove('mobile-actions-open');
      actionsButton.setAttribute('aria-expanded', 'false');
      syncOverlayState();
      if(restoreFocus && isMobile()) actionsButton.focus({ preventScroll:true });
    }

    function openNavigation(){
      if(!isMobile()) return;
      lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : menuButton;
      closeActions();
      body.classList.add('mobile-nav-open');
      menuButton.setAttribute('aria-expanded', 'true');
      sidebar.setAttribute('aria-hidden', 'false');
      syncOverlayState();
      window.requestAnimationFrame(() => closeButton?.focus({ preventScroll:true }));
    }

    function openActions(){
      if(!isMobile()) return;
      closeNavigation({ restoreFocus:false });
      body.classList.add('mobile-actions-open');
      actionsButton.setAttribute('aria-expanded', 'true');
      syncOverlayState();
      window.requestAnimationFrame(() => {
        document.querySelector('.top-actions button:not(.hidden):not(:disabled)')?.focus({ preventScroll:true });
      });
    }

    function closeAll({ restoreFocus = false } = {}){
      closeNavigation({ restoreFocus:false });
      closeActions({ restoreFocus:false });
      if(restoreFocus && isMobile()) menuButton.focus({ preventScroll:true });
    }

    function syncViewport(){
      if(!isMobile()){
        body.classList.remove('mobile-nav-open','mobile-actions-open','mobile-overlay-open');
        menuButton.setAttribute('aria-expanded','false');
        actionsButton.setAttribute('aria-expanded','false');
        sidebar.setAttribute('aria-hidden','false');
        backdrop.setAttribute('aria-hidden','true');
        return;
      }
      sidebar.setAttribute('aria-hidden', navIsOpen() ? 'false' : 'true');
      syncOverlayState();
    }

    menuButton.addEventListener('click', () => {
      if(navIsOpen()) closeNavigation();
      else openNavigation();
    });

    actionsButton.addEventListener('click', () => {
      if(actionsAreOpen()) closeActions({ restoreFocus:true });
      else openActions();
    });

    closeButton?.addEventListener('click', () => closeNavigation());
    backdrop.addEventListener('click', () => closeAll({ restoreFocus:true }));

    sidebar.addEventListener('click', event => {
      if(!isMobile()) return;
      const navigationTarget = event.target.closest('[data-tab], #btnOpenNewGame');
      if(navigationTarget) window.requestAnimationFrame(() => closeNavigation({ restoreFocus:false }));
    });

    document.querySelector('.top-actions')?.addEventListener('click', event => {
      if(!isMobile()) return;
      if(event.target.closest('button')) window.requestAnimationFrame(() => closeActions());
    });

    document.addEventListener('keydown', event => {
      if(event.key !== 'Escape' || !isMobile()) return;
      if(navIsOpen() || actionsAreOpen()){
        event.preventDefault();
        closeAll({ restoreFocus:true });
      }
    });

    if(typeof media.addEventListener === 'function') media.addEventListener('change', syncViewport);
    else if(typeof media.addListener === 'function') media.addListener(syncViewport);

    syncViewport();
  }

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initMobileNavigation, { once:true });
  else initMobileNavigation();
})();
