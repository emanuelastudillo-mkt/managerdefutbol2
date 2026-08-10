/* Ranking online con puntaje total explícito para Worker. */

let rankingSessionAutoCheckInFlight = false;
let rankingRuntimeConfirmedAuthUser = '';
let rankingAutomaticSubmissionInFlight = false;
let rankingAutomaticRetryTimer = 0;

function rankingRuntimeConfirmedUsername(){
  return String(rankingRuntimeConfirmedAuthUser || '').trim();
}
function rankingSetRuntimeConfirmedUsername(value){
  rankingRuntimeConfirmedAuthUser = String(value || '').trim();
  return rankingRuntimeConfirmedAuthUser;
}

function rankingNotifyAuthChanged(){
  try{ window.dispatchEvent(new CustomEvent('fm:auth-changed')); }catch(_error){}
}

function rankingStoredEndpoint(){
  const configured = String(RANKING_APPS_SCRIPT_URL || '').trim();
  if(configured) return configured;
  try{ return localStorage.getItem('fmRankingEndpoint') || ''; }
  catch(_){ return ''; }
}
function rankingStoredManagerName(){
  try{ return (game?.rankingManagerName || localStorage.getItem('fmRankingManagerName') || '').trim(); }
  catch(_){ return (game?.rankingManagerName || '').trim(); }
}
function setRankingStoredManagerName(value){
  const clean = String(value || '').trim().slice(0, 40);
  try{ localStorage.setItem('fmRankingManagerName', clean); }catch(_){ /* sin almacenamiento */ }
  if(game) game.rankingManagerName = clean;
  return clean;
}

function rankingCurrentGameDate(){
  if(!game) return '';
  if(validIsoDate(game.currentDate)) return game.currentDate;
  const fallback = dateForSeasonState(game);
  return validIsoDate(fallback) ? fallback : '';
}
function rankingUploadCooldownInfo(){
  const current = rankingCurrentGameDate();
  const last = validIsoDate(game?.rankingLastManualUploadGameDate) ? game.rankingLastManualUploadGameDate : '';
  const cooldown = Math.max(0, Math.round(Number(RANKING_UPLOAD_COOLDOWN_DAYS || 50)));
  if(!game || !validIsoDate(current)){
    return { canUpload:false, elapsed:null, remaining:cooldown, last, current, cooldown };
  }
  if(!last || cooldown <= 0){
    return { canUpload:true, elapsed:last ? Math.max(0, daysBetweenIsoDates(last, current)) : cooldown, remaining:0, last, current, cooldown };
  }
  const elapsed = Math.max(0, daysBetweenIsoDates(last, current));
  const remaining = Math.max(0, cooldown - elapsed);
  return { canUpload:remaining <= 0, elapsed, remaining, last, current, cooldown };
}
function rankingCooldownText(info=rankingUploadCooldownInfo()){
  if(!game) return 'No hay partida activa.';
  if(info.canUpload) return 'Carga manual disponible.';
  return `Carga manual disponible en ${info.remaining} día(s) de juego.`;
}
function rankingManualEventType(){
  const info = rankingUploadCooldownInfo();
  const day = Number(seasonDayFromDate(info.current || rankingCurrentGameDate(), game?.seasonYear || seasonYearForNumber(game?.seasonNumber || 1)) || 0);
  return `manual_snapshot_d${day || 0}`;
}

function normalizeRankingEndpoint(url){
  const configured = String(url || '').trim().replace(/\/+$/, '');
  if(configured) return configured;
  return 'https://rankingdemanagers.emanuelastudillo.workers.dev';
}
function rankingConfiguredPaths(kind){
  const cfg = (window.GAME_CONFIG && window.GAME_CONFIG.ranking) ? window.GAME_CONFIG.ranking : {};
  const raw = kind === 'submit' ? cfg.submitPaths : cfg.readPaths;
  const defaults = ['ranking/career'];
  const source = Array.isArray(raw) && raw.length ? raw : defaults;
  const seen = new Set();
  return source
    .map(path => String(path || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(path => {
      if(seen.has(path)) return false;
      seen.add(path);
      return true;
    });
}
function rankingRouteLabel(path){
  const clean = String(path || '').trim().replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}` : '/';
}
function rankingApiUrl(endpoint, path, query=''){
  const base = normalizeRankingEndpoint(endpoint);
  const cleanPath = String(path || '').trim().replace(/^\/+|\/+$/g, '');
  const suffix = cleanPath ? `/${cleanPath}` : '';
  return `${base}${suffix}${query || ''}`;
}
function rankingStoredAuthToken(){
  const configured = String(RANKING_TOKEN || '').trim();
  if(configured) return configured;
  try{
    const current = String(localStorage.getItem('fmRankingAuthToken') || '').trim();
    if(current) return current;
    const legacy = String(localStorage.getItem('fmRankingToken') || localStorage.getItem('rankingToken') || '').trim();
    if(legacy){
      localStorage.setItem('fmRankingAuthToken', legacy);
      localStorage.removeItem('fmRankingToken');
      localStorage.removeItem('rankingToken');
    }
    return legacy;
  }catch(_){ return ''; }
}

function rankingStoredAuthUsername(){
  try{ return String(localStorage.getItem('fmRankingAuthUser') || localStorage.getItem('fmRankingUsername') || '').trim(); }
  catch(_){ return ''; }
}
function rankingAuthPaths(kind){
  const cfg = (window.GAME_CONFIG && window.GAME_CONFIG.ranking) ? window.GAME_CONFIG.ranking : {};
  const raw = kind === 'me' ? cfg.mePaths : cfg.loginPaths;
  const defaults = kind === 'me' ? ['auth/me'] : ['auth/login'];
  const source = Array.isArray(raw) && raw.length ? raw : defaults;
  const seen = new Set();
  return source
    .map(path => String(path || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(path => {
      if(seen.has(path)) return false;
      seen.add(path);
      return true;
    });
}
function rankingExtractToken(data){
  if(!data || typeof data !== 'object') return '';
  const candidates = [
    data.token, data.access_token, data.accessToken, data.authToken,
    data?.data?.token, data?.data?.access_token, data?.session?.token,
    data?.auth?.token, data?.result?.token
  ];
  return String(candidates.find(value => value !== undefined && value !== null && String(value).trim()) || '').trim();
}
function rankingExtractUsername(data, fallback=''){
  if(!data || typeof data !== 'object') return String(fallback || '').trim();
  const candidates = [
    data?.user?.username, data?.user?.name, data?.user?.email,
    data?.data?.user?.username, data?.data?.user?.name, data?.data?.username,
    data?.username, data?.name, data?.email, fallback
  ];
  return String(candidates.find(value => value !== undefined && value !== null && String(value).trim()) || '').trim();
}
function rankingStoreAuthSession(data, fallbackUsername=''){
  const token = rankingExtractToken(data);
  if(!token) return '';
  const username = rankingExtractUsername(data, fallbackUsername);
  const confirmedUsername = rankingExtractUsername(data, '');
  const expiresAt = String(data?.expires_at || data?.expiresAt || data?.data?.expires_at || data?.session?.expires_at || '').trim();
  try{
    localStorage.setItem('fmRankingAuthToken', token);
    localStorage.removeItem('fmRankingToken');
    localStorage.removeItem('rankingToken');
    if(username) localStorage.setItem('fmRankingAuthUser', username);
    if(confirmedUsername) localStorage.setItem('fmRankingAuthConfirmedUser', confirmedUsername);
    else localStorage.removeItem('fmRankingAuthConfirmedUser');
    if(expiresAt) localStorage.setItem('fmRankingAuthExpiresAt', expiresAt);
    if(data?.user?.id || data?.data?.user?.id) localStorage.setItem('fmRankingAuthUserId', String(data?.user?.id || data?.data?.user?.id));
    localStorage.setItem('fmRankingNeedsPasswordSetup', data?.requires_password_setup ? '1' : '0');
  }catch(_){ /* sin almacenamiento */ }
  rankingSetRuntimeConfirmedUsername(confirmedUsername);
  if(username && (!rankingStoredManagerName() || rankingStoredManagerName() === 'Manager')) setRankingStoredManagerName(username);
  rankingNotifyAuthChanged();
  return token;
}
function rankingClearAuthSession(){
  rankingSetRuntimeConfirmedUsername('');
  try{
    ['fmRankingAuthToken','fmRankingToken','rankingToken','fmRankingAuthUser','fmRankingUsername','fmRankingAuthConfirmedUser','fmRankingAuthExpiresAt','fmRankingAuthUserId','fmRankingNeedsPasswordSetup'].forEach(key => localStorage.removeItem(key));
  }catch(_){ /* sin almacenamiento */ }
  rankingNotifyAuthChanged();
}
function rankingNeedsPasswordSetup(){
  try{ return localStorage.getItem('fmRankingNeedsPasswordSetup') === '1'; }
  catch(_){ return false; }
}
function rankingPasswordSetupStateKnown(){
  try{ return localStorage.getItem('fmRankingNeedsPasswordSetup') !== null; }
  catch(_){ return false; }
}
function rankingAuthStatusMarkup(endpoint){
  const token = rankingStoredAuthToken();
  const user = rankingStoredAuthUsername() || rankingStoredManagerName();
  if(!endpoint) return '<span class="bad">Ranking online no disponible.</span>';
  if(token) return `<span class="ok">Sesión activa${user ? ` · ${escapeHtml(user)}` : ''}</span>`;
  if(RANKING_REQUIRES_LOGIN) return '<span class="warn">Sin sesión. Iniciá sesión para subir récords.</span>';
  return '<span class="muted">Login opcional.</span>';
}
function rankingLoginPanelMarkup(endpoint, options={}){
  const token = rankingStoredAuthToken();
  const disabled = endpoint ? '' : 'disabled';
  const user = rankingStoredAuthUsername() || rankingStoredManagerName() || '';
  const surface = String(options?.surface || 'ranking').trim() || 'ranking';
  return `<div class="card ranking-login-card" data-ranking-auth-panel="${escapeHtml(surface)}">
    <div class="row"><div><p class="label">Cuenta online</p><h3>Ingresar o crear cuenta</h3></div><span class="pill">${RANKING_REQUIRES_LOGIN ? 'Requerido' : 'Opcional'}</span></div>
    <p class="muted">Usá el mismo nombre y contraseña para acceder al ranking y a las funciones online.</p>
    <div class="ranking-auth-status small" data-ranking-auth-status>${rankingAuthStatusMarkup(endpoint)}</div>
    <form class="ranking-login-form" data-ranking-login-form novalidate>
      <label class="ranking-auth-field">
        <span>Nombre</span>
        <input name="username" type="text" autocomplete="username" minlength="3" maxlength="40" placeholder="Tu nombre de usuario" value="${escapeHtml(user)}" aria-describedby="ranking-username-help-${escapeHtml(surface)}" ${disabled} />
        <small id="ranking-username-help-${escapeHtml(surface)}" data-ranking-username-help>Entre 3 y 40 caracteres. Letras, números, espacios, punto, guion o guion bajo.</small>
      </label>
      <label class="ranking-auth-field">
        <span>Contraseña</span>
        <input name="password" type="password" autocomplete="current-password" minlength="8" maxlength="128" placeholder="Tu contraseña" aria-describedby="ranking-password-help-${escapeHtml(surface)}" ${disabled} />
        <small id="ranking-password-help-${escapeHtml(surface)}" data-ranking-password-help>Entre 8 y 128 caracteres.</small>
      </label>
      <div class="ranking-auth-actions">
        <button class="primary" type="submit" ${disabled}>Iniciar sesión</button>
        <button class="ghost" type="button" data-ranking-register ${disabled}>Crear cuenta</button>
        ${token && !String(RANKING_TOKEN || '').trim() ? '<button class="danger" type="button" data-ranking-logout>Cerrar sesión</button>' : ''}
      </div>
    </form>
    <div class="small muted ranking-login-status" data-ranking-login-status>${token ? 'La cuenta está lista para publicar tu carrera.' : 'Completá ambos campos y elegí iniciar sesión o crear cuenta.'}</div>
  </div>`;
}
function rankingAuthPanelFromSource(source){
  if(source?.matches?.('[data-ranking-auth-panel]')) return source;
  return source?.closest?.('[data-ranking-auth-panel]') || null;
}
function rankingAuthPanelElements(source){
  const panel = rankingAuthPanelFromSource(source);
  return {
    panel,
    form:panel?.querySelector?.('[data-ranking-login-form]') || null,
    username:panel?.querySelector?.('input[name="username"]') || null,
    password:panel?.querySelector?.('input[name="password"]') || null,
    usernameHelp:panel?.querySelector?.('[data-ranking-username-help]') || null,
    passwordHelp:panel?.querySelector?.('[data-ranking-password-help]') || null,
    authStatus:panel?.querySelector?.('[data-ranking-auth-status]') || null,
    loginStatus:panel?.querySelector?.('[data-ranking-login-status]') || null
  };
}
function rankingUpdateTopLoginButton(){
  const button = typeof $ === 'function' ? $('btnLogin') : document.getElementById('btnLogin');
  if(!button) return;
  const token = rankingStoredAuthToken();
  const user = rankingStoredAuthUsername() || rankingStoredManagerName();
  button.classList.toggle('online-session-active', Boolean(token));
  button.setAttribute('aria-pressed', token ? 'true' : 'false');
  button.title = token ? `Sesión online activa${user ? ` como ${user}` : ''}` : 'Verificar o iniciar sesión online';
}
function rankingBindAuthPanel(panel){
  if(!panel || panel.dataset.rankingAuthBound === '1') return;
  panel.dataset.rankingAuthBound = '1';
  panel.querySelector('[data-ranking-login-form]')?.addEventListener('submit', loginRankingAccount);
  panel.querySelector('[data-ranking-register]')?.addEventListener('click', registerRankingAccount);
  panel.querySelector('[data-ranking-logout]')?.addEventListener('click', logoutRankingAccount);
  const elements = rankingAuthPanelElements(panel);
  const refreshValidation = () => rankingValidateAuthFields(elements, false);
  elements.username?.addEventListener('input', refreshValidation);
  elements.password?.addEventListener('input', refreshValidation);
  elements.username?.addEventListener('blur', () => rankingValidateAuthFields(elements, true));
  elements.password?.addEventListener('blur', () => rankingValidateAuthFields(elements, true));
  if(rankingStoredAuthToken() && !rankingPasswordSetupStateKnown() && !rankingSessionAutoCheckInFlight){
    rankingSessionAutoCheckInFlight = true;
    setTimeout(async () => {
      try{ await checkRankingSession({ currentTarget:panel, automatic:true }); }
      finally{ rankingSessionAutoCheckInFlight = false; }
    }, 0);
  }
}
function rankingBindAuthPanels(root=document){
  root?.querySelectorAll?.('[data-ranking-auth-panel]').forEach(rankingBindAuthPanel);
  rankingUpdateTopLoginButton();
}
function rankingRefreshAuthPanels(message=''){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const panels = Array.from(document.querySelectorAll('[data-ranking-auth-panel]'));
  panels.forEach(panel => {
    const surface = String(panel.dataset.rankingAuthPanel || 'ranking');
    const holder = document.createElement('div');
    holder.innerHTML = rankingLoginPanelMarkup(endpoint, { surface });
    const replacement = holder.firstElementChild;
    if(!replacement) return;
    panel.replaceWith(replacement);
    rankingBindAuthPanel(replacement);
    if(message){
      const status = replacement.querySelector('[data-ranking-login-status]');
      if(status) status.textContent = message;
    }
  });
  rankingUpdateTopLoginButton();
}
function openRankingLoginModal(){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  openModal(`<div class="ranking-login-modal">
    <div class="section-title"><h2>Cuenta online</h2><p class="tagline">Verificá si tu sesión está activa o ingresá con la misma cuenta utilizada en Ranking.</p></div>
    ${rankingLoginPanelMarkup(endpoint, { surface:'modal' })}
    <div class="modal-actions"><button id="btnLoginOpenRanking" class="ghost" type="button">Abrir Ranking</button><button class="primary" type="button" data-close-modal>Cerrar</button></div>
  </div>`);
  const root = typeof $ === 'function' ? $('modalRoot') : document.getElementById('modalRoot');
  rankingBindAuthPanels(root || document);
  root?.querySelector?.('#btnLoginOpenRanking')?.addEventListener('click', () => {
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('ranking', '');
    activeTab = 'ranking';
    closeModal();
    if(typeof renderAll === 'function') renderAll();
  });
}
function rankingLoginRequestBodies(username, password){
  const cleanUser = String(username || '').trim();
  const cleanPassword = String(password || '');
  return [{
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ username:cleanUser, password:cleanPassword })
  }];
}
async function rankingLoginRequest(endpoint, username, password){
  const paths = rankingAuthPaths('login');
  const bodies = rankingLoginRequestBodies(username, password);
  let lastMessage = '';
  const tried = [];
  for(const path of paths){
    const route = rankingRouteLabel(path);
    for(const req of bodies){
      tried.push(route);
      let response;
      let data = {};
      try{
        response = await fetch(rankingApiUrl(endpoint, path), { method:'POST', headers:req.headers, body:req.body });
        data = await response.json().catch(() => ({}));
      }catch(error){
        lastMessage = error?.message || 'Error de conexión con el ranking.';
        continue;
      }
      if(response.ok && data.ok !== false){
        const token = rankingStoreAuthSession(data, username);
        if(token) return data;
        lastMessage = 'El login respondió sin token.';
        continue;
      }
      const message = rankingResponseErrorMessage(data, response, 'No se pudo iniciar sesión.');
      lastMessage = message;
      if(rankingIsRouteMissing(message, response)) break;
    }
  }
  const uniqueRoutes = [...new Set(tried)].join(', ');
  throw new Error(lastMessage || `No se encontró una ruta válida de login. Rutas probadas: ${uniqueRoutes}`);
}
function rankingAuthConfigPath(key, fallback){
  const cfg = (window.GAME_CONFIG && window.GAME_CONFIG.ranking) ? window.GAME_CONFIG.ranking : {};
  return String(cfg?.[key] || fallback).trim().replace(/^\/+|\/+$/g, '');
}

function rankingValidateAuthFields(elements, showEmpty=false){
  const username = String(elements?.username?.value || '').trim();
  const password = String(elements?.password?.value || '');
  const usernameAllowed = /^[\p{L}\p{N}_. -]+$/u;
  const usernameValid = username.length >= 3 && username.length <= 40 && usernameAllowed.test(username);
  const passwordValid = password.length >= 8 && password.length <= 128;
  const setState = (input, help, valid, empty, normalText, errorText) => {
    input?.classList?.toggle('is-valid', valid);
    input?.classList?.toggle('is-invalid', !valid && (!empty || showEmpty));
    if(help){
      help.classList.toggle('auth-help-error', !valid && (!empty || showEmpty));
      help.textContent = !valid && (!empty || showEmpty) ? errorText : normalText;
    }
  };
  setState(elements?.username, elements?.usernameHelp, usernameValid, !username,
    'Entre 3 y 40 caracteres. Letras, números, espacios, punto, guion o guion bajo.',
    !username ? 'Ingresá un nombre.' : 'Usá entre 3 y 40 caracteres permitidos.');
  setState(elements?.password, elements?.passwordHelp, passwordValid, !password,
    'Entre 8 y 128 caracteres.',
    !password ? 'Ingresá una contraseña.' : 'La contraseña debe tener entre 8 y 128 caracteres.');
  return { username, password, valid:usernameValid && passwordValid };
}

async function rankingAuthJsonRequest(endpoint, path, body, fallback){
  const response = await fetch(rankingApiUrl(endpoint, path), {
    method:'POST',
    headers:{ 'Content-Type':'application/json', ...rankingRequestHeaders(false) },
    body:JSON.stringify(body || {})
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok || data.ok === false) throw new Error(rankingResponseErrorMessage(data, response, fallback));
  return data;
}
async function loginRankingAccount(event){
  event?.preventDefault?.();
  const elements = rankingAuthPanelElements(event?.currentTarget || event?.target);
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const validation = rankingValidateAuthFields(elements, true);
  const { username, password } = validation;
  const status = elements.loginStatus;
  if(!validation.valid){ showNotice('Revisá el nombre y la contraseña.'); return false; }
  if(status) status.textContent = 'Iniciando sesión...';
  const submit = elements.form?.querySelector('button[type="submit"]');
  if(submit) submit.disabled = true;
  try{
    const data = await rankingLoginRequest(endpoint, username, password);
    const savedUser = rankingExtractUsername(data, username);
    const message = `Sesión iniciada${savedUser ? ` como ${savedUser}` : ''}.`;
    showNotice('Sesión iniciada en el ranking online.');
    rankingRefreshAuthPanels(message);
    return true;
  }catch(error){
    const message = error?.message || 'No se pudo iniciar sesión.';
    if(status) status.textContent = message;
    showNotice(message);
    if(submit) submit.disabled = false;
    return false;
  }
}
async function registerRankingAccount(event){
  const elements = rankingAuthPanelElements(event?.currentTarget || event?.target);
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const validation = rankingValidateAuthFields(elements, true);
  const { username, password } = validation;
  const status = elements.loginStatus;
  if(!validation.valid){ showNotice('Revisá el nombre y la contraseña.'); return false; }
  if(!confirm(`¿Crear la cuenta online "${username}"?`)) return false;
  if(status) status.textContent = 'Creando cuenta protegida...';
  try{
    const path = rankingAuthConfigPath('registerPath', 'auth/register');
    const data = await rankingAuthJsonRequest(endpoint, path, { username, password }, 'No se pudo crear la cuenta.');
    rankingStoreAuthSession(data, username);
    showNotice('Cuenta online creada e iniciada.');
    rankingRefreshAuthPanels(`Cuenta creada como ${rankingExtractUsername(data, username)}.`);
    return true;
  }catch(error){
    const message = error?.message || 'No se pudo crear la cuenta.';
    if(status) status.textContent = message;
    showNotice(message);
    return false;
  }
}
async function setRankingAccountPassword(event){
  const elements = rankingAuthPanelElements(event?.currentTarget || event?.target);
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  if(!rankingStoredAuthToken()){ showNotice('La sesión heredada ya no está disponible.'); return false; }
  const password = prompt('Elegí una contraseña nueva de al menos 8 caracteres:') || '';
  if(password.length < 8){ showNotice('La contraseña debe tener al menos 8 caracteres.'); return false; }
  const confirmation = prompt('Repetí la contraseña nueva:') || '';
  if(password !== confirmation){ showNotice('Las contraseñas no coinciden.'); return false; }
  if(elements.loginStatus) elements.loginStatus.textContent = 'Protegiendo la cuenta...';
  try{
    const path = rankingAuthConfigPath('passwordPath', 'auth/password');
    const data = await rankingAuthJsonRequest(endpoint, path, { password }, 'No se pudo establecer la contraseña.');
    try{ localStorage.setItem('fmRankingNeedsPasswordSetup', '0'); }catch(_){ /* sin almacenamiento */ }
    showNotice('La cuenta heredada quedó protegida.');
    rankingRefreshAuthPanels(data?.message || 'Contraseña establecida correctamente.');
    return true;
  }catch(error){
    const message = error?.message || 'No se pudo establecer la contraseña.';
    if(elements.loginStatus) elements.loginStatus.textContent = message;
    showNotice(message);
    return false;
  }
}
async function checkRankingSession(event){
  const automatic = event?.automatic === true;
  const elements = rankingAuthPanelElements(event?.currentTarget || event?.target);
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const token = rankingStoredAuthToken();
  const status = elements.loginStatus;
  if(!token){ showNotice('No hay sesión guardada.'); return false; }
  if(status) status.textContent = 'Verificando sesión...';
  let lastMessage = '';
  try{
    for(const path of rankingAuthPaths('me')){
      const response = await fetch(rankingApiUrl(endpoint, path), { method:'GET', headers:rankingRequestHeaders(false) });
      const data = await response.json().catch(() => ({}));
      if(response.ok && data.ok !== false){
        const user = rankingExtractUsername(data, rankingStoredAuthUsername());
        rankingSetRuntimeConfirmedUsername(user);
        try{
          if(user){
            localStorage.setItem('fmRankingAuthUser', user);
            localStorage.setItem('fmRankingAuthConfirmedUser', user);
          }
          localStorage.setItem('fmRankingNeedsPasswordSetup', data?.requires_password_setup ? '1' : '0');
        }catch(_){ /* sin almacenamiento */ }
        const message = `Sesión válida${user ? ` · ${user}` : ''}.`;
        if(!automatic) showNotice('Sesión válida en el ranking online.');
        rankingRefreshAuthPanels(message);
        rankingNotifyAuthChanged();
        return true;
      }
      const message = rankingResponseErrorMessage(data, response, 'Sesión no válida.');
      lastMessage = message;
      if(!rankingIsRouteMissing(message, response)) break;
    }
    throw new Error(lastMessage || 'No se pudo verificar la sesión.');
  }catch(error){
    rankingSetRuntimeConfirmedUsername('');
    rankingNotifyAuthChanged();
    const message = error?.message || 'No se pudo verificar la sesión.';
    if(status) status.textContent = message;
    if(!automatic) showNotice(message);
    return false;
  }
}
function logoutRankingAccount(event){
  rankingClearAuthSession();
  showNotice('Sesión del ranking cerrada en este navegador.');
  rankingRefreshAuthPanels('La sesión online fue cerrada.');
}
function rankingRequestHeaders(json=true){
  const headers = json ? { 'Content-Type':'application/json' } : {};
  const token = rankingStoredAuthToken();
  if(token){
    headers.Authorization = /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
  }
  return headers;
}
function rankingResponseErrorMessage(data, response, fallback='Error al conectar con el ranking online.'){
  return String(data?.error || data?.message || data?.detail || (response ? `Error HTTP ${response.status}` : fallback) || fallback);
}
function rankingIsRouteMissing(message, response){
  return Number(response?.status || 0) === 404 || /ruta no encontrada|route not found|not found|no encontrado/i.test(String(message || ''));
}
const RANKING_AUTO_EVENT_LABELS = {
  career_snapshot:'Carrera del manager',
  season_end:'Carrera actualizada',
  dismissal:'Carrera cerrada por despido',
  season_snapshot:'Resumen automático',
  manual_snapshot:'Carga manual'
};
function rankingEventLabel(eventType){
  const event = String(eventType || '');
  if(event.startsWith('manual_snapshot')) return 'Carga manual de carrera';
  if(event.startsWith('career_snapshot_d')){
    const day = Math.max(0, Math.round(Number(event.match(/d(\d+)$/)?.[1] || 0)));
    return day ? `Carrera actualizada automáticamente · día ${day}` : 'Carrera actualizada automáticamente';
  }
  if(event === 'career_activity_initial') return 'Primera publicación automática de la carrera';
  if(event.startsWith('career_activity_d')){
    const day = Math.max(0, Math.round(Number(event.match(/d(\d+)$/)?.[1] || 0)));
    return day ? `Actividad de carrera · día ${day}` : 'Actividad reciente de la carrera';
  }
  return RANKING_AUTO_EVENT_LABELS[event] || 'Carrera del manager';
}

const RANKING_DEFAULT_SCHEDULED_CAREER_DAYS = Object.freeze([150, 250, 350]);
let rankingAutomaticCareerSyncTimer = 0;

function rankingAutomaticCareerConfig(){
  const cfg = (window.GAME_CONFIG && window.GAME_CONFIG.ranking) ? window.GAME_CONFIG.ranking : {};
  const rawDays = Array.isArray(cfg.diasAutomaticosCarrera) ? cfg.diasAutomaticosCarrera : RANKING_DEFAULT_SCHEDULED_CAREER_DAYS;
  const scheduledDays = Array.from(new Set(rawDays
    .map(day => Math.max(1, Math.round(Number(day || 0))))
    .filter(day => Number.isFinite(day) && day <= 366)))
    .sort((a,b) => a - b);
  return {
    scheduledDays:scheduledDays.length ? scheduledDays : Array.from(RANKING_DEFAULT_SCHEDULED_CAREER_DAYS),
    firstOfficialMatches:Math.max(1, Math.round(Number(cfg.primerEnvioPartidosOficiales || 1))),
    gameIntervalDays:Math.max(1, Math.round(Number(cfg.intervaloAutomaticoDiasJuego || 50))),
    realRefreshHours:Math.max(1, Number(cfg.refrescoActividadHorasReales || 24)),
    retryMinutes:Math.max(1, Number(cfg.reintentoAutomaticoMinutos || 2))
  };
}
function rankingScheduledCareerDays(){
  return rankingAutomaticCareerConfig().scheduledDays;
}
function rankingAutomaticServerCooldownMs(){
  const cfg = (window.GAME_CONFIG && window.GAME_CONFIG.ranking) ? window.GAME_CONFIG.ranking : {};
  return Math.max(15, Number(cfg.esperaServidorSegundos || 65)) * 1000;
}
function rankingRetryDelayFromMessage(message=''){
  const text = String(message || '');
  const match = text.match(/(?:esper(?:á|a)|wait)\s+(\d+)\s*(?:segundos?|seconds?)/i) || text.match(/(\d+)\s*(?:segundos?|seconds?)\s*(?:antes|before)/i);
  if(!match) return 0;
  return Math.max(1, Number(match[1] || 0)) * 1000 + 2000;
}
function rankingAutomaticRetryState(create=true){
  if(!game) return null;
  const current = game.rankingAutomaticRetry;
  if((!current || typeof current !== 'object' || Array.isArray(current)) && !create) return null;
  const state = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  state.version = 1;
  state.status = String(state.status || 'waiting');
  state.dueAt = String(state.dueAt || '');
  state.eventType = String(state.eventType || 'career_activity_retry');
  state.eventLabel = String(state.eventLabel || rankingEventLabel(state.eventType));
  state.reason = String(state.reason || '');
  state.attempts = Math.max(0, Math.round(Number(state.attempts || 0)));
  state.payload = state.payload && typeof state.payload === 'object' && !Array.isArray(state.payload) ? state.payload : null;
  game.rankingAutomaticRetry = state;
  return state;
}
function rankingPayloadProgressValue(payload){
  if(!payload) return -1;
  const season = Math.max(0, Number(payload.season || 0));
  const matches = Math.max(0, Number(payload.careerMatches || 0));
  const dateValue = validIsoDate(payload.gameDate) ? Number(String(payload.gameDate).replace(/-/g,'')) : 0;
  return season * 1e12 + matches * 1e6 + dateValue;
}
function rankingQueueAutomaticRetry(eventType, payload, eventLabel, reason='', delayMs=0){
  if(!game || !payload) return null;
  const state = rankingAutomaticRetryState(true);
  const incoming = { ...payload, eventType:eventType || payload.eventType || 'career_activity_retry', eventLabel:eventLabel || payload.eventLabel || rankingEventLabel(eventType) };
  if(!state.payload || rankingPayloadProgressValue(incoming) >= rankingPayloadProgressValue(state.payload)){
    state.payload = incoming;
    state.eventType = incoming.eventType;
    state.eventLabel = incoming.eventLabel;
  }
  const waitMs = Math.max(1000, Number(delayMs || rankingAutomaticCareerConfig().retryMinutes * 60000));
  const proposedDue = Date.now() + waitMs;
  const existingDue = Date.parse(state.dueAt || 0);
  state.dueAt = new Date(Number.isFinite(existingDue) && existingDue > Date.now() ? Math.max(existingDue, proposedDue) : proposedDue).toISOString();
  state.status = 'waiting';
  state.reason = String(reason || state.reason || 'Actualización pendiente de reintento.');
  state.attempts = Math.max(0, Number(state.attempts || 0));
  scheduleRankingAutomaticRetryFromState();
  return state;
}
function rankingClearAutomaticRetry(){
  clearTimeout(rankingAutomaticRetryTimer);
  rankingAutomaticRetryTimer = 0;
  if(game) delete game.rankingAutomaticRetry;
}
function rankingRecoverLegacyAutomaticError(){
  if(!game || rankingAutomaticRetryState(false)?.payload) return false;
  const failed = rankingUploadEntries().find(entry => ['error','retry_wait'].includes(String(entry.status || '')) && String(entry?.payload?.recordScope || 'career') === 'career');
  if(!failed) return false;
  const payload = buildRankingPayload(rankingCleanManagerName(), { eventType:'career_activity_recovery', eventLabel:'Recuperación automática de la carrera' });
  if(!payload) return false;
  rankingQueueAutomaticRetry('career_activity_recovery', payload, 'Recuperación automática de la carrera', failed.error || 'Envío anterior pendiente.', 1500);
  return true;
}
function scheduleRankingAutomaticRetryFromState(options={}){
  clearTimeout(rankingAutomaticRetryTimer);
  rankingAutomaticRetryTimer = 0;
  if(!game || !rankingStoredAuthToken()) return false;
  rankingRecoverLegacyAutomaticError();
  const state = rankingAutomaticRetryState(false);
  if(!state?.payload) return false;
  const due = Date.parse(state.dueAt || 0);
  const delay = options.forceNow ? 0 : Math.max(0, Number.isFinite(due) ? due - Date.now() : 0);
  rankingAutomaticRetryTimer = setTimeout(() => {
    rankingAutomaticRetryTimer = 0;
    processPendingRankingAutomaticRetry({ source:options.source || 'timer' });
  }, delay);
  return true;
}
function processPendingRankingAutomaticRetry(options={}){
  const state = rankingAutomaticRetryState(false);
  if(!state?.payload || !rankingStoredAuthToken()) return false;
  const due = Date.parse(state.dueAt || 0);
  if(Number.isFinite(due) && due > Date.now()){
    scheduleRankingAutomaticRetryFromState({ source:options.source || 'not_due' });
    return false;
  }
  if(rankingAutomaticSubmissionInFlight){
    state.dueAt = new Date(Date.now() + 1500).toISOString();
    scheduleRankingAutomaticRetryFromState({ source:'in_flight' });
    return false;
  }
  state.status = 'sending';
  state.attempts = Math.max(0, Number(state.attempts || 0)) + 1;
  const payload = { ...state.payload };
  if(typeof saveLocal === 'function') saveLocal(true);
  return submitRankingAutomatically(state.eventType, {
    forceRetry:true,
    notifyErrors:false,
    notifySuccess:false,
    fromPersistentRetry:true,
    eventLabel:state.eventLabel,
    payload
  });
}
function rankingCareerActivityState(){
  if(!game) return null;
  const state = game.rankingCareerActivitySync && typeof game.rankingCareerActivitySync === 'object' && !Array.isArray(game.rankingCareerActivitySync)
    ? game.rankingCareerActivitySync
    : {};
  state.version = 1;
  state.status = String(state.status || 'idle');
  state.lastSuccessGameDate = validIsoDate(state.lastSuccessGameDate) ? state.lastSuccessGameDate : '';
  state.lastSuccessAt = String(state.lastSuccessAt || '');
  state.lastFingerprint = String(state.lastFingerprint || '');
  state.lastAttemptAt = String(state.lastAttemptAt || '');
  state.lastAttemptGameDate = validIsoDate(state.lastAttemptGameDate) ? state.lastAttemptGameDate : '';
  state.lastReason = String(state.lastReason || '');
  state.error = String(state.error || '');
  state.attempts = Math.max(0, Math.round(Number(state.attempts || 0)));
  state.loginPromptSent = Boolean(state.loginPromptSent);
  game.rankingCareerActivitySync = state;
  return state;
}
function rankingLatestSuccessfulCareerUpload(){
  if(!game?.rankingUploads || typeof game.rankingUploads !== 'object') return null;
  const entries = Object.values(game.rankingUploads).flatMap(entry => {
    if(!entry) return [];
    const candidates = [];
    if(entry.status === 'success' && String(entry?.payload?.recordScope || 'career') === 'career') candidates.push(entry);
    if(entry.lastSuccessfulPayload && String(entry.lastSuccessfulPayload?.recordScope || 'career') === 'career'){
      candidates.push({
        ...entry,
        status:'success',
        payload:{ ...entry.lastSuccessfulPayload },
        submittedAt:String(entry.lastSuccessfulAt || entry.submittedAt || entry.attemptedAt || '')
      });
    }
    return candidates;
  }).sort((a,b) => String(b.submittedAt || b.attemptedAt || '').localeCompare(String(a.submittedAt || a.attemptedAt || '')));
  return entries[0] || null;
}
function rankingCareerUploadFingerprint(payload){
  if(!payload) return '';
  return [
    payload.saveCode || game?.saveCode || '',
    Number(payload.season || game?.seasonNumber || 1),
    Number(payload.clubId || game?.selectedClubId || 0),
    Number(payload.careerMatches || 0),
    Number(payload.managerScore || 0),
    Number(payload.finalBudget || 0),
    Number(payload.titles || 0),
    payload.gameDate || rankingCurrentGameDate() || ''
  ].join('|');
}
function rankingSyncCareerActivityFromLatestUpload(state){
  if(!state) return state;
  const latest = rankingLatestSuccessfulCareerUpload();
  if(!latest) return state;
  const submittedAt = String(latest.submittedAt || latest.attemptedAt || '');
  const currentStamp = Date.parse(state.lastSuccessAt || 0);
  const latestStamp = Date.parse(submittedAt || 0);
  if(!state.lastSuccessAt || (Number.isFinite(latestStamp) && (!Number.isFinite(currentStamp) || latestStamp > currentStamp))){
    const payload = latest.payload || {};
    state.lastSuccessAt = submittedAt;
    state.lastSuccessGameDate = validIsoDate(payload.gameDate) ? payload.gameDate : (validIsoDate(game?.rankingLastUploadGameDate) ? game.rankingLastUploadGameDate : state.lastSuccessGameDate);
    state.lastFingerprint = rankingCareerUploadFingerprint(payload);
    state.status = 'success';
    state.error = '';
  }
  return state;
}
function rankingScheduledCareerState(){
  if(!game) return null;
  const state = game.rankingScheduledCareerUploads && typeof game.rankingScheduledCareerUploads === 'object' && !Array.isArray(game.rankingScheduledCareerUploads)
    ? game.rankingScheduledCareerUploads
    : {};
  state.version = 2;
  state.events = state.events && typeof state.events === 'object' && !Array.isArray(state.events) ? state.events : {};
  game.rankingScheduledCareerUploads = state;
  return state;
}
function rankingScheduledCareerKey(season, day){
  return `${Math.max(1, Math.round(Number(season || 1)))}:${Math.max(1, Math.round(Number(day || 1)))}`;
}
function rankingScheduledCareerEventType(day){
  return `career_snapshot_d${Math.max(1, Math.round(Number(day || 1)))}`;
}
function rankingScheduledCareerStatusLabel(status){
  if(status === 'success') return 'enviada';
  if(status === 'pending') return 'enviando';
  if(status === 'error' || status === 'retry_wait') return 'pendiente de reintento';
  if(status === 'skipped') return 'pendiente';
  if(status === 'superseded') return 'reemplazada por una actualización posterior';
  return 'programada';
}
function rankingRecordScheduledCareerState(season, day, status, extra={}){
  const state = rankingScheduledCareerState();
  if(!state) return null;
  const key = rankingScheduledCareerKey(season, day);
  const previous = state.events[key] && typeof state.events[key] === 'object' ? state.events[key] : {};
  const next = {
    ...previous,
    season:Math.max(1, Math.round(Number(season || game?.seasonNumber || 1))),
    day:Math.max(1, Math.round(Number(day || 1))),
    status:String(status || previous.status || 'scheduled'),
    eventType:rankingScheduledCareerEventType(day),
    eventLabel:`Carrera actualizada automáticamente · día ${Math.max(1, Math.round(Number(day || 1)))}`,
    attempts:Math.max(0, Math.round(Number(extra.attempts ?? previous.attempts ?? 0))),
    lastAttemptGameDate:String(extra.lastAttemptGameDate ?? previous.lastAttemptGameDate ?? ''),
    attemptedAt:String(extra.attemptedAt ?? previous.attemptedAt ?? ''),
    submittedAt:String(extra.submittedAt ?? previous.submittedAt ?? ''),
    error:String(extra.error ?? (status === 'success' ? '' : previous.error) ?? ''),
    notificationSent:Boolean(extra.notificationSent ?? previous.notificationSent)
  };
  state.events[key] = next;
  const keys = Object.keys(state.events).sort((a,b) => {
    const [as,ad] = a.split(':').map(Number);
    const [bs,bd] = b.split(':').map(Number);
    return as - bs || ad - bd;
  });
  while(keys.length > 24){
    const remove = keys.shift();
    delete state.events[remove];
  }
  return next;
}
function rankingNotifyScheduledCareerPending(entry, reason=''){
  if(!entry || entry.notificationSent || typeof pushGameMessage !== 'function') return;
  const loginRequired = /iniciar sesión|sesión|login/i.test(String(reason || ''));
  pushGameMessage({
    id:`ranking-scheduled-pending-${entry.season}-${entry.day}`,
    type:'sistema',
    priority:'normal',
    title:'Actualización de carrera pendiente',
    body:loginRequired
      ? `La actualización automática prevista para el día ${entry.day} quedó pendiente. Iniciá sesión en Ranking y se reintentará de inmediato.`
      : `La actualización automática prevista para el día ${entry.day} no pudo completarse y se reintentará automáticamente.`,
  });
  entry.notificationSent = true;
}
function rankingNotifyFirstCareerLoginRequired(state){
  if(!state || state.loginPromptSent || typeof pushGameMessage !== 'function') return;
  pushGameMessage({
    id:`ranking-login-required-${game?.saveCode || 'career'}`,
    type:'sistema',
    priority:'high',
    title:'Tu carrera puede aparecer en el ranking',
    body:'Ya disputaste partidos oficiales. Iniciá sesión una sola vez en Ranking para publicar esta carrera y mantenerla actualizada automáticamente mientras sigas jugando.'
  });
  state.loginPromptSent = true;
}
function rankingScheduledTarget(season, currentDay){
  const state = rankingScheduledCareerState();
  const dueDays = rankingScheduledCareerDays().filter(day => day <= currentDay);
  if(!dueDays.length) return { targetDay:0, dueDays:[], state };
  const unsentDays = dueDays.filter(day => {
    const status = state?.events?.[rankingScheduledCareerKey(season, day)]?.status;
    return status !== 'success' && status !== 'superseded';
  });
  if(!unsentDays.length) return { targetDay:0, dueDays:[], state };
  const targetDay = Math.max(...unsentDays);
  return { targetDay, dueDays:unsentDays, state };
}
function rankingAutomaticAttemptThrottled(state, options={}){
  if(!state?.lastAttemptAt) return false;
  const elapsedMs = Date.now() - Date.parse(state.lastAttemptAt || 0);
  if(!Number.isFinite(elapsedMs) || elapsedMs < 0) return false;
  if(state.status === 'pending' && elapsedMs < 45000) return true;
  if(options.forceRetry) return false;
  const retryMs = rankingAutomaticCareerConfig().retryMinutes * 60000;
  return ['error','skipped','waiting_login'].includes(state.status) && elapsedMs < retryMs;
}
function rankingAutomaticCareerDueInfo(options={}){
  const result = { due:false, eligible:false, reason:'', eventType:'', eventLabel:'', payload:null, season:0, currentDay:0, scheduledTargetDay:0, fingerprint:'', matches:0 };
  if(!game || game?.saveSlotId?.startsWith?.('challenge:') || game?.privateReviewTools?.rankingBlocked) return result;
  const currentDate = rankingCurrentGameDate();
  if(!validIsoDate(currentDate)) return result;
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  const currentDay = Math.max(1, Math.round(Number(seasonDayFromDate(currentDate, game.seasonYear || seasonYearForNumber(season)) || 1)));
  const managerName = rankingCleanManagerName();
  const payload = buildRankingPayload(managerName, { eventType:'career_activity', eventLabel:'Actividad de carrera' });
  if(!payload) return result;
  const matches = Math.max(0, Math.round(Number(payload.careerMatches || 0)));
  const cfg = rankingAutomaticCareerConfig();
  result.eligible = matches >= cfg.firstOfficialMatches;
  result.payload = payload;
  result.matches = matches;
  result.season = season;
  result.currentDay = currentDay;
  result.fingerprint = rankingCareerUploadFingerprint(payload);
  if(!result.eligible) return result;

  const scheduled = rankingScheduledTarget(season, currentDay);
  result.scheduledTargetDay = scheduled.targetDay;
  if(scheduled.targetDay){
    result.due = true;
    result.reason = 'scheduled';
    result.eventType = rankingScheduledCareerEventType(scheduled.targetDay);
    result.eventLabel = `Carrera actualizada automáticamente · día ${scheduled.targetDay}`;
    return result;
  }

  const activity = rankingSyncCareerActivityFromLatestUpload(rankingCareerActivityState());
  const lastSuccessDate = validIsoDate(activity?.lastSuccessGameDate) ? activity.lastSuccessGameDate : '';
  const lastSuccessAt = Date.parse(activity?.lastSuccessAt || 0);
  const elapsedGameDays = lastSuccessDate ? Math.max(0, daysBetweenIsoDates(lastSuccessDate, currentDate)) : Infinity;
  const elapsedRealHours = Number.isFinite(lastSuccessAt) ? Math.max(0, (Date.now() - lastSuccessAt) / 3600000) : Infinity;
  const changed = Boolean(result.fingerprint && result.fingerprint !== activity?.lastFingerprint);

  if(!lastSuccessDate && !activity?.lastSuccessAt){
    result.due = true;
    result.reason = 'first_official_match';
    result.eventType = 'career_activity_initial';
    result.eventLabel = 'Primera publicación automática de la carrera';
  }else if(elapsedGameDays >= cfg.gameIntervalDays){
    result.due = true;
    result.reason = 'game_interval';
    result.eventType = `career_activity_d${currentDay}`;
    result.eventLabel = `Actividad de carrera · día ${currentDay}`;
  }else if(changed && elapsedRealHours >= cfg.realRefreshHours){
    result.due = true;
    result.reason = 'real_activity_refresh';
    result.eventType = `career_activity_d${currentDay}`;
    result.eventLabel = 'Actividad reciente de la carrera';
  }
  return result;
}
function rankingRecordCareerActivityAttempt(info, status, extra={}){
  const state = rankingCareerActivityState();
  if(!state) return null;
  state.status = String(status || state.status || 'idle');
  state.lastReason = String(info?.reason || state.lastReason || '');
  state.lastAttemptAt = String(extra.lastAttemptAt || state.lastAttemptAt || new Date().toISOString());
  state.lastAttemptGameDate = validIsoDate(extra.lastAttemptGameDate) ? extra.lastAttemptGameDate : (validIsoDate(info?.payload?.gameDate) ? info.payload.gameDate : state.lastAttemptGameDate);
  state.attempts = Math.max(0, Math.round(Number(extra.attempts ?? state.attempts ?? 0)));
  state.error = String(extra.error ?? (status === 'success' ? '' : state.error) ?? '');
  if(status === 'success'){
    state.lastSuccessAt = String(extra.submittedAt || new Date().toISOString());
    state.lastSuccessGameDate = validIsoDate(info?.payload?.gameDate) ? info.payload.gameDate : rankingCurrentGameDate();
    state.lastFingerprint = String(info?.fingerprint || rankingCareerUploadFingerprint(info?.payload));
    state.error = '';
  }
  return state;
}
function processScheduledCareerRankingUploads(options={}){
  const summary = { checked:false, dispatched:false, season:0, currentDay:0, targetDay:0, status:'idle', source:String(options.source || 'daily') };
  const info = rankingAutomaticCareerDueInfo(options);
  summary.checked = Boolean(info.payload);
  summary.season = info.season;
  summary.currentDay = info.currentDay;
  summary.targetDay = info.scheduledTargetDay;
  if(!info.eligible){ summary.status = 'not_ready'; return summary; }
  if(!info.due){ summary.status = 'complete'; return summary; }

  const activity = rankingCareerActivityState();
  if(!rankingStoredAuthToken()){
    const attempts = Math.max(0, Number(activity?.attempts || 0));
    rankingRecordCareerActivityAttempt(info, 'waiting_login', { attempts, error:'Tenés que iniciar sesión para subir récords.' });
    if(info.scheduledTargetDay){
      rankingRecordScheduledCareerState(info.season, info.scheduledTargetDay, 'skipped', {
        attempts:Math.max(0, Number(rankingScheduledCareerState()?.events?.[rankingScheduledCareerKey(info.season, info.scheduledTargetDay)]?.attempts || 0)),
        lastAttemptGameDate:rankingCurrentGameDate(),
        attemptedAt:new Date().toISOString(),
        error:'Tenés que iniciar sesión para subir récords.'
      });
    }
    rankingNotifyFirstCareerLoginRequired(activity);
    if(typeof saveLocal === 'function') saveLocal(true);
    summary.status = 'waiting_login';
    return summary;
  }

  if(rankingAutomaticAttemptThrottled(activity, options)){
    summary.status = activity?.status || 'pending';
    return summary;
  }

  if(info.scheduledTargetDay){
    const scheduled = rankingScheduledTarget(info.season, info.currentDay);
    scheduled.dueDays.filter(day => day < info.scheduledTargetDay).forEach(day => {
      const prior = scheduled.state?.events?.[rankingScheduledCareerKey(info.season, day)];
      if(!prior || prior.status !== 'success') rankingRecordScheduledCareerState(info.season, day, 'superseded', { error:`Reemplazada por la actualización del día ${info.scheduledTargetDay}.` });
    });
  }

  const attempts = Math.max(0, Math.round(Number(activity?.attempts || 0))) + 1;
  rankingRecordCareerActivityAttempt(info, 'pending', {
    attempts,
    lastAttemptAt:new Date().toISOString(),
    lastAttemptGameDate:rankingCurrentGameDate(),
    error:''
  });
  if(info.scheduledTargetDay){
    const previous = rankingScheduledCareerState()?.events?.[rankingScheduledCareerKey(info.season, info.scheduledTargetDay)] || {};
    rankingRecordScheduledCareerState(info.season, info.scheduledTargetDay, 'pending', {
      attempts:Math.max(0, Math.round(Number(previous.attempts || 0))) + 1,
      lastAttemptGameDate:rankingCurrentGameDate(),
      attemptedAt:new Date().toISOString(),
      error:''
    });
  }
  if(typeof saveLocal === 'function') saveLocal(true);

  const payload = { ...info.payload, eventType:info.eventType, eventLabel:info.eventLabel };
  const dispatched = submitRankingAutomatically(info.eventType, {
    forceRetry:true,
    notifyErrors:false,
    notifySuccess:false,
    eventLabel:info.eventLabel,
    payload,
    onSuccess:(submittedPayload) => {
      info.payload = submittedPayload || payload;
      info.fingerprint = rankingCareerUploadFingerprint(info.payload);
      rankingRecordCareerActivityAttempt(info, 'success', {
        attempts,
        submittedAt:new Date().toISOString(),
        lastAttemptAt:new Date().toISOString(),
        lastAttemptGameDate:info.payload?.gameDate || rankingCurrentGameDate(),
        error:''
      });
      if(info.scheduledTargetDay){
        rankingRecordScheduledCareerState(info.season, info.scheduledTargetDay, 'success', {
          attempts:Math.max(1, Number(rankingScheduledCareerState()?.events?.[rankingScheduledCareerKey(info.season, info.scheduledTargetDay)]?.attempts || 1)),
          lastAttemptGameDate:info.payload?.gameDate || rankingCurrentGameDate(),
          submittedAt:new Date().toISOString(),
          error:'',
          notificationSent:false
        });
      }
      if(typeof saveLocal === 'function') saveLocal(true);
      if(activeTab === 'ranking') renderRankingOnline();
    },
    onError:(message) => {
      const error = String(message || 'Error al conectar con el ranking online.');
      rankingRecordCareerActivityAttempt(info, 'error', { attempts, lastAttemptAt:new Date().toISOString(), error });
      if(info.scheduledTargetDay){
        const entry = rankingRecordScheduledCareerState(info.season, info.scheduledTargetDay, 'error', {
          attempts:Math.max(1, Number(rankingScheduledCareerState()?.events?.[rankingScheduledCareerKey(info.season, info.scheduledTargetDay)]?.attempts || 1)),
          lastAttemptGameDate:rankingCurrentGameDate(),
          error
        });
        rankingNotifyScheduledCareerPending(entry, error);
      }
      if(typeof saveLocal === 'function') saveLocal(true);
      if(activeTab === 'ranking') renderRankingOnline();
    },
    onSkipped:(message) => {
      const error = String(message || 'La carrera todavía no está lista para subir.');
      const status = /iniciar sesión|sesión|login/i.test(error) ? 'waiting_login' : 'skipped';
      rankingRecordCareerActivityAttempt(info, status, { attempts, lastAttemptAt:new Date().toISOString(), error });
      if(status === 'waiting_login') rankingNotifyFirstCareerLoginRequired(rankingCareerActivityState());
      if(info.scheduledTargetDay){
        const entry = rankingRecordScheduledCareerState(info.season, info.scheduledTargetDay, 'skipped', {
          attempts:Math.max(1, Number(rankingScheduledCareerState()?.events?.[rankingScheduledCareerKey(info.season, info.scheduledTargetDay)]?.attempts || 1)),
          lastAttemptGameDate:rankingCurrentGameDate(),
          error
        });
        if(status !== 'waiting_login') rankingNotifyScheduledCareerPending(entry, error);
      }
      if(typeof saveLocal === 'function') saveLocal(true);
      if(activeTab === 'ranking') renderRankingOnline();
    }
  });
  summary.dispatched = Boolean(dispatched);
  summary.status = dispatched ? 'pending' : (rankingCareerActivityState()?.status || 'skipped');
  return summary;
}
function scheduleAutomaticCareerRankingSync(options={}){
  clearTimeout(rankingAutomaticCareerSyncTimer);
  rankingAutomaticCareerSyncTimer = setTimeout(() => {
    rankingAutomaticCareerSyncTimer = 0;
    if(typeof processScheduledCareerRankingUploads === 'function') processScheduledCareerRankingUploads(options);
  }, Math.max(0, Number(options.delayMs || 0)));
}
function rankingSubmissionKey(payload, eventType=payload?.eventType || 'career_snapshot'){
  if(String(payload?.recordScope || '') === 'career') return `${payload?.saveCode || 'FM'}-CAREER`;
  const event = String(eventType || 'season_snapshot');
  const manualSuffix = event.startsWith('manual_snapshot') ? `-D${payload?.seasonDay || 0}` : '';
  return `${payload?.saveCode || 'FM'}-T${payload?.season || 1}-C${payload?.clubId || 0}-${event}${manualSuffix}`;
}
function rankingSeasonInitialBudget(season){
  if(!game) return 0;
  const seasonNumber = Number(season || game.seasonNumber || 1);
  const explicit = Number(game.seasonBudgetStartBySeason?.[seasonNumber]);
  if(Number.isFinite(explicit)) return Math.round(explicit);
  if(Number.isFinite(Number(game.seasonInitialBudget))) return Math.round(Number(game.seasonInitialBudget));
  const first = (game.budgetHistory || []).find(entry => Number(entry.season || seasonNumber) === seasonNumber && Number.isFinite(Number(entry.budget)));
  if(first) return Math.round(Number(first.budget || 0) - Number(first.delta || 0));
  return Math.round(Number(game.budget || 0));
}

function rankingCareerSeasons(){
  if(!game) return [];
  game.managerStats = normalizeManagerStats(game.managerStats || createInitialManagerStats());
  const seasons = Array.isArray(game.managerStats.seasons) ? game.managerStats.seasons.map(item => ({ ...item })) : [];
  const current = game.managerStats.currentSeason || {};
  const currentPlayed = Number(current.played || 0);
  const seasonNumber = Number(game.seasonNumber || current.season || 1);
  const alreadyStored = seasons.some(item => Number(item.season || 0) === seasonNumber && Number(item.clubId || 0) === Number(game.selectedClubId || current.clubId || 0));
  if(currentPlayed > 0 && !alreadyStored){
    const division = clubDivision(game.selectedClubId);
    const table = sortedStandings(division.id);
    const index = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId));
    const row = table[index] || game.standings?.[game.selectedClubId] || {};
    seasons.push({
      season:seasonNumber,
      clubId:game.selectedClubId,
      clubName:clubName(game.selectedClubId),
      divisionId:division.id,
      divisionName:division.name,
      divisionOrder:Number(division.order || 1),
      position:index >= 0 ? index + 1 : 0,
      pts:Number(row.pts || (Number(current.won || 0) * 3 + Number(current.drawn || 0))),
      pg:Number(current.won || 0),
      pe:Number(current.drawn || 0),
      pp:Number(current.lost || 0),
      gf:Number(current.gf || 0),
      gc:Number(current.gc || 0),
      title:index === 0,
      current:true
    });
  }
  return seasons;
}
function rankingCareerInitialBudget(seasons=[]){
  if(!game) return 0;
  if(Number.isFinite(Number(game.careerInitialBudget))) return Math.round(Number(game.careerInitialBudget));
  const ordered = seasons.slice().filter(item => Number(item.season || 0) > 0).sort((a,b)=>Number(a.season||0)-Number(b.season||0));
  const firstSeason = Number(ordered[0]?.season || 1);
  const explicit = Number(game.seasonBudgetStartBySeason?.[firstSeason]);
  if(Number.isFinite(explicit)) return Math.round(explicit);
  const firstHistory = (game.budgetHistory || []).slice().sort((a,b)=>String(a.date || '').localeCompare(String(b.date || '')) || Number(a.season || 0)-Number(b.season || 0))[0];
  if(firstHistory && Number.isFinite(Number(firstHistory.budget))) return Math.round(Number(firstHistory.budget || 0) - Number(firstHistory.delta || 0));
  return rankingSeasonInitialBudget(firstSeason);
}
function rankingBestCareerPosition(seasons=[]){
  const positions = seasons.map(item => Number(item.position || 0)).filter(value => value > 0);
  return positions.length ? Math.min(...positions) : 0;
}
function rankingCareerClubNames(seasons=[]){
  const names = seasons.map(item => String(item.clubName || item.club || clubName(item.clubId) || '').trim()).filter(Boolean);
  const current = game?.selectedClubId ? clubName(game.selectedClubId) : '';
  if(current) names.push(current);
  return Array.from(new Set(names));
}
function calculateCareerManagerScore(payload){
  const points = Number(payload.points || 0);
  const gd = Number(payload.goalDifference || 0);
  const titles = Number(payload.titles || 0);
  const prestige = Number(payload.managerPrestige || 0);
  const experience = Number(payload.managerExperience || 0);
  const seasons = Number(payload.seasonsPlayed || 0);
  const playedRaw = Number(payload.careerMatches || payload.played || 0);
  const played = Math.max(1, playedRaw);
  const wins = Number(payload.won || 0);
  const draws = Number(payload.drawn || 0);
  const winRate = clamp(Math.round((wins / played) * 100), 0, 100);
  const budgetVariation = Number(payload.budgetVariation || 0);
  const negativePenalty = Number(payload.finalBudget || 0) < 0 ? -80 : 0;
  const calculated = Math.round(
    points +
    gd +
    (titles * 160) +
    (prestige * 8) +
    (winRate * 2) +
    (seasons * 25) +
    rankingBudgetScore(budgetVariation) +
    negativePenalty
  );
  if(calculated > 0) return calculated;
  // Respaldo para partidas antiguas o estados donde los totales del manager no se hayan consolidado todavía.
  // El ranking online exige un puntaje positivo y una carrera con partidos reales no debe enviarse en cero.
  return Math.max(1, Math.round((playedRaw * 5) + (wins * 12) + (draws * 4) + points + Math.max(0, prestige * 4) + Math.floor(Math.max(0, experience) / 10) + (titles * 160)));
}
function rankingScoreNumber(payload){
  if(!payload || typeof payload !== 'object') return 0;
  const candidates = [
    payload.managerScore,
    payload.manager_score,
    payload.totalScore,
    payload.total_score,
    payload.score,
    payload.puntaje_total,
    payload.puntajeTotal,
    payload.careerScore,
    payload.career_score,
    payload.total_points,
    payload.totalPoints,
    payload.puntos_totales,
    payload.ranking_score,
    payload.rankingScore
  ];
  const found = candidates
    .map(value => Number(value))
    .find(value => Number.isFinite(value) && value > 0);
  if(Number.isFinite(found) && found > 0) return Math.max(1, Math.round(found));
  const played = Number(payload.careerMatches || payload.played || 0);
  const wins = Number(payload.won || payload.pg || 0);
  const draws = Number(payload.drawn || payload.pe || 0);
  const matchPoints = Number(payload.match_points || payload.league_points || payload.points || 0);
  if(played > 0) return Math.max(1, Math.round((played * 5) + (wins * 12) + (draws * 4) + Math.max(0, matchPoints)));
  return 0;
}
function rankingScoreAliases(payload){
  const value = rankingScoreNumber(payload);
  return {
    managerScore:value,
    manager_score:value,
    puntaje_manager:value,
    totalScore:value,
    total_score:value,
    total_points:value,
    totalPoints:value,
    puntos_totales:value,
    puntaje_total:value,
    puntajeTotal:value,
    puntaje:value,
    score:value,
    rankingScore:value,
    ranking_score:value,
    careerScore:value,
    career_score:value,
    career_points_total:value,
    manager_points:value
  };
}
function rankingCareerRecord(){
  if(!game) return null;
  if(typeof syncManagerOfficialTitles === 'function') syncManagerOfficialTitles(game);
  game.managerStats = normalizeManagerStats(game.managerStats || createInitialManagerStats());
  const stats = game.managerStats;
  const totals = stats.totals || {};
  const seasons = rankingCareerSeasons();
  const currentRecord = rankingCurrentSeasonRecord();
  const currentPlayed = Number(currentRecord?.pg || 0) + Number(currentRecord?.pe || 0) + Number(currentRecord?.pp || 0);
  const currentKeyExists = seasons.some(item => Number(item.season || 0) === Number(currentRecord?.season || game.seasonNumber || 1) && Number(item.clubId || 0) === Number(currentRecord?.clubId || game.selectedClubId || 0));
  if(currentPlayed > 0 && !currentKeyExists){
    seasons.push({ ...currentRecord, divisionOrder:Number(clubDivision(currentRecord.clubId || game.selectedClubId).order || 1), current:true });
  }
  const aggregate = seasons.reduce((acc, item) => {
    acc.pts += Number(item.pts || 0);
    acc.pg += Number(item.pg || 0);
    acc.pe += Number(item.pe || 0);
    acc.pp += Number(item.pp || 0);
    acc.gf += Number(item.gf || 0);
    acc.gc += Number(item.gc || 0);
    return acc;
  }, { pts:0, pg:0, pe:0, pp:0, gf:0, gc:0 });
  aggregate.played = aggregate.pg + aggregate.pe + aggregate.pp;
  const useAggregate = aggregate.played > Number(totals.played || 0);
  const merged = useAggregate ? aggregate : {
    pts:Number(totals.won || 0) * 3 + Number(totals.drawn || 0),
    pg:Number(totals.won || 0),
    pe:Number(totals.drawn || 0),
    pp:Number(totals.lost || 0),
    gf:Number(totals.gf || 0),
    gc:Number(totals.gc || 0),
    played:Number(totals.played || 0)
  };
  const clubs = rankingCareerClubNames(seasons);
  const division = clubDivision(game.selectedClubId);
  const bestPosition = rankingBestCareerPosition(seasons);
  const bestDivisionOrder = seasons.reduce((best, item) => Math.min(best, Number(item.divisionOrder || clubDivision(item.clubId).order || 99)), Number(division.order || 1));
  return {
    season: Number(game.seasonNumber || 1),
    seasonsPlayed: Math.max(seasons.length, Number(game.seasonNumber || 1)),
    clubId: Number(game.selectedClubId || 0),
    clubName: clubName(game.selectedClubId),
    clubCount: clubs.length,
    clubsManaged: clubs,
    divisionId: division.id,
    divisionName: division.name,
    divisionOrder: Number(division.order || 1),
    bestDivisionOrder,
    position: bestPosition,
    pts: Number(merged.pts || 0),
    pg: Number(merged.pg || 0),
    pe: Number(merged.pe || 0),
    pp: Number(merged.pp || 0),
    gf: Number(merged.gf || 0),
    gc: Number(merged.gc || 0),
    played: Number(merged.played || 0),
    title: Number(stats.titles || 0) > 0,
    titles: Number(stats.titles || 0),
    experience: Number(stats.experience || 0),
    managerPrestige: typeof managerPrestigeBreakdown === 'function' ? Number(managerPrestigeBreakdown(stats).total || 0) : Number(stats.prestige || 0),
    seasons
  };
}
function rankingCurrentSeasonRecord(){
  if(!game) return null;
  const transitionRecord = game.seasonTransition?.userRecord;
  if(transitionRecord) return { ...transitionRecord };
  const division = clubDivision(game.selectedClubId);
  const table = sortedStandings(division.id);
  const index = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId));
  const row = table[index] || game.standings?.[game.selectedClubId] || {};
  const position = index >= 0 ? index + 1 : null;
  return {
    season: game.seasonNumber || 1,
    clubId: game.selectedClubId,
    clubName: clubName(game.selectedClubId),
    divisionId: division.id,
    divisionName: division.name,
    position,
    pts: Number(row.pts || 0),
    pg: Number(row.pg || 0),
    pe: Number(row.pe || 0),
    pp: Number(row.pp || 0),
    gf: Number(row.gf || 0),
    gc: Number(row.gc || 0),
    title: position === 1
  };
}
function rankingDivisionBonus(record){
  const division = (seed?.divisions || []).find(d => d.id === record?.divisionId || d.name === record?.divisionName || d.name === record?.division);
  const order = Number(division?.order || clubDivision(record?.clubId).order || 1);
  if(order <= 1) return 80;
  if(order === 2) return 35;
  return 10;
}
function rankingPositionBonus(position){
  const pos = Number(position || 0);
  if(!pos) return 0;
  if(pos === 1) return 90;
  if(pos === 2) return 65;
  if(pos === 3) return 45;
  if(pos <= 6) return 25;
  if(pos <= 10) return 10;
  return 0;
}
function rankingBudgetScore(variation){
  const value = Number(variation || 0);
  return clamp(Math.round(value / 1000000), -50, 80);
}
function calculateManagerScore(payload){
  const pts = Number(payload.points || payload.pts || 0);
  const dg = Number(payload.goalDifference || payload.dg || 0);
  const titles = Number(payload.title ? 1 : 0);
  const budgetVariation = Number(payload.budgetVariation || 0);
  const negativePenalty = Number(payload.finalBudget || 0) < 0 ? -50 : 0;
  return Math.round(
    pts +
    rankingDivisionBonus(payload) +
    rankingPositionBonus(payload.position) +
    (titles * 80) +
    (dg * 2) +
    rankingBudgetScore(budgetVariation) +
    negativePenalty
  );
}
function rankingCleanManagerName(value=''){
  const clean = String(value || rankingStoredManagerName() || rankingStoredAuthUsername() || storedManagerName() || game?.rankingManagerName || '').trim().slice(0, 40);
  return clean || 'Manager';
}
function buildRankingPayload(managerName, options={}){
  if(!game) return null;
  const cleanManagerName = rankingCleanManagerName(managerName);
  options = options && typeof options === 'object' ? options : {};
  const scope = String(options.scope || 'career');
  const eventType = String(options.eventType || (scope === 'career' ? 'career_snapshot' : 'season_snapshot'));
  const record = scope === 'season' ? rankingCurrentSeasonRecord() : rankingCareerRecord();
  if(!record) return null;
  const initialBudget = scope === 'career' ? rankingCareerInitialBudget(record.seasons || []) : rankingSeasonInitialBudget(record.season);
  const finalBudget = Math.round(Number(game.budget || 0));
  const payload = {
    recordScope:scope,
    managerName: cleanManagerName,
    manager_name: cleanManagerName,
    nombre_manager: cleanManagerName,
    clubId: Number(record.clubId || game.selectedClubId),
    club: scope === 'career' ? (record.clubName || clubName(game.selectedClubId)) : (record.clubName || clubName(game.selectedClubId)),
    currentClub: record.clubName || clubName(game.selectedClubId),
    clubsManaged:Array.isArray(record.clubsManaged) ? record.clubsManaged : [],
    clubCount:Number(record.clubCount || 1),
    season: Number(record.season || game.seasonNumber || 1),
    seasonsPlayed:Number(record.seasonsPlayed || record.season || game.seasonNumber || 1),
    careerMatches:Number(record.played || 0),
    divisionId: record.divisionId || clubDivision(game.selectedClubId).id,
    division: record.divisionName || clubDivision(game.selectedClubId).name,
    divisionOrder: Number(record.divisionOrder || clubDivision(record.clubId || game.selectedClubId).order || 1),
    bestDivisionOrder:Number(record.bestDivisionOrder || record.divisionOrder || 1),
    position: Number(record.position || 0),
    points: Number(record.pts || 0),
    won: Number(record.pg || 0),
    drawn: Number(record.pe || 0),
    lost: Number(record.pp || 0),
    goalsFor: Number(record.gf || 0),
    goalsAgainst: Number(record.gc || 0),
    goalDifference: Number(record.gf || 0) - Number(record.gc || 0),
    initialBudget,
    finalBudget,
    budgetVariation: finalBudget - initialBudget,
    titles: Number(record.titles ?? game.managerStats?.titles ?? 0),
    title: Boolean(record.title),
    managerPrestige:Number(record.managerPrestige ?? game.managerStats?.prestige ?? 0),
    managerExperience:Number(record.experience ?? game.managerStats?.experience ?? 0),
    submittedAt: new Date().toISOString(),
    gameDate: rankingCurrentGameDate(),
    seasonDay: seasonDayFromDate(rankingCurrentGameDate(), game.seasonYear || seasonYearForNumber(game.seasonNumber || 1)),
    saveCode: game.saveCode || generateSaveCode(),
    version: APP_VERSION,
    eventType,
    eventLabel: options.eventLabel || rankingEventLabel(eventType)
  };
  payload.managerScore = scope === 'career' ? calculateCareerManagerScore(payload) : calculateManagerScore(payload);
  if(Number(payload.managerScore || 0) <= 0){
    const played = Number(payload.careerMatches || payload.played || 0);
    const fallback = Math.round((played * 5) + Number(payload.points || 0) + (Number(payload.won || 0) * 12) + (Number(payload.drawn || 0) * 4) + (Number(payload.titles || 0) * 160) + Math.floor(Math.max(0, Number(payload.managerExperience || 0)) / 10));
    payload.managerScore = Math.max(played > 0 ? 1 : 0, fallback);
  }
  Object.assign(payload, rankingScoreAliases(payload));
  payload.submissionKey = rankingSubmissionKey(payload, eventType);
  return payload;
}

function rankingValue(row, ...keys){
  for(const key of keys){
    if(row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function rankingApiRowToGameRow(row){
  if(!row) return row;
  const mapped = { ...row };
  mapped.managerName = rankingValue(row, 'managerName', 'manager_name', 'manager');
  mapped.club = rankingValue(row, 'club', 'club_name', 'club_usado', 'current_club');
  mapped.division = rankingValue(row, 'division', 'division_name', 'league_name');
  mapped.season = rankingValue(row, 'season', 'temporada', 'season_number');
  mapped.position = rankingValue(row, 'position', 'bestPosition', 'best_position', 'finalPosition', 'final_position', 'posicion_final');
  mapped.points = rankingValue(row, 'matchPoints', 'match_points', 'pts', 'puntos', 'points', 'career_points');
  mapped.managerScore = rankingValue(row, 'managerScore', 'manager_score', 'puntaje_manager', 'points');
  mapped.initialBudget = rankingValue(row, 'initialBudget', 'initial_budget', 'budget_initial', 'presupuesto_inicial');
  mapped.finalBudget = rankingValue(row, 'finalBudget', 'final_budget', 'budget_final', 'presupuesto_final');
  mapped.budgetVariation = rankingValue(row, 'budgetVariation', 'budget_variation', 'variacion_presupuesto');
  mapped.titles = rankingValue(row, 'titles', 'titulos', 'title', 'titulo');
  mapped.submittedAt = rankingValue(row, 'submittedAt', 'submitted_at', 'updated_at', 'created_at', 'fecha_envio');
  mapped.saveCode = rankingValue(row, 'saveCode', 'save_code', 'save_hash', 'codigo_partida');
  mapped.version = rankingValue(row, 'version', 'game_version');
  mapped.eventType = rankingValue(row, 'eventType', 'event_type', 'evento_tipo');
  mapped.eventLabel = rankingValue(row, 'eventLabel', 'event_label', 'evento');
  mapped.won = rankingValue(row, 'won', 'wins', 'Partidos ganados', 'ganados');
  mapped.drawn = rankingValue(row, 'drawn', 'draws', 'Partidos empatados', 'empatados');
  mapped.lost = rankingValue(row, 'lost', 'losses', 'Partidos perdidos', 'perdidos');
  mapped.goalsFor = rankingValue(row, 'goalsFor', 'goals_for', 'Goles a favor', 'gf');
  mapped.goalsAgainst = rankingValue(row, 'goalsAgainst', 'goals_against', 'Goles en contra', 'gc');
  mapped.goalDifference = rankingValue(row, 'goalDifference', 'goal_difference', 'Diferencia de gol', 'dg');
  mapped.recordScope = rankingValue(row, 'recordScope', 'record_scope', 'tipo_registro');
  mapped.seasonsPlayed = rankingValue(row, 'seasonsPlayed', 'seasons_played', 'temporadas_jugadas', 'season_number');
  mapped.careerMatches = rankingValue(row, 'careerMatches', 'career_matches', 'partidos_carrera', 'played');
  mapped.currentClub = rankingValue(row, 'currentClub', 'current_club', 'club_actual', 'club_name', 'club');
  mapped.clubCount = rankingValue(row, 'clubCount', 'club_count', 'clubes_dirigidos');
  mapped.managerPrestige = rankingValue(row, 'managerPrestige', 'manager_prestige', 'prestigio_manager');
  mapped.managerExperience = rankingValue(row, 'managerExperience', 'manager_experience', 'experiencia_manager');
  return mapped;
}

function rankingPlainObject(value){
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}
function rankingJsonSafeValue(value){
  if(value === undefined || value === null) return '';
  if(typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if(typeof value === 'boolean') return value;
  if(Array.isArray(value)) return value.map(rankingJsonSafeValue);
  if(typeof value === 'object'){
    const out = {};
    Object.entries(value).forEach(([key, val]) => { out[key] = rankingJsonSafeValue(val); });
    return out;
  }
  return String(value);
}
function rankingJsonSafeObject(obj){
  const out = {};
  Object.entries(rankingPlainObject(obj)).forEach(([key, value]) => { out[key] = rankingJsonSafeValue(value); });
  return out;
}
function rankingPathPrefersJson(path){
  const route = String(path || '').toLowerCase();
  return route.includes('career') || route.includes('ranking') || route.includes('records') || route.includes('scores') || route.includes('submit');
}
function rankingRequestVariantsForPath(path, apiBody, fullPayload){
  const token = String(RANKING_TOKEN || '').trim();
  const cleanApiBody = rankingJsonSafeObject(apiBody);
  const cleanFullPayload = rankingJsonSafeObject(fullPayload);
  const jsonHeaders = rankingRequestHeaders(true);
  const formHeaders = { ...rankingRequestHeaders(false), 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' };
  const jsonVariants = [
    { label:'json-flat', headers:jsonHeaders, body:JSON.stringify(cleanApiBody) },
    { label:'json-action-flat', headers:jsonHeaders, body:JSON.stringify({ action:'submit', ...cleanApiBody }) },
    // Algunos Workers validan campos de nivel superior aunque también acepten payload anidado.
    { label:'json-payload-object', headers:jsonHeaders, body:JSON.stringify({ action:'submit', ...cleanApiBody, payload:cleanFullPayload, token }) }
  ];
  const formVariants = [
    { label:'form-payload', headers:formHeaders, body:new URLSearchParams({ action:'submit', payload:JSON.stringify(cleanFullPayload), token }).toString() },
    { label:'form-flat', headers:formHeaders, body:new URLSearchParams(Object.entries({ action:'submit', ...cleanApiBody, token }).reduce((acc, [key, value]) => { acc[key] = value === undefined || value === null ? '' : String(value); return acc; }, {})).toString() }
  ];
  return rankingPathPrefersJson(path) ? jsonVariants : jsonVariants.concat(formVariants);
}
function rankingPayloadToApiBody(payload){
  const cleanManagerName = rankingCleanManagerName(payload?.managerName || payload?.manager_name || payload?.nombre_manager);
  const totalScore = rankingScoreNumber(payload);
  const matchPoints = Number(payload?.points || payload?.match_points || payload?.league_points || 0);
  const body = {
    // Nombres del Worker Cloudflare + D1.
    record_scope: payload.recordScope || 'career',
    manager_name: cleanManagerName,
    managerName: cleanManagerName,
    nombre_manager: cleanManagerName,
    manager: cleanManagerName,
    name: cleanManagerName,
    username: cleanManagerName,
    club_name: payload.club,
    current_club: payload.currentClub || payload.club || '',
    clubs_managed: Array.isArray(payload.clubsManaged) ? payload.clubsManaged.join(' | ') : String(payload.clubsManaged || ''),
    club_count: Number(payload.clubCount || 1),
    country: payload.country || '',
    league_name: payload.division,
    season_number: payload.season,
    seasons_played: payload.seasonsPlayed || payload.season || 1,
    career_matches: payload.careerMatches || payload.played || 0,
    final_position: payload.position,
    best_position: payload.position || 0,
    // El Worker actual valida el puntaje total con nombres distintos según versión.
    // Por compatibilidad, `points` también lleva el puntaje total; los puntos deportivos van aparte.
    points: totalScore,
    total_points: totalScore,
    match_points: matchPoints,
    league_points: matchPoints,
    career_match_points: matchPoints,
    wins: payload.won,
    draws: payload.drawn,
    losses: payload.lost,
    goals_for: payload.goalsFor,
    goals_against: payload.goalsAgainst,
    goal_difference: payload.goalDifference,
    budget_initial: payload.initialBudget,
    budget_final: payload.finalBudget,
    budget_variation: payload.budgetVariation,
    titles: Number(payload.titles || 0),
    manager_score: totalScore,
    manager_prestige: Number(payload.managerPrestige ?? game?.managerPrestige ?? game?.managerStats?.prestige ?? 0),
    manager_experience: Number(payload.managerExperience ?? game?.managerStats?.experience ?? 0),
    game_version: payload.version || APP_VERSION,
    save_hash: payload.saveCode || '',

    // Aliases usados por versiones previas del front/juego.
    club_id: payload.clubId,
    recordScope: payload.recordScope || 'career',
    season: payload.season,
    seasonsPlayed: payload.seasonsPlayed || payload.season || 1,
    careerMatches: payload.careerMatches || payload.played || 0,
    currentClub: payload.currentClub || payload.club || '',
    clubCount: payload.clubCount || 1,
    clubsManaged: Array.isArray(payload.clubsManaged) ? payload.clubsManaged.join(' | ') : String(payload.clubsManaged || ''),
    division: payload.division,
    division_id: payload.divisionId,
    division_order: payload.divisionOrder,
    position: payload.position,
    won: payload.won,
    drawn: payload.drawn,
    lost: payload.lost,
    initial_budget: payload.initialBudget,
    final_budget: payload.finalBudget,
    title: payload.title ? 1 : 0,
    ...rankingScoreAliases(payload),
    submitted_at: payload.submittedAt || new Date().toISOString(),
    event_type: payload.eventType || 'career_snapshot',
    event_label: payload.eventLabel || rankingEventLabel(payload.eventType),
    game_date: payload.gameDate || '',
    season_day: payload.seasonDay || 0,
    submission_key: payload.submissionKey || '',
    save_code: payload.saveCode || '',
    codigo_partida: payload.saveCode || '',
    saveHash: payload.saveCode || '',
    version: payload.version || APP_VERSION
  };
  if(String(RANKING_TOKEN || '').trim()) body.token = String(RANKING_TOKEN).trim();
  return body;
}
function normalizeRankingRow(row){
  row = rankingApiRowToGameRow(row);
  const initialBudgetRaw = rankingValue(row, 'initialBudget', 'Presupuesto inicial', 'presupuesto_inicial', 'budget_initial', 'initial_budget');
  const finalBudgetRaw = rankingValue(row, 'finalBudget', 'Presupuesto final', 'presupuesto_final', 'budget_final', 'final_budget');
  const variationRaw = rankingValue(row, 'budgetVariation', 'Variación de presupuesto', 'variacion_presupuesto', 'budget_variation');
  const normalized = {
    managerName: String(rankingValue(row, 'managerName', 'Nombre del manager', 'nombre_manager', 'manager', 'manager_name') || '').trim(),
    club: String(rankingValue(row, 'club', 'Club usado', 'club_usado', 'club_name', 'current_club') || '').trim(),
    season: Number(rankingValue(row, 'season', 'Temporada', 'temporada', 'season_number') || 0),
    division: String(rankingValue(row, 'division', 'División', 'division', 'league_name', 'division_name') || '').trim(),
    position: Number(rankingValue(row, 'position', 'bestPosition', 'best_position', 'finalPosition', 'final_position', 'Posición final', 'posicion_final') || 0),
    points: Number(rankingValue(row, 'points', 'matchPoints', 'match_points', 'league_points', 'career_match_points', 'Puntos', 'puntos') || 0),
    won: Number(rankingValue(row, 'won', 'wins', 'Partidos ganados', 'ganados') || 0),
    drawn: Number(rankingValue(row, 'drawn', 'draws', 'Partidos empatados', 'empatados') || 0),
    lost: Number(rankingValue(row, 'lost', 'losses', 'Partidos perdidos', 'perdidos') || 0),
    goalsFor: Number(rankingValue(row, 'goalsFor', 'Goles a favor', 'gf', 'goals_for') || 0),
    goalsAgainst: Number(rankingValue(row, 'goalsAgainst', 'Goles en contra', 'gc', 'goals_against') || 0),
    goalDifference: Number(rankingValue(row, 'goalDifference', 'Diferencia de gol', 'dg', 'goal_difference') || 0),
    initialBudget: initialBudgetRaw === '' ? 0 : Number(initialBudgetRaw),
    finalBudget: finalBudgetRaw === '' ? 0 : Number(finalBudgetRaw),
    budgetVariation: variationRaw === '' ? 0 : Number(variationRaw),
    titles: Number(rankingValue(row, 'titles', 'title', 'Cantidad de títulos', 'titulos', 'titulo') || 0),
    submittedAt: String(rankingValue(row, 'submittedAt', 'submitted_at', 'updated_at', 'created_at', 'Fecha de envío', 'fecha_envio') || '').trim(),
    saveCode: String(rankingValue(row, 'saveCode', 'save_code', 'save_hash', 'Código de partida', 'codigo_partida') || '').trim(),
    managerScore: Number(rankingValue(row, 'managerScore', 'manager_score', 'total_score', 'puntaje_manager', 'Puntaje manager') || 0),
    eventType: String(rankingValue(row, 'eventType', 'event_type', 'evento_tipo') || '').trim(),
    eventLabel: String(rankingValue(row, 'eventLabel', 'event_label', 'evento') || '').trim(),
    recordScope: String(rankingValue(row, 'recordScope', 'record_scope', 'tipo_registro') || 'career').trim(),
    seasonsPlayed: Number(rankingValue(row, 'seasonsPlayed', 'seasons_played', 'temporadas_jugadas') || rankingValue(row, 'season', 'Temporada', 'temporada', 'season_number') || 0),
    careerMatches: Number(rankingValue(row, 'careerMatches', 'career_matches', 'partidos_carrera') || rankingValue(row, 'played', 'partidos_jugados') || 0),
    currentClub: String(rankingValue(row, 'currentClub', 'current_club', 'club_actual', 'club_name', 'club') || '').trim(),
    clubCount: Number(rankingValue(row, 'clubCount', 'club_count', 'clubes_dirigidos') || 0),
    managerPrestige: Number(rankingValue(row, 'managerPrestige', 'manager_prestige', 'prestigio_manager') || 0),
    managerExperience: Number(rankingValue(row, 'managerExperience', 'manager_experience', 'experiencia_manager') || 0),
    rowId:Number(rankingValue(row, 'id', 'record_id') || 0)
  };
  if(!normalized.currentClub) normalized.currentClub = normalized.club;
  if(!normalized.club) normalized.club = normalized.currentClub;
  if(variationRaw === '' && (initialBudgetRaw !== '' || finalBudgetRaw !== '')) normalized.budgetVariation = normalized.finalBudget - normalized.initialBudget;
  if(!normalized.careerMatches) normalized.careerMatches = Number(normalized.won || 0) + Number(normalized.drawn || 0) + Number(normalized.lost || 0);
  if(!normalized.managerScore) normalized.managerScore = normalized.recordScope === 'career' ? calculateCareerManagerScore(normalized) : calculateManagerScore(normalized);
  if(!normalized.eventLabel) normalized.eventLabel = rankingEventLabel(normalized.eventType || 'career_snapshot');
  return normalized;
}

function rankingDedupeKey(row){
  const saveCode = String(row?.saveCode || '').trim();
  if(saveCode) return `save:${saveCode}`;
  const manager = String(row?.managerName || '').trim().toLowerCase();
  return `manager:${manager || 'manager'}:${String(row?.currentClub || row?.club || '').trim().toLowerCase()}`;
}
function rankingRowCompleteness(row){
  return [row?.currentClub, row?.division, row?.careerMatches, row?.position, row?.titles, row?.initialBudget, row?.finalBudget].reduce((sum, value) => sum + (value !== undefined && value !== null && value !== '' && Number(value) !== 0 ? 1 : 0), 0);
}
function dedupeRankingRows(rows=[]){
  const map = new Map();
  (rows || []).forEach(row => {
    const key = rankingDedupeKey(row);
    const current = map.get(key);
    if(!current){ map.set(key, row); return; }
    const rowDate = Date.parse(row.submittedAt || '') || 0;
    const currentDate = Date.parse(current.submittedAt || '') || 0;
    if(rowDate > currentDate){ map.set(key, row); return; }
    if(rowDate < currentDate) return;
    const rowId = Number(row.rowId || 0);
    const currentId = Number(current.rowId || 0);
    if(rowId > currentId || (rowId === currentId && rankingRowCompleteness(row) >= rankingRowCompleteness(current))) map.set(key, row);
  });
  return Array.from(map.values());
}

function rankingSortParts(sortKey=rankingSort){
  const match = String(sortKey || '').trim().match(/^(.+)_(asc|desc)$/i);
  return match ? { key:match[1], dir:match[2].toLowerCase() } : { key:'managerScore', dir:'desc' };
}
function rankingNormalizedSort(sortKey=rankingSort){
  const allowed = new Set(['managerScore','division','club','points','finalBudget','seasonsPlayed','careerMatches']);
  const parts = rankingSortParts(sortKey);
  return `${allowed.has(parts.key) ? parts.key : 'managerScore'}_${parts.dir === 'asc' ? 'asc' : 'desc'}`;
}
function sortRankingRows(rows, sortKey=rankingSort){
  const { key, dir } = rankingSortParts(rankingNormalizedSort(sortKey));
  const direction = dir === 'asc' ? 1 : -1;
  const getter = {
    managerScore: row => Number(row.managerScore || 0),
    division: row => String(row.division || '').trim(),
    club: row => String(row.currentClub || row.club || '').trim(),
    points: row => Number(row.points || 0),
    finalBudget: row => Number(row.finalBudget || 0),
    seasonsPlayed: row => Number(row.seasonsPlayed || row.season || 0),
    careerMatches: row => Number(row.careerMatches || (Number(row.won || 0) + Number(row.drawn || 0) + Number(row.lost || 0)) || 0)
  }[key] || (row => Number(row.managerScore || 0));
  return (Array.isArray(rows) ? rows : []).slice().sort((a,b)=>{
    const av = getter(a);
    const bv = getter(b);
    let primary = 0;
    if(typeof av === 'string' || typeof bv === 'string') primary = String(av).localeCompare(String(bv), 'es', { sensitivity:'base', numeric:true });
    else primary = av > bv ? 1 : av < bv ? -1 : 0;
    if(primary) return primary * direction;
    const scoreTie = Number(b.managerScore || 0) - Number(a.managerScore || 0);
    if(scoreTie) return scoreTie;
    const dateTie = String(b.submittedAt || '').localeCompare(String(a.submittedAt || ''));
    if(dateTie) return dateTie;
    return String(a.managerName || '').localeCompare(String(b.managerName || ''), 'es', { sensitivity:'base' });
  });
}
function rankingSortLabel(sortKey=rankingSort){
  const { key, dir } = rankingSortParts(rankingNormalizedSort(sortKey));
  const labels = {
    managerScore:'Índice carrera', division:'División', club:'Club', points:'Pts. deportivos',
    finalBudget:'Presupuesto final', seasonsPlayed:'Temporadas', careerMatches:'Partidos'
  };
  return `${labels[key] || 'Índice carrera'} · ${dir === 'asc' ? 'menor a mayor' : 'mayor a menor'}`;
}
function rankingSortButton(key, label){
  const current = rankingSortParts(rankingNormalizedSort(rankingSort));
  const isActive = current.key === key;
  const currentDir = isActive ? current.dir : 'desc';
  const nextDir = isActive && currentDir === 'desc' ? 'asc' : 'desc';
  const arrow = isActive ? (currentDir === 'asc' ? '↑' : '↓') : '';
  return `<button class="ranking-sort ${isActive ? 'active' : ''}" data-ranking-sort="${escapeHtml(key)}_${nextDir}" type="button" aria-pressed="${isActive ? 'true' : 'false'}" title="Ordenar por ${escapeHtml(label)}">${escapeHtml(label)} ${arrow}</button>`;
}
function rankingRefreshSortedTable(){
  const box = document.getElementById('rankingTableBox');
  if(!box) return false;
  box.innerHTML = rankingRowsTable(rankingRowsCache);
  return true;
}
function rankingInstallSortDelegation(){
  if(!view || view.__rankingSortDelegationV969) return;
  view.__rankingSortDelegationV969 = true;
  view.addEventListener('click', event => {
    const button = event.target?.closest?.('[data-ranking-sort]');
    if(!button || !view.contains(button)) return;
    event.preventDefault();
    event.stopPropagation();
    rankingSort = rankingNormalizedSort(button.dataset.rankingSort || 'managerScore_desc');
    rankingRefreshSortedTable();
  });
}
function rankingRowMarkup(row, index){
  const budgetCls = Number(row.budgetVariation || 0) >= 0 ? 'ok' : 'bad';
  const seasons = Number(row.seasonsPlayed || row.season || 0);
  const matches = Number(row.careerMatches || (Number(row.won || 0) + Number(row.drawn || 0) + Number(row.lost || 0)) || 0);
  return `<tr>
    <td><strong>${index + 1}</strong></td>
    <td><strong>${escapeHtml(row.managerName || 'Manager')}</strong><br><span class="muted small">${escapeHtml(row.saveCode || '')}</span></td>
    <td>${escapeHtml(row.currentClub || row.club || '—')}</td>
    <td>${escapeHtml(row.division || '—')}</td>
    <td>${seasons || '—'}</td>
    <td>${matches || '—'}</td>
    <td>${row.position ? `${row.position}°` : '—'}</td>
    <td><strong>${Number(row.managerScore || 0)}</strong></td>
    <td>${Number(row.points || 0)}</td>
    <td>${Number(row.won || 0)}-${Number(row.drawn || 0)}-${Number(row.lost || 0)}</td>
    <td>${Number(row.goalDifference || 0) > 0 ? '+' : ''}${Number(row.goalDifference || 0)}</td>
    <td>${Number(row.titles || 0)}</td>
    <td>${formatMoney(Number(row.finalBudget || 0))}<br><span class="${budgetCls} small">${Number(row.budgetVariation || 0) >= 0 ? '+' : ''}${formatMoney(Number(row.budgetVariation || 0))}</span></td>
  </tr>`;
}
function rankingRowsTable(rows){
  const sorted = sortRankingRows(rows).slice(0, RANKING_PAGE_SIZE);
  return `<div class="ranking-sortbar" aria-label="Orden del ranking de carreras">
    ${rankingSortButton('managerScore','Índice carrera')}
    ${rankingSortButton('division','División')}
    ${rankingSortButton('club','Club')}
    ${rankingSortButton('points','Pts. deportivos')}
    ${rankingSortButton('finalBudget','Presupuesto final')}
    ${rankingSortButton('seasonsPlayed','Temporadas')}
    ${rankingSortButton('careerMatches','Partidos')}
    <span class="ranking-sort-current" aria-live="polite">Orden: ${escapeHtml(rankingSortLabel())}</span>
  </div>
  <p class="small muted"><strong>Índice carrera:</strong> combina rendimiento deportivo, títulos, prestigio, temporadas y economía. <strong>Pts. deportivos:</strong> 3 por victoria y 1 por empate acumulados en la carrera.</p><div class="table-wrap ranking-table-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Manager</th><th>Club actual</th><th>División</th><th>Temps.</th><th>Partidos</th><th>Mejor pos.</th><th>Índice carrera</th><th>Pts. deportivos</th><th>G-E-P</th><th>DG</th><th>Títulos</th><th>Presupuesto final</th></tr></thead><tbody>${sorted.length ? sorted.map(rankingRowMarkup).join('') : '<tr><td colspan="13" class="muted">Todavía no hay carreras cargadas.</td></tr>'}</tbody></table></div>`;
}
function rankingSeasonPreviewMarkup(payload){
  if(!payload) return '<p class="muted">No hay partida activa para calcular una temporada.</p>';
  return `<div class="ranking-preview-grid">
    <div><span>Manager</span><strong>${escapeHtml(payload.managerName || 'Manager')}</strong></div>
    <div><span>Evento previsto</span><strong>${escapeHtml(payload.eventLabel || rankingEventLabel(payload.eventType))}</strong></div>
    <div><span>Club actual</span><strong>${escapeHtml(payload.currentClub || payload.club)}</strong></div>
    <div><span>Temporadas</span><strong>${Number(payload.seasonsPlayed || payload.season || 0)}</strong></div>
    <div><span>Partidos de carrera</span><strong>${Number(payload.careerMatches || 0)}</strong></div>
    <div><span>Mejor posición</span><strong>${payload.position ? `${payload.position}°` : '—'}</strong></div>
    <div><span>Pts. deportivos</span><strong>${payload.points}</strong></div>
    <div><span>Presupuesto inicial</span><strong>${formatMoney(payload.initialBudget)}</strong></div>
    <div><span>Presupuesto final</span><strong>${formatMoney(payload.finalBudget)}</strong></div>
    <div><span>Variación</span><strong class="${payload.budgetVariation >= 0 ? 'ok' : 'bad'}">${payload.budgetVariation >= 0 ? '+' : ''}${formatMoney(payload.budgetVariation)}</strong></div>
    <div><span>Índice de carrera</span><strong>${payload.managerScore}</strong></div>
  </div>`;
}
function rankingUploadEntries(){
  const uploads = game?.rankingUploads && typeof game.rankingUploads === 'object' && !Array.isArray(game.rankingUploads) ? game.rankingUploads : {};
  return Object.entries(uploads).map(([key, value]) => ({ key, ...(value || {}) })).sort((a,b)=> String(b.submittedAt || b.attemptedAt || '').localeCompare(String(a.submittedAt || a.attemptedAt || '')));
}
function rankingAutomaticStatusMarkup(){
  if(!game) return '<p class="small muted">No hay partida activa.</p>';
  const cfg = rankingAutomaticCareerConfig();
  const entries = rankingUploadEntries().filter(entry => ['season_end','dismissal'].includes(String(entry.eventType || '')) || String(entry.eventType || '').startsWith('career_snapshot_d') || String(entry.eventType || '').startsWith('career_activity'));
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  const scheduledState = rankingScheduledCareerState();
  const schedule = rankingScheduledCareerDays().map(day => {
    const entry = scheduledState?.events?.[rankingScheduledCareerKey(season, day)] || {};
    const status = rankingScheduledCareerStatusLabel(entry.status || 'scheduled');
    const cls = entry.status === 'success' ? 'ok' : ['error','retry_wait'].includes(entry.status) ? 'warn' : entry.status === 'pending' ? 'warn' : 'muted';
    return `<span>Día ${day}: <strong class="${cls}">${escapeHtml(status)}</strong></span>`;
  }).join(' · ');
  const activity = rankingSyncCareerActivityFromLatestUpload(rankingCareerActivityState());
  const preview = buildRankingPayload(rankingCleanManagerName(), { eventType:'career_activity_preview', eventLabel:'Estado de actividad' });
  const matches = Math.max(0, Math.round(Number(preview?.careerMatches || 0)));
  const currentDate = rankingCurrentGameDate();
  const elapsed = validIsoDate(activity?.lastSuccessGameDate) && validIsoDate(currentDate)
    ? Math.max(0, daysBetweenIsoDates(activity.lastSuccessGameDate, currentDate))
    : 0;
  const remaining = activity?.lastSuccessGameDate ? Math.max(0, cfg.gameIntervalDays - elapsed) : 0;
  let activityLine = '';
  if(game?.privateReviewTools?.rankingBlocked){
    activityLine = '<span class="bad">Bloqueado para esta partida modificada.</span>';
  }else if(matches < cfg.firstOfficialMatches){
    activityLine = `Se publicará después de ${cfg.firstOfficialMatches === 1 ? 'tu primer partido oficial' : `${cfg.firstOfficialMatches} partidos oficiales`}.`;
  }else if(!rankingStoredAuthToken()){
    activityLine = '<span class="warn">Pendiente de iniciar sesión. Al ingresar se enviará de inmediato.</span>';
  }else if(activity?.status === 'pending'){
    activityLine = '<span class="warn">Actualización en curso.</span>';
  }else if(['error','skipped','retry_wait'].includes(activity?.status)){
    activityLine = `<span class="warn">Pendiente de reintento automático.</span>${activity?.error ? ` ${escapeHtml(activity.error)}` : ''}`;
  }else if(activity?.lastSuccessGameDate){
    activityLine = `<span class="ok">Carrera publicada.</span> Última actualización: ${escapeHtml(activity.lastSuccessGameDate)}.${remaining > 0 ? ` Próxima actualización por actividad en ${remaining} día(s) de juego.` : ' Hay una actualización disponible.'}`;
  }else{
    activityLine = 'Lista para la primera publicación automática.';
  }
  const latest = entries[0] || null;
  const retryState = rankingAutomaticRetryState(false);
  const latestMarkup = latest ? (() => {
    const waiting = ['retry_wait','error'].includes(String(latest.status || '')) && Boolean(retryState?.payload);
    const statusText = latest.status === 'success' ? 'Enviado' : latest.status === 'pending' ? 'Pendiente' : waiting ? 'Reintento programado' : latest.status === 'error' ? 'Pendiente de reintento' : 'Registrado';
    const statusClass = latest.status === 'success' ? 'ok' : waiting ? 'warn' : latest.status === 'error' ? 'warn' : 'warn';
    const retryText = waiting && retryState?.dueAt ? ` · Próximo intento automático: ${escapeHtml(new Date(retryState.dueAt).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }))}` : '';
    return `<p><strong>${escapeHtml(latest.eventLabel || rankingEventLabel(latest.eventType))}</strong> · <span class="${statusClass}">${escapeHtml(statusText)}</span></p>
      <p class="small muted">${escapeHtml(latest.club || '')}${latest.season ? ` · Temporada ${Number(latest.season)}` : ''}${latest.error ? ` · ${escapeHtml(latest.error)}` : ''}${retryText}</p>`;
  })() : '<p class="small muted">Todavía no se registraron envíos automáticos.</p>';
  return `<div class="ranking-auto-status">
    <p class="small muted">Publicación automática de actividad</p>
    <p class="small">${activityLine}</p>
    ${latestMarkup}
    <p class="small muted">Controles adicionales de temporada: ${schedule}</p>
  </div>`;
}
function rankingSubmitPanelMarkup(payload, endpoint){
  const info = rankingUploadCooldownInfo();
  const hasSession = Boolean(rankingStoredAuthToken());
  const loginOk = !RANKING_REQUIRES_LOGIN || hasSession;
  const privateToolsBlocked = Boolean(game?.privateReviewTools?.rankingBlocked);
  const canUpload = Boolean(endpoint && game && payload && info.canUpload && loginOk && !privateToolsBlocked);
  const buttonLabel = privateToolsBlocked ? 'Ranking bloqueado en esta partida' : !loginOk ? 'Iniciar sesión para subir' : canUpload ? 'Subir carrera' : rankingCooldownText(info);
  const manualStatus = info.last
    ? `Última carga manual: día ${seasonDayFromDate(info.last, game?.seasonYear || seasonYearForNumber(game?.seasonNumber || 1))} (${info.last}).`
    : 'Todavía no hiciste una carga manual en esta partida.';
  return `<div class="card ranking-submit-card">
    <div class="row"><div><p class="label">Publicar carrera</p><h3>Carrera del mánager</h3></div><span class="pill">${game ? `Temp. ${game.seasonNumber || 1}` : 'Sin partida'}</span></div>
    <p class="muted">Podés subir manualmente la carrera completa del mánager cada ${Number(info.cooldown || RANKING_UPLOAD_COOLDOWN_DAYS || 50)} días de juego. Con la sesión iniciada, se publica automáticamente después del primer partido oficial, se refresca cada ${rankingAutomaticCareerConfig().gameIntervalDays} días de juego o tras una nueva sesión activa, y mantiene controles adicionales en los días ${rankingScheduledCareerDays().join(', ')}. También se actualiza al finalizar la temporada o ante un despido, sin duplicar carreras.</p>
    <div class="ranking-manual-actions">
      <button id="submitRankingManual" class="primary" type="button" ${canUpload ? '' : 'disabled'}>${escapeHtml(buttonLabel)}</button>
      <span id="rankingManualStatus" class="small muted">${privateToolsBlocked ? 'Esta partida fue modificada con herramientas de revisión.' : !loginOk ? 'Tenés que iniciar sesión para subir récords.' : endpoint ? escapeHtml(manualStatus) : 'Ranking online no disponible por el momento.'}</span>
    </div>
    ${rankingAutomaticStatusMarkup()}
    ${rankingSeasonPreviewMarkup(payload)}
  </div>`;
}
function renderRankingOnline(){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const managerName = rankingCleanManagerName();
  const manualEventType = rankingManualEventType();
  const manualDay = Number(seasonDayFromDate(rankingCurrentGameDate(), game?.seasonYear || seasonYearForNumber(game?.seasonNumber || 1)) || 0);
  const payload = buildRankingPayload(managerName, { eventType:manualEventType, eventLabel:`Carrera actualizada manualmente · día ${manualDay || '—'}` });
  view.innerHTML = `<div class="section-title"><h2>${escapeHtml(RANKING_NAME)}</h2><p class="tagline">Compará tu carrera con otros managers de la comunidad.</p></div>
    ${rankingLoginPanelMarkup(endpoint, { surface:'ranking' })}
    ${rankingSubmitPanelMarkup(payload, endpoint)}
    <div class="card ranking-list-card">
      <div class="row"><div><p class="label">Comunidad</p><h3>Ranking de carreras</h3></div><button id="refreshRanking" class="ghost" type="button">Actualizar ranking</button></div>
      <div id="rankingStatus" class="small muted">${endpoint ? (rankingRowsCache.length ? 'Ranking actualizado.' : 'Buscando carreras publicadas...') : 'Ranking online no disponible por el momento.'}</div>
      <div id="rankingTableBox">${rankingRowsTable(rankingRowsCache)}</div>
    </div>`;
  $('refreshRanking')?.addEventListener('click', loadRankingOnline);
  $('submitRankingManual')?.addEventListener('click', submitCurrentSeasonToRanking);
  rankingBindAuthPanels(view);
  rankingInstallSortDelegation();
  if(endpoint && !rankingRowsCache.length && !rankingLoading){
    setTimeout(() => loadRankingOnline(true), 0);
  }
}
function validateRankingSubmit(payload, managerName, endpoint, options={}){
  if(!game) return 'No hay partida activa.';
  if(game?.privateReviewTools?.rankingBlocked) return 'Esta partida fue modificada con herramientas de revisión y no puede publicar récords.';
  if(!endpoint) return 'Ranking online no disponible por el momento.';
  if(RANKING_REQUIRES_LOGIN && !rankingStoredAuthToken()) return 'Tenés que iniciar sesión para subir récords.';
  if(!managerName) return 'Ingresá un nombre de manager.';
  if(String(payload?.recordScope || '') !== 'career' && !payload?.position) return 'No se pudo calcular la posición actual.';
  if(String(payload?.recordScope || '') === 'career' && !Number(payload?.careerMatches || 0)) return 'La carrera todavía no tiene partidos oficiales para subir.';
  if(rankingScoreNumber(payload) <= 0) return 'No se pudo calcular un puntaje válido para la carrera.';
  const previous = game.rankingUploads?.[payload.submissionKey];
  if(previous?.status === 'pending' && !options.forceRetry){
    const attemptedAt = Date.parse(previous.attemptedAt || 0);
    if(Number.isFinite(attemptedAt) && Date.now() - attemptedAt < 15000) return 'Este evento ya está pendiente de envío.';
  }
  if(options?.automatic){
    if(previous?.status === 'success' && !options.forceRetry) return 'Este evento ya fue enviado al ranking.';
    return '';
  }
  const info = rankingUploadCooldownInfo();
  if(!info.canUpload) return rankingCooldownText(info);
  return '';
}
function submitCurrentSeasonToRanking(){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const managerName = rankingCleanManagerName();
  const manualDay = Number(seasonDayFromDate(rankingCurrentGameDate(), game?.seasonYear || seasonYearForNumber(game?.seasonNumber || 1)) || 0);
  const payload = buildRankingPayload(managerName, { eventType:rankingManualEventType(), eventLabel:`Carrera actualizada manualmente · día ${manualDay || '—'}` });
  const error = validateRankingSubmit(payload, managerName, endpoint, { manual:true });
  if(error){ showNotice(error); return false; }
  const status = $('rankingManualStatus');
  const button = $('submitRankingManual');
  if(status) status.textContent = 'Enviando carrera del mánager...';
  if(button) button.disabled = true;
  rankingRecordUploadState(payload, 'pending', { attemptedAt:new Date().toISOString() });
  saveLocal(true);
  submitRankingToCloudflare(endpoint, payload, {
    onSuccess: () => {
      rankingRecordUploadState(payload, 'success', { submittedAt:new Date().toISOString() });
      game.rankingLastManualUploadGameDate = payload.gameDate || rankingCurrentGameDate();
      game.rankingLastUploadGameDate = payload.gameDate || rankingCurrentGameDate();
      rankingRowsCache = dedupeRankingRows([normalizeRankingRow(payload)].concat(rankingRowsCache));
      saveLocal(true);
      showNotice('Carrera del mánager enviada al ranking online.');
      if(activeTab === 'ranking') renderRankingOnline();
      loadRankingOnline(true);
    },
    onError: (message) => {
      rankingRecordUploadState(payload, 'error', { error:message || 'Error al conectar con el ranking online.' });
      saveLocal(true);
      if(status) status.textContent = message || 'No se pudo enviar la carga manual.';
      if(button) button.disabled = false;
      showNotice(message || 'No se pudo enviar la carga manual.');
    }
  });
  return true;
}
function rankingRecordUploadState(payload, status, extra={}){
  if(!game || !payload?.submissionKey) return;
  game.rankingUploads = game.rankingUploads && typeof game.rankingUploads === 'object' && !Array.isArray(game.rankingUploads) ? game.rankingUploads : {};
  const previous = game.rankingUploads[payload.submissionKey] || {};
  const previousSuccessfulPayload = previous.lastSuccessfulPayload || (previous.status === 'success' ? previous.payload : null);
  const previousSuccessfulAt = previous.lastSuccessfulAt || (previous.status === 'success' ? previous.submittedAt : '');
  game.rankingUploads[payload.submissionKey] = {
    ...previous,
    status,
    eventType:payload.eventType || previous.eventType || 'season_snapshot',
    eventLabel:payload.eventLabel || previous.eventLabel || rankingEventLabel(payload.eventType),
    managerName:payload.managerName || previous.managerName || 'Manager',
    club:payload.club || previous.club || '',
    season:Number(payload.season || previous.season || 1),
    managerScore:Number(payload.managerScore || previous.managerScore || 0),
    gameDate:payload.gameDate || previous.gameDate || '',
    attemptedAt:extra.attemptedAt || new Date().toISOString(),
    submittedAt: status === 'success' ? (extra.submittedAt || payload.submittedAt || new Date().toISOString()) : (previous.submittedAt || ''),
    lastSuccessfulAt:status === 'success' ? (extra.submittedAt || payload.submittedAt || new Date().toISOString()) : previousSuccessfulAt,
    lastSuccessfulPayload:status === 'success' ? { ...payload } : (previousSuccessfulPayload ? { ...previousSuccessfulPayload } : null),
    error:['error','retry_wait'].includes(status) ? String(extra.error || '') : '',
    payload:{ ...payload }
  };
}
function rankingPayloadMatchesLastSuccess(payload){
  const entry = game?.rankingUploads?.[payload?.submissionKey];
  const successful = entry?.lastSuccessfulPayload || (entry?.status === 'success' ? entry?.payload : null);
  return Boolean(successful && rankingCareerUploadFingerprint(successful) === rankingCareerUploadFingerprint(payload));
}
function rankingApplyAutomaticSubmissionOutcome(payload, status, message=''){
  if(!payload || String(payload.recordScope || 'career') !== 'career') return;
  const eventType = String(payload.eventType || 'career_activity');
  const info = {
    reason:eventType,
    payload,
    fingerprint:rankingCareerUploadFingerprint(payload),
    season:Math.max(1, Math.round(Number(payload.season || game?.seasonNumber || 1))),
    currentDay:Math.max(1, Math.round(Number(payload.seasonDay || seasonDayFromDate(payload.gameDate || rankingCurrentGameDate(), game?.seasonYear || seasonYearForNumber(payload.season || game?.seasonNumber || 1)) || 1)))
  };
  const now = new Date().toISOString();
  if(status === 'success'){
    rankingRecordCareerActivityAttempt(info, 'success', {
      submittedAt:now,
      lastAttemptAt:now,
      lastAttemptGameDate:payload.gameDate || rankingCurrentGameDate(),
      error:''
    });
  }else if(status === 'retry_wait'){
    rankingRecordCareerActivityAttempt(info, 'retry_wait', {
      lastAttemptAt:now,
      lastAttemptGameDate:payload.gameDate || rankingCurrentGameDate(),
      error:String(message || 'Reintento automático programado.')
    });
  }
  const match = eventType.match(/^career_snapshot_d(\d+)$/);
  if(match){
    const day = Math.max(1, Math.round(Number(match[1] || 1)));
    rankingRecordScheduledCareerState(info.season, day, status === 'success' ? 'success' : 'retry_wait', {
      lastAttemptGameDate:payload.gameDate || rankingCurrentGameDate(),
      attemptedAt:now,
      submittedAt:status === 'success' ? now : '',
      error:status === 'success' ? '' : String(message || 'Reintento automático programado.'),
      notificationSent:false
    });
  }
}
function submitRankingAutomatically(eventType='season_end', options={}){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const managerName = rankingCleanManagerName();
  let payload = options?.payload && typeof options.payload === 'object' ? { ...options.payload } : buildRankingPayload(managerName, { ...options, eventType });
  if(payload){
    payload.managerName = rankingCleanManagerName(payload.managerName || managerName);
    payload.recordScope = payload.recordScope || 'career';
    payload.eventType = eventType || payload.eventType || 'career_snapshot';
    payload.eventLabel = options.eventLabel || payload.eventLabel || rankingEventLabel(payload.eventType);
    payload.submittedAt = new Date().toISOString();
    payload.managerScore = rankingScoreNumber(payload) || calculateCareerManagerScore(payload);
    Object.assign(payload, rankingScoreAliases(payload));
    payload.submissionKey = rankingSubmissionKey(payload, payload.eventType);
  }
  const error = validateRankingSubmit(payload, managerName, endpoint, { automatic:true, forceRetry:Boolean(options.forceRetry) });
  if(error){
    options.onSkipped?.(error, payload);
    if(!/ya fue enviado|pendiente/.test(error) && options.notifyErrors) showNotice(error);
    return false;
  }
  if(rankingAutomaticSubmissionInFlight){
    rankingQueueAutomaticRetry(payload.eventType, payload, payload.eventLabel, 'Otra actualización de carrera está en curso.', rankingAutomaticServerCooldownMs());
    rankingRecordUploadState(payload, 'retry_wait', { attemptedAt:new Date().toISOString(), error:'Se enviará automáticamente después de completar la actualización en curso.' });
    if(typeof saveLocal === 'function') saveLocal(true);
    return true;
  }
  rankingAutomaticSubmissionInFlight = true;
  rankingRecordUploadState(payload, 'pending', { attemptedAt:new Date().toISOString() });
  saveLocal(true);
  submitRankingToCloudflare(endpoint, payload, {
    onSuccess: (data) => {
      rankingAutomaticSubmissionInFlight = false;
      rankingRecordUploadState(payload, 'success', { submittedAt:new Date().toISOString() });
      rankingApplyAutomaticSubmissionOutcome(payload, 'success');
      game.rankingLastAutomaticUploadGameDate = payload.gameDate || rankingCurrentGameDate();
      game.rankingLastUploadGameDate = payload.gameDate || rankingCurrentGameDate();
      rankingRowsCache = dedupeRankingRows([normalizeRankingRow(payload)].concat(rankingRowsCache));
      const retry = rankingAutomaticRetryState(false);
      if(retry?.payload){
        const samePayload = rankingCareerUploadFingerprint(retry.payload) === rankingCareerUploadFingerprint(payload);
        if(samePayload){
          rankingClearAutomaticRetry();
        }else{
          retry.status = 'waiting';
          retry.dueAt = new Date(Date.now() + rankingAutomaticServerCooldownMs()).toISOString();
          retry.reason = 'Esperando el intervalo mínimo del servidor antes de publicar la actualización más reciente.';
          scheduleRankingAutomaticRetryFromState({ source:'after_success' });
        }
      }
      if(options.notifySuccess !== false && typeof pushGameMessage === 'function'){
        pushGameMessage({ type:'sistema', priority:'normal', title:'Ranking actualizado', body:`${payload.eventLabel} enviado automáticamente al ranking online.`, id:`ranking-auto-ok-${payload.submissionKey}-${payload.eventType}` });
      }
      saveLocal(true);
      options.onSuccess?.(payload, data);
      if(activeTab === 'ranking') renderRankingOnline();
    },
    onError: (message) => {
      rankingAutomaticSubmissionInFlight = false;
      const cleanMessage = String(message || 'Error al conectar con el ranking online.');
      const cooldownDelay = rankingRetryDelayFromMessage(cleanMessage);
      if(cooldownDelay && rankingPayloadMatchesLastSuccess(payload)){
        rankingRecordUploadState(payload, 'success', { submittedAt:game?.rankingUploads?.[payload.submissionKey]?.lastSuccessfulAt || new Date().toISOString() });
        rankingApplyAutomaticSubmissionOutcome(payload, 'success');
        const retry = rankingAutomaticRetryState(false);
        if(retry?.payload && rankingCareerUploadFingerprint(retry.payload) === rankingCareerUploadFingerprint(payload)) rankingClearAutomaticRetry();
        saveLocal(true);
        options.onSuccess?.(payload, { deduplicated:true, message:cleanMessage });
        if(activeTab === 'ranking') renderRankingOnline();
        return;
      }
      const retryDelay = cooldownDelay || rankingAutomaticCareerConfig().retryMinutes * 60000;
      rankingRecordUploadState(payload, 'retry_wait', { error:cleanMessage });
      rankingApplyAutomaticSubmissionOutcome(payload, 'retry_wait', cleanMessage);
      rankingQueueAutomaticRetry(payload.eventType, payload, payload.eventLabel, cleanMessage, retryDelay);
      if(options.notifyErrors !== false && !cooldownDelay && typeof pushGameMessage === 'function'){
        pushGameMessage({ type:'sistema', priority:'normal', title:'Ranking pendiente', body:`No se pudo completar ${payload.eventLabel}. El juego volverá a intentarlo automáticamente.`, id:`ranking-auto-retry-${payload.submissionKey}-${payload.eventType}` });
      }
      saveLocal(true);
      options.onError?.(cleanMessage, payload);
      if(activeTab === 'ranking') renderRankingOnline();
    }
  });
  return true;
}
async function submitRankingToCloudflare(endpoint, payload, handlers={}){
  const paths = rankingConfiguredPaths('submit');
  const apiBody = rankingJsonSafeObject(rankingPayloadToApiBody(payload));
  const fullPayload = rankingJsonSafeObject({ ...payload, ...apiBody });
  let lastMessage = '';
  const attemptedRoutes = new Set();
  for(let i = 0; i < paths.length; i++){
    const path = paths[i];
    attemptedRoutes.add(rankingRouteLabel(path));
    const requestBodies = rankingRequestVariantsForPath(path, apiBody, fullPayload);
    for(let j = 0; j < requestBodies.length; j++){
      const req = requestBodies[j];
      try{
        const response = await fetch(rankingApiUrl(endpoint, path), {
          method:'POST',
          headers:req.headers,
          body:req.body
        });
        const data = await response.json().catch(() => ({}));
        if(!response.ok || data.ok === false){
          const message = rankingResponseErrorMessage(data, response);
          lastMessage = message;
          if(rankingIsRouteMissing(message, response) && i < paths.length - 1) break;
          if(j < requestBodies.length - 1) continue;
          throw new Error(message);
        }
        handlers.onSuccess?.(data);
        return;
      }catch(error){
        lastMessage = error?.message || lastMessage || 'Error al conectar con el ranking online.';
        if(rankingIsRouteMissing(lastMessage) && i < paths.length - 1) break;
        if(j < requestBodies.length - 1) continue;
        const tried = Array.from(attemptedRoutes).join(', ');
        const message = rankingIsRouteMissing(lastMessage) && tried ? `${lastMessage} Rutas probadas: ${tried}.` : lastMessage;
        handlers.onError?.(message);
        return;
      }
    }
  }
  const tried = Array.from(attemptedRoutes).join(', ');
  const message = lastMessage || 'No se encontró una ruta válida para subir el ranking.';
  handlers.onError?.(rankingIsRouteMissing(message) && tried ? `${message} Rutas probadas: ${tried}.` : message);
}
async function loadRankingOnline(silent=false){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const status = $('rankingStatus');
  if(!endpoint){ if(status) status.textContent = 'Ranking online no disponible por el momento.'; return; }
  if(rankingLoading) return;
  rankingLoading = true;
  if(status) status.textContent = 'Actualizando ranking...';
  let lastMessage = '';
  try{
    const paths = rankingConfiguredPaths('read');
    for(let i = 0; i < paths.length; i++){
      const path = paths[i];
      const response = await fetch(rankingApiUrl(endpoint, path, `?limit=${encodeURIComponent(RANKING_PAGE_SIZE)}`), {
        method:'GET',
        headers:rankingRequestHeaders(false)
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || data.ok === false){
        const message = rankingResponseErrorMessage(data, response);
        lastMessage = message;
        if(rankingIsRouteMissing(message, response) && i < paths.length - 1) continue;
        throw new Error(message);
      }
      const rows = Array.isArray(data.ranking) ? data.ranking
        : Array.isArray(data.rows) ? data.rows
        : Array.isArray(data.records) ? data.records
        : Array.isArray(data.data) ? data.data
        : Array.isArray(data.items) ? data.items
        : [];
      rankingRowsCache = dedupeRankingRows(rows.map(normalizeRankingRow).filter(row => row.managerName || row.club || row.saveCode));
      const box = $('rankingTableBox');
      if(box) box.innerHTML = rankingRowsTable(rankingRowsCache);
      if(status) status.textContent = rankingRowsCache.length ? 'Ranking actualizado.' : 'Todavía no hay carreras publicadas.';
      return;
    }
    throw new Error(lastMessage || 'No se encontró una ruta válida para leer el ranking.');
  }catch(error){
    if(status) status.textContent = 'No se pudo actualizar el ranking.';
    if(!silent) showNotice(error?.message || 'No se pudo cargar el ranking online.');
  }finally{
    rankingLoading = false;
  }
}

window.addEventListener('fm:auth-changed', () => {
  if(!rankingStoredAuthToken() || !rankingRuntimeConfirmedUsername()) return;
  scheduleRankingAutomaticRetryFromState({ source:'auth_changed' });
  scheduleAutomaticCareerRankingSync({ source:'auth_changed', forceRetry:true, delayMs:50 });
});
window.addEventListener('online', () => {
  if(!rankingStoredAuthToken()) return;
  scheduleRankingAutomaticRetryFromState({ source:'browser_online' });
  scheduleAutomaticCareerRankingSync({ source:'browser_online', forceRetry:true, delayMs:750 });
});
document.addEventListener('visibilitychange', () => {
  if(document.visibilityState !== 'visible' || !rankingStoredAuthToken()) return;
  scheduleRankingAutomaticRetryFromState({ source:'visibility_resume' });
  scheduleAutomaticCareerRankingSync({ source:'visibility_resume', delayMs:1200 });
});
