/* V3.43 · Motor alternativo de partido, eventos, lesiones, estadísticas y limpieza táctica. */

function simulateMatch(match){
  if(window.Simulator20?.simulateMatch) return window.Simulator20.simulateMatch(match);
  throw new Error('Simulador 2.0 no disponible');
}
function expectedGoals(attacking, defending, isHome, chances){
  const attackEdge = (attacking.attack - defending.defense) / 34;
  const midfieldEdge = (attacking.midfield - defending.midfield) / 70;
  const keeperEdge = (70 - defending.keeper) / 85;
  const repEdge = (attacking.reputation - defending.reputation) / 95;
  const home = isHome ? 0.22 : 0;
  const chanceFactor = (chances - 5) / 10;
  return clamp(1.02 + attackEdge + midfieldEdge + keeperEdge + repEdge + home + chanceFactor + rnd(-0.12,0.12), 0.12, 3.8);
}
function pitchEffect(pitch){
  return PITCH_CONDITIONS[pitch] || PITCH_CONDITIONS.Normal;
}
function makeMatchStats(home, away, context={pitch:'Normal'}){
  const effect = pitchEffect(context.pitch);
  const homeMid = clamp(home.midfield + effect.passDelta, 1, 120);
  const awayMid = clamp(away.midfield + effect.passDelta, 1, 120);
  const totalMid = Math.max(1, homeMid + awayMid);
  const homePoss = clamp(Math.round((homeMid / totalMid) * 100 + rnd(-5,5) + 2), 32, 68);
  const awayPoss = 100 - homePoss;
  const homeAttacks = clamp(Math.round(29 + home.attack/2.8 + homeMid/5 - away.defense/6 + rnd(-6,7)), 18, 68);
  const awayAttacks = clamp(Math.round(27 + away.attack/2.8 + awayMid/5 - home.defense/6 + rnd(-6,7)), 18, 68);
  const rawHomeChances = Math.round(homeAttacks * rnd(0.12,0.23) + (home.attack-away.defense)/17);
  const rawAwayChances = Math.round(awayAttacks * rnd(0.12,0.23) + (away.attack-home.defense)/17);
  const homeChances = clamp(Math.round(rawHomeChances * effect.chanceMultiplier), 1, 14);
  const awayChances = clamp(Math.round(rawAwayChances * effect.chanceMultiplier), 1, 14);
  const homeFouls = clamp(Math.round(7 + home.aggression/11 + (100-home.discipline)/16 + rnd(-3,4)), 4, 27);
  const awayFouls = clamp(Math.round(7 + away.aggression/11 + (100-away.discipline)/16 + rnd(-3,4)), 4, 27);
  return {
    home: { attacks:homeAttacks, chances:homeChances, possession:homePoss, fouls:homeFouls, passScore:Math.round(homeMid) },
    away: { attacks:awayAttacks, chances:awayChances, possession:awayPoss, fouls:awayFouls, passScore:Math.round(awayMid) }
  };
}
function makeMatchContext(match, home, away){
  const weatherOptions = ['Soleado', 'Nublado', 'Lluvia leve', 'Lluvia intensa', 'Viento moderado', 'Calor húmedo'];
  const weather = weatherOptions[hashNumber(`${match.id}-weather-${game?.matchdayIndex || 0}`, weatherOptions.length)];
  const homeClub = seed.clubs.find(c=>c.id===match.homeId);
  const awayClub = seed.clubs.find(c=>c.id===match.awayId);
  const pitchScore = fieldScoreForClub(match.homeId);
  const pitch = fieldConditionName(pitchScore);
  const effect = pitchEffect(pitch);
  const attendance = typeof attendanceContextForMatch === 'function'
    ? attendanceContextForMatch(match)
    : { homeFans:Math.max(800, Math.round((homeClub?.reputation || 60) * rnd(210,360))), awayFans:Math.max(120, Math.round((awayClub?.reputation || 60) * rnd(18,70))), totalFans:0, capacity:0, homeCrowdBonus:0, ticketPrice:0, ticketRevenue:0 };
  return { weather, pitch, pitchScore, ...attendance, pitchEffect:effect };
}
function poisson(lambda){
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= Math.random(); } while (p > L);
  return clamp(k - 1, 0, 7);
}
function weightedPick(items, weightFn){
  const safeItems = items.filter(Boolean);
  const weighted = safeItems.map(item=>({item, w:Math.max(1, weightFn(item))}));
  const total = weighted.reduce((a,x)=>a+x.w,0);
  let r = Math.random()*total;
  for(const x of weighted){ r -= x.w; if(r<=0) return x.item; }
  return weighted[0]?.item;
}
function scorerWeight(player){
  if(!player) return 1;
  if(player.position === 'POR') return 0.35;
  const posBonus = player.position === 'DC' ? 125 : ['ED','EI'].includes(player.position) ? 88 : player.position === 'MCO' ? 58 : player.position === 'MC' ? 22 : player.position === 'MCD' ? 10 : 5;
  return effectiveSkill(player,'remate') * 1.35 + effectiveSkill(player,'posicionamiento') * 1.15 + effectiveSkill(player,'serenidad') * 0.45 + posBonus;
}
function cardWeight(player){
  if(!player) return 1;
  if(player.position === 'POR') return 0.35;
  const roleBonus = ['DFC','MCD'].includes(player.position) ? 30 : ['LD','LI'].includes(player.position) ? 20 : player.position === 'MC' ? 12 : 6;
  return hiddenStats(player).aggression * 0.75 + (100 - effectiveSkill(player,'disciplina')) * 0.30 + roleBonus;
}
function makeGoal(clubId, lineup){
  const outfield = (lineup || []).filter(p => p.position !== 'POR');
  const scorerPool = outfield.length ? outfield : lineup;
  const scorer = weightedPick(scorerPool, scorerWeight);
  const possibleAssisters = lineup.filter(p=>p.id !== scorer.id);
  const hasAssist = Math.random() < 0.72;
  const assister = hasAssist ? weightedPick(possibleAssisters, p => p.position === 'POR' ? 0.75 : effectiveSkill(p,'paseCorto') + effectiveSkill(p,'vision') + (['ED','EI','MCO','MC'].includes(p.position)?25:5)) : null;
  return { clubId, playerId:scorer.id, assistId:assister?.id || null, minute: Math.floor(rnd(2,91)) };
}
function makeCards(clubId, power, fouls){
  const cards = [];
  const yellowCount = clamp(poisson(fouls / 7.6), 0, 6);
  const byPlayer = new Map();
  for(let i=0;i<yellowCount;i++){
    const p = weightedPick(power.lineup, cardWeight);
    if(!p) continue;
    const current = byPlayer.get(p.id) || 0;
    byPlayer.set(p.id, current + 1);
    if(current === 0) cards.push({ clubId, playerId:p.id, type:'yellow', minute:Math.floor(rnd(5,88)) });
    else cards.push({ clubId, playerId:p.id, type:'secondYellowRed', minute:Math.floor(rnd(35,90)) });
  }
  const directRedCandidates = power.lineup.filter(p => p.position !== 'POR' && hiddenStats(p).aggression >= 76);
  const directChance = clamp((power.aggression - 60) / 290, 0.005, 0.13);
  if(directRedCandidates.length && Math.random() < directChance){
    const p = weightedPick(directRedCandidates, cardWeight);
    cards.push({ clubId, playerId:p.id, type:'red', minute:Math.floor(rnd(20,90)) });
  }
  return cards.sort((a,b)=>a.minute-b.minute);
}
function makeInjuries(clubId, ownPower, rivalPower, context={pitch:'Normal'}){
  const injuries = [];
  const candidates = (ownPower.lineup || []).filter(player => !isUnavailable(player.id));
  candidates.forEach(player => {
    const chance = injuryChanceForPlayer(player.id, context.pitch);
    if(Math.random() < chance){
      const injury = pickInjuryType();
      const matchesOut = Math.floor(rnd(injury.minTurns, injury.maxTurns + 1));
      const duringMatch = Math.random() < 0.72;
      injuries.push({
        clubId,
        playerId:player.id,
        type:'injury',
        name:injury.name,
        injuryLabel:injury.name,
        probability:injury.probability,
        chance:Math.round(chance * 100),
        matchesOut,
        minute:duringMatch ? Math.floor(rnd(8,89)) : 90,
        phase:duringMatch ? 'durante' : 'final'
      });
    }
  });
  return injuries.sort((a,b)=>a.minute-b.minute);
}
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
