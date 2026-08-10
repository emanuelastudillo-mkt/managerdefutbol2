/* Configuración, calendario anual, constantes generales y estado global. */

const GAME_CONFIG = window.GAME_CONFIG || {};
function configValue(path, fallback){
  return String(path || '').split('.').reduce((node, key) => (node && Object.prototype.hasOwnProperty.call(node, key)) ? node[key] : undefined, GAME_CONFIG) ?? fallback;
}
function configNumber(path, fallback, min=null, max=null){
  const raw = Number(configValue(path, fallback));
  let value = Number.isFinite(raw) ? raw : Number(fallback);
  if(Number.isFinite(min)) value = Math.max(min, value);
  if(Number.isFinite(max)) value = Math.min(max, value);
  return value;
}
function configBoolean(path, fallback=false){
  const raw = configValue(path, fallback);
  if(typeof raw === 'boolean') return raw;
  if(typeof raw === 'string') return !['false','0','no','off'].includes(raw.trim().toLowerCase());
  if(typeof raw === 'number') return raw !== 0;
  return Boolean(fallback);
}
function configClamp(value, min, max){
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : 0;
  return Math.max(min, Math.min(max, safe));
}

const DATA_CACHE_MODE_RAW = String(configValue('data.cacheMode', 'default')).trim();
const DATA_CACHE_MODE = ['default','no-store','no-cache','reload','force-cache'].includes(DATA_CACHE_MODE_RAW) ? DATA_CACHE_MODE_RAW : 'default';
const PLAYERS_DATABASE_URL = configValue('data.playersUrl', 'data/jugadores.json');
const PLAYERS_DATABASE_URLS_RAW = configValue('data.playersUrls', []);
const PLAYERS_DATABASE_URLS = Array.isArray(PLAYERS_DATABASE_URLS_RAW) ? PLAYERS_DATABASE_URLS_RAW.filter(Boolean) : [];
const MANUAL_PLAYERS_DATABASE_URL = configValue('data.manualPlayersUrl', 'data/jugadores_manuales.json');
const SPONSORS_DATABASE_URL = configValue('data.sponsorsUrl', 'data/sponsors.json');
const EMPLOYEES_DATABASE_URL = configValue('data.employeesUrl', 'data/empleados.json');
const INSTALLATIONS_DATABASE_URL = configValue('data.installationsUrl', 'data/instalaciones.json?v=8.74');
const EVENTS_DATABASE_URL = configValue('data.eventsUrl', 'data/eventos.json?v=8.74');
const SPECIAL_SKILLS_DATABASE_URL = configValue('data.specialSkillsUrl', 'data/habilidades_especiales.json?v=9.60');
const MANAGER_ACHIEVEMENTS_DATABASE_URL = configValue('data.managerAchievementsUrl', 'data/hitos_manager.json?v=8.74');
const MANAGER_CHALLENGES_DATABASE_URL = configValue('data.retosManagerUrl', 'data/retos_manager.json');
const STADIUMS_DATABASE_CANDIDATES = configValue('data.estadiosUrls', [
  'data/estadios_argentina.json',
  'data/estadios_chile.json',
  'data/estadios_brasil.json',
  'data/estadios_inglaterra.json',
  'data/estadios_espana.json',
  'data/estadios_italia.json',
  'data/estadios_rumania.json'
]);
const FANS_DATABASE_CANDIDATES = configValue('data.hinchasUrls', [
  'data/hinchas_argentina.json',
  'data/hinchas_chile.json',
  'data/hinchas_brasil.json',
  'data/hinchas_inglaterra.json',
  'data/hinchas_espana.json',
  'data/hinchas_italia.json',
  'data/hinchas_rumania.json'
]);
const MATCH_COMMENTARY_DATABASE_URL = configValue('data.relatosPartidoUrl', 'data/relatos_partido.json');
const LEAGUE_DATA_CANDIDATES = configValue('data.leagueUrls', ['data/Liga Argentina.json?v=8.74', 'data/Liga argentina.json', 'data/Liga_argentina.json', 'data/liga_argentina.json', 'data/liga-argentina.json']);
const DB_NAME = 'futbol-manager-mvp';
const DB_STORE = 'saves';
const SAVE_KEY = 'main';
const SAVE_SLOT_LEGACY_CAREER = 'career';
const SAVE_SLOT_CAREER_PREFIX_ID = 'career:';
const SAVE_SLOT_CAREER = 'career:1';
const SAVE_CAREER_SLOT_COUNT = Math.max(1, Math.min(10, Math.round(configNumber('partidas.slotsCarrera', 1, 1, 10))));
const AUTOSAVE_COALESCE_MS = Math.max(0, Math.round(configNumber('partidas.agruparAutoguardadosMs', 1500, 0, 5000)));
const SAVE_BACKUP_EVERY_AUTOSAVES = Math.max(1, Math.round(configNumber('partidas.backupCadaAutoguardados', 4, 1, 20)));
const SAVE_SLOT_CAMPO_DESTRUIDO = 'challenge:campo_destruido';
const SAVE_SLOT_PREFIX = 'slot:';
const SAVE_BACKUP_PREFIX = 'backup:';
const LOCAL_SAVE_SCHEMA_VERSION = 2;
const SAVE_ACTIVE_SLOT_STORAGE_KEY = 'fmActiveSaveSlot';
const DAYS_PER_ADVANCE = configNumber('calendario.diasPorAvance', 1, 1, 30);
const SEASON_START_YEAR = configNumber('calendario.anioInicial', 2026, 1900, 2200);
const SEASON_START_MONTH = configNumber('calendario.mesInicioTemporada', 1, 1, 12);
const SEASON_START_DAY = configNumber('calendario.diaInicioTemporada', 1, 1, 31);
const SEASON_HOME_AWAY = configBoolean('calendario.ligaIdaYVuelta', true);
const LEAGUE_FIXTURE_SEEDS_ENABLED = configBoolean('calendario.fixtureSemillasActivas', true);
const LEAGUE_FIXTURE_SEEDS_RAW = configValue('calendario.fixtureSemillas', [
  104729,130363,155921,181081,206369,231731,257053,282377,307691,333017,
  358349,383681,409021,434353,459691,485021,510361,535697,561019,586367
]);
const LEAGUE_FIXTURE_SEEDS = Object.freeze((Array.isArray(LEAGUE_FIXTURE_SEEDS_RAW) ? LEAGUE_FIXTURE_SEEDS_RAW : [])
  .map(value => Math.abs(Math.round(Number(value || 0))) >>> 0)
  .filter(value => value > 0)
  .slice(0,20));
const LEAGUE_FIXTURE_SEED_VERSION = 'v970-20-seeds';
const FAST_BOT_SIMULATION_ENABLED = configBoolean('calendario.simulacionRapidaBots', true);
const NATIONAL_CUPS_ENABLED = configBoolean('calendario.copasNacionalesActivas', true);
const LEAGUE_MATCH_DAY_RULES_RAW = configValue('calendario.diasPorLiga', []);
const LEAGUE_MATCH_DAY_RULES = Array.isArray(LEAGUE_MATCH_DAY_RULES_RAW) ? LEAGUE_MATCH_DAY_RULES_RAW : [];
function normalizeScheduleText(value){
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
function leagueRuleMatchesDivision(rule, division={}){
  const country = normalizeScheduleText(division.country || division.pais || '');
  const name = normalizeScheduleText(division.name || division.nombre || '');
  const order = Math.round(Number(division.order || division.orden || 0));
  const ruleCountries = Array.isArray(rule?.paises || rule?.countries) ? (rule.paises || rule.countries).map(normalizeScheduleText) : [];
  const ruleNames = Array.isArray(rule?.ligas || rule?.leagues || rule?.divisiones) ? (rule.ligas || rule.leagues || rule.divisiones).map(normalizeScheduleText) : [];
  const ruleOrders = Array.isArray(rule?.ordenes || rule?.orders) ? (rule.ordenes || rule.orders).map(v => Math.round(Number(v))) : [];
  if(ruleCountries.length && !ruleCountries.includes(country)) return false;
  if(ruleNames.length && !ruleNames.some(item => item && name.includes(item))) return false;
  if(ruleOrders.length && !ruleOrders.includes(order)) return false;
  return true;
}
function divisionWeekendOffsetDays(division={}){
  const rule = LEAGUE_MATCH_DAY_RULES.find(item => leagueRuleMatchesDivision(item, division));
  if(rule && Number.isFinite(Number(rule.offset))) return Math.max(-6, Math.min(6, Math.round(Number(rule.offset))));
  const country = normalizeScheduleText(division.country || division.pais || '');
  const order = Math.round(Number(division.order || division.orden || 1));
  if(['espana','italia','inglaterra','rumania'].includes(country)) return -2;
  if(country === 'argentina' && order > 1) return -1;
  return 0;
}
function matchDateForDivisionRound(baseDate, division={}){
  return typeof addDaysToIsoDate === 'function' ? addDaysToIsoDate(baseDate, divisionWeekendOffsetDays(division)) : baseDate;
}
function matchDateLabel(date){
  if(!validIsoDate(date)) return date || '';
  const day = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'][new Date(`${date}T00:00:00Z`).getUTCDay()] || '';
  return `${day} ${date}`;
}
const LEAGUE_ROUND_INTERVAL_DAYS = configNumber('calendario.diasEntreFechasLiga', 7, 1, 30);
const MIDSEASON_BREAK_AFTER_ROUND = configNumber('calendario.fechaPausaLuegoDe', 17, 0, 80);
const MIDSEASON_BREAK_DAYS = configNumber('calendario.diasVacacionesMitadTemporada', 28, 0, 90);
const SEASON_CALENDAR_VERSION = 'annual-365-daily-weekly-split-break-v5-national-cups';
const ADVANCE_LOCK_MS = configNumber('calendario.bloqueoEntreAvancesMs', 3000, 0);
const DAY_ADVANCE_LOCK_MS = configNumber('calendario.bloqueoAvanceDiaMs', 3000, 0);
const TURN_TRANSITION_MS = configNumber('calendario.transicionAvanceMs', 2400, 800);
const NOTICE_DURATION_MS = configNumber('ui.duracionAvisoMs', 5200, 1000);
const ACTION_FEEDBACK_LOADING_MS = configNumber('ui.accionesFeedbackCargaMs', 750, 250, 3000);
const ACTION_FEEDBACK_RESULT_MS = configNumber('ui.accionesFeedbackResultadoMs', 900, 300, 4000);
const KINESIOLOGIST_BULK_TREATMENT_STEP_MS = configNumber('ui.kinesiologoTratamientoProgresivoMs', 650, 150, 4000);
const SPECIAL_PACK_REVEAL_STEP_MS = configNumber('ui.especialAperturaCartaMs', 2700, 250, 9000);
const ADVANCE_STATUS_PHRASE_INTERVAL_MS = configNumber('ui.frasesProgresoAvanceIntervaloMs', 10000, 3000, 60000);
const ADVANCE_STATUS_PHRASES_RAW = configValue('ui.frasesProgresoAvance', []);
const ADVANCE_STATUS_PHRASES = Array.isArray(ADVANCE_STATUS_PHRASES_RAW) ? ADVANCE_STATUS_PHRASES_RAW.filter(Boolean).map(String) : [];
const MATCH_CARD_RATE_MULTIPLIER = configNumber('simulador.multiplicadorTarjetas', 0.70, 0, 2);
const DIRECT_RED_RATE_MULTIPLIER = configNumber('simulador.multiplicadorRojasDirectas', 0.55, 0, 2);
const HIGH_CARD_PENALTY_ENABLED = configBoolean('simulador.penalizacionTarjetasAltas.activo', true);
function normalizeHighCardPenaltyRules(path, fallback=[]){
  const raw = configValue(path, fallback);
  return (Array.isArray(raw) ? raw : fallback).map(rule => ({
    cardsFrom:Math.max(1, Math.round(Number(rule?.tarjetasTotalesDesde ?? rule?.cardsFrom ?? 0) || 0)),
    penalty:configClamp(Number(rule?.penalizacion ?? rule?.penalty ?? 0) || 0, 0, 0.99)
  })).filter(rule => rule.cardsFrom > 0 && rule.penalty > 0).sort((a,b)=>a.cardsFrom-b.cardsFrom);
}
const HIGH_YELLOW_CARD_PENALTY_RULES = normalizeHighCardPenaltyRules('simulador.penalizacionTarjetasAltas.amarillas', [
  { tarjetasTotalesDesde:6, penalizacion:0.30 },
  { tarjetasTotalesDesde:7, penalizacion:0.40 },
  { tarjetasTotalesDesde:8, penalizacion:0.50 },
  { tarjetasTotalesDesde:9, penalizacion:0.80 }
]);
const HIGH_DIRECT_RED_CARD_PENALTY_RULES = normalizeHighCardPenaltyRules('simulador.penalizacionTarjetasAltas.rojasDirectas', [
  { tarjetasTotalesDesde:2, penalizacion:0.40 },
  { tarjetasTotalesDesde:3, penalizacion:0.50 },
  { tarjetasTotalesDesde:4, penalizacion:0.60 },
  { tarjetasTotalesDesde:5, penalizacion:0.90 }
]);
function highCardPenaltyForNextCard(currentCount, rules=[]){
  if(!HIGH_CARD_PENALTY_ENABLED) return 0;
  const nextTotal = Math.max(0, Math.round(Number(currentCount || 0))) + 1;
  let penalty = 0;
  (rules || []).forEach(rule => { if(nextTotal >= Number(rule.cardsFrom || 0)) penalty = Math.max(penalty, Number(rule.penalty || 0)); });
  return configClamp(penalty, 0, 0.99);
}
function applyMatchCardVolumePenalty(candidates=[], existingCards=[], randomFn=Math.random){
  const accepted = [];
  let yellowCount = (Array.isArray(existingCards) ? existingCards : []).filter(card => ['yellow','secondYellowRed'].includes(String(card?.type || ''))).length;
  let directRedCount = (Array.isArray(existingCards) ? existingCards : []).filter(card => String(card?.type || '') === 'red').length;
  (Array.isArray(candidates) ? candidates : []).slice().sort((a,b)=>Number(a?.minute || 0)-Number(b?.minute || 0)).forEach(card => {
    const type = String(card?.type || '');
    const isYellow = type === 'yellow' || type === 'secondYellowRed';
    const isDirectRed = type === 'red';
    const penalty = isYellow
      ? highCardPenaltyForNextCard(yellowCount, HIGH_YELLOW_CARD_PENALTY_RULES)
      : (isDirectRed ? highCardPenaltyForNextCard(directRedCount, HIGH_DIRECT_RED_CARD_PENALTY_RULES) : 0);
    if(penalty > 0 && randomFn() < penalty) return;
    accepted.push(card);
    if(isYellow) yellowCount += 1;
    if(isDirectRed) directRedCount += 1;
  });
  return accepted;
}
const HIGH_SCORE_GOAL_PENALTY_ENABLED = configBoolean('simulador.penalizacionGolesAltos.activo', true);
const HIGH_SCORE_GOAL_PENALTY_RULES_RAW = configValue('simulador.penalizacionGolesAltos.tramos', [
  { golesTotalesDesde:1, penalizacion:0.10 },
  { golesTotalesDesde:6, penalizacion:0.40 },
  { golesTotalesDesde:7, penalizacion:0.50 },
  { golesTotalesDesde:8, penalizacion:0.60 },
  { golesTotalesDesde:9, penalizacion:0.70 },
  { golesTotalesDesde:10, penalizacion:0.80 },
  { golesTotalesDesde:11, penalizacion:0.90 },
  { golesTotalesDesde:12, penalizacion:0.95 }
]);
const HIGH_SCORE_GOAL_PENALTY_RULES = (Array.isArray(HIGH_SCORE_GOAL_PENALTY_RULES_RAW) ? HIGH_SCORE_GOAL_PENALTY_RULES_RAW : [])
  .map(rule => ({
    goalsFrom:Math.max(1, Math.round(Number(rule?.golesTotalesDesde ?? rule?.goalsFrom ?? 0) || 0)),
    penalty:Math.max(0, Math.min(0.99, Number(rule?.penalizacion ?? rule?.penalty ?? 0) || 0))
  }))
  .filter(rule => rule.goalsFrom > 0 && rule.penalty > 0)
  .sort((a,b) => a.goalsFrom - b.goalsFrom);
function highScoreGoalPenaltyForNextGoal(currentTotalGoals){
  if(!HIGH_SCORE_GOAL_PENALTY_ENABLED) return 0;
  const nextTotal = Math.max(0, Math.round(Number(currentTotalGoals || 0))) + 1;
  let penalty = 0;
  HIGH_SCORE_GOAL_PENALTY_RULES.forEach(rule => {
    if(nextTotal >= rule.goalsFrom) penalty = Math.max(penalty, rule.penalty);
  });
  return Math.max(0, Math.min(0.99, penalty));
}
function applyHighScoreGoalPenaltyToScore(homeGoals, awayGoals, randomFn=Math.random){
  const home = Math.max(0, Math.round(Number(homeGoals || 0)));
  const away = Math.max(0, Math.round(Number(awayGoals || 0)));
  const random = typeof randomFn === 'function' ? randomFn : Math.random;
  const candidates = [];
  for(let i=0;i<home;i++) candidates.push({ side:'home', order:random() });
  for(let i=0;i<away;i++) candidates.push({ side:'away', order:random() });
  candidates.sort((a,b) => a.order - b.order);
  let acceptedHome = 0;
  let acceptedAway = 0;
  let acceptedTotal = 0;
  candidates.forEach(candidate => {
    const penalty = highScoreGoalPenaltyForNextGoal(acceptedTotal);
    if(penalty > 0 && random() < penalty) return;
    if(candidate.side === 'home') acceptedHome += 1;
    else acceptedAway += 1;
    acceptedTotal += 1;
  });
  return { homeGoals:acceptedHome, awayGoals:acceptedAway };
}

const PLAYER_STARS_MAX_PER_CLUB = configNumber('simulador.estrellasMaximasPorEquipo', 3, 0, 10);
const PLAYER_STARS_WINDOW_MATCHES = Math.round(configNumber('simulador.estrellasPartidosVentana', 10, 1, 30));
const PLAYER_STAR_GOAL_MATCHES_REQUIRED = Math.round(configNumber('simulador.estrellaGoleadorPartidosConGol', 3, 1, 30));
const PLAYER_STAR_KEY_SAVE_MATCHES_REQUIRED = Math.round(configNumber('simulador.estrellaArqueroPartidosConTapadaClave', 3, 1, 30));
const PLAYER_STAR_MID_ASSISTS_REQUIRED = Math.round(configNumber('simulador.estrellaMediocampistaAsistencias', 3, 1, 50));
const PLAYER_STAR_REFERENCE_BONUS = configNumber('simulador.estrellaBonusReferencia', 0.30, 0, 2);

const PRESEASON_TURNS = Math.ceil(configNumber('calendario.diasPretemporada', 30, 0) / DAYS_PER_ADVANCE);
const POSTSEASON_TURNS_CONFIG = Math.ceil(configNumber('calendario.diasPostemporada', 0, 0) / DAYS_PER_ADVANCE);
const MAX_PRESEASON_FRIENDLIES = configNumber('calendario.amistososMaximosPretemporada', 5, 0);
const APP_VERSION = configValue('version', 'V9.04');
function syncVisibleGameVersion(){
  if(typeof document === 'undefined') return;
  const node = document.getElementById('gameVersionLabel');
  if(node) node.textContent = `Juego de fútbol online · ${APP_VERSION}`;
  document.documentElement?.setAttribute('data-game-version', String(APP_VERSION || ''));
}
syncVisibleGameVersion();

const RANKING_APPS_SCRIPT_URL = configValue('ranking.appsScriptUrl', '');
const RANKING_TOKEN = configValue('ranking.token', '');
const RANKING_REQUIRES_LOGIN = configBoolean('ranking.requiereLogin', true);
const RANKING_PAGE_SIZE = configNumber('ranking.resultadosPorPagina', 100, 10, 500);
const RANKING_UPLOAD_COOLDOWN_DAYS = configNumber('ranking.cooldownCargaDias', 50, 0, 366);
const RANKING_NAME = configValue('ranking.nombreRanking', 'Ranking Online');
const MANAGER_OBJECTIVE_RAW = configValue('manager.objetivoPuntosPorPartido', null);
function parseManagerObjectiveValue(raw){
  if(raw === null || raw === undefined || raw === '') return null;
  const value = Number(String(raw).replace(',', '.'));
  if(!Number.isFinite(value) || value < 0.3 || value > 2) return null;
  return value;
}
const MANAGER_OBJECTIVE_PPG = parseManagerObjectiveValue(MANAGER_OBJECTIVE_RAW);
const MANAGER_OBJECTIVE_DIVISION_1 = configNumber('manager.objetivoDivision1', 1.4, 0.3, 2);
const MANAGER_OBJECTIVE_DIVISION_2 = configNumber('manager.objetivoDivision2', 1.1, 0.3, 2);
const MANAGER_OBJECTIVE_DIVISION_3 = configNumber('manager.objetivoDivision3', 0.9, 0.3, 2);
const MANAGER_OBJECTIVE_MIN_MATCHES = Math.max(1, Math.round(configNumber('manager.partidosMinimosEvaluacionObjetivo', 5, 1, 100)));
const MANAGER_OBJECTIVE_FREEZE_BY_SEASON = configBoolean('manager.congelarEvaluacionObjetivoPorTemporada', true);
const MANAGER_PRESTIGE_INITIAL = Math.round(configNumber('manager.prestigioInicial', 0, 0, 99));
const MANAGER_CLUB_OPEN_PRESTIGE = Math.round(configNumber('manager.prestigioClubLibreMinimo', 20, 0, 99));
const MANAGER_REHIRE_BLOCK_SEASONS = Math.max(0, Math.round(configNumber('manager.temporadasBloqueoRecontratacion', 1, 0, 10)));
const CAMPO_DESTRUIDO_OPTION_VISIBLE = configBoolean('retosManager.campoDestruidoVisible', false);
const FOUNDER_MODE_ENABLED = configBoolean('modoFundador.activo', false);
const FOUNDER_CLUB_REPUTATION = Math.round(configNumber('modoFundador.prestigioClubInicial', 10, 1, 99));
const FOUNDER_CLUB_INITIAL_BUDGET = Math.max(0, Math.round(configNumber('modoFundador.presupuestoInicial', 0, 0)));
const FOUNDER_CLUB_INITIAL_CAPACITY = Math.max(0, Math.round(configNumber('modoFundador.capacidadEstadioInicial', 0, 0, 120000)));
const FOUNDER_CLUB_INITIAL_FANS = Math.max(0, Math.round(configNumber('modoFundador.hinchasIniciales', 500, 0)));
const FOUNDER_CLUB_INITIAL_FIELD = Math.round(configNumber('modoFundador.campoInicial', 30, 1, 100));
const FOUNDER_FREE_AGENTS_MIN_TOTAL = Math.max(0, Math.round(configNumber('modoFundador.libresMinimosTotales', 80, 0, 500)));
const FOUNDER_FREE_AGENTS_MIN_GK = Math.max(0, Math.round(configNumber('modoFundador.libresMinimosPorteros', 8, 0, 100)));
const FOUNDER_FREE_AGENTS_MIN_DEF = Math.max(0, Math.round(configNumber('modoFundador.libresMinimosDefensores', 20, 0, 200)));
const FOUNDER_FREE_AGENTS_MIN_MID = Math.max(0, Math.round(configNumber('modoFundador.libresMinimosMediocampistas', 24, 0, 200)));
const FOUNDER_FREE_AGENTS_MIN_ATT = Math.max(0, Math.round(configNumber('modoFundador.libresMinimosDelanteros', 16, 0, 200)));
const FOUNDER_STAFF_GOOD_WINS = Math.max(1, Math.round(configNumber('modoFundador.empleados.victoriasNivelBueno', 15, 1, 999)));
const FOUNDER_STAFF_ELITE_WINS = Math.max(FOUNDER_STAFF_GOOD_WINS, Math.round(configNumber('modoFundador.empleados.victoriasNivelElite', 45, FOUNDER_STAFF_GOOD_WINS, 999)));
const FOUNDER_ADMIN_COSTS_ENABLED = configBoolean('modoFundador.costosAdministrativosDiarios.activo', true);
const FOUNDER_ADMIN_BASE_BY_DIVISION = configValue('modoFundador.costosAdministrativosDiarios.basePorDivision', { 1:180000, 2:100000, 3:60000 });
const FOUNDER_ADMIN_ROSTER_RATE_BY_DIVISION = configValue('modoFundador.costosAdministrativosDiarios.porcentajeValorPlantelPorDivision', { 1:0.000015, 2:0.000012, 3:0.000010 });
const FOUNDER_ADMIN_DISTRIBUTION = configValue('modoFundador.costosAdministrativosDiarios.distribucion', { inscripcionLiga:0.18, seguridad:0.17, transporte:0.20, administracion:0.15, mantenimientoMinimo:0.15, seguros:0.15 });
const FOUNDER_CREST_OPTIONS_RAW = configValue('modoFundador.escudosDisponibles', [
  'img/escudos/fundador-1.webp',
  'img/escudos/fundador-2.webp',
  'img/escudos/fundador-3.webp',
  'img/escudos/fundador-4.webp',
  'img/escudos/fundador-5.webp',
  'img/escudos/fundador-6.webp',
  'img/escudos/fundador-7.webp',
  'img/escudos/fundador-8.webp',
  'img/escudos/fundador-9.webp'
]);
const FOUNDER_CREST_OPTIONS = (Array.isArray(FOUNDER_CREST_OPTIONS_RAW) ? FOUNDER_CREST_OPTIONS_RAW : [])
  .map(path => String(path || '').trim())
  .filter(path => path && /\.webp(\?.*)?$/i.test(path))
  .slice(0, 9);
const BANKRUPTCY_MODE_ENABLED = configBoolean('modoBancarrota.activo', true);
const BANKRUPTCY_INITIAL_BUDGET = Math.round(configNumber('modoBancarrota.cajaInicial', -500000000, -999999999999, 999999999999));
const BANKRUPTCY_PRESTIGE_REDUCTION = configNumber('modoBancarrota.reduccionPrestigio', 0.70, 0, 0.99);
const BANKRUPTCY_FANS_REDUCTION = configNumber('modoBancarrota.reduccionHinchas', 0.50, 0, 0.99);
const BANKRUPTCY_INITIAL_CAPACITY = Math.max(0, Math.round(configNumber('modoBancarrota.capacidadEstadioInicial', 0, 0, 120000)));
const BANKRUPTCY_INITIAL_FIELD = Math.round(configNumber('modoBancarrota.campoInicial', 100, 1, 100));
const BANKRUPTCY_ACADEMY_PLAYERS = Math.max(0, Math.round(configNumber('modoBancarrota.juvenilesIniciales', 20, 0, 80)));
const BANKRUPTCY_ACADEMY_GK_MIN = Math.max(0, Math.round(configNumber('modoBancarrota.juvenilesPorterosMinimos', 1, 0, 20)));
const BANKRUPTCY_LOYAL_FIRST_TEAM_PLAYERS = Math.max(0, Math.round(configNumber('modoBancarrota.jugadoresLealesPrimerEquipo', 14, 0, 35)));
const BANKRUPTCY_LOYAL_GK_MIN = Math.max(0, Math.round(configNumber('modoBancarrota.jugadoresLealesPorterosMinimos', 1, 0, 5)));
const MANAGER_XP_WIN = Math.round(configNumber('manager.experienciaPorVictoria', 10, 0, 999));
const MANAGER_XP_DRAW = Math.round(configNumber('manager.experienciaPorEmpate', 3, 0, 999));
const MANAGER_XP_LOSS = Math.round(configNumber('manager.experienciaPorDerrota', 1, 0, 999));
const MANAGER_XP_TO_PRESTIGE_RATE = configNumber('manager.experienciaAprestigio', 0.001, 0, 1);
const MANAGER_PRESTIGE_WINS_STEP = Math.max(1, Math.round(configNumber('manager.victoriasPorPrestigio', 10, 1, 100)));
const MANAGER_PRESTIGE_OBJECTIVE_REWARD = Math.round(configNumber('manager.prestigioPorObjetivoCumplido', 5, 0, 25));
const MANAGER_PRESTIGE_DISMISSAL_PENALTY = Math.round(configNumber('manager.prestigioPenalizacionDespido', 2, 0, 25));

const TEAM_COHESION_START = configNumber('cohesion.valorInicial', 10, 0, 100);
const TEAM_COHESION_MATCH_GAIN = configNumber('cohesion.gananciaPorPartido', 7, 0, 100);
const TEAM_COHESION_DEFEAT_GOAL_LOSS = configNumber('cohesion.perdidaPorGolEnContraDerrota', 1, 0, 20);
const TEAM_COHESION_TACTIC_CHANGE_LOSS = configNumber('cohesion.perdidaPorCambioTactico', 8, 0, 100);
const TEAM_COHESION_PLAYER_CHANGE_LOSS = configNumber('cohesion.perdidaPorCambioJugador', 1, 0, 100);
const TEAM_COHESION_SIGNING_LOSS = configNumber('cohesion.perdidaPorFichaje', 2, 0, 100);
const TEAM_COHESION_SALE_LOSS = configNumber('cohesion.perdidaPorVenta', 3, 0, 100);
const TEAM_COHESION_DISMISSAL_LOSS = configNumber('cohesion.perdidaPorDespedirJugador', 1, 0, 100);
const TEAM_COHESION_YOUTH_CONTRACT_GAIN = configNumber('cohesion.gananciaPorContratoProfesionalJuvenil', 3, 0, 100);
const TEAM_MORALE_DISMISSAL_LOSS = configNumber('moral.perdidaPlantelPorDespedirJugador', 1, 0, 98);
const TEAM_MORALE_DEFEAT_EXTRA_LOSS = configNumber('moral.perdidaExtraPorDerrota', 2, 0, 20);
const CAPTAINCY_ENABLED = configBoolean('capitania.activo', true);
const CAPTAINCY_TARGET_MATCHES = Math.max(1, Math.round(configNumber('capitania.partidosObjetivoAprox', 60, 1, 150)));
const CAPTAINCY_MAX_PERCENT = Math.max(1, Math.min(99, Math.round(configNumber('capitania.maximoPorcentaje', 99, 1, 99))));
const CAPTAINCY_LEARNING_FACTOR_MIN = configNumber('capitania.aprendizaje.factorMinimo', 0.80, 0.10, 3);
const CAPTAINCY_LEARNING_FACTOR_MAX = configNumber('capitania.aprendizaje.factorMaximo', 1.20, CAPTAINCY_LEARNING_FACTOR_MIN, 3);
const TEAM_COHESION_TACTICAL_TRAINING_CHANCE = configNumber('cohesion.probabilidadEntrenamientoTacticoPorCasilla', 0.35, 0, 1);
const TEAM_COHESION_TACTICAL_TRAINING_GAIN = configNumber('cohesion.gananciaEntrenamientoTacticoPorCasilla', 1, 0, 100);
const BOT_BALANCE_ENABLED = configBoolean('equilibrioBots.activo', true);
const BOT_BALANCE_DIFFICULTY = String(configValue('equilibrioBots.dificultad', 'dificil') || 'normal').trim().toLowerCase();
const BOT_BALANCE_ONLY_MANAGER_DIVISION = configBoolean('equilibrioBots.soloDivisionManager', true);
const BOT_BALANCE_ON_SEASON_START = configBoolean('equilibrioBots.nivelarAlInicioTemporada', true);
const BOT_BALANCE_DURING_SEASON = configBoolean('equilibrioBots.mantenerDuranteTemporada', true);
const BOT_BALANCE_MAINTENANCE_INTERVAL_MATCHDAYS = Math.max(1, Math.round(configNumber('equilibrioBots.intervaloMantenimientoFechas', 2, 1, 38)));
const BOT_BALANCE_POSITION_BONUS_MAX = configNumber('equilibrioBots.bonusMaximoPorPosicion', 8, 0, 30);
const BOT_BALANCE_MORALE_FLOOR = configNumber('equilibrioBots.pisoMoral', 65, 1, 99);
const BOT_BALANCE_CONDITION_FLOOR = configNumber('equilibrioBots.pisoFisico', 76, 0, 99);
const BOT_BALANCE_COHESION_FLOOR = configNumber('equilibrioBots.pisoCohesion', 70, 0, 100);
const BOT_BALANCE_MORALE_SPREAD = Math.round(configNumber('equilibrioBots.margenMoral', 8, 0, 30));
const BOT_BALANCE_CONDITION_SPREAD = Math.round(configNumber('equilibrioBots.margenFisico', 6, 0, 30));
const BOT_BALANCE_COHESION_SPREAD = Math.round(configNumber('equilibrioBots.margenCohesion', 10, 0, 30));
const BOT_BALANCE_MAINTENANCE_CONDITION_GAIN = configNumber('equilibrioBots.recuperacionFisicaPorMantenimiento', 8, 0, 99);
const BOT_BALANCE_MAINTENANCE_MORALE_GAIN = configNumber('equilibrioBots.recuperacionMoralPorMantenimiento', 5, 0, 99);
const BOT_BALANCE_MAINTENANCE_COHESION_GAIN = configNumber('equilibrioBots.recuperacionCohesionPorMantenimiento', 4, 0, 100);
const BOT_BALANCE_DAILY_WEAR_RECOVERY = configNumber('equilibrioBots.recuperacionDesgasteDiariaBot', 4, 0, 30);
const BOT_BALANCE_MATCH_WEAR_CAP = configNumber('equilibrioBots.desgasteMaximoBotAntesDePartido', 38, 0, 98);
const BOT_BALANCE_EMERGENCY_CONDITION_FLOOR = configNumber('equilibrioBots.pisoFisicoBotAntesDePartido', 58, 0, 99);
const BOT_BALANCE_DEVELOPMENT_CHANCE = configNumber('equilibrioBots.desarrolloPlantelPorTemporada', 0.14, 0, 1);
const BOT_BALANCE_POSITION_DEVELOPMENT_BONUS = configNumber('equilibrioBots.bonusDesarrolloPorPosicion', 0.08, 0, 1);
const BOT_BALANCE_MAX_SKILL_BOOST = configNumber('equilibrioBots.maximoBoostBotPorHabilidad', 12, 0, 30);
const PROFESSIONAL_QUALITY_SCALE_VERSION = String(configValue('calidadProfesional.version', 'V8.08') || 'V8.08');
const PROFESSIONAL_QUALITY_APPLY_EXISTING = configBoolean('calidadProfesional.aplicarAPartidasExistentes', true);
const PROFESSIONAL_QUALITY_EXCLUDE_LEGENDS = configBoolean('calidadProfesional.excluirLeyendas', true);
const PROFESSIONAL_QUALITY_REDUCTION_TIERS = Array.isArray(configValue('calidadProfesional.reduccionPorMedia', [])) ? configValue('calidadProfesional.reduccionPorMedia', []) : [];
const LEGEND_TRAINING_SKILL_GAIN_MULTIPLIER = configNumber('calidadProfesional.leyendas.multiplicadorEntrenamiento', 3, 1, 20);
const LEGEND_BOT_DEVELOPMENT_CHANCE = configNumber('calidadProfesional.leyendas.desarrolloBotProbabilidad', 0.18, 0, 1);
const LEGEND_BOT_MAX_SKILL_BOOST = configNumber('calidadProfesional.leyendas.maximoBoostBotPorHabilidad', 18, 0, 30);
const LEGEND_REGEN_MEDIA_MIN = configNumber('calidadProfesional.leyendas.regeneracionMediaMin', 40, 1, 99);
const LEGEND_REGEN_MEDIA_MAX = Math.max(LEGEND_REGEN_MEDIA_MIN, configNumber('calidadProfesional.leyendas.regeneracionMediaMax', 62, 1, 99));
const BOT_MANAGER_TOP_PLAYERS_COUNT = Math.max(3, Math.min(5, Math.round(configNumber('equilibrioBots.tacticaContraManager.cantidadMejoresJugadores', 5, 3, 5))));
const BOT_MANAGER_TOP_PLAYER_INCLUSION_BONUS = configNumber('equilibrioBots.tacticaContraManager.bonusInclusionMejorJugador', 5000, 1000, 50000);
const BOT_QUICK_OVEREXERTION_ENABLED = configBoolean('equilibrioBots.tacticaRapida.sobreexigenciaSiPierde', true);
const BOT_QUICK_OVEREXERTION_MAX_GOALS = Math.max(0, Math.round(configNumber('equilibrioBots.tacticaRapida.maxGolesExtraPorEquipo', 1, 0, 5)));
const PLAYER_MORALE_START = 60;
const PSYCHOLOGIST_COST = configNumber('empleados.psicologoCosto', 500000, 0);
const PSYCHOLOGIST_SUCCESS_CHANCE = configNumber('empleados.psicologoProbabilidadExito', 0.90, 0, 1);
const PSYCHOLOGIST_COOLDOWN_TURNS = Math.ceil(configNumber('empleados.psicologoCooldownDias', 35, 0) / DAYS_PER_ADVANCE);
const PSYCHOLOGIST_MORALE_GAIN_MIN = Math.round(configNumber('empleados.psicologoMoralMin', 6, 0, 99));
const PSYCHOLOGIST_MORALE_GAIN_MAX = Math.round(configNumber('empleados.psicologoMoralMax', 10, PSYCHOLOGIST_MORALE_GAIN_MIN, 99));
const KINESIOLOGIST_COST = configNumber('empleados.kinesiologoCosto', 1000000, 0);
const KINESIOLOGIST_FAILURE_CHANCE = configNumber('empleados.kinesiologoProbabilidadFallo', 0.20, 0, 1);
const KINESIOLOGIST_AUTO_TREATMENT_COST_PER_DAY = Math.max(0, Math.round(configNumber('empleados.kinesiologoCostoAutomaticoPorDiaLesion', 2000, 0)));
const KINESIOLOGIST_SUCCESS_CHANCE_BY_CATEGORY = Object.freeze({
  regular:configNumber('empleados.kinesiologoProbabilidadExitoPorCategoria.regular', 1 - KINESIOLOGIST_FAILURE_CHANCE, 0, 1),
  bueno:configNumber('empleados.kinesiologoProbabilidadExitoPorCategoria.bueno', 0.90, 0, 1),
  elite:configNumber('empleados.kinesiologoProbabilidadExitoPorCategoria.elite', 0.98, 0, 1)
});
const KINESIOLOGIST_DIFFERENTIATED_WEAR_RECOVERY = Math.round(configNumber('empleados.kinesiologoTrabajoDiferenciado.recuperacionDesgasteDiaria', 4, 0, 99));
const KINESIOLOGIST_DIFFERENTIATED_CONDITION_RECOVERY = Math.round(configNumber('empleados.kinesiologoTrabajoDiferenciado.recuperacionFormaDiaria', 5, 0, 99));
const KINESIOLOGIST_DIFFERENTIATED_MORALE_RECOVERY = Math.round(configNumber('empleados.kinesiologoTrabajoDiferenciado.recuperacionMoralDiaria', 1, 0, 99));
const KINESIOLOGIST_DIFFERENTIATED_INJURY_REDUCTION = Object.freeze({
  regular:configNumber('empleados.kinesiologoTrabajoDiferenciado.reduccionLesionPorCategoria.regular', 0.40, 0, 0.95),
  bueno:configNumber('empleados.kinesiologoTrabajoDiferenciado.reduccionLesionPorCategoria.bueno', 0.55, 0, 0.95),
  elite:configNumber('empleados.kinesiologoTrabajoDiferenciado.reduccionLesionPorCategoria.elite', 0.85, 0, 0.95)
});
const INJURED_SUB_MAX_TURNS = Math.ceil(configNumber('lesiones.lesionadoSuplenteDiasMax', 63, 0) / DAYS_PER_ADVANCE);
const INJURED_SUB_PENALTY = configNumber('lesiones.penalizacionLesionadoSuplente', 0.30, 0, 1);
const DEFAULT_TRAINING_TYPE = 'regenerative';
const DEFAULT_INDIVIDUAL_TRAINING_TYPE = 'balanced';
const TRAINING_OPTIONS = [
  { value:'regenerative', label:'Regenerativo', tone:'regen' },
  { value:'massage', label:'Masajista', tone:'massage' },
  { value:'intense', label:'Entrenamiento intenso', tone:'intense' },
  { value:'tactical', label:'Entrenamiento táctico', tone:'tactical' },
  { value:'dayoff', label:'Turno libre', tone:'dayoff' }
];
const TRAINING_INDIVIDUAL_OPTIONS = [
  { value:'balanced', label:'Equilibrado', tone:'tactical' },
  { value:'recovery', label:'Recuperación', tone:'regen' },
  { value:'physical', label:'Físico', tone:'intense' },
  { value:'technical', label:'Técnico', tone:'massage' },
  { value:'defensive', label:'Defensivo', tone:'tactical' },
  { value:'attacking', label:'Ofensivo', tone:'intense' },
  { value:'goalkeeper', label:'Portería', tone:'regen' },
  { value:'mental', label:'Mental', tone:'dayoff' },
  { value:'rest', label:'Descanso', tone:'dayoff' }
];
const TRAINING_DAY_LABELS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const TRAINING_DAY_SLOTS = [
  { key:'pre', label:'Pre turno' },
  { key:'morning', label:'Turno mañana' },
  { key:'afternoon', label:'Turno tarde' },
  { key:'night', label:'Turno noche' }
];
const TRAINING_SLOT_EFFECTIVENESS = configNumber('entrenamiento.efectividadPorCasilla', 0.250, 0, 2);
const TRAINING_INDIVIDUAL_ENABLED = configBoolean('entrenamiento.entrenamientoIndividualDiario', true);
const TRAINING_INDIVIDUAL_SLOT_EFFECTIVENESS = configNumber('entrenamiento.efectividadIndividualPorDia', 0.250, 0, 2);
const TRAINING_INDIVIDUAL_INITIAL = configValue('entrenamiento.entrenamientoIndividualInicial', DEFAULT_INDIVIDUAL_TRAINING_TYPE);
const TRAINING_SKILL_CURVE_ENABLED = configValue('entrenamiento.curvaHabilidadActual', true) !== false;
const TRAINING_SKILL_MIN_FINAL_CHANCE = configNumber('entrenamiento.probabilidadMinimaSubidaHabilidad', 0, 0, 1);
const TRAINING_SKILL_GAIN_MULTIPLIER = configNumber('entrenamiento.multiplicadorSubidaHabilidades', 2, 1, 20);
const TRAINING_DEFAULT_SLOT_PLAN = configValue('entrenamiento.planSemanalInicial', { pre:'regenerative', morning:'intense', afternoon:'tactical', night:'dayoff' });
const TRAINING_APPLY_CURRENT_DAY_ONLY = configBoolean('entrenamiento.aplicarSoloDiaActual', true);
const PLAYER_WEAR_ENABLED = configBoolean('entrenamiento.desgaste.activo', true);
const PLAYER_WEAR_MAX = configNumber('entrenamiento.desgaste.maximo', 98, 0, 98);
const PLAYER_WEAR_MATCH_MIN = configNumber('entrenamiento.desgaste.desgasteMinPartido', 2, 0, 10);
const PLAYER_WEAR_MATCH_MAX = configNumber('entrenamiento.desgaste.desgasteMaxPartido', 4, 0, 10);
const PLAYER_WEAR_INTENSE_TRAINING = configNumber('entrenamiento.desgaste.desgastePorTurnoIntenso', 1, 0, 10);
const PLAYER_WEAR_MASSAGE_RECOVERY = configNumber('entrenamiento.desgaste.recuperacionPorTurnoMasajista', 1, 0, 10);

const FORMATIONS = {
  '4-4-2': ['POR','LD','DFC','DFC','LI','MC','MC','MC','MC','DC','DC'],
  '4-3-3': ['POR','LD','DFC','DFC','LI','MCD','MC','MC','EI','DC','ED'],
  '4-2-3-1': ['POR','LD','DFC','DFC','LI','MCD','MCD','MI','MCO','MD','DC'],
  '3-5-2': ['POR','DFC','DFC','DFC','MCD','MI','MC','MC','MD','DC','DC'],
  '5-3-2': ['POR','LD','DFC','DFC','DFC','LI','MC','MC','MC','DC','DC'],
  '4-1-4-1': ['POR','LD','DFC','DFC','LI','MCD','MI','MCO','MCO','MD','DC'],
  '3-4-3': ['POR','DFC','DFC','DFC','MC','MC','MC','MC','DC','DC','DC'],
  '4-5-1': ['POR','LD','DFC','DFC','LI','MCD','MI','MC','MC','MD','DC'],
  '4-3-1-2': ['POR','LD','DFC','DFC','LI','MC','MC','MC','MCO','EI','ED'],
  '5-4-1': ['POR','LD','DFC','DFC','DFC','LI','MI','MC','MC','MD','DC']
};
const FORMATION_VISUALS = {
  '4-4-2':[4,0,4,0,2],
  '4-3-3':[4,1,2,0,3],
  '4-2-3-1':[4,2,0,3,1],
  '3-5-2':[3,1,4,0,2],
  '5-3-2':[5,0,3,0,2],
  '4-1-4-1':[4,1,4,0,1],
  '3-4-3':[3,0,4,0,3],
  '4-5-1':[4,1,4,0,1],
  '4-3-1-2':[4,0,3,1,2],
  '5-4-1':[5,0,4,0,1]
};
const MENTALITIES = ['muy_defensivo','defensivo','normal','ofensivo','muy_ofensivo'];
const SUB_TRIGGERS = [
  { value:'tired', label:'Cambiar a los cansados' },
  { value:'best', label:'Mejores suplentes' },
  { value:'injuryOnly', label:'Solo cambios por lesión' }
];

const TACTIC_SECTOR_STYLE_ENABLED = configBoolean('tactica.estilosSector.activo', true);
const TACTIC_SECTOR_STYLE_EFFECT_INTENSITY = configNumber('tactica.estilosSector.intensidadEfecto', 0.85, 0, 2);
const TACTIC_SECTOR_STYLE_OPTIONS = [
  { value:'presion_alta', label:'Presión alta', tone:'intense' },
  { value:'rotacion', label:'Rotación', tone:'massage' },
  { value:'posicional', label:'Posicional', tone:'tactical' },
  { value:'repliegue', label:'Repliegue', tone:'regen' }
];
const DEFAULT_TACTIC_SECTOR_STYLES = {
  defense: configValue('tactica.estilosSector.defensaInicial', 'posicional'),
  midfield: configValue('tactica.estilosSector.mediosInicial', 'posicional'),
  attack: configValue('tactica.estilosSector.delanterosInicial', 'posicional')
};
const TACTIC_STYLE_CONDITION_DELTAS = {
  highPress: configNumber('tactica.estilosSector.cansancioPresionAlta', -3, -20, 20),
  rotation: configNumber('tactica.estilosSector.cansancioRotacion', -1, -20, 20),
  regroup: configNumber('tactica.estilosSector.cansancioRepliegue', -1, -20, 20)
};
function injuryMinTurns(path, fallbackDays){
  return Math.max(1, Math.ceil(configNumber(path, fallbackDays, 1) / DAYS_PER_ADVANCE));
}
function injuryMaxTurns(path, fallbackDays, minTurns=1){
  return Math.max(minTurns, Math.floor(configNumber(path, fallbackDays, 1) / DAYS_PER_ADVANCE));
}
function injuryRule(name, probability, minPath, minDays, maxPath, maxDays){
  const minTurns = injuryMinTurns(minPath, minDays);
  const maxTurns = injuryMaxTurns(maxPath, maxDays, minTurns);
  return { name, probability, minTurns, maxTurns };
}
const INJURY_TABLE = [
  injuryRule('Contusión', configNumber('lesiones.pesoContusion', 34, 0, 100), 'lesiones.contusionMinDias', 7, 'lesiones.contusionMaxDias', 21),
  injuryRule('Distensión', configNumber('lesiones.pesoDistension', 30, 0, 100), 'lesiones.distensionMinDias', 21, 'lesiones.distensionMaxDias', 56),
  injuryRule('Desgarro', configNumber('lesiones.pesoDesgarro', 20, 0, 100), 'lesiones.desgarroMinDias', 28, 'lesiones.desgarroMaxDias', 84),
  injuryRule('Esguince', configNumber('lesiones.pesoEsguince', 10, 0, 100), 'lesiones.esguinceMinDias', 35, 'lesiones.esguinceMaxDias', 105),
  injuryRule('Rotura', configNumber('lesiones.pesoRotura', 5, 0, 100), 'lesiones.roturaMinDias', 90, 'lesiones.roturaMaxDias', 210),
  injuryRule('Fractura', configNumber('lesiones.pesoFractura', 1, 0, 100), 'lesiones.fracturaMinDias', 180, 'lesiones.fracturaMaxDias', 400)
];
const INJURY_CHANCE_MULTIPLIER = configNumber('lesiones.multiplicadorProbabilidad', 0.30, 0, 2);
const BOT_INJURY_MULTIPLIER = configNumber('lesiones.multiplicadorBots', 0.50, 0, 2);
const MANAGER_INJURY_PROTECTION_MATCHES = Math.max(0, Math.round(configNumber('lesiones.partidosProteccionManager', 50, 0, 1000)));
const MANAGER_INITIAL_INJURY_MULTIPLIER = configNumber('lesiones.multiplicadorManagerPrimerosPartidos', 0.75, 0, 2);
const LIVE_MATCH_INJURY_MULTIPLIER = configNumber('lesiones.multiplicadorSimuladorVivo', 0.75, 0, 2);
const QUICK_MATCH_INJURY_MULTIPLIER = configNumber('lesiones.multiplicadorSimulacionRapida', 0.85, 0, 2);
const BASE_INJURY_CHANCE = configNumber('lesiones.lesionBase', 0.05, 0, 1);
const FATIGUE_INJURY_STEP = configNumber('lesiones.fatigaPaso', 5, 1);
const FATIGUE_INJURY_BONUS = configNumber('lesiones.fatigaBonus', 0.01, 0, 1);
const FIRST_TEAM_SEASON_INJURY_MINIMUM = Math.max(0, Math.round(configNumber('lesiones.minimoPrimerEquipoPorTemporada', 30, 0, 100)));
const FIRST_TEAM_MIDWEEK_INJURY_ENABLED = configBoolean('lesiones.compensacionEntreSemanaActiva', true);
const FIRST_TEAM_MIDWEEK_INJURY_INTERVAL_DAYS = Math.max(1, Math.round(configNumber('lesiones.compensacionIntervaloMinimoDias', 3, 1, 30)));
const FIRST_TEAM_MIDWEEK_MAX_ACTIVE = Math.max(1, Math.round(configNumber('lesiones.compensacionMaxLesionadosSimultaneos', 5, 1, 20)));
const FIRST_TEAM_MIDWEEK_MIN_AVAILABLE = Math.max(11, Math.round(configNumber('lesiones.compensacionMinimoJugadoresDisponibles', 14, 11, 40)));
const FIRST_TEAM_MIDWEEK_PLAYER_REST_DAYS = Math.max(0, Math.round(configNumber('lesiones.compensacionDescansoRepeticionJugadorDias', 21, 0, 180)));
const FIRST_TEAM_MIDWEEK_FORCE_FINAL_DAYS = Math.max(0, Math.round(configNumber('lesiones.compensacionForzarUltimosDias', 7, 0, 60)));
const HIGH_PARTICIPATION_REFERENCE_MATCHES = Math.max(1, Math.round(configNumber('dificultad.partidosReferenciaTemporada', 34, 1, 80)));
const HIGH_PARTICIPATION_INJURY_THRESHOLD = configNumber('dificultad.umbralParticipacionLesionLarga', 0.80, 0, 1);
const HIGH_PARTICIPATION_INJURY_CHANCE_MIN = configNumber('dificultad.probabilidadLesionLargaMin', 0.35, 0, 0.95);
const HIGH_PARTICIPATION_INJURY_CHANCE_MAX = Math.max(HIGH_PARTICIPATION_INJURY_CHANCE_MIN, configNumber('dificultad.probabilidadLesionLargaMax', 0.65, 0, 0.95));
const HIGH_PARTICIPATION_LONG_INJURY_RATE = configNumber('dificultad.pesoLesionLargaAltaParticipacion', 0.90, 0, 1);
const HIGH_PARTICIPATION_LONG_INJURY_MIN_TURNS = Math.max(1, Math.ceil(configNumber('dificultad.lesionLargaMinDias', 90, 1) / DAYS_PER_ADVANCE));
const POST_MATCH_RECOVERY_MIN = configNumber('simulador.recuperacionAutomaticaPostPartidoMin', 4, 0, 99);
const POST_MATCH_RECOVERY_MAX = Math.max(POST_MATCH_RECOVERY_MIN, configNumber('simulador.recuperacionAutomaticaPostPartidoMax', 6, 0, 99));
const POST_MATCH_RECOVERY_USE_STAMINA = configBoolean('simulador.recuperacionPostPartidoUsaResistencia', true);
const POST_MATCH_RECOVERY_STAMINA_RULES = Array.isArray(configValue('simulador.recuperacionPostPartidoPorResistencia', []))
  ? configValue('simulador.recuperacionPostPartidoPorResistencia', [])
      .map(rule => ({
        minResistencia:Number(rule?.minResistencia ?? rule?.min ?? 0),
        maxResistencia:Number(rule?.maxResistencia ?? rule?.max ?? 99),
        recuperacionMin:Number(rule?.recuperacionMin ?? rule?.minRecuperacion ?? 0),
        recuperacionMax:Number(rule?.recuperacionMax ?? rule?.maxRecuperacion ?? 0)
      }))
      .filter(rule => Number.isFinite(rule.minResistencia) && Number.isFinite(rule.maxResistencia) && Number.isFinite(rule.recuperacionMin) && Number.isFinite(rule.recuperacionMax))
      .sort((a,b) => a.minResistencia - b.minResistencia)
  : [];
const MATCH_CONDITION_LOSS_MIN = configNumber('simulador.desgastePartidoMin', 40, 0, 99);
const MATCH_CONDITION_LOSS_MAX = Math.max(MATCH_CONDITION_LOSS_MIN, configNumber('simulador.desgastePartidoMax', 78, 0, 99));
const MATCH_CONDITION_LOSS_USE_STAMINA = configBoolean('simulador.desgastePartidoUsaResistencia', true);
const MATCH_CONDITION_LOSS_STAMINA_RULES = Array.isArray(configValue('simulador.desgastePartidoPorResistencia', []))
  ? configValue('simulador.desgastePartidoPorResistencia', [])
      .map(rule => ({
        minResistencia:Number(rule?.minResistencia ?? rule?.min ?? 1),
        maxResistencia:Number(rule?.maxResistencia ?? rule?.max ?? 99),
        reduccion:configClamp(Number(rule?.reduccion ?? rule?.reduction ?? 0), 0, 0.95)
      }))
      .filter(rule => Number.isFinite(rule.minResistencia) && Number.isFinite(rule.maxResistencia) && Number.isFinite(rule.reduccion))
      .sort((a,b) => a.minResistencia - b.minResistencia)
  : [];
const GOALKEEPER_CONDITION_LOSS_FACTOR = configNumber('simulador.factorDesgasteArquero', 0.5, 0, 1);
const PITCH_CONDITIONS = {
  'Excelente': { passDelta:10, chanceMultiplier:1.20, fatigueBonus:0, injuryBonus:0 },
  'Normal': { passDelta:0, chanceMultiplier:1.00, fatigueBonus:0, injuryBonus:0 },
  'Regular': { passDelta:-10, chanceMultiplier:0.80, fatigueBonus:0, injuryBonus:0 },
  'Muy malo': { passDelta:-20, chanceMultiplier:0.70, fatigueBonus:10, injuryBonus:0.10 },
  'Injugable': { passDelta:-50, chanceMultiplier:0.50, fatigueBonus:20, injuryBonus:0.30 }
};
const REPLANT_COST = configNumber('estadio.costoReplantarCesped', 2000000, 0);
const REPLANT_TURNS = Math.ceil(configNumber('estadio.diasReplantarCesped', 35, 0) / DAYS_PER_ADVANCE);
const PATCH_COST = configNumber('estadio.costoParchearCampo', 200000, 0);
const PATCH_TURNS = Math.ceil(configNumber('estadio.diasParchearCampo', 21, 0) / DAYS_PER_ADVANCE);
const PATCH_GAIN_PER_TURN = configNumber('estadio.mejoraParchePorAvance', 5, 0, 100);
const AFA_FIELD_SANCTION_ENABLED = configBoolean('estadio.afaCampoSancionActiva', true);
const AFA_FIELD_SANCTION_THRESHOLD = Math.max(1, Math.round(configNumber('estadio.afaCampoUmbral', 10, 1, 100)));
const AFA_FIELD_SANCTION_FINE = Math.max(0, Math.round(configNumber('estadio.afaCampoMulta', 1000000, 0)));
const AFA_FIELD_MANDATORY_REPLANT_COST = Math.max(0, Math.round(configNumber('estadio.afaCampoReplanteObligatorio', 4000000, 0)));
const AFA_FIELD_RESTORED_SCORE = Math.max(1, Math.round(configNumber('estadio.afaCampoEstadoRestaurado', 100, 1, 100)));
const AFA_FIELD_RESTORE_DAYS = Math.max(1, Math.round(configNumber('estadio.afaCampoDiasRestauracion', 1, 1, 30)));
const BOT_FIELDS_FIXED_BY_SEASON = configBoolean('estadio.botsCampoFijoPorTemporada', true);
const RAIN_FIELD_DETERIORATION_ENABLED = configBoolean('estadio.clima.lluviaDeterioroActivo', true);
const RAIN_FIELD_DETERIORATION_LIGHT = configNumber('estadio.clima.lluviaLeveExtraDeterioro', 3, 0, 20);
const RAIN_FIELD_DETERIORATION_HEAVY = configNumber('estadio.clima.lluviaIntensaExtraDeterioro', 7, 0, 30);
const FIELD_DETERIORATION_MULTIPLIER = configNumber('estadio.deterioroCampoMultiplicador', 2, 0, 10);
const BOT_FIELD_MIN_SCORE = configNumber('estadio.botsCampoMinimo', 30, 1, 100);
const BOT_FIELD_MAX_SCORE = Math.max(BOT_FIELD_MIN_SCORE, configNumber('estadio.botsCampoMaximo', 95, 1, 100));
const BOT_FIELD_INITIAL_BASE = configNumber('estadio.botsCampoBaseInicial', 58, 1, 100);
const BOT_FIELD_POSITION_RANGE = configNumber('estadio.botsCampoRangoPorPosicion', 42, 0, 100);
const BOT_FIELD_AUTO_REPAIR_ENABLED = configBoolean('estadio.botsCampoAutoRepararEstadosInvalidos', true);
const BOT_FIELD_INVALID_THRESHOLD = configNumber('estadio.botsCampoUmbralInvalido', Math.max(1, BOT_FIELD_MIN_SCORE - 1), 1, 100);
const BOT_FIELD_MASS_REPAIR_RATIO = configNumber('estadio.botsCampoPorcentajeMasivoInjugable', 0.60, 0, 1);
const TICKET_PRICE_MIN = Math.round(configNumber('estadio.precioEntradaMinimo', 10, 1, 1000000));
const TICKET_PRICE_MAX = Math.max(TICKET_PRICE_MIN, Math.round(configNumber('estadio.precioEntradaMaximo', 500, TICKET_PRICE_MIN, 1000000)));
const TICKET_PRICE_INITIAL = Math.max(TICKET_PRICE_MIN, Math.min(TICKET_PRICE_MAX, Math.round(configNumber('estadio.precioEntradaInicial', 100, TICKET_PRICE_MIN, TICKET_PRICE_MAX))));
const BOT_TICKET_DYNAMIC_ENABLED = configBoolean('estadio.precioEntradaBotAutomatico', true);
const BOT_TICKET_LOW_PRESTIGE_MAX = Math.round(configNumber('estadio.precioEntradaBotPrestigioBajoHasta', 39, 0, 99));
const BOT_TICKET_MEDIUM_PRESTIGE_MAX = Math.max(BOT_TICKET_LOW_PRESTIGE_MAX, Math.round(configNumber('estadio.precioEntradaBotPrestigioMedioHasta', 69, BOT_TICKET_LOW_PRESTIGE_MAX, 99)));
const BOT_TICKET_MEDIUM_MULTIPLIER_MIN = configNumber('estadio.precioEntradaBotMultiplicadorMedioMin', 1.50, 1, 20);
const BOT_TICKET_MEDIUM_MULTIPLIER_MAX = Math.max(BOT_TICKET_MEDIUM_MULTIPLIER_MIN, configNumber('estadio.precioEntradaBotMultiplicadorMedioMax', 2.00, 1, 20));
const BOT_TICKET_HIGH_MULTIPLIER_MIN = configNumber('estadio.precioEntradaBotMultiplicadorAltoMin', 2.00, 1, 20);
const BOT_TICKET_HIGH_MULTIPLIER_MAX = Math.max(BOT_TICKET_HIGH_MULTIPLIER_MIN, configNumber('estadio.precioEntradaBotMultiplicadorAltoMax', 5.00, 1, 20));
const BOT_TICKET_ROUNDING = Math.max(1, Math.round(configNumber('estadio.precioEntradaBotRedondeo', 10, 1, 1000000)));
const AWAY_FANS_MIN_RATE = configNumber('estadio.porcentajeVisitanteMinimo', 0.07, 0, 0.50);
const AWAY_FANS_MAX_RATE = Math.max(AWAY_FANS_MIN_RATE, configNumber('estadio.porcentajeVisitanteMaximo', 0.10, 0, 0.50));
const AWAY_FANS_MAX_WITH_LOCAL_SHORTAGE = Math.max(AWAY_FANS_MAX_RATE, configNumber('estadio.porcentajeVisitanteMaximoConFaltanteLocal', 0.50, 0, 0.80));
const HOME_CROWD_FANS_PER_BONUS_POINT = Math.max(1, Math.round(configNumber('estadio.hinchasPorPuntoBonusLocal', 1000, 1, 1000000)));
const HOME_CROWD_BONUS_MAX = Math.round(configNumber('estadio.bonusLocalMaximo', 50, 0, 99));
const FAN_GROWTH_MASS_BASE = configNumber('estadio.hinchasMasaBase', 12, 0, 1000000);
const FAN_GROWTH_CURRENT_SQRT_FACTOR = configNumber('estadio.hinchasMasaActualRaiz', 0.45, 0, 1000);
const FAN_GROWTH_BASE_SQRT_FACTOR = configNumber('estadio.hinchasMasaVitaliciosRaiz', 0.05, 0, 1000);
const FAN_RESULT_WIN_FACTOR = configNumber('estadio.hinchasFactorVictoria', 0.80, -10, 10);
const FAN_RESULT_DRAW_FACTOR = configNumber('estadio.hinchasFactorEmpate', 0, -10, 10);
const FAN_RESULT_LOSS_FACTOR = configNumber('estadio.hinchasFactorDerrota', -0.65, -10, 10);
const FAN_POSITION_FACTORS_RAW = configValue('estadio.hinchasFactoresPosicion', []);
const FAN_POSITION_FACTORS = (Array.isArray(FAN_POSITION_FACTORS_RAW) ? FAN_POSITION_FACTORS_RAW : []).map((row, index) => ({
  from:Math.max(1, Math.round(Number(row?.desde ?? row?.from ?? (index + 1)))),
  to:Math.max(1, Math.round(Number(row?.hasta ?? row?.to ?? row?.desde ?? row?.from ?? (index + 1)))),
  factor:Number.isFinite(Number(row?.factor)) ? Number(row.factor) : 0
})).sort((a,b) => a.from - b.from);
const FAN_MAX_LOSS_MINIMUM = Math.max(0, Math.round(configNumber('estadio.hinchasPerdidaMaximaMinima', 8, 0, 1000000)));
const FAN_MAX_LOSS_CURRENT_RATE = configNumber('estadio.hinchasPerdidaMaximaPorcentaje', 0.006, 0, 1);
const FAN_CHEAP_TICKET_LOSS_SHIELD_MAX = configNumber('estadio.entradaBarataProteccionPerdidaMaxima', 0.35, 0, 1);
const FAN_EXPENSIVE_TICKET_GAIN_BLOCK_MAX = configNumber('estadio.entradaCaraBloqueoGananciaMaxima', 0.40, 0, 1);
const FAN_RIVAL_PRESTIGE_MAX_DIFF = Math.max(1, configNumber('estadio.hinchasPrestigioDiferenciaMaxima', 50, 1, 99));
const FAN_RIVAL_WIN_BONUS_MAX = configNumber('estadio.hinchasPrestigioBonusVictoriaMaximo', 0.20, 0, 1);
const FAN_RIVAL_WIN_LOWER_PENALTY_MAX = configNumber('estadio.hinchasPrestigioPenalVictoriaInferiorMaximo', 0.15, 0, 1);
const FAN_RIVAL_LOSS_SHIELD_MAX = configNumber('estadio.hinchasPrestigioProteccionDerrotaMaxima', 0.20, 0, 1);
const FAN_RIVAL_LOSS_LOWER_PENALTY_MAX = configNumber('estadio.hinchasPrestigioPenalDerrotaInferiorMaxima', 0.15, 0, 1);
const RIVAL_PRESTIGE_ATTENDANCE_MAX_RATE = configNumber('estadio.bonusAsistenciaPrestigioRivalMaximo', 0.35, 0, 2);
const RIVAL_PRESTIGE_ATTENDANCE_START = Math.round(configNumber('estadio.bonusAsistenciaPrestigioRivalDesde', 20, 0, 99));
const RIVAL_PRESTIGE_AWAY_DEMAND_SHARE = configNumber('estadio.bonusAsistenciaPrestigioRivalVisitante', 0.50, 0, 1);
const STADIUM_MEMBER_CAMPAIGNS = (Array.isArray(configValue('estadio.campaniasSocios', [])) ? configValue('estadio.campaniasSocios', []) : []).map((item, index) => {
  const cost = Math.max(0, Math.round(Number(item?.inversion ?? item?.cost ?? 0)));
  const durationDays = Math.max(1, Math.round(Number(item?.diasDuracion ?? item?.durationDays ?? 1)));
  const minDaily = Math.max(0, Math.round(Number(item?.sociosDiaMin ?? item?.dailyMembersMin ?? 0)));
  const maxDaily = Math.max(minDaily, Math.round(Number(item?.sociosDiaMax ?? item?.dailyMembersMax ?? minDaily)));
  return {
    id:String(item?.id || `member_campaign_${index + 1}`),
    name:String(item?.nombre || item?.name || 'Campaña de Marketing'),
    cost,
    durationDays,
    dailyMembersMin:minDaily,
    dailyMembersMax:maxDaily
  };
}).filter(item => item.id && item.cost > 0 && item.durationDays > 0);
const MARKET_FREE_AGENT_COUNT = Math.min(300, configNumber('plantel.agentesLibresIniciales', 300, 0));
const MARKET_FREE_AGENT_HARD_MAX = Math.max(0, Math.min(300, Math.round(configNumber('plantel.agentesLibresMaximosTotales', 300, 0))));
const MARKET_FREE_AGENT_MEDIA_MIN = configNumber('plantel.agentesLibresMediaMin', 35, 1, 99);
const MARKET_FREE_AGENT_MEDIA_MAX = Math.max(MARKET_FREE_AGENT_MEDIA_MIN, configNumber('plantel.agentesLibresMediaMax', 57, 1, 99));
const MARKET_FREE_AGENT_AGE_MIN = configNumber('plantel.agentesLibresEdadMin', 19, 15, 45);
const MARKET_FREE_AGENT_AGE_MAX = Math.max(MARKET_FREE_AGENT_AGE_MIN, configNumber('plantel.agentesLibresEdadMax', 30, 15, 55));
const PLAYER_AGE_DECAY_ENABLED = configBoolean('plantel.deterioroEdadActivo', true);
const PLAYER_AGE_DECAY_START_AGE = Math.max(1, Math.round(configNumber('plantel.edadInicioDeterioro', 32, 1, 80)));
const PLAYER_AGE_DECAY_MIN_ANNUAL = Math.max(0, Math.round(configNumber('plantel.deterioroEdadMinAnual', 1, 0, 20)));
const PLAYER_AGE_DECAY_MAX_ANNUAL = Math.max(PLAYER_AGE_DECAY_MIN_ANNUAL, Math.round(configNumber('plantel.deterioroEdadMaxAnual', 4, 0, 20)));
const PLAYER_AGE_DECAY_CAP = 98;
const MARKET_FREE_AGENT_POSITION_GROUPS = [
  { id:'POR', probability:configNumber('plantel.agentesLibresPosiciones.POR', 0.10, 0), positions:['POR'] },
  { id:'DEF', probability:configNumber('plantel.agentesLibresPosiciones.DEF', 0.35, 0), positions:['LD','LI','DFC'] },
  { id:'MID', probability:configNumber('plantel.agentesLibresPosiciones.MED', 0.35, 0), positions:['MCD','MC','MC','MCO','MI','MD'] },
  { id:'ATT', probability:configNumber('plantel.agentesLibresPosiciones.DEL', 0.20, 0), positions:['ED','EI','DC'] }
];
const SEASON_FREE_AGENT_MARKET_MAX = Math.min(MARKET_FREE_AGENT_HARD_MAX, configNumber('plantel.agentesLibresMaximosPorTemporada', 300, 0));
const SEASON_FREE_AGENT_TOP_UP_ENABLED = configBoolean('plantel.rellenarLibresHastaMaximoPorTemporada', true);
const SEASON_FREE_AGENT_CLEANUP_ENABLED = configBoolean('plantel.limpiarLibresViejosAlCambiarTemporada', true);
const SEASON_YOUTH_FREE_AGENTS_PER_CLUB = configNumber('plantel.jovenesLibresNuevosPorEquipoTemporada', 0, 0);
const SEASON_YOUTH_FREE_AGENT_AGE_MIN = configNumber('plantel.jovenesLibresEdadMin', 17, 15, 30);
const SEASON_YOUTH_FREE_AGENT_AGE_MAX = Math.max(SEASON_YOUTH_FREE_AGENT_AGE_MIN, configNumber('plantel.jovenesLibresEdadMax', 18, 15, 35));
const SEASON_YOUTH_FREE_AGENT_COUNT = configNumber('plantel.jovenesLibresPorTemporada', 0, 0);
const RETIREMENT_PROBABILITY_BY_AGE_RAW = configValue('plantel.retiroProbabilidadPorEdad', {
  32:0.05, 33:0.10, 34:0.18, 35:0.30, 36:0.45, 37:0.60,
  38:0.75, 39:0.86, 40:0.94, 41:0.98, 42:1
});
const RETIREMENT_PROBABILITY_BY_AGE = Object.fromEntries(
  Object.entries(RETIREMENT_PROBABILITY_BY_AGE_RAW && typeof RETIREMENT_PROBABILITY_BY_AGE_RAW === 'object' ? RETIREMENT_PROBABILITY_BY_AGE_RAW : {})
    .map(([age, probability]) => [Math.round(Number(age)), Math.max(0, Math.min(1, Number(probability || 0)))])
    .filter(([age]) => Number.isFinite(age) && age > 0)
);
const RETIREMENT_AGES = Object.keys(RETIREMENT_PROBABILITY_BY_AGE).map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
const RETIREMENT_MIN_AGE = RETIREMENT_AGES[0] || 32;
const RETIREMENT_MAX_AGE = RETIREMENT_AGES[RETIREMENT_AGES.length - 1] || 42;
const SEASON_SALARY_BASE_REDUCTION = configNumber('economia.reduccionBaseSueldoFinTemporada', 0.05, 0, 1);
const SEASON_SALARY_MATCH_BONUS = configNumber('economia.bonusSueldoPorPartidoJugado', 0.01, 0);
const OWN_PLAYER_OFFER_COOLDOWN_TURNS = 3;
const SEASON_END_TRANSFER_OFFERS_MIN = 2;
const SEASON_END_TRANSFER_OFFERS_MAX = 6;
const TRANSFER_AFA_TAX_RATE = configNumber('mercado.impuestoAfaTraspasos', 0.30, 0, 0.95);
const TRANSFER_TAX_FEDERATIONS = configValue('mercado.federacionesTraspaso', { Argentina:'AFA', Chile:'ANFP', Brasil:'CBF', Inglaterra:'FA', España:'RFEF', Italia:'FIGC', Rumania:'FRF' });
const PLAYER_OFFER_MIN_CLAUSE_RATE = configNumber('mercado.ofertaJugadoresMinPorcentajeClausula', 0.10, 0, 1);
const PLAYER_OFFER_MAX_CLAUSE_RATE = Math.max(PLAYER_OFFER_MIN_CLAUSE_RATE, configNumber('mercado.ofertaJugadoresMaxPorcentajeClausula', 0.30, 0, 1));
const PLAYER_OFFERS_REQUIRE_MATCHES = configBoolean('mercado.ofertasJugadoresRequierenPartidos', true);
const PLAYER_OFFERS_REQUIRE_GOAL_OR_ASSIST = configBoolean('mercado.ofertasJugadoresRequierenGolOAsistencia', true);
const OWN_PLAYER_OFFER_MIN_MATCHES = Math.max(0, Math.round(configNumber('mercado.partidosNecesariosParaOfrecerJugador', 6, 0, 100)));
const PLAYER_OFFER_MATCHES_FOR_MAX_BONUS = Math.max(1, Math.round(configNumber('mercado.valorOfertaJugador.partidosParaBonoMaximo', 24, 1, 100)));
const PLAYER_OFFER_MATCH_BONUS_MAX = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoMaximoPartidos', 8, 0, 100));
const PLAYER_OFFER_GOAL_BONUS = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoPorGol', 1.5, 0, 20));
const PLAYER_OFFER_GOAL_BONUS_MAX = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoMaximoGoles', 12, 0, 100));
const PLAYER_OFFER_ASSIST_BONUS = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoPorAsistencia', 1.25, 0, 20));
const PLAYER_OFFER_ASSIST_BONUS_MAX = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoMaximoAsistencias', 10, 0, 100));
const PLAYER_OFFER_PERFORMANCE_BONUS_MAX = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoMaximoRendimiento', 8, 0, 100));
const PLAYER_OFFER_SCOUTING_BONUS_MAX = Math.max(0, configNumber('mercado.valorOfertaJugador.bonoMaximoOjeo', 5, 0, 100));
const SPECIAL_CLAUSE_OFFER_ENABLED = configBoolean('mercado.ofertaClausulaEspecialActiva', true);
const SPECIAL_CLAUSE_OFFER_LAST_MATCHDAYS = Math.max(1, Math.round(configNumber('mercado.ofertaClausulaEspecialFechasFinales', 10, 1, 38)));
const SPECIAL_CLAUSE_OFFER_MIN_PER_SEASON = Math.max(0, Math.round(configNumber('mercado.ofertaClausulaEspecialMinPorTemporada', 1, 0, 10)));
const SPECIAL_CLAUSE_OFFER_MAX_PER_SEASON = Math.max(SPECIAL_CLAUSE_OFFER_MIN_PER_SEASON, Math.round(configNumber('mercado.ofertaClausulaEspecialMaxPorTemporada', 2, 0, 10)));
const SPECIAL_CLAUSE_OFFER_TOP_PLAYERS = Math.max(1, Math.round(configNumber('mercado.ofertaClausulaEspecialTopJugadores', 3, 1, 10)));
const TRANSFER_MARKET_MAIN_START_DAY = Math.max(1, Math.round(configNumber('mercado.ventanaPrincipalInicioDia', 355, 1, 366)));
const TRANSFER_MARKET_MAIN_END_DAY = Math.max(1, Math.round(configNumber('mercado.ventanaPrincipalFinDia', 30, 1, 366)));
const TRANSFER_MARKET_MID_START_DAY = Math.max(1, Math.round(configNumber('mercado.ventanaMitadInicioDia', 151, 1, 366)));
const TRANSFER_MARKET_MID_END_DAY = Math.max(TRANSFER_MARKET_MID_START_DAY, Math.round(configNumber('mercado.ventanaMitadFinDia', 178, 1, 366)));
const SPECIAL_CLAUSE_RESPONSE_DAYS = Math.max(1, Math.round(configNumber('mercado.ofertaClausulaRespuestaDias', 5, 1, 30)));
const STAR_PLAYER_DIRECTIVE_MIN_OFFER_PCT = configNumber('mercado.ofertaMinimaEstrellaParaVentaPct', 60, 0, 100);
const BOT_TRANSFER_OFFER_BASE_CHANCE = configNumber('mercado.probabilidadOfertaBotBase', 0.28, 0, 1);
const BOT_TRANSFER_LISTED_EXTRA_CHANCE = configNumber('mercado.probabilidadExtraTransferible', 0.22, 0, 1);
const BOT_DISMISS_CHECK_CHANCE = configNumber('mercado.probabilidadBotsDespidosPorFecha', 0.38, 0, 1);
const SPONSOR_SEASON_OFFERS_MIN = Math.max(0, Math.round(configNumber('sponsors.ofertasMinimasPorTemporada', 20, 0)));
const SPONSOR_SEASON_OFFERS_MAX = Math.max(SPONSOR_SEASON_OFFERS_MIN, Math.round(configNumber('sponsors.ofertasMaximasPorTemporada', 40, 0)));
const SPONSOR_OFFER_EXPIRE_DAYS = Math.max(1, Math.round(configNumber('sponsors.ofertasVencenEnDias', 5, 1)));
const SPONSOR_OFFERS_PER_ARRIVAL_MIN = Math.max(1, Math.round(configNumber('sponsors.ofertasPorLlegadaMin', 1, 1)));
const SPONSOR_OFFERS_PER_ARRIVAL_MAX = Math.max(SPONSOR_OFFERS_PER_ARRIVAL_MIN, Math.round(configNumber('sponsors.ofertasPorLlegadaMax', 3, 1)));
const SPONSOR_TRIPLE_ARRIVAL_CHANCE = configNumber('sponsors.probabilidadLlegadaTriple', 0.45, 0, 1);
const SPONSOR_DURATION_MIN_DAYS = Math.max(1, Math.round(configNumber('sponsors.duracionOfertaMinDias', 30, 1)));
const SPONSOR_DURATION_MAX_DAYS = Math.max(SPONSOR_DURATION_MIN_DAYS, Math.round(configNumber('sponsors.duracionOfertaMaxDias', 700, 1)));
const SPONSOR_BASE_VALUE_FACTOR = configNumber('sponsors.factorValorBase', 0.1, 0);
const SPONSOR_LOCAL_OFFER_RATIO = configNumber('sponsors.porcentajeSponsorsLocales', 0.50, 0, 1);
const SPONSOR_LEAGUE_REPUTATION_MULTIPLIER_MIN = configNumber('sponsors.multiplicadorPrestigioLigaMinimo', 0.70, 0.1, 3);
const SPONSOR_LEAGUE_REPUTATION_MULTIPLIER_MAX = Math.max(SPONSOR_LEAGUE_REPUTATION_MULTIPLIER_MIN, configNumber('sponsors.multiplicadorPrestigioLigaMaximo', 1.30, 0.1, 3));
const SPONSOR_TABLE_POSITION_MULTIPLIER_MIN = configNumber('sponsors.multiplicadorPosicionTablaMinimo', 0.80, 0.1, 3);
const SPONSOR_TABLE_POSITION_MULTIPLIER_MAX = Math.max(SPONSOR_TABLE_POSITION_MULTIPLIER_MIN, configNumber('sponsors.multiplicadorPosicionTablaMaximo', 1.20, 0.1, 3));
const SPONSOR_SPECIAL_ENABLED = Boolean(window.GAME_CONFIG?.sponsors?.sponsorEspecialActivo ?? true);
const SPONSOR_SPECIAL_CHANCE = configNumber('sponsors.probabilidadSponsorEspecial', 0.22, 0, 1);
const SPONSOR_SPECIAL_BONUS_MULTIPLIER = configNumber('sponsors.multiplicadorBonoEspecial', 3, 0);
const SPONSOR_SPECIAL_CONDITIONS = Array.isArray(window.GAME_CONFIG?.sponsors?.condicionesEspeciales) ? window.GAME_CONFIG.sponsors.condicionesEspeciales : [];
const ACADEMY_SCOUTING_COST = configNumber('academia.costoCaptacion', 1000000, 0);
const ACADEMY_SCOUTING_TURNS = Math.ceil(configNumber('academia.diasCaptacion', 35, 1) / DAYS_PER_ADVANCE);
const ACADEMY_PLAYERS_MIN = configNumber('academia.jugadoresMinimosPorCaptacion', 5, 1);
const ACADEMY_PLAYERS_MAX = Math.max(ACADEMY_PLAYERS_MIN, configNumber('academia.jugadoresMaximosPorCaptacion', 10, 1));
const ACADEMY_PLAYER_TURN_COST = configNumber('academia.costoJugadorPorAvance', 10000, 0);
const ACADEMY_PLAYER_WEEKLY_CHARGE_DAY = Math.max(0, Math.min(6, Math.round(configNumber('academia.diaCobroSemanalJuveniles', 1, 0, 6))));
const ACADEMY_DISMISS_COMPENSATION = configNumber('academia.compensacionDespido', 50000, 0);
const YOUTH_PREPARER_COST = configNumber('empleados.preparadorJuvenilesCosto', 1000000, 0);
const ASSISTANT_COACH_ANNUAL_COSTS = Object.freeze({
  regular:Math.round(configNumber('empleados.segundoEntrenador.costosAnuales.regular', 2000000, 0)),
  bueno:Math.round(configNumber('empleados.segundoEntrenador.costosAnuales.bueno', 7000000, 0)),
  elite:Math.round(configNumber('empleados.segundoEntrenador.costosAnuales.elite', 23000000, 0))
});
const ASSISTANT_COACH_ANALYSIS_DAYS = Object.freeze({
  regular:Math.round(configNumber('empleados.segundoEntrenador.diasAnalisis.regular', 25, 1, 365)),
  bueno:Math.round(configNumber('empleados.segundoEntrenador.diasAnalisis.bueno', 18, 1, 365)),
  elite:Math.round(configNumber('empleados.segundoEntrenador.diasAnalisis.elite', 10, 1, 365))
});
const ACADEMY_SKILL_GAIN_MULTIPLIER = configNumber('academia.multiplicadorEntrenamiento', 5, 1);
const ACADEMY_EXCEPTIONAL_YOUTH_TRAINING_MULTIPLIER = configNumber('academia.multiplicadorEntrenamientoJuvenilExcepcional', 5, 1, 100);
const ACADEMY_EXCEPTIONAL_YOUTH_ENABLED = configBoolean('academia.juvenilExcepcionalPorTemporada', true);
const ACADEMY_EXCEPTIONAL_YOUTH_AGE = Math.round(configNumber('academia.edadJuvenilExcepcional', 16, 12, 17));
const ACADEMY_YOUTH_MIN_AGE = Math.round(configNumber('academia.edadJuvenilMin', 12, 8, 17));
const ACADEMY_YOUTH_MAX_CREATION_AGE = Math.max(ACADEMY_YOUTH_MIN_AGE, Math.round(configNumber('academia.edadJuvenilMax', 16, ACADEMY_YOUTH_MIN_AGE, 17)));
const ACADEMY_YOUTH_FINAL_ACADEMY_AGE = Math.max(ACADEMY_YOUTH_MAX_CREATION_AGE, Math.round(configNumber('academia.edadUltimaTemporadaAcademia', 17, ACADEMY_YOUTH_MAX_CREATION_AGE, 20)));
const ACADEMY_YOUTH_CREATION_MAX_BASE = Math.round(configNumber('academia.mediaMaximaCreacionBase', 30, 1, 99));
const ACADEMY_YOUTH_CREATION_AGE_BONUS = Math.round(configNumber('academia.mediaMaximaCreacionBonusEdad', 3, 0, 20));
const ACADEMY_YOUTH_SEASON_GROWTH_MIN = Math.round(configNumber('academia.crecimientoTemporadaMin', 7, 0, 99));
const ACADEMY_YOUTH_SEASON_GROWTH_MAX = Math.max(ACADEMY_YOUTH_SEASON_GROWTH_MIN, Math.round(configNumber('academia.crecimientoTemporadaMax', 11, 0, 99)));
const ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MIN = Math.round(configNumber('academia.crecimientoExcepcionalTemporadaMin', 15, 0, 99));
const ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MAX = Math.max(ACADEMY_EXCEPTIONAL_SEASON_GROWTH_MIN, Math.round(configNumber('academia.crecimientoExcepcionalTemporadaMax', 20, 0, 99)));
const ACADEMY_EXCEPTIONAL_YOUTH_MIN_OVERALL = Math.round(configNumber('academia.mediaJuvenilExcepcionalMin', 12, 1, 40));
const ACADEMY_EXCEPTIONAL_YOUTH_MAX_OVERALL = Math.max(ACADEMY_EXCEPTIONAL_YOUTH_MIN_OVERALL, Math.round(configNumber('academia.mediaJuvenilExcepcionalMax', 40, 1, 40)));
const ACADEMY_BASE_CAPACITY = Math.max(0, Math.round(configNumber('academia.cupoBaseJuveniles', 10, 0, 500)));
const ACADEMY_RESIDENCE_CAPACITY = Math.max(0, Math.round(configNumber('academia.residenciaCuposJuveniles', 20, 0, 500)));
const ACADEMY_RESIDENCE_MONTHLY_COST = Math.max(0, Math.round(configNumber('academia.residenciaCostoMensual', 560000, 0)));
const ACADEMY_RESIDENCE_MONTH_DAYS = 30;
const ACADEMY_CONSULT_REVEAL_MULTIPLIER = Math.max(1, Math.round(configNumber('academia.multiplicadorConsultaJuveniles', 1, 1, 20))); 
const ACADEMY_YOUTH_INJURIES_MIN_PER_SEASON = Math.max(0, Math.round(configNumber('academia.lesionesJuvenilesMinPorTemporada', 1, 0, 10)));
const ACADEMY_YOUTH_INJURIES_MAX_PER_SEASON = Math.max(ACADEMY_YOUTH_INJURIES_MIN_PER_SEASON, Math.round(configNumber('academia.lesionesJuvenilesMaxPorTemporada', 2, 0, 10)));
const ACADEMY_YOUTH_INJURY_MIN_TURNS = Math.max(1, Math.ceil(configNumber('academia.lesionJuvenilDiasMin', 14, 1) / DAYS_PER_ADVANCE));
const ACADEMY_YOUTH_INJURY_MAX_TURNS = Math.max(ACADEMY_YOUTH_INJURY_MIN_TURNS, Math.ceil(configNumber('academia.lesionJuvenilDiasMax', 42, 1) / DAYS_PER_ADVANCE));
const ACADEMY_YOUTH_MARKET_ENABLED = configBoolean('academia.mercadoJuvenil.activo', true);
const ACADEMY_YOUTH_OFFER_AGE = Math.round(configNumber('academia.mercadoJuvenil.edadOfertas', 17, 16, 20));
const ACADEMY_YOUTH_SALE_TAX_RATE = configNumber('academia.mercadoJuvenil.impuestoFederacion', 0.05, 0, 0.95);
const ACADEMY_YOUTH_OFFER_MIN_VALUE = Math.max(0, Math.round(configNumber('academia.mercadoJuvenil.valorMinimo', 20000, 0)));
const ACADEMY_YOUTH_OFFER_MAX_VALUE = Math.max(ACADEMY_YOUTH_OFFER_MIN_VALUE, Math.round(configNumber('academia.mercadoJuvenil.valorMaximo', 5000000, ACADEMY_YOUTH_OFFER_MIN_VALUE)));
const ACADEMY_YOUTH_OFFER_EXPIRE_DAYS = Math.max(1, Math.round(configNumber('academia.mercadoJuvenil.diasVencimientoOferta', 5, 1)));
const ACADEMY_YOUTH_OFFER_ATTEMPT_DAYS = Math.max(1, Math.round(configNumber('academia.mercadoJuvenil.diasEntreIntentos', 14, 1)));
const ACADEMY_YOUTH_OFFER_ATTEMPT_CHANCE = configNumber('academia.mercadoJuvenil.probabilidadPorIntento', 0.45, 0, 1);
const ACADEMY_YOUTH_OFFER_REJECTION_COOLDOWN_DAYS = Math.max(1, Math.round(configNumber('academia.mercadoJuvenil.diasEsperaTrasRechazo', 30, 1)));
const ACADEMY_YOUTH_MAX_PENDING_OFFERS = Math.max(1, Math.round(configNumber('academia.mercadoJuvenil.maxOfertasPendientes', 4, 1, 20)));
const ACADEMY_YOUTH_MAX_OFFERS_PER_PLAYER_SEASON = Math.max(1, Math.round(configNumber('academia.mercadoJuvenil.maxOfertasPorJugadorTemporada', 4, 1, 20)));
const ACADEMY_YOUTH_BOT_TARGET_ROSTER_RAW = Math.max(1, Math.round(configNumber('academia.mercadoJuvenil.plantelObjetivoBot', 24, 1, 100)));

const MIN_PLAYERS_PER_CLUB = configNumber('plantel.jugadoresMinimosPorClub', 18, 1);
const MIN_EXISTING_PLAYERS_PER_CLUB = Math.max(MIN_PLAYERS_PER_CLUB, configNumber('plantel.jugadoresMinimosExistentesPorEquipo', 20, 1));
const INITIAL_PLAYERS_PER_CLUB = Math.max(MIN_EXISTING_PLAYERS_PER_CLUB, configNumber('plantel.jugadoresInicialesPorClub', 25, 1));
const MAX_PLAYERS_PER_CLUB = Math.max(INITIAL_PLAYERS_PER_CLUB, configNumber('plantel.jugadoresMaximosPorClub', 42, 1));
const ACADEMY_YOUTH_BOT_TARGET_ROSTER = Math.min(MAX_PLAYERS_PER_CLUB, Math.max(MIN_PLAYERS_PER_CLUB, ACADEMY_YOUTH_BOT_TARGET_ROSTER_RAW));
const CLUB_ROSTER_SIZE = INITIAL_PLAYERS_PER_CLUB;
const BOT_ROSTER_REPAIR_ENABLED = configBoolean('plantel.reparacionAutomaticaBots', true);
const BOT_MIN_GOALKEEPERS = configNumber('plantel.botsMinimoPorteros', 2, 1);
const BOT_MIN_DEFENDERS = configNumber('plantel.botsMinimoDefensores', 5, 0);
const BOT_MIN_MIDFIELDERS = configNumber('plantel.botsMinimoMediocampistas', 5, 0);
const BOT_MIN_ATTACKERS = configNumber('plantel.botsMinimoDelanteros', 3, 0);
const BOT_EMERGENCY_MEDIA_MIN = configNumber('plantel.botsMediaEmergenciaMin', 25, 1, 99);
const BOT_EMERGENCY_MEDIA_MAX = Math.max(BOT_EMERGENCY_MEDIA_MIN, configNumber('plantel.botsMediaEmergenciaMax', 47, 1, 99));
const BOT_EMERGENCY_SALARY_FACTOR = configNumber('plantel.botsFactorSueldoEmergencia', 0.35, 0);

const MATCH_REVEAL_PHASES = Math.max(6, Math.min(90, configNumber('ui.fasesSimulacionPartido', 90, 6))); 
const MATCH_REVEAL_MIN_PHASE_MS = Math.max(500, configNumber('ui.duracionMinimaFaseSimulacionMs', 3000, 500));
const MATCH_REVEAL_DURATION_MS = Math.max(6000, configNumber('ui.duracionSimulacionPartidoMs', 270000, 1000), MATCH_REVEAL_PHASES * MATCH_REVEAL_MIN_PHASE_MS);
const MATCH_COMMENTARY_HOLD_PHASES = Math.max(1, Math.min(6, Math.round(configNumber('ui.relatoMantenerFases', 1, 1))));
const STADIUM_EXPANSIONS = [
  { id:1, minCapacity:0, name:'Grada tubular norte inicial', capacityGain:500, targetCapacity:500, cost:2000000, days:1, slot:'Norte' },
  { id:2, minCapacity:0, name:'Grada tubular sur inicial', capacityGain:500, targetCapacity:1000, cost:2000000, days:1, slot:'Sur' },
  { id:3, minCapacity:0, name:'Grada lateral este básica', capacityGain:500, targetCapacity:1500, cost:2800000, days:2, slot:'Este' },
  { id:4, minCapacity:0, name:'Grada lateral oeste básica', capacityGain:500, targetCapacity:2000, cost:2800000, days:2, slot:'Oeste' },
  { id:5, minCapacity:2000, name:'Popular norte con accesos simples', capacityGain:1000, targetCapacity:3000, cost:7500000, days:3, slot:'Norte' },
  { id:6, minCapacity:2000, name:'Popular sur con accesos simples', capacityGain:1000, targetCapacity:4000, cost:7500000, days:3, slot:'Sur' },
  { id:7, minCapacity:2000, name:'Laterales metálicas reforzadas', capacityGain:1000, targetCapacity:5000, cost:9500000, days:4, slot:'Este/Oeste' },
  { id:8, minCapacity:5000, name:'Tribuna este de hormigón inicial', capacityGain:1250, targetCapacity:6250, cost:16000000, days:5, slot:'Este' },
  { id:9, minCapacity:5000, name:'Tribuna oeste de hormigón inicial', capacityGain:1250, targetCapacity:7500, cost:16000000, days:5, slot:'Oeste' },
  { id:10, minCapacity:5000, name:'Cabecera norte ampliada', capacityGain:1250, targetCapacity:8750, cost:14000000, days:4, slot:'Norte' },
  { id:11, minCapacity:5000, name:'Cabecera sur ampliada', capacityGain:1250, targetCapacity:10000, cost:14000000, days:4, slot:'Sur' },
  { id:12, minCapacity:10000, name:'Anillo bajo norte', capacityGain:2000, targetCapacity:12000, cost:42000000, days:7, slot:'Norte' },
  { id:13, minCapacity:10000, name:'Anillo bajo sur', capacityGain:2000, targetCapacity:14000, cost:42000000, days:7, slot:'Sur' },
  { id:14, minCapacity:10000, name:'Platea baja este', capacityGain:2000, targetCapacity:16000, cost:50000000, days:8, slot:'Este' },
  { id:15, minCapacity:10000, name:'Platea baja oeste', capacityGain:2000, targetCapacity:18000, cost:50000000, days:8, slot:'Oeste' },
  { id:16, minCapacity:10000, name:'Cierre de esquinas bajas', capacityGain:2000, targetCapacity:20000, cost:46000000, days:8, slot:'Esquinas' },
  { id:17, minCapacity:20000, name:'Segunda bandeja norte', capacityGain:2500, targetCapacity:22500, cost:95000000, days:10, slot:'Norte' },
  { id:18, minCapacity:20000, name:'Segunda bandeja sur', capacityGain:2500, targetCapacity:25000, cost:95000000, days:10, slot:'Sur' },
  { id:19, minCapacity:20000, name:'Platea media este', capacityGain:2500, targetCapacity:27500, cost:110000000, days:11, slot:'Este' },
  { id:20, minCapacity:20000, name:'Platea media oeste', capacityGain:2500, targetCapacity:30000, cost:110000000, days:11, slot:'Oeste' },
  { id:21, minCapacity:20000, name:'Vomitorios y accesos perimetrales', capacityGain:2500, targetCapacity:32500, cost:120000000, days:12, slot:'Accesos' },
  { id:22, minCapacity:30000, name:'Anillo medio norte', capacityGain:2500, targetCapacity:35000, cost:135000000, days:12, slot:'Norte' },
  { id:23, minCapacity:30000, name:'Anillo medio sur', capacityGain:2500, targetCapacity:37500, cost:135000000, days:12, slot:'Sur' },
  { id:24, minCapacity:30000, name:'Anillo medio este', capacityGain:2500, targetCapacity:40000, cost:150000000, days:13, slot:'Este' },
  { id:25, minCapacity:30000, name:'Anillo medio oeste', capacityGain:2500, targetCapacity:42500, cost:150000000, days:13, slot:'Oeste' },
  { id:26, minCapacity:30000, name:'Cierre completo de esquinas medias', capacityGain:2500, targetCapacity:45000, cost:165000000, days:14, slot:'Esquinas' },
  { id:27, minCapacity:45000, name:'Tercer nivel norte', capacityGain:3000, targetCapacity:48000, cost:220000000, days:16, slot:'Norte' },
  { id:28, minCapacity:45000, name:'Tercer nivel sur', capacityGain:3000, targetCapacity:51000, cost:220000000, days:16, slot:'Sur' },
  { id:29, minCapacity:45000, name:'Tercer nivel este', capacityGain:3000, targetCapacity:54000, cost:250000000, days:18, slot:'Este' },
  { id:30, minCapacity:45000, name:'Tercer nivel oeste', capacityGain:3000, targetCapacity:57000, cost:250000000, days:18, slot:'Oeste' },
  { id:31, minCapacity:45000, name:'Nuevo anillo de circulación', capacityGain:3000, targetCapacity:60000, cost:280000000, days:20, slot:'Accesos' },
  { id:32, minCapacity:60000, name:'Bandeja alta norte', capacityGain:3000, targetCapacity:63000, cost:320000000, days:20, slot:'Norte' },
  { id:33, minCapacity:60000, name:'Bandeja alta sur', capacityGain:3000, targetCapacity:66000, cost:320000000, days:20, slot:'Sur' },
  { id:34, minCapacity:60000, name:'Bandeja alta este', capacityGain:3000, targetCapacity:69000, cost:360000000, days:22, slot:'Este' },
  { id:35, minCapacity:60000, name:'Bandeja alta oeste', capacityGain:3000, targetCapacity:72000, cost:360000000, days:22, slot:'Oeste' },
  { id:36, minCapacity:60000, name:'Refuerzo estructural del bowl', capacityGain:3000, targetCapacity:75000, cost:420000000, days:24, slot:'Estructura' },
  { id:37, minCapacity:75000, name:'Cuarto anillo norte', capacityGain:2500, targetCapacity:77500, cost:420000000, days:24, slot:'Norte' },
  { id:38, minCapacity:75000, name:'Cuarto anillo sur', capacityGain:2500, targetCapacity:80000, cost:420000000, days:24, slot:'Sur' },
  { id:39, minCapacity:75000, name:'Cuarto anillo este', capacityGain:2500, targetCapacity:82500, cost:480000000, days:26, slot:'Este' },
  { id:40, minCapacity:75000, name:'Cuarto anillo oeste', capacityGain:2500, targetCapacity:85000, cost:480000000, days:26, slot:'Oeste' },
  { id:41, minCapacity:75000, name:'Conectores altos y evacuación', capacityGain:2500, targetCapacity:87500, cost:550000000, days:28, slot:'Accesos' },
  { id:42, minCapacity:85000, name:'Anillo superior norte', capacityGain:2500, targetCapacity:90000, cost:550000000, days:28, slot:'Norte' },
  { id:43, minCapacity:85000, name:'Anillo superior sur', capacityGain:2500, targetCapacity:92500, cost:550000000, days:28, slot:'Sur' },
  { id:44, minCapacity:85000, name:'Anillo superior este', capacityGain:2500, targetCapacity:95000, cost:620000000, days:30, slot:'Este' },
  { id:45, minCapacity:85000, name:'Anillo superior oeste', capacityGain:2500, targetCapacity:97500, cost:620000000, days:30, slot:'Oeste' },
  { id:46, minCapacity:85000, name:'Macro accesos y explanada externa', capacityGain:2500, targetCapacity:100000, cost:700000000, days:32, slot:'Accesos' },
  { id:47, minCapacity:100000, name:'Bowl monumental norte', capacityGain:2000, targetCapacity:102000, cost:800000000, days:34, slot:'Norte' },
  { id:48, minCapacity:100000, name:'Bowl monumental sur', capacityGain:2000, targetCapacity:104000, cost:800000000, days:34, slot:'Sur' },
  { id:49, minCapacity:100000, name:'Bowl monumental este', capacityGain:2000, targetCapacity:106000, cost:920000000, days:36, slot:'Este' },
  { id:50, minCapacity:100000, name:'Bowl monumental oeste', capacityGain:2000, targetCapacity:108000, cost:920000000, days:36, slot:'Oeste' },
  { id:51, minCapacity:100000, name:'Evacuación masiva y servicios críticos', capacityGain:2000, targetCapacity:110000, cost:1050000000, days:38, slot:'Servicios' },
  { id:52, minCapacity:110000, name:'Última bandeja norte', capacityGain:1500, targetCapacity:111500, cost:950000000, days:38, slot:'Norte' },
  { id:53, minCapacity:110000, name:'Última bandeja sur', capacityGain:1500, targetCapacity:113000, cost:950000000, days:38, slot:'Sur' },
  { id:54, minCapacity:110000, name:'Palcos altos reconvertidos a butacas', capacityGain:1500, targetCapacity:114500, cost:1100000000, days:42, slot:'Premium' },
  { id:55, minCapacity:110000, name:'Reordenamiento total de accesos', capacityGain:1500, targetCapacity:116000, cost:1250000000, days:44, slot:'Accesos' },
  { id:56, minCapacity:116000, name:'Optimización de visuales altas', capacityGain:1000, targetCapacity:117000, cost:1150000000, days:44, slot:'Estructura' },
  { id:57, minCapacity:116000, name:'Microampliación de esquinas altas', capacityGain:1000, targetCapacity:118000, cost:1250000000, days:46, slot:'Esquinas' },
  { id:58, minCapacity:118000, name:'Reubicación técnica de prensa y cabinas', capacityGain:500, targetCapacity:118500, cost:950000000, days:40, slot:'Servicios' },
  { id:59, minCapacity:118000, name:'Butacas compactas homologadas', capacityGain:500, targetCapacity:119000, cost:1050000000, days:42, slot:'Interior' },
  { id:60, minCapacity:119000, name:'Última optimización de aforo', capacityGain:1000, targetCapacity:120000, cost:1900000000, days:50, slot:'Integral' }
];
const STADIUM_EXPANSION_MAX_CAPACITY = 120000;
const STADIUM_EXPANSION_DAYS_MULTIPLIER = Math.max(1, configNumber('estadio.multiplicadorDiasObras', 30, 1, 365));
const STADIUM_CAPACITY_SEASON_DECAY_PCT = configNumber('estadio.deterioroCapacidadPorTemporadaPct', 1, 0, 25);
const STADIUM_CAPACITY_REPAIR_COST_FACTOR = configNumber('estadio.reparacionCapacidadFactorCostoAmpliacion', 0.25, 0.01, 1);
const STADIUM_CAPACITY_REPAIR_MIN_COST = Math.max(0, Math.round(configNumber('estadio.reparacionCapacidadCostoMinimo', 1000000, 0)));
const STADIUM_CAPACITY_REPAIR_SEATS_PER_DAY = Math.max(1, Math.round(configNumber('estadio.reparacionCapacidadLugaresPorDia', 20, 1)));
const STADIUM_CAPACITY_REPAIR_MIN_DAYS = Math.max(1, Math.round(configNumber('estadio.reparacionCapacidadDiasMinimos', 14, 1, 365)));
const STADIUM_CAPACITY_REPAIR_MAX_DAYS = Math.max(STADIUM_CAPACITY_REPAIR_MIN_DAYS, Math.round(configNumber('estadio.reparacionCapacidadDiasMaximos', 180, STADIUM_CAPACITY_REPAIR_MIN_DAYS, 730)));
const STADIUM_CAPACITY_REPAIR_ATTENDANCE_PENALTY = configNumber('estadio.reparacionCapacidadPenalizacionAsistencia', 0.10, 0, 0.80);
const STADIUM_EXPANSION_ATTENDANCE_PENALTY_PER_PROJECT = configNumber('estadio.penalizacionAsistenciaPorObraActiva', 0.05, 0, 0.50);
const STADIUM_EXPANSION_ATTENDANCE_PENALTY_MAX = configNumber('estadio.penalizacionAsistenciaObrasMaxima', 0.20, 0, 0.80);
const SOUTH_AMERICAN_NATIONALITIES = Array.isArray(configValue('plantel.nacionalidades.sudamericaPaises', []))
  ? configValue('plantel.nacionalidades.sudamericaPaises', []).filter(Boolean).map(String)
  : ['Argentina','Brasil','Uruguay','Paraguay','Chile','Bolivia','Perú','Ecuador','Colombia','Venezuela'];
const WORLD_NATIONALITIES = Array.isArray(configValue('plantel.nacionalidades.restoDelMundoPaises', []))
  ? configValue('plantel.nacionalidades.restoDelMundoPaises', []).filter(Boolean).map(String)
  : ['España','Italia','Francia','Alemania','Portugal','Inglaterra','México','Estados Unidos','Japón','Corea del Sur','Marruecos','Nigeria','Ghana'];
const PLAYER_NATIONALITY_BY_COUNTRY = configValue('plantel.nacionalidades.porPais', {}) || {};
const PLAYER_GENERATION_NATIONALITY_GROUPS = [
  { id:'local', probability:configNumber('plantel.nacionalidades.local', 0.70, 0, 1), countries:[] },
  { id:'sudamerica', probability:configNumber('plantel.nacionalidades.sudamerica', 0.20, 0, 1), countries:SOUTH_AMERICAN_NATIONALITIES },
  { id:'resto_del_mundo', probability:configNumber('plantel.nacionalidades.restoDelMundo', 0.10, 0, 1), countries:WORLD_NATIONALITIES }
];
const PLAYER_GENERATION_POSITION_GROUPS = [
  { id:'POR', probability:0.10, positions:['POR'] },
  { id:'DEF', probability:0.30, positions:['LD','LI','DFC'] },
  { id:'MID', probability:0.30, positions:['MCD','MC','MC','MCO','MI','MD'] },
  { id:'ATT', probability:0.30, positions:['ED','EI','DC'] }
];
const PLAYER_GENERATION_MEDIA_RANGES = [
  { id:'elite_mundial', probability:0.005, media_min:88, media_max:95, salaryMultiplier:3000000 },
  { id:'estrella', probability:0.07, media_min:75, media_max:87, salaryMultiplier:1000000 },
  { id:'titular_competitivo', probability:0.245, media_min:62, media_max:74, salaryMultiplier:300000 },
  { id:'profesional_promedio_bajo', probability:0.50, media_min:38, media_max:61, salaryMultiplier:80000 },
  { id:'bajo_nivel', probability:0.18, media_min:15, media_max:37, salaryMultiplier:10000 }
];
const PLAYER_ECONOMY_SCALE = configNumber('economia.escalaSueldosYClausulas', 0.10, 0);
const PLAYER_CLAUSE_VALUE_SCALE = configNumber('economia.escalaClausulas', 0.10, 0);
const PLAYER_CLAUSE_BALANCE_TARGET_MULTIPLIER = configNumber('economia.clausulaMultiplicadorCentral', 16, 0);
const PLAYER_CLAUSE_EXTREME_COMPRESSION = configNumber('economia.clausulaCompresionExtremos', 0.50, 0, 1);
const PLAYER_ELITE_MAX_PER_CLUB = 3;
const PLAYER_CLAUSE_MIN_MULTIPLIER = 6;
const PLAYER_CLAUSE_AGE_REDUCTION = 10;
const PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER = { 1:500, 2:450, 3:300 };
const FREE_YOUTH_SALARY_FACTOR = 0.55;
const MARKET_FREE_AGENT_SALARY_FACTOR = 0.75;
const BANK_LOANS_ENABLED = configBoolean('economia.banco.activo', true);
const BANK_LOAN_BANKS = Array.isArray(configValue('economia.banco.bancos', [])) ? configValue('economia.banco.bancos', []).filter(item => item && item.nombre).map((item, index) => ({ id:index + 1, name:String(item.nombre), interest:configNumber(`economia.banco.bancos.${index}.interes`, Number(item.interes || 0.40), 0, 5) })) : [];
const BANK_LOAN_TIERS = Array.isArray(configValue('economia.banco.montos', [])) ? configValue('economia.banco.montos', []).filter(item => Number(item?.monto) > 0).map((item, index) => ({ id:index + 1, amount:Math.round(Number(item.monto || 0)), prestigeCost:Math.max(0, Math.round(Number(item.prestigio || 0))) })) : [];
const BANK_LOAN_TERMS = Array.isArray(configValue('economia.banco.plazosSemanas', [])) ? configValue('economia.banco.plazosSemanas', []).map(value => Math.max(1, Math.round(Number(value || 0)))).filter(Boolean) : [24,48,172];

const LEAGUE_RESULT_PAYMENTS_ENABLED = configBoolean('economia.pagosPorResultadoLiga.activo', true);
const LEAGUE_RESULT_REPUTATION_MIN = configNumber('economia.pagosPorResultadoLiga.reputacionMinima', 10, 1, 100);
const LEAGUE_RESULT_REPUTATION_MAX = Math.max(LEAGUE_RESULT_REPUTATION_MIN, configNumber('economia.pagosPorResultadoLiga.reputacionMaxima', 100, LEAGUE_RESULT_REPUTATION_MIN, 100));
const LEAGUE_RESULT_WIN_PER_REPUTATION = Math.max(0, configNumber('economia.pagosPorResultadoLiga.pagoVictoriaPorPuntoReputacion', 8000, 0));
const LEAGUE_RESULT_DRAW_PER_REPUTATION = Math.max(0, configNumber('economia.pagosPorResultadoLiga.pagoEmpatePorPuntoReputacion', 3000, 0));
const LEAGUE_RESULT_VARIATION_MIN = configNumber('economia.pagosPorResultadoLiga.variacionMinima', 0.75, 0, 10);
const LEAGUE_RESULT_VARIATION_MAX = Math.max(LEAGUE_RESULT_VARIATION_MIN, configNumber('economia.pagosPorResultadoLiga.variacionMaxima', 1.25, LEAGUE_RESULT_VARIATION_MIN, 10));
const LEAGUE_RESULT_PAYMENT_ROUNDING = Math.max(1, Math.round(configNumber('economia.pagosPorResultadoLiga.redondeo', 5000, 1)));
const LEAGUE_RESULT_LOSS_PAYMENT = Math.max(0, Math.round(configNumber('economia.pagosPorResultadoLiga.pagoDerrota', 0, 0)));

const MONTHLY_EXPENSES_ENABLED = configBoolean('economia.gastosMensuales.activo', true);
const MONTHLY_PROFIT_TAX_RATE = configNumber('economia.gastosMensuales.impuestoGananciasPct', 0.08, 0, 1);
const MONTHLY_ELECTRICITY_BASE_PER_MATCH = Math.max(0, Math.round(configNumber('economia.gastosMensuales.electricidadBasePorPartido', 100000, 0)));
const MONTHLY_ELECTRICITY_CAPACITY_FACTOR = Math.max(0, configNumber('economia.gastosMensuales.electricidadPorCapacidadPorPartido', 10, 0));
const MONTHLY_CLEANING_PER_FAN_PER_MATCH = Math.max(0, configNumber('economia.gastosMensuales.limpiezaPorHinchaPorPartido', 10, 0));

const SCOUTING_CENTER_ENABLED = configBoolean('centroOjeo.activo', true);
const SCOUTING_BASE_SCOUTS = Math.max(0, Math.round(configNumber('centroOjeo.cupoBaseOjeadores', 2, 0, 99)));
const SCOUTING_BASE_PLAYER_SLOTS = Math.max(0, Math.round(configNumber('centroOjeo.cupoBaseJugadores', 5, 0, 999)));
const SCOUTING_SCOUTS_PER_OFFICE = Math.max(0, Math.round(configNumber('centroOjeo.ojeadoresPorOficina', 3, 0, 99)));
const SCOUTING_PLAYERS_PER_OFFICE = Math.max(0, Math.round(configNumber('centroOjeo.jugadoresPorOficina', 10, 0, 999)));
const SCOUTING_SCOUT_DAILY_COST = Math.max(0, Math.round(configNumber('centroOjeo.costoOjeadorDiario', 200000, 0)));
const SCOUTING_PLAYER_SEARCH_DAILY_COST = Math.max(0, Math.round(configNumber('centroOjeo.costoBusquedaJugadorDiario', 50000, 0)));
const SCOUTING_OFFICE_MONTHLY_COST = Math.max(0, Math.round(configNumber('centroOjeo.costoOficinaMensual', 1000000, 0)));
const SCOUTING_CHIEF_TYPES = (() => {
  const src = configValue('centroOjeo.jefes', {}) || {};
  const fallback = {
    regular:{ nombre:'Regular', sueldoMensual:500000, maxOficinas:1, revelacionesMin:0, revelacionesMax:1 },
    bueno:{ nombre:'Bueno', sueldoMensual:12000000, maxOficinas:2, revelacionesMin:0, revelacionesMax:1 },
    elite:{ nombre:'Elite', sueldoMensual:180000000, maxOficinas:5, revelacionesMin:1, revelacionesMax:2 }
  };
  return Object.entries({ ...fallback, ...src }).map(([key, item]) => ({
    key:String(key),
    name:String(item?.nombre || key),
    monthlySalary:Math.max(0, Math.round(Number(item?.sueldoMensual ?? fallback[key]?.sueldoMensual ?? 0))),
    maxOffices:Math.max(0, Math.round(Number(item?.maxOficinas ?? fallback[key]?.maxOficinas ?? 0))),
    revealMin:Math.max(0, Math.round(Number(item?.revelacionesMin ?? fallback[key]?.revelacionesMin ?? 0))),
    revealMax:Math.max(0, Math.round(Number(item?.revelacionesMax ?? fallback[key]?.revelacionesMax ?? 0)))
  }));
})();

const TACTIC_SAVE_SLOT_COUNT = 3;
const TRAINING_SAVE_SLOT_COUNT = 3;

const DEFAULT_TACTIC = {
  formation:'4-4-2',
  layoutMode:'preset',
  customSlots:[],
  captainId:0,
  captainSelectionMode:'automatic',
  starters:[],
  bench:[],
  autoSubs:[],
  playerMentalities:{},
  matchInstructions:{winning:'normal',drawing:'normal',losing:'normal'},
  sectorStyles:{...DEFAULT_TACTIC_SECTOR_STYLES}
};

let seed = null;
let manualPlayersDatabase = null;
let sponsorsDatabase = null;
let employeesDatabase = null;
let installationsDatabase = null;
let eventsDatabase = null;
let specialSkillsDatabase = null;
let managerAchievementsDatabase = null;
let managerChallengesDatabase = null;
let stadiumsDatabase = null;
let fansDatabase = null;
let matchCommentaryDatabase = null;
let game = null;
let activeTab = 'home';
let squadSort = 'media_desc';
let trainingSort = 'media_desc';
let squadSkillSortKey = 'Resistencia';
let marketSubTab = 'free';
let marketFilters = { mediaMin:'', mediaMax:'', ageMin:'', ageMax:'', priceMax:'', position:'all' };
let marketVisibleLimit = 20;
let firstTeamTab = 'tactics';
let teamPlayerStatsSeasonSelection = 'current';
let teamPlayerStatsClubSelection = 'current';
let teamPlayerStatsSort = 'rating_desc';
let selectedFixtureDivision = 'all';
let fixtureViewMode = 'mine';
let selectedClubWorldCupYear = 'current';
let stadiumViewMode = 'main';
let financeViewMode = 'main';
let managerStatsViewMode = 'profile';
let sidebarOpenGroup = '';
let selectedStandingsDivision = 'all';
let selectedStandingsYear = 'current';
let selectedCompetitionView = 'standings';
let competitionPlayerRankingSort = 'rating_desc';
let competitionPlayerRankingScope = 'season';
let competitionPlayerPalmaresSort = 'total_desc';
let selectedStatsDivision = 'all';
let uiTicker = null;
let matchRevealTimers = [];
let tacticClickSelection = null;
let rankingSort = 'managerScore_desc';
let rankingRowsCache = [];
let rankingLoading = false;

const $ = (id) => document.getElementById(id);
const view = $('view');
