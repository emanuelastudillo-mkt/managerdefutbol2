/* Motor de eventos condicionales desde data/eventos.json. */

function gameEventDefinitions(){
  const fromDatabase = Array.isArray(eventsDatabase?.eventos) ? eventsDatabase.eventos : [];
  const fromConfig = Array.isArray(configValue('eventos.planilla', [])) ? configValue('eventos.planilla', []) : [];
  return (fromDatabase.length ? fromDatabase : fromConfig).filter(event => event && event.activo !== false && event.id);
}
function ensureEventLog(){
  if(!game) return [];
  game.eventLog = Array.isArray(game.eventLog) ? game.eventLog : [];
  return game.eventLog;
}
function ownInjuriesFromResult(result){
  if(!result || !game) return [];
  return (result.injuries || []).filter(injury => Number(injury.clubId) === Number(game.selectedClubId));
}
function ownRivalFromResult(result){
  if(!result || !game) return null;
  const ownId = Number(game.selectedClubId);
  if(Number(result.homeId) === ownId) return seed.clubs.find(c => Number(c.id) === Number(result.awayId)) || null;
  if(Number(result.awayId) === ownId) return seed.clubs.find(c => Number(c.id) === Number(result.homeId)) || null;
  return null;
}
function eventOccurrenceId(event, context={}){
  const matchId = context.ownResult?.id || context.round?.matchday || 'turno';
  return `${event.id}-s${game?.seasonNumber || 1}-t${game?.globalTurn || game?.matchdayIndex || 0}-${matchId}`;
}
function eventAlreadyTriggered(event, context={}){
  const id = eventOccurrenceId(event, context);
  return ensureEventLog().some(entry => entry.occurrenceId === id);
}
function markEventTriggered(event, context={}, details={}){
  const entry = {
    occurrenceId:eventOccurrenceId(event, context),
    eventId:event.id,
    name:event.nombre || event.id,
    season:game?.seasonNumber || 1,
    turn:game?.globalTurn || game?.matchdayIndex || 0,
    matchdayIndex:game?.matchdayIndex || 0,
    date:game?.currentDate || '',
    matchId:context.ownResult?.id || null,
    createdAt:Date.now(),
    details
  };
  ensureEventLog().push(entry);
  return entry;
}
function eventProbabilityPass(event){
  const probability = clamp(Number(event.probabilidad ?? event.probability ?? 1), 0, 1);
  return probability >= 1 || Math.random() < probability;
}
function evaluateGameEventCondition(condition={}, context={}){
  const type = condition.tipo || condition.type;
  const value = Number(condition.valor ?? condition.value ?? 0);
  const ownResult = context.ownResult || null;
  if(type === 'temporada_regular') return isRegularSeason();
  if(type === 'partido_propio') return !!ownResult;
  if(type === 'partido_propio_visitante') return !!ownResult && Number(ownResult.awayId) === Number(game?.selectedClubId);
  if(type === 'partido_propio_local') return !!ownResult && Number(ownResult.homeId) === Number(game?.selectedClubId);
  if(type === 'lesiones_propias_mayor_a') return ownInjuriesFromResult(ownResult).length > value;
  if(type === 'lesiones_propias_mayor_o_igual_a') return ownInjuriesFromResult(ownResult).length >= value;
  if(type === 'moral_media_menor_a') return squadMoraleAverage(game.selectedClubId) < value;
  if(type === 'moral_media_mayor_a') return squadMoraleAverage(game.selectedClubId) > value;
  if(type === 'cohesion_menor_a') return cohesionValue(game.selectedClubId) < value;
  if(type === 'forma_media_menor_a') return squadFitnessAverage(game.selectedClubId) < value;
  return false;
}
function shouldTriggerGameEvent(event, context={}){
  if(!game || !event || event.activo === false) return false;
  if(event.fase && event.fase !== context.phase) return false;
  if(eventAlreadyTriggered(event, context)) return false;
  const conditions = Array.isArray(event.condiciones) ? event.condiciones : (event.condicion ? [event.condicion] : []);
  if(conditions.length && !conditions.every(condition => evaluateGameEventCondition(condition, context))) return false;
  return eventProbabilityPass(event);
}
function eventContextDetails(context={}, runtime={}){
  const ownResult = context.ownResult || null;
  const rival = ownRivalFromResult(ownResult);
  const injuries = ownInjuriesFromResult(ownResult);
  const players = injuries.map(injury => playerById(injury.playerId)).filter(Boolean);
  return {
    rival: rival?.name || 'el club rival',
    monto: formatMoney(runtime.compensationAmount || 0),
    jugadores: players.map(p => p.name).join(', ') || 'sin detalle',
    lesiones: String(injuries.length),
    moral: String(squadMoraleAverage(game.selectedClubId)),
    cohesion: String(cohesionValue(game.selectedClubId)),
    forma: String(squadFitnessAverage(game.selectedClubId)),
    ...(runtime.templateValues && typeof runtime.templateValues === 'object' ? runtime.templateValues : {})
  };
}
function formatEventTemplate(template='', context={}, runtime={}){
  const details = eventContextDetails(context, runtime);
  return String(template || '').replace(/{{\s*([a-zA-Z0-9_]+)\s*}}/g, (_, key) => details[key] ?? '');
}
function executeGameEventEffect(event, effect={}, context={}, runtime={}){
  const type = effect.tipo || effect.type;
  if(type === 'compensacion_sueldos_lesionados'){
    const injuries = ownInjuriesFromResult(context.ownResult);
    const players = injuries.map(injury => playerById(injury.playerId)).filter(Boolean);
    const amount = Math.round(players.reduce((sum, player) => sum + Number(player.salary || 0), 0));
    runtime.compensationAmount = amount;
    runtime.affectedPlayerIds = players.map(p => p.id);
    if(amount > 0){
      recordBudgetChange(amount, effect.concepto || 'Compensación por evento', {
        type:'event_compensation',
        eventId:event.id,
        matchId:context.ownResult?.id || null,
        players:runtime.affectedPlayerIds
      });
    }
    return { type, amount, players:runtime.affectedPlayerIds || [] };
  }
  if(type === 'moral_plantel'){
    const delta = Number(effect.valor ?? effect.value ?? 0);
    playersByClub(game.selectedClubId).forEach(player => {
      game.playerMorale[player.id] = clamp(Math.round(currentMorale(player.id) + delta), 1, 99);
    });
    return { type, delta };
  }
  if(type === 'forma_plantel'){
    const delta = Number(effect.valor ?? effect.value ?? 0);
    playersByClub(game.selectedClubId).forEach(player => {
      game.playerCondition[player.id] = clamp(Math.round(currentCondition(player.id) + delta), 0, 99);
    });
    return { type, delta };
  }
  if(type === 'cohesion_equipo'){
    const delta = Number(effect.valor ?? effect.value ?? 0);
    ensureTeamCohesion();
    game.teamCohesion[game.selectedClubId] = clamp(Math.round(cohesionValue(game.selectedClubId) + delta), 0, 100);
    return { type, delta };
  }
  if(type === 'mensaje'){
    const message = pushGameMessage({
      type:effect.mensajeTipo || effect.messageType || 'evento',
      priority:effect.prioridad || effect.priority || 'normal',
      title:formatEventTemplate(effect.titulo || effect.title || event.nombre || 'Evento del club', context, runtime),
      body:formatEventTemplate(effect.cuerpo || effect.body || '', context, runtime),
      id:effect.id ? `${effect.id}-${eventOccurrenceId(event, context)}` : undefined
    });
    return { type, messageId:message?.id || null };
  }
  return { type:type || 'desconocido', skipped:true };
}
function executeGameEvent(event, context={}){
  const runtime = {};
  const effects = Array.isArray(event.efectos) ? event.efectos : [];
  const appliedEffects = effects.map(effect => executeGameEventEffect(event, effect, context, runtime));
  markEventTriggered(event, context, { appliedEffects, runtime });
  return { event, appliedEffects, runtime };
}
function processGameEventsAfterMatches(context={}){
  if(!game || !context.ownResult) return [];
  const eventContext = { ...context, phase:'post_matchday' };
  const triggered = [];
  gameEventDefinitions().forEach(event => {
    if(shouldTriggerGameEvent(event, eventContext)) triggered.push(executeGameEvent(event, eventContext));
  });
  if(triggered.length) game.lastTriggeredEvents = triggered.map(item => ({ id:item.event.id, name:item.event.nombre || item.event.id }));
  else game.lastTriggeredEvents = [];
  return triggered;
}

/* Decisiones interactivas de vestuario programadas por un estado crítico del plantel. */
function lockerRoomProblemDefinitions(){
  const fromDatabase = Array.isArray(eventsDatabase?.problemasVestuario) ? eventsDatabase.problemasVestuario : [];
  const fromConfig = Array.isArray(configValue('eventos.problemasVestuario', [])) ? configValue('eventos.problemasVestuario', []) : [];
  return (fromDatabase.length ? fromDatabase : fromConfig).filter(event => event && event.activo !== false && event.id && Array.isArray(event.opciones) && event.opciones.length);
}
function lockerRoomCrisisSettings(){
  return {
    moraleThreshold:Math.round(configNumber('eventos.vestuarioMoralUmbral', 50, 1, 99)),
    cohesionThreshold:Math.round(configNumber('eventos.vestuarioCohesionUmbral', 50, 1, 100)),
    intervalDays:Math.max(1, Math.round(configNumber('eventos.vestuarioIntervaloDias', 5, 1, 60))),
    probability:clamp(configNumber('eventos.vestuarioProbabilidad', 0.30, 0, 1), 0, 1),
    guaranteeDays:Math.max(0, Math.round(configNumber('eventos.vestuarioGarantiaDias', 20, 0, 120))),
    recentLimit:Math.max(0, Math.round(configNumber('eventos.vestuarioEventosRecientes', 5, 0, 20)))
  };
}
function ensureLockerRoomCrisisState(){
  if(!game) return null;
  const raw = game.lockerRoomCrisis && typeof game.lockerRoomCrisis === 'object' ? game.lockerRoomCrisis : {};
  const normalized = {
    clubId:Number(raw.clubId || 0),
    season:Math.max(1, Math.round(Number(raw.season || game.seasonNumber || 1))),
    active:Boolean(raw.active),
    startedTurn:Math.max(0, Math.round(Number(raw.startedTurn || 0))),
    nextCheckTurn:Math.max(0, Math.round(Number(raw.nextCheckTurn || 0))),
    lastCheckTurn:Math.max(0, Math.round(Number(raw.lastCheckTurn || 0))),
    checks:Math.max(0, Math.round(Number(raw.checks || 0))),
    events:Math.max(0, Math.round(Number(raw.events || 0))),
    recentEventIds:Array.isArray(raw.recentEventIds) ? raw.recentEventIds.map(String).filter(Boolean).slice(-20) : [],
    lastEventId:String(raw.lastEventId || ''),
    lastEventDate:String(raw.lastEventDate || ''),
    lastEventTurn:Math.max(0, Math.round(Number(raw.lastEventTurn || 0))),
    pendingMessageId:String(raw.pendingMessageId || ''),
    promises:Array.isArray(raw.promises) ? raw.promises.filter(Boolean).map(item => ({ ...item })) : []
  };
  Object.keys(raw).forEach(key => { if(!(key in normalized)) delete raw[key]; });
  Object.assign(raw, normalized);
  game.lockerRoomCrisis = raw;
  return raw;
}
function lockerRoomHash(seedText, max=1000000){
  const limit = Math.max(1, Math.round(Number(max || 1)));
  if(typeof hashNumber === 'function') return hashNumber(String(seedText || ''), limit);
  let hash = 2166136261;
  const text = String(seedText || '');
  for(let i=0;i<text.length;i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0) % limit;
}
function lockerRoomDeterministicOrder(players=[], seedText=''){
  return (Array.isArray(players) ? players : []).slice().sort((a,b) => {
    const aHash = lockerRoomHash(`${seedText}-${Number(a?.id || 0)}`, 1000000);
    const bHash = lockerRoomHash(`${seedText}-${Number(b?.id || 0)}`, 1000000);
    return aHash - bHash || Number(a?.id || 0) - Number(b?.id || 0);
  });
}
function lockerRoomEligiblePlayers(clubId){
  return playersByClub(clubId)
    .filter(player => player && !player.freeAgent && Number(player.clubId || 0) === Number(clubId) && !isInjured(player.id))
    .sort((a,b) => Number(a.id || 0) - Number(b.id || 0));
}
function lockerRoomTacticIds(key){
  return new Set((game?.tactic?.[key] || []).map(Number).filter(Boolean));
}
function lockerRoomCaptainPlayer(eligible=[]){
  const captainId = Number(typeof managerDressingRoom?.hierarchy === 'function' ? managerDressingRoom.hierarchy()?.captainId || 0 : game?.tactic?.captainId || 0);
  return eligible.find(player => Number(player.id) === captainId) || null;
}
function lockerRoomPickDistinct(source=[], count=1, seedText='', used=new Set()){
  const ordered = lockerRoomDeterministicOrder(source.filter(player => player && !used.has(Number(player.id))), seedText);
  const picked = ordered.slice(0, Math.max(0, Number(count || 0)));
  picked.forEach(player => used.add(Number(player.id)));
  return picked;
}
function lockerRoomFallbackParticipants(eligible=[], count=1, seedText='', preferred=[]){
  const used = new Set();
  const output = [];
  (preferred || []).filter(Boolean).forEach(player => {
    if(output.length >= count || used.has(Number(player.id))) return;
    output.push(player);
    used.add(Number(player.id));
  });
  output.push(...lockerRoomPickDistinct(eligible, count - output.length, `${seedText}-fallback`, used));
  return output.slice(0, count);
}
function selectLockerRoomParticipants(event, seedText=''){
  const clubId = Number(game?.selectedClubId || 0);
  const eligible = lockerRoomEligiblePlayers(clubId);
  if(!eligible.length) return [];
  const starters = lockerRoomTacticIds('starters');
  const bench = lockerRoomTacticIds('bench');
  const selector = String(event?.selector || 'random_pair');
  if(String(event?.sistema || '') === 'estrellas' && typeof starPlayerSelectParticipants === 'function'){
    const selected = starPlayerSelectParticipants(event, eligible, seedText);
    if(Array.isArray(selected)) return selected;
  }
  const countMap = {
    random_pair:2, goalkeeper_defender:2, captain_challenger:2, reserve_single:1,
    random_four:4, random_three:3, starting_pair:2, veteran_youth:2,
    same_position_pair:2, star_reserve:2, captain_group:3, low_morale_three:3,
    highest_salary_three:3, random_single:1, youth_single:1, star_single:1,
    shooters_pair:2, low_condition_single:1, salary_gap_pair:2, low_morale_single:1
  };
  const count = Number(countMap[selector] || 2);
  let picked = [];
  if(selector === 'goalkeeper_defender'){
    const goalkeeper = lockerRoomPickDistinct(eligible.filter(player => player.position === 'POR'), 1, `${seedText}-gk`)[0];
    const defender = lockerRoomPickDistinct(eligible.filter(player => ['DFC','LD','LI'].includes(player.position) && Number(player.id) !== Number(goalkeeper?.id)), 1, `${seedText}-def`)[0];
    picked = [goalkeeper, defender].filter(Boolean);
  }else if(selector === 'captain_challenger'){
    const starterPlayers = eligible.filter(player => starters.has(Number(player.id)));
    const captain = lockerRoomCaptainPlayer(starterPlayers.length ? starterPlayers : eligible);
    const challengerPool = (starterPlayers.length ? starterPlayers : eligible).filter(player => Number(player.id) !== Number(captain?.id));
    const challenger = challengerPool.sort((a,b) => Number(b.skills?.liderazgo || 0) - Number(a.skills?.liderazgo || 0) || Number(b.overall || 0) - Number(a.overall || 0))[0];
    picked = [captain, challenger].filter(Boolean);
  }else if(selector === 'reserve_single'){
    const reserves = eligible.filter(player => !starters.has(Number(player.id)) && !bench.has(Number(player.id)));
    const substitutes = eligible.filter(player => !starters.has(Number(player.id)));
    picked = lockerRoomPickDistinct(reserves.length ? reserves : substitutes.length ? substitutes : eligible, 1, `${seedText}-reserve`);
  }else if(selector === 'starting_pair'){
    picked = lockerRoomPickDistinct(eligible.filter(player => starters.has(Number(player.id))), 2, `${seedText}-starters`);
  }else if(selector === 'veteran_youth'){
    const byAge = eligible.slice().sort((a,b) => Number(b.age || 0) - Number(a.age || 0) || Number(a.id || 0) - Number(b.id || 0));
    const veteran = byAge[0];
    const youth = byAge.slice().reverse().find(player => Number(player.id) !== Number(veteran?.id));
    picked = [veteran, youth].filter(Boolean);
  }else if(selector === 'same_position_pair'){
    const groups = new Map();
    eligible.forEach(player => {
      const key = typeof playerGroup === 'function' ? playerGroup(player.position) : String(player.position || '');
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(player);
    });
    const validGroups = [...groups.entries()].filter(([, players]) => players.length >= 2).sort(([a],[b]) => String(a).localeCompare(String(b)));
    if(validGroups.length){
      const groupIndex = lockerRoomHash(`${seedText}-position-group`, validGroups.length);
      picked = lockerRoomPickDistinct(validGroups[groupIndex][1], 2, `${seedText}-position-pair`);
    }
  }else if(selector === 'star_reserve'){
    const star = eligible.slice().sort((a,b) => Number(b.overall || 0) - Number(a.overall || 0) || Number(a.id || 0) - Number(b.id || 0))[0];
    const reserves = eligible.filter(player => Number(player.id) !== Number(star?.id) && !starters.has(Number(player.id)));
    const reserve = lockerRoomPickDistinct(reserves.length ? reserves : eligible.filter(player => Number(player.id) !== Number(star?.id)), 1, `${seedText}-star-reserve`)[0];
    picked = [star, reserve].filter(Boolean);
  }else if(selector === 'captain_group'){
    const captain = lockerRoomCaptainPlayer(eligible);
    picked = lockerRoomFallbackParticipants(eligible, 3, `${seedText}-captain-group`, [captain]);
  }else if(selector === 'low_morale_three'){
    picked = eligible.slice().sort((a,b) => currentMorale(a.id) - currentMorale(b.id) || Number(a.id || 0) - Number(b.id || 0)).slice(0, 3);
  }else if(selector === 'highest_salary_three'){
    picked = eligible.slice().sort((a,b) => Number(b.salary || 0) - Number(a.salary || 0) || Number(a.id || 0) - Number(b.id || 0)).slice(0, 3);
  }else if(selector === 'youth_single'){
    picked = eligible.slice().sort((a,b) => Number(a.age || 99) - Number(b.age || 99) || Number(b.overall || 0) - Number(a.overall || 0))[0] ? [eligible.slice().sort((a,b) => Number(a.age || 99) - Number(b.age || 99) || Number(b.overall || 0) - Number(a.overall || 0))[0]] : [];
  }else if(selector === 'star_single'){
    picked = eligible.slice().sort((a,b) => Number(b.overall || 0) - Number(a.overall || 0) || Number(b.salary || 0) - Number(a.salary || 0))[0] ? [eligible.slice().sort((a,b) => Number(b.overall || 0) - Number(a.overall || 0) || Number(b.salary || 0) - Number(a.salary || 0))[0]] : [];
  }else if(selector === 'shooters_pair'){
    picked = eligible.slice().sort((a,b) => Number(b.skills?.remate || 0) - Number(a.skills?.remate || 0) || Number(b.skills?.serenidad || 0) - Number(a.skills?.serenidad || 0)).slice(0, 2);
  }else if(selector === 'low_condition_single'){
    picked = eligible.slice().sort((a,b) => currentCondition(a.id) - currentCondition(b.id) || Number(b.overall || 0) - Number(a.overall || 0)).slice(0, 1);
  }else if(selector === 'salary_gap_pair'){
    const bySalary = eligible.slice().sort((a,b) => Number(b.salary || 0) - Number(a.salary || 0));
    const high = bySalary[0];
    const claimantPool = eligible.filter(player => Number(player.id) !== Number(high?.id)).sort((a,b) => Number(a.salary || 0) - Number(b.salary || 0) || Number(b.overall || 0) - Number(a.overall || 0));
    const claimant = claimantPool[0];
    picked = [claimant, high].filter(Boolean);
  }else if(selector === 'low_morale_single'){
    picked = eligible.slice().sort((a,b) => currentMorale(a.id) - currentMorale(b.id) || Number(b.overall || 0) - Number(a.overall || 0)).slice(0, 1);
  }else{
    picked = lockerRoomPickDistinct(eligible, count, `${seedText}-${selector}`);
  }
  return lockerRoomFallbackParticipants(eligible, count, seedText, picked);
}
function lockerRoomParticipantMap(participants=[]){
  const map = {};
  participants.forEach((player, index) => { map[`jugador${index + 1}`] = player; });
  return map;
}
function lockerRoomTemplateValues(participants=[]){
  const values = {};
  participants.forEach((player, index) => { values[`jugador${index + 1}`] = player?.name || 'Jugador'; });
  return values;
}
function lockerRoomFormat(text='', participants=[]){
  return formatEventTemplate(text, {}, { templateValues:lockerRoomTemplateValues(participants) });
}
function lockerRoomApplyPlayerMorale(player, delta){
  if(!player || !Number.isFinite(Number(delta)) || Number(delta) === 0) return 0;
  game.playerMorale = game.playerMorale || {};
  const before = currentMorale(player.id);
  const after = clamp(Math.round(before + Number(delta)), 1, 99);
  game.playerMorale[player.id] = after;
  return after - before;
}
function lockerRoomApplyPlayerCondition(player, delta){
  if(!player || !Number.isFinite(Number(delta)) || Number(delta) === 0) return 0;
  game.playerCondition = game.playerCondition || {};
  const before = currentCondition(player.id);
  const after = clamp(Math.round(before + Number(delta)), 0, 99);
  game.playerCondition[player.id] = after;
  return after - before;
}
function lockerRoomTargetPlayers(effect={}, participantMap={}, participants=[]){
  const raw = effect.jugadores;
  if(raw === 'participantes') return participants.filter(Boolean);
  const keys = Array.isArray(raw) ? raw : (raw ? [raw] : []);
  if(!keys.length && effect.jugador) keys.push(effect.jugador);
  const selected = keys.map(key => participantMap[String(key)]).filter(Boolean);
  return selected.length ? selected : [];
}
function lockerRoomInjuryDays(eventId, playerId, minDays, maxDays, turn, salt=''){
  const min = Math.max(1, Math.round(Number(minDays || 1)));
  const max = Math.max(min, Math.round(Number(maxDays || min)));
  return min + lockerRoomHash(`${eventId}-${playerId}-${turn}-${salt}-injury`, max - min + 1);
}
function lockerRoomApplyUnavailablePlayer(player, definition={}, context={}){
  if(!player || isInjured(player.id)) return null;
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Math.max(0, Number(game.globalTurn || 0));
  const days = lockerRoomInjuryDays(context.eventId || 'vestuario', player.id, definition.diasMin, definition.diasMax, turn, context.salt || definition.tipo || '');
  const label = String(definition.nombre || 'Contusión');
  const issue = {
    clubId:Number(game.selectedClubId), playerId:Number(player.id), playerName:player.name || 'Jugador',
    injuryLabel:label, name:label, matchesOut:days, chance:1, source:String(context.source || 'locker_room')
  };
  if(typeof applyAvailability === 'function') applyAvailability([], [issue]);
  if(context.countAsInjury !== false && game.playerStats?.[player.id]) game.playerStats[player.id].injuries = Number(game.playerStats[player.id].injuries || 0) + 1;
  if(typeof removeOwnUnavailableFromTactic === 'function') removeOwnUnavailableFromTactic([{ type:'injury', playerId:Number(player.id) }]);
  game.mustReviewTactics = true;
  return issue;
}
function lockerRoomApplySuspension(player, matches=1){
  if(!player) return 0;
  game.playerStatus = game.playerStatus || {};
  const status = typeof playerStatus === 'function' ? playerStatus(player.id) : (game.playerStatus[player.id] || {});
  const through = Number(game.matchdayIndex || 0) + Math.max(1, Math.round(Number(matches || 1)));
  game.playerStatus[player.id] = { ...status, suspendedThrough:Math.max(Number(status.suspendedThrough || 0), through), suspensionLabel:'Sanción interna', suspensionType:'internal' };
  if(typeof removeOwnUnavailableFromTactic === 'function') removeOwnUnavailableFromTactic([{ type:'red', playerId:Number(player.id) }]);
  game.mustReviewTactics = true;
  return through;
}
function lockerRoomSilentPrestige(delta, reason='Decisión de vestuario'){
  if(!game?.managerStats || Number(delta || 0) === 0) return 0;
  if(typeof addManagerPrestige === 'function') return addManagerPrestige(Number(delta), reason);
  return 0;
}
function lockerRoomApplyDecisionEffect(effect={}, context={}){
  if(!game || !effect) return { skipped:true };
  const type = String(effect.tipo || effect.type || '');
  const participantMap = context.participantMap || {};
  const participants = context.participants || [];
  const players = lockerRoomTargetPlayers(effect, participantMap, participants);
  if(type === 'moral_jugadores'){
    const delta = Number(effect.valor || 0);
    const changes = players.map(player => ({ playerId:Number(player.id), delta:lockerRoomApplyPlayerMorale(player, delta) }));
    return { type, playerIds:players.map(p => p.id), delta, changes };
  }
  if(type === 'confianza_jugadores'){
    const delta = Number(effect.valor || 0);
    const changes = players.map(player => ({
      playerId:Number(player.id),
      delta:typeof managerDressingRoom?.changeTrust === 'function'
        ? managerDressingRoom.changeTrust(player.id, delta, effect.motivo || 'Decisión ante una figura', { morale:effect.afectaMoral !== false })
        : 0
    }));
    if(typeof managerDressingRoom?.refresh === 'function') managerDressingRoom.refresh();
    return { type, playerIds:players.map(player => Number(player.id)), delta, changes };
  }
  if(type === 'confianza_plantel'){
    const delta = Number(effect.valor || 0);
    const changes = typeof managerDressingRoom?.changeGroup === 'function'
      ? managerDressingRoom.changeGroup(() => true, delta, effect.motivo || 'Decisión ante una figura', { morale:effect.afectaMoral !== false })
      : [];
    return { type, delta, changes };
  }
  if(type === 'moral_plantel'){
    const delta = Number(effect.valor || 0);
    const applied = typeof adjustSquadMorale === 'function' ? adjustSquadMorale(game.selectedClubId, delta) : { affected:0, totalChange:0 };
    return { type, delta, applied };
  }
  if(type === 'cohesion'){
    const delta = Number(effect.valor || 0);
    const applied = typeof adjustTeamCohesion === 'function' ? adjustTeamCohesion(game.selectedClubId, delta) : 0;
    return { type, delta, applied };
  }
  if(type === 'forma_jugadores'){
    const delta = Number(effect.valor || 0);
    const changes = players.map(player => ({ playerId:Number(player.id), delta:lockerRoomApplyPlayerCondition(player, delta) }));
    return { type, playerIds:players.map(p => p.id), delta, changes };
  }
  if(type === 'forma_plantel'){
    const delta = Number(effect.valor || 0);
    const changes = playersByClub(game.selectedClubId).map(player => ({ playerId:Number(player.id), delta:lockerRoomApplyPlayerCondition(player, delta) }));
    return { type, delta, changes, totalChange:changes.reduce((sum, item) => sum + Number(item.delta || 0), 0) };
  }
  if(type === 'dinero_club'){
    let delta = Number(effect.valor || 0);
    if(effect.modo === 'porcentaje_sueldo'){
      const player = participantMap[String(effect.jugador || '')];
      delta = Math.round(Number(player?.salary || 0) * Number(effect.porcentaje || 0));
    }else if(effect.modo === 'porcentaje_sueldos_plantel'){
      const total = playersByClub(game.selectedClubId).reduce((sum, player) => sum + Math.max(0, Number(player.salary || 0)), 0);
      delta = Math.round(total * Number(effect.porcentaje || 0));
    }
    if(delta && typeof recordBudgetChange === 'function') recordBudgetChange(delta, effect.concepto || 'Decisión de vestuario', { type:'locker_room_decision', eventId:context.eventId || '', optionId:context.optionId || '' });
    return { type, delta };
  }
  if(type === 'multa_grupal'){
    const percentage = Math.max(0, Number(effect.porcentaje || 0));
    const delta = Math.round(players.reduce((sum, player) => sum + Math.max(0, Number(player.salary || 0)) * percentage, 0));
    if(delta && typeof recordBudgetChange === 'function') recordBudgetChange(delta, effect.concepto || 'Multas internas', { type:'locker_room_fines', eventId:context.eventId || '', optionId:context.optionId || '', playerIds:players.map(p => p.id) });
    return { type, delta };
  }
  if(type === 'prestigio_manager') return { type, delta:lockerRoomSilentPrestige(Number(effect.valor || 0), 'Decisión de vestuario') };
  if(type === 'hinchas'){
    const current = typeof clubFansCurrent === 'function' ? clubFansCurrent(game.selectedClubId) : 0;
    const delta = Number.isFinite(Number(effect.porcentaje)) ? Math.round(current * Number(effect.porcentaje)) : Math.round(Number(effect.valor || 0));
    if(delta && typeof setClubFansCurrent === 'function') setClubFansCurrent(game.selectedClubId, Math.max(0, current + delta), 'Decisión de vestuario');
    return { type, delta };
  }
  if(type === 'lesion'){
    const issues = [];
    players.forEach((player, index) => {
      const chance = clamp(Number(effect.probabilidad ?? 1), 0, 1);
      const roll = lockerRoomHash(`${context.eventId}-${context.optionId}-${player.id}-${context.turn}-${index}-injury-roll`, 1000000) / 1000000;
      if(roll >= chance) return;
      const issue = lockerRoomApplyUnavailablePlayer(player, effect, { eventId:context.eventId, salt:`${context.optionId}-${index}`, source:'locker_room_decision', countAsInjury:true });
      if(issue) issues.push(issue);
    });
    return { type, issues };
  }
  if(type === 'ausencia_personal'){
    const issues = players.map((player, index) => lockerRoomApplyUnavailablePlayer(player, { ...effect, nombre:'Permiso personal' }, { eventId:context.eventId, salt:`personal-${index}`, source:'personal_leave', countAsInjury:false })).filter(Boolean);
    return { type, issues };
  }
  if(type === 'suspension_interna'){
    const matches = Math.max(1, Math.round(Number(effect.partidos || 1)));
    players.forEach(player => lockerRoomApplySuspension(player, matches));
    return { type, playerIds:players.map(p => p.id), matches };
  }
  if(type === 'titularizar_jugador'){
    const player = participantMap[String(effect.jugador || '')];
    if(!player || Number(player.clubId || 0) !== Number(game.selectedClubId || 0)) return { type, skipped:true };
    const starters = (game?.tactic?.starters || []).map(Number).filter(Boolean);
    const bench = (game?.tactic?.bench || []).map(Number).filter(Boolean);
    if(starters.includes(Number(player.id))) return { type, playerId:Number(player.id), alreadyStarter:true };
    const targetGroup = typeof playerGroup === 'function' ? playerGroup(player.position) : String(player.position || '');
    const candidates = starters.map(id => playerById(id)).filter(Boolean).filter(candidate => {
      if(player.position === 'POR') return candidate.position === 'POR';
      const group = typeof playerGroup === 'function' ? playerGroup(candidate.position) : String(candidate.position || '');
      return candidate.position !== 'POR' && group === targetGroup;
    });
    const fallback = starters.map(id => playerById(id)).filter(candidate => candidate && candidate.position !== 'POR');
    const replacement = (candidates.length ? candidates : fallback).sort((a,b) => {
      const aOverall = typeof visibleOverall === 'function' ? Number(visibleOverall(a) || 0) : Number(a.overall || 0);
      const bOverall = typeof visibleOverall === 'function' ? Number(visibleOverall(b) || 0) : Number(b.overall || 0);
      return aOverall - bOverall || Number(a.id) - Number(b.id);
    })[0];
    if(!replacement) return { type, skipped:true };
    game.tactic = {
      ...game.tactic,
      starters:starters.map(id => Number(id) === Number(replacement.id) ? Number(player.id) : Number(id)),
      bench:[...new Set(bench.filter(id => Number(id) !== Number(player.id)).concat(Number(replacement.id)))]
    };
    game.mustReviewTactics = true;
    return { type, playerId:Number(player.id), replacedPlayerId:Number(replacement.id) };
  }
  if(type === 'cambiar_capitan'){
    const player = participantMap[String(effect.jugador || '')];
    const starters = new Set((game?.tactic?.starters || []).map(Number));
    if(player && starters.has(Number(player.id))){
      const currentHierarchy = typeof managerDressingRoom?.hierarchy === 'function' ? managerDressingRoom.hierarchy() : { captainId:Number(game?.tactic?.captainId || 0), viceCaptainId:0 };
      const preferredViceId = Number(currentHierarchy.captainId || 0) !== Number(player.id)
        ? Number(currentHierarchy.captainId || 0)
        : Number(currentHierarchy.viceCaptainId || 0);
      const preferredVice = typeof playerById === 'function' ? playerById(preferredViceId) : null;
      const fallbackVice = (typeof playersByClub === 'function' ? playersByClub(game.selectedClubId) : [])
        .filter(candidate => candidate && Number(candidate.id) !== Number(player.id))
        .sort((a,b) => {
          const aCaptaincy = typeof captaincyValue === 'function' ? Number(captaincyValue(a.id) || 0) : 0;
          const bCaptaincy = typeof captaincyValue === 'function' ? Number(captaincyValue(b.id) || 0) : 0;
          return bCaptaincy - aCaptaincy || Number(b.age || 0) - Number(a.age || 0) || Number(a.id) - Number(b.id);
        })[0];
      const nextVice = preferredVice && Number(preferredVice.clubId || 0) === Number(game.selectedClubId || 0) && Number(preferredVice.id) !== Number(player.id)
        ? Number(preferredVice.id)
        : Number(fallbackVice?.id || 0);
      if(typeof managerDressingRoom?.setLeadership === 'function' && nextVice) managerDressingRoom.setLeadership(Number(player.id), nextVice, { save:false, source:'event' });
      game.tactic = typeof ensureTacticCaptain === 'function' ? ensureTacticCaptain({ ...game.tactic, captainId:Number(player.id), captainSelectionMode:'automatic' }, game.selectedClubId) : { ...game.tactic, captainId:Number(player.id) };
      return { type, playerId:Number(player.id) };
    }
    return { type, skipped:true };
  }
  if(type === 'bloqueo_entrenamiento'){
    const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game.globalTurn || 0);
    const days = Math.max(1, Math.round(Number(effect.dias || 1)));
    game.lockerRoomTrainingPauseUntilTurn = Math.max(Number(game.lockerRoomTrainingPauseUntilTurn || 0), turn + days);
    return { type, days, untilTurn:game.lockerRoomTrainingPauseUntilTurn };
  }
  return { type:type || 'desconocido', skipped:true };
}
function lockerRoomApplyEffectList(effects=[], context={}){
  return (Array.isArray(effects) ? effects : []).map(effect => lockerRoomApplyDecisionEffect(effect, context));
}
function lockerRoomIssueText(applied=[]){
  const issues = applied.flatMap(item => Array.isArray(item?.issues) ? item.issues : []);
  if(!issues.length) return '';
  return ` ${issues.map(issue => `${issue.playerName} estará fuera ${issue.matchesOut} días por ${String(issue.injuryLabel || 'una molestia').toLowerCase()}.`).join(' ')}`;
}
function lockerRoomEffectMagnitude(delta=0){
  const value = Math.abs(Number(delta || 0));
  if(value <= 3) return 'levemente';
  if(value <= 6) return 'moderadamente';
  return 'marcadamente';
}
function lockerRoomEffectDirectionValue(effect={}){
  if(Array.isArray(effect.changes)) return effect.changes.reduce((sum, item) => sum + Number(item?.delta || 0), 0);
  if(effect?.applied && typeof effect.applied === 'object' && Number.isFinite(Number(effect.applied.totalChange))) return Number(effect.applied.totalChange);
  if(Object.prototype.hasOwnProperty.call(effect || {}, 'applied') && Number.isFinite(Number(effect.applied))) return Number(effect.applied);
  if(Object.prototype.hasOwnProperty.call(effect || {}, 'totalChange') && Number.isFinite(Number(effect.totalChange))) return Number(effect.totalChange);
  return Number(effect?.delta || 0);
}
function lockerRoomEffectPlayerNames(effect={}, action={}){
  const ids = [];
  if(Array.isArray(effect.changes)) ids.push(...effect.changes.map(item => Number(item?.playerId)));
  if(Array.isArray(effect.playerIds)) ids.push(...effect.playerIds.map(Number));
  if(Number.isFinite(Number(effect.playerId))) ids.push(Number(effect.playerId));
  const participantIds = Array.isArray(action?.participantIds) ? action.participantIds.map(Number) : [];
  const participantNames = Array.isArray(action?.participantNames) ? action.participantNames.map(String) : [];
  const names = [...new Set(ids.filter(Number.isFinite))].map(id => {
    const player = typeof playerById === 'function' ? playerById(id) : null;
    if(player?.name) return String(player.name);
    const index = participantIds.indexOf(id);
    return index >= 0 ? String(participantNames[index] || 'Jugador') : 'Jugador';
  });
  if(!names.length && Array.isArray(effect.issues)) names.push(...effect.issues.map(issue => String(issue?.playerName || 'Jugador')));
  return [...new Set(names.filter(Boolean))];
}
function lockerRoomJoinNames(names=[]){
  const clean = [...new Set((names || []).filter(Boolean).map(String))];
  if(!clean.length) return 'los jugadores implicados';
  if(clean.length === 1) return clean[0];
  if(clean.length === 2) return `${clean[0]} y ${clean[1]}`;
  return `${clean.slice(0, -1).join(', ')} y ${clean[clean.length - 1]}`;
}
function lockerRoomEffectSummaryItems(applied=[], action={}){
  const summaries = [];
  (Array.isArray(applied) ? applied : []).forEach(effect => {
    if(!effect || effect.skipped) return;
    const type = String(effect.type || '');
    const value = lockerRoomEffectDirectionValue(effect);
    const magnitudeValue = ['moral_jugadores','moral_plantel','forma_jugadores','forma_plantel'].includes(type) && Number.isFinite(Number(effect.delta)) ? Number(effect.delta) : value;
    const magnitude = lockerRoomEffectMagnitude(magnitudeValue);
    const names = lockerRoomJoinNames(lockerRoomEffectPlayerNames(effect, action));
    let text = '';
    let tone = value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral';
    if(type === 'moral_jugadores' && value !== 0) text = value > 0 ? `El ánimo de ${names} mejoró ${magnitude}.` : `El ánimo de ${names} quedó afectado ${magnitude}.`;
    else if(type === 'confianza_jugadores' && value !== 0) text = value > 0 ? `La confianza de ${names} en el mánager mejoró ${magnitude}.` : `La confianza de ${names} en el mánager se debilitó ${magnitude}.`;
    else if(type === 'confianza_plantel' && value !== 0) text = value > 0 ? `La confianza general en el mánager mejoró ${magnitude}.` : `La confianza general en el mánager se debilitó ${magnitude}.`;
    else if(type === 'moral_plantel' && value !== 0) text = value > 0 ? `El ánimo general del plantel mejoró ${magnitude}.` : `El ánimo general del plantel se deterioró ${magnitude}.`;
    else if(type === 'cohesion' && value !== 0) text = value > 0 ? `La unión del grupo se fortaleció ${magnitude}.` : `La unión del grupo se debilitó ${magnitude}.`;
    else if(type === 'forma_jugadores' && value !== 0) text = value > 0 ? `La preparación física de ${names} mejoró ${magnitude}.` : `La preparación física de ${names} quedó afectada ${magnitude}.`;
    else if(type === 'forma_plantel' && value !== 0) text = value > 0 ? `La preparación física general del plantel mejoró.` : `La preparación física general del plantel quedó afectada.`;
    else if(type === 'dinero_club' && Number(effect.delta || 0) !== 0){ text = Number(effect.delta) > 0 ? 'La decisión generó un ingreso para el club.' : 'La decisión generó un gasto para el club.'; tone = Number(effect.delta) > 0 ? 'positive' : 'negative'; }
    else if(type === 'multa_grupal' && Number(effect.delta || 0) !== 0){ text = 'Los jugadores implicados recibieron una multa económica interna.'; tone = 'neutral'; }
    else if(type === 'prestigio_manager' && value !== 0) text = value > 0 ? 'La autoridad del manager salió fortalecida.' : 'La autoridad del manager quedó debilitada.';
    else if(type === 'hinchas' && value !== 0) text = value > 0 ? 'La relación con los hinchas mejoró.' : 'La relación con los hinchas se deterioró.';
    else if(type === 'lesion' && Array.isArray(effect.issues) && effect.issues.length){ text = `${lockerRoomJoinNames(effect.issues.map(issue => issue?.playerName || 'Jugador'))} quedó fuera por lesión.`; tone = 'negative'; }
    else if(type === 'ausencia_personal' && Array.isArray(effect.issues) && effect.issues.length){ text = `${lockerRoomJoinNames(effect.issues.map(issue => issue?.playerName || 'Jugador'))} recibió permiso y quedará temporalmente fuera del equipo.`; tone = 'neutral'; }
    else if(type === 'suspension_interna' && lockerRoomEffectPlayerNames(effect, action).length){ text = `${names} quedó apartado temporalmente de la convocatoria.`; tone = 'negative'; }
    else if(type === 'titularizar_jugador' && Number(effect.playerId || 0)){ text = `${names} fue incorporado al equipo titular.`; tone = 'neutral'; }
    else if(type === 'cambiar_capitan' && lockerRoomEffectPlayerNames(effect, action).length){ text = `${names} fue designado como nuevo capitán.`; tone = 'neutral'; }
    else if(type === 'bloqueo_entrenamiento' && Number(effect.days || 0) > 0){ text = 'El trabajo de entrenamiento quedará limitado durante algunos días.'; tone = 'negative'; }
    if(text && !summaries.some(item => item.text === text)) summaries.push({ text, tone, type });
  });
  return summaries;
}
function pendingLockerRoomDecisionMessage(){
  if(!game) return null;
  return (game.messages || []).find(message => message?.action?.type === 'lockerRoomDecision' && message.action.status === 'pending') || null;
}
function hasPendingLockerRoomDecision(){
  return Boolean(pendingLockerRoomDecisionMessage());
}
function lockerRoomDecisionBlockText(){
  const message = pendingLockerRoomDecisionMessage();
  return message ? `Respondé el problema de vestuario pendiente: ${message.title}.` : '';
}
function lockerRoomCrisisNarrative(moraleValue, cohesionValue, settings=lockerRoomCrisisSettings()){
  const moraleLow = Number(moraleValue) < Number(settings.moraleThreshold);
  const cohesionLow = Number(cohesionValue) < Number(settings.cohesionThreshold);
  if(moraleLow && cohesionLow) return 'El plantel atraviesa un período de desánimo y el equipo dejó de funcionar como una unidad. La tensión acumulada empezó a generar problemas internos.';
  if(moraleLow) return 'El plantel se muestra desmotivado y la frustración empezó a trasladarse al vestuario.';
  if(cohesionLow) return 'El equipo no está funcionando bien en conjunto y los malos rendimientos comenzaron a provocar roces internos.';
  return 'La seguidilla de malos momentos generó tensión dentro del vestuario.';
}
function createLockerRoomDecision(event, participants=[], state=null){
  if(!game || !event || !participants.length) return null;
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Math.max(0, Number(game.globalTurn || 0));
  const participantMap = lockerRoomParticipantMap(participants);
  const context = { eventId:event.id, optionId:'initial', turn, participants, participantMap };
  const crisisSettings = lockerRoomCrisisSettings();
  const crisisNarrative = event.independiente === true
    ? String(event.introduccion || '')
    : lockerRoomCrisisNarrative(squadMoraleAverage(game.selectedClubId), cohesionValue(game.selectedClubId), crisisSettings);
  const initialEffects = lockerRoomApplyEffectList(event.efectosIniciales || [], context);
  const messageId = `locker-room-decision-${event.id}-s${game.seasonNumber || 1}-t${turn}`;
  const message = typeof pushGameMessage === 'function' ? pushGameMessage({
    id:messageId,
    type:'vestuario',
    priority:'high',
    title:lockerRoomFormat(event.titulo || event.nombre || 'Problema de vestuario', participants),
    body:`${crisisNarrative} ${lockerRoomFormat(event.cuerpo || '', participants)}${lockerRoomIssueText(initialEffects)}`.trim(),
    action:{
      type:'lockerRoomDecision', status:'pending', eventId:String(event.id),
      participantIds:participants.map(player => Number(player.id)),
      participantNames:participants.map(player => String(player.name || 'Jugador')),
      prompt:lockerRoomFormat(event.pregunta || '¿Cómo respondés?', participants),
      options:(event.opciones || []).map(option => ({ id:String(option.id), text:lockerRoomFormat(option.texto || option.id, participants) })),
      createdTurn:turn, createdSeason:Number(game.seasonNumber || 1), createdDate:String(game.currentDate || '')
    }
  }) : null;
  const logEntry = {
    occurrenceId:messageId, eventId:event.id, name:event.nombre || event.id,
    season:game.seasonNumber || 1, turn, matchdayIndex:game.matchdayIndex || 0,
    date:game.currentDate || '', matchId:null, createdAt:Date.now(),
    details:{ type:'locker_room_decision', status:'pending', participantIds:participants.map(player => Number(player.id)), initialEffects, messageId:message?.id || messageId }
  };
  ensureEventLog().push(logEntry);
  game.lastLockerRoomEvent = { id:event.id, name:event.nombre || event.id, turn, date:game.currentDate || '', participantIds:logEntry.details.participantIds, pending:true };
  if(state){
    state.events += 1;
    state.lastEventId = event.id;
    state.lastEventDate = String(game.currentDate || '');
    state.lastEventTurn = turn;
    state.pendingMessageId = message?.id || messageId;
  }
  return { event, participants, message, logEntry, initialEffects };
}
function lockerRoomResolveSpecialOption(option={}, context={}){
  if(option.resolucionEspecial === 'votacion_estrella_capitan'){
    const star = context.participantMap?.jugador1;
    const captain = context.participantMap?.jugador2;
    if(!star || !captain) return { result:'La votación no pudo realizarse.', effects:[] };
    const starScore = Number(star.skills?.liderazgo || 0) + currentMorale(star.id) + lockerRoomHash(`${context.eventId}-${context.turn}-star-vote`, 21);
    const captainScore = Number(captain.skills?.liderazgo || 0) + currentMorale(captain.id) + lockerRoomHash(`${context.eventId}-${context.turn}-captain-vote`, 21);
    if(starScore > captainScore){
      return {
        result:`El plantel eligió a ${star.name} como nuevo capitán.`,
        effects:[{ tipo:'cambiar_capitan', jugador:'jugador1' }, { tipo:'moral_jugadores', jugadores:['jugador1'], valor:7 }, { tipo:'moral_jugadores', jugadores:['jugador2'], valor:-7 }, { tipo:'cohesion', valor:2 }]
      };
    }
    return {
      result:`El plantel ratificó a ${captain.name} como capitán.`,
      effects:[{ tipo:'moral_jugadores', jugadores:['jugador1'], valor:-3 }, { tipo:'moral_jugadores', jugadores:['jugador2'], valor:6 }, { tipo:'cohesion', valor:4 }]
    };
  }
  if(option.resolucionEspecial !== 'votacion_capitan') return null;
  const captain = context.participantMap?.jugador1;
  const challenger = context.participantMap?.jugador2;
  if(!captain || !challenger) return { result:'La votación no pudo realizarse.', effects:[] };
  const captainScore = Number(captain.skills?.liderazgo || 0) + currentMorale(captain.id) + lockerRoomHash(`${context.eventId}-${context.turn}-captain-vote`, 21);
  const challengerScore = Number(challenger.skills?.liderazgo || 0) + currentMorale(challenger.id) + lockerRoomHash(`${context.eventId}-${context.turn}-challenger-vote`, 21);
  if(challengerScore > captainScore){
    return {
      result:`El plantel eligió a ${challenger.name} como nuevo capitán.`,
      effects:[{ tipo:'cambiar_capitan', jugador:'jugador2' }, { tipo:'moral_jugadores', jugadores:['jugador1'], valor:-6 }, { tipo:'moral_jugadores', jugadores:['jugador2'], valor:6 }, { tipo:'cohesion', valor:5 }]
    };
  }
  return {
    result:`El plantel ratificó a ${captain.name} como capitán.`,
    effects:[{ tipo:'moral_jugadores', jugadores:['jugador1'], valor:6 }, { tipo:'moral_jugadores', jugadores:['jugador2'], valor:-2 }, { tipo:'cohesion', valor:5 }]
  };
}
function lockerRoomCreatePromise(promiseDefinition={}, context={}, message=null, option=null){
  const state = ensureLockerRoomCrisisState();
  const player = context.participantMap?.[String(promiseDefinition.jugador || '')];
  if(!state || !player) return null;
  const turn = context.turn;
  const promise = {
    id:`locker-room-promise-${context.eventId}-${player.id}-${turn}`,
    type:String(promiseDefinition.tipo || 'minutos'), eventId:String(context.eventId || ''), optionId:String(context.optionId || ''),
    messageId:String(message?.id || ''), playerId:Number(player.id), playerName:String(player.name || 'Jugador'),
    participantIds:context.participants.map(item => Number(item.id)),
    createdTurn:turn, dueTurn:turn + Math.max(1, Math.round(Number(promiseDefinition.diasMax || 20))),
    startPlayerMatches:Math.max(0, Math.round(Number(game.playerStats?.[player.id]?.played || 0))),
    startTeamMatches:Math.max(0, Math.round(Number(game.managerStats?.totals?.played || 0))),
    matchesMax:Math.max(1, Math.round(Number(promiseDefinition.partidosMax || 3))),
    textPending:lockerRoomFormat(promiseDefinition.textoPendiente || 'Quedó una promesa pendiente.', context.participants),
    resultFulfilled:lockerRoomFormat(promiseDefinition.resultadoCumplida || 'La promesa fue cumplida.', context.participants),
    effectsFulfilled:Array.isArray(promiseDefinition.efectosCumplida) ? promiseDefinition.efectosCumplida : [],
    resultFailed:lockerRoomFormat(promiseDefinition.resultadoIncumplida || 'La promesa no fue cumplida.', context.participants),
    effectsFailed:Array.isArray(promiseDefinition.efectosIncumplida) ? promiseDefinition.efectosIncumplida : []
  };
  state.promises.push(promise);
  return promise;
}
function lockerRoomFindEvent(eventId){
  return lockerRoomProblemDefinitions().find(event => String(event.id) === String(eventId)) || null;
}
function respondLockerRoomDecision(messageId, optionId){
  if(!game) return false;
  const message = (game.messages || []).find(item => String(item.id) === String(messageId));
  if(!message || message.action?.type !== 'lockerRoomDecision' || message.action.status !== 'pending'){
    showNotice('La decisión ya fue respondida o dejó de estar disponible.');
    return false;
  }
  const event = lockerRoomFindEvent(message.action.eventId);
  const option = event?.opciones?.find(item => String(item.id) === String(optionId));
  if(!event || !option){ showNotice('No se pudo encontrar la respuesta seleccionada.'); return false; }
  const participants = (message.action.participantIds || []).map(id => playerById(Number(id))).filter(Boolean);
  const participantMap = lockerRoomParticipantMap(participants);
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Math.max(0, Number(game.globalTurn || 0));
  const context = { eventId:event.id, optionId:option.id, turn, participants, participantMap, message };
  let resultText = lockerRoomFormat(option.resultado || 'La decisión fue comunicada al plantel.', participants);
  let effects = Array.isArray(option.efectos) ? option.efectos : [];
  const special = lockerRoomResolveSpecialOption(option, context);
  const authorityProbability = option.controlAutoridad === true && typeof starPlayerAuthorityProbability === 'function'
    ? starPlayerAuthorityProbability(option, context, message)
    : null;
  const successProbability = Number.isFinite(Number(authorityProbability)) ? Number(authorityProbability) : Number(option.probabilidadExito);
  if(special){
    resultText = special.result;
    effects = special.effects;
  }else if(Number.isFinite(successProbability)){
    const roll = lockerRoomHash(`locker-room-choice-${event.id}-${option.id}-${message.id}`, 1000000) / 1000000;
    const success = roll < clamp(successProbability, 0, 1);
    resultText = lockerRoomFormat(success ? option.resultadoExito : option.resultadoFallo, participants);
    effects = success ? (option.efectosExito || []) : (option.efectosFallo || []);
    message.action.outcome = success ? 'success' : 'failure';
    message.action.successProbability = Math.round(clamp(successProbability, 0, 1) * 1000) / 1000;
  }
  const appliedEffects = lockerRoomApplyEffectList(effects, context);
  resultText = `${resultText}${lockerRoomIssueText(appliedEffects)}`.trim();
  const promise = option.promesa ? lockerRoomCreatePromise(option.promesa, context, message, option) : null;
  if(promise) resultText = `${resultText} ${promise.textPending}`.trim();
  message.action.status = 'resolved';
  message.action.selectedOptionId = String(option.id);
  message.action.selectedOptionText = lockerRoomFormat(option.texto || option.id, participants);
  message.action.resultText = resultText;
  message.action.resolvedTurn = turn;
  message.action.resolvedDate = String(game.currentDate || '');
  message.action.appliedEffects = appliedEffects;
  message.action.promiseId = promise?.id || '';
  message.action.promiseStatus = promise ? 'pending' : '';
  const state = ensureLockerRoomCrisisState();
  if(state && String(state.pendingMessageId || '') === String(message.id)) state.pendingMessageId = '';
  const log = ensureEventLog().find(entry => String(entry.occurrenceId) === String(message.id));
  if(log?.details){
    log.details.status = 'resolved';
    log.details.optionId = String(option.id);
    log.details.optionText = message.action.selectedOptionText;
    log.details.resultText = resultText;
    log.details.appliedEffects = appliedEffects;
    log.details.promiseId = promise?.id || '';
  }
  if(game.lastLockerRoomEvent && String(game.lastLockerRoomEvent.id) === String(event.id)) game.lastLockerRoomEvent.pending = false;
  saveLocal(true);
  if(activeTab === 'messages' && typeof renderMessages === 'function') renderMessages();
  else if(typeof renderAll === 'function') renderAll();
  showNotice('Decisión de vestuario registrada.');
  return true;
}
function processLockerRoomPromisesDaily(){
  if(!game) return { fulfilled:0, failed:0, pending:0 };
  const state = ensureLockerRoomCrisisState();
  const promises = Array.isArray(state?.promises) ? state.promises : [];
  if(!promises.length) return { fulfilled:0, failed:0, pending:0 };
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Math.max(0, Number(game.globalTurn || 0));
  const teamMatches = Math.max(0, Math.round(Number(game.managerStats?.totals?.played || 0)));
  const remaining = [];
  const summary = { fulfilled:0, failed:0, pending:0 };
  promises.forEach(promise => {
    const player = playerById(Number(promise.playerId || 0));
    const playerMatches = Math.max(0, Math.round(Number(game.playerStats?.[promise.playerId]?.played || 0)));
    const fulfilled = player && Number(player.clubId || 0) === Number(game.selectedClubId || 0) && playerMatches > Number(promise.startPlayerMatches || 0);
    const expired = !player || Number(player.clubId || 0) !== Number(game.selectedClubId || 0) || turn >= Number(promise.dueTurn || 0) || teamMatches >= Number(promise.startTeamMatches || 0) + Number(promise.matchesMax || 1);
    if(!fulfilled && !expired){ remaining.push(promise); summary.pending += 1; return; }
    const participants = (promise.participantIds || []).map(id => playerById(Number(id))).filter(Boolean);
    const participantMap = lockerRoomParticipantMap(participants);
    const effects = fulfilled ? promise.effectsFulfilled : promise.effectsFailed;
    lockerRoomApplyEffectList(effects, { eventId:promise.eventId, optionId:promise.optionId, turn, participants, participantMap });
    const originalMessage = (game.messages || []).find(message => String(message.id) === String(promise.messageId || ''));
    if(originalMessage?.action?.type === 'lockerRoomDecision'){
      originalMessage.action.promiseStatus = fulfilled ? 'fulfilled' : 'failed';
      originalMessage.action.promiseResult = fulfilled ? promise.resultFulfilled : promise.resultFailed;
    }
    if(typeof pushGameMessage === 'function') pushGameMessage({
      id:`${promise.id}-${fulfilled ? 'fulfilled' : 'failed'}`,
      type:'vestuario', priority:fulfilled ? 'normal' : 'high',
      title:fulfilled ? 'Promesa cumplida' : 'Promesa incumplida',
      body:fulfilled ? promise.resultFulfilled : promise.resultFailed,
      playerIds:Array.isArray(promise.participantIds) ? promise.participantIds : [promise.playerId],
      playerNames:participants.map(player => String(player.name || 'Jugador'))
    });
    if(fulfilled) summary.fulfilled += 1;
    else summary.failed += 1;
  });
  state.promises = remaining;
  return summary;
}
function processLockerRoomProblemsDaily(options={}){
  if(!game || game.gameOver?.active || !Number(game.selectedClubId || 0)) return { active:false, checked:false, triggered:false };
  const state = ensureLockerRoomCrisisState();
  const clubId = Number(game.selectedClubId || 0);
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Math.max(0, Number(game.globalTurn || 0));
  if(Number(state.clubId) !== clubId || Number(state.season) !== season){
    Object.assign(state, { clubId, season, active:false, startedTurn:0, nextCheckTurn:0, lastCheckTurn:0, checks:0, events:0, recentEventIds:[], lastEventId:'', lastEventDate:'', lastEventTurn:0, pendingMessageId:'', promises:[] });
  }
  const promiseSummary = processLockerRoomPromisesDaily();
  const definitions = lockerRoomProblemDefinitions().filter(event => String(event?.sistema || '') !== 'estrellas');
  if(!definitions.length) return { active:false, checked:false, triggered:false, promiseSummary };
  const settings = lockerRoomCrisisSettings();
  const pending = pendingLockerRoomDecisionMessage();
  if(pending){
    state.pendingMessageId = pending.id;
    return { active:Boolean(state.active), checked:false, triggered:false, pending:true, messageId:pending.id, promiseSummary };
  }
  state.pendingMessageId = '';
  const morale = squadMoraleAverage(clubId);
  const cohesion = cohesionValue(clubId);
  const canStart = morale < settings.moraleThreshold || cohesion < settings.cohesionThreshold;
  const recovered = morale >= settings.moraleThreshold && cohesion >= settings.cohesionThreshold;
  if(state.active && recovered){
    state.active = false;
    state.startedTurn = 0;
    state.nextCheckTurn = 0;
    state.lastCheckTurn = turn;
    return { active:false, recovered:true, checked:false, triggered:false, morale, cohesion, promiseSummary };
  }
  if(!state.active){
    if(!canStart) return { active:false, checked:false, triggered:false, morale, cohesion, promiseSummary };
    state.active = true;
    state.startedTurn = turn;
    state.nextCheckTurn = turn + settings.intervalDays;
    state.lastCheckTurn = turn;
    return { active:true, started:true, checked:false, triggered:false, morale, cohesion, nextCheckTurn:state.nextCheckTurn, promiseSummary };
  }
  if(turn < Number(state.nextCheckTurn || 0)) return { active:true, checked:false, triggered:false, morale, cohesion, nextCheckTurn:state.nextCheckTurn, promiseSummary };
  state.checks += 1;
  state.lastCheckTurn = turn;
  state.nextCheckTurn = turn + settings.intervalDays;
  const roll = lockerRoomHash(`locker-room-roll-${clubId}-${season}-${turn}-${state.checks}`, 1000000) / 1000000;
  const streakStartTurn = Number(state.events || 0) > 0
    ? Math.max(0, Math.round(Number(state.lastEventTurn || 0)))
    : Math.max(0, Math.round(Number(state.startedTurn || 0)));
  const daysWithoutEvent = Math.max(0, turn - streakStartTurn);
  const guaranteed = settings.guaranteeDays > 0 && daysWithoutEvent >= settings.guaranteeDays;
  if(!guaranteed && roll >= settings.probability) return { active:true, checked:true, triggered:false, roll, guaranteed:false, daysWithoutEvent, morale, cohesion, nextCheckTurn:state.nextCheckTurn, promiseSummary };
  const recent = new Set((state.recentEventIds || []).slice(-settings.recentLimit));
  const candidates = definitions.filter(event => !recent.has(String(event.id)));
  const pool = candidates.length ? candidates : definitions;
  const eventIndex = lockerRoomHash(`locker-room-event-${clubId}-${season}-${turn}-${state.events}`, pool.length);
  let selectedEvent = null;
  let participants = [];
  for(let offset=0; offset<pool.length; offset+=1){
    const candidate = pool[(eventIndex + offset) % pool.length];
    const selected = selectLockerRoomParticipants(candidate, `locker-room-${clubId}-${season}-${turn}-${candidate.id}`);
    if(selected.length){
      selectedEvent = candidate;
      participants = selected;
      break;
    }
  }
  if(!selectedEvent) return { active:true, checked:true, triggered:false, roll, guaranteed, daysWithoutEvent, reason:'no_players', morale, cohesion, nextCheckTurn:state.nextCheckTurn, promiseSummary };
  const result = createLockerRoomDecision(selectedEvent, participants, state);
  state.recentEventIds = [...(state.recentEventIds || []), String(selectedEvent.id)].slice(-Math.max(settings.recentLimit, 1));
  return { active:true, checked:true, triggered:Boolean(result), pending:Boolean(result), roll, guaranteed, daysWithoutEvent, morale, cohesion, nextCheckTurn:state.nextCheckTurn, result, promiseSummary };
}

