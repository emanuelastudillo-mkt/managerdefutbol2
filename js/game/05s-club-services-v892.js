/* V8.92 · Convenios y servicios del club: hotel, transporte, concentraciones y prensa. */
(() => {
  'use strict';

  const VERSION = 1;
  const SERVICE_CATEGORIES = ['hotel', 'transport', 'press'];

  const HOTEL_OPTIONS = [
    {
      id:'hotel_basic', name:'Hotel funcional', level:'Básico', rate:.045, minimum:150000,
      image:'assets/instalaciones/hotel_funcional.png',
      amenities:'Habitaciones compartidas, alimentación deportiva y descanso básico.',
      effects:{ condition:1, morale:0, cohesion:0 }
    },
    {
      id:'hotel_comfort', name:'Hotel confort', level:'Confort', rate:.09, minimum:360000,
      image:'assets/instalaciones/hotel_confort.png',
      amenities:'Habitaciones individuales, pileta, sauna y recuperación guiada.',
      effects:{ condition:2, morale:1, cohesion:0 }
    },
    {
      id:'hotel_premium', name:'Hotel premium', level:'Premium', rate:.165, minimum:750000,
      image:'assets/instalaciones/hotel_premium.png',
      amenities:'Spa, pileta climatizada, sala recreativa y casino privado.',
      effects:{ condition:3, morale:2, cohesion:1 }
    }
  ];

  const TRANSPORT_OPTIONS = [
    {
      id:'transport_basic', name:'Transporte básico', level:'Básico', rate:.036, minimum:120000,
      image:'assets/instalaciones/transporte_basico.png',
      amenities:'Combis y micros convencionales para los traslados del plantel.',
      effects:{ condition:1, morale:0, cohesion:0 }
    },
    {
      id:'transport_executive', name:'Transporte ejecutivo', level:'Ejecutivo', rate:.084, minimum:300000,
      image:'assets/instalaciones/transporte_ejecutivo.png',
      amenities:'Micros premium y avión comercial para viajes largos.',
      effects:{ condition:2, morale:1, cohesion:0 }
    },
    {
      id:'transport_private', name:'Transporte privado', level:'Privado', rate:.15, minimum:660000,
      image:'assets/instalaciones/transporte_privado.png',
      amenities:'Charter o jet privado, traslados directos y máxima comodidad.',
      effects:{ condition:3, morale:1, cohesion:1 }
    }
  ];

  const PRESS_OPTIONS = [
    {
      id:'press_small', name:'Oficina pequeña', level:'Pequeña', rate:.06, minimum:240000,
      image:'assets/instalaciones/oficina_pequena.png',
      interval:30, players:3, fansFactor:.20, fansMin:5, fansMax:80,
      amenities:'Firmas de autógrafos y reuniones barriales con socios.',
      effects:{ fans:'small', morale:1, trust:0, cohesion:0, condition:-1 }
    },
    {
      id:'press_medium', name:'Oficina mediana', level:'Mediana', rate:.12, minimum:600000,
      image:'assets/instalaciones/oficina_mediana.png',
      interval:24, players:5, fansFactor:.35, fansMin:8, fansMax:150,
      amenities:'Entrenamientos abiertos, entrevistas y encuentros institucionales.',
      effects:{ fans:'normal', morale:1, trust:.5, cohesion:0, condition:-1 }
    },
    {
      id:'press_large', name:'Oficina grande', level:'Grande', rate:.21, minimum:1500000,
      image:'assets/instalaciones/oficina_grande.png',
      interval:18, players:7, fansFactor:.55, fansMin:12, fansMax:300,
      amenities:'Campañas nacionales, contenido audiovisual y jornadas con peñas.',
      effects:{ fans:'high', morale:1, trust:.5, cohesion:1, condition:-1 }
    },
    {
      id:'press_world', name:'Oficina mundial', level:'Mundial', rate:.33, minimum:3600000,
      image:'assets/instalaciones/oficina_mundial.png',
      interval:14, players:10, fansFactor:.80, fansMin:18, fansMax:500,
      amenities:'Campañas internacionales, grandes eventos y exposición global.',
      effects:{ fans:'very_high', morale:2, trust:.5, cohesion:1, condition:-2 }
    }
  ];

  const CONCENTRATION_OPTIONS = [
    {
      id:'concentration_history', name:'Historia e identidad del club',
      image:'assets/instalaciones/historia_e_identidad_del_club.png',
      dailyFactor:2.4, perPlayer:15000, minimum:450000,
      description:'Recorrido por instalaciones, museo, historia y encuentro con referentes del club.',
      effects:{ trust:.5, cohesion:2, morale:1, condition:-1 }
    },
    {
      id:'concentration_family', name:'Día de campo con familias',
      image:'assets/instalaciones/dia_de_campo_con_familias.png',
      dailyFactor:3.6, perPlayer:30000, minimum:900000,
      description:'Jornada recreativa, almuerzo familiar y actividades de integración.',
      effects:{ trust:1, cohesion:2, morale:3, condition:-1 }
    },
    {
      id:'concentration_closed', name:'Concentración cerrada',
      image:'assets/instalaciones/concentracion_cerrada.png',
      dailyFactor:5.4, perPlayer:54000, minimum:1500000,
      description:'Jornada exclusiva para jugadores y cuerpo técnico con reuniones internas.',
      effects:{ trust:1.5, cohesion:4, morale:1, condition:0 }
    }
  ];

  const OPTION_MAP = new Map(
    [...HOTEL_OPTIONS, ...TRANSPORT_OPTIONS, ...PRESS_OPTIONS, ...CONCENTRATION_OPTIONS]
      .map(option => [option.id, option])
  );

  function cfsNumber(value, fallback=0){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function cfsClamp(value, min, max){ return Math.max(min, Math.min(max, cfsNumber(value))); }
  function cfsToday(){
    if(typeof currentCalendarDate === 'function') return currentCalendarDate();
    return String(game?.currentDate || '');
  }
  function cfsSeason(){ return Math.max(1, Math.round(cfsNumber(game?.seasonNumber, 1))); }
  function cfsClubId(){ return Math.max(0, Math.round(cfsNumber(game?.selectedClubId, 0))); }
  function cfsMonthKey(date=cfsToday()){ return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.slice(0, 7) : `${cfsSeason()}-00`; }
  function cfsRoster(clubId=cfsClubId()){
    return typeof playersByClub === 'function' ? playersByClub(clubId) : (seed?.players || []).filter(player => Number(player.clubId) === Number(clubId));
  }
  function cfsAnnualPayroll(clubId=cfsClubId()){
    if(typeof totalClubSalary === 'function') return Math.max(0, cfsNumber(totalClubSalary(clubId)));
    return cfsRoster(clubId).reduce((sum, player) => sum + Math.max(0, cfsNumber(player?.salary)), 0);
  }
  function cfsMonthlyPayroll(clubId=cfsClubId()){ return cfsAnnualPayroll(clubId) / 12; }
  function cfsDailyPayroll(clubId=cfsClubId()){ return cfsAnnualPayroll(clubId) / 365; }
  function cfsRoundMoney(value){ return Math.max(0, Math.round(cfsNumber(value) / 1000) * 1000); }
  function cfsMonthlyCost(option, clubId=cfsClubId()){
    return cfsRoundMoney(Math.max(cfsNumber(option?.minimum), cfsMonthlyPayroll(clubId) * cfsNumber(option?.rate)));
  }
  function cfsConcentrationCost(option, clubId=cfsClubId()){
    const rosterCount = cfsRoster(clubId).length;
    return cfsRoundMoney(Math.max(
      cfsNumber(option?.minimum),
      cfsDailyPayroll(clubId) * cfsNumber(option?.dailyFactor) + rosterCount * cfsNumber(option?.perPlayer)
    ));
  }
  function cfsOption(category, id){
    const option = OPTION_MAP.get(String(id || '')) || null;
    if(!option) return null;
    if(category === 'hotel' && !HOTEL_OPTIONS.some(item => item.id === option.id)) return null;
    if(category === 'transport' && !TRANSPORT_OPTIONS.some(item => item.id === option.id)) return null;
    if(category === 'press' && !PRESS_OPTIONS.some(item => item.id === option.id)) return null;
    if(category === 'concentration' && !CONCENTRATION_OPTIONS.some(item => item.id === option.id)) return null;
    return option;
  }

  function cfsRoot(){
    if(!game) return null;
    game.clubServices = game.clubServices && typeof game.clubServices === 'object' && !Array.isArray(game.clubServices)
      ? game.clubServices
      : {};
    game.clubServices.version = VERSION;
    game.clubServices.clubs = game.clubServices.clubs && typeof game.clubServices.clubs === 'object' && !Array.isArray(game.clubServices.clubs)
      ? game.clubServices.clubs
      : {};
    return game.clubServices;
  }
  function cfsDefaultClubState(clubId){
    return {
      clubId:Number(clubId), season:cfsSeason(), hotel:null, transport:null, press:null,
      concentration:{ lastDate:'', lastType:'', seasonCount:0, activeDate:'', trainingReplaced:false, history:[] },
      processedTravelMatches:{}, pressHistory:[], history:[]
    };
  }
  function cfsClubState(clubId=cfsClubId()){
    const root = cfsRoot();
    if(!root || !clubId) return null;
    const key = String(clubId);
    const defaults = cfsDefaultClubState(clubId);
    const state = root.clubs[key] && typeof root.clubs[key] === 'object' && !Array.isArray(root.clubs[key])
      ? root.clubs[key]
      : {};
    Object.keys(defaults).forEach(prop => { if(state[prop] === undefined) state[prop] = defaults[prop]; });
    state.clubId = Number(clubId);
    state.concentration = state.concentration && typeof state.concentration === 'object' && !Array.isArray(state.concentration)
      ? state.concentration
      : {};
    Object.keys(defaults.concentration).forEach(prop => { if(state.concentration[prop] === undefined) state.concentration[prop] = defaults.concentration[prop]; });
    state.concentration.history = Array.isArray(state.concentration.history) ? state.concentration.history : [];
    state.processedTravelMatches = state.processedTravelMatches && typeof state.processedTravelMatches === 'object' && !Array.isArray(state.processedTravelMatches) ? state.processedTravelMatches : {};
    state.pressHistory = Array.isArray(state.pressHistory) ? state.pressHistory : [];
    state.history = Array.isArray(state.history) ? state.history : [];
    if(Number(state.season || 0) !== cfsSeason()){
      state.season = cfsSeason();
      state.hotel = null;
      state.transport = null;
      state.press = null;
      state.concentration = { ...defaults.concentration, history:state.concentration.history.slice(-40) };
      state.processedTravelMatches = {};
      state.pressHistory = state.pressHistory.slice(-40);
    }
    root.clubs[key] = state;
    return state;
  }

  function cfsEffectLevel(value){
    const amount = Math.abs(cfsNumber(value));
    if(amount <= 1) return 'small';
    if(amount <= 2) return 'normal';
    if(amount <= 3) return 'high';
    return 'very_high';
  }
  function cfsLevelLabel(level){
    return ({ small:'pequeña', normal:'normal', high:'alta', very_high:'muy alta' })[level] || 'normal';
  }
  function cfsEffectText(label, value, forcedLevel=''){
    const numeric = cfsNumber(value);
    if(!numeric && !forcedLevel) return '';
    const loss = numeric < 0;
    const level = forcedLevel || cfsEffectLevel(numeric);
    return `${label}: ${loss ? 'pérdida' : 'ganancia'} ${cfsLevelLabel(level)}`;
  }
  function cfsEffectsMarkup(option, category){
    const effects = option?.effects || {};
    const pieces = [];
    if(effects.fans) pieces.push(cfsEffectText('Hinchas', 1, effects.fans));
    if(effects.morale) pieces.push(cfsEffectText('Moral', effects.morale));
    if(effects.condition) pieces.push(cfsEffectText('Estado físico', effects.condition));
    if(effects.cohesion) pieces.push(cfsEffectText('Cohesión', effects.cohesion));
    if(effects.trust) pieces.push(cfsEffectText('Confianza', effects.trust));
    if(category === 'hotel' || category === 'transport'){
      if(!pieces.length) pieces.push('Recuperación pequeña del viaje');
    }
    return `<div class="club-service-effects">${pieces.filter(Boolean).map(text => `<span>${escapeHtml(text)}</span>`).join('')}</div>`;
  }

  function cfsRecordHistory(state, type, detail={}){
    if(!state) return;
    state.history.push({ type, season:cfsSeason(), date:cfsToday(), ...detail });
    state.history = state.history.slice(-80);
  }
  function cfsPushMessage(message){
    if(typeof pushGameMessage === 'function') pushGameMessage(message);
  }
  function cfsSave(){
    if(typeof saveLocal !== 'function') return;
    Promise.resolve(saveLocal(true)).catch(error => console.warn('No se pudo guardar el estado de los servicios del club.', error));
  }

  function cfsContractCurrentOption(state, category){
    const contract = state?.[category];
    return contract ? cfsOption(category, contract.optionId) : null;
  }
  function cfsSignContract(category, optionId){
    const state = cfsClubState();
    const option = cfsOption(category, optionId);
    if(!state || !option) return;
    const existingOption = cfsContractCurrentOption(state, category);
    if(existingOption?.id === option.id){
      showNotice('Ese convenio ya está activo.');
      return;
    }
    const newCost = cfsMonthlyCost(option);
    const oldCost = existingOption ? cfsMonthlyCost(existingOption) : 0;
    const initialCharge = existingOption ? Math.max(0, newCost - oldCost) : newCost;
    if(cfsNumber(game?.budget) < initialCharge){
      showNotice(`El club necesita ${formatMoney(initialCharge)} para activar este convenio.`);
      return;
    }
    const action = existingOption ? 'cambiar' : 'contratar';
    if(!confirm(`¿${action === 'cambiar' ? 'Cambiar' : 'Contratar'} ${option.name} por ${formatMoney(initialCharge)} ahora? El costo mensual será ${formatMoney(newCost)}.`)) return;
    if(initialCharge > 0 && typeof recordBudgetChange === 'function'){
      recordBudgetChange(-initialCharge, `${existingOption ? 'Cambio' : 'Primer mes'} de ${option.name}`, { type:`club_service_${category}`, category, optionId:option.id, monthlyCost:newCost });
    }
    const today = cfsToday();
    state[category] = {
      optionId:option.id,
      startedDate:today,
      startedSeason:cfsSeason(),
      lastChargedMonth:cfsMonthKey(today),
      nextEventDate:category === 'press' && typeof addDaysToIsoDate === 'function' ? addDaysToIsoDate(today, option.interval) : ''
    };
    cfsRecordHistory(state, 'contract_signed', { category, optionId:option.id, initialCharge, monthlyCost:newCost });
    cfsPushMessage({
      type:'directiva', priority:'normal', title:'Nuevo convenio del club',
      body:`La directiva confirmó el acuerdo con ${option.name}. El servicio estará disponible hasta el cierre de la temporada y tendrá un costo mensual de ${formatMoney(newCost)}.`,
      id:`club-service-sign-${cfsSeason()}-${cfsClubId()}-${category}-${option.id}-${cfsToday()}`
    });
    cfsSave();
    renderStadiumFacilities();
    showNotice(`${option.name} quedó activo.`);
  }

  function cfsCancelContract(category){
    const state = cfsClubState();
    const option = cfsContractCurrentOption(state, category);
    if(!state || !option) return;
    const penalty = cfsMonthlyCost(option) * 2;
    if(!confirm(`Cancelar ${option.name} implica una penalidad de ${formatMoney(penalty)}. ¿Continuar?`)) return;
    if(penalty > 0 && typeof recordBudgetChange === 'function'){
      recordBudgetChange(-penalty, `Cancelación anticipada de ${option.name}`, { type:`club_service_cancel_${category}`, category, optionId:option.id, penalty });
    }
    state[category] = null;
    cfsRecordHistory(state, 'contract_cancelled', { category, optionId:option.id, penalty });
    cfsPushMessage({
      type:'finance', priority:'normal', title:'Convenio cancelado',
      body:`El club rescindió el acuerdo con ${option.name}. La administración registró la penalidad correspondiente.`,
      id:`club-service-cancel-${cfsSeason()}-${cfsClubId()}-${category}-${cfsToday()}`
    });
    cfsSave();
    renderStadiumFacilities();
  }

  function cfsMatchDate(match, round=null){
    if(typeof scheduledDateForMatch === 'function') return scheduledDateForMatch(match, round);
    return String(match?.date || round?.date || '');
  }
  function cfsAllOwnMatches(){
    const clubId = cfsClubId();
    const result = [];
    (game?.fixtures || []).forEach(round => {
      (round?.matches || []).forEach(match => {
        if(Number(match?.homeId) === clubId || Number(match?.awayId) === clubId){
          result.push({ match, round, date:cfsMatchDate(match, round) });
        }
      });
    });
    return result;
  }
  function cfsHasOwnMatchOnDate(date){
    return cfsAllOwnMatches().some(item => item.date === date);
  }
  function cfsOwnMatchWithinDays(date, maximumDays=2){
    return cfsAllOwnMatches().some(item => {
      if(item.match?.played || !validIsoDate(item.date)) return false;
      const distance = daysBetweenIsoDates(date, item.date);
      return distance >= 0 && distance <= maximumDays;
    });
  }

  function cfsAdjustCondition(playerId, delta){
    if(!game || !playerId || !delta) return 0;
    game.playerCondition = game.playerCondition || {};
    const before = typeof currentCondition === 'function' ? cfsNumber(currentCondition(playerId), 50) : cfsNumber(game.playerCondition[playerId], 50);
    let effective = cfsNumber(delta);
    if(effective > 0 && before >= 95) effective = 0;
    else if(effective > 0 && before >= 90) effective = Math.max(0, effective - 1);
    const maxValue = typeof maxConditionForPlayer === 'function' ? cfsNumber(maxConditionForPlayer(playerId), 99) : 99;
    const after = cfsClamp(Math.round(before + effective), 0, maxValue);
    game.playerCondition[playerId] = after;
    return after - before;
  }
  function cfsAdjustMorale(playerId, delta){
    if(!game || !playerId || !delta) return 0;
    game.playerMorale = game.playerMorale || {};
    const before = typeof currentMorale === 'function' ? cfsNumber(currentMorale(playerId), 50) : cfsNumber(game.playerMorale[playerId], 50);
    let effective = cfsNumber(delta);
    if(effective > 0 && before >= 95) effective = 0;
    else if(effective > 0 && before >= 90) effective = Math.max(0, effective - 1);
    const after = cfsClamp(Math.round(before + effective), 1, 99);
    game.playerMorale[playerId] = after;
    return after - before;
  }
  function cfsAdjustCohesion(clubId, delta){
    if(!delta || typeof adjustTeamCohesion !== 'function') return 0;
    const before = typeof cohesionValue === 'function' ? cfsNumber(cohesionValue(clubId), 0) : 0;
    let effective = cfsNumber(delta);
    if(effective > 0 && before >= 90) effective = Math.max(.5, effective / 2);
    return adjustTeamCohesion(clubId, effective);
  }
  function cfsAdjustTrust(playerIds, delta, reason){
    if(!delta || !window.managerDressingRoom?.current) return 0;
    const stint = window.managerDressingRoom.current();
    if(!stint?.playerTrust) return 0;
    let changed = 0;
    (playerIds || []).forEach(playerId => {
      const entry = stint.playerTrust[playerId];
      if(!entry) return;
      const before = cfsNumber(entry.value, 50);
      let effective = cfsNumber(delta);
      if(effective > 0 && before >= 90) effective = Math.max(.2, effective / 2);
      const after = cfsClamp(Math.round((before + effective) * 10) / 10, 0, 100);
      if(after === before) return;
      entry.value = after;
      entry.lastChange = Math.round((after - before) * 10) / 10;
      entry.lastReason = reason;
      entry.updatedAt = cfsToday();
      changed += 1;
    });
    const values = Object.values(stint.playerTrust).map(entry => cfsNumber(entry?.value, 50));
    if(values.length) stint.generalTrust = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
    return changed;
  }

  function cfsApplyTravelServices(match){
    if(!game || !match || match.friendly) return null;
    const clubId = cfsClubId();
    if(!clubId || (Number(match.homeId) !== clubId && Number(match.awayId) !== clubId)) return null;
    const neutral = Boolean(match.neutralVenue || match?.matchContext?.neutralVenue || match?.competitionRules?.neutralVenue);
    const away = Number(match.awayId) === clubId;
    if(!away && !neutral) return null;
    const state = cfsClubState(clubId);
    const key = `${cfsSeason()}:${String(match.id || `${match.homeId}-${match.awayId}-${match.date || ''}`)}`;
    if(state.processedTravelMatches[key]) return null;
    const hotel = cfsContractCurrentOption(state, 'hotel');
    const transport = cfsContractCurrentOption(state, 'transport');
    if(!hotel && !transport) return null;
    state.processedTravelMatches[key] = true;
    const isHome = Number(match.homeId) === clubId;
    const ids = new Set([
      ...(isHome ? (match.playedIdsHome || match.starterIdsHome || []) : (match.playedIdsAway || match.starterIdsAway || [])),
      ...(isHome ? (match.starterIdsHome || []) : (match.starterIdsAway || []))
    ].map(Number).filter(Boolean));
    if(!ids.size) cfsRoster(clubId).slice(0, 18).forEach(player => ids.add(Number(player.id)));
    const combined = {
      condition:Math.min(5, cfsNumber(hotel?.effects?.condition) + cfsNumber(transport?.effects?.condition)),
      morale:Math.min(2, cfsNumber(hotel?.effects?.morale) + cfsNumber(transport?.effects?.morale)),
      cohesion:Math.min(1, cfsNumber(hotel?.effects?.cohesion) + cfsNumber(transport?.effects?.cohesion))
    };
    ids.forEach(playerId => {
      cfsAdjustCondition(playerId, combined.condition);
      cfsAdjustMorale(playerId, combined.morale);
    });
    cfsAdjustCohesion(clubId, combined.cohesion);
    cfsRecordHistory(state, 'travel_recovery', { matchId:match.id || '', hotel:hotel?.id || '', transport:transport?.id || '' });
    const serviceNames = [hotel?.name, transport?.name].filter(Boolean).join(' y ');
    cfsPushMessage({
      type:'employees', priority:'normal', title:'Informe de viaje del plantel',
      body:`El regreso con ${serviceNames} permitió una ${cfsLevelLabel(cfsEffectLevel(combined.condition))} recuperación del estado físico${combined.morale ? ` y una ganancia ${cfsLevelLabel(cfsEffectLevel(combined.morale))} de moral` : ''}.`,
      id:`club-service-travel-${key}`
    });
    return combined;
  }

  function cfsConcentrationAvailability(option){
    const state = cfsClubState();
    const today = cfsToday();
    if(!state || !validIsoDate(today)) return { allowed:false, reason:'No hay una fecha válida.' };
    if(cfsHasOwnMatchOnDate(today)) return { allowed:false, reason:'Hay un partido programado para hoy.' };
    if(state.concentration.activeDate === today) return { allowed:false, reason:'Ya se realizó una concentración hoy.' };
    if(Number(state.concentration.seasonCount || 0) >= 8) return { allowed:false, reason:'Se alcanzó el máximo de la temporada.' };
    if(validIsoDate(state.concentration.lastDate)){
      const elapsed = daysBetweenIsoDates(state.concentration.lastDate, today);
      if(elapsed < 14) return { allowed:false, reason:`Deben pasar ${14 - elapsed} día(s) para organizar otra concentración.` };
      if(state.concentration.lastType === option.id && elapsed < 30) return { allowed:false, reason:`Esta modalidad podrá repetirse en ${30 - elapsed} día(s).` };
    }
    return { allowed:true, reason:'' };
  }
  function cfsRunConcentration(optionId){
    const option = cfsOption('concentration', optionId);
    const state = cfsClubState();
    if(!option || !state) return;
    const availability = cfsConcentrationAvailability(option);
    if(!availability.allowed){ showNotice(availability.reason); return; }
    const cost = cfsConcentrationCost(option);
    if(cfsNumber(game?.budget) < cost){ showNotice(`El club necesita ${formatMoney(cost)} para organizar esta concentración.`); return; }
    if(!confirm(`Organizar ${option.name} hoy por ${formatMoney(cost)}? Reemplazará el entrenamiento del día.`)) return;
    if(typeof recordBudgetChange === 'function'){
      recordBudgetChange(-cost, option.name, { type:'club_special_concentration', optionId:option.id, players:cfsRoster().length });
    }
    const roster = cfsRoster();
    const playerIds = roster.map(player => Number(player.id)).filter(Boolean);
    playerIds.forEach(playerId => {
      cfsAdjustMorale(playerId, option.effects.morale);
      cfsAdjustCondition(playerId, option.effects.condition);
    });
    cfsAdjustCohesion(cfsClubId(), option.effects.cohesion);
    cfsAdjustTrust(playerIds, option.effects.trust, option.name);
    const today = cfsToday();
    state.concentration.lastDate = today;
    state.concentration.lastType = option.id;
    state.concentration.seasonCount = Math.max(0, Number(state.concentration.seasonCount || 0)) + 1;
    state.concentration.activeDate = today;
    state.concentration.trainingReplaced = false;
    state.concentration.history.push({ date:today, optionId:option.id, cost });
    state.concentration.history = state.concentration.history.slice(-30);
    cfsRecordHistory(state, 'concentration', { optionId:option.id, cost });
    cfsPushMessage({
      type:'employees', priority:'normal', title:'Concentración especial completada',
      body:`El plantel participó de ${option.name}. La actividad generó ${cfsEffectText('confianza', option.effects.trust)}, ${cfsEffectText('cohesión', option.effects.cohesion)} y ${cfsEffectText('moral', option.effects.morale)}${option.effects.condition ? `, con ${cfsEffectText('estado físico', option.effects.condition)}` : ''}.`,
      id:`club-service-concentration-${cfsSeason()}-${cfsClubId()}-${today}`
    });
    cfsSave();
    renderStadiumFacilities();
    showNotice(`${option.name} completada. El entrenamiento del día fue reemplazado.`);
  }

  function cfsChargeMonthlyServices(){
    const state = cfsClubState();
    if(!state) return 0;
    const month = cfsMonthKey();
    let total = 0;
    SERVICE_CATEGORIES.forEach(category => {
      const contract = state[category];
      const option = cfsContractCurrentOption(state, category);
      if(!contract || !option || contract.lastChargedMonth === month) return;
      const cost = cfsMonthlyCost(option);
      if(cost > 0 && typeof recordBudgetChange === 'function'){
        recordBudgetChange(-cost, `Mensualidad de ${option.name}`, { type:`club_service_monthly_${category}`, category, optionId:option.id, month });
        total += cost;
      }
      contract.lastChargedMonth = month;
    });
    if(total > 0){
      cfsPushMessage({
        type:'finance', priority:'normal', title:'Convenios del club',
        body:`La administración debitó ${formatMoney(total)} por los convenios de hotel, transporte y comunicación vigentes.`,
        id:`club-service-monthly-${cfsSeason()}-${cfsClubId()}-${month}`
      });
    }
    return total;
  }

  function cfsPressParticipants(option){
    return cfsRoster().filter(player => {
      const injured = typeof isInjured === 'function' && isInjured(player.id);
      const condition = typeof currentCondition === 'function' ? currentCondition(player.id) : 99;
      return !injured && Number(condition) >= 35;
    }).sort((a,b) => {
      const conditionA = typeof currentCondition === 'function' ? currentCondition(a.id) : 50;
      const conditionB = typeof currentCondition === 'function' ? currentCondition(b.id) : 50;
      return conditionB - conditionA || cfsNumber(b.reputation) - cfsNumber(a.reputation) || Number(a.id) - Number(b.id);
    }).slice(0, option.players);
  }
  function cfsProcessPressEvent(){
    const state = cfsClubState();
    const option = cfsContractCurrentOption(state, 'press');
    const contract = state?.press;
    const today = cfsToday();
    if(!state || !option || !contract || !validIsoDate(today)) return null;
    if(!validIsoDate(contract.nextEventDate)) contract.nextEventDate = addDaysToIsoDate(today, option.interval);
    if(daysBetweenIsoDates(contract.nextEventDate, today) < 0) return null;
    if(cfsHasOwnMatchOnDate(today) || cfsOwnMatchWithinDays(today, 2)) return null;
    const participants = cfsPressParticipants(option);
    if(!participants.length){
      contract.nextEventDate = addDaysToIsoDate(today, 3);
      return null;
    }
    const currentFans = typeof clubFansCurrent === 'function' ? clubFansCurrent(cfsClubId()) : 0;
    const gain = Math.round(cfsClamp(Math.sqrt(Math.max(1, currentFans)) * option.fansFactor, option.fansMin, option.fansMax));
    if(typeof setClubFansCurrent === 'function') setClubFansCurrent(cfsClubId(), currentFans + gain, option.name);
    const ids = participants.map(player => Number(player.id));
    ids.forEach(playerId => {
      cfsAdjustMorale(playerId, option.effects.morale);
      cfsAdjustCondition(playerId, option.effects.condition);
    });
    cfsAdjustTrust(ids, option.effects.trust, `Actividad organizada por ${option.name}`);
    cfsAdjustCohesion(cfsClubId(), option.effects.cohesion);
    contract.nextEventDate = addDaysToIsoDate(today, option.interval);
    state.pressHistory.push({ date:today, optionId:option.id, players:ids, fans:gain });
    state.pressHistory = state.pressHistory.slice(-50);
    cfsRecordHistory(state, 'press_event', { optionId:option.id, players:ids.length, fans:gain });
    cfsPushMessage({
      type:'directiva', priority:'normal', title:'Actividad con hinchas',
      body:`${option.name} organizó una jornada con ${participants.map(player => player.name).join(', ')}. La acción generó una ganancia ${cfsLevelLabel(option.effects.fans)} de hinchas y ${cfsEffectText('moral', option.effects.morale)}. La exposición produjo también ${cfsEffectText('estado físico', option.effects.condition)} en los jugadores participantes.`,
      id:`club-service-press-${cfsSeason()}-${cfsClubId()}-${today}`
    });
    return { fans:gain, players:ids.length };
  }

  function cfsServiceVisual(option){
    const path = String(option?.image || '').trim();
    if(!path) return '';
    return `<div class="club-service-visual"><img src="${escapeHtml(path)}" alt="${escapeHtml(option?.name || 'Servicio del club')}" loading="lazy"></div>`;
  }

  function cfsServiceCard(category, option, activeId){
    const active = activeId === option.id;
    const cost = cfsMonthlyCost(option);
    return `<article class="card club-service-option ${active ? 'is-active' : ''}">
      ${cfsServiceVisual(option)}
      <div class="row club-service-option-head"><div><p class="label">${escapeHtml(option.level)}</p><h4>${escapeHtml(option.name)}</h4></div>${active ? '<span class="pill ok">Activo</span>' : ''}</div>
      <p class="muted small">${escapeHtml(option.amenities)}</p>
      ${cfsEffectsMarkup(option, category)}
      <div class="row club-service-option-foot"><strong>${formatMoney(cost)}/mes</strong><button type="button" class="${active ? 'ghost' : 'primary'} small-btn" ${active ? `data-cfs-cancel="${category}"` : `data-cfs-sign="${category}" data-cfs-option="${option.id}"`}>${active ? 'Cancelar' : activeId ? 'Cambiar' : 'Contratar'}</button></div>
    </article>`;
  }
  function cfsConcentrationCard(option){
    const cost = cfsConcentrationCost(option);
    const availability = cfsConcentrationAvailability(option);
    return `<article class="card club-service-option club-concentration-option">
      ${cfsServiceVisual(option)}
      <div class="row club-service-option-head"><div><p class="label">Acción puntual</p><h4>${escapeHtml(option.name)}</h4></div><span class="pill">Hoy</span></div>
      <p class="muted small">${escapeHtml(option.description)}</p>
      ${cfsEffectsMarkup(option, 'concentration')}
      <div class="row club-service-option-foot"><strong>${formatMoney(cost)}</strong><button type="button" class="primary small-btn" data-cfs-concentration="${option.id}" ${availability.allowed ? '' : 'disabled'}>Organizar</button></div>
      ${availability.allowed ? '' : `<p class="muted small club-service-blocked">${escapeHtml(availability.reason)}</p>`}
    </article>`;
  }
  function cfsServicesMarkup(){
    const state = cfsClubState();
    if(!state) return '';
    const hotelActive = state.hotel?.optionId || '';
    const transportActive = state.transport?.optionId || '';
    const pressActive = state.press?.optionId || '';
    return `<section class="club-services-section">
      <div class="row section-title club-services-title"><div><h3>Convenios y servicios</h3><p class="tagline">Servicios institucionales que acompañan viajes, convivencia, comunicación y recuperación del plantel.</p></div><span class="pill">${Number(state.concentration.seasonCount || 0)}/8 concentraciones</span></div>
      <div class="card club-service-group"><div class="row"><div><p class="label">Viajes</p><h3>Convenio con hotel</h3></div><span class="pill">Hasta fin de temporada</span></div><div class="club-service-grid">${HOTEL_OPTIONS.map(option => cfsServiceCard('hotel', option, hotelActive)).join('')}</div></div>
      <div class="card club-service-group"><div class="row"><div><p class="label">Logística</p><h3>Convenio de transporte</h3></div><span class="pill">Hasta fin de temporada</span></div><div class="club-service-grid">${TRANSPORT_OPTIONS.map(option => cfsServiceCard('transport', option, transportActive)).join('')}</div></div>
      <div class="card club-service-group"><div class="row"><div><p class="label">Plantel</p><h3>Concentración especial</h3></div><span class="pill">Reemplaza el entrenamiento</span></div><div class="club-service-grid">${CONCENTRATION_OPTIONS.map(cfsConcentrationCard).join('')}</div></div>
      <div class="card club-service-group"><div class="row"><div><p class="label">Institucional</p><h3>Oficina de prensa y marketing</h3></div><span class="pill">Actividades automáticas</span></div><div class="club-service-grid club-service-grid-four">${PRESS_OPTIONS.map(option => cfsServiceCard('press', option, pressActive)).join('')}</div></div>
    </section>`;
  }
  function cfsBindActions(){
    document.querySelectorAll('[data-cfs-sign]').forEach(button => button.addEventListener('click', () => cfsSignContract(button.dataset.cfsSign, button.dataset.cfsOption)));
    document.querySelectorAll('[data-cfs-cancel]').forEach(button => button.addEventListener('click', () => cfsCancelContract(button.dataset.cfsCancel)));
    document.querySelectorAll('[data-cfs-concentration]').forEach(button => button.addEventListener('click', () => cfsRunConcentration(button.dataset.cfsConcentration)));
  }

  function cfsInstallHooks(){
    if(typeof renderStadiumFacilities === 'function'){
      const originalRenderStadiumFacilities = renderStadiumFacilities;
      renderStadiumFacilities = function(){
        const result = originalRenderStadiumFacilities();
        const grid = document.querySelector('.stadium-facilities-grid');
        if(grid && !document.querySelector('.club-services-section')) grid.insertAdjacentHTML('afterend', cfsServicesMarkup());
        cfsBindActions();
        return result;
      };
    }
    if(typeof updateManagerMatchStats === 'function'){
      const originalUpdateManagerMatchStats = updateManagerMatchStats;
      updateManagerMatchStats = function(match){
        const result = originalUpdateManagerMatchStats(match);
        cfsApplyTravelServices(match);
        return result;
      };
    }
    if(typeof processDailyCalendarState === 'function'){
      const originalProcessDailyCalendarState = processDailyCalendarState;
      processDailyCalendarState = function(dateAfter='', options={}){
        const state = cfsClubState();
        const beforeDate = cfsToday();
        const replaceTraining = Boolean(state?.concentration?.activeDate === beforeDate && !state?.concentration?.trainingReplaced);
        const result = originalProcessDailyCalendarState(dateAfter, replaceTraining ? { ...options, skipTraining:true } : options) || {};
        if(replaceTraining && state?.concentration){
          state.concentration.trainingReplaced = true;
          result.specialConcentrationTrainingReplaced = true;
        }
        result.clubServiceMonthlyCharge = cfsChargeMonthlyServices();
        result.clubServicePressEvent = cfsProcessPressEvent();
        return result;
      };
    }
  }

  cfsInstallHooks();
  window.clubServicesV892 = {
    version:VERSION,
    catalog:{ hotel:HOTEL_OPTIONS, transport:TRANSPORT_OPTIONS, press:PRESS_OPTIONS, concentration:CONCENTRATION_OPTIONS },
    ensure:cfsClubState,
    monthlyCost:cfsMonthlyCost,
    concentrationCost:cfsConcentrationCost,
    sign:cfsSignContract,
    cancel:cfsCancelContract,
    concentrate:cfsRunConcentration,
    processTravel:cfsApplyTravelServices,
    processPress:cfsProcessPressEvent
  };
})();
