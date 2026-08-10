/* Cartas globales: destrucción definitiva y sincronización reserva/activa. */

let specialPackOpeningInProgress = false;
let specialPointsAnimation = null;
let specialPendingOpeningRuntimeId = '';
let specialPendingOpeningFinalizeTimer = null;
let specialOpeningNeedsRenderAfterVisibility = false;
let specialOpeningLifecycleGuardsInstalled = false;
const SPECIAL_GLOBAL_CARDS_STORAGE_KEY = 'futbolManager.specialCardsGlobal.v1';
const SPECIAL_PHYSICAL_RECOVERY_POINTS_BY_RARITY = Object.freeze({ comun:1, rara:3, epica:5, legendaria:12 });
const SPECIAL_MAX_USES_BY_RARITY = Object.freeze({ inutil:1, comun:1, rara:2, epica:3, legendaria:5 });

function specialPhysicalRecoveryPointsForRarity(rarity){
  return Math.max(0, Math.round(Number(SPECIAL_PHYSICAL_RECOVERY_POINTS_BY_RARITY[String(rarity || '').toLowerCase()] || 0)));
}
function specialMaxUsesForRarity(rarity){
  const key = String(rarity || 'inutil').toLowerCase();
  const configured = specialDatabase()?.limites?.activaciones_por_rareza?.[key];
  return Math.max(1, Math.round(Number(configured ?? SPECIAL_MAX_USES_BY_RARITY[key] ?? specialDatabase()?.limites?.activaciones_por_carta ?? 1)));
}

function specialCardIsObjectiveReduction(card){
  return String(card?.tipo_bonus || '') === 'objetivo_mas_bajo';
}
function specialObjectiveSeasonNumber(){
  return Math.max(1, Math.round(Number(game?.seasonNumber || 1)));
}
function specialObjectiveSeasonCap(){
  const raw = specialDatabase()?.apilamiento_bonus?.objetivo_mas_bajo?.tope_porcentaje;
  const cap = Number(raw);
  return Number.isFinite(cap) ? Math.max(0, cap) : 80;
}
function normalizeSpecialObjectiveSeasonReduction(raw=null, stateRef=null, options={}){
  const season = specialObjectiveSeasonNumber();
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : null;
  const sameSeason = Number(source?.temporada || source?.season || 0) === season;
  const applications = sameSeason && Array.isArray(source?.aplicaciones)
    ? source.aplicaciones.map((entry, index) => {
        const value = Math.max(0, Number(entry?.porcentaje ?? entry?.value ?? 0) || 0);
        if(value <= 0) return null;
        return {
          id:String(entry?.id || `objective-season-${season}-${index + 1}`),
          temporada:season,
          id_carta:String(entry?.id_carta || entry?.cardId || ''),
          id_base:String(entry?.id_base || entry?.baseId || ''),
          nombre_carta:String(entry?.nombre_carta || entry?.cardName || 'Carta de objetivo'),
          porcentaje:value,
          origen:String(entry?.origen || entry?.source || 'activacion'),
          fecha:validIsoDate(entry?.fecha || entry?.date) ? String(entry.fecha || entry.date) : null,
          turno:Number.isFinite(Number(entry?.turno ?? entry?.turn)) ? Math.max(0, Math.round(Number(entry.turno ?? entry.turn))) : null
        };
      }).filter(Boolean)
    : [];
  let migrated = Boolean(sameSeason && (source?.version || source?.migrada_desde_v944 || source?.migratedFromV944));
  if(!source && options.migrateLegacy !== false){
    const activeCards = Array.isArray(stateRef?.cartas_activas) ? stateRef.cartas_activas : [];
    activeCards.filter(specialCardIsObjectiveReduction).forEach((card, index) => {
      const value = Math.max(0, Number(specialCardEffectiveBonus(card) || 0));
      if(value <= 0) return;
      applications.push({
        id:`objective-season-${season}-legacy-${index + 1}`,
        temporada:season,
        id_carta:String(card.id_carta || ''),
        id_base:String(card.id_base || ''),
        nombre_carta:String(card.nombre || 'Carta de objetivo'),
        porcentaje:value,
        origen:'migracion_v947_activa',
        fecha:validIsoDate(game?.currentDate) ? game.currentDate : null,
        turno:typeof currentTurnIndex === 'function' ? currentTurnIndex() : null
      });
    });
    migrated = true;
  }
  const calculated = applications.reduce((sum, entry) => sum + Number(entry.porcentaje || 0), 0);
  const stored = sameSeason ? Number(source?.porcentaje ?? source?.total ?? calculated) : calculated;
  const total = clamp(Number.isFinite(stored) ? Math.max(stored, calculated) : calculated, 0, specialObjectiveSeasonCap());
  return {
    version:'V9.49',
    temporada:season,
    porcentaje:Number(total.toFixed(3)),
    aplicaciones:applications.slice(-120),
    migrada_desde_v944:migrated
  };
}
function specialObjectiveSeasonReductionState(stateRef=null){
  const state = stateRef && typeof stateRef === 'object' ? stateRef : ensureSpecialState();
  if(!state) return normalizeSpecialObjectiveSeasonReduction(null, null, { migrateLegacy:false });
  state.objetivo_reduccion_temporada = normalizeSpecialObjectiveSeasonReduction(state.objetivo_reduccion_temporada, state);
  return state.objetivo_reduccion_temporada;
}
function specialObjectiveSeasonReduction(stateRef=null){
  return Number(specialObjectiveSeasonReductionState(stateRef)?.porcentaje || 0);
}
function specialObjectiveSeasonContributionForCard(cardId, stateRef=null){
  const id = String(cardId || '');
  if(!id) return 0;
  return Number((specialObjectiveSeasonReductionState(stateRef)?.aplicaciones || [])
    .filter(entry => String(entry.id_carta || '') === id)
    .reduce((sum, entry) => sum + Number(entry.porcentaje || 0), 0).toFixed(3));
}
function refreshSpecialObjectiveSeasonStats(){
  if(!game || typeof ensureManagerCurrentSeasonStats !== 'function') return null;
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, game.selectedClubId || 0);
  return game.managerStats?.currentSeason || null;
}
function applySpecialObjectiveSeasonUse(card, origin='activacion', stateRef=null){
  if(!specialCardIsObjectiveReduction(card)) return { applied:0, total:specialObjectiveSeasonReduction(stateRef) };
  const state = stateRef && typeof stateRef === 'object' ? stateRef : ensureSpecialState();
  if(!state) return { applied:0, total:0 };
  const ledger = specialObjectiveSeasonReductionState(state);
  const value = Math.max(0, Number(card?.valor_bonus || 0));
  if(value <= 0) return { applied:0, total:Number(ledger.porcentaje || 0) };
  const before = Number(ledger.porcentaje || 0);
  const after = clamp(before + value, 0, specialObjectiveSeasonCap());
  const applied = Math.max(0, Number((after - before).toFixed(3)));
  if(applied <= 0) return { applied:0, total:before, capped:true };
  ledger.aplicaciones.push({
    id:`objective-season-${ledger.temporada}-${Date.now()}-${ledger.aplicaciones.length + 1}`,
    temporada:ledger.temporada,
    id_carta:String(card.id_carta || ''),
    id_base:String(card.id_base || ''),
    nombre_carta:String(card.nombre || 'Carta de objetivo'),
    porcentaje:applied,
    origen:String(origin || 'activacion'),
    fecha:validIsoDate(specialCurrentDate()) ? specialCurrentDate() : null,
    turno:typeof currentTurnIndex === 'function' ? currentTurnIndex() : null
  });
  ledger.aplicaciones = ledger.aplicaciones.slice(-120);
  ledger.porcentaje=Number(after.toFixed(3));
  state.objetivo_reduccion_temporada=ledger;
  refreshSpecialObjectiveSeasonStats();
  return { applied, total:ledger.porcentaje, capped:after >= specialObjectiveSeasonCap() };
}
function resetSpecialObjectiveReductionForNewSeason(season=game?.seasonNumber || 1){
  if(!game) return null;
  const normalizedSeason = Math.max(1, Math.round(Number(season || 1)));
  const state = game.special && typeof game.special === 'object' ? game.special : createInitialSpecialState(game.rankingManagerName || storedManagerName() || 'Manager');
  state.objetivo_reduccion_temporada = {
    version:'V9.49',
    temporada:normalizedSeason,
    porcentaje:0,
    aplicaciones:[],
    migrada_desde_v944:true
  };
  game.special = state;
  return state.objetivo_reduccion_temporada;
}
function specialObjectiveActivationCount(card){
  if(!specialCardIsObjectiveReduction(card)) return 0;
  const maxUses = specialMaxUsesForRarity(card?.rareza);
  const explicit = Number(card?.activaciones_efecto ?? card?.activaciones_objetivo ?? card?.objectiveActivationCount);
  if(Number.isFinite(explicit)) return clamp(Math.round(explicit), 0, maxUses);
  const legacyUsed = clamp(Math.round(Number(card?.activaciones_usadas || 0)), 0, maxUses);
  if(legacyUsed <= 0) return 0;
  // Migración V9.44: antes activar + desactivar consumían dos usos. Se reconstruye
  // la cantidad más probable de activaciones reales sin inflar el efecto acumulado.
  return clamp(Math.max(card?.activa ? 1 : 0, Math.ceil(legacyUsed / 2)), 0, maxUses);
}
function specialCardEffectiveBonus(card){
  const base = Number(card?.valor_bonus || 0);
  if(!specialCardIsObjectiveReduction(card)) return base;
  return base * specialObjectiveActivationCount(card);
}

function specialDatabase(){
  return specialSkillsDatabase && typeof specialSkillsDatabase === 'object' ? specialSkillsDatabase : { limites:{}, sobres:{}, cartas_base:[], puntos_ocultos:{ acciones:{} }, destruir_cartas:{ recuperacion_puntos:{} }, apilamiento_bonus:{} };
}
function specialLimits(){
  const db = specialDatabase();
  return {
    activeMax: Math.max(1, Math.round(Number(db.limites?.cartas_activas_max || 5))),
    reserveMax: Math.max(1, Math.round(Number(db.limites?.cartas_reserva_max || 50))),
    lockDays: Math.max(0, Math.round(Number(db.limites?.dias_bloqueo_cambio_cartas || 15))),
    activeUseDays: Math.max(1, Math.round(Number(db.limites?.dias_por_consumo_activo || 100))),
    consumeOnDeactivate: db.limites?.consumir_uso_al_desactivar !== false,
    maxUsesPerCard: Math.max(1, Math.round(Number(db.limites?.activaciones_por_carta || 5))),
    maxUsesByRarity:{ ...SPECIAL_MAX_USES_BY_RARITY, ...(db.limites?.activaciones_por_rareza || {}) },
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
    puntos_log_secuencia: 0,
    cartas_activas: [],
    cartas_reserva: [],
    fecha_ultimo_cambio_cartas: null,
    bloqueado_hasta: null,
    historial_ultimas_cartas: [],
    apertura_pendiente: null,
    puntos_log: [],
    codigos_reclamados: {},
    recompensas_calidad_vida:{ version:1, primera_victoria:false },
    objetivo_reduccion_temporada: {
      version:'V9.49',
      temporada:specialObjectiveSeasonNumber(),
      porcentaje:0,
      aplicaciones:[],
      migrada_desde_v944:true
    },
    cartas_globales_version: 'V5.78'
  };
}
function normalizeSpecialCard(card, index=0){
  if(!card || typeof card !== 'object') return null;
  const base = specialCardBaseById(card.id_base || card.baseId) || {};
  const id = String(card.id_carta || card.id || `CARD-${Date.now()}-${index}-${hashNumber(JSON.stringify(card), 100000)}`);
  const activatedTurn = Number.isFinite(Number(card.activada_en_turno ?? card.activatedTurn)) ? Math.max(0, Math.round(Number(card.activada_en_turno ?? card.activatedTurn))) : null;
  const lockedUntilTurn = Number.isFinite(Number(card.bloqueada_hasta_turno ?? card.lockedUntilTurn)) ? Math.max(0, Math.round(Number(card.bloqueada_hasta_turno ?? card.lockedUntilTurn))) : null;
  const rarity = String(card.rareza || base.rareza || 'inutil');
  const maxUses = specialMaxUsesForRarity(rarity);
  const bonusType = card.tipo_bonus ?? base.tipo_bonus ?? null;
  const usedRaw = Number(card.activaciones_usadas ?? card.usedActivations ?? card.usos_usados ?? 0);
  let used = clamp(Math.round(Number.isFinite(usedRaw) ? usedRaw : 0), 0, maxUses);
  let effectActivations = 0;
  if(String(bonusType || '') === 'objetivo_mas_bajo'){
    const explicitEffect = Number(card.activaciones_efecto ?? card.activaciones_objetivo ?? card.objectiveActivationCount);
    effectActivations = Number.isFinite(explicitEffect)
      ? clamp(Math.round(explicitEffect), 0, maxUses)
      : clamp(Math.max(Boolean(card.activa) && used > 0 ? 1 : 0, Math.ceil(used / 2)), 0, maxUses);
    // En V9.44 los usos de estas cartas equivalen únicamente a activaciones acumuladas.
    used = effectActivations;
  }
  const physicalRecoveryPoints = bonusType === 'preparacion_fisica' ? specialPhysicalRecoveryPointsForRarity(rarity) : null;
  return {
    id_carta:id,
    id_base:String(card.id_base || base.id_base || ''),
    manager_id:String(card.manager_id || game?.saveCode || ''),
    nombre:String(card.nombre || base.nombre || 'Carta'),
    rareza:rarity,
    tipo_bonus:bonusType,
    valor_bonus:physicalRecoveryPoints !== null ? physicalRecoveryPoints : (Number(card.valor_bonus ?? base.valor_bonus ?? 0) || 0),
    unidad:physicalRecoveryPoints !== null ? 'puntos' : String(card.unidad || base.unidad || ''),
    activable:card.activable !== undefined ? Boolean(card.activable) : Boolean(base.activable),
    texto:physicalRecoveryPoints !== null ? `Suma +${physicalRecoveryPoints} puntos de recuperación física después del partido.` : String(card.texto || base.texto || ''),
    activa:Boolean(card.activa),
    destruida:Boolean(card.destruida),
    obtenida_en_turno:card.obtenida_en_turno ?? currentTurnIndex(),
    obtenida_desde_sobre:String(card.obtenida_desde_sobre || ''),
    activada_en:validIsoDate(card.activada_en) ? card.activada_en : null,
    bloqueada_hasta:validIsoDate(card.bloqueada_hasta) ? card.bloqueada_hasta : null,
    activada_en_turno:activatedTurn,
    bloqueada_hasta_turno:lockedUntilTurn,
    ciclo_uso_desde:validIsoDate(card.ciclo_uso_desde) ? card.ciclo_uso_desde : (validIsoDate(card.activada_en) ? card.activada_en : null),
    ciclo_uso_desde_turno:Number.isFinite(Number(card.ciclo_uso_desde_turno)) ? Math.max(0, Math.round(Number(card.ciclo_uso_desde_turno))) : activatedTurn,
    agotada_activa_desde:validIsoDate(card.agotada_activa_desde) ? card.agotada_activa_desde : null,
    agotada_activa_desde_turno:Number.isFinite(Number(card.agotada_activa_desde_turno)) ? Math.max(0, Math.round(Number(card.agotada_activa_desde_turno))) : null,
    activaciones_max:maxUses,
    activaciones_usadas:used,
    activaciones_efecto:effectActivations,
    active_slot_id:String(card.active_slot_id || card.activeSaveSlotId || card.slot_activo || ''),
    ultimo_slot_activacion:String(card.ultimo_slot_activacion || card.lastActivationSlot || '')
  };
}

function currentSpecialSaveSlotId(){
  if(typeof gameSlotId === 'function') return gameSlotId();
  if(typeof normalizeSaveSlotId === 'function') return normalizeSaveSlotId(game?.saveSlotId || currentSaveSlotId || SAVE_SLOT_CAREER);
  return String(game?.saveSlotId || 'career:1');
}
function readSpecialGlobalCardsState(){
  try{
    const raw = localStorage.getItem(SPECIAL_GLOBAL_CARDS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if(parsed && typeof parsed === 'object' && !Array.isArray(parsed)){
      return {
        version:String(parsed.version || 'V5.78'),
        cards:(parsed.cards && typeof parsed.cards === 'object' && !Array.isArray(parsed.cards)) ? parsed.cards : {},
        updatedAt:parsed.updatedAt || null
      };
    }
  }catch(err){ console.warn('No se pudo leer inventario global de cartas.', err); }
  return { version:'V5.78', cards:{}, updatedAt:null };
}
function writeSpecialGlobalCardsState(state){
  try{
    const clean = state && typeof state === 'object' ? state : { version:'V5.78', cards:{} };
    clean.version = 'V5.78';
    clean.updatedAt = new Date().toISOString();
    localStorage.setItem(SPECIAL_GLOBAL_CARDS_STORAGE_KEY, JSON.stringify(clean));
    return true;
  }catch(err){ console.warn('No se pudo guardar inventario global de cartas.', err); return false; }
}
function specialCardRemainingUses(card){
  const max = specialMaxUsesForRarity(card?.rareza);
  const used = clamp(Math.round(Number(card?.activaciones_usadas || 0)), 0, max);
  return Math.max(0, max - used);
}
function normalizeSpecialGlobalCard(raw, index=0){
  const card = normalizeSpecialCard(raw, index);
  if(!card) return null;
  card.activaciones_max = specialMaxUsesForRarity(card.rareza);
  card.activaciones_usadas = clamp(Math.round(Number(card.activaciones_usadas || 0)), 0, card.activaciones_max);
  card.activaciones_efecto = specialCardIsObjectiveReduction(card) ? specialObjectiveActivationCount(card) : 0;
  card.active_slot_id = String(card.active_slot_id || '');
  card.ultimo_slot_activacion = String(card.ultimo_slot_activacion || '');
  if(specialCardRemainingUses(card) <= 0 && !card.active_slot_id && !card.activa) card.destruida = true;
  return card;
}
function specialGlobalUpsertCard(rawCard, options={}){
  const card = normalizeSpecialGlobalCard(rawCard);
  if(!card?.id_carta) return null;
  const slotId = options.slotId ? String(options.slotId) : currentSpecialSaveSlotId();
  const asActive = options.zone === 'active' || options.active === true || card.activa;
  const global = options.globalState || readSpecialGlobalCardsState();
  const existing = normalizeSpecialGlobalCard(global.cards?.[card.id_carta] || card) || card;
  const maxUses = specialMaxUsesForRarity(card.rareza || existing.rareza);
  const used = Math.max(Number(existing.activaciones_usadas || 0), Number(card.activaciones_usadas || 0));
  const effectActivations = Math.max(specialObjectiveActivationCount(existing), specialObjectiveActivationCount(card));
  const merged = {
    ...existing,
    ...card,
    activaciones_max:maxUses,
    activaciones_usadas:clamp(Math.round(used), 0, maxUses),
    activaciones_efecto:specialCardIsObjectiveReduction(card) ? clamp(Math.round(effectActivations), 0, maxUses) : 0,
    destruida:Boolean(card.destruida || existing.destruida)
  };
  if(asActive){
    merged.activa = true;
    merged.active_slot_id = String(existing.active_slot_id || card.active_slot_id || slotId || 'global');
    merged.ultimo_slot_activacion = slotId;
    if(merged.activaciones_usadas <= 0) merged.activaciones_usadas = 1;
    if(specialCardIsObjectiveReduction(merged) && merged.activaciones_efecto <= 0) merged.activaciones_efecto = 1;
  } else if(existing.active_slot_id){
    merged.activa = true;
    merged.active_slot_id = existing.active_slot_id;
  } else {
    merged.activa = false;
    merged.active_slot_id = '';
  }
  global.cards = global.cards && typeof global.cards === 'object' ? global.cards : {};
  global.cards[merged.id_carta] = normalizeSpecialGlobalCard(merged) || merged;
  if(!options.globalState) writeSpecialGlobalCardsState(global);
  return global.cards[merged.id_carta];
}
function specialGlobalReleaseCard(rawCard, options={}){
  const card = normalizeSpecialGlobalCard(rawCard);
  if(!card?.id_carta) return null;
  const slotId = options.slotId ? String(options.slotId) : currentSpecialSaveSlotId();
  const global = readSpecialGlobalCardsState();
  const existing = normalizeSpecialGlobalCard(global.cards?.[card.id_carta] || card) || card;
  const released = { ...existing, ...card, activa:false, active_slot_id:'', activada_en:null, bloqueada_hasta:null, activada_en_turno:null, bloqueada_hasta_turno:null, ultimo_slot_activacion:String(slotId || existing.ultimo_slot_activacion || '') };
  if(options.destroy || options.exhausted || specialCardRemainingUses(released) <= 0){
    released.destruida = true;
  }
  global.cards = global.cards && typeof global.cards === 'object' ? global.cards : {};
  global.cards[released.id_carta] = normalizeSpecialGlobalCard(released) || released;
  writeSpecialGlobalCardsState(global);
  return global.cards[released.id_carta];
}
function specialGlobalDestroyCard(rawCard, options={}){
  const card = normalizeSpecialGlobalCard(rawCard);
  if(!card?.id_carta) return null;
  const global = readSpecialGlobalCardsState();
  const existing = normalizeSpecialGlobalCard(global.cards?.[card.id_carta] || card) || card;
  const destroyed = {
    ...existing,
    ...card,
    activa:false,
    active_slot_id:'',
    activada_en:null,
    bloqueada_hasta:null,
    activada_en_turno:null,
    bloqueada_hasta_turno:null,
    destruida:true,
    destruida_en:new Date().toISOString(),
    motivo_destruccion:String(options.reason || 'destroy')
  };
  global.cards = global.cards && typeof global.cards === 'object' ? global.cards : {};
  global.cards[destroyed.id_carta] = normalizeSpecialGlobalCard(destroyed) || destroyed;
  writeSpecialGlobalCardsState(global);
  return global.cards[destroyed.id_carta];
}
function removeSpecialCardEverywhereInState(state, cardId){
  if(!state || !cardId) return 0;
  const id = String(cardId);
  const beforeActive = Array.isArray(state.cartas_activas) ? state.cartas_activas.length : 0;
  const beforeReserve = Array.isArray(state.cartas_reserva) ? state.cartas_reserva.length : 0;
  state.cartas_activas = (Array.isArray(state.cartas_activas) ? state.cartas_activas : []).filter(card => String(card.id_carta || '') !== id);
  state.cartas_reserva = (Array.isArray(state.cartas_reserva) ? state.cartas_reserva : []).filter(card => String(card.id_carta || '') !== id);
  return Math.max(0, beforeActive - state.cartas_activas.length) + Math.max(0, beforeReserve - state.cartas_reserva.length);
}
function specialGlobalCardsForSlot(slotId=currentSpecialSaveSlotId()){
  const slot = String(slotId || currentSpecialSaveSlotId());
  const global = readSpecialGlobalCardsState();
  return Object.values(global.cards || {})
    .map((card, index) => normalizeSpecialGlobalCard(card, index))
    .filter(Boolean)
    .filter(card => !card.destruida)
    // Las cartas activas son exclusivas del slot que las activó; las reservas siguen siendo globales.
    .filter(card => !card.active_slot_id || String(card.active_slot_id) === slot)
    .filter(card => specialCardRemainingUses(card) > 0 || Boolean(card.active_slot_id));
}
function syncSpecialStateWithGlobalCards(state){
  if(!state || typeof state !== 'object') return state;
  const slotId = currentSpecialSaveSlotId();
  const global = readSpecialGlobalCardsState();
  global.cards = global.cards && typeof global.cards === 'object' ? global.cards : {};
  const localReserveIds = new Set();
  const localActiveIds = new Set();
  (Array.isArray(state.cartas_reserva) ? state.cartas_reserva : []).forEach((rawCard, index) => {
    const card = normalizeSpecialGlobalCard(rawCard, index);
    if(!card?.id_carta || card.destruida) return;
    localReserveIds.add(String(card.id_carta));
  });
  (Array.isArray(state.cartas_activas) ? state.cartas_activas : []).forEach((rawCard, index) => {
    const card = normalizeSpecialGlobalCard(rawCard, index);
    if(!card?.id_carta || card.destruida) return;
    localActiveIds.add(String(card.id_carta));
  });
  (Array.isArray(state.cartas_reserva) ? state.cartas_reserva : []).forEach((rawCard, index) => {
    const card = normalizeSpecialGlobalCard(rawCard, index);
    if(!card?.id_carta || card.destruida) return;
    const existing = normalizeSpecialGlobalCard(global.cards?.[card.id_carta] || null);
    if(existing?.destruida) return;
    // Si una carta figura en reserva local, la reserva manda sobre una marca activa global vieja.
    // Evita el caso: “está en reserva” pero el sistema dice “ya está activa”.
    if(existing?.active_slot_id && !localActiveIds.has(String(card.id_carta))){
      global.cards[card.id_carta] = normalizeSpecialGlobalCard({ ...existing, ...card, activa:false, active_slot_id:'', activada_en:null, bloqueada_hasta:null, activada_en_turno:null, bloqueada_hasta_turno:null }) || card;
    } else if(!global.cards[card.id_carta]) {
      specialGlobalUpsertCard({ ...card, activa:false, active_slot_id:'' }, { globalState:global, slotId, zone:'reserve' });
    }
  });
  (Array.isArray(state.cartas_activas) ? state.cartas_activas : []).forEach((rawCard, index) => {
    const card = normalizeSpecialGlobalCard(rawCard, index);
    if(!card?.id_carta || card.destruida) return;
    const existing = normalizeSpecialGlobalCard(global.cards?.[card.id_carta] || null);
    if(existing?.destruida) return;
    specialGlobalUpsertCard({ ...existing, ...card, activa:true, active_slot_id:slotId }, { globalState:global, slotId, zone:'active' });
  });
  writeSpecialGlobalCardsState(global);
  const available = specialGlobalCardsForSlot(slotId);
  const active = [];
  const reserve = [];
  available.forEach((card, index) => {
    const clean = normalizeSpecialGlobalCard(card, index);
    if(!clean || clean.destruida) return;
    if(clean.active_slot_id){
      clean.activa = true;
      active.push(clean);
    } else if(!clean.active_slot_id && specialCardRemainingUses(clean) > 0){
      clean.activa = false;
      reserve.push(clean);
    }
  });
  state.cartas_activas = active;
  state.cartas_reserva = reserve;
  state.cartas_globales_version = 'V5.78';
  return state;
}

function resetActiveSpecialCardsToReserveForNewClub(options={}){
  // al comenzar en un nuevo club, ninguna carta queda activa automáticamente.
  // Los usos ya consumidos se mantienen; la carta vuelve a reserva si aún tiene usos disponibles.
  if(!game) return { changed:0, returned:0, destroyed:0 };
  const state = ensureSpecialState();
  if(!state) return { changed:0, returned:0, destroyed:0 };
  const active = Array.isArray(state.cartas_activas) ? state.cartas_activas.slice() : [];
  if(!active.length) return { changed:0, returned:0, destroyed:0 };
  const slotId = currentSpecialSaveSlotId();
  state.cartas_activas = [];
  state.cartas_reserva = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  const reserveIds = new Set(state.cartas_reserva.map(card => String(card.id_carta || '')));
  let returned = 0;
  let destroyed = 0;
  active.forEach((rawCard, index) => {
    const card = normalizeSpecialGlobalCard(rawCard, index);
    if(!card || card.destruida) return;
    const remaining = specialCardRemainingUses(card);
    if(remaining > 0){
      const released = {
        ...card,
        activa:false,
        active_slot_id:'',
        activada_en:null,
        bloqueada_hasta:null,
        activada_en_turno:null,
        bloqueada_hasta_turno:null,
        ultimo_slot_activacion:String(slotId || card.ultimo_slot_activacion || '')
      };
      specialGlobalReleaseCard(released, { slotId, reason:options.reason || 'new_club' });
      if(!reserveIds.has(String(released.id_carta || ''))){
        state.cartas_reserva.push(released);
        reserveIds.add(String(released.id_carta || ''));
      }
      returned += 1;
    } else {
      specialGlobalReleaseCard(card, { slotId, exhausted:true, reason:options.reason || 'new_club' });
      state.historial_ultimas_cartas = [{ ...card, activa:false, destruida:true, agotada_por_usos:true, motivo:'Cambio de club' }].concat(state.historial_ultimas_cartas || []).slice(0, 30);
      destroyed += 1;
    }
  });
  game.special = syncSpecialStateWithGlobalCards(state);
  return { changed:returned + destroyed, returned, destroyed };
}
async function migrateAllSavedSpecialCardsToGlobal(){
  if(typeof readLocalSaveRecord !== 'function') return false;
  const slotIds = [];
  if(typeof careerSaveSlotIds === 'function') slotIds.push(...careerSaveSlotIds());
  else slotIds.push(typeof SAVE_SLOT_CAREER !== 'undefined' ? SAVE_SLOT_CAREER : 'career:1');
  if(typeof SAVE_SLOT_CAMPO_DESTRUIDO !== 'undefined') slotIds.push(SAVE_SLOT_CAMPO_DESTRUIDO);
  const global = readSpecialGlobalCardsState();
  global.cards = global.cards && typeof global.cards === 'object' ? global.cards : {};
  for(const rawSlot of Array.from(new Set(slotIds))){
    const slotId = typeof normalizeSaveSlotId === 'function' ? normalizeSaveSlotId(rawSlot) : rawSlot;
    const record = await readLocalSaveRecord(slotId).catch(()=>null);
    const special = record?.special;
    if(!special || typeof special !== 'object') continue;
    (Array.isArray(special.cartas_reserva) ? special.cartas_reserva : []).forEach((card, index) => {
      const clean = normalizeSpecialGlobalCard(card, index);
      if(clean && !clean.destruida && !global.cards[clean.id_carta]) specialGlobalUpsertCard({ ...clean, activa:false, active_slot_id:'' }, { globalState:global, slotId, zone:'reserve' });
    });
    (Array.isArray(special.cartas_activas) ? special.cartas_activas : []).forEach((card, index) => {
      const clean = normalizeSpecialGlobalCard(card, index);
      if(clean && !clean.destruida && !global.cards[clean.id_carta]) specialGlobalUpsertCard({ ...clean, activa:true, active_slot_id:slotId }, { globalState:global, slotId, zone:'active' });
    });
  }
  writeSpecialGlobalCardsState(global);
  return true;
}
function normalizeSpecialState(state=null, managerName=''){
  const base = createInitialSpecialState(managerName);
  const source = state && typeof state === 'object' ? state : {};
  const normalized = { ...base, ...source };
  normalized.manager_id = String(normalized.manager_id || game?.saveCode || '');
  normalized.nombre_manager = String(normalized.nombre_manager || managerName || storedManagerName() || 'Manager');
  normalized.puntos_habilidad = Math.max(0, Math.round(Number(normalized.puntos_habilidad || 0)));
  const rawPointsLog = Array.isArray(normalized.puntos_log) ? normalized.puntos_log.slice(-80) : [];
  let pointsLogSequence = Math.max(0, Math.round(Number(normalized.puntos_log_secuencia || 0)));
  normalized.puntos_log = rawPointsLog.map(entry => {
    const source = entry && typeof entry === 'object' ? entry : {};
    const existingSerial = Math.max(0, Math.round(Number(source.serial || 0)));
    if(existingSerial > pointsLogSequence) pointsLogSequence = existingSerial;
    return existingSerial ? source : { ...source, serial:++pointsLogSequence };
  });
  normalized.puntos_log_secuencia = pointsLogSequence;
  normalized.recompensas_calidad_vida = normalized.recompensas_calidad_vida && typeof normalized.recompensas_calidad_vida === 'object' && !Array.isArray(normalized.recompensas_calidad_vida)
    ? { version:1, ...normalized.recompensas_calidad_vida, primera_victoria:Boolean(normalized.recompensas_calidad_vida.primera_victoria) }
    : { version:1, primera_victoria:false };
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
  const rawPendingOpening = normalized.apertura_pendiente && typeof normalized.apertura_pendiente === 'object' ? normalized.apertura_pendiente : null;
  if(rawPendingOpening){
    const pendingCards = (Array.isArray(rawPendingOpening.cartas) ? rawPendingOpening.cartas : [])
      .map((card, index) => normalizeSpecialCard(card, index))
      .filter(Boolean)
      .filter(card => !card.destruida);
    const pendingCardIds = new Set(pendingCards.map(card => String(card.id_carta || '')).filter(Boolean));
    const revealedIds = Array.from(new Set(Array.isArray(rawPendingOpening.reveladas) ? rawPendingOpening.reveladas.map(String) : []))
      .filter(id => pendingCardIds.has(id));
    normalized.apertura_pendiente = pendingCards.length ? {
      id:String(rawPendingOpening.id || `OPEN-${Date.now()}-${hashNumber(JSON.stringify(pendingCards.map(card => card.id_carta)), 1000000)}`),
      sobre_id:String(rawPendingOpening.sobre_id || rawPendingOpening.packId || ''),
      sobre_nombre:String(rawPendingOpening.sobre_nombre || rawPendingOpening.packName || 'Sobre'),
      costo:Math.max(0, Math.round(Number(rawPendingOpening.costo || 0))),
      cartas:pendingCards,
      reveladas:revealedIds,
      creada_en:String(rawPendingOpening.creada_en || rawPendingOpening.createdAt || new Date().toISOString()),
      completa:revealedIds.length >= pendingCards.length
    } : null;
  } else {
    normalized.apertura_pendiente = null;
  }
  normalized.codigos_reclamados = (normalized.codigos_reclamados && typeof normalized.codigos_reclamados === 'object' && !Array.isArray(normalized.codigos_reclamados)) ? normalized.codigos_reclamados : {};
  normalized.fecha_ultimo_cambio_cartas = validIsoDate(normalized.fecha_ultimo_cambio_cartas) ? normalized.fecha_ultimo_cambio_cartas : null;
  normalized.bloqueado_hasta = validIsoDate(normalized.bloqueado_hasta) ? normalized.bloqueado_hasta : null;
  normalized.objetivo_reduccion_temporada = normalizeSpecialObjectiveSeasonReduction(source.objetivo_reduccion_temporada, normalized);
  return syncSpecialStateWithGlobalCards(normalized);
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
  const pending = game.special.apertura_pendiente;
  if(pending?.id && String(pending.id) !== String(specialPendingOpeningRuntimeId || '')){
    const recovered = commitPendingSpecialOpeningToReserve(game.special, 'recuperacion_al_cargar');
    if(recovered.count > 0) game._needsAutosave = true;
  }
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
    socios_extra:'Socios ganados extra',
    idolo_club:'Ídolo del Club',
    especialista_libres:'Especialista en libres',
    preparacion_fisica:'Preparación física',
    apoyo_capitan:'Todo al apoyo a mi capitán',
    director_marketing:'Director de marketing',
    director_deportivo:'Director deportivo',
    medico_milagroso:'Médico milagroso',
    prevencion_lesiones_partido:'Prevención de lesiones',
    experto_juveniles:'Experto en juveniles',
    cohesion_activar:'Cohesión al activar'
  };
  return labels[type] || String(type || 'Sin bonus');
}
function specialCardBonusText(card){
  if(!card?.tipo_bonus || !card.valor_bonus) return 'Sin bonus activo';
  const baseValue = Number(card.valor_bonus || 0);
  if(specialCardIsObjectiveReduction(card)){
    const seasonalContribution = specialObjectiveSeasonContributionForCard(card?.id_carta);
    return seasonalContribution > 0
      ? `${specialBonusLabel(card.tipo_bonus)}: -${baseValue}% por uso · aportó -${seasonalContribution}% esta temporada`
      : `${specialBonusLabel(card.tipo_bonus)}: -${baseValue}% permanente por uso durante la temporada`;
  }
  const value = baseValue;
  if(card.tipo_bonus === 'medico_milagroso') return `${specialBonusLabel(card.tipo_bonus)}: -${value} día${value === 1 ? '' : 's'} extra por tratamiento`;
  if(card.tipo_bonus === 'prevencion_lesiones_partido') return `${specialBonusLabel(card.tipo_bonus)}: -${value}% de probabilidad durante partidos`;
  if(card.tipo_bonus === 'experto_juveniles') return `${specialBonusLabel(card.tipo_bonus)}: +${value} habilidad${value === 1 ? '' : 'es'} por consulta`;
  const unit = card.unidad === 'porcentaje_relativo' ? '% relativo' : (card.unidad === 'porcentaje' ? '%' : (card.unidad === 'puntos' ? ' pts' : ''));
  const sign = ['deterioro_campo','objetivo_mas_bajo'].includes(card.tipo_bonus) ? '-' : '+';
  const suffix = card.tipo_bonus === 'cohesion_activar' ? ' una vez al activar' : '';
  return `${specialBonusLabel(card.tipo_bonus)}: ${sign}${value}${unit}${suffix}`;
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
    if(Number.isFinite(Number(card.activada_en_turno))){
      card.activada_en_turno = Math.max(0, Math.round(Number(card.activada_en_turno || 0)));
      card.bloqueada_hasta_turno = Math.min(card.bloqueada_hasta_turno, card.activada_en_turno + lockDays);
    } else {
      card.activada_en_turno = Math.max(0, card.bloqueada_hasta_turno - lockDays);
      card.bloqueada_hasta_turno = Math.min(card.bloqueada_hasta_turno, card.activada_en_turno + lockDays);
    }
    if(validIsoDate(card.activada_en) && (!validIsoDate(card.bloqueada_hasta) || daysBetweenIsoDates(card.activada_en, card.bloqueada_hasta) > lockDays)){
      card.bloqueada_hasta = addDaysToIsoDate(card.activada_en, lockDays);
    }
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
function specialActiveCardUsageInfo(card, today=specialCurrentDate(), nowTurn=(typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0)){
  const cycleDays = specialLimits().activeUseDays;
  const cycleDate = validIsoDate(card?.ciclo_uso_desde) ? card.ciclo_uso_desde : (validIsoDate(card?.activada_en) ? card.activada_en : today);
  const cycleTurn = Number.isFinite(Number(card?.ciclo_uso_desde_turno)) ? Math.round(Number(card.ciclo_uso_desde_turno)) : (Number.isFinite(Number(card?.activada_en_turno)) ? Math.round(Number(card.activada_en_turno)) : nowTurn);
  const elapsedByDate = validIsoDate(cycleDate) && validIsoDate(today) ? Math.max(0, daysBetweenIsoDates(cycleDate, today)) : 0;
  const elapsedByTurn = Math.max(0, nowTurn - cycleTurn);
  const elapsed = Math.max(elapsedByDate, elapsedByTurn);
  return { cycleDays, cycleDate, cycleTurn, elapsed, due:elapsed >= cycleDays };
}
function expireActiveSpecialCard(state, card, reason='active_cycle_exhausted'){
  if(!state || !card?.id_carta) return false;
  removeSpecialCardEverywhereInState(state, card.id_carta);
  specialGlobalDestroyCard({ ...card, activa:false, active_slot_id:'', destruida:true }, { slotId:currentSpecialSaveSlotId(), reason });
  state.historial_ultimas_cartas = [{ ...card, activa:false, active_slot_id:'', destruida:true, agotada_por_usos:true, motivo:'100 días activa sin usos' }].concat(state.historial_ultimas_cartas || []).slice(0,30);
  return true;
}
function processActiveSpecialCardUsageDaily(options={}){
  if(!game) return { processed:0, consumed:0, expired:0 };
  const state = ensureSpecialState();
  const active = Array.isArray(state.cartas_activas) ? state.cartas_activas.slice() : [];
  if(!active.length) return { processed:0, consumed:0, expired:0 };
  const today = specialCurrentDate();
  const nowTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  let consumed = 0;
  let expired = 0;
  active.forEach(card => {
    const info = specialActiveCardUsageInfo(card, today, nowTurn);
    if(!info.due) return;
    const remainingBefore = specialCardRemainingUses(card);
    if(remainingBefore <= 0){
      if(info.elapsed > info.cycleDays && expireActiveSpecialCard(state, card, 'active_zero_uses_day_101')) expired += 1;
      return;
    }
    card.activaciones_usadas = clamp(Math.round(Number(card.activaciones_usadas || 0)) + 1, 0, specialMaxUsesForRarity(card.rareza));
    if(specialCardIsObjectiveReduction(card)){
      card.activaciones_efecto = clamp(specialObjectiveActivationCount(card) + 1, 0, specialMaxUsesForRarity(card.rareza));
      applySpecialObjectiveSeasonUse(card, 'renovacion_automatica', state);
    }
    card.ciclo_uso_desde = today;
    card.ciclo_uso_desde_turno = nowTurn;
    if(specialCardRemainingUses(card) <= 0){
      card.agotada_activa_desde = today;
      card.agotada_activa_desde_turno = nowTurn;
    }
    consumed += 1;
    specialGlobalUpsertCard(card, { slotId:currentSpecialSaveSlotId(), zone:'active' });
  });
  game.special = syncSpecialStateWithGlobalCards(state);
  if(expired > 0 && typeof pushGameMessage === 'function'){
    pushGameMessage({
      id:`special-active-slot-free-${game?.seasonNumber || 1}-${today}-${expired}`,
      type:'especial',
      priority:'normal',
      title:'Cupo de bonus disponible',
      body:expired === 1 ? 'Hay un cupo para bonus de habilidades libre.' : `Hay ${expired} cupos para bonus de habilidades libres.`
    });
  }
  if((consumed > 0 || expired > 0) && options.save !== false && typeof saveLocal === 'function') saveLocal(true);
  return { processed:active.length, consumed, expired };
}
function specialActiveBonus(type){
  const state = ensureSpecialState();
  if(!state) return 0;
  if(String(type || '') === 'objetivo_mas_bajo') return specialObjectiveSeasonReduction(state);
  const db = specialDatabase();
  const stack = db.apilamiento_bonus?.[type] || {};
  const raw = (state.cartas_activas || [])
    .filter(card => card.tipo_bonus === type && !card.destruida)
    .reduce((sum, card) => sum + Number(specialCardEffectiveBonus(card) || 0), 0);
  const capRaw = stack.tope_porcentaje;
  const cap = capRaw === null || capRaw === undefined || capRaw === '' ? null : Number(capRaw);
  return Number.isFinite(cap) ? Math.min(raw, cap) : raw;
}

function specialMatchInjuryMultiplier(clubId=game?.selectedClubId){
  const ownId = Number(game?.selectedClubId || 0);
  if(!ownId || Number(clubId || 0) !== ownId) return 1;
  const prevention = clamp(Number(specialActiveBonus('prevencion_lesiones_partido') || 0), 0, 95);
  return clamp(1 - prevention / 100, 0.05, 1);
}

function specialActiveBonusSummary(){
  return ['sponsors_extra','deterioro_campo','probabilidad_legendaria','objetivo_mas_bajo','socios_extra','idolo_club','especialista_libres','preparacion_fisica','apoyo_capitan','director_marketing','director_deportivo','medico_milagroso','prevencion_lesiones_partido','experto_juveniles']
    .map(type => ({ type, value:specialActiveBonus(type) }))
    .filter(item => item.value > 0);
}
function specialBonusSummaryText(item){
  if(!item) return '';
  const sign = ['deterioro_campo','objetivo_mas_bajo','medico_milagroso','prevencion_lesiones_partido'].includes(item.type) ? '-' : '+';
  let suffix = '% acumulado';
  if(item.type === 'objetivo_mas_bajo') suffix = '% vigente durante esta temporada';
  else if(item.type === 'probabilidad_legendaria') suffix = '% relativo acumulado';
  else if(item.type === 'preparacion_fisica') suffix = ' pts postpartido acumulados';
  else if(item.type === 'apoyo_capitan') suffix = ' pts de progreso por partido';
  else if(item.type === 'director_deportivo') suffix = ' pts de cláusula ofertada';
  else if(item.type === 'medico_milagroso') suffix = ' días extra por tratamiento';
  else if(item.type === 'prevencion_lesiones_partido') suffix = '% de probabilidad durante partidos';
  else if(item.type === 'experto_juveniles') suffix = ' habilidades por consulta';
  return `${sign}${Number(item.value || 0)}${suffix}`;
}
function applySpecialCohesionActivationBonus(card){
  if(!game || !card || card.tipo_bonus !== 'cohesion_activar') return 0;
  const clubId = Number(game.selectedClubId || 0);
  if(!clubId) return 0;
  const gain = Math.max(0, Math.round(Number(card.valor_bonus || 0)));
  if(gain <= 0) return 0;
  if(!game.teamCohesion || typeof game.teamCohesion !== 'object') game.teamCohesion = {};
  const current = typeof cohesionValue === 'function' ? cohesionValue(clubId) : Number(game.teamCohesion[clubId] || 0);
  game.teamCohesion[clubId] = clamp(Math.round(current + gain), 0, 100);
  return Math.max(0, game.teamCohesion[clubId] - current);
}
function specialActiveRulesDetailMarkup(activeCards=[], limits=specialLimits()){
  const totals = specialActiveBonusSummary();
  const totalsMarkup = totals.length ? `<div class="special-bonus-list compact">${totals.map(item => `<div><strong>${escapeHtml(specialBonusLabel(item.type))}</strong><span>${escapeHtml(specialBonusSummaryText(item))}</span></div>`).join('')}</div>` : '';
  if(!activeCards.length){
    const seasonalReduction = specialObjectiveSeasonReduction();
    const note = seasonalReduction > 0
      ? `<p class="muted small">No hay cartas activas. La reducción de objetivo ya utilizada permanece aplicada hasta terminar la temporada.</p>`
      : '<p class="muted small">No hay cartas activas. Activá cartas desde la reserva para aplicar sus bonus.</p>';
    return `${totalsMarkup}${note}`;
  }
  const cardsMarkup = `<div class="special-active-rules-list">${activeCards.map(card => {
    const info = specialCardActiveLockInfo(card);
    const usage = specialActiveCardUsageInfo(card);
    const usageRemaining = Math.max(0, usage.cycleDays - usage.elapsed);
    const cycleLabel = specialCardIsObjectiveReduction(card) ? 'nuevo uso permanente' : 'uso automático';
    const status = info.locked ? `Fija ${formatDays(info.remaining)} · ${cycleLabel} en ${formatDays(usageRemaining)}` : `Lista para desactivar · ${cycleLabel} en ${formatDays(usageRemaining)}`;
    return `<div><strong>${escapeHtml(card.nombre)}</strong><span>${escapeHtml(specialCardBonusText(card))}</span><em>${escapeHtml(status)}</em></div>`;
  }).join('')}</div>`;
  return `${totalsMarkup}${cardsMarkup}<p class="muted small">Activas: ${activeCards.length}/${limits.activeMax}. Las reducciones de objetivo ya aplicadas no dependen de este estado.</p>`;
}
function appendSpecialPointsLog(state, entry={}){
  if(!state || typeof state !== 'object') return null;
  state.puntos_log = Array.isArray(state.puntos_log) ? state.puntos_log : [];
  const maxExisting = state.puntos_log.reduce((max, item) => Math.max(max, Math.max(0, Math.round(Number(item?.serial || 0)))), 0);
  const nextSerial = Math.max(maxExisting, Math.max(0, Math.round(Number(state.puntos_log_secuencia || 0)))) + 1;
  const record = { ...(entry && typeof entry === 'object' ? entry : {}), serial:nextSerial };
  state.puntos_log.push(record);
  if(state.puntos_log.length > 80) state.puntos_log = state.puntos_log.slice(-80);
  state.puntos_log_secuencia = nextSerial;
  return record;
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
  appendSpecialPointsLog(state, { actionId, points, ...turnStamp({ date:game?.currentDate || '', ...context }) });
  if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'award_special_points' });
  return points;
}
function awardFirstManagerVictorySkillPoints(match){
  if(!game || !match || match?.friendly) return 0;
  const state = ensureSpecialState();
  if(!state) return 0;
  state.recompensas_calidad_vida = state.recompensas_calidad_vida && typeof state.recompensas_calidad_vida === 'object' && !Array.isArray(state.recompensas_calidad_vida)
    ? { version:1, ...state.recompensas_calidad_vida }
    : { version:1, primera_victoria:false };
  if(state.recompensas_calidad_vida.primera_victoria) return 0;
  const isHome = Number(match.homeId) === Number(game.selectedClubId);
  const gf = isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
  const gc = isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
  if(gf <= gc) return 0;
  const retroactive = Boolean(state.recompensas_calidad_vida.premio_retroactivo_pendiente);
  state.recompensas_calidad_vida.primera_victoria = true;
  state.recompensas_calidad_vida.primera_victoria_fecha = String(game.currentDate || match.date || '');
  state.recompensas_calidad_vida.primera_victoria_partido = String(match.id || '');
  state.recompensas_calidad_vida.premio_retroactivo_pendiente = false;
  state.recompensas_calidad_vida.retroactivo_v972 = retroactive;
  const points = awardSpecialPoints('primera_victoria_manager', { matchId:match.id, motivo:retroactive ? 'premio_retroactivo_actualizacion' : 'primera_victoria' });
  if(points > 0 && typeof pushGameMessage === 'function'){
    pushGameMessage({
      type:'sistema', priority:'high', title:'Primera victoria · +5.000 puntos de habilidad',
      body:retroactive
        ? 'Premio retroactivo por actualización: ganaste 5.000 puntos de habilidad al conseguir una nueva victoria. Aprovechalos para fortalecer tus habilidades activas.'
        : 'Ganaste 5.000 puntos de habilidad por tu primera victoria. Aprovechalos para fortalecer tus habilidades activas.',
      id:`primera-victoria-habilidad-${game.saveCode || 'manager'}-${match.id || game.currentDate || '1'}`
    });
  }
  if(typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>{});
  return points;
}
function awardSpecialPointsForOwnMatch(match){
  if(!game || !match) return 0;
  const isHome = Number(match.homeId) === Number(game.selectedClubId);
  const gf = isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
  const gc = isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
  let total = 0;
  if(gf > gc){
    total += awardSpecialPoints('ganar_partido', { matchId:match.id });
    total += awardFirstManagerVictorySkillPoints(match);
  }
  else if(gf === gc) total += awardSpecialPoints('empatar_partido', { matchId:match.id });
  if(gf > 5) total += awardSpecialPoints('meter_mas_de_5_goles_en_un_partido', { matchId:match.id, goals:gf });
  return total;
}
function awardSpecialChampionPoints(division){
  const order = Math.max(1, Math.round(Number(division?.order || 1)));
  const id = order <= 1 ? 'salir_campeon_division_1' : (order === 2 ? 'salir_campeon_division_2' : 'salir_campeon_division_3');
  return awardSpecialPoints(id, { divisionId:division?.id || '', divisionName:division?.name || '' });
}

function specialDateIsoToday(){
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function specialCodesConfig(){
  const cfg = window.GAME_CONFIG?.codigosEspeciales || {};
  const sourceName = String(cfg.fuenteGlobal || 'GAME_WEEKLY_CODES').trim() || 'GAME_WEEKLY_CODES';
  const weekly = window[sourceName] && typeof window[sourceName] === 'object' ? window[sourceName] : {};
  const today = specialDateIsoToday();
  const validFrom = String(weekly.validoDesde || weekly.validFrom || '').trim();
  const validUntil = String(weekly.validoHasta || weekly.validUntil || '').trim();
  const requireValidity = cfg.exigirVigencia !== false;
  const datesValid = !requireValidity || (
    /^\d{4}-\d{2}-\d{2}$/.test(validFrom) &&
    /^\d{4}-\d{2}-\d{2}$/.test(validUntil) &&
    validFrom <= validUntil &&
    today >= validFrom &&
    today <= validUntil
  );
  const codes = Array.isArray(weekly.codigos) ? weekly.codigos.filter(item => item && typeof item === 'object') : [];
  const active = cfg.activo !== false && weekly.activo === true && datesValid && codes.length > 0;
  return {
    active,
    codes: active ? codes : [],
    week: String(weekly.semana || weekly.week || '').trim(),
    validFrom,
    validUntil,
    today,
    datesValid,
    configured: codes.length > 0
  };
}
function normalizeSpecialCodeValue(value=''){
  return String(value || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}
function specialSha256Ascii(value=''){
  const source = String(value || '');
  const constants = [
    0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
    0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
    0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
    0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
    0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
    0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
    0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
    0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
  ];
  const hash = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
  const rotateRight = (value, bits) => (value >>> bits) | (value << (32 - bits));
  const bytes = Array.from(source, ch => ch.charCodeAt(0) & 0xff);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while((bytes.length % 64) !== 56) bytes.push(0);
  const high = Math.floor(bitLength / 0x100000000);
  const low = bitLength >>> 0;
  for(let shift=24; shift>=0; shift-=8) bytes.push((high >>> shift) & 0xff);
  for(let shift=24; shift>=0; shift-=8) bytes.push((low >>> shift) & 0xff);
  const words = new Array(64).fill(0);
  for(let offset=0; offset<bytes.length; offset+=64){
    for(let i=0; i<16; i++){
      const j = offset + (i * 4);
      words[i] = (((bytes[j] << 24) | (bytes[j+1] << 16) | (bytes[j+2] << 8) | bytes[j+3]) >>> 0);
    }
    for(let i=16; i<64; i++){
      const s0 = (rotateRight(words[i-15], 7) ^ rotateRight(words[i-15], 18) ^ (words[i-15] >>> 3)) >>> 0;
      const s1 = (rotateRight(words[i-2], 17) ^ rotateRight(words[i-2], 19) ^ (words[i-2] >>> 10)) >>> 0;
      words[i] = (words[i-16] + s0 + words[i-7] + s1) >>> 0;
    }
    let [a,b,c,d,e,f,g,h] = hash;
    for(let i=0; i<64; i++){
      const upper1 = (rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25)) >>> 0;
      const choose = ((e & f) ^ ((~e) & g)) >>> 0;
      const temp1 = (h + upper1 + choose + constants[i] + words[i]) >>> 0;
      const upper0 = (rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22)) >>> 0;
      const majority = ((a & b) ^ (a & c) ^ (b & c)) >>> 0;
      const temp2 = (upper0 + majority) >>> 0;
      h = g; g = f; f = e; e = (d + temp1) >>> 0;
      d = c; c = b; b = a; a = (temp1 + temp2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map(value => value.toString(16).padStart(8, '0')).join('').toUpperCase();
}
function specialCodeFingerprint(value=''){
  const normalized = normalizeSpecialCodeValue(value);
  return normalized ? specialSha256Ascii(`FM-V7.12-CODE|${normalized}`) : '';
}
function specialCodeKey(code){
  return String(code?.huella || code?.fingerprint || code?.hash || '').trim().toUpperCase().replace(/[^A-F0-9]/g, '');
}
function specialRedeemableCodes(){
  const cfg = specialCodesConfig();
  if(!cfg.active) return [];
  return cfg.codes
    .map(item => ({ ...item, _key:specialCodeKey(item) }))
    .filter(item => item._key);
}
function redeemSpecialCode(){
  const input = document.getElementById('special-code-input');
  const raw = input ? input.value : '';
  const normalizedCode = normalizeSpecialCodeValue(raw);
  const key = specialCodeFingerprint(normalizedCode);
  if(!normalizedCode){ showNotice('Escribí un código para canjear.'); return; }
  const state = ensureSpecialState();
  const codes = specialRedeemableCodes();
  const code = codes.find(item => item._key === key);
  if(!code){ showNotice('Código inválido o no disponible.'); return; }
  state.codigos_reclamados = (state.codigos_reclamados && typeof state.codigos_reclamados === 'object' && !Array.isArray(state.codigos_reclamados)) ? state.codigos_reclamados : {};
  const reusable = code.reutilizable === true || code.reusable === true || code.usosIlimitados === true;
  const previousClaim = state.codigos_reclamados[key];
  const previousRedemption = previousClaim && typeof previousClaim === 'object' ? previousClaim : null;
  if(previousClaim && !reusable){ showNotice('Ese código ya fue reclamado en esta partida.'); return; }
  const benefits = code.beneficios || code.benefits || {};
  const prestige = Math.max(0, Math.round(Number(benefits.prestigio ?? benefits.prestige ?? 0)));
  const points = Math.max(0, Math.round(Number(benefits.puntosHabilidad ?? benefits.skillPoints ?? benefits.puntos_habilidad ?? 0)));
  const clubMoney = Math.max(0, Math.round(Number(benefits.dineroClub ?? benefits.clubMoney ?? benefits.presupuestoClub ?? benefits.money ?? 0)));
  const applied = [];
  if(prestige > 0 && typeof addManagerPrestige === 'function'){
    addManagerPrestige(prestige, `Código especial: ${code.nombre || key}`);
    applied.push(`+${prestige} prestigio`);
  }
  if(points > 0){
    state.puntos_habilidad = Math.max(0, Math.round(Number(state.puntos_habilidad || 0) + points));
    appendSpecialPointsLog(state, { actionId:'codigo_especial', points, code:key, ...turnStamp({ date:game?.currentDate || '' }) });
    if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'special_code_points' });
    specialPointsAnimation = { id:`code-${Date.now()}-${Math.random()}`, points };
    applied.push(`+${formatPlainNumber(points)} puntos de habilidad`);
  }
  if(clubMoney > 0){
    const concept = `Código especial: ${code.nombre || key}`;
    if(typeof recordBudgetChange === 'function'){
      recordBudgetChange(clubMoney, concept, { type:'special_code', category:'Código especial', code:key, reusable });
    } else {
      game.budgetHistory = Array.isArray(game.budgetHistory) ? game.budgetHistory : [];
      game.budget = Math.round(Number(game.budget || 0) + clubMoney);
      game.lastBudgetDelta = clubMoney;
      game.budgetHistory.push({
        season:game.seasonNumber || 1,
        matchdayIndex:game.matchdayIndex || 0,
        date:game.currentDate || '',
        concept,
        delta:clubMoney,
        budget:game.budget,
        type:'special_code',
        category:'Código especial',
        code:key,
        reusable
      });
    }
    game.clubBudgets = (game.clubBudgets && typeof game.clubBudgets === 'object' && !Array.isArray(game.clubBudgets)) ? game.clubBudgets : {};
    if(Number.isFinite(Number(game.selectedClubId))) game.clubBudgets[game.selectedClubId] = Math.round(Number(game.budget || 0));
    applied.push(`+${formatMoney(clubMoney)} al presupuesto del club`);
  }
  if(!applied.length){ showNotice('El código existe, pero no tiene beneficios configurados.'); return; }
  const nowIso = new Date().toISOString();
  state.codigos_reclamados[key] = reusable ? {
    codigo:key,
    nombre:String(code.nombre || key),
    beneficios:{ prestigio:prestige, puntosHabilidad:points, dineroClub:clubMoney },
    reutilizable:true,
    usos:Math.max(0, Math.round(Number(previousRedemption?.usos || 0))) + 1,
    season:Number(game?.seasonNumber || 1),
    date:game?.currentDate || '',
    primerUso:previousRedemption?.primerUso || previousRedemption?.createdAt || nowIso,
    ultimoUso:nowIso,
    createdAt:previousRedemption?.createdAt || nowIso
  } : {
    codigo:key,
    nombre:String(code.nombre || key),
    beneficios:{ prestigio:prestige, puntosHabilidad:points, dineroClub:clubMoney },
    reutilizable:false,
    usos:1,
    season:Number(game?.seasonNumber || 1),
    date:game?.currentDate || '',
    createdAt:nowIso
  };
  game.special = state;
  const redemptionUse = Math.max(1, Math.round(Number(state.codigos_reclamados[key]?.usos || 1)));
  pushGameMessage({ type:'especial', priority:'normal', title:'Código especial reclamado', body:`${code.nombre || key}: ${applied.join(' · ')}${reusable ? ` · Uso ${redemptionUse}` : ''}.`, id:`special-code-${key}-${game?.seasonNumber || 1}-${reusable ? redemptionUse : 1}` });
  saveLocal(true);
  renderSpecial();
  showNotice(`Código aplicado: ${applied.join(' · ')}.`);
}
function specialCodeRedeemMarkup(){
  const cfg = specialCodesConfig();
  const disabled = cfg.active ? '' : 'disabled';
  const placeholder = cfg.active ? 'Código alfanumérico' : 'Sin códigos activos esta semana';
  const status = cfg.active
    ? `<small class="muted">Campaña activa${cfg.week ? ` · ${escapeHtml(cfg.week)}` : ''}${cfg.validUntil ? ` · vence ${escapeHtml(cfg.validUntil)}` : ''}</small>`
    : '<small class="muted">No hay una campaña semanal activa.</small>';
  return `<div class="special-code-mini">
    <input id="special-code-input" class="input" type="text" placeholder="${escapeHtml(placeholder)}" autocomplete="off" spellcheck="false" ${disabled} />
    <button class="primary" id="special-code-redeem-btn" ${disabled}>Canjear</button>
    ${status}
  </div>`;
}

function specialPackRevealStepMs(){
  if(typeof SPECIAL_PACK_REVEAL_STEP_MS !== 'undefined') return SPECIAL_PACK_REVEAL_STEP_MS;
  if(typeof configNumber === 'function') return configNumber('ui.especialAperturaCartaMs', 2700, 250, 9000);
  return 2700;
}
function specialDelay(ms){
  return new Promise(resolve => { setTimeout(resolve, Math.max(0, Number(ms || 0))); });
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
    activaciones_max:specialMaxUsesForRarity(base.rareza),
    activaciones_usadas:0,
    activaciones_efecto:0,
    active_slot_id:'',
    ultimo_slot_activacion:'',
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
    const clean = { ...card, activa:false, destruida:false, active_slot_id:'' };
    const globalCard = specialGlobalUpsertCard(clean, { slotId:currentSpecialSaveSlotId(), zone:'reserve' }) || clean;
    state.cartas_reserva.push({ ...globalCard, activa:false });
    reserveIds.add(id);
    added.push({ ...globalCard, activa:false });
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
function commitPendingSpecialOpeningToReserve(state, reason='completada'){
  if(!state || typeof state !== 'object') return { count:0, cards:[] };
  const pending = state.apertura_pendiente && typeof state.apertura_pendiente === 'object' ? state.apertura_pendiente : null;
  const cards = (Array.isArray(pending?.cartas) ? pending.cartas : []).map((card, index) => normalizeSpecialCard(card, index)).filter(Boolean).filter(card => !card.destruida);
  if(!pending || !cards.length){
    state.apertura_pendiente = null;
    specialPackOpeningInProgress = false;
    specialPendingOpeningRuntimeId = '';
    return { count:0, cards:[] };
  }
  state.cartas_reserva = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  state.cartas_activas = Array.isArray(state.cartas_activas) ? state.cartas_activas : [];
  const activeIds = new Set(state.cartas_activas.map(card => String(card.id_carta || '')));
  const reserveIds = new Set(state.cartas_reserva.map(card => String(card.id_carta || '')));
  const committed = [];
  cards.forEach((rawCard, index) => {
    const card = normalizeSpecialCard(rawCard, index);
    const id = String(card?.id_carta || '');
    if(!card || !id || card.destruida || activeIds.has(id) || reserveIds.has(id)) return;
    const clean = { ...card, activa:false, destruida:false, active_slot_id:'' };
    const globalCard = specialGlobalUpsertCard(clean, { slotId:currentSpecialSaveSlotId(), zone:'reserve' }) || clean;
    state.cartas_reserva.push({ ...globalCard, activa:false });
    reserveIds.add(id);
    committed.push({ ...globalCard, activa:false, apertura_cierre:String(reason || 'completada') });
  });
  const historyCards = cards.map(card => ({ ...card, activa:false, destruida:false, apertura_cierre:String(reason || 'completada') }));
  const seenHistory = new Set();
  state.historial_ultimas_cartas = historyCards.concat(Array.isArray(state.historial_ultimas_cartas) ? state.historial_ultimas_cartas : []).filter(card => {
    const id = String(card?.id_carta || '');
    if(!id || seenHistory.has(id)) return false;
    seenHistory.add(id);
    return true;
  }).slice(0, 30);
  state.apertura_pendiente = null;
  specialPackOpeningInProgress = false;
  specialPendingOpeningRuntimeId = '';
  if(specialPendingOpeningFinalizeTimer){
    clearTimeout(specialPendingOpeningFinalizeTimer);
    specialPendingOpeningFinalizeTimer = null;
  }
  return { count:committed.length, cards:committed };
}
function finalizePendingSpecialOpeningSync(reason='salida_de_vista'){
  if(!game?.special?.apertura_pendiente) return { count:0, cards:[] };
  game.special = normalizeSpecialState(game.special, game.rankingManagerName || storedManagerName() || 'Manager');
  const result = commitPendingSpecialOpeningToReserve(game.special, reason);
  if(result.count > 0 && typeof persistSharedManagerProfileFromGame === 'function'){
    persistSharedManagerProfileFromGame({ reason:`special_pack_${reason}` });
  }
  return result;
}
async function finalizePendingSpecialOpening(options={}){
  const reason = String(options.reason || 'salida_de_vista');
  const result = finalizePendingSpecialOpeningSync(reason);
  if(result.count <= 0) return result;
  try{ await saveLocal(true); }catch(err){ console.error('No se pudo guardar el cierre de apertura.', err); }
  if(options.render !== false && typeof activeTab !== 'undefined' && activeTab === 'special') renderSpecial();
  if(options.notify === true) showNotice('Las cartas obtenidas quedaron guardadas en reserva.');
  return result;
}
async function revealPendingSpecialCard(cardId){
  const state = ensureSpecialState();
  const pending = state?.apertura_pendiente;
  if(!pending?.id || !Array.isArray(pending.cartas)) return;
  const id = String(cardId || '');
  if(!pending.cartas.some(card => String(card.id_carta || '') === id)) return;
  pending.reveladas = Array.from(new Set([...(Array.isArray(pending.reveladas) ? pending.reveladas.map(String) : []), id]));
  pending.completa = pending.reveladas.length >= pending.cartas.length;
  state.apertura_pendiente = pending;
  game.special = state;
  renderSpecial();
  try{ await saveLocal(true); }catch(err){ console.error('No se pudo guardar la revelación de la carta.', err); }
  if(pending.completa){
    if(specialPendingOpeningFinalizeTimer) clearTimeout(specialPendingOpeningFinalizeTimer);
    specialPendingOpeningFinalizeTimer = window.setTimeout(() => {
      finalizePendingSpecialOpening({ reason:'todas_reveladas', render:true, notify:true });
    }, 850);
  }
}
async function openSpecialPack(packId){
  const existingState = ensureSpecialState();
  if(existingState?.apertura_pendiente){
    specialPackOpeningInProgress = true;
    specialPendingOpeningRuntimeId = String(existingState.apertura_pendiente.id || '');
    renderSpecial();
    showNotice('Terminá de revelar las cartas del sobre actual.');
    return;
  }
  if(specialPackOpeningInProgress){ showNotice('Ya se está abriendo un sobre.'); return; }
  let state = existingState;
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
  const previousPending = state.apertura_pendiente || null;

  const rollbackOpening = async (notice='No se pudo completar la apertura. Se devolvieron los puntos.') => {
    const rollbackState = ensureSpecialState();
    if(!rollbackState) return;
    rollbackState.puntos_habilidad = previousPoints;
    rollbackState.puntos_log = previousLog;
    rollbackState.historial_ultimas_cartas = previousHistory;
    rollbackState.cartas_reserva = (rollbackState.cartas_reserva || []).filter(card => previousReserveIds.has(String(card.id_carta || '')));
    rollbackState.apertura_pendiente = previousPending;
    game.special = rollbackState;
    specialPackOpeningInProgress = Boolean(previousPending);
    specialPendingOpeningRuntimeId = String(previousPending?.id || '');
    try{ await saveLocal(true); }catch(err){ console.error(err); }
    renderSpecial();
    showNotice(notice);
  };

  state.puntos_habilidad = Math.max(0, previousPoints - cost);
  state.puntos_log = Array.isArray(state.puntos_log) ? state.puntos_log : [];
  appendSpecialPointsLog(state, { actionId:'abrir_sobre', points:-cost, packId, puntos_antes:previousPoints, puntos_despues:state.puntos_habilidad, ...turnStamp({ date:game?.currentDate || '' }) });
  if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'open_special_pack_cost' });
  game.special = state;
  specialPointsAnimation = { id:`spend-${Date.now()}-${Math.random()}`, points:-cost };

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
  state = ensureSpecialState();
  const openingId = `OPEN-${game?.saveCode || 'FM'}-${Date.now().toString(36)}-${hashNumber(sorted.map(card => card.id_carta).join('|'), 1000000)}`;
  state.apertura_pendiente = {
    id:openingId,
    sobre_id:String(packId || ''),
    sobre_nombre:String(pack.nombre || 'Sobre'),
    costo:cost,
    cartas:sorted,
    reveladas:[],
    creada_en:new Date().toISOString(),
    completa:false
  };
  game.special = state;
  specialPendingOpeningRuntimeId = openingId;
  specialPackOpeningInProgress = true;

  try{
    await saveLocal(true);
  } catch(err){
    console.error(err);
    await rollbackOpening('No se pudo guardar la apertura. Se devolvieron los puntos.');
    return;
  }

  renderSpecial();
  showNotice(`${pack.nombre || 'Sobre'} comprado por ${cost} puntos. Revelá las ${sorted.length} cartas.`);
}

function activateSpecialCard(cardId){
  const state = ensureSpecialState();
  const limits = specialLimits();
  const slotId = currentSpecialSaveSlotId();
  if((state.cartas_activas || []).length >= limits.activeMax){ showNotice(`Ya tenés ${limits.activeMax} cartas activas. Desactivá una carta que ya haya cumplido su plazo para reemplazarla.`); return; }
  let index = state.cartas_reserva.findIndex(card => card.id_carta === cardId);
  if(index < 0){
    recoverSpecialCardToReserve(cardId);
    index = state.cartas_reserva.findIndex(card => card.id_carta === cardId);
  }
  if(index < 0){ showNotice('Carta no encontrada en reserva.'); return; }
  const card = state.cartas_reserva[index];
  const globalCard = normalizeSpecialGlobalCard(readSpecialGlobalCardsState().cards?.[card.id_carta] || null);
  if(globalCard?.active_slot_id){
    const localActive = (state.cartas_activas || []).some(active => String(active.id_carta || '') === String(card.id_carta || ''));
    if(localActive){
      game.special = syncSpecialStateWithGlobalCards(state);
      renderSpecial();
      showNotice('Esta carta ya está activa y se comparte entre partidas.');
      return;
    }
    // Si llegó hasta acá, la carta está en reserva. La reserva es la fuente válida y limpia una marca activa global vieja.
    specialGlobalReleaseCard({ ...globalCard, ...card, activa:false, active_slot_id:'' }, { slotId, reason:'reserve_override_before_activation' });
  }
  if(!card.activable){ showNotice('Esta carta no se puede activar.'); return; }
  if(!limits.allowRepeatedActive && state.cartas_activas.some(active => active.id_base === card.id_base)){ showNotice('Esta carta ya está activa.'); return; }
  if(specialCardRemainingUses(card) <= 0){ showNotice('Esta carta ya no tiene activaciones disponibles.'); return; }
  state.cartas_reserva.splice(index, 1);
  const maxUses = specialMaxUsesForRarity(card.rareza);
  const used = clamp(Math.round(Number(card.activaciones_usadas || 0)) + 1, 0, maxUses);
  const activationDate = specialCurrentDate();
  const activationTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  const effectActivations = specialCardIsObjectiveReduction(card)
    ? clamp(specialObjectiveActivationCount(card) + 1, 0, maxUses)
    : 0;
  const activatedCard = { ...card, activa:true, destruida:false, activaciones_max:maxUses, activaciones_usadas:used, activaciones_efecto:effectActivations, active_slot_id:slotId, ultimo_slot_activacion:slotId, ciclo_uso_desde:activationDate, ciclo_uso_desde_turno:activationTurn, agotada_activa_desde:specialCardRemainingUses({ ...card, activaciones_usadas:used }) <= 0 ? activationDate : null, agotada_activa_desde_turno:specialCardRemainingUses({ ...card, activaciones_usadas:used }) <= 0 ? activationTurn : null };
  lockSpecialCardChanges(activatedCard, state);
  state.cartas_activas = Array.isArray(state.cartas_activas) ? state.cartas_activas : [];
  state.cartas_activas.push(activatedCard);
  const objectiveUse = specialCardIsObjectiveReduction(activatedCard)
    ? applySpecialObjectiveSeasonUse(activatedCard, 'activacion', state)
    : { applied:0, total:specialObjectiveSeasonReduction(state) };
  specialGlobalUpsertCard(activatedCard, { slotId, zone:'active' });
  const cohesionGain = applySpecialCohesionActivationBonus(activatedCard);
  game.special = syncSpecialStateWithGlobalCards(state);
  saveLocal(true);
  renderSpecial();
  const extra = cohesionGain > 0 ? ` Cohesión +${cohesionGain}.` : '';
  const accumulated = specialCardIsObjectiveReduction(activatedCard) ? ` Reducción permanente de esta temporada: -${objectiveUse.total}%.` : '';
  showNotice(`Carta activada: ${card.nombre}. Queda fija por ${formatDays(limits.lockDays)}. Usos restantes: ${specialCardRemainingUses(activatedCard)}.${accumulated}${extra}`);
}
function reinforceSpecialObjectiveCard(cardId){
  const state = ensureSpecialState();
  const slotId = currentSpecialSaveSlotId();
  const index = (state.cartas_activas || []).findIndex(card => String(card.id_carta || '') === String(cardId || ''));
  if(index < 0){ showNotice('Carta activa no encontrada.'); return; }
  const card = state.cartas_activas[index];
  if(!specialCardIsObjectiveReduction(card)){ showNotice('Esta carta no admite activaciones acumuladas.'); return; }
  const remaining = specialCardRemainingUses(card);
  if(remaining <= 0){ showNotice('Esta carta ya utilizó todas sus activaciones.'); return; }
  const maxUses = specialMaxUsesForRarity(card.rareza);
  card.activaciones_usadas = clamp(Math.round(Number(card.activaciones_usadas || 0)) + 1, 0, maxUses);
  card.activaciones_efecto = clamp(specialObjectiveActivationCount(card) + 1, 0, maxUses);
  const objectiveUse = applySpecialObjectiveSeasonUse(card, 'activacion_adicional', state);
  card.ciclo_uso_desde = specialCurrentDate();
  card.ciclo_uso_desde_turno = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  if(specialCardRemainingUses(card) <= 0){
    card.agotada_activa_desde = card.ciclo_uso_desde;
    card.agotada_activa_desde_turno = card.ciclo_uso_desde_turno;
  }
  lockSpecialCardChanges(card, state);
  specialGlobalUpsertCard(card, { slotId, zone:'active' });
  game.special = syncSpecialStateWithGlobalCards(state);
  saveLocal(true);
  renderSpecial();
  showNotice(`Uso aplicado: ${card.nombre}. Reducción permanente de esta temporada: -${objectiveUse.total}%. Usos restantes: ${specialCardRemainingUses(card)}.`);
}
function deactivateSpecialCard(cardId){
  const state = ensureSpecialState();
  const limits = specialLimits();
  const slotId = currentSpecialSaveSlotId();
  if(state.cartas_reserva.length >= limits.reserveMax){ showNotice('Reserva llena. No se puede desactivar una carta hasta liberar espacio.'); return; }
  const index = state.cartas_activas.findIndex(card => card.id_carta === cardId);
  if(index < 0){ showNotice('Carta activa no encontrada.'); return; }
  const card = state.cartas_activas[index];
  const cardLock = specialCardActiveLockInfo(card);
  if(cardLock.locked){ showNotice(`Esta carta debe permanecer activa ${formatDays(cardLock.remaining)} más.`); return; }
  state.cartas_activas.splice(index, 1);
  const consumeOnDeactivate = limits.consumeOnDeactivate && !specialCardIsObjectiveReduction(card);
  const deactivationUsed = consumeOnDeactivate ? clamp(Math.round(Number(card.activaciones_usadas || 0)) + 1, 0, specialMaxUsesForRarity(card.rareza)) : Math.round(Number(card.activaciones_usadas || 0));
  card.activaciones_usadas = deactivationUsed;
  const remaining = specialCardRemainingUses(card);
  if(remaining > 0){
    const released = { ...card, activa:false, active_slot_id:'', activada_en:null, bloqueada_hasta:null, activada_en_turno:null, bloqueada_hasta_turno:null, ciclo_uso_desde:null, ciclo_uso_desde_turno:null, agotada_activa_desde:null, agotada_activa_desde_turno:null };
    specialGlobalReleaseCard(released, { slotId });
    state.cartas_reserva.push(released);
    showNotice(`Carta desactivada: ${card.nombre}. Usos restantes: ${remaining}.${specialCardIsObjectiveReduction(card) ? ' La reducción aplicada permanece vigente hasta terminar la temporada.' : ''}`);
  } else {
    specialGlobalReleaseCard(card, { slotId, exhausted:true });
    state.historial_ultimas_cartas = [{ ...card, activa:false, destruida:true, agotada_por_usos:true }].concat(state.historial_ultimas_cartas || []).slice(0, 30);
    showNotice(`Carta agotada: ${card.nombre}. No tiene más activaciones.${specialCardIsObjectiveReduction(card) ? ' La reducción aplicada permanece vigente hasta terminar la temporada.' : ''}`);
  }
  game.special = syncSpecialStateWithGlobalCards(state);
  saveLocal(true);
  renderSpecial();
}
function destroySpecialCard(cardId){
  const state = ensureSpecialState();
  const db = specialDatabase();
  if(db.destruir_cartas?.permitido === false){ showNotice('La destrucción de cartas está desactivada.'); return; }
  const id = String(cardId || '');
  let index = (state.cartas_reserva || []).findIndex(card => String(card.id_carta || '') === id);
  if(index < 0){
    recoverSpecialCardToReserve(id);
    index = (state.cartas_reserva || []).findIndex(card => String(card.id_carta || '') === id);
  }
  if(index < 0){ showNotice('Sólo se pueden destruir cartas en reserva.'); return; }
  const card = normalizeSpecialGlobalCard(state.cartas_reserva[index], index);
  if(!card?.id_carta){ showNotice('Carta inválida.'); return; }
  const fixedRecovery = { inutil:5, comun:20, rara:50, epica:250, legendaria:1000 };
  const configuredRecovery = Math.max(0, Math.round(Number(db.destruir_cartas?.recuperacion_puntos?.[card.rareza] || 0)));
  const recovery = Number.isFinite(fixedRecovery[card.rareza]) ? fixedRecovery[card.rareza] : configuredRecovery;
  removeSpecialCardEverywhereInState(state, card.id_carta);
  specialGlobalDestroyCard(card, { slotId:currentSpecialSaveSlotId(), reason:'destroy_special_card' });
  state.puntos_habilidad = Math.max(0, Math.round(Number(state.puntos_habilidad || 0) + recovery));
  appendSpecialPointsLog(state, { actionId:'destruir_carta', points:recovery, cardId:card.id_carta, rarity:card.rareza, ...turnStamp({ date:game?.currentDate || '' }) });
  state.historial_ultimas_cartas = [{ ...card, activa:false, active_slot_id:'', destruida:true, recuperacion_puntos:recovery }].concat(state.historial_ultimas_cartas || []).slice(0, 30);
  game.special = syncSpecialStateWithGlobalCards(state);
  if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'destroy_special_card' });
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
  const usesText = `${specialCardRemainingUses(card)}/${specialMaxUsesForRarity(card.rareza)}`;
  const usesPill = card.activable ? `<span class="pill special-uses-pill">Usos ${escapeHtml(usesText)}</span>` : '';
  const bonus = specialCardBonusText(card);
  const reinforceButton = zone === 'active' && specialCardIsObjectiveReduction(card) && specialCardRemainingUses(card) > 0
    ? `<button class="primary small-btn" data-special-reinforce="${escapeHtml(card.id_carta)}">Activar otra vez</button>`
    : '';
  const action = zone === 'active'
    ? `<div class="row gap-xs">${reinforceButton}<button class="ghost small-btn" data-special-deactivate="${escapeHtml(card.id_carta)}" ${activeLock.locked ? 'disabled' : ''}>${activeLock.locked ? 'Fija' : 'Quitar'}</button></div>`
    : (zone === 'opened'
      ? `<span class="pill">Guardada</span>`
      : `<div class="row gap-xs"><button class="primary small-btn" data-special-activate="${escapeHtml(card.id_carta)}" ${canActivate ? '' : 'disabled'}>Activar</button><button class="ghost small-btn" data-special-destroy="${escapeHtml(card.id_carta)}">Destruir</button></div>`);
  return `<div class="special-card rarity-${escapeHtml(rarity)} ${zone === 'active' ? 'active' : ''} ${zone === 'opened' ? 'opened' : ''}" data-special-card-id="${escapeHtml(card.id_carta)}" draggable="${canActivate ? 'true' : 'false'}"> 
    <div class="special-card-head"><span class="pill rarity-pill rarity-${escapeHtml(rarity)}">${escapeHtml(specialRarityLabel(rarity))}</span><span class="special-card-head-actions">${usesPill}${lockPill}</span></div>
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
function specialOpenedMarkup(pending=null){
  const cards = Array.isArray(pending?.cartas) ? pending.cartas : [];
  if(!cards.length) return '';
  const revealedIds = new Set(Array.isArray(pending.reveladas) ? pending.reveladas.map(String) : []);
  const revealedCount = cards.filter(card => revealedIds.has(String(card.id_carta || ''))).length;
  const remaining = Math.max(0, cards.length - revealedCount);
  const cardMarkup = cards.map((card, index) => {
    const id = String(card.id_carta || '');
    if(revealedIds.has(id)) return `<div class="special-opening-slot revealed">${specialCardMarkup(card, 'opened')}</div>`;
    return `<div class="special-opening-slot concealed">
      <div class="special-card special-card-concealed" data-special-concealed-card="${escapeHtml(id)}">
        <div class="special-card-back-symbol" aria-hidden="true">?</div>
        <p class="label">Carta ${index + 1}</p>
        <h3>Contenido oculto</h3>
        <p>Revelá esta carta para conocer su rareza y efecto.</p>
        <div class="special-card-actions"><button class="primary" data-special-reveal="${escapeHtml(id)}">Ver</button></div>
      </div>
    </div>`;
  }).join('');
  const completeText = remaining === 0
    ? 'Todas las cartas fueron reveladas. Se están enviando automáticamente a la reserva.'
    : `Debés revelar las ${cards.length} cartas. Si abandonás esta pantalla, todas pasarán automáticamente a la reserva.`;
  return `<div class="card special-opened opening" data-special-opening-id="${escapeHtml(String(pending.id || ''))}">
    <div class="row"><div><p class="label">${escapeHtml(pending.sobre_nombre || 'Sobre')}</p><h3>Apertura de sobre</h3></div><span class="pill">${revealedCount}/${cards.length}</span></div>
    <p class="muted small">${escapeHtml(completeText)}</p>
    <div class="special-card-grid special-opening-grid">${cardMarkup}</div>
    <div class="special-reveal-progress"><div style="width:${Math.round((revealedCount / cards.length) * 100)}%"></div></div>
    ${remaining > 0 ? `<p class="muted small">Faltan ${remaining} carta(s) por revelar.</p>` : ''}
  </div>`;
}

function renderSpecial(opened=[], options={}){
  if(Array.isArray(opened) && opened.length && !options?.opening) ensureSpecialCardsInReserve(opened);
  const state = ensureSpecialState();
  const pending = state?.apertura_pendiente || null;
  if(pending?.id){
    specialPendingOpeningRuntimeId = String(pending.id);
    specialPackOpeningInProgress = true;
  } else {
    specialPackOpeningInProgress = false;
  }
  const limits = specialLimits();
  const locked = specialCardsLockedInfo();
  const active = (state.cartas_activas || []).slice().sort((a,b)=>specialRarityRank(b.rareza)-specialRarityRank(a.rareza));
  const reserveAll = Array.isArray(state.cartas_reserva) ? state.cartas_reserva : [];
  const reserve = reserveAll.slice().sort((a,b)=>specialRarityRank(b.rareza)-specialRarityRank(a.rareza) || a.nombre.localeCompare(b.nombre, 'es'));
  const packs = specialPackDefinitions();
  const bonuses = specialActiveBonusSummary();
  const pointAnimation = specialPointsAnimation;
  const activeBonusCards = active.filter(card => card.tipo_bonus && Number(card.valor_bonus || 0) > 0);
  const lockText = locked.locked ? `${locked.count} fija(s). Próxima libre en ${formatDays(locked.remaining)}.` : 'Cambios disponibles.';
  const bonusChips = bonuses.length
    ? bonuses.map(item => `<span class="pill ok">${escapeHtml(specialBonusLabel(item.type))}: ${escapeHtml(specialBonusSummaryText(item))}</span>`).join('')
    : '<span class="pill">Sin bonus vigente</span>';
  const normalInventoryMarkup = pending ? '' : `
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
    ${specialCodeRedeemMarkup()}`;
  view.innerHTML = `
    <div class="row section-title"><div><h2>Cartas</h2><p class="tagline">Puntos, reserva y cartas activas compartidas por el perfil del manager.</p></div></div>
    <div class="grid cols-4 compact-team-stats special-summary">
      <div class="card special-points-card ${pointAnimation ? 'special-points-flash' : ''}"><p class="label">Puntos</p><strong>${Number(state.puntos_habilidad || 0)}</strong>${pointAnimation ? `<span class="special-points-float">${Number(pointAnimation.points || 0) >= 0 ? '+' : ''}${Number(pointAnimation.points || 0)}</span>` : ''}</div>
      <div class="card"><p class="label">Activas</p><strong>${active.length}/${limits.activeMax}</strong></div>
      <div class="card"><p class="label">Reserva</p><strong>${reserveAll.length}/${limits.reserveMax}</strong></div>
      <div class="card"><p class="label">Bloqueo</p><strong>${escapeHtml(locked.locked ? formatDays(limits.lockDays) : 'Libre')}</strong></div>
    </div>
    ${specialOpenedMarkup(pending)}
    ${normalInventoryMarkup}
  `;
  document.querySelectorAll('[data-special-reveal]').forEach(btn => btn.addEventListener('click', () => revealPendingSpecialCard(btn.dataset.specialReveal)));
  document.querySelectorAll('[data-open-special-pack]').forEach(btn => btn.addEventListener('click', () => openSpecialPack(btn.dataset.openSpecialPack)));
  const codeInput = document.getElementById('special-code-input');
  const codeButton = document.getElementById('special-code-redeem-btn');
  if(codeButton) codeButton.addEventListener('click', redeemSpecialCode);
  if(codeInput) codeInput.addEventListener('keydown', ev => { if(ev.key === 'Enter'){ ev.preventDefault(); redeemSpecialCode(); } });
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
  document.querySelectorAll('[data-special-reinforce]').forEach(btn => btn.addEventListener('click', () => reinforceSpecialObjectiveCard(btn.dataset.specialReinforce)));
  document.querySelectorAll('[data-special-deactivate]').forEach(btn => btn.addEventListener('click', () => deactivateSpecialCard(btn.dataset.specialDeactivate)));
  document.querySelectorAll('[data-special-destroy]').forEach(btn => btn.addEventListener('click', () => destroySpecialCard(btn.dataset.specialDestroy)));
  if(pointAnimation){
    const animationId = pointAnimation.id;
    window.setTimeout(() => {
      if(specialPointsAnimation?.id === animationId) specialPointsAnimation = null;
    }, 1800);
  }
}


function installSpecialOpeningLifecycleGuards(){
  if(specialOpeningLifecycleGuardsInstalled || typeof window === 'undefined' || typeof document === 'undefined') return;
  specialOpeningLifecycleGuardsInstalled = true;
  if(typeof renderAll === 'function' && !renderAll.__specialOpeningGuard){
    const previousRenderAll = renderAll;
    const guardedRenderAll = function(...args){
      if(game?.special?.apertura_pendiente && typeof activeTab !== 'undefined' && activeTab !== 'special'){
        finalizePendingSpecialOpening({ reason:'cambio_de_menu', render:false, notify:false });
      }
      return previousRenderAll.apply(this, args);
    };
    guardedRenderAll.__specialOpeningGuard = true;
    renderAll = guardedRenderAll;
  }
  if(typeof openModal === 'function' && !openModal.__specialOpeningGuard){
    const previousOpenModal = openModal;
    const guardedOpenModal = function(...args){
      if(game?.special?.apertura_pendiente){
        finalizePendingSpecialOpening({ reason:'cambio_de_ventana', render:false, notify:false });
      }
      return previousOpenModal.apply(this, args);
    };
    guardedOpenModal.__specialOpeningGuard = true;
    openModal = guardedOpenModal;
  }
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden'){
      const result = finalizePendingSpecialOpeningSync('cambio_de_pestana');
      if(result.count > 0){
        specialOpeningNeedsRenderAfterVisibility = true;
        saveLocal(true).catch(err => console.error('No se pudo guardar la apertura al ocultar la pestaña.', err));
      }
    } else if(specialOpeningNeedsRenderAfterVisibility){
      specialOpeningNeedsRenderAfterVisibility = false;
      if(typeof activeTab !== 'undefined' && activeTab === 'special') renderSpecial();
    }
  }, true);
  const closeHandler = () => {
    const result = finalizePendingSpecialOpeningSync('cierre_de_ventana');
    if(result.count > 0) saveLocal(true).catch(()=>{});
  };
  window.addEventListener('pagehide', closeHandler, true);
  window.addEventListener('beforeunload', closeHandler, true);
}
installSpecialOpeningLifecycleGuards();
