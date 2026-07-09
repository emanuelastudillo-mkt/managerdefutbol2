/* V3.39 · Selección automática, calendario anual, economía, estadio, moral, entrenamiento, bots y eventos. */

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
  const squad = playersByClub(clubId).filter(p => clubId !== game?.selectedClubId || !isUnavailable(p.id));
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
function cohesionMultiplier(clubId){
  const c = cohesionValue(clubId);
  if(c <= 30) return clamp(0.50 + (c / 30) * 0.20, 0.50, 0.70);
  if(c <= 50) return clamp(0.70 + ((c - 30) / 20) * 0.30, 0.70, 1.00);
  return clamp(1.00 + ((c - 50) / 50) * 0.20, 1.00, 1.20);
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
  return [tactic.formation || '', normalizeIds(tactic.starters), normalizeIds(tactic.bench), mentality, instructionSig, sectorSig].join('::');
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
      const bonusText = rivalBonus > 0 ? ` · rival +${rivalBonus}%` : '';
      items.push({ label:'Recaudación de entradas', text:`${formatMoney(ticketRevenue)} por ${totalFans} entradas vendidas${bonusText}.`, tone:'ok' });
    }
  }
  items.push({ label:'Economía', text:turnFinanceSummary(), tone:Number(game.lastBudgetDelta || 0) >= 0 ? 'ok' : 'bad' });
  const academy = activeAcademyScoutingSummary();
  if(academy) items.push({ label:'Academia', text:academy, tone:'info' });
  if(triggeredEvents?.length){
    items.push({ label:'Eventos', text:`${triggeredEvents.length} evento(s) activado(s). Revisá Mensajes.`, tone:'warn' });
  }
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

function advanceLockLeftMs(){
  if(!game) return 0;
  const configured = Math.max(0, DAY_ADVANCE_LOCK_MS || ADVANCE_LOCK_MS || 20000);
  let left = Math.max(0, Number(game.advanceLockedUntil || 0) - Date.now());
  const storedDuration = Math.max(0, Number(game.advanceLockDurationMs || 0));
  if(configured > 0 && left > configured && storedDuration > configured){
    game.advanceLockDurationMs = configured;
    game.advanceLockedUntil = Date.now() + configured;
    left = configured;
  }
  return left;
}
function isAdvanceLocked(){ return advanceLockLeftMs() > 0; }
function setAdvanceLock(ms){
  if(!game) return;
  const duration = Math.max(0, Math.round(Number(ms) || 0));
  game.advanceLockDurationMs = duration;
  game.advanceLockedUntil = duration > 0 ? Date.now() + duration : 0;
}
function currentCalendarDate(){
  if(!game) return '';
  return validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
}
function rememberCalendarDate(){
  if(!game || !validIsoDate(game.currentDate)) return;
  if(validIsoDate(game.lastCalendarDate) && daysBetweenIsoDates(game.currentDate, game.lastCalendarDate) > 0){
    game.currentDate = game.lastCalendarDate;
    return;
  }
  game.lastCalendarDate = game.currentDate;
}
function nextRegularRound(){
  if(!game || !isRegularSeason()) return null;
  if(game.matchdayIndex >= game.fixtures.length) return null;
  return game.fixtures[game.matchdayIndex] || null;
}
function isCurrentDateBeforeIso(targetIso){
  const today = currentCalendarDate();
  return validIsoDate(targetIso) && daysBetweenIsoDates(today, targetIso) > 0;
}
function isCurrentDateOnOrAfterIso(targetIso){
  const today = currentCalendarDate();
  return validIsoDate(targetIso) && daysBetweenIsoDates(today, targetIso) <= 0;
}
function setDailyAdvanceSummary(fromDate, toDate, simulatedCount=0){
  game.lastTurnSummary = {
    title:'Avance diario',
    phase:phaseLabel(),
    result:`${fromDate || '—'} → ${toDate || '—'}`,
    tone:'info',
    items:[
      { label:'Calendario', text:simulatedCount > 0 ? `Se simularon ${simulatedCount} partido(s) de otras ligas programados para la fecha.` : 'El juego avanzó un solo día. No se simuló partido propio.', tone:simulatedCount > 0 ? 'ok' : 'info' },
      { label:'Próximo compromiso', text:nextOwnMatchInfo()?.date ? `Programado para ${nextOwnMatchInfo().date}.` : 'Sin partido confirmado.', tone:'info' }
    ],
    createdAt:Date.now()
  };
}
function ownClubInMatch(match){
  const ownId = Number(game?.selectedClubId || 0);
  return ownId && (Number(match?.homeId) === ownId || Number(match?.awayId) === ownId);
}
function scheduledDateForMatch(match, round=null){
  return validIsoDate(match?.date) ? match.date : (validIsoDate(round?.date) ? round.date : currentCalendarDate());
}
function nextOwnMatchInfo(){
  if(!game || !isRegularSeason()) return null;
  for(let roundIndex=Math.max(0, Number(game.matchdayIndex || 0)); roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    const match = (round.matches || []).find(m => !m.played && ownClubInMatch(m));
    if(match) return { roundIndex, round, match, date:scheduledDateForMatch(match, round) };
  }
  return null;
}
function nextPendingMatchInfo(){
  if(!game || !isRegularSeason()) return null;
  let found = null;
  for(let roundIndex=Math.max(0, Number(game.matchdayIndex || 0)); roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    (round.matches || []).forEach(match => {
      if(match.played) return;
      const date = scheduledDateForMatch(match, round);
      if(!found || daysBetweenIsoDates(found.date, date) < 0) found = { roundIndex, round, match, date };
    });
    if(found) return found;
  }
  return null;
}
function hasOwnMatchDueOnOrBefore(date){
  if(!validIsoDate(date) || !game?.fixtures) return false;
  return game.fixtures.some(round => (round.matches || []).some(match => !match.played && ownClubInMatch(match) && daysBetweenIsoDates(scheduledDateForMatch(match, round), date) >= 0));
}
function collectDueMatchesUntil(targetDate, options={}){
  if(!validIsoDate(targetDate) || !game?.fixtures) return [];
  const includeOwn = options.includeOwn !== false;
  const collected = [];
  for(let roundIndex=Math.max(0, Number(game.matchdayIndex || 0)); roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    (round.matches || []).forEach(match => {
      if(match.played) return;
      if(!includeOwn && ownClubInMatch(match)) return;
      const date = scheduledDateForMatch(match, round);
      if(validIsoDate(date) && daysBetweenIsoDates(date, targetDate) >= 0){
        collected.push({ roundIndex, round, match, date });
      }
    });
  }
  return collected.sort((a,b)=>daysBetweenIsoDates(b.date, a.date) || a.roundIndex-b.roundIndex || String(a.match.id).localeCompare(String(b.match.id)));
}
function currentRoundIsComplete(index=game?.matchdayIndex || 0){
  const round = game?.fixtures?.[index];
  return !!round && (round.matches || []).every(match => match.played);
}
function advanceCompletedRegularRounds(){
  if(!game?.fixtures) return;
  while(game.matchdayIndex < game.fixtures.length && currentRoundIsComplete(game.matchdayIndex)){
    game.matchdayIndex += 1;
  }
}
function quickBotPoisson(lambda){
  const safe = Math.max(0.02, Number(lambda) || 0.02);
  const limit = Math.exp(-safe);
  let k = 0;
  let p = 1;
  do { k++; p *= Math.random(); } while(p > limit && k < 10);
  return clamp(k - 1, 0, 8);
}
function quickClubRating(clubId){
  const club = seed.clubs.find(c => Number(c.id) === Number(clubId)) || { reputation:50 };
  const squad = playersByClub(clubId).slice().sort((a,b)=>effectiveOverall(b)-effectiveOverall(a)).slice(0, 14);
  const top = squad.slice(0, 11);
  const squadAvg = top.length ? avg(top.map(effectiveOverall)) : Number(club.reputation || 50);
  const morale = squad.length ? avg(squad.map(p => currentMorale(p.id))) : 50;
  const condition = squad.length ? avg(squad.map(p => currentCondition(p.id))) : 70;
  const cohesion = typeof cohesionValue === 'function' ? cohesionValue(clubId) : Number(game?.teamCohesion?.[clubId] || 50);
  return squadAvg * 0.62 + Number(club.reputation || 50) * 0.22 + morale * 0.08 + condition * 0.04 + cohesion * 0.04;
}
function quickBotLineup(clubId){
  const squad = playersByClub(clubId)
    .filter(player => !isUnavailable(player.id))
    .sort((a,b) => effectiveOverall(b) - effectiveOverall(a));
  const gk = squad.find(p => String(p.position).toUpperCase() === 'POR');
  const outfield = squad.filter(p => p !== gk);
  return (gk ? [gk] : []).concat(outfield).slice(0, 11);
}
function quickWeightedPick(items, weightFn){
  const safe = (items || []).filter(Boolean);
  if(!safe.length) return null;
  const weighted = safe.map(item => ({ item, w:Math.max(1, Number(weightFn(item)) || 1) }));
  const total = weighted.reduce((sum, x) => sum + x.w, 0);
  let roll = Math.random() * total;
  for(const x of weighted){ roll -= x.w; if(roll <= 0) return x.item; }
  return weighted[0].item;
}
function quickScorerWeight(player){
  if(!player) return 1;
  const pos = String(player.position || '').toUpperCase();
  if(pos === 'POR') return 0.05;
  const bonus = pos === 'DC' ? 150 : ['ED','EI'].includes(pos) ? 110 : pos === 'MCO' ? 70 : ['MC','MD','MI'].includes(pos) ? 32 : ['DFC','LD','LI'].includes(pos) ? 8 : 15;
  return effectiveSkill(player, 'remate') * 1.4 + effectiveSkill(player, 'posicionamiento') + effectiveSkill(player, 'serenidad') * 0.35 + bonus;
}
function quickAssistWeight(player){
  if(!player) return 1;
  if(String(player.position || '').toUpperCase() === 'POR') return 0.5;
  const pos = String(player.position || '').toUpperCase();
  const bonus = ['ED','EI','MCO','MC','MD','MI'].includes(pos) ? 35 : ['MCD','LD','LI'].includes(pos) ? 16 : 6;
  return effectiveSkill(player, 'paseCorto') + effectiveSkill(player, 'vision') + effectiveSkill(player, 'paseLargo') * 0.45 + bonus;
}
function quickDefensiveErrorWeight(player){
  if(!player) return 1;
  const pos = String(player.position || '').toUpperCase();
  const role = pos === 'POR' ? 58 : ['DFC','LD','LI','MCD'].includes(pos) ? 42 : 10;
  const security = (currentMorale(player.id) + currentCondition(player.id) + visibleOverall(player)) / 3;
  return role + Math.max(0, 100 - security);
}
function quickCardWeight(player){
  if(!player) return 1;
  const pos = String(player.position || '').toUpperCase();
  const role = ['DFC','MCD'].includes(pos) ? 35 : ['LD','LI','MC'].includes(pos) ? 22 : 10;
  return role + Math.max(1, 100 - effectiveSkill(player, 'disciplina')) + hiddenStats(player).aggression * 0.35;
}
function quickBuildGoals(clubId, lineup, goalsCount, startMinute=2, endMinute=90){
  const goals = [];
  for(let i=0; i<goalsCount; i++){
    const scorer = quickWeightedPick(lineup, quickScorerWeight);
    if(!scorer) continue;
    const assisters = lineup.filter(p => Number(p.id) !== Number(scorer.id));
    const assister = Math.random() < 0.72 ? quickWeightedPick(assisters, quickAssistWeight) : null;
    goals.push({
      clubId:Number(clubId),
      playerId:Number(scorer.id),
      assistId:assister ? Number(assister.id) : null,
      minute:clamp(Math.round(rnd(startMinute, endMinute)), 1, 90),
      quick:true
    });
  }
  return goals;
}
function quickBuildCards(clubId, lineup, fouls){
  const cards = [];
  const count = clamp(quickBotPoisson(Math.max(0.10, Number(fouls || 0) / 7.4)), 0, 6);
  const yellowByPlayer = new Map();
  for(let i=0; i<count; i++){
    const player = quickWeightedPick(lineup, quickCardWeight);
    if(!player) continue;
    const previous = yellowByPlayer.get(player.id) || 0;
    yellowByPlayer.set(player.id, previous + 1);
    cards.push({ clubId:Number(clubId), playerId:Number(player.id), type: previous ? 'secondYellowRed' : 'yellow', minute:clamp(Math.round(rnd(previous ? 35 : 8, 89)), 1, 90), quick:true });
  }
  const directRedPool = lineup.filter(p => String(p.position || '').toUpperCase() !== 'POR' && hiddenStats(p).aggression > 78);
  if(directRedPool.length && Math.random() < 0.025){
    const player = quickWeightedPick(directRedPool, quickCardWeight);
    if(player) cards.push({ clubId:Number(clubId), playerId:Number(player.id), type:'red', minute:clamp(Math.round(rnd(18, 88)), 1, 90), quick:true });
  }
  return cards.sort((a,b) => a.minute - b.minute);
}
function quickBuildInjuries(clubId, lineup, context){
  const injuries = [];
  const candidates = (lineup || []).filter(player => !isUnavailable(player.id));
  candidates.forEach(player => {
    const chance = Math.max(0, Number(typeof injuryChanceForPlayer === 'function' ? injuryChanceForPlayer(player.id, context?.pitch || 'Normal') : 0.004)) * 0.70;
    if(Math.random() >= chance) return;
    const injury = typeof pickInjuryType === 'function' ? pickInjuryType() : { name:'Lesión muscular', minTurns:7, maxTurns:28, probability:1 };
    const matchesOut = Math.max(1, Math.round(rnd(Number(injury.minTurns || 7), Number(injury.maxTurns || 28) + 1)));
    injuries.push({
      clubId:Number(clubId),
      playerId:Number(player.id),
      type:'injury',
      name:injury.name || 'Lesión',
      injuryLabel:injury.name || 'Lesión',
      probability:injury.probability || 0,
      chance:Math.round(chance * 100),
      matchesOut,
      minute:clamp(Math.round(rnd(12, 90)), 1, 90),
      phase:'durante',
      quick:true
    });
  });
  return injuries.sort((a,b) => a.minute - b.minute);
}
function quickBuildKeySaves(defendingClubId, keeper, chancesAgainst, goalsAgainst, chanceByLineup){
  if(!keeper) return [];
  const volume = Math.max(0, Number(chancesAgainst || 0) - Number(goalsAgainst || 0));
  const count = clamp(quickBotPoisson(volume / 7.5), 0, 5);
  const saves = [];
  for(let i=0; i<count; i++){
    const shooter = quickWeightedPick(chanceByLineup || [], quickScorerWeight);
    saves.push({
      clubId:Number(defendingClubId),
      playerId:Number(keeper.id),
      minute:clamp(Math.round(rnd(5, 90)), 1, 90),
      chanceById:shooter ? Number(shooter.id) : null,
      chanceQuality:Number(rnd(0.20, 0.70).toFixed(2)),
      quick:true
    });
  }
  return saves.sort((a,b) => a.minute - b.minute);
}
function quickBuildErrors(clubId, lineup, goalsAgainst, pressure){
  const count = clamp(quickBotPoisson(Math.max(0.05, Number(pressure || 0) / 10)), 0, 5);
  const errors = [];
  for(let i=0; i<count; i++){
    const player = quickWeightedPick(lineup, quickDefensiveErrorWeight);
    if(!player) continue;
    const goal = i < Number(goalsAgainst || 0) && Math.random() < 0.45;
    errors.push({
      clubId:Number(clubId),
      playerId:Number(player.id),
      minute:clamp(Math.round(rnd(6, 90)), 1, 90),
      goal:Boolean(goal),
      quick:true
    });
  }
  return errors.sort((a,b) => a.minute - b.minute);
}
function quickEnsureStatsForPlayers(players=[]){
  game.playerStats = game.playerStats || {};
  players.forEach(player => {
    if(!player) return;
    if(!game.playerStats[player.id]) game.playerStats[player.id] = typeof createEmptyPlayerStat === 'function'
      ? createEmptyPlayerStat(player)
      : { playerId:player.id, clubId:player.clubId, goals:0, assists:0, yellow:0, red:0, played:0, injuries:0, keySaves:0, errors:0, goalErrors:0 };
    if(typeof normalizePlayerStatRecord === 'function') normalizePlayerStatRecord(game.playerStats[player.id]);
  });
}
function quickSimulateBotMatch(match){
  const homeRating = quickClubRating(match.homeId);
  const awayRating = quickClubRating(match.awayId);
  const homeLineup = quickBotLineup(match.homeId);
  const awayLineup = quickBotLineup(match.awayId);
  quickEnsureStatsForPlayers(homeLineup.concat(awayLineup));
  const context = typeof attendanceContextForMatch === 'function'
    ? { weather:'Normal', pitch:fieldConditionName(fieldScoreForClub(match.homeId)), pitchScore:fieldScoreForClub(match.homeId), ...attendanceContextForMatch(match) }
    : { weather:'Normal', pitch:'Normal', pitchScore:70, totalFans:0, homeCrowdBonus:0 };
  const crowdEdge = Number(context.homeCrowdBonus || 0) / 22;
  const pitchPenalty = (pitchEffect(context.pitch).chanceMultiplier || 1) - 1;
  const edge = (homeRating - awayRating) / 28;
  let homeXg = clamp(1.20 + edge + 0.18 + crowdEdge + pitchPenalty + rnd(-0.20, 0.25), 0.15, 4.40);
  let awayXg = clamp(1.05 - edge * 0.86 + pitchPenalty + rnd(-0.20, 0.24), 0.12, 4.10);
  let homeGoals = quickBotPoisson(homeXg);
  let awayGoals = quickBotPoisson(awayXg);
  if(homeGoals === 0 && awayGoals === 0 && Math.random() < 0.38){
    if(Math.random() < clamp(0.50 + edge * 0.18, 0.25, 0.75)) homeGoals = 1;
    else awayGoals = 1;
  }
  const homePoss = clamp(Math.round(50 + (homeRating-awayRating) * 0.35 + 3 + rnd(-7,7)), 31, 69);
  const awayPoss = 100 - homePoss;
  const homeChances = clamp(Math.round(homeXg * rnd(4.0, 6.5)), Math.max(1, homeGoals), 18);
  const awayChances = clamp(Math.round(awayXg * rnd(4.0, 6.5)), Math.max(1, awayGoals), 18);
  const homeFouls = clamp(Math.round(rnd(6,17)), 2, 30);
  const awayFouls = clamp(Math.round(rnd(6,17)), 2, 30);
  const goals = quickBuildGoals(match.homeId, homeLineup, homeGoals).concat(quickBuildGoals(match.awayId, awayLineup, awayGoals)).sort((a,b) => a.minute - b.minute);
  const cards = quickBuildCards(match.homeId, homeLineup, homeFouls).concat(quickBuildCards(match.awayId, awayLineup, awayFouls)).sort((a,b) => a.minute - b.minute);
  const injuries = quickBuildInjuries(match.homeId, homeLineup, context).concat(quickBuildInjuries(match.awayId, awayLineup, context)).sort((a,b) => a.minute - b.minute);
  const homeKeeper = homeLineup.find(p => String(p.position || '').toUpperCase() === 'POR');
  const awayKeeper = awayLineup.find(p => String(p.position || '').toUpperCase() === 'POR');
  const keySaves = quickBuildKeySaves(match.homeId, homeKeeper, awayChances, awayGoals, awayLineup)
    .concat(quickBuildKeySaves(match.awayId, awayKeeper, homeChances, homeGoals, homeLineup))
    .sort((a,b) => a.minute - b.minute);
  const errors = quickBuildErrors(match.homeId, homeLineup, awayGoals, awayChances)
    .concat(quickBuildErrors(match.awayId, awayLineup, homeGoals, homeChances))
    .sort((a,b) => a.minute - b.minute);
  const homeKeySaves = keySaves.filter(s => Number(s.clubId) === Number(match.homeId)).length;
  const awayKeySaves = keySaves.filter(s => Number(s.clubId) === Number(match.awayId)).length;
  const homeErrors = errors.filter(e => Number(e.clubId) === Number(match.homeId));
  const awayErrors = errors.filter(e => Number(e.clubId) === Number(match.awayId));
  const matchStats = {
    home:{ attacks:clamp(Math.round(24 + homeChances * 3 + rnd(-5,7)), 12, 78), chances:homeChances, possession:homePoss, fouls:homeFouls, passScore:clamp(Math.round(homeRating + rnd(-8,10)), 1, 140), xg:Number(homeXg.toFixed(2)), keySaves:homeKeySaves, errors:homeErrors.length, goalErrors:homeErrors.filter(e=>e.goal).length },
    away:{ attacks:clamp(Math.round(22 + awayChances * 3 + rnd(-5,7)), 12, 78), chances:awayChances, possession:awayPoss, fouls:awayFouls, passScore:clamp(Math.round(awayRating + rnd(-8,10)), 1, 140), xg:Number(awayXg.toFixed(2)), keySaves:awayKeySaves, errors:awayErrors.length, goalErrors:awayErrors.filter(e=>e.goal).length }
  };
  const starterIdsHome = homeLineup.map(p => Number(p.id));
  const starterIdsAway = awayLineup.map(p => Number(p.id));
  const substitutions = [];
  if(!match.friendly){
    applyResultToTables(match, homeGoals, awayGoals);
    if(typeof applyPlayerStats === 'function'){
      applyPlayerStats(match.homeId, homeLineup, substitutions, goals, cards, injuries, keySaves, errors);
      applyPlayerStats(match.awayId, awayLineup, substitutions, goals, cards, injuries, keySaves, errors);
    }
    if(typeof applyAvailability === 'function') applyAvailability(cards, injuries);
    if(typeof updatePlayerStarTrackingForMatch === 'function'){
      updatePlayerStarTrackingForMatch({ ...match, played:true, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves, errors, starterIdsHome, starterIdsAway, playedIdsHome:starterIdsHome, playedIdsAway:starterIdsAway });
    }
  }
  return { ...match, played:true, engine:'bot-rapido-v4.22-estadisticas', homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves, errors, matchStats, matchContext:context, starterIdsHome, starterIdsAway, playedIdsHome:starterIdsHome, playedIdsAway:starterIdsAway, instructionConditionDeltas:{} };
}
function simulateScheduledMatch(match){
  if(FAST_BOT_SIMULATION_ENABLED && !ownClubInMatch(match)) return quickSimulateBotMatch(match);
  return simulateMatch(match);
}
function markScheduledResult(item, result){
  Object.assign(item.match, { played:true, homeGoals:result.homeGoals, awayGoals:result.awayGoals, date:item.date });
}
function simulateDueMatchesUntil(targetDate, options={}){
  const due = collectDueMatchesUntil(targetDate, options);
  const results = [];
  due.forEach(item => {
    const result = simulateScheduledMatch(item.match);
    markScheduledResult(item, result);
    results.push(result);
  });
  if(results.length){
    game.matchHistory.push(...results);
    advanceCompletedRegularRounds();
  }
  return results;
}
function processNonOwnResultsAfterSimulation(results=[]){
  const list = Array.isArray(results) ? results.filter(Boolean) : [];
  if(!list.length) return 0;
  applyPlayerWearFromMatches(list);
  if(typeof applyFanChangesAfterMatches === 'function') applyFanChangesAfterMatches(list);
  if(typeof processBotDismissals === 'function') processBotDismissals();
  advanceStadiumAfterMatches(list);
  return list.length;
}
function simulateNonOwnDueBeforeOwnMatch(targetDate, source='before_own_match'){
  if(!validIsoDate(targetDate)) return [];
  const results = simulateDueMatchesUntil(targetDate, { includeOwn:false });
  processNonOwnResultsAfterSimulation(results);
  if(results.length){
    game.lastBotPreSimulation = {
      source,
      date:targetDate,
      count:results.length,
      season:game.seasonNumber || 1,
      createdAt:Date.now()
    };
  }
  return results;
}

function clearRecoveredDailyInjuries(){
  if(!game?.playerStatus) return 0;
  let cleared = 0;
  Object.entries(game.playerStatus).forEach(([playerId, st]) => {
    if(!st || typeof st !== 'object') return;
    if(Number.isFinite(Number(st.injuredUntilTurn)) && Number(st.injuredUntilTurn || 0) <= currentTurnIndex()){
      const { injuredThrough, injuredUntilTurn, injuryLabel, injuryChance, injuredAtMatchday, injuredAtTurn, ...rest } = st;
      game.playerStatus[playerId] = rest;
      cleared += 1;
    }
  });
  return cleared;
}
function processBankLoanDailySchedule(){
  if(!game || !BANK_LOANS_ENABLED) return 0;
  const state = ensureBankLoanState();
  const loan = state?.active;
  if(!loan) return 0;
  const today = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  if(!validIsoDate(today)) return 0;
  if(!validIsoDate(loan.lastPaymentDate)) loan.lastPaymentDate = validIsoDate(loan.startedDate) ? loan.startedDate : today;
  if(!validIsoDate(loan.nextPaymentDate)) loan.nextPaymentDate = addDaysToIsoDate(loan.lastPaymentDate, 7);
  let charged = 0;
  let guard = 0;
  while(state.active && validIsoDate(state.active.nextPaymentDate) && daysBetweenIsoDates(state.active.nextPaymentDate, today) >= 0 && guard < 10){
    const paid = processBankLoanWeeklyPayment(state.active.nextPaymentDate);
    charged += paid;
    guard += 1;
  }
  return charged;
}

function ensureMonthlyExpensesState(){
  if(!game) return null;
  game.monthlyExpenses = (game.monthlyExpenses && typeof game.monthlyExpenses === 'object' && !Array.isArray(game.monthlyExpenses)) ? game.monthlyExpenses : {};
  game.monthlyExpenses.lastChargeDate = validIsoDate(game.monthlyExpenses.lastChargeDate) ? game.monthlyExpenses.lastChargeDate : (game.currentDate || currentCalendarDate());
  game.monthlyExpenses.matchesPlayed = Math.max(0, Math.round(Number(game.monthlyExpenses.matchesPlayed || 0)));
  return game.monthlyExpenses;
}
function noteOwnMatchForMonthlyExpenses(match){
  if(!MONTHLY_EXPENSES_ENABLED || !game || !match) return;
  if(Number(match.homeId) !== Number(game.selectedClubId) && Number(match.awayId) !== Number(game.selectedClubId)) return;
  const state = ensureMonthlyExpensesState();
  if(!state) return;
  state.matchesPlayed += 1;
}
function processMonthlyClubExpensesDaily(){
  if(!MONTHLY_EXPENSES_ENABLED || !game) return 0;
  const state = ensureMonthlyExpensesState();
  if(!state) return 0;
  const today = game.currentDate || currentCalendarDate();
  if(!validIsoDate(today) || !validIsoDate(state.lastChargeDate)) return 0;
  const elapsed = daysBetweenIsoDates(state.lastChargeDate, today);
  if(elapsed < 30) return 0;
  const months = Math.max(1, Math.floor(elapsed / 30));
  const matches = Math.max(0, Math.round(Number(state.matchesPlayed || 0)));
  const capacity = typeof clubStadiumCapacity === 'function' ? Math.max(0, Math.round(Number(clubStadiumCapacity(game.selectedClubId) || 0))) : 0;
  const fans = typeof clubFansCurrent === 'function' ? Math.max(0, Math.round(Number(clubFansCurrent(game.selectedClubId) || 0))) : 0;
  let charged = 0;
  for(let i=0; i<months; i++){
    const tax = Math.round(Math.max(0, Number(game.budget || 0)) * MONTHLY_PROFIT_TAX_RATE);
    if(tax > 0){ recordBudgetChange(-tax, 'Impuesto mensual de ganancias', { type:'monthly_profit_tax', rate:MONTHLY_PROFIT_TAX_RATE }); charged += tax; }
  }
  if(matches > 0){
    const electricity = Math.round(matches * (MONTHLY_ELECTRICITY_BASE_PER_MATCH + (capacity * MONTHLY_ELECTRICITY_CAPACITY_FACTOR)));
    const cleaning = Math.round(MONTHLY_CLEANING_PER_FAN_PER_MATCH * matches * fans);
    if(electricity > 0){ recordBudgetChange(-electricity, 'Electricidad mensual del club', { type:'monthly_electricity', matches, capacity }); charged += electricity; }
    if(cleaning > 0){ recordBudgetChange(-cleaning, 'Limpieza general mensual', { type:'monthly_cleaning', matches, fans }); charged += cleaning; }
  }
  state.matchesPlayed = 0;
  state.lastChargeDate = addDaysToIsoDate(state.lastChargeDate, months * 30);
  return charged;
}
function processDailyCalendarState(dateBefore='', dateAfter='', options={}){
  if(!game) return { botResults:[], recovered:0, bankPayment:0 };
  const skipTraining = Boolean(options.skipTraining);
  const simulateBots = options.simulateBots !== false;
  const includeOwn = options.includeOwn === true;
  game.currentDate = validIsoDate(dateAfter) ? dateAfter : addDaysToIsoDate(currentCalendarDate(), 1);
  rememberCalendarDate();
  advanceGlobalTurn();
  if(!skipTraining) applyTrainingEffects();
  if(typeof processAcademyTurn === 'function') processAcademyTurn();
  if(typeof processPendingTransfers === 'function') processPendingTransfers();
  if(typeof processStadiumExpansionDays === 'function') processStadiumExpansionDays(1);
  const recovered = clearRecoveredDailyInjuries();
  const bankPayment = processBankLoanDailySchedule();
  if(typeof processSponsorContracts === 'function') processSponsorContracts();
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily();
  if(typeof maybePushAssistantAdviceMessage === 'function') maybePushAssistantAdviceMessage('daily');
  processMonthlyClubExpensesDaily();
  const botResults = simulateBots ? simulateDueMatchesUntil(game.currentDate, { includeOwn }) : [];
  if(botResults.length) processNonOwnResultsAfterSimulation(botResults);
  return { botResults, recovered, bankPayment };
}
function setAutoAdvanceButtonLoading(active){
  const btn = $('advanceUnifiedBtn') || $('advanceMatchBtn') || $('advanceDayBtn');
  if(!btn) return;
  btn.classList.toggle('is-loading', Boolean(active));
  btn.disabled = Boolean(active);
  btn.innerHTML = active ? '<span class="mini-spinner" aria-hidden="true"></span><span>Avanzando...</span>' : 'Avanzar día';
}
function showAutoAdvanceOverlay(totalDays, currentDate='', targetDate=''){
  let root = $('autoAdvanceOverlay');
  if(root) root.remove();
  const host = $('advanceProgressBox');
  root = document.createElement('div');
  root.id = 'autoAdvanceOverlay';
  root.className = host ? 'auto-advance-inline' : 'auto-advance-floating';
  root.innerHTML = `<div class="auto-advance-card">
    <div class="auto-advance-head"><div class="turn-spinner" aria-hidden="true"></div><strong>Avanzando días</strong></div>
    <span class="auto-advance-status">Preparando calendario diario...</span>
    <div class="turn-transition-bar"><i style="width:0%"></i></div>
    <p class="muted small">${escapeHtml(currentDate || '—')} → ${escapeHtml(targetDate || '—')} · ${totalDays} día${totalDays === 1 ? '' : 's'}</p>
  </div>`;
  if(host){ host.innerHTML = ''; host.appendChild(root); }
  else document.body.appendChild(root);
  setAutoAdvanceButtonLoading(true);
  return root;
}
function updateAutoAdvanceOverlay(root, data={}){
  if(!root) return;
  const pct = clamp(Math.round(Number(data.progress || 0) * 100), 0, 100);
  const status = root.querySelector('.auto-advance-status');
  const bar = root.querySelector('.turn-transition-bar i');
  if(status) status.textContent = data.text || 'Avanzando calendario...';
  if(bar) bar.style.width = `${pct}%`;
}
function closeAutoAdvanceOverlay(root){
  if(root){
    root.classList.add('is-exiting');
    setTimeout(()=>{
      root.remove();
      const box = $('advanceProgressBox');
      if(box && !box.querySelector('[data-advance-progress-fill]')) box.innerHTML = advanceProgressMarkup();
      updateAdvanceProgressBox();
    }, 260);
  }
  setAutoAdvanceButtonLoading(false);
}
function startAutoAdvanceToNextOwnMatch(){
  if(!game || !isRegularSeason()) return false;
  if(startAutoAdvanceToNextOwnMatch.active){ showNotice('Ya se está avanzando el calendario diario.'); return true; }
  const ownInfo = nextOwnMatchInfo();
  if(!ownInfo?.date){ showNotice('No hay próximo partido propio programado.'); return false; }
  const fromDate = currentCalendarDate();
  const targetDate = ownInfo.date;
  if(!isCurrentDateBeforeIso(targetDate)){
    const bots = simulateNonOwnDueBeforeOwnMatch(targetDate, 'own_match_day_ready');
    if(bots.length){ saveLocal(true); renderAll(); showNotice(`Se simularon ${bots.length} partido(s) pendientes del día. Ya podés jugar tu partido.`); return true; }
    return false;
  }
  const totalDays = Math.max(1, daysBetweenIsoDates(fromDate, targetDate));
  const duration = Math.max(1200, isAdvanceLocked() ? advanceLockLeftMs() : ADVANCE_LOCK_MS);
  const stepMs = Math.max(120, Math.round(duration / totalDays));
  const overlay = showAutoAdvanceOverlay(totalDays, fromDate, targetDate);
  const processed = { days:0, bots:0, recovered:0 };
  startAutoAdvanceToNextOwnMatch.active = true;
  setAdvanceLock(duration);
  const tick = () => {
    if(!game || !isRegularSeason()){
      startAutoAdvanceToNextOwnMatch.active = false;
      closeAutoAdvanceOverlay(overlay);
      return;
    }
    const current = currentCalendarDate();
    if(!validIsoDate(current) || daysBetweenIsoDates(current, targetDate) <= 0){
      const sameDayBots = simulateNonOwnDueBeforeOwnMatch(targetDate, 'auto_advance_target_day');
      processed.bots += sameDayBots.length;
      game.currentDate = targetDate;
      setAdvanceLock(0);
      setDailyAdvanceSummary(fromDate, targetDate, processed.bots);
      saveLocal(true);
      renderAll();
      updateAutoAdvanceOverlay(overlay, { progress:1, text:`Listo. Llegaste al día del partido: ${targetDate}.` });
      setTimeout(()=>closeAutoAdvanceOverlay(overlay), 650);
      startAutoAdvanceToNextOwnMatch.active = false;
      showNotice(`Calendario avanzado. Se simularon ${processed.bots} partido(s) bot en el camino. Ya podés jugar tu partido.`);
      return;
    }
    const nextDate = addDaysToIsoDate(current, 1);
    const dayResult = processDailyCalendarState(current, nextDate, { includeOwn:false });
    processed.days += 1;
    processed.bots += dayResult.botResults.length;
    processed.recovered += dayResult.recovered;
    updateAutoAdvanceOverlay(overlay, {
      progress:processed.days / totalDays,
      text:`${matchDateLabel(nextDate)} · ${dayResult.botResults.length ? `${dayResult.botResults.length} partido(s) bot simulados` : 'sin partidos bot'}`
    });
    setTimeout(tick, stepMs);
  };
  tick();
  return true;
}
function completeRegularSeasonIfNeeded(){
  if(!game || !isRegularSeason()) return false;
  if(game.matchdayIndex < game.fixtures.length) return false;
  if(typeof createArgentinePromotionPlayoffsIfNeeded === 'function' && createArgentinePromotionPlayoffsIfNeeded()){
    saveLocal(true);
    renderAll();
    showNotice('Se creó el calendario de playoffs de promoción. Ya podés avanzar al partido siguiente.', true);
    return true;
  }
  game.seasonPhase = 'postseason';
  game.phaseTurn = 0;
  game.currentDate = dateForSeasonState(game);
  rememberCalendarDate();
  setAdvanceLock(0);
  saveLocal(true);
  renderAll();
  showNotice('La fase regular terminó. Comienza la postemporada.', true);
  return true;
}
function applyUnifiedAdvanceCooldown(reason='daily'){
  if(!game) return;
  const duration = Math.max(0, DAY_ADVANCE_LOCK_MS || ADVANCE_LOCK_MS || 20000);
  setAdvanceLock(duration);
  game.lastAdvanceCooldownReason = reason;
}
function advanceCalendarOneStep(){
  if(!game || game.seasonFinalized) return;
  if(game.gameOver?.active){ showNotice('Estás sin club. Usá Buscar club para continuar tu carrera.'); return; }
  if(startAutoAdvanceToNextOwnMatch.active){ showNotice('Ya se está procesando el calendario.'); return; }
  if(isAdvanceLocked()){ showNotice(`Avance bloqueado por ${formatClock(advanceLockLeftMs())}.`); return; }
  repairBotRosters({ reason:'before_unified_day_advance' });
  if(isPreseason()){
    simulatePreseasonTurn();
    return;
  }
  if(isPostseason()){
    simulatePostseasonTurn();
    return;
  }
  if(!isRegularSeason()){
    simulateNextMatchday({ advanceLabel:'Avanzando día' });
    return;
  }
  if(completeRegularSeasonIfNeeded()) return;
  const ownInfo = nextOwnMatchInfo();
  if(ownInfo?.date && isCurrentDateOnOrAfterIso(ownInfo.date)){
    simulateNextMatchday({ advanceLabel:'Jugando partido propio' });
    return;
  }
  const fromDate = currentCalendarDate();
  const nextDate = addDaysToIsoDate(fromDate, 1);
  const dayResult = processDailyCalendarState(fromDate, nextDate, { includeOwn:false });
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const playoffCreated = regularEnded && typeof createArgentinePromotionPlayoffsIfNeeded === 'function' && createArgentinePromotionPlayoffsIfNeeded();
  if(playoffCreated) regularEnded = game.matchdayIndex >= game.fixtures.length;
  if(regularEnded){
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    setAdvanceLock(0);
  }else{
    applyUnifiedAdvanceCooldown('daily');
  }
  setDailyAdvanceSummary(fromDate, nextDate, dayResult.botResults.length);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(playoffCreated) showNotice('Se completó la liga y se creó el calendario de playoffs de promoción.', true);
  else if(regularEnded) showNotice('Se completaron los partidos pendientes y terminó la fase regular.', true);
  else if(dayResult.botResults.length) showNotice(`Avanzaste al ${nextDate}. Se procesaron ${dayResult.botResults.length} partido(s) bot durante el cooldown.`);
  else showNotice(`Avanzaste al ${nextDate}. Verificaciones listas; el botón queda en cooldown.`);
}

function finalizeLiveOwnMatchdayResult(context, ownResult){
  if(!game || !ownResult || !context) return;
  const {
    ownInfo,
    pendingInfo,
    targetDate,
    preOwnBotResults,
    budgetBeforeTurn,
    fromRoundIndex
  } = context;
  const results = [ownResult];
  if(ownInfo?.match) markScheduledResult({ match:ownInfo.match, date:targetDate }, ownResult);
  game.matchHistory.push(ownResult);
  advanceCompletedRegularRounds();
  applyConditionUpdates(results);
  applyMoraleUpdates(results);
  if(typeof applyFanChangesAfterMatches === 'function') applyFanChangesAfterMatches(results);
  maintainBotBalanceDuringSeason();
  if(typeof processBotDismissals === 'function') processBotDismissals();
  advanceStadiumAfterMatches(results);
  applyEconomyResult(ownResult);
  updateManagerMatchStats(ownResult);
  maybeGenerateTransferOffer(ownResult);
  advanceSponsorMatchCounter();
  if(typeof awardSpecialPointsForOwnMatch === 'function') awardSpecialPointsForOwnMatch(ownResult);
  const summaryRound = game.fixtures[fromRoundIndex] || ownInfo?.round || pendingInfo?.round || { matchday:'—', date:targetDate, matches:[] };
  const triggeredEvents = processGameEventsAfterMatches({ round:summaryRound, results, ownResult });
  const ownProblems = collectOwnProblems(ownResult);
  removeOwnUnavailableFromTactic(ownProblems);
  game.lastOwnProblems = ownProblems;
  game.mustReviewTactics = game.lastOwnProblems.length > 0;
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const playoffCreated = regularEnded && typeof createArgentinePromotionPlayoffsIfNeeded === 'function' && createArgentinePromotionPlayoffsIfNeeded();
  if(playoffCreated) regularEnded = game.matchdayIndex >= game.fixtures.length;
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - Number(budgetBeforeTurn || 0));
  if(regularEnded){
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    rememberCalendarDate();
    setAdvanceLock(0);
  }else{
    game.currentDate = targetDate;
    rememberCalendarDate();
    applyUnifiedAdvanceCooldown('match');
  }
  setRegularTurnSummary(summaryRound, ownResult, ownProblems, regularEnded || playoffCreated, triggeredEvents);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  if(game.mustReviewTactics) showNotice('Partido dirigido. Hay lesionados o expulsados propios: revisá la táctica antes de avanzar.', true);
  else if(playoffCreated) showNotice('Terminó la liga regular y se creó el calendario de playoffs de promoción.', true);
  else if(regularEnded) showNotice('Terminó la fase regular. Comienza la postemporada hasta el cierre anual.', true);
  else showNotice(`Partido propio dirigido por bloques. Antes se procesaron ${(preOwnBotResults || []).length} partido(s) del mismo día o pendientes.`);
}

function liveMatchEngineStatus(){
  const missing = [];
  if(!window.Simulator20) missing.push('simulador-2.0.js no cargó');
  else if(typeof window.Simulator20.createLiveMatchSession !== 'function' || typeof window.Simulator20.simulateLiveBlock !== 'function') missing.push('simulador-2.0.js está viejo o incompleto');
  if(!window.LiveMatchUI || typeof window.LiveMatchUI.start !== 'function') missing.push('js/game/17-live-match.js no cargó');
  return { ok:missing.length === 0, missing };
}
function showLiveMatchEngineBlocked(status){
  const details = (status?.missing || []).map(item => `<li>${escapeHtml(item)}</li>`).join('');
  const html = `<div class="card inner">
    <p class="label">Simulación viva no disponible</p>
    <h2>No se va a usar el simulador anterior</h2>
    <p class="muted">El partido propio quedó pendiente para evitar que se resuelva con el sistema viejo.</p>
    ${details ? `<ul class="live-engine-errors">${details}</ul>` : ''}
    <p class="muted small">Subí también los archivos nuevos del ZIP, especialmente <strong>js/game/17-live-match.js</strong>, <strong>simulador-2.0.js</strong>, <strong>index.html</strong> y <strong>js/game/09-simulation-economy-training.js</strong>. Después usá Control + F5.</p>
    <div class="modal-actions"><button class="primary" onclick="closeModal()">Entendido</button></div>
  </div>`;
  if(typeof openModal === 'function') openModal(html);
  showNotice('No se cargó el motor de simulación viva. El partido no fue simulado con el sistema anterior.', true);
}
function simulateLiveMatchResultOnly(match){
  if(!match || !window.Simulator20?.createLiveMatchSession || !window.Simulator20?.simulateLiveBlock) return null;
  const session = window.Simulator20.createLiveMatchSession(match);
  let guard = 0;
  while(session && !session.finished && guard < 140){
    window.Simulator20.simulateLiveBlock(session, { instruction:'none', substitutions:[] });
    guard += 1;
  }
  return session?.result || (window.Simulator20.finishLiveMatchSession ? window.Simulator20.finishLiveMatchSession(session) : null);
}
function showResultOnlySummary(result){
  if(!result) return;
  setTimeout(() => {
    if(typeof showMatchModal === 'function' && result.id){ showMatchModal(result.id); return; }
    const h = clubName(result.homeId);
    const a = clubName(result.awayId);
    const hs = result.matchStats?.home || {};
    const as = result.matchStats?.away || {};
    const body = `<div class="card inner match-result-only-summary">
      <p class="label">Resultado directo</p>
      <h2>${escapeHtml(h)} ${Number(result.homeGoals || 0)} - ${Number(result.awayGoals || 0)} ${escapeHtml(a)}</h2>
      <div class="grid cols-2">
        <div class="card inner"><h3>${escapeHtml(h)}</h3><p>Ataques: ${Number(hs.attacks || 0)}</p><p>Ocasiones: ${Number(hs.chances || 0)}</p><p>xG: ${Number(hs.xg || 0).toFixed(2)}</p><p>Posesión: ${Number(hs.possession || 0)}%</p></div>
        <div class="card inner"><h3>${escapeHtml(a)}</h3><p>Ataques: ${Number(as.attacks || 0)}</p><p>Ocasiones: ${Number(as.chances || 0)}</p><p>xG: ${Number(as.xg || 0).toFixed(2)}</p><p>Posesión: ${Number(as.possession || 0)}%</p></div>
      </div>
      <div class="modal-actions"><button class="primary" onclick="closeModal()">Cerrar</button></div>
    </div>`;
    if(typeof openModal === 'function') openModal(body);
  }, 0);
}
function startLiveOwnMatchdayInteractive(context){
  const match = context?.ownInfo?.match;
  if(!match) return false;
  try{
    const started = window.LiveMatchUI.start(match, {
      onComplete:(ownResult) => finalizeLiveOwnMatchdayResult(context, ownResult),
      onCancel:null
    });
    if(started) return true;
  }catch(err){
    console.error('[V5.25] Error al iniciar simulación viva:', err);
    showLiveMatchEngineBlocked({ missing:[`Error al iniciar simulación viva: ${err?.message || err}`] });
    return 'blocked';
  }
  showLiveMatchEngineBlocked({ missing:['El motor vivo respondió, pero no pudo abrir el partido'] });
  return 'blocked';
}
function finishOwnMatchdayResultOnly(context){
  const match = context?.ownInfo?.match;
  const result = simulateLiveMatchResultOnly(match);
  if(!result){ showLiveMatchEngineBlocked({ missing:['No se pudo generar el resultado directo con el motor vivo'] }); return 'blocked'; }
  finalizeLiveOwnMatchdayResult(context, result);
  showResultOnlySummary(result);
  showNotice('Partido simulado directamente. Se muestran las estadísticas completas.', false);
  return true;
}
function startLiveOwnMatchday(context){
  const match = context?.ownInfo?.match;
  if(!match) return false;
  const status = liveMatchEngineStatus();
  if(!status.ok){
    console.warn('[V5.25] Simulación viva bloqueada por carga incompleta:', status.missing);
    showLiveMatchEngineBlocked(status);
    return 'blocked';
  }
  const body = `<div class="card inner match-start-choice">
    <p class="label">Partido propio</p>
    <h2>${clubLink(match.homeId)} vs ${clubLink(match.awayId)}</h2>
    <p class="muted">Podés dirigir la simulación viva o saltear el desarrollo y ver sólo el resultado con estadísticas completas.</p>
    <div class="modal-actions two-lines">
      <button id="startLiveMatchChoice" class="primary">Dirigir partido</button>
      <button id="resultOnlyMatchChoice" class="ghost">Ver solo resultados</button>
    </div>
  </div>`;
  if(typeof openModal === 'function') openModal(body);
  setTimeout(() => {
    document.querySelector('#startLiveMatchChoice')?.addEventListener('click', () => { closeModal(); startLiveOwnMatchdayInteractive(context); });
    document.querySelector('#resultOnlyMatchChoice')?.addEventListener('click', () => { closeModal(); finishOwnMatchdayResultOnly(context); });
  }, 0);
  return true;
}

function simulateNextMatchday(options={}){
  if(!game || game.seasonFinalized) return;
  if(game.gameOver?.active){ showNotice('Estás sin club. Usá Buscar club para continuar tu carrera.'); return; }
  repairBotRosters({ reason:'before_turn' });
  if(isAdvanceLocked()){ showNotice(`Avance bloqueado por ${formatClock(advanceLockLeftMs())}.`); return; }
  if(isPreseason()){
    simulatePreseasonTurn();
    return;
  }
  if(isPostseason()){
    simulatePostseasonTurn();
    return;
  }
  if(game.matchdayIndex >= game.fixtures.length){
    if(typeof createArgentinePromotionPlayoffsIfNeeded === 'function' && createArgentinePromotionPlayoffsIfNeeded()){
      saveLocal(true);
      renderAll();
      showNotice('Se creó el calendario de playoffs de promoción. Avanzá para jugar la ida.', true);
      return;
    }
    showTurnTransition('Cambio de fase');
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    rememberCalendarDate();
    saveLocal(true);
    renderAll();
    showNotice('Comienza la postemporada. Se usarán los días restantes del año antes del cierre de temporada.');
    return;
  }
  if(game.mustReviewTactics){ showNotice('Debes confirmar tu equipo: hay lesionados o suspendidos propios que deben ser reemplazados.'); return; }
  const errors = validateCurrentTactic(false);
  if(errors.length){ showNotice(errors.join(' ')); return; }
  const ownInfo = nextOwnMatchInfo();
  const pendingInfo = nextPendingMatchInfo();
  const targetDate = ownInfo?.date || pendingInfo?.date;
  if(!targetDate){
    game.matchdayIndex = game.fixtures.length;
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    rememberCalendarDate();
    saveLocal(true);
    renderAll();
    showNotice('No quedan partidos pendientes. Comienza la postemporada.');
    return;
  }
  if(ownInfo?.date && isCurrentDateBeforeIso(ownInfo.date)){
    startAutoAdvanceToNextOwnMatch();
    return;
  }
  const preOwnBotResults = ownInfo ? simulateNonOwnDueBeforeOwnMatch(targetDate, 'before_own_match_click') : [];
  const budgetBeforeTurn = Number(game.budget || 0);
  if(validIsoDate(targetDate)){
    game.currentDate = targetDate;
    rememberCalendarDate();
  }
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily({ reason:'matchday' });
  showTurnTransition(options.advanceLabel || 'Yendo al próximo partido');
  const fromRoundIndex = Number(game.matchdayIndex || 0);
  if(ownInfo){
    const liveStartState = startLiveOwnMatchday({ ownInfo, pendingInfo, targetDate, preOwnBotResults, budgetBeforeTurn, fromRoundIndex });
    if(liveStartState === true || liveStartState === 'blocked') return;
  }
  const results = simulateDueMatchesUntil(targetDate, { includeOwn:true });
  const ownResult = results.find(m => m.homeId === game.selectedClubId || m.awayId === game.selectedClubId) || null;
  if(!results.length){
    showNotice('No había partidos pendientes para simular en esta fecha.');
    return;
  }
  if(ownResult){
    applyConditionUpdates(results);
    applyMoraleUpdates(results);
    if(typeof applyFanChangesAfterMatches === 'function') applyFanChangesAfterMatches(results);
    maintainBotBalanceDuringSeason();
    if(typeof processBotDismissals === 'function') processBotDismissals();
    advanceStadiumAfterMatches(results);
    applyEconomyResult(ownResult);
    updateManagerMatchStats(ownResult);
    maybeGenerateTransferOffer(ownResult);
    advanceSponsorMatchCounter();
    if(typeof awardSpecialPointsForOwnMatch === 'function') awardSpecialPointsForOwnMatch(ownResult);
  } else {
    processNonOwnResultsAfterSimulation(results);
  }
  const summaryRound = game.fixtures[fromRoundIndex] || ownInfo?.round || pendingInfo?.round || { matchday:'—', date:targetDate, matches:[] };
  const triggeredEvents = ownResult ? processGameEventsAfterMatches({ round:summaryRound, results, ownResult }) : [];
  const ownProblems = ownResult ? collectOwnProblems(ownResult) : [];
  if(ownResult){
    removeOwnUnavailableFromTactic(ownProblems);
    game.lastOwnProblems = ownProblems;
    game.mustReviewTactics = game.lastOwnProblems.length > 0;
  }
  let regularEnded = game.matchdayIndex >= game.fixtures.length;
  const playoffCreated = regularEnded && typeof createArgentinePromotionPlayoffsIfNeeded === 'function' && createArgentinePromotionPlayoffsIfNeeded();
  if(playoffCreated) regularEnded = game.matchdayIndex >= game.fixtures.length;
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(regularEnded){
    game.seasonPhase = 'postseason';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    rememberCalendarDate();
    setAdvanceLock(0);
  } else {
    game.currentDate = targetDate;
    rememberCalendarDate();
    applyUnifiedAdvanceCooldown(ownResult ? 'match' : 'daily');
  }
  if(ownResult) setRegularTurnSummary(summaryRound, ownResult, ownProblems, regularEnded || playoffCreated, triggeredEvents);
  else setDailyAdvanceSummary(currentCalendarDate(), targetDate, results.length);
  activeTab = 'home';
  saveLocal(true);
  renderAll();
  const finalNotice = () => {
    if(game.mustReviewTactics){ showNotice('Partido simulado. Hay lesionados o expulsados propios: revisá la táctica antes de avanzar.', true); }
    else if(playoffCreated){ showNotice('Terminó la liga regular y se creó el calendario de playoffs de promoción.', true); }
    else if(regularEnded){ showNotice('Terminó la fase regular. Comienza la postemporada hasta el cierre anual.', true); }
    else if(ownResult){ showNotice(`Partido propio simulado. Antes se procesaron ${preOwnBotResults.length} partido(s) del mismo día o pendientes.`); }
    else { showNotice(`Se simularon ${results.length} partido(s) de calendario.`); }
  };
  if(ownResult && !regularEnded) showMatchRevealModal(ownResult, finalNotice);
  else finalNotice();
}

function buildPreseasonFriendlyMatch(opponentId){
  const homeOwn = Math.random() < 0.5;
  return {
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
}
function finalizePreseasonTurnAfterMatch(context={}){
  if(!game) return;
  const budgetBeforeTurn = Number(context.budgetBeforeTurn || 0);
  const opponentId = Number(context.opponentId || 0);
  const canFriendly = Boolean(context.canFriendly);
  let friendlyResult = context.friendlyResult || null;
  if(friendlyResult){
    friendlyResult.friendly = true;
    friendlyResult.cards = [];
    friendlyResult.injuries = [];
    friendlyResult.substitutions = friendlyResult.substitutions || [];
    game.matchHistory.push(friendlyResult);
    applyConditionUpdates([friendlyResult]);
    applyMoraleUpdates([friendlyResult]);
    game.preseasonFriendliesPlayed = preseasonFriendliesPlayed() + 1;
  }
  applyTrainingEffects();
  maintainBotBalanceDuringSeason({ force:true, phase:'preseason' });
  reduceInjuryDurationsByTurns(1);
  registerInjuryRecoveryTurn('preseason');
  if(typeof processStadiumExpansionDays === 'function') processStadiumExpansionDays(DAYS_PER_ADVANCE);
  processStadiumProjects();
  processSponsorContracts();
  processBankLoanDailySchedule();
  game.pendingFriendlyOpponentId = 0;
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  game.currentDate = dateForSeasonState(game);
  rememberCalendarDate();
  advanceGlobalTurn();
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily({ reason:'preseason' });
  if(typeof maybePushAssistantAdviceMessage === 'function') maybePushAssistantAdviceMessage('preseason');
  processAcademyTurn();
  processPendingTransfers();
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= PRESEASON_TURNS){
    game.seasonPhase = 'regular';
    game.phaseTurn = 0;
    game.currentDate = dateForSeasonState(game);
    rememberCalendarDate();
    setAdvanceLock(0);
    if(Number(game.sponsors?.openingOffersSeason || 0) !== Number(game.seasonNumber || 1)){
      generateOpeningSponsorOffers(true);
    }
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice('Pretemporada finalizada. Ya está disponible la primera fecha oficial.', true);
  } else {
    applyUnifiedAdvanceCooldown('match');
    setPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
    showNotice(canFriendly ? `Amistoso dirigido ante ${clubName(opponentId)}. La pretemporada avanza.` : 'Día de pretemporada aplicado.', false);
  }
  activeTab = 'home';
  saveLocal(true);
  renderAll();
}
function startLivePreseasonFriendlyInteractive(match, context){
  try{
    const started = window.LiveMatchUI.start(match, {
      onComplete:(friendlyResult) => finalizePreseasonTurnAfterMatch({ ...context, friendlyResult }),
      onCancel:null
    });
    if(started) return true;
  }catch(err){
    console.error('[V5.25] Error al iniciar amistoso vivo:', err);
    showLiveMatchEngineBlocked({ missing:[`Error al iniciar amistoso vivo: ${err?.message || err}`] });
    return 'blocked';
  }
  showLiveMatchEngineBlocked({ missing:['El motor vivo respondió, pero no pudo abrir el amistoso'] });
  return 'blocked';
}
function finishPreseasonFriendlyResultOnly(match, context){
  const friendlyResult = simulateLiveMatchResultOnly(match);
  if(!friendlyResult){ showLiveMatchEngineBlocked({ missing:['No se pudo generar el resultado directo del amistoso'] }); return 'blocked'; }
  finalizePreseasonTurnAfterMatch({ ...context, friendlyResult });
  showResultOnlySummary(friendlyResult);
  showNotice('Amistoso simulado directamente. Se muestran las estadísticas completas.', false);
  return true;
}
function startLivePreseasonFriendly(match, context){
  const status = liveMatchEngineStatus();
  if(!status.ok){
    console.warn('[V5.25] Amistoso vivo bloqueado por carga incompleta:', status.missing);
    showLiveMatchEngineBlocked(status);
    return 'blocked';
  }
  const body = `<div class="card inner match-start-choice">
    <p class="label">Amistoso de pretemporada</p>
    <h2>${clubLink(match.homeId)} vs ${clubLink(match.awayId)}</h2>
    <p class="muted">Podés dirigir la simulación viva o saltear el desarrollo y ver sólo el resultado con estadísticas completas.</p>
    <div class="modal-actions two-lines">
      <button id="startFriendlyLiveChoice" class="primary">Dirigir partido</button>
      <button id="resultOnlyFriendlyChoice" class="ghost">Ver solo resultados</button>
    </div>
  </div>`;
  if(typeof openModal === 'function') openModal(body);
  setTimeout(() => {
    document.querySelector('#startFriendlyLiveChoice')?.addEventListener('click', () => { closeModal(); startLivePreseasonFriendlyInteractive(match, context); });
    document.querySelector('#resultOnlyFriendlyChoice')?.addEventListener('click', () => { closeModal(); finishPreseasonFriendlyResultOnly(match, context); });
  }, 0);
  return true;
}
function simulatePreseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 1 día de pretemporada');
  const opponentId = Number(game.pendingFriendlyOpponentId || 0);
  const canFriendly = Boolean(opponentId && canPlayPreseasonFriendly());
  if(canFriendly){
    const match = buildPreseasonFriendlyMatch(opponentId);
    const liveStartState = startLivePreseasonFriendly(match, { budgetBeforeTurn, opponentId, canFriendly });
    if(liveStartState === true || liveStartState === 'blocked') return;
  }
  finalizePreseasonTurnAfterMatch({ budgetBeforeTurn, opponentId, canFriendly:false, friendlyResult:null });
}

function simulatePostseasonTurn(){
  const budgetBeforeTurn = Number(game.budget || 0);
  showTurnTransition('Avanzando 1 día de postemporada');
  generateSeasonEndPlayerOffers();
  applyTrainingEffects();
  reduceInjuryDurationsByTurns(1);
  registerInjuryRecoveryTurn('postseason');
  if(typeof processStadiumExpansionDays === 'function') processStadiumExpansionDays(DAYS_PER_ADVANCE);
  processStadiumProjects();
  processSponsorContracts();
  processBankLoanDailySchedule();
  game.phaseTurn = Number(game.phaseTurn || 0) + 1;
  game.currentDate = dateForSeasonState(game);
  rememberCalendarDate();
  advanceGlobalTurn();
  if(typeof processScoutingCenterDaily === 'function') processScoutingCenterDaily({ reason:'postseason' });
  if(typeof maybePushAssistantAdviceMessage === 'function') maybePushAssistantAdviceMessage('postseason');
  processAcademyTurn();
  processPendingTransfers();
  game.lastBudgetDelta = Math.round(Number(game.budget || 0) - budgetBeforeTurn);
  if(game.phaseTurn >= postseasonTurnsForCurrentSeason()){
    game.seasonPhase = 'finalizing';
    game.currentDate = seasonEndDateForYear(currentSeasonYear());
    rememberCalendarDate();
    finalizeSeasonIfNeeded();
    setAdvanceLock(0);
    setPostseasonTurnSummary(true);
    activeTab = 'home';
    saveLocal(true);
    renderAll();
    setTimeout(openSeasonEndModal, 0);
    showNotice('Postemporada finalizada. Cerró la temporada.', true);
  } else {
    applyUnifiedAdvanceCooldown('match');
    setPostseasonTurnSummary(false);
    activeTab = 'home';
    saveLocal(true);
    renderAll();
    showNotice('Día de postemporada aplicado.');
  }
}


function recordBudgetChange(delta, concept, meta={}){
  if(!game) return;
  game.budgetHistory = game.budgetHistory || [];
  const safeDelta = Math.round(Number(delta) || 0);
  game.budget = Math.round(Number(game.budget || 0) + safeDelta);
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

function transferBudgetConfig(){
  return {
    active:configBoolean('mercado.presupuestoFichajesActivo', true),
    maxRate:configNumber('mercado.presupuestoFichajesMaximoPorcentaje', 0.50, 0, 1),
    baseD3:configNumber('mercado.presupuestoFichajesDivision3', 0.25, 0, 1),
    baseD2:configNumber('mercado.presupuestoFichajesDivision2', 0.35, 0, 1),
    baseD1:configNumber('mercado.presupuestoFichajesDivision1', 0.40, 0, 1),
    unlockObjective:configNumber('mercado.desbloqueoSuperarObjetivo', 0.05, 0, 1),
    unlockPpg15:configNumber('mercado.desbloqueoPromedio15', 0.05, 0, 1),
    unlockPpg19:configNumber('mercado.desbloqueoPromedio19', 0.10, 0, 1),
    unlockPromotion:configNumber('mercado.desbloqueoAscenso', 0.10, 0, 1),
    unlockChampion:configNumber('mercado.desbloqueoCampeon', 0.15, 0, 1),
    saleUnlockedRate:configNumber('mercado.porcentajeVentaLiberadoFichajes', 0.70, 0, 1)
  };
}
function transferBudgetBaseRateForClub(clubId){
  const cfg = transferBudgetConfig();
  const division = clubDivision(clubId || game?.selectedClubId);
  const order = Math.round(Number(division?.order || 3));
  if(order <= 1) return Math.min(cfg.maxRate, cfg.baseD1);
  if(order === 2) return Math.min(cfg.maxRate, cfg.baseD2);
  return Math.min(cfg.maxRate, cfg.baseD3);
}
function transferBudgetDefaultUnlocks(){
  return { objective:false, ppg15:false, ppg19:false, promotion:false, champion:false };
}
function createTransferBudgetState(clubId=game?.selectedClubId, season=game?.seasonNumber || 1, startingExtraRate=0){
  const cfg = transferBudgetConfig();
  const baseRate = transferBudgetBaseRateForClub(clubId);
  const extra = Math.max(0, Number(startingExtraRate || 0));
  return {
    active:cfg.active,
    season:Number(season || 1),
    clubId:Number(clubId || 0),
    baseRate,
    unlockedRate:Math.min(cfg.maxRate, extra),
    extraUnlockedAmount:0,
    spent:0,
    unlocks:transferBudgetDefaultUnlocks(),
    history:[]
  };
}
function normalizeTransferBudgetState(state, sourceGame=game){
  const season = Number(sourceGame?.seasonNumber || 1);
  const clubId = Number(sourceGame?.selectedClubId || 0);
  const cfg = transferBudgetConfig();
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : createTransferBudgetState(clubId, season, 0);
  const needsNewSeason = Number(src.season || 0) !== season || Number(src.clubId || 0) !== clubId;
  if(needsNewSeason){
    return createTransferBudgetState(clubId, season, 0);
  }
  const baseRate = Number.isFinite(Number(src.baseRate)) ? Number(src.baseRate) : transferBudgetBaseRateForClub(clubId);
  const unlockedRate = Math.max(0, Number(src.unlockedRate || 0));
  return {
    active:cfg.active,
    season,
    clubId,
    baseRate:Math.min(cfg.maxRate, Math.max(0, baseRate)),
    unlockedRate:Math.min(cfg.maxRate, unlockedRate),
    extraUnlockedAmount:Math.max(0, Math.round(Number(src.extraUnlockedAmount || 0))),
    spent:Math.max(0, Math.round(Number(src.spent || 0))),
    unlocks:{ ...transferBudgetDefaultUnlocks(), ...(src.unlocks || {}) },
    history:Array.isArray(src.history) ? src.history.slice(-80) : []
  };
}
function ensureTransferBudgetState(){
  if(!game) return null;
  game.transferBudget = normalizeTransferBudgetState(game.transferBudget, game);
  return game.transferBudget;
}
function transferBudgetRate(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return 1;
  const state = ensureTransferBudgetState();
  return clamp((Number(state?.baseRate || 0) + Number(state?.unlockedRate || 0)), 0, cfg.maxRate);
}
function transferBudgetMaximum(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return Math.max(0, Math.round(Number(game?.budget || 0)));
  return Math.max(0, Math.round(Number(game?.budget || 0) * cfg.maxRate));
}
function transferBudgetAuthorizedGross(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return Math.max(0, Math.round(Number(game?.budget || 0)));
  const state = ensureTransferBudgetState();
  const rateAmount = Math.round(Number(game?.budget || 0) * transferBudgetRate());
  const extra = Math.round(Number(state?.extraUnlockedAmount || 0));
  return Math.min(transferBudgetMaximum(), Math.max(0, rateAmount + extra));
}
function transferBudgetAvailable(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return Math.max(0, Math.round(Number(game?.budget || 0)));
  const state = ensureTransferBudgetState();
  return Math.max(0, Math.min(Number(game?.budget || 0), transferBudgetAuthorizedGross() - Math.round(Number(state?.spent || 0))));
}
function transferBudgetLockedAmount(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return 0;
  return Math.max(0, Math.round(Number(game?.budget || 0) - transferBudgetAvailable()));
}
function transferBudgetPercentLabel(value){
  return `${Math.round(Number(value || 0) * 100)}%`;
}
function transferBudgetAddHistory(type, text, amount=0, rate=0){
  const state = ensureTransferBudgetState();
  if(!state) return;
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push({
    season:Number(game?.seasonNumber || 1),
    date:game?.currentDate || '',
    type:String(type || 'budget'),
    text:String(text || ''),
    amount:Math.round(Number(amount || 0)),
    rate:Number(rate || 0),
    createdAt:Date.now()
  });
  state.history = state.history.slice(-80);
}
function unlockTransferBudgetRate(key, rate, title, body){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return false;
  const state = ensureTransferBudgetState();
  if(!state || state.unlocks?.[key]) return false;
  const current = Number(state.baseRate || 0) + Number(state.unlockedRate || 0);
  const add = Math.max(0, Math.min(Number(rate || 0), Math.max(0, cfg.maxRate - current)));
  state.unlocks[key] = true;
  if(add > 0){
    state.unlockedRate = Math.min(cfg.maxRate, Number(state.unlockedRate || 0) + add);
    transferBudgetAddHistory('unlock', title || 'Presupuesto liberado', 0, add);
    pushGameMessage({ type:'directiva', priority:'normal', title:title || 'Presupuesto de fichajes liberado', body:body || `La directiva liberó ${transferBudgetPercentLabel(add)} adicional para fichajes.` });
    return true;
  }
  return false;
}
function updateTransferBudgetPerformanceUnlocks(){
  const cfg = transferBudgetConfig();
  if(!cfg.active || !game) return false;
  const stats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  game.managerStats = stats;
  const current = stats.currentSeason || {};
  const played = Number(current.played || 0);
  if(played <= 0) return false;
  const ppg = ppgFromTotals(current);
  const rawObjective = Number.isFinite(Number(current.objectivePpg)) ? Number(current.objectivePpg) : managerObjectiveForClubDivision(game.selectedClubId);
  const objective = Number.isFinite(Number(rawObjective)) ? Number(rawObjective) : null;
  let changed = false;
  if(!currentGameIsFounderMode() && Number.isFinite(objective) && ppg > objective){
    changed = unlockTransferBudgetRate('objective', cfg.unlockObjective, 'La directiva libera presupuesto', `El promedio de puntos superó el objetivo (${ppg.toFixed(2)} / ${objective.toFixed(2)}). Se habilitó ${transferBudgetPercentLabel(cfg.unlockObjective)} adicional para fichajes.`) || changed;
  }
  if(ppg > 1.5){
    changed = unlockTransferBudgetRate('ppg15', cfg.unlockPpg15, 'Buen rendimiento deportivo', `El promedio de puntos de la temporada superó 1,5. La directiva habilitó ${transferBudgetPercentLabel(cfg.unlockPpg15)} adicional para fichajes.`) || changed;
  }
  if(ppg > 1.9){
    changed = unlockTransferBudgetRate('ppg19', cfg.unlockPpg19, 'Rendimiento sobresaliente', `El promedio de puntos de la temporada superó 1,9. La directiva habilitó ${transferBudgetPercentLabel(cfg.unlockPpg19)} adicional para fichajes.`) || changed;
  }
  return changed;
}
function spendTransferBudget(amount, concept='Fichaje'){
  const state = ensureTransferBudgetState();
  const safe = Math.max(0, Math.round(Number(amount || 0)));
  if(!state || safe <= 0) return;
  state.spent = Math.max(0, Math.round(Number(state.spent || 0) + safe));
  transferBudgetAddHistory('spend', concept, safe, 0);
}
function unlockTransferBudgetFromSale(netAmount){
  const cfg = transferBudgetConfig();
  if(!cfg.active || !game) return 0;
  const state = ensureTransferBudgetState();
  const amount = Math.max(0, Math.round(Number(netAmount || 0) * cfg.saleUnlockedRate));
  if(amount <= 0) return 0;
  state.extraUnlockedAmount = Math.max(0, Math.round(Number(state.extraUnlockedAmount || 0) + amount));
  transferBudgetAddHistory('sale_unlock', 'Venta liberada para fichajes', amount, 0);
  return amount;
}
function queueNextSeasonTransferBudgetUnlock(key, rate, reason){
  const cfg = transferBudgetConfig();
  if(!cfg.active || !game) return 0;
  const safeRate = Math.max(0, Number(rate || 0));
  if(safeRate <= 0) return 0;
  game.nextSeasonTransferBudgetUnlock = game.nextSeasonTransferBudgetUnlock || { rate:0, reasons:[] };
  if(game.nextSeasonTransferBudgetUnlock.reasons?.some(r => r.key === key)) return 0;
  game.nextSeasonTransferBudgetUnlock.rate = Math.max(0, Number(game.nextSeasonTransferBudgetUnlock.rate || 0) + safeRate);
  game.nextSeasonTransferBudgetUnlock.reasons = Array.isArray(game.nextSeasonTransferBudgetUnlock.reasons) ? game.nextSeasonTransferBudgetUnlock.reasons : [];
  game.nextSeasonTransferBudgetUnlock.reasons.push({ key, rate:safeRate, reason:String(reason || '') });
  return safeRate;
}
function consumeNextSeasonTransferBudgetUnlock(){
  const queued = game?.nextSeasonTransferBudgetUnlock && typeof game.nextSeasonTransferBudgetUnlock === 'object' ? game.nextSeasonTransferBudgetUnlock : null;
  const rate = Math.max(0, Number(queued?.rate || 0));
  game.nextSeasonTransferBudgetUnlock = null;
  return { rate, reasons:Array.isArray(queued?.reasons) ? queued.reasons : [] };
}
function transferBudgetSummaryMarkup(){
  const cfg = transferBudgetConfig();
  const state = ensureTransferBudgetState();
  if(!cfg.active || !state) return '';
  const budget = Math.max(0, Math.round(Number(game?.budget || 0)));
  const available = transferBudgetAvailable();
  const max = transferBudgetMaximum();
  const rate = transferBudgetRate();
  const progress = max > 0 ? clamp(Math.round((available / max) * 100), 0, 100) : 0;
  return `<div class="card transfer-budget-card">
    <div class="row"><div><p class="label">Presupuesto para fichajes</p><h3>${formatMoney(available)}</h3></div><span class="pill">${transferBudgetPercentLabel(rate)} / ${transferBudgetPercentLabel(cfg.maxRate)}</span></div>
    <div class="bar transfer-budget-bar"><span style="width:${progress}%"></span></div>
    <p class="muted small">Presupuesto total: ${formatMoney(budget)} · Autorizado bruto: ${formatMoney(transferBudgetAuthorizedGross())} · Usado esta temporada: ${formatMoney(state.spent || 0)} · Bloqueado para fichajes: ${formatMoney(transferBudgetLockedAmount())}</p>
  </div>`;
}
function budgetConcept(entry){
  if(entry.concept) return entry.concept;
  if(entry.type === 'season_salary') return 'Pago anual de sueldos';
  if(entry.matchId) return 'Resultado de partido';
  return 'Movimiento de presupuesto';
}
function financeCategory(entry){
  const type = String(entry?.type || '').toLowerCase();
  const concept = String(entry?.concept || '').toLowerCase();
  if(type.includes('season_salary') || concept.includes('sueldo')) return 'Sueldos';
  if(type.includes('bank_loan') || concept.includes('préstamo') || concept.includes('prestamo') || concept.includes('cuota semanal')) return 'Banco';
  if(type.includes('monthly_') || concept.includes('impuesto mensual') || concept.includes('electricidad mensual') || concept.includes('limpieza general')) return 'Gastos mensuales';
  if(type.includes('scouting_') || concept.includes('ojeador') || concept.includes('ojeo')) return 'Centro de Ojeo';
  if(type.includes('transfer_purchase') || type.includes('transfer_sale') || concept.includes('compra acordada') || concept.includes('venta de')) return 'Mercado';
  if(type.includes('stadium') || concept.includes('campo') || concept.includes('estadio')) return 'Estadio';
  if(type.includes('academy_residence') || concept.includes('residencia')) return 'Residencias juveniles';
  if(type.includes('academy') || concept.includes('academia') || concept.includes('captación') || concept.includes('juvenil')) return 'Academia';
  if(type.includes('staff') || concept.includes('contratación de')) return 'Empleados';
  return null;
}
function financeBudgetCategory(entry){
  const type = String(entry?.type || '').toLowerCase();
  const concept = String(entry?.concept || '').toLowerCase();
  if(type.includes('season_salary') || concept.includes('sueldo')) return 'Sueldos';
  if(type.includes('bank_loan') || concept.includes('préstamo') || concept.includes('prestamo') || concept.includes('cuota semanal')) return 'Banco';
  if(type.includes('monthly_') || concept.includes('impuesto mensual') || concept.includes('electricidad mensual') || concept.includes('limpieza general')) return 'Gastos mensuales';
  if(type.includes('scouting_') || concept.includes('ojeador') || concept.includes('ojeo')) return 'Centro de Ojeo';
  if(type.includes('transfer_purchase') || type.includes('transfer_sale') || concept.includes('compra acordada') || concept.includes('venta de')) return 'Mercado';
  if(type.includes('stadium') || concept.includes('campo') || concept.includes('estadio')) return 'Estadio';
  if(type.includes('academy_residence') || concept.includes('residencia')) return 'Residencias juveniles';
  if(type.includes('academy') || concept.includes('academia') || concept.includes('captación') || concept.includes('juvenil')) return 'Academia';
  if(type.includes('staff') || concept.includes('contratación de')) return 'Empleados';
  if(type.includes('kinesiology') || concept.includes('médic') || concept.includes('tratamiento')) return 'Tratamientos médicos';
  if(type.includes('sponsor') || concept.includes('sponsor')) return 'Sponsors';
  if(type.includes('event') || concept.includes('evento') || concept.includes('compensación')) return 'Eventos';
  if(entry?.matchId || concept.includes('partido') || concept.includes('recaudación')) return 'Partidos y entradas';
  return 'Otros';
}
function financeCategoryRows(entries){
  return (entries || []).map(entry => {
    const delta = Number(entry.delta || 0);
    const cls = delta > 0 ? 'ok' : delta < 0 ? 'bad' : 'muted';
    const extra = Number(entry.ticketRevenue || 0) > 0 ? ` <span class="pill finance-mini-pill">Entradas ${formatMoney(entry.ticketRevenue)}</span>` : '';
    return `<tr><td>Fecha ${Number(entry.matchdayIndex || 0) + 1}</td><td>${escapeHtml(budgetConcept(entry))}${extra}</td><td><span class="${cls}">${delta > 0 ? '+' : ''}${formatMoney(delta)}</span></td><td><span class="${budgetTone(entry.budget || 0)}">${formatMoney(entry.budget || 0)}</span></td></tr>`;
  }).join('');
}
function financeExpensesByCategoryMarkup(){
  const season = game.seasonNumber || 1;
  const expenses = (game.budgetHistory || [])
    .filter(h => (h.season || season) === season && Number(h.delta || 0) < 0)
    .slice()
    .reverse();
  if(!expenses.length) return `<div class="card finance-category-card"><h3>Gastos por categoría</h3><p class="muted">Todavía no hay gastos registrados esta temporada.</p></div>`;
  const grouped = expenses.reduce((acc, entry) => {
    const category = financeBudgetCategory(entry);
    if(!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {});
  const order = ['Sueldos','Banco','Mercado','Estadio','Residencias juveniles','Academia','Empleados','Tratamientos médicos','Eventos','Otros'];
  const details = order.filter(category => grouped[category]?.length).map((category, index) => {
    const entries = grouped[category];
    const total = entries.reduce((sum, entry) => sum + Math.abs(Number(entry.delta || 0)), 0);
    return `<details class="finance-category-detail" ${index === 0 ? 'open' : ''}>
      <summary><span>${escapeHtml(category)}</span><strong class="bad">${formatMoney(total)}</strong><small>${entries.length} mov.</small></summary>
      <div class="table-wrap compact-finance-table"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Presupuesto luego</th></tr></thead><tbody>${financeCategoryRows(entries)}</tbody></table></div>
    </details>`;
  }).join('');
  return `<div class="card finance-category-card"><div class="row"><div><h3>Gastos por categoría</h3><p class="muted small">Secciones minimizables y desplegables de la temporada actual.</p></div><span class="pill bad">${formatMoney(expenses.reduce((sum, entry) => sum + Math.abs(Number(entry.delta || 0)), 0))}</span></div>${details}</div>`;
}
function financeIncomeByCategoryMarkup(){
  const season = game.seasonNumber || 1;
  const income = (game.budgetHistory || [])
    .filter(h => (h.season || season) === season && Number(h.delta || 0) > 0)
    .slice()
    .reverse();
  if(!income.length) return '';
  const grouped = income.reduce((acc, entry) => {
    const category = financeBudgetCategory(entry);
    if(!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {});
  const order = ['Partidos y entradas','Banco','Sponsors','Mercado','Eventos','Otros'];
  const details = order.filter(category => grouped[category]?.length).map((category, index) => {
    const entries = grouped[category];
    const total = entries.reduce((sum, entry) => sum + Number(entry.delta || 0), 0);
    return `<details class="finance-category-detail finance-income-detail" ${index === 0 ? 'open' : ''}>
      <summary><span>${escapeHtml(category)}</span><strong class="ok">${formatMoney(total)}</strong><small>${entries.length} mov.</small></summary>
      <div class="table-wrap compact-finance-table"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Presupuesto luego</th></tr></thead><tbody>${financeCategoryRows(entries)}</tbody></table></div>
    </details>`;
  }).join('');
  return `<div class="card finance-category-card"><div class="row"><div><h3>Ingresos por categoría</h3><p class="muted small">Incluye partidos, sponsors, ventas y recaudación de entradas.</p></div><span class="pill ok">${formatMoney(income.reduce((sum, entry) => sum + Number(entry.delta || 0), 0))}</span></div>${details}</div>`;
}
function financeSquadRows(){
  return playersByClub(game.selectedClubId)
    .slice()
    .sort((a,b)=>visibleOverall(b)-visibleOverall(a) || a.name.localeCompare(b.name,'es'))
    .map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${nationalityShortMarkup(p.nationality)}</td><td>${Number(p.age || 0) || '—'}</td><td>${visibleOverall(p)}</td><td>${formatMoney(p.salary || 0)}</td></tr>`)
    .join('');
}
function loanPercentLabel(rate){ return `${Math.round(Number(rate || 0) * 100)}%`; }
function configuredLoanBanks(){
  return (BANK_LOAN_BANKS?.length ? BANK_LOAN_BANKS : [
    { id:1, name:'Banco Nación', interest:0.32 },
    { id:2, name:'Banco Provincia', interest:0.36 },
    { id:3, name:'Banco Galicia', interest:0.41 },
    { id:4, name:'Santander', interest:0.44 },
    { id:5, name:'BBVA', interest:0.43 },
    { id:6, name:'Banco Macro', interest:0.47 },
    { id:7, name:'Banco Credicoop', interest:0.34 },
    { id:8, name:'ICBC', interest:0.39 },
    { id:9, name:'Banco Supervielle', interest:0.46 },
    { id:10, name:'Banco Comafi', interest:0.50 }
  ]).map((bank, index) => ({ id:bank.id || index + 1, name:String(bank.name || bank.nombre || `Banco ${index + 1}`), interest:Math.max(0, Number(bank.interest ?? bank.interes ?? 0.40)) }));
}
function configuredLoanTiers(){
  return (BANK_LOAN_TIERS?.length ? BANK_LOAN_TIERS : [
    { id:1, amount:50000000, prestigeCost:1 },
    { id:2, amount:500000000, prestigeCost:5 },
    { id:3, amount:1500000000, prestigeCost:20 }
  ]).map((tier, index) => ({ id:tier.id || index + 1, amount:Math.max(0, Math.round(Number(tier.amount || tier.monto || 0))), prestigeCost:Math.max(0, Math.round(Number(tier.prestigeCost ?? tier.prestigio ?? 0))) })).filter(tier => tier.amount > 0);
}
function shuffledBySeed(list, seedKey){
  return (list || []).slice().sort((a,b)=>hashNumber(`${seedKey}-${a.id || a.name || a.amount}`, 1000000) - hashNumber(`${seedKey}-${b.id || b.name || b.amount}`, 1000000));
}
function createBankLoanOffers(season=game?.seasonNumber || 1){
  if(!BANK_LOANS_ENABLED) return [];
  const banks = shuffledBySeed(configuredLoanBanks(), `bank-loans-banks-${season}`).slice(0, 3);
  const tiers = shuffledBySeed(configuredLoanTiers(), `bank-loans-tiers-${season}`).slice(0, 3);
  const terms = BANK_LOAN_TERMS?.length ? BANK_LOAN_TERMS : [24,48,172];
  return tiers.map((tier, index) => {
    const bank = banks[index % banks.length];
    const weeks = terms[hashNumber(`bank-loan-term-${season}-${tier.id}-${bank.id}`, terms.length)];
    const interestRate = Math.max(0, Number(bank.interest || 0));
    const totalToRepay = Math.round(Number(tier.amount || 0) * (1 + interestRate));
    return {
      id:`loan-${season}-${tier.id}-${bank.id}`,
      season:Number(season || 1),
      bankId:bank.id,
      bankName:bank.name,
      amount:Math.round(Number(tier.amount || 0)),
      prestigeCost:Math.max(0, Math.round(Number(tier.prestigeCost || 0))),
      interestRate,
      weeks:Math.max(1, Math.round(Number(weeks || 1))),
      totalToRepay,
      weeklyPayment:Math.ceil(totalToRepay / Math.max(1, Number(weeks || 1)))
    };
  });
}
function createBankLoanState(season=game?.seasonNumber || 1){
  return { active:null, season:Number(season || 1), offers:createBankLoanOffers(season), history:[] };
}
function normalizeBankLoanActiveLoan(loan){
  if(!loan || typeof loan !== 'object' || Array.isArray(loan)) return null;
  const totalToRepay = Math.max(0, Math.round(Number(loan.totalToRepay || loan.remainingDebt || 0)));
  const paid = Math.max(0, Math.round(Number(loan.paid || 0)));
  const remainingDebt = Math.max(0, Math.round(Number(loan.remainingDebt ?? (totalToRepay - paid))));
  const weeks = Math.max(1, Math.round(Number(loan.weeks || loan.totalWeeks || 1)));
  const remainingWeeks = Math.max(0, Math.round(Number(loan.remainingWeeks ?? loan.weeksRemaining ?? weeks)));
  const today = validIsoDate(game?.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  const startedDate = validIsoDate(loan.startedDate) ? loan.startedDate : today;
  const legacyDaysSincePayment = Math.max(0, Math.round(Number(loan.daysSincePayment || 0)));
  const hasLegacyProgress = Number(loan.paid || 0) > 0 || Number(loan.remainingWeeks ?? weeks) < weeks;
  let lastPaymentDate = validIsoDate(loan.lastPaymentDate) ? loan.lastPaymentDate : (hasLegacyProgress ? today : startedDate);
  if(!validIsoDate(lastPaymentDate) && validIsoDate(today)) lastPaymentDate = today;
  let nextPaymentDate = validIsoDate(loan.nextPaymentDate) ? loan.nextPaymentDate : '';
  if(!nextPaymentDate && validIsoDate(lastPaymentDate)){
    nextPaymentDate = addDaysToIsoDate(lastPaymentDate, hasLegacyProgress ? 7 : Math.max(1, 7 - legacyDaysSincePayment));
  }
  return {
    id:String(loan.id || `loan-active-${Date.now()}`),
    season:Number(loan.season || game?.seasonNumber || 1),
    bankName:String(loan.bankName || 'Banco'),
    amount:Math.max(0, Math.round(Number(loan.amount || 0))),
    prestigeCost:Math.max(0, Math.round(Number(loan.prestigeCost || 0))),
    interestRate:Math.max(0, Number(loan.interestRate || 0)),
    weeks,
    totalWeeks:weeks,
    totalToRepay,
    weeklyPayment:Math.max(1, Math.round(Number(loan.weeklyPayment || Math.ceil(totalToRepay / weeks) || 1))),
    remainingWeeks,
    remainingDebt,
    paid,
    startedDate,
    startedTurn:Number(loan.startedTurn || game?.globalTurn || 0),
    lastPaymentDate:validIsoDate(lastPaymentDate) ? lastPaymentDate : '',
    nextPaymentDate:validIsoDate(nextPaymentDate) ? nextPaymentDate : '',
    daysSincePayment:legacyDaysSincePayment
  };
}
function normalizeBankLoanState(state, sourceGame=game){
  const season = Number(sourceGame?.seasonNumber || 1);
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : createBankLoanState(season);
  const active = normalizeBankLoanActiveLoan(src.active);
  if(active){
    return { active, season:Number(src.season || season), offers:[], history:Array.isArray(src.history) ? src.history.slice(-50) : [] };
  }
  if(Number(src.season || 0) !== season){
    return createBankLoanState(season);
  }
  const offers = Array.isArray(src.offers) && src.offers.length ? src.offers : createBankLoanOffers(season);
  return { active:null, season, offers, history:Array.isArray(src.history) ? src.history.slice(-50) : [] };
}
function refreshBankLoanOffersForSeason(state, season=game?.seasonNumber || 1){
  const normalized = normalizeBankLoanState(state, { seasonNumber:season });
  if(normalized.active) return normalized;
  if(Number(normalized.season || 0) !== Number(season || 1)) return createBankLoanState(season);
  if(!Array.isArray(normalized.offers) || normalized.offers.length !== 3){
    normalized.offers = createBankLoanOffers(season);
  }
  return normalized;
}
function ensureBankLoanState(){
  if(!game) return null;
  game.bankLoan = normalizeBankLoanState(game.bankLoan, game);
  return game.bankLoan;
}
function requestBankLoan(offerId){
  if(!game || !BANK_LOANS_ENABLED) return;
  const state = ensureBankLoanState();
  if(state.active){ showNotice('Ya hay un préstamo activo. No se pueden pedir nuevos préstamos hasta cancelarlo.'); return; }
  const offer = (state.offers || []).find(item => String(item.id) === String(offerId));
  if(!offer){ showNotice('La oferta bancaria ya no está disponible.'); return; }
  const prestige = currentManagerPrestige();
  if(prestige < offer.prestigeCost){ showNotice(`Prestigio insuficiente. Necesitás ${offer.prestigeCost} y tenés ${formatManagerPrestige(prestige)}.`); return; }
  const startDate = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  const active = normalizeBankLoanActiveLoan({ ...offer, totalWeeks:offer.weeks, remainingWeeks:offer.weeks, remainingDebt:offer.totalToRepay, paid:0, startedDate:startDate, startedTurn:game.globalTurn || 0, lastPaymentDate:startDate, nextPaymentDate:validIsoDate(startDate) ? addDaysToIsoDate(startDate, 7) : '' });
  addManagerPrestige(-offer.prestigeCost, `Préstamo tomado con ${offer.bankName}. Costo de prestigio: ${offer.prestigeCost}`);
  recordBudgetChange(offer.amount, `Préstamo bancario de ${offer.bankName}`, { type:'bank_loan_disbursement', bankName:offer.bankName, loanId:offer.id, prestigeCost:offer.prestigeCost, interestRate:offer.interestRate, weeks:offer.weeks, totalToRepay:offer.totalToRepay });
  state.active = active;
  state.offers = [];
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push({ type:'accepted', date:game.currentDate || '', bankName:offer.bankName, amount:offer.amount, totalToRepay:offer.totalToRepay, weeks:offer.weeks, prestigeCost:offer.prestigeCost });
  saveLocal(true);
  renderFinances();
  showNotice(`Préstamo aprobado por ${offer.bankName}. Se acreditaron ${formatMoney(offer.amount)}.`);
}
function processBankLoanWeeklyPayment(paymentDate=null){
  if(!game || !BANK_LOANS_ENABLED) return 0;
  const state = ensureBankLoanState();
  const loan = state?.active;
  if(!loan || loan.remainingDebt <= 0 || loan.remainingWeeks <= 0) return 0;
  const effectivePaymentDate = validIsoDate(paymentDate) ? paymentDate : (validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : ''));
  const amount = Math.min(Math.max(1, Math.round(Number(loan.weeklyPayment || 0))), Math.round(Number(loan.remainingDebt || 0)));
  loan.remainingDebt = Math.max(0, Math.round(Number(loan.remainingDebt || 0) - amount));
  loan.paid = Math.max(0, Math.round(Number(loan.paid || 0) + amount));
  loan.remainingWeeks = Math.max(0, Math.round(Number(loan.remainingWeeks || 0) - 1));
  loan.lastPaymentDate = validIsoDate(effectivePaymentDate) ? effectivePaymentDate : (loan.lastPaymentDate || '');
  loan.nextPaymentDate = validIsoDate(loan.lastPaymentDate) ? addDaysToIsoDate(loan.lastPaymentDate, 7) : '';
  loan.daysSincePayment = 0;
  recordBudgetChange(-amount, `Cuota semanal préstamo ${loan.bankName}`, { type:'bank_loan_payment', bankName:loan.bankName, loanId:loan.id, remainingDebt:loan.remainingDebt, remainingWeeks:loan.remainingWeeks, paymentDate:loan.lastPaymentDate, nextPaymentDate:loan.nextPaymentDate });
  if(loan.remainingDebt <= 0 || loan.remainingWeeks <= 0){
    state.history = Array.isArray(state.history) ? state.history : [];
    state.history.push({ type:'paid', date:game.currentDate || '', bankName:loan.bankName, amount:loan.amount, paid:loan.paid });
    state.active = null;
    state.offers = [];
    pushGameMessage({ type:'finanzas', title:'Préstamo cancelado', body:`El club terminó de pagar el préstamo de ${loan.bankName}. Las nuevas ofertas aparecerán en la próxima temporada.`, priority:'normal' });
  }
  return amount;
}
function payOffBankLoanFull(){
  if(!game || !BANK_LOANS_ENABLED) return;
  const state = ensureBankLoanState();
  const loan = state?.active;
  if(!loan || Number(loan.remainingDebt || 0) <= 0){ showNotice('No hay préstamo activo para cancelar.'); return; }
  const amount = Math.max(0, Math.round(Number(loan.remainingDebt || 0)));
  if(!confirm(`¿Pagar ahora la totalidad del préstamo? Se descontarán ${formatMoney(amount)} del presupuesto del club.`)) return;
  loan.remainingDebt = 0;
  loan.paid = Math.max(0, Math.round(Number(loan.paid || 0) + amount));
  loan.remainingWeeks = 0;
  recordBudgetChange(-amount, `Cancelación total préstamo ${loan.bankName}`, { type:'bank_loan_full_payment', bankName:loan.bankName, loanId:loan.id, remainingDebt:0, remainingWeeks:0 });
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push({ type:'paid_full', date:game.currentDate || '', bankName:loan.bankName, amount:loan.amount, paid:loan.paid });
  state.active = null;
  state.offers = [];
  pushGameMessage({ type:'finanzas', title:'Préstamo cancelado', body:`El club pagó la totalidad restante del préstamo de ${loan.bankName}.`, priority:'normal' });
  saveLocal(true);
  renderFinances();
  showNotice('Préstamo cancelado por pago total.');
}
function bankLoanProgressMarkup(loan){
  const paid = Math.max(0, Math.round(Number(loan.paid || 0)));
  const total = Math.max(1, Math.round(Number(loan.totalToRepay || (paid + loan.remainingDebt) || 1)));
  const progress = clamp(Math.round((paid / total) * 100), 0, 100);
  const nextText = validIsoDate(loan.nextPaymentDate) ? ` · Próxima cuota: ${escapeHtml(loan.nextPaymentDate)}` : '';
  return `<div class="bank-loan-active"><div class="row"><div><p class="label">Préstamo activo</p><h3>${escapeHtml(loan.bankName)}</h3></div><span class="pill">${loan.remainingWeeks} semanas restantes</span></div><div class="bar transfer-budget-bar"><span style="width:${progress}%"></span></div><p class="muted small">Pagado: ${formatMoney(paid)} / ${formatMoney(total)} · Deuda restante: ${formatMoney(loan.remainingDebt)} · Cuota semanal: ${formatMoney(loan.weeklyPayment)}${nextText}</p><button class="ghost danger small" data-payoff-bank-loan>Cancelar préstamo completo</button></div>`;
}
function bankLoanOffersMarkup(){
  if(!BANK_LOANS_ENABLED) return '';
  const state = ensureBankLoanState();
  if(state.active){
    return `<div class="card bank-loan-card"><div class="row"><div><h3>Banco</h3><p class="muted small">Con un préstamo activo se bloquean nuevas solicitudes.</p></div></div>${bankLoanProgressMarkup(state.active)}</div>`;
  }
  const offers = state.offers || [];
  const prestige = currentManagerPrestige();
  const cards = offers.map(offer => {
    const locked = prestige < offer.prestigeCost;
    return `<div class="card bank-loan-offer"><div class="row"><div><p class="label">${escapeHtml(offer.bankName)}</p><h3>${formatMoney(offer.amount)}</h3></div><span class="pill ${locked ? 'bad-pill' : 'ok-pill'}">Prestigio ${offer.prestigeCost}</span></div><p class="muted small">Interés ${loanPercentLabel(offer.interestRate)} · ${offer.weeks} semanas · Total a devolver ${formatMoney(offer.totalToRepay)} · Cuota ${formatMoney(offer.weeklyPayment)}</p><button class="primary" data-request-bank-loan="${escapeHtml(offer.id)}" ${locked ? 'disabled' : ''}>Pedir préstamo</button></div>`;
  }).join('');
  return `<div class="card bank-loan-card"><div class="row"><div><h3>Banco</h3><p class="muted small">Tres ofertas por temporada. Tomar una resta prestigio al manager y suma el dinero al club.</p></div><span class="pill">Prestigio actual ${formatManagerPrestige(prestige)}</span></div><div class="grid cols-3 bank-loans-grid" style="margin-top:12px">${cards || '<p class="muted">No hay ofertas bancarias hasta la próxima temporada.</p>'}</div></div>`;
}
function financeRating(salaryTotal=0){
  const salaries = Math.max(1, Math.round(Number(salaryTotal || 0)));
  const budget = Math.max(0, Math.round(Number(game?.budget || 0)));
  const ratio = budget / salaries;
  if(ratio < 10) return { key:'destroyed', label:'economia destruida', tone:'bad', message:'La directiva alerta que el margen para sostener sueldos es crítico. Hay que vender, subir ingresos o recortar gastos.' };
  if(ratio < 20) return { key:'problems', label:'economia en problemas', tone:'bad', message:'La directiva ve riesgo financiero. El club puede competir, pero el margen es bajo.' };
  if(ratio < 40) return { key:'regular', label:'economia regular', tone:'warn', message:'La directiva considera que la economía está estable, aunque sin gran respaldo para errores.' };
  if(ratio < 50) return { key:'good', label:'economia buena', tone:'ok', message:'La directiva está conforme. Hay margen razonable para sostener el proyecto.' };
  return { key:'excellent', label:'economia excelente', tone:'ok', message:'La directiva está muy conforme. El club tiene una espalda financiera fuerte frente a la masa salarial.' };
}
function financeRatingMarkup(salaryTotal=0){
  const rating = financeRating(salaryTotal);
  const salaries = Math.max(1, Math.round(Number(salaryTotal || 0)));
  const budget = Math.max(0, Math.round(Number(game?.budget || 0)));
  return `<div class="card finance-rating-card"><div class="row"><div><p class="label">Calificación</p><h3 class="${rating.tone}">${escapeHtml(rating.label)}</h3></div><span class="pill">${Math.floor(budget / salaries)}x sueldos</span></div><p class="muted small">${escapeHtml(rating.message)}</p><p class="muted small">Referencia: presupuesto actual ${formatMoney(budget)} / sueldos anuales ${formatMoney(salaryTotal)}.</p></div>`;
}
function renderFinances(){
  const history = (game.budgetHistory || []).slice().reverse();
  const seasonExpenses = (game.budgetHistory || []).filter(h => (h.season || game.seasonNumber || 1) === (game.seasonNumber || 1) && Number(h.delta || 0) < 0).reduce((a,h)=>a+Math.abs(Number(h.delta || 0)),0);
  const seasonIncome = (game.budgetHistory || []).filter(h => (h.season || game.seasonNumber || 1) === (game.seasonNumber || 1) && Number(h.delta || 0) > 0).reduce((a,h)=>a+Number(h.delta || 0),0);
  const salaryTotal = totalClubSalary(game.selectedClubId);
  const rows = history.slice(0,80).map(entry => {
    const delta = Number(entry.delta || 0);
    const cls = delta > 0 ? 'ok' : delta < 0 ? 'bad' : 'muted';
    const ticketText = Number(entry.ticketRevenue || 0) > 0 ? ` <span class="pill finance-mini-pill">Recaudación ${formatMoney(entry.ticketRevenue)}</span>` : '';
    return `<tr><td>Temp. ${entry.season || game.seasonNumber || 1}</td><td>${escapeHtml(budgetConcept(entry))}${ticketText}</td><td><span class="${cls}">${delta > 0 ? '+' : ''}${formatMoney(delta)}</span></td><td><span class="${budgetTone(entry.budget || 0)}">${formatMoney(entry.budget || 0)}</span></td></tr>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title"><div><h2>Finanzas</h2><p class="tagline">Detalle del presupuesto, sus movimientos registrados y la masa salarial del plantel.</p></div></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Presupuesto actual</p><strong class="${budgetTone(game.budget || 0)}">${formatMoney(game.budget || 0)}</strong></div>
      <div class="card"><p class="label">Ingresos temporada</p><strong class="ok">${formatMoney(seasonIncome)}</strong></div>
      <div class="card"><p class="label">Gastos temporada</p><strong class="bad">${formatMoney(seasonExpenses)}</strong></div>
      <div class="card"><p class="label">Sueldos anuales estimados</p><strong>${formatMoney(salaryTotal)}</strong></div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${financeRatingMarkup(salaryTotal)}
      ${bankLoanOffersMarkup()}
    </div>
    <div style="margin-top:14px">${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}</div>
    <div class="grid cols-2 finance-category-grid" style="margin-top:14px">
      ${financeExpensesByCategoryMarkup()}
      ${financeIncomeByCategoryMarkup()}
    </div>
    <div class="card" style="margin-top:14px"><h3>Plantel y sueldos</h3>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Nac.</th><th>Edad</th><th>Media</th><th>Sueldo anual</th></tr></thead><tbody>${financeSquadRows() || '<tr><td colspan="5" class="muted">No hay jugadores en el plantel.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Movimientos</h3>
      <div class="table-wrap"><table><thead><tr><th>Temporada</th><th>Concepto</th><th>Monto</th><th>Presupuesto luego</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Todavía no hay movimientos registrados.</td></tr>'}</tbody></table></div>
    </div>`;
  document.querySelectorAll('[data-request-bank-loan]').forEach(btn => btn.addEventListener('click', () => requestBankLoan(btn.dataset.requestBankLoan)));
  document.querySelector('[data-payoff-bank-loan]')?.addEventListener('click', () => payOffBankLoanFull());
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
  noteOwnMatchForMonthlyExpenses(match);
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
  const ticketRevenue = isHome ? Math.round(Number(match?.matchContext?.ticketRevenue || 0)) : 0;
  const totalDelta = delta + ticketRevenue;
  const concept = ticketRevenue > 0 ? 'Resultado de partido + recaudación de entradas' : 'Resultado de partido';
  recordBudgetChange(totalDelta, concept, {
    matchId: match.id,
    multiplier,
    ticketRevenue,
    ticketPrice:match?.matchContext?.ticketPrice || 0,
    totalFans:match?.matchContext?.totalFans || 0,
    rivalPrestige:match?.matchContext?.rivalPrestige || 0,
    rivalPrestigeAttendanceBonusPct:match?.matchContext?.rivalPrestigeAttendanceBonusPct || 0
  });
}
function advanceStadiumAfterMatches(results){
  ensureStadiumState();
  const homePlayed = new Set((results || []).map(match => match.homeId));
  homePlayed.forEach(clubId => {
    if(BOT_FIELDS_FIXED_BY_SEASON && !isManagedClubField(clubId)) return;
    const project = stadiumProjectForClub(clubId);
    if(project.replantingTurnsLeft > 0){
      game.stadium.fields[clubId] = 30;
    } else {
      const rawDeterioration = rnd(5,8);
      const reductionPct = (typeof specialActiveBonus === 'function' && Number(clubId) === Number(game?.selectedClubId)) ? specialActiveBonus('deterioro_campo') : 0;
      const adjustedDeterioration = Math.max(0, rawDeterioration * (1 - (clamp(reductionPct, 0, 95) / 100)));
      game.stadium.fields[clubId] = clamp(Math.round(fieldScoreForClub(clubId) - adjustedDeterioration), 1, 100);
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
      next += rnd(POST_MATCH_RECOVERY_MIN, POST_MATCH_RECOVERY_MAX);
      if(played.has(player.id)) next -= conditionLossForPlayer(player) + (pitchFatigueByPlayer.get(player.id) || 0);
      else next += rnd(8,10);
      next += instructionConditionByPlayer.get(player.id) || 0;
    }
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
function trainingIndividualOptionByValue(value){
  return TRAINING_INDIVIDUAL_OPTIONS.find(opt => opt.value === value) || null;
}
function trainingIndividualLegacyMap(value){
  const map = { regenerative:'balanced', massage:'recovery', intense:'physical', tactical:'balanced', dayoff:'rest' };
  return map[value] || value;
}
function safeIndividualTrainingType(value){
  const mapped = trainingIndividualLegacyMap(value);
  if(trainingIndividualOptionByValue(mapped)) return mapped;
  if(trainingIndividualOptionByValue(TRAINING_INDIVIDUAL_INITIAL)) return TRAINING_INDIVIDUAL_INITIAL;
  return DEFAULT_INDIVIDUAL_TRAINING_TYPE;
}
function individualTrainingLabel(value){
  return trainingIndividualOptionByValue(value)?.label || trainingIndividualOptionByValue(DEFAULT_INDIVIDUAL_TRAINING_TYPE)?.label || 'Equilibrado';
}
function individualTrainingTone(value){
  return trainingIndividualOptionByValue(value)?.tone || trainingIndividualOptionByValue(DEFAULT_INDIVIDUAL_TRAINING_TYPE)?.tone || 'tactical';
}
function playerTrainingType(playerId){
  if(!game.trainingPlan) game.trainingPlan = {};
  game.trainingPlan[playerId] = safeIndividualTrainingType(game.trainingPlan[playerId]);
  return game.trainingPlan[playerId];
}
function trainingOptionsMarkup(current){
  return TRAINING_OPTIONS.map(opt => `<option value="${opt.value}" ${current===opt.value?'selected':''}>${opt.label}</option>`).join('');
}
function individualTrainingOptionsMarkup(current, includeEmpty=false){
  const safeCurrent = includeEmpty && !current ? '' : safeIndividualTrainingType(current);
  const blank = includeEmpty ? `<option value="" ${safeCurrent===''?'selected':''}>Aplicar a todo...</option>` : '';
  return blank + TRAINING_INDIVIDUAL_OPTIONS.map(opt => `<option value="${opt.value}" ${safeCurrent===opt.value?'selected':''}>${opt.label}</option>`).join('');
}
function normalizeIndividualTrainingPlan(plan){
  const source = plan && typeof plan === 'object' ? plan : {};
  const normalized = {};
  (seed?.players || []).forEach(player => {
    normalized[player.id] = safeIndividualTrainingType(source[player.id] ?? source[String(player.id)]);
  });
  return normalized;
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
function trainingSkillFinalChance(player, skill){
  if(!TRAINING_SKILL_CURVE_ENABLED) return 1;
  const current = clamp(Math.round(baseSkill(player, skill)), 1, 99);
  return clamp((100 - current) / 100, TRAINING_SKILL_MIN_FINAL_CHANCE, 1);
}
function trainingRawSkillValue(player, skill){
  return clamp(Math.round(baseSkill(player, skill)), 1, 99);
}
function ensureTrainingProgressForPlayer(playerId){
  if(!game.trainingSkillProgress) game.trainingSkillProgress = {};
  const key = String(playerId);
  game.trainingSkillProgress[key] = game.trainingSkillProgress[key] && typeof game.trainingSkillProgress[key] === 'object' && !Array.isArray(game.trainingSkillProgress[key]) ? game.trainingSkillProgress[key] : {};
  game.trainingSkillProgress[key].__general = Number(game.trainingSkillProgress[key].__general || 0);
  game.trainingSkillProgress[key].__individual = Number(game.trainingSkillProgress[key].__individual || 0);
  return game.trainingSkillProgress[key];
}
function applySeasonTrainingSkillBoost(player, skill){
  if(!player || !skill) return 0;
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  game.playerSkillBoosts[player.id] = game.playerSkillBoosts[player.id] && typeof game.playerSkillBoosts[player.id] === 'object' && !Array.isArray(game.playerSkillBoosts[player.id]) ? game.playerSkillBoosts[player.id] : {};
  const currentValue = trainingRawSkillValue(player, skill);
  if(currentValue >= 99) return 0;
  const currentBoost = Math.max(0, Math.round(Number(game.playerSkillBoosts[player.id][skill] || 0)));
  game.playerSkillBoosts[player.id][skill] = clamp(currentBoost + 1, 0, 30);
  return 1;
}
function trainingExpectedBoostProgress(player, skill, chanceScale=1, mode='individual'){
  const scaled = Math.max(0, Number(chanceScale || 0)) * TRAINING_SKILL_GAIN_MULTIPLIER;
  if(scaled <= 0) return 0;
  const finalChance = trainingSkillFinalChance(player, skill);
  if(mode === 'intense'){
    // El intensivo debe sentirse visible: dos turnos intensivos suelen generar 1-2 puntos temporales.
    // La habilidad base profesional no cambia; se suma como boost de temporada.
    return clamp(scaled * (0.60 + (finalChance * 0.40)), 0, 1.25);
  }
  return clamp(0.35 * scaled * finalChance, 0, 0.75);
}
function improveSkillFromPool(player, skills, chanceScale=1, options={}){
  const mode = options?.mode === 'intense' ? 'intense' : 'individual';
  const progressKey = mode === 'intense' ? '__general' : '__individual';
  const available = (skills || []).filter(skill => Number.isFinite(trainingRawSkillValue(player, skill)) && trainingRawSkillValue(player, skill) < 99);
  if(!available.length) return 0;
  const progress = ensureTrainingProgressForPlayer(player.id);
  const token = `${player.id}-${game.seasonNumber || 1}-${game.matchdayIndex || 0}-${typeof currentGlobalDayNumber === 'function' ? currentGlobalDayNumber() : 0}-${mode}-${skillRollToken()}`;
  let gain = 0;
  let safety = 0;
  const firstSkill = available[hashNumber(token, available.length)];
  progress[progressKey] = clamp(Number(progress[progressKey] || 0) + trainingExpectedBoostProgress(player, firstSkill, chanceScale, mode), 0, 12);
  while(progress[progressKey] >= 1 && gain < (mode === 'intense' ? 2 : 1) && safety < 8){
    const skill = available[hashNumber(`${token}-${gain}-${safety}`, available.length)];
    const applied = applySeasonTrainingSkillBoost(player, skill);
    if(applied){
      progress[progressKey] = Math.max(0, Number(progress[progressKey] || 0) - 1);
      gain += applied;
    }else{
      progress[progressKey] = Math.max(0, Number(progress[progressKey] || 0) - 0.35);
    }
    safety += 1;
  }
  return gain;
}
function skillRollToken(){
  return `${Date.now()}-${Math.random()}`;
}
function improveRandomSkill(player, chanceScale=1, options={}){
  return improveSkillFromPool(player, trainableSkillsForPlayer(player), chanceScale, options);
}
function individualTrainingSkillPool(player, type){
  const pools = {
    physical:['resistencia','velocidad','aceleracion','fuerza'],
    technical:['tecnica','paseCorto','paseLargo','vision','regate'],
    defensive:['marca','entradas','posicionamiento','fuerza','trabajoEquipo'],
    attacking:['remate','regate','posicionamiento','serenidad','cabezazo','velocidad'],
    goalkeeper:['porteria','posicionamiento','serenidad','paseLargo','liderazgo'],
    mental:['serenidad','disciplina','liderazgo','trabajoEquipo']
  };
  if(type === 'goalkeeper' && player.position !== 'POR') return ['posicionamiento','serenidad','paseLargo','liderazgo'];
  return pools[type] || trainableSkillsForPlayer(player);
}
function applyTrainingSessionToPlayer(player, type, scale, conditionDraft, moraleDraft){
  let gain = 0;
  if(type === 'regenerative'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(1,3) * scale, 0, 99);
  } else if(type === 'massage'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(5,8) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(2,3) * scale, 1, 99);
  } else if(type === 'intense'){
    gain += improveRandomSkill(player, scale, { mode:'intense' });
    conditionDraft[player.id] = clamp(conditionDraft[player.id] - rnd(2,3) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] - rnd(5,6) * scale, 1, 99);
  } else if(type === 'dayoff'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(1,2) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(8,10) * scale, 1, 99);
  }
  return gain;
}
function applyIndividualTrainingSessionToPlayer(player, type, scale, conditionDraft, moraleDraft){
  const focus = safeIndividualTrainingType(type);
  if(focus === 'recovery'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(1,3) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(1,2) * scale, 1, 99);
    return 0;
  }
  if(focus === 'rest'){
    conditionDraft[player.id] = clamp(conditionDraft[player.id] + rnd(1,2) * scale, 0, 99);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(3,5) * scale, 1, 99);
    return 0;
  }
  if(focus === 'mental'){
    const gain = improveSkillFromPool(player, individualTrainingSkillPool(player, focus), scale * 0.75);
    moraleDraft[player.id] = clamp(moraleDraft[player.id] + rnd(1,3) * scale, 1, 99);
    return gain;
  }
  if(focus === 'balanced'){
    const gain = improveRandomSkill(player, scale * 0.75);
    conditionDraft[player.id] = clamp(conditionDraft[player.id] - rnd(0,1) * scale, 0, 99);
    return gain;
  }
  const gain = improveSkillFromPool(player, individualTrainingSkillPool(player, focus), scale);
  const hardFocus = focus === 'physical' || focus === 'attacking';
  conditionDraft[player.id] = clamp(conditionDraft[player.id] - rnd(hardFocus ? 2 : 1, hardFocus ? 3 : 2) * scale, 0, 99);
  moraleDraft[player.id] = clamp(moraleDraft[player.id] - rnd(1, hardFocus ? 3 : 2) * scale, 1, 99);
  return gain;
}
function applyTrainingEffects(){
  if(!game) return;
  game.trainingPlan = normalizeIndividualTrainingPlan(game.trainingPlan);
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
  const individualScale = TRAINING_INDIVIDUAL_SLOT_EFFECTIVENESS / Math.max(1, DAYS_PER_ADVANCE);
  let tacticalGain = 0;
  let intenseSessions = 0;
  let massageSessions = 0;
  let wearAdded = 0;
  let wearReduced = 0;
  let individualSessions = 0;
  let individualSkillGains = 0;
  let generalSkillGains = 0;
  const slots = trainingScheduleSlots();
  slots.forEach(item => {
    if(item.type === 'tactical'){
      tacticalGain += Math.random() < TEAM_COHESION_TACTICAL_TRAINING_CHANCE ? TEAM_COHESION_TACTICAL_TRAINING_GAIN : 0;
      return;
    }
    if(item.type === 'intense') intenseSessions += 1;
    if(item.type === 'massage') massageSessions += 1;
    squad.forEach(player => { generalSkillGains += applyTrainingSessionToPlayer(player, item.type, scale, conditionDraft, moraleDraft) || 0; });
  });
  if(TRAINING_INDIVIDUAL_ENABLED){
    for(let day=0; day<Math.max(1, DAYS_PER_ADVANCE); day += 1){
      squad.forEach(player => {
        const type = playerTrainingType(player.id);
        individualSkillGains += applyIndividualTrainingSessionToPlayer(player, type, individualScale, conditionDraft, moraleDraft);
        individualSessions += 1;
      });
    }
  }
  if(PLAYER_WEAR_ENABLED && (intenseSessions || massageSessions)){
    squad.forEach(player => {
      if(intenseSessions) wearAdded += Math.max(0, adjustPlayerWear(player.id, intenseSessions * PLAYER_WEAR_INTENSE_TRAINING));
      if(massageSessions) wearReduced += Math.abs(Math.min(0, adjustPlayerWear(player.id, -massageSessions * PLAYER_WEAR_MASSAGE_RECOVERY)));
    });
  }
  squad.forEach(player => {
    game.playerCondition[player.id] = clamp(Math.min(Math.round(conditionDraft[player.id]), maxConditionForPlayer(player.id)), 0, 99);
    game.playerMorale[player.id] = clamp(Math.round(moraleDraft[player.id]), 1, 99);
  });
  if(tacticalGain > 0){
    ensureTeamCohesion();
    game.teamCohesion[game.selectedClubId] = clamp(Math.round(cohesionValue(game.selectedClubId) + tacticalGain), 0, 100);
  }
  game.lastTrainingApplied = { ...turnStamp(), tacticalGain, intenseSessions, massageSessions, wearAdded, wearReduced, slotsApplied:slots.length, slotEffectiveness:TRAINING_SLOT_EFFECTIVENESS, generalSkillGains, individualSessions, individualSkillGains, totalSkillGains:generalSkillGains + individualSkillGains, individualSlotEffectiveness:TRAINING_INDIVIDUAL_SLOT_EFFECTIVENESS };
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

function savedTrainingPlansPanelMarkup(){
  try{
    const maxSlots = typeof maxTrainingSaveSlots === 'function' ? maxTrainingSaveSlots() : (Number.isFinite(Number(typeof TRAINING_SAVE_SLOT_COUNT !== 'undefined' ? TRAINING_SAVE_SLOT_COUNT : 3)) ? Number(TRAINING_SAVE_SLOT_COUNT) : 3);
    const slots = [];
    for(let i=1; i<=maxSlots; i++){
      const info = typeof trainingPlanSlotStatus === 'function' ? trainingPlanSlotStatus(i) : { exists:false, label:'Vacío', details:'Sin plan semanal guardado.' };
      slots.push(`<div class="saved-tactic-slot saved-training-slot ${info.exists ? 'filled' : 'empty'}">
        <div><strong>${escapeHtml(info.exists ? info.label : `Entrenamiento ${i}`)}</strong><span>${escapeHtml(info.exists ? `Espacio ${i}` : 'Vacío')}</span><em>${escapeHtml(info.details || '')}</em></div>
        <div class="saved-tactic-actions">
          <button type="button" class="ghost" data-save-training-plan-slot="${i}">Guardar ${i}</button>
          <button type="button" class="primary" data-load-training-plan-slot="${i}" ${info.exists ? '' : 'disabled'}>Cargar ${i}</button>
        </div>
      </div>`);
    }
    return `<div class="card saved-tactics-card saved-training-card" style="margin-top:14px">
      <div class="row"><div><h3>Entrenamientos guardados</h3><p class="muted small">Guardá hasta 3 planes semanales con nombre personalizado. Incluye turnos generales de los 7 días y el 5º entrenamiento individual de los jugadores actuales.</p></div><button type="button" class="ghost small" data-reset-saved-training-plans>Reiniciar guardados</button></div>
      <div class="saved-tactics-grid">${slots.join('')}</div>
    </div>`;
  }catch(err){
    console.error('No se pudo renderizar entrenamientos guardados', err);
    return `<div class="card saved-tactics-card saved-training-card" style="margin-top:14px">
      <div class="row"><div><h3>Entrenamientos guardados</h3><p class="bad small">Hay datos inválidos en los entrenamientos guardados. La pestaña sigue disponible; podés reiniciar solo estos guardados.</p></div><button type="button" class="danger small" data-reset-saved-training-plans>Reiniciar guardados</button></div>
    </div>`;
  }
}
function bindSavedTrainingPlanButtons(){
  document.querySelectorAll('[data-save-training-plan-slot]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(typeof saveCurrentTrainingPlanSlot === 'function') saveCurrentTrainingPlanSlot(Number(btn.dataset.saveTrainingPlanSlot || 1));
    });
  });
  document.querySelectorAll('[data-load-training-plan-slot]').forEach(btn => {
    btn.addEventListener('click', () => {
      if(typeof loadSavedTrainingPlanSlot === 'function') loadSavedTrainingPlanSlot(Number(btn.dataset.loadTrainingPlanSlot || 1));
    });
  });
  document.querySelector('[data-reset-saved-training-plans]')?.addEventListener('click', () => {
    if(confirm('¿Reiniciar sólo los entrenamientos guardados? No borra la partida ni el plan semanal actual.')){
      if(typeof resetSavedTrainingPlans === 'function') resetSavedTrainingPlans();
    }
  });
}

function renderTraining(){
  const squad = sortedTrainingPlayers();
  try{ currentTrainingSchedule(); }catch(err){ console.warn('Plan semanal inválido; se restablece.', err); game.trainingSchedule = defaultTrainingSchedule(); }
  try{ game.trainingPlan = normalizeIndividualTrainingPlan(game.trainingPlan); }catch(err){ console.warn('Plan individual inválido; se restablece.', err); game.trainingPlan = {}; }
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Entrenamiento</h2>
        <p class="tagline">Planificá 7 días: 4 turnos generales para todo el plantel y un 5º entrenamiento diario individual por jugador.</p>
      </div>
      <span class="pill">Cohesión: ${cohesionValue(game.selectedClubId)}/100</span>
    </div>
    ${savedTrainingPlansPanelMarkup()}
    <div class="card training-calendar-card">
      <div class="row"><h3>Plan semanal general</h3><button class="btn ghost small" data-reset-training-week>Restablecer semana</button></div>
      ${trainingSummaryMarkup()}
      <div class="training-week-grid">${TRAINING_DAY_LABELS.map((label, index) => trainingDayCard(label, index)).join('')}</div>
    </div>
    <div class="card" style="margin-top:14px">
      <div class="row training-player-plan-head"><div><h3>Estado del plantel</h3><span class="muted">El entrenamiento individual se aplica una vez por día a cada jugador en el próximo avance.</span></div><select class="training-individual-bulk" data-bulk-player-training>${individualTrainingOptionsMarkup('', true)}</select></div>
      <div class="table-wrap"><table class="training-table"><thead><tr><th>${trainingColumnSort('Jugador', [['nombre_asc','A-Z'],['nombre_desc','Z-A'],['dorsal_asc','Dorsal ↑'],['dorsal_desc','Dorsal ↓']])}</th><th>${trainingColumnSort('POS', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th><th>${trainingColumnSort('Edad', [['edad_asc','Menor'],['edad_desc','Mayor']])}</th><th>${trainingColumnSort('Media', [['media_desc','Mayor'],['media_asc','Menor']])}</th><th>${trainingColumnSort('Estado físico', [['condicion_desc','Mayor'],['condicion_asc','Menor']])}</th><th>${trainingColumnSort('Moral', [['moral_desc','Mayor'],['moral_asc','Menor']])}</th><th>5º entrenamiento</th></tr></thead><tbody>
        ${squad.map(player => trainingPlayerRow(player)).join('')}
      </tbody></table></div>
    </div>
  `;
  prependFirstTeamTabs('training');
  bindSavedTrainingPlanButtons();
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
  document.querySelectorAll('[data-player-training]').forEach(select => {
    select.addEventListener('change', () => {
      const playerId = Number(select.dataset.playerTraining);
      game.trainingPlan = normalizeIndividualTrainingPlan(game.trainingPlan);
      game.trainingPlan[playerId] = safeIndividualTrainingType(select.value);
      saveLocal(true);
      renderTraining();
      showNotice('Entrenamiento individual actualizado.');
    });
  });
  document.querySelector('[data-bulk-player-training]')?.addEventListener('change', event => {
    const value = safeIndividualTrainingType(event.target.value);
    if(!event.target.value) return;
    game.trainingPlan = normalizeIndividualTrainingPlan(game.trainingPlan);
    playersByClub(game.selectedClubId).forEach(player => { game.trainingPlan[player.id] = value; });
    saveLocal(true);
    renderTraining();
    showNotice(`Entrenamiento individual aplicado a todo el plantel: ${individualTrainingLabel(value)}.`);
  });
  document.querySelector('[data-reset-training-week]')?.addEventListener('click', () => {
    game.trainingSchedule = defaultTrainingSchedule();
    saveLocal(true);
    renderTraining();
    showNotice('Plan semanal general restablecido.');
  });
}
function trainingPlayerRow(player){
  const individual = playerTrainingType(player.id);
  return `<tr>
    <td><div class="training-player-cell">${faceImg(player,'training-face')}<button class="linklike" data-player-id="${player.id}">${availabilityIcons(player.id)}${escapeHtml(player.name)}</button></div></td>
    <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
    <td>${Number(player.age || 0) || '—'}</td>
    <td><strong>${visibleOverall(player)}</strong></td>
    <td>${conditionBar(player.id)}</td>
    <td>${moraleBar(player.id)}</td>
    <td><select class="training-individual-select training-tone-${individualTrainingTone(individual)}" data-player-training="${player.id}">${individualTrainingOptionsMarkup(individual)}</select></td>
  </tr>`;
}

