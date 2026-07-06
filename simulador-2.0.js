/* Motor de simulación V2.0
   Archivo dedicado a la simulación de partidos y a los factores deportivos que influyen en el resultado.
   Mantiene valores internos ocultos fuera de la interfaz. */
(function(){
  const MATCH_INSTRUCTION_OPTIONS = [
    { value:'lower', label:'Bajar el ritmo' },
    { value:'normal', label:'Normal' },
    { value:'push', label:'Subir ritmo' }
  ];
  const DEFAULT_MATCH_INSTRUCTIONS = { winning:'normal', drawing:'normal', losing:'normal' };
  const INSTRUCTION_EFFECTS = {
    lower:{ attack:0.92, midfield:0.96, defense:1.04, attacks:0.90, conversion:0.94, foul:0.88 },
    normal:{ attack:1.00, midfield:1.00, defense:1.00, attacks:1.00, conversion:1.00, foul:1.00 },
    push:{ attack:1.09, midfield:1.03, defense:0.95, attacks:1.12, conversion:1.06, foul:1.10 }
  };
  const BLOCKS = Array.from({ length:30 }, (_, index) => ({
    from:index * 3 + 1,
    to:index === 29 ? 90 : index * 3 + 3
  }));
  const SIM_PITCH_CONDITIONS = {
    'Excelente': { passDelta:10, chanceMultiplier:1.20, fatigueBonus:0, injuryBonus:0 },
    'Normal': { passDelta:0, chanceMultiplier:1.00, fatigueBonus:0, injuryBonus:0 },
    'Regular': { passDelta:-10, chanceMultiplier:0.80, fatigueBonus:0, injuryBonus:0 },
    'Muy malo': { passDelta:-20, chanceMultiplier:0.70, fatigueBonus:10, injuryBonus:0.10 },
    'Injugable': { passDelta:-50, chanceMultiplier:0.50, fatigueBonus:20, injuryBonus:0.30 }
  };

  function simClamp(value,min,max){ return Math.max(min, Math.min(max, value)); }
  function simAvg(values){ const clean = values.filter(v => Number.isFinite(v)); return clean.length ? clean.reduce((a,b)=>a+b,0)/clean.length : 0; }
  function simRnd(min,max){ return min + Math.random() * (max-min); }
  function probabilisticRoundV2(value){
    const safe = Math.max(0, Number(value) || 0);
    const base = Math.floor(safe);
    return base + (Math.random() < safe - base ? 1 : 0);
  }
  function blockDurationFactor(block){
    return simClamp(((Number(block?.to || 0) - Number(block?.from || 0) + 1) || 15) / 15, 0.05, 1);
  }
  function normalizeMatchInstructions(instructions){
    const src = instructions || {};
    const valid = new Set(MATCH_INSTRUCTION_OPTIONS.map(o=>o.value));
    return {
      winning: valid.has(src.winning) ? src.winning : DEFAULT_MATCH_INSTRUCTIONS.winning,
      drawing: valid.has(src.drawing) ? src.drawing : DEFAULT_MATCH_INSTRUCTIONS.drawing,
      losing: valid.has(src.losing) ? src.losing : DEFAULT_MATCH_INSTRUCTIONS.losing
    };
  }
  function pitchEffectV2(pitch){ return SIM_PITCH_CONDITIONS[pitch] || SIM_PITCH_CONDITIONS.Normal; }
  function getTacticForClubV2(clubId){
    if(clubId === game.selectedClubId) return { ...game.tactic, matchInstructions:normalizeMatchInstructions(game.tactic?.matchInstructions) };
    const club = seed.clubs.find(c=>c.id===clubId) || { reputation:60 };
    const formation = club.reputation > 74 ? '4-3-3' : club.reputation < 61 ? '5-4-1' : '4-4-2';
    return { formation, starters:[], bench:[], autoSubs:[], playerMentalities:{}, matchInstructions:{...DEFAULT_MATCH_INSTRUCTIONS} };
  }
  function instructionForScore(tactic, gf, gc){
    const instructions = normalizeMatchInstructions(tactic?.matchInstructions);
    if(gf > gc) return instructions.winning;
    if(gf < gc) return instructions.losing;
    return instructions.drawing;
  }
  function formationProfile(assigned){
    const counts = { gk:0, def:0, mid:0, att:0 };
    (assigned || []).forEach(a => { const g = slotGroup(a.slot); if(counts[g] !== undefined) counts[g]++; });
    const profile = { defense:0, midfield:0, attack:0, possession:0, attacks:0, conversion:0 };
    if(counts.def >= 5){ profile.defense += 5; profile.attack -= 3; profile.attacks -= 1; }
    if(counts.def <= 3){ profile.defense -= 3; profile.attack += 2; profile.attacks += 1; }
    if(counts.mid >= 5){ profile.midfield += 5; profile.possession += 4; profile.attacks += 2; }
    if(counts.mid <= 3){ profile.midfield -= 2; profile.possession -= 2; }
    if(counts.att >= 3){ profile.attack += 5; profile.conversion += 0.035; profile.defense -= 2; }
    if(counts.att <= 1){ profile.attack -= 3; profile.conversion -= 0.025; profile.defense += 2; }
    return { counts, profile };
  }
  function lineAverage(assigned, group, skillGroups){
    const items = assigned.filter(a => slotGroup(a.slot) === group);
    return simAvg(items.map(a => simAvg(skillGroups.map(skill => matchSkill(a.player, skill))) * a.factor));
  }
  function teamPowerV2(clubId, tactic){
    const formation = tactic?.formation || '4-4-2';
    const lineup = selectLineup(clubId, tactic);
    const slots = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    const assigned = lineup.map((player, i) => ({ player, slot:slots[i] || player.position, factor:zoneFactor(player, slots[i] || player.position) }));
    const { counts, profile } = formationProfile(assigned);
    const gk = assigned.find(a => a.slot === 'POR');
    const defenseQuality = lineAverage(assigned, 'def', ['marca','entradas','posicionamiento','fuerza']);
    const midfieldQuality = lineAverage(assigned, 'mid', ['paseCorto','vision','tecnica','trabajoEquipo']);
    const attackQuality = lineAverage(assigned, 'att', ['remate','regate','velocidad','serenidad','posicionamiento']);
    const keeperQuality = gk ? simAvg(['porteria','posicionamiento','serenidad'].map(skill => matchSkill(gk.player, skill) * gk.factor)) : 38;
    const adjust = applyMentalityBonus(tactic || {}, assigned);
    const cohesion = cohesionMultiplier(clubId);
    const teamMorale = simClamp(0.94 + (squadMoraleAverage(clubId) / 99) * 0.12, 0.94, 1.06);
    const countBoost = {
      defense: counts.def * 1.25,
      midfield: counts.mid * 1.35,
      attack: counts.att * 1.55
    };
    const defense = (defenseQuality + countBoost.defense + profile.defense + adjust.defense + keeperQuality * 0.12) * cohesion * teamMorale;
    const midfield = (midfieldQuality + countBoost.midfield + profile.midfield + adjust.midfield) * cohesion * teamMorale;
    const attack = (attackQuality + countBoost.attack + profile.attack + adjust.attack) * cohesion * teamMorale;
    const discipline = simAvg(lineup.map(p=>p.skills.disciplina));
    const stamina = simAvg(lineup.map(p=>matchSkill(p,'resistencia'))) * cohesion * teamMorale;
    const aggression = simAvg(lineup.map(p=>hiddenStats(p).aggression));
    const rep = seed.clubs.find(c=>c.id===clubId)?.reputation || 60;
    return {
      clubId, tactic, formation, lineup, assigned, counts, profile:profile,
      defense, midfield, attack, keeper:keeperQuality * cohesion * teamMorale,
      defenseQuality, midfieldQuality, attackQuality, keeperQuality,
      discipline, stamina, aggression, reputation:rep
    };
  }
  function makeMatchContextV2(match){
    const weatherOptions = ['Soleado', 'Nublado', 'Lluvia leve', 'Lluvia intensa', 'Viento moderado', 'Calor húmedo'];
    const weather = weatherOptions[hashNumber(`${match.id}-weather-${game?.matchdayIndex || 0}`, weatherOptions.length)];
    const homeClub = seed.clubs.find(c=>c.id===match.homeId);
    const awayClub = seed.clubs.find(c=>c.id===match.awayId);
    const pitchScore = fieldScoreForClub(match.homeId);
    const pitch = fieldConditionName(pitchScore);
    const effect = pitchEffectV2(pitch);
    const homeFans = Math.max(800, Math.round((homeClub?.reputation || 60) * simRnd(210,360)));
    const awayFans = Math.max(120, Math.round((awayClub?.reputation || 60) * simRnd(18,70)));
    return { weather, pitch, pitchScore, homeFans, awayFans, pitchEffect:effect };
  }
  function blockStatsForTeam(own, rival, context, ownInstruction, rivalInstruction, isHome, block=null){
    const effect = pitchEffectV2(context.pitch);
    const phaseFactor = blockDurationFactor(block);
    const ownInstr = INSTRUCTION_EFFECTS[ownInstruction] || INSTRUCTION_EFFECTS.normal;
    const rivalInstr = INSTRUCTION_EFFECTS[rivalInstruction] || INSTRUCTION_EFFECTS.normal;
    const pitchPass = effect.passDelta;
    const pitchChance = effect.chanceMultiplier;
    const effectiveMid = simClamp((own.midfield * ownInstr.midfield) + pitchPass + own.profile.possession, 1, 140);
    const rivalMid = simClamp((rival.midfield * rivalInstr.midfield) + pitchPass + rival.profile.possession, 1, 140);
    const possession = simClamp(Math.round((effectiveMid / Math.max(1, effectiveMid + rivalMid)) * 100 + (isHome ? 2 : -1) + simRnd(-4,4)), 28, 72);
    const midfieldAttack = effectiveMid / 17;
    const attackPressure = (own.attack * ownInstr.attack) / 22;
    const defenseBrake = (rival.defense * rivalInstr.defense) / 34;
    const baseAttacks = 3.5 + midfieldAttack + attackPressure - defenseBrake + own.profile.attacks + (possession - 50) / 12 + (isHome ? 0.6 : 0) + simRnd(-1.6,1.9);
    const fullBlockAttacks = simClamp(baseAttacks * ownInstr.attacks, 0, 13);
    const attacks = simClamp(probabilisticRoundV2(fullBlockAttacks * phaseFactor), 0, 5);
    const forwardCount = Math.max(1, own.counts.att || 1);
    const defenderCount = Math.max(1, rival.counts.def || 1);
    const conversion = simClamp(
      0.105 + (own.attackQuality / 620) + forwardCount * 0.016 + own.profile.conversion - (rival.defenseQuality / 820) - defenderCount * 0.009 - (rival.keeperQuality / 1050),
      0.045,
      0.32
    ) * ownInstr.conversion * pitchChance;
    const fullBlockChances = Math.max(0, fullBlockAttacks * conversion + (own.attack - rival.defense) / 58 + simRnd(-0.35,0.45));
    const chances = simClamp(probabilisticRoundV2(fullBlockChances * phaseFactor), 0, 3);
    const xgPerChance = simClamp(0.14 + (own.attackQuality - rival.keeperQuality) / 650 + forwardCount * 0.018 - defenderCount * 0.009, 0.07, 0.38);
    const xg = simClamp(chances * xgPerChance + (fullBlockAttacks > 8 ? 0.04 * phaseFactor : 0) + (isHome ? 0.03 * phaseFactor : 0), 0, 0.55);
    const fullBlockFouls = Math.max(0, 1.1 + own.aggression/46 + (100-own.discipline)/62 + (ownInstruction === 'push' ? 0.55 : ownInstruction === 'lower' ? -0.35 : 0) + simRnd(-0.7,0.9));
    const fouls = simClamp(probabilisticRoundV2(fullBlockFouls * phaseFactor), 0, 3);
    return { attacks, chances, possession, fouls, passScore:Math.round(effectiveMid), xg };
  }
  function mergeBlockStats(total, block){
    total.attacks += block.attacks;
    total.chances += block.chances;
    total.fouls += block.fouls;
    total.xg += block.xg;
    total.passScore += block.passScore;
    total.possessionWeighted += block.possession;
  }
  function emptyStats(){ return { attacks:0, chances:0, possession:50, fouls:0, passScore:0, xg:0, possessionWeighted:0 }; }
  function finalizeStats(stats){
    return {
      attacks:simClamp(Math.round(stats.attacks), 1, 75),
      chances:simClamp(Math.round(stats.chances), 0, 18),
      possession:simClamp(Math.round(stats.possessionWeighted / BLOCKS.length), 20, 80),
      fouls:simClamp(Math.round(stats.fouls), 0, 32),
      passScore:simClamp(Math.round(stats.passScore / BLOCKS.length), 1, 140),
      xg:Number(stats.xg.toFixed(2))
    };
  }
  function poissonV2(lambda){
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return simClamp(k - 1, 0, 7);
  }
  function weightedPickV2(items, weightFn){
    const safeItems = (items || []).filter(Boolean);
    const weighted = safeItems.map(item=>({item, w:Math.max(1, weightFn(item))}));
    const total = weighted.reduce((a,x)=>a+x.w,0);
    let r = Math.random()*total;
    for(const x of weighted){ r -= x.w; if(r<=0) return x.item; }
    return weighted[0]?.item;
  }
  function scorerWeightV2(player){
    if(!player) return 1;
    if(player.position === 'POR') return 0.35;
    const posBonus = player.position === 'DC' ? 125 : ['ED','EI'].includes(player.position) ? 88 : player.position === 'MCO' ? 58 : player.position === 'MC' ? 22 : player.position === 'MCD' ? 10 : 5;
    return effectiveSkill(player,'remate') * 1.35 + effectiveSkill(player,'posicionamiento') * 1.15 + effectiveSkill(player,'serenidad') * 0.45 + currentMorale(player.id) * 0.20 + posBonus;
  }
  function cardWeightV2(player){
    if(!player) return 1;
    if(player.position === 'POR') return 0.35;
    const roleBonus = ['DFC','MCD'].includes(player.position) ? 30 : ['LD','LI'].includes(player.position) ? 20 : player.position === 'MC' ? 12 : 6;
    return hiddenStats(player).aggression * 0.75 + (100 - effectiveSkill(player,'disciplina')) * 0.30 + roleBonus;
  }
  function makeGoalV2(clubId, lineup, minute){
    const outfield = (lineup || []).filter(p => p.position !== 'POR');
    const scorerPool = outfield.length ? outfield : lineup;
    const scorer = weightedPickV2(scorerPool, scorerWeightV2);
    const possibleAssisters = lineup.filter(p=>p.id !== scorer?.id);
    const hasAssist = Math.random() < 0.72;
    const assister = hasAssist ? weightedPickV2(possibleAssisters, p => p.position === 'POR' ? 0.75 : effectiveSkill(p,'paseCorto') + effectiveSkill(p,'vision') + (['ED','EI','MCO','MC'].includes(p.position)?25:5)) : null;
    return { clubId, playerId:scorer.id, assistId:assister?.id || null, minute };
  }
  function makeCardsV2(clubId, power, fouls){
    const cards = [];
    const yellowCount = simClamp(poissonV2(fouls / 7.6), 0, 6);
    const byPlayer = new Map();
    for(let i=0;i<yellowCount;i++){
      const p = weightedPickV2(power.lineup, cardWeightV2);
      if(!p) continue;
      const current = byPlayer.get(p.id) || 0;
      byPlayer.set(p.id, current + 1);
      if(current === 0) cards.push({ clubId, playerId:p.id, type:'yellow', minute:Math.floor(simRnd(5,88)) });
      else cards.push({ clubId, playerId:p.id, type:'secondYellowRed', minute:Math.floor(simRnd(35,90)) });
    }
    const directRedCandidates = power.lineup.filter(p => p.position !== 'POR' && hiddenStats(p).aggression >= 76);
    const directChance = simClamp((power.aggression - 60) / 290, 0.005, 0.13);
    if(directRedCandidates.length && Math.random() < directChance){
      const p = weightedPickV2(directRedCandidates, cardWeightV2);
      cards.push({ clubId, playerId:p.id, type:'red', minute:Math.floor(simRnd(20,90)) });
    }
    return cards.sort((a,b)=>a.minute-b.minute);
  }
  function makeInjuriesV2(clubId, ownPower, context){
    const injuries = [];
    const candidates = (ownPower.lineup || []).filter(player => !isUnavailable(player.id));
    candidates.forEach(player => {
      const chance = injuryChanceForPlayer(player.id, context.pitch);
      if(Math.random() < chance){
        const injury = pickInjuryType();
        const matchesOut = Math.floor(simRnd(injury.minTurns, injury.maxTurns + 1));
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
          minute:duringMatch ? Math.floor(simRnd(8,89)) : 90,
          phase:duringMatch ? 'durante' : 'final'
        });
      }
    });
    return injuries.sort((a,b)=>a.minute-b.minute);
  }
  function finalResultKey(gf, gc){
    if(gf > gc) return 'winning';
    if(gf < gc) return 'losing';
    return 'drawing';
  }
  function instructionConditionDelta(tactic, gf, gc, starterIds){
    const instructions = normalizeMatchInstructions(tactic?.matchInstructions);
    const state = finalResultKey(gf, gc);
    const selected = instructions[state];
    let delta = 0;
    if(state === 'winning' && selected === 'lower') delta = 2;
    if(state === 'winning' && selected === 'push') delta = -5;
    if(state === 'drawing' && selected === 'lower') delta = 1;
    if(state === 'drawing' && selected === 'push') delta = -1;
    if(state === 'losing' && selected === 'lower') delta = 5;
    if(state === 'losing' && selected === 'push') delta = -5;
    const result = {};
    if(delta !== 0) (starterIds || []).forEach(id => result[id] = delta);
    return result;
  }
  function mergeConditionDeltas(...objects){
    const merged = {};
    objects.forEach(obj => Object.entries(obj || {}).forEach(([id, delta]) => { merged[id] = (merged[id] || 0) + delta; }));
    return merged;
  }
  function simulateMatch(match){
    const homeTactic = getTacticForClubV2(match.homeId);
    const awayTactic = getTacticForClubV2(match.awayId);
    applyTacticCohesionPenalty(match.homeId, homeTactic);
    applyTacticCohesionPenalty(match.awayId, awayTactic);
    const home = teamPowerV2(match.homeId, homeTactic);
    const away = teamPowerV2(match.awayId, awayTactic);
    const matchContext = makeMatchContextV2(match);
    const homeTotals = emptyStats();
    const awayTotals = emptyStats();
    const goals = [];
    let homeGoals = 0;
    let awayGoals = 0;
    for(const block of BLOCKS){
      const homeInstruction = instructionForScore(homeTactic, homeGoals, awayGoals);
      const awayInstruction = instructionForScore(awayTactic, awayGoals, homeGoals);
      const h = blockStatsForTeam(home, away, matchContext, homeInstruction, awayInstruction, true, block);
      const a = blockStatsForTeam(away, home, matchContext, awayInstruction, homeInstruction, false, block);
      mergeBlockStats(homeTotals, h);
      mergeBlockStats(awayTotals, a);
      const hGoals = Math.min(poissonV2(h.xg), h.chances);
      const aGoals = Math.min(poissonV2(a.xg), a.chances);
      for(let i=0;i<hGoals;i++) goals.push(makeGoalV2(match.homeId, home.lineup, Math.floor(simRnd(block.from, block.to + 1))));
      for(let i=0;i<aGoals;i++) goals.push(makeGoalV2(match.awayId, away.lineup, Math.floor(simRnd(block.from, block.to + 1))));
      homeGoals += hGoals;
      awayGoals += aGoals;
    }
    goals.sort((a,b)=>a.minute-b.minute);
    const matchStats = { home:finalizeStats(homeTotals), away:finalizeStats(awayTotals) };
    matchStats.away.possession = 100 - matchStats.home.possession;
    const cards = [...makeCardsV2(match.homeId, home, matchStats.home.fouls), ...makeCardsV2(match.awayId, away, matchStats.away.fouls)].sort((a,b)=>a.minute-b.minute);
    const injuries = [...makeInjuriesV2(match.homeId, home, matchContext), ...makeInjuriesV2(match.awayId, away, matchContext)].sort((a,b)=>a.minute-b.minute);
    const regularSubs = [
      ...makeSubstitutions(match.homeId, homeTactic, goals),
      ...makeSubstitutions(match.awayId, awayTactic, goals)
    ];
    const injurySubs = [
      ...makeInjurySubstitutions(match.homeId, homeTactic, injuries, regularSubs),
      ...makeInjurySubstitutions(match.awayId, awayTactic, injuries, regularSubs)
    ];
    const substitutions = [...regularSubs, ...injurySubs].sort((a,b)=>a.minute-b.minute);
    if(!match.friendly){
      applyMatchCohesionResult(match, substitutions, cards);
      applyResultToTables(match, homeGoals, awayGoals);
      applyPlayerStats(match.homeId, home.lineup, substitutions, goals, cards, injuries);
      applyPlayerStats(match.awayId, away.lineup, substitutions, goals, cards, injuries);
      applyAvailability(cards, injuries);
    }
    const starterIdsHome = home.lineup.map(p=>p.id);
    const starterIdsAway = away.lineup.map(p=>p.id);
    const playedIdsHome = [...new Set(starterIdsHome.concat(substitutions.filter(s=>s.clubId===match.homeId).map(s=>s.inId)))];
    const playedIdsAway = [...new Set(starterIdsAway.concat(substitutions.filter(s=>s.clubId===match.awayId).map(s=>s.inId)))];
    const instructionConditionDeltas = mergeConditionDeltas(
      instructionConditionDelta(homeTactic, homeGoals, awayGoals, starterIdsHome),
      instructionConditionDelta(awayTactic, awayGoals, homeGoals, starterIdsAway)
    );
    return { ...match, played:true, engine:'simulador-2.0', starterIdsHome, starterIdsAway, homeGoals, awayGoals, goals, cards, injuries, substitutions, matchStats, matchContext, playedIdsHome, playedIdsAway, instructionConditionDeltas };
  }

  window.MATCH_INSTRUCTION_OPTIONS = MATCH_INSTRUCTION_OPTIONS;
  window.DEFAULT_MATCH_INSTRUCTIONS = DEFAULT_MATCH_INSTRUCTIONS;
  window.Simulator20 = { simulateMatch, pitchEffect:pitchEffectV2, normalizeMatchInstructions };
})();
