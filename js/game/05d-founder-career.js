/* V8.08 · Modo fundador y transición de carrera. Extraído de 05-state-season.js sin alterar el orden lógico original. */

function formatPlainNumber(value){
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits:0 }).format(Math.max(0, Math.round(Number(value || 0))));
}
function formatBudgetMillions(value){
  const millions = Number(value || 0) / 1000000;
  const digits = millions >= 100 ? 0 : 1;
  return `$${millions.toLocaleString('es-AR', { maximumFractionDigits:digits })} M`;
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

function founderModeEnabled(){ return Boolean(FOUNDER_MODE_ENABLED); }
function founderLowestDivisionByCountry(country){
  const divisions = divisionsByCountry(country);
  return divisions.slice().sort((a,b)=>(Number(b.order || 0) - Number(a.order || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' }))[0] || divisions[0] || { id:'default', name:'Liga única', country, order:1, prizeMultiplier:1 };
}
function founderProjectedDivisionId(clubId){
  const id = Number(clubId || 0);
  const movement = (game?.seasonTransition?.movements || []).find(item => Number(item?.clubId || 0) === id);
  if(movement?.toDivisionId) return String(movement.toDivisionId);
  return String(clubById(id)?.divisionId || 'default');
}
function founderReplacementClub(country, options={}){
  const division = founderLowestDivisionByCountry(country);
  const useProjectedDivision = Boolean(options?.nextSeason && game?.seasonFinalized);
  const clubs = (seed?.clubs || [])
    .filter(club => {
      if(clubCountry(club) !== country) return false;
      const divisionId = useProjectedDivision ? founderProjectedDivisionId(club.id) : String(club.divisionId || 'default');
      return divisionId === String(division.id || 'default');
    })
    .sort((a,b)=>clubPrestigeValue(a)-clubPrestigeValue(b) || Number(a.budget || 0)-Number(b.budget || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' }));
  return clubs[0] || null;
}
function founderClubShort(name){
  const words = String(name || 'Club Fundador').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9\s]/g,' ').trim().split(/\s+/).filter(Boolean);
  if(words.length >= 3) return words.slice(0,3).map(w => w[0]).join('').toUpperCase().slice(0,3);
  if(words.length === 2) return (words[0].slice(0,2) + words[1][0]).toUpperCase().slice(0,3);
  return (words[0] || 'FND').slice(0,3).toUpperCase();
}
function sanitizeFounderClubInput(options={}){
  const country = availableCountries().includes(options.country) ? options.country : (availableCountries()[0] || 'Argentina');
  const clubName = String(options.clubName || '').trim().slice(0, 42) || 'Club Fundador';
  const city = String(options.city || '').trim().slice(0, 42) || 'Ciudad propia';
  const colorRaw = String(options.primaryColor || '#3b82f6').trim();
  const color = /^#[0-9a-f]{6}$/i.test(colorRaw) ? colorRaw : '#3b82f6';
  const crestOptions = Array.isArray(FOUNDER_CREST_OPTIONS) ? FOUNDER_CREST_OPTIONS : [];
  const crestRaw = String(options.crestPath || '').trim();
  const crestPath = crestOptions.includes(crestRaw) ? crestRaw : (crestOptions[0] || '');
  return { country, clubName, city, primaryColor:color, crestPath, managerName:String(options.managerName || '').trim().slice(0, 40) };
}
function releaseClubPlayersToFounderMarket(clubId){
  const released = [];
  (seed?.players || []).forEach(player => {
    if(Number(player.clubId || 0) !== Number(clubId)) return;
    setPlayerClubId(player, 0);
    player.freeAgent = true;
    player.founderReleased = true;
    player.origin = player.origin || 'Club reemplazado por modo fundador';
    refreshPlayerClause(player);
    released.push({ ...player });
  });
  return released;
}
function createFoundedClubAtReplacement(options={}){
  if(!founderModeEnabled()) return null;
  const clean = sanitizeFounderClubInput(options);
  const replacement = founderReplacementClub(clean.country, { nextSeason:Boolean(options.nextSeason) });
  if(!replacement) return null;
  const division = options.nextSeason ? founderLowestDivisionByCountry(clean.country) : clubDivision(replacement.id);
  const releasedPlayers = releaseClubPlayersToFounderMarket(replacement.id);
  const nameSlug = typeof slugId === 'function' ? slugId(clean.clubName) : imageSlug(clean.clubName).toLowerCase();
  const foundedClub = {
    ...replacement,
    originalClubName:replacement.name,
    founderReplacedClub:{ id:replacement.id, name:replacement.name, country:clubCountry(replacement), divisionName:replacement.divisionName || division.name },
    isFoundedClub:true,
    founderClub:true,
    name:clean.clubName,
    short:founderClubShort(clean.clubName),
    city:clean.city,
    country:clean.country,
    reputation:FOUNDER_CLUB_REPUTATION,
    managerPrestige:FOUNDER_CLUB_REPUTATION,
    budget:FOUNDER_CLUB_INITIAL_BUDGET,
    primaryColor:clean.primaryColor,
    stadiumName:`Cancha Fundacional de ${clean.clubName}`,
    stadiumCapacity:FOUNDER_CLUB_INITIAL_CAPACITY,
    fansBase:FOUNDER_CLUB_INITIAL_FANS,
    fieldConditionScore:FOUNDER_CLUB_INITIAL_FIELD,
    fieldCondition:fieldConditionName(FOUNDER_CLUB_INITIAL_FIELD),
    crestPath:clean.crestPath || `img/escudos/${nameSlug}.png`,
    divisionId:division.id,
    divisionName:division.name,
    divisionOrder:division.order,
    prizeMultiplier:replacement.prizeMultiplier ?? divisionPrizeMultiplier(division.name, (division.order || 1)-1)
  };
  const index = seed.clubs.findIndex(club => Number(club.id) === Number(replacement.id));
  if(index >= 0) seed.clubs[index] = foundedClub;
  return { club:foundedClub, replacement, releasedPlayers, clean };
}
function founderFreeAgentGroupCounts(players=[]){
  const counts = { total:0, POR:0, DEF:0, MID:0, ATT:0 };
  (players || []).forEach(player => {
    if(Number(player.clubId || 0) !== 0 || player.sold || player.retired) return;
    counts.total += 1;
    const group = playerRoleGroup(player.position);
    if(Object.prototype.hasOwnProperty.call(counts, group)) counts[group] += 1;
  });
  return counts;
}
function ensureFounderFreeAgentPool(initialPlayers=[]){
  const pool = Array.isArray(game?.marketPlayers) ? game.marketPlayers : [];
  const existingIds = new Set(pool.map(p => Number(p.id)));
  (initialPlayers || []).forEach(player => {
    if(!player || existingIds.has(Number(player.id))) return;
    pool.push({ ...player, clubId:0, freeAgent:true });
    existingIds.add(Number(player.id));
  });
  const minimums = {
    total:FOUNDER_FREE_AGENTS_MIN_TOTAL,
    POR:FOUNDER_FREE_AGENTS_MIN_GK,
    DEF:FOUNDER_FREE_AGENTS_MIN_DEF,
    MID:FOUNDER_FREE_AGENTS_MIN_MID,
    ATT:FOUNDER_FREE_AGENTS_MIN_ATT
  };
  let guard = 0;
  while(guard < 12){
    const counts = founderFreeAgentGroupCounts(pool);
    const missing = counts.total < minimums.total || counts.POR < minimums.POR || counts.DEF < minimums.DEF || counts.MID < minimums.MID || counts.ATT < minimums.ATT;
    if(!missing) break;
    const nextStart = Math.max(0, ...((seed?.players || []).concat(pool)).map(p => Number(p.id) || 0)) + 1;
    const generated = generateMarketPlayers(24, { startId:nextStart, label:`founder-free-${guard}-${game?.selectedClubId || 0}`, nameContext:'Modo Fundador' });
    generated.forEach(player => pool.push(player));
    guard += 1;
  }
  game.marketPlayers = pruneFreeAgentMarketArrayToHardMax(pool, MARKET_FREE_AGENT_HARD_MAX);
  syncSeedFreeAgentCleanup(game.marketPlayers);
  mergeMarketPlayersIntoSeed(game.marketPlayers);
  ensurePlayerStateForAll();
  return founderFreeAgentGroupCounts(game.marketPlayers);
}
function founderGoalBaseTemplates(){
  return [
    { type:'capacity_absolute', title:'Primeras gradas', description:'Tener un estadio con capacidad para tus 500 hinchas iniciales.', target:500, importance:'Alta' },
    { type:'wins_delta', title:'Primeros 10 triunfos', description:'Ganar 10 partidos oficiales desde que se activa esta meta.', target:10, importance:'Media' },
    { type:'fans_delta', title:'Mil nuevos hinchas', description:'Sumar 1.000 hinchas desde que se activa esta meta.', target:1000, importance:'Media' },
    { type:'capacity_absolute', title:'Estadio de barrio', description:'Llegar a 5.000 espectadores de capacidad.', target:5000, importance:'Media' },
    { type:'promotion_or_title', title:'Salto deportivo', description:'Conseguir un ascenso. Si ya estás en la máxima división, salir campeón.', target:1, importance:'Alta' },
    { type:'wins_delta', title:'Racha fundacional', description:'Ganar 20 partidos oficiales desde que se activa esta meta.', target:20, importance:'Media' },
    { type:'fans_delta', title:'Arrastre popular', description:'Sumar 5.000 hinchas desde que se activa esta meta.', target:5000, importance:'Alta' },
    { type:'capacity_absolute', title:'Estadio competitivo', description:'Llegar a 20.000 espectadores de capacidad.', target:20000, importance:'Alta' },
    { type:'promotion_or_title', title:'Nueva consagración', description:'Conseguir otro ascenso. Si ya estás en la máxima división, salir campeón.', target:1, importance:'Alta' }
  ];
}
function founderLoopGoal(index){
  const cycle = Math.max(0, Math.floor((index - founderGoalBaseTemplates().length) / 4));
  const slot = Math.max(0, (index - founderGoalBaseTemplates().length) % 4);
  if(slot === 0) return { type:'wins_delta', title:`Bloque de victorias ${cycle + 1}`, description:`Ganar ${25 + cycle * 5} partidos oficiales desde que se activa esta meta.`, target:25 + cycle * 5, importance:'Media' };
  if(slot === 1) return { type:'fans_delta', title:`Nueva masa social ${cycle + 1}`, description:`Sumar ${6000 + cycle * 2000} hinchas desde que se activa esta meta.`, target:6000 + cycle * 2000, importance:'Alta' };
  if(slot === 2) return { type:'capacity_next', title:`Nueva ampliación grande ${cycle + 1}`, description:'Superar el siguiente umbral grande de capacidad.', target:30000 + cycle * 10000, importance:'Alta' };
  return { type:'promotion_or_title', title:`Logro deportivo mayor ${cycle + 1}`, description:'Conseguir un ascenso o, si ya estás en primera, salir campeón.', target:1, importance:'Alta' };
}
function founderGoalTemplate(index=0){
  const templates = founderGoalBaseTemplates();
  return index < templates.length ? templates[index] : founderLoopGoal(index);
}
function founderClubPromotionsCount(){ return Math.max(0, Math.round(Number(game?.founderGoals?.promotions || 0))); }
function founderGoalStartValues(){
  const totals = normalizeManagerStats(game?.managerStats).totals || {};
  return {
    wins:Number(totals.won || 0),
    fans:clubFansCurrent(game.selectedClubId),
    capacity:clubStadiumCapacity(game.selectedClubId),
    promotions:founderClubPromotionsCount(),
    titles:Number(game?.managerStats?.titles || 0)
  };
}
function activateFounderGoal(index=0){
  const template = founderGoalTemplate(index);
  const starts = founderGoalStartValues();
  const currentCapacity = starts.capacity;
  let type = template.type;
  let target = Math.max(1, Math.round(Number(template.target || 1)));
  if(type === 'capacity_next'){
    const thresholds = [500, 1000, 2000, 5000, 10000, 20000, 30000, 45000, 60000, 80000, 100000, 120000];
    target = thresholds.find(value => value > currentCapacity) || Math.min(120000, currentCapacity + 10000);
    type = 'capacity_absolute';
  }
  if(type === 'capacity_absolute' && currentCapacity >= target){
    const thresholds = [500, 1000, 2000, 5000, 10000, 20000, 30000, 45000, 60000, 80000, 100000, 120000];
    target = thresholds.find(value => value > currentCapacity) || Math.min(120000, currentCapacity + 10000);
  }
  if(type === 'promotion_or_title'){
    const division = clubDivision(game.selectedClubId);
    const hasUpper = divisionOrderList().some(item => Number(item.order || 0) < Number(division.order || 0));
    type = hasUpper ? 'promotion_delta' : 'title_delta';
  }
  return {
    index:Number(index || 0),
    id:`founder-goal-${index}-${game?.seasonNumber || 1}-${game?.globalTurn || 0}`,
    type,
    title:template.title,
    description:template.description,
    target,
    importance:template.importance || 'Media',
    start:starts,
    startedAt:{ season:game?.seasonNumber || 1, turn:game?.globalTurn || 0, date:game?.currentDate || '' },
    completed:false
  };
}
function ensureFounderGoalsState(){
  if(!currentGameIsFounderMode()) return null;
  game.founderGoals = game.founderGoals && typeof game.founderGoals === 'object' && !Array.isArray(game.founderGoals) ? game.founderGoals : {};
  game.founderGoals.activeIndex = Math.max(0, Math.round(Number(game.founderGoals.activeIndex || 0)));
  game.founderGoals.completed = Array.isArray(game.founderGoals.completed) ? game.founderGoals.completed : [];
  game.founderGoals.promotions = Math.max(0, Math.round(Number(game.founderGoals.promotions || 0)));
  if(!game.founderGoals.current || game.founderGoals.current.completed){
    game.founderGoals.current = activateFounderGoal(game.founderGoals.activeIndex);
  }
  return game.founderGoals;
}
function founderGoalProgress(goal=null){
  const state = ensureFounderGoalsState();
  const current = goal || state?.current;
  if(!current) return { value:0, target:1, percent:0, label:'—' };
  let value = 0;
  if(current.type === 'capacity_absolute') value = clubStadiumCapacity(game.selectedClubId);
  if(current.type === 'wins_delta') value = Math.max(0, Number(normalizeManagerStats(game.managerStats).totals?.won || 0) - Number(current.start?.wins || 0));
  if(current.type === 'fans_delta') value = Math.max(0, clubFansCurrent(game.selectedClubId) - Number(current.start?.fans || 0));
  if(current.type === 'promotion_delta') value = Math.max(0, founderClubPromotionsCount() - Number(current.start?.promotions || 0));
  if(current.type === 'title_delta') value = Math.max(0, Number(game?.managerStats?.titles || 0) - Number(current.start?.titles || 0));
  const target = Math.max(1, Number(current.target || 1));
  const percent = clamp((value / target) * 100, 0, 100);
  return { value, target, percent, label:`${formatPlainNumber(value)} / ${formatPlainNumber(target)}` };
}
function evaluateFounderGoals(options={}){
  const state = ensureFounderGoalsState();
  if(!state?.current || state.current.completed) return false;
  const progress = founderGoalProgress(state.current);
  if(progress.value < progress.target) return false;
  const completed = { ...state.current, completed:true, completedAt:{ season:game?.seasonNumber || 1, turn:game?.globalTurn || 0, date:game?.currentDate || '' } };
  state.completed.push(completed);
  state.completed = state.completed.slice(-40);
  state.activeIndex = Number(state.activeIndex || 0) + 1;
  pushGameMessage({
    type:'fundador',
    priority:'high',
    title:`Meta fundadora cumplida: ${completed.title}`,
    body:`${completed.description} Progreso final: ${progress.label}. Se activó una nueva meta del club.`,
    id:`founder-goal-complete-${completed.index}-${game?.selectedClubId}-${game?.globalTurn || 0}`
  });
  state.current = activateFounderGoal(state.activeIndex);
  if(options.silent !== true){
    pushGameMessage({ type:'fundador', priority:'normal', title:`Nueva meta fundadora: ${state.current.title}`, body:`${state.current.description} Importancia: ${state.current.importance}.`, id:`founder-goal-new-${state.current.index}-${game?.selectedClubId}-${game?.globalTurn || 0}` });
  }
  return true;
}
function founderGoalProgressMarkup(){
  const state = ensureFounderGoalsState();
  const goal = state?.current;
  if(!goal) return '';
  const progress = founderGoalProgress(goal);
  return `<div class="manager-objective-progress founder-goal-progress"><div class="manager-objective-progress-head"><span>Meta fundadora · ${escapeHtml(goal.importance)}</span><strong>${Math.round(progress.percent)}%</strong></div><div class="manager-objective-bar"><span style="width:${Math.min(100, Math.max(0, progress.percent))}%"></span></div><p><strong>${escapeHtml(goal.title)}:</strong> ${escapeHtml(goal.description)} <span class="muted">${escapeHtml(progress.label)}</span></p></div>`;
}
function founderPendingSeasonMatches(){
  return (game?.fixtures || []).reduce((total, round) => total + (round?.matches || []).filter(match => !match?.played).length, 0);
}
function founderForcedSeasonMatchDate(match, round=null){
  if(match?.clubWorldCup && typeof clubWorldCupAuthoritativeMatchDate === 'function'){
    const authoritative = clubWorldCupAuthoritativeMatchDate(match, round);
    if(validIsoDate(authoritative)) return authoritative;
  }
  return validIsoDate(match?.date) ? match.date : (validIsoDate(round?.date) ? round.date : seasonEndDateForYear(currentSeasonYear()));
}
function founderForcedSeasonDueMatches(targetDate){
  const pending = [];
  (game?.fixtures || []).forEach((round, roundIndex) => {
    (round?.matches || []).forEach(match => {
      if(match?.played) return;
      const date = founderForcedSeasonMatchDate(match, round);
      if(validIsoDate(date) && daysBetweenIsoDates(date, targetDate) >= 0) pending.push({ roundIndex, round, match, date });
    });
  });
  pending.sort((a,b) => daysBetweenIsoDates(b.date, a.date) || a.roundIndex-b.roundIndex || String(a.match?.id || '').localeCompare(String(b.match?.id || '')));
  const cupDates = pending.filter(item => item.match?.clubWorldCup).map(item => item.date).filter(validIsoDate).sort();
  const firstCupDate = cupDates[0] || '';
  return firstCupDate ? pending.filter(item => !item.match?.clubWorldCup || item.date === firstCupDate) : pending;
}
function founderForcedSeasonPoisson(lambda){
  const safe = Math.max(0.05, Math.min(4.5, Number(lambda) || 0.05));
  const limit = Math.exp(-safe);
  let product = 1;
  let count = 0;
  do{ count += 1; product *= Math.random(); }while(product > limit && count < 9);
  return Math.max(0, Math.min(7, count - 1));
}
function founderForcedSeasonClubStrength(clubId){
  const club = clubById(clubId) || {};
  const prestige = Number(typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : (club.reputation || club.managerPrestige || 50));
  const division = typeof clubDivision === 'function' ? clubDivision(clubId) : null;
  const divisionBonus = Math.max(0, 4 - Number(division?.order || club.divisionOrder || 1)) * 2.5;
  return Math.max(10, Math.min(110, prestige + divisionBonus));
}
function founderForcedSeasonResult(match){
  const homeStrength = founderForcedSeasonClubStrength(match?.homeId);
  const awayStrength = founderForcedSeasonClubStrength(match?.awayId);
  const neutral = Boolean(match?.clubWorldCup);
  const gap = Math.max(-45, Math.min(45, homeStrength - awayStrength));
  const homeXg = Math.max(0.20, Math.min(3.80, 1.18 + gap / 42 + (neutral ? 0 : 0.16)));
  const awayXg = Math.max(0.20, Math.min(3.80, 1.08 - gap / 42));
  const homeGoals = founderForcedSeasonPoisson(homeXg);
  const awayGoals = founderForcedSeasonPoisson(awayXg);
  const possessionHome = Math.max(32, Math.min(68, Math.round(50 + gap * 0.24 + (neutral ? 0 : 2))));
  const foulsHome = 7 + (typeof hashNumber === 'function' ? hashNumber(`${match?.id || ''}-founder-home-fouls`, 12) : Math.floor(Math.random() * 12));
  const foulsAway = 7 + (typeof hashNumber === 'function' ? hashNumber(`${match?.id || ''}-founder-away-fouls`, 12) : Math.floor(Math.random() * 12));
  return {
    ...match,
    played:true,
    engine:'founder-season-summary',
    homeGoals,
    awayGoals,
    goals:[],
    cards:[],
    injuries:[],
    substitutions:[],
    keySaves:[],
    errors:[],
    starterIdsHome:[],
    starterIdsAway:[],
    playedIdsHome:[],
    playedIdsAway:[],
    matchStats:{
      home:{ attacks:Math.max(12, Math.round(25 + homeXg * 7)), chances:Math.max(homeGoals, Math.round(homeXg * 4)), possession:possessionHome, fouls:foulsHome, passScore:Math.round(homeStrength), xg:Number(homeXg.toFixed(2)), keySaves:0, errors:0, goalErrors:0 },
      away:{ attacks:Math.max(12, Math.round(25 + awayXg * 7)), chances:Math.max(awayGoals, Math.round(awayXg * 4)), possession:100-possessionHome, fouls:foulsAway, passScore:Math.round(awayStrength), xg:Number(awayXg.toFixed(2)), keySaves:0, errors:0, goalErrors:0 }
    },
    matchContext:{ forcedSeasonEnd:true, managerAbsent:true }
  };
}
function resolveFounderForcedSeasonMatches(targetDate){
  const due = founderForcedSeasonDueMatches(targetDate);
  const results = [];
  due.forEach(item => {
    const raw = founderForcedSeasonResult(item.match);
    let result = typeof finalizeWinnerRequiredMatchResult === 'function' ? finalizeWinnerRequiredMatchResult(item.match, raw) : raw;
    result = typeof finalizeClubWorldCupMatchResult === 'function' ? finalizeClubWorldCupMatchResult(item.match, result) : result;
    if(typeof markScheduledResult === 'function') markScheduledResult(item, result);
    else Object.assign(item.match, result, { played:true, date:item.date });
    if(typeof applyResultToTables === 'function') applyResultToTables(item.match, Number(result.homeGoals || 0), Number(result.awayGoals || 0));
    results.push(result);
  });
  if(results.length){
    game.matchHistory = Array.isArray(game.matchHistory) ? game.matchHistory : [];
    game.matchHistory.push(...results);
    if(typeof advanceCompletedRegularRounds === 'function') advanceCompletedRegularRounds();
  }
  return results;
}
function finishCurrentSeasonForFounderCareer(){
  if(!game) return { ok:false, reason:'No hay una carrera activa.' };
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  if(game.seasonFinalized) return { ok:true, season, simulated:0, alreadyFinalized:true };
  const fromDate = validIsoDate(game.currentDate) ? game.currentDate : firstAdvanceDateForSeason(currentSeasonYear());
  const endDate = seasonEndDateForYear(currentSeasonYear());
  const skippedDays = validIsoDate(fromDate) && validIsoDate(endDate) ? Math.max(0, daysBetweenIsoDates(fromDate, endDate)) : 0;
  game.currentDate = endDate;
  rememberCalendarDate();
  if(typeof ensureClubWorldCupCurrentSeason === 'function') ensureClubWorldCupCurrentSeason({ source:'founder_forced_season_end' });
  let simulated = 0;
  let guard = 0;
  while(guard < 80){
    guard += 1;
    const results = resolveFounderForcedSeasonMatches(endDate);
    simulated += results.length;
    if(typeof advanceCompletedRegularRounds === 'function') advanceCompletedRegularRounds();
    const postCompetition = typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
    const pending = founderPendingSeasonMatches();
    if(!pending && !postCompetition?.created) break;
    if(!results.length && !postCompetition?.created && pending > 0){
      return { ok:false, season, simulated, reason:`Quedaron ${pending} partido(s) pendientes que no pudieron resolverse.` };
    }
  }
  const pending = founderPendingSeasonMatches();
  if(pending > 0) return { ok:false, season, simulated, reason:`Quedaron ${pending} partido(s) pendientes al cerrar la temporada.` };
  game.globalTurn = Math.max(0, Math.round(Number(game.globalTurn || 0))) + skippedDays;
  game.seasonPhase = 'finalizing';
  game.currentDate = endDate;
  rememberCalendarDate();
  finalizeSeasonIfNeeded({ managerAbsent:true, forcedByFounder:true });
  if(!game.seasonFinalized) return { ok:false, season, simulated, reason:'No se pudo finalizar la temporada actual.' };
  return { ok:true, season, simulated, skippedDays, alreadyFinalized:false };
}
function prepareFounderClubForCareerTransition(created){
  const clubId = Number(created?.club?.id || 0);
  if(!game || !clubId) return false;
  ensureClubBudgetsState();
  game.clubBudgets[clubId] = FOUNDER_CLUB_INITIAL_BUDGET;
  game.budget = FOUNDER_CLUB_INITIAL_BUDGET;
  game.lastBudgetDelta = 0;
  game.founderMode = true;
  game.founderClubId = clubId;
  game.founderReplacedClub = created.club.founderReplacedClub || null;
  game.founderGoals = null;
  game.founderAdministrativeCosts = {};
  game.bankruptcyMode = false;
  game.bankruptcy = null;
  game.challenge = null;
  game.managerJobContract = null;
  game.managerJobMarket = normalizeManagerJobMarketState(game.managerJobMarket || {});
  game.managerJobMarket.applications = [];
  game.gameOver = null;
  game.mustReviewTactics = false;
  game.stadium = game.stadium || createInitialStadiumState();
  game.stadium.capacityOverrides = game.stadium.capacityOverrides || {};
  game.stadium.fields = game.stadium.fields || {};
  game.stadium.capacityOverrides[clubId] = FOUNDER_CLUB_INITIAL_CAPACITY;
  game.stadium.fields[clubId] = FOUNDER_CLUB_INITIAL_FIELD;
  ensureFanState(game);
  game.fans.clubs[clubId] = { base:FOUNDER_CLUB_INITIAL_FANS, current:FOUNDER_CLUB_INITIAL_FANS, lastDelta:0, lastReason:'Modo fundador' };
  return true;
}
function startFounderCareerAfterSeason(created, transition={}){
  if(!prepareFounderClubForCareerTransition(created)) return false;
  const clubId = Number(created.club.id);
  const specialReset = typeof resetActiveSpecialCardsToReserveForNewClub === 'function'
    ? resetActiveSpecialCardsToReserveForNewClub({ reason:'founder_new_club' })
    : null;
  startNextSeason(clubId, { allowDirectClubChange:true, reason:'founder_career_start' });
  game.founderMode = true;
  game.founderClubId = clubId;
  game.founderReplacedClub = created.club.founderReplacedClub || null;
  game.founderGoals = null;
  game.founderAdministrativeCosts = {};
  game.clubBudgets[clubId] = FOUNDER_CLUB_INITIAL_BUDGET;
  game.budget = FOUNDER_CLUB_INITIAL_BUDGET;
  game.seasonInitialBudget = FOUNDER_CLUB_INITIAL_BUDGET;
  game.seasonBudgetStartBySeason = game.seasonBudgetStartBySeason || {};
  game.seasonBudgetStartBySeason[game.seasonNumber] = FOUNDER_CLUB_INITIAL_BUDGET;
  game.stadium.capacityOverrides[clubId] = FOUNDER_CLUB_INITIAL_CAPACITY;
  game.stadium.fields[clubId] = FOUNDER_CLUB_INITIAL_FIELD;
  game.fans.clubs[clubId] = { base:FOUNDER_CLUB_INITIAL_FANS, current:FOUNDER_CLUB_INITIAL_FANS, lastDelta:0, lastReason:'Modo fundador' };
  ensureFounderFreeAgentPool(created.releasedPlayers || []);
  game.tactic = normalizeTactic(clubId, DEFAULT_TACTIC);
  game.mustReviewTactics = true;
  ensureFounderGoalsState();
  if(typeof checkManagerAchievements === 'function') checkManagerAchievements({ silent:false });
  const resetText = specialReset?.returned ? ` ${specialReset.returned} carta(s) activa(s) volvieron a la reserva.` : '';
  pushGameMessage({
    type:'fundador',
    priority:'high',
    title:`Club fundado: ${created.club.name}`,
    body:`La temporada ${transition.season || Math.max(1, Number(game.seasonNumber || 2) - 1)} terminó automáticamente después de quedar sin club. ${created.club.name} debuta en la temporada ${game.seasonNumber} desde la división más baja, sin plantel, sin presupuesto y con estadio de capacidad 0.${resetText}`,
    id:`founder-career-${game.seasonNumber}-${clubId}-${game.globalTurn || 0}`
  });
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  showNotice(`Temporada ${game.seasonNumber} iniciada con ${created.club.name}. Armá el plantel desde Mercado antes de competir.`, true);
  return true;
}
function createFounderGame(options={}){
  if(!founderModeEnabled()){ showNotice('El modo fundador está desactivado en la configuración.'); return; }
  if(game?.gameOver?.active){
    const transition = finishCurrentSeasonForFounderCareer();
    if(!transition.ok){ showNotice(`No se pudo cerrar la temporada: ${transition.reason || 'error desconocido'}`); return; }
    const created = createFoundedClubAtReplacement({ ...options, managerName:storedManagerName(), nextSeason:true });
    if(!created?.club){ showNotice('No se pudo crear el club propio en la división más baja del país elegido.'); return; }
    startFounderCareerAfterSeason(created, transition);
    return;
  }
  if(game){ showNotice('El modo fundador sólo se puede iniciar al crear una carrera o cuando estás sin club.'); return; }
  const created = createFoundedClubAtReplacement(options);
  if(!created?.club){ showNotice('No se pudo crear el club propio en el país elegido.'); return; }
  newGame(created.club.id, {
    managerName:created.clean.managerName || storedManagerName(),
    country:created.clean.country,
    leagueId:created.club.divisionId || 'default',
    founderMode:true,
    saveSlotId:SAVE_SLOT_CAREER,
    founderReleasedPlayers:created.releasedPlayers,
    founderReplacedClub:created.club.founderReplacedClub
  });
}

function fillClubSelect(){
  const select = $('clubSelect');
  if(select) select.innerHTML = clubSelectOptionsMarkup();
}


