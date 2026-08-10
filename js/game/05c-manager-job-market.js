/* V8.08 · Mercado laboral y continuidad de carrera. Extraído de 05-state-season.js sin alterar el orden lógico original. */

function prepareManagerWithoutClubUi(){
  try{
    if(typeof forceCloseModal === 'function') forceCloseModal();
    else if(typeof closeModal === 'function') closeModal();
  }catch(error){}
  if(typeof stopAdvanceAutoClicker === 'function') stopAdvanceAutoClicker();
  if(typeof closeAutoAdvanceOverlay === 'function') closeAutoAdvanceOverlay();
  window.__liveMatchCloseLocked = false;
  activeTab = 'home';
  if(game?.gameOver?.active && typeof ensureManagerJobMarketState === 'function'){
    const state = ensureManagerJobMarketState();
    if(!state.nextIncomingOfferDate && typeof managerJobScheduleNextIncomingOffer === 'function') managerJobScheduleNextIncomingOffer(currentCalendarDate?.() || game.currentDate || '');
  }
}
function managerClubCareerEligible(clubOrId){
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(c => Number(c.id) === Number(clubOrId));
  if(!club) return false;
  if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(club)) return false;
  const divisionId = String(club.divisionId || '').trim();
  if(!divisionId) return false;
  return (seed?.divisions || []).some(division => String(division?.id || '') === divisionId);
}
function managerCanSelectClub(clubOrId, prestige=currentManagerPrestige(), options={}){
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(c => Number(c.id) === Number(clubOrId));
  if(!managerClubCareerEligible(club)) return false;
  if(options.ignoreRehireBlock !== true && managerClubRehireBlockInfo(club).blocked) return false;
  if(options.ignoreApplicationRejectionBlock !== true && typeof managerJobClubBlockedByRejectedApplication === 'function' && managerJobClubBlockedByRejectedApplication(club)) return false;
  const clubPrestige = clubPrestigeValue(club);
  const managerPrestige = managerClubAccessPrestige(prestige);
  if(clubPrestige <= MANAGER_CLUB_OPEN_PRESTIGE) return true;
  return clubPrestige <= managerPrestige;
}
function clubAvailabilityLabel(clubOrId, prestige=currentManagerPrestige()){
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(c => Number(c.id) === Number(clubOrId));
  if(!club) return 'No disponible';
  const applicationBlockLabel = typeof managerJobRejectedApplicationBlockLabel === 'function' ? managerJobRejectedApplicationBlockLabel(club) : '';
  if(applicationBlockLabel) return applicationBlockLabel;
  const blockLabel = managerClubRehireBlockLabel(club);
  if(blockLabel) return blockLabel;
  const clubPrestige = clubPrestigeValue(club);
  if(managerCanSelectClub(club, prestige)) return 'Disponible';
  return `Requiere prestigio ${clubPrestige}`;
}
function clubSelectOptionsMarkup(){
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const prestige = currentManagerPrestige();
  return divisions.map(division => {
    const clubs = seed.clubs.filter(c => (c.divisionId || 'default') === division.id);
    if(!clubs.length) return '';
    return `<optgroup label="${escapeHtml(division.name)}">${clubs.map(c => {
      const available = managerCanSelectClub(c, prestige);
      const label = `${c.name} · Prestigio ${clubPrestigeValue(c)}${available ? '' : ' · No disponible'}`;
      return `<option value="${c.id}" ${available ? '' : 'disabled'}>${escapeHtml(label)}</option>`;
    }).join('')}</optgroup>`;
  }).join('');
}

function clubCountry(club){
  return String(club?.country || club?.pais || club?.countryName || 'Argentina').trim() || 'Argentina';
}
function availableCountries(){
  const names = Array.from(new Set((seed?.clubs || []).filter(managerClubCareerEligible).map(clubCountry).filter(Boolean)));
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
    .filter(club => managerClubCareerEligible(club) && clubCountry(club) === cleanCountry)
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
    .filter(club => managerClubCareerEligible(club) && clubCountry(club) === cleanCountry && (club.divisionId || 'default') === currentLeague)
    .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'es',{sensitivity:'base'}));
}
function teamOptionsMarkup(country='Argentina', leagueId='', selectedClubId=0){
  const clubs = clubsByCountryLeague(country, leagueId);
  const prestige = currentManagerPrestige();
  const firstAvailable = clubs.find(club => managerCanSelectClub(club, prestige)) || clubs[0];
  const selected = clubs.some(club => Number(club.id) === Number(selectedClubId) && managerCanSelectClub(club, prestige)) ? Number(selectedClubId) : Number(firstAvailable?.id || 0);
  return clubs.map(club => {
    const available = managerCanSelectClub(club, prestige);
    const status = clubAvailabilityLabel(club, prestige);
    const label = `${club.name} · Prestigio ${clubPrestigeValue(club)} · ${status}`;
    return `<option value="${club.id}" ${Number(club.id)===selected?'selected':''} ${available ? '' : 'disabled'}>${escapeHtml(label)}</option>`;
  }).join('');
}
function teamOptionsMarkupAll(country='Argentina', leagueId='', selectedClubId=0, statusLabel='Libre'){
  const clubs = clubsByCountryLeague(country, leagueId);
  const selected = clubs.some(club => Number(club.id) === Number(selectedClubId)) ? Number(selectedClubId) : Number(clubs[0]?.id || 0);
  return clubs.map(club => {
    const label = `${club.name} · Prestigio ${clubPrestigeValue(club)} · ${statusLabel}`;
    return `<option value="${club.id}" ${Number(club.id)===selected?'selected':''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function managerAvailableClubPool(prestige=currentManagerPrestige()){
  return (seed?.clubs || [])
    .filter(club => managerCanSelectClub(club, prestige))
    .sort((a,b)=>String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' }));
}
function managerAvailableClubSample(limit=8, seedSuffix=''){
  const pool = managerAvailableClubPool(currentManagerPrestige());
  const keyBase = `club-options-${currentManagerPrestige()}-${game?.seasonNumber || 0}-${game?.globalTurn || 0}-${seedSuffix}`;
  return pool
    .map((club,index)=>({ club, score:hashNumber(`${keyBase}-${club.id}-${index}`, 1000000) }))
    .sort((a,b)=>a.score-b.score || String(a.club.name || '').localeCompare(String(b.club.name || ''),'es',{sensitivity:'base'}))
    .slice(0, Math.max(1, Math.min(Number(limit || 8), 8)))
    .map(item=>item.club);
}
function managerAvailableClubCard(club, options={}){
  if(!club) return '';
  const division = clubDivision(club.id);
  const budget = formatMoney(Number(club?.budget || game?.clubBudgets?.[club.id] || 0));
  const supporters = typeof clubFansBase === 'function'
    ? clubFansBase(club.id)
    : Math.max(0, Math.round(Number(club?.fansBase || club?.fansInitial || club?.supporters || 0)));
  const actionAttr = options.selectable ? ` data-select-job-club="${Number(club.id)}"` : ` data-open-job-club="${Number(club.id)}"`;
  const actionLabel = options.selectable ? 'Seleccionar' : 'Ver opción';
  return `<button type="button" class="card available-club-card"${actionAttr}>
    <div class="available-club-head"><span class="available-club-badge">${clubBadge(club.id) || '▣'}</span><strong>${escapeHtml(club.name || 'Club')}</strong></div>
    <p class="muted small">${escapeHtml(division?.name || club.divisionId || 'Liga')} · ${escapeHtml(clubCountry(club))}</p>
    <div class="available-club-meta"><span>Prestigio ${clubPrestigeValue(club)}</span><span>${budget}</span><span>${formatPlainNumber(supporters)} hinchas</span></div>
    <small>${actionLabel}</small>
  </button>`;
}
function managerAvailableClubsPanelMarkup(options={}){
  const clubs = managerAvailableClubSample(8, options.context || 'general');
  const prestigeLabel = typeof formatManagerPrestige === 'function' ? formatManagerPrestige(currentManagerPrestige()) : String(currentManagerPrestige());
  if(!clubs.length){
    return `<aside class="card available-clubs-panel"><p class="label">Clubes disponibles</p><h3>Sin opciones</h3><p class="muted small">No hay clubes disponibles con tu prestigio actual (${escapeHtml(prestigeLabel)}).</p></aside>`;
  }
  return `<aside class="card available-clubs-panel">
    <p class="label">Clubes disponibles</p>
    <h3>Opciones para tu prestigio</h3>
    <p class="muted small">Muestra aleatoria de hasta 8 equipos que aceptarían tu contrato con prestigio ${escapeHtml(prestigeLabel)}.</p>
    <div class="available-clubs-grid">${clubs.map(club => managerAvailableClubCard(club, options)).join('')}</div>
  </aside>`;
}


function normalizeManagerJobMarketState(state={}){
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const normalizeOffer = offer => {
    const clubId = Number(offer?.clubId || 0);
    const club = seed?.clubs?.find(item => Number(item.id) === clubId);
    if(!clubId || !managerClubCareerEligible(club)) return null;
    const createdDate = validIsoDate(offer?.createdDate) ? offer.createdDate : (game?.currentDate || currentCalendarDate?.() || '');
    const expiresDate = validIsoDate(offer?.expiresDate) ? offer.expiresDate : addDaysToIsoDate(createdDate, 20);
    return {
      id:String(offer?.id || `job-offer-${clubId}-${createdDate}-${hashNumber(`${clubId}-${createdDate}`, 99999)}`),
      clubId,
      source:String(offer?.source || 'incoming'),
      contractType:String(offer?.contractType || 'normal'),
      createdDate,
      expiresDate,
      managerPrestigeAtOffer:Math.max(0, Math.round(Number(offer?.managerPrestigeAtOffer ?? currentManagerPrestige()))),
      objectiveBonus:Number.isFinite(Number(offer?.objectiveBonus)) ? Number(offer.objectiveBonus) : (String(offer?.contractType || '') === 'high_risk' ? 0.25 : 0),
      transferBudgetRate:Number.isFinite(Number(offer?.transferBudgetRate)) ? Number(offer.transferBudgetRate) : (String(offer?.contractType || '') === 'high_risk' ? 0.05 : null),
      rejectionChance:Number.isFinite(Number(offer?.rejectionChance)) ? clamp(Number(offer.rejectionChance), 1, 95) : 1,
      salaryOfferFactor:Number.isFinite(Number(offer?.salaryOfferFactor)) ? clamp(Number(offer.salaryOfferFactor), 0.40, 1.50) : null,
      futureSalePercent:Number.isFinite(Number(offer?.futureSalePercent)) ? clamp(Math.round(Number(offer.futureSalePercent)), 0, 100) : null,
      tablePosition:Math.max(0, Math.round(Number(offer?.tablePosition || 0))),
      tableSize:Math.max(0, Math.round(Number(offer?.tableSize || 0))),
      tableRatio:Number.isFinite(Number(offer?.tableRatio)) ? clamp(Number(offer.tableRatio), 0, 1) : null,
      unemploymentDays:Math.max(0, Math.round(Number(offer?.unemploymentDays || 0))),
      note:String(offer?.note || '')
    };
  };
  const normalizeApplication = app => {
    const clubId = Number(app?.clubId || 0);
    const club = seed?.clubs?.find(item => Number(item.id) === clubId);
    if(!clubId || !managerClubCareerEligible(club)) return null;
    const requestedDate = validIsoDate(app?.requestedDate) ? app.requestedDate : (game?.currentDate || currentCalendarDate?.() || '');
    return {
      id:String(app?.id || `job-app-${clubId}-${requestedDate}-${hashNumber(`${clubId}-${requestedDate}`, 99999)}`),
      clubId,
      requestedDate,
      responseDate:validIsoDate(app?.responseDate) ? app.responseDate : addDaysToIsoDate(requestedDate, 3),
      managerPrestigeAtRequest:Math.max(0, Math.round(Number(app?.managerPrestigeAtRequest ?? currentManagerPrestige()))),
      rejectionChance:Number.isFinite(Number(app?.rejectionChance)) ? clamp(Number(app.rejectionChance), 1, 95) : 1,
      status:String(app?.status || 'pending')
    };
  };
  const blockedBySeason = {};
  const rawBlockedBySeason = src.applicationRejectedClubIdsBySeason && typeof src.applicationRejectedClubIdsBySeason === 'object' && !Array.isArray(src.applicationRejectedClubIdsBySeason)
    ? src.applicationRejectedClubIdsBySeason
    : {};
  Object.entries(rawBlockedBySeason).forEach(([seasonKey, clubIds]) => {
    const season = Math.max(1, Math.round(Number(seasonKey || 0)));
    if(!season || !Array.isArray(clubIds)) return;
    const cleanIds = Array.from(new Set(clubIds.map(Number).filter(clubId => clubId > 0 && managerClubCareerEligible(clubId))));
    if(cleanIds.length) blockedBySeason[String(season)] = cleanIds.slice(-80);
  });
  return {
    offers:(Array.isArray(src.offers) ? src.offers : []).map(normalizeOffer).filter(Boolean).slice(-12),
    applications:(Array.isArray(src.applications) ? src.applications : []).map(normalizeApplication).filter(Boolean).slice(-12),
    applicationRejectedClubIdsBySeason:blockedBySeason,
    nextIncomingOfferDate:validIsoDate(src.nextIncomingOfferDate) ? src.nextIncomingOfferDate : null,
    lastProcessedDate:validIsoDate(src.lastProcessedDate) ? src.lastProcessedDate : null,
    unemployedSinceDate:validIsoDate(src.unemployedSinceDate) ? src.unemployedSinceDate : null,
    unemployedSinceTurn:Math.max(0, Math.round(Number(src.unemployedSinceTurn || 0))),
    unemploymentKey:String(src.unemploymentKey || ''),
    log:Array.isArray(src.log) ? src.log.slice(-25) : []
  };
}
function managerJobApplicationRejectedClubIds(season=game?.seasonNumber || 1, state=game){
  const market = state?.managerJobMarket && typeof state.managerJobMarket === 'object' ? state.managerJobMarket : {};
  const map = market.applicationRejectedClubIdsBySeason && typeof market.applicationRejectedClubIdsBySeason === 'object' && !Array.isArray(market.applicationRejectedClubIdsBySeason)
    ? market.applicationRejectedClubIdsBySeason
    : {};
  return new Set((Array.isArray(map[String(Math.max(1, Math.round(Number(season || 1))))]) ? map[String(Math.max(1, Math.round(Number(season || 1))))] : []).map(Number).filter(Number.isFinite));
}
function managerJobClubBlockedByRejectedApplication(clubOrId, season=game?.seasonNumber || 1, state=game){
  const clubId = Number(typeof clubOrId === 'object' ? clubOrId?.id : clubOrId);
  return clubId > 0 && managerJobApplicationRejectedClubIds(season, state).has(clubId);
}
function managerJobRejectedApplicationBlockLabel(clubOrId, season=game?.seasonNumber || 1){
  if(!managerJobClubBlockedByRejectedApplication(clubOrId, season)) return '';
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(item => Number(item.id) === Number(clubOrId));
  return `${club?.name || 'El club'} rechazó tu solicitud y queda bloqueado hasta la próxima temporada.`;
}
function managerJobBlockClubAfterApplicationRejection(clubOrId, season=game?.seasonNumber || 1){
  const clubId = Number(typeof clubOrId === 'object' ? clubOrId?.id : clubOrId);
  if(!clubId || !game) return false;
  const state = game.managerJobMarket && typeof game.managerJobMarket === 'object' && !Array.isArray(game.managerJobMarket)
    ? game.managerJobMarket
    : ensureManagerJobMarketState();
  const seasonKey = String(Math.max(1, Math.round(Number(season || game.seasonNumber || 1))));
  const map = state.applicationRejectedClubIdsBySeason && typeof state.applicationRejectedClubIdsBySeason === 'object' && !Array.isArray(state.applicationRejectedClubIdsBySeason)
    ? state.applicationRejectedClubIdsBySeason
    : {};
  const ids = new Set((Array.isArray(map[seasonKey]) ? map[seasonKey] : []).map(Number).filter(Number.isFinite));
  const before = ids.size;
  ids.add(clubId);
  map[seasonKey] = Array.from(ids).slice(-80);
  const currentSeason = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  Object.keys(map).forEach(key => {
    const mappedSeason = Math.round(Number(key || 0));
    if(!mappedSeason || mappedSeason < currentSeason - 2) delete map[key];
  });
  state.applicationRejectedClubIdsBySeason = map;
  state.applications = (state.applications || []).filter(app => Number(app.clubId) !== clubId || String(app.status || 'pending') !== 'pending');
  state.offers = (state.offers || []).filter(offer => Number(offer.clubId) !== clubId);
  state.log.push({ type:'application_rejected_block', clubId, season:Number(seasonKey), date:typeof currentCalendarDate === 'function' ? currentCalendarDate() : (game.currentDate || '') });
  state.log = state.log.slice(-25);
  return ids.size !== before;
}
function ensureManagerJobMarketState(){
  if(!game) return normalizeManagerJobMarketState({});
  game.managerJobMarket = normalizeManagerJobMarketState(game.managerJobMarket || {});
  if(game.gameOver?.active){
    const key = String(game.gameOver.triggeredAt || `${game.gameOver.type || 'without_club'}-${game.seasonNumber || 1}-${game.globalTurn || 0}`);
    if(game.managerJobMarket.unemploymentKey !== key){
      game.managerJobMarket.offers = [];
      game.managerJobMarket.applications = [];
      game.managerJobMarket.nextIncomingOfferDate = null;
      game.managerJobMarket.lastProcessedDate = null;
      game.managerJobMarket.unemployedSinceDate = typeof currentCalendarDate === 'function' ? currentCalendarDate() : (game.currentDate || null);
      game.managerJobMarket.unemployedSinceTurn = Math.max(0, Math.round(Number(game.globalTurn || 0)));
      game.managerJobMarket.unemploymentKey = key;
      game.managerJobMarket.log.push({ type:'unemployment_start', date:game.managerJobMarket.unemployedSinceDate || '', reason:String(game.gameOver.type || '') });
      game.managerJobMarket.log = game.managerJobMarket.log.slice(-25);
    }
  }
  return game.managerJobMarket;
}
function managerJobRealismConfig(){
  const cfg = window.GAME_BALANCE_MANAGER?.contratosManager?.mercadoLaboralRealista;
  return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
}
function managerJobUnemployedDays(state=game){
  const market = state?.managerJobMarket && typeof state.managerJobMarket === 'object' ? state.managerJobMarket : {};
  const today = typeof currentCalendarDate === 'function' ? currentCalendarDate() : (state?.currentDate || '');
  if(typeof validIsoDate === 'function' && validIsoDate(market.unemployedSinceDate) && validIsoDate(today)) return Math.max(0, daysBetweenIsoDates(market.unemployedSinceDate, today));
  const currentTurn = Math.max(0, Math.round(Number(state?.globalTurn || 0)));
  return Math.max(0, currentTurn - Math.max(0, Number(market.unemployedSinceTurn || 0)));
}
function managerJobClubStandingProfile(clubOrId){
  const club = typeof clubOrId === 'object' ? clubOrId : seed?.clubs?.find(item => Number(item.id) === Number(clubOrId));
  if(!club) return { position:0, total:0, ratio:0.5, lowZone:false };
  const division = typeof clubDivision === 'function' ? clubDivision(club.id) : seed?.divisions?.find(item => String(item.id || '') === String(club.divisionId || ''));
  let table = [];
  try{ table = typeof sortedStandings === 'function' && division?.id ? sortedStandings(division.id) : []; }catch(error){ table = []; }
  const divisionClubs = (seed?.clubs || []).filter(item => String(item.divisionId || '') === String(club.divisionId || ''));
  const total = Math.max(1, table.length || divisionClubs.length || 1);
  let index = table.findIndex(row => Number(row.clubId || row.id || 0) === Number(club.id));
  if(index < 0){
    const fallback = divisionClubs.slice().sort((a,b) => clubPrestigeValue(b) - clubPrestigeValue(a) || Number(a.id || 0) - Number(b.id || 0));
    index = fallback.findIndex(item => Number(item.id) === Number(club.id));
  }
  if(index < 0) index = Math.floor((total - 1) / 2);
  const ratio = total <= 1 ? 0.5 : clamp(index / (total - 1), 0, 1);
  const threshold = clamp(Number(managerJobRealismConfig().zonaBajaDesde ?? 0.55), 0, 1);
  return { position:index + 1, total, ratio, lowZone:ratio >= threshold };
}
function managerJobScheduleNextIncomingOffer(fromDate=currentCalendarDate()){
  if(!game?.gameOver?.active) return null;
  const state = ensureManagerJobMarketState();
  const base = validIsoDate(fromDate) ? fromDate : currentCalendarDate();
  const offset = 3 + hashNumber(`job-offer-wait-${game.saveCode || ''}-${game.seasonNumber || 1}-${game.globalTurn || 0}-${base}`, 5);
  state.nextIncomingOfferDate = addDaysToIsoDate(base, offset);
  return state.nextIncomingOfferDate;
}
function managerJobAvailableOfferCandidates(){
  const prestige = currentManagerPrestige();
  const eligible = (seed?.clubs || [])
    .filter(club => Number(club.id) !== Number(game?.selectedClubId || 0))
    .filter(club => managerCanSelectClub(club, prestige))
    .filter(club => !managerClubRehireBlockInfo(club).blocked)
    .filter(club => !managerJobClubBlockedByRejectedApplication(club));
  const lowZone = eligible.filter(club => managerJobClubStandingProfile(club).lowZone);
  const pool = lowZone.length ? lowZone : eligible
    .slice()
    .sort((a,b) => managerJobClubStandingProfile(b).ratio - managerJobClubStandingProfile(a).ratio || clubPrestigeValue(a) - clubPrestigeValue(b))
    .slice(0, Math.max(1, Math.ceil(eligible.length * 0.40)));
  return pool.sort((a,b) => managerJobClubStandingProfile(b).ratio - managerJobClubStandingProfile(a).ratio || clubPrestigeValue(a) - clubPrestigeValue(b) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' }));
}
function managerJobApplicationCandidates(limit=8){
  const prestige = managerClubAccessPrestige(currentManagerPrestige());
  const state = ensureManagerJobMarketState();
  const busy = new Set([
    ...state.offers.map(o => Number(o.clubId || 0)),
    ...state.applications.filter(a => a.status === 'pending').map(a => Number(a.clubId || 0))
  ]);
  const pool = (seed?.clubs || [])
    .filter(managerClubCareerEligible)
    .filter(club => Number(club.id) !== Number(game?.selectedClubId || 0))
    .filter(club => !busy.has(Number(club.id)))
    .filter(club => !managerClubRehireBlockInfo(club).blocked)
    .filter(club => !managerJobClubBlockedByRejectedApplication(club))
    .filter(club => {
      const cp = clubPrestigeValue(club);
      return cp > prestige && cp <= prestige + 20;
    });
  const keyBase = `job-app-options-${game?.saveCode || ''}-${game?.seasonNumber || 1}-${game?.globalTurn || 0}-${prestige}`;
  return pool
    .map((club,index)=>({ club, score:hashNumber(`${keyBase}-${club.id}-${index}`, 1000000) }))
    .sort((a,b)=>a.score-b.score || clubPrestigeValue(a.club)-clubPrestigeValue(b.club))
    .slice(0, Math.max(1, Math.min(8, Number(limit || 8))))
    .map(item=>item.club);
}
function managerJobCreateOffer(clubId, options={}){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  if(!managerClubCareerEligible(club) || (!game?.gameOver?.active && options.allowWhileEmployed !== true)) return null;
  const state = ensureManagerJobMarketState();
  if(managerJobClubBlockedByRejectedApplication(club)) return null;
  if(state.offers.some(o => Number(o.clubId) === Number(club.id))) return null;
  const today = currentCalendarDate();
  const contractType = String(options.contractType || 'normal');
  const offer = {
    id:`job-offer-${club.id}-${today}-${Date.now()}-${hashNumber(`${club.id}-${today}-${contractType}`, 9999)}`,
    clubId:Number(club.id),
    source:String(options.source || 'incoming'),
    contractType,
    createdDate:today,
    expiresDate:addDaysToIsoDate(today, clamp(Math.round(Number(options.responseDays || 20)), 10, 30)),
    managerPrestigeAtOffer:currentManagerPrestige(),
    objectiveBonus:contractType === 'high_risk' ? Number(options.objectiveBonus ?? 0.25) : 0,
    transferBudgetRate:contractType === 'high_risk' ? Number(options.transferBudgetRate ?? 0.05) : null,
    rejectionChance:Number.isFinite(Number(options.rejectionChance)) ? clamp(Number(options.rejectionChance), 1, 95) : 1,
    note:String(options.note || '')
  };
  state.offers.push(offer);
  state.log.push({ type:'offer', clubId:offer.clubId, contractType, date:today, source:offer.source });
  return offer;
}
function managerJobIncomingOfferClub(){
  const candidates = managerJobAvailableOfferCandidates();
  if(!candidates.length) return null;
  const prestige = currentManagerPrestige();
  const weighted = candidates.map(club => {
    const cp = clubPrestigeValue(club);
    const standing = managerJobClubStandingProfile(club);
    const closeness = Math.max(1, 25 - Math.abs(cp - prestige));
    const smallClub = 1 + ((99 - cp) / 99);
    const tableNeed = 1 + (standing.ratio * 2.5);
    const jitter = 0.85 + (hashNumber(`job-incoming-${game?.saveCode || ''}-${game?.globalTurn || 0}-${club.id}`, 31) / 100);
    return { club, weight:closeness * smallClub * tableNeed * jitter };
  });
  const total = weighted.reduce((sum,item)=>sum + item.weight, 0);
  let pick = hashNumber(`job-incoming-pick-${game?.saveCode || ''}-${game?.globalTurn || 0}-${currentCalendarDate()}`, Math.max(1, Math.round(total * 1000))) / 1000;
  for(const item of weighted){ pick -= item.weight; if(pick <= 0) return item.club; }
  return weighted[0]?.club || null;
}
function processManagerJobMarketDaily(){
  if(!game?.gameOver?.active) return { offers:0, expired:0, applications:0 };
  const state = ensureManagerJobMarketState();
  const today = currentCalendarDate();
  let expired = 0;
  const before = state.offers.length;
  state.offers = state.offers.filter(offer => {
    if(validIsoDate(offer.expiresDate) && daysBetweenIsoDates(offer.expiresDate, today) > 0){
      expired += 1;
      return false;
    }
    return true;
  });
  if(expired){
    pushGameMessage({ type:'directiva', priority:'normal', title:expired === 1 ? 'Un club retiró su propuesta' : 'Los clubes retiraron sus propuestas', body:expired === 1 ? 'Un club retiró su propuesta para contratarte después de no recibir una respuesta dentro del plazo.' : `${expired} clubes retiraron sus propuestas para contratarte después de no recibir una respuesta dentro del plazo.`, id:`job-offers-expired-${today}-${game.globalTurn || 0}` });
  }
  let applicationResponses = 0;
  const remainingApplications = [];
  state.applications.forEach(app => {
    if(app.status !== 'pending'){ remainingApplications.push(app); return; }
    if(!validIsoDate(app.responseDate) || daysBetweenIsoDates(app.responseDate, today) < 0){ remainingApplications.push(app); return; }
    applicationResponses += 1;
    const club = seed.clubs.find(c => Number(c.id) === Number(app.clubId));
    if(!club) return;
    const managerPrestige = currentManagerPrestige();
    const clubPrestige = clubPrestigeValue(club);
    const diff = clubPrestige - managerClubAccessPrestige(managerPrestige);
    const rejection = managerJobApplicationRejected(app, club);
    if(rejection.rejected){
      managerJobBlockClubAfterApplicationRejection(club, game?.seasonNumber || 1);
      pushGameMessage({ type:'directiva', priority:'normal', title:'Solicitud rechazada', body:`${club.name} rechazó tu solicitud para asumir como manager. El club queda bloqueado hasta la próxima temporada.`, id:`job-application-random-rejected-${club.id}-${today}` });
    }else if(managerCanSelectClub(club, managerPrestige, { ignoreRehireBlock:false })){
      managerJobCreateOffer(club.id, { source:'application', contractType:'normal', note:'Solicitud aceptada con condiciones normales.', rejectionChance:rejection.chance });
      pushGameMessage({ type:'directiva', priority:'high', title:'Solicitud aceptada', body:`${club.name} respondió tu solicitud y te ofrece un contrato normal. Tenés 20 días para aceptar.`, id:`job-application-accepted-${club.id}-${today}` });
    }else if(diff > 0 && diff <= (typeof managerCareerApplicationMargin === 'function' ? managerCareerApplicationMargin() : 8)){
      managerJobCreateOffer(club.id, { source:'application', contractType:'high_risk', note:'Contrato exigente por diferencia de prestigio.', rejectionChance:rejection.chance });
      pushGameMessage({ type:'directiva', priority:'high', title:'Solicitud en evaluación aceptada', body:`${club.name} analiza tu perfil pese a la diferencia de prestigio. Te ofrece contrato con objetivo superior al normal y una restricción de fichajes muy alta. Tenés 20 días para aceptar.`, id:`job-application-risk-${club.id}-${today}` });
    }else{
      managerJobBlockClubAfterApplicationRejection(club, game?.seasonNumber || 1);
      pushGameMessage({ type:'directiva', priority:'normal', title:'Solicitud rechazada', body:`${club.name} respondió que la diferencia de reputación todavía es demasiado grande para ofrecerte el cargo. El club queda bloqueado hasta la próxima temporada.`, id:`job-application-rejected-${club.id}-${today}` });
    }
  });
  state.applications = remainingApplications.slice(-12);
  let offers = 0;
  if(!state.nextIncomingOfferDate) managerJobScheduleNextIncomingOffer(today);
  const hasIncomingOffer = state.offers.some(offer => offer.source === 'incoming');
  if(!hasIncomingOffer && state.nextIncomingOfferDate && daysBetweenIsoDates(state.nextIncomingOfferDate, today) >= 0){
    const club = managerJobIncomingOfferClub();
    if(club){
      managerJobCreateOffer(club.id, { source:'incoming', contractType:'normal', note:'Oferta enviada por el club.' });
      offers += 1;
      pushGameMessage({ type:'directiva', priority:'high', title:'Oferta para dirigir', body:`${club.name} quiere contratarte como manager. Tenés 20 días para responder antes de que la oferta desaparezca.`, id:`job-offer-incoming-${club.id}-${today}` });
      managerJobScheduleNextIncomingOffer(today);
    }else{
      managerJobScheduleNextIncomingOffer(today);
    }
  }
  state.lastProcessedDate = today;
  return { offers, expired, applications:applicationResponses, previousOffers:before };
}

function managerJobApplicationRejectionChance(club, managerPrestige=currentManagerPrestige()){
  const diff = Math.max(1, clubPrestigeValue(club) - managerClubAccessPrestige(managerPrestige));
  const margin = typeof managerCareerApplicationMargin === 'function' ? managerCareerApplicationMargin() : 8;
  return clamp(Math.round(12 + (diff / Math.max(1, margin)) * 68), 8, 92);
}
function managerJobApplicationRejected(app, club){
  const chance = Number.isFinite(Number(app?.rejectionChance)) ? clamp(Number(app.rejectionChance), 1, 95) : managerJobApplicationRejectionChance(club, app?.managerPrestigeAtRequest ?? currentManagerPrestige());
  const roll = hashNumber(`job-app-reject-${app?.id || ''}-${club?.id || 0}-${app?.responseDate || currentCalendarDate()}`, 10000) / 100;
  return { rejected: roll < chance, chance, roll };
}
function managerJobOfferObjectiveDetails(offer, clubId=offer?.clubId){
  const base = Number(managerObjectiveForClubDivision(clubId));
  const highRisk = String(offer?.contractType || '') === 'high_risk';
  const bonus = highRisk ? Number(offer?.objectiveBonus || 0.25) : 0;
  const finalObjective = Number.isFinite(base) ? Number(Math.min(2.75, base + bonus).toFixed(2)) : null;
  const baseLabel = Number.isFinite(base) ? Number(base).toFixed(2) : '—';
  const finalLabel = Number.isFinite(finalObjective) ? Number(finalObjective).toFixed(2) : '—';
  const objectiveText = highRisk
    ? `Objetivo: ${finalLabel} pts/partido. Normal estimado ${baseLabel} + exigencia ${Number(bonus).toFixed(2)}.`
    : `Objetivo: ${baseLabel} pts/partido estimados según el club.`;
  const budgetRate = highRisk ? clamp(Number(offer?.transferBudgetRate || 0.05), 0.01, 1) : null;
  const restrictionText = highRisk
    ? `Restricción de fichajes: presupuesto muy limitado, aprox. ${Math.round(budgetRate * 100)}% del margen normal autorizado.`
    : 'Restricción de fichajes: condiciones normales del club.';
  return { objectiveText, restrictionText, baseLabel, finalLabel, highRisk, budgetRate };
}

function managerJobOfferCard(offer){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(offer.clubId));
  if(!club) return '';
  const division = clubDivision(club.id);
  const highRisk = String(offer.contractType || '') === 'high_risk';
  const tag = highRisk ? 'Contrato exigente' : 'Contrato normal';
  const detail = managerJobOfferObjectiveDetails(offer, club.id);
  const note = highRisk
    ? 'Objetivo superior al normal y fichajes muy restringidos.'
    : 'Condiciones normales según reputación y división.';
  return `<article class="card job-offer-card ${highRisk ? 'warn' : ''}">
    <div class="row"><div><p class="label">Oferta laboral · vence ${escapeHtml(offer.expiresDate || '—')}</p><h3>${typeof clubLink === 'function' ? clubLink(club.id) : escapeHtml(club.name || 'Club')}</h3></div><span class="pill ${highRisk ? 'warn' : 'ok'}">${escapeHtml(tag)}</span></div>
    <p class="muted small">${escapeHtml(division?.name || 'Liga')} · Prestigio ${clubPrestigeValue(club)} · ${escapeHtml(note)}</p>
    <div class="job-offer-details"><p class="small"><strong>${escapeHtml(detail.objectiveText)}</strong></p><p class="muted small">${escapeHtml(detail.restrictionText)}</p></div>
    <div class="row message-actions"><button class="primary" data-accept-job-offer="${escapeHtml(offer.id)}">Aceptar cargo</button><button class="ghost" data-reject-job-offer="${escapeHtml(offer.id)}">Rechazar</button></div>
  </article>`;
}
function managerJobApplicationCard(app){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(app.clubId));
  if(!club) return '';
  return `<article class="card job-application-card"><p class="label">Solicitud enviada</p><h3>${escapeHtml(club.name)}</h3><p class="muted small">Responden el ${escapeHtml(app.responseDate || '—')}. Prestigio club ${clubPrestigeValue(club)} · tu prestigio ${formatManagerPrestige(currentManagerPrestige())}.</p></article>`;
}
function managerJobApplicationOptionCard(club){
  const prestige = managerClubAccessPrestige(currentManagerPrestige());
  const diff = clubPrestigeValue(club) - prestige;
  return `<button type="button" class="card available-club-card job-application-option" data-apply-job-club="${Number(club.id)}">
    <div class="available-club-head"><span class="available-club-badge">${clubBadge(club.id) || '▣'}</span><strong>${escapeHtml(club.name || 'Club')}</strong></div>
    <p class="muted small">Prestigio ${clubPrestigeValue(club)} · ${diff > 0 ? `+${diff} sobre tu reputación` : 'alcanzable'}</p>
    <small>Enviar solicitud · respuesta en 3 días</small>
  </button>`;
}
function managerJobMarketMarkup(){
  if(!game?.gameOver?.active) return '';
  const state = ensureManagerJobMarketState();
  if(!state.nextIncomingOfferDate) managerJobScheduleNextIncomingOffer(currentCalendarDate());
  const offers = state.offers || [];
  const applications = (state.applications || []).filter(app => app.status === 'pending');
  const options = managerJobApplicationCandidates(8);
  return `<section class="card job-market-panel">
    <div class="row"><div><p class="label">Mercado laboral</p><h3>Ofertas y solicitudes</h3></div><span class="pill">Próxima oferta: ${escapeHtml(state.nextIncomingOfferDate || '—')}</span></div>
    <p class="muted small">Mientras estás sin club, el calendario sigue corriendo. Los clubes pequeños pueden ofrecerte trabajo desde el comienzo. También podés solicitar cargos algo superiores, aunque pueden responder con objetivos muy exigentes.</p>
    <div class="grid cols-2 job-market-grid" style="margin-top:12px">
      <div><h4>Ofertas recibidas</h4>${offers.length ? offers.map(managerJobOfferCard).join('') : '<p class="muted small">No hay ofertas activas. Entre 3 y 7 días puede llegar una nueva.</p>'}</div>
      <div><h4>Solicitudes pendientes</h4>${applications.length ? applications.map(managerJobApplicationCard).join('') : '<p class="muted small">No hay solicitudes en espera.</p>'}</div>
    </div>
    <div style="margin-top:12px"><h4>Solicitar trabajo a clubes superiores</h4><div class="available-clubs-grid">${options.length ? options.map(managerJobApplicationOptionCard).join('') : '<p class="muted small">No hay clubes dentro del margen de solicitud actual o ya tienen una solicitud u oferta activa.</p>'}</div></div>
  </section>`;
}

function bindManagerJobMarketActions(){
  document.querySelectorAll('[data-accept-job-offer]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    acceptManagerJobOffer(btn.dataset.acceptJobOffer || '');
  }));
  document.querySelectorAll('[data-reject-job-offer]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    rejectManagerJobOffer(btn.dataset.rejectJobOffer || '');
  }));
  document.querySelectorAll('[data-apply-job-club]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    applyForManagerJob(Number(btn.dataset.applyJobClub || 0));
  }));
}
function renderCareerJobs(){
  const withoutClub = Boolean(game?.gameOver?.active);
  if(withoutClub){
    view.innerHTML = `<div class="row section-title"><div><h2>Ofertas laborales</h2><p class="tagline">Ofertas, solicitudes y próximos pasos de tu carrera.</p></div></div>${managerJobMarketMarkup()}${typeof managerAvailableClubsPanelMarkup === 'function' ? managerAvailableClubsPanelMarkup({ context:'career-jobs', selectable:false }) : ''}`;
    bindManagerJobMarketActions();
    return;
  }
  const clubId = Number(game?.selectedClubId || 0);
  const contract = managerJobContractForClubSeason(clubId, game?.seasonNumber || 1);
  const objectiveInfo = typeof managerObjectiveProgressInfo === 'function' ? managerObjectiveProgressInfo() : null;
  const currentSeasonStats = game?.managerStats?.currentSeason || {};
  const contractType = contract?.contractType === 'high_risk' ? 'Contrato exigente' : 'Contrato normal';
  const restriction = contract?.contractType === 'high_risk'
    ? `Presupuesto de fichajes limitado al ${Math.round(Number(contract.transferBudgetRate || 0.05) * 100)}% del margen normal.`
    : 'Sin restricciones laborales especiales adicionales.';
  const objective = Number(objectiveInfo?.objective ?? currentSeasonStats?.objectivePpg ?? managerObjectiveForClubDivision(clubId));
  const played = Number(objectiveInfo?.played ?? currentSeasonStats?.played ?? 0);
  const ppg = Number(objectiveInfo?.ppg ?? 0);
  const signedDate = contract?.signedDate || game?.seasonStartDate || game?.currentDate || '—';
  view.innerHTML = `<div class="row section-title"><div><h2>Contrato actual</h2><p class="tagline">Situación laboral del manager y exigencias vigentes con el club.</p></div></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Club</p><strong>${clubBadge(clubId)} ${escapeHtml(clubName(clubId))}</strong></div>
      <div class="card"><p class="label">Tipo de contrato</p><strong>${escapeHtml(contractType)}</strong></div>
      <div class="card"><p class="label">Temporada</p><strong>${Number(game?.seasonNumber || 1)}</strong></div>
      <div class="card"><p class="label">Firmado</p><strong>${escapeHtml(signedDate)}</strong></div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card"><p class="label">Objetivo deportivo</p><h3>${Number.isFinite(objective) ? `${objective.toFixed(2)} puntos por partido` : 'Sin objetivo definido'}</h3><p class="muted small">Rendimiento actual: ${ppg.toFixed(2)} puntos por partido en ${played} encuentros oficiales.</p></div>
      <div class="card"><p class="label">Condiciones laborales</p><h3>${escapeHtml(restriction)}</h3><p class="muted small">La situación se revisa con los resultados, el objetivo de la directiva y el cierre de temporada.</p></div>
    </div>
    <div class="card" style="margin-top:14px"><p class="label">Cambiar de club</p><h3>Las ofertas aparecen al quedar sin cargo</h3><p class="muted small">Mientras tenés contrato vigente no se muestran solicitudes laborales activas. Al renunciar o ser despedido, esta pantalla se convierte en el mercado laboral completo.</p></div>`;
}

function applyForManagerJob(clubId){
  if(!game?.gameOver?.active){ showNotice('Sólo podés solicitar trabajo cuando estás sin club.'); return false; }
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  if(!club){ showNotice('Club no encontrado.'); return false; }
  if(!managerClubCareerEligible(club)){ showNotice('Ese equipo no pertenece a una liga jugable y no puede contratar managers.'); return false; }
  const rehireBlock = managerClubRehireBlockInfo(club);
  if(rehireBlock.blocked){ showNotice(managerClubRehireBlockLabel(club)); return false; }
  const rejectedApplicationBlock = managerJobRejectedApplicationBlockLabel(club);
  if(rejectedApplicationBlock){ showNotice(rejectedApplicationBlock); return false; }
  if(managerCanSelectClub(club, currentManagerPrestige())){
    showNotice(`${club.name} ya acepta contratarte de forma normal. Podés firmar desde Buscar otro club.`);
    return false;
  }
  const diff = clubPrestigeValue(club) - managerClubAccessPrestige(currentManagerPrestige());
  const applicationMargin = typeof managerCareerApplicationMargin === 'function' ? managerCareerApplicationMargin() : 8;
  if(diff <= 0 || diff > applicationMargin){ showNotice(`${club.name} está fuera del margen de solicitud. Diferencia actual: ${diff} puntos; margen permitido: ${applicationMargin}.`); return false; }
  const state = ensureManagerJobMarketState();
  if(state.applications.some(app => Number(app.clubId) === Number(club.id) && app.status === 'pending')){ showNotice('Ya enviaste una solicitud a ese club.'); return false; }
  if(state.offers.some(offer => Number(offer.clubId) === Number(club.id))){ showNotice('Ese club ya tiene una oferta activa para vos.'); return false; }
  const today = currentCalendarDate();
  state.applications.push({
    id:`job-app-${club.id}-${today}-${Date.now()}`,
    clubId:Number(club.id),
    requestedDate:today,
    responseDate:addDaysToIsoDate(today, 3),
    managerPrestigeAtRequest:currentManagerPrestige(),
    rejectionChance:managerJobApplicationRejectionChance(club, currentManagerPrestige()),
    status:'pending'
  });
  pushGameMessage({ type:'directiva', priority:'normal', title:'Solicitud enviada', body:`Enviaste una solicitud para dirigir a ${club.name}. Responderán en 3 días.`, id:`job-application-sent-${club.id}-${today}` });
  saveLocal(true);
  renderAll();
  return true;
}
function removeManagerJobOffer(offerId){
  const state = ensureManagerJobMarketState();
  const before = state.offers.length;
  state.offers = state.offers.filter(offer => String(offer.id) !== String(offerId));
  return before !== state.offers.length;
}
function rejectManagerJobOffer(offerId){
  const state = ensureManagerJobMarketState();
  const offer = state.offers.find(item => String(item.id) === String(offerId));
  if(!offer){ showNotice('La oferta ya no está disponible.'); return; }
  const club = seed.clubs.find(c => Number(c.id) === Number(offer.clubId));
  removeManagerJobOffer(offerId);
  pushGameMessage({ type:'directiva', priority:'normal', title:'Oferta rechazada', body:`Rechazaste la oferta de ${club?.name || 'un club'}.`, id:`job-offer-rejected-${offer.clubId}-${currentCalendarDate()}` });
  saveLocal(true);
  renderAll();
}
function acceptManagerJobOffer(offerId){
  const state = ensureManagerJobMarketState();
  const offer = state.offers.find(item => String(item.id) === String(offerId));
  if(!offer){ showNotice('La oferta ya no está disponible.'); return; }
  continueCareerAtClub(offer.clubId, { jobOffer:offer, allowHighRiskContract:String(offer.contractType || '') === 'high_risk' });
}
function managerJobContractForClubSeason(clubId=game?.selectedClubId, season=game?.seasonNumber || 1){
  const contract = game?.managerJobContract;
  if(!contract || typeof contract !== 'object') return null;
  if(Number(contract.clubId || 0) !== Number(clubId || 0)) return null;
  if(Number(contract.season || 0) !== Number(season || 1)) return null;
  return contract;
}
function applyManagerJobContractToObjectiveFields(fields, clubId=game?.selectedClubId, season=game?.seasonNumber || 1){
  const clean = { ...(fields || {}) };
  const contract = managerJobContractForClubSeason(clubId, season);
  if(!contract || String(contract.contractType || '') !== 'high_risk') return clean;
  const bonus = Number.isFinite(Number(contract.objectiveBonus)) ? Number(contract.objectiveBonus) : 0.25;
  const base = Number(clean.objectivePpg ?? clean.objectiveBasePpg ?? 0);
  if(Number.isFinite(base)){
    clean.objectivePpg = Number(Math.min(2.75, base + bonus).toFixed(3));
    clean.objectiveJobContractBonus = Number(bonus.toFixed(3));
    clean.objectiveSource = 'contrato_exigente';
    clean.objectiveExpectation = 'Contrato exigente por reputación';
    clean.objectiveLabel = `${clean.objectivePpg.toFixed(2)} · contrato exigente`;
  }
  return clean;
}
function resetOutgoingClubStateAfterManagerExit(clubId=game?.selectedClubId, reason='exit'){
  if(!game || !clubId) return;
  const id = Number(clubId);
  const club = seed?.clubs?.find(c => Number(c.id) === id);
  ensureClubBudgetsState();
  const persistentBudget = Number(game.selectedClubId || 0) === id
    ? Math.round(Number(game.budget ?? game.clubBudgets[id] ?? club?.budget ?? 0))
    : Math.round(Number(game.clubBudgets[id] ?? club?.budget ?? 0));
  game.clubBudgets[id] = persistentBudget;
  if(Number(game.selectedClubId || 0) === id){
    game.budget = 0;
    game.seasonInitialBudget = 0;
    game.budgetHistory = [];
    game.lastBudgetDelta = 0;
  }
  game.staffActions = {};
  game.staffContracts = {};
  game.monthlyExpenses = {};
  game.academy = normalizeAcademyState(game.academy);
  if(typeof resetScoutingCenterForNewClub === 'function') resetScoutingCenterForNewClub(id);
  if(typeof closeTransferOfferMessagesForClubExit === 'function') closeTransferOfferMessagesForClubExit(id);
  if(typeof clearPendingTransferAgreementFlags === 'function') clearPendingTransferAgreementFlags(game);
  game.pendingTransfers = [];
  game.lastOwnPlayerOffer = null;
  game.rejectedPurchaseOffers = {};
  game.rejectedFreeAgentOffers = {};
  game.specialClauseOffers = null;
  game.bankLoan = typeof createBankLoanState === 'function' ? createBankLoanState(game.seasonNumber || 1) : null;
  game.sponsors = typeof createInitialSponsorState === 'function' ? createInitialSponsorState() : (typeof normalizeSponsorState === 'function' ? normalizeSponsorState({}) : {});
  game.transferBudget = typeof createTransferBudgetState === 'function' ? createTransferBudgetState(id, game.seasonNumber || 1, 0) : game.transferBudget;
  game.managerJobContract = null;
  game.managerJobMarket = normalizeManagerJobMarketState(game.managerJobMarket || {});
  pushGameMessage({ type:'sistema', priority:'normal', title:'Cambio de administración', body:`${club?.name || 'El club anterior'} conserva ${typeof formatMoney === 'function' ? formatMoney(persistentBudget) : persistentBudget} en caja. Se reiniciaron empleados contratados por el mánager, préstamos, lista activa de ojeo y sponsors. Tu Academia, su Predio, residencias y juveniles continúan bajo tu propiedad.`, id:`club-reset-after-${reason}-${id}-${game.seasonNumber || 1}-${game.globalTurn || 0}` });
}


function managerWithoutClubActive(){
  return Boolean(game?.gameOver?.active);
}
function migrateManagerAcademyOwnershipForState(state=game){
  if(!state) return null;
  const rawAcademy = state.academy && typeof state.academy === 'object' ? state.academy : null;
  const previousVersion = rawAcademy && Object.prototype.hasOwnProperty.call(rawAcademy, 'ownershipVersion') ? Math.round(Number(rawAcademy.ownershipVersion || 0)) : 0;
  state.academy = normalizeAcademyState(state.academy);
  state.stadium = state.stadium || createInitialStadiumState();
  state.stadium.facilities = state.stadium.facilities && typeof state.stadium.facilities === 'object' && !Array.isArray(state.stadium.facilities) ? state.stadium.facilities : {};
  const academy = state.academy;
  const selectedClubId = Number(state.selectedClubId || 0);
  const club = seed?.clubs?.find(item => Number(item.id) === selectedClubId);
  if(!academy.homeCountry) academy.homeCountry = club ? clubCountry(club) : 'Argentina';
  if(!academy.createdAt) academy.createdAt = state.currentDate || '';
  academy.facilities = normalizeManagerAcademyFacilitiesState(academy.facilities);
  academy.staffContracts = normalizeStaffContracts(academy.staffContracts || {});
  if(previousVersion < 2){
    const sourceFacility = selectedClubId ? state.stadium.facilities[selectedClubId]?.youthTraining : null;
    if(sourceFacility && typeof sourceFacility === 'object'){
      const current = academy.facilities.youthTraining;
      const sourceLevel = Math.max(0, Math.round(Number(sourceFacility.level || 0)));
      if(sourceLevel > Number(current.level || 0)) current.level = sourceLevel;
      if(!current.construction && sourceFacility.construction) current.construction = normalizeFacilityConstruction(sourceFacility.construction, { targetLevel:Number(sourceFacility.construction.targetLevel || sourceLevel + 1) });
    }
    const legacyContract = state.staffContracts?.youth_preparer;
    if(legacyContract && !academy.staffContracts.youth_preparer) academy.staffContracts.youth_preparer = { ...legacyContract };
  }
  if(state.staffContracts?.youth_preparer) delete state.staffContracts.youth_preparer;
  Object.keys(state.stadium.facilities).forEach(clubId => {
    const facility = state.stadium.facilities[clubId];
    if(facility && typeof facility === 'object' && facility.youthTraining) delete facility.youthTraining;
  });
  academy.owner = 'manager';
  academy.ownershipVersion = 2;
  return academy;
}

