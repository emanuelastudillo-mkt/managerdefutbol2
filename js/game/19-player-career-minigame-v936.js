/*
  V9.36 · Ser jugador
  - Renovaciones reforzadas en la etapa juvenil y una oportunidad post-22 en el 95% de las carreras.
  - Mercado más amplio, con ligas y clubes de menor reputación al final de la carrera.
  - Deterioro obligatorio de Media desde los 32 años.
  - Distribución de techo máximo: 76/85/88/92/97/99 según tabla definida.
  - Nuevos eventos de carrera, incluidos dopaje, suspensión anual y exposición mediática.
*/

const pcV936BaseCreatePlayerCareer = pcCreatePlayerCareer;
const pcV936BaseNormalizeCareer = pcNormalizeCareer;
const pcV936BaseEventPool = pcV934EventPool;
const pcV936BaseApplyEventResult = pcV934ApplyEventResult;
const pcV936BaseRecoverInjuryBlock = pcRecoverInjuryBlock;
const pcV936BaseFinalizeSeason = pcFinalizeSeason;
const pcV936BaseApplyDevelopment = pcApplyDevelopment;
const pcV936BaseApplyResolvedMarketChoice = pcV930ApplyResolvedMarketChoice;
const pcV936BaseMoveChoice = pcV930MoveChoice;
const pcV936BaseBuildOffer = pcV930BuildOffer;

function pcV936HashUnit(value){
  return (Math.abs(Number(pcSeedFromText(String(value || 'player')) || 0)) % 1000000) / 1000000;
}

function pcV936PotentialBand(state){
  const key = `${state?.player?.id || ''}|${state?.player?.name || ''}|${state?.rngSeed || 0}|v936-potential`;
  const roll = pcV936HashUnit(key);
  if(roll < 0.10) return { max:76,label:'76',share:10 };
  if(roll < 0.50) return { max:85,label:'85',share:40 };
  if(roll < 0.75) return { max:88,label:'88',share:25 };
  if(roll < 0.90) return { max:92,label:'92',share:15 };
  if(roll < 0.98) return { max:97,label:'97',share:8 };
  return { max:99,label:'99',share:2 };
}

function pcV936ApplyPotentialDistribution(state){
  if(!state?.player) return state;
  const band = pcV936PotentialBand(state);
  const current = Number(state.player.overall || 50);
  const firstMigration = Number(state.player.potentialDistributionVersion || 0) < 1;
  if(firstMigration){
    state.player.potentialBandMax = Math.max(current,band.max);
    state.player.peakOverall = Math.max(current,band.max);
    state.player.potential = Math.max(current,band.max);
    state.player.potentialDistributionVersion = 1;
    state.player.potentialBandLabel = band.label;
    state.player.potentialBandShare = band.share;
    if(typeof pcV935CareerPlan === 'function'){
      const injuryTarget = Number(state.careerPlan?.injuryTarget || 0) || undefined;
      state.careerPlan = pcV935CareerPlan(state,injuryTarget ? { injuryTarget } : {});
    }
  }else{
    const stored = Math.max(current,Number(state.player.potentialBandMax || state.player.peakOverall || band.max));
    state.player.potentialBandMax = pcClamp(stored,current,99);
    state.player.peakOverall = state.player.potentialBandMax;
    state.player.potential = state.player.potentialBandMax;
  }
  return state;
}

function pcV936NormalizeRenewalPlan(raw,state){
  const key = `${state?.player?.id || ''}|${state?.rngSeed || 0}|post22-renewal`;
  return {
    post22Guaranteed:raw?.post22Guaranteed == null ? pcV936HashUnit(key) < 0.95 : Boolean(raw.post22Guaranteed),
    post22OfferMade:Boolean(raw?.post22OfferMade),
    post22Accepted:Math.max(0,Math.round(Number(raw?.post22Accepted || 0))),
    under22Offers:Math.max(0,Math.round(Number(raw?.under22Offers || 0))),
    under22Accepted:Math.max(0,Math.round(Number(raw?.under22Accepted || 0))),
    lastOfferSeason:Math.max(0,Math.round(Number(raw?.lastOfferSeason || 0)))
  };
}

pcCreatePlayerCareer = function(form){
  const state = pcV936BaseCreatePlayerCareer(form);
  state.schemaVersion = Math.max(10,Number(state.schemaVersion || 0));
  state.viewVersion = 'V9.36';
  pcV936ApplyPotentialDistribution(state);
  state.renewalPlan = pcV936NormalizeRenewalPlan(null,state);
  state.player.value = pcCalculateValue(state);
  return state;
};

pcNormalizeCareer = function(raw){
  const normalized = pcV936BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(10,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.36';
  pcV936ApplyPotentialDistribution(normalized);
  normalized.renewalPlan = pcV936NormalizeRenewalPlan(normalized.renewalPlan,normalized);
  normalized.careerSuspension = normalized.careerSuspension && typeof normalized.careerSuspension === 'object'
    ? { ...normalized.careerSuspension, seasonsRemaining:Math.max(0,Math.round(Number(normalized.careerSuspension.seasonsRemaining || 0))) }
    : null;
  if(normalized.careerSuspension && normalized.careerSuspension.seasonsRemaining <= 0) normalized.careerSuspension = null;
  normalized.player.overall = Math.min(Number(normalized.player.overall || 0),Number(normalized.player.peakOverall || 99));
  normalized.player.value = pcCalculateValue(normalized);
  return normalized;
};

function pcV936NormalizeCareerEvent(raw){
  if(!raw || typeof raw !== 'object') return null;
  const options = Array.isArray(raw.options) ? raw.options.slice(0,3).map(option => ({
    ...option,
    id:String(option?.id || ''),
    label:String(option?.label || 'Elegir'),
    outcomes:Array.isArray(option?.outcomes) ? option.outcomes.slice(0,5).map(outcome => ({
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

pcV934NormalizeCareerEvent = function(raw){
  return pcV936NormalizeCareerEvent(raw);
};

function pcV936ExtraEvents(state){
  const reputation = Number(state?.player?.reputation || 0);
  const overall = Number(state?.player?.overall || 0);
  const age = Number(state?.player?.age || 18);
  const slump = Number(state?.careerArc?.slumpLevel || 0);
  const events = [
    {
      id:'performance-substances',category:'Disciplina',icon:'medical',title:'Una mejora demasiado rápida',
      text:'Un preparador clandestino ofrece sustancias para acelerar tu evolución. Cuanto más agresivo sea el plan, mayor es el riesgo de una suspensión de una temporada.',
      options:[
        { id:'substances-reject',label:'Rechazar y denunciar la propuesta',outcomes:[
          { chance:76,tone:'positive',description:'+7 reputación · protegés tu carrera',effects:{ reputation:7,professionalism:5 },arc:{ slumpDelta:-1 } },
          { chance:24,tone:'neutral',description:'+25% de progreso por entrenamiento limpio',effects:{ growthProgress:0.25,professionalism:3 } }
        ]},
        { id:'substances-micro',label:'Aceptar una microdosis',outcomes:[
          { chance:48,tone:'positive',description:'+1 Media',effects:{ overall:1,reputation:2 } },
          { chance:27,tone:'positive',description:'+2 Media',effects:{ overall:2,reputation:3 } },
          { chance:25,tone:'negative',description:'Control positivo: suspensión de 1 año · −2 Media',effects:{ overall:-2,reputation:-18,trust:-12 },suspension:{ seasons:1,reason:'Suspensión por dopaje' },arc:{ slumpDelta:2,badMoves:1 } }
        ]},
        { id:'substances-aggressive',label:'Seguir el ciclo agresivo',outcomes:[
          { chance:20,tone:'positive',description:'+3 Media',effects:{ overall:3,reputation:4 } },
          { chance:12,tone:'positive',description:'+4 Media',effects:{ overall:4,reputation:5 } },
          { chance:5,tone:'positive',description:'+5 Media',effects:{ overall:5,reputation:7 } },
          { chance:63,tone:'negative',description:'Escándalo: suspensión de 1 año · −4 Media',effects:{ overall:-4,reputation:-28,trust:-18 },suspension:{ seasons:1,reason:'Suspensión grave por dopaje' },arc:{ slumpDelta:3,badMoves:2 } }
        ]}
      ]
    },
    {
      id:'hollywood-romance',category:'Vida pública',icon:'star',title:'Romance con una actriz de Hollywood',
      text:'La relación se convierte en noticia internacional y modifica por completo la exposición pública de tu carrera.',
      options:[
        { id:'romance-public',label:'Hacer pública la relación',outcomes:[
          { chance:54,tone:'positive',description:'+18 reputación · mayor atractivo internacional',effects:{ reputation:18,pressure:4 } },
          { chance:31,tone:'negative',description:'Distracción mediática: −1 Media · menos minutos',effects:{ overall:-1,trust:-7 },context:{ opportunity:-0.07 },arc:{ slumpDelta:1 } },
          { chance:15,tone:'negative',description:'Ruptura escandalosa: −2 Media · −12 reputación',effects:{ overall:-2,reputation:-12,trust:-8 },arc:{ slumpDelta:2 } }
        ]},
        { id:'romance-private',label:'Mantenerla fuera de los medios',outcomes:[
          { chance:68,tone:'positive',description:'+35% de progreso · estabilidad personal',effects:{ growthProgress:0.35,professionalism:3 } },
          { chance:32,tone:'neutral',description:'La relación no modifica tu carrera',effects:{} }
        ]}
      ]
    },
    {
      id:'legendary-forward-camp',category:'Entrenamiento',icon:'football',title:'Campus privado con un goleador histórico',
      text:'Un delantero retirado, famoso por sus récords, ofrece trabajar definición, movimientos y lectura del área.',
      options:[
        { id:'forward-camp-accept',label:'Entrenar durante todo el receso',outcomes:[
          { chance:45,tone:'positive',description:'+1 Media · mayor producción ofensiva',effects:{ overall:1,growthProgress:0.30,reputation:5 } },
          { chance:38,tone:'positive',description:'+65% de progreso · mejor lectura ofensiva',effects:{ growthProgress:0.65,reputation:3 } },
          { chance:17,tone:'negative',description:'Sobrecarga: lesión media · −1 Media',effects:{ overall:-1 },injury:{ name:'Sobrecarga en el campus privado',blocks:2,severity:'Media' },arc:{ slumpDelta:1 } }
        ]},
        { id:'forward-camp-decline',label:'Descansar y mantener la rutina',outcomes:[
          { chance:74,tone:'neutral',description:'Sin cambios inmediatos',effects:{} },
          { chance:26,tone:'positive',description:'+25% de progreso por recuperación',effects:{ growthProgress:0.25 } }
        ]}
      ]
    },
    {
      id:'streaming-documentary',category:'Prensa',icon:'mic',title:'Una plataforma quiere filmar tu temporada',
      text:'La producción promete convertirte en una figura global, pero las cámaras acompañarán cada entrenamiento y cada conflicto.',
      options:[
        { id:'documentary-accept',label:'Aceptar el documental',outcomes:[
          { chance:50,tone:'positive',description:'+16 reputación · nuevas ofertas internacionales',effects:{ reputation:16,pressure:4 } },
          { chance:34,tone:'neutral',description:'+7 reputación · presión creciente',effects:{ reputation:7,pressure:-2 } },
          { chance:16,tone:'negative',description:'La exposición te perjudica: −1 Media · −8 confianza',effects:{ overall:-1,trust:-8 },arc:{ slumpDelta:1 } }
        ]},
        { id:'documentary-reject',label:'Priorizar el fútbol',outcomes:[
          { chance:70,tone:'positive',description:'+40% de progreso · mayor profesionalismo',effects:{ growthProgress:0.40,professionalism:4 } },
          { chance:30,tone:'neutral',description:'La oportunidad mediática desaparece',effects:{} }
        ]}
      ]
    },
    {
      id:'experimental-surgery',category:'Salud',icon:'medical',title:'Tratamiento experimental en el extranjero',
      text:'Un especialista propone corregir molestias crónicas. El procedimiento puede prolongar tu carrera o dejar secuelas.',
      options:[
        { id:'surgery-accept',label:'Aceptar el procedimiento',outcomes:[
          { chance:58,tone:'positive',description:'+1 Media · menor riesgo de lesiones',effects:{ overall:1,professionalism:4 },arc:{ slumpDelta:-2,comebackCredit:2 } },
          { chance:27,tone:'neutral',description:'Recuperación lenta: perdés minutos, sin cambio de Media',effects:{ trust:-3 },injury:{ name:'Recuperación del tratamiento experimental',blocks:2,severity:'Media' } },
          { chance:15,tone:'negative',description:'Secuela permanente: −2 Media',effects:{ overall:-2,reputation:-4 },arc:{ slumpDelta:2 } }
        ]},
        { id:'surgery-decline',label:'Continuar con tratamiento tradicional',outcomes:[
          { chance:72,tone:'neutral',description:'La carrera continúa sin cambios',effects:{} },
          { chance:28,tone:'negative',description:'Las molestias persisten: −35% de progreso',effects:{ growthProgress:-0.35 },arc:{ slumpDelta:1 } }
        ]}
      ]
    },
    {
      id:'famous-agent-promise',category:'Mercado',icon:'contract',title:'Un representante de estrellas te busca',
      text:'El agente asegura que puede llevarte a una liga más visible, aunque exige forzar tu salida y aceptar un rol incierto.',
      options:[
        { id:'agent-sign',label:'Firmar con el representante',outcomes:[
          { chance:46,tone:'positive',description:'+12 reputación · mejores clubes interesados',effects:{ reputation:12,trust:4 },arc:{ successfulMoves:1 } },
          { chance:34,tone:'neutral',description:'+5 reputación · futuro incierto',effects:{ reputation:5 } },
          { chance:20,tone:'negative',description:'Promesas vacías: −1 Media · menos minutos',effects:{ overall:-1,trust:-10 },context:{ opportunity:-0.08 },arc:{ slumpDelta:1,badMoves:1 } }
        ]},
        { id:'agent-stay',label:'Mantener a tu representante actual',outcomes:[
          { chance:64,tone:'positive',description:'+6 confianza · estabilidad contractual',effects:{ trust:6 } },
          { chance:36,tone:'neutral',description:'No aparecen cambios inmediatos',effects:{} }
        ]}
      ]
    },
    {
      id:'captain-fallout',category:'Vestuario',icon:'users',title:'Una figura histórica te responsabiliza',
      text:'El referente del plantel culpa públicamente a los jóvenes por una mala campaña y te señala como ejemplo.',
      options:[
        { id:'captain-confront',label:'Responder delante del vestuario',outcomes:[
          { chance:43,tone:'positive',description:'+1 Media · +9 reputación',effects:{ overall:1,reputation:9,leadership:6 },arc:{ slumpDelta:-1 } },
          { chance:37,tone:'neutral',description:'+5 reputación · relación tensa',effects:{ reputation:5,trust:-3 } },
          { chance:20,tone:'negative',description:'El plantel respalda al referente: −1 Media · menos minutos',effects:{ overall:-1,trust:-12 },context:{ opportunity:-0.10 },arc:{ slumpDelta:1 } }
        ]},
        { id:'captain-learn',label:'Escuchar y trabajar en silencio',outcomes:[
          { chance:72,tone:'positive',description:'+55% de progreso · +4 liderazgo',effects:{ growthProgress:0.55,leadership:4 } },
          { chance:28,tone:'negative',description:'La crítica te afecta: −6 confianza',effects:{ trust:-6 } }
        ]}
      ]
    },
    {
      id:'career-reset-abroad',category:'Carrera',icon:'trend',title:slump>=2?'Una liga menor ofrece reconstruir tu carrera':'Propuesta inesperada desde una liga menor',
      text:'Un club de baja reputación garantiza titularidad, libertad táctica y un proyecto construido alrededor tuyo.',
      options:[
        { id:'reset-listen',label:'Escuchar el proyecto',outcomes:[
          { chance:56,tone:'positive',description:'Recuperás protagonismo · +1 Media',effects:{ overall:1,trust:10 },arc:{ slumpDelta:-3,comebackCredit:2 } },
          { chance:31,tone:'neutral',description:'Más minutos, pero el progreso se vuelve lento',effects:{ growthProgress:-0.12,trust:7 },context:{ opportunity:0.18,developmentMultiplier:0.82 } },
          { chance:13,tone:'negative',description:'El nivel acelera el deterioro: −2 Media',effects:{ overall:-2,reputation:-6 },arc:{ slumpDelta:2 } }
        ]},
        { id:'reset-ignore',label:'Esperar una oferta más prestigiosa',outcomes:[
          { chance:52,tone:'neutral',description:'No cambia tu situación',effects:{} },
          { chance:48,tone:'negative',description:'El estancamiento continúa: −1 Media',effects:{ overall:-1 },arc:{ slumpDelta:1 } }
        ]}
      ]
    }
  ];
  return events.filter(event => {
    if(event.id === 'hollywood-romance') return reputation >= 38 || overall >= 76;
    if(event.id === 'performance-substances') return age >= 18;
    if(event.id === 'career-reset-abroad') return age >= 27 || slump >= 1;
    return true;
  });
}

pcV934EventPool = function(state){
  return [...pcV936BaseEventPool(state),...pcV936ExtraEvents(state)];
};

function pcV936ApplySuspension(state,suspension){
  if(!suspension) return;
  const seasons = Math.max(1,Math.round(Number(suspension.seasons || 1)));
  const reason = String(suspension.reason || 'Suspensión disciplinaria');
  state.careerSuspension = { seasonsRemaining:seasons,reason,season:Number(state.season?.number || 1),year:Number(state.season?.year || 2026) };
  state.injury = {
    id:pcUniqueId(state,'career-suspension'),name:reason,severity:'Suspensión',blocksRemaining:4,originalBlocks:4,
    recurrenceRisk:0,season:Number(state.season?.number || 1),year:Number(state.season?.year || 2026),isSuspension:true
  };
  pcRecordEvent(state,'suspension',`${state.player.name} recibió una suspensión de ${seasons} temporada${seasons===1?'':'s'}: ${reason}.`);
}

pcV934ApplyEventResult = function(state,event,option,outcome){
  pcV936BaseApplyEventResult(state,event,option,outcome);
  if(outcome?.suspension) pcV936ApplySuspension(state,outcome.suspension);
  state.player.overall = pcClamp(Math.min(Number(state.player.overall || 0),Number(state.player.peakOverall || 99)),35,99);
  state.player.value = pcCalculateValue(state);
  pcPersist(state,true);
};

pcRecoverInjuryBlock = function(state){
  if(state?.injury?.isSuspension){
    state.injury.blocksRemaining = Math.max(0,Number(state.injury.blocksRemaining || 0)-1);
    if(state.injury.blocksRemaining <= 0){
      const reason = String(state.injury.name || 'Suspensión disciplinaria');
      state.injury = null;
      if(state.careerSuspension){
        state.careerSuspension.seasonsRemaining = Math.max(0,Number(state.careerSuspension.seasonsRemaining || 1)-1);
        if(state.careerSuspension.seasonsRemaining <= 0) state.careerSuspension = null;
      }
      pcRecordEvent(state,'reinstatement',`${state.player.name} cumplió la sanción por ${reason.toLowerCase()} y quedó habilitado.`);
      return { recovered:true,name:reason,suspension:true };
    }
    return { recovered:false,name:state.injury.name,suspension:true };
  }
  return pcV936BaseRecoverInjuryBlock(state);
};

function pcV936DeclinePerBlock(state){
  const age = Number(state?.player?.age || 32);
  const curve = String(state?.careerArc?.curveId || 'sostenida');
  const baseByCurve = { meteorica:0.58,explosiva:0.48,volatil:0.43,sostenida:0.31,lenta:0.27,tardia:0.29 };
  const ageExtra = Math.max(0,age-32)*0.035;
  return pcClamp(Number(baseByCurve[curve] || 0.32)+ageExtra,0.24,0.82);
}

pcApplyDevelopment = function(state,matchesPlayed){
  if(Number(state?.player?.age || 18) < 32) return pcV936BaseApplyDevelopment(state,matchesPlayed);
  const player = state.player;
  player.extraGrowth = 0;
  player.growthProgress = Math.min(0,Number(player.growthProgress || 0));
  player.growthProgress -= pcV936DeclinePerBlock(state);
  let changed = 0;
  while(player.growthProgress <= -1 && Number(player.overall || 0) > 35){
    player.overall = pcRound(Number(player.overall || 0)-1,1);
    player.growthProgress += 1;
    changed -= 1;
  }
  if(changed < 0) pcRecordEvent(state,'development',`${state.player.name} entró en la etapa de deterioro y redujo su media a ${Math.round(state.player.overall)}.`);
  return changed;
};

function pcV936SeasonDeclineAmount(state,age){
  const curve = String(state?.careerArc?.curveId || 'sostenida');
  const base = curve === 'meteorica' ? 2 : curve === 'explosiva' ? 2 : curve === 'volatil' ? (pcChance(state,0.48)?2:1) : 1;
  const ageBonus = age >= 38 ? 2 : age >= 35 ? 1 : 0;
  return pcClamp(base+ageBonus,1,4);
}

pcFinalizeSeason = function(state){
  const ageAtSeason = Number(state?.player?.age || 18);
  if(ageAtSeason >= 32){
    const start = Number(state?.season?.overallStart ?? state?.player?.overall ?? 0);
    const decline = pcV936SeasonDeclineAmount(state,ageAtSeason);
    const target = Math.max(35,start-decline);
    if(Number(state.player.overall || 0) > target){
      state.player.overall = target;
      state.player.growthProgress = Math.min(0,Number(state.player.growthProgress || 0));
      pcRecordEvent(state,'development',`${state.player.name} cerró la temporada con una caída de ${decline} punto${decline===1?'':'s'} de media por deterioro físico y técnico.`);
    }
  }
  const summary = pcV936BaseFinalizeSeason(state);
  state.player.overall = pcClamp(Math.min(Number(state.player.overall || 0),Number(state.player.peakOverall || 99)),35,99);
  if(summary){
    summary.overallEnd = Number(state.player.overall || summary.overallEnd || 0);
    const row = Array.isArray(state.history?.seasons) ? state.history.seasons.find(item => Number(item?.season || 0)===Number(summary.season || 0)) : null;
    if(row) row.overallEnd = summary.overallEnd;
  }
  state.player.value = pcCalculateValue(state);
  return summary;
};

function pcV936ClubHistoryIds(state){
  return new Set((state?.history?.clubs || []).map(item => Number(item?.club?.id || 0)).filter(Boolean));
}

function pcV936ClubCountry(club){
  return String(club?.country || (typeof pcClubCountry === 'function' ? pcClubCountry(club) : '') || '');
}

function pcV936CandidateTarget(state){
  const age = Number(state?.player?.age || 18);
  const currentRep = Number(state?.club?.reputation || 50);
  const overall = Number(state?.player?.overall || 50);
  const progress = Number(pcV933SeasonProgress(state) || 0);
  if(age <= 22) return pcClamp(Math.max(currentRep+5,overall+6+Math.max(0,progress)*3),35,98);
  if(age <= 29) return pcClamp(Math.max(currentRep+2,overall+3+Math.max(0,progress)*2),35,98);
  if(age <= 31) return pcClamp(Math.max(overall,currentRep-2),32,94);
  if(age <= 34) return pcClamp(currentRep-10,28,84);
  return pcClamp(currentRep-18,24,76);
}

pcV933OfferCandidates = function(state,count){
  const currentId = Number(state?.club?.id || 0);
  const currentRep = Number(state?.club?.reputation || 50);
  const age = Number(state?.player?.age || 18);
  const desiredRep = pcV936CandidateTarget(state);
  const historyIds = pcV936ClubHistoryIds(state);
  const all = (seed?.clubs || []).filter(club => !pcIsSpecialBotClub(club) && Number(club.id || 0)!==currentId);
  const scored = all.map(club => {
    const rep = Number(pcClubReputation(club) || 50);
    const difficulty = Number(pcV930LeagueDifficulty(club) || 5);
    const country = pcV936ClubCountry(club);
    let score = Math.abs(rep-desiredRep);
    if(historyIds.has(Number(club.id || 0))) score += 18;
    if(age <= 22 && rep <= currentRep) score += 14;
    if(age >= 32){
      score -= Math.max(0,6-difficulty)*1.9;
      score -= Math.max(0,currentRep-rep)*0.08;
      if(rep > currentRep+6) score += 12;
      if(country && country !== String(state.club?.country || '')) score -= 2.2;
    }else if(country && country !== String(state.club?.country || '')) score -= 1.1;
    score += pcRandom(state)*5.8;
    return { club,score,rep,difficulty,country };
  }).sort((a,b)=>a.score-b.score || a.rep-b.rep);

  const selected = [];
  const countries = new Set();
  const divisions = new Set();
  const older = age >= 32;
  if(older){
    const lowLeague = scored.find(item => item.difficulty <= 5 && item.rep <= Math.max(62,currentRep-5));
    if(lowLeague){
      selected.push(lowLeague.club);
      countries.add(lowLeague.country);
      divisions.add(String(lowLeague.club?.divisionId || lowLeague.club?.divisionName || ''));
    }
  }
  for(const item of scored){
    if(selected.some(club=>Number(club.id||0)===Number(item.club.id||0))) continue;
    const division = String(item.club?.divisionId || item.club?.divisionName || '');
    const repeatedCountry = item.country && countries.has(item.country);
    const repeatedDivision = division && divisions.has(division);
    if((repeatedCountry || repeatedDivision) && selected.length < count-1 && scored.length > count+3) continue;
    selected.push(item.club);
    if(item.country) countries.add(item.country);
    if(division) divisions.add(division);
    if(selected.length >= count) break;
  }
  if(selected.length < count){
    for(const item of scored){
      if(selected.some(club=>Number(club.id||0)===Number(item.club.id||0))) continue;
      selected.push(item.club);
      if(selected.length >= count) break;
    }
  }
  return selected.slice(0,count);
};

function pcV936RenewalProbability(state,performance){
  const age = Number(state?.player?.age || 18);
  const plan = state.renewalPlan = pcV936NormalizeRenewalPlan(state.renewalPlan,state);
  if(age <= 22) return performance.good ? 0.995 : 0.94;
  if(plan.post22Guaranteed && !plan.post22OfferMade) return 1;
  if(performance.good) return 0.80;
  if(performance.rating >= 6.65 || performance.progress >= 0 || performance.contributions >= 8) return 0.55;
  return 0.25;
}

function pcV936RecordRenewalOffer(state){
  const plan = state.renewalPlan = pcV936NormalizeRenewalPlan(state.renewalPlan,state);
  const season = Number(state?.season?.number || 0);
  if(plan.lastOfferSeason === season) return;
  plan.lastOfferSeason = season;
  if(Number(state?.player?.age || 18) <= 22) plan.under22Offers += 1;
  else plan.post22OfferMade = true;
}


pcV930NormalizeMarketDecision = function(decision){
  if(!decision || typeof decision !== 'object') return null;
  const choices = Array.isArray(decision.choices) ? decision.choices.map(choice => {
    if(!choice || typeof choice !== 'object') return null;
    const type = choice.type === 'stay' ? 'stay' : 'move';
    const club = pcNormalizeClubSnapshot(choice.club || choice.offer?.club);
    const outcomes = Array.isArray(choice.outcomes) ? choice.outcomes.slice(0,5).map(outcome => ({
      ...outcome,
      chance:pcClamp(Math.round(Number(outcome?.chance || 0)),0,100),
      tone:['positive','negative','neutral'].includes(outcome?.tone) ? outcome.tone : 'neutral'
    })) : [];
    if(!outcomes.length) return null;
    return {
      ...choice,
      id:String(choice.id || ''),
      type,
      club,
      offer:type === 'move' && choice.offer ? { ...choice.offer,club:pcNormalizeClubSnapshot(choice.offer.club || club) } : null,
      outcomes
    };
  }).filter(Boolean).slice(0,4) : [];
  if(choices.length < 2) return null;
  return {
    id:String(decision.id || ''),season:Number(decision.season || 0),year:Number(decision.year || 0),version:6,
    offerCount:choices.length,allowStay:choices.some(choice=>choice.type==='stay'),choices
  };
};

pcV930BuildMarketDecision = function(state){
  if(!state || state.status!=='active' || Number(state.season?.stage || 0)!==5) return null;
  const totalCount = pcV933OfferCount(state);
  const performance = pcV935SeasonPerformance(state);
  const includeSameClub = pcChance(state,pcV936RenewalProbability(state,performance));
  const externalCount = Math.max(1,totalCount-(includeSameClub?1:0));
  let clubs = pcV933OfferCandidates(state,externalCount);
  const selectedIds = new Set(clubs.map(club=>Number(club.id||0)));
  const age = Number(state.player?.age || 18);
  const includeSmall = externalCount>=1 && pcChance(state,age>=32?0.52:0.24);
  if(includeSmall){
    const small = pcV935SmallClubCandidate(state,selectedIds);
    if(small){
      if(clubs.length>=externalCount) clubs[clubs.length-1]=small;
      else clubs.push(small);
    }
  }
  const offers = clubs.slice(0,externalCount).map(club => includeSmall && Number(pcClubReputation(club)||50)<=Number(state.club?.reputation||50)-12
    ? pcV935SmallClubOffer(state,club)
    : pcV936BaseBuildOffer(state,club)).filter(Boolean);
  state.pendingOffers = offers;
  const choices = [];
  if(includeSameClub){
    choices.push(pcV935SameClubChoice(state));
    pcV936RecordRenewalOffer(state);
  }
  choices.push(...offers.map(offer=>pcV936BaseMoveChoice(state,offer)));
  while(choices.length<2){
    const extra = pcV933OfferCandidates(state,4).find(club=>!choices.some(choice=>Number(choice.club?.id||0)===Number(club.id||0)));
    if(!extra) break;
    const offer = pcV936BaseBuildOffer(state,extra);
    if(offer){ state.pendingOffers.push(offer);choices.push(pcV936BaseMoveChoice(state,offer)); }
  }
  state.marketDecision = {
    id:pcUniqueId(state,'market-decision-v936'),season:Number(state.season.number||1),year:Number(state.season.year||2026),
    version:6,offerCount:choices.length,allowStay:choices.some(choice=>choice.type==='stay'),choices:choices.slice(0,4)
  };
  return state.marketDecision;
};

pcV930EnsureMarketDecision = function(state){
  if(!state || state.status!=='active' || Number(state.season?.stage||0)!==5) return null;
  const normalized = pcV930NormalizeMarketDecision(state.marketDecision);
  if(!normalized || Number(state.marketDecision?.version||0)<6) pcV930BuildMarketDecision(state);
  else state.marketDecision=normalized;
  return state.marketDecision;
};

pcV930ApplyResolvedMarketChoice = function(state,choice,outcome){
  const wasRenewal = choice?.type === 'stay';
  const age = Number(state?.player?.age || 18);
  pcV936BaseApplyResolvedMarketChoice(state,choice,outcome);
  state.renewalPlan = pcV936NormalizeRenewalPlan(state.renewalPlan,state);
  if(wasRenewal){
    if(age <= 22) state.renewalPlan.under22Accepted += 1;
    else state.renewalPlan.post22Accepted += 1;
  }
  state.player.overall = pcClamp(Math.min(Number(state.player.overall || 0),Number(state.player.peakOverall || 99)),35,99);
  state.player.value = pcCalculateValue(state);
  pcPersist(state,true);
};

pcV930MarketMarkup = function(state){
  const decision = pcV930EnsureMarketDecision(state);
  if(!decision) return '<section class="pc-v930-choice-zone"><p class="muted">No se encontraron propuestas compatibles para esta temporada.</p></section>';
  const age = Number(state?.player?.age || 18);
  const endCareer = age >= 32;
  return `<section class="pc-v930-choice-zone pc-v933-choice-zone pc-v935-choice-zone pc-v936-choice-zone">
    <div class="pc-v930-choice-heading"><div><small>Mercado de pases</small><h3>${decision.choices.length} propuestas de carrera</h3><p>${endCareer?'En la etapa final aparecen ligas y clubes de menor reputación donde todavía podés asegurar protagonismo.':'La renovación y la calidad de los clubes dependen de tu edad, Media y rendimiento.'}</p></div><span data-pc-roulette-status>Elegí una propuesta</span></div>
    <div class="pc-v930-choice-grid pc-v933-choice-grid count-${decision.choices.length}">
      ${decision.choices.map(choice => `<button type="button" class="pc-v930-market-choice ${choice.type==='stay'?'is-current-club':''} ${choice.smallClubOpportunity?'is-small-club':''}" data-pc-market="${pcEscape(choice.id)}">
        <span class="pc-v930-choice-club">${pcClubBadge(choice.club)}<span><strong>${pcEscape(choice.title)}</strong><small>${pcEscape(choice.subtitle)}</small></span>${choice.type==='stay'?'<em>Renovación</em>':choice.smallClubOpportunity?'<em>Más minutos</em>':''}</span>
        <span class="pc-v930-choice-detail">${pcEscape(choice.detail)}</span>
        <span class="pc-v930-market-outcomes">${choice.outcomes.map((outcome,index)=>pcV930MarketOutcomeMarkup(choice,outcome,index)).join('')}</span>
      </button>`).join('')}
    </div>
  </section>`;
};
