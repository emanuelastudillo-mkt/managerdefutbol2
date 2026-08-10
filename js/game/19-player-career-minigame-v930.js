/*
  V9.30 · Minijuego «Ser jugador»
  - Interfaz compacta inspirada en una ficha de carrera.
  - Una acción simula toda la temporada restante.
  - Las decisiones principales se concentran en el mercado de pases.
  - Cada elección resuelve sus efectos mediante una animación tipo sorteo.
  - Club, rol, prestigio, liga y adaptación modifican minutos y rendimiento.
*/

const pcV930BaseNormalizeCareer = pcNormalizeCareer;
const pcV930BaseSimulateMatch = pcSimulateMatch;
const pcV930BaseApplyDevelopment = pcApplyDevelopment;
let pcV930RouletteState = null;

const PC_V930_COUNTRY_DIFFICULTY = {
  Inglaterra: 11,
  España: 10,
  Italia: 9,
  Brasil: 7,
  Argentina: 7,
  Rumania: 4,
  Chile: 4
};

function pcV930CountryKey(value){
  const text = String(value || '').trim();
  const aliases = {
    England:'Inglaterra', Spain:'España', Italy:'Italia', Brazil:'Brasil', Romania:'Rumania', Chile:'Chile', Argentina:'Argentina',
    'Reino Unido':'Inglaterra', Espana:'España'
  };
  return aliases[text] || text;
}

function pcV930LeagueDifficulty(club){
  const country = pcV930CountryKey(club?.country || '');
  const base = Number(PC_V930_COUNTRY_DIFFICULTY[country] || 5);
  const divisionName = String(club?.divisionName || '').toLowerCase();
  const lowerDivisionPenalty = /(segunda|primera nacional|federal|championship|serie b|liga 2|segunda división)/.test(divisionName) ? 2 : 0;
  return pcClamp(base - lowerDivisionPenalty, 1, 12);
}

function pcV930RoleOpportunity(role){
  const text = String(role || '').toLowerCase();
  if(text.includes('titular')) return 0.18;
  if(text.includes('rotación') || text.includes('rotacion')) return 0.03;
  if(text.includes('promesa')) return -0.11;
  if(text.includes('suplente')) return -0.15;
  return 0;
}

function pcV930NormalizeContext(context, state){
  const raw = context && typeof context === 'object' ? context : {};
  return {
    seasonNumber:Math.max(1,Math.round(Number(raw.seasonNumber || state?.season?.number || 1))),
    source:String(raw.source || 'continuidad'),
    label:String(raw.label || 'Contexto normal'),
    clubFit:pcClamp(Number(raw.clubFit || 0),-0.20,0.20),
    adaptationPenalty:pcClamp(Number(raw.adaptationPenalty || 0),0,0.25),
    opportunity:pcClamp(Number(raw.opportunity || 0),-0.25,0.25),
    leagueDifficulty:pcClamp(Number(raw.leagueDifficulty || pcV930LeagueDifficulty(state?.club)),1,12),
    developmentMultiplier:pcClamp(Number(raw.developmentMultiplier || 1),0.82,1.28)
  };
}

function pcV930NormalizeMarketDecision(decision){
  if(!decision || typeof decision !== 'object') return null;
  const choices = Array.isArray(decision.choices) ? decision.choices.filter(Boolean).slice(0,2).map(choice => ({
    ...choice,
    id:String(choice.id || ''),
    type:choice.type === 'stay' ? 'stay' : 'move',
    outcomes:Array.isArray(choice.outcomes) ? choice.outcomes.slice(0,3).map(outcome => ({
      ...outcome,
      chance:pcClamp(Math.round(Number(outcome?.chance || 0)),0,100),
      tone:['positive','negative','neutral'].includes(outcome?.tone) ? outcome.tone : 'neutral'
    })) : []
  })) : [];
  if(choices.length !== 2) return null;
  return {
    id:String(decision.id || ''),
    season:Number(decision.season || 0),
    year:Number(decision.year || 0),
    allowStay:Boolean(decision.allowStay),
    choices
  };
}

pcNormalizeCareer = function(raw){
  const normalized = pcV930BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(4,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.30';
  normalized.pendingDecision = null;
  normalized.marketDecision = pcV930NormalizeMarketDecision(normalized.marketDecision);
  normalized.careerContext = pcV930NormalizeContext(normalized.careerContext,normalized);
  normalized.ui = normalized.ui && typeof normalized.ui === 'object' ? normalized.ui : {};
  normalized.ui.marketRouletteStatus = '';
  return normalized;
};

function pcV930OfferRoleForClub(state, club){
  const gap = Number(pcClubReputation(club) || 50) - Number(state.player?.overall || 50);
  if(gap >= 20) return 'Promesa';
  if(gap >= 9) return 'Rotación';
  return 'Titular';
}

function pcV930BuildOffer(state, club){
  const snapshot = pcClubSnapshot(club);
  const lowMinutes = Number(state.season?.stats?.matches || 0) < 13 || Number(state.season?.stats?.starts || 0) < 7;
  const type = Number(state.player?.age || 18) <= 22 && lowMinutes && pcChance(state,0.52) ? 'loan' : 'transfer';
  const currentSalary = Math.max(150000,Number(state.contract?.salary || 0));
  return {
    id:pcUniqueId(state,'offer-v930'),
    type,
    club:snapshot,
    role:pcV930OfferRoleForClub(state,club),
    years:type === 'loan' ? 1 : pcRandomInt(state,3,5),
    salary:Math.round((currentSalary * pcRandomBetween(state,1.05,1.58))/1000)*1000,
    fee:type === 'loan' ? 0 : Math.round((Number(state.player?.value || 0) * pcRandomBetween(state,0.88,1.26))/50000)*50000,
    adaptationRisk:snapshot.country !== state.club.country ? pcRiskLabel(100-Number(state.player?.adaptation || 50)) : 'Bajo'
  };
}

function pcV930SupplementOffers(state,targetCount=2){
  state.pendingOffers = Array.isArray(state.pendingOffers) ? state.pendingOffers.filter(Boolean) : [];
  const usedIds = new Set(state.pendingOffers.map(offer => Number(offer?.club?.id || 0)));
  usedIds.add(Number(state.club?.id || 0));
  const currentRep = Number(state.club?.reputation || 50);
  const playerLevel = Number(state.player?.overall || 50);
  const candidates = (seed?.clubs || []).filter(club => {
    if(pcIsSpecialBotClub(club) || usedIds.has(Number(club.id || 0))) return false;
    const rep = pcClubReputation(club);
    return rep >= Math.max(32,currentRep-16) && rep <= Math.min(98,Math.max(currentRep+16,playerLevel+25));
  });
  for(let i=candidates.length-1;i>0;i-=1){
    const j=Math.floor(pcRandom(state)*(i+1));
    [candidates[i],candidates[j]]=[candidates[j],candidates[i]];
  }
  while(state.pendingOffers.length < targetCount && candidates.length){
    const club = candidates.shift();
    const offer = pcV930BuildOffer(state,club);
    state.pendingOffers.push(offer);
    usedIds.add(Number(club.id || 0));
  }
  if(state.pendingOffers.length < targetCount){
    const fallback = (seed?.clubs || []).filter(club => !pcIsSpecialBotClub(club) && !usedIds.has(Number(club.id || 0)));
    for(let i=fallback.length-1;i>0;i-=1){
      const j=Math.floor(pcRandom(state)*(i+1));
      [fallback[i],fallback[j]]=[fallback[j],fallback[i]];
    }
    while(state.pendingOffers.length < targetCount && fallback.length){
      const club=fallback.shift();
      state.pendingOffers.push(pcV930BuildOffer(state,club));
      usedIds.add(Number(club.id || 0));
    }
  }
  return state.pendingOffers;
}

function pcV930StayChoice(state){
  const trust = Number(state.player?.trust || 50);
  const morale = Number(state.player?.morale || 50);
  const positiveChance = Math.round(pcClamp(55 + trust*0.18 + morale*0.08,55,84));
  const currentRole = pcCurrentRole(state);
  return {
    id:'stay',
    type:'stay',
    club:{...state.club},
    title:`Seguir en ${state.club.name}`,
    subtitle:`Continuidad · ${currentRole} · ${pcMoney(state.contract.salary)}`,
    detail:`${state.club.divisionName} · Riesgo de adaptación bajo`,
    outcomes:[
      {
        chance:positiveChance,
        tone:'positive',
        description:'+10 confianza · +7 moral · continuidad consolidada',
        effects:{ trust:10,morale:7,form:4,growthProgress:0.18 },
        contract:{ salaryMultiplier:1.14,years:3,role:currentRole },
        context:{ source:'stay',label:'Continuidad consolidada',clubFit:0.09,adaptationPenalty:0,opportunity:Math.max(0.04,pcV930RoleOpportunity(currentRole)),developmentMultiplier:1.04 }
      },
      {
        chance:100-positiveChance,
        tone:'negative',
        description:'−6 forma · −5 confianza · riesgo de estancamiento',
        effects:{ form:-6,trust:-5,morale:-3 },
        contract:{ salaryMultiplier:1.06,years:2,role:currentRole },
        context:{ source:'stay',label:'Continuidad estancada',clubFit:-0.05,adaptationPenalty:0,opportunity:pcV930RoleOpportunity(currentRole)-0.04,developmentMultiplier:0.94 }
      }
    ]
  };
}

function pcV930MoveChoice(state,offer){
  const countryChange = String(offer.club?.country || '') !== String(state.club?.country || '');
  const repGap = Number(offer.club?.reputation || 50)-Number(state.club?.reputation || 50);
  const leagueGap = pcV930LeagueDifficulty(offer.club)-pcV930LeagueDifficulty(state.club);
  const roleOpportunity = pcV930RoleOpportunity(offer.role);
  const adaptation = Number(state.player?.adaptation || 50);
  const successChance = Math.round(pcClamp(
    48 + adaptation*0.30 - (countryChange?12:0) - Math.max(0,repGap)*0.32 - Math.max(0,leagueGap)*1.2 + roleOpportunity*45,
    28,84
  ));
  const strongerEnvironment = repGap > 5 || leagueGap > 1;
  return {
    id:String(offer.id),
    type:'move',
    offer:{...offer,club:{...offer.club}},
    club:{...offer.club},
    title:`Ir a ${offer.club.name}`,
    subtitle:`${offer.type==='loan'?'Cesión':'Transferencia'} · Rol ${offer.role}`,
    detail:`${offer.club.divisionName} · ${offer.club.country} · Sueldo ${pcMoney(offer.salary)}`,
    outcomes:[
      {
        chance:successChance,
        tone:'positive',
        description:`Adaptación rápida: +9 moral · +8 confianza${strongerEnvironment?' · mayor crecimiento':''}`,
        effects:{ morale:9,trust:8,form:6,growthProgress:strongerEnvironment?0.30:0.16 },
        context:{ source:'move',label:'Adaptación rápida',clubFit:0.10,adaptationPenalty:0.01,opportunity:roleOpportunity+0.05,developmentMultiplier:strongerEnvironment?1.16:1.05 }
      },
      {
        chance:100-successChance,
        tone:'negative',
        description:'Adaptación difícil: −12 forma · −8 moral · menos minutos',
        effects:{ form:-12,morale:-8,trust:-6 },
        context:{ source:'move',label:'Adaptación difícil',clubFit:-0.10,adaptationPenalty:countryChange?0.17:0.10,opportunity:roleOpportunity-0.08,developmentMultiplier:strongerEnvironment?1.02:0.90 }
      }
    ]
  };
}

function pcV930BuildMarketDecision(state){
  if(!state || state.status !== 'active' || Number(state.season?.stage || 0) !== 5) return null;
  pcV930SupplementOffers(state,2);
  const offers = state.pendingOffers.slice(0,3);
  const contractExpired = Number(state.contract?.yearsRemaining || 0) <= 0;
  const lowTrust = Number(state.player?.trust || 50) < 30;
  const forcedExitChance = contractExpired ? 0.52 : lowTrust ? 0.28 : 0.12;
  const allowStay = !(offers.length >= 2 && pcChance(state,forcedExitChance));
  let choices = [];
  if(allowStay){
    choices.push(pcV930StayChoice(state));
    if(offers[0]) choices.push(pcV930MoveChoice(state,offers[0]));
  }else{
    choices = offers.slice(0,2).map(offer => pcV930MoveChoice(state,offer));
  }
  if(choices.length < 2){
    const fallback = offers.find(offer => !choices.some(choice => Number(choice.club?.id || 0) === Number(offer.club?.id || 0)));
    if(fallback) choices.push(pcV930MoveChoice(state,fallback));
  }
  if(choices.length < 2) choices.unshift(pcV930StayChoice(state));
  choices = choices.slice(0,2);
  state.marketDecision = {
    id:pcUniqueId(state,'market-decision'),
    season:Number(state.season.number || 1),
    year:Number(state.season.year || 2026),
    allowStay:choices.some(choice => choice.type === 'stay'),
    choices
  };
  return state.marketDecision;
}

function pcV930EnsureMarketDecision(state){
  if(!state || state.status !== 'active' || Number(state.season?.stage || 0) !== 5) return null;
  if(!pcV930NormalizeMarketDecision(state.marketDecision)) pcV930BuildMarketDecision(state);
  return state.marketDecision;
}

function pcV930ApplySimpleEffects(state,effects){
  const player = state.player;
  const bounded = new Set(['condition','morale','form','trust','reputation','professionalism','leadership','adaptation','pressure']);
  Object.entries(effects || {}).forEach(([key,value]) => {
    const delta = Number(value || 0);
    if(key === 'growthProgress') player.growthProgress = Number(player.growthProgress || 0)+delta;
    else if(key === 'overall') player.overall = pcClamp(Number(player.overall || 0)+delta,35,99);
    else if(bounded.has(key)) player[key] = pcClamp(Number(player[key] || 0)+delta,0,100);
  });
}

function pcV930PickOutcome(state,choice){
  const outcomes = Array.isArray(choice?.outcomes) ? choice.outcomes : [];
  if(!outcomes.length) return { index:0,outcome:{ chance:100,tone:'neutral',description:'Sin cambios.',effects:{} } };
  const roll = pcRandom(state)*100;
  let total = 0;
  for(let index=0;index<outcomes.length;index+=1){
    total += Math.max(0,Number(outcomes[index].chance || 0));
    if(roll < total) return { index,outcome:outcomes[index] };
  }
  return { index:outcomes.length-1,outcome:outcomes[outcomes.length-1] };
}

function pcV930ApplyResolvedMarketChoice(state,choice,outcome){
  const before = pcVisibleStatSnapshot(state);
  const previousClub = {...state.club};
  const nextNumber = Number(state.season.number || 1)+1;
  const nextYear = Number(state.season.year || 2026)+1;

  if(choice.type === 'stay'){
    const terms = outcome.contract || {};
    state.contract.yearsRemaining = Math.max(2,Math.round(Number(terms.years || 3)));
    state.contract.salary = Math.round((Math.max(150000,Number(state.contract.salary || 0))*Number(terms.salaryMultiplier || 1.10))/1000)*1000;
    state.contract.role = String(terms.role || pcCurrentRole(state));
    pcRecordEvent(state,'contract',`Continuó en ${state.club.name}. ${outcome.description}`);
  }else{
    const offer = choice.offer;
    if(!offer) return;
    pcCloseCurrentClubHistory(state,state.season.number);
    state.club = pcNormalizeClubSnapshot(offer.club);
    state.contract = { yearsRemaining:offer.years,salary:offer.salary,role:offer.role };
    if(offer.type === 'loan'){
      state.loan = { parentClub:previousClub,loanClub:{...state.club},fromSeason:nextNumber,untilSeason:nextNumber };
    }else state.loan = null;
    state.history.clubs.push({ club:{...state.club},fromSeason:nextNumber,toSeason:null,type:offer.type==='loan'?'Cesión':'Transferencia' });
    state.history.transfers.unshift({ id:pcUniqueId(state,'transfer'),season:state.season.number,year:state.season.year,type:offer.type,fromClub:previousClub,toClub:{...state.club},fee:offer.fee,salary:offer.salary });
    pcRecordEvent(state,'transfer',`${offer.type==='loan'?'Fue cedido':'Fue transferido'} de ${previousClub.name} a ${state.club.name}. ${outcome.description}`);
  }

  pcV930ApplySimpleEffects(state,outcome.effects);
  pcCreateSeason(state,nextNumber,nextYear);
  state.careerContext = pcV930NormalizeContext({
    ...(outcome.context || {}),
    seasonNumber:nextNumber,
    leagueDifficulty:pcV930LeagueDifficulty(state.club)
  },state);
  state.marketDecision = null;
  state.pendingOffers = [];
  state.pendingDecision = null;
  state.lastDecisionResult = {
    id:pcUniqueId(state,'career-choice-result'),
    category:'Mercado de pases',
    title:'Decisión de carrera',
    option:choice.title,
    outcome:outcome.description,
    chance:Number(outcome.chance || 100),
    tone:String(outcome.tone || 'neutral')
  };
  state.player.value = pcCalculateValue(state);
  pcStoreStatChanges(state,before,'Decisión de mercado');
  pcPersist(state,true);
}

pcApplyDevelopment = function(state,matchesPlayed){
  const context = pcV930NormalizeContext(state?.careerContext,state);
  const originalProfessionalism = Number(state?.player?.professionalism || 50);
  const multiplier = Number(context.developmentMultiplier || 1);
  state.player.professionalism = pcClamp(originalProfessionalism * multiplier,0,100);
  const changed = pcV930BaseApplyDevelopment(state,matchesPlayed);
  state.player.professionalism = originalProfessionalism;
  return changed;
};

pcSimulateMatch = function(state){
  const context = pcV930NormalizeContext(state?.careerContext,state);
  if(!state || Number(context.seasonNumber || 0) !== Number(state.season?.number || 0)) return pcV930BaseSimulateMatch(state);
  const player = state.player;
  const original = {
    overall:Number(player.overall || 0),
    trust:Number(player.trust || 0),
    form:Number(player.form || 0),
    morale:Number(player.morale || 0)
  };
  const leaguePenalty = Math.max(0,Number(context.leagueDifficulty || 5)-5)*0.32;
  const adaptationPenalty = Number(context.adaptationPenalty || 0)*18;
  const fitBoost = Number(context.clubFit || 0)*12;
  const opportunityBoost = Number(context.opportunity || 0)*30;

  player.overall = pcClamp(original.overall-leaguePenalty+fitBoost*0.25,35,99);
  player.trust = pcClamp(original.trust+opportunityBoost+fitBoost-adaptationPenalty*0.4,0,100);
  player.form = pcClamp(original.form+fitBoost-adaptationPenalty,0,100);
  player.morale = pcClamp(original.morale+fitBoost*0.5-adaptationPenalty*0.35,0,100);

  const effectiveStart = {
    trust:Number(player.trust || 0),
    form:Number(player.form || 0),
    morale:Number(player.morale || 0)
  };
  const result = pcV930BaseSimulateMatch(state);
  const deltas = {
    trust:Number(player.trust || 0)-effectiveStart.trust,
    form:Number(player.form || 0)-effectiveStart.form,
    morale:Number(player.morale || 0)-effectiveStart.morale
  };
  player.overall = original.overall;
  player.trust = pcClamp(original.trust+deltas.trust,0,100);
  player.form = pcClamp(original.form+deltas.form,0,100);
  player.morale = pcClamp(original.morale+deltas.morale,0,100);
  context.adaptationPenalty = pcClamp(Number(context.adaptationPenalty || 0)-0.004,0,0.25);
  state.careerContext = context;
  return result;
};

pcAdvanceCareer = function(){
  const state = pcCareerState();
  const before = state ? pcVisibleStatSnapshot(state) : null;
  if(!state || state.status !== 'active' || Number(state.season?.stage || 0) === 5 || pcV930RouletteState?.active) return;

  state.pendingDecision = null;
  state.marketDecision = null;
  state.lastDecisionResult = null;
  const startingStage = Number(state.season.stage || 0);
  if(startingStage === 0){
    state.player.condition = pcClamp(Math.max(90,state.player.condition),0,100);
    state.player.morale = pcClamp(state.player.morale+4,0,100);
    state.player.form = pcClamp(state.player.form+3,0,100);
    state.season.overallStart = Number(state.player.overall || 0);
    state.season.stage = 1;
  }

  let scheduled = 0;
  let played = 0;
  let starts = 0;
  let goals = 0;
  let assists = 0;
  let ratingSum = 0;
  let ratingCount = 0;
  let manOfMatch = 0;
  let injuryOccurred = false;

  for(let stage=Math.max(1,Number(state.season.stage || 1));stage<=4;stage+=1){
    const matches = Number(PLAYER_CAREER_MATCHES_BY_STAGE[stage] || 0);
    const block = pcSimulateBlock(state,matches);
    scheduled += Number(block.scheduled || matches);
    played += Number(block.played || 0);
    starts += Number(block.starts || 0);
    goals += Number(block.goals || 0);
    assists += Number(block.assists || 0);
    if(Number(block.averageRating || 0)>0){
      ratingSum += Number(block.averageRating || 0)*Math.max(1,Number(block.played || 0));
      ratingCount += Math.max(1,Number(block.played || 0));
    }
    manOfMatch += Number(block.manOfMatch || 0);
    injuryOccurred = injuryOccurred || Boolean(block.injuryOccurred);
    state.season.blockLog.unshift({
      id:pcUniqueId(state,'block'),
      stage:`Bloque ${stage}`,
      text:block.recovering ? (block.recovered?'Completó su recuperación.':'Continuó la recuperación.') : `Disputó ${block.played} de ${matches} partidos.`,
      stats:{...block}
    });
    state.season.stage = Math.min(5,stage+1);
  }

  const summary = pcFinalizeSeason(state);
  if(state.status === 'active') pcV930BuildMarketDecision(state);
  const seasonStats = pcNormalizeStats(summary?.stats || state.season.stats);
  state.lastBlockSummary = {
    stage:'Temporada completa',
    text:`Temporada finalizada: ${seasonStats.matches} partidos, ${seasonStats.goals} goles y ${seasonStats.assists} asistencias${Array.isArray(summary?.titles)&&summary.titles.length?` · ${summary.titles.length} título${summary.titles.length===1?'':'s'}`:''}.`,
    scheduled,
    played:seasonStats.matches || played,
    starts:seasonStats.starts || starts,
    goals:seasonStats.goals || goals,
    assists:seasonStats.assists || assists,
    averageRating:pcAverageRating(seasonStats) || (ratingCount?ratingSum/ratingCount:0),
    manOfMatch,
    injuryOccurred
  };
  pcStoreStatChanges(state,before,'Temporada completa');
  pcPersist(state,true);
};

function pcV930OutcomeNodes(choiceId){
  return Array.from(document.querySelectorAll('[data-pc-roulette-outcome]')).filter(node => String(node.dataset.pcRouletteChoice || '') === String(choiceId));
}

function pcV930SetRouletteHighlight(nodes,index,final=false){
  nodes.forEach((node,nodeIndex) => {
    node.classList.toggle('is-roulette-lit',nodeIndex===index);
    node.classList.toggle('is-roulette-final',final && nodeIndex===index);
  });
}

function pcV930StartRoulette(choiceId){
  if(pcV930RouletteState?.active) return;
  const state = pcCareerState();
  if(!state || state.status !== 'active' || Number(state.season?.stage || 0) !== 5) return;
  pcV930EnsureMarketDecision(state);
  const choice = state.marketDecision?.choices?.find(item => String(item.id) === String(choiceId));
  if(!choice) return;
  const picked = pcV930PickOutcome(state,choice);
  pcSetCareerState(state);

  const nodes = pcV930OutcomeNodes(choice.id);
  const choiceCards = Array.from(document.querySelectorAll('[data-pc-market]'));
  const selectedCard = choiceCards.find(node => String(node.dataset.pcMarket || '') === String(choice.id));
  choiceCards.forEach(node => {
    node.disabled = true;
    node.classList.toggle('is-roulette-choice',node===selectedCard);
    node.classList.toggle('is-roulette-dimmed',node!==selectedCard);
  });
  const status = document.querySelector('[data-pc-roulette-status]');
  if(status) status.textContent = 'Resolviendo la decisión…';

  if(!nodes.length){
    pcV930ApplyResolvedMarketChoice(state,choice,picked.outcome);
    return;
  }

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const steps = reducedMotion ? 3 : 12;
  pcV930RouletteState = { active:true,choiceId:String(choice.id),outcomeIndex:picked.index };
  let step = 0;
  const tick = () => {
    if(!pcV930RouletteState?.active) return;
    const isLast = step >= steps-1;
    const index = isLast ? picked.index : step % nodes.length;
    pcV930SetRouletteHighlight(nodes,index,isLast);
    if(isLast){
      if(status) status.textContent = 'Resultado definido';
      setTimeout(() => {
        pcV930RouletteState = null;
        pcV930ApplyResolvedMarketChoice(state,choice,picked.outcome);
      },reducedMotion?180:420);
      return;
    }
    const delay = reducedMotion ? 70 : 80 + step*12;
    step += 1;
    setTimeout(tick,delay);
  };
  tick();
}

pcApplyMarketChoice = function(choiceId){
  pcV930StartRoulette(choiceId);
};

function pcV930ClubTone(clubId){
  const index = Math.abs(Math.round(Number(clubId || 0))) % 6;
  return `club-tone-${index}`;
}

function pcV930CareerRows(state){
  const completed = (state.history?.seasons || []).slice().sort((a,b) => Number(a.age || 0)-Number(b.age || 0) || Number(a.year || 0)-Number(b.year || 0));
  const rows = completed.map(item => ({
    age:Number(item.age || 0),
    club:item.club || {},
    overall:Number(item.overallEnd ?? item.overallStart ?? 0),
    stats:pcNormalizeStats(item.stats),
    current:false,
    choosing:false,
    titles:Array.isArray(item.titles)?item.titles.length:0
  }));
  if(state.status === 'active' && Number(state.season?.stage || 0) < 5){
    rows.push({
      age:Number(state.player.age || 0),
      club:state.club,
      overall:Number(state.player.overall || 0),
      stats:pcNormalizeStats(state.season.stats),
      current:true,
      choosing:false,
      titles:0
    });
  }else if(state.status === 'active' && Number(state.season?.stage || 0) === 5){
    rows.push({
      age:Number(state.player.age || 0),
      club:{ id:0,name:'Elegiendo club…',country:'',divisionName:'' },
      overall:Number(state.player.overall || 0),
      stats:pcEmptyStats(),
      current:true,
      choosing:true,
      titles:0
    });
  }
  return rows;
}

function pcV930CareerTableMarkup(state){
  const rows = pcV930CareerRows(state);
  return `<section class="pc-v930-career-list">
    <div class="pc-v930-list-head">
      <span>Edad</span><span>Club</span><span>OVR</span><span>PJ</span><span>${pcVectorIcon('football')}</span><span>${pcVectorIcon('trend')}</span>
    </div>
    <div class="pc-v930-list-rows">
      ${rows.length ? rows.map(row => `<article class="${pcV930ClubTone(row.club?.id)} ${row.current?'is-current':''} ${row.choosing?'is-choosing':''}">
        <strong class="pc-v930-age">${pcFormatNumber(row.age)}</strong>
        <div class="pc-v930-row-club">${row.choosing?'<span class="pc-v930-question">?</span>':pcClubBadge(row.club)}<b>${pcEscape(row.club?.name || 'Club')}</b>${row.titles?`<small>${pcVectorIcon('star')} ${row.titles}</small>`:''}</div>
        <strong class="pc-v930-row-overall">${Math.round(row.overall || 0)}</strong>
        <span>${pcFormatNumber(row.stats.matches)}</span>
        <span>${pcFormatNumber(row.stats.goals)}</span>
        <span>${pcFormatNumber(row.stats.assists)}</span>
      </article>`).join('') : '<p class="muted">La carrera todavía no comenzó.</p>'}
    </div>
    <footer>${pcEscape(state.player.nationality)}<span>${pcFormatNumber(rows.length)} temporada${rows.length===1?'':'s'}</span></footer>
  </section>`;
}

function pcV930IdentityMarkup(state){
  const career = pcNormalizeStats(state.careerStats);
  const palmares = pcPalmaresSummary(state);
  const awards = palmares.awards;
  return `<div class="pc-v930-identity">
    <div class="pc-v930-overall" data-pc-stat="overall"><small>OVR</small><strong>${Math.round(state.player.overall)}</strong></div>
    <div class="pc-v930-player-card">
      <div class="pc-v930-pills"><span>${pcEscape(state.player.nationality)}</span><span>#${pcEscape(state.player.position)}</span></div>
      <div class="pc-v930-name-row">${pcClubBadge(state.club)}<div><h2>${pcEscape(state.player.name)}</h2><p>${pcEscape(state.club.name)}</p></div></div>
      <div class="pc-v930-player-meta"><span><small>Edad</small><strong>${pcFormatNumber(state.player.age)}</strong></span><span data-pc-stat="value"><small>Valor</small><strong>${pcMoney(state.player.value)}</strong></span><span><small>Sueldo</small><strong>${pcMoney(state.contract.salary)}</strong></span></div>
    </div>
    <div class="pc-v930-main-stats">
      <div><small>PJ</small><strong data-pc-stat="matches">${pcFormatNumber(career.matches)}</strong></div>
      <div><small>Goles</small><strong data-pc-stat="goals">${pcFormatNumber(career.goals)}</strong></div>
      <div><small>Asistencias</small><strong data-pc-stat="assists">${pcFormatNumber(career.assists)}</strong></div>
    </div>
    <div class="pc-v930-status-line">
      <span>Físico <b>${Math.round(state.player.condition)}%</b></span>
      <span>Moral <b>${Math.round(state.player.morale)}%</b></span>
      <span>Forma <b>${Math.round(state.player.form)}%</b></span>
      <span>Rol <b>${pcEscape(pcCurrentRole(state))}</b></span>
    </div>
    <div class="pc-v930-trophy-strip">
      <div>${pcVectorIcon('star')}<span><small>Títulos</small><strong>${pcFormatNumber(palmares.total)}</strong></span></div>
      <div><small>Ligas</small><strong>${pcFormatNumber(palmares.league)}</strong></div>
      <div><small>Copas</small><strong>${pcFormatNumber(palmares.nationalCup+palmares.international+palmares.clubWorldCup)}</strong></div>
      <div><small>Figuras</small><strong>${pcFormatNumber(awards.manOfMatch)}</strong></div>
      <div><small>Mejor liga/copa</small><strong>${pcFormatNumber(awards.leaguePlayer+awards.cupPlayer)}</strong></div>
    </div>
  </div>`;
}

function pcV930MarketOutcomeMarkup(choice,outcome,index){
  const tone = ['positive','negative','neutral'].includes(outcome.tone) ? outcome.tone : 'neutral';
  return `<span class="pc-v930-market-outcome ${tone}" data-pc-roulette-choice="${pcEscape(choice.id)}" data-pc-roulette-outcome="${index}">
    ${pcVectorIcon(tone==='positive'?'up':tone==='negative'?'down':'chance')}
    <em>${pcEscape(outcome.description)}</em>
    <b>${Math.round(Number(outcome.chance || 0))}%</b>
  </span>`;
}

function pcV930MarketMarkup(state){
  const decision = pcV930EnsureMarketDecision(state);
  if(!decision) return '';
  return `<section class="pc-v930-choice-zone">
    <div class="pc-v930-choice-heading"><div><small>Mercado de pases</small><h3>Elegí el próximo paso</h3></div><span data-pc-roulette-status>El resultado se define al elegir</span></div>
    <div class="pc-v930-choice-grid">
      ${decision.choices.map(choice => `<button type="button" class="pc-v930-market-choice" data-pc-market="${pcEscape(choice.id)}">
        <span class="pc-v930-choice-club">${pcClubBadge(choice.club)}<span><strong>${pcEscape(choice.title)}</strong><small>${pcEscape(choice.subtitle)}</small></span></span>
        <span class="pc-v930-choice-detail">${pcEscape(choice.detail)}</span>
        <span class="pc-v930-market-outcomes">${choice.outcomes.map((outcome,index)=>pcV930MarketOutcomeMarkup(choice,outcome,index)).join('')}</span>
      </button>`).join('')}
    </div>
  </section>`;
}

function pcV930AdvanceMarkup(state){
  if(state.status !== 'active' || Number(state.season?.stage || 0) === 5) return '';
  return `<section class="pc-v930-advance-zone">
    <div><small>Temporada ${pcFormatNumber(state.season.year)}</small><h3>Simular temporada completa</h3><p>Se calculan partidos, rendimiento, lesiones, competiciones y mercado sin avanzar la carrera del mánager.</p></div>
    <button type="button" class="primary" data-pc-action="advance">Avanzar temporada</button>
  </section>`;
}

function pcV930ResultMarkup(state){
  const result = state.lastDecisionResult;
  const block = state.lastBlockSummary;
  if(!result && !block) return '';
  return `<section class="pc-v930-result-zone ${pcEscape(result?.tone || 'neutral')}">
    ${result ? `<div>${pcVectorIcon(result.tone==='positive'?'up':result.tone==='negative'?'down':'chance')}<span><small>Última decisión · ${pcFormatNumber(result.chance)}%</small><strong>${pcEscape(result.option)}</strong><p>${pcEscape(result.outcome)}</p></span></div>` : ''}
    ${block ? `<p>${pcEscape(block.text || '')}</p>` : ''}
  </section>`;
}

function pcV930RetiredMarkup(state){
  if(state.status !== 'retired') return '';
  return `<section class="pc-v930-retired"><h3>Carrera finalizada</h3><p>${pcEscape(state.player.name)} se retiró con ${pcFormatNumber(state.careerStats.matches)} partidos, ${pcFormatNumber(state.careerStats.goals)} goles y ${pcFormatNumber(pcPalmaresSummary(state).total)} títulos.</p></section>`;
}

renderPlayerCareer = function(){
  if(!game){
    view.innerHTML = '<div class="card blocker"><h2>Ser jugador</h2><p>Primero cargá o creá una carrera de mánager.</p></div>';
    return;
  }
  let state = pcCareerState();
  if(!state){
    view.innerHTML = `<div class="player-career-shell">${pcCreationView()}</div>`;
    return;
  }
  state = pcSetCareerState(state);
  if(state.status === 'active' && Number(state.season?.stage || 0) === 5){
    pcV930EnsureMarketDecision(state);
    state = pcSetCareerState(state);
  }
  view.innerHTML = `<div class="player-career-shell player-career-v930">
    <div class="pc-v930-board">
      <main class="pc-v930-left">
        ${pcV930IdentityMarkup(state)}
        ${pcV930RetiredMarkup(state)}
        ${state.status==='active' ? (Number(state.season?.stage || 0)===5 ? pcV930MarketMarkup(state) : pcV930AdvanceMarkup(state)) : ''}
        ${pcV930ResultMarkup(state)}
      </main>
      <aside class="pc-v930-right">${pcV930CareerTableMarkup(state)}</aside>
    </div>
    <div class="pc-v930-footer-actions">
      <span>Ser jugador · progreso independiente de la carrera del mánager</span>
      <div>${state.status==='active'&&Number(state.player.age||0)>=33?'<button type="button" class="ghost" data-pc-action="retire">Retirarse</button>':''}<button type="button" class="ghost danger" data-pc-action="reset">${state.status==='retired'?'Nueva carrera':'Reiniciar'}</button></div>
    </div>
  </div>`;
  pcAnimateStatChanges(state);
};
