/* Carga de JSON, calendario anual, hinchadas, estadios, persistencia local e inicialización optimizada. */

function versionedDataRequestUrl(url){
  const clean = String(url || '').trim();
  if(!clean || !/^data\//i.test(clean) || /[?&]v=/i.test(clean)) return clean;
  const version = String(window.GAME_CONFIG?.version || 'V8.57').replace(/^v/i, '');
  return `${clean}${clean.includes('?') ? '&' : '?'}v=${encodeURIComponent(version)}`;
}
async function fetchJsonIfExists(url){
  try{
    const res = await fetch(versionedDataRequestUrl(url), { cache:DATA_CACHE_MODE });
    if(!res.ok) return null;
    return await res.json();
  }catch(error){
    console.warn(`No se pudo cargar ${url}`, error);
    return null;
  }
}

function playersPayloadArray(raw){
  if(Array.isArray(raw)) return raw;
  if(Array.isArray(raw?.players)) return raw.players;
  if(Array.isArray(raw?.jugadores)) return raw.jugadores;
  return [];
}
function playersManifestFiles(raw){
  if(!raw || typeof raw !== 'object') return [];
  const files = Array.isArray(raw.files) ? raw.files : (Array.isArray(raw.playerFiles) ? raw.playerFiles : (Array.isArray(raw.jugadoresFiles) ? raw.jugadoresFiles : []));
  return files
    .map(item => typeof item === 'string' ? item : (item?.path || item?.url || item?.file || ''))
    .map(item => String(item || '').trim())
    .filter(Boolean);
}
function resolveDataUrl(baseUrl='', childUrl=''){
  const child = String(childUrl || '').trim();
  if(!child) return '';
  if(/^https?:\/\//i.test(child) || child.startsWith('/') || child.startsWith('data/')) return child;
  const base = String(baseUrl || '');
  const slash = base.lastIndexOf('/');
  return slash >= 0 ? `${base.slice(0, slash + 1)}${child}` : child;
}
async function loadPlayersDatabaseFile(url, visited=new Set()){
  const cleanUrl = String(url || '').trim();
  if(!cleanUrl || visited.has(cleanUrl)) return null;
  visited.add(cleanUrl);
  const raw = await fetchJsonIfExists(cleanUrl);
  if(!raw) return null;
  const directPlayers = playersPayloadArray(raw);
  if(directPlayers.length) return { raw, players:directPlayers, source:cleanUrl };
  const files = playersManifestFiles(raw);
  if(!files.length) return null;
  const loaded = await Promise.all(files.map(file => loadPlayersDatabaseFile(resolveDataUrl(cleanUrl, file), visited)));
  const valid = loaded.filter(item => item?.players?.length);
  if(!valid.length) return null;
  return {
    raw,
    players:valid.flatMap(item => item.players),
    source:valid.map(item => item.source).join(', ')
  };
}
async function loadPlayersDatabase(){
  const urls = PLAYERS_DATABASE_URLS.length ? PLAYERS_DATABASE_URLS : [PLAYERS_DATABASE_URL];
  const loaded = await Promise.all(urls.map(url => loadPlayersDatabaseFile(url)));
  const valid = loaded.filter(item => item?.players?.length);
  if(!valid.length) return null;
  const players = valid.flatMap(item => item.players);
  return {
    raw:{
      metadata:{ version:GAME_CONFIG.version || 'V6', splitFiles:valid.length },
      validation:databaseValidationCounts(players)
    },
    players,
    source:valid.map(item => item.source).join(', ')
  };
}


async function loadManualPlayersDatabase(){
  const raw = await fetchJsonIfExists(MANUAL_PLAYERS_DATABASE_URL);
  if(!raw || typeof raw !== 'object') return null;
  const players = Array.isArray(raw.jugadores) ? raw.jugadores : (Array.isArray(raw.players) ? raw.players : []);
  if(!players.length || raw?.uso?.cargaAutomatica === false) return null;
  return { raw, players, source:MANUAL_PLAYERS_DATABASE_URL };
}
function manualValue(value, fallback=50, min=1, max=99){
  const raw = Number(value);
  const clean = Number.isFinite(raw) ? raw : Number(fallback);
  return clamp(Math.round(clean), min, max);
}
function manualSkill(manualSkills, key, fallback=50, min=1, max=99){
  if(!manualSkills || typeof manualSkills !== 'object') return manualValue(fallback, fallback, min, max);
  return manualValue(manualSkills[key], fallback, min, max);
}
function resolveManualClubId(seedData, player){
  const direct = Number(player?.clubId || 0);
  const validIds = new Set((seedData?.clubs || []).map(club => Number(club.id)));
  if(direct && validIds.has(direct)) return direct;
  const teamName = player?.equipo || player?.club || player?.clubName || player?.teamName || '';
  const teamKey = lookupNameKey(teamName);
  if(!teamKey) return 0;
  const club = (seedData?.clubs || []).find(item => lookupNameKey(item?.name || item?.nombre || '') === teamKey);
  return club ? Number(club.id || 0) : 0;
}
function manualVisibleSkillsToInternal(position, manualSkills={}, media=50){
  const base = manualValue(media, 50, 1, 99);
  const ataque = manualSkill(manualSkills, 'ataque', base);
  const defensa = manualSkill(manualSkills, 'defensa', base);
  const tiro = manualSkill(manualSkills, 'tiro', base);
  const pase = manualSkill(manualSkills, 'pase', base);
  const velocidad = manualSkill(manualSkills, 'velocidad', base);
  const cabezazo = manualSkill(manualSkills, 'cabezazo', base);
  const resistencia = manualSkill(manualSkills, 'resistencia', base);
  const liderazgo = manualSkill(manualSkills, 'liderazgo', base);
  const disciplina = manualSkill(manualSkills, 'disciplina', base);
  const trabajoEquipo = manualSkill(manualSkills, 'trabajoEquipo', base);
  const potencial = manualSkill(manualSkills, 'potencial', base);
  const serenidad = manualValue(Math.round((disciplina + liderazgo + base) / 3), base);
  const pos = normalizePlayerPosition(position, 0);
  const skills = {
    porteria: pos === 'POR' ? defensa : 1,
    entradas:defensa,
    marca:defensa,
    posicionamiento:manualValue(Math.round((ataque + defensa) / 2), base),
    paseCorto:pase,
    paseLargo:pase,
    vision:pase,
    regate:ataque,
    tecnica:manualValue(Math.round((ataque + pase) / 2), base),
    remate:tiro,
    cabezazo,
    velocidad,
    aceleracion:velocidad,
    fuerza:manualValue(Math.round((cabezazo + resistencia + base) / 3), base),
    resistencia,
    trabajoEquipo,
    serenidad,
    disciplina,
    liderazgo,
    potencial,
    agresividad:manualSkill(manualSkills, 'agresividad', Math.max(1, 100 - disciplina)),
    genetica:manualSkill(manualSkills, 'genetica', base),
    factorSorpresa:manualSkill(manualSkills, 'factorSorpresa', 0, 0, 20)
  };
  if(pos === 'POR'){
    skills.cabezazo = manualValue(Math.round((ataque + cabezazo) / 2), base);
    skills.fuerza = manualValue(Math.round((ataque + tiro) / 2), base);
    skills.porteria = manualValue(Math.round((defensa + velocidad) / 2), base);
    skills.posicionamiento = defensa;
    skills.paseCorto = pase;
    skills.paseLargo = manualValue(Math.round((pase + tiro) / 2), base);
    skills.vision = pase;
    skills.velocidad = velocidad;
    skills.aceleracion = velocidad;
    skills.serenidad = manualValue(Math.round((velocidad + liderazgo + disciplina) / 3), base);
    skills.liderazgo = manualValue(Math.round((cabezazo + liderazgo) / 2), base);
    skills.trabajoEquipo = manualValue(Math.round((cabezazo + trabajoEquipo) / 2), base);
    skills.remate = 1;
    skills.regate = 1;
    skills.tecnica = pase;
    skills.marca = defensa;
    skills.entradas = defensa;
  }
  return skills;
}
function normalizeManualDatabasePlayer(player, seedData){
  if(!player || typeof player !== 'object') return null;
  const id = Number(player.id || 0);
  if(!Number.isFinite(id) || id <= 0) return null;
  const position = normalizePlayerPosition(player.posicion || player.position, id);
  const clubId = resolveManualClubId(seedData, player);
  const freeAgent = Boolean(player.jugadorLibre || player.freeAgent || !clubId);
  const media = manualValue(player.media ?? player.overall, 50, 1, 99);
  const economy = player.economia && typeof player.economia === 'object' ? player.economia : {};
  const salary = Math.max(0, Math.round(Number(economy.sueldo ?? player.salary ?? 0)));
  const clause = Math.max(0, Math.round(Number(economy.clausula ?? player.clause ?? 0)));
  const value = Math.max(0, Math.round(Number(economy.valor ?? player.value ?? clause)));
  const mercado = player.mercado && typeof player.mercado === 'object' ? player.mercado : {};
  return {
    id,
    name:String(player.nombre || player.name || `Jugador Manual ${id}`).trim(),
    age:Math.max(15, Math.round(Number(player.edad ?? player.age ?? 18))),
    position,
    clubId:freeAgent ? 0 : clubId,
    freeAgent,
    nationality:String(player.nacionalidad || player.nationality || 'Argentina').trim(),
    overall:media,
    manualOverallLocked:true,
    skills:manualVisibleSkillsToInternal(position, player.habilidades || player.skills || {}, media),
    salary:salary || initialAnnualSalaryForMedia(media, 1),
    clause:clause || value || 0,
    value:value || clause || 0,
    fixedClause:Boolean(economy.clausulaBloqueada ?? player.clausulaBloqueada ?? player.fixedClause ?? true),
    manualFixedClause:Boolean(economy.clausulaBloqueada ?? player.clausulaBloqueada ?? player.manualFixedClause ?? true),
    economyLocked:Boolean(economy.clausulaBloqueada ?? player.economyLocked ?? true),
    transferListed:Boolean(mercado.transferible ?? player.transferListed ?? false),
    intransferible:Boolean(mercado.intransferible ?? player.intransferible ?? false),
    sold:Boolean(mercado.vendido ?? player.sold ?? false),
    retired:Boolean(mercado.retirado ?? player.retired ?? false),
    manualPlayer:true,
    manualRespawnAfterRetirement:Boolean(mercado.reapareceAlRetirarse ?? mercado.respawnAfterRetirement ?? player.reapareceAlRetirarse ?? player.manualRespawnAfterRetirement ?? false),
    generation:{ ...(player.origen || player.generation || {}), source:player?.origen?.source || MANUAL_PLAYERS_DATABASE_URL, rulesVersion:player?.origen?.rulesVersion || 'V8.08-manual-webp-retired-player-pool', tipo:player?.origen?.tipo || 'manual_activo' }
  };
}
function manualRetiredPlayerIdSet(options={}){
  const source = options.retiredManualPlayerIds || options.manualRetiredPlayerIds || game?.manualRetiredPlayerIds || game?.retiredManualPlayerIds || [];
  return new Set((Array.isArray(source) ? source : []).map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0));
}
function refreshExistingManualPlayerFromDatabase(existing, manual){
  if(!existing || !manual) return existing;
  const currentClubId = Number(existing.clubId || 0);
  const currentFreeAgent = Boolean(existing.freeAgent) || currentClubId === 0;
  const currentAge = Math.max(15, Math.round(Number(existing.age || manual.age || 20)));
  const currentSold = Boolean(existing.sold);
  const currentRetired = Boolean(existing.retired);
  const currentTransferListed = Boolean(existing.transferListed);
  const currentIntransferible = Boolean(existing.intransferible);
  const refreshed = {
    ...existing,
    name:String(manual.name || existing.name || '').trim() || existing.name,
    position:manual.position || existing.position,
    nationality:String(manual.nationality || existing.nationality || '').trim() || existing.nationality,
    manualPlayer:true,
    manualRespawnAfterRetirement:Boolean(manual.manualRespawnAfterRetirement),
    manualOverallLocked:Boolean(manual.manualOverallLocked ?? existing.manualOverallLocked ?? true),
    overall:Number.isFinite(Number(manual.overall)) ? Number(manual.overall) : existing.overall,
    skills:manual.skills && typeof manual.skills === 'object' ? { ...manual.skills } : existing.skills,
    salary:Number.isFinite(Number(manual.salary)) ? Number(manual.salary) : existing.salary,
    clause:Number.isFinite(Number(manual.clause)) ? Number(manual.clause) : existing.clause,
    value:Number.isFinite(Number(manual.value)) ? Number(manual.value) : existing.value,
    fixedClause:Boolean(manual.fixedClause ?? existing.fixedClause ?? true),
    manualFixedClause:Boolean(manual.manualFixedClause ?? existing.manualFixedClause ?? true),
    economyLocked:Boolean(manual.economyLocked ?? existing.economyLocked ?? true),
    generation:{ ...(existing.generation || {}), ...(manual.generation || {}), refreshedFromManualDatabase:true }
  };
  refreshed.clubId = currentClubId;
  refreshed.freeAgent = currentFreeAgent;
  refreshed.age = currentAge;
  refreshed.sold = currentSold;
  refreshed.retired = currentRetired;
  refreshed.transferListed = currentTransferListed;
  refreshed.intransferible = currentIntransferible;
  return normalizeDatabasePlayer(refreshed);
}
function manualDatabasePlayersById(seedData=seed){
  const map = new Map();
  if(!seedData || !manualPlayersDatabase?.players?.length) return map;
  manualPlayersDatabase.players.forEach(rawPlayer => {
    const manual = normalizeManualDatabasePlayer(rawPlayer, seedData);
    if(manual) map.set(Number(manual.id), manual);
  });
  return map;
}
function manualPlayerCanonicalSignature(player={}){
  const skills = player?.skills && typeof player.skills === 'object' && !Array.isArray(player.skills)
    ? Object.keys(player.skills).sort().map(key => `${key}:${Number(player.skills[key])}`).join('|')
    : '';
  return [
    String(player?.name || ''),
    String(player?.position || ''),
    String(player?.nationality || ''),
    Number(player?.overall || 0),
    skills,
    Number(player?.salary || 0),
    Number(player?.clause || 0),
    Number(player?.value || 0),
    Boolean(player?.manualPlayer),
    Boolean(player?.manualOverallLocked),
    Boolean(player?.manualFixedClause)
  ].join('::');
}
function refreshManualRecycledIdentity(player, manualById){
  if(!player || !manualById?.size || !player.manualIdentityRecycled) return player;
  const previousId = Number(player.previousPlayerId || player?.generation?.previousPlayerId || 0);
  const manual = manualById.get(previousId);
  if(!manual) return player;
  return {
    ...player,
    name:String(manual.name || player.name || '').trim() || player.name,
    position:manual.position || player.position,
    nationality:String(manual.nationality || player.nationality || '').trim() || player.nationality,
    generation:{ ...(player.generation || {}), manualIdentitySourceId:previousId, refreshedFromManualDatabase:true }
  };
}
function synchronizeManualPlayerReferences(state, seedData=seed, options={}){
  const manualById = manualDatabasePlayersById(seedData);
  if(!manualById.size) return { changed:false, seedChanged:0, marketChanged:0, retiredChanged:0, historyChanged:0 };
  let seedChanged = 0;
  let marketChanged = 0;
  let retiredChanged = 0;
  let historyChanged = 0;
  const refreshArray = (source=[], mode='seed') => {
    if(!Array.isArray(source)) return [];
    const out = [];
    const byId = new Map();
    source.forEach(rawPlayer => {
      if(!rawPlayer || typeof rawPlayer !== 'object') return;
      const id = Number(rawPlayer.id || 0);
      if(!Number.isFinite(id) || id <= 0) return;
      const manual = manualById.get(id);
      let next = manual ? refreshExistingManualPlayerFromDatabase(rawPlayer, manual) : refreshManualRecycledIdentity(rawPlayer, manualById);
      if(byId.has(id)){
        const index = byId.get(id);
        const merged = { ...out[index], ...next };
        next = manual ? refreshExistingManualPlayerFromDatabase(merged, manual) : refreshManualRecycledIdentity(merged, manualById);
        out[index] = next;
        if(mode === 'seed') seedChanged += 1;
        else marketChanged += 1;
        return;
      }
      byId.set(id, out.length);
      out.push(next);
      const before = manualPlayerCanonicalSignature(rawPlayer);
      const after = manualPlayerCanonicalSignature(next);
      if(before !== after){
        if(mode === 'seed') seedChanged += 1;
        else marketChanged += 1;
      }
    });
    return out;
  };
  if(seedData?.players){
    const previousLength = seedData.players.length;
    seedData.players = refreshArray(seedData.players, 'seed');
    if(seedData.players.length !== previousLength) seedChanged += Math.abs(previousLength - seedData.players.length);
  }
  if(state && typeof state === 'object'){
    if(Array.isArray(state.marketPlayers)){
      const previousLength = state.marketPlayers.length;
      state.marketPlayers = refreshArray(state.marketPlayers, 'market');
      if(state.marketPlayers.length !== previousLength) marketChanged += Math.abs(previousLength - state.marketPlayers.length);
    }
    if(Array.isArray(state.retiredPlayerPool)){
      state.retiredPlayerPool = state.retiredPlayerPool.map(entry => {
        if(!entry || typeof entry !== 'object' || !entry.manualIdentity) return entry;
        const manual = manualById.get(Number(entry.previousPlayerId || entry.id || 0));
        if(!manual) return entry;
        const next = {
          ...entry,
          name:String(manual.name || entry.name || '').trim() || entry.name,
          position:manual.position || entry.position,
          nationality:String(manual.nationality || entry.nationality || '').trim() || entry.nationality
        };
        if(String(entry.name || '') !== String(next.name || '') || String(entry.position || '') !== String(next.position || '') || String(entry.nationality || '') !== String(next.nationality || '')) retiredChanged += 1;
        return next;
      });
    }
    const seasons = state?.managerPlayerStatsHistory?.seasons;
    if(seasons && typeof seasons === 'object' && !Array.isArray(seasons)){
      Object.values(seasons).forEach(season => {
        Object.values(season?.clubs || {}).forEach(club => {
          Object.values(club?.players || {}).forEach(entry => {
            const manual = manualById.get(Number(entry?.playerId || 0));
            if(!manual || !entry) return;
            const nextName = String(manual.name || entry.name || '').trim() || entry.name;
            const nextPosition = manual.position || entry.position;
            if(String(entry.name || '') !== String(nextName || '') || String(entry.position || '') !== String(nextPosition || '')) historyChanged += 1;
            entry.name = nextName;
            entry.position = nextPosition;
          });
        });
      });
    }
  }
  const changed = Boolean(seedChanged || marketChanged || retiredChanged || historyChanged);
  if(changed && typeof invalidatePlayerIndexes === 'function') invalidatePlayerIndexes();
  if(state && typeof state === 'object') state.manualPlayerReferenceSyncVersion = 'V8.66';
  return { changed, seedChanged, marketChanged, retiredChanged, historyChanged };
}

function applyManualPlayersDatabase(seedData, database=manualPlayersDatabase, options={}){
  if(!seedData || !database?.players?.length) return seedData;
  const preserveExisting = Boolean(options?.preserveExisting);
  const retiredManualIds = manualRetiredPlayerIdSet(options);
  const manualPlayers = database.players
    .map(player => normalizeManualDatabasePlayer(player, seedData))
    .filter(Boolean)
    .filter(player => !retiredManualIds.has(Number(player.id)));
  if(!manualPlayers.length) return seedData;
  const manualIds = new Set(manualPlayers.map(player => Number(player.id)));
  const manualById = new Map(manualPlayers.map(player => [Number(player.id), player]));
  const existingIds = new Set((seedData.players || []).map(player => Number(player.id)));
  const kept = (seedData.players || [])
    .filter(player => !manualIds.has(Number(player.id)) || preserveExisting)
    .map(player => preserveExisting && manualById.has(Number(player.id)) ? refreshExistingManualPlayerFromDatabase(player, manualById.get(Number(player.id))) : player);
  const toAdd = preserveExisting ? manualPlayers.filter(player => !existingIds.has(Number(player.id))) : manualPlayers;
  seedData.players = kept.concat(toAdd);
  seedData.meta = {
    ...(seedData.meta || {}),
    manualPlayersSource:database.source,
    manualPlayersVersion:database.raw?.metadata?.version || 'local',
    manualPlayersApplied:manualPlayers.length,
    manualPlayersInserted:toAdd.length,
    manualPlayersRespawned:0
  };
  seedData.meta.signature = `${seedSignature(seedData)}-${playersDatabaseHash(seedData.players)}`;
  return seedData;
}
function syncManualPlayersIntoSeed(options={}){
  if(!seed || !manualPlayersDatabase?.players?.length) return { inserted:0, refreshed:0, changed:false };
  const beforeLength = seed.players?.length || 0;
  const beforeById = new Map((seed.players || []).map(player => [Number(player.id), manualPlayerCanonicalSignature(player)]));
  applyManualPlayersDatabase(seed, manualPlayersDatabase, { preserveExisting:true, ...options });
  const referenceSync = synchronizeManualPlayerReferences(options.state === false ? null : (options.state || game), seed, options);
  let refreshed = 0;
  (seed.players || []).forEach(player => {
    const id = Number(player.id || 0);
    if(beforeById.has(id) && beforeById.get(id) !== manualPlayerCanonicalSignature(player)) refreshed += 1;
  });
  const inserted = Math.max(0, (seed.players?.length || 0) - beforeLength);
  const changed = Boolean(inserted || refreshed || referenceSync.changed);
  return { ...referenceSync, inserted, refreshed, changed };
}


const SINGLE_CAREER_SLOT_MIGRATION_KEY = 'fmSingleCareerSlotMigrationV8.32';
const SINGLE_CAREER_SLOT_ARCHIVE_PREFIX = 'archive:v8.32:single-career:';
const activeSaveSlotBeforeSingleSlotMigration = (() => {
  try{ return String(localStorage.getItem(SAVE_ACTIVE_SLOT_STORAGE_KEY) || SAVE_SLOT_CAREER); }
  catch(_){ return SAVE_SLOT_CAREER; }
})();

let currentSaveSlotId = (() => {
  try{ return normalizeSaveSlotId(activeSaveSlotBeforeSingleSlotMigration || SAVE_SLOT_CAREER); }
  catch(_){ return SAVE_SLOT_CAREER; }
})();

function normalizeSaveSlotId(slotId=''){
  const raw = String(slotId || '').trim();
  const lower = raw.toLowerCase();
  if(lower === SAVE_SLOT_CAMPO_DESTRUIDO || lower === 'campo_destruido' || lower === 'reto_campo_destruido') return SAVE_SLOT_CAMPO_DESTRUIDO;
  if(lower === SAVE_SLOT_LEGACY_CAREER || lower === 'main' || lower === 'mi_carrera' || lower === 'mi-carrera') return SAVE_SLOT_CAREER;
  const match = lower.match(/^career[:_-]?(\d+)$/) || lower.match(/^carrera[:_-]?(\d+)$/);
  if(match){
    const slotNumber = Math.max(1, Math.min(SAVE_CAREER_SLOT_COUNT, Math.round(Number(match[1]) || 1)));
    return `${SAVE_SLOT_CAREER_PREFIX_ID}${slotNumber}`;
  }
  return SAVE_SLOT_CAREER;
}
function careerSaveSlotNumber(slotId=''){
  const clean = normalizeSaveSlotId(slotId);
  if(!clean.startsWith(SAVE_SLOT_CAREER_PREFIX_ID)) return 0;
  return Math.max(1, Math.min(SAVE_CAREER_SLOT_COUNT, Math.round(Number(clean.split(':')[1]) || 1)));
}
function careerSaveSlotIds(){
  return Array.from({ length:SAVE_CAREER_SLOT_COUNT }, (_, index) => `${SAVE_SLOT_CAREER_PREFIX_ID}${index + 1}`);
}
function legacyCareerSlotKey(){
  return `${SAVE_SLOT_PREFIX}${SAVE_SLOT_LEGACY_CAREER}`;
}
function saveSlotKey(slotId=''){
  return `${SAVE_SLOT_PREFIX}${normalizeSaveSlotId(slotId)}`;
}
function backupSaveSlotKey(slotId=''){
  const slot = normalizeSaveSlotId(slotId);
  return slot === SAVE_SLOT_CAREER ? SAVE_KEY : `${SAVE_BACKUP_PREFIX}${saveSlotKey(slot)}`;
}
function setCurrentSaveSlot(slotId='career'){
  currentSaveSlotId = normalizeSaveSlotId(slotId);
  try{ localStorage.setItem(SAVE_ACTIVE_SLOT_STORAGE_KEY, currentSaveSlotId); }catch(_){ /* sin almacenamiento */ }
  if(game) game.saveSlotId = currentSaveSlotId;
  return currentSaveSlotId;
}
function baseSaveSlotLabel(slotId=''){
  const clean = normalizeSaveSlotId(slotId);
  if(clean === SAVE_SLOT_CAMPO_DESTRUIDO) return 'Reto Campo destruido';
  const number = careerSaveSlotNumber(clean);
  if(SAVE_CAREER_SLOT_COUNT === 1 && number) return 'Carrera';
  return number ? `Carrera ${number}` : 'Carrera';
}
function saveSlotRecordAutoLabel(slotId='', record=null){
  const clean = normalizeSaveSlotId(slotId);
  if(clean === SAVE_SLOT_CAMPO_DESTRUIDO) return 'Reto Campo destruido';
  const base = baseSaveSlotLabel(clean);
  if(!record) return `${base} · Vacía`;
  const clubId = Number(record.selectedClubId || 0);
  const club = clubId ? clubName(clubId) : 'Sin club';
  const year = Math.round(Number(record.seasonYear || 0)) || (typeof seasonYearForNumber === 'function' ? seasonYearForNumber(record.seasonNumber || 1) : (record.seasonNumber || 1));
  return `${base} · ${club} · Temporada ${year}`;
}
function saveSlotLabel(slotId='', record=null){
  return saveSlotRecordAutoLabel(slotId, record);
}
function gameSlotId(){
  return normalizeSaveSlotId(game?.saveSlotId || currentSaveSlotId || SAVE_SLOT_CAREER);
}
async function readSaveRecordByKey(key){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(key);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function deleteSaveRecordByKey(key){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}
function rawCareerSlotNumber(slotId=''){
  const raw = String(slotId || '').trim().toLowerCase();
  if([SAVE_SLOT_LEGACY_CAREER, 'main', 'mi_carrera', 'mi-carrera'].includes(raw)) return 1;
  const match = raw.match(/^career[:_-]?(\d+)$/) || raw.match(/^carrera[:_-]?(\d+)$/);
  return match ? Math.max(1, Math.min(10, Math.round(Number(match[1]) || 1))) : 0;
}
function cloneSaveRecord(record){
  if(!record || typeof record !== 'object') return record;
  if(typeof structuredClone === 'function'){
    try{ return structuredClone(record); }catch(_error){}
  }
  return JSON.parse(JSON.stringify(record));
}
async function readLegacyCareerSlotRecord(slotNumber=1){
  const number = Math.max(1, Math.min(10, Math.round(Number(slotNumber) || 1)));
  const primaryKey = `${SAVE_SLOT_PREFIX}${SAVE_SLOT_CAREER_PREFIX_ID}${number}`;
  const candidates = [
    { key:primaryKey, source:'primary', priority:3 },
    { key:number === 1 ? SAVE_KEY : `${SAVE_BACKUP_PREFIX}${primaryKey}`, source:'backup', priority:2 }
  ];
  if(number === 1) candidates.push({ key:legacyCareerSlotKey(), source:'legacy', priority:1 });
  const loaded = await Promise.all(candidates.map(async item => ({ ...item, record:await readSaveRecordByKey(item.key) })));
  const usable = loaded.filter(item => usableLocalSaveRecord(item.record));
  if(!usable.length) return null;
  usable.sort((a,b) => localSaveRecordTimestamp(b.record) - localSaveRecordTimestamp(a.record) || b.priority - a.priority);
  return { slotNumber:number, key:usable[0].key, record:usable[0].record };
}
async function migrateCareerSlotsToSingleSlot(){
  if(SAVE_CAREER_SLOT_COUNT !== 1) return { migrated:false, reason:'multiple_slots_enabled' };
  try{
    if(localStorage.getItem(SINGLE_CAREER_SLOT_MIGRATION_KEY) === 'done'){
      setCurrentSaveSlot(SAVE_SLOT_CAREER);
      return { migrated:false, reason:'already_done' };
    }
  }catch(_error){}

  const records = (await Promise.all(Array.from({ length:10 }, (_, index) => readLegacyCareerSlotRecord(index + 1)))).filter(Boolean);
  const activeNumber = rawCareerSlotNumber(activeSaveSlotBeforeSingleSlotMigration);
  const activeRecord = records.find(item => item.slotNumber === activeNumber);
  const slotOneRecord = records.find(item => item.slotNumber === 1);
  const newestRecord = records.slice().sort((a,b) => localSaveRecordTimestamp(b.record) - localSaveRecordTimestamp(a.record))[0] || null;
  const selected = activeRecord || slotOneRecord || newestRecord;
  let migrated = false;
  let fromSlot = 0;

  if(selected && selected.slotNumber !== 1){
    const payload = cloneSaveRecord(selected.record);
    payload.saveSlotId = SAVE_SLOT_CAREER;
    payload.localSaveMeta = {
      ...(payload.localSaveMeta || {}),
      migratedToSingleSlotAt:new Date().toISOString(),
      migratedFromCareerSlot:selected.slotNumber
    };
    const db = await openDb();
    await new Promise((resolve,reject)=>{
      const tx = db.transaction(DB_STORE, 'readwrite');
      const store = tx.objectStore(DB_STORE);
      if(slotOneRecord?.record){
        store.put(cloneSaveRecord(slotOneRecord.record), `${SINGLE_CAREER_SLOT_ARCHIVE_PREFIX}career:1`);
      }
      store.put(payload, `${SAVE_SLOT_PREFIX}${SAVE_SLOT_CAREER}`);
      store.put(payload, SAVE_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error || new Error('No se pudo consolidar la partida.'));
      tx.onabort = () => reject(tx.error || new Error('Se canceló la consolidación de la partida.'));
    });
    migrated = true;
    fromSlot = selected.slotNumber;
  }

  setCurrentSaveSlot(SAVE_SLOT_CAREER);
  try{ localStorage.setItem(SINGLE_CAREER_SLOT_MIGRATION_KEY, 'done'); }catch(_error){}
  return { migrated, fromSlot, retainedLegacySlots:records.filter(item => item.slotNumber !== 1).map(item => item.slotNumber) };
}
async function localSlotExists(slotId='career'){
  return Boolean(await readLocalSaveRecord(slotId).catch(()=>null));
}
async function deleteLocalSaveSlot(slotId='career'){
  const slot = normalizeSaveSlotId(slotId);
  await Promise.all([
    deleteSaveRecordByKey(saveSlotKey(slot)).catch(()=>{}),
    deleteSaveRecordByKey(backupSaveSlotKey(slot)).catch(()=>{})
  ]);
  if(slot === SAVE_SLOT_CAREER) await deleteSaveRecordByKey(legacyCareerSlotKey()).catch(()=>{});
}
async function readSaveSlotSummary(slotId='career'){
  const slot = normalizeSaveSlotId(slotId);
  const record = await readLocalSaveRecord(slot).catch(()=>null);
  return {
    slotId:slot,
    exists:Boolean(record),
    label:saveSlotLabel(slot, record),
    clubId:Number(record?.selectedClubId || 0),
    clubName:record?.selectedClubId ? clubName(record.selectedClubId) : '',
    seasonNumber:Number(record?.seasonNumber || 0),
    seasonYear:Number(record?.seasonYear || 0),
    currentDate:String(record?.currentDate || '')
  };
}
async function hydrateCareerSlotCards(){
  const ids = typeof careerSaveSlotIds === 'function' ? careerSaveSlotIds() : [SAVE_SLOT_CAREER];
  const summaries = await Promise.all(ids.map(id => readSaveSlotSummary(id).catch(()=>({ slotId:id, exists:false, label:saveSlotLabel(id, null) }))));
  summaries.forEach(summary => {
    const card = document.querySelector(`[data-save-slot-card="${summary.slotId}"]`);
    if(!card) return;
    const title = card.querySelector('[data-save-slot-title]');
    const detail = card.querySelector('[data-save-slot-detail]');
    const continueBtn = card.querySelector('[data-slot-continue]');
    if(title) title.textContent = summary.label;
    if(detail){
      detail.textContent = summary.exists
        ? `Guardada${summary.currentDate ? ` · ${summary.currentDate}` : ''}`
        : 'Espacio libre para iniciar una carrera normal.';
    }
    if(continueBtn) continueBtn.textContent = summary.exists ? 'Entrar' : 'Crear';
    card.classList.toggle('save-slot-empty', !summary.exists);
    card.classList.remove('empty-slot');
  });
}
async function loadBaseSeedForSlotStart(){
  seed = await loadInitialSeed({ skipPlayersDatabase:false });
  fillClubSelect();
  return seed;
}
async function goToSaveSlotsMenu(options={}){
  const opts = options && typeof options === 'object' ? options : {};
  if(opts.saveCurrent && game) await saveLocal(true).catch(()=>{});
  if(opts.reloadSeed !== false) await loadBaseSeedForSlotStart().catch(()=>{});
  game = null;
  activeTab = 'home';
  try{ if(typeof forceCloseModal === 'function') forceCloseModal(); else if(typeof closeModal === 'function') closeModal(); }catch(_){ }
  renderAll();
  if(opts.notice) showNotice(opts.notice);
}
async function loadCareerSlotOrNew(slotId=SAVE_SLOT_CAREER){
  const slot = normalizeSaveSlotId(slotId);
  const loaded = await loadLocal(true, slot);
  if(loaded){ showNotice(`${baseSaveSlotLabel(slot)} cargada.`); return true; }
  setCurrentSaveSlot(slot);
  await loadBaseSeedForSlotStart().catch(()=>{});
  game = null;
  renderAll();
  openNewGameModal(true, { saveSlotId:slot });
  return false;
}
async function startNewCareerFromSlot(slotId=SAVE_SLOT_CAREER){
  const slot = normalizeSaveSlotId(slotId);
  const exists = await localSlotExists(slot).catch(()=>false);
  if(exists){
    const ok = window.confirm(`Esto inicia una nueva carrera y reemplaza la partida guardada en este navegador. ¿Continuar?`);
    if(!ok) return false;
    await deleteLocalSaveSlot(slot).catch(()=>{});
  }
  setCurrentSaveSlot(slot);
  await loadBaseSeedForSlotStart().catch(()=>{});
  game = null;
  renderAll();
  openNewGameModal(true, { saveSlotId:slot });
  return true;
}
async function continueCampoDestruidoSlot(){
  const loaded = await loadLocal(true, SAVE_SLOT_CAMPO_DESTRUIDO);
  if(loaded){ showNotice('Reto Campo destruido cargado.'); return true; }
  showNotice('No hay un reto guardado. Iniciá uno nuevo.');
  return false;
}
async function startNewCampoDestruidoSlot(){
  const exists = await localSlotExists(SAVE_SLOT_CAMPO_DESTRUIDO).catch(()=>false);
  if(exists){
    const ok = window.confirm('Ya existe un reto Campo destruido guardado. Si iniciás otro, se pisa ese reto. ¿Continuar?');
    if(!ok) return false;
    await deleteLocalSaveSlot(SAVE_SLOT_CAMPO_DESTRUIDO).catch(()=>{});
  }
  setCurrentSaveSlot(SAVE_SLOT_CAMPO_DESTRUIDO);
  await loadBaseSeedForSlotStart().catch(()=>{});
  game = null;
  renderAll();
  if(typeof openCampoDestruidoChallengeModal === 'function') openCampoDestruidoChallengeModal({ saveSlotId:SAVE_SLOT_CAMPO_DESTRUIDO });
  return true;
}
async function closeCompletedChallengeSlot(challenge=null){
  const slot = normalizeSaveSlotId(game?.saveSlotId || currentSaveSlotId || SAVE_SLOT_CAMPO_DESTRUIDO);
  if(slot === SAVE_SLOT_CAMPO_DESTRUIDO) await deleteLocalSaveSlot(SAVE_SLOT_CAMPO_DESTRUIDO).catch(()=>{});
  setCurrentSaveSlot(SAVE_SLOT_CAREER);
  const resultText = String(challenge?.closeNotice || (challenge?.success ? 'La directiva te dio las gracias por ganar el reto.' : 'La directiva finalizó tu contrato al terminar el reto.'));
  await goToSaveSlotsMenu({ reloadSeed:true, notice:`${resultText} El desafío terminó y el slot fue cerrado.` });
}

async function loadSponsorsDatabase(){
  const raw = await fetchJsonIfExists(SPONSORS_DATABASE_URL);
  if(!raw) return { lugares_sponsor:[], sponsors:[], reglas_calculo:{} };
  const lugares = Array.isArray(raw.lugares_sponsor) ? raw.lugares_sponsor : [];
  const sponsors = Array.isArray(raw.sponsors) ? raw.sponsors.filter(sponsor => sponsor && sponsor.activo !== false) : [];
  return { ...raw, lugares_sponsor:lugares, sponsors, source:SPONSORS_DATABASE_URL };
}
async function loadEmployeesDatabase(){
  const raw = await fetchJsonIfExists(EMPLOYEES_DATABASE_URL);
  const fallback = {
    categorias:[
      { id:'regular', nombre:'Regular', multiplicadorCosto:1, multiplicadorRendimiento:1, descripcion:'Mantiene el rendimiento estándar.' },
      { id:'bueno', nombre:'Bueno', multiplicadorCosto:4, multiplicadorRendimiento:2, descripcion:'Duplica el rendimiento de la acción.' },
      { id:'elite', nombre:'Elite', multiplicadorCosto:50, multiplicadorRendimiento:3, descripcion:'Triplica el rendimiento de la acción.' }
    ],
    empleados:[
      { id:'psychologist', nombre:'Psicólogo motivacional', rol:'Motivación', costoBase:PSYCHOLOGIST_COST, duracion:'temporada', descripcion:'Permite realizar charlas motivacionales para mejorar la moral del plantel.', accion:'charla_motivacional' },
      { id:'kinesiologist', nombre:'Kinesiólogo', rol:'Recuperación', costoBase:KINESIOLOGIST_COST, duracion:'temporada', descripcion:'Permite tratar lesionados y asignar un jugador a trabajo diferenciado con menor carga.', accion:'tratamiento_lesion' },
      { id:'youth_preparer', nombre:'Preparador de juveniles', rol:'Academia', costoBase:YOUTH_PREPARER_COST, duracion:'temporada', descripcion:'Permite consultar informes de juveniles y descubrir más habilidades ocultas.', accion:'informe_juveniles' }
    ],
    source:'fallback'
  };
  const clean = raw && typeof raw === 'object' ? raw : fallback;
  const categorias = Array.isArray(clean.categorias) && clean.categorias.length ? clean.categorias : fallback.categorias;
  const empleados = Array.isArray(clean.empleados) && clean.empleados.length ? clean.empleados : fallback.empleados;
  return { ...clean, categorias, empleados, source:raw ? EMPLOYEES_DATABASE_URL : 'fallback' };
}


function installationsDatabaseFallback(){
  return {
    version:APP_VERSION,
    sistema:'instalaciones_club',
    calefaccion_cesped:{
      id:'pitch_heating', nombre:'Calefacción de césped', costo_construccion:200000000,
      dias_construccion:60, costo_diario:10000, mejora_campo_diaria:1
    },
    predio_entrenamiento_juvenil:{
      id:'youth_training_ground', nombre:'Predio de entrenamiento juvenil', residencias_desbloqueadas_por_nivel:2,
      niveles:[
        { nivel:1, nombre:'Básico', costo:20000000, dias_construccion:58, juveniles_excepcionales_adicionales:0, residencias_maximas:2 },
        { nivel:2, nombre:'Medio', costo:100000000, dias_construccion:105, juveniles_excepcionales_adicionales:1, residencias_maximas:4 },
        { nivel:3, nombre:'Bueno', costo:300000000, dias_construccion:180, juveniles_excepcionales_adicionales:2, residencias_maximas:6 },
        { nivel:4, nombre:'Excelente', costo:500000000, dias_construccion:230, juveniles_excepcionales_adicionales:3, residencias_maximas:8 },
        { nivel:5, nombre:'Elite', costo:1200000000, dias_construccion:80, juveniles_excepcionales_adicionales:5, residencias_maximas:10 }
      ]
    },
    source:'fallback'
  };
}
async function loadInstallationsDatabase(){
  const raw = await fetchJsonIfExists(INSTALLATIONS_DATABASE_URL);
  const fallback = installationsDatabaseFallback();
  if(!raw || typeof raw !== 'object') return fallback;
  const heating = raw.calefaccion_cesped && typeof raw.calefaccion_cesped === 'object' ? raw.calefaccion_cesped : fallback.calefaccion_cesped;
  const youthRaw = raw.predio_entrenamiento_juvenil && typeof raw.predio_entrenamiento_juvenil === 'object' ? raw.predio_entrenamiento_juvenil : fallback.predio_entrenamiento_juvenil;
  const levels = Array.isArray(youthRaw.niveles) && youthRaw.niveles.length ? youthRaw.niveles : fallback.predio_entrenamiento_juvenil.niveles;
  return { ...raw, calefaccion_cesped:heating, predio_entrenamiento_juvenil:{ ...youthRaw, niveles:levels }, source:INSTALLATIONS_DATABASE_URL };
}

async function loadEventsDatabase(){
  const raw = await fetchJsonIfExists(EVENTS_DATABASE_URL);
  const fallback = { metadata:{ version:APP_VERSION, source:'fallback' }, eventos:[] };
  if(!raw || typeof raw !== 'object') return fallback;
  const eventos = Array.isArray(raw.eventos) ? raw.eventos : (Array.isArray(raw.events) ? raw.events : []);
  return { ...raw, eventos, source:EVENTS_DATABASE_URL };
}

async function loadSpecialSkillsDatabase(){
  const raw = await fetchJsonIfExists(SPECIAL_SKILLS_DATABASE_URL);
  const fallback = {
    version:APP_VERSION,
    sistema:'habilidades_especiales',
    limites:{ cartas_activas_max:5, cartas_reserva_max:50, dias_bloqueo_cambio_cartas:15, permitir_abrir_sobres_con_reserva_llena:false, permitir_cartas_repetidas_activas:true, bonus_se_apilan:true, activaciones_por_carta:5, activaciones_por_rareza:{ inutil:1, comun:1, rara:2, epica:3, legendaria:5 } },
    rareza_orden_visual:['inutil','comun','rara','epica','legendaria'],
    sobres:{},
    destruir_cartas:{ permitido:true, recuperacion_puntos:{ inutil:5, comun:20, rara:50, epica:250, legendaria:1000 } },
    apilamiento_bonus:{},
    cartas_base:[],
    puntos_ocultos:{ moneda:'puntos_habilidad', acciones:{} },
    source:'fallback'
  };
  if(!raw || typeof raw !== 'object') return fallback;
  const clean = { ...fallback, ...raw, source:SPECIAL_SKILLS_DATABASE_URL };
  clean.limites = { ...fallback.limites, ...(raw.limites || {}) };
  clean.sobres = raw.sobres && typeof raw.sobres === 'object' ? raw.sobres : {};
  clean.cartas_base = Array.isArray(raw.cartas_base) ? raw.cartas_base : [];
  clean.puntos_ocultos = raw.puntos_ocultos && typeof raw.puntos_ocultos === 'object' ? raw.puntos_ocultos : fallback.puntos_ocultos;
  clean.destruir_cartas = raw.destruir_cartas && typeof raw.destruir_cartas === 'object' ? raw.destruir_cartas : fallback.destruir_cartas;
  clean.apilamiento_bonus = raw.apilamiento_bonus && typeof raw.apilamiento_bonus === 'object' ? raw.apilamiento_bonus : {};
  clean.rareza_orden_visual = Array.isArray(raw.rareza_orden_visual) ? raw.rareza_orden_visual : fallback.rareza_orden_visual;
  return clean;
}


async function loadManagerAchievementsDatabase(){
  const fallback = { metadata:{ version:APP_VERSION, sistema:'hitos_manager', source:'fallback' }, hitos:[] };
  const raw = await fetchJsonIfExists(MANAGER_ACHIEVEMENTS_DATABASE_URL);
  if(!raw || typeof raw !== 'object') return fallback;
  const hitos = Array.isArray(raw.hitos) ? raw.hitos.filter(item => item && item.id && item.metrica) : [];
  return { ...raw, hitos, source:MANAGER_ACHIEVEMENTS_DATABASE_URL };
}

async function loadManagerChallengesDatabase(){
  const fallback = { metadata:{ version:APP_VERSION, sistema:'retos_manager', source:'fallback' }, retos:[] };
  const raw = await fetchJsonIfExists(MANAGER_CHALLENGES_DATABASE_URL);
  if(!raw || typeof raw !== 'object') return fallback;
  const retos = Array.isArray(raw.retos) ? raw.retos.filter(item => item && item.id && item.activo !== false) : [];
  return { ...raw, retos, source:MANAGER_CHALLENGES_DATABASE_URL };
}

function uniqueUrlList(list){
  const raw = Array.isArray(list) ? list : [list];
  return Array.from(new Set(raw.filter(Boolean).map(String)));
}
async function loadStadiumsDatabase(){
  const urls = uniqueUrlList(STADIUMS_DATABASE_CANDIDATES || STADIUMS_DATABASE_URL);
  const teams = [];
  const raws = [];
  const loaded = await Promise.all(urls.map(async url => ({ url, raw:await fetchJsonIfExists(url) })));
  loaded.forEach(({ url, raw }) => {
    if(!raw || typeof raw !== 'object') return;
    raws.push({ url, raw });
    const fileCountry = raw.pais || raw.country || raw.countryName || countryFromSourceUrl(url) || '';
    const leagues = Array.isArray(raw.leagues) ? raw.leagues : (Array.isArray(raw.ligas) ? raw.ligas : []);
    leagues.forEach(league => {
      const leagueName = league?.name || league?.nombre || '';
      const leagueCountry = league?.country || league?.pais || fileCountry || '';
      const list = Array.isArray(league?.teams) ? league.teams : (Array.isArray(league?.equipos) ? league.equipos : []);
      list.forEach(team => {
        if(!team) return;
        teams.push({ ...team, league:leagueName, country:team.country || team.pais || leagueCountry });
      });
    });
  });
  if(!raws.length) return { raw:null, teams:[], source:'fallback' };
  return { raw:{ sources:raws.map(item => item.url), count:raws.length }, teams, source:raws.map(item => item.url).join(', ') };
}
async function loadFansDatabase(){
  const urls = uniqueUrlList(FANS_DATABASE_CANDIDATES || FANS_DATABASE_URL);
  const hinchadas = [];
  const raws = [];
  const loaded = await Promise.all(urls.map(async url => ({ url, raw:await fetchJsonIfExists(url) })));
  loaded.forEach(({ url, raw }) => {
    if(!raw || typeof raw !== 'object') return;
    raws.push({ url, raw });
    const fileCountry = raw.pais || raw.country || countryFromSourceUrl(url) || '';
    (Array.isArray(raw.hinchadas) ? raw.hinchadas : []).forEach(item => {
      if(!item) return;
      hinchadas.push({ ...item, country:item.country || item.pais || fileCountry });
    });
  });
  if(!raws.length) return { raw:null, hinchadas:[], source:'fallback' };
  return { raw:{ sources:raws.map(item => item.url), count:raws.length }, hinchadas, source:raws.map(item => item.url).join(', ') };
}

async function loadMatchCommentaryDatabase(){
  const raw = await fetchJsonIfExists(MATCH_COMMENTARY_DATABASE_URL);
  const fallback = { version:APP_VERSION, sistema:'relatos_partido', categorias:{} };
  if(!raw || typeof raw !== 'object') return fallback;
  const categorias = raw.categorias && typeof raw.categorias === 'object' ? raw.categorias : {};
  Object.keys(categorias).forEach(key => {
    categorias[key] = Array.isArray(categorias[key]) ? categorias[key].filter(Boolean).map(String) : [];
  });
  return { ...raw, categorias, source:MATCH_COMMENTARY_DATABASE_URL };
}
function lookupNameKey(name){
  return String(name || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}
function normalizeLegacyAssetMarkerEncoding(path){
  if(path === null || path === undefined) return path;
  return String(path).replace(/%23U([0-9a-fA-F]{4})/g, '#U$1');
}
function normalizeClubCrestPath(club, rawPath){
  const fallback = `img/escudos/${imageSlug(club?.name || '')}.png`;
  const defaultFounderCrest = 'img/escudos/fundador-1.webp';
  const foundedClub = Boolean(club?.isFoundedClub || club?.founderClub);
  const rawClean = normalizeLegacyAssetMarkerEncoding(rawPath || '');
  const cleanPath = normalizeLegacyAssetMarkerEncoding(rawPath || fallback);
  if(foundedClub){
    const current = String(rawClean || '').trim();
    const generatedByName = String(cleanPath || '').trim() === fallback;
    if(!current || generatedByName) return defaultFounderCrest;
  }
  const clubKey = lookupNameKey(club?.name || '');
  const countryKey = countryNameKey(club?.country || club?.pais || '');
  if(clubKey === 'everton' && String(cleanPath || '').endsWith('/everton.png')){
    if(countryKey === 'chile') return 'img/escudos/everton-chi.png';
    if(countryKey === 'inglaterra' || countryKey === 'england') return 'img/escudos/everton-eng.png';
  }
  return cleanPath;
}
function countryFromSourceUrl(url){
  const lower = String(url || '').toLowerCase();
  if(lower.includes('chile')) return 'Chile';
  if(lower.includes('argentina')) return 'Argentina';
  if(lower.includes('brasil') || lower.includes('brazil')) return 'Brasil';
  if(lower.includes('inglaterra') || lower.includes('england')) return 'Inglaterra';
  if(lower.includes('espana') || lower.includes('españa') || lower.includes('spain')) return 'España';
  if(lower.includes('italia') || lower.includes('italy')) return 'Italia';
  if(lower.includes('rumania') || lower.includes('romania')) return 'Rumania';
  return '';
}
function countryNameKey(country){
  return lookupNameKey(country || '');
}
function indexByTeamName(list, field='name'){
  const map = new Map();
  (list || []).forEach(item => {
    const key = lookupNameKey(item?.[field]);
    if(!key) return;
    const country = countryNameKey(item?.country || item?.pais || '');
    if(country && !map.has(`${country}::${key}`)) map.set(`${country}::${key}`, item);
    if(!map.has(key)) map.set(key, item);
  });
  return map;
}
function fallbackStadiumCapacityForClub(club){
  const reputation = Number(club?.reputation || 50);
  const order = Number(club?.divisionOrder || 3);
  const base = order === 1 ? 26000 : order === 2 ? 14000 : 6500;
  return Math.max(500, Math.round(base + reputation * (order === 1 ? 380 : order === 2 ? 180 : 80)));
}
function fallbackFanBaseForClub(club, capacity=null){
  const cap = Math.max(500, Math.round(Number(capacity || club?.stadiumCapacity || fallbackStadiumCapacityForClub(club))));
  const order = Number(club?.divisionOrder || 3);
  const reputation = clamp(Number(club?.reputation || 50), 1, 99);
  const minPct = order === 1 ? 0.70 : order === 2 ? 0.50 : 0.25;
  const maxPct = order === 1 ? 0.90 : order === 2 ? 0.74 : 0.56;
  const pct = minPct + (reputation / 99) * (maxPct - minPct);
  return Math.max(50, Math.floor(cap * pct));
}
function applyStadiumAndFansDatabases(seedData, stadiumDb, fanDb){
  if(!seedData?.clubs?.length) return seedData;
  const stadiumIndex = indexByTeamName(stadiumDb?.teams || [], 'name');
  const fansIndex = indexByTeamName(fanDb?.hinchadas || [], 'equipo');
  seedData.clubs = seedData.clubs.map(club => {
    const key = lookupNameKey(club.name);
    const countryKey = countryNameKey(club.country || club.pais || '');
    const stadium = stadiumIndex.get(`${countryKey}::${key}`) || stadiumIndex.get(key) || null;
    const fans = fansIndex.get(`${countryKey}::${key}`) || fansIndex.get(key) || null;
    const stadiumName = stadium?.stadium || fans?.estadio || club.stadiumName || `${club.name} Stadium`;
    const stadiumCapacity = Math.max(500, Math.round(Number(stadium?.stadiumCapacity || fans?.capacidad_estadio || club.stadiumCapacity || fallbackStadiumCapacityForClub(club))));
    const fansBase = Math.max(50, Math.round(Number(fans?.hinchas_base || club.fansBase || fallbackFanBaseForClub(club, stadiumCapacity))));
    return {
      ...club,
      stadiumName,
      stadiumCapacity,
      stadiumIsFictional:Boolean(stadium?.stadiumIsFictional ?? fans?.estadio_ficticio ?? club.stadiumIsFictional ?? false),
      stadiumNote:stadium?.stadiumNote || fans?.nota_estadio || club.stadiumNote || '',
      fansBase,
      fansInitial:fansBase
    };
  });
  seedData.meta = {
    ...(seedData.meta || {}),
    stadiumsSource:stadiumDb?.source || 'fallback',
    fansSource:fanDb?.source || 'fallback',
    fansVersion:fanDb?.raw?.version || '',
    stadiumsApplied:true
  };
  seedData.meta.signature = seedSignature(seedData);
  return seedData;
}

function playersDatabaseHash(players=[]){
  const raw = players.map(p => `${p.id}:${p.clubId}:${p.position}:${p.overall}:${p.salary}:${p.clause}`).join('|');
  return `players-${hashNumber(raw, 1000000000)}`;
}
function removeCustomPlayerPhotoFields(player){
  if(!player || typeof player !== 'object') return player;
  ['photoPath','fotoPath','imagePath','photo','foto'].forEach(field => { delete player[field]; });
  return player;
}
function normalizeDatabasePlayer(player){
  const clean = { ...player, id:Number(player.id), clubId:Number(player.clubId || 0), age:Math.max(15, Math.round(Number(player.age || 18))) };
  removeCustomPlayerPhotoFields(clean);
  clean.position = normalizePlayerPosition(clean.position, clean.id);
  clean.skills = clean.skills && typeof clean.skills === 'object' ? { ...clean.skills } : skillsForPosition(clean.position, Number(clean.overall || 50), clean.id);
  clean.overall = (clean.manualOverallLocked || clean.overallLocked) ? clamp(Math.round(Number(clean.overall || clean.media || 50)), 1, 99) : rawVisibleOverall({ ...clean, overall:Number(clean.overall || 50) });
  ensurePlayerEconomics(clean, clean.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : (clean.freeAgent ? MARKET_FREE_AGENT_SALARY_FACTOR : 1));
  return clean;
}
function databaseValidationCounts(players=[]){
  const media = {};
  const position = {};
  const nationality = {};
  players.forEach(player => {
    const mediaKey = mediaRangeIdForOverall(rawVisibleOverall(player));
    const positionKey = playerRoleGroup(player.position);
    const nationalityKey = nationalityGroupId(player.nationality);
    media[mediaKey] = (media[mediaKey] || 0) + 1;
    position[positionKey] = (position[positionKey] || 0) + 1;
    nationality[nationalityKey] = (nationality[nationalityKey] || 0) + 1;
  });
  return { media, position, nationality };
}
function applyPlayersDatabase(seedData, database){
  if(!seedData || !database?.players?.length) return seedData;
  const validClubIds = new Set((seedData.clubs || []).map(c => Number(c.id)));
  const normalized = database.players
    .map(normalizeDatabasePlayer)
    .filter(player => Number.isFinite(player.id) && (Number(player.clubId) === 0 || validClubIds.has(Number(player.clubId))));
  if(typeof applyProfessionalQualityScaleToCollection === 'function') applyProfessionalQualityScaleToCollection(normalized, { source:'base_players_database' });
  if(!normalized.length) return seedData;
  const dbClubIds = new Set(normalized.map(player => Number(player.clubId || 0)).filter(Boolean));
  const dbMaxId = Math.max(0, ...normalized.map(player => Number(player.id || 0)).filter(Number.isFinite));
  let nextId = dbMaxId + 1;
  const generatedForUncoveredClubs = (seedData.players || [])
    .map(normalizeDatabasePlayer)
    .filter(player => Number(player.clubId || 0) > 0 && validClubIds.has(Number(player.clubId)) && !dbClubIds.has(Number(player.clubId)))
    .map(player => ensurePlayerEconomics({ ...player, id:nextId++ }));
  if(typeof applyProfessionalQualityScaleToCollection === 'function') applyProfessionalQualityScaleToCollection(generatedForUncoveredClubs, { source:'fallback_club_players' });
  seedData.players = normalized.concat(generatedForUncoveredClubs);
  seedData.meta = { ...(seedData.meta || {}), playersSource:database.source, playersDatabaseVersion:database.raw?.metadata?.version || 'local', playersDatabaseValidation:database.raw?.validation || databaseValidationCounts(normalized), generatedPlayersKept:generatedForUncoveredClubs.length };
  seedData.meta.signature = `${seedSignature(seedData)}-${playersDatabaseHash(seedData.players)}`;
  return seedData;
}
function captureBaseClubDivisionIntegrityMap(seedData=seed){
  const map = { byId:{}, byName:{}, divisionCounts:{} };
  (seedData?.clubs || []).forEach(club => {
    const id = String(club.id || '');
    const key = `${normalizeScheduleText(club.country || club.pais || '')}::${normalizeScheduleText(club.name || '')}`;
    const entry = {
      clubId:Number(club.id || 0),
      clubName:club.name || '',
      country:club.country || club.pais || '',
      divisionId:club.divisionId || 'default',
      divisionName:club.divisionName || 'Liga única',
      divisionOrder:Number(club.divisionOrder || 1),
      prizeMultiplier:Number(club.prizeMultiplier || 1)
    };
    if(id) map.byId[id] = entry;
    if(key) map.byName[key] = entry;
    const divId = String(entry.divisionId || 'default');
    map.divisionCounts[divId] = Math.max(0, Math.round(Number(map.divisionCounts[divId] || 0))) + 1;
  });
  return map;
}
function preserveBaseClubDivisionIntegrityMap(){
  const map = captureBaseClubDivisionIntegrityMap(seed);
  if(typeof window !== 'undefined') window.__BASE_CLUB_DIVISION_INTEGRITY_MAP__ = map;
  return map;
}
function applySavedDatabaseSnapshots(saved){
  preserveBaseClubDivisionIntegrityMap();
  const clean = { ...(saved || {}) };
  // La división guardada debe restaurarse antes que los clubes para conservar referencias coherentes.
  if(Array.isArray(saved?.divisionsSnapshot) && saved.divisionsSnapshot.length){
    seed.divisions = structuredClone(saved.divisionsSnapshot);
  }
  if(Array.isArray(saved?.clubsSnapshot) && saved.clubsSnapshot.length){
    seed.clubs = saved.clubsSnapshot.map(club => ({ ...club, fieldConditionScore:Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club), fieldCondition:club.fieldCondition || fieldConditionName(club.fieldConditionScore || initialFieldScore(club)), crestPath:normalizeClubCrestPath(club, club.crestPath) }));
  }
  if(Array.isArray(saved?.playersSnapshot) && saved.playersSnapshot.length){
    seed.players = saved.playersSnapshot.map(normalizeDatabasePlayer);
    syncManualPlayersIntoSeed({ preserveExisting:true, state:false, retiredManualPlayerIds:saved?.manualRetiredPlayerIds || saved?.retiredManualPlayerIds || [] });
  }
  const manualReferenceSync = synchronizeManualPlayerReferences(clean, seed, { retiredManualPlayerIds:saved?.manualRetiredPlayerIds || saved?.retiredManualPlayerIds || [] });
  if(manualReferenceSync.changed) clean._needsAutosave = true;
  delete clean.playersSnapshot;
  delete clean.clubsSnapshot;
  delete clean.divisionsSnapshot;
  delete clean.localSaveMeta;
  delete clean._storageReadSource;
  delete clean._storageNeedsRefresh;
  return clean;
}
function currentSavePayload(){
  if(game?.clubBudgets && Number.isFinite(Number(game.selectedClubId))){
    game.clubBudgets[game.selectedClubId] = Math.round(Number(game.budget || 0));
  }
  if(typeof repairPlayerSkillBoostsForState === 'function'){
    repairPlayerSkillBoostsForState(game, seed?.players || []);
  }
  if(typeof repairPlayerAgeSkillPenaltiesForState === 'function'){
    repairPlayerAgeSkillPenaltiesForState(game, seed?.players || []);
  }
  const payload = structuredClone(game);
  delete payload._needsAutosave;
  delete payload._stadiumFieldsAutoRepaired;
  payload.saveSlotId = normalizeSaveSlotId(game?.saveSlotId || currentSaveSlotId || SAVE_SLOT_CAREER);
  payload.seedSignature = seed?.meta?.signature || payload.seedSignature || '';
  payload.playersSnapshot = structuredClone(seed?.players || []);
  payload.clubsSnapshot = structuredClone(seed?.clubs || []);
  payload.divisionsSnapshot = structuredClone(seed?.divisions || []);
  payload.localSaveMeta = {
    schemaVersion:LOCAL_SAVE_SCHEMA_VERSION,
    savedAt:new Date().toISOString(),
    slotId:payload.saveSlotId
  };
  return payload;
}
async function loadInitialSeed(options={}){
  const skipPlayersDatabase = Boolean(options?.skipPlayersDatabase);
  const [playersDatabase, loadedManualPlayersDatabase, loadedStadiumsDatabase, loadedFansDatabase, loadedLeagues] = await Promise.all([
    skipPlayersDatabase ? Promise.resolve(null) : loadPlayersDatabase(),
    loadManualPlayersDatabase(),
    loadStadiumsDatabase(),
    loadFansDatabase(),
    Promise.all(LEAGUE_DATA_CANDIDATES.map(async url => ({ url, leagueJson:await fetchJsonIfExists(url) })))
  ]);
  manualPlayersDatabase = loadedManualPlayersDatabase;
  stadiumsDatabase = loadedStadiumsDatabase;
  fansDatabase = loadedFansDatabase;
  const leagueSeeds = loadedLeagues
    .filter(item => item.leagueJson)
    .map(item => applyStadiumAndFansDatabases(buildSeedFromLigaArgentina(item.leagueJson, item.url), stadiumsDatabase, fansDatabase));
  if(leagueSeeds.length){
    const merged = mergeLeagueSeeds(leagueSeeds);
    return applyManualPlayersDatabase(applyPlayersDatabase(merged, playersDatabase), manualPlayersDatabase);
  }
  throw new Error('No se pudo cargar ningún JSON de liga válido. Revisá data.leagueUrls y los archivos publicados.');
}
function detectLeagueCountry(raw, sourceUrl=''){
  if(raw?.pais || raw?.country || raw?.countryName) return String(raw.pais || raw.country || raw.countryName).trim();
  const divisions = extractLeagueDivisions(raw || {});
  const fromDivision = divisions.map(d => d.country || d.pais).find(Boolean);
  if(fromDivision) return String(fromDivision).trim();
  return countryFromSourceUrl(sourceUrl) || 'Argentina';
}
function countryDivisionId(country, name){
  const countryPart = slugId(country || 'pais');
  const namePart = slugId(name || 'liga');
  return `${countryPart}-${namePart}`;
}
function mergeLeagueSeeds(seedList){
  const divisions = [];
  const clubs = [];
  const players = [];
  let nextClubId = 1;
  let nextPlayerId = 1;
  const sources = [];
  (seedList || []).forEach(seedData => {
    if(!seedData) return;
    const clubIdMap = new Map();
    const divisionIds = new Set(divisions.map(d => d.id));
    (seedData.divisions || []).forEach(division => {
      if(!divisionIds.has(division.id)){
        divisions.push({ ...division });
        divisionIds.add(division.id);
      }
    });
    (seedData.clubs || []).forEach(club => {
      const newId = nextClubId++;
      clubIdMap.set(Number(club.id), newId);
      clubs.push({ ...club, id:newId });
    });
    (seedData.players || []).forEach(player => {
      const oldClubId = Number(player.clubId || 0);
      const mappedClubId = oldClubId ? clubIdMap.get(oldClubId) : 0;
      if(oldClubId && !mappedClubId) return;
      players.push({ ...player, id:nextPlayerId++, clubId:mappedClubId || 0 });
    });
    if(seedData.meta?.source) sources.push(seedData.meta.source);
  });
  const seedData = {
    meta:{
      version:APP_VERSION,
      source:sources.join(' + ') || 'leagueUrls',
      combinedSources:sources,
      generatedAt:new Date().toISOString(),
      signature:''
    },
    divisions:divisions.sort((a,b)=>(a.country || '').localeCompare(b.country || '', 'es', { sensitivity:'base' }) || (a.order || 0)-(b.order || 0)),
    clubs,
    players,
    fixtures:generateFixturesForDivisions(clubs, divisions, { seasonYear:SEASON_START_YEAR })
  };
  seedData.meta.signature = seedSignature(seedData);
  return seedData;
}
function buildSeedFromLigaArgentina(raw, sourceUrl){
  const sourceCountry = detectLeagueCountry(raw, sourceUrl);
  const divisions = extractLeagueDivisions(raw);
  if(!divisions.length) throw new Error('El JSON de liga no tiene divisiones o equipos reconocibles.');
  const normalizedDivisions = divisions.map((division, index) => {
    const name = normalizeDivisionName(division.name || division.nombre || division.division || `División ${index+1}`);
    const country = String(division.country || division.pais || sourceCountry || 'Argentina').trim() || 'Argentina';
    return {
      id: countryDivisionId(country, name),
      name,
      country,
      order:index+1,
      prizeMultiplier: divisionPrizeMultiplier(name, index)
    };
  });
  const totalClubCount = divisions.reduce((sum, division) => sum + normalizeTeamList(division.teams || division.equipos || division.clubes || division.clubs || []).length, 0);
  const generationContext = createPlayerGenerationContext(totalClubCount * CLUB_ROSTER_SIZE, []);
  const clubs = [];
  const players = [];
  let clubId = 1;
  let playerId = 1;
  divisions.forEach((division, divisionIndex) => {
    const divInfo = normalizedDivisions[divisionIndex];
    const teams = normalizeTeamList(division.teams || division.equipos || division.clubes || division.clubs || []);
    teams.forEach((team, teamIndex) => {
      const name = teamName(team);
      if(!name) return;
      const prestige = teamPrestige(team, divInfo.name, teamIndex, teams.length);
      const fieldConditionScore = initialFieldScore({ name, id:clubId });
      const fieldCondition = fieldConditionName(fieldConditionScore);
      const country = divInfo.country || team.country || team.pais || sourceCountry || 'Argentina';
      const club = {
        id:clubId,
        name,
        short:clubShortFromName(name),
        city:team.city || team.ciudad || '',
        country,
        reputation:prestige,
        budget:clubBudgetByPrestige(prestige, divInfo.prizeMultiplier),
        primaryColor:team.color || team.primaryColor || deterministicColor(name),
        divisionId:divInfo.id,
        divisionName:divInfo.name,
        divisionOrder:divInfo.order,
        prizeMultiplier:divInfo.prizeMultiplier,
        fieldConditionScore,
        fieldCondition,
        crestPath:normalizeClubCrestPath({ name, country }, team.escudo || team.crestPath)
      };
      clubs.push(club);
      const generated = generateClubPlayers(club, prestige, playerId, generationContext);
      players.push(...generated);
      playerId += generated.length;
      clubId += 1;
    });
  });
  const seedData = {
    meta:{
      version:APP_VERSION,
      source:sourceUrl,
      generatedAt:new Date().toISOString(),
      signature:''
    },
    divisions:normalizedDivisions,
    clubs,
    players,
    fixtures:generateFixturesForDivisions(clubs, normalizedDivisions, { seasonYear:SEASON_START_YEAR })
  };
  seedData.meta.signature = seedSignature(seedData);
  return seedData;
}
function extractLeagueDivisions(raw){
  if(raw && raw['Liga argentina']) raw = raw['Liga argentina'];
  if(raw && raw['Liga Argentina']) raw = raw['Liga Argentina'];
  if(Array.isArray(raw)) return raw.map((item, index) => normalizeDivisionObject(item, index));
  if(Array.isArray(raw.divisiones)) return raw.divisiones.map(normalizeDivisionObject);
  if(raw.divisiones && typeof raw.divisiones === 'object') return Object.entries(raw.divisiones).map(([name, teams]) => ({ name, teams }));
  if(Array.isArray(raw.divisions)) return raw.divisions.map(normalizeDivisionObject);
  if(raw.divisions && typeof raw.divisions === 'object') return Object.entries(raw.divisions).map(([name, teams]) => ({ name, teams }));
  if(Array.isArray(raw.ligas)) return raw.ligas.map(normalizeDivisionObject);
  if(Array.isArray(raw.leagues)) return raw.leagues.map(normalizeDivisionObject);
  const known = ['Liga Profesional','Primera Nacional','Federal A'];
  const found = [];
  known.forEach(name => {
    if(raw[name]) found.push({ name, teams:raw[name] });
  });
  if(found.length) return found;
  const dynamic = Object.entries(raw).filter(([, value]) => Array.isArray(value));
  return dynamic.map(([name, teams]) => ({ name, teams }));
}
function normalizeDivisionObject(item, index=0){
  if(Array.isArray(item)) return { name:`División ${index+1}`, teams:item };
  return {
    name:item.nombre || item.name || item.division || item.liga || `División ${index+1}`,
    country:item.country || item.pais || item.countryName || '',
    teams:item.equipos || item.clubes || item.clubs || item.teams || []
  };
}
function normalizeTeamList(list){
  if(!Array.isArray(list)) return [];
  return list.map(item => typeof item === 'string' ? { nombre:item } : (item || {}));
}
function normalizeDivisionName(name){
  const cleaned = String(name || '').trim();
  const lower = cleaned.toLowerCase();
  if(lower.includes('profesional')) return 'Liga Profesional';
  if(lower.includes('nacional')) return 'Primera Nacional';
  if(lower.includes('federal')) return 'Federal A';
  return cleaned || 'Liga';
}
function divisionPrizeMultiplier(name, index=0){
  const lower = String(name || '').toLowerCase();
  if(lower.includes('profesional')) return 1;
  if(lower.includes('nacional')) return 0.30;
  if(lower.includes('federal')) return 0.15;
  return index === 0 ? 1 : index === 1 ? 0.30 : 0.15;
}
function teamName(team){
  return String(team.nombre || team.name || team.club || team.equipo || team.team || '').trim();
}
function teamPrestige(team, divisionName, index, total){
  const explicit = Number(team.prestigio ?? team.prestige ?? team.reputacion ?? team.reputation ?? team.media ?? team.rating);
  if(Number.isFinite(explicit)) return clamp(Math.round(explicit), 20, 99);
  const multiplier = divisionPrizeMultiplier(divisionName);
  const tierBase = multiplier === 1 ? 68 : multiplier === 0.30 ? 52 : 38;
  const tierTop = multiplier === 1 ? 92 : multiplier === 0.30 ? 72 : 58;
  const rankRatio = total > 1 ? 1 - (index / (total - 1)) : 0.5;
  const value = tierBase + (tierTop - tierBase) * rankRatio + hashNumber(`${teamName(team)}-${divisionName}`, 7) - 3;
  return clamp(Math.round(value), 20, 99);
}
function initialFieldScore(club){
  return clamp(60 + hashNumber(`field-start-${club?.name || club?.id || ''}`, 21), 60, 80);
}
function fieldConditionName(score){
  const value = clamp(Math.round(Number(score) || 1), 1, 100);
  if(value >= 90) return 'Excelente';
  if(value >= 60) return 'Normal';
  if(value >= 40) return 'Regular';
  if(value >= 20) return 'Muy malo';
  return 'Injugable';
}
function fieldConditionClass(score){
  const label = fieldConditionName(score);
  return label === 'Excelente' ? 'excellent' : label === 'Normal' ? 'normal' : label === 'Regular' ? 'regular' : label === 'Muy malo' ? 'bad' : 'unplayable';
}
function pitchHeatingDefinition(){
  const fallback = installationsDatabaseFallback().calefaccion_cesped;
  const raw = installationsDatabase?.calefaccion_cesped || fallback;
  return {
    id:String(raw.id || fallback.id),
    name:String(raw.nombre || raw.name || fallback.nombre),
    buildCost:Math.max(0, Math.round(Number(raw.costo_construccion ?? raw.buildCost ?? fallback.costo_construccion))),
    buildDays:Math.max(1, Math.round(Number(raw.dias_construccion ?? raw.buildDays ?? fallback.dias_construccion))),
    dailyCost:Math.max(0, Math.round(Number(raw.costo_diario ?? raw.dailyCost ?? fallback.costo_diario))),
    dailyFieldGain:Math.max(0, Math.round(Number(raw.mejora_campo_diaria ?? raw.dailyFieldGain ?? fallback.mejora_campo_diaria)))
  };
}
function youthTrainingResidencesPerLevel(){
  const fallback = installationsDatabaseFallback().predio_entrenamiento_juvenil;
  const raw = installationsDatabase?.predio_entrenamiento_juvenil || {};
  return Math.max(0, Math.round(Number(raw.residencias_desbloqueadas_por_nivel ?? raw.residencesPerLevel ?? fallback.residencias_desbloqueadas_por_nivel ?? 2)));
}
function youthTrainingGroundLevels(){
  const fallback = installationsDatabaseFallback().predio_entrenamiento_juvenil.niveles;
  const raw = installationsDatabase?.predio_entrenamiento_juvenil?.niveles;
  const perLevel = youthTrainingResidencesPerLevel();
  return (Array.isArray(raw) && raw.length ? raw : fallback).map(item => {
    const level = Math.max(1, Math.round(Number(item.nivel ?? item.level ?? 1)));
    return {
      level,
      name:String(item.nombre || item.name || `Nivel ${level}`),
      cost:Math.max(0, Math.round(Number(item.costo ?? item.cost ?? 0))),
      buildDays:Math.max(1, Math.round(Number(item.dias_construccion ?? item.buildDays ?? 1))),
      exceptionalBonus:Math.max(0, Math.round(Number(item.juveniles_excepcionales_adicionales ?? item.exceptionalBonus ?? 0))),
      maxResidences:Math.max(0, Math.round(Number(item.residencias_maximas ?? item.maxResidences ?? level * perLevel)))
    };
  }).sort((a,b) => a.level - b.level);
}
function youthTrainingGroundLevelDefinition(level){
  return youthTrainingGroundLevels().find(item => Number(item.level) === Number(level)) || null;
}
function createClubFacilitiesState(){
  return { heating:{ built:false, active:false, construction:null } };
}
function normalizeFacilityConstruction(project, extra={}){
  if(!project || typeof project !== 'object') return null;
  const totalDays = Math.max(1, Math.round(Number(project.totalDays || project.days || project.daysLeft || 1)));
  const daysLeft = Math.max(0, Math.round(Number(project.daysLeft || 0)));
  if(daysLeft <= 0) return null;
  return { ...project, ...extra, totalDays, daysLeft };
}
function normalizeClubFacilitiesState(state){
  const base = createClubFacilitiesState();
  const clean = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const heatingRaw = clean.heating && typeof clean.heating === 'object' ? clean.heating : {};
  const heatingBuilt = Boolean(heatingRaw.built);
  const heatingConstruction = heatingBuilt ? null : normalizeFacilityConstruction(heatingRaw.construction);
  const { youthTraining:_legacyYouthTraining, ...clubOnly } = clean;
  return {
    ...base,
    ...clubOnly,
    heating:{ ...base.heating, ...heatingRaw, built:heatingBuilt, active:heatingBuilt && Boolean(heatingRaw.active), construction:heatingConstruction }
  };
}
function clubFacilitiesState(clubId=game?.selectedClubId){
  ensureStadiumState();
  const id = Number(clubId || 0);
  if(!id) return createClubFacilitiesState();
  game.stadium.facilities[id] = normalizeClubFacilitiesState(game.stadium.facilities[id]);
  return game.stadium.facilities[id];
}
function managerAcademyYouthTrainingState(){
  if(typeof managerAcademyFacilitiesState === 'function') return managerAcademyFacilitiesState().youthTraining;
  const raw = game?.academy?.facilities?.youthTraining || {};
  return { level:Math.max(0, Math.round(Number(raw.level || 0))), construction:raw.construction || null };
}
function youthTrainingGroundLevel(){
  return Math.max(0, Math.round(Number(managerAcademyYouthTrainingState()?.level || 0)));
}
function youthTrainingExceptionalBonus(){
  const definition = youthTrainingGroundLevelDefinition(youthTrainingGroundLevel());
  return Math.max(0, Math.round(Number(definition?.exceptionalBonus || 0)));
}
function youthTrainingResidenceLimit(){
  const definition = youthTrainingGroundLevelDefinition(youthTrainingGroundLevel());
  return Math.max(0, Math.round(Number(definition?.maxResidences || 0)));
}
function createInitialStadiumState(){
  const fields = {};
  const ticketPrices = {};
  seed.clubs.forEach(club => {
    fields[club.id] = Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club);
    ticketPrices[club.id] = TICKET_PRICE_INITIAL;
  });
  return { fields, projects:{}, ticketPrices, capacityOverrides:{}, capacityDeteriorationHistory:[], expansionProjects:{}, completedExpansions:{}, capacityRepairProjects:{}, facilities:{}, afaFieldSanctions:{}, botSeasonNumber:0 };
}
function ensureStadiumState(){
  if(!game) return;
  if(!game.stadium) game.stadium = createInitialStadiumState();
  if(!game.stadium.fields) game.stadium.fields = {};
  if(!game.stadium.projects) game.stadium.projects = {};
  if(!game.stadium.ticketPrices) game.stadium.ticketPrices = {};
  if(!game.stadium.capacityOverrides) game.stadium.capacityOverrides = {};
  if(!game.stadium.capacityDeteriorationHistory) game.stadium.capacityDeteriorationHistory = [];
  if(!game.stadium.expansionProjects) game.stadium.expansionProjects = {};
  if(!game.stadium.completedExpansions) game.stadium.completedExpansions = {};
  if(!game.stadium.capacityRepairProjects || typeof game.stadium.capacityRepairProjects !== 'object' || Array.isArray(game.stadium.capacityRepairProjects)) game.stadium.capacityRepairProjects = {};
  if(!game.stadium.facilities || typeof game.stadium.facilities !== 'object' || Array.isArray(game.stadium.facilities)) game.stadium.facilities = {};
  if(!game.stadium.afaFieldSanctions || typeof game.stadium.afaFieldSanctions !== 'object' || Array.isArray(game.stadium.afaFieldSanctions)) game.stadium.afaFieldSanctions = {};
  seed.clubs.forEach(club => {
    if(!Number.isFinite(game.stadium.fields[club.id])) game.stadium.fields[club.id] = Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club);
    if(!Number.isFinite(Number(game.stadium.ticketPrices[club.id]))) game.stadium.ticketPrices[club.id] = TICKET_PRICE_INITIAL;
    game.stadium.ticketPrices[club.id] = clamp(Math.round(Number(game.stadium.ticketPrices[club.id])), TICKET_PRICE_MIN, TICKET_PRICE_MAX);
  });
  repairInvalidBotFieldStates(game, 'ensure_stadium_state', { message:false });
}
function fieldScoreForClub(clubId){
  ensureStadiumState();
  return clamp(Math.round(game?.stadium?.fields?.[clubId] ?? 60), 1, 100);
}
function stadiumProjectForClub(clubId){
  ensureStadiumState();
  if(!game.stadium.projects[clubId]) game.stadium.projects[clubId] = { replantingTurnsLeft:0, patchingTurnsLeft:0 };
  return game.stadium.projects[clubId];
}

function baseStadiumCapacityForClub(clubId){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  if(isFoundedClub(club) && Number.isFinite(Number(club?.stadiumCapacity))) return clamp(Math.round(Number(club.stadiumCapacity)), 0, STADIUM_EXPANSION_MAX_CAPACITY);
  return Math.max(500, Math.round(Number(club?.stadiumCapacity || fallbackStadiumCapacityForClub(club || { id:clubId, reputation:50, divisionOrder:3 }))));
}
function clubStadiumCapacity(clubId){
  ensureStadiumState();
  const founded = isFoundedClubId(clubId);
  const bankruptcy = Boolean(game?.bankruptcyMode && Number(game?.selectedClubId || 0) === Number(clubId || 0));
  const override = Number(game?.stadium?.capacityOverrides?.[clubId]);
  if(Number.isFinite(override) && (override > 0 || founded || bankruptcy)) return clamp(Math.round(override), (founded || bankruptcy) ? 0 : 500, STADIUM_EXPANSION_MAX_CAPACITY);
  return baseStadiumCapacityForClub(clubId);
}
function applyManagedStadiumCapacityDeterioration(clubId, season=game?.seasonNumber || 1){
  if(!game?.stadium || STADIUM_CAPACITY_SEASON_DECAY_PCT <= 0) return null;
  const id = Number(clubId || 0);
  if(!id) return null;
  ensureStadiumState();
  const before = clubStadiumCapacity(id);
  const minCapacity = (isFoundedClubId(id) || Boolean(game?.bankruptcyMode && Number(game?.selectedClubId || 0) === id)) ? 0 : 500;
  if(before <= minCapacity) return null;
  let after = Math.floor(before * (1 - (STADIUM_CAPACITY_SEASON_DECAY_PCT / 100)));
  if(after >= before && before > minCapacity) after = before - 1;
  after = clamp(after, minCapacity, STADIUM_EXPANSION_MAX_CAPACITY);
  if(after === before) return null;
  game.stadium.capacityOverrides[id] = after;
  game.stadium.capacityDeteriorationHistory = Array.isArray(game.stadium.capacityDeteriorationHistory) ? game.stadium.capacityDeteriorationHistory : [];
  const record = { clubId:id, season:Number(season || game.seasonNumber || 1), before, after, lost:before - after, pct:STADIUM_CAPACITY_SEASON_DECAY_PCT, date:game.currentDate || '' };
  game.stadium.capacityDeteriorationHistory.push(record);
  game.stadium.capacityDeteriorationHistory = game.stadium.capacityDeteriorationHistory.slice(-40);
  return record;
}
function stadiumExpansionBaseById(expansionId){
  return (STADIUM_EXPANSIONS || []).find(item => Number(item.id) === Number(expansionId));
}
function stadiumExpansionDurationDays(expansion){
  const baseDays = Math.max(1, Math.round(Number(expansion?.days || 1)));
  return Math.max(1, Math.round(baseDays * STADIUM_EXPANSION_DAYS_MULTIPLIER));
}
function normalizeStadiumExpansionProject(project){
  const expansion = stadiumExpansionBaseById(project?.id);
  const multiplier = Math.max(1, Number(STADIUM_EXPANSION_DAYS_MULTIPLIER || 1));
  const targetTotal = stadiumExpansionDurationDays(expansion || project || { days:project?.totalDays || project?.daysLeft || 1 });
  const currentTotal = Math.max(1, Math.round(Number(project?.totalDays || project?.days || expansion?.days || 1)));
  const currentLeft = Math.max(0, Math.round(Number(project?.daysLeft || 0)));
  const appliedMultiplier = Number(project?.durationMultiplierApplied || 0);
  let totalDays = currentTotal;
  let daysLeft = currentLeft;
  if(appliedMultiplier !== multiplier){
    const remainingRatio = currentLeft > 0 ? clamp(currentLeft / currentTotal, 0, 1) : 0;
    totalDays = targetTotal;
    daysLeft = Math.max(1, Math.ceil(targetTotal * remainingRatio));
  }
  return {
    ...project,
    id:Number(project.id),
    name:project.name || expansion?.name || 'Obra de estadio',
    slot:project.slot || expansion?.slot || 'General',
    capacityGain:Math.round(Number(project.capacityGain ?? expansion?.capacityGain ?? 0)),
    cost:Number(project.cost ?? expansion?.cost ?? 0),
    daysLeft,
    totalDays,
    baseDays:Math.max(1, Math.round(Number(project.baseDays || expansion?.days || currentTotal || 1))),
    durationMultiplierApplied:multiplier
  };
}
function stadiumExpansionProjectsForClub(clubId){
  ensureStadiumState();
  const id = Number(clubId);
  if(!Array.isArray(game.stadium.expansionProjects[id])) game.stadium.expansionProjects[id] = [];
  game.stadium.expansionProjects[id] = game.stadium.expansionProjects[id]
    .filter(project => project && Number(project.daysLeft || 0) > 0)
    .map(project => normalizeStadiumExpansionProject(project));
  return game.stadium.expansionProjects[id];
}
function completedStadiumExpansionsForClub(clubId){
  ensureStadiumState();
  const id = Number(clubId);
  if(!game.stadium.completedExpansions[id] || typeof game.stadium.completedExpansions[id] !== 'object') game.stadium.completedExpansions[id] = {};
  return game.stadium.completedExpansions[id];
}
function completedStadiumExpansionCapacityGain(clubId){
  const completed = completedStadiumExpansionsForClub(clubId);
  return (STADIUM_EXPANSIONS || []).reduce((total, expansion) => completed[expansion.id] ? total + Math.max(0, Math.round(Number(expansion.capacityGain || 0))) : total, 0);
}
function clubStadiumStructuralCapacity(clubId){
  ensureStadiumState();
  const id = Number(clubId || 0);
  const base = baseStadiumCapacityForClub(id);
  const completedCapacity = base + completedStadiumExpansionCapacityGain(id);
  const historyMaximum = (game?.stadium?.capacityDeteriorationHistory || []).reduce((maximum, record) => {
    if(Number(record?.clubId || 0) !== id) return maximum;
    return Math.max(maximum, Math.round(Number(record?.before || 0)), Math.round(Number(record?.after || 0)));
  }, 0);
  return clamp(Math.max(base, completedCapacity, historyMaximum, clubStadiumCapacity(id)), 0, STADIUM_EXPANSION_MAX_CAPACITY);
}
function activeStadiumExpansionProjects(clubId){
  return stadiumExpansionProjectsForClub(clubId).filter(project => Number(project.daysLeft || 0) > 0);
}
function projectedStadiumStructuralCapacity(clubId){
  const activeGain = activeStadiumExpansionProjects(clubId).reduce((total, project) => total + Math.max(0, Math.round(Number(project.capacityGain || 0))), 0);
  return clamp(clubStadiumStructuralCapacity(clubId) + activeGain, 0, STADIUM_EXPANSION_MAX_CAPACITY);
}
function nextOrderedStadiumExpansionForClub(clubId){
  const progressCapacity = projectedStadiumStructuralCapacity(clubId);
  const completed = completedStadiumExpansionsForClub(clubId);
  const activeIds = new Set(activeStadiumExpansionProjects(clubId).map(project => Number(project.id)));
  return (STADIUM_EXPANSIONS || [])
    .slice()
    .sort((a,b) => Number(a.targetCapacity || 0) - Number(b.targetCapacity || 0) || Number(a.id || 0) - Number(b.id || 0))
    .find(expansion => !completed[expansion.id] && !activeIds.has(Number(expansion.id)) && Number(expansion.targetCapacity || 0) > progressCapacity) || null;
}
function activeStadiumCapacityRepairProject(clubId){
  ensureStadiumState();
  const id = Number(clubId || 0);
  const raw = game?.stadium?.capacityRepairProjects?.[id];
  if(!raw || Number(raw.daysLeft || 0) <= 0){
    if(game?.stadium?.capacityRepairProjects) delete game.stadium.capacityRepairProjects[id];
    return null;
  }
  const totalDays = Math.max(1, Math.round(Number(raw.totalDays || raw.daysLeft || 1)));
  const normalized = { ...raw, daysLeft:Math.max(1, Math.round(Number(raw.daysLeft || 1))), totalDays };
  game.stadium.capacityRepairProjects[id] = normalized;
  return normalized;
}
function stadiumCapacityMissingSeats(clubId){
  return Math.max(0, clubStadiumStructuralCapacity(clubId) - clubStadiumCapacity(clubId));
}
function stadiumCapacityRepairReferenceExpansion(clubId){
  const structural = clubStadiumStructuralCapacity(clubId);
  return (STADIUM_EXPANSIONS || []).find(expansion => Number(expansion.targetCapacity || 0) > structural) || (STADIUM_EXPANSIONS || []).slice(-1)[0] || null;
}
function stadiumCapacityRepairQuote(clubId){
  const currentCapacity = clubStadiumCapacity(clubId);
  const targetCapacity = clubStadiumStructuralCapacity(clubId);
  const missingSeats = Math.max(0, targetCapacity - currentCapacity);
  const reference = stadiumCapacityRepairReferenceExpansion(clubId);
  const referenceGain = Math.max(1, Math.round(Number(reference?.capacityGain || 1)));
  const referenceCostPerSeat = Math.max(1, Number(reference?.cost || STADIUM_CAPACITY_REPAIR_MIN_COST) / referenceGain);
  const rawCost = missingSeats * referenceCostPerSeat * STADIUM_CAPACITY_REPAIR_COST_FACTOR;
  const cost = missingSeats > 0 ? Math.max(STADIUM_CAPACITY_REPAIR_MIN_COST, Math.ceil(rawCost / 100000) * 100000) : 0;
  const days = missingSeats > 0 ? clamp(Math.ceil(missingSeats / STADIUM_CAPACITY_REPAIR_SEATS_PER_DAY), STADIUM_CAPACITY_REPAIR_MIN_DAYS, STADIUM_CAPACITY_REPAIR_MAX_DAYS) : 0;
  return { currentCapacity, targetCapacity, missingSeats, cost, days, referenceExpansionId:Number(reference?.id || 0) };
}
function stadiumCapacityRepairStartStatus(clubId){
  const quote = stadiumCapacityRepairQuote(clubId);
  if(activeStadiumCapacityRepairProject(clubId)) return { ok:false, reason:'La reparación del estadio ya está en curso.', quote };
  if(quote.missingSeats <= 0) return { ok:false, reason:'El estadio no tiene capacidad deteriorada para reparar.', quote };
  if(activeStadiumExpansionProjects(clubId).length) return { ok:false, reason:'Finalizá las ampliaciones activas antes de reparar la estructura.', quote };
  if(Number(game?.budget || 0) < quote.cost) return { ok:false, reason:'Presupuesto insuficiente.', quote };
  return { ok:true, reason:'', quote };
}
function startStadiumCapacityRepair(){
  if(!game?.selectedClubId) return;
  ensureStadiumState();
  const clubId = Number(game.selectedClubId);
  const status = stadiumCapacityRepairStartStatus(clubId);
  if(!status.ok){ showNotice(status.reason); return; }
  const quote = status.quote;
  recordBudgetChange(-quote.cost, 'Reparación de capacidad del estadio', { type:'stadium_capacity_repair', missingSeats:quote.missingSeats, targetCapacity:quote.targetCapacity });
  game.stadium.capacityRepairProjects[clubId] = {
    clubId,
    startCapacity:quote.currentCapacity,
    targetCapacity:quote.targetCapacity,
    missingSeats:quote.missingSeats,
    cost:quote.cost,
    daysLeft:quote.days,
    totalDays:quote.days,
    startedAt:game.currentDate || ''
  };
  saveLocal(true);
  showNotice(`Reparación iniciada: ${new Intl.NumberFormat('es-AR').format(quote.missingSeats)} lugares en ${quote.days} día(s).`);
  renderStadium();
}
function maxSimultaneousStadiumWorks(capacity){
  const cap = Math.round(Number(capacity || 0));
  if(cap < 5000) return 2;
  if(cap < 100000) return 3;
  if(cap < 119000) return 2;
  return 1;
}
function stadiumSlotTokens(slot){
  return String(slot || '').split(/[/,+]/).map(s => s.trim()).filter(Boolean);
}
function stadiumSlotsConflict(slotA, slotB){
  const a = stadiumSlotTokens(slotA);
  const b = stadiumSlotTokens(slotB);
  if(a.includes('Integral') || b.includes('Integral')) return true;
  return a.some(token => b.includes(token));
}
function stadiumConstructionAttendancePenalty(clubId){
  const expansionPenalty = activeStadiumExpansionProjects(clubId).length * STADIUM_EXPANSION_ATTENDANCE_PENALTY_PER_PROJECT;
  const repairPenalty = activeStadiumCapacityRepairProject(clubId) ? STADIUM_CAPACITY_REPAIR_ATTENDANCE_PENALTY : 0;
  return clamp(expansionPenalty + repairPenalty, 0, STADIUM_EXPANSION_ATTENDANCE_PENALTY_MAX);
}
function availableStadiumExpansionsForClub(clubId){
  const next = nextOrderedStadiumExpansionForClub(clubId);
  return next ? [next] : [];
}
function stadiumExpansionStartStatus(clubId, expansion){
  const capacity = clubStadiumCapacity(clubId);
  const structuralCapacity = clubStadiumStructuralCapacity(clubId);
  const active = activeStadiumExpansionProjects(clubId);
  const nextOrdered = nextOrderedStadiumExpansionForClub(clubId);
  if(!expansion) return { ok:false, reason:'Obra inválida.' };
  if(activeStadiumCapacityRepairProject(clubId)) return { ok:false, reason:'La reparación estructural debe finalizar antes de iniciar una ampliación.' };
  if(structuralCapacity >= STADIUM_EXPANSION_MAX_CAPACITY) return { ok:false, reason:capacity < structuralCapacity ? 'La estructura llegó al máximo. Repará los lugares deteriorados para recuperar el aforo.' : 'El estadio ya alcanzó el máximo de 120.000.' };
  if(completedStadiumExpansionsForClub(clubId)[expansion.id]) return { ok:false, reason:'Esta obra ya fue realizada.' };
  if(active.some(project => Number(project.id) === Number(expansion.id))) return { ok:false, reason:'Esta obra ya está en construcción.' };
  if(!nextOrdered || Number(nextOrdered.id) !== Number(expansion.id)) return { ok:false, reason:nextOrdered ? `Primero corresponde la obra #${nextOrdered.id}: ${nextOrdered.name}.` : 'No quedan ampliaciones pendientes.' };
  if(active.length >= maxSimultaneousStadiumWorks(structuralCapacity)) return { ok:false, reason:`Máximo ${maxSimultaneousStadiumWorks(structuralCapacity)} obra(s) simultánea(s) para esta etapa.` };
  if(active.some(project => stadiumSlotsConflict(project.slot, expansion.slot))) return { ok:false, reason:'Ya hay una obra activa en ese sector del estadio.' };
  if((game.budget || 0) < Number(expansion.cost || 0)) return { ok:false, reason:'Presupuesto insuficiente.' };
  return { ok:true, reason:'' };
}
function startStadiumExpansion(expansionId){
  if(!game?.selectedClubId) return;
  ensureStadiumState();
  const clubId = Number(game.selectedClubId);
  const expansion = (STADIUM_EXPANSIONS || []).find(item => Number(item.id) === Number(expansionId));
  const status = stadiumExpansionStartStatus(clubId, expansion);
  if(!status.ok){ showNotice(status.reason); return; }
  const durationDays = stadiumExpansionDurationDays(expansion);
  recordBudgetChange(-Number(expansion.cost || 0), `Ampliación estadio: ${expansion.name}`, { type:'stadium_expansion', expansionId:expansion.id, slot:expansion.slot });
  stadiumExpansionProjectsForClub(clubId).push({ id:expansion.id, name:expansion.name, slot:expansion.slot, capacityGain:expansion.capacityGain, cost:expansion.cost, daysLeft:durationDays, totalDays:durationDays, baseDays:expansion.days, durationMultiplierApplied:STADIUM_EXPANSION_DAYS_MULTIPLIER });
  saveLocal(true);
  showNotice(`Obra iniciada: ${expansion.name}. Duración: ${durationDays} día(s).`);
  renderStadium();
}
function processStadiumExpansionDays(days=1){
  if(!game?.stadium) return [];
  ensureStadiumState();
  const elapsed = Math.max(0, Math.round(Number(days || 0)));
  if(elapsed <= 0) return [];
  const completedNow = [];
  Object.entries(game.stadium.expansionProjects).forEach(([clubIdRaw, projects]) => {
    const clubId = Number(clubIdRaw);
    if(!Array.isArray(projects)) return;
    const remaining = [];
    projects.forEach(project => {
      const next = { ...project, daysLeft:Math.max(0, Math.round(Number(project.daysLeft || 0)) - elapsed) };
      if(next.daysLeft <= 0){
        const before = clubStadiumCapacity(clubId);
        const after = clamp(before + Math.round(Number(next.capacityGain || 0)), 500, STADIUM_EXPANSION_MAX_CAPACITY);
        game.stadium.capacityOverrides[clubId] = after;
        completedStadiumExpansionsForClub(clubId)[Number(next.id)] = true;
        completedNow.push({ clubId, project:next, before, after });
      } else remaining.push(next);
    });
    game.stadium.expansionProjects[clubId] = remaining;
  });
  completedNow.forEach(done => {
    if(Number(done.clubId) === Number(game.selectedClubId) && typeof pushGameMessage === 'function'){
      pushGameMessage({ type:'estadio', title:`Obra finalizada: ${done.project.name}`, body:`La capacidad del estadio aumentó de ${new Intl.NumberFormat('es-AR').format(done.before)} a ${new Intl.NumberFormat('es-AR').format(done.after)} espectadores.`, priority:'normal' });
    }
  });
  Object.entries(game.stadium.capacityRepairProjects || {}).forEach(([clubIdRaw, project]) => {
    const clubId = Number(clubIdRaw);
    if(!project || Number(project.daysLeft || 0) <= 0){ delete game.stadium.capacityRepairProjects[clubId]; return; }
    project.daysLeft = Math.max(0, Math.round(Number(project.daysLeft || 0)) - elapsed);
    if(project.daysLeft > 0) return;
    const before = clubStadiumCapacity(clubId);
    const after = clubStadiumStructuralCapacity(clubId);
    game.stadium.capacityOverrides[clubId] = after;
    delete game.stadium.capacityRepairProjects[clubId];
    if(Number(clubId) === Number(game.selectedClubId) && typeof pushGameMessage === 'function'){
      pushGameMessage({ type:'estadio', title:'Reparación del estadio finalizada', body:`Se recuperaron ${new Intl.NumberFormat('es-AR').format(Math.max(0, after - before))} lugares. La capacidad volvió a ${new Intl.NumberFormat('es-AR').format(after)} espectadores.`, priority:'high' });
    }
  });
  return completedNow;
}
function clubStadiumName(clubId){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  return club?.stadiumName || `${club?.name || 'Club'} Stadium`;
}
function clubFansBase(clubId){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  return Math.max(50, Math.round(Number(club?.fansBase || fallbackFanBaseForClub(club || { id:clubId, reputation:50, divisionOrder:3 }, clubStadiumCapacity(clubId)))));
}
function createInitialFanState(){
  const clubs = {};
  seed.clubs.forEach(club => {
    const base = clubFansBase(club.id);
    clubs[club.id] = { base, current:base, lastDelta:0, lastReason:'Base inicial' };
  });
  return { clubs, history:[] };
}
function ensureFanState(targetGame=game){
  if(!targetGame) return;
  targetGame.fans = targetGame.fans && typeof targetGame.fans === 'object' && !Array.isArray(targetGame.fans) ? targetGame.fans : createInitialFanState();
  targetGame.fans.clubs = targetGame.fans.clubs && typeof targetGame.fans.clubs === 'object' && !Array.isArray(targetGame.fans.clubs) ? targetGame.fans.clubs : {};
  targetGame.fans.history = Array.isArray(targetGame.fans.history) ? targetGame.fans.history : [];
  targetGame.fans.memberCampaigns = Array.isArray(targetGame.fans.memberCampaigns) ? targetGame.fans.memberCampaigns : [];
  targetGame.fans.memberCampaignHistory = Array.isArray(targetGame.fans.memberCampaignHistory) ? targetGame.fans.memberCampaignHistory : [];
  seed.clubs.forEach(club => {
    const base = clubFansBase(club.id);
    const row = targetGame.fans.clubs[club.id] || {};
    const current = Number.isFinite(Number(row.current)) ? Math.max(0, Math.round(Number(row.current))) : base;
    targetGame.fans.clubs[club.id] = { base:Number.isFinite(Number(row.base)) ? Math.round(Number(row.base)) : base, current, lastDelta:Math.round(Number(row.lastDelta || 0)), lastReason:row.lastReason || '' };
  });
}
function clubFansCurrent(clubId){
  ensureFanState();
  return Math.max(0, Math.round(Number(game?.fans?.clubs?.[clubId]?.current || clubFansBase(clubId))));
}
function setClubFansCurrent(clubId, value, reason=''){
  ensureFanState();
  const id = Number(clubId);
  const previous = clubFansCurrent(id);
  const current = Math.max(0, Math.round(Number(value || 0)));
  const row = game.fans.clubs[id] || { base:clubFansBase(id) };
  game.fans.clubs[id] = { ...row, current, lastDelta:current - previous, lastReason:String(reason || '') };
  return current - previous;
}
function addHiddenMemberCampaignFans(clubId, amount, campaign=null){
  ensureFanState();
  const id = Number(clubId);
  const delta = Math.max(0, Math.round(Number(amount || 0)));
  if(delta <= 0) return 0;
  const previous = clubFansCurrent(id);
  const row = game.fans.clubs[id] || { base:clubFansBase(id) };
  game.fans.clubs[id] = { ...row, current:previous + delta };
  game.fans.memberCampaignHistory.push({
    season:game.seasonNumber || 1,
    date:game.currentDate || '',
    clubId:id,
    campaignId:campaign?.templateId || campaign?.id || '',
    campaignName:campaign?.name || '',
    delta,
    current:previous + delta
  });
  game.fans.memberCampaignHistory = game.fans.memberCampaignHistory.slice(-365);
  return delta;
}
function activeMemberCampaignsForClub(clubId=game?.selectedClubId){
  ensureFanState();
  const id = Number(clubId || 0);
  return (game.fans.memberCampaigns || []).filter(campaign => Number(campaign.clubId || 0) === id && Number(campaign.daysLeft || 0) > 0);
}
function startMemberCampaign(campaignId){
  if(!game?.selectedClubId) return;
  ensureFanState();
  const template = (STADIUM_MEMBER_CAMPAIGNS || []).find(item => String(item.id) === String(campaignId));
  if(!template){ showNotice('Campaña inválida.'); return; }
  const alreadyActive = activeMemberCampaignsForClub(game.selectedClubId).some(campaign => String(campaign.templateId || '') === String(template.id));
  if(alreadyActive){ showNotice('Esa campaña ya está activa. Esperá a que termine para volver a iniciarla.'); return; }
  if((game.budget || 0) < Number(template.cost || 0)){ showNotice('Presupuesto insuficiente para iniciar esta campaña.'); return; }
  const campaign = {
    id:`member-campaign-${game.seasonNumber || 1}-${currentTurnIndex()}-${template.id}-${Math.floor(Math.random() * 100000)}`,
    templateId:template.id,
    name:template.name,
    clubId:Number(game.selectedClubId),
    investment:Math.round(Number(template.cost || 0)),
    durationDays:Math.round(Number(template.durationDays || 1)),
    daysLeft:Math.round(Number(template.durationDays || 1)),
    dailyMembersMin:Math.round(Number(template.dailyMembersMin || 0)),
    dailyMembersMax:Math.round(Number(template.dailyMembersMax || template.dailyMembersMin || 0)),
    startedDate:game.currentDate || '',
    startedTurn:currentTurnIndex(),
    totalHiddenMembers:0
  };
  recordBudgetChange(-campaign.investment, `Campaña de socios: ${campaign.name}`, { type:'member_campaign', campaignId:campaign.id, templateId:campaign.templateId });
  game.fans.memberCampaigns.push(campaign);
  saveLocal(true);
  showNotice(`Campaña iniciada. Inversión: ${formatMoney(campaign.investment)}. Duración: ${formatDays(campaign.durationDays)}.`);
  if(typeof renderStadium === 'function') renderStadium();
}
function processMemberCampaigns(days=1){
  ensureFanState();
  const elapsed = Math.max(0, Math.round(Number(days || 0)));
  if(elapsed <= 0 || !game.fans.memberCampaigns.length) return { added:0, finished:0 };
  let totalAdded = 0;
  const remaining = [];
  const finished = [];
  game.fans.memberCampaigns.forEach(raw => {
    const campaign = { ...raw };
    let daysLeft = Math.max(0, Math.round(Number(campaign.daysLeft || 0)));
    const daysToProcess = Math.min(daysLeft, elapsed);
    for(let day=0; day<daysToProcess; day += 1){
      const min = Math.max(0, Math.round(Number(campaign.dailyMembersMin || 0)));
      const max = Math.max(min, Math.round(Number(campaign.dailyMembersMax || min)));
      const gained = rnd(min, max);
      totalAdded += addHiddenMemberCampaignFans(campaign.clubId, gained, campaign);
      campaign.totalHiddenMembers = Math.round(Number(campaign.totalHiddenMembers || 0) + gained);
    }
    daysLeft = Math.max(0, daysLeft - daysToProcess);
    campaign.daysLeft = daysLeft;
    if(daysLeft > 0) remaining.push(campaign);
    else finished.push(campaign);
  });
  game.fans.memberCampaigns = remaining;
  finished.forEach(campaign => {
    if(Number(campaign.clubId) === Number(game.selectedClubId) && typeof pushGameMessage === 'function'){
      pushGameMessage({ type:'estadio', title:'Campaña de socios finalizada', body:`Finalizó la campaña con inversión de ${formatMoney(campaign.investment)} y duración de ${formatDays(campaign.durationDays)}.`, priority:'normal' });
    }
  });
  return { added:totalAdded, finished:finished.length };
}
function ticketPriceForClub(clubId){
  ensureStadiumState();
  return clamp(Math.round(Number(game?.stadium?.ticketPrices?.[clubId] ?? TICKET_PRICE_INITIAL)), TICKET_PRICE_MIN, TICKET_PRICE_MAX);
}
function setTicketPriceForClub(clubId, value){
  ensureStadiumState();
  const price = clamp(Math.round(Number(value || TICKET_PRICE_INITIAL)), TICKET_PRICE_MIN, TICKET_PRICE_MAX);
  game.stadium.ticketPrices[clubId] = price;
  return price;
}
function roundTicketPrice(value){
  const step = Math.max(1, Number(BOT_TICKET_ROUNDING || 1));
  return clamp(Math.round(Number(value || TICKET_PRICE_INITIAL) / step) * step, TICKET_PRICE_MIN, TICKET_PRICE_MAX);
}
function botTicketMultiplierForRivalPrestige(prestige){
  const value = clamp(Math.round(Number(prestige || 0)), 0, 99);
  if(value <= BOT_TICKET_LOW_PRESTIGE_MAX) return 1;
  if(value <= BOT_TICKET_MEDIUM_PRESTIGE_MAX){
    const start = BOT_TICKET_LOW_PRESTIGE_MAX + 1;
    const span = Math.max(1, BOT_TICKET_MEDIUM_PRESTIGE_MAX - start);
    const progress = clamp((value - start) / span, 0, 1);
    return BOT_TICKET_MEDIUM_MULTIPLIER_MIN + ((BOT_TICKET_MEDIUM_MULTIPLIER_MAX - BOT_TICKET_MEDIUM_MULTIPLIER_MIN) * progress);
  }
  const start = BOT_TICKET_MEDIUM_PRESTIGE_MAX + 1;
  const span = Math.max(1, 99 - start);
  const progress = clamp((value - start) / span, 0, 1);
  return BOT_TICKET_HIGH_MULTIPLIER_MIN + ((BOT_TICKET_HIGH_MULTIPLIER_MAX - BOT_TICKET_HIGH_MULTIPLIER_MIN) * progress);
}
function ticketPriceInfoForMatch(match, rivalPrestige=0){
  const homeId = Number(match?.homeId || 0);
  const manualPrice = ticketPriceForClub(homeId);
  const isManagerClub = Number(game?.selectedClubId || 0) === homeId;
  if(isManagerClub || !BOT_TICKET_DYNAMIC_ENABLED){
    return { price:manualPrice, basePrice:manualPrice, multiplier:1, isAutomaticBot:false, prestigeTier:'manual' };
  }
  const multiplier = botTicketMultiplierForRivalPrestige(rivalPrestige);
  const price = roundTicketPrice(TICKET_PRICE_INITIAL * multiplier);
  const tier = Number(rivalPrestige || 0) <= BOT_TICKET_LOW_PRESTIGE_MAX ? 'bajo' : (Number(rivalPrestige || 0) <= BOT_TICKET_MEDIUM_PRESTIGE_MAX ? 'medio' : 'alto');
  return { price, basePrice:TICKET_PRICE_INITIAL, multiplier:Number(multiplier.toFixed(2)), isAutomaticBot:true, prestigeTier:tier };
}
function ticketLossShieldRate(price){
  const neutral = clamp(Number(TICKET_PRICE_INITIAL || TICKET_PRICE_MIN), TICKET_PRICE_MIN, TICKET_PRICE_MAX);
  if(Number(price || neutral) >= neutral || neutral <= TICKET_PRICE_MIN) return 0;
  const progress = clamp((neutral - Number(price || neutral)) / Math.max(1, neutral - TICKET_PRICE_MIN), 0, 1);
  return progress * FAN_CHEAP_TICKET_LOSS_SHIELD_MAX;
}
function ticketGainBlockRate(price){
  const neutral = clamp(Number(TICKET_PRICE_INITIAL || TICKET_PRICE_MIN), TICKET_PRICE_MIN, TICKET_PRICE_MAX);
  if(Number(price || neutral) <= neutral || TICKET_PRICE_MAX <= neutral) return 0;
  const progress = clamp((Number(price || neutral) - neutral) / Math.max(1, TICKET_PRICE_MAX - neutral), 0, 1);
  return progress * FAN_EXPENSIVE_TICKET_GAIN_BLOCK_MAX;
}
function awayFansMinimumRateForMatch(match){
  const range = Math.max(0, AWAY_FANS_MAX_RATE - AWAY_FANS_MIN_RATE);
  const pct = AWAY_FANS_MIN_RATE + (hashNumber(`${match?.id || ''}-away-section`, 1000) / 999) * range;
  return clamp(pct, 0, AWAY_FANS_MAX_WITH_LOCAL_SHORTAGE);
}
function rivalPrestigeAttendanceBonusInfo(rivalClubId){
  const prestige = typeof clubPrestigeValue === 'function'
    ? clubPrestigeValue(rivalClubId)
    : clamp(Math.round(Number(seed?.clubs?.find(c => Number(c.id) === Number(rivalClubId))?.reputation || 0)), 1, 99);
  const span = Math.max(1, 99 - Number(RIVAL_PRESTIGE_ATTENDANCE_START || 0));
  const progress = clamp((prestige - Number(RIVAL_PRESTIGE_ATTENDANCE_START || 0)) / span, 0, 1);
  const rate = clamp(progress * Number(RIVAL_PRESTIGE_ATTENDANCE_MAX_RATE || 0), 0, 2);
  return { prestige, rate, pct:Math.round(rate * 100) };
}
function neutralTournamentAttendanceContext(match){
  ensureFanState();
  const capacity = Math.max(0, Math.round(Number(match?.stadiumCapacity || 0)));
  const homeDemand = Math.max(0, clubFansCurrent(match?.homeId));
  const awayDemand = Math.max(0, clubFansCurrent(match?.awayId));
  const totalDemand = homeDemand + awayDemand;
  const totalFans = Math.min(capacity, totalDemand);
  let homeFans = 0;
  let awayFans = 0;
  if(totalDemand > 0 && totalFans > 0){
    homeFans = Math.round(totalFans * (homeDemand / totalDemand));
    awayFans = Math.max(0, totalFans - homeFans);
  }
  const isClubWorldCup = Boolean(match?.clubWorldCup);
  const ticketPrice = isClubWorldCup
    ? Math.max(0, Math.round(Number(String(match?.clubWorldCupStage || '') === 'final' ? CLUB_WORLD_CUP_CONFIG?.finalTicketPrice : CLUB_WORLD_CUP_CONFIG?.ticketPrice) || 0))
    : 0;
  const ticketRevenue = Math.max(0, Math.round(totalFans * ticketPrice));
  return {
    stadiumName:String(match?.stadiumName || 'Sede neutral'),
    capacity,
    nominalCapacity:capacity,
    constructionPenalty:0,
    homeFans,
    awayFans,
    totalFans,
    awayReservedMinimum:0,
    awaySectionRate:totalFans > 0 ? Number(((awayFans / totalFans) * 100).toFixed(1)) : 0,
    awayMax:capacity,
    homeCrowdBonus:0,
    ticketPrice,
    ticketBasePrice:ticketPrice,
    ticketPriceMultiplier:1,
    ticketPriceAutoBot:false,
    ticketPricePrestigeTier:'neutral',
    ticketRevenue,
    ticketRevenueBeforeMarketing:ticketRevenue,
    marketingRevenueBonus:0,
    marketingBonusPct:0,
    homeDemandBase:homeDemand,
    awayDemandBase:awayDemand,
    homeDemand,
    homeDemandBeforeMarketing:homeDemand,
    awayDemand,
    rivalPrestige:Number(typeof clubPrestigeValue === 'function' ? clubPrestigeValue(match?.awayId) : 0),
    rivalPrestigeAttendanceBonusRate:0,
    rivalPrestigeAttendanceBonusPct:0,
    neutral:true,
    clubWorldCup:Boolean(match?.clubWorldCup)
  };
}
function attendanceContextForMatch(match){
  ensureFanState();
  ensureStadiumState();
  if(match?.clubWorldCup || (match?.neutral && Number(match?.stadiumCapacity || 0) > 0)) return neutralTournamentAttendanceContext(match);
  const nominalCapacity = clubStadiumCapacity(match.homeId);
  const constructionPenalty = stadiumConstructionAttendancePenalty(match.homeId);
  const capacity = Math.max(0, Math.floor(nominalCapacity * (1 - constructionPenalty)));
  const homeDemandBase = clubFansCurrent(match.homeId);
  const awayDemandBase = clubFansCurrent(match.awayId);
  const rivalPrestigeBonus = rivalPrestigeAttendanceBonusInfo(match.awayId);
  const marketingBonusPct = Number(match.homeId || 0) === Number(game?.selectedClubId || 0) && typeof specialActiveBonus === 'function'
    ? Math.max(0, Number(specialActiveBonus('director_marketing') || 0))
    : 0;
  const homeDemandBeforeMarketing = Math.round(homeDemandBase * (1 + rivalPrestigeBonus.rate));
  const homeDemand = Math.round(homeDemandBeforeMarketing * (1 + (marketingBonusPct / 100)));
  const awayDemand = Math.round(awayDemandBase * (1 + (rivalPrestigeBonus.rate * RIVAL_PRESTIGE_AWAY_DEMAND_SHARE)));
  const awayMinRate = awayFansMinimumRateForMatch(match);
  const awayReservedMinimum = Math.round(capacity * awayMinRate);
  const awayMax = Math.round(capacity * AWAY_FANS_MAX_WITH_LOCAL_SHORTAGE);
  const awayBase = Math.min(awayDemand, awayReservedMinimum);
  const homeAfterMinimum = Math.min(homeDemand, Math.max(0, capacity - awayReservedMinimum));
  const emptyAfterHome = Math.max(0, capacity - awayReservedMinimum - homeAfterMinimum);
  const awayExtra = Math.min(Math.max(0, awayDemand - awayBase), emptyAfterHome, Math.max(0, awayMax - awayBase));
  const awayFans = Math.max(0, Math.round(awayBase + awayExtra));
  const homeFans = Math.max(0, Math.round(Math.min(homeDemand, Math.max(0, capacity - Math.max(awayReservedMinimum, awayFans)))));
  const totalFans = Math.min(capacity, homeFans + awayFans);
  const ratioBonus = awayFans > 0 ? Math.floor(homeFans / Math.max(1, awayFans)) : HOME_CROWD_BONUS_MAX;
  const diffBonus = Math.floor(Math.max(0, homeFans - awayFans) / HOME_CROWD_FANS_PER_BONUS_POINT);
  const homeCrowdBonus = clamp(Math.max(ratioBonus, diffBonus), 0, HOME_CROWD_BONUS_MAX);
  const ticketPriceInfo = ticketPriceInfoForMatch(match, rivalPrestigeBonus.prestige);
  const ticketPrice = ticketPriceInfo.price;
  const ticketRevenueBeforeMarketing = Math.round(totalFans * ticketPrice);
  const ticketRevenue = Math.round(ticketRevenueBeforeMarketing * (1 + (marketingBonusPct / 100)));
  const marketingRevenueBonus = Math.max(0, ticketRevenue - ticketRevenueBeforeMarketing);
  return {
    stadiumName:clubStadiumName(match.homeId),
    capacity,
    nominalCapacity,
    constructionPenalty:Number((constructionPenalty * 100).toFixed(1)),
    homeFans,
    awayFans,
    totalFans,
    awayReservedMinimum,
    awaySectionRate:Number((awayMinRate * 100).toFixed(1)),
    awayMax,
    homeCrowdBonus,
    ticketPrice,
    ticketBasePrice:Number(ticketPriceInfo.basePrice || ticketPrice),
    ticketPriceMultiplier:Number(ticketPriceInfo.multiplier || 1),
    ticketPriceAutoBot:Boolean(ticketPriceInfo.isAutomaticBot),
    ticketPricePrestigeTier:ticketPriceInfo.prestigeTier || '',
    ticketRevenue,
    ticketRevenueBeforeMarketing,
    marketingRevenueBonus,
    marketingBonusPct:Number(marketingBonusPct || 0),
    homeDemandBase,
    awayDemandBase,
    homeDemand,
    homeDemandBeforeMarketing,
    awayDemand,
    rivalPrestige:Number(rivalPrestigeBonus.prestige || 0),
    rivalPrestigeAttendanceBonusRate:Number(rivalPrestigeBonus.rate || 0),
    rivalPrestigeAttendanceBonusPct:Number(rivalPrestigeBonus.pct || 0)
  };
}
function fanGrowthMass(current, base){
  const safeCurrent = Math.max(0, Number(current || 0));
  const safeBase = Math.max(0, Number(base || 0));
  return Math.max(1,
    FAN_GROWTH_MASS_BASE
    + (FAN_GROWTH_CURRENT_SQRT_FACTOR * Math.sqrt(safeCurrent))
    + (FAN_GROWTH_BASE_SQRT_FACTOR * Math.sqrt(safeBase))
  );
}
function fanResultFactor(resultKey){
  if(resultKey === 'win') return FAN_RESULT_WIN_FACTOR;
  if(resultKey === 'loss') return FAN_RESULT_LOSS_FACTOR;
  return FAN_RESULT_DRAW_FACTOR;
}
function fanTableFactorForPosition(position){
  const safePosition = Math.max(1, Math.round(Number(position || 1)));
  const row = FAN_POSITION_FACTORS.find(item => safePosition >= item.from && safePosition <= item.to);
  if(row) return Number(row.factor || 0);
  if(safePosition > 18) return -0.45;
  return 0;
}
function clubPositionInStandings(clubId){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  const divisionId = club?.divisionId || 'default';
  const list = typeof sortedStandings === 'function' ? sortedStandings(divisionId) : [];
  const index = list.findIndex(row => Number(row.clubId) === Number(clubId));
  return index >= 0 ? index + 1 : 10;
}
function fanRivalPrestigeMultiplier(clubId, rivalClubId, resultKey){
  if(!rivalClubId || !['win','loss'].includes(resultKey)) return 1;
  const ownPrestige = typeof clubPrestigeValue === 'function'
    ? Number(clubPrestigeValue(clubId) || 0)
    : Number(seed?.clubs?.find(c => Number(c.id) === Number(clubId))?.reputation || 0);
  const rivalPrestige = typeof clubPrestigeValue === 'function'
    ? Number(clubPrestigeValue(rivalClubId) || 0)
    : Number(seed?.clubs?.find(c => Number(c.id) === Number(rivalClubId))?.reputation || 0);
  const difference = clamp(rivalPrestige - ownPrestige, -FAN_RIVAL_PRESTIGE_MAX_DIFF, FAN_RIVAL_PRESTIGE_MAX_DIFF);
  const progress = clamp(Math.abs(difference) / FAN_RIVAL_PRESTIGE_MAX_DIFF, 0, 1);
  if(resultKey === 'win'){
    if(difference > 0) return 1 + (progress * FAN_RIVAL_WIN_BONUS_MAX);
    if(difference < 0) return 1 - (progress * FAN_RIVAL_WIN_LOWER_PENALTY_MAX);
  }
  if(resultKey === 'loss'){
    if(difference > 0) return 1 - (progress * FAN_RIVAL_LOSS_SHIELD_MAX);
    if(difference < 0) return 1 + (progress * FAN_RIVAL_LOSS_LOWER_PENALTY_MAX);
  }
  return 1;
}
function applyFanChangeForClub(clubId, resultKey, rivalClubId=null){
  ensureFanState();
  const current = clubFansCurrent(clubId);
  const base = Math.max(0, Math.round(Number(game?.fans?.clubs?.[clubId]?.base ?? clubFansBase(clubId))));
  const price = ticketPriceForClub(clubId);
  const position = clubPositionInStandings(clubId);
  const mass = fanGrowthMass(current, base);
  const resultFactor = fanResultFactor(resultKey);
  const positionFactor = fanTableFactorForPosition(position);
  let totalDelta = mass * (resultFactor + positionFactor);

  if((resultKey === 'win' && totalDelta > 0) || (resultKey === 'loss' && totalDelta < 0)){
    totalDelta *= fanRivalPrestigeMultiplier(clubId, rivalClubId, resultKey);
  }

  if(totalDelta < 0){
    totalDelta *= (1 - ticketLossShieldRate(price));
    const maxLoss = Math.max(FAN_MAX_LOSS_MINIMUM, current * FAN_MAX_LOSS_CURRENT_RATE);
    totalDelta = Math.max(totalDelta, -maxLoss);
  } else if(totalDelta > 0){
    totalDelta *= (1 - ticketGainBlockRate(price));
    if(Number(clubId) === Number(game?.selectedClubId || 0) && typeof specialActiveBonus === 'function'){
      const sociosBonus = Number(specialActiveBonus('socios_extra') || 0) + Number(specialActiveBonus('idolo_club') || 0);
      if(sociosBonus > 0) totalDelta *= (1 + sociosBonus / 100);
    }
  }

  const rounded = Math.round(totalDelta);
  const applied = setClubFansCurrent(clubId, Math.max(0, current + rounded), `Resultado ${resultKey}. Posición ${position}. Entrada ${formatMoney(price)}.`);
  game.fans.history.push({
    season:game.seasonNumber || 1,
    matchday:game.matchdayIndex || 0,
    date:game.currentDate || '',
    clubId:Number(clubId),
    rivalClubId:Number(rivalClubId || 0),
    result:resultKey,
    position,
    ticketPrice:price,
    growthMass:Number(mass.toFixed(3)),
    resultFactor,
    positionFactor,
    delta:applied,
    current:clubFansCurrent(clubId)
  });
  game.fans.history = game.fans.history.slice(-240);
  return applied;
}

function applyFanChangesAfterMatches(results=[]){
  ensureFanState();
  (results || []).forEach(match => {
    const homeResult = match.homeGoals > match.awayGoals ? 'win' : match.homeGoals < match.awayGoals ? 'loss' : 'draw';
    const awayResult = match.awayGoals > match.homeGoals ? 'win' : match.awayGoals < match.homeGoals ? 'loss' : 'draw';
    applyFanChangeForClub(match.homeId, homeResult, match.awayId);
    applyFanChangeForClub(match.awayId, awayResult, match.homeId);
  });
}

function isManagedClubField(clubId, managedClubId=null){
  return Number(clubId) === Number(managedClubId || game?.selectedClubId || 0);
}
function botFieldRecoveryScoreForClub(club, state=game){
  const season = Number(state?.seasonNumber || game?.seasonNumber || 1);
  const reputation = clamp(Number(club?.reputation || 60), 1, 100);
  const divisionBonus = Math.max(0, 4 - Number(club?.divisionOrder || 1)) * 2;
  const noise = hashNumber(`bot-field-repair-${club?.id || club?.name || ''}-${season}`, 11) - 5;
  return clamp(Math.round(BOT_FIELD_INITIAL_BASE + (reputation - 50) * 0.30 + divisionBonus + noise), BOT_FIELD_MIN_SCORE, BOT_FIELD_MAX_SCORE);
}
function botFieldAudit(state=game){
  const fields = state?.stadium?.fields || {};
  const selectedClubId = Number(state?.selectedClubId || 0);
  const bots = seed.clubs.filter(club => Number(club.id) !== selectedClubId);
  const invalid = [];
  const unplayable = [];
  bots.forEach(club => {
    const raw = Number(fields[club.id]);
    const score = Number.isFinite(raw) ? Math.round(raw) : NaN;
    if(!Number.isFinite(score) || score < BOT_FIELD_MIN_SCORE || score <= BOT_FIELD_INVALID_THRESHOLD) invalid.push({ club, score });
    if(!Number.isFinite(score) || score < 20) unplayable.push({ club, score });
  });
  const massUnplayable = bots.length > 0 && (unplayable.length / bots.length) >= BOT_FIELD_MASS_REPAIR_RATIO;
  return { bots:bots.length, invalid:invalid.length, unplayable:unplayable.length, massUnplayable, invalidItems:invalid, unplayableItems:unplayable };
}
function addBotFieldRepairMessage(targetGame, summary, reason){
  if(!targetGame || !summary?.repaired) return;
  targetGame.messages = Array.isArray(targetGame.messages) ? targetGame.messages : [];
  const key = `bot-field-repair-${targetGame.seasonNumber || 1}-${reason}-${summary.repaired}`;
  if(targetGame.messages.some(msg => msg.id === key)) return;
  targetGame.messages.unshift({
    id:key,
    turn:targetGame.matchdayIndex || 0,
    season:targetGame.seasonNumber || 1,
    date:targetGame.currentDate || '',
    read:false,
    priority:'normal',
    type:'federación',
    title:summary.repaired === 1 ? 'Un estadio recibió tareas de emergencia' : 'La liga reacondicionó varios campos',
    body:summary.repaired === 1
      ? `La federación informó que un campo de juego no reunía condiciones para competir y ordenó tareas de emergencia. El césped quedó habilitado con un estado estimado entre ${BOT_FIELD_MIN_SCORE}/100 y ${BOT_FIELD_MAX_SCORE}/100.`
      : `La federación inspeccionó ${summary.detected} campos de juego y ordenó trabajos de emergencia en ${summary.repaired}. Los estadios quedaron habilitados con estados estimados entre ${BOT_FIELD_MIN_SCORE}/100 y ${BOT_FIELD_MAX_SCORE}/100.`,
    action:null,
    createdAt:Date.now()
  });
}
function repairInvalidBotFieldStates(targetGame=game, reason='stadium_check', options={}){
  if(!BOT_FIELDS_FIXED_BY_SEASON || !BOT_FIELD_AUTO_REPAIR_ENABLED || !targetGame?.stadium) return { repaired:0, detected:0, unplayable:0, massUnplayable:false };
  targetGame.stadium.fields = targetGame.stadium.fields || {};
  targetGame.stadium.projects = targetGame.stadium.projects || {};
  const audit = botFieldAudit(targetGame);
  const repairAllBots = audit.massUnplayable;
  const selectedClubId = Number(targetGame.selectedClubId || 0);
  const candidates = repairAllBots
    ? seed.clubs.filter(club => Number(club.id) !== selectedClubId)
    : audit.invalidItems.map(item => item.club);
  let repaired = 0;
  candidates.forEach(club => {
    if(!club || Number(club.id) === selectedClubId) return;
    const nextScore = botFieldRecoveryScoreForClub(club, targetGame);
    targetGame.stadium.fields[club.id] = nextScore;
    targetGame.stadium.projects[club.id] = { replantingTurnsLeft:0, patchingTurnsLeft:0 };
    repaired += 1;
  });
  if(repaired){
    targetGame.stadium.lastBotFieldAutoRepair = {
      season:targetGame.seasonNumber || 1,
      reason,
      repaired,
      detected:audit.invalid,
      unplayable:audit.unplayable,
      massUnplayable:audit.massUnplayable,
      createdAt:Date.now()
    };
    targetGame._needsAutosave = true;
    targetGame._stadiumFieldsAutoRepaired = true;
    if(options.message !== false) addBotFieldRepairMessage(targetGame, targetGame.stadium.lastBotFieldAutoRepair, reason);
  }
  return { repaired, detected:audit.invalid, unplayable:audit.unplayable, massUnplayable:audit.massUnplayable };
}
function initialBotSeasonFieldScore(club){
  const reputation = clamp(Number(club?.reputation || 60), 1, 100);
  const divisionBonus = Math.max(0, 4 - Number(club?.divisionOrder || 1)) * 2;
  const noise = hashNumber(`bot-field-initial-${club?.id || club?.name || ''}-${game?.seasonNumber || 1}`, 9) - 4;
  return clamp(Math.round(BOT_FIELD_INITIAL_BASE + (reputation - 50) * 0.25 + divisionBonus + noise), BOT_FIELD_MIN_SCORE, BOT_FIELD_MAX_SCORE);
}
function finalPositionBotFieldScore(clubId){
  const club = seed.clubs.find(c => Number(c.id) === Number(clubId));
  if(!club) return 60;
  const table = typeof sortedStandings === 'function' ? sortedStandings(club.divisionId || null) : [];
  const index = table.findIndex(row => Number(row.clubId) === Number(clubId));
  if(index < 0 || !table.length) return initialBotSeasonFieldScore(club);
  const normalizedPosition = table.length <= 1 ? 0.5 : 1 - (index / (table.length - 1));
  const divisionBonus = Math.max(0, 4 - Number(club.divisionOrder || 1)) * 2;
  const noise = hashNumber(`bot-field-next-${game?.seasonNumber || 1}-${clubId}`, 7) - 3;
  const score = BOT_FIELD_MIN_SCORE + normalizedPosition * BOT_FIELD_POSITION_RANGE + divisionBonus + noise;
  return clamp(Math.round(score), BOT_FIELD_MIN_SCORE, BOT_FIELD_MAX_SCORE);
}
function assignInitialBotFieldStates(managedClubId){
  if(!BOT_FIELDS_FIXED_BY_SEASON || !game?.stadium) return;
  ensureStadiumState();
  seed.clubs.forEach(club => {
    if(isManagedClubField(club.id, managedClubId)) return;
    game.stadium.fields[club.id] = initialBotSeasonFieldScore(club);
    game.stadium.projects[club.id] = { replantingTurnsLeft:0, patchingTurnsLeft:0 };
  });
  game.stadium.botSeasonNumber = Number(game.seasonNumber || 1);
}
function assignBotFieldStatesForNextSeason(nextManagedClubId, previousManagedClubId=null){
  if(!BOT_FIELDS_FIXED_BY_SEASON || !game?.stadium) return;
  ensureStadiumState();
  const nextManaged = Number(nextManagedClubId || game.selectedClubId || 0);
  const previousManaged = Number(previousManagedClubId || game.selectedClubId || 0);
  seed.clubs.forEach(club => {
    const clubId = Number(club.id);
    const sameManagedClubContinues = clubId === nextManaged && clubId === previousManaged;
    if(sameManagedClubContinues) return;
    game.stadium.fields[clubId] = finalPositionBotFieldScore(clubId);
    if(clubId !== nextManaged) game.stadium.projects[clubId] = { replantingTurnsLeft:0, patchingTurnsLeft:0 };
  });
  game.stadium.botSeasonNumber = Number(game.seasonNumber || 1) + 1;
}
function fieldBar(score, label=''){
  const value = clamp(Math.round(score), 1, 100);
  return `<div class="field-bar ${fieldConditionClass(value)}" title="${escapeHtml(label || fieldConditionName(value))} ${value}/100"><span style="width:${value}%"></span><em>${value}/100</em></div>`;
}
function matchFieldSummaryMarkup(match){
  if(!match) return '';
  const score = fieldScoreForClub(match.homeId);
  const label = fieldConditionName(score);
  return `<div class="next-match-field ${fieldConditionClass(score)}">
    <div class="next-match-field-head"><span>Campo de juego</span><strong class="field-state ${fieldConditionClass(score)}">${escapeHtml(label)}</strong></div>
    ${fieldBar(score, label)}
  </div>`;
}
function clubBudgetByPrestige(prestige){
  const rep = clamp(Number(prestige) || 50, 1, 99);
  // presupuesto inicial calibrado principalmente por prestigio.
  // Anclas de diseño: 20 => $4.500.000, 80 => $100.000.000, 95 => $800.000.000.
  const lowAnchorPrestige = 20;
  const midAnchorPrestige = 80;
  const highAnchorPrestige = 95;
  const lowAnchorBudget = 4500000;
  const midAnchorBudget = 100000000;
  const highAnchorBudget = 800000000;
  const lowCurve = lowAnchorBudget * Math.pow(midAnchorBudget / lowAnchorBudget, (rep - lowAnchorPrestige) / (midAnchorPrestige - lowAnchorPrestige));
  const highCurve = midAnchorBudget * Math.pow(highAnchorBudget / midAnchorBudget, (rep - midAnchorPrestige) / (highAnchorPrestige - midAnchorPrestige));
  const raw = rep <= midAnchorPrestige ? lowCurve : highCurve;
  return Math.max(1000000, Math.round(raw / 100000) * 100000);
}
function clubShortFromName(name){
  const words = String(name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean);
  if(words.length >= 3) return words.slice(0,3).map(w=>w[0]).join('').toUpperCase();
  if(words.length === 2) return (words[0].slice(0,2) + words[1][0]).toUpperCase();
  return (words[0] || 'CLU').slice(0,3).toUpperCase();
}
function imageSlug(name){
  return String(name || '').trim().replace(/\s+/g,'_');
}
function slugId(name){
  return String(name || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'division';
}
function deterministicColor(name){
  const hue = hashNumber(name, 360);
  return `hsl(${hue} 70% 42%)`;
}
function seedSignature(data){
  const raw = `${(data.clubs || []).map(c=>c.name).join('|')}::${(data.divisions || []).map(d=>d.name).join('|')}`;
  return `seed-${hashNumber(raw, 1000000000)}`;
}
function generateClubPlayers(club, prestige, startId, generationContext=null){
  const blueprint = generationRosterBlueprint();
  return blueprint.map((position, index) => {
    const id = startId + index;
    const group = playerRoleGroup(position);
    const age = group === 'POR' ? 25 + hashNumber(`age-${club.name}-${id}`, 14) : 18 + hashNumber(`age-${club.name}-${id}`, 16);
    return generatedPlayerFactory({
      id,
      position,
      clubId:club.id,
      age,
      prestige,
      nameContext:club.name,
      divisionName:club.divisionName,
      divisionOrder:club.divisionOrder,
      generationContext,
      salaryFactor:1,
      localCountry:clubCountry(club)
    });
  });
}
const FALLBACK_PLAYER_FIRST_NAMES = ['Agustín','Mateo','Lautaro','Santiago','Julián','Tomás','Nicolás','Franco','Lucas','Bruno'];
const FALLBACK_PLAYER_LAST_NAMES = ['Gómez','Rodríguez','Fernández','López','Martínez','Pérez','García','Sánchez','Romero','Torres'];
function generatedPlayerName(id, clubNameValue, nationality='Argentina'){
  if(typeof playerNameForNationality === 'function') return playerNameForNationality(id, nationality, clubNameValue);
  const first = FALLBACK_PLAYER_FIRST_NAMES[hashNumber(`${clubNameValue}-${id}-first`, FALLBACK_PLAYER_FIRST_NAMES.length)];
  let second = FALLBACK_PLAYER_FIRST_NAMES[hashNumber(`${clubNameValue}-${id}-second`, FALLBACK_PLAYER_FIRST_NAMES.length)];
  if(second === first) second = FALLBACK_PLAYER_FIRST_NAMES[(FALLBACK_PLAYER_FIRST_NAMES.indexOf(second) + 1) % FALLBACK_PLAYER_FIRST_NAMES.length];
  const last = FALLBACK_PLAYER_LAST_NAMES[hashNumber(`${clubNameValue}-${id}-last`, FALLBACK_PLAYER_LAST_NAMES.length)];
  const full = `${first} ${second} ${last}`;
  return full.length <= 22 ? full : `${first} ${last}`.slice(0,22).trim();
}
function skillTierValue(base, id, label, tier='common'){
  const multipliers = { key:1.30, common:1.00, rare:0.65, weak:0.35 };
  const multiplier = multipliers[tier] ?? multipliers.common;
  const noise = hashNumber(`${id}-${label}-${tier}`, 13) - 6;
  return clamp(Math.round(base * multiplier + noise), 1, 99);
}
function setSkillTier(target, base, id, names, tier){
  names.forEach(name => { target[name] = skillTierValue(base, id, name, tier); });
}
function positionSkillProfile(position){
  const pos = normalizePlayerPosition(position);
  if(pos === 'POR'){
    return {
      key:['porteria','posicionamiento','serenidad','aceleracion'],
      common:['cabezazo','fuerza','liderazgo','trabajoEquipo','paseCorto','paseLargo','resistencia','disciplina'],
      rare:['velocidad'],
      weak:['marca','entradas','remate','regate','tecnica']
    };
  }
  if(['LD','LI','DFC'].includes(pos)){
    return {
      key:['marca','entradas','posicionamiento','fuerza'],
      common:['cabezazo','resistencia','trabajoEquipo','disciplina','liderazgo'],
      rare:['remate','regate','paseCorto','paseLargo','vision','velocidad','aceleracion','tecnica','serenidad'],
      weak:['porteria']
    };
  }
  if(pos === 'MCD'){
    return {
      key:['marca','entradas','paseCorto','trabajoEquipo','resistencia'],
      common:['posicionamiento','paseLargo','vision','disciplina','serenidad','fuerza'],
      rare:['remate','regate','cabezazo','velocidad','aceleracion','tecnica','liderazgo'],
      weak:['porteria']
    };
  }
  if(['MC','MI','MD'].includes(pos)){
    return {
      key:['paseCorto','paseLargo','vision','trabajoEquipo','resistencia'],
      common:['tecnica','posicionamiento','serenidad','marca','disciplina','liderazgo'],
      rare:['remate','regate','cabezazo','velocidad','aceleracion','entradas','fuerza'],
      weak:['porteria']
    };
  }
  if(pos === 'MCO'){
    return {
      key:['paseCorto','vision','tecnica','regate','remate'],
      common:['posicionamiento','serenidad','paseLargo','trabajoEquipo','resistencia'],
      rare:['marca','entradas','cabezazo','velocidad','aceleracion','fuerza','disciplina','liderazgo'],
      weak:['porteria']
    };
  }
  if(['ED','EI'].includes(pos)){
    return {
      key:['velocidad','aceleracion','regate','tecnica','paseCorto'],
      common:['remate','vision','posicionamiento','resistencia','serenidad'],
      rare:['marca','entradas','cabezazo','fuerza','paseLargo','trabajoEquipo','disciplina','liderazgo'],
      weak:['porteria']
    };
  }
  return {
    key:['remate','posicionamiento','cabezazo','serenidad'],
    common:['fuerza','regate','tecnica','velocidad','resistencia'],
    rare:['paseCorto','paseLargo','vision','marca','entradas','aceleracion','trabajoEquipo','disciplina','liderazgo'],
    weak:['porteria']
  };
}
function skillsForPosition(position, base, id){
  const s = {};
  const all = ['porteria','entradas','marca','posicionamiento','paseCorto','paseLargo','vision','regate','tecnica','remate','cabezazo','velocidad','aceleracion','fuerza','resistencia','trabajoEquipo','serenidad','disciplina','liderazgo','potencial'];
  all.forEach(name => { s[name] = skillTierValue(base, id, name, 'rare'); });
  const profile = positionSkillProfile(position);
  setSkillTier(s, base, id, profile.rare || [], 'rare');
  setSkillTier(s, base, id, profile.common || [], 'common');
  setSkillTier(s, base, id, profile.key || [], 'key');
  setSkillTier(s, base, id, profile.weak || [], 'weak');
  s.potencial = clamp(skillTierValue(base, id, 'potencial', 'common') + hashNumber(`pot-${id}`, 8), 1, 99);
  s.disciplina = clamp(Math.round((s.disciplina || skillTierValue(base, id, 'disciplina', 'common')) + hashNumber(`disc-${id}`, 9) - 4), 1, 99);
  return s;
}
function skillsForGroup(group, base, id){
  const representative = group === 'POR' ? 'POR' : group === 'DEF' ? 'DFC' : group === 'MID' ? 'MC' : 'DC';
  return skillsForPosition(representative, base, id);
}
function averageGeneratedVisible(position, skills){
  const temp = { position, skills, overall:50 };
  return clamp(Math.round(avg(Object.values(visibleStats(temp)))), 1, 99);
}
function sortedSeasonDivisions(divisions){
  return (divisions || [{ id:'default', name:'Liga única', order:1 }]).slice().sort((a,b)=>(a.order || 0)-(b.order || 0));
}
function normalizeLeagueFixtureSeedIndex(value){
  const total = Array.isArray(LEAGUE_FIXTURE_SEEDS) ? LEAGUE_FIXTURE_SEEDS.length : 0;
  if(!LEAGUE_FIXTURE_SEEDS_ENABLED || total < 2 || value === null || value === undefined || value === '') return null;
  const parsed = Math.round(Number(value));
  if(!Number.isFinite(parsed)) return null;
  return ((parsed % total) + total) % total;
}
function leagueFixtureSeedIndexForSeasonNumber(seasonNumber=1){
  const total = Array.isArray(LEAGUE_FIXTURE_SEEDS) ? LEAGUE_FIXTURE_SEEDS.length : 0;
  if(!LEAGUE_FIXTURE_SEEDS_ENABLED || total < 2) return null;
  const season = Math.max(1, Math.round(Number(seasonNumber || 1)));
  return (season - 1) % total;
}
function leagueFixtureSeedIndexFromRound(round){
  if(!round || typeof round !== 'object') return null;
  return normalizeLeagueFixtureSeedIndex(round.leagueFixtureSeedIndex);
}
function leagueFixtureSeedIndexForGeneration(options={}, seasonYear=SEASON_START_YEAR){
  if(Object.prototype.hasOwnProperty.call(options || {}, 'fixtureSeedIndex')){
    return normalizeLeagueFixtureSeedIndex(options.fixtureSeedIndex);
  }
  if(game && Math.round(Number(game.seasonYear || 0)) === Math.round(Number(seasonYear || 0))){
    const saved = normalizeLeagueFixtureSeedIndex(game.leagueFixtureSeedIndex);
    if(saved !== null) return saved;
  }
  return null;
}
function leagueFixtureSeedHash(value){
  const text = String(value || 'fixture');
  let hash = 2166136261 >>> 0;
  for(let i=0;i<text.length;i++){
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}
function leagueFixtureSeededRandom(seedValue){
  let state = (Math.round(Number(seedValue || 1)) >>> 0) || 1;
  return function(){
    state = (state + 0x6D2B79F5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
function leagueFixtureSeededClubOrder(clubsInDivision, division, fixtureSeedIndex=null){
  const index = normalizeLeagueFixtureSeedIndex(fixtureSeedIndex);
  if(index === null) return (clubsInDivision || []).slice();
  const ordered = (clubsInDivision || []).slice().sort((a,b)=>Number(a?.id || 0)-Number(b?.id || 0) || String(a?.name || '').localeCompare(String(b?.name || ''), 'es', { sensitivity:'base' }));
  if(ordered.length < 2) return ordered;
  const baseSeed = Number(LEAGUE_FIXTURE_SEEDS[index] || 1) >>> 0;
  const divisionHash = leagueFixtureSeedHash(`${division?.id || 'default'}|${division?.name || ''}`);
  const random = leagueFixtureSeededRandom((baseSeed ^ divisionHash ^ Math.imul(index + 1, 2654435761)) >>> 0);
  for(let i=ordered.length-1;i>0;i--){
    const j = Math.floor(random() * (i + 1));
    [ordered[i], ordered[j]] = [ordered[j], ordered[i]];
  }
  // El desplazamiento fijo evita que una semilla pueda conservar accidentalmente el orden base.
  const shift = ((index + 1 + (divisionHash % ordered.length)) % ordered.length) || 1;
  return ordered.slice(shift).concat(ordered.slice(0, shift));
}
function generateFixturesForDivisions(clubs, divisions, options={}){
  const seasonYear = Math.round(Number(options.seasonYear || SEASON_START_YEAR));
  const fixtureSeedIndex = leagueFixtureSeedIndexForGeneration(options, seasonYear);
  const sortedDivisions = sortedSeasonDivisions(divisions);
  const normalClubs = (clubs || []).filter(c => !(c?.specialCompetitionOnly || c?.clubWorldCupInvite || c?.clubWorldCupExternal));
  const schedules = sortedDivisions.map(division => ({
    division,
    rounds:roundRobinSchedule(normalClubs.filter(c => c.divisionId === division.id), division, { fixtureSeedIndex })
  }));
  const maxRounds = Math.max(...schedules.map(s => s.rounds.length), 0);
  const firstLeagueDate = leagueStartDateForSeason(seasonYear);
  const fixtures = [];
  for(let roundIndex=0; roundIndex<maxRounds; roundIndex++){
    const baseOffset = roundIndex * LEAGUE_ROUND_INTERVAL_DAYS;
    const breakOffset = (MIDSEASON_BREAK_AFTER_ROUND > 0 && roundIndex >= MIDSEASON_BREAK_AFTER_ROUND) ? MIDSEASON_BREAK_DAYS : 0;
    const date = addDaysToIsoDate(firstLeagueDate, baseOffset + breakOffset);
    const matches = [];
    schedules.forEach(schedule => {
      const matchDate = matchDateForDivisionRound(date, schedule.division);
      (schedule.rounds[roundIndex] || []).forEach(match => matches.push({ ...match, date:matchDate, roundDate:date }));
    });
    matches.sort((a,b)=>daysBetweenIsoDates(b.date || date, a.date || date) || String(a.divisionName || '').localeCompare(String(b.divisionName || ''), 'es', { sensitivity:'base' }));
    const dates = [...new Set(matches.map(match => match.date).filter(validIsoDate))].sort((a,b)=>daysBetweenIsoDates(b,a));
    const fixtureRound = { matchday:roundIndex+1, date, startDate:dates[0] || date, endDate:dates[dates.length-1] || date, matches };
    if(fixtureSeedIndex !== null){
      fixtureRound.leagueFixtureSeedIndex = fixtureSeedIndex;
      fixtureRound.leagueFixtureSeedVersion = LEAGUE_FIXTURE_SEED_VERSION;
    }
    fixtures.push(fixtureRound);
  }
  return fixtures;
}
function roundRobinSchedule(clubsInDivision, division, options={}){
  const fixtureSeedIndex = normalizeLeagueFixtureSeedIndex(options.fixtureSeedIndex);
  const teams = leagueFixtureSeededClubOrder(clubsInDivision, division, fixtureSeedIndex);
  if(teams.length % 2 === 1) teams.push(null);
  const firstLeg = [];
  const n = teams.length;
  if(n < 2) return firstLeg;
  let arr = teams.slice();
  for(let r=0; r<n-1; r++){
    const matches = [];
    for(let i=0; i<n/2; i++){
      const a = arr[i];
      const b = arr[n-1-i];
      if(a && b){
        const home = r % 2 === 0 ? a : b;
        const away = r % 2 === 0 ? b : a;
        matches.push({ id:`${division.id}-j${r+1}-${home.id}-${away.id}`, matchday:r+1, leg:1, divisionId:division.id, divisionName:division.name, homeId:home.id, awayId:away.id, played:false });
      }
    }
    firstLeg.push(matches);
    arr = [arr[0], arr[n-1], ...arr.slice(1,n-1)];
  }
  if(!SEASON_HOME_AWAY) return firstLeg;
  const secondLeg = firstLeg.map((matches, roundIndex) => {
    const matchday = firstLeg.length + roundIndex + 1;
    return matches.map(match => ({
      ...match,
      id:`${division.id}-j${matchday}-${match.awayId}-${match.homeId}`,
      matchday,
      leg:2,
      homeId:match.awayId,
      awayId:match.homeId,
      played:false,
      homeGoals:undefined,
      awayGoals:undefined
    }));
  });
  return firstLeg.concat(secondLeg);
}
function mergePlayedFixturesIntoCalendar(nextFixtures, previousFixtures=[]){
  const previousById = new Map();
  (previousFixtures || []).forEach(round => {
    (round.matches || []).forEach(match => previousById.set(String(match.id), match));
  });
  if(!previousById.size) return nextFixtures;
  return nextFixtures.map(round => ({
    ...round,
    matches:(round.matches || []).map(match => {
      const previous = previousById.get(String(match.id));
      if(!previous || !previous.played) return match;
      return { ...match, played:true, homeGoals:previous.homeGoals, awayGoals:previous.awayGoals };
    })
  }));
}
function fixtureDataCountryKey(value){
  return normalizeScheduleText(String(value || '').trim() || 'argentina');
}
function fixtureDataClubCountry(club){
  if(!club) return '';
  return fixtureDataCountryKey(typeof clubCountry === 'function' ? clubCountry(club) : (club.country || club.pais || 'Argentina'));
}
function fixtureDataDivisionCountry(division){
  return fixtureDataCountryKey(division?.country || division?.pais || '');
}
function fixtureDataCrossCountryIssues(fixtures=[]){
  const clubsById = Object.fromEntries((seed?.clubs || []).map(club => [Number(club.id), club]));
  const divisionsById = Object.fromEntries((seed?.divisions || []).map(division => [String(division.id || 'default'), division]));
  const issues = [];
  (fixtures || []).forEach((round, roundIndex) => {
    (round.matches || []).forEach(match => {
      const home = clubsById[Number(match.homeId)];
      const away = clubsById[Number(match.awayId)];
      const division = divisionsById[String(match.divisionId || home?.divisionId || '')];
      if(!home || !away || !division) return;
      const country = fixtureDataDivisionCountry(division);
      if(country && (fixtureDataClubCountry(home) !== country || fixtureDataClubCountry(away) !== country)){
        issues.push({ id:match.id, played:Boolean(match.played), roundIndex, divisionId:division.id });
      }
    });
  });
  return issues;
}
function fixtureRoundIsPlayoff(round){
  return Boolean(round?.playoffRound || (round?.matches || []).some(match => match?.playoff));
}
function fixtureRoundIsPersistentCompetition(round){
  return Boolean(fixtureRoundIsPlayoff(round) || round?.clubWorldCupRound || round?.nationalCupRound || round?.libertadoresRound || round?.championsLeagueRound || (round?.matches || []).some(match => match?.clubWorldCup || match?.nationalCup || match?.libertadores || match?.championsLeague));
}
function fixtureRoundCalendarDate(round){
  const dates = (round?.matches || []).map(match => validIsoDate(match?.date) ? match.date : '').filter(Boolean).sort();
  return dates[0] || (validIsoDate(round?.date) ? round.date : '9999-12-31');
}
function normalizeSeasonFixtures(existingFixtures, seasonNumber=1, seasonYear=null, options={}){
  const year = Math.round(Number(seasonYear || 0)) || seasonYearForNumber(seasonNumber || 1);
  const expected = generateFixturesForDivisions(seed.clubs || [], sortedSeasonDivisions(seed.divisions || []), { seasonYear:year, fixtureSeedIndex:options.fixtureSeedIndex });
  const current = Array.isArray(existingFixtures) ? existingFixtures : [];
  const persistentCompetitionRounds = current.filter(fixtureRoundIsPersistentCompetition);
  const regularCurrent = current.filter(round => !fixtureRoundIsPersistentCompetition(round));
  const fixtureCountryIssues = fixtureDataCrossCountryIssues(regularCurrent);
  const hasOnlyUnplayedCrossCountryFixtures = fixtureCountryIssues.length > 0 && !fixtureCountryIssues.some(item => item.played);
  const currentYear = String(regularCurrent?.[0]?.date || current?.[0]?.date || '').slice(0,4);
  const needsCalendar = regularCurrent.length !== expected.length
    || currentYear !== String(year)
    || regularCurrent.some((round, index) => expected[index] && round.date !== expected[index].date)
    || regularCurrent.some(round => !validIsoDate(round.date))
    || regularCurrent.some(round => (round.matches || []).some(match => !validIsoDate(match.date) || !Object.prototype.hasOwnProperty.call(match, 'roundDate')))
    || hasOnlyUnplayedCrossCountryFixtures;
  const normalizedRegular = needsCalendar ? mergePlayedFixturesIntoCalendar(expected, regularCurrent) : regularCurrent;
  const combined = normalizedRegular.concat(persistentCompetitionRounds).sort((a,b)=>daysBetweenIsoDates(fixtureRoundCalendarDate(a), fixtureRoundCalendarDate(b)) || Number(a.matchday || 0)-Number(b.matchday || 0));
  combined.forEach((round,index)=>{ round.matchday=index+1; (round.matches || []).forEach(match=>{ match.matchday=index+1; }); });
  return combined;
}


function savedHasDatabaseSnapshots(saved){
  return Boolean(Array.isArray(saved?.clubsSnapshot) && saved.clubsSnapshot.length && Array.isArray(saved?.playersSnapshot) && saved.playersSnapshot.length);
}
function localSaveRecordTimestamp(record){
  const raw = record?.localSaveMeta?.savedAt || '';
  const value = Date.parse(raw);
  return Number.isFinite(value) ? value : 0;
}
function usableLocalSaveRecord(record){
  return Boolean(record && typeof record === 'object' && (Number(record.selectedClubId || 0) > 0 || (record.gameOver && record.managerStats)));
}
async function readLocalSaveRecord(slotId=null){
  const slot = normalizeSaveSlotId(slotId || currentSaveSlotId || SAVE_SLOT_CAREER);
  const candidates = [
    { key:saveSlotKey(slot), source:'primary', priority:3 },
    { key:backupSaveSlotKey(slot), source:'backup', priority:2 }
  ];
  if(slot === SAVE_SLOT_CAREER) candidates.push({ key:legacyCareerSlotKey(), source:'legacy', priority:1 });
  const loaded = await Promise.all(candidates.map(async candidate => ({
    ...candidate,
    record:await readSaveRecordByKey(candidate.key).catch(()=>null)
  })));
  const usable = loaded.filter(item => usableLocalSaveRecord(item.record));
  if(!usable.length) return null;
  usable.sort((a,b) => localSaveRecordTimestamp(b.record) - localSaveRecordTimestamp(a.record) || b.priority - a.priority);
  const selected = usable[0];
  const primary = loaded.find(item => item.source === 'primary');
  const backup = loaded.find(item => item.source === 'backup');
  selected.record._storageReadSource = selected.source;
  selected.record._storageNeedsRefresh = selected.source !== 'primary'
    || !usableLocalSaveRecord(primary?.record)
    || !usableLocalSaveRecord(backup?.record);
  return selected.record;
}
let localDbPromise = null;
async function openDb(){
  if(localDbPromise) return localDbPromise;
  localDbPromise = new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if(!request.result.objectStoreNames.contains(DB_STORE)) request.result.createObjectStore(DB_STORE);
    };
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => {
        db.close();
        localDbPromise = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      localDbPromise = null;
      reject(request.error);
    };
    request.onblocked = () => {
      localDbPromise = null;
      reject(new Error('La base local está bloqueada por otra pestaña.'));
    };
  });
  return localDbPromise;
}
let localSaveWriteChain = Promise.resolve();
let localSilentSaveWriteCount = 0;
let pendingAutosaveTimer = null;
let pendingAutosaveWaiters = [];
let lastLocalSaveErrorNoticeAt = 0;
function localSaveErrorMessage(error){
  const name = String(error?.name || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  if(name.includes('quota') || message.includes('quota') || message.includes('storage')){
    return 'No se pudo guardar: el navegador no tiene espacio suficiente para esta partida.';
  }
  if(name.includes('version') || name.includes('invalidstate')){
    return 'No se pudo guardar: la base local del navegador no está disponible. Recargá la página y volvé a intentarlo.';
  }
  return 'No se pudo guardar la partida en este navegador.';
}
function reportLocalSaveError(error){
  const now = Date.now();
  if(now - lastLocalSaveErrorNoticeAt > 1200){
    lastLocalSaveErrorNoticeAt = now;
    showNotice(localSaveErrorMessage(error));
  }
  console.error('No se pudo guardar la partida.', error);
}
async function writeLocalSaveNow(silent=false){
  if(!game){
    if(!silent) showNotice('No hay partida para guardar.');
    return false;
  }
  if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'save_local' });
  const slot = setCurrentSaveSlot(game?.saveSlotId || currentSaveSlotId || SAVE_SLOT_CAREER);
  const payload = currentSavePayload();
  payload.saveSlotId = slot;
  const db = await openDb();
  await new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    const store = tx.objectStore(DB_STORE);
    const primaryKey = saveSlotKey(slot);
    const backupKey = backupSaveSlotKey(slot);
    const previousRequest = store.get(primaryKey);
    previousRequest.onsuccess = () => {
      const previous = previousRequest.result;
      if(silent) localSilentSaveWriteCount += 1;
      const refreshBackup = !silent || !usableLocalSaveRecord(previous) || localSilentSaveWriteCount % SAVE_BACKUP_EVERY_AUTOSAVES === 0;
      if(refreshBackup) store.put(usableLocalSaveRecord(previous) ? previous : payload, backupKey);
      store.put(payload, primaryKey);
    };
    previousRequest.onerror = () => tx.abort();
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('IndexedDB rechazó el guardado.'));
    tx.onabort = () => reject(tx.error || new Error('IndexedDB canceló el guardado.'));
  });
  if(!silent) showNotice(`${saveSlotLabel(slot, payload)} guardada en este navegador.`);
  return true;
}
function queueLocalSaveWrite(silent=false){
  const task = localSaveWriteChain
    .catch(() => undefined)
    .then(() => writeLocalSaveNow(silent));
  localSaveWriteChain = task;
  return task.catch(error => {
    reportLocalSaveError(error);
    throw error;
  });
}
function settleAutosaveWaiters(waiters, method, value){
  (waiters || []).forEach(waiter => {
    try{ waiter?.[method]?.(value); }catch(_error){}
  });
}
function scheduleCoalescedAutosave(){
  return new Promise((resolve,reject) => {
    pendingAutosaveWaiters.push({ resolve, reject });
    if(pendingAutosaveTimer) clearTimeout(pendingAutosaveTimer);
    pendingAutosaveTimer = setTimeout(() => {
      pendingAutosaveTimer = null;
      const waiters = pendingAutosaveWaiters.splice(0);
      queueLocalSaveWrite(true)
        .then(result => settleAutosaveWaiters(waiters, 'resolve', result))
        .catch(error => settleAutosaveWaiters(waiters, 'reject', error));
    }, AUTOSAVE_COALESCE_MS);
  });
}
function flushPendingAutosave(){
  if(!pendingAutosaveTimer) return Promise.resolve(false);
  clearTimeout(pendingAutosaveTimer);
  pendingAutosaveTimer = null;
  const waiters = pendingAutosaveWaiters.splice(0);
  return queueLocalSaveWrite(true)
    .then(result => {
      settleAutosaveWaiters(waiters, 'resolve', result);
      return result;
    })
    .catch(error => {
      settleAutosaveWaiters(waiters, 'reject', error);
      throw error;
    });
}
async function saveLocal(silent=false){
  if(!game){
    if(!silent) showNotice('No hay partida para guardar.');
    return false;
  }
  if(silent && AUTOSAVE_COALESCE_MS > 0) return scheduleCoalescedAutosave();
  const pendingWaiters = pendingAutosaveWaiters.splice(0);
  if(pendingAutosaveTimer){
    clearTimeout(pendingAutosaveTimer);
    pendingAutosaveTimer = null;
  }
  try{
    const result = await queueLocalSaveWrite(Boolean(silent));
    settleAutosaveWaiters(pendingWaiters, 'resolve', result);
    return result;
  }catch(error){
    settleAutosaveWaiters(pendingWaiters, 'reject', error);
    throw error;
  }
}
if(typeof document !== 'undefined'){
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'hidden' && pendingAutosaveTimer){
      flushPendingAutosave().catch(reportLocalSaveError);
    }
  });
}
if(typeof window !== 'undefined'){
  window.addEventListener('pagehide', () => {
    if(pendingAutosaveTimer) flushPendingAutosave().catch(reportLocalSaveError);
  });
}
async function loadLocal(silent=false, slotId=null){
  const slot = normalizeSaveSlotId(slotId || currentSaveSlotId || SAVE_SLOT_CAREER);
  const saved = await readLocalSaveRecord(slot);
  if(saved){
    const recoveredFromBackup = saved._storageReadSource === 'backup' || saved._storageReadSource === 'legacy';
    const storageNeedsRefresh = Boolean(saved._storageNeedsRefresh);
    const currentSignature = seed?.meta?.signature;
    if(currentSignature && saved.seedSignature !== currentSignature && !savedHasDatabaseSnapshots(saved)){
      if(!silent) showNotice('La base de datos cambió y la partida guardada no tiene snapshots suficientes. Creá una nueva partida para usar la base actual.');
      return false;
    }
    if(currentSignature && saved.seedSignature !== currentSignature){
      saved._needsAutosave = true;
    }
    setCurrentSaveSlot(slot);
    game = normalizeGame(applySavedDatabaseSnapshots(saved));
    game.saveSlotId = slot;
    const sharedProfileApplied = typeof applySharedManagerProfileToGame === 'function' ? applySharedManagerProfileToGame({ reason:'load_local' }) : null;
    const needsAutosave = Boolean(game._needsAutosave);
    const repairedStadiumFields = Boolean(game._stadiumFieldsAutoRepaired);
    delete game._needsAutosave;
    delete game._stadiumFieldsAutoRepaired;
    const manualSync = syncManualPlayersIntoSeed({ preserveExisting:true, state:game, retiredManualPlayerIds:game?.manualRetiredPlayerIds || game?.retiredManualPlayerIds || [] });
    const botRepair = repairBotRosters({ reason:'load_game' });
    const stadiumRepair = repairInvalidBotFieldStates(game, 'load_game', { message:repairedStadiumFields ? false : true });
    const shouldAutosave = Boolean(manualSync.changed || manualSync.inserted || manualSync.refreshed) || botRepair.created || botRepair.converted || needsAutosave || stadiumRepair.repaired || Boolean(sharedProfileApplied?.changed) || storageNeedsRefresh;
    delete game._needsAutosave;
    delete game._stadiumFieldsAutoRepaired;
    activeTab = 'home';
    renderAll();
    if(shouldAutosave) saveLocal(true);
    setTimeout(() => {
      if(typeof scheduleRankingAutomaticRetryFromState === 'function') scheduleRankingAutomaticRetryFromState({ source:'load_local' });
      if(typeof processScheduledCareerRankingUploads === 'function') processScheduledCareerRankingUploads({ source:'load_local' });
    }, 0);
    if(!silent){
      const notice = recoveredFromBackup
        ? `${saveSlotLabel(slot, saved)} recuperada desde la copia de seguridad y duplicada nuevamente.`
        : (repairedStadiumFields || stadiumRepair.repaired
          ? 'Partida cargada. Se corrigieron campos bots inválidos.'
          : (needsAutosave ? `${saveSlotLabel(slot, saved)} cargada. Se corrigió el arrastre de lesiones.` : `${saveSlotLabel(slot, saved)} cargada.`));
      showNotice(notice);
    }
    return true;
  }
  if(!silent) showNotice('No hay una partida guardada.');
  return false;
}

async function init(){
  try{
    const singleSlotMigration = await migrateCareerSlotsToSingleSlot().catch(error => { console.warn('No se pudo consolidar los slots anteriores.', error); return { migrated:false }; });
    const preferredSlot = normalizeSaveSlotId(currentSaveSlotId || SAVE_SLOT_CAREER);
    let savedRecord = await readLocalSaveRecord(preferredSlot).catch(() => null);
    if(!savedRecord && preferredSlot !== SAVE_SLOT_CAREER) savedRecord = await readLocalSaveRecord(SAVE_SLOT_CAREER).catch(() => null);
    const useSavedSnapshots = savedHasDatabaseSnapshots(savedRecord);
    // V9.13: las bases auxiliares no bloquean la primera pantalla. Se cargan en paralelo
    // y se incorporan cuando el navegador termina el arranque principal.
    managerAchievementsDatabase = managerAchievementsDatabase || { metadata:{ version:APP_VERSION, source:'startup' }, hitos:[] };
    managerChallengesDatabase = managerChallengesDatabase || { metadata:{ version:APP_VERSION, source:'startup' }, retos:[] };
    matchCommentaryDatabase = matchCommentaryDatabase || { version:APP_VERSION, categorias:{} };
    const optionalDatabasesPromise = Promise.all([
      loadManagerAchievementsDatabase(),
      loadManagerChallengesDatabase(),
      loadMatchCommentaryDatabase()
    ]).then(([achievements, challenges, commentary]) => {
      managerAchievementsDatabase = achievements;
      managerChallengesDatabase = challenges;
      matchCommentaryDatabase = commentary;
      if(game && ['mystats','challenges'].includes(activeTab) && typeof renderAll === 'function') renderAll();
      return true;
    }).catch(error => { console.warn('Las bases auxiliares continuarán con datos de respaldo.', error); return false; });
    const [loadedSeed, loadedSponsors, loadedEmployees, loadedInstallations, loadedEvents, loadedSpecialSkills] = await Promise.all([
      loadInitialSeed({ skipPlayersDatabase:useSavedSnapshots }),
      loadSponsorsDatabase(),
      loadEmployeesDatabase(),
      loadInstallationsDatabase(),
      loadEventsDatabase(),
      loadSpecialSkillsDatabase()
    ]);
    seed = loadedSeed;
    sponsorsDatabase = loadedSponsors;
    employeesDatabase = loadedEmployees;
    installationsDatabase = loadedInstallations;
    eventsDatabase = loadedEvents;
    specialSkillsDatabase = loadedSpecialSkills;
    fillClubSelect();
    bindEvents();
    startUiTicker();
    if(typeof migrateAllSavedSpecialCardsToGlobal === 'function') await migrateAllSavedSpecialCardsToGlobal().catch(()=>{});
    if(typeof migrateAllSavedManagerProfilesToGlobal === 'function') await migrateAllSavedManagerProfilesToGlobal().catch(()=>{});
    let loaded = await loadLocal(true, preferredSlot);
    if(!loaded && preferredSlot !== SAVE_SLOT_CAREER) loaded = await loadLocal(true, SAVE_SLOT_CAREER);
    if(loaded && singleSlotMigration?.migrated){
      showNotice(`La carrera del antiguo espacio ${singleSlotMigration.fromSlot} se trasladó al único espacio disponible.`);
    }
    void optionalDatabasesPromise;
    if(!loaded){
      if(useSavedSnapshots){
        seed = await loadInitialSeed({ skipPlayersDatabase:false });
        fillClubSelect();
      }
      game = null;
      activeTab = 'home';
      renderAll();
    }
  }catch(error){
    console.error(error);
    view.innerHTML = `<div class="empty"><h2>Error de carga</h2><p>No se pudo iniciar el juego. Revisá que la publicación esté completa y volvé a intentar.</p></div>`;
  }
}
