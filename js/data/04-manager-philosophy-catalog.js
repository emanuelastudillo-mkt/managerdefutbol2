/* V8.52 · Cuestionario y perfiles de filosofía del manager. */

window.MANAGER_PHILOSOPHY_CATALOG = Object.freeze({
  version:'V8.52',
  dimensions:[
    { id:'attack', label:'Intención', low:'Control', high:'Ataque', shortLow:'Control', shortHigh:'Ataque' },
    { id:'flexibility', label:'Flexibilidad', low:'Dogmático', high:'Adaptable', shortLow:'Dogma', shortHigh:'Adaptación' },
    { id:'pressing', label:'Defensa', low:'Bloque bajo', high:'Presión alta', shortLow:'Bloque', shortHigh:'Presión' },
    { id:'risk', label:'Riesgo', low:'Seguridad', high:'Creatividad', shortLow:'Seguro', shortHigh:'Creativo' },
    { id:'squad', label:'Plantel', low:'Colectivo', high:'Figuras', shortLow:'Equipo', shortHigh:'Figuras' },
    { id:'project', label:'Proyecto', low:'Resultado inmediato', high:'Formación', shortLow:'Ahora', shortHigh:'Cantera' },
    { id:'leadership', label:'Liderazgo', low:'Exigente', high:'Protector', shortLow:'Exigencia', shortHigh:'Protección' },
    { id:'market', label:'Mercado', low:'Fichar', high:'Desarrollar', shortLow:'Comprar', shortHigh:'Desarrollar' }
  ],
  questions:[
    {
      id:'final_tied', text:'Quedan 20 minutos y el partido está empatado. ¿Qué hacés?',
      options:[
        { id:'a', text:'Sumo delanteros y llevo al equipo decididamente al campo rival.', weights:{ attack:3, risk:2 } },
        { id:'b', text:'Adelanto líneas, pero mantengo un mediocampista de respaldo.', weights:{ attack:1, risk:1 } },
        { id:'c', text:'Conservo la estructura y espero una ventaja clara.', weights:{ attack:-1, risk:-1 } },
        { id:'d', text:'Protejo el punto y reduzco al mínimo las pérdidas.', weights:{ attack:-3, risk:-2 } }
      ]
    },
    {
      id:'away_start', text:'Visitás a un rival inferior. ¿Cómo planteás el inicio?',
      options:[
        { id:'a', text:'Presión alta y ataques constantes desde el primer minuto.', weights:{ attack:3, pressing:2 } },
        { id:'b', text:'Protagonismo con una presión selectiva.', weights:{ attack:1, pressing:1 } },
        { id:'c', text:'Bloque medio para leer el partido antes de acelerar.', weights:{ attack:-1, pressing:-1 } },
        { id:'d', text:'Orden defensivo y contragolpe, sin importar el favoritismo.', weights:{ attack:-3, pressing:-2 } }
      ]
    },
    {
      id:'score_advantage', text:'Tu equipo gana por un gol y todavía falta media hora.',
      options:[
        { id:'a', text:'Busco el segundo aun aceptando espacios a la espalda.', weights:{ attack:3, risk:2 } },
        { id:'b', text:'Sigo atacando, con coberturas más prudentes.', weights:{ attack:1, risk:1 } },
        { id:'c', text:'Bajo el ritmo y priorizo posesiones largas.', weights:{ attack:-1, risk:-1 } },
        { id:'d', text:'Cierro espacios y juego solamente transiciones seguras.', weights:{ attack:-3, risk:-2 } }
      ]
    },
    {
      id:'identity_crisis', text:'Tu idea lleva tres derrotas seguidas. ¿Cuál es tu reacción?',
      options:[
        { id:'a', text:'Mantengo el plan: la ejecución debe mejorar.', weights:{ flexibility:-3 } },
        { id:'b', text:'Retoco funciones, pero conservo sistema y principios.', weights:{ flexibility:-1 } },
        { id:'c', text:'Preparo una variante según el próximo rival.', weights:{ flexibility:1 } },
        { id:'d', text:'Cambio estructura, ritmo y presión si el contexto lo exige.', weights:{ flexibility:3 } }
      ]
    },
    {
      id:'rival_adapts', text:'El rival neutralizó tu salida habitual durante el primer tiempo.',
      options:[
        { id:'a', text:'Insisto hasta que el equipo logre imponerla.', weights:{ flexibility:-3, attack:1 } },
        { id:'b', text:'Cambio sólo una referencia de pase.', weights:{ flexibility:-1 } },
        { id:'c', text:'Activo una salida alternativa ya entrenada.', weights:{ flexibility:2 } },
        { id:'d', text:'Cambio el dibujo y el foco de ataque de inmediato.', weights:{ flexibility:3, attack:-1 } }
      ]
    },
    {
      id:'weekly_plan', text:'¿Cómo organizás la preparación de dos partidos distintos?',
      options:[
        { id:'a', text:'Una identidad fija: el rival debe adaptarse a nosotros.', weights:{ flexibility:-3, leadership:-1 } },
        { id:'b', text:'Mismo plan con ajustes menores de nombres.', weights:{ flexibility:-1 } },
        { id:'c', text:'Dos variantes trabajadas y roles claros.', weights:{ flexibility:2, leadership:1 } },
        { id:'d', text:'Un plan específico para cada rival y momento.', weights:{ flexibility:3 } }
      ]
    },
    {
      id:'loss_recovery', text:'Perdés la pelota cerca del área rival. ¿Qué esperás del equipo?',
      options:[
        { id:'a', text:'Recuperación inmediata con muchos jugadores.', weights:{ pressing:3 } },
        { id:'b', text:'Presión breve y repliegue si no se recupera.', weights:{ pressing:1 } },
        { id:'c', text:'Repliegue rápido a un bloque medio.', weights:{ pressing:-1 } },
        { id:'d', text:'Prioridad absoluta a cerrar espacios cerca del área propia.', weights:{ pressing:-3 } }
      ]
    },
    {
      id:'fast_defenders', text:'Tu defensa es lenta, pero tus volantes tienen gran despliegue.',
      options:[
        { id:'a', text:'Presiono arriba igual: acepto el riesgo por recuperar lejos.', weights:{ pressing:3, risk:2 } },
        { id:'b', text:'Presión alta sólo en disparadores concretos.', weights:{ pressing:1, risk:1 } },
        { id:'c', text:'Bloque medio y distancias cortas.', weights:{ pressing:-1, risk:-1 } },
        { id:'d', text:'Bloque bajo para proteger la espalda de los centrales.', weights:{ pressing:-3, risk:-2 } }
      ]
    },
    {
      id:'defend_lead', text:'Para defender una ventaja, tu prioridad es…',
      options:[
        { id:'a', text:'Que la pelota permanezca lejos de mi arco mediante presión.', weights:{ pressing:3 } },
        { id:'b', text:'Alternar presión y pausa para incomodar.', weights:{ pressing:1 } },
        { id:'c', text:'Cerrar el centro y conceder zonas exteriores.', weights:{ pressing:-1 } },
        { id:'d', text:'Acumular gente detrás de la pelota.', weights:{ pressing:-3 } }
      ]
    },
    {
      id:'creative_error', text:'Un jugador creativo pierde varias pelotas intentando pases difíciles.',
      options:[
        { id:'a', text:'Le pido que siga intentando: puede decidir el partido.', weights:{ risk:3 } },
        { id:'b', text:'Mantengo su libertad, pero marco zonas donde arriesgar.', weights:{ risk:1 } },
        { id:'c', text:'Le pido simplificar hasta recuperar confianza.', weights:{ risk:-1 } },
        { id:'d', text:'Lo reemplazo por un jugador de circulación segura.', weights:{ risk:-3 } }
      ]
    },
    {
      id:'build_up', text:'¿Qué salida preferís ante una presión rival intensa?',
      options:[
        { id:'a', text:'Salir jugando aun con riesgo: superar la presión crea ventaja.', weights:{ risk:3, attack:2 } },
        { id:'b', text:'Salida corta con una opción directa preparada.', weights:{ risk:1, attack:1 } },
        { id:'c', text:'Alternar según la ubicación del rival.', weights:{ risk:-1 } },
        { id:'d', text:'Juego directo para evitar pérdidas peligrosas.', weights:{ risk:-3, attack:-1 } }
      ]
    },
    {
      id:'set_piece', text:'En una pelota parada ofensiva al final del partido…',
      options:[
        { id:'a', text:'Suben casi todos: es una oportunidad decisiva.', weights:{ risk:3 } },
        { id:'b', text:'Ataco con muchos, dejando dos coberturas.', weights:{ risk:1 } },
        { id:'c', text:'Mantengo tres jugadores preparados para el retroceso.', weights:{ risk:-1 } },
        { id:'d', text:'No altero el equilibrio por una sola jugada.', weights:{ risk:-3 } }
      ]
    },
    {
      id:'star_privilege', text:'Tu figura pide libertad táctica que el resto no tendrá.',
      options:[
        { id:'a', text:'Se la concedo: el sistema debe potenciar al diferente.', weights:{ squad:3 } },
        { id:'b', text:'Le doy libertad limitada en fase ofensiva.', weights:{ squad:1 } },
        { id:'c', text:'Negocio pequeñas excepciones sin romper el funcionamiento.', weights:{ squad:-1 } },
        { id:'d', text:'Todos cumplen la misma estructura, incluida la figura.', weights:{ squad:-3 } }
      ]
    },
    {
      id:'captain_conflict', text:'La estrella y el capitán discuten delante del plantel.',
      options:[
        { id:'a', text:'Respaldo a la estrella si su rendimiento lo justifica.', weights:{ squad:3, leadership:-1 } },
        { id:'b', text:'Resuelvo en privado dando peso a ambos.', weights:{ squad:1, leadership:1 } },
        { id:'c', text:'El capitán sostiene las reglas del grupo.', weights:{ squad:-1, leadership:-1 } },
        { id:'d', text:'La norma colectiva está por encima de cualquier nombre.', weights:{ squad:-3, leadership:-2 } }
      ]
    },
    {
      id:'transfer_star', text:'Podés fichar una gran figura o tres jugadores funcionales.',
      options:[
        { id:'a', text:'Elijo a la figura: cambia la jerarquía del equipo.', weights:{ squad:3 } },
        { id:'b', text:'La figura, sólo si acepta responsabilidades colectivas.', weights:{ squad:1 } },
        { id:'c', text:'Prefiero dos perfiles complementarios.', weights:{ squad:-1 } },
        { id:'d', text:'Elijo tres jugadores para fortalecer el sistema.', weights:{ squad:-3 } }
      ]
    },
    {
      id:'youth_decision', text:'Un juvenil prometedor compite con un veterano fiable.',
      options:[
        { id:'a', text:'Juega el juvenil: el desarrollo necesita minutos reales.', weights:{ project:3 } },
        { id:'b', text:'Alterno según rival y momento.', weights:{ project:1 } },
        { id:'c', text:'El veterano inicia; el juvenil entra con partidos resueltos.', weights:{ project:-1 } },
        { id:'d', text:'Juega quien garantice el resultado inmediato.', weights:{ project:-3 } }
      ]
    },
    {
      id:'academy_budget', text:'Tenés un excedente de presupuesto. ¿Dónde lo concentrás?',
      options:[
        { id:'a', text:'Instalaciones y captación para sostener una cantera propia.', weights:{ project:3, market:3 } },
        { id:'b', text:'Una parte a juveniles y otra a una oportunidad de mercado.', weights:{ project:1, market:1 } },
        { id:'c', text:'Refuerzos para competir esta temporada.', weights:{ project:-1, market:-1 } },
        { id:'d', text:'Un fichaje de impacto inmediato.', weights:{ project:-3, market:-3 } }
      ]
    },
    {
      id:'board_pressure', text:'La directiva exige resultados y un juvenil atraviesa una mala racha.',
      options:[
        { id:'a', text:'Sostengo su proceso aunque cueste algunos puntos.', weights:{ project:3 } },
        { id:'b', text:'Reduzco su exposición sin quitarle continuidad.', weights:{ project:1 } },
        { id:'c', text:'Lo saco temporalmente para proteger el objetivo.', weights:{ project:-1 } },
        { id:'d', text:'El resultado manda: vuelve cuando esté listo.', weights:{ project:-3 } }
      ]
    },
    {
      id:'player_mistake', text:'Un jugador joven comete un error decisivo.',
      options:[
        { id:'a', text:'Lo respaldo públicamente y corrijo en privado.', weights:{ leadership:3 } },
        { id:'b', text:'Converso con él y mantengo su responsabilidad.', weights:{ leadership:1 } },
        { id:'c', text:'Marco el error delante del grupo para elevar la exigencia.', weights:{ leadership:-1 } },
        { id:'d', text:'Sale del equipo hasta demostrar una reacción.', weights:{ leadership:-3 } }
      ]
    },
    {
      id:'locker_room', text:'El vestuario cuestiona una decisión táctica.',
      options:[
        { id:'a', text:'Escucho y adapto la decisión si el argumento mejora al equipo.', weights:{ leadership:3, flexibility:2 } },
        { id:'b', text:'Escucho, explico y decido yo.', weights:{ leadership:1, flexibility:1 } },
        { id:'c', text:'Explico la idea, pero no la negocio.', weights:{ leadership:-1, flexibility:-1 } },
        { id:'d', text:'La autoridad no se discute durante la competencia.', weights:{ leadership:-3, flexibility:-2 } }
      ]
    },
    {
      id:'training_standard', text:'Un referente baja la intensidad en los entrenamientos.',
      options:[
        { id:'a', text:'Primero averiguo si existe un problema personal o físico.', weights:{ leadership:3 } },
        { id:'b', text:'Hablo en privado y fijo una mejora concreta.', weights:{ leadership:1 } },
        { id:'c', text:'Le advierto que perderá su lugar.', weights:{ leadership:-1 } },
        { id:'d', text:'Aplico una consecuencia inmediata para dar ejemplo.', weights:{ leadership:-3 } }
      ]
    },
    {
      id:'missing_role', text:'Te falta un lateral para completar el plantel.',
      options:[
        { id:'a', text:'Adapto y desarrollo a un futbolista que ya está en el club.', weights:{ market:3 } },
        { id:'b', text:'Pruebo una solución interna antes de buscar afuera.', weights:{ market:1 } },
        { id:'c', text:'Busco una cesión o una opción económica.', weights:{ market:-1 } },
        { id:'d', text:'Ficho al especialista que resuelva el puesto ya.', weights:{ market:-3 } }
      ]
    },
    {
      id:'academy_offer', text:'Llega una oferta importante por un juvenil de gran proyección.',
      options:[
        { id:'a', text:'La rechazo: será parte del primer equipo.', weights:{ market:3, project:3 } },
        { id:'b', text:'Sólo vendo si el dinero financia varias mejoras de cantera.', weights:{ market:2, project:1 } },
        { id:'c', text:'Acepto si permite reforzar dos posiciones actuales.', weights:{ market:-1, project:-1 } },
        { id:'d', text:'Vendo y compro rendimiento probado.', weights:{ market:-3, project:-3 } }
      ]
    },
    {
      id:'window_strategy', text:'¿Cuál es tu ventana de pases ideal?',
      options:[
        { id:'a', text:'Pocas altas: promociono y mejoro lo que ya tengo.', weights:{ market:3, squad:-2 } },
        { id:'b', text:'Una incorporación puntual y espacio para la cantera.', weights:{ market:1, squad:-1 } },
        { id:'c', text:'Renuevo varias piezas para elevar la competencia.', weights:{ market:-1, squad:1 } },
        { id:'d', text:'Busco jerarquía externa en cada posición débil.', weights:{ market:-3, squad:2 } }
      ]
    }
  ],
  profiles:[
    {
      id:'architect', title:'Arquitecto del control', kicker:'La pelota organiza al equipo',
      summary:'Querés gobernar el partido con una estructura reconocible, paciencia y decisiones de bajo error.',
      target:{ attack:42, flexibility:38, pressing:62, risk:35, squad:22, project:70, leadership:64, market:75 },
      strengths:['Identidad clara y repetible','Buen entorno para desarrollar jugadores','Control de los ritmos'],
      risks:['Previsibilidad ante rivales adaptativos','Falta de profundidad si el partido se cierra']
    },
    {
      id:'attacker', title:'Atacante creativo', kicker:'La iniciativa es tu defensa',
      summary:'Priorizás llegar, crear y asumir riesgos para que el partido se juegue cerca del arco rival.',
      target:{ attack:92, flexibility:56, pressing:74, risk:88, squad:45, project:48, leadership:64, market:48 },
      strengths:['Generación constante de ocasiones','Capacidad para cambiar partidos','Valentía con la pelota'],
      risks:['Espacios tras pérdida','Desgaste físico y partidos demasiado abiertos']
    },
    {
      id:'pressing_vertical', title:'Presionador vertical', kicker:'Recuperar y acelerar',
      summary:'Tu equipo quiere recuperar arriba y atacar antes de que el rival vuelva a ordenarse.',
      target:{ attack:86, flexibility:52, pressing:94, risk:72, squad:20, project:68, leadership:55, market:72 },
      strengths:['Ritmo competitivo alto','Ataques sobre defensas desorganizadas','Idea colectiva intensa'],
      risks:['Fatiga y lesiones','Vulnerabilidad si superan la primera presión']
    },
    {
      id:'pragmatist', title:'Competidor pragmático', kicker:'El contexto decide',
      summary:'Elegís el camino que aumenta la probabilidad de ganar, aunque cambie la forma de un partido a otro.',
      target:{ attack:38, flexibility:88, pressing:32, risk:24, squad:58, project:25, leadership:34, market:25 },
      strengths:['Lectura del rival','Protección de ventajas','Respuesta a escenarios adversos'],
      risks:['Menor continuidad de identidad','Dependencia de futbolistas experimentados']
    },
    {
      id:'chameleon', title:'Camaleón estratégico', kicker:'Dos planes, una misma ambición',
      summary:'Te sentís cómodo cambiando estructura y ritmo sin renunciar al objetivo competitivo.',
      target:{ attack:64, flexibility:94, pressing:60, risk:54, squad:48, project:48, leadership:72, market:48 },
      strengths:['Variantes para distintos rivales','Buena gestión de partidos','Uso amplio del plantel'],
      risks:['Cambiar más de lo que el equipo puede asimilar','Perder automatismos']
    },
    {
      id:'developer', title:'Formador de talentos', kicker:'El proyecto también se entrena',
      summary:'Medís el éxito por el crecimiento del club y de sus futbolistas, no sólo por el próximo resultado.',
      target:{ attack:62, flexibility:64, pressing:68, risk:62, squad:15, project:96, leadership:84, market:96 },
      strengths:['Crecimiento sostenible','Valorización de juveniles','Plantel comprometido con el proceso'],
      risks:['Exponer demasiado pronto a los jóvenes','Descuidar la caja por invertir sin reserva']
    },
    {
      id:'star_manager', title:'Gestor de figuras', kicker:'El talento excepcional inclina la cancha',
      summary:'Construís el equipo alrededor de futbolistas decisivos y adaptás funciones para potenciar su impacto.',
      target:{ attack:74, flexibility:76, pressing:46, risk:70, squad:94, project:30, leadership:86, market:18 },
      strengths:['Potencia individual en momentos clave','Capacidad para resolver partidos cerrados','Atractivo para grandes nombres'],
      risks:['Dependencia de pocas figuras','Tensiones por roles y privilegios']
    },
    {
      id:'collective', title:'Constructor colectivo', kicker:'Nadie juega solo',
      summary:'La coordinación, los roles complementarios y el compromiso común están por encima de cualquier nombre.',
      target:{ attack:58, flexibility:62, pressing:76, risk:44, squad:4, project:72, leadership:60, market:78 },
      strengths:['Estructura resistente a las ausencias','Roles claros','Cohesión del grupo'],
      risks:['Poca improvisación cuando falla el sistema','Dificultad para integrar una figura dominante']
    },
    {
      id:'dogmatist', title:'Fiel al plan', kicker:'Convicción antes que reacción',
      summary:'Confiás en una identidad firme y preferís perfeccionarla antes que modificarla por cada rival.',
      target:{ attack:68, flexibility:4, pressing:72, risk:56, squad:16, project:68, leadership:34, market:72 },
      strengths:['Automatismos profundos','Mensaje simple para el plantel','Identidad reconocible'],
      risks:['El rival aprende y se adapta','Falta de una salida cuando el Plan A se bloquea']
    },
    {
      id:'balanced', title:'Equilibrista competitivo', kicker:'Controlar sin renunciar a golpear',
      summary:'Buscás una mezcla estable entre iniciativa, seguridad, presente y construcción a futuro.',
      target:{ attack:56, flexibility:68, pressing:54, risk:46, squad:42, project:56, leadership:62, market:55 },
      strengths:['Decisiones proporcionadas al contexto','Plantel versátil','Menos puntos débiles extremos'],
      risks:['Quedar a mitad de camino en partidos límite','Necesidad de definir prioridades claras']
    }
  ],
  coaches:[
    { id:'guardiola', name:'Pep Guardiola', style:'Control, posición y presión tras pérdida', target:{ attack:72, flexibility:44, pressing:86, risk:62, squad:25, project:74, leadership:62, market:58 } },
    { id:'cruyff', name:'Johan Cruyff', style:'Identidad ofensiva y formación', target:{ attack:88, flexibility:24, pressing:78, risk:84, squad:12, project:94, leadership:66, market:96 } },
    { id:'menotti', name:'César Luis Menotti', style:'Protagonismo, técnica y libertad', target:{ attack:90, flexibility:30, pressing:58, risk:88, squad:24, project:78, leadership:82, market:78 } },
    { id:'klopp', name:'Jürgen Klopp', style:'Presión, verticalidad y energía colectiva', target:{ attack:88, flexibility:58, pressing:94, risk:76, squad:20, project:72, leadership:84, market:72 } },
    { id:'bielsa', name:'Marcelo Bielsa', style:'Ataque, presión e identidad innegociable', target:{ attack:96, flexibility:14, pressing:98, risk:90, squad:10, project:84, leadership:54, market:88 } },
    { id:'flick', name:'Hansi Flick', style:'Presión alta y ataque directo', target:{ attack:91, flexibility:54, pressing:94, risk:80, squad:30, project:55, leadership:68, market:48 } },
    { id:'mourinho', name:'José Mourinho', style:'Lectura del rival y control del riesgo', target:{ attack:34, flexibility:88, pressing:28, risk:18, squad:72, project:20, leadership:24, market:18 } },
    { id:'simeone', name:'Diego Simeone', style:'Orden, resistencia y competencia', target:{ attack:32, flexibility:54, pressing:42, risk:18, squad:12, project:34, leadership:42, market:34 } },
    { id:'bilardo', name:'Carlos Bilardo', style:'Detalle, adaptación y resultado', target:{ attack:30, flexibility:84, pressing:26, risk:16, squad:18, project:24, leadership:28, market:28 } },
    { id:'ancelotti', name:'Carlo Ancelotti', style:'Flexibilidad y gestión de figuras', target:{ attack:68, flexibility:94, pressing:52, risk:64, squad:88, project:44, leadership:96, market:30 } },
    { id:'scaloni', name:'Lionel Scaloni', style:'Adaptación, grupo y equilibrio', target:{ attack:70, flexibility:96, pressing:68, risk:58, squad:30, project:64, leadership:90, market:64 } },
    { id:'zidane', name:'Zinedine Zidane', style:'Jerarquía, calma y gestión humana', target:{ attack:68, flexibility:86, pressing:48, risk:62, squad:90, project:36, leadership:94, market:24 } },
    { id:'wenger', name:'Arsène Wenger', style:'Desarrollo, técnica y proyecto largo', target:{ attack:76, flexibility:56, pressing:64, risk:78, squad:20, project:98, leadership:84, market:96 } },
    { id:'ferguson', name:'Alex Ferguson', style:'Renovación, exigencia y adaptación', target:{ attack:80, flexibility:86, pressing:64, risk:70, squad:54, project:90, leadership:48, market:74 } },
    { id:'sacchi', name:'Arrigo Sacchi', style:'Sistema colectivo y presión coordinada', target:{ attack:72, flexibility:18, pressing:96, risk:52, squad:4, project:72, leadership:34, market:82 } },
    { id:'del_bosque', name:'Vicente del Bosque', style:'Equilibrio y convivencia del talento', target:{ attack:58, flexibility:84, pressing:48, risk:48, squad:66, project:56, leadership:96, market:46 } },
    { id:'gallardo', name:'Marcelo Gallardo', style:'Intensidad, variantes y formación', target:{ attack:84, flexibility:88, pressing:82, risk:72, squad:24, project:82, leadership:76, market:80 } },
    { id:'van_gaal', name:'Louis van Gaal', style:'Estructura, convicción y juveniles', target:{ attack:64, flexibility:22, pressing:72, risk:44, squad:8, project:96, leadership:26, market:94 } }
  ]
});
