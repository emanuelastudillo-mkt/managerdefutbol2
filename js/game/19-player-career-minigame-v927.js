/*
  V9.27 · Minijuego «Ser jugador»
  Estado aislado dentro de game.miniGames.playerCareer.
  Lee clubes, divisiones, países, escudos y prestigio del universo principal,
  pero nunca modifica calendario, planteles, economía, resultados ni mensajes del mánager.
*/

let playerCareerViewMode = 'summary';

const PLAYER_CAREER_SCHEMA_VERSION = 1;
const PLAYER_CAREER_POSITIONS = ['POR','DFC','LI','LD','MCD','MC','MCO','MI','MD','DC','EI','ED'];
const PLAYER_CAREER_PROFILES = {
  technical:{ label:'Técnico', growth:1.08, physical:0.94 },
  physical:{ label:'Físico', growth:0.98, physical:1.10 },
  balanced:{ label:'Equilibrado', growth:1.02, physical:1.02 }
};
const PLAYER_CAREER_STAGE_LABELS = [
  'Pretemporada',
  'Primer tramo',
  'Segundo tramo',
  'Tramo decisivo',
  'Cierre de temporada',
  'Mercado de pases'
];
const PLAYER_CAREER_MATCHES_BY_STAGE = { 1:8, 2:9, 3:9, 4:8 };
const PLAYER_CAREER_POSITION_OUTPUT = {
  POR:{ goals:0.001, assists:0.008, cards:0.035, ratingBias:0.05 },
  DFC:{ goals:0.025, assists:0.020, cards:0.115, ratingBias:0.02 },
  LI:{ goals:0.035, assists:0.075, cards:0.090, ratingBias:0.02 },
  LD:{ goals:0.035, assists:0.075, cards:0.090, ratingBias:0.02 },
  MCD:{ goals:0.045, assists:0.065, cards:0.120, ratingBias:0.03 },
  MC:{ goals:0.090, assists:0.125, cards:0.080, ratingBias:0.06 },
  MCO:{ goals:0.170, assists:0.190, cards:0.055, ratingBias:0.08 },
  MI:{ goals:0.145, assists:0.175, cards:0.055, ratingBias:0.06 },
  MD:{ goals:0.145, assists:0.175, cards:0.055, ratingBias:0.06 },
  EI:{ goals:0.235, assists:0.155, cards:0.050, ratingBias:0.07 },
  ED:{ goals:0.235, assists:0.155, cards:0.050, ratingBias:0.07 },
  DC:{ goals:0.370, assists:0.105, cards:0.060, ratingBias:0.05 }
};
const PLAYER_CAREER_INJURIES = [
  { name:'Molestia muscular', blocks:1, severity:'Leve' },
  { name:'Distensión', blocks:1, severity:'Leve' },
  { name:'Esguince de tobillo', blocks:2, severity:'Media' },
  { name:'Lesión muscular', blocks:2, severity:'Media' },
  { name:'Lesión de rodilla', blocks:3, severity:'Alta' }
];

function pcClamp(value, min, max){
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : min));
}
function pcRound(value, digits=0){
  const factor = 10 ** Math.max(0, Number(digits || 0));
  return Math.round(Number(value || 0) * factor) / factor;
}
function pcEscape(value){
  return typeof escapeHtml === 'function'
    ? escapeHtml(String(value ?? ''))
    : String(value ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
}
function pcFormatNumber(value){
  return typeof formatPlainNumber === 'function' ? formatPlainNumber(Math.round(Number(value || 0))) : Math.round(Number(value || 0)).toLocaleString('es-AR');
}
function pcMoney(value){
  const amount = Math.max(0, Math.round(Number(value || 0)));
  return `$${amount.toLocaleString('es-AR')}`;
}
function pcSeedFromText(text){
  let hash = 2166136261;
  for(const char of String(text || '')){
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0 || 0x9e3779b9;
}
function pcRandom(state){
  let seedValue = Number(state?.rngSeed || 0) >>> 0;
  if(!seedValue) seedValue = pcSeedFromText(`${state?.player?.name || 'jugador'}-${state?.season?.year || 2026}`);
  seedValue = (Math.imul(seedValue, 1664525) + 1013904223) >>> 0;
  state.rngSeed = seedValue;
  return seedValue / 4294967296;
}
function pcRandomBetween(state, min, max){ return Number(min) + (Number(max) - Number(min)) * pcRandom(state); }
function pcRandomInt(state, min, max){ return Math.floor(pcRandomBetween(state, min, Number(max) + 1)); }
function pcChance(state, probability){ return pcRandom(state) < pcClamp(probability, 0, 1); }
function pcPick(state, list){ return Array.isArray(list) && list.length ? list[Math.floor(pcRandom(state) * list.length)] : null; }
function pcUniqueId(state, prefix='pc'){
  state.sequence = Math.max(0, Math.round(Number(state.sequence || 0))) + 1;
  return `${prefix}-${state.season?.number || 1}-${state.sequence}`;
}

function pcClubById(id){
  return (seed?.clubs || []).find(club => Number(club.id) === Number(id)) || null;
}
function pcDivisionById(id){
  return (seed?.divisions || []).find(division => String(division.id || '') === String(id || '')) || null;
}
function pcClubCountry(club){
  if(!club) return '';
  if(typeof clubCountry === 'function') return String(clubCountry(club) || '');
  return String(club.country || club.pais || '');
}
function pcClubReputation(club){ return pcClamp(Number(club?.reputation ?? club?.prestige ?? 50), 1, 100); }
function pcClubSnapshot(club){
  if(!club) return { id:0, name:'Sin club', country:'', divisionId:'', divisionName:'', reputation:35, crestPath:'' };
  const division = pcDivisionById(club.divisionId);
  return {
    id:Number(club.id || 0),
    name:String(club.name || 'Club'),
    country:pcClubCountry(club),
    divisionId:String(club.divisionId || ''),
    divisionName:String(division?.name || club.divisionName || 'Liga'),
    reputation:pcClubReputation(club),
    crestPath:String(club.crestPath || '')
  };
}
function pcClubBadge(snapshot, className='player-career-club-badge'){
  if(snapshot?.id && typeof clubBadge === 'function') return clubBadge(snapshot.id);
  const name = String(snapshot?.name || 'Club');
  return `<span class="${pcEscape(className)} player-career-badge-fallback" aria-hidden="true">${pcEscape(name.slice(0,2).toUpperCase())}</span>`;
}
function pcCountries(){
  return Array.from(new Set((seed?.clubs || []).map(pcClubCountry).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es'));
}
function pcIsSpecialBotClub(club){
  if(!club) return true;
  if(Boolean(club.specialBot || club.isSpecialBot || club.clubWorldCupOnly || club.noLeague)) return true;
  const division = pcDivisionById(club.divisionId);
  return !division || !String(club.divisionId || '').trim();
}
function pcInitialClubOptions(nationality='', position=''){
  const desiredCountry = String(nationality || '').trim();
  const desiredPosition = PLAYER_CAREER_POSITIONS.includes(position) ? position : '';
  const positionCount = club => desiredPosition ? (seed?.players || []).filter(player => Number(player.clubId) === Number(club.id) && String(player.position || '') === desiredPosition).length : 0;
  const eligible = (seed?.clubs || []).filter(club => {
    if(pcIsSpecialBotClub(club)) return false;
    const reputation = pcClubReputation(club);
    return reputation >= 35 && reputation <= 74;
  });
  const sameCountry = eligible
    .filter(club => pcClubCountry(club) === desiredCountry)
    .sort((a,b) => positionCount(a) - positionCount(b) || pcClubReputation(a) - pcClubReputation(b) || String(a.name).localeCompare(String(b.name),'es'));
  const fallback = eligible
    .filter(club => pcClubCountry(club) !== desiredCountry)
    .sort((a,b) => positionCount(a) - positionCount(b) || pcClubReputation(a) - pcClubReputation(b) || String(a.name).localeCompare(String(b.name),'es'));
  return sameCountry.slice(0,18).concat(fallback.slice(0, Math.max(0, 18 - sameCountry.length)));
}
function pcInitialClubOptionMarkup(nationality, selectedId=0, position=''){
  const options = pcInitialClubOptions(nationality, position);
  if(!options.length) return '<option value="0">No hay clubes disponibles</option>';
  return options.map(club => {
    const division = pcDivisionById(club.divisionId);
    const selected = Number(selectedId) === Number(club.id) ? ' selected' : '';
    return `<option value="${Number(club.id)}"${selected}>${pcEscape(club.name)} · ${pcEscape(pcClubCountry(club))} · ${pcEscape(division?.name || 'Liga')} · Prestigio ${Math.round(pcClubReputation(club))}</option>`;
  }).join('');
}

function pcEmptyStats(){
  return { matches:0, starts:0, minutes:0, goals:0, assists:0, yellow:0, red:0, ratingSum:0, ratingCount:0, bestRating:0 };
}
function pcNormalizeStats(stats){
  const base = pcEmptyStats();
  Object.keys(base).forEach(key => { base[key] = Math.max(0, Number(stats?.[key] || 0)); });
  return base;
}
function pcAverageRating(stats){ return Number(stats?.ratingCount || 0) > 0 ? Number(stats.ratingSum || 0) / Number(stats.ratingCount || 1) : 0; }
function pcAddStats(target, delta){
  const normalized = pcNormalizeStats(target);
  Object.keys(normalized).forEach(key => {
    if(key === 'bestRating') normalized[key] = Math.max(Number(normalized[key] || 0), Number(delta?.[key] || 0));
    else normalized[key] = Number(normalized[key] || 0) + Number(delta?.[key] || 0);
  });
  return normalized;
}
function pcNormalizeClubSnapshot(club){
  if(!club || typeof club !== 'object') return pcClubSnapshot(null);
  const current = pcClubById(club.id);
  return current ? pcClubSnapshot(current) : {
    id:Number(club.id || 0),
    name:String(club.name || 'Club'),
    country:String(club.country || ''),
    divisionId:String(club.divisionId || ''),
    divisionName:String(club.divisionName || 'Liga'),
    reputation:pcClamp(club.reputation || 50,1,100),
    crestPath:String(club.crestPath || '')
  };
}
function pcDefaultCompetitions(state){
  const club = state.club;
  const leagueName = club.divisionName || 'Liga';
  const cupName = typeof nationalCupNameForCountry === 'function'
    ? (nationalCupNameForCountry(club.country) || 'Copa nacional')
    : 'Copa nacional';
  const internationalActive = Number(club.reputation || 0) >= 80 || Number(state.player?.reputation || 0) >= 68;
  const worldCupActive = (Number(state.season?.number || 1) % 4 === 0) && Number(club.reputation || 0) >= 86;
  return {
    league:{ name:leagueName, type:'league', active:true, played:0, points:0, wins:0, draws:0, losses:0, position:null, status:'Por comenzar', champion:false },
    nationalCup:{ name:cupName, type:'nationalCup', active:true, status:'Por comenzar', round:'Primera ronda', champion:false },
    international:{ name:'Copa internacional', type:'international', active:internationalActive, status:internationalActive ? 'Por comenzar' : 'No clasificado', round:internationalActive ? 'Fase inicial' : '—', champion:false },
    clubWorldCup:{ name:'Mundial de Clubes', type:'clubWorldCup', active:worldCupActive, status:worldCupActive ? 'Por comenzar' : 'No clasificado', round:worldCupActive ? 'Fase de grupos' : '—', champion:false }
  };
}
function pcCreateSeason(state, number, year){
  const season = {
    number:Math.max(1, Math.round(Number(number || 1))),
    year:Math.max(2020, Math.round(Number(year || 2026))),
    stage:0,
    stageLabel:PLAYER_CAREER_STAGE_LABELS[0],
    stats:pcEmptyStats(),
    competitions:null,
    completed:false,
    summary:null,
    blockLog:[]
  };
  state.season = season;
  season.competitions = pcDefaultCompetitions(state);
  return season;
}
function pcCalculateValue(state){
  const player = state.player || {};
  const age = Number(player.age || 18);
  const ageFactor = age <= 23 ? 1.55 : age <= 28 ? 1.25 : age <= 31 ? 1.0 : age <= 34 ? 0.70 : 0.45;
  const levelFactor = Math.pow(Math.max(1, Number(player.overall || 50)) / 50, 4.15);
  const reputationFactor = 0.75 + Number(player.reputation || 0) / 140;
  const formFactor = 0.80 + Number(player.form || 50) / 250;
  return Math.max(100000, Math.round(350000 * levelFactor * ageFactor * reputationFactor * formFactor / 50000) * 50000);
}
function pcCreatePlayerCareer(form){
  const club = pcClubById(form.clubId);
  const age = pcClamp(Math.round(Number(form.age || 17)), 16, 19);
  const profileKey = PLAYER_CAREER_PROFILES[form.profile] ? form.profile : 'balanced';
  const seedValue = pcSeedFromText(`${form.name}-${form.nationality}-${club?.id || 0}-${Date.now()}`);
  const provisional = { rngSeed:seedValue, sequence:0 };
  const baseOverall = pcClamp(48 + (age - 16) * 1.3 + pcRandomBetween(provisional, 0, 5), 48, 58);
  const potential = pcClamp(baseOverall + pcRandomBetween(provisional, 17, 33), 68, 92);
  const state = {
    schemaVersion:PLAYER_CAREER_SCHEMA_VERSION,
    status:'active',
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    rngSeed:provisional.rngSeed,
    sequence:0,
    viewVersion:'V9.27',
    player:{
      id:`pc-player-${seedValue}`,
      name:String(form.name || '').trim(),
      nationality:String(form.nationality || '').trim(),
      age,
      position:PLAYER_CAREER_POSITIONS.includes(form.position) ? form.position : 'MC',
      foot:form.foot === 'Izquierda' ? 'Izquierda' : 'Derecha',
      profile:profileKey,
      overall:pcRound(baseOverall,1),
      potential:pcRound(potential,1),
      regularity:pcRandomInt(provisional,45,88),
      professionalism:pcRandomInt(provisional,42,90),
      pressure:pcRandomInt(provisional,38,88),
      injuryProneness:pcRandomInt(provisional,25,78),
      adaptation:pcRandomInt(provisional,45,88),
      condition:pcRandomInt(provisional,84,96),
      morale:pcRandomInt(provisional,70,88),
      form:pcRandomInt(provisional,55,72),
      reputation:pcRandomInt(provisional,8,18),
      value:0,
      growthProgress:0,
      extraGrowth:0,
      trust:pcRandomInt(provisional,28,42),
      leadership:pcRandomInt(provisional,20,55)
    },
    club:pcClubSnapshot(club),
    contract:{ yearsRemaining:3, salary:Math.round((150000 + baseOverall * 12000) / 1000) * 1000, role:'Promesa' },
    season:null,
    careerStats:pcEmptyStats(),
    history:{ seasons:[], clubs:[], transfers:[], titles:[], injuries:[], decisions:[], events:[] },
    memory:{ tags:{}, counters:{} },
    injury:null,
    pendingDecision:null,
    pendingOffers:[],
    loan:null,
    retirement:null,
    lastBlockSummary:null
  };
  state.rngSeed = provisional.rngSeed;
  state.player.value = pcCalculateValue(state);
  state.history.clubs.push({ club:{...state.club}, fromSeason:1, toSeason:null, type:'Inicio de carrera' });
  state.history.events.push({ id:pcUniqueId(state,'event'), season:1, year:Number(game?.seasonYear || new Date().getFullYear()), type:'career', text:`Comenzó su carrera profesional en ${state.club.name}.` });
  pcCreateSeason(state, 1, Number(game?.seasonYear || new Date().getFullYear()));
  return state;
}
function pcNormalizeCareer(raw){
  if(!raw || typeof raw !== 'object') return null;
  const normalized = { ...raw };
  normalized.schemaVersion = PLAYER_CAREER_SCHEMA_VERSION;
  normalized.status = ['active','retired'].includes(normalized.status) ? normalized.status : 'active';
  normalized.rngSeed = Number(normalized.rngSeed || pcSeedFromText(normalized.player?.name || 'jugador')) >>> 0;
  normalized.sequence = Math.max(0, Math.round(Number(normalized.sequence || 0)));
  normalized.player = { ...(normalized.player || {}) };
  normalized.player.name = String(normalized.player.name || 'Jugador');
  normalized.player.nationality = String(normalized.player.nationality || 'Argentina');
  normalized.player.age = pcClamp(normalized.player.age || 18, 16, 45);
  normalized.player.position = PLAYER_CAREER_POSITIONS.includes(normalized.player.position) ? normalized.player.position : 'MC';
  normalized.player.foot = normalized.player.foot === 'Izquierda' ? 'Izquierda' : 'Derecha';
  normalized.player.profile = PLAYER_CAREER_PROFILES[normalized.player.profile] ? normalized.player.profile : 'balanced';
  normalized.player.overall = pcClamp(normalized.player.overall || 50, 1, 99);
  normalized.player.potential = pcClamp(normalized.player.potential || Math.max(normalized.player.overall,75), normalized.player.overall, 99);
  ['regularity','professionalism','pressure','injuryProneness','adaptation','condition','morale','form','reputation','trust','leadership'].forEach(key => {
    normalized.player[key] = pcClamp(normalized.player[key] ?? 50, 0, 100);
  });
  normalized.player.growthProgress = Number(normalized.player.growthProgress || 0);
  normalized.player.extraGrowth = Number(normalized.player.extraGrowth || 0);
  normalized.club = pcNormalizeClubSnapshot(normalized.club);
  normalized.contract = { yearsRemaining:Math.max(0,Math.round(Number(normalized.contract?.yearsRemaining ?? 2))), salary:Math.max(0,Math.round(Number(normalized.contract?.salary || 0))), role:String(normalized.contract?.role || 'Rotación') };
  normalized.careerStats = pcNormalizeStats(normalized.careerStats);
  normalized.history = normalized.history && typeof normalized.history === 'object' ? normalized.history : {};
  ['seasons','clubs','transfers','titles','injuries','decisions','events'].forEach(key => { normalized.history[key] = Array.isArray(normalized.history[key]) ? normalized.history[key] : []; });
  normalized.memory = normalized.memory && typeof normalized.memory === 'object' ? normalized.memory : { tags:{}, counters:{} };
  normalized.memory.tags = normalized.memory.tags && typeof normalized.memory.tags === 'object' ? normalized.memory.tags : {};
  normalized.memory.counters = normalized.memory.counters && typeof normalized.memory.counters === 'object' ? normalized.memory.counters : {};
  normalized.injury = normalized.injury && typeof normalized.injury === 'object' && Number(normalized.injury.blocksRemaining || 0) > 0 ? { ...normalized.injury, blocksRemaining:Math.max(1,Math.round(Number(normalized.injury.blocksRemaining || 1))) } : null;
  normalized.pendingDecision = normalized.pendingDecision && typeof normalized.pendingDecision === 'object' ? normalized.pendingDecision : null;
  normalized.pendingOffers = Array.isArray(normalized.pendingOffers) ? normalized.pendingOffers : [];
  normalized.loan = normalized.loan && typeof normalized.loan === 'object' ? normalized.loan : null;
  normalized.retirement = normalized.retirement && typeof normalized.retirement === 'object' ? normalized.retirement : null;
  normalized.lastBlockSummary = normalized.lastBlockSummary && typeof normalized.lastBlockSummary === 'object' ? normalized.lastBlockSummary : null;
  const seasonNumber = Math.max(1,Math.round(Number(normalized.season?.number || 1)));
  const seasonYear = Math.max(2020,Math.round(Number(normalized.season?.year || game?.seasonYear || 2026)));
  normalized.season = normalized.season && typeof normalized.season === 'object' ? { ...normalized.season } : {};
  normalized.season.number = seasonNumber;
  normalized.season.year = seasonYear;
  normalized.season.stage = pcClamp(Math.round(Number(normalized.season.stage || 0)),0,5);
  normalized.season.stageLabel = PLAYER_CAREER_STAGE_LABELS[normalized.season.stage];
  normalized.season.stats = pcNormalizeStats(normalized.season.stats);
  normalized.season.blockLog = Array.isArray(normalized.season.blockLog) ? normalized.season.blockLog : [];
  normalized.season.competitions = normalized.season.competitions && typeof normalized.season.competitions === 'object' ? normalized.season.competitions : pcDefaultCompetitions(normalized);
  normalized.player.value = pcCalculateValue(normalized);
  return normalized;
}
function pcCareerState(){ return game?.miniGames?.playerCareer ? pcNormalizeCareer(game.miniGames.playerCareer) : null; }
function pcSetCareerState(state){
  if(!game) return null;
  game.miniGames = game.miniGames && typeof game.miniGames === 'object' ? game.miniGames : {};
  game.miniGames.playerCareer = state ? pcNormalizeCareer(state) : null;
  return game.miniGames.playerCareer;
}
function pcPersist(state, render=true){
  if(!game || !state) return;
  state.updatedAt = new Date().toISOString();
  pcSetCareerState(state);
  if(typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>undefined);
  if(render && typeof renderPlayerCareer === 'function') renderPlayerCareer();
}

function pcProfileLabel(state){ return PLAYER_CAREER_PROFILES[state?.player?.profile]?.label || 'Equilibrado'; }
function pcStageProgress(state){ return pcClamp((Number(state?.season?.stage || 0) / 5) * 100,0,100); }
function pcCurrentRole(state){
  const stats = state?.season?.stats || {};
  const matches = Number(stats.matches || 0);
  const starts = Number(stats.starts || 0);
  if(matches <= 0) return state?.contract?.role || 'Promesa';
  const startRate = starts / Math.max(1,matches);
  if(startRate >= 0.78) return 'Titular';
  if(startRate >= 0.42) return 'Rotación';
  return 'Suplente';
}
function pcRiskLabel(value){
  const number = Number(value || 0);
  if(number < 25) return 'Bajo';
  if(number < 55) return 'Medio';
  return 'Alto';
}
function pcRatingLabel(value){ return Number(value || 0) > 0 ? pcRound(value,2).toFixed(2) : '—'; }
function pcRecordEvent(state, type, text, extra={}){
  state.history.events.unshift({ id:pcUniqueId(state,'event'), season:state.season.number, year:state.season.year, type:String(type || 'general'), text:String(text || ''), ...extra });
  state.history.events = state.history.events.slice(0,200);
}
function pcRecordDecision(state, decision, option){
  state.history.decisions.unshift({
    id:pcUniqueId(state,'decision'),
    season:state.season.number,
    year:state.season.year,
    category:decision.category,
    title:decision.title,
    choice:option.label,
    consequence:option.consequence || option.description || ''
  });
  state.history.decisions = state.history.decisions.slice(0,120);
}
function pcIncrementMemory(state, key, amount=1){
  state.memory.counters[key] = Number(state.memory.counters[key] || 0) + Number(amount || 0);
}
function pcSetMemory(state, key, value=true){ state.memory.tags[key] = value; }

function pcDecisionPool(state, forcedCategory=''){
  const injured = Boolean(state.injury);
  const options = [];
  if(injured){
    options.push({
      id:'health-recovery', category:'Salud', title:'El cuerpo médico define el regreso',
      text:`La recuperación de ${state.injury.name} entra en una etapa importante. El club espera una decisión prudente.`,
      options:[
        { id:'health-patient', label:'Cumplir todo el plan médico', risk:'Bajo', consequence:'Mejora la recuperación y reduce recaídas.', effect:'health_patient' },
        { id:'health-treatment', label:'Aceptar un tratamiento intensivo', risk:'Medio', consequence:'Puede acortar el proceso con desgaste adicional.', effect:'health_treatment' },
        { id:'health-early', label:'Intentar volver antes', risk:'Alto', consequence:'Acelera el regreso, pero aumenta el riesgo de recaída.', effect:'health_early' }
      ]
    });
  }
  options.push(
    {
      id:'training-plan', category:'Entrenamiento', title:'Plan individual para las próximas semanas',
      text:'El preparador físico ofrece tres caminos para el siguiente bloque de trabajo.',
      options:[
        { id:'training-extra', label:'Entrenamiento extra', risk:'Medio', consequence:'Más progreso técnico, con mayor desgaste.', effect:'training_extra' },
        { id:'training-balance', label:'Trabajo equilibrado', risk:'Bajo', consequence:'Progreso moderado sin alterar demasiado la forma.', effect:'training_balance' },
        { id:'training-recovery', label:'Priorizar recuperación', risk:'Bajo', consequence:'Mejora el estado físico y reduce el riesgo inmediato.', effect:'training_recovery' }
      ]
    },
    {
      id:'coach-role', category:'Entrenador', title:'Conversación sobre tu lugar en el equipo',
      text:'El entrenador quiere saber cómo asumís tu rol actual dentro del plantel.',
      options:[
        { id:'coach-minutes', label:'Pedir más minutos', risk:'Medio', consequence:'Puede aumentar tu protagonismo o tensar la relación.', effect:'coach_minutes' },
        { id:'coach-role', label:'Aceptar el rol y trabajar', risk:'Bajo', consequence:'Mejora la confianza del cuerpo técnico.', effect:'coach_accept' },
        { id:'coach-tactical', label:'Ofrecerte para otra posición', risk:'Bajo', consequence:'Mejora adaptación y opciones de titularidad.', effect:'coach_tactical' }
      ]
    },
    {
      id:'press-expectations', category:'Prensa', title:'La prensa pregunta por tus objetivos',
      text:'Una entrevista breve puede influir en tu reputación, confianza y presión futura.',
      options:[
        { id:'press-humble', label:'Hablar del equipo', risk:'Bajo', consequence:'Respuesta prudente y bien recibida en el vestuario.', effect:'press_humble' },
        { id:'press-ambitious', label:'Marcar objetivos altos', risk:'Medio', consequence:'Aumenta la exposición y la exigencia.', effect:'press_ambitious' },
        { id:'press-silence', label:'Evitar declaraciones', risk:'Bajo', consequence:'No genera ruido, pero tampoco mejora tu imagen.', effect:'press_silence' }
      ]
    },
    {
      id:'dressing-room', category:'Vestuario', title:'Un referente te pone a prueba',
      text:'Un jugador experimentado cuestiona tu actitud en un entrenamiento intenso.',
      options:[
        { id:'room-listen', label:'Escuchar y aprender', risk:'Bajo', consequence:'Mejora la integración y el profesionalismo.', effect:'room_listen' },
        { id:'room-respond', label:'Responder con firmeza', risk:'Medio', consequence:'Puede darte respeto o generar tensión.', effect:'room_respond' },
        { id:'room-support', label:'Ayudar al grupo después', risk:'Bajo', consequence:'Fortalece liderazgo y confianza colectiva.', effect:'room_support' }
      ]
    }
  );
  if(forcedCategory){
    const matching = options.filter(item => item.category === forcedCategory);
    if(matching.length) return pcPick(state,matching);
  }
  return pcPick(state, options);
}
function pcCreateDecision(state, forcedCategory=''){
  const template = pcDecisionPool(state, forcedCategory);
  if(!template) return null;
  state.pendingDecision = { ...template, instanceId:pcUniqueId(state,'pending'), createdSeason:state.season.number, createdStage:state.season.stage };
  return state.pendingDecision;
}
function pcApplyDecisionEffect(state, effect){
  const player = state.player;
  switch(effect){
    case 'training_extra':
      player.condition = pcClamp(player.condition - 12,0,100);
      player.growthProgress += 0.42;
      player.form = pcClamp(player.form + 4,0,100);
      pcIncrementMemory(state,'intenseTraining');
      pcSetMemory(state,'injuryRiskNextBlock',true);
      break;
    case 'training_balance':
      player.growthProgress += 0.22;
      player.condition = pcClamp(player.condition + 2,0,100);
      player.form = pcClamp(player.form + 2,0,100);
      break;
    case 'training_recovery':
      player.condition = pcClamp(player.condition + 17,0,100);
      player.morale = pcClamp(player.morale + 2,0,100);
      pcSetMemory(state,'protectedNextBlock',true);
      break;
    case 'coach_minutes': {
      const rating = pcAverageRating(state.season.stats);
      const positive = rating >= 6.7 || state.season.stats.matches <= 2 || pcChance(state,0.45);
      player.trust = pcClamp(player.trust + (positive ? 7 : -6),0,100);
      player.morale = pcClamp(player.morale + (positive ? 5 : -4),0,100);
      pcIncrementMemory(state,'askedMinutes');
      break;
    }
    case 'coach_accept':
      player.trust = pcClamp(player.trust + 8,0,100);
      player.professionalism = pcClamp(player.professionalism + 1,0,100);
      player.morale = pcClamp(player.morale + 2,0,100);
      break;
    case 'coach_tactical':
      player.adaptation = pcClamp(player.adaptation + 3,0,100);
      player.trust = pcClamp(player.trust + 4,0,100);
      player.growthProgress += 0.12;
      pcSetMemory(state,'versatile',true);
      break;
    case 'press_humble':
      player.morale = pcClamp(player.morale + 3,0,100);
      player.trust = pcClamp(player.trust + 2,0,100);
      player.reputation = pcClamp(player.reputation + 1,0,100);
      break;
    case 'press_ambitious':
      player.reputation = pcClamp(player.reputation + 3,0,100);
      player.morale = pcClamp(player.morale + (pcChance(state,0.55) ? 4 : -3),0,100);
      pcSetMemory(state,'publicAmbition',true);
      break;
    case 'press_silence':
      player.pressure = pcClamp(player.pressure + 1,0,100);
      break;
    case 'room_listen':
      player.professionalism = pcClamp(player.professionalism + 2,0,100);
      player.trust = pcClamp(player.trust + 3,0,100);
      break;
    case 'room_respond':
      player.leadership = pcClamp(player.leadership + 3,0,100);
      player.morale = pcClamp(player.morale + (pcChance(state,0.5) ? 4 : -5),0,100);
      player.trust = pcClamp(player.trust + (pcChance(state,0.45) ? 2 : -4),0,100);
      break;
    case 'room_support':
      player.leadership = pcClamp(player.leadership + 4,0,100);
      player.trust = pcClamp(player.trust + 5,0,100);
      player.morale = pcClamp(player.morale + 4,0,100);
      break;
    case 'health_patient':
      if(state.injury) state.injury.recurrenceRisk = pcClamp(Number(state.injury.recurrenceRisk || 20) - 12,0,100);
      player.morale = pcClamp(player.morale + 2,0,100);
      break;
    case 'health_treatment':
      if(state.injury && pcChance(state,0.68)) state.injury.blocksRemaining = Math.max(1,Number(state.injury.blocksRemaining || 1) - 1);
      player.condition = pcClamp(player.condition - 5,0,100);
      break;
    case 'health_early':
      if(state.injury) state.injury.blocksRemaining = Math.max(0,Number(state.injury.blocksRemaining || 1) - 1);
      player.condition = pcClamp(player.condition - 18,0,100);
      pcSetMemory(state,'earlyReturnRisk',true);
      break;
  }
}
function pcResolveDecision(optionId){
  const state = pcCareerState();
  if(!state?.pendingDecision) return;
  const decision = state.pendingDecision;
  const option = (decision.options || []).find(item => String(item.id) === String(optionId));
  if(!option) return;
  pcApplyDecisionEffect(state, option.effect);
  pcRecordDecision(state, decision, option);
  pcRecordEvent(state,'decision',`${decision.title}: ${option.label}.`);
  state.pendingDecision = null;
  pcPersist(state,true);
}

function pcCompetitionUpdateDuringSeason(state, teamResult){
  const league = state.season.competitions.league;
  league.played += 1;
  if(teamResult === 3){ league.wins += 1; league.points += 3; }
  else if(teamResult === 1){ league.draws += 1; league.points += 1; }
  else league.losses += 1;
  const ppg = league.points / Math.max(1,league.played);
  const strengthAdjustment = (Number(state.club.reputation || 50) - 50) / 6;
  league.position = pcClamp(Math.round(18 - (ppg / 2.25) * 16 - strengthAdjustment),1,18);
  league.status = `Puesto estimado: ${league.position}°`;
  const cup = state.season.competitions.nationalCup;
  if(state.season.stage >= 2 && cup.active && cup.status === 'Por comenzar'){
    cup.round = pcChance(state,0.72) ? 'Octavos de final' : 'Eliminado en fase inicial';
    cup.status = cup.round.startsWith('Eliminado') ? cup.round : 'En competencia';
  }
  if(state.season.stage >= 3 && cup.status === 'En competencia'){
    cup.round = pcChance(state,0.58 + Number(state.club.reputation || 50)/300) ? 'Cuartos de final' : 'Eliminado en octavos';
    if(cup.round.startsWith('Eliminado')) cup.status = cup.round;
  }
}
function pcTeamMatchResult(state, playerImpact){
  const teamStrength = Number(state.club.reputation || 50) + Number(playerImpact || 0) + pcRandomBetween(state,-7,7);
  const opponentStrength = pcRandomBetween(state,42,94);
  const probabilityWin = pcClamp(0.44 + (teamStrength-opponentStrength)/115,0.10,0.82);
  const drawProbability = pcClamp(0.28 - Math.abs(teamStrength-opponentStrength)/300,0.15,0.31);
  const roll = pcRandom(state);
  if(roll < probabilityWin) return 3;
  if(roll < probabilityWin + drawProbability) return 1;
  return 0;
}
function pcInjuryProbability(state, minutes){
  const player = state.player;
  const base = 0.005 + Number(player.injuryProneness || 50) / 8000;
  const conditionFactor = 1 + Math.max(0,65-Number(player.condition || 0))/65;
  const minuteFactor = Math.max(0.3,Number(minutes || 0)/90);
  const intense = state.memory.tags.injuryRiskNextBlock ? 1.55 : 1;
  const protectedBlock = state.memory.tags.protectedNextBlock ? 0.58 : 1;
  const earlyReturn = state.memory.tags.earlyReturnRisk ? 1.65 : 1;
  return pcClamp(base * conditionFactor * minuteFactor * intense * protectedBlock * earlyReturn,0.001,0.16);
}
function pcCreateInjury(state){
  const injury = { ...pcPick(state,PLAYER_CAREER_INJURIES) };
  const record = {
    id:pcUniqueId(state,'injury'),
    name:injury.name,
    severity:injury.severity,
    blocksRemaining:injury.blocks,
    originalBlocks:injury.blocks,
    recurrenceRisk:20,
    season:state.season.number,
    year:state.season.year
  };
  state.injury = record;
  state.history.injuries.unshift({ ...record });
  state.player.condition = pcClamp(state.player.condition - 24,0,100);
  state.player.morale = pcClamp(state.player.morale - 6,0,100);
  pcRecordEvent(state,'injury',`${state.player.name} sufrió ${record.name.toLowerCase()}.`);
  return record;
}
function pcRecoverInjuryBlock(state){
  if(!state.injury) return null;
  state.injury.blocksRemaining = Math.max(0,Number(state.injury.blocksRemaining || 0) - 1);
  state.player.condition = pcClamp(state.player.condition + 18,0,100);
  if(state.injury.blocksRemaining <= 0){
    const injuryName = state.injury.name;
    state.injury = null;
    state.player.condition = pcClamp(Math.max(72,state.player.condition),0,100);
    state.player.morale = pcClamp(state.player.morale + 4,0,100);
    pcRecordEvent(state,'recovery',`${state.player.name} recibió el alta por ${injuryName.toLowerCase()}.`);
    return { recovered:true, name:injuryName };
  }
  return { recovered:false, name:state.injury.name };
}
function pcPlayerMatchContribution(state, rating, minutes){
  const output = PLAYER_CAREER_POSITION_OUTPUT[state.player.position] || PLAYER_CAREER_POSITION_OUTPUT.MC;
  const formMultiplier = 0.75 + Number(state.player.form || 50)/200;
  const levelMultiplier = 0.65 + Number(state.player.overall || 50)/110;
  const minutesFactor = Math.max(0,Number(minutes || 0))/90;
  const goals = pcChance(state,output.goals * formMultiplier * levelMultiplier * minutesFactor) ? 1 : 0;
  const assists = pcChance(state,output.assists * formMultiplier * levelMultiplier * minutesFactor) ? 1 : 0;
  const yellow = pcChance(state,output.cards * minutesFactor) ? 1 : 0;
  const red = yellow && pcChance(state,0.025) ? 1 : 0;
  return { goals, assists, yellow, red, rating };
}
function pcSimulateMatch(state){
  const player = state.player;
  const targetLevel = 43 + Number(state.club.reputation || 50) * 0.30;
  const roleBoost = player.trust/170 + player.form/300 + player.morale/500;
  const playProbability = pcClamp(0.34 + (player.overall-targetLevel)/34 + roleBoost,0.08,0.96);
  const plays = pcChance(state, playProbability) && !state.injury;
  let delta = pcEmptyStats();
  let teamResult = pcTeamMatchResult(state,0);
  if(!plays){
    player.morale = pcClamp(player.morale - (pcChance(state,0.35) ? 1 : 0),0,100);
    return { delta, teamResult, played:false };
  }
  const startProbability = pcClamp(0.28 + (player.overall-targetLevel)/22 + player.trust/155,0.08,0.94);
  const starter = pcChance(state,startProbability);
  const minutes = starter ? pcRandomInt(state,64,90) : pcRandomInt(state,12,38);
  const pressurePenalty = state.season.stage >= 3 ? (55-Number(player.pressure || 50))/180 : 0;
  const regularityNoise = (100-Number(player.regularity || 50))/100 * pcRandomBetween(state,-0.8,0.8);
  const output = PLAYER_CAREER_POSITION_OUTPUT[player.position] || PLAYER_CAREER_POSITION_OUTPUT.MC;
  const rating = pcClamp(
    5.65 + (player.overall-targetLevel)/28 + (player.form-50)/90 + (player.morale-50)/150 + output.ratingBias + regularityNoise - pressurePenalty + pcRandomBetween(state,-0.45,0.55),
    4.2,9.4
  );
  const contribution = pcPlayerMatchContribution(state,rating,minutes);
  const impact = (rating-6.2)*2.3 + contribution.goals*4 + contribution.assists*2.5;
  teamResult = pcTeamMatchResult(state,impact);
  delta = {
    matches:1,
    starts:starter ? 1 : 0,
    minutes,
    goals:contribution.goals,
    assists:contribution.assists,
    yellow:contribution.yellow,
    red:contribution.red,
    ratingSum:rating,
    ratingCount:1,
    bestRating:rating
  };
  const conditionCost = minutes * (0.11 + (100-player.professionalism)/1800) / (PLAYER_CAREER_PROFILES[player.profile]?.physical || 1);
  player.condition = pcClamp(player.condition - conditionCost,0,100);
  player.form = pcClamp(player.form + (rating-6.4)*2.2,0,100);
  player.morale = pcClamp(player.morale + (teamResult===3?1.5:teamResult===0?-1:0) + (rating>=7.2?1.5:rating<5.8?-1.2:0),0,100);
  player.trust = pcClamp(player.trust + (rating-6.3)*0.8 + (starter?0.15:0),0,100);
  if(pcChance(state,pcInjuryProbability(state,minutes))) pcCreateInjury(state);
  return { delta, teamResult, played:true, rating, minutes };
}
function pcApplyDevelopment(state, matchesPlayed){
  const player = state.player;
  const age = Number(player.age || 18);
  const potentialGap = Math.max(0,Number(player.potential || player.overall) - Number(player.overall || 0));
  let ageFactor = age <= 19 ? 1.25 : age <= 22 ? 1.08 : age <= 25 ? 0.88 : age <= 28 ? 0.58 : age <= 31 ? 0.24 : -0.18;
  const professionalFactor = 0.62 + Number(player.professionalism || 50)/125;
  const minutesFactor = 0.60 + Math.min(1.1,Number(matchesPlayed || 0)/7);
  const profileFactor = PLAYER_CAREER_PROFILES[player.profile]?.growth || 1;
  const gapFactor = potentialGap <= 0 ? 0 : Math.min(1.25,potentialGap/18);
  let progress = ageFactor * professionalFactor * minutesFactor * profileFactor * gapFactor * 0.30;
  if(age >= 32) progress = -0.16 - (age-32)*0.05;
  progress += Number(player.extraGrowth || 0);
  player.extraGrowth = 0;
  player.growthProgress = Number(player.growthProgress || 0) + progress;
  let changed = 0;
  while(player.growthProgress >= 1 && player.overall < player.potential && player.overall < 99){
    player.overall = pcRound(player.overall + 1,1);
    player.growthProgress -= 1;
    changed += 1;
  }
  while(player.growthProgress <= -1 && player.overall > 35){
    player.overall = pcRound(player.overall - 1,1);
    player.growthProgress += 1;
    changed -= 1;
  }
  if(changed !== 0) pcRecordEvent(state,'development',`${state.player.name} ${changed > 0 ? 'mejoró' : 'redujo'} su media a ${Math.round(state.player.overall)}.`);
  return changed;
}
function pcSimulateBlock(state, matches){
  const startStats = pcNormalizeStats(state.season.stats);
  let played = 0;
  let starts = 0;
  let goals = 0;
  let assists = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let injuryOccurred = false;
  if(state.injury){
    const recovery = pcRecoverInjuryBlock(state);
    return { scheduled:matches, played:0, starts:0, goals:0, assists:0, averageRating:0, injuryOccurred:false, recovering:true, recovered:Boolean(recovery?.recovered) };
  }
  for(let index=0; index<matches; index+=1){
    const result = pcSimulateMatch(state);
    pcCompetitionUpdateDuringSeason(state,result.teamResult);
    state.season.stats = pcAddStats(state.season.stats,result.delta);
    state.careerStats = pcAddStats(state.careerStats,result.delta);
    played += Number(result.delta.matches || 0);
    starts += Number(result.delta.starts || 0);
    goals += Number(result.delta.goals || 0);
    assists += Number(result.delta.assists || 0);
    ratingSum += Number(result.delta.ratingSum || 0);
    ratingCount += Number(result.delta.ratingCount || 0);
    if(state.injury){ injuryOccurred = true; break; }
  }
  state.player.condition = pcClamp(state.player.condition + 18 + Number(state.player.professionalism || 50)/20,0,100);
  state.player.form = pcClamp(state.player.form + pcRandomBetween(state,-2.5,2.5),0,100);
  pcApplyDevelopment(state,played);
  state.player.value = pcCalculateValue(state);
  delete state.memory.tags.injuryRiskNextBlock;
  delete state.memory.tags.protectedNextBlock;
  delete state.memory.tags.earlyReturnRisk;
  const summary = {
    scheduled:matches,
    played,
    starts,
    goals,
    assists,
    averageRating:ratingCount ? ratingSum/ratingCount : 0,
    injuryOccurred,
    recovering:false,
    statsBefore:startStats
  };
  return summary;
}
function pcCupFinalOutcome(state, competition, strengthBonus=0){
  if(!competition?.active) return;
  const seasonStats = state.season.stats;
  const playerContribution = Number(seasonStats.goals || 0)*0.8 + Number(seasonStats.assists || 0)*0.6 + Math.max(0,pcAverageRating(seasonStats)-6.3)*3;
  const strength = Number(state.club.reputation || 50) + strengthBonus + playerContribution + pcRandomBetween(state,-14,14);
  if(strength >= 92){ competition.round='Campeón'; competition.status='Campeón'; competition.champion=true; }
  else if(strength >= 82){ competition.round='Final'; competition.status='Subcampeón'; }
  else if(strength >= 73){ competition.round='Semifinal'; competition.status='Eliminado en semifinales'; }
  else if(strength >= 63){ competition.round='Cuartos de final'; competition.status='Eliminado en cuartos'; }
  else if(strength >= 54){ competition.round='Octavos de final'; competition.status='Eliminado en octavos'; }
  else { competition.round='Fase inicial'; competition.status='Eliminado en fase inicial'; }
}
function pcGenerateMarketOffers(state){
  const currentClub = state.club;
  const stats = state.season.stats;
  const rating = pcAverageRating(stats);
  const performance = Number(stats.matches || 0)*0.25 + Number(stats.goals || 0)*1.6 + Number(stats.assists || 0)*1.3 + Math.max(0,rating-6)*7;
  const desiredReputation = pcClamp(Number(currentClub.reputation || 50) + (performance>=25?12:performance>=15?7:performance>=8?3:-2),35,96);
  const candidates = (seed?.clubs || []).filter(club => {
    if(pcIsSpecialBotClub(club) || Number(club.id) === Number(currentClub.id)) return false;
    const rep = pcClubReputation(club);
    return rep >= desiredReputation-13 && rep <= desiredReputation+10;
  });
  const shuffled = candidates.slice().sort(() => pcRandom(state)-0.5);
  const count = performance >= 20 ? 3 : performance >= 8 ? 2 : 1;
  const offers = [];
  for(const club of shuffled){
    if(offers.length >= count) break;
    const target = pcClubSnapshot(club);
    if(offers.some(offer => Number(offer.club.id) === Number(target.id))) continue;
    const lowMinutes = Number(stats.matches || 0) < 13 || Number(stats.starts || 0) < 7;
    const type = Number(state.player.age || 18) <= 22 && lowMinutes && pcChance(state,0.58) ? 'loan' : 'transfer';
    offers.push({
      id:pcUniqueId(state,'offer'),
      type,
      club:target,
      role:pcClubReputation(club) > state.player.overall+20 ? 'Promesa' : pcClubReputation(club) > state.player.overall+10 ? 'Rotación' : 'Titular',
      years:type==='loan' ? 1 : pcRandomInt(state,3,5),
      salary:Math.round((state.contract.salary * pcRandomBetween(state,1.05,1.65))/1000)*1000,
      fee:type==='loan' ? 0 : Math.round((state.player.value * pcRandomBetween(state,0.85,1.30))/50000)*50000,
      adaptationRisk:target.country !== currentClub.country ? pcRiskLabel(100-Number(state.player.adaptation || 50)) : 'Bajo'
    });
  }
  state.pendingOffers = offers;
  return offers;
}
function pcFinalizeSeason(state){
  const league = state.season.competitions.league;
  const ppg = Number(league.points || 0) / Math.max(1,Number(league.played || 1));
  const clubFactor = (Number(state.club.reputation || 50)-50)/6;
  league.position = pcClamp(Math.round(18 - (ppg/2.25)*16 - clubFactor + pcRandomBetween(state,-1.5,1.5)),1,18);
  league.status = `${league.position}° puesto`;
  league.champion = league.position === 1;
  pcCupFinalOutcome(state,state.season.competitions.nationalCup,0);
  pcCupFinalOutcome(state,state.season.competitions.international,-4);
  pcCupFinalOutcome(state,state.season.competitions.clubWorldCup,-8);
  const titles = [];
  Object.values(state.season.competitions).forEach(competition => {
    if(competition?.champion) titles.push({ id:pcUniqueId(state,'title'), season:state.season.number, year:state.season.year, club:{...state.club}, competition:competition.name, type:competition.type });
  });
  state.history.titles.push(...titles);
  const summary = {
    season:state.season.number,
    year:state.season.year,
    club:{...state.club},
    age:state.player.age,
    overallStart:state.season.overallStart ?? state.player.overall,
    overallEnd:state.player.overall,
    valueEnd:state.player.value,
    stats:pcNormalizeStats(state.season.stats),
    averageRating:pcAverageRating(state.season.stats),
    competitions:structuredClone(state.season.competitions),
    titles:titles.map(title => title.competition),
    role:pcCurrentRole(state)
  };
  state.season.completed = true;
  state.season.summary = summary;
  state.history.seasons.unshift(summary);
  state.player.reputation = pcClamp(state.player.reputation + titles.length*5 + Math.max(0,pcAverageRating(state.season.stats)-6.4)*2,0,100);
  state.player.age = Math.min(45,Number(state.player.age || 18)+1);
  state.contract.yearsRemaining = Math.max(0,Number(state.contract.yearsRemaining || 0)-1);
  pcRecordEvent(state,'season',`Terminó la temporada ${state.season.year}: ${league.status}${titles.length ? ` y ${titles.length} título${titles.length===1?'':'s'}` : ''}.`);
  pcReturnFromLoanIfDue(state);
  pcGenerateMarketOffers(state);
  state.season.stage = 5;
  state.season.stageLabel = PLAYER_CAREER_STAGE_LABELS[5];
  if(state.player.age >= 39 || (state.player.age >= 36 && pcChance(state,0.22 + (state.player.age-36)*0.14))){
    pcRetireCareer(state,'Retiro al cierre de temporada');
  }
  return summary;
}
function pcAdvanceCareer(){
  const state = pcCareerState();
  if(!state || state.status !== 'active' || state.pendingDecision || state.season.stage === 5) return;
  const currentStage = Number(state.season.stage || 0);
  if(currentStage === 0){
    state.player.condition = pcClamp(Math.max(90,state.player.condition),0,100);
    state.player.morale = pcClamp(state.player.morale + 4,0,100);
    state.player.form = pcClamp(state.player.form + 3,0,100);
    state.season.overallStart = Number(state.player.overall || 0);
    state.lastBlockSummary = { stage:'Pretemporada', text:'Preparación física y adaptación al plantel.', scheduled:0, played:0 };
    state.season.blockLog.unshift({ id:pcUniqueId(state,'block'), stage:'Pretemporada', text:'Comenzó la preparación de la temporada.' });
    state.season.stage = 1;
    state.season.stageLabel = PLAYER_CAREER_STAGE_LABELS[1];
    pcCreateDecision(state,'Entrenamiento');
    pcPersist(state,true);
    return;
  }
  const matches = Number(PLAYER_CAREER_MATCHES_BY_STAGE[currentStage] || 0);
  const blockSummary = pcSimulateBlock(state,matches);
  blockSummary.stage = PLAYER_CAREER_STAGE_LABELS[currentStage];
  blockSummary.text = blockSummary.recovering
    ? (blockSummary.recovered ? 'El jugador completó su recuperación.' : 'El bloque se dedicó a la recuperación de la lesión.')
    : `Disputó ${blockSummary.played} de ${matches} partidos del bloque.`;
  state.lastBlockSummary = blockSummary;
  state.season.blockLog.unshift({ id:pcUniqueId(state,'block'), stage:blockSummary.stage, text:blockSummary.text, stats:{...blockSummary} });
  if(currentStage >= 4){
    pcFinalizeSeason(state);
  }else{
    state.season.stage = currentStage + 1;
    state.season.stageLabel = PLAYER_CAREER_STAGE_LABELS[state.season.stage];
    const decisionProbability = state.injury ? 0.95 : currentStage===2 ? 0.78 : 0.58;
    if(pcChance(state,decisionProbability)) pcCreateDecision(state,state.injury ? 'Salud' : '');
  }
  pcPersist(state,true);
}
function pcCloseCurrentClubHistory(state, seasonNumber){
  const current = [...state.history.clubs].reverse().find(item => item.toSeason == null && Number(item.club?.id) === Number(state.club.id));
  if(current) current.toSeason = Math.max(Number(current.fromSeason || 1),Number(seasonNumber || state.season.number));
}
function pcApplyMarketChoice(choiceId){
  const state = pcCareerState();
  if(!state || state.status !== 'active' || state.season.stage !== 5) return;
  if(choiceId === 'stay'){
    const extension = state.contract.yearsRemaining <= 1 ? 3 : Math.max(2,state.contract.yearsRemaining);
    state.contract.yearsRemaining = extension;
    state.contract.salary = Math.round((Math.max(state.contract.salary,150000) * 1.12)/1000)*1000;
    state.contract.role = pcCurrentRole(state);
    pcRecordEvent(state,'contract',`Renovó su continuidad en ${state.club.name}.`);
  }else{
    const offer = (state.pendingOffers || []).find(item => String(item.id) === String(choiceId));
    if(!offer) return;
    const previousClub = { ...state.club };
    pcCloseCurrentClubHistory(state,state.season.number);
    state.club = pcNormalizeClubSnapshot(offer.club);
    state.contract = { yearsRemaining:offer.years, salary:offer.salary, role:offer.role };
    state.player.trust = offer.type === 'loan' ? 36 : 32;
    state.player.morale = pcClamp(state.player.morale + 7,0,100);
    if(state.club.country !== previousClub.country){
      const adaptationPenalty = pcClamp((100-state.player.adaptation)/4,3,18);
      state.player.form = pcClamp(state.player.form-adaptationPenalty,0,100);
      state.player.morale = pcClamp(state.player.morale-adaptationPenalty/2,0,100);
    }
    if(offer.type === 'loan'){
      state.loan = { parentClub:previousClub, loanClub:{...state.club}, fromSeason:state.season.number+1, untilSeason:state.season.number+1 };
    }else state.loan = null;
    state.history.clubs.push({ club:{...state.club}, fromSeason:state.season.number+1, toSeason:null, type:offer.type==='loan'?'Cesión':'Transferencia' });
    state.history.transfers.unshift({ id:pcUniqueId(state,'transfer'), season:state.season.number, year:state.season.year, type:offer.type, fromClub:previousClub, toClub:{...state.club}, fee:offer.fee, salary:offer.salary });
    pcRecordEvent(state,'transfer',`${offer.type==='loan'?'Fue cedido':'Fue transferido'} de ${previousClub.name} a ${state.club.name}.`);
  }
  const nextNumber = Number(state.season.number || 1)+1;
  const nextYear = Number(state.season.year || 2026)+1;
  state.pendingOffers = [];
  pcCreateSeason(state,nextNumber,nextYear);
  state.player.value = pcCalculateValue(state);
  pcPersist(state,true);
}
function pcReturnFromLoanIfDue(state){
  if(!state.loan || Number(state.loan.untilSeason || 0) > Number(state.season.number || 0)) return false;
  const previous = { ...state.club };
  pcCloseCurrentClubHistory(state,state.season.number);
  state.club = pcNormalizeClubSnapshot(state.loan.parentClub);
  state.history.clubs.push({ club:{...state.club}, fromSeason:state.season.number+1, toSeason:null, type:'Regreso de cesión' });
  state.history.transfers.unshift({ id:pcUniqueId(state,'transfer'), season:state.season.number, year:state.season.year, type:'loan_return', fromClub:previous, toClub:{...state.club}, fee:0, salary:state.contract.salary });
  pcRecordEvent(state,'transfer',`Regresó a ${state.club.name} después de su cesión.`);
  state.loan = null;
  return true;
}
function pcRetireCareer(state, reason='Decisión personal'){
  if(!state || state.status === 'retired') return;
  pcCloseCurrentClubHistory(state,state.season.number);
  state.status = 'retired';
  state.retirement = { age:state.player.age, season:state.season.number, year:state.season.year, club:{...state.club}, reason, retiredAt:new Date().toISOString() };
  state.pendingDecision = null;
  state.pendingOffers = [];
  pcRecordEvent(state,'retirement',`${state.player.name} se retiró a los ${state.player.age} años.`);
}
function pcManualRetire(){
  const state = pcCareerState();
  if(!state || state.status !== 'active' || Number(state.player.age || 0) < 33) return;
  if(!window.confirm(`¿Retirar a ${state.player.name}? La carrera quedará finalizada y disponible para consultar.`)) return;
  pcRetireCareer(state,'Decisión del jugador');
  pcPersist(state,true);
}
function pcResetCareer(){
  const state = pcCareerState();
  const label = state?.player?.name ? ` de ${state.player.name}` : '';
  if(!window.confirm(`¿Reiniciar la carrera${label}? Solo se borrará el minijuego «Ser jugador».`)) return;
  if(game?.miniGames) delete game.miniGames.playerCareer;
  playerCareerViewMode = 'summary';
  if(typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>undefined);
  renderPlayerCareer();
}

function pcStatCards(state){
  const stats = state.season.stats;
  return `
    <div class="player-career-metrics">
      <div class="metric-card"><span>Media</span><strong>${Math.round(state.player.overall)}</strong><small>${pcEscape(pcProfileLabel(state))}</small></div>
      <div class="metric-card"><span>Edad</span><strong>${Math.round(state.player.age)}</strong><small>${pcEscape(state.player.nationality)}</small></div>
      <div class="metric-card"><span>Partidos</span><strong>${pcFormatNumber(stats.matches)}</strong><small>${pcFormatNumber(stats.minutes)} minutos</small></div>
      <div class="metric-card"><span>Rendimiento</span><strong>${pcRatingLabel(pcAverageRating(stats))}</strong><small>${pcFormatNumber(stats.goals)} G · ${pcFormatNumber(stats.assists)} A</small></div>
      <div class="metric-card"><span>Valor</span><strong>${pcMoney(state.player.value)}</strong><small>${pcEscape(pcCurrentRole(state))}</small></div>
    </div>`;
}
function pcStatusBar(label, value, tone='default'){
  const clean = pcClamp(value,0,100);
  return `<div class="player-career-status-line"><span>${pcEscape(label)}</span><div class="player-career-status-track"><i class="${pcEscape(tone)}" style="width:${clean}%"></i></div><strong>${Math.round(clean)}%</strong></div>`;
}
function pcHeader(state){
  return `
    <section class="card player-career-header">
      <div class="player-career-identity">
        <div class="player-career-avatar" aria-hidden="true">${pcEscape(state.player.position)}</div>
        <div>
          <p class="label">Ser jugador · Temporada ${state.season.number}</p>
          <h2>${pcEscape(state.player.name)}</h2>
          <p>${pcEscape(state.player.position)} · ${pcEscape(state.player.foot)} · ${pcEscape(state.player.nationality)}</p>
        </div>
      </div>
      <div class="player-career-club">
        ${pcClubBadge(state.club)}
        <div><span>Club actual</span><strong>${pcEscape(state.club.name)}</strong><small>${pcEscape(state.club.divisionName)} · ${pcEscape(state.club.country)}</small></div>
      </div>
    </section>`;
}
function pcInternalTabs(state){
  const tabs = [
    ['summary','Resumen'],
    ['season','Temporada'],
    ['decisions','Decisiones'],
    ['history','Historial']
  ];
  return `<div class="subtabs player-career-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" class="${playerCareerViewMode===id?'active':''}" data-pc-tab="${id}">${label}</button>`).join('')}</div>`;
}
function pcActiveDecisionMarkup(state){
  const decision = state.pendingDecision;
  if(!decision) return '';
  return `<section class="card player-career-decision active-decision">
    <div class="row"><div><p class="label">${pcEscape(decision.category)}</p><h3>${pcEscape(decision.title)}</h3></div><span class="pill">Decisión pendiente</span></div>
    <p>${pcEscape(decision.text)}</p>
    <div class="player-career-choice-grid">
      ${(decision.options || []).map(option => `<button type="button" class="player-career-choice" data-pc-decision="${pcEscape(option.id)}">
        <strong>${pcEscape(option.label)}</strong>
        <span>Riesgo ${pcEscape(option.risk || 'Bajo')}</span>
        <small>${pcEscape(option.consequence || option.description || '')}</small>
      </button>`).join('')}
    </div>
  </section>`;
}
function pcMarketMarkup(state){
  if(state.season.stage !== 5 || state.status !== 'active') return '';
  return `<section class="card player-career-market">
    <div class="row"><div><p class="label">Mercado de pases</p><h3>Elegí el próximo paso de tu carrera</h3></div><span class="pill">Temporada cerrada</span></div>
    <div class="player-career-offers">
      <button type="button" class="player-career-offer stay" data-pc-market="stay">
        <strong>Continuar en ${pcEscape(state.club.name)}</strong>
        <span>Renovación y continuidad</span>
        <small>El club mantiene tu lugar y actualiza el contrato.</small>
      </button>
      ${(state.pendingOffers || []).map(offer => `<button type="button" class="player-career-offer" data-pc-market="${pcEscape(offer.id)}">
        <span class="player-career-offer-head">${pcClubBadge(offer.club)}<strong>${pcEscape(offer.club.name)}</strong></span>
        <span>${offer.type==='loan'?'Cesión por una temporada':'Transferencia definitiva'} · Rol: ${pcEscape(offer.role)}</span>
        <small>${pcEscape(offer.club.country)} · ${pcEscape(offer.club.divisionName)} · Adaptación: riesgo ${pcEscape(offer.adaptationRisk)}</small>
        <small>${offer.type==='loan'?'Sin cargo de transferencia':`Oferta: ${pcMoney(offer.fee)}`} · Salario: ${pcMoney(offer.salary)}</small>
      </button>`).join('')}
    </div>
  </section>`;
}
function pcAdvanceMarkup(state){
  if(state.status !== 'active' || state.pendingDecision || state.season.stage === 5) return '';
  const stage = Number(state.season.stage || 0);
  const next = stage===0 ? 'Comenzar la pretemporada' : stage>=4 ? 'Simular cierre de temporada' : `Avanzar ${PLAYER_CAREER_STAGE_LABELS[stage].toLowerCase()}`;
  return `<section class="card player-career-next">
    <div>
      <p class="label">Próximo bloque</p>
      <h3>${pcEscape(PLAYER_CAREER_STAGE_LABELS[stage])}</h3>
      <p class="muted">La cronología del mánager no avanza. Solo se procesa la carrera de este futbolista.</p>
    </div>
    <button type="button" class="primary" data-pc-action="advance">${pcEscape(next)}</button>
  </section>`;
}
function pcLastBlockMarkup(state){
  const block = state.lastBlockSummary;
  if(!block) return '';
  return `<section class="card player-career-block-summary">
    <div class="row"><div><p class="label">Último avance</p><h3>${pcEscape(block.stage || 'Bloque')}</h3></div>${block.injuryOccurred?'<span class="pill danger">Lesión</span>':''}</div>
    <p>${pcEscape(block.text || '')}</p>
    ${block.scheduled ? `<div class="player-career-inline-stats"><span><strong>${pcFormatNumber(block.played)}</strong> PJ</span><span><strong>${pcFormatNumber(block.starts)}</strong> Tit.</span><span><strong>${pcFormatNumber(block.goals)}</strong> G</span><span><strong>${pcFormatNumber(block.assists)}</strong> A</span><span><strong>${pcRatingLabel(block.averageRating)}</strong> Puntaje</span></div>` : ''}
  </section>`;
}
function pcSummaryView(state){
  return `
    ${pcStatCards(state)}
    <div class="grid cols-2 player-career-summary-grid">
      <section class="card">
        <p class="label">Estado actual</p>
        ${pcStatusBar('Estado físico',state.player.condition,'physical')}
        ${pcStatusBar('Moral y confianza',state.player.morale,'morale')}
        ${pcStatusBar('Forma reciente',state.player.form,'form')}
        ${pcStatusBar('Confianza del entrenador',state.player.trust,'trust')}
      </section>
      <section class="card">
        <p class="label">Contrato</p>
        <div class="player-career-contract-lines">
          <p><span>Rol</span><strong>${pcEscape(pcCurrentRole(state))}</strong></p>
          <p><span>Duración</span><strong>${pcFormatNumber(state.contract.yearsRemaining)} temporada${Number(state.contract.yearsRemaining)===1?'':'s'}</strong></p>
          <p><span>Salario</span><strong>${pcMoney(state.contract.salary)}</strong></p>
          <p><span>Perfil</span><strong>${pcEscape(pcProfileLabel(state))}</strong></p>
        </div>
      </section>
    </div>
    ${state.injury ? `<section class="card blocker player-career-injury"><p class="label">Lesión activa</p><h3>${pcEscape(state.injury.name)}</h3><p>Recuperación estimada: ${pcFormatNumber(state.injury.blocksRemaining)} bloque${Number(state.injury.blocksRemaining)===1?'':'s'}.</p></section>` : ''}
    ${pcActiveDecisionMarkup(state)}
    ${pcMarketMarkup(state)}
    ${pcAdvanceMarkup(state)}
    ${pcLastBlockMarkup(state)}
  `;
}
function pcCompetitionCard(competition){
  if(!competition) return '';
  return `<div class="player-career-competition-card ${competition.active?'':'inactive'}">
    <span>${pcEscape(competition.name)}</span>
    <strong>${pcEscape(competition.type==='league' && competition.position ? `${competition.position}° puesto` : competition.round || competition.status || '—')}</strong>
    <small>${pcEscape(competition.status || (competition.active?'En competencia':'No clasificado'))}</small>
  </div>`;
}
function pcSeasonView(state){
  const stats = state.season.stats;
  return `
    <section class="card player-career-season-progress">
      <div class="row"><div><p class="label">Temporada ${state.season.year}</p><h3>${pcEscape(state.season.stageLabel)}</h3></div><span class="pill">${Math.round(pcStageProgress(state))}%</span></div>
      <div class="player-career-progress"><i style="width:${pcStageProgress(state)}%"></i></div>
    </section>
    <section class="player-career-competition-grid">
      ${Object.values(state.season.competitions || {}).map(pcCompetitionCard).join('')}
    </section>
    <section class="card">
      <div class="row"><div><p class="label">Rendimiento de temporada</p><h3>Estadísticas personales</h3></div><span class="pill">${pcEscape(pcCurrentRole(state))}</span></div>
      <div class="table-wrap"><table class="player-career-table"><thead><tr><th>PJ</th><th>Tit.</th><th>Min.</th><th>Goles</th><th>Asist.</th><th>TA</th><th>TR</th><th>Puntaje</th></tr></thead><tbody><tr><td>${pcFormatNumber(stats.matches)}</td><td>${pcFormatNumber(stats.starts)}</td><td>${pcFormatNumber(stats.minutes)}</td><td>${pcFormatNumber(stats.goals)}</td><td>${pcFormatNumber(stats.assists)}</td><td>${pcFormatNumber(stats.yellow)}</td><td>${pcFormatNumber(stats.red)}</td><td>${pcRatingLabel(pcAverageRating(stats))}</td></tr></tbody></table></div>
    </section>
    ${pcActiveDecisionMarkup(state)}
    ${pcMarketMarkup(state)}
    ${pcAdvanceMarkup(state)}
  `;
}
function pcDecisionsView(state){
  const decisions = state.history.decisions || [];
  return `
    ${pcActiveDecisionMarkup(state)}
    ${!state.pendingDecision ? '<section class="card"><p class="muted">No hay una decisión pendiente. Las nuevas situaciones aparecen al avanzar la carrera.</p></section>' : ''}
    <section class="card">
      <div class="row"><div><p class="label">Memoria de decisiones</p><h3>Elecciones importantes</h3></div><span class="pill">${pcFormatNumber(decisions.length)}</span></div>
      <div class="player-career-timeline">
        ${decisions.length ? decisions.map(item => `<article><span>${pcEscape(item.category)}</span><div><strong>${pcEscape(item.title)}</strong><p>${pcEscape(item.choice)} · ${pcEscape(item.consequence)}</p><small>Temporada ${pcFormatNumber(item.season)} · ${pcFormatNumber(item.year)}</small></div></article>`).join('') : '<p class="muted">Todavía no hay decisiones registradas.</p>'}
      </div>
    </section>
  `;
}
function pcSeasonHistoryRows(state){
  return (state.history.seasons || []).map(item => `<tr>
    <td>${pcFormatNumber(item.year)}</td>
    <td>${pcEscape(item.club?.name || '—')}</td>
    <td>${pcFormatNumber(item.stats?.matches)}</td>
    <td>${pcFormatNumber(item.stats?.goals)}</td>
    <td>${pcFormatNumber(item.stats?.assists)}</td>
    <td>${pcRatingLabel(item.averageRating)}</td>
    <td>${pcEscape((item.titles || []).join(', ') || '—')}</td>
  </tr>`).join('');
}
function pcHistoryView(state){
  const career = state.careerStats;
  const clubs = state.history.clubs || [];
  const events = state.history.events || [];
  return `
    <div class="player-career-metrics career-total">
      <div class="metric-card"><span>Partidos</span><strong>${pcFormatNumber(career.matches)}</strong><small>${pcFormatNumber(career.minutes)} minutos</small></div>
      <div class="metric-card"><span>Goles</span><strong>${pcFormatNumber(career.goals)}</strong><small>Toda la carrera</small></div>
      <div class="metric-card"><span>Asistencias</span><strong>${pcFormatNumber(career.assists)}</strong><small>Toda la carrera</small></div>
      <div class="metric-card"><span>Puntaje</span><strong>${pcRatingLabel(pcAverageRating(career))}</strong><small>Promedio general</small></div>
      <div class="metric-card"><span>Títulos</span><strong>${pcFormatNumber(state.history.titles?.length || 0)}</strong><small>${pcFormatNumber(clubs.length)} clubes</small></div>
    </div>
    <section class="card">
      <div class="row"><div><p class="label">Historial por temporada</p><h3>Carrera deportiva</h3></div></div>
      <div class="table-wrap"><table class="player-career-table"><thead><tr><th>Año</th><th>Club</th><th>PJ</th><th>G</th><th>A</th><th>Puntaje</th><th>Títulos</th></tr></thead><tbody>${pcSeasonHistoryRows(state) || '<tr><td colspan="7" class="muted">La primera temporada todavía no terminó.</td></tr>'}</tbody></table></div>
    </section>
    <div class="grid cols-2 player-career-history-grid">
      <section class="card">
        <p class="label">Clubes</p>
        <div class="player-career-club-history">${clubs.map(item => `<article>${pcClubBadge(item.club)}<div><strong>${pcEscape(item.club?.name || 'Club')}</strong><span>${pcEscape(item.type || 'Etapa')}</span><small>Temporada ${pcFormatNumber(item.fromSeason)}${item.toSeason?` a ${pcFormatNumber(item.toSeason)}`:' en adelante'}</small></div></article>`).join('')}</div>
      </section>
      <section class="card">
        <p class="label">Cronología</p>
        <div class="player-career-timeline compact">${events.length ? events.slice(0,30).map(item => `<article><span>${pcEscape(item.type)}</span><div><p>${pcEscape(item.text)}</p><small>${pcFormatNumber(item.year)} · Temporada ${pcFormatNumber(item.season)}</small></div></article>`).join('') : '<p class="muted">Sin acontecimientos registrados.</p>'}</div>
      </section>
    </div>
  `;
}
function pcRetiredView(state){
  const career = state.careerStats;
  const bestSeason = (state.history.seasons || []).slice().sort((a,b)=>Number(b.averageRating||0)-Number(a.averageRating||0))[0] || null;
  const maxOverall = Math.max(Number(state.player.overall || 0),...(state.history.seasons || []).map(item=>Number(item.overallEnd || 0)));
  const maxValue = Math.max(Number(state.player.value || 0),...(state.history.seasons || []).map(item=>Number(item.valueEnd || 0)));
  return `
    ${pcHeader(state)}
    <section class="card player-career-retirement">
      <p class="label">Carrera finalizada</p>
      <h2>Resumen de la carrera</h2>
      <p>${pcEscape(state.player.name)} se retiró a los ${pcFormatNumber(state.retirement?.age || state.player.age)} años después de ${pcFormatNumber(state.history.seasons?.length || 0)} temporadas.</p>
      <div class="player-career-metrics">
        <div class="metric-card"><span>Partidos</span><strong>${pcFormatNumber(career.matches)}</strong><small>${pcFormatNumber(career.minutes)} minutos</small></div>
        <div class="metric-card"><span>Goles</span><strong>${pcFormatNumber(career.goals)}</strong><small>${pcFormatNumber(career.assists)} asistencias</small></div>
        <div class="metric-card"><span>Títulos</span><strong>${pcFormatNumber(state.history.titles?.length || 0)}</strong><small>${pcFormatNumber(state.history.clubs?.length || 0)} etapas de club</small></div>
        <div class="metric-card"><span>Mayor media</span><strong>${Math.round(maxOverall)}</strong><small>Máximo de carrera</small></div>
        <div class="metric-card"><span>Mayor valor</span><strong>${pcMoney(maxValue)}</strong><small>Valor máximo</small></div>
      </div>
      <div class="grid cols-2">
        <div><span class="muted">Mejor temporada</span><strong>${bestSeason ? `${bestSeason.year} · ${bestSeason.club?.name} · ${pcRatingLabel(bestSeason.averageRating)}` : '—'}</strong></div>
        <div><span class="muted">Motivo del retiro</span><strong>${pcEscape(state.retirement?.reason || 'Fin de carrera')}</strong></div>
      </div>
      <div class="row player-career-retired-actions"><button type="button" class="ghost" data-pc-tab="history">Ver historial completo</button><button type="button" class="danger" data-pc-action="reset">Nueva carrera</button></div>
    </section>
    ${playerCareerViewMode === 'history' ? pcHistoryView(state) : ''}
  `;
}
function pcCreationView(){
  const countries = pcCountries();
  const defaultCountry = countries.includes(String(game?.selectedCountry || '')) ? String(game.selectedCountry) : (countries[0] || 'Argentina');
  const firstClub = pcInitialClubOptions(defaultCountry,'MC')[0];
  return `
    <section class="player-career-intro card">
      <div>
        <p class="label">Minijuego integrado</p>
        <h2>Ser jugador</h2>
        <p>Creá un futbolista y recorré una carrera breve de decisiones, rendimiento, lesiones, contratos y transferencias. La carrera del mánager permanece cargada y detenida.</p>
      </div>
      <div class="player-career-isolation">
        <span>Calendario propio</span><span>Guardado independiente</span><span>Sin impacto en tu club</span>
      </div>
    </section>
    <section class="card player-career-create-card">
      <div class="row"><div><p class="label">Nueva carrera</p><h3>Crear futbolista</h3></div><span class="pill">Edad inicial: 16 a 19</span></div>
      <div class="player-career-form-grid">
        <label>Nombre y apellido<input id="pcPlayerName" type="text" maxlength="60" placeholder="Nombre del futbolista" autocomplete="off" /></label>
        <label>Nacionalidad<select id="pcNationality">${countries.map(country=>`<option value="${pcEscape(country)}" ${country===defaultCountry?'selected':''}>${pcEscape(country)}</option>`).join('')}</select></label>
        <label>Edad<select id="pcAge">${[16,17,18,19].map(age=>`<option value="${age}" ${age===17?'selected':''}>${age} años</option>`).join('')}</select></label>
        <label>Posición<select id="pcPosition">${PLAYER_CAREER_POSITIONS.map(position=>`<option value="${position}" ${position==='MC'?'selected':''}>${position}</option>`).join('')}</select></label>
        <label>Pierna hábil<select id="pcFoot"><option>Derecha</option><option>Izquierda</option></select></label>
        <label>Perfil<select id="pcProfile"><option value="technical">Técnico</option><option value="physical">Físico</option><option value="balanced" selected>Equilibrado</option></select></label>
        <label class="player-career-club-select">Club inicial<select id="pcInitialClub">${pcInitialClubOptionMarkup(defaultCountry,firstClub?.id || 0,'MC')}</select><small>Solo aparecen equipos donde un juvenil puede competir por minutos.</small></label>
      </div>
      <div class="row player-career-create-actions"><p id="pcCreateError" class="muted" aria-live="polite"></p><button type="button" class="primary" data-pc-action="create">Crear jugador</button></div>
    </section>`;
}
function pcCreateFromForm(){
  const name = String(document.getElementById('pcPlayerName')?.value || '').trim().replace(/\s+/g,' ');
  const nationality = String(document.getElementById('pcNationality')?.value || '').trim();
  const age = Number(document.getElementById('pcAge')?.value || 17);
  const position = String(document.getElementById('pcPosition')?.value || 'MC');
  const foot = String(document.getElementById('pcFoot')?.value || 'Derecha');
  const profile = String(document.getElementById('pcProfile')?.value || 'balanced');
  const clubId = Number(document.getElementById('pcInitialClub')?.value || 0);
  const errorNode = document.getElementById('pcCreateError');
  const eligibleClubIds = new Set(pcInitialClubOptions(nationality,position).map(club=>Number(club.id)));
  let error = '';
  if(name.length < 3) error = 'Ingresá un nombre y apellido válido.';
  else if(!pcCountries().includes(nationality)) error = 'Seleccioná una nacionalidad disponible.';
  else if(age < 16 || age > 19) error = 'La edad inicial debe estar entre 16 y 19 años.';
  else if(!PLAYER_CAREER_POSITIONS.includes(position)) error = 'Seleccioná una posición válida.';
  else if(!eligibleClubIds.has(clubId)) error = 'Seleccioná uno de los clubes iniciales disponibles.';
  if(error){ if(errorNode) errorNode.textContent = error; return; }
  const state = pcCreatePlayerCareer({ name,nationality,age,position,foot,profile,clubId });
  pcSetCareerState(state);
  playerCareerViewMode = 'summary';
  pcPersist(state,true);
}
function pcRefreshClubSelect(){
  const nationality = String(document.getElementById('pcNationality')?.value || '');
  const position = String(document.getElementById('pcPosition')?.value || 'MC');
  const select = document.getElementById('pcInitialClub');
  if(select) select.innerHTML = pcInitialClubOptionMarkup(nationality,0,position);
}
function renderPlayerCareer(){
  if(!game){
    view.innerHTML = '<div class="card blocker"><h2>Ser jugador</h2><p>Primero cargá o creá una carrera de mánager. El minijuego se guarda dentro de esa partida.</p></div>';
    return;
  }
  const state = pcCareerState();
  if(!state){
    view.innerHTML = `<div class="player-career-shell">${pcCreationView()}</div>`;
    return;
  }
  pcSetCareerState(state);
  if(state.status === 'retired'){
    view.innerHTML = `<div class="player-career-shell">${pcRetiredView(state)}</div>`;
    return;
  }
  const content = playerCareerViewMode === 'season' ? pcSeasonView(state)
    : playerCareerViewMode === 'decisions' ? pcDecisionsView(state)
      : playerCareerViewMode === 'history' ? pcHistoryView(state)
        : pcSummaryView(state);
  view.innerHTML = `<div class="player-career-shell">
    ${pcHeader(state)}
    <div class="row player-career-toolbar">
      ${pcInternalTabs(state)}
      <div class="player-career-toolbar-actions">
        ${Number(state.player.age || 0)>=33?'<button type="button" class="ghost" data-pc-action="retire">Retirarse</button>':''}
        <button type="button" class="ghost danger" data-pc-action="reset">Reiniciar</button>
      </div>
    </div>
    ${content}
  </div>`;
}

if(typeof normalizeGame === 'function'){
  const pcNormalizeGameBase = normalizeGame;
  normalizeGame = function(saved){
    const normalized = pcNormalizeGameBase(saved);
    if(normalized?.miniGames && typeof normalized.miniGames === 'object' && normalized.miniGames.playerCareer){
      normalized.miniGames.playerCareer = pcNormalizeCareer(normalized.miniGames.playerCareer);
    }
    return normalized;
  };
}

if(typeof document !== 'undefined'){
  document.addEventListener('change', event => {
    if(event.target?.id === 'pcNationality' || event.target?.id === 'pcPosition') pcRefreshClubSelect();
  });
  document.addEventListener('click', event => {
    const tabButton = event.target.closest('[data-pc-tab]');
    if(tabButton){
      playerCareerViewMode = String(tabButton.dataset.pcTab || 'summary');
      renderPlayerCareer();
      return;
    }
    const decisionButton = event.target.closest('[data-pc-decision]');
    if(decisionButton){ pcResolveDecision(decisionButton.dataset.pcDecision); return; }
    const marketButton = event.target.closest('[data-pc-market]');
    if(marketButton){ pcApplyMarketChoice(marketButton.dataset.pcMarket); return; }
    const actionButton = event.target.closest('[data-pc-action]');
    if(!actionButton) return;
    const action = String(actionButton.dataset.pcAction || '');
    if(action === 'create') pcCreateFromForm();
    else if(action === 'advance') pcAdvanceCareer();
    else if(action === 'reset') pcResetCareer();
    else if(action === 'retire') pcManualRetire();
  });
}
