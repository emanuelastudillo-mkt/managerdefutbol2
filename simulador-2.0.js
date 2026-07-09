/* Motor de simulación V2.0 · V5.26 desgaste, tarjetas y suspensión
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
    { value:'all_attack', label:'Todos al ataque', desc:'Bono pequeño de ataque. Aumenta el riesgo defensivo.' },
    { value:'huevos', label:'PONGAN HUEVO!!!', desc:'+10% ataque y defensa. Consume 20% extra de estado físico.' },
    { value:'hold_result', label:'Cuidar el resultado', desc:'Bono de posesión y control.' },
    { value:'all_defense', label:'Todos a defender', desc:'Bono alto de defensa. Ataque propio casi anulado.' }
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
  const SIM_TEAM_WEIGHT = simConfigNumber('simulador.pesoColectivo', 0.70, 0, 1);
  const SIM_INDIVIDUAL_WEIGHT = simConfigNumber('simulador.pesoIndividual', 0.30, 0, 1);
  const SIM_SET_PIECE_CHANCE = simConfigNumber('simulador.probabilidadPelotaParada', 0.14, 0, 1);
  const SIM_ERROR_GOAL_RATE = simConfigNumber('simulador.probabilidadErrorTerminaEnGol', 0.28, 0, 1);
  const SIM_GOAL_ERROR_ATTRIBUTION_RATE = simConfigNumber('simulador.probabilidadGolAtribuyeErrorGol', 0.60, 0, 1);
  const SIM_PLAYER_ERROR_SCALE = simConfigNumber('simulador.escalaRiesgoErrorJugador', 0.72, 0, 2);
  const SIM_USE_PLAYER_ERROR_FORMULA = Boolean(simConfigValue('simulador.formulaErroresJugador', true));
  const SIM_MAX_TEAM_ERRORS = Math.round(simConfigNumber('simulador.maximoErroresPorEquipo', 5, 0, 20));
  const LIVE_FATIGUE_MULTIPLIER = simConfigNumber('simulador.fatigaVivaMultiplicador', 2, 0.5, 4);
  const SIM_CARD_RATE_MULTIPLIER = simConfigNumber('simulador.multiplicadorTarjetas', 0.5, 0, 2);
  const SIM_DEFAULT_LOSS_RED_CARDS = Math.round(simConfigNumber('simulador.rojasDerrotaDefault', 5, 1, 11));
  const LIVE_BOT_SUB_MINUTES = [45, 60, 70, 78, 84];
  const LIVE_BOT_INJURY_SUB_ENABLED = true;

  function simClamp(value,min,max){ return Math.max(min, Math.min(max, value)); }
  function simAvg(values){ const clean = values.filter(v => Number.isFinite(v)); return clean.length ? clean.reduce((a,b)=>a+b,0)/clean.length : 0; }
  function simRnd(min,max){ return min + Math.random() * (max-min); }
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
  function getTacticForClubV2(clubId){
    if(clubId === game.selectedClubId) return { ...game.tactic, matchInstructions:normalizeMatchInstructions(game.tactic?.matchInstructions), sectorStyles:normalizeSectorStylesV2(game.tactic?.sectorStyles) };
    const club = seed.clubs.find(c=>c.id===clubId) || { reputation:60 };
    const formation = club.reputation > 74 ? '4-3-3' : club.reputation < 61 ? '5-4-1' : '4-4-2';
    return { formation, starters:[], bench:[], autoSubs:[], playerMentalities:{}, matchInstructions:{...DEFAULT_MATCH_INSTRUCTIONS}, sectorStyles:normalizeSectorStylesV2(null) };
  }
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
    const formation = tactic?.formation || '4-4-2';
    const slots = FORMATIONS[formation] || FORMATIONS['4-4-2'];
    const sentOffIds = options?.sentOffIds instanceof Set ? options.sentOffIds : new Set();
    const hasExplicitStarters = Array.isArray(tactic?.starters) && tactic.starters.length;
    let assigned = [];
    if(hasExplicitStarters){
      assigned = tactic.starters.slice(0, 11).map((id, i) => {
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
    const defense = (defenseQuality + countBoost.defense + profile.defense + adjust.defense + keeperQuality * 0.12) * cohesion * teamMorale * crowdConditionMultiplier * conditionPower;
    const midfield = (midfieldQuality + countBoost.midfield + profile.midfield + adjust.midfield) * cohesion * teamMorale * crowdConditionMultiplier * conditionPower;
    const attack = (attackQuality + countBoost.attack + profile.attack + adjust.attack) * cohesion * teamMorale * crowdConditionMultiplier * conditionPower;
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
      conditionAvg:liveConditionAvg,
      discipline, stamina, aggression, reputation:rep
    };
  }
  function makeMatchContextV2(match){
    const weatherOptions = ['Soleado', 'Nublado', 'Lluvia leve', 'Lluvia intensa', 'Viento moderado', 'Calor húmedo'];
    const weather = weatherOptions[hashNumber(`${match.id}-weather-${game?.matchdayIndex || 0}`, weatherOptions.length)];
    const homeClub = seed.clubs.find(c=>c.id===match.homeId);
    const awayClub = seed.clubs.find(c=>c.id===match.awayId);
    const pitchScore = fieldScoreForClub(match.homeId);
    const pitch = fieldConditionName(pitchScore);
    const effect = pitchEffectV2(pitch);
    const attendance = typeof attendanceContextForMatch === 'function'
      ? attendanceContextForMatch(match)
      : { homeFans:Math.max(800, Math.round((homeClub?.reputation || 60) * simRnd(210,360))), awayFans:Math.max(120, Math.round((awayClub?.reputation || 60) * simRnd(18,70))), totalFans:0, capacity:0, homeCrowdBonus:0, ticketPrice:0, ticketRevenue:0 };
    return { weather, pitch, pitchScore, ...attendance, pitchEffect:effect };
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
    const possession = simClamp(Math.round((effectiveMid / Math.max(1, effectiveMid + rivalMid)) * 100 + (isHome ? 2 : -1) + simRnd(-4,4)), 28, 72);
    const midfieldAttack = effectiveMid / 17;
    const attackPressure = (own.attack * ownInstr.attack) / 22;
    const defenseBrake = (rival.defense * rivalInstr.defense) / 34;
    const baseAttacks = 3.5 + midfieldAttack + attackPressure - defenseBrake + own.profile.attacks + (possession - 50) / 12 + (isHome ? 0.6 : 0) + simRnd(-1.6,1.9);
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
    const xg = simClamp(chances * xgPerChance + (fullBlockAttacks > 8 ? 0.04 * phaseFactor : 0) + (isHome ? 0.03 * phaseFactor : 0), 0, 0.55);
    const fullBlockFouls = Math.max(0, 1.1 + own.aggression/46 + (100-own.discipline)/62 + ownStyle.foulAdd + (ownInstruction === 'push' ? 0.55 : ownInstruction === 'lower' ? -0.35 : 0) + simRnd(-0.7,0.9));
    const fouls = simClamp(probabilisticRoundV2(fullBlockFouls * phaseFactor), 0, 3);
    return { attacks, chances, possession, fouls, passScore:Math.round(effectiveMid), xg };
  }
  function mergeBlockStats(total, block){
    total.attacks += block.attacks;
    total.chances += block.chances;
    total.fouls += block.fouls;
    total.xg += block.xg;
    total.passScore += block.passScore;
    total.possessionWeighted += block.possession;
  }
  function emptyStats(){ return { attacks:0, chances:0, possession:50, fouls:0, passScore:0, xg:0, possessionWeighted:0, keySaves:0, errors:0, goalErrors:0 }; }
  function finalizeStats(stats){
    return {
      attacks:simClamp(Math.round(stats.attacks), 1, 75),
      chances:simClamp(Math.round(stats.chances), 0, 18),
      possession:simClamp(Math.round(stats.possessionWeighted / BLOCKS.length), 20, 80),
      fouls:simClamp(Math.round(stats.fouls), 0, 32),
      passScore:simClamp(Math.round(stats.passScore / BLOCKS.length), 1, 140),
      xg:Number(stats.xg.toFixed(2)),
      keySaves:Math.round(Number(stats.keySaves || 0)),
      errors:Math.round(Number(stats.errors || 0)),
      goalErrors:Math.round(Number(stats.goalErrors || 0))
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
  function playerRoleCodeV2(player){
    const pos = String(player?.position || '').toUpperCase();
    if(pos === 'POR') return 'gk';
    if(['DC','ED','EI'].includes(pos)) return 'att';
    if(['MCO','MC','MCD'].includes(pos)) return 'mid';
    return 'def';
  }
  function scorerWeightV2(player, setPiece=false, tactic=null){
    if(!player) return 1;
    if(player.position === 'POR') return 0.05;
    const pos = String(player.position || '').toUpperCase();
    if(setPiece){
      const setPieceBonus = pos === 'DC' ? 110 : ['DFC','LD','LI'].includes(pos) ? 72 : ['ED','EI','MCO'].includes(pos) ? 46 : ['MC','MCD'].includes(pos) ? 28 : 12;
      const starMul = typeof playerStarReferenceMultiplier === 'function' ? playerStarReferenceMultiplier(player, 'goal') : 1;
      return (effectiveSkill(player,'cabezazo') * 1.18 + effectiveSkill(player,'fuerza') * 0.35 + effectiveSkill(player,'posicionamiento') * 0.70 + effectiveSkill(player,'serenidad') * 0.35 + setPieceBonus) * starMul * simMentalityAttackMultiplier(player, tactic);
    }
    const posBonus = pos === 'DC' ? 160 : ['ED','EI'].includes(pos) ? 118 : pos === 'MCO' ? 72 : pos === 'MC' ? 28 : pos === 'MCD' ? 9 : 2;
    const rolePenalty = ['DFC','LD','LI'].includes(pos) ? 0.28 : pos === 'MCD' ? 0.55 : 1;
    const starMul = typeof playerStarReferenceMultiplier === 'function' ? playerStarReferenceMultiplier(player, 'goal') : 1;
    return (effectiveSkill(player,'remate') * 1.55 + effectiveSkill(player,'posicionamiento') * 1.20 + effectiveSkill(player,'serenidad') * 0.55 + currentMorale(player.id) * 0.20 + posBonus) * rolePenalty * starMul * simMentalityAttackMultiplier(player, tactic);
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
  function resolveChanceV2(attacking, defending, attackingClubId, defendingClubId, minute, baseGoalProb, homeOrAwayTotals, rivalTotals, incidents){
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
    const goalProb = simClamp(((baseGoalProb * collectiveWeight) + (individualGoalProb * individualWeight)) / divisor, 0.018, 0.78);
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
    const yellowCount = simClamp(poissonV2((fouls * SIM_CARD_RATE_MULTIPLIER) / 7.6), 0, 6);
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
    const directChance = simClamp(((power.aggression - 60) / 290) * SIM_CARD_RATE_MULTIPLIER, 0.001, 0.13);
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
      const chance = injuryChanceForPlayer(player.id, context.pitch);
      if(Math.random() < chance){
        const injury = pickInjuryType();
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
          phase:duringMatch ? 'durante' : 'final'
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
    if(instruction === 'all_attack'){
      copy.attack *= 1.08;
      copy.midfield *= 1.01;
      copy.defense *= 0.94;
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 1.07, 0.45, 1.55);
      style.chanceMultiplier = simClamp((style.chanceMultiplier || 1) * 1.06, 0.45, 1.55);
      style.rivalAttackMultiplier = simClamp((style.rivalAttackMultiplier || 1) * 1.08, 0.55, 1.40);
      style.rivalChanceMultiplier = simClamp((style.rivalChanceMultiplier || 1) * 1.06, 0.55, 1.40);
    }else if(instruction === 'huevos'){
      copy.attack *= 1.10;
      copy.defense *= 1.10;
      copy.keeper *= 1.04;
      style.attackMultiplier = simClamp((style.attackMultiplier || 1) * 1.10, 0.45, 1.55);
      style.rivalAttackMultiplier = simClamp((style.rivalAttackMultiplier || 1) * 0.96, 0.55, 1.40);
      style.foulAdd = simClamp((style.foulAdd || 0) + 0.35, -1.2, 3.0);
    }else if(instruction === 'hold_result'){
      copy.midfield *= 1.07;
      copy.defense *= 1.03;
      copy.attack *= 0.96;
      style.possessionAdd = simClamp((style.possessionAdd || 0) + 5, -12, 18);
      style.errorRiskMultiplier = simClamp((style.errorRiskMultiplier || 1) * 0.93, 0.45, 1.55);
    }else if(instruction === 'all_defense'){
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
    }
    copy.liveInstruction = instruction;
    copy.liveInstructionLabel = liveInstructionLabel(instruction);
    return copy;
  }
  function liveInstructionConditionDelta(value){
    if(value === 'all_attack') return -1;
    if(value === 'huevos') return 0;
    if(value === 'hold_result') return 0;
    if(value === 'all_defense') return 1;
    return 0;
  }
  function ensureLiveTacticShape(tactic, clubId){
    const next = { ...(tactic || {}) };
    next.formation = next.formation || '4-4-2';
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
    tactic.starters = Array.isArray(starterOrder) ? starters.slice(0, 11) : optimizeLiveStartersForFormation(starters, cleanFormation);
    tactic.autoSubs = [];
    liveSetTacticForClub(session, clubId, tactic);
    return true;
  }
  function liveBaseCondition(playerId){
    try{ return simClamp(Number(currentCondition(playerId) || 75), 1, 100); }
    catch(_){ return 75; }
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
    const instructionLoad = ({ all_attack:0.045, huevos:0.000, hold_result:-0.010, all_defense:0.000, push:0.025, lower:-0.018 })[instruction] || 0;
    const instructionMultiplier = instruction === 'huevos' ? 1.20 : 1.00;
    const base = 0.055 + (100 - resistance) * 0.0018 + (100 - genetics) * 0.0012;
    return simClamp((base + instructionLoad) * posLoad * LIVE_FATIGUE_MULTIPLIER * instructionMultiplier, 0.07, 0.72);
  }
  function applyLiveMinuteFatigue(session, clubId, instruction='none'){
    if(!session) return;
    session.liveConditionDeltas = session.liveConditionDeltas || {};
    const tactic = liveTacticForClub(session, clubId);
    (tactic?.starters || []).map(Number).filter(Boolean).forEach(id => {
      if(liveIsUnavailableForPlay(session, id)) return;
      const player = playerById(id);
      if(!player) return;
      session.liveConditionDeltas[id] = Number(session.liveConditionDeltas[id] || 0) - liveFatiguePerMinute(player, instruction);
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
  function liveSentOffIds(session){
    return new Set(Object.keys(session?.sentOffByPlayer || {}).map(Number).filter(Boolean));
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
  function liveBotSubPressure(session, minute, usedCount){
    if(usedCount >= 3) return 999;
    if(minute < 45) return 999;
    if(minute >= 84) return usedCount < 3 ? 18 : 999;
    if(minute >= 78) return usedCount < 3 ? 24 : 999;
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
    if(usedCount >= 3) return [];
    const tactic = liveTacticForClub(session, clubId);
    if(!tactic?.starters?.length || !tactic?.bench?.length) return [];
    const slots = liveFormationSlots(tactic.formation || '4-4-2');
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
    const slots = liveFormationSlots(tactic?.formation || '4-4-2');
    const slot = slots[index] || playerById(playerId)?.position || 'MC';
    if(Number(clubId) === ownId){
      session.injuryPauseRequest = { clubId, playerId, minute:Number(minute || injury.minute || 0), canSub:liveUsedSubCount(session, clubId) < 3 };
      return [];
    }
    if(!LIVE_BOT_INJURY_SUB_ENABLED || liveUsedSubCount(session, clubId) >= 3) return [];
    const replacement = chooseBenchForInjuredBot(session, clubId, playerId, slot, minute);
    if(!replacement) return [];
    return applyLiveSubstitutions(session, clubId, [{ outId:playerId, inId:replacement.id, trigger:'injury', manual:false }], Math.max(1, Number(minute || injury.minute || 0)));
  }

  function livePlayedSet(session, clubId){
    return liveSideKey(session, clubId) === 'home' ? session.playedIdsHome : session.playedIdsAway;
  }
  function liveTotalsForSide(session, side){ return side === 'home' ? session.homeTotals : session.awayTotals; }
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
      if(usedSubs.length >= 3) break;
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
      const event = { clubId, outId, inId, minute, trigger:raw?.trigger || 'manual', manual:raw?.manual !== false };
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
    const yellowCount = simClamp(probabilisticRoundV2((Math.max(0, Number(fouls || 0)) * SIM_CARD_RATE_MULTIPLIER) / 3.4), 0, 2);
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
    const directChance = simClamp(((power.aggression - 62) / 900) * SIM_CARD_RATE_MULTIPLIER, 0.0005, 0.045);
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
      const chance = injuryChanceForPlayer(player.id, context.pitch) * blockDurationFactor(block) * 0.90;
      if(Math.random() < chance){
        const injury = pickInjuryType();
        const matchesOut = Math.floor(simRnd(injury.minTurns, injury.maxTurns + 1));
        injuries.push({
          clubId,
          playerId:player.id,
          type:'injury',
          name:injury.name,
          injuryLabel:injury.name,
          probability:injury.probability,
          chance:Math.round(chance * 100),
          matchesOut,
          minute:Math.floor(simRnd(block.from, block.to + 1)),
          phase:'durante'
        });
      }
    });
    return injuries.sort((a,b)=>a.minute-b.minute);
  }
  function liveFinalizeStats(stats, blockCount){
    const divisor = Math.max(1, Number(blockCount || LIVE_BLOCKS.length));
    return {
      attacks:simClamp(Math.round(stats.attacks), 1, 75),
      chances:simClamp(Math.round(stats.chances), 0, 18),
      possession:simClamp(Math.round(stats.possessionWeighted / divisor), 20, 80),
      fouls:simClamp(Math.round(stats.fouls), 0, 32),
      passScore:simClamp(Math.round(stats.passScore / divisor), 1, 140),
      xg:Number(stats.xg.toFixed(2)),
      keySaves:Math.round(Number(stats.keySaves || 0)),
      errors:Math.round(Number(stats.errors || 0)),
      goalErrors:Math.round(Number(stats.goalErrors || 0))
    };
  }
  function liveCurrentStats(stats, simulatedPhases){
    const phases = Math.max(0, Number(simulatedPhases || 0));
    const divisor = Math.max(1, phases);
    return {
      attacks:simClamp(Math.round(Number(stats.attacks || 0)), 0, 75),
      chances:simClamp(Math.round(Number(stats.chances || 0)), 0, 18),
      possession:phases > 0 ? simClamp(Math.round(Number(stats.possessionWeighted || 0) / divisor), 20, 80) : 50,
      fouls:simClamp(Math.round(Number(stats.fouls || 0)), 0, 32),
      passScore:phases > 0 ? simClamp(Math.round(Number(stats.passScore || 0) / divisor), 1, 140) : 0,
      xg:Number(Number(stats.xg || 0).toFixed(2)),
      keySaves:Math.round(Number(stats.keySaves || 0)),
      errors:Math.round(Number(stats.errors || 0)),
      goalErrors:Math.round(Number(stats.goalErrors || 0))
    };
  }
  function livePowerPair(session){
    const conditionResolver = id => liveEffectiveCondition(session, id);
    const sentOffIds = liveUnavailableIds(session);
    const home = teamPowerV2(session.match.homeId, session.homeTactic, { crowdBonus:session.matchContext.homeCrowdBonus || 0, conditionResolver, sentOffIds });
    const away = teamPowerV2(session.match.awayId, session.awayTactic, { crowdBonus:0, conditionResolver, sentOffIds });
    return { home, away };
  }
  function createLiveMatchSession(match){
    const homeTactic = ensureLiveTacticShape(getTacticForClubV2(match.homeId), match.homeId);
    const awayTactic = ensureLiveTacticShape(getTacticForClubV2(match.awayId), match.awayId);
    applyTacticCohesionPenalty(match.homeId, homeTactic);
    applyTacticCohesionPenalty(match.awayId, awayTactic);
    const matchContext = makeMatchContextV2(match);
    const powers = livePowerPair({ match, homeTactic, awayTactic, matchContext });
    return {
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
      instructionConditionDeltas:{},
      liveConditionDeltas:{},
      instructionLog:[],
      finished:false
    };
  }
  function addLiveInstructionCondition(session, clubId, instruction){
    const delta = liveInstructionConditionDelta(instruction);
    if(!delta) return;
    const tactic = liveTacticForClub(session, clubId);
    (tactic?.starters || []).map(Number).filter(Boolean).forEach(id => {
      if(liveIsUnavailableForPlay(session, id)) return;
      session.instructionConditionDeltas[id] = Number(session.instructionConditionDeltas[id] || 0) + delta;
    });
  }
  function simulateLiveBlock(session, options={}){
    if(!session || session.finished) return null;
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
    if(Number(session.match.homeId) === ownId) home = applyLiveInstructionToPower(home, instruction);
    if(Number(session.match.awayId) === ownId) away = applyLiveInstructionToPower(away, instruction);
    const homeInstruction = Number(session.match.homeId) === ownId ? 'normal' : instructionForScore(session.homeTactic, session.homeGoals, session.awayGoals);
    const awayInstruction = Number(session.match.awayId) === ownId ? 'normal' : instructionForScore(session.awayTactic, session.awayGoals, session.homeGoals);
    const h = blockStatsForTeam(home, away, session.matchContext, homeInstruction, awayInstruction, true, block);
    const a = blockStatsForTeam(away, home, session.matchContext, awayInstruction, homeInstruction, false, block);
    mergeBlockStats(session.homeTotals, h);
    mergeBlockStats(session.awayTotals, a);
    const hBaseProb = h.chances > 0 ? simClamp(h.xg / Math.max(1, h.chances), 0.025, 0.70) : 0;
    const aBaseProb = a.chances > 0 ? simClamp(a.xg / Math.max(1, a.chances), 0.025, 0.70) : 0;
    for(let i=0;i<h.chances;i++){
      const goal = resolveChanceV2(home, away, session.match.homeId, session.match.awayId, Math.floor(simRnd(block.from, block.to + 1)), hBaseProb, session.homeTotals, session.awayTotals, session);
      if(goal){ session.goals.push(goal); session.homeGoals++; }
    }
    for(let i=0;i<a.chances;i++){
      const goal = resolveChanceV2(away, home, session.match.awayId, session.match.homeId, Math.floor(simRnd(block.from, block.to + 1)), aBaseProb, session.awayTotals, session.homeTotals, session);
      if(goal){ session.goals.push(goal); session.awayGoals++; }
    }
    const friendlyNoSanctions = Boolean(session.match?.friendly);
    const cards = friendlyNoSanctions ? [] : [
      ...liveCardsForBlock(session, session.match.homeId, home, h.fouls, block),
      ...liveCardsForBlock(session, session.match.awayId, away, a.fouls, block)
    ].sort((x,y)=>x.minute-y.minute);
    cards.forEach(card => {
      session.cards.push(card);
      if(isRedCardType(card.type)) removePlayerFromLiveTactic(session, card.clubId, card.playerId, 'red');
    });
    const defaultLoss = defaultLossByRedCards(session.cards, session.match.homeId, session.match.awayId);
    if(defaultLoss){
      applyDefaultLossToLiveSession(session, defaultLoss);
      return finishLiveMatchSession(session);
    }
    const injuries = friendlyNoSanctions ? [] : [
      ...liveInjuriesForBlock(session, session.match.homeId, home, session.matchContext, block),
      ...liveInjuriesForBlock(session, session.match.awayId, away, session.matchContext, block)
    ].sort((x,y)=>x.minute-y.minute);
    injuries.forEach(injury => {
      session.injuries.push(injury);
      handleLiveInjury(session, injury, injury.minute || block.from);
    });
    const homeAppliedInstruction = Number(session.match.homeId) === ownId ? instruction : homeInstruction;
    const awayAppliedInstruction = Number(session.match.awayId) === ownId ? instruction : awayInstruction;
    applyLiveMinuteFatigue(session, session.match.homeId, homeAppliedInstruction);
    applyLiveMinuteFatigue(session, session.match.awayId, awayAppliedInstruction);
    addLiveInstructionCondition(session, ownId, instruction);
    session.instructionLog.push({ minute:block.from, to:block.to, instruction, label:liveInstructionLabel(instruction) });
    session.currentMinute = Number(block.matchMinute || block.to);
    session.blockIndex += 1;
    if(session.blockIndex >= session.blocks.length) return finishLiveMatchSession(session);
    return livePublicState(session, { block, homeBlock:h, awayBlock:a, cards, injuries });
  }
  function livePublicLineup(session, clubId){
    const tactic = liveTacticForClub(session, clubId);
    const slots = FORMATIONS[tactic?.formation || '4-4-2'] || FORMATIONS['4-4-2'];
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
    const slots = FORMATIONS[tactic?.formation || '4-4-2'] || FORMATIONS['4-4-2'];
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
    const slots = liveFormationSlots(tactic.formation || '4-4-2');
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
    const regular = (tactic?.bench || []).map(id => playerById(id)).filter(Boolean).filter(player => !liveIsUnavailableForPlay(session, player.id)).map(player => ({ id:player.id, name:player.name, position:player.position, role:player.position, overall:effectiveOverall(player), condition:liveEffectiveCondition(session, player.id), morale:currentMorale(player.id), fit:100, expelled:false, injuredGhost:false }));
    const clubKey = String(clubId || '');
    const starters = new Set((tactic?.starters || []).map(Number).filter(Boolean));
    const already = new Set(regular.map(player => Number(player.id)));
    const injured = (session?.injuredGhostByClub?.[clubKey] || []).map(id => playerById(id)).filter(Boolean).filter(player => !already.has(Number(player.id)) && !starters.has(Number(player.id))).map(player => ({ id:player.id, name:player.name, position:player.position, role:'LES', overall:effectiveOverall(player), condition:0, morale:currentMorale(player.id), fit:0, expelled:false, injuredGhost:true, blocked:true }));
    injured.forEach(player => already.add(Number(player.id)));
    const expelled = (session?.expelledByClub?.[clubKey] || []).map(id => playerById(id)).filter(Boolean).filter(player => !already.has(Number(player.id))).map(player => ({ id:player.id, name:player.name, position:player.position, role:'EXP', overall:effectiveOverall(player), condition:liveEffectiveCondition(session, player.id), morale:currentMorale(player.id), fit:0, expelled:true, blocked:true }));
    return regular.concat(injured, expelled);
  }
  function liveStatsSnapshot(session){
    const played = livePlayedPhaseCount(session);
    const home = liveCurrentStats(session.homeTotals, played);
    const away = liveCurrentStats(session.awayTotals, played);
    away.possession = 100 - home.possession;
    return { home, away };
  }
  function livePublicState(session, extra={}){
    return {
      match:session.match,
      minute:session.currentMinute,
      period:liveCurrentPeriod(session),
      phaseIndex:Number(session.blockIndex || 0),
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
      homeBoardSlots:livePublicBoardSlots(session, session.match.homeId),
      awayBoardSlots:livePublicBoardSlots(session, session.match.awayId),
      ownBoardSlots:livePublicBoardSlots(session, game?.selectedClubId || 0),
      homeBench:livePublicBench(session, session.match.homeId),
      awayBench:livePublicBench(session, session.match.awayId),
      ownBench:livePublicBench(session, game?.selectedClubId || 0),
      homeFormation:session.homeTactic?.formation || '4-4-2',
      awayFormation:session.awayTactic?.formation || '4-4-2',
      ownFormation:liveTacticForClub(session, game?.selectedClubId || 0)?.formation || '4-4-2',
      availableFormations:liveFormationKeys(),
      usedSubs:(session.usedSubs[String(game?.selectedClubId || 0)] || []).length,
      usedSubsHome:(session.usedSubs[String(session.match.homeId)] || []).length,
      usedSubsAway:(session.usedSubs[String(session.match.awayId)] || []).length,
      maxSubs:3,
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
      engine:'simulador-vivo-tactico-v5.23',
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
      matchStats,
      matchContext:session.matchContext,
      playedIdsHome,
      playedIdsAway,
      instructionConditionDeltas:session.instructionConditionDeltas,
      liveBlocks:session.instructionLog,
      suspended:Boolean(session.suspended),
      defaultLoss:session.defaultLoss || null
    };
    if(!result.friendly){
      applyMatchCohesionResult(result, result.substitutions, result.cards);
      applyResultToTables(result, result.homeGoals, result.awayGoals);
      applyPlayerStats(result.homeId, playedIdsHome.map(playerById).filter(Boolean), result.substitutions, result.goals, result.cards, result.injuries, result.keySaves, result.errors);
      applyPlayerStats(result.awayId, playedIdsAway.map(playerById).filter(Boolean), result.substitutions, result.goals, result.cards, result.injuries, result.keySaves, result.errors);
      applyAvailability(result.cards, result.injuries);
      if(typeof updatePlayerStarTrackingForMatch === 'function') updatePlayerStarTrackingForMatch(result);
    }
    session.result = result;
    return result;
  }
  function simulateMatch(match){
    const homeTactic = getTacticForClubV2(match.homeId);
    const awayTactic = getTacticForClubV2(match.awayId);
    applyTacticCohesionPenalty(match.homeId, homeTactic);
    applyTacticCohesionPenalty(match.awayId, awayTactic);
    const matchContext = makeMatchContextV2(match);
    const home = teamPowerV2(match.homeId, homeTactic, { crowdBonus:matchContext.homeCrowdBonus || 0 });
    const away = teamPowerV2(match.awayId, awayTactic, { crowdBonus:0 });
    const homeTotals = emptyStats();
    const awayTotals = emptyStats();
    const incidents = { keySaves:[], errors:[] };
    const goals = [];
    let homeGoals = 0;
    let awayGoals = 0;
    for(const block of BLOCKS){
      const homeInstruction = instructionForScore(homeTactic, homeGoals, awayGoals);
      const awayInstruction = instructionForScore(awayTactic, awayGoals, homeGoals);
      const h = blockStatsForTeam(home, away, matchContext, homeInstruction, awayInstruction, true, block);
      const a = blockStatsForTeam(away, home, matchContext, awayInstruction, homeInstruction, false, block);
      mergeBlockStats(homeTotals, h);
      mergeBlockStats(awayTotals, a);
      let hGoals = 0;
      let aGoals = 0;
      const hBaseProb = h.chances > 0 ? simClamp(h.xg / Math.max(1, h.chances), 0.025, 0.70) : 0;
      const aBaseProb = a.chances > 0 ? simClamp(a.xg / Math.max(1, a.chances), 0.025, 0.70) : 0;
      for(let i=0;i<h.chances;i++){
        const goal = resolveChanceV2(home, away, match.homeId, match.awayId, Math.floor(simRnd(block.from, block.to + 1)), hBaseProb, homeTotals, awayTotals, incidents);
        if(goal){ goals.push(goal); hGoals++; }
      }
      for(let i=0;i<a.chances;i++){
        const goal = resolveChanceV2(away, home, match.awayId, match.homeId, Math.floor(simRnd(block.from, block.to + 1)), aBaseProb, awayTotals, homeTotals, incidents);
        if(goal){ goals.push(goal); aGoals++; }
      }
      homeGoals += hGoals;
      awayGoals += aGoals;
    }
    goals.sort((a,b)=>a.minute-b.minute);
    const matchStats = { home:finalizeStats(homeTotals), away:finalizeStats(awayTotals) };
    matchStats.away.possession = 100 - matchStats.home.possession;
    const cards = [...makeCardsV2(match.homeId, home, matchStats.home.fouls), ...makeCardsV2(match.awayId, away, matchStats.away.fouls)].sort((a,b)=>a.minute-b.minute);
    const defaultLoss = defaultLossByRedCards(cards, match.homeId, match.awayId);
    if(defaultLoss){
      homeGoals = Number(defaultLoss.homeGoals || 0);
      awayGoals = Number(defaultLoss.awayGoals || 0);
    }
    const injuries = defaultLoss ? [] : [...makeInjuriesV2(match.homeId, home, matchContext), ...makeInjuriesV2(match.awayId, away, matchContext)].sort((a,b)=>a.minute-b.minute);
    const regularSubs = [
      ...makeSubstitutions(match.homeId, homeTactic, goals),
      ...makeSubstitutions(match.awayId, awayTactic, goals)
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
    if(!match.friendly){
      applyMatchCohesionResult(match, substitutions, cards);
      applyResultToTables(match, homeGoals, awayGoals);
      applyPlayerStats(match.homeId, home.lineup, substitutions, goals, cards, injuries, incidents.keySaves, incidents.errors);
      applyPlayerStats(match.awayId, away.lineup, substitutions, goals, cards, injuries, incidents.keySaves, incidents.errors);
      applyAvailability(cards, injuries);
      if(typeof updatePlayerStarTrackingForMatch === 'function'){
        updatePlayerStarTrackingForMatch({ ...match, played:true, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves:incidents.keySaves, errors:incidents.errors, starterIdsHome, starterIdsAway, playedIdsHome, playedIdsAway });
      }
    }
    const instructionConditionDeltas = mergeConditionDeltas(
      instructionConditionDelta(homeTactic, homeGoals, awayGoals, starterIdsHome),
      instructionConditionDelta(awayTactic, awayGoals, homeGoals, starterIdsAway),
      sectorStyleConditionDelta(home, starterIdsHome),
      sectorStyleConditionDelta(away, starterIdsAway)
    );
    return { ...match, played:true, engine:'simulador-2.0-jugadorista', starterIdsHome, starterIdsAway, homeGoals, awayGoals, goals, cards, injuries, substitutions, keySaves:incidents.keySaves, errors:incidents.errors, matchStats, matchContext, playedIdsHome, playedIdsAway, instructionConditionDeltas, suspended:Boolean(defaultLoss), defaultLoss:defaultLoss ? { ...defaultLoss, reason:'Cinco expulsiones' } : null };
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
    normalizeSectorStyles:normalizeSectorStylesV2
  };
})();
