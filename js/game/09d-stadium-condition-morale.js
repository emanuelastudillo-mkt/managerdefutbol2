/* V8.08 · Estadio, instalaciones, desgaste, condición y moral. Extraído de 09-simulation-economy-training.js. */

function rainFieldDeteriorationForWeather(weather=''){
  if(!RAIN_FIELD_DETERIORATION_ENABLED) return 0;
  const normalized = String(weather || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if(!normalized.includes('lluvia')) return 0;
  if(normalized.includes('intensa') || normalized.includes('fuerte')) return RAIN_FIELD_DETERIORATION_HEAVY;
  return RAIN_FIELD_DETERIORATION_LIGHT;
}
function advanceStadiumAfterMatches(results){
  ensureStadiumState();
  const homeWeatherDeterioration = new Map();
  (results || []).forEach(match => {
    const clubId = Number(match?.homeId || 0);
    if(!clubId) return;
    const rainExtra = rainFieldDeteriorationForWeather(match?.matchContext?.weather || '');
    homeWeatherDeterioration.set(clubId, Math.max(Number(homeWeatherDeterioration.get(clubId) || 0), Number(rainExtra || 0)));
  });
  const homePlayed = new Set((results || []).map(match => match.homeId));
  homePlayed.forEach(clubId => {
    if(BOT_FIELDS_FIXED_BY_SEASON && !isManagedClubField(clubId)) return;
    const project = stadiumProjectForClub(clubId);
    if(project.replantingTurnsLeft > 0){
      game.stadium.fields[clubId] = 30;
    } else {
      const baseDeterioration = rnd(5,8) + Number(homeWeatherDeterioration.get(Number(clubId)) || 0);
      const rawDeterioration = baseDeterioration * Math.max(0, Number(FIELD_DETERIORATION_MULTIPLIER || 1));
      const reductionPct = (typeof specialActiveBonus === 'function' && Number(clubId) === Number(game?.selectedClubId)) ? specialActiveBonus('deterioro_campo') : 0;
      const adjustedDeterioration = Math.max(0, rawDeterioration * (1 - (clamp(reductionPct, 0, 95) / 100)));
      game.stadium.fields[clubId] = clamp(Math.round(fieldScoreForClub(clubId) - adjustedDeterioration), 1, 100);
    }
  });
  if(typeof processAfaFieldSanctionDaily === 'function') processAfaFieldSanctionDaily();
  processStadiumProjects();
  processSponsorContracts();
  if(typeof processMemberCampaigns === 'function') processMemberCampaigns(DAYS_PER_ADVANCE);
}
function processManagerAcademyFacilitiesDaily(days=1){
  if(!game || typeof managerAcademyFacilitiesState !== 'function') return { completed:[] };
  const elapsed = Math.max(0, Math.round(Number(days || 0)));
  if(elapsed <= 0) return { completed:[] };
  const facilities = managerAcademyFacilitiesState();
  const state = facilities.youthTraining;
  const completed = [];
  if(state.construction){
    state.construction.daysLeft = Math.max(0, Number(state.construction.daysLeft || 0) - elapsed);
    if(state.construction.daysLeft <= 0){
      const targetLevel = Math.max(Number(state.level || 0), Number(state.construction.targetLevel || 0));
      state.level = targetLevel;
      state.construction = null;
      completed.push(targetLevel);
      const definition = youthTrainingGroundLevelDefinition(targetLevel);
      if(typeof pushGameMessage === 'function') pushGameMessage({ type:'academia', title:`Predio juvenil nivel ${targetLevel} finalizado`, body:`Tu predio ${definition?.name || ''} quedó habilitado. Aporta +${Number(definition?.exceptionalBonus || 0)} juvenil(es) excepcional(es) adicional(es) en la primera captación de cada temporada.`, priority:'normal' });
    }
  }
  facilities.lastProcessedDate = validIsoDate(game.currentDate) ? game.currentDate : facilities.lastProcessedDate;
  return { completed };
}
function processClubFacilitiesDaily(days=1){
  if(!game?.selectedClubId || typeof clubFacilitiesState !== 'function') return { completed:[], heatingDays:0, fieldGain:0, cost:0 };
  const elapsed = Math.max(0, Math.round(Number(days || 0)));
  if(elapsed <= 0) return { completed:[], heatingDays:0, fieldGain:0, cost:0 };
  const clubId = Number(game.selectedClubId);
  const state = clubFacilitiesState(clubId);
  const heatingDef = pitchHeatingDefinition();
  const completed = [];
  let heatingDays = 0;
  let fieldGain = 0;
  let cost = 0;
  for(let day=0; day<elapsed; day+=1){
    const heatingReadyAtStart = Boolean(state.heating.built);
    if(state.heating.construction){
      state.heating.construction.daysLeft = Math.max(0, Number(state.heating.construction.daysLeft || 0) - 1);
      if(state.heating.construction.daysLeft <= 0){
        state.heating.construction = null;
        state.heating.built = true;
        state.heating.active = false;
        completed.push('heating');
      }
    }
    if(heatingReadyAtStart && state.heating.active){
      if((Number(game.budget || 0) - cost) < heatingDef.dailyCost){
        state.heating.active = false;
        if(typeof pushGameMessage === 'function') pushGameMessage({ type:'estadio', priority:'high', title:'Calefacción de césped apagada', body:`No había presupuesto suficiente para pagar ${formatMoney(heatingDef.dailyCost)} del gasto diario. La instalación se apagó automáticamente.` });
      }else{
        cost += heatingDef.dailyCost;
        heatingDays += 1;
        const before = fieldScoreForClub(clubId);
        const after = clamp(before + heatingDef.dailyFieldGain, 1, 100);
        game.stadium.fields[clubId] = after;
        fieldGain += Math.max(0, after - before);
      }
    }
  }
  if(cost > 0) recordBudgetChange(-cost, 'Calefacción diaria del césped', { type:'stadium_facility_heating_daily', clubId, days:heatingDays, fieldGain });
  completed.forEach(item => {
    if(item === 'heating' && typeof pushGameMessage === 'function') pushGameMessage({ type:'estadio', title:'Calefacción de césped finalizada', body:'La instalación quedó disponible en Estadio → Instalaciones. Está apagada hasta que decidas encenderla.', priority:'normal' });
  });
  return { completed, heatingDays, fieldGain, cost };
}

function processStadiumProjects(){
  ensureStadiumState();
  Object.entries(game.stadium.projects).forEach(([clubIdRaw, project]) => {
    const clubId = Number(clubIdRaw);
    if(project.replantingTurnsLeft > 0){
      project.replantingTurnsLeft -= 1;
      if(project.replantingTurnsLeft <= 0){
        project.replantingTurnsLeft = 0;
        game.stadium.fields[clubId] = 99;
      } else {
        game.stadium.fields[clubId] = 30;
      }
    } else if(project.patchingTurnsLeft > 0){
      project.patchingTurnsLeft -= 1;
      game.stadium.fields[clubId] = clamp(Math.round(fieldScoreForClub(clubId) + PATCH_GAIN_PER_TURN), 1, 100);
      if(project.patchingTurnsLeft <= 0) project.patchingTurnsLeft = 0;
    }
  });
}
function startReplantingField(){
  if(!game) return;
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('fieldMaintenance')){ showNotice(managerChallengeBlockedMessage('fieldMaintenance')); return; }
  if(afaFieldInterventionActive(game.selectedClubId)){ showNotice('La AFA ya intervino el campo. No podés iniciar otro mantenimiento hasta que termine el replante obligatorio.'); return; }
  ensureStadiumState();
  const project = stadiumProjectForClub(game.selectedClubId);
  if(project.replantingTurnsLeft > 0 || project.patchingTurnsLeft > 0){ showNotice('Ya hay un trabajo de mantenimiento activo en el estadio.'); return; }
  if((game.budget || 0) < REPLANT_COST){ showNotice('Presupuesto insuficiente para replantar todo el campo.'); return; }
  recordBudgetChange(-REPLANT_COST, 'Replante completo del campo', { type:'stadium_replant' });
  project.replantingTurnsLeft = REPLANT_TURNS;
  project.patchingTurnsLeft = 0;
  game.stadium.fields[game.selectedClubId] = 30;
  saveLocal(true);
  showNotice('Replante completo iniciado. El campo quedará muy malo durante 35 días y luego subirá a 99.');
  renderStadium();
}
function startPatchingField(){
  if(!game) return;
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('fieldMaintenance')){ showNotice(managerChallengeBlockedMessage('fieldMaintenance')); return; }
  if(afaFieldInterventionActive(game.selectedClubId)){ showNotice('La AFA ya intervino el campo. No podés iniciar otro mantenimiento hasta que termine el replante obligatorio.'); return; }
  ensureStadiumState();
  const project = stadiumProjectForClub(game.selectedClubId);
  if(project.replantingTurnsLeft > 0 || project.patchingTurnsLeft > 0){ showNotice('Ya hay un trabajo de mantenimiento activo en el estadio.'); return; }
  if((game.budget || 0) < PATCH_COST){ showNotice('Presupuesto insuficiente para regar y parchar el campo.'); return; }
  recordBudgetChange(-PATCH_COST, 'Riego y parcheo del campo', { type:'stadium_patch' });
  if(typeof awardSpecialPoints === 'function') awardSpecialPoints('regar_o_parchar_campo_de_juego', { type:'stadium_patch' });
  project.patchingTurnsLeft = PATCH_TURNS;
  saveLocal(true);
  showNotice('Riego y parcheo iniciado. El campo mejorará 5 puntos por avance durante 21 días.');
  renderStadium();
}
function matchWearFromIntensity(match, clubId, playerId){
  if(!PLAYER_WEAR_ENABLED) return 0;
  const side = Number(match?.homeId) === Number(clubId) ? 'home' : 'away';
  const stats = match?.matchStats?.[side] || {};
  const attacks = Number(stats.attacks || 0);
  const chances = Number(stats.chances || 0);
  const fouls = Number(stats.fouls || 0);
  const pitchFatigue = Number(pitchEffect(match?.matchContext?.pitch || 'Normal').fatigueBonus || 0);
  const instructionDelta = Number(match?.instructionConditionDeltas?.[playerId] || 0);
  const cards = (match?.cards || []).filter(c => Number(c.playerId) === Number(playerId));
  let score = 0;
  score += attacks / 32;
  score += chances / 6;
  score += fouls / 16;
  score += pitchFatigue / 14;
  if(instructionDelta < 0) score += Math.abs(instructionDelta) / 8;
  if(cards.some(c => ['red','secondYellowRed'].includes(String(c.type || '')))) score += 0.6;
  else if(cards.length) score += 0.25;
  let wear = PLAYER_WEAR_MATCH_MIN;
  if(score >= 3.25) wear = 3;
  else if(score >= 2.05) wear = 2;
  return clamp(Math.round(wear), PLAYER_WEAR_MATCH_MIN, PLAYER_WEAR_MATCH_MAX);
}

function applyPlayerWearFromMatches(results=[]){
  if(!PLAYER_WEAR_ENABLED) return 0;
  let applied = 0;
  (Array.isArray(results) ? results : []).filter(Boolean).forEach(match => {
    (match.playedIdsHome || []).forEach(id => { applied += Math.max(0, adjustPlayerWear(id, matchWearFromIntensity(match, match.homeId, id))); });
    (match.playedIdsAway || []).forEach(id => { applied += Math.max(0, adjustPlayerWear(id, matchWearFromIntensity(match, match.awayId, id))); });
  });
  return applied;
}
function playerBenchedStreakState(){
  if(!game) return { season:1, players:{} };
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  if(!game.playerBenchedStreak || typeof game.playerBenchedStreak !== 'object' || Array.isArray(game.playerBenchedStreak) || Number(game.playerBenchedStreak.season || season) !== season){
    game.playerBenchedStreak = { season, players:{} };
  }
  if(!game.playerBenchedStreak.players || typeof game.playerBenchedStreak.players !== 'object' || Array.isArray(game.playerBenchedStreak.players)){
    game.playerBenchedStreak.players = {};
  }
  return game.playerBenchedStreak;
}
function registerPlayerPlayedForMorale(playerId){
  const state = playerBenchedStreakState();
  state.players[playerId] = 0;
  return 0;
}
function registerPlayerMissedForMorale(playerId){
  const state = playerBenchedStreakState();
  const maxTracked = Math.max(1, Math.round(configNumber('dificultad.moralSuplentes.partidosSinJugarMaximoContador', 20, 1, 80)));
  const current = Math.max(0, Math.round(Number(state.players[playerId] || 0)));
  const next = clamp(current + 1, 0, maxTracked);
  state.players[playerId] = next;
  return next;
}
function missedMatchMoralePenalty(playerId){
  const missed = registerPlayerMissedForMorale(playerId);
  const perMiss = configNumber('dificultad.moralSuplentes.perdidaPorPartidoPerdido', 1, 0, 10);
  const maxPenalty = Math.max(0, Math.round(configNumber('dificultad.moralSuplentes.perdidaMaximaPorPartido', 12, 0, 50)));
  return clamp(Math.round(missed * perMiss), 0, maxPenalty);
}

function applyConditionUpdates(results){
  if(!game.playerCondition) game.playerCondition = {};
  seed.players.forEach(player => {
    if(!Number.isFinite(game.playerCondition[player.id])) game.playerCondition[player.id] = 99;
  });
  const played = new Set();
  const pitchFatigueByPlayer = new Map();
  const instructionConditionByPlayer = new Map();
  results.forEach(match => {
    const extra = pitchEffect(match.matchContext?.pitch || 'Normal').fatigueBonus || 0;
    (match.playedIdsHome || []).forEach(id => {
      played.add(id);
      pitchFatigueByPlayer.set(id, Math.max(pitchFatigueByPlayer.get(id) || 0, extra));
      adjustPlayerWear(id, matchWearFromIntensity(match, match.homeId, id));
    });
    (match.playedIdsAway || []).forEach(id => {
      played.add(id);
      pitchFatigueByPlayer.set(id, Math.max(pitchFatigueByPlayer.get(id) || 0, extra));
      adjustPlayerWear(id, matchWearFromIntensity(match, match.awayId, id));
    });
    Object.entries(match.instructionConditionDeltas || {}).forEach(([id, delta]) => {
      const key = Number(id);
      instructionConditionByPlayer.set(key, (instructionConditionByPlayer.get(key) || 0) + Number(delta || 0));
    });
  });
  seed.players.forEach(player => {
    let next = currentCondition(player.id);
    if(isInjured(player.id)){
      next -= rnd(2,3);
    } else {
      next += postMatchRecoveryForPlayer(player);
      if(played.has(player.id)) next -= conditionLossForPlayer(player) + (pitchFatigueByPlayer.get(player.id) || 0);
      else next += rnd(8,10);
      next += instructionConditionByPlayer.get(player.id) || 0;
    }
    if(played.has(player.id)) next = applyPostMatchPhysicalCardRecoveryForPlayer(player, next);
    game.playerCondition[player.id] = clamp(Math.min(Math.round(next), maxConditionForPlayer(player.id)), 0, 99);
  });
}

function applyMoraleUpdates(results){
  if(!game.playerMorale) game.playerMorale = {};
  seed.players.forEach(player => {
    if(!Number.isFinite(game.playerMorale[player.id])) game.playerMorale[player.id] = PLAYER_MORALE_START;
  });
  const processedClubs = new Set();
  (results || []).forEach(match => {
    [
      { clubId:match.homeId, gf:match.homeGoals, gc:match.awayGoals, starterIds:match.starterIdsHome || [], playedIds:match.playedIdsHome || [] },
      { clubId:match.awayId, gf:match.awayGoals, gc:match.homeGoals, starterIds:match.starterIdsAway || [], playedIds:match.playedIdsAway || [] }
    ].forEach(team => {
      if(!team.clubId || processedClubs.has(`${match.id}-${team.clubId}`)) return;
      processedClubs.add(`${match.id}-${team.clubId}`);
      const squad = playersByClub(team.clubId);
      const starterSet = new Set((team.starterIds || []).map(Number));
      const playedSet = new Set((team.playedIds || []).map(Number));
      squad.forEach(player => {
        let next = currentMorale(player.id);
        const starter = starterSet.has(player.id);
        const played = playedSet.has(player.id);
        const unavailable = typeof isUnavailable === 'function' && isUnavailable(player.id);
        if(starter){
          registerPlayerPlayedForMorale(player.id);
          next += rnd(3,6);
        }
        else if(played){
          registerPlayerPlayedForMorale(player.id);
          next += rnd(1,2);
        }
        else if(!unavailable){
          next -= missedMatchMoralePenalty(player.id);
        }
        if(team.gf > team.gc) next += rnd(1,3);
        else if(team.gf < team.gc){
          next -= starter ? rnd(5,8) : rnd(3,4);
          next -= TEAM_MORALE_DEFEAT_EXTRA_LOSS;
        }
        game.playerMorale[player.id] = clamp(Math.round(next), 1, 99);
      });
    });
  });
  if(typeof applyCaptaincyAfterMatches === 'function') applyCaptaincyAfterMatches(results || []);
}

