/*
  Configuración editable del juego.
  Cambiar estos valores no requiere tocar app.js.
  Nota: si ya existe una partida guardada, algunos cambios sólo aplican a nuevas partidas o a nuevos eventos.
*/
window.GAME_CONFIG = {
  version: 'V3.19',
  data: {
    seedUrl: 'data/seed.json',
    playersUrl: 'data/jugadores.json',
    sponsorsUrl: 'data/sponsors.json',
    employeesUrl: 'data/empleados.json'
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
    agentesLibresIniciales: 300,
    agentesLibresMediaMin: 40,
    agentesLibresMediaMax: 62,
    agentesLibresEdadMin: 19,
    agentesLibresEdadMax: 30,
    agentesLibresMaximosPorTemporada: 200,
    agentesLibresPosiciones: {
      POR: 0.10,
      DEF: 0.35,
      MED: 0.35,
      DEL: 0.20
    },
    rellenarLibresHastaMaximoPorTemporada: true,
    limpiarLibresViejosAlCambiarTemporada: true,
    jovenesLibresNuevosPorEquipoTemporada: 3,
    jovenesLibresEdadMin: 17,
    jovenesLibresEdadMax: 18,
    jovenesLibresPorTemporada: 0
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
    // Los valores base de empleados regulares se mantienen; las categorías se cargan desde data/empleados.json.
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
    // Curva de dificultad: una habilidad alta reduce la probabilidad final de subir +1.
    // Ejemplo: habilidad 80 => 20% de probabilidad final si ya superó la tirada base.
    curvaHabilidadActual: true,
    probabilidadMinimaSubidaHabilidad: 0,
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
    cooldownCargaDias: 77,
    nombreRanking: 'Ranking Online'
  },
  ui: {
    duracionAvisoMs: 5200,
    fasesSimulacionPartido: 30,
    duracionSimulacionPartidoMs: 30000,
    // Animación para acciones que pueden salir bien o fallar: tratar lesionados, charla motivacional, etc.
    accionesFeedbackCargaMs: 750,
    accionesFeedbackResultadoMs: 900,
    frasesProgresoAvanceIntervaloMs: 10000,
    frasesProgresoAvance: [
      'Recogiendo pelotas detrás del arco',
      'Regando el césped por sectores',
      'Midiendo la humedad del campo',
      'Marcando las líneas laterales',
      'Revisando redes de los arcos',
      'Ajustando los banderines del córner',
      'Ordenando conos de entrenamiento',
      'Contando pecheras disponibles',
      'Lavando botines embarrados',
      'Secando guantes de arquero',
      'Pesando pelotas oficiales',
      'Inflando pelotas a presión reglamentaria',
      'Verificando tapones de botines',
      'Revisando vendas y tobilleras',
      'Controlando hielo en la enfermería',
      'Preparando bebidas isotónicas',
      'Cortando cinta deportiva',
      'Limpiando pizarras tácticas',
      'Acomodando bancos de suplentes',
      'Revisando planillas de cambios',
      'Calculando desgaste del césped',
      'Separando camisetas por talle',
      'Chequeando números de dorsales',
      'Probando silbatos del árbitro',
      'Revisando iluminación del estadio',
      'Calibrando GPS de entrenamiento',
      'Registrando cargas musculares',
      'Controlando peso post-entrenamiento',
      'Analizando pisadas en el barro',
      'Ordenando pelotas por estado útil',
      'Aceitando bicicletas del gimnasio',
      'Recogiendo basura del estadio',
      'Visitando a padres de los talentos',
      'Filtrando rumores a la prensa',
      'Revisando cerraduras del vestuario',
      'Cambiando focos del túnel',
      'Contando bidones de agua',
      'Limpiando bancos de suplentes',
      'Ordenando medias por talle',
      'Revisando contratos vencidos',
      'Llamando representantes insistentes',
      'Separando pelotas pinchadas',
      'Desinfectando colchonetas del gimnasio',
      'Ajustando cintas de correr',
      'Imprimiendo planillas de entrenamiento',
      'Revisando permisos de juveniles',
      'Actualizando fichas médicas',
      'Controlando botiquines del estadio',
      'Pintando números en los conos',
      'Reparando redes de entrenamiento',
      'Barriendo tierra de los accesos',
      'Acomodando vallas publicitarias',
      'Verificando micrófonos de conferencia',
      'Revisando cámaras del estadio',
      'Cargando videos del último partido',
      'Buscando camisetas extraviadas',
      'Probando parlantes de la cancha',
      'Revisando carnets de socios',
      'Coordinando traslado de juveniles',
      'Archivando quejas de hinchas'
    ]
  }
};
