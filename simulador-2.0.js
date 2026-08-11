/* Motor de simulación: fatiga visitante y sobreexigencia bot progresiva
   Archivo dedicado a la simulación de partidos y a los factores deportivos que influyen en el resultado.
   Mantiene valores internos ocultos fuera de la interfaz. */
(function(){
  const MATCH_INSTRUCTION_OPTIONS = [
    { value:'lower', label:'Bajar el ritmo' },
    { value:'normal', label:'Normal' },
    { value:'push', label:'Subir ritmo' }
  ];
  const DEFAULT_MATCH_INSTRUCTIONS = { winning:'normal', drawing:'normal', losing:'normal' };
  const INSTRUCTION_EFFECTS = {
    lower:{ attack:0.92, midfield:0.96, defense:1.04, attacks:0.90, conversion:0.94, foul:0.88 },
    normal:{ attack:1.00, midfield:1.00, defense:1.00, attacks:1.00, conversion:1.00, foul:1.00 },
    push:{ attack:1.09, midfield:1.03, defense:0.95, attacks:1.12, conversion:1.06, foul:1.10 }
  };
  const BLOCKS = Array.from({ length:30 }, (_, index) => ({
    from:index * 3 + 1,
    to:index === 29 ? 90 : index * 3 + 3
  }));
  const LIVE_BLOCKS = [
    ...Array.from({ length:45 }, (_, index) => ({
      phase:index + 1,
      from:index + 1,
      to:index + 1,
      matchMinute:index + 1,
      label:`${index + 1}'`,
      period:'first',
      playable:true
    })),
    ...Array.from({ length:15 }, (_, index) => ({
      phase:46 + index,
      from:45,
      to:45,
      matchMinute:45,
      breakMinute:index + 1,
      label:`Descanso ${index + 1}/15`,
      period:'break',
      playable:false
    })),
    ...Array.from({ length:45 }, (_, index) => ({
      phase:61 + index,
      from:46 + index,
      to:46 + index,
      matchMinute:46 + index,
      label:`${46 + index}'`,
      period:'second',
      playable:true
    }))
  ];
  const LIVE_MANAGER_INSTRUCTIONS = [
    { value:'none', label:'Sin instrucciones', desc:'Sin bonus ni penalización.' },
    { value:'all_defense', label:'Todos a defender', desc:'Bono alto de defensa. Ataque propio casi anulado. Recupera 1 punto físico cada 5 minutos.' },
    { value:'hold_result', label:'Cuidar el resultado', desc:'Bono de posesión y control.' },
    { value:'counter', label:'Contraataque', desc:'Menos posesión y volumen, más peligro en llegadas claras.' },
    { value:'lower_tempo', label:'Bajar el ritmo', desc:'Menos ataques y posesión. Recupera 1 punto físico cada 3 minutos y reduce 50% el riesgo de lesión.' },
    { value:'clean_play', label:'Jugar limpio', desc:'Reduce fuerte el riesgo de tarjetas y mejora la posesión.' },
    { value:'fight', label:'Luchar', desc:'Más intensidad y presión. Aumenta desgaste y roces.' },
    { value:'attack', label:'Ataque', desc:'Más ataques y ocasiones. Más exposición defensiva.' },
    { value:'goal_anyway', label:'Gol como sea!', desc:'Máxima búsqueda ofensiva. Genera más ocasiones y más ataques rivales.' }
  ];
  const SIM_PITCH_CONDITIONS = {
    'Excelente': { passDelta:10, chanceMultiplier:1.20, fatigueBonus:0, injuryBonus:0 },
    'Normal': { passDelta:0, chanceMultiplier:1.00, fatigueBonus:0, injuryBonus:0 },
    'Regular': { passDelta:-10, chanceMultiplier:0.80, fatigueBonus:0, injuryBonus:0 },
    'Muy malo': { passDelta:-20, chanceMultiplier:0.70, fatigueBonus:10, injuryBonus:0.10 },
    'Injugable': { passDelta:-50, chanceMultiplier:0.50, fatigueBonus:20, injuryBonus:0.30 }
  };

  function simConfigValue(path, fallback){
    return String(path || '').split('.').reduce((node, key) => (node && Object.prototype.hasOwnProperty.call(node, key)) ? node[key] : undefined, window.GAME_CONFIG || {}) ?? fallback;
  }
  function simConfigNumber(path, fallback, min=null, max=null){
    const raw = Number(simConfigValue(path, fallback));
    let value = Number.isFinite(raw) ? raw : Number(fallback);
    if(Number.isFinite(min)) value = Math.max(min, value);
    if(Number.isFinite(max)) value = Math.min(max, value);
    return value;
  }
  function simConfigArray(path, fallback=[]){
    const raw = simConfigValue(path, fallback);
    return Array.isArray(raw) ? raw : fallback;
  }
  function normalizeBotOverexertionRules(rawRules){
    const fallback = [
      { diferenciaMin:1, diferenciaMax:1, desgasteFisicoPct:0.20, bonusAtaquePct:0.10 },
      { diferenciaMin:2, diferenciaMax:2, desgasteFisicoPct:0.30, bonusAtaquePct:0.20 },
      { diferenciaMin:3, diferenciaMax:99, desgasteFisicoPct:0.50, bonusAtaquePct:0.30 }
    ];
    const source = Array.isArray(rawRules) && rawRules.length ? rawRules : fallback;
    return source.map(rule => ({
      diferenciaMin: Math.max(1, Math.round(Number(rule?.diferenciaMin ?? rule?.min ?? rule?.diferencia ?? 1) || 1)),
      diferenciaMax: Math.max(1, Math.round(Number(rule?.diferenciaMax ?? rule?.max ?? rule?.diferencia ?? 99) || 99)),
      desgasteFisicoPct: Math.max(0, Math.min(2, Number(rule?.desgasteFisicoPct ?? rule?.desgastePct ?? 0) || 0)),
      bonusAtaquePct: Math.max(0, Math.min(2, Number(rule?.bonusAtaquePct ?? rule?.ataquePct ?? 0) || 0))
    })).sort((a,b) => a.diferenciaMin - b.diferenciaMin);
  }
  const SIM_TEAM_WEIGHT = simConfigNumber('simulador.pesoColectivo', 0.50, 0, 1);
  const SIM_INDIVIDUAL_WEIGHT = simConfigNumber('simulador.pesoIndividual', 0.50, 0, 1);
  const SIM_SET_PIECE_CHANCE = simConfigNumber('simulador.probabilidadPelotaParada', 0.14, 0, 1);
  const SIM_GOAL_ERROR_ATTRIBUTION_RATE = simConfigNumber('simulador.probabilidadGolAtribuyeErrorGol', 0.60, 0, 1);
  const SIM_PLAYER_ERROR_SCALE = simConfigNumber('simulador.escalaRiesgoErrorJugador', 0.72, 0, 2);
  const SIM_USE_PLAYER_ERROR_FORMULA = Boolean(simConfigValue('simulador.formulaErroresJugador', true));
  const SIM_MAX_TEAM_ERRORS = Math.round(simConfigNumber('simulador.maximoErroresPorEquipo', 5, 0, 20));
  const LIVE_FATIGUE_MULTIPLIER = simConfigNumber('simulador.fatigaVivaMultiplicador', 2, 0.5, 4);
  const SIM_CARD_RATE_MULTIPLIER = simConfigNumber('simulador.multiplicadorTarjetas', 0.70, 0, 2);
  const SIM_DIRECT_RED_RATE_MULTIPLIER = simConfigNumber('simulador.multiplicadorRojasDirectas', 0.55, 0, 2);
  // V9.87: menos recuperaciones defensivas y mayor volumen de faltas.
  const SIM_STEAL_RATE_MULTIPLIER = simConfigNumber('simulador.multiplicadorRobos', 0.50, 0, 2);
  const SIM_FOUL_RATE_MULTIPLIER = simConfigNumber('simulador.multiplicadorFaltas', 2.00, 0, 4);
  function disciplinaryFoulsV987(fouls){
    return Math.max(0, Number(fouls || 0)) / Math.max(0.01, SIM_FOUL_RATE_MULTIPLIER);
  }
  const SIM_HIGH_CARD_PENALTY_ENABLED = Boolean(simConfigValue('simulador.penalizacionTarjetasAltas.activo', true));
  function normalizeCardPenaltyRulesV2(path, fallback){
    return simConfigArray(path, fallback).map(rule => ({
      cardsFrom:Math.max(1, Math.round(Number(rule?.tarjetasTotalesDesde ?? rule?.cardsFrom ?? 0) || 0)),
      penalty:simClamp(Number(rule?.penalizacion ?? rule?.penalty ?? 0) || 0, 0, 0.99)
    })).filter(rule => rule.cardsFrom > 0 && rule.penalty > 0).sort((a,b)=>a.cardsFrom-b.cardsFrom);
  }
  const SIM_HIGH_YELLOW_CARD_PENALTY_RULES = normalizeCardPenaltyRulesV2('simulador.penalizacionTarjetasAltas.amarillas', [
    { tarjetasTotalesDesde:6, penalizacion:0.30 },
    { tarjetasTotalesDesde:7, penalizacion:0.40 },
    { tarjetasTotalesDesde:8, penalizacion:0.50 },
    { tarjetasTotalesDesde:9, penalizacion:0.80 }
  ]);
  const SIM_HIGH_DIRECT_RED_CARD_PENALTY_RULES = normalizeCardPenaltyRulesV2('simulador.penalizacionTarjetasAltas.rojasDirectas', [
    { tarjetasTotalesDesde:2, penalizacion:0.40 },
    { tarjetasTotalesDesde:3, penalizacion:0.50 },
    { tarjetasTotalesDesde:4, penalizacion:0.60 },
    { tarjetasTotalesDesde:5, penalizacion:0.90 }
  ]);
  const SIM_DEFAULT_LOSS_RED_CARDS = Math.round(simConfigNumber('simulador.rojasDerrotaDefault', 5, 1, 11));
  const CONTINUOUS_MATCH_CONFIG_V974 = (() => {
    const raw = simConfigValue('simulador.motorContinuoV974', {}) || {};
    const distances = raw.distancias || {};
    const actions = raw.accionesBase || {};
    const possessionControl = raw.controlPosesion || {};
    const newV1 = raw.nuevoV1 || {};
    const totalPhases = Math.max(90, Math.round(Number(raw.fasesPorPartido || 360)));
    const secondsPerPhase = Math.max(1, Math.round(Number(raw.segundosPorFase || (5400 / totalPhases))));
    const phasesPerMinute = Math.max(1, Math.round(60 / secondsPerPhase));
    return {
      enabled:raw.activo !== false,
      totalPhases,
      secondsPerPhase,
      phasesPerMinute,
      technicalLog:Boolean(raw.logTecnico),
      maxTechnicalLog:Math.max(10, Math.round(Number(raw.maxLogTecnico || totalPhases))),
      shortPassMax:Number(distances.paseCortoMax || 34),
      longPassMin:Number(distances.paseLargoMin || 25),
      longPassMax:Number(distances.paseLargoMax || 78),
      throughProgressMin:Number(distances.paseProfundoAvanceMin || 12),
      pressureRadius:Number(distances.radioPresion || 20),
      markingRadius:Number(distances.radioMarcaje || 18),
      interceptionRadius:Number(distances.radioIntercepcion || 12),
      counterPhases:Math.max(1, Math.round(Number(raw.contraataqueFases || 11))),
      homeAdvantageMaxPct:Math.max(0, Math.min(0.30, Number(raw.ventajaLocalMaxPct ?? 0.08))),
      duelRandomRange:Math.max(1, Number(raw.azarPuja || 13)),
      attackIntentMultiplier:Math.max(1, Number(raw.multiplicadorIntencionAtaque || 1.60)),
      volumeConversionMultiplier:simClamp(Number(raw.multiplicadorConversionVolumen ?? 0.95),0.10,1.50),
      possessionControl:{
        enabled:possessionControl.activo !== false,
        minimumQuality:simClamp(Number(possessionControl.calidadMinima ?? 68),45,95),
        baseTarget:simClamp(Number(possessionControl.pasesObjetivoBase ?? 2),0,20),
        qualityCoefficient:simClamp(Number(possessionControl.coefCalidad ?? 0.30),0,1.5),
        qualityEdgeCoefficient:simClamp(Number(possessionControl.coefVentajaCalidad ?? 0.12),0,1.0),
        extraMidfielderCoefficient:simClamp(Number(possessionControl.coefMedioExtra ?? 1.00),0,5),
        holdResultBonus:simClamp(Number(possessionControl.bonusCuidarResultado ?? 6),0,20),
        scoreLowerBonus:simClamp(Number(possessionControl.bonusBajarRitmoResultado ?? 2),0,15),
        maxTarget:simClamp(Number(possessionControl.pasesObjetivoMax ?? 26),5,45),
        maxPassSecurityBonus:simClamp(Number(possessionControl.bonusSeguridadPaseMax ?? 18),0,30)
      },
      newV1:{
        enabled:newV1.activo !== false,
        zoneColumns:Math.max(3,Math.min(10,Math.round(Number(newV1.columnasZonas || 6)))),
        zoneRows:Math.max(2,Math.min(8,Math.round(Number(newV1.filasZonas || 4)))),
        movementLerp:simClamp(Number(newV1.movimientoPorFase ?? 0.38),0.05,0.90),
        attackShift:simClamp(Number(newV1.desplazamientoAtaque ?? 8),0,18),
        defenseShift:simClamp(Number(newV1.desplazamientoDefensa ?? 5),0,15),
        defenseCompactY:simClamp(Number(newV1.compactacionLateralDefensa ?? 0.34),0,0.80),
        pressers:Math.max(0,Math.min(4,Math.round(Number(newV1.presionJugadoresCercanos ?? 2)))),
        progressiveBlockMax:simClamp(Number(newV1.avanceBloqueMaximo ?? 15),4,26),
        progressivePassBase:simClamp(Number(newV1.avanceBloquePorPase ?? 0.70),0,3),
        progressivePassFactor:simClamp(Number(newV1.avanceExtraPaseProgresivo ?? 0.13),0,0.40),
        receptionRunMax:simClamp(Number(newV1.carreraRecepcionMax ?? 3.6),0,8),
        postActionMovement:simClamp(Number(newV1.movimientoPostAccion ?? 0.66),0.10,1.50),
        threatTargetWeight:simClamp(Number(newV1.pesoAmenazaDestino ?? 42),0,100),
        passLogitScale:simClamp(Number(newV1.escalaLogitPase ?? 9.5),3,25),
        dribbleLogitScale:simClamp(Number(newV1.escalaLogitRegate ?? 8.5),3,25),
        xgMax:simClamp(Number(newV1.xgMaximo ?? 0.58),0.20,0.85)
      },
      actionBase:{
        pass_short:Math.max(1, Number(actions.paseCorto || 36)),
        pass_long:Math.max(1, Number(actions.paseLargo || 12)),
        pass_through:Math.max(1, Number(actions.paseProfundo || 10)),
        cross:Math.max(1, Number(actions.centro || 6)),
        shot:Math.max(1, Number(actions.tiro || 4)),
        dribble:Math.max(1, Number(actions.regate || 12))
      }
    };
  })();
  const USE_CONTINUOUS_MATCH_ENGINE_V974 = CONTINUOUS_MATCH_CONFIG_V974.enabled;
  const SIM_HIGH_SCORE_GOAL_PENALTY_ENABLED = Boolean(simConfigValue('simulador.penalizacionGolesAltos.activo', true));
  const SIM_HIGH_SCORE_GOAL_PENALTY_RULES = simConfigArray('simulador.penalizacionGolesAltos.tramos', [
    { golesTotalesDesde:1, penalizacion:0.10 },
    { golesTotalesDesde:6, penalizacion:0.40 },
    { golesTotalesDesde:7, penalizacion:0.50 },
    { golesTotalesDesde:8, penalizacion:0.60 },
    { golesTotalesDesde:9, penalizacion:0.70 },
    { golesTotalesDesde:10, penalizacion:0.80 },
    { golesTotalesDesde:11, penalizacion:0.90 },
    { golesTotalesDesde:12, penalizacion:0.95 }
  ]).map(rule => ({
    goalsFrom:Math.max(1, Math.round(Number(rule?.golesTotalesDesde ?? rule?.goalsFrom ?? 0) || 0)),
    penalty:simClamp(Number(rule?.penalizacion ?? rule?.penalty ?? 0) || 0, 0, 0.99)
  })).filter(rule => rule.goalsFrom > 0 && rule.penalty > 0).sort((a,b) => a.goalsFrom - b.goalsFrom);
  const BOT_OVEREXERTION_ENABLED_V2 = Boolean(simConfigValue('equilibrioBots.tacticaRapida.sobreexigenciaSiPierde', true));
  const BOT_OVEREXERTION_RULES_V2 = normalizeBotOverexertionRules(simConfigArray('equilibrioBots.tacticaRapida.reglasDiferencia', []));
  const BOT_TACTIC_VARIETY_ENABLED = Boolean(simConfigValue('equilibrioBots.tacticasVariadas.activo', true));
  const BOT_TACTIC_ROTATION_INTERVAL = Math.max(1, Math.round(simConfigNumber('equilibrioBots.tacticasVariadas.rotacionCadaFechas', 1, 1, 20)));
  const BOT_MANAGER_TOP_PLAYERS_ENABLED_V2 = Boolean(simConfigValue('equilibrioBots.tacticaContraManager.priorizarMejoresJugadores', true));
  const BOT_MANAGER_TOP_PLAYERS_COUNT_V2 = Math.max(3, Math.min(5, Math.round(simConfigNumber('equilibrioBots.tacticaContraManager.cantidadMejoresJugadores', 5, 3, 5))));
  const BOT_MANAGER_TOP_PLAYER_BONUS_V2 = Math.max(1000, simConfigNumber('equilibrioBots.tacticaContraManager.bonusInclusionMejorJugador', 5000, 1000, 50000));
  const BOT_MANAGER_FORMATION_AUDIT_ENABLED_V2 = Boolean(simConfigValue('equilibrioBots.tacticaContraManager.auditarCobertura', true));
  const BOT_TACTIC_PROFILES = {
    balanced:{ formations:['4-4-2','4-2-3-1'], sectorStyles:{ defense:'posicional', midfield:'posicional', attack:'posicional' }, matchInstructions:{ winning:'lower', drawing:'normal', losing:'push' } },
    possession:{ formations:['4-2-3-1','4-1-4-1'], sectorStyles:{ defense:'rotacion', midfield:'posicional', attack:'rotacion' }, matchInstructions:{ winning:'lower', drawing:'normal', losing:'push' } },
    high_press:{ formations:['4-3-3','3-4-3'], sectorStyles:{ defense:'presion_alta', midfield:'presion_alta', attack:'presion_alta' }, matchInstructions:{ winning:'normal', drawing:'push', losing:'push' } },
    direct:{ formations:['4-3-1-2','4-4-2'], sectorStyles:{ defense:'posicional', midfield:'rotacion', attack:'posicional' }, matchInstructions:{ winning:'normal', drawing:'normal', losing:'push' } },
    wide:{ formations:['3-5-2','3-4-3'], sectorStyles:{ defense:'presion_alta', midfield:'rotacion', attack:'posicional' }, matchInstructions:{ winning:'normal', drawing:'push', losing:'push' } },
    counter:{ formations:['4-5-1','5-3-2'], sectorStyles:{ defense:'repliegue', midfield:'posicional', attack:'rotacion' }, matchInstructions:{ winning:'lower', drawing:'normal', losing:'push' } },
    defensive:{ formations:['5-4-1','5-3-2'], sectorStyles:{ defense:'repliegue', midfield:'repliegue', attack:'posicional' }, matchInstructions:{ winning:'lower', drawing:'lower', losing:'normal' } },
    cautious:{ formations:['4-1-4-1','4-5-1'], sectorStyles:{ defense:'posicional', midfield:'repliegue', attack:'rotacion' }, matchInstructions:{ winning:'lower', drawing:'normal', losing:'push' } }
  };
  const LIVE_BOT_SUB_MINUTES = [45, 60, 70, 78, 84];
  const LIVE_BOT_INJURY_SUB_ENABLED = true;

  function simClamp(value,min,max){ return Math.max(min, Math.min(max, value)); }
  function simAvg(values){ const clean = values.filter(v => Number.isFinite(v)); return clean.length ? clean.reduce((a,b)=>a+b,0)/clean.length : 0; }
  function simRnd(min,max){ return min + Math.random() * (max-min); }
  function simHighCardPenaltyForNextCard(currentCount, rules){
    if(!SIM_HIGH_CARD_PENALTY_ENABLED) return 0;
    const nextTotal = Math.max(0, Math.round(Number(currentCount || 0))) + 1;
    let penalty = 0;
    (rules || []).forEach(rule => { if(nextTotal >= Number(rule.cardsFrom || 0)) penalty = Math.max(penalty, Number(rule.penalty || 0)); });
    return simClamp(penalty, 0, 0.99);
  }
  function applyCardVolumePenaltyV2(candidates, existingCards=[]){
    const accepted = [];
    let yellowCount = (Array.isArray(existingCards) ? existingCards : []).filter(card => ['yellow','secondYellowRed'].includes(String(card?.type || ''))).length;
    let directRedCount = (Array.isArray(existingCards) ? existingCards : []).filter(card => String(card?.type || '') === 'red').length;
    (Array.isArray(candidates) ? candidates : []).slice().sort((a,b)=>Number(a?.minute || 0)-Number(b?.minute || 0)).forEach(card => {
      const type = String(card?.type || '');
      const isYellow = type === 'yellow' || type === 'secondYellowRed';
      const isDirectRed = type === 'red';
      const penalty = isYellow
        ? simHighCardPenaltyForNextCard(yellowCount, SIM_HIGH_YELLOW_CARD_PENALTY_RULES)
        : (isDirectRed ? simHighCardPenaltyForNextCard(directRedCount, SIM_HIGH_DIRECT_RED_CARD_PENALTY_RULES) : 0);
      if(penalty > 0 && Math.random() < penalty) return;
      accepted.push(card);
      if(isYellow) yellowCount += 1;
      if(isDirectRed) directRedCount += 1;
    });
    return accepted;
  }
  function simHighScoreGoalPenaltyForNextGoal(currentTotalGoals){
    if(!SIM_HIGH_SCORE_GOAL_PENALTY_ENABLED) return 0;
    const nextTotal = Math.max(0, Math.round(Number(currentTotalGoals || 0))) + 1;
    let penalty = 0;
    SIM_HIGH_SCORE_GOAL_PENALTY_RULES.forEach(rule => {
      if(nextTotal >= rule.goalsFrom) penalty = Math.max(penalty, rule.penalty);
    });
    return simClamp(penalty, 0, 0.99);
  }
  function botOverexertionRuleV2(gf, gc){
    if(!BOT_OVEREXERTION_ENABLED_V2) return null;
    const diff = Math.max(0, Math.round(Number(gc || 0) - Number(gf || 0)));
    if(diff <= 0) return null;
    return BOT_OVEREXERTION_RULES_V2.find(rule => diff >= Number(rule.diferenciaMin || 1) && diff <= Number(rule.diferenciaMax || 99)) || null;
  }
  function isManagerClubV2(clubId){
    return Number(clubId || 0) === Number(game?.selectedClubId || 0);
  }
  function applyBotOverexertionPowerV2(power, rule){
    if(!power || !rule) return power;
    const bonus = simClamp(Number(rule.bonusAtaquePct || 0), 0, 2);
    if(bonus <= 0) return power;
    const copy = clonePowerForLive(power);
    const style = copy.styleEffects || emptySectorStyleEffectsV2();
    copy.styleEffects = style;
    copy.attack *= (1 + bonus);
    copy.attackQuality *= (1 + bonus * 0.65);
    style.attackMultiplier = simClamp((style.attackMultiplier || 1) * (1 + bonus), 0.45, 1.80);
    style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * (1 + bonus * 0.75), 0.45, 1.80);
    copy.botOverexertion = { ...rule };
    return copy;
  }
  function liveBotOverexertionRuleForClub(session, clubId){
    if(!session || isManagerClubV2(clubId)) return null;
    if(Number(clubId) === Number(session.match?.homeId)) return botOverexertionRuleV2(session.homeGoals, session.awayGoals);
    if(Number(clubId) === Number(session.match?.awayId)) return botOverexertionRuleV2(session.awayGoals, session.homeGoals);
    return null;
  }
  function botOverexertionFatigueMultiplierV2(rule){
    return 1 + simClamp(Number(rule?.desgasteFisicoPct || 0), 0, 2);
  }
  function probabilisticRoundV2(value){
    const safe = Math.max(0, Number(value) || 0);
    const base = Math.floor(safe);
    return base + (Math.random() < safe - base ? 1 : 0);
  }
  function isRedCardType(type){
    return ['red','secondYellowRed'].includes(String(type || ''));
  }
  function redCardsForClub(cards, clubId){
    return (Array.isArray(cards) ? cards : []).filter(card => Number(card.clubId) === Number(clubId) && isRedCardType(card.type)).length;
  }
  function defaultLossByRedCards(cards, homeId, awayId){
    const homeReds = redCardsForClub(cards, homeId);
    const awayReds = redCardsForClub(cards, awayId);
    if(homeReds < SIM_DEFAULT_LOSS_RED_CARDS && awayReds < SIM_DEFAULT_LOSS_RED_CARDS) return null;
    if(homeReds >= SIM_DEFAULT_LOSS_RED_CARDS && awayReds >= SIM_DEFAULT_LOSS_RED_CARDS){
      const homeFifth = (cards || []).filter(card => Number(card.clubId) === Number(homeId) && isRedCardType(card.type)).sort((a,b)=>Number(a.minute || 0)-Number(b.minute || 0))[SIM_DEFAULT_LOSS_RED_CARDS - 1];
      const awayFifth = (cards || []).filter(card => Number(card.clubId) === Number(awayId) && isRedCardType(card.type)).sort((a,b)=>Number(a.minute || 0)-Number(b.minute || 0))[SIM_DEFAULT_LOSS_RED_CARDS - 1];
      if(Number(awayFifth?.minute || 999) < Number(homeFifth?.minute || 999)) return { offenderClubId:awayId, winnerClubId:homeId, homeGoals:3, awayGoals:0, homeReds, awayReds, minute:Number(awayFifth?.minute || 90) };
    }
    if(homeReds >= SIM_DEFAULT_LOSS_RED_CARDS) return { offenderClubId:homeId, winnerClubId:awayId, homeGoals:0, awayGoals:3, homeReds, awayReds, minute:Number((cards || []).filter(card => Number(card.clubId) === Number(homeId) && isRedCardType(card.type)).sort((a,b)=>Number(a.minute || 0)-Number(b.minute || 0))[SIM_DEFAULT_LOSS_RED_CARDS - 1]?.minute || 90) };
    return { offenderClubId:awayId, winnerClubId:homeId, homeGoals:3, awayGoals:0, homeReds, awayReds, minute:Number((cards || []).filter(card => Number(card.clubId) === Number(awayId) && isRedCardType(card.type)).sort((a,b)=>Number(a.minute || 0)-Number(b.minute || 0))[SIM_DEFAULT_LOSS_RED_CARDS - 1]?.minute || 90) };
  }
  function applyDefaultLossToLiveSession(session, defaultLoss){
    if(!session || !defaultLoss) return false;
    session.suspended = true;
    session.defaultLoss = { ...defaultLoss, reason:'Cinco expulsiones' };
    session.homeGoals = Number(defaultLoss.homeGoals || 0);
    session.awayGoals = Number(defaultLoss.awayGoals || 0);
    session.currentMinute = Number(defaultLoss.minute || session.currentMinute || 90);
    session.instructionLog = Array.isArray(session.instructionLog) ? session.instructionLog : [];
    session.instructionLog.push({ minute:session.currentMinute, to:session.currentMinute, instruction:'suspended', label:'Partido suspendido por expulsiones' });
    session.blockIndex = Array.isArray(session.blocks) ? session.blocks.length : session.blockIndex;
    return true;
  }
  function blockDurationFactor(block){
    return simClamp(((Number(block?.to || 0) - Number(block?.from || 0) + 1) || 15) / 15, 0.05, 1);
  }
  function normalizeMatchInstructions(instructions){
    const src = instructions || {};
    const valid = new Set(MATCH_INSTRUCTION_OPTIONS.map(o=>o.value));
    return {
      winning: valid.has(src.winning) ? src.winning : DEFAULT_MATCH_INSTRUCTIONS.winning,
      drawing: valid.has(src.drawing) ? src.drawing : DEFAULT_MATCH_INSTRUCTIONS.drawing,
      losing: valid.has(src.losing) ? src.losing : DEFAULT_MATCH_INSTRUCTIONS.losing
    };
  }

  function normalizeGoalkeeperDistributionV974(value){
    const clean = String(value || '').trim().toLowerCase();
    const aliases = { corto:'short', short:'short', largo:'long', long:'long', variado:'varied', varied:'varied' };
    return aliases[clean] || 'varied';
  }
  function normalizeBuildUpStyleV974(value){
    const clean = String(value || '').trim().toLowerCase();
    const aliases = { posesion:'possession', 'posesión':'possession', possession:'possession', directo:'direct', direct:'direct', contraataque:'counter', counter:'counter', pelotazo:'long_ball', long_ball:'long_ball', 'long-ball':'long_ball' };
    return aliases[clean] || 'possession';
  }
  function normalizeContinuousTacticV974(tactic){
    const next = tactic || {};
    next.goalkeeperDistribution = normalizeGoalkeeperDistributionV974(next.goalkeeperDistribution);
    next.buildUpStyle = normalizeBuildUpStyleV974(next.buildUpStyle);
    return next;
  }

  function normalizeSectorStyleValueV2(value){
    const clean = String(value || '').trim();
    const aliases = { presion:'presion_alta', presionAlta:'presion_alta', presion_alta:'presion_alta', rotacion:'rotacion', rotación:'rotacion', posicional:'posicional', repliegue:'repliegue' };
    const normalized = aliases[clean] || clean;
    return ['presion_alta','rotacion','posicional','repliegue'].includes(normalized) ? normalized : 'posicional';
  }
  function normalizeSectorStylesV2(styles){
    const fallback = (typeof DEFAULT_TACTIC_SECTOR_STYLES !== 'undefined') ? DEFAULT_TACTIC_SECTOR_STYLES : { defense:'posicional', midfield:'posicional', attack:'posicional' };
    const src = styles && typeof styles === 'object' && !Array.isArray(styles) ? styles : {};
    return {
      defense: normalizeSectorStyleValueV2(src.defense || src.defensa || fallback.defense),
      midfield: normalizeSectorStyleValueV2(src.midfield || src.medios || src.medio || fallback.midfield),
      attack: normalizeSectorStyleValueV2(src.attack || src.delanteros || src.delantera || fallback.attack)
    };
  }
  function sectorStyleIntensityV2(){
    return typeof TACTIC_SECTOR_STYLE_EFFECT_INTENSITY !== 'undefined' ? Number(TACTIC_SECTOR_STYLE_EFFECT_INTENSITY || 0.85) : simConfigNumber('tactica.estilosSector.intensidadEfecto', 0.85, 0, 2);
  }
  function simNormalizeMentality(mode){
    const value = String(mode || '').trim();
    const legacy = { posicional:'normal', ataque:'ofensivo', defensiva:'defensivo' };
    const normalized = legacy[value] || value;
    return ['muy_defensivo','defensivo','normal','ofensivo','muy_ofensivo'].includes(normalized) ? normalized : 'normal';
  }
  function simPlayerMentality(player, tactic){
    return simNormalizeMentality(tactic?.playerMentalities?.[player?.id]);
  }
  function simMentalityAttackMultiplier(player, tactic){
    return ({ muy_defensivo:0.82, defensivo:0.92, normal:1, ofensivo:1.10, muy_ofensivo:1.22 })[simPlayerMentality(player, tactic)] || 1;
  }
  function simMentalityDefenseMultiplier(player, tactic){
    return ({ muy_defensivo:1.22, defensivo:1.10, normal:1, ofensivo:0.92, muy_ofensivo:0.82 })[simPlayerMentality(player, tactic)] || 1;
  }
  function pitchEffectV2(pitch){ return SIM_PITCH_CONDITIONS[pitch] || SIM_PITCH_CONDITIONS.Normal; }
  function simStableHash(seedValue, max){
    const limit = Math.max(1, Math.round(Number(max || 1)));
    const text = String(seedValue || '');
    let hash = 2166136261;
    for(let i=0; i<text.length; i++){
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0) % limit;
  }
  function botTacticProfilePool(reputation){
    if(Number(reputation || 0) >= 75) return ['high_press','possession','balanced','wide','direct'];
    if(Number(reputation || 0) <= 60) return ['defensive','counter','cautious','balanced','direct'];
    return ['balanced','possession','high_press','direct','wide','counter','defensive','cautious'];
  }
  function botManagerFormationSelectionOptions(opponentClubId){
    const againstManager = Number(opponentClubId || 0) === Number(game?.selectedClubId || 0);
    if(!againstManager || !BOT_MANAGER_TOP_PLAYERS_ENABLED_V2) return { againstManager:false };
    return {
      againstManager:true,
      prioritizeTopPlayers:true,
      priorityCount:BOT_MANAGER_TOP_PLAYERS_COUNT_V2,
      priorityBonus:BOT_MANAGER_TOP_PLAYER_BONUS_V2
    };
  }
  function botTacticForClubV2(clubId, context={}){
    const id = Number(clubId || 0);
    if(id === Number(game?.selectedClubId || 0)) return normalizeContinuousTacticV974({ ...game.tactic, matchInstructions:normalizeMatchInstructions(game.tactic?.matchInstructions), sectorStyles:normalizeSectorStylesV2(game.tactic?.sectorStyles) });
    const club = seed?.clubs?.find(c => Number(c.id) === id) || { reputation:60 };
    const selectionOptions = botManagerFormationSelectionOptions(context.opponentClubId);
    if(!BOT_TACTIC_VARIETY_ENABLED){
      const best = typeof bestBotFormationSelection === 'function' ? bestBotFormationSelection(id, selectionOptions) : null;
      const formation = best?.formation || (Number(club.reputation || 0) > 74 ? '4-3-3' : Number(club.reputation || 0) < 61 ? '5-4-1' : '4-4-2');
      const starters = (best?.lineup || []).slice(0, 11).map(player => Number(player.id));
      const bench = typeof autoSelectBench === 'function' ? autoSelectBench(id, starters).map(player => Number(player.id)).slice(0, 10) : [];
      return {
        formation,
        starters,
        bench,
        autoSubs:[],
        playerMentalities:{},
        matchInstructions:{...DEFAULT_MATCH_INSTRUCTIONS},
        sectorStyles:normalizeSectorStylesV2(null),
        goalkeeperDistribution:'varied',
        buildUpStyle:'direct',
        botProfile:'legacy',
        botTopPlayersAudit:selectionOptions.againstManager && BOT_MANAGER_FORMATION_AUDIT_ENABLED_V2 ? (best?.audit || null) : null
      };
    }
    const season = Math.max(1, Math.round(Number(game?.seasonNumber || 1)));
    const matchday = Math.max(0, Math.round(Number(game?.matchdayIndex || 0)));
    const cycle = Math.floor(matchday / BOT_TACTIC_ROTATION_INTERVAL);
    const pool = botTacticProfilePool(club.reputation);
    const baseOffset = simStableHash(`bot-profile-base-${id}-${season}`, pool.length);
    const profileId = pool[(baseOffset + cycle) % pool.length] || 'balanced';
    const profile = BOT_TACTIC_PROFILES[profileId] || BOT_TACTIC_PROFILES.balanced;
    const formations = Array.isArray(profile.formations) && profile.formations.length ? profile.formations : ['4-4-2'];
    const formationOffset = simStableHash(`bot-formation-base-${id}-${season}-${profileId}`, formations.length);
    const fallbackFormation = formations[(formationOffset + cycle) % formations.length] || '4-4-2';
    const best = typeof bestBotFormationSelection === 'function' ? bestBotFormationSelection(id, selectionOptions) : null;
    const formation = best?.formation || fallbackFormation;
    const starters = (best?.lineup || []).slice(0, 11).map(player => Number(player.id));
    const bench = typeof autoSelectBench === 'function' ? autoSelectBench(id, starters).map(player => Number(player.id)).slice(0, 10) : [];
    return {
      formation,
      starters,
      bench,
      autoSubs:[],
      playerMentalities:{},
      matchInstructions:normalizeMatchInstructions(profile.matchInstructions),
      sectorStyles:normalizeSectorStylesV2(profile.sectorStyles),
      goalkeeperDistribution:['possession','high_press'].includes(profileId) ? 'short' : (['counter','direct','defensive','cautious'].includes(profileId) ? 'long' : 'varied'),
      buildUpStyle:profileId === 'possession' ? 'possession' : (profileId === 'counter' ? 'counter' : (['defensive','cautious'].includes(profileId) ? 'long_ball' : 'direct')),
      botProfile:profileId,
      botTacticCycle:cycle,
      botTopPlayersAudit:selectionOptions.againstManager && BOT_MANAGER_FORMATION_AUDIT_ENABLED_V2 ? (best?.audit || null) : null
    };
  }
  function getTacticForClubV2(clubId, opponentClubId=0){ return botTacticForClubV2(clubId, { opponentClubId }); }
  function instructionForScore(tactic, gf, gc){
    const instructions = normalizeMatchInstructions(tactic?.matchInstructions);
    if(gf > gc) return instructions.winning;
    if(gf < gc) return instructions.losing;
    return instructions.drawing;
  }
  function formationProfile(assigned){
    const counts = { gk:0, def:0, mid:0, att:0 };
    (assigned || []).forEach(a => { const g = slotGroup(a.slot); if(counts[g] !== undefined) counts[g]++; });
    const profile = { defense:0, midfield:0, attack:0, possession:0, attacks:0, conversion:0 };
    if(counts.def >= 5){ profile.defense += 5; profile.attack -= 3; profile.attacks -= 1; }
    if(counts.def <= 3){ profile.defense -= 3; profile.attack += 2; profile.attacks += 1; }
    if(counts.mid >= 5){ profile.midfield += 5; profile.possession += 4; profile.attacks += 2; }
    if(counts.mid <= 3){ profile.midfield -= 2; profile.possession -= 2; }
    if(counts.att >= 3){ profile.attack += 5; profile.conversion += 0.035; profile.defense -= 2; }
    if(counts.att <= 1){ profile.attack -= 3; profile.conversion -= 0.025; profile.defense += 2; }
    return { counts, profile };
  }
  function lineAverage(assigned, group, skillGroups){
    const items = assigned.filter(a => slotGroup(a.slot) === group);
    return simAvg(items.map(a => simAvg(skillGroups.map(skill => matchSkill(a.player, skill))) * a.factor));
  }

  function sectorQualityV2(assigned, group, skillGroups){
    return simClamp(lineAverage(assigned, group, skillGroups) / 99, 0, 1);
  }
  function emptySectorStyleEffectsV2(){
    return {
      possessionAdd:0,
      attackMultiplier:1,
      chanceMultiplier:1,
      conversionMultiplier:1,
      foulAdd:0,
      cardMultiplier:1,
      injuryMultiplier:1,
      errorRiskMultiplier:1,
      rivalAttackMultiplier:1,
      rivalChanceMultiplier:1,
      rivalConversionMultiplier:1,
      conditionDelta:0,
      labels:[]
    };
  }
  function mul(value, pct, intensity){ return value * (1 + pct * intensity); }
  function addScaled(value, amount, intensity){ return value + amount * intensity; }
  function buildSectorStyleEffectsV2(tactic, assigned){
    const enabled = typeof TACTIC_SECTOR_STYLE_ENABLED === 'undefined' ? true : Boolean(TACTIC_SECTOR_STYLE_ENABLED);
    const effects = emptySectorStyleEffectsV2();
    if(!enabled) return effects;
    const styles = normalizeSectorStylesV2(tactic?.sectorStyles);
    const intensity = sectorStyleIntensityV2();
    const deltas = (typeof TACTIC_STYLE_CONDITION_DELTAS !== 'undefined') ? TACTIC_STYLE_CONDITION_DELTAS : { highPress:-3, rotation:-1, regroup:-1 };
    const defPressQ = sectorQualityV2(assigned, 'def', ['velocidad','resistencia']);
    const defPassQ = sectorQualityV2(assigned, 'def', ['paseCorto','tecnica','serenidad']);
    const defBlockQ = sectorQualityV2(assigned, 'def', ['marca','posicionamiento','fuerza']);
    const midPressQ = sectorQualityV2(assigned, 'mid', ['velocidad','marca','entradas','resistencia']);
    const midPassQ = sectorQualityV2(assigned, 'mid', ['paseCorto','vision','tecnica','trabajoEquipo']);
    const midDefQ = sectorQualityV2(assigned, 'mid', ['paseCorto','marca','posicionamiento']);
    const attPressQ = sectorQualityV2(assigned, 'att', ['velocidad','marca','resistencia']);
    const attPassQ = sectorQualityV2(assigned, 'att', ['paseCorto','vision','tecnica']);
    const attTargetQ = sectorQualityV2(assigned, 'att', ['cabezazo','fuerza','posicionamiento']);
    const attDefQ = sectorQualityV2(assigned, 'att', ['marca','resistencia','trabajoEquipo']);

    if(styles.defense === 'presion_alta'){
      effects.errorRiskMultiplier = mul(effects.errorRiskMultiplier, 0.08 + (1 - defPressQ) * 0.10, intensity);
      effects.rivalAttackMultiplier = mul(effects.rivalAttackMultiplier, -(0.04 + defPressQ * 0.06), intensity);
      effects.rivalChanceMultiplier = mul(effects.rivalChanceMultiplier, -(0.02 + defPressQ * 0.04), intensity);
      effects.foulAdd = addScaled(effects.foulAdd, 0.25 + (1 - defPressQ) * 0.45, intensity);
      effects.conditionDelta += (Number(deltas.highPress ?? -3) * (0.65 + (1 - defPressQ) * 0.35));
    }else if(styles.defense === 'rotacion'){
      effects.possessionAdd = addScaled(effects.possessionAdd, 2 + defPassQ * 3, intensity);
      effects.errorRiskMultiplier = mul(effects.errorRiskMultiplier, 0.05 + (1 - defPassQ) * 0.10, intensity);
    }else if(styles.defense === 'posicional'){
      effects.possessionAdd = addScaled(effects.possessionAdd, 3 + defPassQ * 3, intensity);
      effects.errorRiskMultiplier = mul(effects.errorRiskMultiplier, -(0.06 + defPassQ * 0.05), intensity);
      effects.rivalConversionMultiplier = mul(effects.rivalConversionMultiplier, 0.025, intensity);
    }else if(styles.defense === 'repliegue'){
      effects.possessionAdd = addScaled(effects.possessionAdd, -(2 + defBlockQ * 2), intensity);
      effects.errorRiskMultiplier = mul(effects.errorRiskMultiplier, -(0.10 + defBlockQ * 0.08), intensity);
      effects.rivalAttackMultiplier = mul(effects.rivalAttackMultiplier, -(0.08 + defBlockQ * 0.08), intensity);
      effects.rivalChanceMultiplier = mul(effects.rivalChanceMultiplier, -(0.08 + defBlockQ * 0.10), intensity);
      effects.conditionDelta += Number(deltas.regroup ?? -1) * 0.45;
    }

    if(styles.midfield === 'presion_alta'){
      effects.attackMultiplier = mul(effects.attackMultiplier, 0.04 + midPressQ * 0.07, intensity);
      effects.foulAdd = addScaled(effects.foulAdd, 0.55 + (1 - midPressQ) * 0.45, intensity);
      effects.conditionDelta += Number(deltas.highPress ?? -3) * (0.80 + (1 - midPressQ) * 0.35);
    }else if(styles.midfield === 'rotacion'){
      effects.possessionAdd = addScaled(effects.possessionAdd, 5 + midPassQ * 5, intensity);
      effects.chanceMultiplier = mul(effects.chanceMultiplier, -(0.04 + (1 - midPassQ) * 0.05), intensity);
      effects.conditionDelta += Number(deltas.rotation ?? -1) * 0.35;
    }else if(styles.midfield === 'posicional'){
      effects.possessionAdd = addScaled(effects.possessionAdd, 5 + midPassQ * 5, intensity);
      effects.errorRiskMultiplier = mul(effects.errorRiskMultiplier, -(0.04 + midPassQ * 0.06), intensity);
    }else if(styles.midfield === 'repliegue'){
      effects.possessionAdd = addScaled(effects.possessionAdd, 3 + midDefQ * 4, intensity);
      effects.attackMultiplier = mul(effects.attackMultiplier, -(0.08 + (1 - midDefQ) * 0.05), intensity);
      effects.chanceMultiplier = mul(effects.chanceMultiplier, -(0.08 + (1 - midDefQ) * 0.06), intensity);
      effects.conditionDelta += Number(deltas.regroup ?? -1) * 0.35;
    }

    if(styles.attack === 'presion_alta'){
      effects.attackMultiplier = mul(effects.attackMultiplier, 0.05 + attPressQ * 0.07, intensity);
      effects.foulAdd = addScaled(effects.foulAdd, 0.55 + (1 - attPressQ) * 0.55, intensity);
      effects.conditionDelta += Number(deltas.highPress ?? -3) * (0.75 + (1 - attPressQ) * 0.35);
    }else if(styles.attack === 'rotacion'){
      effects.possessionAdd = addScaled(effects.possessionAdd, -3, intensity);
      effects.attackMultiplier = mul(effects.attackMultiplier, -0.08, intensity);
      effects.chanceMultiplier = mul(effects.chanceMultiplier, 0.08 + attPassQ * 0.10, intensity);
      effects.conditionDelta += Number(deltas.rotation ?? -1) * 0.35;
    }else if(styles.attack === 'posicional'){
      effects.attackMultiplier = mul(effects.attackMultiplier, 0.05 + attTargetQ * 0.08, intensity);
      effects.possessionAdd = addScaled(effects.possessionAdd, -(2 + (1 - attTargetQ) * 2), intensity);
    }else if(styles.attack === 'repliegue'){
      effects.possessionAdd = addScaled(effects.possessionAdd, 4 + attDefQ * 3, intensity);
      effects.attackMultiplier = mul(effects.attackMultiplier, -0.22, intensity);
      effects.chanceMultiplier = mul(effects.chanceMultiplier, -0.25, intensity);
      effects.conditionDelta += Number(deltas.regroup ?? -1) * 0.55;
    }

    effects.attackMultiplier = simClamp(effects.attackMultiplier, 0.62, 1.38);
    effects.chanceMultiplier = simClamp(effects.chanceMultiplier, 0.55, 1.45);
    effects.conversionMultiplier = simClamp(effects.conversionMultiplier, 0.70, 1.30);
    effects.errorRiskMultiplier = simClamp(effects.errorRiskMultiplier, 0.58, 1.55);
    effects.rivalAttackMultiplier = simClamp(effects.rivalAttackMultiplier, 0.62, 1.22);
    effects.rivalChanceMultiplier = simClamp(effects.rivalChanceMultiplier, 0.58, 1.22);
    effects.rivalConversionMultiplier = simClamp(effects.rivalConversionMultiplier, 0.80, 1.22);
    effects.foulAdd = simClamp(effects.foulAdd, -1.2, 2.4);
    effects.conditionDelta = simClamp(effects.conditionDelta, -9, 3);
    effects.styles = styles;
    return effects;
  }
  function teamPowerV2(clubId, tactic, options={}){
    const customLayout = typeof isCustomTactic === 'function' && isCustomTactic(tactic);
    const formation = customLayout ? 'Personalizada' : (tactic?.formation || '4-4-2');
    const slots = typeof tacticRoleSlots === 'function' ? tacticRoleSlots(tactic) : (FORMATIONS[tactic?.formation || '4-4-2'] || FORMATIONS['4-4-2']);
    const sentOffIds = options?.sentOffIds instanceof Set ? options.sentOffIds : new Set();
    const hasExplicitStarters = Array.isArray(tactic?.starters) && tactic.starters.length;
    let assigned = [];
    if(hasExplicitStarters){
      assigned = typeof tacticAssignedEntries === 'function'
        ? tacticAssignedEntries(tactic, { sentOffIds })
        : tactic.starters.slice(0, 11).map((id, i) => {
            const player = playerById(id);
            if(!player || sentOffIds.has(Number(player.id))) return null;
            const slot = slots[i] || player.position;
            return { player, slot, factor:zoneFactor(player, slot) };
          }).filter(Boolean);
    }
    if(!assigned.length && !hasExplicitStarters){
      const lineupFallback = selectLineup(clubId, tactic).filter(player => !sentOffIds.has(Number(player?.id || 0)));
      assigned = lineupFallback.map((player, i) => ({ player, slot:slots[i] || player.position, factor:zoneFactor(player, slots[i] || player.position) }));
    }
    const lineup = assigned.map(a => a.player);
    const { counts, profile } = formationProfile(assigned);
    const gk = assigned.find(a => a.slot === 'POR');
    const defenseQuality = lineAverage(assigned, 'def', ['marca','entradas','posicionamiento','fuerza']);
    const midfieldQuality = lineAverage(assigned, 'mid', ['paseCorto','vision','tecnica','trabajoEquipo']);
    const attackQuality = lineAverage(assigned, 'att', ['remate','regate','velocidad','serenidad','posicionamiento']);
    const keeperQuality = gk ? simAvg(['porteria','posicionamiento','serenidad'].map(skill => matchSkill(gk.player, skill) * gk.factor)) : 38;
    const adjust = applyMentalityBonus(tactic || {}, assigned);
    const crowdBonus = simClamp(Math.round(Number(options.crowdBonus || 0)), 0, 99);
    const cohesionRaw = typeof cohesionValue === 'function' ? cohesionValue(clubId) : Number(game?.teamCohesion?.[clubId] || 50);
    const boostedCohesionRaw = simClamp(cohesionRaw + crowdBonus, 0, 100);
    const cohesion = boostedCohesionRaw <= 30
      ? simClamp(0.50 + (boostedCohesionRaw / 30) * 0.20, 0.50, 0.70)
      : boostedCohesionRaw <= 50
        ? simClamp(0.70 + ((boostedCohesionRaw - 30) / 20) * 0.30, 0.70, 1.00)
        : simClamp(1.00 + ((boostedCohesionRaw - 50) / 50) * 0.20, 1.00, 1.20);
    const boostedMorale = simClamp(squadMoraleAverage(clubId) + crowdBonus, 1, 99);
    const teamMorale = simClamp(0.94 + (boostedMorale / 99) * 0.12, 0.94, 1.06);
    const crowdConditionMultiplier = 1 + (crowdBonus / 99) * 0.08;
    const conditionResolver = typeof options.conditionResolver === 'function' ? options.conditionResolver : (id => currentCondition(id));
    const liveConditionAvg = simAvg(lineup.map(p => {
      const resolved = Number(conditionResolver(p.id));
      const fallback = Number(currentCondition(p.id));
      return simClamp(Number.isFinite(resolved) ? resolved : (Number.isFinite(fallback) ? fallback : 75), 1, 100);
    }));
    const conditionPower = simClamp(0.82 + (liveConditionAvg / 100) * 0.22, 0.70, 1.04);
    const countBoost = {
      defense: counts.def * 1.25,
      midfield: counts.mid * 1.35,
      attack: counts.att * 1.55
    };
    const styleEffects = buildSectorStyleEffectsV2(tactic, assigned);
    const customBalance = typeof customTacticBalanceProfile === 'function' ? customTacticBalanceProfile(tactic) : { active:false, defenseMultiplier:1, midfieldMultiplier:1, attackMultiplier:1, chanceMultiplier:1, possessionAdd:0, conditionDelta:0 };
    if(customBalance.active){
      styleEffects.chanceMultiplier = simClamp(Number(styleEffects.chanceMultiplier || 1) * Number(customBalance.chanceMultiplier || 1), 0.50, 1.45);
      styleEffects.possessionAdd = simClamp(Number(styleEffects.possessionAdd || 0) + Number(customBalance.possessionAdd || 0), -18, 18);
      styleEffects.conditionDelta = simClamp(Number(styleEffects.conditionDelta || 0) + Number(customBalance.conditionDelta || 0), -12, 3);
    }
    const defense = (defenseQuality + countBoost.defense + profile.defense + adjust.defense + keeperQuality * 0.12) * cohesion * teamMorale * crowdConditionMultiplier * conditionPower * Number(customBalance.defenseMultiplier || 1);
    const midfield = (midfieldQuality + countBoost.midfield + profile.midfield + adjust.midfield) * cohesion * teamMorale * crowdConditionMultiplier * conditionPower * Number(customBalance.midfieldMultiplier || 1);
    const attack = (attackQuality + countBoost.attack + profile.attack + adjust.attack) * cohesion * teamMorale * crowdConditionMultiplier * conditionPower * Number(customBalance.attackMultiplier || 1);
    const discipline = simAvg(lineup.map(p=>p.skills.disciplina));
    const stamina = simAvg(lineup.map(p=>matchSkill(p,'resistencia'))) * cohesion * teamMorale * crowdConditionMultiplier;
    const aggression = simAvg(lineup.map(p=>hiddenStats(p).aggression));
    const rep = seed.clubs.find(c=>c.id===clubId)?.reputation || 60;
    return {
      clubId, tactic, formation, lineup, assigned, counts, profile:profile,
      defense, midfield, attack, keeper:keeperQuality * cohesion * teamMorale * crowdConditionMultiplier * conditionPower,
      crowdBonus,
      defenseQuality, midfieldQuality, attackQuality, keeperQuality,
      styleEffects,
      customBalance,
      conditionAvg:liveConditionAvg,
      discipline, stamina, aggression, reputation:rep
    };
  }
  function applyManagerTacticalAdaptationPairV2(home, away, match=null, context=null){
    if(!match?.id || match.friendly) return { home, away };
    if(typeof tacticalAdaptationInfoForMatch !== 'function') return { home, away };
    const ownId = Number(game?.selectedClubId || 0);
    if(!ownId || (Number(match.homeId) !== ownId && Number(match.awayId) !== ownId)) return { home, away };
    const managerIsHome = Number(match.homeId) === ownId;
    const managerPower = managerIsHome ? home : away;
    const rivalPower = managerIsHome ? away : home;
    const info = tacticalAdaptationInfoForMatch(managerPower?.tactic || game?.tactic || null);
    const bonus = Number(info?.bonus || 0);
    if(!info?.active || bonus <= 0) return { home, away };
    rivalPower.defense *= 1 + bonus;
    rivalPower.midfield *= 1 + bonus * 0.75;
    rivalPower.attack *= 1 + bonus * 0.45;
    rivalPower.keeper *= 1 + bonus * 0.35;
    rivalPower.tacticalAdaptationBonus = info;
    if(context && typeof context === 'object'){
      context.tacticalAdaptation = {
        clubId:ownId,
        rivalId:managerIsHome ? Number(match.awayId) : Number(match.homeId),
        streak:info.prospectiveStreak || info.streak || 0,
        freeMatches:info.freeMatches || 0,
        bonus,
        bonusPct:Math.round(bonus * 100)
      };
    }
    return { home, away };
  }

  function makeMatchContextV2(match){
    const weatherOptions = ['Soleado', 'Nublado', 'Lluvia leve', 'Lluvia intensa', 'Viento moderado', 'Calor húmedo'];
    const weather = weatherOptions[hashNumber(`${match.id}-weather-${game?.matchdayIndex || 0}`, weatherOptions.length)];
    const homeClub = seed.clubs.find(c=>c.id===match.homeId);
    const awayClub = seed.clubs.find(c=>c.id===match.awayId);
    const neutralTournament = Boolean(match?.clubWorldCup || match?.neutral);
    const pitchScore = neutralTournament ? 100 : fieldScoreForClub(match.homeId);
    const pitch = fieldConditionName(pitchScore);
    const effect = pitchEffectV2(pitch);
    const attendance = typeof attendanceContextForMatch === 'function'
      ? attendanceContextForMatch(match)
      : { homeFans:Math.max(800, Math.round((homeClub?.reputation || 60) * simRnd(210,360))), awayFans:Math.max(120, Math.round((awayClub?.reputation || 60) * simRnd(18,70))), totalFans:0, capacity:0, homeCrowdBonus:0, ticketPrice:0, ticketRevenue:0 };
    return { weather, pitch, pitchScore, neutral:neutralTournament, clubWorldCup:Boolean(match?.clubWorldCup), ...attendance, pitchEffect:effect };
  }
  function blockStatsForTeam(own, rival, context, ownInstruction, rivalInstruction, isHome, block=null){
    const effect = pitchEffectV2(context.pitch);
    const phaseFactor = blockDurationFactor(block);
    const ownInstr = INSTRUCTION_EFFECTS[ownInstruction] || INSTRUCTION_EFFECTS.normal;
    const rivalInstr = INSTRUCTION_EFFECTS[rivalInstruction] || INSTRUCTION_EFFECTS.normal;
    const pitchPass = effect.passDelta;
    const pitchChance = effect.chanceMultiplier;
    const ownStyle = own.styleEffects || emptySectorStyleEffectsV2();
    const rivalStyle = rival.styleEffects || emptySectorStyleEffectsV2();
    const effectiveMid = simClamp((own.midfield * ownInstr.midfield) + pitchPass + own.profile.possession + ownStyle.possessionAdd, 1, 150);
    const rivalMid = simClamp((rival.midfield * rivalInstr.midfield) + pitchPass + rival.profile.possession + rivalStyle.possessionAdd, 1, 150);
    const neutralVenue = Boolean(context?.neutral || context?.clubWorldCup);
    const homePossessionEdge = neutralVenue ? 0 : (isHome ? 2 : -1);
    const possession = simClamp(Math.round((effectiveMid / Math.max(1, effectiveMid + rivalMid)) * 100 + homePossessionEdge + simRnd(-4,4)), 28, 72);
    const midfieldAttack = effectiveMid / 17;
    const attackPressure = (own.attack * ownInstr.attack) / 22;
    const defenseBrake = (rival.defense * rivalInstr.defense) / 34;
    const baseAttacks = 3.5 + midfieldAttack + attackPressure - defenseBrake + own.profile.attacks + (possession - 50) / 12 + (!neutralVenue && isHome ? 0.6 : 0) + simRnd(-1.6,1.9);
    const fullBlockAttacks = simClamp(baseAttacks * ownInstr.attacks * ownStyle.attackMultiplier * rivalStyle.rivalAttackMultiplier, 0, 13);
    const attacks = simClamp(probabilisticRoundV2(fullBlockAttacks * phaseFactor), 0, 5);
    const forwardCount = Math.max(1, own.counts.att || 1);
    const defenderCount = Math.max(1, rival.counts.def || 1);
    const chanceRate = simClamp(
      0.220 + (own.attackQuality - rival.defenseQuality) / 500 + forwardCount * 0.022 + own.profile.conversion - defenderCount * 0.004 - (rival.keeperQuality / 2600),
      0.10,
      0.42
    ) * ownInstr.conversion * pitchChance * ownStyle.chanceMultiplier * rivalStyle.rivalChanceMultiplier;
    const pressureEdge = (own.attack - rival.defense) / 155;
    const chanceNoise = simRnd(-0.08,0.12) * phaseFactor;
    const expectedChances = Math.max(0, attacks * chanceRate + pressureEdge * phaseFactor + chanceNoise);
    const chances = simClamp(probabilisticRoundV2(expectedChances), 0, 3);
    const xgPerChance = simClamp((0.14 + (own.attackQuality - rival.keeperQuality) / 650 + forwardCount * 0.018 - defenderCount * 0.009) * ownStyle.conversionMultiplier * rivalStyle.rivalConversionMultiplier, 0.05, 0.46);
    const xg = simClamp(chances * xgPerChance + (fullBlockAttacks > 8 ? 0.04 * phaseFactor : 0) + (!neutralVenue && isHome ? 0.03 * phaseFactor : 0), 0, 0.55);
    const fullBlockFouls = Math.max(0, 1.1 + own.aggression/46 + (100-own.discipline)/62 + ownStyle.foulAdd + (ownInstruction === 'push' ? 0.55 : ownInstruction === 'lower' ? -0.35 : 0) + simRnd(-0.7,0.9));
    const fouls = simClamp(probabilisticRoundV2(fullBlockFouls * SIM_FOUL_RATE_MULTIPLIER * phaseFactor), 0, 6);
    return { attacks, chances, possession, fouls, passScore:Math.round(effectiveMid), xg };
  }
  const CONTINUOUS_STAT_KEYS_V974 = ['passesAttempted','passesCompleted','longPassesAttempted','longPassesCompleted','throughPassesAttempted','throughPassesCompleted','crossesAttempted','crossesCompleted','dribblesAttempted','dribblesWon','interceptions','tackles','shots','shotsOnTarget'];
  function mergeBlockStats(total, block){
    total.attacks += Number(block.attacks || 0);
    total.chances += Number(block.chances || 0);
    total.fouls += Number(block.fouls || 0);
    total.xg += Number(block.xg || 0);
    total.passScore += Number(block.passScore || 0);
    total.possessionWeighted += Number(block.possession || 0);
    CONTINUOUS_STAT_KEYS_V974.forEach(key => { total[key] = Number(total[key] || 0) + Number(block[key] || 0); });
  }
  function emptyStats(){
    const base = { attacks:0, chances:0, possession:50, fouls:0, passScore:0, xg:0, possessionWeighted:0, keySaves:0, errors:0, goalErrors:0 };
    CONTINUOUS_STAT_KEYS_V974.forEach(key => { base[key] = 0; });
    return base;
  }
  function continuousStatsExtrasV974(stats){
    const out = {};
    CONTINUOUS_STAT_KEYS_V974.forEach(key => { out[key] = Math.max(0, Math.round(Number(stats?.[key] || 0))); });
    return out;
  }
  function finalizeStats(stats){
    const divisor = USE_CONTINUOUS_MATCH_ENGINE_V974 ? 90 : BLOCKS.length;
    return {
      attacks:simClamp(Math.round(stats.attacks), 1, 75),
      chances:simClamp(Math.round(stats.chances), 0, 30),
      possession:simClamp(Math.round(stats.possessionWeighted / Math.max(1, divisor)), 8, 92),
      fouls:simClamp(Math.round(stats.fouls), 0, 40),
      passScore:simClamp(Math.round(stats.passScore / Math.max(1, divisor)), 1, 140),
      xg:Number(stats.xg.toFixed(2)),
      keySaves:Math.round(Number(stats.keySaves || 0)),
      errors:Math.round(Number(stats.errors || 0)),
      goalErrors:Math.round(Number(stats.goalErrors || 0)),
      ...continuousStatsExtrasV974(stats)
    };
  }
  function poissonV2(lambda){
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= Math.random(); } while (p > L);
    return simClamp(k - 1, 0, 7);
  }
  function weightedPickV2(items, weightFn){
    const safeItems = (items || []).filter(Boolean);
    const weighted = safeItems.map(item=>({item, w:Math.max(1, weightFn(item))}));
    const total = weighted.reduce((a,x)=>a+x.w,0);
    let r = Math.random()*total;
    for(const x of weighted){ r -= x.w; if(r<=0) return x.item; }
    return weighted[0]?.item;
  }
  const GOAL_POSITION_WEIGHTS_V2 = { DC:100, ED:80, EI:80, MCO:65, MC:55, MD:40, MI:40, MCD:30, DFC:10, LD:10, LI:10, POR:0.05 };
  const SET_PIECE_GOAL_POSITION_WEIGHTS_V2 = { DC:100, DFC:70, LD:60, LI:60, ED:60, EI:60, MCO:60, MC:55, MCD:55, MD:45, MI:45, POR:0.05 };
  function scorerPositionWeightV2(player, setPiece=false){
    const pos = String(player?.position || '').toUpperCase();
    const table = setPiece ? SET_PIECE_GOAL_POSITION_WEIGHTS_V2 : GOAL_POSITION_WEIGHTS_V2;
    return Number(table[pos] ?? 35);
  }
  function scorerWeightV2(player, setPiece=false, tactic=null){
    if(!player) return 1;
    const roleWeight = scorerPositionWeightV2(player, setPiece);
    if(roleWeight <= 0.1) return 0.05;
    const starMul = typeof playerStarReferenceMultiplier === 'function' ? playerStarReferenceMultiplier(player, 'goal') : 1;
    const roleMul = roleWeight / 100;
    if(setPiece){
      const skillWeight = effectiveSkill(player,'cabezazo') * 1.18 + effectiveSkill(player,'fuerza') * 0.35 + effectiveSkill(player,'posicionamiento') * 0.70 + effectiveSkill(player,'serenidad') * 0.35;
      return Math.max(1, skillWeight * roleMul) * starMul * simMentalityAttackMultiplier(player, tactic);
    }
    const skillWeight = effectiveSkill(player,'remate') * 1.55 + effectiveSkill(player,'posicionamiento') * 1.20 + effectiveSkill(player,'serenidad') * 0.55 + currentMorale(player.id) * 0.20;
    return Math.max(1, skillWeight * roleMul) * starMul * simMentalityAttackMultiplier(player, tactic);
  }
  function cardWeightV2(player){
    if(!player) return 1;
    if(player.position === 'POR') return 0.35;
    const roleBonus = ['DFC','MCD'].includes(player.position) ? 30 : ['LD','LI'].includes(player.position) ? 20 : player.position === 'MC' ? 12 : 6;
    return hiddenStats(player).aggression * 0.75 + (100 - effectiveSkill(player,'disciplina')) * 0.30 + roleBonus;
  }
  function selectChanceShooterV2(power, setPiece=false){
    const outfield = (power.lineup || []).filter(p => p.position !== 'POR');
    const scorerPool = outfield.length ? outfield : power.lineup;
    return weightedPickV2(scorerPool, p => scorerWeightV2(p, setPiece, power.tactic));
  }
  function goalkeeperFromPowerV2(power){
    return (power.lineup || []).find(p => p.position === 'POR') || null;
  }
  function defensivePlayerWeightV2(player, tactic=null){
    if(!player || player.position === 'POR') return 1;
    const pos = String(player.position || '').toUpperCase();
    const roleBonus = ['DFC','LD','LI'].includes(pos) ? 95 : pos === 'MCD' ? 68 : pos === 'MC' ? 34 : 14;
    return (effectiveSkill(player,'marca') * 0.95 + effectiveSkill(player,'entradas') * 0.90 + effectiveSkill(player,'posicionamiento') * 0.70 + effectiveSkill(player,'serenidad') * 0.28 + roleBonus) * simMentalityDefenseMultiplier(player, tactic);
  }
  function playerErrorSecurityV2(player, clubId){
    if(!player) return 0.50;
    const morale = simClamp(Number(currentMorale(player.id) || 0), 0, 100);
    const condition = simClamp(Number(currentCondition(player.id) || 0), 0, 100);
    const overall = simClamp(Number(effectiveOverall(player) || player.overall || 0), 0, 100);
    const cohesion = simClamp(Number(typeof cohesionValue === 'function' ? cohesionValue(clubId || player.clubId) : game?.teamCohesion?.[clubId || player.clubId] || 50), 0, 100);
    return simClamp((morale + condition + overall + cohesion) / 400, 0, 1);
  }
  function playerErrorRiskV2(player, clubId){
    // Corrección lógica: la fórmula de 0 a 1 se toma como seguridad. El riesgo es el complemento.
    return simClamp(1 - playerErrorSecurityV2(player, clubId), 0.01, 0.95);
  }
  function errorPlayerWeightV2(player, clubId){
    if(!player) return 1;
    const pos = String(player.position || '').toUpperCase();
    const rolePressure = pos === 'POR' ? 58 : ['DFC','LD','LI'].includes(pos) ? 46 : pos === 'MCD' ? 27 : 12;
    return Math.max(1, rolePressure + playerErrorRiskV2(player, clubId) * 140);
  }
  function pickErrorPlayerV2(defending, defendingClubId){
    const keeper = goalkeeperFromPowerV2(defending);
    const defenderPool = (defending.lineup || []).filter(p => p.position !== 'POR');
    return weightedPickV2([keeper].concat(defenderPool).filter(Boolean), p => errorPlayerWeightV2(p, defendingClubId));
  }
  function registerErrorEventV2(rivalTotals, incidents, defending, defendingClubId, attackingClubId, minute, isGoal){
    if(Number(rivalTotals.errors || 0) >= SIM_MAX_TEAM_ERRORS) return null;
    const errorPlayer = pickErrorPlayerV2(defending, defendingClubId);
    const event = { clubId:defendingClubId, playerId:errorPlayer?.id || null, minute, goal:Boolean(isGoal), causedBy:attackingClubId };
    rivalTotals.errors = Number(rivalTotals.errors || 0) + 1;
    if(isGoal) rivalTotals.goalErrors = Number(rivalTotals.goalErrors || 0) + 1;
    incidents.errors.push(event);
    return event;
  }
  function makeGoalV2(clubId, lineup, minute, details={}){
    const scorer = details.scorer || selectChanceShooterV2({ lineup }, Boolean(details.setPiece));
    if(!scorer) return { clubId, playerId:null, assistId:null, minute, setPiece:Boolean(details.setPiece), errorGoal:Boolean(details.errorGoal), errorById:details.errorById || null, chanceQuality:Number(details.chanceQuality || 0) };
    const possibleAssisters = lineup.filter(p=>p.id !== scorer?.id && p.position !== 'POR');
    const hasAssist = !details.errorGoal && Math.random() < (details.setPiece ? 0.58 : 0.72);
    const assister = hasAssist ? weightedPickV2(possibleAssisters, p => {
      const starMul = typeof playerStarReferenceMultiplier === 'function' ? playerStarReferenceMultiplier(p, 'assist') : 1;
      return (effectiveSkill(p,'paseCorto') + effectiveSkill(p,'vision') + (['ED','EI','MCO','MC'].includes(p.position)?30:6)) * starMul * simMentalityAttackMultiplier(p, details.tactic);
    }) : null;
    return {
      clubId,
      playerId:scorer.id,
      assistId:assister?.id || null,
      minute,
      setPiece:Boolean(details.setPiece),
      errorGoal:Boolean(details.errorGoal),
      errorById:details.errorById || null,
      chanceQuality:Number(details.chanceQuality || 0)
    };
  }
  function resolveChanceV2(attacking, defending, attackingClubId, defendingClubId, minute, baseGoalProb, homeOrAwayTotals, rivalTotals, incidents, currentTotalGoals=0){
    const setPiece = Math.random() < SIM_SET_PIECE_CHANCE;
    const shooter = selectChanceShooterV2(attacking, setPiece);
    if(!shooter) return null;
    const defenderPool = (defending.lineup || []).filter(p => p.position !== 'POR');
    const defender = weightedPickV2(defenderPool, p => defensivePlayerWeightV2(p, defending.tactic));
    const keeper = goalkeeperFromPowerV2(defending);
    const shooterStarMul = typeof playerStarReferenceMultiplier === 'function' ? playerStarReferenceMultiplier(shooter, 'goal') : 1;
    const shooterScore = simAvg([
      effectiveSkill(shooter,'remate') * 1.15,
      effectiveSkill(shooter,'posicionamiento'),
      effectiveSkill(shooter,'serenidad'),
      setPiece ? effectiveSkill(shooter,'cabezazo') * 1.15 : effectiveSkill(shooter,'regate') * 0.85,
      currentMorale(shooter.id) * 0.45
    ]) * shooterStarMul;
    const defenderScore = defender ? simAvg([
      effectiveSkill(defender,'marca'),
      effectiveSkill(defender,'entradas'),
      effectiveSkill(defender,'posicionamiento'),
      effectiveSkill(defender,'serenidad') * 0.55
    ]) : 44;
    const keeperStarMul = keeper && typeof playerStarReferenceMultiplier === 'function' ? playerStarReferenceMultiplier(keeper, 'save') : 1;
    const keeperScore = keeper ? simAvg([
      effectiveSkill(keeper,'porteria') * 1.35,
      effectiveSkill(keeper,'posicionamiento'),
      effectiveSkill(keeper,'serenidad') * 0.85,
      currentMorale(keeper.id) * 0.35
    ]) * keeperStarMul * simMentalityDefenseMultiplier(keeper, defending.tactic) : 38;
    const individualGoalProb = simClamp(0.16 + (shooterScore - (keeperScore * 0.56 + defenderScore * 0.44)) / 150 + (setPiece ? 0.015 : 0), 0.025, 0.72);
    const collectiveWeight = simClamp(SIM_TEAM_WEIGHT, 0, 1);
    const individualWeight = simClamp(SIM_INDIVIDUAL_WEIGHT, 0, 1);
    const divisor = Math.max(0.01, collectiveWeight + individualWeight);
    const rawGoalProb = simClamp(((baseGoalProb * collectiveWeight) + (individualGoalProb * individualWeight)) / divisor, 0.018, 0.78);
    const highScorePenalty = simHighScoreGoalPenaltyForNextGoal(currentTotalGoals);
    const goalProb = simClamp(rawGoalProb * (1 - highScorePenalty), 0, 0.78);
    const defensiveSafety = keeper ? keeperScore * 0.55 + defenderScore * 0.45 : defenderScore;
    const errorCandidate = pickErrorPlayerV2(defending, defendingClubId);
    const rawPlayerRisk = SIM_USE_PLAYER_ERROR_FORMULA ? playerErrorRiskV2(errorCandidate, defendingClubId) : simClamp(0.015 + (74 - defensiveSafety) / 1200 + baseGoalProb * 0.035 + (setPiece ? 0.008 : 0), 0.004, 0.12);
    const playerRisk = rawPlayerRisk * ((defending.styleEffects && Number(defending.styleEffects.errorRiskMultiplier)) || 1);
    const teamErrors = Number(rivalTotals.errors || 0);
    const errorChance = teamErrors >= SIM_MAX_TEAM_ERRORS ? 0 : simClamp(playerRisk * SIM_PLAYER_ERROR_SCALE + baseGoalProb * 0.03 + (setPiece ? 0.006 : 0), 0.003, 0.42);
    const goal = Math.random() < goalProb;
    let errorEvent = null;
    let errorGoal = false;
    if(goal){
      errorGoal = Math.random() < SIM_GOAL_ERROR_ATTRIBUTION_RATE;
      if(errorGoal) errorEvent = registerErrorEventV2(rivalTotals, incidents, defending, defendingClubId, attackingClubId, minute, true);
      return makeGoalV2(attackingClubId, attacking.lineup, minute, { scorer:shooter, setPiece, errorGoal:Boolean(errorEvent), errorById:errorEvent?.playerId || null, chanceQuality:goalProb, tactic:attacking.tactic });
    }
    if(Math.random() < errorChance){
      registerErrorEventV2(rivalTotals, incidents, defending, defendingClubId, attackingClubId, minute, false);
    }
    const saveBase = simClamp((0.28 + (keeperScore - shooterScore) / 240 + baseGoalProb * 0.75) * (keeperStarMul > 1 ? 1 + ((keeperStarMul - 1) * 0.45) : 1), 0.08, 0.88);
    if(keeper && (baseGoalProb >= 0.11 || individualGoalProb >= 0.22) && Math.random() < saveBase){
      rivalTotals.keySaves = Number(rivalTotals.keySaves || 0) + 1;
      incidents.keySaves.push({ clubId:defendingClubId, playerId:keeper.id, minute, chanceById:shooter.id, chanceQuality:Number(goalProb.toFixed(2)) });
    }
    return null;
  }
  function makeCardsV2(clubId, power, fouls){
    const cards = [];
    const cardMultiplier = simClamp(Number(power?.styleEffects?.cardMultiplier || 1), 0.20, 2.50);
    const yellowCount = simClamp(poissonV2((disciplinaryFoulsV987(fouls) * SIM_CARD_RATE_MULTIPLIER * cardMultiplier) / 7.6), 0, 6);
    const byPlayer = new Map();
    for(let i=0;i<yellowCount;i++){
      const p = weightedPickV2(power.lineup, cardWeightV2);
      if(!p) continue;
      const current = byPlayer.get(p.id) || 0;
      byPlayer.set(p.id, current + 1);
      if(current === 0) cards.push({ clubId, playerId:p.id, type:'yellow', minute:Math.floor(simRnd(5,88)) });
      else cards.push({ clubId, playerId:p.id, type:'secondYellowRed', minute:Math.floor(simRnd(35,90)) });
    }
    const directRedCandidates = power.lineup.filter(p => p.position !== 'POR' && hiddenStats(p).aggression >= 76);
    const directChance = simClamp(((power.aggression - 60) / 290) * SIM_CARD_RATE_MULTIPLIER * SIM_DIRECT_RED_RATE_MULTIPLIER * cardMultiplier, 0.0001, 0.08);
    if(directRedCandidates.length && Math.random() < directChance){
      const p = weightedPickV2(directRedCandidates, cardWeightV2);
      cards.push({ clubId, playerId:p.id, type:'red', minute:Math.floor(simRnd(20,90)) });
    }
    return cards.sort((a,b)=>a.minute-b.minute);
  }
  function makeInjuriesV2(clubId, ownPower, context){
    const injuries = [];
    const candidates = (ownPower.lineup || []).filter(player => !isUnavailable(player.id));
    candidates.forEach(player => {
      const injuryMultiplier = simClamp(Number(ownPower?.styleEffects?.injuryMultiplier || 1), 0.35, 2.20);
      const cardMultiplier = typeof specialMatchInjuryMultiplier === 'function' ? specialMatchInjuryMultiplier(clubId) : 1;
      const contextMultiplier = typeof matchInjuryContextMultiplier === 'function' ? matchInjuryContextMultiplier(clubId) : 1;
      const chance = simClamp(injuryChanceForPlayer(player.id, context.pitch) * injuryMultiplier * cardMultiplier * contextMultiplier, 0, 0.95);
      if(Math.random() < chance){
        const injury = typeof pickInjuryTypeForPlayer === 'function' ? pickInjuryTypeForPlayer(player.id) : pickInjuryType();
        const matchesOut = Math.floor(simRnd(injury.minTurns, injury.maxTurns + 1));
        const duringMatch = Math.random() < 0.72;
        injuries.push({
          clubId,
          playerId:player.id,
          type:'injury',
          name:injury.name,
          injuryLabel:injury.name,
          probability:injury.probability,
          chance:Math.round(chance * 100),
          matchesOut,
          minute:duringMatch ? Math.floor(simRnd(8,89)) : 90,
          phase:duringMatch ? 'durante' : 'final',
          highLoad:Boolean(injury.highLoad),
          highLoadRatio:injury.highLoadRatio,
          highLoadPlayed:injury.highLoadPlayed,
          highLoadReference:injury.highLoadReference
        });
      }
    });
    return injuries.sort((a,b)=>a.minute-b.minute);
  }
  function finalResultKey(gf, gc){
    if(gf > gc) return 'winning';
    if(gf < gc) return 'losing';
    return 'drawing';
  }
  function instructionConditionDelta(tactic, gf, gc, starterIds){
    const instructions = normalizeMatchInstructions(tactic?.matchInstructions);
    const state = finalResultKey(gf, gc);
    const selected = instructions[state];
    let delta = 0;
    if(state === 'winning' && selected === 'lower') delta = 2;
    if(state === 'winning' && selected === 'push') delta = -5;
    if(state === 'drawing' && selected === 'lower') delta = 1;
    if(state === 'drawing' && selected === 'push') delta = -1;
    if(state === 'losing' && selected === 'lower') delta = 5;
    if(state === 'losing' && selected === 'push') delta = -5;
    const result = {};
    if(delta !== 0) (starterIds || []).forEach(id => result[id] = delta);
    return result;
  }

  function sectorStyleConditionDelta(power, starterIds){
    const delta = Math.round(Number(power?.styleEffects?.conditionDelta || 0));
    const result = {};
    if(delta !== 0) (starterIds || []).forEach(id => result[id] = delta);
    return result;
  }
  function mergeConditionDeltas(...objects){
    const merged = {};
    objects.forEach(obj => Object.entries(obj || {}).forEach(([id, delta]) => { merged[id] = (merged[id] || 0) + delta; }));
    return merged;
  }

  function liveNormalizeInstruction(value){
    const clean = String(value || '').trim();
    if(clean === 'all_attack') return 'attack';
    if(clean === 'huevos') return 'fight';
    if(clean === 'lower') return 'lower_tempo';
    return LIVE_MANAGER_INSTRUCTIONS.some(opt => opt.value === clean) ? clean : 'none';
  }
  function liveInstructionLabel(value){
    return LIVE_MANAGER_INSTRUCTIONS.find(opt => opt.value === value)?.label || 'Sin instrucciones';
  }
  function clonePowerForLive(power){
    return {
      ...power,
      profile:{ ...(power?.profile || {}) },
      counts:{ ...(power?.counts || {}) },
      styleEffects:{ ...(power?.styleEffects || emptySectorStyleEffectsV2()) }
    };
  }
  function applyLiveInstructionToPower(power, instruction){
    const copy = clonePowerForLive(power);
    const style = copy.styleEffects;
    if(instruction === 'all_defense'){
      copy.defense *= 1.20;
      copy.keeper *= 1.08;
      copy.midfield *= 0.95;
      copy.attack *= 0.34;
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 0.28, 0.10, 1.55);
      style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * 0.20, 0.08, 1.55);
      style.conversionMultiplier = simClamp((style.conversionMultiplier || 1) * 0.35, 0.12, 1.40);
      style.rivalAttackMultiplier = simClamp((style.rivalAttackMultiplier || 1) * 0.70, 0.45, 1.22);
      style.rivalChanceMultiplier = simClamp((style.rivalChanceMultiplier || 1) * 0.58, 0.35, 1.22);
      style.rivalConversionMultiplier = simClamp((style.rivalConversionMultiplier || 1) * 0.82, 0.60, 1.22);
      style.possessionAdd = simClamp((style.possessionAdd || 0) - 8, -18, 18);
    }else if(instruction === 'hold_result'){
      copy.midfield *= 1.07;
      copy.defense *= 1.03;
      copy.attack *= 0.96;
      style.possessionAdd = simClamp((style.possessionAdd || 0) + 5, -12, 18);
      style.errorRiskMultiplier = simClamp((style.errorRiskMultiplier || 1) * 0.93, 0.45, 1.55);
    }else if(instruction === 'counter'){
      copy.attack *= 1.02;
      copy.midfield *= 0.94;
      copy.defense *= 1.02;
      style.possessionAdd = simClamp((style.possessionAdd || 0) - 7, -18, 18);
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 0.82, 0.35, 1.55);
      style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * 1.18, 0.45, 1.65);
      style.conversionMultiplier = simClamp((style.conversionMultiplier || 1) * 1.08, 0.40, 1.55);
    }else if(instruction === 'lower_tempo'){
      copy.attack *= 0.90;
      copy.midfield *= 0.90;
      copy.defense *= 0.97;
      style.possessionAdd = simClamp((style.possessionAdd || 0) - 4, -18, 18);
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 0.78, 0.35, 1.55);
      style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * 0.82, 0.35, 1.55);
      style.conversionMultiplier = simClamp((style.conversionMultiplier || 1) * 0.90, 0.35, 1.55);
      style.injuryMultiplier = simClamp((style.injuryMultiplier || 1) * 0.50, 0.25, 2.20);
    }else if(instruction === 'clean_play'){
      copy.midfield *= 1.02;
      copy.defense *= 0.98;
      style.possessionAdd = simClamp((style.possessionAdd || 0) + 4, -18, 18);
      style.foulAdd = simClamp((style.foulAdd || 0) - 0.85, -2.2, 3.0);
      style.cardMultiplier = simClamp((style.cardMultiplier || 1) * 0.50, 0.20, 2.50);
    }else if(instruction === 'fight'){
      copy.attack *= 1.08;
      copy.defense *= 1.07;
      copy.keeper *= 1.03;
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 1.06, 0.45, 1.55);
      style.rivalAttackMultiplier = simClamp((style.rivalAttackMultiplier || 1) * 0.97, 0.55, 1.40);
      style.foulAdd = simClamp((style.foulAdd || 0) + 0.45, -1.2, 3.0);
    }else if(instruction === 'attack'){
      copy.attack *= 1.08;
      copy.midfield *= 1.01;
      copy.defense *= 0.94;
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 1.07, 0.45, 1.55);
      style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * 1.06, 0.45, 1.55);
      style.rivalAttackMultiplier = simClamp((style.rivalAttackMultiplier || 1) * 1.08, 0.55, 1.40);
      style.rivalChanceMultiplier = simClamp((style.rivalChanceMultiplier || 1) * 1.06, 0.55, 1.40);
    }else if(instruction === 'goal_anyway'){
      copy.attack *= 1.36;
      copy.midfield *= 1.02;
      copy.defense *= 0.80;
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 1.26, 0.45, 1.90);
      style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * 1.26, 0.45, 1.90);
      style.rivalAttackMultiplier = simClamp((style.rivalAttackMultiplier || 1) * 1.18, 0.55, 1.50);
      style.rivalChanceMultiplier = simClamp((style.rivalChanceMultiplier || 1) * 1.14, 0.55, 1.50);
      style.possessionAdd = simClamp((style.possessionAdd || 0) - 3, -18, 18);
      style.foulAdd = simClamp((style.foulAdd || 0) + 0.20, -1.2, 3.0);
    }
    copy.liveInstruction = instruction;
    copy.liveInstructionLabel = liveInstructionLabel(instruction);
    return copy;
  }
  function liveInstructionConditionDelta(value){
    if(value === 'goal_anyway') return -2;
    if(value === 'attack') return -1;
    if(value === 'fight') return -1;
    if(value === 'counter') return -1;
    return 0;
  }
  function liveInstructionRecoveryInterval(value){
    if(value === 'all_defense') return 5;
    if(value === 'lower_tempo') return 3;
    return 0;
  }
  function ensureLiveTacticShape(tactic, clubId){
    const next = { ...(tactic || {}) };
    next.formation = next.formation || '4-4-2';
    next.layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(next.layoutMode) : 'preset';
    next.customSlots = typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(next.customSlots, next) : [];
    if(!Array.isArray(next.starters) || next.starters.length !== 11){
      next.starters = selectLineup(clubId, next).map(p => Number(p.id));
    }else{
      next.starters = next.starters.slice(0,11).map(id => Number(id || 0));
    }
    const starterIds = next.starters.filter(Boolean);
    if(!Array.isArray(next.bench) || !next.bench.length){
      next.bench = autoSelectBench(clubId, starterIds).map(p => Number(p.id));
    }else{
      next.bench = next.bench.map(id => Number(id || 0)).filter(Boolean);
    }
    if(next.bench.length < 10 && typeof autoSelectBench === 'function'){
      const exclude = starterIds.concat(next.bench);
      autoSelectBench(clubId, exclude).map(p => Number(p.id)).forEach(id => {
        if(id && !starterIds.includes(id) && !next.bench.includes(id) && next.bench.length < 10) next.bench.push(id);
      });
    }
    next.bench = next.bench.filter(id => id && !starterIds.includes(id)).slice(0, 10);
    next.autoSubs = [];
    next.matchInstructions = normalizeMatchInstructions(next.matchInstructions);
    next.sectorStyles = normalizeSectorStylesV2(next.sectorStyles);
    next.goalkeeperDistribution = normalizeGoalkeeperDistributionV974(next.goalkeeperDistribution);
    next.buildUpStyle = normalizeBuildUpStyleV974(next.buildUpStyle);
    return next;
  }
  function liveSideKey(session, clubId){
    return Number(clubId) === Number(session.match.homeId) ? 'home' : 'away';
  }
  function liveTacticForClub(session, clubId){
    return liveSideKey(session, clubId) === 'home' ? session.homeTactic : session.awayTactic;
  }
  function liveSetTacticForClub(session, clubId, tactic){
    if(liveSideKey(session, clubId) === 'home') session.homeTactic = tactic;
    else session.awayTactic = tactic;
  }
  function liveFormationKeys(){
    try{ return Object.keys(FORMATIONS || {}); }
    catch(_){ return ['4-4-2','4-3-3','4-2-3-1','3-5-2','5-3-2','4-1-4-1','3-4-3','4-5-1','4-3-1-2','5-4-1']; }
  }
  function liveFormationSlots(formation){
    try{ return FORMATIONS[formation] || FORMATIONS['4-4-2'] || []; }
    catch(_){ return []; }
  }
  function liveTacticSlots(tactic){
    try{ return typeof tacticRoleSlots === 'function' ? tacticRoleSlots(tactic) : liveFormationSlots(tactic?.formation || '4-4-2'); }
    catch(_){ return liveFormationSlots(tactic?.formation || '4-4-2'); }
  }
  function livePlayerSlotScore(player, slot){
    if(!player) return -999;
    const position = String(player.position || '');
    const role = String(slot || '');
    let score = Number(effectiveOverall(player) || 0) * Number(zoneFactor(player, role) || 0.65);
    if(position === role) score += 20;
    if(role === 'POR' && position !== 'POR') score -= 180;
    if(role !== 'POR' && position === 'POR') score -= 180;
    if(['DFC','LI','LD'].includes(role) && ['DFC','LI','LD'].includes(position)) score += 4;
    if(['MCD','MC','MCO','MI','MD'].includes(role) && ['MCD','MC','MCO','MI','MD'].includes(position)) score += 4;
    if(['DC','EI','ED'].includes(role) && ['DC','EI','ED'].includes(position)) score += 4;
    return score;
  }
  function normalizeStarterOrderForLive(tactic, starterOrder){
    const current = Array.isArray(tactic?.starters) ? tactic.starters.map(Number).filter(Boolean) : [];
    const wanted = Array.isArray(starterOrder) ? starterOrder.map(Number).filter(Boolean) : current;
    const unique = [];
    wanted.concat(current).forEach(id => { if(id && !unique.includes(id)) unique.push(id); });
    return unique.slice(0, 11);
  }
  function optimizeLiveStartersForFormation(starterIds, formation){
    const slots = liveFormationSlots(formation);
    const remaining = starterIds.map(id => playerById(id)).filter(Boolean);
    const ordered = [];
    slots.slice(0, 11).forEach(slot => {
      if(!remaining.length) return;
      let bestIndex = 0;
      let bestScore = -9999;
      remaining.forEach((player, index) => {
        const score = livePlayerSlotScore(player, slot);
        if(score > bestScore){ bestScore = score; bestIndex = index; }
      });
      ordered.push(Number(remaining.splice(bestIndex, 1)[0].id));
    });
    remaining.forEach(player => { if(ordered.length < 11) ordered.push(Number(player.id)); });
    return ordered.slice(0, 11);
  }
  function applyLiveFormation(session, clubId, formation, starterOrder=null){
    if(!session || session.finished) return false;
    const cleanFormation = String(formation || '').trim();
    if(!liveFormationSlots(cleanFormation).length) return false;
    const tactic = liveTacticForClub(session, clubId);
    if(!tactic) return false;
    const starters = normalizeStarterOrderForLive(tactic, starterOrder);
    if(starters.length < 7) return false;
    tactic.formation = cleanFormation;
    tactic.layoutMode = 'preset';
    tactic.starters = Array.isArray(starterOrder) ? starters.slice(0, 11) : optimizeLiveStartersForFormation(starters, cleanFormation);
    tactic.autoSubs = [];
    liveSetTacticForClub(session, clubId, tactic);
    return true;
  }
  function liveBaseCondition(playerId){
    try{ return simClamp(Number(currentCondition(playerId) || 75), 1, 100); }
    catch(_){ return 75; }
  }
  function liveBotConditionFloor(clubId, player){
    const club = seed?.clubs?.find(item => Number(item.id || 0) === Number(clubId || 0));
    const reputation = Number(club?.reputation || club?.prestige || 50);
    const position = String(player?.position || '').toUpperCase();
    const positionBase = position === 'POR' ? 64 : 58;
    const reputationBonus = (reputation - 45) * 0.22;
    const randomOffset = simRnd(0, 12);
    return simClamp(Math.round(positionBase + reputationBonus + randomOffset), 55, 84);
  }
  function normalizeLiveBotConditionsForMatch(match, homeTactic, awayTactic){
    if(!game || !match) return { players:0, clubs:0 };
    game.playerCondition = game.playerCondition || {};
    const ownId = Number(game?.selectedClubId || 0);
    let adjustedPlayers = 0;
    let adjustedClubs = 0;
    const collectTacticIds = tactic => {
      const ids = new Set();
      (tactic?.starters || []).forEach(id => { const clean = Number(id || 0); if(clean) ids.add(clean); });
      (tactic?.bench || []).forEach(id => { const clean = Number(id || 0); if(clean) ids.add(clean); });
      return ids;
    };
    const normalizeClub = (clubId, tactic) => {
      const cleanClubId = Number(clubId || 0);
      if(!cleanClubId || cleanClubId === ownId) return;
      if(typeof normalizeBotWearAndConditionForClub === 'function'){
        normalizeBotWearAndConditionForClub(cleanClubId, { reason:'before_live_match' });
      }
      const ids = collectTacticIds(tactic);
      if(!ids.size){
        playersByClub(cleanClubId).slice(0, 18).forEach(player => ids.add(Number(player.id || 0)));
      }
      let clubAdjusted = 0;
      ids.forEach(id => {
        const player = playerById(id);
        if(!player || player.freeAgent || player.retired || isInjured(player.id) || isSuspended(player.id)) return;
        const current = liveBaseCondition(player.id);
        const floor = liveBotConditionFloor(cleanClubId, player);
        if(current < floor){
          game.playerCondition[player.id] = floor;
          adjustedPlayers += 1;
          clubAdjusted += 1;
        }
      });
      if(clubAdjusted > 0) adjustedClubs += 1;
    };
    normalizeClub(match.homeId, homeTactic);
    normalizeClub(match.awayId, awayTactic);
    if(adjustedPlayers > 0){
      game.liveBotConditionRepairLog = Array.isArray(game.liveBotConditionRepairLog) ? game.liveBotConditionRepairLog : [];
      game.liveBotConditionRepairLog.unshift({ date:game.currentDate || '', matchId:match.id || null, players:adjustedPlayers, clubs:adjustedClubs, createdAt:Date.now() });
      game.liveBotConditionRepairLog = game.liveBotConditionRepairLog.slice(0, 20);
    }
    return { players:adjustedPlayers, clubs:adjustedClubs };
  }
  function liveHiddenValue(player, keys, fallback=50){
    try{
      const h = typeof hiddenStats === 'function' ? hiddenStats(player) : {};
      for(const key of keys){
        const value = Number(h?.[key]);
        if(Number.isFinite(value)) return simClamp(value, 1, 99);
      }
    }catch(_){ /* noop */ }
    return fallback;
  }
  function liveEffectiveCondition(session, playerId){
    const id = Number(playerId || 0);
    const delta = Number(session?.liveConditionDeltas?.[id] || 0) + Number(session?.instructionConditionDeltas?.[id] || 0);
    return simClamp(Math.round(liveBaseCondition(id) + delta), 1, 100);
  }
  function liveFatiguePerMinute(player, instruction='none'){
    if(!player) return 0.10;
    const resistance = simClamp(Number(typeof matchSkill === 'function' ? matchSkill(player, 'resistencia') : effectiveSkill(player, 'resistencia')) || 55, 1, 99);
    const genetics = liveHiddenValue(player, ['genetics','genetica','genética','genetic','growth','gen'], 50);
    const pos = String(player.position || '').toUpperCase();
    const posLoad = pos === 'POR' ? 0.55 : (['MC','MCD','MCO','MI','MD','LD','LI','ED','EI'].includes(pos) ? 1.08 : 1.00);
    const instructionLoad = ({ attack:0.045, goal_anyway:0.070, fight:0.020, counter:0.015, clean_play:-0.006, hold_result:-0.010, all_defense:0.000, lower_tempo:-0.030, push:0.025, lower:-0.018 })[instruction] || 0;
    const instructionMultiplier = instruction === 'fight' ? 1.18 : (instruction === 'goal_anyway' ? 1.12 : 1.00);
    const base = 0.055 + (100 - resistance) * 0.0018 + (100 - genetics) * 0.0012;
    return simClamp((base + instructionLoad) * posLoad * LIVE_FATIGUE_MULTIPLIER * instructionMultiplier, 0.07, 0.72);
  }
  function applyLiveMinuteFatigue(session, clubId, instruction='none', multiplier=1, guardKey=''){
    if(!session) return;
    session.liveConditionDeltas = session.liveConditionDeltas || {};
    const safeMultiplier = simClamp(Number(multiplier || 1), 0.25, 4);
    if(guardKey){
      session.liveFatigueAppliedKeys = session.liveFatigueAppliedKeys instanceof Set ? session.liveFatigueAppliedKeys : new Set();
      const key = `${guardKey}:${Number(clubId || 0)}`;
      if(session.liveFatigueAppliedKeys.has(key)) return;
      session.liveFatigueAppliedKeys.add(key);
    }
    const tactic = liveTacticForClub(session, clubId);
    (tactic?.starters || []).map(Number).filter(Boolean).forEach(id => {
      if(liveIsUnavailableForPlay(session, id)) return;
      const player = playerById(id);
      if(!player) return;
      session.liveConditionDeltas[id] = Number(session.liveConditionDeltas[id] || 0) - (liveFatiguePerMinute(player, instruction) * safeMultiplier);
    });
  }
  function liveRestRecoveryPerPhase(player){
    if(!player) return 0.24;
    const resistance = simClamp(Number(typeof matchSkill === 'function' ? matchSkill(player, 'resistencia') : effectiveSkill(player, 'resistencia')) || 55, 1, 99);
    const genetics = liveHiddenValue(player, ['genetics','genetica','genética','genetic','growth','gen'], 50);
    const pos = String(player.position || '').toUpperCase();
    const posFactor = pos === 'POR' ? 0.72 : 1;
    return simClamp((0.13 + resistance * 0.0018 + genetics * 0.0014) * posFactor, 0.18, 0.46);
  }
  function applyLiveRestRecovery(session, clubId){
    if(!session) return 0;
    session.liveConditionDeltas = session.liveConditionDeltas || {};
    const tactic = liveTacticForClub(session, clubId);
    let recovered = 0;
    (tactic?.starters || []).map(Number).filter(Boolean).forEach(id => {
      if(liveIsUnavailableForPlay(session, id)) return;
      const player = playerById(id);
      if(!player) return;
      const currentDelta = Number(session.liveConditionDeltas[id] || 0);
      if(currentDelta >= 0) return;
      const nextDelta = Math.min(0, currentDelta + liveRestRecoveryPerPhase(player));
      recovered += Math.max(0, nextDelta - currentDelta);
      session.liveConditionDeltas[id] = nextDelta;
    });
    return recovered;
  }
  function livePlayedPhaseCount(session){
    if(!session) return 0;
    return (session.blocks || []).slice(0, Number(session.blockIndex || 0)).filter(block => block?.playable !== false).length;
  }
  function liveCurrentPeriod(session){
    const last = session?.blocks?.[Math.max(0, Number(session?.blockIndex || 0) - 1)] || null;
    const next = session?.blocks?.[Number(session?.blockIndex || 0)] || null;
    if(next?.period === 'break' || last?.period === 'break') return 'break';
    if(Number(session?.currentMinute || 0) <= 45 && !session?.finished) return 'first';
    return session?.finished ? 'final' : 'second';
  }
  function liveUsedSubCount(session, clubId){ return (liveEnsureSubBucket(session, clubId) || []).length; }
  function liveIsSentOff(session, playerId){
    const id = Number(playerId || 0);
    if(!id || !session) return false;
    if(session.sentOffByPlayer && session.sentOffByPlayer[String(id)]) return true;
    return (session.cards || []).some(card => Number(card.playerId) === id && ['red','secondYellowRed'].includes(String(card.type || '')));
  }

  function liveMarkInjuredGhost(session, clubId, playerId){
    const id = Number(playerId || 0);
    if(!session || !id) return;
    const clubKey = String(clubId || '');
    session.injuredGhostByPlayer = session.injuredGhostByPlayer || {};
    session.injuredGhostByClub = session.injuredGhostByClub || {};
    session.injuredGhostByClub[clubKey] = Array.isArray(session.injuredGhostByClub[clubKey]) ? session.injuredGhostByClub[clubKey] : [];
    session.injuredGhostByPlayer[String(id)] = true;
    if(!session.injuredGhostByClub[clubKey].map(Number).includes(id)) session.injuredGhostByClub[clubKey].push(id);
  }
  function liveIsInjuredGhost(session, playerId){
    const id = Number(playerId || 0);
    if(!id || !session) return false;
    if(session.injuredGhostByPlayer && session.injuredGhostByPlayer[String(id)]) return true;
    return (session.injuries || []).some(injury => Number(injury.playerId) === id);
  }
  function liveUnavailableIds(session){
    const out = new Set();
    Object.keys(session?.sentOffByPlayer || {}).forEach(id => { const n = Number(id); if(n) out.add(n); });
    Object.keys(session?.injuredGhostByPlayer || {}).forEach(id => { const n = Number(id); if(n) out.add(n); });
    return out;
  }
  function liveIsUnavailableForPlay(session, playerId){
    return liveIsSentOff(session, playerId) || liveIsInjuredGhost(session, playerId);
  }
  function liveMarkSentOff(session, clubId, playerId){
    const id = Number(playerId || 0);
    if(!session || !id) return;
    const clubKey = String(clubId || '');
    session.sentOffByPlayer = session.sentOffByPlayer || {};
    session.expelledByClub = session.expelledByClub || {};
    session.expelledByClub[clubKey] = Array.isArray(session.expelledByClub[clubKey]) ? session.expelledByClub[clubKey] : [];
    session.sentOffByPlayer[String(id)] = true;
    if(!session.expelledByClub[clubKey].map(Number).includes(id)) session.expelledByClub[clubKey].push(id);
  }
  function liveEventSummaryForPlayer(session, playerId){
    const id = Number(playerId || 0);
    const summary = { goals:0, assists:0, yellow:0, red:0, injuries:0, saves:0, errors:0, goalErrors:0 };
    if(!id || !session) return summary;
    (session.goals || []).forEach(goal => {
      if(Number(goal.scorerId) === id) summary.goals += 1;
      if(Number(goal.assistId) === id) summary.assists += 1;
    });
    (session.cards || []).forEach(card => {
      if(Number(card.playerId) !== id) return;
      if(String(card.type || '') === 'yellow') summary.yellow += 1;
      if(['red','secondYellowRed'].includes(String(card.type || ''))) summary.red += 1;
    });
    (session.injuries || []).forEach(injury => { if(Number(injury.playerId) === id) summary.injuries += 1; });
    (session.keySaves || []).forEach(save => { if(Number(save.goalkeeperId || save.playerId) === id) summary.saves += 1; });
    (session.errors || []).forEach(error => {
      if(Number(error.playerId) !== id) return;
      summary.errors += 1;
      if(error.goal) summary.goalErrors += 1;
    });
    return summary;
  }
  function liveBotPlayerRating(session, clubId, playerId, slot){
    const player = playerById(playerId);
    if(!player) return 4.0;
    const condition = liveEffectiveCondition(session, playerId);
    const fit = Math.round(Number(zoneFactor(player, slot || player.position) || 0.65) * 100);
    const overall = Number(effectiveOverall(player) || 0);
    const morale = Number(currentMorale(playerId) || 50);
    const events = liveEventSummaryForPlayer(session, playerId);
    const scoreFor = Number(clubId) === Number(session.match.homeId)
      ? { own:session.homeGoals, rival:session.awayGoals }
      : { own:session.awayGoals, rival:session.homeGoals };
    let rating = 6.05 + (overall - 62) * 0.012 + (morale - 55) * 0.006 + (condition - 70) * 0.006 + (fit - 78) * 0.005;
    rating += events.goals * 0.80 + events.assists * 0.45 + events.saves * 0.22;
    rating -= events.yellow * 0.20 + events.red * 1.15 + events.errors * 0.35 + events.goalErrors * 0.50 + events.injuries * 0.25;
    rating += simClamp(scoreFor.own - scoreFor.rival, -3, 3) * 0.08;
    return simClamp(rating, 3.0, 10.0);
  }
  function liveFinalPlayerEventSummary(session, playerId){
    const id = Number(playerId || 0);
    const summary = { goals:0, assists:0, yellow:0, red:0, injuries:0, saves:0, errors:0, goalErrors:0 };
    (session?.goals || []).forEach(goal => {
      if(Number(goal.playerId || goal.scorerId || 0) === id) summary.goals += 1;
      if(Number(goal.assistId || 0) === id) summary.assists += 1;
    });
    (session?.cards || []).forEach(card => {
      if(Number(card.playerId || 0) !== id) return;
      if(card.type === 'yellow') summary.yellow += 1;
      else if(card.type === 'secondYellowRed'){ summary.yellow += 1; summary.red += 1; }
      else if(card.type === 'red') summary.red += 1;
    });
    (session?.injuries || []).forEach(injury => { if(Number(injury.playerId || 0) === id) summary.injuries += 1; });
    (session?.keySaves || []).forEach(save => { if(Number(save.playerId || save.goalkeeperId || 0) === id) summary.saves += 1; });
    (session?.errors || []).forEach(error => {
      if(Number(error.playerId || 0) !== id) return;
      summary.errors += 1;
      if(error.goal) summary.goalErrors += 1;
    });
    return summary;
  }
  function liveFinalPlayerSlot(session, clubId, playerId){
    const tactic = liveTacticForClub(session, clubId);
    const slots = liveTacticSlots(tactic);
    const currentIndex = (tactic?.starters || []).findIndex(id => Number(id) === Number(playerId));
    if(currentIndex >= 0) return { slot:slots[currentIndex] || playerById(playerId)?.position || 'MC', inField:true };
    const sub = (session?.substitutions || []).find(item => Number(item.outId || 0) === Number(playerId) || Number(item.inId || 0) === Number(playerId));
    return { slot:String(sub?.slot || playerById(playerId)?.position || 'MC'), inField:false };
  }
  function liveFinalPlayerRating(session, clubId, playerId){
    const player = playerById(playerId);
    if(!player) return 6;
    const events = liveFinalPlayerEventSummary(session, playerId);
    const placement = liveFinalPlayerSlot(session, clubId, playerId);
    const overall = simClamp(Number(effectiveOverall(player) || 0), 1, 99);
    const condition = simClamp(Number(liveEffectiveCondition(session, playerId) || 0), 1, 100);
    const morale = simClamp(Number(currentMorale(playerId) || 50), 1, 100);
    const fit = placement.inField ? Math.round(Number(zoneFactor(player, placement.slot) || 0.65) * 100) : 75;
    const ownGoals = Number(clubId) === Number(session.match.homeId) ? Number(session.homeGoals || 0) : Number(session.awayGoals || 0);
    const rivalGoals = Number(clubId) === Number(session.match.homeId) ? Number(session.awayGoals || 0) : Number(session.homeGoals || 0);
    let rating = 6.05 + (overall - 62) * 0.012 + (morale - 55) * 0.006 + (condition - 70) * 0.005 + (fit - 78) * 0.004;
    rating += events.goals * 0.82 + events.assists * 0.48 + events.saves * 0.24;
    rating -= events.yellow * 0.22 + events.red * 1.10 + events.errors * 0.32 + events.goalErrors * 0.42 + events.injuries * 0.18;
    rating += simClamp(ownGoals - rivalGoals, -3, 3) * 0.08;
    return simClamp(rating, 3, 10);
  }
  function liveFinalPlayerRatings(session){
    const rows = [];
    [[Number(session?.match?.homeId || 0), [...(session?.playedIdsHome || [])]], [Number(session?.match?.awayId || 0), [...(session?.playedIdsAway || [])]]].forEach(([clubId, ids]) => {
      [...new Set((ids || []).map(Number).filter(Boolean))].forEach(playerId => rows.push({ clubId, playerId, rating:Number(liveFinalPlayerRating(session, clubId, playerId).toFixed(2)) }));
    });
    return rows;
  }
  function liveBotSubPressure(session, minute, usedCount){
    if(usedCount >= 5) return 999;
    if(minute < 45) return 999;
    if(minute >= 84) return usedCount < 5 ? 18 : 999;
    if(minute >= 78) return usedCount < 5 ? 24 : 999;
    if(minute >= 70) return usedCount < 2 ? 34 : 52;
    if(minute >= 60) return usedCount < 1 ? 42 : 62;
    if(minute >= 45) return usedCount < 1 ? 54 : 999;
    return 999;
  }
  function liveBenchRolePriorityForBot(player, targetSlot, losing, winning, minute){
    const pos = String(player?.position || '').toUpperCase();
    let bonus = 0;
    if(losing && minute >= 60){
      if(['DC','ED','EI','MCO'].includes(pos)) bonus += 22;
      if(['DFC','LD','LI','POR'].includes(pos)) bonus -= 8;
    }
    if(winning && minute >= 68){
      if(['DFC','LD','LI','MCD','MC'].includes(pos)) bonus += 18;
      if(['DC','ED','EI'].includes(pos)) bonus -= 4;
    }
    if(pos === String(targetSlot || '').toUpperCase()) bonus += 10;
    return bonus;
  }
  function maybeBotAutoSubstitution(session, clubId, minute){
    const ownId = Number(game?.selectedClubId || 0);
    if(!session || Number(clubId) === ownId) return [];
    const usedCount = liveUsedSubCount(session, clubId);
    if(usedCount >= 5) return [];
    const tactic = liveTacticForClub(session, clubId);
    if(!tactic?.starters?.length || !tactic?.bench?.length) return [];
    const slots = liveTacticSlots(tactic);
    const scoreFor = Number(clubId) === Number(session.match.homeId)
      ? { own:session.homeGoals, rival:session.awayGoals }
      : { own:session.awayGoals, rival:session.homeGoals };
    const losing = scoreFor.own < scoreFor.rival;
    const winning = scoreFor.own > scoreFor.rival;
    const usedIn = new Set((session.usedIns[String(clubId)] || []).map(Number));
    const usedOut = new Set((session.usedOuts[String(clubId)] || []).map(Number));
    const subPressure = liveBotSubPressure(session, minute, usedCount);
    const triggerMinute = LIVE_BOT_SUB_MINUTES.some(mark => Math.abs(Number(minute || 0) - mark) <= 0);
    const candidates = tactic.starters.map((id, index) => {
      const player = playerById(id);
      const slot = slots[index] || player?.position || 'MC';
      if(!player) return { id:0, index, need:999, slot, condition:0, fit:0, rating:3.0 };
      const condition = liveEffectiveCondition(session, id);
      const fit = Math.round(Number(zoneFactor(player, slot) || 0.65) * 100);
      const rating = liveBotPlayerRating(session, clubId, id, slot);
      let need = (100 - condition) * 1.35 + (100 - fit) * 0.52 + Math.max(0, 6.4 - rating) * 17;
      if(minute >= 45 && condition <= 72) need += 18;
      if(minute >= 58 && condition <= 76) need += 28;
      if(minute >= 70 && condition <= 80) need += 22;
      if(rating <= 5.9 && minute >= 55) need += 26;
      if(rating <= 5.5 && minute >= 45) need += 22;
      if(losing && minute >= 60 && ['DFC','LD','LI','MCD'].includes(slot)) need += 10;
      if(losing && minute >= 68 && ['DC','ED','EI','MCO'].includes(slot)) need -= 8;
      if(winning && minute >= 70 && ['DC','ED','EI','MCO'].includes(slot)) need += 12;
      if(usedOut.has(Number(id))) need -= 999;
      return { id:Number(id), index, need, slot, condition, fit, rating };
    }).sort((a,b)=>b.need-a.need);
    const chosenOut = candidates[0];
    if(!chosenOut || !chosenOut.id) return [];
    const threshold = triggerMinute ? Math.min(subPressure, 58) : subPressure;
    if(chosenOut.need < threshold) return [];
    const bench = (tactic.bench || []).map(id => playerById(id)).filter(Boolean).filter(p => !usedIn.has(Number(p.id)) && !liveIsUnavailableForPlay(session, p.id) && (typeof canEnterMatch !== 'function' || canEnterMatch(p.id)));
    if(!bench.length) return [];
    let best = null;
    let bestScore = -99999;
    bench.forEach(player => {
      const condition = liveEffectiveCondition(session, player.id);
      let score = livePlayerSlotScore(player, chosenOut.slot) + condition * 0.55 + liveBenchRolePriorityForBot(player, chosenOut.slot, losing, winning, minute);
      const pos = String(player.position || '').toUpperCase();
      if(losing && minute >= 68 && ['DC','ED','EI','MCO'].includes(pos)) score += 18;
      if(winning && minute >= 72 && ['DFC','LD','LI','MCD','MC'].includes(pos)) score += 14;
      if(condition < 45) score -= 70;
      if(condition < 60) score -= 20;
      if(score > bestScore){ bestScore = score; best = player; }
    });
    if(!best) return [];
    return applyLiveSubstitutions(session, clubId, [{ outId:chosenOut.id, inId:best.id, trigger:'bot', manual:false }], Math.max(1, minute));
  }

  function chooseBenchForInjuredBot(session, clubId, injuredId, slot, minute){
    const tactic = liveTacticForClub(session, clubId);
    if(!tactic?.bench?.length) return null;
    const usedIn = new Set((session.usedIns[String(clubId)] || []).map(Number));
    const candidates = (tactic.bench || [])
      .map(id => playerById(id))
      .filter(Boolean)
      .filter(player => !usedIn.has(Number(player.id)) && !liveIsUnavailableForPlay(session, player.id) && (typeof canEnterMatch !== 'function' || canEnterMatch(player.id)));
    if(!candidates.length) return null;
    let best = null;
    let bestScore = -99999;
    candidates.forEach(player => {
      const condition = liveEffectiveCondition(session, player.id);
      let score = livePlayerSlotScore(player, slot) + condition * 0.45;
      if(String(player.position || '').toUpperCase() === String(slot || '').toUpperCase()) score += 18;
      if(condition < 45) score -= 40;
      if(condition < 60) score -= 14;
      if(minute >= 75 && condition > 65) score += 6;
      if(score > bestScore){ bestScore = score; best = player; }
    });
    return best;
  }
  function handleLiveInjury(session, injury, minute){
    if(!session || !injury) return [];
    const clubId = Number(injury.clubId || 0);
    const playerId = Number(injury.playerId || 0);
    if(!clubId || !playerId) return [];
    liveMarkInjuredGhost(session, clubId, playerId);
    const ownId = Number(game?.selectedClubId || 0);
    const tactic = liveTacticForClub(session, clubId);
    const index = tactic?.starters?.findIndex(id => Number(id) === playerId) ?? -1;
    const slots = liveTacticSlots(tactic);
    const slot = slots[index] || playerById(playerId)?.position || 'MC';
    if(Number(clubId) === ownId){
      session.injuryPauseRequest = { clubId, playerId, minute:Number(minute || injury.minute || 0), canSub:liveUsedSubCount(session, clubId) < 5 };
      return [];
    }
    if(!LIVE_BOT_INJURY_SUB_ENABLED || liveUsedSubCount(session, clubId) >= 5) return [];
    const replacement = chooseBenchForInjuredBot(session, clubId, playerId, slot, minute);
    if(!replacement) return [];
    return applyLiveSubstitutions(session, clubId, [{ outId:playerId, inId:replacement.id, trigger:'injury', manual:false }], Math.max(1, Number(minute || injury.minute || 0)));
  }

  function livePlayedSet(session, clubId){
    return liveSideKey(session, clubId) === 'home' ? session.playedIdsHome : session.playedIdsAway;
  }
  function liveEnsureSubBucket(session, clubId){
    const key = String(clubId);
    session.usedSubs[key] = Array.isArray(session.usedSubs[key]) ? session.usedSubs[key] : [];
    session.usedIns[key] = Array.isArray(session.usedIns[key]) ? session.usedIns[key] : [];
    session.usedOuts[key] = Array.isArray(session.usedOuts[key]) ? session.usedOuts[key] : [];
    return session.usedSubs[key];
  }
  function applyLiveSubstitutions(session, clubId, changes=[], minute=0){
    const tactic = liveTacticForClub(session, clubId);
    if(!tactic) return [];
    const usedSubs = liveEnsureSubBucket(session, clubId);
    const usedIn = new Set(session.usedIns[String(clubId)].map(Number));
    const usedOut = new Set(session.usedOuts[String(clubId)].map(Number));
    const events = [];
    for(const raw of Array.isArray(changes) ? changes : []){
      if(usedSubs.length >= 5) break;
      const outId = Number(raw?.outId || 0);
      const inId = Number(raw?.inId || 0);
      if(!outId || !inId || outId === inId) continue;
      if(liveIsSentOff(session, outId) || liveIsSentOff(session, inId) || liveIsInjuredGhost(session, inId)) continue;
      const index = tactic.starters.findIndex(id => Number(id) === outId);
      if(index < 0 || usedOut.has(outId) || usedIn.has(inId)) continue;
      if(!tactic.bench.map(Number).includes(inId)) continue;
      if(typeof canEnterMatch === 'function' && !canEnterMatch(inId)) continue;
      tactic.starters[index] = inId;
      tactic.bench = tactic.bench.filter(id => Number(id) !== inId);
      usedSubs.push({ outId, inId, minute });
      session.usedIns[String(clubId)].push(inId);
      session.usedOuts[String(clubId)].push(outId);
      livePlayedSet(session, clubId).add(inId);
      const event = { clubId, outId, inId, minute, slot:liveTacticSlots(tactic)[index] || playerById(outId)?.position || 'MC', trigger:raw?.trigger || 'manual', manual:raw?.manual !== false };
      events.push(event);
      session.substitutions.push(event);
    }
    liveSetTacticForClub(session, clubId, tactic);
    return events;
  }
  function removePlayerFromLiveTactic(session, clubId, playerId, reason=''){
    const tactic = liveTacticForClub(session, clubId);
    if(reason === 'red') liveMarkSentOff(session, clubId, playerId);
    if(!tactic?.starters) return false;
    const idx = tactic.starters.findIndex(id => Number(id) === Number(playerId));
    if(idx < 0) return false;
    tactic.starters[idx] = 0;
    liveSetTacticForClub(session, clubId, tactic);
    return true;
  }
  function liveCardsForBlock(session, clubId, power, fouls, block){
    const cards = [];
    const locallySent = new Set();
    const eligibleLineup = (power.lineup || []).filter(p => p && !liveIsUnavailableForPlay(session, p.id));
    const cardMultiplier = simClamp(Number(power?.styleEffects?.cardMultiplier || 1), 0.20, 2.50);
    const yellowCount = simClamp(probabilisticRoundV2((disciplinaryFoulsV987(fouls) * SIM_CARD_RATE_MULTIPLIER * cardMultiplier) / 7.6), 0, 2);
    session.yellowByPlayer = session.yellowByPlayer || {};
    for(let i=0;i<yellowCount;i++){
      const p = weightedPickV2(eligibleLineup.filter(item => !locallySent.has(Number(item.id))), cardWeightV2);
      if(!p) continue;
      const key = String(p.id);
      const minute = Math.floor(simRnd(block.from, block.to + 1));
      const current = Number(session.yellowByPlayer[key] || 0);
      session.yellowByPlayer[key] = current + 1;
      if(current >= 1){
        cards.push({ clubId, playerId:p.id, type:'secondYellowRed', minute });
        locallySent.add(Number(p.id));
      }else cards.push({ clubId, playerId:p.id, type:'yellow', minute });
    }
    const directRedCandidates = eligibleLineup.filter(p => !locallySent.has(Number(p.id)) && p.position !== 'POR' && hiddenStats(p).aggression >= 78);
    const directChance = simClamp(((power.aggression - 62) / 900) * SIM_CARD_RATE_MULTIPLIER * SIM_DIRECT_RED_RATE_MULTIPLIER * cardMultiplier, 0.00005, 0.025);
    if(directRedCandidates.length && Math.random() < directChance){
      const p = weightedPickV2(directRedCandidates, cardWeightV2);
      cards.push({ clubId, playerId:p.id, type:'red', minute:Math.floor(simRnd(block.from, block.to + 1)) });
    }
    return cards.sort((a,b)=>a.minute-b.minute);
  }
  function liveInjuriesForBlock(session, clubId, power, context, block){
    const injuries = [];
    const candidates = (power.lineup || []).filter(player => !isUnavailable(player.id) && !liveIsUnavailableForPlay(session, player.id));
    candidates.forEach(player => {
      const injuryMultiplier = simClamp(Number(power?.styleEffects?.injuryMultiplier || 1), 0.35, 2.20);
      const cardMultiplier = typeof specialMatchInjuryMultiplier === 'function' ? specialMatchInjuryMultiplier(clubId) : 1;
      const contextMultiplier = typeof matchInjuryContextMultiplier === 'function' ? matchInjuryContextMultiplier(clubId, { live:true }) : 0.75;
      const fullMatchChance = simClamp(injuryChanceForPlayer(player.id, context.pitch) * injuryMultiplier * cardMultiplier * contextMultiplier, 0, 0.95);
      const chance = typeof liveInjuryChanceForBlock === 'function'
        ? liveInjuryChanceForBlock(fullMatchChance, block)
        : fullMatchChance * blockDurationFactor(block) / 6;
      if(Math.random() < chance){
        const injury = typeof pickInjuryTypeForPlayer === 'function' ? pickInjuryTypeForPlayer(player.id) : pickInjuryType();
        const matchesOut = Math.floor(simRnd(injury.minTurns, injury.maxTurns + 1));
        injuries.push({
          clubId,
          playerId:player.id,
          type:'injury',
          name:injury.name,
          injuryLabel:injury.name,
          probability:injury.probability,
          chance:Math.round(fullMatchChance * 100),
          matchesOut,
          minute:Math.floor(simRnd(block.from, block.to + 1)),
          phase:'durante',
          highLoad:Boolean(injury.highLoad),
          highLoadRatio:injury.highLoadRatio,
          highLoadPlayed:injury.highLoadPlayed,
          highLoadReference:injury.highLoadReference
        });
      }
    });
    return injuries.sort((a,b)=>a.minute-b.minute);
  }
  function liveFinalizeStats(stats, blockCount){
    const divisor = Math.max(1, Number(blockCount || 90));
    return {
      attacks:simClamp(Math.round(stats.attacks), 1, 75),
      chances:simClamp(Math.round(stats.chances), 0, 30),
      possession:simClamp(Math.round(stats.possessionWeighted / divisor), 8, 92),
      fouls:simClamp(Math.round(stats.fouls), 0, 40),
      passScore:simClamp(Math.round(stats.passScore / divisor), 1, 140),
      xg:Number(stats.xg.toFixed(2)),
      keySaves:Math.round(Number(stats.keySaves || 0)),
      errors:Math.round(Number(stats.errors || 0)),
      goalErrors:Math.round(Number(stats.goalErrors || 0)),
      ...continuousStatsExtrasV974(stats)
    };
  }
  function liveCurrentStats(stats, simulatedPhases){
    const phases = Math.max(0, Number(simulatedPhases || 0));
    const divisor = Math.max(1, phases);
    return {
      attacks:simClamp(Math.round(Number(stats.attacks || 0)), 0, 75),
      chances:simClamp(Math.round(Number(stats.chances || 0)), 0, 18),
      possession:phases > 0 ? simClamp(Math.round(Number(stats.possessionWeighted || 0) / divisor), 8, 92) : 50,
      fouls:simClamp(Math.round(Number(stats.fouls || 0)), 0, 32),
      passScore:phases > 0 ? simClamp(Math.round(Number(stats.passScore || 0) / divisor), 1, 140) : 0,
      xg:Number(Number(stats.xg || 0).toFixed(2)),
      keySaves:Math.round(Number(stats.keySaves || 0)),
      errors:Math.round(Number(stats.errors || 0)),
      goalErrors:Math.round(Number(stats.goalErrors || 0)),
      ...continuousStatsExtrasV974(stats)
    };
  }
  function livePowerPair(session){
    const conditionResolver = id => liveEffectiveCondition(session, id);
    const sentOffIds = liveUnavailableIds(session);
    const home = teamPowerV2(session.match.homeId, session.homeTactic, { crowdBonus:session.matchContext.homeCrowdBonus || 0, conditionResolver, sentOffIds });
    const away = teamPowerV2(session.match.awayId, session.awayTactic, { crowdBonus:0, conditionResolver, sentOffIds });
    return applyManagerTacticalAdaptationPairV2(home, away, session.match, session.matchContext);
  }
  /* V9.89 · Simulador Nuevo V1 · 360 fases (15 s por fase).
     La geometría nace de tacticAssignedEntries/tacticSlotCoordinates, conserva los slots personalizados
     y separa decisión, destino espacial, respuesta defensiva y resolución. */
  function continuousHash32V974(value){
    const text = String(value || 'match');
    let hash = 2166136261 >>> 0;
    for(let i=0;i<text.length;i++){
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash || 0x9e3779b9;
  }
  function continuousSeedForMatchV974(match){
    return continuousHash32V974(`${match?.id || 'match'}|${match?.date || game?.currentDate || ''}|${game?.seasonNumber || 1}|new-sim-v1`);
  }
  function continuousRandomV974(state){
    let x = Number(state?.rngState || 0) >>> 0;
    if(!x) x = 0x9e3779b9;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17; x >>>= 0;
    x ^= x << 5; x >>>= 0;
    state.rngState = x >>> 0;
    return (x >>> 0) / 4294967296;
  }
  function continuousRndV974(state, min=0, max=1){ return Number(min) + continuousRandomV974(state) * (Number(max) - Number(min)); }
  function continuousWithMathRandomV974(state, callback){
    const original = Math.random;
    Math.random = () => continuousRandomV974(state);
    try{ return callback(); }
    finally{ Math.random = original; }
  }
  function continuousWeightedPickV974(state, items, weightFn){
    const weighted = (items || []).filter(Boolean).map(item => ({ item, weight:Math.max(0.001, Number(weightFn(item) || 0.001)) }));
    if(!weighted.length) return null;
    const total = weighted.reduce((sum, entry) => sum + entry.weight, 0);
    let cursor = continuousRandomV974(state) * total;
    for(const entry of weighted){ cursor -= entry.weight; if(cursor <= 0) return entry.item; }
    return weighted[weighted.length - 1].item;
  }
  function continuousDistanceV974(a,b){
    if(!a || !b) return 999;
    return Math.hypot(Number(a.x || 0) - Number(b.x || 0), Number(a.y || 0) - Number(b.y || 0));
  }
  function continuousSegmentDistanceV974(point, start, end){
    if(!point || !start || !end) return 999;
    const x = Number(point.x || 0), y = Number(point.y || 0);
    const x1 = Number(start.x || 0), y1 = Number(start.y || 0), x2 = Number(end.x || 0), y2 = Number(end.y || 0);
    const dx = x2 - x1, dy = y2 - y1;
    const lengthSq = dx*dx + dy*dy;
    if(lengthSq <= 0.0001) return Math.hypot(x-x1,y-y1);
    const t = simClamp(((x-x1)*dx + (y-y1)*dy) / lengthSq, 0, 1);
    return Math.hypot(x-(x1+t*dx), y-(y1+t*dy));
  }
  function continuousEntryCoordsV974(entry, fallbackIndex=0, tactic=null){
    if(Number.isFinite(Number(entry?.x)) && Number.isFinite(Number(entry?.y))) return { x:Number(entry.x), y:Number(entry.y) };
    const coords = typeof tacticSlotCoordinates === 'function' ? tacticSlotCoordinates(tactic || {}) : [];
    const point = coords[Number(entry?.index ?? fallbackIndex)] || {};
    return { x:Number(point.x ?? 50), y:Number(point.y ?? 50) };
  }
  const CONTINUOUS_ENTRIES_CACHE_V974 = new WeakMap();
  function continuousEntriesV974(power){
    if(power && typeof power === 'object' && CONTINUOUS_ENTRIES_CACHE_V974.has(power)) return CONTINUOUS_ENTRIES_CACHE_V974.get(power);
    const entries = (power?.assigned || []).map((entry,index) => {
      if(!entry?.player) return null;
      const coords = continuousEntryCoordsV974(entry,index,power?.tactic);
      return {
        player:entry.player,
        playerId:Number(entry.player.id || 0),
        clubId:Number(power.clubId || 0),
        slot:String(entry.slot || entry.player.position || 'MC'),
        slotIndex:Number.isInteger(Number(entry.index)) ? Number(entry.index) : index,
        factor:simClamp(Number(entry.factor || 1), 0.35, 1.20),
        x:simClamp(coords.x,0,100),
        y:simClamp(coords.y,0,100)
      };
    }).filter(Boolean);
    if(power && typeof power === 'object') CONTINUOUS_ENTRIES_CACHE_V974.set(power,entries);
    return entries;
  }
  function continuousOpponentPerspectiveV974(entry){
    return { ...entry, x:100-Number(entry.x || 0), y:100-Number(entry.y || 0), originalX:Number(entry.x || 0), originalY:Number(entry.y || 0) };
  }
  // V9.89 · Simulador Nuevo V1: estado espacial persistente de los jugadores.
  function continuousPositionKeyV1(clubId,playerId){ return `${Number(clubId || 0)}:${Number(playerId || 0)}`; }
  function continuousRoleGroupV1(entry){
    const role = String(entry?.slot || entry?.player?.position || '').toUpperCase();
    if(role === 'POR') return 'gk';
    if(['DFC','LI','LD'].includes(role)) return 'def';
    if(['MCD','MC'].includes(role)) return 'mid';
    if(['MCO','MI','MD'].includes(role)) return 'am';
    if(['DC','EI','ED'].includes(role)) return 'att';
    return 'mid';
  }
  function continuousThreatValueV1(point){
    const x = simClamp(Number(point?.x ?? 50),0,100);
    const y = simClamp(Number(point?.y ?? 50),0,100);
    const progress = simClamp((x-18)/82,0,1);
    const centrality = simClamp(1-Math.abs(y-50)/50,0,1);
    const finalThird = x >= 67 ? (x-67)/33 : 0;
    const box = x >= 82 && Math.abs(y-50) <= 24 ? 0.15 : 0;
    return simClamp(0.015 + Math.pow(progress,1.45)*0.58 + centrality*progress*0.16 + finalThird*0.08 + box,0.01,0.97);
  }
  function continuousZoneV1(point){
    const cfg = CONTINUOUS_MATCH_CONFIG_V974.newV1 || {};
    const columns = Math.max(1,Number(cfg.zoneColumns || 6));
    const rows = Math.max(1,Number(cfg.zoneRows || 4));
    const x = simClamp(Number(point?.x ?? 50),0,99.999);
    const y = simClamp(Number(point?.y ?? 50),0,99.999);
    const col = Math.min(columns-1,Math.floor(x/(100/columns)));
    const row = Math.min(rows-1,Math.floor(y/(100/rows)));
    return { col,row,id:`${col}-${row}`,threat:continuousThreatValueV1({x,y}) };
  }
  function continuousBallPointForClubV1(state,clubId){
    const ball = state?.ballPosition || {x:50,y:50};
    if(Number(clubId || 0) === Number(state?.possessionTeamId || 0)) return {x:Number(ball.x),y:Number(ball.y)};
    return {x:100-Number(ball.x),y:100-Number(ball.y)};
  }
  function continuousSyncPlayerPositionsV1(state,home,away){
    if(!state) return;
    state.playerPositions = state.playerPositions || {};
    const active = new Set();
    [home,away].filter(Boolean).forEach(power => {
      continuousEntriesV974(power).forEach(entry => {
        const key = continuousPositionKeyV1(power.clubId,entry.playerId);
        active.add(key);
        const old = state.playerPositions[key];
        if(!old){
          state.playerPositions[key] = { clubId:Number(power.clubId),playerId:Number(entry.playerId),slot:String(entry.slot),slotIndex:Number(entry.slotIndex),baseX:Number(entry.x),baseY:Number(entry.y),x:Number(entry.x),y:Number(entry.y) };
        }else{
          old.slot = String(entry.slot); old.slotIndex = Number(entry.slotIndex); old.baseX = Number(entry.x); old.baseY = Number(entry.y);
        }
      });
    });
    Object.keys(state.playerPositions).forEach(key => { if(!active.has(key)) delete state.playerPositions[key]; });
  }
  function continuousDynamicEntriesV1(state,power){
    const nominal = continuousEntriesV974(power);
    if(!CONTINUOUS_MATCH_CONFIG_V974.newV1?.enabled || !state?.playerPositions) return nominal;
    return nominal.map(entry => {
      const pos = state.playerPositions[continuousPositionKeyV1(power.clubId,entry.playerId)];
      return pos ? { ...entry,x:Number(pos.x),y:Number(pos.y),baseX:Number(pos.baseX),baseY:Number(pos.baseY) } : entry;
    });
  }
  function continuousDynamicEntryByPlayerV1(state,power,playerId){ return continuousDynamicEntriesV1(state,power).find(entry => Number(entry.playerId) === Number(playerId)) || null; }
  function continuousDynamicGoalkeeperV1(state,power){
    const entries = continuousDynamicEntriesV1(state,power);
    return entries.find(entry => entry.slot === 'POR' || entry.player?.position === 'POR') || entries.slice().sort((a,b)=>a.x-b.x)[0] || null;
  }
  function continuousProgressiveSupportAdvanceV990(state){
    const cfg = CONTINUOUS_MATCH_CONFIG_V974.newV1 || {};
    return simClamp(Number(state?.possessionAdvanceV990 || 0),0,Number(cfg.progressiveBlockMax || 15));
  }
  function continuousUpdatePossessionAdvanceV990(state,result){
    if(!state || !result || !CONTINUOUS_MATCH_CONFIG_V974.newV1?.enabled) return;
    const cfg = CONTINUOUS_MATCH_CONFIG_V974.newV1;
    if(result.possessionChanged && !result.foul){
      state.possessionAdvanceV990 = 0;
      return;
    }
    if(!result.success) return;
    const fromX = Number(result.fromPosition?.x ?? 50);
    const toX = Number(result.toPosition?.x ?? fromX);
    const progress = toX-fromX;
    let delta = 0;
    if(['pass_short','pass_long','pass_through','cross'].includes(String(result.type || ''))){
      delta = Number(cfg.progressivePassBase || 0.70) + Math.max(0,progress)*Number(cfg.progressivePassFactor || 0.13) - Math.max(0,-progress)*0.11;
      if(result.type === 'pass_through') delta += 1.15;
      else if(result.type === 'pass_long' && progress > 8) delta += 0.55;
      else if(result.type === 'cross') delta += 0.40;
    }else if(result.type === 'dribble'){
      delta = 0.95 + Math.max(0,progress)*0.09;
    }
    state.possessionAdvanceV990 = simClamp(Number(state.possessionAdvanceV990 || 0)+delta,0,Number(cfg.progressiveBlockMax || 15));
  }
  function continuousApplyReceptionRunV990(state,result){
    if(!state || !result?.success || !['pass_short','pass_long','pass_through'].includes(String(result.type || ''))) return;
    if(!state.ballPosition || Number(state.possessionTeamId || 0) !== Number(result.attackingClubId || 0)) return;
    const cfg = CONTINUOUS_MATCH_CONFIG_V974.newV1 || {};
    const fromX = Number(result.fromPosition?.x ?? state.ballPosition.x ?? 50);
    const toX = Number(result.toPosition?.x ?? state.ballPosition.x ?? fromX);
    const progress = toX-fromX;
    if(progress <= 1.5) return;
    let extra = 0.55 + progress*0.055;
    if(result.type === 'pass_through') extra += 1.35;
    else if(result.type === 'pass_long') extra += 0.45;
    extra = simClamp(extra,0,Number(cfg.receptionRunMax || 3.6));
    const nextX = simClamp(Number(state.ballPosition.x || toX)+extra,2,96.5);
    const key = continuousPositionKeyV1(state.possessionTeamId,state.ballCarrierId);
    const carrierPos = state.playerPositions?.[key];
    state.ballPosition.x = nextX;
    if(carrierPos) carrierPos.x = nextX;
    result.receptionAdvance = Number(extra.toFixed(2));
    result.toPosition = { x:Number(state.ballPosition.x),y:Number(state.ballPosition.y) };
    const updatedZone = continuousZoneV1(result.toPosition);
    const updatedThreat = continuousThreatValueV1(result.toPosition);
    result.toZone = updatedZone.id;
    result.xTAfter = Number(updatedThreat.toFixed(4));
    result.xTGain = Number((updatedThreat-Number(result.xTBefore || 0)).toFixed(4));
  }
  function continuousMoveTeamShapeV1(state,power,hasBall,movementMultiplier=1){
    if(!state || !power || !CONTINUOUS_MATCH_CONFIG_V974.newV1?.enabled) return;
    const cfg = CONTINUOUS_MATCH_CONFIG_V974.newV1;
    const ball = continuousBallPointForClubV1(state,power.clubId);
    const build = normalizeBuildUpStyleV974(power?.tactic?.buildUpStyle);
    const counterActive = hasBall && Number(state.counterPhasesLeft || 0) > 0 && String(state.transitionType || '').includes('recovery');
    const styleAdvance = hasBall ? ({possession:0.76,direct:1.03,counter:counterActive?1.30:0.94,long_ball:0.88})[build] || 1 : 1;
    const sequenceAdvance = continuousProgressiveSupportAdvanceV990(state);
    const entries = continuousEntriesV974(power);
    const current = entries.map(entry => {
      const key = continuousPositionKeyV1(power.clubId,entry.playerId);
      const pos = state.playerPositions[key] || {x:entry.x,y:entry.y,baseX:entry.x,baseY:entry.y};
      return {entry,key,pos};
    });
    const pressCandidates = !hasBall ? current.filter(item => continuousRoleGroupV1(item.entry) !== 'gk').slice().sort((a,b)=>continuousDistanceV974(a.pos,ball)-continuousDistanceV974(b.pos,ball)).slice(0,Number(cfg.pressers || 2)).map(item=>item.key) : [];
    current.forEach(({entry,key,pos}) => {
      const group = continuousRoleGroupV1(entry);
      const role = String(entry.slot || entry.player?.position || '').toUpperCase();
      const base = {x:Number(entry.x),y:Number(entry.y)};
      let targetX = base.x, targetY = base.y;
      if(hasBall){
        const progressShift = (Number(ball.x)-50)*0.14;
        const roleWeight = ({gk:0.10,def:0.52,mid:0.82,am:1.00,att:1.03})[group] || 0.80;
        const sequenceWeight = ({gk:0.05,def:0.46,mid:0.88,am:1.05,att:0.96})[group] || 0.82;
        targetX += (Number(cfg.attackShift || 8)*styleAdvance + progressShift)*roleWeight + sequenceAdvance*sequenceWeight;

        // La línea acompaña el balón: defensas pisan más arriba, medios ofrecen apoyo y atacantes atacan el siguiente espacio.
        const followBehind = ({gk:78,def:42,mid:25,am:15,att:7})[group] ?? 25;
        if(group !== 'gk') targetX = Math.max(targetX,Number(ball.x)-followBehind);
        const maxAhead = ({def:9,mid:18,am:25,att:33})[group];
        if(Number.isFinite(maxAhead)) targetX = Math.min(targetX,Number(ball.x)+maxAhead);

        let lateralWeight = ({gk:0.05,def:0.18,mid:0.30,am:0.36,att:0.28})[group] || 0.28;
        if(['LI','LD','MI','MD','EI','ED'].includes(role)) lateralWeight *= 0.55;
        targetY += (Number(ball.y)-base.y)*lateralWeight;
        const wave = Math.sin(Number(state.phase || 0)*0.58 + Number(entry.playerId || 0)*0.73);
        if(group === 'att'){
          targetY += wave*(role === 'DC' ? 5.8 : 3.8);
          targetX += Math.max(0,wave)*(counterActive?4.6:2.8);
        }else if(group === 'am'){
          targetY += wave*2.0;
          targetX += Math.max(0,wave)*1.2;
        }else if(group === 'mid' && Number(ball.x) > 56){
          targetX += Math.max(0,wave)*0.75;
        }
        if(['LI','LD'].includes(role) && Number(ball.x) > 58){
          targetX += Math.min(4.5,(Number(ball.x)-58)*0.10);
        }
      }else{
        const retreatNeed = Number(cfg.defenseShift || 5) + (50-Number(ball.x))*0.17;
        const roleWeight = ({gk:0.10,def:0.64,mid:0.84,am:0.73,att:0.46})[group] || 0.70;
        const sequenceRetreatWeight = ({gk:0.03,def:0.62,mid:0.76,am:0.60,att:0.36})[group] || 0.60;
        targetX -= retreatNeed*roleWeight + sequenceAdvance*sequenceRetreatWeight;
        const compact = Number(cfg.defenseCompactY || 0.34)*(({gk:0.10,def:0.72,mid:0.90,am:0.78,att:0.60})[group] || 0.75);
        targetY += (Number(ball.y)-base.y)*compact;
        if(pressCandidates.includes(key)){
          const pressurePull = group === 'att' ? 0.34 : 0.42;
          targetX += (Number(ball.x)-targetX)*pressurePull;
          targetY += (Number(ball.y)-targetY)*pressurePull;
        }
      }
      if(Number(state.possessionTeamId) === Number(power.clubId) && Number(state.ballCarrierId) === Number(entry.playerId)){
        targetX = Number(state.ballPosition?.x ?? targetX); targetY = Number(state.ballPosition?.y ?? targetY);
      }
      targetX = simClamp(targetX,group === 'gk'?2:3,group === 'gk'?18:97);
      targetY = simClamp(targetY,4,96);
      const baseLerp = Number(cfg.movementLerp || 0.38);
      const lerp = simClamp(baseLerp*Number(movementMultiplier || 1),0.04,0.88);
      pos.x = Number(pos.x) + (targetX-Number(pos.x))*lerp;
      pos.y = Number(pos.y) + (targetY-Number(pos.y))*lerp;
      pos.baseX = base.x; pos.baseY = base.y; pos.slot = entry.slot; pos.slotIndex = entry.slotIndex;
      state.playerPositions[key] = pos;
    });
  }
  function continuousUpdatePlayerPositionsV1(state,home,away,movementMultiplier=1){
    if(!CONTINUOUS_MATCH_CONFIG_V974.newV1?.enabled) return;
    continuousSyncPlayerPositionsV1(state,home,away);
    continuousMoveTeamShapeV1(state,home,Number(state.possessionTeamId)===Number(home?.clubId),movementMultiplier);
    continuousMoveTeamShapeV1(state,away,Number(state.possessionTeamId)===Number(away?.clubId),movementMultiplier);
  }
  function continuousPositionSnapshotV1(state){
    return Object.values(state?.playerPositions || {}).map(pos => {
      let x = Number(pos.x), y = Number(pos.y);
      if(Number(pos.clubId) === Number(state?.awayId)){ x = 100-x; y = 100-y; }
      return { clubId:Number(pos.clubId),playerId:Number(pos.playerId),slot:String(pos.slot || ''),slotIndex:Number(pos.slotIndex || 0),x:simClamp(x,0,100),y:simClamp(y,0,100) };
    });
  }
  function continuousEntryByPlayerV974(power, playerId){ return continuousEntriesV974(power).find(entry => Number(entry.playerId) === Number(playerId)) || null; }
  function continuousGoalkeeperEntryV974(power){ return continuousEntriesV974(power).find(entry => entry.slot === 'POR' || entry.player?.position === 'POR') || continuousEntriesV974(power).slice().sort((a,b)=>a.x-b.x)[0] || null; }
  function continuousKickoffCarrierV974(power){
    const outfield = continuousEntriesV974(power).filter(entry => entry.slot !== 'POR' && entry.player?.position !== 'POR');
    const candidates = outfield.length ? outfield : continuousEntriesV974(power);
    return candidates.slice().sort((a,b) => (Math.abs(a.x-50)*1.4 + Math.abs(a.y-50)) - (Math.abs(b.x-50)*1.4 + Math.abs(b.y-50)))[0] || null;
  }
  function continuousTeamPowerV974(state, home, away, clubId){ return Number(clubId) === Number(state.homeId) ? home : away; }
  function continuousOtherPowerV974(state, home, away, clubId){ return Number(clubId) === Number(state.homeId) ? away : home; }
  function continuousSideV974(state, clubId){ return Number(clubId) === Number(state.homeId) ? 'home' : 'away'; }
  function continuousSetCarrierV974(state, clubId, entry, transition='possession', ballPosition=null){
    if(!entry) return false;
    const previousTeamId = Number(state.possessionTeamId || 0);
    const nextTeamId = Number(clubId || entry.clubId || 0);
    state.previousBallSlot = state.ballSlot;
    if(previousTeamId && previousTeamId !== nextTeamId){
      state.completedPassStreak = 0;
      state.possessionAdvanceV990 = 0;
      state.possessionStartPhase = Number(state.phase || 0);
    }
    state.possessionTeamId = nextTeamId;
    state.ballCarrierId = Number(entry.playerId || entry.player?.id || 0);
    state.ballSlot = Number(entry.slotIndex ?? 0);
    state.ballPosition = ballPosition ? { x:simClamp(Number(ballPosition.x),0,100), y:simClamp(Number(ballPosition.y),0,100) } : { x:Number(entry.x), y:Number(entry.y) };
    state.transitionType = transition;
    if(transition === 'recovery') state.counterPhasesLeft = CONTINUOUS_MATCH_CONFIG_V974.counterPhases;
    if(['kickoff','goalkeeper','goal_kick'].includes(transition)){
      state.counterPhasesLeft = 0;
      state.possessionAdvanceV990 = 0;
    }else if(transition === 'restart'){
      state.counterPhasesLeft = 0;
      state.possessionAdvanceV990 = Number(state.possessionAdvanceV990 || 0) * 0.65;
    }
    return true;
  }
  function continuousEnsureCarrierV974(state, home, away){
    let own = continuousTeamPowerV974(state, home, away, state.possessionTeamId);
    let carrier = continuousDynamicEntryByPlayerV1(state,own,state.ballCarrierId);
    if(carrier) return { power:own, carrier };
    const validTeam = [Number(state.homeId),Number(state.awayId)].includes(Number(state.possessionTeamId));
    if(!validTeam){ state.possessionTeamId = continuousRandomV974(state) < 0.5 ? Number(state.homeId) : Number(state.awayId); own = continuousTeamPowerV974(state,home,away,state.possessionTeamId); }
    const dynamic = continuousDynamicEntriesV1(state,own);
    const preferred = ['goalkeeper','goal_kick'].includes(String(state.transitionType || ''))
      ? continuousDynamicGoalkeeperV1(state,own)
      : dynamic.slice().sort((a,b)=>(Math.abs(a.x-50)*1.4+Math.abs(a.y-50))-(Math.abs(b.x-50)*1.4+Math.abs(b.y-50)))[0];
    carrier = preferred || dynamic[0] || null;
    if(carrier) continuousSetCarrierV974(state,state.possessionTeamId,carrier,state.transitionType || 'restart');
    return { power:own, carrier };
  }
  function continuousLocalAdvantagePctV974(state, clubId){
    if(Number(clubId) !== Number(state.homeId) || state.context?.neutral || state.context?.clubWorldCup) return 0;
    const homeFans = Math.max(0, Number(state.context?.homeFans || 0));
    const awayFans = Math.max(0, Number(state.context?.awayFans || 0));
    if(homeFans <= awayFans) return 0;
    const ratio = homeFans / Math.max(1, awayFans);
    const ratioProgress = simClamp((ratio - 1) / 4, 0, 1);
    const crowdProgress = simClamp(Number(state.context?.homeCrowdBonus || 0) / 50, 0, 1);
    return CONTINUOUS_MATCH_CONFIG_V974.homeAdvantageMaxPct * Math.max(ratioProgress,crowdProgress);
  }
  function continuousDensityAtV974(state, defendingPower, point, radius=18){
    if(!point) return 0;
    return continuousDynamicEntriesV1(state,defendingPower).map(continuousOpponentPerspectiveV974).reduce((sum, defender) => {
      const dist = continuousDistanceV974(defender,point);
      return sum + (dist < radius ? (1 - dist/radius) : 0);
    },0);
  }
  function continuousOriginForCarrierV974(state, carrier){
    if(Number(state.ballCarrierId) === Number(carrier?.playerId) && state.ballPosition) return { x:Number(state.ballPosition.x), y:Number(state.ballPosition.y) };
    return { x:Number(carrier?.x || 50), y:Number(carrier?.y || 50) };
  }
  function continuousReceiverCandidatesV974(state, attackingPower, defendingPower, carrier, actionType){
    const origin = continuousOriginForCarrierV974(state,carrier);
    return continuousDynamicEntriesV1(state,attackingPower).filter(entry => Number(entry.playerId) !== Number(carrier.playerId)).filter(entry => {
      const dist = continuousDistanceV974(origin,entry);
      const progress = entry.x - origin.x;
      if(actionType === 'pass_short') return dist <= CONTINUOUS_MATCH_CONFIG_V974.shortPassMax;
      if(actionType === 'pass_long') return dist >= CONTINUOUS_MATCH_CONFIG_V974.longPassMin && dist <= CONTINUOUS_MATCH_CONFIG_V974.longPassMax;
      if(actionType === 'pass_through') return progress >= CONTINUOUS_MATCH_CONFIG_V974.throughProgressMin && dist <= CONTINUOUS_MATCH_CONFIG_V974.longPassMax;
      if(actionType === 'cross') return entry.x >= Math.max(62,origin.x-4) && Math.abs(entry.y-50) <= 30;
      return true;
    });
  }
  function continuousAvailableActionsV974(state, attackingPower, defendingPower, carrier){
    const origin = continuousOriginForCarrierV974(state,carrier);
    const isKeeper = carrier.slot === 'POR' || carrier.player?.position === 'POR';
    const shortCandidates = continuousReceiverCandidatesV974(state,attackingPower,defendingPower,carrier,'pass_short');
    const longCandidates = continuousReceiverCandidatesV974(state,attackingPower,defendingPower,carrier,'pass_long');
    const throughCandidates = continuousReceiverCandidatesV974(state,attackingPower,defendingPower,carrier,'pass_through');
    const crossCandidates = continuousReceiverCandidatesV974(state,attackingPower,defendingPower,carrier,'cross');
    const actions = [];
    const add = (type,candidates=[]) => { if(type === 'shot' || type === 'dribble' || candidates.length) actions.push({ type,candidates }); };
    if(isKeeper){
      const distribution = normalizeGoalkeeperDistributionV974(attackingPower?.tactic?.goalkeeperDistribution);
      if(distribution === 'short'){
        if(shortCandidates.length) add('pass_short',shortCandidates); else add('pass_long',longCandidates);
      }else if(distribution === 'long'){
        if(longCandidates.length) add('pass_long',longCandidates); else add('pass_short',shortCandidates);
      }else{
        add('pass_short',shortCandidates); add('pass_long',longCandidates);
      }
      return actions.length ? actions : [{ type:'pass_long', candidates:continuousDynamicEntriesV1(state,attackingPower).filter(entry=>Number(entry.playerId)!==Number(carrier.playerId)) }];
    }
    add('pass_short',shortCandidates);
    add('pass_long',longCandidates);
    add('pass_through',throughCandidates);
    if((origin.y <= 30 || origin.y >= 70) && origin.x >= 54) add('cross',crossCandidates);
    if(origin.x >= 50) add('shot');
    if(origin.x < 95) add('dribble');
    return actions.length ? actions : [{ type:'dribble', candidates:[] }];
  }
  function continuousScoreInstructionV974(state, attackingPower){
    const side = continuousSideV974(state,attackingPower.clubId);
    const own = Number(state.score?.[side] || 0);
    const rival = Number(state.score?.[side === 'home' ? 'away' : 'home'] || 0);
    return instructionForScore(attackingPower.tactic,own,rival);
  }
  function continuousPossessionControlProfileV981(state, attackingPower, defendingPower, runtime={}){
    const cfg = CONTINUOUS_MATCH_CONFIG_V974.possessionControl || {};
    if(!cfg.enabled) return { active:false,targetPasses:0,passQuality:0,qualityEdge:0,midfielders:0,securityBonus:0 };
    const entries = continuousDynamicEntriesV1(state,attackingPower).filter(entry => entry.slot !== 'POR' && entry.player?.position !== 'POR');
    const rivalEntries = continuousDynamicEntriesV1(state,defendingPower).filter(entry => entry.slot !== 'POR' && entry.player?.position !== 'POR');
    if(!entries.length) return { active:false,targetPasses:0,passQuality:0,qualityEdge:0,midfielders:0,securityBonus:0 };
    let weightedPass = 0, weightTotal = 0, midfielders = 0;
    entries.forEach(entry => {
      const inMiddleBand = Number(entry.x) >= 32 && Number(entry.x) <= 68;
      const nominalMid = /^(MC|MCD|MCO|MI|MD)$/i.test(String(entry.slot || entry.player?.position || ''));
      const weight = (inMiddleBand || nominalMid) ? 1.35 : 0.82;
      if(inMiddleBand || nominalMid) midfielders += 1;
      weightedPass += continuousSkillAverageV974(entry.player,['paseCorto','vision','serenidad']) * Number(entry.factor || 1) * weight;
      weightTotal += weight;
    });
    const passQuality = weightTotal > 0 ? weightedPass/weightTotal : 55;
    const rivalDefQuality = rivalEntries.length
      ? rivalEntries.reduce((sum,entry)=>sum + continuousDefensiveAbilityV974('pass_short',entry.player)*Number(entry.factor || 1),0)/rivalEntries.length
      : 55;
    const qualityEdge = passQuality-rivalDefQuality;
    const build = normalizeBuildUpStyleV974(attackingPower?.tactic?.buildUpStyle);
    const scoreInstruction = continuousScoreInstructionV974(state,attackingPower);
    const liveInstruction = String(runtime.liveInstructionByClub?.[String(attackingPower.clubId)] || 'none');
    const active = build === 'possession' || liveInstruction === 'hold_result' || liveInstruction === 'lower_tempo' || scoreInstruction === 'lower';
    if(!active) return { active:false,targetPasses:0,passQuality,qualityEdge,midfielders,securityBonus:0,build,liveInstruction,scoreInstruction };
    const qualityAbove = Math.max(0,passQuality-Number(cfg.minimumQuality || 68));
    const extraMids = Math.max(0,midfielders-3);
    let targetPasses = Number(cfg.baseTarget || 2)
      + qualityAbove*Number(cfg.qualityCoefficient || 0.30)
      + Math.max(0,qualityEdge)*Number(cfg.qualityEdgeCoefficient || 0.12)
      + extraMids*Number(cfg.extraMidfielderCoefficient || 1.0);
    if(liveInstruction === 'hold_result') targetPasses += Number(cfg.holdResultBonus || 6);
    if(liveInstruction === 'lower_tempo') targetPasses += Number(cfg.scoreLowerBonus || 2) + 2;
    if(scoreInstruction === 'lower') targetPasses += Number(cfg.scoreLowerBonus || 2);
    if(build !== 'possession') targetPasses *= 0.72;
    targetPasses = simClamp(targetPasses,0,Number(cfg.maxTarget || 26));
    const securityBonus = simClamp(
      qualityAbove*0.52 + Math.max(0,qualityEdge)*0.18 + extraMids*1.15 + (liveInstruction === 'hold_result' ? 2.2 : 0),
      0,Number(cfg.maxPassSecurityBonus || 18)
    );
    return { active,targetPasses,passQuality,qualityEdge,midfielders,securityBonus,build,liveInstruction,scoreInstruction };
  }
  function continuousPossessionStreakWeightV981(state, profile, type, origin){
    if(!profile?.active || Number(profile.targetPasses || 0) <= 0) return 1;
    const streak = Math.max(0,Number(state.completedPassStreak || 0));
    const depthRelief = simClamp(1 - Math.max(0,Number(origin?.x || 0)-75)/62,0.64,1);
    const target = Math.max(1,Number(profile.targetPasses || 1)*depthRelief);
    const ratio = simClamp(streak/target,0,1.70);
    if(type === 'pass_short') return ratio < 1 ? 1.22 + (1-ratio)*0.92 : simClamp(1.00-(ratio-1)*0.88,0.55,1.00);
    if(type === 'pass_long') return ratio < 1 ? 0.78 + ratio*0.24 : 1.02;
    if(type === 'pass_through') return ratio < 1 ? 0.42 + ratio*0.50 : simClamp(1.18+(ratio-1)*2.10,1.18,2.45);
    if(type === 'cross') return ratio < 1 ? 0.38 + ratio*0.48 : simClamp(1.08+(ratio-1)*1.80,1.08,2.20);
    if(type === 'dribble') return ratio < 1 ? 0.70 + ratio*0.22 : simClamp(1.05+(ratio-1)*0.90,1.05,1.55);
    if(type === 'shot'){
      if(ratio < 1) return 0.055 + Math.pow(ratio,2.35)*0.63;
      return simClamp(5.50 + (ratio-1)*15.00,5.50,13.00);
    }
    return 1;
  }
  function continuousActionWeightV974(state, attackingPower, action, carrier, runtime={}){
    const type = action.type;
    const origin = continuousOriginForCarrierV974(state,carrier);
    let weight = Number(CONTINUOUS_MATCH_CONFIG_V974.actionBase[type] || 1);
    const build = normalizeBuildUpStyleV974(attackingPower?.tactic?.buildUpStyle);
    const counterActive = Number(state.counterPhasesLeft || 0) > 0 && String(state.transitionType || '').includes('recovery');
    const styleMultipliers = {
      possession:{ pass_short:2.05, pass_long:0.48, pass_through:0.66, cross:0.72, shot:0.78, dribble:0.82 },
      direct:{ pass_short:0.82, pass_long:1.35, pass_through:1.72, cross:1.12, shot:1.18, dribble:1.05 },
      counter:{ pass_short:counterActive?0.55:0.92, pass_long:counterActive?1.55:1.08, pass_through:counterActive?2.30:1.18, cross:counterActive?1.20:0.92, shot:counterActive?1.38:0.96, dribble:counterActive?1.55:1.00 },
      long_ball:{ pass_short:0.42, pass_long:2.55, pass_through:1.46, cross:1.18, shot:1.02, dribble:0.72 }
    };
    weight *= Number(styleMultipliers[build]?.[type] || 1);
    const scoreInstruction = continuousScoreInstructionV974(state,attackingPower);
    if(scoreInstruction === 'lower') weight *= ({ pass_short:1.35, pass_long:0.75, pass_through:0.72, cross:0.82, shot:0.78, dribble:0.82 })[type] || 1;
    if(scoreInstruction === 'push') weight *= ({ pass_short:0.85, pass_long:1.22, pass_through:1.40, cross:1.24, shot:1.55, dribble:1.22 })[type] || 1;
    const liveInstruction = String(runtime.liveInstructionByClub?.[String(attackingPower.clubId)] || 'none');
    if(['attack','goal_anyway'].includes(liveInstruction)) weight *= ({ pass_short:0.78, pass_long:1.18, pass_through:1.48, cross:1.28, shot:liveInstruction==='goal_anyway'?1.85:1.50, dribble:1.22 })[type] || 1;
    if(['all_defense','hold_result','lower_tempo'].includes(liveInstruction)) weight *= ({ pass_short:1.40, pass_long:0.68, pass_through:0.62, cross:0.62, shot:0.55, dribble:0.78 })[type] || 1;
    const mentality = simPlayerMentality(carrier.player,attackingPower.tactic);
    const mentalityMul = ({ muy_defensivo:{shot:.45,pass_through:.62,pass_short:1.28,dribble:.65}, defensivo:{shot:.72,pass_through:.82,pass_short:1.15}, normal:{}, ofensivo:{shot:1.25,pass_through:1.18,dribble:1.12}, muy_ofensivo:{shot:1.55,pass_through:1.35,dribble:1.22,pass_short:.88} })[mentality] || {};
    weight *= Number(mentalityMul[type] || 1);
    if(type === 'shot') weight *= simClamp((origin.x - 43) / 24, 0.18, 2.3) * simClamp(1.25 - Math.abs(origin.y-50)/65,0.55,1.25);
    if(type === 'cross') weight *= simClamp((origin.x-45)/30,0.35,1.6);
    if(type === 'pass_through') weight *= simClamp((100-origin.x)/65,0.55,1.45);
    if(type === 'pass_short' && action.candidates.length >= 3) weight *= 1.12;
    if(type === 'pass_long' && !action.candidates.length) weight *= 0.05;
    // Nuevo V1: la decisión considera cuánto peligro espacial puede crear la acción.
    const threatBefore = continuousThreatValueV1(origin);
    let threatAfter = threatBefore;
    if(['pass_short','pass_long','pass_through','cross'].includes(type) && action.candidates?.length){
      threatAfter = Math.max(...action.candidates.map(candidate=>continuousThreatValueV1(candidate)));
    }else if(type === 'dribble'){
      threatAfter = continuousThreatValueV1({x:simClamp(origin.x+9,0,100),y:origin.y});
    }else if(type === 'shot'){
      threatAfter = simClamp(threatBefore+0.10,0,1);
    }
    const threatGain = threatAfter-threatBefore;
    const threatStyle = ({possession:0.72,direct:1.08,counter:counterActive?1.42:1.02,long_ball:1.05})[build] || 1;
    if(type !== 'shot') weight *= simClamp(1 + threatGain*2.8*threatStyle,0.58,2.65);
    else weight *= simClamp(0.72 + threatBefore*1.10,0.60,1.72);
    if(['pass_through','cross','shot'].includes(type) || (type === 'dribble' && origin.x >= 50)) weight *= CONTINUOUS_MATCH_CONFIG_V974.attackIntentMultiplier;
    if(runtime.__possessionProfileV981) weight *= continuousPossessionStreakWeightV981(state,runtime.__possessionProfileV981,type,origin);
    return Math.max(0.001,weight);
  }
  function continuousChooseActionV974(state, attackingPower, defendingPower, carrier, runtime={}){
    const available = continuousAvailableActionsV974(state,attackingPower,defendingPower,carrier);
    const possessionProfile = continuousPossessionControlProfileV981(state,attackingPower,defendingPower,runtime);
    const weightedRuntime = { ...runtime, __possessionProfileV981:possessionProfile };
    return continuousWeightedPickV974(state,available,action => continuousActionWeightV974(state,attackingPower,action,carrier,weightedRuntime));
  }
  function continuousReceiverScoreV974(state, attackingPower, defendingPower, carrier, candidate, actionType){
    const origin = continuousOriginForCarrierV974(state,carrier);
    const dist = continuousDistanceV974(origin,candidate);
    const progress = candidate.x-origin.x;
    const density = continuousDensityAtV974(state,defendingPower,candidate,CONTINUOUS_MATCH_CONFIG_V974.markingRadius);
    const freeSpace = simClamp(1-density/2.2,0,1);
    const condition = simClamp(Number(currentCondition(candidate.playerId) || 70),1,100)/100;
    const positionSkill = simAvg([matchSkill(candidate.player,'posicionamiento'),matchSkill(candidate.player,'serenidad')]);
    let score = 28 + freeSpace*34 + condition*10 + positionSkill*0.12;
    if(actionType === 'pass_short') score += Math.max(0,34-dist)*1.1 + progress*0.28 - Math.max(0,progress-24)*0.45;
    if(actionType === 'pass_long') score += dist*0.38 + Math.max(0,progress)*0.62 - Math.max(0,dist-70)*1.2;
    if(actionType === 'pass_through') score += Math.max(0,progress)*1.35 + freeSpace*22 - Math.abs(candidate.y-50)*0.10;
    if(actionType === 'cross') score += candidate.x*0.52 + (100-Math.abs(candidate.y-50)*1.5)*0.16 + matchSkill(candidate.player,'cabezazo')*0.24 + matchSkill(candidate.player,'remate')*0.16;
    const threatBefore = continuousThreatValueV1(origin);
    const threatAfter = continuousThreatValueV1(candidate);
    const threatGain = threatAfter-threatBefore;
    const build = normalizeBuildUpStyleV974(attackingPower?.tactic?.buildUpStyle);
    const counterActive = Number(state.counterPhasesLeft || 0)>0 && String(state.transitionType || '').includes('recovery');
    const styleThreat = ({possession:0.70,direct:1.10,counter:counterActive?1.45:1.05,long_ball:1.08})[build] || 1;
    score += threatGain*Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.threatTargetWeight || 42)*styleThreat;
    if(build === 'possession' && threatGain < 0) score += Math.max(-8,threatGain*12);
    return Math.max(1,score-density*18);
  }
  function continuousChooseTargetV974(state, attackingPower, defendingPower, carrier, action){
    if(!action?.candidates?.length) return null;
    return continuousWeightedPickV974(state,action.candidates,candidate => continuousReceiverScoreV974(state,attackingPower,defendingPower,carrier,candidate,action.type));
  }
  function continuousDefensiveContextV974(state, attackingPower, defendingPower, carrier, target, actionType){
    const origin = continuousOriginForCarrierV974(state,carrier);
    const targetPoint = target ? { x:Number(target.x), y:Number(target.y) } : { x:100, y:50 };
    const defenders = continuousDynamicEntriesV1(state,defendingPower).map(continuousOpponentPerspectiveV974);
    const directPressure = defenders.filter(entry => continuousDistanceV974(entry,origin) <= CONTINUOUS_MATCH_CONFIG_V974.pressureRadius);
    const receiverMarkers = defenders.filter(entry => continuousDistanceV974(entry,targetPoint) <= CONTINUOUS_MATCH_CONFIG_V974.markingRadius);
    const laneInterceptors = defenders.filter(entry => continuousSegmentDistanceV974(entry,origin,targetPoint) <= CONTINUOUS_MATCH_CONFIG_V974.interceptionRadius);
    const coverPlayers = defenders.filter(entry => continuousDistanceV974(entry,targetPoint) <= CONTINUOUS_MATCH_CONFIG_V974.markingRadius*1.55);
    const densityAtOrigin = directPressure.reduce((sum,entry)=>sum + Math.max(0,1-continuousDistanceV974(entry,origin)/CONTINUOUS_MATCH_CONFIG_V974.pressureRadius),0);
    const densityAtTarget = receiverMarkers.reduce((sum,entry)=>sum + Math.max(0,1-continuousDistanceV974(entry,targetPoint)/CONTINUOUS_MATCH_CONFIG_V974.markingRadius),0);
    let relevant = [];
    if(['pass_short','pass_long','pass_through','cross'].includes(actionType)) relevant = laneInterceptors.concat(receiverMarkers);
    else if(actionType === 'dribble') relevant = directPressure;
    else relevant = directPressure.concat(coverPlayers);
    const unique = [];
    const seen = new Set();
    relevant.forEach(entry=>{ if(!seen.has(entry.playerId)){ seen.add(entry.playerId); unique.push(entry); } });
    const defender = unique.slice().sort((a,b) => {
      const ad = actionType === 'dribble' ? continuousDistanceV974(a,origin) : continuousSegmentDistanceV974(a,origin,targetPoint);
      const bd = actionType === 'dribble' ? continuousDistanceV974(b,origin) : continuousSegmentDistanceV974(b,origin,targetPoint);
      return ad-bd;
    })[0] || defenders.slice().sort((a,b)=>continuousDistanceV974(a,targetPoint)-continuousDistanceV974(b,targetPoint))[0] || null;
    return { origin,targetPoint,directPressure,receiverMarkers,laneInterceptors,coverPlayers,densityAtOrigin,densityAtTarget,defender };
  }
  function continuousSkillAverageV974(player, keys, fallback=55){
    if(!player) return fallback;
    const values = (keys || []).map(key => Number(matchSkill(player,key))).filter(Number.isFinite);
    return values.length ? simAvg(values) : fallback;
  }
  function continuousExecutionAbilityV974(actionType, actor){
    if(actionType === 'pass_short') return continuousSkillAverageV974(actor,['paseCorto','vision','serenidad']);
    if(actionType === 'pass_long') return continuousSkillAverageV974(actor,['paseLargo','vision','serenidad']);
    if(actionType === 'pass_through') return continuousSkillAverageV974(actor,['vision','paseLargo','paseCorto','serenidad']);
    if(actionType === 'cross') return continuousSkillAverageV974(actor,['paseLargo','vision','serenidad']);
    if(actionType === 'dribble') return continuousSkillAverageV974(actor,['regate','velocidad','aceleracion','serenidad']);
    if(actionType === 'shot') return continuousSkillAverageV974(actor,['remate','serenidad','posicionamiento']);
    return Number(effectiveOverall(actor) || 55);
  }
  function continuousDefensiveAbilityV974(actionType, defender){
    if(!defender) return 42;
    if(actionType === 'dribble') return continuousSkillAverageV974(defender,['entradas','marca','aceleracion','posicionamiento']);
    return continuousSkillAverageV974(defender,['posicionamiento','marca','entradas','serenidad']);
  }
  function continuousPossessionEntryFromDefenderV974(state, defendingPower, perspectiveDefender){
    if(!perspectiveDefender) return continuousDynamicGoalkeeperV1(state,defendingPower);
    return continuousDynamicEntryByPlayerV1(state,defendingPower,perspectiveDefender.playerId) || continuousDynamicGoalkeeperV1(state,defendingPower);
  }
  function continuousFoulChanceV974(defendingPower, context, actionType){
    const aggression = simClamp(Number(defendingPower?.aggression || 55),1,99);
    const discipline = simClamp(Number(defendingPower?.discipline || 55),1,99);
    const pressure = Math.min(3,context?.directPressure?.length || 0);
    const actionExtra = actionType === 'dribble' ? 0.026 : ['pass_through','cross'].includes(actionType) ? 0.012 : 0;
    const baseChance = 0.010 + aggression/3200 + (100-discipline)/4200 + pressure*0.009 + actionExtra;
    const phaseDurationScale = CONTINUOUS_MATCH_CONFIG_V974.secondsPerPhase / 15;
    return simClamp(baseChance * phaseDurationScale * SIM_FOUL_RATE_MULTIPLIER,0,0.32);
  }
  function continuousSpatialQualityV974(state, power, point, mode='support'){
    const entries = continuousDynamicEntriesV1(state,power);
    if(!entries.length) return 55;
    let weighted = 0;
    let weightTotal = 0;
    entries.forEach(entry => {
      const distance = continuousDistanceV974(entry,point);
      const weight = Math.max(0.05,1-distance/92);
      const skill = mode === 'defense'
        ? continuousSkillAverageV974(entry.player,['posicionamiento','marca','entradas','serenidad'])
        : continuousSkillAverageV974(entry.player,['vision','paseCorto','paseLargo','serenidad']);
      weighted += skill * Number(entry.factor || 1) * weight;
      weightTotal += weight;
    });
    return weightTotal > 0 ? weighted/weightTotal : 55;
  }
  function continuousDuelResultV974(state, attackingPower, defendingPower, carrier, target, actionType, context, runtime={}){
    const origin = context.origin;
    const distance = target ? continuousDistanceV974(origin,target) : 0;
    const conditionResolver = typeof runtime.conditionResolver === 'function' ? runtime.conditionResolver : (id=>currentCondition(id));
    const actorCondition = simClamp(Number(conditionResolver(carrier.playerId) || 70),1,100);
    const actorConditionFactor = 0.72 + actorCondition/100*0.28;
    let execution = continuousExecutionAbilityV974(actionType,carrier.player) * Number(carrier.factor || 1) * actorConditionFactor;
    const ownSupport = continuousSpatialQualityV974(state,attackingPower,origin,'support');
    const rivalPoint = { x:100-Number(origin.x || 0), y:100-Number(origin.y || 0) };
    const rivalSupport = continuousSpatialQualityV974(state,defendingPower,rivalPoint,'defense');
    execution += (ownSupport-rivalSupport)*0.10;
    execution += ({ pass_short:18,pass_long:8,pass_through:4,cross:4,dribble:3 })[actionType] || 0;
    execution += Number(pitchEffectV2(state.context?.pitch).passDelta || 0) * 0.35;
    execution *= 1 + continuousLocalAdvantagePctV974(state,attackingPower.clubId);
    const possessionProfile = continuousPossessionControlProfileV981(state,attackingPower,defendingPower,runtime);
    if(possessionProfile.active){
      if(actionType === 'pass_short') execution += Number(possessionProfile.securityBonus || 0);
      else if(actionType === 'pass_long') execution += Number(possessionProfile.securityBonus || 0)*0.30;
      else if(actionType === 'pass_through') execution += Number(possessionProfile.securityBonus || 0)*0.12;
    }
    if(actionType === 'pass_short') execution -= Math.max(0,distance-18)*0.25;
    if(actionType === 'pass_long') execution -= Math.max(0,distance-34)*0.24;
    if(actionType === 'pass_through') execution -= Math.max(0,distance-30)*0.23;
    if(actionType === 'cross') execution -= Math.max(0,distance-36)*0.20;
    execution -= Number(context.densityAtOrigin || 0)*5.8 + Number(context.densityAtTarget || 0)*7.4;
    const defenderCondition = context.defender ? simClamp(Number(conditionResolver(context.defender.playerId) || 70),1,100) : 70;
    const defenderAbility = continuousDefensiveAbilityV974(actionType,context.defender?.player) * (0.72 + defenderCondition/100*0.28);
    const laneCount = Math.min(4,context.laneInterceptors?.length || 0);
    const coverCount = Math.min(4,context.coverPlayers?.length || 0);
    const coverage = laneCount*3.4 + coverCount*1.9;
    const attackPower = execution + continuousRndV974(state,-CONTINUOUS_MATCH_CONFIG_V974.duelRandomRange,CONTINUOUS_MATCH_CONFIG_V974.duelRandomRange);
    const defensePower = defenderAbility + coverage + continuousRndV974(state,-CONTINUOUS_MATCH_CONFIG_V974.duelRandomRange,CONTINUOUS_MATCH_CONFIG_V974.duelRandomRange);
    const typeBias = ({pass_short:15,pass_long:8,pass_through:3,cross:1,dribble:0})[actionType] || 0;
    const scale = actionType === 'dribble' ? Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.dribbleLogitScale || 8.5) : Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.passLogitScale || 9.5);
    const rawProbability = 1/(1+Math.exp(-((attackPower-defensePower+typeBias)/Math.max(1,scale))));
    const bounds = actionType === 'pass_short' ? [0.48,0.97] : actionType === 'pass_long' ? [0.28,0.92] : actionType === 'pass_through' ? [0.20,0.88] : actionType === 'cross' ? [0.18,0.84] : [0.24,0.84];
    const successProbability = simClamp(rawProbability,bounds[0],bounds[1]);
    return { success:continuousRandomV974(state)<successProbability, successProbability, attackPower, defensePower, executionAbility:execution, defenderAbility };
  }
  function continuousGoalEventV974(state, attackingPower, carrier, shotQuality){
    const previous = state.lastCompletedPass;
    const assistId = previous && Number(previous.clubId) === Number(attackingPower.clubId) && Number(previous.targetId) === Number(carrier.playerId) && (state.phase-Number(previous.phase || 0)) <= Math.max(1,Math.round(45/CONTINUOUS_MATCH_CONFIG_V974.secondsPerPhase)) && Number(previous.actorId) !== Number(carrier.playerId) ? Number(previous.actorId) : null;
    return { clubId:Number(attackingPower.clubId), playerId:Number(carrier.playerId), assistId, minute:Math.max(1,Math.ceil(state.phase/CONTINUOUS_MATCH_CONFIG_V974.phasesPerMinute)), phase:Number(state.phase), setPiece:false, errorGoal:false, errorById:null, chanceQuality:Number(shotQuality.toFixed(3)) };
  }
  function continuousShotResolutionV974(state, attackingPower, defendingPower, carrier, context, runtime={}){
    const origin = context.origin;
    const keeper = continuousDynamicGoalkeeperV1(state,defendingPower);
    const conditionResolver = typeof runtime.conditionResolver === 'function' ? runtime.conditionResolver : (id=>currentCondition(id));
    const shooterCondition = simClamp(Number(conditionResolver(carrier.playerId) || 70),1,100);
    const keeperCondition = keeper ? simClamp(Number(conditionResolver(keeper.playerId) || 70),1,100) : 70;
    const shooterSkill = continuousExecutionAbilityV974('shot',carrier.player) * (0.72 + shooterCondition/100*0.28);
    const keeperSkill = keeper ? continuousSkillAverageV974(keeper.player,['porteria','posicionamiento','serenidad']) * (0.72 + keeperCondition/100*0.28) : 42;
    const dx = Math.max(0,100-Number(origin.x || 0));
    const dy = Math.abs(Number(origin.y || 50)-50);
    const distanceToGoal = Math.hypot(dx,dy*0.72);
    const centrality = simClamp(1-dy/50,0,1);
    const insideBox = Number(origin.x || 0) >= 82 && dy <= 24;
    const defenseDensity = Number(context.densityAtOrigin || 0) + Math.min(3,context.coverPlayers?.length || 0)*0.24;
    const ownSupport = continuousSpatialQualityV974(state,attackingPower,origin,'support');
    const rivalSupport = continuousSpatialQualityV974(state,defendingPower,{x:100-Number(origin.x || 0),y:100-Number(origin.y || 0)},'defense');
    const teamEdge = (ownSupport-rivalSupport)/70;
    // Aproximación xG logística: distancia, ángulo/centralidad, área, presión, rematador y arquero.
    let logit = -2.85 + (insideBox?1.18:0) + (Number(origin.x || 0)-70)*0.043 + centrality*0.72 - distanceToGoal*0.022;
    logit += (shooterSkill-55)*0.018 - (keeperSkill-55)*0.012 + teamEdge*0.18 - defenseDensity*0.30;
    let xg = 1/(1+Math.exp(-logit));
    xg *= Number(attackingPower.styleEffects?.conversionMultiplier || 1) * Number(defendingPower.styleEffects?.rivalConversionMultiplier || 1) * Number(pitchEffectV2(state.context?.pitch).chanceMultiplier || 1);
    xg *= CONTINUOUS_MATCH_CONFIG_V974.volumeConversionMultiplier;
    xg *= 1 + continuousLocalAdvantagePctV974(state,attackingPower.clubId);
    xg = simClamp(xg,0.008,Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.xgMax || 0.58));
    const blockChance = simClamp(0.035 + Math.min(4,context.coverPlayers?.length || 0)*0.038 + Number(context.densityAtOrigin || 0)*0.045,0.025,0.46);
    const effectiveXg = simClamp(xg*(1-blockChance),0.006,Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.xgMax || 0.58));
    const penalty = simHighScoreGoalPenaltyForNextGoal(Number(state.score.home || 0)+Number(state.score.away || 0));
    const goalProbability = simClamp(effectiveXg*(1-penalty),0,Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.xgMax || 0.58));
    const blocked = continuousRandomV974(state) < blockChance;
    const onTargetProbability = simClamp(0.37 + (shooterSkill-55)/165 + centrality*0.12 - Math.max(0,distanceToGoal-22)/150 - Number(context.densityAtOrigin || 0)*0.025,0.18,0.84);
    const onTarget = !blocked && continuousRandomV974(state) < onTargetProbability;
    const conditionalGoal = simClamp(goalProbability/Math.max(0.05,(1-blockChance)*onTargetProbability),0,0.82);
    const goal = onTarget && continuousRandomV974(state) < conditionalGoal;
    let keySave = null;
    if(!goal && onTarget && keeper){ keySave = { clubId:Number(defendingPower.clubId), playerId:Number(keeper.playerId), minute:Math.max(1,Math.ceil(state.phase/CONTINUOUS_MATCH_CONFIG_V974.phasesPerMinute)), phase:Number(state.phase), chanceById:Number(carrier.playerId), chanceQuality:Number(goalProbability.toFixed(3)) }; }
    const goalEvent = goal ? continuousGoalEventV974(state,attackingPower,carrier,goalProbability) : null;
    return { xg:effectiveXg,rawXg:xg,goalProbability,onTarget,goal,blocked,blockChance,keySave,goalEvent,keeper,distanceToGoal,insideBox,centrality };
  }
  function continuousResolveActionV974(state, attackingPower, defendingPower, carrier, action, target, context, runtime={}){
    const type = action.type;
    let actionTargetPoint = target ? {x:Number(target.x),y:Number(target.y)} : {x:100,y:50};
    if(type === 'dribble') actionTargetPoint = {x:simClamp(Number(context.origin.x)+9,0,97),y:simClamp(Number(context.origin.y)+(50-Number(context.origin.y))*0.08,3,97)};
    const fromZone = continuousZoneV1(context.origin);
    const toZone = continuousZoneV1(actionTargetPoint);
    const xTBefore = continuousThreatValueV1(context.origin);
    const xTAfter = type === 'shot' ? xTBefore : continuousThreatValueV1(actionTargetPoint);
    const base = { type, action:type, actorId:Number(carrier.playerId), targetId:Number(target?.playerId || 0) || null, attackingClubId:Number(attackingPower.clubId), defendingClubId:Number(defendingPower.clubId), fromSlot:Number(carrier.slotIndex), toSlot:Number(target?.slotIndex ?? carrier.slotIndex), fromPosition:{ ...context.origin }, toPosition:actionTargetPoint, fromZone:fromZone.id, toZone:toZone.id, xTBefore:Number(xTBefore.toFixed(4)), xTAfter:Number(xTAfter.toFixed(4)), xTGain:Number((xTAfter-xTBefore).toFixed(4)), defenderId:Number(context.defender?.playerId || 0) || null, defenderPosition:context.defender?{x:Number(context.defender.x),y:Number(context.defender.y)}:null, keeperPosition:null, success:false, possessionChanged:false, foul:false, shot:null, reason:'failed' };
    if(type === 'shot'){
      const shot = continuousShotResolutionV974(state,attackingPower,defendingPower,carrier,context,runtime);
      const keeperPosition = shot?.keeper ? { x:100-Number(shot.keeper.x || 0), y:100-Number(shot.keeper.y || 0) } : null;
      return { ...base, keeperPosition, success:Boolean(shot.goal), shot, possessionChanged:!shot.goal, reason:shot.goal?'goal':shot.blocked?'shot_blocked':shot.onTarget?'shot_saved':'shot_off_target', executionAbility:continuousExecutionAbilityV974('shot',carrier.player), successProbability:Number(shot.goalProbability || 0) };
    }
    const duel = continuousDuelResultV974(state,attackingPower,defendingPower,carrier,target,type,context,runtime);
    const possessionProfile = continuousPossessionControlProfileV981(state,attackingPower,defendingPower,runtime);
    if(duel.success && ['pass_short','pass_long'].includes(type) && possessionProfile.active){
      const technicalErrorChance = simClamp(0.115 - Number(possessionProfile.passQuality || 55)*0.00105 - Math.max(0,Number(possessionProfile.qualityEdge || 0))*0.00035,0.012,0.085);
      if(continuousRandomV974(state) < technicalErrorChance){
        return { ...base, success:false, possessionChanged:true, reason:'technical_error', successProbability:duel.successProbability, executionAbility:duel.executionAbility, attackPower:duel.attackPower, defensePower:duel.defensePower };
      }
    }
    const foulChance = continuousFoulChanceV974(defendingPower,context,type);
    if(!duel.success && context.defender && continuousRandomV974(state) < foulChance){
      return { ...base, success:false, foul:true, possessionChanged:false, reason:'foul_won', successProbability:duel.successProbability, foulProbability:foulChance, executionAbility:duel.executionAbility, attackPower:duel.attackPower, defensePower:duel.defensePower };
    }
    // Se conserva V9.87: solo la mitad de fallos defensivos terminan efectivamente en robo/intercepción.
    if(!duel.success && context.defender && continuousRandomV974(state) >= SIM_STEAL_RATE_MULTIPLIER){
      return { ...base, success:true, possessionChanged:false, reason:'completed', successProbability:duel.successProbability, executionAbility:duel.executionAbility, attackPower:duel.attackPower, defensePower:duel.defensePower };
    }
    return { ...base, success:duel.success, possessionChanged:!duel.success, reason:duel.success?'completed':'intercepted', successProbability:duel.successProbability, executionAbility:duel.executionAbility, attackPower:duel.attackPower, defensePower:duel.defensePower };
  }
  function continuousApplyActionV974(state, attackingPower, defendingPower, carrier, target, context, result){
    state.lastAction = { phase:state.phase, type:result.type, actorId:result.actorId, targetId:result.targetId };
    state.lastResult = result;
    if(result.foul){
      state.transitionType = 'restart';
      state.counterPhasesLeft = 0;
      state.possessionAdvanceV990 = Number(state.possessionAdvanceV990 || 0) * 0.65;
      return;
    }
    if(result.type === 'shot'){
      if(result.shot?.goal){
        const side = continuousSideV974(state,attackingPower.clubId);
        state.score[side] = Number(state.score[side] || 0) + 1;
        const restartPower = defendingPower;
        const restartEntries = continuousDynamicEntriesV1(state,restartPower);
        const restartCarrier = restartEntries.filter(entry=>entry.slot!=='POR' && entry.player?.position!=='POR').sort((a,b)=>(Math.abs(a.x-50)*1.4+Math.abs(a.y-50))-(Math.abs(b.x-50)*1.4+Math.abs(b.y-50)))[0] || continuousDynamicGoalkeeperV1(state,restartPower);
        continuousSetCarrierV974(state,restartPower.clubId,restartCarrier,'kickoff',{x:50,y:50});
        state.lastCompletedPass = null;
        return;
      }
      const keeper = result.shot?.keeper || continuousDynamicGoalkeeperV1(state,defendingPower);
      if(result.shot?.blocked && context.defender){
        const defenderEntry = continuousPossessionEntryFromDefenderV974(state,defendingPower,context.defender);
        continuousSetCarrierV974(state,defendingPower.clubId,defenderEntry,'recovery');
      }else continuousSetCarrierV974(state,defendingPower.clubId,keeper,'goalkeeper');
      state.lastCompletedPass = null;
      return;
    }
    if(result.success){
      if(['pass_short','pass_long','pass_through','cross'].includes(result.type) && target){
        continuousSetCarrierV974(state,attackingPower.clubId,target,'possession');
        state.completedPassStreak = Math.max(0,Number(state.completedPassStreak || 0)) + 1;
        result.completedPassStreakAfter = Number(state.completedPassStreak || 0);
        state.lastCompletedPass = { phase:state.phase,clubId:attackingPower.clubId,actorId:carrier.playerId,targetId:target.playerId,type:result.type };
        continuousUpdatePossessionAdvanceV990(state,result);
        continuousApplyReceptionRunV990(state,result);
        if(Number(target.x) < Number(context.origin.x)-8) state.counterPhasesLeft = 0;
      }else if(result.type === 'dribble'){
        const advance = simClamp(6 + continuousExecutionAbilityV974('dribble',carrier.player)/18,6,12);
        const nextPosition = { x:simClamp(Number(context.origin.x)+advance,0,96), y:simClamp(Number(context.origin.y)+(50-Number(context.origin.y))*0.12,3,97) };
        continuousSetCarrierV974(state,attackingPower.clubId,carrier,'possession',nextPosition);
        result.toPosition = { ...nextPosition };
        continuousUpdatePossessionAdvanceV990(state,result);
        state.lastCompletedPass = null;
      }
      return;
    }
    const defenderEntry = continuousPossessionEntryFromDefenderV974(state,defendingPower,context.defender);
    continuousSetCarrierV974(state,defendingPower.clubId,defenderEntry,'recovery');
    state.lastCompletedPass = null;
  }
  function continuousEmptyAccumulatorV974(){
    const side = { phases:0,attacks:0,chances:0,fouls:0,xg:0,passScoreSum:0,passScoreCount:0 };
    CONTINUOUS_STAT_KEYS_V974.forEach(key=>{ side[key]=0; });
    return { home:{...side}, away:{...side}, phaseCount:0, goals:[], keySaves:[], errors:[], results:[] };
  }
  function continuousUpdateAccumulatorV974(state, accumulator, result, possessionAtStart){
    accumulator.phaseCount += 1;
    const startSide = continuousSideV974(state,possessionAtStart);
    accumulator[startSide].phases += 1;
    const attackSide = continuousSideV974(state,result.attackingClubId);
    const defendSide = attackSide === 'home' ? 'away' : 'home';
    const attackStats = accumulator[attackSide];
    const defendStats = accumulator[defendSide];
    if(['pass_short','pass_long','pass_through','cross'].includes(result.type)){
      attackStats.passesAttempted += 1;
      if(result.success) attackStats.passesCompleted += 1;
      attackStats.passScoreSum += Number(result.executionAbility || 0); attackStats.passScoreCount += 1;
      if(result.type === 'pass_long'){ attackStats.longPassesAttempted += 1; if(result.success) attackStats.longPassesCompleted += 1; }
      if(result.type === 'pass_through'){ attackStats.throughPassesAttempted += 1; if(result.success) attackStats.throughPassesCompleted += 1; }
      if(result.type === 'cross'){ attackStats.crossesAttempted += 1; if(result.success) attackStats.crossesCompleted += 1; }
      if(result.success && ['pass_through','cross'].includes(result.type)) attackStats.attacks += 1;
    }
    if(result.type === 'dribble'){
      attackStats.dribblesAttempted += 1;
      if(result.success){ attackStats.dribblesWon += 1; if(Number(result.fromPosition?.x || 0) >= 58) attackStats.attacks += 1; }
      if(!result.success && result.defenderId) defendStats.tackles += 1;
    }
    if(result.type === 'shot'){
      attackStats.attacks += 1; attackStats.chances += 1; attackStats.shots += 1;
      attackStats.xg += Number(result.shot?.xg || 0);
      if(result.shot?.onTarget) attackStats.shotsOnTarget += 1;
      if(result.shot?.goalEvent) accumulator.goals.push(result.shot.goalEvent);
      if(result.shot?.keySave) accumulator.keySaves.push(result.shot.keySave);
    }
    if(result.foul) defendStats.fouls += 1;
    if(!result.success && !result.foul && result.defenderId && ['pass_short','pass_long','pass_through','cross'].includes(result.type)) defendStats.interceptions += 1;
    accumulator.results.push(result);
  }
  function continuousBlockStatsV974(accumulator, side){
    const stats = accumulator[side];
    const phaseCount = Math.max(1,Number(accumulator.phaseCount || 0));
    const out = {
      attacks:Number(stats.attacks || 0),
      chances:Number(stats.chances || 0),
      possession:simClamp((Number(stats.phases || 0)/phaseCount)*100,0,100),
      fouls:Number(stats.fouls || 0),
      passScore:stats.passScoreCount ? Number(stats.passScoreSum || 0)/Number(stats.passScoreCount || 1) : 60,
      xg:Number(stats.xg || 0)
    };
    CONTINUOUS_STAT_KEYS_V974.forEach(key=>{ out[key]=Number(stats[key] || 0); });
    return out;
  }
  function continuousTechnicalLogV974(state,result,context){
    if(!CONTINUOUS_MATCH_CONFIG_V974.technicalLog) return;
    state.technicalLog = Array.isArray(state.technicalLog) ? state.technicalLog : [];
    state.technicalLog.push({
      phase:Number(state.phase),
      time:`${String(Math.floor(Number(state.clockSeconds || 0)/60)).padStart(2,'0')}:${String(Number(state.clockSeconds || 0)%60).padStart(2,'0')}`,
      team:Number(result.attackingClubId), carrier:Number(result.actorId), fromSlot:Number(result.fromSlot), action:String(result.type), target:result.targetId?Number(result.targetId):null, targetSlot:Number(result.toSlot), defenders:(context?.laneInterceptors || []).concat(context?.directPressure || []).map(entry=>Number(entry.playerId)).filter((id,index,arr)=>arr.indexOf(id)===index).slice(0,6), success:Boolean(result.success), foul:Boolean(result.foul), nextCarrier:Number(state.ballCarrierId || 0), possessionTeamId:Number(state.possessionTeamId || 0), reason:String(result.reason || '')
    });
    if(state.technicalLog.length > CONTINUOUS_MATCH_CONFIG_V974.maxTechnicalLog) state.technicalLog.splice(0,state.technicalLog.length-CONTINUOUS_MATCH_CONFIG_V974.maxTechnicalLog);
  }
  function continuousCreateMatchStateV974(match, homePower, awayPower, context){
    const state = {
      version:'NEW-SIM-V1', phase:0,totalPhases:CONTINUOUS_MATCH_CONFIG_V974.totalPhases,clockSeconds:0,
      homeId:Number(match.homeId),awayId:Number(match.awayId),
      possessionTeamId:null,ballCarrierId:null,ballSlot:null,previousBallSlot:null,ballPosition:null,playerPositions:{},
      possessionStartPhase:0,transitionType:'kickoff',counterPhasesLeft:0,completedPassStreak:0,possessionAdvanceV990:0,lastAction:null,lastResult:null,lastCompletedPass:null,
      score:{home:0,away:0},context:context || {},rngState:continuousSeedForMatchV974(match),technicalLog:[]
    };
    continuousSyncPlayerPositionsV1(state,homePower,awayPower);
    state.possessionTeamId = continuousRandomV974(state) < 0.5 ? state.homeId : state.awayId;
    const firstPower = Number(state.possessionTeamId) === state.homeId ? homePower : awayPower;
    const candidates = continuousDynamicEntriesV1(state,firstPower);
    const carrier = candidates.slice().filter(entry=>entry.slot!=='POR' && entry.player?.position!=='POR').sort((a,b)=>(Math.abs(a.x-50)*1.4+Math.abs(a.y-50))-(Math.abs(b.x-50)*1.4+Math.abs(b.y-50)))[0] || candidates[0];
    if(carrier) continuousSetCarrierV974(state,state.possessionTeamId,carrier,'kickoff',{x:50,y:50});
    continuousUpdatePlayerPositionsV1(state,homePower,awayPower);
    return state;
  }
  function continuousRunPhaseV974(state, home, away, runtime={}){
    if(!state || state.phase >= CONTINUOUS_MATCH_CONFIG_V974.totalPhases) return null;
    state.phase += 1;
    state.clockSeconds = state.phase * CONTINUOUS_MATCH_CONFIG_V974.secondsPerPhase;
    if(Number(state.counterPhasesLeft || 0)>0) state.counterPhasesLeft -= 1;
    continuousUpdatePlayerPositionsV1(state,home,away);
    const ensured = continuousEnsureCarrierV974(state,home,away);
    const attackingPower = ensured.power;
    const carrier = ensured.carrier;
    if(!attackingPower || !carrier) return null;
    const defendingPower = continuousOtherPowerV974(state,home,away,attackingPower.clubId);
    const possessionAtStart = Number(attackingPower.clubId);
    const action = continuousChooseActionV974(state,attackingPower,defendingPower,carrier,runtime);
    const target = continuousChooseTargetV974(state,attackingPower,defendingPower,carrier,action);
    const context = continuousDefensiveContextV974(state,attackingPower,defendingPower,carrier,target,action.type);
    const result = continuousResolveActionV974(state,attackingPower,defendingPower,carrier,action,target,context,runtime);
    result.completedPassStreakBefore = Number(state.completedPassStreak || 0);
    result.phase = Number(state.phase || 0);
    result.clockSeconds = Number(state.clockSeconds || 0);
    result.playerPositionsBefore = continuousPositionSnapshotV1(state);
    continuousApplyActionV974(state,attackingPower,defendingPower,carrier,target,context,result);
    const nextPos = state.playerPositions?.[continuousPositionKeyV1(state.possessionTeamId,state.ballCarrierId)];
    if(nextPos && state.ballPosition){ nextPos.x=Number(state.ballPosition.x); nextPos.y=Number(state.ballPosition.y); }
    // V9.90: tras la acción el bloque reacciona al nuevo punto del balón en la misma fase.
    continuousUpdatePlayerPositionsV1(state,home,away,Number(CONTINUOUS_MATCH_CONFIG_V974.newV1?.postActionMovement || 0.66));
    result.playerPositions = continuousPositionSnapshotV1(state);
    result.ballAfter = state.ballPosition ? { ...state.ballPosition,clubId:Number(state.possessionTeamId || 0),playerId:Number(state.ballCarrierId || 0) } : null;
    continuousTechnicalLogV974(state,result,context);
    return { result,context,possessionAtStart };
  }
  function continuousRunMinuteV974(state, home, away, runtime={}){
    const accumulator = continuousEmptyAccumulatorV974();
    for(let i=0;i<CONTINUOUS_MATCH_CONFIG_V974.phasesPerMinute && state.phase<CONTINUOUS_MATCH_CONFIG_V974.totalPhases;i++){
      const phase = continuousRunPhaseV974(state,home,away,runtime);
      if(!phase) continue;
      continuousUpdateAccumulatorV974(state,accumulator,phase.result,phase.possessionAtStart);
    }
    return { home:continuousBlockStatsV974(accumulator,'home'), away:continuousBlockStatsV974(accumulator,'away'), goals:accumulator.goals, keySaves:accumulator.keySaves, errors:accumulator.errors, results:accumulator.results, phases:accumulator.phaseCount };
  }
  function continuousEngineSummaryV974(state){
    return { version:'NEW-SIM-V1',phases:Number(state?.phase || 0),totalPhases:CONTINUOUS_MATCH_CONFIG_V974.totalPhases,clockSeconds:Number(state?.clockSeconds || 0),possessionTeamId:Number(state?.possessionTeamId || 0),ballCarrierId:Number(state?.ballCarrierId || 0),ballSlot:Number(state?.ballSlot ?? -1),ballPosition:state?.ballPosition?{...state.ballPosition}:null,playerPositions:continuousPositionSnapshotV1(state),transitionType:String(state?.transitionType || ''),completedPassStreak:Number(state?.completedPassStreak || 0),possessionAdvance:Number(state?.possessionAdvanceV990 || 0),rngState:Number(state?.rngState || 0)>>>0,technicalLog:CONTINUOUS_MATCH_CONFIG_V974.technicalLog ? (state?.technicalLog || []).slice() : [] };
  }
  function debugContinuousCoreV974(match,home,away,context={}){
    const state = continuousCreateMatchStateV974(match,home,away,context);
    const totals = { home:emptyStats(),away:emptyStats(),goals:[],keySaves:[],results:[] };
    for(let minute=1;minute<=90 && state.phase<CONTINUOUS_MATCH_CONFIG_V974.totalPhases;minute++){
      const core = continuousRunMinuteV974(state,home,away,context?.runtime || {});
      mergeBlockStats(totals.home,core.home);
      mergeBlockStats(totals.away,core.away);
      totals.goals.push(...(core.goals || []));
      totals.keySaves.push(...(core.keySaves || []));
      totals.results.push(...(core.results || []));
    }
    return { summary:continuousEngineSummaryV974(state), home:finalizeStats(totals.home),away:finalizeStats(totals.away),goals:totals.goals.slice(),keySaves:totals.keySaves.slice(),results:totals.results.slice() };
  }

  function createLiveMatchSession(match){
    const homeTactic = ensureLiveTacticShape(getTacticForClubV2(match.homeId, match.awayId), match.homeId);
    const awayTactic = ensureLiveTacticShape(getTacticForClubV2(match.awayId, match.homeId), match.awayId);
    const botConditionRepair = normalizeLiveBotConditionsForMatch(match, homeTactic, awayTactic);
    if(!isAdminSimulationSandboxV982(match)){
      applyTacticCohesionPenalty(match.homeId, homeTactic);
      applyTacticCohesionPenalty(match.awayId, awayTactic);
    }
    const matchContext = makeMatchContextV2(match);
    const powers = livePowerPair({ match, homeTactic, awayTactic, matchContext });
    const session = {
      match:{ ...match },
      homeTactic,
      awayTactic,
      matchContext,
      blockIndex:0,
      blocks:LIVE_BLOCKS.map(block => ({ ...block })),
      currentMinute:0,
      homeGoals:0,
      awayGoals:0,
      goals:[],
      cards:[],
      injuries:[],
      substitutions:[],
      keySaves:[],
      errors:[],
      homeTotals:emptyStats(),
      awayTotals:emptyStats(),
      initialStarterIdsHome:(powers.home.lineup || []).map(p => Number(p.id)),
      initialStarterIdsAway:(powers.away.lineup || []).map(p => Number(p.id)),
      playedIdsHome:new Set((powers.home.lineup || []).map(p => Number(p.id))),
      playedIdsAway:new Set((powers.away.lineup || []).map(p => Number(p.id))),
      usedSubs:{},
      usedIns:{},
      usedOuts:{},
      yellowByPlayer:{},
      sentOffByPlayer:{},
      expelledByClub:{},
      injuredGhostByPlayer:{},
      injuredGhostByClub:{},
      injuryPauseRequest:null,
      botConditionRepair,
      instructionConditionDeltas:{},
      liveConditionDeltas:{},
      liveInstructionRecoveryProgress:{},
      instructionLog:[],
      lastContinuousResults:[],
      finished:false
    };
    if(USE_CONTINUOUS_MATCH_ENGINE_V974){
      session.continuousV974 = continuousCreateMatchStateV974(match,powers.home,powers.away,matchContext);
    }
    return session;
  }
  function addLiveInstructionCondition(session, clubId, instruction){
    if(!session) return;
    const normalized = liveNormalizeInstruction(instruction);
    const clubKey = String(Number(clubId || 0));
    session.liveInstructionRecoveryProgress = session.liveInstructionRecoveryProgress || {};
    const previous = session.liveInstructionRecoveryProgress[clubKey] || { instruction:'none', minutes:0 };
    const recoveryInterval = liveInstructionRecoveryInterval(normalized);
    let recoveryDelta = 0;
    let progressMinutes = 0;

    if(recoveryInterval > 0){
      progressMinutes = previous.instruction === normalized ? Number(previous.minutes || 0) : 0;
      progressMinutes += 1;
      while(progressMinutes >= recoveryInterval){
        progressMinutes -= recoveryInterval;
        recoveryDelta += 1;
      }
    }

    session.liveInstructionRecoveryProgress[clubKey] = {
      instruction:normalized,
      minutes:recoveryInterval > 0 ? progressMinutes : 0
    };

    const delta = liveInstructionConditionDelta(normalized) + recoveryDelta;
    if(!delta) return;
    const tactic = liveTacticForClub(session, clubId);
    (tactic?.starters || []).map(Number).filter(Boolean).forEach(id => {
      if(liveIsUnavailableForPlay(session, id)) return;
      session.instructionConditionDeltas[id] = Number(session.instructionConditionDeltas[id] || 0) + delta;
    });
  }
  function simulateLiveBlock(session, options={}){
    if(!session || session.finished) return null;
    session.lastContinuousResults = [];
    const block = session.blocks[session.blockIndex];
    if(!block) return finishLiveMatchSession(session);
    const ownId = Number(game?.selectedClubId || 0);
    const instruction = liveNormalizeInstruction(options.instruction);
    const minuteForActions = Math.max(1, Number(block.matchMinute || block.from || 1));
    applyLiveSubstitutions(session, ownId, options.substitutions || [], minuteForActions);
    for(let i=0;i<3;i++){
      const beforeHome = liveUsedSubCount(session, session.match.homeId);
      const beforeAway = liveUsedSubCount(session, session.match.awayId);
      maybeBotAutoSubstitution(session, session.match.homeId, minuteForActions);
      maybeBotAutoSubstitution(session, session.match.awayId, minuteForActions);
      if(beforeHome === liveUsedSubCount(session, session.match.homeId) && beforeAway === liveUsedSubCount(session, session.match.awayId)) break;
    }
    if(block.playable === false || block.period === 'break'){
      const homeRecovered = applyLiveRestRecovery(session, session.match.homeId);
      const awayRecovered = applyLiveRestRecovery(session, session.match.awayId);
      session.breakLog = Array.isArray(session.breakLog) ? session.breakLog : [];
      session.breakLog.push({ phase:block.phase, breakMinute:block.breakMinute, homeRecovered:Number(homeRecovered.toFixed(2)), awayRecovered:Number(awayRecovered.toFixed(2)) });
      session.instructionLog.push({ minute:45, to:45, instruction:'break', label:block.label });
      session.currentMinute = Number(block.matchMinute || 45);
      session.blockIndex += 1;
      if(session.blockIndex >= session.blocks.length) return finishLiveMatchSession(session);
      return livePublicState(session, { block, breakPhase:block.breakMinute, rest:true, homeRecovered, awayRecovered });
    }
    let { home, away } = livePowerPair(session);
    const homeBotOverexertion = liveBotOverexertionRuleForClub(session, session.match.homeId);
    const awayBotOverexertion = liveBotOverexertionRuleForClub(session, session.match.awayId);
    if(Number(session.match.homeId) === ownId) home = applyLiveInstructionToPower(home, instruction);
    else home = applyBotOverexertionPowerV2(home, homeBotOverexertion);
    if(Number(session.match.awayId) === ownId) away = applyLiveInstructionToPower(away, instruction);
    else away = applyBotOverexertionPowerV2(away, awayBotOverexertion);
    const homeInstruction = Number(session.match.homeId) === ownId ? 'normal' : instructionForScore(session.homeTactic, session.homeGoals, session.awayGoals);
    const awayInstruction = Number(session.match.awayId) === ownId ? 'normal' : instructionForScore(session.awayTactic, session.awayGoals, session.homeGoals);
    let h;
    let a;
    if(USE_CONTINUOUS_MATCH_ENGINE_V974 && session.continuousV974){
      session.continuousV974.score.home = Number(session.homeGoals || 0);
      session.continuousV974.score.away = Number(session.awayGoals || 0);
      const core = continuousRunMinuteV974(session.continuousV974,home,away,{
        conditionResolver:id=>liveEffectiveCondition(session,id),
        liveInstructionByClub:{ [String(ownId)]:instruction }
      });
      session.lastContinuousResults = (core.results || []).map(result => ({ ...result }));
      h = core.home;
      a = core.away;
      (core.goals || []).forEach(goal=>session.goals.push(goal));
      (core.keySaves || []).forEach(event=>session.keySaves.push(event));
      (core.errors || []).forEach(event=>session.errors.push(event));
      session.homeGoals = Number(session.continuousV974.score.home || 0);
      session.awayGoals = Number(session.continuousV974.score.away || 0);
    }else{
      h = blockStatsForTeam(home, away, session.matchContext, homeInstruction, awayInstruction, true, block);
      a = blockStatsForTeam(away, home, session.matchContext, awayInstruction, homeInstruction, false, block);
      const hBaseProb = h.chances > 0 ? simClamp(h.xg / Math.max(1, h.chances), 0.025, 0.70) : 0;
      const aBaseProb = a.chances > 0 ? simClamp(a.xg / Math.max(1, a.chances), 0.025, 0.70) : 0;
      for(let i=0;i<h.chances;i++){
        const goal = resolveChanceV2(home, away, session.match.homeId, session.match.awayId, Math.floor(simRnd(block.from, block.to + 1)), hBaseProb, session.homeTotals, session.awayTotals, session, session.homeGoals + session.awayGoals);
        if(goal){ session.goals.push(goal); session.homeGoals++; }
      }
      for(let i=0;i<a.chances;i++){
        const goal = resolveChanceV2(away, home, session.match.awayId, session.match.homeId, Math.floor(simRnd(block.from, block.to + 1)), aBaseProb, session.awayTotals, session.homeTotals, session, session.homeGoals + session.awayGoals);
        if(goal){ session.goals.push(goal); session.awayGoals++; }
      }
    }
    mergeBlockStats(session.homeTotals, h);
    mergeBlockStats(session.awayTotals, a);
    const friendlyNoSanctions = Boolean(session.match?.friendly);
    const cardCandidates = friendlyNoSanctions ? [] : (session.continuousV974
      ? continuousWithMathRandomV974(session.continuousV974,()=>[
          ...liveCardsForBlock(session, session.match.homeId, home, h.fouls, block),
          ...liveCardsForBlock(session, session.match.awayId, away, a.fouls, block)
        ].sort((x,y)=>x.minute-y.minute))
      : [
          ...liveCardsForBlock(session, session.match.homeId, home, h.fouls, block),
          ...liveCardsForBlock(session, session.match.awayId, away, a.fouls, block)
        ].sort((x,y)=>x.minute-y.minute));
    const cards = friendlyNoSanctions ? [] : applyCardVolumePenaltyV2(cardCandidates, session.cards || []);
    cards.forEach(card => {
      session.cards.push(card);
      if(isRedCardType(card.type)) removePlayerFromLiveTactic(session, card.clubId, card.playerId, 'red');
    });
    const defaultLoss = defaultLossByRedCards(session.cards, session.match.homeId, session.match.awayId);
    if(defaultLoss){
      applyDefaultLossToLiveSession(session, defaultLoss);
      return finishLiveMatchSession(session);
    }
    const injuries = friendlyNoSanctions ? [] : (session.continuousV974
      ? continuousWithMathRandomV974(session.continuousV974,()=>[
          ...liveInjuriesForBlock(session, session.match.homeId, home, session.matchContext, block),
          ...liveInjuriesForBlock(session, session.match.awayId, away, session.matchContext, block)
        ].sort((x,y)=>x.minute-y.minute))
      : [
          ...liveInjuriesForBlock(session, session.match.homeId, home, session.matchContext, block),
          ...liveInjuriesForBlock(session, session.match.awayId, away, session.matchContext, block)
        ].sort((x,y)=>x.minute-y.minute));
    injuries.forEach(injury => {
      session.injuries.push(injury);
      handleLiveInjury(session, injury, injury.minute || block.from);
    });
    const homeAppliedInstruction = Number(session.match.homeId) === ownId ? instruction : homeInstruction;
    const awayAppliedInstruction = Number(session.match.awayId) === ownId ? instruction : awayInstruction;
    const fatigueGuardKey = `block-${session.blockIndex}`;
    applyLiveMinuteFatigue(session, session.match.homeId, homeAppliedInstruction, botOverexertionFatigueMultiplierV2(homeBotOverexertion), fatigueGuardKey);
    applyLiveMinuteFatigue(session, session.match.awayId, awayAppliedInstruction, botOverexertionFatigueMultiplierV2(awayBotOverexertion), fatigueGuardKey);
    if(homeBotOverexertion || awayBotOverexertion){
      session.botOverexertionEvents = Array.isArray(session.botOverexertionEvents) ? session.botOverexertionEvents : [];
      if(homeBotOverexertion) session.botOverexertionEvents.push({ clubId:Number(session.match.homeId), side:'home', minute:block.from, diferencia:session.awayGoals - session.homeGoals, ...homeBotOverexertion });
      if(awayBotOverexertion) session.botOverexertionEvents.push({ clubId:Number(session.match.awayId), side:'away', minute:block.from, diferencia:session.homeGoals - session.awayGoals, ...awayBotOverexertion });
    }
    addLiveInstructionCondition(session, ownId, instruction);
    session.instructionLog.push({ minute:block.from, to:block.to, instruction, label:liveInstructionLabel(instruction) });
    session.currentMinute = Number(block.matchMinute || block.to);
    session.blockIndex += 1;
    if(session.blockIndex >= session.blocks.length) return finishLiveMatchSession(session);
    return livePublicState(session, { block, homeBlock:h, awayBlock:a, cards, injuries });
  }
  function livePublicPitchPlayersV988(session, clubId){
    const tactic = liveTacticForClub(session, clubId);
    const slots = liveTacticSlots(tactic);
    const coords = typeof tacticSlotCoordinates === 'function' ? tacticSlotCoordinates(tactic || {}) : [];
    const starters = Array.isArray(tactic?.starters) ? tactic.starters : [];
    return starters.slice(0,11).map((id,index) => {
      const player = playerById(id);
      if(!player || liveIsUnavailableForPlay(session, player.id)) return null;
      const point = coords[index] || {};
      return {
        id:Number(player.id || 0),
        name:player.name,
        position:player.position,
        role:slots[index] || player.position || 'MC',
        slotIndex:index,
        x:simClamp(Number(point.x ?? 50),0,100),
        y:simClamp(Number(point.y ?? 50),0,100),
        condition:liveEffectiveCondition(session, player.id)
      };
    }).filter(Boolean);
  }
  function livePublicLineup(session, clubId){
    const tactic = liveTacticForClub(session, clubId);
    const slots = liveTacticSlots(tactic);
    return (tactic?.starters || []).map((id, index) => {
      const player = playerById(id);
      const role = slots[index] || player?.position || '—';
      if(!player) return null;
      const injuredGhost = liveIsInjuredGhost(session, player.id);
      return { id:player.id, name:player.name, position:player.position, role, slotIndex:index, fit:injuredGhost ? 0 : Math.round(Number(zoneFactor(player, role) || 0) * 100), overall:effectiveOverall(player), condition:injuredGhost ? 0 : liveEffectiveCondition(session, player.id), morale:currentMorale(player.id), injuredGhost, ghost:injuredGhost };
    }).filter(Boolean);
  }
  function livePublicBoardSlots(session, clubId){
    const tactic = liveTacticForClub(session, clubId);
    const slots = liveTacticSlots(tactic);
    const starters = Array.isArray(tactic?.starters) ? tactic.starters : [];
    return slots.slice(0, 11).map((role, index) => {
      const id = Number(starters[index] || 0);
      const player = id ? playerById(id) : null;
      const injuredGhost = player ? liveIsInjuredGhost(session, player.id) : false;
      return {
        slotIndex:index,
        role,
        empty:!player,
        player:player ? {
          id:player.id,
          name:player.name,
          position:player.position,
          role,
          slotIndex:index,
          fit:injuredGhost ? 0 : Math.round(Number(zoneFactor(player, role) || 0) * 100),
          overall:effectiveOverall(player),
          condition:injuredGhost ? 0 : liveEffectiveCondition(session, player.id),
          morale:currentMorale(player.id),
          injuredGhost,
          ghost:injuredGhost
        } : null
      };
    });
  }
  function swapLiveSlots(session, clubId, slotA, slotB){
    if(!session || session.finished) return false;
    const tactic = liveTacticForClub(session, clubId);
    if(!tactic || !Array.isArray(tactic.starters)) return false;
    const a = Number(slotA);
    const b = Number(slotB);
    if(!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0 || a === b) return false;
    const slots = liveTacticSlots(tactic);
    const max = Math.min(11, slots.length || 11);
    if(a >= max || b >= max) return false;
    while(tactic.starters.length < max) tactic.starters.push(0);
    const aId = Number(tactic.starters[a] || 0);
    const bId = Number(tactic.starters[b] || 0);
    if(!aId && !bId) return false;
    tactic.starters[a] = bId || 0;
    tactic.starters[b] = aId || 0;
    tactic.autoSubs = [];
    liveSetTacticForClub(session, clubId, tactic);
    return true;
  }
  function livePublicBench(session, clubId){
    const tactic = liveTacticForClub(session, clubId);
    const regular = (tactic?.bench || []).map(id => playerById(id)).filter(Boolean).filter(player => !liveIsUnavailableForPlay(session, player.id)).map(player => ({ id:player.id, name:player.name, position:player.position, role:player.position, overall:effectiveOverall(player), condition:liveEffectiveCondition(session, player.id), morale:currentMorale(player.id), fit:100, expelled:false, injuredGhost:false, substitutedOut:false }));
    const clubKey = String(clubId || '');
    const starters = new Set((tactic?.starters || []).map(Number).filter(Boolean));
    const already = new Set(regular.map(player => Number(player.id)));
    const injured = (session?.injuredGhostByClub?.[clubKey] || []).map(id => playerById(id)).filter(Boolean).filter(player => !already.has(Number(player.id)) && !starters.has(Number(player.id))).map(player => ({ id:player.id, name:player.name, position:player.position, role:'LES', overall:effectiveOverall(player), condition:0, morale:currentMorale(player.id), fit:0, expelled:false, injuredGhost:true, substitutedOut:false, blocked:true }));
    injured.forEach(player => already.add(Number(player.id)));
    const expelled = (session?.expelledByClub?.[clubKey] || []).map(id => playerById(id)).filter(Boolean).filter(player => !already.has(Number(player.id)) && !starters.has(Number(player.id))).map(player => ({ id:player.id, name:player.name, position:player.position, role:'EXP', overall:effectiveOverall(player), condition:liveEffectiveCondition(session, player.id), morale:currentMorale(player.id), fit:0, expelled:true, injuredGhost:false, substitutedOut:false, blocked:true }));
    expelled.forEach(player => already.add(Number(player.id)));
    const substituted = (session?.substitutions || [])
      .filter(item => Number(item?.clubId || 0) === Number(clubId || 0))
      .map(item => ({ event:item, player:playerById(item?.outId) }))
      .filter(entry => entry.player && !already.has(Number(entry.player.id)) && !starters.has(Number(entry.player.id)))
      .map(entry => ({
        id:entry.player.id,
        name:entry.player.name,
        position:entry.player.position,
        role:'SAL',
        overall:effectiveOverall(entry.player),
        condition:liveEffectiveCondition(session, entry.player.id),
        morale:currentMorale(entry.player.id),
        fit:0,
        expelled:false,
        injuredGhost:false,
        substitutedOut:true,
        substitutedMinute:Number(entry.event?.minute || 0),
        blocked:true
      }));
    return regular.concat(injured, expelled, substituted);
  }
  function liveStatsSnapshot(session){
    const played = livePlayedPhaseCount(session);
    const home = liveCurrentStats(session.homeTotals, played);
    const away = liveCurrentStats(session.awayTotals, played);
    away.possession = 100 - home.possession;
    return { home, away };
  }
  function liveFormationLabel(tactic){
    return typeof isCustomTactic === 'function' && isCustomTactic(tactic) ? 'Personalizada' : (tactic?.formation || '4-4-2');
  }
  function livePublicState(session, extra={}){
    return {
      match:session.match,
      minute:session.currentMinute,
      period:liveCurrentPeriod(session),
      phaseIndex:Number(session.blockIndex || 0),
      continuousPhase:Number(session.continuousV974?.phase || 0),
      continuousTotalPhases:session.continuousV974 ? CONTINUOUS_MATCH_CONFIG_V974.totalPhases : 0,
      continuousClockSeconds:Number(session.continuousV974?.clockSeconds || 0),
      continuousSecondsPerPhase:session.continuousV974 ? CONTINUOUS_MATCH_CONFIG_V974.secondsPerPhase : 0,
      continuousBallCarrierId:Number(session.continuousV974?.ballCarrierId || 0),
      continuousPossessionTeamId:Number(session.continuousV974?.possessionTeamId || 0),
      continuousBallPosition:session.continuousV974?.ballPosition ? { ...session.continuousV974.ballPosition } : null,
      continuousPlayerPositions:session.continuousV974 ? continuousPositionSnapshotV1(session.continuousV974) : [],
      continuousResults:(session.lastContinuousResults || []).map(result => ({ ...result })),
      phaseLabel:(session.blocks[Math.max(0, Number(session.blockIndex || 0) - 1)] || {}).label || `0'`,
      finished:Boolean(session.finished),
      nextBlock:session.blocks[session.blockIndex] || null,
      homeGoals:session.homeGoals,
      awayGoals:session.awayGoals,
      goals:session.goals.slice().sort((a,b)=>a.minute-b.minute),
      cards:session.cards.slice().sort((a,b)=>a.minute-b.minute),
      injuries:session.injuries.slice().sort((a,b)=>a.minute-b.minute),
      substitutions:session.substitutions.slice().sort((a,b)=>a.minute-b.minute),
      keySaves:session.keySaves.slice().sort((a,b)=>a.minute-b.minute),
      errors:session.errors.slice().sort((a,b)=>a.minute-b.minute),
      instructionLog:session.instructionLog.slice(),
      homeLineup:livePublicLineup(session, session.match.homeId),
      awayLineup:livePublicLineup(session, session.match.awayId),
      homePitchPlayers:livePublicPitchPlayersV988(session, session.match.homeId),
      awayPitchPlayers:livePublicPitchPlayersV988(session, session.match.awayId),
      homeBoardSlots:livePublicBoardSlots(session, session.match.homeId),
      awayBoardSlots:livePublicBoardSlots(session, session.match.awayId),
      ownBoardSlots:livePublicBoardSlots(session, game?.selectedClubId || 0),
      homeBench:livePublicBench(session, session.match.homeId),
      awayBench:livePublicBench(session, session.match.awayId),
      ownBench:livePublicBench(session, game?.selectedClubId || 0),
      homeFormation:liveFormationLabel(session.homeTactic),
      awayFormation:liveFormationLabel(session.awayTactic),
      ownFormation:liveFormationLabel(liveTacticForClub(session, game?.selectedClubId || 0)),
      availableFormations:liveFormationKeys(),
      usedSubs:(session.usedSubs[String(game?.selectedClubId || 0)] || []).length,
      usedSubsHome:(session.usedSubs[String(session.match.homeId)] || []).length,
      usedSubsAway:(session.usedSubs[String(session.match.awayId)] || []).length,
      maxSubs:5,
      matchStats:liveStatsSnapshot(session),
      matchContext:session.matchContext,
      phasesPlayed:Number(session.blockIndex || 0),
      matchPhasesPlayed:livePlayedPhaseCount(session),
      totalPhases:session.blocks.length,
      phaseTimeline:(session.blocks || []).map(block => ({ phase:block.phase, label:block.label, period:block.period, matchMinute:block.matchMinute, breakMinute:block.breakMinute, playable:block.playable !== false })),
      breakLog:Array.isArray(session.breakLog) ? session.breakLog.slice() : [],
      expelledByClub:{ ...(session.expelledByClub || {}) },
      sentOffByPlayer:{ ...(session.sentOffByPlayer || {}) },
      injuredGhostByClub:{ ...(session.injuredGhostByClub || {}) },
      injuredGhostByPlayer:{ ...(session.injuredGhostByPlayer || {}) },
      injuryPauseRequest:session.injuryPauseRequest ? { ...session.injuryPauseRequest } : null,
      breakPhase:Number(extra?.breakPhase || 0),
      lastBlock:extra?.block || null,
      currentBlockStats:{ home:extra?.homeBlock || null, away:extra?.awayBlock || null },
      penaltyShootout:session.result?.penaltyShootout || null,
      winnerClubId:Number(session.result?.winnerClubId || 0),
      extra
    };
  }
  function finishLiveMatchSession(session){
    if(!session) return null;
    session.finished = true;
    session.goals.sort((a,b)=>a.minute-b.minute);
    session.cards.sort((a,b)=>a.minute-b.minute);
    session.injuries.sort((a,b)=>a.minute-b.minute);
    session.substitutions.sort((a,b)=>a.minute-b.minute);
    session.keySaves.sort((a,b)=>a.minute-b.minute);
    session.errors.sort((a,b)=>a.minute-b.minute);
    const matchStats = { home:liveFinalizeStats(session.homeTotals, 90), away:liveFinalizeStats(session.awayTotals, 90) };
    matchStats.away.possession = 100 - matchStats.home.possession;
    const starterIdsHome = (session.initialStarterIdsHome || []).map(Number).filter(Boolean);
    const starterIdsAway = (session.initialStarterIdsAway || []).map(Number).filter(Boolean);
    const playedIdsHome = [...session.playedIdsHome];
    const playedIdsAway = [...session.playedIdsAway];
    const result = {
      ...session.match,
      played:true,
      engine:session.continuousV974 ? 'new-simulator-v1-360' : 'live-tactical',
      starterIdsHome,
      starterIdsAway,
      homeGoals:session.homeGoals,
      awayGoals:session.awayGoals,
      goals:session.goals,
      cards:session.cards,
      injuries:session.injuries,
      substitutions:session.substitutions,
      keySaves:session.keySaves,
      errors:session.errors,
      playerRatings:liveFinalPlayerRatings(session),
      matchStats,
      matchContext:session.matchContext,
      playedIdsHome,
      playedIdsAway,
      instructionConditionDeltas:session.instructionConditionDeltas,
      botOverexertionEvents:Array.isArray(session.botOverexertionEvents) ? session.botOverexertionEvents.slice() : [],
      liveBlocks:session.instructionLog,
      suspended:Boolean(session.suspended),
      defaultLoss:session.defaultLoss || null,
      continuousEngine:session.continuousV974 ? continuousEngineSummaryV974(session.continuousV974) : null
    };
    if(!result.friendly){
      applyMatchCohesionResult(result, result.substitutions, result.cards);
      applyResultToTables(result, result.homeGoals, result.awayGoals);
      applyPlayerStats(result.homeId, playedIdsHome.map(playerById).filter(Boolean), result.substitutions, result.goals, result.cards, result.injuries, result.keySaves, result.errors, result);
      applyPlayerStats(result.awayId, playedIdsAway.map(playerById).filter(Boolean), result.substitutions, result.goals, result.cards, result.injuries, result.keySaves, result.errors, result);
      applyAvailability(result.cards, result.injuries, result);
      if(typeof updatePlayerStarTrackingForMatch === 'function') updatePlayerStarTrackingForMatch(result);
    }
    const finalResult = typeof window.finalizeWinnerRequiredMatchResult === 'function'
      ? window.finalizeWinnerRequiredMatchResult(session.match, result)
      : result;
    session.result = finalResult;
    return finalResult;
  }
  function isAdminSimulationSandboxV982(match){ return Boolean(match?.adminSimulation); }
  function simulateMatchLegacyV973(match){
    const homeTactic = getTacticForClubV2(match.homeId, match.awayId);
    const awayTactic = getTacticForClubV2(match.awayId, match.homeId);
    if(!isAdminSimulationSandboxV982(match)){
      applyTacticCohesionPenalty(match.homeId, homeTactic);
      applyTacticCohesionPenalty(match.awayId, awayTactic);
    }
    const matchContext = makeMatchContextV2(match);
    let home = teamPowerV2(match.homeId, homeTactic, { crowdBonus:matchContext.homeCrowdBonus || 0 });
    let away = teamPowerV2(match.awayId, awayTactic, { crowdBonus:0 });
    ({ home, away } = applyManagerTacticalAdaptationPairV2(home, away, match, matchContext));
    const homeTotals = emptyStats();
    const awayTotals = emptyStats();
    const incidents = { keySaves:[], errors:[] };
    const goals = [];
    let homeGoals = 0;
    let awayGoals = 0;
    for(const block of BLOCKS){
      const homeInstruction = instructionForScore(homeTactic, homeGoals, awayGoals);
      const awayInstruction = instructionForScore(awayTactic, awayGoals, homeGoals);
      const homeBotOverexertion = isManagerClubV2(match.homeId) ? null : botOverexertionRuleV2(homeGoals, awayGoals);
      const awayBotOverexertion = isManagerClubV2(match.awayId) ? null : botOverexertionRuleV2(awayGoals, homeGoals);
      const homeBlockPower = applyBotOverexertionPowerV2(home, homeBotOverexertion);
      const awayBlockPower = applyBotOverexertionPowerV2(away, awayBotOverexertion);
      const h = blockStatsForTeam(homeBlockPower, awayBlockPower, matchContext, homeInstruction, awayInstruction, true, block);
      const a = blockStatsForTeam(awayBlockPower, homeBlockPower, matchContext, awayInstruction, homeInstruction, false, block);
      mergeBlockStats(homeTotals, h);
      mergeBlockStats(awayTotals, a);
      let hGoals = 0;
      let aGoals = 0;
      const hBaseProb = h.chances > 0 ? simClamp(h.xg / Math.max(1, h.chances), 0.025, 0.70) : 0;
      const aBaseProb = a.chances > 0 ? simClamp(a.xg / Math.max(1, a.chances), 0.025, 0.70) : 0;
      for(let i=0;i<h.chances;i++){
        const goal = resolveChanceV2(home, away, match.homeId, match.awayId, Math.floor(simRnd(block.from, block.to + 1)), hBaseProb, homeTotals, awayTotals, incidents, homeGoals + awayGoals + hGoals + aGoals);
        if(goal){ goals.push(goal); hGoals++; }
      }
      for(let i=0;i<a.chances;i++){
        const goal = resolveChanceV2(away, home, match.awayId, match.homeId, Math.floor(simRnd(block.from, block.to + 1)), aBaseProb, awayTotals, homeTotals, incidents, homeGoals + awayGoals + hGoals + aGoals);
        if(goal){ goals.push(goal); aGoals++; }
      }
      homeGoals += hGoals;
      awayGoals += aGoals;
    }
    goals.sort((a,b)=>a.minute-b.minute);
    const matchStats = { home:finalizeStats(homeTotals), away:finalizeStats(awayTotals) };
    matchStats.away.possession = 100 - matchStats.home.possession;
    const cardCandidates = [...makeCardsV2(match.homeId, home, matchStats.home.fouls), ...makeCardsV2(match.awayId, away, matchStats.away.fouls)].sort((a,b)=>a.minute-b.minute);
    const cards = applyCardVolumePenaltyV2(cardCandidates, []);
    const defaultLoss = defaultLossByRedCards(cards, match.homeId, match.awayId);
    if(defaultLoss){
      homeGoals = Number(defaultLoss.homeGoals || 0);
      awayGoals = Number(defaultLoss.awayGoals || 0);
    }
    const injuries = defaultLoss ? [] : [...makeInjuriesV2(match.homeId, home, matchContext), ...makeInjuriesV2(match.awayId, away, matchContext)].sort((a,b)=>a.minute-b.minute);
    const regularSubs = [
      ...makeSubstitutions(match.homeId, homeTactic),
      ...makeSubstitutions(match.awayId, awayTactic)
    ];
    const injurySubs = [
      ...makeInjurySubstitutions(match.homeId, homeTactic, injuries, regularSubs),
      ...makeInjurySubstitutions(match.awayId, awayTactic, injuries, regularSubs)
    ];
    const substitutions = [...regularSubs, ...injurySubs].sort((a,b)=>a.minute-b.minute);
    const starterIdsHome = home.lineup.map(p=>p.id);
    const starterIdsAway = away.lineup.map(p=>p.id);
    const playedIdsHome = [...new Set(starterIdsHome.concat(substitutions.filter(s=>s.clubId===match.homeId).map(s=>s.inId)))];
    const playedIdsAway = [...new Set(starterIdsAway.concat(substitutions.filter(s=>s.clubId===match.awayId).map(s=>s.inId)))];
    if(!match.friendly && !isAdminSimulationSandboxV982(match)){
      applyMatchCohesionResult(match, substitutions, cards);
      applyResultToTables(match, homeGoals, awayGoals);
      const playerStatsResult = { ...match, played:true, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves:incidents.keySaves, errors:incidents.errors, starterIdsHome, starterIdsAway, playedIdsHome, playedIdsAway };
      applyPlayerStats(match.homeId, home.lineup, substitutions, goals, cards, injuries, incidents.keySaves, incidents.errors, playerStatsResult);
      applyPlayerStats(match.awayId, away.lineup, substitutions, goals, cards, injuries, incidents.keySaves, incidents.errors, playerStatsResult);
      applyAvailability(cards, injuries, playerStatsResult);
      if(typeof updatePlayerStarTrackingForMatch === 'function'){
        updatePlayerStarTrackingForMatch({ ...match, played:true, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves:incidents.keySaves, errors:incidents.errors, starterIdsHome, starterIdsAway, playedIdsHome, playedIdsAway });
      }
    }
    const botOverexertionConditionDelta = (clubId, gf, gc, ids) => {
      if(isManagerClubV2(clubId)) return {};
      const rule = botOverexertionRuleV2(gf, gc);
      if(!rule) return {};
      const result = {};
      (ids || []).forEach(id => {
        const player = playerById(id);
        const baseLoss = player && typeof conditionLossForPlayer === 'function' ? Math.max(1, Number(conditionLossForPlayer(player) || 0)) : 10;
        result[id] = -Math.max(1, Math.round(baseLoss * Number(rule.desgasteFisicoPct || 0)));
      });
      return result;
    };
    const instructionConditionDeltas = mergeConditionDeltas(
      instructionConditionDelta(homeTactic, homeGoals, awayGoals, starterIdsHome),
      instructionConditionDelta(awayTactic, awayGoals, homeGoals, starterIdsAway),
      sectorStyleConditionDelta(home, starterIdsHome),
      sectorStyleConditionDelta(away, starterIdsAway),
      botOverexertionConditionDelta(match.homeId, homeGoals, awayGoals, starterIdsHome),
      botOverexertionConditionDelta(match.awayId, awayGoals, homeGoals, starterIdsAway)
    );
    const result = { ...match, played:true, engine:'full-tactical', starterIdsHome, starterIdsAway, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves:incidents.keySaves, errors:incidents.errors, matchStats, matchContext, playedIdsHome, playedIdsAway, instructionConditionDeltas, suspended:Boolean(defaultLoss), defaultLoss:defaultLoss ? { ...defaultLoss, reason:'Cinco expulsiones' } : null };
    return typeof window.finalizeWinnerRequiredMatchResult === 'function'
      ? window.finalizeWinnerRequiredMatchResult(match, result)
      : result;
  }


  function simulateMatchContinuousV974(match){
    const homeTactic = ensureLiveTacticShape(getTacticForClubV2(match.homeId, match.awayId), match.homeId);
    const awayTactic = ensureLiveTacticShape(getTacticForClubV2(match.awayId, match.homeId), match.awayId);
    if(!isAdminSimulationSandboxV982(match)){
      applyTacticCohesionPenalty(match.homeId, homeTactic);
      applyTacticCohesionPenalty(match.awayId, awayTactic);
    }
    const matchContext = makeMatchContextV2(match);
    let home = teamPowerV2(match.homeId, homeTactic, { crowdBonus:matchContext.homeCrowdBonus || 0 });
    let away = teamPowerV2(match.awayId, awayTactic, { crowdBonus:0 });
    ({ home, away } = applyManagerTacticalAdaptationPairV2(home, away, match, matchContext));
    const state = continuousCreateMatchStateV974(match,home,away,matchContext);
    const homeTotals = emptyStats();
    const awayTotals = emptyStats();
    const incidents = { keySaves:[], errors:[] };
    const goals = [];
    for(let minute=1; minute<=90 && state.phase<CONTINUOUS_MATCH_CONFIG_V974.totalPhases; minute++){
      const homeBotOverexertion = isManagerClubV2(match.homeId) ? null : botOverexertionRuleV2(state.score.home,state.score.away);
      const awayBotOverexertion = isManagerClubV2(match.awayId) ? null : botOverexertionRuleV2(state.score.away,state.score.home);
      const homeMinutePower = applyBotOverexertionPowerV2(home,homeBotOverexertion);
      const awayMinutePower = applyBotOverexertionPowerV2(away,awayBotOverexertion);
      const core = continuousRunMinuteV974(state,homeMinutePower,awayMinutePower,{});
      mergeBlockStats(homeTotals,core.home);
      mergeBlockStats(awayTotals,core.away);
      (core.goals || []).forEach(goal=>goals.push(goal));
      (core.keySaves || []).forEach(event=>incidents.keySaves.push(event));
      (core.errors || []).forEach(event=>incidents.errors.push(event));
    }
    goals.sort((a,b)=>a.minute-b.minute);
    let homeGoals = Number(state.score.home || 0);
    let awayGoals = Number(state.score.away || 0);
    const matchStats = { home:finalizeStats(homeTotals), away:finalizeStats(awayTotals) };
    matchStats.away.possession = 100 - matchStats.home.possession;
    const friendlyNoSanctions = Boolean(match?.friendly);
    const cardCandidates = friendlyNoSanctions ? [] : continuousWithMathRandomV974(state,()=>[
      ...makeCardsV2(match.homeId, home, matchStats.home.fouls),
      ...makeCardsV2(match.awayId, away, matchStats.away.fouls)
    ].sort((a,b)=>a.minute-b.minute));
    const cards = friendlyNoSanctions ? [] : applyCardVolumePenaltyV2(cardCandidates, []);
    const defaultLoss = friendlyNoSanctions ? null : defaultLossByRedCards(cards, match.homeId, match.awayId);
    if(defaultLoss){
      homeGoals = Number(defaultLoss.homeGoals || 0);
      awayGoals = Number(defaultLoss.awayGoals || 0);
      state.score.home = homeGoals;
      state.score.away = awayGoals;
    }
    const injuries = friendlyNoSanctions || defaultLoss ? [] : continuousWithMathRandomV974(state,()=>[
      ...makeInjuriesV2(match.homeId, home, matchContext),
      ...makeInjuriesV2(match.awayId, away, matchContext)
    ].sort((a,b)=>a.minute-b.minute));
    const regularSubs = [
      ...makeSubstitutions(match.homeId, homeTactic),
      ...makeSubstitutions(match.awayId, awayTactic)
    ];
    const injurySubs = [
      ...makeInjurySubstitutions(match.homeId, homeTactic, injuries, regularSubs),
      ...makeInjurySubstitutions(match.awayId, awayTactic, injuries, regularSubs)
    ];
    const substitutions = [...regularSubs, ...injurySubs].sort((a,b)=>a.minute-b.minute);
    const starterIdsHome = home.lineup.map(p=>p.id);
    const starterIdsAway = away.lineup.map(p=>p.id);
    const playedIdsHome = [...new Set(starterIdsHome.concat(substitutions.filter(item=>Number(item.clubId)===Number(match.homeId)).map(item=>item.inId)))];
    const playedIdsAway = [...new Set(starterIdsAway.concat(substitutions.filter(item=>Number(item.clubId)===Number(match.awayId)).map(item=>item.inId)))];
    const playerStatsResult = { ...match, played:true, engine:'new-simulator-v1-360', homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves:incidents.keySaves, errors:incidents.errors, starterIdsHome, starterIdsAway, playedIdsHome, playedIdsAway, matchStats, matchContext, continuousEngine:continuousEngineSummaryV974(state) };
    if(!match.friendly && !isAdminSimulationSandboxV982(match)){
      applyMatchCohesionResult(playerStatsResult, substitutions, cards);
      applyResultToTables(playerStatsResult, homeGoals, awayGoals);
      applyPlayerStats(match.homeId, home.lineup, substitutions, goals, cards, injuries, incidents.keySaves, incidents.errors, playerStatsResult);
      applyPlayerStats(match.awayId, away.lineup, substitutions, goals, cards, injuries, incidents.keySaves, incidents.errors, playerStatsResult);
      applyAvailability(cards, injuries, playerStatsResult);
      if(typeof updatePlayerStarTrackingForMatch === 'function') updatePlayerStarTrackingForMatch(playerStatsResult);
    }
    const botOverexertionConditionDelta = (clubId, gf, gc, ids) => {
      if(isManagerClubV2(clubId)) return {};
      const rule = botOverexertionRuleV2(gf, gc);
      if(!rule) return {};
      const result = {};
      (ids || []).forEach(id => {
        const player = playerById(id);
        const baseLoss = player && typeof conditionLossForPlayer === 'function' ? Math.max(1, Number(conditionLossForPlayer(player) || 0)) : 10;
        result[id] = -Math.max(1, Math.round(baseLoss * Number(rule.desgasteFisicoPct || 0)));
      });
      return result;
    };
    const instructionConditionDeltas = mergeConditionDeltas(
      instructionConditionDelta(homeTactic, homeGoals, awayGoals, starterIdsHome),
      instructionConditionDelta(awayTactic, awayGoals, homeGoals, starterIdsAway),
      sectorStyleConditionDelta(home, starterIdsHome),
      sectorStyleConditionDelta(away, starterIdsAway),
      botOverexertionConditionDelta(match.homeId, homeGoals, awayGoals, starterIdsHome),
      botOverexertionConditionDelta(match.awayId, awayGoals, homeGoals, starterIdsAway)
    );
    const result = { ...playerStatsResult, instructionConditionDeltas, suspended:Boolean(defaultLoss), defaultLoss:defaultLoss ? { ...defaultLoss, reason:'Cinco expulsiones' } : null };
    return typeof window.finalizeWinnerRequiredMatchResult === 'function'
      ? window.finalizeWinnerRequiredMatchResult(match, result)
      : result;
  }
  function simulateMatch(match){
    return USE_CONTINUOUS_MATCH_ENGINE_V974 ? simulateMatchContinuousV974(match) : simulateMatchLegacyV973(match);
  }

  window.MATCH_INSTRUCTION_OPTIONS = MATCH_INSTRUCTION_OPTIONS;
  window.DEFAULT_MATCH_INSTRUCTIONS = DEFAULT_MATCH_INSTRUCTIONS;
  window.LIVE_MANAGER_INSTRUCTIONS = LIVE_MANAGER_INSTRUCTIONS;
  window.Simulator20 = {
    simulateMatch,
    createLiveMatchSession,
    simulateLiveBlock,
    applyLiveFormation,
    swapLiveSlots,
    finishLiveMatchSession,
    livePublicState,
    pitchEffect:pitchEffectV2,
    normalizeMatchInstructions,
    normalizeSectorStyles:normalizeSectorStylesV2,
    normalizeGoalkeeperDistribution:normalizeGoalkeeperDistributionV974,
    normalizeBuildUpStyle:normalizeBuildUpStyleV974,
    continuousEngineEnabled:USE_CONTINUOUS_MATCH_ENGINE_V974,
    continuousEngineConfig:{ ...CONTINUOUS_MATCH_CONFIG_V974 },
    _debugContinuousCoreV974:debugContinuousCoreV974,
    botTacticForClub:botTacticForClubV2,
    isAdminSimulationSandbox:isAdminSimulationSandboxV982
  };
})();
