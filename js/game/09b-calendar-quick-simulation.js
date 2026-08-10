/* V8.08 · Calendario, avance diario y simulación rápida. Extraído de 09-simulation-economy-training.js. */

function advanceLockLeftMs(){
  if(!game) return 0;
  const configured = Math.max(0, DAY_ADVANCE_LOCK_MS || ADVANCE_LOCK_MS || 20000);
  let left = Math.max(0, Number(game.advanceLockedUntil || 0) - Date.now());
  const storedDuration = Math.max(0, Number(game.advanceLockDurationMs || 0));
  if(configured > 0 && left > configured && storedDuration > configured){
    game.advanceLockDurationMs = configured;
    game.advanceLockedUntil = Date.now() + configured;
    left = configured;
  }
  return left;
}
function isAdvanceLocked(){ return advanceLockLeftMs() > 0; }
function setAdvanceLock(ms){
  if(!game) return;
  const duration = Math.max(0, Math.round(Number(ms) || 0));
  game.advanceLockDurationMs = duration;
  game.advanceLockedUntil = duration > 0 ? Date.now() + duration : 0;
}
function currentCalendarDate(){
  if(!game) return '';
  return validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
}
function rememberCalendarDate(){
  if(!game || !validIsoDate(game.currentDate)) return;
  if(validIsoDate(game.lastCalendarDate) && daysBetweenIsoDates(game.currentDate, game.lastCalendarDate) > 0){
    game.currentDate = game.lastCalendarDate;
    return;
  }
  game.lastCalendarDate = game.currentDate;
}
function isCurrentDateBeforeIso(targetIso){
  const today = currentCalendarDate();
  return validIsoDate(targetIso) && daysBetweenIsoDates(today, targetIso) > 0;
}
function isCurrentDateOnOrAfterIso(targetIso){
  const today = currentCalendarDate();
  return validIsoDate(targetIso) && daysBetweenIsoDates(today, targetIso) <= 0;
}
function setDailyAdvanceSummary(fromDate, toDate, simulatedCount=0){
  game.lastTurnSummary = {
    title:'Avance diario',
    phase:phaseLabel(),
    result:`${fromDate || '—'} → ${toDate || '—'}`,
    tone:'info',
    items:[
      { label:'Calendario', text:simulatedCount > 0 ? `Se simularon ${simulatedCount} partido(s) de otras ligas programados para la fecha.` : 'El juego avanzó un solo día. No se simuló partido propio.', tone:simulatedCount > 0 ? 'ok' : 'info' },
      { label:'Próximo compromiso', text:nextOwnMatchInfo()?.date ? `Programado para ${nextOwnMatchInfo().date}.` : 'Sin partido confirmado.', tone:'info' }
    ],
    createdAt:Date.now()
  };
}
function ownClubInMatch(match){
  if(game?.gameOver?.active) return false;
  const ownId = Number(game?.selectedClubId || 0);
  return ownId && (Number(match?.homeId) === ownId || Number(match?.awayId) === ownId);
}
function scheduledDateForMatch(match, round=null){
  if(match?.clubWorldCup && typeof clubWorldCupAuthoritativeMatchDate === 'function'){
    const authoritativeDate = clubWorldCupAuthoritativeMatchDate(match, round);
    if(validIsoDate(authoritativeDate)) return authoritativeDate;
  }
  return validIsoDate(match?.date) ? match.date : (validIsoDate(round?.date) ? round.date : currentCalendarDate());
}
function nextOwnMatchInfo(){
  if(typeof ensureCampoDestruidoChallengeFullCalendar === 'function') ensureCampoDestruidoChallengeFullCalendar();
  if(!game || !isRegularSeason()) return null;
  if(typeof calendarEarliestPendingMatch === 'function'){
    return calendarEarliestPendingMatch(game, game.selectedClubId) || null;
  }
  let best = null;
  for(let roundIndex=0; roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    (round.matches || []).forEach((match, matchIndex) => {
      if(match.played || !ownClubInMatch(match)) return;
      const date = scheduledDateForMatch(match, round);
      if(!validIsoDate(date)) return;
      if(!best || daysBetweenIsoDates(date, best.date) > 0 || (date === best.date && roundIndex < best.roundIndex)){
        best = { roundIndex, matchIndex, round, match, date };
      }
    });
  }
  return best;
}
function nextPendingMatchInfo(){
  if(!game || !isRegularSeason()) return null;
  if(typeof calendarEarliestPendingMatch === 'function'){
    return calendarEarliestPendingMatch(game, 0) || null;
  }
  let best = null;
  for(let roundIndex=0; roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    (round.matches || []).forEach((match, matchIndex) => {
      if(match.played) return;
      const date = scheduledDateForMatch(match, round);
      if(!validIsoDate(date)) return;
      if(!best || daysBetweenIsoDates(date, best.date) > 0 || (date === best.date && roundIndex < best.roundIndex)){
        best = { roundIndex, matchIndex, round, match, date };
      }
    });
  }
  return best;
}
function collectDueMatchesUntil(targetDate, options={}){
  if(!validIsoDate(targetDate) || !game?.fixtures) return [];
  const includeOwn = options.includeOwn !== false;
  const collected = [];
  for(let roundIndex=0; roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    (round.matches || []).forEach(match => {
      if(match.played) return;
      if(!includeOwn && ownClubInMatch(match)) return;
      const date = scheduledDateForMatch(match, round);
      if(validIsoDate(date) && daysBetweenIsoDates(date, targetDate) >= 0){
        collected.push({ roundIndex, round, match, date });
      }
    });
  }
  const sorted = collected.sort((a,b)=>daysBetweenIsoDates(b.date, a.date) || a.roundIndex-b.roundIndex || String(a.match.id).localeCompare(String(b.match.id)));
  if(options.limitClubWorldCupGroupRound === false || options.limitClubWorldCupStage === false) return sorted;
  const dueCupMatches = sorted.filter(item => item.match?.clubWorldCup);
  if(!dueCupMatches.length) return sorted;
  const earliestCupDate = dueCupMatches.map(item => item.date).filter(validIsoDate).sort()[0] || '';
  if(!earliestCupDate) return sorted;
  // Como máximo se procesa un día del Mundial por lote de avance. Todos los partidos de esa etapa sí se juegan juntos.
  return sorted.filter(item => !item.match?.clubWorldCup || item.date === earliestCupDate);
}
function currentRoundIsComplete(index=game?.matchdayIndex || 0){
  const round = game?.fixtures?.[index];
  return !!round && (round.matches || []).every(match => match.played);
}
function advanceCompletedRegularRounds(){
  if(!game?.fixtures) return;
  if(typeof repairFixtureCursorForState === 'function'){
    repairFixtureCursorForState(game, { reason:'after_match_simulation' });
    return;
  }
  const firstIncomplete = game.fixtures.findIndex(round => (round?.matches || []).some(match => !match?.played));
  game.matchdayIndex = firstIncomplete >= 0 ? firstIncomplete : game.fixtures.length;
}
function quickBotPoisson(lambda){
  const safe = Math.max(0.02, Number(lambda) || 0.02);
  const limit = Math.exp(-safe);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while(p > limit && k < 10);
  return clamp(k - 1, 0, 8);
}
function quickClubRating(clubId, lineup=null){
  const club = seed.clubs.find(c => Number(c.id) === Number(clubId)) || { reputation:50 };
  const top = Array.isArray(lineup) && lineup.length ? lineup.slice(0, 11) : quickBotLineup(clubId);
  const squadAvg = top.length ? avg(top.map(effectiveOverall)) : Number(club.reputation || 50);
  const morale = top.length ? avg(top.map(p => currentMorale(p.id))) : 50;
  const condition = top.length ? avg(top.map(p => currentCondition(p.id))) : 70;
  const cohesion = typeof cohesionValue === 'function' ? cohesionValue(clubId) : Number(game?.teamCohesion?.[clubId] || 50);
  return squadAvg * 0.62 + Number(club.reputation || 50) * 0.22 + morale * 0.08 + condition * 0.04 + cohesion * 0.04;
}
function quickBotLineup(clubId, selection=null){
  const best = selection || (typeof bestBotFormationSelection === 'function' ? bestBotFormationSelection(clubId) : null);
  if(best?.lineup?.length) return best.lineup.slice(0, 11);
  const squad = playersByClub(clubId)
    .filter(player => !isUnavailable(player.id))
    .sort((a,b) => effectiveOverall(b) - effectiveOverall(a));
  const gk = squad.find(p => String(p.position).toUpperCase() === 'POR');
  const outfield = squad.filter(p => p !== gk);
  return (gk ? [gk] : []).concat(outfield).slice(0, 11);
}
function quickWeightedPick(items, weightFn){
  const safe = (items || []).filter(Boolean);
  if(!safe.length) return null;
  const weighted = safe.map(item => ({ item, w:Math.max(1, Number(weightFn(item)) || 1) }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let roll = Math.random() * total;
  for(const x of weighted){ roll -= x.w; if(roll <= 0) return x.item; }
  return weighted[0].item;
}
const QUICK_GOAL_POSITION_WEIGHTS = { DC:100, ED:80, EI:80, MCO:65, MC:55, MD:40, MI:40, MCD:30, DFC:10, LD:10, LI:10, POR:0.05 };
function quickGoalPositionWeight(player){
  const pos = String(player?.position || '').toUpperCase();
  return Number(QUICK_GOAL_POSITION_WEIGHTS[pos] ?? 35);
}
function quickScorerWeight(player){
  if(!player) return 1;
  const roleWeight = quickGoalPositionWeight(player);
  if(roleWeight <= 0.1) return 0.05;
  const skillWeight = effectiveSkill(player, 'remate') * 1.4 + effectiveSkill(player, 'posicionamiento') + effectiveSkill(player, 'serenidad') * 0.35;
  return Math.max(1, skillWeight * (roleWeight / 100));
}
function quickAssistWeight(player){
  if(!player) return 1;
  if(String(player.position || '').toUpperCase() === 'POR') return 0.5;
  const pos = String(player.position || '').toUpperCase();
  const bonus = ['ED','EI','MCO','MC','MD','MI'].includes(pos) ? 35 : ['MCD','LD','LI'].includes(pos) ? 16 : 6;
  return effectiveSkill(player, 'paseCorto') + effectiveSkill(player, 'vision') + effectiveSkill(player, 'paseLargo') * 0.45 + bonus;
}
function quickDefensiveErrorWeight(player){
  if(!player) return 1;
  const pos = String(player.position || '').toUpperCase();
  const role = pos === 'POR' ? 58 : ['DFC','LD','LI','MCD'].includes(pos) ? 42 : 10;
  const security = (currentMorale(player.id) + currentCondition(player.id) + visibleOverall(player)) / 3;
  return role + Math.max(0, 100 - security);
}
function quickCardWeight(player){
  if(!player) return 1;
  const pos = String(player.position || '').toUpperCase();
  const role = ['DFC','MCD'].includes(pos) ? 35 : ['LD','LI','MC'].includes(pos) ? 22 : 10;
  return role + Math.max(1, 100 - effectiveSkill(player, 'disciplina')) + hiddenStats(player).aggression * 0.35;
}
function quickBuildGoals(clubId, lineup, goalsCount, startMinute=2, endMinute=90){
  const goals = [];
  for(let i=0; i<goalsCount; i++){
    const scorer = quickWeightedPick(lineup, quickScorerWeight);
    if(!scorer) continue;
    const assisters = lineup.filter(p => Number(p.id) !== Number(scorer.id));
    const assister = Math.random() < 0.72 ? quickWeightedPick(assisters, quickAssistWeight) : null;
    goals.push({
      clubId:Number(clubId),
      playerId:Number(scorer.id),
      assistId:assister ? Number(assister.id) : null,
      minute:clamp(Math.round(rnd(startMinute, endMinute)), 1, 90),
      quick:true
    });
  }
  return goals;
}
function quickNormalizeCardsForExpulsions(cards=[]){
  const ordered = (Array.isArray(cards) ? cards : []).slice().sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0));
  const yellowCounts = new Map();
  const expelled = new Set();
  const normalized = [];
  ordered.forEach(raw => {
    const playerId = Number(raw?.playerId || 0);
    if(!playerId || expelled.has(playerId)) return;
    if(String(raw.type || '') === 'red'){
      normalized.push({ ...raw, type:'red' });
      expelled.add(playerId);
      return;
    }
    const previous = Number(yellowCounts.get(playerId) || 0);
    if(previous >= 1){
      normalized.push({ ...raw, type:'secondYellowRed' });
      yellowCounts.set(playerId, previous + 1);
      expelled.add(playerId);
      return;
    }
    normalized.push({ ...raw, type:'yellow' });
    yellowCounts.set(playerId, 1);
  });
  return normalized;
}
function quickBuildCards(clubId, lineup, fouls){
  const candidates = [];
  const count = clamp(quickBotPoisson(Math.max(0.05, (Number(fouls || 0) * MATCH_CARD_RATE_MULTIPLIER) / 7.4)), 0, 6);
  for(let i=0; i<count; i++){
    const player = quickWeightedPick(lineup, quickCardWeight);
    if(!player) continue;
    candidates.push({ clubId:Number(clubId), playerId:Number(player.id), type:'yellow', minute:clamp(Math.round(rnd(8, 89)), 1, 90), quick:true });
  }
  const directRedPool = lineup.filter(player => String(player.position || '').toUpperCase() !== 'POR' && hiddenStats(player).aggression > 78);
  if(directRedPool.length && Math.random() < clamp(0.025 * MATCH_CARD_RATE_MULTIPLIER * DIRECT_RED_RATE_MULTIPLIER, 0, 0.10)){
    const player = quickWeightedPick(directRedPool, quickCardWeight);
    if(player) candidates.push({ clubId:Number(clubId), playerId:Number(player.id), type:'red', minute:clamp(Math.round(rnd(18, 88)), 1, 90), quick:true });
  }
  return quickNormalizeCardsForExpulsions(candidates);
}
function quickDefaultLossByRedCards(cards, homeId, awayId){
  const redCards = (clubId) => (cards || [])
    .filter(card => Number(card.clubId) === Number(clubId) && ['red','secondYellowRed'].includes(String(card.type || '')))
    .sort((a,b) => Number(a.minute || 0) - Number(b.minute || 0));
  const home = redCards(homeId);
  const away = redCards(awayId);
  if(home.length < 5 && away.length < 5) return null;
  if(home.length >= 5 && away.length >= 5){
    const homeMinute = Number(home[4]?.minute || 999);
    const awayMinute = Number(away[4]?.minute || 999);
    if(awayMinute < homeMinute) return { offenderClubId:Number(awayId), winnerClubId:Number(homeId), homeGoals:3, awayGoals:0, homeReds:home.length, awayReds:away.length, minute:awayMinute };
  }
  if(home.length >= 5) return { offenderClubId:Number(homeId), winnerClubId:Number(awayId), homeGoals:0, awayGoals:3, homeReds:home.length, awayReds:away.length, minute:Number(home[4]?.minute || 90) };
  return { offenderClubId:Number(awayId), winnerClubId:Number(homeId), homeGoals:3, awayGoals:0, homeReds:home.length, awayReds:away.length, minute:Number(away[4]?.minute || 90) };
}
function quickBuildInjuries(clubId, lineup, context){
  const injuries = [];
  const candidates = (lineup || []).filter(player => !isUnavailable(player.id));
  candidates.forEach(player => {
    const cardMultiplier = typeof specialMatchInjuryMultiplier === 'function' ? specialMatchInjuryMultiplier(clubId) : 1;
    const contextMultiplier = typeof matchInjuryContextMultiplier === 'function' ? matchInjuryContextMultiplier(clubId) : 1;
    const chance = clamp(Math.max(0, Number(typeof injuryChanceForPlayer === 'function' ? injuryChanceForPlayer(player.id, context?.pitch || 'Normal') : 0.004)) * QUICK_MATCH_INJURY_MULTIPLIER * cardMultiplier * contextMultiplier, 0, 0.95);
    if(Math.random() >= chance) return;
    const injury = typeof pickInjuryTypeForPlayer === 'function'
      ? pickInjuryTypeForPlayer(player.id)
      : (typeof pickInjuryType === 'function' ? pickInjuryType() : { name:'Lesión muscular', minTurns:7, maxTurns:28, probability:1 });
    const matchesOut = Math.max(1, Math.round(rnd(Number(injury.minTurns || 7), Number(injury.maxTurns || 28) + 1)));
    injuries.push({
      clubId:Number(clubId),
      playerId:Number(player.id),
      type:'injury',
      name:injury.name || 'Lesión',
      injuryLabel:injury.name || 'Lesión',
      probability:injury.probability || 0,
      chance:Math.round(chance * 100),
      matchesOut,
      minute:clamp(Math.round(rnd(12, 90)), 1, 90),
      phase:'durante',
      quick:true,
      highLoad:Boolean(injury.highLoad),
      highLoadRatio:injury.highLoadRatio,
      highLoadPlayed:injury.highLoadPlayed,
      highLoadReference:injury.highLoadReference
    });
  });
  return injuries.sort((a,b) => a.minute - b.minute);
}
function quickBuildKeySaves(defendingClubId, keeper, chancesAgainst, goalsAgainst, chanceByLineup){
  if(!keeper) return [];
  const volume = Math.max(0, Number(chancesAgainst || 0) - Number(goalsAgainst || 0));
  const count = clamp(quickBotPoisson(volume / 7.5), 0, 5);
  const saves = [];
  for(let i=0; i<count; i++){
    const shooter = quickWeightedPick(chanceByLineup || [], quickScorerWeight);
    saves.push({
      clubId:Number(defendingClubId),
      playerId:Number(keeper.id),
      minute:clamp(Math.round(rnd(5, 90)), 1, 90),
      chanceById:shooter ? Number(shooter.id) : null,
      chanceQuality:Number(rnd(0.20, 0.70).toFixed(2)),
      quick:true
    });
  }
  return saves.sort((a,b) => a.minute - b.minute);
}
function quickBuildErrors(clubId, lineup, goalsAgainst, pressure){
  const count = clamp(quickBotPoisson(Math.max(0.05, Number(pressure || 0) / 10)), 0, 5);
  const errors = [];
  for(let i=0; i<count; i++){
    const player = quickWeightedPick(lineup, quickDefensiveErrorWeight);
    if(!player) continue;
    const goal = i < Number(goalsAgainst || 0) && Math.random() < 0.45;
    errors.push({
      clubId:Number(clubId),
      playerId:Number(player.id),
      minute:clamp(Math.round(rnd(6, 90)), 1, 90),
      goal:Boolean(goal),
      quick:true
    });
  }
  return errors.sort((a,b) => a.minute - b.minute);
}
function quickBotOverexertionRules(){
  const rules = Array.isArray(configValue('equilibrioBots.tacticaRapida.reglasDiferencia', [])) ? configValue('equilibrioBots.tacticaRapida.reglasDiferencia', []) : [];
  const fallback = [
    { diferenciaMin:1, diferenciaMax:1, desgasteFisicoPct:0.20, bonusAtaquePct:0.10 },
    { diferenciaMin:2, diferenciaMax:2, desgasteFisicoPct:0.30, bonusAtaquePct:0.20 },
    { diferenciaMin:3, diferenciaMax:99, desgasteFisicoPct:0.50, bonusAtaquePct:0.30 }
  ];
  return (rules.length ? rules : fallback).map(rule => ({
    diferenciaMin:Math.max(1, Math.round(Number(rule?.diferenciaMin ?? rule?.min ?? rule?.diferencia ?? 1) || 1)),
    diferenciaMax:Math.max(1, Math.round(Number(rule?.diferenciaMax ?? rule?.max ?? rule?.diferencia ?? 99) || 99)),
    desgasteFisicoPct:clamp(Number(rule?.desgasteFisicoPct ?? rule?.desgastePct ?? 0) || 0, 0, 2),
    bonusAtaquePct:clamp(Number(rule?.bonusAtaquePct ?? rule?.ataquePct ?? 0) || 0, 0, 2)
  })).sort((a,b) => a.diferenciaMin - b.diferenciaMin);
}
function quickBotOverexertionRule(gf, gc){
  if(!BOT_QUICK_OVEREXERTION_ENABLED) return null;
  const diff = Math.max(0, Math.round(Number(gc || 0) - Number(gf || 0)));
  if(diff <= 0) return null;
  return quickBotOverexertionRules().find(rule => diff >= Number(rule.diferenciaMin || 1) && diff <= Number(rule.diferenciaMax || 99)) || null;
}
function quickBotConditionDeltaForOverexertion(player, rule){
  if(!player || !rule) return 0;
  const baseLoss = typeof conditionLossForPlayer === 'function' ? Math.max(1, Number(conditionLossForPlayer(player) || 0)) : 10;
  return -Math.max(1, Math.round(baseLoss * Number(rule.desgasteFisicoPct || 0)));
}
function quickEnsureStatsForPlayers(players=[]){
  game.playerStats = game.playerStats || {};
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  players.forEach(player => {
    if(!player) return;
    if(!game.playerStats[player.id]) game.playerStats[player.id] = typeof createEmptyPlayerStat === 'function'
      ? createEmptyPlayerStat(player)
      : { playerId:player.id, clubId:player.clubId, played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
    if(!game.playerCareerStats[player.id]) game.playerCareerStats[player.id] = typeof createEmptyPlayerStat === 'function'
      ? createEmptyPlayerStat(player)
      : { playerId:player.id, clubId:player.clubId, played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
    if(typeof normalizePlayerStatRecord === 'function'){
      normalizePlayerStatRecord(game.playerStats[player.id], player);
      normalizePlayerStatRecord(game.playerCareerStats[player.id], player);
    }
  });
}
function quickSimulateBotMatch(match){
  const homeSelection = typeof bestBotFormationSelection === 'function' ? bestBotFormationSelection(match.homeId) : null;
  const awaySelection = typeof bestBotFormationSelection === 'function' ? bestBotFormationSelection(match.awayId) : null;
  const homeLineup = quickBotLineup(match.homeId, homeSelection);
  const awayLineup = quickBotLineup(match.awayId, awaySelection);
  const homeRating = quickClubRating(match.homeId, homeLineup);
  const awayRating = quickClubRating(match.awayId, awayLineup);
  quickEnsureStatsForPlayers(homeLineup.concat(awayLineup));
  const neutralTournament = Boolean(match?.clubWorldCup || match?.neutral);
  const neutralPitchScore = neutralTournament ? 100 : fieldScoreForClub(match.homeId);
  const context = typeof attendanceContextForMatch === 'function'
    ? { weather:'Normal', pitch:fieldConditionName(neutralPitchScore), pitchScore:neutralPitchScore, neutral:neutralTournament, clubWorldCup:Boolean(match?.clubWorldCup), ...attendanceContextForMatch(match) }
    : { weather:'Normal', pitch:'Normal', pitchScore:70, totalFans:0, homeCrowdBonus:0, neutral:neutralTournament };
  const crowdEdge = neutralTournament ? 0 : Number(context.homeCrowdBonus || 0) / 22;
  const pitchPenalty = (pitchEffect(context.pitch).chanceMultiplier || 1) - 1;
  const edge = (homeRating - awayRating) / 28;
  const homeBaseXg = neutralTournament ? 1.125 : 1.20;
  const awayBaseXg = neutralTournament ? 1.125 : 1.05;
  const awayRatingEdge = neutralTournament ? edge : edge * 0.86;
  const homeNoise = neutralTournament ? rnd(-0.22, 0.22) : rnd(-0.20, 0.25);
  const awayNoise = neutralTournament ? rnd(-0.22, 0.22) : rnd(-0.20, 0.24);
  const neutralMinXg = 0.14;
  const neutralMaxXg = 4.25;
  let homeXg = clamp(homeBaseXg + edge + crowdEdge + pitchPenalty + homeNoise, neutralTournament ? neutralMinXg : 0.15, neutralTournament ? neutralMaxXg : 4.40);
  let awayXg = clamp(awayBaseXg - awayRatingEdge + pitchPenalty + awayNoise, neutralTournament ? neutralMinXg : 0.12, neutralTournament ? neutralMaxXg : 4.10);
  let homeGoals = quickBotPoisson(homeXg);
  let awayGoals = quickBotPoisson(awayXg);
  if(homeGoals === 0 && awayGoals === 0 && Math.random() < 0.38){
    if(Math.random() < clamp(0.50 + edge * 0.18, 0.25, 0.75)) homeGoals = 1;
    else awayGoals = 1;
  }
  const instructionConditionDeltas = {};
  const overexertionEvents = [];
  const applyTrailingBotOverexertion = (side, lineup, gf, gc, currentXg) => {
    if(!BOT_QUICK_OVEREXERTION_ENABLED || BOT_QUICK_OVEREXERTION_MAX_GOALS <= 0) return { extraGoals:0, xgExtra:0, rule:null };
    const rule = quickBotOverexertionRule(gf, gc);
    if(!rule) return { extraGoals:0, xgExtra:0, rule:null };
    const xgExtra = Math.max(0, Number(currentXg || 0) * Number(rule.bonusAtaquePct || 0));
    const extraGoals = Math.min(BOT_QUICK_OVEREXERTION_MAX_GOALS, quickBotPoisson(xgExtra));
    lineup.forEach(player => {
      const id = Number(player?.id || 0);
      if(!id) return;
      const conditionDelta = quickBotConditionDeltaForOverexertion(player, rule);
      instructionConditionDeltas[id] = (Number(instructionConditionDeltas[id] || 0) + conditionDelta);
    });
    overexertionEvents.push({ side, diferencia:Number(gc || 0) - Number(gf || 0), extraGoals, xgExtra:Number(xgExtra.toFixed(2)), desgasteFisicoPct:rule.desgasteFisicoPct, bonusAtaquePct:rule.bonusAtaquePct });
    return { extraGoals, xgExtra, rule };
  };
  if(homeGoals < awayGoals){
    const extra = applyTrailingBotOverexertion('home', homeLineup, homeGoals, awayGoals, homeXg);
    if(extra.extraGoals > 0 || extra.xgExtra > 0){ homeGoals += extra.extraGoals; homeXg = clamp(homeXg + extra.xgExtra, 0.15, 4.80); }
  }
  if(awayGoals < homeGoals){
    const extra = applyTrailingBotOverexertion('away', awayLineup, awayGoals, homeGoals, awayXg);
    if(extra.extraGoals > 0 || extra.xgExtra > 0){ awayGoals += extra.extraGoals; awayXg = clamp(awayXg + extra.xgExtra, 0.12, 4.60); }
  }
  if(typeof applyHighScoreGoalPenaltyToScore === 'function'){
    const adjustedScore = applyHighScoreGoalPenaltyToScore(homeGoals, awayGoals, Math.random);
    homeGoals = Number(adjustedScore.homeGoals || 0);
    awayGoals = Number(adjustedScore.awayGoals || 0);
  }
  const homePoss = clamp(Math.round(50 + (homeRating-awayRating) * 0.35 + (neutralTournament ? 0 : 3) + rnd(-7,7)), 31, 69);
  const awayPoss = 100 - homePoss;
  const homeChances = clamp(Math.round(homeXg * rnd(4.0, 6.5)), Math.max(1, homeGoals), 18);
  const awayChances = clamp(Math.round(awayXg * rnd(4.0, 6.5)), Math.max(1, awayGoals), 18);
  const homeFouls = clamp(Math.round(rnd(6,17)), 2, 30);
  const awayFouls = clamp(Math.round(rnd(6,17)), 2, 30);
  const goals = quickBuildGoals(match.homeId, homeLineup, homeGoals).concat(quickBuildGoals(match.awayId, awayLineup, awayGoals)).sort((a,b) => a.minute - b.minute);
  const cardCandidates = quickBuildCards(match.homeId, homeLineup, homeFouls).concat(quickBuildCards(match.awayId, awayLineup, awayFouls)).sort((a,b) => a.minute - b.minute);
  const cards = typeof applyMatchCardVolumePenalty === 'function' ? applyMatchCardVolumePenalty(cardCandidates, [], Math.random) : cardCandidates;
  const defaultLoss = quickDefaultLossByRedCards(cards, match.homeId, match.awayId);
  if(defaultLoss){
    homeGoals = Number(defaultLoss.homeGoals || 0);
    awayGoals = Number(defaultLoss.awayGoals || 0);
  }
  const injuries = defaultLoss ? [] : quickBuildInjuries(match.homeId, homeLineup, context).concat(quickBuildInjuries(match.awayId, awayLineup, context)).sort((a,b) => a.minute - b.minute);
  const homeKeeper = homeLineup.find(p => String(p.position || '').toUpperCase() === 'POR');
  const awayKeeper = awayLineup.find(p => String(p.position || '').toUpperCase() === 'POR');
  const keySaves = quickBuildKeySaves(match.homeId, homeKeeper, awayChances, awayGoals, awayLineup)
    .concat(quickBuildKeySaves(match.awayId, awayKeeper, homeChances, homeGoals, homeLineup))
    .sort((a,b) => a.minute - b.minute);
  const errors = quickBuildErrors(match.homeId, homeLineup, awayGoals, awayChances)
    .concat(quickBuildErrors(match.awayId, awayLineup, homeGoals, homeChances))
    .sort((a,b) => a.minute - b.minute);
  const homeKeySaves = keySaves.filter(s => Number(s.clubId) === Number(match.homeId)).length;
  const awayKeySaves = keySaves.filter(s => Number(s.clubId) === Number(match.awayId)).length;
  const homeErrors = errors.filter(e => Number(e.clubId) === Number(match.homeId));
  const awayErrors = errors.filter(e => Number(e.clubId) === Number(match.awayId));
  const matchStats = {
    home:{ attacks:clamp(Math.round(24 + homeChances * 3 + rnd(-5,7)), 12, 78), chances:homeChances, possession:homePoss, fouls:homeFouls, passScore:clamp(Math.round(homeRating + rnd(-8,10)), 1, 140), xg:Number(homeXg.toFixed(2)), keySaves:homeKeySaves, errors:homeErrors.length, goalErrors:homeErrors.filter(e=>e.goal).length },
    away:{ attacks:clamp(Math.round(22 + awayChances * 3 + rnd(-5,7)), 12, 78), chances:awayChances, possession:awayPoss, fouls:awayFouls, passScore:clamp(Math.round(awayRating + rnd(-8,10)), 1, 140), xg:Number(awayXg.toFixed(2)), keySaves:awayKeySaves, errors:awayErrors.length, goalErrors:awayErrors.filter(e=>e.goal).length }
  };
  const starterIdsHome = homeLineup.map(p => Number(p.id));
  const starterIdsAway = awayLineup.map(p => Number(p.id));
  const substitutions = [];
  if(!match.friendly){
    applyResultToTables(match, homeGoals, awayGoals);
    if(typeof applyPlayerStats === 'function'){
      const playerStatsResult = { ...match, played:true, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves, errors, starterIdsHome, starterIdsAway, playedIdsHome:starterIdsHome, playedIdsAway:starterIdsAway };
      applyPlayerStats(match.homeId, homeLineup, substitutions, goals, cards, injuries, keySaves, errors, playerStatsResult);
      applyPlayerStats(match.awayId, awayLineup, substitutions, goals, cards, injuries, keySaves, errors, playerStatsResult);
    }
    if(typeof applyMatchCohesionResult === 'function') applyMatchCohesionResult(match, substitutions, cards);
    if(typeof applyAvailability === 'function') applyAvailability(cards, injuries, { ...match, played:true, cards, injuries });
    if(typeof updatePlayerStarTrackingForMatch === 'function'){
      updatePlayerStarTrackingForMatch({ ...match, played:true, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves, errors, starterIdsHome, starterIdsAway, playedIdsHome:starterIdsHome, playedIdsAway:starterIdsAway });
    }
  }
  const matchContext = overexertionEvents.length ? { ...context, botOverexertion:overexertionEvents } : context;
  return { ...match, played:true, engine:'quick-bot', homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves, errors, matchStats, matchContext, starterIdsHome, starterIdsAway, playedIdsHome:starterIdsHome, playedIdsAway:starterIdsAway, instructionConditionDeltas, botOverexertionEvents:overexertionEvents, suspended:Boolean(defaultLoss), defaultLoss:defaultLoss ? { ...defaultLoss, reason:'Cinco expulsiones' } : null, suspensionReason:defaultLoss ? 'Cinco expulsiones' : '' };
}
function simulateScheduledMatch(match){
  const run = () => {
    if(typeof normalizeBotWearAndConditionForMatch === 'function'){
      normalizeBotWearAndConditionForMatch(match, { reason:'before_scheduled_match' });
    }
    if(FAST_BOT_SIMULATION_ENABLED && !ownClubInMatch(match)) return quickSimulateBotMatch(match);
    return simulateMatch(match);
  };
  return typeof withCompetitionSuspensionContext === 'function'
    ? withCompetitionSuspensionContext(match, run)
    : run();
}
function matchFixtureClonePlain(value){
  try{ return JSON.parse(JSON.stringify(value ?? null)); }
  catch(_){ return value ?? null; }
}
function scheduledMatchCopyFields(result){
  if(!result || typeof result !== 'object') return {};
  const fields = [
    'played','homeGoals','awayGoals','goals','cards','injuries','substitutions','keySaves','errors',
    'matchStats','matchContext','starterIdsHome','starterIdsAway','playedIdsHome','playedIdsAway',
    'instructionConditionDeltas','botOverexertionEvents','engine','suspended','defaultWin','defaultLoss','suspensionReason','winnerClubId','penaltyShootout','captainIdHome','captainIdAway','captaincyEffect','clubWorldCup','clubWorldCupStage','clubWorldCupGroup','clubWorldCupResolved','clubWorldCupTiebreaker','clubWorldCupBracketKey','clubWorldCupBracketSlot','winnerRequiredResolved','winnerRequiredReason','nationalCup','nationalCupId','nationalCupStage','nationalCupStageLabel','nationalCupCountry','nationalSupercup','stadiumClubId','stadiumName','stadiumCapacity','attendance','homeAttendance','awayAttendance','ticketPrice','ticketRevenue','nationalCupRevenuePaid','libertadores','internationalCup','continentalCup','libertadoresSeason','libertadoresStage','libertadoresStageLabel','libertadoresGroup','libertadoresRound','libertadoresTieId','betterSeedClubId','leg','secondLeg','twoLegged','aggregateBefore','competitionRules','libertadoresFinalRevenuePaid','championsLeague','championsLeagueSeason','championsLeagueStage','championsLeagueStageLabel','championsLeagueGroup','championsLeagueRound','championsLeagueTieId','championsLeagueFinalRevenuePaid'
  ];
  const data = {};
  fields.forEach(field => {
    if(Object.prototype.hasOwnProperty.call(result, field)) data[field] = matchFixtureClonePlain(result[field]);
  });
  return data;
}
function markScheduledResult(item, result){
  if(!item?.match || !result) return;
  Object.assign(item.match, scheduledMatchCopyFields(result), { played:true, homeGoals:result.homeGoals, awayGoals:result.awayGoals, date:item.date });
}
function simulateDueMatchesUntil(targetDate, options={}){
  if(typeof repairClubWorldCupGroupFixtureDates === 'function') repairClubWorldCupGroupFixtureDates();
  if(typeof libertadoresSyncAllAggregates === 'function') libertadoresSyncAllAggregates();
  if(typeof championsLeagueSyncAllAggregates === 'function') championsLeagueSyncAllAggregates();
  const due = collectDueMatchesUntil(targetDate, options);
  const results = [];
  due.forEach(item => {
    const rawResult = simulateScheduledMatch(item.match);
    let result = typeof finalizeWinnerRequiredMatchResult === 'function' ? finalizeWinnerRequiredMatchResult(item.match, rawResult) : rawResult;
    result = typeof finalizeClubWorldCupMatchResult === 'function' ? finalizeClubWorldCupMatchResult(item.match, result) : result;
    result = typeof finalizeNationalCupMatchResult === 'function' ? finalizeNationalCupMatchResult(item.match, result) : result;
    result = typeof finalizeLibertadoresMatchResult === 'function' ? finalizeLibertadoresMatchResult(item.match, result) : result;
    result = typeof finalizeChampionsLeagueMatchResult === 'function' ? finalizeChampionsLeagueMatchResult(item.match, result) : result;
    markScheduledResult(item, result);
    results.push(result);
  });
  if(results.length){
    game.matchHistory.push(...results);
    advanceCompletedRegularRounds();
    const nationalCupAdvanced = typeof advanceNationalCupsIfNeeded === 'function' ? advanceNationalCupsIfNeeded() : false;
    if(nationalCupAdvanced && typeof verifyNationalCupCheckpoints === 'function'){
      verifyNationalCupCheckpoints({ silent:true, source:'after_due_match_phase_change_v968' });
    }
    if(typeof advanceLibertadoresIfNeeded === 'function') advanceLibertadoresIfNeeded();
    if(typeof advanceChampionsLeagueIfNeeded === 'function') advanceChampionsLeagueIfNeeded();
    if(typeof advanceNationalSupercupsIfNeeded === 'function') advanceNationalSupercupsIfNeeded();
    if(typeof runDailyMatchStatsIntegrityRepair === 'function') runDailyMatchStatsIntegrityRepair({ reason:'after_due_match_simulation', force:false, scope:'recent', silent:true });
  }
  return results;
}
function processNonOwnResultsAfterSimulation(results=[]){
  const list = Array.isArray(results) ? results.filter(Boolean) : [];
  if(!list.length) return 0;
  applyPlayerWearFromMatches(list);
  if(typeof recoverBotWearDaily === 'function') recoverBotWearDaily({ reason:'after_bot_matchday' });
  if(typeof applyFanChangesAfterMatches === 'function') applyFanChangesAfterMatches(list);
  if(typeof processBotDismissals === 'function') processBotDismissals();
  advanceStadiumAfterMatches(list);
  return list.length;
}
function simulateNonOwnDueBeforeOwnMatch(targetDate, source='before_own_match'){
  if(!validIsoDate(targetDate)) return [];
  const results = simulateDueMatchesUntil(targetDate, { includeOwn:false });
  processNonOwnResultsAfterSimulation(results);
  if(results.length){
    game.lastBotPreSimulation = {
      source,
      date:targetDate,
      count:results.length,
      season:game.seasonNumber || 1,
      createdAt:Date.now()
    };
  }
  return results;
}

function firstTeamInjuryHistoryCount(clubId=game?.selectedClubId){
  const ownId = Math.max(0, Math.round(Number(clubId || 0)));
  if(!game || !ownId) return 0;
  const historyCount = (game.matchHistory || []).reduce((total, result) => total + (result?.injuries || []).filter(injury => Number(injury?.clubId || 0) === ownId).length, 0);
  const statsCount = Object.values(game.playerStats || {}).reduce((total, stat) => {
    if(Number(stat?.clubId || 0) !== ownId) return total;
    return total + Math.max(0, Math.round(Number(stat?.injuries || 0)));
  }, 0);
  return Math.max(historyCount, statsCount);
}
function ensureFirstTeamInjurySeasonControl(clubId=game?.selectedClubId){
  if(!game) return null;
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  const ownId = Math.max(0, Math.round(Number(clubId || 0)));
  if(!ownId) return null;
  const previous = game.firstTeamInjurySeasonControl;
  if(!previous || Number(previous.season || 0) !== season || Number(previous.clubId || 0) !== ownId){
    game.firstTeamInjurySeasonControl = {
      version:1,
      season,
      clubId:ownId,
      count:firstTeamInjuryHistoryCount(ownId),
      target:FIRST_TEAM_SEASON_INJURY_MINIMUM,
      eventKeys:[],
      playerCounts:{},
      lastInjuryDateByPlayer:{},
      lastCompensationDate:'',
      compensated:0
    };
  }
  const state = game.firstTeamInjurySeasonControl;
  state.version = 1;
  state.season = season;
  state.clubId = ownId;
  state.target = FIRST_TEAM_SEASON_INJURY_MINIMUM;
  state.eventKeys = Array.isArray(state.eventKeys) ? state.eventKeys.slice(-180) : [];
  state.playerCounts = state.playerCounts && typeof state.playerCounts === 'object' && !Array.isArray(state.playerCounts) ? state.playerCounts : {};
  state.lastInjuryDateByPlayer = state.lastInjuryDateByPlayer && typeof state.lastInjuryDateByPlayer === 'object' && !Array.isArray(state.lastInjuryDateByPlayer) ? state.lastInjuryDateByPlayer : {};
  state.count = Math.max(Math.max(0, Math.round(Number(state.count || 0))), firstTeamInjuryHistoryCount(ownId));
  state.compensated = Math.max(0, Math.round(Number(state.compensated || 0)));
  return state;
}
function firstTeamInjuryEventKey(injury={}, index=0){
  const date = validIsoDate(game?.currentDate) ? game.currentDate : String(currentTurnIndex());
  return [game?.seasonNumber || 1, injury.clubId || 0, injury.playerId || 0, date, currentTurnIndex(), injury.minute ?? index, injury.injuryLabel || injury.name || 'lesion', injury.source || injury.phase || 'partido'].join(':');
}
function registerFirstTeamSeasonInjuries(injuries=[], options={}){
  if(!game || !Array.isArray(injuries) || !injuries.length || game?.gameOver?.active) return 0;
  const ownId = Number(game.selectedClubId || 0);
  const ownInjuries = injuries.filter(injury => Number(injury?.clubId || 0) === ownId && Number(injury?.playerId || 0) > 0);
  if(!ownInjuries.length) return 0;
  const state = ensureFirstTeamInjurySeasonControl(ownId);
  if(!state) return 0;
  const known = new Set(state.eventKeys);
  let added = 0;
  ownInjuries.forEach((injury, index) => {
    const key = String(injury?.seasonInjuryKey || firstTeamInjuryEventKey(injury, index));
    if(known.has(key)) return;
    known.add(key);
    state.eventKeys.push(key);
    const playerId = Math.max(0, Math.round(Number(injury.playerId || 0)));
    state.playerCounts[playerId] = Math.max(0, Math.round(Number(state.playerCounts[playerId] || 0))) + 1;
    if(validIsoDate(game.currentDate)) state.lastInjuryDateByPlayer[playerId] = game.currentDate;
    state.count += 1;
    if(options.compensation || injury.source === 'midweek_minimum'){
      state.compensated += 1;
      if(validIsoDate(game.currentDate)) state.lastCompensationDate = game.currentDate;
    }
    added += 1;
  });
  state.eventKeys = state.eventKeys.slice(-180);
  return added;
}
function firstTeamInjurySeasonWindow(clubId=game?.selectedClubId){
  const ownId = Number(clubId || 0);
  const dates = [];
  (game?.fixtures || []).forEach(round => {
    (round?.matches || []).forEach(match => {
      if(match?.clubWorldCup || match?.playoff || match?.knockout) return;
      if(Number(match?.homeId || 0) !== ownId && Number(match?.awayId || 0) !== ownId) return;
      const date = validIsoDate(match?.date) ? match.date : (validIsoDate(round?.date) ? round.date : '');
      if(date) dates.push(date);
    });
  });
  dates.sort();
  const fallbackStart = typeof leagueStartDateForSeason === 'function' ? leagueStartDateForSeason(currentSeasonYear()) : seasonStartDateForYear(currentSeasonYear());
  const fallbackEnd = typeof lastFixtureMatchDate === 'function' ? lastFixtureMatchDate(game) : seasonEndDateForYear(currentSeasonYear());
  return { start:dates[0] || fallbackStart, end:dates[dates.length - 1] || fallbackEnd || seasonEndDateForYear(currentSeasonYear()) };
}
function firstTeamInjurySeasonProgress(clubId=game?.selectedClubId){
  const window = firstTeamInjurySeasonWindow(clubId);
  const today = currentCalendarDate();
  if(!validIsoDate(window.start) || !validIsoDate(window.end) || !validIsoDate(today)) return { progress:0, remainingDays:999, ...window };
  const totalDays = Math.max(1, daysBetweenIsoDates(window.start, window.end));
  const elapsed = clamp(daysBetweenIsoDates(window.start, today), 0, totalDays);
  return { progress:clamp(elapsed / totalDays, 0, 1), remainingDays:Math.max(0, daysBetweenIsoDates(today, window.end)), ...window };
}
function firstTeamMidweekTrainingDay(iso=currentCalendarDate()){
  if(!validIsoDate(iso)) return false;
  const day = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return day >= 1 && day <= 5;
}
function firstTeamMidweekInjuryType(playerId, date=currentCalendarDate()){
  const table = [
    { name:'Sobrecarga muscular', probability:38, minTurns:7, maxTurns:21 },
    { name:'Contusión en entrenamiento', probability:28, minTurns:7, maxTurns:21 },
    { name:'Distensión muscular', probability:22, minTurns:14, maxTurns:42 },
    { name:'Esguince leve', probability:8, minTurns:21, maxTurns:49 },
    { name:'Desgarro muscular', probability:4, minTurns:28, maxTurns:56 }
  ];
  const total = table.reduce((sum, item) => sum + item.probability, 0);
  let roll = hashNumber(`midweek-injury-type-${game?.seasonNumber || 1}-${date}-${playerId}`, total);
  let picked = table[0];
  for(const item of table){
    picked = item;
    if(roll < item.probability) break;
    roll -= item.probability;
  }
  const span = Math.max(1, picked.maxTurns - picked.minTurns + 1);
  const duration = picked.minTurns + hashNumber(`midweek-injury-duration-${game?.seasonNumber || 1}-${date}-${playerId}`, span);
  return { ...picked, duration };
}
function firstTeamMidweekCandidate(state, clubId, date){
  const squad = playersByClub(clubId).filter(player => player && Number(player.id || 0) > 0 && !isUnavailable(player.id));
  if(squad.length <= FIRST_TEAM_MIDWEEK_MIN_AVAILABLE) return null;
  const availableGoalkeepers = squad.filter(player => String(player.position || '').toUpperCase() === 'POR');
  const rested = squad.filter(player => {
    if(String(player.position || '').toUpperCase() === 'POR' && availableGoalkeepers.length <= 1) return false;
    const lastDate = state.lastInjuryDateByPlayer?.[player.id];
    return !validIsoDate(lastDate) || daysBetweenIsoDates(lastDate, date) >= FIRST_TEAM_MIDWEEK_PLAYER_REST_DAYS;
  });
  const candidates = rested.length ? rested : squad.filter(player => String(player.position || '').toUpperCase() !== 'POR' || availableGoalkeepers.length > 1);
  if(!candidates.length) return null;
  return candidates.slice().sort((a,b) => {
    const countA = Math.max(0, Math.round(Number(state.playerCounts?.[a.id] || 0)));
    const countB = Math.max(0, Math.round(Number(state.playerCounts?.[b.id] || 0)));
    if(countA !== countB) return countA - countB;
    const riskA = fatiguePoints(a.id) + Math.max(0, Number(game?.playerStats?.[a.id]?.played || 0)) * 1.5 + hashNumber(`midweek-candidate-${date}-${a.id}`, 100) / 100;
    const riskB = fatiguePoints(b.id) + Math.max(0, Number(game?.playerStats?.[b.id]?.played || 0)) * 1.5 + hashNumber(`midweek-candidate-${date}-${b.id}`, 100) / 100;
    return riskB - riskA;
  })[0] || null;
}
function processFirstTeamInjuryMinimumDaily(options={}){
  if(!game || !FIRST_TEAM_MIDWEEK_INJURY_ENABLED || FIRST_TEAM_SEASON_INJURY_MINIMUM <= 0 || game?.gameOver?.active || !isRegularSeason()) return { applied:false };
  const clubId = Number(game.selectedClubId || 0);
  if(!clubId) return { applied:false };
  const date = currentCalendarDate();
  if(!firstTeamMidweekTrainingDay(date)) return { applied:false, reason:'weekend' };
  const state = ensureFirstTeamInjurySeasonControl(clubId);
  const season = firstTeamInjurySeasonProgress(clubId);
  const target = Math.max(0, Math.round(Number(state?.target || FIRST_TEAM_SEASON_INJURY_MINIMUM)));
  if(!state || state.count >= target) return { applied:false, count:state?.count || 0, target };
  let due = Math.min(target, Math.floor((season.progress * target) + 0.15));
  if(season.remainingDays <= FIRST_TEAM_MIDWEEK_FORCE_FINAL_DAYS) due = target;
  if(state.count >= due) return { applied:false, count:state.count, due, target };
  if(validIsoDate(state.lastCompensationDate)){
    const elapsed = daysBetweenIsoDates(state.lastCompensationDate, date);
    const interval = season.remainingDays <= FIRST_TEAM_MIDWEEK_FORCE_FINAL_DAYS ? 1 : FIRST_TEAM_MIDWEEK_INJURY_INTERVAL_DAYS;
    if(elapsed < interval) return { applied:false, count:state.count, due, target, reason:'interval' };
  }
  const active = injuredPlayersByClub(clubId).length;
  if(active >= FIRST_TEAM_MIDWEEK_MAX_ACTIVE && season.remainingDays > Math.max(14, FIRST_TEAM_MIDWEEK_FORCE_FINAL_DAYS)) return { applied:false, count:state.count, due, target, reason:'active_limit' };
  const player = firstTeamMidweekCandidate(state, clubId, date);
  if(!player) return { applied:false, count:state.count, due, target, reason:'no_candidate' };
  const injury = firstTeamMidweekInjuryType(player.id, date);
  const issue = {
    clubId,
    playerId:Number(player.id),
    playerName:player.name || 'Jugador',
    type:'injury',
    name:injury.name,
    injuryLabel:injury.name,
    matchesOut:injury.duration,
    chance:1,
    source:'midweek_minimum',
    phase:'entrenamiento',
    seasonInjuryKey:`midweek:${game.seasonNumber || 1}:${clubId}:${player.id}:${date}`
  };
  const tacticIds = new Set([...(game.tactic?.starters || []), ...(game.tactic?.bench || [])].map(Number));
  if(typeof applyAvailability === 'function') applyAvailability([], [issue]);
  else{
    game.playerStatus = game.playerStatus || {};
    game.playerStatus[player.id] = { ...playerStatus(player.id), injuredThrough:game.matchdayIndex + Math.max(1, Math.ceil(injury.duration / Math.max(1, LEAGUE_ROUND_INTERVAL_DAYS))), injuredUntilTurn:currentTurnIndex() + injury.duration, injuryLabel:injury.name, injuredAtMatchday:game.matchdayIndex, injuredAtTurn:currentTurnIndex() };
    registerFirstTeamSeasonInjuries([issue], { compensation:true });
  }
  const stat = typeof officialPlayerStatsRecord === 'function' ? officialPlayerStatsRecord(game.playerStats || (game.playerStats = {}), player.id, clubId) : (game.playerStats?.[player.id] || null);
  if(stat) stat.injuries = Math.max(0, Math.round(Number(stat.injuries || 0))) + 1;
  if(typeof removeOwnUnavailableFromTactic === 'function') removeOwnUnavailableFromTactic([{ type:'injury', playerId:Number(player.id) }]);
  if(tacticIds.has(Number(player.id))) game.mustReviewTactics = true;
  state.lastCompensationDate = date;
  return { applied:true, playerId:Number(player.id), duration:injury.duration, count:state.count, due, target, silent:true };
}
function pushFullyRecoveredInjuryMessage(options={}){
  if(!game || typeof pushGameMessage !== 'function') return null;
  const kind = String(options.kind || 'first') === 'youth' ? 'youth' : 'first';
  const playerId = Math.max(0, Math.round(Number(options.playerId || 0)));
  const player = kind === 'first' && playerId && typeof playerById === 'function' ? playerById(playerId) : null;
  if(kind === 'first' && (!player || Number(player.clubId || 0) !== Number(game.selectedClubId || 0))) return null;
  const playerName = String(options.playerName || player?.name || 'Jugador').trim() || 'Jugador';
  const injuryLabel = String(options.injuryLabel || 'su lesión').trim() || 'su lesión';
  const recoveryKey = String(options.recoveryKey || `${kind}:${playerId}:${currentTurnIndex()}:${injuryLabel}`);
  const recoveryHash = typeof hashNumber === 'function' ? hashNumber(recoveryKey, 1000000000) : Math.abs(recoveryKey.split('').reduce((sum, char) => ((sum * 31) + char.charCodeAt(0)) | 0, 7));
  const youth = kind === 'youth';
  return pushGameMessage({
    id:`medical-clearance-${kind}-${playerId}-${recoveryHash}`,
    type:youth ? 'academia' : 'empleados',
    priority:'normal',
    title:youth ? 'Alta médica en la Academia' : 'Alta médica',
    body:youth
      ? `${playerName} se recuperó por completo de ${injuryLabel} y retoma los entrenamientos de la Academia.`
      : `${playerName} se recuperó por completo de ${injuryLabel} y vuelve a estar disponible para el primer equipo.`,
    playerIds:youth ? [] : [playerId],
    playerNames:[playerName]
  });
}
function clearRecoveredDailyInjuries(){
  if(!game?.playerStatus) return 0;
  let cleared = 0;
  Object.entries(game.playerStatus).forEach(([playerId, st]) => {
    if(!st || typeof st !== 'object') return;
    if(Number.isFinite(Number(st.injuredUntilTurn)) && Number(st.injuredUntilTurn || 0) <= currentTurnIndex()){
      const numericPlayerId = Number(playerId);
      const player = typeof playerById === 'function' ? playerById(numericPlayerId) : null;
      const recoveryKey = `first:${numericPlayerId}:${Number(st.injuredAtTurn || st.injuredAtMatchday || st.injuredUntilTurn || 0)}:${String(st.injuryLabel || 'lesion')}`;
      const injuryLabel = String(st.injuryLabel || 'su lesión');
      const { injuredThrough, injuredUntilTurn, injuryLabel:removedInjuryLabel, injuryChance, injuredAtMatchday, injuredAtTurn, ...rest } = st;
      game.playerStatus[playerId] = rest;
      cleared += 1;
      pushFullyRecoveredInjuryMessage({
        kind:'first',
        playerId:numericPlayerId,
        playerName:player?.name || 'Jugador',
        injuryLabel,
        recoveryKey,
        source:'natural_daily_recovery'
      });
    }
  });
  return cleared;
}
function bankLoanExpectedPaymentsByDate(loan, today){
  if(!loan || !validIsoDate(today) || !validIsoDate(loan.startedDate)) return null;
  const totalWeeks = Math.max(1, Math.round(Number(loan.totalWeeks || loan.weeks || 1)));
  const elapsedDays = Math.max(0, daysBetweenIsoDates(loan.startedDate, today));
  return clamp(Math.floor(elapsedDays / 7), 0, totalWeeks);
}
function repairBankLoanOverchargeIfNeeded(loan, today){
  if(!game || !loan || !validIsoDate(today) || !validIsoDate(loan.startedDate)) return 0;
  const expectedPayments = bankLoanExpectedPaymentsByDate(loan, today);
  if(expectedPayments === null) return 0;
  const totalWeeks = Math.max(1, Math.round(Number(loan.totalWeeks || loan.weeks || 1)));
  const totalToRepay = Math.max(0, Math.round(Number(loan.totalToRepay || 0)));
  const weeklyPayment = Math.max(1, Math.round(Number(loan.weeklyPayment || Math.ceil(totalToRepay / totalWeeks) || 1)));
  const paid = Math.max(0, Math.round(Number(loan.paid || 0)));
  if(paid <= 0 || expectedPayments <= 0) return 0;
  const expectedPaid = Math.min(totalToRepay, expectedPayments * weeklyPayment);
  const tolerance = Math.max(1, Math.round(weeklyPayment * 0.05));
  if(paid <= expectedPaid + tolerance) return 0;
  const refund = Math.max(0, paid - expectedPaid);
  loan.paid = expectedPaid;
  loan.remainingDebt = Math.max(0, totalToRepay - expectedPaid);
  loan.remainingWeeks = Math.max(0, totalWeeks - expectedPayments);
  loan.lastPaymentDate = expectedPayments > 0 ? addDaysToIsoDate(loan.startedDate, expectedPayments * 7) : loan.startedDate;
  loan.nextPaymentDate = loan.remainingWeeks > 0 ? addDaysToIsoDate(loan.lastPaymentDate, 7) : '';
  loan.daysSincePayment = 0;
  loan.overchargeRepairAppliedAt = today;
  loan.overchargeRepairVersion = typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'V6.36';
  recordBudgetChange(refund, `Devolución sobrecobro préstamo ${loan.bankName}`, { type:'bank_loan_overcharge_refund', bankName:loan.bankName, loanId:loan.id, expectedPayments, expectedPaid, previousPaid:paid, refund, paymentDate:today, nextPaymentDate:loan.nextPaymentDate });
  pushGameMessage({ type:'finanzas', title:'Reintegro del banco', body:`${loan.bankName} informó un error en la liquidación de las cuotas del préstamo. La entidad acreditó ${formatMoney(refund)} en la caja del club y presentó disculpas por el inconveniente.`, priority:'high' });
  return refund;
}
function syncBankLoanScheduleWithPaidAmount(loan){
  if(!loan || !validIsoDate(loan.startedDate)) return false;
  const totalWeeks = Math.max(1, Math.round(Number(loan.totalWeeks || loan.weeks || 1)));
  const totalToRepay = Math.max(0, Math.round(Number(loan.totalToRepay || 0)));
  const weeklyPayment = Math.max(1, Math.round(Number(loan.weeklyPayment || Math.ceil(totalToRepay / totalWeeks) || 1)));
  const paid = Math.max(0, Math.round(Number(loan.paid || 0)));
  const paidInstallments = clamp(Math.floor(paid / weeklyPayment), 0, totalWeeks);
  const expectedLast = paidInstallments > 0 ? addDaysToIsoDate(loan.startedDate, paidInstallments * 7) : loan.startedDate;
  const expectedNext = paidInstallments < totalWeeks ? addDaysToIsoDate(loan.startedDate, (paidInstallments + 1) * 7) : '';
  let changed = false;
  if(!validIsoDate(loan.lastPaymentDate) || daysBetweenIsoDates(loan.lastPaymentDate, expectedLast) > 0){
    loan.lastPaymentDate = expectedLast;
    changed = true;
  }
  if(expectedNext && (!validIsoDate(loan.nextPaymentDate) || daysBetweenIsoDates(loan.nextPaymentDate, expectedNext) > 0)){
    loan.nextPaymentDate = expectedNext;
    changed = true;
  }
  if(!expectedNext && loan.nextPaymentDate){
    loan.nextPaymentDate = '';
    changed = true;
  }
  return changed;
}
function processBankLoanDailySchedule(){
  if(!game || !BANK_LOANS_ENABLED) return 0;
  const state = ensureBankLoanState();
  const loan = state?.active;
  if(!loan) return 0;
  const today = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  if(!validIsoDate(today)) return 0;
  if(loan.lastScheduleCheckDate === today) return 0;
  if(!validIsoDate(loan.lastPaymentDate)) loan.lastPaymentDate = validIsoDate(loan.startedDate) ? loan.startedDate : today;
  if(!validIsoDate(loan.nextPaymentDate)) loan.nextPaymentDate = addDaysToIsoDate(loan.lastPaymentDate, 7);
  repairBankLoanOverchargeIfNeeded(loan, today);
  syncBankLoanScheduleWithPaidAmount(loan);
  loan.lastScheduleCheckDate = today;
  if(!state.active || !validIsoDate(state.active.nextPaymentDate)) return 0;
  if(daysBetweenIsoDates(state.active.nextPaymentDate, today) < 0) return 0;
  return processBankLoanWeeklyPayment(state.active.nextPaymentDate);
}

function ensureMonthlyExpensesState(){
  if(!game) return null;
  game.monthlyExpenses = (game.monthlyExpenses && typeof game.monthlyExpenses === 'object' && !Array.isArray(game.monthlyExpenses)) ? game.monthlyExpenses : {};
  game.monthlyExpenses.lastChargeDate = validIsoDate(game.monthlyExpenses.lastChargeDate) ? game.monthlyExpenses.lastChargeDate : (game.currentDate || currentCalendarDate());
  game.monthlyExpenses.matchesPlayed = Math.max(0, Math.round(Number(game.monthlyExpenses.matchesPlayed || 0)));
  return game.monthlyExpenses;
}
function noteOwnMatchForMonthlyExpenses(match){
  if(!MONTHLY_EXPENSES_ENABLED || !game || !match) return;
  if(Number(match.homeId) !== Number(game.selectedClubId) && Number(match.awayId) !== Number(game.selectedClubId)) return;
  const state = ensureMonthlyExpensesState();
  if(!state) return;
  state.matchesPlayed += 1;
}
function founderAdministrativeCostsActive(){
  return Boolean(FOUNDER_ADMIN_COSTS_ENABLED && game && typeof isFoundedClubId === 'function' && isFoundedClubId(game.selectedClubId));
}
function normalizeFounderAdministrativeCostsState(state={}){
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  return {
    lastChargeDate:validIsoDate(src.lastChargeDate) ? src.lastChargeDate : null,
    totalCharged:Math.max(0, Math.round(Number(src.totalCharged || 0))),
    daysCharged:Math.max(0, Math.round(Number(src.daysCharged || 0))),
    lastBreakdown:src.lastBreakdown && typeof src.lastBreakdown === 'object' && !Array.isArray(src.lastBreakdown) ? { ...src.lastBreakdown } : null
  };
}
function founderAdministrativeDivisionValue(source, order, fallback){
  const table = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
  const direct = Number(table[order] ?? table[String(order)]);
  if(Number.isFinite(direct)) return direct;
  const third = Number(table[3] ?? table['3']);
  return Number.isFinite(third) ? third : fallback;
}
function founderAdministrativeRosterValue(clubId=game?.selectedClubId){
  return (typeof playersByClub === 'function' ? playersByClub(clubId) : [])
    .filter(player => !player?.retired && !player?.sold)
    .reduce((sum, player) => sum + Math.max(0, Math.round(Number(player?.value || player?.clause || 0))), 0);
}
function founderAdministrativeCostBreakdown(clubId=game?.selectedClubId){
  const division = typeof clubDivision === 'function' ? clubDivision(clubId) : { order:3, name:'División inferior' };
  const order = Math.max(1, Math.min(3, Math.round(Number(division?.order || 3))));
  const rosterValue = founderAdministrativeRosterValue(clubId);
  const base = Math.max(0, Math.round(founderAdministrativeDivisionValue(FOUNDER_ADMIN_BASE_BY_DIVISION, order, 60000)));
  const rate = Math.max(0, Number(founderAdministrativeDivisionValue(FOUNDER_ADMIN_ROSTER_RATE_BY_DIVISION, order, 0.000010)));
  const total = Math.max(0, Math.round(base + (rosterValue * rate)));
  const source = FOUNDER_ADMIN_DISTRIBUTION && typeof FOUNDER_ADMIN_DISTRIBUTION === 'object' && !Array.isArray(FOUNDER_ADMIN_DISTRIBUTION) ? FOUNDER_ADMIN_DISTRIBUTION : {};
  const rows = [
    ['inscripcionLiga','Inscripción en la liga',0.18],
    ['seguridad','Seguridad',0.17],
    ['transporte','Transporte',0.20],
    ['administracion','Administración',0.15],
    ['mantenimientoMinimo','Mantenimiento mínimo',0.15],
    ['seguros','Seguros',0.15]
  ];
  const weights = rows.map(([key,,fallback]) => Math.max(0, Number(source[key] ?? fallback)));
  const weightTotal = weights.reduce((sum, value) => sum + value, 0) || 1;
  let allocated = 0;
  const items = rows.map(([key,label], index) => {
    const amount = index === rows.length - 1 ? Math.max(0, total - allocated) : Math.max(0, Math.round(total * (weights[index] / weightTotal)));
    allocated += amount;
    return { key, label, amount };
  });
  return { total, base, rate, rosterValue, divisionOrder:order, divisionName:String(division?.name || `División ${order}`), items };
}
function processFounderAdministrativeCostsDaily(){
  if(!founderAdministrativeCostsActive()) return 0;
  const today = validIsoDate(game?.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  if(!validIsoDate(today)) return 0;
  game.founderAdministrativeCosts = normalizeFounderAdministrativeCostsState(game.founderAdministrativeCosts || {});
  if(game.founderAdministrativeCosts.lastChargeDate === today) return 0;
  const breakdown = founderAdministrativeCostBreakdown(game.selectedClubId);
  if(breakdown.total <= 0){ game.founderAdministrativeCosts.lastChargeDate = today; return 0; }
  recordBudgetChange(-breakdown.total, 'Costos administrativos diarios', {
    type:'founder_admin_daily',
    clubId:Number(game.selectedClubId || 0),
    divisionOrder:breakdown.divisionOrder,
    rosterValue:breakdown.rosterValue,
    breakdown:Object.fromEntries(breakdown.items.map(item => [item.key, item.amount]))
  });
  game.founderAdministrativeCosts.lastChargeDate = today;
  game.founderAdministrativeCosts.totalCharged += breakdown.total;
  game.founderAdministrativeCosts.daysCharged += 1;
  game.founderAdministrativeCosts.lastBreakdown = { date:today, ...breakdown };
  return breakdown.total;
}
function founderAdministrativeCostsMarkup(){
  if(!founderAdministrativeCostsActive()) return '';
  const breakdown = founderAdministrativeCostBreakdown(game.selectedClubId);
  const rows = breakdown.items.map(item => `<div class="card"><p class="label">${escapeHtml(item.label)}</p><strong>${formatMoney(item.amount)}</strong><p class="muted small">por día</p></div>`).join('');
  return `<div class="card" style="margin-top:14px"><div class="row"><div><p class="label">Dificultad del club fundador</p><h3>Costos administrativos diarios</h3><p class="muted small">Estimación actual según ${escapeHtml(breakdown.divisionName)} y un plantel valuado en ${formatMoney(breakdown.rosterValue)}.</p></div><strong class="bad">-${formatMoney(breakdown.total)} / día</strong></div><div class="grid cols-3" style="margin-top:12px">${rows}</div></div>`;
}
function processMonthlyClubExpensesDaily(){
  if(!MONTHLY_EXPENSES_ENABLED || !game) return 0;
  const state = ensureMonthlyExpensesState();
  if(!state) return 0;
  const today = game.currentDate || currentCalendarDate();
  if(!validIsoDate(today) || !validIsoDate(state.lastChargeDate)) return 0;
  const elapsed = daysBetweenIsoDates(state.lastChargeDate, today);
  if(elapsed < 30) return 0;
  const months = Math.max(1, Math.floor(elapsed / 30));
  const matches = Math.max(0, Math.round(Number(state.matchesPlayed || 0)));
  const capacity = typeof clubStadiumCapacity === 'function' ? Math.max(0, Math.round(Number(clubStadiumCapacity(game.selectedClubId) || 0))) : 0;
  const fans = typeof clubFansCurrent === 'function' ? Math.max(0, Math.round(Number(clubFansCurrent(game.selectedClubId) || 0))) : 0;
  let charged = 0;
  for(let i=0; i<months; i++){
    const tax = Math.round(Math.max(0, Number(game.budget || 0)) * MONTHLY_PROFIT_TAX_RATE);
    if(tax > 0){ recordBudgetChange(-tax, 'Impuesto mensual de riqueza', { type:'monthly_wealth_tax', rate:MONTHLY_PROFIT_TAX_RATE, managerClubOnly:true }); charged += tax; }
  }
  if(matches > 0){
    const electricity = Math.round(matches * (MONTHLY_ELECTRICITY_BASE_PER_MATCH + (capacity * MONTHLY_ELECTRICITY_CAPACITY_FACTOR)));
    const cleaning = Math.round(MONTHLY_CLEANING_PER_FAN_PER_MATCH * matches * fans);
    if(electricity > 0){ recordBudgetChange(-electricity, 'Electricidad mensual del club', { type:'monthly_electricity', matches, capacity }); charged += electricity; }
    if(cleaning > 0){ recordBudgetChange(-cleaning, 'Limpieza general mensual', { type:'monthly_cleaning', matches, fans }); charged += cleaning; }
  }
  state.matchesPlayed = 0;
  state.lastChargeDate = addDaysToIsoDate(state.lastChargeDate, months * 30);
  return charged;
}

const SCHEDULED_STRUCTURE_VERIFIER_DAYS = Object.freeze([1,31,151,179,295,355]);

function scheduledStructureVerifierKey(season, day){
  return `${Math.max(1, Math.round(Number(season || 1)))}:${Math.max(1, Math.round(Number(day || 1)))}`;
}
function scheduledStructureVerifierUnresolvedCount(result){
  return Number(result?.issues?.length || 0) + Number(result?.warnings?.length || 0);
}
function runScheduledSeasonGameVerifier(options={}){
  const summary = {
    ran:false,
    repaired:false,
    reason:options.reason || 'scheduled_structure_verifier',
    season:Number(game?.seasonNumber || 0),
    seasonDay:0,
    scheduledDay:0,
    date:'',
    statsFixed:0,
    botRosters:0,
    structureMoves:0,
    fixturesRebuilt:0,
    unresolved:0
  };
  if(!game) return summary;
  const today = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  summary.date = today;
  if(!validIsoDate(today)) return summary;
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  const seasonDay = typeof currentGlobalDayNumber === 'function'
    ? Math.max(1, Math.round(Number(currentGlobalDayNumber() || 1)))
    : Math.max(1, Math.round(Number(seasonDayFromDate(today, currentSeasonYear()) || 1)));
  summary.season = season;
  summary.seasonDay = seasonDay;
  const state = game.scheduledVerifierState = (game.scheduledVerifierState && typeof game.scheduledVerifierState === 'object' && !Array.isArray(game.scheduledVerifierState)) ? game.scheduledVerifierState : {};
  state.version = 2;
  state.completedKeys = Array.isArray(state.completedKeys) ? state.completedKeys.map(String).slice(-48) : [];
  const requestedDay = Math.max(0, Math.round(Number(options.scheduledDay || 0)));
  const hasSeasonHistory = Number(state.lastSeason || 0) === season && (Number(state.lastSeasonDay || 0) > 0 || validIsoDate(state.lastDate) || state.completedKeys.some(item => item.startsWith(`${season}:`)));
  if(!requestedDay && options.force !== true && !SCHEDULED_STRUCTURE_VERIFIER_DAYS.includes(seasonDay) && !hasSeasonHistory){
    state.lastDate = today;
    state.lastSeason = season;
    state.lastSeasonDay = seasonDay;
    return summary;
  }
  let previousDay = 0;
  if(Number(state.lastSeason || 0) === season){
    previousDay = Math.max(0, Math.round(Number(state.lastSeasonDay || 0)));
    if(!previousDay && validIsoDate(state.lastDate)) previousDay = Math.max(0, Math.round(Number(seasonDayFromDate(state.lastDate, currentSeasonYear()) || 0)));
  }
  const crossedDay = SCHEDULED_STRUCTURE_VERIFIER_DAYS.find(day => day > previousDay && day <= seasonDay && !state.completedKeys.includes(scheduledStructureVerifierKey(season, day))) || 0;
  const scheduledDay = requestedDay || (SCHEDULED_STRUCTURE_VERIFIER_DAYS.includes(seasonDay) ? seasonDay : crossedDay);
  if(!scheduledDay && options.force !== true){
    state.lastDate = today;
    state.lastSeason = season;
    state.lastSeasonDay = seasonDay;
    return summary;
  }
  summary.scheduledDay = scheduledDay || seasonDay;
  const key = scheduledStructureVerifierKey(season, summary.scheduledDay);
  if(options.force !== true && state.completedKeys.includes(key)) return summary;
  summary.ran = true;

  if(typeof runDailyMatchStatsIntegrityRepair === 'function'){
    const statsRepair = runDailyMatchStatsIntegrityRepair({ reason:summary.reason, force:true, silent:true });
    summary.statsFixed = Number(statsRepair?.fixed || 0);
  }
  if(typeof repairBotRosters === 'function'){
    const rosterRepair = repairBotRosters({ reason:summary.reason });
    summary.botRosters = Number(rosterRepair?.created || 0) + Number(rosterRepair?.converted || 0);
  }
  if(game.seasonPhase === 'postseason' && typeof ensurePostseasonCalendar === 'function'){
    ensurePostseasonCalendar(game);
  }

  let result = typeof inspectGameIntegrity === 'function' ? inspectGameIntegrity() : null;
  if(result?.canRepair && typeof applySafeGameIntegrityRepairsCore === 'function'){
    result = applySafeGameIntegrityRepairsCore({ reason:summary.reason, allowDivisionCountRepair:false, message:true });
    summary.structureMoves = Number(result?.repairedCount || 0);
    summary.fixturesRebuilt = Number(result?.fixturesRebuiltCount || 0);
    summary.statsFixed = Math.max(summary.statsFixed, Number(result?.botStatsRepairedCount || 0));
  }
  summary.unresolved = scheduledStructureVerifierUnresolvedCount(result);
  summary.repaired = Boolean(summary.statsFixed || summary.botRosters || summary.structureMoves || summary.fixturesRebuilt);

  state.completedKeys = [...state.completedKeys.filter(item => item !== key), key].slice(-48);
  state.lastKey = key;
  state.lastDate = today;
  state.lastSeason = season;
  state.lastSeasonDay = summary.scheduledDay;
  state.lastGlobalTurn = Number(game.globalTurn || 0);
  state.lastSummary = { ...summary, checkedAt:new Date().toISOString() };
  game.scheduledVerifierLog = Array.isArray(game.scheduledVerifierLog) ? game.scheduledVerifierLog.slice(-17) : [];
  game.scheduledVerifierLog.push(state.lastSummary);

  if(summary.repaired && options.silent !== true && typeof showNotice === 'function'){
    showNotice('La organización confirmó ajustes administrativos en la programación.', false);
  }
  if(summary.unresolved > 0){
    const messageId = `scheduled-structure-verifier-${season}-${summary.scheduledDay}`;
    if(typeof pushGameMessage === 'function'){
      pushGameMessage({
        id:messageId,
        type:'federación',
        priority:'high',
        title:'Partidos bajo revisión de la federación',
        body:`La federación informó que todavía hay ${summary.unresolved === 1 ? 'un encuentro' : `${summary.unresolved} encuentros`} cuya programación necesita ser confirmada. Los clubes serán notificados cuando se definan las nuevas condiciones.`
      });
    }
    if(options.silent !== true && typeof showNotice === 'function') showNotice('La federación mantiene algunos encuentros bajo revisión.', true);
  }
  return summary;
}

function processDailyCalendarState(dateAfter='', options={}){
  if(!game) return { botResults:[], recovered:0, bankPayment:0 };
  const skipTraining = Boolean(options.skipTraining);
  const simulateBots = options.simulateBots !== false;
  const managerWithoutClub = Boolean(game?.gameOver?.active || options.managerWithoutClub);
  const includeOwn = managerWithoutClub ? true : options.includeOwn === true;
  game.currentDate = validIsoDate(dateAfter) ? dateAfter : addDaysToIsoDate(currentCalendarDate(), 1);
  rememberCalendarDate();
  advanceGlobalTurn();
  const specialCardUsage = typeof processActiveSpecialCardUsageDaily === 'function' ? processActiveSpecialCardUsageDaily({ save:false, source:'daily_calendar' }) : { processed:0, consumed:0, expired:0 };
  const managerSalaryPayment = typeof processManagerSalaryDaily === 'function' ? processManagerSalaryDaily() : 0;
  const financialStaffDismissalsAtStart = typeof dismissAllStaffForFinancialCrisis === 'function'
    ? dismissAllStaffForFinancialCrisis({ silent:true })
    : [];
  const afaFieldSanction = typeof processAfaFieldSanctionDaily === 'function'
    ? processAfaFieldSanctionDaily()
    : { sanctioned:false, restored:false, charged:0 };
  if(typeof ensureClubWorldCupCurrentSeason === 'function') ensureClubWorldCupCurrentSeason({ source:'daily_calendar' });
  if(typeof prepareClubWorldCupParticipantsIfNeeded === 'function') prepareClubWorldCupParticipantsIfNeeded({ source:'daily_calendar' });
  const nationalCupDaily = typeof processNationalCupsDaily === 'function' ? processNationalCupsDaily({ source:'daily_calendar' }) : null;
  const libertadoresDaily = typeof processLibertadoresDaily === 'function' ? processLibertadoresDaily({ source:'daily_calendar' }) : null;
  const championsLeagueDaily = typeof processChampionsLeagueDaily === 'function' ? processChampionsLeagueDaily({ source:'daily_calendar' }) : null;
  if(managerWithoutClub){
    if(typeof processAcademyTurn === 'function') processAcademyTurn();
    if(typeof processManagerAcademyFacilitiesDaily === 'function') processManagerAcademyFacilitiesDaily(1);
    const managerPortfolio = typeof processManagerPlayerPortfolioDaily === 'function' ? processManagerPlayerPortfolioDaily() : null;
    const botMarketStrategies = typeof processBotMarketStrategiesDaily === 'function' ? processBotMarketStrategiesDaily({ reason:'daily_calendar_managerless' }) : null;
    const eliteBotMarket = typeof processEliteBotMarketDaily === 'function' ? processEliteBotMarketDaily({ reason:'daily_calendar_managerless' }) : null;
    const recovered = clearRecoveredDailyInjuries();
    const botResults = simulateBots ? simulateDueMatchesUntil(game.currentDate, { includeOwn:true }) : [];
    if(botResults.length) processNonOwnResultsAfterSimulation(botResults);
    else if(typeof recoverBotWearDaily === 'function') recoverBotWearDaily({ reason:'daily_sin_club_rest', allClubs:true });
    const integrityRepair = typeof runDailyMatchStatsIntegrityRepair === 'function'
      ? runDailyMatchStatsIntegrityRepair({ reason:'daily_calendar_state_sin_club', silent:true })
      : { fixed:0, remaining:0 };
    const scheduledVerifier = runScheduledSeasonGameVerifier({ reason:'daily_calendar_state_sin_club' });
    const postCompetition = typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
    const jobMarket = typeof processManagerJobMarketDaily === 'function' ? processManagerJobMarketDaily() : null;
    const clubWorldCupPreparation = typeof prepareClubWorldCupParticipantsIfNeeded === 'function' ? prepareClubWorldCupParticipantsIfNeeded({ source:'daily_calendar_complete' }) : null;
    const scheduledRankingUpload = typeof processScheduledCareerRankingUploads === 'function' ? processScheduledCareerRankingUploads({ source:'daily_calendar_managerless' }) : null;
    return { botResults, recovered, bankPayment:0, managerSalaryPayment, specialCardUsage, integrityRepair, scheduledVerifier, postCompetition, jobMarket, clubWorldCupPreparation, nationalCupDaily, libertadoresDaily, championsLeagueDaily, botMarketStrategies, eliteBotMarket, scheduledRankingUpload, financialStaffDismissalsAtStart, afaFieldSanction };
  }
  if(!skipTraining) applyTrainingEffects();
  const kinesioDifferentiated = typeof processKinesiologistDifferentiatedDays === 'function'
    ? processKinesiologistDifferentiatedDays(1, { source:'daily_calendar_state' })
    : (typeof processKinesiologistDifferentiatedDaily === 'function' ? processKinesiologistDifferentiatedDaily() : { applied:false });
  const kinesioAutomatic = typeof processAutomaticKinesiologistTreatmentsDaily === 'function'
    ? processAutomaticKinesiologistTreatmentsDaily()
    : { active:false, attempted:0 };
  if(typeof processAcademyTurn === 'function') processAcademyTurn();
  const managerPortfolio = typeof processManagerPlayerPortfolioDaily === 'function' ? processManagerPlayerPortfolioDaily() : null;
  if(typeof processPendingTransfers === 'function') processPendingTransfers();
  const botMarketStrategies = typeof processBotMarketStrategiesDaily === 'function' ? processBotMarketStrategiesDaily({ reason:'daily_calendar' }) : null;
  const eliteBotMarket = typeof processEliteBotMarketDaily === 'function' ? processEliteBotMarketDaily({ reason:'daily_calendar' }) : null;
  const automaticClauseSales = typeof processUnansweredSpecialClauseOffers === 'function'
    ? processUnansweredSpecialClauseOffers({ silent:true, source:'daily_calendar' })
    : { accepted:0, closed:0 };
  if(typeof processStadiumExpansionDays === 'function') processStadiumExpansionDays(1);
  if(typeof processClubFacilitiesDaily === 'function') processClubFacilitiesDaily(1);
  if(typeof processManagerAcademyFacilitiesDaily === 'function') processManagerAcademyFacilitiesDaily(1);
  const recovered = clearRecoveredDailyInjuries();
  const firstTeamInjuryMinimum = typeof processFirstTeamInjuryMinimumDaily === 'function'
    ? processFirstTeamInjuryMinimumDaily({ source:'daily_calendar_state' })
    : { applied:false };
  const bankPayment = processBankLoanDailySchedule();
  if(typeof processSponsorContracts === 'function') processSponsorContracts();
  if(typeof processMemberCampaigns === 'function') processMemberCampaigns(1);
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily();
  if(typeof maybePushAssistantAdviceMessage === 'function') maybePushAssistantAdviceMessage('daily');
  processMonthlyClubExpensesDaily();
  const founderAdministrativeCost = processFounderAdministrativeCostsDaily();
  const botResults = simulateBots ? simulateDueMatchesUntil(game.currentDate, { includeOwn }) : [];
  if(botResults.length) processNonOwnResultsAfterSimulation(botResults);
  else if(typeof recoverBotWearDaily === 'function') recoverBotWearDaily({ reason:'daily_rest' });
  const lockerRoomProblem = typeof processLockerRoomProblemsDaily === 'function'
    ? processLockerRoomProblemsDaily({ reason:'daily_calendar_state' })
    : { active:false, checked:false, triggered:false };
  const integrityRepair = typeof runDailyMatchStatsIntegrityRepair === 'function'
    ? runDailyMatchStatsIntegrityRepair({ reason:'daily_calendar_state', silent:true })
    : { fixed:0, remaining:0 };
  const scheduledVerifier = runScheduledSeasonGameVerifier({ reason:'daily_calendar_state' });
  const postCompetition = typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
  const clubWorldCupPreparation = typeof prepareClubWorldCupParticipantsIfNeeded === 'function' ? prepareClubWorldCupParticipantsIfNeeded({ source:'daily_calendar_complete' }) : null;
  const financialStaffDismissalsAtEnd = typeof dismissAllStaffForFinancialCrisis === 'function'
    ? dismissAllStaffForFinancialCrisis({ silent:true })
    : [];
  const scheduledRankingUpload = typeof processScheduledCareerRankingUploads === 'function' ? processScheduledCareerRankingUploads({ source:'daily_calendar' }) : null;
  return { botResults, recovered, bankPayment, managerSalaryPayment, specialCardUsage, automaticClauseSales, founderAdministrativeCost, kinesioDifferentiated, kinesioAutomatic, firstTeamInjuryMinimum, lockerRoomProblem, integrityRepair, scheduledVerifier, postCompetition, clubWorldCupPreparation, nationalCupDaily, libertadoresDaily, championsLeagueDaily, botMarketStrategies, eliteBotMarket, scheduledRankingUpload, financialStaffDismissalsAtStart, financialStaffDismissalsAtEnd, afaFieldSanction };
}
function setAutoAdvanceButtonLoading(active){
  const btn = $('advanceUnifiedBtn') || $('advanceMatchBtn') || $('advanceDayBtn');
  if(!btn) return;
  btn.classList.toggle('is-loading', Boolean(active));
  btn.disabled = Boolean(active);
  btn.innerHTML = active ? '<span class="mini-spinner" aria-hidden="true"></span><span>Avanzando...</span>' : 'Avanzar día';
}
function showAutoAdvanceOverlay(totalDays, currentDate='', targetDate=''){
  let root = $('autoAdvanceOverlay');
  if(root) root.remove();
  const host = $('advanceProgressBox');
  root = document.createElement('div');
  root.id = 'autoAdvanceOverlay';
  root.className = host ? 'auto-advance-inline' : 'auto-advance-floating';
  root.innerHTML = `<div class="auto-advance-card">
    <div class="auto-advance-head"><div class="turn-spinner" aria-hidden="true"></div><strong>Avanzando días</strong></div>
    <span class="auto-advance-status">Preparando calendario diario...</span>
    <div class="turn-transition-bar"><i style="width:0%"></i></div>
    <p class="muted small">${escapeHtml(currentDate || '—')} → ${escapeHtml(targetDate || '—')} · ${totalDays} día${totalDays === 1 ? '' : 's'}</p>
  </div>`;
  if(host){ host.innerHTML = ''; host.appendChild(root); }
  else document.body.appendChild(root);
  setAutoAdvanceButtonLoading(true);
  return root;
}
function updateAutoAdvanceOverlay(root, data={}){
  if(!root) return;
  const pct = clamp(Math.round(Number(data.progress || 0) * 100), 0, 100);
  const status = root.querySelector('.auto-advance-status');
  const bar = root.querySelector('.turn-transition-bar i');
  if(status) status.textContent = data.text || 'Avanzando calendario...';
  if(bar) bar.style.width = `${pct}%`;
}
function closeAutoAdvanceOverlay(root){
  if(root){
    root.classList.add('is-exiting');
    setTimeout(()=>{
      root.remove();
      const box = $('advanceProgressBox');
      if(box && !box.querySelector('[data-advance-progress-fill]')) box.innerHTML = advanceProgressMarkup();
      updateAdvanceProgressBox();
    }, 260);
  }
  setAutoAdvanceButtonLoading(false);
}
function startAutoAdvanceToNextOwnMatch(){
  if(!game || !isRegularSeason()) return false;
  if(startAutoAdvanceToNextOwnMatch.active){ showNotice('Ya se está avanzando el calendario diario.'); return true; }
  const ownInfo = nextOwnMatchInfo();
  if(!ownInfo?.date){ showNotice('No hay próximo partido propio programado.'); return false; }
  const fromDate = currentCalendarDate();
  const targetDate = ownInfo.date;
  if(!isCurrentDateBeforeIso(targetDate)){
    const bots = simulateNonOwnDueBeforeOwnMatch(targetDate, 'own_match_day_ready');
    if(bots.length){ saveLocal(true); renderAll(); showNotice(`Se simularon ${bots.length} partido(s) pendientes del día. Ya podés jugar tu partido.`); return true; }
    return false;
  }
  const totalDays = Math.max(1, daysBetweenIsoDates(fromDate, targetDate));
  const duration = Math.max(1200, isAdvanceLocked() ? advanceLockLeftMs() : ADVANCE_LOCK_MS);
  const stepMs = Math.max(120, Math.round(duration / totalDays));
  const overlay = showAutoAdvanceOverlay(totalDays, fromDate, targetDate);
  const processed = { days:0, bots:0, recovered:0 };
  startAutoAdvanceToNextOwnMatch.active = true;
  setAdvanceLock(duration);
  const tick = () => {
    if(!game || !isRegularSeason()){
      startAutoAdvanceToNextOwnMatch.active = false;
      closeAutoAdvanceOverlay(overlay);
      return;
    }
    const current = currentCalendarDate();
    if(!validIsoDate(current) || daysBetweenIsoDates(current, targetDate) <= 0){
      const sameDayBots = simulateNonOwnDueBeforeOwnMatch(targetDate, 'auto_advance_target_day');
      processed.bots += sameDayBots.length;
      game.currentDate = targetDate;
      rememberCalendarDate();
      runScheduledSeasonGameVerifier({ reason:'auto_advance_target_day' });
      setAdvanceLock(0);
      setDailyAdvanceSummary(fromDate, targetDate, processed.bots);
      saveLocal(true);
      renderAll();
      updateAutoAdvanceOverlay(overlay, { progress:1, text:`Listo. Llegaste al día del partido: ${targetDate}.` });
      setTimeout(()=>closeAutoAdvanceOverlay(overlay), 650);
      startAutoAdvanceToNextOwnMatch.active = false;
      showNotice(`Calendario avanzado. Se simularon ${processed.bots} partido(s) bot en el camino. Ya podés jugar tu partido.`);
      return;
    }
    const nextDate = addDaysToIsoDate(current, 1);
    const dayResult = processDailyCalendarState(nextDate, { includeOwn:false });
    if(game?.gameOver?.active){
      startAutoAdvanceToNextOwnMatch.active = false;
      setAdvanceLock(0);
      closeAutoAdvanceOverlay(overlay);
      saveLocal(true);
      renderAll();
      showNotice('La directiva resolvió tu continuidad. Revisá el mensaje recibido.');
      return;
    }
    processed.days += 1;
    processed.bots += dayResult.botResults.length;
    processed.recovered += dayResult.recovered;
    updateAutoAdvanceOverlay(overlay, {
      progress:processed.days / totalDays,
      text:`${matchDateLabel(nextDate)} · ${dayResult.botResults.length ? `${dayResult.botResults.length} partido(s) bot simulados` : 'sin partidos bot'}`
    });
    setTimeout(tick, stepMs);
  };
  tick();
  return true;
}
function startPostseasonPhase(anchorDate=null){
  if(!game) return;
  const anchor = validIsoDate(anchorDate)
    ? anchorDate
    : (validIsoDate(game.currentDate) ? game.currentDate : (latestKnownCalendarDateForState(game, currentSeasonYear()) || lastFixtureMatchDate(game) || seasonEndDateForYear(currentSeasonYear())));
  game.seasonPhase = 'postseason';
  game.phaseTurn = 0;
  game.postseasonStartDate = '';
  game.postseasonTotalTurns = 0;
  const calendar = typeof ensurePostseasonCalendar === 'function' ? ensurePostseasonCalendar(game, { reset:true, anchorDate:anchor }) : null;
  game.currentDate = validIsoDate(calendar?.startDate) ? calendar.startDate : addDaysToIsoDate(anchor, 1);
  rememberCalendarDate();
}

function completeRegularSeasonIfNeeded(){
  if(!game || !isRegularSeason()) return false;
  if(game.matchdayIndex < game.fixtures.length) return false;
  const postCompetition = typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
  if(postCompetition?.created){
    saveLocal(true);
    renderAll();
    showNotice(`${postCompetition.message || 'Se creó una competición de cierre de temporada.'} Ya podés avanzar al partido siguiente.`, true);
    return true;
  }
  startPostseasonPhase();
  setAdvanceLock(0);
  saveLocal(true);
  renderAll();
  showNotice('La fase regular terminó. Comienza la postemporada.', true);
  return true;
}
function applyUnifiedAdvanceCooldown(reason='daily'){
  if(!game) return;
  const duration = Math.max(0, DAY_ADVANCE_LOCK_MS || ADVANCE_LOCK_MS || 20000);
  setAdvanceLock(duration);
  game.lastAdvanceCooldownReason = reason;
}

const ADVANCE_AUTO_CLICKER_POLL_MS = 650;
const advanceAutoClickerState = { active:false, timer:null, running:false };
function isAdvanceAutoClickerActive(){ return Boolean(advanceAutoClickerState.active); }
function updateAdvanceAutoClickerButton(){
  const btn = $('advanceAutoClickerBtn');
  if(!btn) return;
  const active = isAdvanceAutoClickerActive();
  const label = btn.querySelector('[data-auto-advance-state]');
  const seasonEnded = Boolean(game?.seasonFinalized || (typeof seasonPhase === 'function' && seasonPhase() === 'finalized'));
  const unavailable = Boolean(seasonEnded || game?.gameOver?.active);
  btn.classList.toggle('is-active', active);
  btn.classList.toggle('is-on', active);
  btn.classList.toggle('is-off', !active);
  btn.classList.toggle('is-disabled', unavailable);
  btn.setAttribute('aria-pressed', active ? 'true' : 'false');
  btn.title = unavailable ? 'Avance automático no disponible' : (active ? 'Desactivar avance automático' : 'Activar avance automático');
  if(label) label.textContent = active ? 'ON' : 'OFF';
  btn.disabled = unavailable;
}
function stopAdvanceAutoClicker(reason='', silent=false){
  if(advanceAutoClickerState.timer){
    clearTimeout(advanceAutoClickerState.timer);
    advanceAutoClickerState.timer = null;
  }
  const wasActive = advanceAutoClickerState.active;
  advanceAutoClickerState.active = false;
  advanceAutoClickerState.running = false;
  updateAdvanceAutoClickerButton();
  if(wasActive && reason && !silent) showNotice(`Auto avance detenido: ${reason}`);
}
function advanceAutoClickerStopReason(){
  if(!game) return 'no hay partida activa';
  if(game.gameOver?.active) return 'el manager está sin club';
  if(game.seasonFinalized || (typeof seasonPhase === 'function' && seasonPhase() === 'finalized')) return 'la temporada está finalizada';
  if($('modalRoot')) return 'hay una ventana abierta';
  if(game.mustReviewTactics) return 'hay revisión táctica obligatoria';
  const ownInfo = typeof nextOwnMatchInfo === 'function' ? nextOwnMatchInfo() : null;
  const ownDueToday = Boolean(typeof isRegularSeason === 'function' && isRegularSeason() && ownInfo?.date && typeof isCurrentDateOnOrAfterIso === 'function' && isCurrentDateOnOrAfterIso(ownInfo.date));
  if(ownDueToday && typeof validateCurrentTactic === 'function'){
    const invalid = validateCurrentTactic(false);
    if(Array.isArray(invalid) && invalid.length) return 'la táctica está incompleta';
  }
  return '';
}
function scheduleAdvanceAutoClickerTick(delay=ADVANCE_AUTO_CLICKER_POLL_MS){
  if(!advanceAutoClickerState.active) return;
  if(advanceAutoClickerState.timer) clearTimeout(advanceAutoClickerState.timer);
  const safeDelay = Math.max(200, Math.round(Number(delay) || ADVANCE_AUTO_CLICKER_POLL_MS));
  advanceAutoClickerState.timer = setTimeout(runAdvanceAutoClickerTick, safeDelay);
}
function runAdvanceAutoClickerTick(){
  if(!advanceAutoClickerState.active) return;
  const stopReason = advanceAutoClickerStopReason();
  if(stopReason){ stopAdvanceAutoClicker(stopReason); return; }
  if(startAutoAdvanceToNextOwnMatch?.active){
    scheduleAdvanceAutoClickerTick(ADVANCE_AUTO_CLICKER_POLL_MS);
    return;
  }
  const lockLeft = typeof advanceLockLeftMs === 'function' ? advanceLockLeftMs() : 0;
  if(lockLeft > 0){
    updateAdvanceButtonState?.();
    scheduleAdvanceAutoClickerTick(Math.min(lockLeft + 250, 5000));
    return;
  }
  if(advanceAutoClickerState.running){
    scheduleAdvanceAutoClickerTick(ADVANCE_AUTO_CLICKER_POLL_MS);
    return;
  }
  advanceAutoClickerState.running = true;
  try{
    advanceCalendarOneStep();
  }catch(error){
    console.error('Auto avance falló', error);
    stopAdvanceAutoClicker('se produjo un error al avanzar');
    return;
  }finally{
    advanceAutoClickerState.running = false;
  }
  if(advanceAutoClickerState.active){
    const nextLock = typeof advanceLockLeftMs === 'function' ? advanceLockLeftMs() : 0;
    scheduleAdvanceAutoClickerTick(nextLock > 0 ? Math.min(nextLock + 250, 5000) : ADVANCE_AUTO_CLICKER_POLL_MS);
  }
}
function startAdvanceAutoClicker(){
  if(isAdvanceAutoClickerActive()) return;
  const stopReason = advanceAutoClickerStopReason();
  if(stopReason){ showNotice(`Auto avance no iniciado: ${stopReason}.`); return; }
  advanceAutoClickerState.active = true;
  updateAdvanceAutoClickerButton();
  showNotice('Auto avance activado. Avanzará cada vez que termine el bloqueo.');
  scheduleAdvanceAutoClickerTick(200);
}
function toggleAdvanceAutoClicker(){
  if(isAdvanceAutoClickerActive()) stopAdvanceAutoClicker('desactivado manualmente');
  else startAdvanceAutoClicker();
}
function advanceWithoutClubCalendarOneStep(){
  if(!game || !game.gameOver?.active) return false;
  if(game.seasonFinalized){ showNotice('La temporada está finalizada. Firmá con un club o usá el cierre de temporada cuando corresponda.'); return true; }
  if(isAdvanceLocked()){ showNotice(`Avance bloqueado por ${formatClock(advanceLockLeftMs())}.`); return true; }
  const fromDate = currentCalendarDate();
  const nextDate = addDaysToIsoDate(fromDate, 1);
  const dayResult = processDailyCalendarState(nextDate, { includeOwn:true, managerWithoutClub:true });
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const postCompetition = regularEnded && typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
  if(postCompetition?.created) regularEnded = game.matchdayIndex >= game.fixtures.length;
  if(regularEnded && isRegularSeason() && !postCompetition?.created){
    startPostseasonPhase(nextDate);
    setAdvanceLock(0);
  }else{
    applyUnifiedAdvanceCooldown('daily');
  }
  setDailyAdvanceSummary(fromDate, nextDate, dayResult.botResults.length);
  if(game.lastTurnSummary){
    game.lastTurnSummary.title = 'Avance sin club';
    game.lastTurnSummary.items = [
      { label:'Calendario', text:dayResult.botResults.length ? `Se simularon ${dayResult.botResults.length} partido(s) del mundo.` : 'El mundo avanzó un día sin partidos pendientes.', tone:dayResult.botResults.length ? 'ok' : 'info' },
      { label:'Mercado laboral', text:dayResult.jobMarket?.offers ? 'Llegó una nueva oferta para dirigir.' : 'Se revisaron ofertas y solicitudes laborales.', tone:dayResult.jobMarket?.offers ? 'ok' : 'info' }
    ];
  }
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(dayResult.jobMarket?.offers) showNotice(`Avanzaste al ${nextDate}. Llegó una oferta laboral.`);
  else if(dayResult.jobMarket?.applications) showNotice(`Avanzaste al ${nextDate}. Respondieron una solicitud laboral.`);
  else showNotice(`Avanzaste al ${nextDate}. Calendario y tablas actualizados.`);
  return true;
}

function advanceCalendarOneStep(){
  if(!game || game.seasonFinalized) return;
  if(game.gameOver?.active){ advanceWithoutClubCalendarOneStep(); return; }
  if(typeof hasPendingLockerRoomDecision === 'function' && hasPendingLockerRoomDecision()){
    if(typeof stopAdvanceAutoClicker === 'function') stopAdvanceAutoClicker();
    activeTab = 'messages';
    if(typeof renderAll === 'function') renderAll();
    showNotice(typeof lockerRoomDecisionBlockText === 'function' ? lockerRoomDecisionBlockText() : 'Respondé el problema de vestuario pendiente antes de avanzar.');
    return;
  }
  if(startAutoAdvanceToNextOwnMatch.active){ showNotice('Ya se está procesando el calendario.'); return; }
  if(isAdvanceLocked()){ showNotice(`Avance bloqueado por ${formatClock(advanceLockLeftMs())}.`); return; }
  const upcomingDateForRepair = addDaysToIsoDate(currentCalendarDate(), 1);
  repairBotRosters({ reason:'before_unified_day_advance', dueDate:upcomingDateForRepair });
  if(typeof runDailyMatchStatsIntegrityRepair === 'function'){
    const integrity = runDailyMatchStatsIntegrityRepair({ reason:'before_unified_day_advance', force:false, scope:'recent', silent:true });
    if(integrity.remaining > 0){
      showNotice(`Hay ${integrity.remaining} partido(s) recientes sin datos mínimos que no pudieron repararse de forma segura. Usá el verificador antes de avanzar.`);
      return;
    }
  }
  if(isPreseason()){
    simulatePreseasonTurn();
    return;
  }
  if(isPostseason()){
    simulatePostseasonTurn();
    return;
  }
  if(!isRegularSeason()){
    simulateNextMatchday({ advanceLabel:'Avanzando día' });
    return;
  }
  if(completeRegularSeasonIfNeeded()) return;
  const ownInfo = nextOwnMatchInfo();
  if(ownInfo?.date && isCurrentDateOnOrAfterIso(ownInfo.date)){
    simulateNextMatchday({ advanceLabel:'Jugando partido propio' });
    return;
  }
  const fromDate = currentCalendarDate();
  const nextDate = addDaysToIsoDate(fromDate, 1);
  const dayResult = processDailyCalendarState(nextDate, { includeOwn:false });
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const postCompetition = regularEnded && typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
  if(postCompetition?.created) regularEnded = game.matchdayIndex >= game.fixtures.length;
  if(regularEnded && !postCompetition?.created){
    startPostseasonPhase(nextDate);
    setAdvanceLock(0);
  }else{
    applyUnifiedAdvanceCooldown('daily');
  }
  setDailyAdvanceSummary(fromDate, nextDate, dayResult.botResults.length);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(postCompetition?.created) showNotice(postCompetition.message || 'Se creó una competición de cierre de temporada.', true);
  else if(regularEnded) showNotice('Se completaron los partidos pendientes y terminó la fase regular.', true);
  else if(dayResult.botResults.length) showNotice(`Avanzaste al ${nextDate}. Se procesaron ${dayResult.botResults.length} partido(s) bot durante el cooldown.`);
  else showNotice(`Avanzaste al ${nextDate}. Verificaciones listas; el botón queda en cooldown.`);
}

function finalizeLiveOwnMatchdayResult(context, ownResult){
  if(!game || !ownResult || !context) return;
  const {
    ownInfo,
    pendingInfo,
    targetDate,
    preOwnBotResults,
    budgetBeforeTurn,
    fromRoundIndex
  } = context;
  ownResult = typeof finalizeWinnerRequiredMatchResult === 'function' ? finalizeWinnerRequiredMatchResult(ownInfo?.match, ownResult) : ownResult;
  ownResult = typeof finalizeClubWorldCupMatchResult === 'function' ? finalizeClubWorldCupMatchResult(ownInfo?.match, ownResult) : ownResult;
  ownResult = typeof finalizeNationalCupMatchResult === 'function' ? finalizeNationalCupMatchResult(ownInfo?.match, ownResult) : ownResult;
  ownResult = typeof finalizeLibertadoresMatchResult === 'function' ? finalizeLibertadoresMatchResult(ownInfo?.match, ownResult) : ownResult;
  ownResult = typeof finalizeChampionsLeagueMatchResult === 'function' ? finalizeChampionsLeagueMatchResult(ownInfo?.match, ownResult) : ownResult;
  const results = [ownResult];
  if(ownInfo?.match) markScheduledResult({ match:ownInfo.match, date:targetDate }, ownResult);
  game.matchHistory.push(ownResult);
  advanceCompletedRegularRounds();
  if(typeof advanceNationalCupsIfNeeded === 'function') advanceNationalCupsIfNeeded();
  if(typeof advanceLibertadoresIfNeeded === 'function') advanceLibertadoresIfNeeded();
    if(typeof advanceChampionsLeagueIfNeeded === 'function') advanceChampionsLeagueIfNeeded();
  if(typeof advanceNationalSupercupsIfNeeded === 'function') advanceNationalSupercupsIfNeeded();
  applyConditionUpdates(results);
  applyMoraleUpdates(results);
  if(typeof applyFanChangesAfterMatches === 'function') applyFanChangesAfterMatches(results);
  maintainBotBalanceDuringSeason();
  if(typeof recoverBotWearDaily === 'function') recoverBotWearDaily({ reason:'after_own_matchday' });
  if(typeof processBotDismissals === 'function') processBotDismissals();
  advanceStadiumAfterMatches(results);
  applyEconomyResult(ownResult);
  updateManagerMatchStats(ownResult);
  maybeGenerateTransferOffer(ownResult);
  advanceSponsorMatchCounter();
  if(typeof awardSpecialPointsForOwnMatch === 'function') awardSpecialPointsForOwnMatch(ownResult);
  registerManagerTacticalPatternAfterMatch(ownResult);
  const summaryRound = game.fixtures[fromRoundIndex] || ownInfo?.round || pendingInfo?.round || { matchday:'—', date:targetDate, matches:[] };
  const triggeredEvents = processGameEventsAfterMatches({ round:summaryRound, results, ownResult });
  const ownProblems = collectOwnProblems(ownResult);
  removeOwnUnavailableFromTactic(ownProblems);
  game.lastOwnProblems = ownProblems;
  game.mustReviewTactics = game.lastOwnProblems.length > 0;
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const challengeFinished = Boolean(game?.challenge?.completed && String(game.challenge.id || '') === 'campo_destruido');
  const postCompetition = regularEnded && !challengeFinished && typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
  if(postCompetition?.created) regularEnded = game.matchdayIndex >= game.fixtures.length;
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - Number(budgetBeforeTurn || 0));
  game.currentDate = targetDate;
  rememberCalendarDate();
  runScheduledSeasonGameVerifier({ reason:'live_matchday_complete' });
  if(challengeFinished){
    game.currentDate = targetDate;
    rememberCalendarDate();
    setAdvanceLock(0);
  }else if(regularEnded && !postCompetition?.created){
    startPostseasonPhase(targetDate);
    setAdvanceLock(0);
  }else{
    game.currentDate = targetDate;
    rememberCalendarDate();
    applyUnifiedAdvanceCooldown('match');
  }
  setRegularTurnSummary(summaryRound, ownResult, ownProblems, regularEnded || Boolean(postCompetition?.created), triggeredEvents);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(challengeFinished) showNotice(game.challenge?.closeNotice || 'Reto finalizado.', true);
  else if(game.mustReviewTactics) showNotice('Partido dirigido. Hay lesionados o expulsados propios: revisá la táctica antes de avanzar.', true);
  else if(postCompetition?.created) showNotice(postCompetition.message || 'Se creó una competición de cierre de temporada.', true);
  else if(regularEnded) showNotice('Terminó la fase regular. Comienza la postemporada hasta el cierre anual.', true);
  else showNotice(`Partido propio dirigido por bloques. Antes se procesaron ${(preOwnBotResults || []).length} partido(s) del mismo día o pendientes.`);
}

function liveMatchEngineStatus(){
  const missing = [];
  if(!window.Simulator20) missing.push('simulador-2.0.js no cargó');
  else if(typeof window.Simulator20.createLiveMatchSession !== 'function' || typeof window.Simulator20.simulateLiveBlock !== 'function') missing.push('simulador-2.0.js está viejo o incompleto');
  if(!window.LiveMatchUI || typeof window.LiveMatchUI.start !== 'function') missing.push('js/game/17-live-match.js no cargó');
  return { ok:missing.length === 0, missing };
}
function showLiveMatchEngineBlocked(status){
  const details = (status?.missing || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const html = `<div class="card inner">
    <p class="label">Simulación viva no disponible</p>
    <h2>No se va a usar el simulador anterior</h2>
    <p class="muted">El partido propio quedó pendiente para evitar que se resuelva con el sistema viejo.</p>
    ${details ? `<ul class="live-engine-errors">${details}</ul>` : ''}
    <p class="muted small">Subí también los archivos nuevos del ZIP, especialmente <strong>js/game/17-live-match.js</strong>, <strong>simulador-2.0.js</strong>, <strong>index.html</strong> y <strong>js/game/09a-team-cohesion-summary.js</strong> a <strong>js/game/09e-training.js</strong>. Después usá Control + F5.</p>
    <div class="modal-actions"><button class="primary" data-close-modal>Entendido</button></div>
  </div>`;
  if(typeof openModal === 'function') openModal(html);
  showNotice('No se cargó el motor de simulación viva. El partido no fue simulado con el sistema anterior.', true);
}
function simulateLiveMatchResultOnly(match){
  if(!match || !window.Simulator20?.createLiveMatchSession || !window.Simulator20?.simulateLiveBlock) return null;
  const run = () => {
    const session = window.Simulator20.createLiveMatchSession(match);
    let guard = 0;
    while(session && !session.finished && guard < 140){
      window.Simulator20.simulateLiveBlock(session, { instruction:'none', substitutions:[] });
      guard += 1;
    }
    return session?.result || (window.Simulator20.finishLiveMatchSession ? window.Simulator20.finishLiveMatchSession(session) : null);
  };
  return typeof withCompetitionSuspensionContext === 'function'
    ? withCompetitionSuspensionContext(match, run)
    : run();
}
function showResultOnlySummary(result){
  if(!result) return;
  setTimeout(() => {
    if(typeof showMatchModal === 'function' && result.id){ showMatchModal(result.id); return; }
    const h = clubName(result.homeId);
    const a = clubName(result.awayId);
    const hs = result.matchStats?.home || {};
    const as = result.matchStats?.away || {};
    const body = `<div class="card inner match-result-only-summary">
      <p class="label">Resultado directo</p>
      <h2>${escapeHtml(h)} ${Number(result.homeGoals || 0)} - ${Number(result.awayGoals || 0)} ${escapeHtml(a)}</h2>
      <div class="grid cols-2">
        <div class="card inner"><h3>${escapeHtml(h)}</h3><p>Intentos de ataque: ${Number(hs.attacks || 0)}</p><p>Tiros al arco: ${Number(hs.chances || 0)}</p><p>xG: ${Number(hs.xg || 0).toFixed(2)}</p><p>Posesión: ${Number(hs.possession || 0)}%</p></div>
        <div class="card inner"><h3>${escapeHtml(a)}</h3><p>Intentos de ataque: ${Number(as.attacks || 0)}</p><p>Tiros al arco: ${Number(as.chances || 0)}</p><p>xG: ${Number(as.xg || 0).toFixed(2)}</p><p>Posesión: ${Number(as.possession || 0)}%</p></div>
      </div>
      <div class="modal-actions"><button class="primary" data-close-modal>Cerrar</button></div>
    </div>`;
    if(typeof openModal === 'function') openModal(body);
  }, 0);
}
function startLiveOwnMatchdayInteractive(context){
  const match = context?.ownInfo?.match;
  if(!match) return false;
  try{
    const started = window.LiveMatchUI.start(match, {
      onComplete:(ownResult) => finalizeLiveOwnMatchdayResult(context, ownResult),
      onCancel:null
    });
    if(started) return true;
  }catch(err){
    console.error('Error al iniciar simulación viva:', err);
    showLiveMatchEngineBlocked({ missing:[`Error al iniciar simulación viva: ${err?.message || err}`] });
    return 'blocked';
  }
  showLiveMatchEngineBlocked({ missing:['El motor vivo respondió, pero no pudo abrir el partido'] });
  return 'blocked';
}
function finishOwnMatchdayResultOnly(context){
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('resultOnly')){ showNotice(managerChallengeBlockedMessage('resultOnly')); return 'blocked'; }
  const match = context?.ownInfo?.match;
  const result = simulateLiveMatchResultOnly(match);
  if(!result){ showLiveMatchEngineBlocked({ missing:['No se pudo generar el resultado directo con el motor vivo'] }); return 'blocked'; }
  finalizeLiveOwnMatchdayResult(context, result);
  showResultOnlySummary(result);
  showNotice('Partido simulado directamente. Se muestran las estadísticas completas.', false);
  return true;
}
function startLiveOwnMatchday(context){
  const match = context?.ownInfo?.match;
  if(!match) return false;
  const status = liveMatchEngineStatus();
  if(!status.ok){
    console.warn('Simulación viva bloqueada por carga incompleta:', status.missing);
    showLiveMatchEngineBlocked(status);
    return 'blocked';
  }
  const body = `<div class="card inner match-start-choice">
    <p class="label">Partido propio</p>
    <h2>${clubLink(match.homeId)} vs ${clubLink(match.awayId)}</h2>
    <p class="muted">${typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('resultOnly') ? 'Reto activo: es obligatorio dirigir el partido. Ver resultado está bloqueado.' : 'Podés dirigir la simulación viva o saltear el desarrollo y ver sólo el resultado con estadísticas completas.'}</p>
    <div class="modal-actions two-lines">
      <button id="startLiveMatchChoice" class="primary">Dirigir partido</button>
      ${typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('resultOnly') ? '<button id="resultOnlyMatchChoice" class="ghost" disabled>Ver resultado bloqueado</button>' : '<button id="resultOnlyMatchChoice" class="ghost">Ver solo resultados</button>'}
    </div>
  </div>`;
  if(typeof openModal === 'function') openModal(body);
  setTimeout(() => {
    document.querySelector('#startLiveMatchChoice')?.addEventListener('click', () => { closeModal(); startLiveOwnMatchdayInteractive(context); });
    document.querySelector('#resultOnlyMatchChoice')?.addEventListener('click', () => { closeModal(); finishOwnMatchdayResultOnly(context); });
  }, 0);
  return true;
}

function simulateNextMatchday(options={}){
  if(!game || game.seasonFinalized) return;
  if(game.gameOver?.active){ showNotice('Estás sin club. Usá Buscar club para continuar tu carrera.'); return; }
  if(typeof ensureClubWorldCupCurrentSeason === 'function') ensureClubWorldCupCurrentSeason({ source:'before_matchday' });
  if(typeof prepareClubWorldCupParticipantsIfNeeded === 'function') prepareClubWorldCupParticipantsIfNeeded({ source:'before_matchday' });
  if(isAdvanceLocked()){ showNotice(`Avance bloqueado por ${formatClock(advanceLockLeftMs())}.`); return; }
  if(isPreseason()){
    simulatePreseasonTurn();
    return;
  }
  if(isPostseason()){
    simulatePostseasonTurn();
    return;
  }
  if(game.matchdayIndex >= game.fixtures.length){
    const postCompetition = typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
    if(postCompetition?.created){
      saveLocal(true);
      renderAll();
      showNotice(`${postCompetition.message || 'Se creó una competición de cierre de temporada.'} Avanzá para jugar la siguiente fecha.`, true);
      return;
    }
    showTurnTransition('Cambio de fase');
    startPostseasonPhase(currentCalendarDate());
    saveLocal(true);
    renderAll();
    showNotice('Comienza la postemporada. Se usarán los días restantes del año antes del cierre de temporada.');
    return;
  }
  const automaticClauseSalesBeforeMatch = typeof processUnansweredSpecialClauseOffers === 'function'
    ? processUnansweredSpecialClauseOffers({ silent:true, source:'before_matchday' })
    : { accepted:0 };
  if(automaticClauseSalesBeforeMatch.accepted > 0) saveLocal(true);
  if(game.mustReviewTactics){ showNotice('Debes confirmar tu equipo: hay lesionados o suspendidos propios que deben ser reemplazados.'); return; }
  const errors = validateCurrentTactic(false);
  if(errors.length){ showNotice(errors.join(' ')); return; }
  const ownInfo = nextOwnMatchInfo();
  const pendingInfo = nextPendingMatchInfo();
  const targetDate = ownInfo?.date || pendingInfo?.date;
  if(targetDate){
    repairBotRosters({ reason:'before_turn', dueDate:targetDate });
    if(typeof runDailyMatchStatsIntegrityRepair === 'function'){
      const integrity = runDailyMatchStatsIntegrityRepair({ reason:'before_matchday_advance', force:false, scope:'recent', silent:true });
      if(integrity.remaining > 0){
        showNotice(`Hay ${integrity.remaining} partido(s) recientes sin datos mínimos que no pudieron repararse de forma segura. Usá el verificador antes de avanzar.`);
        return;
      }
    }
  }
  if(!targetDate){
    game.matchdayIndex = game.fixtures.length;
    startPostseasonPhase(currentCalendarDate());
    saveLocal(true);
    renderAll();
    showNotice('No quedan partidos pendientes. Comienza la postemporada.');
    return;
  }
  if(ownInfo?.date && isCurrentDateBeforeIso(ownInfo.date)){
    startAutoAdvanceToNextOwnMatch();
    return;
  }
  const preOwnBotResults = ownInfo ? simulateNonOwnDueBeforeOwnMatch(targetDate, 'before_own_match_click') : [];
  const budgetBeforeTurn = Number(game.budget || 0);
  if(validIsoDate(targetDate)){
    game.currentDate = targetDate;
    rememberCalendarDate();
  }
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily({ reason:'matchday' });
  showTurnTransition(options.advanceLabel || 'Yendo al próximo partido');
  const fromRoundIndex = Number(game.matchdayIndex || 0);
  if(ownInfo){
    const liveStartState = startLiveOwnMatchday({ ownInfo, pendingInfo, targetDate, preOwnBotResults, budgetBeforeTurn, fromRoundIndex });
    if(liveStartState === true || liveStartState === 'blocked') return;
  }
  const results = simulateDueMatchesUntil(targetDate, { includeOwn:true });
  const ownResult = results.find(m => m.homeId === game.selectedClubId || m.awayId === game.selectedClubId) || null;
  if(!results.length){
    showNotice('No había partidos pendientes para simular en esta fecha.');
    return;
  }
  if(ownResult){
    applyConditionUpdates(results);
    applyMoraleUpdates(results);
    if(typeof applyFanChangesAfterMatches === 'function') applyFanChangesAfterMatches(results);
    maintainBotBalanceDuringSeason();
    if(typeof recoverBotWearDaily === 'function') recoverBotWearDaily({ reason:'after_own_matchday' });
    if(typeof processBotDismissals === 'function') processBotDismissals();
    advanceStadiumAfterMatches(results);
    applyEconomyResult(ownResult);
    updateManagerMatchStats(ownResult);
    maybeGenerateTransferOffer(ownResult);
    advanceSponsorMatchCounter();
    if(typeof awardSpecialPointsForOwnMatch === 'function') awardSpecialPointsForOwnMatch(ownResult);
    registerManagerTacticalPatternAfterMatch(ownResult);
  } else {
    processNonOwnResultsAfterSimulation(results);
  }
  const summaryRound = game.fixtures[fromRoundIndex] || ownInfo?.round || pendingInfo?.round || { matchday:'—', date:targetDate, matches:[] };
  const triggeredEvents = ownResult ? processGameEventsAfterMatches({ round:summaryRound, results, ownResult }) : [];
  const ownProblems = ownResult ? collectOwnProblems(ownResult) : [];
  if(ownResult){
    removeOwnUnavailableFromTactic(ownProblems);
    game.lastOwnProblems = ownProblems;
    game.mustReviewTactics = game.lastOwnProblems.length > 0;
  }
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const challengeFinished = Boolean(game?.challenge?.completed && String(game.challenge.id || '') === 'campo_destruido');
  const postCompetition = regularEnded && !challengeFinished && typeof createPostRegularCompetitionsIfNeeded === 'function' ? createPostRegularCompetitionsIfNeeded() : null;
  if(postCompetition?.created) regularEnded = game.matchdayIndex >= game.fixtures.length;
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  game.currentDate = targetDate;
  rememberCalendarDate();
  runScheduledSeasonGameVerifier({ reason:'matchday_complete' });
  if(challengeFinished){
    game.currentDate = targetDate;
    rememberCalendarDate();
    setAdvanceLock(0);
  }else if(regularEnded && !postCompetition?.created){
    startPostseasonPhase(targetDate);
    setAdvanceLock(0);
  } else {
    game.currentDate = targetDate;
    rememberCalendarDate();
    applyUnifiedAdvanceCooldown(ownResult ? 'match' : 'daily');
  }
  if(ownResult) setRegularTurnSummary(summaryRound, ownResult, ownProblems, regularEnded || Boolean(postCompetition?.created), triggeredEvents);
  else setDailyAdvanceSummary(currentCalendarDate(), targetDate, results.length);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  const finalNotice = () => {
    if(challengeFinished){ showNotice(game.challenge?.closeNotice || 'Reto finalizado.', true); }
    else if(game.mustReviewTactics){ showNotice('Partido simulado. Hay lesionados o expulsados propios: revisá la táctica antes de avanzar.', true); }
    else if(postCompetition?.created){ showNotice(postCompetition.message || 'Se creó una competición de cierre de temporada.', true); }
    else if(regularEnded){ showNotice('Terminó la fase regular. Comienza la postemporada hasta el cierre anual.', true); }
    else if(ownResult){ showNotice(`Partido propio simulado. Antes se procesaron ${preOwnBotResults.length} partido(s) del mismo día o pendientes.`); }
    else { showNotice(`Se simularon ${results.length} partido(s) de calendario.`); }
  };
  if(ownResult && !regularEnded) showMatchRevealModal(ownResult, finalNotice);
  else finalNotice();
}

function buildPreseasonFriendlyMatch(opponentId){
  const homeOwn = Math.random() < 0.5;
  return {
    id:`friendly-t${game.seasonNumber || 1}-${game.phaseTurn || 0}-${game.selectedClubId}-${opponentId}`,
    friendly:true,
    matchday:`PRE-${(game.phaseTurn || 0) + 1}`,
    divisionId:'friendly',
    divisionName:'Amistoso',
    date:game.currentDate || '',
    homeId:homeOwn ? game.selectedClubId : opponentId,
    awayId:homeOwn ? opponentId : game.selectedClubId,
    played:false
  };
}
function finalizePreseasonTurnAfterMatch(context={}){
  if(!game) return;
  const budgetBeforeTurn = Number(context.budgetBeforeTurn || 0);
  const opponentId = Number(context.opponentId || 0);
  const canFriendly = Boolean(context.canFriendly);
  let friendlyResult = context.friendlyResult || null;
  if(friendlyResult){
    friendlyResult.friendly = true;
    friendlyResult.cards = [];
    friendlyResult.injuries = [];
    friendlyResult.substitutions = friendlyResult.substitutions || [];
    game.matchHistory.push(friendlyResult);
    applyConditionUpdates([friendlyResult]);
    applyMoraleUpdates([friendlyResult]);
    game.preseasonFriendliesPlayed = preseasonFriendliesPlayed() + 1;
  }
  applyTrainingEffects();
  maintainBotBalanceDuringSeason({ force:true, phase:'preseason' });
  reduceInjuryDurationsByTurns(1);
  registerInjuryRecoveryTurn('preseason');
  if(typeof processStadiumExpansionDays === 'function') processStadiumExpansionDays(DAYS_PER_ADVANCE);
  if(typeof processClubFacilitiesDaily === 'function') processClubFacilitiesDaily(DAYS_PER_ADVANCE);
  if(typeof processManagerAcademyFacilitiesDaily === 'function') processManagerAcademyFacilitiesDaily(DAYS_PER_ADVANCE);
  processStadiumProjects();
  processSponsorContracts();
  if(typeof processMemberCampaigns === 'function') processMemberCampaigns(DAYS_PER_ADVANCE);
  processBankLoanDailySchedule();
  game.pendingFriendlyOpponentId = 0;
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  game.currentDate = dateForSeasonState(game);
  rememberCalendarDate();
  advanceGlobalTurn();
  if(typeof processNationalCupsDaily === 'function') processNationalCupsDaily({ source:'preseason' });
  if(typeof processLibertadoresDaily === 'function') processLibertadoresDaily({ source:'preseason' });
  if(typeof processChampionsLeagueDaily === 'function') processChampionsLeagueDaily({ source:'preseason' });
  if(typeof processActiveSpecialCardUsageDaily === 'function') processActiveSpecialCardUsageDaily({ save:false, source:'preseason' });
  if(typeof dismissAllStaffForFinancialCrisis === 'function') dismissAllStaffForFinancialCrisis({ silent:true });
  const kinesioDifferentiated = typeof processKinesiologistDifferentiatedDays === 'function'
    ? processKinesiologistDifferentiatedDays(DAYS_PER_ADVANCE, { source:'preseason_compact_advance' })
    : { applied:false };
  if(typeof processAfaFieldSanctionDaily === 'function') processAfaFieldSanctionDaily();
  runScheduledSeasonGameVerifier({ reason:'preseason' });
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily({ reason:'preseason' });
  if(typeof maybePushAssistantAdviceMessage === 'function') maybePushAssistantAdviceMessage('preseason');
  processAcademyTurn();
  processPendingTransfers();
  const lockerRoomProblem = typeof processLockerRoomProblemsDaily === 'function'
    ? processLockerRoomProblemsDaily({ reason:'preseason' })
    : { active:false, checked:false, triggered:false };
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= PRESEASON_TURNS){
    game.seasonPhase = 'regular';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    rememberCalendarDate();
    setAdvanceLock(0);
    if(Number(game.sponsors?.seasonPlanSeason || 0) !== Number(game.seasonNumber || 1)){
      generateOpeningSponsorOffers(true);
    }
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice('Pretemporada finalizada. Ya está disponible la primera fecha oficial.', true);
  } else {
    applyUnifiedAdvanceCooldown('match');
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice(canFriendly ? `Amistoso dirigido ante ${clubName(opponentId)}. La pretemporada avanza.` : 'Día de pretemporada aplicado.', false);
  }
  activeTab = 'home';
  saveLocal(true);
  renderAll();
}
function startLivePreseasonFriendlyInteractive(match, context){
  try{
    const started = window.LiveMatchUI.start(match, {
      onComplete:(friendlyResult) => finalizePreseasonTurnAfterMatch({ ...context, friendlyResult }),
      onCancel:null
    });
    if(started) return true;
  }catch(err){
    console.error('Error al iniciar amistoso vivo:', err);
    showLiveMatchEngineBlocked({ missing:[`Error al iniciar amistoso vivo: ${err?.message || err}`] });
    return 'blocked';
  }
  showLiveMatchEngineBlocked({ missing:['El motor vivo respondió, pero no pudo abrir el amistoso'] });
  return 'blocked';
}
function finishPreseasonFriendlyResultOnly(match, context){
  const friendlyResult = simulateLiveMatchResultOnly(match);
  if(!friendlyResult){ showLiveMatchEngineBlocked({ missing:['No se pudo generar el resultado directo del amistoso'] }); return 'blocked'; }
  finalizePreseasonTurnAfterMatch({ ...context, friendlyResult });
  showResultOnlySummary(friendlyResult);
  showNotice('Amistoso simulado directamente. Se muestran las estadísticas completas.', false);
  return true;
}
function startLivePreseasonFriendly(match, context){
  const status = liveMatchEngineStatus();
  if(!status.ok){
    console.warn('Amistoso vivo bloqueado por carga incompleta:', status.missing);
    showLiveMatchEngineBlocked(status);
    return 'blocked';
  }
  const body = `<div class="card inner match-start-choice">
    <p class="label">Amistoso de pretemporada</p>
    <h2>${clubLink(match.homeId)} vs ${clubLink(match.awayId)}</h2>
    <p class="muted">Podés dirigir la simulación viva o saltear el desarrollo y ver sólo el resultado con estadísticas completas.</p>
    <div class="modal-actions two-lines">
      <button id="startFriendlyLiveChoice" class="primary">Dirigir partido</button>
      <button id="resultOnlyFriendlyChoice" class="ghost">Ver solo resultados</button>
    </div>
  </div>`;
  if(typeof openModal === 'function') openModal(body);
  setTimeout(() => {
    document.querySelector('#startFriendlyLiveChoice')?.addEventListener('click', () => { closeModal(); startLivePreseasonFriendlyInteractive(match, context); });
    document.querySelector('#resultOnlyFriendlyChoice')?.addEventListener('click', () => { closeModal(); finishPreseasonFriendlyResultOnly(match, context); });
  }, 0);
  return true;
}
function simulatePreseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 1 día de pretemporada');
  const opponentId = Number(game.pendingFriendlyOpponentId || 0);
  const canFriendly = Boolean(opponentId && canPlayPreseasonFriendly());
  if(canFriendly){
    const match = buildPreseasonFriendlyMatch(opponentId);
    const liveStartState = startLivePreseasonFriendly(match, { budgetBeforeTurn, opponentId, canFriendly });
    if(liveStartState === true || liveStartState === 'blocked') return;
  }
  finalizePreseasonTurnAfterMatch({ budgetBeforeTurn, opponentId, canFriendly:false, friendlyResult:null });
}

function simulatePostseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 1 día de postemporada');
  generateSeasonEndPlayerOffers();
  applyTrainingEffects();
  reduceInjuryDurationsByTurns(1);
  registerInjuryRecoveryTurn('postseason');
  if(typeof processStadiumExpansionDays === 'function') processStadiumExpansionDays(DAYS_PER_ADVANCE);
  if(typeof processClubFacilitiesDaily === 'function') processClubFacilitiesDaily(DAYS_PER_ADVANCE);
  if(typeof processManagerAcademyFacilitiesDaily === 'function') processManagerAcademyFacilitiesDaily(DAYS_PER_ADVANCE);
  processStadiumProjects();
  processSponsorContracts();
  if(typeof processMemberCampaigns === 'function') processMemberCampaigns(DAYS_PER_ADVANCE);
  processBankLoanDailySchedule();
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  game.currentDate = dateForSeasonState(game);
  rememberCalendarDate();
  advanceGlobalTurn();
  if(typeof processActiveSpecialCardUsageDaily === 'function') processActiveSpecialCardUsageDaily({ save:false, source:'postseason' });
  if(typeof dismissAllStaffForFinancialCrisis === 'function') dismissAllStaffForFinancialCrisis({ silent:true });
  const kinesioDifferentiated = typeof processKinesiologistDifferentiatedDays === 'function'
    ? processKinesiologistDifferentiatedDays(DAYS_PER_ADVANCE, { source:'postseason_compact_advance' })
    : { applied:false };
  if(typeof processAfaFieldSanctionDaily === 'function') processAfaFieldSanctionDaily();
  runScheduledSeasonGameVerifier({ reason:'postseason' });
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily({ reason:'postseason' });
  if(typeof maybePushAssistantAdviceMessage === 'function') maybePushAssistantAdviceMessage('postseason');
  processAcademyTurn();
  processPendingTransfers();
  const lockerRoomProblem = typeof processLockerRoomProblemsDaily === 'function'
    ? processLockerRoomProblemsDaily({ reason:'postseason' })
    : { active:false, checked:false, triggered:false };
  const automaticClauseSales = typeof processUnansweredSpecialClauseOffers === 'function'
    ? processUnansweredSpecialClauseOffers({ silent:true, source:'postseason' })
    : { accepted:0, closed:0 };
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= postseasonTurnsForCurrentSeason()){
    game.seasonPhase = 'finalizing';
    game.currentDate = seasonEndDateForYear(currentSeasonYear());
    rememberCalendarDate();
    finalizeSeasonIfNeeded();
    setAdvanceLock(0);
    setPostseasonTurnSummary(true);
    activeTab = 'home';
    saveLocal(true);
    renderAll();
    setTimeout(openSeasonEndModal, 0);
    showNotice('Postemporada finalizada. Cerró la temporada.', true);
  } else {
    applyUnifiedAdvanceCooldown('match');
    setPostseasonTurnSummary(false);
    activeTab = 'home';
    saveLocal(true);
    renderAll();
    showNotice('Día de postemporada aplicado.');
  }
}

