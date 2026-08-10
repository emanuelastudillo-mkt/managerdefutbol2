/*
  V9.34 · Ser jugador
  - Eventos de carrera con decisiones probabilísticas, lesiones y cambios de media.
  - Curvas ocultas de desarrollo muy diferentes entre sí.
  - Escala especial para futbolistas de 90+ y 95+ de media.
  - Ciclos de estancamiento, malas adaptaciones y recuperación posterior.
*/

const pcV934BaseNormalizeCareer = pcNormalizeCareer;
const pcV934BaseCreatePlayerCareer = pcCreatePlayerCareer;
const pcV934BaseAdvanceMarkup = pcV930AdvanceMarkup;
const pcV934BaseApplyResolvedMarketChoice = pcV930ApplyResolvedMarketChoice;
const pcV934BaseFinalizeSeason = pcFinalizeSeason;
let pcV934EventRoulette = null;

const PC_V934_CURVES = {
  meteorica:{ id:'meteorica', peakAge:22, declineAge:27, declineRate:0.72 },
  explosiva:{ id:'explosiva', peakAge:24, declineAge:30, declineRate:0.46 },
  sostenida:{ id:'sostenida', peakAge:28, declineAge:34, declineRate:0.20 },
  lenta:{ id:'lenta', peakAge:30, declineAge:35, declineRate:0.16 },
  tardia:{ id:'tardia', peakAge:29, declineAge:34, declineRate:0.22 },
  volatil:{ id:'volatil', peakAge:27, declineAge:32, declineRate:0.34 }
};

function pcV934CurveFromPlayer(state){
  const text = `${state?.player?.id || ''}|${state?.player?.name || ''}|${state?.rngSeed || 0}`;
  const value = Math.abs(Number(pcSeedFromText(text) || 0)) % 100;
  if(value < 9) return PC_V934_CURVES.meteorica;
  if(value < 26) return PC_V934_CURVES.explosiva;
  if(value < 49) return PC_V934_CURVES.sostenida;
  if(value < 67) return PC_V934_CURVES.lenta;
  if(value < 85) return PC_V934_CURVES.tardia;
  return PC_V934_CURVES.volatil;
}

function pcV934NormalizeArc(raw,state){
  const curve = PC_V934_CURVES[String(raw?.curveId || '')] || pcV934CurveFromPlayer(state);
  return {
    curveId:curve.id,
    peakAge:Math.round(Number(raw?.peakAge || curve.peakAge)),
    declineAge:Math.round(Number(raw?.declineAge || curve.declineAge)),
    declineRate:pcClamp(Number(raw?.declineRate ?? curve.declineRate),0.08,1.2),
    slumpLevel:pcClamp(Math.round(Number(raw?.slumpLevel || 0)),0,5),
    slumpSeasons:Math.max(0,Math.round(Number(raw?.slumpSeasons || 0))),
    comebackCredit:Math.max(0,Math.round(Number(raw?.comebackCredit || 0))),
    badMoves:Math.max(0,Math.round(Number(raw?.badMoves || 0))),
    successfulMoves:Math.max(0,Math.round(Number(raw?.successfulMoves || 0))),
    pulseSeason:Math.max(0,Math.round(Number(raw?.pulseSeason || 0))),
    pulse:Number.isFinite(Number(raw?.pulse)) ? pcClamp(Number(raw.pulse),-0.45,1.65) : 1,
    lastSeasonOverall:Number(raw?.lastSeasonOverall ?? state?.player?.overall ?? 50),
    lastSeasonRating:Number(raw?.lastSeasonRating || 0)
  };
}

function pcV934SeasonPulse(state){
  const arc = state.careerArc;
  const season = Number(state.season?.number || 1);
  if(Number(arc.pulseSeason || 0) === season) return Number(arc.pulse || 1);
  arc.pulseSeason = season;
  if(arc.curveId === 'volatil'){
    const roll = pcRandom(state);
    arc.pulse = roll < 0.18 ? pcRandomBetween(state,-0.28,0.18)
      : roll < 0.48 ? pcRandomBetween(state,0.45,0.82)
        : roll < 0.84 ? pcRandomBetween(state,0.92,1.24)
          : pcRandomBetween(state,1.30,1.62);
  }else arc.pulse = pcRandomBetween(state,0.92,1.08);
  return arc.pulse;
}

function pcV934CurveAgeFactor(state){
  const age = Number(state.player?.age || 18);
  const arc = state.careerArc;
  switch(arc.curveId){
    case 'meteorica':
      if(age <= 20) return 1.90;
      if(age <= 23) return 1.46;
      if(age <= 26) return 0.58;
      if(age <= 28) return 0.08;
      return -0.52 - Math.max(0,age-29)*0.09;
    case 'explosiva':
      if(age <= 21) return 1.58;
      if(age <= 24) return 1.26;
      if(age <= 27) return 0.76;
      if(age <= 30) return 0.22;
      return -0.34 - Math.max(0,age-31)*0.065;
    case 'lenta':
      if(age <= 20) return 0.42;
      if(age <= 23) return 0.64;
      if(age <= 27) return 0.91;
      if(age <= 31) return 0.96;
      if(age <= 34) return 0.48;
      return -0.13 - Math.max(0,age-35)*0.045;
    case 'tardia':
      if(age <= 21) return 0.26;
      if(age <= 24) return 0.49;
      if(age <= 28) return 1.25;
      if(age <= 31) return 1.03;
      if(age <= 33) return 0.48;
      return -0.17 - Math.max(0,age-34)*0.05;
    case 'volatil': {
      const base = age <= 21 ? 1.12 : age <= 26 ? 0.96 : age <= 30 ? 0.62 : age <= 33 ? 0.18 : -0.25;
      return base * pcV934SeasonPulse(state);
    }
    case 'sostenida':
    default:
      if(age <= 22) return 0.86;
      if(age <= 27) return 1.02;
      if(age <= 31) return 0.74;
      if(age <= 34) return 0.36;
      return -0.14 - Math.max(0,age-35)*0.045;
  }
}

function pcV934NormalizeCareerEvent(raw){
  if(!raw || typeof raw !== 'object') return null;
  const options = Array.isArray(raw.options) ? raw.options.slice(0,3).map(option => ({
    ...option,
    id:String(option?.id || ''),
    label:String(option?.label || 'Elegir'),
    outcomes:Array.isArray(option?.outcomes) ? option.outcomes.slice(0,3).map(outcome => ({
      ...outcome,
      chance:pcClamp(Math.round(Number(outcome?.chance || 0)),0,100),
      tone:['positive','negative','neutral'].includes(outcome?.tone) ? outcome.tone : 'neutral'
    })) : []
  })).filter(option => option.id && option.outcomes.length) : [];
  if(options.length < 2) return null;
  return {
    id:String(raw.id || ''),
    templateId:String(raw.templateId || ''),
    season:Math.max(1,Math.round(Number(raw.season || 1))),
    category:String(raw.category || 'Carrera'),
    icon:String(raw.icon || 'star'),
    title:String(raw.title || 'Situación de carrera'),
    text:String(raw.text || ''),
    options
  };
}

pcCreatePlayerCareer = function(form){
  const state = pcV934BaseCreatePlayerCareer(form);
  state.schemaVersion = Math.max(8,Number(state.schemaVersion || 0));
  state.viewVersion = 'V9.34';
  state.careerArc = pcV934NormalizeArc(null,state);
  state.careerEvent = null;
  state.careerEventSeason = 0;
  return state;
};

pcNormalizeCareer = function(raw){
  const normalized = pcV934BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(8,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.34';
  normalized.careerArc = pcV934NormalizeArc(normalized.careerArc,normalized);
  normalized.careerEvent = pcV934NormalizeCareerEvent(normalized.careerEvent);
  normalized.careerEventSeason = Math.max(0,Math.round(Number(normalized.careerEventSeason || normalized.careerEvent?.season || 0)));
  return normalized;
};

function pcV934EventPool(state){
  const isSlump = Number(state.careerArc?.slumpLevel || 0) > 0;
  const elite = Number(state.player?.overall || 0) >= 88 || Number(state.club?.reputation || 0) >= 84;
  return [
    {
      id:'legend-mentor',category:'Entrenamiento',icon:'star',title:'Una leyenda ofrece entrenarte',
      text:'Una antigua figura mundial visita el club y propone sesiones privadas para perfeccionar detalles de tu juego.',
      options:[
        { id:'legend-intense',label:'Aceptar el plan intensivo',outcomes:[
          { chance:55,tone:'positive',description:'+1 Media · +6 reputación',effects:{ overall:1,reputation:6,growthProgress:0.35 },arc:{ slumpDelta:-1,comebackCredit:1 } },
          { chance:30,tone:'positive',description:'+70% de progreso hacia la próxima Media',effects:{ growthProgress:0.70,reputation:3 } },
          { chance:15,tone:'negative',description:'Sobrecarga: lesión media · −1 Media',effects:{ overall:-1 },injury:{ name:'Sobrecarga muscular',blocks:2,severity:'Media' },arc:{ slumpDelta:1 } }
        ]},
        { id:'legend-measured',label:'Trabajar de forma gradual',outcomes:[
          { chance:75,tone:'positive',description:'+35% de progreso · +3 reputación',effects:{ growthProgress:0.35,reputation:3 } },
          { chance:25,tone:'neutral',description:'La experiencia no genera cambios inmediatos',effects:{} }
        ]}
      ]
    },
    {
      id:'world-star-rivalry',category:'Vestuario',icon:'users',title:'Choque con una figura mundial',
      text:'La principal estrella del plantel cuestiona tu lugar en el equipo y la discusión se vuelve pública.',
      options:[
        { id:'rivalry-face',label:'Responder dentro de la cancha',outcomes:[
          { chance:48,tone:'positive',description:'+1 Media · +8 reputación · ganás protagonismo',effects:{ overall:1,reputation:8,trust:6 },arc:{ slumpDelta:-1 } },
          { chance:34,tone:'neutral',description:'+40% de progreso · la competencia continúa',effects:{ growthProgress:0.40,reputation:2 } },
          { chance:18,tone:'negative',description:'Perdés la pulseada: −1 Media · menos minutos',effects:{ overall:-1,trust:-10 },context:{ opportunity:-0.10 },arc:{ slumpDelta:1,badMoves:1 } }
        ]},
        { id:'rivalry-learn',label:'Pedirle que sea tu mentor',outcomes:[
          { chance:68,tone:'positive',description:'+60% de progreso · +5 reputación',effects:{ growthProgress:0.60,reputation:5 },arc:{ slumpDelta:-1,comebackCredit:1 } },
          { chance:32,tone:'negative',description:'Rechaza ayudarte: −7 confianza',effects:{ trust:-7 } }
        ]}
      ]
    },
    {
      id:'position-change',category:'Entrenador',icon:'contract',title:'Cambio de posición propuesto',
      text:'El entrenador cree que otra función puede elevar tu techo, aunque inicialmente perderías minutos mientras te adaptás.',
      options:[
        { id:'position-accept',label:'Aceptar la reconversión',outcomes:[
          { chance:58,tone:'positive',description:'+1 Media · mayor potencial · menos minutos al inicio',effects:{ overall:1,growthProgress:0.45,adaptation:4 },context:{ opportunity:-0.07,developmentMultiplier:1.12 } },
          { chance:42,tone:'negative',description:'No encajás: −1 Media · menos minutos',effects:{ overall:-1,trust:-8 },context:{ opportunity:-0.13,developmentMultiplier:0.94 },arc:{ slumpDelta:1 } }
        ]},
        { id:'position-refuse',label:'Mantener tu posición',outcomes:[
          { chance:72,tone:'neutral',description:'Conservás tu lugar y tu desarrollo actual',effects:{} },
          { chance:28,tone:'negative',description:'El técnico reduce tu protagonismo',effects:{ trust:-6 },context:{ opportunity:-0.06 } }
        ]}
      ]
    },
    {
      id:'medical-decision',category:'Salud',icon:'medical',title:'Una lesión exige una decisión',
      text:'Los médicos detectan una molestia seria antes del inicio de la temporada.',
      options:[
        { id:'medical-surgery',label:'Tratarla con paciencia',outcomes:[
          { chance:78,tone:'positive',description:'Recuperación completa · sin pérdida de Media',effects:{ growthProgress:0.12 },injury:{ name:'Rehabilitación preventiva',blocks:1,severity:'Leve' },arc:{ slumpDelta:-1 } },
          { chance:22,tone:'negative',description:'La recuperación se demora: lesión alta · −1 Media',effects:{ overall:-1 },injury:{ name:'Complicación en la recuperación',blocks:3,severity:'Alta' },arc:{ slumpDelta:1 } }
        ]},
        { id:'medical-force',label:'Forzar para no perder el puesto',outcomes:[
          { chance:38,tone:'positive',description:'+5 reputación · seguís disponible',effects:{ reputation:5,trust:4 } },
          { chance:62,tone:'negative',description:'Recaída grave: lesión alta · −2 Media',effects:{ overall:-2,trust:-8 },injury:{ name:'Recaída de rodilla',blocks:3,severity:'Alta' },arc:{ slumpDelta:2,badMoves:1 } }
        ]}
      ]
    },
    {
      id:'elite-camp',category:'Pretemporada',icon:'dumbbell',title:'Campus privado con estrellas',
      text:'Tu representante consigue una invitación a entrenar durante una semana con varias figuras internacionales.',
      options:[
        { id:'camp-go',label:'Participar y competir al máximo',outcomes:[
          { chance:50,tone:'positive',description:'+1 Media · +7 reputación',effects:{ overall:1,reputation:7,growthProgress:0.25 },arc:{ slumpDelta:-1 } },
          { chance:35,tone:'positive',description:'+75% de progreso hacia la próxima Media',effects:{ growthProgress:0.75,reputation:3 } },
          { chance:15,tone:'negative',description:'Lesión durante el campus · −1 Media',effects:{ overall:-1 },injury:{ name:'Lesión muscular en pretemporada',blocks:2,severity:'Media' },arc:{ slumpDelta:1 } }
        ]},
        { id:'camp-rest',label:'Priorizar el trabajo del club',outcomes:[
          { chance:82,tone:'neutral',description:'+20% de progreso · conservás tu rol',effects:{ growthProgress:0.20,trust:3 } },
          { chance:18,tone:'negative',description:'La oportunidad internacional no vuelve',effects:{ reputation:-2 } }
        ]}
      ]
    },
    {
      id:'famous-night',category:'Vida pública',icon:'car',title:'Una noche con la figura del plantel',
      text:'El referente del equipo te invita a una celebración que puede acercarte al grupo o terminar en un escándalo.',
      options:[
        { id:'night-join',label:'Aceptar la invitación',outcomes:[
          { chance:43,tone:'positive',description:'+9 reputación · +6 confianza',effects:{ reputation:9,trust:6 } },
          { chance:37,tone:'neutral',description:'La salida no tiene consecuencias deportivas',effects:{ reputation:2 } },
          { chance:20,tone:'negative',description:'Accidente: lesión media · −2 Media',effects:{ overall:-2 },injury:{ name:'Traumatismo fuera del campo',blocks:2,severity:'Media' },arc:{ slumpDelta:2 } }
        ]},
        { id:'night-decline',label:'Rechazar y entrenar al día siguiente',outcomes:[
          { chance:70,tone:'positive',description:'+50% de progreso · +3 confianza',effects:{ growthProgress:0.50,trust:3 } },
          { chance:30,tone:'negative',description:'El grupo te considera distante: −5 confianza',effects:{ trust:-5 } }
        ]}
      ]
    },
    {
      id:'comeback-specialist',category:'Carrera',icon:'trend',title:isSlump?'Un especialista propone reconstruir tu carrera':'Un especialista analiza tu progresión',
      text:isSlump?'Después de varias temporadas difíciles, un preparador presenta un plan para recuperar tu mejor nivel.':'Un preparador detecta margen de mejora, pero exige modificar tu rutina y aceptar menos minutos durante varios meses.',
      options:[
        { id:'comeback-plan',label:'Seguir el plan completo',outcomes:[
          { chance:isSlump?64:48,tone:'positive',description:`${isSlump?'+1 Media · ciclo negativo superado':'+1 Media · nuevo impulso'} · menos minutos`,effects:{ overall:1,growthProgress:0.35,trust:4 },context:{ opportunity:-0.06,developmentMultiplier:1.16 },arc:{ slumpDelta:-3,comebackCredit:2 } },
          { chance:isSlump?25:37,tone:'neutral',description:'+55% de progreso · recuperación gradual',effects:{ growthProgress:0.55 },arc:{ slumpDelta:-1,comebackCredit:1 } },
          { chance:isSlump?11:15,tone:'negative',description:'El plan falla: −1 Media · lesión leve',effects:{ overall:-1 },injury:{ name:'Sobrecarga por cambio de preparación',blocks:1,severity:'Leve' },arc:{ slumpDelta:1 } }
        ]},
        { id:'comeback-own-way',label:'Seguir por tu cuenta',outcomes:[
          { chance:55,tone:'neutral',description:'La temporada comienza sin cambios',effects:{} },
          { chance:45,tone:'negative',description:isSlump?'El estancamiento continúa':'El progreso se ralentiza',effects:{ growthProgress:-0.20 },arc:{ slumpDelta:isSlump?1:0 } }
        ]}
      ]
    },
    {
      id:'elite-pressure',category:'Competencia',icon:'star',title:'La prensa te compara con los mejores',
      text:elite?'Tu nivel ya genera comparaciones con las figuras más importantes del mundo.':'Una buena racha provoca comparaciones prematuras con jugadores consagrados.',
      options:[
        { id:'pressure-embrace',label:'Aceptar el desafío públicamente',outcomes:[
          { chance:elite?68:46,tone:'positive',description:'+1 Media · +10 reputación',effects:{ overall:1,reputation:10,pressure:5 },arc:{ slumpDelta:-1 } },
          { chance:elite?22:34,tone:'neutral',description:'+5 reputación · aumenta la exigencia',effects:{ reputation:5,pressure:2 } },
          { chance:elite?10:20,tone:'negative',description:'La presión te supera: −1 Media · menos minutos',effects:{ overall:-1,trust:-9 },context:{ opportunity:-0.08 },arc:{ slumpDelta:1 } }
        ]},
        { id:'pressure-ignore',label:'Evitar las comparaciones',outcomes:[
          { chance:76,tone:'positive',description:'+35% de progreso · enfoque deportivo',effects:{ growthProgress:0.35,pressure:3 } },
          { chance:24,tone:'neutral',description:'Sin cambios relevantes',effects:{} }
        ]}
      ]
    }
  ];
}

function pcV934GenerateCareerEvent(state){
  const pool = pcV934EventPool(state);
  const recent = Array.isArray(state?.history?.events) ? state.history.events.slice(0,4).map(item => String(item?.eventTemplate || '')) : [];
  const filtered = pool.filter(item => !recent.includes(item.id));
  const template = pcPick(state,filtered.length ? filtered : pool);
  const event = {
    ...template,
    id:pcUniqueId(state,`career-event-${template.id}`),
    templateId:template.id,
    season:Number(state.season?.number || 1),
    options:template.options.map(option => ({ ...option, id:`${template.id}-${option.id}-${state.season.number}`, outcomes:option.outcomes.map(outcome => ({...outcome})) }))
  };
  state.careerEvent = pcV934NormalizeCareerEvent(event);
  state.careerEventSeason = Number(state.season?.number || 1);
  return state.careerEvent;
}

function pcV934EnsureCareerEvent(state){
  if(!state || state.status !== 'active' || Number(state.season?.stage || 0) !== 0) return null;
  if(Number(state.careerEventSeason || 0) !== Number(state.season.number || 1)){
    pcV934GenerateCareerEvent(state);
    pcSetCareerState(state);
  }
  return state.careerEvent;
}

function pcV934ApplyArcEffect(state,effect){
  if(!effect) return;
  const arc = state.careerArc = pcV934NormalizeArc(state.careerArc,state);
  arc.slumpLevel = pcClamp(Number(arc.slumpLevel || 0) + Number(effect.slumpDelta || 0),0,5);
  arc.comebackCredit = Math.max(0,Number(arc.comebackCredit || 0) + Number(effect.comebackCredit || 0));
  arc.badMoves = Math.max(0,Number(arc.badMoves || 0) + Number(effect.badMoves || 0));
  arc.successfulMoves = Math.max(0,Number(arc.successfulMoves || 0) + Number(effect.successfulMoves || 0));
  if(effect.resetSlump) arc.slumpLevel = 0;
}

function pcV934ApplyContextEffect(state,effect){
  if(!effect) return;
  const current = typeof pcV930NormalizeContext === 'function' ? pcV930NormalizeContext(state.careerContext,state) : {};
  if(Number.isFinite(Number(effect.opportunity))) current.opportunity = pcClamp(Number(current.opportunity || 0)+Number(effect.opportunity),-0.25,0.25);
  if(Number.isFinite(Number(effect.developmentMultiplier))) current.developmentMultiplier = pcClamp(Number(effect.developmentMultiplier),0.82,1.34);
  if(Number.isFinite(Number(effect.adaptationPenalty))) current.adaptationPenalty = pcClamp(Number(current.adaptationPenalty || 0)+Number(effect.adaptationPenalty),0,0.25);
  state.careerContext = current;
}

function pcV934CreateInjury(state,injury){
  if(!injury) return;
  const blocks = Math.max(1,Math.round(Number(injury.blocks || 1)));
  if(state.injury){
    state.injury.blocksRemaining = Math.max(Number(state.injury.blocksRemaining || 0),blocks);
    state.injury.originalBlocks = Math.max(Number(state.injury.originalBlocks || 0),blocks);
    state.injury.recurrenceRisk = pcClamp(Number(state.injury.recurrenceRisk || 20)+12,0,100);
    return;
  }
  const record = {
    id:pcUniqueId(state,'event-injury'),
    name:String(injury.name || 'Lesión'),
    severity:String(injury.severity || 'Media'),
    blocksRemaining:blocks,
    originalBlocks:blocks,
    recurrenceRisk:24,
    season:Number(state.season?.number || 1),
    year:Number(state.season?.year || 2026)
  };
  state.injury = record;
  state.history.injuries = Array.isArray(state.history.injuries) ? state.history.injuries : [];
  state.history.injuries.unshift({...record});
  pcRecordEvent(state,'injury',`${state.player.name} sufrió ${record.name.toLowerCase()}.`);
}

function pcV934PickOutcome(state,option){
  const outcomes = Array.isArray(option?.outcomes) ? option.outcomes : [];
  const roll = pcRandom(state)*100;
  let cumulative = 0;
  for(let index=0;index<outcomes.length;index+=1){
    cumulative += Math.max(0,Number(outcomes[index]?.chance || 0));
    if(roll < cumulative) return { index,outcome:outcomes[index] };
  }
  return { index:Math.max(0,outcomes.length-1),outcome:outcomes[outcomes.length-1] || {chance:100,tone:'neutral',description:'Sin cambios.',effects:{}} };
}

function pcV934ApplyEventResult(state,event,option,outcome){
  const before = pcVisibleStatSnapshot(state);
  pcV930ApplySimpleEffects(state,outcome.effects || {});
  pcV934ApplyArcEffect(state,outcome.arc);
  pcV934ApplyContextEffect(state,outcome.context);
  pcV934CreateInjury(state,outcome.injury);
  state.player.value = pcCalculateValue(state);
  state.history.decisions = Array.isArray(state.history.decisions) ? state.history.decisions : [];
  state.history.decisions.unshift({
    id:pcUniqueId(state,'career-event-result'),season:state.season.number,year:state.season.year,
    category:event.category,title:event.title,option:option.label,outcome:String(outcome.description || ''),chance:Number(outcome.chance || 100)
  });
  state.history.events = Array.isArray(state.history.events) ? state.history.events : [];
  state.history.events.unshift({
    id:pcUniqueId(state,'event'),season:state.season.number,year:state.season.year,type:'careerEvent',eventTemplate:event.templateId,
    text:`${event.title}: ${option.label}. ${outcome.description || ''}`
  });
  state.lastDecisionResult = {
    id:pcUniqueId(state,'career-event-last'),category:event.category,title:event.title,option:option.label,
    outcome:String(outcome.description || ''),chance:Number(outcome.chance || 100),tone:String(outcome.tone || 'neutral')
  };
  state.careerEvent = null;
  pcStoreStatChanges(state,before,'Evento de carrera');
  pcPersist(state,true);
}

function pcV934EventOutcomeMarkup(option,outcome,index){
  const tone = ['positive','negative','neutral'].includes(outcome.tone) ? outcome.tone : 'neutral';
  return `<span class="pc-v934-event-outcome ${tone}" data-pc-event-option="${pcEscape(option.id)}" data-pc-event-outcome="${index}">
    ${pcVectorIcon(tone==='positive'?'up':tone==='negative'?'down':'chance')}
    <em>${pcEscape(outcome.description || '')}</em><b>${Math.round(Number(outcome.chance || 0))}%</b>
  </span>`;
}

function pcV934EventMarkup(state,event){
  return `<section class="pc-v934-event-card">
    <div class="pc-v934-event-head"><i>${pcVectorIcon(event.icon || 'star')}</i><div><small>${pcEscape(event.category)}</small><h3>${pcEscape(event.title)}</h3><p>${pcEscape(event.text)}</p></div><span data-pc-event-status>Elegí una respuesta</span></div>
    <div class="pc-v934-event-options">
      ${event.options.map(option => `<button type="button" class="pc-v934-event-option" data-pc-career-event="${pcEscape(option.id)}">
        <strong>${pcEscape(option.label)}</strong>
        <span>${option.outcomes.map((outcome,index)=>pcV934EventOutcomeMarkup(option,outcome,index)).join('')}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

pcV930AdvanceMarkup = function(state){
  const event = pcV934EnsureCareerEvent(state);
  if(event) return pcV934EventMarkup(state,event);
  return pcV934BaseAdvanceMarkup(state);
};

function pcV934EventOutcomeNodes(optionId){
  return Array.from(document.querySelectorAll('[data-pc-event-outcome]')).filter(node => String(node.dataset.pcEventOption || '') === String(optionId));
}

function pcV934ResolveCareerEvent(optionId){
  if(pcV934EventRoulette?.active || pcV930RouletteState?.active) return;
  const state = pcCareerState();
  const event = state?.careerEvent;
  if(!state || !event) return;
  const option = event.options.find(item => String(item.id) === String(optionId));
  if(!option) return;
  const picked = pcV934PickOutcome(state,option);
  pcSetCareerState(state);
  const nodes = pcV934EventOutcomeNodes(option.id);
  const buttons = Array.from(document.querySelectorAll('[data-pc-career-event]'));
  const selected = buttons.find(button => String(button.dataset.pcCareerEvent || '') === String(option.id));
  buttons.forEach(button => {
    button.disabled = true;
    button.classList.toggle('is-selected',button===selected);
    button.classList.toggle('is-dimmed',button!==selected);
  });
  const status = document.querySelector('[data-pc-event-status]');
  if(status) status.textContent = 'Resolviendo el evento…';
  if(!nodes.length){ pcV934ApplyEventResult(state,event,option,picked.outcome); return; }
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = reduced ? 3 : 11;
  let step = 0;
  pcV934EventRoulette = { active:true };
  const tick = () => {
    const last = step >= steps-1;
    const activeIndex = last ? picked.index : step % nodes.length;
    nodes.forEach((node,index) => {
      node.classList.toggle('is-lit',index===activeIndex);
      node.classList.toggle('is-final',last && index===activeIndex);
    });
    if(last){
      if(status) status.textContent = 'Resultado definido';
      setTimeout(() => {
        pcV934EventRoulette = null;
        pcV934ApplyEventResult(state,event,option,picked.outcome);
      },reduced?160:380);
      return;
    }
    step += 1;
    setTimeout(tick,reduced?60:75+step*14);
  };
  tick();
}

function pcV934StarClass(state){
  const overall = Number(state?.player?.overall || 0);
  return overall >= 95 ? 2 : overall >= 90 ? 1 : 0;
}

pcPlayerMatchContribution = function(state,rating,minutes){
  const output = PLAYER_CAREER_POSITION_OUTPUT[state.player.position] || PLAYER_CAREER_POSITION_OUTPUT.MC;
  const overall = Number(state.player.overall || 50);
  const starClass = pcV934StarClass(state);
  const levelMultiplier = 0.64 + overall/108;
  const confidenceMultiplier = 0.88 + Number(state.player.trust || 50)/420;
  const starMultiplier = starClass===2 ? 1.28 : starClass===1 ? 1.12 : 1;
  const minutesFactor = Math.max(0,Number(minutes || 0))/90;
  const goalChance = pcClamp(output.goals*levelMultiplier*confidenceMultiplier*starMultiplier*minutesFactor,0,0.92);
  const assistChance = pcClamp(output.assists*levelMultiplier*confidenceMultiplier*starMultiplier*minutesFactor,0,0.88);
  let goals = pcChance(state,goalChance) ? 1 : 0;
  let assists = pcChance(state,assistChance) ? 1 : 0;
  const attacking = ['DC','EI','ED','MCO','MI','MD'].includes(String(state.player.position || ''));
  if(starClass===2 && attacking && goals && pcChance(state,goalChance*0.18)) goals += 1;
  if(starClass===2 && assists && pcChance(state,assistChance*0.14)) assists += 1;
  const yellow = pcChance(state,output.cards*minutesFactor) ? 1 : 0;
  const red = yellow && pcChance(state,0.022) ? 1 : 0;
  return { goals,assists,yellow,red,rating };
};

pcTeamMatchResult = function(state,playerImpact){
  const overall = Number(state.player?.overall || 0);
  const starClass = pcV934StarClass(state);
  const starBonus = starClass===2 ? 18 : starClass===1 ? 10 : 0;
  const teamStrength = Number(state.club.reputation || 50) + Number(playerImpact || 0) + starBonus + pcRandomBetween(state,-7,7);
  const opponentStrength = pcRandomBetween(state,42,94);
  let probabilityWin = pcClamp(0.44 + (teamStrength-opponentStrength)/115,0.10,0.88);
  if(overall >= 95) probabilityWin = Math.max(probabilityWin,0.72);
  else if(overall >= 90) probabilityWin = Math.max(probabilityWin,0.58);
  const drawProbability = pcClamp(0.28-Math.abs(teamStrength-opponentStrength)/300,0.12,0.29);
  const roll = pcRandom(state);
  if(roll < probabilityWin) return 3;
  if(roll < probabilityWin+drawProbability) return 1;
  return 0;
};

pcSimulateMatch = function(state){
  const player = state.player;
  const overall = Number(player.overall || 50);
  const starClass = pcV934StarClass(state);
  const context = typeof pcV930NormalizeContext === 'function' ? pcV930NormalizeContext(state?.careerContext,state) : { opportunity:0,clubFit:0,adaptationPenalty:0,leagueDifficulty:5 };
  const targetLevel = 43 + Number(state.club.reputation || 50)*0.30 + Math.max(0,Number(context.leagueDifficulty || 5)-5)*0.28;
  const opportunity = Number(context.opportunity || 0);
  const fit = Number(context.clubFit || 0);
  const adaptationPenalty = Number(context.adaptationPenalty || 0);
  let playProbability = pcClamp(0.34+(overall-targetLevel)/34+player.trust/175+opportunity-adaptationPenalty*0.55,0.07,0.97);
  if(starClass===2) playProbability = Math.max(playProbability,0.985);
  else if(starClass===1) playProbability = Math.max(playProbability,0.94);
  const plays = pcChance(state,playProbability) && !state.injury;
  let delta = pcEmptyStats();
  let teamResult = pcTeamMatchResult(state,0);
  if(!plays){
    player.trust = pcClamp(Number(player.trust || 50)-0.15,0,100);
    return { delta,teamResult,played:false,manOfMatch:false };
  }
  let startProbability = pcClamp(0.29+(overall-targetLevel)/22+player.trust/160+opportunity*0.65,0.07,0.95);
  if(starClass===2) startProbability = Math.max(startProbability,0.96);
  else if(starClass===1) startProbability = Math.max(startProbability,0.87);
  const starter = pcChance(state,startProbability);
  const minutes = starter ? pcRandomInt(state,68,90) : pcRandomInt(state,14,38);
  const pressurePenalty = state.season.stage >= 3 ? (55-Number(player.pressure || 50))/180 : 0;
  const regularityNoise = (100-Number(player.regularity || 50))/100*pcRandomBetween(state,-0.8,0.8);
  const output = PLAYER_CAREER_POSITION_OUTPUT[player.position] || PLAYER_CAREER_POSITION_OUTPUT.MC;
  const starRatingBonus = starClass===2 ? 0.66+(overall-95)*0.07 : starClass===1 ? 0.22+(overall-90)*0.07 : 0;
  const rating = pcClamp(
    5.68+(overall-targetLevel)/28+(Number(player.trust || 50)-50)/190+output.ratingBias+regularityNoise-pressurePenalty+fit*0.35-adaptationPenalty*0.65+starRatingBonus+pcRandomBetween(state,-0.42,0.58),
    4.2,9.8
  );
  const contribution = pcPlayerMatchContribution(state,rating,minutes);
  const impact = (rating-6.2)*2.6+contribution.goals*4.4+contribution.assists*2.8+(starClass===2?5:starClass===1?2:0);
  teamResult = pcTeamMatchResult(state,impact);
  const distinctionScore = rating+contribution.goals*0.48+contribution.assists*0.34+(teamResult===3?0.18:0);
  let manOfMatchProbability = distinctionScore>=8.8?0.92:distinctionScore>=8.45?0.76:distinctionScore>=8.10?0.54:distinctionScore>=7.75?0.28:0;
  if(starClass===2 && rating>=7.1) manOfMatchProbability = Math.max(manOfMatchProbability,0.58);
  else if(starClass===1 && rating>=7.2) manOfMatchProbability = Math.max(manOfMatchProbability,0.34);
  const manOfMatch = manOfMatchProbability>0 && pcChance(state,manOfMatchProbability);
  delta = { matches:1,starts:starter?1:0,minutes,goals:contribution.goals,assists:contribution.assists,yellow:contribution.yellow,red:contribution.red,ratingSum:rating,ratingCount:1,bestRating:rating };
  player.trust = pcClamp(Number(player.trust || 50)+(rating-6.3)*0.85+(starter?0.18:0),0,100);
  if(pcChance(state,pcInjuryProbability(state,minutes))) pcCreateInjury(state);
  if(typeof pcV933ResetLegacyState === 'function') pcV933ResetLegacyState(player);
  return { delta,teamResult,played:true,rating,minutes,manOfMatch };
};

pcCupFinalOutcome = function(state,competition,strengthBonus=0){
  if(!competition?.active) return;
  const stats = state.season.stats;
  const overall = Number(state.player?.overall || 0);
  const starBonus = overall>=95 ? 24 : overall>=90 ? 13 : overall>=86 ? 5 : 0;
  const contribution = Number(stats.goals || 0)*0.82+Number(stats.assists || 0)*0.62+Math.max(0,pcAverageRating(stats)-6.3)*3.2;
  const strength = Number(state.club.reputation || 50)+strengthBonus+starBonus+contribution+pcRandomBetween(state,-14,14);
  if(strength>=92){ competition.round='Campeón';competition.status='Campeón';competition.champion=true; }
  else if(strength>=82){ competition.round='Final';competition.status='Subcampeón'; }
  else if(strength>=73){ competition.round='Semifinal';competition.status='Eliminado en semifinales'; }
  else if(strength>=63){ competition.round='Cuartos de final';competition.status='Eliminado en cuartos'; }
  else if(strength>=54){ competition.round='Octavos de final';competition.status='Eliminado en octavos'; }
  else { competition.round='Fase inicial';competition.status='Eliminado en fase inicial'; }
};

pcAwardSeasonHonors = function(state){
  const stats = pcNormalizeStats(state.season.stats);
  const average = pcAverageRating(stats);
  const matches = Number(stats.matches || 0);
  const overall = Number(state.player?.overall || 0);
  const contributions = Number(stats.goals || 0)+Number(stats.assists || 0)*0.8;
  const honors = [];
  const league = state.season.competitions?.league;
  if(league?.active && matches>=14 && average>=6.75){
    let chance;
    if(overall>=95) chance = pcClamp(0.91+(average-7)*0.08,0.91,0.98);
    else if(overall>=90) chance = pcClamp(0.58+(average-7)*0.24+Math.min(0.12,contributions/120),0.58,0.88);
    else {
      const positionBonus = Number(league.position || 18)<=3?0.16:Number(league.position || 18)<=7?0.08:0;
      chance = pcClamp(0.10+(average-7.05)*0.50+Math.min(0.18,contributions/86)+positionBonus+pcV931CompetitionPrestigeBonus(state),0.10,0.82);
    }
    if(pcChance(state,chance)) honors.push(pcRecordSeasonAward(state,'leaguePlayer','Mejor jugador de la liga',league.name || 'Liga'));
  }
  const cups = ['nationalCup','international','clubWorldCup'].map(key=>state.season.competitions?.[key]).filter(item=>item?.active).sort((a,b)=>pcCompetitionAwardWeight(b)-pcCompetitionAwardWeight(a));
  const bestCup = cups[0] || null;
  const weight = pcCompetitionAwardWeight(bestCup);
  if(bestCup && weight>=1 && matches>=9 && average>=6.70){
    let chance;
    if(overall>=95) chance = pcClamp(0.88+weight*0.018,0.88,0.98);
    else if(overall>=90) chance = pcClamp(0.52+weight*0.055+(average-7)*0.22,0.52,0.88);
    else chance = pcClamp(0.09+(average-7)*0.44+weight*0.06+Math.min(0.16,contributions/92)+pcV931CompetitionPrestigeBonus(state),0.09,0.78);
    if(pcChance(state,chance)) honors.push(pcRecordSeasonAward(state,'cupPlayer','Mejor jugador de copa',bestCup.name || 'Copa'));
  }
  if(overall>=90 && matches>=18 && average>=6.85){
    const eliteClub = Number(state.club?.reputation || 0)>=82;
    const chance = overall>=95
      ? pcClamp((eliteClub?0.92:0.78)+(average-7.2)*0.05,0.78,0.98)
      : pcClamp((eliteClub?0.48:0.34)+(overall-90)*0.055+(average-7.2)*0.16,0.30,0.76);
    if(pcChance(state,chance)) honors.push(pcRecordSeasonAward(state,'worldPlayer','Bota de oro al mejor jugador del mundo','Temporada mundial'));
  }
  return honors;
};

pcApplyDevelopment = function(state,matchesPlayed){
  state.careerArc = pcV934NormalizeArc(state.careerArc,state);
  const player = state.player;
  const ageFactor = pcV934CurveAgeFactor(state);
  const ceiling = Math.max(Number(player.peakOverall || player.potential || player.overall),Number(player.overall || 0));
  const gap = Math.max(0,ceiling-Number(player.overall || 0));
  const professional = 0.64+Number(player.professionalism || 50)/120;
  const minutesFactor = 0.55+Math.min(1.22,Number(matchesPlayed || 0)/6.2);
  const profileFactor = PLAYER_CAREER_PROFILES[player.profile]?.growth || 1;
  const gapFactor = gap<=0?0:Math.min(1.48,gap/16);
  const track = Number(player.growthTrackMultiplier || 1);
  const context = typeof pcV930NormalizeContext==='function'?pcV930NormalizeContext(state.careerContext,state):{developmentMultiplier:1};
  const slumpLevel = Number(state.careerArc.slumpLevel || 0);
  const slumpFactor = pcClamp(1-slumpLevel*0.12,0.52,1);
  const comebackBonus = Math.min(0.24,Number(state.careerArc.comebackCredit || 0)*0.04);
  let progress;
  if(ageFactor < 0){
    const declineStrength = 0.62 + Number(state.careerArc.declineRate || 0.25);
    progress = ageFactor * declineStrength * (0.88 + Math.max(0,Number(matchesPlayed || 0)-18)/90);
  }else{
    progress = ageFactor*professional*minutesFactor*profileFactor*gapFactor*track*Number(context.developmentMultiplier || 1)*slumpFactor*0.36;
    if(progress>0) progress *= PLAYER_CAREER_GROWTH_MULTIPLIER;
  }
  progress += Number(player.extraGrowth || 0)+comebackBonus;
  if(slumpLevel>=3 && progress>0) progress -= 0.10*slumpLevel;
  player.extraGrowth = 0;
  player.growthProgress = Number(player.growthProgress || 0)+progress;
  let changed = 0;
  while(player.growthProgress>=1 && player.overall<ceiling && player.overall<99){ player.overall=pcRound(player.overall+1,1);player.growthProgress-=1;changed+=1; }
  while(player.growthProgress<=-1 && player.overall>35){ player.overall=pcRound(player.overall-1,1);player.growthProgress+=1;changed-=1; }
  if(changed!==0) pcRecordEvent(state,'development',`${state.player.name} ${changed>0?'mejoró':'redujo'} su media a ${Math.round(state.player.overall)}.`);
  return changed;
};

pcV930MoveChoice = function(state,offer){
  const arc = state.careerArc = pcV934NormalizeArc(state.careerArc,state);
  const slump = Number(arc.slumpLevel || 0);
  const repGap = Number(offer.club?.reputation || 50)-Number(state.club?.reputation || 50);
  const countryChange = String(offer.club?.country || '')!==String(state.club?.country || '');
  const leagueGap = pcV930LeagueDifficulty(offer.club)-pcV930LeagueDifficulty(state.club);
  const roleOpportunity = pcV930RoleOpportunity(offer.role);
  const adaptation = Number(state.player?.adaptation || 50);
  const overall = Number(state.player?.overall || 50);
  let successChance = 43+adaptation*0.18-(countryChange?7:0)-Math.max(0,repGap)*0.15-Math.max(0,leagueGap)*0.65+roleOpportunity*28+slump*5;
  if(overall>=90) successChance += 10;
  successChance = Math.round(pcClamp(successChance,32,72));
  let neutralChance = Math.round(pcClamp(36-slump*2+(overall>=90?4:0),22,40));
  let failChance = 100-successChance-neutralChance;
  if(failChance<8){ neutralChance-=8-failChance;failChance=8; }
  const elite = Number(offer.club?.reputation || 50)>=84;
  const recoveryGain = slump>=2?1:0;
  const failureLoss = slump>=2?2:1;
  return {
    id:String(offer.id),type:'move',offer:{...offer,club:{...offer.club}},club:{...offer.club},
    title:`Ir a ${offer.club.name}`,
    subtitle:`${offer.type==='loan'?'Cesión':'Transferencia'} · ${offer.role}`,
    detail:`Prestigio ${Math.round(Number(offer.club.reputation || 0))} · ${offer.club.divisionName} · ${offer.club.country}`,
    outcomes:[
      {
        chance:successChance,tone:'positive',
        description:slump?`Reinicio exitoso: +${recoveryGain} Media · recuperás minutos`:`Encaje ideal: +${elite?8:6} reputación · mejores minutos`,
        effects:{ overall:recoveryGain,reputation:elite?8:6,trust:9,growthProgress:elite?0.38:0.24 },
        context:{ source:'move',label:'Encaje ideal',clubFit:0.11,adaptationPenalty:countryChange?0.03:0,opportunity:roleOpportunity+0.07,developmentMultiplier:elite?1.18:1.08 },
        arc:{ slumpDelta:slump?-Math.min(3,slump):0,comebackCredit:slump?2:1,successfulMoves:1 }
      },
      {
        chance:neutralChance,tone:'neutral',
        description:'Adaptación gradual: minutos irregulares · progreso moderado',
        effects:{ trust:-2,growthProgress:0.18 },
        context:{ source:'move',label:'Adaptación gradual',clubFit:0,adaptationPenalty:countryChange?0.09:0.05,opportunity:roleOpportunity-0.03,developmentMultiplier:1.01 },
        arc:{ slumpDelta:slump>=3?-1:0,comebackCredit:1 }
      },
      {
        chance:failChance,tone:'negative',
        description:`El cambio sale mal: −${failureLoss} Media · menos minutos`,
        effects:{ overall:-failureLoss,trust:-13,growthProgress:-0.25 },
        context:{ source:'move',label:'Ciclo negativo',clubFit:-0.11,adaptationPenalty:countryChange?0.19:0.13,opportunity:roleOpportunity-0.14,developmentMultiplier:0.88 },
        arc:{ slumpDelta:1,badMoves:1 }
      }
    ]
  };
};

pcV930ApplyResolvedMarketChoice = function(state,choice,outcome){
  pcV934ApplyArcEffect(state,outcome?.arc);
  pcV934BaseApplyResolvedMarketChoice(state,choice,outcome);
  state.careerArc = pcV934NormalizeArc(state.careerArc,state);
  state.careerEvent = null;
  state.careerEventSeason = 0;
  pcV934GenerateCareerEvent(state);
  state.player.value = pcCalculateValue(state);
  pcPersist(state,true);
};

pcFinalizeSeason = function(state){
  state.careerArc = pcV934NormalizeArc(state.careerArc,state);
  const stats = pcNormalizeStats(state.season?.stats);
  const rating = pcAverageRating(stats);
  const starts = Number(stats.starts || 0);
  const matches = Number(stats.matches || 0);
  const overall = Number(state.player?.overall || 0);
  const arc = state.careerArc;
  const badSeason = matches<13 || starts<7 || (rating>0 && rating<6.25);
  const strongSeason = matches>=18 && rating>=7.05;
  if(overall>=90){
    arc.slumpLevel = Math.max(0,Number(arc.slumpLevel || 0)-1);
    arc.comebackCredit = Math.max(Number(arc.comebackCredit || 0),1);
  }else if(strongSeason){
    arc.slumpLevel = Math.max(0,Number(arc.slumpLevel || 0)-1);
    arc.comebackCredit = Math.min(6,Number(arc.comebackCredit || 0)+1);
  }else if(badSeason){
    arc.slumpLevel = pcClamp(Number(arc.slumpLevel || 0)+1,0,5);
    arc.slumpSeasons = Number(arc.slumpSeasons || 0)+1;
    const lossChance = pcClamp(0.18+arc.slumpLevel*0.10,0.18,0.62);
    if(arc.slumpLevel>=2 && pcChance(state,lossChance)){
      state.player.overall = pcClamp(Number(state.player.overall || 0)-1,35,99);
      pcRecordEvent(state,'development',`${state.player.name} perdió un punto de media tras una temporada de estancamiento.`);
    }
  }
  arc.lastSeasonRating = rating;
  arc.lastSeasonOverall = Number(state.player.overall || 0);
  const summary = pcV934BaseFinalizeSeason(state);
  state.player.value = pcCalculateValue(state);
  return summary;
};

if(typeof document !== 'undefined'){
  document.addEventListener('click',event => {
    const button = event.target.closest('[data-pc-career-event]');
    if(button){ pcV934ResolveCareerEvent(button.dataset.pcCareerEvent); }
  });
}
