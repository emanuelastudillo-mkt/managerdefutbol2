/* Balance del manager, objetivos, prestigio y premios.
  Archivo activo: centraliza objetivos deportivos sin tocar el simulador.
*/
window.GAME_BALANCE_MANAGER = {
  metadataBalance: {
    version: 'V8.06',
    nombre: 'Objetivos dinámicos y premios deportivos V8.06',
    nota: 'Define exigencia de directiva y premios económicos por campeonatos y ascensos con escala reducida.'
  },

  objetivos: {
    activo: true,
    usarPrestigioRelativo: true,
    respetarObjetivoManualConfig: true,

    basesPorDivision: {
      primeraFuerte: 1.25,
      primeraMedia: 1.20,
      segunda: 1.05,
      tercera: 0.90
    },

    // Países cuya primera división arranca desde la base fuerte.
    paisesPrimeraFuerte: ['Argentina', 'Brasil', 'España', 'Inglaterra', 'Italia'],

    limitesPorDivision: {
      primera: { min: 0.95, max: 2.10 },
      segunda: { min: 0.80, max: 2.00 },
      tercera: { min: 0.70, max: 1.90 }
    },

    modificadoresPrestigioRelativo: [
      { min: -999, max: -50, ppg: -0.35 },
      { min: -49, max: -40, ppg: -0.30 },
      { min: -39, max: -30, ppg: -0.25 },
      { min: -29, max: -20, ppg: -0.18 },
      { min: -19, max: -10, ppg: -0.10 },
      { min: -9, max: -1, ppg: -0.05 },
      { min: 0, max: 9, ppg: 0.00 },
      { min: 10, max: 19, ppg: 0.10 },
      { min: 20, max: 29, ppg: 0.20 },
      { min: 30, max: 39, ppg: 0.30 },
      { min: 40, max: 49, ppg: 0.40 },
      { min: 50, max: 999, ppg: 0.50 }
    ],

    expectativasPrestigioRelativo: [
      { min: -999, max: -30, texto: 'Evitar el último puesto' },
      { min: -29, max: -20, texto: 'Evitar descenso' },
      { min: -19, max: -10, texto: 'Temporada aceptable' },
      { min: -9, max: 9, texto: 'Mitad de tabla' },
      { min: 10, max: 19, texto: 'Pelear parte alta' },
      { min: 20, max: 29, texto: 'Clasificar a playoffs/copas' },
      { min: 30, max: 39, texto: 'Pelear ascenso/título' },
      { min: 40, max: 999, texto: 'Salir campeón' }
    ],

    partidosMinimosEvaluacion: [
      { maxObjetivo: 0.99, partidos: 7 },
      { maxObjetivo: 1.50, partidos: 6 },
      { maxObjetivo: 1.85, partidos: 5 },
      { maxObjetivo: 9.99, partidos: 4 }
    ],

    estadosDirectiva: [
      { minDelta: 0.20, estado: 'Excelente', clase: 'ok', despido: false },
      { minDelta: 0.01, estado: 'Cumple', clase: 'ok', despido: false },
      { minDelta: -0.14, estado: 'Advertencia leve', clase: 'warn', despido: false },
      { minDelta: -0.29, estado: 'Riesgo', clase: 'warn', despido: false },
      { minDelta: -0.49, estado: 'Crisis', clase: 'danger', despido: false },
      { minDelta: -999, estado: 'Despido probable', clase: 'danger', despido: true }
    ],

    prestigioPorResultado: [
      { minDelta: 0.60, puntos: 12, etiqueta: 'Objetivo superado ampliamente' },
      { minDelta: 0.40, puntos: 8, etiqueta: 'Objetivo superado con autoridad' },
      { minDelta: 0.20, puntos: 5, etiqueta: 'Objetivo superado' },
      { minDelta: 0.00, puntos: 3, etiqueta: 'Objetivo cumplido' },
      { minDelta: -0.15, puntos: -1, etiqueta: 'Objetivo incumplido levemente' },
      { minDelta: -0.30, puntos: -3, etiqueta: 'Objetivo incumplido' },
      { minDelta: -999, puntos: -5, etiqueta: 'Objetivo muy incumplido' }
    ],

    penalizacionesTemporada: {
      descenso: -8,
      ultimoPuestoAdicional: -5
    },

    despido: {
      activo: true,
      deltaDespido: -0.50
    }
  },

  contratosManager: {
    activo: true,

    // Sueldo base mensual antes de prestigio, reputación, economía, duración y objetivo.
    sueldoBaseMensualPorDivision: {
      1: 6000000,
      2: 3000000,
      3: 1500000
    },

    factorPrestigioManagerMin: 0.60,
    factorPrestigioManagerMax: 1.50,
    factorReputacionClubMin: 0.70,
    factorReputacionClubMax: 1.30,
    factorEconomicoMin: 0.75,
    factorEconomicoMax: 1.25,

    // Un contrato más largo baja levemente el sueldo mensual a cambio de estabilidad.
    factorSueldoPorDuracion: { 1: 1.00, 2: 0.95, 3: 0.90 },

    negociacionObjetivo: {
      prudente: { label: 'Objetivo prudente', objectiveDelta: -0.10, salaryFactor: 0.80 },
      normal: { label: 'Objetivo normal', objectiveDelta: 0.00, salaryFactor: 1.00 },
      ambicioso: { label: 'Objetivo ambicioso', objectiveDelta: 0.20, salaryFactor: 1.25 }
    },

    // Renegociación anual disponible después de cumplir el objetivo vigente.
    // El acuerdo modifica únicamente el sueldo y el objetivo de la temporada siguiente.
    renegociacionTemporadaSiguiente: {
      exigirPartidosMinimos: true,
      aumento: { label: 'Pedir 20% de aumento', salaryFactor: 1.20, objectiveFactor: 1.30 },
      reduccion: { label: 'Aceptar 20% menos', salaryFactor: 0.80, objectiveFactor: 0.90 }
    },

    // Objetivos secundarios internos: no se muestran durante la temporada.
    // Sólo se revelan cuando la directiva resuelve la continuidad o al consolidar el legado histórico.
    objetivosSecundariosOcultos: {
      activo: true,
      diaAviso: 200,
      diaEvaluacion: 250,
      probabilidadDespidoBase: 100,
      reduccionDespidoMaxima: 70,
      reduccionIdoloClub: 10,
      puntosIdoloClub: 51,
      puntosObjetivoPrincipal: 3,
      puntosObjetivoSecundario: 1,
      puntosTitulo: 5,
      puntosPorEstrella: 6,
      economico: { multiplicadorPatrimonio: 2, reduccionDespido: 20 },
      hinchas: { aumentoObjetivo: 1000, reduccionDespido: 20 },
      estadio: { aumentoMinimo: 1, reduccionDespido: 10 },
      clausulas: { jugadoresConvencidos: 1, reduccionDespido: 5 }
    },

    // Diferencia respecto del objetivo final en cada año contractual.
    escalonesObjetivo: {
      1: [0.00],
      2: [-0.20, 0.00],
      3: [-0.30, -0.15, 0.00]
    },

    // Probabilidades de duración según ajuste entre prestigio del manager y club.
    duracionProbabilidadManagerSuperior: { one: 15, two: 45, three: 40 },
    duracionProbabilidadEquilibrada: { one: 35, two: 45, three: 20 },
    duracionProbabilidadExigente: { one: 70, two: 25, three: 5 },

    porcentajeVentaFuturaMin: 5,
    porcentajeVentaFuturaMax: 20,

    // Cada oferta genera dos alternativas estables pero con porcentajes variables.
    negociacionOfertaAleatoria: {
      activo: true,
      aumentoSueldoMin: 5,
      aumentoSueldoMax: 20,
      reduccionObjetivoMin: 3,
      reduccionObjetivoMax: 12,
      reduccionVentaFuturaMin: 1,
      reduccionVentaFuturaMax: 5,
      reduccionSueldoMin: 5,
      reduccionSueldoMax: 20,
      aumentoObjetivoMin: 3,
      aumentoObjetivoMax: 12,
      aumentoVentaFuturaMin: 1,
      aumentoVentaFuturaMax: 5
    },

    // Realismo al asumir un club durante una temporada ya iniciada.
    mercadoLaboralRealista: {
      activo: true,
      zonaBajaDesde: 0.55,
      diasParaBonusMaximoEspera: 120,
      porcentajeVentaFuturaMaximo: 25,
      bonusVentaFuturaMaximoPorEspera: 5,
      bonusVentaFuturaMaximoPorContexto: 2,
      factorSueldoMinimo: 0.65,
      factorSueldoMaximo: 1.05,
      penalizacionSueldoMaximaClubChico: 0.10,
      penalizacionSueldoMaximaZonaBaja: 0.12,
      penalizacionSueldoMaximaEconomiaDebil: 0.08,
      variacionSueldo: 0.04,
      sponsorsActivosMinimo: 0.40,
      sponsorsActivosMaximo: 0.60,
      capitanesConExperienciaMinimo: 2,
      capitanesConExperienciaMaximo: 3,
      capacidadCapitanInicialMinima: 0.45,
      capacidadCapitanInicialMaxima: 0.55,

      // Los clubes pueden contactar al manager aunque tenga contrato vigente.
      // La frecuencia se limita para evitar acumulación de propuestas y el plazo
      // de respuesta se ajusta entre 10 y 30 días según calendario y urgencia.
      ofertasDuranteContrato: {
        activo: true,
        esperaInicialMinDias: 25,
        esperaInicialMaxDias: 55,
        esperaEntreOfertasMinDias: 35,
        esperaEntreOfertasMaxDias: 75,
        maximoPorTemporada: 4,
        maximoActivas: 2,
        plazoMinimoDias: 10,
        plazoMaximoDias: 30
      }
    }
  },

  premiosTemporada: {
    activo: true,
    evitarDuplicados: true,
    conceptoCampeon: 'Premio por campeonato',
    conceptoAscenso: 'Premio por ascenso',
    campeonatoPorDivisionOrden: {
      1: 1500000000,
      2: 750000000,
      3: 375000000
    },
    ascensoPorDivisionOrigenOrden: {
      2: 500000000,
      3: 250000000
    },
    valoresFallback: {
      campeonato: 375000000,
      ascenso: 250000000
    },
    // Los premios se apilan: un campeón de segunda o tercera que asciende cobra campeonato + ascenso.
    acumularCampeonatoYAscenso: true
  }

};
