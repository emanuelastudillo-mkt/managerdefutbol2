/* V5.01 · Carga de JSON, calendario anual, hinchadas, estadios, persistencia local e inicialización optimizada. */

async function fetchJsonIfExists(url){
  try{
    const res = await fetch(url, { cache:DATA_CACHE_MODE });
    if(!res.ok) return null;
    const raw = await res.text();
    if(!raw.trim()) return null;
    return JSON.parse(raw);
  }catch(error){
    console.warn(`No se pudo cargar ${url}`, error);
    return null;
  }
}

async function loadPlayersDatabase(){
  const raw = await fetchJsonIfExists(PLAYERS_DATABASE_URL);
  if(!raw) return null;
  const players = Array.isArray(raw) ? raw : raw.players;
  if(!Array.isArray(players) || !players.length) return null;
  return { raw, players, source:PLAYERS_DATABASE_URL };
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
      { id:'kinesiologist', nombre:'Kinesiólogo', rol:'Recuperación', costoBase:KINESIOLOGIST_COST, duracion:'temporada', descripcion:'Permite tratar lesionados una vez por semana para reducir días de recuperación.', accion:'tratamiento_lesion' },
      { id:'youth_preparer', nombre:'Preparador de juveniles', rol:'Academia', costoBase:YOUTH_PREPARER_COST, duracion:'temporada', descripcion:'Permite consultar informes de juveniles y descubrir más habilidades ocultas.', accion:'informe_juveniles' }
    ],
    source:'fallback'
  };
  const clean = raw && typeof raw === 'object' ? raw : fallback;
  const categorias = Array.isArray(clean.categorias) && clean.categorias.length ? clean.categorias : fallback.categorias;
  const empleados = Array.isArray(clean.empleados) && clean.empleados.length ? clean.empleados : fallback.empleados;
  return { ...clean, categorias, empleados, source:raw ? EMPLOYEES_DATABASE_URL : 'fallback' };
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
    limites:{ cartas_activas_max:5, cartas_reserva_max:50, dias_bloqueo_cambio_cartas:100, permitir_abrir_sobres_con_reserva_llena:false, permitir_cartas_repetidas_activas:true, bonus_se_apilan:true },
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
  const cleanPath = normalizeLegacyAssetMarkerEncoding(rawPath || fallback);
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
function normalizeDatabasePlayer(player){
  const clean = { ...player, id:Number(player.id), clubId:Number(player.clubId || 0), age:Math.max(15, Math.round(Number(player.age || 18))) };
  clean.position = normalizePlayerPosition(clean.position, clean.id);
  clean.skills = clean.skills && typeof clean.skills === 'object' ? { ...clean.skills } : skillsForPosition(clean.position, Number(clean.overall || 50), clean.id);
  clean.overall = rawVisibleOverall({ ...clean, overall:Number(clean.overall || 50) });
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
  if(!normalized.length) return seedData;
  const dbClubIds = new Set(normalized.map(player => Number(player.clubId || 0)).filter(Boolean));
  const dbMaxId = Math.max(0, ...normalized.map(player => Number(player.id || 0)).filter(Number.isFinite));
  let nextId = dbMaxId + 1;
  const generatedForUncoveredClubs = (seedData.players || [])
    .map(normalizeDatabasePlayer)
    .filter(player => Number(player.clubId || 0) > 0 && validClubIds.has(Number(player.clubId)) && !dbClubIds.has(Number(player.clubId)))
    .map(player => ensurePlayerEconomics({ ...player, id:nextId++ }));
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
  if(Array.isArray(saved?.clubsSnapshot) && saved.clubsSnapshot.length){
    seed.clubs = saved.clubsSnapshot.map(club => ({ ...club, fieldConditionScore:Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club), fieldCondition:club.fieldCondition || fieldConditionName(club.fieldConditionScore || initialFieldScore(club)), crestPath:normalizeClubCrestPath(club, club.crestPath) }));
  }
  if(Array.isArray(saved?.playersSnapshot) && saved.playersSnapshot.length){
    seed.players = saved.playersSnapshot.map(normalizeDatabasePlayer);
  }
  delete clean.playersSnapshot;
  delete clean.clubsSnapshot;
  delete clean.divisionsSnapshot;
  return clean;
}
function currentSavePayload(){
  if(game?.clubBudgets && Number.isFinite(Number(game.selectedClubId))){
    game.clubBudgets[game.selectedClubId] = Math.round(Number(game.budget || 0));
  }
  const payload = structuredClone(game);
  delete payload._needsAutosave;
  delete payload._stadiumFieldsAutoRepaired;
  payload.seedSignature = seed?.meta?.signature || payload.seedSignature || '';
  payload.playersSnapshot = structuredClone(seed?.players || []);
  payload.clubsSnapshot = structuredClone(seed?.clubs || []);
  payload.divisionsSnapshot = structuredClone(seed?.divisions || []);
  return payload;
}
async function loadInitialSeed(options={}){
  const skipPlayersDatabase = Boolean(options?.skipPlayersDatabase);
  const [playersDatabase, loadedStadiumsDatabase, loadedFansDatabase] = await Promise.all([
    skipPlayersDatabase ? Promise.resolve(null) : loadPlayersDatabase(),
    loadStadiumsDatabase(),
    loadFansDatabase()
  ]);
  stadiumsDatabase = loadedStadiumsDatabase;
  fansDatabase = loadedFansDatabase;
  const loadedLeagues = await Promise.all(LEAGUE_DATA_CANDIDATES.map(async url => ({ url, leagueJson:await fetchJsonIfExists(url) })));
  const leagueSeeds = loadedLeagues
    .filter(item => item.leagueJson)
    .map(item => applyStadiumAndFansDatabases(buildSeedFromLigaArgentina(item.leagueJson, item.url), stadiumsDatabase, fansDatabase));
  if(leagueSeeds.length){
    const merged = mergeLeagueSeeds(leagueSeeds);
    return applyPlayersDatabase(merged, playersDatabase);
  }
  const fallback = await fetchJsonIfExists(DATA_URL);
  if(fallback && Array.isArray(fallback.clubs) && Array.isArray(fallback.players) && Array.isArray(fallback.fixtures)){
    fallback.meta = { ...(fallback.meta || {}), source:fallback.meta?.source || 'seed.json', signature:seedSignature(fallback) };
    fallback.clubs = fallback.clubs.map(c => ({ ...c, divisionId:c.divisionId || 'default', divisionName:c.divisionName || 'Liga única', prizeMultiplier:c.prizeMultiplier ?? 1, fieldConditionScore:c.fieldConditionScore || initialFieldScore(c), fieldCondition:fieldConditionName(c.fieldConditionScore || initialFieldScore(c)), crestPath:normalizeClubCrestPath(c, c.crestPath) }));
    fallback.divisions = fallback.divisions || [{ id:'default', name:'Liga única', order:1, prizeMultiplier:1 }];
    fallback.players = (fallback.players || []).map(player => ensurePlayerEconomics({ ...player, position:normalizePlayerPosition(player.position, player.id) }));
    const withStadiums = applyStadiumAndFansDatabases(fallback, stadiumsDatabase, fansDatabase);
    return applyPlayersDatabase(withStadiums, playersDatabase);
  }
  throw new Error('No se pudo cargar ningún JSON de liga ni un data/seed.json válido');
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
  const dynamic = Object.entries(raw).filter(([_, value]) => Array.isArray(value));
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
function fieldConditionByPrestige(prestige){
  const p = Number(prestige) || 50;
  if(p >= 82) return 'Excelente';
  if(p >= 62) return 'Normal';
  if(p >= 45) return 'Regular';
  if(p >= 30) return 'Muy malo';
  return 'Injugable';
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
function createInitialStadiumState(){
  const fields = {};
  const ticketPrices = {};
  seed.clubs.forEach(club => {
    fields[club.id] = Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club);
    ticketPrices[club.id] = TICKET_PRICE_INITIAL;
  });
  return { fields, projects:{}, ticketPrices, capacityOverrides:{}, expansionProjects:{}, completedExpansions:{}, botSeasonNumber:0 };
}
function ensureStadiumState(){
  if(!game) return;
  if(!game.stadium) game.stadium = createInitialStadiumState();
  if(!game.stadium.fields) game.stadium.fields = {};
  if(!game.stadium.projects) game.stadium.projects = {};
  if(!game.stadium.ticketPrices) game.stadium.ticketPrices = {};
  if(!game.stadium.capacityOverrides) game.stadium.capacityOverrides = {};
  if(!game.stadium.expansionProjects) game.stadium.expansionProjects = {};
  if(!game.stadium.completedExpansions) game.stadium.completedExpansions = {};
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
function fieldNameForClub(clubId){
  return fieldConditionName(fieldScoreForClub(clubId));
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
  const override = Number(game?.stadium?.capacityOverrides?.[clubId]);
  if(Number.isFinite(override) && (override > 0 || founded)) return clamp(Math.round(override), founded ? 0 : 500, STADIUM_EXPANSION_MAX_CAPACITY);
  return baseStadiumCapacityForClub(clubId);
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
function activeStadiumExpansionProjects(clubId){
  return stadiumExpansionProjectsForClub(clubId).filter(project => Number(project.daysLeft || 0) > 0);
}
function maxSimultaneousStadiumWorks(capacity){
  const cap = Math.round(Number(capacity || 0));
  if(cap < 5000) return 2;
  if(cap < 100000) return 3;
  if(cap < 119000) return 2;
  return 1;
}
function stadiumSlotTokens(slot){
  return String(slot || '').split(/[\/,+]/).map(s => s.trim()).filter(Boolean);
}
function stadiumSlotsConflict(slotA, slotB){
  const a = stadiumSlotTokens(slotA);
  const b = stadiumSlotTokens(slotB);
  if(a.includes('Integral') || b.includes('Integral')) return true;
  return a.some(token => b.includes(token));
}
function stadiumConstructionAttendancePenalty(clubId){
  const active = activeStadiumExpansionProjects(clubId).length;
  return clamp(active * STADIUM_EXPANSION_ATTENDANCE_PENALTY_PER_PROJECT, 0, STADIUM_EXPANSION_ATTENDANCE_PENALTY_MAX);
}
function availableStadiumExpansionsForClub(clubId){
  const capacity = clubStadiumCapacity(clubId);
  const completed = completedStadiumExpansionsForClub(clubId);
  const activeIds = new Set(activeStadiumExpansionProjects(clubId).map(project => Number(project.id)));
  return (STADIUM_EXPANSIONS || []).filter(item => !completed[item.id] && !activeIds.has(Number(item.id)) && capacity >= Number(item.minCapacity || 0) && capacity < Number(item.targetCapacity || STADIUM_EXPANSION_MAX_CAPACITY));
}
function stadiumExpansionStartStatus(clubId, expansion){
  const capacity = clubStadiumCapacity(clubId);
  const active = activeStadiumExpansionProjects(clubId);
  if(!expansion) return { ok:false, reason:'Obra inválida.' };
  if(capacity >= STADIUM_EXPANSION_MAX_CAPACITY) return { ok:false, reason:'El estadio ya alcanzó el máximo de 120.000.' };
  if(capacity < Number(expansion.minCapacity || 0)) return { ok:false, reason:`Requiere ${new Intl.NumberFormat('es-AR').format(expansion.minCapacity || 0)} de capacidad terminada.` };
  if(capacity >= Number(expansion.targetCapacity || STADIUM_EXPANSION_MAX_CAPACITY)) return { ok:false, reason:'Esta ampliación ya quedó superada por la capacidad actual.' };
  if(completedStadiumExpansionsForClub(clubId)[expansion.id]) return { ok:false, reason:'Esta obra ya fue realizada.' };
  if(active.some(project => Number(project.id) === Number(expansion.id))) return { ok:false, reason:'Esta obra ya está en construcción.' };
  if(active.length >= maxSimultaneousStadiumWorks(capacity)) return { ok:false, reason:`Máximo ${maxSimultaneousStadiumWorks(capacity)} obra(s) simultánea(s) para esta capacidad.` };
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
  if(!game?.stadium?.expansionProjects) return [];
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
function priceRatio(price){
  if(TICKET_PRICE_MAX <= TICKET_PRICE_MIN) return 0;
  return clamp((Number(price || TICKET_PRICE_INITIAL) - TICKET_PRICE_MIN) / (TICKET_PRICE_MAX - TICKET_PRICE_MIN), 0, 1);
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
  return (1 - priceRatio(price)) * TICKET_PRICE_MAX_EFFECT_RATE;
}
function ticketGainBlockRate(price){
  return priceRatio(price) * TICKET_PRICE_MAX_EFFECT_RATE;
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
function attendanceContextForMatch(match){
  ensureFanState();
  ensureStadiumState();
  const nominalCapacity = clubStadiumCapacity(match.homeId);
  const constructionPenalty = stadiumConstructionAttendancePenalty(match.homeId);
  const capacity = Math.max(0, Math.floor(nominalCapacity * (1 - constructionPenalty)));
  const homeDemandBase = clubFansCurrent(match.homeId);
  const awayDemandBase = clubFansCurrent(match.awayId);
  const rivalPrestigeBonus = rivalPrestigeAttendanceBonusInfo(match.awayId);
  const homeDemand = Math.round(homeDemandBase * (1 + rivalPrestigeBonus.rate));
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
  const ticketRevenue = Math.round(totalFans * ticketPrice);
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
    homeDemandBase,
    awayDemandBase,
    homeDemand,
    awayDemand,
    rivalPrestige:Number(rivalPrestigeBonus.prestige || 0),
    rivalPrestigeAttendanceBonusRate:Number(rivalPrestigeBonus.rate || 0),
    rivalPrestigeAttendanceBonusPct:Number(rivalPrestigeBonus.pct || 0)
  };
}
function fanTableRateForPosition(position){
  const raw = (FAN_TABLE_NEUTRAL_POSITION - Number(position || FAN_TABLE_NEUTRAL_POSITION)) * FAN_TABLE_POSITION_STEP;
  return clamp(raw, -0.01, FAN_TABLE_MAX_GAIN_RATE);
}
function clubPositionInStandings(clubId){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId));
  const divisionId = club?.divisionId || 'default';
  const list = typeof sortedStandings === 'function' ? sortedStandings(divisionId) : [];
  const index = list.findIndex(row => Number(row.clubId) === Number(clubId));
  return index >= 0 ? index + 1 : FAN_TABLE_NEUTRAL_POSITION;
}
function applyFanChangeForClub(clubId, resultKey){
  ensureFanState();
  const current = clubFansCurrent(clubId);
  const base = clubFansBase(clubId);
  const price = ticketPriceForClub(clubId);
  let resultDelta = 0;
  if(resultKey === 'win') resultDelta = base * FAN_WIN_BASE_RATE;
  if(resultKey === 'loss') resultDelta = -current * FAN_LOSS_CURRENT_RATE;
  const position = clubPositionInStandings(clubId);
  let positionDelta = current * fanTableRateForPosition(position);
  if(positionDelta < 0){
    positionDelta = Math.min(0, positionDelta + current * ticketLossShieldRate(price));
  }
  let totalDelta = resultDelta + positionDelta;
  if(totalDelta > 0){
    totalDelta = Math.max(0, totalDelta - current * ticketGainBlockRate(price));
    if(Number(clubId) === Number(game?.selectedClubId || 0) && typeof specialActiveBonus === 'function'){
      const sociosBonus = clamp(Number(specialActiveBonus('socios_extra') || 0), 0, 300);
      if(sociosBonus > 0) totalDelta *= (1 + sociosBonus / 100);
    }
  }
  const rounded = Math.round(totalDelta);
  const applied = setClubFansCurrent(clubId, Math.max(0, current + rounded), `Resultado ${resultKey}. Posición ${position}. Entrada ${formatMoney(price)}.`);
  game.fans.history.push({ season:game.seasonNumber || 1, matchday:game.matchdayIndex || 0, date:game.currentDate || '', clubId:Number(clubId), result:resultKey, position, ticketPrice:price, delta:applied, current:clubFansCurrent(clubId) });
  game.fans.history = game.fans.history.slice(-240);
  return applied;
}
function applyFanChangesAfterMatches(results=[]){
  ensureFanState();
  (results || []).forEach(match => {
    const homeResult = match.homeGoals > match.awayGoals ? 'win' : match.homeGoals < match.awayGoals ? 'loss' : 'draw';
    const awayResult = match.awayGoals > match.homeGoals ? 'win' : match.awayGoals < match.homeGoals ? 'loss' : 'draw';
    applyFanChangeForClub(match.homeId, homeResult);
    applyFanChangeForClub(match.awayId, awayResult);
  });
}

function isManagedClubField(clubId, managedClubId=null){
  return Number(clubId) === Number(managedClubId || game?.selectedClubId || 0);
}
function isBotFieldClub(clubId, state=game, managedClubId=null){
  return Number(clubId) !== Number(managedClubId || state?.selectedClubId || 0);
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
    type:'sistema',
    title:'Campos bots corregidos',
    body:`Se detectaron ${summary.detected} campo(s) bot con estado inválido o injugable. El sistema regeneró ${summary.repaired} campo(s) con valores de temporada entre ${BOT_FIELD_MIN_SCORE}/100 y ${BOT_FIELD_MAX_SCORE}/100.`,
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
  const homeName = clubName(match.homeId);
  const isManagedHome = Number(match.homeId) === Number(game?.selectedClubId || 0);
  const fixedText = isManagedHome ? 'Campo propio dinámico' : 'Campo bot fijo esta temporada';
  return `<div class="next-match-field ${fieldConditionClass(score)}">
    <div class="next-match-field-head"><span>Campo de juego</span><strong class="field-state ${fieldConditionClass(score)}">${escapeHtml(label)}</strong></div>
    ${fieldBar(score, label)}
    <small>${escapeHtml(homeName)} · ${score}/100 · ${escapeHtml(fixedText)}</small>
  </div>`;
}
function clubBudgetByPrestige(prestige, prizeMultiplier=1){
  const base = 7000000 + Math.pow(Number(prestige) || 50, 2) * 18000;
  return Math.round(base * (0.75 + prizeMultiplier * 0.65));
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
function playerBaseMedia(prestige, id, group){
  const groupBoost = group === 'POR' ? 1 : group === 'ATT' ? 0 : group === 'MID' ? 0.5 : -0.5;
  return clamp(Math.round(42 + prestige * 0.48 + groupBoost + hashNumber(`media-${id}`, 13) - 6), 35, 94);
}
const FIRST_NAMES = ['Agustín','Mateo','Lautaro','Santiago','Julián','Tomás','Nicolás','Franco','Lucas','Bruno','Facundo','Ezequiel','Ramiro','Iván','Gonzalo','Emiliano','Brian','Thiago','Alan','Pablo','Martín','Leandro'];
const LAST_NAMES = ['Gómez','Rodríguez','Fernández','López','Martínez','Pérez','García','Sánchez','Romero','Torres','Díaz','Alvarez','Ruiz','Ramírez','Aguirre','Molina','Castro','Silva','Rojas','Vera','Acosta','Morales','Herrera','Medina'];
function generatedPlayerName(id, clubNameValue){
  const first = FIRST_NAMES[hashNumber(`${clubNameValue}-${id}-first`, FIRST_NAMES.length)];
  const last = LAST_NAMES[hashNumber(`${clubNameValue}-${id}-last`, LAST_NAMES.length)];
  return `${first} ${last}`;
}
function generatedNationality(id, divisionName){
  return pickNationalityForGeneration(id, divisionName || 'Jugador', null);
}
function skillValue(base, id, label, offset=0){
  return clamp(Math.round(base + offset + hashNumber(`${id}-${label}`, 15) - 7), 1, 99);
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
  const base = {
    key:[],
    common:['resistencia','trabajoEquipo','serenidad','disciplina','liderazgo','potencial'],
    rare:[],
    weak:['porteria']
  };
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
function generateFixturesForDivisions(clubs, divisions, options={}){
  const seasonYear = Math.round(Number(options.seasonYear || SEASON_START_YEAR));
  const sortedDivisions = sortedSeasonDivisions(divisions);
  const schedules = sortedDivisions.map(division => ({
    division,
    rounds:roundRobinSchedule(clubs.filter(c => c.divisionId === division.id), division)
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
    fixtures.push({ matchday:roundIndex+1, date, startDate:dates[0] || date, endDate:dates[dates.length-1] || date, matches });
  }
  return fixtures;
}
function roundRobinSchedule(clubsInDivision, division){
  const teams = clubsInDivision.slice();
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
function normalizeSeasonFixtures(existingFixtures, seasonNumber=1, seasonYear=null){
  const year = Math.round(Number(seasonYear || 0)) || seasonYearForNumber(seasonNumber || 1);
  const expected = generateFixturesForDivisions(seed.clubs || [], sortedSeasonDivisions(seed.divisions || []), { seasonYear:year });
  const current = Array.isArray(existingFixtures) ? existingFixtures : [];
  const playoffRounds = current.filter(fixtureRoundIsPlayoff);
  const regularCurrent = current.filter(round => !fixtureRoundIsPlayoff(round));
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
  return normalizedRegular.concat(playoffRounds);
}


function savedHasDatabaseSnapshots(saved){
  return Boolean(Array.isArray(saved?.clubsSnapshot) && saved.clubsSnapshot.length && Array.isArray(saved?.playersSnapshot) && saved.playersSnapshot.length);
}
async function readLocalSaveRecord(){
  const db = await openDb();
  return new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(SAVE_KEY);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function openDb(){
  return new Promise((resolve,reject)=>{
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(DB_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveLocal(silent=false){
  if(!game) return showNotice('No hay partida para guardar.');
  const db = await openDb();
  await new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(currentSavePayload(), SAVE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  if(!silent) showNotice('Partida guardada en este navegador.');
}
async function loadLocal(silent=false){
  const saved = await readLocalSaveRecord();
  if(saved){
    const currentSignature = seed?.meta?.signature;
    if(currentSignature && saved.seedSignature !== currentSignature && !savedHasDatabaseSnapshots(saved)){
      if(!silent) showNotice('La base de datos cambió y la partida guardada no tiene snapshots suficientes. Creá una nueva partida para usar la base actual.');
      return false;
    }
    if(currentSignature && saved.seedSignature !== currentSignature){
      saved._needsAutosave = true;
    }
    game = normalizeGame(applySavedDatabaseSnapshots(saved));
    const needsAutosave = Boolean(game._needsAutosave);
    const repairedStadiumFields = Boolean(game._stadiumFieldsAutoRepaired);
    delete game._needsAutosave;
    delete game._stadiumFieldsAutoRepaired;
    const botRepair = repairBotRosters({ reason:'load_game' });
    const stadiumRepair = repairInvalidBotFieldStates(game, 'load_game', { message:repairedStadiumFields ? false : true });
    const shouldAutosave = botRepair.created || botRepair.converted || needsAutosave || stadiumRepair.repaired;
    delete game._needsAutosave;
    delete game._stadiumFieldsAutoRepaired;
    activeTab = 'home';
    renderAll();
    if(shouldAutosave) saveLocal(true);
    if(!silent){
      const notice = repairedStadiumFields || stadiumRepair.repaired
        ? 'Partida cargada. Se corrigieron campos bots inválidos.'
        : (needsAutosave ? 'Partida cargada. Se corrigió el arrastre de lesiones.' : 'Partida cargada.');
      showNotice(notice);
    }
    return true;
  }
  if(!silent) showNotice('No hay partida guardada en este navegador.');
  return false;
}
async function resetLocal(){
  const db = await openDb();
  await new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(SAVE_KEY);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  game = null;
  seed = await loadInitialSeed({ skipPlayersDatabase:false });
  fillClubSelect();
  activeTab = 'home';
  renderAll();
  showNotice('Partida local eliminada.');
  setTimeout(()=>openNewGameModal(true), 0);
}

async function init(){
  try{
    const savedRecord = await readLocalSaveRecord().catch(() => null);
    const useSavedSnapshots = savedHasDatabaseSnapshots(savedRecord);
    const [loadedSeed, loadedSponsors, loadedEmployees, loadedEvents, loadedSpecialSkills, loadedMatchCommentary] = await Promise.all([
      loadInitialSeed({ skipPlayersDatabase:useSavedSnapshots }),
      loadSponsorsDatabase(),
      loadEmployeesDatabase(),
      loadEventsDatabase(),
      loadSpecialSkillsDatabase(),
      loadMatchCommentaryDatabase()
    ]);
    seed = loadedSeed;
    sponsorsDatabase = loadedSponsors;
    employeesDatabase = loadedEmployees;
    eventsDatabase = loadedEvents;
    specialSkillsDatabase = loadedSpecialSkills;
    matchCommentaryDatabase = loadedMatchCommentary;
    fillClubSelect();
    bindEvents();
    startUiTicker();
    const loaded = await loadLocal(true);
    if(!loaded){
      if(useSavedSnapshots){
        seed = await loadInitialSeed({ skipPlayersDatabase:false });
        fillClubSelect();
      }
      renderAll();
      setTimeout(()=>openNewGameModal(true), 0);
    }
  }catch(error){
    console.error(error);
    view.innerHTML = `<div class="empty"><h2>Error de carga</h2><p>No se pudo iniciar el juego. Revisá que la publicación esté completa y volvé a intentar.</p></div>`;
  }
}
