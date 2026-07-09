/* V5.00 · Estado de jugadores, disponibilidad, calendario anual, habilidades y utilidades tácticas. */

function playerById(id){ return seed.players.find(p => p.id === Number(id)); }
function playersByClub(clubId){ return seed.players.filter(p => p.clubId === clubId); }
function pendingIncomingTransfersCount(clubId=game?.selectedClubId){
  return (game?.pendingTransfers || []).filter(t => t.status === 'pending' && Number(t.toClubId) === Number(clubId)).length;
}
function firstTeamRosterCount(clubId=game?.selectedClubId){
  return playersByClub(Number(clubId)).length;
}
function hasFirstTeamRosterSpace(clubId=game?.selectedClubId, extra=1){
  return firstTeamRosterCount(clubId) + pendingIncomingTransfersCount(clubId) + Math.max(0, Number(extra) || 0) <= MAX_PLAYERS_PER_CLUB;
}
function hasFirstTeamRosterMinimumAfterRemoval(clubId=game?.selectedClubId, removeCount=1){
  return firstTeamRosterCount(clubId) - Math.max(0, Number(removeCount) || 0) >= MIN_PLAYERS_PER_CLUB;
}
function showRosterLimitNotice(){
  showNotice(`Plantel completo. Máximo ${MAX_PLAYERS_PER_CLUB} jugadores.`);
}
function showRosterMinimumNotice(){
  showNotice(`Plantel mínimo. Debés mantener al menos ${MIN_PLAYERS_PER_CLUB} jugadores.`);
}
function playerStatus(playerId){ return game?.playerStatus?.[playerId] || {}; }
function injuryActiveFromStatus(st){
  if(!game || !st) return false;
  if(Number.isFinite(Number(st.injuredUntilTurn))) return currentTurnIndex() < Number(st.injuredUntilTurn || 0);
  return st.injuredThrough !== undefined && game.matchdayIndex <= st.injuredThrough;
}
function isUnavailable(playerId){
  if(!game) return false;
  const st = playerStatus(playerId);
  return Boolean(injuryActiveFromStatus(st) || (st.suspendedThrough !== undefined && game.matchdayIndex <= st.suspendedThrough));
}
function isSuspended(playerId){
  const st = playerStatus(playerId);
  return Boolean(st.suspendedThrough !== undefined && game && game.matchdayIndex <= st.suspendedThrough);
}
function isInjured(playerId){
  const st = playerStatus(playerId);
  return Boolean(injuryActiveFromStatus(st));
}
function turnsRemaining(playerId){
  const st = playerStatus(playerId);
  if(!game || !st) return 0;
  if(Number.isFinite(Number(st.injuredUntilTurn))){
    return Math.max(0, Math.ceil(Number(st.injuredUntilTurn || 0) - currentTurnIndex()));
  }
  if(st.injuredThrough === undefined || game.matchdayIndex > st.injuredThrough) return 0;
  return Math.max(1, st.injuredThrough - game.matchdayIndex + 1);
}
function canUseInjuredAsSub(playerId){
  return Boolean(game && isInjured(playerId) && !isSuspended(playerId) && turnsRemaining(playerId) <= INJURED_SUB_MAX_TURNS);
}
function canBeStarter(playerId){
  return Boolean(playerId && !isUnavailable(playerId));
}
function canBeBench(playerId){
  if(!playerId) return false;
  if(isSuspended(playerId)) return false;
  if(isInjured(playerId)) return canUseInjuredAsSub(playerId);
  return true;
}
function canEnterMatch(playerId){
  return canBeBench(playerId) || canBeStarter(playerId);
}
function injuredSubPenaltyFactor(playerId){
  return canUseInjuredAsSub(playerId) ? INJURED_SUB_PENALTY : 1;
}
function benchOverallValue(player){
  return Math.round(effectiveOverall(player) * injuredSubPenaltyFactor(player.id));
}

function seasonPhase(){
  return game?.seasonPhase || (game?.seasonFinalized ? 'finalized' : 'regular');
}
function isPreseason(){ return seasonPhase() === 'preseason'; }
function isPostseason(){ return seasonPhase() === 'postseason'; }
function isRegularSeason(){ return seasonPhase() === 'regular'; }
function currentTurnIndex(){ return Number.isFinite(game?.globalTurn) ? game.globalTurn : 0; }
function turnStamp(extra={}){
  return { globalTurn:currentTurnIndex(), season:game?.seasonNumber || 1, phase:seasonPhase(), phaseTurn:game?.phaseTurn || 0, matchdayIndex:game?.matchdayIndex || 0, ...extra };
}
function turnCooldownLeft(last, cooldown){
  if(!last) return 0;
  const lastTurn = Number.isFinite(last.globalTurn) ? last.globalTurn : Number(last.absoluteTurn || last.matchdayIndex || 0);
  return Math.max(0, cooldown - (currentTurnIndex() - lastTurn));
}
function advanceGlobalTurn(){
  if(!game) return;
  game.globalTurn = currentTurnIndex() + 1;
}
function turnsToDays(value){
  return Math.max(0, Math.round((Number(value) || 0) * DAYS_PER_ADVANCE));
}
function daysToTurns(value){
  return Math.max(0, Math.round((Number(value) || 0) / Math.max(1, DAYS_PER_ADVANCE)));
}
function formatDays(value){
  const days = Math.max(0, Math.round(Number(value) || 0));
  return `${days} día${days === 1 ? '' : 's'}`;
}
function formatDaysFromTurns(value){
  return formatDays(turnsToDays(value));
}
function pad2(value){ return String(Math.max(0, Math.round(Number(value) || 0))).padStart(2, '0'); }
function makeUtcDate(year, month, day){ return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))); }
function isoDateFromUtc(date){ return date.toISOString().slice(0, 10); }
function validIsoDate(value){ return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')); }
function addDaysToIsoDate(iso, days){
  const base = validIsoDate(iso) ? new Date(`${iso}T00:00:00Z`) : makeUtcDate(currentSeasonYear(), SEASON_START_MONTH, SEASON_START_DAY);
  base.setUTCDate(base.getUTCDate() + Math.round(Number(days) || 0));
  return isoDateFromUtc(base);
}
function daysBetweenIsoDates(startIso, endIso){
  if(!validIsoDate(startIso) || !validIsoDate(endIso)) return 0;
  const start = new Date(`${startIso}T00:00:00Z`);
  const end = new Date(`${endIso}T00:00:00Z`);
  return Math.round((end - start) / 86400000);
}
function isLeapYear(year){
  const y = Math.round(Number(year) || SEASON_START_YEAR);
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}
function daysInSeasonYear(year){ return isLeapYear(year) ? 366 : 365; }
function seasonYearForNumber(seasonNumber=1){
  return Math.round(SEASON_START_YEAR + Math.max(0, (Number(seasonNumber) || 1) - 1));
}
function currentSeasonYear(){
  return Math.round(Number(game?.seasonYear || 0)) || seasonYearForNumber(game?.seasonNumber || 1);
}
function seasonStartDateForYear(year=currentSeasonYear()){
  const safeDay = Math.min(SEASON_START_DAY, new Date(Date.UTC(year, SEASON_START_MONTH, 0)).getUTCDate());
  return isoDateFromUtc(makeUtcDate(year, SEASON_START_MONTH, safeDay));
}
function seasonEndDateForYear(year=currentSeasonYear()){
  return addDaysToIsoDate(seasonStartDateForYear(year), daysInSeasonYear(year) - 1);
}
function firstSundayOnOrAfterIso(iso){
  const date = new Date(`${iso}T00:00:00Z`);
  const offset = (7 - date.getUTCDay()) % 7;
  date.setUTCDate(date.getUTCDate() + offset);
  return isoDateFromUtc(date);
}
function firstAdvanceDateForSeason(year=currentSeasonYear()){
  return seasonStartDateForYear(year);
}
function leagueStartDateForSeason(year=currentSeasonYear()){
  return firstSundayOnOrAfterIso(addDaysToIsoDate(seasonStartDateForYear(year), PRESEASON_TURNS * DAYS_PER_ADVANCE));
}
function midseasonBreakStartsForSeason(year=currentSeasonYear()){
  const first = leagueStartDateForSeason(year);
  const afterRound = Math.max(0, Math.round(Number(MIDSEASON_BREAK_AFTER_ROUND || 0)));
  if(afterRound <= 0 || MIDSEASON_BREAK_DAYS <= 0) return '';
  return addDaysToIsoDate(first, afterRound * LEAGUE_ROUND_INTERVAL_DAYS);
}
function midseasonBreakEndsForSeason(year=currentSeasonYear()){
  const start = midseasonBreakStartsForSeason(year);
  return start ? addDaysToIsoDate(start, Math.max(0, MIDSEASON_BREAK_DAYS - 1)) : '';
}
function isMidseasonVacationDate(iso, year=currentSeasonYear()){
  const start = midseasonBreakStartsForSeason(year);
  const end = midseasonBreakEndsForSeason(year);
  if(!validIsoDate(iso) || !start || !end) return false;
  return daysBetweenIsoDates(start, iso) >= 0 && daysBetweenIsoDates(iso, end) >= 0;
}
function seasonDayFromDate(iso, year=currentSeasonYear()){
  const start = seasonStartDateForYear(year);
  const raw = daysBetweenIsoDates(start, validIsoDate(iso) ? iso : start) + 1;
  return clamp(raw, 1, daysInSeasonYear(year));
}
function nextUnplayedMatchDateForClub(state=game, clubId=null){
  if(!state || !Array.isArray(state.fixtures)) return '';
  const ownId = Number(clubId || state.selectedClubId || 0);
  if(!ownId) return '';
  for(let roundIndex=Math.max(0, Number(state.matchdayIndex || 0)); roundIndex<state.fixtures.length; roundIndex++){
    const round = state.fixtures[roundIndex];
    const match = (round.matches || []).find(m => !m.played && (Number(m.homeId) === ownId || Number(m.awayId) === ownId));
    if(match) return validIsoDate(match.date) ? match.date : (round.date || '');
  }
  return '';
}
function nextUnplayedMatchDate(state=game){
  if(!state || !Array.isArray(state.fixtures)) return '';
  let found = '';
  for(let roundIndex=Math.max(0, Number(state.matchdayIndex || 0)); roundIndex<state.fixtures.length; roundIndex++){
    const round = state.fixtures[roundIndex];
    (round.matches || []).forEach(match => {
      if(match.played) return;
      const date = validIsoDate(match.date) ? match.date : (round.date || '');
      if(validIsoDate(date) && (!found || daysBetweenIsoDates(found, date) < 0)) found = date;
    });
    if(found) return found;
  }
  return '';
}
function lastFixtureMatchDate(state=game){
  const fixtures = state?.fixtures || [];
  for(let i=fixtures.length-1; i>=0; i--){
    const dates = (fixtures[i].matches || []).map(m => validIsoDate(m.date) ? m.date : fixtures[i].date).filter(validIsoDate);
    if(dates.length){ const sortedDates = dates.sort((a,b)=>daysBetweenIsoDates(b,a)); return sortedDates[sortedDates.length - 1]; }
    if(validIsoDate(fixtures[i].date)) return fixtures[i].date;
  }
  return '';
}
function dateForSeasonState(state=game){
  const year = Math.round(Number(state?.seasonYear || 0)) || seasonYearForNumber(state?.seasonNumber || 1);
  if(!state) return firstAdvanceDateForSeason(year);
  if(state.seasonFinalized || state.seasonPhase === 'finalized') return seasonEndDateForYear(year);
  if(state.seasonPhase === 'regular') return nextUnplayedMatchDateForClub(state, state.selectedClubId) || nextUnplayedMatchDate(state) || state.fixtures?.[state.matchdayIndex || 0]?.date || leagueStartDateForSeason(year);
  if(state.seasonPhase === 'postseason'){
    const lastMatchDate = lastFixtureMatchDate(state);
    const afterLastRound = lastMatchDate ? addDaysToIsoDate(lastMatchDate, DAYS_PER_ADVANCE) : leagueStartDateForSeason(year);
    return addDaysToIsoDate(afterLastRound, Math.max(0, Number(state.phaseTurn || 0)) * DAYS_PER_ADVANCE);
  }
  if(state.seasonPhase === 'preseason'){
    return addDaysToIsoDate(firstAdvanceDateForSeason(year), Math.max(0, Number(state.phaseTurn || 0)) * DAYS_PER_ADVANCE);
  }
  return validIsoDate(state.currentDate) ? state.currentDate : firstAdvanceDateForSeason(year);
}
function daysUntilTurn(targetTurn){
  return turnsToDays(Math.max(0, Number(targetTurn || 0) - currentTurnIndex()));
}
function currentGlobalDayNumber(){
  return seasonDayFromDate(game?.currentDate || dateForSeasonState(game), currentSeasonYear());
}
function currentSeasonFixtureCount(){ return game?.fixtures?.length || seed?.fixtures?.length || 0; }
function postseasonTurnsForSeason(seasonOrYear=null, fixtureCount=null){
  const year = Number(seasonOrYear || 0) > 1900 ? Math.round(Number(seasonOrYear)) : seasonYearForNumber(seasonOrYear || game?.seasonNumber || 1);
  if(POSTSEASON_TURNS_CONFIG > 0) return POSTSEASON_TURNS_CONFIG;
  const fixtures = Number.isFinite(Number(fixtureCount)) ? Math.max(0, Number(fixtureCount)) : currentSeasonFixtureCount();
  const lastDate = lastFixtureMatchDate(game);
  const start = seasonStartDateForYear(year);
  const usedDays = lastDate ? seasonDayFromDate(lastDate, year) : ((PRESEASON_TURNS * DAYS_PER_ADVANCE) + (fixtures * LEAGUE_ROUND_INTERVAL_DAYS));
  const remainingDays = Math.max(0, daysInSeasonYear(year) - usedDays);
  return Math.ceil(remainingDays / DAYS_PER_ADVANCE);
}
function postseasonTurnsForCurrentSeason(){ return postseasonTurnsForSeason(currentSeasonYear(), currentSeasonFixtureCount()); }
function totalSeasonTurnCount(){
  return PRESEASON_TURNS + currentSeasonFixtureCount() + postseasonTurnsForCurrentSeason();
}
function totalSeasonDayCount(){ return daysInSeasonYear(currentSeasonYear()); }
function currentSeasonTurnNumber(){
  if(!game) return 0;
  const regularCount = currentSeasonFixtureCount();
  if(game.seasonFinalized || seasonPhase() === 'finalized') return totalSeasonTurnCount();
  if(isPreseason()) return clamp((game.phaseTurn || 0) + 1, 1, totalSeasonTurnCount());
  if(isPostseason()) return clamp(PRESEASON_TURNS + regularCount + (game.phaseTurn || 0) + 1, 1, totalSeasonTurnCount());
  return clamp(PRESEASON_TURNS + (game.matchdayIndex || 0) + 1, 1, totalSeasonTurnCount());
}
function currentSeasonDayNumber(){ return currentGlobalDayNumber(); }
function phaseDayRangeLabel(completedSteps, totalSteps){
  const totalDays = turnsToDays(totalSteps);
  const start = (Math.max(0, Number(completedSteps || 0)) * DAYS_PER_ADVANCE) + 1;
  const end = Math.min(start + DAYS_PER_ADVANCE - 1, totalDays);
  return `Días ${start}-${end} de ${totalDays}`;
}
function yearStatusLabel(year=currentSeasonYear()){
  return `${year}${isLeapYear(year) ? ' · bisiesto' : ''}`;
}
function phaseLabel(){
  if(!game) return '—';
  const year = currentSeasonYear();
  const totalDays = totalSeasonDayCount();
  const currentDay = currentSeasonDayNumber();
  if(game.seasonFinalized || seasonPhase() === 'finalized') return `Día ${totalDays} / ${totalDays} · ${yearStatusLabel(year)} · Temporada finalizada`;
  if(isPreseason()) return `Día ${currentDay} / ${totalDays} · ${yearStatusLabel(year)} · Pretemporada ${phaseDayRangeLabel(game.phaseTurn || 0, PRESEASON_TURNS)}`;
  if(isPostseason()) return `Día ${currentDay} / ${totalDays} · ${yearStatusLabel(year)} · Postemporada ${phaseDayRangeLabel(game.phaseTurn || 0, postseasonTurnsForCurrentSeason())}`;
  const nextDate = nextUnplayedMatchDateForClub(game, game.selectedClubId) || nextUnplayedMatchDate(game);
  const vacation = isMidseasonVacationDate(game.currentDate || nextDate || '', year) ? ' · Vacaciones' : '';
  return `Día ${currentDay} / ${totalDays} · ${yearStatusLabel(year)} · Liga ${Math.min((game.matchdayIndex || 0) + 1, game.fixtures?.length || seed.fixtures.length)} / ${game.fixtures?.length || seed.fixtures.length}${vacation}`;
}
function preseasonFriendliesPlayed(){ return Number(game?.preseasonFriendliesPlayed || 0); }
function canPlayPreseasonFriendly(){ return isPreseason() && preseasonFriendliesPlayed() < MAX_PRESEASON_FRIENDLIES; }
function statusText(playerId){
  if(!game) return 'Disponible';
  const st = playerStatus(playerId);
  const parts = [];
  if(st.injuredThrough !== undefined && game.matchdayIndex <= st.injuredThrough){
    const subNote = canUseInjuredAsSub(playerId) ? ' · puede ir al banco con penalización' : '';
    parts.push(`Lesionado: ${st.injuryLabel || 'Lesión'}${subNote}`.trim());
  }
  if(st.suspendedThrough !== undefined && game.matchdayIndex <= st.suspendedThrough) parts.push('Suspendido');
  return parts.length ? parts.join(' · ') : 'Disponible';
}
function hashNumber(seedValue, max){
  let h = 2166136261;
  const str = String(seedValue);
  for(let i=0;i<str.length;i++){
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) % max;
}
function baseSkill(p, skillName){
  const base = Math.round(p.skills?.[skillName] ?? p.overall ?? 50);
  const boost = Number(game?.playerSkillBoosts?.[p.id]?.[skillName] || 0);
  return clamp(base + boost, 1, 99);
}
function rawVisibleSkill(p, skillName){
  return clamp(Math.round(p.skills?.[skillName] ?? p.overall ?? 50), 1, 99);
}
function hiddenStats(p){
  const aggression = clamp(Math.round(100 - (p.skills.disciplina || 50) + hashNumber(`ag${p.id}`, 18) - 8), 1, 99);
  const genetics = clamp(Math.round(45 + hashNumber(`ge${p.id}`, 55)), 1, 99);
  const surprise = clamp(hashNumber(`su${p.id}`, 21), 0, 20);
  return { aggression, genetics, surprise };
}
function effectiveSkill(p, skillName){
  const raw = baseSkill(p, skillName);
  return clamp(raw + hiddenStats(p).surprise, 1, 99);
}
function visibleStats(p, skillResolver=baseSkill){
  const val = (skillName) => skillResolver(p, skillName);
  if(p.position === 'POR'){
    return {
      Salto: Math.round(avg([val('cabezazo'), val('fuerza')])) || p.overall,
      Defensa: Math.round(avg([val('porteria'), val('posicionamiento')])) || p.overall,
      Pase: Math.round(avg([val('paseCorto'), val('paseLargo')])) || p.overall,
      Reflejos: Math.round(avg([val('porteria'), val('serenidad'), val('aceleracion')])) || p.overall,
      Mando: Math.round(avg([val('liderazgo'), val('trabajoEquipo'), val('serenidad')])) || p.overall,
      Potencia: Math.round(avg([val('fuerza'), val('paseLargo')])) || p.overall,
      Resistencia: val('resistencia')
    };
  }
  return {
    Ataque: Math.round(avg([val('remate'), val('regate'), val('posicionamiento')])) || p.overall,
    Defensa: Math.round(avg([val('marca'), val('entradas'), val('posicionamiento')])) || p.overall,
    Pase: Math.round(avg([val('paseCorto'), val('paseLargo'), val('vision')])) || p.overall,
    Velocidad: Math.round(avg([val('velocidad'), val('aceleracion')])) || p.overall,
    Cabezazo: val('cabezazo'),
    Tiro: val('remate'),
    Resistencia: val('resistencia')
  };
}

function visibleOverall(p){
  return clamp(Math.round(avg(Object.values(visibleStats(p)))), 1, 99);
}
function rawVisibleOverall(p){
  return clamp(Math.round(avg(Object.values(visibleStats(p, rawVisibleSkill)))), 1, 99);
}
function effectiveOverall(p){
  const simulated = {
    Ataque: Math.round(avg([effectiveSkill(p,'remate'), effectiveSkill(p,'regate'), effectiveSkill(p,'posicionamiento')])) || p.overall,
    Defensa: Math.round(avg([effectiveSkill(p,'marca'), effectiveSkill(p,'entradas'), effectiveSkill(p,'posicionamiento')])) || p.overall,
    Pase: Math.round(avg([effectiveSkill(p,'paseCorto'), effectiveSkill(p,'paseLargo'), effectiveSkill(p,'vision')])) || p.overall,
    Velocidad: Math.round(avg([effectiveSkill(p,'velocidad'), effectiveSkill(p,'aceleracion')])) || p.overall,
    Cabezazo: effectiveSkill(p,'cabezazo'),
    Tiro: effectiveSkill(p,'remate'),
    Resistencia: effectiveSkill(p,'resistencia')
  };
  return clamp(Math.round(avg(Object.values(simulated))), 1, 99);
}
function ensurePlayerWearState(){
  if(!game) return {};
  if(!game.playerWear || typeof game.playerWear !== 'object' || Array.isArray(game.playerWear)) game.playerWear = {};
  return game.playerWear;
}
function currentPlayerWear(playerId){
  if(!game || !PLAYER_WEAR_ENABLED) return 0;
  const wear = ensurePlayerWearState();
  const value = Number(wear[playerId] || 0);
  if(!Number.isFinite(value)) wear[playerId] = 0;
  return clamp(Math.round(Number(wear[playerId] || 0)), 0, PLAYER_WEAR_MAX);
}
function maxConditionForPlayer(playerId){
  return clamp(99 - currentPlayerWear(playerId), 1, 99);
}
function adjustPlayerWear(playerId, delta){
  if(!game || !PLAYER_WEAR_ENABLED || !playerId) return 0;
  const wear = ensurePlayerWearState();
  const before = currentPlayerWear(playerId);
  const next = clamp(Math.round(before + Number(delta || 0)), 0, PLAYER_WEAR_MAX);
  wear[playerId] = next;
  if(game.playerCondition && Number.isFinite(Number(game.playerCondition[playerId]))){
    game.playerCondition[playerId] = Math.min(Math.round(Number(game.playerCondition[playerId] || 0)), maxConditionForPlayer(playerId));
  }
  return next - before;
}
function currentCondition(playerId){
  if(!game) return 99;
  if(!game.playerCondition) game.playerCondition = {};
  if(!Number.isFinite(game.playerCondition[playerId])) game.playerCondition[playerId] = maxConditionForPlayer(playerId);
  const raw = Math.round(Number(game.playerCondition[playerId] || 0));
  return clamp(Math.min(raw, maxConditionForPlayer(playerId)), 0, 99);
}
function fatiguePoints(playerId){
  return clamp(99 - currentCondition(playerId), 0, 99);
}
function injuryChanceForPlayer(playerId, pitchCondition='Normal'){
  const pitch = PITCH_CONDITIONS[pitchCondition] || PITCH_CONDITIONS.Normal;
  const rawChance = BASE_INJURY_CHANCE + Math.floor(fatiguePoints(playerId) / FATIGUE_INJURY_STEP) * FATIGUE_INJURY_BONUS + pitch.injuryBonus;
  return clamp(rawChance * INJURY_CHANCE_MULTIPLIER, 0, 0.65);
}
function tacticStatusIcon(playerId){
  if(isInjured(playerId)) return '<span class="injury-cross" title="Lesionado">✚</span>';
  if(isSuspended(playerId)) return '<span class="red-card status-red-card" title="Expulsado / suspendido">■</span>';
  return '<span class="ok">OK</span>';
}
function availabilityIcons(playerId){
  const icons = [];
  if(isInjured(playerId)) icons.push('<span class="injury-cross inline" title="Lesionado">✚</span>');
  if(isSuspended(playerId)) icons.push('<span class="red-card status-red-card inline" title="Expulsado / suspendido">■</span>');
  return icons.join('');
}
function availabilityStatusMarkup(playerId){
  const unavailable = isUnavailable(playerId);
  const icons = availabilityIcons(playerId);
  if(icons) return `<span class="availability-status ${unavailable ? 'bad' : 'ok'}">${icons}<span>${escapeHtml(statusText(playerId))}</span></span>`;
  return `<span class="${unavailable ? 'bad' : 'ok'}">${escapeHtml(statusText(playerId))}</span>`;
}
function pickInjuryType(){
  const total = INJURY_TABLE.reduce((sum, item) => sum + item.probability, 0);
  let roll = Math.random() * total;
  for(const item of INJURY_TABLE){
    roll -= item.probability;
    if(roll <= 0) return item;
  }
  return INJURY_TABLE[INJURY_TABLE.length - 1];
}
function injuredPlayersByClub(clubId){
  return playersByClub(clubId)
    .map(player => ({ player, status:playerStatus(player.id), remaining:turnsRemaining(player.id) }))
    .filter(item => item.remaining > 0)
    .sort((a,b)=>b.remaining-a.remaining || a.player.name.localeCompare(b.player.name));
}
function injuredHomeCard(item){
  const p = item.player;
  return `<div class="injured-home-player">
    ${faceImg(p, 'injured-home-face')}
    <div class="injured-home-info">
      <button class="linklike" data-player-id="${p.id}">${availabilityIcons(p.id)}${escapeHtml(p.name)}</button>
      <span>${escapeHtml(item.status.injuryLabel || 'Lesión')} · ${formatDaysFromTurns(item.remaining)} · Fís. ${currentCondition(p.id)}/99${canUseInjuredAsSub(p.id) ? ' · Banco permitido' : ''}</span>
    </div>
  </div>`;
}
function squadFitnessAverage(clubId){
  const squad = playersByClub(clubId);
  return Math.round(avg(squad.map(p => currentCondition(p.id)))) || 0;
}

function lastOwnMatch(){
  if(!game?.matchHistory?.length) return null;
  return game.matchHistory.filter(m => m.homeId === game.selectedClubId || m.awayId === game.selectedClubId).slice(-1)[0] || null;
}
function mainBannerForLastMatch(){
  const match = lastOwnMatch();
  if(!match){
    return {
      src:'img/principales/banner_bienvenido.jpg',
      label:'Bienvenido al club'
    };
  }
  const ownId = game.selectedClubId;
  const ownInjuries = (match.injuries || []).filter(i => i.clubId === ownId);
  if(ownInjuries.some(i => Number(i.matchesOut || 0) > 25)){
    return { src:'img/principales/banner_noticia_lesion_grave.jpg', label:'Lesión grave en el último partido' };
  }
  if(ownInjuries.some(i => Number(i.matchesOut || 0) > 10)){
    return { src:'img/principales/banner_noticia_lesion_intermedia.jpg', label:'Lesión intermedia en el último partido' };
  }
  if(ownInjuries.some(i => Number(i.matchesOut || 0) < 5)){
    return { src:'img/principales/banner_noticias_lesion_leve.jpg', label:'Lesión leve en el último partido' };
  }
  if(ownInjuries.length){
    return { src:'img/principales/banner_noticia_lesion_intermedia.jpg', label:'Lesión intermedia en el último partido' };
  }
  const isHome = match.homeId === ownId;
  const gf = isHome ? match.homeGoals : match.awayGoals;
  const gc = isHome ? match.awayGoals : match.homeGoals;
  if(gf > gc) return { src:'img/principales/banner_entrenamiento_triunfo.jpg', label:'Entrenamiento posterior al triunfo' };
  return { src:'img/principales/banner_entrenamiento_normal.jpg', label:'Entrenamiento posterior al empate o derrota' };
}
function mainBannerMarkup(){
  const banner = mainBannerForLastMatch();
  if(!banner){
    return `<div class="main-visual-placeholder"><strong>Inicio de temporada</strong><span>La imagen contextual aparecerá después del primer partido.</span></div>`;
  }
  const fallbackAttr = banner.fallbackSrc ? ` data-fallback-src="${escapeHtml(banner.fallbackSrc)}"` : '';
  const errorHandler = "const fb=this.getAttribute('data-fallback-src');if(fb&&!this.dataset.triedFallback){this.dataset.triedFallback='1';this.src=fb;}else{this.closest('.main-visual-banner').classList.add('is-missing');this.remove();}";
  return `<div class="main-visual-banner"><img src="${escapeHtml(banner.src)}" alt="${escapeHtml(banner.label)}"${fallbackAttr} onerror="${errorHandler}"><span>${escapeHtml(banner.label)}</span></div>`;
}

function injuryRulesTable(){
  return INJURY_TABLE.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${item.probability}%</td><td>${formatDaysFromTurns(item.minTurns)} a ${formatDaysFromTurns(item.maxTurns)}</td></tr>`).join('');
}
function conditionFactor(playerId){
  return 0.5 + 0.5 * (currentCondition(playerId) / 99);
}
function compactValueCircle(value, kind, label){
  const clean = clamp(Math.round(Number(value) || 0), kind === 'morale' ? 1 : 0, 99);
  const colorClass = clean < 40 ? 'low' : clean < 70 ? 'mid' : 'high';
  const deg = Math.round((clean / 99) * 360);
  return `<span class="value-circle ${kind}-circle ${colorClass}" style="--value-deg:${deg}deg" title="${escapeHtml(label)} ${clean}/99"><strong>${clean}</strong></span>`;
}
function conditionBar(playerId){
  const condition = currentCondition(playerId);
  const wear = currentPlayerWear(playerId);
  const maxCondition = maxConditionForPlayer(playerId);
  if(!wear) return compactValueCircle(condition, 'condition', 'Estado físico');
  const degMax = Math.round((maxCondition / 99) * 360);
  return `<span class="condition-wear-wrap" title="Estado físico ${condition}/99 · Máximo por desgaste ${maxCondition}/99 · Desgaste ${wear}">${compactValueCircle(condition, 'condition', 'Estado físico')}<span class="condition-wear-max" style="--wear-max-deg:${degMax}deg"></span><small>Desg. ${wear}</small></span>`;
}

function currentMorale(playerId){
  if(!game) return PLAYER_MORALE_START;
  if(!game.playerMorale) game.playerMorale = {};
  if(!Number.isFinite(game.playerMorale[playerId])) game.playerMorale[playerId] = PLAYER_MORALE_START;
  return clamp(Math.round(game.playerMorale[playerId]), 1, 99);
}
function moraleFactor(playerId){
  return 0.92 + (currentMorale(playerId) / 99) * 0.16;
}
function moraleBar(playerId){
  return compactValueCircle(currentMorale(playerId), 'morale', 'Moral');
}
function squadMoraleAverage(clubId){
  const squad = playersByClub(clubId);
  return Math.round(avg(squad.map(p => currentMorale(p.id)))) || 0;
}
function dashboardDonut(label, value, max=100){
  const cleanMax = Math.max(1, Number(max) || 100);
  const cleanValue = clamp(Math.round(Number(value) || 0), 0, cleanMax);
  const deg = Math.round((cleanValue / cleanMax) * 360);
  return `<div class="dashboard-donut-card card">
    <div class="donut-chart" style="--value-deg:${deg}deg" aria-label="${escapeHtml(label)} ${cleanValue} de ${cleanMax}"><span>${cleanValue}</span></div>
    <div><p class="label">${escapeHtml(label)}</p><strong>${cleanValue}/${cleanMax}</strong></div>
  </div>`;
}
function matchSkill(p, skillName){
  return clamp(Math.round(effectiveSkill(p, skillName) * conditionFactor(p.id) * moraleFactor(p.id) * injuredSubPenaltyFactor(p.id)), 1, 99);
}
function jerseyNumber(playerId){
  const p = playerById(playerId);
  if(!p) return 0;
  const ordered = playersByClub(p.clubId).slice().sort((a,b)=> positionOrder(a.position)-positionOrder(b.position) || visibleOverall(b)-visibleOverall(a) || a.id-b.id);
  const idx = ordered.findIndex(x=>x.id===p.id);
  return idx >= 0 ? idx + 1 : 0;
}
function playerLastName(name){
  const parts = String(name || '').trim().split(/\s+/);
  return parts[parts.length-1] || name || 'Jugador';
}
function playerDisplayName(playerId){
  const p = playerById(playerId);
  return p ? `${playerLastName(p.name)} #${jerseyNumber(p.id)}` : 'Jugador';
}
function countryCode(nationality){
  const map = {
    Argentina:'ARG', Brasil:'BRA', Uruguay:'URU', Paraguay:'PAR', Chile:'CHI', Bolivia:'BOL', 'Perú':'PER', Ecuador:'ECU', Colombia:'COL', Venezuela:'VEN',
    España:'ESP', Italia:'ITA', Francia:'FRA', Alemania:'ALE', Portugal:'POR', Inglaterra:'ING', México:'MEX', 'Estados Unidos':'USA', Japón:'JPN', 'Corea del Sur':'KOR', Marruecos:'MAR', Nigeria:'NGA', Ghana:'GHA'
  };
  return map[nationality] || String(nationality || '---').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z]/g,'').slice(0,3).toUpperCase().padEnd(3,'-');
}
function nationalityShortMarkup(nationality){
  return `<span class="pill nationality-code" title="${escapeHtml(nationality || 'Sin nacionalidad')}">${escapeHtml(countryCode(nationality))}</span>`;
}
function roleMeta(position){
  const map = {
    POR:{ code:'POR', name:'Portero', icon:'', group:'gk' },
    DFC:{ code:'DFC', name:'Defensa central', icon:'', group:'def' },
    LI:{ code:'LI', name:'Lateral izquierdo', icon:'', group:'def' },
    LD:{ code:'LD', name:'Lateral derecho', icon:'', group:'def' },
    MCD:{ code:'MCD', name:'Mediocentro defensivo', icon:'', group:'mid' },
    MC:{ code:'MC', name:'Mediocentro', icon:'', group:'mid' },
    MI:{ code:'MI', name:'Mediocampista izquierdo', icon:'', group:'mid' },
    MD:{ code:'MD', name:'Mediocampista derecho', icon:'', group:'mid' },
    MCO:{ code:'MCO', name:'Mediocentro ofensivo', icon:'', group:'mid' },
    EI:{ code:'EI', name:'Extremo izquierdo', icon:'', group:'att' },
    ED:{ code:'ED', name:'Extremo derecho', icon:'', group:'att' },
    DC:{ code:'DC', name:'Delantero centro', icon:'', group:'att' },
    VOL:{ code:'MC', name:'Mediocentro', icon:'', group:'mid' }
  };
  return map[position] || { code:position, name:position, icon:'', group:'mid' };
}
function roleBadge(position){
  return roleMeta(position).code;
}

function normalizePlayerPosition(position, playerId=0){
  const pos = String(position || '').toUpperCase();
  const aliases = { ARQ:'POR', CAI:'LI', CAD:'LD', SD:'DC', VOL:'MC' };
  if(aliases[pos]) return aliases[pos];
  if(pos === 'EXT') return (Number(playerId) || 0) % 2 === 0 ? 'ED' : 'EI';
  const valid = ['POR','LD','LI','DFC','MCD','MC','MI','MD','MCO','ED','EI','DC'];
  return valid.includes(pos) ? pos : 'MC';
}
function normalizeAllPlayerPositions(){
  if(!seed?.players) return;
  seed.players.forEach(player => { player.position = normalizePlayerPosition(player.position, player.id); });
}
function playerRoleGroup(position){
  const pos = normalizePlayerPosition(position);
  if(pos === 'POR') return 'POR';
  if(['LD','LI','DFC'].includes(pos)) return 'DEF';
  if(['MCD','MC','MI','MD','MCO'].includes(pos)) return 'MID';
  return 'ATT';
}

function weightedRulePick(items, seedKey){
  const list = (items || []).filter(item => Number(item.probability) > 0);
  if(!list.length) return (items || [])[0] || null;
  const total = list.reduce((sum,item)=>sum + Number(item.probability || 0), 0);
  let roll = (hashNumber(seedKey, 1000000) / 1000000) * total;
  for(const item of list){
    roll -= Number(item.probability || 0);
    if(roll <= 0) return item;
  }
  return list[list.length - 1];
}
function nationalityGroupId(nationality){
  const nat = String(nationality || '');
  if(nat === 'Argentina') return 'argentinos';
  const south = PLAYER_GENERATION_NATIONALITY_GROUPS.find(g=>g.id==='sudamerica')?.countries || [];
  if(south.includes(nat)) return 'sudamerica';
  return 'resto_del_mundo';
}
function mediaRangeIdForOverall(media){
  const value = Math.round(Number(media) || 0);
  return (PLAYER_GENERATION_MEDIA_RANGES.find(range => value >= range.media_min && value <= range.media_max) || PLAYER_GENERATION_MEDIA_RANGES[PLAYER_GENERATION_MEDIA_RANGES.length - 1]).id;
}
function mediaRangeForOverall(media){
  const value = Math.round(Number(media) || 0);
  return PLAYER_GENERATION_MEDIA_RANGES.find(range => value >= range.media_min && value <= range.media_max) || PLAYER_GENERATION_MEDIA_RANGES[PLAYER_GENERATION_MEDIA_RANGES.length - 1];
}
function createPlayerGenerationContext(targetTotal=0, activePlayers=[]){
  return { targetTotal:Math.max(1, Math.round(Number(targetTotal) || 0)), activePlayers:Array.isArray(activePlayers) ? activePlayers.slice() : [], created:[] };
}
function contextPlayersForGeneration(context){
  if(!context) return [];
  return (context.activePlayers || []).concat(context.created || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
}
function registerGeneratedPlayer(context, player){
  if(context && player) context.created.push(player);
}
function underTargetRules(rules, selector, context){
  if(!context) return [];
  const players = contextPlayersForGeneration(context);
  const targetTotal = Math.max(players.length + 1, Number(context.targetTotal || 0));
  const counts = {};
  players.forEach(player => { const key = selector(player); counts[key] = (counts[key] || 0) + 1; });
  return rules.filter(rule => (counts[rule.id] || 0) < Math.ceil(targetTotal * Number(rule.probability || 0)));
}
function pickRuleWithAudit(rules, selector, context, seedKey){
  const under = underTargetRules(rules, selector, context);
  if(under.length) return weightedRulePick(under, `${seedKey}-audit`);
  return weightedRulePick(rules, seedKey);
}
function mediaRangeTargetCount(range, targetTotal){
  const total = Math.max(1, Math.round(Number(targetTotal) || 0));
  const raw = total * Number(range.probability || 0);
  if(range.id === 'elite_mundial') return Math.floor(raw);
  return Math.round(raw);
}
function generationDivisionOrder(clubId=0, divisionName=''){
  if(Number(clubId || 0) > 0 && seed?.clubs?.length){
    return Math.round(Number(clubDivision(clubId).order || 3));
  }
  const lower = String(divisionName || '').toLowerCase();
  if(lower.includes('profesional') || lower.includes('primera')) return 1;
  if(lower.includes('nacional') || lower.includes('segunda')) return 2;
  if(lower.includes('federal') || lower.includes('tercera')) return 3;
  return 0;
}
function mediaRangeAllowedByDivision(range, divisionOrder){
  const order = Math.round(Number(divisionOrder || 0));
  if(order === 2 && range.id === 'elite_mundial') return false;
  if(order >= 3 && (range.id === 'elite_mundial' || range.id === 'estrella')) return false;
  return true;
}
function clubEliteCountInContext(context, clubId){
  if(!context || Number(clubId || 0) <= 0) return 0;
  return contextPlayersForGeneration(context).filter(player => Number(player.clubId) === Number(clubId) && mediaRangeIdForOverall(player.overall ?? visibleOverall(player)) === 'elite_mundial').length;
}
function pickMediaRangeWithAudit(context, seedKey, constraints={}){
  const preferred = weightedRulePick(PLAYER_GENERATION_MEDIA_RANGES, `${seedKey}-range`);
  const divisionOrder = Math.round(Number(constraints.divisionOrder || 0));
  const clubId = Number(constraints.clubId || 0);
  const passesHardLimits = (range) => {
    if(!mediaRangeAllowedByDivision(range, divisionOrder)) return false;
    if(range.id === 'elite_mundial' && clubId > 0 && clubEliteCountInContext(context, clubId) >= PLAYER_ELITE_MAX_PER_CLUB) return false;
    return true;
  };
  if(!context){
    return passesHardLimits(preferred) ? preferred : (PLAYER_GENERATION_MEDIA_RANGES.find(passesHardLimits) || PLAYER_GENERATION_MEDIA_RANGES[PLAYER_GENERATION_MEDIA_RANGES.length - 1]);
  }
  const players = contextPlayersForGeneration(context);
  const targetTotal = Math.max(players.length + 1, Number(context.targetTotal || 0));
  const counts = {};
  players.forEach(player => {
    const key = mediaRangeIdForOverall(player.overall ?? visibleOverall(player));
    counts[key] = (counts[key] || 0) + 1;
  });
  const under = PLAYER_GENERATION_MEDIA_RANGES.filter(range => passesHardLimits(range) && (counts[range.id] || 0) < mediaRangeTargetCount(range, targetTotal));
  const fallbackAllowed = PLAYER_GENERATION_MEDIA_RANGES.filter(passesHardLimits);
  const fallbackWithoutElite = fallbackAllowed.filter(range => range.id !== 'elite_mundial');
  const allowed = under.length ? under : (fallbackWithoutElite.length ? fallbackWithoutElite : fallbackAllowed);
  if(allowed.some(range => range.id === preferred.id)) return preferred;
  const preferredIndex = PLAYER_GENERATION_MEDIA_RANGES.findIndex(range => range.id === preferred.id);
  const lower = PLAYER_GENERATION_MEDIA_RANGES.slice(preferredIndex + 1).find(range => allowed.some(item => item.id === range.id));
  if(lower) return lower;
  return weightedRulePick(allowed, `${seedKey}-range-fallback`) || PLAYER_GENERATION_MEDIA_RANGES[PLAYER_GENERATION_MEDIA_RANGES.length - 1];
}
function localNationalityForCountry(country='Argentina'){
  const clean = String(country || '').trim() || 'Argentina';
  const mapped = PLAYER_NATIONALITY_BY_COUNTRY && PLAYER_NATIONALITY_BY_COUNTRY[clean] ? String(PLAYER_NATIONALITY_BY_COUNTRY[clean]) : clean;
  return mapped || 'Argentina';
}
function allConfiguredNationalities(){
  const locals = Array.from(new Set((seed?.clubs || []).map(club => localNationalityForCountry(clubCountry(club))).filter(Boolean)));
  const pool = locals.concat(SOUTH_AMERICAN_NATIONALITIES || []).concat(WORLD_NATIONALITIES || []);
  return Array.from(new Set(pool.filter(Boolean)));
}
function freeAgentNationalityForIndex(index=0, seedKey='free-agent'){
  const pool = allConfiguredNationalities();
  if(!pool.length) return 'Argentina';
  const offset = hashNumber(`free-nationality-offset-${seedKey}`, pool.length);
  return pool[(Math.max(0, Math.round(Number(index || 0))) + offset) % pool.length];
}
function pickNationalityForGeneration(id, label, context=null, options={}){
  const group = pickRuleWithAudit(PLAYER_GENERATION_NATIONALITY_GROUPS, player => nationalityGroupId(player.nationality), context, `${label}-${id}-nat-group`);
  let countries = group?.countries?.length ? group.countries : ['Argentina'];
  if(group?.id === 'local'){
    countries = [localNationalityForCountry(options.localCountry || 'Argentina')];
  }
  return countries[hashNumber(`${label}-${id}-nat-country`, countries.length)];
}
function pickPositionGroupForGeneration(id, label, context=null){
  return pickRuleWithAudit(PLAYER_GENERATION_POSITION_GROUPS, player => playerRoleGroup(player.position), context, `${label}-${id}-pos-group`)?.id || 'MID';
}
function pickPositionFromGroup(groupId, id, label){
  const group = PLAYER_GENERATION_POSITION_GROUPS.find(item => item.id === groupId) || PLAYER_GENERATION_POSITION_GROUPS[2];
  const pool = group.positions || ['MC'];
  return pool[hashNumber(`${label}-${id}-pos`, pool.length)];
}
function mediaFromGenerationRules(prestige, id, group, context=null, label='player', constraints={}){
  const range = pickMediaRangeWithAudit(context, `${label}-${id}-${group}`, constraints);
  const span = Math.max(1, range.media_max - range.media_min + 1);
  const raw = range.media_min + hashNumber(`${label}-${id}-${group}-media`, span);
  const prestigeBias = Math.round(((Number(prestige) || 50) - 50) / 28);
  return clamp(raw + prestigeBias, range.media_min, range.media_max);
}
function initialAnnualSalaryForMedia(media, factor=1){
  const range = mediaRangeForOverall(media);
  return Math.max(0, Math.round((Number(media) || 0) * Number(range.salaryMultiplier || 0) * PLAYER_ECONOMY_SCALE * Number(factor || 1)));
}
function clauseBaseFromDivisionName(divisionName){
  const lower = String(divisionName || '').toLowerCase();
  if(lower.includes('profesional') || lower.includes('primera')) return PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER[1];
  if(lower.includes('nacional') || lower.includes('segunda')) return PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER[2];
  return PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER[3];
}
function clauseBaseForClub(clubId, divisionName=''){
  if(Number(clubId || 0) <= 0) return clauseBaseFromDivisionName(divisionName);
  if(seed?.clubs?.length){
    const order = Math.round(Number(clubDivision(clubId).order || 3));
    return PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER[order] || PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER[3];
  }
  return clauseBaseFromDivisionName(divisionName);
}
function playerClauseFor(player, clubId=player?.clubId, divisionName=''){
  const salary = Math.max(0, Math.round(Number(player?.salary || 0)));
  const age = Math.max(15, Math.round(Number(player?.age || 18)));
  const multiplier = Math.max(PLAYER_CLAUSE_MIN_MULTIPLIER, clauseBaseForClub(clubId, divisionName) - (PLAYER_CLAUSE_AGE_REDUCTION * age));
  const baseClause = Math.max(salary * PLAYER_CLAUSE_MIN_MULTIPLIER, Math.round(salary * multiplier));
  return Math.max(0, Math.round(baseClause * PLAYER_CLAUSE_VALUE_SCALE));
}
function refreshPlayerClause(player){
  if(!player) return 0;
  player.clause = playerClauseFor(player, player.clubId);
  player.value = player.clause;
  return player.clause;
}
function refreshAllPlayerClauses(){
  (seed?.players || []).forEach(refreshPlayerClause);
  (game?.marketPlayers || []).forEach(refreshPlayerClause);
}
function ensurePlayerEconomics(player, salaryFactor=1){
  if(!player) return player;
  const media = Math.max(1, Math.round(Number(player.overall || 0) || visibleOverall(player) || 50));
  if(!Number.isFinite(Number(player.salary)) || Number(player.salary) <= 0){
    player.salary = initialAnnualSalaryForMedia(media, salaryFactor);
  }
  // Las cláusulas se recalculan siempre para que los ajustes de balance impacten
  // también en partidas guardadas, sin modificar sueldos existentes.
  refreshPlayerClause(player);
  return player;
}
function generatedPlayerFactory({ id, position, clubId=0, age=18, prestige=50, nameContext='Jugador', divisionName='', divisionOrder=null, generationContext=null, salaryFactor=1, freeAgent=false, youthFreeAgent=false, mediaMin=null, mediaMax=null, nationalityOverride=null, localCountry=null }){
  const cleanPosition = normalizePlayerPosition(position, id);
  const group = playerRoleGroup(cleanPosition);
  const generationDivision = Number.isFinite(Number(divisionOrder)) ? Number(divisionOrder) : generationDivisionOrder(clubId, divisionName);
  let media;
  if(Number.isFinite(Number(mediaMin)) && Number.isFinite(Number(mediaMax))){
    const min = clamp(Math.round(Number(mediaMin)), 1, 99);
    const max = Math.max(min, clamp(Math.round(Number(mediaMax)), 1, 99));
    media = min + hashNumber(`${nameContext}-${id}-${group}-fixed-media`, Math.max(1, max - min + 1));
  } else {
    media = mediaFromGenerationRules(prestige, id, group, generationContext, nameContext, { clubId, divisionOrder:generationDivision });
  }
  const skills = skillsForPosition(cleanPosition, media, id);
  const visible = averageGeneratedVisible(cleanPosition, skills);
  const player = {
    id,
    name:generatedPlayerName(id, nameContext),
    age,
    position:cleanPosition,
    clubId,
    freeAgent:Boolean(freeAgent),
    youthFreeAgent:Boolean(youthFreeAgent),
    nationality:nationalityOverride || pickNationalityForGeneration(id, divisionName || nameContext, generationContext, { localCountry:localCountry || (Number(clubId || 0) > 0 ? clubCountry(seed?.clubs?.find(c => Number(c.id) === Number(clubId))) : null) }),
    overall:visible,
    skills,
    salary:initialAnnualSalaryForMedia(visible, salaryFactor),
    salaryPaidCount:0,
    lastSalaryPaidSeason:0
  };
  player.clause = playerClauseFor(player, clubId, divisionName);
  player.value = player.clause;
  registerGeneratedPlayer(generationContext, player);
  return player;
}
function generationRosterBlueprint(){
  return ['POR','POR','POR','LD','LI','DFC','DFC','DFC','LD','LI','MCD','MCD','MC','MC','MCO','MCO','MI','MD','ED','EI','ED','EI','DC','DC','DC'];
}
function nationalityRegion(nationality){
  const value = String(nationality || '').toLowerCase();
  const america = ['argentina','bolivia','brasil','chile','colombia','ecuador','paraguay','perú','peru','uruguay','venezuela','méxico','mexico','estados unidos','canadá','canada','costa rica','panamá','panama'];
  const europe = ['españa','espana','italia','francia','alemania','portugal','inglaterra','croacia','serbia','polonia','países bajos','paises bajos','holanda','bélgica','belgica','suiza','dinamarca','noruega','suecia'];
  const africa = ['marruecos','senegal','nigeria','ghana','camerún','camerun','argelia','egipto','costa de marfil','túnez','tunez','sudáfrica','sudafrica'];
  const asia = ['japón','japon','corea','china','irán','iran','arabia saudita','qatar','australia'];
  if(america.includes(value)) return 'America';
  if(europe.includes(value)) return 'Europa';
  if(africa.includes(value)) return 'africa';
  if(asia.includes(value)) return 'Asia';
  return 'Otros';
}
function faceMaxForRegion(region){
  return region === 'Otros' ? 20 : 10;
}
function faceBaseForPlayer(player){
  const region = nationalityRegion(player?.nationality);
  const index = hashNumber(`face-${player?.id || 0}-${region}`, faceMaxForRegion(region)) + 1;
  return `img/faces/${region} (${index})`;
}
function faceImg(player, className='photo-thumb'){
  const base = faceBaseForPlayer(player);
  const alt = `Foto de ${escapeHtml(player?.name || 'jugador')}`;
  return `<img class="${className}" src="${base}.png" alt="${alt}" data-face-base="${base}" data-face-ext-index="0" onerror="tryNextFaceExt(this)">`;
}
function tryNextFaceExt(img){
  const exts = ['.png','.jpg','.jpeg','.webp'];
  const index = Number(img.dataset.faceExtIndex || 0) + 1;
  const base = img.dataset.faceBase;
  if(base && index < exts.length){
    img.dataset.faceExtIndex = String(index);
    img.src = `${base}${exts[index]}`;
    return;
  }
  img.onerror = null;
  img.replaceWith(fallbackFaceNode(img.className));
}
function fallbackFaceNode(className){
  const node = document.createElement('div');
  node.className = className || 'photo-thumb';
  node.textContent = '👤';
  return node;
}
function playerGroup(position){
  return roleMeta(position).group;
}
function playerGroupClass(position){
  const group = playerGroup(position);
  return group === 'gk' ? 'gk' : group === 'def' ? 'def' : group === 'att' ? 'att' : 'mid';
}
function slotGroup(slot){
  if(slot === 'POR') return 'gk';
  if(['LD','LI','DFC'].includes(slot)) return 'def';
  if(['MCD','MC','MCO','MI','MD'].includes(slot)) return 'mid';
  return 'att';
}
function roleMirrorSide(role){
  const map = { LD:'LI', LI:'LD', ED:'EI', EI:'ED', MD:'MI', MI:'MD' };
  return map[role] || '';
}
function sideEquivalentRole(playerPosition, slot){
  const position = String(playerPosition || '').toUpperCase();
  const target = String(slot || '').toUpperCase();
  if(position === target) return true;
  if(roleMirrorSide(position) === target) return true;
  const widePairs = { ED:['MD'], MD:['ED'], EI:['MI'], MI:['EI'] };
  return (widePairs[position] || []).includes(target);
}
function playerFitsSlot(player, slot){
  return playerGroup(player.position) === slotGroup(slot) || sideEquivalentRole(player.position, slot);
}
function playerExactRoleFitsSlot(player, slot){
  return String(player?.position || '').toUpperCase() === String(slot || '').toUpperCase();
}
function playerTacticFitLevel(player, slot){
  if(!player) return 'empty';
  if(playerExactRoleFitsSlot(player, slot)) return 'exact';
  if(playerFitsSlot(player, slot)) return 'role';
  return 'zone';
}
function playerTacticFitFactor(player, slot){
  const level = playerTacticFitLevel(player, slot);
  if(level === 'exact') return 1;
  if(level === 'role') return 0.75;
  return 0.5;
}
function playerTacticFitLabel(player, slot){
  const level = playerTacticFitLevel(player, slot);
  if(level === 'exact') return 'OK';
  if(level === 'role') return '75%';
  return '50%';
}
function playerTacticFitTitle(player, slot){
  const level = playerTacticFitLevel(player, slot);
  if(level === 'exact') return 'Rol exacto: rinde al 100%';
  if(level === 'role') return 'Fuera de rol exacto, pero compatible: rinde al 75%';
  return 'Fuera de zona natural: rinde al 50%';
}
function isGoalkeeperSlot(slot){
  return slot === 'POR';
}
function isGoalkeeperPlayer(player){
  return player?.position === 'POR';
}
function canAssignPlayerToSlot(player, slot){
  if(!player) return false;
  if(isGoalkeeperSlot(slot)) return isGoalkeeperPlayer(player);
  return !isGoalkeeperPlayer(player);
}
function zoneFactor(player, slot){
  return playerTacticFitFactor(player, slot);
}
function conditionLossForPlayer(player){
  const loss = rnd(MATCH_CONDITION_LOSS_MIN, MATCH_CONDITION_LOSS_MAX);
  return player?.position === 'POR' ? loss * GOALKEEPER_CONDITION_LOSS_FACTOR : loss;
}
function rosterGroupCounts(squad=[]){
  const counts = { POR:0, DEF:0, MID:0, ATT:0 };
  (squad || []).forEach(player => {
    const group = playerRoleGroup(player.position);
    if(Object.prototype.hasOwnProperty.call(counts, group)) counts[group] += 1;
  });
  return counts;
}
function minimumRosterRequirements(){
  return {
    total:MIN_PLAYERS_PER_CLUB,
    POR:BOT_MIN_GOALKEEPERS,
    DEF:BOT_MIN_DEFENDERS,
    MID:BOT_MIN_MIDFIELDERS,
    ATT:BOT_MIN_ATTACKERS
  };
}
function clubRequirementIssues(clubId){
  const squad = playersByClub(clubId);
  const counts = rosterGroupCounts(squad);
  const req = minimumRosterRequirements();
  const issues = [];
  if(squad.length < req.total) issues.push(`necesita ${req.total} jugadores y tiene ${squad.length}`);
  if(counts.POR < req.POR) issues.push(`necesita ${req.POR} porteros y tiene ${counts.POR}`);
  if(counts.DEF < req.DEF) issues.push(`necesita ${req.DEF} defensores y tiene ${counts.DEF}`);
  if(counts.MID < req.MID) issues.push(`necesita ${req.MID} mediocampistas y tiene ${counts.MID}`);
  if(counts.ATT < req.ATT) issues.push(`necesita ${req.ATT} delanteros y tiene ${counts.ATT}`);
  return issues;
}
function invalidClubRequirements(options={}){
  const onlySelected = Boolean(options.onlySelected);
  const clubs = onlySelected && game?.selectedClubId
    ? seed.clubs.filter(c => Number(c.id) === Number(game.selectedClubId))
    : seed.clubs;
  return clubs.map(c => ({ club:c, issues:clubRequirementIssues(c.id) })).filter(x => x.issues.length);
}
function isClubRequirementsBlocking(){
  // Los bots se reparan automáticamente. La advertencia ya no debe bloquear toda la interfaz.
  return false;
}
function nextEmergencyPlayerId(){
  const ids = (seed?.players || []).map(p => Number(p.id) || 0);
  return Math.max(0, ...ids) + 1;
}
function emergencyPositionForGroup(group, seedKey=''){
  const clean = String(group || '').toUpperCase();
  if(clean === 'POR') return 'POR';
  if(clean === 'DEF'){
    const pool = ['DFC','LD','LI'];
    return pool[hashNumber(`${seedKey}-def`, pool.length)];
  }
  if(clean === 'MID'){
    const pool = ['MC','MCD','MCO','MI','MD'];
    return pool[hashNumber(`${seedKey}-mid`, pool.length)];
  }
  const pool = ['DC','ED','EI'];
  return pool[hashNumber(`${seedKey}-att`, pool.length)];
}
function weakestBotPlayerForConversion(clubId, neededGroup){
  const req = minimumRosterRequirements();
  const squad = playersByClub(clubId).filter(p => !p.emergencyLocked);
  const counts = rosterGroupCounts(squad);
  const protectedByGroup = { POR:req.POR, DEF:req.DEF, MID:req.MID, ATT:req.ATT };
  return squad
    .filter(player => {
      const group = playerRoleGroup(player.position);
      if(group === neededGroup) return false;
      return (counts[group] || 0) > (protectedByGroup[group] || 0);
    })
    .sort((a,b)=>visibleOverall(a)-visibleOverall(b))[0] || null;
}
function normalizeEmergencyPlayerEconomics(player){
  const media = clamp(Math.round(Number(player.overall || visibleOverall(player) || BOT_EMERGENCY_MEDIA_MIN)), BOT_EMERGENCY_MEDIA_MIN, BOT_EMERGENCY_MEDIA_MAX);
  player.overall = media;
  player.skills = skillsForPosition(player.position, media, player.id);
  player.salary = initialAnnualSalaryForMedia(media, BOT_EMERGENCY_SALARY_FACTOR);
  refreshPlayerClause(player);
  return player;
}
function createEmergencyBotPlayer(club, group, report){
  const id = nextEmergencyPlayerId();
  const position = emergencyPositionForGroup(group, `${club.id}-${id}`);
  const media = BOT_EMERGENCY_MEDIA_MIN + hashNumber(`emergency-media-${club.id}-${id}-${group}`, BOT_EMERGENCY_MEDIA_MAX - BOT_EMERGENCY_MEDIA_MIN + 1);
  const player = generatedPlayerFactory({
    id,
    position,
    clubId:club.id,
    age:18 + hashNumber(`emergency-age-${club.id}-${id}`, 17),
    prestige:35,
    nameContext:`Emergencia ${club.name}`,
    divisionName:club.divisionName,
    divisionOrder:club.divisionOrder,
    generationContext:null,
    salaryFactor:BOT_EMERGENCY_SALARY_FACTOR,
    freeAgent:false
  });
  player.origin = 'Emergencia bot';
  player.emergencyBot = true;
  normalizeEmergencyPlayerEconomics(player);
  seed.players.push(player);
  if(report) report.created += 1;
  ensurePlayerStateForAll();
  return player;
}
function convertWeakBotPlayer(club, group, report){
  const player = weakestBotPlayerForConversion(club.id, group);
  if(!player) return null;
  player.position = emergencyPositionForGroup(group, `${club.id}-${player.id}-convert`);
  player.origin = player.origin || 'Reconversión de emergencia bot';
  player.emergencyBot = true;
  normalizeEmergencyPlayerEconomics(player);
  if(report) report.converted += 1;
  return player;
}
function addOrConvertEmergencyBotPlayer(club, group, report){
  const rosterSize = playersByClub(club.id).length;
  if(rosterSize < MAX_PLAYERS_PER_CLUB) return createEmergencyBotPlayer(club, group, report);
  return convertWeakBotPlayer(club, group, report) || createEmergencyBotPlayer(club, group, report);
}
function repairBotRoster(club, report){
  if(!club || Number(club.id) === Number(game?.selectedClubId)) return;
  const req = minimumRosterRequirements();
  const fillGroup = (group, target) => {
    let guard = 0;
    while(rosterGroupCounts(playersByClub(club.id))[group] < target && guard < 20){
      addOrConvertEmergencyBotPlayer(club, group, report);
      guard += 1;
    }
  };
  fillGroup('POR', req.POR);
  fillGroup('DEF', req.DEF);
  fillGroup('MID', req.MID);
  fillGroup('ATT', req.ATT);
  let guard = 0;
  const extraGroups = ['DEF','MID','ATT','POR'];
  while(playersByClub(club.id).length < req.total && guard < 30){
    const group = extraGroups[guard % extraGroups.length];
    addOrConvertEmergencyBotPlayer(club, group, report);
    guard += 1;
  }
}
function repairBotRosters(options={}){
  if(!BOT_ROSTER_REPAIR_ENABLED || !game || !seed?.clubs?.length) return { created:0, converted:0, clubs:0 };
  const report = { created:0, converted:0, clubs:0, reason:options.reason || 'auto' };
  seed.clubs.forEach(club => {
    if(Number(club.id) === Number(game.selectedClubId)) return;
    const before = clubRequirementIssues(club.id).length;
    if(before){
      repairBotRoster(club, report);
      report.clubs += 1;
    }
  });
  if(report.created || report.converted){
    ensurePlayerStateForAll();
    if(game.botRosterRepairLog === undefined) game.botRosterRepairLog = [];
    game.botRosterRepairLog.push({ ...report, turn:currentTurnIndex(), season:game.seasonNumber || 1, createdAt:Date.now() });
    game.botRosterRepairLog = game.botRosterRepairLog.slice(-20);
  }
  return report;
}
function normalizeMentality(mode){
  const value = String(mode || '').trim();
  const legacy = { posicional:'normal', ataque:'ofensivo', defensiva:'defensivo' };
  const normalized = legacy[value] || value;
  return MENTALITIES.includes(normalized) ? normalized : 'normal';
}
function mentalityLabel(mode){
  const labels = {
    muy_defensivo:'Muy defensivo',
    defensivo:'Defensivo',
    normal:'Normal',
    ofensivo:'Ofensivo',
    muy_ofensivo:'Muy ofensivo'
  };
  return labels[normalizeMentality(mode)] || 'Normal';
}
function mentalityMarker(mode){
  const normalized = normalizeMentality(mode);
  const meta = {
    muy_defensivo:{ cls:'very-defense', text:'←←', title:'Muy defensivo' },
    defensivo:{ cls:'defense', text:'←', title:'Defensivo' },
    normal:{ cls:'normal', text:'•', title:'Normal' },
    ofensivo:{ cls:'attack', text:'→', title:'Ofensivo' },
    muy_ofensivo:{ cls:'very-attack', text:'→→', title:'Muy ofensivo' }
  }[normalized] || { cls:'normal', text:'•', title:'Normal' };
  return `<span class="mentality-marker ${meta.cls}" title="${meta.title}" aria-label="${meta.title}"><span class="mentality-marker-symbol">${meta.text}</span></span>`;
}
function nextMentality(current){
  const idx = MENTALITIES.indexOf(normalizeMentality(current));
  return MENTALITIES[(idx + 1) % MENTALITIES.length] || 'normal';
}
function ensurePlayerMentalitiesStore(targetGame=game){
  if(!targetGame) return {};
  targetGame.playerMentalities = (targetGame.playerMentalities && typeof targetGame.playerMentalities === 'object' && !Array.isArray(targetGame.playerMentalities)) ? targetGame.playerMentalities : {};
  Object.keys(targetGame.playerMentalities).forEach(id => {
    const cleanId = Number(id);
    if(!cleanId) delete targetGame.playerMentalities[id];
    else targetGame.playerMentalities[cleanId] = normalizeMentality(targetGame.playerMentalities[id]);
  });
  return targetGame.playerMentalities;
}
function playerMentality(playerId, tactic = game?.tactic){
  const id = Number(playerId || 0);
  const globalStore = game?.playerMentalities || {};
  return normalizeMentality(globalStore[id] || tactic?.playerMentalities?.[id]);
}
function setPlayerMentality(playerId, mode, tactic = game?.tactic){
  const id = Number(playerId || 0);
  if(!id) return 'normal';
  const normalized = normalizeMentality(mode);
  if(game){
    const store = ensurePlayerMentalitiesStore(game);
    store[id] = normalized;
  }
  if(tactic){
    tactic.playerMentalities = (tactic.playerMentalities && typeof tactic.playerMentalities === 'object' && !Array.isArray(tactic.playerMentalities)) ? tactic.playerMentalities : {};
    tactic.playerMentalities[id] = normalized;
  }
  return normalized;
}
function applyStarterMentalities(tactic){
  tactic = tactic || {};
  const globalStore = game ? ensurePlayerMentalitiesStore(game) : {};
  const next = { ...(tactic.playerMentalities || {}) };
  Object.keys(next).forEach(id => {
    const cleanId = Number(id);
    if(!cleanId) delete next[id];
    else next[cleanId] = normalizeMentality(next[id]);
  });
  (tactic.starters || []).filter(Boolean).forEach(id => {
    const cleanId = Number(id);
    next[cleanId] = normalizeMentality(globalStore[cleanId] || next[cleanId]);
    if(game) globalStore[cleanId] = next[cleanId];
  });
  tactic.playerMentalities = next;
  return tactic;
}
function formationLayout(formation){
  return FORMATION_VISUALS[formation] || [4,0,4,0,2];
}
function slotVisualColumn(slot){
  const map = {
    POR:{ key:'POR', x:8 },
    DFC:{ key:'DFC', x:23 }, LD:{ key:'LD', x:23 }, LI:{ key:'LI', x:23 },
    MCD:{ key:'MCD', x:38 },
    MC:{ key:'MC', x:52 }, MI:{ key:'MI', x:56 }, MD:{ key:'MD', x:56 },
    MCO:{ key:'MCO', x:66 },
    EI:{ key:'EI', x:72 }, ED:{ key:'ED', x:72 },
    DC:{ key:'DC', x:84 }
  };
  return map[slot] || { key:String(slot || 'MC'), x:52 };
}
function roleBaseY(slot){
  const map = {
    POR:50,
    LI:18, LD:82,
    MI:18, MD:82,
    EI:18, ED:82
  };
  return map[slot] || 50;
}
function distributedRoleY(slot, count, rowIndex){
  if(count <= 1) return roleBaseY(slot);
  const compactPresets = {
    DFC:{
      2:[42,58],
      3:[36,50,64]
    },
    MC:{
      2:[42,58],
      3:[36,50,64],
      4:[30,43,57,70]
    },
    DC:{
      2:[40,60],
      3:[32,50,68]
    }
  };
  const preset = compactPresets[slot]?.[count];
  if(preset) return preset[Math.max(0, Math.min(rowIndex, preset.length - 1))];
  const centerRoles = ['DFC','MCD','MC','MCO','DC'];
  if(centerRoles.includes(slot)){
    const minY = count >= 4 ? 24 : 34;
    const maxY = count >= 4 ? 76 : 66;
    return minY + ((maxY - minY) * rowIndex / Math.max(1, count - 1));
  }
  const base = roleBaseY(slot);
  const spread = Math.min(14, 6 + count * 2);
  const start = base - spread * (count - 1) / 2;
  return clamp(start + spread * rowIndex, 10, 90);
}
function formationCoordinates(formation){
  const slots = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  const roleGroups = {};
  slots.forEach((slot, index) => {
    const column = slotVisualColumn(slot);
    if(!roleGroups[column.key]) roleGroups[column.key] = { slot, x:column.x, items:[] };
    roleGroups[column.key].items.push(index);
  });
  const coords = Array(slots.length).fill(null);
  Object.values(roleGroups).forEach(group => {
    const count = group.items.length;
    group.items.forEach((slotIndex, rowIndex) => {
      coords[slotIndex] = { x:group.x, y:distributedRoleY(group.slot, count, rowIndex) };
    });
  });
  return coords;
}
function roleCompatibility(position, slot){
  if(position === slot) return 16;
  if(sideEquivalentRole(position, slot)) return 10;
  const near = {
    LD:['LI','DFC'], LI:['LD','DFC'], DFC:['LD','LI'],
    MCD:['MC','VOL'], MC:['MCD','VOL','MCO','MI','MD'], VOL:['MC','MCD','MCO'], MCO:['MC','VOL'],
    MI:['EI','MC','MCO','MD'], MD:['ED','MC','MCO','MI'],
    ED:['MD','EI','DC','MCO'], EI:['MI','ED','DC','MCO'],
    DC:['ED','EI','MCO'], POR:[]
  };
  return (near[slot] || []).includes(position) ? 6 : -10;
}
function assignPlayersToRoleSequence(players, formation){
  const slots = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  const remaining = players.slice();
  const assigned = [];
  slots.forEach(slot => {
    remaining.sort((a,b)=>(visibleOverall(b) + roleCompatibility(b.position, slot)) - (visibleOverall(a) + roleCompatibility(a.position, slot)));
    const pick = remaining.shift();
    if(pick) assigned.push({ player:pick, slot });
  });
  return assigned;
}
function pitchSlots(tactic){
  const slots = FORMATIONS[tactic?.formation] || FORMATIONS['4-4-2'];
  const coords = formationCoordinates(tactic?.formation || '4-4-2');
  return slots.map((slot, i) => {
    const player = playerById((tactic?.starters || [])[i]);
    return { player, slot, index:i, x: coords[i]?.x || 50, y: coords[i]?.y || 50, mentality: player ? playerMentality(player.id, tactic) : 'posicional' };
  });
}
function fitnessRingSvg(playerId){
  const condition = currentCondition(playerId);
  const active = Math.max(0, Math.min(8, Math.ceil(condition / 12.5)));
  const colors = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#16a34a','#15803d'];
  const cx = 34, cy = 34, r = 31;
  const segments = [];
  for(let i=0;i<8;i++){
    const a0 = (-120 + i * 45) * Math.PI / 180;
    const a1 = (-120 + i * 45 + 30) * Math.PI / 180;
    const x1 = cx + Math.cos(a0) * r;
    const y1 = cy + Math.sin(a0) * r;
    const x2 = cx + Math.cos(a1) * r;
    const y2 = cy + Math.sin(a1) * r;
    const color = i < active ? colors[i] : 'rgba(148,163,184,.22)';
    segments.push(`<path d="M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}" stroke="${color}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
  }
  return `<svg class="fitness-ring" viewBox="0 0 68 68" aria-hidden="true">${segments.join('')}</svg>`;
}



