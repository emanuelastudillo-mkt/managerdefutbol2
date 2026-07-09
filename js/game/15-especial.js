/* V3.38 · Menú ESPECIAL: cartas activas persistentes y detalle de bonus activo. */

let specialPackOpeningInProgress = false;
let specialPointsAnimation = null;

function specialDatabase(){
  return specialSkillsDatabase && typeof specialSkillsDatabase === 'object' ? specialSkillsDatabase : { limites:{}, sobres:{}, cartas_base:[], puntos_ocultos:{ acciones:{} }, destruir_cartas:{ recuperacion_puntos:{} }, apilamiento_bonus:{} };
}
function specialLimits(){
  const db = specialDatabase();
  return {
    activeMax: Math.max(1, Math.round(Number(db.limites?.cartas_activas_max || 5))),
    reserveMax: Math.max(1, Math.round(Number(db.limites?.cartas_reserva_max || 50))),
    lockDays: Math.max(0, Math.round(Number(db.limites?.dias_bloqueo_cambio_cartas || 100))),
    allowOpenWhenReserveFull: db.limites?.permitir_abrir_sobres_con_reserva_llena === true,
    allowRepeatedActive: db.limites?.permitir_cartas_repetidas_activas !== false,
    stackBonuses: db.limites?.bonus_se_apilan !== false
  };
}
function createInitialSpecialState(managerName=''){
  return {
    manager_id: game?.saveCode || '',
    nombre_manager: managerName || storedManagerName() || '',
    puntos_habilidad: 0,
    cartas_activas: [],
    cartas_reserva: [],
    fecha_ultimo_cambio_cartas: null,
    bloqueado_hasta: null,
    historial_ultimas_cartas: [],
    puntos_log: []
  };
}
function normalizeSpecialCard(card, index=0){
  if(!card || typeof card !== 'object') return null;
  const base = specialCardBaseById(card.id_base || card.baseId) || {};
  const id = String(card.id_carta || card.id || `CARD-${Date.now()}-${index}-${hashNumber(JSON.stringify(card), 100000)}`);
  const activatedTurn = Number.isFinite(Number(card.activada_en_turno ?? card.activatedTurn)) ? Math.max(0, Math.round(Number(card.activada_en_turno ?? card.activatedTurn))) : null;
  const lockedUntilTurn = Number.isFinite(Number(card.bloqueada_hasta_turno ?? card.lockedUntilTurn)) ? Math.max(0, Math.round(Number(card.bloqueada_hasta_turno ?? card.lockedUntilTurn))) : null;
  return {
    id_carta:id,
    id_base:String(card.id_base || base.id_base || ''),
    manager_id:String(card.manager_id || game?.saveCode || ''),
    nombre:String(card.nombre || base.nombre || 'Carta'),
    rareza:String(card.rareza || base.rareza || 'inutil'),
    tipo_bonus:card.tipo_bonus ?? base.tipo_bonus ?? null,
    valor_bonus:Number(card.valor_bonus ?? base.valor_bonus ?? 0) || 0,
    unidad:String(card.unidad || base.unidad || ''),
    activable:card.activable !== undefined ? Boolean(card.activable) : Boolean(base.activable),
    texto:String(card.texto || base.texto || ''),
    activa:Boolean(card.activa),
    destruida:Boolean(card.destruida),
    obtenida_en_turno:card.obtenida_en_turno ?? currentTurnIndex(),
    obtenida_desde_sobre:String(card.obtenida_desde_sobre || ''),
    activada_en:validIsoDate(card.activada_en) ? card.activada_en : null,
    bloqueada_hasta:validIsoDate(card.bloqueada_hasta) ? card.bloqueada_hasta : null,
    activada_en_turno:activatedTurn,
    bloqueada_hasta_turno:lockedUntilTurn
  };
}
function normalizeSpecialState(state=null, managerName=''){
  const base = createInitialSpecialState(managerName);
  const source = state && typeof state === 'object' ? state : {};
  const normalized = { ...base, ...source };
  normalized.manager_id = String(normalized.manager_id || game?.saveCode || '');
  normalized.nombre_manager = String(normalized.nombre_manager || managerName || storedManagerName() || 'Manager');
  normalized.puntos_habilidad = Math.max(0, Math.round(Number(normalized.puntos_habilidad || 0)));
  const active = Array.isArray(normalized.cartas_activas) ? normalized.cartas_activas : [];
  const reserve = Array.isArray(normalized.cartas_reserva) ? normalized.cartas_reserva : [];
  normalized.cartas_activas = active.map((card, index) => normalizeSpecialCard(card, index)).filter(Boolean).map(card => {
    const activeCard = { ...card, activa:true, destruida:false };
    if(!validIsoDate(activeCard.activada_en) && validIsoDate(normalized.fecha_ultimo_cambio_cartas)) activeCard.activada_en = normalized.fecha_ultimo_cambio_cartas;
    if(validIsoDate(activeCard.activada_en) && !validIsoDate(activeCard.bloqueada_hasta)) activeCard.bloqueada_hasta = addDaysToIsoDate(activeCard.activada_en, specialLimits().lockDays);
    normalizeSpecialCardLockTurns(activeCard);
    return activeCard;
  });
  normalized.cartas_reserva = reserve.map((card, index) => normalizeSpecialCard(card, index)).filter(Boolean).filter(card => !card.destruida).map(card => ({ ...card, activa:false }));
  normalized.historial_ultimas_cartas = Array.isArray(normalized.historial_ultimas_cartas)
    ? normalized.historial_ultimas_cartas.map((card, index) => normalizeSpecialCard(card, index)).filter(Boolean).slice(0, 30)
    : [];
  normalized.puntos_log = Array.isArray(normalized.puntos_log) ? normalized.puntos_log.slice(-80) : [];
  normalized.fecha_ultimo_cambio_cartas = validIsoDate(normalized.fecha_ultimo_cambio_cartas) ? normalized.fecha_ultimo_cambio_cartas : null;
  normalized.bloqueado_hasta = validIsoDate(normalized.bloqueado_hasta) ? normalized.bloqueado_hasta : null;
  return normalized;
}
function repairSpecialReserveFromHistory(state){
  if(!state || !Array.isArray(state.historial_ultimas_cartas) || !state.historial_ultimas_cartas.length) return 0;
  state.cartas_reserva = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  state.cartas_activas = Array.isArray(state.cartas_activas) ? state.cartas_activas : [];
  const limits = specialLimits();
  const activeIds = new Set(state.cartas_activas.map(card => String(card.id_carta || '')));
  const reserveIds = new Set(state.cartas_reserva.map(card => String(card.id_carta || '')));
  const latestById = new Map();
  (state.historial_ultimas_cartas || []).forEach((rawCard, index) => {
    const card = normalizeSpecialCard(rawCard, index);
    const id = String(card?.id_carta || '');
    if(id && !latestById.has(id)) latestById.set(id, card);
  });
  let repaired = 0;
  latestById.forEach(card => {
    const id = String(card.id_carta || '');
    if(!id || card.destruida || activeIds.has(id) || reserveIds.has(id)) return;
    if(!card.obtenida_desde_sobre) return;
    if(!limits.allowOpenWhenReserveFull && state.cartas_reserva.length >= limits.reserveMax) return;
    state.cartas_reserva.push({ ...card, activa:false, destruida:false });
    reserveIds.add(id);
    repaired += 1;
  });
  return repaired;
}
function ensureSpecialState(){
  if(!game) return null;
  game.special = normalizeSpecialState(game.special, game.rankingManagerName || storedManagerName() || 'Manager');
  const repaired = repairSpecialReserveFromHistory(game.special);
  if(repaired > 0) game._needsAutosave = true;
  return game.special;
}
function specialCardBaseById(id){
  return (specialDatabase().cartas_base || []).find(card => String(card.id_base) === String(id)) || null;
}
function specialRarityOrder(){
  const order = specialDatabase().rareza_orden_visual;
  return Array.isArray(order) && order.length ? order : ['inutil','comun','rara','epica','legendaria'];
}
function specialRarityRank(rarity){
  const index = specialRarityOrder().indexOf(String(rarity || ''));
  return index >= 0 ? index : 99;
}
function specialRarityLabel(rarity){
  const labels = { inutil:'Inútil', comun:'Común', rara:'Rara', epica:'Épica', legendaria:'Legendaria' };
  return labels[rarity] || String(rarity || 'Carta');
}
function specialBonusLabel(type){
  const labels = {
    sponsors_extra:'Sponsors extra',
    deterioro_campo:'Deterioro de campo',
    probabilidad_legendaria:'Prob. legendaria',
    objetivo_mas_bajo:'Objetivo más bajo',
    socios_extra:'Socios ganados extra'
  };
  return labels[type] || String(type || 'Sin bonus');
}
function specialCardBonusText(card){
  if(!card?.tipo_bonus || !card.valor_bonus) return 'Sin bonus activo';
  const unit = card.unidad === 'porcentaje_relativo' ? '% relativo' : (card.unidad === 'porcentaje' ? '%' : '');
  const sign = ['deterioro_campo','objetivo_mas_bajo'].includes(card.tipo_bonus) ? '-' : '+';
  return `${specialBonusLabel(card.tipo_bonus)}: ${sign}${Number(card.valor_bonus || 0)}${unit}`;
}
function specialCurrentDate(){
  if(typeof currentCalendarDate === 'function') return currentCalendarDate();
  return validIsoDate(game?.currentDate) ? game.currentDate : dateForSeasonState(game);
}
function normalizeSpecialCardLockTurns(card){
  if(!card || typeof card !== 'object') return card;
  const limits = specialLimits();
  const lockDays = Math.max(0, Math.round(Number(limits.lockDays || 0)));
  if(lockDays <= 0) return card;
  const nowTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  if(Number.isFinite(Number(card.bloqueada_hasta_turno))){
    card.bloqueada_hasta_turno = Math.max(0, Math.round(Number(card.bloqueada_hasta_turno || 0)));
    if(!Number.isFinite(Number(card.activada_en_turno))) card.activada_en_turno = Math.max(0, card.bloqueada_hasta_turno - lockDays);
    return card;
  }
  let remaining = lockDays;
  const today = specialCurrentDate();
  if(validIsoDate(card.bloqueada_hasta)){
    remaining = daysBetweenIsoDates(today, card.bloqueada_hasta);
  } else if(validIsoDate(card.activada_en)){
    remaining = lockDays - Math.max(0, daysBetweenIsoDates(card.activada_en, today));
  }
  remaining = clamp(Math.round(Number(remaining || 0)), 0, lockDays);
  card.activada_en_turno = nowTurn;
  card.bloqueada_hasta_turno = nowTurn + remaining;
  if(!validIsoDate(card.bloqueada_hasta) && validIsoDate(today)) card.bloqueada_hasta = addDaysToIsoDate(today, remaining);
  return card;
}
function specialCardActiveLockInfo(card){
  if(!card || typeof card !== 'object') return { locked:false, remaining:0, until:null };
  normalizeSpecialCardLockTurns(card);
  const limits = specialLimits();
  const lockDays = Math.max(0, Math.round(Number(limits.lockDays || 0)));
  const nowTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  const turnUntil = Number.isFinite(Number(card.bloqueada_hasta_turno)) ? Math.round(Number(card.bloqueada_hasta_turno || 0)) : null;
  let remaining = turnUntil !== null ? turnUntil - nowTurn : 0;
  remaining = clamp(Math.round(Number(remaining || 0)), 0, lockDays);
  const until = validIsoDate(card?.bloqueada_hasta) ? card.bloqueada_hasta : (validIsoDate(specialCurrentDate()) ? addDaysToIsoDate(specialCurrentDate(), remaining) : null);
  return { locked:remaining > 0, remaining, until, turnUntil };
}
function specialActiveCardsLockSummary(){
  const state = ensureSpecialState();
  if(!state) return { locked:false, count:0, remaining:0, until:null };
  const lockedCards = (state.cartas_activas || []).map(card => specialCardActiveLockInfo(card)).filter(info => info.locked);
  if(!lockedCards.length) return { locked:false, count:0, remaining:0, until:null };
  lockedCards.sort((a,b) => String(a.until).localeCompare(String(b.until)));
  return { locked:true, count:lockedCards.length, remaining:lockedCards[0].remaining, until:lockedCards[0].until };
}
function specialCardsLockedInfo(){
  return specialActiveCardsLockSummary();
}
function lockSpecialCardChanges(card=null, stateRef=null){
  // No normalizar acá si venimos de activateSpecialCard(): normalizar en medio de la operación
  // recrea game.special y puede hacer que la carta activada se pierda antes del guardado.
  const state = stateRef && typeof stateRef === 'object' ? stateRef : ensureSpecialState();
  if(!state) return;
  const today = specialCurrentDate();
  const lockDays = specialLimits().lockDays;
  const until = lockDays > 0 ? addDaysToIsoDate(today, lockDays) : null;
  const nowTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  state.fecha_ultimo_cambio_cartas = today;
  state.bloqueado_hasta = null;
  if(card && typeof card === 'object'){
    card.activada_en = today;
    card.bloqueada_hasta = until;
    card.activada_en_turno = nowTurn;
    card.bloqueada_hasta_turno = nowTurn + Math.max(0, Math.round(Number(lockDays || 0)));
  }
}
function specialActiveBonus(type){
  const state = ensureSpecialState();
  if(!state) return 0;
  const db = specialDatabase();
  const stack = db.apilamiento_bonus?.[type] || {};
  const raw = (state.cartas_activas || [])
    .filter(card => card.tipo_bonus === type && !card.destruida)
    .reduce((sum, card) => sum + Number(card.valor_bonus || 0), 0);
  const cap = Number(stack.tope_porcentaje);
  return Number.isFinite(cap) ? Math.min(raw, cap) : raw;
}
function specialActiveBonusSummary(){
  return ['sponsors_extra','deterioro_campo','probabilidad_legendaria','objetivo_mas_bajo','socios_extra'].map(type => ({ type, value:specialActiveBonus(type) })).filter(item => item.value > 0);
}
function specialActiveRulesDetailMarkup(activeCards=[], limits=specialLimits()){
  if(!activeCards.length) return '<p class="muted small">No hay cartas activas. Activá cartas desde la reserva para ver sus bonus acá.</p>';
  const totals = specialActiveBonusSummary();
  const totalsMarkup = totals.length ? `<div class="special-bonus-list compact">${totals.map(item => `<div><strong>${escapeHtml(specialBonusLabel(item.type))}</strong><span>${['deterioro_campo','objetivo_mas_bajo'].includes(item.type) ? '-' : '+'}${item.value}% acumulado</span></div>`).join('')}</div>` : '';
  const cardsMarkup = `<div class="special-active-rules-list">${activeCards.map(card => {
    const info = specialCardActiveLockInfo(card);
    const status = info.locked ? `Fija ${formatDays(info.remaining)}` : 'Lista para desactivar';
    return `<div><strong>${escapeHtml(card.nombre)}</strong><span>${escapeHtml(specialCardBonusText(card))}</span><em>${escapeHtml(status)}</em></div>`;
  }).join('')}</div>`;
  return `${totalsMarkup}${cardsMarkup}<p class="muted small">Activas: ${activeCards.length}/${limits.activeMax}.</p>`;
}
function specialActionPoints(actionId){
  const action = specialDatabase().puntos_ocultos?.acciones?.[actionId];
  return Math.max(0, Math.round(Number(action?.puntos || 0)));
}
function awardSpecialPoints(actionId, context={}){
  const state = ensureSpecialState();
  const points = specialActionPoints(actionId);
  if(!state || points <= 0) return 0;
  state.puntos_habilidad = Math.max(0, Math.round(Number(state.puntos_habilidad || 0) + points));
  state.puntos_log = Array.isArray(state.puntos_log) ? state.puntos_log : [];
  state.puntos_log.push({ actionId, points, ...turnStamp({ date:game?.currentDate || '', ...context }) });
  if(state.puntos_log.length > 80) state.puntos_log = state.puntos_log.slice(-80);
  return points;
}
function awardSpecialPointsForOwnMatch(match){
  if(!game || !match) return 0;
  const isHome = Number(match.homeId) === Number(game.selectedClubId);
  const gf = isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
  const gc = isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
  let total = 0;
  if(gf > gc) total += awardSpecialPoints('ganar_partido', { matchId:match.id });
  else if(gf === gc) total += awardSpecialPoints('empatar_partido', { matchId:match.id });
  if(gf > 5) total += awardSpecialPoints('meter_mas_de_5_goles_en_un_partido', { matchId:match.id, goals:gf });
  return total;
}
function awardSpecialChampionPoints(division){
  const order = Math.max(1, Math.round(Number(division?.order || 1)));
  const id = order <= 1 ? 'salir_campeon_division_1' : (order === 2 ? 'salir_campeon_division_2' : 'salir_campeon_division_3');
  return awardSpecialPoints(id, { divisionId:division?.id || '', divisionName:division?.name || '' });
}

function specialPackRevealStepMs(){
  if(typeof SPECIAL_PACK_REVEAL_STEP_MS !== 'undefined') return SPECIAL_PACK_REVEAL_STEP_MS;
  if(typeof configNumber === 'function') return configNumber('ui.especialAperturaCartaMs', 2700, 250, 9000);
  return 2700;
}
function specialDelay(ms){
  return new Promise(resolve => setTimeout(resolve, Math.max(0, Number(ms || 0))));
}
function specialPackDefinitions(){
  const packs = specialDatabase().sobres || {};
  return Object.entries(packs).map(([id, pack]) => ({ id, ...pack })).filter(pack => pack.id && pack.costo_puntos !== undefined);
}
function specialCardPoolByRarity(rarity){
  return (specialDatabase().cartas_base || []).filter(card => String(card.rareza) === String(rarity));
}
function adjustedPackProbabilities(pack){
  const base = { ...(pack.probabilidades || {}) };
  const rarityOrder = specialRarityOrder();
  rarityOrder.forEach(r => { base[r] = Math.max(0, Number(base[r] || 0)); });
  const legendBonus = specialActiveBonus('probabilidad_legendaria');
  if(legendBonus > 0 && base.legendaria > 0){
    const oldLegend = base.legendaria;
    const nextLegend = Math.min(99, oldLegend * (1 + (legendBonus / 100)));
    const diff = Math.max(0, nextLegend - oldLegend);
    const nonLegend = rarityOrder.filter(r => r !== 'legendaria');
    const othersTotal = nonLegend.reduce((sum, r) => sum + base[r], 0);
    if(diff > 0 && othersTotal > 0){
      nonLegend.forEach(r => { base[r] = Math.max(0, base[r] - diff * (base[r] / othersTotal)); });
      base.legendaria = nextLegend;
    }
  }
  const total = rarityOrder.reduce((sum, r) => sum + Math.max(0, Number(base[r] || 0)), 0) || 1;
  return Object.fromEntries(rarityOrder.map(r => [r, Math.max(0, Number(base[r] || 0)) / total]));
}
function pickSpecialRarity(pack){
  const probs = adjustedPackProbabilities(pack);
  let roll = Math.random();
  for(const rarity of specialRarityOrder()){
    roll -= Number(probs[rarity] || 0);
    if(roll <= 0) return rarity;
  }
  return specialRarityOrder().slice(-1)[0] || 'inutil';
}
function createSpecialCardInstance(base, packId){
  const card = {
    id_carta:`CARD-${game?.saveCode || 'FM'}-${Date.now().toString(36)}-${hashNumber(`${base.id_base}-${Math.random()}`, 1000000)}`,
    id_base:base.id_base,
    manager_id:game?.saveCode || '',
    nombre:base.nombre || 'Carta',
    rareza:base.rareza || 'inutil',
    tipo_bonus:base.tipo_bonus ?? null,
    valor_bonus:Number(base.valor_bonus || 0),
    unidad:base.unidad || '',
    activable:Boolean(base.activable),
    texto:base.texto || '',
    activa:false,
    destruida:false,
    obtenida_en_turno:currentTurnIndex(),
    obtenida_desde_sobre:packId || ''
  };
  return normalizeSpecialCard(card);
}
function sortOpenedCards(cards=[]){
  const db = specialDatabase();
  if(db.rareza_orden_apertura?.mostrar_raras_epicas_legendarias_al_final === false) return cards;
  const order = Array.isArray(db.rareza_orden_apertura?.orden) ? db.rareza_orden_apertura.orden : specialRarityOrder();
  return cards.slice().sort((a,b) => (order.indexOf(a.rareza) - order.indexOf(b.rareza)) || a.nombre.localeCompare(b.nombre, 'es'));
}

function ensureSpecialCardsInReserve(cards=[]){
  const state = ensureSpecialState();
  if(!state || !Array.isArray(cards) || !cards.length) return [];
  state.cartas_reserva = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  state.cartas_activas = Array.isArray(state.cartas_activas) ? state.cartas_activas : [];
  const activeIds = new Set(state.cartas_activas.map(card => String(card.id_carta)));
  const reserveIds = new Set(state.cartas_reserva.map(card => String(card.id_carta)));
  const added = [];
  cards.forEach((rawCard, index) => {
    const card = normalizeSpecialCard(rawCard, index);
    if(!card || card.destruida) return;
    const id = String(card.id_carta || '');
    if(!id || activeIds.has(id) || reserveIds.has(id)) return;
    const clean = { ...card, activa:false, destruida:false };
    state.cartas_reserva.push(clean);
    reserveIds.add(id);
    added.push(clean);
  });
  return added;
}
function recoverSpecialCardToReserve(cardId){
  const state = ensureSpecialState();
  if(!state || !cardId) return null;
  if((state.cartas_reserva || []).some(card => card.id_carta === cardId)){
    return state.cartas_reserva.find(card => card.id_carta === cardId);
  }
  if((state.cartas_activas || []).some(card => card.id_carta === cardId)) return null;
  const source = (state.historial_ultimas_cartas || []).find(card => card.id_carta === cardId && !card.destruida);
  if(!source) return null;
  const limits = specialLimits();
  if((state.cartas_reserva || []).length >= limits.reserveMax) return null;
  const [card] = ensureSpecialCardsInReserve([source]);
  return card || null;
}
async function openSpecialPack(packId){
  if(specialPackOpeningInProgress){ showNotice('Ya se está abriendo un sobre.'); return; }
  let state = ensureSpecialState();
  const pack = specialPackDefinitions().find(item => item.id === packId);
  if(!state || !pack){ showNotice('Sobre no disponible.'); return; }
  const cost = Math.max(0, Math.round(Number(pack.costo_puntos || 0)));
  const count = Math.max(1, Math.round(Number(pack.cantidad_cartas || 1)));
  const limits = specialLimits();
  state.cartas_reserva = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  const currentPoints = Math.max(0, Math.round(Number(state.puntos_habilidad || 0)));
  if(currentPoints < cost){ showNotice(`Puntos insuficientes. Necesitás ${cost} puntos de habilidad.`); return; }
  if(!limits.allowOpenWhenReserveFull && state.cartas_reserva.length + count > limits.reserveMax){
    showNotice(`Reserva llena. Necesitás ${count} espacios libres para abrir este sobre.`);
    return;
  }

  specialPackOpeningInProgress = true;
  const previousPoints = currentPoints;
  const previousReserveIds = new Set((state.cartas_reserva || []).map(card => String(card.id_carta || '')));
  const previousHistory = (state.historial_ultimas_cartas || []).slice();
  const previousLog = (state.puntos_log || []).slice();

  const rollbackOpening = async (notice='No se pudo completar la apertura. Se devolvieron los puntos.') => {
    const rollbackState = ensureSpecialState();
    if(!rollbackState) return;
    rollbackState.puntos_habilidad = previousPoints;
    rollbackState.puntos_log = previousLog;
    rollbackState.historial_ultimas_cartas = previousHistory;
    rollbackState.cartas_reserva = (rollbackState.cartas_reserva || []).filter(card => previousReserveIds.has(String(card.id_carta || '')));
    game.special = rollbackState;
    specialPackOpeningInProgress = false;
    try{ await saveLocal(true); }catch(err){ console.error(err); }
    renderSpecial();
    showNotice(notice);
  };

  // El costo del sobre se descuenta en el momento de comprarlo, antes de mostrar las cartas.
  state.puntos_habilidad = Math.max(0, previousPoints - cost);
  state.puntos_log = Array.isArray(state.puntos_log) ? state.puntos_log : [];
  state.puntos_log.push({ actionId:'abrir_sobre', points:-cost, packId, puntos_antes:previousPoints, puntos_despues:state.puntos_habilidad, ...turnStamp({ date:game?.currentDate || '' }) });
  if(state.puntos_log.length > 80) state.puntos_log = state.puntos_log.slice(-80);
  game.special = state;
  specialPointsAnimation = { id:`spend-${Date.now()}-${Math.random()}`, points:-cost };
  renderSpecial([], { revealCount:0, opening:true, packName:pack.nombre || 'Sobre' });

  try{
    await saveLocal(true);
  } catch(err){
    console.error(err);
    await rollbackOpening('No se pudo guardar la compra. No se descontaron puntos.');
    return;
  }

  const cards = [];
  for(let i=0;i<count;i++){
    const rarity = pickSpecialRarity(pack);
    const pool = specialCardPoolByRarity(rarity);
    const fallbackPool = (specialDatabase().cartas_base || []).filter(Boolean);
    const sourcePool = pool.length ? pool : fallbackPool;
    if(!sourcePool.length) continue;
    const base = sourcePool[hashNumber(`${packId}-${Date.now()}-${Math.random()}-${i}`, sourcePool.length)];
    const card = createSpecialCardInstance(base, packId);
    if(card) cards.push(card);
  }

  if(!cards.length){
    await rollbackOpening('No se pudieron generar cartas para este sobre. Se devolvieron los puntos.');
    return;
  }

  const sorted = sortOpenedCards(cards).map((card, index) => normalizeSpecialCard(card, index)).filter(Boolean);
  const added = ensureSpecialCardsInReserve(sorted);
  state = ensureSpecialState();
  state.historial_ultimas_cartas = added.concat(state.historial_ultimas_cartas || []).slice(0, 30);
  game.special = state;

  try{
    await saveLocal(true);
  } catch(err){
    console.error(err);
    await rollbackOpening('No se pudo guardar la apertura. Se devolvieron los puntos.');
    return;
  }

  showNotice(`${pack.nombre || 'Sobre'} comprado por ${cost} puntos.`);
  try{
    for(let i=1;i<=added.length;i++){
      renderSpecial(added, { revealCount:i, opening:true, packName:pack.nombre || 'Sobre' });
      await specialDelay(specialPackRevealStepMs());
    }
  } finally {
    specialPackOpeningInProgress = false;
    specialPointsAnimation = null;
    await saveLocal(true);
    renderSpecial();
    showNotice('Las cartas obtenidas quedaron guardadas en reserva.');
  }
}

function activateSpecialCard(cardId){
  const state = ensureSpecialState();
  const limits = specialLimits();
  if((state.cartas_activas || []).length >= limits.activeMax){ showNotice(`Ya tenés ${limits.activeMax} cartas activas. Desactivá una carta que ya haya cumplido su plazo para reemplazarla.`); return; }
  let index = state.cartas_reserva.findIndex(card => card.id_carta === cardId);
  if(index < 0){
    recoverSpecialCardToReserve(cardId);
    index = state.cartas_reserva.findIndex(card => card.id_carta === cardId);
  }
  if(index < 0){ showNotice('Carta no encontrada en reserva.'); return; }
  const card = state.cartas_reserva[index];
  if(!card.activable){ showNotice('Esta carta no se puede activar.'); return; }
  if(!limits.allowRepeatedActive && state.cartas_activas.some(active => active.id_base === card.id_base)){ showNotice('Esta carta ya está activa.'); return; }
  state.cartas_reserva.splice(index, 1);
  const activatedCard = { ...card, activa:true, destruida:false };
  lockSpecialCardChanges(activatedCard, state);
  state.cartas_activas = Array.isArray(state.cartas_activas) ? state.cartas_activas : [];
  state.cartas_activas.push(activatedCard);
  game.special = state;
  saveLocal(true);
  renderSpecial();
  showNotice(`Carta activada: ${card.nombre}. Queda fija por ${formatDays(limits.lockDays)}.`);
}
function deactivateSpecialCard(cardId){
  const state = ensureSpecialState();
  const limits = specialLimits();
  if(state.cartas_reserva.length >= limits.reserveMax){ showNotice('Reserva llena. No se puede desactivar una carta hasta liberar espacio.'); return; }
  const index = state.cartas_activas.findIndex(card => card.id_carta === cardId);
  if(index < 0){ showNotice('Carta activa no encontrada.'); return; }
  const card = state.cartas_activas[index];
  const cardLock = specialCardActiveLockInfo(card);
  if(cardLock.locked){ showNotice(`Esta carta debe permanecer activa ${formatDays(cardLock.remaining)} más.`); return; }
  state.cartas_activas.splice(index, 1);
  state.cartas_reserva.push({ ...card, activa:false, activada_en:null, bloqueada_hasta:null });
  saveLocal(true);
  renderSpecial();
  showNotice(`Carta desactivada: ${card.nombre}.`);
}
function destroySpecialCard(cardId){
  const state = ensureSpecialState();
  const db = specialDatabase();
  if(db.destruir_cartas?.permitido === false){ showNotice('La destrucción de cartas está desactivada.'); return; }
  let index = state.cartas_reserva.findIndex(card => card.id_carta === cardId);
  if(index < 0){
    recoverSpecialCardToReserve(cardId);
    index = state.cartas_reserva.findIndex(card => card.id_carta === cardId);
  }
  if(index < 0){ showNotice('Sólo se pueden destruir cartas en reserva.'); return; }
  const card = state.cartas_reserva[index];
  const fixedRecovery = { inutil:5, comun:20, rara:50, legendaria:1000 };
  const configuredRecovery = Math.max(0, Math.round(Number(db.destruir_cartas?.recuperacion_puntos?.[card.rareza] || 0)));
  const recovery = Number.isFinite(fixedRecovery[card.rareza]) ? fixedRecovery[card.rareza] : configuredRecovery;
  state.cartas_reserva.splice(index, 1);
  state.puntos_habilidad = Math.max(0, Math.round(Number(state.puntos_habilidad || 0) + recovery));
  state.historial_ultimas_cartas = [{ ...card, destruida:true, recuperacion_puntos:recovery }].concat(state.historial_ultimas_cartas || []).slice(0, 30);
  specialPointsAnimation = { id:`destroy-${Date.now()}-${Math.random()}`, points:recovery };
  saveLocal(true);
  renderSpecial();
  showNotice(`Carta destruida: +${recovery} puntos.`);
}
function specialCardMarkup(card, zone='reserve'){
  const rarity = String(card.rareza || 'inutil');
  const canActivate = zone === 'reserve' && card.activable;
  const activeLock = zone === 'active' ? specialCardActiveLockInfo(card) : { locked:false, remaining:0, until:null };
  const lockPill = zone === 'active' && activeLock.locked ? `<span class="pill warn">${formatDays(activeLock.remaining)}</span>` : '';
  const bonus = specialCardBonusText(card);
  const action = zone === 'active'
    ? `<button class="ghost small-btn" data-special-deactivate="${escapeHtml(card.id_carta)}" ${activeLock.locked ? 'disabled' : ''}>${activeLock.locked ? 'Fija' : 'Quitar'}</button>`
    : (zone === 'opened'
      ? `<span class="pill">Guardada</span>`
      : `<div class="row gap-xs"><button class="primary small-btn" data-special-activate="${escapeHtml(card.id_carta)}" ${canActivate ? '' : 'disabled'}>Activar</button><button class="ghost small-btn" data-special-destroy="${escapeHtml(card.id_carta)}">Destruir</button></div>`);
  return `<div class="special-card rarity-${escapeHtml(rarity)} ${zone === 'active' ? 'active' : ''} ${zone === 'opened' ? 'opened' : ''}" data-special-card-id="${escapeHtml(card.id_carta)}" draggable="${canActivate ? 'true' : 'false'}"> 
    <div class="special-card-head"><span class="pill rarity-pill rarity-${escapeHtml(rarity)}">${escapeHtml(specialRarityLabel(rarity))}</span>${lockPill}</div>
    <h3>${escapeHtml(card.nombre)}</h3>
    ${card.texto ? `<p>${escapeHtml(card.texto)}</p>` : ''}
    <strong>${escapeHtml(bonus)}</strong>
    <div class="special-card-actions">${action}</div>
  </div>`;
}
function specialPackMarkup(pack){
  const state = ensureSpecialState();
  const cost = Math.max(0, Math.round(Number(pack.costo_puntos || 0)));
  const count = Math.max(1, Math.round(Number(pack.cantidad_cartas || 1)));
  const limits = specialLimits();
  const room = Math.max(0, limits.reserveMax - (state.cartas_reserva || []).length);
  const disabled = specialPackOpeningInProgress || state.puntos_habilidad < cost || (!limits.allowOpenWhenReserveFull && room < count);
  const probs = adjustedPackProbabilities(pack);
  const probText = specialRarityOrder().map(r => `${specialRarityLabel(r)} ${Math.round((probs[r] || 0) * 1000) / 10}%`).join(' · ');
  return `<div class="card special-pack-card">
    <div class="row"><div><p class="label">Sobre</p><h3>${escapeHtml(pack.nombre || pack.id)}</h3></div><span class="pill">${count} cartas</span></div>
    <p class="muted small">${escapeHtml(probText)}</p>
    <div class="row"><strong>${cost} puntos</strong><button class="primary" data-open-special-pack="${escapeHtml(pack.id)}" ${disabled ? 'disabled' : ''}>Abrir sobre</button></div>
  </div>`;
}
function specialOpenedMarkup(opened=[], options={}){
  if(!opened?.length) return '';
  const revealCount = Number.isFinite(Number(options.revealCount)) ? Math.max(0, Math.min(opened.length, Math.round(Number(options.revealCount)))) : opened.length;
  const visible = opened.slice(0, revealCount);
  const opening = Boolean(options.opening);
  const packName = options.packName || 'Sobre';
  const remaining = Math.max(0, opened.length - visible.length);
  return `<div class="card special-opened ${opening ? 'opening' : ''}">
    <div class="row"><div><p class="label">${escapeHtml(packName)}</p><h3>${opening ? 'Abriendo sobre' : 'Cartas obtenidas'}</h3></div><span class="pill">${visible.length}/${opened.length}</span></div>
    <p class="muted small">${opening ? 'Las cartas se revelan de a una. Ya están guardadas en reserva; al terminar aparecerán en el inventario.' : 'Las cartas de esta apertura quedaron guardadas en reserva.'}</p>
    <div class="special-card-grid special-opening-grid">${visible.map(card => specialCardMarkup(card, 'opened')).join('')}</div>
    ${opening && remaining ? `<div class="special-reveal-progress"><div style="width:${Math.round((visible.length / opened.length) * 100)}%"></div></div><p class="muted small">Faltan ${remaining} carta(s) por revelar.</p>` : ''}
  </div>`;
}

function renderSpecial(opened=[], options={}){
  if(Array.isArray(opened) && opened.length && !options?.opening) ensureSpecialCardsInReserve(opened);
  const state = ensureSpecialState();
  const limits = specialLimits();
  const locked = specialCardsLockedInfo();
  const active = (state.cartas_activas || []).slice().sort((a,b)=>specialRarityRank(b.rareza)-specialRarityRank(a.rareza));
  const openingIds = options?.opening && opened?.length ? new Set(opened.map(card => card.id_carta)) : null;
  const reserveAll = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  const reserveSource = openingIds ? reserveAll.filter(card => !openingIds.has(card.id_carta)) : reserveAll;
  const reserve = reserveSource.slice().sort((a,b)=>specialRarityRank(b.rareza)-specialRarityRank(a.rareza) || a.nombre.localeCompare(b.nombre, 'es'));
  const packs = specialPackDefinitions();
  const bonuses = specialActiveBonusSummary();
  const pointAnimation = specialPointsAnimation;
  const activeBonusCards = active.filter(card => card.tipo_bonus && Number(card.valor_bonus || 0) > 0);
  const lockText = locked.locked ? `${locked.count} fija(s). Próxima libre en ${formatDays(locked.remaining)}.` : 'Cambios disponibles.';
  const bonusChips = bonuses.length
    ? bonuses.map(item => `<span class="pill ok">${escapeHtml(specialBonusLabel(item.type))}: ${['deterioro_campo','objetivo_mas_bajo'].includes(item.type) ? '-' : '+'}${item.value}%</span>`).join('')
    : '<span class="pill">Sin bonus activo</span>';
  view.innerHTML = `
    <div class="row section-title"><div><h2>Cartas</h2><p class="tagline">Puntos, sobres y bonus activos del manager.</p></div></div>
    <div class="grid cols-4 compact-team-stats special-summary">
      <div class="card special-points-card ${pointAnimation ? 'special-points-flash' : ''}"><p class="label">Puntos</p><strong>${Number(state.puntos_habilidad || 0)}</strong>${pointAnimation ? `<span class="special-points-float">${Number(pointAnimation.points || 0) >= 0 ? '+' : ''}${Number(pointAnimation.points || 0)}</span>` : ''}</div>
      <div class="card"><p class="label">Activas</p><strong>${active.length}/${limits.activeMax}</strong></div>
      <div class="card"><p class="label">Reserva</p><strong>${reserveAll.length}/${limits.reserveMax}</strong></div>
      <div class="card"><p class="label">Cambios</p><strong>${escapeHtml(locked.locked ? 'Bloqueados' : 'Libres')}</strong></div>
    </div>
    ${specialOpenedMarkup(opened, options)}
    <div class="card special-active-drop" data-special-drop-active="1">
      <div class="row"><div><p class="label">Cartas activas</p><h3>Bonus aplicados</h3></div><span class="pill ${locked.locked ? 'warn' : 'ok'}">${escapeHtml(lockText)}</span></div>
      <div class="special-bonus-chips">${bonusChips}</div>
      ${specialActiveRulesDetailMarkup(activeBonusCards, limits)}
      <div class="special-card-grid compact">${active.length ? active.map(card => specialCardMarkup(card, 'active')).join('') : '<p class="muted">No hay cartas activas.</p>'}</div>
    </div>
    <div class="grid cols-2 special-main-grid">
      <div class="card"><div class="row"><div><p class="label">Sobres</p><h3>Abrir</h3></div><span class="pill">Reserva libre: ${Math.max(0, limits.reserveMax - reserveAll.length)}</span></div><div class="grid cols-1">${packs.length ? packs.map(specialPackMarkup).join('') : '<p class="muted">No hay sobres configurados.</p>'}</div></div>
      <div class="card"><div class="row"><div><p class="label">Reserva</p><h3>Inventario</h3></div><span class="pill">${reserve.length}/${limits.reserveMax}</span></div><div class="special-card-grid compact">${reserve.length ? reserve.map(card => specialCardMarkup(card, 'reserve')).join('') : '<p class="muted">No hay cartas en reserva.</p>'}</div></div>
    </div>
  `;
  document.querySelectorAll('[data-open-special-pack]').forEach(btn => btn.addEventListener('click', () => openSpecialPack(btn.dataset.openSpecialPack)));
  document.querySelectorAll('.special-card[draggable="true"]').forEach(card => {
    card.addEventListener('dragstart', ev => ev.dataTransfer?.setData('text/special-card-id', card.dataset.specialCardId || ''));
  });
  document.querySelectorAll('[data-special-drop-active]').forEach(zone => {
    zone.addEventListener('dragover', ev => ev.preventDefault());
    zone.addEventListener('drop', ev => {
      ev.preventDefault();
      const cardId = ev.dataTransfer?.getData('text/special-card-id');
      if(cardId) activateSpecialCard(cardId);
    });
  });
  document.querySelectorAll('[data-special-activate]').forEach(btn => btn.addEventListener('click', () => activateSpecialCard(btn.dataset.specialActivate)));
  document.querySelectorAll('[data-special-deactivate]').forEach(btn => btn.addEventListener('click', () => deactivateSpecialCard(btn.dataset.specialDeactivate)));
  document.querySelectorAll('[data-special-destroy]').forEach(btn => btn.addEventListener('click', () => destroySpecialCard(btn.dataset.specialDestroy)));
  if(pointAnimation){
    const animationId = pointAnimation.id;
    window.setTimeout(() => {
      if(specialPointsAnimation?.id === animationId) specialPointsAnimation = null;
    }, 1800);
  }
}
