/* V8.45 · Centro de Ojeo: filtros automáticos por rol, probabilidad, edad y sueldo. */

const SCOUTING_PLAYER_SEARCH_ROLES = ['all','POR','LD','LI','DFC','MCD','MC','MI','MD','MCO','ED','EI','DC'];
const SCOUTING_PLAYER_SEARCH_CHANCES = ['any','30','50','80'];
function createInitialScoutingPlayerSearchState(){
  return {
    enabled:false,
    role:'all',
    signingChance:'any',
    ageMin:null,
    ageMax:null,
    salaryMin:null,
    salaryMax:null,
    progressDays:0,
    requiredDays:1,
    startedDate:null,
    lastResultDate:null,
    lastResultPlayerId:null,
    status:'idle',
    foundPlayerIds:[]
  };
}
function scoutingPlayerSearchBoundActive(value){
  return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
}
function normalizeScoutingPlayerSearchBound(value, min=0, max=Number.MAX_SAFE_INTEGER){
  if(!scoutingPlayerSearchBoundActive(value)) return null;
  return clamp(Math.round(Number(value)), min, max);
}
function scoutingPlayerSearchRangeActive(minValue, maxValue){
  return scoutingPlayerSearchBoundActive(minValue) || scoutingPlayerSearchBoundActive(maxValue);
}
function scoutingPlayerSearchRequiredDays(role='all', signingChance='any', ageMin=null, ageMax=null, salaryMin=null, salaryMax=null){
  let days = 1;
  if(String(role || 'all') !== 'all') days += 2;
  const chanceDays = { '30':1, '50':2, '80':3 };
  days += Number(chanceDays[String(signingChance || 'any')] || 0);
  if(scoutingPlayerSearchRangeActive(ageMin, ageMax)) days += 3;
  if(scoutingPlayerSearchRangeActive(salaryMin, salaryMax)) days += 3;
  return clamp(Math.round(days), 1, 12);
}
function normalizeScoutingPlayerSearchState(search){
  const clean = { ...createInitialScoutingPlayerSearchState(), ...(search && typeof search === 'object' ? search : {}) };
  clean.enabled = Boolean(clean.enabled);
  clean.role = SCOUTING_PLAYER_SEARCH_ROLES.includes(String(clean.role)) ? String(clean.role) : 'all';
  clean.signingChance = SCOUTING_PLAYER_SEARCH_CHANCES.includes(String(clean.signingChance)) ? String(clean.signingChance) : 'any';
  clean.ageMin = normalizeScoutingPlayerSearchBound(clean.ageMin, 15, 60);
  clean.ageMax = normalizeScoutingPlayerSearchBound(clean.ageMax, 15, 60);
  clean.salaryMin = normalizeScoutingPlayerSearchBound(clean.salaryMin, 0);
  clean.salaryMax = normalizeScoutingPlayerSearchBound(clean.salaryMax, 0);
  if(clean.ageMin !== null && clean.ageMax !== null && clean.ageMin > clean.ageMax){
    [clean.ageMin, clean.ageMax] = [clean.ageMax, clean.ageMin];
  }
  if(clean.salaryMin !== null && clean.salaryMax !== null && clean.salaryMin > clean.salaryMax){
    [clean.salaryMin, clean.salaryMax] = [clean.salaryMax, clean.salaryMin];
  }
  clean.requiredDays = scoutingPlayerSearchRequiredDays(clean.role, clean.signingChance, clean.ageMin, clean.ageMax, clean.salaryMin, clean.salaryMax);
  clean.progressDays = clamp(Math.round(Number(clean.progressDays || 0)), 0, clean.requiredDays);
  clean.startedDate = validIsoDate(clean.startedDate) ? clean.startedDate : null;
  clean.lastResultDate = validIsoDate(clean.lastResultDate) ? clean.lastResultDate : null;
  clean.lastResultPlayerId = Math.max(0, Math.round(Number(clean.lastResultPlayerId || 0))) || null;
  clean.status = ['idle','searching','weekly_wait','waiting_slot','no_matches','found'].includes(String(clean.status)) ? String(clean.status) : (clean.enabled ? 'searching' : 'idle');
  clean.foundPlayerIds = Array.from(new Set((Array.isArray(clean.foundPlayerIds) ? clean.foundPlayerIds : []).map(Number).filter(id => id > 0 && (typeof playerById !== 'function' || playerById(id)))));
  if(!clean.enabled){
    clean.progressDays = 0;
    clean.startedDate = null;
    clean.status = 'idle';
  }
  return clean;
}
function createInitialScoutingCenterState(){
  return { listedPlayerIds:[], listedTeamIds:[], reports:{}, teamReports:{}, offices:0, scouts:0, chief:null, officeLastChargeDate:null, chiefLastChargeDate:null, scoutsLastChargeDate:null, lastDailyProcessDate:null, playerSearch:createInitialScoutingPlayerSearchState() };
}
function normalizeScoutingCenterState(state){
  const base = createInitialScoutingCenterState();
  const clean = { ...base, ...(state || {}) };
  clean.listedPlayerIds = Array.isArray(clean.listedPlayerIds) ? clean.listedPlayerIds.map(Number).filter(Boolean) : [];
  clean.listedPlayerIds = Array.from(new Set(clean.listedPlayerIds)).filter(id => {
    const p = typeof playerById === 'function' ? playerById(id) : null;
    return Boolean(p);
  });
  clean.listedTeamIds = Array.isArray(clean.listedTeamIds) ? clean.listedTeamIds.map(Number).filter(Boolean) : [];
  clean.listedTeamIds = Array.from(new Set(clean.listedTeamIds)).filter(id => {
    const club = seed?.clubs?.find(c => Number(c.id) === Number(id));
    return Boolean(club) && Number(id) !== Number(game?.selectedClubId || 0);
  });
  clean.reports = (clean.reports && typeof clean.reports === 'object' && !Array.isArray(clean.reports)) ? clean.reports : {};
  clean.teamReports = (clean.teamReports && typeof clean.teamReports === 'object' && !Array.isArray(clean.teamReports)) ? clean.teamReports : {};
  Object.entries({ ...clean.reports }).forEach(([id, report]) => {
    const numericId = Number(id);
    const player = typeof playerById === 'function' ? playerById(numericId) : null;
    if(!numericId || !player){ delete clean.reports[id]; return; }
    clean.reports[String(numericId)] = normalizeScoutingReport(numericId, report);
    if(String(id) !== String(numericId)) delete clean.reports[id];
  });
  clean.offices = Math.max(0, Math.round(Number(clean.offices || 0)));
  clean.scouts = Math.max(0, Math.round(Number(clean.scouts || 0)));
  clean.chief = clean.chief && typeof clean.chief === 'object' ? clean.chief : null;
  if(clean.chief && !scoutingChiefType(clean.chief.type)) clean.chief = null;
  clean.officeLastChargeDate = validIsoDate(clean.officeLastChargeDate) ? clean.officeLastChargeDate : null;
  clean.chiefLastChargeDate = validIsoDate(clean.chiefLastChargeDate) ? clean.chiefLastChargeDate : null;
  clean.scoutsLastChargeDate = validIsoDate(clean.scoutsLastChargeDate) ? clean.scoutsLastChargeDate : null;
  clean.lastDailyProcessDate = validIsoDate(clean.lastDailyProcessDate) ? clean.lastDailyProcessDate : null;
  clean.playerSearch = normalizeScoutingPlayerSearchState(clean.playerSearch);
  // La búsqueda automática depende del jefe de ojeadores. Al migrar o perderlo,
  // la búsqueda se apaga y su progreso vuelve a cero sin alterar los criterios.
  if(!clean.chief && clean.playerSearch.enabled){
    resetScoutingPlayerSearchProgress(clean.playerSearch, { disable:true });
  }
  const caps = scoutingCapacities(clean);
  Object.entries({ ...clean.teamReports }).forEach(([id, report]) => {
    const numericId = Number(id);
    const club = seed?.clubs?.find(c => Number(c.id) === Number(numericId));
    if(!numericId || !club){ delete clean.teamReports[id]; return; }
    clean.teamReports[String(numericId)] = normalizeScoutingTeamReport(numericId, report);
    if(String(id) !== String(numericId)) delete clean.teamReports[id];
  });
  clean.scouts = Math.min(clean.scouts, caps.scoutCapacity);
  const totalSlots = Math.max(0, Number(caps.playerCapacity || 0));
  clean.listedPlayerIds = clean.listedPlayerIds.slice(0, totalSlots);
  const remainingTeamSlots = Math.max(0, totalSlots - clean.listedPlayerIds.length);
  clean.listedTeamIds = clean.listedTeamIds.slice(0, remainingTeamSlots);
  clean.playerSearch.foundPlayerIds = clean.playerSearch.foundPlayerIds.filter(id => clean.listedPlayerIds.includes(Number(id)));
  if(clean.playerSearch.lastResultPlayerId && !clean.playerSearch.foundPlayerIds.includes(Number(clean.playerSearch.lastResultPlayerId))){
    clean.playerSearch.lastResultPlayerId = null;
  }
  return clean;
}
function scoutingTeamSectorDefinitions(){
  return [
    { key:'defense', label:'Defensa' },
    { key:'midfield', label:'Medios' },
    { key:'attack', label:'Delantera' }
  ];
}
function scoutingTeamSectorKeys(){
  return scoutingTeamSectorDefinitions().map(item => item.key);
}
function normalizeScoutingTeamReport(clubId, report={}){
  const allowed = new Set(scoutingTeamSectorKeys());
  const visible = Array.isArray(report.visibleSectors) ? report.visibleSectors.map(String) : [];
  const visibleSectors = Array.from(new Set(visible)).filter(key => allowed.has(key));
  return {
    clubId:Number(clubId),
    visibleSectors,
    daysObserved:Math.max(0, Math.round(Number(report.daysObserved || 0))),
    revealCount:Math.max(visibleSectors.length, Math.round(Number(report.revealCount || 0))),
    createdDate:validIsoDate(report.createdDate) ? report.createdDate : (game?.currentDate || currentCalendarDate()),
    lastUpdatedDate:validIsoDate(report.lastUpdatedDate) ? report.lastUpdatedDate : null,
    lastObservedDate:validIsoDate(report.lastObservedDate) ? report.lastObservedDate : null,
    lastRevealDate:validIsoDate(report.lastRevealDate) ? report.lastRevealDate : null,
    dynamic:true,
    type:'team_sector_report'
  };
}
function normalizeScoutingReport(playerId, report={}){
  const player = typeof playerById === 'function' ? playerById(playerId) : null;
  const storedVisible = Array.isArray(report.visibleSkills) ? report.visibleSkills.map(String) : [];
  const visible = player ? migrateLegacyScoutingVisibleSkills(player, storedVisible) : storedVisible;
  const allowed = new Set(player ? scoutingSkillKeys(player) : visible);
  const initialKnown = player ? scoutingInitialKnownSkillKeys(player) : [];
  const visibleSkills = Array.from(new Set([...initialKnown, ...visible])).filter(key => !allowed.size || allowed.has(key));
  const initialKnownSet = new Set(initialKnown);
  const revealedOnlyCount = player
    ? visibleSkills.filter(key => !initialKnownSet.has(key)).length
    : visibleSkills.length;
  return {
    playerId:Number(playerId),
    visibleSkills,
    daysObserved:Math.max(0, Math.round(Number(report.daysObserved || 0))),
    revealCount:Math.max(revealedOnlyCount, Math.round(Number(report.revealCount || 0))),
    lastUpdatedDate:validIsoDate(report.lastUpdatedDate) ? report.lastUpdatedDate : null,
    lastObservedDate:validIsoDate(report.lastObservedDate) ? report.lastObservedDate : null,
    lastRevealDate:validIsoDate(report.lastRevealDate) ? report.lastRevealDate : null,
    createdDate:validIsoDate(report.createdDate) ? report.createdDate : (game?.currentDate || currentCalendarDate())
  };
}
function ensureScoutingCenterState(){
  if(!game) return createInitialScoutingCenterState();
  game.scoutingCenter = normalizeScoutingCenterState(game.scoutingCenter || {});
  return game.scoutingCenter;
}
function scoutingChiefType(type){
  const key = String(type || '').toLowerCase();
  return (SCOUTING_CHIEF_TYPES || []).find(item => item.key === key) || null;
}
function scoutingCapacities(state=null){
  const clean = state || game?.scoutingCenter || {};
  const offices = Math.max(0, Math.round(Number(clean.offices || 0)));
  return {
    scoutCapacity:SCOUTING_BASE_SCOUTS + offices * SCOUTING_SCOUTS_PER_OFFICE,
    playerCapacity:SCOUTING_BASE_PLAYER_SLOTS + offices * SCOUTING_PLAYERS_PER_OFFICE
  };
}
function scoutingChiefMaxOffices(state=null){
  const clean = state || ensureScoutingCenterState();
  const type = scoutingChiefType(clean.chief?.type);
  return type ? type.maxOffices : 0;
}
function scoutingIsOwnPlayer(player){
  return Boolean(player && game && Number(player.clubId || 0) === Number(game.selectedClubId || 0));
}
const SCOUTING_SIGNING_CHANCE_KEY = 'market.signingChance';
function stripScoutingSigningChanceFromReport(report){
  if(!report || typeof report !== 'object') return report;
  if(Array.isArray(report.visibleSkills)){
    report.visibleSkills = report.visibleSkills.filter(key => String(key) !== SCOUTING_SIGNING_CHANCE_KEY);
  }
  report.revealCount = Math.max(0, Math.round(Number(report.revealCount || 0)) - 1);
  return report;
}
function clearScoutedSigningChances(){
  if(!game?.scoutingCenter?.reports) return 0;
  let changed = 0;
  Object.keys(game.scoutingCenter.reports || {}).forEach(id => {
    const report = game.scoutingCenter.reports[id];
    if(report && Array.isArray(report.visibleSkills) && report.visibleSkills.includes(SCOUTING_SIGNING_CHANCE_KEY)){
      stripScoutingSigningChanceFromReport(report);
      changed += 1;
    }
  });
  return changed;
}
function scoutingSigningChanceMap(player){
  if(!player || scoutingIsOwnPlayer(player)) return {};
  const chance = typeof marketPlayerAcceptanceChance === 'function' ? marketPlayerAcceptanceChance(player) : null;
  if(chance === null || chance === undefined || !Number.isFinite(Number(chance))) return {};
  return { [SCOUTING_SIGNING_CHANCE_KEY]: Math.round(Number(chance) * 10) / 10 };
}
function playerHasScoutedSigningChance(playerOrId){
  const player = typeof playerOrId === 'object' ? playerOrId : (typeof playerById === 'function' ? playerById(Number(playerOrId || 0)) : null);
  if(!player || scoutingIsOwnPlayer(player)) return false;
  const known = typeof scoutingKnownSet === 'function' ? scoutingKnownSet(player.id) : new Set();
  return known.has(SCOUTING_SIGNING_CHANCE_KEY);
}
function scoutingSigningChanceValue(player){
  const map = scoutingSigningChanceMap(player);
  return map[SCOUTING_SIGNING_CHANCE_KEY];
}
function scoutingSigningChanceLabel(player){
  const value = scoutingSigningChanceValue(player);
  if(value === null || value === undefined || !Number.isFinite(Number(value))) return '—';
  const clean = Math.round(Number(value) * 10) / 10;
  return `${clean}%`;
}
const SCOUTING_HIDDEN_INTERNAL_SKILL_KEYS = new Set(['agresividad','genetica','factorSorpresa']);
const SCOUTING_DETAILED_SKILL_ORDER = [
  'porteria','entradas','marca','posicionamiento','paseCorto','paseLargo','vision','regate','tecnica','remate',
  'cabezazo','velocidad','aceleracion','fuerza','resistencia','trabajoEquipo','serenidad','disciplina','liderazgo','potencial'
];
function scoutingDetailedSkillKeys(player){
  const skills = player?.skills && typeof player.skills === 'object' && !Array.isArray(player.skills) ? player.skills : {};
  const available = Object.keys(skills).filter(key => !SCOUTING_HIDDEN_INTERNAL_SKILL_KEYS.has(String(key)));
  const availableSet = new Set(available);
  const ordered = SCOUTING_DETAILED_SKILL_ORDER.filter(key => availableSet.has(key));
  const extras = available.filter(key => !ordered.includes(key)).sort((a,b) => String(a).localeCompare(String(b), 'es'));
  return [...ordered, ...extras];
}
function scoutingDetailedStatMap(player, resolver=null){
  if(!player) return {};
  const resolve = typeof resolver === 'function'
    ? resolver
    : (typeof baseSkill === 'function' ? baseSkill : ((p,key) => p?.skills?.[key]));
  return Object.fromEntries(scoutingDetailedSkillKeys(player).map(key => {
    const raw = key === 'potencial'
      ? Number(player?.skills?.[key])
      : Number(resolve(player, key));
    const fallback = Number(player?.skills?.[key]);
    const value = Number.isFinite(raw) ? raw : fallback;
    return [key, Number.isFinite(value) ? clamp(Math.round(value), key === 'factorSorpresa' ? 0 : 1, 99) : '—'];
  }));
}
function scoutingDetailedStatMapWithResolver(player, resolver){
  return scoutingDetailedStatMap(player, resolver);
}
function scoutingVisibleStatMap(player){
  return scoutingDetailedStatMap(player);
}
function scoutingLegacySummaryComponents(player, key){
  const keeper = String(player?.position || '').toUpperCase() === 'POR';
  const map = keeper ? {
    'Ataque/Salto':['cabezazo','fuerza'],
    'Defensa':['porteria','posicionamiento'],
    'Pase':['paseCorto','paseLargo'],
    'Velocidad/Reflejos':['porteria','serenidad','aceleracion'],
    'Cabezazo/Mando':['liderazgo','trabajoEquipo','serenidad'],
    'Tiro/Potencia':['fuerza','paseLargo'],
    'Resistencia':['resistencia']
  } : {
    'Ataque/Salto':['remate','regate','posicionamiento'],
    'Defensa':['marca','entradas','posicionamiento'],
    'Pase':['paseCorto','paseLargo','vision'],
    'Velocidad/Reflejos':['velocidad','aceleracion'],
    'Cabezazo/Mando':['cabezazo'],
    'Tiro/Potencia':['remate'],
    'Resistencia':['resistencia']
  };
  return map[String(key)] || [];
}
function migrateLegacyScoutingVisibleSkills(player, visible=[]){
  const migrated = [];
  (Array.isArray(visible) ? visible : []).forEach(rawKey => {
    const key = String(rawKey);
    const components = scoutingLegacySummaryComponents(player, key);
    if(components.length) migrated.push(...components);
    else migrated.push(key);
  });
  return Array.from(new Set(migrated));
}
function scoutingSummarySkillKnown(player, summaryKey, knownSet=null){
  if(!player) return false;
  if(!scoutingIsOwnPlayer(player) && !knownSet && typeof scoutingKnownSet !== 'function') return false;
  const known = knownSet || (typeof scoutingKnownSet === 'function' ? scoutingKnownSet(player.id) : new Set());
  if(known.has(summaryKey)) return true;
  const components = scoutingLegacySummaryComponents(player, summaryKey).filter(key => Object.prototype.hasOwnProperty.call(player?.skills || {}, key));
  return components.length > 0 && components.every(key => known.has(key));
}
function scoutingDetailedSkillGroupDefinitions(){
  return [
    { key:'goalkeeping', label:'Portería', skills:['porteria'] },
    { key:'defensive', label:'Defensivas', skills:['entradas','marca','posicionamiento'] },
    { key:'technical', label:'Técnicas y ofensivas', skills:['paseCorto','paseLargo','vision','regate','tecnica','remate','cabezazo'] },
    { key:'physical', label:'Físicas', skills:['velocidad','aceleracion','fuerza','resistencia'] },
    { key:'mental', label:'Mentales y desarrollo', skills:['trabajoEquipo','serenidad','disciplina','liderazgo','potencial'] }
  ];
}
function scoutingDetailedSkillGroups(player){
  const map = scoutingVisibleStatMap(player);
  const used = new Set();
  const groups = scoutingDetailedSkillGroupDefinitions().map(group => {
    const entries = group.skills.filter(key => Object.prototype.hasOwnProperty.call(map, key)).map(key => {
      used.add(key);
      return [key, map[key]];
    });
    return { ...group, map:Object.fromEntries(entries) };
  }).filter(group => Object.keys(group.map).length);
  const extras = Object.entries(map).filter(([key]) => !used.has(key));
  if(extras.length) groups.push({ key:'other', label:'Otras habilidades', skills:extras.map(([key]) => key), map:Object.fromEntries(extras) });
  return groups;
}
function scoutingHiddenStatMap(player){
  if(!player || typeof hiddenStats !== 'function') return {};
  const stats = hiddenStats(player);
  return {
    'hidden.aggression': stats.aggression,
    'hidden.genetics': stats.genetics,
    'hidden.surprise': stats.surprise
  };
}
function scoutingFullStatMap(player){
  return { ...scoutingVisibleStatMap(player), ...scoutingHiddenStatMap(player), ...scoutingSigningChanceMap(player) };
}
function scoutingHiddenSkillKeys(player){
  return Object.keys(scoutingHiddenStatMap(player) || {});
}
function scoutingVisibleSkillKeys(player){
  return Object.keys(scoutingVisibleStatMap(player) || {});
}
function scoutingInitialKnownSkillKeys(player){
  if(!scoutingIsOwnPlayer(player)) return [];
  return scoutingVisibleSkillKeys(player);
}
function scoutingSkillKeys(player){
  if(!player) return [];
  return Object.keys(scoutingFullStatMap(player) || {});
}
function scoutingMissingSkillKeysForPlayer(player, report=null){
  if(!player) return [];
  const cleanReport = report || scoutingReportForPlayer(player.id);
  const known = new Set(cleanReport.visibleSkills || []);
  // Jugadores propios: sólo se ojea información oculta faltante. Nunca se gasta avance en habilidades visibles.
  if(scoutingIsOwnPlayer(player)) return scoutingHiddenSkillKeys(player).filter(key => !known.has(key));
  // Jugadores externos: se revela cualquier dato todavía desconocido, visible u oculto, sin repetir habilidades ya ojeadas.
  return scoutingSkillKeys(player).filter(key => !known.has(key));
}
function scoutingMissingSectorKeysForTeam(clubId, report=null){
  const cleanReport = report || scoutingTeamReportForClub(clubId);
  const known = new Set(cleanReport.visibleSectors || []);
  return scoutingTeamSectorKeys().filter(key => !known.has(key));
}
function markScoutingDailyObservation(state, today){
  if(!state || !validIsoDate(today)) return 0;
  let observed = 0;
  (state.listedPlayerIds || []).forEach(playerId => {
    const player = typeof playerById === 'function' ? playerById(playerId) : null;
    if(!player) return;
    const report = scoutingReportForPlayer(player.id, state);
    if(report.lastObservedDate === today) return;
    report.daysObserved = Math.max(0, Number(report.daysObserved || 0)) + 1;
    report.lastObservedDate = today;
    observed += 1;
  });
  (state.listedTeamIds || []).forEach(clubId => {
    const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
    if(!club) return;
    const report = scoutingTeamReportForClub(club.id, state);
    if(report.lastObservedDate === today) return;
    report.daysObserved = Math.max(0, Number(report.daysObserved || 0)) + 1;
    report.lastObservedDate = today;
    observed += 1;
  });
  return observed;
}
function scoutingKnownSet(playerId){
  const state = ensureScoutingCenterState();
  return new Set(state.reports[String(playerId)]?.visibleSkills || []);
}
function scoutingKnownCount(playerId){ return scoutingKnownSet(playerId).size; }
function scoutingReportForPlayer(playerId, stateOverride=null){
  const state = stateOverride || ensureScoutingCenterState();
  state.reports = (state.reports && typeof state.reports === 'object' && !Array.isArray(state.reports)) ? state.reports : {};
  const key = String(Number(playerId || 0));
  if(!state.reports[key]) state.reports[key] = normalizeScoutingReport(playerId, {});
  return state.reports[key];
}
function addPlayerToScoutingCenter(playerId, options={}){
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){ showNotice('No podés ojear jugadores mientras estás sin club.'); return; }
  if(!SCOUTING_CENTER_ENABLED || !game){ showNotice('El Centro de Ojeo no está disponible.'); return; }
  const player = playerById(playerId);
  if(!player){ showNotice('Jugador no encontrado.'); return; }
  const ownPlayer = scoutingIsOwnPlayer(player);
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  const keepFicha = options.keepFicha !== false;
  const refreshFicha = () => {
    if(keepFicha && typeof showPlayerModal === 'function' && document.querySelector('.modal-backdrop')) showPlayerModal(Number(playerId));
  };
  if(state.listedPlayerIds.includes(Number(playerId))){
    showNotice(`${player.name} ya está en el Centro de Ojeo.`);
    refreshFicha();
    return;
  }
  if((state.listedPlayerIds.length + (state.listedTeamIds || []).length) >= caps.playerCapacity){ showNotice('No hay cupos libres en la lista de ojeo. Alquilá oficinas o quitá jugadores/equipos.'); return; }
  state.listedPlayerIds.push(Number(playerId));
  state.reports[String(playerId)] = normalizeScoutingReport(playerId, state.reports[String(playerId)] || {});
  saveLocal(true);
  showNotice(ownPlayer ? `${player.name} fue agregado para revelar habilidades ocultas.` : `${player.name} fue agregado al Centro de Ojeo.`);
  if(keepFicha){
    refreshFicha();
    return;
  }
  activeTab='scouting';
  if(typeof closeModal === 'function') closeModal();
  renderAll();
}

function addTeamToScoutingCenter(clubId){
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){ showNotice('No podés ojear equipos mientras estás sin club.'); return; }
  if(!SCOUTING_CENTER_ENABLED || !game){ showNotice('El Centro de Ojeo no está disponible.'); return; }
  const id = Number(clubId || 0);
  const club = seed?.clubs?.find(c => Number(c.id) === id);
  if(!club){ showNotice('Club no encontrado.'); return; }
  if(id === Number(game.selectedClubId || 0)){ showNotice('No necesitás ojear tu propio equipo desde el Centro de Ojeo.'); return; }
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  state.listedTeamIds = Array.isArray(state.listedTeamIds) ? state.listedTeamIds.map(Number).filter(Boolean) : [];
  if(state.listedTeamIds.includes(id)){ showNotice(`${club.name} ya está en el Centro de Ojeo.`); activeTab='scouting'; if(typeof closeModal === 'function') closeModal(); renderAll(); return; }
  if((state.listedPlayerIds.length + state.listedTeamIds.length) >= caps.playerCapacity){ showNotice('No hay cupos libres en la lista de ojeo. Alquilá oficinas o quitá jugadores/equipos.'); return; }
  state.listedTeamIds.push(id);
  state.teamReports = (state.teamReports && typeof state.teamReports === 'object' && !Array.isArray(state.teamReports)) ? state.teamReports : {};
  state.teamReports[String(id)] = normalizeScoutingTeamReport(id, state.teamReports[String(id)] || {});
  saveLocal(true);
  showNotice(`${club.name} fue agregado al Centro de Ojeo.`);
  activeTab='scouting';
  if(typeof closeModal === 'function') closeModal();
  renderAll();
}
function removeTeamFromScoutingCenter(clubId){
  const state = ensureScoutingCenterState();
  const id = Number(clubId || 0);
  state.listedTeamIds = (state.listedTeamIds || []).map(Number).filter(teamId => teamId !== id);
  if(state.teamReports?.[String(id)]) state.teamReports[String(id)] = normalizeScoutingTeamReport(id, state.teamReports[String(id)]);
  saveLocal(true);
  renderScoutingCenter();
}
function scoutingTeamSectorStats(clubId){
  const squad = typeof playersByClub === 'function' ? playersByClub(clubId).filter(Boolean) : [];
  const avgSafe = values => values.length ? clamp(Math.round(avg(values)), 0, 99) : 0;
  const groupAvg = (players, resolver) => avgSafe(players.map(player => avgSafe(resolver(player))));
  const defenders = squad.filter(p => ['POR','DFC','LI','LD'].includes(String(p.position || '').toUpperCase()));
  const mids = squad.filter(p => ['MCD','MC','MCO','MD','MI'].includes(String(p.position || '').toUpperCase()));
  const attackers = squad.filter(p => ['DC','EI','ED'].includes(String(p.position || '').toUpperCase()));
  const skill = (p,key) => Number(p?.skills?.[key] ?? 0);
  return {
    defense:groupAvg(defenders, p => String(p.position || '').toUpperCase() === 'POR'
      ? [skill(p,'porteria'), skill(p,'posicionamiento'), skill(p,'serenidad')]
      : [skill(p,'marca'), skill(p,'entradas'), skill(p,'posicionamiento')]),
    midfield:groupAvg(mids, p => [skill(p,'paseCorto'), skill(p,'paseLargo'), skill(p,'vision')]),
    attack:groupAvg(attackers, p => [skill(p,'remate'), skill(p,'cabezazo')]),
    counts:{ defense:defenders.length, midfield:mids.length, attack:attackers.length, total:squad.length }
  };
}
function scoutingTeamReportForClub(clubId, stateOverride=null){
  const state = stateOverride || ensureScoutingCenterState();
  state.teamReports = (state.teamReports && typeof state.teamReports === 'object' && !Array.isArray(state.teamReports)) ? state.teamReports : {};
  const key = String(Number(clubId || 0));
  if(!state.teamReports[key]) state.teamReports[key] = normalizeScoutingTeamReport(clubId, {});
  return state.teamReports[key];
}
function scoutingTeamKnownSet(clubId){
  const report = scoutingTeamReportForClub(clubId);
  return new Set(report.visibleSectors || []);
}
function scoutingTeamKnownCount(clubId){
  return scoutingTeamKnownSet(clubId).size;
}
function scoutingTeamSectorMarkup(clubId){
  const stats = scoutingTeamSectorStats(clubId);
  const known = scoutingTeamKnownSet(clubId);
  const rows = scoutingTeamSectorDefinitions().map(item => ({
    ...item,
    value:Number(stats[item.key] || 0),
    count:Number(stats.counts?.[item.key] || 0),
    visible:known.has(item.key)
  }));
  return `<div class="tactic-skill-visor-list scouting-team-visors">${rows.map(row => {
    const shownValue = row.visible ? `${row.value}%` : '—';
    const barWidth = row.visible ? row.value : 0;
    const status = row.visible ? `${row.count} jugador(es) relevados` : 'Parámetro pendiente de ojeo';
    return `<div class="tactic-skill-visor ${row.key} ${row.visible ? 'known' : 'unknown'}"><div class="row"><span>${escapeHtml(row.label)}</span><strong>${shownValue}</strong></div><div class="project-progress"><span style="width:${barWidth}%"></span></div><small class="muted">${escapeHtml(status)}</small></div>`;
  }).join('')}</div>`;
}
function scoutingTeamCard(clubId){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  if(!club) return '';
  const report = scoutingTeamReportForClub(clubId);
  const squadCount = typeof playersByClub === 'function' ? playersByClub(clubId).length : 0;
  const known = scoutingTeamKnownCount(clubId);
  const total = scoutingTeamSectorKeys().length || 1;
  const pct = clamp(Math.round((known / total) * 100), 0, 100);
  return `<div class="scouting-player-card scouting-team-card card inner">
    <div class="scouting-player-head">
      <div class="scouting-team-badge">${clubBadge(club.id) || '▣'}</div>
      <div><h3>${escapeHtml(club.name)}</h3><p class="muted small">${escapeHtml(club.divisionId || '')} · Plantel ${squadCount} · informe dinámico</p><span class="pill">Equipo ojeado</span></div>
      <button class="ghost small-btn" data-remove-scouting-team="${club.id}">Quitar</button>
    </div>
    <div class="project-progress scouting-report-progress"><span style="width:${pct}%"></span></div>
    <p class="muted small">Parámetros conocidos: ${known}/${total} · Días observado: ${Number(report.daysObserved || 0)}. Los porcentajes usan el promedio actual del plantel bot y pueden cambiar si el club modifica jugadores.</p>
    ${scoutingTeamSectorMarkup(club.id)}
    <p class="muted small">Creado: ${escapeHtml(report.createdDate || '—')}</p>
  </div>`;
}
function scoutingPlayerSearchChanceThreshold(search=null){
  const clean = search || ensureScoutingCenterState().playerSearch;
  const value = Number(clean?.signingChance || 0);
  return [30,50,80].includes(value) ? value : 0;
}
function scoutingPlayerSearchRoleLabel(role){
  return String(role || 'all') === 'all' ? 'Cualquier rol' : roleMeta(String(role)).name;
}
function scoutingPlayerSearchChanceLabel(value){
  const key = String(value || 'any');
  return key === 'any' ? 'Cualquiera' : `Más de ${key}%`;
}
function scoutingPlayerSearchCandidates(stateOverride=null){
  const state = stateOverride || ensureScoutingCenterState();
  const search = normalizeScoutingPlayerSearchState(state.playerSearch);
  const role = String(search.role || 'all');
  const threshold = scoutingPlayerSearchChanceThreshold(search);
  const ageMin = search.ageMin;
  const ageMax = search.ageMax;
  const salaryMin = search.salaryMin;
  const salaryMax = search.salaryMax;
  const listed = new Set((state.listedPlayerIds || []).map(Number));
  return (seed?.players || []).filter(player => {
    if(!player || !Number(player.id) || player.retired || player.sold) return false;
    if(Number(player.clubId || 0) === Number(game?.selectedClubId || 0)) return false;
    if(listed.has(Number(player.id))) return false;
    if(role !== 'all' && String(player.position || '').toUpperCase() !== role) return false;
    const age = Math.max(0, Math.round(Number(player.age || 0)));
    const salary = Math.max(0, Math.round(Number(player.salary || 0)));
    if(ageMin !== null && age < ageMin) return false;
    if(ageMax !== null && age > ageMax) return false;
    if(salaryMin !== null && salary < salaryMin) return false;
    if(salaryMax !== null && salary > salaryMax) return false;
    if(threshold > 0){
      const chance = typeof marketPlayerAcceptanceChance === 'function' ? Number(marketPlayerAcceptanceChance(player)) : NaN;
      if(!Number.isFinite(chance) || chance <= threshold) return false;
    }
    return true;
  }).sort((a,b) => Number(a.id || 0) - Number(b.id || 0));
}
function scoutingPlayerSearchPick(candidates, search, today){
  if(!Array.isArray(candidates) || !candidates.length) return null;
  const seedKey = `player-search-${today}-${game?.seasonNumber || 1}-${search.role}-${search.signingChance}-${search.ageMin ?? '-'}-${search.ageMax ?? '-'}-${search.salaryMin ?? '-'}-${search.salaryMax ?? '-'}-${search.lastResultDate || '-'}-${candidates.length}`;
  return candidates[hashNumber(seedKey, candidates.length)] || candidates[0];
}
function resetScoutingPlayerSearchProgress(search, { disable=false }={}){
  if(!search) return;
  if(disable) search.enabled = false;
  search.progressDays = 0;
  search.requiredDays = scoutingPlayerSearchRequiredDays(search.role, search.signingChance, search.ageMin, search.ageMax, search.salaryMin, search.salaryMax);
  search.startedDate = search.enabled ? (game?.currentDate || currentCalendarDate()) : null;
  search.status = search.enabled ? 'searching' : 'idle';
}
function updateScoutingPlayerSearchCriteria(field, value){
  const state = ensureScoutingCenterState();
  const search = state.playerSearch;
  if(field === 'role') search.role = SCOUTING_PLAYER_SEARCH_ROLES.includes(String(value)) ? String(value) : 'all';
  if(field === 'signingChance') search.signingChance = SCOUTING_PLAYER_SEARCH_CHANCES.includes(String(value)) ? String(value) : 'any';
  if(field === 'ageMin') search.ageMin = normalizeScoutingPlayerSearchBound(value, 15, 60);
  if(field === 'ageMax') search.ageMax = normalizeScoutingPlayerSearchBound(value, 15, 60);
  if(field === 'salaryMin') search.salaryMin = normalizeScoutingPlayerSearchBound(value, 0);
  if(field === 'salaryMax') search.salaryMax = normalizeScoutingPlayerSearchBound(value, 0);
  state.playerSearch = normalizeScoutingPlayerSearchState(search);
  resetScoutingPlayerSearchProgress(state.playerSearch);
  saveLocal(true);
  renderScoutingCenter();
  if(state.playerSearch.enabled) showNotice(`Criterios actualizados. La búsqueda se reinició y demorará ${state.playerSearch.requiredDays} día(s).`);
}
function toggleScoutingPlayerSearch(){
  if(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive()){
    showNotice('No podés buscar jugadores mientras estás sin club.');
    return;
  }
  const state = ensureScoutingCenterState();
  const search = state.playerSearch;
  if(!search.enabled && !scoutingChiefType(state.chief?.type)){
    resetScoutingPlayerSearchProgress(search, { disable:true });
    saveLocal(true);
    renderScoutingCenter();
    showNotice('Necesitás contratar un jefe de ojeadores para activar la búsqueda de jugadores.');
    return;
  }
  search.enabled = !search.enabled;
  resetScoutingPlayerSearchProgress(search, { disable:!search.enabled });
  saveLocal(true);
  renderScoutingCenter();
  showNotice(search.enabled
    ? `Búsqueda activada. Costo ${formatMoney(SCOUTING_PLAYER_SEARCH_DAILY_COST)} por día y duración estimada ${search.requiredDays} día(s).`
    : 'Búsqueda apagada. La barra de progreso volvió a cero.');
}
function addScoutingPlayerSearchResult(player, state, today){
  if(!player || !state) return false;
  const caps = scoutingCapacities(state);
  const usedSlots = (state.listedPlayerIds || []).length + (state.listedTeamIds || []).length;
  if(usedSlots >= caps.playerCapacity) return false;
  state.listedPlayerIds.push(Number(player.id));
  state.listedPlayerIds = Array.from(new Set(state.listedPlayerIds.map(Number).filter(Boolean)));
  state.reports[String(player.id)] = normalizeScoutingReport(player.id, state.reports[String(player.id)] || {});
  const search = state.playerSearch;
  search.foundPlayerIds = Array.from(new Set([...(search.foundPlayerIds || []), Number(player.id)]));
  search.lastResultPlayerId = Number(player.id);
  search.lastResultDate = today;
  search.status = 'found';
  search.progressDays = 0;
  search.startedDate = today;
  if(typeof pushGameMessage === 'function') pushGameMessage({
    type:'ojeo',
    priority:'normal',
    title:`Búsqueda completada: ${player.name}`,
    body:`El Centro de Ojeo encontró a ${player.name}, ${roleBadge(player.position)} de ${clubName(player.clubId)}. Fue agregado automáticamente a la lista activa y quedó resaltado como resultado de búsqueda.`,
    id:`scouting-search-result-${game?.seasonNumber || 1}-${today}-${player.id}`
  });
  return true;
}
function processScoutingPlayerSearchDaily(state, today, reason='daily'){
  const search = state?.playerSearch;
  if(!search?.enabled) return { cost:0, foundPlayerId:null, progress:0, required:scoutingPlayerSearchRequiredDays(search?.role, search?.signingChance, search?.ageMin, search?.ageMax, search?.salaryMin, search?.salaryMax) };
  if(!scoutingChiefType(state?.chief?.type)){
    resetScoutingPlayerSearchProgress(search, { disable:true });
    return { cost:0, foundPlayerId:null, disabled:true, missingChief:true, progress:0, required:search.requiredDays };
  }
  if(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive()){
    resetScoutingPlayerSearchProgress(search, { disable:true });
    return { cost:0, foundPlayerId:null, disabled:true, progress:0, required:search.requiredDays };
  }
  const cost = Math.max(0, Number(SCOUTING_PLAYER_SEARCH_DAILY_COST || 0));
  if(cost > 0) recordBudgetChange(-cost, 'Búsqueda activa de jugadores', {
    type:'scouting_player_search_daily',
    role:search.role,
    signingChance:search.signingChance,
    ageMin:search.ageMin,
    ageMax:search.ageMax,
    salaryMin:search.salaryMin,
    salaryMax:search.salaryMax,
    reason
  });
  search.requiredDays = scoutingPlayerSearchRequiredDays(search.role, search.signingChance, search.ageMin, search.ageMax, search.salaryMin, search.salaryMax);
  if(!search.startedDate) search.startedDate = today;
  search.status = 'searching';
  search.progressDays = Math.min(search.requiredDays, Math.max(0, Number(search.progressDays || 0)) + 1);
  if(search.progressDays < search.requiredDays){
    return { cost, foundPlayerId:null, progress:search.progressDays, required:search.requiredDays };
  }
  if(search.lastResultDate && validIsoDate(search.lastResultDate)){
    const daysSinceResult = Math.max(0, daysBetweenIsoDates(search.lastResultDate, today));
    if(daysSinceResult < 7){
      search.status = 'weekly_wait';
      return { cost, foundPlayerId:null, weeklyWait:true, daysUntilNext:7 - daysSinceResult, progress:search.progressDays, required:search.requiredDays };
    }
  }
  const caps = scoutingCapacities(state);
  const usedSlots = (state.listedPlayerIds || []).length + (state.listedTeamIds || []).length;
  if(usedSlots >= caps.playerCapacity){
    search.status = 'waiting_slot';
    return { cost, foundPlayerId:null, waitingSlot:true, progress:search.progressDays, required:search.requiredDays };
  }
  const candidates = scoutingPlayerSearchCandidates(state);
  if(!candidates.length){
    search.status = 'no_matches';
    return { cost, foundPlayerId:null, noMatches:true, progress:search.progressDays, required:search.requiredDays };
  }
  const player = scoutingPlayerSearchPick(candidates, search, today);
  const added = addScoutingPlayerSearchResult(player, state, today);
  return { cost, foundPlayerId:added ? Number(player.id) : null, progress:search.progressDays, required:search.requiredDays };
}
function scoutingPlayerSearchStatusText(search, state){
  if(!scoutingChiefType(state?.chief?.type)) return 'Requiere un jefe de ojeadores contratado. Sin jefe, la búsqueda se apaga y reinicia su progreso.';
  if(!search.enabled) return 'La búsqueda está apagada. Al activarla, el progreso empieza desde cero.';
  if(search.status === 'weekly_wait'){
    const passed = search.lastResultDate && validIsoDate(search.lastResultDate) ? Math.max(0, daysBetweenIsoDates(search.lastResultDate, game?.currentDate || currentCalendarDate())) : 7;
    return `Informe listo. Por el límite de un jugador por semana, la próxima incorporación estará disponible en ${Math.max(0, 7 - passed)} día(s).`;
  }
  if(search.status === 'waiting_slot') return 'Búsqueda completa, pero no hay cupos libres. Quitá un seguimiento o alquilá una oficina.';
  if(search.status === 'no_matches') return 'Búsqueda completa sin coincidencias. Se volverá a intentar mientras permanezca activa.';
  if(search.status === 'found' && search.lastResultPlayerId){
    const player = typeof playerById === 'function' ? playerById(search.lastResultPlayerId) : null;
    return player ? `Último jugador encontrado: ${player.name}. El próximo ciclo ya puede comenzar.` : 'Jugador encontrado y agregado a la lista activa.';
  }
  const remaining = Math.max(0, Number(search.requiredDays || 1) - Number(search.progressDays || 0));
  return remaining > 0 ? `Faltan ${remaining} día(s) de búsqueda.` : 'Analizando coincidencias disponibles.';
}
function scoutingPlayerSearchMarkup(state){
  const search = normalizeScoutingPlayerSearchState(state.playerSearch);
  state.playerSearch = search;
  const hasChief = Boolean(scoutingChiefType(state.chief?.type));
  if(!hasChief && search.enabled) resetScoutingPlayerSearchProgress(search, { disable:true });
  const pct = clamp(Math.round((Number(search.progressDays || 0) / Math.max(1, Number(search.requiredDays || 1))) * 100), 0, 100);
  const roleOptions = SCOUTING_PLAYER_SEARCH_ROLES.map(role => `<option value="${role}" ${search.role === role ? 'selected' : ''}>${escapeHtml(scoutingPlayerSearchRoleLabel(role))}</option>`).join('');
  const chanceOptions = SCOUTING_PLAYER_SEARCH_CHANCES.map(value => `<option value="${value}" ${search.signingChance === value ? 'selected' : ''}>${escapeHtml(scoutingPlayerSearchChanceLabel(value))}</option>`).join('');
  const durationParts = ['1 día base'];
  if(search.role !== 'all') durationParts.push('+2 por rol');
  if(search.signingChance !== 'any') durationParts.push(`+${({ '30':1, '50':2, '80':3 })[search.signingChance]} por probabilidad`);
  if(scoutingPlayerSearchRangeActive(search.ageMin, search.ageMax)) durationParts.push('+3 por edad');
  if(scoutingPlayerSearchRangeActive(search.salaryMin, search.salaryMax)) durationParts.push('+3 por sueldo');
  const ageMinValue = search.ageMin ?? '';
  const ageMaxValue = search.ageMax ?? '';
  const salaryMinValue = search.salaryMin ?? '';
  const salaryMaxValue = search.salaryMax ?? '';
  return `<div class="card scouting-search-card ${search.enabled ? 'is-active' : 'is-off'} ${hasChief ? '' : 'requires-chief'}">
    <div class="scouting-card-head">
      <div class="scouting-card-icon">${scoutingSvgIcon('radar', 'small')}</div>
      <div><p class="label">Descubrimiento automático</p><h3>Buscar jugadores</h3></div>
      <button class="scouting-search-switch ${search.enabled ? 'on' : 'off'} ${hasChief ? '' : 'requires-chief'}" data-toggle-scouting-player-search role="switch" aria-checked="${search.enabled ? 'true' : 'false'}" aria-disabled="${hasChief ? 'false' : 'true'}"><span>${hasChief ? (search.enabled ? 'ON' : 'OFF') : 'REQUIERE JEFE'}</span></button>
    </div>
    <p class="muted small">${hasChief ? 'Encuentra como máximo un jugador por semana según los criterios elegidos y lo agrega automáticamente a la lista activa.' : 'Contratá un jefe de ojeadores para habilitar este servicio.'} Costo: <strong class="bad">${formatMoney(SCOUTING_PLAYER_SEARCH_DAILY_COST)} por día activo</strong>.</p>
    <div class="scouting-search-filters">
      <label><span>Rol</span><select data-scouting-search-role>${roleOptions}</select></label>
      <label><span>Probabilidad de fichaje</span><select data-scouting-search-chance>${chanceOptions}</select></label>
      <label><span>Edad desde</span><input type="number" min="15" max="60" step="1" value="${ageMinValue}" placeholder="Sin mínimo" data-scouting-search-age-min></label>
      <label><span>Edad hasta</span><input type="number" min="15" max="60" step="1" value="${ageMaxValue}" placeholder="Sin máximo" data-scouting-search-age-max></label>
      <label><span>Sueldo desde</span><input type="number" min="0" step="50000" value="${salaryMinValue}" placeholder="Sin mínimo" data-scouting-search-salary-min></label>
      <label><span>Sueldo hasta</span><input type="number" min="0" step="50000" value="${salaryMaxValue}" placeholder="Sin máximo" data-scouting-search-salary-max></label>
    </div>
    <div class="scouting-search-duration"><strong>${search.requiredDays} día(s)</strong><span>${escapeHtml(durationParts.join(' · '))}</span></div>
    <div class="project-progress scouting-search-progress"><span style="width:${pct}%"></span></div>
    <div class="scouting-search-progress-copy"><strong>${search.progressDays}/${search.requiredDays} días</strong><span>${escapeHtml(scoutingPlayerSearchStatusText(search, state))}</span></div>
  </div>`;
}

function removePlayerFromScoutingCenter(playerId){
  const state = ensureScoutingCenterState();
  state.listedPlayerIds = state.listedPlayerIds.filter(id => Number(id) !== Number(playerId));
  state.playerSearch.foundPlayerIds = (state.playerSearch.foundPlayerIds || []).filter(id => Number(id) !== Number(playerId));
  if(Number(state.playerSearch.lastResultPlayerId || 0) === Number(playerId)) state.playerSearch.lastResultPlayerId = null;
  // El informe queda archivado. Si ya se revelaron habilidades, la ficha del jugador debe seguir mostrándolas.
  if(state.reports[String(playerId)]) state.reports[String(playerId)] = normalizeScoutingReport(playerId, state.reports[String(playerId)]);
  saveLocal(true);
  renderScoutingCenter();
}
function hireScoutingChief(type){
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('staff')){ showNotice(managerChallengeBlockedMessage('staff')); return; }
  const chief = scoutingChiefType(type);
  if(!chief){ showNotice('Jefe de ojeadores inválido.'); return; }
  const unlock = typeof staffCategoryUnlockInfo === 'function' ? staffCategoryUnlockInfo(chief.key) : { unlocked:true, requiredWins:0, wins:0 };
  if(!unlock.unlocked){ showNotice(`El jefe ${chief.name} requiere ${unlock.requiredWins} victorias con el club fundador. Llevás ${unlock.wins}.`); return; }
  const state = ensureScoutingCenterState();
  if(state.chief){ showNotice('Ya tenés un jefe de ojeadores. Se va solo al finalizar la temporada.'); return; }
  state.chief = { type:chief.key, hiredDate:game.currentDate || currentCalendarDate(), season:game.seasonNumber || 1 };
  state.chiefLastChargeDate = game.currentDate || currentCalendarDate();
  recordBudgetChange(-chief.monthlySalary, `Primer mes jefe de ojeadores ${chief.name}`, { type:'scouting_chief_salary', chief:chief.key });
  saveLocal(true);
  renderScoutingCenter();
}
function dismissScoutingChief(){
  const state = ensureScoutingCenterState();
  if(!state.chief){ showNotice('No hay un jefe de ojeadores contratado.'); return false; }
  if(state.offices > 0 || state.scouts > 0){
    const pending = [];
    if(state.offices > 0) pending.push(`${state.offices} oficina(s)`);
    if(state.scouts > 0) pending.push(`${state.scouts} ojeador(es)`);
    showNotice(`Antes de despedir al jefe debés cancelar o despedir: ${pending.join(' y ')}.`);
    return false;
  }
  const type = scoutingChiefType(state.chief.type);
  const accepted = typeof window !== 'undefined' && typeof window.confirm === 'function'
    ? window.confirm(`¿Despedir al jefe de ojeadores ${type?.name || state.chief.type}? El mes actual ya fue pagado y no se reintegra.`)
    : true;
  if(!accepted) return false;
  const dismissedName = type?.name || state.chief.type;
  state.chief = null;
  state.chiefLastChargeDate = null;
  resetScoutingPlayerSearchProgress(state.playerSearch, { disable:true });
  if(typeof pushGameMessage === 'function') pushGameMessage({
    type:'empleados',
    priority:'normal',
    title:`Jefe de ojeadores ${dismissedName} despedido`,
    body:'El Centro de Ojeo quedó sin jefe. El pago del mes actual no se reintegra y no podrán alquilarse oficinas hasta contratar un reemplazo.',
    id:`scouting-chief-dismissed-${game?.seasonNumber || 1}-${game?.globalTurn || 0}`
  });
  saveLocal(true);
  renderScoutingCenter();
  showNotice(`Jefe de ojeadores ${dismissedName} despedido. El mes pagado no se reintegra.`);
  return true;
}
function rentScoutingOffice(){
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('staff')){ showNotice(managerChallengeBlockedMessage('staff')); return; }
  const state = ensureScoutingCenterState();
  const max = scoutingChiefMaxOffices(state);
  if(state.offices >= max){ showNotice(max > 0 ? 'Tu jefe de ojeadores no puede controlar más oficinas.' : 'Contratá un jefe de ojeadores antes de alquilar oficinas.'); return; }
  state.offices += 1;
  state.officeLastChargeDate = game.currentDate || currentCalendarDate();
  recordBudgetChange(-SCOUTING_OFFICE_MONTHLY_COST, 'Alquiler mensual de oficina de ojeo', { type:'scouting_office_rent', offices:state.offices });
  saveLocal(true);
  renderScoutingCenter();
  showNotice(`Oficina de ojeo alquilada. Capacidad actual: ${scoutingCapacities(state).playerCapacity} seguimiento(s) y ${scoutingCapacities(state).scoutCapacity} ojeador(es).`);
}
function cancelScoutingOffice(){
  const state = ensureScoutingCenterState();
  if(state.offices <= 0){ showNotice('No hay oficinas de ojeo para cancelar.'); return; }
  const nextOffices = state.offices - 1;
  const nextCaps = scoutingCapacities({ ...state, offices:nextOffices });
  if(state.scouts > nextCaps.scoutCapacity){ showNotice('Primero despedí ojeadores. Con una oficina menos no alcanza el cupo actual.'); return; }
  if((state.listedPlayerIds.length + (state.listedTeamIds || []).length) > nextCaps.playerCapacity){ showNotice('Primero quitá jugadores o equipos de la lista de ojeo. Con una oficina menos no alcanza el cupo actual.'); return; }
  state.offices = nextOffices;
  if(state.offices <= 0) state.officeLastChargeDate = null;
  saveLocal(true);
  renderScoutingCenter();
}
function hireScoutingScout(){
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('staff')){ showNotice(managerChallengeBlockedMessage('staff')); return; }
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  if(state.scouts >= caps.scoutCapacity){ showNotice('No hay cupo para más ojeadores. Alquilá oficinas.'); return; }
  state.scouts += 1;
  state.scoutsLastChargeDate = game.currentDate || currentCalendarDate();
  recordBudgetChange(-SCOUTING_SCOUT_DAILY_COST, 'Contratación diaria de ojeador', { type:'scouting_scout_daily', scouts:state.scouts });
  saveLocal(true);
  renderScoutingCenter();
}
function dismissScoutingScout(){
  const state = ensureScoutingCenterState();
  if(state.scouts <= 0){ showNotice('No hay ojeadores contratados.'); return; }
  state.scouts -= 1;
  if(state.scouts <= 0) state.scoutsLastChargeDate = null;
  saveLocal(true);
  renderScoutingCenter();
}
function scoutingRevealOneSkill(attemptIndex=0, context='daily'){
  const state = ensureScoutingCenterState();
  const listed = state.listedPlayerIds.map(playerById).filter(Boolean);
  const listedTeams = (state.listedTeamIds || []).map(id => seed?.clubs?.find(c => Number(c.id) === Number(id))).filter(Boolean);
  const today = game.currentDate || currentCalendarDate();
  const candidates = [];
  listed.forEach(player => {
    const report = scoutingReportForPlayer(player.id, state);
    const ownPlayer = scoutingIsOwnPlayer(player);
    const revealPool = scoutingMissingSkillKeysForPlayer(player, report);
    if(revealPool.length){
      candidates.push({
        type:'player',
        id:Number(player.id),
        label:player.name || `Jugador ${player.id}`,
        hidden:revealPool,
        report,
        ownPlayer,
        revealCount:Math.max(0, Number(report.revealCount || 0)),
        lastRevealDate:report.lastRevealDate || ''
      });
    }
  });
  listedTeams.forEach(club => {
    const report = scoutingTeamReportForClub(club.id, state);
    const revealPool = scoutingMissingSectorKeysForTeam(club.id, report);
    if(revealPool.length){
      candidates.push({
        type:'team',
        id:Number(club.id),
        label:club.name || `Club ${club.id}`,
        hidden:revealPool,
        report,
        ownPlayer:false,
        revealCount:Math.max(0, Number(report.revealCount || 0)),
        lastRevealDate:report.lastRevealDate || ''
      });
    }
  });
  if(!candidates.length) return false;
  const ownPriority = Math.max(...candidates.map(item => Number(Boolean(item.ownPlayer))));
  const priorityCandidates = candidates.filter(item => Number(Boolean(item.ownPlayer)) === ownPriority);
  const minReveals = Math.min(...priorityCandidates.map(item => Number(item.revealCount || 0)));
  const lowRevealCandidates = priorityCandidates.filter(item => Number(item.revealCount || 0) === minReveals);
  const minMissing = Math.min(...lowRevealCandidates.map(item => Number(item.hidden.length || 0)));
  const pool = lowRevealCandidates.filter(item => Number(item.hidden.length || 0) === minMissing);
  pool.sort((a,b) => {
    const lastDateDelta = String(a.lastRevealDate || '').localeCompare(String(b.lastRevealDate || ''));
    if(lastDateDelta) return lastDateDelta;
    return String(a.label || '').localeCompare(String(b.label || ''), 'es');
  });
  const pickSeed = `scout-pick-${today}-${currentTurnIndex()}-${attemptIndex}-${context}-${pool.map(item => `${item.type}:${item.id}:${item.hidden.length}:${item.revealCount}:${item.lastRevealDate || '-'}`).join('|')}`;
  const pick = pool[hashNumber(pickSeed, pool.length)];
  const skillSeed = `scout-skill-${pick.type}-${pick.id}-${today}-${attemptIndex}-${context}-${pick.hidden.join('|')}`;
  const key = pick.hidden[hashNumber(skillSeed, pick.hidden.length)];
  const targetReport = pick.type === 'team'
    ? scoutingTeamReportForClub(pick.id, state)
    : scoutingReportForPlayer(pick.id, state);
  if(pick.type === 'team'){
    targetReport.visibleSectors = Array.from(new Set([...(targetReport.visibleSectors || []), key]));
  } else {
    targetReport.visibleSkills = Array.from(new Set([...(targetReport.visibleSkills || []), key]));
  }
  targetReport.revealCount = Math.max(0, Number(targetReport.revealCount || 0)) + 1;
  targetReport.lastRevealDate = today;
  targetReport.lastUpdatedDate = today;
  return true;
}
function scoutingChiefDailyReveals(stateOverride=null){
  const state = stateOverride || ensureScoutingCenterState();
  const type = scoutingChiefType(state.chief?.type);
  if(!type) return 0;
  if(type.revealMax <= type.revealMin) return type.revealMin;
  return type.revealMin + hashNumber(`scout-chief-${state.chief.type}-${game.currentDate}-${game.seasonNumber}`, (type.revealMax - type.revealMin) + 1);
}
function processScoutingCenterMonthlyCosts(stateOverride=null){
  const state = stateOverride || ensureScoutingCenterState();
  const today = game.currentDate || currentCalendarDate();
  if(!validIsoDate(today)) return 0;
  let total = 0;
  if(state.offices > 0 && SCOUTING_OFFICE_MONTHLY_COST > 0){
    if(!state.officeLastChargeDate) state.officeLastChargeDate = today;
    const months = Math.floor(daysBetweenIsoDates(state.officeLastChargeDate, today) / 30);
    if(months > 0){
      const cost = state.offices * SCOUTING_OFFICE_MONTHLY_COST * months;
      recordBudgetChange(-cost, 'Alquiler mensual de oficinas de ojeo', { type:'scouting_office_monthly', offices:state.offices, months });
      state.officeLastChargeDate = addDaysToIsoDate(state.officeLastChargeDate, months * 30);
      total += cost;
    }
  }
  const chief = scoutingChiefType(state.chief?.type);
  if(chief){
    if(!state.chiefLastChargeDate) state.chiefLastChargeDate = today;
    const months = Math.floor(daysBetweenIsoDates(state.chiefLastChargeDate, today) / 30);
    if(months > 0){
      const cost = chief.monthlySalary * months;
      recordBudgetChange(-cost, `Sueldo mensual jefe de ojeadores ${chief.name}`, { type:'scouting_chief_monthly', chief:chief.key, months });
      state.chiefLastChargeDate = addDaysToIsoDate(state.chiefLastChargeDate, months * 30);
      total += cost;
    }
  }
  return total;
}
function processScoutingCenterDaily(options={}){
  if(!SCOUTING_CENTER_ENABLED || !game) return { reveals:0, costs:0 };
  const state = ensureScoutingCenterState();
  const today = game.currentDate || currentCalendarDate();
  const reason = String(options.reason || 'daily');
  if(state.lastDailyProcessDate === today) return { reveals:0, costs:0, skipped:true, date:today, reason };
  state.lastDailyProcessDate = today;
  let costs = 0;
  if(state.scouts > 0 && SCOUTING_SCOUT_DAILY_COST > 0){
    const cost = state.scouts * SCOUTING_SCOUT_DAILY_COST;
    recordBudgetChange(-cost, 'Pago diario de ojeadores', { type:'scouting_scout_daily', scouts:state.scouts });
    costs += cost;
  }
  // Reutilizar el mismo objeto persistente evita que una normalización secundaria
  // deje el progreso de búsqueda escrito sobre una referencia obsoleta.
  costs += processScoutingCenterMonthlyCosts(state);
  const searchResult = processScoutingPlayerSearchDaily(state, today, reason);
  costs += Number(searchResult.cost || 0);
  const attempts = Math.max(0, state.scouts) + scoutingChiefDailyReveals(state);
  const observed = attempts > 0 ? markScoutingDailyObservation(state, today) : 0;
  let reveals = 0;
  for(let i=0; i<attempts; i++){
    if(scoutingRevealOneSkill(i, reason)) reveals += 1;
  }
  game.lastScoutingDailyResult = { date:today, reason, attempts, reveals, observed, costs, searchResult };
  return { reveals, costs, attempts, observed, searchResult, date:today, reason };
}
function resetScoutingCenterForNewSeason(){
  if(!game) return;
  const state = ensureScoutingCenterState();
  state.chief = null;
  state.chiefLastChargeDate = null;
  resetScoutingPlayerSearchProgress(state.playerSearch, { disable:true });
  state.lastDailyProcessDate = null;
  game.scoutingCenter = state;
}
function resetScoutingCenterForNewClub(){
  if(!game) return;
  const previous = ensureScoutingCenterState();
  Object.keys(previous.reports || {}).forEach(id => stripScoutingSigningChanceFromReport(previous.reports[id]));
  // Cambiar de club vacía oficinas, jefe, ojeadores y lista activa, pero conserva los informes ya revelados.
  // La información ojeada es progreso del manager. Sólo se borra la probabilidad de fichaje porque depende del club actual.
  game.scoutingCenter = { ...createInitialScoutingCenterState(), reports: previous.reports || {}, teamReports: previous.teamReports || {} };
}

const SCOUTING_SVG_ICONS = new Set(['binoculares','ojeador','oficina','informe','radar']);
function scoutingSvgIcon(name='binoculares', extraClass=''){
  const safeName = SCOUTING_SVG_ICONS.has(String(name)) ? String(name) : 'binoculares';
  const safeClass = String(extraClass || '').replace(/[^a-z0-9_-]/gi, '');
  return `<img class="scouting-svg-icon ${safeClass}" src="assets/icons/scouting/${safeName}.svg?v=8.73" alt="" aria-hidden="true" loading="lazy">`;
}
function scoutingRepeatedIcons(icon, active=0, total=null, className=''){
  const safeActive = Math.max(0, Math.round(Number(active || 0)));
  const safeTotal = total === null ? safeActive : Math.max(0, Math.round(Number(total || 0)));
  const limit = Math.min(Math.max(safeTotal, safeActive), 24);
  const items = [];
  for(let i=0; i<limit; i++){
    const filled = i < safeActive;
    items.push(`<span class="${filled ? 'filled' : 'empty'}" aria-hidden="true">${icon}</span>`);
  }
  if(Math.max(safeTotal, safeActive) > limit) items.push(`<span class="more">+${Math.max(safeTotal, safeActive) - limit}</span>`);
  return `<div class="scouting-icon-stack ${className}">${items.join('')}</div>`;
}
function scoutingBinocularsIcon(extraClass=''){
  return scoutingSvgIcon('binoculares', extraClass);
}
function scoutingSummaryTile({ label, value, hint='', icon='', extra='' }){
  return `<div class="card scouting-summary-tile ${extra}">
    <div class="scouting-summary-icon">${icon}</div>
    <div><p class="label">${escapeHtml(label)}</p><strong>${value}</strong>${hint ? `<small class="muted">${hint}</small>` : ''}</div>
  </div>`;
}

function scoutingPlayerAggregateMetrics(player, knownOverride=null){
  if(!player) return { complete:false, knownSkills:0, totalSkills:0, average:null, total:null, maxTotal:0 };
  const map = scoutingVisibleStatMap(player);
  const keys = Object.keys(map || {});
  const knownSet = knownOverride && typeof knownOverride.has === 'function' ? knownOverride : scoutingKnownSet(player.id);
  const ownPlayer = scoutingIsOwnPlayer(player);
  const knownSkills = ownPlayer ? keys.length : keys.filter(key => knownSet.has(key)).length;
  const values = keys.map(key => Number(map[key])).filter(Number.isFinite);
  const complete = keys.length > 0 && values.length === keys.length && (ownPlayer || knownSkills === keys.length);
  const total = complete ? Math.round(values.reduce((sum, value) => sum + value, 0)) : null;
  const average = complete ? clamp(Math.round(total / values.length), 1, 99) : null;
  return {
    complete,
    knownSkills,
    totalSkills:keys.length,
    average,
    total,
    maxTotal:keys.length * 99
  };
}
function scoutingFormatInteger(value){
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? Math.round(numeric).toLocaleString('es-AR') : '—';
}
function scoutingPlayerAggregateMarkup(player){
  const metrics = scoutingPlayerAggregateMetrics(player);
  const remaining = Math.max(0, metrics.totalSkills - metrics.knownSkills);
  const pendingHint = metrics.totalSkills
    ? `${metrics.knownSkills}/${metrics.totalSkills} habilidades conocidas${remaining ? ` · faltan ${remaining}` : ''}`
    : 'Sin habilidades disponibles';
  return `<div class="scouting-player-aggregate-grid ${metrics.complete ? 'is-complete' : 'is-pending'}">
    <div class="scouting-player-aggregate-card">
      <span>Media general</span>
      <strong>${metrics.complete ? scoutingFormatInteger(metrics.average) : '—'}</strong>
      <small>${metrics.complete ? `Promedio de ${metrics.totalSkills} habilidades` : pendingHint}</small>
    </div>
    <div class="scouting-player-aggregate-card">
      <span>Puntaje total</span>
      <strong>${metrics.complete ? scoutingFormatInteger(metrics.total) : '—'}</strong>
      <small>${metrics.complete ? `Suma de habilidades · máximo ${scoutingFormatInteger(metrics.maxTotal)}` : pendingHint}</small>
    </div>
  </div>`;
}
function scoutingPlayerSkillValueMarkup(player, key, value, known){
  if(!known) return '—';
  if(key === SCOUTING_SIGNING_CHANCE_KEY) return scoutingSigningChanceLabel(player);
  return escapeHtml(String(value ?? '—'));
}
function scoutingPlayerSkillRows(player, map){
  const known = scoutingKnownSet(player.id);
  return Object.entries(map || {}).map(([key,value]) => {
    const label = typeof scoutingSkillDisplayLabel === 'function' ? scoutingSkillDisplayLabel(player, key) : key;
    return `<div class="stat-rank"><span>${escapeHtml(label)}</span><strong>${scoutingPlayerSkillValueMarkup(player, key, value, known.has(key))}</strong></div>`;
  }).join('');
}
function scoutingSkillGroupMarkup(player, label, map, className, knownSet){
  const keys = Object.keys(map || {});
  const knownCount = keys.filter(key => knownSet.has(key)).length;
  return `<section class="scouting-known-section scouting-skill-group ${className}">
    <div class="scouting-skill-group-head">
      <p class="label">${escapeHtml(label)}</p>
      <span class="scouting-skill-count">${knownCount}/${keys.length}</span>
    </div>
    <div class="scouting-known-grid">${scoutingPlayerSkillRows(player, map)}</div>
  </section>`;
}
function scoutingPlayerKnownSkillRows(player){
  const knownSet = scoutingKnownSet(player.id);
  const visibleGroups = scoutingDetailedSkillGroups(player);
  const visibleSections = visibleGroups.map(group => scoutingSkillGroupMarkup(
    player,
    group.label,
    group.map,
    `scouting-skill-group-${escapeHtml(group.key)}`,
    knownSet
  )).join('');
  const hiddenMap = scoutingHiddenStatMap(player);
  const signingMap = scoutingSigningChanceMap(player);
  const signingKeys = Object.keys(signingMap);
  const hiddenSection = scoutingSkillGroupMarkup(player, 'Habilidades ocultas', hiddenMap, 'scouting-hidden-section', knownSet);
  const signingSection = signingKeys.length
    ? scoutingSkillGroupMarkup(player, 'Mercado', signingMap, 'scouting-market-section', knownSet)
    : '';
  return `<div class="scouting-skill-groups ${signingKeys.length ? 'has-market' : 'no-market'}">${visibleSections}${hiddenSection}${signingSection}</div>`;
}
function scoutingPlayerSigningChanceTone(chance){
  const value = Number(chance || 0);
  if(value >= 65) return 'ok';
  if(value >= 30) return 'warn';
  return 'bad';
}
function scoutingPlayerSigningChanceMarkup(player){
  if(!player || scoutingIsOwnPlayer(player)){
    return `<div class="scouting-signing-chance own"><span>Prob. fichaje</span><strong>—</strong><small>Jugador propio</small></div>`;
  }
  if(!playerHasScoutedSigningChance(player)){
    return `<div class="scouting-signing-chance hidden"><span>Prob. fichaje</span><strong>—</strong><small>Dato pendiente de ojeo</small></div>`;
  }
  const chance = scoutingSigningChanceValue(player);
  const tone = scoutingPlayerSigningChanceTone(chance);
  return `<div class="scouting-signing-chance ${tone}"><span>Prob. fichaje</span><strong>${scoutingSigningChanceLabel(player)}</strong><small>Revelado por ojeo</small></div>`;
}
function scoutingPlayerMarketActionMarkup(player){
  if(!player || scoutingIsOwnPlayer(player)) return '';
  const clubId = Number(player.clubId || 0);
  if(clubId > 0){
    const blocked = typeof isPurchaseOfferBlockedThisSeason === 'function' && isPurchaseOfferBlockedThisSeason(player.id);
    const label = blocked && typeof purchaseOfferBlockedLabel === 'function'
      ? purchaseOfferBlockedLabel(player.id)
      : (blocked ? 'Rechazada hasta próxima temp.' : 'Hacer oferta');
    const clauseValue = Math.max(0, Number(player.clause || player.value || 0));
    return `<div class="scouting-player-market-action">
      <div class="scouting-player-clause"><span>Valor de cláusula</span><strong>${formatMoney(clauseValue)}</strong></div>
      <button class="primary small-btn" data-scouting-make-player-offer="${player.id}" ${blocked ? 'disabled' : ''}>${escapeHtml(label)}</button>
    </div>`;
  }
  return '';
}
function scoutingPlayerCard(player){
  const report = scoutingReportForPlayer(player.id);
  const state = ensureScoutingCenterState();
  const foundBySearch = (state.playerSearch?.foundPlayerIds || []).map(Number).includes(Number(player.id));
  const known = scoutingKnownCount(player.id);
  const total = scoutingSkillKeys(player).length || 1;
  const hiddenTotal = Object.keys(scoutingHiddenStatMap(player)).length;
  const hiddenKnown = Object.keys(scoutingHiddenStatMap(player)).filter(key => scoutingKnownSet(player.id).has(key)).length;
  const pct = clamp(Math.round((known / total) * 100), 0, 100);
  const ownPill = scoutingIsOwnPlayer(player) ? '<span class="pill ok">Propio · ocultas primero</span>' : '<span class="pill">Externo</span>';
  const searchPill = foundBySearch ? '<span class="pill scouting-search-result-pill">Encontrado por búsqueda</span>' : '';
  return `<div class="scouting-player-card card inner ${foundBySearch ? 'scouting-search-result' : ''}">
    <div class="scouting-player-head">
      ${faceImg(player, 'scouting-player-face')}
      <div><h3>${typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player.name)}</h3><p class="muted small">${escapeHtml(clubName(player.clubId))} · ${escapeHtml(player.nationality || '—')} · ${escapeHtml(player.position || '')} · ${Math.max(0, Math.round(Number(player.age || 0)))} años</p><div class="scouting-player-pills">${ownPill}${searchPill}</div></div>
      <button class="ghost small-btn" data-remove-scouting-player="${player.id}">Quitar</button>
    </div>
    <div class="project-progress scouting-report-progress"><span style="width:${pct}%"></span></div>
    <div class="scouting-player-meta-row">
      <p class="muted small">Habilidades conocidas: ${known}/${total} · Ocultas reveladas: ${hiddenKnown}/${hiddenTotal} · Días observado: ${Number(report.daysObserved || 0)}</p>
      ${scoutingPlayerSigningChanceMarkup(player)}
    </div>
    ${scoutingPlayerAggregateMarkup(player)}
    ${scoutingPlayerKnownSkillRows(player)}
    ${scoutingPlayerMarketActionMarkup(player)}
  </div>`;
}

function scoutingPlayerReportEntries(mode='all'){
  const state = ensureScoutingCenterState();
  const activeIds = new Set((state.listedPlayerIds || []).map(Number));
  const reports = state.reports && typeof state.reports === 'object' && !Array.isArray(state.reports) ? state.reports : {};
  return Object.keys(reports).map(id => {
    const player = typeof playerById === 'function' ? playerById(Number(id)) : null;
    if(!player) return null;
    const report = normalizeScoutingReport(Number(id), reports[id]);
    const active = activeIds.has(Number(id));
    if(mode === 'archived' && active) return null;
    if(mode === 'active' && !active) return null;
    return { player, report, active };
  }).filter(Boolean).sort((a,b) => {
    if(Number(b.active) !== Number(a.active)) return Number(b.active) - Number(a.active);
    return String(a.player.name || '').localeCompare(String(b.player.name || ''), 'es');
  });
}
function scoutingPlayerReportListRow(entry){
  const player = entry.player;
  const report = entry.report || {};
  const known = Array.isArray(report.visibleSkills) ? report.visibleSkills.length : 0;
  const total = scoutingSkillKeys(player).length || 1;
  const hiddenMap = scoutingHiddenStatMap(player);
  const hiddenKnown = Object.keys(hiddenMap).filter(key => (report.visibleSkills || []).includes(key)).length;
  const hiddenTotal = Object.keys(hiddenMap).length;
  const signingText = playerHasScoutedSigningChance(player) ? scoutingSigningChanceLabel(player) : '<span class="muted">Oculto</span>';
  const metrics = scoutingPlayerAggregateMetrics(player, new Set(report.visibleSkills || []));
  const averageText = metrics.complete ? scoutingFormatInteger(metrics.average) : '<span class="muted">—</span>';
  const totalText = metrics.complete ? scoutingFormatInteger(metrics.total) : '<span class="muted">—</span>';
  const status = entry.active ? '<span class="pill ok">Activo</span>' : '<span class="pill">Archivado</span>';
  return `<tr>
    <td><button class="linklike" data-scouting-report-player="${player.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player.name)}</strong></button></td>
    <td>${roleBadge(player.position)}</td>
    <td>${Math.max(0, Math.round(Number(player.age || 0)))}</td>
    <td>${escapeHtml(clubName(player.clubId))}</td>
    <td>${known}/${total}</td>
    <td>${hiddenKnown}/${hiddenTotal}</td>
    <td>${averageText}</td>
    <td>${totalText}</td>
    <td>${signingText}</td>
    <td>${Number(report.daysObserved || 0)}</td>
    <td>${status}</td>
  </tr>`;
}
function scoutingReportsModalMarkup(mode='all'){
  const title = mode === 'archived' ? 'Informes archivados' : 'Informes guardados';
  const entries = scoutingPlayerReportEntries(mode);
  const rows = entries.map(scoutingPlayerReportListRow).join('');
  const empty = mode === 'archived'
    ? 'No hay informes archivados de jugadores. Quitá un jugador de la lista activa para archivar su informe.'
    : 'Todavía no hay informes guardados de jugadores.';
  return `<div class="scouting-reports-modal">
    <div class="scouting-reports-head"><p class="label">Centro de Ojeo</p><h2>${escapeHtml(title)}</h2></div>
    <p class="muted small">Sólo se listan jugadores. Los informes de equipo son dinámicos y no se archivan.</p>
    <div class="table-wrap scouting-reports-table-wrap"><table class="scouting-reports-table"><thead><tr><th>Jugador</th><th>Rol</th><th>Edad</th><th>Club</th><th>Conocidas</th><th>Ocultas</th><th>Media general</th><th>Puntaje total</th><th>Prob. fichaje</th><th>Días</th><th>Estado</th></tr></thead><tbody>${rows || `<tr><td colspan="11" class="muted">${escapeHtml(empty)}</td></tr>`}</tbody></table></div>
  </div>`;
}
function openScoutingReportsModal(mode='all'){
  if(typeof openModal !== 'function') return;
  openModal(scoutingReportsModalMarkup(mode));
  document.querySelectorAll('[data-scouting-report-player]').forEach(btn => btn.addEventListener('click', ev => {
    ev.stopPropagation();
    const playerId = Number(ev.currentTarget.dataset.scoutingReportPlayer || 0);
    if(playerId && typeof showPlayerModal === 'function') showPlayerModal(playerId);
  }));
}
function scoutingReportsControlMarkup(){
  const state = ensureScoutingCenterState();
  const totalPlayerReports = scoutingPlayerReportEntries('all').length;
  const teamReports = Object.keys(state.teamReports || {}).length;
  return `<div class="card scouting-reports-card scouting-control-card">
    <div class="scouting-card-head"><div class="scouting-card-icon">${scoutingSvgIcon('informe', 'small')}</div><div><p class="label">Informes</p><h3>Guardados y archivados</h3></div><span class="pill">${totalPlayerReports}</span></div>
    <p class="muted small">Abrí jugadores ya ojeados en lista. Los equipos no se archivan; sus visores se actualizan con el plantel actual.</p>
    <div class="scouting-action-grid"><button class="ghost" data-open-scouting-reports="all">Informes guardados</button><button class="ghost" data-open-scouting-reports="archived">Archivados</button></div>
    ${teamReports ? `<p class="muted small">Informes dinámicos de equipo activos/guardados: ${teamReports}</p>` : ''}
  </div>`;
}
function scoutingChiefMarkup(){
  const state = ensureScoutingCenterState();
  if(state.chief){
    const type = scoutingChiefType(state.chief.type);
    return `<div class="card scouting-chief-card scouting-control-card">
      <div class="scouting-card-head">
        <div class="scouting-card-icon">${scoutingBinocularsIcon('small')}</div>
        <div><p class="label">Jefe de ojeadores</p><h3>${escapeHtml(type?.name || state.chief.type)}</h3></div>
        <span class="pill ok">Activo</span>
      </div>
      <p class="muted small">Sueldo mensual ${formatMoney(type?.monthlySalary || 0)} · controla hasta ${type?.maxOffices || 0} oficina(s) · se va al finalizar la temporada.</p>
      <button class="ghost danger small-btn" data-dismiss-scouting-chief ${state.offices > 0 || state.scouts > 0 ? 'disabled title="Primero cancelá todas las oficinas y despedí a todos los ojeadores"' : ''}>Despedir jefe</button>
      ${state.offices > 0 || state.scouts > 0 ? `<p class="muted small bad">Para despedirlo necesitás 0 oficinas y 0 ojeadores contratados.</p>` : '<p class="muted small">Puede despedirse ahora. El mes pagado no se reintegra.</p>'}
    </div>`;
  }
  const cards = (SCOUTING_CHIEF_TYPES || []).map(type => {
    const unlock = typeof staffCategoryUnlockInfo === 'function' ? staffCategoryUnlockInfo(type.key) : { unlocked:true, requiredWins:0, remaining:0 };
    const lockText = unlock.unlocked ? '' : `<p class="muted small bad">Bloqueado: requiere ${unlock.requiredWins} victorias con el club fundador (${unlock.remaining} restantes).</p>`;
    return `<div class="card inner scouting-chief-option ${unlock.unlocked ? '' : 'disabled'}">
      <div class="scouting-chief-option-head"><strong>${escapeHtml(type.name)}</strong><span>${type.maxOffices} ${scoutingSvgIcon('oficina', 'inline')}</span></div>
      <p class="muted small">${formatMoney(type.monthlySalary)} por mes · revela ${type.revealMin}-${type.revealMax} habilidad(es)/día.</p>
      ${lockText}
      <button class="primary small-btn" data-hire-scouting-chief="${escapeHtml(type.key)}" ${unlock.unlocked ? '' : 'disabled'}>${unlock.unlocked ? 'Contratar' : 'Bloqueado'}</button>
    </div>`;
  }).join('');
  return `<div class="card scouting-chief-card scouting-control-card">
    <div class="scouting-card-head">
      <div class="scouting-card-icon">${scoutingBinocularsIcon('small')}</div>
      <div><p class="label">Empleado contratable</p><h3>Jefe de ojeadores</h3></div>
    </div>
    <p class="muted small">Puede despedirse cuando no haya oficinas alquiladas ni ojeadores contratados. El mes pagado no se reintegra.</p>
    <div class="scouting-chief-options">${cards}</div>
  </div>`;
}
function renderScoutingCenter(){
  if(!SCOUTING_CENTER_ENABLED){ view.innerHTML = '<div class="card"><h2>Centro de Ojeo</h2><p class="muted">El Centro de Ojeo está desactivado en config.js.</p></div>'; return; }
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  const maxOffices = scoutingChiefMaxOffices(state);
  const listed = state.listedPlayerIds.map(playerById).filter(Boolean);
  const listedTeams = (state.listedTeamIds || []).map(id => seed?.clubs?.find(c => Number(c.id) === Number(id))).filter(Boolean);
  const usedSlots = listed.length + listedTeams.length;
  const archivedReports = Object.keys(state.reports || {}).filter(id => !state.listedPlayerIds.map(Number).includes(Number(id))).length;
  const reportCount = Object.keys(state.reports || {}).length;
  const lastProcess = game?.lastScoutingDailyResult;
  const lastProcessText = lastProcess?.date ? `Último proceso: ${escapeHtml(lastProcess.date)} · intentos ${Number(lastProcess.attempts || 0)} · reveladas ${Number(lastProcess.reveals || 0)}` : 'Todavía no se procesó ningún día de ojeo.';
  const officeCost = state.offices > 0 ? `${formatMoney(SCOUTING_OFFICE_MONTHLY_COST)}/mes` : 'Sin alquileres activos';
  const scoutCost = state.scouts > 0 ? `${formatMoney(state.scouts * SCOUTING_SCOUT_DAILY_COST)}/día` : 'Sin ojeadores activos';
  view.innerHTML = `
    <div class="scouting-shell">
      <div class="card scouting-hero">
        <div class="scouting-hero-icon">${scoutingBinocularsIcon()}</div>
        <div>
          <p class="eyebrow">Departamento deportivo</p>
          <h2>Centro de Ojeo</h2>
          <p class="tagline">Agregá jugadores externos o propios desde su ficha individual. En jugadores propios las habilidades visibles ya están desbloqueadas y el ojeo avanza directo sobre las ocultas.</p>
        </div>
      </div>
      <div class="scouting-summary-grid">
        ${scoutingSummaryTile({ label:'Ojeo activo', value:`${usedSlots}/${caps.playerCapacity}`, hint:`${listed.length} jugador(es) · ${listedTeams.length} equipo(s)`, icon:scoutingBinocularsIcon('mini') })}
        ${scoutingSummaryTile({ label:'Ojeadores', value:`${state.scouts}/${caps.scoutCapacity}`, hint:scoutCost, icon:scoutingSvgIcon('ojeador', 'mini') })}
        ${scoutingSummaryTile({ label:'Oficinas', value:`${state.offices}/${maxOffices}`, hint:officeCost, icon:scoutingSvgIcon('oficina', 'mini') })}
        ${scoutingSummaryTile({ label:'Informes guardados', value:reportCount, hint:`${archivedReports} jugador(es) archivado(s)`, icon:scoutingSvgIcon('informe', 'mini') })}
      </div>
      <div class="scouting-workspace">
        <div class="scouting-main-stack">
          ${scoutingPlayerSearchMarkup(state)}
          <div class="card scouting-list-card">
            <div class="scouting-card-head">
              <div><p class="label">Lista activa</p><h3>Jugadores y equipos en seguimiento</h3></div>
              <span class="pill">${usedSlots}/${caps.playerCapacity}</span>
            </div>
            <p class="muted small">Los datos conocidos quedan guardados aunque quites al jugador o equipo de la lista activa. Los informes de equipo muestran visores dinámicos del plantel actual.</p>
            <div class="scouting-player-list">${usedSlots ? listed.map(scoutingPlayerCard).join('') + listedTeams.map(club => scoutingTeamCard(club.id)).join('') : '<div class="scouting-empty-list"><div class="scouting-empty-icon">' + scoutingBinocularsIcon('empty') + '</div><p class="muted">Todavía no agregaste jugadores ni equipos. Abrí una ficha y usá “Ojear”.</p></div>'}</div>
          </div>
        </div>
        <aside class="scouting-side-rail">
          ${scoutingChiefMarkup()}
          <div class="card scouting-office-card scouting-control-card">
            <div class="scouting-card-head">
              <div class="scouting-card-icon">${scoutingSvgIcon('oficina', 'small')}</div>
              <div><p class="label">Infraestructura</p><h3>Oficinas</h3></div>
              <span class="pill">${state.offices}/${maxOffices}</span>
            </div>
            <p class="muted small">Base: ${SCOUTING_BASE_SCOUTS} ojeadores y ${SCOUTING_BASE_PLAYER_SLOTS} jugadores listados. Cada oficina agrega ${SCOUTING_SCOUTS_PER_OFFICE} ojeadores y ${SCOUTING_PLAYERS_PER_OFFICE} jugadores listados.${maxOffices <= 0 ? ' Contratá primero un jefe de ojeadores para habilitar el alquiler.' : ''}</p>
            <div class="scouting-action-grid"><button class="primary" data-rent-scouting-office ${maxOffices > 0 && state.offices >= maxOffices ? 'disabled' : ''} ${maxOffices <= 0 ? 'title="Requiere un jefe de ojeadores"' : ''}>${maxOffices <= 0 ? 'Requiere jefe' : 'Alquilar oficina'}</button><button class="ghost" data-cancel-scouting-office ${state.offices <= 0 ? 'disabled' : ''}>Cancelar oficina</button></div>
          </div>
          <div class="card scouting-office-card scouting-control-card">
            <div class="scouting-card-head">
              <div class="scouting-card-icon">${scoutingSvgIcon('ojeador', 'small')}</div>
              <div><p class="label">Personal</p><h3>Ojeadores</h3></div>
              <span class="pill">${state.scouts}/${caps.scoutCapacity}</span>
            </div>
            <div class="scouting-asset-strip"><span>Equipo activo</span>${scoutingRepeatedIcons(scoutingSvgIcon('ojeador', 'stack'), state.scouts, caps.scoutCapacity, 'person-icons')}</div>
            <p class="muted small">Ojeador: ${formatMoney(SCOUTING_SCOUT_DAILY_COST)}/día. Costo actual: <strong class="bad">${formatMoney(state.scouts * SCOUTING_SCOUT_DAILY_COST)}</strong>.</p>
            <div class="scouting-action-grid"><button class="primary" data-hire-scouting-scout ${state.scouts >= caps.scoutCapacity ? 'disabled' : ''}>Contratar ojeador</button><button class="ghost danger" data-dismiss-scouting-scout ${state.scouts <= 0 ? 'disabled' : ''}>Despedir ojeador</button></div>
          </div>
          ${scoutingReportsControlMarkup()}
          <div class="card scouting-process-card scouting-control-card">
            <div class="scouting-card-head"><div><p class="label">Actividad diaria</p><h3>Proceso de ojeo</h3></div></div>
            <p class="muted small">${lastProcessText}</p>
          </div>
        </aside>
      </div>
    </div>`;
  document.querySelectorAll('[data-hire-scouting-chief]').forEach(btn => btn.addEventListener('click', () => hireScoutingChief(btn.dataset.hireScoutingChief)));
  document.querySelector('[data-dismiss-scouting-chief]')?.addEventListener('click', dismissScoutingChief);
  document.querySelector('[data-rent-scouting-office]')?.addEventListener('click', rentScoutingOffice);
  document.querySelector('[data-cancel-scouting-office]')?.addEventListener('click', cancelScoutingOffice);
  document.querySelector('[data-hire-scouting-scout]')?.addEventListener('click', hireScoutingScout);
  document.querySelector('[data-dismiss-scouting-scout]')?.addEventListener('click', dismissScoutingScout);
  document.querySelector('[data-toggle-scouting-player-search]')?.addEventListener('click', toggleScoutingPlayerSearch);
  document.querySelector('[data-scouting-search-role]')?.addEventListener('change', event => updateScoutingPlayerSearchCriteria('role', event.target.value));
  document.querySelector('[data-scouting-search-chance]')?.addEventListener('change', event => updateScoutingPlayerSearchCriteria('signingChance', event.target.value));
  document.querySelector('[data-scouting-search-age-min]')?.addEventListener('change', event => updateScoutingPlayerSearchCriteria('ageMin', event.target.value));
  document.querySelector('[data-scouting-search-age-max]')?.addEventListener('change', event => updateScoutingPlayerSearchCriteria('ageMax', event.target.value));
  document.querySelector('[data-scouting-search-salary-min]')?.addEventListener('change', event => updateScoutingPlayerSearchCriteria('salaryMin', event.target.value));
  document.querySelector('[data-scouting-search-salary-max]')?.addEventListener('change', event => updateScoutingPlayerSearchCriteria('salaryMax', event.target.value));
  document.querySelectorAll('[data-open-scouting-reports]').forEach(btn => btn.addEventListener('click', () => openScoutingReportsModal(btn.dataset.openScoutingReports || 'all')));
  document.querySelectorAll('[data-remove-scouting-player]').forEach(btn => btn.addEventListener('click', () => removePlayerFromScoutingCenter(Number(btn.dataset.removeScoutingPlayer || 0))));
  document.querySelectorAll('[data-scouting-make-player-offer]').forEach(btn => btn.addEventListener('click', () => {
    const playerId = Number(btn.dataset.scoutingMakePlayerOffer || 0);
    if(playerId && typeof openPurchaseOfferModal === 'function') openPurchaseOfferModal(playerId);
  }));
  document.querySelectorAll('[data-remove-scouting-team]').forEach(btn => btn.addEventListener('click', () => removeTeamFromScoutingCenter(Number(btn.dataset.removeScoutingTeam || 0))));
}
