/* V8.71 · Tercera etapa del sistema integral de carrera del manager.
   Ofertas según perfil, consecuencias retrasadas, objetivos contextuales y resumen narrativo. */

(function(){
  'use strict';

  const STAGE_THREE_VERSION = 2;
  const CONSEQUENCE_VERSION = 1;
  const CAPABILITY_LABELS = {
    sporting:'Rendimiento deportivo',
    leadership:'Liderazgo',
    economy:'Gestión económica',
    development:'Desarrollo de jugadores',
    crisis:'Manejo de crisis',
    stability:'Estabilidad'
  };
  const NEED_LABELS = {
    sporting:'Competir de inmediato',
    leadership:'Ordenar el vestuario',
    economy:'Administrar recursos limitados',
    development:'Renovar y desarrollar el plantel',
    crisis:'Revertir una crisis deportiva',
    stability:'Construir un proyecto estable'
  };

  function stCfg(path, fallback){
    return typeof configValue === 'function' ? configValue(`manager.carrera.terceraEtapa.${path}`, fallback) : fallback;
  }
  function stLongCfg(path, fallback){
    return typeof configValue === 'function' ? configValue(`manager.carrera.progresionLarga.${path}`, fallback) : fallback;
  }
  function stClamp(value, min, max){
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }
  function stRound(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : Math.round(Number(fallback || 0));
  }
  function stNumber(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? number : Number(fallback || 0);
  }
  function stAverage(values=[]){
    const clean = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  }
  function stNow(){ return String(game?.currentDate || (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '') || new Date().toISOString().slice(0,10)); }
  function stDay(){ return typeof currentGlobalDayNumber === 'function' ? Math.max(1, stRound(currentGlobalDayNumber(), 1)) : Math.max(1, stRound(game?.globalTurn || 1, 1)); }
  function stHash(key, max=1000000){
    if(typeof hashNumber === 'function') return hashNumber(String(key || ''), Math.max(1, max));
    let hash = 2166136261;
    for(const char of String(key || '')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return Math.abs(hash) % Math.max(1, max);
  }
  function stAddDays(date, days){
    if(typeof addDaysToIsoDate === 'function' && typeof validIsoDate === 'function' && validIsoDate(date)) return addDaysToIsoDate(date, days);
    const source = new Date(`${date || new Date().toISOString().slice(0,10)}T12:00:00Z`);
    source.setUTCDate(source.getUTCDate() + stRound(days));
    return source.toISOString().slice(0,10);
  }
  function stDaysBetween(from, to){
    if(typeof daysBetweenIsoDates === 'function') return daysBetweenIsoDates(from, to);
    return Math.floor((new Date(`${to}T12:00:00Z`) - new Date(`${from}T12:00:00Z`)) / 86400000);
  }
  function stClub(clubId){ return (seed?.clubs || []).find(item => Number(item.id) === Number(clubId)) || null; }
  function stDivision(clubId){
    try{ if(typeof clubDivision === 'function') return clubDivision(clubId); }catch(_){ }
    const club = stClub(clubId);
    return (seed?.divisions || []).find(item => String(item.id || '') === String(club?.divisionId || '')) || {};
  }
  function stProfile(){
    const profile = game?.managerStats?.careerProfile || {};
    return {
      prestige:stClamp(stRound(profile.prestige ?? stLongCfg('prestigioInicial', 100)), 0, 1000),
      moment:stClamp(stRound(profile.moment || 0), -100, 100),
      capabilities:{
        sporting:stClamp(stRound(profile.capabilities?.sporting ?? 35), 0, 100),
        leadership:stClamp(stRound(profile.capabilities?.leadership ?? 35), 0, 100),
        economy:stClamp(stRound(profile.capabilities?.economy ?? 35), 0, 100),
        development:stClamp(stRound(profile.capabilities?.development ?? 35), 0, 100),
        crisis:stClamp(stRound(profile.capabilities?.crisis ?? 35), 0, 100),
        stability:stClamp(stRound(profile.capabilities?.stability ?? 35), 0, 100)
      }
    };
  }
  function stManagerHistory(){
    return (Array.isArray(game?.managerStats?.seasonHistory) ? game.managerStats.seasonHistory : [])
      .filter(item => Number(item?.clubId || 0) > 0)
      .slice()
      .sort((a,b) => Number(b.season || 0) - Number(a.season || 0) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }
  function managerCareerRecentEvaluations(){
    const all = stManagerHistory();
    const finals = all.filter(item => String(item?.status || '') === 'season_end');
    return (finals.length ? finals : all).slice(0,3);
  }
  function managerCareerRecentPerformance(){
    const recent = managerCareerRecentEvaluations();
    if(!recent.length) return 45;
    const weights = [0.50, 0.30, 0.20];
    const availableWeights = weights.slice(0, recent.length);
    const totalWeight = availableWeights.reduce((sum,value)=>sum+value,0) || 1;
    return stClamp(recent.reduce((sum,item,index)=>sum + Number(item?.evaluationScore || 50) * availableWeights[index], 0) / totalWeight, 0, 100);
  }
  window.managerCareerRecentPerformance = managerCareerRecentPerformance;
  function managerCareerApplicationMargin(){
    const profile = stProfile();
    const base = Math.max(1, stRound(stLongCfg('ofertas.margenSolicitudBase', 8), 8));
    const maximum = Math.max(base, stRound(stLongCfg('ofertas.margenSolicitudMaximo', 12), 12));
    const capability = stAverage([profile.capabilities.sporting, profile.capabilities.stability]);
    const bonus = (profile.moment >= 35 ? 2 : profile.moment >= 10 ? 1 : 0) + (capability >= 70 ? 2 : capability >= 55 ? 1 : 0);
    return stClamp(base + bonus, base, maximum);
  }
  window.managerCareerApplicationMargin = managerCareerApplicationMargin;
  function managerCareerHighRiskTerms(clubId){
    const access = typeof currentManagerPrestige === 'function' ? Number(currentManagerPrestige() || 0) : 0;
    const target = typeof clubPrestigeValue === 'function' ? Number(clubPrestigeValue(clubId) || 0) : 0;
    const diff = Math.max(1, target - access);
    const margin = Math.max(1, managerCareerApplicationMargin());
    const pressure = stClamp(diff / margin, 0, 1);
    const minBonus = Number(stLongCfg('ofertas.objetivoExigenteBonusMin', 0.28));
    const maxBonus = Math.max(minBonus, Number(stLongCfg('ofertas.objetivoExigenteBonusMax', 0.55)));
    const minBudget = Number(stLongCfg('ofertas.presupuestoExigenteMin', 0.03));
    const maxBudget = Math.max(minBudget, Number(stLongCfg('ofertas.presupuestoExigenteMax', 0.10)));
    return {
      difference:diff,
      objectiveBonus:Number((minBonus + (maxBonus - minBonus) * pressure).toFixed(3)),
      transferBudgetRate:Number((maxBudget - (maxBudget - minBudget) * pressure).toFixed(3))
    };
  }
  window.managerCareerHighRiskTerms = managerCareerHighRiskTerms;
  function stClubHistory(clubId){
    return (Array.isArray(game?.clubSeasonHistory?.entries) ? game.clubSeasonHistory.entries : [])
      .filter(item => Number(item?.clubId || 0) === Number(clubId))
      .slice()
      .sort((a,b) => Number(b.season || 0) - Number(a.season || 0));
  }
  function stStanding(clubId){
    if(typeof managerJobClubStandingProfile === 'function') return managerJobClubStandingProfile(clubId);
    const division = stDivision(clubId);
    let table = [];
    try{ table = typeof sortedStandings === 'function' ? sortedStandings(division?.id) : []; }catch(_){ }
    const index = table.findIndex(row => Number(row?.clubId || 0) === Number(clubId));
    const total = Math.max(1, table.length || 1);
    const position = index >= 0 ? index + 1 : Math.ceil(total / 2);
    return { position, total, ratio:total > 1 ? (position - 1) / (total - 1) : 0.5, lowZone:position > total * 0.55 };
  }
  function stSquadMetrics(clubId){
    const players = typeof playersByClub === 'function'
      ? playersByClub(clubId).filter(player => !player?.retired && !player?.sold)
      : (seed?.players || []).filter(player => Number(player?.clubId || 0) === Number(clubId) && !player?.retired && !player?.sold);
    const values = players.map(player => typeof visibleOverall === 'function' ? Number(visibleOverall(player)) : Number(player?.overall || player?.media || 0)).filter(Number.isFinite);
    const ages = players.map(player => Number(player?.age || 0)).filter(age => age > 0);
    return {
      count:players.length,
      average:stAverage(values),
      age:stAverage(ages),
      youthShare:players.length ? players.filter(player => Number(player?.age || 99) <= 23).length / players.length : 0
    };
  }
  function stLeagueBudgetPosition(clubId){
    const club = stClub(clubId);
    if(!club) return 0.5;
    const clubs = (seed?.clubs || []).filter(item => String(item.divisionId || '') === String(club.divisionId || '') && !item.specialCompetitionOnly && !item.competitionOnly);
    const ranked = clubs.map(item => Number(game?.clubBudgets?.[item.id] ?? item.budget ?? 0)).sort((a,b)=>a-b);
    const value = Number(game?.clubBudgets?.[clubId] ?? club.budget ?? 0);
    const index = ranked.findIndex(item => item >= value);
    return ranked.length <= 1 ? 0.5 : stClamp((index < 0 ? ranked.length - 1 : index) / (ranked.length - 1), 0, 1);
  }

  function managerCareerClubNeed(clubId){
    const club = stClub(clubId) || {};
    const standing = stStanding(clubId);
    const history = stClubHistory(clubId).slice(0,3);
    const squad = stSquadMetrics(clubId);
    const prestige = typeof clubPrestigeValue === 'function' ? Number(clubPrestigeValue(clubId) || 0) : Number(club?.prestige || 0);
    const budgetRatio = stLeagueBudgetPosition(clubId);
    const recentPpg = history.length ? stAverage(history.map(item => Number(item.ppg || 0))) : 1.25;
    const positionSpread = history.length >= 2 ? Math.max(...history.map(item => Number(item.position || 0))) - Math.min(...history.map(item => Number(item.position || 0))) : 0;
    let capability = 'leadership';
    let reason = 'El club busca mejorar el funcionamiento general del plantel.';
    if(standing.ratio >= 0.68 || recentPpg < 1.02 || history.some(item => item.relegated)){
      capability = 'crisis';
      reason = 'La posición actual y los resultados recientes exigen una recuperación rápida.';
    }else if(budgetRatio <= 0.28){
      capability = 'economy';
      reason = 'El club dispone de menos recursos que la mayoría de sus rivales.';
    }else if(squad.age >= 28.3 || squad.youthShare < 0.20){
      capability = 'development';
      reason = 'El plantel necesita renovación y desarrollo de jugadores jóvenes.';
    }else if(prestige >= 70 || standing.ratio <= 0.25){
      capability = 'sporting';
      reason = 'La institución exige resultados inmediatos y competir en la zona alta.';
    }else if(positionSpread >= 6){
      capability = 'stability';
      reason = 'Las últimas temporadas fueron inestables y el club busca continuidad.';
    }
    return {
      capability,
      label:NEED_LABELS[capability] || CAPABILITY_LABELS[capability] || 'Perfil general',
      reason,
      standing,
      budgetRatio:Number(budgetRatio.toFixed(3)),
      recentPpg:Number(recentPpg.toFixed(3)),
      squadAverage:Number(squad.average.toFixed(2)),
      squadAge:Number(squad.age.toFixed(2))
    };
  }
  window.managerCareerClubNeed = managerCareerClubNeed;

  function managerCareerProfileMatch(clubId){
    const club = stClub(clubId);
    if(!club) return { score:0, threshold:100, eligible:false, need:managerCareerClubNeed(clubId), components:{} };
    const profile = stProfile();
    const need = managerCareerClubNeed(clubId);
    const history = stManagerHistory();
    const division = stDivision(clubId);
    const country = String(club.country || division?.country || '');
    const managerPrestigeComparable = typeof managerCareerPrestigeToClubScale === 'function' ? managerCareerPrestigeToClubScale(profile.prestige) : profile.prestige / 10;
    const targetPrestige = typeof clubPrestigeValue === 'function' ? Number(clubPrestigeValue(clubId) || 0) : Number(club.prestige || 0);
    const prestigeDifference = managerPrestigeComparable - targetPrestige;
    const prestigeFit = prestigeDifference >= 0
      ? stClamp(1 - Math.min(0.15, prestigeDifference / 300), 0.85, 1)
      : stClamp(1 - Math.abs(prestigeDifference) / 24, 0, 1);
    const recentPerformance = managerCareerRecentPerformance() / 100;
    const capabilityFit = Number(profile.capabilities?.[need.capability] || 0) / 100;
    const sameDivision = history.filter(item => String(item.divisionId || '') === String(division?.id || '')).length;
    const sameCountry = history.filter(item => String(stClub(item.clubId)?.country || '') === country).length;
    const experienceFit = sameDivision >= 2 ? 1 : sameDivision === 1 ? 0.72 : sameCountry >= 2 ? 0.48 : sameCountry === 1 ? 0.30 : 0.10;
    const stabilityFit = Number(profile.capabilities?.stability || 0) / 100;
    const momentFit = (Number(profile.moment || 0) + 100) / 200;
    const score = stRound((prestigeFit * 0.35 + recentPerformance * 0.25 + momentFit * 0.15 + capabilityFit * 0.15 + experienceFit * 0.05 + stabilityFit * 0.05) * 100);
    const threshold = stClamp(stRound(36 + targetPrestige * 0.30 - Number(need.standing?.ratio || 0.5) * 8), 34, 68);
    const strongest = [
      { key:'prestige', label:'trayectoria', value:prestigeFit },
      { key:'recent', label:'rendimiento reciente', value:recentPerformance },
      { key:'capability', label:CAPABILITY_LABELS[need.capability] || 'perfil', value:capabilityFit },
      { key:'experience', label:'experiencia en la liga', value:experienceFit },
      { key:'stability', label:'estabilidad', value:stabilityFit },
      { key:'moment', label:'momento profesional', value:momentFit }
    ].sort((a,b)=>b.value-a.value);
    return {
      score:stClamp(score, 0, 100),
      threshold,
      eligible:score >= threshold,
      need,
      strengths:strongest.slice(0,2).map(item => item.label),
      weakness:strongest[strongest.length - 1]?.label || '',
      components:{
        prestige:stRound(prestigeFit * 100),
        recent:stRound(recentPerformance * 100),
        capability:stRound(capabilityFit * 100),
        experience:stRound(experienceFit * 100),
        stability:stRound(stabilityFit * 100),
        moment:stRound(momentFit * 100)
      }
    };
  }
  window.managerCareerProfileMatch = managerCareerProfileMatch;

  function managerCareerAutomaticOfferEligible(clubId){
    const profile = stProfile();
    const target = typeof clubPrestigeValue === 'function' ? Number(clubPrestigeValue(clubId) || 0) : 0;
    const match = managerCareerProfileMatch(clubId);
    const recent = managerCareerRecentPerformance();
    if(target <= Number(typeof MANAGER_CLUB_OPEN_PRESTIGE !== 'undefined' ? MANAGER_CLUB_OPEN_PRESTIGE : 20)) return true;
    if(target >= 90){
      return profile.prestige >= Number(stLongCfg('ofertas.prestigioPotencia', 900)) && profile.moment >= 10 && recent >= 75 && match.score >= match.threshold;
    }
    if(target >= 80){
      return profile.prestige >= Number(stLongCfg('ofertas.prestigioElite', 825)) && profile.moment >= Number(stLongCfg('ofertas.momentoMinimoElite', 0)) && recent >= Number(stLongCfg('ofertas.evaluacionRecienteMinimaElite', 70)) && match.score >= match.threshold - 2;
    }
    if(target >= 70){
      return profile.prestige >= 650 && profile.moment >= -20 && recent >= 60 && match.score >= match.threshold - 5;
    }
    return match.score >= match.threshold - 8;
  }
  window.managerCareerAutomaticOfferEligible = managerCareerAutomaticOfferEligible;

  function stDecorateOffer(offer){
    if(!offer || !Number(offer.clubId || 0)) return offer;
    const match = managerCareerProfileMatch(offer.clubId);
    return {
      ...offer,
      profileMatchScore:match.score,
      profileMatchThreshold:match.threshold,
      profileNeed:String(match.need?.capability || ''),
      profileNeedLabel:String(match.need?.label || ''),
      profileMatchStrengths:Array.isArray(match.strengths) ? match.strengths.slice(0,2) : [],
      profileMatchWeakness:String(match.weakness || ''),
      profileMatchComponents:{ ...(match.components || {}) }
    };
  }

  if(typeof normalizeManagerJobMarketState === 'function'){
    const normalizeManagerJobMarketStateV871 = normalizeManagerJobMarketState;
    normalizeManagerJobMarketState = function(state={}){
      const normalized = normalizeManagerJobMarketStateV871(state);
      normalized.offers = (normalized.offers || []).map(stDecorateOffer);
      return normalized;
    };
  }
  if(typeof managerJobCreateOffer === 'function'){
    const managerJobCreateOfferV871 = managerJobCreateOffer;
    managerJobCreateOffer = function(clubId, options={}){
      const highRisk = String(options?.contractType || '') === 'high_risk';
      const riskTerms = highRisk ? managerCareerHighRiskTerms(clubId) : null;
      const offer = managerJobCreateOfferV871(clubId, highRisk ? { ...options, objectiveBonus:riskTerms.objectiveBonus, transferBudgetRate:riskTerms.transferBudgetRate } : options);
      if(!offer) return offer;
      if(riskTerms) Object.assign(offer, riskTerms);
      const decorated = stDecorateOffer(offer);
      Object.assign(offer, decorated);
      return offer;
    };
  }
  if(typeof managerJobAvailableOfferCandidates === 'function'){
    const managerJobAvailableOfferCandidatesV871 = managerJobAvailableOfferCandidates;
    managerJobAvailableOfferCandidates = function(){
      const pool = managerJobAvailableOfferCandidatesV871();
      const scored = pool.map(club => ({ club, match:managerCareerProfileMatch(club.id) }))
        .sort((a,b)=>b.match.score-a.match.score || Number(b.match.need?.standing?.ratio || 0)-Number(a.match.need?.standing?.ratio || 0));
      const eligible = scored.filter(item => managerCareerAutomaticOfferEligible(item.club.id));
      const starter = scored.filter(item => Number(clubPrestigeValue(item.club)) <= Number(typeof MANAGER_CLUB_OPEN_PRESTIGE !== 'undefined' ? MANAGER_CLUB_OPEN_PRESTIGE : 20));
      const selected = eligible.length ? eligible : starter.length ? starter : scored;
      return selected.slice(0, Math.max(3, stRound(stCfg('ofertas.maximoCandidatos', 14), 14))).map(item => item.club);
    };
  }
  if(typeof managerJobApplicationCandidates === 'function'){
    managerJobApplicationCandidates = function(limit=8){
      const prestige = Number(typeof currentManagerPrestige === 'function' ? currentManagerPrestige() : 0);
      const margin = managerCareerApplicationMargin();
      const state = typeof ensureManagerJobMarketState === 'function' ? ensureManagerJobMarketState() : { offers:[], applications:[] };
      const busy = new Set([...(state.offers || []).map(item=>Number(item.clubId||0)), ...(state.applications || []).filter(item=>item.status==='pending').map(item=>Number(item.clubId||0))]);
      return (seed?.clubs || [])
        .filter(club => typeof managerClubCareerEligible !== 'function' || managerClubCareerEligible(club))
        .filter(club => Number(club.id) !== Number(game?.selectedClubId || 0) && !busy.has(Number(club.id)))
        .filter(club => !(typeof managerClubRehireBlockInfo === 'function' && managerClubRehireBlockInfo(club).blocked))
        .filter(club => !(typeof managerJobClubBlockedByRejectedApplication === 'function' && managerJobClubBlockedByRejectedApplication(club)))
        .filter(club => { const target = Number(clubPrestigeValue(club)); return target > prestige && target <= prestige + margin; })
        .map(club => ({ club, match:managerCareerProfileMatch(club.id), difference:Number(clubPrestigeValue(club))-prestige }))
        .sort((a,b)=>b.match.score-a.match.score || a.difference-b.difference)
        .slice(0, Math.max(1, Number(limit || 8)))
        .map(item=>item.club);
    };
  }
  if(typeof managerJobIncomingOfferClub === 'function'){
    managerJobIncomingOfferClub = function(){
      const candidates = typeof managerJobAvailableOfferCandidates === 'function' ? managerJobAvailableOfferCandidates() : [];
      if(!candidates.length) return null;
      const weighted = candidates.map(club => {
        const match = managerCareerProfileMatch(club.id);
        const standing = stStanding(club.id);
        const need = Math.max(0.35, Number(standing.ratio || 0.5));
        const weight = Math.max(1, Math.pow(Math.max(10, match.score), 1.35) * (0.65 + need));
        return { club, weight };
      });
      const total = weighted.reduce((sum,item)=>sum+item.weight,0);
      let pick = (stHash(`profile-offer:${game?.saveCode || ''}:${game?.seasonNumber || 1}:${game?.globalTurn || 0}:${stNow()}`, 1000000) / 1000000) * total;
      for(const item of weighted){ pick -= item.weight; if(pick <= 0) return item.club; }
      return weighted[0]?.club || null;
    };
  }
  if(typeof managerJobApplicationRejectionChance === 'function'){
    managerJobApplicationRejectionChance = function(club, managerPrestige){
      const access = Number(typeof managerClubAccessPrestige === 'function' ? managerClubAccessPrestige(managerPrestige) : managerPrestige || 0);
      const difference = Math.max(1, Number(clubPrestigeValue(club)) - access);
      const margin = Math.max(1, managerCareerApplicationMargin());
      const fit = managerCareerProfileMatch(club?.id || club).score;
      const base = 12 + (difference / margin) * 68;
      const fitAdjustment = fit >= 80 ? -16 : fit >= 65 ? -10 : fit >= 50 ? -5 : fit < 30 ? 12 : fit < 40 ? 7 : 0;
      return stClamp(Math.round(base + fitAdjustment), 8, 92);
    };
  }
  function stProfileMatchMarkup(clubId, offer=null){
    const match = offer && Number.isFinite(Number(offer.profileMatchScore))
      ? {
          score:Number(offer.profileMatchScore), threshold:Number(offer.profileMatchThreshold || 0),
          need:{ capability:offer.profileNeed, label:offer.profileNeedLabel },
          strengths:Array.isArray(offer.profileMatchStrengths) ? offer.profileMatchStrengths : [],
          weakness:String(offer.profileMatchWeakness || '')
        }
      : managerCareerProfileMatch(clubId);
    const tone = match.score >= 75 ? 'ok' : match.score >= 55 ? 'neutral' : 'warn';
    const strengths = match.strengths?.length ? `Fortalezas valoradas: ${match.strengths.join(' y ')}.` : '';
    return `<div class="career-profile-match"><div><span>Compatibilidad con el club</span><strong class="${tone}">${stRound(match.score)}/100</strong></div><div><span>Perfil buscado</span><strong>${escapeHtml(match.need?.label || 'Perfil general')}</strong></div><p class="muted small">${escapeHtml(strengths)}${match.weakness ? ` Punto menos favorable: ${escapeHtml(match.weakness)}.` : ''}</p></div>`;
  }
  if(typeof managerJobOfferCard === 'function'){
    const managerJobOfferCardV871 = managerJobOfferCard;
    managerJobOfferCard = function(offer){
      const html = managerJobOfferCardV871(offer);
      if(!html) return html;
      return html.replace('<div class="row message-actions">', `${stProfileMatchMarkup(offer.clubId, offer)}<div class="row message-actions">`);
    };
  }
  if(typeof managerJobApplicationOptionCard === 'function'){
    const managerJobApplicationOptionCardV871 = managerJobApplicationOptionCard;
    managerJobApplicationOptionCard = function(club){
      const html = managerJobApplicationOptionCardV871(club);
      const match = managerCareerProfileMatch(club?.id || 0);
      const terms = managerCareerHighRiskTerms(club?.id || 0);
      const baseObjective = typeof managerObjectiveForClubDivision === 'function' ? Number(managerObjectiveForClubDivision(club?.id || 0)) : null;
      const finalObjective = Number.isFinite(baseObjective) ? Math.min(2.75, baseObjective + Number(terms.objectiveBonus || 0)) : null;
      const qualitative = Number.isFinite(finalObjective) && typeof managerCareerQualitativeObjective === 'function' ? managerCareerQualitativeObjective(club?.id || 0, finalObjective) : null;
      const rejection = typeof managerJobApplicationRejectionChance === 'function' ? Number(managerJobApplicationRejectionChance(club, typeof currentManagerPrestige === 'function' ? currentManagerPrestige() : 0)) : 50;
      const riskLabel = rejection >= 75 ? 'aceptación poco probable' : rejection >= 50 ? 'aceptación difícil' : 'aceptación posible';
      const objectiveLabel = qualitative?.label || (Number.isFinite(finalObjective) ? `${finalObjective.toFixed(2)} pts/partido` : 'objetivo muy exigente');
      return html.replace('</button>', `<span class="career-application-fit">Compatibilidad ${match.score}/100 · ${escapeHtml(match.need.label)}</span><span class="career-application-fit warn">Alto riesgo: ${escapeHtml(objectiveLabel)} · ${escapeHtml(riskLabel)}</span></button>`);
    };
  }

  function normalizeManagerConsequences(raw={}){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const normalizeItem = item => ({
      id:String(item?.id || ''),
      type:String(item?.type || 'decision'),
      season:Math.max(1, stRound(item?.season || game?.seasonNumber || 1)),
      clubId:Math.max(0, stRound(item?.clubId || 0)),
      playerId:Math.max(0, stRound(item?.playerId || 0)),
      secondaryPlayerId:Math.max(0, stRound(item?.secondaryPlayerId || 0)),
      createdDate:String(item?.createdDate || ''),
      dueDate:String(item?.dueDate || ''),
      createdDay:Math.max(0, stRound(item?.createdDay || 0)),
      delayDays:Math.max(1, stRound(item?.delayDays || 1)),
      intensity:stClamp(stRound(item?.intensity || 1), 1, 3),
      label:String(item?.label || ''),
      context:item?.context && typeof item.context === 'object' && !Array.isArray(item.context) ? { ...item.context } : {},
      status:String(item?.status || 'pending'),
      result:String(item?.result || ''),
      resultLabel:String(item?.resultLabel || ''),
      resolvedDate:String(item?.resolvedDate || ''),
      effect:item?.effect && typeof item.effect === 'object' && !Array.isArray(item.effect) ? { ...item.effect } : null
    });
    const all = (Array.isArray(source.items) ? source.items : []).map(normalizeItem).filter(item => item.id).slice(-180);
    return {
      version:CONSEQUENCE_VERSION,
      items:all,
      lastCaptainByStint:source.lastCaptainByStint && typeof source.lastCaptainByStint === 'object' && !Array.isArray(source.lastCaptainByStint) ? { ...source.lastCaptainByStint } : {},
      lastProcessedDate:String(source.lastProcessedDate || '')
    };
  }
  window.normalizeManagerConsequences = normalizeManagerConsequences;

  function ensureManagerConsequences(){
    if(!game) return normalizeManagerConsequences({});
    game.managerCareerConsequences = normalizeManagerConsequences(game.managerCareerConsequences || {});
    return game.managerCareerConsequences;
  }
  function stConsequenceDelay(type, key){
    const ranges = {
      referent_sale:[10,28],
      referent_dismissal:[7,21],
      transfer_list_referent:[7,18],
      captain_change:[9,21],
      youth_promotion:[18,35]
    };
    const range = ranges[type] || [7,21];
    return range[0] + stHash(`consequence-delay:${type}:${key}`, range[1]-range[0]+1);
  }
  function scheduleManagerConsequence(type, options={}){
    if(!game || stCfg('consecuencias.activo', true) === false) return null;
    const state = ensureManagerConsequences();
    const clubId = Number(options.clubId || game.selectedClubId || 0);
    const playerId = Number(options.playerId || 0);
    const key = String(options.key || `${type}:${game.seasonNumber || 1}:${clubId}:${playerId}:${stNow()}`);
    if(state.items.some(item => item.id === key && item.status === 'pending')) return null;
    const delayDays = Math.max(1, stRound(options.delayDays || stConsequenceDelay(type, key)));
    const item = {
      id:key,
      type:String(type || 'decision'),
      season:Math.max(1, stRound(game.seasonNumber || 1)),
      clubId,
      playerId,
      secondaryPlayerId:Number(options.secondaryPlayerId || 0),
      createdDate:stNow(),
      dueDate:stAddDays(stNow(), delayDays),
      createdDay:stDay(),
      delayDays,
      intensity:stClamp(stRound(options.intensity || 1), 1, 3),
      label:String(options.label || ''),
      context:options.context && typeof options.context === 'object' ? { ...options.context } : {},
      status:'pending', result:'', resultLabel:'', resolvedDate:'', effect:null
    };
    state.items.push(item);
    state.items = state.items.slice(-Math.max(40, stRound(stCfg('consecuencias.maximoGuardado', 180), 180)));
    return item;
  }
  window.scheduleManagerConsequence = scheduleManagerConsequence;

  function stDressingRoom(){
    try{ return window.managerDressingRoom?.current?.() || null; }catch(_){ return null; }
  }
  function stDressingEntry(playerId){ return stDressingRoom()?.playerTrust?.[Number(playerId)] || null; }
  function stRecalculateDressingRoom(stint){
    if(!stint) return;
    const usable = Object.values(stint.playerTrust || {}).filter(entry => {
      const player = (seed?.players || []).find(item => Number(item.id) === Number(entry.playerId));
      return player && Number(player.clubId || 0) === Number(stint.clubId || 0) && !player.retired && !player.sold;
    });
    const weighted = usable.reduce((sum, entry) => sum + Number(entry.value || 50) * (1 + Number(entry.influence || 0) / 100), 0);
    const weights = usable.reduce((sum, entry) => sum + (1 + Number(entry.influence || 0) / 100), 0);
    if(weights) stint.generalTrust = stClamp(Number((weighted / weights).toFixed(1)), 0, 100);
    const groups = {};
    ['starter','rotation','substitute','youth'].forEach(group => {
      const list = usable.filter(entry => entry.primaryGroup === group);
      groups[group] = { value:Number(stAverage(list.map(entry => Number(entry.value || 50))).toFixed(1)), count:list.length };
    });
    const refs = usable.filter(entry => Array.isArray(entry.tags) && entry.tags.includes('referent'));
    groups.referent = { value:Number(stAverage(refs.map(entry => Number(entry.value || 50))).toFixed(1)), count:refs.length };
    stint.groupTrust = groups;
    stint.updatedAt = stNow();
  }
  function stApplyTrust(filter, delta, reason){
    const stint = stDressingRoom();
    if(!stint) return 0;
    let changed = 0;
    Object.values(stint.playerTrust || {}).forEach(entry => {
      if(!filter(entry)) return;
      entry.value = stClamp(Number((Number(entry.value || 50) + Number(delta || 0)).toFixed(1)), 0, 100);
      entry.lastChange = Number(delta || 0);
      entry.lastReason = String(reason || 'Consecuencia de una decisión');
      entry.updatedAt = stNow();
      changed += 1;
    });
    stRecalculateDressingRoom(stint);
    return changed;
  }
  function stAdjustMorale(delta, excluded=0){
    if(typeof adjustSquadMorale === 'function') return adjustSquadMorale(game?.selectedClubId, delta, excluded);
    const players = typeof playersByClub === 'function' ? playersByClub(game?.selectedClubId) : [];
    players.forEach(player => {
      if(Number(player.id) === Number(excluded)) return;
      game.playerMorale[player.id] = stClamp(stRound(Number(game.playerMorale?.[player.id] || 50) + delta), 1, 99);
    });
    return players.length;
  }
  function stRecentPpg(clubId, limit=5){
    const matches = (Array.isArray(game?.matchHistory) ? game.matchHistory : [])
      .filter(match => match?.played && !match?.friendly && (Number(match.homeId) === Number(clubId) || Number(match.awayId) === Number(clubId)))
      .slice(-Math.max(1, limit));
    if(!matches.length) return 1.25;
    const points = matches.reduce((sum, match) => {
      const home = Number(match.homeId) === Number(clubId);
      const gf = Number(home ? match.homeGoals : match.awayGoals) || 0;
      const gc = Number(home ? match.awayGoals : match.homeGoals) || 0;
      return sum + (gf > gc ? 3 : gf === gc ? 1 : 0);
    }, 0);
    return points / matches.length;
  }
  function stResolveConsequence(item){
    const currentClub = Number(game?.selectedClubId || 0);
    if(game?.gameOver?.active || currentClub !== Number(item.clubId || 0)){
      return { result:'left_club', label:'La consecuencia quedó en el club anterior', message:'La decisión siguió su curso después de tu salida y no modifica tu plantel actual.', effect:{} };
    }
    const recentPpg = stRecentPpg(item.clubId, 5);
    const player = (seed?.players || []).find(entry => Number(entry.id) === Number(item.playerId));
    const goodRun = recentPpg >= 1.60;
    if(item.type === 'referent_sale' || item.type === 'referent_dismissal'){
      const hard = !goodRun;
      const trustDelta = hard ? -3 * item.intensity : -1;
      const moraleDelta = hard ? -2 : -1;
      const cohesionDelta = hard ? -2 : 0;
      stApplyTrust(entry => Array.isArray(entry.tags) && entry.tags.includes('referent'), trustDelta, 'Impacto diferido por la salida de un referente');
      stAdjustMorale(moraleDelta);
      if(cohesionDelta && typeof adjustTeamCohesion === 'function') adjustTeamCohesion(item.clubId, cohesionDelta);
      return {
        result:hard ? 'negative' : 'absorbed',
        label:hard ? 'La salida del referente dejó tensión' : 'El plantel absorbió la salida',
        message:hard ? `La salida de ${item.label || player?.name || 'un referente'} siguió pesando en el vestuario durante la mala racha.` : `Los resultados ayudaron a que el plantel asimilara la salida de ${item.label || player?.name || 'un referente'}.`,
        effect:{ trust:trustDelta, morale:moraleDelta, cohesion:cohesionDelta }
      };
    }
    if(item.type === 'transfer_list_referent'){
      const entry = stDressingEntry(item.playerId);
      const stillListed = player && typeof isTransferListedPlayer === 'function' ? isTransferListedPlayer(player) : Boolean(player?.transferListed);
      if(!player || Number(player.clubId || 0) !== currentClub || !stillListed){
        return { result:'resolved', label:'La tensión por la lista de transferibles se disipó', message:'La situación dejó de estar activa antes de provocar un conflicto mayor.', effect:{} };
      }
      if(entry){
        entry.value = stClamp(Number(entry.value || 50) - 4, 0, 100);
        entry.lastChange = -4;
        entry.lastReason = 'Continuó transferible durante varias semanas';
        entry.renewal = entry.renewal || {};
        entry.renewal.demandFactor = Math.max(Number(entry.renewal.demandFactor || 1), 1.08);
      }
      stApplyTrust(other => Array.isArray(other.tags) && other.tags.includes('referent') && Number(other.playerId) !== Number(item.playerId), -1, 'Un referente continuó transferible');
      stAdjustMorale(-1, item.playerId);
      return { result:'negative', label:'El referente endureció su postura', message:`${item.label || player.name} mantuvo su malestar y ahora será más difícil renovar su contrato.`, effect:{ trust:-4, renewalDemand:8, morale:-1 } };
    }
    if(item.type === 'captain_change'){
      const newEntry = stDressingEntry(item.playerId);
      const oldEntry = stDressingEntry(item.secondaryPlayerId);
      const accepted = goodRun || Number(newEntry?.influence || 0) >= Number(oldEntry?.influence || 0);
      if(accepted){
        stApplyTrust(entry => Array.isArray(entry.tags) && entry.tags.includes('referent'), 1, 'La nueva capitanía se consolidó');
        if(typeof adjustTeamCohesion === 'function') adjustTeamCohesion(item.clubId, 1);
        return { result:'positive', label:'La nueva capitanía se consolidó', message:'El rendimiento y el peso interno del nuevo capitán terminaron legitimando el cambio.', effect:{ trust:1, cohesion:1 } };
      }
      if(oldEntry){ oldEntry.value = stClamp(Number(oldEntry.value || 50) - 3, 0, 100); oldEntry.lastReason = 'No aceptó el cambio de capitanía'; }
      stApplyTrust(entry => Array.isArray(entry.tags) && entry.tags.includes('referent') && Number(entry.playerId) !== Number(item.playerId), -2, 'Persistieron dudas por el cambio de capitán');
      if(typeof adjustTeamCohesion === 'function') adjustTeamCohesion(item.clubId, -2);
      return { result:'negative', label:'El cambio de capitán dividió a los referentes', message:'La falta de resultados impidió que el nuevo liderazgo fuera aceptado por completo.', effect:{ trust:-2, cohesion:-2 } };
    }
    if(item.type === 'youth_promotion'){
      const stat = game?.playerStats?.[item.playerId] || {};
      const used = Number(stat.played || 0) >= Number(item.context?.playedAtPromotion || 0) + 2;
      if(used){
        stApplyTrust(entry => entry.primaryGroup === 'youth', 2, 'Un juvenil promovido recibió oportunidades');
        stAdjustMorale(1);
        return { result:'positive', label:'La promoción juvenil fue respaldada con minutos', message:`${item.label || player?.name || 'El juvenil'} recibió oportunidades y reforzó la confianza de los jóvenes en el proyecto.`, effect:{ trust:2, morale:1 } };
      }
      stApplyTrust(entry => entry.primaryGroup === 'youth', -1, 'Una promoción juvenil no tuvo continuidad');
      return { result:'negative', label:'La promoción quedó sin continuidad', message:`${item.label || player?.name || 'El juvenil'} subió al primer equipo, pero todavía no recibió oportunidades suficientes.`, effect:{ trust:-1 } };
    }
    return { result:'neutral', label:'La decisión completó su efecto', message:'La situación se resolvió sin un impacto relevante.', effect:{} };
  }
  function processManagerConsequencesDaily(){
    if(!game) return { processed:0, resolved:0 };
    const state = ensureManagerConsequences();
    const today = stNow();
    if(state.lastProcessedDate === today) return { processed:0, resolved:0 };
    let resolved = 0;
    state.items.forEach(item => {
      if(item.status !== 'pending' || !item.dueDate || stDaysBetween(item.dueDate, today) < 0) return;
      const outcome = stResolveConsequence(item);
      item.status = 'resolved';
      item.result = outcome.result;
      item.resultLabel = outcome.label;
      item.resolvedDate = today;
      item.effect = outcome.effect || {};
      resolved += 1;
      if(typeof pushGameMessage === 'function'){
        pushGameMessage({
          type:'deportivo', priority:outcome.result === 'negative' ? 'high' : 'normal',
          title:outcome.label || 'Consecuencia de una decisión', body:outcome.message || '',
          id:`manager-consequence-${item.id}-${today}`
        });
      }
    });
    state.lastProcessedDate = today;
    return { processed:state.items.filter(item => item.status === 'pending').length, resolved };
  }
  window.processManagerConsequencesDaily = processManagerConsequencesDaily;

  function stTrackCaptainChange(){
    if(!game || game?.gameOver?.active || !game?.managerStats?.currentSeason) return null;
    const state = ensureManagerConsequences();
    const stintId = String(game.managerStats.currentSeason.careerStintId || `${game.seasonNumber || 1}:${game.selectedClubId || 0}`);
    const currentCaptain = Number(typeof managerDressingRoom?.hierarchy === 'function' ? managerDressingRoom.hierarchy()?.captainId || 0 : game?.tactic?.captainId || 0);
    const previous = Number(state.lastCaptainByStint[stintId] || 0);
    state.lastCaptainByStint[stintId] = currentCaptain;
    if(!previous || !currentCaptain || previous === currentCaptain) return null;
    const newPlayer = (seed?.players || []).find(player => Number(player.id) === currentCaptain);
    const oldPlayer = (seed?.players || []).find(player => Number(player.id) === previous);
    return scheduleManagerConsequence('captain_change', {
      key:`captain_change:${stintId}:${previous}:${currentCaptain}`,
      clubId:game.selectedClubId,
      playerId:currentCaptain,
      secondaryPlayerId:previous,
      label:`${oldPlayer?.name || 'Capitán anterior'} → ${newPlayer?.name || 'Nuevo capitán'}`,
      intensity:1,
      context:{ previousCaptain:oldPlayer?.name || '', newCaptain:newPlayer?.name || '' }
    });
  }

  function stCurrentSeasonRaw(stats){ return stats?.currentSeason && typeof stats.currentSeason === 'object' && !Array.isArray(stats.currentSeason) ? stats.currentSeason : {}; }
  function stNormalizeObjectiveRevisions(value){
    return (Array.isArray(value) ? value : []).map(item => ({
      id:String(item?.id || ''), day:Math.max(1, stRound(item?.day || 1)), date:String(item?.date || ''),
      direction:String(item?.direction || ''), delta:Number(Number(item?.delta || 0).toFixed(3)),
      previousPpg:Number(Number(item?.previousPpg || 0).toFixed(3)), nextPpg:Number(Number(item?.nextPpg || 0).toFixed(3)),
      previousLabel:String(item?.previousLabel || ''), nextLabel:String(item?.nextLabel || ''),
      reason:String(item?.reason || ''), position:Math.max(0, stRound(item?.position || 0)), played:Math.max(0, stRound(item?.played || 0))
    })).filter(item => item.id).slice(-6);
  }
  function stRestoreObjectiveContext(normalized, rawCurrent){
    const current = normalized.currentSeason || {};
    const raw = rawCurrent || {};
    const hasOriginal = raw.objectiveOriginalPpg !== null && raw.objectiveOriginalPpg !== undefined && raw.objectiveOriginalPpg !== '' && Number.isFinite(Number(raw.objectiveOriginalPpg));
    const hasDelta = raw.objectiveContextDeltaPpg !== null && raw.objectiveContextDeltaPpg !== undefined && raw.objectiveContextDeltaPpg !== '' && Number.isFinite(Number(raw.objectiveContextDeltaPpg));
    const hasBase = raw.objectiveContextBasePpg !== null && raw.objectiveContextBasePpg !== undefined && raw.objectiveContextBasePpg !== '' && Number.isFinite(Number(raw.objectiveContextBasePpg));
    current.objectiveOriginalPpg = hasOriginal ? Number(raw.objectiveOriginalPpg) : (Number.isFinite(Number(current.objectivePpg)) ? Number(current.objectivePpg) : null);
    current.objectiveContextDeltaPpg = hasDelta ? Number(raw.objectiveContextDeltaPpg) : 0;
    current.objectiveContextBasePpg = hasBase ? Number(raw.objectiveContextBasePpg) : null;
    current.objectiveContextRevisions = stNormalizeObjectiveRevisions(raw.objectiveContextRevisions);
    current.objectiveContextLastReviewDay = Math.max(0, stRound(raw.objectiveContextLastReviewDay || 0));
    current.objectiveContextLastRevisionDay = Math.max(0, stRound(raw.objectiveContextLastRevisionDay || 0));
    current.objectiveContextVersion = STAGE_THREE_VERSION;
    normalized.currentSeason = current;
    return normalized;
  }
  if(typeof normalizeManagerStats === 'function'){
    const normalizeManagerStatsV871 = normalizeManagerStats;
    normalizeManagerStats = function(stats){
      const rawCurrent = stCurrentSeasonRaw(stats);
      const normalized = normalizeManagerStatsV871(stats);
      return stRestoreObjectiveContext(normalized, rawCurrent);
    };
  }
  function stApplyObjectiveContext(stats){
    const current = stats?.currentSeason || {};
    const base = Number(current.objectivePpg || 0);
    const delta = Number(current.objectiveContextDeltaPpg || 0);
    if(Number.isFinite(base) && Number.isFinite(delta) && delta !== 0){
      const division = stDivision(current.clubId || game?.selectedClubId);
      const limits = typeof managerObjectiveLimitsForDivision === 'function' ? managerObjectiveLimitsForDivision(division) : { min:0.60, max:2.60 };
      current.objectivePpg = Number(stClamp(base + delta, Number(limits.min || 0.60), Number(limits.max || 2.60)).toFixed(3));
      current.objectiveContextBasePpg = Number(base.toFixed(3));
      current.objectiveSource = 'contextual';
      current.objectiveLabel = `${current.objectivePpg.toFixed(2)} · objetivo revisado`;
    }
    if(typeof managerCareerQualitativeObjective === 'function'){
      const qualitative = managerCareerQualitativeObjective(current.clubId || game?.selectedClubId, current.objectivePpg, { founder:typeof currentGameIsFounderMode === 'function' && currentGameIsFounderMode() });
      current.objectiveQualitative = qualitative;
      current.objectiveQualitativeLabel = qualitative.label;
      current.objectiveMinimumPosition = qualitative.minimumPosition;
      current.objectiveTargetPosition = qualitative.targetPosition;
    }
    stats.currentSeason = current;
    return stats;
  }
  if(typeof ensureManagerCurrentSeasonStats === 'function'){
    const ensureManagerCurrentSeasonStatsV871 = ensureManagerCurrentSeasonStats;
    ensureManagerCurrentSeasonStats = function(stats, season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
      const rawCurrent = stCurrentSeasonRaw(stats);
      let normalized = ensureManagerCurrentSeasonStatsV871(stats, season, clubId);
      normalized = stRestoreObjectiveContext(normalized, rawCurrent);
      if(!Number.isFinite(Number(normalized.currentSeason.objectiveOriginalPpg))) normalized.currentSeason.objectiveOriginalPpg = Number(normalized.currentSeason.objectivePpg || 0);
      return stApplyObjectiveContext(normalized);
    };
  }

  function stActiveLongInjuries(clubId){
    const players = typeof playersByClub === 'function' ? playersByClub(clubId) : [];
    return players.filter(player => {
      if(typeof isInjured !== 'function' || !isInjured(player.id)) return false;
      const remaining = typeof turnsRemaining === 'function' ? Number(turnsRemaining(player.id) || 0) : 0;
      return remaining >= 14;
    }).length;
  }
  function stObjectiveBaseline(current){
    const key = String(current?.careerStintId || '');
    return key && game?.managerCareerBaselines?.[key] ? game.managerCareerBaselines[key] : null;
  }
  function stObjectiveContextAssessment(){
    if(!game || game?.gameOver?.active || typeof currentGameIsFounderMode === 'function' && currentGameIsFounderMode()) return null;
    game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, game.selectedClubId);
    const current = game.managerStats.currentSeason || {};
    const day = stDay();
    const minDay = Math.max(30, stRound(stCfg('objetivos.primerDiaRevision', 75), 75));
    const interval = Math.max(7, stRound(stCfg('objetivos.intervaloRevisionDias', 21), 21));
    const cooldown = Math.max(30, stRound(stCfg('objetivos.esperaEntreCambiosDias', 60), 60));
    const maxRevisions = Math.max(0, stRound(stCfg('objetivos.maximoRevisiones', 2), 2));
    const revisions = stNormalizeObjectiveRevisions(current.objectiveContextRevisions);
    if(day < minDay || Number(current.played || 0) < 8 || revisions.length >= maxRevisions) return null;
    if(day - Number(current.objectiveContextLastReviewDay || 0) < interval) return null;
    current.objectiveContextLastReviewDay = day;
    if(day - Number(current.objectiveContextLastRevisionDay || 0) < cooldown) return null;
    if(String(current.objectiveSource || '') === 'manual') return null;
    const baseline = stObjectiveBaseline(current);
    if(!baseline) return null;
    const squad = stSquadMetrics(game.selectedClubId);
    const standing = stStanding(game.selectedClubId);
    const qualitative = typeof managerCareerQualitativeObjective === 'function' ? managerCareerQualitativeObjective(game.selectedClubId, current.objectivePpg) : current.objectiveQualitative;
    const squadDelta = squad.average - Number(baseline.squadAverage || squad.average);
    const budgetStart = Number(baseline.budget || 0);
    const budgetDeltaRatio = budgetStart ? (Number(game.budget || 0) - budgetStart) / Math.max(Math.abs(budgetStart), 10000000) : 0;
    const longInjuries = stActiveLongInjuries(game.selectedClubId);
    const target = Number(qualitative?.targetPosition || current.objectiveTargetPosition || Math.ceil(standing.total * 0.5));
    const minimum = Number(qualitative?.minimumPosition || current.objectiveMinimumPosition || Math.ceil(standing.total * 0.7));
    let positive = 0;
    let negativeStructural = 0;
    const positiveReasons = [];
    const negativeReasons = [];
    if(squadDelta >= 1.5){ positive += 1; positiveReasons.push('el plantel mejoró claramente'); }
    if(squadDelta <= -1.5){ negativeStructural += 1; negativeReasons.push('el plantel perdió nivel'); }
    if(budgetDeltaRatio >= 0.25){ positive += 1; positiveReasons.push('la situación económica mejoró'); }
    if(budgetDeltaRatio <= -0.25){ negativeStructural += 1; negativeReasons.push('el margen económico se redujo'); }
    if(Number(current.played || 0) >= 12 && standing.position > 0 && standing.position <= Math.max(1, target - 2)){ positive += 1; positiveReasons.push('el equipo se instaló por encima de la expectativa'); }
    if(longInjuries >= 4){ negativeStructural += longInjuries >= 6 ? 2 : 1; negativeReasons.push(`${longInjuries} lesiones largas condicionan al plantel`); }
    if(standing.position > minimum + 2 && negativeStructural > 0){ negativeStructural += 1; negativeReasons.push('la posición quedó por debajo del mínimo previsto'); }
    let direction = '';
    let delta = 0;
    let reasons = [];
    if(positive >= 2 && Number(current.played || 0) >= 12){ direction = 'increase'; delta = positive >= 3 ? 0.10 : 0.08; reasons = positiveReasons; }
    else if(negativeStructural >= 2){ direction = 'decrease'; delta = negativeStructural >= 3 ? -0.12 : -0.08; reasons = negativeReasons; }
    if(!direction) return null;
    const previousPpg = Number(current.objectivePpg || 0);
    const accumulated = Number(current.objectiveContextDeltaPpg || 0);
    const maximumDelta = Math.max(0.08, Number(stCfg('objetivos.variacionAcumuladaMaximaPpg', 0.24)));
    const nextAccumulated = stClamp(accumulated + delta, -maximumDelta, maximumDelta);
    if(Math.abs(nextAccumulated - accumulated) < 0.001) return null;
    current.objectiveContextDeltaPpg = Number(nextAccumulated.toFixed(3));
    current.objectiveContextLastRevisionDay = day;
    game.managerStats.currentSeason = current;
    game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, game.selectedClubId);
    const nextPpg = Number(game.managerStats.currentSeason.objectivePpg || previousPpg);
    const previousObjective = typeof managerCareerQualitativeObjective === 'function' ? managerCareerQualitativeObjective(game.selectedClubId, previousPpg) : null;
    const nextObjective = typeof managerCareerQualitativeObjective === 'function' ? managerCareerQualitativeObjective(game.selectedClubId, nextPpg) : null;
    const revision = {
      id:`objective-revision:${game.seasonNumber || 1}:${game.selectedClubId}:${day}`,
      day, date:stNow(), direction, delta:Number((nextPpg - previousPpg).toFixed(3)), previousPpg, nextPpg,
      previousLabel:previousObjective?.label || '', nextLabel:nextObjective?.label || '', reason:reasons.join('; '),
      position:standing.position, played:Number(current.played || 0)
    };
    game.managerStats.currentSeason.objectiveContextRevisions = [...revisions, revision].slice(-6);
    if(typeof pushGameMessage === 'function'){
      const raised = direction === 'increase';
      pushGameMessage({
        type:'directiva', priority:'high', title:'Objetivo revisado por la directiva',
        body:`El contexto de la temporada cambió porque ${reasons.join(' y ')}. El objetivo pasa de ${previousObjective?.label || previousPpg.toFixed(2)} a ${nextObjective?.label || nextPpg.toFixed(2)}. ${nextObjective?.minimumLabel || ''}`,
        id:revision.id
      });
    }
    return revision;
  }
  function processManagerObjectiveContextDaily(){
    try{ return stObjectiveContextAssessment(); }catch(error){ console.warn('No se pudo revisar el objetivo contextual', error); return null; }
  }
  window.processManagerObjectiveContextDaily = processManagerObjectiveContextDaily;

  if(typeof managerObjectiveProgressInfo === 'function'){
    const managerObjectiveProgressInfoV871 = managerObjectiveProgressInfo;
    managerObjectiveProgressInfo = function(){
      const info = managerObjectiveProgressInfoV871();
      const current = game?.managerStats?.currentSeason || {};
      return {
        ...info,
        originalObjective:Number.isFinite(Number(current.objectiveOriginalPpg)) ? Number(current.objectiveOriginalPpg) : info.objective,
        contextualDelta:Number(current.objectiveContextDeltaPpg || 0),
        contextualRevisions:stNormalizeObjectiveRevisions(current.objectiveContextRevisions),
        contextuallyRevised:stNormalizeObjectiveRevisions(current.objectiveContextRevisions).length > 0
      };
    };
  }

  function stMatchMoments(entry){
    const clubId = Number(entry?.clubId || 0);
    const startDate = String(entry?.startDate || entry?.startedAt || '');
    const endDate = String(entry?.endDate || entry?.createdAt || '');
    const matches = (Array.isArray(game?.matchHistory) ? game.matchHistory : [])
      .filter(match => {
        if(!match?.played || match?.friendly || (Number(match.homeId) !== clubId && Number(match.awayId) !== clubId)) return false;
        const date = String(match.date || match.playedDate || '');
        if(startDate && date && date < startDate) return false;
        if(endDate && date && date > endDate.slice(0,10)) return false;
        return true;
      });
    let best = null;
    let worst = null;
    matches.forEach(match => {
      const home = Number(match.homeId) === Number(clubId);
      const gf = Number(home ? match.homeGoals : match.awayGoals) || 0;
      const gc = Number(home ? match.awayGoals : match.homeGoals) || 0;
      const opponentId = Number(home ? match.awayId : match.homeId) || 0;
      const opponent = stClub(opponentId)?.name || 'rival';
      const margin = gf - gc;
      const score = `${gf}-${gc}`;
      const item = { margin, gf, gc, opponent, score, date:String(match.date || match.playedDate || '') };
      if(!best || margin > best.margin || (margin === best.margin && gf > best.gf)) best = item;
      if(!worst || margin < worst.margin || (margin === worst.margin && gc > worst.gc)) worst = item;
    });
    return { best, worst };
  }
  function stDecisionSummary(entry){
    const state = ensureManagerConsequences();
    const items = state.items.filter(item => Number(item.season) === Number(entry.season) && Number(item.clubId) === Number(entry.clubId));
    const negative = items.filter(item => item.status === 'resolved' && item.result === 'negative').slice(-1)[0];
    const positive = items.filter(item => item.status === 'resolved' && item.result === 'positive').slice(-1)[0];
    const pending = items.filter(item => item.status === 'pending');
    const decisive = negative || positive || items.slice(-1)[0] || null;
    return {
      decisive:decisive ? (decisive.resultLabel || decisive.label || 'Una decisión importante condicionó la temporada') : 'No hubo una decisión aislada por encima del rendimiento general.',
      pending:pending.length,
      pendingLabel:pending.length ? `${pending.length} consecuencia(s) todavía pueden resolverse.` : 'No quedan consecuencias pendientes de esta etapa.'
    };
  }
  function stNarrativeTitle(entry){
    const score = Number(entry.evaluationScore || 0);
    if(entry.status === 'dismissal') return 'Un ciclo que terminó antes de tiempo';
    if(entry.status === 'resignation') return 'Una salida por decisión propia';
    if(entry.promoted) return 'Una temporada de ascenso';
    if(entry.title || Number(entry.position) === 1) return 'Una temporada de campeonato';
    if(score >= 85) return 'Una campaña que elevó la carrera';
    if(score >= 70) return 'Una temporada de crecimiento';
    if(score >= 55) return 'Una campaña con saldo positivo';
    if(score >= 40) return 'Una temporada irregular';
    return 'Una campaña marcada por la crisis';
  }
  function buildManagerSeasonNarrative(entry){
    if(!entry) return null;
    const moments = stMatchMoments(entry);
    const decisions = stDecisionSummary(entry);
    const components = entry.components || {};
    const revisions = stNormalizeObjectiveRevisions(entry.objectiveRevisions || entry.objectiveContextRevisions || []);
    const dressing = entry.dressingRoom || {};
    const profileChange = entry.profileChange || {};
    const objectiveText = entry.objectiveStatus === 'Cumplido'
      ? `El objetivo ${entry.objective?.label || 'deportivo'} fue cumplido.`
      : entry.objectiveStatus === 'Mínimo cumplido'
        ? `No se alcanzó la meta principal, pero sí el mínimo exigido.`
        : `El objetivo ${entry.objective?.label || 'deportivo'} quedó incumplido.`;
    const bestMoment = moments.best && moments.best.margin > 0 ? `La victoria ${moments.best.score} ante ${moments.best.opponent}${moments.best.date ? ` (${moments.best.date})` : ''} fue el resultado más contundente.` : 'No hubo una victoria claramente dominante en el registro disponible.';
    const worstMoment = moments.worst && moments.worst.margin < 0 ? `La derrota ${moments.worst.score} ante ${moments.worst.opponent}${moments.worst.date ? ` (${moments.worst.date})` : ''} marcó el punto deportivo más bajo.` : 'El equipo evitó derrotas especialmente amplias.';
    const economyLabel = Number(components.economy || 50) >= 65 ? 'La gestión económica fortaleció al club.' : Number(components.economy || 50) < 40 ? 'La economía terminó debilitando la evaluación.' : 'La gestión económica fue estable.';
    const developmentLabel = Number(components.development || 50) >= 65 ? 'El plantel mostró una evolución clara.' : Number(components.development || 50) < 40 ? 'El plantel perdió valor o desarrollo.' : 'La evolución del plantel fue moderada.';
    const dressingLabel = Number(dressing.generalTrust ?? components.leadership ?? 50) >= 65 ? 'El vestuario terminó respaldando al mánager.' : Number(dressing.generalTrust ?? components.leadership ?? 50) < 40 ? 'El vestuario cerró la etapa con dudas o tensión.' : 'La relación con el vestuario se mantuvo estable.';
    const delta = Number(profileChange.prestigeDelta || 0);
    const profileLabel = `La etapa modificó el prestigio de carrera en ${delta >= 0 ? '+' : ''}${delta} y dejó el momento profesional en ${Number(profileChange.momentAfter || 0) >= 0 ? '+' : ''}${Number(profileChange.momentAfter || 0)}.`;
    return {
      version:STAGE_THREE_VERSION,
      title:stNarrativeTitle(entry),
      summary:`${entry.clubName || 'El club'} terminó ${entry.position ? `en el puesto ${entry.position}` : 'la etapa'} con una evaluación de ${entry.evaluationScore}/100. ${objectiveText}`,
      bestMoment,
      worstMoment,
      decisiveDecision:decisions.decisive,
      management:`${economyLabel} ${developmentLabel}`,
      dressingRoom:dressingLabel,
      objectiveReview:revisions.length ? `La directiva revisó el objetivo ${revisions.length} vez/veces durante la temporada. La última modificación se explicó por ${revisions[revisions.length-1].reason}.` : 'La expectativa deportiva se mantuvo sin revisiones contextuales.',
      profile:profileLabel,
      nextSeason:decisions.pendingLabel,
      tags:[entry.evaluationLabel, entry.objectiveStatus, revisions.length ? 'Objetivo revisado' : 'Objetivo estable'].filter(Boolean),
      generatedAt:new Date().toISOString()
    };
  }
  window.buildManagerSeasonNarrative = buildManagerSeasonNarrative;

  function stEnrichLatestEntry(status='season_end'){
    if(!game?.managerStats) return null;
    const history = Array.isArray(game.managerStats.seasonHistory) ? game.managerStats.seasonHistory : [];
    const candidates = history.filter(item => Number(item.season) === Number(game.seasonNumber || 1) && Number(item.clubId) === Number(game.selectedClubId || 0) && String(item.status) === String(status));
    const entry = candidates.sort((a,b)=>String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    if(!entry) return null;
    const current = game.managerStats.currentSeason || {};
    entry.objectiveRevisions = stNormalizeObjectiveRevisions(current.objectiveContextRevisions || entry.objectiveRevisions);
    entry.objectiveOriginalPpg = Number.isFinite(Number(current.objectiveOriginalPpg)) ? Number(current.objectiveOriginalPpg) : null;
    entry.objectiveFinalPpg = Number.isFinite(Number(current.objectivePpg)) ? Number(current.objectivePpg) : null;
    entry.narrative = buildManagerSeasonNarrative(entry);
    const legacy = (game.managerStats.seasons || []).find(item => Number(item.season) === Number(entry.season) && Number(item.clubId) === Number(entry.clubId));
    if(legacy){ legacy.objectiveRevisions = entry.objectiveRevisions; legacy.narrative = entry.narrative; }
    const record = game?.seasonTransition?.userRecord;
    if(record && status === 'season_end'){ record.objectiveRevisions = entry.objectiveRevisions; record.narrative = entry.narrative; }
    return entry;
  }

  function stNarrativeMarkup(entry, compact=false){
    const narrative = entry?.narrative || buildManagerSeasonNarrative(entry);
    if(!narrative) return '';
    if(compact){
      return `<section class="career-narrative compact"><p class="label">Historia de la temporada</p><h3>${escapeHtml(narrative.title)}</h3><p>${escapeHtml(narrative.summary)}</p><p class="muted small">${escapeHtml(narrative.profile)}</p></section>`;
    }
    return `<section class="career-narrative"><div class="row"><div><p class="label">Resumen narrativo</p><h3>${escapeHtml(narrative.title)}</h3></div><div class="career-narrative-tags">${(narrative.tags || []).map(tag => `<span class="pill">${escapeHtml(tag)}</span>`).join('')}</div></div><p class="career-narrative-summary">${escapeHtml(narrative.summary)}</p><div class="career-narrative-grid"><div><span>Mejor momento</span><p>${escapeHtml(narrative.bestMoment)}</p></div><div><span>Peor momento</span><p>${escapeHtml(narrative.worstMoment)}</p></div><div><span>Decisión influyente</span><p>${escapeHtml(narrative.decisiveDecision)}</p></div><div><span>Gestión</span><p>${escapeHtml(narrative.management)}</p></div><div><span>Vestuario</span><p>${escapeHtml(narrative.dressingRoom)}</p></div><div><span>Objetivo</span><p>${escapeHtml(narrative.objectiveReview)}</p></div></div><div class="career-narrative-footer"><p>${escapeHtml(narrative.profile)}</p><p>${escapeHtml(narrative.nextSeason)}</p></div></section>`;
  }

  if(typeof finalizeSeasonIfNeeded === 'function'){
    const finalizeSeasonIfNeededV871 = finalizeSeasonIfNeeded;
    finalizeSeasonIfNeeded = function(options={}){
      const before = Boolean(game?.seasonFinalized);
      const result = finalizeSeasonIfNeededV871(options);
      if(!before && game?.seasonFinalized){
        const entry = stEnrichLatestEntry('season_end');
        if(entry && typeof saveLocal === 'function') saveLocal(true);
      }
      return result;
    };
  }
  if(typeof recordDismissedCareerStep === 'function'){
    const recordDismissedCareerStepV871 = recordDismissedCareerStep;
    recordDismissedCareerStep = function(){
      const status = game?.gameOver?.type === 'resignation' ? 'resignation' : 'dismissal';
      const result = recordDismissedCareerStepV871();
      const entry = stEnrichLatestEntry(status);
      if(entry && typeof saveLocal === 'function') saveLocal(true);
      return result;
    };
  }

  if(typeof seasonEndPanelMarkup === 'function'){
    const seasonEndPanelMarkupV871 = seasonEndPanelMarkup;
    seasonEndPanelMarkup = function(){
      const html = seasonEndPanelMarkupV871();
      const entry = (game?.managerStats?.seasonHistory || []).find(item => Number(item.season) === Number(game?.seasonNumber || 0) && Number(item.clubId) === Number(game?.selectedClubId || 0) && String(item.status) === 'season_end');
      if(!entry) return html;
      const narrative = stNarrativeMarkup(entry, true);
      if(!narrative || html.includes('career-narrative')) return html;
      return html.replace('<div class="row" style="margin-top:12px">', `${narrative}<div class="row" style="margin-top:12px">`);
    };
  }
  if(typeof openSeasonEndModal === 'function'){
    const openSeasonEndModalV871 = openSeasonEndModal;
    openSeasonEndModal = function(){
      const result = openSeasonEndModalV871();
      const modal = document.querySelector('.season-end-modal');
      const entry = (game?.managerStats?.seasonHistory || []).find(item => Number(item.season) === Number(game?.seasonNumber || 0) && Number(item.clubId) === Number(game?.selectedClubId || 0) && String(item.status) === 'season_end');
      if(modal && entry && !modal.querySelector('.career-narrative')) modal.insertAdjacentHTML('beforeend', stNarrativeMarkup(entry, false));
      return result;
    };
  }

  if(typeof renderManagerStats === 'function'){
    const renderManagerStatsV871 = renderManagerStats;
    renderManagerStats = function(){
      const result = renderManagerStatsV871();
      const viewMode = typeof managerStatsViewMode !== 'undefined' ? managerStatsViewMode : window.managerStatsViewMode;
      if(String(viewMode || 'profile') !== 'profile') return result;
      const entries = (Array.isArray(game?.managerStats?.seasonHistory) ? game.managerStats.seasonHistory : []).filter(item => item.narrative).slice(0,5);
      if(!entries.length || document.querySelector('.career-narrative-history')) return result;
      const target = document.querySelector('.career-profile-stage-one');
      if(target){
        target.insertAdjacentHTML('beforeend', `<div class="card career-narrative-history"><h3>Historia reciente de la carrera</h3><div class="career-narrative-history-list">${entries.map(entry => `<article><div><span>Temporada ${entry.season} · ${escapeHtml(entry.clubName || '')}</span><strong>${escapeHtml(entry.narrative.title || '')}</strong></div><p>${escapeHtml(entry.narrative.summary || '')}</p><small>${escapeHtml(entry.narrative.profile || '')}</small></article>`).join('')}</div></div>`);
      }
      return result;
    };
  }

  if(typeof renderCareerJobs === 'function'){
    const renderCareerJobsV871 = renderCareerJobs;
    renderCareerJobs = function(){
      const result = renderCareerJobsV871();
      if(game?.gameOver?.active){
        const panel = document.querySelector('.job-market-panel');
        if(panel && !panel.querySelector('.career-job-profile-summary')){
          const profile = stProfile();
          panel.insertAdjacentHTML('afterbegin', `<div class="career-job-profile-summary"><div><span>Prestigio de carrera</span><strong>${profile.prestige}/1000</strong></div><div><span>Momento profesional</span><strong class="${profile.moment >= 0 ? 'ok' : 'danger'}">${profile.moment >= 0 ? '+' : ''}${profile.moment}</strong></div><p>Las ofertas ahora combinan trayectoria, últimas tres evaluaciones, capacidad requerida, experiencia, estabilidad y momento actual.</p></div>`);
        }
      }
      return result;
    };
  }

  if(typeof renderHome === 'function'){
    const renderHomeV871 = renderHome;
    renderHome = function(){
      const result = renderHomeV871();
      const revisions = stNormalizeObjectiveRevisions(game?.managerStats?.currentSeason?.objectiveContextRevisions);
      const card = document.querySelector('.office-objective-card');
      if(card && revisions.length && !card.querySelector('.objective-context-note')){
        const last = revisions[revisions.length - 1];
        card.insertAdjacentHTML('beforeend', `<small class="objective-context-note">Revisado: ${escapeHtml(last.reason)}</small>`);
      }
      return result;
    };
  }

  if(typeof toggleTransferListed === 'function'){
    const toggleTransferListedV871 = toggleTransferListed;
    toggleTransferListed = function(playerId, value){
      const entry = stDressingEntry(playerId);
      const player = (seed?.players || []).find(item => Number(item.id) === Number(playerId));
      const result = toggleTransferListedV871(playerId, value);
      if(value && entry && Array.isArray(entry.tags) && entry.tags.includes('referent')){
        scheduleManagerConsequence('transfer_list_referent', {
          key:`transfer-list:${game?.seasonNumber || 1}:${game?.selectedClubId || 0}:${playerId}:${stNow()}`,
          playerId, label:player?.name || '', intensity:entry.tags.includes('captain') ? 2 : 1
        });
      }
      return result;
    };
  }
  if(typeof completeTransferSaleFromMessage === 'function'){
    const completeTransferSaleFromMessageV871 = completeTransferSaleFromMessage;
    completeTransferSaleFromMessage = function(msg, player, options={}){
      const playerId = Number(player?.id || msg?.action?.playerId || 0);
      const entry = stDressingEntry(playerId);
      const snapshot = entry ? { tags:[...(entry.tags || [])], influence:Number(entry.influence || 0), name:player?.name || '' } : null;
      const clubId = Number(player?.clubId || game?.selectedClubId || 0);
      const result = completeTransferSaleFromMessageV871(msg, player, options);
      if(result?.executed && snapshot && (snapshot.tags.includes('referent') || snapshot.tags.includes('captain'))){
        scheduleManagerConsequence('referent_sale', {
          key:`referent-sale:${game?.seasonNumber || 1}:${clubId}:${playerId}:${stNow()}`,
          clubId, playerId, label:snapshot.name, intensity:snapshot.tags.includes('captain') ? 2 : 1,
          context:{ influence:snapshot.influence, amount:Number(result.netAmount || result.amount || 0) }
        });
      }
      return result;
    };
  }
  if(typeof dismissOwnPlayer === 'function'){
    const dismissOwnPlayerV871 = dismissOwnPlayer;
    dismissOwnPlayer = function(playerId){
      const player = (seed?.players || []).find(item => Number(item.id) === Number(playerId));
      const entry = stDressingEntry(playerId);
      const snapshot = entry ? { tags:[...(entry.tags || [])], name:player?.name || '' } : null;
      const clubId = Number(player?.clubId || game?.selectedClubId || 0);
      const result = dismissOwnPlayerV871(playerId);
      if(snapshot && (snapshot.tags.includes('referent') || snapshot.tags.includes('captain')) && Number(player?.clubId || 0) !== clubId){
        scheduleManagerConsequence('referent_dismissal', {
          key:`referent-dismissal:${game?.seasonNumber || 1}:${clubId}:${playerId}:${stNow()}`,
          clubId, playerId, label:snapshot.name, intensity:snapshot.tags.includes('captain') ? 2 : 1
        });
      }
      return result;
    };
  }
  if(typeof promoteAcademyPlayer === 'function'){
    const promoteAcademyPlayerV871 = promoteAcademyPlayer;
    promoteAcademyPlayer = function(playerId, exactPosition){
      const academyPlayer = game?.academy?.players?.find(item => Number(item.id) === Number(playerId));
      const beforeClub = Number((seed?.players || []).find(item => Number(item.id) === Number(playerId))?.clubId || 0);
      const result = promoteAcademyPlayerV871(playerId, exactPosition);
      const official = (seed?.players || []).find(item => Number(item.id) === Number(playerId));
      if(academyPlayer && Number(official?.clubId || 0) === Number(game?.selectedClubId || 0) && beforeClub !== Number(official.clubId)){
        scheduleManagerConsequence('youth_promotion', {
          key:`youth-promotion:${game?.seasonNumber || 1}:${game?.selectedClubId || 0}:${playerId}:${stNow()}`,
          playerId, label:official.name || academyPlayer.name || '', intensity:1,
          context:{ playedAtPromotion:Number(game?.playerStats?.[playerId]?.played || 0) }
        });
      }
      return result;
    };
  }

  if(typeof processDailyCalendarState === 'function'){
    const processDailyCalendarStateV871 = processDailyCalendarState;
    processDailyCalendarState = function(dateAfter='', options={}){
      const result = processDailyCalendarStateV871(dateAfter, options) || {};
      stTrackCaptainChange();
      const consequenceResult = processManagerConsequencesDaily();
      const objectiveRevision = processManagerObjectiveContextDaily();
      return { ...result, managerConsequences:consequenceResult, managerObjectiveRevision:objectiveRevision };
    };
  }

  if(typeof normalizeGame === 'function'){
    const normalizeGameV871 = normalizeGame;
    normalizeGame = function(saved){
      const normalized = normalizeGameV871(saved);
      normalized.managerCareerConsequences = normalizeManagerConsequences(saved?.managerCareerConsequences || normalized.managerCareerConsequences || {});
      normalized.managerStats = normalizeManagerStats(normalized.managerStats || {});
      return normalized;
    };
  }
  if(typeof newGame === 'function'){
    const newGameV871 = newGame;
    newGame = function(selectedClubId, options={}){
      const result = newGameV871(selectedClubId, options);
      if(game){ game.managerCareerConsequences = normalizeManagerConsequences({}); game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, game.selectedClubId || selectedClubId); }
      return result;
    };
  }
  if(typeof continueCareerAtClub === 'function'){
    const continueCareerAtClubV871 = continueCareerAtClub;
    continueCareerAtClub = function(selectedClubId, options={}){
      const result = continueCareerAtClubV871(selectedClubId, options);
      if(game && !game?.gameOver?.active){
        ensureManagerConsequences();
        game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, game.selectedClubId || selectedClubId);
      }
      return result;
    };
  }
  if(typeof startNextSeason === 'function'){
    const startNextSeasonV871 = startNextSeason;
    startNextSeason = function(selectedClubId, options={}){
      const result = startNextSeasonV871(selectedClubId, options);
      if(game && !game.seasonFinalized){
        ensureManagerConsequences();
        game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, game.selectedClubId || selectedClubId);
      }
      return result;
    };
  }

  window.managerCareerStageThree = {
    version:STAGE_THREE_VERSION,
    profileMatch:managerCareerProfileMatch,
    clubNeed:managerCareerClubNeed,
    scheduleConsequence:scheduleManagerConsequence,
    processConsequences:processManagerConsequencesDaily,
    reviewObjective:processManagerObjectiveContextDaily,
    narrative:buildManagerSeasonNarrative
  };
})();
