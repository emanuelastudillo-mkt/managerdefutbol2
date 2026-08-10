/* V9.63 · Estrategias de mercado para clubes bot.
   Cada club adopta por temporada un perfil Normal, Fichar barato o Gastar todo. */

function botMarketStrategiesConfig(){
  const source=window.GAME_CONFIG?.mercadoBots || {};
  const number=(key,fallback,min=null,max=null)=>{
    let value=Number(source?.[key]);
    if(!Number.isFinite(value)) value=Number(fallback);
    if(Number.isFinite(min)) value=Math.max(min,value);
    if(Number.isFinite(max)) value=Math.min(max,value);
    return value;
  };
  const profile=(id,label,defaults)=>{
    const raw=source?.perfiles?.[id] || {};
    const value=(key,fallback,min=null,max=null)=>{
      let result=Number(raw?.[key]);
      if(!Number.isFinite(result)) result=Number(fallback);
      if(Number.isFinite(min)) result=Math.max(min,result);
      if(Number.isFinite(max)) result=Math.min(max,result);
      return result;
    };
    return {
      id,label,
      weight:value('peso',defaults.weight,0,100),
      reserveCashRate:value('reservaCajaPct',defaults.reserveCashRate,0,0.90),
      payrollCoverage:value('coberturaMasaSalarialAnios',defaults.payrollCoverage,0,2),
      maxFeeCashRate:value('maximoPorCompraSobreCajaPct',defaults.maxFeeCashRate,0.02,0.95),
      maxSeasonSpendRate:value('gastoTemporadaSobreCajaInicialPct',defaults.maxSeasonSpendRate,0.05,1.20),
      maxSignings:Math.max(1,Math.round(value('maximoAltasTemporada',defaults.maxSignings,1,12))),
      minImprovement:value('mejoraMinimaMedia',defaults.minImprovement,-5,15),
      minimumOfferRate:value('ofertaMinimaClausulaPct',defaults.minimumOfferRate,0.20,1.30),
      maximumOfferRate:value('ofertaMaximaClausulaPct',defaults.maximumOfferRate,0.25,1.50),
      maximumAge:Math.max(18,Math.round(value('edadMaximaObjetivo',defaults.maximumAge,18,42))),
      freePriority:value('prioridadLibres',defaults.freePriority,0,200),
      listedPriority:value('prioridadTransferibles',defaults.listedPriority,0,200),
      qualityPriority:value('prioridadCalidad',defaults.qualityPriority,0,200)
    };
  };
  const profiles={
    normal:profile('normal','Normal',{weight:52,reserveCashRate:0.34,payrollCoverage:0.55,maxFeeCashRate:0.23,maxSeasonSpendRate:0.58,maxSignings:4,minImprovement:1,minimumOfferRate:0.62,maximumOfferRate:0.88,maximumAge:32,freePriority:35,listedPriority:28,qualityPriority:70}),
    bargain:profile('bargain','Fichar barato',{weight:31,reserveCashRate:0.50,payrollCoverage:0.72,maxFeeCashRate:0.13,maxSeasonSpendRate:0.32,maxSignings:5,minImprovement:-1,minimumOfferRate:0.38,maximumOfferRate:0.64,maximumAge:35,freePriority:115,listedPriority:105,qualityPriority:42}),
    all_in:profile('all_in','Gastar todo',{weight:17,reserveCashRate:0.05,payrollCoverage:0.18,maxFeeCashRate:0.48,maxSeasonSpendRate:0.94,maxSignings:6,minImprovement:3,minimumOfferRate:0.82,maximumOfferRate:1.08,maximumAge:30,freePriority:18,listedPriority:20,qualityPriority:125})
  };
  return {
    active:source.activo !== false,
    freeReviewDays:Math.max(1,Math.round(number('intervaloRevisionLibresDias',5,1,60))),
    paidReviewDays:Math.max(1,Math.round(number('intervaloRevisionComprasDias',7,1,60))),
    clubsPerReview:Math.max(1,Math.round(number('clubesEvaluadosPorRevision',14,1,60))),
    freePerReview:Math.max(1,Math.round(number('maximoLibresPorRevision',4,1,30))),
    paidPerReview:Math.max(1,Math.round(number('maximoComprasPorRevision',5,1,30))),
    minimumSquad:Math.max(12,Math.round(number('plantelMinimo',20,12,35))),
    idealSquad:Math.max(18,Math.round(number('plantelIdeal',25,18,40))),
    maximumSquad:Math.max(20,Math.round(number('plantelMaximo',30,20,45))),
    sellerTaxRate:Math.max(0,Math.min(0.90,number('impuestoVentaBotPct',Number(window.GAME_CONFIG?.mercado?.impuestoAfaTraspasos ?? 0.30),0,0.90))),
    transferListPerClub:Math.max(0,Math.round(number('maximoNuevosTransferiblesPorClub',1,0,4))),
    logLimit:Math.max(30,Math.round(number('historialInternoMaximo',180,30,1000))),
    profiles
  };
}
function normalizeBotMarketStrategiesState(value,state=game){
  const cfg=botMarketStrategiesConfig();
  const source=value && typeof value==='object' && !Array.isArray(value) ? value : {};
  const season=Math.max(1,Math.round(Number(state?.seasonNumber || 1)));
  const sameSeason=Math.max(1,Math.round(Number(source.season || season)))===season;
  const profiles=sameSeason && source.profiles && typeof source.profiles==='object' && !Array.isArray(source.profiles)
    ? Object.fromEntries(Object.entries(source.profiles).map(([key,item])=>[String(key),String(item || '')]).filter(([,item])=>cfg.profiles[item])) : {};
  const counts=sameSeason && source.clubSeasonSignings && typeof source.clubSeasonSignings==='object' && !Array.isArray(source.clubSeasonSignings)
    ? Object.fromEntries(Object.entries(source.clubSeasonSignings).map(([key,item])=>[String(key),Math.max(0,Math.round(Number(item || 0)))])) : {};
  const spend=sameSeason && source.clubSeasonSpend && typeof source.clubSeasonSpend==='object' && !Array.isArray(source.clubSeasonSpend)
    ? Object.fromEntries(Object.entries(source.clubSeasonSpend).map(([key,item])=>[String(key),Math.max(0,Math.round(Number(item || 0)))])) : {};
  const openingCash=sameSeason && source.clubOpeningCash && typeof source.clubOpeningCash==='object' && !Array.isArray(source.clubOpeningCash)
    ? Object.fromEntries(Object.entries(source.clubOpeningCash).map(([key,item])=>[String(key),Math.max(0,Math.round(Number(item || 0)))])) : {};
  const log=(Array.isArray(source.log)?source.log:[]).map(item=>({
    season:Math.max(1,Math.round(Number(item?.season || season))),date:String(item?.date || ''),type:String(item?.type || ''),strategy:String(item?.strategy || ''),
    playerId:Number(item?.playerId || 0),playerName:String(item?.playerName || ''),overall:Math.max(1,Math.min(99,Math.round(Number(item?.overall || 1)))),
    fromClubId:Number(item?.fromClubId || 0),toClubId:Number(item?.toClubId || 0),amount:Math.max(0,Math.round(Number(item?.amount || 0)))
  })).filter(item=>item.playerId && item.toClubId).slice(-cfg.logLimit);
  return {
    version:'V9.63',season,profiles,clubSeasonSignings:counts,clubSeasonSpend:spend,clubOpeningCash:openingCash,
    lastFreeReviewDate:sameSeason?String(source.lastFreeReviewDate || ''):'',
    lastPaidReviewDate:sameSeason?String(source.lastPaidReviewDate || ''):'',log
  };
}
function ensureBotMarketStrategiesState(state=game){
  if(!state) return normalizeBotMarketStrategiesState({},state);
  state.botMarketStrategies=normalizeBotMarketStrategiesState(state.botMarketStrategies || {},state);
  return state.botMarketStrategies;
}
function botMarketStrategyClubEligible(club){
  if(!club || !Number(club.id || 0)) return false;
  if(Number(club.id)===Number(game?.selectedClubId || 0)) return false;
  if(club.specialCompetitionOnly || club.competitionOnly) return false;
  if(typeof isSpecialCompetitionOnlyClub==='function' && isSpecialCompetitionOnlyClub(club)) return false;
  return true;
}
function botMarketStrategyCash(club){
  if(typeof eliteBotMarketClubCash==='function') return eliteBotMarketClubCash(club);
  return Math.max(0,Math.round(Number(game?.clubBudgets?.[club?.id] ?? club?.budget ?? 0)));
}
function botMarketStrategySquad(clubId){
  if(typeof eliteBotMarketSquad==='function') return eliteBotMarketSquad(clubId);
  return (typeof playersByClub==='function'?playersByClub(Number(clubId)):(seed?.players || []).filter(player=>Number(player?.clubId || 0)===Number(clubId)))
    .filter(player=>player && !player.retired && !player.sold && !player.freeAgent && !player.youthFreeAgent);
}
function botMarketStrategyOverall(player){
  return typeof eliteBotMarketOverall==='function' ? eliteBotMarketOverall(player) : Math.max(1,Math.min(99,Math.round(Number(player?.overall || player?.media || 1))));
}
function botMarketStrategyProfileIdForClub(club,state=ensureBotMarketStrategiesState()){
  if(!club) return 'normal';
  const cfg=botMarketStrategiesConfig();
  const key=String(Number(club.id || 0));
  if(cfg.profiles[state.profiles[key]]) return state.profiles[key];
  const cash=botMarketStrategyCash(club);
  const prestige=typeof eliteBotMarketClubPrestige==='function' ? eliteBotMarketClubPrestige(club) : Math.max(1,Math.round(Number(club?.reputation || club?.prestigio || 50)));
  const weights={normal:cfg.profiles.normal.weight,bargain:cfg.profiles.bargain.weight,all_in:cfg.profiles.all_in.weight};
  if(cash<Math.max(5000000,prestige*250000)){ weights.bargain+=25; weights.all_in=Math.max(1,weights.all_in-10); }
  if(cash>Math.max(100000000,prestige*3000000) && prestige>=70){ weights.all_in+=18; weights.bargain=Math.max(1,weights.bargain-6); }
  const total=Object.values(weights).reduce((sum,value)=>sum+Math.max(0,value),0) || 1;
  const roll=(typeof hashNumber==='function'?hashNumber(`bot-market-profile-${game?.saveCode || ''}-${state.season}-${key}`,100000):((Number(key)*31+state.season*17)%100000))/100000*total;
  let cursor=0; let selected='normal';
  for(const id of ['normal','bargain','all_in']){ cursor+=Math.max(0,weights[id]); if(roll<cursor){ selected=id; break; } }
  state.profiles[key]=selected;
  if(!Number.isFinite(Number(state.clubOpeningCash[key]))) state.clubOpeningCash[key]=cash;
  return selected;
}
function botMarketStrategyForClub(clubOrId,state=ensureBotMarketStrategiesState()){
  const club=typeof clubOrId==='object' ? clubOrId : (seed?.clubs || []).find(item=>Number(item.id)===Number(clubOrId));
  const cfg=botMarketStrategiesConfig();
  if(!club) return cfg.profiles.normal;
  return cfg.profiles[botMarketStrategyProfileIdForClub(club,state)] || cfg.profiles.normal;
}
function botMarketStrategyPolicyForClub(clubOrId){ return botMarketStrategyForClub(clubOrId); }
function botMarketStrategyOwnSignings(clubId,state=ensureBotMarketStrategiesState()){
  return Math.max(0,Math.round(Number(state?.clubSeasonSignings?.[String(clubId)] || 0)));
}
function botMarketStrategyCombinedSignings(clubId){
  const own=botMarketStrategyOwnSignings(clubId);
  const elite=Math.max(0,Math.round(Number(game?.eliteBotMarket?.clubSeasonSignings?.[String(clubId)] || 0)));
  return own+elite;
}
function botMarketStrategySeasonSpend(clubId,state=ensureBotMarketStrategiesState()){
  return Math.max(0,Math.round(Number(state?.clubSeasonSpend?.[String(clubId)] || 0)));
}
function botMarketStrategyPayroll(clubId){
  if(typeof eliteBotMarketAnnualPayroll==='function') return eliteBotMarketAnnualPayroll(clubId);
  if(typeof totalClubSalary==='function') return Math.max(0,Math.round(Number(totalClubSalary(clubId) || 0)));
  return botMarketStrategySquad(clubId).reduce((sum,player)=>sum+Math.max(0,Number(player?.salary || 0)),0);
}
function botMarketStrategyFinancialCheck(club,player,fee,profile=botMarketStrategyForClub(club),state=ensureBotMarketStrategiesState()){
  const cash=botMarketStrategyCash(club);
  const safeFee=Math.max(0,Math.round(Number(fee || 0)));
  const salary=Math.max(0,Math.round(Number(player?.salary || 0)));
  const payrollAfter=botMarketStrategyPayroll(club.id)+salary;
  const cashAfter=cash-safeFee;
  const key=String(club.id);
  if(!Number.isFinite(Number(state.clubOpeningCash[key]))) state.clubOpeningCash[key]=cash;
  const openingCash=Math.max(cash,Math.round(Number(state.clubOpeningCash[key] || cash)));
  const spent=botMarketStrategySeasonSpend(club.id,state);
  const seasonLimit=Math.max(0,Math.round(openingCash*profile.maxSeasonSpendRate));
  const reserve=Math.max(Math.round(cash*profile.reserveCashRate),Math.round(payrollAfter*profile.payrollCoverage));
  if(cash<=0 || cashAfter<0 || cashAfter<reserve) return {ok:false,cash,cashAfter,reserve,seasonLimit,spent,payrollAfter};
  if(safeFee>Math.round(cash*profile.maxFeeCashRate)) return {ok:false,cash,cashAfter,reserve,seasonLimit,spent,payrollAfter};
  if(safeFee>0 && spent+safeFee>seasonLimit) return {ok:false,cash,cashAfter,reserve,seasonLimit,spent,payrollAfter};
  if(safeFee===0 && salary>Math.max(1,Math.round(cash*(profile.id==='bargain'?0.10:profile.id==='all_in'?0.24:0.16)))) return {ok:false,cash,cashAfter,reserve,seasonLimit,spent,payrollAfter};
  return {ok:true,cash,cashAfter,reserve,seasonLimit,spent,payrollAfter};
}
function botMarketStrategyGroup(player){ return typeof playerRoleGroup==='function' ? playerRoleGroup(player?.position) : (String(player?.position || '')==='POR'?'POR':'MID'); }
function botMarketStrategySquadAnalysis(clubId){
  const squad=botMarketStrategySquad(clubId);
  const groups={POR:[],DEF:[],MID:[],ATT:[]};
  squad.forEach(player=>{ const group=botMarketStrategyGroup(player); (groups[group] || groups.MID).push(player); });
  const targets={POR:2,DEF:7,MID:7,ATT:5};
  const average=list=>list.length?list.reduce((sum,player)=>sum+botMarketStrategyOverall(player),0)/list.length:0;
  const overallAverage=average(squad);
  const needs={};
  Object.keys(groups).forEach(group=>{
    const count=groups[group].length;
    const deficit=Math.max(0,targets[group]-count);
    const groupAverage=average(groups[group]);
    needs[group]={count,deficit,average:groupAverage,score:deficit*45+Math.max(0,overallAverage-groupAverage)*4};
  });
  return {squad,groups,needs,overallAverage,size:squad.length};
}
function botMarketStrategyRosterSpace(clubId){
  if(typeof hasFirstTeamRosterSpace==='function') return hasFirstTeamRosterSpace(clubId,1);
  return botMarketStrategySquad(clubId).length<botMarketStrategiesConfig().maximumSquad;
}
function botMarketStrategyPlayerPool(){
  if(typeof eliteBotMarketPlayerPool==='function') return eliteBotMarketPlayerPool();
  const map=new Map();
  (seed?.players || []).forEach(player=>{ if(player?.id) map.set(Number(player.id),player); });
  (game?.marketPlayers || []).forEach(player=>{ if(player?.id && !map.has(Number(player.id))) map.set(Number(player.id),player); });
  return Array.from(map.values());
}
function botMarketStrategyIsExpiring(player){
  const season=Math.max(1,Math.round(Number(game?.seasonNumber || 1)));
  const end=Math.round(Number(player?.contractEndSeason || 0));
  return end>0 && end<=season+1;
}
function botMarketStrategyCandidateScore(club,player,profile,analysis,fee=0,isFree=false){
  const overall=botMarketStrategyOverall(player);
  const group=botMarketStrategyGroup(player);
  const need=analysis.needs[group] || {deficit:0,average:analysis.overallAverage,score:0};
  const improvement=overall-Number(need.average || analysis.overallAverage || 0);
  const age=Math.max(16,Number(player?.age || 25));
  const listed=Boolean(player?.transferListed);
  const expiring=botMarketStrategyIsExpiring(player);
  const cash=Math.max(1,botMarketStrategyCash(club));
  let score=overall*profile.qualityPriority+need.score*18+improvement*80+Math.max(0,31-age)*8;
  if(isFree) score+=profile.freePriority*110;
  if(listed) score+=profile.listedPriority*90;
  if(expiring) score+=profile.listedPriority*55;
  score-=Math.round(Math.max(0,fee)/Math.max(100000,cash/100))*35;
  if(profile.id==='bargain'){
    score+=Math.max(0,33-age)*3;
    if(!isFree && !listed && !expiring) score-=4200;
  }
  if(profile.id==='all_in') score+=overall*55+Math.max(0,improvement)*150;
  if(need.deficit>0) score+=5000+need.deficit*900;
  score+=typeof hashNumber==='function'?hashNumber(`bot-market-score-${game?.saveCode || ''}-${game?.currentDate || ''}-${club.id}-${player.id}-${profile.id}`,90):0;
  return score;
}
function botMarketStrategyFreeCandidates(club,profile,analysis){
  return botMarketStrategyPlayerPool().map(player=>{
    if(!player || player.retired || player.sold) return null;
    const free=Number(player.clubId || 0)===0 || Boolean(player.freeAgent) || Boolean(player.youthFreeAgent);
    if(!free || Number(player.age || 24)>profile.maximumAge) return null;
    const group=botMarketStrategyGroup(player);
    const need=analysis.needs[group] || {deficit:0,average:analysis.overallAverage};
    const improvement=botMarketStrategyOverall(player)-Number(need.average || analysis.overallAverage || 0);
    if(need.deficit<=0 && improvement<profile.minImprovement) return null;
    const finance=botMarketStrategyFinancialCheck(club,player,0,profile);
    if(!finance.ok) return null;
    return {player,score:botMarketStrategyCandidateScore(club,player,profile,analysis,0,true),finance};
  }).filter(Boolean).sort((a,b)=>b.score-a.score || botMarketStrategyOverall(b.player)-botMarketStrategyOverall(a.player) || Number(a.player.id)-Number(b.player.id));
}
function botMarketStrategySellerClub(player){ return (seed?.clubs || []).find(club=>Number(club.id)===Number(player?.clubId || 0)); }
function botMarketStrategySellerAllows(player,seller,analysisByClub){
  if(!seller || !botMarketStrategyClubEligible(seller)) return false;
  if(typeof hasFirstTeamRosterMinimumAfterRemoval==='function' && !hasFirstTeamRosterMinimumAfterRemoval(seller.id,1)) return false;
  if(player?.intransferible) return false;
  if(typeof hasPendingTransferOfferForPlayer==='function' && hasPendingTransferOfferForPlayer(player.id)) return false;
  if(typeof eliteBotMarketHasPortfolioRight==='function' && eliteBotMarketHasPortfolioRight(player.id)) return false;
  const analysis=analysisByClub.get(Number(seller.id)) || botMarketStrategySquadAnalysis(seller.id);
  analysisByClub.set(Number(seller.id),analysis);
  const group=botMarketStrategyGroup(player);
  const groupInfo=analysis.needs[group] || {count:0};
  if(groupInfo.count<=({POR:2,DEF:6,MID:6,ATT:4}[group] || 4)) return false;
  return true;
}
function botMarketStrategyClause(player){
  return Math.max(1,Math.round(Number(typeof playerClauseFor==='function'?playerClauseFor(player):(player?.clause || player?.value || Number(player?.salary || 0)*16 || 1))));
}
function botMarketStrategySellerDemandRate(player,seller){
  const listed=Boolean(player?.transferListed);
  const expiring=botMarketStrategyIsExpiring(player);
  const squad=botMarketStrategySquad(seller.id);
  const avg=squad.length?squad.reduce((sum,item)=>sum+botMarketStrategyOverall(item),0)/squad.length:botMarketStrategyOverall(player);
  const star=botMarketStrategyOverall(player)>=avg+5;
  if(listed && expiring) return 0.38;
  if(listed) return 0.48;
  if(expiring) return 0.54;
  if(star) return 0.90;
  return 0.68;
}
function botMarketStrategyTransferFee(player,buyer,profile,seller){
  const clause=botMarketStrategyClause(player);
  const sellerMin=botMarketStrategySellerDemandRate(player,seller);
  const low=Math.max(profile.minimumOfferRate,sellerMin);
  const high=Math.max(low,profile.maximumOfferRate);
  if(low>profile.maximumOfferRate+0.001) return 0;
  const roll=typeof hashNumber==='function'?hashNumber(`bot-market-fee-${game?.saveCode || ''}-${game?.seasonNumber || 1}-${game?.currentDate || ''}-${player.id}-${buyer.id}`,1001)/1000:0.5;
  let rate=low+(high-low)*roll;
  if(profile.id==='bargain') rate=low+(high-low)*roll*0.45;
  if(Boolean(player?.transferListed)) rate*=0.92;
  if(botMarketStrategyIsExpiring(player)) rate*=0.90;
  return Math.max(1,Math.round(clause*rate/100000)*100000);
}
function botMarketStrategyPaidCandidates(club,profile,analysis,analysisByClub){
  const buyerId=Number(club.id);
  return botMarketStrategyPlayerPool().map(player=>{
    const sellerId=Number(player?.clubId || 0);
    if(!player || player.retired || player.sold || player.freeAgent || player.youthFreeAgent || sellerId<=0 || sellerId===buyerId || sellerId===Number(game?.selectedClubId || 0)) return null;
    if(Number(player.age || 24)>profile.maximumAge) return null;
    const seller=botMarketStrategySellerClub(player);
    if(!botMarketStrategySellerAllows(player,seller,analysisByClub)) return null;
    const group=botMarketStrategyGroup(player);
    const need=analysis.needs[group] || {deficit:0,average:analysis.overallAverage};
    const improvement=botMarketStrategyOverall(player)-Number(need.average || analysis.overallAverage || 0);
    if(need.deficit<=0 && improvement<profile.minImprovement) return null;
    if(profile.id==='bargain' && !player.transferListed && !botMarketStrategyIsExpiring(player) && improvement<3) return null;
    const fee=botMarketStrategyTransferFee(player,club,profile,seller);
    if(!fee) return null;
    const finance=botMarketStrategyFinancialCheck(club,player,fee,profile);
    if(!finance.ok) return null;
    return {player,seller,fee,finance,score:botMarketStrategyCandidateScore(club,player,profile,analysis,fee,false)};
  }).filter(Boolean).sort((a,b)=>b.score-a.score || botMarketStrategyOverall(b.player)-botMarketStrategyOverall(a.player) || a.fee-b.fee || Number(a.player.id)-Number(b.player.id));
}
function botMarketStrategyFinalizeMove(player,toClubId,salt=''){
  if(typeof eliteBotMarketFinalizePlayerMove==='function') return eliteBotMarketFinalizePlayerMove(player,toClubId,salt);
  if(typeof setPlayerClubId==='function') setPlayerClubId(player,Number(toClubId)); else player.clubId=Number(toClubId);
  player.freeAgent=false; player.youthFreeAgent=false; player.sold=false; player.transferListed=false; player.intransferible=false;
  if(typeof invalidatePlayerIndexes==='function') invalidatePlayerIndexes();
}
function botMarketStrategyAddLog(state,item){
  const cfg=botMarketStrategiesConfig();
  state.log=Array.isArray(state.log)?state.log:[];
  state.log.push({season:Number(game?.seasonNumber || 1),date:String(game?.currentDate || ''),...item});
  state.log=state.log.slice(-cfg.logLimit);
  const key=String(item.toClubId || 0);
  state.clubSeasonSignings[key]=botMarketStrategyOwnSignings(item.toClubId,state)+1;
  state.clubSeasonSpend[key]=botMarketStrategySeasonSpend(item.toClubId,state)+Math.max(0,Math.round(Number(item.amount || 0)));
}
function botMarketStrategySignFree(player,club,profile,state){
  botMarketStrategyFinalizeMove(player,club.id,'strategy_free');
  const overall=botMarketStrategyOverall(player);
  if(typeof recordTransferHistory==='function') recordTransferHistory(player,{fromClubId:0,toClubId:Number(club.id),amount:0,kind:'bot_free_signing',source:'bot_market_strategy',transactionKey:`bot-strategy-free-${game?.seasonNumber || 1}-${player.id}-${club.id}`});
  botMarketStrategyAddLog(state,{type:'free',strategy:profile.id,playerId:Number(player.id),playerName:String(player.name || 'Jugador'),overall,fromClubId:0,toClubId:Number(club.id),amount:0});
  return {type:'free',strategy:profile.id,playerId:Number(player.id),clubId:Number(club.id),overall,amount:0};
}
function botMarketStrategyCompleteTransfer(candidate,club,profile,state){
  const player=candidate.player; const seller=candidate.seller; const fee=Math.max(1,Math.round(Number(candidate.fee || 1)));
  game.clubBudgets=game.clubBudgets && typeof game.clubBudgets==='object' && !Array.isArray(game.clubBudgets)?game.clubBudgets:{};
  const buyerCash=botMarketStrategyCash(club); const sellerCash=botMarketStrategyCash(seller);
  if(buyerCash<fee) return null;
  const sellerReceipt=Math.max(0,Math.round(fee*(1-botMarketStrategiesConfig().sellerTaxRate)));
  game.clubBudgets[club.id]=buyerCash-fee;
  game.clubBudgets[seller.id]=sellerCash+sellerReceipt;
  const fromClubId=Number(seller.id);
  if(typeof resetPlayerCaptaincyProgress==='function') resetPlayerCaptaincyProgress(player.id,fromClubId);
  botMarketStrategyFinalizeMove(player,club.id,'strategy_paid');
  const overall=botMarketStrategyOverall(player);
  if(typeof recordTransferHistory==='function') recordTransferHistory(player,{fromClubId,toClubId:Number(club.id),amount:fee,kind:'bot_transfer',source:'bot_market_strategy',transactionKey:`bot-strategy-paid-${game?.seasonNumber || 1}-${player.id}-${club.id}-${game?.currentDate || ''}`});
  botMarketStrategyAddLog(state,{type:'paid',strategy:profile.id,playerId:Number(player.id),playerName:String(player.name || 'Jugador'),overall,fromClubId,toClubId:Number(club.id),amount:fee});
  return {type:'paid',strategy:profile.id,playerId:Number(player.id),fromClubId,clubId:Number(club.id),overall,amount:fee,sellerReceipt};
}
function botMarketStrategyRefreshTransferLists(clubs){
  const cfg=botMarketStrategiesConfig();
  if(cfg.transferListPerClub<=0) return 0;
  let listed=0;
  clubs.forEach(club=>{
    const analysis=botMarketStrategySquadAnalysis(club.id);
    if(analysis.size<=cfg.idealSquad) return;
    const candidates=analysis.squad.filter(player=>{
      if(player.intransferible || player.transferListed || player.retired || player.sold) return false;
      const group=botMarketStrategyGroup(player);
      const groupCount=analysis.needs[group]?.count || 0;
      const minimum={POR:2,DEF:6,MID:6,ATT:4}[group] || 4;
      if(groupCount<=minimum+1) return false;
      return botMarketStrategyOverall(player)<=analysis.overallAverage-2 || Number(player.age || 24)>=31;
    }).sort((a,b)=>botMarketStrategyOverall(a)-botMarketStrategyOverall(b) || Number(b.age || 0)-Number(a.age || 0));
    candidates.slice(0,cfg.transferListPerClub).forEach(player=>{ player.transferListed=true; listed+=1; });
  });
  return listed;
}
function botMarketStrategyReviewClubs(state,mode='paid'){
  const cfg=botMarketStrategiesConfig();
  const clubs=(seed?.clubs || []).filter(botMarketStrategyClubEligible).filter(club=>botMarketStrategyRosterSpace(club.id));
  const rows=clubs.map(club=>{
    const profile=botMarketStrategyForClub(club,state);
    const analysis=botMarketStrategySquadAnalysis(club.id);
    const signings=botMarketStrategyCombinedSignings(club.id);
    if(signings>=profile.maxSignings) return null;
    const need=Object.values(analysis.needs).reduce((sum,item)=>sum+Number(item.score || 0),0)+Math.max(0,cfg.idealSquad-analysis.size)*80;
    const strategyPriority=profile.id==='all_in'?260:profile.id==='bargain'?(mode==='free'?310:110):190;
    const rotation=typeof hashNumber==='function'?hashNumber(`bot-market-club-order-${game?.saveCode || ''}-${game?.currentDate || ''}-${club.id}-${mode}`,120):0;
    return {club,profile,analysis,score:need+strategyPriority+rotation};
  }).filter(Boolean).sort((a,b)=>b.score-a.score || Number(a.club.id)-Number(b.club.id));
  return rows.slice(0,cfg.clubsPerReview);
}
function processBotMarketStrategyFreeAgents(state){
  const cfg=botMarketStrategiesConfig();
  const today=String(game?.currentDate || '');
  if(state.lastFreeReviewDate && typeof daysBetweenIsoDates==='function' && daysBetweenIsoDates(state.lastFreeReviewDate,today)<cfg.freeReviewDays) return [];
  state.lastFreeReviewDate=today;
  const completed=[]; const usedPlayers=new Set();
  for(const row of botMarketStrategyReviewClubs(state,'free')){
    if(completed.length>=cfg.freePerReview) break;
    const candidates=botMarketStrategyFreeCandidates(row.club,row.profile,row.analysis).filter(item=>!usedPlayers.has(Number(item.player.id)));
    if(!candidates.length) continue;
    const signing=botMarketStrategySignFree(candidates[0].player,row.club,row.profile,state);
    if(signing){ completed.push(signing); usedPlayers.add(Number(signing.playerId)); }
  }
  return completed;
}
function processBotMarketStrategyPaidTransfers(state){
  const cfg=botMarketStrategiesConfig();
  if(typeof isTransferMarketOpen==='function' && !isTransferMarketOpen(game)) return {completed:[],listed:0};
  const today=String(game?.currentDate || '');
  if(state.lastPaidReviewDate && typeof daysBetweenIsoDates==='function' && daysBetweenIsoDates(state.lastPaidReviewDate,today)<cfg.paidReviewDays) return {completed:[],listed:0};
  state.lastPaidReviewDate=today;
  const allClubs=(seed?.clubs || []).filter(botMarketStrategyClubEligible);
  const listed=botMarketStrategyRefreshTransferLists(allClubs);
  const completed=[]; const usedPlayers=new Set(); const analysisByClub=new Map();
  for(const row of botMarketStrategyReviewClubs(state,'paid')){
    if(completed.length>=cfg.paidPerReview) break;
    const candidates=botMarketStrategyPaidCandidates(row.club,row.profile,row.analysis,analysisByClub).filter(item=>!usedPlayers.has(Number(item.player.id)));
    if(!candidates.length) continue;
    const transfer=botMarketStrategyCompleteTransfer(candidates[0],row.club,row.profile,state);
    if(transfer){ completed.push(transfer); usedPlayers.add(Number(transfer.playerId)); }
  }
  return {completed,listed};
}
function processBotMarketStrategiesDaily(options={}){
  const cfg=botMarketStrategiesConfig();
  if(!cfg.active || !game || !seed?.clubs?.length || !seed?.players?.length) return {active:false,free:[],paid:[],listed:0};
  const state=ensureBotMarketStrategiesState(game);
  const free=processBotMarketStrategyFreeAgents(state);
  const paidResult=processBotMarketStrategyPaidTransfers(state);
  if((free.length || paidResult.completed.length) && typeof ensurePlayerStateForAll==='function') ensurePlayerStateForAll();
  return {active:true,free,paid:paidResult.completed,listed:paidResult.listed,reason:String(options.reason || 'daily')};
}

window.botMarketStrategies={
  config:botMarketStrategiesConfig,
  ensureState:ensureBotMarketStrategiesState,
  profileForClub:botMarketStrategyForClub,
  policyForClub:botMarketStrategyPolicyForClub,
  combinedSignings:botMarketStrategyCombinedSignings,
  processDaily:processBotMarketStrategiesDaily
};
