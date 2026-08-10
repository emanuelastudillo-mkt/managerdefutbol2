/* V8.08 · Entrenamiento profesional. Extraído de 09-simulation-economy-training.js. */

function trainingOptionByValue(value){
  return TRAINING_OPTIONS.find(opt => opt.value === value) || null;
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
function currentTrainingDayIndex(){
  const date = validIsoDate(game?.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  if(!validIsoDate(date)) return 0;
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return Number.isFinite(day) ? clamp(Math.round(day), 0, 6) : 0;
}
function trainingScheduleSlots(options={}){
  const schedule = currentTrainingSchedule();
  const slots = [];
  const onlyCurrentDay = Boolean(options.currentDayOnly);
  const currentDay = currentTrainingDayIndex();
  TRAINING_DAY_LABELS.forEach((dayLabel, dayIndex) => {
    if(onlyCurrentDay && dayIndex !== currentDay) return;
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
  const gainMultiplier = (typeof isLegendPlayer === 'function' && isLegendPlayer(player)) ? LEGEND_TRAINING_SKILL_GAIN_MULTIPLIER : TRAINING_SKILL_GAIN_MULTIPLIER;
  const scaled = Math.max(0, Number(chanceScale || 0)) * gainMultiplier;
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
  const currentTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game.globalTurn || 0);
  const pauseUntil = Math.max(0, Number(game.lockerRoomTrainingPauseUntilTurn || 0));
  if(pauseUntil > currentTurn){
    game.lastTrainingApplied = { ...turnStamp(), skipped:true, reason:'locker_room_days_off', pauseUntilTurn:pauseUntil };
    return;
  }
  if(pauseUntil && pauseUntil <= currentTurn) game.lockerRoomTrainingPauseUntilTurn = 0;
  game.trainingPlan = normalizeIndividualTrainingPlan(game.trainingPlan);
  game.trainingSchedule = normalizeTrainingSchedule(game.trainingSchedule);
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  const squad = playersByClub(game.selectedClubId);
  const differentiatedPlayerId = typeof kinesiologistDifferentiatedPlayerId === 'function' ? kinesiologistDifferentiatedPlayerId() : 0;
  const trainingSquad = differentiatedPlayerId ? squad.filter(player => Number(player.id) !== Number(differentiatedPlayerId)) : squad;
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
  const slots = trainingScheduleSlots({ currentDayOnly: TRAINING_APPLY_CURRENT_DAY_ONLY });
  slots.forEach(item => {
    if(item.type === 'tactical'){
      tacticalGain += Math.random() < TEAM_COHESION_TACTICAL_TRAINING_CHANCE ? TEAM_COHESION_TACTICAL_TRAINING_GAIN : 0;
      return;
    }
    if(item.type === 'intense') intenseSessions += 1;
    if(item.type === 'massage') massageSessions += 1;
    trainingSquad.forEach(player => { generalSkillGains += applyTrainingSessionToPlayer(player, item.type, scale, conditionDraft, moraleDraft) || 0; });
  });
  if(TRAINING_INDIVIDUAL_ENABLED){
    for(let day=0; day<Math.max(1, DAYS_PER_ADVANCE); day += 1){
      trainingSquad.forEach(player => {
        const type = playerTrainingType(player.id);
        individualSkillGains += applyIndividualTrainingSessionToPlayer(player, type, individualScale, conditionDraft, moraleDraft);
        individualSessions += 1;
      });
    }
  }
  if(PLAYER_WEAR_ENABLED && (intenseSessions || massageSessions)){
    trainingSquad.forEach(player => {
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
  game.lastTrainingApplied = { ...turnStamp(), tacticalGain, intenseSessions, massageSessions, wearAdded, wearReduced, slotsApplied:slots.length, slotEffectiveness:TRAINING_SLOT_EFFECTIVENESS, generalSkillGains, individualSessions, individualSkillGains, totalSkillGains:generalSkillGains + individualSkillGains, individualSlotEffectiveness:TRAINING_INDIVIDUAL_SLOT_EFFECTIVENESS, differentiatedPlayerId:Number(differentiatedPlayerId || 0) };
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
      <div class="table-wrap"><table class="training-table"><thead><tr><th>${trainingColumnSort('Jugador', [['nombre_asc','A-Z'],['nombre_desc','Z-A'],['dorsal_asc','Dorsal ↑'],['dorsal_desc','Dorsal ↓']])}</th><th>${trainingColumnSort('POS', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th><th>${trainingColumnSort('Edad', [['edad_asc','Menor'],['edad_desc','Mayor']])}</th><th>${trainingColumnSort('Media', [['media_desc','Mayor'],['media_asc','Menor']])}</th><th>${trainingColumnSort('PJ', [['played_desc','Mayor'],['played_asc','Menor']])}</th><th>${trainingColumnSort('Estado físico', [['condicion_desc','Mayor'],['condicion_asc','Menor']])}</th><th>${trainingColumnSort('Moral', [['moral_desc','Mayor'],['moral_asc','Menor']])}</th><th>5º entrenamiento</th></tr></thead><tbody>
        ${squad.map(player => trainingPlayerRow(player)).join('')}
      </tbody></table></div>
    </div>
  `;
  prependFirstTeamTabs('training');
  bindSavedTrainingPlanButtons();
  document.querySelectorAll('[data-training-sort]').forEach(button => {
    button.addEventListener('click', () => {
      if(button.dataset.trainingSort){ trainingSort = button.dataset.trainingSort; renderTraining(); }
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
    playersByClub(game.selectedClubId).forEach(player => {
      if(typeof isKinesiologistDifferentiatedPlayer === 'function' && isKinesiologistDifferentiatedPlayer(player.id)) return;
      game.trainingPlan[player.id] = value;
    });
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
  const differentiated = typeof isKinesiologistDifferentiatedPlayer === 'function' && isKinesiologistDifferentiatedPlayer(player.id);
  const individualMarkup = differentiated
    ? `<div class="training-differentiated-status"><span class="pill ok">Trabajo diferenciado</span><span class="muted small">Sin entrenamiento general ni individual</span></div>`
    : `<select class="training-individual-select training-tone-${individualTrainingTone(individual)}" data-player-training="${player.id}">${individualTrainingOptionsMarkup(individual)}</select>`;
  return `<tr class="${differentiated ? 'training-player-differentiated' : ''}">
    <td><div class="training-player-cell">${faceImg(player,'training-face')}<button class="linklike" data-player-id="${player.id}">${availabilityIcons(player.id)}${escapeHtml(player.name)}</button></div></td>
    <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
    <td>${Number(player.age || 0) || '—'}</td>
    <td><strong>${visibleOverall(player)}</strong></td>
    <td><strong>${typeof playerStatValue === 'function' ? playerStatValue(player.id, 'played') : Number(game?.playerStats?.[player.id]?.played || 0)}</strong></td>
    <td>${conditionBar(player.id)}</td>
    <td>${moraleBar(player.id)}</td>
    <td>${individualMarkup}</td>
  </tr>`;
}

