/* V3.14 · Selección automática, calendario anual, economía, estadio, moral y entrenamiento. */

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
  return `${jobs.length} captación(es) activa(s), próximo informe en ${formatDays(daysUntilTurn(nextDue))}.`;
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

function simulateNextMatchday(){
  if(!game || game.seasonFinalized) return;
  repairBotRosters({ reason:'before_turn' });
  if((game.advanceLockedUntil || 0) > Date.now()){ showNotice(`${currentWeekdayLabel()}: el siguiente avance se habilita el domingo.`); return; }
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
    game.currentDate = dateForSeasonState(game);
    saveLocal(true);
    renderAll();
    showNotice('Comienza la postemporada. Se usarán los días restantes del año antes del cierre de temporada.');
    return;
  }
  if(game.mustReviewTactics){ showNotice('Revisá la táctica: hay lesionados o suspendidos propios que deben ser reemplazados.'); return; }
  const errors = validateCurrentTactic(false);
  if(errors.length){ showNotice(errors.join(' ')); return; }
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 7 días');
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
    game.currentDate = dateForSeasonState(game);
    game.advanceLockedUntil = 0;
  } else {
    game.currentDate = game.fixtures[game.matchdayIndex]?.date || addDaysToIsoDate(round.date, DAYS_PER_ADVANCE);
    game.advanceLockedUntil = Date.now() + ADVANCE_LOCK_MS;
  }
  setRegularTurnSummary(round, ownResult, ownProblems, regularEnded);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  const finalNotice = () => {
    if(game.mustReviewTactics){ showNotice('Fecha simulada. Hay lesionados o expulsados propios: revisá la táctica antes de avanzar.', true); }
    else if(regularEnded){ showNotice('Terminó la fase regular. Comienza la postemporada hasta el cierre anual.', true); }
    else { showNotice(`Fecha ${round.matchday} simulada. La semana avanza hasta el próximo domingo.`); }
  };
  if(ownResult && !regularEnded) showMatchRevealModal(ownResult, finalNotice);
  else finalNotice();
}

function simulatePreseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 7 días de pretemporada');
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
  game.currentDate = dateForSeasonState(game);
  advanceGlobalTurn();
  processAcademyTurn();
  processPendingTransfers();
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= PRESEASON_TURNS){
    game.seasonPhase = 'regular';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    game.advanceLockedUntil = 0;
    if(Number(game.sponsors?.openingOffersSeason || 0) !== Number(game.seasonNumber || 1)){
      generateOpeningSponsorOffers(true);
    }
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice('Pretemporada finalizada. Ya está disponible la primera fecha oficial.', true);
  } else {
    game.advanceLockedUntil = Date.now() + ADVANCE_LOCK_MS;
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice(canFriendly ? `Amistoso jugado ante ${clubName(opponentId)}. La pretemporada avanza.` : 'Semana de pretemporada aplicada.', false);
  }
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(friendlyResult) showMatchRevealModal(friendlyResult);
}

function simulatePostseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 7 días de postemporada');
  generateSeasonEndPlayerOffers();
  applyTrainingEffects();
  processStadiumProjects();
  processSponsorContracts();
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  game.currentDate = dateForSeasonState(game);
  advanceGlobalTurn();
  processAcademyTurn();
  processPendingTransfers();
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= postseasonTurnsForCurrentSeason()){
    game.seasonPhase = 'finalizing';
    game.currentDate = seasonEndDateForYear(currentSeasonYear());
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
    showNotice('Semana de postemporada aplicada.');
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
  showNotice('Replante completo iniciado. El campo quedará muy malo durante 35 días y luego subirá a 99.');
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
  showNotice('Riego y parcheo iniciado. El campo mejorará 5 puntos por avance durante 21 días.');
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
function trainingTone(value){
  return trainingOptionByValue(value)?.tone || trainingOptionByValue(DEFAULT_TRAINING_TYPE)?.tone || 'regen';
}
function safeTrainingType(value){
  return trainingOptionByValue(value) ? value : DEFAULT_TRAINING_TYPE;
}
function playerTrainingType(playerId){
  if(!game.trainingPlan) game.trainingPlan = {};
  if(!trainingOptionByValue(game.trainingPlan[playerId])) game.trainingPlan[playerId] = DEFAULT_TRAINING_TYPE;
  return game.trainingPlan[playerId];
}
function trainingOptionsMarkup(current){
  return TRAINING_OPTIONS.map(opt => `<option value="${opt.value}" ${current===opt.value?'selected':''}>${opt.label}</option>`).join('');
}
function defaultTrainingSchedule(){
  const schedule = {};
  const pattern = TRAINING_DEFAULT_SLOT_PLAN && typeof TRAINING_DEFAULT_SLOT_PLAN === 'object' ? TRAINING_DEFAULT_SLOT_PLAN : {};
  TRAINING_DAY_LABELS.forEach((_, dayIndex) => {
    schedule[dayIndex] = {};
    TRAINING_DAY_SLOTS.forEach(slot => {
      schedule[dayIndex][slot.key] = safeTrainingType(pattern[slot.key] || DEFAULT_TRAINING_TYPE);
    });
  });
  return schedule;
}
function normalizeTrainingSchedule(schedule){
  const normalized = defaultTrainingSchedule();
  if(schedule && typeof schedule === 'object'){
    TRAINING_DAY_LABELS.forEach((_, dayIndex) => {
      const sourceDay = schedule[dayIndex] || schedule[String(dayIndex)] || {};
      TRAINING_DAY_SLOTS.forEach(slot => {
        const raw = sourceDay?.[slot.key];
        if(trainingOptionByValue(raw)) normalized[dayIndex][slot.key] = raw;
      });
    });
  }
  return normalized;
}
function currentTrainingSchedule(){
  game.trainingSchedule = normalizeTrainingSchedule(game.trainingSchedule);
  return game.trainingSchedule;
}
function trainingDayDate(dayIndex){
  const base = validIsoDate(game?.currentDate) ? game.currentDate : dateForSeasonState(game);
  return addDaysToIsoDate(base, Number(dayIndex || 0));
}
function trainingScheduleSlots(){
  const schedule = currentTrainingSchedule();
  const slots = [];
  TRAINING_DAY_LABELS.forEach((dayLabel, dayIndex) => {
    TRAINING_DAY_SLOTS.forEach(slot => {
      slots.push({
        dayIndex,
        dayLabel,
        slotKey:slot.key,
        slotLabel:slot.label,
        type:safeTrainingType(schedule[dayIndex]?.[slot.key])
      });
    });
  });
  return slots;
}
function trainingScheduleCounts(){
  return trainingScheduleSlots().reduce((acc, item) => {
    acc[item.type] = (acc[item.type] || 0) + 1;
    return acc;
  }, {});
}
function trainingLoadMultiplier(){
  const weeklySlots = Math.max(1, TRAINING_DAY_LABELS.length * TRAINING_DAY_SLOTS.length);
  const baselineSlots = Math.max(1, TRAINING_DAY_LABELS.length);
  return (weeklySlots * TRAINING_SLOT_EFFECTIVENESS) / baselineSlots;
}
function trainableSkillsForPlayer(player){
  if(player.position === 'POR') return ['porteria','posicionamiento','serenidad','aceleracion','cabezazo','fuerza','liderazgo','trabajoEquipo','paseCorto','paseLargo','resistencia'];
  if(['LD','LI','DFC'].includes(player.position)) return ['marca','entradas','posicionamiento','fuerza','remate','regate','cabezazo','resistencia','trabajoEquipo'];
  if(['MCD','MC','MCO'].includes(player.position)) return ['paseCorto','paseLargo','vision','tecnica','trabajoEquipo','marca','entradas','posicionamiento','regate','remate','resistencia','serenidad'];
  return ['remate','regate','posicionamiento','serenidad','cabezazo','fuerza','resistencia','tecnica'];
}
function improveRandomSkill(player, chanceScale=1){
  if(!game.playerSkillBoosts) game.playerSkillBoosts = {};
  if(!game.playerSkillBoosts[player.id]) game.playerSkillBoosts[player.id] = {};
  const skills = trainableSkillsForPlayer(player);
  const skill = skills[hashNumber(`${player.id}-${game.matchdayIndex}-${Math.random()}`, skills.length)];
  const chance = clamp(0.50 * Number(chanceScale || 0), 0, 1);
  const gain = Math.random() < chance ? 1 : 0;
  if(gain > 0){
    game.playerSkillBoosts[player.id][skill] = clamp(Number(game.playerSkillBoosts[player.id][skill] || 0) + gain, 0, 30);
  }
  return gain;
}
function applyTrainingSessionToPlayer(player, type, scale, conditionDraft, moraleDraft){
  if(type === 'regenerative'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(1,3) * scale, 0, 99);
  } else if(type === 'massage'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(5,8) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(2,3) * scale, 1, 99);
  } else if(type === 'intense'){
    improveRandomSkill(player, scale);
    conditionDraft[player.id] = clamp(conditionDraft[player.id] - rnd(2,3) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] - rnd(5,6) * scale, 1, 99);
  } else if(type === 'dayoff'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(1,2) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(8,10) * scale, 1, 99);
  }
}
function applyTrainingEffects(){
  if(!game) return;
  game.trainingPlan = game.trainingPlan || {};
  game.trainingSchedule = normalizeTrainingSchedule(game.trainingSchedule);
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  const squad = playersByClub(game.selectedClubId);
  const conditionDraft = {};
  const moraleDraft = {};
  squad.forEach(player => {
    conditionDraft[player.id] = currentCondition(player.id);
    moraleDraft[player.id] = currentMorale(player.id);
  });
  const scale = TRAINING_SLOT_EFFECTIVENESS / Math.max(1, DAYS_PER_ADVANCE);
  let tacticalGain = 0;
  let intenseSessions = 0;
  const slots = trainingScheduleSlots();
  slots.forEach(item => {
    if(item.type === 'tactical'){
      tacticalGain += Math.random() < clamp(0.50 * scale, 0, 1) ? 1 : 0;
      return;
    }
    if(item.type === 'intense') intenseSessions += 1;
    squad.forEach(player => applyTrainingSessionToPlayer(player, item.type, scale, conditionDraft, moraleDraft));
  });
  squad.forEach(player => {
    game.playerCondition[player.id] = clamp(Math.round(conditionDraft[player.id]), 0, 99);
    game.playerMorale[player.id] = clamp(Math.round(moraleDraft[player.id]), 1, 99);
  });
  if(tacticalGain > 0){
    ensureTeamCohesion();
    game.teamCohesion[game.selectedClubId] = clamp(Math.round(cohesionValue(game.selectedClubId) + tacticalGain), 0, 100);
  }
  game.lastTrainingApplied = { ...turnStamp(), tacticalGain, intenseSessions, slotsApplied:slots.length, slotEffectiveness:TRAINING_SLOT_EFFECTIVENESS };
}
function trainingSlotButtonMarkup(dayIndex, slot, current){
  const option = trainingOptionByValue(current) || trainingOptionByValue(DEFAULT_TRAINING_TYPE);
  const tone = trainingTone(current);
  return `<button type="button" class="training-slot training-tone-${tone}" data-open-training-picker="1" data-training-day="${dayIndex}" data-training-slot="${escapeHtml(slot.key)}">
    <span class="training-slot-band">${escapeHtml(slot.label)}</span>
    <strong>${escapeHtml(option.label)}</strong>
  </button>`;
}
function trainingDayCard(dayLabel, dayIndex){
  const schedule = currentTrainingSchedule();
  const date = trainingDayDate(dayIndex);
  return `<div class="training-day-card">
    <div class="training-day-head"><strong>${escapeHtml(dayLabel)}</strong><span>Día ${Math.min(daysInSeasonYear(currentSeasonYear()), currentGlobalDayNumber() + dayIndex)} · ${escapeHtml(date)}</span></div>
    <div class="training-day-slots">
      ${TRAINING_DAY_SLOTS.map(slot => {
        const current = safeTrainingType(schedule[dayIndex]?.[slot.key]);
        return trainingSlotButtonMarkup(dayIndex, slot, current);
      }).join('')}
    </div>
  </div>`;
}
function trainingSummaryMarkup(){
  const counts = trainingScheduleCounts();
  const preferred = ['regenerative','intense','tactical','dayoff'];
  const selected = preferred
    .map(value => trainingOptionByValue(value))
    .filter(Boolean)
    .concat(TRAINING_OPTIONS.filter(opt => !preferred.includes(opt.value) && counts[opt.value]));
  const used = selected.map(opt => `<span class="pill training-pill training-tone-${opt.tone}">${escapeHtml(opt.label)}: ${Number(counts[opt.value] || 0)}</span>`).join('');
  return `<div class="training-summary-row">${used}</div>`;
}
function openTrainingPicker(dayIndex, slotKey){
  const day = TRAINING_DAY_LABELS[dayIndex] || 'Día';
  const slot = TRAINING_DAY_SLOTS.find(item => item.key === slotKey);
  if(!slot) return;
  const schedule = currentTrainingSchedule();
  const current = safeTrainingType(schedule[dayIndex]?.[slotKey]);
  const cards = TRAINING_OPTIONS.map(opt => `
    <button type="button" class="training-picker-card training-tone-${opt.tone} ${current===opt.value?'selected':''}" data-training-choice="${escapeHtml(opt.value)}">
      <strong>${escapeHtml(opt.label)}</strong>
      <span>${trainingOptionDescription(opt.value)}</span>
    </button>`).join('');
  openModal(`
    <div class="training-picker-modal">
      <p class="label">${escapeHtml(day)} · ${escapeHtml(slot.label)}</p>
      <h2>Elegir entrenamiento</h2>
      <div class="training-picker-grid">${cards}</div>
    </div>`);
  document.querySelectorAll('[data-training-choice]').forEach(button => {
    button.addEventListener('click', () => {
      game.trainingSchedule = normalizeTrainingSchedule(game.trainingSchedule);
      game.trainingSchedule[dayIndex][slotKey] = safeTrainingType(button.dataset.trainingChoice);
      saveLocal(true);
      closeModal();
      renderTraining();
      showNotice('Plan semanal actualizado. Se aplicará al próximo avance.');
    });
  });
}
function trainingOptionDescription(value){
  if(value === 'regenerative') return '+ forma física.';
  if(value === 'massage') return '+ forma física y moral.';
  if(value === 'intense') return 'Puede mejorar habilidad; baja forma y moral.';
  if(value === 'tactical') return 'Puede mejorar cohesión total.';
  if(value === 'dayoff') return '+ forma física y mucha moral.';
  return 'Entrenamiento semanal.';
}
function renderTraining(){
  const squad = sortedTrainingPlayers();
  currentTrainingSchedule();
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Entrenamiento</h2>
        <p class="tagline">Planificá 7 días de trabajo. Cada casilla abre una selección rápida de entrenamiento.</p>
      </div>
      <span class="pill">Cohesión: ${cohesionValue(game.selectedClubId)}/100</span>
    </div>
    <div class="card training-calendar-card">
      <div class="row"><h3>Plan semanal</h3><button class="btn ghost small" data-reset-training-week>Restablecer semana</button></div>
      ${trainingSummaryMarkup()}
      <div class="training-week-grid">${TRAINING_DAY_LABELS.map((label, index) => trainingDayCard(label, index)).join('')}</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="row"><h3>Estado del plantel</h3><span class="muted">La planificación semanal afecta a todo el primer equipo.</span></div>
      <div class="table-wrap"><table class="training-table"><thead><tr><th>${trainingColumnSort('Jugador', [['nombre_asc','A-Z'],['nombre_desc','Z-A'],['dorsal_asc','Dorsal ↑'],['dorsal_desc','Dorsal ↓']])}</th><th>${trainingColumnSort('POS', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th><th>${trainingColumnSort('Edad', [['edad_asc','Menor'],['edad_desc','Mayor']])}</th><th>${trainingColumnSort('Media', [['media_desc','Mayor'],['media_asc','Menor']])}</th><th>${trainingColumnSort('Estado físico', [['condicion_desc','Mayor'],['condicion_asc','Menor']])}</th><th>${trainingColumnSort('Moral', [['moral_desc','Mayor'],['moral_asc','Menor']])}</th></tr></thead><tbody>
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
  document.querySelectorAll('[data-open-training-picker]').forEach(button => {
    button.addEventListener('click', () => {
      openTrainingPicker(Number(button.dataset.trainingDay), button.dataset.trainingSlot);
    });
  });
  document.querySelector('[data-reset-training-week]')?.addEventListener('click', () => {
    game.trainingSchedule = defaultTrainingSchedule();
    saveLocal(true);
    renderTraining();
    showNotice('Plan semanal restablecido.');
  });
}
function trainingPlayerRow(player){
  return `<tr>
    <td><div class="training-player-cell">${faceImg(player,'training-face')}<button class="linklike" data-player-id="${player.id}">${availabilityIcons(player.id)}${escapeHtml(player.name)}</button></div></td>
    <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
    <td>${Number(player.age || 0) || '—'}</td>
    <td><strong>${visibleOverall(player)}</strong></td>
    <td>${conditionBar(player.id)}</td>
    <td>${moraleBar(player.id)}</td>
  </tr>`;
}

