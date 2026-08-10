/*
 * Simulador local determinista para amistosos online.
 * No lee ni modifica el estado global de la carrera.
 */
(function challengeSimulatorModule(global){
  'use strict';

  const VERSION = 'challenge-sim-v1';
  const clampValue = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
  const round = value => Math.round(Number(value) || 0);
  const HIGH_SCORE_RULES = (() => {
    const raw = window?.GAME_CONFIG?.simulador?.penalizacionGolesAltos?.tramos;
    const fallback = [
      { golesTotalesDesde:1, penalizacion:0.10 },
      { golesTotalesDesde:6, penalizacion:0.40 },
      { golesTotalesDesde:7, penalizacion:0.50 },
      { golesTotalesDesde:8, penalizacion:0.60 },
      { golesTotalesDesde:9, penalizacion:0.70 },
      { golesTotalesDesde:10, penalizacion:0.80 },
      { golesTotalesDesde:11, penalizacion:0.90 },
      { golesTotalesDesde:12, penalizacion:0.95 }
    ];
    return (Array.isArray(raw) ? raw : fallback).map(rule => ({
      goalsFrom:Math.max(1, Math.round(Number(rule?.golesTotalesDesde ?? rule?.goalsFrom ?? 0) || 0)),
      penalty:clampValue(Number(rule?.penalizacion ?? rule?.penalty ?? 0), 0, 0.99)
    })).filter(rule => rule.goalsFrom > 0 && rule.penalty > 0).sort((a,b) => a.goalsFrom - b.goalsFrom);
  })();
  const CARD_RATE_MULTIPLIER = clampValue(window?.GAME_CONFIG?.simulador?.multiplicadorTarjetas ?? 0.70, 0, 2);
  const DIRECT_RED_RATE_MULTIPLIER = clampValue(window?.GAME_CONFIG?.simulador?.multiplicadorRojasDirectas ?? 0.55, 0, 2);
  const HIGH_CARD_PENALTY_ENABLED = window?.GAME_CONFIG?.simulador?.penalizacionTarjetasAltas?.activo !== false;
  function normalizeCardPenaltyRules(path, fallback){
    const raw = path === 'yellow'
      ? window?.GAME_CONFIG?.simulador?.penalizacionTarjetasAltas?.amarillas
      : window?.GAME_CONFIG?.simulador?.penalizacionTarjetasAltas?.rojasDirectas;
    return (Array.isArray(raw) ? raw : fallback).map(rule => ({
      cardsFrom:Math.max(1, Math.round(Number(rule?.tarjetasTotalesDesde ?? rule?.cardsFrom ?? 0) || 0)),
      penalty:clampValue(Number(rule?.penalizacion ?? rule?.penalty ?? 0), 0, 0.99)
    })).filter(rule => rule.cardsFrom > 0 && rule.penalty > 0).sort((a,b)=>a.cardsFrom-b.cardsFrom);
  }
  const HIGH_YELLOW_RULES = normalizeCardPenaltyRules('yellow', [
    { tarjetasTotalesDesde:6, penalizacion:0.30 }, { tarjetasTotalesDesde:7, penalizacion:0.40 },
    { tarjetasTotalesDesde:8, penalizacion:0.50 }, { tarjetasTotalesDesde:9, penalizacion:0.80 }
  ]);
  const HIGH_DIRECT_RED_RULES = normalizeCardPenaltyRules('red', [
    { tarjetasTotalesDesde:2, penalizacion:0.40 }, { tarjetasTotalesDesde:3, penalizacion:0.50 },
    { tarjetasTotalesDesde:4, penalizacion:0.60 }, { tarjetasTotalesDesde:5, penalizacion:0.90 }
  ]);
  function cardPenaltyForNext(currentCount, rules){
    if(!HIGH_CARD_PENALTY_ENABLED) return 0;
    const nextTotal = Math.max(0, Math.round(Number(currentCount || 0))) + 1;
    let penalty = 0;
    rules.forEach(rule => { if(nextTotal >= rule.cardsFrom) penalty = Math.max(penalty, rule.penalty); });
    return clampValue(penalty, 0, 0.99);
  }
  function applyCardVolumePenalty(cards, random){
    const accepted = [];
    let yellows = 0;
    let directReds = 0;
    (cards || []).slice().sort((a,b)=>a.minute-b.minute).forEach(card => {
      const isYellow = card.type === 'yellow';
      const isDirectRed = card.type === 'red';
      const penalty = isYellow ? cardPenaltyForNext(yellows, HIGH_YELLOW_RULES) : (isDirectRed ? cardPenaltyForNext(directReds, HIGH_DIRECT_RED_RULES) : 0);
      if(penalty > 0 && random() < penalty) return;
      accepted.push(card);
      if(isYellow) yellows += 1;
      if(isDirectRed) directReds += 1;
    });
    return accepted;
  }
  function highScorePenaltyForNextGoal(currentTotalGoals){
    if(window?.GAME_CONFIG?.simulador?.penalizacionGolesAltos?.activo === false) return 0;
    const nextTotal = Math.max(0, Math.round(Number(currentTotalGoals || 0))) + 1;
    let penalty = 0;
    HIGH_SCORE_RULES.forEach(rule => { if(nextTotal >= rule.goalsFrom) penalty = Math.max(penalty, rule.penalty); });
    return clampValue(penalty, 0, 0.99);
  }
  function applyHighScorePenalty(homeGoals, awayGoals, random){
    const candidates = [];
    for(let i=0;i<Math.max(0, Math.round(Number(homeGoals || 0)));i++) candidates.push({ side:'home', order:random() });
    for(let i=0;i<Math.max(0, Math.round(Number(awayGoals || 0)));i++) candidates.push({ side:'away', order:random() });
    candidates.sort((a,b) => a.order - b.order);
    let home = 0, away = 0, total = 0;
    candidates.forEach(candidate => {
      const penalty = highScorePenaltyForNextGoal(total);
      if(penalty > 0 && random() < penalty) return;
      if(candidate.side === 'home') home += 1; else away += 1;
      total += 1;
    });
    return { homeGoals:home, awayGoals:away };
  }

  function seedNumber(text){
    let hash = 2166136261;
    const source = String(text || 'challenge');
    for(let i=0; i<source.length; i+=1){
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function createRandom(seedText){
    let state = seedNumber(seedText);
    return function random(){
      state += 0x6D2B79F5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
  }

  function average(values, fallback=0){
    const clean = (values || []).map(Number).filter(Number.isFinite);
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : fallback;
  }

  function playerOverall(player){
    return clampValue(player?.overall ?? player?.visibleOverall ?? 50, 1, 99);
  }

  function playerSkill(player, key, fallback=null){
    const skills = player?.skills || {};
    const aliases = {
      attack:['attack','ataque','Ataque'],
      defense:['defense','defensa','Defensa'],
      passing:['passing','pase','Pase'],
      speed:['speed','velocidad','Velocidad'],
      heading:['heading','cabezazo','Cabezazo'],
      shooting:['shooting','tiro','Tiro'],
      stamina:['stamina','resistencia','Resistencia'],
      leadership:['leadership','liderazgo'],
      serenity:['serenity','serenidad'],
      discipline:['discipline','disciplina'],
      teamwork:['teamwork','trabajoEquipo','trabajo_equipo'],
      goalkeeping:['goalkeeping','porteria','Defensa']
    };
    const names = aliases[key] || [key];
    for(const name of names){
      const value = Number(skills[name]);
      if(Number.isFinite(value)) return clampValue(value, 1, 99);
    }
    return fallback === null ? playerOverall(player) : clampValue(fallback, 1, 99);
  }

  function conditionFactor(player){
    const form = clampValue(player?.form ?? 99, 0, 99);
    const morale = clampValue(player?.morale ?? 50, 1, 99);
    return clampValue(0.55 + form / 220 + morale / 500, 0.55, 1.18);
  }

  function lineForPosition(position){
    const pos = String(position || '').toUpperCase();
    if(pos === 'POR') return 'goalkeeper';
    if(['DFC','LI','LD'].includes(pos)) return 'defense';
    if(['MCD','MC','MCO','MI','MD'].includes(pos)) return 'midfield';
    return 'attack';
  }

  function playerMatchStrength(player){
    const line = lineForPosition(player?.tacticalRole || player?.position);
    let base;
    if(line === 'goalkeeper'){
      base = playerSkill(player, 'goalkeeping') * 0.55 + playerSkill(player, 'serenity') * 0.15 + playerSkill(player, 'leadership') * 0.10 + playerOverall(player) * 0.20;
    }else if(line === 'defense'){
      base = playerSkill(player, 'defense') * 0.50 + playerSkill(player, 'speed') * 0.14 + playerSkill(player, 'heading') * 0.12 + playerSkill(player, 'passing') * 0.10 + playerOverall(player) * 0.14;
    }else if(line === 'midfield'){
      base = playerSkill(player, 'passing') * 0.34 + playerSkill(player, 'defense') * 0.16 + playerSkill(player, 'attack') * 0.18 + playerSkill(player, 'teamwork') * 0.14 + playerOverall(player) * 0.18;
    }else{
      base = playerSkill(player, 'attack') * 0.32 + playerSkill(player, 'shooting') * 0.28 + playerSkill(player, 'speed') * 0.17 + playerSkill(player, 'heading') * 0.08 + playerOverall(player) * 0.15;
    }
    return clampValue(base * conditionFactor(player), 1, 115);
  }

  function snapshotPlayers(snapshot, role=null){
    const list = Array.isArray(snapshot?.players) ? snapshot.players : [];
    if(!role) return list;
    return list.filter(player => String(player?.squadRole || '').toLowerCase() === role);
  }

  function teamProfile(snapshot){
    const starters = snapshotPlayers(snapshot, 'starter').slice(0, 11);
    const byLine = line => starters.filter(player => lineForPosition(player.tacticalRole || player.position) === line);
    const values = players => players.map(playerMatchStrength);
    const overall = average(values(starters), Number(snapshot?.team?.rating || 50));
    const goalkeeper = average(values(byLine('goalkeeper')), overall * 0.92);
    const defense = average(values(byLine('defense')), overall * 0.94);
    const midfield = average(values(byLine('midfield')), overall);
    const attack = average(values(byLine('attack')), overall * 0.96);
    const cohesion = clampValue(snapshot?.team?.cohesion ?? 50, 0, 100);
    const tactical = 0.82 + cohesion / 500;
    const custom = snapshot?.tactic?.customBalance?.active ? snapshot.tactic.customBalance : null;
    const defenseMultiplier = custom ? clampValue(custom.defenseMultiplier ?? 1, 0.70, 1.05) : 1;
    const midfieldMultiplier = custom ? clampValue(custom.midfieldMultiplier ?? 1, 0.70, 1.05) : 1;
    const attackMultiplier = custom ? clampValue(custom.attackMultiplier ?? 1, 0.70, 1.05) : 1;
    return {
      starters,
      overall:overall * tactical * ((defenseMultiplier + midfieldMultiplier + attackMultiplier) / 3),
      goalkeeper:goalkeeper * tactical * defenseMultiplier,
      defense:defense * tactical * defenseMultiplier,
      midfield:midfield * tactical * midfieldMultiplier,
      attack:attack * tactical * attackMultiplier,
      discipline:average(starters.map(player => playerSkill(player, 'discipline')), 55),
      stamina:average(starters.map(player => playerSkill(player, 'stamina')), 55),
      leadership:average(starters.map(player => playerSkill(player, 'leadership')), 55)
    };
  }

  function poisson(lambda, random){
    const safe = clampValue(lambda, 0.05, 5.5);
    const limit = Math.exp(-safe);
    let product = 1;
    let count = 0;
    do{
      count += 1;
      product *= random();
    }while(product > limit && count < 12);
    return Math.max(0, count - 1);
  }

  function weightedPick(players, weightResolver, random){
    if(!players.length) return null;
    const weights = players.map(player => Math.max(0.01, Number(weightResolver(player)) || 0.01));
    const total = weights.reduce((sum, value) => sum + value, 0);
    let target = random() * total;
    for(let i=0; i<players.length; i+=1){
      target -= weights[i];
      if(target <= 0) return players[i];
    }
    return players[players.length - 1];
  }

  function scorerWeight(player){
    const pos = String(player?.position || '').toUpperCase();
    const positionWeight = ({ DC:1.8, EI:1.35, ED:1.35, MCO:1.15, MC:0.72, MI:0.72, MD:0.72, MCD:0.42, DFC:0.28, LI:0.24, LD:0.24, POR:0.01 })[pos] || 0.5;
    return positionWeight * (playerSkill(player, 'shooting') * 0.55 + playerSkill(player, 'attack') * 0.30 + playerOverall(player) * 0.15);
  }

  function assistWeight(player){
    return (playerSkill(player, 'passing') * 0.58 + playerSkill(player, 'teamwork') * 0.22 + playerOverall(player) * 0.20) * (lineForPosition(player.position) === 'goalkeeper' ? 0.05 : 1);
  }

  function uniqueMinutes(count, random, min=3, max=90){
    const minutes = new Set();
    let guard = 0;
    while(minutes.size < count && guard < 500){
      minutes.add(Math.floor(min + random() * (max - min + 1)));
      guard += 1;
    }
    return [...minutes].sort((a,b) => a-b);
  }

  function generateSubstitutions(snapshot, random, side){
    const starters = snapshotPlayers(snapshot, 'starter').slice(0, 11);
    const bench = snapshotPlayers(snapshot, 'bench').slice(0, 10);
    const maxSubs = Math.min(5, bench.length, Math.max(0, starters.length - 1));
    const count = maxSubs ? Math.floor(random() * (maxSubs + 1)) : 0;
    const availableOut = starters.slice();
    const availableIn = bench.slice();
    const substitutions = [];
    for(let index=0; index<count; index+=1){
      const outIndex = Math.floor(random() * availableOut.length);
      const inIndex = Math.floor(random() * availableIn.length);
      const outPlayer = availableOut.splice(outIndex, 1)[0];
      const inPlayer = availableIn.splice(inIndex, 1)[0];
      substitutions.push({
        side,
        minute:Math.floor(55 + random() * 27),
        outPlayerId:outPlayer.id,
        outPlayerName:outPlayer.name,
        inPlayerId:inPlayer.id,
        inPlayerName:inPlayer.name
      });
    }
    substitutions.sort((a,b) => a.minute-b.minute);
    return substitutions;
  }

  function generateGoals(snapshot, count, random, side){
    const starters = snapshotPlayers(snapshot, 'starter').slice(0, 11);
    const minutes = uniqueMinutes(count, random, 2, 90);
    return minutes.map(minute => {
      const scorer = weightedPick(starters, scorerWeight, random) || starters[0];
      const assistPool = starters.filter(player => String(player.id) !== String(scorer?.id));
      const hasAssist = assistPool.length && random() > 0.18;
      const assist = hasAssist ? weightedPick(assistPool, assistWeight, random) : null;
      return {
        type:'goal', side, minute,
        playerId:scorer?.id || '', playerName:scorer?.name || 'Jugador',
        assistPlayerId:assist?.id || '', assistPlayerName:assist?.name || ''
      };
    });
  }

  function generateCards(snapshot, profile, random, side){
    const players = snapshotPlayers(snapshot, 'starter').slice(0, 11);
    const yellowMean = clampValue((2.5 - (profile.discipline - 50) / 28) * CARD_RATE_MULTIPLIER, 0.35, 3.6);
    const yellows = Math.min(7, poisson(yellowMean, random));
    const events = [];
    const selected = new Map();
    uniqueMinutes(yellows, random, 8, 88).forEach(minute => {
      const player = weightedPick(players, p => 110 - playerSkill(p, 'discipline'), random) || players[0];
      const key = String(player?.id || '');
      const previous = selected.get(key) || 0;
      selected.set(key, previous + 1);
      events.push({ type:'yellow', side, minute, playerId:player?.id || '', playerName:player?.name || 'Jugador' });
    });
    const redChance = clampValue((0.035 + (55 - profile.discipline) / 850) * CARD_RATE_MULTIPLIER * DIRECT_RED_RATE_MULTIPLIER, 0.003, 0.065);
    if(random() < redChance){
      const player = weightedPick(players, p => 110 - playerSkill(p, 'discipline'), random) || players[0];
      events.push({ type:'red', side, minute:Math.floor(28 + random() * 61), playerId:player?.id || '', playerName:player?.name || 'Jugador' });
    }
    return events.sort((a,b) => a.minute-b.minute);
  }

  function generateInjuries(snapshot, profile, random, side){
    const players = snapshotPlayers(snapshot, 'starter').slice(0, 11);
    const chance = clampValue(0.145 - profile.stamina / 1100 + (100 - Number(snapshot?.club?.stadiumCondition || 100)) / 1400, 0.04, 0.18);
    if(random() >= chance || !players.length) return [];
    const player = weightedPick(players, p => 110 - playerSkill(p, 'stamina'), random) || players[0];
    const durations = [3,5,7,10,14,21,30,45];
    const days = durations[Math.floor(random() * durations.length)];
    return [{ type:'injury', side, minute:Math.floor(12 + random() * 76), playerId:player?.id || '', playerName:player?.name || 'Jugador', days }];
  }

  function usedPlayerIds(snapshot, substitutions){
    const ids = snapshotPlayers(snapshot, 'starter').slice(0, 11).map(player => player.id);
    (substitutions || []).forEach(sub => ids.push(sub.inPlayerId));
    return [...new Set(ids.map(String))];
  }

  function economyForUsedPlayers(snapshot, usedIds){
    const set = new Set((usedIds || []).map(String));
    return snapshotPlayers(snapshot).filter(player => set.has(String(player.id))).reduce((totals, player) => {
      totals.value += Math.max(0, round(player.value));
      totals.salary += Math.max(0, round(player.salary));
      return totals;
    }, { value:0, salary:0 });
  }

  function playerRatings(snapshot, usedIds, side, score, goals, cards, random){
    const usedSet = new Set(usedIds.map(String));
    const goalCount = new Map();
    const assistCount = new Map();
    goals.forEach(goal => {
      goalCount.set(String(goal.playerId), (goalCount.get(String(goal.playerId)) || 0) + 1);
      if(goal.assistPlayerId) assistCount.set(String(goal.assistPlayerId), (assistCount.get(String(goal.assistPlayerId)) || 0) + 1);
    });
    const cardPenalty = new Map();
    cards.forEach(card => cardPenalty.set(String(card.playerId), (cardPenalty.get(String(card.playerId)) || 0) + (card.type === 'red' ? 1.2 : 0.25)));
    const resultBonus = score.forGoals > score.againstGoals ? 0.35 : score.forGoals < score.againstGoals ? -0.25 : 0.05;
    return snapshotPlayers(snapshot).filter(player => usedSet.has(String(player.id))).map(player => {
      const id = String(player.id);
      const rating = clampValue(6.15 + resultBonus + (random() - 0.5) * 0.9 + (goalCount.get(id) || 0) * 1.05 + (assistCount.get(id) || 0) * 0.55 - (cardPenalty.get(id) || 0), 3, 10);
      return { side, playerId:player.id, playerName:player.name, position:player.position, rating:Math.round(rating * 10) / 10 };
    });
  }

  function attendanceForMatch(homeSnapshot, awaySnapshot, random){
    const capacity = Math.max(1000, round(homeSnapshot?.club?.stadiumCapacity || 20000));
    const homeFans = Math.max(0, round(homeSnapshot?.club?.fans || capacity));
    const awayFans = Math.max(0, round(awaySnapshot?.club?.fans || capacity * 0.2));
    const attraction = clampValue((Number(homeSnapshot?.team?.rating || 50) + Number(awaySnapshot?.team?.rating || 50)) / 170, 0.55, 1.15);
    const demand = (homeFans * (0.34 + random() * 0.18) + awayFans * (0.025 + random() * 0.025)) * attraction;
    const total = Math.min(capacity, Math.max(Math.round(capacity * 0.42), Math.round(demand)));
    const awayShare = clampValue(0.07 + (awayFans / Math.max(1, homeFans + awayFans)) * 0.18, 0.06, 0.23);
    const away = Math.min(total, Math.round(total * awayShare));
    return { total, homeFans:total - away, awayFans:away };
  }

  function simulateChallengeMatch({ homeSnapshot, awaySnapshot, seed }){
    if(!homeSnapshot || !awaySnapshot) throw new Error('Faltan fotografías de los equipos.');
    const homeStarters = snapshotPlayers(homeSnapshot, 'starter');
    const awayStarters = snapshotPlayers(awaySnapshot, 'starter');
    if(homeStarters.length !== 11 || awayStarters.length !== 11) throw new Error('Cada equipo debe tener exactamente 11 titulares.');
    const random = createRandom(`${VERSION}|${String(seed || '')}|${homeSnapshot.snapshotHash || ''}|${awaySnapshot.snapshotHash || ''}`);
    const home = teamProfile(homeSnapshot);
    const away = teamProfile(awaySnapshot);

    const homeMidEdge = (home.midfield - away.midfield) / 70;
    const awayMidEdge = -homeMidEdge;
    const homeLambda = clampValue(1.22 + (home.attack - away.defense * 0.72 - away.goalkeeper * 0.28) / 28 + homeMidEdge + 0.18, 0.18, 4.8);
    const awayLambda = clampValue(1.10 + (away.attack - home.defense * 0.72 - home.goalkeeper * 0.28) / 28 + awayMidEdge, 0.18, 4.8);
    let homeGoals = Math.min(9, poisson(homeLambda, random));
    let awayGoals = Math.min(9, poisson(awayLambda, random));
    const adjustedScore = applyHighScorePenalty(homeGoals, awayGoals, random);
    homeGoals = adjustedScore.homeGoals;
    awayGoals = adjustedScore.awayGoals;

    const homeSubs = generateSubstitutions(homeSnapshot, random, 'home');
    const awaySubs = generateSubstitutions(awaySnapshot, random, 'away');
    const substitutions = [...homeSubs, ...awaySubs].sort((a,b) => a.minute-b.minute);
    const homeGoalEvents = generateGoals(homeSnapshot, homeGoals, random, 'home');
    const awayGoalEvents = generateGoals(awaySnapshot, awayGoals, random, 'away');
    const homeCards = generateCards(homeSnapshot, home, random, 'home');
    const awayCards = generateCards(awaySnapshot, away, random, 'away');
    const cards = applyCardVolumePenalty([...homeCards, ...awayCards], random);
    const injuries = [
      ...generateInjuries(homeSnapshot, home, random, 'home'),
      ...generateInjuries(awaySnapshot, away, random, 'away')
    ].sort((a,b) => a.minute-b.minute);
    const goals = [...homeGoalEvents, ...awayGoalEvents].sort((a,b) => a.minute-b.minute);
    const events = [...goals, ...cards, ...injuries, ...substitutions.map(item => ({ ...item, type:'substitution' }))].sort((a,b) => a.minute-b.minute || String(a.type).localeCompare(String(b.type)));

    const possessionHome = clampValue(Math.round(50 + (home.midfield - away.midfield) * 0.42 + (random() - 0.5) * 8), 30, 70);
    const possessionAway = 100 - possessionHome;
    const homeShots = Math.max(homeGoals + 2, Math.round(7 + homeLambda * 3.2 + random() * 5));
    const awayShots = Math.max(awayGoals + 2, Math.round(7 + awayLambda * 3.2 + random() * 5));
    const homeOnTarget = Math.min(homeShots, Math.max(homeGoals, Math.round(homeShots * (0.31 + random() * 0.18))));
    const awayOnTarget = Math.min(awayShots, Math.max(awayGoals, Math.round(awayShots * (0.31 + random() * 0.18))));
    const attendance = attendanceForMatch(homeSnapshot, awaySnapshot, random);
    const playedIdsHome = usedPlayerIds(homeSnapshot, homeSubs);
    const playedIdsAway = usedPlayerIds(awaySnapshot, awaySubs);
    const homeEconomy = economyForUsedPlayers(homeSnapshot, playedIdsHome);
    const awayEconomy = economyForUsedPlayers(awaySnapshot, playedIdsAway);
    const ratings = [
      ...playerRatings(homeSnapshot, playedIdsHome, 'home', { forGoals:homeGoals, againstGoals:awayGoals }, homeGoalEvents, homeCards, random),
      ...playerRatings(awaySnapshot, playedIdsAway, 'away', { forGoals:awayGoals, againstGoals:homeGoals }, awayGoalEvents, awayCards, random)
    ];
    const manOfMatch = ratings.slice().sort((a,b) => b.rating-a.rating || String(a.playerName).localeCompare(String(b.playerName)))[0] || null;
    const winnerSide = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';

    return {
      schemaVersion:1,
      simulatorVersion:VERSION,
      seed:String(seed || ''),
      homeSnapshotHash:String(homeSnapshot.snapshotHash || ''),
      awaySnapshotHash:String(awaySnapshot.snapshotHash || ''),
      score:{ home:homeGoals, away:awayGoals },
      winnerSide,
      attendance,
      economy:{
        homeUsedPlayersValue:homeEconomy.value,
        awayUsedPlayersValue:awayEconomy.value,
        homeUsedPlayersSalary:homeEconomy.salary,
        awayUsedPlayersSalary:awayEconomy.salary
      },
      statistics:{
        home:{ possession:possessionHome, shots:homeShots, shotsOnTarget:homeOnTarget, corners:Math.max(0, poisson(4.5 + homeLambda * 0.4, random)), fouls:Math.max(5, poisson(10, random)) },
        away:{ possession:possessionAway, shots:awayShots, shotsOnTarget:awayOnTarget, corners:Math.max(0, poisson(4.2 + awayLambda * 0.4, random)), fouls:Math.max(5, poisson(10, random)) }
      },
      goals,
      cards,
      injuries,
      substitutions,
      events,
      playerRatings:ratings,
      manOfMatch,
      playedIdsHome,
      playedIdsAway
    };
  }

  global.ChallengeSimulator = Object.freeze({ version:VERSION, simulateChallengeMatch, createRandom });
})(window);
