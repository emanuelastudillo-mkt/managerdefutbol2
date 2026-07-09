/* V3.24 · Motor de eventos condicionales desde data/eventos.json. */

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
    forma: String(squadFitnessAverage(game.selectedClubId))
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
