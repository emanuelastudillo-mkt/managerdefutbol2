/* V8.08 · Selección automática, cohesión y resúmenes de turno. Extraído de 09-simulation-economy-training.js. */

/* Selección automática, calendario anual, economía, estadio, moral, entrenamiento, bots y eventos. */

function selectLineup(clubId, tactic){
  if(clubId === game?.selectedClubId && tactic?.starters?.length === 11){
    return tactic.starters.map(playerById).filter(Boolean);
  }
  return autoSelectStarters(clubId, tactic);
}
function autoSelectStarters(clubId, tactic){
  const squad = playersByClub(clubId).filter(p => !isUnavailable(p.id));
  const used = new Set();
  const slots = FORMATIONS[tactic?.formation] || FORMATIONS['4-4-2'];
  const lineup = [];
  for(const slot of slots){
    const p = bestPlayerForSlot(squad, slot, used);
    if(p){ used.add(p.id); lineup.push(p); }
  }
  return lineup;
}
function autoSelectBench(clubId, starterIds){
  const starters = new Set(starterIds);
  return playersByClub(clubId)
    .filter(p => !starters.has(p.id) && (clubId !== game?.selectedClubId ? !isUnavailable(p.id) : canBeBench(p.id)))
    .sort((a,b)=>benchOverallValue(b)-benchOverallValue(a))
    .slice(0,10);
}
const AUTO_CONDITION_PRIORITY_MIN = 75;
function conditionSelectionScore(p){
  const condition = currentCondition(p.id);
  const conditionPriority = condition >= AUTO_CONDITION_PRIORITY_MIN ? 1000000 : 0;
  return conditionPriority + condition * 1000 + currentMorale(p.id) * 10 + visibleOverall(p);
}
function conditionFitRank(player, slot){
  if(!player || !slot) return 0;
  const level = playerTacticFitLevel(player, slot);
  if(level === 'exact') return 3;
  if(level === 'role') return 2;
  return 1;
}
function conditionSelectionScoreForSlot(player, slot){
  const condition = currentCondition(player.id);
  const conditionPriority = condition >= AUTO_CONDITION_PRIORITY_MIN ? 1000000 : 0;
  const fitPriority = conditionFitRank(player, slot) * 100000;
  return conditionPriority + fitPriority + condition * 1000 + currentMorale(player.id) * 10 + visibleOverall(player);
}
function autoSelectByBestCondition(clubId){
  const squad = playersByClub(clubId).filter(p => !isUnavailable(p.id));
  const used = new Set();
  const slots = FORMATIONS[game?.tactic?.formation || DEFAULT_TACTIC.formation] || FORMATIONS['4-4-2'];
  const lineup = [];
  for(const slot of slots){
    const candidates = squad.filter(p => !used.has(p.id) && canAssignPlayerToSlot(p, slot));
    const pick = candidates.sort((a,b)=>conditionSelectionScoreForSlot(b, slot)-conditionSelectionScoreForSlot(a, slot))[0];
    if(pick){ used.add(pick.id); lineup.push(pick); }
  }
  return lineup;
}
function autoSelectBenchByBestCondition(clubId, starterIds){
  const starters = new Set(starterIds);
  return playersByClub(clubId)
    .filter(p => !starters.has(p.id) && (clubId !== game?.selectedClubId ? !isUnavailable(p.id) : canBeBench(p.id)))
    .sort((a,b)=>conditionSelectionScore(b)-conditionSelectionScore(a))
    .slice(0,10);
}
function defaultAutoSubs(starters, bench){
  return [0,1,2,3,4].map(i => ({ outId: starters[10-i] || 0, inId: bench[i] || 0, trigger: i < 2 ? 'tired' : 'best' }));
}
function bestPlayerForSlot(squad, slot, used){
  const compatibility = (p) => {
    if(p.position === slot) return 18;
    if(playerFitsSlot(p, slot)) return 6;
    return -999;
  };
  const candidates = squad.filter(p => !used.has(p.id) && canAssignPlayerToSlot(p, slot) && playerFitsSlot(p, slot));
  return candidates.sort((a,b)=>(effectiveOverall(b)+compatibility(b))-(effectiveOverall(a)+compatibility(a)))[0] || null;
}
function ensureTeamCohesion(){
  if(!game) return;
  game.teamCohesion = game.teamCohesion || {};
  game.lastMatchTactics = game.lastMatchTactics || {};
  seed.clubs.forEach(c => { if(!Number.isFinite(game.teamCohesion[c.id])) game.teamCohesion[c.id] = TEAM_COHESION_START; });
}
function cohesionValue(clubId){
  ensureTeamCohesion();
  return clamp(Math.round(game?.teamCohesion?.[clubId] ?? TEAM_COHESION_START), 0, 100);
}
function adjustTeamCohesion(clubId, delta){
  if(!game || !Number(clubId)) return 0;
  ensureTeamCohesion();
  const before = cohesionValue(clubId);
  const after = clamp(Math.round(before + Number(delta || 0)), 0, 100);
  game.teamCohesion[clubId] = after;
  return after - before;
}
function tacticSignature(tactic){
  if(!tactic) return '';
  const normalizeIds = arr => (arr || []).map(Number).filter(Boolean).join(',');
  const starterSet = new Set((tactic.starters || []).map(Number).filter(Boolean));
  const mentality = Object.entries(tactic.playerMentalities || {})
    .filter(([id]) => starterSet.has(Number(id)))
    .map(([id, mode]) => `${Number(id)}:${normalizeMentality(mode)}`)
    .sort()
    .join('|');
  const instructions = window.Simulator20?.normalizeMatchInstructions
    ? window.Simulator20.normalizeMatchInstructions(tactic.matchInstructions)
    : (tactic.matchInstructions || {});
  const instructionSig = ['winning','drawing','losing'].map(key => `${key}:${instructions[key] || 'normal'}`).join('|');
  const sectorStyles = typeof normalizeSectorStyles === 'function' ? normalizeSectorStyles(tactic.sectorStyles) : (tactic.sectorStyles || {});
  const sectorSig = ['defense','midfield','attack'].map(key => `${key}:${sectorStyles[key] || 'posicional'}`).join('|');
  const goalkeeperDistribution = window.Simulator20?.normalizeGoalkeeperDistribution ? window.Simulator20.normalizeGoalkeeperDistribution(tactic.goalkeeperDistribution) : (tactic.goalkeeperDistribution || 'varied');
  const buildUpStyle = window.Simulator20?.normalizeBuildUpStyle ? window.Simulator20.normalizeBuildUpStyle(tactic.buildUpStyle) : (tactic.buildUpStyle || 'possession');
  const layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(tactic.layoutMode) : 'preset';
  const customSig = layoutMode === 'custom' && typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(tactic.customSlots, tactic).join(',') : '';
  return [layoutMode, tactic.formation || '', customSig, normalizeIds(tactic.starters), normalizeIds(tactic.bench), mentality, instructionSig, sectorSig, `gk:${goalkeeperDistribution}`, `build:${buildUpStyle}`].join('::');
}
function managerTacticalAdaptationState(){
  if(!game) return { season:1, signature:'', streak:0, lastBonus:0 };
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  if(!game.managerTacticalAdaptation || typeof game.managerTacticalAdaptation !== 'object' || Array.isArray(game.managerTacticalAdaptation) || Number(game.managerTacticalAdaptation.season || season) !== season){
    game.managerTacticalAdaptation = { season, signature:'', streak:0, lastBonus:0, lastProspectiveStreak:0 };
  }
  return game.managerTacticalAdaptation;
}
function tacticRepetitionSignature(tactic){
  const clean = tactic || {};
  const formation = FORMATIONS[clean.formation] ? clean.formation : DEFAULT_TACTIC.formation;
  const layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(clean.layoutMode) : 'preset';
  const slots = typeof tacticRoleSlots === 'function' ? tacticRoleSlots({ ...clean, formation, layoutMode }) : (FORMATIONS[formation] || FORMATIONS[DEFAULT_TACTIC.formation] || []);
  const customSig = layoutMode === 'custom' && typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(clean.customSlots, clean).join(',') : '';
  const starters = Array.isArray(clean.starters) ? clean.starters.slice(0, 11).map(Number) : [];
  while(starters.length < 11) starters.push(0);
  const mentalities = starters.map((id, index) => {
    const mode = id ? normalizeMentality(clean.playerMentalities?.[id]) : 'normal';
    return `${slots[index] || 'slot'}:${mode}`;
  }).join('|');
  const instructions = window.Simulator20?.normalizeMatchInstructions
    ? window.Simulator20.normalizeMatchInstructions(clean.matchInstructions)
    : (clean.matchInstructions || DEFAULT_TACTIC.matchInstructions || {});
  const instructionSig = ['winning','drawing','losing'].map(key => `${key}:${instructions[key] || 'normal'}`).join('|');
  const sectorStyles = typeof normalizeSectorStyles === 'function' ? normalizeSectorStyles(clean.sectorStyles) : (clean.sectorStyles || {});
  const sectorSig = ['defense','midfield','attack'].map(key => `${key}:${sectorStyles[key] || 'posicional'}`).join('|');
  const goalkeeperDistribution = window.Simulator20?.normalizeGoalkeeperDistribution ? window.Simulator20.normalizeGoalkeeperDistribution(clean.goalkeeperDistribution) : (clean.goalkeeperDistribution || 'varied');
  const buildUpStyle = window.Simulator20?.normalizeBuildUpStyle ? window.Simulator20.normalizeBuildUpStyle(clean.buildUpStyle) : (clean.buildUpStyle || 'possession');
  return [layoutMode, formation, customSig, mentalities, instructionSig, sectorSig, `gk:${goalkeeperDistribution}`, `build:${buildUpStyle}`].join('::');
}
function tacticalAdaptationInfoForMatch(tactic){
  if(!game || !configBoolean('dificultad.adaptacionTactica.activo', true)) return { active:false, bonus:0, streak:0 };
  const state = managerTacticalAdaptationState();
  const signature = tacticRepetitionSignature(tactic || game.tactic || DEFAULT_TACTIC);
  const prospectiveStreak = state.signature === signature ? Math.max(0, Math.round(Number(state.streak || 0))) + 1 : 1;
  const freeMatches = Math.max(1, Math.round(configNumber('dificultad.adaptacionTactica.partidosSinPenalizacion', 3, 1, 20)));
  const bonusPerRepeat = configNumber('dificultad.adaptacionTactica.bonusRivalPorRepeticion', 0.03, 0, 0.20);
  const maxBonus = configNumber('dificultad.adaptacionTactica.bonusRivalMaximo', 0.12, 0, 0.50);
  const overLimit = Math.max(0, prospectiveStreak - freeMatches);
  const bonus = clamp(Number((overLimit * bonusPerRepeat).toFixed(4)), 0, maxBonus);
  return {
    active:bonus > 0,
    signature,
    streak:prospectiveStreak,
    prospectiveStreak,
    freeMatches,
    overLimit,
    bonus,
    bonusPct:Math.round(bonus * 100)
  };
}
function registerManagerTacticalPatternAfterMatch(result=null){
  if(!game || result?.friendly || !configBoolean('dificultad.adaptacionTactica.activo', true)) return null;
  const ownId = Number(game.selectedClubId || 0);
  if(result && Number(result.homeId) !== ownId && Number(result.awayId) !== ownId) return null;
  const info = tacticalAdaptationInfoForMatch(game.tactic || DEFAULT_TACTIC);
  const state = managerTacticalAdaptationState();
  state.signature = info.signature || '';
  state.streak = Math.max(1, Math.round(Number(info.prospectiveStreak || info.streak || 1)));
  state.lastBonus = Number(info.bonus || 0);
  state.lastBonusPct = Math.round(Number(info.bonus || 0) * 100);
  state.lastProspectiveStreak = state.streak;
  state.updatedAtMatchday = Number(game.matchdayIndex || 0);
  state.updatedAtTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game.globalTurn || 0);
  game.lastTacticalAdaptation = info;
  return info;
}

function applyTacticCohesionPenalty(clubId, tactic){
  ensureTeamCohesion();
  const signature = tacticSignature(tactic);
  const last = game.lastMatchTactics?.[clubId];
  if(last && last !== signature){
    game.teamCohesion[clubId] = clamp((game.teamCohesion[clubId] ?? TEAM_COHESION_START) - TEAM_COHESION_TACTIC_CHANGE_LOSS, 0, 100);
  }
  game.lastMatchTactics[clubId] = signature;
}
function applyMatchCohesionResult(match, substitutions=[], cards=[]){
  ensureTeamCohesion();
  [match.homeId, match.awayId].forEach(clubId => {
    const isHome = Number(clubId) === Number(match.homeId);
    const gf = isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
    const gc = isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
    const defeated = gf < gc;
    const subCount = (substitutions || []).filter(s => Number(s.clubId) === Number(clubId)).length;
    const redCount = (cards || []).filter(c => Number(c.clubId) === Number(clubId) && (c.type === 'red' || c.type === 'secondYellowRed')).length;
    const playerChangeLoss = (subCount + redCount) * TEAM_COHESION_PLAYER_CHANGE_LOSS;
    const defeatGoalLoss = defeated ? Math.max(0, gc) * TEAM_COHESION_DEFEAT_GOAL_LOSS : 0;
    const matchGain = defeated ? 0 : TEAM_COHESION_MATCH_GAIN;
    game.teamCohesion[clubId] = clamp((game.teamCohesion[clubId] ?? TEAM_COHESION_START) + matchGain - playerChangeLoss - defeatGoalLoss, 0, 100);
  });
}
function applyMentalityBonus(tactic, assigned){
  const bonus = { attack:0, midfield:0, defense:0 };
  (assigned || []).forEach(entry => {
    const player = entry.player || entry;
    const group = entry.slot ? slotGroup(entry.slot) : playerGroup(player.position);
    const mode = typeof playerMentality === 'function' ? playerMentality(player.id, tactic) : (typeof normalizeMentality === 'function' ? normalizeMentality(tactic?.playerMentalities?.[player.id]) : (tactic?.playerMentalities?.[player.id] || 'normal'));
    const fitFactor = entry.factor ?? 1;
    if(mode === 'muy_ofensivo'){
      bonus.attack += (group === 'att' ? 3.8 : 1.9) * fitFactor;
      bonus.midfield += group === 'mid' ? 0.4 * fitFactor : 0;
      bonus.defense -= group === 'def' ? 1.9 : 0.9;
    }
    if(mode === 'ofensivo'){
      bonus.attack += (group === 'att' ? 2.4 : 1.2) * fitFactor;
      bonus.midfield += group === 'mid' ? 0.5 * fitFactor : 0;
      bonus.defense -= group === 'def' ? 1.2 : 0.6;
    }
    if(mode === 'muy_defensivo'){
      bonus.defense += (group === 'def' || group === 'gk' ? 3.8 : 1.9) * fitFactor;
      bonus.midfield += group === 'mid' ? 0.4 * fitFactor : 0;
      bonus.attack -= group === 'att' ? 1.8 : 0.8;
    }
    if(mode === 'defensivo'){
      bonus.defense += (group === 'def' || group === 'gk' ? 2.4 : 1.2) * fitFactor;
      bonus.midfield += group === 'mid' ? 0.5 * fitFactor : 0;
      bonus.attack -= group === 'att' ? 1.1 : 0.4;
    }
    if(mode === 'normal'){
      bonus.midfield += 0.9 * fitFactor;
      bonus.defense += 0.2 * fitFactor;
      bonus.attack += 0.2 * fitFactor;
    }
  });
  return bonus;
}


function ownResultLine(result){
  if(!result) return '';
  const home = clubName(result.homeId);
  const away = clubName(result.awayId);
  return `${home} ${Number(result.homeGoals || 0)} - ${Number(result.awayGoals || 0)} ${away}`;
}
function ownResultTone(result){
  if(!result) return 'info';
  const isHome = Number(result.homeId) === Number(game.selectedClubId);
  const gf = isHome ? Number(result.homeGoals || 0) : Number(result.awayGoals || 0);
  const gc = isHome ? Number(result.awayGoals || 0) : Number(result.homeGoals || 0);
  if(gf > gc) return 'ok';
  if(gf < gc) return 'bad';
  return 'warn';
}
function ownResultLabel(result){
  const tone = ownResultTone(result);
  if(tone === 'ok') return 'Victoria';
  if(tone === 'bad') return 'Derrota';
  if(tone === 'warn') return 'Empate';
  return 'Sin partido';
}
function activeAcademyScoutingSummary(){
  const jobs = (game?.academy?.scoutingJobs || []).filter(j => j.status === 'pending');
  if(!jobs.length) return null;
  const nextDue = Math.min(...jobs.map(j => Number(j.dueTurn || 0)));
  return `${jobs.length} captación(es) activa(s), próximo informe en ${formatDays(daysUntilTurn(nextDue))}.`;
}
function turnFinanceSummary(){
  const delta = Number(game?.lastBudgetDelta || 0);
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatMoney(delta)} · Presupuesto actual ${formatMoney(game?.budget || 0)}`;
}
function setRegularTurnSummary(round, ownResult, ownProblems, regularEnded, triggeredEvents=[]){
  const items = [];
  if(ownResult){
    items.push({ label:ownResultLabel(ownResult), text:ownResultLine(ownResult), tone:ownResultTone(ownResult) });
    const ticketRevenue = Number(ownResult?.matchContext?.ticketRevenue || 0);
    if(Number(ownResult.homeId) === Number(game.selectedClubId) && ticketRevenue > 0){
      const totalFans = new Intl.NumberFormat('es-AR').format(Number(ownResult?.matchContext?.totalFans || 0));
      const rivalBonus = Number(ownResult?.matchContext?.rivalPrestigeAttendanceBonusPct || 0);
      const marketingBonus = Number(ownResult?.matchContext?.marketingBonusPct || 0);
      const bonusParts = [];
      if(rivalBonus > 0) bonusParts.push(`rival +${rivalBonus}%`);
      if(marketingBonus > 0) bonusParts.push(`marketing +${marketingBonus}%`);
      const bonusText = bonusParts.length ? ` · ${bonusParts.join(' · ')}` : '';
      items.push({ label:'Recaudación de entradas', text:`${formatMoney(ticketRevenue)} por ${totalFans} entradas vendidas${bonusText}.`, tone:'ok' });
    }
    const captainText = typeof captaincyEffectSummary === 'function' ? captaincyEffectSummary(game.lastCaptaincyEffect) : '';
    if(captainText){
      const captainTone = Number(game.lastCaptaincyEffect?.moral || 0) < 0 || Number(game.lastCaptaincyEffect?.cohesion || 0) < 0 ? 'bad' : 'ok';
      items.push({ label:'Capitán', text:captainText, tone:captainTone });
    }
  }
  items.push({ label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' });
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  if(triggeredEvents?.length){
    items.push({ label:'Eventos', text:`${triggeredEvents.length} evento(s) activado(s). Revisá Mensajes.`, tone:'warn' });
  }
  const offers = game.sponsors?.offers?.length || 0;
  if(offers) items.push({ label:'Sponsors', text:`Hay ${offers} oferta(s) de patrocinio disponibles con vencimiento.`, tone:'ok' });
  if(ownProblems?.length){
    items.push({ label:'Revisión obligatoria', text:`${ownProblems.length} jugador(es) requieren cambios en la táctica.`, tone:'bad' });
  }else if(!regularEnded){
    items.push({ label:'Semana', text:'El club queda preparando la próxima fecha.', tone:'info' });
  }
  game.lastTurnSummary = {
    title: regularEnded ? `Fecha ${round.matchday} · fase regular terminada` : `Fecha ${round.matchday} simulada`,
    phase:'Liga',
    result:ownResult ? ownResultLine(ownResult) : '',
    tone:ownResultTone(ownResult),
    items,
    createdAt:Date.now()
  };
}
function setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly){
  const items = [];
  if(friendlyResult){
    items.push({ label:'Amistoso', text:ownResultLine(friendlyResult), tone:ownResultTone(friendlyResult) });
    const captainText = typeof captaincyEffectSummary === 'function' ? captaincyEffectSummary(game.lastCaptaincyEffect) : '';
    if(captainText){
      const captainTone = Number(game.lastCaptaincyEffect?.moral || 0) < 0 || Number(game.lastCaptaincyEffect?.cohesion || 0) < 0 ? 'bad' : 'ok';
      items.push({ label:'Capitán', text:captainText, tone:captainTone });
    }
  }else{
    items.push({ label:'Entrenamiento', text:'Semana aplicada sin amistoso.', tone:'info' });
  }
  items.push({ label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' });
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  game.lastTurnSummary = {
    title:`Pretemporada · ${phaseDayRangeLabel(Math.max(0, Number(game.phaseTurn || 1) - 1), PRESEASON_TURNS)}`,
    phase:'Pretemporada',
    result:friendlyResult ? ownResultLine(friendlyResult) : (canFriendly ? `Amistoso ante ${clubName(opponentId)}` : ''),
    tone:friendlyResult ? ownResultTone(friendlyResult) : 'info',
    items,
    createdAt:Date.now()
  };
}
function setPostseasonTurnSummary(finalized=false){
  const items = [
    { label:'Entrenamiento', text:'Semana de postemporada aplicada.', tone:'info' },
    { label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' }
  ];
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  const pendingOffers = (game.messages || []).filter(m => m.action?.type === 'transferOffer' && m.action.status === 'pending').length;
  if(pendingOffers) items.push({ label:'Mercado', text:`Hay ${pendingOffers} oferta(s) pendientes por jugadores.`, tone:'warn' });
  game.lastTurnSummary = {
    title:finalized ? 'Postemporada finalizada' : `Postemporada · ${phaseDayRangeLabel(Math.max(0, Number(game.phaseTurn || 1) - 1), postseasonTurnsForCurrentSeason())}`,
    phase:'Postemporada',
    result:finalized ? 'Cierre de temporada disponible.' : '',
    tone:finalized ? 'ok' : 'info',
    items,
    createdAt:Date.now()
  };
}

