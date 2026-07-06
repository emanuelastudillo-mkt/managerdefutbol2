/* V3.17 · Eventos principales, normalización de partida, calendario anual, temporadas y ascensos/descensos. */

function clubSelectOptionsMarkup(){
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  return divisions.map(division => {
    const clubs = seed.clubs.filter(c => (c.divisionId || 'default') === division.id);
    if(!clubs.length) return '';
    return `<optgroup label="${escapeHtml(division.name)}">${clubs.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('')}</optgroup>`;
  }).join('');
}

function clubCountry(club){
  return String(club?.country || club?.pais || club?.countryName || 'Argentina').trim() || 'Argentina';
}
function availableCountries(){
  const names = Array.from(new Set((seed?.clubs || []).map(clubCountry).filter(Boolean)));
  return names.length ? names.sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'})) : ['Argentina'];
}
function countryOptionsMarkup(selected='Argentina'){
  const countries = availableCountries();
  const current = countries.includes(selected) ? selected : countries[0];
  return countries.map(name => `<option value="${escapeHtml(name)}" ${name===current?'selected':''}>${escapeHtml(name)}</option>`).join('');
}
function divisionsByCountry(country='Argentina'){
  const cleanCountry = String(country || '').trim() || availableCountries()[0] || 'Argentina';
  const countryClubDivisionIds = new Set((seed?.clubs || [])
    .filter(club => clubCountry(club) === cleanCountry)
    .map(club => club.divisionId || 'default'));
  const divisions = (seed?.divisions || [{ id:'default', name:'Liga única' }])
    .filter(division => countryClubDivisionIds.has(division.id || 'default'));
  return divisions.length ? divisions : (seed?.divisions || [{ id:'default', name:'Liga única' }]);
}
function leagueOptionsMarkup(country='Argentina', selected=''){
  const divisions = divisionsByCountry(country);
  const current = divisions.some(d => d.id === selected) ? selected : divisions[0]?.id;
  return divisions.map(division => `<option value="${escapeHtml(division.id)}" ${division.id===current?'selected':''}>${escapeHtml(division.name)}</option>`).join('');
}
function clubsByCountryLeague(country='Argentina', leagueId=''){
  const cleanCountry = String(country || '').trim() || availableCountries()[0] || 'Argentina';
  const divisions = divisionsByCountry(cleanCountry);
  const currentLeague = divisions.some(d => d.id === leagueId) ? leagueId : divisions[0]?.id;
  return (seed?.clubs || [])
    .filter(club => clubCountry(club) === cleanCountry && (club.divisionId || 'default') === currentLeague)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'}));
}
function teamOptionsMarkup(country='Argentina', leagueId='', selectedClubId=0){
  const clubs = clubsByCountryLeague(country, leagueId);
  const selected = clubs.some(club => Number(club.id) === Number(selectedClubId)) ? Number(selectedClubId) : Number(clubs[0]?.id || 0);
  return clubs.map(club => `<option value="${club.id}" ${Number(club.id)===selected?'selected':''}>${escapeHtml(club.name)}</option>`).join('');
}
function storedManagerName(){
  try{ return String(game?.rankingManagerName || localStorage.getItem('fmRankingManagerName') || '').trim(); }
  catch(_){ return String(game?.rankingManagerName || '').trim(); }
}
function persistManagerName(name){
  const clean = String(name || '').trim().slice(0, 40);
  try{ localStorage.setItem('fmRankingManagerName', clean); }catch(_){ /* sin almacenamiento */ }
  if(game) game.rankingManagerName = clean;
  return clean;
}

function fillClubSelect(){
  const select = $('clubSelect');
  if(select) select.innerHTML = clubSelectOptionsMarkup();
}
function bindEvents(){
  $('btnOpenNewGame')?.addEventListener('click', openNewGameModal);
  $('btnNewGame')?.addEventListener('click', ()=> newGame(Number($('clubSelect')?.value || 0), { managerName:storedManagerName() }));
  $('btnSave').addEventListener('click', saveLocal);
  $('btnLoad').addEventListener('click', ()=>loadLocal(false));
  $('btnReset').addEventListener('click', resetLocal);
  document.querySelectorAll('.tabs button').forEach(btn=>{
    btn.addEventListener('click', ()=>{
      activeTab = btn.dataset.tab;
      renderAll();
    });
  });
  document.addEventListener('click', (event)=>{
    const playerBtn = event.target.closest('[data-player-id]');
    if(playerBtn){ showPlayerModal(Number(playerBtn.dataset.playerId)); return; }
    const clubBtn = event.target.closest('[data-club-id]');
    if(clubBtn){ showClubModal(Number(clubBtn.dataset.clubId)); return; }
    const matchBtn = event.target.closest('[data-match-id]');
    if(matchBtn){ showMatchModal(matchBtn.dataset.matchId); return; }
    if(event.target.closest('[data-open-messages]')){ activeTab='messages'; renderAll(); return; }
    const mentalityBtn = event.target.closest('[data-toggle-mentality]');
    if(mentalityBtn){
      const playerId = Number(mentalityBtn.dataset.toggleMentality);
      if(game?.tactic?.starters?.includes(playerId)){
        game.tactic = applyStarterMentalities(game.tactic);
        game.tactic.playerMentalities[playerId] = nextMentality(playerMentality(playerId));
        saveLocal(true);
        renderTactics();
      }
      return;
    }
    const close = event.target.closest('[data-close-modal]');
    if(close || event.target.classList.contains('modal-backdrop')) closeModal();
  });
  document.addEventListener('keydown', (event)=>{ if(event.key === 'Escape') closeModal(); });
}

function startUiTicker(){
  clearInterval(uiTicker);
  uiTicker = setInterval(()=>{
    if(game) refreshSidebarDate();
    if(game && activeTab === 'home') updateAdvanceButtonState();
  }, 1000);
}
function generateSaveCode(){
  const raw = `${Date.now()}-${Math.random()}-${navigator.userAgent || ''}`;
  return `FM-${Date.now().toString(36).toUpperCase()}-${hashNumber(raw, 1000000).toString().padStart(6,'0')}`;
}
function deriveSeasonInitialBudgetFromHistory(saved, season){
  const history = Array.isArray(saved?.budgetHistory) ? saved.budgetHistory : [];
  const currentSeason = Number(season || saved?.seasonNumber || 1);
  const first = history.find(entry => Number(entry.season || currentSeason) === currentSeason && Number.isFinite(Number(entry.budget)));
  if(first){
    return Math.max(0, Math.round(Number(first.budget || 0) - Number(first.delta || 0)));
  }
  if(currentSeason === 1){
    const club = seed?.clubs?.find(c => Number(c.id) === Number(saved?.selectedClubId));
    if(club && Number.isFinite(Number(club.budget))) return Math.max(0, Math.round(Number(club.budget)));
  }
  return Math.max(0, Math.round(Number(saved?.budget || 0)));
}
function normalizeGame(saved){
  const normalized = {...saved};
  normalized.version = APP_VERSION;
  normalized.seedSignature = normalized.seedSignature || seed?.meta?.signature || '';
  normalized.tactic = normalizeTactic(normalized.selectedClubId, normalized.tactic || DEFAULT_TACTIC);
  normalized.playerStatus = normalized.playerStatus || {};
  normalized.lastOwnProblems = normalized.lastOwnProblems || [];
  normalized.lastTurnSummary = normalized.lastTurnSummary || null;
  normalized.mustReviewTactics = Boolean(normalized.mustReviewTactics);
  normalized.advanceLockedUntil = normalized.advanceLockedUntil || 0;
  normalized.matchHistory = normalized.matchHistory || [];
  normalized.seasonNumber = Number.isFinite(normalized.seasonNumber) ? normalized.seasonNumber : 1;
  normalized.seasonYear = Math.round(Number(normalized.seasonYear || 0)) || seasonYearForNumber(normalized.seasonNumber || 1);
  normalized.calendarVersion = normalized.calendarVersion || '';
  normalized.saveCode = normalized.saveCode || generateSaveCode();
  normalized.rankingUploads = (normalized.rankingUploads && typeof normalized.rankingUploads === 'object' && !Array.isArray(normalized.rankingUploads)) ? normalized.rankingUploads : {};
  normalized.rankingManagerName = normalized.rankingManagerName || storedManagerName() || '';
  normalized.rankingLastUploadGameDate = validIsoDate(normalized.rankingLastUploadGameDate) ? normalized.rankingLastUploadGameDate : '';
  normalized.selectedCountry = normalized.selectedCountry || clubCountry(seed?.clubs?.find(c => Number(c.id) === Number(normalized.selectedClubId))) || 'Argentina';
  normalized.selectedLeagueId = normalized.selectedLeagueId || (seed?.clubs?.find(c => Number(c.id) === Number(normalized.selectedClubId))?.divisionId || 'default');
  normalized.seasonBudgetStartBySeason = (normalized.seasonBudgetStartBySeason && typeof normalized.seasonBudgetStartBySeason === 'object' && !Array.isArray(normalized.seasonBudgetStartBySeason)) ? normalized.seasonBudgetStartBySeason : {};
  if(!Number.isFinite(Number(normalized.seasonBudgetStartBySeason[normalized.seasonNumber]))){
    normalized.seasonBudgetStartBySeason[normalized.seasonNumber] = deriveSeasonInitialBudgetFromHistory(normalized, normalized.seasonNumber);
  }
  normalized.seasonInitialBudget = Number.isFinite(Number(normalized.seasonInitialBudget)) ? Math.round(Number(normalized.seasonInitialBudget)) : Math.round(Number(normalized.seasonBudgetStartBySeason[normalized.seasonNumber] || deriveSeasonInitialBudgetFromHistory(normalized, normalized.seasonNumber)));
  normalized.seasonFinalized = Boolean(normalized.seasonFinalized);
  normalized.seasonTransition = normalized.seasonTransition || null;
  normalized.seasonPhase = normalized.seasonPhase || (normalized.seasonFinalized ? 'finalized' : 'regular');
  normalized.phaseTurn = Number.isFinite(normalized.phaseTurn) ? normalized.phaseTurn : 0;
  normalized.globalTurn = Number.isFinite(normalized.globalTurn) ? normalized.globalTurn : ((Math.max(1, normalized.seasonNumber || 1) - 1) * 53 + (normalized.matchdayIndex || 0));
  normalized.preseasonFriendliesPlayed = Number.isFinite(normalized.preseasonFriendliesPlayed) ? normalized.preseasonFriendliesPlayed : 0;
  normalized.pendingFriendlyOpponentId = Number.isFinite(normalized.pendingFriendlyOpponentId) ? normalized.pendingFriendlyOpponentId : 0;
  normalized.clubDivisionOverrides = normalized.clubDivisionOverrides || {};
  normalized.managerStats = normalizeManagerStats(normalized.managerStats);
  normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
  normalized.marketPlayers = Array.isArray(normalized.marketPlayers) ? normalized.marketPlayers : generateMarketPlayers(MARKET_FREE_AGENT_COUNT);
  normalized.pendingTransfers = Array.isArray(normalized.pendingTransfers) ? normalized.pendingTransfers : [];
  normalized.rejectedPurchaseOffers = (normalized.rejectedPurchaseOffers && typeof normalized.rejectedPurchaseOffers === 'object' && !Array.isArray(normalized.rejectedPurchaseOffers)) ? normalized.rejectedPurchaseOffers : {};
  normalized.lastOwnPlayerOffer = normalized.lastOwnPlayerOffer || null;
  normalized.seasonEndPlayerOffers = normalized.seasonEndPlayerOffers || null;
  mergeMarketPlayersIntoSeed(normalized.marketPlayers);
  normalizeAllPlayerPositions();
  normalized.marketPlayers.forEach(p => { p.position = normalizePlayerPosition(p.position, p.id); ensurePlayerEconomics(p, p.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : MARKET_FREE_AGENT_SALARY_FACTOR); });
  seed.players.forEach(p => ensurePlayerEconomics(p, p.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : 1));
  applyClubDivisionOverrides(normalized.clubDivisionOverrides);
  const previousCalendarVersion = normalized.calendarVersion;
  const previousFixtureCount = Array.isArray(normalized.fixtures) ? normalized.fixtures.length : 0;
  normalized.fixtures = normalizeSeasonFixtures(normalized.fixtures || structuredClone(seed.fixtures), normalized.seasonNumber, normalized.seasonYear);
  const calendarExpanded = previousCalendarVersion !== SEASON_CALENDAR_VERSION && previousFixtureCount > 0 && normalized.fixtures.length > previousFixtureCount;
  normalized.matchdayIndex = Math.min(Math.max(0, Number(normalized.matchdayIndex || 0)), normalized.fixtures.length);
  if(calendarExpanded && normalized.matchdayIndex < normalized.fixtures.length && ['postseason','finalizing','finalized'].includes(normalized.seasonPhase)){
    normalized.seasonPhase = 'regular';
    normalized.phaseTurn = 0;
    normalized.seasonFinalized = false;
    normalized.seasonTransition = null;
  }
  if(previousCalendarVersion !== SEASON_CALENDAR_VERSION || !validIsoDate(normalized.currentDate) || String(normalized.currentDate).slice(0,4) !== String(normalized.seasonYear)){
    normalized.currentDate = dateForSeasonState(normalized);
  }
  normalized.calendarVersion = SEASON_CALENDAR_VERSION;
  normalized.standings = normalized.standings || createInitialStandings();
  normalized.playerStats = normalized.playerStats || createInitialPlayerStats();
  normalized.budget = Number.isFinite(normalized.budget) ? normalized.budget : (seed.clubs.find(c=>c.id===normalized.selectedClubId)?.budget || 0);
  normalized.lastBudgetDelta = Number.isFinite(normalized.lastBudgetDelta) ? normalized.lastBudgetDelta : 0;
  normalized.budgetHistory = normalized.budgetHistory || [];
  normalized.playerCondition = normalized.playerCondition || {};
  seed.players.forEach(p => { if(!Number.isFinite(normalized.playerCondition[p.id])) normalized.playerCondition[p.id] = 99; });
  normalized.playerMorale = normalized.playerMorale || {};
  seed.players.forEach(p => { if(!Number.isFinite(normalized.playerMorale[p.id])) normalized.playerMorale[p.id] = PLAYER_MORALE_START; });
  normalized.playerSkillBoosts = normalized.playerSkillBoosts || {};
  normalized.trainingPlan = normalized.trainingPlan || {};
  normalized.trainingSchedule = normalizeTrainingSchedule(normalized.trainingSchedule);
  seed.players.forEach(p => {
    if(!normalized.playerSkillBoosts[p.id]) normalized.playerSkillBoosts[p.id] = {};
    if(!trainingOptionByValue(normalized.trainingPlan[p.id])) normalized.trainingPlan[p.id] = DEFAULT_TRAINING_TYPE;
  });
  normalized.staffActions = normalized.staffActions || {};
  normalized.staffContracts = normalizeStaffContracts(normalized.staffContracts || {});
  normalized.academy = normalizeAcademyState(normalized.academy);
  if(normalized.staffActions.motivationalTalk && !Number.isFinite(normalized.staffActions.motivationalTalk.globalTurn)){
    normalized.staffActions.motivationalTalk.globalTurn = ((Math.max(1, normalized.staffActions.motivationalTalk.season || normalized.seasonNumber || 1) - 1) * 53) + Number(normalized.staffActions.motivationalTalk.matchdayIndex || 0);
  }
  normalized.stadium = normalized.stadium || createInitialStadiumState();
  normalized.sponsors = normalizeSponsorState(normalized.sponsors);
  normalized.teamCohesion = normalized.teamCohesion || {};
  normalized.lastMatchTactics = normalized.lastMatchTactics || {};
  normalized.botRosterRepairLog = Array.isArray(normalized.botRosterRepairLog) ? normalized.botRosterRepairLog : [];
  seed.clubs.forEach(c => { if(!Number.isFinite(normalized.teamCohesion[c.id])) normalized.teamCohesion[c.id] = TEAM_COHESION_START; });
  if(!normalized.stadium.fields) normalized.stadium.fields = {};
  if(!normalized.stadium.projects) normalized.stadium.projects = {};
  seed.clubs.forEach(c => { if(!Number.isFinite(normalized.stadium.fields[c.id])) normalized.stadium.fields[c.id] = Number.isFinite(c.fieldConditionScore) ? c.fieldConditionScore : initialFieldScore(c); });
  Object.values(normalized.playerStats).forEach(stat => {
    if(stat.injuries === undefined) stat.injuries = 0;
    if(stat.played === undefined) stat.played = 0;
    if(stat.yellow === undefined) stat.yellow = 0;
    if(stat.red === undefined) stat.red = 0;
  });
  return normalized;
}

function ensurePlayerStateForAll(){
  if(!game) return;
  normalizeAllPlayerPositions();
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  game.trainingPlan = game.trainingPlan || {};
  game.trainingSchedule = normalizeTrainingSchedule(game.trainingSchedule);
  game.playerStats = game.playerStats || {};
  seed.players.forEach(p => {
    ensurePlayerEconomics(p, p.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : (p.freeAgent ? MARKET_FREE_AGENT_SALARY_FACTOR : 1));
    if(!Number.isFinite(game.playerCondition[p.id])) game.playerCondition[p.id] = p.freeAgent ? 15 + hashNumber(`free-cond-${p.id}`, 15) : 99;
    if(!Number.isFinite(game.playerMorale[p.id])) game.playerMorale[p.id] = p.freeAgent ? 35 + hashNumber(`free-morale-${p.id}`, 55) : PLAYER_MORALE_START;
    if(!game.playerSkillBoosts[p.id]) game.playerSkillBoosts[p.id] = {};
    if(!trainingOptionByValue(game.trainingPlan[p.id])) game.trainingPlan[p.id] = DEFAULT_TRAINING_TYPE;
    if(!game.playerStats[p.id]) game.playerStats[p.id] = { playerId:p.id, clubId:p.clubId, goals:0, assists:0, yellow:0, red:0, played:0, injuries:0 };
  });
}

function assignPlayerToStarterSlot(playerId, slotIndex){
  if(!canBeStarter(playerId)){
    showNotice('Los lesionados no pueden ser titulares. Los de recuperación menor a 70 días sólo pueden ir al banco.');
    return;
  }
  const player = playerById(playerId);
  const slot = (FORMATIONS[game?.tactic?.formation] || FORMATIONS['4-4-2'])[slotIndex];
  if(!canAssignPlayerToSlot(player, slot)){
    showNotice(slot === 'POR' ? 'El puesto de portero sólo acepta porteros.' : 'Los porteros sólo pueden ocupar el puesto de portero.');
    return;
  }
  game.tactic = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic));
  const starters = game.tactic.starters.slice(0,11);
  while(starters.length < 11) starters.push(0);
  let bench = game.tactic.bench.slice(0,10).filter(id => id !== playerId);
  const previousIndex = starters.indexOf(playerId);
  if(previousIndex >= 0) starters[previousIndex] = 0;
  const displaced = starters[slotIndex];
  starters[slotIndex] = playerId;
  if(displaced && displaced !== playerId && bench.length < 10) bench.push(displaced);
  game.tactic.starters = starters.slice(0,11);
  game.tactic.bench = bench.filter(Boolean).slice(0,10);
  game.tactic.autoSubs = (game.tactic.autoSubs || []).map(rule => ({...rule, outId:game.tactic.starters.includes(rule.outId)?rule.outId:0, inId:game.tactic.bench.includes(rule.inId)?rule.inId:0}));
  game.tactic = applyStarterMentalities(game.tactic);
  saveLocal(true);
  renderTactics();
}
function movePlayerToPool(playerId, pool){
  game.tactic = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic));
  const starters = game.tactic.starters.slice(0,11);
  while(starters.length < 11) starters.push(0);
  const idx = starters.indexOf(playerId);
  if(idx >= 0) starters[idx] = 0;
  game.tactic.starters = starters;
  game.tactic.bench = game.tactic.bench.filter(id => id !== playerId);
  if(pool === 'bench'){
    if(!canBeBench(playerId)){
      showNotice('Sólo se pueden convocar al banco jugadores disponibles o lesionados con recuperación menor a 70 días.');
    } else if(game.tactic.bench.length < 10) game.tactic.bench.push(playerId);
    else showNotice('El banco ya tiene 10 suplentes. El jugador quedó como reserva.');
  }
  game.tactic.autoSubs = (game.tactic.autoSubs || []).map(rule => ({...rule, outId:game.tactic.starters.includes(rule.outId)?rule.outId:0, inId:game.tactic.bench.includes(rule.inId)?rule.inId:0}));
  game.tactic = applyStarterMentalities(game.tactic);
  saveLocal(true);
  renderTactics();
}

function tacticLocationOfPlayer(playerId){
  game.tactic = normalizeTactic(game.selectedClubId, game.tactic);
  const id = Number(playerId || 0);
  const starterIndex = (game.tactic.starters || []).map(Number).indexOf(id);
  if(starterIndex >= 0) return { type:'starter', index:starterIndex, playerId:id };
  const benchIndex = (game.tactic.bench || []).map(Number).indexOf(id);
  if(benchIndex >= 0) return { type:'bench', index:benchIndex, playerId:id };
  return { type:'reserve', index:-1, playerId:id };
}
function tacticLocationLabel(location){
  if(!location) return '';
  if(location.type === 'starter') return `titular ${Number(location.index || 0) + 1}`;
  if(location.type === 'bench') return `suplente ${Number(location.index || 0) + 1}`;
  return 'reserva';
}
function targetSlotLabel(location){
  if(!location) return '';
  if(location.type === 'starter'){
    const slot = (FORMATIONS[game?.tactic?.formation] || FORMATIONS['4-4-2'])[location.index] || 'puesto';
    return `${slot} ${Number(location.index || 0) + 1}`;
  }
  return tacticLocationLabel(location);
}
function validateTacticPlacement(playerId, location){
  const id = Number(playerId || 0);
  if(!id || !location) return '';
  if(location.type === 'starter'){
    if(!canBeStarter(id)) return 'Los lesionados no pueden ser titulares. Los de recuperación menor a 70 días sólo pueden ir al banco.';
    const player = playerById(id);
    const slot = (FORMATIONS[game?.tactic?.formation] || FORMATIONS['4-4-2'])[location.index];
    if(!canAssignPlayerToSlot(player, slot)) return slot === 'POR' ? 'El puesto de portero sólo acepta porteros.' : 'Los porteros sólo pueden ocupar el puesto de portero.';
  }
  if(location.type === 'bench' && !canBeBench(id)) return 'Sólo se pueden convocar al banco jugadores disponibles o lesionados con recuperación menor a 70 días.';
  return '';
}
function setTacticPlayerAt(location, playerId){
  const id = Number(playerId || 0);
  if(location.type === 'starter'){
    while(game.tactic.starters.length < 11) game.tactic.starters.push(0);
    game.tactic.starters[location.index] = id;
  } else if(location.type === 'bench'){
    while(game.tactic.bench.length <= location.index) game.tactic.bench.push(0);
    game.tactic.bench[location.index] = id;
  }
}
function clearTacticLocation(location){
  if(!location) return;
  if(location.type === 'starter'){
    while(game.tactic.starters.length < 11) game.tactic.starters.push(0);
    game.tactic.starters[location.index] = 0;
  } else if(location.type === 'bench'){
    while(game.tactic.bench.length <= location.index) game.tactic.bench.push(0);
    game.tactic.bench[location.index] = 0;
  }
}
function removeTacticPlayer(playerId){
  const id = Number(playerId || 0);
  game.tactic.starters = (game.tactic.starters || []).map(current => Number(current) === id ? 0 : Number(current || 0)).slice(0,11);
  while(game.tactic.starters.length < 11) game.tactic.starters.push(0);
  game.tactic.bench = (game.tactic.bench || []).map(current => Number(current) === id ? 0 : Number(current || 0)).slice(0,10);
}
function cleanupTacticAfterClickSwap(){
  const starterIds = new Set((game.tactic.starters || []).map(Number).filter(Boolean));
  game.tactic.bench = (game.tactic.bench || [])
    .map(Number)
    .filter((id, index, arr) => id && !starterIds.has(id) && arr.indexOf(id) === index)
    .slice(0,10);
  game.tactic.autoSubs = (game.tactic.autoSubs || []).map(rule => ({
    ...rule,
    outId:game.tactic.starters.includes(Number(rule.outId)) ? Number(rule.outId) : 0,
    inId:game.tactic.bench.includes(Number(rule.inId)) ? Number(rule.inId) : 0
  }));
  game.tactic = applyStarterMentalities(game.tactic);
}
function swapTacticClickTargets(source, target){
  if(!game || !source || !target || !source.playerId) return false;
  game.tactic = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic));
  const sourcePlayerId = Number(source.playerId || 0);
  const targetPlayerId = Number(target.playerId || 0);
  if(sourcePlayerId && targetPlayerId && sourcePlayerId === targetPlayerId){
    tacticClickSelection = null;
    renderTactics();
    return false;
  }
  if(source.type === 'reserve' && target.type === 'reserve'){
    showNotice('Ambos jugadores ya están en reserva. Elegí un titular o suplente para intercambiarlos.');
    tacticClickSelection = null;
    renderTactics();
    return false;
  }
  const sourceCurrent = tacticLocationOfPlayer(sourcePlayerId);
  const targetCurrent = targetPlayerId ? tacticLocationOfPlayer(targetPlayerId) : target;
  const sourceError = validateTacticPlacement(sourcePlayerId, targetCurrent);
  if(sourceError){ showNotice(sourceError); return false; }
  const targetError = targetPlayerId ? validateTacticPlacement(targetPlayerId, sourceCurrent) : '';
  if(targetError){ showNotice(targetError); return false; }
  clearTacticLocation(sourceCurrent);
  clearTacticLocation(targetCurrent);
  setTacticPlayerAt(targetCurrent, sourcePlayerId);
  if(targetPlayerId) setTacticPlayerAt(sourceCurrent, targetPlayerId);
  cleanupTacticAfterClickSwap();
  saveLocal(true);
  const sourceName = playerLastName(playerById(sourcePlayerId)?.name || 'Jugador');
  const targetName = targetPlayerId ? playerLastName(playerById(targetPlayerId)?.name || 'jugador') : targetSlotLabel(targetCurrent);
  showNotice(`${sourceName} intercambió lugar con ${targetName}. Guardá la táctica para confirmar.`);
  tacticClickSelection = null;
  renderTactics();
  return true;
}
function normalizeTactic(clubId, tactic){
  const base = {...DEFAULT_TACTIC, ...(tactic || {})};
  const squad = playersByClub(clubId);
  const squadIds = new Set(squad.map(p => p.id));
  const rawStarters = Array.isArray(base.starters) ? base.starters.map(Number) : [];
  let starters = rawStarters.length >= 11
    ? rawStarters.slice(0,11).map(id => squadIds.has(id) ? id : 0)
    : autoSelectStarters(clubId, base).map(p => p.id);
  let bench = (base.bench || []).map(Number).filter(id => squadIds.has(id) && !starters.includes(id));
  if(bench.length !== 10){ bench = autoSelectBench(clubId, starters.filter(Boolean)).map(p => p.id); }
  let autoSubs = Array.isArray(base.autoSubs) ? base.autoSubs.slice(0,5) : [];
  autoSubs = autoSubs.map(rule => {
    const legacy = ['winning','losing','drawing'].includes(rule.trigger) ? 'best' : rule.trigger;
    return {
      outId: Number(rule.outId || 0),
      inId: Number(rule.inId || 0),
      trigger: SUB_TRIGGERS.some(t => t.value === legacy) ? legacy : 'tired'
    };
  }).filter(rule => starters.includes(rule.outId) && bench.includes(rule.inId));
  while(autoSubs.length < 5){ autoSubs.push({ outId:0, inId:0, trigger:'tired' }); }
  const matchInstructions = window.Simulator20?.normalizeMatchInstructions
    ? window.Simulator20.normalizeMatchInstructions(base.matchInstructions)
    : { winning:'normal', drawing:'normal', losing:'normal' };
  const normalized = { formation:base.formation, starters, bench, autoSubs, playerMentalities:{ ...(base.playerMentalities || {}) }, matchInstructions };
  return applyStarterMentalities(normalized);
}

function newGame(selectedClubId, options={}){
  const selectedClub = seed.clubs.find(c => Number(c.id) === Number(selectedClubId)) || {};
  const managerName = persistManagerName(options.managerName || storedManagerName());
  const tactic = normalizeTactic(selectedClubId, DEFAULT_TACTIC);
  game = {
    version:APP_VERSION,
    seedSignature:seed?.meta?.signature || '',
    selectedClubId,
    selectedCountry: options.country || clubCountry(selectedClub),
    selectedLeagueId: options.leagueId || selectedClub.divisionId || 'default',
    saveCode: generateSaveCode(),
    rankingUploads: {},
    rankingManagerName: managerName,
    rankingLastUploadGameDate: '',
    seasonNumber: 1,
    seasonYear: seasonYearForNumber(1),
    calendarVersion: SEASON_CALENDAR_VERSION,
    seasonFinalized: false,
    seasonTransition: null,
    seasonPhase: 'preseason',
    phaseTurn: 0,
    globalTurn: 0,
    preseasonFriendliesPlayed: 0,
    pendingFriendlyOpponentId: 0,
    clubDivisionOverrides: {},
    managerStats: createInitialManagerStats(),
    messages: [],
    marketPlayers: [],
    pendingTransfers: [],
    rejectedPurchaseOffers: {},
    lastOwnPlayerOffer: null,
    seasonEndPlayerOffers: null,
    currentDate: firstAdvanceDateForSeason(seasonYearForNumber(1)),
    matchdayIndex: 0,
    tactic,
    standings: createInitialStandings(),
    playerStats: createInitialPlayerStats(),
    playerStatus: {},
    matchHistory: [],
    fixtures: generateFixturesForDivisions(seed.clubs, divisionOrderList(), { seasonYear:seasonYearForNumber(1) }),
    advanceLockedUntil: 0,
    mustReviewTactics: false,
    lastOwnProblems: [],
    lastTurnSummary: null,
    budget: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0,
    seasonInitialBudget: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0,
    seasonBudgetStartBySeason: { 1: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0 },
    lastBudgetDelta: 0,
    budgetHistory: [],
    playerCondition: Object.fromEntries(seed.players.map(p => [p.id, 99])),
    playerMorale: Object.fromEntries(seed.players.map(p => [p.id, PLAYER_MORALE_START])),
    playerSkillBoosts: Object.fromEntries(seed.players.map(p => [p.id, {}])),
    trainingPlan: Object.fromEntries(seed.players.map(p => [p.id, DEFAULT_TRAINING_TYPE])),
    trainingSchedule: defaultTrainingSchedule(),
    staffActions: {},
    staffContracts: {},
    academy: createInitialAcademyState(),
    stadium: createInitialStadiumState(),
    sponsors: createInitialSponsorState(),
    teamCohesion: Object.fromEntries(seed.clubs.map(c => [c.id, TEAM_COHESION_START])),
    lastMatchTactics: {}
  };
  game.marketPlayers = generateMarketPlayers(MARKET_FREE_AGENT_COUNT);
  mergeMarketPlayersIntoSeed(game.marketPlayers);
  ensurePlayerStateForAll();
  repairBotRosters({ reason:'new_game' });
  generateOpeningSponsorOffers(true);
  pushGameMessage({ type:'system', title:'Bienvenido al club', body:'La temporada está por comenzar. Revisá táctica, mercado y mensajes antes del debut.', priority:'normal' });
  activeTab = 'home';
  closeModal();
  newGameModalShown = true;
  renderAll();
  showNotice('Nueva partida creada. Revisá táctica, titulares y mentalidades antes de avanzar.');
}

function createInitialStandings(){
  const obj = {};
  seed.clubs.forEach(c => obj[c.id] = { clubId:c.id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 });
  return obj;
}
function createInitialPlayerStats(){
  const obj = {};
  seed.players.forEach(p => obj[p.id] = { playerId:p.id, clubId:p.clubId, goals:0, assists:0, yellow:0, red:0, played:0, injuries:0 });
  return obj;
}

function createInitialManagerStats(){
  return { totals:{ played:0, won:0, drawn:0, lost:0, gf:0, gc:0 }, seasons:[], titles:0 };
}
function normalizeManagerStats(stats){
  const base = createInitialManagerStats();
  const src = stats || {};
  const totals = { ...base.totals, ...(src.totals || {}) };
  Object.keys(totals).forEach(key => { totals[key] = Number.isFinite(totals[key]) ? totals[key] : 0; });
  return {
    totals,
    seasons:Array.isArray(src.seasons) ? src.seasons : [],
    titles:Number.isFinite(src.titles) ? src.titles : (Array.isArray(src.seasons) ? src.seasons.filter(s => s.position === 1).length : 0)
  };
}
function updateManagerMatchStats(match){
  game.managerStats = normalizeManagerStats(game.managerStats);
  const isHome = match.homeId === game.selectedClubId;
  const gf = isHome ? match.homeGoals : match.awayGoals;
  const gc = isHome ? match.awayGoals : match.homeGoals;
  const totals = game.managerStats.totals;
  totals.played += 1;
  totals.gf += gf;
  totals.gc += gc;
  if(gf > gc) totals.won += 1;
  else if(gf < gc) totals.lost += 1;
  else totals.drawn += 1;
}
function divisionOrderList(){
  return (seed.divisions || [{ id:'default', name:'Liga única', order:1 }]).slice().sort((a,b)=>(a.order || 0)-(b.order || 0));
}
function clubDivision(clubId){
  const club = seed.clubs.find(c=>c.id===Number(clubId));
  return club ? { id:club.divisionId || 'default', name:club.divisionName || 'Liga única', order:club.divisionOrder || 1 } : { id:'default', name:'Liga única', order:1 };
}
function applyClubDivisionOverrides(overrides={}){
  if(!seed?.clubs) return;
  const divisions = divisionOrderList();
  const byId = Object.fromEntries(divisions.map(d => [d.id, d]));
  seed.clubs.forEach(club => {
    const override = overrides[club.id];
    if(!override) return;
    const division = byId[override.divisionId] || divisions.find(d => d.name === override.divisionName);
    if(!division) return;
    club.divisionId = division.id;
    club.divisionName = division.name;
    club.divisionOrder = division.order;
    club.prizeMultiplier = division.prizeMultiplier ?? divisionPrizeMultiplier(division.name, (division.order || 1)-1);
  });
}
function snapshotClubDivisionOverrides(){
  return Object.fromEntries(seed.clubs.map(c => [c.id, { divisionId:c.divisionId || 'default', divisionName:c.divisionName || 'Liga única' }]));
}
function computeSeasonMovements(){
  const divisions = divisionOrderList();
  const movements = [];
  for(let i=1; i<divisions.length; i++){
    const upper = divisions[i-1];
    const lower = divisions[i];
    const lowerTable = sortedStandings(lower.id);
    const upperTable = sortedStandings(upper.id);
    const lowerChampion = lowerTable[0];
    const upperLast = upperTable[upperTable.length - 1];
    if(lowerChampion){
      movements.push({ type:'promotion', clubId:lowerChampion.clubId, fromDivisionId:lower.id, fromDivisionName:lower.name, toDivisionId:upper.id, toDivisionName:upper.name });
    }
    if(upperLast){
      movements.push({ type:'relegation', clubId:upperLast.clubId, fromDivisionId:upper.id, fromDivisionName:upper.name, toDivisionId:lower.id, toDivisionName:lower.name });
    }
  }
  return movements;
}
function decayTrainedSkillBoosts(){
  if(!game?.playerSkillBoosts) return { players:0, lost:0, remaining:0 };
  let players = 0;
  let lost = 0;
  let remaining = 0;
  Object.entries(game.playerSkillBoosts).forEach(([playerId, boosts]) => {
    if(!boosts || typeof boosts !== 'object') return;
    let affected = false;
    Object.keys(boosts).forEach(skill => {
      const oldValue = Math.max(0, Math.round(Number(boosts[skill]) || 0));
      if(oldValue <= 0){ delete boosts[skill]; return; }
      const nextValue = Math.max(0, Math.round(oldValue * 0.40));
      lost += Math.max(0, oldValue - nextValue);
      remaining += nextValue;
      affected = true;
      if(nextValue > 0) boosts[skill] = nextValue;
      else delete boosts[skill];
    });
    if(affected) players += 1;
    if(Object.keys(boosts).length === 0) delete game.playerSkillBoosts[playerId];
  });
  return { players, lost, remaining };
}
function applySeasonalAging(){
  if(!game) return 0;
  let count = 0;
  seed.players.forEach(player => {
    player.age = Math.max(15, Number(player.age || 18) + 1);
    count += 1;
  });
  return count;
}

function applySeasonSalaryAdjustments(){
  if(!game?.playerStats || !seed?.players) return { players:0, increased:0, decreased:0, totalDelta:0, details:[] };
  let players = 0;
  let increased = 0;
  let decreased = 0;
  let totalDelta = 0;
  const details = [];
  seed.players.forEach(player => {
    if(!player || Number(player.clubId || 0) <= 0 || player.sold) return;
    const oldSalary = Math.max(0, Math.round(Number(player.salary || 0)));
    if(oldSalary <= 0) return;
    const played = Math.max(0, Math.round(Number(game.playerStats[player.id]?.played || 0)));
    const pct = (played * SEASON_SALARY_MATCH_BONUS) - SEASON_SALARY_BASE_REDUCTION;
    const nextSalary = Math.max(0, Math.round(oldSalary * (1 + pct)));
    const delta = nextSalary - oldSalary;
    player.salary = nextSalary;
    refreshPlayerClause(player);
    players += 1;
    totalDelta += delta;
    if(delta > 0) increased += 1;
    if(delta < 0) decreased += 1;
    if(Number(player.clubId) === Number(game.selectedClubId)){
      details.push({ playerId:player.id, name:player.name, played, oldSalary, nextSalary, delta, pct });
    }
  });
  return { players, increased, decreased, totalDelta, details };
}
function retireSeasonVeterans(){
  if(!game || !seed?.players) return [];
  const clubId = Number(game.selectedClubId);
  const retirees = seed.players
    .filter(player => !player.sold)
    .filter(player => {
      const age = Math.round(Number(player.age || 0));
      const retirementAge = age >= RETIREMENT_MIN_AGE && age <= RETIREMENT_MAX_AGE;
      if(!retirementAge) return false;
      const ownPlayer = Number(player.clubId) === clubId && !player.freeAgent;
      const freePlayer = Number(player.clubId || 0) === 0 || Boolean(player.freeAgent) || Boolean(player.youthFreeAgent);
      return ownPlayer || freePlayer;
    })
    .map(player => ({ id:player.id, name:player.name, age:player.age, position:player.position, salary:player.salary || 0, freeAgent:Number(player.clubId || 0) === 0 || Boolean(player.freeAgent) || Boolean(player.youthFreeAgent) }));
  if(!retirees.length) return [];
  const retiredIds = new Set(retirees.map(p => Number(p.id)));
  seed.players = seed.players.filter(player => !retiredIds.has(Number(player.id)));
  game.marketPlayers = (game.marketPlayers || []).filter(player => !retiredIds.has(Number(player.id)));
  retirees.forEach(player => {
    removePlayerFromCurrentTactic(player.id);
    delete game.playerCondition?.[player.id];
    delete game.playerMorale?.[player.id];
    delete game.playerSkillBoosts?.[player.id];
    delete game.trainingPlan?.[player.id];
    delete game.playerStats?.[player.id];
    delete game.playerStatus?.[player.id];
  });
  const ownRetirees = retirees.filter(player => !player.freeAgent);
  const freeRetirees = retirees.filter(player => player.freeAgent);
  if(ownRetirees.length){
    const names = ownRetirees.slice(0,5).map(p => `${p.name} (${p.age})`).join(', ');
    pushGameMessage({
      type:'plantel',
      priority:'normal',
      title:'Retiros al finalizar la temporada',
      body:`${ownRetirees.length === 1 ? 'Un jugador informó' : `${ownRetirees.length} jugadores informaron`} su retiro del fútbol: ${names}${ownRetirees.length > 5 ? '...' : ''}`
    });
  }
  if(freeRetirees.length){
    pushGameMessage({
      type:'mercado',
      priority:'normal',
      title:'Retiros en el mercado libre',
      body:`${freeRetirees.length} jugadores libres se retiraron al finalizar la temporada.`
    });
  }
  return retirees;
}
function nextPlayerId(){
  const ids = [0]
    .concat((seed?.players || []).map(p => Number(p.id) || 0))
    .concat((game?.marketPlayers || []).map(p => Number(p.id) || 0));
  return Math.max(...ids) + 1;
}
function currentFreeMarketPlayers(){
  return (game?.marketPlayers || []).filter(player => player && Number(player.clubId || 0) === 0 && !player.sold);
}
function removeFreeMarketPlayersById(ids=[]){
  const remove = new Set((ids || []).map(Number));
  if(!remove.size) return [];
  const removed = currentFreeMarketPlayers().filter(player => remove.has(Number(player.id)));
  game.marketPlayers = (game.marketPlayers || []).filter(player => !remove.has(Number(player.id)));
  if(seed?.players){
    seed.players = seed.players.filter(player => {
      if(!remove.has(Number(player.id))) return true;
      return !(Number(player.clubId || 0) === 0 && player.freeAgent);
    });
  }
  removed.forEach(player => {
    delete game.playerCondition?.[player.id];
    delete game.playerMorale?.[player.id];
    delete game.playerSkillBoosts?.[player.id];
    delete game.trainingPlan?.[player.id];
    delete game.playerStats?.[player.id];
    delete game.playerStatus?.[player.id];
  });
  return removed;
}
function pruneFreeAgentMarketToMax(maxCount=SEASON_FREE_AGENT_MARKET_MAX){
  if(!game || !SEASON_FREE_AGENT_CLEANUP_ENABLED || !Number.isFinite(Number(maxCount)) || Number(maxCount) <= 0) return [];
  const freePlayers = currentFreeMarketPlayers();
  const excess = freePlayers.length - Number(maxCount);
  if(excess <= 0) return [];
  const candidates = freePlayers
    .filter(player => Math.round(Number(player.age || 0)) >= RETIREMENT_MIN_AGE)
    .sort((a,b) => {
      const ageDiff = Number(b.age || 0) - Number(a.age || 0);
      if(ageDiff !== 0) return ageDiff;
      const youthWeight = Number(Boolean(a.youthFreeAgent)) - Number(Boolean(b.youthFreeAgent));
      if(youthWeight !== 0) return youthWeight;
      const mediaDiff = visibleOverall(a) - visibleOverall(b);
      if(mediaDiff !== 0) return mediaDiff;
      return Number(a.id || 0) - Number(b.id || 0);
    });
  if(!candidates.length) return [];
  return removeFreeMarketPlayersById(candidates.slice(0, excess).map(player => player.id));
}
function initializeFreePlayerState(players=[]){
  if(!game) return;
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  game.trainingPlan = game.trainingPlan || {};
  game.playerStats = game.playerStats || {};
  players.forEach(p => {
    game.playerCondition[p.id] = clamp(15 + hashNumber(`free-cond-${p.id}`, 15), 1, 29);
    game.playerMorale[p.id] = clamp(35 + hashNumber(`free-morale-${p.id}`, 55), 1, 99);
    game.playerSkillBoosts[p.id] = game.playerSkillBoosts[p.id] || {};
    game.trainingPlan[p.id] = game.trainingPlan[p.id] || DEFAULT_TRAINING_TYPE;
    game.playerStats[p.id] = game.playerStats[p.id] || { playerId:p.id, clubId:p.clubId, goals:0, assists:0, yellow:0, red:0, played:0, injuries:0 };
  });
}
function generateSeasonYouthFreeAgents(count=SEASON_YOUTH_FREE_AGENT_COUNT){
  const totalCount = Math.max(0, Math.round(Number(count) || 0));
  const activePlayers = (seed?.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
  const generationContext = createPlayerGenerationContext(activePlayers.length + totalCount, activePlayers);
  const players = [];
  let id = nextPlayerId();
  const season = Number(game?.seasonNumber || 1);
  for(let i=0;i<totalCount;i++, id++){
    const group = pickPositionGroupForGeneration(id, `season-youth-${season}`, generationContext);
    const position = pickPositionFromGroup(group, id, `season-youth-${season}`);
    const club = seed?.clubs?.length ? seed.clubs[i % seed.clubs.length] : null;
    const division = club ? clubDivision(club.id) : null;
    const ageSpan = Math.max(1, SEASON_YOUTH_FREE_AGENT_AGE_MAX - SEASON_YOUTH_FREE_AGENT_AGE_MIN + 1);
    const player = generatedPlayerFactory({
      id,
      position,
      clubId:0,
      age:SEASON_YOUTH_FREE_AGENT_AGE_MIN + hashNumber(`season-youth-age-${season}-${id}`, ageSpan),
      prestige:50,
      nameContext:`Juveniles libres ${season}`,
      divisionName:division?.name || 'Juveniles libres',
      divisionOrder:division?.order || null,
      generationContext,
      salaryFactor:FREE_YOUTH_SALARY_FACTOR,
      freeAgent:true,
      youthFreeAgent:true
    });
    player.originClubId = club?.id || 0;
    players.push(player);
  }
  return players;
}
function generateSeasonYouthFreeAgentsByClub(perClub=SEASON_YOUTH_FREE_AGENTS_PER_CLUB){
  const clubs = (seed?.clubs || []).filter(club => Number(club.id || 0) > 0);
  const total = Math.max(0, Math.round(Number(perClub || 0))) * clubs.length;
  if(total <= 0) return [];
  return generateSeasonYouthFreeAgents(total);
}
function addSeasonYouthFreeAgents(count=SEASON_YOUTH_FREE_AGENT_COUNT){
  if(!game) return [];
  const newPlayers = generateSeasonYouthFreeAgents(count);
  game.marketPlayers = (game.marketPlayers || []).concat(newPlayers);
  mergeMarketPlayersIntoSeed(newPlayers);
  initializeFreePlayerState(newPlayers);
  if(newPlayers.length){
    pushGameMessage({ type:'mercado', title:'Nuevos juveniles libres', body:`Aparecieron ${newPlayers.length} jóvenes libres de ${SEASON_YOUTH_FREE_AGENT_AGE_MIN} a ${SEASON_YOUTH_FREE_AGENT_AGE_MAX} años en el mercado.`, priority:'normal' });
  }
  return newPlayers;
}
function topUpSeasonFreeAgentsToMax(maxCount=SEASON_FREE_AGENT_MARKET_MAX){
  if(!game || !SEASON_FREE_AGENT_TOP_UP_ENABLED || !Number.isFinite(Number(maxCount)) || Number(maxCount) <= 0) return [];
  const needed = Math.max(0, Math.round(Number(maxCount)) - currentFreeMarketPlayers().length);
  if(needed <= 0) return [];
  const newPlayers = generateMarketPlayers(needed, { startId:nextPlayerId(), label:`season-market-${game.seasonNumber || 1}`, nameContext:'Mercado Libre' });
  game.marketPlayers = (game.marketPlayers || []).concat(newPlayers);
  mergeMarketPlayersIntoSeed(newPlayers);
  initializeFreePlayerState(newPlayers);
  return newPlayers;
}
function renewFreeAgentMarketForSeason(retiredCount=0){
  if(!game) return { removed:[], youth:[], regular:[] };
  pruneFreeAgentMarketToMax(SEASON_FREE_AGENT_MARKET_MAX);
  const youth = generateSeasonYouthFreeAgentsByClub(SEASON_YOUTH_FREE_AGENTS_PER_CLUB);
  game.marketPlayers = (game.marketPlayers || []).concat(youth);
  mergeMarketPlayersIntoSeed(youth);
  initializeFreePlayerState(youth);
  pruneFreeAgentMarketToMax(SEASON_FREE_AGENT_MARKET_MAX);
  const regular = topUpSeasonFreeAgentsToMax(SEASON_FREE_AGENT_MARKET_MAX);
  const finalPruned = pruneFreeAgentMarketToMax(SEASON_FREE_AGENT_MARKET_MAX);
  const legacyExtra = retiredCount > 0 && SEASON_YOUTH_FREE_AGENT_COUNT > 0 ? addSeasonYouthFreeAgents(Math.max(SEASON_YOUTH_FREE_AGENT_COUNT, retiredCount)) : [];
  if(legacyExtra.length) pruneFreeAgentMarketToMax(SEASON_FREE_AGENT_MARKET_MAX);
  const totalYouth = youth.length + legacyExtra.length;
  const totalRegular = regular.length;
  if(totalYouth || totalRegular || finalPruned.length){
    pushGameMessage({
      type:'mercado',
      title:'Mercado libre renovado',
      body:`Se incorporaron ${totalYouth} jóvenes y ${totalRegular} jugadores libres al mercado.`,
      priority:'normal'
    });
  }
  return { removed:finalPruned, youth:youth.concat(legacyExtra), regular };
}
function finalizeSeasonIfNeeded(){
  if(!game || game.seasonFinalized || game.matchdayIndex < game.fixtures.length) return;
  game.managerStats = normalizeManagerStats(game.managerStats);
  const division = clubDivision(game.selectedClubId);
  const table = sortedStandings(division.id);
  const index = table.findIndex(row => row.clubId === game.selectedClubId);
  const row = table[index] || game.standings[game.selectedClubId] || {};
  const position = index >= 0 ? index + 1 : null;
  const champion = position === 1;
  const record = {
    season:game.seasonNumber || 1,
    clubId:game.selectedClubId,
    clubName:clubName(game.selectedClubId),
    divisionId:division.id,
    divisionName:division.name,
    position,
    label:champion ? 'Campeón' : (position ? `${position}°` : '—'),
    pts:row.pts || 0,
    pg:row.pg || 0,
    pe:row.pe || 0,
    pp:row.pp || 0,
    gf:row.gf || 0,
    gc:row.gc || 0,
    title:champion
  };
  if(!game.managerStats.seasons.some(s => s.season === record.season)){
    game.managerStats.seasons.push(record);
    if(champion) game.managerStats.titles += 1;
  }
  if(champion){
    pushGameMessage({ type:'deportivo', priority:'high', title:'Has salido campeón', body:`Felicitaciones: ${clubName(game.selectedClubId)} salió campeón de ${division.name}.`, id:`champion-${game.seasonNumber || 1}-${game.selectedClubId}` });
  }
  const salariesPaid = paySeasonSalaries();
  const salaryAdjustments = applySeasonSalaryAdjustments();
  const retirements = retireSeasonVeterans();
  const trainingDecay = decayTrainedSkillBoosts();
  game.seasonTransition = {
    season:game.seasonNumber || 1,
    userRecord:record,
    movements:computeSeasonMovements(),
    salariesPaid,
    salaryAdjustments,
    retirements,
    trainingDecay,
    agingApplied: true
  };
  game.seasonFinalized = true;
  game.seasonPhase = 'finalized';
  game.seasonEndModalShown = false;
}
function applySeasonMovements(){
  const movements = game?.seasonTransition?.movements || [];
  const divisions = divisionOrderList();
  const byId = Object.fromEntries(divisions.map(d => [d.id, d]));
  movements.forEach(move => {
    const club = seed.clubs.find(c => c.id === move.clubId);
    const target = byId[move.toDivisionId];
    if(!club || !target) return;
    club.divisionId = target.id;
    club.divisionName = target.name;
    club.divisionOrder = target.order;
    club.prizeMultiplier = target.prizeMultiplier ?? divisionPrizeMultiplier(target.name, (target.order || 1)-1);
  });
  game.clubDivisionOverrides = snapshotClubDivisionOverrides();
}
function startNextSeason(selectedClubId){
  if(!game?.seasonFinalized) return;
  const retiredCount = game.seasonTransition?.retirements?.length || 0;
  applySeasonMovements();
  const aging = applySeasonalAging();
  applyAcademyAgingIfNeeded();
  refreshAllPlayerClauses();
  const nextClubId = Number(selectedClubId || game.selectedClubId);
  game.selectedClubId = nextClubId;
  game.seasonNumber = (game.seasonNumber || 1) + 1;
  game.seasonYear = seasonYearForNumber(game.seasonNumber);
  game.calendarVersion = SEASON_CALENDAR_VERSION;
  game.seasonInitialBudget = Math.max(0, Math.round(Number(game.budget || 0)));
  game.seasonBudgetStartBySeason = game.seasonBudgetStartBySeason || {};
  game.seasonBudgetStartBySeason[game.seasonNumber] = game.seasonInitialBudget;
  game.seasonFinalized = false;
  game.seasonTransition = null;
  game.seasonEndModalShown = false;
  game.seasonPhase = 'preseason';
  game.phaseTurn = 0;
  game.preseasonFriendliesPlayed = 0;
  game.pendingFriendlyOpponentId = 0;
  game.matchdayIndex = 0;
  game.fixtures = generateFixturesForDivisions(seed.clubs, divisionOrderList(), { seasonYear:game.seasonYear });
  game.currentDate = firstAdvanceDateForSeason(game.seasonYear);
  game.standings = createInitialStandings();
  game.playerStats = createInitialPlayerStats();
  game.matchHistory = [];
  game.lastOwnProblems = [];
  game.lastTurnSummary = null;
  game.mustReviewTactics = false;
  game.seasonEndPlayerOffers = null;
  game.rejectedPurchaseOffers = {};
  resetAcademySeasonState();
  resetStaffSeasonState();
  game.advanceLockedUntil = 0;
  game.lastBudgetDelta = 0;
  game.tactic = normalizeTactic(nextClubId, DEFAULT_TACTIC);
  mergeMarketPlayersIntoSeed(game.marketPlayers || []);
  renewFreeAgentMarketForSeason(retiredCount);
  ensurePlayerStateForAll();
  generateOpeningSponsorOffers(true);
  pushGameMessage({ type:'deportivo', title:`Temporada ${game.seasonNumber} iniciada`, body:`Comienza una nueva temporada con ${clubName(game.selectedClubId)}.`, priority:'normal' });
  activeTab = 'home';
  closeModal();
  saveLocal(true);
  renderAll();
  showNotice(`Temporada ${game.seasonNumber} iniciada.`);
}
function seasonEndPanelMarkup(){
  const record = game?.seasonTransition?.userRecord;
  const movements = game?.seasonTransition?.movements || [];
  const retirements = game?.seasonTransition?.retirements || [];
  const salaryAdjustments = game?.seasonTransition?.salaryAdjustments || null;
  const moveRows = movements.map(move => `<li><strong>${escapeHtml(clubName(move.clubId))}</strong>: ${move.type === 'promotion' ? 'asciende' : 'desciende'} a ${escapeHtml(move.toDivisionName)}</li>`).join('');
  const retirementRows = retirements.map(p => `<li><strong>${escapeHtml(p.name)}</strong> se retiró del fútbol a los ${p.age} años.</li>`).join('');
  return `<div class="card season-end-card">
    <div class="row"><div><p class="label">Fin de temporada</p><h3>${record?.title ? 'Campeón' : `Posición final: ${escapeHtml(record?.label || '—')}`}</h3></div><span class="pill">Temporada ${game.seasonNumber || 1}</span></div>
    <p class="muted">Podés seguir en ${escapeHtml(clubName(game.selectedClubId))} o elegir otro club para la próxima temporada.</p>
    ${game.seasonTransition?.salariesPaid ? `<p class="tagline">Pago anual de sueldos descontado: <strong>${formatMoney(game.seasonTransition.salariesPaid)}</strong>.</p>` : ''}
    ${salaryAdjustments ? `<p class="tagline">Sueldos ajustados para la próxima temporada según partidos jugados: ${salaryAdjustments.increased || 0} suben, ${salaryAdjustments.decreased || 0} bajan.</p>` : ''}
    ${retirementRows ? `<ul class="season-movement-list">${retirementRows}</ul>` : ''}
    ${moveRows ? `<ul class="season-movement-list">${moveRows}</ul>` : ''}
    <div class="row" style="margin-top:12px"><button class="primary" data-continue-season>Seguir en este club</button><button class="ghost" data-open-season-modal>Cambiar club</button></div>
  </div>`;
}
function openSeasonEndModal(){
  if(!game?.seasonFinalized) return;
  const record = game.seasonTransition?.userRecord;
  const body = `<div class="season-end-modal">
    <p class="label">Fin de temporada ${game.seasonNumber || 1}</p>
    <h2>${record?.title ? 'Saliste campeón' : `Finalizaste ${escapeHtml(record?.label || '—')}`}</h2>
    <p class="muted">Elegí cómo continuar la próxima temporada.</p>
    <div class="row" style="margin-top:14px"><button id="btnContinueSameClub" class="primary">Seguir en ${escapeHtml(clubName(game.selectedClubId))}</button></div>
    <hr>
    <label for="seasonClubSelect">Cambiar de club</label>
    <select id="seasonClubSelect">${clubSelectOptionsMarkup()}</select>
    <div class="row" style="margin-top:12px"><button id="btnStartNextSeasonOther" class="ghost">Empezar nueva temporada con este club</button></div>
  </div>`;
  openModal(body);
  $('btnContinueSameClub')?.addEventListener('click', () => startNextSeason(game.selectedClubId));
  $('btnStartNextSeasonOther')?.addEventListener('click', () => startNextSeason(Number($('seasonClubSelect')?.value || game.selectedClubId)));
}

