/* Puente del simulador 2.0 y helpers compartidos de partido. */

function simulateMatch(match){
  if(!window.Simulator20?.simulateMatch) throw new Error('Simulador 2.0 no disponible');
  const run = () => window.Simulator20.simulateMatch(match);
  return typeof withCompetitionSuspensionContext === 'function'
    ? withCompetitionSuspensionContext(match, run)
    : run();
}
function pitchEffect(pitch){
  return PITCH_CONDITIONS[pitch] || PITCH_CONDITIONS.Normal;
}

/*
  El cálculo principal del partido vive en simulador-2.0.js.
  Este archivo conserva sólo los helpers globales que ese motor usa fuera de su IIFE:
  cambios, aplicación de resultados, estadísticas, sanciones, lesiones y limpieza de táctica.
*/
function makeSubstitutions(clubId, tactic){
  if(clubId !== game.selectedClubId || !tactic?.autoSubs?.length) return [];
  const events = [];
  const onPitch = new Set((tactic.starters || []).map(Number));
  const alreadyIn = new Set();
  for(const rule of tactic.autoSubs){
    const outId = Number(rule.outId || 0);
    const inId = Number(rule.inId || 0);
    if(!outId || !inId || !onPitch.has(outId) || alreadyIn.has(inId) || !canEnterMatch(inId)) continue;
    const minute = Math.random() < 0.10 ? 45 : Math.floor(rnd(60,91));
    const outPlayer = playerById(outId);
    let execute = false;
    if(rule.trigger === 'injuryOnly') execute = false;
    if(rule.trigger === 'tired') execute = currentCondition(outId) < 68 || effectiveSkill(outPlayer,'resistencia') < 72 || minute >= 75 || Math.random() < 0.35;
    if(rule.trigger === 'best'){
      const inPlayer = playerById(inId);
      const outValue = outPlayer ? effectiveOverall(outPlayer) * conditionFactor(outId) : 0;
      const inValue = inPlayer ? benchOverallValue(inPlayer) * conditionFactor(inId) : 0;
      execute = inValue >= outValue * 0.96 || currentCondition(outId) < 72 || minute >= 75;
    }
    if(execute){
      onPitch.delete(outId);
      onPitch.add(inId);
      alreadyIn.add(inId);
      events.push({ clubId, outId, inId, minute, trigger:rule.trigger, injuredSubPenalty:canUseInjuredAsSub(inId) });
    }
  }
  return events.slice(0,5);
}
function makeInjurySubstitutions(clubId, tactic, injuries, existingSubs=[]){
  const ownInjuries = (injuries || []).filter(i => i.clubId === clubId && i.phase !== 'final');
  if(!ownInjuries.length) return [];
  const starterIds = (tactic?.starters?.length ? tactic.starters : selectLineup(clubId, tactic).map(p=>p.id)).map(Number);
  const benchIds = (tactic?.bench?.length ? tactic.bench : autoSelectBench(clubId, starterIds).map(p=>p.id)).map(Number);
  const usedIn = new Set(existingSubs.filter(s=>s.clubId===clubId).map(s=>Number(s.inId)));
  const alreadyOut = new Set(existingSubs.filter(s=>s.clubId===clubId).map(s=>Number(s.outId)));
  const events = [];
  for(const injury of ownInjuries){
    const outId = Number(injury.playerId);
    if(alreadyOut.has(outId)) continue;
    const outPlayer = playerById(outId);
    const candidate = benchIds
      .map(id => playerById(id))
      .filter(p => p && !usedIn.has(p.id) && canEnterMatch(p.id))
      .sort((a,b)=> (benchOverallValue(b) + (outPlayer && playerGroup(b.position)===playerGroup(outPlayer.position) ? 20 : 0)) - (benchOverallValue(a) + (outPlayer && playerGroup(a.position)===playerGroup(outPlayer.position) ? 20 : 0)))[0];
    if(candidate){
      usedIn.add(candidate.id);
      alreadyOut.add(outId);
      events.push({ clubId, outId, inId:candidate.id, minute:injury.minute, trigger:'injury', injuredSubPenalty:canUseInjuredAsSub(candidate.id) });
    }
    if(existingSubs.filter(s=>s.clubId===clubId).length + events.length >= 5) break;
  }
  return events;
}
function applyResultToTables(match, hg, ag){
  if(match?.playoff || match?.knockout || match?.clubWorldCup || match?.libertadores || match?.championsLeague) return;
  const h = game.standings[match.homeId];
  const a = game.standings[match.awayId];
  h.pj++; a.pj++;
  h.gf += hg; h.gc += ag; a.gf += ag; a.gc += hg;
  if(hg > ag){ h.pg++; a.pp++; h.pts += 3; }
  else if(hg < ag){ a.pg++; h.pp++; a.pts += 3; }
  else { h.pe++; a.pe++; h.pts++; a.pts++; }
  h.dg = h.gf - h.gc; a.dg = a.gf - a.gc;
}
function officialPlayerStatsRecord(container, playerId, clubId){
  const id = Math.max(0, Math.round(Number(playerId || 0)));
  if(!container || !id) return null;
  const player = playerById(id) || { id, clubId };
  if(!container[id]) container[id] = typeof createEmptyPlayerStat === 'function'
    ? createEmptyPlayerStat(player)
    : { playerId:id, clubId:Number(player.clubId || clubId || 0), played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
  if(typeof normalizePlayerStatRecord === 'function') normalizePlayerStatRecord(container[id], player);
  container[id].clubId = Math.max(0, Math.round(Number(player.clubId ?? clubId ?? container[id].clubId ?? 0)));
  return container[id];
}
function officialPlayerParticipation(playerId, clubId, lineup=[], substitutions=[], cards=[], injuries=[]){
  const id = Number(playerId || 0);
  const starters = new Set((lineup || []).map(player => Number(player?.id || 0)).filter(Boolean));
  const ownSubs = (substitutions || []).filter(sub => Number(sub?.clubId || 0) === Number(clubId));
  const starter = starters.has(id);
  const entry = starter
    ? 0
    : Math.min(90, ...ownSubs.filter(sub => Number(sub?.inId || 0) === id).map(sub => Math.max(0, Number(sub?.minute || 0))), 90);
  if(!starter && entry >= 90 && !ownSubs.some(sub => Number(sub?.inId || 0) === id)) return null;
  const exits = [90];
  ownSubs.filter(sub => Number(sub?.outId || 0) === id).forEach(sub => exits.push(Math.max(entry, Math.min(90, Number(sub?.minute || 90)))));
  (cards || []).filter(card => Number(card?.clubId || 0) === Number(clubId) && Number(card?.playerId || 0) === id && ['red','secondYellowRed'].includes(String(card?.type || ''))).forEach(card => exits.push(Math.max(entry, Math.min(90, Number(card?.minute || 90)))));
  (injuries || []).filter(injury => Number(injury?.clubId || 0) === Number(clubId) && Number(injury?.playerId || 0) === id).forEach(injury => exits.push(Math.max(entry, Math.min(90, Number(injury?.minute || 90)))));
  const exit = Math.max(entry, Math.min(...exits));
  return { starter, entry, exit, minutes:Math.max(0, Math.round(exit - entry)) };
}
function officialPlayerMatchRating(matchResult, clubId, playerId){
  if(!matchResult) return null;
  const id = Number(playerId || 0);
  const list = Array.isArray(matchResult.playerRatings) ? matchResult.playerRatings : [];
  const stored = Number(list.find(item => Number(item?.playerId || item?.id || 0) === id)?.rating);
  if(Number.isFinite(stored)) return clamp(stored, 3, 10);
  if(typeof managerPlayerStatsEventSummary === 'function' && typeof managerPlayerFallbackRating === 'function'){
    const events = managerPlayerStatsEventSummary(matchResult, id);
    return clamp(Number(managerPlayerFallbackRating(matchResult, clubId, id, events) || 0), 3, 10);
  }
  return null;
}
function applyPlayerStats(clubId, lineup, substitutions, goals, cards, injuries, keySaves=[], errors=[], matchResult=null){
  game.playerStats = game.playerStats || {};
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  const playedIds = new Set((lineup || []).map(player => Number(player?.id || 0)).filter(Boolean));
  (substitutions || []).filter(sub => Number(sub?.clubId || 0) === Number(clubId)).forEach(sub => {
    const inId = Number(sub?.inId || 0);
    if(inId) playedIds.add(inId);
  });
  playedIds.forEach(id => {
    const participation = officialPlayerParticipation(id, clubId, lineup, substitutions, cards, injuries);
    if(!participation) return;
    const player = playerById(id);
    const eventSummary = typeof managerPlayerStatsEventSummary === 'function' && matchResult
      ? managerPlayerStatsEventSummary(matchResult, id)
      : {
          goals:(goals || []).filter(goal => Number(goal?.clubId || 0) === Number(clubId) && Number(goal?.playerId || goal?.scorerId || 0) === id).length,
          assists:(goals || []).filter(goal => Number(goal?.clubId || 0) === Number(clubId) && Number(goal?.assistId || 0) === id).length,
          injuries:(injuries || []).filter(injury => Number(injury?.clubId || 0) === Number(clubId) && Number(injury?.playerId || 0) === id).length,
          yellow:(cards || []).filter(card => Number(card?.clubId || 0) === Number(clubId) && Number(card?.playerId || 0) === id && ['yellow','secondYellowRed'].includes(String(card?.type || ''))).length,
          red:(cards || []).filter(card => Number(card?.clubId || 0) === Number(clubId) && Number(card?.playerId || 0) === id && ['red','secondYellowRed'].includes(String(card?.type || ''))).length,
          saves:(keySaves || []).filter(save => Number(save?.clubId || 0) === Number(clubId) && Number(save?.playerId || save?.goalkeeperId || 0) === id).length,
          errors:(errors || []).filter(error => Number(error?.clubId || 0) === Number(clubId) && Number(error?.playerId || 0) === id).length,
          goalErrors:(errors || []).filter(error => Number(error?.clubId || 0) === Number(clubId) && Number(error?.playerId || 0) === id && Boolean(error?.goal)).length
        };
    const isKeeper = String(player?.position || '').toUpperCase() === 'POR';
    const rivalGoals = isKeeper
      ? (goals || []).filter(goal => Number(goal?.clubId || 0) !== Number(clubId) && Number(goal?.minute || 90) >= participation.entry && Number(goal?.minute || 90) <= participation.exit).length
      : 0;
    const rating = officialPlayerMatchRating(matchResult, clubId, id);
    [officialPlayerStatsRecord(game.playerStats, id, clubId), officialPlayerStatsRecord(game.playerCareerStats, id, clubId)].filter(Boolean).forEach(stat => {
      stat.played += 1;
      if(participation.starter) stat.starts += 1;
      stat.minutes += participation.minutes;
      stat.goals += Number(eventSummary.goals || 0);
      stat.assists += Number(eventSummary.assists || 0);
      stat.yellow += Number(eventSummary.yellow || 0);
      stat.red += Number(eventSummary.red || 0);
      stat.injuries += Number(eventSummary.injuries || 0);
      stat.keySaves += Number(eventSummary.saves || 0);
      stat.errors += Number(eventSummary.errors || 0);
      stat.goalErrors += Number(eventSummary.goalErrors || 0);
      if(isKeeper){
        stat.goalsConceded += rivalGoals;
        if(rivalGoals === 0 && participation.minutes >= 60) stat.cleanSheets += 1;
      }
      if(Number.isFinite(rating)){
        stat.ratingTotal = Math.round((Number(stat.ratingTotal || 0) + rating) * 1000) / 1000;
        stat.ratedMatches = Number(stat.ratedMatches || 0) + 1;
        stat.lastRating = Math.round(rating * 10) / 10;
      }
    });
  });
  if(typeof recordManagerPlayerMatchStatistics === 'function' && matchResult){
    recordManagerPlayerMatchStatistics(clubId, [...playedIds], matchResult);
  }
}
function applyAvailability(cards, injuries, matchContext=null){
  if(matchContext && typeof processCompetitionDisciplineForMatch === 'function'){
    processCompetitionDisciplineForMatch(matchContext, cards);
  }
  injuries.forEach(i => {
    const label = i.injuryLabel || i.name || 'Lesión';
    const injuryDays = Math.max(1, Math.round(Number(i.matchesOut || 1)));
    game.playerStatus[i.playerId] = {
      ...playerStatus(i.playerId),
      injuredThrough: game.matchdayIndex + Math.max(1, Math.ceil(injuryDays / Math.max(1, LEAGUE_ROUND_INTERVAL_DAYS))),
      injuredUntilTurn: currentTurnIndex() + injuryDays,
      injuryLabel: label,
      injuryChance: i.chance,
      highLoadInjury: Boolean(i.highLoad),
      highLoadRatio: i.highLoadRatio,
      highLoadPlayed: i.highLoadPlayed,
      highLoadReference: i.highLoadReference,
      injuredAtMatchday: game.matchdayIndex,
      injuredAtTurn: currentTurnIndex()
    };
  });
  if(typeof registerFirstTeamSeasonInjuries === 'function') registerFirstTeamSeasonInjuries(injuries, { compensation:injuries.some(injury => injury?.source === 'midweek_minimum') });
}
function collectOwnProblems(result){
  if(!result) return [];
  const ownClub = game.selectedClubId;
  const injuries = (result.injuries || []).filter(i => i.clubId === ownClub).map(i => ({ type:'injury', playerId:i.playerId }));
  const reds = (result.cards || [])
    .filter(c => c.clubId === ownClub && (c.type === 'red' || c.type === 'secondYellowRed'))
    .filter(c => typeof isSuspended !== 'function' || isSuspended(c.playerId))
    .map(c => ({ type:'red', playerId:c.playerId }));
  return [...injuries, ...reds];
}
function removeOwnUnavailableFromTactic(problems=[]){
  if(!game?.tactic || !problems.length) return;
  const ids = new Set(problems.map(p => Number(p.playerId)).filter(Boolean));
  if(!ids.size) return;
  const starters = (game.tactic.starters || []).slice(0,11);
  while(starters.length < 11) starters.push(0);
  let changed = false;
  for(let i=0;i<starters.length;i++){
    if(ids.has(Number(starters[i]))){ starters[i] = 0; changed = true; }
  }
  const bench = (game.tactic.bench || []).filter(id => !ids.has(Number(id)));
  const autoSubs = (game.tactic.autoSubs || []).map(rule => ({
    ...rule,
    outId: ids.has(Number(rule.outId)) ? 0 : Number(rule.outId || 0),
    inId: ids.has(Number(rule.inId)) ? 0 : Number(rule.inId || 0)
  }));
  if(changed || bench.length !== (game.tactic.bench || []).length){
    const captainId = ids.has(Number(game.tactic.captainId || 0)) ? 0 : Number(game.tactic.captainId || 0);
    game.tactic = ensureTacticCaptain(applyStarterMentalities({ ...game.tactic, captainId, starters, bench, autoSubs }), game.selectedClubId);
  }
}

/* V8.79 · Definiciones por penales para competiciones que exigen ganador. */
function competitionMatchRule(match, key, fallback=undefined){
  const sources = [
    match?.competitionRules,
    match?.rules,
    match?.tieBreakRules,
    match?.tieBreak,
    match
  ];
  for(const source of sources){
    if(source && Object.prototype.hasOwnProperty.call(source, key)) return source[key];
  }
  return fallback;
}
function competitionMatchRequiresWinner(match){
  if(!match || match.friendly) return false;
  if(competitionMatchRule(match, 'allowDraw', undefined) === true) return false;
  if(['none','draw','stay'].includes(String(competitionMatchRule(match, 'tieBreakMode', '')).toLowerCase())) return false;
  return Boolean(
    match.clubWorldCupKnockout
    || match.requiresWinner
    || match.mustHaveWinner
    || match.cupRequiresWinner
    || match.knockoutRequiresWinner
    || competitionMatchRule(match, 'requiresWinner', false)
    || competitionMatchRule(match, 'mustHaveWinner', false)
  );
}
function competitionAggregateScore(match, result){
  const directHome = Number(competitionMatchRule(match, 'aggregateHomeGoals', NaN));
  const directAway = Number(competitionMatchRule(match, 'aggregateAwayGoals', NaN));
  if(Number.isFinite(directHome) && Number.isFinite(directAway)) return { home:directHome, away:directAway, supplied:true };
  const aggregate = competitionMatchRule(match, 'aggregateScore', null) || result?.aggregateScore || null;
  if(aggregate && Number.isFinite(Number(aggregate.home)) && Number.isFinite(Number(aggregate.away))){
    return { home:Number(aggregate.home), away:Number(aggregate.away), supplied:true };
  }
  const leg = Math.max(0, Math.round(Number(match?.leg || match?.roundLeg || competitionMatchRule(match, 'leg', 0) || 0)));
  const twoLegged = Boolean(match?.twoLegged || match?.secondLeg || leg === 2 || competitionMatchRule(match, 'twoLegged', false));
  if(!twoLegged) return null;
  const before = competitionMatchRule(match, 'aggregateBefore', null) || match?.aggregateBefore || null;
  if(before && Number.isFinite(Number(before.home)) && Number.isFinite(Number(before.away))){
    return {
      home:Number(before.home) + Number(result?.homeGoals || 0),
      away:Number(before.away) + Number(result?.awayGoals || 0),
      supplied:true
    };
  }
  return null;
}
function competitionMatchWinnerBeforePenalties(match, result){
  const aggregate = competitionAggregateScore(match, result);
  if(aggregate){
    if(aggregate.home > aggregate.away) return Number(match.homeId || result?.homeId || 0);
    if(aggregate.away > aggregate.home) return Number(match.awayId || result?.awayId || 0);
    return 0;
  }
  const homeGoals = Number(result?.homeGoals || 0);
  const awayGoals = Number(result?.awayGoals || 0);
  if(homeGoals > awayGoals) return Number(match.homeId || result?.homeId || 0);
  if(awayGoals > homeGoals) return Number(match.awayId || result?.awayId || 0);
  return 0;
}
function penaltyShootoutPlayerValue(player){
  if(!player) return 1;
  const overall = typeof effectiveOverall === 'function' ? Number(effectiveOverall(player) || player.overall || 50) : Number(player.overall || 50);
  const remate = typeof effectiveSkill === 'function' ? Number(effectiveSkill(player, 'remate') || overall) : Number(player?.skills?.remate || overall);
  const serenidad = typeof effectiveSkill === 'function' ? Number(effectiveSkill(player, 'serenidad') || overall) : Number(player?.skills?.serenidad || overall);
  const tecnica = typeof effectiveSkill === 'function' ? Number(effectiveSkill(player, 'tecnica') || overall) : Number(player?.skills?.tecnica || overall);
  const specific = Number(player?.skills?.penales);
  const base = Number.isFinite(specific)
    ? specific * 0.55 + remate * 0.20 + serenidad * 0.15 + tecnica * 0.05 + overall * 0.05
    : remate * 0.38 + serenidad * 0.27 + tecnica * 0.15 + overall * 0.20;
  const pos = String(player.position || '').toUpperCase();
  const positionBonus = ['DC','ED','EI'].includes(pos) ? 4 : ['MCO','MC','MD','MI'].includes(pos) ? 2 : ['MCD'].includes(pos) ? 0 : ['DFC','LD','LI'].includes(pos) ? -2 : pos === 'POR' ? -6 : 0;
  return Math.max(1, Math.min(99, base + positionBonus));
}
function penaltyShootoutGoalkeeperValue(player){
  if(!player) return 45;
  const overall = typeof effectiveOverall === 'function' ? Number(effectiveOverall(player) || player.overall || 50) : Number(player.overall || 50);
  const porteria = typeof effectiveSkill === 'function' ? Number(effectiveSkill(player, 'porteria') || overall) : Number(player?.skills?.porteria || overall);
  const serenidad = typeof effectiveSkill === 'function' ? Number(effectiveSkill(player, 'serenidad') || overall) : Number(player?.skills?.serenidad || overall);
  const posicionamiento = typeof effectiveSkill === 'function' ? Number(effectiveSkill(player, 'posicionamiento') || overall) : Number(player?.skills?.posicionamiento || overall);
  return Math.max(1, Math.min(99, porteria * 0.55 + posicionamiento * 0.18 + serenidad * 0.12 + overall * 0.15));
}
function penaltyShootoutCondition(playerId){
  if(typeof currentCondition === 'function') return Math.max(0, Math.min(100, Number(currentCondition(playerId) || 0)));
  return 70;
}
function penaltyShootoutMorale(playerId){
  if(typeof currentMorale === 'function') return Math.max(0, Math.min(100, Number(currentMorale(playerId) || 0)));
  return 60;
}
function penaltyShootoutEligiblePlayers(match, result, clubId, side){
  const playedKey = side === 'home' ? 'playedIdsHome' : 'playedIdsAway';
  const starterKey = side === 'home' ? 'starterIdsHome' : 'starterIdsAway';
  const lineupKey = side === 'home' ? 'homeLineup' : 'awayLineup';
  const starterIds = [];
  const pushStarter = value => { const id = Number(value || 0); if(id && !starterIds.includes(id)) starterIds.push(id); };
  (result?.[starterKey] || []).forEach(pushStarter);
  (result?.[lineupKey] || []).forEach(player => pushStarter(player?.id || player));
  const onPitch = new Set(starterIds);
  (result?.substitutions || []).filter(sub => Number(sub?.clubId || 0) === Number(clubId)).sort((a,b)=>Number(a?.minute || 0)-Number(b?.minute || 0)).forEach(sub => {
    const outId = Number(sub?.outId || 0);
    const inId = Number(sub?.inId || 0);
    if(outId) onPitch.delete(outId);
    if(inId) onPitch.add(inId);
  });
  const red = new Set((result?.cards || []).filter(card => Number(card?.clubId || 0) === Number(clubId) && ['red','secondYellowRed'].includes(String(card?.type || ''))).map(card => Number(card.playerId || 0)));
  const injured = new Set((result?.injuries || []).filter(injury => Number(injury?.clubId || 0) === Number(clubId)).map(injury => Number(injury.playerId || 0)));
  red.forEach(id => onPitch.delete(id));
  injured.forEach(id => onPitch.delete(id));
  let ids = Array.from(onPitch).filter(Boolean);
  if(!ids.length){
    const fallback = [];
    const push = value => { const id = Number(value || 0); if(id && !fallback.includes(id)) fallback.push(id); };
    (result?.[playedKey] || []).forEach(push);
    starterIds.forEach(push);
    ids = fallback.filter(id => !red.has(id) && !injured.has(id));
    if(!ids.length) ids = fallback.filter(id => !red.has(id));
  }
  let players = ids.map(id => typeof playerById === 'function' ? playerById(id) : null).filter(Boolean);
  if(!players.length && typeof playersByClub === 'function') players = playersByClub(clubId).filter(Boolean);
  return players.sort((a,b) => penaltyShootoutPlayerValue(b) - penaltyShootoutPlayerValue(a) || Number(b.overall || 0) - Number(a.overall || 0) || Number(a.id || 0) - Number(b.id || 0));
}
function penaltyShootoutGoalkeeper(players, clubId){
  const keeper = (players || []).filter(player => String(player?.position || '').toUpperCase() === 'POR').sort((a,b) => penaltyShootoutGoalkeeperValue(b) - penaltyShootoutGoalkeeperValue(a))[0];
  if(keeper) return keeper;
  if(typeof playersByClub === 'function'){
    const squadKeeper = playersByClub(clubId).filter(player => String(player?.position || '').toUpperCase() === 'POR').sort((a,b) => penaltyShootoutGoalkeeperValue(b) - penaltyShootoutGoalkeeperValue(a))[0];
    if(squadKeeper) return squadKeeper;
  }
  return (players || [])[0] || null;
}
function penaltyShootoutMinutesPlayed(result, clubId, playerId, side){
  const id = Number(playerId || 0);
  if(!id) return 0;
  const starterKey = side === 'home' ? 'starterIdsHome' : 'starterIdsAway';
  const starter = (result?.[starterKey] || []).map(Number).includes(id);
  const subs = (result?.substitutions || []).filter(sub => Number(sub?.clubId || 0) === Number(clubId));
  const entry = starter ? 0 : Math.min(90, ...subs.filter(sub => Number(sub?.inId || 0) === id).map(sub => Math.max(0, Number(sub?.minute || 0))), 90);
  if(!starter && entry >= 90 && !subs.some(sub => Number(sub?.inId || 0) === id)) return 0;
  const exits = [90];
  subs.filter(sub => Number(sub?.outId || 0) === id).forEach(sub => exits.push(Math.max(entry, Math.min(90, Number(sub?.minute || 90)))));
  (result?.cards || []).filter(card => Number(card?.clubId || 0) === Number(clubId) && Number(card?.playerId || 0) === id && ['red','secondYellowRed'].includes(String(card?.type || ''))).forEach(card => exits.push(Math.max(entry, Math.min(90, Number(card?.minute || 90)))));
  (result?.injuries || []).filter(injury => Number(injury?.clubId || 0) === Number(clubId) && Number(injury?.playerId || 0) === id).forEach(injury => exits.push(Math.max(entry, Math.min(90, Number(injury?.minute || 90)))));
  return Math.max(0, Math.round(Math.min(...exits) - entry));
}
function penaltyShootoutKickProbability(shooter, goalkeeper, context={}){
  const shooterValue = penaltyShootoutPlayerValue(shooter);
  const keeperValue = penaltyShootoutGoalkeeperValue(goalkeeper);
  const rawCondition = penaltyShootoutCondition(shooter?.id);
  const minutesPlayed = Math.max(0, Number(context.minutesPlayed || 0));
  const condition = Math.max(0, rawCondition - Math.max(0, minutesPlayed - 45) * 0.08);
  const morale = penaltyShootoutMorale(shooter?.id);
  const localBonus = context.isHome && !context.neutralVenue ? 0.008 : 0;
  const chance = 0.745
    + (shooterValue - 60) * 0.0031
    - (keeperValue - 60) * 0.0025
    + (condition - 70) * 0.0014
    + (morale - 60) * 0.0009
    + localBonus;
  return Math.max(0.50, Math.min(0.92, chance));
}
function resolvePenaltyShootout(match, result, options={}){
  if(!match || !result) return null;
  const existing = result.penaltyShootout;
  if(existing && Number(existing.homeKicks || existing.kicks?.filter?.(kick => Number(kick.clubId) === Number(match.homeId)).length || 0) === Number(existing.awayKicks || existing.kicks?.filter?.(kick => Number(kick.clubId) === Number(match.awayId)).length || 0) && Number(existing.home || 0) !== Number(existing.away || 0)) return existing;
  const random = typeof options.random === 'function' ? options.random : Math.random;
  const homeId = Number(match.homeId || result.homeId || 0);
  const awayId = Number(match.awayId || result.awayId || 0);
  if(!homeId || !awayId) return null;
  const homePlayers = penaltyShootoutEligiblePlayers(match, result, homeId, 'home');
  const awayPlayers = penaltyShootoutEligiblePlayers(match, result, awayId, 'away');
  if(!homePlayers.length || !awayPlayers.length) return null;
  const homeKeeper = penaltyShootoutGoalkeeper(homePlayers, homeId);
  const awayKeeper = penaltyShootoutGoalkeeper(awayPlayers, awayId);
  const neutralVenue = Boolean(match.neutralVenue || match.clubWorldCup || competitionMatchRule(match, 'neutralVenue', false));
  const firstClubId = Number(options.firstClubId || (random() < 0.5 ? homeId : awayId));
  const secondClubId = firstClubId === homeId ? awayId : homeId;
  const orders = { [homeId]:homePlayers, [awayId]:awayPlayers };
  const keepers = { [homeId]:homeKeeper, [awayId]:awayKeeper };
  const indexes = { [homeId]:0, [awayId]:0 };
  const scores = { [homeId]:0, [awayId]:0 };
  const kickCounts = { [homeId]:0, [awayId]:0 };
  const kicks = [];
  const takeKick = (clubId, round, suddenDeath=false, forcedOutcome=null) => {
    const list = orders[clubId] || [];
    const shooter = list[indexes[clubId] % list.length];
    indexes[clubId] += 1;
    const opponentId = clubId === homeId ? awayId : homeId;
    const goalkeeper = keepers[opponentId] || null;
    const side = clubId === homeId ? 'home' : 'away';
    const probability = penaltyShootoutKickProbability(shooter, goalkeeper, { isHome:clubId === homeId, neutralVenue, minutesPlayed:penaltyShootoutMinutesPlayed(result, clubId, shooter?.id, side) });
    const scored = typeof forcedOutcome === 'boolean' ? forcedOutcome : random() < probability;
    kickCounts[clubId] += 1;
    if(scored) scores[clubId] += 1;
    kicks.push({
      order:kicks.length + 1,
      round,
      suddenDeath:Boolean(suddenDeath),
      clubId,
      playerId:Number(shooter?.id || 0),
      playerName:String(shooter?.name || 'Jugador'),
      goalkeeperId:Number(goalkeeper?.id || 0),
      goalkeeperName:String(goalkeeper?.name || 'Portero'),
      scored,
      probability:Math.round(probability * 1000) / 1000
    });
  };
  let completedRounds = 0;
  let earlyFinish = false;
  for(let round=1; round<=5; round++){
    takeKick(firstClubId, round, false);
    takeKick(secondClubId, round, false);
    completedRounds = round;
    const remaining = 5 - round;
    if(scores[homeId] > scores[awayId] + remaining || scores[awayId] > scores[homeId] + remaining){
      earlyFinish = true;
      break;
    }
  }
  let suddenDeathRounds = 0;
  let forced = false;
  while(scores[homeId] === scores[awayId] && suddenDeathRounds < 50){
    suddenDeathRounds += 1;
    const round = 5 + suddenDeathRounds;
    takeKick(firstClubId, round, true);
    takeKick(secondClubId, round, true);
  }
  if(scores[homeId] === scores[awayId]){
    forced = true;
    suddenDeathRounds += 1;
    const round = 5 + suddenDeathRounds;
    const homeValue = penaltyShootoutPlayerValue(homePlayers[indexes[homeId] % homePlayers.length]);
    const awayValue = penaltyShootoutPlayerValue(awayPlayers[indexes[awayId] % awayPlayers.length]);
    const homeWins = homeValue === awayValue ? random() < 0.5 : homeValue > awayValue;
    takeKick(firstClubId, round, true, firstClubId === homeId ? homeWins : !homeWins);
    takeKick(secondClubId, round, true, secondClubId === homeId ? homeWins : !homeWins);
  }
  const winnerClubId = scores[homeId] > scores[awayId] ? homeId : awayId;
  return {
    home:Number(scores[homeId] || 0),
    away:Number(scores[awayId] || 0),
    homeKicks:Number(kickCounts[homeId] || 0),
    awayKicks:Number(kickCounts[awayId] || 0),
    firstClubId,
    winnerClubId,
    completedRounds,
    suddenDeathRounds,
    earlyFinish,
    forced,
    kicks
  };
}
function finalizeWinnerRequiredMatchResult(match, result, options={}){
  if(!match || !result) return result;
  const out = result === match ? { ...result } : { ...result };
  if(!competitionMatchRequiresWinner(match)) return out;
  const homeId = Number(match.homeId || out.homeId || 0);
  const awayId = Number(match.awayId || out.awayId || 0);
  const existingWinner = Number(out.winnerClubId || 0);
  if(existingWinner && [homeId, awayId].includes(existingWinner)){
    out.winnerRequiredResolved = true;
    return out;
  }
  const winnerBeforePenalties = competitionMatchWinnerBeforePenalties(match, out);
  if(winnerBeforePenalties){
    out.winnerClubId = winnerBeforePenalties;
    out.winnerRequiredResolved = true;
    return out;
  }
  const shootout = resolvePenaltyShootout(match, out, options);
  if(!shootout) return out;
  out.penaltyShootout = shootout;
  out.winnerClubId = Number(shootout.winnerClubId || (Number(shootout.home || 0) > Number(shootout.away || 0) ? homeId : awayId));
  out.winnerRequiredResolved = Boolean(out.winnerClubId);
  out.winnerRequiredReason = competitionAggregateScore(match, out) ? 'aggregate_tie' : 'match_tie';
  return out;
}
function penaltyShootoutWinnerText(match){
  const shootout = match?.penaltyShootout;
  if(!shootout || Number(shootout.home || 0) === Number(shootout.away || 0)) return '';
  const winnerId = Number(match.winnerClubId || shootout.winnerClubId || (Number(shootout.home || 0) > Number(shootout.away || 0) ? match.homeId : match.awayId));
  const winnerName = typeof clubName === 'function' ? clubName(winnerId) : `Equipo ${winnerId}`;
  return `${winnerName} gana ${Number(shootout.home || 0)}-${Number(shootout.away || 0)} por penales`;
}
