/*
  Configuración editable del juego.
  Cambiar estos valores no requiere tocar app.js.
  Nota: si ya existe una partida guardada, algunos cambios sólo aplican a nuevas partidas o a nuevos eventos.
*/
window.GAME_CONFIG = {
  version: 'V9.93',
  marca: {
    nombre: 'Una vida de manager',
    nombreCorto: 'Una vida de manager',
    descripcion: 'Juego de manager de fútbol online para navegador con carrera, tácticas, mercado, academia y competencias online.',
    logoPath: 'assets/logo-banner.png',
    logoAlt: 'Una vida de manager',
    urlPublica: 'https://unavidademanager.com/',
    imagenSocial: 'https://unavidademanager.com/assets/logo-banner.png'
  },
  partidas: {
    // Una sola carrera normal. Las partidas de antiguos slots se consolidan sin borrar los registros originales.
    slotsCarrera: 1,
    // Agrupa escrituras automáticas consecutivas sin afectar el guardado manual.
    agruparAutoguardadosMs: 2500,
    // La copia de seguridad completa se renueva cada cierta cantidad de autoguardados.
    backupCadaAutoguardados: 4
  },
  rendimiento: {
    // Ejecuta auditorías y mantenimiento no crítico durante momentos libres del navegador.
    procesamientoSegundoPlano: true,
    // Tiempo máximo antes de forzar una tarea pendiente y pausa mínima entre bloques.
    timeoutTareaSegundoPlanoMs: 1200,
    pausaEntreTareasMs: 24,
    tareasPorBloque: 1,
    // Los controles completos se distribuyen durante la temporada; los controles rápidos siguen siendo diarios.
    auditoriaCalendarioCompletaCadaDias: 7,
    integridadEstadisticasCompletaCadaDias: 7,
    reparacionPlantelesBotsCadaDias: 7,
    normalizacionContratosCadaDias: 30
  },
  data: {
    // Modo de cache para los JSON. 'default' permite cache del navegador; usar 'no-store' sólo durante pruebas intensivas.
    cacheMode: 'default',
    // El juego carga y combina todos los JSON válidos de esta lista.
    leagueUrls: ['data/Liga Argentina.json?v=9.04', 'data/Liga Chile.json?v=9.04', 'data/Liga Brasil.json?v=9.04', 'data/Liga Inglaterra.json?v=9.04', 'data/Liga Espana.json?v=9.04', 'data/Liga Italia.json?v=9.04', 'data/Liga Rumania.json?v=9.04'],
    // Manifest principal y chunks de jugadores. Si playersUrls está definido, el juego carga esos archivos en paralelo.
    playersUrl: 'data/jugadores.json?v=9.04',
    playersUrls: [
      'data/jugadores/argentina-liga-profesional.json?v=9.04',
      'data/jugadores/argentina-primera-nacional.json?v=9.04',
      'data/jugadores/argentina-federal-a.json?v=9.04',
      'data/jugadores/chile-primera-division-chile.json?v=9.04',
      'data/jugadores/brasil-brasileirao.json?v=9.04',
      'data/jugadores/inglaterra-premier-league.json?v=9.04',
      'data/jugadores/espana-laliga-espana.json?v=9.04',
      'data/jugadores/italia-serie-a-italia.json?v=9.04',
      'data/jugadores/rumania-superliga-rumania.json?v=9.04'
    ],
    manualPlayersUrl: 'data/jugadores_manuales.json?v=9.04',
    sponsorsUrl: 'data/sponsors.json?v=9.04',
    employeesUrl: 'data/empleados.json?v=9.04',
    installationsUrl: 'data/instalaciones.json?v=9.04',
    eventsUrl: 'data/eventos.json?v=9.04',
    specialSkillsUrl: 'data/habilidades_especiales.json?v=9.74',
    managerAchievementsUrl: 'data/hitos_manager.json?v=9.04',
    retosManagerUrl: 'data/retos_manager.json?v=9.04',
    estadiosUrls: ['data/estadios_argentina.json?v=9.04', 'data/estadios_chile.json?v=9.04', 'data/estadios_brasil.json?v=9.04', 'data/estadios_inglaterra.json?v=9.04', 'data/estadios_espana.json?v=9.04', 'data/estadios_italia.json?v=9.04', 'data/estadios_rumania.json?v=9.04'],
    hinchasUrls: ['data/hinchas_argentina.json?v=9.04', 'data/hinchas_chile.json?v=9.04', 'data/hinchas_brasil.json?v=9.04', 'data/hinchas_inglaterra.json?v=9.04', 'data/hinchas_espana.json?v=9.04', 'data/hinchas_italia.json?v=9.04', 'data/hinchas_rumania.json?v=9.04'],
    relatosPartidoUrl: 'data/relatos_partido.json?v=9.04'
  },
  calendario: {
    // Cada avance equivale a 1 día calendario. La temporada se procesa día por día.
    diasPorAvance: 1,
    // Año inicial del calendario. Cada temporada usa un año calendario completo y respeta años bisiestos.
    anioInicial: 2026,
    mesInicioTemporada: 1,
    diaInicioTemporada: 1,
    // La liga ahora se juega ida y vuelta. Con 18 clubes por división son 34 fechas.
    ligaIdaYVuelta: true,
    // V9.70: cada temporada usa una de 20 semillas fijas. El ciclo vuelve a comenzar después de 20 años.
    fixtureSemillasActivas: true,
    fixtureSemillas: [
      104729, 130363, 155921, 181081, 206369,
      231731, 257053, 282377, 307691, 333017,
      358349, 383681, 409021, 434353, 459691,
      485021, 510361, 535697, 561019, 586367
    ],
    diasEntreFechasLiga: 7,
    fechaPausaLuegoDe: 17,
    diasVacacionesMitadTemporada: 28,
    // Distribución de partidos por días para no simular todas las ligas juntas.
    // offset: -2 = viernes, -1 = sábado, 0 = domingo respecto de la fecha base de cada jornada.
    diasPorLiga: [
      { paises:['España','Italia','Inglaterra','Rumania'], offset:-2 },
      { paises:['Argentina'], ordenes:[2,3], offset:-1 },
      { paises:['Chile','Brasil'], offset:0 },
      { paises:['Argentina'], ordenes:[1], offset:0 }
    ],
    // Copas nacionales V8.84: sorteos días 20 a 26; rondas el primer miércoles de marzo, mayo, junio, agosto, septiembre y octubre.
    // Las supercopas se disputan el día 300, después de quedar definidos los campeones de liga y copa.
    copasNacionalesActivas: true,
    // Los partidos sin manager usan simulación rápida para reducir bloqueos.
    simulacionRapidaBots: true,

    // Cooldown único tras cada avance/partido. V9.71: 3000 = 3 segundos.
    bloqueoEntreAvancesMs: 3000,
    // El avance diario usa el mismo cooldown para evitar dobles flujos de calendario.
    bloqueoAvanceDiaMs: 3000,
    // La transición queda por debajo del bloqueo para que la interfaz esté libre al cumplirse los 3 segundos.
    transicionAvanceMs: 2400,
    diasPretemporada: 30,
    // Si queda vacío o en 0, la postemporada ocupa automáticamente los días restantes del año.
    diasPostemporada: 0,
    // Copa Libertadores: los miércoles se asignan automáticamente evitando copas nacionales y el receso.
    libertadores: {
      activa: true,
      diasAntesSorteo: 7,
      precioEntradaFinal: 3000,
      repartoFinalPorClub: 0.50,
      diasAntesSorteoMundial: 1
    },
    // Champions League: comparte estructura continental con la Libertadores y evita las copas europeas.
    championsLeague: {
      activa: true,
      diasAntesSorteo: 7,
      precioEntradaFinal: 4500,
      repartoFinalPorClub: 0.50,
      diasAntesSorteoMundial: 1
    },
    // Mundial de Clubes: edición cuatrienal, con ranking de las cuatro copas continentales más recientes.
    // Cada grupo recibe un club de Champions, uno de Libertadores y dos invitados.
    mundialClubes: {
      anioBase: 2025,
      cadaAnios: 4,
      edicionesRanking: 4,
      cuposChampions: 8,
      cuposLibertadores: 8,
      cuposInvitados: 16,
      rankingVictoria: 3,
      rankingEmpate: 1,
      rankingPenales: 1,
      rankingOctavos: 2,
      rankingCuartos: 3,
      rankingSemifinal: 4,
      rankingFinal: 5,
      diaSorteo: 295,
      precioEntrada: 1200,
      precioEntradaFinal: 3500,
      diaGrupos1: 305,
      diaGrupos2: 310,
      diaGrupos3: 315,
      diaOctavos: 320,
      diaCuartos: 325,
      diaSemifinales: 330,
      diaTercerPuesto: 335,
      diaFinal: 336,
      diasPreparacionAntesPrimerPartido: 1,
      jugadoresMinimosPorPartido: 21,
      boostEntrenamientoCampeonMin: 10,
      boostEntrenamientoCampeonMax: 30
    },
    amistososMaximosPretemporada: 5,
    amistosos: {
      // La recaudación bruta se distribuye entre los dos clubes.
      repartoIngresosPorEquipoPct: 0.50,
      // La moral utiliza el sistema normal de resultados; estos valores agregan el efecto sobre la cohesión.
      cohesionVictoria: 4,
      cohesionEmpate: 2,
      cohesionDerrota: -2,
      // Programación durante toda la temporada. Con hoy como primer día libre, el amistoso puede ir en el centro de una ventana de cinco días.
      anticipacionMinimaDias: 2,
      // Ambos clubes deben tener libres el día del amistoso y los dos días anteriores y posteriores.
      margenPartidosDias: 2,
      // Rivales sorteados y persistentes para cada fecha consultada.
      opcionesPorFecha: 5,
      // La búsqueda usa un orden aleatorio determinista y se detiene al completar las opciones.
      intentosMaximosRivales: 70
    }
  },

  rankingClubes: {
    // Ranking mundial interno de clubes. No representa una clasificación oficial externa.
    activo: true,
    puntajeMinimo: 1,
    puntajeMaximo: 1500,
    temporadasForma: 5,
    reputacionClubMultiplicador: 7.2,
    reputacionLigaMultiplicador: 4,
    reputacionLigaBase: 35,
    reputacionLigaMaximo: 230,
    puntosVictoriaLiga: 2.5,
    puntosVictoriaCopaNacional: 7,
    puntosVictoriaSupercopa: 12,
    puntosVictoriaLibertadoresGrupos: 10,
    puntosVictoriaLibertadores16avos: 14,
    puntosVictoriaLibertadoresOctavos: 18,
    puntosVictoriaLibertadoresCuartos: 24,
    puntosVictoriaLibertadoresSemifinal: 32,
    puntosVictoriaLibertadoresFinal: 45,
    puntosVictoriaChampionsGrupos: 10,
    puntosVictoriaChampions16avos: 14,
    puntosVictoriaChampionsOctavos: 18,
    puntosVictoriaChampionsCuartos: 24,
    puntosVictoriaChampionsSemifinal: 32,
    puntosVictoriaChampionsFinal: 45,
    puntosVictoriaMundialGrupos: 22,
    puntosVictoriaMundialOctavos: 30,
    puntosVictoriaMundialCuartos: 36,
    puntosVictoriaMundialSemifinal: 44,
    puntosVictoriaMundialTercerPuesto: 24,
    puntosVictoriaMundialFinal: 55,
    puntosTituloLigaPrimera: 75,
    puntosTituloLigaAscenso: 30,
    puntosTituloCopaNacional: 50,
    puntosTituloSupercopa: 25,
    puntosTituloLibertadores: 140,
    puntosTituloChampions: 140,
    puntosTituloMundial: 190,
    decaimientoTemporada: 0.82,
    decaimientoMinimoTitulos: 0.25,
    historialTemporadasMaximo: 12
  },


  mercadoBots: {
    // Cada club bot recibe una estrategia por temporada. El perfil se mantiene durante todo el año.
    activo: true,
    intervaloRevisionLibresDias: 5,
    intervaloRevisionComprasDias: 7,
    clubesEvaluadosPorRevision: 14,
    maximoLibresPorRevision: 4,
    maximoComprasPorRevision: 5,
    plantelMinimo: 20,
    plantelIdeal: 25,
    plantelMaximo: 30,
    maximoNuevosTransferiblesPorClub: 1,
    impuestoVentaBotPct: 0.30,
    historialInternoMaximo: 180,
    perfiles: {
      normal: {
        peso: 52,
        reservaCajaPct: 0.34,
        coberturaMasaSalarialAnios: 0.55,
        maximoPorCompraSobreCajaPct: 0.23,
        gastoTemporadaSobreCajaInicialPct: 0.58,
        maximoAltasTemporada: 4,
        mejoraMinimaMedia: 1,
        ofertaMinimaClausulaPct: 0.62,
        ofertaMaximaClausulaPct: 0.88,
        edadMaximaObjetivo: 32,
        prioridadLibres: 35,
        prioridadTransferibles: 28,
        prioridadCalidad: 70
      },
      bargain: {
        peso: 31,
        reservaCajaPct: 0.50,
        coberturaMasaSalarialAnios: 0.72,
        maximoPorCompraSobreCajaPct: 0.13,
        gastoTemporadaSobreCajaInicialPct: 0.32,
        maximoAltasTemporada: 5,
        mejoraMinimaMedia: -1,
        ofertaMinimaClausulaPct: 0.38,
        ofertaMaximaClausulaPct: 0.64,
        edadMaximaObjetivo: 35,
        prioridadLibres: 115,
        prioridadTransferibles: 105,
        prioridadCalidad: 42
      },
      all_in: {
        peso: 17,
        reservaCajaPct: 0.05,
        coberturaMasaSalarialAnios: 0.18,
        maximoPorCompraSobreCajaPct: 0.48,
        gastoTemporadaSobreCajaInicialPct: 0.94,
        maximoAltasTemporada: 6,
        mejoraMinimaMedia: 3,
        ofertaMinimaClausulaPct: 0.82,
        ofertaMaximaClausulaPct: 1.08,
        edadMaximaObjetivo: 30,
        prioridadLibres: 18,
        prioridadTransferibles: 20,
        prioridadCalidad: 125
      }
    }
  },

  mercadoBotsElite: {
    // Los clubes de élite compiten por estrellas libres y el Top 10 mundial intenta reunir al menos siete jugadores de media 85+.
    activo: true,
    mediaEstrella: 85,
    prestigioAltoMinimo: 80,
    cantidadClubesTopRanking: 10,
    objetivoEstrellasTop10: 7,
    maximoEstrellasTop10: 9,
    objetivoEstrellasPrestigioAlto: 4,
    maximoEstrellasPrestigioAlto: 6,
    // Los libres pueden firmar fuera de las ventanas profesionales.
    intervaloRevisionLibresDias: 3,
    maximoLibresPorRevision: 3,
    // Las compras entre clubes respetan las ventanas de mercado.
    intervaloRevisionComprasDias: 10,
    maximoComprasPorRevision: 2,
    maximoAltasPorClubTemporada: 6,
    // Protección financiera: el bot conserva caja y capacidad para cubrir la masa salarial.
    reservaCajaMinimaPct: 0.42,
    coberturaMasaSalarialAnios: 0.80,
    salarioMaximoLibreSobreCajaPct: 0.16,
    gastoTraspasoMaximoCajaTop10Pct: 0.24,
    ofertaMinimaClausulaPct: 0.62,
    ofertaMaximaClausulaPct: 0.82,
    impuestoVentaBotPct: 0.30,
    edadMaximaObjetivo: 34,
    historialInternoMaximo: 120
  },

  centroOjeo: {
    activo: true,
    cupoBaseOjeadores: 2,
    cupoBaseJugadores: 5,
    ojeadoresPorOficina: 3,
    jugadoresPorOficina: 10,
    costoOjeadorDiario: 200000,
    costoBusquedaJugadorDiario: 50000,
    costoOficinaMensual: 1000000,
    jefes: {
      regular: { nombre:'Regular', sueldoMensual: 500000, maxOficinas: 1, revelacionesMin: 0, revelacionesMax: 1 },
      bueno: { nombre:'Bueno', sueldoMensual: 12000000, maxOficinas: 2, revelacionesMin: 0, revelacionesMax: 1 },
      elite: { nombre:'Elite', sueldoMensual: 180000000, maxOficinas: 5, revelacionesMin: 1, revelacionesMax: 2 }
    }
  },
  retosManager: {
    // Oculta temporalmente el acceso para iniciar Campo destruido. No elimina guardados existentes.
    campoDestruidoVisible: false
  },
  modoFundador: {
    // Oculta temporalmente la creación de clubes. Las carreras fundadas existentes siguen siendo compatibles.
    activo: false,
    prestigioClubInicial: 10,
    presupuestoInicial: 0,
    capacidadEstadioInicial: 0,
    hinchasIniciales: 500,
    campoInicial: 30,
    libresMinimosTotales: 80,
    libresMinimosPorteros: 8,
    libresMinimosDefensores: 20,
    libresMinimosMediocampistas: 24,
    libresMinimosDelanteros: 16,
    // En el club fundador, las categorías superiores de empleados se habilitan por victorias logradas con ese club.
    empleados: {
      victoriasNivelBueno: 15,
      victoriasNivelElite: 45
    },
    // Gastos diarios exclusivos del club fundador. El total combina un piso por división y un porcentaje del valor del plantel.
    costosAdministrativosDiarios: {
      activo: true,
      basePorDivision: { 1: 180000, 2: 100000, 3: 60000 },
      porcentajeValorPlantelPorDivision: { 1: 0.000015, 2: 0.000012, 3: 0.000010 },
      distribucion: {
        inscripcionLiga: 0.18,
        seguridad: 0.17,
        transporte: 0.20,
        administracion: 0.15,
        mantenimientoMinimo: 0.15,
        seguros: 0.15
      }
    },
    escudosDisponibles: [
      'img/escudos/fundador-1.webp',
      'img/escudos/fundador-2.webp',
      'img/escudos/fundador-3.webp',
      'img/escudos/fundador-4.webp',
      'img/escudos/fundador-5.webp',
      'img/escudos/fundador-6.webp',
      'img/escudos/fundador-7.webp',
      'img/escudos/fundador-8.webp',
      'img/escudos/fundador-9.webp'
    ]
  },
  modoBancarrota: {
    activo: true,
    cajaInicial: -500000000,
    reduccionPrestigio: 0.70,
    reduccionHinchas: 0.50,
    capacidadEstadioInicial: 0,
    campoInicial: 100,
    juvenilesIniciales: 20,
    juvenilesPorterosMinimos: 1,
    jugadoresLealesPrimerEquipo: 14,
    jugadoresLealesPorterosMinimos: 1
  },
  clubes: {
    reputacionTemporada: {
      // ajuste anual de reputación de club por rendimiento deportivo.
      // Los descensos negativos nunca pueden bajar al club por debajo del mínimo de su liga.
      minimoPorDivisionOrden: { 1: 40, 2: 25, 3: 10 },
      posicion: {
        campeon: 2,
        zonaAlta: 1,
        zonaMedia: 0,
        zonaBaja: -1,
        zonaFondo: -2,
        zonaAltaHasta: 0.25,
        zonaMediaHasta: 0.60,
        zonaBajaHasta: 0.85
      },
      bonusCampeonPorDivisionOrden: { 1: 4, 2: 3, 3: 2 },
      bonusAscensoPorDivisionOrigenOrden: { 2: 4, 3: 5 },
      penalizacionDescensoPorDivisionOrigenOrden: { 1: -3, 2: -2 }
    }
  },

  manager: {
    // Compatibilidad legacy en escala 0–99. La carrera nueva usa manager.carrera.prestigioInicial.
    prestigioInicial: 0,
    // Clubes con este prestigio o menos aceptan cualquier manager, incluso con prestigio 0.
    prestigioClubLibreMinimo: 20,
    // Al renunciar o ser despedido, el club bloquea al manager por esta cantidad de temporadas.
    temporadasBloqueoRecontratacion: 1,
    // Objetivo opcional de puntos por partido. null o vacío = objetivo automático por división.
    // Valores válidos: 0.3 a 2.0.
    objetivoPuntosPorPartido: null,
    // Objetivos automáticos por división cuando objetivoPuntosPorPartido queda vacío.
    objetivoDivision1: 1.4,
    objetivoDivision2: 1.1,
    objetivoDivision3: 0.9,
    // Base de evaluación: la directiva revisa desde los 5 partidos oficiales de la temporada actual.
    partidosMinimosEvaluacionObjetivo: 5,
    // La cantidad total de partidos de evaluación se congela al iniciar cada temporada.
    congelarEvaluacionObjetivoPorTemporada: true,
    carrera: {
      activo: true,
      prestigioMaximo: 1000,
      momentoMinimo: -100,
      momentoMaximo: 100,
      prestigioInicial: 100,
      capacidadInicial: 35,
      evaluacionTemporadaMaxima: 100,
      progresionLarga: {
        activo: true,
        momentoConservadoEntreTemporadas: 0.65,
        prestigioAccesoPuntos: [
          { carrera:0, acceso:15 },
          { carrera:100, acceso:20 },
          { carrera:300, acceso:40 },
          { carrera:500, acceso:60 },
          { carrera:650, acceso:75 },
          { carrera:800, acceso:90 },
          { carrera:900, acceso:97 },
          { carrera:1000, acceso:99 }
        ],
        multiplicadoresGananciaPrestigio: [
          { hasta:399, factor:1.00 },
          { hasta:599, factor:0.85 },
          { hasta:749, factor:0.70 },
          { hasta:849, factor:0.50 },
          { hasta:899, factor:0.30 },
          { hasta:1000, factor:0.15 }
        ],
        multiplicadorPerdidaEliteMaximo: 1.35,
        mantenimientoPrestigio: {
          consolidadoDesde: 650,
          consolidadoEvaluacion: 60,
          eliteDesde: 800,
          eliteEvaluacion: 68,
          mundialDesde: 900,
          mundialEvaluacion: 74,
          historicoEvaluacion: 78,
          penalizacionPorPunto: 2
        },
        capacidades: {
          maximoNormalPorTemporada: 3,
          maximoExcepcionalPorTemporada: 5,
          especializacionesSinPenalizacion: 2,
          umbralEspecializacion: 75,
          penalizacionTresEspecializaciones: 0.75,
          penalizacionCuatroEspecializaciones: 0.50,
          desgasteDesde: 80,
          desgasteCadaTemporadas: 2
        },
        ofertas: {
          margenSolicitudBase: 8,
          margenSolicitudMaximo: 12,
          prestigioElite: 825,
          prestigioPotencia: 900,
          momentoMinimoElite: 0,
          evaluacionRecienteMinimaElite: 70,
          objetivoExigenteBonusMin: 0.28,
          objetivoExigenteBonusMax: 0.55,
          presupuestoExigenteMin: 0.03,
          presupuestoExigenteMax: 0.10
        },
        presionExpectativas: {
          activo: true,
          prestigioCarreraDesde: 600,
          ventajaAccesoDesde: 10,
          bonusPpgMaximo: 0.18
        }
      },
      terceraEtapa: {
        ofertas: {
          maximoCandidatos: 14
        },
        consecuencias: {
          activo: true,
          maximoGuardado: 180
        },
        objetivos: {
          primerDiaRevision: 75,
          intervaloRevisionDias: 21,
          esperaEntreCambiosDias: 60,
          maximoRevisiones: 2,
          variacionAcumuladaMaximaPpg: 0.24
        }
      },
      motorEventos: {
        activo: true,
        primerDia: 20,
        intervaloRevisionDias: 7,
        // Al asumir un club, el vestuario y la directiva esperan antes de exigir decisiones especiales.
        graciaAlLlegarDias: 21,
        partidosMinimosTrasLlegar: 4,
        esperaEntreDecisionesDias: 21,
        esperaMismaCategoriaDias: 35,
        esperaEntreAutomaticosDias: 10,
        maximoDecisionesCada30Dias: 2,
        maximoAutomaticosCada30Dias: 3,
        maximoDecisionesPendientes: 1,
        maximoMismoEventoPorEtapa: 1,
        vencimientoDecisionDias: 5,
        repeticionEventoDias: 90,
        maximoRegistros: 260,
        maximoConsecuencias: 160
      }
    },
    vestuario: {
      activo: true,
      confianzaInicial: 50,
      edadMaximaJoven: 21,
      referentesMinimo: 2,
      referentesMaximo: 4,
      confianzaRespaldo: 70,
      confianzaEstable: 50,
      confianzaDudas: 35,
      confianzaTension: 20,
      efectoDeportivoMaximoPct: 4,
      // Reconocimiento del vestuario al cierre de una temporada con el objetivo alcanzado.
      bonoConfianzaObjetivoCumplido: 4,
      bonoConfianzaObjetivoSuperado: 7,
      objetivoSuperadoMargenPpg: 0.20,
      // Estrellas con baja disciplina pueden desafiar la autoridad del mánager.
      estrellas: {
        activo: true,
        umbralRiesgo: 34,
        disciplinaMaxima: 88,
        intervaloDias: 8,
        esperaInicialDias: 5,
        enfriamientoDias: 14,
        enfriamientoJugadorDias: 20,
        probabilidadBase: 0.025,
        probabilidadMaxima: 0.30,
        bonusPrepartido: 0.10,
        bonusTrasDerrota: 0.12,
        mediaElite: 85,
        mediaMinimaFiguraDominante: 70,
        diferenciaMediaMinima: 4,
        relacionSueldoMinima: 1.05
      },
      cambiosPartido: {
        victoriaTitular: 2,
        victoriaResto: 1,
        empateTitular: 1,
        derrotaTitular: -1,
        derrotaResto: -1,
        derrotaAmpliaExtra: -1,
        suplenteUtilizado: 1,
        jovenUtilizado: 1,
        titularNoUtilizado: -1,
        rotacionTresPartidosSinJugar: -1,
        capitanElegido: 1,
        nuevoCapitan: 2,
        nuevoSegundoCapitan: 1,
        exCapitanSinJustificacion: -4,
        exSegundoCapitanSinJustificacion: -2,
        capitanDesignadoOmitido: -4,
        segundoCapitanOmitido: -2,
        referentesPorCambioCapitan: -1,
        referentesPorCapitanExcepcional: -1
      },
      renovaciones: {
        predispuestoDesde: 70,
        abiertoDesde: 50,
        dudasDesde: 35,
        dificilDesde: 20,
        aumentoDudasPct: 5,
        aumentoDificilPct: 10,
        aumentoRupturaPct: 15,
        probabilidadPedidoSalidaBajaConfianza: 0.35
      }
    },
  },
  codigosEspeciales: {
    activo: true,
    // Los códigos semanales se cargan desde data/codigos-semanales.js.
    // Este bloque no debe volver a contener códigos, huellas ni beneficios.
    fuenteGlobal: 'GAME_WEEKLY_CODES',
    exigirVigencia: true
  },
  plantel: {
    nacionalidades: {
      local: 0.70,
      sudamerica: 0.20,
      restoDelMundo: 0.10,
      porPais: {
        Argentina: 'Argentina',
        Chile: 'Chile',
        Brasil: 'Brasil',
        Inglaterra: 'Inglaterra',
        España: 'España',
        Italia: 'Italia',
        Rumania: 'Rumania'
      },
      sudamericaPaises: ['Argentina','Brasil','Uruguay','Paraguay','Chile','Bolivia','Perú','Ecuador','Colombia','Venezuela'],
      restoDelMundoPaises: ['España','Italia','Francia','Alemania','Portugal','Inglaterra','México','Estados Unidos','Japón','Corea del Sur','Marruecos','Nigeria','Ghana','Rumania']
    },
    // Límites del primer equipo. El máximo bloquea fichajes y promociones desde academia.
    jugadoresMinimosPorClub: 18,
    jugadoresInicialesPorClub: 25,
    jugadoresMaximosPorClub: 42,
    contratosJugadores: {
      activo: true,
      // Los contratos migrados conservan al menos dos temporadas para no provocar salidas inmediatas en partidas existentes.
      migracionAniosMin: 2,
      migracionAniosMax: 4,
      renovacionBotAniosMin: 1,
      renovacionBotAniosMax: 4,
      bloqueoTrasRechazoDias: 7,
      avisoPlantelDesdeDia: 10,
      despidoPlantelDia: 29,
      confianzaMaxAnios: [
        { desde:80, anios:5 },
        { desde:65, anios:4 },
        { desde:50, anios:3 },
        { desde:35, anios:2 },
        { desde:0, anios:1 }
      ],
      ofertaSalarial: { ajustada:0.95, recomendada:1.00, generosa:1.10 },
      probabilidadMinima: 0.08,
      probabilidadMaxima: 0.96
    },
    // Envejecimiento profesional: desde esta edad se aplica un boost negativo anual acumulado a todas las habilidades.
    deterioroEdadActivo: true,
    edadInicioDeterioro: 32,
    deterioroEdadMinAnual: 1,
    deterioroEdadMaxAnual: 4,
    // Probabilidad anual determinista de retiro. Se aplica por igual a manager, bots y libres.
    retiroProbabilidadPorEdad: {
      32: 0.05,
      33: 0.10,
      34: 0.18,
      35: 0.30,
      36: 0.45,
      37: 0.60,
      38: 0.75,
      39: 0.86,
      40: 0.94,
      41: 0.98,
      42: 1
    },
    // Reparación automática para clubes bots: evita planteles sin porteros o por debajo de estructura mínima.
    reparacionAutomaticaBots: true,
    botsMinimoPorteros: 2,
    botsMinimoDefensores: 5,
    botsMinimoMediocampistas: 5,
    botsMinimoDelanteros: 3,
    botsMediaEmergenciaMin: 25,
    botsMediaEmergenciaMax: 47,
    botsFactorSueldoEmergencia: 0.35,
    agentesLibresIniciales: 300,
    agentesLibresMaximosTotales: 300,
    agentesLibresMediaMin: 35,
    agentesLibresMediaMax: 57,
    agentesLibresEdadMin: 19,
    agentesLibresEdadMax: 30,
    agentesLibresMaximosPorTemporada: 300,
    agentesLibresPosiciones: {
      POR: 0.10,
      DEF: 0.35,
      MED: 0.35,
      DEL: 0.20
    },
    rellenarLibresHastaMaximoPorTemporada: true,
    limpiarLibresViejosAlCambiarTemporada: true,
    jovenesLibresNuevosPorEquipoTemporada: 0,
    jovenesLibresEdadMin: 17,
    jovenesLibresEdadMax: 18,
    jovenesLibresPorTemporada: 0
  },
  calidadProfesional: {
    version: 'V8.08',
    aplicarAPartidasExistentes: true,
    excluirLeyendas: true,
    // Sólo afecta futbolistas profesionales. Tu Academia conserva íntegramente su generación y crecimiento.
    reduccionPorMedia: [
      { min:92, max:99, puntos:4 },
      { min:80, max:91, puntos:5 },
      { min:68, max:79, puntos:6 },
      { min:43, max:67, puntos:5 },
      { min:1, max:42, puntos:3 }
    ],
    leyendas: {
      multiplicadorEntrenamiento: 3,
      desarrolloBotProbabilidad: 0.18,
      maximoBoostBotPorHabilidad: 18,
      regeneracionMediaMin: 40,
      regeneracionMediaMax: 62
    }
  },
  cohesion: {
    // Balance de cohesión ajustado para que el equipo gane cohesión con mayor claridad.
    valorInicial: 10,
    gananciaPorPartido: 7,
    // En una derrota no se aplica la ganancia base y cada gol recibido resta cohesión.
    perdidaPorGolEnContraDerrota: 1,
    perdidaPorCambioTactico: 8,
    perdidaPorCambioJugador: 1,
    // Movimientos de plantel: vender 2 y fichar 2 jugadores reduce 10 puntos en total.
    perdidaPorFichaje: 2,
    perdidaPorVenta: 3,
    perdidaPorDespedirJugador: 1,
    gananciaPorContratoProfesionalJuvenil: 3,
    probabilidadEntrenamientoTacticoPorCasilla: 0.35,
    gananciaEntrenamientoTacticoPorCasilla: 1
  },
  moral: {
    perdidaPlantelPorDespedirJugador: 1,
    // Penalización adicional para todo el plantel cuando el equipo pierde.
    perdidaExtraPorDerrota: 2
  },
  capitania: {
    activo: true,
    // Formación lenta: entre una y tres temporadas según la edad del jugador.
    partidosObjetivoAprox: 60,
    formacionPorEdad: {
      hasta20: 96,
      de21a23: 84,
      de24a27: 60,
      de28a31: 42,
      desde32: 34
    },
    maximoPorcentaje: 99,
    // Sólo usa habilidades que ya existen en todos los jugadores de la base.
    pesosMaximo: {
      liderazgo: 0.35,
      serenidad: 0.20,
      disciplina: 0.15,
      trabajoEquipo: 0.15,
      posicionamiento: 0.10,
      resistencia: 0.05
    },
    aprendizaje: {
      factorMinimo: 0.80,
      factorMaximo: 1.20,
      pesoLiderazgo: 0.40,
      pesoSerenidad: 0.25,
      pesoDisciplina: 0.20,
      pesoTrabajoEquipo: 0.15
    },
    efectos: [
      { minimo: 80, maximo: 99, moral: 1, cohesion: 2 },
      { minimo: 40, maximo: 79, moral: 0, cohesion: 1 },
      { minimo: 20, maximo: 39, moral: -1, cohesion: 0 },
      { minimo: 0, maximo: 19, moral: -3, cohesion: -2 }
    ]
  },
  equilibrioBots: {
    // Nivelación competitiva de equipos bots. Evita que desde la segunda temporada queden muy por debajo del club manejado.
    activo: true,
    // suave | normal | dificil
    dificultad: 'dificil',
    soloDivisionManager: true,
    nivelarAlInicioTemporada: true,
    mantenerDuranteTemporada: true,
    intervaloMantenimientoFechas: 2,
    // Los mejores bots de la temporada anterior reciben un plus; los peores, un margen menor.
    bonusMaximoPorPosicion: 8,
    pisoMoral: 65,
    pisoFisico: 76,
    pisoCohesion: 70,
    margenMoral: 8,
    margenFisico: 6,
    margenCohesion: 10,
    recuperacionFisicaPorMantenimiento: 8,
    recuperacionMoralPorMantenimiento: 5,
    recuperacionCohesionPorMantenimiento: 4,
    // Recupera desgaste acumulado de equipos bots. Evita que lleguen al simulador con tope físico 1 por arrastre de temporada.
    recuperacionDesgasteDiariaBot: 4,
    desgasteMaximoBotAntesDePartido: 38,
    pisoFisicoBotAntesDePartido: 58,
    desarrolloPlantelPorTemporada: 0.14,
    bonusDesarrolloPorPosicion: 0.08,
    maximoBoostBotPorHabilidad: 12,
    // Cada bot rota perfiles tácticos de forma determinista. Los clubes no parten todos del mismo perfil.
    tacticasVariadas: {
      activo: true,
      rotacionCadaFechas: 1
    },
    // Antes de enfrentar al manager, el bot audita sus mejores futbolistas y elige una formación que pueda incluirlos.
    tacticaContraManager: {
      priorizarMejoresJugadores: true,
      cantidadMejoresJugadores: 5,
      bonusInclusionMejorJugador: 5000,
      auditarCobertura: true
    },
    tacticaRapida: {
      sobreexigenciaSiPierde: true,
      reglasDiferencia: [
        { diferenciaMin: 1, diferenciaMax: 1, desgasteFisicoPct: 0.20, bonusAtaquePct: 0.10 },
        { diferenciaMin: 2, diferenciaMax: 2, desgasteFisicoPct: 0.30, bonusAtaquePct: 0.20 },
        { diferenciaMin: 3, diferenciaMax: 99, desgasteFisicoPct: 0.50, bonusAtaquePct: 0.30 }
      ],
      maxGolesExtraPorEquipo: 1
    }
  },
  economia: {
    pagosPorResultadoLiga: {
      activo: true,
      reputacionMinima: 10,
      reputacionMaxima: 100,
      pagoVictoriaPorPuntoReputacion: 8000,
      pagoEmpatePorPuntoReputacion: 3000,
      variacionMinima: 0.75,
      variacionMaxima: 1.25,
      redondeo: 5000,
      pagoDerrota: 0
    },
    gastosMensuales: {
      activo: true,
      // Impuesto mensual de riqueza aplicado únicamente al club dirigido por el mánager.
      impuestoGananciasPct: 0.08,
      electricidadBasePorPartido: 100000,
      electricidadPorCapacidadPorPartido: 10,
      limpiezaPorHinchaPorPartido: 10
    },
    escalaSueldosYClausulas: 0.10,
    // Escala histórica previa al balance de extremos.
    escalaClausulas: 0.10,
    // V8.50: cada cláusula se mueve un 50% hacia un valor central equivalente a 16 sueldos anuales.
    // Esto eleva especialmente las cláusulas demasiado bajas y reduce las más altas sin invertir la jerarquía.
    clausulaMultiplicadorCentral: 16,
    clausulaCompresionExtremos: 0.50,
    reduccionBaseSueldoFinTemporada: 0.05,
    bonusSueldoPorPartidoJugado: 0.01,
    banco: {
      activo: true,
      bancos: [
        { nombre:'Banco Nación', interes:0.32 },
        { nombre:'Banco Provincia', interes:0.36 },
        { nombre:'Banco Galicia', interes:0.41 },
        { nombre:'Santander', interes:0.44 },
        { nombre:'BBVA', interes:0.43 },
        { nombre:'Banco Macro', interes:0.47 },
        { nombre:'Banco Credicoop', interes:0.34 },
        { nombre:'ICBC', interes:0.39 },
        { nombre:'Banco Supervielle', interes:0.46 },
        { nombre:'Banco Comafi', interes:0.50 }
      ],
      montos: [
        { monto:50000000, prestigio:1 },
        { monto:500000000, prestigio:5 },
        { monto:1500000000, prestigio:20 }
      ],
      plazosSemanas: [24,48,172]
    }
  },
  sponsors: {
    // sistema fijo por temporada + sponsor especial con condición.
    factorValorBase: 0.1,
    porcentajeSponsorsLocales: 0.50,
    multiplicadorPrestigioLigaMinimo: 0.70,
    multiplicadorPrestigioLigaMaximo: 1.30,
    multiplicadorPosicionTablaMinimo: 0.80,
    multiplicadorPosicionTablaMaximo: 1.20,
    ofertasMinimasPorTemporada: 20,
    ofertasMaximasPorTemporada: 40,
    ofertasVencenEnDias: 5,
    ofertasPorLlegadaMin: 1,
    ofertasPorLlegadaMax: 3,
    probabilidadLlegadaTriple: 0.45,
    duracionOfertaMinDias: 30,
    duracionOfertaMaxDias: 700,
    sponsorEspecialActivo: true,
    probabilidadSponsorEspecial: 0.22,
    multiplicadorBonoEspecial: 3,
    condicionesEspeciales: [
      { id:'low_player_starter_6_10', nombre:'Apuesta al tapado', descripcion:'Un jugador de muy bajo nivel debe ser titular 6 de los próximos 10 partidos.', partidosObjetivo:10, titularesObjetivo:6, mediaMaxima:55 },
      { id:'clean_sheets_4', nombre:'Valla invicta', descripcion:'No recibir goles en los próximos 4 partidos.', partidosObjetivo:4 },
      { id:'win_4_5', nombre:'Racha ganadora', descripcion:'Ganar 4 de los próximos 5 partidos.', partidosObjetivo:5, victoriasObjetivo:4 },
      { id:'no_reds_5', nombre:'Juego limpio', descripcion:'No recibir tarjetas rojas en los próximos 5 partidos.', partidosObjetivo:5 },
      { id:'field_98_30', nombre:'Campo impecable', descripcion:'Mantener el campo de juego por encima de 98 durante 30 días.', diasObjetivo:30, minimoCampo:98 },
      { id:'lose_5_5', nombre:'Campaña incómoda', descripcion:'Perder los próximos 5 partidos.', partidosObjetivo:5, derrotasObjetivo:5 }
    ]
  },
  mercado: {
    // Impuesto federativo sobre ventas de jugadores. 0.30 = el club recibe 70% neto.
    impuestoAfaTraspasos: 0.30,
    // Siglas usadas en mensajes de ofertas según país/liga del club comprador.
    federacionesTraspaso: {
      Argentina:'AFA',
      Chile:'ANFP',
      Brasil:'CBF',
      Inglaterra:'FA',
      España:'RFEF',
      Italia:'FIGC',
      Rumania:'FRF'
    },
    // Ofertas automáticas y ofertas al ofrecer jugadores: nunca superan este % de la cláusula.
    ofertaJugadoresMinPorcentajeClausula: 0.10,
    ofertaJugadoresMaxPorcentajeClausula: 0.30,
    ofertasJugadoresRequierenPartidos: true,
    ofertasJugadoresRequierenGolOAsistencia: true,
    // Un jugador del club puede ofrecerse manualmente cuando disputó 6 partidos o más. No exige haber cobrado un sueldo.
    partidosNecesariosParaOfrecerJugador: 6,
    // Bonificaciones porcentuales sobre la cláusula al calcular una oferta.
    // Se derivan de estadísticas ya existentes; no agregan atributos nuevos al jugador.
    valorOfertaJugador: {
      partidosParaBonoMaximo: 24,
      bonoMaximoPartidos: 8,
      bonoPorGol: 1.5,
      bonoMaximoGoles: 12,
      bonoPorAsistencia: 1.25,
      bonoMaximoAsistencias: 10,
      bonoMaximoRendimiento: 8,
      bonoMaximoOjeo: 5
    },
    ofertaMinimaEstrellaParaVentaPct: 60,

    // Bloqueo de presupuesto para fichajes. Sólo limita compras de jugadores; el resto del presupuesto queda disponible para gastos del club.
    presupuestoFichajesActivo: true,
    presupuestoFichajesMaximoPorcentaje: 0.50,
    presupuestoFichajesDivision3: 0.25,
    presupuestoFichajesDivision2: 0.35,
    presupuestoFichajesDivision1: 0.40,
    desbloqueoSuperarObjetivo: 0.05,
    desbloqueoPromedio15: 0.05,
    desbloqueoPromedio19: 0.10,
    desbloqueoAscenso: 0.10,
    desbloqueoCampeon: 0.15,
    porcentajeVentaLiberadoFichajes: 0.70,

    // Oferta especial de cláusula: entre 1 y 2 veces en las últimas fechas, un club de la misma liga puede pagar la cláusula de uno de los 3 mejores jugadores del plantel.
    ofertaClausulaEspecialActiva: true,
    ofertaClausulaEspecialFechasFinales: 10,
    ofertaClausulaEspecialMinPorTemporada: 1,
    ofertaClausulaEspecialMaxPorTemporada: 2,
    ofertaClausulaEspecialTopJugadores: 3,
    // Ventanas del mercado profesional. No restringen libres ni juveniles de Academia.
    ventanaPrincipalInicioDia: 355,
    ventanaPrincipalFinDia: 30,
    ventanaMitadInicioDia: 151,
    ventanaMitadFinDia: 178,
    // Toda oferta por cláusula conserva cinco días completos para aceptar o intentar convencer al jugador.
    ofertaClausulaRespuestaDias: 5
  },
  estadio: {
    costoReplantarCesped: 2000000,
    diasReplantarCesped: 35,
    costoParchearCampo: 200000,
    diasParchearCampo: 21,
    mejoraParchePorAvance: 5,
    // Sanción económica automática de AFA cuando el campo dirigido cae por debajo del umbral.
    afaCampoSancionActiva: true,
    afaCampoUmbral: 10,
    afaCampoMulta: 1000000,
    afaCampoReplanteObligatorio: 4000000,
    afaCampoEstadoRestaurado: 100,
    afaCampoDiasRestauracion: 1,
    // El deterioro normal del campo se multiplica por este valor.
    deterioroCampoMultiplicador: 2,
    // Cada cambio de temporada el estadio del club dirigido pierde este porcentaje de capacidad actual.
    // La capacidad estructural alcanzada no disminuye y sigue habilitando las ampliaciones en orden.
    deterioroCapacidadPorTemporadaPct: 1,
    // Reparación de aforo deteriorado. El costo por asiento toma como referencia la siguiente ampliación
    // y aplica este porcentaje para que reparar sea más barato que construir lugares nuevos.
    reparacionCapacidadFactorCostoAmpliacion: 0.25,
    reparacionCapacidadCostoMinimo: 1000000,
    reparacionCapacidadLugaresPorDia: 20,
    reparacionCapacidadDiasMinimos: 14,
    reparacionCapacidadDiasMaximos: 180,
    reparacionCapacidadPenalizacionAsistencia: 0.10,
    clima: {
      lluviaDeterioroActivo: true,
      lluviaLeveExtraDeterioro: 3,
      lluviaIntensaExtraDeterioro: 7
    },
    // Los equipos bots no degradan su campo durante la temporada: reciben un estado fijo al iniciar cada temporada.
    botsCampoFijoPorTemporada: true,
    botsCampoMinimo: 30,
    botsCampoMaximo: 95,
    botsCampoBaseInicial: 58,
    botsCampoRangoPorPosicion: 42,
    // Reparación defensiva: si los campos bots quedan debajo del mínimo, se consideran datos corruptos y se regeneran.
    botsCampoAutoRepararEstadosInvalidos: true,
    botsCampoUmbralInvalido: 29,
    botsCampoPorcentajeMasivoInjugable: 0.60,
    // Entradas, hinchadas y ventaja local.
    precioEntradaInicial: 100,
    precioEntradaMinimo: 10,
    precioEntradaMaximo: 500,
    // Precio automático sólo para clubes bots locales según prestigio del rival.
    // Bajo: precio base. Medio: +50% a +100%. Alto: +100% a +500%.
    precioEntradaBotAutomatico: true,
    precioEntradaBotPrestigioBajoHasta: 39,
    precioEntradaBotPrestigioMedioHasta: 69,
    precioEntradaBotMultiplicadorMedioMin: 1.50,
    precioEntradaBotMultiplicadorMedioMax: 2.00,
    precioEntradaBotMultiplicadorAltoMin: 2.00,
    precioEntradaBotMultiplicadorAltoMax: 5.00,
    precioEntradaBotRedondeo: 10,
    porcentajeVisitanteMinimo: 0.07,
    porcentajeVisitanteMaximo: 0.10,
    porcentajeVisitanteMaximoConFaltanteLocal: 0.50,
    hinchasPorPuntoBonusLocal: 1000,
    bonusLocalMaximo: 50,
    // Crecimiento de hinchas V8.34: base comprimida para equilibrar clubes grandes, pequeños y fundados.
    hinchasMasaBase: 12,
    hinchasMasaActualRaiz: 0.45,
    hinchasMasaVitaliciosRaiz: 0.05,
    hinchasFactorVictoria: 0.80,
    hinchasFactorEmpate: 0,
    hinchasFactorDerrota: -0.65,
    hinchasFactoresPosicion: [
      { desde:1, hasta:1, factor:0.70 },
      { desde:2, hasta:2, factor:0.55 },
      { desde:3, hasta:4, factor:0.40 },
      { desde:5, hasta:6, factor:0.25 },
      { desde:7, hasta:10, factor:0 },
      { desde:11, hasta:14, factor:-0.15 },
      { desde:15, hasta:18, factor:-0.30 },
      { desde:19, hasta:100, factor:-0.45 }
    ],
    hinchasPerdidaMaximaMinima: 8,
    hinchasPerdidaMaximaPorcentaje: 0.006,
    entradaBarataProteccionPerdidaMaxima: 0.35,
    entradaCaraBloqueoGananciaMaxima: 0.40,
    hinchasPrestigioDiferenciaMaxima: 50,
    hinchasPrestigioBonusVictoriaMaximo: 0.20,
    hinchasPrestigioPenalVictoriaInferiorMaximo: 0.15,
    hinchasPrestigioProteccionDerrotaMaxima: 0.20,
    hinchasPrestigioPenalDerrotaInferiorMaxima: 0.15,
    // Aumento de demanda de entradas por prestigio del rival. 0.35 = hasta +35% de público potencial.
    bonusAsistenciaPrestigioRivalMaximo: 0.35,
    // Desde este prestigio del rival empieza a notarse el aumento de interés por el partido.
    bonusAsistenciaPrestigioRivalDesde: 20,
    // Proporción del bonus que también empuja demanda visitante/neutral.
    bonusAsistenciaPrestigioRivalVisitante: 0.50,
    // Multiplica la duración base de las ampliaciones de estadio. Ejemplo: 1 día base x 30 = 30 días reales de obra.
    multiplicadorDiasObras: 30,

    // Campañas para sumar socios. La UI muestra inversión y duración; los socios diarios y totales quedan ocultos.
    campaniasSocios: [
      { id:'marketing_50m_60d', nombre:'Campaña barrial de socios', inversion: 50000000, diasDuracion: 60, sociosDiaMin: 10, sociosDiaMax: 15 },
      { id:'marketing_500m_90d', nombre:'Campaña masiva de afiliación', inversion: 500000000, diasDuracion: 90, sociosDiaMin: 35, sociosDiaMax: 50 },
      { id:'marketing_100m_10d', nombre:'Operativo relámpago de socios', inversion: 100000000, diasDuracion: 10, sociosDiaMin: 30, sociosDiaMax: 50 }
    ]
  },
  empleados: {
    // Los valores base de empleados regulares se mantienen; las categorías se cargan desde data/empleados.json.
    psicologoCosto: 500000,
    psicologoProbabilidadExito: 0.90,
    psicologoCooldownDias: 35,
    // Ganancia de moral por charla exitosa antes del multiplicador de categoría del empleado.
    psicologoMoralMin: 6,
    psicologoMoralMax: 10,
    kinesiologoCosto: 1000000,
    kinesiologoProbabilidadFallo: 0.20,
    // Tratamiento automático: se cobra una sola vez por lesión según los días diagnosticados.
    kinesiologoCostoAutomaticoPorDiaLesion: 2000,
    kinesiologoProbabilidadExitoPorCategoria: { regular:0.80, bueno:0.90, elite:0.98 },
    kinesiologoTrabajoDiferenciado: {
      recuperacionDesgasteDiaria: 4,
      recuperacionFormaDiaria: 5,
      recuperacionMoralDiaria: 1,
      reduccionLesionPorCategoria: { regular: 0.40, bueno: 0.55, elite: 0.85 }
    },
    preparadorJuvenilesCosto: 1000000,
    // El segundo entrenador se paga por la temporada completa. Su nivel sólo modifica el tiempo entre informes.
    segundoEntrenador: {
      costosAnuales: { regular:2000000, bueno:7000000, elite:23000000 },
      diasAnalisis: { regular:25, bueno:18, elite:10 }
    }
  },
  academia: {
    costoCaptacion: 1000000,
    diasCaptacion: 35,
    jugadoresMinimosPorCaptacion: 5,
    jugadoresMaximosPorCaptacion: 10,
    costoJugadorPorAvance: 10000,
    diaCobroSemanalJuveniles: 1, // 1 = lunes. Los juveniles cobran una vez por semana.
    compensacionDespido: 50000,
    multiplicadorEntrenamiento: 5,
    multiplicadorEntrenamientoJuvenilExcepcional: 5,
    juvenilExcepcionalPorTemporada: true,
    edadJuvenilExcepcional: 16,
    edadJuvenilMin: 12,
    edadJuvenilMax: 16,
    edadUltimaTemporadaAcademia: 17,
    mediaJuvenilExcepcionalMin: 12,
    mediaJuvenilExcepcionalMax: 40,
    mediaMaximaCreacionBase: 30,
    mediaMaximaCreacionBonusEdad: 3,
    crecimientoTemporadaMin: 7,
    crecimientoTemporadaMax: 11,
    crecimientoExcepcionalTemporadaMin: 15,
    crecimientoExcepcionalTemporadaMax: 20,
    cupoBaseJuveniles: 10,
    residenciaCuposJuveniles: 20,
    residenciaCostoMensual: 560000,
    // Cantidad base de habilidades reveladas por informe del preparador.
    multiplicadorConsultaJuveniles: 1,
    // Lesiones juveniles por temporada. Mientras están lesionados no entrenan.
    lesionesJuvenilesMinPorTemporada: 1,
    lesionesJuvenilesMaxPorTemporada: 2,
    lesionJuvenilDiasMin: 14,
    lesionJuvenilDiasMax: 42,
    mercadoJuvenil: {
      activo: true,
      edadOfertas: 17,
      impuestoFederacion: 0.05,
      valorMinimo: 20000,
      valorMaximo: 5000000,
      diasVencimientoOferta: 5,
      diasEntreIntentos: 14,
      probabilidadPorIntento: 0.45,
      diasEsperaTrasRechazo: 30,
      maxOfertasPendientes: 4,
      maxOfertasPorJugadorTemporada: 4,
      plantelObjetivoBot: 24
    },
    derechosEconomicos: {
      activo: true,
      diasEntreRevisionesBot: 30,
      diasMinimosAntesVentaBot: 180,
      probabilidadVentaBotPorRevision: 0.18,
      ofertaBotMinPctClausula: 60,
      ofertaBotMaxPctClausula: 100
    }
  },
  entrenamiento: {
    // Al avanzar se aplican sólo los bloques correspondientes al día actual.
    aplicarSoloDiaActual: true,
    efectividadPorCasilla: 0.25,
    // Quinto entrenamiento diario: se aplica individualmente a cada jugador una vez por día.
    entrenamientoIndividualDiario: true,
    efectividadIndividualPorDia: 0.25,
    entrenamientoIndividualInicial: 'balanced',
    // Curva de dificultad: una habilidad alta reduce la probabilidad final de subir +1.
    // Ejemplo: habilidad 80 => 20% de probabilidad final si ya superó la tirada base.
    curvaHabilidadActual: true,
    probabilidadMinimaSubidaHabilidad: 0,
    // Multiplicador directo de velocidad para boosts temporales de habilidades profesionales.
    // Las habilidades base del profesional no cambian; los boosts se reducen al 30% al cerrar temporada.
    multiplicadorSubidaHabilidades: 2,
    planSemanalInicial: {
      pre: 'regenerative',
      morning: 'intense',
      afternoon: 'tactical',
      night: 'dayoff'
    },
    desgaste: {
      activo: true,
      maximo: 98,
      desgasteMinPartido: 2,
      desgasteMaxPartido: 4,
      desgastePorTurnoIntenso: 1,
      recuperacionPorTurnoMasajista: 1
    }
  },

  simulador: {
    // V9.89 · Simulador Nuevo V1.
    // 360 fases internas de 15 segundos: decisión -> destino/zona -> respuesta defensiva -> resolución.
    motorContinuoV974: {
      activo: true,
      fasesPorPartido: 360,
      segundosPorFase: 15,
      logTecnico: false,
      maxLogTecnico: 360,
      distancias: {
        paseCortoMax: 34,
        paseLargoMin: 25,
        paseLargoMax: 78,
        paseProfundoAvanceMin: 12,
        radioPresion: 20,
        radioMarcaje: 18,
        radioIntercepcion: 12
      },
      accionesBase: {
        paseCorto: 36,
        paseLargo: 12,
        paseProfundo: 10,
        centro: 6,
        tiro: 4,
        regate: 12
      },
      // 7 fases de 15 s: ventana de contraataque de aproximadamente 105 segundos.
      contraataqueFases: 7,
      // Aumenta la elección de acciones verticales/ofensivas para aproximar 2x ataques totales.
      multiplicadorIntencionAtaque: 1.60,
      // V9.89: recalibrado para 360 fases y el nuevo xG logístico.
      multiplicadorConversionVolumen: 0.95,
      // V9.81 · La posesión puede convertirse en una herramienta defensiva real.
      // La duración objetivo depende de calidad de pase, superioridad técnica,
      // densidad de mediocampo y las instrucciones Posesión / Cuidar resultado.
      controlPosesion: {
        activo: true,
        calidadMinima: 68,
        pasesObjetivoBase: 2,
        coefCalidad: 0.30,
        coefVentajaCalidad: 0.12,
        coefMedioExtra: 1.00,
        bonusCuidarResultado: 6,
        bonusBajarRitmoResultado: 2,
        pasesObjetivoMax: 26,
        bonusSeguridadPaseMax: 18
      },
      ventajaLocalMaxPct: 0.08,
      azarPuja: 13,
      nuevoV1: {
        activo: true,
        columnasZonas: 6,
        filasZonas: 4,
        movimientoPorFase: 0.38,
        desplazamientoAtaque: 8.0,
        desplazamientoDefensa: 5.0,
        compactacionLateralDefensa: 0.34,
        presionJugadoresCercanos: 2,
        // V9.90: el bloque acompaña la construcción y avanza de forma acumulativa con los pases.
        avanceBloqueMaximo: 15,
        avanceBloquePorPase: 0.70,
        avanceExtraPaseProgresivo: 0.13,
        carreraRecepcionMax: 3.6,
        // V9.91: delanteros sin balón respetan la línea dinámica del defensor rival más retrasado.
        lineaOffsideActiva: true,
        margenLineaOffside: 0.85,
        movimientoPostAccion: 0.66,
        pesoAmenazaDestino: 42,
        // V9.92: más paredes/circulación corta dentro de la misma zona conforme madura la posesión.
        bonusPaseCortoMismaZonaBase: 0.18,
        bonusPaseCortoMismaZonaProgresion: 0.75,
        bonusReceptorMismaZona: 26,
        // V9.92: los jugadores ubicados como DC/EI/ED intentan más regates y remates.
        multiplicadorRegateDelanteros: 1.55,
        multiplicadorTiroDelanteros: 1.75,
        escalaLogitPase: 9.5,
        escalaLogitRegate: 8.5,
        xgMaximo: 0.58
      }
    },
    // Equilibrio del resultado de cada ocasión: mitad construcción colectiva y mitad duelo individual.
    // Se aplica al partido normal, al simulador en vivo y a Ver solo resultados.
    pesoColectivo: 0.50,
    pesoIndividual: 0.50,
    // Reduce goles de defensores en jugadas normales. Siguen pudiendo marcar en pelota parada.
    probabilidadPelotaParada: 0.14,
    // los errores dependen del jugador implicado. Se usa la seguridad del jugador: (moral + físico + media + cohesión) / 400.
    // El riesgo real de error es 1 - seguridad, para que mejores valores reduzcan errores.
    formulaErroresJugador: true,
    escalaRiesgoErrorJugador: 0.72,
    // Cuando un gol rival ocurre, esta probabilidad lo atribuye también como error de gol a un defensor o arquero.
    probabilidadGolAtribuyeErrorGol: 0.60,
    // Probabilidad base anterior mantenida como respaldo si se desactiva formulaErroresJugador.
    // Máximo de errores usado para evitar partidos rotos por errores constantes.
    maximoErroresPorEquipo: 5,
    // multiplicador de pérdida física minuto a minuto del simulador vivo. 2 = doble fatiga.
    fatigaVivaMultiplicador: 5,
    // Reducción general de amarillas generadas por los simuladores.
    multiplicadorTarjetas: 0.70,
    // Reducción adicional para rojas directas. Se combina con multiplicadorTarjetas.
    multiplicadorRojasDirectas: 0.55,
    // Penalización progresiva por volumen total de tarjetas entre ambos equipos.
    penalizacionTarjetasAltas: {
      activo: true,
      amarillas: [
        { tarjetasTotalesDesde: 6, penalizacion: 0.30 },
        { tarjetasTotalesDesde: 7, penalizacion: 0.40 },
        { tarjetasTotalesDesde: 8, penalizacion: 0.50 },
        { tarjetasTotalesDesde: 9, penalizacion: 0.80 }
      ],
      rojasDirectas: [
        { tarjetasTotalesDesde: 2, penalizacion: 0.40 },
        { tarjetasTotalesDesde: 3, penalizacion: 0.50 },
        { tarjetasTotalesDesde: 4, penalizacion: 0.60 },
        { tarjetasTotalesDesde: 5, penalizacion: 0.90 }
      ]
    },
    // con esta cantidad de rojas para un equipo, el partido se suspende y pierde 0-3.
    rojasDerrotaDefault: 5,
    // Reduce la conversión de cada gol potencial y endurece progresivamente la penalización cuando el marcador global aumenta.
    // Cada tramo se aplica al gol que llevaría el total del partido al valor indicado o superior.
    penalizacionGolesAltos: {
      activo: true,
      tramos: [
        { golesTotalesDesde: 1, penalizacion: 0.10 },
        { golesTotalesDesde: 6, penalizacion: 0.40 },
        { golesTotalesDesde: 7, penalizacion: 0.50 },
        { golesTotalesDesde: 8, penalizacion: 0.60 },
        { golesTotalesDesde: 9, penalizacion: 0.70 },
        { golesTotalesDesde: 10, penalizacion: 0.80 },
        { golesTotalesDesde: 11, penalizacion: 0.90 },
        { golesTotalesDesde: 12, penalizacion: 0.95 }
      ]
    },
    // Estrellas de referencia: aumentan el peso del jugador dentro del simulador.
    estrellasMaximasPorEquipo: 3,
    estrellasPartidosVentana: 10,
    estrellaGoleadorPartidosConGol: 3,
    estrellaArqueroPartidosConTapadaClave: 3,
    estrellaMediocampistaAsistencias: 3,
    estrellaBonusReferencia: 0.30,
    // balance físico postpartido. Recuperación automática reducida a un tercio y desgaste ampliado.
    recuperacionAutomaticaPostPartidoMin: 4,
    recuperacionAutomaticaPostPartidoMax: 6,
    // si está activo, la recuperación postpartido usa la resistencia del jugador.
    // El rango 61-70 queda como puente para evitar saltos bruscos.
    recuperacionPostPartidoUsaResistencia: true,
    recuperacionPostPartidoPorResistencia: [
      { minResistencia: 1, maxResistencia: 40, recuperacionMin: 0, recuperacionMax: 1 },
      { minResistencia: 41, maxResistencia: 60, recuperacionMin: 2, recuperacionMax: 4 },
      { minResistencia: 61, maxResistencia: 70, recuperacionMin: 3, recuperacionMax: 5 },
      { minResistencia: 71, maxResistencia: 80, recuperacionMin: 4, recuperacionMax: 7 },
      { minResistencia: 81, maxResistencia: 90, recuperacionMin: 6, recuperacionMax: 9 },
      { minResistencia: 91, maxResistencia: 99, recuperacionMin: 12, recuperacionMax: 20 }
    ],
    desgastePartidoMin: 40,
    desgastePartidoMax: 78,
    // Reduce el consumo base del partido según la resistencia.
    // Los modificadores extra por campo, táctica o instrucciones se mantienen aparte.
    desgastePartidoUsaResistencia: true,
    desgastePartidoPorResistencia: [
      { minResistencia: 1, maxResistencia: 59, reduccion: 0.00 },
      { minResistencia: 60, maxResistencia: 69, reduccion: 0.10 },
      { minResistencia: 70, maxResistencia: 79, reduccion: 0.20 },
      { minResistencia: 80, maxResistencia: 89, reduccion: 0.30 },
      { minResistencia: 90, maxResistencia: 99, reduccion: 0.40 }
    ],
    factorDesgasteArquero: 0.5
  },

  tactica: {
    estilosSector: {
      activo: true,
      defensaInicial: 'posicional',
      mediosInicial: 'posicional',
      delanterosInicial: 'posicional',
      // Intensidad general del impacto de estilos sectoriales en el simulador. 1 = normal, 0.5 = suave.
      intensidadEfecto: 0.85,
      // Cansancio diario aplicado al finalizar el partido por estilos exigentes.
      cansancioPresionAlta: -3,
      cansancioRotacion: -1,
      cansancioRepliegue: -1
    }
  },
  dificultad: {
    partidosReferenciaTemporada: 34,
    umbralParticipacionLesionLarga: 0.80,
    probabilidadLesionLargaMin: 0.35,
    probabilidadLesionLargaMax: 0.65,
    pesoLesionLargaAltaParticipacion: 0.90,
    lesionLargaMinDias: 90,
    adaptacionTactica: {
      activo: true,
      partidosSinPenalizacion: 3,
      bonusRivalPorRepeticion: 0.03,
      bonusRivalMaximo: 0.12
    },
    moralSuplentes: {
      perdidaPorPartidoPerdido: 1,
      perdidaMaximaPorPartido: 12,
      partidosSinJugarMaximoContador: 20
    }
  },

  lesiones: {
    // Probabilidad general del sistema. V8.43 elevó moderadamente la frecuencia efectiva.
    multiplicadorProbabilidad: 0.30,
    lesionBase: 0.05,
    fatigaPaso: 5,
    fatigaBonus: 0.01,
    // Ajustes por contexto de partido.
    multiplicadorBots: 0.50,
    partidosProteccionManager: 50,
    multiplicadorManagerPrimerosPartidos: 0.75,
    multiplicadorSimuladorVivo: 0.75,
    multiplicadorSimulacionRapida: 0.85,
    // Pesos relativos de aparición. Deben sumar 100.
    pesoContusion: 34,
    pesoDistension: 30,
    pesoDesgarro: 20,
    pesoEsguince: 10,
    pesoRotura: 5,
    pesoFractura: 1,
    // Duraciones en días. El motor las convierte a turnos según diasPorAvance.
    contusionMinDias: 7,
    contusionMaxDias: 21,
    distensionMinDias: 21,
    distensionMaxDias: 56,
    desgarroMinDias: 28,
    desgarroMaxDias: 84,
    esguinceMinDias: 35,
    esguinceMaxDias: 105,
    roturaMinDias: 90,
    roturaMaxDias: 210,
    fracturaMinDias: 180,
    fracturaMaxDias: 400,
    lesionadoSuplenteDiasMax: 63,
    penalizacionLesionadoSuplente: 0.30,
    // Control silencioso del primer equipo: las lesiones de partido cuentan primero y
    // sólo se agregan lesiones de entrenamiento cuando el club queda por debajo del ritmo mínimo.
    minimoPrimerEquipoPorTemporada: 30,
    compensacionEntreSemanaActiva: true,
    compensacionIntervaloMinimoDias: 3,
    compensacionMaxLesionadosSimultaneos: 5,
    compensacionMinimoJugadoresDisponibles: 14,
    compensacionDescansoRepeticionJugadorDias: 21,
    compensacionForzarUltimosDias: 7
  },

  eventos: {
    // Una crisis comienza cuando el ánimo medio o el funcionamiento colectivo cae por debajo de 50.
    // Luego se controla cada 5 días hasta que ambos indicadores vuelven a 50 o más.
    // Cada control conserva 30% de probabilidad, pero una racha de 20 días sin evento fuerza el siguiente control.
    // Si aparece un evento, el calendario queda detenido hasta que el manager elija una respuesta.
    vestuarioMoralUmbral: 50,
    vestuarioCohesionUmbral: 50,
    vestuarioIntervaloDias: 5,
    vestuarioProbabilidad: 0.30,
    vestuarioGarantiaDias: 20,
    vestuarioEventosRecientes: 5,
    problemasVestuario: []
  },


  comunidad: {
    discord: {
      activo: true,
      inviteCode: 'MStvBW9RR',
      inviteUrl: 'https://discord.gg/MStvBW9RR',
      // Se consulta como máximo una vez cada cinco minutos mientras Inicio está visible.
      refreshMs: 300000
    }
  },

  ranking: {
    // URL publicada para enviar y leer resultados del ranking online.
    appsScriptUrl: 'https://rankingdemanagers.emanuelastudillo.workers.dev',
    // Token opcional. Si el Worker exige login, pegar acá el token y el juego lo envía como Bearer.
    token: '',
    // El Worker actual exige sesión para subir récords. El front guarda el token en localStorage tras iniciar sesión.
    requiereLogin: true,
    // Contrato único del Worker V8.32.
    submitPaths: ['ranking/career'],
    // Autenticación explícita: iniciar sesión y registrar son operaciones separadas.
    loginPaths: ['auth/login'],
    registerPath: 'auth/register',
    passwordPath: 'auth/password',
    mePaths: ['auth/me'],
    readPaths: ['ranking/career'],
    resultadosPorPagina: 100,
    cooldownCargaDias: 50,
    // La carrera aparece apenas se completa esta cantidad de partidos oficiales.
    primerEnvioPartidosOficiales: 1,
    // Refresco periódico mientras el jugador continúa avanzando la carrera.
    intervaloAutomaticoDiasJuego: 50,
    // Si el jugador vuelve otro día real y la carrera cambió, se refresca aunque no hayan pasado 50 días de juego.
    refrescoActividadHorasReales: 24,
    // Espera mínima antes de repetir un envío fallido en la misma fecha de juego.
    reintentoAutomaticoMinutos: 2,
    // Margen seguro para no chocar con el límite real del Worker entre actualizaciones de una misma carrera.
    esperaServidorSegundos: 65,
    // Controles fijos adicionales para detectar saltos largos de calendario.
    diasAutomaticosCarrera: [150, 250, 350],
    nombreRanking: 'Ranking Online'
  },

  desafiosOnline: {
    activo: true,
    // Usa el mismo Worker y la misma cuenta del Ranking Online.
    // El Worker V8.32 calcula los partidos y rankings de forma autoritativa.
    endpoint: 'https://rankingdemanagers.emanuelastudillo.workers.dev',
    versionSimulador: 'challenge-sim-v2-server',
    resultadosPorPagina: 100,
    actualizacionMs: 30000,
    // No existe máximo de partidos disputados. Diez encuentros habilitan la clasificación oficial.
    partidosMinimosRanking: 10,
    rivalesMinimosPremio: 5,
    historialRankingPorPagina: 100,
    // Temporadas globales de 10 días reales. El inicio se fija en UTC para que todos compartan el mismo ciclo.
    cicloCompetenciaDias: 10,
    cicloCompetenciaInicioUtc: '2026-07-19T00:00:00.000Z',
    premiosCiclo: {
      A:[3000,1500,750],
      N:[3000,1500,750],
      P:[3000,1500,750],
      C:[3000,1500,750],
      E:[3000,1500,750],
      L:[6000,2500,1000]
    },
    rewardStatusPath:'challenges/rewards/status',
    rewardClaimPath:'challenges/rewards/claim',
    categoriasSalariales: [
      { codigo:'A', nombre:'Ascenso', minimo:0, maximo:5000000 },
      { codigo:'N', nombre:'Nacional', minimo:5000001, maximo:10000000 },
      { codigo:'P', nombre:'Profesional', minimo:10000001, maximo:20000000 },
      { codigo:'C', nombre:'Continental', minimo:20000001, maximo:45000000 },
      { codigo:'E', nombre:'Élite', minimo:45000001, maximo:100000000 },
      { codigo:'L', nombre:'Libre', minimo:0, maximo:null, libre:true }
    ],
    // V9.71: publicar y aceptar comparten una tanda de acciones. Las primeras 10 no tienen espera.
    accionesSinBloqueo: 10,
    // Al completar la tanda se aplica una pausa local de 10 minutos.
    cooldownAccionMinutos: 10
  },

  mensajesAsistente: {
    activo: true,
    frecuenciaDias: 12,
    titulo: 'Consejo del asistente',
    consejos: [
      'Hola #usuario#, cómo vas con eso de las cláusulas? Son una locura. Al menos nos protegen de que nos quiten jugadores, pero realmente nadie nunca las paga. Si ves que necesitás dinero, que no te asuste que paguen poco. Saludos.',
      'Siempre es bueno estar en los partidos. No digas que te dije, pero tu ayudante no tiene el espíritu para sacar lo mejor del equipo. Desde la cabina de video y GPS vemos todo.',
      '#usuario#, mirá de reojo el estado físico. A veces un jugador pide cancha con la cara, pero las piernas ya están negociando la rendición.',
      'Hay jugadores que parecen suplentes eternos hasta que los necesitás. No los castigues de más por una mala semana; el vestuario también se arma desde el banco.',
      'Si un jugador quiere irse, escuchalo antes de pelearte con todos. A veces una charla calma más que una multa o una promesa grande.',
      'La academia no siempre entrega estrellas. A veces entrega paciencia. Y la paciencia, aunque no salga en los informes, también gana partidos.',
      'Cuidado con comprar sólo por media. Hay jugadores que ordenan, otros que corren, otros que no se esconden. La planilla no siempre cuenta toda la historia.',
      'Cuando el equipo gana, todos parecen tácticamente brillantes. Cuando pierde, todos piden cambios. La verdad suele estar en algún punto bastante incómodo.',
      'No te cases con una formación sólo porque funcionó una vez. Los rivales miran, aprenden y después te esperan donde antes te dejaban pasar.',
      'Las ofertas bajas molestan, pero también miden el mercado. Si nadie pregunta por un jugador, quizá el problema no es la oferta sino nuestra expectativa.',
      'Si vas a cuidar el resultado, que el equipo lo sepa. Defender sin orden no es defender; es regalarle tiempo al rival para pensar.',
      'Hay días para entrenar fuerte y días para no romper lo que todavía sirve. El preparador físico no grita, pero suele tener razón.',
      'No subestimes la moral. Un plantel convencido corre un poco más, discute un poco menos y perdona mejor los errores del compañero.',
      'El mercado libre parece barato hasta que llenás el vestuario de contratos que nadie quiere pagar después. Revisá dos veces antes de entusiasmarte.',
      'Un arquero en buen momento cambia el humor de todos. Si lo ves seguro, no lo muevas sólo por ansiedad.',
      'Cuando un juvenil se lesiona, no lo apures. Todavía está aprendiendo a ser jugador y a veces el cuerpo va más lento que la ilusión.',
      'Hay partidos que se pierden antes de salir a la cancha: mala forma, mala moral, mala táctica y demasiada confianza. Revisar no cuesta nada.',
      'Si el estadio empieza a pedir arreglos, no lo dejes para siempre. El club también compite con lo que muestra alrededor de la cancha.',
      'Ojear no es descubrir una verdad absoluta; es reducir el margen de error. Igual, en este trabajo, reducir errores ya es bastante.',
      'Si el equipo está raro, mirá primero lo simple: cansancio, roles, moral y lesionados. La épica queda mejor cuando lo básico está ordenado.',
      'Antes de fichar por impulso, mandá un ojeador. Una media atractiva puede esconder poca genética, mala agresividad o un factor sorpresa que no aparece a simple vista.',
      'Ojear jugadores propios también sirve. No es desconfianza: es saber quién puede rendir más de lo que muestra y quién está viviendo de una media cómoda.',
      'Si un jugador libre aparece barato, preguntate por qué sigue libre. El ojeo no te da certezas absolutas, pero evita contratos largos por entusiasmo corto.',
      'Cuando mires un equipo rival, no busques nombres solamente. Defensa, medios y delantera te dicen dónde atacar y dónde conviene no regalar la pelota.',
      'Un informe incompleto no es inútil. A veces una sola habilidad oculta revelada alcanza para decidir si esperar, fichar o salir corriendo.',
      'Si vas a ojear varios jugadores a la vez, ordená prioridades. No todo rumor merece oficina, ojeador y café gratis.',
      'Los jugadores propios con informe completo te ayudan a elegir titulares sin mirar sólo la media. Algunos tienen más partido que cartel.',
      'Un equipo ojeado puede cambiar si vende, ficha o recompone plantel. Guardar el informe sirve, pero volver a mirar antes del partido evita sorpresas.',
      'No confundas jugador conocido con jugador conveniente. Conocer sus datos sólo elimina niebla; todavía hay que mirar sueldo, edad, puesto y necesidad real.',
      'Si el mercado muestra pocos nombres, no es pobreza: es foco. Primero aparecen los ojeados y después una ventana razonable para no perder media vida scrolleando.',
      'Un delantero con factor sorpresa alto puede convertir partidos cerrados en problemas nuevos para el rival. No siempre es regular, pero puede romper planes.',
      'Un defensor con mala agresividad oculta puede regalar amarillas aunque la media lo defienda. El informe de ojeo existe para descubrir esas trampas.',
      'La genética no mete goles, pero explica por qué algunos jugadores aguantan mejor los golpes de una temporada larga.',
      'Ojear al rival antes de cambiar la táctica es más sano que inventar soluciones después del segundo gol en contra.',
      'Si un jugador propio ya está ojeado, usá ese ojo junto al nombre como ventaja. Ya pagaste por esa información; no la ignores.',
      'Los informes archivados no son decoración. Sirven para volver rápido a jugadores que antes parecían interesantes y hoy quizá encajan mejor.',
      'No gastes todos los cupos en estrellas obvias. A veces el buen fichaje está en el jugador mediano que revela justo la oculta correcta.',
      'Ojear equipos no reemplaza mirar la tabla. Un club puede tener buena delantera y aun así estar mal por campo, moral o plantel corto.',
      'Si un jugador contratado tiene buenas visibles pero ocultas flojas, puede rendir bien en la ficha y mal cuando el partido se ensucia.',
      'El ojeo no compra jugadores; compra contexto. Y en un mercado caro, el contexto suele ser más barato que corregir un contrato malo.'
    ]
  },
  ui: {
    duracionAvisoMs: 5200,
    fasesSimulacionPartido: 90,
    duracionSimulacionPartidoMs: 270000,
    duracionMinimaFaseSimulacionMs: 3000,
    // Simulador vivo: demora entre cada minuto de reproducción continua.
    simulacionVivaAutoMs: 3360,
    // V9.93: el entretiempo se reproduce comprimido; entrada/salida y espera del pitido tienen tiempos propios.
    simulacionVivaDescansoAutoMs: 180,
    simulacionVivaEntradaSalidaCampoMs: 1180,
    simulacionVivaEsperaPitidoMs: 650,
    relatoMantenerFases: 1,
    // Animación para acciones que pueden salir bien o fallar: tratar lesionados, charla motivacional, etc.
    accionesFeedbackCargaMs: 750,
    accionesFeedbackResultadoMs: 900,
    // Tiempo entre tratamientos cuando se usa "Tratar a todos". Evita que todas las animaciones se disparen a la vez.
    kinesiologoTratamientoProgresivoMs: 650,
    // Tiempo entre cartas al abrir sobres del menú ESPECIAL.
    especialAperturaCartaMs: 2700,
    frasesProgresoAvanceIntervaloMs: 10000,
    temaClubActivo: true,
    temaClubFondoOpacidad: 0.18,
    temaClubPanelOpacidad: 0.05,
    temaClubAcentoSuavizado: 0.18,
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


(function configurarAuditoriaDeConfiguracion(){
  const clonePlain = value => {
    try{ return JSON.parse(JSON.stringify(value)); }
    catch(_){ return value; }
  };
  const sameValue = (a, b) => {
    try{ return JSON.stringify(a) === JSON.stringify(b); }
    catch(_){ return Object.is(a, b); }
  };
  const isPlainObject = value => Boolean(value && typeof value === 'object' && !Array.isArray(value));
  const baseSnapshot = clonePlain(window.GAME_CONFIG || {});
  const audit = {
    baseVersion:String(window.GAME_CONFIG?.version || ''),
    sources:[],
    applied:[],
    redundant:[],
    unknown:[],
    overwritten:[],
    invalid:[]
  };
  const pathOwners = new Map();
  const getAtPath = (source, path) => path.reduce((node, key) => isPlainObject(node) || Array.isArray(node) ? node[key] : undefined, source);
  const setAtPath = (target, path, value) => {
    let node = target;
    path.slice(0, -1).forEach(key => {
      if(!isPlainObject(node[key])) node[key] = {};
      node = node[key];
    });
    node[path[path.length - 1]] = clonePlain(value);
  };
  const walkLeaves = (source, prefix=[], out=[]) => {
    Object.entries(source || {}).forEach(([key, value]) => {
      const path = [...prefix, key];
      if(isPlainObject(value)) walkLeaves(value, path, out);
      else out.push({ path, value });
    });
    return out;
  };
  window.GAME_CONFIG_BASE = baseSnapshot;
  window.GAME_CONFIG_AUDIT = audit;
  window.applyGameConfigOverrides = function applyGameConfigOverrides(sourceName, overrides){
    const source = String(sourceName || 'override').trim() || 'override';
    const leaves = walkLeaves(isPlainObject(overrides) ? overrides : {});
    audit.sources.push({ source, entries:leaves.length });
    leaves.forEach(({ path, value }) => {
      const pathText = path.join('.');
      const baseValue = getAtPath(baseSnapshot, path);
      if(typeof baseValue === 'undefined'){
        audit.unknown.push({ source, path:pathText, value:clonePlain(value) });
        console.warn(`[CONFIG] ${source} intentó sobrescribir una ruta inexistente: ${pathText}`);
        return;
      }
      if(typeof value === 'number' && !Number.isFinite(value)){
        audit.invalid.push({ source, path:pathText, value });
        console.error(`[CONFIG] ${source} contiene un número inválido en ${pathText}`);
        return;
      }
      if(sameValue(getAtPath(window.GAME_CONFIG, path), value)){
        audit.redundant.push({ source, path:pathText });
        console.warn(`[CONFIG] Sobrescritura redundante omitida: ${source} → ${pathText}`);
        return;
      }
      if(pathOwners.has(pathText)){
        audit.overwritten.push({ path:pathText, previous:pathOwners.get(pathText), source });
        console.warn(`[CONFIG] ${pathText} fue sobrescrito por más de una fuente: ${pathOwners.get(pathText)} → ${source}`);
      }
      setAtPath(window.GAME_CONFIG, path, value);
      pathOwners.set(pathText, source);
      audit.applied.push({ source, path:pathText, from:clonePlain(baseValue), to:clonePlain(value) });
    });
    return audit;
  };
  window.validateGameConfig = function validateGameConfig(){
    const result = {
      ok:audit.unknown.length === 0 && audit.invalid.length === 0 && audit.overwritten.length === 0,
      baseVersion:audit.baseVersion,
      sources:audit.sources.length,
      applied:audit.applied.length,
      redundant:audit.redundant.length,
      unknown:audit.unknown.length,
      overwritten:audit.overwritten.length,
      invalid:audit.invalid.length
    };
    if(result.ok) console.info('[CONFIG] Configuración validada', result);
    else console.error('[CONFIG] Se detectaron conflictos de configuración', result, audit);
    return result;
  };
})();
