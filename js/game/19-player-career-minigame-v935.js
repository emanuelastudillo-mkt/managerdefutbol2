/*
  V9.35 · Ser jugador
  - Carreras de 500 a 1.200 partidos, con perfiles goleadores excepcionales.
  - Entre 2 y 6 lesiones por carrera; casos extraordinarios pueden llegar a 10.
  - Cláusulas reducidas al 10% conservando el sueldo.
  - Renovación del club actual con 80% de probabilidad tras buenos rendimientos.
  - Cuatro clubes iniciales seleccionables mediante tarjetas con escudo.
  - Ofertas ocasionales de clubes pequeños para priorizar minutos y estadísticas.
*/

const pcV935BaseCreatePlayerCareer = pcCreatePlayerCareer;
const pcV935BaseNormalizeCareer = pcNormalizeCareer;
const pcV935BaseCalculateValue = pcCalculateValue;
const pcV935BaseSimulateBlock = pcSimulateBlock;
const pcV935BasePlayerMatchContribution = pcPlayerMatchContribution;
const pcV935BaseInjuryProbability = pcInjuryProbability;
const pcV935BaseCreateInjury = pcCreateInjury;
const pcV935BaseEventCreateInjury = pcV934CreateInjury;
const pcV935BaseRetireCareer = pcRetireCareer;
const pcV935BaseFinalizeSeason = pcFinalizeSeason;
const pcV935BaseInitialClubOptions = pcInitialClubOptions;
const pcV935BaseBuildOffer = pcV930BuildOffer;
const pcV935BaseMoveChoice = pcV930MoveChoice;
const pcV935BaseIdentityMarkup = pcV930IdentityMarkup;

function pcV935HashUnit(value){
  return (Math.abs(Number(pcSeedFromText(String(value || 'player')) || 0)) % 100000) / 100000;
}

function pcV935CareerPlan(state,raw={}){
  const player = state?.player || {};
  const key = `${player.id || ''}|${player.name || ''}|${state?.rngSeed || 0}`;
  const peak = Number(player.peakOverall || player.potential || player.overall || 75);
  const attacking = ['DC','EI','ED','MCO','MI','MD'].includes(String(player.position || ''));
  const targetRoll = pcV935HashUnit(`${key}|matches`);
  let minMatches = 500;
  let maxMatches = 820;
  if(peak >= 98 && attacking){ minMatches = 1040; maxMatches = 1200; }
  else if(peak >= 95){ minMatches = 900; maxMatches = 1140; }
  else if(peak >= 90){ minMatches = 760; maxMatches = 1040; }
  else if(peak >= 84){ minMatches = 640; maxMatches = 920; }
  const targetMatches = Math.round(Number(raw.targetMatches || (minMatches + (maxMatches-minMatches)*targetRoll)) / 10) * 10;

  const injuryRoll = pcV935HashUnit(`${key}|injuries`);
  const exceptionalInjuries = Number(player.injuryProneness || 50) >= 72 && injuryRoll > 0.965;
  const injuryTarget = Math.max(2,Math.min(10,Math.round(Number(raw.injuryTarget || (exceptionalInjuries ? 10 : 2 + Math.floor(injuryRoll*5))))));

  const scorerRoll = pcV935HashUnit(`${key}|scorer`);
  let scoringProfile = String(raw.scoringProfile || 'normal');
  if(!raw.scoringProfile){
    if(attacking && peak >= 98 && scorerRoll > 0.76) scoringProfile = 'historico';
    else if(attacking && peak >= 94 && scorerRoll > 0.48) scoringProfile = 'goleador';
    else if(attacking && peak >= 89) scoringProfile = 'ofensivo';
  }
  return { targetMatches:pcClamp(targetMatches,500,1200),injuryTarget,scoringProfile };
}

function pcV935EnsurePlan(state){
  if(!state || !state.player) return null;
  state.careerPlan = pcV935CareerPlan(state,state.careerPlan || {});
  return state.careerPlan;
}

pcCreatePlayerCareer = function(form){
  const state = pcV935BaseCreatePlayerCareer(form);
  state.schemaVersion = Math.max(9,Number(state.schemaVersion || 0));
  state.viewVersion = 'V9.35';
  pcV935EnsurePlan(state);
  state.player.value = pcCalculateValue(state);
  return state;
};

pcNormalizeCareer = function(raw){
  const normalized = pcV935BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(9,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.35';
  pcV935EnsurePlan(normalized);
  normalized.player.value = pcCalculateValue(normalized);
  return normalized;
};

pcCalculateValue = function(state){
  const previous = Number(pcV935BaseCalculateValue(state) || 0);
  return Math.max(50000,Math.round((previous*0.10)/50000)*50000);
};

pcV930IdentityMarkup = function(state){
  return String(pcV935BaseIdentityMarkup(state)).replace('<small>Valor</small>','<small>Cláusula</small>');
};

pcSimulateBlock = function(state,matches){
  // 54 partidos programados por temporada: permite carreras reales de 500 a 1.200 PJ.
  const source = Math.max(0,Math.round(Number(matches || 0)));
  const expanded = source <= 8 ? 13 : source <= 10 ? 14 : source;
  const remaining = Math.max(0,1200-Number(state?.careerStats?.matches || 0));
  return pcV935BaseSimulateBlock(state,Math.min(expanded,remaining));
};

pcPlayerMatchContribution = function(state,rating,minutes){
  const result = pcV935BasePlayerMatchContribution(state,rating,minutes);
  const plan = pcV935EnsurePlan(state) || {};
  const overall = Number(state?.player?.overall || 0);
  const position = String(state?.player?.position || '');
  const striker = position === 'DC';
  const wideScorer = ['EI','ED','MCO'].includes(position);
  if(overall >= 90 && (striker || wideScorer)){
    const extraGoalChance = plan.scoringProfile === 'historico'
      ? (overall >= 95 ? 0.28 : 0.17)
      : plan.scoringProfile === 'goleador'
        ? (overall >= 95 ? 0.16 : 0.09)
        : overall >= 95 ? 0.08 : 0.035;
    if(pcChance(state,extraGoalChance)) result.goals += 1;
    if(plan.scoringProfile === 'historico' && overall >= 97 && pcChance(state,0.055)) result.goals += 1;
  }
  if(overall >= 90 && ['MCO','MC','EI','ED','MI','MD'].includes(position)){
    const extraAssistChance = plan.scoringProfile === 'historico' ? 0.18 : overall >= 95 ? 0.12 : 0.065;
    if(pcChance(state,extraAssistChance)) result.assists += 1;
  }
  result.goals = Math.min(3,Math.max(0,Number(result.goals || 0)));
  result.assists = Math.min(3,Math.max(0,Number(result.assists || 0)));
  return result;
};

function pcV935InjuryCount(state){
  return Array.isArray(state?.history?.injuries) ? state.history.injuries.length : 0;
}

pcInjuryProbability = function(state,minutes){
  const plan = pcV935EnsurePlan(state);
  if(!plan) return pcV935BaseInjuryProbability(state,minutes);
  const count = pcV935InjuryCount(state);
  if(count >= plan.injuryTarget) return 0;
  const played = Number(state?.careerStats?.matches || 0);
  const remainingTarget = Math.max(60,Number(plan.targetMatches || 700)-played);
  const injuriesRemaining = Math.max(1,Number(plan.injuryTarget || 4)-count);
  const minuteFactor = Math.max(0.28,Number(minutes || 0)/90);
  const pronenessFactor = 0.72 + Number(state?.player?.injuryProneness || 50)/135;
  let probability = (injuriesRemaining/remainingTarget)*1.04*minuteFactor*pronenessFactor;
  const completion = played/Math.max(1,Number(plan.targetMatches || 700));
  if(completion >= 0.68 && count < 2) probability = Math.max(probability,0.018);
  if(completion >= 0.82 && count < Math.min(2,plan.injuryTarget)) probability = Math.max(probability,0.032);
  if(Number(state?.player?.age || 18) >= 35 && count < 2) probability = Math.max(probability,0.040);
  return pcClamp(probability,0.0007,0.065);
};

pcCreateInjury = function(state){
  const plan = pcV935EnsurePlan(state);
  if(plan && pcV935InjuryCount(state) >= plan.injuryTarget) return null;
  return pcV935BaseCreateInjury(state);
};

pcV934CreateInjury = function(state,injury){
  const plan = pcV935EnsurePlan(state);
  if(plan && pcV935InjuryCount(state) >= plan.injuryTarget) return null;
  return pcV935BaseEventCreateInjury(state,injury);
};

pcRetireCareer = function(state,reason='Decisión personal'){
  const plan = pcV935EnsurePlan(state);
  const matches = Number(state?.careerStats?.matches || 0);
  const age = Number(state?.player?.age || 18);
  const automatic = String(reason || '').toLowerCase().includes('cierre de temporada');
  if(automatic && matches < 500 && age < 45) return state;
  if(automatic && age < 42 && matches < Number(plan?.targetMatches || 700)*0.92) return state;
  return pcV935BaseRetireCareer(state,reason);
};

pcFinalizeSeason = function(state){
  const summary = pcV935BaseFinalizeSeason(state);
  const plan = pcV935EnsurePlan(state);
  const matches = Number(state?.careerStats?.matches || 0);
  const age = Number(state?.player?.age || 18);
  if(state?.status === 'active'){
    if(matches >= 1200) pcRetireCareer(state,'Retiro tras alcanzar 1.200 partidos profesionales');
    else if(age >= 31 && matches >= Number(plan?.targetMatches || 700)) pcRetireCareer(state,'Retiro al completar su ciclo profesional');
    else if(age >= 42 && matches >= 500) pcRetireCareer(state,'Retiro por edad');
  }
  return summary;
};

pcInitialClubOptions = function(nationality='',position=''){
  return pcV935BaseInitialClubOptions(nationality,position).slice(0,4);
};

function pcV935InitialClubCards(nationality,selectedId=0,position='MC'){
  const clubs = pcInitialClubOptions(nationality,position);
  const activeId = Number(selectedId || clubs[0]?.id || 0);
  return `<input id="pcInitialClub" type="hidden" value="${activeId}">
    <div class="pc-v935-initial-clubs" role="radiogroup" aria-label="Club inicial">
      ${clubs.map(club => {
        const active = Number(club.id)===activeId;
        return `<button type="button" class="pc-v935-initial-club ${active?'is-selected':''}" data-pc-initial-club="${Number(club.id)}" aria-pressed="${active?'true':'false'}">
          <span>${pcClubBadge(pcClubSnapshot(club))}</span>
          <strong>${pcEscape(club.name)}</strong>
          <small>${pcEscape(pcClubCountry(club))} · Prestigio ${Math.round(pcClubReputation(club))}</small>
        </button>`;
      }).join('')}
    </div>`;
}

pcCreationView = function(){
  const countries = pcCountries();
  const defaultCountry = countries.includes(String(game?.selectedCountry || '')) ? String(game.selectedCountry) : (countries[0] || 'Argentina');
  const firstClub = pcInitialClubOptions(defaultCountry,'MC')[0];
  return `<section class="player-career-intro card pc-v935-creation-intro">
      <div><p class="label">Minijuego integrado</p><h2>Ser jugador</h2><p>Elegí uno de cuatro clubes iniciales y construí una carrera independiente dentro del universo actual.</p></div>
      <div class="player-career-isolation"><span>500 a 1.200 partidos</span><span>Curva propia</span><span>Mercado dinámico</span></div>
    </section>
    <section class="card player-career-create-card pc-v935-create-card">
      <div class="row"><div><p class="label">Nueva carrera</p><h3>Crear futbolista</h3></div><span class="pill">Edad inicial: 16 a 19</span></div>
      <div class="player-career-form-grid">
        <label>Nombre y apellido<input id="pcPlayerName" type="text" maxlength="60" placeholder="Nombre del futbolista" autocomplete="off"></label>
        <label>Nacionalidad<select id="pcNationality">${countries.map(country=>`<option value="${pcEscape(country)}" ${country===defaultCountry?'selected':''}>${pcEscape(country)}</option>`).join('')}</select></label>
        <label>Edad<select id="pcAge">${[16,17,18,19].map(age=>`<option value="${age}" ${age===17?'selected':''}>${age} años</option>`).join('')}</select></label>
        <label>Posición<select id="pcPosition">${PLAYER_CAREER_POSITIONS.map(position=>`<option value="${position}" ${position==='MC'?'selected':''}>${position}</option>`).join('')}</select></label>
        <label>Pierna hábil<select id="pcFoot"><option>Derecha</option><option>Izquierda</option></select></label>
        <label>Perfil<select id="pcProfile"><option value="technical">Técnico</option><option value="physical">Potente</option><option value="balanced" selected>Equilibrado</option></select></label>
      </div>
      <div class="pc-v935-club-picker"><div><small>Club inicial</small><p>Cuatro equipos donde un juvenil puede competir por minutos.</p></div><div id="pcInitialClubCards">${pcV935InitialClubCards(defaultCountry,firstClub?.id || 0,'MC')}</div></div>
      <div class="row player-career-create-actions"><p id="pcCreateError" class="muted" aria-live="polite"></p><button type="button" class="primary" data-pc-action="create">Crear jugador</button></div>
    </section>`;
};

pcRefreshClubSelect = function(){
  const nationality = String(document.getElementById('pcNationality')?.value || '');
  const position = String(document.getElementById('pcPosition')?.value || 'MC');
  const container = document.getElementById('pcInitialClubCards');
  if(container) container.innerHTML = pcV935InitialClubCards(nationality,0,position);
};

function pcV935SeasonPerformance(state){
  const stats = pcNormalizeStats(state?.season?.stats);
  const rating = pcAverageRating(stats);
  const progress = pcV933SeasonProgress(state);
  const contributions = Number(stats.goals || 0)+Number(stats.assists || 0)*0.72;
  const good = Number(stats.matches || 0)>=18 && (rating>=6.95 || progress>=1 || contributions>=14 || Number(state?.player?.overall || 0)>=90);
  return { stats,rating,progress,contributions,good };
}

function pcV935SameClubChoice(state){
  const performance = pcV935SeasonPerformance(state);
  const currentRole = pcCurrentRole(state);
  const strongChance = Math.round(pcClamp(58+(performance.rating-6.7)*22+Math.max(0,performance.progress)*5,56,86));
  return {
    id:`stay-${state.season.number}`,
    type:'stay',
    club:{...state.club},
    title:`Renovar con ${state.club.name}`,
    subtitle:`Oferta del club actual · ${currentRole}`,
    detail:`Sueldo actual ${pcMoney(state.contract.salary)} · continuidad deportiva`,
    outcomes:[
      {
        chance:strongChance,tone:'positive',description:'Renovación como pieza importante · más minutos y confianza',
        effects:{ trust:9,reputation:4,growthProgress:0.20 },
        contract:{ salaryMultiplier:1.18,years:3,role:Number(state.player.overall||0)>=82?'Titular':currentRole },
        context:{ source:'stay',label:'Renovación respaldada',clubFit:0.10,adaptationPenalty:0,opportunity:0.10,developmentMultiplier:1.05 },
        arc:{ slumpDelta:-1,comebackCredit:1 }
      },
      {
        chance:100-strongChance,tone:'neutral',description:'Renovación sin garantías · mismo rol y competencia interna',
        effects:{ trust:2,growthProgress:0.08 },
        contract:{ salaryMultiplier:1.08,years:2,role:currentRole },
        context:{ source:'stay',label:'Continuidad sin garantías',clubFit:0.02,adaptationPenalty:0,opportunity:0,developmentMultiplier:0.98 }
      }
    ]
  };
}

function pcV935SmallClubCandidate(state,excludedIds=new Set()){
  const currentRep = Number(state?.club?.reputation || 50);
  if(currentRep < 58 && Number(state?.player?.overall || 50) < 66) return null;
  const candidates = (seed?.clubs || []).filter(club => {
    const rep = Number(pcClubReputation(club) || 50);
    return !pcIsSpecialBotClub(club) && Number(club.id||0)!==Number(state.club?.id||0) && !excludedIds.has(Number(club.id||0)) && rep <= currentRep-12 && rep >= Math.max(25,currentRep-34);
  });
  if(!candidates.length) return null;
  candidates.sort((a,b) => Number(pcClubReputation(b)||0)-Number(pcClubReputation(a)||0));
  const pool = candidates.slice(0,Math.min(8,candidates.length));
  return pcPick(state,pool);
}

pcV930BuildOffer = function(state,club){
  const offer = pcV935BaseBuildOffer(state,club);
  if(!offer) return offer;
  if(club?.pcSmallClubOpportunity || offer?.pcSmallClubOpportunity){
    offer.pcSmallClubOpportunity = true;
    offer.type = 'transfer';
    offer.role = 'Titular indiscutido';
    offer.years = pcRandomInt(state,2,4);
    offer.salary = Math.round((Math.max(150000,Number(state.contract?.salary||0))*pcRandomBetween(state,0.88,1.05))/1000)*1000;
    offer.fee = Math.round((Number(state.player?.value||0)*pcRandomBetween(state,0.62,0.88))/50000)*50000;
  }
  return offer;
};

function pcV935SmallClubOffer(state,club){
  const offer = pcV935BaseBuildOffer(state,club);
  if(!offer) return null;
  offer.pcSmallClubOpportunity = true;
  offer.type = 'transfer';
  offer.role = 'Titular indiscutido';
  offer.years = pcRandomInt(state,2,4);
  offer.salary = Math.round((Math.max(150000,Number(state.contract?.salary||0))*pcRandomBetween(state,0.88,1.05))/1000)*1000;
  offer.fee = Math.round((Number(state.player?.value||0)*pcRandomBetween(state,0.62,0.88))/50000)*50000;
  return offer;
}

pcV930MoveChoice = function(state,offer){
  if(!offer?.pcSmallClubOpportunity) return pcV935BaseMoveChoice(state,offer);
  const club = offer.club;
  return {
    id:String(offer.id),type:'move',offer:{...offer,club:{...club}},club:{...club},smallClubOpportunity:true,
    title:`Ser figura en ${club.name}`,
    subtitle:'Club pequeño · Titular indiscutido',
    detail:`Prestigio ${Math.round(Number(club.reputation||0))} · Más partidos, goles y asistencias`,
    outcomes:[
      {
        chance:62,tone:'positive',description:'Titular asegurado · más estadísticas · progresión de Media más lenta',
        effects:{ trust:12,reputation:2,growthProgress:-0.10 },
        context:{ source:'small-club',label:'Figura del proyecto',clubFit:0.14,adaptationPenalty:0.02,opportunity:0.23,developmentMultiplier:0.82 },
        arc:{ slumpDelta:-1,comebackCredit:1 }
      },
      {
        chance:25,tone:'positive',description:'+1 Media · equipo construido alrededor tuyo',
        effects:{ overall:1,trust:15,reputation:4,growthProgress:0.14 },
        context:{ source:'small-club',label:'Renacimiento deportivo',clubFit:0.16,adaptationPenalty:0,opportunity:0.24,developmentMultiplier:0.96 },
        arc:{ slumpDelta:-2,comebackCredit:2 }
      },
      {
        chance:13,tone:'negative',description:'Muchos minutos, pero el nivel competitivo acelera la caída: −1 Media',
        effects:{ overall:-1,trust:8,reputation:-3,growthProgress:-0.32 },
        context:{ source:'small-club',label:'Estancamiento prematuro',clubFit:0.05,adaptationPenalty:0.03,opportunity:0.20,developmentMultiplier:0.72 },
        arc:{ slumpDelta:1,badMoves:1 }
      }
    ]
  };
};

function pcV935NormalizeMarketChoice(choice){
  if(!choice || typeof choice !== 'object') return null;
  const type = choice.type === 'stay' ? 'stay' : 'move';
  const club = pcNormalizeClubSnapshot(choice.club || choice.offer?.club);
  const outcomes = Array.isArray(choice.outcomes) ? choice.outcomes.slice(0,3).map(outcome => ({
    ...outcome,chance:pcClamp(Math.round(Number(outcome?.chance||0)),0,100),tone:['positive','negative','neutral'].includes(outcome?.tone)?outcome.tone:'neutral'
  })) : [];
  if(!outcomes.length) return null;
  return {
    ...choice,id:String(choice.id||''),type,club,
    offer:type==='move' && choice.offer ? {...choice.offer,club:pcNormalizeClubSnapshot(choice.offer.club||club)} : null,
    outcomes
  };
}

pcV930NormalizeMarketDecision = function(decision){
  if(!decision || typeof decision !== 'object') return null;
  const choices = Array.isArray(decision.choices) ? decision.choices.map(pcV935NormalizeMarketChoice).filter(Boolean).slice(0,4) : [];
  if(choices.length<2) return null;
  return {
    id:String(decision.id||''),season:Number(decision.season||0),year:Number(decision.year||0),version:5,
    offerCount:choices.length,allowStay:choices.some(choice=>choice.type==='stay'),choices
  };
};

pcV930BuildMarketDecision = function(state){
  if(!state || state.status!=='active' || Number(state.season?.stage||0)!==5) return null;
  const totalCount = pcV933OfferCount(state);
  const performance = pcV935SeasonPerformance(state);
  const includeSameClub = performance.good && pcChance(state,0.80);
  const externalCount = Math.max(1,totalCount-(includeSameClub?1:0));
  let clubs = pcV933OfferCandidates(state,externalCount);
  const selectedIds = new Set(clubs.map(club=>Number(club.id||0)));
  const includeSmall = externalCount>=1 && pcChance(state,0.23);
  if(includeSmall){
    const small = pcV935SmallClubCandidate(state,selectedIds);
    if(small){
      if(clubs.length>=externalCount) clubs[clubs.length-1]=small;
      else clubs.push(small);
    }
  }
  const offers = clubs.slice(0,externalCount).map(club => includeSmall && Number(club.id||0)!==0 && Number(pcClubReputation(club)||50)<=Number(state.club?.reputation||50)-12
    ? pcV935SmallClubOffer(state,club)
    : pcV930BuildOffer(state,club)).filter(Boolean);
  state.pendingOffers = offers;
  const choices = [];
  if(includeSameClub) choices.push(pcV935SameClubChoice(state));
  choices.push(...offers.map(offer=>pcV930MoveChoice(state,offer)));
  while(choices.length<2){
    const extra = pcV933OfferCandidates(state,4).find(club=>!choices.some(choice=>Number(choice.club?.id||0)===Number(club.id||0)));
    if(!extra) break;
    const offer = pcV930BuildOffer(state,extra);
    if(offer){ state.pendingOffers.push(offer);choices.push(pcV930MoveChoice(state,offer)); }
  }
  state.marketDecision = {
    id:pcUniqueId(state,'market-decision-v935'),season:Number(state.season.number||1),year:Number(state.season.year||2026),
    version:5,offerCount:choices.length,allowStay:choices.some(choice=>choice.type==='stay'),choices:choices.slice(0,4)
  };
  return state.marketDecision;
};

pcV930EnsureMarketDecision = function(state){
  if(!state || state.status!=='active' || Number(state.season?.stage||0)!==5) return null;
  const normalized = pcV930NormalizeMarketDecision(state.marketDecision);
  if(!normalized || Number(state.marketDecision?.version||0)<5) pcV930BuildMarketDecision(state);
  else state.marketDecision=normalized;
  return state.marketDecision;
};

pcV930MarketMarkup = function(state){
  const decision = pcV930EnsureMarketDecision(state);
  if(!decision) return '<section class="pc-v930-choice-zone"><p class="muted">No se encontraron propuestas compatibles para esta temporada.</p></section>';
  return `<section class="pc-v930-choice-zone pc-v933-choice-zone pc-v935-choice-zone">
    <div class="pc-v930-choice-heading"><div><small>Mercado de pases</small><h3>${decision.choices.length} propuestas de carrera</h3><p>Los buenos rendimientos pueden generar una renovación. Algunas temporadas aparece un club pequeño que garantiza protagonismo.</p></div><span data-pc-roulette-status>Elegí una propuesta</span></div>
    <div class="pc-v930-choice-grid pc-v933-choice-grid count-${decision.choices.length}">
      ${decision.choices.map(choice => `<button type="button" class="pc-v930-market-choice ${choice.type==='stay'?'is-current-club':''} ${choice.smallClubOpportunity?'is-small-club':''}" data-pc-market="${pcEscape(choice.id)}">
        <span class="pc-v930-choice-club">${pcClubBadge(choice.club)}<span><strong>${pcEscape(choice.title)}</strong><small>${pcEscape(choice.subtitle)}</small></span>${choice.type==='stay'?'<em>Club actual</em>':choice.smallClubOpportunity?'<em>Más minutos</em>':''}</span>
        <span class="pc-v930-choice-detail">${pcEscape(choice.detail)}</span>
        <span class="pc-v930-market-outcomes">${choice.outcomes.map((outcome,index)=>pcV930MarketOutcomeMarkup(choice,outcome,index)).join('')}</span>
      </button>`).join('')}
    </div>
  </section>`;
};

if(typeof document!=='undefined'){
  document.addEventListener('click',event=>{
    const button=event.target.closest('[data-pc-initial-club]');
    if(!button) return;
    const id=Number(button.dataset.pcInitialClub||0);
    const input=document.getElementById('pcInitialClub');
    if(input) input.value=String(id);
    document.querySelectorAll('[data-pc-initial-club]').forEach(card=>{
      const active=Number(card.dataset.pcInitialClub||0)===id;
      card.classList.toggle('is-selected',active);
      card.setAttribute('aria-pressed',active?'true':'false');
    });
  });
}
