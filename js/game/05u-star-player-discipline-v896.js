/* V8.97 · Jerarquía, disciplina y conflictos con estrellas.
   Los jugadores de media alta, con gran diferencia respecto del plantel o con un sueldo
   superior al del mánager pueden desafiar su autoridad cuando la disciplina es baja. */

(function(){
  const STAR_SYSTEM_VERSION = 1;

  function spCfg(path, fallback){
    return typeof configValue === 'function' ? configValue(`manager.vestuario.estrellas.${path}`, fallback) : fallback;
  }
  function spClamp(value, min=0, max=100){
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }
  function spRound(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : Math.round(Number(fallback || 0));
  }
  function spHash(text, max=1000000){
    if(typeof lockerRoomHash === 'function') return lockerRoomHash(text, max);
    if(typeof hashNumber === 'function') return hashNumber(String(text || ''), Math.max(1, max));
    let hash = 2166136261;
    String(text || '').split('').forEach(char => { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); });
    return Math.abs(hash >>> 0) % Math.max(1, max);
  }
  function spTurn(){ return typeof currentTurnIndex === 'function' ? Number(currentTurnIndex() || 0) : Number(game?.globalTurn || 0); }
  function spClubId(){ return Number(game?.selectedClubId || 0); }
  function spSeason(){ return Math.max(1, spRound(game?.seasonNumber || 1, 1)); }
  function spPlayers(){
    if(!spClubId()) return [];
    const list = typeof playersByClub === 'function' ? playersByClub(spClubId()) : (seed?.players || []).filter(player => Number(player?.clubId || 0) === spClubId());
    return list.filter(player => player && !player.freeAgent && !player.retired && !player.sold && Number(player.clubId || 0) === spClubId());
  }
  function spOverall(player){ return spClamp(typeof visibleOverall === 'function' ? visibleOverall(player) : Number(player?.overall || 0), 1, 99); }
  function spDiscipline(player){ return spClamp(Number(player?.skills?.disciplina ?? player?.disciplina ?? 50), 1, 99); }
  function spLeadership(player){ return spClamp(Number(player?.skills?.liderazgo ?? 50), 1, 99); }
  function spManagerMonthlySalary(){
    const contract = game?.managerJobContract;
    if(contract && typeof managerContractMonthlySalaryForSeason === 'function') return Math.max(0, Number(managerContractMonthlySalaryForSeason(contract, spSeason()) || 0));
    return Math.max(0, Number(contract?.monthlySalary || 0));
  }
  function spManagerAnnualSalary(){ return spManagerMonthlySalary() * 12; }
  function spDressingStint(){ return typeof managerDressingRoom?.current === 'function' ? managerDressingRoom.current() : null; }
  function spEntry(playerId){ return spDressingStint()?.playerTrust?.[Number(playerId)] || null; }
  function spAverageOverall(players=spPlayers()){
    const values = players.map(spOverall).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 50;
  }
  function spRiskStatus(risk){
    const value = Number(risk || 0);
    if(value >= 70) return { code:'critical', label:'Muy alto', tone:'danger' };
    if(value >= 55) return { code:'high', label:'Alto', tone:'danger' };
    if(value >= 40) return { code:'medium', label:'Moderado', tone:'warn' };
    return { code:'low', label:'Bajo', tone:'ok' };
  }
  function starPlayerProfile(player, roster=spPlayers()){
    if(!player) return null;
    const overall = spOverall(player);
    const discipline = spDiscipline(player);
    const averageOverall = spAverageOverall(roster);
    const overallGap = Math.round((overall - averageOverall) * 10) / 10;
    const managerAnnualSalary = spManagerAnnualSalary();
    const salary = Math.max(0, Number(player.salary || 0));
    const salaryRatio = managerAnnualSalary > 0 ? salary / managerAnnualSalary : 0;
    const entry = spEntry(player.id);
    const influence = spClamp(Number(entry?.influence || 0), 0, 100);
    const trust = spClamp(Number(entry?.value ?? 50), 0, 100);
    const absoluteOverallScore = spClamp((overall - 80) * 1.4, 0, 24);
    const gapScore = spClamp((overallGap - Number(spCfg('diferenciaMediaMinima', 4))) * 1.8, 0, 24);
    const disciplineScore = spClamp((86 - discipline) * 1.6, 0, 36);
    const salaryScore = spClamp((salaryRatio - 1) * 22, 0, 28);
    const influenceScore = spClamp((influence - 65) * 0.25, 0, 8);
    const risk = spClamp(Math.round(absoluteOverallScore + gapScore + disciplineScore + salaryScore + influenceScore), 0, 100);
    const structuralWeight = overall >= Number(spCfg('mediaElite', 85))
      || (overallGap >= Number(spCfg('diferenciaMediaMinima', 4)) + 6 && overall >= Number(spCfg('mediaMinimaFiguraDominante', 70)))
      || salaryRatio >= Number(spCfg('relacionSueldoMinima', 1.05));
    const eligible = spCfg('activo', true) !== false
      && discipline <= Number(spCfg('disciplinaMaxima', 88))
      && structuralWeight
      && risk >= Number(spCfg('umbralRiesgo', 34));
    return {
      playerId:Number(player.id), player, overall, discipline, averageOverall:Math.round(averageOverall * 10) / 10,
      overallGap, salary, managerMonthlySalary:spManagerMonthlySalary(), managerAnnualSalary,
      salaryRatio:Math.round(salaryRatio * 100) / 100, influence, trust, risk, eligible,
      status:spRiskStatus(risk)
    };
  }
  function starPlayerProfiles(){
    const roster = spPlayers();
    return roster.map(player => starPlayerProfile(player, roster)).filter(Boolean).sort((a,b) => b.risk - a.risk || b.overall - a.overall || a.playerId - b.playerId);
  }
  function starPlayerEligibleProfiles(){ return starPlayerProfiles().filter(profile => profile.eligible); }

  function ensureStarPlayerDisciplineState(){
    if(!game) return null;
    const raw = game.starPlayerDiscipline && typeof game.starPlayerDiscipline === 'object' ? game.starPlayerDiscipline : {};
    const clubId = spClubId();
    const season = spSeason();
    const sameScope = Number(raw.clubId || 0) === clubId && Number(raw.season || 0) === season;
    const state = {
      version:STAR_SYSTEM_VERSION,
      clubId,
      season,
      nextCheckTurn:sameScope ? Math.max(0, spRound(raw.nextCheckTurn || 0)) : spTurn() + Math.max(1, spRound(spCfg('esperaInicialDias', 5), 5)),
      lastEventTurn:sameScope ? Number(raw.lastEventTurn ?? -9999) : -9999,
      events:sameScope ? Math.max(0, spRound(raw.events || 0)) : 0,
      recentEventIds:sameScope && Array.isArray(raw.recentEventIds) ? raw.recentEventIds.map(String).slice(-5) : [],
      playerLastTurn:sameScope && raw.playerLastTurn && typeof raw.playerLastTurn === 'object' ? { ...raw.playerLastTurn } : {},
      playerIncidents:sameScope && raw.playerIncidents && typeof raw.playerIncidents === 'object' ? { ...raw.playerIncidents } : {},
      lastDefeatKey:sameScope ? String(raw.lastDefeatKey || '') : '',
      lastPreMatchKey:sameScope ? String(raw.lastPreMatchKey || '') : '',
      lastEventId:sameScope ? String(raw.lastEventId || '') : '',
      lastEventPlayerId:sameScope ? Number(raw.lastEventPlayerId || 0) : 0,
      lastEventDate:sameScope ? String(raw.lastEventDate || '') : ''
    };
    Object.keys(raw).forEach(key => { if(!(key in state)) delete raw[key]; });
    Object.assign(raw, state);
    game.starPlayerDiscipline = raw;
    return raw;
  }

  function spMatchKey(match){
    return String(match?.id || `${match?.date || ''}-${match?.homeId || 0}-${match?.awayId || 0}-${match?.homeGoals ?? 'x'}-${match?.awayGoals ?? 'x'}`);
  }
  function spLatestOwnPlayedMatch(){
    const clubId = spClubId();
    const list = [];
    (game?.fixtures || []).forEach((round, roundIndex) => (round?.matches || []).forEach((match, matchIndex) => {
      if(!match?.played || (Number(match.homeId) !== clubId && Number(match.awayId) !== clubId)) return;
      list.push({ match, roundIndex, matchIndex, date:String(match.date || round?.date || '') });
    }));
    return list.sort((a,b) => String(b.date).localeCompare(String(a.date)) || b.roundIndex - a.roundIndex || b.matchIndex - a.matchIndex)[0] || null;
  }
  function spOwnMatchDefeat(match){
    const clubId = spClubId();
    if(!match?.played) return false;
    const home = Number(match.homeId) === clubId;
    const own = home ? Number(match.homeGoals) : Number(match.awayGoals);
    const rival = home ? Number(match.awayGoals) : Number(match.homeGoals);
    return Number.isFinite(own) && Number.isFinite(rival) && own < rival;
  }
  function spNextMatchContext(){
    const info = typeof nextOwnMatchInfo === 'function' ? nextOwnMatchInfo() : null;
    if(!info?.match || !info?.date) return { days:null, key:'' };
    const today = String(game?.currentDate || '');
    const days = typeof daysBetweenIsoDates === 'function' ? daysBetweenIsoDates(today, info.date) : null;
    return { days:Number.isFinite(Number(days)) ? Number(days) : null, key:spMatchKey(info.match), info };
  }
  function spEventDefinitions(){
    return typeof lockerRoomProblemDefinitions === 'function'
      ? lockerRoomProblemDefinitions().filter(event => String(event?.sistema || '') === 'estrellas')
      : [];
  }
  function spPlayerRecentlyUsed(profile, state, turn){
    const last = Number(state?.playerLastTurn?.[profile.playerId] ?? -9999);
    return turn - last < Math.max(1, spRound(spCfg('enfriamientoJugadorDias', 20), 20));
  }
  function spProfilesForEvent(event, profiles=starPlayerEligibleProfiles(), state=ensureStarPlayerDisciplineState()){
    const starters = new Set((game?.tactic?.starters || []).map(Number));
    const captainId = Number(typeof managerDressingRoom?.hierarchy === 'function' ? managerDressingRoom.hierarchy()?.captainId || 0 : game?.tactic?.captainId || 0);
    let list = profiles.slice();
    if(String(event?.requisito || '') === 'no_titular') list = list.filter(profile => !starters.has(profile.playerId));
    if(String(event?.requisito || '') === 'titular_no_capitan') list = list.filter(profile => starters.has(profile.playerId) && profile.playerId !== captainId && (profile.influence >= 55 || spLeadership(profile.player) >= 70));
    if(String(event?.requisito || '') === 'titular') list = list.filter(profile => starters.has(profile.playerId));
    const fresh = list.filter(profile => !spPlayerRecentlyUsed(profile, state, spTurn()));
    return (fresh.length ? fresh : list).sort((a,b) => b.risk - a.risk || b.overall - a.overall || a.playerId - b.playerId);
  }
  function starPlayerSelectParticipants(event, eligiblePlayers=[], seedText=''){
    if(String(event?.sistema || '') !== 'estrellas') return null;
    const state = ensureStarPlayerDisciplineState();
    const profiles = spProfilesForEvent(event, starPlayerEligibleProfiles(), state);
    if(!profiles.length) return [];
    const bestRisk = profiles[0].risk;
    const shortlist = profiles.filter(profile => profile.risk >= bestRisk - 8).slice(0, 5);
    const selectedProfile = shortlist[spHash(`${seedText}-${event.id}-star`, shortlist.length)];
    const star = selectedProfile?.player;
    if(!star) return [];
    if(String(event.selector || '') === 'problematic_star_captain'){
      const captainId = Number(typeof managerDressingRoom?.hierarchy === 'function' ? managerDressingRoom.hierarchy()?.captainId || 0 : game?.tactic?.captainId || 0);
      let captain = eligiblePlayers.find(player => Number(player.id) === captainId) || null;
      if(!captain || Number(captain.id) === Number(star.id)){
        captain = eligiblePlayers.filter(player => Number(player.id) !== Number(star.id)).sort((a,b) => spLeadership(b) - spLeadership(a) || spOverall(b) - spOverall(a))[0] || null;
      }
      return captain ? [star, captain] : [];
    }
    return [star];
  }

  function starPlayerAuthorityProbability(option={}, context={}, message=null){
    if(option.controlAutoridad !== true) return null;
    const star = context?.participants?.[0];
    const profile = starPlayerProfile(star);
    if(!profile) return Number(option.probabilidadExito ?? 0.5);
    const leadership = spClamp(typeof managerDressingRoom?.leadershipScore === 'function' ? managerDressingRoom.leadershipScore() : Number(game?.managerStats?.careerProfile?.capabilities?.leadership || 50), 0, 100);
    const prestige = spClamp(Number(game?.managerStats?.careerProfile?.prestige || 0) / 10, 0, 100);
    const generalTrust = spClamp(Number(spDressingStint()?.generalTrust || 50), 0, 100);
    const salaryControl = profile.salaryRatio <= 1 ? 100 : spClamp(100 / Math.max(1, profile.salaryRatio), 15, 100);
    const managerPower = leadership * 0.42 + prestige * 0.23 + generalTrust * 0.25 + salaryControl * 0.10;
    const salaryDominance = spClamp((profile.salaryRatio - 1) * 35, 0, 100);
    const playerPower = profile.overall * 0.24 + profile.risk * 0.28 + profile.influence * 0.18 + (100 - profile.discipline) * 0.20 + salaryDominance * 0.10;
    const modifier = Number(option.modificadorAutoridad || 0);
    const minimum = Number(option.probabilidadMinima ?? 0.16);
    const maximum = Number(option.probabilidadMaxima ?? 0.88);
    return spClamp(0.52 + (managerPower - playerPower) / 140 + modifier, minimum, maximum);
  }

  function spWeightedEvent(events, contextType, profiles, state, turn){
    const candidates = [];
    events.forEach(event => {
      const trigger = String(event.disparador || 'general');
      if(trigger !== 'general' && trigger !== contextType) return;
      const suitable = spProfilesForEvent(event, profiles, state);
      if(!suitable.length) return;
      let weight = Math.max(1, Number(event.peso || 1));
      if(trigger === contextType && trigger !== 'general') weight *= 2;
      if((state.recentEventIds || []).includes(String(event.id))) weight *= 0.35;
      for(let index=0; index<Math.max(1, Math.round(weight * 10)); index+=1) candidates.push(event);
    });
    if(!candidates.length) return null;
    return candidates[spHash(`star-event-${spClubId()}-${spSeason()}-${turn}-${state.events}-${contextType}`, candidates.length)] || null;
  }
  function spTriggerProbability(profiles, contextType){
    const maxRisk = profiles.length ? profiles[0].risk : 0;
    const eliteCount = spPlayers().filter(player => spOverall(player) >= Number(spCfg('mediaElite', 85))).length;
    let probability = Number(spCfg('probabilidadBase', 0.025)) + maxRisk / 850 + profiles.length * 0.010 + eliteCount * 0.004;
    if(contextType === 'prepartido') probability += Number(spCfg('bonusPrepartido', 0.10));
    if(contextType === 'derrota') probability += Number(spCfg('bonusTrasDerrota', 0.12));
    return spClamp(probability, 0, Number(spCfg('probabilidadMaxima', 0.30)));
  }
  function processStarPlayerDisciplineDaily(){
    if(!game || game.gameOver?.active || !spClubId() || spCfg('activo', true) === false) return { active:false, checked:false, triggered:false };
    if(typeof hasPendingLockerRoomDecision === 'function' && hasPendingLockerRoomDecision()) return { active:true, checked:false, triggered:false, pending:true };
    const state = ensureStarPlayerDisciplineState();
    const turn = spTurn();
    const profiles = starPlayerEligibleProfiles();
    if(!profiles.length) return { active:true, checked:false, triggered:false, eligible:0 };

    let contextType = '';
    const latest = spLatestOwnPlayedMatch();
    const latestKey = latest ? spMatchKey(latest.match) : '';
    if(latest && spOwnMatchDefeat(latest.match) && latestKey && latestKey !== state.lastDefeatKey){
      state.lastDefeatKey = latestKey;
      contextType = 'derrota';
    }
    const next = spNextMatchContext();
    if(!contextType && next.days === 1 && next.key && next.key !== state.lastPreMatchKey){
      state.lastPreMatchKey = next.key;
      contextType = 'prepartido';
    }
    const dueRegular = turn >= Number(state.nextCheckTurn || 0);
    if(!contextType && !dueRegular) return { active:true, checked:false, triggered:false, eligible:profiles.length, nextCheckTurn:state.nextCheckTurn };
    if(dueRegular) state.nextCheckTurn = turn + Math.max(1, spRound(spCfg('intervaloDias', 8), 8));
    if(!contextType) contextType = 'general';

    const cooldown = Math.max(1, spRound(spCfg('enfriamientoDias', 14), 14));
    if(turn - Number(state.lastEventTurn || -9999) < cooldown){
      return { active:true, checked:true, triggered:false, reason:'cooldown', contextType, eligible:profiles.length };
    }
    const probability = spTriggerProbability(profiles, contextType);
    const roll = spHash(`star-roll-${spClubId()}-${spSeason()}-${turn}-${state.events}-${contextType}`, 1000000) / 1000000;
    if(roll >= probability) return { active:true, checked:true, triggered:false, contextType, probability, roll, eligible:profiles.length };

    const event = spWeightedEvent(spEventDefinitions(), contextType, profiles, state, turn);
    if(!event) return { active:true, checked:true, triggered:false, reason:'no_event', contextType, probability, roll, eligible:profiles.length };
    const participants = starPlayerSelectParticipants(event, spPlayers(), `star-discipline-${turn}-${event.id}`);
    if(!participants.length) return { active:true, checked:true, triggered:false, reason:'no_participant', contextType, probability, roll, eligible:profiles.length };
    const result = typeof createLockerRoomDecision === 'function' ? createLockerRoomDecision(event, participants, null) : null;
    if(!result) return { active:true, checked:true, triggered:false, reason:'create_failed', contextType, probability, roll };

    const profile = starPlayerProfile(participants[0]);
    state.events += 1;
    state.lastEventTurn = turn;
    state.lastEventId = String(event.id);
    state.lastEventPlayerId = Number(participants[0].id);
    state.lastEventDate = String(game.currentDate || '');
    state.recentEventIds = [...state.recentEventIds, String(event.id)].slice(-5);
    state.playerLastTurn[participants[0].id] = turn;
    state.playerIncidents[participants[0].id] = Number(state.playerIncidents[participants[0].id] || 0) + 1;
    if(result.message?.action){
      result.message.action.starDiscipline = {
        risk:profile?.risk || 0, discipline:profile?.discipline || 0, overallGap:profile?.overallGap || 0,
        salaryRatio:profile?.salaryRatio || 0, contextType
      };
    }
    game.lastStarPlayerIncident = { eventId:event.id, playerId:Number(participants[0].id), playerName:String(participants[0].name || 'Jugador'), risk:profile?.risk || 0, turn, date:String(game.currentDate || '') };
    return { active:true, checked:true, triggered:true, pending:true, eventId:event.id, playerId:Number(participants[0].id), contextType, probability, roll, risk:profile?.risk || 0 };
  }

  function spRatioLabel(profile){
    if(!profile?.managerAnnualSalary) return 'Sin contrato salarial comparable';
    if(profile.salaryRatio > 1.05) return `Cobra ${profile.salaryRatio.toFixed(1)} veces el sueldo anual del mánager`;
    if(profile.salaryRatio >= 0.85) return 'Sueldo cercano al del mánager';
    return 'Sueldo inferior al del mánager';
  }
  function starPlayerDressingRoomSummaryMarkup(){
    if(!game || !spClubId()) return '';
    const profiles = starPlayerEligibleProfiles();
    const top = profiles[0] || null;
    const managerSalary = spManagerMonthlySalary();
    const state = ensureStarPlayerDisciplineState();
    const label = top ? top.status.label : 'Controlado';
    const tone = top ? top.status.tone : 'ok';
    return `<section class="card star-discipline-summary"><div class="row"><div><h3>Jerarquía y disciplina</h3><p class="muted small">Las figuras con baja disciplina pueden desafiar tu autoridad por su media, peso interno o salario.</p></div><span class="pill ${tone}">${escapeHtml(label)}</span></div><div class="star-discipline-grid"><div><span>Jugadores propensos</span><strong>${profiles.length}</strong></div><div><span>Sueldo del mánager</span><strong>${managerSalary > 0 ? `${formatMoney(managerSalary)}/mes` : 'Sin contrato'}</strong></div><div><span>Figura de mayor riesgo</span><strong>${top ? escapeHtml(top.player.name || 'Jugador') : 'Ninguna'}</strong>${top ? `<small>Disciplina ${top.discipline} · media +${Math.max(0, top.overallGap).toFixed(1)}</small>` : ''}</div><div><span>Incidentes esta temporada</span><strong>${Number(state?.events || 0)}</strong></div></div></section>`;
  }
  function starPlayerProfileCardMarkup(player){
    if(!player || Number(player.clubId || 0) !== spClubId()) return '';
    const profile = starPlayerProfile(player);
    if(!profile) return '';
    return `<div class="card inner player-star-discipline-card"><h3>Jerarquía y disciplina</h3><div class="stat-rank"><span>Disciplina</span><strong>${profile.discipline}/99</strong></div><div class="stat-rank"><span>Diferencia con la media del plantel</span><strong>${profile.overallGap >= 0 ? '+' : ''}${profile.overallGap.toFixed(1)}</strong></div><div class="stat-rank"><span>Relación salarial</span><strong>${escapeHtml(spRatioLabel(profile))}</strong></div><div class="stat-rank"><span>Riesgo de conflicto</span><strong class="${profile.status.tone}">${profile.risk}/100 · ${escapeHtml(profile.status.label)}</strong></div><p class="muted small-copy">Un riesgo alto no garantiza un incidente. La disciplina, el liderazgo del mánager, su prestigio, la confianza del vestuario y los resultados determinan cada situación.</p></div>`;
  }

  function installStarPlayerDisciplineHooks(){
    if(typeof normalizeGame === 'function'){
      const originalNormalizeGame = normalizeGame;
      normalizeGame = function(saved){
        const normalized = originalNormalizeGame(saved);
        const previousGame = typeof game !== 'undefined' ? game : null;
        try{
          if(normalized && typeof normalized === 'object' && normalized.starPlayerDiscipline && typeof normalized.starPlayerDiscipline !== 'object') normalized.starPlayerDiscipline = {};
        }catch(error){}
        return normalized;
      };
    }
    if(typeof processLockerRoomProblemsDaily === 'function'){
      const originalProcessLockerRoomProblemsDaily = processLockerRoomProblemsDaily;
      processLockerRoomProblemsDaily = function(options={}){
        const standard = originalProcessLockerRoomProblemsDaily(options);
        if(standard?.pending || standard?.triggered) return { ...standard, starDiscipline:{ checked:false, triggered:false, blocked:true } };
        const starDiscipline = processStarPlayerDisciplineDaily();
        return { ...standard, triggered:Boolean(standard?.triggered || starDiscipline?.triggered), pending:Boolean(standard?.pending || starDiscipline?.pending), starDiscipline };
      };
    }
  }

  window.starPlayerDiscipline = {
    version:STAR_SYSTEM_VERSION,
    ensure:ensureStarPlayerDisciplineState,
    profile:starPlayerProfile,
    profiles:starPlayerProfiles,
    eligible:starPlayerEligibleProfiles,
    authorityProbability:starPlayerAuthorityProbability,
    processDaily:processStarPlayerDisciplineDaily
  };
  window.starPlayerProfile = starPlayerProfile;
  window.starPlayerSelectParticipants = starPlayerSelectParticipants;
  window.starPlayerAuthorityProbability = starPlayerAuthorityProbability;
  window.starPlayerDressingRoomSummaryMarkup = starPlayerDressingRoomSummaryMarkup;
  window.starPlayerProfileCardMarkup = starPlayerProfileCardMarkup;

  installStarPlayerDisciplineHooks();
})();
