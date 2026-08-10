/* V8.08 · Cierre de temporada, retiros, mercado libre y balance bot. Extraído de 05-state-season.js sin alterar el orden lógico original. */

function findPlayedMatchById(matchId){
  const id = String(matchId || '');
  for(const round of (game?.fixtures || [])){
    const match = (round.matches || []).find(item => String(item.id) === id);
    if(match?.played) return match;
  }
  return (game?.matchHistory || []).find(item => String(item.id) === id && item.played) || null;
}
function playoffTieResult(tie){
  if(!tie?.matchIds?.length) return null;
  const matches = tie.matchIds.map(findPlayedMatchById).filter(Boolean);
  if(matches.length < tie.matchIds.length) return null;
  const totals = { [tie.upperClubId]:0, [tie.lowerClubId]:0 };
  matches.forEach(match => {
    totals[match.homeId] = Number(totals[match.homeId] || 0) + Number(match.homeGoals || 0);
    totals[match.awayId] = Number(totals[match.awayId] || 0) + Number(match.awayGoals || 0);
  });
  const upperGoals = Number(totals[tie.upperClubId] || 0);
  const lowerGoals = Number(totals[tie.lowerClubId] || 0);
  const winnerClubId = upperGoals === lowerGoals ? Number(tie.advantageClubId || tie.upperClubId) : (upperGoals > lowerGoals ? Number(tie.upperClubId) : Number(tie.lowerClubId));
  const loserClubId = winnerClubId === Number(tie.upperClubId) ? Number(tie.lowerClubId) : Number(tie.upperClubId);
  return { winnerClubId, loserClubId, upperGoals, lowerGoals, tied:upperGoals === lowerGoals };
}
function argentinaPlayoffTiesForSeason(){
  const stored = game?.argentinaPlayoffs;
  if(stored?.season === Number(game?.seasonNumber || 1) && Array.isArray(stored.ties)) return stored.ties;
  return [];
}
function computeArgentinaSeasonMovements(){
  const first = argentinaDivisionByOrder(1);
  const second = argentinaDivisionByOrder(2);
  const third = argentinaDivisionByOrder(3);
  const movements = [];
  if(first && second){
    [1,2].forEach(position => {
      const row = standingAtPosition(second.id, position);
      if(row) addUniqueMovement(movements, movementRecord('promotion', row.clubId, second, first, position === 1 ? 'Campeón / ascenso directo' : 'Ascenso directo'));
    });
    [17,18].forEach(position => {
      const row = standingAtPosition(first.id, position);
      if(row) addUniqueMovement(movements, movementRecord('relegation', row.clubId, first, second, 'Descenso directo'));
    });
  }
  if(second && third){
    [1,2].forEach(position => {
      const row = standingAtPosition(third.id, position);
      if(row) addUniqueMovement(movements, movementRecord('promotion', row.clubId, third, second, position === 1 ? 'Campeón / ascenso directo' : 'Ascenso directo'));
    });
    [17,18].forEach(position => {
      const row = standingAtPosition(second.id, position);
      if(row) addUniqueMovement(movements, movementRecord('relegation', row.clubId, second, third, 'Descenso directo'));
    });
  }
  argentinaPlayoffTiesForSeason().forEach(tie => {
    const result = playoffTieResult(tie);
    if(!result) return;
    const upperDivision = (seed?.divisions || []).find(d => d.id === tie.upperDivisionId);
    const lowerDivision = (seed?.divisions || []).find(d => d.id === tie.lowerDivisionId);
    if(!upperDivision || !lowerDivision) return;
    if(Number(result.winnerClubId) === Number(tie.lowerClubId)){
      addUniqueMovement(movements, movementRecord('promotion', tie.lowerClubId, lowerDivision, upperDivision, 'Ganó playoff de promoción'));
      addUniqueMovement(movements, movementRecord('relegation', tie.upperClubId, upperDivision, lowerDivision, 'Perdió playoff de promoción'));
    }
  });
  return movements;
}
function divisionUsesArgentinaRules(division){
  return normalizeScheduleText(division?.country || '') === 'argentina' && [1,2,3].includes(Number(division?.order || 0));
}
function divisionCountryGroupsForSeason(){
  const groups = new Map();
  (seed?.divisions || []).forEach(division => {
    const country = divisionCountryKey(division);
    if(!country) return;
    if(!groups.has(country)) groups.set(country, []);
    groups.get(country).push(division);
  });
  return Array.from(groups.entries()).map(([country, divisions]) => ({
    country,
    divisions:divisions.slice().sort((a,b)=>(a.order || 0)-(b.order || 0))
  }));
}
function computeSeasonMovements(){
  const movements = [];
  let argentinaHandled = false;
  divisionCountryGroupsForSeason().forEach(group => {
    const isArgentinaGroup = group.country === 'argentina';
    if(isArgentinaGroup){
      if(!argentinaHandled && argentinaDivisions().length >= 3){
        computeArgentinaSeasonMovements().forEach(move => addUniqueMovement(movements, move));
      }
      argentinaHandled = true;
      return;
    }
    const divisions = group.divisions || [];
    if(divisions.length < 2) return;
    for(let i=1; i<divisions.length; i++){
      const upper = divisions[i-1];
      const lower = divisions[i];
      if(divisionCountryKey(upper) !== divisionCountryKey(lower)) continue;
      const lowerTable = sortedStandings(lower.id);
      const upperTable = sortedStandings(upper.id);
      const lowerChampion = lowerTable[0];
      const upperLast = upperTable[upperTable.length - 1];
      if(lowerChampion){
        addUniqueMovement(movements, movementRecord('promotion', lowerChampion.clubId, lower, upper, 'Campeón'));
      }
      if(upperLast){
        addUniqueMovement(movements, movementRecord('relegation', upperLast.clubId, upper, lower, 'Descenso'));
      }
    }
  });
  return movements;
}
function clubWorldCupQualifierCountForDivision(divisionId){
  const division=(seed?.divisions || []).find(d => String(d.id || '') === String(divisionId || ''));
  if(!division || Number(division.order || 0) !== 1) return 0;
  const qualified=typeof clubWorldCupQualifiedClubIdsForDisplay === 'function' ? clubWorldCupQualifiedClubIdsForDisplay() : new Set();
  return (seed?.clubs || []).filter(club => String(club?.divisionId || '') === String(divisionId || '') && qualified.has(Number(club?.id || 0))).length;
}
function clubWorldCupStandingStatusClass(divisionId, index){
  return '';
}
function argentineStandingStatusClass(divisionId, index){
  const division = (seed?.divisions || []).find(d => d.id === divisionId);
  if(!divisionUsesArgentinaRules(division)) return '';
  const position = Number(index || 0) + 1;
  const order = Number(division.order || 0);
  if(order === 1){
    // Los cupos internacionales de Primera División se pintan exclusivamente
    // desde CLUB_WORLD_CUP_CONFIG para que coincidan con la clasificación real.
    if(position === 1) return 'champion-row';
    if(position >= 15 && position <= 16) return 'playoff-row';
    if(position >= 17 && position <= 18) return 'relegation-row';
  }
  if(order === 2){
    if(position >= 1 && position <= 2) return 'promotion-row';
    if(position >= 3 && position <= 4) return 'playoff-row';
    if(position >= 15 && position <= 16) return 'playoff-row';
    if(position >= 17 && position <= 18) return 'relegation-row';
  }
  if(order === 3){
    if(position >= 1 && position <= 2) return 'promotion-row';
    if(position >= 3 && position <= 4) return 'playoff-row';
  }
  return '';
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
      const nextValue = Math.max(0, Math.round(oldValue * 0.30));
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
function repairPlayerSkillBoostsForState(targetGame, players=null){
  if(!targetGame) return { normalized:0, pruned:0 };
  targetGame.playerSkillBoosts = (targetGame.playerSkillBoosts && typeof targetGame.playerSkillBoosts === 'object' && !Array.isArray(targetGame.playerSkillBoosts)) ? targetGame.playerSkillBoosts : {};
  const validIds = new Set();
  const addPlayer = player => {
    const id = Number(player?.id || 0);
    if(id > 0) validIds.add(id);
  };
  (Array.isArray(players) ? players : (seed?.players || [])).forEach(addPlayer);
  (targetGame.marketPlayers || []).forEach(addPlayer);
  let normalized = 0;
  let pruned = 0;
  Object.keys(targetGame.playerSkillBoosts).forEach(rawId => {
    const id = Number(rawId || 0);
    const source = targetGame.playerSkillBoosts[rawId];
    if(!id || !validIds.has(id) || !source || typeof source !== 'object' || Array.isArray(source)){
      delete targetGame.playerSkillBoosts[rawId];
      pruned += 1;
      return;
    }
    const clean = {};
    Object.entries(source).forEach(([skill, rawValue]) => {
      const value = Math.max(0, Math.round(Number(rawValue || 0)));
      if(value > 0) clean[skill] = value;
      if(value !== Number(rawValue || 0)) normalized += 1;
    });
    if(!Object.keys(clean).length){
      delete targetGame.playerSkillBoosts[rawId];
      pruned += 1;
      return;
    }
    if(Object.keys(clean).length !== Object.keys(source).length) normalized += 1;
    targetGame.playerSkillBoosts[id] = clean;
    if(String(rawId) !== String(id)) delete targetGame.playerSkillBoosts[rawId];
  });
  return { normalized, pruned };
}
function repairPlayerAgeSkillPenaltiesForState(targetGame, players=null){
  if(!targetGame) return { cleared:0, normalized:0, pruned:0 };
  targetGame.playerAgeSkillPenalties = (targetGame.playerAgeSkillPenalties && typeof targetGame.playerAgeSkillPenalties === 'object' && !Array.isArray(targetGame.playerAgeSkillPenalties)) ? targetGame.playerAgeSkillPenalties : {};
  const combined = [];
  const seen = new Set();
  const addPlayer = player => {
    const id = Number(player?.id || 0);
    if(!id || seen.has(id)) return;
    seen.add(id);
    combined.push(player);
  };
  (Array.isArray(players) ? players : (seed?.players || [])).forEach(addPlayer);
  (targetGame.marketPlayers || []).forEach(addPlayer);
  let cleared = 0;
  let normalized = 0;
  combined.forEach(player => {
    const id = Number(player.id);
    const raw = Number(targetGame.playerAgeSkillPenalties[id] || 0);
    const before = clamp(Math.round(raw), 0, PLAYER_AGE_DECAY_CAP);
    const age = Math.round(Number(player.age || 18));
    const after = age < PLAYER_AGE_DECAY_START_AGE ? 0 : before;
    if(before > 0 && after === 0) cleared += 1;
    if(!Number.isFinite(raw) || raw !== after) normalized += 1;
    if(after > 0) targetGame.playerAgeSkillPenalties[id] = after;
    else if(Object.prototype.hasOwnProperty.call(targetGame.playerAgeSkillPenalties, id)) delete targetGame.playerAgeSkillPenalties[id];
  });
  let pruned = 0;
  Object.keys(targetGame.playerAgeSkillPenalties).forEach(rawId => {
    const id = Number(rawId || 0);
    if(!id || !seen.has(id)){
      delete targetGame.playerAgeSkillPenalties[rawId];
      pruned += 1;
    }
  });
  return { cleared, normalized, pruned };
}
function ageDecayRollForPlayer(player, season){
  const min = Math.max(0, Math.round(Number(PLAYER_AGE_DECAY_MIN_ANNUAL || 0)));
  const max = Math.max(min, Math.round(Number(PLAYER_AGE_DECAY_MAX_ANNUAL || min)));
  if(max <= 0) return 0;
  return min + hashNumber(`age-decay-${season}-${player?.id || 0}-${player?.age || 0}`, (max - min) + 1);
}
function applySeasonalAgeSkillDecay(season){
  if(!game || !PLAYER_AGE_DECAY_ENABLED) return { players:0, added:0, maxPenalty:0, cleared:0 };
  game.playerAgeSkillPenalties = (game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties)) ? game.playerAgeSkillPenalties : {};
  let players = 0;
  let added = 0;
  let maxPenalty = 0;
  let cleared = 0;
  seed.players.forEach(player => {
    const age = Math.round(Number(player.age || 18));
    if(age < PLAYER_AGE_DECAY_START_AGE){
      const before = clamp(Math.round(Number(game.playerAgeSkillPenalties[player.id] || 0)), 0, PLAYER_AGE_DECAY_CAP);
      if(before > 0) cleared += 1;
      delete game.playerAgeSkillPenalties[player.id];
      return;
    }
    const roll = ageDecayRollForPlayer(player, season);
    const before = clamp(Math.round(Number(game.playerAgeSkillPenalties[player.id] || 0)), 0, PLAYER_AGE_DECAY_CAP);
    const after = clamp(before + roll, 0, PLAYER_AGE_DECAY_CAP);
    if(after > 0) game.playerAgeSkillPenalties[player.id] = after;
    else delete game.playerAgeSkillPenalties[player.id];
    if(after > before){ players += 1; added += (after - before); }
    maxPenalty = Math.max(maxPenalty, after);
  });
  return { players, added, maxPenalty, cleared };
}
function applySeasonalAging(){
  if(!game) return { aged:0, ageDecay:{ players:0, added:0, maxPenalty:0, cleared:0 } };
  let count = 0;
  seed.players.forEach(player => {
    player.age = Math.max(15, Number(player.age || 18) + 1);
    count += 1;
  });
  const decay = applySeasonalAgeSkillDecay(game.seasonNumber || 1);
  return { aged:count, ageDecay:decay };
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
    // V8.75: el club dirigido negocia salarios mediante renovaciones manuales.
    if(Number(player.clubId || 0) === Number(game.selectedClubId || 0)) return;
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
function cleanTacticPlayerReferences(tactic, playerId){
  if(!tactic || typeof tactic !== 'object') return false;
  const id = Number(playerId || 0);
  if(!id) return false;
  let changed = false;
  if(Array.isArray(tactic.starters)){
    tactic.starters = tactic.starters.map(value => {
      if(Number(value) !== id) return value;
      changed = true;
      return 0;
    });
  }
  if(Array.isArray(tactic.bench)){
    const next = tactic.bench.filter(value => Number(value) !== id);
    if(next.length !== tactic.bench.length) changed = true;
    tactic.bench = next;
  }
  if(Array.isArray(tactic.autoSubs)){
    const next = tactic.autoSubs.filter(rule => Number(rule?.outId || 0) !== id && Number(rule?.inId || 0) !== id);
    if(next.length !== tactic.autoSubs.length) changed = true;
    tactic.autoSubs = next;
  }
  if(tactic.playerMentalities && Object.prototype.hasOwnProperty.call(tactic.playerMentalities, id)){
    delete tactic.playerMentalities[id];
    changed = true;
  }
  if(Number(tactic.captainId || 0) === id){
    tactic.captainId = 0;
    changed = true;
  }
  return changed;
}
function removePlayerReferencesFromState(playerId, targetGame=game, options={}){
  if(!targetGame) return { removed:0 };
  const id = Number(playerId || 0);
  if(!id) return { removed:0 };
  let removed = 0;
  const deleteKey = (container, key=id) => {
    if(container && typeof container === 'object' && Object.prototype.hasOwnProperty.call(container, key)){
      delete container[key];
      removed += 1;
    }
  };
  [
    targetGame.playerCondition,
    targetGame.playerMorale,
    targetGame.playerSkillBoosts,
    targetGame.playerAgeSkillPenalties,
    targetGame.trainingPlan,
    targetGame.playerStats,
    targetGame.playerCareerStats,
    targetGame.playerStatus,
    targetGame.playerWear,
    targetGame.playerMentalities,
    targetGame.captaincyProgress,
    targetGame.playerImpactWindows,
    targetGame.playerPalmares?.byPlayerId
  ].forEach(container => deleteKey(container));
  deleteKey(targetGame.playerStars?.byPlayerId);
  deleteKey(targetGame.playerBenchedStreak?.players);
  deleteKey(targetGame.rejectedPurchaseOffers);
  deleteKey(targetGame.rejectedFreeAgentOffers);
  if(targetGame.tactic && cleanTacticPlayerReferences(targetGame.tactic, id)) removed += 1;
  Object.values(targetGame.savedTactics?.slots || {}).forEach(tactic => {
    if(cleanTacticPlayerReferences(tactic, id)) removed += 1;
  });
  Object.values(targetGame.savedTrainingPlans?.slots || {}).forEach(plan => deleteKey(plan?.trainingPlan));
  if(Array.isArray(targetGame.pendingTransfers)){
    const before = targetGame.pendingTransfers.length;
    targetGame.pendingTransfers = targetGame.pendingTransfers.filter(item => ![item?.playerId, item?.inId, item?.outId].some(value => Number(value || 0) === id));
    removed += before - targetGame.pendingTransfers.length;
  }
  if(targetGame.scoutingCenter && typeof targetGame.scoutingCenter === 'object'){
    deleteKey(targetGame.scoutingCenter.reports);
    if(Array.isArray(targetGame.scoutingCenter.listedPlayerIds)){
      const before = targetGame.scoutingCenter.listedPlayerIds.length;
      targetGame.scoutingCenter.listedPlayerIds = targetGame.scoutingCenter.listedPlayerIds.filter(value => Number(value || 0) !== id);
      removed += before - targetGame.scoutingCenter.listedPlayerIds.length;
    }
    if(Array.isArray(targetGame.scoutingCenter.playerIds)){
      const before = targetGame.scoutingCenter.playerIds.length;
      targetGame.scoutingCenter.playerIds = targetGame.scoutingCenter.playerIds.filter(value => Number(value || 0) !== id);
      removed += before - targetGame.scoutingCenter.playerIds.length;
    }
  }
  if(targetGame.lastOwnPlayerOffer && Number(targetGame.lastOwnPlayerOffer.playerId || 0) === id){
    targetGame.lastOwnPlayerOffer = null;
    removed += 1;
  }
  if(targetGame.seasonEndPlayerOffers && typeof targetGame.seasonEndPlayerOffers === 'object'){
    if(Array.isArray(targetGame.seasonEndPlayerOffers.offers)){
      const before = targetGame.seasonEndPlayerOffers.offers.length;
      targetGame.seasonEndPlayerOffers.offers = targetGame.seasonEndPlayerOffers.offers.filter(item => Number(item?.playerId || 0) !== id);
      removed += before - targetGame.seasonEndPlayerOffers.offers.length;
    }
  }
  if(targetGame.specialClauseOffers && typeof targetGame.specialClauseOffers === 'object'){
    if(Array.isArray(targetGame.specialClauseOffers.offers)){
      const before = targetGame.specialClauseOffers.offers.length;
      targetGame.specialClauseOffers.offers = targetGame.specialClauseOffers.offers.filter(item => Number(item?.playerId || 0) !== id);
      removed += before - targetGame.specialClauseOffers.offers.length;
    }
  }
  if(targetGame === game && typeof removePlayerFromCurrentTactic === 'function') removePlayerFromCurrentTactic(id);
  return { removed };
}
function normalizeRetiredPlayerPool(raw=[]){
  const source = Array.isArray(raw) ? raw : [];
  const clean = [];
  const seen = new Set();
  source.forEach(item => {
    if(!item || typeof item !== 'object') return;
    const previousPlayerId = Math.max(0, Math.round(Number(item.previousPlayerId || item.id || 0)));
    const name = String(item.name || '').trim();
    if(!previousPlayerId || !name || seen.has(previousPlayerId)) return;
    seen.add(previousPlayerId);
    clean.push({
      previousPlayerId,
      name,
      position:normalizePlayerPosition(item.position || 'MC', previousPlayerId),
      nationality:String(item.nationality || 'Argentina').trim() || 'Argentina',
      retiredAge:Math.max(0, Math.round(Number(item.retiredAge ?? item.age ?? 0))),
      retiredSeason:Math.max(1, Math.round(Number(item.retiredSeason || game?.seasonNumber || 1))),
      retiredClubId:Math.max(0, Math.round(Number(item.retiredClubId ?? item.clubId ?? 0))),
      manualIdentity:Boolean(item.manualIdentity ?? item.manualPlayer),
      timesRecycled:Math.max(0, Math.round(Number(item.timesRecycled || 0)))
    });
  });
  clean.sort((a,b)=>Number(a.retiredSeason || 0)-Number(b.retiredSeason || 0) || Number(a.previousPlayerId)-Number(b.previousPlayerId));
  return clean.slice(-2000);
}
function addRetiredPlayersToPool(players=[]){
  if(!game) return 0;
  const pool = normalizeRetiredPlayerPool(game.retiredPlayerPool || []);
  const byId = new Map(pool.map(item => [Number(item.previousPlayerId), item]));
  (players || []).forEach(player => {
    if(!player || !Number(player.id)) return;
    const previous = byId.get(Number(player.id));
    byId.set(Number(player.id), {
      previousPlayerId:Number(player.id),
      name:String(player.name || `Jugador ${player.id}`),
      position:normalizePlayerPosition(player.position || 'MC', player.id),
      nationality:String(player.nationality || 'Argentina'),
      retiredAge:Math.max(0, Math.round(Number(player.age || 0))),
      retiredSeason:Math.max(1, Math.round(Number(game.seasonNumber || 1))),
      retiredClubId:Math.max(0, Math.round(Number(player.clubId || 0))),
      manualIdentity:Boolean(player.manualPlayer || previous?.manualIdentity),
      timesRecycled:Math.max(0, Math.round(Number(player.retirementRecycles ?? previous?.timesRecycled ?? 0)))
    });
  });
  game.retiredPlayerPool = normalizeRetiredPlayerPool(Array.from(byId.values()));
  return game.retiredPlayerPool.length;
}
function takeRetiredPlayersAsFreeAgents(count=0, options={}){
  if(!game) return [];
  const requested = Math.max(0, Math.round(Number(count || 0)));
  if(!requested) return [];
  const activeIds = new Set((seed?.players || []).map(player => Number(player?.id || 0)).filter(Boolean));
  const pool = normalizeRetiredPlayerPool(game.retiredPlayerPool || []);
  const requestedGroup = String(options.positionGroup || '').toUpperCase();
  const available = pool.filter(item => !activeIds.has(Number(item.previousPlayerId)));
  const preferred = requestedGroup ? available.filter(item => playerRoleGroup(item.position) === requestedGroup) : available;
  const selected = preferred.slice(0, requested);
  const selectedIds = new Set(selected.map(item => Number(item.previousPlayerId)));
  const remaining = pool.filter(item => !selectedIds.has(Number(item.previousPlayerId)));
  if(!selected.length){ game.retiredPlayerPool = pool; return []; }
  const reservedMaxId = Math.max(0, ...pool.map(item => Number(item.previousPlayerId || 0)));
  game.retiredPlayerPool = remaining;
  const baseId = Math.max(nextPlayerId(), reservedMaxId + 1);
  const generationContext = options.generationContext || createPlayerGenerationContext((seed?.players || []).length + selected.length, seed?.players || []);
  const players = selected.map((entry,index) => {
    const id = baseId + index;
    const position = normalizePlayerPosition(entry.position || 'MC', id);
    const player = generatedPlayerFactory({
      id,
      position,
      clubId:0,
      age:18,
      prestige:Number(options.prestige ?? 50),
      nameContext:String(options.nameContext || 'Regreso generacional'),
      divisionName:String(options.divisionName || 'Mercado'),
      divisionOrder:Number.isFinite(Number(options.divisionOrder)) ? Number(options.divisionOrder) : null,
      generationContext,
      salaryFactor:Number(options.salaryFactor ?? MARKET_FREE_AGENT_SALARY_FACTOR),
      freeAgent:true,
      youthFreeAgent:Boolean(options.youthFreeAgent),
      mediaMin:entry.manualIdentity ? LEGEND_REGEN_MEDIA_MIN : (options.mediaMin ?? null),
      mediaMax:entry.manualIdentity ? LEGEND_REGEN_MEDIA_MAX : (options.mediaMax ?? null),
      nationalityOverride:entry.nationality
    });
    player.name = entry.name;
    player.nationality = entry.nationality;
    player.recycledRetiredPlayer = true;
    player.previousPlayerId = entry.previousPlayerId;
    player.previousRetirementAge = entry.retiredAge;
    player.previousRetirementSeason = entry.retiredSeason;
    player.retirementRecycles = Number(entry.timesRecycled || 0) + 1;
    player.manualIdentityRecycled = Boolean(entry.manualIdentity);
    if(entry.manualIdentity) player.legend = true;
    player.generation = {
      ...(player.generation || {}),
      source:'retired_player_pool',
      respawnedAfterRetirement:true,
      previousPlayerId:entry.previousPlayerId,
      previousRetirementSeason:entry.retiredSeason,
      recycleNumber:player.retirementRecycles
    };
    return player;
  });
  return players;
}
function retirementProbabilityForAge(age){
  const cleanAge = Math.round(Number(age || 0));
  if(cleanAge < RETIREMENT_MIN_AGE) return 0;
  if(cleanAge > RETIREMENT_MAX_AGE) return 1;
  return clamp(Number(RETIREMENT_PROBABILITY_BY_AGE?.[cleanAge] || 0), 0, 1);
}
function playerRetiresAtSeasonEnd(player, season=game?.seasonNumber || 1){
  if(!player || player.sold || player.retired || player.transferAgreed) return false;
  if(typeof hasActivePendingTransferForPlayer === 'function' && hasActivePendingTransferForPlayer(player.id)) return false;
  const age = Math.round(Number(player.age || 0));
  const probability = retirementProbabilityForAge(age);
  if(probability <= 0) return false;
  if(probability >= 1) return true;
  const roll = hashNumber(`retirement-${Math.max(1, Number(season || 1))}-${Number(player.id || 0)}-${age}`, 1000000) / 1000000;
  return roll < probability;
}
function retireSeasonVeterans(){
  if(!game || !seed?.players) return [];
  const managedClubId = Number(game.selectedClubId || 0);
  const retireePlayers = seed.players.filter(player => playerRetiresAtSeasonEnd(player, game.seasonNumber || 1));
  if(!retireePlayers.length) return [];
  retireePlayers.forEach(player => { player.retired = true; });
  if(typeof managerPortfolioSyncRights === 'function') managerPortfolioSyncRights({ closeMissing:false });
  const retirees = retireePlayers.map(player => ({
    ...player,
    freeAgent:Number(player.clubId || 0) === 0 || Boolean(player.freeAgent) || Boolean(player.youthFreeAgent),
    manualPlayer:Boolean(player.manualPlayer),
    manualRespawnAfterRetirement:Boolean(player.manualRespawnAfterRetirement)
  }));
  addRetiredPlayersToPool(retirees);
  const retiredIds = new Set(retirees.map(player => Number(player.id)));
  if(typeof purgeTransferHistoryForRetiredPlayers === 'function') purgeTransferHistoryForRetiredPlayers(Array.from(retiredIds), game);
  const manualRetiredIds = retirees
    .filter(player => player.manualPlayer)
    .map(player => Number(player.id))
    .filter(id => Number.isFinite(id) && id > 0);
  if(manualRetiredIds.length){
    game.manualRetiredPlayerIds = Array.from(new Set([...(Array.isArray(game.manualRetiredPlayerIds) ? game.manualRetiredPlayerIds : []), ...manualRetiredIds]));
  }
  seed.players = seed.players.filter(player => !retiredIds.has(Number(player.id)));
  game.marketPlayers = (game.marketPlayers || []).filter(player => !retiredIds.has(Number(player.id)));
  retirees.forEach(player => removePlayerReferencesFromState(player.id, game, { reason:'retirement' }));
  if(typeof invalidatePlayerIndexes === 'function') invalidatePlayerIndexes();
  const managedRetirees = retirees.filter(player => Number(player.clubId || 0) === managedClubId && !player.freeAgent);
  const botRetirees = retirees.filter(player => Number(player.clubId || 0) > 0 && Number(player.clubId || 0) !== managedClubId && !player.freeAgent);
  const freeRetirees = retirees.filter(player => player.freeAgent);
  if(managedRetirees.length){
    const names = managedRetirees.slice(0,5).map(player => `${player.name} (${player.age})`).join(', ');
    pushGameMessage({
      type:'plantel',
      priority:'normal',
      title:'Retiros al finalizar la temporada',
      body:`${managedRetirees.length === 1 ? 'Un jugador informó' : `${managedRetirees.length} jugadores informaron`} su retiro del fútbol: ${names}${managedRetirees.length > 5 ? '...' : ''}`
    });
  }
  if(botRetirees.length){
    pushGameMessage({
      type:'mercado',
      priority:'normal',
      title:'Retiros en otros clubes',
      body:`${botRetirees.length} jugadores de clubes controlados por bots se retiraron al finalizar la temporada.`
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
  return retirees.map(player => ({
    id:player.id,
    name:player.name,
    age:player.age,
    position:player.position,
    clubId:Number(player.clubId || 0),
    salary:player.salary || 0,
    freeAgent:Boolean(player.freeAgent),
    botPlayer:Number(player.clubId || 0) > 0 && Number(player.clubId || 0) !== managedClubId,
    retirementProbability:retirementProbabilityForAge(player.age),
    manualPlayer:Boolean(player.manualPlayer),
    queuedForFreeAgentReturn:true
  }));
}

function nextPlayerId(){
  const ids = [0]
    .concat((seed?.players || []).map(p => Number(p.id) || 0))
    .concat((game?.marketPlayers || []).map(p => Number(p.id) || 0))
    .concat((game?.retiredPlayerPool || []).map(p => Number(p.previousPlayerId || p.id) || 0));
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
  removed.forEach(player => removePlayerReferencesFromState(player.id, game, { reason:'free_agent_prune' }));
  if(removed.length && typeof invalidatePlayerIndexes === 'function') invalidatePlayerIndexes();
  return removed;
}

function freeAgentPrunePriority(player){
  const media = typeof visibleOverall === 'function' ? visibleOverall(player) : Number(player.overall || player.media || 50);
  const age = Number(player.age || 0);
  let score = 0;
  if(player.youthFreeAgent) score += 900;
  if(player.founderReleased) score += 250;
  score += Math.max(0, age - 27) * 18;
  score += Math.max(0, 60 - media) * 4;
  score += Number(player.id || 0) / 1000000;
  return score;
}
function pruneFreeAgentMarketArrayToHardMax(players=[], maxCount=MARKET_FREE_AGENT_HARD_MAX){
  const safeMax = Math.max(0, Math.min(300, Math.round(Number(maxCount) || 0)));
  if(!Array.isArray(players) || safeMax <= 0) return [];
  const free = players.filter(player => player && Number(player.clubId || 0) === 0 && !player.sold && !player.retired);
  const excess = free.length - safeMax;
  if(excess <= 0) return players;
  const remove = new Set(free.slice().sort((a,b) => freeAgentPrunePriority(b) - freeAgentPrunePriority(a)).slice(0, excess).map(player => Number(player.id)));
  return players.filter(player => !remove.has(Number(player.id)));
}
function syncSeedFreeAgentCleanup(activeMarketPlayers=[]){
  if(!seed?.players || !Array.isArray(activeMarketPlayers)) return;
  const activeMarketIds = new Set(activeMarketPlayers.map(player => Number(player.id)));
  seed.players = seed.players.filter(player => {
    if(!player || Number(player.clubId || 0) !== 0 || !player.freeAgent) return true;
    return activeMarketIds.has(Number(player.id));
  });
}
function pruneFreeAgentMarketToMax(maxCount=SEASON_FREE_AGENT_MARKET_MAX){
  if(!game || !SEASON_FREE_AGENT_CLEANUP_ENABLED || !Number.isFinite(Number(maxCount)) || Number(maxCount) <= 0) return [];
  const safeMax = Math.max(0, Math.min(300, Math.round(Number(maxCount) || 0)));
  const freePlayers = currentFreeMarketPlayers();
  const excess = freePlayers.length - safeMax;
  if(excess <= 0) return [];
  const candidates = freePlayers.slice().sort((a,b) => freeAgentPrunePriority(b) - freeAgentPrunePriority(a));
  return removeFreeMarketPlayersById(candidates.slice(0, excess).map(player => player.id));
}
function initializeFreePlayerState(players=[]){
  if(!game) return;
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  game.playerAgeSkillPenalties = (game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties)) ? game.playerAgeSkillPenalties : {};
  game.trainingPlan = game.trainingPlan || {};
  game.playerStats = game.playerStats || {};
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  players.forEach(p => {
    game.playerCondition[p.id] = 5;
    game.playerMorale[p.id] = 5;
    delete game.playerAgeSkillPenalties[p.id];
    game.trainingPlan[p.id] = safeIndividualTrainingType(game.trainingPlan[p.id]);
    game.playerStats[p.id] = game.playerStats[p.id] || createEmptyPlayerStat(p);
    normalizePlayerStatRecord(game.playerStats[p.id], p);
    if(game.playerCareerStats[p.id]) normalizePlayerStatRecord(game.playerCareerStats[p.id], p);
  });
}
function generateSeasonYouthFreeAgents(count=SEASON_YOUTH_FREE_AGENT_COUNT){
  const totalCount = Math.max(0, Math.round(Number(count) || 0));
  const activePlayers = (seed?.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
  const generationContext = createPlayerGenerationContext(activePlayers.length + totalCount, activePlayers);
  const season = Number(game?.seasonNumber || 1);
  const players = takeRetiredPlayersAsFreeAgents(totalCount, {
    generationContext,
    prestige:50,
    nameContext:`Juveniles libres ${season}`,
    divisionName:'Juveniles libres',
    salaryFactor:FREE_YOUTH_SALARY_FACTOR,
    youthFreeAgent:true
  });
  let id = Math.max(nextPlayerId(), ...players.map(player => Number(player.id || 0) + 1), 1);
  for(let i=players.length;i<totalCount;i++, id++){
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
      youthFreeAgent:true,
      nationalityOverride:freeAgentNationalityForIndex(i, `season-youth-${season}`),
      localCountry:club ? clubCountry(club) : null
    });
    player.originClubId = club?.id || 0;
    players.push(player);
  }
  return players;
}

function generateSeasonYouthFreeAgentsByClub(perClub=SEASON_YOUTH_FREE_AGENTS_PER_CLUB){
  const clubs = (seed?.clubs || []).filter(club => Number(club.id || 0) > 0);
  const available = Math.max(0, MARKET_FREE_AGENT_HARD_MAX - currentFreeMarketPlayers().length);
  const total = Math.min(available, Math.max(0, Math.round(Number(perClub || 0))) * clubs.length);
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
  const target = Math.min(MARKET_FREE_AGENT_HARD_MAX, Math.round(Number(maxCount)));
  const needed = Math.max(0, target - currentFreeMarketPlayers().length);
  if(needed <= 0) return [];
  const newPlayers = generateMarketPlayers(needed, { startId:nextPlayerId(), label:`season-market-${game.seasonNumber || 1}`, nameContext:'Mercado Libre' });
  game.marketPlayers = (game.marketPlayers || []).concat(newPlayers);
  mergeMarketPlayersIntoSeed(newPlayers);
  initializeFreePlayerState(newPlayers);
  return newPlayers;
}
function renewFreeAgentMarketForSeason(retiredCount=0){
  if(!game) return { removed:[], youth:[], regular:[] };
  pruneFreeAgentMarketToMax(MARKET_FREE_AGENT_HARD_MAX);
  const youth = generateSeasonYouthFreeAgentsByClub(SEASON_YOUTH_FREE_AGENTS_PER_CLUB);
  game.marketPlayers = (game.marketPlayers || []).concat(youth);
  mergeMarketPlayersIntoSeed(youth);
  initializeFreePlayerState(youth);
  pruneFreeAgentMarketToMax(MARKET_FREE_AGENT_HARD_MAX);
  const regular = topUpSeasonFreeAgentsToMax(SEASON_FREE_AGENT_MARKET_MAX);
  const finalPruned = pruneFreeAgentMarketToMax(MARKET_FREE_AGENT_HARD_MAX);
  const legacyExtra = retiredCount > 0 && SEASON_YOUTH_FREE_AGENT_COUNT > 0 ? addSeasonYouthFreeAgents(Math.max(SEASON_YOUTH_FREE_AGENT_COUNT, retiredCount)) : [];
  if(legacyExtra.length) pruneFreeAgentMarketToMax(MARKET_FREE_AGENT_HARD_MAX);
  const totalYouth = youth.length + legacyExtra.length;
  const totalRegular = regular.length;
  if(totalYouth || totalRegular || finalPruned.length){
    const returned = youth.concat(legacyExtra, regular).filter(player => player?.recycledRetiredPlayer).length;
    pushGameMessage({
      type:'mercado',
      title:'Mercado libre renovado',
      body:`Se incorporaron ${totalYouth} jóvenes y ${totalRegular} jugadores libres al mercado.${returned ? ` ${returned} futbolista(s) retirado(s) regresaron con 18 años.` : ''}`,
      priority:'normal'
    });
  }
  return { removed:finalPruned, youth:youth.concat(legacyExtra), regular };
}
function clubReputationSeasonConfig(){
  const cfg = configValue('clubes.reputacionTemporada', {}) || {};
  const position = cfg.posicion || {};
  return {
    floors: cfg.minimoPorDivisionOrden || { 1:40, 2:25, 3:10 },
    position: {
      champion: Math.round(Number(position.campeon ?? 2)),
      high: Math.round(Number(position.zonaAlta ?? 1)),
      middle: Math.round(Number(position.zonaMedia ?? 0)),
      low: Math.round(Number(position.zonaBaja ?? -1)),
      bottom: Math.round(Number(position.zonaFondo ?? -2)),
      highUntil: Number(position.zonaAltaHasta ?? 0.25),
      middleUntil: Number(position.zonaMediaHasta ?? 0.60),
      lowUntil: Number(position.zonaBajaHasta ?? 0.85)
    },
    championBonus: cfg.bonusCampeonPorDivisionOrden || { 1:4, 2:3, 3:2 },
    promotionBonus: cfg.bonusAscensoPorDivisionOrigenOrden || { 2:4, 3:5 },
    relegationPenalty: cfg.penalizacionDescensoPorDivisionOrigenOrden || { 1:-3, 2:-2 }
  };
}
function clubReputationDivisionOrder(division){
  return Math.max(1, Math.round(Number(division?.order || divisionOrderFromName(division?.name) || 1)));
}
function clubReputationConfigValue(map, order, fallback=0){
  if(!map || typeof map !== 'object') return Math.round(Number(fallback || 0));
  const value = map[order] ?? map[String(order)] ?? fallback;
  return Math.round(Number(value || 0));
}
function clubReputationMinimumForDivision(division){
  const cfg = clubReputationSeasonConfig();
  const order = clubReputationDivisionOrder(division);
  return clamp(clubReputationConfigValue(cfg.floors, order, order === 1 ? 40 : order === 2 ? 25 : 10), 1, 99);
}
function clubSeasonPrestigeDeltaByPosition(position, totalTeams){
  const cfg = clubReputationSeasonConfig().position;
  const pos = Math.max(1, Math.round(Number(position || 0)));
  const total = Math.max(pos, Math.round(Number(totalTeams || 0)) || pos);
  if(pos === 1) return cfg.champion;
  const ratio = pos / total;
  if(ratio <= cfg.highUntil) return cfg.high;
  if(ratio <= cfg.middleUntil) return cfg.middle;
  if(ratio <= cfg.lowUntil) return cfg.low;
  return cfg.bottom;
}
function clubReputationSeasonMovementForClub(movements, clubId, type){
  return (Array.isArray(movements) ? movements : []).find(move => Number(move?.clubId) === Number(clubId) && move.type === type) || null;
}
function applyClubReputationFloor(oldValue, delta, floor){
  let adjusted = Math.round(Number(delta || 0));
  if(adjusted < 0){
    if(Number(oldValue || 0) <= Number(floor || 1)) return 0;
    adjusted = Math.max(adjusted, Math.round(Number(floor || 1)) - Math.round(Number(oldValue || 0)));
  }
  return adjusted;
}
function updateClubPrestigeAfterSeason(movements=[]){
  if(!game || !seed?.clubs) return [];
  const cfg = clubReputationSeasonConfig();
  const changes = [];
  divisionOrderList().forEach(division => {
    const order = clubReputationDivisionOrder(division);
    const table = sortedStandings(division.id);
    const totalTeams = table.length || 0;
    const floor = clubReputationMinimumForDivision(division);
    table.forEach((row, index) => {
      const club = seed.clubs.find(c => Number(c.id) === Number(row.clubId));
      if(!club || club.specialCompetitionOnly || club.competitionOnly) return;
      const position = index + 1;
      const champion = position === 1;
      const promoted = clubReputationSeasonMovementForClub(movements, club.id, 'promotion');
      const relegated = clubReputationSeasonMovementForClub(movements, club.id, 'relegation');
      const positionDelta = clubSeasonPrestigeDeltaByPosition(position, totalTeams);
      const championDelta = champion ? clubReputationConfigValue(cfg.championBonus, order, order === 1 ? 4 : order === 2 ? 3 : 2) : 0;
      const promotionDelta = promoted ? clubReputationConfigValue(cfg.promotionBonus, order, order === 2 ? 4 : order === 3 ? 5 : 0) : 0;
      const relegationDelta = relegated ? clubReputationConfigValue(cfg.relegationPenalty, order, order === 1 ? -3 : order === 2 ? -2 : 0) : 0;
      const rawDelta = positionDelta + championDelta + promotionDelta + relegationDelta;
      const oldValue = clubPrestigeValue(club);
      const delta = applyClubReputationFloor(oldValue, rawDelta, floor);
      if(delta === 0) return;
      const next = clamp(oldValue + delta, 1, 99);
      club.reputation = next;
      club.managerPrestige = next;
      changes.push({
        clubId:club.id,
        clubName:club.name,
        divisionId:division.id,
        divisionName:division.name,
        divisionOrder:order,
        position,
        oldValue,
        next,
        delta:next-oldValue,
        floor,
        champion,
        promoted:Boolean(promoted),
        relegated:Boolean(relegated),
        details:{ positionDelta, championDelta, promotionDelta, relegationDelta, rawDelta }
      });
    });
  });
  game.clubReputationHistory = Array.isArray(game.clubReputationHistory) ? game.clubReputationHistory : [];
  if(changes.length){
    game.clubReputationHistory.push({ season:game.seasonNumber || 1, date:game.currentDate || '', changes });
  }
  return changes;
}

function managerSeasonPrizeConfig(){
  const cfg = window.GAME_BALANCE_MANAGER?.premiosTemporada || {};
  return {
    activo: cfg.activo !== false,
    evitarDuplicados: cfg.evitarDuplicados !== false,
    conceptoCampeon: cfg.conceptoCampeon || 'Premio por campeonato',
    conceptoAscenso: cfg.conceptoAscenso || 'Premio por ascenso',
    campeonatoPorDivisionOrden: cfg.campeonatoPorDivisionOrden || {},
    ascensoPorDivisionOrigenOrden: cfg.ascensoPorDivisionOrigenOrden || {},
    valoresFallback: cfg.valoresFallback || { campeonato:750000000, ascenso:500000000 },
    acumularCampeonatoYAscenso: cfg.acumularCampeonatoYAscenso !== false
  };
}
function seasonPrizeDivisionOrder(division){
  return Math.max(1, Math.round(Number(division?.order || divisionOrderFromName(division?.name) || 1)));
}
function seasonChampionPrizeAmount(division){
  const cfg = managerSeasonPrizeConfig();
  if(!cfg.activo) return 0;
  const order = seasonPrizeDivisionOrder(division);
  const direct = Number(cfg.campeonatoPorDivisionOrden?.[order]);
  if(Number.isFinite(direct) && direct > 0) return Math.round(direct);
  return Math.max(0, Math.round(Number(cfg.valoresFallback?.campeonato || 0)));
}
function seasonPromotionPrizeAmount(division){
  const cfg = managerSeasonPrizeConfig();
  if(!cfg.activo) return 0;
  const order = seasonPrizeDivisionOrder(division);
  const direct = Number(cfg.ascensoPorDivisionOrigenOrden?.[order]);
  if(Number.isFinite(direct) && direct > 0) return Math.round(direct);
  return Math.max(0, Math.round(Number(cfg.valoresFallback?.ascenso || 0)));
}
function applyManagerSeasonPrize(delta, concept, meta={}){
  if(!game) return 0;
  const amount = Math.max(0, Math.round(Number(delta || 0)));
  if(amount <= 0) return 0;
  if(typeof recordBudgetChange === 'function'){
    recordBudgetChange(amount, concept, { type:'season_prize', category:'Premios temporada', ...meta });
  } else {
    game.budgetHistory = Array.isArray(game.budgetHistory) ? game.budgetHistory : [];
    game.budget = Math.round(Number(game.budget || 0) + amount);
    game.lastBudgetDelta = amount;
    game.budgetHistory.push({
      season:game.seasonNumber || 1,
      matchdayIndex:game.matchdayIndex || 0,
      date:game.currentDate || '',
      concept,
      delta:amount,
      budget:game.budget,
      type:'season_prize',
      category:'Premios temporada',
      ...meta
    });
  }
  game.clubBudgets = (game.clubBudgets && typeof game.clubBudgets === 'object' && !Array.isArray(game.clubBudgets)) ? game.clubBudgets : {};
  if(Number.isFinite(Number(game.selectedClubId))) game.clubBudgets[game.selectedClubId] = Math.round(Number(game.budget || 0));
  return amount;
}
function awardManagerSeasonPrizes(record){
  if(!game || !record) return { total:0, champion:0, promotion:0, applied:false };
  const cfg = managerSeasonPrizeConfig();
  if(!cfg.activo) return { total:0, champion:0, promotion:0, applied:false };
  const key = `${record.season || game.seasonNumber || 1}-${record.clubId || game.selectedClubId}`;
  game.seasonPrizeAwards = (game.seasonPrizeAwards && typeof game.seasonPrizeAwards === 'object' && !Array.isArray(game.seasonPrizeAwards)) ? game.seasonPrizeAwards : {};
  if(cfg.evitarDuplicados && game.seasonPrizeAwards[key]) return { ...game.seasonPrizeAwards[key], applied:false, duplicate:true };
  const championPrize = Math.max(0, Math.round(Number(record.championPrize || 0)));
  const promotionPrize = Math.max(0, Math.round(Number(record.promotionPrize || 0)));
  const total = championPrize + promotionPrize;
  if(total <= 0){
    game.seasonPrizeAwards[key] = { total:0, champion:0, promotion:0, season:record.season, clubId:record.clubId };
    return { total:0, champion:0, promotion:0, applied:false };
  }
  if(championPrize > 0){
    applyManagerSeasonPrize(championPrize, `${cfg.conceptoCampeon}: ${record.divisionName || 'liga'}`, { prizeType:'champion', divisionId:record.divisionId, divisionName:record.divisionName });
  }
  if(promotionPrize > 0){
    applyManagerSeasonPrize(promotionPrize, `${cfg.conceptoAscenso}: ${record.divisionName || 'liga'}`, { prizeType:'promotion', divisionId:record.divisionId, divisionName:record.divisionName });
  }
  const summary = { total, champion:championPrize, promotion:promotionPrize, season:record.season, clubId:record.clubId, applied:true };
  game.seasonPrizeAwards[key] = summary;
  const parts = [];
  if(championPrize > 0) parts.push(`campeonato ${formatMoney(championPrize)}`);
  if(promotionPrize > 0) parts.push(`ascenso ${formatMoney(promotionPrize)}`);
  pushGameMessage({
    type:'finanzas',
    priority:'high',
    title:'Premios deportivos acreditados',
    body:`La federación acreditó ${formatMoney(total)} por ${parts.join(' + ')}.`,
    id:`season-prizes-${key}`
  });
  return summary;
}

function finalizeSeasonIfNeeded(options={}){
  if(!game || game.seasonFinalized || game.matchdayIndex < game.fixtures.length) return;
  const managerAbsent = Boolean(options?.managerAbsent || game?.gameOver?.active);
  repairCrossCountryClubAssignments({ restoreNativeIfNeeded:false });
  game.clubDivisionOverrides = snapshotClubDivisionOverrides();
  game.managerStats = normalizeManagerStats(game.managerStats);
  const movementsPreview = computeSeasonMovements();
  let record = null;
  if(!managerAbsent){
    const division = clubDivision(game.selectedClubId);
    const table = sortedStandings(division.id);
    const index = table.findIndex(row => row.clubId === game.selectedClubId);
    const row = table[index] || game.standings[game.selectedClubId] || {};
    const position = index >= 0 ? index + 1 : null;
    const champion = position === 1;
    const promoted = movementsPreview.some(move => move.type === 'promotion' && Number(move.clubId) === Number(game.selectedClubId));
    const totalTeams = table.length || 0;
    const wasRelegated = Boolean(movementsPreview.some(move => move.type === 'relegation' && Number(move.clubId) === Number(game.selectedClubId)));
    const finishedLast = Boolean(position && totalTeams && position === totalTeams);
    const prizeConfig = managerSeasonPrizeConfig();
    record = {
      season:game.seasonNumber || 1,
      clubId:game.selectedClubId,
      clubName:clubName(game.selectedClubId),
      divisionId:division.id,
      divisionName:division.name,
      divisionOrder:division.order || divisionOrderFromName(division.name),
      position,
      label:champion ? 'Campeón' : (position ? `${position}°` : '—'),
      pts:row.pts || 0,
      pg:row.pg || 0,
      pe:row.pe || 0,
      pp:row.pp || 0,
      gf:row.gf || 0,
      gc:row.gc || 0,
      title:champion,
      promoted,
      championPrize: champion ? seasonChampionPrizeAmount(division) : 0,
      promotionPrize: promoted && (!champion || prizeConfig.acumularCampeonatoYAscenso) ? seasonPromotionPrizeAmount(division) : 0,
      managerPrestigeChampionReward: 0,
      managerPrestigeBadSeasonPenalty: 0
    };
    record.totalSeasonPrize = Math.max(0, Math.round(Number(record.championPrize || 0) + Number(record.promotionPrize || 0)));
    if(!game.managerStats.seasons.some(s => s.season === record.season)){
      const objective = Number.isFinite(Number(game.managerStats.currentSeason?.objectivePpg)) ? Number(game.managerStats.currentSeason.objectivePpg) : managerObjectiveForClubDivision(game.selectedClubId);
      const seasonPpg = ppgFromTotals(game.managerStats.currentSeason || record);
      const objectiveDelta = Number.isFinite(Number(objective)) ? managerObjectiveResultDelta(seasonPpg, objective) : 0;
      const objectiveReward = !currentGameIsFounderMode() && Number.isFinite(Number(objective)) ? managerObjectivePrestigeRewardForDelta(objectiveDelta) : { points:0, label:'Sin objetivo' };
      record.objectivePpg = objective;
      record.objectiveAchieved = !currentGameIsFounderMode() && Number.isFinite(Number(objective)) && seasonPpg >= Number(objective);
      record.objectiveDelta = objectiveDelta;
      record.objectiveExpectation = game.managerStats.currentSeason?.objectiveExpectation || '';
      record.objectiveLabel = game.managerStats.currentSeason?.objectiveLabel || '';
      record.objectiveSource = game.managerStats.currentSeason?.objectiveSource || '';
      record.objectiveFixed = Boolean(game.managerStats.currentSeason?.objectiveFixed);
      record.objectivePrestigeRelative = game.managerStats.currentSeason?.objectivePrestigeRelative;
      record.managerPrestigeObjectiveReward = 0;
      record.objectivePrestigeLabel = objectiveReward.label;
      record.ppg = seasonPpg;
      game.managerStats.seasons.push(record);
      if(champion) recordManagerOfficialTitleForState(game, { season:record.season, year:game.seasonYear, type:'league', competitionId:division.id, competitionName:division.name, clubId:game.selectedClubId, clubName:clubName(game.selectedClubId) });
      game.managerStats = normalizeManagerStats(game.managerStats);
      if(typeof checkManagerAchievements === 'function') checkManagerAchievements({ silent:false });
    }
    if(champion){
      pushGameMessage({ type:'deportivo', priority:'high', title:'Has salido campeón', body:`Felicitaciones: ${clubName(game.selectedClubId)} salió campeón de ${division.name}. El logro será considerado en la evaluación integral de la temporada.`, id:`champion-${game.seasonNumber || 1}-${game.selectedClubId}` });
      if(typeof awardSpecialChampionPoints === 'function') awardSpecialChampionPoints(division);
    }
    if(typeof finalizeActiveManagerChallenge === 'function') finalizeActiveManagerChallenge(record);
  }
  const seasonPrizeAwards = record ? awardManagerSeasonPrizes(record) : null;
  recordLeagueChampionsForCurrentSeason();
  snapshotStandingsHistoryForCurrentSeason();
  if(typeof syncClubFifaRankingMatchRecords === 'function') syncClubFifaRankingMatchRecords();
  if(typeof snapshotClubFifaRankingForCurrentSeason === 'function') snapshotClubFifaRankingForCurrentSeason({ force:true });
  const prestigeChanges = updateClubPrestigeAfterSeason(movementsPreview);
  const movements = movementsPreview;
  if(record && currentGameIsFounderMode() && record.promoted){
    ensureFounderGoalsState();
    game.founderGoals.promotions = Math.max(0, Math.round(Number(game.founderGoals.promotions || 0))) + 1;
  }
  if(record && typeof queueNextSeasonTransferBudgetUnlock === 'function'){
    if(record.promoted) queueNextSeasonTransferBudgetUnlock('promotion', transferBudgetConfig().unlockPromotion, 'Ascenso');
    if(record.title) queueNextSeasonTransferBudgetUnlock('champion', transferBudgetConfig().unlockChampion, 'Campeón');
  }
  const salariesPaid = managerAbsent ? 0 : paySeasonSalaries();
  const salaryAdjustments = applySeasonSalaryAdjustments();
  const retirements = retireSeasonVeterans();
  const trainingDecay = decayTrainedSkillBoosts();
  game.seasonTransition = {
    season:game.seasonNumber || 1,
    userRecord:record,
    movements,
    salariesPaid,
    salaryAdjustments,
    retirements,
    trainingDecay,
    prestigeChanges,
    seasonPrizeAwards,
    managerAbsent,
    forcedByFounder:Boolean(options?.forcedByFounder),
    agingApplied:true
  };
  game.seasonFinalized = true;
  game.seasonPhase = 'finalized';
  game.seasonEndModalShown = managerAbsent;
  if(!managerAbsent) queueAutomaticRankingSubmission('season_end');
}
function applySeasonMovements(){
  const movements = game?.seasonTransition?.movements || [];
  const divisions = divisionOrderList();
  const byId = Object.fromEntries(divisions.map(d => [d.id, d]));
  movements.forEach(move => {
    const club = seed.clubs.find(c => Number(c.id) === Number(move.clubId));
    const from = byId[move.fromDivisionId];
    const target = byId[move.toDivisionId];
    if(!club || !target) return;
    const clubCountry = clubCountryKeyForIntegrity(club);
    const targetCountry = divisionCountryKey(target);
    const fromCountry = from ? divisionCountryKey(from) : clubCountry;
    if(clubCountry && targetCountry && clubCountry !== targetCountry) return;
    if(from && fromCountry && targetCountry && fromCountry !== targetCountry) return;
    setClubIntegrityDivision(club, target);
  });
  repairCrossCountryClubAssignments({ restoreNativeIfNeeded:false });
  game.clubDivisionOverrides = snapshotClubDivisionOverrides();
}

function statusObjectIsEmpty(status){
  return !status || Object.keys(status).length === 0;
}
function removeInjuryFieldsFromStatus(status){
  const clean = { ...(status || {}) };
  delete clean.injuredThrough;
  delete clean.injuredUntilTurn;
  delete clean.injuryLabel;
  delete clean.injuryChance;
  delete clean.injuredAtMatchday;
  delete clean.injuredAtTurn;
  delete clean.carriedFromPreviousSeason;
  delete clean.carriedFromSeason;
  delete clean.rebasedForSeason;
  return clean;
}
function removeSuspensionFieldsFromStatus(status){
  const clean = { ...(status || {}) };
  delete clean.suspendedThrough;
  delete clean.suspensionLabel;
  delete clean.suspensionType;
  return clean;
}
function rebaseAvailabilityStatusesForSeasonStart(statuses={}, previousMatchdayIndex=0, injuryRecoveryTurns=0, meta={}){
  const safePreviousIndex = Math.max(0, Math.round(Number(previousMatchdayIndex) || 0));
  const safeRecovery = Math.max(0, Math.round(Number(injuryRecoveryTurns) || 0));
  const nextStatuses = {};
  const summary = {
    changed:false,
    injuriesCleared:0,
    injuriesCarried:0,
    suspensionsCleared:0,
    suspensionsCarried:0
  };
  Object.entries(statuses || {}).forEach(([playerId, rawStatus]) => {
    let status = { ...(rawStatus || {}) };
    const injuryThrough = Number(status.injuredThrough);
    if(Number.isFinite(injuryThrough)){
      const remainingTurns = Math.max(0, Math.round(injuryThrough) - safePreviousIndex + 1);
      const remainingAfterRecovery = Math.max(0, remainingTurns - safeRecovery);
      summary.changed = true;
      if(remainingAfterRecovery <= 0){
        status = removeInjuryFieldsFromStatus(status);
        summary.injuriesCleared += 1;
      } else {
        status.injuredThrough = remainingAfterRecovery - 1;
        status.injuredAtMatchday = 0;
        status.carriedFromPreviousSeason = true;
        status.carriedFromSeason = meta.previousSeason || status.carriedFromSeason || null;
        status.rebasedForSeason = meta.nextSeason || null;
        summary.injuriesCarried += 1;
      }
    }
    const suspendedThrough = Number(status.suspendedThrough);
    if(Number.isFinite(suspendedThrough)){
      const remainingSuspension = Math.max(0, Math.round(suspendedThrough) - safePreviousIndex + 1);
      summary.changed = true;
      if(remainingSuspension <= 0){
        status = removeSuspensionFieldsFromStatus(status);
        summary.suspensionsCleared += 1;
      } else {
        status.suspendedThrough = remainingSuspension - 1;
        summary.suspensionsCarried += 1;
      }
    }
    if(!statusObjectIsEmpty(status)) nextStatuses[playerId] = status;
  });
  return { statuses:nextStatuses, summary };
}
function reduceInjuryDurationsByTurns(turns=1){
  if(!game?.playerStatus) return { changed:false, cleared:0, reduced:0 };
  const amount = Math.max(0, Math.round(Number(turns) || 0));
  if(amount <= 0) return { changed:false, cleared:0, reduced:0 };
  const result = { changed:false, cleared:0, reduced:0 };
  Object.entries(game.playerStatus || {}).forEach(([playerId, rawStatus]) => {
    let status = { ...(rawStatus || {}) };
    const injuryThrough = Number(status.injuredThrough);
    if(!Number.isFinite(injuryThrough)) return;
    const nextThrough = Math.round(injuryThrough) - amount;
    result.changed = true;
    if(nextThrough < Number(game.matchdayIndex || 0)){
      const numericPlayerId = Number(playerId);
      const player = typeof playerById === 'function' ? playerById(numericPlayerId) : null;
      const injuryLabel = String(status.injuryLabel || 'su lesión');
      const recoveryKey = `first:${numericPlayerId}:${Number(status.injuredAtTurn || status.injuredAtMatchday || injuryThrough || 0)}:${injuryLabel}`;
      status = removeInjuryFieldsFromStatus(status);
      result.cleared += 1;
      if(typeof pushFullyRecoveredInjuryMessage === 'function') pushFullyRecoveredInjuryMessage({
        kind:'first',
        playerId:numericPlayerId,
        playerName:player?.name || 'Jugador',
        injuryLabel,
        recoveryKey,
        source:'compact_phase_recovery'
      });
    } else {
      status.injuredThrough = nextThrough;
      result.reduced += 1;
    }
    if(statusObjectIsEmpty(status)) delete game.playerStatus[playerId];
    else game.playerStatus[playerId] = status;
  });
  return result;
}
function registerInjuryRecoveryTurn(phase='recovery'){
  if(!game) return;
  game.injuryRecoveryTurnsBySeason = game.injuryRecoveryTurnsBySeason || {};
  const key = `${game.seasonNumber || 1}:${phase}`;
  game.injuryRecoveryTurnsBySeason[key] = Math.max(0, Math.round(Number(game.injuryRecoveryTurnsBySeason[key] || 0))) + 1;
}
function injuryRecoveryTurnsRegistered(seasonNumber=game?.seasonNumber || 1, phase='postseason'){
  const key = `${seasonNumber || 1}:${phase}`;
  return Math.max(0, Math.round(Number(game?.injuryRecoveryTurnsBySeason?.[key] || 0)));
}
function applySeasonStartAvailabilityRebase(previousMatchdayIndex, extraInjuryRecoveryTurns=0){
  if(!game) return { changed:false };
  game.playerStatus = game.playerStatus || {};
  const nextSeason = (game.seasonNumber || 1) + 1;
  const rebaseKey = `season-${nextSeason}`;
  game.statusRebases = game.statusRebases || {};
  if(game.statusRebases[rebaseKey]) return { changed:false, skipped:true };
  const result = rebaseAvailabilityStatusesForSeasonStart(game.playerStatus, previousMatchdayIndex, extraInjuryRecoveryTurns, { previousSeason:game.seasonNumber || 1, nextSeason });
  game.playerStatus = result.statuses;
  game.statusRebases[rebaseKey] = {
    previousSeason:game.seasonNumber || 1,
    nextSeason,
    previousMatchdayIndex:Math.max(0, Math.round(Number(previousMatchdayIndex) || 0)),
    extraInjuryRecoveryTurns:Math.max(0, Math.round(Number(extraInjuryRecoveryTurns) || 0)),
    ...result.summary
  };
  if(result.summary.changed){
    const cleared = result.summary.injuriesCleared;
    const carried = result.summary.injuriesCarried;
    pushGameMessage({
      type:'medico',
      priority:'normal',
      title:'Parte médico de inicio de temporada',
      body:`Se recalcularon las lesiones pendientes al cambiar de temporada. Recuperados: ${cleared}. Siguen en recuperación: ${carried}.`
    });
  }
  return { changed:result.summary.changed, ...result.summary };
}
function repairLegacySeasonStartAvailability(normalized){
  if(!normalized || normalized.seasonPhase !== 'preseason' || Number(normalized.matchdayIndex || 0) !== 0) return normalized;
  normalized.statusRebases = normalized.statusRebases || {};
  const key = `legacy-season-start-${normalized.seasonNumber || 1}`;
  if(normalized.statusRebases[key]) return normalized;
  const statuses = normalized.playerStatus || {};
  const hasLegacyCarry = Object.values(statuses).some(status => {
    const injuredThrough = Number(status?.injuredThrough);
    const injuredAt = Number(status?.injuredAtMatchday);
    const suspendedThrough = Number(status?.suspendedThrough);
    return (Number.isFinite(injuredThrough) && Number.isFinite(injuredAt) && injuredAt > 0 && injuredThrough > 0)
      || (Number.isFinite(suspendedThrough) && suspendedThrough > 5);
  });
  if(!hasLegacyCarry) return normalized;
  const previousFixtureCount = Math.max(0, Array.isArray(normalized.fixtures) ? normalized.fixtures.length : currentSeasonFixtureCount());
  const previousSeason = Math.max(1, Math.round(Number(normalized.seasonNumber || 1)) - 1);
  const postseasonRecovery = postseasonTurnsForSeason(previousSeason, previousFixtureCount);
  const result = rebaseAvailabilityStatusesForSeasonStart(statuses, previousFixtureCount, postseasonRecovery, { previousSeason, nextSeason:normalized.seasonNumber || 1 });
  normalized.playerStatus = result.statuses;
  normalized.statusRebases[key] = {
    previousSeason,
    nextSeason:normalized.seasonNumber || 1,
    previousMatchdayIndex:previousFixtureCount,
    extraInjuryRecoveryTurns:postseasonRecovery,
    legacyRepair:true,
    ...result.summary
  };
  if(result.summary.changed){
    normalized._needsAutosave = true;
    normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
    normalized.messages.unshift({
      id:`legacy-medical-repair-${normalized.seasonNumber || 1}-${Date.now()}`,
      turn:0,
      season:normalized.seasonNumber || 1,
      date:normalized.currentDate || '',
      read:false,
      priority:'normal',
      type:'medico',
      title:'Parte médico corregido',
      body:`Se corrigió el arrastre de lesiones al inicio de temporada. Recuperados: ${result.summary.injuriesCleared}. Siguen en recuperación: ${result.summary.injuriesCarried}.`,
      action:null,
      createdAt:Date.now()
    });
  }
  return normalized;
}


function botBalanceDifficultyProfile(){
  if(BOT_BALANCE_DIFFICULTY === 'dificil' || BOT_BALANCE_DIFFICULTY === 'difícil') return { morale:4, condition:3, cohesion:5, development:1.35, label:'difícil' };
  if(BOT_BALANCE_DIFFICULTY === 'suave' || BOT_BALANCE_DIFFICULTY === 'facil' || BOT_BALANCE_DIFFICULTY === 'fácil') return { morale:-4, condition:-3, cohesion:-6, development:0.75, label:'suave' };
  return { morale:0, condition:0, cohesion:0, development:1, label:'normal' };
}
function botBalanceRandomOffset(seedValue, spread){
  const cleanSpread = Math.max(0, Math.round(Number(spread || 0)));
  if(cleanSpread <= 0) return 0;
  return hashNumber(seedValue, cleanSpread * 2 + 1) - cleanSpread;
}
function botBalanceManagedDivisionId(selectedClubId=game?.selectedClubId){
  return seed?.clubs?.find(c => Number(c.id) === Number(selectedClubId))?.divisionId || 'default';
}
function botBalanceClubIds(selectedClubId=game?.selectedClubId){
  const ownId = Number(selectedClubId || game?.selectedClubId || 0);
  const divisionId = botBalanceManagedDivisionId(ownId);
  return (seed?.clubs || [])
    .filter(club => Number(club.id) !== ownId)
    .filter(club => !BOT_BALANCE_ONLY_MANAGER_DIVISION || (club.divisionId || 'default') === divisionId)
    .map(club => Number(club.id));
}
function botBalanceReference(selectedClubId=game?.selectedClubId){
  const ownSquad = playersByClub(Number(selectedClubId || game?.selectedClubId || 0));
  return {
    morale: Math.round(avg(ownSquad.map(p => currentMorale(p.id))) || PLAYER_MORALE_START),
    condition: Math.round(avg(ownSquad.map(p => currentCondition(p.id))) || 85),
    cohesion: cohesionValue(Number(selectedClubId || game?.selectedClubId || 0)) || TEAM_COHESION_START
  };
}
function botBalanceRankMap(){
  const map = {};
  if(typeof sortedStandings !== 'function') return map;
  (divisionOrderList() || []).forEach(division => {
    const table = sortedStandings(division.id) || [];
    const total = Math.max(1, table.length);
    table.forEach((row, index) => {
      const normalized = total <= 1 ? 0 : ((total - 1 - index) / (total - 1));
      const bonus = Math.round(((normalized - 0.5) * 2) * BOT_BALANCE_POSITION_BONUS_MAX);
      map[Number(row.clubId)] = {
        rank:index + 1,
        total,
        bonus,
        divisionId:division.id
      };
    });
  });
  return map;
}
function botBalancePositionBonus(clubId, rankMap={}){
  return Math.round(Number(rankMap?.[Number(clubId)]?.bonus || 0));
}
function botBalanceTargetValue(kind, referenceValue, clubId, rankMap={}, purpose='season_start'){
  const profile = botBalanceDifficultyProfile();
  const spread = kind === 'condition' ? BOT_BALANCE_CONDITION_SPREAD : kind === 'cohesion' ? BOT_BALANCE_COHESION_SPREAD : BOT_BALANCE_MORALE_SPREAD;
  const floor = kind === 'condition' ? BOT_BALANCE_CONDITION_FLOOR : kind === 'cohesion' ? BOT_BALANCE_COHESION_FLOOR : BOT_BALANCE_MORALE_FLOOR;
  const max = kind === 'cohesion' ? 100 : 99;
  const profileOffset = Number(profile[kind] || 0);
  const positionBonus = botBalancePositionBonus(clubId, rankMap);
  const positionFactor = purpose === 'maintenance' ? 0.45 : 0.75;
  const random = botBalanceRandomOffset(`bot-balance-${purpose}-${game?.seasonNumber || 1}-${clubId}-${kind}`, spread);
  return clamp(Math.round(Number(referenceValue || 0) + profileOffset + random + (positionBonus * positionFactor)), floor, max);
}
function botBalanceSkillPool(player){
  if(typeof trainableSkillsForPlayer === 'function') return trainableSkillsForPlayer(player);
  if(player.position === 'POR') return ['porteria','posicionamiento','serenidad','paseLargo','liderazgo','resistencia'];
  if(['LD','LI','DFC'].includes(player.position)) return ['marca','entradas','posicionamiento','fuerza','cabezazo','resistencia','trabajoEquipo'];
  if(['MCD','MC','MCO'].includes(player.position)) return ['paseCorto','paseLargo','vision','tecnica','trabajoEquipo','posicionamiento','resistencia'];
  return ['remate','regate','posicionamiento','serenidad','cabezazo','fuerza','resistencia','tecnica'];
}
function applyBotSeasonDevelopment(clubIds, rankMap={}){
  if(!BOT_BALANCE_ENABLED || BOT_BALANCE_DEVELOPMENT_CHANCE <= 0) return { players:0, gains:0 };
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  const profile = botBalanceDifficultyProfile();
  let players = 0;
  let gains = 0;
  (clubIds || []).forEach(clubId => {
    const positionBonus = botBalancePositionBonus(clubId, rankMap);
    const positionScale = BOT_BALANCE_POSITION_BONUS_MAX > 0 ? (positionBonus / BOT_BALANCE_POSITION_BONUS_MAX) : 0;
    const squad = playersByClub(clubId)
      .filter(player => !player.freeAgent && !player.retired)
      .sort((a,b)=> visibleOverall(b) - visibleOverall(a))
      .slice(0, Math.max(18, Math.min(28, playersByClub(clubId).length)));
    squad.forEach(player => {
      const youngBonus = Number(player.age || 0) <= 23 ? 0.05 : 0;
      const legendPlayer = typeof isLegendPlayer === 'function' && isLegendPlayer(player);
      const developmentChance = legendPlayer ? LEGEND_BOT_DEVELOPMENT_CHANCE : BOT_BALANCE_DEVELOPMENT_CHANCE;
      const maxSkillBoost = legendPlayer ? LEGEND_BOT_MAX_SKILL_BOOST : BOT_BALANCE_MAX_SKILL_BOOST;
      const chance = clamp((developmentChance + (positionScale * BOT_BALANCE_POSITION_DEVELOPMENT_BONUS) + youngBonus) * profile.development, 0, 0.80);
      const roll = hashNumber(`bot-development-${game?.seasonNumber || 1}-${clubId}-${player.id}`, 10000) / 10000;
      if(roll >= chance) return;
      const gainCount = 1 + (roll < chance * 0.18 ? 1 : 0);
      const skills = botBalanceSkillPool(player).filter(skill => Number.isFinite(baseSkill(player, skill)) && baseSkill(player, skill) < 98);
      if(!skills.length) return;
      if(!game.playerSkillBoosts[player.id]) game.playerSkillBoosts[player.id] = {};
      let playerGains = 0;
      for(let i=0; i<gainCount; i++){
        const skill = skills[hashNumber(`bot-development-skill-${game?.seasonNumber || 1}-${player.id}-${i}`, skills.length)];
        const current = Math.round(Number(game.playerSkillBoosts[player.id][skill] || 0));
        if(current >= maxSkillBoost) continue;
        game.playerSkillBoosts[player.id][skill] = clamp(current + 1, 0, maxSkillBoost);
        playerGains += 1;
      }
      if(playerGains > 0){
        players += 1;
        gains += playerGains;
      }
    });
  });
  return { players, gains };
}
function balanceBotsForSeasonStart(selectedClubId=game?.selectedClubId, rankMap={}){
  if(!game || !BOT_BALANCE_ENABLED || !BOT_BALANCE_ON_SEASON_START) return null;
  ensurePlayerStateForAll();
  ensureTeamCohesion();
  const clubIds = botBalanceClubIds(selectedClubId);
  const reference = botBalanceReference(selectedClubId);
  let playersAdjusted = 0;
  let clubsAdjusted = 0;
  clubIds.forEach(clubId => {
    const targetMorale = botBalanceTargetValue('morale', reference.morale, clubId, rankMap, 'season_start');
    const targetCondition = botBalanceTargetValue('condition', reference.condition, clubId, rankMap, 'season_start');
    const targetCohesion = botBalanceTargetValue('cohesion', reference.cohesion, clubId, rankMap, 'season_start');
    game.teamCohesion[clubId] = targetCohesion;
    const squad = playersByClub(clubId).filter(player => !player.freeAgent && !player.retired);
    squad.forEach(player => {
      const moraleVariance = botBalanceRandomOffset(`bot-balance-morale-player-${game?.seasonNumber || 1}-${clubId}-${player.id}`, 4);
      const conditionVariance = botBalanceRandomOffset(`bot-balance-condition-player-${game?.seasonNumber || 1}-${clubId}-${player.id}`, 4);
      game.playerMorale[player.id] = clamp(Math.round((currentMorale(player.id) * 0.30) + ((targetMorale + moraleVariance) * 0.70)), 1, 99);
      game.playerCondition[player.id] = clamp(Math.round((currentCondition(player.id) * 0.25) + ((targetCondition + conditionVariance) * 0.75)), 0, 99);
      playersAdjusted += 1;
    });
    clubsAdjusted += 1;
  });
  const development = applyBotSeasonDevelopment(clubIds, rankMap);
  const summary = {
    season:game.seasonNumber || 1,
    date:game.currentDate || '',
    clubs:clubsAdjusted,
    players:playersAdjusted,
    reference,
    development,
    difficulty:botBalanceDifficultyProfile().label,
    createdAt:Date.now()
  };
  game.botBalanceLog = Array.isArray(game.botBalanceLog) ? game.botBalanceLog : [];
  game.botBalanceLog.unshift(summary);
  game.botBalanceLog = game.botBalanceLog.slice(0, 20);
  return summary;
}

function botBalanceEligibleClubIdsForWear(options={}){
  if(!game || !seed?.clubs) return [];
  const ownId = Number(game?.selectedClubId || 0);
  const forceAll = Boolean(options.allClubs || game?.gameOver?.active || !ownId);
  if(forceAll){
    return (seed.clubs || []).map(club => Number(club.id || 0)).filter(Boolean);
  }
  return botBalanceClubIds(ownId);
}
function normalizeBotWearAndConditionForClub(clubId, options={}){
  if(!game || !PLAYER_WEAR_ENABLED || !clubId) return { players:0, wearReduced:0, conditionRaised:0 };
  const cleanClubId = Number(clubId || 0);
  const ownId = Number(game?.selectedClubId || 0);
  if(!options.includeManagedClub && ownId && cleanClubId === ownId && !game?.gameOver?.active) return { players:0, wearReduced:0, conditionRaised:0 };
  const wearCap = clamp(Math.round(Number(options.wearCap ?? BOT_BALANCE_MATCH_WEAR_CAP ?? 38)), 0, PLAYER_WEAR_MAX);
  const conditionFloor = clamp(Math.round(Number(options.conditionFloor ?? BOT_BALANCE_EMERGENCY_CONDITION_FLOOR ?? BOT_BALANCE_CONDITION_FLOOR ?? 58)), 0, 99);
  let players = 0;
  let wearReduced = 0;
  let conditionRaised = 0;
  playersByClub(cleanClubId).forEach(player => {
    if(!player || player.freeAgent || player.retired || isInjured(player.id) || isSuspended(player.id)) return;
    const beforeWear = currentPlayerWear(player.id);
    if(beforeWear > wearCap){
      wearReduced += Math.abs(Math.min(0, adjustPlayerWear(player.id, wearCap - beforeWear)));
    }
    const maxAllowed = maxConditionForPlayer(player.id);
    const target = Math.min(conditionFloor, maxAllowed);
    const beforeCondition = currentCondition(player.id);
    if(beforeCondition < target){
      game.playerCondition[player.id] = clamp(Math.round(target), 0, maxAllowed);
      conditionRaised += Math.max(0, Math.round(target - beforeCondition));
    }
    if(beforeWear > wearCap || beforeCondition < target) players += 1;
  });
  return { players, wearReduced, conditionRaised };
}
function normalizeBotWearAndConditionForMatch(match, options={}){
  if(!match) return { clubs:0, players:0, wearReduced:0, conditionRaised:0 };
  const clubIds = [Number(match.homeId || 0), Number(match.awayId || 0)].filter(Boolean);
  const summary = { clubs:0, players:0, wearReduced:0, conditionRaised:0 };
  clubIds.forEach(clubId => {
    const result = normalizeBotWearAndConditionForClub(clubId, options);
    if(result.players > 0){
      summary.clubs += 1;
      summary.players += result.players;
      summary.wearReduced += result.wearReduced;
      summary.conditionRaised += result.conditionRaised;
    }
  });
  if(summary.players > 0){
    game.botWearRepairLog = Array.isArray(game.botWearRepairLog) ? game.botWearRepairLog : [];
    game.botWearRepairLog.unshift({
      season:game.seasonNumber || 1,
      date:game.currentDate || '',
      matchId:match.id || null,
      reason:options.reason || 'before_match',
      ...summary,
      createdAt:Date.now()
    });
    game.botWearRepairLog = game.botWearRepairLog.slice(0, 20);
  }
  return summary;
}
function recoverBotWearDaily(options={}){
  if(!game || !PLAYER_WEAR_ENABLED || !BOT_BALANCE_ENABLED) return { clubs:0, players:0, wearReduced:0, conditionRaised:0 };
  const recovery = clamp(Math.round(Number(options.recovery ?? BOT_BALANCE_DAILY_WEAR_RECOVERY ?? 0)), 0, PLAYER_WEAR_MAX);
  if(recovery <= 0) return { clubs:0, players:0, wearReduced:0, conditionRaised:0 };
  const conditionGain = clamp(Math.round(Number(options.conditionGain ?? Math.max(1, Math.round(recovery * 1.5)))), 0, 99);
  const clubIds = botBalanceEligibleClubIdsForWear(options);
  const summary = { clubs:0, players:0, wearReduced:0, conditionRaised:0 };
  clubIds.forEach(clubId => {
    let clubPlayers = 0;
    playersByClub(clubId).forEach(player => {
      if(!player || player.freeAgent || player.retired) return;
      const beforeWear = currentPlayerWear(player.id);
      if(beforeWear <= 0) return;
      const reduced = Math.abs(Math.min(0, adjustPlayerWear(player.id, -recovery)));
      if(reduced > 0){
        summary.wearReduced += reduced;
        clubPlayers += 1;
      }
      if(!isInjured(player.id) && !isSuspended(player.id)){
        const beforeCondition = currentCondition(player.id);
        const maxAllowed = maxConditionForPlayer(player.id);
        const target = Math.min(maxAllowed, beforeCondition + conditionGain);
        if(target > beforeCondition){
          game.playerCondition[player.id] = clamp(Math.round(target), 0, maxAllowed);
          summary.conditionRaised += Math.round(target - beforeCondition);
        }
      }
    });
    if(clubPlayers > 0){
      summary.clubs += 1;
      summary.players += clubPlayers;
    }
  });
  if(summary.players > 0){
    game.botWearRecoveryLog = Array.isArray(game.botWearRecoveryLog) ? game.botWearRecoveryLog : [];
    game.botWearRecoveryLog.unshift({
      season:game.seasonNumber || 1,
      date:game.currentDate || '',
      reason:options.reason || 'daily',
      ...summary,
      createdAt:Date.now()
    });
    game.botWearRecoveryLog = game.botWearRecoveryLog.slice(0, 20);
  }
  return summary;
}

function maintainBotBalanceDuringSeason(options={}){
  if(!game || !BOT_BALANCE_ENABLED || !BOT_BALANCE_DURING_SEASON) return null;
  const force = Boolean(options.force);
  if(!force && isRegularSeason() && ((Number(game.matchdayIndex || 0) + 1) % BOT_BALANCE_MAINTENANCE_INTERVAL_MATCHDAYS !== 0)) return null;
  if(!force && !isRegularSeason()) return null;
  ensurePlayerStateForAll();
  ensureTeamCohesion();
  const rankMap = botBalanceRankMap();
  const reference = botBalanceReference(game.selectedClubId);
  const clubIds = botBalanceClubIds(game.selectedClubId);
  let playersAdjusted = 0;
  let clubsAdjusted = 0;
  clubIds.forEach(clubId => {
    const targetMorale = botBalanceTargetValue('morale', reference.morale, clubId, rankMap, 'maintenance');
    const targetCondition = botBalanceTargetValue('condition', reference.condition, clubId, rankMap, 'maintenance');
    const targetCohesion = botBalanceTargetValue('cohesion', reference.cohesion, clubId, rankMap, 'maintenance');
    const currentCohesion = cohesionValue(clubId);
    if(currentCohesion < targetCohesion){
      game.teamCohesion[clubId] = clamp(Math.round(Math.min(targetCohesion, currentCohesion + BOT_BALANCE_MAINTENANCE_COHESION_GAIN)), 0, 100);
      clubsAdjusted += 1;
    }
    playersByClub(clubId).forEach(player => {
      if(player.freeAgent || player.retired) return;
      let changed = false;
      if(PLAYER_WEAR_ENABLED && currentPlayerWear(player.id) > BOT_BALANCE_MATCH_WEAR_CAP){
        adjustPlayerWear(player.id, -(currentPlayerWear(player.id) - BOT_BALANCE_MATCH_WEAR_CAP));
        changed = true;
      }
      const cond = currentCondition(player.id);
      if(cond < targetCondition){
        const maxAllowed = maxConditionForPlayer(player.id);
        game.playerCondition[player.id] = clamp(Math.round(Math.min(targetCondition, cond + BOT_BALANCE_MAINTENANCE_CONDITION_GAIN, maxAllowed)), 0, maxAllowed);
        changed = true;
      }
      const morale = currentMorale(player.id);
      if(morale < targetMorale){
        game.playerMorale[player.id] = clamp(Math.round(Math.min(targetMorale, morale + BOT_BALANCE_MAINTENANCE_MORALE_GAIN)), 1, 99);
        changed = true;
      }
      if(changed) playersAdjusted += 1;
    });
  });
  return { clubs:clubsAdjusted, players:playersAdjusted, reference, forced:force };
}

function startNextSeason(selectedClubId, options={}){
  if(!game?.seasonFinalized) return;
  const currentClubId = Number(game.selectedClubId || 0);
  const requestedClubId = Number(selectedClubId || currentClubId);
  const allowDirectClubChange = Boolean(options?.allowDirectClubChange);
  if(requestedClubId !== currentClubId && !allowDirectClubChange){
    showNotice('No podés seleccionar otro club al cerrar la temporada. Los cambios de equipo se realizan mediante ofertas o solicitudes laborales.');
    return;
  }
  if(typeof archiveManagerPlayerStatsClub === 'function') archiveManagerPlayerStatsClub(game.selectedClubId, { final:true });
  archiveClubWorldCupEditionForState(game, { allowIncomplete:true });
  if(typeof archiveLibertadoresEditionForState === 'function') archiveLibertadoresEditionForState(game, { allowIncomplete:true });
  if(typeof archiveChampionsLeagueEditionForState === 'function') archiveChampionsLeagueEditionForState(game, { allowIncomplete:true });
  const retiredCount = game.seasonTransition?.retirements?.length || 0;
  const previousClubId = currentClubId;
  const nextClubId = requestedClubId;
  const previousMatchdayIndex = Number(game.matchdayIndex || game.fixtures?.length || 0);
  const previousBotBalanceRanks = botBalanceRankMap();
  const configuredPostseasonRecovery = postseasonTurnsForCurrentSeason();
  const appliedPostseasonRecovery = injuryRecoveryTurnsRegistered(game.seasonNumber || 1, 'postseason');
  const missingPostseasonRecovery = Math.max(0, configuredPostseasonRecovery - appliedPostseasonRecovery);
  applySeasonStartAvailabilityRebase(previousMatchdayIndex, missingPostseasonRecovery);
  const stadiumCapacityDecay = typeof applyManagedStadiumCapacityDeterioration === 'function' ? applyManagedStadiumCapacityDeterioration(previousClubId, game.seasonNumber || 1) : null;
  assignBotFieldStatesForNextSeason(nextClubId, previousClubId);
  repairInvalidBotFieldStates(game, 'season_transition', { message:false });
  applySeasonMovements();
  repairCrossCountryClubAssignments({ restoreNativeIfNeeded:false });
  game.clubDivisionOverrides = snapshotClubDivisionOverrides();
  const aging = applySeasonalAging();
  applyAcademyAgingIfNeeded();
  refreshAllPlayerClauses();
  game.selectedClubId = nextClubId;
  game.seasonNumber = (game.seasonNumber || 1) + 1;
  if(typeof resetSpecialObjectiveReductionForNewSeason === 'function') resetSpecialObjectiveReductionForNewSeason(game.seasonNumber);
  const transferUnlock = typeof consumeNextSeasonTransferBudgetUnlock === 'function' ? consumeNextSeasonTransferBudgetUnlock() : { rate:0, reasons:[] };
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  game.transferBudget = typeof createTransferBudgetState === 'function' ? createTransferBudgetState(game.selectedClubId, game.seasonNumber, transferUnlock.rate || 0) : (game.transferBudget || null);
  game.bankLoan = typeof refreshBankLoanOffersForSeason === 'function' ? refreshBankLoanOffersForSeason(game.bankLoan, game.seasonNumber) : (game.bankLoan || null);
  if(transferUnlock?.rate && typeof transferBudgetAddHistory === 'function'){
    transferBudgetAddHistory('season_bonus', `Bonus de directiva: ${(transferUnlock.reasons || []).map(r => r.reason).filter(Boolean).join(' + ') || 'temporada anterior'}`, 0, transferUnlock.rate);
  }
  game.seasonYear = seasonYearForNumber(game.seasonNumber);
  game.leagueFixtureSeedIndex = typeof leagueFixtureSeedIndexForSeasonNumber === 'function' ? leagueFixtureSeedIndexForSeasonNumber(game.seasonNumber) : null;
  game.leagueFixtureSeedVersion = game.leagueFixtureSeedIndex === null ? 'legacy-v969' : (typeof LEAGUE_FIXTURE_SEED_VERSION !== 'undefined' ? LEAGUE_FIXTURE_SEED_VERSION : 'v970-20-seeds');
  game.leagueFixtureSeedHistory = game.leagueFixtureSeedHistory && typeof game.leagueFixtureSeedHistory === 'object' && !Array.isArray(game.leagueFixtureSeedHistory) ? game.leagueFixtureSeedHistory : {};
  if(game.leagueFixtureSeedIndex !== null) game.leagueFixtureSeedHistory[game.seasonNumber] = game.leagueFixtureSeedIndex;
  if(typeof ensureLeagueSeasonEconomyForSeason === 'function') ensureLeagueSeasonEconomyForSeason(game, game.seasonNumber, { force:true, reason:'season_start' });
  game.calendarVersion = SEASON_CALENDAR_VERSION;
  game.seasonInitialBudget = Math.round(Number(game.budget || 0));
  game.seasonBudgetStartBySeason = game.seasonBudgetStartBySeason || {};
  game.seasonBudgetStartBySeason[game.seasonNumber] = game.seasonInitialBudget;
  game.seasonFinalized = false;
  game.seasonTransition = null;
  game.argentinaPlayoffs = null;
  game.clubWorldCup = null;
  game.nationalCups = typeof normalizeNationalCupsState === 'function' ? normalizeNationalCupsState({}, game.seasonNumber, game.seasonYear) : null;
  game.libertadores = typeof normalizeLibertadoresState === 'function' ? normalizeLibertadoresState({}, game.seasonNumber, game.seasonYear) : null;
  game.championsLeague = typeof normalizeChampionsLeagueState === 'function' ? normalizeChampionsLeagueState({}, game.seasonNumber, game.seasonYear) : null;
  game.seasonEndModalShown = false;
  game.seasonPhase = 'preseason';
  game.phaseTurn = 0;
  game.postseasonStartDate = '';
  game.postseasonTotalTurns = 0;
  game.preseasonFriendliesPlayed = 0;
  game.pendingFriendlyOpponentId = 0;
  game.matchdayIndex = 0;
  game.fixtures = generateFixturesForDivisions(seed.clubs, divisionOrderList(), { seasonYear:game.seasonYear, fixtureSeedIndex:game.leagueFixtureSeedIndex });
  const previousDate = validIsoDate(game.currentDate) ? game.currentDate : seasonEndDateForYear(seasonYearForNumber((game.seasonNumber || 2) - 1));
  const nextSeasonStart = firstAdvanceDateForSeason(game.seasonYear);
  game.currentDate = validIsoDate(previousDate) && daysBetweenIsoDates(previousDate, nextSeasonStart) <= 0 ? nextSeasonStart : addDaysToIsoDate(previousDate, 1);
  game.lastCalendarDate = game.currentDate;
  game.standings = createInitialStandings();
  game.playerStats = createInitialPlayerStats();
  game.playerStars = normalizePlayerStarsState(game.playerStars || {});
  game.playerImpactWindows = normalizePlayerImpactWindows(game.playerImpactWindows || {});
  syncPlayerStarsWithClubs(game);
  game.matchHistory = [];
  game.managerTacticalAdaptation = { season:game.seasonNumber || 1, signature:'', streak:0, lastBonus:0, lastProspectiveStreak:0 };
  game.playerBenchedStreak = { season:game.seasonNumber || 1, players:{} };
  game.lastOwnProblems = [];
  game.lastTurnSummary = null;
  game.mustReviewTactics = false;
  game.seasonEndPlayerOffers = null;
  game.rejectedPurchaseOffers = {};
  game.rejectedFreeAgentOffers = {};
  resetAcademySeasonState();
  resetStaffSeasonState();
  if(typeof resetScoutingCenterForNewSeason === 'function') resetScoutingCenterForNewSeason();
  game.monthlyExpenses = {};
  game.advanceLockedUntil = 0;
  game.lastBudgetDelta = 0;
  game.tactic = normalizeTactic(nextClubId, DEFAULT_TACTIC);
  mergeMarketPlayersIntoSeed(game.marketPlayers || []);
  renewFreeAgentMarketForSeason(retiredCount);
  repairBotRosters({ reason:'season_retirements' });
  ensurePlayerStateForAll();
  balanceBotsForSeasonStart(nextClubId, previousBotBalanceRanks);
  generateOpeningSponsorOffers(true);
  const leagueEconomyText = typeof leagueSeasonEconomyMessageForClub === 'function' ? leagueSeasonEconomyMessageForClub(game.selectedClubId, game.seasonNumber) : '';
  pushGameMessage({ type:'deportivo', title:`Temporada ${game.seasonNumber} iniciada`, body:`Comienza una nueva temporada con ${clubName(game.selectedClubId)}.${leagueEconomyText ? ` ${leagueEconomyText}` : ''}`, priority:'normal' });
  if(stadiumCapacityDecay && Number(stadiumCapacityDecay.lost || 0) > 0){
    pushGameMessage({ type:'estadio', title:'Deterioro anual del estadio', body:`El estadio de ${clubName(stadiumCapacityDecay.clubId)} perdió ${new Intl.NumberFormat('es-AR').format(stadiumCapacityDecay.lost)} lugares por deterioro estructural anual (${new Intl.NumberFormat('es-AR').format(stadiumCapacityDecay.before)} → ${new Intl.NumberFormat('es-AR').format(stadiumCapacityDecay.after)}).`, priority:'normal' });
  }
  if(aging?.ageDecay?.players > 0){
    pushGameMessage({ type:'deportivo', title:'Deterioro por edad aplicado', body:`${aging.ageDecay.players} jugador(es) de 32 años o más recibieron penalización anual de habilidades. Total aplicado: -${aging.ageDecay.added} puntos acumulados.`, priority:'normal' });
  }
  if(typeof runScheduledSeasonGameVerifier === 'function') runScheduledSeasonGameVerifier({ reason:'season_start_day_1', scheduledDay:1, silent:true });
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
  const moveRows = movements.map(move => `<li><strong>${escapeHtml(clubName(move.clubId))}</strong>: ${move.type === 'promotion' ? 'asciende' : 'desciende'} a ${escapeHtml(move.toDivisionName)}${move.reason ? ` · ${escapeHtml(move.reason)}` : ''}</li>`).join('');
  const retirementRows = retirements.map(p => `<li><strong>${escapeHtml(p.name)}</strong> se retiró del fútbol a los ${p.age} años.</li>`).join('');
  return `<div class="card season-end-card">
    <div class="row"><div><p class="label">Fin de temporada</p><h3>${record?.title ? 'Campeón' : `Posición final: ${escapeHtml(record?.label || '—')}`}</h3></div><span class="pill">Temporada ${game.seasonNumber || 1}</span></div>
    <p class="muted">La próxima temporada continúa con ${escapeHtml(clubName(game.selectedClubId))}. Para cambiar de equipo, utilizá una oferta o una solicitud laboral.</p>
    ${record?.totalSeasonPrize ? `<p class="tagline ok">Premios deportivos cobrados: <strong>${formatMoney(record.totalSeasonPrize)}</strong>${record.championPrize ? ` · Campeonato ${formatMoney(record.championPrize)}` : ''}${record.promotionPrize ? ` · Ascenso ${formatMoney(record.promotionPrize)}` : ''}.</p>` : ''}
    ${game.seasonTransition?.salariesPaid ? `<p class="tagline">Pago anual de sueldos descontado: <strong>${formatMoney(game.seasonTransition.salariesPaid)}</strong>.</p>` : ''}
    ${salaryAdjustments?.details?.length ? `<p class="tagline">Sueldos ajustados para la próxima temporada según partidos jugados: ${salaryAdjustments.increased || 0} suben, ${salaryAdjustments.decreased || 0} bajan.</p>` : ''}
    ${retirementRows ? `<ul class="season-movement-list">${retirementRows}</ul>` : ''}
    ${moveRows ? `<ul class="season-movement-list">${moveRows}</ul>` : ''}
    <div class="row" style="margin-top:12px"><button class="primary" data-continue-season>Comenzar próxima temporada</button></div>
  </div>`;
}
function openSeasonEndModal(){
  if(!game?.seasonFinalized) return;
  const record = game.seasonTransition?.userRecord;
  const body = `<div class="season-end-modal">
    <p class="label">Fin de temporada ${game.seasonNumber || 1}</p>
    <h2>${record?.title ? 'Saliste campeón' : `Finalizaste ${escapeHtml(record?.label || '—')}`}</h2>
    ${record?.totalSeasonPrize ? `<p class="tagline ok">Premios cobrados: <strong>${formatMoney(record.totalSeasonPrize)}</strong>${record.championPrize ? ` · Campeonato ${formatMoney(record.championPrize)}` : ''}${record.promotionPrize ? ` · Ascenso ${formatMoney(record.promotionPrize)}` : ''}.</p>` : ''}
    <p class="muted">La próxima temporada continuará con ${escapeHtml(clubName(game.selectedClubId))}. Los cambios de equipo sólo se realizan mediante ofertas o solicitudes laborales.</p>
    <div class="row" style="margin-top:14px"><button id="btnContinueSameClub" class="primary">Comenzar próxima temporada</button></div>
  </div>`;
  openModal(body);
  $('btnContinueSameClub')?.addEventListener('click', () => startNextSeason(game.selectedClubId));
}
