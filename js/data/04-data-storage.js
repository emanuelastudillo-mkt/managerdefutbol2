/* V3.15 · Carga de JSON, calendario anual, normalización inicial, persistencia local e inicialización. */

async function fetchJsonIfExists(url){
  try{
    const res = await fetch(url, { cache:'no-store' });
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
  seedData.players = normalized;
  seedData.meta = { ...(seedData.meta || {}), playersSource:database.source, playersDatabaseVersion:database.raw?.metadata?.version || 'local', playersDatabaseValidation:database.raw?.validation || databaseValidationCounts(normalized) };
  seedData.meta.signature = `${seedSignature(seedData)}-${playersDatabaseHash(normalized)}`;
  return seedData;
}
function applySavedDatabaseSnapshots(saved){
  const clean = { ...(saved || {}) };
  if(Array.isArray(saved?.clubsSnapshot) && saved.clubsSnapshot.length){
    seed.clubs = saved.clubsSnapshot.map(club => ({ ...club, fieldConditionScore:Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club), fieldCondition:club.fieldCondition || fieldConditionName(club.fieldConditionScore || initialFieldScore(club)), crestPath:club.crestPath || `img/escudos/${imageSlug(club.name)}.png` }));
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
  const payload = structuredClone(game);
  payload.seedSignature = seed?.meta?.signature || payload.seedSignature || '';
  payload.playersSnapshot = structuredClone(seed?.players || []);
  payload.clubsSnapshot = structuredClone(seed?.clubs || []);
  payload.divisionsSnapshot = structuredClone(seed?.divisions || []);
  return payload;
}
async function loadInitialSeed(){
  const playersDatabase = await loadPlayersDatabase();
  for(const url of LEAGUE_DATA_CANDIDATES){
    const leagueJson = await fetchJsonIfExists(url);
    if(leagueJson){
      const built = buildSeedFromLigaArgentina(leagueJson, url);
      return applyPlayersDatabase(built, playersDatabase);
    }
  }
  const fallback = await fetchJsonIfExists(DATA_URL);
  if(fallback && Array.isArray(fallback.clubs) && Array.isArray(fallback.players) && Array.isArray(fallback.fixtures)){
    fallback.meta = { ...(fallback.meta || {}), source:fallback.meta?.source || 'seed.json', signature:seedSignature(fallback) };
    fallback.clubs = fallback.clubs.map(c => ({ ...c, divisionId:c.divisionId || 'default', divisionName:c.divisionName || 'Liga única', prizeMultiplier:c.prizeMultiplier ?? 1, fieldConditionScore:c.fieldConditionScore || initialFieldScore(c), fieldCondition:fieldConditionName(c.fieldConditionScore || initialFieldScore(c)), crestPath:c.crestPath || `img/escudos/${imageSlug(c.name)}.png` }));
    fallback.divisions = fallback.divisions || [{ id:'default', name:'Liga única', order:1, prizeMultiplier:1 }];
    fallback.players = (fallback.players || []).map(player => ensurePlayerEconomics({ ...player, position:normalizePlayerPosition(player.position, player.id) }));
    return applyPlayersDatabase(fallback, playersDatabase);
  }
  throw new Error('No se pudo cargar data/Liga argentina.json ni un data/seed.json válido');
}
function buildSeedFromLigaArgentina(raw, sourceUrl){
  const divisions = extractLeagueDivisions(raw);
  if(!divisions.length) throw new Error('El JSON de Liga argentina no tiene divisiones o equipos reconocibles.');
  const normalizedDivisions = divisions.map((division, index) => {
    const name = normalizeDivisionName(division.name || division.nombre || division.division || `División ${index+1}`);
    return {
      id: slugId(name),
      name,
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
      const club = {
        id:clubId,
        name,
        short:clubShortFromName(name),
        city:team.city || team.ciudad || '',
        reputation:prestige,
        budget:clubBudgetByPrestige(prestige, divInfo.prizeMultiplier),
        primaryColor:team.color || team.primaryColor || deterministicColor(name),
        divisionId:divInfo.id,
        divisionName:divInfo.name,
        divisionOrder:divInfo.order,
        prizeMultiplier:divInfo.prizeMultiplier,
        fieldConditionScore,
        fieldCondition,
        crestPath:team.escudo || team.crestPath || `img/escudos/${imageSlug(name)}.png`
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
  seed.clubs.forEach(club => { fields[club.id] = Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club); });
  return { fields, projects:{} };
}
function ensureStadiumState(){
  if(!game) return;
  if(!game.stadium) game.stadium = createInitialStadiumState();
  if(!game.stadium.fields) game.stadium.fields = {};
  if(!game.stadium.projects) game.stadium.projects = {};
  seed.clubs.forEach(club => {
    if(!Number.isFinite(game.stadium.fields[club.id])) game.stadium.fields[club.id] = Number.isFinite(club.fieldConditionScore) ? club.fieldConditionScore : initialFieldScore(club);
  });
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
function fieldBar(score, label=''){
  const value = clamp(Math.round(score), 1, 100);
  return `<div class="field-bar ${fieldConditionClass(value)}" title="${escapeHtml(label || fieldConditionName(value))} ${value}/100"><span style="width:${value}%"></span><em>${value}/100</em></div>`;
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
      salaryFactor:1
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
  const schedules = sortedDivisions.map(division => roundRobinSchedule(clubs.filter(c => c.divisionId === division.id), division));
  const maxRounds = Math.max(...schedules.map(s => s.length), 0);
  const firstLeagueDate = leagueStartDateForSeason(seasonYear);
  const fixtures = [];
  for(let roundIndex=0; roundIndex<maxRounds; roundIndex++){
    const date = addDaysToIsoDate(firstLeagueDate, roundIndex * DAYS_PER_ADVANCE);
    const matches = [];
    schedules.forEach(schedule => {
      (schedule[roundIndex] || []).forEach(match => matches.push({ ...match, date }));
    });
    fixtures.push({ matchday:roundIndex+1, date, matches });
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
function normalizeSeasonFixtures(existingFixtures, seasonNumber=1, seasonYear=null){
  const year = Math.round(Number(seasonYear || 0)) || seasonYearForNumber(seasonNumber || 1);
  const expected = generateFixturesForDivisions(seed.clubs || [], sortedSeasonDivisions(seed.divisions || []), { seasonYear:year });
  const current = Array.isArray(existingFixtures) ? existingFixtures : [];
  const currentYear = String(current?.[0]?.date || '').slice(0,4);
  const needsCalendar = current.length !== expected.length || currentYear !== String(year) || current.some(round => !validIsoDate(round.date));
  return needsCalendar ? mergePlayedFixturesIntoCalendar(expected, current) : current;
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
  const db = await openDb();
  const saved = await new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readonly');
    const req = tx.objectStore(DB_STORE).get(SAVE_KEY);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  if(saved){
    const currentSignature = seed?.meta?.signature;
    if(currentSignature && saved.seedSignature !== currentSignature){
      if(!silent) showNotice('La base de datos cambió. Creá una nueva partida para usar la Liga argentina.');
      return false;
    }
    game = normalizeGame(applySavedDatabaseSnapshots(saved));
    const botRepair = repairBotRosters({ reason:'load_game' });
    activeTab = 'home';
    renderAll();
    if(botRepair.created || botRepair.converted) saveLocal(true);
    if(!silent) showNotice('Partida cargada.');
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
  activeTab = 'home';
  renderAll();
  showNotice('Partida local eliminada.');
  setTimeout(()=>openNewGameModal(true), 0);
}

async function init(){
  try{
    seed = await loadInitialSeed();
    sponsorsDatabase = await loadSponsorsDatabase();
    employeesDatabase = await loadEmployeesDatabase();
    fillClubSelect();
    bindEvents();
    startUiTicker();
    const loaded = await loadLocal(true);
    if(!loaded){
      renderAll();
      setTimeout(()=>openNewGameModal(true), 0);
    }
  }catch(error){
    console.error(error);
    view.innerHTML = `<div class="empty"><h2>Error de carga</h2><p>${escapeHtml(error.message)}. Subí <code>data/Liga argentina.json</code> o un <code>data/seed.json</code> válido y ejecutá el proyecto con GitHub Pages o servidor local.</p></div>`;
  }
}
