/*
  Configuración editable del juego.
  Cambiar estos valores no requiere tocar app.js.
  Nota: si ya existe una partida guardada, algunos cambios sólo aplican a nuevas partidas o a nuevos eventos.
*/
window.GAME_CONFIG = {
  version: 'V3.09',
  data: {
    seedUrl: 'data/seed.json',
    playersUrl: 'data/jugadores.json',
    sponsorsUrl: 'data/sponsors.json'
  },
  turnos: {
    // Bloqueo entre turnos en milisegundos. 120000 = 2 minutos.
    bloqueoEntreTurnosMs: 120000,
    // Duración visual de la transición al avanzar turno.
    transicionAvanceMs: 3400,
    pretemporada: 10,
    postemporada: 5,
    amistososMaximosPretemporada: 5
  },
  plantel: {
    // Límites del primer equipo. El máximo bloquea fichajes y promociones desde academia.
    jugadoresMinimosPorClub: 18,
    jugadoresInicialesPorClub: 25,
    jugadoresMaximosPorClub: 42,
    // Reparación automática para clubes bots: evita planteles sin porteros o por debajo de estructura mínima.
    reparacionAutomaticaBots: true,
    botsMinimoPorteros: 2,
    botsMinimoDefensores: 5,
    botsMinimoMediocampistas: 5,
    botsMinimoDelanteros: 3,
    botsMediaEmergenciaMin: 28,
    botsMediaEmergenciaMax: 52,
    botsFactorSueldoEmergencia: 0.35,
    agentesLibresIniciales: 50,
    jovenesLibresPorTemporada: 20
  },
  economia: {
    escalaSueldosYClausulas: 0.10,
    // Multiplica sólo las cláusulas calculadas. 0.10 = una décima parte del valor previo.
    escalaClausulas: 0.10,
    reduccionBaseSueldoFinTemporada: 0.05,
    bonusSueldoPorPartidoJugado: 0.01
  },
  sponsors: {
    // Multiplica los valores base de data/sponsors.json. 1 mantiene el valor del archivo.
    factorValorBase: 1,
    partidosMinimosEntreTandas: 4,
    partidosMaximosEntreTandas: 7,
    ofertasMinimasPorTanda: 2,
    ofertasMaximasPorTanda: 5,
    ofertasInicialesJornada1: 2
  },
  estadio: {
    costoReplantarCesped: 2000000,
    turnosReplantarCesped: 5,
    costoParchearCampo: 200000,
    turnosParchearCampo: 3,
    mejoraParchePorTurno: 5
  },
  empleados: {
    psicologoCosto: 500000,
    psicologoProbabilidadExito: 0.90,
    psicologoCooldownTurnos: 5,
    kinesiologoCosto: 1000000,
    kinesiologoProbabilidadFallo: 0.20,
    preparadorJuvenilesCosto: 1000000
  },
  academia: {
    costoCaptacion: 1000000,
    turnosCaptacion: 5,
    jugadoresMinimosPorCaptacion: 5,
    jugadoresMaximosPorCaptacion: 10,
    costoJugadorPorTurno: 10000,
    compensacionDespido: 50000,
    multiplicadorEntrenamiento: 3
  },
  lesiones: {
    lesionBase: 0.05,
    fatigaPaso: 5,
    fatigaBonus: 0.01,
    lesionadoSuplenteTurnosMax: 9,
    penalizacionLesionadoSuplente: 0.10
  },

  ranking: {
    // URL del Web App de Apps Script para ranking online. También se puede pegar desde la pantalla Ranking Online.
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxNVzyk9F1Bj5qGZ-xeH5i1XCLF8Z1UdCV7ppSIGmh6haaM_JfjBaCqo7SzZCsoSLZh/exec',
    // Token simple opcional. Si lo usás en Apps Script, debe coincidir con RANKING_TOKEN.
    token: '',
    resultadosPorPagina: 100,
    nombreRanking: 'Ranking Online'
  },
  ui: {
    duracionAvisoMs: 5200,
    fasesSimulacionPartido: 30,
    duracionSimulacionPartidoMs: 30000,
    // Animación para acciones que pueden salir bien o fallar: tratar lesionados, charla motivacional, etc.
    accionesFeedbackCargaMs: 750,
    accionesFeedbackResultadoMs: 900
  }
};
