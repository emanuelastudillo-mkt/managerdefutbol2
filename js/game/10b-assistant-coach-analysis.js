/* V8.81 · Segundo entrenador: análisis de plantel, vestuario, contratos, calendario y economía. */

const ASSISTANT_COACH_STAFF_ID = 'assistant_coach';
const ASSISTANT_COACH_HISTORY_LIMIT = 20;

function createInitialAssistantCoachAnalysisState(){
  return {
    version:1,
    category:'regular',
    clubId:0,
    cycleStartDate:'',
    ready:false,
    readyNotified:false,
    analysesCompleted:0,
    lastAnalysisDate:'',
    lastAnalysis:null,
    history:[],
    pausedReason:''
  };
}

function normalizeAssistantCoachRecommendation(value){
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    id:String(raw.id || ''),
    area:String(raw.area || 'general'),
    score:Math.max(0, Math.min(100, Math.round(Number(raw.score || 0)))),
    tone:String(raw.tone || 'opportunity'),
    priority:String(raw.priority || 'Oportunidad'),
    title:String(raw.title || 'Revisar la situación'),
    body:String(raw.body || ''),
    evidence:String(raw.evidence || ''),
    action:String(raw.action || 'home'),
    actionLabel:String(raw.actionLabel || 'Ir a Inicio')
  };
}

function normalizeAssistantCoachAnalysisRecord(value){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const snapshot = value.snapshot && typeof value.snapshot === 'object' && !Array.isArray(value.snapshot)
    ? {
        teamOverall:Math.max(0, Math.round(Number(value.snapshot.teamOverall || 0))),
        divisionAverage:Math.max(0, Math.round(Number(value.snapshot.divisionAverage || 0))),
        qualityGap:Math.round(Number(value.snapshot.qualityGap || 0)),
        squadCount:Math.max(0, Math.round(Number(value.snapshot.squadCount || 0))),
        fitness:Math.max(0, Math.round(Number(value.snapshot.fitness || 0))),
        morale:Math.max(0, Math.round(Number(value.snapshot.morale || 0))),
        injuries:Math.max(0, Math.round(Number(value.snapshot.injuries || 0))),
        budget:Math.round(Number(value.snapshot.budget || 0)),
        personalBalance:Math.round(Number(value.snapshot.personalBalance || 0)),
        academyCount:Math.max(0, Math.round(Number(value.snapshot.academyCount || 0))),
        academyCapacity:Math.max(0, Math.round(Number(value.snapshot.academyCapacity || 0))),
        fieldScore:Math.max(0, Math.round(Number(value.snapshot.fieldScore || 0))),
        stadiumCapacity:Math.max(0, Math.round(Number(value.snapshot.stadiumCapacity || 0))),
        formation:String(value.snapshot.formation || '—'),
        tacticFit:Math.max(0, Math.round(Number(value.snapshot.tacticFit || 0))),
        savedPlans:Math.max(0, Math.round(Number(value.snapshot.savedPlans || 0))),
        generalTrust:Math.max(0, Math.min(100, Math.round(Number(value.snapshot.generalTrust ?? 50)))),
        referentTrust:Math.max(0, Math.min(100, Math.round(Number(value.snapshot.referentTrust ?? value.snapshot.generalTrust ?? 50)))),
        starterTrust:Math.max(0, Math.min(100, Math.round(Number(value.snapshot.starterTrust ?? value.snapshot.generalTrust ?? 50)))),
        substituteTrust:Math.max(0, Math.min(100, Math.round(Number(value.snapshot.substituteTrust ?? value.snapshot.generalTrust ?? 50)))),
        youthTrust:Math.max(0, Math.min(100, Math.round(Number(value.snapshot.youthTrust ?? value.snapshot.generalTrust ?? 50)))),
        expiringContracts:Math.max(0, Math.round(Number(value.snapshot.expiringContracts || 0))),
        nextSeasonContracts:Math.max(0, Math.round(Number(value.snapshot.nextSeasonContracts || 0))),
        difficultRenewals:Math.max(0, Math.round(Number(value.snapshot.difficultRenewals || 0))),
        nextOpponentName:String(value.snapshot.nextOpponentName || ''),
        nextOpponentOverall:Math.max(0, Math.round(Number(value.snapshot.nextOpponentOverall || 0))),
        nextCompetition:String(value.snapshot.nextCompetition || ''),
        nextMatchRequiresWinner:Boolean(value.snapshot.nextMatchRequiresWinner),
        nextMatchNeutral:Boolean(value.snapshot.nextMatchNeutral)
      }
    : {};
  return {
    id:String(value.id || ''),
    date:validIsoDate(value.date) ? value.date : '',
    season:Math.max(1, Math.round(Number(value.season || 1))),
    clubId:Math.max(0, Math.round(Number(value.clubId || 0))),
    clubName:String(value.clubName || ''),
    category:String(value.category || 'regular'),
    categoryLabel:String(value.categoryLabel || ''),
    cycleDays:Math.max(1, Math.round(Number(value.cycleDays || 25))),
    summary:String(value.summary || ''),
    snapshot,
    recommendations:(Array.isArray(value.recommendations) ? value.recommendations : [])
      .map(normalizeAssistantCoachRecommendation)
      .filter(item => item.title)
      .slice(0, 3)
  };
}

function normalizeAssistantCoachAnalysisState(value){
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const category = ['regular','bueno','elite'].includes(String(raw.category || '')) ? String(raw.category) : 'regular';
  const history = (Array.isArray(raw.history) ? raw.history : [])
    .map(normalizeAssistantCoachAnalysisRecord)
    .filter(Boolean)
    .slice(-ASSISTANT_COACH_HISTORY_LIMIT);
  const lastAnalysis = normalizeAssistantCoachAnalysisRecord(raw.lastAnalysis) || history[history.length - 1] || null;
  return {
    version:1,
    category,
    clubId:Math.max(0, Math.round(Number(raw.clubId || 0))),
    cycleStartDate:validIsoDate(raw.cycleStartDate) ? raw.cycleStartDate : '',
    ready:Boolean(raw.ready),
    readyNotified:Boolean(raw.readyNotified),
    analysesCompleted:Math.max(history.length, Math.round(Number(raw.analysesCompleted || 0))),
    lastAnalysisDate:validIsoDate(raw.lastAnalysisDate) ? raw.lastAnalysisDate : (lastAnalysis?.date || ''),
    lastAnalysis,
    history,
    pausedReason:String(raw.pausedReason || '')
  };
}

function assistantCoachAnalysisState(){
  if(!game) return createInitialAssistantCoachAnalysisState();
  game.assistantCoachAnalysis = normalizeAssistantCoachAnalysisState(game.assistantCoachAnalysis);
  return game.assistantCoachAnalysis;
}

function assistantCoachCurrentDate(){
  if(validIsoDate(game?.currentDate)) return game.currentDate;
  const current = typeof currentCalendarDate === 'function' ? currentCalendarDate() : '';
  return validIsoDate(current) ? current : '';
}

function assistantCoachCycleDays(categoryId='regular'){
  const category = ['regular','bueno','elite'].includes(String(categoryId || '')) ? String(categoryId) : 'regular';
  const fromDefinition = Number(staffDefinition(ASSISTANT_COACH_STAFF_ID)?.diasAnalisisPorCategoria?.[category]);
  if(Number.isFinite(fromDefinition) && fromDefinition > 0) return Math.round(fromDefinition);
  return Math.max(1, Math.round(Number(ASSISTANT_COACH_ANALYSIS_DAYS?.[category] || 25)));
}

function assistantCoachProgress(){
  const state = assistantCoachAnalysisState();
  const active = Boolean(game && staffActive(ASSISTANT_COACH_STAFF_ID));
  const contract = active ? staffContract(ASSISTANT_COACH_STAFF_ID) : null;
  const category = String(contract?.category || state.category || 'regular');
  const totalDays = assistantCoachCycleDays(category);
  const today = assistantCoachCurrentDate();
  const elapsedDays = active && validIsoDate(state.cycleStartDate) && validIsoDate(today)
    ? Math.max(0, daysBetweenIsoDates(state.cycleStartDate, today))
    : 0;
  const ready = active && (state.ready || elapsedDays >= totalDays);
  const percent = ready ? 100 : Math.max(0, Math.min(100, Math.floor((elapsedDays / totalDays) * 100)));
  return {
    active,
    category,
    categoryLabel:staffCategoryFor(ASSISTANT_COACH_STAFF_ID, category).nombre,
    totalDays,
    elapsedDays:Math.min(totalDays, elapsedDays),
    daysLeft:ready ? 0 : Math.max(0, totalDays - elapsedDays),
    percent,
    ready,
    today
  };
}

function initializeAssistantCoachAnalysisAfterHire(categoryId='regular'){
  if(!game) return null;
  const previous = assistantCoachAnalysisState();
  const category = ['regular','bueno','elite'].includes(String(categoryId || '')) ? String(categoryId) : 'regular';
  game.assistantCoachAnalysis = {
    ...previous,
    category,
    clubId:Number(game.selectedClubId || 0),
    cycleStartDate:assistantCoachCurrentDate(),
    ready:false,
    readyNotified:false,
    pausedReason:''
  };
  return game.assistantCoachAnalysis;
}

function pauseAssistantCoachAnalysis(reason='inactive'){
  if(!game) return null;
  const state = assistantCoachAnalysisState();
  state.cycleStartDate = '';
  state.ready = false;
  state.readyNotified = false;
  state.clubId = 0;
  state.pausedReason = String(reason || 'inactive');
  game.assistantCoachAnalysis = state;
  return state;
}

function persistAssistantCoachAnalysisSoon(){
  if(!game || game._assistantCoachSavePending || typeof saveLocal !== 'function') return;
  game._assistantCoachSavePending = true;
  setTimeout(() => {
    Promise.resolve(saveLocal(true)).catch(()=>{}).finally(() => {
      if(game) game._assistantCoachSavePending = false;
    });
  }, 0);
}

function refreshAssistantCoachAnalysisAvailability(options={}){
  if(!game) return false;
  const active = staffActive(ASSISTANT_COACH_STAFF_ID);
  const state = assistantCoachAnalysisState();
  let changed = false;
  if(!active){
    if(state.cycleStartDate || state.ready || state.readyNotified || state.clubId){
      pauseAssistantCoachAnalysis('inactive');
      changed = true;
    }
    if(changed && options.save) persistAssistantCoachAnalysisSoon();
    return changed;
  }
  const contract = staffContract(ASSISTANT_COACH_STAFF_ID);
  const category = String(contract?.category || state.category || 'regular');
  const today = assistantCoachCurrentDate();
  if(state.category !== category){ state.category = category; changed = true; }
  if(Number(state.clubId || 0) !== Number(game.selectedClubId || 0)){ state.clubId = Number(game.selectedClubId || 0); changed = true; }
  if(!validIsoDate(state.cycleStartDate) && validIsoDate(today)){ state.cycleStartDate = today; changed = true; }
  state.pausedReason = '';
  const progress = assistantCoachProgress();
  if(progress.ready && !state.ready){ state.ready = true; changed = true; }
  if(state.ready && !state.readyNotified && options.notify !== false){
    state.readyNotified = true;
    changed = true;
    if(typeof pushGameMessage === 'function') pushGameMessage({
      id:`assistant-coach-ready-${game.seasonNumber || 1}-${state.cycleStartDate || today}-${category}`,
      type:'empleados',
      priority:'high',
      title:'Nuevo análisis de situación disponible',
      body:`El Segundo entrenador ${progress.categoryLabel} terminó su revisión de ${clubName(game.selectedClubId)}. Ya podés solicitar tres prioridades personalizadas.`,
      action:{ type:'openEmployees', label:'Ver al Segundo entrenador' }
    });
  }
  game.assistantCoachAnalysis = state;
  if(changed && options.save) persistAssistantCoachAnalysisSoon();
  return changed;
}

function assistantCoachAverage(values){
  const clean = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
  return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
}

function assistantCoachClubOverall(clubId){
  const squad = typeof playersByClub === 'function' ? playersByClub(clubId) : [];
  return Math.round(assistantCoachAverage(squad.map(player => visibleOverall(player))));
}

function assistantCoachTacticFit(){
  const tactic = game?.tactic || {};
  const roles = typeof tacticRoleSlots === 'function'
    ? tacticRoleSlots(tactic)
    : (FORMATIONS[tactic.formation] || FORMATIONS['4-4-2'] || []);
  const starters = Array.isArray(tactic.starters) ? tactic.starters.slice(0, 11) : [];
  const scores = [];
  for(let index=0; index<11; index += 1){
    const player = typeof playerById === 'function' ? playerById(Number(starters[index] || 0)) : null;
    const role = roles[index] || '';
    scores.push(player && role && typeof playerTacticFitPercent === 'function' ? playerTacticFitPercent(player, role) : 0);
  }
  return Math.round(assistantCoachAverage(scores));
}

function assistantCoachSituationSnapshot(){
  const clubId = Number(game?.selectedClubId || 0);
  const squad = typeof playersByClub === 'function' ? playersByClub(clubId) : [];
  const club = seed?.clubs?.find(item => Number(item.id) === clubId) || {};
  const divisionClubs = (seed?.clubs || []).filter(item =>
    String(item.divisionId || '') === String(club.divisionId || '')
    && !(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(item))
  );
  const divisionClubAverages = divisionClubs
    .map(item => assistantCoachClubOverall(item.id))
    .filter(value => value > 0);
  const teamOverall = assistantCoachClubOverall(clubId);
  const divisionAverage = Math.round(assistantCoachAverage(divisionClubAverages)) || teamOverall;
  const groups = { gk:0, def:0, mid:0, att:0 };
  squad.forEach(player => {
    const group = typeof roleMeta === 'function' ? roleMeta(player.position).group : '';
    if(Object.prototype.hasOwnProperty.call(groups, group)) groups[group] += 1;
  });
  const injured = typeof injuredPlayersByClub === 'function' ? injuredPlayersByClub(clubId) : [];
  const academyPlayers = Array.isArray(game?.academy?.players)
    ? game.academy.players.filter(player => String(player?.status || '') === 'academy')
    : [];
  const academyLimit = typeof academyCapacity === 'function' ? academyCapacity() : 0;
  const nextMatch = typeof getNextMatchForSelected === 'function' ? getNextMatchForSelected() : null;
  const nextOpponentId = nextMatch
    ? (Number(nextMatch.homeId) === clubId ? Number(nextMatch.awayId || 0) : Number(nextMatch.homeId || 0))
    : 0;
  const philosophyScores = game?.managerPhilosophy?.status === 'completed'
    ? (game.managerPhilosophy?.result?.scores || null)
    : null;
  const savedPlans = Object.values(game?.savedTactics?.slots || {}).filter(Boolean).length;
  const formation = String(game?.tactic?.formation || '—');
  const dressing = typeof managerDressingRoomState === 'function' ? managerDressingRoomState() : null;
  const groupTrustValue = group => Math.round(Number(dressing?.groupTrust?.[group]?.value ?? dressing?.generalTrust ?? 50));
  const season = Math.max(1, Math.round(Number(game?.seasonNumber || 1)));
  const expiringContracts = squad.filter(player => Number(player?.contractEndSeason || season) <= season).length;
  const nextSeasonContracts = squad.filter(player => Number(player?.contractEndSeason || season) === season + 1).length;
  const difficultRenewals = squad.filter(player => {
    const disposition = typeof managerDressingRoomRenewalDisposition === 'function'
      ? managerDressingRoomRenewalDisposition(player?.id)
      : null;
    return ['hard','refusal','exit'].includes(String(disposition?.code || ''));
  }).length;
  const nextCompetition = String(nextMatch?.divisionName || nextMatch?.competitionName || nextMatch?.competition || '');
  return {
    clubId,
    clubName:String(club.name || clubName(clubId)),
    squad,
    squadCount:squad.length,
    groups,
    averageAge:Math.round(assistantCoachAverage(squad.map(player => Number(player.age || 0)))),
    teamOverall,
    divisionAverage,
    qualityGap:teamOverall - divisionAverage,
    fitness:typeof squadFitnessAverage === 'function' ? squadFitnessAverage(clubId) : 0,
    morale:typeof squadMoraleAverage === 'function' ? squadMoraleAverage(clubId) : 0,
    injuries:injured.length,
    budget:Math.round(Number(game?.budget || 0)),
    personalBalance:typeof managerPersonalBalance === 'function' ? managerPersonalBalance() : 0,
    academyCount:academyPlayers.length,
    academyCapacity:academyLimit,
    academyAge17:academyPlayers.filter(player => Number(player.age || 0) >= 17).length,
    youthPreparer:typeof staffActive === 'function' ? staffActive('youth_preparer') : false,
    youthExpertBonus:typeof specialActiveBonus === 'function' ? Number(specialActiveBonus('experto_juveniles') || 0) : 0,
    fieldScore:typeof fieldScoreForClub === 'function' ? fieldScoreForClub(clubId) : Math.round(Number(club.fieldConditionScore || 0)),
    stadiumCapacity:typeof clubStadiumCapacity === 'function' ? clubStadiumCapacity(clubId) : Math.round(Number(club.stadiumCapacity || 0)),
    formation,
    tacticFit:assistantCoachTacticFit(),
    savedPlans,
    tacticProblems:Array.isArray(game?.lastOwnProblems) ? game.lastOwnProblems.filter(Boolean).length : 0,
    generalTrust:Math.round(Number(dressing?.generalTrust ?? 50)),
    referentTrust:groupTrustValue('referent'),
    starterTrust:groupTrustValue('starter'),
    substituteTrust:groupTrustValue('substitute'),
    youthTrust:groupTrustValue('youth'),
    expiringContracts,
    nextSeasonContracts,
    difficultRenewals,
    nextOpponentId,
    nextOpponentName:nextOpponentId ? clubName(nextOpponentId) : '',
    nextOpponentOverall:nextOpponentId ? assistantCoachClubOverall(nextOpponentId) : 0,
    nextCompetition,
    nextMatchRequiresWinner:Boolean(nextMatch?.requiresWinner || nextMatch?.nationalCup || nextMatch?.nationalSupercup),
    nextMatchNeutral:Boolean(nextMatch?.neutralVenue || nextMatch?.nationalCup || nextMatch?.nationalSupercup),
    philosophyScores
  };
}

function assistantCoachPriorityLabel(score){
  if(score >= 90) return 'Crítico';
  if(score >= 75) return 'Prioridad alta';
  return 'Oportunidad';
}

function assistantCoachRecommendations(facts){
  const candidates = [];
  const add = (score, id, area, tone, title, body, evidence, action, actionLabel) => {
    candidates.push({
      id,
      area,
      score:Math.max(0, Math.min(100, Math.round(Number(score || 0)))),
      tone,
      priority:assistantCoachPriorityLabel(score),
      title,
      body,
      evidence,
      action,
      actionLabel
    });
  };

  const roleShortages = [];
  if(facts.groups.gk < 2) roleShortages.push('2 porteros');
  if(facts.groups.def < 6) roleShortages.push('6 defensores');
  if(facts.groups.mid < 6) roleShortages.push('6 mediocampistas');
  if(facts.groups.att < 4) roleShortages.push('4 atacantes');
  if(facts.squadCount < 18 || roleShortages.length){
    add(
      facts.squadCount < 15 ? 96 : 86,
      'squad-depth',
      'plantel',
      'critical',
      'Completá la estructura del plantel',
      `Buscá primero los puestos que sostienen una temporada larga. Priorizá una incorporación funcional y accesible antes de gastar en una figura.`,
      `${facts.squadCount} jugadores disponibles${roleShortages.length ? ` · faltan referencias para ${roleShortages.join(', ')}` : ''}.`,
      'market',
      'Buscar en el mercado'
    );
  }

  if(facts.tacticProblems > 0 || facts.tacticFit < 75){
    add(
      facts.tacticFit < 55 ? 95 : 83,
      'tactic-fit',
      'tactica',
      'critical',
      'Corregí la alineación antes del próximo partido',
      'Reubicá titulares en roles compatibles y verificá lesionados, suspendidos y casilleros vacíos. Un esquema ambicioso no compensa jugadores fuera de función.',
      `Ajuste táctico medio ${facts.tacticFit}%${facts.tacticProblems ? ` · ${facts.tacticProblems} problema(s) detectado(s)` : ''}.`,
      'tactics',
      'Revisar la táctica'
    );
  }

  if(facts.injuries >= 3){
    const hasKinesio = typeof staffActive === 'function' && staffActive('kinesiologist');
    add(
      facts.injuries >= 5 ? 94 : 84,
      'injuries',
      'salud',
      'critical',
      hasKinesio ? 'Ordená las recuperaciones y las cargas' : 'Protegé al plantel con recuperación profesional',
      hasKinesio
        ? 'Asigná el trabajo diferenciado al jugador más importante y revisá el entrenamiento para no agrandar la enfermería.'
        : 'Contratá un kinesiólogo si el presupuesto lo permite; mientras tanto, reducí cargas y evitá forzar a quienes no están recuperados.',
      `${facts.injuries} jugador(es) lesionado(s) · forma media ${facts.fitness}/99.`,
      hasKinesio ? 'training' : 'employees',
      hasKinesio ? 'Ajustar entrenamiento' : 'Ver empleados'
    );
  }else if(facts.fitness < 68){
    add(
      facts.fitness < 55 ? 90 : 78,
      'fitness',
      'entrenamiento',
      'warning',
      'Bajá la carga y recuperá piernas',
      'Reducí la exigencia física de la semana y rotá futbolistas cansados. El objetivo inmediato es recuperar disponibilidad sin perder a otro titular.',
      `Forma física media ${facts.fitness}/99.`,
      'training',
      'Revisar entrenamiento'
    );
  }

  if(facts.morale < 48){
    const hasPsychologist = typeof staffActive === 'function' && staffActive('psychologist');
    add(
      facts.morale < 35 ? 90 : 76,
      'morale',
      'vestuario',
      'warning',
      'Intervení en el ánimo del plantel',
      hasPsychologist
        ? 'Usá la charla motivacional cuando esté disponible y acompañala con decisiones coherentes de titularidad.'
        : 'Evaluá contratar un psicólogo y evitá cambios masivos de jerarquías mientras el vestuario esté sensible.',
      `Moral media ${facts.morale}/99.`,
      'employees',
      'Gestionar empleados'
    );
  }

  if(facts.expiringContracts > 0){
    add(
      facts.expiringContracts >= 4 ? 95 : 86,
      'expiring-contracts',
      'contratos',
      'critical',
      'Resolvé los contratos que vencen esta temporada',
      'Ordená los casos por confianza y prioridad deportiva. Negociá primero con quienes todavía están predispuestos y prepará reemplazos para quienes no acepten extender su vínculo.',
      `${facts.expiringContracts} contrato(s) vencen al cierre · ${facts.difficultRenewals} renovación(es) difíciles en el plantel.`,
      'contracts',
      'Abrir Contratos'
    );
  }else if(facts.nextSeasonContracts >= 4 && facts.difficultRenewals > 0){
    add(
      78,
      'contract-planning',
      'contratos',
      'warning',
      'Evitá acumular renovaciones bajo presión',
      'Aprovechá la temporada para recuperar confianza y escalonar vencimientos. No esperes al último tramo si varios jugadores importantes terminan contrato juntos.',
      `${facts.nextSeasonContracts} contrato(s) vencen la próxima temporada · ${facts.difficultRenewals} caso(s) con baja predisposición.`,
      'contracts',
      'Planificar renovaciones'
    );
  }

  if(facts.generalTrust < 45 || facts.referentTrust < 42 || facts.substituteTrust < 35){
    const criticalTrust = Math.min(facts.generalTrust, facts.referentTrust, facts.substituteTrust);
    add(
      criticalTrust < 30 ? 92 : 80,
      'dressing-room-trust',
      'vestuario',
      'warning',
      'Ordená las jerarquías del vestuario',
      'Revisá referentes, titulares, rotación y suplentes antes de prometer minutos o cambiar jerarquías. La confianza baja endurece renovaciones y aumenta el riesgo de conflictos.',
      `Confianza general ${facts.generalTrust}/100 · referentes ${facts.referentTrust} · suplentes ${facts.substituteTrust}.`,
      'dressingRoom',
      'Abrir Vestuario'
    );
  }

  if(facts.nextMatchRequiresWinner && facts.nextOpponentId){
    add(
      79,
      'knockout-match',
      'competicion',
      'warning',
      'Prepará el partido para una definición completa',
      'Es una eliminatoria que necesita ganador. Conservá ejecutantes fiables y un portero en buen estado para una posible tanda, sin confundir los penales con goles oficiales.',
      `${facts.nextCompetition || 'Partido de copa'} · sede ${facts.nextMatchNeutral ? 'neutral' : 'definida por la competición'} · rival ${facts.nextOpponentName}.`,
      'tactics',
      'Preparar la eliminatoria'
    );
  }

  if(facts.budget < 10000000){
    add(
      facts.budget < 3000000 ? 92 : 77,
      'budget',
      'finanzas',
      'warning',
      'Protegé la caja del club',
      'Postergá obras y fichajes secundarios. Revisá gastos próximos, sponsors y ventas posibles antes de asumir otra obligación anual.',
      `Presupuesto disponible ${formatMoney(facts.budget)}.`,
      'finance',
      'Abrir finanzas'
    );
  }else if(facts.qualityGap <= -4){
    add(
      Math.min(91, 76 + Math.abs(facts.qualityGap)),
      'quality-gap',
      'mercado',
      'warning',
      'Subí la calidad en un puesto decisivo',
      'Tu plantel está por debajo de la referencia de la división. Elegí el rol con menor profundidad y fijá un precio máximo que preserve caja para salarios y emergencias.',
      `Media ${facts.teamOverall} contra ${facts.divisionAverage} de la división (${facts.qualityGap}).`,
      'market',
      'Planificar un fichaje'
    );
  }

  if(facts.nextOpponentId && facts.nextOpponentOverall >= facts.teamOverall + 4){
    add(
      82,
      'next-rival',
      'rival',
      'warning',
      'Prepará una variante para el próximo rival',
      'Conservá tu identidad, pero agregá una salida alternativa y una respuesta para cuando el rival domine. Definí el cambio antes de comenzar el partido.',
      `${facts.nextOpponentName} tiene media ${facts.nextOpponentOverall}; tu equipo, ${facts.teamOverall}.`,
      'tactics',
      'Preparar el partido'
    );
  }

  if(facts.savedPlans < 2 && Number(facts.philosophyScores?.flexibility ?? 50) <= 45){
    add(
      84,
      'plan-b',
      'planificacion',
      'warning',
      'Tu idea necesita un Plan B guardado',
      'El rival se adapta. Guardá una variante que cambie una capa concreta —formación, presión o ritmo— y entrenala antes de necesitarla.',
      `${facts.savedPlans} táctica(s) guardada(s) · perfil de flexibilidad ${Math.round(Number(facts.philosophyScores?.flexibility ?? 50))}%.`,
      'tactics',
      'Guardar dos planes'
    );
  }

  if(facts.fieldScore < 50){
    add(
      facts.fieldScore < 25 ? 91 : 74,
      'field',
      'estadio',
      'warning',
      'Recuperá el campo antes de que condicione al equipo',
      'Compará parcheo y replantado según el calendario. Un campo deteriorado agrega riesgo deportivo y puede terminar en sanciones.',
      `Estado del campo ${facts.fieldScore}/100.`,
      'stadium',
      'Ver mantenimiento'
    );
  }

  if(facts.academyCount >= facts.academyCapacity && facts.academyCapacity > 0){
    add(
      82,
      'academy-capacity',
      'academia',
      'warning',
      'Liberá cupos antes de la próxima captación',
      'Promové, vendé o descartá con criterio; si tu economía personal lo permite, ampliá el Predio o las residencias antes de buscar otra camada.',
      `Academia completa: ${facts.academyCount}/${facts.academyCapacity}.`,
      'academy',
      'Gestionar Academia'
    );
  }else if(facts.academyAge17 > 0){
    add(
      75,
      'academy-age',
      'academia',
      'opportunity',
      'Definí el futuro de los juveniles de 17 años',
      'Revisá su informe y elegí entre promoción o venta antes del cierre de su etapa formativa. Evitá ocupar cupos con decisiones postergadas.',
      `${facts.academyAge17} juvenil(es) de 17 años.`,
      'academy',
      'Revisar juveniles'
    );
  }

  if(facts.academyCount > 0 && !facts.youthPreparer){
    add(
      72,
      'academy-staff',
      'academia',
      'opportunity',
      'Convertí juveniles en decisiones informadas',
      'Reservá saldo personal para un preparador de juveniles y usá sus consultas antes de promover, vender o concentrar entrenamiento.',
      `${facts.academyCount} juvenil(es) · saldo personal ${formatMoney(facts.personalBalance)}.`,
      'academy',
      'Administrar Academia'
    );
  }

  if(Number(facts.philosophyScores?.project ?? 50) >= 60 && facts.academyCount > 0 && facts.youthExpertBonus <= 0){
    add(
      68,
      'youth-card',
      'cartas',
      'opportunity',
      'Sincronizá la consulta con Experto en juveniles',
      'Activá la carta antes de consultar informes: revelar habilidades adicionales acelera la selección de talentos y evita gastar recursos en proyectos equivocados.',
      `Perfil formador ${Math.round(Number(facts.philosophyScores.project))}% · carta sin bonificación activa.`,
      'special',
      'Revisar cartas'
    );
  }

  if(Number(facts.philosophyScores?.attack ?? 50) >= 62 && facts.fitness < 78){
    add(
      73,
      'attack-balance',
      'identidad',
      'opportunity',
      'Atacá con una reserva física y defensiva',
      'Mantené tu intención ofensiva, pero protegé la pérdida con un mediocampista y rotación. Un equipo agotado deja de presionar junto y concede transiciones.',
      `Perfil ofensivo ${Math.round(Number(facts.philosophyScores.attack))}% · forma media ${facts.fitness}/99.`,
      'tactics',
      'Equilibrar la táctica'
    );
  }

  add(
    62,
    'tactic-routine',
    'tactica',
    'opportunity',
    'Convertí la formación en automatismos',
    'Revisá que cada titular tenga un rol compatible y guardá una variante sencilla. La continuidad funciona mejor cuando el cambio de plan ya fue preparado.',
    `Formación ${facts.formation} · ajuste táctico ${facts.tacticFit}% · ${facts.savedPlans} plan(es) guardado(s).`,
    'tactics',
    'Ordenar planes'
  );
  add(
    60,
    'academy-routine',
    'academia',
    'opportunity',
    'Mantené una ruta clara para cada juvenil',
    'Asigná entrenamiento por función y decidí de antemano qué media o habilidad justificaría promover, vender o liberar a cada proyecto.',
    `Academia ${facts.academyCount}/${facts.academyCapacity || 0} · saldo personal ${formatMoney(facts.personalBalance)}.`,
    'academy',
    'Planificar Academia'
  );
  add(
    58,
    'finance-routine',
    'finanzas',
    'opportunity',
    'Separá inversión de reserva',
    'Antes de gastar, conservá una reserva para emergencias del plantel y obligaciones próximas. El excedente puede dirigirse al puesto o instalación con mayor impacto.',
    `Caja del club ${formatMoney(facts.budget)}.`,
    'finance',
    'Revisar finanzas'
  );

  candidates.sort((a,b) => b.score - a.score || String(a.id).localeCompare(String(b.id)));
  const selected = [];
  const areas = new Set();
  candidates.forEach(item => {
    if(selected.length >= 3 || areas.has(item.area)) return;
    selected.push(item);
    areas.add(item.area);
  });
  candidates.forEach(item => {
    if(selected.length >= 3 || selected.some(current => current.id === item.id)) return;
    selected.push(item);
  });
  return selected.slice(0, 3);
}

function createAssistantCoachSituationAnalysis(){
  const progress = assistantCoachProgress();
  const facts = assistantCoachSituationSnapshot();
  const recommendations = assistantCoachRecommendations(facts);
  const sequence = assistantCoachAnalysisState().analysesCompleted + 1;
  const date = assistantCoachCurrentDate();
  return {
    id:`assistant-analysis-${game.seasonNumber || 1}-${date || game.globalTurn || 0}-${sequence}`,
    date,
    season:Number(game.seasonNumber || 1),
    clubId:facts.clubId,
    clubName:facts.clubName,
    category:progress.category,
    categoryLabel:progress.categoryLabel,
    cycleDays:progress.totalDays,
    summary:recommendations[0]
      ? `${recommendations[0].title}. ${recommendations[0].evidence}`
      : 'El plantel no presenta una urgencia dominante; conviene sostener el plan y revisar el próximo rival.',
    snapshot:{
      teamOverall:facts.teamOverall,
      divisionAverage:facts.divisionAverage,
      qualityGap:facts.qualityGap,
      squadCount:facts.squadCount,
      fitness:facts.fitness,
      morale:facts.morale,
      injuries:facts.injuries,
      budget:facts.budget,
      personalBalance:facts.personalBalance,
      academyCount:facts.academyCount,
      academyCapacity:facts.academyCapacity,
      fieldScore:facts.fieldScore,
      stadiumCapacity:facts.stadiumCapacity,
      formation:facts.formation,
      tacticFit:facts.tacticFit,
      savedPlans:facts.savedPlans,
      generalTrust:facts.generalTrust,
      referentTrust:facts.referentTrust,
      starterTrust:facts.starterTrust,
      substituteTrust:facts.substituteTrust,
      youthTrust:facts.youthTrust,
      expiringContracts:facts.expiringContracts,
      nextSeasonContracts:facts.nextSeasonContracts,
      difficultRenewals:facts.difficultRenewals,
      nextOpponentName:facts.nextOpponentName,
      nextOpponentOverall:facts.nextOpponentOverall,
      nextCompetition:facts.nextCompetition,
      nextMatchRequiresWinner:facts.nextMatchRequiresWinner,
      nextMatchNeutral:facts.nextMatchNeutral
    },
    recommendations
  };
}

function runAssistantCoachSituationAnalysis(){
  if(!game || !staffActive(ASSISTANT_COACH_STAFF_ID)){
    showNotice('Primero tenés que contratar al Segundo entrenador.');
    return false;
  }
  refreshAssistantCoachAnalysisAvailability({ notify:false, save:false });
  const progress = assistantCoachProgress();
  if(!progress.ready){
    showNotice(`El próximo análisis estará disponible en ${formatDays(progress.daysLeft)}.`);
    return false;
  }
  const record = normalizeAssistantCoachAnalysisRecord(createAssistantCoachSituationAnalysis());
  if(!record) return false;
  const state = assistantCoachAnalysisState();
  state.analysesCompleted += 1;
  state.lastAnalysisDate = record.date;
  state.lastAnalysis = record;
  state.history = [...state.history, record].slice(-ASSISTANT_COACH_HISTORY_LIMIT);
  state.cycleStartDate = assistantCoachCurrentDate();
  state.ready = false;
  state.readyNotified = false;
  state.pausedReason = '';
  game.assistantCoachAnalysis = state;
  if(typeof saveLocal === 'function') saveLocal(true);
  if(typeof renderEmployees === 'function') renderEmployees();
  openAssistantCoachAnalysisModal(record);
  return true;
}

function assistantCoachSnapshotMarkup(snapshot={}){
  const metrics = [
    ['Calidad del equipo', `${snapshot.teamOverall || 0}`, `División ${snapshot.divisionAverage || 0}`],
    ['Plantel', `${snapshot.squadCount || 0}`, `${snapshot.injuries || 0} lesionado(s)`],
    ['Forma / moral', `${snapshot.fitness || 0} / ${snapshot.morale || 0}`, 'sobre 99'],
    ['Caja del club', formatMoney(snapshot.budget || 0), `Personal ${formatMoney(snapshot.personalBalance || 0)}`],
    ['Academia', `${snapshot.academyCount || 0}/${snapshot.academyCapacity || 0}`, 'ocupación'],
    ['Campo / estadio', `${snapshot.fieldScore || 0}/100`, `${Number(snapshot.stadiumCapacity || 0).toLocaleString('es-AR')} lugares`],
    ['Táctica', escapeHtml(snapshot.formation || '—'), `${snapshot.tacticFit || 0}% de ajuste`],
    ['Vestuario', `${snapshot.generalTrust ?? 50}/100`, `Referentes ${snapshot.referentTrust ?? 50} · suplentes ${snapshot.substituteTrust ?? 50}`],
    ['Contratos', `${snapshot.expiringContracts || 0} vencen`, `${snapshot.nextSeasonContracts || 0} próximos · ${snapshot.difficultRenewals || 0} difíciles`],
    ['Próximo rival', escapeHtml(snapshot.nextOpponentName || 'Sin rival'), snapshot.nextOpponentName ? `${snapshot.nextCompetition || 'Partido oficial'} · media ${snapshot.nextOpponentOverall || 0}${snapshot.nextMatchRequiresWinner ? ' · necesita ganador' : ''}` : 'Calendario sin partido']
  ];
  return `<div class="assistant-analysis-metrics">${metrics.map(([label,value,detail]) => `<div class="assistant-analysis-metric"><span>${escapeHtml(label)}</span><strong>${value}</strong><small>${escapeHtml(detail)}</small></div>`).join('')}</div>`;
}

function assistantCoachRecommendationsMarkup(recommendations=[]){
  return `<div class="assistant-recommendations">${recommendations.map((item,index) => `<article class="assistant-recommendation is-${escapeHtml(item.tone || 'opportunity')}">
    <div class="assistant-recommendation-rank">${index + 1}</div>
    <div>
      <div class="assistant-recommendation-head"><span class="pill">${escapeHtml(item.priority)}</span><span class="assistant-area">${escapeHtml(item.area)}</span></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.body)}</p>
      <div class="assistant-evidence"><strong>Por qué:</strong> ${escapeHtml(item.evidence)}</div>
      <button type="button" class="ghost" data-assistant-analysis-target="${escapeHtml(item.action)}">${escapeHtml(item.actionLabel)}</button>
    </div>
  </article>`).join('')}</div>`;
}

function openAssistantCoachAnalysisModal(record=null){
  const analysis = normalizeAssistantCoachAnalysisRecord(record || assistantCoachAnalysisState().lastAnalysis);
  if(!analysis){ showNotice('Todavía no hay análisis archivados.'); return false; }
  openModal(`<div class="assistant-analysis-modal">
    <p class="eyebrow">Segundo entrenador · ${escapeHtml(analysis.categoryLabel || staffCategoryFor(ASSISTANT_COACH_STAFF_ID, analysis.category).nombre)}</p>
    <div class="row assistant-analysis-title"><div><h2>Informe de situación</h2><p class="muted">${escapeHtml(analysis.clubName || clubName(analysis.clubId))} · ${escapeHtml(analysis.date || 'Fecha no disponible')} · Temporada ${analysis.season}</p></div><span class="pill ok">3 prioridades</span></div>
    <div class="card assistant-analysis-summary"><p class="label">Conclusión principal</p><strong>${escapeHtml(analysis.summary)}</strong></div>
    ${assistantCoachSnapshotMarkup(analysis.snapshot)}
    <div class="assistant-analysis-section-title"><p class="label">Plan de acción</p><h3>Qué haría ahora</h3></div>
    ${assistantCoachRecommendationsMarkup(analysis.recommendations)}
    <div class="modal-actions"><button type="button" class="primary" data-close-assistant-analysis>Cerrar informe</button></div>
  </div>`);
  document.querySelector('[data-close-assistant-analysis]')?.addEventListener('click', closeModal);
  document.querySelectorAll('[data-assistant-analysis-target]').forEach(button => {
    button.addEventListener('click', () => assistantCoachNavigate(button.dataset.assistantAnalysisTarget));
  });
  return true;
}

function assistantCoachNavigate(target){
  const key = String(target || 'home');
  closeModal();
  if(['tactics','training','contracts','dressingRoom','groups'].includes(key)){
    activeTab = 'firstTeam';
    firstTeamTab = key;
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('firstTeam');
  }else if(key === 'national-cups'){
    activeTab = 'standings';
    selectedCompetitionView = 'national-cups';
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('standings', 'national-cups');
  }else if(key === 'finance'){
    activeTab = 'finance';
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('finance');
  }else if(['academy','employees','market','stadium','special'].includes(key)){
    activeTab = key;
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation(key);
  }else{
    activeTab = 'home';
  }
  renderAll();
}

function assistantCoachTierPreviewMarkup(categoryId){
  const category = staffCategoryFor(ASSISTANT_COACH_STAFF_ID, categoryId);
  return `<article class="assistant-tier-preview">
    <div class="assistant-tier-photo staff-photo-wrap">${staffImageMarkup(ASSISTANT_COACH_STAFF_ID, category.id, 'staff-employee-photo')}</div>
    <div><strong>${escapeHtml(category.nombre)}</strong><span>${formatMoney(staffHireCost(ASSISTANT_COACH_STAFF_ID, category.id))} por temporada</span><small>Informe cada ${assistantCoachCycleDays(category.id)} días</small></div>
  </article>`;
}

function assistantCoachEmployeePanelMarkup(){
  if(!game) return '';
  refreshAssistantCoachAnalysisAvailability({ notify:true, save:true });
  const state = assistantCoachAnalysisState();
  const progress = assistantCoachProgress();
  const last = state.lastAnalysis;
  if(!progress.active){
    return `<section class="card assistant-coach-panel assistant-coach-inactive">
      <div class="row assistant-coach-header"><div><p class="label">Nuevo empleado</p><h2>Segundo entrenador</h2></div><span class="pill">Contrato anual</span></div>
      <p class="muted">Estudia calidad, profundidad, vestuario, contratos, caja, Academia, estadio, táctica, calendario y próximo rival. Cada informe entrega tres prioridades explicadas y accesos directos; no modifica la partida automáticamente.</p>
      <div class="assistant-tier-list">${['regular','bueno','elite'].map(assistantCoachTierPreviewMarkup).join('')}</div>
      <div class="assistant-coach-actions"><button type="button" id="btnHireAssistantCoach" class="primary">Contratar Segundo entrenador</button>${last ? '<button type="button" id="btnOpenLastAssistantAnalysis" class="ghost">Ver último informe archivado</button>' : ''}</div>
      <p class="small muted">El sueldo completo se paga al contratar. Si lo despedís, el pago anual no se reintegra y el progreso actual se pierde; los informes anteriores se conservan.</p>
    </section>`;
  }
  const statusText = progress.ready
    ? 'Análisis disponible ahora'
    : `${progress.elapsedDays} de ${progress.totalDays} días · faltan ${formatDays(progress.daysLeft)}`;
  const lastMarkup = last ? `<div class="assistant-last-analysis">
    <div><p class="label">Último informe · ${escapeHtml(last.date || '—')}</p><strong>${escapeHtml(last.recommendations?.[0]?.title || last.summary || 'Informe archivado')}</strong></div>
    <button type="button" id="btnOpenLastAssistantAnalysis" class="ghost">Ver informe</button>
  </div>` : '<p class="muted small">Todavía no hay informes archivados.</p>';
  return `<section class="card assistant-coach-panel is-active">
    <div class="assistant-coach-active-grid">
      <div class="assistant-current-photo staff-photo-wrap">${staffImageMarkup(ASSISTANT_COACH_STAFF_ID, progress.category, 'staff-employee-photo')}</div>
      <div>
        <div class="row assistant-coach-header"><div><p class="label">Análisis situacional · ${escapeHtml(progress.categoryLabel)}</p><h2>Segundo entrenador</h2></div><span class="pill ${progress.ready ? 'ok' : ''}">${progress.ready ? 'Listo' : `${progress.percent}%`}</span></div>
        <p class="muted">El nivel ${escapeHtml(progress.categoryLabel)} entrega un nuevo análisis cada ${progress.totalDays} días de juego.</p>
        <div class="assistant-progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress.percent}" aria-label="Progreso del próximo análisis"><span style="width:${progress.percent}%"></span></div>
        <div class="row assistant-progress-copy"><strong>${escapeHtml(statusText)}</strong><span>${state.analysesCompleted} informe(s) completado(s)</span></div>
        <div class="assistant-coach-actions"><button type="button" id="btnRunAssistantAnalysis" class="primary" ${progress.ready ? '' : 'disabled'}>${progress.ready ? 'Realizar nuevo análisis' : `Disponible en ${formatDays(progress.daysLeft)}`}</button></div>
      </div>
    </div>
    ${lastMarkup}
  </section>`;
}

function bindAssistantCoachEmployeePanel(){
  document.querySelector('#btnHireAssistantCoach')?.addEventListener('click', () => openStaffHireModal(ASSISTANT_COACH_STAFF_ID, renderEmployees));
  document.querySelector('#btnRunAssistantAnalysis')?.addEventListener('click', runAssistantCoachSituationAnalysis);
  document.querySelector('#btnOpenLastAssistantAnalysis')?.addEventListener('click', () => openAssistantCoachAnalysisModal());
}

