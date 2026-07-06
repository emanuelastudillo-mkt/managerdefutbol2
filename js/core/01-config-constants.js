/* V3.16 · Configuración, calendario anual, constantes generales y estado global. */

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

const DATA_URL = configValue('data.seedUrl', 'data/seed.json');
const PLAYERS_DATABASE_URL = configValue('data.playersUrl', 'data/jugadores.json');
const SPONSORS_DATABASE_URL = configValue('data.sponsorsUrl', 'data/sponsors.json');
const EMPLOYEES_DATABASE_URL = configValue('data.employeesUrl', 'data/empleados.json');
const LEAGUE_DATA_CANDIDATES = ['data/Liga Argentina.json', 'data/Liga argentina.json', 'data/Liga_argentina.json', 'data/liga_argentina.json', 'data/liga-argentina.json'];
const DB_NAME = 'futbol-manager-mvp';
const DB_STORE = 'saves';
const SAVE_KEY = 'main';
const DAYS_PER_ADVANCE = configNumber('calendario.diasPorAvance', 7, 1, 30);
const SEASON_START_YEAR = configNumber('calendario.anioInicial', 2026, 1900, 2200);
const SEASON_START_MONTH = configNumber('calendario.mesInicioTemporada', 1, 1, 12);
const SEASON_START_DAY = configNumber('calendario.diaInicioTemporada', 1, 1, 31);
const SEASON_HOME_AWAY = configBoolean('calendario.ligaIdaYVuelta', true);
const SEASON_CALENDAR_VERSION = 'annual-365-home-away-v1';
const ADVANCE_LOCK_MS = configNumber('calendario.bloqueoEntreAvancesMs', 120000, 0);
const TURN_TRANSITION_MS = configNumber('calendario.transicionAvanceMs', 3400, 800);
const NOTICE_DURATION_MS = configNumber('ui.duracionAvisoMs', 5200, 1000);
const ACTION_FEEDBACK_LOADING_MS = configNumber('ui.accionesFeedbackCargaMs', 750, 250, 3000);
const ACTION_FEEDBACK_RESULT_MS = configNumber('ui.accionesFeedbackResultadoMs', 900, 300, 4000);
const ADVANCE_STATUS_PHRASE_INTERVAL_MS = configNumber('ui.frasesProgresoAvanceIntervaloMs', 10000, 3000, 60000);
const ADVANCE_STATUS_PHRASES = Array.isArray(configValue('ui.frasesProgresoAvance', [])) ? configValue('ui.frasesProgresoAvance', []).filter(Boolean).map(String) : [];
const PRESEASON_TURNS = Math.ceil(configNumber('calendario.diasPretemporada', 70, 0) / DAYS_PER_ADVANCE);
const POSTSEASON_TURNS_CONFIG = Math.ceil(configNumber('calendario.diasPostemporada', 0, 0) / DAYS_PER_ADVANCE);
const MAX_PRESEASON_FRIENDLIES = configNumber('calendario.amistososMaximosPretemporada', 5, 0);
const APP_VERSION = configValue('version', 'V3.16');

const RANKING_APPS_SCRIPT_URL = configValue('ranking.appsScriptUrl', '');
const RANKING_TOKEN = configValue('ranking.token', '');
const RANKING_PAGE_SIZE = configNumber('ranking.resultadosPorPagina', 100, 10, 500);
const RANKING_UPLOAD_COOLDOWN_DAYS = configNumber('ranking.cooldownCargaDias', 77, 0, 366);
const RANKING_NAME = configValue('ranking.nombreRanking', 'Ranking Online');

const TEAM_COHESION_START = 50;
const TEAM_COHESION_MATCH_GAIN = 8;
const TEAM_COHESION_TACTIC_CHANGE_LOSS = 10;
const TEAM_COHESION_PLAYER_CHANGE_LOSS = 2;
const PLAYER_MORALE_START = 60;
const PSYCHOLOGIST_COST = configNumber('empleados.psicologoCosto', 500000, 0);
const PSYCHOLOGIST_SUCCESS_CHANCE = configNumber('empleados.psicologoProbabilidadExito', 0.90, 0, 1);
const PSYCHOLOGIST_COOLDOWN_TURNS = Math.ceil(configNumber('empleados.psicologoCooldownDias', 35, 0) / DAYS_PER_ADVANCE);
const KINESIOLOGIST_COST = configNumber('empleados.kinesiologoCosto', 1000000, 0);
const KINESIOLOGIST_FAILURE_CHANCE = configNumber('empleados.kinesiologoProbabilidadFallo', 0.20, 0, 1);
const INJURED_SUB_MAX_TURNS = Math.ceil(configNumber('lesiones.lesionadoSuplenteDiasMax', 63, 0) / DAYS_PER_ADVANCE);
const INJURED_SUB_PENALTY = configNumber('lesiones.penalizacionLesionadoSuplente', 0.10, 0, 1);
const DEFAULT_TRAINING_TYPE = 'regenerative';
const TRAINING_OPTIONS = [
  { value:'regenerative', label:'Regenerativo', tone:'regen' },
  { value:'massage', label:'Masajista', tone:'massage' },
  { value:'intense', label:'Entrenamiento intenso', tone:'intense' },
  { value:'tactical', label:'Entrenamiento táctico', tone:'tactical' },
  { value:'dayoff', label:'Turno libre', tone:'dayoff' }
];
const TRAINING_DAY_LABELS = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const TRAINING_DAY_SLOTS = [
  { key:'pre', label:'Pre turno' },
  { key:'morning', label:'Turno mañana' },
  { key:'afternoon', label:'Turno tarde' },
  { key:'night', label:'Turno noche' }
];
const TRAINING_SLOT_EFFECTIVENESS = configNumber('entrenamiento.efectividadPorCasilla', 0.50, 0, 2);
const TRAINING_SKILL_CURVE_ENABLED = configValue('entrenamiento.curvaHabilidadActual', true) !== false;
const TRAINING_SKILL_MIN_FINAL_CHANCE = configNumber('entrenamiento.probabilidadMinimaSubidaHabilidad', 0, 0, 1);
const TRAINING_DEFAULT_SLOT_PLAN = configValue('entrenamiento.planSemanalInicial', { pre:'regenerative', morning:'intense', afternoon:'tactical', night:'dayoff' });

const FORMATIONS = {
  '4-4-2': ['POR','LD','DFC','DFC','LI','MCD','MC','MC','MCO','DC','DC'],
  '4-3-3': ['POR','LD','DFC','DFC','LI','MCD','MC','MCO','ED','EI','DC'],
  '4-2-3-1': ['POR','LD','DFC','DFC','LI','MCD','MC','MCO','ED','EI','DC'],
  '3-5-2': ['POR','DFC','DFC','DFC','MCD','MCD','MC','MC','MCO','DC','DC'],
  '5-3-2': ['POR','LD','DFC','DFC','DFC','LI','MCD','MC','MCO','DC','DC'],
  '4-1-4-1': ['POR','LD','DFC','DFC','LI','MCD','MCD','MC','MC','MCO','DC'],
  '3-4-3': ['POR','DFC','DFC','DFC','MCD','MC','MC','MCO','ED','EI','DC'],
  '4-5-1': ['POR','LD','DFC','DFC','LI','MCD','MCD','MC','MC','MCO','DC'],
  '4-3-1-2': ['POR','LD','DFC','DFC','LI','MCD','MC','MC','MCO','DC','DC'],
  '5-4-1': ['POR','LD','DFC','DFC','DFC','LI','MCD','MC','MC','MCO','DC']
};
const FORMATION_VISUALS = {
  '4-4-2':[4,0,4,0,2],
  '4-3-3':[4,0,3,0,3],
  '4-2-3-1':[4,2,0,3,1],
  '3-5-2':[3,0,5,0,2],
  '5-3-2':[5,0,3,0,2],
  '4-1-4-1':[4,1,4,0,1],
  '3-4-3':[3,0,4,0,3],
  '4-5-1':[4,1,2,2,1],
  '4-3-1-2':[4,0,3,1,2],
  '5-4-1':[5,0,4,0,1]
};
const MENTALITIES = ['posicional','ataque','defensiva'];
const SUB_TRIGGERS = [
  { value:'tired', label:'Cambiar a los cansados' },
  { value:'best', label:'Mejores suplentes' },
  { value:'injuryOnly', label:'Solo cambios por lesión' }
];
const INJURY_TABLE = [
  { name:'Distensión', probability:25, minTurns:2, maxTurns:5 },
  { name:'Desgarro', probability:20, minTurns:1, maxTurns:4 },
  { name:'Esguince', probability:15, minTurns:3, maxTurns:8 },
  { name:'Rotura', probability:9, minTurns:6, maxTurns:12 },
  { name:'Fractura', probability:3, minTurns:16, maxTurns:30 },
  { name:'Contusión', probability:28, minTurns:1, maxTurns:2 }
];
const BASE_INJURY_CHANCE = configNumber('lesiones.lesionBase', 0.05, 0, 1);
const FATIGUE_INJURY_STEP = configNumber('lesiones.fatigaPaso', 5, 1);
const FATIGUE_INJURY_BONUS = configNumber('lesiones.fatigaBonus', 0.01, 0, 1);
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
const MARKET_FREE_AGENT_COUNT = configNumber('plantel.agentesLibresIniciales', 50, 0);
const SEASON_YOUTH_FREE_AGENT_COUNT = configNumber('plantel.jovenesLibresPorTemporada', 20, 0);
const RETIREMENT_MIN_AGE = 32;
const RETIREMENT_MAX_AGE = 38;
const SEASON_SALARY_BASE_REDUCTION = configNumber('economia.reduccionBaseSueldoFinTemporada', 0.05, 0, 1);
const SEASON_SALARY_MATCH_BONUS = configNumber('economia.bonusSueldoPorPartidoJugado', 0.01, 0);
const FOREIGN_CLUBS = ['Atlético Lisboa','London Athletic','Milano FC','Paris Nord','Berlin United','Porto Azul','Madrid Imperial','Amsterdam Club','Montevideo City','Santos del Mar'];
const OWN_PLAYER_OFFER_COOLDOWN_TURNS = 3;
const SEASON_END_TRANSFER_OFFERS_MIN = 2;
const SEASON_END_TRANSFER_OFFERS_MAX = 6;
const SPONSOR_OFFER_MATCH_MIN = configNumber('sponsors.partidosMinimosEntreTandas', 4, 1);
const SPONSOR_OFFER_MATCH_MAX = Math.max(SPONSOR_OFFER_MATCH_MIN, configNumber('sponsors.partidosMaximosEntreTandas', 7, 1));
const SPONSOR_OFFER_COUNT_MIN = configNumber('sponsors.ofertasMinimasPorTanda', 2, 1);
const SPONSOR_OFFER_COUNT_MAX = Math.max(SPONSOR_OFFER_COUNT_MIN, configNumber('sponsors.ofertasMaximasPorTanda', 5, 1));
const SPONSOR_OPENING_OFFER_COUNT = configNumber('sponsors.ofertasInicialesFecha1', 2, 0);
const SPONSOR_BASE_VALUE_FACTOR = configNumber('sponsors.factorValorBase', 1, 0);
const ACADEMY_SCOUTING_COST = configNumber('academia.costoCaptacion', 1000000, 0);
const ACADEMY_SCOUTING_TURNS = Math.ceil(configNumber('academia.diasCaptacion', 35, 1) / DAYS_PER_ADVANCE);
const ACADEMY_PLAYERS_MIN = configNumber('academia.jugadoresMinimosPorCaptacion', 5, 1);
const ACADEMY_PLAYERS_MAX = Math.max(ACADEMY_PLAYERS_MIN, configNumber('academia.jugadoresMaximosPorCaptacion', 10, 1));
const ACADEMY_PLAYER_TURN_COST = configNumber('academia.costoJugadorPorAvance', 10000, 0);
const ACADEMY_DISMISS_COMPENSATION = configNumber('academia.compensacionDespido', 50000, 0);
const YOUTH_PREPARER_COST = configNumber('empleados.preparadorJuvenilesCosto', 1000000, 0);
const ACADEMY_VISIBLE_STATS_COUNT = 7;
const ACADEMY_SKILL_GAIN_MULTIPLIER = configNumber('academia.multiplicadorEntrenamiento', 3, 1);

const MIN_PLAYERS_PER_CLUB = configNumber('plantel.jugadoresMinimosPorClub', 18, 1);
const INITIAL_PLAYERS_PER_CLUB = Math.max(MIN_PLAYERS_PER_CLUB, configNumber('plantel.jugadoresInicialesPorClub', 25, 1));
const MAX_PLAYERS_PER_CLUB = Math.max(INITIAL_PLAYERS_PER_CLUB, configNumber('plantel.jugadoresMaximosPorClub', 42, 1));
const CLUB_ROSTER_SIZE = INITIAL_PLAYERS_PER_CLUB;
const BOT_ROSTER_REPAIR_ENABLED = configBoolean('plantel.reparacionAutomaticaBots', true);
const BOT_MIN_GOALKEEPERS = configNumber('plantel.botsMinimoPorteros', 2, 1);
const BOT_MIN_DEFENDERS = configNumber('plantel.botsMinimoDefensores', 5, 0);
const BOT_MIN_MIDFIELDERS = configNumber('plantel.botsMinimoMediocampistas', 5, 0);
const BOT_MIN_ATTACKERS = configNumber('plantel.botsMinimoDelanteros', 3, 0);
const BOT_EMERGENCY_MEDIA_MIN = configNumber('plantel.botsMediaEmergenciaMin', 28, 1, 99);
const BOT_EMERGENCY_MEDIA_MAX = Math.max(BOT_EMERGENCY_MEDIA_MIN, configNumber('plantel.botsMediaEmergenciaMax', 52, 1, 99));
const BOT_EMERGENCY_SALARY_FACTOR = configNumber('plantel.botsFactorSueldoEmergencia', 0.35, 0);

const MATCH_REVEAL_PHASES = Math.max(6, Math.min(90, configNumber('ui.fasesSimulacionPartido', 30, 6))); 
const MATCH_REVEAL_DURATION_MS = Math.max(6000, configNumber('ui.duracionSimulacionPartidoMs', 30000, 1000));
const PLAYER_GENERATION_RULES_VERSION = 'V2.30';
const PLAYER_GENERATION_NATIONALITY_GROUPS = [
  { id:'argentinos', probability:0.70, countries:['Argentina'] },
  { id:'sudamerica', probability:0.20, countries:['Brasil','Uruguay','Paraguay','Chile','Bolivia','Perú','Ecuador','Colombia','Venezuela'] },
  { id:'resto_del_mundo', probability:0.10, countries:['España','Italia','Francia','Alemania','Portugal','Inglaterra','México','Estados Unidos','Japón','Corea del Sur','Marruecos','Nigeria','Ghana'] }
];
const PLAYER_GENERATION_POSITION_GROUPS = [
  { id:'POR', probability:0.10, positions:['POR'] },
  { id:'DEF', probability:0.30, positions:['LD','LI','DFC'] },
  { id:'MID', probability:0.30, positions:['MCD','MC','MCO'] },
  { id:'ATT', probability:0.30, positions:['ED','EI','DC'] }
];
const PLAYER_GENERATION_MEDIA_RANGES = [
  { id:'elite_mundial', probability:0.005, media_min:92, media_max:99, salaryMultiplier:3000000 },
  { id:'estrella', probability:0.07, media_min:80, media_max:91, salaryMultiplier:1000000 },
  { id:'titular_competitivo', probability:0.245, media_min:68, media_max:79, salaryMultiplier:300000 },
  { id:'profesional_promedio_bajo', probability:0.50, media_min:43, media_max:67, salaryMultiplier:80000 },
  { id:'bajo_nivel', probability:0.18, media_min:19, media_max:42, salaryMultiplier:10000 }
];
const PLAYER_ECONOMY_SCALE = configNumber('economia.escalaSueldosYClausulas', 0.10, 0);
const PLAYER_CLAUSE_VALUE_SCALE = configNumber('economia.escalaClausulas', 0.10, 0);
const PLAYER_ELITE_MAX_PER_CLUB = 3;
const PLAYER_CLAUSE_MIN_MULTIPLIER = 6;
const PLAYER_CLAUSE_AGE_REDUCTION = 10;
const PLAYER_CLAUSE_BASE_BY_DIVISION_ORDER = { 1:500, 2:450, 3:300 };
const FREE_YOUTH_SALARY_FACTOR = 0.55;
const MARKET_FREE_AGENT_SALARY_FACTOR = 0.75;

const DEFAULT_TACTIC = {
  formation:'4-4-2',
  starters:[],
  bench:[],
  autoSubs:[],
  playerMentalities:{},
  matchInstructions:{winning:'normal',drawing:'normal',losing:'normal'}
};

let seed = null;
let sponsorsDatabase = null;
let employeesDatabase = null;
let game = null;
let activeTab = 'home';
let squadSort = 'media_desc';
let trainingSort = 'media_desc';
let worldPlayersSort = 'media_desc';
let worldPlayersPositionFilter = 'all';
let worldPlayersClubFilter = 'all';
let marketSubTab = 'free';
let marketFilters = { mediaMin:'', mediaMax:'', ageMin:'', ageMax:'', priceMax:'', position:'all' };
let firstTeamTab = 'tactics';
let selectedFixtureDivision = 'all';
let selectedStandingsDivision = 'all';
let selectedStatsDivision = 'all';
let uiTicker = null;
let matchRevealTimers = [];
let newGameModalShown = false;
let tacticClickSelection = null;
let rankingSort = 'managerScore_desc';
let rankingRowsCache = [];
let rankingLoading = false;

const $ = (id) => document.getElementById(id);
const view = $('view');
