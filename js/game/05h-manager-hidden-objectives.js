/* V8.79 · Objetivos secundarios, continuidad contractual y legado por club con títulos ponderados. */

function managerHiddenObjectiveConfig(){
  const raw = window.GAME_BALANCE_MANAGER?.contratosManager?.objetivosSecundariosOcultos;
  const cfg = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    active:cfg.activo !== false,
    warningDay:Math.max(1, Math.round(Number(cfg.diaAviso || 200))),
    evaluationDay:Math.max(1, Math.round(Number(cfg.diaEvaluacion || 250))),
    baseDismissalChance:clamp(Number(cfg.probabilidadDespidoBase ?? 100), 0, 100),
    maxDismissalReduction:clamp(Number(cfg.reduccionDespidoMaxima ?? 70), 0, 95),
    idolDismissalReduction:clamp(Number(cfg.reduccionIdoloClub ?? 10), 0, 95),
    idolThreshold:Math.max(1, Math.round(Number(cfg.puntosIdoloClub || 51))),
    pointsMainObjective:Math.max(0, Math.round(Number(cfg.puntosObjetivoPrincipal ?? 3))),
    pointsSecondaryObjective:Math.max(0, Math.round(Number(cfg.puntosObjetivoSecundario ?? 1))),
    pointsPerTitle:Math.max(0, Math.round(Number(cfg.puntosTitulo ?? 5))),
    pointsPerStar:Math.max(1, Math.round(Number(cfg.puntosPorEstrella ?? 6))),
    economicMultiplier:Math.max(1, Number(cfg.economico?.multiplicadorPatrimonio ?? 2)),
    economicDismissalReduction:clamp(Number(cfg.economico?.reduccionDespido ?? 20), 0, 100),
    fansIncrease:Math.max(1, Math.round(Number(cfg.hinchas?.aumentoObjetivo ?? 1000))),
    fansDismissalReduction:clamp(Number(cfg.hinchas?.reduccionDespido ?? 20), 0, 100),
    stadiumIncrease:Math.max(1, Math.round(Number(cfg.estadio?.aumentoMinimo ?? 1))),
    stadiumDismissalReduction:clamp(Number(cfg.estadio?.reduccionDespido ?? 10), 0, 100),
    clauseConvictions:Math.max(1, Math.round(Number(cfg.clausulas?.jugadoresConvencidos ?? 1))),
    clauseDismissalReduction:clamp(Number(cfg.clausulas?.reduccionDespido ?? 5), 0, 100)
  };
}

function managerOfficialTitleLegacyPoints(title, cfg=managerHiddenObjectiveConfig()){
  const base = Math.max(0, Math.round(Number(cfg?.pointsPerTitle || 0)));
  return String(title?.type || '') === 'national_supercup' ? Math.max(1, Math.round(base * 0.4)) : base;
}

function managerHiddenObjectiveSeasonKey(season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  return `${Math.max(1, Math.round(Number(season || 1)))}:${Math.max(0, Math.round(Number(clubId || 0)))}`;
}
function managerHiddenObjectiveCurrentBudget(state=game, clubId=state?.selectedClubId || 0){
  if(Number(clubId || 0) === Number(state?.selectedClubId || 0)) return Math.round(Number(state?.budget || 0));
  return Math.round(Number(state?.clubBudgets?.[clubId] ?? seed?.clubs?.find(item => Number(item.id) === Number(clubId))?.budget ?? 0));
}
function managerHiddenObjectiveSeasonStartBudget(state=game, season=state?.seasonNumber || 1, clubId=state?.selectedClubId || 0){
  const stored = Number(state?.seasonBudgetStartBySeason?.[season]);
  if(Number.isFinite(stored)) return Math.round(stored);
  if(Number(season || 0) === Number(state?.seasonNumber || 0) && Number(clubId || 0) === Number(state?.selectedClubId || 0) && Number.isFinite(Number(state?.seasonInitialBudget))){
    return Math.round(Number(state.seasonInitialBudget));
  }
  return managerHiddenObjectiveCurrentBudget(state, clubId);
}
function managerHiddenObjectiveCurrentFans(state=game, clubId=state?.selectedClubId || 0){
  const row = state?.fans?.clubs?.[clubId];
  const fallback = seed?.clubs?.find(item => Number(item.id) === Number(clubId))?.fansBase || 0;
  return Math.max(0, Math.round(Number(row?.current ?? fallback ?? 0)));
}
function managerHiddenObjectiveReconstructedStartFans(state=game, season=state?.seasonNumber || 1, clubId=state?.selectedClubId || 0){
  const current = managerHiddenObjectiveCurrentFans(state, clubId);
  const matchDelta = (Array.isArray(state?.fans?.history) ? state.fans.history : [])
    .filter(item => Number(item?.season || 0) === Number(season) && Number(item?.clubId || 0) === Number(clubId))
    .reduce((sum,item)=>sum + Math.round(Number(item?.delta || 0)), 0);
  const campaignDelta = (Array.isArray(state?.fans?.memberCampaignHistory) ? state.fans.memberCampaignHistory : [])
    .filter(item => Number(item?.season || 0) === Number(season) && Number(item?.clubId || 0) === Number(clubId))
    .reduce((sum,item)=>sum + Math.max(0, Math.round(Number(item?.delta || 0))), 0);
  return Math.max(0, current - matchDelta - campaignDelta);
}
function managerHiddenObjectiveCurrentCapacity(state=game, clubId=state?.selectedClubId || 0){
  const override = Number(state?.stadium?.capacityOverrides?.[clubId]);
  if(Number.isFinite(override)) return Math.max(0, Math.round(override));
  const club = seed?.clubs?.find(item => Number(item.id) === Number(clubId));
  return Math.max(0, Math.round(Number(club?.stadiumCapacity || 0)));
}
function managerHiddenObjectiveExistingClauseConvictions(state=game, season=state?.seasonNumber || 1, clubId=state?.selectedClubId || 0){
  const year = typeof seasonYearForNumber === 'function' ? Number(seasonYearForNumber(season)) : Number(state?.seasonYear || 0);
  return (Array.isArray(state?.messages) ? state.messages : []).filter(message => {
    const action = message?.action || {};
    if(String(action.origin || '') !== 'special_clause' || String(action.status || '') !== 'convinced') return false;
    if(Number(action.ownerClubId || 0) !== Number(clubId || 0)) return false;
    if(validIsoDate(action.createdDate) && year){
      return Number(String(action.createdDate).slice(0,4)) === year;
    }
    return Number(season || 0) === Number(state?.seasonNumber || 0);
  }).length;
}
function normalizeManagerHiddenObjectiveRecord(raw={}, state=game){
  const season = Math.max(1, Math.round(Number(raw.season || state?.seasonNumber || 1)));
  const clubId = Math.max(0, Math.round(Number(raw.clubId || state?.selectedClubId || 0)));
  const startBudget = Number.isFinite(Number(raw.startBudget)) ? Math.round(Number(raw.startBudget)) : managerHiddenObjectiveSeasonStartBudget(state, season, clubId);
  const startFans = Number.isFinite(Number(raw.startFans)) ? Math.max(0, Math.round(Number(raw.startFans))) : managerHiddenObjectiveReconstructedStartFans(state, season, clubId);
  const startCapacity = Number.isFinite(Number(raw.startCapacity)) ? Math.max(0, Math.round(Number(raw.startCapacity))) : managerHiddenObjectiveCurrentCapacity(state, clubId);
  return {
    season,
    clubId,
    contractId:String(raw.contractId || ''),
    startBudget,
    startFans,
    startCapacity,
    clausePlayersConvinced:Math.max(0, Math.round(Number(raw.clausePlayersConvinced ?? managerHiddenObjectiveExistingClauseConvictions(state, season, clubId)))),
    warningSent:Boolean(raw.warningSent),
    warningDay:Math.max(0, Math.round(Number(raw.warningDay || 0))),
    evaluationCompleted:Boolean(raw.evaluationCompleted),
    evaluationDay:Math.max(0, Math.round(Number(raw.evaluationDay || 0))),
    dismissalChance:raw.dismissalChance !== null && raw.dismissalChance !== '' && Number.isFinite(Number(raw.dismissalChance)) ? clamp(Number(raw.dismissalChance), 0, 100) : null,
    dismissalReduction:raw.dismissalReduction !== null && raw.dismissalReduction !== '' && Number.isFinite(Number(raw.dismissalReduction)) ? clamp(Number(raw.dismissalReduction), 0, 100) : null,
    dismissalRoll:raw.dismissalRoll !== null && raw.dismissalRoll !== '' && Number.isFinite(Number(raw.dismissalRoll)) ? clamp(Number(raw.dismissalRoll), 0, 100) : null,
    dismissalResult:String(raw.dismissalResult || ''),
    finalized:Boolean(raw.finalized),
    finalizedContext:String(raw.finalizedContext || ''),
    createdDate:String(raw.createdDate || state?.currentDate || ''),
    updatedDate:String(raw.updatedDate || state?.currentDate || '')
  };
}
function normalizeManagerHiddenObjectivesState(raw={}, state=game){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const seasons = {};
  Object.entries(src.seasons && typeof src.seasons === 'object' && !Array.isArray(src.seasons) ? src.seasons : {}).forEach(([key,value]) => {
    const clean = normalizeManagerHiddenObjectiveRecord(value || {}, state);
    if(clean.clubId > 0) seasons[managerHiddenObjectiveSeasonKey(clean.season, clean.clubId)] = clean;
  });
  const orderedKeys = Object.keys(seasons).sort((a,b) => {
    const [as,ac] = a.split(':').map(Number);
    const [bs,bc] = b.split(':').map(Number);
    return (bs-as) || (bc-ac);
  }).slice(0,24);
  return { version:'V8.42', seasons:Object.fromEntries(orderedKeys.map(key => [key,seasons[key]])) };
}
function ensureManagerHiddenObjectiveState(state=game){
  if(!state) return { version:'V8.42', seasons:{} };
  const current = state.managerHiddenObjectives;
  if(current && current.version === 'V8.42' && current.seasons && typeof current.seasons === 'object' && !Array.isArray(current.seasons)) return current;
  state.managerHiddenObjectives = normalizeManagerHiddenObjectivesState(current || {}, state);
  return state.managerHiddenObjectives;
}
function ensureManagerHiddenObjectiveSeason(state=game, options={}){
  if(!state || state.gameOver?.active || state.challenge || state.founderMode || !Number(state.selectedClubId || 0)) return null;
  const cfg = managerHiddenObjectiveConfig();
  if(!cfg.active) return null;
  const season = Math.max(1, Math.round(Number(options.season || state.seasonNumber || 1)));
  const clubId = Math.max(0, Math.round(Number(options.clubId || state.selectedClubId || 0)));
  if(!clubId) return null;
  const root = ensureManagerHiddenObjectiveState(state);
  const key = managerHiddenObjectiveSeasonKey(season, clubId);
  if(!root.seasons[key]){
    root.seasons[key] = normalizeManagerHiddenObjectiveRecord({
      season,
      clubId,
      contractId:String(state.managerJobContract?.id || ''),
      startBudget:managerHiddenObjectiveSeasonStartBudget(state, season, clubId),
      startFans:managerHiddenObjectiveReconstructedStartFans(state, season, clubId),
      startCapacity:managerHiddenObjectiveCurrentCapacity(state, clubId),
      clausePlayersConvinced:managerHiddenObjectiveExistingClauseConvictions(state, season, clubId),
      createdDate:state.currentDate || ''
    }, state);
    state._needsAutosave = true;
  }
  return root.seasons[key];
}

function normalizeManagerClubLegacyAward(raw={}){
  return {
    key:String(raw.key || ''),
    season:Math.max(1, Math.round(Number(raw.season || 1))),
    type:String(raw.type || ''),
    label:String(raw.label || ''),
    points:Math.max(0, Math.round(Number(raw.points || 0))),
    context:String(raw.context || ''),
    date:String(raw.date || '')
  };
}
function normalizeManagerClubLegacyRecord(raw={}){
  const awards = (Array.isArray(raw.awards) ? raw.awards : []).map(normalizeManagerClubLegacyAward).filter(item => item.key && item.points > 0);
  const uniqueAwards = Array.from(new Map(awards.map(item => [item.key,item])).values());
  const points = uniqueAwards.reduce((sum,item)=>sum + Number(item.points || 0), 0);
  return {
    clubId:Math.max(0, Math.round(Number(raw.clubId || 0))),
    clubName:String(raw.clubName || ''),
    points,
    mainObjectives:uniqueAwards.filter(item => item.type === 'main_objective').length,
    secondaryObjectives:uniqueAwards.filter(item => item.type.startsWith('secondary_')).length,
    titles:uniqueAwards.filter(item => item.type === 'title').length,
    seasons:Array.from(new Set(uniqueAwards.map(item => Number(item.season || 0)).filter(Boolean))).sort((a,b)=>a-b),
    awards:uniqueAwards,
    idolNotified:Boolean(raw.idolNotified),
    updatedAt:String(raw.updatedAt || '')
  };
}
function normalizeManagerClubLegacy(records=[]){
  const source = Array.isArray(records) ? records : [];
  const byClub = new Map();
  source.forEach(raw => {
    const clean = normalizeManagerClubLegacyRecord(raw || {});
    if(!clean.clubId) return;
    const previous = byClub.get(clean.clubId);
    if(!previous){ byClub.set(clean.clubId, clean); return; }
    byClub.set(clean.clubId, normalizeManagerClubLegacyRecord({
      ...previous,
      clubName:clean.clubName || previous.clubName,
      idolNotified:Boolean(previous.idolNotified || clean.idolNotified),
      awards:[...(previous.awards || []), ...(clean.awards || [])],
      updatedAt:clean.updatedAt || previous.updatedAt
    }));
  });
  return Array.from(byClub.values()).sort((a,b)=>Number(b.points || 0)-Number(a.points || 0) || String(a.clubName || '').localeCompare(String(b.clubName || '')));
}
function migrateManagerClubLegacyFromHistoricalStats(stats={}, existingRecords=[]){
  const cfg = managerHiddenObjectiveConfig();
  const byClub = new Map(normalizeManagerClubLegacy(existingRecords).map(record => [Number(record.clubId), { ...record, awards:[...(record.awards || [])] }]));
  const addHistoricalAward = (clubId, clubNameValue, award) => {
    const id = Math.max(0, Math.round(Number(clubId || 0)));
    if(!id) return;
    let record = byClub.get(id);
    if(!record){
      record = normalizeManagerClubLegacyRecord({ clubId:id, clubName:String(clubNameValue || ''), awards:[] });
      byClub.set(id, record);
    }
    if(clubNameValue && !record.clubName) record.clubName = String(clubNameValue);
    const clean = normalizeManagerClubLegacyAward(award);
    if(clean.key && clean.points > 0 && !record.awards.some(item => item.key === clean.key)) record.awards.push(clean);
  };
  (Array.isArray(stats?.seasons) ? stats.seasons : []).forEach(item => {
    if(item?.objectiveAchieved !== true || !Number(item?.clubId || 0)) return;
    const season = Math.max(1, Math.round(Number(item.season || 1)));
    const clubId = Number(item.clubId);
    addHistoricalAward(clubId, item.clubName, {
      key:`${season}:${clubId}:main-objective`,
      season,
      type:'main_objective',
      label:'Objetivo principal cumplido',
      points:cfg.pointsMainObjective,
      context:'migration',
      date:String(item.date || item.endedDate || '')
    });
  });
  (Array.isArray(stats?.titleHistory) ? stats.titleHistory : []).forEach(title => {
    const season = Math.max(1, Math.round(Number(title?.season || 1)));
    const clubId = Number(title?.clubId || 0);
    if(!clubId) return;
    const titleToken = `${title.type || 'title'}:${title.competitionId || title.competitionName || 'competition'}`;
    addHistoricalAward(clubId, title.clubName, {
      key:`${season}:${clubId}:title:${titleToken}`,
      season,
      type:'title',
      label:`Título: ${title.competitionName || 'Competición'}`,
      points:managerOfficialTitleLegacyPoints(title, cfg),
      context:'migration',
      date:String(title.createdAt || '')
    });
  });
  return normalizeManagerClubLegacy(Array.from(byClub.values()).map(record => {
    const clean = normalizeManagerClubLegacyRecord(record);
    if(clean.points >= cfg.idolThreshold) clean.idolNotified = true;
    return clean;
  }));
}
function managerClubLegacyRecords(stats=game?.managerStats){
  return normalizeManagerClubLegacy(stats?.clubLegacy || []);
}
function managerClubLegacyForClub(clubId, stats=game?.managerStats){
  return managerClubLegacyRecords(stats).find(item => Number(item.clubId) === Number(clubId)) || null;
}
function managerClubLegacyStars(record){
  const cfg = managerHiddenObjectiveConfig();
  const points = Math.max(0, Math.round(Number(record?.points || 0)));
  if(points <= 0) return 0;
  if(points >= cfg.idolThreshold) return 10;
  return clamp(Math.ceil(points / cfg.pointsPerStar), 1, 9);
}
function managerIsClubIdol(clubId, stats=game?.managerStats){
  const record = managerClubLegacyForClub(clubId, stats);
  return Boolean(record && Number(record.points || 0) >= managerHiddenObjectiveConfig().idolThreshold);
}
function managerClubLegacyEnsureRecord(clubId=game?.selectedClubId){
  if(!game?.managerStats || !Number(clubId || 0)) return null;
  // La partida ya se normaliza al cargar. Evita reconstruir todo el historial
  // cada vez que se acredita un punto de legado.
  game.managerStats.clubLegacy = managerClubLegacyRecords(game.managerStats);
  let record = game.managerStats.clubLegacy.find(item => Number(item.clubId) === Number(clubId));
  if(!record){
    record = normalizeManagerClubLegacyRecord({ clubId:Number(clubId), clubName:clubName(clubId), awards:[] });
    game.managerStats.clubLegacy.push(record);
  }
  record.clubName = clubName(clubId) || record.clubName;
  return record;
}
function managerClubLegacyAddAward(clubId, award={}){
  const record = managerClubLegacyEnsureRecord(clubId);
  if(!record) return { added:false, record:null, points:0 };
  const clean = normalizeManagerClubLegacyAward(award);
  if(!clean.key || clean.points <= 0 || record.awards.some(item => item.key === clean.key)) return { added:false, record, points:0 };
  const wasIdol = Number(record.points || 0) >= managerHiddenObjectiveConfig().idolThreshold;
  record.awards.push(clean);
  const normalized = normalizeManagerClubLegacyRecord({ ...record, awards:record.awards, updatedAt:new Date().toISOString() });
  Object.assign(record, normalized);
  const isIdol = Number(record.points || 0) >= managerHiddenObjectiveConfig().idolThreshold;
  if(!wasIdol && isIdol && !record.idolNotified){
    record.idolNotified = true;
    pushGameMessage({
      type:'directiva',
      priority:'high',
      title:`Eres un ídolo de ${record.clubName || clubName(clubId)}`,
      body:`${record.clubName || clubName(clubId)} reconoció tu trayectoria y te incorporó entre sus ídolos. El vínculo queda registrado de forma permanente para futuras etapas de tu carrera.`,
      id:`club-idol-${clubId}-${game?.seasonNumber || 1}`
    });
  }
  game.managerStats.clubLegacy = normalizeManagerClubLegacy(game.managerStats.clubLegacy);
  return { added:true, record:managerClubLegacyForClub(clubId), points:clean.points };
}

function managerHiddenObjectiveEvaluation(record=ensureManagerHiddenObjectiveSeason()){
  const cfg = managerHiddenObjectiveConfig();
  if(!record) return { record:null, objectives:[], completed:[], failed:[], reduction:0 };
  const currentBudget = managerHiddenObjectiveCurrentBudget(game, record.clubId);
  const currentFans = managerHiddenObjectiveCurrentFans(game, record.clubId);
  const currentCapacity = managerHiddenObjectiveCurrentCapacity(game, record.clubId);
  const economicEligible = Number(record.startBudget || 0) > 0;
  const objectives = [
    {
      key:'economic',
      type:'secondary_economic',
      label:'Duplicar el patrimonio económico del club',
      completed:economicEligible && currentBudget >= Number(record.startBudget || 0) * cfg.economicMultiplier,
      eligible:economicEligible,
      reduction:cfg.economicDismissalReduction,
      start:Number(record.startBudget || 0),
      current:currentBudget,
      target:economicEligible ? Math.round(Number(record.startBudget || 0) * cfg.economicMultiplier) : null
    },
    {
      key:'fans',
      type:'secondary_fans',
      label:`Sumar ${cfg.fansIncrease.toLocaleString('es-AR')} hinchas`,
      completed:currentFans - Number(record.startFans || 0) >= cfg.fansIncrease,
      eligible:true,
      reduction:cfg.fansDismissalReduction,
      start:Number(record.startFans || 0),
      current:currentFans,
      target:Number(record.startFans || 0) + cfg.fansIncrease
    },
    {
      key:'stadium',
      type:'secondary_stadium',
      label:'Aumentar la capacidad del estadio',
      completed:currentCapacity - Number(record.startCapacity || 0) >= cfg.stadiumIncrease,
      eligible:true,
      reduction:cfg.stadiumDismissalReduction,
      start:Number(record.startCapacity || 0),
      current:currentCapacity,
      target:Number(record.startCapacity || 0) + cfg.stadiumIncrease
    },
    {
      key:'clauses',
      type:'secondary_clauses',
      label:'Convencer a un jugador de quedarse ante una cláusula pagada',
      completed:Number(record.clausePlayersConvinced || 0) >= cfg.clauseConvictions,
      eligible:true,
      reduction:cfg.clauseDismissalReduction,
      start:0,
      current:Number(record.clausePlayersConvinced || 0),
      target:cfg.clauseConvictions
    }
  ];
  const completed = objectives.filter(item => item.eligible && item.completed);
  const failed = objectives.filter(item => item.eligible && !item.completed);
  const secondaryReduction = completed.reduce((sum,item)=>sum + Number(item.reduction || 0), 0);
  const idolReduction = managerIsClubIdol(record.clubId) ? cfg.idolDismissalReduction : 0;
  const reduction = clamp(secondaryReduction + idolReduction, 0, cfg.maxDismissalReduction);
  return { record, objectives, completed, failed, secondaryReduction, idolReduction, reduction };
}
function managerHiddenObjectiveCaptainName(){
  const hierarchyCaptainId = Number(typeof managerDressingRoom?.hierarchy === 'function' ? managerDressingRoom.hierarchy()?.captainId || 0 : game?.tactic?.captainId || 0);
  const captain = typeof playerById === 'function' ? playerById(hierarchyCaptainId) : null;
  if(captain?.name) return captain.name;
  const players = typeof playersByClub === 'function' ? playersByClub(game?.selectedClubId) : [];
  const fallback = players.slice().sort((a,b)=>Number(b.age || 0)-Number(a.age || 0) || Number(b.overall || 0)-Number(a.overall || 0))[0];
  return fallback?.name || 'el capitán';
}
function managerHiddenObjectiveWarningMessages(info){
  const club = clubName(game?.selectedClubId) || 'el club';
  const ppg = Number(info?.ppg || 0).toFixed(2);
  const objective = Number(info?.objective || 0).toFixed(2);
  return [
    `La directiva de ${club} observa con preocupación el rendimiento deportivo. En el día 200 registrás ${ppg} PPG frente a un mínimo de ${objective}. Si el promedio no se recupera antes del día 250, tu continuidad será evaluada.`,
    `El objetivo mínimo de ${objective} PPG todavía no fue alcanzado: el equipo promedia ${ppg}. La comisión directiva revisará tu cargo en el día 250 si la tendencia no cambia.`,
    `Tu continuidad entró en zona de riesgo. ${club} exige ${objective} PPG y el promedio actual es ${ppg}. Disponés hasta el día 250 para alcanzar o superar el mínimo contractual.`,
    `La directiva reconoce que aún queda margen, pero los resultados están por debajo del contrato: ${ppg} de ${objective} PPG. El día 250 habrá una decisión si no conseguís revertirlo.`,
    `Se activó una advertencia formal de continuidad. El promedio actual de ${ppg} PPG no alcanza el objetivo de ${objective}. La próxima evaluación decisiva será en el día 250.`,
    `Los dirigentes solicitaron una reacción inmediata. ${club} se encuentra por debajo del objetivo contractual (${ppg}/${objective} PPG) y tu puesto será revisado en el día 250.`
  ];
}
function managerHiddenObjectiveRetentionMessages(evaluation){
  const club = clubName(game?.selectedClubId) || 'el club';
  const captain = managerHiddenObjectiveCaptainName();
  const pools = [];
  if(evaluation.completed.some(item => item.key === 'fans')) pools.push(
    `Los resultados deportivos preocupan, pero los hinchas te aprecian mucho y el crecimiento de la masa social demuestra que tu proyecto todavía conserva respaldo. La directiva decidió sostenerte.`,
    `La tribuna sigue identificada con tu trabajo. El aumento de hinchas fue determinante para que ${club} descarte el despido y te conceda continuidad.`,
    `La comisión valoró especialmente la conexión recuperada con la gente. Aunque el objetivo de puntos no se cumplió, el apoyo de los hinchas inclinó la decisión a tu favor.`,
    `El club recibió señales claras de respaldo popular. La directiva entiende que cortar el proceso ahora dañaría la relación construida con los hinchas.`,
    `La campaña no alcanzó el mínimo deportivo, pero el crecimiento de la hinchada confirmó que tu gestión generó pertenencia. Continuarás en el cargo.`,
    `Los dirigentes reconocieron que pocas veces la gente estuvo tan comprometida con el equipo. Ese apoyo evitó la rescisión de tu contrato.`
  );
  if(evaluation.completed.some(item => item.key === 'economic')) pools.push(
    `La economía de ${club} nunca estuvo mejor durante este ciclo. La mejora patrimonial compensó el mal rendimiento deportivo y la directiva mantendrá tu contrato.`,
    `Los números del club fueron decisivos: duplicaste el patrimonio y dejaste una estructura financiera más sólida. La comisión optó por darte otra oportunidad.`,
    `La directiva considera que tu administración económica protegió el futuro de ${club}. No habrá despido pese a que el promedio quedó por debajo del objetivo.`,
    `Tu gestión ordenó las cuentas y multiplicó los recursos disponibles. Ese aporte institucional pesó más que la crisis deportiva del momento.`,
    `Los dirigentes no ignoraron la transformación económica lograda. El club conserva tu proyecto porque hoy dispone de una base financiera mucho más fuerte.`,
    `El balance económico presentó una mejora excepcional. La comisión concluyó que despedirte ahora pondría en riesgo un proceso institucional valioso.`
  );
  if(evaluation.completed.some(item => item.key === 'clauses')) pools.push(
    `Los jugadores aseguran que todavía pueden dar vuelta la historia y confían en tus métodos, especialmente ${captain}. El respaldo del vestuario evitó tu despido.`,
    `${captain} transmitió a la directiva que el plantel mantiene una confianza total en tu conducción. La capacidad para retener futbolistas importantes fue clave para sostenerte.`,
    `El vestuario defendió tu continuidad. Los dirigentes valoraron que jugadores tentados por otros clubes eligieran quedarse por tu proyecto.`,
    `La comisión escuchó al plantel antes de decidir. La lealtad conseguida frente a ofertas por cláusula confirmó que todavía conservás autoridad interna.`,
    `Tus jugadores respaldaron el proceso y recordaron que lograron retenerse piezas decisivas gracias a tus conversaciones. Seguirás al frente del equipo.`,
    `La confianza del grupo, encabezado por ${captain}, resultó determinante. El club entiende que el vestuario todavía cree en una recuperación contigo.`
  );
  if(evaluation.completed.some(item => item.key === 'stadium')) pools.push(
    `La ampliación del estadio dejó una mejora concreta y permanente para ${club}. La directiva valoró ese crecimiento institucional y decidió sostener tu ciclo.`,
    `Aunque el objetivo deportivo quedó pendiente, tu gestión aumentó la capacidad del estadio y fortaleció el patrimonio del club. Continuarás en el cargo.`,
    `Los dirigentes consideraron que la obra del estadio representa un legado que excede una mala campaña. La decisión final fue mantenerte.`,
    `La infraestructura avanzó durante tu gestión. Ese aporte de largo plazo redujo la presión por los resultados y evitó la rescisión.`
  );
  if(evaluation.idolReduction > 0) pools.push(
    `Tu historia en ${club} tuvo un peso decisivo. La directiva entiende que un ídolo del club merece una oportunidad adicional para revertir la situación.`,
    `El vínculo construido durante varias temporadas evitó una decisión inmediata. Tu condición de ídolo de ${club} redujo el riesgo y conservarás el cargo.`
  );
  pools.push(
    `La directiva debatió tu salida, pero los aportes realizados fuera del resultado inmediato justificaron mantener el proceso hasta una nueva evaluación.`,
    `El despido no obtuvo el respaldo suficiente dentro de la comisión. Continuarás, aunque la exigencia deportiva seguirá siendo alta.`
  );
  return pools;
}
function managerHiddenObjectiveDismissalMessages(evaluation, info){
  const club = clubName(game?.selectedClubId) || 'el club';
  const failedItems = Array.isArray(evaluation?.failed) ? evaluation.failed : [];
  const failed = failedItems.map(item => item.label.toLowerCase()).join(', ');
  const ppg = Number(info?.ppg || 0).toFixed(2);
  const objective = Number(info?.objective || 0).toFixed(2);
  if(!failedItems.length){
    return [
      `La directiva reconoció todos tus aportes secundarios, pero el equipo quedó en ${ppg} PPG frente al mínimo de ${objective}. El incumplimiento deportivo terminó siendo decisivo.`,
      `La economía, los hinchas, la infraestructura y el vestuario respaldaron tu gestión. Aun así, ${club} resolvió rescindir el contrato por no alcanzar el objetivo principal.`,
      `La evaluación del día 250 valoró tus mejoras institucionales, pero el promedio de ${ppg} PPG no llegó a ${objective}. La comisión decidió cambiar de conducción.`,
      `Tus objetivos secundarios redujeron de forma importante el riesgo, aunque no lograron compensar la campaña deportiva. La directiva activó el despido.`,
      `El balance fuera de la cancha fue positivo, pero los dirigentes consideraron innegociable el mínimo de puntos establecido en el contrato. Tu ciclo terminó.`,
      `La advertencia del día 200 no produjo la recuperación deportiva exigida. Pese a los aportes institucionales, ${club} decidió finalizar tu contrato.`,
      `La comisión destacó tu gestión integral, pero concluyó que el rendimiento competitivo necesitaba un cambio inmediato. No continuarás en el cargo.`,
      `El proyecto dejó mejoras permanentes en el club. Sin embargo, el objetivo principal siguió incumplido al día 250 y la votación final determinó tu salida.`,
      `Los aportes secundarios fueron reconocidos y redujeron la posibilidad de despido, pero el sorteo de continuidad fue desfavorable. La directiva rescindió tu contrato.`,
      `La evaluación final separó la gestión institucional del resultado deportivo: la primera fue positiva, pero el promedio de puntos no alcanzó el mínimo y ${club} decidió despedirte.`
    ];
  }
  return [
    `La directiva decidió finalizar tu ciclo. El equipo quedó en ${ppg} PPG frente al mínimo de ${objective} y tampoco se observaron mejoras suficientes en ${failed}.`,
    `El objetivo deportivo no fue alcanzado y las áreas pendientes —${failed}— no aportaron respaldo suficiente para extender el proceso. ${club} rescindió tu contrato.`,
    `La evaluación del día 250 fue negativa: faltaron resultados y quedaron sin cumplir estos objetivos secundarios: ${failed}. La directiva activó el despido.`,
    `Los dirigentes concluyeron que la campaña no mejoró dentro del plazo otorgado. La falta de avances en ${failed} debilitó todavía más tu continuidad.`,
    `El promedio de ${ppg} PPG permaneció por debajo de ${objective}. Los progresos complementarios no alcanzaron y siguieron pendientes ${failed}.`,
    `La advertencia del día 200 no produjo la reacción esperada. La directiva también evaluó negativamente ${failed} y decidió despedirte.`,
    `El balance contractual fue insuficiente. No se cumplió el objetivo principal y no hubo mejoras suficientes en ${failed} para sostener tu continuidad en ${club}.`,
    `La comisión agotó el plazo de recuperación. Los resultados continuaron por debajo del mínimo y permanecieron pendientes ${failed}.`,
    `El proyecto perdió el respaldo de la directiva. Al incumplimiento deportivo se sumó la ausencia de mejoras relevantes en ${failed}.`,
    `La evaluación final determinó que ${club} necesita un cambio de conducción. El objetivo de puntos siguió incumplido y no se alcanzaron ${failed}.`
  ];
}
function managerHiddenObjectiveDeterministicRoll(record){
  const token = `manager-dismissal-v842-${game?.saveCode || ''}-${record?.season || game?.seasonNumber || 1}-${record?.clubId || game?.selectedClubId || 0}`;
  // 0,00–99,99: una probabilidad de 100% debe ser realmente segura.
  return Number(((hashNumber(token, 10000) / 10000) * 100).toFixed(2));
}
function managerHiddenObjectiveFinalizeDismissal(info, evaluation, chance, roll){
  const record = evaluation.record;
  const messages = managerHiddenObjectiveDismissalMessages(evaluation, info);
  const text = messages[hashNumber(`dismissal-message-${game?.saveCode || ''}-${record.season}-${record.clubId}`, messages.length)];
  managerFinalizeClubLegacyContribution('dismissal', { objectiveInfo:info, hiddenEvaluation:evaluation });
  game.gameOver = {
    active:true,
    type:'dismissal',
    reason:'La directiva decidió finalizar tu ciclo por no alcanzar el objetivo deportivo.',
    triggeredAt:new Date().toISOString(),
    objective:info.objective,
    ppg:info.ppg,
    matches:info.played,
    snapshot:gameOverSnapshot()
  };
  game.mustReviewTactics = false;
  if(typeof stopAdvanceAutoClicker === 'function') stopAdvanceAutoClicker('despido del manager');
  if(typeof archiveManagerPlayerStatsClub === 'function') archiveManagerPlayerStatsClub(game.selectedClubId, { final:true });
  if(typeof clearScoutedSigningChances === 'function') clearScoutedSigningChances();
  prepareManagerWithoutClubUi('dismissal');
  recordDismissedCareerStep();
  // El reinicio del club saliente elimina el contrato activo: archivarlo antes.
  if(typeof archiveManagerJobContract === 'function') archiveManagerJobContract('despido', game);
  if(typeof resetOutgoingClubStateAfterManagerExit === 'function') resetOutgoingClubStateAfterManagerExit(game.selectedClubId, 'dismissal');
  pushGameMessage({
    type:'directiva',
    priority:'high',
    title:'Despido del manager',
    body:`La directiva decidió finalizar tu ciclo por no alcanzar el objetivo deportivo. El impacto profesional se calculará dentro de la evaluación integral de esta etapa. Podés buscar otro club sin reiniciar el mundo de la partida.`,
    id:`dismissal-v842-${record.season}-${record.clubId}`
  });
  queueAutomaticRankingSubmission('dismissal');
  record.dismissalResult = 'dismissed';
  record.updatedDate = game.currentDate || '';
  return true;
}
function managerProcessHiddenObjectiveDeadlines(options={}){
  if(typeof managerChallengeIs === 'function' && managerChallengeIs()) return { dismissed:false, changed:false, reason:'challenge' };
  if(!game || game.gameOver?.active || game.founderMode || game.challenge || !managerObjectiveIsActive()) return { dismissed:false, changed:false, reason:'inactive' };
  const cfg = managerHiddenObjectiveConfig();
  if(!cfg.active) return { dismissed:false, changed:false, reason:'disabled' };
  const record = ensureManagerHiddenObjectiveSeason(game);
  if(!record) return { dismissed:false, changed:false, reason:'no_record' };
  const day = Math.max(1, Math.round(Number(options.day || (typeof currentGlobalDayNumber === 'function' ? currentGlobalDayNumber() : seasonDayFromDate(game.currentDate, currentSeasonYear())) || 1)));
  const info = managerObjectiveProgressInfo();
  let changed = false;
  if(day >= cfg.warningDay && !record.warningSent && info.active && Number(info.ppg || 0) < Number(info.objective || 0)){
    const messages = managerHiddenObjectiveWarningMessages(info);
    const text = messages[hashNumber(`manager-warning-${game.saveCode || ''}-${record.season}-${record.clubId}`, messages.length)];
    record.warningSent = true;
    record.warningDay = day;
    record.updatedDate = game.currentDate || '';
    pushGameMessage({ type:'directiva', priority:'high', title:'Tu continuidad está en riesgo', body:text, id:`manager-warning-day-${record.season}-${record.clubId}` });
    changed = true;
  }
  if(day < cfg.evaluationDay || record.evaluationCompleted) return { dismissed:false, changed, info, record };
  record.evaluationCompleted = true;
  record.evaluationDay = day;
  record.updatedDate = game.currentDate || '';
  changed = true;
  if(!info.active || Number(info.ppg || 0) >= Number(info.objective || 0)){
    record.dismissalResult = 'objective_met';
    return { dismissed:false, changed, info, record, reason:'objective_met' };
  }
  let evaluation = managerHiddenObjectiveEvaluation(record);
  evaluation.completed.forEach(item => {
    managerClubLegacyAddAward(record.clubId, {
      key:`${record.season}:${record.clubId}:${item.type}`,
      season:record.season,
      type:item.type,
      label:item.label,
      points:cfg.pointsSecondaryObjective,
      context:'day_250_evaluation',
      date:game.currentDate || ''
    });
  });
  // Los puntos obtenidos en esta misma evaluación pueden convertir al manager en ídolo
  // antes de resolver el sorteo de continuidad.
  evaluation = managerHiddenObjectiveEvaluation(record);
  const chance = clamp(cfg.baseDismissalChance - evaluation.reduction, 0, 100);
  const roll = managerHiddenObjectiveDeterministicRoll(record);
  record.dismissalChance = chance;
  record.dismissalReduction = evaluation.reduction;
  record.dismissalRoll = roll;
  if(roll < chance){
    return { dismissed:managerHiddenObjectiveFinalizeDismissal(info, evaluation, chance, roll), changed:true, info, record, evaluation, chance, roll };
  }
  record.dismissalResult = 'retained';
  const variants = managerHiddenObjectiveRetentionMessages(evaluation);
  const text = variants[hashNumber(`manager-retained-${game.saveCode || ''}-${record.season}-${record.clubId}`, variants.length)];
  pushGameMessage({
    type:'directiva',
    priority:'high',
    title:'La directiva mantiene tu continuidad',
    body:`${text} La posibilidad inicial de despido era ${cfg.baseDismissalChance.toFixed(0)}%; tus objetivos secundarios${evaluation.idolReduction > 0 ? ' y tu condición de ídolo' : ''} la redujeron ${evaluation.reduction.toFixed(0)} puntos, hasta ${chance.toFixed(0)}%.`,
    id:`manager-retained-day-${record.season}-${record.clubId}`
  });
  return { dismissed:false, changed:true, info, record, evaluation, chance, roll, reason:'retained' };
}

function managerCurrentSeasonTitlesForClub(season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  const history = Array.isArray(game?.managerStats?.titleHistory) ? game.managerStats.titleHistory : [];
  return history.filter(item => Number(item?.season || 0) === Number(season) && Number(item?.clubId || 0) === Number(clubId));
}
function managerFinalizeClubLegacyContribution(context='season_end', options={}){
  if(!game?.managerStats || game.founderMode || game.challenge || !Number(game.selectedClubId || 0)) return { points:0, awards:0 };
  const cfg = managerHiddenObjectiveConfig();
  const season = Math.max(1, Math.round(Number(options.season || game.seasonNumber || 1)));
  const clubId = Math.max(0, Math.round(Number(options.clubId || game.selectedClubId || 0)));
  const record = ensureManagerHiddenObjectiveSeason(game, { season, clubId });
  const evaluation = options.hiddenEvaluation || managerHiddenObjectiveEvaluation(record);
  const info = options.objectiveInfo || managerObjectiveProgressInfo();
  const seasonRecord = options.seasonRecord || game?.seasonTransition?.userRecord || null;
  const mainCompleted = Boolean(seasonRecord && Number(seasonRecord.season || 0) === season && Number(seasonRecord.clubId || 0) === clubId
    ? seasonRecord.objectiveAchieved
    : (info?.active && Number(info.ppg || 0) >= Number(info.objective || 0)));
  let points = 0;
  let awards = 0;
  if(mainCompleted){
    const result = managerClubLegacyAddAward(clubId, {
      key:`${season}:${clubId}:main-objective`, season, type:'main_objective', label:'Objetivo principal cumplido', points:cfg.pointsMainObjective, context, date:game.currentDate || ''
    });
    if(result.added){ points += result.points; awards += 1; }
  }
  evaluation.completed.forEach(item => {
    const result = managerClubLegacyAddAward(clubId, {
      key:`${season}:${clubId}:${item.type}`, season, type:item.type, label:item.label, points:cfg.pointsSecondaryObjective, context, date:game.currentDate || ''
    });
    if(result.added){ points += result.points; awards += 1; }
  });
  managerCurrentSeasonTitlesForClub(season, clubId).forEach(title => {
    const titleToken = `${title.type || 'title'}:${title.competitionId || title.competitionName || 'competition'}`;
    const result = managerClubLegacyAddAward(clubId, {
      key:`${season}:${clubId}:title:${titleToken}`,
      season,
      type:'title',
      label:`Título: ${title.competitionName || 'Competición'}`,
      points:managerOfficialTitleLegacyPoints(title, cfg),
      context,
      date:game.currentDate || ''
    });
    if(result.added){ points += result.points; awards += 1; }
  });
  if(record){
    record.finalized = ['season_end','dismissal','resignation','club_change'].includes(String(context || ''));
    record.finalizedContext = String(context || '');
    record.updatedDate = game.currentDate || '';
  }
  return { points, awards, mainCompleted, secondaryCompleted:evaluation.completed.length, titles:managerCurrentSeasonTitlesForClub(season, clubId).length };
}
function managerRegisterClausePlayerConvinced(player=null){
  const record = ensureManagerHiddenObjectiveSeason(game);
  if(!record) return 0;
  record.clausePlayersConvinced = Math.max(0, Math.round(Number(record.clausePlayersConvinced || 0))) + 1;
  record.updatedDate = game.currentDate || '';
  return record.clausePlayersConvinced;
}
function managerClubLegacyMarkup(){
  const cfg = managerHiddenObjectiveConfig();
  const records = managerClubLegacyRecords(game?.managerStats).filter(item => Number(item.points || 0) >= cfg.idolThreshold);
  if(!records.length) return `<div class="card manager-club-legacy-section manager-club-legacy-private" style="margin-top:14px"><h3>Legado en clubes</h3><p class="muted">Los reconocimientos especiales de los clubes aparecerán aquí únicamente cuando sean concedidos.</p></div>`;
  const cards = records.map(record => {
    return `<article class="card manager-club-legacy-card is-idol">
      <div class="manager-club-legacy-head">${clubBadge(record.clubId)}<div><p class="label">Ídolo del club</p><h3>${escapeHtml(record.clubName || clubName(record.clubId))}</h3></div></div>
      <div class="manager-club-legacy-recognition"><span aria-hidden="true">★</span><strong>Reconocimiento conseguido</strong></div>
    </article>`;
  }).join('');
  return `<section class="manager-club-legacy-section" style="margin-top:14px"><div class="row"><div><h3>Legado en clubes</h3><p class="muted small">Reconocimientos especiales obtenidos durante tu carrera.</p></div></div><div class="manager-club-legacy-grid">${cards}</div></section>`;
}

/* Persistencia y migración. */
const normalizeManagerStatsV841HiddenObjectives = normalizeManagerStats;
normalizeManagerStats = function(stats){
  const sourceLegacy = stats?.clubLegacy;
  const normalized = normalizeManagerStatsV841HiddenObjectives(stats);
  normalized.clubLegacy = migrateManagerClubLegacyFromHistoricalStats(normalized, sourceLegacy || normalized.clubLegacy || []);
  return normalized;
};
const normalizeGameV841HiddenObjectives = normalizeGame;
normalizeGame = function(saved){
  const normalized = normalizeGameV841HiddenObjectives(saved);
  // normalizeGame ya utiliza la versión extendida de normalizeManagerStats.
  // No se repite la migración completa del historial en el mismo ciclo de carga.
  normalized.managerHiddenObjectives = normalizeManagerHiddenObjectivesState(normalized.managerHiddenObjectives || {}, normalized);
  // Congela las bases al cargar, antes del primer avance diario de una partida migrada.
  ensureManagerHiddenObjectiveSeason(normalized);
  return normalized;
};

/* Inicialización en cada contrato/temporada para congelar correctamente las bases. */
const newGameV841HiddenObjectives = newGame;
newGame = function(selectedClubId, options={}){
  const result = newGameV841HiddenObjectives(selectedClubId, options);
  ensureManagerHiddenObjectiveSeason(game);
  return result;
};
const startNextSeasonV841HiddenObjectives = startNextSeason;
startNextSeason = function(selectedClubId, options={}){
  const result = startNextSeasonV841HiddenObjectives(selectedClubId, options);
  if(game && !game.seasonFinalized) ensureManagerHiddenObjectiveSeason(game);
  return result;
};
const continueCareerAtClubV841HiddenObjectives = continueCareerAtClub;
continueCareerAtClub = function(selectedClubId, options={}){
  const wasWithoutClub = Boolean(game?.gameOver?.active);
  const previousClubId = Number(game?.selectedClubId || 0);
  const result = continueCareerAtClubV841HiddenObjectives(selectedClubId, options);
  if(game && !game.gameOver?.active){
    const record = ensureManagerHiddenObjectiveSeason(game);
    const joinedDay = Math.max(1, Math.round(Number(typeof currentGlobalDayNumber === 'function' ? currentGlobalDayNumber() : seasonDayFromDate(game.currentDate, currentSeasonYear())) || 1));
    const cfg = managerHiddenObjectiveConfig();
    const changedClubAfterExit = wasWithoutClub && Number(game.selectedClubId || 0) !== previousClubId;
    if(record && changedClubAfterExit && joinedDay >= cfg.evaluationDay){
      record.warningSent = true;
      record.warningDay = joinedDay;
      record.evaluationCompleted = true;
      record.evaluationDay = joinedDay;
      record.dismissalResult = 'late_appointment_exempt';
      record.updatedDate = game.currentDate || '';
    }
  }
  return result;
};

/* Sustituye el despido inmediato por el control de días 200/250. */
checkManagerObjectiveGameOver = function(){
  const result = managerProcessHiddenObjectiveDeadlines();
  if(result.dismissed){
    if(typeof saveLocal === 'function') saveLocal(true);
  }else if(typeof processManagerContractNextSeasonNegotiationUnlock === 'function'){
    const unlock = processManagerContractNextSeasonNegotiationUnlock({ notify:true });
    if(unlock.changed && typeof saveLocal === 'function') saveLocal(true);
  }
  return Boolean(result.dismissed);
};

const processDailyCalendarStateV841HiddenObjectives = processDailyCalendarState;
processDailyCalendarState = function(dateAfter='', options={}){
  const result = processDailyCalendarStateV841HiddenObjectives(dateAfter, options);
  if(!game?.gameOver?.active && !options.managerWithoutClub){
    const deadline = managerProcessHiddenObjectiveDeadlines();
    result.managerContractDeadline = deadline;
  }
  return result;
};

const convinceSpecialClausePlayerV841HiddenObjectives = convinceSpecialClausePlayer;
convinceSpecialClausePlayer = function(messageId){
  const message = (game?.messages || []).find(item => item.id === messageId);
  const previousStatus = String(message?.action?.status || '');
  const result = convinceSpecialClausePlayerV841HiddenObjectives(messageId);
  const updated = (game?.messages || []).find(item => item.id === messageId);
  if(previousStatus === 'pending' && String(updated?.action?.status || '') === 'convinced'){
    managerRegisterClausePlayerConvinced(typeof playerById === 'function' ? playerById(updated?.action?.playerId) : null);
    if(typeof saveLocal === 'function') saveLocal(true);
  }
  return result;
};

const finalizeSeasonIfNeededV841HiddenObjectives = finalizeSeasonIfNeeded;
finalizeSeasonIfNeeded = function(options={}){
  const before = Boolean(game?.seasonFinalized);
  const result = finalizeSeasonIfNeededV841HiddenObjectives(options);
  if(!before && game?.seasonFinalized && !game?.seasonTransition?.managerAbsent){
    const contribution = managerFinalizeClubLegacyContribution('season_end', { seasonRecord:game.seasonTransition?.userRecord });
    if(contribution.awards > 0 && typeof saveLocal === 'function') saveLocal(true);
  }
  return result;
};

const resignCurrentClubV841HiddenObjectives = resignCurrentClub;
resignCurrentClub = function(){
  const before = game?.gameOver?.triggeredAt || '';
  const objectiveInfo = game && !game.gameOver?.active ? managerObjectiveProgressInfo() : null;
  const hiddenRecord = game && !game.gameOver?.active ? ensureManagerHiddenObjectiveSeason(game) : null;
  const hiddenEvaluation = hiddenRecord ? managerHiddenObjectiveEvaluation(hiddenRecord) : null;
  const contractBefore = game?.managerJobContract && typeof normalizeManagerJobContract === 'function'
    ? normalizeManagerJobContract(game.managerJobContract, game)
    : (game?.managerJobContract ? { ...game.managerJobContract } : null);
  const result = resignCurrentClubV841HiddenObjectives();
  if(game?.gameOver?.active && game.gameOver.type === 'resignation' && game.gameOver.triggeredAt !== before){
    const alreadyArchived = contractBefore && Array.isArray(game.managerContractHistory)
      ? game.managerContractHistory.some(item => String(item?.id || '') === String(contractBefore.id || ''))
      : false;
    if(contractBefore && !alreadyArchived && typeof archiveManagerJobContract === 'function'){
      game.managerJobContract = contractBefore;
      archiveManagerJobContract('renuncia', game);
    }
    managerFinalizeClubLegacyContribution('resignation', { objectiveInfo, hiddenEvaluation });
    if(typeof saveLocal === 'function') saveLocal(true);
    if(typeof renderAll === 'function') renderAll();
  }
  return result;
};

const renderManagerStatsV841HiddenObjectives = renderManagerStats;
renderManagerStats = function(){
  renderManagerStatsV841HiddenObjectives();
  if(String(managerStatsViewMode || 'profile') !== 'profile') return;
  const legacy = document.createElement('div');
  legacy.innerHTML = managerClubLegacyMarkup();
  while(legacy.firstChild) view.appendChild(legacy.firstChild);
};

ensureManagerHiddenObjectiveState(game);
