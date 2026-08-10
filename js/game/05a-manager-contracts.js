/* V8.41 · Contratos, sueldo, patrimonio personal y negociación anual del manager. */

function managerContractBalanceConfig(){
  const cfg = window.GAME_BALANCE_MANAGER?.contratosManager;
  return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
}
function managerContractStatePrestige(state=game){
  const careerPrestige = Number(state?.managerStats?.careerProfile?.prestige);
  if(Number.isFinite(careerPrestige)){
    return clamp(typeof managerCareerPrestigeToClubScale === 'function' ? managerCareerPrestigeToClubScale(careerPrestige) : Math.round(careerPrestige / 10), 0, 99);
  }
  if(state?.managerStats && typeof managerPrestigeBreakdown === 'function') return clamp(Number(managerPrestigeBreakdown(state.managerStats).legacyTotal ?? managerPrestigeBreakdown(state.managerStats).total ?? 0), 0, 99);
  return clamp(Number(MANAGER_PRESTIGE_INITIAL || 0), 0, 99);
}
function managerContractNegotiationLevel(value='normal'){
  const level = String(value || 'normal').toLowerCase();
  return ['prudente','normal','ambicioso','beneficios','compensacion'].includes(level) ? level : 'normal';
}
function managerContractNegotiationRandomConfig(){
  const cfg = managerContractBalanceConfig().negociacionOfertaAleatoria;
  return cfg && typeof cfg === 'object' && !Array.isArray(cfg) ? cfg : {};
}
function managerContractNegotiationRandomInt(offer={}, key='', min=0, max=min){
  const lo = Math.round(Math.min(Number(min || 0), Number(max || 0)));
  const hi = Math.round(Math.max(Number(min || 0), Number(max || 0)));
  if(hi <= lo) return lo;
  const salt = `${offer?.id || ''}-${offer?.clubId || 0}-${offer?.createdDate || ''}-${offer?.source || ''}-${key}`;
  return lo + hashNumber(`manager-contract-negotiation-${salt}`, hi - lo + 1);
}
function managerContractNegotiationConfig(level='normal', offer={}, state=game){
  const cfg = managerContractBalanceConfig();
  const clean = managerContractNegotiationLevel(level);
  const fallback = {
    prudente:{ label:'Objetivo prudente', objectiveDelta:-0.10, salaryFactor:0.80, futureSaleDelta:0 },
    normal:{ label:'Condiciones base', objectiveDelta:0, salaryFactor:1, futureSaleDelta:0 },
    ambicioso:{ label:'Objetivo ambicioso', objectiveDelta:0.20, salaryFactor:1.25, futureSaleDelta:0 }
  }[clean] || { label:'Condiciones base', objectiveDelta:0, salaryFactor:1, futureSaleDelta:0 };
  if(!['beneficios','compensacion'].includes(clean)){
    const raw = cfg.negociacionObjetivo?.[clean] || {};
    return {
      key:clean,
      label:String(raw.label || fallback.label),
      objectiveDelta:Number.isFinite(Number(raw.objectiveDelta)) ? Number(raw.objectiveDelta) : fallback.objectiveDelta,
      objectiveFactor:null,
      salaryFactor:Number.isFinite(Number(raw.salaryFactor)) ? Number(raw.salaryFactor) : fallback.salaryFactor,
      futureSaleDelta:Number.isFinite(Number(raw.futureSaleDelta)) ? Math.round(Number(raw.futureSaleDelta)) : Number(fallback.futureSaleDelta || 0),
      tradeoffType:'legacy'
    };
  }
  const randomCfg = managerContractNegotiationRandomConfig();
  if(randomCfg.activo === false) return managerContractNegotiationConfig(clean === 'beneficios' ? 'ambicioso' : 'prudente', offer, state);
  if(clean === 'beneficios'){
    const salaryPct = managerContractNegotiationRandomInt(offer, 'beneficios-sueldo', randomCfg.aumentoSueldoMin ?? 5, randomCfg.aumentoSueldoMax ?? 20);
    const objectivePct = managerContractNegotiationRandomInt(offer, 'beneficios-objetivo', randomCfg.reduccionObjetivoMin ?? 3, randomCfg.reduccionObjetivoMax ?? 12);
    const futureSalePoints = managerContractNegotiationRandomInt(offer, 'beneficios-venta', randomCfg.reduccionVentaFuturaMin ?? 1, randomCfg.reduccionVentaFuturaMax ?? 5);
    return {
      key:clean,
      label:`Sueldo +${salaryPct}% · objetivo -${objectivePct}% · venta futura -${futureSalePoints} pt${futureSalePoints === 1 ? '' : 's'}`,
      objectiveDelta:0,
      objectiveFactor:Number((1 - objectivePct / 100).toFixed(3)),
      salaryFactor:Number((1 + salaryPct / 100).toFixed(3)),
      futureSaleDelta:-futureSalePoints,
      tradeoffType:'salary_and_objective'
    };
  }
  const salaryPct = managerContractNegotiationRandomInt(offer, 'compensacion-sueldo', randomCfg.reduccionSueldoMin ?? 5, randomCfg.reduccionSueldoMax ?? 20);
  const alternative = managerContractNegotiationRandomInt(offer, 'compensacion-alternativa', 0, 1) === 0 ? 'objective' : 'future_sale';
  const objectivePct = alternative === 'objective'
    ? managerContractNegotiationRandomInt(offer, 'compensacion-objetivo', randomCfg.aumentoObjetivoMin ?? 3, randomCfg.aumentoObjetivoMax ?? 12)
    : 0;
  const futureSalePoints = alternative === 'future_sale'
    ? managerContractNegotiationRandomInt(offer, 'compensacion-venta', randomCfg.aumentoVentaFuturaMin ?? 1, randomCfg.aumentoVentaFuturaMax ?? 5)
    : 0;
  return {
    key:clean,
    label:alternative === 'objective'
      ? `Sueldo -${salaryPct}% · objetivo +${objectivePct}%`
      : `Sueldo -${salaryPct}% · venta futura +${futureSalePoints} pt${futureSalePoints === 1 ? '' : 's'}`,
    objectiveDelta:0,
    objectiveFactor:alternative === 'objective' ? Number((1 + objectivePct / 100).toFixed(3)) : 1,
    salaryFactor:Number((1 - salaryPct / 100).toFixed(3)),
    futureSaleDelta:futureSalePoints,
    tradeoffType:alternative
  };
}
function managerContractOfferNegotiationOptionsMarkup(offer={}, selected='normal'){
  const current = managerContractNegotiationLevel(selected);
  const options = ['normal','beneficios','compensacion'].map(level => managerContractNegotiationConfig(level, offer, game));
  return options.map(option => `<option value="${escapeHtml(option.key)}" ${option.key === current ? 'selected' : ''}>${escapeHtml(option.label)}</option>`).join('');
}
function managerContractNextSeasonNegotiationConfig(choice='aumento'){
  const cfg = managerContractBalanceConfig();
  const clean = String(choice || 'aumento').toLowerCase() === 'reduccion' ? 'reduccion' : 'aumento';
  const fallback = clean === 'reduccion'
    ? { label:'Aceptar 20% menos', salaryFactor:0.80, objectiveFactor:0.90 }
    : { label:'Pedir 20% de aumento', salaryFactor:1.20, objectiveFactor:1.30 };
  const raw = cfg.renegociacionTemporadaSiguiente?.[clean] || {};
  return {
    key:clean,
    label:String(raw.label || fallback.label),
    salaryFactor:clamp(Number.isFinite(Number(raw.salaryFactor)) ? Number(raw.salaryFactor) : fallback.salaryFactor, 0.10, 3),
    objectiveFactor:clamp(Number.isFinite(Number(raw.objectiveFactor)) ? Number(raw.objectiveFactor) : fallback.objectiveFactor, 0.10, 3)
  };
}
function managerContractAnnualSalarySchedule(monthlySalary, duration=1, startSeason=game?.seasonNumber || 1){
  const salary = Math.max(100000, Math.round(Number(monthlySalary || 0)));
  const cleanDuration = clamp(Math.round(Number(duration || 1)), 1, 3);
  return Array.from({ length:cleanDuration }, (_, index) => ({
    season:Number(startSeason || 1) + index,
    contractYear:index + 1,
    monthlySalary:salary,
    source:'contract'
  }));
}
function managerContractMonthlySalaryForSeason(contract, season=game?.seasonNumber || 1){
  const list = Array.isArray(contract?.annualSalaries) ? contract.annualSalaries : [];
  const entry = list.find(item => Number(item?.season) === Number(season));
  return Math.max(100000, Math.round(Number(entry?.monthlySalary ?? contract?.monthlySalary ?? 0)));
}
function managerContractDurationSalaryFactor(duration=1){
  const cfg = managerContractBalanceConfig();
  const clean = clamp(Math.round(Number(duration || 1)), 1, 3);
  const fallback = clean === 1 ? 1 : clean === 2 ? 0.95 : 0.90;
  const value = Number(cfg.factorSueldoPorDuracion?.[clean] ?? cfg.factorSueldoPorDuracion?.[String(clean)]);
  return Number.isFinite(value) ? clamp(value, 0.5, 1.5) : fallback;
}
function managerContractDivisionBaseSalary(clubId){
  const cfg = managerContractBalanceConfig();
  const order = clamp(Math.round(Number(clubDivision(clubId)?.order || 3)), 1, 3);
  const fallback = order === 1 ? 6000000 : order === 2 ? 3000000 : 1500000;
  const value = Number(cfg.sueldoBaseMensualPorDivision?.[order] ?? cfg.sueldoBaseMensualPorDivision?.[String(order)]);
  return Math.max(100000, Math.round(Number.isFinite(value) ? value : fallback));
}
function managerContractLeagueBudgets(clubId, state=game){
  const targetClub = seed?.clubs?.find(item => Number(item.id) === Number(clubId));
  const divisionId = String(targetClub?.divisionId || 'default');
  return (seed?.clubs || [])
    .filter(item => String(item.divisionId || 'default') === divisionId)
    .map(item => Math.max(1, Math.round(Number(state?.clubBudgets?.[item.id] ?? item.budget ?? 1))));
}
function managerContractWealthFactor(clubId, state=game){
  const cfg = managerContractBalanceConfig();
  const budgets = managerContractLeagueBudgets(clubId, state);
  const club = seed?.clubs?.find(item => Number(item.id) === Number(clubId));
  const current = Math.max(1, Math.round(Number(state?.clubBudgets?.[clubId] ?? club?.budget ?? 1)));
  const average = budgets.length ? budgets.reduce((sum,value)=>sum+value,0) / budgets.length : current;
  const ratio = Math.max(0.05, current / Math.max(1, average));
  const min = Number.isFinite(Number(cfg.factorEconomicoMin)) ? Number(cfg.factorEconomicoMin) : 0.75;
  const max = Number.isFinite(Number(cfg.factorEconomicoMax)) ? Number(cfg.factorEconomicoMax) : 1.25;
  return clamp(0.90 + (Math.log2(ratio) * 0.12), min, max);
}
function managerContractBaseMonthlySalary(clubId, state=game, managerPrestige=managerContractStatePrestige(state)){
  const cfg = managerContractBalanceConfig();
  const base = managerContractDivisionBaseSalary(clubId);
  const prestigeMin = Number.isFinite(Number(cfg.factorPrestigioManagerMin)) ? Number(cfg.factorPrestigioManagerMin) : 0.60;
  const prestigeMax = Number.isFinite(Number(cfg.factorPrestigioManagerMax)) ? Number(cfg.factorPrestigioManagerMax) : 1.50;
  const managerFactor = prestigeMin + ((prestigeMax - prestigeMin) * (clamp(Number(managerPrestige || 0), 0, 99) / 99));
  const clubMin = Number.isFinite(Number(cfg.factorReputacionClubMin)) ? Number(cfg.factorReputacionClubMin) : 0.70;
  const clubMax = Number.isFinite(Number(cfg.factorReputacionClubMax)) ? Number(cfg.factorReputacionClubMax) : 1.30;
  const clubFactor = clubMin + ((clubMax - clubMin) * (clubPrestigeValue(clubId) / 99));
  return Math.max(100000, Math.round(base * managerFactor * clubFactor * managerContractWealthFactor(clubId, state)));
}
function managerContractDurationForOffer(club, options={}, state=game){
  if(String(options.contractType || '') === 'high_risk') return 1;
  const cfg = managerContractBalanceConfig();
  const prestige = managerContractStatePrestige(state);
  const fit = prestige - clubPrestigeValue(club);
  const roll = hashNumber(`manager-contract-duration-${state?.saveCode || ''}-${state?.seasonNumber || 1}-${club?.id || 0}-${options.source || ''}`, 100);
  const table = fit >= 15
    ? (cfg.duracionProbabilidadManagerSuperior || { one:15, two:45, three:40 })
    : fit >= -5
      ? (cfg.duracionProbabilidadEquilibrada || { one:35, two:45, three:20 })
      : (cfg.duracionProbabilidadExigente || { one:70, two:25, three:5 });
  const one = clamp(Math.round(Number(table.one ?? table[1] ?? 35)), 0, 100);
  const two = clamp(Math.round(Number(table.two ?? table[2] ?? 45)), 0, 100);
  if(roll < one) return 1;
  if(roll < one + two) return 2;
  return 3;
}
function managerContractFutureSalePercent(club, salt='', state=game){
  const cfg = managerContractBalanceConfig();
  const min = clamp(Math.round(Number(cfg.porcentajeVentaFuturaMin ?? 5)), 0, 100);
  const max = clamp(Math.round(Number(cfg.porcentajeVentaFuturaMax ?? 20)), min, 100);
  const reputation = clubPrestigeValue(club);
  const base = max - Math.round((reputation / 99) * (max - min));
  const variation = hashNumber(`manager-future-percent-${state?.saveCode || ''}-${club?.id || 0}-${salt}`, 3) - 1;
  return clamp(base + variation, min, max);
}
function managerContractFutureSaleMaximum(){
  const cfg = typeof managerJobRealismConfig === 'function' ? managerJobRealismConfig() : {};
  return clamp(Math.round(Number(cfg.porcentajeVentaFuturaMaximo ?? 25)), 5, 100);
}
function managerJobOfferRealismTerms(club, salt='', state=game){
  const cfg = typeof managerJobRealismConfig === 'function' ? managerJobRealismConfig() : {};
  const active = cfg.activo !== false;
  const standing = typeof managerJobClubStandingProfile === 'function' ? managerJobClubStandingProfile(club) : { position:0, total:0, ratio:0.5 };
  const unemploymentDays = typeof managerJobUnemployedDays === 'function' ? managerJobUnemployedDays(state) : 0;
  const maxWaitDays = Math.max(1, Math.round(Number(cfg.diasParaBonusMaximoEspera ?? 120)));
  const waitFactor = clamp(unemploymentDays / maxWaitDays, 0, 1);
  const prestige = clamp(Number(clubPrestigeValue(club) || 0), 0, 99);
  const smallClubFactor = clamp(1 - (prestige / 99), 0, 1);
  const wealth = typeof managerContractWealthFactor === 'function' ? managerContractWealthFactor(club.id, state) : 1;
  const weakEconomyFactor = clamp((1.25 - Number(wealth || 1)) / 0.50, 0, 1);
  const jitterRange = Math.max(0, Number(cfg.variacionSueldo ?? 0.04));
  const jitterRaw = (hashNumber(`manager-job-salary-${state?.saveCode || ''}-${club?.id || 0}-${salt}`, 1001) / 1000) - 0.5;
  const salaryFactor = active ? clamp(
    1
      - smallClubFactor * Math.max(0, Number(cfg.penalizacionSueldoMaximaClubChico ?? 0.10))
      - Number(standing.ratio || 0) * Math.max(0, Number(cfg.penalizacionSueldoMaximaZonaBaja ?? 0.12))
      - weakEconomyFactor * Math.max(0, Number(cfg.penalizacionSueldoMaximaEconomiaDebil ?? 0.08))
      + jitterRaw * jitterRange * 2,
    Number(cfg.factorSueldoMinimo ?? 0.65),
    Number(cfg.factorSueldoMaximo ?? 1.05)
  ) : 1;
  const baseFuture = managerContractFutureSalePercent(club, salt, state);
  const contextMax = Math.max(0, Math.round(Number(cfg.bonusVentaFuturaMaximoPorContexto ?? 2)));
  const waitMax = Math.max(0, Math.round(Number(cfg.bonusVentaFuturaMaximoPorEspera ?? 5)));
  const contextScore = clamp((smallClubFactor * 0.45) + (weakEconomyFactor * 0.25) + (Number(standing.ratio || 0) * 0.30), 0, 1);
  const contextBonus = active ? Math.round(contextScore * contextMax) : 0;
  const lowSalaryBonus = active && salaryFactor <= 0.78 ? 1 : 0;
  const structuralCap = Math.min(managerContractFutureSaleMaximum() - waitMax, 22);
  const structuralPercent = Math.min(structuralCap, baseFuture + contextBonus + lowSalaryBonus);
  const waitCeiling = contextScore >= 0.70
    ? managerContractFutureSaleMaximum()
    : Math.min(managerContractFutureSaleMaximum(), structuralPercent + waitMax);
  const waitBonus = active ? Math.round(waitFactor * Math.max(0, waitCeiling - structuralPercent)) : 0;
  const futureSalePercent = clamp(structuralPercent + waitBonus, 5, managerContractFutureSaleMaximum());
  return {
    salaryOfferFactor:Number(salaryFactor.toFixed(3)),
    futureSalePercent:Math.round(futureSalePercent),
    tablePosition:Number(standing.position || 0),
    tableSize:Number(standing.total || 0),
    tableRatio:Number(Number(standing.ratio || 0).toFixed(3)),
    unemploymentDays:Math.max(0, Math.round(Number(unemploymentDays || 0))),
    waitBonus,
    contextBonus
  };
}
function managerContractObjectiveSchedule(finalObjective, duration=1, startSeason=game?.seasonNumber || 1, clubId=game?.selectedClubId){
  const cfg = managerContractBalanceConfig();
  const cleanDuration = clamp(Math.round(Number(duration || 1)), 1, 3);
  const divisionLimits = managerObjectiveLimitsForDivision(clubDivision(clubId));
  const fallbackOffsets = cleanDuration === 1 ? [0] : cleanDuration === 2 ? [-0.20, 0] : [-0.30, -0.15, 0];
  const configured = cfg.escalonesObjetivo?.[cleanDuration] || cfg.escalonesObjetivo?.[String(cleanDuration)];
  const offsets = Array.isArray(configured) && configured.length === cleanDuration ? configured.map(Number) : fallbackOffsets;
  return offsets.map((offset,index) => {
    const isFinal = index === cleanDuration - 1;
    const objectivePpg = clamp(Number(finalObjective || 0) + Number(offset || 0), divisionLimits.min, Math.max(divisionLimits.max, Number(finalObjective || divisionLimits.max)));
    return {
      season:Number(startSeason || 1) + index,
      contractYear:index + 1,
      type:isFinal ? 'final' : 'minimum',
      objectivePpg:Number(objectivePpg.toFixed(3)),
      label:isFinal ? 'Objetivo final' : `Mínimo año ${index + 1}`
    };
  });
}
function managerContractOfferTerms(offer={}, negotiationLevel='normal', state=game){
  const club = seed?.clubs?.find(item => Number(item.id) === Number(offer.clubId));
  if(!club) return null;
  const highRisk = String(offer.contractType || '') === 'high_risk';
  const duration = highRisk ? 1 : clamp(Math.round(Number(offer.durationSeasons || 1)), 1, 3);
  const negotiation = highRisk
    ? { key:'ambicioso', label:'Contrato exigente', objectiveDelta:Number(offer.objectiveBonus || 0.25), objectiveFactor:null, salaryFactor:1.30, futureSaleDelta:0 }
    : managerContractNegotiationConfig(negotiationLevel, offer, state);
  const baseObjective = Number.isFinite(Number(offer.baseObjectivePpg)) ? Number(offer.baseObjectivePpg) : Number(managerObjectiveBaseForClubDivision(club.id));
  const limits = managerObjectiveLimitsForDivision(clubDivision(club.id));
  const hasObjectiveFactor = negotiation.objectiveFactor !== null && negotiation.objectiveFactor !== undefined && Number.isFinite(Number(negotiation.objectiveFactor));
  const rawFinalObjective = hasObjectiveFactor
    ? baseObjective * Number(negotiation.objectiveFactor)
    : baseObjective + Number(negotiation.objectiveDelta || 0);
  const finalObjective = clamp(rawFinalObjective, limits.min, Math.max(limits.max, baseObjective + 0.50));
  const startSeason = Number(state?.seasonNumber || 1);
  const annualObjectives = managerContractObjectiveSchedule(finalObjective, duration, startSeason, club.id);
  const baseMonthly = managerContractBaseMonthlySalary(club.id, state, Number(offer.managerPrestigeAtOffer ?? managerContractStatePrestige(state)));
  const salaryOfferFactor = Number.isFinite(Number(offer.salaryOfferFactor)) ? clamp(Number(offer.salaryOfferFactor), 0.40, 1.50) : 1;
  const monthlySalary = Math.max(100000, Math.round(baseMonthly * managerContractDurationSalaryFactor(duration) * Number(negotiation.salaryFactor || 1) * salaryOfferFactor));
  const annualSalaries = managerContractAnnualSalarySchedule(monthlySalary, duration, startSeason);
  const baseFutureSalePercent = clamp(Math.round(Number(offer.futureSalePercent ?? managerContractFutureSalePercent(club, offer.id || '', state))), 5, managerContractFutureSaleMaximum());
  const futureSalePercent = clamp(baseFutureSalePercent + Math.round(Number(negotiation.futureSaleDelta || 0)), 5, managerContractFutureSaleMaximum());
  return {
    clubId:Number(club.id),
    durationSeasons:duration,
    startSeason,
    endSeason:startSeason + duration - 1,
    negotiationLevel:negotiation.key,
    negotiationLabel:negotiation.label,
    baseObjectivePpg:Number(baseObjective.toFixed(3)),
    finalObjectivePpg:Number(finalObjective.toFixed(3)),
    annualObjectives,
    monthlySalary,
    annualSalary:monthlySalary * 12,
    annualSalaries,
    futureSalePercent,
    baseFutureSalePercent,
    futureSaleDelta:Math.round(Number(negotiation.futureSaleDelta || 0)),
    durationSalaryFactor:managerContractDurationSalaryFactor(duration),
    salaryFactor:Number(negotiation.salaryFactor || 1),
    objectiveFactor:hasObjectiveFactor ? Number(negotiation.objectiveFactor) : null,
    salaryOfferFactor,
    highRisk
  };
}
function managerContractScheduleEntry(contract, season=game?.seasonNumber || 1){
  const list = Array.isArray(contract?.annualObjectives) ? contract.annualObjectives : [];
  return list.find(item => Number(item.season) === Number(season)) || null;
}
function managerContractActiveForSeason(contract, clubId=game?.selectedClubId, season=game?.seasonNumber || 1){
  if(!contract || typeof contract !== 'object') return false;
  return String(contract.status || 'active') === 'active'
    && Number(contract.clubId || 0) === Number(clubId || 0)
    && Number(season || 1) >= Number(contract.startSeason || contract.season || 1)
    && Number(season || 1) <= Number(contract.endSeason || contract.season || 1);
}
function normalizeManagerContractAnnualSalaries(contract, fallbackSalary, startSeason, duration){
  const raw = Array.isArray(contract?.annualSalaries) ? contract.annualSalaries : [];
  return Array.from({ length:duration }, (_, index) => {
    const season = Number(startSeason || 1) + index;
    const found = raw.find(item => Number(item?.season) === season) || raw[index] || {};
    return {
      season,
      contractYear:index + 1,
      monthlySalary:Math.max(100000, Math.round(Number(found.monthlySalary ?? fallbackSalary))),
      source:String(found.source || 'contract')
    };
  });
}
function normalizeManagerContractNextSeasonNegotiation(value, contract, state=game){
  if(!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const currentSeason = Number(state?.seasonNumber || contract?.startSeason || 1);
  const targetSeason = Math.max(1, Math.round(Number(value.targetSeason || currentSeason + 1)));
  const choice = String(value.choice || '');
  const config = choice ? managerContractNextSeasonNegotiationConfig(choice) : null;
  const status = ['available','agreed','applied','expired'].includes(String(value.status || '')) ? String(value.status) : 'available';
  return {
    eligibleSeason:Math.max(1, Math.round(Number(value.eligibleSeason || targetSeason - 1))),
    targetSeason,
    status,
    choice:config?.key || '',
    label:String(value.label || config?.label || ''),
    salaryFactor:config ? config.salaryFactor : Number(value.salaryFactor || 1),
    objectiveFactor:config ? config.objectiveFactor : Number(value.objectiveFactor || 1),
    baseMonthlySalary:Math.max(100000, Math.round(Number(value.baseMonthlySalary || managerContractMonthlySalaryForSeason(contract, targetSeason - 1)))),
    negotiatedMonthlySalary:Math.max(100000, Math.round(Number(value.negotiatedMonthlySalary || value.baseMonthlySalary || managerContractMonthlySalaryForSeason(contract, targetSeason - 1)))),
    baseObjectivePpg:Number(Number(value.baseObjectivePpg || 0).toFixed(3)),
    negotiatedObjectivePpg:Number(Number(value.negotiatedObjectivePpg || value.baseObjectivePpg || 0).toFixed(3)),
    unlockedDate:validIsoDate(value.unlockedDate) ? value.unlockedDate : '',
    agreedDate:validIsoDate(value.agreedDate) ? value.agreedDate : '',
    appliedDate:validIsoDate(value.appliedDate) ? value.appliedDate : '',
    notified:Boolean(value.notified)
  };
}
function normalizeManagerJobContract(contract, state=game){
  if(!contract || typeof contract !== 'object' || Array.isArray(contract)) return null;
  const clubId = Number(contract.clubId || state?.selectedClubId || 0);
  const club = seed?.clubs?.find(item => Number(item.id) === clubId);
  if(!club) return null;
  const startSeason = Math.max(1, Math.round(Number(contract.startSeason || contract.season || state?.seasonNumber || 1)));
  const duration = clamp(Math.round(Number(contract.durationSeasons || ((Number(contract.endSeason || startSeason) - startSeason) + 1) || 1)), 1, 3);
  const pseudoOffer = {
    id:String(contract.offerId || contract.id || `contract-${clubId}-${startSeason}`),
    clubId,
    contractType:String(contract.contractType || 'normal'),
    durationSeasons:duration,
    managerPrestigeAtOffer:Number(contract.managerPrestigeAtSigning ?? managerContractStatePrestige(state)),
    baseObjectivePpg:Number(contract.baseObjectivePpg ?? managerObjectiveBaseForClubDivision(clubId)),
    objectiveBonus:Number(contract.objectiveBonus || 0.25),
    futureSalePercent:Number(contract.futureSalePercent ?? managerContractFutureSalePercent(club, contract.id || '', state)),
    salaryOfferFactor:Number.isFinite(Number(contract.salaryOfferFactor)) ? Number(contract.salaryOfferFactor) : 1
  };
  const terms = managerContractOfferTerms(pseudoOffer, contract.negotiationLevel || (pseudoOffer.contractType === 'high_risk' ? 'ambicioso' : 'normal'), { ...state, seasonNumber:startSeason });
  const annualObjectives = Array.isArray(contract.annualObjectives) && contract.annualObjectives.length === duration
    ? contract.annualObjectives.map((item,index)=>({
      season:Number(item.season || startSeason + index),
      contractYear:Number(item.contractYear || index + 1),
      type:String(item.type || (index === duration - 1 ? 'final' : 'minimum')),
      objectivePpg:Number(item.objectivePpg ?? terms.annualObjectives[index]?.objectivePpg ?? terms.finalObjectivePpg),
      label:String(item.label || (index === duration - 1 ? 'Objetivo final' : `Mínimo año ${index + 1}`))
    }))
    : terms.annualObjectives;
  const monthlySalary = Math.max(100000, Math.round(Number(contract.monthlySalary ?? terms.monthlySalary)));
  const annualSalaries = normalizeManagerContractAnnualSalaries(contract, monthlySalary, startSeason, duration);
  const normalizedBase = {
    id:String(contract.id || `manager-contract-${clubId}-${startSeason}-${String(contract.signedDate || 'legacy').replace(/[^0-9A-Za-z_-]/g,'')}`),
    offerId:String(contract.offerId || ''),
    clubId,
    clubName:String(contract.clubName || club.name || 'Club'),
    contractType:String(contract.contractType || 'normal'),
    source:String(contract.source || 'legacy'),
    status:String(contract.status || 'active'),
    signedDate:validIsoDate(contract.signedDate) ? contract.signedDate : (state?.currentDate || currentCalendarDate?.() || ''),
    startSeason,
    durationSeasons:duration,
    endSeason:startSeason + duration - 1,
    negotiationLevel:managerContractNegotiationLevel(contract.negotiationLevel || terms.negotiationLevel),
    negotiationLabel:String(contract.negotiationLabel || terms.negotiationLabel),
    managerPrestigeAtSigning:Number(contract.managerPrestigeAtSigning ?? pseudoOffer.managerPrestigeAtOffer),
    baseObjectivePpg:Number(contract.baseObjectivePpg ?? terms.baseObjectivePpg),
    finalObjectivePpg:Number(contract.finalObjectivePpg ?? terms.finalObjectivePpg),
    annualObjectives,
    monthlySalary,
    annualSalaries,
    futureSalePercent:clamp(Math.round(Number(contract.futureSalePercent ?? terms.futureSalePercent)), 5, managerContractFutureSaleMaximum()),
    salaryOfferFactor:Number.isFinite(Number(contract.salaryOfferFactor)) ? clamp(Number(contract.salaryOfferFactor), 0.40, 1.50) : Number(terms.salaryOfferFactor || 1),
    tablePosition:Math.max(0, Math.round(Number(contract.tablePosition || 0))),
    tableSize:Math.max(0, Math.round(Number(contract.tableSize || 0))),
    unemploymentDays:Math.max(0, Math.round(Number(contract.unemploymentDays || 0))),
    nextSalaryDate:validIsoDate(contract.nextSalaryDate) ? contract.nextSalaryDate : addDaysToIsoDate(validIsoDate(contract.signedDate) ? contract.signedDate : (state?.currentDate || currentCalendarDate()), 30),
    lastSalaryPaidDate:validIsoDate(contract.lastSalaryPaidDate) ? contract.lastSalaryPaidDate : '',
    salaryPayments:Math.max(0, Math.round(Number(contract.salaryPayments || 0))),
    totalSalaryPaid:Math.max(0, Math.round(Number(contract.totalSalaryPaid || 0))),
    transferBudgetRate:Number.isFinite(Number(contract.transferBudgetRate)) ? Number(contract.transferBudgetRate) : null
  };
  normalizedBase.nextSeasonNegotiation = normalizeManagerContractNextSeasonNegotiation(contract.nextSeasonNegotiation, normalizedBase, state);
  return normalizedBase;
}
function createManagerJobContractFromOffer(clubId, offer={}, negotiationLevel='normal', state=game){
  const club = seed?.clubs?.find(item => Number(item.id) === Number(clubId));
  if(!club) return null;
  const normalizedOffer = {
    ...offer,
    id:String(offer.id || `direct-contract-${club.id}-${state?.seasonNumber || 1}`),
    clubId:Number(club.id),
    contractType:String(offer.contractType || 'normal'),
    durationSeasons:clamp(Math.round(Number(offer.durationSeasons || managerContractDurationForOffer(club, offer, state))), 1, 3),
    managerPrestigeAtOffer:Number(offer.managerPrestigeAtOffer ?? managerContractStatePrestige(state)),
    baseObjectivePpg:Number(offer.baseObjectivePpg ?? managerObjectiveBaseForClubDivision(club.id)),
    futureSalePercent:Number(offer.futureSalePercent ?? managerContractFutureSalePercent(club, offer.id || '', state)),
    salaryOfferFactor:Number.isFinite(Number(offer.salaryOfferFactor)) ? Number(offer.salaryOfferFactor) : 1,
    tablePosition:Math.max(0, Math.round(Number(offer.tablePosition || 0))),
    tableSize:Math.max(0, Math.round(Number(offer.tableSize || 0))),
    unemploymentDays:Math.max(0, Math.round(Number(offer.unemploymentDays || 0)))
  };
  const terms = managerContractOfferTerms(normalizedOffer, negotiationLevel, state);
  if(!terms) return null;
  const signedDate = validIsoDate(state?.currentDate) ? state.currentDate : currentCalendarDate();
  return normalizeManagerJobContract({
    id:`manager-contract-${club.id}-${terms.startSeason}-${Date.now()}`,
    offerId:normalizedOffer.id,
    clubId:Number(club.id),
    clubName:String(club.name || 'Club'),
    contractType:normalizedOffer.contractType,
    source:String(normalizedOffer.source || 'direct'),
    status:'active',
    signedDate,
    startSeason:terms.startSeason,
    durationSeasons:terms.durationSeasons,
    endSeason:terms.endSeason,
    negotiationLevel:terms.negotiationLevel,
    negotiationLabel:terms.negotiationLabel,
    managerPrestigeAtSigning:normalizedOffer.managerPrestigeAtOffer,
    baseObjectivePpg:terms.baseObjectivePpg,
    finalObjectivePpg:terms.finalObjectivePpg,
    annualObjectives:terms.annualObjectives,
    monthlySalary:terms.monthlySalary,
    annualSalaries:terms.annualSalaries,
    futureSalePercent:terms.futureSalePercent,
    salaryOfferFactor:terms.salaryOfferFactor,
    tablePosition:normalizedOffer.tablePosition,
    tableSize:normalizedOffer.tableSize,
    unemploymentDays:normalizedOffer.unemploymentDays,
    nextSalaryDate:addDaysToIsoDate(signedDate, 30),
    lastSalaryPaidDate:'',
    salaryPayments:0,
    totalSalaryPaid:0,
    transferBudgetRate:normalizedOffer.transferBudgetRate
  }, state);
}
function ensureManagerFinancesState(state=game){
  if(!state) return null;
  const src = state.managerFinances && typeof state.managerFinances === 'object' && !Array.isArray(state.managerFinances) ? state.managerFinances : {};
  state.managerFinances = {
    balance:Math.round(Number(src.balance || 0)),
    totalIncome:Math.max(0, Math.round(Number(src.totalIncome || 0))),
    totalExpenses:Math.max(0, Math.round(Number(src.totalExpenses || 0))),
    totalSalaryIncome:Math.max(0, Math.round(Number(src.totalSalaryIncome || 0))),
    history:Array.isArray(src.history) ? src.history.slice(-500) : []
  };
  state.managerContractHistory = Array.isArray(state.managerContractHistory) ? state.managerContractHistory.slice(-100) : [];
  return state.managerFinances;
}
function recordManagerFinanceChange(delta, concept, meta={}, state=game){
  const finances = ensureManagerFinancesState(state);
  if(!finances) return 0;
  const amount = Math.round(Number(delta || 0));
  finances.balance += amount;
  if(amount >= 0) finances.totalIncome += amount;
  else finances.totalExpenses += Math.abs(amount);
  if(String(meta.type || '') === 'manager_salary') finances.totalSalaryIncome += Math.max(0, amount);
  finances.history.push({
    id:`manager-finance-${Date.now()}-${hashNumber(`${concept}-${state?.currentDate || ''}-${amount}`,99999)}`,
    date:state?.currentDate || '',
    season:Number(state?.seasonNumber || 1),
    concept:String(concept || 'Movimiento personal'),
    delta:amount,
    balance:finances.balance,
    ...meta
  });
  finances.history = finances.history.slice(-500);
  return amount;
}
function archiveManagerJobContract(reason='ended', state=game){
  if(!state?.managerJobContract) return null;
  ensureManagerFinancesState(state);
  const contract = normalizeManagerJobContract(state.managerJobContract, state);
  if(!contract) { state.managerJobContract = null; return null; }
  const archived = { ...contract, status:'ended', endReason:String(reason || 'ended'), endedDate:state.currentDate || '', endedSeason:Number(state.seasonNumber || 1) };
  if(!state.managerContractHistory.some(item => String(item.id) === String(archived.id))) state.managerContractHistory.push(archived);
  state.managerContractHistory = state.managerContractHistory.slice(-100);
  state.managerJobContract = null;
  return archived;
}
function ensureActiveManagerJobContract(state=game, options={}){
  if(!state || state.gameOver?.active || state.founderMode || state.challenge) return null;
  ensureManagerFinancesState(state);
  const clubId = Number(state.selectedClubId || 0);
  if(!clubId) return null;
  const current = normalizeManagerJobContract(state.managerJobContract, state);
  if(current && managerContractActiveForSeason(current, clubId, state.seasonNumber || 1)){
    state.managerJobContract = current;
    return current;
  }
  if(current) archiveManagerJobContract(options.reason || 'expired', state);
  const club = seed?.clubs?.find(item => Number(item.id) === clubId);
  if(!club) return null;
  const duration = options.initial ? 1 : managerContractDurationForOffer(club, { source:options.source || 'renewal', contractType:'normal' }, state);
  state.managerJobContract = createManagerJobContractFromOffer(clubId, {
    id:`auto-contract-${clubId}-${state.seasonNumber || 1}-${Date.now()}`,
    source:options.source || 'renewal',
    contractType:'normal',
    durationSeasons:duration,
    managerPrestigeAtOffer:managerContractStatePrestige(state),
    baseObjectivePpg:managerObjectiveBaseForClubDivision(clubId),
    futureSalePercent:managerContractFutureSalePercent(club, `${state.seasonNumber || 1}-${options.source || ''}`, state)
  }, options.negotiationLevel || 'normal', state);
  return state.managerJobContract;
}
function processManagerSalaryDaily(){
  if(!game || game.gameOver?.active || game.founderMode || game.challenge) return 0;
  const contract = ensureActiveManagerJobContract(game, { source:'daily_migration' });
  if(!contract || !managerContractActiveForSeason(contract, game.selectedClubId, game.seasonNumber)) return 0;
  const today = validIsoDate(game.currentDate) ? game.currentDate : currentCalendarDate();
  if(!validIsoDate(today) || !validIsoDate(contract.nextSalaryDate)) return 0;
  let total = 0;
  let guard = 0;
  while(daysBetweenIsoDates(contract.nextSalaryDate, today) >= 0 && guard < 24){
    const paymentDate = contract.nextSalaryDate;
    const salary = Math.max(0, Math.round(Number(managerContractMonthlySalaryForSeason(contract, game.seasonNumber) || 0)));
    if(salary > 0){
      if(typeof recordBudgetChange === 'function') recordBudgetChange(-salary, `Sueldo mensual del manager`, { type:'manager_salary_expense', managerContractId:contract.id, paymentDate });
      recordManagerFinanceChange(salary, `Sueldo de ${clubName(contract.clubId)}`, { type:'manager_salary', clubId:contract.clubId, contractId:contract.id, paymentDate });
      contract.salaryPayments += 1;
      contract.totalSalaryPaid += salary;
      contract.lastSalaryPaidDate = paymentDate;
      total += salary;
    }
    contract.nextSalaryDate = addDaysToIsoDate(paymentDate, 30);
    guard += 1;
  }
  game.managerJobContract = contract;
  if(total > 0){
    pushGameMessage({ type:'finanzas', priority:'normal', title:'Sueldo del manager acreditado', body:`${clubName(contract.clubId)} pagó ${formatMoney(total)}. El dinero ingresó en tu Cuenta Bancaria personal.`, id:`manager-salary-${contract.id}-${contract.lastSalaryPaidDate}` });
  }
  return total;
}
function managerContractScheduleMarkup(schedule=[], annualSalaries=[]){
  return `<div class="manager-contract-schedule">${schedule.map(item => {
    const salary = (Array.isArray(annualSalaries) ? annualSalaries : []).find(entry => Number(entry?.season) === Number(item?.season));
    return `<div class="manager-contract-year ${item.type === 'final' ? 'is-final' : ''}"><span>Año ${Number(item.contractYear || 1)}</span><strong>${Number(item.objectivePpg || 0).toFixed(2)} PPG</strong><small>${escapeHtml(item.label || (item.type === 'final' ? 'Objetivo final' : 'Mínimo de continuidad'))}</small>${salary ? `<small>Sueldo ${formatMoney(salary.monthlySalary)}/mes</small>` : ''}</div>`;
  }).join('')}</div>`;
}
function managerContractOfferPreviewMarkup(offer, level='normal'){
  const terms = managerContractOfferTerms(offer, level, game);
  if(!terms) return '';
  const durationDiscount = Math.round((1 - terms.durationSalaryFactor) * 100);
  return `<div class="manager-contract-preview">
    <div class="grid cols-3 compact-team-stats">
      <div><span>Sueldo mensual</span><strong>${formatMoney(terms.monthlySalary)}</strong></div>
      <div><span>Duración</span><strong>${terms.durationSeasons} temporada${terms.durationSeasons === 1 ? '' : 's'}</strong></div>
      <div><span>Venta futura</span><strong>${terms.futureSalePercent}%</strong></div>
    </div>
    ${managerContractScheduleMarkup(terms.annualObjectives, terms.annualSalaries)}
    <p class="muted small"><strong>${escapeHtml(terms.negotiationLabel || 'Condiciones base')}.</strong> ${durationDiscount > 0 ? `El contrato largo reduce ${durationDiscount}% el sueldo mensual a cambio de estabilidad. ` : ''}Las alternativas quedan fijadas para esta oferta.</p>
  </div>`;
}

function managerContractNextSeasonObjectiveBase(contract, targetSeason, state=game){
  const scheduled = managerContractScheduleEntry(contract, targetSeason);
  if(Number.isFinite(Number(scheduled?.objectivePpg))) return Number(scheduled.objectivePpg);
  const currentStep = managerContractScheduleEntry(contract, Number(state?.seasonNumber || 1));
  if(Number.isFinite(Number(currentStep?.objectivePpg))) return Number(currentStep.objectivePpg);
  const info = typeof managerObjectiveProgressInfo === 'function' ? managerObjectiveProgressInfo() : null;
  if(Number.isFinite(Number(info?.objective))) return Number(info.objective);
  return Number(managerObjectiveBaseForClubDivision(contract?.clubId || state?.selectedClubId || 0) || 0);
}
function managerContractNextSeasonNegotiationEligibility(contract=game?.managerJobContract, state=game){
  const normalized = normalizeManagerJobContract(contract, state);
  if(!normalized || !state || state.gameOver?.active || state.founderMode || state.challenge) return { eligible:false, reason:'inactive', contract:normalized };
  const season = Number(state.seasonNumber || 1);
  const targetSeason = season + 1;
  const existing = normalized.nextSeasonNegotiation;
  if(existing && Number(existing.targetSeason) === targetSeason) return { eligible:existing.status === 'available', existing, contract:normalized, season, targetSeason, reason:existing.status };
  const info = typeof managerObjectiveProgressInfo === 'function' ? managerObjectiveProgressInfo() : null;
  const cfg = managerContractBalanceConfig().renegociacionTemporadaSiguiente || {};
  const enoughMatches = cfg.exigirPartidosMinimos === false || Number(info?.played || 0) >= Number(info?.minMatches || 1);
  const objectiveMet = Boolean(info?.active && enoughMatches && Number(info.ppg || 0) >= Number(info.objective || 0));
  return { eligible:objectiveMet, contract:normalized, season, targetSeason, info, reason:objectiveMet ? 'objective_met' : 'objective_pending' };
}
function processManagerContractNextSeasonNegotiationUnlock({ notify=true }={}){
  const eligibility = managerContractNextSeasonNegotiationEligibility(game?.managerJobContract, game);
  const contract = eligibility.contract;
  if(!contract || !eligibility.eligible){
    if(contract && game) game.managerJobContract = contract;
    return { changed:false, ...eligibility };
  }
  if(eligibility.existing){
    if(game) game.managerJobContract = contract;
    return { changed:false, ...eligibility };
  }
  const targetSeason = eligibility.targetSeason;
  const baseMonthlySalary = managerContractMonthlySalaryForSeason(contract, eligibility.season);
  const baseObjectivePpg = managerContractNextSeasonObjectiveBase(contract, targetSeason, game);
  contract.nextSeasonNegotiation = {
    eligibleSeason:eligibility.season,
    targetSeason,
    status:'available',
    choice:'',
    label:'',
    salaryFactor:1,
    objectiveFactor:1,
    baseMonthlySalary,
    negotiatedMonthlySalary:baseMonthlySalary,
    baseObjectivePpg:Number(baseObjectivePpg.toFixed(3)),
    negotiatedObjectivePpg:Number(baseObjectivePpg.toFixed(3)),
    unlockedDate:validIsoDate(game?.currentDate) ? game.currentDate : currentCalendarDate(),
    agreedDate:'',
    appliedDate:'',
    notified:Boolean(notify)
  };
  game.managerJobContract = contract;
  if(notify){
    pushGameMessage({
      type:'directiva',
      priority:'normal',
      title:'Objetivo cumplido: contrato negociable',
      body:`Cumpliste el objetivo vigente con ${Number(eligibility.info?.ppg || 0).toFixed(2)} PPG. Ya podés negociar con ${clubName(contract.clubId)} el sueldo y el objetivo de la temporada ${targetSeason} desde Carrera → Contrato actual.`,
      id:`manager-contract-negotiation-unlocked-${contract.id}-${targetSeason}`
    });
  }
  return { changed:true, ...eligibility, contract };
}
function managerContractApplyNegotiatedTerms(contract, agreement, targetSeason){
  if(!contract || !agreement || String(agreement.status || '') !== 'agreed') return contract;
  const objective = Math.max(0.30, Math.min(3, Number(agreement.negotiatedObjectivePpg || agreement.baseObjectivePpg || 0)));
  const salary = Math.max(100000, Math.round(Number(agreement.negotiatedMonthlySalary || agreement.baseMonthlySalary || contract.monthlySalary || 0)));
  const objectiveEntry = (contract.annualObjectives || []).find(item => Number(item.season) === Number(targetSeason));
  if(objectiveEntry){
    objectiveEntry.objectivePpg = Number(objective.toFixed(3));
    objectiveEntry.label = agreement.choice === 'aumento' ? 'Objetivo renegociado por aumento' : 'Objetivo renegociado por reducción salarial';
  }
  const salaryEntry = (contract.annualSalaries || []).find(item => Number(item.season) === Number(targetSeason));
  if(salaryEntry){
    salaryEntry.monthlySalary = salary;
    salaryEntry.source = 'renegotiated';
  }
  return contract;
}
function negotiateManagerContractNextSeason(choice){
  processManagerContractNextSeasonNegotiationUnlock({ notify:false });
  const contract = normalizeManagerJobContract(game?.managerJobContract, game);
  const agreement = contract?.nextSeasonNegotiation;
  if(!contract || !agreement || String(agreement.status || '') !== 'available'){
    showNotice('La negociación para la próxima temporada no está disponible.');
    return false;
  }
  const config = managerContractNextSeasonNegotiationConfig(choice);
  const previewSalary = Math.max(100000, Math.round(Number(agreement.baseMonthlySalary || 0) * config.salaryFactor));
  const previewObjective = Number(Math.max(0.30, Math.min(3, Number(agreement.baseObjectivePpg || 0) * config.objectiveFactor)).toFixed(3));
  const confirmed = typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm(`${config.label} para la temporada ${agreement.targetSeason}?\n\nSueldo mensual: ${formatMoney(previewSalary)}\nObjetivo: ${previewObjective.toFixed(2)} PPG\n\nEl acuerdo se puede realizar una sola vez para ese año.`)
    : true;
  if(!confirmed) return false;
  agreement.status = 'agreed';
  agreement.choice = config.key;
  agreement.label = config.label;
  agreement.salaryFactor = config.salaryFactor;
  agreement.objectiveFactor = config.objectiveFactor;
  agreement.negotiatedMonthlySalary = previewSalary;
  agreement.negotiatedObjectivePpg = previewObjective;
  agreement.agreedDate = validIsoDate(game?.currentDate) ? game.currentDate : currentCalendarDate();
  agreement.notified = true;
  managerContractApplyNegotiatedTerms(contract, agreement, agreement.targetSeason);
  game.managerJobContract = contract;
  pushGameMessage({
    type:'directiva',
    priority:'normal',
    title:'Acuerdo para la próxima temporada',
    body:`${clubName(contract.clubId)} aceptó ${config.label.toLowerCase()}. En la temporada ${agreement.targetSeason} cobrarás ${formatMoney(agreement.negotiatedMonthlySalary)} por mes y el objetivo será ${agreement.negotiatedObjectivePpg.toFixed(2)} PPG.`,
    id:`manager-contract-negotiation-agreed-${contract.id}-${agreement.targetSeason}`
  });
  saveLocal(true);
  renderAll();
  showNotice('Negociación acordada para la próxima temporada.');
  return true;
}
function managerContractNextSeasonNegotiationMarkup(contract, objectiveInfo){
  const eligibility = managerContractNextSeasonNegotiationEligibility(contract, game);
  const agreement = contract?.nextSeasonNegotiation;
  const targetSeason = Number(game?.seasonNumber || 1) + 1;
  if(agreement && Number(agreement.targetSeason) === targetSeason && ['agreed','applied'].includes(String(agreement.status || ''))){
    const salaryDelta = Math.round((Number(agreement.salaryFactor || 1) - 1) * 100);
    const objectiveDelta = Math.round((Number(agreement.objectiveFactor || 1) - 1) * 100);
    return `<div class="card" style="margin-top:14px"><div class="row"><div><p class="label">Temporada ${targetSeason}</p><h3>Negociación acordada</h3></div><span class="pill">${escapeHtml(agreement.label || 'Acuerdo')}</span></div><div class="grid cols-2 compact-team-stats" style="margin-top:12px"><div><span>Sueldo mensual</span><strong>${formatMoney(agreement.negotiatedMonthlySalary)}</strong><small>${salaryDelta >= 0 ? '+' : ''}${salaryDelta}%</small></div><div><span>Objetivo</span><strong>${Number(agreement.negotiatedObjectivePpg || 0).toFixed(2)} PPG</strong><small>${objectiveDelta >= 0 ? '+' : ''}${objectiveDelta}%</small></div></div><p class="muted small">El acuerdo afecta únicamente la temporada ${targetSeason}.</p></div>`;
  }
  if(eligibility.eligible){
    const raise = managerContractNextSeasonNegotiationConfig('aumento');
    const reduce = managerContractNextSeasonNegotiationConfig('reduccion');
    const baseSalary = Number(agreement?.baseMonthlySalary || managerContractMonthlySalaryForSeason(contract, game.seasonNumber));
    const baseObjective = Number(agreement?.baseObjectivePpg || managerContractNextSeasonObjectiveBase(contract, targetSeason, game));
    return `<div class="card" style="margin-top:14px"><div class="row"><div><p class="label">Objetivo vigente cumplido</p><h3>Negociar la temporada ${targetSeason}</h3></div><span class="pill ok">Disponible</span></div><p class="muted small">Podés mejorar el sueldo aceptando una exigencia mayor, o reducirlo para bajar el objetivo. El año actual no cambia.</p><div class="grid cols-2" style="margin-top:12px"><div class="card"><h3>Solicitar aumento</h3><p><strong>${formatMoney(Math.round(baseSalary * raise.salaryFactor))}</strong> por mes</p><p class="muted small">Sueldo +20% · objetivo ${Number(Math.min(3, baseObjective * raise.objectiveFactor)).toFixed(2)} PPG (+30%).</p><button type="button" class="primary" data-negotiate-next-contract="aumento">Pedir 20% de aumento</button></div><div class="card"><h3>Reducir exigencia</h3><p><strong>${formatMoney(Math.round(baseSalary * reduce.salaryFactor))}</strong> por mes</p><p class="muted small">Sueldo -20% · objetivo ${Number(Math.max(0.30, baseObjective * reduce.objectiveFactor)).toFixed(2)} PPG (-10%).</p><button type="button" class="ghost" data-negotiate-next-contract="reduccion">Aceptar 20% menos</button></div></div></div>`;
  }
  const remaining = Math.max(0, Number(objectiveInfo?.minMatches || 0) - Number(objectiveInfo?.played || 0));
  const statusText = remaining > 0
    ? `La negociación se habilita cuando alcances el objetivo y completes los ${objectiveInfo?.minMatches || 0} partidos mínimos de evaluación.`
    : `La negociación se habilita cuando tu promedio alcance el objetivo vigente de ${Number(objectiveInfo?.objective || 0).toFixed(2)} PPG.`;
  return `<div class="card" style="margin-top:14px"><p class="label">Próxima temporada</p><h3>Negociación todavía bloqueada</h3><p class="muted small">${escapeHtml(statusText)}</p></div>`;
}
function bindManagerContractNextSeasonNegotiationActions(){
  document.querySelectorAll('[data-negotiate-next-contract]').forEach(button => button.addEventListener('click', () => {
    negotiateManagerContractNextSeason(button.dataset.negotiateNextContract || 'aumento');
  }));
}
function managerContractActivateNegotiatedSeason(contract, season=game?.seasonNumber || 1){
  const normalized = normalizeManagerJobContract(contract, game);
  const agreement = normalized?.nextSeasonNegotiation;
  if(!normalized || !agreement || Number(agreement.targetSeason) !== Number(season) || String(agreement.status || '') !== 'agreed') return normalized;
  managerContractApplyNegotiatedTerms(normalized, agreement, season);
  agreement.status = 'applied';
  agreement.appliedDate = validIsoDate(game?.currentDate) ? game.currentDate : currentCalendarDate();
  return normalized;
}

/* Amplía las ofertas laborales existentes con duración, sueldo y porcentaje futuro. */
const normalizeManagerJobMarketStateV764 = normalizeManagerJobMarketState;
normalizeManagerJobMarketState = function(state={}){
  const normalized = normalizeManagerJobMarketStateV764(state);
  normalized.offers = normalized.offers.map(offer => {
    const club = seed?.clubs?.find(item => Number(item.id) === Number(offer.clubId));
    if(!club) return offer;
    const realism = managerJobOfferRealismTerms(club, offer.id || '', game);
    return {
      ...offer,
      durationSeasons:clamp(Math.round(Number(offer.durationSeasons || managerContractDurationForOffer(club, offer, game))), 1, 3),
      baseObjectivePpg:Number.isFinite(Number(offer.baseObjectivePpg)) ? Number(offer.baseObjectivePpg) : Number(managerObjectiveBaseForClubDivision(club.id)),
      salaryOfferFactor:Number.isFinite(Number(offer.salaryOfferFactor)) ? clamp(Number(offer.salaryOfferFactor), 0.40, 1.50) : realism.salaryOfferFactor,
      futureSalePercent:clamp(Math.round(Number(offer.futureSalePercent ?? realism.futureSalePercent)), 5, managerContractFutureSaleMaximum()),
      tablePosition:Math.max(0, Math.round(Number(offer.tablePosition || realism.tablePosition || 0))),
      tableSize:Math.max(0, Math.round(Number(offer.tableSize || realism.tableSize || 0))),
      tableRatio:Number.isFinite(Number(offer.tableRatio)) ? clamp(Number(offer.tableRatio), 0, 1) : realism.tableRatio,
      unemploymentDays:Math.max(0, Math.round(Number(offer.unemploymentDays ?? realism.unemploymentDays ?? 0)))
    };
  });
  return normalized;
};
managerJobCreateOffer = function(clubId, options={}){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  if((typeof managerClubCareerEligible === 'function' && !managerClubCareerEligible(club)) || !club || (!game?.gameOver?.active && options.allowWhileEmployed !== true)) return null;
  const state = ensureManagerJobMarketState();
  if(typeof managerJobClubBlockedByRejectedApplication === 'function' && managerJobClubBlockedByRejectedApplication(club)) return null;
  if(state.offers.some(o => Number(o.clubId) === Number(club.id))) return null;
  const today = currentCalendarDate();
  const contractType = String(options.contractType || 'normal');
  const offer = {
    id:`job-offer-${club.id}-${today}-${Date.now()}-${hashNumber(`${club.id}-${today}-${contractType}`, 9999)}`,
    clubId:Number(club.id),
    source:String(options.source || 'incoming'),
    contractType,
    createdDate:today,
    expiresDate:addDaysToIsoDate(today, clamp(Math.round(Number(options.responseDays || 20)), 10, 30)),
    managerPrestigeAtOffer:currentManagerPrestige(),
    objectiveBonus:contractType === 'high_risk' ? 0.25 : 0,
    transferBudgetRate:contractType === 'high_risk' ? 0.05 : null,
    rejectionChance:Number.isFinite(Number(options.rejectionChance)) ? clamp(Number(options.rejectionChance), 1, 20) : 1,
    note:String(options.note || '')
  };
  offer.durationSeasons = managerContractDurationForOffer(club, offer, game);
  offer.baseObjectivePpg = Number(managerObjectiveBaseForClubDivision(club.id));
  Object.assign(offer, managerJobOfferRealismTerms(club, offer.id, game));
  state.offers.push(offer);
  state.log.push({ type:'offer', clubId:offer.clubId, contractType, durationSeasons:offer.durationSeasons, date:today, source:offer.source });
  return offer;
};
managerJobOfferObjectiveDetails = function(offer, clubId=offer?.clubId, negotiationLevel='normal'){
  const terms = managerContractOfferTerms(offer, negotiationLevel, game);
  if(!terms) return { objectiveText:'Sin objetivo', restrictionText:'', baseLabel:'—', finalLabel:'—', highRisk:false, budgetRate:null };
  const highRisk = terms.highRisk;
  const restrictionText = highRisk
    ? `Restricción de fichajes: presupuesto muy limitado, aprox. ${Math.round(clamp(Number(offer?.transferBudgetRate || 0.05), 0.01, 1) * 100)}% del margen normal autorizado.`
    : 'Restricción de fichajes: condiciones normales del club.';
  return {
    objectiveText:`Objetivo final: ${terms.finalObjectivePpg.toFixed(2)} pts/partido.`,
    restrictionText,
    baseLabel:terms.baseObjectivePpg.toFixed(2),
    finalLabel:terms.finalObjectivePpg.toFixed(2),
    highRisk,
    budgetRate:highRisk ? clamp(Number(offer?.transferBudgetRate || 0.05), 0.01, 1) : null,
    terms
  };
};
managerJobOfferCard = function(offer){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(offer.clubId));
  if(!club) return '';
  const division = clubDivision(club.id);
  const highRisk = String(offer.contractType || '') === 'high_risk';
  const tag = highRisk ? 'Contrato exigente' : `${Number(offer.durationSeasons || 1)} temporada${Number(offer.durationSeasons || 1) === 1 ? '' : 's'}`;
  const defaultLevel = highRisk ? 'ambicioso' : 'normal';
  const standingText = Number(offer.tablePosition || 0) && Number(offer.tableSize || 0) ? ` · Puesto ${Number(offer.tablePosition)}/${Number(offer.tableSize)}` : '';
  const waitText = Number(offer.unemploymentDays || 0) > 0 ? ` · ${Number(offer.unemploymentDays)} día(s) sin club` : '';
  return `<article class="card job-offer-card ${highRisk ? 'warn' : ''}" data-job-offer-card="${escapeHtml(offer.id)}">
    <div class="row"><div><p class="label">Oferta laboral · vence ${escapeHtml(offer.expiresDate || '—')}</p><h3>${escapeHtml(club.name || 'Club')}</h3></div><span class="pill ${highRisk ? 'warn' : 'ok'}">${escapeHtml(tag)}</span></div>
    <p class="muted small">${escapeHtml(division?.name || 'Liga')}${standingText} · Prestigio ${clubPrestigeValue(club)}${waitText} · Sueldo ajustado al contexto del club · ${Number(offer.futureSalePercent || 5)}% sobre la futura primera venta de juveniles promovidos durante este contrato.</p>
    ${highRisk ? '<p class="small"><strong>La diferencia de prestigio impone un objetivo ambicioso y un contrato de una sola temporada.</strong></p>' : `<label class="job-negotiation-label">Negociar condiciones<select data-job-negotiation="${escapeHtml(offer.id)}">${managerContractOfferNegotiationOptionsMarkup(offer, 'normal')}</select></label>`}
    <div data-job-offer-preview="${escapeHtml(offer.id)}">${managerContractOfferPreviewMarkup(offer, defaultLevel)}</div>
    <div class="row message-actions"><button class="primary" data-accept-job-offer="${escapeHtml(offer.id)}">Aceptar cargo</button><button class="ghost" data-reject-job-offer="${escapeHtml(offer.id)}">Rechazar</button></div>
  </article>`;
};
bindManagerJobMarketActions = function(){
  document.querySelectorAll('[data-accept-job-offer]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    const offerId = btn.dataset.acceptJobOffer || '';
    const select = document.querySelector(`[data-job-negotiation="${CSS.escape(offerId)}"]`);
    acceptManagerJobOffer(offerId, select?.value || 'normal');
  }));
  document.querySelectorAll('[data-reject-job-offer]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    rejectManagerJobOffer(btn.dataset.rejectJobOffer || '');
  }));
  document.querySelectorAll('[data-apply-job-club]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    applyForManagerJob(Number(btn.dataset.applyJobClub || 0));
  }));
  document.querySelectorAll('[data-job-negotiation]').forEach(select => select.addEventListener('change', () => {
    const offerId = select.dataset.jobNegotiation || '';
    const state = ensureManagerJobMarketState();
    const offer = state.offers.find(item => String(item.id) === String(offerId));
    const target = document.querySelector(`[data-job-offer-preview="${CSS.escape(offerId)}"]`);
    if(offer && target) target.innerHTML = managerContractOfferPreviewMarkup(offer, select.value || 'normal');
  }));
};
acceptManagerJobOffer = function(offerId, negotiationLevel='normal'){
  const state = ensureManagerJobMarketState();
  const offer = state.offers.find(item => String(item.id) === String(offerId));
  if(!offer){ showNotice('La oferta ya no está disponible.'); return; }
  continueCareerAtClub(offer.clubId, {
    jobOffer:offer,
    contractNegotiationLevel:String(offer.contractType || '') === 'high_risk' ? 'ambicioso' : managerContractNegotiationLevel(negotiationLevel),
    allowHighRiskContract:String(offer.contractType || '') === 'high_risk'
  });
};
managerJobContractForClubSeason = function(clubId=game?.selectedClubId, season=game?.seasonNumber || 1){
  const contract = normalizeManagerJobContract(game?.managerJobContract, game);
  if(!managerContractActiveForSeason(contract, clubId, season)) return null;
  if(game) game.managerJobContract = contract;
  return contract;
};
applyManagerJobContractToObjectiveFields = function(fields, clubId=game?.selectedClubId, season=game?.seasonNumber || 1){
  const clean = { ...(fields || {}) };
  const contract = managerJobContractForClubSeason(clubId, season);
  if(!contract) return clean;
  const step = managerContractScheduleEntry(contract, season);
  if(!step) return clean;
  clean.objectiveBasePpg = Number(contract.baseObjectivePpg || clean.objectiveBasePpg || 0);
  const contractObjectivePpg = Number(step.objectivePpg || clean.objectivePpg || 0);
  const objectiveReduction = typeof managerObjectiveReductionForClub === 'function' ? managerObjectiveReductionForClub(clubId) : 0;
  clean.objectiveContractPpg = contractObjectivePpg;
  clean.objectiveBonusReduction = objectiveReduction;
  clean.objectivePpg = typeof applyManagerObjectiveReduction === 'function'
    ? applyManagerObjectiveReduction(contractObjectivePpg, clubId)
    : contractObjectivePpg;
  clean.objectiveJobContractBonus = Number((contractObjectivePpg - clean.objectiveBasePpg).toFixed(3));
  clean.objectiveSource = step.type === 'final' ? 'contrato_objetivo_final' : 'contrato_minimo_anual';
  clean.objectiveExpectation = step.type === 'final' ? 'Objetivo final del contrato' : 'Mínimo de continuidad contractual';
  clean.objectiveLabel = `${clean.objectivePpg.toFixed(2)} · ${step.type === 'final' ? 'objetivo final' : `mínimo año ${step.contractYear}`}${objectiveReduction > 0 ? ` · cartas -${objectiveReduction}%` : ''}`;
  clean.objectiveContractId = contract.id;
  clean.objectiveContractYear = Number(step.contractYear || 1);
  clean.objectiveContractDuration = Number(contract.durationSeasons || 1);
  clean.objectiveBaseMatches = managerObjectiveMinMatchesForObjective(clean.objectivePpg);
  clean.objectiveMinMatches = clean.objectiveBaseMatches + Math.max(0, Number(clean.objectiveExtraMatches || 0));
  return clean;
};

const renderCareerJobsV764 = renderCareerJobs;
renderCareerJobs = function(){
  if(game?.gameOver?.active){ renderCareerJobsV764(); return; }
  let contract = ensureActiveManagerJobContract(game, { source:'contract_view' });
  if(!contract){ renderCareerJobsV764(); return; }
  const unlock = processManagerContractNextSeasonNegotiationUnlock({ notify:true });
  contract = normalizeManagerJobContract(game.managerJobContract, game);
  if(unlock.changed) saveLocal(true);
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  const step = managerContractScheduleEntry(contract, game.seasonNumber);
  const objectiveInfo = managerObjectiveProgressInfo();
  const played = Number(objectiveInfo?.played || 0);
  const ppg = Number(objectiveInfo?.ppg || 0);
  const currentYear = Number(game.seasonNumber || 1) - Number(contract.startSeason || 1) + 1;
  const currentMonthlySalary = managerContractMonthlySalaryForSeason(contract, game.seasonNumber);
  const restriction = contract.contractType === 'high_risk'
    ? `Presupuesto de fichajes limitado al ${Math.round(Number(contract.transferBudgetRate || 0.05) * 100)}% del margen normal.`
    : 'Sin restricciones especiales sobre el presupuesto de fichajes.';
  view.innerHTML = `<div class="row section-title"><div><h2>Contrato actual</h2><p class="tagline">Sueldo, duración y objetivos acordados con el club.</p></div><span class="pill">Año ${currentYear} de ${contract.durationSeasons}</span></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Club</p><strong>${clubBadge(contract.clubId)} ${escapeHtml(clubName(contract.clubId))}</strong></div>
      <div class="card"><p class="label">Sueldo mensual</p><strong>${formatMoney(currentMonthlySalary)}</strong></div>
      <div class="card"><p class="label">Próximo pago</p><strong>${escapeHtml(contract.nextSalaryDate || '—')}</strong></div>
      <div class="card"><p class="label">Futura venta juvenil</p><strong>${Number(contract.futureSalePercent || 0)}%</strong></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="row"><div><p class="label">Plan deportivo</p><h3>${escapeHtml(contract.negotiationLabel || 'Objetivo normal')}</h3></div><span class="pill">Hasta temporada ${contract.endSeason}</span></div>${managerContractScheduleMarkup(contract.annualObjectives, contract.annualSalaries)}</div>
    <div class="grid cols-2" style="margin-top:14px">
      <div class="card"><p class="label">Exigencia vigente</p><h3>${Number(objectiveInfo?.objective ?? step?.objectivePpg ?? 0).toFixed(2)} puntos por partido</h3><p class="muted small">${step?.type === 'final' ? 'Es el objetivo final del contrato.' : 'Es el mínimo necesario para mantener la continuidad del proyecto.'}${Number(objectiveInfo?.bonusReduction || 0) > 0 ? ` Reducción permanente por cartas esta temporada: ${Number(objectiveInfo.bonusReduction).toFixed(0)}%.` : ''} Rendimiento actual: ${ppg.toFixed(2)} en ${played} encuentros oficiales.</p></div>
      <div class="card"><p class="label">Condiciones laborales</p><h3>${escapeHtml(restriction)}</h3><p class="muted small">El sueldo es fijo durante todo el contrato. Cambiar de club o renunciar termina los pagos pendientes.</p></div>
    </div>
    <div class="card" style="margin-top:14px"><p class="label">Porcentaje de formación</p><h3>${Number(contract.futureSalePercent || 0)}% sobre futuras ventas</h3><p class="muted small">Se asigna automáticamente a cada juvenil que promociones durante este contrato. Conservás el derecho aunque cambies de club, renuncies o seas despedido; se cobra una sola vez en la primera transferencia pagada.</p></div>
    ${managerContractNextSeasonNegotiationMarkup(contract, objectiveInfo)}`;
  bindManagerContractNextSeasonNegotiationActions();
};

/* Envuelve los flujos existentes para crear, conservar o cerrar contratos. */
const continueCareerAtClubV764 = continueCareerAtClub;
continueCareerAtClub = function(selectedClubId, options={}){
  const offerCopy = options.jobOffer ? { ...options.jobOffer } : null;
  const previousContract = game?.managerJobContract ? normalizeManagerJobContract(game.managerJobContract, game) : null;
  continueCareerAtClubV764(selectedClubId, options);
  if(!game || game.gameOver?.active || Number(game.selectedClubId || 0) !== Number(selectedClubId || 0)) return;
  if(previousContract){
    game.managerJobContract = previousContract;
    archiveManagerJobContract('nuevo_club', game);
  }
  const club = seed?.clubs?.find(item => Number(item.id) === Number(selectedClubId));
  const directOfferRealism = offerCopy ? null : managerJobOfferRealismTerms(club, `career-change-${game.seasonNumber || 1}-${game.globalTurn || 0}`, game);
  const offer = offerCopy || {
    id:`direct-job-${selectedClubId}-${game.seasonNumber || 1}-${Date.now()}`,
    clubId:Number(selectedClubId),
    source:'career_change',
    contractType:'normal',
    durationSeasons:managerContractDurationForOffer(club, { source:'career_change', contractType:'normal' }, game),
    managerPrestigeAtOffer:currentManagerPrestige(),
    baseObjectivePpg:managerObjectiveBaseForClubDivision(selectedClubId),
    ...directOfferRealism
  };
  game.managerJobContract = createManagerJobContractFromOffer(selectedClubId, offer, options.contractNegotiationLevel || 'normal', game);
  ensureManagerFinancesState(game);
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  saveLocal(true);
  renderAll();
};
const resignCurrentClubV764 = resignCurrentClub;
resignCurrentClub = function(){
  const before = game?.gameOver?.triggeredAt || '';
  resignCurrentClubV764();
  if(game?.gameOver?.active && game.gameOver.type === 'resignation' && game.gameOver.triggeredAt !== before){
    archiveManagerJobContract('renuncia', game);
    saveLocal(true);
    renderAll();
  }
};
const checkManagerObjectiveGameOverV764 = checkManagerObjectiveGameOver;
checkManagerObjectiveGameOver = function(){
  const dismissed = checkManagerObjectiveGameOverV764();
  if(dismissed){ archiveManagerJobContract('despido', game); saveLocal(true); }
  else {
    const unlock = processManagerContractNextSeasonNegotiationUnlock({ notify:true });
    if(unlock.changed) saveLocal(true);
  }
  return dismissed;
};
const startNextSeasonV764 = startNextSeason;
startNextSeason = function(selectedClubId, options={}){
  const previousSeason = Number(game?.seasonNumber || 1);
  const previousClubId = Number(game?.selectedClubId || 0);
  const previousContract = game?.managerJobContract ? normalizeManagerJobContract(game.managerJobContract, game) : null;
  const previousNegotiation = previousContract?.nextSeasonNegotiation && Number(previousContract.nextSeasonNegotiation.targetSeason) === previousSeason + 1 && String(previousContract.nextSeasonNegotiation.status || '') === 'agreed'
    ? { ...previousContract.nextSeasonNegotiation }
    : null;
  const previousStepBeforeTransition = previousContract ? managerContractScheduleEntry(previousContract, previousSeason) : null;
  const previousTotalsBeforeTransition = { ...(game?.managerStats?.currentSeason || {}) };
  const previousPpgBeforeTransition = ppgFromTotals(previousTotalsBeforeTransition);
  const transitionResult = startNextSeasonV764(selectedClubId, options);
  if(!game || Number(game.seasonNumber || 0) !== previousSeason + 1) return transitionResult;
  const changedClub = Number(game.selectedClubId || 0) !== previousClubId;
  if(changedClub && previousContract){
    game.managerJobContract = previousContract;
    archiveManagerJobContract('cambio_fin_temporada', game);
  }
  if(!changedClub && previousContract && managerContractActiveForSeason(previousContract, game.selectedClubId, game.seasonNumber)){
    game.managerJobContract = managerContractActivateNegotiatedSeason(previousContract, game.seasonNumber);
  }else{
    if(!changedClub && previousContract){
      game.managerJobContract = previousContract;
      archiveManagerJobContract('fin_contrato', game);
    }
    const club = seed?.clubs?.find(item => Number(item.id) === Number(game.selectedClubId));
    const source = changedClub ? 'cambio_fin_temporada' : 'renovacion_automatica';
    const previousStep = previousStepBeforeTransition;
    const archivedTotals = game.managerStats?.seasons?.find(item => Number(item.season) === previousSeason && Number(item.clubId) === previousClubId) || {};
    const previousPpg = Number.isFinite(Number(archivedTotals.ppg)) ? Number(archivedTotals.ppg) : previousPpgBeforeTransition;
    const renewalMet = !previousStep || previousPpg >= Number(previousStep.objectivePpg || 0);
    const renewalLevel = changedClub ? 'normal' : (renewalMet ? 'normal' : 'prudente');
    const offer = {
      id:`${source}-${game.selectedClubId}-${game.seasonNumber}-${Date.now()}`,
      clubId:Number(game.selectedClubId),
      source,
      contractType:'normal',
      durationSeasons:(!changedClub && !renewalMet) ? 1 : managerContractDurationForOffer(club, { source, contractType:'normal' }, game),
      managerPrestigeAtOffer:currentManagerPrestige(),
      baseObjectivePpg:managerObjectiveBaseForClubDivision(game.selectedClubId),
      futureSalePercent:managerContractFutureSalePercent(club, source, game)
    };
    game.managerJobContract = createManagerJobContractFromOffer(game.selectedClubId, offer, renewalLevel, game);
    if(!changedClub && previousNegotiation){
      const importedAgreement = { ...previousNegotiation, status:'agreed' };
      game.managerJobContract.nextSeasonNegotiation = importedAgreement;
      managerContractApplyNegotiatedTerms(game.managerJobContract, importedAgreement, game.seasonNumber);
      game.managerJobContract = managerContractActivateNegotiatedSeason(game.managerJobContract, game.seasonNumber);
    }
    const renewalText = !changedClub && !renewalMet ? ' El objetivo final anterior no se cumplió: la renovación es por una temporada, con objetivo prudente y sueldo reducido.' : (previousNegotiation ? ` Se aplicó el acuerdo previo: sueldo ${formatMoney(game.managerJobContract ? managerContractMonthlySalaryForSeason(game.managerJobContract, game.seasonNumber) : 0)} y objetivo ${Number(managerContractScheduleEntry(game.managerJobContract, game.seasonNumber)?.objectivePpg || 0).toFixed(2)} PPG para este año.` : '');
    pushGameMessage({ type:'directiva', priority:'normal', title:changedClub ? 'Contrato con nuevo club' : 'Contrato renovado', body:`${clubName(game.selectedClubId)} acordó un contrato de ${game.managerJobContract.durationSeasons} temporada(s), sueldo mensual de ${formatMoney(managerContractMonthlySalaryForSeason(game.managerJobContract, game.seasonNumber))} y ${game.managerJobContract.futureSalePercent}% sobre futuras ventas de juveniles promovidos.${renewalText}`, id:`manager-contract-season-${game.seasonNumber}-${game.selectedClubId}` });
  }
  ensureManagerFinancesState(game);
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  saveLocal(true);
  renderAll();
  return transitionResult;
};
const newGameV764 = newGame;
newGame = function(selectedClubId, options={}){
  newGameV764(selectedClubId, options);
  if(!game) return;
  ensureManagerFinancesState(game);
  if(!options.founderMode && !options.challengeId){
    game.managerJobContract = createManagerJobContractFromOffer(selectedClubId, {
      id:`initial-contract-${selectedClubId}-1`,
      clubId:Number(selectedClubId),
      source:'inicio_carrera',
      contractType:'normal',
      durationSeasons:1,
      managerPrestigeAtOffer:currentManagerPrestige(),
      baseObjectivePpg:managerObjectiveBaseForClubDivision(selectedClubId),
      futureSalePercent:managerContractFutureSalePercent(seed.clubs.find(item => Number(item.id) === Number(selectedClubId)), 'initial', game)
    }, options.contractNegotiationLevel || 'normal', game);
    game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  }
  saveLocal(true);
  renderAll();
};
const normalizeGameV764 = normalizeGame;
normalizeGame = function(saved){
  const normalized = normalizeGameV764(saved);
  const hadManagerFinances = Boolean(normalized.managerFinances && typeof normalized.managerFinances === 'object' && !Array.isArray(normalized.managerFinances));
  const hadManagerContract = Boolean(normalized.managerJobContract && typeof normalized.managerJobContract === 'object' && !Array.isArray(normalized.managerJobContract));
  const hadAnnualSalarySchedule = Boolean(Array.isArray(normalized.managerJobContract?.annualSalaries) && normalized.managerJobContract.annualSalaries.length);
  ensureManagerFinancesState(normalized);
  normalized.managerJobContract = normalizeManagerJobContract(normalized.managerJobContract, normalized);
  if(!hadManagerFinances || (hadManagerContract && (!normalized.managerJobContract || !hadAnnualSalarySchedule))) normalized._needsAutosave = true;
  if(!normalized.managerJobContract && !normalized.gameOver?.active && !normalized.founderMode && !normalized.challenge){
    normalized.managerJobContract = createManagerJobContractFromOffer(normalized.selectedClubId, {
      id:`migration-contract-${normalized.selectedClubId}-${normalized.seasonNumber || 1}`,
      clubId:Number(normalized.selectedClubId),
      source:'migracion_v765',
      contractType:'normal',
      durationSeasons:1,
      managerPrestigeAtOffer:managerContractStatePrestige(normalized),
      baseObjectivePpg:managerObjectiveBaseForClubDivision(normalized.selectedClubId),
      futureSalePercent:managerContractFutureSalePercent(seed.clubs.find(item => Number(item.id) === Number(normalized.selectedClubId)), 'migration', normalized)
    }, 'normal', normalized);
    normalized._needsAutosave = true;
  }
  return normalized;
};
