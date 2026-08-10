/* Desafíos online: snapshots del equipo y resultados autoritativos del Worker. */

let challengeViewTab = 'available';
let challengeRowsCache = { available:[], mine:[], history:[], ranking:[] };
let challengeLoadedTabs = { available:false, mine:false, history:false, ranking:false };
let challengeLoading = false;
let challengeDetail = null;
let challengePollTimer = null;
let challengeCooldownTimer = null;
let challengeActionBusy = false;
let challengeAvailableCategory = '';
let challengeRankingCategory = '';
let challengeRankingLeaderboardsCache = {};
let challengeRewardStatus = { loaded:false, loading:false, compatible:true, error:'', serverTime:'', currentCycle:null, claims:[], champions:[], currentStandings:{}, ownerKey:'' };
let challengeHomeOnlineState = {
  categoryCode:'L', categoryName:'Libre', salaryTotal:0, complete:false,
  available:false, availabilityLoaded:false, availabilityLoading:false,
  rankingLoaded:false, rankingLoading:false, positionLabel:'-', played:0, points:0,
  qualified:false, error:'', updatedAt:0
};
let challengeHomeOnlineRefreshTimer = null;
let challengeHomeHistoryLoadedAt = 0;
let challengeHomeAvailabilityLoadedAt = 0;


function challengeCurrentTeamCategorySummary(){
  const starters = (game?.tactic?.starters || []).slice(0,11).map(Number).filter(Boolean);
  const starterSet = new Set(starters);
  const bench = (game?.tactic?.bench || []).map(Number).filter(Boolean).filter(id => !starterSet.has(id)).slice(0,10);
  const players = [...starters, ...bench].map(playerById).filter(Boolean);
  const salaryTotal = players.reduce((sum, player) => sum + Math.max(0, Math.round(Number(player?.salary || 0))), 0);
  const category = challengeNaturalCategoryForSalary(salaryTotal);
  return { categoryCode:category.code, categoryName:category.name, salaryTotal, complete:starters.map(playerById).filter(Boolean).length === 11 };
}
function challengeStoredUserIdentity(){
  let userId = '';
  let username = '';
  try{
    userId = String(localStorage.getItem('fmRankingAuthUserId') || '').trim();
    username = String(localStorage.getItem('fmRankingAuthUser') || localStorage.getItem('fmRankingUsername') || '').trim();
  }catch(_){ /* sin almacenamiento */ }
  return { userId, username, key:userId ? `id:${userId}` : (username ? `user:${username.toLocaleLowerCase('es')}` : '') };
}
function challengeFindOwnRankingRow(rows=[]){
  const identity = challengeStoredUserIdentity();
  if(!identity.key) return null;
  return (rows || []).find(row => String(row?.identityKey || '') === identity.key)
    || (identity.username ? (rows || []).find(row => String(row?.username || '').trim().toLocaleLowerCase('es') === identity.username.toLocaleLowerCase('es')) : null)
    || null;
}
function challengeServerCurrentStanding(categoryCode){
  const code = challengeCategoryByCode(categoryCode).code;
  const rows = challengeRewardStatus.currentStandings || {};
  const row = rows[code] || rows[String(code).toLowerCase()] || null;
  return row && typeof row === 'object' ? row : null;
}
function challengeHomeOnlineRankingMarkup(){
  const summary = challengeCurrentTeamCategorySummary();
  const sameCategory = challengeHomeOnlineState.categoryCode === summary.categoryCode;
  const played = sameCategory ? Number(challengeHomeOnlineState.played || 0) : 0;
  const position = sameCategory && challengeHomeOnlineState.rankingLoaded
    ? (played > 0 ? String(challengeHomeOnlineState.positionLabel || 'Provisional') : '-')
    : '-';
  const status = !challengeToken()
    ? 'Iniciá sesión para ver tu posición.'
    : !summary.complete
      ? 'Completá los 11 titulares para competir.'
      : sameCategory && challengeHomeOnlineState.rankingLoading
        ? 'Actualizando clasificación...'
        : played > 0
          ? `${played} partido${played === 1 ? '' : 's'} · ${formatPlainNumber(Number(challengeHomeOnlineState.points || 0))} puntos`
          : 'Todavía no disputaste partidos en esta categoría.';
  return `<button type="button" class="card home-online-ranking-card" data-home-online-ranking>
    <div><p class="label">Tu ranking online</p><strong class="home-online-position">${escapeHtml(position)}</strong><small>${escapeHtml(status)}</small></div>
    <div class="home-online-category">${challengeCategoryBadgeMarkup(summary.categoryCode,{large:true})}<span>${escapeHtml(challengeCategoryRangeLabel(challengeCategoryByCode(summary.categoryCode)))}</span></div>
  </button>`;
}
function challengeUpdateHomeOnlineRankingBlock(){
  const box = $('homeOnlineRankingBox');
  if(!box) return;
  box.innerHTML = challengeHomeOnlineRankingMarkup();
  box.querySelector('[data-home-online-ranking]')?.addEventListener('click', () => {
    const summary = challengeCurrentTeamCategorySummary();
    challengeRankingCategory = summary.categoryCode;
    challengeViewTab = 'ranking';
    challengeDetail = null;
    activeTab = 'challenges';
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('challenges');
    renderAll();
    setTimeout(() => loadChallenges('ranking', { force:true }), 0);
  });
}
function challengeUpdateTopAvailabilityButton(){
  const button = $('btnOnlineChallengeAvailable');
  if(!button) return;
  const summary = challengeCurrentTeamCategorySummary();
  const visible = Boolean(game && !game.gameOver?.active && challengeToken() && summary.complete && challengeHomeOnlineState.availabilityLoaded && challengeHomeOnlineState.categoryCode === summary.categoryCode && challengeHomeOnlineState.available);
  button.classList.toggle('hidden', !visible);
  button.disabled = !visible;
  button.dataset.challengeCategory = visible ? summary.categoryCode : '';
  button.title = visible ? `Hay un rival disponible en ${summary.categoryName}.` : '';
}
async function challengeRefreshHomeAvailability(options={}){
  const summary = challengeCurrentTeamCategorySummary();
  const categoryChanged = challengeHomeOnlineState.categoryCode !== summary.categoryCode;
  challengeHomeOnlineState = { ...challengeHomeOnlineState, ...summary };
  if(categoryChanged){
    challengeHomeOnlineState.available = false;
    challengeHomeOnlineState.availabilityLoaded = false;
  }
  if(!game || game.gameOver?.active || !challengeToken() || !summary.complete){
    challengeHomeOnlineState.available = false;
    challengeHomeOnlineState.availabilityLoaded = true;
    challengeUpdateTopAvailabilityButton();
    return challengeHomeOnlineState;
  }
  const fresh = challengeHomeOnlineState.availabilityLoaded && challengeHomeOnlineState.categoryCode === summary.categoryCode && Date.now() - challengeHomeAvailabilityLoadedAt < challengeConfig().pollMs;
  if(fresh && !options.force){ challengeUpdateTopAvailabilityButton(); return challengeHomeOnlineState; }
  if(challengeHomeOnlineState.availabilityLoading) return challengeHomeOnlineState;
  challengeHomeOnlineState.availabilityLoading = true;
  try{
    const data = await challengeRequest('challenges/open', { query:`?limit=${challengeConfig().pageSize}` });
    const rows = challengeRowsFromResponse(data);
    challengeHomeOnlineState.available = rows.some(row => challengeRowCategoryCode(row) === summary.categoryCode);
    challengeHomeOnlineState.availabilityLoaded = true;
    challengeHomeOnlineState.error = '';
    challengeHomeAvailabilityLoadedAt = Date.now();
  }catch(error){
    challengeHomeOnlineState.available = false;
    challengeHomeOnlineState.availabilityLoaded = true;
    challengeHomeOnlineState.error = String(error?.message || '');
  }finally{
    challengeHomeOnlineState.availabilityLoading = false;
    challengeUpdateTopAvailabilityButton();
  }
  return challengeHomeOnlineState;
}
async function challengeRefreshHomeRanking(options={}){
  const summary = challengeCurrentTeamCategorySummary();
  const categoryChanged = challengeHomeOnlineState.categoryCode !== summary.categoryCode;
  challengeHomeOnlineState = { ...challengeHomeOnlineState, ...summary };
  if(categoryChanged){
    challengeHomeOnlineState.rankingLoaded = false;
    challengeHomeOnlineState.positionLabel = '-';
    challengeHomeOnlineState.played = 0;
    challengeHomeOnlineState.points = 0;
  }
  const identity = challengeStoredUserIdentity();
  if(!game || !identity.key){
    challengeHomeOnlineState.rankingLoaded = true;
    challengeHomeOnlineState.rankingLoading = false;
    challengeHomeOnlineState.positionLabel = '-';
    challengeHomeOnlineState.played = 0;
    challengeHomeOnlineState.points = 0;
    challengeUpdateHomeOnlineRankingBlock();
    return challengeHomeOnlineState;
  }
  const fresh = challengeHomeOnlineState.rankingLoaded && challengeHomeOnlineState.categoryCode === summary.categoryCode && Date.now() - challengeHomeHistoryLoadedAt < Math.max(60000, challengeConfig().pollMs * 2);
  if(fresh && !options.force){ challengeUpdateHomeOnlineRankingBlock(); return challengeHomeOnlineState; }
  if(challengeHomeOnlineState.rankingLoading) return challengeHomeOnlineState;
  challengeHomeOnlineState.rankingLoading = true;
  challengeUpdateHomeOnlineRankingBlock();
  try{
    await challengeLoadRewardStatus({ force:options.force });
    let own = challengeServerCurrentStanding(summary.categoryCode);
    if(!own){
      const data = await challengeRequest('challenges/ranking', { query:`?categoryCode=${encodeURIComponent(summary.categoryCode)}` });
      const rows = Array.isArray(data?.ranking) ? data.ranking : [];
      own = challengeFindOwnRankingRow(rows);
    }
    challengeHomeOnlineState.rankingLoaded = true;
    challengeHomeOnlineState.played = Number(own?.played || 0);
    challengeHomeOnlineState.points = Number(own?.points || 0);
    challengeHomeOnlineState.qualified = Boolean(own?.qualified);
    const serverPosition = Number(own?.position || own?.rank || 0);
    challengeHomeOnlineState.positionLabel = own?.played ? (serverPosition > 0 ? `${serverPosition}°` : 'Provisional') : '-';
    challengeHomeOnlineState.error = '';
    challengeHomeHistoryLoadedAt = Date.now();
  }catch(error){
    challengeHomeOnlineState.rankingLoaded = true;
    challengeHomeOnlineState.positionLabel = '-';
    challengeHomeOnlineState.played = 0;
    challengeHomeOnlineState.points = 0;
    challengeHomeOnlineState.error = String(error?.message || '');
  }finally{
    challengeHomeOnlineState.rankingLoading = false;
    challengeUpdateHomeOnlineRankingBlock();
  }
  return challengeHomeOnlineState;
}
function challengeRefreshHomeOnlineSummary(options={}){
  challengeUpdateHomeOnlineRankingBlock();
  challengeRefreshHomeAvailability(options);
  challengeRefreshHomeRanking(options);
}
function challengeScheduleOnlineHeaderRefresh(){
  clearTimeout(challengeHomeOnlineRefreshTimer);
  challengeUpdateTopAvailabilityButton();
  challengeHomeOnlineRefreshTimer = setTimeout(() => challengeRefreshHomeAvailability(), 40);
}
async function challengeOpenMatchingAvailable(){
  const summary = challengeCurrentTeamCategorySummary();
  if(!challengeHomeOnlineState.available || challengeHomeOnlineState.categoryCode !== summary.categoryCode){
    await challengeRefreshHomeAvailability({ force:true });
  }
  if(!challengeHomeOnlineState.available || challengeHomeOnlineState.categoryCode !== summary.categoryCode){
    showNotice(`Ya no hay rivales disponibles en ${summary.categoryName}.`);
    return;
  }
  challengeAvailableCategory = summary.categoryCode;
  challengeViewTab = 'available';
  challengeDetail = null;
  activeTab = 'challenges';
  if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('challenges');
  renderAll();
  setTimeout(() => loadChallenges('available', { force:true }), 0);
}

function challengeConfig(){
  const cfg = window.GAME_CONFIG?.desafiosOnline || {};
  const categories = Array.isArray(cfg.categoriasSalariales) && cfg.categoriasSalariales.length
    ? cfg.categoriasSalariales
    : [
        { codigo:'A', nombre:'Ascenso', minimo:0, maximo:5000000 },
        { codigo:'N', nombre:'Nacional', minimo:5000001, maximo:10000000 },
        { codigo:'P', nombre:'Profesional', minimo:10000001, maximo:20000000 },
        { codigo:'C', nombre:'Continental', minimo:20000001, maximo:45000000 },
        { codigo:'E', nombre:'Élite', minimo:45000001, maximo:100000000 },
        { codigo:'L', nombre:'Libre', minimo:0, maximo:null, libre:true }
      ];
  return {
    active:cfg.activo !== false,
    endpoint:String(cfg.endpoint || rankingStoredEndpoint?.() || RANKING_APPS_SCRIPT_URL || '').trim(),
    simulatorVersion:String(cfg.versionSimulador || 'challenge-sim-v2-server'),
    pageSize:Math.max(5, Math.min(100, Math.round(Number(cfg.resultadosPorPagina || 40)))),
    pollMs:Math.max(10000, Math.round(Number(cfg.actualizacionMs || 30000))),
    freeActionsBeforeCooldown:Math.max(1, Math.min(100, Math.round(Number(cfg.accionesSinBloqueo || 10)))),
    actionCooldownMs:Math.max(60000, Math.round(Number(cfg.cooldownAccionMinutos || 10) * 60000)),
    categories,
    rankingMinimumMatches:Math.max(1, Math.round(Number(cfg.partidosMinimosRanking || 10))),
    rankingMinimumOpponents:Math.max(1, Math.round(Number(cfg.rivalesMinimosPremio || 5))),
    rankingHistoryPageSize:Math.max(20, Math.min(500, Math.round(Number(cfg.historialRankingPorPagina || 100)))),
    cycleDays:Math.max(1, Math.round(Number(cfg.cicloCompetenciaDias || 10))),
    cycleEpoch:String(cfg.cicloCompetenciaInicioUtc || '2026-07-19T00:00:00.000Z'),
    rewardTable:cfg.premiosCiclo && typeof cfg.premiosCiclo === 'object' ? cfg.premiosCiclo : { A:[3000,1500,750], N:[3000,1500,750], P:[3000,1500,750], C:[3000,1500,750], E:[3000,1500,750], L:[6000,2500,1000] },
    rewardStatusPath:String(cfg.rewardStatusPath || 'challenges/rewards/status'),
    rewardClaimPath:String(cfg.rewardClaimPath || 'challenges/rewards/claim')
  };
}
function challengeCycleDurationMs(){ return challengeConfig().cycleDays * 86400000; }
function challengeCycleEpochMs(){
  const parsed = new Date(challengeConfig().cycleEpoch).getTime();
  return Number.isFinite(parsed) ? parsed : Date.UTC(2026,6,19,0,0,0,0);
}
function challengeCycleAt(value=Date.now()){
  const moment = value instanceof Date ? value.getTime() : (typeof value === 'number' ? value : new Date(String(value || '')).getTime());
  const now = Number.isFinite(moment) ? moment : Date.now();
  const duration = challengeCycleDurationMs();
  const epoch = challengeCycleEpochMs();
  const index = Math.max(0, Math.floor((now - epoch) / duration));
  const startMs = epoch + index * duration;
  const endMs = startMs + duration;
  return { id:`FM10D-${String(index + 1).padStart(4,'0')}`, index:index + 1, startMs, endMs, startAt:new Date(startMs).toISOString(), endAt:new Date(endMs).toISOString() };
}
function challengeCycleContains(cycle, value){
  const ms = new Date(String(value || '')).getTime();
  return Boolean(cycle && Number.isFinite(ms) && ms >= Number(cycle.startMs || new Date(cycle.startAt).getTime()) && ms < Number(cycle.endMs || new Date(cycle.endAt).getTime()));
}
function challengeCycleRangeLabel(cycle){
  if(!cycle) return 'Ciclo no disponible';
  const start = new Date(cycle.startAt || cycle.startMs);
  const end = new Date(cycle.endAt || cycle.endMs);
  const fmt = date => date.toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric', timeZone:'UTC' });
  return `${fmt(start)} al ${fmt(new Date(end.getTime() - 1))}`;
}
function challengeCycleRemainingLabel(cycle, serverTime=''){
  const reference = new Date(serverTime || Date.now()).getTime();
  const end = Number(cycle?.endMs || new Date(cycle?.endAt || 0).getTime());
  const remaining = Math.max(0, end - (Number.isFinite(reference) ? reference : Date.now()));
  const days = Math.floor(remaining / 86400000);
  const hours = Math.floor((remaining % 86400000) / 3600000);
  const minutes = Math.floor((remaining % 3600000) / 60000);
  if(days > 0) return `${days} d ${hours} h`;
  if(hours > 0) return `${hours} h ${minutes} min`;
  return `${minutes} min`;
}
function challengeRewardValues(categoryCode){
  const code = challengeCategoryByCode(categoryCode).code;
  const row = challengeConfig().rewardTable?.[code];
  const fallback = code === 'L' ? [6000,2500,1000] : [3000,1500,750];
  return (Array.isArray(row) ? row : fallback).slice(0,3).map(value => Math.max(0, Math.round(Number(value || 0))));
}
function challengeRewardReceiptStorageKey(){
  let owner = 'local';
  try{ owner = String(localStorage.getItem('fmRankingAuthUserId') || localStorage.getItem('fmRankingAuthUser') || 'local').trim() || 'local'; }catch(_){ owner = 'local'; }
  return `fmOnlineRewardReceipts:${owner}`;
}
function challengeRewardReceipts(){
  try{
    const parsed = JSON.parse(localStorage.getItem(challengeRewardReceiptStorageKey()) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }catch(_){ return {}; }
}
function challengeStoreRewardReceipt(id, payload={}){
  const key = String(id || '').trim();
  if(!key) return false;
  const rows = challengeRewardReceipts();
  rows[key] = { ...payload, appliedAt:rows[key]?.appliedAt || new Date().toISOString() };
  try{ localStorage.setItem(challengeRewardReceiptStorageKey(), JSON.stringify(rows)); return true; }catch(_){ return false; }
}
function challengeRewardClaimFor(categoryCode){
  const code = challengeCategoryByCode(categoryCode).code;
  const claims = Array.isArray(challengeRewardStatus.claims) ? challengeRewardStatus.claims : [];
  return claims.find(item => String(item?.categoryCode || item?.category || '').toUpperCase() === code) || null;
}

function challengeOnlineMedalSummary(){
  const authenticated = Boolean(challengeToken());
  const loading = Boolean(challengeRewardStatus?.loading);
  const loaded = Boolean(challengeRewardStatus?.loaded);
  const error = String(challengeRewardStatus?.error || '').trim();
  const claims = Array.isArray(challengeRewardStatus?.claims) ? challengeRewardStatus.claims : [];
  const championMap = new Map();
  claims.forEach(item => {
    if(Number(item?.position || 0) !== 1) return;
    const cycleId = String(item?.cycleId || item?.cycle_id || '').trim();
    const categoryCode = String(item?.categoryCode || item?.category_code || item?.category || '').trim().toUpperCase();
    if(!cycleId || !categoryCode) return;
    championMap.set(`${cycleId}:${categoryCode}`, { cycleId, categoryCode });
  });
  const championRows = [...championMap.values()];
  const titles = championRows.length;
  const gold = Math.floor(titles / 9);
  const afterGold = titles % 9;
  const silver = Math.floor(afterGold / 3);
  const bronze = afterGold % 3;
  const categories = championRows.reduce((acc, item) => {
    acc[item.categoryCode] = Number(acc[item.categoryCode] || 0) + 1;
    return acc;
  }, {});
  return { authenticated, loading, loaded, error, titles, gold, silver, bronze, categories };
}
function challengeOnlineMedalShelfMarkup(){
  const summary = challengeOnlineMedalSummary();
  const ready = summary.authenticated && summary.loaded && !summary.loading && !summary.error;
  const displayValue = value => summary.authenticated ? (summary.loading ? '…' : (ready ? String(value) : '—')) : '—';
  const categoryRows = Object.entries(summary.categories)
    .sort((a,b) => String(a[0]).localeCompare(String(b[0])))
    .map(([code,count]) => `<span class="pill">${escapeHtml(code)} × ${formatPlainNumber(count)}</span>`)
    .join('');
  let statusText = 'Iniciá sesión online para consultar las medallas de esta cuenta.';
  if(summary.authenticated && summary.loading) statusText = 'Consultando campeonatos online…';
  else if(summary.authenticated && summary.error) statusText = 'No se pudieron consultar las medallas online.';
  else if(ready && !summary.titles) statusText = 'Todavía no hay campeonatos online registrados para esta cuenta.';
  else if(ready) statusText = `${formatPlainNumber(summary.titles)} ${summary.titles === 1 ? 'campeonato online acumulado' : 'campeonatos online acumulados'}.`;
  return `<section class="card online-medal-shelf ${ready ? 'is-ready' : 'is-pending'}">
    <div class="online-medal-shelf-head">
      <div><p class="eyebrow">Palmarés online</p><h3>Medallas de campeón</h3><p class="muted small">Cada título vale 1 bronce. Tres bronces se convierten en 1 plata y tres platas en 1 oro.</p></div>
      <div class="online-medal-title-total"><strong>${displayValue(summary.titles)}</strong><span>Títulos online</span></div>
    </div>
    <div class="online-medal-grid">
      <div class="online-medal-item medal-gold ${summary.gold ? 'is-earned' : ''}"><span class="online-medal-icon" aria-hidden="true"></span><div><strong>${displayValue(summary.gold)}</strong><span>Oro</span><small>9 bronces</small></div></div>
      <div class="online-medal-item medal-silver ${summary.silver ? 'is-earned' : ''}"><span class="online-medal-icon" aria-hidden="true"></span><div><strong>${displayValue(summary.silver)}</strong><span>Plata</span><small>3 bronces</small></div></div>
      <div class="online-medal-item medal-bronze ${summary.bronze ? 'is-earned' : ''}"><span class="online-medal-icon" aria-hidden="true"></span><div><strong>${displayValue(summary.bronze)}</strong><span>Bronce</span><small>1 campeonato</small></div></div>
    </div>
    <div class="online-medal-shelf-footer"><span class="small muted">${escapeHtml(statusText)}</span>${categoryRows ? `<div class="online-medal-categories"><span class="small muted">Categorías conquistadas</span>${categoryRows}</div>` : ''}</div>
  </section>`;
}
function challengeEnsureOnlineMedalsLoaded(){
  const ownerKey = String(challengeStoredUserIdentity()?.key || '');
  if(!challengeToken() || challengeRewardStatus.loading) return Promise.resolve(challengeRewardStatus);
  if(challengeRewardStatus.loaded && String(challengeRewardStatus.ownerKey || '') === ownerKey) return Promise.resolve(challengeRewardStatus);
  return challengeLoadRewardStatus({ force:true }).then(status => {
    if(typeof activeTab !== 'undefined' && activeTab === 'mystats' && String(managerStatsViewMode || '') === 'achievements' && typeof renderManagerStats === 'function'){
      renderManagerStats();
    }
    return status;
  });
}
function challengeNormalizeServerCycle(raw){
  if(!raw || typeof raw !== 'object') return null;
  const startMs = new Date(raw.startAt || raw.start_at || raw.start || 0).getTime();
  const endMs = new Date(raw.endAt || raw.end_at || raw.end || 0).getTime();
  if(!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return null;
  return { id:String(raw.id || raw.cycleId || raw.cycle_id || ''), index:Number(raw.index || 0), startMs, endMs, startAt:new Date(startMs).toISOString(), endAt:new Date(endMs).toISOString() };
}
async function challengeLoadRewardStatus(options={}){
  const ownerKey = String(challengeStoredUserIdentity()?.key || '');
  if(challengeRewardStatus.loading) return challengeRewardStatus;
  if(challengeRewardStatus.loaded && !options.force && String(challengeRewardStatus.ownerKey || '') === ownerKey) return challengeRewardStatus;
  if(!challengeToken()){
    challengeRewardStatus = { loaded:true, loading:false, compatible:true, error:'', serverTime:'', currentCycle:challengeCycleAt(), claims:[], champions:[], currentStandings:{}, ownerKey:'' };
    return challengeRewardStatus;
  }
  challengeRewardStatus.loading = true;
  try{
    const data = await challengeRequest(challengeConfig().rewardStatusPath);
    const cycle = challengeNormalizeServerCycle(data?.currentCycle || data?.current_cycle) || challengeCycleAt(data?.serverTime || Date.now());
    challengeRewardStatus = {
      loaded:true, loading:false, compatible:true, error:'', serverTime:String(data?.serverTime || data?.server_time || ''),
      currentCycle:cycle,
      claims:Array.isArray(data?.claims) ? data.claims : [],
      champions:Array.isArray(data?.champions) ? data.champions : [],
      currentStandings:data?.currentStandings && typeof data.currentStandings === 'object' ? data.currentStandings : (data?.current_standings && typeof data.current_standings === 'object' ? data.current_standings : {}),
      ownerKey
    };
  }catch(error){
    const message = String(error?.message || 'No se pudo consultar los premios.');
    challengeRewardStatus = { loaded:true, loading:false, compatible:!/(404|ruta no encontrada|not found)/i.test(message), error:message, serverTime:'', currentCycle:challengeCycleAt(), claims:[], champions:[], currentStandings:{}, ownerKey };
  }
  return challengeRewardStatus;
}
function challengeApplyRewardPoints(claim){
  const points = Math.max(0, Math.round(Number(claim?.skillPoints || claim?.skill_points || 0)));
  const receiptId = String(claim?.claimId || claim?.claim_id || `${claim?.cycleId || claim?.cycle_id}:${claim?.categoryCode || claim?.category_code}`).trim();
  if(!points || !receiptId) throw new Error('El premio recibido no es válido.');
  const receipts = challengeRewardReceipts();
  if(receipts[receiptId]) return { applied:false, points, total:Number(receipts[receiptId]?.total || 0) };
  const profile = typeof readManagerGlobalProfileState === 'function' ? readManagerGlobalProfileState() : { skillPoints:0 };
  let current = Math.max(0, Math.round(Number(profile?.skillPoints || 0)));
  let special = null;
  if(typeof game !== 'undefined' && game){
    special = typeof ensureSpecialState === 'function' ? ensureSpecialState() : game.special;
    current = Math.max(current, Math.max(0, Math.round(Number(special?.puntos_habilidad || 0))));
  }
  const total = current + points;
  if(typeof writeManagerGlobalProfileState === 'function') writeManagerGlobalProfileState({ ...profile, skillPoints:total });
  if(special){
    special.puntos_habilidad = total;
    if(typeof appendSpecialPointsLog === 'function') appendSpecialPointsLog(special, {
      actionId:'premio_competencia_online', points,
      cycleId:String(claim?.cycleId || claim?.cycle_id || ''),
      categoryCode:String(claim?.categoryCode || claim?.category_code || ''),
      position:Number(claim?.position || 0), date:game?.currentDate || ''
    });
    if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'online_competition_reward' });
    if(typeof saveLocal === 'function') saveLocal(true);
  }
  challengeStoreRewardReceipt(receiptId, { points, total, cycleId:claim?.cycleId || claim?.cycle_id || '', categoryCode:claim?.categoryCode || claim?.category_code || '', position:Number(claim?.position || 0) });
  return { applied:true, points, total };
}
async function challengeClaimReward(categoryCode){
  const claim = challengeRewardClaimFor(categoryCode);
  if(!claim || String(claim.status || '').toLowerCase() !== 'claimable') return;
  const category = challengeCategoryByCode(categoryCode);
  if(!confirm(`¿Reclamar ${formatPlainNumber(Number(claim.skillPoints || claim.skill_points || 0))} puntos por el puesto ${Number(claim.position || 0)} en ${category.name}?`)) return;
  try{
    const data = await challengeRequest(challengeConfig().rewardClaimPath, { method:'POST', body:{ cycleId:claim.cycleId || claim.cycle_id, categoryCode:category.code } });
    const awarded = data?.claim || data?.award || data;
    const newlyClaimed = data?.newlyClaimed !== false && awarded?.newlyClaimed !== false;
    if(!newlyClaimed){
      showNotice('Este premio ya fue reclamado con esta cuenta. No se acreditaron puntos nuevamente.');
    }else{
      const result = challengeApplyRewardPoints(awarded);
      showNotice(result.applied ? `Premio acreditado: +${formatPlainNumber(result.points)} puntos de habilidad.` : 'Este premio ya estaba acreditado en este perfil.');
    }
    await challengeLoadRewardStatus({ force:true });
    renderOnlineChallenges();
  }catch(error){ showNotice(error.message); }
}
function challengeEndpoint(){ return normalizeRankingEndpoint(challengeConfig().endpoint); }
function challengeToken(){ return typeof rankingStoredAuthToken === 'function' ? rankingStoredAuthToken() : ''; }
function challengeActionOwnerKey(){
  let owner = 'local';
  try{
    owner = String(localStorage.getItem('fmRankingAuthUserId') || localStorage.getItem('fmRankingAuthUser') || localStorage.getItem('fmRankingUsername') || 'local').trim() || 'local';
  }catch(_){ owner = 'local'; }
  return owner;
}
function challengeActionCooldownStorageKey(){ return `fmChallengeActionCooldownUntil:${challengeActionOwnerKey()}`; }
function challengeActionQuotaStorageKey(){ return `fmChallengeActionBatchV971:${challengeActionOwnerKey()}`; }
function challengeReadActionQuota(){
  const limit = challengeConfig().freeActionsBeforeCooldown;
  let parsed = null;
  try{
    const raw = localStorage.getItem(challengeActionQuotaStorageKey());
    parsed = raw ? JSON.parse(raw) : null;
  }catch(_){ parsed = null; }
  if(!parsed || Number(parsed.version || 0) !== 971){
    // V9.71: los cooldowns legacy de una acción no deben bloquear la nueva tanda inicial de 10.
    try{ localStorage.removeItem(challengeActionCooldownStorageKey()); }catch(_){ /* sin almacenamiento */ }
    parsed = { version:971, count:0 };
    try{ localStorage.setItem(challengeActionQuotaStorageKey(), JSON.stringify(parsed)); }catch(_){ /* sin almacenamiento */ }
  }
  return { version:971, count:Math.max(0, Math.min(limit, Math.round(Number(parsed.count || 0)))), limit };
}
function challengeWriteActionQuota(count=0){
  const limit = challengeConfig().freeActionsBeforeCooldown;
  const state = { version:971, count:Math.max(0, Math.min(limit, Math.round(Number(count || 0)))) };
  try{ localStorage.setItem(challengeActionQuotaStorageKey(), JSON.stringify(state)); }catch(_){ /* sin almacenamiento */ }
  return { ...state, limit };
}
function challengeActionCooldownInfo(now=Date.now()){
  // Leer primero la tanda permite migrar inmediatamente los cooldowns legacy de V9.70.
  let quota = challengeReadActionQuota();
  let until = 0;
  try{ until = Number(localStorage.getItem(challengeActionCooldownStorageKey()) || 0); }catch(_){ until = 0; }
  if(!Number.isFinite(until) || until <= now){
    if(until > 0){
      try{ localStorage.removeItem(challengeActionCooldownStorageKey()); }catch(_){ /* sin almacenamiento */ }
      quota = challengeWriteActionQuota(0);
    }
    return { active:false, until:0, remainingMs:0, quota };
  }
  return { active:true, until, remainingMs:Math.max(0, until - now), quota };
}
function challengeActionCooldownLabel(remainingMs){
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}
function challengeStartActionCooldown(){
  const until = Date.now() + challengeConfig().actionCooldownMs;
  try{ localStorage.setItem(challengeActionCooldownStorageKey(), String(until)); }catch(_){ /* sin almacenamiento */ }
  challengeRefreshActionCooldown();
  return until;
}
function challengeRegisterSuccessfulAction(){
  const current = challengeReadActionQuota();
  const nextCount = Math.min(current.limit, current.count + 1);
  const quota = challengeWriteActionQuota(nextCount);
  const cooldownStarted = nextCount >= quota.limit;
  if(cooldownStarted) challengeStartActionCooldown();
  else challengeRefreshActionCooldown();
  return { count:nextCount, limit:quota.limit, remainingFree:Math.max(0, quota.limit - nextCount), cooldownStarted };
}
function challengeActionUiState(defaultLabel){
  const cooldown = challengeActionCooldownInfo();
  const authenticated = Boolean(challengeToken());
  return {
    disabled:challengeActionBusy || !authenticated || cooldown.active,
    label:challengeActionBusy ? 'Procesando...' : cooldown.active ? `Disponible en ${challengeActionCooldownLabel(cooldown.remainingMs)}` : defaultLabel,
    cooldown
  };
}
function challengeRefreshActionCooldown(){
  clearTimeout(challengeCooldownTimer);
  const cooldown = challengeActionCooldownInfo();
  const authenticated = Boolean(challengeToken());
  document.querySelectorAll('[data-challenge-cooldown-action]').forEach(button => {
    const defaultLabel = String(button.dataset.defaultLabel || 'Continuar');
    const categoryAllowed = button.dataset.challengeCategoryAllowed !== 'false';
    button.disabled = challengeActionBusy || !authenticated || cooldown.active || !categoryAllowed;
    button.textContent = challengeActionBusy ? 'Procesando...' : cooldown.active ? `Disponible en ${challengeActionCooldownLabel(cooldown.remainingMs)}` : defaultLabel;
  });
  const note = document.getElementById('challengeActionCooldownNote');
  if(note){
    const quota = cooldown.quota || challengeReadActionQuota();
    note.textContent = cooldown.active
      ? `Completaste ${quota.limit} acciones. Podrás publicar o aceptar otro desafío en ${challengeActionCooldownLabel(cooldown.remainingMs)}.`
      : `Tanda actual: ${quota.count}/${quota.limit} acciones. Podés publicar o aceptar ${Math.max(0, quota.limit - quota.count)} desafío(s) más sin espera.`;
  }
  if(cooldown.active && activeTab === 'challenges') challengeCooldownTimer = setTimeout(challengeRefreshActionCooldown, 1000);
}
function challengeEnsureActionAvailable(){
  const cooldown = challengeActionCooldownInfo();
  if(!cooldown.active) return true;
  showNotice(`Completaste la tanda de ${cooldown.quota?.limit || challengeConfig().freeActionsBeforeCooldown} acciones. Podrás publicar o aceptar otro desafío en ${challengeActionCooldownLabel(cooldown.remainingMs)}.`);
  return false;
}
function challengeApiUrl(path='', query=''){
  const clean = String(path || '').replace(/^\/+|\/+$/g, '');
  return `${challengeEndpoint()}${clean ? `/${clean}` : ''}${query || ''}`;
}
function challengeHeaders(includeJson=false){
  const headers = { 'X-FM-Client-Version':String(typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'V8.57') };
  const token = challengeToken();
  if(token) headers.Authorization = `Bearer ${token}`;
  if(includeJson) headers['Content-Type'] = 'application/json';
  return headers;
}
async function challengeRequest(path, options={}){
  const method = String(options.method || 'GET').toUpperCase();
  const response = await fetch(challengeApiUrl(path, options.query || ''), {
    method,
    headers:challengeHeaders(method !== 'GET'),
    body:method === 'GET' ? undefined : JSON.stringify(options.body || {})
  });
  const data = await response.json().catch(() => ({}));
  if(!response.ok || data?.ok === false) throw new Error(data?.error || `Error ${response.status} al conectar con Desafíos.`);
  return data;
}

function challengeSafeNumber(value, fallback=0){
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}
function challengeCategoryDefinitions(){
  const seen = new Set();
  const rows = (challengeConfig().categories || []).map(raw => {
    const code = String(raw?.codigo || raw?.code || '').trim().toUpperCase().slice(0,1);
    const free = raw?.libre === true || code === 'L';
    const minimum = Math.max(0, Math.round(challengeSafeNumber(raw?.minimo ?? raw?.minimum, 0)));
    const rawMaximum = raw?.maximo ?? raw?.maximum;
    const maximum = free || rawMaximum == null || rawMaximum === '' ? null : Math.max(minimum, Math.round(challengeSafeNumber(rawMaximum, minimum)));
    return { code, name:String(raw?.nombre || raw?.name || code || 'Categoría').trim(), minimum, maximum, free };
  }).filter(item => item.code && !seen.has(item.code) && seen.add(item.code));
  if(!rows.some(item => item.code === 'L')) rows.push({ code:'L', name:'Libre', minimum:0, maximum:null, free:true });
  return rows;
}
function challengeCategoryByCode(code){
  const clean = String(code || '').trim().toUpperCase();
  return challengeCategoryDefinitions().find(item => item.code === clean) || challengeCategoryDefinitions().find(item => item.code === 'L');
}
function challengeCategoryRangeLabel(category){
  const row = typeof category === 'string' ? challengeCategoryByCode(category) : category;
  if(!row || row.free) return 'Sin límite salarial';
  if(row.minimum <= 0) return `Hasta ${formatMoney(row.maximum || 0)}`;
  return `${formatMoney(row.minimum)} a ${formatMoney(row.maximum || row.minimum)}`;
}
function challengeNaturalCategoryForSalary(salaryTotal){
  const salary = Math.max(0, Math.round(challengeSafeNumber(salaryTotal, 0)));
  const normal = challengeCategoryDefinitions().filter(item => !item.free);
  return normal.find(item => salary >= item.minimum && (item.maximum == null || salary <= item.maximum)) || challengeCategoryByCode('L');
}
function challengeNaturalCategory(snapshot={}){
  return challengeNaturalCategoryForSalary(challengeSnapshotSalary(snapshot));
}
function challengeSnapshotCategoryCode(snapshot={}, options={}){
  const competition = snapshot?.competition || snapshot?.competenciaOnline || {};
  const explicit = String(competition.categoryCode || competition.codigoCategoria || competition.category || '').trim().toUpperCase();
  if(explicit && challengeCategoryDefinitions().some(item => item.code === explicit)) return explicit;
  if(options.inferLegacy === true) return challengeNaturalCategory(snapshot).code;
  return 'L';
}
function challengeRowCategoryCode(row={}){
  const direct = String(row?.categoryCode || row?.category_code || '').trim().toUpperCase();
  if(direct && challengeCategoryDefinitions().some(item => item.code === direct)) return direct;
  return challengeSnapshotCategoryCode(row.creatorSnapshot || row.snapshot || {}, { inferLegacy:false });
}
function challengeCategoryBadgeMarkup(value, options={}){
  const code = typeof value === 'string' ? value : challengeSnapshotCategoryCode(value || {}, { inferLegacy:false });
  const category = challengeCategoryByCode(code);
  const title = `${category.name} · ${challengeCategoryRangeLabel(category)}`;
  return `<span class="challenge-category-badge challenge-category-${escapeHtml(category.code.toLowerCase())} ${options.large ? 'large' : ''}" title="${escapeHtml(title)}"><b>${escapeHtml(category.code)}</b><span>${escapeHtml(category.name)}</span></span>`;
}
function challengePrepareSnapshotCategory(snapshot, requestedCode){
  const natural = challengeNaturalCategory(snapshot);
  const requested = challengeCategoryByCode(requestedCode || natural.code);
  if(!requested.free && requested.code !== natural.code){
    throw new Error(`La convocatoria pertenece a ${natural.name} (${challengeCategoryRangeLabel(natural)}) y no puede presentarse en ${requested.name}.`);
  }
  snapshot.snapshotVersion = Math.max(2, Number(snapshot.snapshotVersion || 1));
  snapshot.competition = {
    system:'salary-categories-v1',
    categoryCode:requested.code,
    categoryName:requested.name,
    naturalCategoryCode:natural.code,
    naturalCategoryName:natural.name,
    salaryTotal:challengeSnapshotSalary(snapshot),
    minimumSalary:requested.minimum,
    maximumSalary:requested.maximum,
    free:requested.free === true,
    scoringVersion:'category-points-v1'
  };
  return snapshot;
}
function challengeCurrentNaturalCategoryCode(){
  try{ return challengeNaturalCategory(buildChallengeSnapshot()).code; }
  catch(_){ return 'L'; }
}
function challengeEnsureCategorySelections(){
  const codes = new Set(challengeCategoryDefinitions().map(item => item.code));
  const natural = challengeCurrentNaturalCategoryCode();
  if(!codes.has(challengeAvailableCategory)) challengeAvailableCategory = natural;
  if(!codes.has(challengeRankingCategory)) challengeRankingCategory = natural;
}
function challengeCategoryNavigationMarkup(context='available'){
  const active = context === 'ranking' ? challengeRankingCategory : challengeAvailableCategory;
  const attribute = context === 'ranking' ? 'data-challenge-ranking-category' : 'data-challenge-available-category';
  return `<div class="card challenge-category-navigation"><div><p class="label">Categorías salariales</p><p class="muted small">Cada letra representa el sueldo total de la convocatoria. Los rivales publicados permanecen ocultos hasta aceptar.</p></div><div class="challenge-category-buttons">${challengeCategoryDefinitions().map(category => `<button type="button" ${attribute}="${escapeHtml(category.code)}" class="${active === category.code ? 'active' : ''}" title="${escapeHtml(`${category.name}: ${challengeCategoryRangeLabel(category)}`)}"><b>${escapeHtml(category.code)}</b><span>${escapeHtml(category.name)}</span></button>`).join('')}</div></div>`;
}
function challengeFormation(){ return typeof isCustomTactic === 'function' && isCustomTactic(game?.tactic) ? 'Personalizada' : String(game?.tactic?.formation || game?.tactic?.formationId || '4-4-2'); }
function challengePlayerValue(player){ return Math.max(0, Math.round(challengeSafeNumber(player?.clause ?? player?.value, 0))); }
function challengeCompetitionStrength(player){
  const overall = clamp(Math.round(Number(typeof effectiveOverall === 'function' ? effectiveOverall(player) : player?.overall || 50)), 1, 99);
  const skills = player?.skills && ['attack','defense','passing','speed','heading','shooting','stamina','leadership','serenity','discipline','teamwork','goalkeeping'].some(key => Number.isFinite(Number(player.skills[key])))
    ? player.skills
    : challengeVisibleSkillSet(player);
  const values = Object.values(skills || {}).map(Number).filter(Number.isFinite).map(value => clamp(value, 1, 99));
  const average = values.length ? values.reduce((sum,value) => sum + value, 0) / values.length : overall;
  return clamp(Math.round(Math.max(overall, average)), 1, 99);
}
function challengeCompetitionSalaryFloor(player){
  const media = challengeCompetitionStrength(player);
  const multiplier = media >= 88 ? 3000000 : media >= 75 ? 1000000 : media >= 62 ? 300000 : media >= 38 ? 80000 : 10000;
  return Math.max(1, Math.round(media * multiplier * 0.10 * 0.35));
}
function challengePlayerSalary(player){
  return Math.max(challengeCompetitionSalaryFloor(player), Math.round(challengeSafeNumber(player?.salary, 0)));
}
function challengeSkill(player, key){
  try{ return clamp(Math.round(typeof baseSkill === 'function' ? baseSkill(player, key) : player?.skills?.[key] || player?.[key] || player?.overall || 50), 1, 99); }
  catch(_){ return clamp(Math.round(Number(player?.overall || 50)), 1, 99); }
}
function challengeVisibleSkillSet(player){
  let stats = {};
  try{ stats = typeof visibleStats === 'function' ? visibleStats(player) : {}; }catch(_){ stats = {}; }
  return {
    attack:Math.round(Number(stats.Ataque ?? player?.overall ?? 50)),
    defense:Math.round(Number(stats.Defensa ?? player?.overall ?? 50)),
    passing:Math.round(Number(stats.Pase ?? player?.overall ?? 50)),
    speed:Math.round(Number(stats.Velocidad ?? stats.Reflejos ?? player?.overall ?? 50)),
    heading:Math.round(Number(stats.Cabezazo ?? stats.Salto ?? player?.overall ?? 50)),
    shooting:Math.round(Number(stats.Tiro ?? stats.Potencia ?? player?.overall ?? 50)),
    stamina:Math.round(Number(stats.Resistencia ?? player?.overall ?? 50)),
    leadership:challengeSkill(player, 'liderazgo'),
    serenity:challengeSkill(player, 'serenidad'),
    discipline:challengeSkill(player, 'disciplina'),
    teamwork:challengeSkill(player, 'trabajoEquipo'),
    goalkeeping:challengeSkill(player, 'porteria')
  };
}
function challengeCurrentForm(playerId){
  try{ return clamp(Math.round(typeof currentCondition === 'function' ? currentCondition(playerId) : game?.playerCondition?.[playerId] ?? 99), 0, 99); }
  catch(_){ return 99; }
}
function challengeCurrentMorale(playerId){
  try{ return clamp(Math.round(typeof currentMorale === 'function' ? currentMorale(playerId) : game?.playerMorale?.[playerId] ?? 50), 1, 99); }
  catch(_){ return 50; }
}
function challengePlayerSnapshot(player, squadRole, tacticalIndex){
  const overall = clamp(Math.round(typeof effectiveOverall === 'function' ? effectiveOverall(player) : player?.overall || 50), 1, 99);
  const tacticalRoles = typeof tacticRoleSlots === 'function' ? tacticRoleSlots(game?.tactic || {}) : [];
  return {
    id:String(player.id),
    name:String(player.name || 'Jugador').slice(0, 80),
    position:String(player.position || 'MC').slice(0, 8),
    tacticalRole:squadRole === 'starter' ? String(tacticalRoles[tacticalIndex] || player.position || 'MC').slice(0,8) : String(player.position || 'MC').slice(0,8),
    age:Math.max(15, Math.round(Number(player.age || 18))),
    overall,
    visibleOverall:clamp(Math.round(typeof visibleOverall === 'function' ? visibleOverall(player) : player?.overall || overall), 1, 99),
    skills:challengeVisibleSkillSet(player),
    form:challengeCurrentForm(player.id),
    morale:challengeCurrentMorale(player.id),
    salary:challengePlayerSalary(player),
    value:challengePlayerValue(player),
    squadRole,
    tacticalIndex:Math.max(0, Math.round(Number(tacticalIndex || 0))),
    isCaptain:Number(game?.tactic?.captainId || 0) === Number(player.id),
    captaincy:typeof captaincyValue === 'function' ? Math.max(0, Math.round(Number(captaincyValue(player.id) || 0))) : 0
  };
}
function challengeSquadIds(){
  const starters = (game?.tactic?.starters || []).slice(0, 11).map(Number).filter(Boolean);
  const starterSet = new Set(starters);
  const bench = (game?.tactic?.bench || []).map(Number).filter(Boolean).filter(id => !starterSet.has(id)).slice(0, 10);
  return { starters, bench };
}
function challengeEconomy(players){
  return (players || []).reduce((totals, player) => {
    totals.value += challengePlayerValue(player);
    totals.salary += challengePlayerSalary(player);
    return totals;
  }, { value:0, salary:0 });
}
function buildChallengeSnapshot(){
  if(!game || !game.selectedClubId) throw new Error('Necesitás una partida activa y un club para publicar un desafío.');
  const ids = challengeSquadIds();
  if(ids.starters.length !== 11) throw new Error('La táctica debe tener 11 titulares válidos.');
  const starterPlayers = ids.starters.map(playerById).filter(Boolean);
  if(starterPlayers.length !== 11) throw new Error('Hay titulares que no existen en el plantel actual.');
  const benchPlayers = ids.bench.map(playerById).filter(Boolean);
  const players = [
    ...starterPlayers.map((player,index) => challengePlayerSnapshot(player, 'starter', index)),
    ...benchPlayers.map((player,index) => challengePlayerSnapshot(player, 'bench', index))
  ];
  const xiEconomy = challengeEconomy(starterPlayers);
  const squadEconomy = challengeEconomy([...starterPlayers, ...benchPlayers]);
  const club = seed?.clubs?.find(item => Number(item.id) === Number(game.selectedClubId)) || {};
  const rating = starterPlayers.reduce((sum, player) => sum + (typeof effectiveOverall === 'function' ? effectiveOverall(player) : Number(player.overall || 50)), 0) / 11;
  const moraleAverage = starterPlayers.reduce((sum, player) => sum + challengeCurrentMorale(player.id), 0) / 11;
  const formAverage = starterPlayers.reduce((sum, player) => sum + challengeCurrentForm(player.id), 0) / 11;
  const cohesion = typeof cohesionValue === 'function' ? cohesionValue(game.selectedClubId) : Number(game?.teamCohesion?.[game.selectedClubId] || 50);
  const seasonYear = Number(game.seasonYear || (typeof currentSeasonYear === 'function' ? currentSeasonYear() : new Date().getUTCFullYear()));
  const seasonDay = typeof seasonDayFromDate === 'function' ? seasonDayFromDate(game.currentDate, seasonYear) : Number(game.phaseTurn || 1);
  return {
    snapshotVersion:1,
    context:{
      gameVersion:String(typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'V8.57'),
      simulatorVersion:challengeConfig().simulatorVersion,
      seasonNumber:Math.max(1, Math.round(Number(game.seasonNumber || 1))),
      seasonDay:Math.max(1, Math.round(Number(seasonDay || 1)))
    },
    club:{
      id:String(game.selectedClubId),
      name:String(club.name || clubName(game.selectedClubId) || 'Club').slice(0, 100),
      crestPath:String((typeof clubBadgeSrcCandidates === 'function' ? clubBadgeSrcCandidates(club)?.[0] : '') || club.crestPath || club.crest || '').slice(0, 220),
      reputation:Math.max(0, Math.round(Number(club.reputation || club.prestige || 0))),
      fans:Math.max(0, Math.round(typeof clubFansCurrent === 'function' ? clubFansCurrent(game.selectedClubId) : 0)),
      stadiumName:String(typeof clubStadiumName === 'function' ? clubStadiumName(game.selectedClubId) : (club.stadiumName || `${club.name || 'Club'} Stadium`)).slice(0, 120),
      stadiumCapacity:Math.max(0, Math.round(typeof clubStadiumCapacity === 'function' ? clubStadiumCapacity(game.selectedClubId) : 0)),
      stadiumCondition:Math.max(0, Math.round(typeof fieldScoreForClub === 'function' ? fieldScoreForClub(game.selectedClubId) : 100))
    },
    tactic:{
      formation:challengeFormation(),
      layoutMode:typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(game?.tactic?.layoutMode) : 'preset',
      customSlots:typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(game?.tactic?.customSlots, game?.tactic) : [],
      customBalance:typeof customTacticBalanceCompact === 'function' ? customTacticBalanceCompact(game?.tactic) : null,
      captainId:String(game?.tactic?.captainId || ''),
      mentality:String(game?.tactic?.mentality || game?.tactic?.mentalidad || 'normal'),
      sectorStyles:JSON.parse(JSON.stringify(game?.tactic?.sectorStyles || game?.tactic?.zoneInstructions || {})),
      matchInstructions:JSON.parse(JSON.stringify(game?.tactic?.matchInstructions || game?.tactic?.instructions || {})),
      playerMentalities:JSON.parse(JSON.stringify(game?.tactic?.playerMentalities || {}))
    },
    team:{
      rating:Math.round(rating * 10) / 10,
      cohesion:Math.round(cohesion),
      moraleAverage:Math.round(moraleAverage * 10) / 10,
      formAverage:Math.round(formAverage * 10) / 10,
      startingXiValue:xiEconomy.value,
      startingXiSalaryTotal:xiEconomy.salary,
      matchSquadValue:squadEconomy.value,
      matchSquadSalaryTotal:squadEconomy.salary
    },
    players
  };
}

function challengeStatusLabel(status){
  return ({ open:'Disponible', processing:'Simulando', completed:'Finalizado', cancelled:'Cancelado', expired:'Vencido' })[String(status || '')] || String(status || '—');
}
function challengeStatusClass(status){
  return ({ open:'ok', processing:'warn', completed:'', cancelled:'bad', expired:'muted' })[String(status || '')] || '';
}
function challengeCrestMarkup(snapshot={}, extraClass=''){
  const club = snapshot?.club || {};
  const rawSrc = String(club.crestPath || '').trim();
  const paths = rawSrc && typeof clubBadgeSrcCandidates === 'function'
    ? clubBadgeSrcCandidates({ name:club.name || '', crestPath:rawSrc })
    : rawSrc ? [rawSrc] : [];
  const src = paths[0] || '';
  const fallbackJson = escapeHtml(JSON.stringify(paths));
  return src
    ? `<span class="challenge-crest-shell ${escapeHtml(extraClass)}"><img src="${escapeHtml(src)}" alt="" class="challenge-crest" data-fallback-index="0" data-fallback-srcs='${fallbackJson}'></span>`
    : `<span class="challenge-crest-shell crest-missing ${escapeHtml(extraClass)}" aria-hidden="true">⚽</span>`;
}
function challengeVenueName(snapshot={}){
  return String(snapshot?.club?.stadiumName || `${snapshot?.club?.name || 'Club'} Stadium`);
}
function challengeClubSummary(snapshot={}, options={}){
  const club = snapshot.club || {};
  const team = snapshot.team || {};
  const compact = options.compact === true;
  const facts = compact
    ? `<div class="challenge-compact-facts">
        <span><b>Estadio</b><em title="${escapeHtml(challengeVenueName(snapshot))}">${escapeHtml(challengeVenueName(snapshot))}</em></span>
        <span><b>Capacidad</b><em>${formatPlainNumber(Number(club.stadiumCapacity || 0))}</em></span>
        <span><b>Hinchas</b><em>${formatPlainNumber(Number(club.fans || 0))}</em></span>
      </div>`
    : `<div class="challenge-club-facts">
        <span><b>Estadio</b>${escapeHtml(challengeVenueName(snapshot))}</span>
        <span><b>Capacidad</b>${formatPlainNumber(Number(club.stadiumCapacity || 0))}</span>
        <span><b>Hinchas</b>${formatPlainNumber(Number(club.fans || 0))}</span>
        <span><b>Valor</b>${formatMoney(Number(team.matchSquadValue || 0))}</span>
        <span><b>Sueldos</b>${formatMoney(Number(team.matchSquadSalaryTotal || 0))}</span>
      </div>`;
  return `<div class="challenge-team-summary ${compact ? 'compact' : ''}">
    <div class="challenge-club-head">${challengeCrestMarkup(snapshot)}<div><strong title="${escapeHtml(club.name || 'Club')}">${escapeHtml(club.name || 'Club')}</strong><small>${escapeHtml(snapshot?.tactic?.formation || '—')} · Media ${Number(team.rating || 0).toFixed(1)}</small></div></div>
    ${facts}
  </div>`;
}
function challengeVenueMarkup(homeSnapshot={}){
  const club = homeSnapshot?.club || {};
  return `<div class="challenge-venue-line"><span>🏟</span><strong>${escapeHtml(challengeVenueName(homeSnapshot))}</strong><span>Capacidad ${formatPlainNumber(Number(club.stadiumCapacity || 0))}</span><span>Hinchas ${formatPlainNumber(Number(club.fans || 0))}</span></div>`;
}
function challengeSnapshotSalary(snapshot={}){
  const team = snapshot?.team || {};
  return Math.max(0, Math.round(challengeSafeNumber(team.matchSquadSalaryTotal ?? team.startingXiSalaryTotal, 0)));
}
function challengeSimpleTeamSide(snapshot={}, managerName='Manager', side='home', options={}){
  const clubName = String(snapshot?.club?.name || options.fallbackClub || (side === 'away' ? 'Club visitante' : 'Club local'));
  const salaryMarkup = options.showSalary === true
    ? `<small class="challenge-history-simple-salary" title="Sueldos de la convocatoria">Sueldos ${formatMoney(challengeSnapshotSalary(snapshot))}</small>`
    : '';
  return `<div class="challenge-history-simple-side challenge-history-simple-${side}">
    ${challengeCrestMarkup(snapshot, 'challenge-history-simple-crest')}
    <div class="challenge-history-simple-copy">
      <strong title="${escapeHtml(clubName)}">${escapeHtml(clubName)}</strong>
      <span title="${escapeHtml(managerName || 'Manager')}">${escapeHtml(managerName || 'Manager')}</span>
      ${salaryMarkup}
    </div>
  </div>`;
}
function challengeSimpleScore(result={}, label='Final'){
  const hasScore = result && (result.homeGoals != null || result.awayGoals != null);
  return `<div class="challenge-history-simple-score ${label ? 'with-label' : ''} ${hasScore ? '' : 'challenge-history-simple-status'}" ${hasScore ? `aria-label="Resultado ${Number(result.homeGoals || 0)} a ${Number(result.awayGoals || 0)}"` : ''}>
    ${label ? `<small>${escapeHtml(label)}</small>` : ''}
    <b>${hasScore ? `${Number(result.homeGoals || 0)}–${Number(result.awayGoals || 0)}` : 'VS'}</b>
  </div>`;
}
function challengeAcceptEligibility(row){
  const targetCode = challengeRowCategoryCode(row);
  if(targetCode === 'L') return { allowed:true, targetCode, label:'Aceptar desafío' };
  try{
    const snapshot = buildChallengeSnapshot();
    const natural = challengeNaturalCategory(snapshot);
    return natural.code === targetCode
      ? { allowed:true, targetCode, label:'Aceptar desafío' }
      : { allowed:false, targetCode, label:`Requiere ${targetCode} · ${challengeCategoryByCode(targetCode).name}` };
  }catch(error){ return { allowed:false, targetCode, label:'Equipo no disponible', error:error.message }; }
}
function challengeOpenCard(row){
  const action = challengeActionUiState('Aceptar rival aleatorio');
  const eligibility = challengeAcceptEligibility(row);
  const disabled = action.disabled || !eligibility.allowed;
  const label = !eligibility.allowed ? eligibility.label : action.label;
  const category = challengeCategoryByCode(challengeRowCategoryCode(row));
  return `<article class="card challenge-card challenge-open-card challenge-anonymous-pool-card">
    <div class="challenge-anonymous-rival">
      ${challengeCategoryBadgeMarkup(category.code,{large:true})}
      <div><h3>Rival disponible</h3><p>Hay al menos un equipo disponible en ${escapeHtml(category.name)}. El club y el manager se revelarán después de aceptar.</p></div>
    </div>
    <div class="challenge-simple-card-actions">
      <span class="pill ok">Emparejamiento anónimo</span>
      <small>Si existen varios desafíos, el servidor elegirá uno al azar.</small>
      <button class="primary" data-challenge-accept-random="${escapeHtml(category.code)}" data-challenge-cooldown-action="accept" data-default-label="${escapeHtml(label)}" data-challenge-category-allowed="${eligibility.allowed ? 'true' : 'false'}" ${disabled ? 'disabled' : ''}>${escapeHtml(label)}</button>
    </div>
  </article>`;
}
function challengeMineCard(row){
  const home = row.creatorSnapshot || {};
  const away = row.opponentSnapshot || {};
  const result = row.match || null;
  const hasOpponent = Boolean(row.opponentUsername || away?.club?.name);
  const actions = `${row.status === 'open' ? `<button class="ghost danger" data-challenge-cancel="${escapeHtml(row.id)}">Cancelar</button>` : ''}${row.status === 'completed' ? `<button class="primary" data-challenge-view="${escapeHtml(row.id)}">Ver partido</button>` : ''}`;
  if(!hasOpponent){
    return `<article class="card challenge-card challenge-simple-single-card challenge-mine-simple-card">
      ${challengeSimpleTeamSide(home, row.creatorUsername || 'Tu manager', 'home', { showSalary:true, fallbackClub:row.creatorClubName || 'Club' })}
      <div class="challenge-simple-card-actions">
        ${challengeCategoryBadgeMarkup(challengeRowCategoryCode(row))}
        <span class="pill ${challengeStatusClass(row.status)}">${challengeStatusLabel(row.status)}</span>
        <small>Esperando rival</small>
        <small>${escapeHtml(challengeDateLabel(row.createdAt))}</small>
        ${actions}
      </div>
    </article>`;
  }
  const center = result ? challengeSimpleScore(result, 'Final') : challengeSimpleScore({}, challengeStatusLabel(row.status));
  return `<article class="card challenge-card challenge-mine-simple-card challenge-simple-match-card">
    <div class="challenge-history-simple challenge-mine-simple-matchup">
      ${challengeSimpleTeamSide(home, row.creatorUsername || 'Manager', 'home', { showSalary:true, fallbackClub:row.creatorClubName || 'Club local' })}
      ${center}
      ${challengeSimpleTeamSide(away, row.opponentUsername || 'Manager', 'away', { showSalary:true, fallbackClub:row.opponentClubName || 'Club visitante' })}
    </div>
    <div class="challenge-simple-card-footer">
      <span>${challengeCategoryBadgeMarkup(challengeRowCategoryCode(row))}${escapeHtml(challengeDateLabel(row.completedAt || row.createdAt))}</span>
      <div class="challenge-actions">${actions}</div>
    </div>
  </article>`;
}
function challengeHistoryCard(row){
  const home = row.creatorSnapshot || {};
  const away = row.opponentSnapshot || {};
  const result = row.match || {};
  return `<article class="card challenge-card challenge-history-card challenge-history-simple" data-challenge-view="${escapeHtml(row.id)}" title="Ver detalle del partido">
    ${challengeSimpleTeamSide(home, row.creatorUsername || 'Manager', 'home', { fallbackClub:row.creatorClubName || 'Club local' })}
    <div class="challenge-history-center">${challengeCategoryBadgeMarkup(challengeRowCategoryCode(row))}${challengeSimpleScore(result, '')}</div>
    ${challengeSimpleTeamSide(away, row.opponentUsername || 'Manager', 'away', { fallbackClub:row.opponentClubName || 'Club visitante' })}
  </article>`;
}

function challengeRankingMarkup(rows){
  const category = challengeCategoryByCode(challengeRankingCategory);
  const cfg = challengeConfig();
  const minimum = cfg.rankingMinimumMatches;
  const minimumOpponents = cfg.rankingMinimumOpponents;
  const cycle = challengeRewardStatus.currentCycle || challengeCycleAt();
  const leader = rows.find(row => row.qualified && row.rank === 1) || null;
  const prizes = challengeRewardValues(category.code);
  const rewardClaim = challengeRewardClaimFor(category.code);
  const priorChampion = (challengeRewardStatus.champions || []).find(item => String(item?.categoryCode || item?.category_code || '').toUpperCase() === category.code) || null;
  let rewardMarkup = '';
  if(!challengeToken()){
    rewardMarkup = '<div class="challenge-reward-status muted"><strong>Premios bloqueados</strong><span>Iniciá sesión para consultar y reclamar premios de ciclos cerrados.</span></div>';
  }else if(challengeRewardStatus.loading){
    rewardMarkup = '<div class="challenge-reward-status muted"><strong>Verificando premios...</strong></div>';
  }else if(!challengeRewardStatus.compatible){
    rewardMarkup = '<div class="challenge-reward-status warning"><strong>Worker pendiente de actualización</strong><span>El ranking funciona, pero el reparto seguro de premios requiere instalar el ajuste V8.12 del Worker.</span></div>';
  }else if(rewardClaim && String(rewardClaim.status || '').toLowerCase() === 'claimable'){
    rewardMarkup = `<div class="challenge-reward-status claimable"><span><strong>Premio disponible</strong><small>Puesto ${Number(rewardClaim.position || 0)} · ciclo ${escapeHtml(String(rewardClaim.cycleId || rewardClaim.cycle_id || 'cerrado'))}</small></span><button class="primary" data-challenge-claim-reward="${escapeHtml(category.code)}">Reclamar +${formatPlainNumber(Number(rewardClaim.skillPoints || rewardClaim.skill_points || 0))}</button></div>`;
  }else if(rewardClaim && String(rewardClaim.status || '').toLowerCase() === 'claimed'){
    rewardMarkup = `<div class="challenge-reward-status claimed"><strong>Premio reclamado</strong><span>+${formatPlainNumber(Number(rewardClaim.skillPoints || rewardClaim.skill_points || 0))} puntos · puesto ${Number(rewardClaim.position || 0)}</span></div>`;
  }else if(challengeRewardStatus.error){
    rewardMarkup = `<div class="challenge-reward-status warning"><strong>No se pudieron verificar premios</strong><span>${escapeHtml(challengeRewardStatus.error)}</span></div>`;
  }else{
    rewardMarkup = '<div class="challenge-reward-status muted"><strong>Sin premio pendiente</strong><span>Los tres primeros clasificados reciben su premio al cerrar el ciclo.</span></div>';
  }
  return `<div class="card challenge-ranking-card">
    <div class="challenge-ranking-header"><div>${challengeCategoryBadgeMarkup(category.code,{large:true})}<div><h3>Ranking ${escapeHtml(category.name)}</h3><p class="muted small">Ciclo ${escapeHtml(cycle.id)} · ${escapeHtml(challengeCycleRangeLabel(cycle))} · restan ${escapeHtml(challengeCycleRemainingLabel(cycle, challengeRewardStatus.serverTime))}.</p></div></div><span class="pill">10 días reales</span></div>
    <div class="challenge-cycle-prizes"><span><b>1°</b><strong>${formatPlainNumber(prizes[0])}</strong><small>puntos</small></span><span><b>2°</b><strong>${formatPlainNumber(prizes[1])}</strong><small>puntos</small></span><span><b>3°</b><strong>${formatPlainNumber(prizes[2])}</strong><small>puntos</small></span><p>Mínimo ${minimum} partidos y ${minimumOpponents} rivales distintos. Sin máximo de encuentros.</p></div>
    ${rewardMarkup}
    ${priorChampion ? `<div class="challenge-last-champion"><span>Campeón del ciclo anterior</span><strong>${escapeHtml(priorChampion.username || priorChampion.managerName || 'Manager')}</strong><small>${formatPlainNumber(Number(priorChampion.points || 0))} puntos</small></div>` : ''}
    <div class="challenge-champion-banner ${leader ? '' : 'empty'}">${leader ? `<span>Líder actual de ${escapeHtml(category.name)}</span><strong>${escapeHtml(leader.username)}</strong><small>${formatPlainNumber(leader.points)} puntos · ${leader.played} partidos · ${leader.uniqueOpponents} rivales</small>` : `<span>Líder actual de ${escapeHtml(category.name)}</span><strong>Aún sin clasificados</strong><small>Nadie alcanzó ${minimum} partidos contra ${minimumOpponents} rivales distintos.</small>`}</div>
    <div class="table-wrap"><table class="challenge-ranking-table"><thead><tr><th>#</th><th>Manager</th><th>Estado</th><th>PJ</th><th>G/E/P</th><th>GF-GC</th><th>Rivales</th><th>Rivales vencidos</th><th>Mejor triunfo</th><th>PTS</th></tr></thead><tbody>
      ${rows.length ? rows.map(row => `<tr class="${row.qualified ? '' : 'challenge-ranking-provisional'}">
        <td>${row.rank || '—'}</td>
        <td><strong>${escapeHtml(row.username || 'Manager')}</strong></td>
        <td>${row.qualified ? (row.rank === 1 ? `<span class="pill ok">Líder</span>` : '<span class="pill">Clasificado</span>') : `<span class="pill muted">Provisional ${row.played}/${minimum} · ${row.uniqueOpponents}/${minimumOpponents}</span>`}</td>
        <td>${Number(row.played || 0)}</td>
        <td>${Number(row.wins || 0)}/${Number(row.draws || 0)}/${Number(row.losses || 0)}</td>
        <td>${Number(row.goalsFor || 0)}-${Number(row.goalsAgainst || 0)}</td>
        <td>${Number(row.uniqueOpponents || 0)}</td>
        <td>${Number(row.uniqueWins || 0)}</td>
        <td>${Number(row.bestMatchPoints || 0)}</td>
        <td><strong>${formatPlainNumber(Number(row.points || 0))}</strong></td>
      </tr>`).join('') : `<tr><td colspan="10" class="muted">Todavía no hay partidos en esta categoría durante el ciclo actual.</td></tr>`}
    </tbody></table></div>
    <div class="challenge-scoring-rules"><p><strong>Triunfos únicos:</strong> la primera victoria contra cada rival recibe el mayor valor; las repeticiones entregan cada vez menos.</p><p><strong>Fuerza del rival:</strong> vencer a un equipo que acumula derrotas vale progresivamente menos; superar a uno con buenos resultados vale más.</p><p><strong>Posición:</strong> ganar desde abajo en la tabla aumenta el premio, mientras que los líderes reciben una reducción.</p></div>
  </div>`;
}
function challengeDateLabel(value){
  const date = new Date(String(value || ''));
  return Number.isFinite(date.getTime()) ? date.toLocaleString('es-AR', { dateStyle:'short', timeStyle:'short' }) : '—';
}
function challengeCurrentTeamCard(){
  let snapshot;
  try{ snapshot = buildChallengeSnapshot(); }
  catch(error){ return `<div class="card blocker"><h3>No se puede publicar el equipo</h3><p>${escapeHtml(error.message)}</p><button class="ghost" data-go-tab="firstTeam">Ir a Primer Equipo</button></div>`; }
  const action = challengeActionUiState('Publicar desafío');
  const natural = challengeNaturalCategory(snapshot);
  return `<div class="card challenge-publish-card">
    <div class="challenge-publish-head">${challengeCrestMarkup(snapshot,'large')}<div><p class="label">Tu equipo actual</p><h3>${escapeHtml(snapshot.club.name)}</h3><p class="muted small">${escapeHtml(challengeVenueName(snapshot))} · ${formatPlainNumber(snapshot.club.stadiumCapacity)} lugares · ${formatPlainNumber(snapshot.club.fans)} hinchas</p></div><div class="challenge-publish-tags"><span class="pill">${escapeHtml(snapshot.tactic.formation)}</span>${challengeCategoryBadgeMarkup(natural.code)}</div></div>
    <div class="grid cols-4 challenge-team-metrics">
      <div><span>Media</span><strong>${snapshot.team.rating.toFixed(1)}</strong></div>
      <div><span>Valor convocatoria</span><strong>${formatMoney(snapshot.team.matchSquadValue)}</strong></div>
      <div><span>Sueldos convocatoria</span><strong>${formatMoney(snapshot.team.matchSquadSalaryTotal)}</strong></div>
      <div><span>Cohesión</span><strong>${snapshot.team.cohesion}%</strong></div>
    </div>
    <div class="challenge-current-category"><div>${challengeCategoryBadgeMarkup(natural.code,{large:true})}<span><b>Categoría actual</b><small>${escapeHtml(challengeCategoryRangeLabel(natural))}</small></span></div><p>Podés publicar en ${escapeHtml(natural.name)} o presentar el mismo equipo en Libre. No hay restricciones por estrellas.</p></div>
    <p class="muted small">Se envía una fotografía de titulares, suplentes, táctica, forma, moral, valores y sueldos. La competencia no modifica la carrera.</p>
    <button id="btnPublishChallenge" class="primary" data-challenge-cooldown-action="publish" data-default-label="Publicar desafío" ${action.disabled ? 'disabled' : ''}>${escapeHtml(action.label)}</button>
    <p id="challengeActionCooldownNote" class="muted small challenge-cooldown-note"></p>
  </div>`;
}
function openChallengePublishCategoryModal(){
  if(!challengeEnsureActionAvailable()) return;
  let snapshot;
  try{ snapshot = buildChallengeSnapshot(); }
  catch(error){ showNotice(error.message); return; }
  const natural = challengeNaturalCategory(snapshot);
  const choices = natural.code === 'L' ? [challengeCategoryByCode('L')] : [natural, challengeCategoryByCode('L')];
  openModal(`<div class="challenge-category-modal"><p class="eyebrow">Competencia online</p><h2>Elegí la categoría</h2><p class="muted">La convocatoria suma ${formatMoney(challengeSnapshotSalary(snapshot))} en sueldos mensuales. El desafío sólo podrá ser aceptado por un equipo de la misma categoría.</p><div class="challenge-publish-category-options">${choices.map(category => `<button type="button" data-publish-challenge-category="${escapeHtml(category.code)}">${challengeCategoryBadgeMarkup(category.code,{large:true})}<span><strong>${escapeHtml(category.name)}</strong><small>${escapeHtml(challengeCategoryRangeLabel(category))}</small>${category.code === 'L' ? '<em>Admite cualquier convocatoria.</em>' : '<em>Tu convocatoria cumple este rango.</em>'}</span></button>`).join('')}</div><div class="modal-actions"><button id="btnCancelChallengePublish" class="ghost">Cancelar</button></div></div>`);
  document.querySelectorAll('[data-publish-challenge-category]').forEach(button => button.addEventListener('click', () => {
    const code = button.dataset.publishChallengeCategory;
    closeModal();
    publishChallenge(code);
  }));
  $('btnCancelChallengePublish')?.addEventListener('click', closeModal);
}

function challengeLoginWarning(){
  if(challengeToken()) return '';
  return `<div class="card blocker"><h3>Iniciá sesión</h3><p>Los desafíos reutilizan la misma cuenta del Ranking Online.</p><button class="primary" data-go-ranking>Ir al login del ranking</button></div>`;
}
function challengeListMarkup(){
  let rows = challengeRowsCache[challengeViewTab] || [];
  if(challengeViewTab === 'available') rows = rows.filter(row => challengeRowCategoryCode(row) === challengeAvailableCategory);
  if(challengeLoading && !rows.length && !challengeLoadedTabs[challengeViewTab]) return '<div class="card"><p class="muted">Cargando desafíos...</p></div>';
  if(!rows.length){
    const selectedCategory = challengeViewTab === 'available' ? challengeCategoryByCode(challengeAvailableCategory) : challengeViewTab === 'ranking' ? challengeCategoryByCode(challengeRankingCategory) : null;
    const label = challengeViewTab === 'available' ? `rivales disponibles en ${selectedCategory.name}` : challengeViewTab === 'mine' ? 'desafíos propios' : challengeViewTab === 'ranking' ? `puntajes de ${selectedCategory.name}` : 'partidos disputados';
    return `<div class="card empty"><h3>Sin registros</h3><p>No hay ${label} para mostrar.</p></div>`;
  }
  if(challengeViewTab === 'available') return `<div class="challenge-grid challenge-available-grid">${rows.map(challengeOpenCard).join('')}</div>`;
  if(challengeViewTab === 'mine') return `<div class="challenge-grid challenge-mine-grid">${rows.map(challengeMineCard).join('')}</div>`;
  if(challengeViewTab === 'ranking') return challengeRankingMarkup(rows);
  return `<div class="challenge-grid challenge-history-grid">${rows.map(challengeHistoryCard).join('')}</div>`;
}
function renderOnlineChallenges(){
  clearTimeout(challengePollTimer);
  clearTimeout(challengeCooldownTimer);
  challengeEnsureCategorySelections();
  const cfg = challengeConfig();
  if(!cfg.active){ view.innerHTML = '<div class="card blocker"><h2>Desafíos desactivados</h2><p>La función está deshabilitada en config.js.</p></div>'; return; }
  if(challengeDetail){ renderChallengeDetail(challengeDetail); return; }
  view.innerHTML = `<div class="section-title row">
      <div><h2>Competencias Online</h2><p class="tagline">Emparejamientos anónimos por categorías salariales, con ranking independiente y una división Libre.</p></div>
      <button id="btnRefreshChallenges" class="ghost">Actualizar</button>
    </div>
    ${challengeLoginWarning()}
    ${game && !game.gameOver?.active ? challengeCurrentTeamCard() : ''}
    <div class="card challenge-tabs">
      <button data-challenge-tab="available" class="${challengeViewTab === 'available' ? 'active' : ''}">Disponibles</button>
      <button data-challenge-tab="mine" class="${challengeViewTab === 'mine' ? 'active' : ''}">Mis desafíos</button>
      <button data-challenge-tab="history" class="${challengeViewTab === 'history' ? 'active' : ''}">Partidos disputados</button>
      <button data-challenge-tab="ranking" class="${challengeViewTab === 'ranking' ? 'active' : ''}">Ranking</button>
    </div>
    ${(challengeViewTab === 'available' || challengeViewTab === 'ranking') ? challengeCategoryNavigationMarkup(challengeViewTab) : ''}
    <div id="challengeStatus" class="small muted"></div>
    <div id="challengeList">${challengeListMarkup()}</div>`;
  bindChallengeEvents();
  challengeRefreshActionCooldown();
  if(!challengeLoadedTabs[challengeViewTab] && !challengeLoading) setTimeout(() => loadChallenges(challengeViewTab), 0);
  if(challengeToken()) challengePollTimer = setTimeout(() => { if(activeTab === 'challenges' && !challengeDetail) loadChallenges('mine', { silent:true, keepTab:true }); }, cfg.pollMs);
}
function bindChallengeEvents(){
  $('btnRefreshChallenges')?.addEventListener('click', () => loadChallenges(challengeViewTab, { force:true }));
  $('btnPublishChallenge')?.addEventListener('click', openChallengePublishCategoryModal);
  document.querySelector('[data-go-ranking]')?.addEventListener('click', () => { activeTab='ranking'; renderAll(); });
  document.querySelectorAll('[data-challenge-tab]').forEach(button => button.addEventListener('click', () => {
    challengeViewTab = button.dataset.challengeTab;
    challengeDetail = null;
    renderOnlineChallenges();
  }));
  document.querySelectorAll('[data-challenge-available-category]').forEach(button => button.addEventListener('click', () => {
    challengeAvailableCategory = button.dataset.challengeAvailableCategory;
    renderOnlineChallenges();
  }));
  document.querySelectorAll('[data-challenge-ranking-category]').forEach(button => button.addEventListener('click', () => {
    challengeRankingCategory = button.dataset.challengeRankingCategory;
    challengeRowsCache.ranking = challengeRankingLeaderboardsCache[challengeRankingCategory] || [];
    renderOnlineChallenges();
  }));
  document.querySelectorAll('[data-challenge-accept-random]').forEach(button => button.addEventListener('click', () => acceptRandomChallenge(button.dataset.challengeAcceptRandom)));
  document.querySelectorAll('[data-challenge-cancel]').forEach(button => button.addEventListener('click', () => cancelChallenge(button.dataset.challengeCancel)));
  document.querySelectorAll('[data-challenge-view]').forEach(button => button.addEventListener('click', () => openChallengeDetail(button.dataset.challengeView)));
  document.querySelectorAll('[data-challenge-claim-reward]').forEach(button => button.addEventListener('click', () => challengeClaimReward(button.dataset.challengeClaimReward)));
  document.querySelectorAll('[data-go-tab]').forEach(button => button.addEventListener('click', () => { activeTab=button.dataset.goTab; renderAll(); }));
}
function challengeRowsFromResponse(data){
  return Array.isArray(data?.challenges) ? data.challenges : [];
}
async function loadChallenges(tab=challengeViewTab, options={}){
  if(!challengeToken() && tab === 'mine'){ challengeLoadedTabs.mine = true; return; }
  if(options.force) challengeLoadedTabs[tab] = false;
  challengeLoading = true;
  if(!options.silent && activeTab === 'challenges') renderOnlineChallenges();
  try{
    if(tab === 'ranking'){
      const [rankingData] = await Promise.all([
        challengeRequest('challenges/ranking'),
        challengeLoadRewardStatus({ force:options.force })
      ]);
      challengeRankingLeaderboardsCache = rankingData?.leaderboards && typeof rankingData.leaderboards === 'object' ? rankingData.leaderboards : {};
      challengeHomeHistoryLoadedAt = Date.now();
      challengeRowsCache.ranking = challengeRankingLeaderboardsCache[challengeRankingCategory]
        || (Array.isArray(rankingData?.ranking) ? rankingData.ranking : []);
      challengeLoadedTabs.ranking = true;
    }else{
      const path = tab === 'available' ? 'challenges/open' : tab === 'mine' ? 'challenges/mine' : 'challenges/history';
      const data = await challengeRequest(path, { query:`?limit=${challengeConfig().pageSize}` });
      let rows = challengeRowsFromResponse(data);
      if(tab === 'available'){
        let ownUserId = 0;
        try{ ownUserId = Number(localStorage.getItem('fmRankingAuthUserId') || 0); }catch(_){ ownUserId = 0; }
        if(ownUserId) rows = rows.filter(row => Number(row.creatorUserId || 0) !== ownUserId);
      }
      challengeRowsCache[tab] = rows;
      if(tab === 'available'){
        challengeHomeAvailabilityLoadedAt = Date.now();
        const summary = challengeCurrentTeamCategorySummary();
        challengeHomeOnlineState = { ...challengeHomeOnlineState, ...summary, availabilityLoaded:true, available:rows.some(row => challengeRowCategoryCode(row) === summary.categoryCode) };
        challengeUpdateTopAvailabilityButton();
      }
      challengeLoadedTabs[tab] = true;
    }
  }catch(error){
    challengeLoadedTabs[tab] = true;
    if(!options.silent) showNotice(error.message);
  }finally{
    challengeLoading = false;
    if(activeTab === 'challenges' && (!options.keepTab || challengeViewTab === tab)) renderOnlineChallenges();
    else if(activeTab === 'challenges' && options.keepTab && challengeToken()){
      clearTimeout(challengePollTimer);
      challengePollTimer = setTimeout(() => loadChallenges('mine', { silent:true, keepTab:true }), challengeConfig().pollMs);
    }
  }
}
async function publishChallenge(categoryCode){
  if(!challengeEnsureActionAvailable()) return;
  try{
    challengeActionBusy = true;
    challengeRefreshActionCooldown();
    const snapshot = challengePrepareSnapshotCategory(buildChallengeSnapshot(), categoryCode);
    const category = challengeCategoryByCode(challengeSnapshotCategoryCode(snapshot));
    showNotice(`Publicando desafío en ${category.name}...`);
    await challengeRequest('challenges', { method:'POST', body:{ snapshot } });
    const actionQuota = challengeRegisterSuccessfulAction();
    challengeRowsCache.available = [];
    challengeRowsCache.mine = [];
    challengeLoadedTabs.available = false;
    challengeLoadedTabs.mine = false;
    challengeViewTab = 'mine';
    showNotice(actionQuota.cooldownStarted ? `Desafío publicado en ${category.name}. Completaste ${actionQuota.limit} acciones: comienza la pausa de 10 minutos.` : `Desafío publicado en ${category.name}. Te quedan ${actionQuota.remainingFree} acción(es) sin espera en esta tanda.`);
    await loadChallenges('mine', { force:true });
  }catch(error){ showNotice(error.message); }
  finally{
    challengeActionBusy = false;
    challengeRefreshActionCooldown();
  }
}
async function acceptRandomChallenge(categoryCode){
  if(!challengeEnsureActionAvailable()) return;
  const targetCode = challengeCategoryByCode(categoryCode).code;
  const targetCategory = challengeCategoryByCode(targetCode);
  let snapshot;
  try{ snapshot = challengePrepareSnapshotCategory(buildChallengeSnapshot(), targetCode); }
  catch(error){ showNotice(error.message); return; }
  if(!confirm(`¿Buscar y aceptar un rival aleatorio en ${targetCategory.name} con la táctica y convocatoria actuales?`)) return;
  const status = $('challengeStatus');
  try{
    challengeActionBusy = true;
    challengeRefreshActionCooldown();
    if(status) status.textContent = 'Buscando y reservando un rival aleatorio...';
    const accepted = await challengeRequest('challenges/random/accept', { method:'POST', body:{ snapshot, categoryCode:targetCode } });
    const acceptedChallengeId = String(accepted?.challengeId || '').trim();
    if(!acceptedChallengeId) throw new Error('El servidor no devolvió el desafío seleccionado.');
    const actionQuota = challengeRegisterSuccessfulAction();
    if(status) status.textContent = 'Recuperando el partido calculado y guardado por el servidor...';
    const saved = accepted?.challenge ? accepted : await challengeRequest(`challenges/${encodeURIComponent(acceptedChallengeId)}`);
    if(!saved?.challenge?.match) throw new Error('El Worker no devolvió el resultado autoritativo. Verificá que esté instalada la versión V8.32.');
    challengeRowsCache.available = [];
    challengeRowsCache.mine = [];
    challengeRowsCache.history = [];
    challengeRowsCache.ranking = [];
    challengeLoadedTabs.available = false;
    challengeLoadedTabs.mine = false;
    challengeLoadedTabs.history = false;
    challengeLoadedTabs.ranking = false;
    challengeDetail = saved.challenge || null;
    showNotice(actionQuota.cooldownStarted ? `Rival asignado al azar. Completaste ${actionQuota.limit} acciones: comienza la pausa de 10 minutos.` : `Rival asignado al azar. Te quedan ${actionQuota.remainingFree} acción(es) sin espera en esta tanda.`);
    renderOnlineChallenges();
  }catch(error){
    if(status) status.textContent = '';
    showNotice(error.message);
  }finally{
    challengeActionBusy = false;
    challengeRefreshActionCooldown();
  }
}
async function cancelChallenge(challengeId){
  if(!confirm('¿Cancelar este desafío abierto?')) return;
  try{
    await challengeRequest(`challenges/${encodeURIComponent(challengeId)}/cancel`, { method:'POST', body:{} });
    challengeRowsCache.mine = [];
    challengeRowsCache.available = [];
    challengeLoadedTabs.mine = false;
    challengeLoadedTabs.available = false;
    showNotice('Desafío cancelado.');
    await loadChallenges('mine', { force:true });
  }catch(error){ showNotice(error.message); }
}
async function openChallengeDetail(challengeId){
  try{
    const data = await challengeRequest(`challenges/${encodeURIComponent(challengeId)}`);
    challengeDetail = data.challenge || null;
    renderOnlineChallenges();
  }catch(error){ showNotice(error.message); }
}
function challengeEventLabel(event){
  const playerName = escapeHtml(event.playerName || 'Jugador');
  const assistName = escapeHtml(event.assistPlayerName || '');
  if(event.type === 'goal') return `⚽ ${playerName}${assistName ? ` (asist. ${assistName})` : ''}`;
  if(event.type === 'yellow') return `🟨 ${playerName}`;
  if(event.type === 'red') return `🟥 ${playerName}`;
  if(event.type === 'injury') return `✚ ${playerName} · lesión estimada ${Number(event.days || 0)} días`;
  if(event.type === 'substitution') return `↔ ${escapeHtml(event.inPlayerName || 'Jugador')} por ${escapeHtml(event.outPlayerName || 'Jugador')}`;
  return escapeHtml(event.type || 'Evento');
}
function challengeRatingsColumn(ratings=[], side='home'){
  const rows = ratings.filter(item => item.side === side).sort((a,b) => Number(b.rating || 0) - Number(a.rating || 0) || String(a.playerName || '').localeCompare(String(b.playerName || ''), 'es'));
  return `<aside class="card challenge-ratings-side ${side}">
    <div class="challenge-ratings-head"><span class="pill">${side === 'home' ? 'LOCAL' : 'VISITANTE'}</span><strong>${rows.length} jugadores</strong></div>
    <div class="challenge-rating-list">${rows.length ? rows.map(item => `<div class="challenge-rating-row"><span><b>${escapeHtml(item.playerName || 'Jugador')}</b><small>${escapeHtml(item.position || '—')}</small></span><strong>${Number(item.rating || 0).toFixed(1)}</strong></div>`).join('') : '<p class="muted small">Sin puntajes.</p>'}</div>
  </aside>`;
}
function renderChallengeDetail(row){
  const home = row.creatorSnapshot || {};
  const away = row.opponentSnapshot || {};
  const match = row.match || {};
  const result = match.result || {};
  const events = Array.isArray(result.events) ? result.events : [];
  const ratings = Array.isArray(result.playerRatings) ? result.playerRatings.slice() : [];
  const category = challengeCategoryByCode(challengeRowCategoryCode(row));
  view.innerHTML = `<div class="row section-title"><div><h2>Partido de ${escapeHtml(category.name)}</h2><p class="tagline">${escapeHtml(row.creatorUsername || 'Manager')} vs ${escapeHtml(row.opponentUsername || 'Manager')}</p></div><div class="challenge-detail-actions">${challengeCategoryBadgeMarkup(category.code,{large:true})}<button id="btnBackChallenges" class="ghost">Volver</button></div></div>
    <div class="card challenge-result-hero">
      <div>${challengeClubSummary(home)}</div>
      <div class="challenge-result-score"><span>Final</span><strong>${Number(match.homeGoals || result?.score?.home || 0)}–${Number(match.awayGoals || result?.score?.away || 0)}</strong><small>${escapeHtml(challengeDateLabel(row.completedAt || match.createdAt))}</small></div>
      <div>${challengeClubSummary(away)}</div>
    </div>
    ${challengeVenueMarkup(home)}
    <div class="grid cols-4 challenge-result-metrics">
      <div class="card"><span>Asistencia</span><strong>${formatPlainNumber(Number(match.attendance || result?.attendance?.total || 0))}</strong></div>
      <div class="card"><span>Valor usado local</span><strong>${formatMoney(Number(match.homeUsedPlayersValue || result?.economy?.homeUsedPlayersValue || 0))}</strong></div>
      <div class="card"><span>Valor usado visitante</span><strong>${formatMoney(Number(match.awayUsedPlayersValue || result?.economy?.awayUsedPlayersValue || 0))}</strong></div>
      <div class="card"><span>Figura</span><strong>${escapeHtml(result?.manOfMatch?.playerName || '—')} ${result?.manOfMatch?.rating ? `(${result.manOfMatch.rating})` : ''}</strong></div>
    </div>
    <div class="challenge-match-layout">
      ${challengeRatingsColumn(ratings,'home')}
      <main class="challenge-match-center">
        <div class="card"><h3>Estadísticas</h3>${challengeStatisticsMarkup(home, away, result.statistics || {})}</div>
        <div class="card"><h3>Eventos</h3><div class="challenge-events">${events.length ? events.map(event => `<div><span>${Number(event.minute || 0)}'</span><strong>${event.side === 'home' ? 'LOCAL' : 'VISITANTE'}</strong><p>${challengeEventLabel(event)}</p></div>`).join('') : '<p class="muted">Sin eventos registrados.</p>'}</div></div>
      </main>
      ${challengeRatingsColumn(ratings,'away')}
    </div>
    <div class="card challenge-disclaimer"><strong>Competencia ${escapeHtml(category.name)}.</strong> El resultado fue calculado y validado por el Worker, suma al ranking de la categoría y no modifica ninguna carrera.</div>`;
  $('btnBackChallenges')?.addEventListener('click', () => { challengeDetail=null; renderOnlineChallenges(); });
}
function challengeStatisticsMarkup(home, away, statistics){
  const labels = [
    ['Posesión','possession','%'], ['Intentos de ataque','shots',''], ['Tiros al arco','shotsOnTarget',''], ['Córners','corners',''], ['Faltas','fouls','']
  ];
  return `<div class="challenge-stat-list">${labels.map(([label,key,suffix]) => `<div><strong>${Number(statistics?.home?.[key] || 0)}${suffix}</strong><span>${label}</span><strong>${Number(statistics?.away?.[key] || 0)}${suffix}</strong></div>`).join('')}</div>
    <div class="challenge-economy-comparison"><p>Local: convocatoria ${formatMoney(Number(home?.team?.matchSquadValue || 0))} · sueldos ${formatMoney(Number(home?.team?.matchSquadSalaryTotal || 0))}</p><p>Visitante: convocatoria ${formatMoney(Number(away?.team?.matchSquadValue || 0))} · sueldos ${formatMoney(Number(away?.team?.matchSquadSalaryTotal || 0))}</p></div>`;
}
