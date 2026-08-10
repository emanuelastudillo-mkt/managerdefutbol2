/*
  V9.31 · Ser jugador
  - Corrige acumulados de palmarés y distinciones en partidas migradas.
  - Agrega una curva de progreso aleatoria con techos altos (90+) y casos excepcionales hasta 99.
  - Ajusta el valor del jugador para que dialogue mejor con el sistema general de cláusulas.
  - Mejora las distinciones individuales en clubes de élite.
  - Suma iconografía vectorial genérica para ligas, copas, trofeos individuales y mejor jugador del mundo.
*/

const pcV931BaseCreatePlayerCareer = pcCreatePlayerCareer;
const pcV931BaseNormalizeCareer = pcNormalizeCareer;
const pcV931BaseBuildOffer = pcV930BuildOffer;
const pcV931BaseMoveChoice = pcV930MoveChoice;
const pcV931BaseIdentityMarkup = pcV930IdentityMarkup;
const pcV931BaseSeasonAwardsText = typeof pcSeasonAwardsText === 'function' ? pcSeasonAwardsText : null;
const pcV931BasePalmaresSummary = typeof pcPalmaresSummary === 'function' ? pcPalmaresSummary : null;
const pcV931BaseEmptyAwards = pcEmptyAwards;
const pcV931BaseNormalizeAwards = pcNormalizeAwards;
const pcV931BaseIncrementAward = pcIncrementAward;
const pcV931BaseRecordSeasonAward = pcRecordSeasonAward;
const pcV931BaseVectorIcon = pcVectorIcon;

function pcV931ProgressTier(seedState){
  const roll = pcRandom(seedState);
  if(roll >= 0.996) return { tier:'legendario', peak:pcRandomInt(seedState,98,99), growth:1.22 };
  if(roll >= 0.972) return { tier:'elite-plus', peak:pcRandomInt(seedState,94,97), growth:1.12 };
  if(roll >= 0.86) return { tier:'elite', peak:pcRandomInt(seedState,90,93), growth:1.06 };
  if(roll >= 0.58) return { tier:'muy-bueno', peak:pcRandomInt(seedState,84,89), growth:1.00 };
  if(roll >= 0.24) return { tier:'solido', peak:pcRandomInt(seedState,78,83), growth:0.95 };
  return { tier:'limitado', peak:pcRandomInt(seedState,72,77), growth:0.90 };
}

function pcV931AssignProgressCurve(state){
  if(!state || !state.player) return state;
  const seedState = { rngSeed: Number(state.rngSeed || pcSeedFromText(state.player?.name || 'pc-player')) >>> 0, sequence: 37 + Number(state.sequence || 0) };
  const tier = pcV931ProgressTier(seedState);
  const baseline = Math.max(Number(state.player.overall || 50), Number(state.player.potential || 50));
  const peakOverall = pcClamp(Math.max(baseline, tier.peak), Math.max(60, Math.round(Number(state.player.overall || 50))), 99);
  state.player.progressTier = String(state.player.progressTier || tier.tier);
  state.player.growthTrackMultiplier = Number(state.player.growthTrackMultiplier || tier.growth);
  state.player.peakOverall = Math.max(Number(state.player.peakOverall || 0), peakOverall);
  state.player.potential = Math.max(Number(state.player.potential || 0), state.player.peakOverall);
  return state;
}

function pcV931EmptyAwards(){
  return { manOfMatch:0, leaguePlayer:0, cupPlayer:0, worldPlayer:0 };
}

pcEmptyAwards = function(){
  return pcV931EmptyAwards();
};

pcNormalizeAwards = function(awards){
  const base = pcV931EmptyAwards();
  Object.keys(base).forEach(key => { base[key] = Math.max(0, Math.round(Number(awards?.[key] || 0))); });
  return base;
};

pcIncrementAward = function(state,type,amount=1){
  if(!state || !Object.prototype.hasOwnProperty.call(pcV931EmptyAwards(),type)) return 0;
  state.careerAwards = pcNormalizeAwards(state.careerAwards);
  state.season.awards = pcNormalizeAwards(state.season?.awards);
  const clean = Math.max(0,Math.round(Number(amount || 0)));
  state.careerAwards[type] += clean;
  state.season.awards[type] += clean;
  return state.careerAwards[type];
};

pcRecordSeasonAward = function(state,type,label,competition=''){
  pcIncrementAward(state,type,1);
  state.history.awards = Array.isArray(state.history.awards) ? state.history.awards : [];
  const award = {
    id:pcUniqueId(state,'award'),
    season:state.season.number,
    year:state.season.year,
    club:{...state.club},
    type:String(type || ''),
    label:String(label || 'Distinción'),
    competition:String(competition || '')
  };
  state.history.awards.unshift(award);
  state.history.awards = state.history.awards.slice(0,300);
  pcRecordEvent(state,'award',`${award.label}${award.competition ? ` · ${award.competition}` : ''}.`);
  return award;
};

function pcV931RebuildCareerAwards(state){
  const stored = pcNormalizeAwards(state?.careerAwards);
  const rebuilt = pcV931EmptyAwards();
  const seasonRows = Array.isArray(state?.history?.seasons) ? state.history.seasons : [];
  let manOfMatch = 0;
  const seasonAwardTotals = { leaguePlayer:0, cupPlayer:0, worldPlayer:0 };
  seasonRows.forEach(item => {
    const awards = pcNormalizeAwards(item?.awards);
    manOfMatch += Number(awards.manOfMatch || 0);
    seasonAwardTotals.leaguePlayer += Number(awards.leaguePlayer || 0);
    seasonAwardTotals.cupPlayer += Number(awards.cupPlayer || 0);
    seasonAwardTotals.worldPlayer += Number(awards.worldPlayer || 0);
  });
  const historyAwardTotals = { leaguePlayer:0, cupPlayer:0, worldPlayer:0 };
  const awardRows = Array.isArray(state?.history?.awards) ? state.history.awards : [];
  awardRows.forEach(item => {
    const type = String(item?.type || '');
    if(Object.prototype.hasOwnProperty.call(historyAwardTotals,type)) historyAwardTotals[type] += 1;
  });
  if(state?.season?.awards){
    const current = pcNormalizeAwards(state.season.awards);
    manOfMatch += Number(current.manOfMatch || 0);
  }
  rebuilt.manOfMatch = Math.max(Number(stored.manOfMatch || 0), manOfMatch);
  ['leaguePlayer','cupPlayer','worldPlayer'].forEach(key => {
    rebuilt[key] = Math.max(Number(stored[key] || 0), Number(seasonAwardTotals[key] || 0), Number(historyAwardTotals[key] || 0));
  });
  return pcNormalizeAwards(rebuilt);
}

function pcV931UniqueTitles(state){
  const rows = Array.isArray(state?.history?.titles) ? state.history.titles : [];
  const seen = new Set();
  return rows.filter(item => {
    const key = [Number(item?.season || 0), String(item?.competition || ''), String(item?.type || ''), Number(item?.club?.id || 0)].join('|');
    if(seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function pcV931IndividualAwardTotal(awards){
  const normalized = pcNormalizeAwards(awards);
  return Number(normalized.manOfMatch || 0) + Number(normalized.leaguePlayer || 0) + Number(normalized.cupPlayer || 0) + Number(normalized.worldPlayer || 0);
}

pcPalmaresSummary = function(state){
  const titles = pcV931UniqueTitles(state);
  const counts = { total:titles.length, league:0, nationalCup:0, international:0, clubWorldCup:0 };
  titles.forEach(title => {
    const type = String(title?.type || '');
    if(type === 'league') counts.league += 1;
    else if(type === 'nationalCup') counts.nationalCup += 1;
    else if(type === 'international') counts.international += 1;
    else if(type === 'clubWorldCup') counts.clubWorldCup += 1;
  });
  const awards = pcV931RebuildCareerAwards(state);
  return { ...counts, awards, teamCups:counts.nationalCup + counts.international + counts.clubWorldCup, individualTotal:pcV931IndividualAwardTotal(awards) };
};

pcSeasonAwardsText = function(awards){
  const normalized = pcNormalizeAwards(awards);
  const parts = [];
  if(normalized.manOfMatch) parts.push(`${normalized.manOfMatch} figura${normalized.manOfMatch===1?'':'s'} del partido`);
  if(normalized.leaguePlayer) parts.push(`${normalized.leaguePlayer} mejor jugador de liga`);
  if(normalized.cupPlayer) parts.push(`${normalized.cupPlayer} mejor jugador de copa`);
  if(normalized.worldPlayer) parts.push(`${normalized.worldPlayer} bota de oro mundial`);
  return parts.join(' · ') || '—';
};

pcVectorIcon = function(name, className=''){
  if(['leagueTrophy','cupTrophy','individualTrophy','worldBoot'].includes(name)){
    const common = `class="player-career-vector ${pcEscape(className)}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"`;
    const extra = {
      leagueTrophy:'<path d="M8 3h8v3a5 5 0 0 1-1.6 3.7L12 12l-2.4-2.3A5 5 0 0 1 8 6V3Z"></path><path d="M6 5H4a2 2 0 0 0 0 4h2"></path><path d="M18 5h2a2 2 0 1 1 0 4h-2"></path><path d="M9 15h6M10 18h4M8 21h8"></path>',
      cupTrophy:'<path d="M7 4h10v2a5 5 0 0 1-5 5 5 5 0 0 1-5-5V4Z"></path><path d="M5 5H3a3 3 0 0 0 3 4"></path><path d="M19 5h2a3 3 0 0 1-3 4"></path><path d="M12 11v4"></path><path d="M8 21h8"></path><path d="M9 17h6"></path>',
      individualTrophy:'<path d="M12 3 9.8 7.5 5 8.2l3.5 3.4-.8 4.8 4.3-2.3 4.3 2.3-.8-4.8L19 8.2l-4.8-.7Z"></path><path d="M8 18h8"></path><path d="M10 21h4"></path>',
      worldBoot:'<path d="M5 12c2.4 0 4.2.4 5.4 1.2l2.4 1.6a3 3 0 0 0 1.7.5H19a2 2 0 0 1 0 4H8.8a5 5 0 0 1-2.7-.8L3 16.5V12Z"></path><path d="M14 7c0 1.7 1.3 3 3 3h1"></path><path d="M15 5c0-1.1.9-2 2-2"></path><path d="M7 10V7"></path>'
    };
    return `<svg ${common}>${extra[name]}</svg>`;
  }
  return pcV931BaseVectorIcon(name,className);
};

pcCreatePlayerCareer = function(form){
  const state = pcV931BaseCreatePlayerCareer(form);
  state.schemaVersion = 5;
  state.viewVersion = 'V9.31';
  state.careerAwards = pcNormalizeAwards(state.careerAwards);
  if(state.season) state.season.awards = pcNormalizeAwards(state.season.awards);
  pcV931AssignProgressCurve(state);
  state.player.value = pcCalculateValue(state);
  return state;
};

pcNormalizeCareer = function(raw){
  const normalized = pcV931BaseNormalizeCareer(raw);
  if(!normalized) return null;
  normalized.schemaVersion = Math.max(5,Number(normalized.schemaVersion || 0));
  normalized.viewVersion = 'V9.31';
  pcV931AssignProgressCurve(normalized);
  normalized.careerAwards = pcV931RebuildCareerAwards(normalized);
  normalized.season.awards = pcNormalizeAwards(normalized.season.awards);
  normalized.history.seasons = normalized.history.seasons.map(item => ({ ...item, awards:pcNormalizeAwards(item?.awards) }));
  normalized.player.value = pcCalculateValue(normalized);
  return normalized;
};

pcCalculateValue = function(state){
  const player = state?.player || {};
  const overall = Number(player.overall || 50);
  const age = Number(player.age || 18);
  const reputation = Number(player.reputation || 20);
  const form = Number(player.form || 50);
  const trust = Number(player.trust || 50);
  const peak = Number(player.peakOverall || player.potential || overall);
  const clubRep = Number(state?.club?.reputation || 50);
  const ageFactor = age <= 20 ? 2.25 : age <= 23 ? 2.0 : age <= 26 ? 1.72 : age <= 29 ? 1.38 : age <= 32 ? 1.05 : age <= 35 ? 0.72 : 0.42;
  const levelFactor = Math.pow(Math.max(35,overall) / 55, 4.35);
  const ceilingFactor = 0.9 + Math.max(0, peak - overall) / 28 + Math.max(0, peak - 80) / 90;
  const reputationFactor = 0.78 + reputation / 88;
  const currentFactor = 0.82 + form / 170 + trust / 380;
  const leagueFactor = 0.9 + clubRep / 140;
  const estimated = 420000 * levelFactor * ageFactor * ceilingFactor * reputationFactor * currentFactor * leagueFactor;
  const rounded = Math.round(Math.max(180000, estimated) / 50000) * 50000;
  const annualSalary = Math.max(1, Math.round(Number(state?.contract?.salary || 0) * 12));
  const centralClauseValue = annualSalary * 16;
  return Math.max(rounded, Math.round(Math.max(centralClauseValue * 0.55, rounded) / 50000) * 50000);
};

pcApplyDevelopment = function(state,matchesPlayed){
  const context = typeof pcV930NormalizeContext === 'function' ? pcV930NormalizeContext(state?.careerContext,state) : { developmentMultiplier:1 };
  const player = state.player;
  const age = Number(player.age || 18);
  const ceiling = Math.max(Number(player.peakOverall || player.potential || player.overall), Number(player.overall || 0));
  const potentialGap = Math.max(0, ceiling - Number(player.overall || 0));
  let ageFactor = age <= 19 ? 1.36 : age <= 22 ? 1.18 : age <= 25 ? 0.98 : age <= 28 ? 0.66 : age <= 31 ? 0.28 : -0.16;
  const professionalFactor = 0.66 + Number(player.professionalism || 50) / 118;
  const minutesFactor = 0.58 + Math.min(1.18, Number(matchesPlayed || 0) / 6.4);
  const profileFactor = PLAYER_CAREER_PROFILES[player.profile]?.growth || 1;
  const gapFactor = potentialGap <= 0 ? 0 : Math.min(1.45, potentialGap / 16);
  const trackFactor = Number(player.growthTrackMultiplier || 1);
  const contextFactor = pcClamp(Number(context.developmentMultiplier || 1), 0.82, 1.34);
  let progress = ageFactor * professionalFactor * minutesFactor * profileFactor * gapFactor * trackFactor * contextFactor * 0.34;
  if(age >= 32) progress = -0.15 - (age - 32) * 0.045;
  progress += Number(player.extraGrowth || 0);
  if(progress > 0) progress *= PLAYER_CAREER_GROWTH_MULTIPLIER;
  player.extraGrowth = 0;
  player.growthProgress = Number(player.growthProgress || 0) + progress;
  let changed = 0;
  while(player.growthProgress >= 1 && player.overall < ceiling && player.overall < 99){
    player.overall = pcRound(player.overall + 1,1);
    player.growthProgress -= 1;
    changed += 1;
  }
  while(player.growthProgress <= -1 && player.overall > 35){
    player.overall = pcRound(player.overall - 1,1);
    player.growthProgress += 1;
    changed -= 1;
  }
  if(changed !== 0) pcRecordEvent(state,'development',`${state.player.name} ${changed > 0 ? 'mejoró' : 'redujo'} su media a ${Math.round(state.player.overall)}.`);
  return changed;
};

function pcV931EliteEnvironment(offer,state){
  const repGap = Number(offer?.club?.reputation || 50) - Number(state?.club?.reputation || 50);
  const leagueGap = pcV930LeagueDifficulty(offer?.club) - pcV930LeagueDifficulty(state?.club);
  return repGap >= 10 || leagueGap >= 2 || Number(offer?.club?.reputation || 0) >= 84;
}

pcV930BuildOffer = function(state,club){
  const offer = pcV931BaseBuildOffer(state,club);
  if(!offer) return offer;
  const elite = pcV931EliteEnvironment(offer,state);
  if(elite){
    const gap = Number(offer.club?.reputation || 50) - Number(state.player?.overall || 50);
    if(gap >= 18) offer.role = 'Promesa';
    else if(gap >= 8) offer.role = 'Rotación';
  }
  offer.fee = Math.round(Math.max(Number(offer.fee || 0), Number(state.player?.value || 0) * (elite ? 0.96 : 0.82)) / 50000) * 50000;
  return offer;
};

pcV930MoveChoice = function(state,offer){
  const elite = pcV931EliteEnvironment(offer,state);
  const baseChoice = pcV931BaseMoveChoice(state,offer);
  if(!elite) return baseChoice;
  const countryChange = String(offer.club?.country || '') !== String(state.club?.country || '');
  const roleOpportunity = pcV930RoleOpportunity(offer.role);
  const successChance = Math.round(pcClamp(44 + Number(state.player?.adaptation || 50) * 0.26 + roleOpportunity * 38 - (countryChange ? 9 : 0), 30, 78));
  return {
    ...baseChoice,
    subtitle:`Salto de nivel · ${offer.type==='loan'?'Cesión':'Transferencia'} · Rol ${offer.role}`,
    detail:`${offer.club.divisionName} · ${offer.club.country} · Más prestigio pero competencia feroz`,
    outcomes:[
      {
        chance:successChance,
        tone:'positive',
        description:'+1 media · +8 reputación · menos minutos, pero más vidriera',
        effects:{ overall:1,reputation:8,morale:6,trust:4,growthProgress:0.35 },
        context:{ source:'move',label:'Salto de nivel asumido',clubFit:0.06,adaptationPenalty:countryChange?0.05:0.02,opportunity:roleOpportunity-0.03,developmentMultiplier:1.17 }
      },
      {
        chance:100-successChance,
        tone:'negative',
        description:'+1 media con riesgo de banca: −14 confianza · −9 forma',
        effects:{ overall:1,trust:-14,form:-9,morale:-6,growthProgress:0.16 },
        context:{ source:'move',label:'Aprendizaje con pocos minutos',clubFit:-0.08,adaptationPenalty:countryChange?0.18:0.12,opportunity:roleOpportunity-0.12,developmentMultiplier:1.08 }
      }
    ]
  };
};

function pcV931CompetitionPrestigeBonus(state){
  const rep = Number(state?.club?.reputation || 50);
  if(rep >= 90) return 0.12;
  if(rep >= 84) return 0.08;
  if(rep >= 76) return 0.04;
  return 0;
}

function pcV931CanCompeteForWorldAward(state, stats){
  const rep = Number(state?.club?.reputation || 50);
  const average = pcAverageRating(stats);
  return rep >= 84 && Number(stats?.matches || 0) >= 20 && average >= 7.35;
}

pcAwardSeasonHonors = function(state){
  const stats = pcNormalizeStats(state.season.stats);
  const average = pcAverageRating(stats);
  const matches = Number(stats.matches || 0);
  const goalContributions = Number(stats.goals || 0) + Number(stats.assists || 0) * 0.8;
  const honors = [];
  const prestigeBonus = pcV931CompetitionPrestigeBonus(state);
  const league = state.season.competitions?.league;
  if(league?.active && matches >= 16 && average >= 7.05){
    const positionBonus = Number(league.position || 18) <= 3 ? 0.16 : Number(league.position || 18) <= 7 ? 0.08 : 0;
    const eliteBonus = Number(state.club?.reputation || 50) >= 84 ? 0.08 : Number(state.club?.reputation || 50) >= 76 ? 0.04 : 0;
    const chance = pcClamp(0.10 + (average-7.05)*0.50 + Math.min(0.18,goalContributions/86) + positionBonus + prestigeBonus + eliteBonus,0.10,0.82);
    if(pcChance(state,chance)) honors.push(pcRecordSeasonAward(state,'leaguePlayer','Mejor jugador de la liga',league.name || 'Liga'));
  }
  const cups = ['nationalCup','international','clubWorldCup']
    .map(key => state.season.competitions?.[key])
    .filter(competition => competition?.active)
    .sort((a,b) => pcCompetitionAwardWeight(b)-pcCompetitionAwardWeight(a));
  const bestCup = cups[0] || null;
  const cupWeight = pcCompetitionAwardWeight(bestCup);
  if(bestCup && cupWeight >= 2 && matches >= 9 && average >= 7.0){
    const eliteBonus = Number(state.club?.reputation || 50) >= 84 ? 0.07 : Number(state.club?.reputation || 50) >= 76 ? 0.03 : 0;
    const chance = pcClamp(0.09 + (average-7.0)*0.44 + cupWeight*0.06 + Math.min(0.16,goalContributions/92) + prestigeBonus + eliteBonus,0.09,0.78);
    if(pcChance(state,chance)) honors.push(pcRecordSeasonAward(state,'cupPlayer','Mejor jugador de copa',bestCup.name || 'Copa'));
  }
  if(pcV931CanCompeteForWorldAward(state,stats)){
    const worldStageBonus = state.season.competitions?.international?.champion ? 0.10 : state.season.competitions?.clubWorldCup?.champion ? 0.12 : 0;
    const chance = pcClamp(0.03 + (average-7.35)*0.34 + Math.min(0.12,goalContributions/105) + prestigeBonus + worldStageBonus,0.03,0.26);
    if(pcChance(state,chance)) honors.push(pcRecordSeasonAward(state,'worldPlayer','Bota de oro al mejor jugador del mundo','Temporada mundial'));
  }
  return honors;
};

pcV930IdentityMarkup = function(state){
  const career = pcNormalizeStats(state.careerStats);
  const palmares = pcPalmaresSummary(state);
  const awards = palmares.awards;
  const totalCups = palmares.teamCups;
  return `<div class="pc-v930-identity pc-v931-identity">
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
    <div class="pc-v931-trophy-strip">
      <div class="pc-v931-trophy-card major">${pcVectorIcon('leagueTrophy')}<span><small>Títulos</small><strong>${pcFormatNumber(palmares.total)}</strong><em>Solo títulos de equipo</em></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('leagueTrophy')}<span><small>Ligas</small><strong>${pcFormatNumber(palmares.league)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('cupTrophy')}<span><small>Copas</small><strong>${pcFormatNumber(totalCups)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('individualTrophy')}<span><small>Distinciones</small><strong>${pcFormatNumber(palmares.individualTotal)}</strong></span></div>
      <div class="pc-v931-trophy-card">${pcVectorIcon('worldBoot')}<span><small>Bota mundial</small><strong>${pcFormatNumber(awards.worldPlayer)}</strong></span></div>
    </div>
    <div class="pc-v931-awards-summary">
      <span>${pcVectorIcon('star')} Figuras del partido <b>${pcFormatNumber(awards.manOfMatch)}</b></span>
      <span>${pcVectorIcon('individualTrophy')} Mejor liga/copa <b>${pcFormatNumber(awards.leaguePlayer + awards.cupPlayer)}</b></span>
    </div>
  </div>`;
};

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
  view.innerHTML = `<div class="player-career-shell player-career-v930 player-career-v931">
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
      <span>Ser jugador · progreso independiente de la carrera del mánager · curva ${pcEscape(String(state.player.progressTier || 'normal'))}</span>
      <div>${state.status==='active'&&Number(state.player.age||0)>=33?'<button type="button" class="ghost" data-pc-action="retire">Retirarse</button>':''}<button type="button" class="ghost danger" data-pc-action="reset">${state.status==='retired'?'Nueva carrera':'Reiniciar'}</button></div>
    </div>
  </div>`;
  pcAnimateStatChanges(state);
};
