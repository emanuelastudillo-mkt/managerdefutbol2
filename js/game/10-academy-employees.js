/* Academia, captación, juveniles, empleados y tratamientos. */

function createInitialAcademyCareerStats(){
  return {
    trainingPoints:0,
    consultations:0,
    promotions:0,
    sales:0,
    directSaleIncome:0,
    futureSaleBenefits:0
  };
}
function normalizeAcademyCareerStats(value){
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const base = createInitialAcademyCareerStats();
  const clean = { ...base, ...raw };
  Object.keys(base).forEach(key => { clean[key] = Math.max(0, Math.round(Number(clean[key] || 0))); });
  return clean;
}
function createInitialAcademyState(){
  return {
    owner:'manager', ownershipVersion:2, homeCountry:'', createdAt:'',
    players:[], scoutingJobs:[], unlockedStats:{}, trainingPlan:{}, youthPreparer:null, staffContracts:{},
    facilities:{ youthTraining:{ level:0, construction:null }, lastProcessedDate:null },
    lastConsultTurn:null, lastArrivalTurn:null, lastConsultReveal:null,
    exceptionalYouthGrantedSeason:null, exceptionalYouthGrantedCount:0, exceptionalYouthTargetSeason:null, exceptionalYouthTargetCount:0,
    residences:0, residenceLastChargeDate:null, youthSalaryLastChargeDate:null, lastNegativeBalanceNoticeDate:null,
    youthTransferOffers:[], youthTransferLastAttemptDate:null, youthTransferHistory:[],
    youthInjurySeason:null, youthInjuriesTarget:null, youthInjuriesCount:0, sortMode:'edad_asc', submenu:'players',
    firstActionIntroShown:false, firstActionIntroDate:'', firstActionIntroType:'', treatmentPlans:{},
    careerStats:createInitialAcademyCareerStats()
  };
}
function normalizeManagerAcademyFacilitiesState(state){
  const clean = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const raw = clean.youthTraining && typeof clean.youthTraining === 'object' ? clean.youthTraining : {};
  const maxLevel = Math.max(0, ...youthTrainingGroundLevels().map(item => Number(item.level || 0)));
  const level = clamp(Math.round(Number(raw.level || 0)), 0, maxLevel);
  const targetLevel = Math.max(level + 1, Math.round(Number(raw?.construction?.targetLevel || level + 1)));
  const construction = typeof normalizeFacilityConstruction === 'function'
    ? normalizeFacilityConstruction(raw.construction, { targetLevel })
    : (raw.construction && Number(raw.construction.daysLeft || 0) > 0 ? { ...raw.construction, targetLevel } : null);
  return {
    ...clean,
    youthTraining:{ ...raw, level, construction },
    lastProcessedDate:validIsoDate(clean.lastProcessedDate) ? clean.lastProcessedDate : null
  };
}
function academyStaffContractsState(){
  game.academy = normalizeAcademyState(game.academy);
  game.academy.staffContracts = normalizeStaffContracts(game.academy.staffContracts || {});
  return game.academy.staffContracts;
}
function managerAcademyFacilitiesState(){
  game.academy = normalizeAcademyState(game.academy);
  game.academy.facilities = normalizeManagerAcademyFacilitiesState(game.academy.facilities);
  return game.academy.facilities;
}
function normalizeAcademyState(state){
  const base = createInitialAcademyState();
  const hadExceptionalCount = Boolean(state && Object.prototype.hasOwnProperty.call(state, 'exceptionalYouthGrantedCount'));
  const hadExceptionalTarget = Boolean(state && Object.prototype.hasOwnProperty.call(state, 'exceptionalYouthTargetSeason'));
  const hadOwnershipVersion = Boolean(state && Object.prototype.hasOwnProperty.call(state, 'ownershipVersion'));
  const hadFirstActionIntro = Boolean(state && Object.prototype.hasOwnProperty.call(state, 'firstActionIntroShown'));
  const clean = { ...base, ...(state || {}) };
  if(state && !hadOwnershipVersion) clean.ownershipVersion = 0;
  const allowedSorts = new Set(['edad_asc','edad_desc','informe_desc','informe_asc']);
  clean.sortMode = allowedSorts.has(String(clean.sortMode || '')) ? String(clean.sortMode) : 'edad_asc';
  clean.submenu = String(clean.submenu || '') === 'portfolio' ? 'portfolio' : 'players';
  clean.players = Array.isArray(clean.players) ? clean.players.map(normalizeAcademyPlayer).filter(Boolean) : [];
  clean.scoutingJobs = Array.isArray(clean.scoutingJobs) ? clean.scoutingJobs : [];
  clean.unlockedStats = clean.unlockedStats && typeof clean.unlockedStats === 'object' ? clean.unlockedStats : {};
  clean.trainingPlan = clean.trainingPlan && typeof clean.trainingPlan === 'object' ? clean.trainingPlan : {};
  clean.owner = 'manager';
  clean.ownershipVersion = Math.max(0, Math.round(Number(clean.ownershipVersion || 0)));
  clean.homeCountry = String(clean.homeCountry || '');
  clean.createdAt = String(clean.createdAt || '');
  clean.youthPreparer = clean.youthPreparer || null;
  clean.staffContracts = normalizeStaffContracts(clean.staffContracts || {});
  clean.facilities = normalizeManagerAcademyFacilitiesState(clean.facilities);
  clean.exceptionalYouthGrantedSeason = Number(clean.exceptionalYouthGrantedSeason || 0) || null;
  clean.exceptionalYouthGrantedCount = Math.max(0, Math.round(Number(clean.exceptionalYouthGrantedCount || 0)));
  if(!hadExceptionalCount && clean.exceptionalYouthGrantedSeason) clean.exceptionalYouthGrantedCount = 1;
  clean.exceptionalYouthTargetSeason = Number(clean.exceptionalYouthTargetSeason || 0) || null;
  clean.exceptionalYouthTargetCount = clamp(Math.round(Number(clean.exceptionalYouthTargetCount || 0)), 0, 6);
  if(!hadExceptionalTarget && clean.exceptionalYouthGrantedSeason){
    clean.exceptionalYouthTargetSeason = clean.exceptionalYouthGrantedSeason;
    clean.exceptionalYouthTargetCount = clamp(Math.max(1, clean.exceptionalYouthGrantedCount), 1, 6);
  }
  clean.lastConsultReveal = clean.lastConsultReveal && typeof clean.lastConsultReveal === 'object' ? clean.lastConsultReveal : null;
  clean.youthInjurySeason = Number(clean.youthInjurySeason || 0) || null;
  clean.youthInjuriesTarget = Number.isFinite(Number(clean.youthInjuriesTarget)) ? Math.max(0, Math.round(Number(clean.youthInjuriesTarget))) : null;
  clean.youthInjuriesCount = Math.max(0, Math.round(Number(clean.youthInjuriesCount || 0)));
  clean.residences = Math.max(0, Math.round(Number(clean.residences || 0)));
  clean.residenceLastChargeDate = validIsoDate(clean.residenceLastChargeDate) ? clean.residenceLastChargeDate : null;
  clean.youthSalaryLastChargeDate = validIsoDate(clean.youthSalaryLastChargeDate) ? clean.youthSalaryLastChargeDate : null;
  clean.lastNegativeBalanceNoticeDate = validIsoDate(clean.lastNegativeBalanceNoticeDate) ? clean.lastNegativeBalanceNoticeDate : null;
  clean.youthTransferOffers = Array.isArray(clean.youthTransferOffers) ? clean.youthTransferOffers.map(normalizeAcademyYouthTransferOffer).filter(Boolean).slice(-200) : [];
  clean.youthTransferLastAttemptDate = validIsoDate(clean.youthTransferLastAttemptDate) ? clean.youthTransferLastAttemptDate : null;
  clean.youthTransferHistory = Array.isArray(clean.youthTransferHistory) ? clean.youthTransferHistory.map(normalizeAcademyYouthTransferOffer).filter(Boolean).slice(-300) : [];
  const hadPriorAcademyActivity = Boolean(
    clean.players.length || clean.scoutingJobs.length || clean.residences > 0 ||
    Number(clean.facilities?.youthTraining?.level || 0) > 0 || clean.facilities?.youthTraining?.construction ||
    clean.youthPreparer || Object.keys(clean.staffContracts || {}).length || clean.youthTransferHistory.length
  );
  clean.firstActionIntroShown = hadFirstActionIntro ? Boolean(clean.firstActionIntroShown) : hadPriorAcademyActivity;
  clean.firstActionIntroDate = validIsoDate(clean.firstActionIntroDate) ? clean.firstActionIntroDate : '';
  clean.firstActionIntroType = String(clean.firstActionIntroType || '');
  clean.treatmentPlans = clean.treatmentPlans && typeof clean.treatmentPlans === 'object' && !Array.isArray(clean.treatmentPlans) ? clean.treatmentPlans : {};
  clean.careerStats = normalizeAcademyCareerStats(clean.careerStats);
  return clean;
}

function academyCareerStatsState(options={}){
  if(!game) return createInitialAcademyCareerStats();
  game.academy = normalizeAcademyState(game.academy);
  const stats = normalizeAcademyCareerStats(game.academy.careerStats);
  if(options.reconcile !== false){
    const history = Array.isArray(game.academy.youthTransferHistory) ? game.academy.youthTransferHistory : [];
    const acceptedOffers = new Map();
    history.filter(item => String(item?.status || '') === 'accepted').forEach(item => {
      const id = String(item?.id || `sale-${item?.playerId || 0}-${item?.resolvedDate || ''}`);
      if(!acceptedOffers.has(id)) acceptedOffers.set(id, item);
    });
    const directIncome = Array.from(acceptedOffers.values()).reduce((sum, item) => sum + Math.max(0, Math.round(Number(item?.netAmount || 0))), 0);
    const promotionIds = new Set();
    (game.academy.players || []).filter(item => String(item?.status || '') === 'promoted').forEach(item => promotionIds.add(Number(item.id || 0)));
    const portfolio = game.managerPlayerPortfolio && typeof game.managerPlayerPortfolio === 'object' ? game.managerPlayerPortfolio : null;
    (Array.isArray(portfolio?.rights) ? portfolio.rights : []).forEach(item => promotionIds.add(Number(item?.playerId || 0)));
    const consultationLogCount = (Array.isArray(game?.special?.puntos_log) ? game.special.puntos_log : []).filter(item => String(item?.actionId || '') === 'consultar_juveniles').length;
    const futureBenefits = Math.max(
      Math.max(0, Math.round(Number(portfolio?.totalIncome || 0))),
      (Array.isArray(portfolio?.history) ? portfolio.history : []).reduce((sum, item) => sum + Math.max(0, Math.round(Number(item?.managerIncome || 0))), 0)
    );
    stats.consultations = Math.max(stats.consultations, consultationLogCount);
    stats.promotions = Math.max(stats.promotions, Array.from(promotionIds).filter(Boolean).length);
    stats.sales = Math.max(stats.sales, acceptedOffers.size);
    stats.directSaleIncome = Math.max(stats.directSaleIncome, directIncome);
    stats.futureSaleBenefits = Math.max(stats.futureSaleBenefits, futureBenefits);
  }
  game.academy.careerStats = stats;
  return stats;
}
function recordAcademyCareerProgress(changes={}, options={}){
  if(!game || !changes || typeof changes !== 'object') return academyCareerStatsState();
  game.academy = normalizeAcademyState(game.academy);
  const stats = normalizeAcademyCareerStats(game.academy.careerStats);
  Object.entries(changes).forEach(([key, amount]) => {
    if(!Object.prototype.hasOwnProperty.call(stats, key)) return;
    stats[key] = Math.max(0, Math.round(Number(stats[key] || 0) + Number(amount || 0)));
  });
  game.academy.careerStats = stats;
  const reconciled = academyCareerStatsState({ reconcile:true });
  if(options.checkAchievements !== false && typeof checkManagerAchievements === 'function') checkManagerAchievements({ silent:options.silent === true });
  return reconciled;
}


function showAcademyFirstActionIntroduction(actionType='academy_action'){
  if(!game) return false;
  game.academy = normalizeAcademyState(game.academy);
  if(game.academy.firstActionIntroShown) return false;
  const actionLabels = {
    academy_staff_youth_preparer:'contrataste a tu primer empleado',
    academy_facility_youth_build:'iniciaste la primera obra del Predio',
    academy_scouting_start:'iniciaste tu primera captación',
    academy_residence_rent:'alquilaste tu primera residencia juvenil'
  };
  const actionLabel = actionLabels[String(actionType || '')] || 'realizaste tu primera acción';
  const today = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  game.academy.firstActionIntroShown = true;
  game.academy.firstActionIntroDate = validIsoDate(today) ? today : '';
  game.academy.firstActionIntroType = String(actionType || 'academy_action');
  const body = `Felicitaciones: ${actionLabel} en Tu Academia. Este proyecto pertenece al manager y te acompañará durante toda tu carrera, incluso cuando cambies de club. El Predio, las residencias, los empleados, los juveniles y los derechos económicos se administran con tu Cuenta Bancaria personal.`;
  if(typeof pushGameMessage === 'function') pushGameMessage({
    id:`academy-first-action-${Number(game.seasonNumber || 1)}-${Number(game.globalTurn || 0)}`,
    type:'academia', priority:'high', title:'Comienza el proyecto de Tu Academia', body
  });
  saveLocal(true);
  openModal(`<div class="academy-intro-modal"><p class="eyebrow">Tu Academia</p><h2>Felicitaciones por el primer paso</h2><p>${escapeHtml(body)}</p><div class="card blocker"><strong>Una propiedad del manager</strong><p class="muted small">Sus instalaciones, juveniles y derechos continúan con vos aunque renuncies, seas despedido o firmes con otro club.</p></div><div class="modal-actions"><button id="btnCloseAcademyFirstAction" class="primary">Continuar</button></div></div>`);
  $('btnCloseAcademyFirstAction')?.addEventListener('click', closeModal);
  return true;
}

function defaultStaffCategories(){
  return [
    { id:'regular', nombre:'Regular', multiplicadorCosto:1, multiplicadorRendimiento:1, descripcion:'Mantiene el rendimiento estándar.' },
    { id:'bueno', nombre:'Bueno', multiplicadorCosto:4, multiplicadorRendimiento:2, descripcion:'Duplica el rendimiento de la acción.' },
    { id:'elite', nombre:'Elite', multiplicadorCosto:50, multiplicadorRendimiento:3, descripcion:'Triplica el rendimiento de la acción.' }
  ];
}
function defaultStaffDefinitions(){
  return [
    { id:'psychologist', nombre:'Psicólogo motivacional', rol:'Motivación', costoBase:PSYCHOLOGIST_COST, duracion:'temporada', descripcion:'Permite realizar charlas motivacionales para mejorar la moral del plantel.', accion:'charla_motivacional', imagenes:{ regular:'img/empleados/psicologo-regular.webp', bueno:'img/empleados/psicologo-bueno.webp', elite:'img/empleados/psicologo-elite.webp' } },
    { id:'kinesiologist', nombre:'Kinesiólogo', rol:'Recuperación', costoBase:KINESIOLOGIST_COST, duracion:'temporada', descripcion:'Aplica tratamientos automáticos diarios a los lesionados y permite asignar un jugador a trabajo diferenciado con menor carga.', accion:'tratamiento_lesion', imagenes:{ regular:'img/empleados/kinesiologo-regular.webp', bueno:'img/empleados/kinesiologo-bueno.webp', elite:'img/empleados/kinesiologo-elite.webp' } },
    {
      id:'assistant_coach',
      nombre:'Segundo entrenador',
      rol:'Análisis situacional',
      costoBase:ASSISTANT_COACH_ANNUAL_COSTS.regular,
      duracion:'temporada',
      descripcion:'Analiza el plantel, la economía, la Academia, el estadio, la táctica y el próximo rival para entregar tres prioridades explicadas.',
      accion:'analisis_situacion',
      nombresCategoria:{ regular:'Principiante', bueno:'Asentado', elite:'Experimentado' },
      costosPorCategoria:{ ...ASSISTANT_COACH_ANNUAL_COSTS },
      diasAnalisisPorCategoria:{ ...ASSISTANT_COACH_ANALYSIS_DAYS },
      imagenes:{ regular:'img/empleados/segundo-entrenador-principiante.webp', bueno:'img/empleados/segundo-entrenador-asentado.webp', elite:'img/empleados/segundo-entrenador-experimentado.webp' }
    },
    { id:'youth_preparer', nombre:'Preparador de juveniles', rol:'Academia', costoBase:YOUTH_PREPARER_COST, duracion:'temporada', descripcion:'Permite consultar informes de juveniles y descubrir más habilidades ocultas.', accion:'informe_juveniles', imagenes:{ regular:'img/empleados/preparador-juveniles-regular.webp', bueno:'img/empleados/preparador-juveniles-bueno.webp', elite:'img/empleados/preparador-juveniles-elite.webp' } }
  ];
}
function staffCategories(){
  const source = Array.isArray(employeesDatabase?.categorias) && employeesDatabase.categorias.length ? employeesDatabase.categorias : defaultStaffCategories();
  return source.map(item => ({
    id:String(item.id || 'regular'),
    nombre:item.nombre || item.label || item.id || 'Regular',
    multiplicadorCosto:Math.max(0, Number(item.multiplicadorCosto ?? item.costMultiplier ?? 1) || 1),
    multiplicadorRendimiento:Math.max(1, Number(item.multiplicadorRendimiento ?? item.performanceMultiplier ?? 1) || 1),
    descripcion:item.descripcion || item.description || ''
  }));
}
function staffDefinitions(){
  const defaults = defaultStaffDefinitions();
  const provided = Array.isArray(employeesDatabase?.empleados) ? employeesDatabase.empleados.filter(Boolean) : [];
  const providedIds = new Set(provided.map(item => String(item?.id || '')));
  const source = provided.length ? [...provided, ...defaults.filter(item => !providedIds.has(item.id))] : defaults;
  return source.map(item => ({
    id:String(item.id || ''),
    nombre:item.nombre || item.name || item.id || 'Empleado',
    rol:item.rol || item.role || '',
    costoBase:Math.max(0, Number(item.costoBase ?? item.baseCost ?? 0) || 0),
    duracion:item.duracion || item.duration || 'temporada',
    descripcion:item.descripcion || item.description || '',
    accion:item.accion || item.action || '',
    nombresCategoria:(item.nombresCategoria && typeof item.nombresCategoria === 'object') ? { ...item.nombresCategoria } : {},
    costosPorCategoria:(item.costosPorCategoria && typeof item.costosPorCategoria === 'object') ? { ...item.costosPorCategoria } : {},
    diasAnalisisPorCategoria:(item.diasAnalisisPorCategoria && typeof item.diasAnalisisPorCategoria === 'object') ? { ...item.diasAnalisisPorCategoria } : {},
    imagenes:(item.imagenes && typeof item.imagenes === 'object') ? { ...item.imagenes } : {}
  })).filter(item => item.id);
}
function staffDefinition(staffId){
  return staffDefinitions().find(item => item.id === staffId) || defaultStaffDefinitions().find(item => item.id === staffId) || null;
}
function staffCategory(categoryId){
  return staffCategories().find(item => item.id === categoryId) || staffCategories()[0] || defaultStaffCategories()[0];
}
function staffCategoryFor(staffId, categoryId='regular'){
  const base = staffCategory(categoryId);
  const customName = String(staffDefinition(staffId)?.nombresCategoria?.[base.id] || '').trim();
  return customName ? { ...base, nombre:customName } : base;
}
function staffBaseCost(staffId){
  const fromJson = Number(staffDefinition(staffId)?.costoBase || 0);
  if(fromJson > 0) return fromJson;
  if(staffId === 'psychologist') return PSYCHOLOGIST_COST;
  if(staffId === 'kinesiologist') return KINESIOLOGIST_COST;
  if(staffId === 'youth_preparer') return YOUTH_PREPARER_COST;
  return 0;
}
function staffHireCost(staffId, categoryId='regular'){
  const category = staffCategory(categoryId);
  const exact = Number(staffDefinition(staffId)?.costosPorCategoria?.[category.id]);
  if(Number.isFinite(exact) && exact >= 0) return Math.round(exact);
  return Math.round(staffBaseCost(staffId) * category.multiplicadorCosto);
}
function managerPersonalBalance(){
  const finances = typeof ensureManagerFinancesState === 'function' ? ensureManagerFinancesState(game) : null;
  return Math.round(Number(finances?.balance || 0));
}
function managerCanAffordAcademy(cost=0){ return managerPersonalBalance() >= Math.max(0, Math.round(Number(cost || 0))); }
function recordAcademyPersonalExpense(cost, concept, meta={}){
  const amount = Math.max(0, Math.round(Number(cost || 0)));
  if(amount <= 0) return 0;
  if(typeof recordManagerFinanceChange !== 'function') return 0;
  return recordManagerFinanceChange(-amount, concept, { ...meta, academyExpense:true, academyOwnedByManager:true });
}
function academyFinanceHistory(){
  const finances = typeof ensureManagerFinancesState === 'function' ? ensureManagerFinancesState(game) : null;
  return (Array.isArray(finances?.history) ? finances.history : []).filter(item => Boolean(item?.academyExpense || item?.academyIncome || item?.type === 'academy_youth_sale'));
}
function normalizeStaffContracts(contracts){
  const clean = (contracts && typeof contracts === 'object' && !Array.isArray(contracts)) ? { ...contracts } : {};
  Object.keys(clean).forEach(key => {
    const current = clean[key] || {};
    clean[key] = {
      active:Boolean(current.active),
      season:Number(current.season || 0),
      category:staffCategory(current.category || current.nivel || 'regular').id,
      cost:Number(current.cost || 0),
      performanceMultiplier:Math.max(1, Number(current.performanceMultiplier || staffCategory(current.category || 'regular').multiplicadorRendimiento || 1)),
      hiredTurn:Number(current.hiredTurn || current.matchdayIndex || 0),
      hiredGlobalTurn:Number(current.hiredGlobalTurn || current.globalTurn || 0),
      dismissedDate:validIsoDate(current.dismissedDate) ? current.dismissedDate : '',
      dismissedSeason:Math.max(0, Math.round(Number(current.dismissedSeason || 0))),
      dismissedGlobalTurn:Math.max(0, Math.round(Number(current.dismissedGlobalTurn || 0))),
      dismissedReason:String(current.dismissedReason || '')
    };
  });
  return clean;
}
function resetStaffSeasonState(){
  if(!game) return;
  game.staffContracts = normalizeStaffContracts(game.staffContracts || {});
  Object.values(game.staffContracts).forEach(contract => { contract.active = false; });
  if(game.staffActions?.kinesiologist){
    game.staffActions.kinesiologist.active = false;
    game.staffActions.kinesiologist.differentiatedPlayerId = 0;
  }
  if(typeof pauseAssistantCoachAnalysis === 'function') pauseAssistantCoachAnalysis('season_end');
}
function legacyStaffActive(staffId){
  if(staffId === 'kinesiologist') return Boolean(game?.staffActions?.kinesiologist?.active);
  if(staffId === 'youth_preparer') return Boolean(game?.academy?.youthPreparer?.active && Number(game.academy.youthPreparer.season || 0) === Number(game.seasonNumber || 1));
  return false;
}
function staffContract(staffId){
  const contracts = staffId === 'youth_preparer' ? academyStaffContractsState() : (game.staffContracts = normalizeStaffContracts(game.staffContracts || {}));
  const contract = contracts[staffId];
  if(contract?.active && Number(contract.season || 0) === Number(game.seasonNumber || 1)) return contract;
  if(legacyStaffActive(staffId)){
    return { active:true, season:game.seasonNumber || 1, category:'regular', cost:staffBaseCost(staffId), performanceMultiplier:1, legacy:true };
  }
  return null;
}
function staffActive(staffId){ return Boolean(staffContract(staffId)); }
function staffPerformanceMultiplier(staffId){ return Math.max(1, Number(staffContract(staffId)?.performanceMultiplier || 1)); }
function deactivateStaffEmployee(staffId, reason='manual'){
  if(!game) return null;
  const def = staffDefinition(staffId);
  if(!def) return null;
  const contracts = staffId === 'youth_preparer' ? academyStaffContractsState() : (game.staffContracts = normalizeStaffContracts(game.staffContracts || {}));
  const contract = contracts[staffId] || null;
  const wasActive = Boolean(contract?.active && Number(contract.season || 0) === Number(game.seasonNumber || 1)) || legacyStaffActive(staffId);
  if(!wasActive) return null;
  const snapshot = {
    id:staffId,
    name:def.nombre,
    category:staffCategoryFor(staffId, contract?.category || 'regular').nombre,
    cost:Number(contract?.cost || staffHireCost(staffId, contract?.category || 'regular') || 0)
  };
  if(contract){
    contract.active = false;
    contract.dismissedDate = validIsoDate(game.currentDate) ? game.currentDate : '';
    contract.dismissedSeason = Number(game.seasonNumber || 1);
    contract.dismissedGlobalTurn = Number(game.globalTurn || 0);
    contract.dismissedReason = String(reason || 'manual');
  }
  game.staffActions = game.staffActions || {};
  if(staffId === 'kinesiologist' && game.staffActions.kinesiologist){
    game.staffActions.kinesiologist.active = false;
    game.staffActions.kinesiologist.differentiatedPlayerId = 0;
  }
  if(staffId === 'youth_preparer'){
    game.academy = normalizeAcademyState(game.academy);
    if(game.academy.youthPreparer) game.academy.youthPreparer.active = false;
  }
  if(staffId === 'assistant_coach' && typeof pauseAssistantCoachAnalysis === 'function') pauseAssistantCoachAnalysis(reason);
  return snapshot;
}
function dismissStaffEmployee(staffId, options={}){
  if(!game) return false;
  const def = staffDefinition(staffId);
  if(!def || !staffActive(staffId)){ if(!options.silent) showNotice('Ese empleado ya no está contratado.'); return false; }
  if(!options.skipConfirm){
    const accepted = window.confirm(`El contrato de ${def.nombre} ya fue pagado por toda la temporada. Despedirlo no devuelve dinero. ¿Continuar?`);
    if(!accepted) return false;
  }
  const dismissed = deactivateStaffEmployee(staffId, options.reason || 'manual');
  if(!dismissed) return false;
  if(options.message !== false && typeof pushGameMessage === 'function') pushGameMessage({
    type:'empleados',
    priority:'normal',
    title:`${dismissed.name} despedido`,
    body:`El contrato ya estaba pagado por toda la temporada. ${dismissed.name} dejó ${staffId === 'youth_preparer' ? 'Tu Academia' : 'el club'} sin reintegro de ${formatMoney(dismissed.cost)}.`,
    id:`staff-dismissed-${staffId}-${game.seasonNumber || 1}-${game.globalTurn || 0}`
  });
  if(options.save !== false && typeof saveLocal === 'function') saveLocal(true);
  if(typeof options.after === 'function') options.after();
  else if(options.render !== false && typeof renderEmployees === 'function') renderEmployees();
  if(!options.silent) showNotice(`${dismissed.name} despedido. El pago de la temporada no se reintegra.`);
  return true;
}
function dismissAllStaffForFinancialCrisis(options={}){
  if(!game || Number(game.budget || 0) >= 0) return [];
  const active = staffDefinitions().filter(def => def.id !== 'youth_preparer' && staffActive(def.id));
  if(!active.length) return [];
  const dismissed = active.map(def => deactivateStaffEmployee(def.id, 'negative_budget')).filter(Boolean);
  if(!dismissed.length) return [];
  if(typeof pushGameMessage === 'function') pushGameMessage({
    type:'finanzas',
    priority:'high',
    title:'Empleados despedidos por números rojos',
    body:`El presupuesto cayó a ${formatMoney(game.budget || 0)}. El club rescindió automáticamente ${dismissed.length} contrato(s): ${dismissed.map(item => item.name).join(', ')}. Los pagos de temporada ya realizados no se reintegran.`,
    id:`staff-financial-dismissal-${game.seasonNumber || 1}-${game.globalTurn || 0}-${dismissed.map(item => item.id).join('-')}`
  });
  if(options.save && typeof saveLocal === 'function') saveLocal(true);
  if(!options.silent && typeof showNotice === 'function') showNotice('El club entró en números rojos y despidió a todos los empleados.', true);
  return dismissed;
}
function bindStaffDismissButtons(after=null){
  const rerender = typeof after === 'function' ? after : (typeof renderEmployees === 'function' ? renderEmployees : null);
  document.querySelectorAll('[data-dismiss-staff]').forEach(btn => btn.addEventListener('click', () => dismissStaffEmployee(String(btn.dataset.dismissStaff || ''), { after:rerender })));
}
function staffImagePath(staffId, categoryId='regular'){
  const def = staffDefinition(staffId);
  const category = staffCategory(categoryId).id;
  const fromJson = def?.imagenes?.[category] || def?.imagenes?.regular || '';
  if(fromJson) return String(fromJson);
  const base = staffId === 'psychologist' ? 'psicologo' : staffId === 'kinesiologist' ? 'kinesiologo' : staffId === 'youth_preparer' ? 'preparador-juveniles' : staffId === 'assistant_coach' ? 'segundo-entrenador' : 'empleado';
  return `img/empleados/${base}-${category}.webp`;
}
function staffImageMarkup(staffId, categoryId='regular', className='staff-employee-photo'){
  const def = staffDefinition(staffId);
  const alt = `${def?.nombre || 'Empleado'} ${staffCategoryFor(staffId, categoryId).nombre}`;
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(staffImagePath(staffId, categoryId))}" alt="${escapeHtml(alt)}" loading="lazy"><span class="staff-photo-fallback" style="display:none">${escapeHtml((def?.nombre || 'E').slice(0,1).toUpperCase())}</span>`;
}
function staffContractCardMarkup(staffId, mode='compact'){
  const contract = staffContract(staffId);
  const def = staffDefinition(staffId);
  if(!contract || !def) return '';
  const category = staffCategoryFor(staffId, contract.category || 'regular');
  const cls = mode === 'mini' ? 'staff-contract-card mini' : 'staff-contract-card';
  return `<div class="${cls}">
    <div class="staff-photo-wrap">${staffImageMarkup(staffId, category.id)}</div>
    <div class="staff-contract-info">
      <p class="label">${escapeHtml(def.rol || 'Empleado')}</p>
      <h3>${escapeHtml(def.nombre)}</h3>
      <div class="staff-contract-tags"><span class="pill ok">${escapeHtml(category.nombre)}</span><span class="pill">${formatMoney(contract.cost || staffHireCost(staffId, category.id))}</span></div>
      <button type="button" class="ghost danger small-btn staff-dismiss-btn" data-dismiss-staff="${escapeHtml(staffId)}">Despedir</button>
    </div>
  </div>`;
}
function contractedStaffList(scope='club'){
  return staffDefinitions().filter(def => (scope === 'academy' ? def.id === 'youth_preparer' : def.id !== 'youth_preparer') && staffActive(def.id));
}
function staffContractsPanelMarkup({ empty=false, scope='club' }={}){
  const active = contractedStaffList(scope);
  if(!active.length && !empty) return '';
  return `<div class="card featured-staff-panel" style="margin-top:14px">
    <div class="row"><h3>Empleados contratados</h3><span class="pill">Temporada actual</span></div>
    ${active.length ? `<div class="grid cols-3 featured-staff-grid">${active.map(def => staffContractCardMarkup(def.id)).join('')}</div>` : '<p class="muted">Todavía no hay empleados contratados.</p>'}
  </div>`;
}
function founderStaffRestrictionsActive(){
  return Boolean(game && typeof isFoundedClubId === 'function' && isFoundedClubId(game.selectedClubId));
}
function founderClubManagerWins(){
  if(!game?.managerStats) return 0;
  const founderClubId = Number(game.founderClubId || game.selectedClubId || 0);
  if(!founderClubId) return 0;
  const stats = typeof normalizeManagerStats === 'function' ? normalizeManagerStats(game.managerStats) : game.managerStats;
  const completed = (Array.isArray(stats?.seasons) ? stats.seasons : [])
    .filter(item => Number(item?.clubId || 0) === founderClubId)
    .reduce((sum, item) => sum + Math.max(0, Math.round(Number(item?.won || 0))), 0);
  const current = Number(stats?.currentSeason?.clubId || 0) === founderClubId
    ? Math.max(0, Math.round(Number(stats.currentSeason?.won || 0)))
    : 0;
  return completed + current;
}
function founderStaffCategoryRequirement(categoryId='regular'){
  const id = String(categoryId || 'regular');
  if(id === 'elite') return typeof FOUNDER_STAFF_ELITE_WINS !== 'undefined' ? FOUNDER_STAFF_ELITE_WINS : 45;
  if(id === 'bueno') return typeof FOUNDER_STAFF_GOOD_WINS !== 'undefined' ? FOUNDER_STAFF_GOOD_WINS : 15;
  return 0;
}
function staffCategoryUnlockInfo(categoryId='regular'){
  const requiredWins = founderStaffCategoryRequirement(categoryId);
  const wins = founderClubManagerWins();
  const restricted = founderStaffRestrictionsActive();
  return { restricted, requiredWins, wins, unlocked:!restricted || wins >= requiredWins, remaining:Math.max(0, requiredWins - wins) };
}
function founderStaffUnlockSummaryMarkup(staffId=''){
  if(!founderStaffRestrictionsActive()) return '';
  const wins = founderClubManagerWins();
  const good = typeof FOUNDER_STAFF_GOOD_WINS !== 'undefined' ? FOUNDER_STAFF_GOOD_WINS : 15;
  const elite = typeof FOUNDER_STAFF_ELITE_WINS !== 'undefined' ? FOUNDER_STAFF_ELITE_WINS : 45;
  const regularLabel = staffCategoryFor(staffId, 'regular').nombre;
  const goodLabel = staffCategoryFor(staffId, 'bueno').nombre;
  const eliteLabel = staffCategoryFor(staffId, 'elite').nombre;
  const next = wins < good ? `Nivel ${goodLabel}: faltan ${good - wins} victoria(s)` : wins < elite ? `Nivel ${eliteLabel}: faltan ${elite - wins} victoria(s)` : 'Todas las categorías desbloqueadas';
  return `<div class="card blocker" style="margin-bottom:12px"><p class="label">Progreso del club fundador</p><strong>${wins} victorias</strong><p class="muted small">Al inicio sólo está disponible el nivel ${escapeHtml(regularLabel)}. ${escapeHtml(goodLabel)} se habilita con ${good} victorias y ${escapeHtml(eliteLabel)} con ${elite}. ${escapeHtml(next)}.</p></div>`;
}
function openStaffHireModal(staffId, after=null){
  if(!game) return;
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('staff')){ showNotice(managerChallengeBlockedMessage('staff')); return; }
  const def = staffDefinition(staffId);
  if(!def){ showNotice('Empleado no disponible.'); return; }
  if(staffActive(staffId)){ showNotice(`${def.nombre} ya está contratado esta temporada.`); return; }
  const cards = staffCategories().map(baseCategory => {
    const cat = staffCategoryFor(staffId, baseCategory.id);
    const cost = staffHireCost(staffId, cat.id);
    const personalAcademyStaff = staffId === 'youth_preparer';
    const unlock = personalAcademyStaff ? { restricted:false, requiredWins:0, wins:0, unlocked:true, remaining:0 } : staffCategoryUnlockInfo(cat.id);
    const budgetBlocked = personalAcademyStaff ? !managerCanAffordAcademy(cost) : (game.budget || 0) < cost;
    const disabled = budgetBlocked || !unlock.unlocked;
    const status = !unlock.unlocked
      ? `Bloqueado · requiere ${unlock.requiredWins} victorias (${unlock.remaining} restantes)`
      : budgetBlocked ? (personalAcademyStaff ? 'Saldo personal insuficiente' : 'Presupuesto insuficiente') : 'Contrato por temporada';
    const cadence = staffId === 'assistant_coach'
      ? `<span class="staff-tier-cadence">Nuevo análisis cada ${Math.max(1, Math.round(Number(def.diasAnalisisPorCategoria?.[cat.id] || ASSISTANT_COACH_ANALYSIS_DAYS?.[cat.id] || 25)))} días</span>`
      : '';
    return `<button class="staff-tier-card ${disabled ? 'disabled' : ''}" data-hire-staff-tier="${escapeHtml(staffId)}:${escapeHtml(cat.id)}" ${disabled ? 'disabled' : ''}>
      <span class="pill">${escapeHtml(cat.nombre)}</span>
      <strong>${formatMoney(cost)}</strong>
      ${cadence}
      <small>${escapeHtml(status)}</small>
    </button>`;
  }).join('');
  openModal(`<div class="staff-hire-modal">
    <h2>Contratar ${escapeHtml(def.nombre)}</h2>
    <p class="muted">Elegí una categoría para esta temporada.</p>
    ${staffId === 'youth_preparer' ? '' : founderStaffUnlockSummaryMarkup(staffId)}
    <div class="staff-tier-grid">${cards}</div>
  </div>`);
  document.querySelectorAll('[data-hire-staff-tier]').forEach(btn => btn.addEventListener('click', () => {
    const [id, category] = String(btn.dataset.hireStaffTier || '').split(':');
    hireStaffEmployee(id, category, after);
  }));
}
function hireStaffEmployee(staffId, categoryId='regular', after=null){
  if(!game) return;
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('staff')){ showNotice(managerChallengeBlockedMessage('staff')); return; }
  const def = staffDefinition(staffId);
  if(!def) return;
  if(staffActive(staffId)){ showNotice(`${def.nombre} ya está contratado esta temporada.`); return; }
  const cat = staffCategoryFor(staffId, categoryId);
  const personalAcademyStaff = staffId === 'youth_preparer';
  const unlock = personalAcademyStaff ? { restricted:false, requiredWins:0, wins:0, unlocked:true, remaining:0 } : staffCategoryUnlockInfo(cat.id);
  if(!unlock.unlocked){
    showNotice(`La categoría ${cat.nombre} requiere ${unlock.requiredWins} victorias con el club fundador. Llevás ${unlock.wins}.`);
    return;
  }
  const cost = staffHireCost(staffId, cat.id);
  if(personalAcademyStaff ? !managerCanAffordAcademy(cost) : (game.budget || 0) < cost){ showNotice(personalAcademyStaff ? 'Saldo personal insuficiente para contratar este empleado de Academia.' : 'Presupuesto insuficiente para contratar este empleado.'); return; }
  if(personalAcademyStaff) recordAcademyPersonalExpense(cost, `Contratación de ${def.nombre} ${cat.nombre}`, { type:`academy_staff_${staffId}`, category:cat.id });
  else recordBudgetChange(-cost, `Contratación de ${def.nombre} ${cat.nombre}`, { type:`staff_${staffId}`, category:cat.id });
  const contracts = personalAcademyStaff ? academyStaffContractsState() : (game.staffContracts = normalizeStaffContracts(game.staffContracts || {}));
  contracts[staffId] = {
    active:true,
    season:game.seasonNumber || 1,
    category:cat.id,
    cost,
    performanceMultiplier:cat.multiplicadorRendimiento,
    hiredTurn:currentTurnIndex(),
    hiredGlobalTurn:Number(game.globalTurn || 0)
  };
  game.staffActions = game.staffActions || {};
  if(staffId === 'kinesiologist') game.staffActions.kinesiologist = { active:true, category:cat.id, ...turnStamp() };
  if(staffId === 'youth_preparer'){
    game.academy = normalizeAcademyState(game.academy);
    game.academy.youthPreparer = { active:true, category:cat.id, season:game.seasonNumber || 1, hiredTurn:currentTurnIndex() };
  }
  if(staffId === 'assistant_coach' && typeof initializeAssistantCoachAnalysisAfterHire === 'function') initializeAssistantCoachAnalysisAfterHire(cat.id);
  closeModal();
  saveLocal(true);
  if(typeof after === 'function') after(); else renderAll();
  showNotice(`${def.nombre} ${cat.nombre} contratado por esta temporada.`);
  if(personalAcademyStaff) showAcademyFirstActionIntroduction(`academy_staff_${staffId}`);
}
function staffCostLabel(staffId){ return `Desde ${formatMoney(staffHireCost(staffId, 'regular'))}`; }

function resetAcademySeasonState(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  if(game.academy.youthPreparer){ game.academy.youthPreparer.active = false; }
  game.academy.staffContracts = normalizeStaffContracts(game.academy.staffContracts || {});
  if(game.academy.staffContracts.youth_preparer) game.academy.staffContracts.youth_preparer.active = false;
  game.academy.lastConsultTurn = null;
  game.academy.lastConsultReveal = null;
  game.academy.exceptionalYouthGrantedSeason = null;
  game.academy.exceptionalYouthGrantedCount = 0;
  game.academy.exceptionalYouthTargetSeason = null;
  game.academy.exceptionalYouthTargetCount = 0;
  resetAcademyGrowthForSeason();
  resetAcademyYouthInjurySeason();
}
function resetAcademyYouthInjurySeason(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const min = ACADEMY_YOUTH_INJURIES_MIN_PER_SEASON;
  const max = ACADEMY_YOUTH_INJURIES_MAX_PER_SEASON;
  const target = max > min ? min + hashNumber(`academy-injury-target-${game.seasonNumber || 1}-${Date.now()}-${Math.random()}`, max - min + 1) : min;
  game.academy.youthInjurySeason = Number(game.seasonNumber || 1);
  game.academy.youthInjuriesTarget = target;
  game.academy.youthInjuriesCount = 0;
}
function ensureAcademyYouthInjurySeason(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  if(Number(game.academy.youthInjurySeason || 0) !== Number(game.seasonNumber || 1) || game.academy.youthInjuriesTarget === null){
    resetAcademyYouthInjurySeason();
  }
}

function academyCreationMaxOverall(age){
  const minAge = Number.isFinite(Number(typeof ACADEMY_YOUTH_MIN_AGE !== 'undefined' ? ACADEMY_YOUTH_MIN_AGE : 12)) ? Number(ACADEMY_YOUTH_MIN_AGE) : 12;
  const base = Number.isFinite(Number(typeof ACADEMY_YOUTH_CREATION_MAX_BASE !== 'undefined' ? ACADEMY_YOUTH_CREATION_MAX_BASE : 30)) ? Number(ACADEMY_YOUTH_CREATION_MAX_BASE) : 30;
  const bonus = Number.isFinite(Number(typeof ACADEMY_YOUTH_CREATION_AGE_BONUS !== 'undefined' ? ACADEMY_YOUTH_CREATION_AGE_BONUS : 3)) ? Number(ACADEMY_YOUTH_CREATION_AGE_BONUS) : 3;
  const yearsBonus = Math.max(0, Math.round(Number(age || minAge)) - minAge + bonus);
  return clamp(Math.round(base + yearsBonus), 1, 99);
}
function academySeasonGrowthLimit(player, season=game?.seasonNumber || 1){
  const exceptional = Boolean(player?.exceptional);
  const min = exceptional ? (typeof ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MIN !== 'undefined' ? ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MIN : 15) : (typeof ACADEMY_YOUTH_SEASON_GROWTH_MIN !== 'undefined' ? ACADEMY_YOUTH_SEASON_GROWTH_MIN : 7);
  const max = exceptional ? (typeof ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MAX !== 'undefined' ? ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MAX : 20) : (typeof ACADEMY_YOUTH_SEASON_GROWTH_MAX !== 'undefined' ? ACADEMY_YOUTH_SEASON_GROWTH_MAX : 11);
  const cleanMin = Math.max(0, Math.round(Number(min || 0)));
  const cleanMax = Math.max(cleanMin, Math.round(Number(max || cleanMin)));
  return cleanMin + hashNumber(`academy-growth-limit-${player?.id || 0}-${season}-${exceptional ? 'x' : 'n'}`, cleanMax - cleanMin + 1);
}
function academyUncappedProjectedOverall(player){ return rawVisibleOverall(academyTempPlayer(player)); }
function ensureAcademyGrowthState(player){
  if(!player || player.status && player.status !== 'academy') return player;
  const season = Number(game?.seasonNumber || player.growthSeason || 1);
  if(Number(player.growthSeason || 0) !== season || !Number.isFinite(Number(player.seasonStartOverall)) || !Number.isFinite(Number(player.seasonGrowthLimit))){
    const current = clamp(Math.round(Number(player.overall || academyUncappedProjectedOverall(player) || 1)), 1, 99);
    const limit = academySeasonGrowthLimit(player, season);
    player.growthSeason = season;
    player.seasonStartOverall = current;
    player.seasonGrowthLimit = limit;
    player.seasonMaxOverall = clamp(current + limit, 1, 99);
  } else {
    player.seasonStartOverall = clamp(Math.round(Number(player.seasonStartOverall || player.overall || 1)), 1, 99);
    player.seasonGrowthLimit = Math.max(0, Math.round(Number(player.seasonGrowthLimit || 0)));
    player.seasonMaxOverall = clamp(Math.round(Number(player.seasonMaxOverall || (player.seasonStartOverall + player.seasonGrowthLimit))), 1, 99);
  }
  return player;
}
function academyGrowthCapOverall(player){
  ensureAcademyGrowthState(player);
  return clamp(Math.round(Number(player?.seasonMaxOverall || 99)), 1, 99);
}
function resetAcademyGrowthForSeason(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  let count = 0;
  academyActivePlayers().forEach(player => {
    const current = academyProjectedOverall(player);
    player.growthSeason = Number(game.seasonNumber || 1);
    player.seasonStartOverall = current;
    player.seasonGrowthLimit = academySeasonGrowthLimit(player, game.seasonNumber || 1);
    player.seasonMaxOverall = clamp(player.seasonStartOverall + player.seasonGrowthLimit, 1, 99);
    player.overall = current;
    count += 1;
  });
  return count;
}
function normalizeAcademyPlayer(player){
  if(!player) return null;
  const group = normalizeAcademyGroup(player.group || player.role || player.positionGroup);
  const minAge = Number.isFinite(Number(typeof ACADEMY_YOUTH_MIN_AGE !== 'undefined' ? ACADEMY_YOUTH_MIN_AGE : 12)) ? Number(ACADEMY_YOUTH_MIN_AGE) : 12;
  const finalAge = Number.isFinite(Number(typeof ACADEMY_YOUTH_FINAL_ACADEMY_AGE !== 'undefined' ? ACADEMY_YOUTH_FINAL_ACADEMY_AGE : 17)) ? Number(ACADEMY_YOUTH_FINAL_ACADEMY_AGE) : 17;
  const age = clamp(Math.round(Number(player.age || minAge)), minAge, Math.max(finalAge, minAge));
  const id = Number(player.id || nextAcademyPlayerId());
  const rawOverall = clamp(Math.round(Number(player.overall || player.media || 12)), 1, 99);
  const skills = player.skills && typeof player.skills === 'object' ? { ...player.skills } : academySkillsFor(group, rawOverall, id);
  skills.resistencia = clamp(Math.round(Number(skills.resistencia || (1 + hashNumber(`academy-res-${id}`, 9)))), 1, 99);
  const injuredThroughTurn = Math.max(0, Math.round(Number(player.injuredThroughTurn || 0)));
  const normalized = {
    ...player,
    id,
    name:player.name || academyName(id),
    nationality:player.nationality || academyNationality(id),
    age,
    group,
    overall:rawOverall,
    skills,
    status:player.status || 'academy',
    injuredThroughTurn,
    injuryStartTurn:Math.max(0, Math.round(Number(player.injuryStartTurn || 0))),
    injuryName:injuredThroughTurn > currentTurnIndex() ? (player.injuryName || 'Molestia muscular') : '',
    injuryTreated:Boolean(player.injuryTreated && injuredThroughTurn > currentTurnIndex()),
    injuriesSeason:Math.max(0, Math.round(Number(player.injuriesSeason || 0)))
  };
  ensureAcademyGrowthState(normalized);
  normalized.overall = academyProjectedOverall(normalized);
  return normalized;
}
function normalizeAcademyGroup(group){
  const raw = String(group || '').toUpperCase();
  if(['POR','ARQ'].includes(raw)) return 'POR';
  if(['DEF','DFC','LD','LI'].includes(raw)) return 'DEF';
  if(['MED','MID','MC','MCD','MCO','MI','MD'].includes(raw)) return 'MED';
  return 'DEL';
}
function academyGroupLabel(group){ return ({ POR:'POR', DEF:'DEF', MED:'MED', DEL:'DEL' })[normalizeAcademyGroup(group)] || 'MED'; }
function academyRepresentativePosition(group){
  const g = normalizeAcademyGroup(group);
  if(g === 'POR') return 'POR';
  if(g === 'DEF') return 'DFC';
  if(g === 'MED') return 'MC';
  return 'DC';
}
function academyExactPositions(group){
  const g = normalizeAcademyGroup(group);
  if(g === 'POR') return ['POR'];
  if(g === 'DEF') return ['DFC','LI','LD'];
  if(g === 'MED') return ['MC','MCO','MD','MI','MCD'];
  return ['DC','EI','ED'];
}
function academyActivePlayers(){
  game.academy = normalizeAcademyState(game.academy);
  return game.academy.players.filter(p => p.status === 'academy');
}
function academySortedPlayers(players){
  const list = Array.isArray(players) ? players.slice() : [];
  const mode = String(game?.academy?.sortMode || 'edad_asc');
  return list.sort((a,b) => {
    const pa = academyVisibleSkillsProgress(a).percent;
    const pb = academyVisibleSkillsProgress(b).percent;
    if(mode === 'edad_desc') return Number(b.age || 0) - Number(a.age || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' });
    if(mode === 'informe_desc') return pb - pa || Number(a.age || 0) - Number(b.age || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' });
    if(mode === 'informe_asc') return pa - pb || Number(a.age || 0) - Number(b.age || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' });
    return Number(a.age || 0) - Number(b.age || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' });
  });
}
const ACADEMY_YOUTH_VISUAL_PHASES = [
  { phase:1, max:29, label:'Grupo inicial' },
  { phase:2, max:49, label:'Academia pequeña' },
  { phase:3, max:79, label:'Academia en crecimiento' },
  { phase:4, max:109, label:'Academia consolidada' },
  { phase:5, max:139, label:'Academia amplia' },
  { phase:6, max:179, label:'Academia de alto volumen' },
  { phase:7, max:210, label:'Academia multitudinaria' }
];
function academyYouthVisualDefinition(count){
  const safeCount = Math.max(0, Math.round(Number(count || 0)));
  return ACADEMY_YOUTH_VISUAL_PHASES.find(item => safeCount <= item.max) || ACADEMY_YOUTH_VISUAL_PHASES.at(-1);
}
function academyYouthVisualPath(count){
  const definition = academyYouthVisualDefinition(count);
  const ranges = ['10-29','30-49','50-79','80-109','110-139','140-179','180-210'];
  return `assets/academia/academia-juveniles-fase-${String(definition.phase).padStart(2,'0')}-${ranges[definition.phase - 1]}.webp`;
}
function academyYouthVisualMarkup(count, capacity=academyCapacity()){
  const safeCount = Math.max(0, Math.round(Number(count || 0)));
  if(safeCount <= 0){
    return '<div class="game-visual-asset-empty academy-youth-visual-empty"><strong>Academia sin juveniles activos</strong><span>La sesión de entrenamiento aparecerá después de la primera captación.</span></div>';
  }
  const path = academyYouthVisualPath(safeCount);
  const badge = `${safeCount}/${Math.max(safeCount, Math.round(Number(capacity || 0)))} juveniles`;
  if(typeof stadiumVisualAssetMarkup === 'function'){
    return stadiumVisualAssetMarkup(path, `${safeCount} juveniles entrenando en Tu Academia`, {
      modifier:'academy-youth-occupancy-visual',
      badge
    });
  }
  return `<figure class="game-visual-asset academy-youth-occupancy-visual"><img src="${path}?v=8.73" alt="${safeCount} juveniles entrenando en Tu Academia" loading="lazy"><span class="game-visual-asset-badge">${badge}</span></figure>`;
}
function academySortControlsMarkup(){
  const mode = String(game?.academy?.sortMode || 'edad_asc');
  const option = (value, label) => `<option value="${value}" ${mode === value ? 'selected' : ''}>${label}</option>`;
  return `<div class="card academy-sort-card" style="margin-top:14px"><div class="row"><div><p class="label">Ordenar juveniles</p><h3>Listado de academia</h3></div><select id="academySortMode" class="compact-select">${option('edad_asc','Edad ↑ menor primero')}${option('edad_desc','Edad ↓ mayor primero')}${option('informe_desc','Informe descubierto ↓ mayor primero')}${option('informe_asc','Informe descubierto ↑ menor primero')}</select></div></div>`;
}
function academyResidenceCount(){
  game.academy = normalizeAcademyState(game.academy);
  return Math.max(0, Math.round(Number(game.academy.residences || 0)));
}
function academyResidenceVisualPath(count=academyResidenceCount()){
  const safeCount = clamp(Math.round(Number(count || 1)), 1, 10);
  return `assets/residencias/residencias-${String(safeCount).padStart(2,'0')}.webp`;
}
function academyResidenceVisualMarkup(count=academyResidenceCount()){
  const safeCount = clamp(Math.round(Number(count || 0)), 0, 10);
  if(safeCount <= 0) return '<div class="game-visual-asset-empty"><strong>Sin residencias alquiladas</strong><span>La imagen del complejo aparecerá con la primera residencia.</span></div>';
  if(typeof stadiumVisualAssetMarkup === 'function'){
    return stadiumVisualAssetMarkup(academyResidenceVisualPath(safeCount), `Complejo con ${safeCount} residencia${safeCount === 1 ? '' : 's'} juvenil${safeCount === 1 ? '' : 'es'}`, { modifier:'residence-visual', badge:`${safeCount}/10 residencias` });
  }
  return `<figure class="game-visual-asset residence-visual"><img src="${academyResidenceVisualPath(safeCount)}?v=8.73" alt="Complejo con ${safeCount} residencias juveniles" loading="lazy"></figure>`;
}
function academyResidenceLimit(){
  return typeof youthTrainingResidenceLimit === 'function' ? Math.max(0, Math.round(Number(youthTrainingResidenceLimit() || 0))) : 0;
}
function academyCapacity(){
  return ACADEMY_BASE_CAPACITY + (academyResidenceCount() * ACADEMY_RESIDENCE_CAPACITY);
}
function academyAvailableSlots(){
  return Math.max(0, academyCapacity() - academyActivePlayers().length);
}
function rentAcademyResidence(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const cost = ACADEMY_RESIDENCE_MONTHLY_COST;
  const currentResidences = academyResidenceCount();
  const residenceLimit = academyResidenceLimit();
  if(currentResidences >= residenceLimit){
    const level = typeof youthTrainingGroundLevel === 'function' ? youthTrainingGroundLevel() : 0;
    showNotice(level > 0 ? `El predio juvenil nivel ${level} permite hasta ${residenceLimit} residencia(s). Mejoralo para habilitar más lugares.` : 'Necesitás construir el predio juvenil nivel 1 para habilitar residencias.');
    return;
  }
  if(!managerCanAffordAcademy(cost)){ showNotice('Saldo personal insuficiente para alquilar una residencia.'); return; }
  const nextResidences = currentResidences + 1;
  const today = typeof currentCalendarDate === 'function' ? currentCalendarDate() : (game.currentDate || dateForSeasonState(game));
  game.academy.residences = nextResidences;
  game.academy.residenceLastChargeDate = today;
  recordAcademyPersonalExpense(cost, 'Alquiler mensual de residencia juvenil', { type:'academy_residence_rent', residences:nextResidences });
  saveLocal(true);
  if(typeof renderAll === 'function') renderAll(); else renderAcademy();
  showNotice(`Residencia alquilada. Residencias: ${nextResidences}. Cupo juvenil: ${academyCapacity()}.`);
  showAcademyFirstActionIntroduction('academy_residence_rent');
}
function cancelAcademyResidence(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const currentResidences = academyResidenceCount();
  if(currentResidences <= 0){ showNotice('No hay residencias alquiladas para cancelar.'); return; }
  const freeSlots = academyAvailableSlots();
  const requiredFreeSlots = Math.max(1, ACADEMY_RESIDENCE_CAPACITY);
  if(freeSlots < requiredFreeSlots){
    showNotice(`Para cancelar una residencia necesitás al menos ${requiredFreeSlots} cupos juveniles libres. Cupos libres actuales: ${freeSlots}.`);
    return;
  }
  const nextResidences = Math.max(0, currentResidences - 1);
  game.academy.residences = nextResidences;
  if(game.academy.residences <= 0) game.academy.residenceLastChargeDate = null;
  saveLocal(true);
  if(typeof renderAll === 'function') renderAll(); else renderAcademy();
  showNotice(`Se canceló una residencia. Residencias: ${nextResidences}. Cupo juvenil: ${academyCapacity()}.`);
}
function processAcademyResidenceRent(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  const residences = academyResidenceCount();
  if(residences <= 0 || ACADEMY_RESIDENCE_MONTHLY_COST <= 0) return 0;
  const today = validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
  if(!game.academy.residenceLastChargeDate){
    game.academy.residenceLastChargeDate = today;
    return 0;
  }
  const elapsed = daysBetweenIsoDates(game.academy.residenceLastChargeDate, today);
  if(elapsed < ACADEMY_RESIDENCE_MONTH_DAYS) return 0;
  const months = Math.max(1, Math.floor(elapsed / ACADEMY_RESIDENCE_MONTH_DAYS));
  const total = residences * ACADEMY_RESIDENCE_MONTHLY_COST * months;
  recordAcademyPersonalExpense(total, 'Alquiler mensual de residencias juveniles', { type:'academy_residence_monthly', residences, months });
  game.academy.residenceLastChargeDate = addDaysToIsoDate(game.academy.residenceLastChargeDate, months * ACADEMY_RESIDENCE_MONTH_DAYS);
  return total;
}
function nextAcademyPlayerId(){
  const ids = [0]
    .concat((seed?.players || []).map(p => Number(p.id) || 0))
    .concat((game?.marketPlayers || []).map(p => Number(p.id) || 0))
    .concat((game?.academy?.players || []).map(p => Number(p.id) || 0));
  return Math.max(...ids) + 1;
}
function academyLocalCountry(){
  game.academy = normalizeAcademyState(game.academy);
  if(game.academy.homeCountry) return game.academy.homeCountry;
  const club = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId || 0));
  game.academy.homeCountry = club ? clubCountry(club) : 'Argentina';
  return game.academy.homeCountry;
}
function academyNationality(id, options={}){
  if(options.local === true) return localNationalityForCountry(academyLocalCountry());
  return pickNationalityForGeneration(id, `academy-${game?.seasonNumber || 1}`, null, { localCountry:academyLocalCountry() }) || localNationalityForCountry(academyLocalCountry());
}
function academyNameForCountry(id, country='Argentina'){
  const nationality = localNationalityForCountry(country) || country || 'Argentina';
  if(typeof playerNameForNationality === 'function') return playerNameForNationality(id, nationality, `academy-${game?.seasonNumber || 1}`);
  return generatedPlayerName(id, `academy-${game?.seasonNumber || 1}`, nationality);
}
function academyName(id, country='Argentina'){
  return academyNameForCountry(id, country);
}
function academyOverallRoll(id, age=null){
  const maxByAge = academyCreationMaxOverall(age || ACADEMY_YOUTH_MIN_AGE || 12);
  const roll = hashNumber(`academy-overall-band-${game?.seasonNumber || 1}-${id}-${Math.random()}`, 1000) / 1000;
  let value;
  if(roll < 0.80) value = 1 + hashNumber(`academy-overall-low-${id}-${Math.random()}`, 19);
  else if(roll < 0.90) value = 20 + hashNumber(`academy-overall-mid-${id}-${Math.random()}`, 11);
  else value = 30 + hashNumber(`academy-overall-high-${id}-${Math.random()}`, 11);
  return clamp(value, 1, maxByAge);
}
function academyGroupRoll(id){
  const roll = hashNumber(`academy-group-${game?.seasonNumber || 1}-${id}-${Math.random()}`, 100);
  if(roll < 10) return 'POR';
  if(roll < 40) return 'DEF';
  if(roll < 70) return 'MED';
  return 'DEL';
}
function academySkillsFor(group, overall, id){
  const mapped = normalizeAcademyGroup(group) === 'MED' ? 'MID' : normalizeAcademyGroup(group) === 'DEL' ? 'ATT' : normalizeAcademyGroup(group);
  const skills = skillsForGroup(mapped, clamp(Number(overall || 10), 1, 40), id);
  skills.resistencia = 1 + hashNumber(`academy-res-init-${id}`, 9);
  return skills;
}
function academyTempPlayer(player){
  return { id:player.id, name:player.name, age:player.age, nationality:player.nationality, position:academyRepresentativePosition(player.group), overall:player.overall, skills:player.skills || academySkillsFor(player.group, player.overall, player.id) };
}
function academyVisibleStats(player){ return visibleStats(academyTempPlayer(player), rawVisibleSkill); }
function academyProjectedOverall(player){
  const raw = academyUncappedProjectedOverall(player);
  if(!player || player.status && player.status !== 'academy') return raw;
  return Math.min(raw, academyGrowthCapOverall(player));
}
function academyExceptionalYouthSeasonTarget(){
  const facilityBonus = typeof youthTrainingExceptionalBonus === 'function' ? youthTrainingExceptionalBonus() : 0;
  return clamp(1 + Math.max(0, Math.round(Number(facilityBonus || 0))), 1, 6);
}
function academyExceptionalYouthSeasonStatus(){
  game.academy = normalizeAcademyState(game.academy);
  const season = Number(game?.seasonNumber || 1);
  const resolved = Number(game.academy.exceptionalYouthTargetSeason || game.academy.exceptionalYouthGrantedSeason || 0) === season;
  const currentTarget = academyExceptionalYouthSeasonTarget();
  const storedTarget = clamp(Math.round(Number(game.academy.exceptionalYouthTargetCount || game.academy.exceptionalYouthGrantedCount || 0)), 0, 6);
  const target = resolved ? Math.max(1, storedTarget || currentTarget) : currentTarget;
  const granted = Number(game.academy.exceptionalYouthGrantedSeason || 0) === season
    ? clamp(Math.round(Number(game.academy.exceptionalYouthGrantedCount || 0)), 0, target)
    : 0;
  return { season, resolved, target, granted, currentTarget, missingSlots:resolved ? 0 : Math.max(0, target - academyAvailableSlots()) };
}
function startAcademyScouting(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const exceptionalStatus = academyExceptionalYouthSeasonStatus();
  const availableSlots = academyAvailableSlots();
  if(availableSlots <= 0){ showNotice('No hay lugares disponibles en la academia. Alquilá residencias o liberá cupos antes de captar juveniles.'); return; }
  if(!exceptionalStatus.resolved && availableSlots < exceptionalStatus.target){
    showNotice(`La primera captación de la temporada entregará ${exceptionalStatus.target} juvenil(es) excepcional(es). Necesitás ${exceptionalStatus.target} cupos libres y actualmente tenés ${availableSlots}.`);
    return;
  }
  if(!managerCanAffordAcademy(ACADEMY_SCOUTING_COST)){ showNotice('Saldo personal insuficiente para hacer una captación.'); return; }
  recordAcademyPersonalExpense(ACADEMY_SCOUTING_COST, 'Captación de talentos', { type:'academy_scouting_start' });
  const count = ACADEMY_PLAYERS_MIN + Math.floor(Math.random() * (ACADEMY_PLAYERS_MAX - ACADEMY_PLAYERS_MIN + 1));
  const job = { id:`cap-${Date.now()}-${Math.round(Math.random()*9999)}`, startedTurn:currentTurnIndex(), dueTurn:currentTurnIndex() + ACADEMY_SCOUTING_TURNS, count, status:'pending' };
  game.academy.scoutingJobs.push(job);
  const exceptionalYouth = grantSeasonalExceptionalAcademyYouth();
  saveLocal(true);
  renderAcademy();
  showNotice(exceptionalYouth.length ? `Captación iniciada. La primera captación de la temporada incorporó ${exceptionalYouth.length} juvenil(es) excepcional(es).` : 'Captación iniciada. El informe llegará en 35 días.');
  showAcademyFirstActionIntroduction('academy_scouting_start');
}
function createAcademyBatch(count){
  const players = [];
  let id = nextAcademyPlayerId();
  for(let i=0;i<count;i++, id++){
    const group = academyGroupRoll(id);
    const minAge = Number.isFinite(Number(typeof ACADEMY_YOUTH_MIN_AGE !== 'undefined' ? ACADEMY_YOUTH_MIN_AGE : 12)) ? Number(ACADEMY_YOUTH_MIN_AGE) : 12;
    const maxAge = Number.isFinite(Number(typeof ACADEMY_YOUTH_MAX_CREATION_AGE !== 'undefined' ? ACADEMY_YOUTH_MAX_CREATION_AGE : 16)) ? Number(ACADEMY_YOUTH_MAX_CREATION_AGE) : 16;
    const age = minAge + hashNumber(`academy-age-${game?.seasonNumber || 1}-${id}-${Math.random()}`, Math.max(1, maxAge - minAge + 1));
    const overall = academyOverallRoll(id, age);
    const nationality = academyNationality(id);
    players.push(normalizeAcademyPlayer({
      id,
      name:academyName(id, nationality),
      nationality,
      age,
      group,
      overall,
      skills:academySkillsFor(group, overall, id),
      status:'academy',
      joinedSeason:game?.seasonNumber || 1,
      joinedTurn:currentTurnIndex()
    }));
  }
  return players;
}

function createExceptionalAcademyYouth(){
  const id = nextAcademyPlayerId();
  const group = academyGroupRoll(id);
  const span = Math.max(0, ACADEMY_EXCEPTIONAL_YOUTH_MAX_OVERALL - ACADEMY_EXCEPTIONAL_YOUTH_MIN_OVERALL);
  const overall = clamp(ACADEMY_EXCEPTIONAL_YOUTH_MIN_OVERALL + hashNumber(`academy-exceptional-overall-${game?.seasonNumber || 1}-${id}-${Math.random()}`, span + 1), 1, academyCreationMaxOverall(ACADEMY_EXCEPTIONAL_YOUTH_AGE));
  return normalizeAcademyPlayer({
    id,
    name:academyName(id, academyLocalCountry()),
    nationality:academyNationality(id, { local:true }),
    age:ACADEMY_EXCEPTIONAL_YOUTH_AGE,
    group,
    overall,
    skills:academySkillsFor(group, overall, id),
    status:'academy',
    exceptional:true,
    source:'captacion_excepcional_temporada',
    joinedSeason:game?.seasonNumber || 1,
    joinedTurn:currentTurnIndex()
  });
}
function grantSeasonalExceptionalAcademyYouth(){
  if(!game?.academy || !ACADEMY_EXCEPTIONAL_YOUTH_ENABLED) return [];
  game.academy = normalizeAcademyState(game.academy);
  const status = academyExceptionalYouthSeasonStatus();
  if(status.resolved) return [];
  if(academyAvailableSlots() < status.target) return [];
  const players = [];
  for(let i=0; i<status.target; i+=1){
    const player = createExceptionalAcademyYouth();
    game.academy.players.push(player);
    players.push(player);
  }
  game.academy.exceptionalYouthTargetSeason = status.season;
  game.academy.exceptionalYouthTargetCount = status.target;
  game.academy.exceptionalYouthGrantedSeason = status.season;
  game.academy.exceptionalYouthGrantedCount = players.length;
  if(players.length){
    const facilityBonus = Math.max(0, status.target - 1);
    const names = players.map(player => `${player.name} (${academyGroupLabel(player.group)})`).join(', ');
    pushGameMessage({
      type:'academia',
      title:players.length === 1 ? 'Juvenil excepcional incorporado' : `${players.length} juveniles excepcionales incorporados`,
      body:`La primera captación de la temporada incorporó ${names}. Ya pueden entrenarse en academia o firmar contrato profesional.${facilityBonus ? ` El predio juvenil aportó ${facilityBonus} juvenil(es) adicional(es), para un total de ${status.target}.` : ''}`,
      priority:'normal'
    });
  }
  return players;
}
function processAcademyScoutingArrivals(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  let added = 0;
  let lost = 0;
  game.academy.scoutingJobs.forEach(job => {
    if(job.status !== 'pending') return;
    if(Number(job.dueTurn || 0) > currentTurnIndex()) return;
    const requested = clamp(Number(job.count || 0), ACADEMY_PLAYERS_MIN, ACADEMY_PLAYERS_MAX);
    const available = academyAvailableSlots();
    if(available <= 0){
      job.status = 'completed_lost';
      job.completedTurn = currentTurnIndex();
      job.lostPlayers = requested;
      lost += requested;
      return;
    }
    const accepted = Math.min(requested, available);
    const batch = createAcademyBatch(requested).slice(0, accepted);
    game.academy.players.push(...batch);
    job.status = accepted >= requested ? 'completed' : 'completed_partial';
    job.completedTurn = currentTurnIndex();
    job.addedPlayers = batch.length;
    job.lostPlayers = Math.max(0, requested - batch.length);
    added += batch.length;
    lost += job.lostPlayers;
  });
  if(added > 0 || lost > 0){
    game.academy.lastArrivalTurn = currentTurnIndex();
    const parts = [];
    if(added > 0) parts.push(`La academia recibió ${added} juveniles para evaluar.`);
    if(lost > 0) parts.push(`${lost} juveniles se perdieron por falta de lugar.`);
    pushGameMessage({ type:'academia', title:'Informe de captación recibido', body:parts.join(' '), priority:lost > 0 ? 'high' : 'normal' });
  }
  return added;
}


function academyPlayerInjured(player){
  return Number(player?.injuredThroughTurn || 0) > currentTurnIndex();
}
function academyYouthInjuryTurnsLeft(player){
  return Math.max(0, Math.round(Number(player?.injuredThroughTurn || 0) - currentTurnIndex()));
}
function academyYouthInjuryLabel(player){
  const turns = academyYouthInjuryTurnsLeft(player);
  if(turns <= 0) return '';
  return `${player.injuryName || 'Lesión juvenil'} · ${formatDaysFromTurns(turns)}`;
}
function clearRecoveredAcademyYouthInjuries(){
  if(!game?.academy) return 0;
  let recovered = 0;
  academyActivePlayers().forEach(player => {
    if(Number(player.injuredThroughTurn || 0) > 0 && Number(player.injuredThroughTurn || 0) <= currentTurnIndex()){
      const injuryLabel = String(player.injuryName || 'su lesión');
      const recoveryKey = `youth:${Number(player.id || 0)}:${Number(player.injuryStartTurn || player.injuredThroughTurn || 0)}:${injuryLabel}`;
      player.injuredThroughTurn = 0;
      player.injuryStartTurn = 0;
      player.injuryName = '';
      player.injuryTreated = false;
      recovered += 1;
      if(typeof pushFullyRecoveredInjuryMessage === 'function') pushFullyRecoveredInjuryMessage({
        kind:'youth',
        playerId:Number(player.id || 0),
        playerName:player.name || 'Juvenil',
        injuryLabel,
        recoveryKey,
        source:'academy_natural_recovery'
      });
    }
  });
  return recovered;
}
function academySeasonProgressRatio(){
  const total = Math.max(1, (game?.fixtures || []).length || 30);
  const current = clamp(Number(game?.matchdayIndex || 0), 0, total);
  return clamp(current / total, 0, 1);
}
function processAcademyYouthInjuries(){
  if(!game?.academy) return 0;
  ensureAcademyYouthInjurySeason();
  clearRecoveredAcademyYouthInjuries();
  const target = Math.max(0, Math.round(Number(game.academy.youthInjuriesTarget || 0)));
  if(target <= 0) return 0;
  const count = Math.max(0, Math.round(Number(game.academy.youthInjuriesCount || 0)));
  if(count >= target) return 0;
  const progress = academySeasonProgressRatio();
  const due = Math.min(target, Math.floor((progress * target) + 0.15));
  const randomPush = Math.random() < 0.06;
  const forcedEndSeason = progress >= 0.88;
  if(due <= count && !randomPush && !forcedEndSeason) return 0;
  const candidates = academyActivePlayers().filter(player => !academyPlayerInjured(player));
  if(!candidates.length) return 0;
  const player = candidates[hashNumber(`academy-injury-pick-${game.seasonNumber || 1}-${currentTurnIndex()}-${Math.random()}`, candidates.length)];
  const names = ['sobrecarga muscular','esguince leve','molestia en la rodilla','contractura fuerte','dolor en el aductor','golpe en el tobillo'];
  const duration = rnd(ACADEMY_YOUTH_INJURY_MIN_TURNS, ACADEMY_YOUTH_INJURY_MAX_TURNS);
  player.injuryName = names[hashNumber(`academy-injury-name-${player.id}-${currentTurnIndex()}-${Math.random()}`, names.length)];
  player.injuryStartTurn = currentTurnIndex();
  player.injuredThroughTurn = currentTurnIndex() + duration;
  player.injuryTreated = false;
  player.injuriesSeason = Math.max(0, Math.round(Number(player.injuriesSeason || 0))) + 1;
  game.academy.youthInjuriesCount = count + 1;
  pushGameMessage({ type:'academia', priority:'normal', title:'Juvenil lesionado', body:`${player.name} sufrió ${player.injuryName}. Mientras esté lesionado no entrenará habilidades.` });
  return 1;
}
function kinesiologistTreatmentCategory(){
  return String(staffContract('kinesiologist')?.category || game?.staffActions?.kinesiologist?.category || 'regular');
}
function kinesiologistTreatmentSuccessChance(){
  const category = kinesiologistTreatmentCategory();
  return clamp(Number(KINESIOLOGIST_SUCCESS_CHANCE_BY_CATEGORY?.[category] ?? (1 - KINESIOLOGIST_FAILURE_CHANCE)), 0, 1);
}
function kinesiologistTreatmentPlansState(kind='first'){
  if(kind === 'youth'){
    game.academy = normalizeAcademyState(game.academy);
    return game.academy.treatmentPlans;
  }
  game.staffActions = game.staffActions || {};
  const current = game.staffActions.kinesiologistTreatmentPlans;
  game.staffActions.kinesiologistTreatmentPlans = current && typeof current === 'object' && !Array.isArray(current) ? current : {};
  return game.staffActions.kinesiologistTreatmentPlans;
}
function kinesiologistInjurySignature(playerId, kind='first'){
  if(kind === 'youth'){
    const player = game?.academy?.players?.find(item => Number(item.id) === Number(playerId));
    if(!player || !academyPlayerInjured(player)) return '';
    return `youth:${player.id}:${Number(player.injuryStartTurn || 0)}:${String(player.injuryName || 'lesion')}`;
  }
  if(!isInjured(playerId)) return '';
  const status = playerStatus(playerId);
  return `first:${Number(playerId)}:${Number(status.injuredAtTurn || status.injuredAtMatchday || 0)}:${String(status.injuryLabel || 'lesion')}`;
}
function kinesiologistDiagnosedInjuryDays(playerId, kind='first'){
  if(kind === 'youth'){
    const player = game?.academy?.players?.find(item => Number(item.id) === Number(playerId));
    if(!player) return 0;
    const start = Number(player.injuryStartTurn || currentTurnIndex());
    const until = Number(player.injuredThroughTurn || currentTurnIndex());
    return Math.max(1, Math.round(until - start) || academyYouthInjuryTurnsLeft(player));
  }
  const status = playerStatus(playerId);
  const start = Number(status.injuredAtTurn);
  const until = Number(status.injuredUntilTurn);
  if(Number.isFinite(start) && Number.isFinite(until) && until > start) return Math.max(1, Math.round(until - start));
  return Math.max(1, Math.round(turnsRemaining(playerId)));
}
function kinesiologistTreatmentPlan(playerId, kind='first'){
  const signature = kinesiologistInjurySignature(playerId, kind);
  if(!signature) return null;
  const plan = kinesiologistTreatmentPlansState(kind)[`${kind}:${Number(playerId)}`];
  return plan && plan.signature === signature ? plan : null;
}
function kinesiologistTreatmentCourseCost(playerId, kind='first'){
  return Math.max(0, kinesiologistDiagnosedInjuryDays(playerId, kind) * KINESIOLOGIST_AUTO_TREATMENT_COST_PER_DAY);
}
function ensureKinesiologistTreatmentCourse(playerId, kind='first', options={}){
  if(!staffActive('kinesiologist')) return { ok:false, reason:'no_kinesiologist', message:'Primero tenés que contratar al kinesiólogo.' };
  const signature = kinesiologistInjurySignature(playerId, kind);
  if(!signature) return { ok:false, reason:'not_injured', message:'El jugador no está lesionado.' };
  const key = `${kind}:${Number(playerId)}`;
  const plans = kinesiologistTreatmentPlansState(kind);
  if(plans[key]?.signature === signature) return { ok:true, plan:plans[key], charged:0 };
  const days = kinesiologistDiagnosedInjuryDays(playerId, kind);
  const cost = Math.max(0, days * KINESIOLOGIST_AUTO_TREATMENT_COST_PER_DAY);
  if(kind === 'youth'){
    if(cost > 0 && !managerCanAffordAcademy(cost)) return { ok:false, reason:'insufficient_personal', cost, message:`Saldo personal insuficiente. El tratamiento completo cuesta ${formatMoney(cost)}.` };
    if(cost > 0) recordAcademyPersonalExpense(cost, `Tratamiento automático juvenil`, { type:'academy_youth_injury_treatment_auto', playerId:Number(playerId), injuryDays:days, costPerDay:KINESIOLOGIST_AUTO_TREATMENT_COST_PER_DAY });
  }else{
    if(cost > 0 && Number(game.budget || 0) < cost) return { ok:false, reason:'insufficient_budget', cost, message:`Presupuesto insuficiente. El tratamiento completo cuesta ${formatMoney(cost)}.` };
    const player = playerById(playerId);
    if(cost > 0) recordBudgetChange(-cost, `Tratamiento automático: ${player?.name || 'jugador lesionado'}`, { type:'kinesiologist_auto_treatment', playerId:Number(playerId), injuryDays:days, costPerDay:KINESIOLOGIST_AUTO_TREATMENT_COST_PER_DAY });
  }
  const plan = {
    playerId:Number(playerId), kind, signature, diagnosedDays:days, cost, payer:kind === 'youth' ? 'manager' : 'club',
    startedDate:validIsoDate(game.currentDate) ? game.currentDate : '', startedTurn:currentTurnIndex(),
    category:kinesiologistTreatmentCategory(), attempts:0, successes:0, failures:0, active:true
  };
  plans[key] = plan;
  return { ok:true, plan, charged:cost };
}
function applyAcademyYouthKinesioReduction(playerId, reduction){
  const player = game?.academy?.players?.find(item => Number(item.id) === Number(playerId) && item.status === 'academy');
  if(!player || !academyPlayerInjured(player)) return false;
  const injuryLabel = String(player.injuryName || 'su lesión');
  const recoveryKey = `youth:${Number(player.id || 0)}:${Number(player.injuryStartTurn || player.injuredThroughTurn || 0)}:${injuryLabel}`;
  const nextUntil = Number(player.injuredThroughTurn || 0) - Math.max(1, Math.round(Number(reduction || 1)));
  if(nextUntil <= currentTurnIndex()){
    player.injuredThroughTurn = 0;
    player.injuryStartTurn = 0;
    player.injuryName = '';
    player.injuryTreated = true;
    if(typeof pushFullyRecoveredInjuryMessage === 'function') pushFullyRecoveredInjuryMessage({
      kind:'youth',
      playerId:Number(player.id || 0),
      playerName:player.name || 'Juvenil',
      injuryLabel,
      recoveryKey,
      source:'academy_kinesiologist_recovery'
    });
  }else{
    player.injuredThroughTurn = nextUntil;
    player.injuryTreated = true;
  }
  return true;
}
function treatAcademyYouthInjuryCore(playerId, options={}){
  const outcome = applyKinesioTreatment(playerId, 'youth', options);
  return { ...outcome, player:game?.academy?.players?.find(item => Number(item.id) === Number(playerId)) || null };
}
function treatAcademyYouthInjury(playerId){
  const result = treatAcademyYouthInjuryCore(playerId);
  if(!result.applied){ showNotice(result.message || 'No se pudo tratar al juvenil.'); return; }
  saveLocal(true);
  renderAcademy();
  showNotice(result.fullyRecovered
    ? 'Tratamiento aplicado. El juvenil recibió el alta médica.'
    : 'Tratamiento aplicado. Se informará cuando el juvenil se recupere por completo.');
}
function academyInjuredTreatmentItems(){
  if(!game?.academy) return [];
  game.academy = normalizeAcademyState(game.academy);
  return academyActivePlayers().filter(player => academyPlayerInjured(player)).map(player => ({
    kind:'youth',
    player,
    remaining:academyYouthInjuryTurnsLeft(player),
    status:{ injuryLabel:player.injuryName || 'Lesión juvenil' }
  }));
}

function normalizeAcademyYouthTransferOffer(raw){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const status = ['pending','accepted','rejected','expired','cancelled'].includes(String(raw.status || '')) ? String(raw.status) : 'pending';
  const amount = clamp(Math.round(Number(raw.amount || raw.grossAmount || 0)), ACADEMY_YOUTH_OFFER_MIN_VALUE, ACADEMY_YOUTH_OFFER_MAX_VALUE);
  const taxRate = clamp(Number(raw.taxRate ?? ACADEMY_YOUTH_SALE_TAX_RATE), 0, 0.95);
  return {
    ...raw,
    id:String(raw.id || `academy-youth-offer-${Date.now()}-${Math.round(Math.random()*99999)}`),
    playerId:Number(raw.playerId || 0),
    buyerClubId:Number(raw.buyerClubId || raw.clubId || 0),
    buyerPosition:String(raw.buyerPosition || ''),
    amount,
    taxRate,
    taxAmount:Math.max(0, Math.round(Number(raw.taxAmount ?? amount * taxRate))),
    netAmount:Math.max(0, Math.round(Number(raw.netAmount ?? amount * (1 - taxRate)))),
    createdDate:validIsoDate(raw.createdDate) ? raw.createdDate : (game?.currentDate || ''),
    expiresDate:validIsoDate(raw.expiresDate) ? raw.expiresDate : addDaysToIsoDate(validIsoDate(raw.createdDate) ? raw.createdDate : (game?.currentDate || currentCalendarDate()), ACADEMY_YOUTH_OFFER_EXPIRE_DAYS),
    resolvedDate:validIsoDate(raw.resolvedDate) ? raw.resolvedDate : '',
    season:Math.max(1, Math.round(Number(raw.season || game?.seasonNumber || 1))),
    status
  };
}
function academyYouthTransferOffers(status='pending'){
  game.academy = normalizeAcademyState(game.academy);
  const list = game.academy.youthTransferOffers || [];
  return status ? list.filter(item => item.status === status) : list.slice();
}
function academyYouthOfferForPlayer(playerId){
  return academyYouthTransferOffers('pending').find(item => Number(item.playerId) === Number(playerId)) || null;
}
function academyYouthOfferCountForPlayerSeason(playerId, season=game?.seasonNumber || 1){
  const all = (game?.academy?.youthTransferOffers || []).concat(game?.academy?.youthTransferHistory || []);
  return all.filter(item => Number(item.playerId) === Number(playerId) && Number(item.season || 0) === Number(season)).length;
}
function academyYouthLastRejectedOffer(playerId){
  const all = (game?.academy?.youthTransferOffers || []).concat(game?.academy?.youthTransferHistory || []);
  return all.filter(item => Number(item.playerId) === Number(playerId) && item.status === 'rejected' && validIsoDate(item.resolvedDate)).sort((a,b)=>String(b.resolvedDate).localeCompare(String(a.resolvedDate)))[0] || null;
}
function academyYouthPlayerEligibleForOffers(player){
  if(!ACADEMY_YOUTH_MARKET_ENABLED || !player || player.status !== 'academy') return false;
  if(Number(player.age || 0) !== Number(ACADEMY_YOUTH_OFFER_AGE)) return false;
  if(academyYouthOfferForPlayer(player.id)) return false;
  if(academyYouthOfferCountForPlayerSeason(player.id) >= ACADEMY_YOUTH_MAX_OFFERS_PER_PLAYER_SEASON) return false;
  const rejected = academyYouthLastRejectedOffer(player.id);
  if(rejected && daysBetweenIsoDates(rejected.resolvedDate, game.currentDate || currentCalendarDate()) < ACADEMY_YOUTH_OFFER_REJECTION_COOLDOWN_DAYS) return false;
  return true;
}
function academyYouthGroupToRoleGroup(group){
  const clean = normalizeAcademyGroup(group);
  return clean === 'MED' ? 'MID' : clean === 'DEL' ? 'ATT' : clean;
}
function academyYouthBotNeedForGroup(club, group){
  if(!club) return 0;
  const managerEmployedAtSelectedClub = !(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive());
  if(managerEmployedAtSelectedClub && Number(club.id) === Number(game?.selectedClubId || 0)) return 0;
  if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(club)) return 0;
  const squad = playersByClub(Number(club.id)).filter(player => !player.retired && !player.sold && !player.freeAgent);
  if(squad.length >= MAX_PLAYERS_PER_CLUB) return 0;
  const roleGroup = academyYouthGroupToRoleGroup(group);
  const counts = typeof rosterGroupCounts === 'function' ? rosterGroupCounts(squad) : { POR:0, DEF:0, MID:0, ATT:0 };
  const minimums = typeof minimumRosterRequirements === 'function' ? minimumRosterRequirements() : { POR:2, DEF:5, MID:5, ATT:3, total:20 };
  const developmentTargets = {
    POR:Math.max(Number(minimums.POR || 2), 2),
    DEF:Math.max(Number(minimums.DEF || 5), 7),
    MID:Math.max(Number(minimums.MID || 5), 7),
    ATT:Math.max(Number(minimums.ATT || 3), 5)
  };
  const groupShortage = Math.max(0, Number(developmentTargets[roleGroup] || 0) - Number(counts[roleGroup] || 0));
  const rosterShortage = Math.max(0, Number(ACADEMY_YOUTH_BOT_TARGET_ROSTER || 24) - squad.length);
  if(groupShortage <= 0 && rosterShortage <= 0) return 0;
  return (groupShortage * 3) + rosterShortage;
}
function academyYouthQualityFitsClub(player, club){
  const overall = clamp(Math.round(Number(academyProjectedOverall(player) || player?.overall || 1)), 1, 99);
  const reputation = typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : clamp(Math.round(Number(club?.reputation || 50)), 1, 99);
  const minimum = clamp(Math.round(8 + reputation * 0.30), 8, 42);
  return overall >= minimum;
}
function academyYouthOfferValue(player, club, needScore=1){
  const overall = clamp(Number(academyProjectedOverall(player) || player?.overall || 1), 1, 99);
  const progress = clamp((overall - 5) / 55, 0, 1);
  const curve = ACADEMY_YOUTH_OFFER_MIN_VALUE * Math.pow(Math.max(1, ACADEMY_YOUTH_OFFER_MAX_VALUE / Math.max(1, ACADEMY_YOUTH_OFFER_MIN_VALUE)), progress);
  const exceptionalFactor = player?.exceptional ? 1.25 : 1;
  const needFactor = clamp(0.90 + Number(needScore || 0) * 0.025, 0.90, 1.20);
  const reputation = typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : Number(club?.reputation || 50);
  const clubFactor = clamp(0.90 + reputation / 500, 0.90, 1.10);
  const injuryFactor = academyPlayerInjured(player) ? 0.90 : 1;
  const raw = curve * exceptionalFactor * needFactor * clubFactor * injuryFactor;
  return clamp(Math.round(raw / 1000) * 1000, ACADEMY_YOUTH_OFFER_MIN_VALUE, ACADEMY_YOUTH_OFFER_MAX_VALUE);
}
function academyYouthBuyerPosition(player, club){
  const options = academyExactPositions(player.group);
  if(options.length <= 1) return options[0] || academyRepresentativePosition(player.group);
  const squad = playersByClub(Number(club.id));
  const counts = Object.fromEntries(options.map(position => [position, squad.filter(item => item.position === position).length]));
  return options.slice().sort((a,b)=>Number(counts[a] || 0)-Number(counts[b] || 0) || a.localeCompare(b))[0];
}
function academyYouthBuyerCandidates(player){
  const roleGroup = academyYouthGroupToRoleGroup(player.group);
  const homeCountry = academyLocalCountry();
  return (seed?.clubs || []).map(club => {
    const need = academyYouthBotNeedForGroup(club, roleGroup);
    if(need <= 0 || !academyYouthQualityFitsClub(player, club)) return null;
    const amount = academyYouthOfferValue(player, club, need);
    const budget = Math.max(0, Math.round(Number(game?.clubBudgets?.[club.id] ?? club.budget ?? 0)));
    if(budget < amount) return null;
    const overall = academyProjectedOverall(player);
    const reputation = clubPrestigeValue(club);
    const fit = 100 - Math.abs((8 + reputation * 0.45) - overall);
    const countryBonus = clubCountry(club) === homeCountry ? 18 : 0;
    const score = need * 18 + fit + countryBonus + hashNumber(`academy-buyer-${game?.saveCode || ''}-${game?.currentDate || ''}-${player.id}-${club.id}`, 20);
    return { club, need, amount, score, position:academyYouthBuyerPosition(player, club) };
  }).filter(Boolean).sort((a,b)=>b.score-a.score || Number(a.club.id)-Number(b.club.id));
}
function expireAcademyYouthTransferOffers(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  const today = validIsoDate(game.currentDate) ? game.currentDate : currentCalendarDate();
  let expired = 0;
  game.academy.youthTransferOffers.forEach(offer => {
    if(offer.status !== 'pending') return;
    if(!validIsoDate(offer.expiresDate) || daysBetweenIsoDates(today, offer.expiresDate) >= 0) return;
    offer.status = 'expired';
    offer.resolvedDate = today;
    expired += 1;
  });
  if(expired){
    const resolved = game.academy.youthTransferOffers.filter(item => item.status !== 'pending');
    game.academy.youthTransferHistory.push(...resolved);
    game.academy.youthTransferOffers = game.academy.youthTransferOffers.filter(item => item.status === 'pending');
    game.academy.youthTransferHistory = game.academy.youthTransferHistory.slice(-300);
  }
  return expired;
}
function maybeGenerateAcademyYouthTransferOffer(){
  if(!ACADEMY_YOUTH_MARKET_ENABLED || !game?.academy) return null;
  game.academy = normalizeAcademyState(game.academy);
  const today = validIsoDate(game.currentDate) ? game.currentDate : currentCalendarDate();
  if(academyYouthTransferOffers('pending').length >= ACADEMY_YOUTH_MAX_PENDING_OFFERS) return null;
  if(game.academy.youthTransferLastAttemptDate && daysBetweenIsoDates(game.academy.youthTransferLastAttemptDate, today) < ACADEMY_YOUTH_OFFER_ATTEMPT_DAYS) return null;
  game.academy.youthTransferLastAttemptDate = today;
  const chanceRoll = hashNumber(`academy-youth-market-chance-${game?.saveCode || ''}-${today}-${game?.seasonNumber || 1}`, 10000) / 10000;
  if(chanceRoll >= ACADEMY_YOUTH_OFFER_ATTEMPT_CHANCE) return null;
  const candidates = academyActivePlayers().filter(academyYouthPlayerEligibleForOffers).map(player => ({ player, buyers:academyYouthBuyerCandidates(player) })).filter(item => item.buyers.length);
  if(!candidates.length) return null;
  candidates.sort((a,b)=>b.buyers[0].score-a.buyers[0].score || academyProjectedOverall(b.player)-academyProjectedOverall(a.player) || Number(a.player.id)-Number(b.player.id));
  const selectedIndex = hashNumber(`academy-youth-market-player-${game?.saveCode || ''}-${today}`, Math.min(candidates.length, 4));
  const selected = candidates[selectedIndex] || candidates[0];
  const buyerIndex = hashNumber(`academy-youth-market-club-${game?.saveCode || ''}-${today}-${selected.player.id}`, Math.min(selected.buyers.length, 3));
  const buyer = selected.buyers[buyerIndex] || selected.buyers[0];
  const amount = buyer.amount;
  const taxAmount = Math.round(amount * ACADEMY_YOUTH_SALE_TAX_RATE);
  const offer = normalizeAcademyYouthTransferOffer({
    id:`academy-youth-offer-${game.seasonNumber || 1}-${today}-${selected.player.id}-${buyer.club.id}`,
    playerId:selected.player.id,
    playerName:selected.player.name,
    playerGroup:normalizeAcademyGroup(selected.player.group),
    playerOverall:academyProjectedOverall(selected.player),
    buyerClubId:buyer.club.id,
    buyerPosition:buyer.position,
    amount,
    taxRate:ACADEMY_YOUTH_SALE_TAX_RATE,
    taxAmount,
    netAmount:amount-taxAmount,
    createdDate:today,
    expiresDate:addDaysToIsoDate(today, ACADEMY_YOUTH_OFFER_EXPIRE_DAYS),
    season:game.seasonNumber || 1,
    status:'pending'
  });
  game.academy.youthTransferOffers.push(offer);
  if(typeof pushGameMessage === 'function') pushGameMessage({ type:'academia', priority:'normal', title:'Oferta por juvenil de Academia', body:`${clubName(offer.buyerClubId)} ofreció ${formatMoney(offer.amount)} por ${selected.player.name}. La oferta vence el ${offer.expiresDate}.`, id:`academy-youth-offer-message-${offer.id}` });
  return offer;
}
function processAcademyYouthMarketDaily(){
  if(!game?.academy || !ACADEMY_YOUTH_MARKET_ENABLED) return { expired:0, created:null };
  const expired = expireAcademyYouthTransferOffers();
  const created = maybeGenerateAcademyYouthTransferOffer();
  return { expired, created };
}
function academyYouthOfferProfessionalPlayer(player, offer){
  const position = academyExactPositions(player.group).includes(offer.buyerPosition) ? offer.buyerPosition : academyRepresentativePosition(player.group);
  const official = {
    id:Number(player.id), name:player.name, age:player.age, nationality:player.nationality, position,
    clubId:Number(offer.buyerClubId), overall:clamp(academyProjectedOverall(player),1,99),
    skills:{ ...(player.skills || academySkillsFor(player.group, player.overall, player.id)) },
    freeAgent:false, sold:false, transferListed:false, intransferible:false,
    academyOrigin:true, academyManagerOrigin:true, academyPurchase:true,
    joinedClubSeason:Number(game.seasonNumber || 1), salaryPaidCount:0, lastSalaryPaidSeason:0
  };
  official.salary = initialAnnualSalaryForMedia(official.overall, 0.35);
  refreshPlayerClause(official);
  seed.players = (seed.players || []).filter(item => Number(item.id) !== Number(official.id));
  seed.players.push(official);
  game.playerCondition[official.id] = 70;
  game.playerMorale[official.id] = PLAYER_MORALE_START;
  delete game.playerSkillBoosts[official.id];
  game.playerAgeSkillPenalties = (game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties)) ? game.playerAgeSkillPenalties : {};
  delete game.playerAgeSkillPenalties[official.id];
  game.playerStats[official.id] = typeof createEmptyPlayerStat === 'function' ? createEmptyPlayerStat(official) : { playerId:official.id, clubId:official.clubId, played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  game.playerCareerStats[official.id] = typeof createEmptyPlayerStat === 'function' ? createEmptyPlayerStat(official) : { playerId:official.id, clubId:official.clubId, played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
  return official;
}
function cancelAcademyYouthOffersForPlayer(playerId, reason='player_unavailable'){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  const today = validIsoDate(game.currentDate) ? game.currentDate : currentCalendarDate();
  const cancelled = game.academy.youthTransferOffers.filter(item => item.status === 'pending' && Number(item.playerId) === Number(playerId));
  cancelled.forEach(item => { item.status='cancelled'; item.resolvedDate=today; item.cancelReason=String(reason || 'player_unavailable'); });
  if(cancelled.length){
    game.academy.youthTransferHistory.push(...cancelled.map(item => ({ ...item })));
    game.academy.youthTransferHistory = game.academy.youthTransferHistory.slice(-300);
    game.academy.youthTransferOffers = game.academy.youthTransferOffers.filter(item => !(item.status === 'cancelled' && Number(item.playerId) === Number(playerId)));
  }
  return cancelled.length;
}
function resolveAcademyYouthTransferOffer(offerId, decision='reject'){
  if(!game?.academy) return false;
  game.academy = normalizeAcademyState(game.academy);
  const offer = game.academy.youthTransferOffers.find(item => String(item.id) === String(offerId) && item.status === 'pending');
  if(!offer) return false;
  const player = game.academy.players.find(item => Number(item.id) === Number(offer.playerId) && item.status === 'academy');
  const today = validIsoDate(game.currentDate) ? game.currentDate : currentCalendarDate();
  if(!player){ offer.status='cancelled'; offer.resolvedDate=today; }
  else if(decision === 'accept'){
    const club = seed?.clubs?.find(item => Number(item.id) === Number(offer.buyerClubId));
    if(!club){ showNotice('El club comprador ya no está disponible.'); return false; }
    if(!hasFirstTeamRosterSpace(club.id, 1)){ showNotice(`${club.name} ya no tiene lugar en su plantel.`); return false; }
    game.clubBudgets = (game.clubBudgets && typeof game.clubBudgets === 'object' && !Array.isArray(game.clubBudgets)) ? game.clubBudgets : {};
    const buyerBudget = Math.max(0, Math.round(Number(game.clubBudgets[club.id] ?? club.budget ?? 0)));
    if(buyerBudget < offer.amount){ showNotice(`${club.name} ya no dispone del dinero ofrecido.`); return false; }
    game.clubBudgets[club.id] = buyerBudget - offer.amount;
    const official = academyYouthOfferProfessionalPlayer(player, offer);
    player.status = 'sold';
    player.soldTurn = currentTurnIndex();
    player.soldClubId = club.id;
    player.soldAmount = offer.amount;
    offer.status = 'accepted';
    offer.resolvedDate = today;
    offer.taxAmount = Math.round(offer.amount * offer.taxRate);
    offer.netAmount = offer.amount - offer.taxAmount;
    if(game.academy.unlockedStats) delete game.academy.unlockedStats[player.id];
    if(game.academy.trainingPlan) delete game.academy.trainingPlan[player.id];
    recordManagerFinanceChange(offer.netAmount, `Venta juvenil: ${player.name}`, { type:'academy_youth_sale', academyIncome:true, playerId:player.id, buyerClubId:club.id, grossAmount:offer.amount, federationTax:offer.taxAmount, offerId:offer.id });
    recordAcademyCareerProgress({ sales:1, directSaleIncome:offer.netAmount });
    if(typeof ensurePlayerStateForAll === 'function') ensurePlayerStateForAll();
    if(typeof pushGameMessage === 'function') pushGameMessage({ type:'academia', priority:'normal', title:'Venta de juvenil confirmada', body:`${player.name} firmó con ${club.name}. Ingresaron ${formatMoney(offer.netAmount)} a tu Cuenta Bancaria después del impuesto federativo de ${formatMoney(offer.taxAmount)}.`, id:`academy-youth-sale-${offer.id}` });
    showNotice(`${official.name} fue vendido a ${club.name}. Recibiste ${formatMoney(offer.netAmount)} netos.`);
  }else{
    offer.status = 'rejected';
    offer.resolvedDate = today;
    if(typeof pushGameMessage === 'function') pushGameMessage({ type:'academia', priority:'normal', title:'Oferta juvenil rechazada', body:`Rechazaste la propuesta de ${clubName(offer.buyerClubId)} por ${player?.name || offer.playerName || 'el juvenil'}.`, id:`academy-youth-reject-${offer.id}` });
    showNotice('Oferta juvenil rechazada.');
  }
  game.academy.youthTransferHistory.push({ ...offer });
  game.academy.youthTransferHistory = game.academy.youthTransferHistory.slice(-300);
  game.academy.youthTransferOffers = game.academy.youthTransferOffers.filter(item => String(item.id) !== String(offer.id));
  saveLocal(true);
  if(activeTab === 'academy') renderAcademy(); else renderAll();
  return true;
}
function academyYouthOffersMarkup(){
  const offers = academyYouthTransferOffers('pending').slice().sort((a,b)=>String(a.expiresDate).localeCompare(String(b.expiresDate)) || Number(b.amount)-Number(a.amount));
  if(!offers.length) return '<p class="muted">No hay ofertas pendientes por juveniles de 17 años.</p>';
  return `<div class="academy-youth-offers-grid">${offers.map(offer => {
    const player = game.academy.players.find(item => Number(item.id) === Number(offer.playerId));
    const daysLeft = Math.max(0, daysBetweenIsoDates(game.currentDate || currentCalendarDate(), offer.expiresDate));
    return `<article class="card academy-youth-offer-card">
      <div class="row"><div><p class="label">${escapeHtml(clubDivision(offer.buyerClubId)?.name || 'Club comprador')}</p><h3>${escapeHtml(clubName(offer.buyerClubId))}</h3></div><span class="pill ${daysLeft <= 1 ? 'warn' : ''}">${daysLeft} día(s)</span></div>
      <div class="academy-youth-offer-player"><strong>${escapeHtml(player?.name || offer.playerName || 'Juvenil')}</strong><span>${escapeHtml(academyGroupLabel(player?.group || offer.playerGroup))} · ${Number(player?.age || ACADEMY_YOUTH_OFFER_AGE)} años · Media ${Math.round(Number(offer.playerOverall || academyProjectedOverall(player) || 0))}</span></div>
      <div class="academy-youth-offer-money"><div><span>Oferta</span><strong>${formatMoney(offer.amount)}</strong></div><div><span>Impuesto federativo</span><strong class="bad">-${formatMoney(offer.taxAmount)}</strong></div><div><span>Ingreso neto</span><strong class="ok">${formatMoney(offer.netAmount)}</strong></div></div>
      <div class="row academy-youth-offer-actions"><button class="primary" data-accept-academy-youth-offer="${escapeHtml(offer.id)}">Aceptar</button><button class="ghost" data-reject-academy-youth-offer="${escapeHtml(offer.id)}">Rechazar</button></div>
    </article>`;
  }).join('')}</div>`;
}

function academyWeeklySalaryDueToday(today){
  if(!validIsoDate(today)) return false;
  const chargeDay = Number.isFinite(Number(typeof ACADEMY_PLAYER_WEEKLY_CHARGE_DAY !== 'undefined' ? ACADEMY_PLAYER_WEEKLY_CHARGE_DAY : 1)) ? Number(ACADEMY_PLAYER_WEEKLY_CHARGE_DAY) : 1;
  const localDate = new Date(`${today}T12:00:00`);
  if(Number(localDate.getDay()) !== chargeDay) return false;
  return game?.academy?.youthSalaryLastChargeDate !== today;
}
function academyTurnSalaryCost(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  const count = academyActivePlayers().length;
  if(!count) return 0;
  const today = typeof currentCalendarDate === 'function' ? currentCalendarDate() : (game.currentDate || dateForSeasonState(game));
  if(!academyWeeklySalaryDueToday(today)) return 0;
  const total = count * ACADEMY_PLAYER_TURN_COST;
  recordAcademyPersonalExpense(total, 'Sueldos semanales de academia', { type:'academy_weekly_salary', players:count, date:today });
  game.academy.youthSalaryLastChargeDate = today;
  return total;
}
function academyTrainingType(playerId){
  return game?.academy?.trainingPlan?.[playerId] === 'resistance' ? 'resistance' : 'technical';
}
function academyTrainingGainMultiplier(player){
  return player?.exceptional ? ACADEMY_EXCEPTIONAL_YOUTH_TRAINING_MULTIPLIER : ACADEMY_SKILL_GAIN_MULTIPLIER;
}
function applyAcademyTrainingEffects(){
  if(!game?.academy) return;
  let totalFormationPoints = 0;
  academyActivePlayers().forEach(player => {
    if(academyPlayerInjured(player)) return;
    player.skills = player.skills || academySkillsFor(player.group, player.overall, player.id);
    ensureAcademyGrowthState(player);
    const cap = academyGrowthCapOverall(player);
    if(academyUncappedProjectedOverall(player) >= cap){
      player.overall = academyProjectedOverall(player);
      return;
    }
    const type = academyTrainingType(player.id);
    const gainMultiplier = Math.max(1, Math.round(academyTrainingGainMultiplier(player)));
    const canApplySkillPoint = (skill) => {
      const previous = Math.round(Number(player.skills[skill] || 1));
      if(previous >= 99) return false;
      player.skills[skill] = clamp(previous + 1, 1, 99);
      if(player.skills[skill] === previous) return false;
      if(academyUncappedProjectedOverall(player) > cap){
        player.skills[skill] = previous;
        return false;
      }
      totalFormationPoints += 1;
      return true;
    };
    if(type === 'resistance'){
      const total = Math.max(1, Math.round(rnd(3,6) * gainMultiplier));
      for(let i=0;i<total;i++){
        if(!canApplySkillPoint('resistencia')) break;
      }
    } else {
      const skillNames = Object.keys(player.skills).filter(k => k !== 'porteria' || player.group === 'POR');
      for(let i=0;i<gainMultiplier;i++){
        if(academyUncappedProjectedOverall(player) >= cap) break;
        const skill = skillNames[hashNumber(`academy-train-${player.id}-${currentTurnIndex()}-${i}-${Math.random()}`, skillNames.length)];
        canApplySkillPoint(skill);
      }
    }
    player.overall = clamp(academyProjectedOverall(player), 1, 99);
  });
  if(totalFormationPoints > 0) recordAcademyCareerProgress({ trainingPoints:totalFormationPoints });
}
function processAcademyTurn(){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  processAcademyResidenceRent();
  processAcademyYouthInjuries();
  academyTurnSalaryCost();
  applyAcademyTrainingEffects();
  const youthMarket = processAcademyYouthMarketDaily();
  const added = processAcademyScoutingArrivals();
  const today = validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
  const lastNegativeNoticeDate = String(game.academy.lastNegativeBalanceNoticeDate || '');
  const negativeNoticeDue = !validIsoDate(lastNegativeNoticeDate)
    || !validIsoDate(today)
    || daysBetweenIsoDates(lastNegativeNoticeDate, today) >= 7;
  if(managerPersonalBalance() < 0 && negativeNoticeDue){
    game.academy.lastNegativeBalanceNoticeDate = today;
    if(typeof pushGameMessage === 'function') pushGameMessage({ type:'academia', priority:'high', title:'Academia en números rojos', body:`Tu Cuenta Bancaria continúa en ${formatMoney(managerPersonalBalance())}. Mientras el saldo sea negativo no podrás iniciar nuevas captaciones, obras, tratamientos o contrataciones.`, id:`academy-negative-${today}` });
  }
  if(activeTab === 'academy' && (added > 0 || youthMarket.created || youthMarket.expired > 0)) renderAcademy();
}
function academyYouthPreparerActive(){
  return staffActive('youth_preparer');
}
function hireYouthPreparer(){
  openStaffHireModal('youth_preparer', renderAcademy);
}
function academyLockedStatTargets(){
  const targets = [];
  academyActivePlayers().forEach(player => {
    const stats = Object.keys(academyVisibleStats(player));
    const unlocked = new Set(game.academy.unlockedStats[player.id] || []);
    stats.forEach(stat => { if(!unlocked.has(stat)) targets.push({ playerId:player.id, stat }); });
  });
  return targets;
}
function academyYouthExpertCardBonus(){
  return typeof specialActiveBonus === 'function'
    ? Math.max(0, Math.round(Number(specialActiveBonus('experto_juveniles') || 0)))
    : 0;
}
function consultAcademyPlayers(){
  if(!academyYouthPreparerActive()){ showNotice('Necesitás contratar al preparador de juveniles para consultar informes.'); return; }
  const turn = currentTurnIndex();
  if(Number(game.academy.lastConsultTurn) === turn){ showNotice('El preparador ya entregó un informe esta semana.'); return; }
  const targets = academyLockedStatTargets();
  if(!targets.length){ showNotice('No quedan habilidades ocultas por desbloquear en la academia.'); return; }
  const naturalRoll = 1 + Math.floor(Math.random() * 2);
  const baseAmount = Math.max(1, Math.round(naturalRoll * staffPerformanceMultiplier('youth_preparer') * ACADEMY_CONSULT_REVEAL_MULTIPLIER));
  const cardBonus = academyYouthExpertCardBonus();
  const requestedAmount = Math.max(1, baseAmount + cardBonus);
  const amount = Math.min(targets.length, requestedAmount);
  const revealed = [];
  for(let i=0;i<amount;i++){
    const remaining = academyLockedStatTargets();
    if(!remaining.length) break;
    const pick = remaining[hashNumber(`academy-consult-${turn}-${i}-${Math.random()}`, remaining.length)];
    game.academy.unlockedStats[pick.playerId] = game.academy.unlockedStats[pick.playerId] || [];
    if(!game.academy.unlockedStats[pick.playerId].includes(pick.stat)) game.academy.unlockedStats[pick.playerId].push(pick.stat);
    const p = game.academy.players.find(x => Number(x.id) === Number(pick.playerId));
    revealed.push(`${p?.name || 'Juvenil'}: ${pick.stat}`);
  }
  game.academy.lastConsultTurn = turn;
  game.academy.lastConsultReveal = {
    turn,
    revealed:revealed.slice(0,12),
    total:revealed.length,
    baseAmount,
    cardBonus,
    requestedAmount,
    createdAt:Date.now()
  };
  if(typeof awardSpecialPoints === 'function') awardSpecialPoints('consultar_juveniles', { revealed:revealed.length });
  recordAcademyCareerProgress({ consultations:1 });
  saveLocal(true);
  renderAcademy();
  const bonusText = cardBonus > 0 ? ` Base ${baseAmount} + cartas ${cardBonus}.` : '';
  showNotice(`Informe recibido: ${revealed.length} habilidad(es).${bonusText} ${revealed.join(' · ')}`);
}
function dismissAcademyPlayer(playerId){
  if(!game) return;
  game.academy = normalizeAcademyState(game.academy);
  const player = game.academy.players.find(p => Number(p.id) === Number(playerId) && p.status === 'academy');
  if(!player) return;
  if(!managerCanAffordAcademy(ACADEMY_DISMISS_COMPENSATION)){ showNotice('Saldo personal insuficiente para pagar la compensación.'); return; }
  if(!confirm(`Despedir a ${player.name} de la academia?`)) return;
  recordAcademyPersonalExpense(ACADEMY_DISMISS_COMPENSATION, 'Compensación por baja de academia', { type:'academy_dismiss', playerId });
  player.status = 'dismissed';
  player.dismissedTurn = currentTurnIndex();
  cancelAcademyYouthOffersForPlayer(player.id, 'dismissed');
  saveLocal(true);
  renderAcademy();
  showNotice(`${player.name} fue dado de baja de la academia.`);
}
function openPromoteAcademyModal(playerId){
  if(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive()){ showNotice('Necesitás estar contratado por un club para ofrecer un contrato profesional.'); return; }
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('players')){ showNotice(managerChallengeBlockedMessage('players')); return; }
  const player = academyActivePlayers().find(p => Number(p.id) === Number(playerId));
  if(!player) return;
  if(Number(player.age || 0) < 16){ showNotice('El juvenil todavía no tiene edad para firmar contrato profesional.'); return; }
  const options = academyExactPositions(player.group).map(pos => `<option value="${pos}">${pos} · ${escapeHtml(roleMeta(pos).name)}</option>`).join('');
  openModal(`<div class="purchase-offer-modal"><h2>Contrato profesional</h2><p class="muted">Fijá la posición definitiva de ${escapeHtml(player.name)} antes de subirlo al primer equipo.</p><label for="academyPromotePosition">Posición</label><select id="academyPromotePosition">${options}</select><div class="row" style="margin-top:14px"><button class="primary" id="btnConfirmPromoteAcademy">Subir al primer equipo</button></div></div>`);
  $('btnConfirmPromoteAcademy')?.addEventListener('click', () => promoteAcademyPlayer(playerId, $('academyPromotePosition')?.value));
}
function promoteAcademyPlayer(playerId, exactPosition){
  if(!game) return;
  if(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive()){ showNotice('Necesitás estar contratado por un club para ofrecer un contrato profesional.'); return; }
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('players')){ showNotice(managerChallengeBlockedMessage('players')); return; }
  game.academy = normalizeAcademyState(game.academy);
  const player = game.academy.players.find(p => Number(p.id) === Number(playerId) && p.status === 'academy');
  if(!player) return;
  if(Number(player.age || 0) < 16){ showNotice('El juvenil todavía no tiene edad para firmar contrato profesional.'); return; }
  if(!hasFirstTeamRosterSpace(game.selectedClubId, 1)){ showRosterLimitNotice(); return; }
  const allowed = academyExactPositions(player.group);
  const position = allowed.includes(exactPosition) ? exactPosition : allowed[0];
  const official = {
    id:player.id,
    name:player.name,
    age:player.age,
    nationality:player.nationality,
    position,
    clubId:game.selectedClubId,
    overall:clamp(academyProjectedOverall(player), 1, 99),
    skills:{ ...(player.skills || academySkillsFor(player.group, player.overall, player.id)) },
    freeAgent:false,
    academyOrigin:true,
    joinedClubSeason:game.seasonNumber || 1,
    salaryPaidCount:0,
    lastSalaryPaidSeason:0
  };
  official.salary = initialAnnualSalaryForMedia(official.overall, 0.40);
  refreshPlayerClause(official);
  seed.players = (seed.players || []).filter(p => Number(p.id) !== Number(official.id));
  seed.players.push(official);
  game.playerCondition[official.id] = 70;
  game.playerMorale[official.id] = PLAYER_MORALE_START;
  delete game.playerSkillBoosts[official.id];
  game.playerAgeSkillPenalties = (game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties)) ? game.playerAgeSkillPenalties : {};
  delete game.playerAgeSkillPenalties[official.id];
  game.trainingPlan[official.id] = safeIndividualTrainingType(TRAINING_INDIVIDUAL_INITIAL);
  game.playerStats[official.id] = typeof createEmptyPlayerStat === 'function' ? createEmptyPlayerStat(official) : { playerId:official.id, clubId:official.clubId, played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  game.playerCareerStats[official.id] = typeof createEmptyPlayerStat === 'function' ? createEmptyPlayerStat(official) : { playerId:official.id, clubId:official.clubId, played:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, injuries:0, keySaves:0, goalsConceded:0, cleanSheets:0, errors:0, goalErrors:0, ratingTotal:0, ratedMatches:0, lastRating:0 };
  player.status = 'promoted';
  player.promotedTurn = currentTurnIndex();
  recordAcademyCareerProgress({ promotions:1 });
  cancelAcademyYouthOffersForPlayer(player.id, 'promoted');
  player.promotedPosition = position;
  const cohesionChange = typeof adjustTeamCohesion === 'function' ? adjustTeamCohesion(game.selectedClubId, TEAM_COHESION_YOUTH_CONTRACT_GAIN) : 0;
  const cohesionText = cohesionChange ? ` Cohesión +${cohesionChange}.` : '';
  pushGameMessage({ type:'academia', title:'Juvenil promovido', body:`${official.name} firmó contrato profesional como ${position}.${cohesionText}`, priority:'normal' });
  closeModal();
  saveLocal(true);
  renderAll();
  showNotice(`${official.name} ya está en el primer equipo.${cohesionText}`);
}
function expireFinalSeasonAcademyPlayers(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  const finalAge = Number.isFinite(Number(typeof ACADEMY_YOUTH_FINAL_ACADEMY_AGE !== 'undefined' ? ACADEMY_YOUTH_FINAL_ACADEMY_AGE : 17)) ? Number(ACADEMY_YOUTH_FINAL_ACADEMY_AGE) : 17;
  const expired = [];
  game.academy.players.forEach(player => {
    if(player.status !== 'academy') return;
    if(Number(player.age || 0) >= finalAge){
      player.status = 'expired';
      player.expiredSeason = Number(game.seasonNumber || 1);
      player.expiredTurn = currentTurnIndex();
      cancelAcademyYouthOffersForPlayer(player.id, 'academy_age_limit');
      expired.push(player);
    }
  });
  if(expired.length){
    expired.forEach(player => {
      if(game.academy.unlockedStats) delete game.academy.unlockedStats[player.id];
      if(game.academy.trainingPlan) delete game.academy.trainingPlan[player.id];
    });
    const names = expired.slice(0,4).map(p => p.name).join(', ');
    pushGameMessage({
      type:'academia',
      title:'Juveniles dejaron la academia',
      body:`${expired.length} juvenil(es) de 17 años terminaron su última temporada sin contrato profesional${names ? `: ${names}${expired.length > 4 ? '...' : ''}` : ''}.`,
      priority:'high'
    });
  }
  return expired.length;
}
function applyAcademyAgingIfNeeded(){
  if(!game?.academy) return 0;
  game.academy = normalizeAcademyState(game.academy);
  expireFinalSeasonAcademyPlayers();
  let count = 0;
  game.academy.players.forEach(player => {
    if(player.status !== 'academy') return;
    player.age = Math.max(ACADEMY_YOUTH_MIN_AGE || 12, Number(player.age || 12) + 1);
    player.age = Math.min(player.age, ACADEMY_YOUTH_FINAL_ACADEMY_AGE || 17);
    count += 1;
  });
  return count;
}
function academyPendingJobsMarkup(){
  const jobs = (game.academy?.scoutingJobs || []).filter(j => j.status === 'pending');
  if(!jobs.length) return '<p class="muted">No hay captaciones en curso.</p>';
  return `<div class="academy-jobs">${jobs.map(job => `<div class="stat-rank"><span>Captación en curso</span><strong>${formatDays(daysUntilTurn(job.dueTurn || 0))}</strong></div>`).join('')}</div>`;
}
function academyVisibleSkillsProgress(player){
  const stats = academyVisibleStats(player);
  const labels = Object.keys(stats);
  const unlocked = new Set(game.academy?.unlockedStats?.[player.id] || []);
  const total = labels.length || 0;
  const visible = labels.filter(label => unlocked.has(label)).length;
  const percent = total ? Math.round((visible / total) * 100) : 0;
  return { total, visible, percent };
}
function academyVisibilityPieMarkup(player){
  const progress = academyVisibleSkillsProgress(player);
  const title = progress.total
    ? `${progress.visible}/${progress.total} habilidades visibles`
    : 'Sin habilidades para mostrar';
  return `<div class="academy-visibility" title="${escapeHtml(title)}">
    <div class="academy-visibility-pie" style="--academy-visible-pct:${progress.percent}"><strong>${progress.percent}%</strong></div>
    <div>
      <p class="label">Habilidades visibles</p>
      <strong>${progress.visible}/${progress.total}</strong>
      <p class="small muted">Informe descubierto</p>
    </div>
  </div>`;
}
function academyAverageVisibilityPieMarkup(activePlayers){
  const players = Array.isArray(activePlayers) ? activePlayers : [];
  if(!players.length){
    return `<div class="academy-visibility academy-visibility-average"><div class="academy-visibility-pie" style="--academy-visible-pct:0"><strong>0%</strong></div><div><p class="label">Habilidades visibles</p><strong>Sin juveniles</strong><p class="small muted">Promedio activo</p></div></div>`;
  }
  const progress = players.map(player => academyVisibleSkillsProgress(player));
  const avgPercent = Math.round(avg(progress.map(item => item.percent)) || 0);
  const totalVisible = progress.reduce((sum, item) => sum + Number(item.visible || 0), 0);
  const totalStats = progress.reduce((sum, item) => sum + Number(item.total || 0), 0);
  return `<div class="academy-visibility academy-visibility-average" title="${totalVisible}/${totalStats} habilidades visibles">
    <div class="academy-visibility-pie" style="--academy-visible-pct:${avgPercent}"><strong>${avgPercent}%</strong></div>
    <div>
      <p class="label">Habilidades visibles</p>
      <strong>${totalVisible}/${totalStats}</strong>
      <p class="small muted">Promedio de juveniles activos</p>
    </div>
  </div>`;
}
function academyPlayerStatsMarkup(player){
  const stats = academyVisibleStats(player);
  const unlocked = new Set(game.academy?.unlockedStats?.[player.id] || []);
  return `<div class="academy-hidden-stats">${Object.entries(stats).map(([label,value]) => `<div class="stat-rank"><span>${escapeHtml(label)}</span><strong>${unlocked.has(label) ? value : '—'}</strong></div>`).join('')}</div>`;
}

function academyGrowthStage(growthNow, growthLimit){
  const limit = Math.max(0, Number(growthLimit || 0));
  const current = Math.max(0, Number(growthNow || 0));
  const ratio = limit ? Math.min(1, current / limit) : 0;
  if(ratio >= 1){
    return { label:'Excelente', className:'excellent', bar:100 };
  }
  if(ratio >= 0.66){
    return { label:'Muy bueno', className:'very-good', bar:76 };
  }
  if(ratio >= 0.33){
    return { label:'Normal', className:'normal', bar:52 };
  }
  return { label:'Bajo', className:'low', bar:22 };
}
function academyGrowthSoftMarkup(growthNow, growthLimit){
  const stage = academyGrowthStage(growthNow, growthLimit);
  return `<div class="academy-growth-soft academy-growth-${stage.className}">
    <div class="stat-rank academy-growth-cap"><span>Crecimiento esta temporada</span><strong>${escapeHtml(stage.label)}</strong></div>
    <div class="academy-growth-soft-bar" aria-hidden="true"><span style="width:${stage.bar}%"></span></div>
  </div>`;
}
function academyPlayerCard(player){
  ensureAcademyGrowthState(player);
  const training = academyTrainingType(player.id);
  const employed = !(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive());
  const canPromote = employed && Number(player.age || 0) >= 16;
  const finalSeason = Number(player.age || 0) >= (typeof ACADEMY_YOUTH_FINAL_ACADEMY_AGE !== 'undefined' ? ACADEMY_YOUTH_FINAL_ACADEMY_AGE : 17);
  const injured = academyPlayerInjured(player);
  const injuryLabel = academyYouthInjuryLabel(player);
  const specialPill = player.exceptional ? '<span class="pill ok">Juvenil excepcional · x5</span>' : '<span class="pill">Media oculta</span>';
  const finalSeasonPill = finalSeason ? '<span class="pill warn">⚠ Última temporada</span>' : '';
  const injuryPill = injured ? '<span class="pill bad">Lesionado</span>' : '';
  const pendingOffer = academyYouthOfferForPlayer(player.id);
  const offerPill = pendingOffer ? `<span class="pill ok">Oferta ${formatMoney(pendingOffer.amount)}</span>` : '';
  const growthNow = Math.max(0, academyProjectedOverall(player) - Number(player.seasonStartOverall || academyProjectedOverall(player)));
  const growthLimit = Math.max(0, Number(player.seasonGrowthLimit || 0));
  return `<div class="card academy-player-card ${player.exceptional ? 'academy-player-special' : ''} ${injured ? 'academy-player-injured' : ''} ${finalSeason ? 'academy-player-final-season' : ''}">
    <div class="row academy-player-head"><div><p class="label">${academyGroupLabel(player.group)} · ${Number(player.age || 0)} años · ${nationalityShortMarkup(player.nationality)}</p><h3>${escapeHtml(player.name)}</h3></div><div class="row gap-sm">${specialPill}${finalSeasonPill}${injuryPill}${offerPill}</div></div>
    ${finalSeason ? '<div class="academy-injury-alert academy-final-season-alert"><strong>Última temporada en academia</strong><span>Si no firma contrato profesional antes del cambio de temporada, desaparece.</span></div>' : ''}
    ${injured ? `<div class="academy-injury-alert"><strong>${escapeHtml(injuryLabel)}</strong><span>No entrena habilidades hasta ser tratado o recuperarse.</span></div>` : ''}
    ${academyGrowthSoftMarkup(growthNow, growthLimit)}
    ${academyVisibilityPieMarkup(player)}
    ${academyPlayerStatsMarkup(player)}
    <div class="row academy-actions">
      <select data-academy-training="${player.id}" ${injured ? 'disabled' : ''}><option value="technical" ${training==='technical'?'selected':''}>Técnica</option><option value="resistance" ${training==='resistance'?'selected':''}>Resistencia</option></select>
      ${injured ? `<button class="primary small-btn" data-treat-academy-injury="${player.id}">Tratar hoy · ${formatMoney(kinesiologistTreatmentCourseCost(player.id, 'youth'))}</button>` : ''}
      <button class="ghost small-btn" data-dismiss-academy="${player.id}">Despedir</button>
      <button class="primary small-btn" data-promote-academy="${player.id}" ${canPromote ? '' : 'disabled'}>${canPromote ? 'Contrato profesional' : !employed ? 'Sin club' : 'Menor de 16'}</button>
    </div>
  </div>`;
}
function academyConsultAnimationMarkup(){
  const info = game?.academy?.lastConsultReveal;
  if(!info || Number(info.turn || -1) !== currentTurnIndex()) return '';
  const revealed = Array.isArray(info.revealed) ? info.revealed : [];
  if(!revealed.length) return '';
  const cardBonus = Math.max(0, Math.round(Number(info.cardBonus || 0)));
  const breakdown = cardBonus > 0 ? `<p class="small ok">Resultado normal ${Number(info.baseAmount || 0)} + cartas ${cardBonus}</p>` : '';
  return `<div class="academy-consult-animation"><div><p class="label">Informe actualizado</p><strong>${Number(info.total || revealed.length)} habilidad(es) revelada(s)</strong>${breakdown}</div><div class="academy-consult-revealed">${revealed.map(item => `<span>${escapeHtml(item)}</span>`).join('')}</div></div>`;
}
function academyResidenceManagementMarkup(){
  const activeCount = academyActivePlayers().length;
  const residences = academyResidenceCount();
  const residenceLimit = academyResidenceLimit();
  const capacity = academyCapacity();
  const availableSlots = academyAvailableSlots();
  return `<div class="card academy-residence-card">
    <div class="row"><div><p class="label">Residencias juveniles</p><h3>Cupos de academia</h3><p class="muted small">Base ${ACADEMY_BASE_CAPACITY} cupos. Cada residencia agrega ${ACADEMY_RESIDENCE_CAPACITY} cupos. El Predio habilita 2 residencias por nivel. El alquiler sale de la Cuenta Bancaria personal: ${formatMoney(ACADEMY_RESIDENCE_MONTHLY_COST)} mensuales por residencia.</p></div><span class="pill">${activeCount}/${capacity} ocupados</span></div>
    ${academyResidenceVisualMarkup(residences)}
    <div class="academy-residence-stats">
      <div><p class="label">Residencias alquiladas</p><strong>${residences}/${residenceLimit}</strong></div>
      <div><p class="label">Cupo total</p><strong>${capacity}</strong></div>
      <div><p class="label">Cupos libres</p><strong>${availableSlots}</strong></div>
    </div>
    <div class="row academy-improvement-actions"><button class="primary" id="btnRentAcademyResidence" ${residences < residenceLimit ? '' : 'disabled'}>Alquilar residencia</button><button class="ghost" id="btnCancelAcademyResidence" ${residences > 0 && availableSlots >= ACADEMY_RESIDENCE_CAPACITY ? '' : 'disabled'}>Cancelar alquiler de 1 residencia</button></div>
    ${residences > 0 && availableSlots < ACADEMY_RESIDENCE_CAPACITY ? `<p class="small warn">Para cancelar una residencia necesitás al menos ${ACADEMY_RESIDENCE_CAPACITY} cupos juveniles libres. Cupos libres actuales: ${availableSlots}.</p>` : ''}
    ${residences > residenceLimit ? `<p class="small warn">Esta partida conserva ${residences - residenceLimit} residencia(s) heredada(s) por encima del límite actual. No se eliminan, pero no se pueden alquilar nuevas hasta ampliar el predio.</p>` : residenceLimit <= 0 ? '<p class="small warn">Construí el Predio juvenil nivel 1 para habilitar las primeras 2 residencias.</p>' : residences >= residenceLimit ? `<p class="small muted">Límite actual alcanzado: ${residenceLimit} residencia(s). Cada nuevo nivel del Predio habilita 2 más.</p>` : `<p class="small muted">Podés alquilar ${residenceLimit - residences} residencia(s) adicional(es) con el nivel actual.</p>`}
  </div>`;
}
function bindCareerImprovementsActions(){
  document.querySelectorAll('[data-build-youth-facility]').forEach(btn => btn.addEventListener('click', () => startYouthTrainingGroundUpgrade(btn.dataset.buildYouthFacility)));
  $('btnRentAcademyResidence')?.addEventListener('click', rentAcademyResidence);
  $('btnCancelAcademyResidence')?.addEventListener('click', cancelAcademyResidence);
}
function renderCareerImprovements(){
  game.academy = normalizeAcademyState(game.academy);
  const personalBalance = managerPersonalBalance();
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Mejoras</h2><p class="tagline">Infraestructura personal del manager para ampliar y desarrollar Tu Academia.</p></div>
      <div class="row"><span class="pill">Saldo personal ${formatMoney(personalBalance)}</span><span class="pill">Cupo juvenil ${academyActivePlayers().length}/${academyCapacity()}</span></div>
    </div>
    <div class="card career-improvements-intro"><p class="label">Patrimonio del manager</p><p class="muted small">El Predio y las residencias se conservan al cambiar de club. Sus construcciones y alquileres se pagan exclusivamente desde la Cuenta Bancaria personal.</p></div>
    <div class="career-improvements-grid">
      <div class="academy-owned-facility">${youthTrainingFacilityMarkup()}</div>
      ${academyResidenceManagementMarkup()}
    </div>`;
  bindCareerImprovementsActions();
}

function renderAcademy(){
  game.academy = normalizeAcademyState(game.academy);
  const activeRaw = academyActivePlayers();
  const active = academySortedPlayers(activeRaw);
  const activePreparer = academyYouthPreparerActive();
  const salaryTurn = active.length * ACADEMY_PLAYER_TURN_COST;
  const personalBalance = managerPersonalBalance();
  const academyExpenses = academyFinanceHistory();
  const totalAcademyExpenses = academyExpenses.reduce((sum,item) => sum + Math.abs(Math.min(0, Number(item.delta || 0))), 0);
  const recentAcademyExpenses = academyExpenses.slice(-8).reverse();
  const capacity = academyCapacity();
  const availableSlots = academyAvailableSlots();
  const exceptionalStatus = academyExceptionalYouthSeasonStatus();
  const scoutingDisabled = !managerCanAffordAcademy(ACADEMY_SCOUTING_COST) || availableSlots <= 0 || (!exceptionalStatus.resolved && availableSlots < exceptionalStatus.target);
  const facilityExceptionalBonus = Math.max(0, exceptionalStatus.currentTarget - 1);
  const pendingYouthOffers = academyYouthTransferOffers('pending');
  const youthExpertBonus = academyYouthExpertCardBonus();
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Tu Academia</h2><p class="tagline">Preparador, captación, consulta y desarrollo de los juveniles del manager.</p></div>
      <div class="row"><span class="pill">Sede ${escapeHtml(academyLocalCountry())}</span><span class="pill">Saldo personal ${formatMoney(personalBalance)}</span></div>
    </div>
    ${academyYouthVisualMarkup(active.length, capacity)}
    <div class="grid cols-3 academy-owner-summary">
      <div class="card"><p class="label">Propietario</p><strong>Manager</strong><p class="muted small">La Academia no pertenece al club actual.</p></div>
      <div class="card"><p class="label">Gasto semanal juvenil</p><strong>${formatMoney(salaryTurn)}</strong></div>
      <div class="card"><p class="label">Gastos históricos</p><strong class="bad">${formatMoney(totalAcademyExpenses)}</strong></div>
    </div>
    <div class="card academy-control-center">
      <div class="academy-control-employee">
        <div><p class="label">Preparador de juveniles</p><h3>Empleado de Tu Academia</h3><p class="muted small">Su contrato se paga desde la Cuenta Bancaria personal y se conserva cuando cambiás de club.</p></div>
        <div class="academy-preparer-actions">${activePreparer ? staffContractCardMarkup('youth_preparer', 'mini') : `<button class="primary" id="btnHireYouthPreparer">Contratar · ${staffCostLabel('youth_preparer')}</button>`}</div>
      </div>
      <div class="academy-primary-actions">
        <button class="primary academy-main-action" id="btnAcademyScouting" ${scoutingDisabled ? 'disabled' : ''}><span>Hacer captación de talentos</span><small>${formatMoney(ACADEMY_SCOUTING_COST)} · informe en 35 días</small></button>
        <button class="primary academy-main-action" id="btnConsultAcademy" ${activePreparer ? '' : 'disabled'}><span>Consultar juveniles</span><small>${activePreparer ? `Informe semanal${youthExpertBonus > 0 ? ` · cartas +${youthExpertBonus}` : ''}` : 'Requiere Preparador de juveniles'}</small></button>
      </div>
      ${availableSlots <= 0 ? '<p class="small warn">Sin cupos disponibles. Administrá el Predio y las residencias desde Carrera → Mejoras.</p>' : (!exceptionalStatus.resolved && availableSlots < exceptionalStatus.target) ? `<p class="small warn">Reservá ${exceptionalStatus.target} cupos libres para recibir completa la cuota excepcional de la primera captación. Disponibles: ${availableSlots}. Gestioná los cupos desde Carrera → Mejoras.</p>` : ''}
      ${youthExpertBonus > 0 ? `<p class="small ok">Experto en juveniles activo: se suman +${youthExpertBonus} habilidad(es) al resultado normal de cada consulta.</p>` : ''}
    </div>
    ${academyConsultAnimationMarkup()}
    <div class="grid cols-3 academy-summary">
      <div class="card"><p class="label">Juveniles</p><div class="metric">${active.length}/${capacity}</div><p class="small muted">Lugares libres: ${availableSlots}</p></div>
      <div class="card academy-average-card">${academyAverageVisibilityPieMarkup(active)}</div>
      <div class="card"><p class="label">Captación</p><div class="metric small">${formatMoney(ACADEMY_SCOUTING_COST)}</div><p class="small ${exceptionalStatus.resolved ? 'ok' : 'muted'}">${exceptionalStatus.resolved ? `Excepcionales entregados: ${exceptionalStatus.granted}/${exceptionalStatus.target}` : `Primera captación: ${exceptionalStatus.target} excepcional(es)`}</p><p class="small muted">Predio y residencias: Carrera → Mejoras.</p></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Captaciones pendientes</h3>${academyPendingJobsMarkup()}</div>
    <section class="academy-youth-market-section" style="margin-top:14px">
      <div class="row section-title compact"><div><p class="label">Mercado juvenil</p><h3>Ofertas por juveniles</h3><p class="muted small">Los clubes bot pueden ofertar por juveniles de ${ACADEMY_YOUTH_OFFER_AGE} años cuando necesitan esa posición y el nivel actual encaja con su reputación.</p></div><span class="pill">${pendingYouthOffers.length} pendiente(s)</span></div>
      ${academyYouthOffersMarkup()}
    </section>
    <div class="card academy-rules-card" style="margin-top:14px"><p class="muted">Cada captación tarda 35 días y puede sumar entre 5 y 10 juveniles de ${ACADEMY_YOUTH_MIN_AGE} a ${ACADEMY_YOUTH_MAX_CREATION_AGE} años. La media máxima inicial depende de la edad. Los juveniles normales pueden subir entre ${ACADEMY_YOUTH_SEASON_GROWTH_MIN} y ${ACADEMY_YOUTH_SEASON_GROWTH_MAX} puntos de media por temporada; el juvenil excepcional puede subir entre ${ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MIN} y ${ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MAX}. Si no hay cupos al recibir el informe, los juveniles se pierden por falta de lugar. La primera captación de cada temporada entrega de una sola vez ${exceptionalStatus.currentTarget} juvenil(es) excepcional(es) de ${ACADEMY_EXCEPTIONAL_YOUTH_AGE} años: 1 base más ${facilityExceptionalBonus} por el Predio juvenil actual, con un máximo de 6. El Predio y las residencias se administran desde Carrera → Mejoras. Para iniciar esa primera captación deben existir cupos para toda la cuota. Las captaciones posteriores de la temporada no agregan más excepcionales. Son entrenables x5 y promovibles de inmediato. Con ${ACADEMY_YOUTH_FINAL_ACADEMY_AGE} años cursan su última temporada en academia: si no firman contrato profesional antes del cambio de temporada, desaparecen. Los juveniles pueden lesionarse entre ${ACADEMY_YOUTH_INJURIES_MIN_PER_SEASON} y ${ACADEMY_YOUTH_INJURIES_MAX_PER_SEASON} veces por temporada; mientras están lesionados no entrenan habilidades. Los juveniles cobran ${formatMoney(ACADEMY_PLAYER_TURN_COST)} por semana. Desde los ${ACADEMY_YOUTH_OFFER_AGE} años pueden recibir ofertas de clubes bot entre ${formatMoney(ACADEMY_YOUTH_OFFER_MIN_VALUE)} y ${formatMoney(ACADEMY_YOUTH_OFFER_MAX_VALUE)}; al aceptar, la federación retiene ${Math.round(ACADEMY_YOUTH_SALE_TAX_RATE * 100)}%. Despedir uno cuesta ${formatMoney(ACADEMY_DISMISS_COMPENSATION)}.</p></div>
    ${academySortControlsMarkup()}
    <div class="academy-grid" style="margin-top:14px">${active.length ? active.map(academyPlayerCard).join('') : '<div class="card"><p class="muted">Todavía no hay juveniles en la academia.</p></div>'}</div>
  `;
  $('btnAcademyScouting')?.addEventListener('click', startAcademyScouting);
  $('btnHireYouthPreparer')?.addEventListener('click', hireYouthPreparer);
  $('btnConsultAcademy')?.addEventListener('click', consultAcademyPlayers);
  bindStaffDismissButtons(renderAcademy);
  $('academySortMode')?.addEventListener('change', (event) => {
    game.academy.sortMode = event.target.value;
    saveLocal(true);
    renderAcademy();
  });
  document.querySelectorAll('[data-dismiss-academy]').forEach(btn => btn.addEventListener('click', () => dismissAcademyPlayer(Number(btn.dataset.dismissAcademy))));
  document.querySelectorAll('[data-promote-academy]').forEach(btn => btn.addEventListener('click', () => openPromoteAcademyModal(Number(btn.dataset.promoteAcademy))));
  document.querySelectorAll('[data-treat-academy-injury]').forEach(btn => btn.addEventListener('click', () => treatAcademyYouthInjury(Number(btn.dataset.treatAcademyInjury))));
  document.querySelectorAll('[data-accept-academy-youth-offer]').forEach(btn => btn.addEventListener('click', () => resolveAcademyYouthTransferOffer(btn.dataset.acceptAcademyYouthOffer, 'accept')));
  document.querySelectorAll('[data-reject-academy-youth-offer]').forEach(btn => btn.addEventListener('click', () => resolveAcademyYouthTransferOffer(btn.dataset.rejectAcademyYouthOffer, 'reject')));
  document.querySelectorAll('[data-academy-training]').forEach(select => select.addEventListener('change', () => {
    game.academy.trainingPlan[select.dataset.academyTraining] = select.value === 'resistance' ? 'resistance' : 'technical';
    saveLocal(true);
    showNotice('Entrenamiento juvenil actualizado.');
  }));
}

function kinesioTreatmentItems(){
  const firstTeam = injuredPlayersByClub(game.selectedClubId).map(item => ({ ...item, kind:'first' }));
  const youth = typeof academyInjuredTreatmentItems === 'function' ? academyInjuredTreatmentItems() : [];
  return firstTeam.concat(youth);
}
function kinesioItemTreatmentKey(itemOrId, kind='first'){
  const playerId = typeof itemOrId === 'object' ? itemOrId?.player?.id : itemOrId;
  const itemKind = typeof itemOrId === 'object' ? (itemOrId?.kind || kind) : kind;
  return `${itemKind}:${playerId}`;
}
function academyYouthTreatmentVisual(player){
  const progress = typeof academyVisibleSkillsProgress === 'function' ? academyVisibleSkillsProgress(player) : { percent:0, visible:0, total:0 };
  return `<div class="academy-youth-treatment-visual" title="${escapeHtml(progress.visible || 0)}/${escapeHtml(progress.total || 0)} habilidades visibles"><div class="academy-visibility-pie" style="--academy-visible-pct:${Math.round(progress.percent || 0)}"><strong>${Math.round(progress.percent || 0)}%</strong></div></div>`;
}

function kinesiologistDifferentiatedState(){
  if(!game) return null;
  game.staffActions = game.staffActions || {};
  const current = (game.staffActions.kinesiologist && typeof game.staffActions.kinesiologist === 'object')
    ? game.staffActions.kinesiologist
    : { active:false };
  game.staffActions.kinesiologist = current;
  const playerId = Math.max(0, Math.round(Number(current.differentiatedPlayerId || 0)));
  const player = playerId ? playerById(playerId) : null;
  if(playerId && (!player || Number(player.clubId || 0) !== Number(game.selectedClubId || 0))){
    current.differentiatedPlayerId = 0;
  }else{
    current.differentiatedPlayerId = playerId;
  }
  return current;
}
function kinesiologistDifferentiatedPlayerId(){
  if(!game || !staffActive('kinesiologist')) return 0;
  const state = kinesiologistDifferentiatedState();
  return Math.max(0, Math.round(Number(state?.differentiatedPlayerId || 0)));
}
function isKinesiologistDifferentiatedPlayer(playerId){
  return Number(playerId || 0) > 0 && Number(playerId) === kinesiologistDifferentiatedPlayerId();
}
function kinesiologistDifferentiatedInjuryReduction(playerId){
  if(!isKinesiologistDifferentiatedPlayer(playerId)) return 0;
  const category = String(staffContract('kinesiologist')?.category || kinesiologistDifferentiatedState()?.category || 'regular');
  return clamp(Number(KINESIOLOGIST_DIFFERENTIATED_INJURY_REDUCTION?.[category] ?? KINESIOLOGIST_DIFFERENTIATED_INJURY_REDUCTION?.regular ?? 0), 0, 0.95);
}
function assignKinesiologistDifferentiatedPlayer(playerId){
  if(!game || !staffActive('kinesiologist')){ showNotice('Primero tenés que contratar al kinesiólogo.'); return false; }
  const cleanId = Math.max(0, Math.round(Number(playerId || 0)));
  const player = cleanId ? playerById(cleanId) : null;
  if(cleanId && (!player || Number(player.clubId || 0) !== Number(game.selectedClubId || 0))){
    showNotice('Ese jugador ya no pertenece al plantel.');
    return false;
  }
  const state = kinesiologistDifferentiatedState();
  state.differentiatedPlayerId = cleanId;
  state.differentiatedAssignedDate = cleanId && validIsoDate(game.currentDate) ? game.currentDate : '';
  state.differentiatedAssignedGlobalTurn = cleanId ? Number(game.globalTurn || 0) : 0;
  saveLocal(true);
  renderEmployees();
  showNotice(cleanId ? `${player.name} comenzó el trabajo diferenciado.` : 'El casillero de trabajo diferenciado quedó libre.');
  return true;
}
function processKinesiologistDifferentiatedDaily(){
  const playerId = kinesiologistDifferentiatedPlayerId();
  if(!playerId) return { applied:false };
  const player = playerById(playerId);
  if(!player) return { applied:false };
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  const wearBefore = currentPlayerWear(playerId);
  const conditionBefore = currentCondition(playerId);
  const moraleBefore = currentMorale(playerId);
  const wearChange = PLAYER_WEAR_ENABLED ? adjustPlayerWear(playerId, -KINESIOLOGIST_DIFFERENTIATED_WEAR_RECOVERY) : 0;
  game.playerCondition[playerId] = clamp(Math.min(conditionBefore + KINESIOLOGIST_DIFFERENTIATED_CONDITION_RECOVERY, maxConditionForPlayer(playerId)), 0, 99);
  game.playerMorale[playerId] = clamp(moraleBefore + KINESIOLOGIST_DIFFERENTIATED_MORALE_RECOVERY, 1, 99);
  const summary = {
    applied:true,
    playerId,
    wearBefore,
    wearAfter:currentPlayerWear(playerId),
    wearRecovered:Math.abs(Math.min(0, Number(wearChange || 0))),
    conditionBefore,
    conditionAfter:currentCondition(playerId),
    moraleBefore,
    moraleAfter:currentMorale(playerId),
    injuryReduction:kinesiologistDifferentiatedInjuryReduction(playerId),
    ...turnStamp()
  };
  const state = kinesiologistDifferentiatedState();
  if(state) state.lastDifferentiatedDaily = summary;
  return summary;
}
function processKinesiologistDifferentiatedDays(days=1, options={}){
  const totalDays = clamp(Math.round(Number(days || 1)), 1, 31);
  const playerId = kinesiologistDifferentiatedPlayerId();
  if(!playerId) return { applied:false, daysRequested:totalDays, daysApplied:0 };
  const player = playerById(playerId);
  if(!player) return { applied:false, daysRequested:totalDays, daysApplied:0 };
  const conditionBefore = currentCondition(playerId);
  const moraleBefore = currentMorale(playerId);
  const wearBefore = currentPlayerWear(playerId);
  let daysApplied = 0;
  let wearRecovered = 0;
  let lastDaily = null;
  for(let day=0; day<totalDays; day += 1){
    const daily = processKinesiologistDifferentiatedDaily();
    if(!daily?.applied) break;
    daysApplied += 1;
    wearRecovered += Math.max(0, Number(daily.wearRecovered || 0));
    lastDaily = daily;
  }
  const summary = {
    applied:daysApplied > 0,
    playerId,
    daysRequested:totalDays,
    daysApplied,
    conditionBefore,
    conditionAfter:currentCondition(playerId),
    moraleBefore,
    moraleAfter:currentMorale(playerId),
    wearBefore,
    wearAfter:currentPlayerWear(playerId),
    wearRecovered,
    injuryReduction:kinesiologistDifferentiatedInjuryReduction(playerId),
    source:String(options.source || 'calendar'),
    lastDaily,
    ...turnStamp()
  };
  const state = kinesiologistDifferentiatedState();
  if(state) state.lastDifferentiatedBatch = summary;
  return summary;
}
function kinesiologistDifferentiatedSlotMarkup(active){
  if(!active) return `<div class="kinesio-differentiated-panel is-inactive">
    <div class="row kinesio-differentiated-header"><div><p class="label">Casillero del kinesiólogo</p><h4>Trabajo diferenciado</h4></div><span class="pill">Sin efecto</span></div>
    <p class="muted">Contratá al kinesiólogo para asignar un jugador. Si el empleado es despedido, la asignación se elimina y el casillero deja de producir efectos.</p>
    <label class="label" for="kinesioDifferentiatedPlayerDisabled">Jugador asignado</label>
    <select id="kinesioDifferentiatedPlayerDisabled" class="training-individual-select" disabled><option>Sin kinesiólogo contratado</option></select>
    <button type="button" class="primary" disabled>Agregar jugador</button>
  </div>`;
  const currentId = kinesiologistDifferentiatedPlayerId();
  const currentPlayer = currentId ? playerById(currentId) : null;
  const contract = staffContract('kinesiologist');
  const category = String(contract?.category || 'regular');
  const categoryLabel = staffCategory(category).nombre;
  const reduction = Math.round(kinesiologistDifferentiatedInjuryReduction(currentId || -1) * 100)
    || Math.round(Number(KINESIOLOGIST_DIFFERENTIATED_INJURY_REDUCTION?.[category] || 0) * 100);
  const options = playersByClub(game.selectedClubId)
    .slice()
    .sort((a,b)=>String(a.name || '').localeCompare(String(b.name || ''), 'es'))
    .map(player => `<option value="${player.id}" ${Number(player.id) === currentId ? 'selected' : ''}>${escapeHtml(player.name)} · ${escapeHtml(player.position || '—')} · ${visibleOverall(player)}</option>`)
    .join('');
  const currentMarkup = currentPlayer ? `<div class="kinesio-differentiated-current">${faceImg(currentPlayer,'staff-differentiated-face')}<div><strong>${escapeHtml(currentPlayer.name)}</strong><span>${conditionBar(currentPlayer.id)}</span><span>${moraleBar(currentPlayer.id)}</span></div></div>` : '<p class="muted kinesio-slot-empty">Casillero libre.</p>';
  const lastRecovery = kinesiologistDifferentiatedState()?.lastDifferentiatedBatch || kinesiologistDifferentiatedState()?.lastDifferentiatedDaily || null;
  const lastRecoveryMarkup = currentPlayer && Number(lastRecovery?.playerId || 0) === Number(currentPlayer.id) && lastRecovery?.applied
    ? `<div class="staff-result ok-result"><strong>Último avance aplicado</strong><span>Forma ${Math.round(Number(lastRecovery.conditionBefore || 0))} → ${Math.round(Number(lastRecovery.conditionAfter || 0))} · Moral ${Math.round(Number(lastRecovery.moraleBefore || 0))} → ${Math.round(Number(lastRecovery.moraleAfter || 0))}${Number(lastRecovery.daysApplied || 1) > 1 ? ` · ${Math.round(Number(lastRecovery.daysApplied || 1))} días procesados` : ''}</span></div>`
    : '';
  return `<div class="kinesio-differentiated-panel is-active">
    <div class="row kinesio-differentiated-header"><div><p class="label">Casillero del kinesiólogo · ${escapeHtml(categoryLabel)}</p><h4>Trabajo diferenciado</h4></div><span class="pill ok">-${reduction}% lesión</span></div>
    <p class="muted">Un jugador queda fuera del entrenamiento general e individual. Cada día recupera ${KINESIOLOGIST_DIFFERENTIATED_WEAR_RECOVERY} de desgaste, ${KINESIOLOGIST_DIFFERENTIATED_CONDITION_RECOVERY} de forma y ${KINESIOLOGIST_DIFFERENTIATED_MORALE_RECOVERY} de moral.</p>
    ${currentMarkup}
    ${lastRecoveryMarkup}
    <label class="label" for="kinesioDifferentiatedPlayer">Jugador asignado</label>
    <select id="kinesioDifferentiatedPlayer" class="training-individual-select"><option value="0">Ningún jugador</option>${options}</select>
    <div class="modal-actions"><button id="btnAssignKinesioDifferentiated" class="primary">${currentId ? 'Actualizar casillero' : 'Agregar jugador'}</button>${currentId ? '<button id="btnClearKinesioDifferentiated" class="ghost">Retirar</button>' : ''}</div>
  </div>`;
}
function renderEmployees(){
  if(Number(game?.budget || 0) < 0) dismissAllStaffForFinancialCrisis({ silent:true });
  const last = game.staffActions?.motivationalTalk || null;
  const psychologistActive = staffActive('psychologist');
  const cooldownLeft = turnCooldownLeft(last, PSYCHOLOGIST_COOLDOWN_TURNS);
  const canCallPsychologist = psychologistActive && cooldownLeft <= 0;
  const cooldownText = cooldownLeft > 0 ? `<p class="small warn">Disponible nuevamente en ${formatDaysFromTurns(cooldownLeft)}.</p>` : '';
  const kinesioActive = staffActive('kinesiologist');
  const injuredList = kinesioTreatmentItems();
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Empleados</h2>
        <p class="tagline">Acciones de apoyo para el plantel. La contratación se paga por toda la temporada; podés despedir empleados, pero no se reintegra dinero.</p>
      </div>
      <div class="pill">Presupuesto: ${formatMoney(game.budget || 0)}</div>
    </div>
    ${staffContractsPanelMarkup({ empty:true })}
    <div class="card blocker" style="margin-top:12px"><p class="muted small">Si el presupuesto del club cae por debajo de $0, la directiva despide automáticamente a los empleados del club. El Preparador de juveniles pertenece a Tu Academia y no se ve afectado por la economía del club.</p></div>
    ${typeof assistantCoachEmployeePanelMarkup === 'function' ? assistantCoachEmployeePanelMarkup() : ''}
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card staff-card">
        <h3>Psicólogo motivacional</h3>
        <p class="muted">Convoca una charla para intentar mejorar la moral del plantel.</p>
        <p class="label">Costo</p>
        <div class="metric small">${staffCostLabel('psychologist')}</div>
        ${psychologistActive ? staffContractCardMarkup('psychologist', 'mini') : `<button id="btnHirePsychologist" class="primary">Contratar</button>`}
        ${cooldownText}
        <button id="btnMotivationalTalk" class="primary" ${canCallPsychologist ? '' : 'disabled'}>Charla motivacional</button>
      </div>
      <div class="card staff-card">
        <h3>Estado del plantel</h3>
        <div class="stat-rank"><span>Moral media</span><strong>${squadMoraleAverage(game.selectedClubId)}/99</strong></div>
        <div class="profile-bar-wrap">${moraleTeamBar(game.selectedClubId)}</div>
        ${last ? `<div class="staff-result ${last.success ? 'ok-result' : 'bad-result'}"><div class="project-progress completed"><span style="width:100%"></span></div><strong>${escapeHtml(last.message)}</strong></div>` : '<p class="muted">Sin acciones recientes.</p>'}
      </div>
      <div class="card staff-card kinesio-employee-card">
        <h3>Kinesiólogo</h3>
        <p class="muted">Contratación por temporada completa. Inicia tratamientos automáticos diarios para los lesionados y permite asignar un jugador a trabajo diferenciado.</p>
        <p class="label">Costo</p>
        <div class="metric small">${staffCostLabel('kinesiologist')}</div>
        ${kinesioActive ? staffContractCardMarkup('kinesiologist', 'mini') : `<button id="btnHireKinesiologist" class="primary">Contratar</button>`}
        ${kinesiologistDifferentiatedSlotMarkup(kinesioActive)}
      </div>
      <div class="card staff-card">
        <h3>Tratamientos</h3>
        ${kinesioActive ? injuredTreatmentList(injuredList) : '<p class="muted">Contratá al kinesiólogo para habilitar tratamientos sobre jugadores lesionados.</p>'}
      </div>
    </div>
  `;
  $('btnHirePsychologist')?.addEventListener('click', () => openStaffHireModal('psychologist', renderEmployees));
  $('btnMotivationalTalk')?.addEventListener('click', (event) => callMotivationalPsychologist(event.currentTarget));
  $('btnHireKinesiologist')?.addEventListener('click', hireKinesiologist);
  if(typeof bindAssistantCoachEmployeePanel === 'function') bindAssistantCoachEmployeePanel();
  $('btnKinesioTreatAll')?.addEventListener('click', (event) => treatAllInjuredPlayers(event.currentTarget));
  $('btnAssignKinesioDifferentiated')?.addEventListener('click', () => assignKinesiologistDifferentiatedPlayer(Number($('kinesioDifferentiatedPlayer')?.value || 0)));
  $('btnClearKinesioDifferentiated')?.addEventListener('click', () => assignKinesiologistDifferentiatedPlayer(0));
  document.querySelectorAll('[data-kinesio-treat]').forEach(btn => {
    btn.addEventListener('click', () => treatInjuredPlayer(Number(btn.dataset.kinesioTreat), btn, btn.dataset.kinesioKind || 'first')); 
  });
  bindStaffDismissButtons(renderEmployees);
}
function injuredTreatmentList(injuredList){
  if(!injuredList.length) return '<p class="muted">No hay jugadores lesionados para tratar.</p>';
  const eligible = injuredList.filter(item => !wasKinesioTreatedThisTurn(item.player.id, item.kind));
  const newProfessionalCost = eligible.filter(item => item.kind !== 'youth' && !kinesiologistTreatmentPlan(item.player.id, item.kind)).reduce((sum,item)=>sum+kinesiologistTreatmentCourseCost(item.player.id,item.kind),0);
  const newYouthCost = eligible.filter(item => item.kind === 'youth' && !kinesiologistTreatmentPlan(item.player.id, item.kind)).reduce((sum,item)=>sum+kinesiologistTreatmentCourseCost(item.player.id,item.kind),0);
  const insufficientBudget = newProfessionalCost > 0 && Number(game.budget || 0) < newProfessionalCost;
  const insufficientPersonal = newYouthCost > 0 && !managerCanAffordAcademy(newYouthCost);
  const bulkDisabled = !eligible.length || insufficientBudget || insufficientPersonal;
  const chance = Math.round(kinesiologistTreatmentSuccessChance() * 100);
  const bulkReason = !eligible.length ? 'Todos los lesionados ya recibieron el tratamiento automático de hoy.' : insufficientBudget ? 'Presupuesto del club insuficiente para iniciar todos los tratamientos.' : insufficientPersonal ? `Saldo personal insuficiente para los tratamientos juveniles (${formatMoney(newYouthCost)}).` : `Nuevos tratamientos: club ${formatMoney(newProfessionalCost)} · Cuenta personal ${formatMoney(newYouthCost)}.`;
  return `<div class="kinesio-bulk-card">
    <p class="label">Tratamiento automático diario</p>
    <p class="muted small">Cada lesión inicia un plan único de ${formatMoney(KINESIOLOGIST_AUTO_TREATMENT_COST_PER_DAY)} por día diagnosticado. Luego el kinesiólogo intenta reducir la recuperación una vez por día. Probabilidad actual de éxito: <strong>${chance}%</strong>.</p>
    <div class="row gap-sm">
      <button class="primary" id="btnKinesioTreatAll" ${bulkDisabled ? 'disabled' : ''}>Tratar ahora a todos</button>
      <span class="pill">${eligible.length}/${injuredList.length} pendiente(s) hoy</span>
    </div>
    <p class="small ${insufficientBudget || insufficientPersonal ? 'warn' : 'muted'}">${escapeHtml(bulkReason)}</p>
    <div class="kinesio-bulk-progress hidden" id="kinesioBulkProgress"></div>
  </div>
  <div class="injured-treatment-list">${injuredList.map(item => {
    const kind = item.kind || 'first';
    const treated = wasKinesioTreatedThisTurn(item.player.id, kind);
    const key = kinesioItemTreatmentKey(item);
    const plan = kinesiologistTreatmentPlan(item.player.id, kind);
    const courseCost = plan ? Number(plan.cost || 0) : kinesiologistTreatmentCourseCost(item.player.id, kind);
    const visual = kind === 'youth' ? academyYouthTreatmentVisual(item.player) : faceImg(item.player, 'injured-home-face');
    const nameButton = kind === 'youth'
      ? `<strong>${escapeHtml(item.player.name)}</strong>`
      : `<button class="linklike" data-player-id="${item.player.id}">${availabilityIcons(item.player.id)}${escapeHtml(item.player.name)}</button>`;
    const payer = kind === 'youth' ? 'Cuenta personal' : 'Club';
    const planLabel = plan ? `Plan activo · ${payer} pagó ${formatMoney(courseCost)}` : `Nuevo plan · ${payer}: ${formatMoney(courseCost)}`;
    return `<div class="injured-treatment-row ${kind === 'youth' ? 'youth-treatment' : ''}" data-treatment-row="${escapeHtml(key)}">
      ${visual}
      <div>${nameButton}<span>${escapeHtml(item.status.injuryLabel || 'Lesión')} · ${formatDaysFromTurns(item.remaining)}</span><span class="small muted">${escapeHtml(planLabel)}</span><span class="treatment-status" data-kinesio-status="${escapeHtml(key)}">${treated ? 'Tratado hoy' : 'Automático al avanzar el día'}</span></div>
      <button class="ghost" data-kinesio-treat="${item.player.id}" data-kinesio-kind="${escapeHtml(kind)}" ${treated ? 'disabled' : ''}>${treated ? 'Tratado hoy' : 'Tratar ahora'}</button>
    </div>`;
  }).join('')}</div>`;
}
function wasKinesioTreatedThisTurn(playerId, kind='first'){
  const key = `${currentTurnIndex()}:${kind}:${playerId}`;
  return Boolean(game.staffActions?.kinesiologyTreatments?.[key]);
}
function hireKinesiologist(){
  openStaffHireModal('kinesiologist', renderEmployees);
}
function applyKinesioTreatment(playerId, kind='first', options={}){
  if(!staffActive('kinesiologist')) return { success:false, applied:false, message:'Primero tenés que contratar al kinesiólogo.' };
  const course = ensureKinesiologistTreatmentCourse(playerId, kind, options);
  if(!course.ok) return { success:false, applied:false, skipped:true, message:course.message || 'No se pudo iniciar el tratamiento.', reason:course.reason, cost:Number(course.cost || 0) };
  game.staffActions.kinesiologyTreatments = game.staffActions.kinesiologyTreatments || {};
  const key = `${currentTurnIndex()}:${kind}:${playerId}`;
  if(game.staffActions.kinesiologyTreatments[key]) return { success:false, applied:false, alreadyTreated:true, message:'Este jugador ya recibió tratamiento hoy.' };
  const category = kinesiologistTreatmentCategory();
  const successChance = kinesiologistTreatmentSuccessChance();
  const signature = kinesiologistInjurySignature(playerId, kind);
  const roll = hashNumber(`kinesio-daily-${signature}-${currentTurnIndex()}-${category}`, 10000) / 10000;
  const success = roll < successChance;
  const baseRecoveryReductionTurns = Math.max(1, Math.round(staffPerformanceMultiplier('kinesiologist')));
  const miraculousDoctorBonus = typeof specialActiveBonus === 'function' ? Math.max(0, Math.round(Number(specialActiveBonus('medico_milagroso') || 0))) : 0;
  const recoveryReductionTurns = baseRecoveryReductionTurns + miraculousDoctorBonus;
  const treatment = { success, successChance, category, baseRecoveryReductionTurns, miraculousDoctorBonus, recoveryReductionTurns, automatic:Boolean(options.automatic), charged:Number(course.charged || 0), ...turnStamp({ playerId, kind }) };
  game.staffActions.kinesiologyTreatments[key] = treatment;
  const plan = course.plan;
  plan.attempts = Math.max(0, Number(plan.attempts || 0)) + 1;
  plan.lastAttemptTurn = currentTurnIndex();
  plan.lastAttemptDate = validIsoDate(game.currentDate) ? game.currentDate : '';
  if(success) plan.successes = Math.max(0, Number(plan.successes || 0)) + 1;
  else plan.failures = Math.max(0, Number(plan.failures || 0)) + 1;
  if(typeof awardSpecialPoints === 'function') awardSpecialPoints('tratar_jugador_lesionado', { playerId, youth:kind === 'youth', success, automatic:Boolean(options.automatic) });
  let fullyRecovered = false;
  if(success){
    if(kind === 'youth'){
      applyAcademyYouthKinesioReduction(playerId, recoveryReductionTurns);
      const academyPlayer = game?.academy?.players?.find(item => Number(item.id) === Number(playerId));
      fullyRecovered = Boolean(academyPlayer && !academyPlayerInjured(academyPlayer));
    }else{
      const st = playerStatus(playerId);
      const injuryLabel = String(st.injuryLabel || 'su lesión');
      if(Number.isFinite(Number(st.injuredUntilTurn))){
        const nextUntil = Number(st.injuredUntilTurn || 0) - recoveryReductionTurns;
        if(nextUntil <= currentTurnIndex()){
          const { injuredThrough, injuredUntilTurn, injuryLabel:removedInjuryLabel, injuryChance, injuredAtMatchday, injuredAtTurn, ...rest } = st;
          game.playerStatus[playerId] = rest;
          fullyRecovered = true;
          if(typeof pushFullyRecoveredInjuryMessage === 'function') pushFullyRecoveredInjuryMessage({
            kind:'first',
            playerId:Number(playerId),
            playerName:playerById(playerId)?.name || 'Jugador',
            injuryLabel,
            recoveryKey:signature,
            source:'kinesiologist_recovery'
          });
        }else{
          game.playerStatus[playerId] = { ...st, injuredUntilTurn:nextUntil, injuredThrough:game.matchdayIndex + Math.max(1, Math.ceil((nextUntil - currentTurnIndex()) / Math.max(1, LEAGUE_ROUND_INTERVAL_DAYS))) };
        }
      }else{
        const nextThrough = Number(st.injuredThrough) - recoveryReductionTurns;
        if(nextThrough < game.matchdayIndex){
          const { injuredThrough, injuryLabel:removedInjuryLabel, injuryChance, injuredAtMatchday, ...rest } = st;
          game.playerStatus[playerId] = rest;
          fullyRecovered = true;
          if(typeof pushFullyRecoveredInjuryMessage === 'function') pushFullyRecoveredInjuryMessage({
            kind:'first',
            playerId:Number(playerId),
            playerName:playerById(playerId)?.name || 'Jugador',
            injuryLabel,
            recoveryKey:signature,
            source:'kinesiologist_recovery_legacy'
          });
        }else game.playerStatus[playerId] = { ...st, injuredThrough:nextThrough };
      }
    }
  }
  const costText = course.charged > 0 ? ` Se inició el plan por ${formatMoney(course.charged)}.` : '';
  const followUpText = fullyRecovered
    ? 'El jugador recibió el alta médica.'
    : 'El cuerpo médico continuará el seguimiento y avisará cuando el jugador se recupere por completo.';
  return {
    success,
    applied:true,
    fullyRecovered,
    recoveryReductionTurns,
    baseRecoveryReductionTurns,
    miraculousDoctorBonus,
    successChance,
    charged:Number(course.charged || 0),
    buttonLabel:'Tratamiento aplicado',
    message:`Tratamiento aplicado.${costText} ${followUpText}`
  };
}
function processAutomaticKinesiologistTreatmentsDaily(){
  if(!game || !staffActive('kinesiologist')) return { active:false, attempted:0, successes:0, failures:0, skipped:0, chargedClub:0, chargedManager:0 };
  const items = kinesioTreatmentItems();
  const summary = { active:true, attempted:0, successes:0, failures:0, skipped:0, chargedClub:0, chargedManager:0, category:kinesiologistTreatmentCategory(), successChance:kinesiologistTreatmentSuccessChance(), date:validIsoDate(game.currentDate) ? game.currentDate : '', turn:currentTurnIndex(), results:[], playerIds:[] };
  items.forEach(item => {
    const kind = item.kind || 'first';
    const outcome = applyKinesioTreatment(item.player.id, kind, { automatic:true });
    if(outcome.alreadyTreated) return;
    if(outcome.skipped){ summary.skipped += 1; return; }
    summary.attempted += 1;
    summary.playerIds.push(Number(item.player.id));
    summary.results.push({ playerId:Number(item.player.id), name:String(item.player.name || 'Jugador'), success:Boolean(outcome.success), kind });
    if(outcome.success) summary.successes += 1; else summary.failures += 1;
    if(Number(outcome.charged || 0) > 0){
      if(kind === 'youth') summary.chargedManager += Number(outcome.charged || 0);
      else summary.chargedClub += Number(outcome.charged || 0);
    }
  });
  game.staffActions.kinesiologistAutomaticLast = summary;
  return summary;
}
function treatInjuredPlayer(playerId, button=null, kind='first'){
  const performTreatment = () => {
    const outcome = applyKinesioTreatment(playerId, kind);
    if(outcome.applied) saveLocal(true);
    return {
      ...outcome,
      treatmentImproved:Boolean(outcome.success),
      success:Boolean(outcome.applied),
      message:outcome.applied
        ? (outcome.fullyRecovered ? 'Tratamiento aplicado. El jugador recibió el alta médica.' : 'Tratamiento aplicado. Se informará cuando el jugador se recupere por completo.')
        : (outcome.message || 'No se pudo aplicar el tratamiento.'),
      after:renderEmployees
    };
  };
  return runActionFeedback(button, performTreatment, {
    loadingLabel:'Tratando...',
    successLabel:kind === 'youth' ? 'Juvenil tratado' : 'Tratamiento aplicado',
    failureLabel:'No se pudo tratar'
  });
}
function kinesioDelay(ms){ return new Promise(resolve => { setTimeout(resolve, ms); }); }
function setKinesioTreatmentRowState(playerId, state, label='', kind='first'){
  const key = `${kind}:${playerId}`;
  const row = document.querySelector(`[data-treatment-row="${key}"]`) || document.querySelector(`[data-treatment-row="${playerId}"]`);
  const status = document.querySelector(`[data-kinesio-status="${key}"]`) || document.querySelector(`[data-kinesio-status="${playerId}"]`);
  const btn = document.querySelector(`[data-kinesio-treat="${playerId}"][data-kinesio-kind="${kind}"]`) || document.querySelector(`[data-kinesio-treat="${playerId}"]`);
  if(row){
    row.classList.remove('is-processing','is-success','is-failure');
    if(state) row.classList.add(`is-${state}`);
  }
  if(status) status.textContent = label;
  if(btn){
    btn.disabled = true;
    if(state === 'processing') btn.textContent = 'Tratando...';
    if(state === 'success') btn.textContent = 'Tratado';
    if(state === 'failure') btn.textContent = 'Falló';
  }
}
async function treatAllInjuredPlayers(button=null){
  if(!game) return;
  if(button && (button.disabled || button.dataset.actionBusy === '1')) return;
  if(!staffActive('kinesiologist')){ showNotice('Primero tenés que contratar al kinesiólogo.'); return; }
  const targets = kinesioTreatmentItems().filter(item => !wasKinesioTreatedThisTurn(item.player.id, item.kind));
  if(!targets.length){ showNotice('No hay lesionados pendientes de tratamiento hoy.'); return; }
  const cost = targets.filter(item => item.kind !== 'youth' && !kinesiologistTreatmentPlan(item.player.id, item.kind)).reduce((sum,item)=>sum+kinesiologistTreatmentCourseCost(item.player.id,item.kind),0);
  const youthCost = targets.filter(item => item.kind === 'youth' && !kinesiologistTreatmentPlan(item.player.id, item.kind)).reduce((sum,item)=>sum+kinesiologistTreatmentCourseCost(item.player.id,item.kind),0);
  if(cost > 0 && Number(game.budget || 0) < cost){ showNotice(`Presupuesto insuficiente. Necesitás ${formatMoney(cost)} para iniciar los tratamientos profesionales.`); return; }
  if(youthCost > 0 && !managerCanAffordAcademy(youthCost)){ showNotice(`Saldo personal insuficiente. Necesitás ${formatMoney(youthCost)} para iniciar los tratamientos juveniles.`); return; }
  const progress = $('kinesioBulkProgress');
  if(progress){
    progress.classList.remove('hidden');
    progress.innerHTML = `<div class="project-progress"><span style="width:0%"></span></div><strong>Preparando tratamientos...</strong>`;
  }
  if(button){
    button.dataset.actionBusy = '1';
    button.disabled = true;
    button.classList.add('action-processing');
    button.innerHTML = '<span class="action-spinner" aria-hidden="true"></span><span>Tratando plantel...</span>';
  }
  document.querySelectorAll('[data-kinesio-treat]').forEach(btn => { btn.disabled = true; });
  let successes = 0;
  let failures = 0;
  for(let index = 0; index < targets.length; index++){
    const item = targets[index];
    const playerName = item.player?.name || 'Jugador';
    setKinesioTreatmentRowState(item.player.id, 'processing', 'Tratamiento en curso...', item.kind || 'first');
    if(progress){
      const pct = Math.round((index / targets.length) * 100);
      progress.innerHTML = `<div class="project-progress"><span style="width:${pct}%"></span></div><strong>Tratando a ${escapeHtml(playerName)} (${index + 1}/${targets.length})</strong>`;
    }
    await kinesioDelay(KINESIOLOGIST_BULK_TREATMENT_STEP_MS);
    const outcome = applyKinesioTreatment(item.player.id, item.kind || 'first');
    if(outcome.success){
      successes++;
      setKinesioTreatmentRowState(item.player.id, 'success', outcome.fullyRecovered ? 'Alta médica' : 'Tratado hoy', item.kind || 'first');
    }else{
      failures++;
      setKinesioTreatmentRowState(item.player.id, 'success', 'Tratado hoy', item.kind || 'first');
    }
    saveLocal(true);
    const pct = Math.round(((index + 1) / targets.length) * 100);
    if(progress){
      progress.innerHTML = `<div class="project-progress completed"><span style="width:${pct}%"></span></div><strong>${escapeHtml(playerName)}: tratamiento aplicado</strong>`;
    }
    await kinesioDelay(Math.max(250, Math.round(ACTION_FEEDBACK_RESULT_MS * 0.55)));
  }
  if(progress){
    progress.innerHTML = `<div class="project-progress completed"><span style="width:100%"></span></div><strong>El cuerpo médico terminó la jornada. Los jugadores tratados seguirán en seguimiento hasta recibir el alta médica.</strong>`;
  }
  if(button){
    button.classList.remove('action-processing');
    button.classList.add('action-success');
    button.innerHTML = '<span>Tratamientos finalizados</span>';
  }
  saveLocal(true);
  showNotice(`Tratamientos de hoy finalizados. Nuevos planes: club ${formatMoney(cost)} · Cuenta personal ${formatMoney(youthCost)}. Se informará únicamente cuando un jugador reciba el alta médica.`);
  await kinesioDelay(Math.max(650, ACTION_FEEDBACK_RESULT_MS));
  renderEmployees();
}
function moraleTeamBar(clubId){
  const value = squadMoraleAverage(clubId);
  const cls = value < 40 ? 'low' : value < 70 ? 'mid' : 'high';
  return `<div class="morale-bar ${cls} team-morale-bar" title="Moral media ${value}/99"><span style="width:${clamp(value,1,99)}%"></span><em>${value}/99</em></div>`;
}
function callMotivationalPsychologist(button=null){
  const performTalk = () => {
    if(!game) return { success:false, message:'No hay partida activa.' };
    const last = game.staffActions?.motivationalTalk || null;
    const cooldownLeft = turnCooldownLeft(last, PSYCHOLOGIST_COOLDOWN_TURNS);
    if(!staffActive('psychologist')){ return { success:false, message:'Primero tenés que contratar al psicólogo motivacional.' }; }
    if(cooldownLeft > 0){ return { success:false, message:`La charla motivacional estará disponible en ${formatDaysFromTurns(cooldownLeft)}.` }; }
    const success = Math.random() < PSYCHOLOGIST_SUCCESS_CHANCE;
    const moraleMultiplier = staffPerformanceMultiplier('psychologist');
    if(success){
      const minGain = Math.min(PSYCHOLOGIST_MORALE_GAIN_MIN, PSYCHOLOGIST_MORALE_GAIN_MAX);
      const maxGain = Math.max(PSYCHOLOGIST_MORALE_GAIN_MIN, PSYCHOLOGIST_MORALE_GAIN_MAX);
      playersByClub(game.selectedClubId).forEach(player => {
        game.playerMorale[player.id] = clamp(Math.round(currentMorale(player.id) + rnd(minGain, maxGain) * moraleMultiplier), 1, 99);
      });
    }
    game.staffActions = game.staffActions || {};
    game.staffActions.motivationalTalk = {
      success,
      ...turnStamp(),
      category:staffContract('psychologist')?.category || 'regular',
      performanceMultiplier:staffPerformanceMultiplier('psychologist'),
      message: success ? 'La charla motivacional fue un éxito' : 'La charla motivacional fue un fracaso'
    };
    saveLocal(true);
    return {
      success,
      buttonLabel: success ? 'Charla exitosa' : 'Charla fallida',
      message: game.staffActions.motivationalTalk.message,
      after:renderEmployees
    };
  };
  return runActionFeedback(button, performTalk, {
    loadingLabel:'Convocando charla...',
    successLabel:'Charla exitosa',
    failureLabel:'Charla fallida'
  });
}


function getTacticForClub(clubId){
  if(Number(clubId) === Number(game.selectedClubId)) return game.tactic;
  if(window.Simulator20?.botTacticForClub) return window.Simulator20.botTacticForClub(clubId);
  const club = seed.clubs.find(c => Number(c.id) === Number(clubId)) || { reputation:60 };
  const formation = Number(club.reputation || 0) > 74 ? '4-3-3' : Number(club.reputation || 0) < 61 ? '5-4-1' : '4-4-2';
  return { formation, defense:'posicional', midfield:'posicional', attack:'posicional' };
}
