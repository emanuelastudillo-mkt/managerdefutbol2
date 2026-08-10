/*
  V9.33 · Ser jugador
  - Físico, moral y forma dejan de intervenir en el minijuego y desaparecen de la interfaz.
  - El cierre de temporada ofrece entre 2 y 4 clubes externos según el crecimiento de media.
  - La calidad de las ofertas escala con la media, la mejora anual y el prestigio alcanzado.
*/

const pcV933BaseNormalizeCareer = pcNormalizeCareer;
const pcV933BaseSimulateBlock = pcSimulateBlock;
const pcV933BaseAdvanceCareer = pcAdvanceCareer;

function pcV933ResetLegacyState(player){
  if(!player || typeof player !== 'object') return player;
  // Se conservan únicamente por compatibilidad con guardados anteriores.
  // Desde V9.33 no se consultan para rendimiento, progreso, mercado ni valor.
  player.condition = 100;
  player.morale = 50;
  player.form = 50;
  return player;
}

function pcV933SeasonProgress(state){
  const start = Number(state?.season?.overallStart ?? state?.player?.overall ?? 0);
  const current = Number(state?.player?.overall || 0);
  return pcRound(current - start,1);
}

function pcV933OfferCount(state){
  const overall = Number(state?.player?.overall || 50);
  const progress = pcV933SeasonProgress(state);
  const reputation = Number(state?.player?.reputation || 0);
  if(overall >= 78 || progress >= 3 || reputation >= 72) return 4;
  if(overall >= 66 || progress >= 1.5 || reputation >= 48) return 3;
  return 2;
}

function pcV933NormalizeChoice(choice){
  if(!choice || typeof choice !== 'object' || choice.type === 'stay') return null;
  const outcomes = Array.isArray(choice.outcomes) ? choice.outcomes.slice(0,3).map(outcome => ({
    ...outcome,
    chance:pcClamp(Math.round(Number(outcome?.chance || 0)),0,100),
    tone:['positive','negative','neutral'].includes(outcome?.tone) ? outcome.tone : 'neutral'
  })) : [];
  if(!outcomes.length) return null;
  return {
    ...choice,
    id:String(choice.id || ''),
    type:'move',
    club:pcNormalizeClubSnapshot(choice.club || choice.offer?.club),
    offer:choice.offer && typeof choice.offer === 'object' ? { ...choice.offer, club:pcNormalizeClubSnapshot(choice.offer.club || choice.club) } : null,
    outcomes
  };
}

pcV930NormalizeMarketDecision = function(decision){
  if(!decision || typeof decision !== 'object') return null;
  const choices = Array.isArray(decision.choices)
    ? decision.choices.map(pcV933NormalizeChoice).filter(Boolean).slice(0,4)
    : [];
  if(choices.length < 2) return null;
  return {
    id:String(decision.id || ''),
    season:Number(decision.season || 0),
    year:Number(decision.year || 0),
    version:3,
    offerCount:choices.length,
    allowStay:false,
    choices
  };
};

pcNormalizeCareer = function(raw){
  const normalized = pcV933BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(7,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.33';
  pcV933ResetLegacyState(normalized.player);
  normalized.player.value = pcCalculateValue(normalized);
  return normalized;
};

pcV930ApplySimpleEffects = function(state,effects){
  const player = state.player;
  const bounded = new Set(['trust','reputation','professionalism','leadership','adaptation','pressure']);
  Object.entries(effects || {}).forEach(([key,value]) => {
    const delta = Number(value || 0);
    if(key === 'growthProgress') player.growthProgress = Number(player.growthProgress || 0)+delta;
    else if(key === 'overall') player.overall = pcClamp(Number(player.overall || 0)+delta,35,99);
    else if(bounded.has(key)) player[key] = pcClamp(Number(player[key] || 0)+delta,0,100);
  });
  pcV933ResetLegacyState(player);
};

pcCalculateValue = function(state){
  const player = state?.player || {};
  const overall = Number(player.overall || 50);
  const age = Number(player.age || 18);
  const reputation = Number(player.reputation || 20);
  const trust = Number(player.trust || 50);
  const peak = Number(player.peakOverall || player.potential || overall);
  const clubRep = Number(state?.club?.reputation || 50);
  const career = pcNormalizeStats(state?.careerStats);
  const rating = pcAverageRating(career);
  const ageFactor = age <= 20 ? 2.30 : age <= 23 ? 2.05 : age <= 26 ? 1.74 : age <= 29 ? 1.40 : age <= 32 ? 1.06 : age <= 35 ? 0.73 : 0.43;
  const levelFactor = Math.pow(Math.max(35,overall)/55,4.38);
  const ceilingFactor = 0.92 + Math.max(0,peak-overall)/29 + Math.max(0,peak-82)/95;
  const reputationFactor = 0.80 + reputation/88;
  const statusFactor = 0.92 + trust/280 + Math.max(0,rating-6.2)/7;
  const clubFactor = 0.90 + clubRep/140;
  const estimated = 430000 * levelFactor * ageFactor * ceilingFactor * reputationFactor * statusFactor * clubFactor;
  const annualSalary = Math.max(1,Math.round(Number(state?.contract?.salary || 0)*12));
  const clauseReference = annualSalary * 16;
  return Math.round(Math.max(180000,estimated,clauseReference*0.55)/50000)*50000;
};

pcPlayerMatchContribution = function(state,rating,minutes){
  const output = PLAYER_CAREER_POSITION_OUTPUT[state.player.position] || PLAYER_CAREER_POSITION_OUTPUT.MC;
  const levelMultiplier = 0.64 + Number(state.player.overall || 50)/108;
  const confidenceMultiplier = 0.88 + Number(state.player.trust || 50)/420;
  const minutesFactor = Math.max(0,Number(minutes || 0))/90;
  const goals = pcChance(state,output.goals*levelMultiplier*confidenceMultiplier*minutesFactor) ? 1 : 0;
  const assists = pcChance(state,output.assists*levelMultiplier*confidenceMultiplier*minutesFactor) ? 1 : 0;
  const yellow = pcChance(state,output.cards*minutesFactor) ? 1 : 0;
  const red = yellow && pcChance(state,0.025) ? 1 : 0;
  return { goals,assists,yellow,red,rating };
};

pcInjuryProbability = function(state,minutes){
  const player = state.player;
  const age = Number(player.age || 18);
  const base = 0.0045 + Number(player.injuryProneness || 50)/9000;
  const ageFactor = age <= 28 ? 1 : 1 + (age-28)*0.035;
  const minuteFactor = Math.max(0.30,Number(minutes || 0)/90);
  const intense = state.memory.tags.injuryRiskNextBlock ? 1.50 : 1;
  const protectedBlock = state.memory.tags.protectedNextBlock ? 0.60 : 1;
  const earlyReturn = state.memory.tags.earlyReturnRisk ? 1.60 : 1;
  return pcClamp(base*ageFactor*minuteFactor*intense*protectedBlock*earlyReturn,0.001,0.15);
};

pcSimulateMatch = function(state){
  const player = state.player;
  const context = typeof pcV930NormalizeContext === 'function' ? pcV930NormalizeContext(state?.careerContext,state) : { opportunity:0,clubFit:0,adaptationPenalty:0,leagueDifficulty:5 };
  const targetLevel = 43 + Number(state.club.reputation || 50)*0.30 + Math.max(0,Number(context.leagueDifficulty || 5)-5)*0.28;
  const opportunity = Number(context.opportunity || 0);
  const fit = Number(context.clubFit || 0);
  const adaptationPenalty = Number(context.adaptationPenalty || 0);
  const playProbability = pcClamp(0.34 + (player.overall-targetLevel)/34 + player.trust/175 + opportunity - adaptationPenalty*0.55,0.07,0.97);
  const plays = pcChance(state,playProbability) && !state.injury;
  let delta = pcEmptyStats();
  let teamResult = pcTeamMatchResult(state,0);
  if(!plays){
    player.trust = pcClamp(Number(player.trust || 50)-0.15,0,100);
    return { delta,teamResult,played:false,manOfMatch:false };
  }
  const startProbability = pcClamp(0.29 + (player.overall-targetLevel)/22 + player.trust/160 + opportunity*0.65,0.07,0.95);
  const starter = pcChance(state,startProbability);
  const minutes = starter ? pcRandomInt(state,64,90) : pcRandomInt(state,12,38);
  const pressurePenalty = state.season.stage >= 3 ? (55-Number(player.pressure || 50))/180 : 0;
  const regularityNoise = (100-Number(player.regularity || 50))/100*pcRandomBetween(state,-0.8,0.8);
  const output = PLAYER_CAREER_POSITION_OUTPUT[player.position] || PLAYER_CAREER_POSITION_OUTPUT.MC;
  const rating = pcClamp(
    5.68 + (player.overall-targetLevel)/28 + (Number(player.trust || 50)-50)/190 + output.ratingBias + regularityNoise - pressurePenalty + fit*0.35 - adaptationPenalty*0.65 + pcRandomBetween(state,-0.45,0.55),
    4.2,9.4
  );
  const contribution = pcPlayerMatchContribution(state,rating,minutes);
  const impact = (rating-6.2)*2.3 + contribution.goals*4 + contribution.assists*2.5;
  teamResult = pcTeamMatchResult(state,impact);
  const distinctionScore = rating + contribution.goals*0.48 + contribution.assists*0.34 + (teamResult===3 ? 0.18 : 0);
  const manOfMatchProbability = distinctionScore >= 8.8 ? 0.92 : distinctionScore >= 8.45 ? 0.76 : distinctionScore >= 8.10 ? 0.54 : distinctionScore >= 7.75 ? 0.28 : 0;
  const manOfMatch = manOfMatchProbability > 0 && pcChance(state,manOfMatchProbability);
  delta = {
    matches:1,starts:starter?1:0,minutes,goals:contribution.goals,assists:contribution.assists,
    yellow:contribution.yellow,red:contribution.red,ratingSum:rating,ratingCount:1,bestRating:rating
  };
  player.trust = pcClamp(Number(player.trust || 50)+(rating-6.3)*0.85+(starter?0.18:0),0,100);
  if(pcChance(state,pcInjuryProbability(state,minutes))) pcCreateInjury(state);
  pcV933ResetLegacyState(player);
  return { delta,teamResult,played:true,rating,minutes,manOfMatch };
};

pcSimulateBlock = function(state,matches){
  pcV933ResetLegacyState(state?.player);
  const result = pcV933BaseSimulateBlock(state,matches);
  pcV933ResetLegacyState(state?.player);
  state.player.value = pcCalculateValue(state);
  return result;
};

function pcV933CandidateScore(state,club,desiredRep){
  const rep = Number(pcClubReputation(club) || 50);
  const countryBonus = String(club.country || '') !== String(state.club?.country || '') ? -0.8 : 0;
  return Math.abs(rep-desiredRep) + countryBonus + pcRandom(state)*5.5;
}

function pcV933OfferCandidates(state,count){
  const currentId = Number(state.club?.id || 0);
  const currentRep = Number(state.club?.reputation || 50);
  const overall = Number(state.player?.overall || 50);
  const progress = Math.max(0,pcV933SeasonProgress(state));
  const desiredRep = pcClamp(Math.max(currentRep+4,overall+5+progress*3.5),35,98);
  const maxRep = pcClamp(desiredRep+16,desiredRep+3,99);
  const all = (seed?.clubs || []).filter(club => !pcIsSpecialBotClub(club) && Number(club.id || 0)!==currentId);
  let candidates = all.filter(club => {
    const rep = Number(pcClubReputation(club) || 50);
    return rep > currentRep && rep <= maxRep;
  });
  if(candidates.length < count){
    const topClubFloor = currentRep >= 92 ? 88 : currentRep;
    const additional = all.filter(club => {
      const rep = Number(pcClubReputation(club) || 50);
      return rep >= topClubFloor && !candidates.some(item => Number(item.id)===Number(club.id));
    });
    candidates.push(...additional);
  }
  const scored = candidates.map(club => ({ club, score:pcV933CandidateScore(state,club,desiredRep) }));
  scored.sort((a,b) => a.score-b.score || Number(b.club?.reputation || 0)-Number(a.club?.reputation || 0));
  candidates = scored.map(item => item.club);
  const selected = [];
  const countryCounts = new Map();
  for(const club of candidates){
    const country = String(club.country || '');
    const used = Number(countryCounts.get(country) || 0);
    if(used >= 2 && candidates.length > count+2) continue;
    selected.push(club);
    countryCounts.set(country,used+1);
    if(selected.length >= count) break;
  }
  return selected.slice(0,count);
}

pcV930BuildOffer = function(state,club){
  const snapshot = pcClubSnapshot(club);
  const currentRep = Number(state.club?.reputation || 50);
  const targetRep = Number(snapshot.reputation || 50);
  const levelGap = targetRep-Number(state.player?.overall || 50);
  const progress = Math.max(0,pcV933SeasonProgress(state));
  const role = levelGap >= 18 ? 'Promesa' : levelGap >= 8 ? 'Rotación' : 'Titular';
  const type = Number(state.player?.age || 18)<=22 && role==='Promesa' && pcChance(state,0.40) ? 'loan' : 'transfer';
  const salaryMultiplier = 1.08 + Math.max(0,targetRep-currentRep)/85 + progress/18;
  return {
    id:pcUniqueId(state,'offer-v933'),type,club:snapshot,role,
    years:type==='loan'?1:pcRandomInt(state,3,5),
    salary:Math.round((Math.max(150000,Number(state.contract?.salary || 0))*pcClamp(salaryMultiplier,1.08,1.75))/1000)*1000,
    fee:type==='loan'?0:Math.round((Number(state.player?.value || 0)*pcRandomBetween(state,0.92,1.30))/50000)*50000,
    adaptationRisk:snapshot.country!==state.club.country ? pcRiskLabel(100-Number(state.player?.adaptation || 50)) : 'Bajo'
  };
};

pcV930MoveChoice = function(state,offer){
  const repGap = Number(offer.club?.reputation || 50)-Number(state.club?.reputation || 50);
  const countryChange = String(offer.club?.country || '')!==String(state.club?.country || '');
  const leagueGap = pcV930LeagueDifficulty(offer.club)-pcV930LeagueDifficulty(state.club);
  const roleOpportunity = pcV930RoleOpportunity(offer.role);
  const adaptation = Number(state.player?.adaptation || 50);
  const successChance = Math.round(pcClamp(55 + adaptation*0.20 - (countryChange?8:0) - Math.max(0,repGap)*0.20 - Math.max(0,leagueGap)*0.8 + roleOpportunity*34,30,82));
  const elite = Number(offer.club?.reputation || 50)>=84;
  return {
    id:String(offer.id),type:'move',offer:{...offer,club:{...offer.club}},club:{...offer.club},
    title:`Ir a ${offer.club.name}`,
    subtitle:`${offer.type==='loan'?'Cesión':'Transferencia'} · ${offer.role}`,
    detail:`Prestigio ${Math.round(Number(offer.club.reputation || 0))} · ${offer.club.divisionName} · ${offer.club.country}`,
    outcomes:[
      {
        chance:successChance,tone:'positive',
        description:`Se adapta y gana terreno: +${elite?8:6} reputación · mejores minutos`,
        effects:{ reputation:elite?8:6,trust:7,growthProgress:elite?0.34:0.20 },
        context:{ source:'move',label:'Adaptación positiva',clubFit:0.09,adaptationPenalty:countryChange?0.04:0.01,opportunity:roleOpportunity+0.05,developmentMultiplier:elite?1.16:1.06 }
      },
      {
        chance:100-successChance,tone:'negative',
        description:`Le cuesta entrar: menos minutos · −10 confianza${elite?' · mayor aprendizaje':''}`,
        effects:{ trust:-10,growthProgress:elite?0.20:0.08 },
        context:{ source:'move',label:'Competencia por minutos',clubFit:-0.07,adaptationPenalty:countryChange?0.16:0.09,opportunity:roleOpportunity-0.11,developmentMultiplier:elite?1.08:0.94 }
      }
    ]
  };
};

pcV930BuildMarketDecision = function(state){
  if(!state || state.status!=='active' || Number(state.season?.stage || 0)!==5) return null;
  const count = pcV933OfferCount(state);
  const clubs = pcV933OfferCandidates(state,count);
  const offers = clubs.map(club => pcV930BuildOffer(state,club));
  state.pendingOffers = offers;
  const choices = offers.map(offer => pcV930MoveChoice(state,offer)).slice(0,4);
  if(choices.length < 2) return null;
  state.marketDecision = {
    id:pcUniqueId(state,'market-decision-v933'),season:Number(state.season.number || 1),year:Number(state.season.year || 2026),
    version:3,offerCount:choices.length,allowStay:false,choices
  };
  return state.marketDecision;
};

pcV930EnsureMarketDecision = function(state){
  if(!state || state.status!=='active' || Number(state.season?.stage || 0)!==5) return null;
  const desired = pcV933OfferCount(state);
  const sourceVersion = Number(state.marketDecision?.version || 0);
  const normalized = pcV930NormalizeMarketDecision(state.marketDecision);
  const invalid = sourceVersion < 3 || !normalized || normalized.choices.some(choice => choice.type==='stay') || normalized.choices.length!==desired;
  if(invalid) pcV930BuildMarketDecision(state);
  else state.marketDecision = normalized;
  return state.marketDecision;
};

pcV930MarketMarkup = function(state){
  const decision = pcV930EnsureMarketDecision(state);
  if(!decision) return '<section class="pc-v930-choice-zone"><p class="muted">No se encontraron clubes compatibles para esta temporada.</p></section>';
  return `<section class="pc-v930-choice-zone pc-v933-choice-zone">
    <div class="pc-v930-choice-heading"><div><small>Mercado de pases</small><h3>${decision.choices.length} ofertas recibidas</h3><p>La calidad de los clubes se ajusta a tu media y a la evolución de esta temporada.</p></div><span data-pc-roulette-status>Elegí una propuesta</span></div>
    <div class="pc-v930-choice-grid pc-v933-choice-grid count-${decision.choices.length}">
      ${decision.choices.map(choice => `<button type="button" class="pc-v930-market-choice" data-pc-market="${pcEscape(choice.id)}">
        <span class="pc-v930-choice-club">${pcClubBadge(choice.club)}<span><strong>${pcEscape(choice.title)}</strong><small>${pcEscape(choice.subtitle)}</small></span></span>
        <span class="pc-v930-choice-detail">${pcEscape(choice.detail)}</span>
        <span class="pc-v930-market-outcomes">${choice.outcomes.map((outcome,index)=>pcV930MarketOutcomeMarkup(choice,outcome,index)).join('')}</span>
      </button>`).join('')}
    </div>
  </section>`;
};

pcV930IdentityMarkup = function(state){
  const career = pcNormalizeStats(state.careerStats);
  const palmares = pcPalmaresSummary(state);
  const awards = palmares.awards;
  const totalCups = palmares.teamCups;
  const progress = pcV933SeasonProgress(state);
  return `<div class="pc-v930-identity pc-v931-identity pc-v932-identity pc-v933-identity">
    <div class="pc-v930-overall" data-pc-stat="overall"><small>Media</small><strong>${Math.round(state.player.overall)}</strong></div>
    <div class="pc-v930-player-card">
      <div class="pc-v930-pills"><span>${pcEscape(state.player.nationality)}</span><span>#${pcEscape(state.player.position)}</span></div>
      <div class="pc-v930-name-row">${pcClubBadge(state.club)}<div><h2>${pcEscape(state.player.name)}</h2><p>${pcEscape(state.club.name)} · ${pcEscape(state.club.divisionName || 'Liga')}</p></div></div>
      <div class="pc-v930-player-meta"><span><small>Edad</small><strong>${pcFormatNumber(state.player.age)}</strong></span><span data-pc-stat="value"><small>Valor</small><strong>${pcMoney(state.player.value)}</strong></span><span><small>Sueldo</small><strong>${pcMoney(state.contract.salary)}</strong></span></div>
    </div>
    <div class="pc-v930-main-stats">
      <div><small>PJ</small><strong data-pc-stat="matches">${pcFormatNumber(career.matches)}</strong></div>
      <div><small>Goles</small><strong data-pc-stat="goals">${pcFormatNumber(career.goals)}</strong></div>
      <div><small>Asistencias</small><strong data-pc-stat="assists">${pcFormatNumber(career.assists)}</strong></div>
    </div>
    <div class="pc-v933-career-status">
      <span><small>Rol</small><b>${pcEscape(pcCurrentRole(state))}</b></span>
      <span><small>Reputación</small><b>${Math.round(Number(state.player.reputation || 0))}%</b></span>
      <span><small>Contrato</small><b>${pcFormatNumber(state.contract.yearsRemaining)} año${Number(state.contract.yearsRemaining)===1?'':'s'}</b></span>
      <span class="${progress>0?'positive':progress<0?'negative':''}"><small>Evolución anual</small><b>${progress>0?'+':''}${pcRound(progress,1)} Media</b></span>
    </div>
    <div class="pc-v931-trophy-strip">
      <div class="pc-v931-trophy-card major">${pcVectorIcon('leagueTrophy')}<span><small>Títulos</small><strong>${pcFormatNumber(palmares.total)}</strong><em>Palmarés de equipo</em></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('leagueTrophy')}<span><small>Ligas</small><strong>${pcFormatNumber(palmares.league)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('cupTrophy')}<span><small>Copas</small><strong>${pcFormatNumber(totalCups)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('individualTrophy')}<span><small>Distinciones</small><strong>${pcFormatNumber(palmares.individualTotal)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('worldBoot')}<span><small>Bota mundial</small><strong>${pcFormatNumber(awards.worldPlayer)}</strong></span></div>
    </div>
    <div class="pc-v931-awards-summary">
      <span>${pcVectorIcon('star')} Figuras del partido <b>${pcFormatNumber(awards.manOfMatch)}</b></span>
      <span>${pcVectorIcon('individualTrophy')} Mejor liga/copa <b>${pcFormatNumber(awards.leaguePlayer+awards.cupPlayer)}</b></span>
    </div>
  </div>`;
};

pcAdvanceCareer = function(){
  const state = pcCareerState();
  if(state) pcV933ResetLegacyState(state.player);
  pcV933BaseAdvanceCareer();
  const updated = pcCareerState();
  if(updated){
    pcV933ResetLegacyState(updated.player);
    updated.player.value = pcCalculateValue(updated);
    pcSetCareerState(updated);
  }
};
