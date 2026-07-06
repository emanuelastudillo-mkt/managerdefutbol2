/*
  Configuración editable del juego.
  Cambiar estos valores no requiere tocar app.js.
  Nota: si ya existe una partida guardada, algunos cambios sólo aplican a nuevas partidas o a nuevos eventos.
*/
window.GAME_CONFIG = {
  version: 'V3.14',
  data: {
    seedUrl: 'data/seed.json',
    playersUrl: 'data/jugadores.json',
    sponsorsUrl: 'data/sponsors.json'
  },
  calendario: {
    // Cada avance equivale a 7 días. El juego sigue avanzando de domingo a domingo.
    diasPorAvance: 7,
    // Año inicial del calendario. Cada temporada usa un año calendario completo y respeta años bisiestos.
    anioInicial: 2026,
    mesInicioTemporada: 1,
    diaInicioTemporada: 1,
    // La liga ahora se juega ida y vuelta. Con 20 clubes por división son 38 fechas.
    ligaIdaYVuelta: true,
    // Bloqueo entre avances en milisegundos. 120000 = 2 minutos.
    bloqueoEntreAvancesMs: 120000,
    // Duración visual de la transición al avanzar días.
    transicionAvanceMs: 3400,
    diasPretemporada: 70,
    // Si queda vacío o en 0, la postemporada ocupa automáticamente los días restantes del año.
    diasPostemporada: 0,
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
    ofertasInicialesFecha1: 2
  },
  estadio: {
    costoReplantarCesped: 2000000,
    diasReplantarCesped: 35,
    costoParchearCampo: 200000,
    diasParchearCampo: 21,
    mejoraParchePorAvance: 5
  },
  empleados: {
    psicologoCosto: 500000,
    psicologoProbabilidadExito: 0.90,
    psicologoCooldownDias: 35,
    kinesiologoCosto: 1000000,
    kinesiologoProbabilidadFallo: 0.20,
    preparadorJuvenilesCosto: 1000000
  },
  academia: {
    costoCaptacion: 1000000,
    diasCaptacion: 35,
    jugadoresMinimosPorCaptacion: 5,
    jugadoresMaximosPorCaptacion: 10,
    costoJugadorPorAvance: 10000,
    compensacionDespido: 50000,
    multiplicadorEntrenamiento: 3
  },
  entrenamiento: {
    // Cada avance semanal aplica el plan de 7 días con 4 turnos por día.
    efectividadPorCasilla: 0.50,
    planSemanalInicial: {
      pre: 'regenerative',
      morning: 'intense',
      afternoon: 'tactical',
      night: 'dayoff'
    }
  },
  lesiones: {
    lesionBase: 0.05,
    fatigaPaso: 5,
    fatigaBonus: 0.01,
    lesionadoSuplenteDiasMax: 63,
    penalizacionLesionadoSuplente: 0.10
  },

  ranking: {
    // URL publicada para enviar y leer resultados del ranking online.
    appsScriptUrl: 'https://script.google.com/macros/s/AKfycbxNVzyk9F1Bj5qGZ-xeH5i1XCLF8Z1UdCV7ppSIGmh6haaM_JfjBaCqo7SzZCsoSLZh/exec',
    // Token simple opcional para restringir envíos.
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
