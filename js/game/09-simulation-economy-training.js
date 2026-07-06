/* V3.08 · Selección automática, cohesión, simulación de turnos, economía, estadio, moral y entrenamiento. */

function selectLineup(clubId, tactic){
  if(clubId === game?.selectedClubId && tactic?.starters?.length === 11){
    return tactic.starters.map(playerById).filter(Boolean);
  }
  return autoSelectStarters(clubId, tactic);
}
function autoSelectStarters(clubId, tactic){
  const squad = playersByClub(clubId).filter(p => clubId !== game?.selectedClubId || !isUnavailable(p.id));
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
function conditionSelectionScore(p){
  return currentCondition(p.id) * 1000 + currentMorale(p.id) * 10 + visibleOverall(p);
}
function autoSelectByBestCondition(clubId){
  const squad = playersByClub(clubId).filter(p => clubId !== game?.selectedClubId || !isUnavailable(p.id));
  const used = new Set();
  const slots = FORMATIONS[game?.tactic?.formation || DEFAULT_TACTIC.formation] || FORMATIONS['4-4-2'];
  const lineup = [];
  for(const slot of slots){
    const candidates = squad.filter(p => !used.has(p.id) && canAssignPlayerToSlot(p, slot));
    const pick = candidates.sort((a,b)=>conditionSelectionScore(b)-conditionSelectionScore(a))[0];
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
function cohesionMultiplier(clubId){
  const c = cohesionValue(clubId);
  if(c <= 30) return clamp(0.50 + (c / 30) * 0.20, 0.50, 0.70);
  if(c <= 50) return clamp(0.70 + ((c - 30) / 20) * 0.30, 0.70, 1.00);
  return clamp(1.00 + ((c - 50) / 50) * 0.20, 1.00, 1.20);
}
function tacticSignature(tactic){
  if(!tactic) return '';
  const normalizeIds = arr => (arr || []).map(Number).filter(Boolean).join(',');
  const mentality = Object.entries(tactic.playerMentalities || {})
    .map(([id, mode]) => `${Number(id)}:${mode}`)
    .sort()
    .join('|');
  const instructions = window.Simulator20?.normalizeMatchInstructions
    ? window.Simulator20.normalizeMatchInstructions(tactic.matchInstructions)
    : (tactic.matchInstructions || {});
  const instructionSig = ['winning','drawing','losing'].map(key => `${key}:${instructions[key] || 'normal'}`).join('|');
  return [tactic.formation || '', normalizeIds(tactic.starters), normalizeIds(tactic.bench), mentality, instructionSig].join('::');
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
    const subCount = (substitutions || []).filter(s => s.clubId === clubId).length;
    const redCount = (cards || []).filter(c => c.clubId === clubId && (c.type === 'red' || c.type === 'secondYellowRed')).length;
    const loss = (subCount + redCount) * TEAM_COHESION_PLAYER_CHANGE_LOSS;
    game.teamCohesion[clubId] = clamp((game.teamCohesion[clubId] ?? TEAM_COHESION_START) + TEAM_COHESION_MATCH_GAIN - loss, 0, 100);
  });
}
function teamPower(clubId, tactic){
  const formation = tactic?.formation || '4-4-2';
  const lineup = selectLineup(clubId, tactic);
  const slots = FORMATIONS[formation] || FORMATIONS['4-4-2'];
  const assigned = lineup.map((player, i) => ({ player, slot:slots[i] || player.position, factor:zoneFactor(player, slots[i] || player.position) }));
  const bySlotGroup = (group) => assigned.filter(a => slotGroup(a.slot) === group);
  const ms = (a, skill) => matchSkill(a.player, skill) * a.factor;
  const defs = bySlotGroup('def');
  const mids = bySlotGroup('mid');
  const atts = bySlotGroup('att');
  const gk = assigned.find(a => a.slot === 'POR');
  let defense = avg(defs.map(a=> avg([ms(a,'marca'),ms(a,'entradas'),ms(a,'posicionamiento'),ms(a,'fuerza')])));
  let midfield = avg(mids.map(a=> avg([ms(a,'paseCorto'),ms(a,'vision'),ms(a,'tecnica'),ms(a,'trabajoEquipo')])));
  let attack = avg(atts.map(a=> avg([ms(a,'remate'),ms(a,'regate'),ms(a,'velocidad'),ms(a,'serenidad')])));
  let discipline = avg(lineup.map(p=>p.skills.disciplina));
  let stamina = avg(lineup.map(p=>matchSkill(p,'resistencia')));
  let aggression = avg(lineup.map(p=>hiddenStats(p).aggression));
  let keeper = gk ? avg([ms(gk,'porteria'),ms(gk,'posicionamiento'),ms(gk,'serenidad')]) : 40;
  const rep = seed.clubs.find(c=>c.id===clubId).reputation;
  const adjust = applyMentalityBonus(tactic || DEFAULT_TACTIC, assigned);
  const cohesion = cohesionMultiplier(clubId);
  return { clubId, lineup, assigned, defense:(defense+adjust.defense)*cohesion, midfield:(midfield+adjust.midfield)*cohesion, attack:(attack+adjust.attack)*cohesion, discipline, stamina:stamina*cohesion, aggression, keeper:keeper*cohesion, reputation:rep };
}
function applyMentalityBonus(tactic, assigned){
  const bonus = { attack:0, midfield:0, defense:0 };
  (assigned || []).forEach(entry => {
    const player = entry.player || entry;
    const group = entry.slot ? slotGroup(entry.slot) : playerGroup(player.position);
    const mode = tactic?.playerMentalities?.[player.id] || 'posicional';
    const fitFactor = entry.factor ?? 1;
    if(mode === 'ataque'){
      bonus.attack += (group === 'att' ? 2.4 : 1.2) * fitFactor;
      bonus.midfield += group === 'mid' ? 0.5 * fitFactor : 0;
      bonus.defense -= group === 'def' ? 1.2 : 0.6;
    }
    if(mode === 'defensiva'){
      bonus.defense += (group === 'def' || group === 'gk' ? 2.4 : 1.2) * fitFactor;
      bonus.midfield += group === 'mid' ? 0.5 * fitFactor : 0;
      bonus.attack -= group === 'att' ? 1.1 : 0.4;
    }
    if(mode === 'posicional'){
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
  const left = Math.max(0, nextDue - currentTurnIndex());
  return `${jobs.length} captación(es) activa(s), próximo informe en ${left} turno(s).`;
}
function turnFinanceSummary(){
  const delta = Number(game?.lastBudgetDelta || 0);
  const sign = delta > 0 ? '+' : '';
  return `${sign}${formatMoney(delta)} · Presupuesto actual ${formatMoney(game?.budget || 0)}`;
}
function setRegularTurnSummary(round, ownResult, ownProblems, regularEnded){
  const items = [];
  if(ownResult){
    items.push({ label:ownResultLabel(ownResult), text:ownResultLine(ownResult), tone:ownResultTone(ownResult) });
  }
  items.push({ label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' });
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  const offers = game.sponsors?.offers?.length || 0;
  if(offers) items.push({ label:'Sponsors', text:`Hay ${offers} oferta(s) de patrocinio disponibles.`, tone:'ok' });
  if(ownProblems?.length){
    items.push({ label:'Revisión obligatoria', text:`${ownProblems.length} jugador(es) requieren cambios en la táctica.`, tone:'bad' });
  }else if(!regularEnded){
    items.push({ label:'Semana', text:'El club queda preparando la próxima jornada.', tone:'info' });
  }
  game.lastTurnSummary = {
    title: regularEnded ? `Jornada ${round.matchday} · fase regular terminada` : `Jornada ${round.matchday} simulada`,
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
  }else{
    items.push({ label:'Entrenamiento', text:'Turno aplicado sin amistoso.', tone:'info' });
  }
  items.push({ label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' });
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  game.lastTurnSummary = {
    title:`Pretemporada · turno ${Number(game.phaseTurn || 0) || PRESEASON_TURNS}`,
    phase:'Pretemporada',
    result:friendlyResult ? ownResultLine(friendlyResult) : (canFriendly ? `Amistoso ante ${clubName(opponentId)}` : ''),
    tone:friendlyResult ? ownResultTone(friendlyResult) : 'info',
    items,
    createdAt:Date.now()
  };
}
function setPostseasonTurnSummary(finalized=false){
  const items = [
    { label:'Entrenamiento', text:'Turno de postemporada aplicado.', tone:'info' },
    { label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' }
  ];
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  const pendingOffers = (game.messages || []).filter(m => m.action?.type === 'transferOffer' && m.action.status === 'pending').length;
  if(pendingOffers) items.push({ label:'Mercado', text:`Hay ${pendingOffers} oferta(s) pendientes por jugadores.`, tone:'warn' });
  game.lastTurnSummary = {
    title:finalized ? 'Postemporada finalizada' : `Postemporada · turno ${Number(game.phaseTurn || 0)}`,
    phase:'Postemporada',
    result:finalized ? 'Cierre de temporada disponible.' : '',
    tone:finalized ? 'ok' : 'info',
    items,
    createdAt:Date.now()
  };
}

function simulateNextMatchday(){
  if(!game || game.seasonFinalized) return;
  repairBotRosters({ reason:'before_turn' });
  if((game.advanceLockedUntil || 0) > Date.now()){ showNotice(`${currentWeekdayLabel()}: el siguiente turno se habilita el domingo.`); return; }
  if(isPreseason()){
    simulatePreseasonTurn();
    return;
  }
  if(isPostseason()){
    simulatePostseasonTurn();
    return;
  }
  if(game.matchdayIndex >= game.fixtures.length){
    showTurnTransition('Cambio de fase');
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    saveLocal(true);
    renderAll();
    showNotice('Comienza la postemporada. Tenés 5 turnos antes del cierre de temporada.');
    return;
  }
  if(game.mustReviewTactics){ showNotice('Revisá la táctica: hay lesionados o suspendidos propios que deben ser reemplazados.'); return; }
  const errors = validateCurrentTactic(false);
  if(errors.length){ showNotice(errors.join(' ')); return; }
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando jornada');
  const round = game.fixtures[game.matchdayIndex];
  const results = round.matches.map(match => simulateMatch(match));
  round.matches.forEach((m,i)=>Object.assign(m, { played:true, homeGoals:results[i].homeGoals, awayGoals:results[i].awayGoals }));
  game.matchHistory.push(...results);
  const ownResult = results.find(m => m.homeId === game.selectedClubId || m.awayId === game.selectedClubId);
  applyConditionUpdates(results);
  applyMoraleUpdates(results);
  applyTrainingEffects();
  advanceStadiumAfterMatches(results);
  processSponsorContracts();
  if(ownResult){
    applyEconomyResult(ownResult);
    updateManagerMatchStats(ownResult);
    maybeGenerateTransferOffer(ownResult);
    advanceSponsorMatchCounter();
  }
  const ownProblems = collectOwnProblems(ownResult);
  removeOwnUnavailableFromTactic(ownProblems);
  game.lastOwnProblems = ownProblems;
  game.mustReviewTactics = game.lastOwnProblems.length > 0;
  game.matchdayIndex += 1;
  advanceGlobalTurn();
  processAcademyTurn();
  processPendingTransfers();
  const regularEnded = game.matchdayIndex >= game.fixtures.length;
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(regularEnded){
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    game.advanceLockedUntil = 0;
  } else {
    game.currentDate = game.fixtures[game.matchdayIndex]?.date || round.date;
    game.advanceLockedUntil = Date.now() + ADVANCE_LOCK_MS;
  }
  setRegularTurnSummary(round, ownResult, ownProblems, regularEnded);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  const finalNotice = () => {
    if(game.mustReviewTactics){ showNotice('Jornada simulada. Hay lesionados o expulsados propios: revisá la táctica antes de avanzar.', true); }
    else if(regularEnded){ showNotice('Terminó la fase regular. Comienzan 5 turnos de postemporada antes del cierre.', true); }
    else { showNotice(`Jornada ${round.matchday} simulada. La semana avanza hasta el próximo domingo.`); }
  };
  if(ownResult && !regularEnded) showMatchRevealModal(ownResult, finalNotice);
  else finalNotice();
}

function simulatePreseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando pretemporada');
  const opponentId = Number(game.pendingFriendlyOpponentId || 0);
  const canFriendly = opponentId && canPlayPreseasonFriendly();
  let friendlyResult = null;
  if(canFriendly){
    const homeOwn = Math.random() < 0.5;
    const match = {
      id:`friendly-t${game.seasonNumber || 1}-${game.phaseTurn || 0}-${game.selectedClubId}-${opponentId}`,
      friendly:true,
      matchday:`PRE-${(game.phaseTurn || 0) + 1}`,
      divisionId:'friendly',
      divisionName:'Amistoso',
      date:game.currentDate || '',
      homeId:homeOwn ? game.selectedClubId : opponentId,
      awayId:homeOwn ? opponentId : game.selectedClubId,
      played:false
    };
    friendlyResult = simulateMatch(match);
    friendlyResult.cards = [];
    friendlyResult.injuries = [];
    friendlyResult.substitutions = [];
    game.matchHistory.push(friendlyResult);
    applyConditionUpdates([friendlyResult]);
    applyMoraleUpdates([friendlyResult]);
    game.preseasonFriendliesPlayed = preseasonFriendliesPlayed() + 1;
  }
  applyTrainingEffects();
  processStadiumProjects();
  processSponsorContracts();
  game.pendingFriendlyOpponentId = 0;
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  advanceGlobalTurn();
  processAcademyTurn();
  processPendingTransfers();
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= PRESEASON_TURNS){
    game.seasonPhase = 'regular';
    game.phaseTurn = 0;
    game.currentDate = game.fixtures[game.matchdayIndex]?.date || game.currentDate;
    game.advanceLockedUntil = 0;
    if(Number(game.sponsors?.openingOffersSeason || 0) !== Number(game.seasonNumber || 1)){
      generateOpeningSponsorOffers(true);
    }
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice('Pretemporada finalizada. Ya está disponible la primera jornada oficial.', true);
  } else {
    game.advanceLockedUntil = Date.now() + ADVANCE_LOCK_MS;
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice(canFriendly ? `Amistoso jugado ante ${clubName(opponentId)}. La pretemporada avanza.` : 'Turno de pretemporada aplicado. La semana avanza.', false);
  }
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(friendlyResult) showMatchRevealModal(friendlyResult);
}

function simulatePostseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando postemporada');
  generateSeasonEndPlayerOffers();
  applyTrainingEffects();
  processStadiumProjects();
  processSponsorContracts();
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  advanceGlobalTurn();
  processAcademyTurn();
  processPendingTransfers();
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= POSTSEASON_TURNS){
    game.seasonPhase = 'finalizing';
    finalizeSeasonIfNeeded();
    game.advanceLockedUntil = 0;
    setPostseasonTurnSummary(true);
    activeTab = 'home';
    saveLocal(true);
    renderAll();
    setTimeout(openSeasonEndModal, 0);
    showNotice('Postemporada finalizada. Cerró la temporada.', true);
  } else {
    game.advanceLockedUntil = Date.now() + ADVANCE_LOCK_MS;
    setPostseasonTurnSummary(false);
    activeTab = 'home';
    saveLocal(true);
    renderAll();
    showNotice('Turno de postemporada aplicado. La semana avanza.');
  }
}


function recordBudgetChange(delta, concept, meta={}){
  if(!game) return;
  game.budgetHistory = game.budgetHistory || [];
  const safeDelta = Math.round(Number(delta) || 0);
  game.budget = Math.max(0, Math.round((game.budget || 0) + safeDelta));
  game.lastBudgetDelta = safeDelta;
  game.budgetHistory.push({
    season:game.seasonNumber || 1,
    matchdayIndex:game.matchdayIndex || 0,
    date:game.currentDate || '',
    concept:concept || 'Movimiento de presupuesto',
    delta:safeDelta,
    budget:game.budget,
    ...meta
  });
}
function budgetConcept(entry){
  if(entry.concept) return entry.concept;
  if(entry.type === 'season_salary') return 'Pago anual de sueldos';
  if(entry.matchId) return 'Resultado de partido';
  return 'Movimiento de presupuesto';
}
function financeSquadRows(){
  return playersByClub(game.selectedClubId)
    .slice()
    .sort((a,b)=>visibleOverall(b)-visibleOverall(a) || a.name.localeCompare(b.name,'es'))
    .map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${nationalityShortMarkup(p.nationality)}</td><td>${Number(p.age || 0) || '—'}</td><td>${visibleOverall(p)}</td><td>${formatMoney(p.salary || 0)}</td></tr>`)
    .join('');
}
function renderFinances(){
  const history = (game.budgetHistory || []).slice().reverse();
  const seasonExpenses = (game.budgetHistory || []).filter(h => (h.season || game.seasonNumber || 1) === (game.seasonNumber || 1) && Number(h.delta || 0) < 0).reduce((a,h)=>a+Math.abs(Number(h.delta || 0)),0);
  const seasonIncome = (game.budgetHistory || []).filter(h => (h.season || game.seasonNumber || 1) === (game.seasonNumber || 1) && Number(h.delta || 0) > 0).reduce((a,h)=>a+Number(h.delta || 0),0);
  const salaryTotal = totalClubSalary(game.selectedClubId);
  const rows = history.slice(0,80).map(entry => {
    const delta = Number(entry.delta || 0);
    const cls = delta > 0 ? 'ok' : delta < 0 ? 'bad' : 'muted';
    return `<tr><td>Temp. ${entry.season || game.seasonNumber || 1}</td><td>${escapeHtml(budgetConcept(entry))}</td><td><span class="${cls}">${delta > 0 ? '+' : ''}${formatMoney(delta)}</span></td><td>${formatMoney(entry.budget || 0)}</td></tr>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title"><div><h2>Finanzas</h2><p class="tagline">Detalle del presupuesto, sus movimientos registrados y la masa salarial del plantel.</p></div></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Presupuesto actual</p><strong>${formatMoney(game.budget || 0)}</strong></div>
      <div class="card"><p class="label">Ingresos temporada</p><strong class="ok">${formatMoney(seasonIncome)}</strong></div>
      <div class="card"><p class="label">Gastos temporada</p><strong class="bad">${formatMoney(seasonExpenses)}</strong></div>
      <div class="card"><p class="label">Sueldos anuales estimados</p><strong>${formatMoney(salaryTotal)}</strong></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Plantel y sueldos</h3>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Nac.</th><th>Edad</th><th>Media</th><th>Sueldo anual</th></tr></thead><tbody>${financeSquadRows() || '<tr><td colspan="5" class="muted">No hay jugadores en el plantel.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Movimientos</h3>
      <div class="table-wrap"><table><thead><tr><th>Temporada</th><th>Concepto</th><th>Monto</th><th>Presupuesto luego</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Todavía no hay movimientos registrados.</td></tr>'}</tbody></table></div>
    </div>`;
}

function totalClubSalary(clubId){
  return playersByClub(clubId).reduce((sum,p)=>sum + Math.max(0, Number(p.salary || 0)), 0);
}
function hasPlayerSalaryPaid(player){
  return Number(player?.salaryPaidCount || 0) > 0 || Number(player?.lastSalaryPaidSeason || 0) > 0;
}
function markClubSalariesPaid(clubId){
  const season = Number(game?.seasonNumber || 1);
  playersByClub(clubId).forEach(player => {
    player.salaryPaidCount = Math.max(0, Number(player.salaryPaidCount || 0)) + 1;
    player.lastSalaryPaidSeason = season;
  });
}
function paySeasonSalaries(){
  const total = totalClubSalary(game.selectedClubId);
  if(total <= 0) return 0;
  markClubSalariesPaid(game.selectedClubId);
  recordBudgetChange(-total, `Pago anual de sueldos de ${clubName(game.selectedClubId)}`, { type:'season_salary' });
  return total;
}
function applyEconomyResult(match){
  const isHome = match.homeId === game.selectedClubId;
  const gf = isHome ? match.homeGoals : match.awayGoals;
  const gc = isHome ? match.awayGoals : match.homeGoals;
  const club = seed.clubs.find(c=>c.id===game.selectedClubId);
  const multiplier = Number.isFinite(club?.prizeMultiplier) ? club.prizeMultiplier : divisionPrizeMultiplier(club?.divisionName || 'Liga Profesional');
  let delta = 0;
  if(gf > gc) delta = Math.round(rnd(300000, 500000));
  else if(gf === gc) delta = Math.round(rnd(100000, 200000));
  else delta = Math.round(rnd(-100000, 50000));
  delta = Math.round(delta * multiplier);
  recordBudgetChange(delta, 'Resultado de partido', { matchId: match.id, multiplier });
}
function advanceStadiumAfterMatches(results){
  ensureStadiumState();
  const homePlayed = new Set((results || []).map(match => match.homeId));
  homePlayed.forEach(clubId => {
    const project = stadiumProjectForClub(clubId);
    if(project.replantingTurnsLeft > 0){
      game.stadium.fields[clubId] = 30;
    } else {
      game.stadium.fields[clubId] = clamp(Math.round(fieldScoreForClub(clubId) - rnd(5,8)), 1, 100);
    }
  });
  processStadiumProjects();
  processSponsorContracts();
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
  ensureStadiumState();
  const project = stadiumProjectForClub(game.selectedClubId);
  if(project.replantingTurnsLeft > 0 || project.patchingTurnsLeft > 0){ showNotice('Ya hay un trabajo de mantenimiento activo en el estadio.'); return; }
  if((game.budget || 0) < REPLANT_COST){ showNotice('Presupuesto insuficiente para replantar todo el campo.'); return; }
  recordBudgetChange(-REPLANT_COST, 'Replante completo del campo', { type:'stadium_replant' });
  project.replantingTurnsLeft = REPLANT_TURNS;
  project.patchingTurnsLeft = 0;
  game.stadium.fields[game.selectedClubId] = 30;
  saveLocal(true);
  showNotice('Replante completo iniciado. El campo quedará muy malo durante 5 turnos y luego subirá a 99.');
  renderStadium();
}
function startPatchingField(){
  if(!game) return;
  ensureStadiumState();
  const project = stadiumProjectForClub(game.selectedClubId);
  if(project.replantingTurnsLeft > 0 || project.patchingTurnsLeft > 0){ showNotice('Ya hay un trabajo de mantenimiento activo en el estadio.'); return; }
  if((game.budget || 0) < PATCH_COST){ showNotice('Presupuesto insuficiente para regar y parchar el campo.'); return; }
  recordBudgetChange(-PATCH_COST, 'Riego y parcheo del campo', { type:'stadium_patch' });
  project.patchingTurnsLeft = PATCH_TURNS;
  saveLocal(true);
  showNotice('Riego y parcheo iniciado. El campo mejorará 5 puntos por turno durante 3 turnos.');
  renderStadium();
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
    (match.playedIdsHome || []).forEach(id => { played.add(id); pitchFatigueByPlayer.set(id, Math.max(pitchFatigueByPlayer.get(id) || 0, extra)); });
    (match.playedIdsAway || []).forEach(id => { played.add(id); pitchFatigueByPlayer.set(id, Math.max(pitchFatigueByPlayer.get(id) || 0, extra)); });
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
      next += rnd(12,18);
      if(played.has(player.id)) next -= conditionLossForPlayer(player) + (pitchFatigueByPlayer.get(player.id) || 0);
      else next += rnd(8,10);
      next += instructionConditionByPlayer.get(player.id) || 0;
    }
    game.playerCondition[player.id] = clamp(Math.round(next), 0, 99);
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
        if(starterSet.has(player.id)) next += rnd(3,6);
        else if(playedSet.has(player.id)) next += rnd(1,2);
        else next -= 2;
        if(team.gf > team.gc) next += rnd(1,3);
        else if(team.gf < team.gc){
          next -= starterSet.has(player.id) ? rnd(5,8) : rnd(3,4);
        }
        game.playerMorale[player.id] = clamp(Math.round(next), 1, 99);
      });
    });
  });
}

function trainingOptionByValue(value){
  return TRAINING_OPTIONS.find(opt => opt.value === value) || null;
}
function trainingLabel(value){
  return trainingOptionByValue(value)?.label || trainingOptionByValue(DEFAULT_TRAINING_TYPE).label;
}
function playerTrainingType(playerId){
  if(!game.trainingPlan) game.trainingPlan = {};
  if(!trainingOptionByValue(game.trainingPlan[playerId])) game.trainingPlan[playerId] = DEFAULT_TRAINING_TYPE;
  return game.trainingPlan[playerId];
}
function trainingOptionsMarkup(current){
  return TRAINING_OPTIONS.map(opt => `<option value="${opt.value}" ${current===opt.value?'selected':''}>${opt.label}</option>`).join('');
}
function trainableSkillsForPlayer(player){
  if(player.position === 'POR') return ['porteria','posicionamiento','serenidad','aceleracion','cabezazo','fuerza','liderazgo','trabajoEquipo','paseCorto','paseLargo','resistencia'];
  if(['LD','LI','DFC'].includes(player.position)) return ['marca','entradas','posicionamiento','fuerza','remate','regate','cabezazo','resistencia','trabajoEquipo'];
  if(['MCD','MC','MCO'].includes(player.position)) return ['paseCorto','paseLargo','vision','tecnica','trabajoEquipo','marca','entradas','posicionamiento','regate','remate','resistencia','serenidad'];
  return ['remate','regate','posicionamiento','serenidad','cabezazo','fuerza','resistencia','tecnica'];
}
function improveRandomSkill(player){
  if(!game.playerSkillBoosts) game.playerSkillBoosts = {};
  if(!game.playerSkillBoosts[player.id]) game.playerSkillBoosts[player.id] = {};
  const skills = trainableSkillsForPlayer(player);
  const skill = skills[hashNumber(`${player.id}-${game.matchdayIndex}-${Math.random()}`, skills.length)];
  const gain = Math.random() < 0.50 ? 1 : 0;
  if(gain > 0){
    game.playerSkillBoosts[player.id][skill] = clamp(Number(game.playerSkillBoosts[player.id][skill] || 0) + gain, 0, 30);
  }
  return gain;
}
function applyTrainingEffects(){
  if(!game) return;
  game.trainingPlan = game.trainingPlan || {};
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  let tacticalGain = 0;
  playersByClub(game.selectedClubId).forEach(player => {
    const type = playerTrainingType(player.id);
    if(type === 'regenerative'){
      game.playerCondition[player.id] = clamp(Math.round(currentCondition(player.id) + rnd(1,3)), 0, 99);
    } else if(type === 'massage'){
      game.playerCondition[player.id] = clamp(Math.round(currentCondition(player.id) + rnd(5,8)), 0, 99);
      game.playerMorale[player.id] = clamp(Math.round(currentMorale(player.id) + rnd(2,3)), 1, 99);
    } else if(type === 'intense'){
      improveRandomSkill(player);
      game.playerCondition[player.id] = clamp(Math.round(currentCondition(player.id) - rnd(2,3)), 0, 99);
      game.playerMorale[player.id] = clamp(Math.round(currentMorale(player.id) - rnd(5,6)), 1, 99);
    } else if(type === 'tactical'){
      tacticalGain += Math.random() < 0.50 ? 1 : 0;
    } else if(type === 'dayoff'){
      game.playerCondition[player.id] = clamp(Math.round(currentCondition(player.id) + rnd(1,2)), 0, 99);
      game.playerMorale[player.id] = clamp(Math.round(currentMorale(player.id) + rnd(8,10)), 1, 99);
    }
  });
  if(tacticalGain > 0){
    ensureTeamCohesion();
    game.teamCohesion[game.selectedClubId] = clamp(Math.round(cohesionValue(game.selectedClubId) + tacticalGain), 0, 100);
  }
  game.lastTrainingApplied = { ...turnStamp(), tacticalGain };
}
function renderTraining(){
  const squad = sortedTrainingPlayers();
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Entrenamiento</h2>
        <p class="tagline">Asigná un entrenamiento especializado por jugador. Los efectos se aplican al avanzar cada turno.</p>
      </div>
      <span class="pill">Cohesión: ${cohesionValue(game.selectedClubId)}/100</span>
    </div>
    <div class="card training-help">
      <div class="grid cols-5 training-option-grid">
        <div><strong>Regenerativo</strong><span>+ forma física.</span></div>
        <div><strong>Masajista</strong><span>+ forma física y moral.</span></div>
        <div><strong>Intenso</strong><span>Puede mejorar habilidad; baja forma y moral.</span></div>
        <div><strong>Táctico</strong><span>Puede mejorar cohesión total.</span></div>
        <div><strong>Día libre</strong><span>+ forma física y mucha moral.</span></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="table-wrap"><table class="training-table"><thead><tr><th>${trainingColumnSort('Jugador', [['nombre_asc','A-Z'],['nombre_desc','Z-A'],['dorsal_asc','Dorsal ↑'],['dorsal_desc','Dorsal ↓']])}</th><th>${trainingColumnSort('POS', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th><th>${trainingColumnSort('Edad', [['edad_asc','Menor'],['edad_desc','Mayor']])}</th><th>${trainingColumnSort('Media', [['media_desc','Mayor'],['media_asc','Menor']])}</th><th>${trainingColumnSort('Estado físico', [['condicion_desc','Mayor'],['condicion_asc','Menor']])}</th><th>${trainingColumnSort('Moral', [['moral_desc','Mayor'],['moral_asc','Menor']])}</th><th>Entrenamiento</th></tr></thead><tbody>
        ${squad.map(player => trainingPlayerRow(player)).join('')}
      </tbody></table></div>
    </div>
  `;
  prependFirstTeamTabs('training');
  document.querySelectorAll('[data-training-sort]').forEach(select => {
    select.addEventListener('change', () => {
      if(select.value){ trainingSort = select.value; renderTraining(); }
    });
  });
  document.querySelectorAll('[data-training-player]').forEach(select => {
    select.addEventListener('change', () => {
      const playerId = Number(select.dataset.trainingPlayer);
      game.trainingPlan = game.trainingPlan || {};
      game.trainingPlan[playerId] = trainingOptionByValue(select.value) ? select.value : DEFAULT_TRAINING_TYPE;
      saveLocal(true);
      showNotice('Entrenamiento actualizado. Se aplicará al avanzar el turno.');
    });
  });
}
function trainingPlayerRow(player){
  const type = playerTrainingType(player.id);
  return `<tr>
    <td><div class="training-player-cell">${faceImg(player,'training-face')}<button class="linklike" data-player-id="${player.id}">${availabilityIcons(player.id)}${escapeHtml(player.name)}</button></div></td>
    <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
    <td>${Number(player.age || 0) || '—'}</td>
    <td><strong>${visibleOverall(player)}</strong></td>
    <td>${conditionBar(player.id)}</td>
    <td>${moraleBar(player.id)}</td>
    <td><select data-training-player="${player.id}">${trainingOptionsMarkup(type)}</select></td>
  </tr>`;
}

