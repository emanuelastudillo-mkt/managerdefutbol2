/* V5.28 · Puente del simulador 2.0 y helpers compartidos de partido. */

function simulateMatch(match){
  if(window.Simulator20?.simulateMatch) return window.Simulator20.simulateMatch(match);
  throw new Error('Simulador 2.0 no disponible');
}
function pitchEffect(pitch){
  return PITCH_CONDITIONS[pitch] || PITCH_CONDITIONS.Normal;
}

/*
  El cálculo principal del partido vive en simulador-2.0.js.
  Este archivo conserva sólo los helpers globales que ese motor usa fuera de su IIFE:
  cambios, aplicación de resultados, estadísticas, sanciones, lesiones y limpieza de táctica.
*/
function makeSubstitutions(clubId, tactic, goals){
  if(clubId !== game.selectedClubId || !tactic?.autoSubs?.length) return [];
  const events = [];
  const onPitch = new Set((tactic.starters || []).map(Number));
  const alreadyIn = new Set();
  for(const rule of tactic.autoSubs){
    const outId = Number(rule.outId || 0);
    const inId = Number(rule.inId || 0);
    if(!outId || !inId || !onPitch.has(outId) || alreadyIn.has(inId) || !canEnterMatch(inId)) continue;
    const minute = Math.random() < 0.10 ? 45 : Math.floor(rnd(60,91));
    const score = scoreAtMinute(goals, minute, clubId);
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
function scoreAtMinute(goals, minute, clubId){
  let gf = 0, gc = 0;
  goals.filter(g => g.minute <= minute).forEach(g => { if(g.clubId === clubId) gf++; else gc++; });
  return { gf, gc };
}
function applyResultToTables(match, hg, ag){
  if(match?.playoff || match?.knockout) return;
  const h = game.standings[match.homeId];
  const a = game.standings[match.awayId];
  h.pj++; a.pj++;
  h.gf += hg; h.gc += ag; a.gf += ag; a.gc += hg;
  if(hg > ag){ h.pg++; a.pp++; h.pts += 3; }
  else if(hg < ag){ a.pg++; h.pp++; a.pts += 3; }
  else { h.pe++; a.pe++; h.pts++; a.pts++; }
  h.dg = h.gf - h.gc; a.dg = a.gf - a.gc;
}
function applyPlayerStats(clubId, lineup, substitutions, goals, cards, injuries, keySaves=[], errors=[]){
  const playedIds = new Set(lineup.map(p => p.id));
  substitutions.filter(s => s.clubId === clubId).forEach(s => playedIds.add(s.inId));
  playedIds.forEach(id => { if(game.playerStats[id]) game.playerStats[id].played++; });
  goals.filter(g=>g.clubId===clubId).forEach(g=>{
    game.playerStats[g.playerId].goals++;
    if(g.assistId) game.playerStats[g.assistId].assists++;
  });
  cards.filter(c=>c.clubId===clubId).forEach(c=>{
    if(c.type === 'yellow') game.playerStats[c.playerId].yellow++;
    if(c.type === 'secondYellowRed') { game.playerStats[c.playerId].yellow++; game.playerStats[c.playerId].red++; }
    if(c.type === 'red') game.playerStats[c.playerId].red++;
  });
  injuries.filter(i=>i.clubId===clubId).forEach(i=>{
    if(game.playerStats[i.playerId]) game.playerStats[i.playerId].injuries++;
  });
  keySaves.filter(s=>s.clubId===clubId).forEach(s=>{
    if(game.playerStats[s.playerId]) game.playerStats[s.playerId].keySaves = Number(game.playerStats[s.playerId].keySaves || 0) + 1;
  });
  errors.filter(e=>e.clubId===clubId).forEach(e=>{
    if(game.playerStats[e.playerId]){
      game.playerStats[e.playerId].errors = Number(game.playerStats[e.playerId].errors || 0) + 1;
      if(e.goal) game.playerStats[e.playerId].goalErrors = Number(game.playerStats[e.playerId].goalErrors || 0) + 1;
    }
  });
}
function applyAvailability(cards, injuries){
  cards.forEach(c => {
    if(c.type === 'red' || c.type === 'secondYellowRed'){
      game.playerStatus[c.playerId] = { ...playerStatus(c.playerId), suspendedThrough: game.matchdayIndex + 1 };
    }
  });
  injuries.forEach(i => {
    const label = i.injuryLabel || i.name || 'Lesión';
    const injuryDays = Math.max(1, Math.round(Number(i.matchesOut || 1)));
    game.playerStatus[i.playerId] = {
      ...playerStatus(i.playerId),
      injuredThrough: game.matchdayIndex + Math.max(1, Math.ceil(injuryDays / Math.max(1, LEAGUE_ROUND_INTERVAL_DAYS))),
      injuredUntilTurn: currentTurnIndex() + injuryDays,
      injuryLabel: label,
      injuryChance: i.chance,
      injuredAtMatchday: game.matchdayIndex,
      injuredAtTurn: currentTurnIndex()
    };
  });
}
function collectOwnProblems(result){
  if(!result) return [];
  const ownClub = game.selectedClubId;
  const injuries = (result.injuries || []).filter(i => i.clubId === ownClub).map(i => ({ type:'injury', playerId:i.playerId }));
  const reds = (result.cards || []).filter(c => c.clubId === ownClub && (c.type === 'red' || c.type === 'secondYellowRed')).map(c => ({ type:'red', playerId:c.playerId }));
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
    game.tactic = applyStarterMentalities({ ...game.tactic, starters, bench, autoSubs });
  }
}
