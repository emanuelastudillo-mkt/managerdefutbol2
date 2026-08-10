/* V9.00 · Mercado bot de clubes de élite.
   Los clubes prestigiosos priorizan estrellas libres y el Top 10 del ranking FIFA
   intenta sostener al menos siete jugadores de media 85+, sin vaciar su caja. */

function eliteBotMarketConfig(){
  const source = window.GAME_CONFIG?.mercadoBotsElite || {};
  const number = (key, fallback) => Number.isFinite(Number(source[key])) ? Number(source[key]) : fallback;
  return {
    active:source.activo !== false,
    starOverall:Math.max(70, Math.min(99, Math.round(number('mediaEstrella', 85)))),
    highPrestige:Math.max(50, Math.min(99, Math.round(number('prestigioAltoMinimo', 80)))),
    topRankCount:Math.max(1, Math.round(number('cantidadClubesTopRanking', 10))),
    topTarget:Math.max(1, Math.round(number('objetivoEstrellasTop10', 7))),
    topMaximum:Math.max(1, Math.round(number('maximoEstrellasTop10', 9))),
    prestigeTarget:Math.max(1, Math.round(number('objetivoEstrellasPrestigioAlto', 4))),
    prestigeMaximum:Math.max(1, Math.round(number('maximoEstrellasPrestigioAlto', 6))),
    freeReviewDays:Math.max(1, Math.round(number('intervaloRevisionLibresDias', 3))),
    transferReviewDays:Math.max(1, Math.round(number('intervaloRevisionComprasDias', 10))),
    freePerReview:Math.max(1, Math.round(number('maximoLibresPorRevision', 3))),
    transfersPerReview:Math.max(1, Math.round(number('maximoComprasPorRevision', 2))),
    signingsPerClubSeason:Math.max(1, Math.round(number('maximoAltasPorClubTemporada', 6))),
    reserveCashRate:Math.max(0.10, Math.min(0.90, number('reservaCajaMinimaPct', 0.42))),
    payrollCoverage:Math.max(0.25, Math.min(3, number('coberturaMasaSalarialAnios', 0.80))),
    maxFreeSalaryCashRate:Math.max(0.01, Math.min(0.50, number('salarioMaximoLibreSobreCajaPct', 0.16))),
    maxTransferCashRateTop:Math.max(0.01, Math.min(0.60, number('gastoTraspasoMaximoCajaTop10Pct', 0.24))),
    transferClauseMin:Math.max(0.10, Math.min(1.20, number('ofertaMinimaClausulaPct', 0.62))),
    transferClauseMax:Math.max(0.10, Math.min(1.50, number('ofertaMaximaClausulaPct', 0.82))),
    sellerTaxRate:Math.max(0, Math.min(0.90, number('impuestoVentaBotPct', Number(window.GAME_CONFIG?.mercado?.impuestoAfaTraspasos ?? 0.30)))),
    maximumAge:Math.max(18, Math.min(45, Math.round(number('edadMaximaObjetivo', 34)))),
    logLimit:Math.max(20, Math.round(number('historialInternoMaximo', 120)))
  };
}
function normalizeEliteBotMarketState(value, state=game){
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const season = Math.max(1, Math.round(Number(state?.seasonNumber || 1)));
  const sourceSeason = Math.max(1, Math.round(Number(source.season || season)));
  const sameSeason = sourceSeason === season;
  const counts = sameSeason && source.clubSeasonSignings && typeof source.clubSeasonSignings === 'object' && !Array.isArray(source.clubSeasonSignings)
    ? Object.fromEntries(Object.entries(source.clubSeasonSignings).map(([key, val]) => [String(key), Math.max(0, Math.round(Number(val || 0)))])) : {};
  const log = (Array.isArray(source.log) ? source.log : []).map(item => ({
    season:Math.max(1, Math.round(Number(item?.season || season))),
    date:String(item?.date || ''), type:String(item?.type || ''),
    playerId:Number(item?.playerId || 0), playerName:String(item?.playerName || ''), overall:Math.max(1, Math.min(99, Math.round(Number(item?.overall || 1)))),
    fromClubId:Number(item?.fromClubId || 0), toClubId:Number(item?.toClubId || 0), amount:Math.max(0, Math.round(Number(item?.amount || 0))),
    rank:Math.max(0, Math.round(Number(item?.rank || 0)))
  })).filter(item => item.playerId && item.toClubId).slice(-eliteBotMarketConfig().logLimit);
  return {
    version:'V9.00', season,
    lastFreeReviewDate:sameSeason ? String(source.lastFreeReviewDate || '') : '',
    lastTransferReviewDate:sameSeason ? String(source.lastTransferReviewDate || '') : '',
    clubSeasonSignings:counts,
    log
  };
}
function ensureEliteBotMarketState(state=game){
  if(!state) return normalizeEliteBotMarketState({}, state);
  state.eliteBotMarket = normalizeEliteBotMarketState(state.eliteBotMarket || {}, state);
  return state.eliteBotMarket;
}
function eliteBotMarketOverall(player){
  const raw = typeof visibleOverall === 'function' ? visibleOverall(player) : Number(player?.overall || player?.media || 0);
  return Math.max(1, Math.min(99, Math.round(Number(raw || 1))));
}
function eliteBotMarketClubPrestige(club){
  const raw = typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : Number(club?.reputation || club?.prestigio || 0);
  return Math.max(1, Math.min(99, Math.round(Number(raw || 1))));
}
function eliteBotMarketClubCash(club){
  return Math.max(0, Math.round(Number(game?.clubBudgets?.[club?.id] ?? club?.budget ?? 0)));
}
function eliteBotMarketSquad(clubId){
  const list = typeof playersByClub === 'function' ? playersByClub(Number(clubId)) : (seed?.players || []).filter(player => Number(player?.clubId || 0) === Number(clubId));
  return list.filter(player => player && !player.retired && !player.sold && !player.freeAgent && !player.youthFreeAgent);
}
function eliteBotMarketStarCount(clubId){
  const threshold = eliteBotMarketConfig().starOverall;
  return eliteBotMarketSquad(clubId).filter(player => eliteBotMarketOverall(player) >= threshold).length;
}
function eliteBotMarketAnnualPayroll(clubId){
  if(typeof totalClubSalary === 'function') return Math.max(0, Math.round(Number(totalClubSalary(clubId) || 0)));
  return eliteBotMarketSquad(clubId).reduce((sum, player) => sum + Math.max(0, Number(player?.salary || 0)), 0);
}
function eliteBotMarketRankingRows(){
  let rows = [];
  if(typeof clubFifaRankingRows === 'function'){
    try{ rows = clubFifaRankingRows(); }catch(_error){ rows = []; }
  }
  if(!Array.isArray(rows) || !rows.length){
    rows = (seed?.clubs || []).filter(club => !(club?.specialCompetitionOnly || club?.competitionOnly)).sort((a,b) => eliteBotMarketClubPrestige(b) - eliteBotMarketClubPrestige(a) || Number(a.id)-Number(b.id)).map((club, index) => ({ club, clubId:Number(club.id), rank:index + 1, points:eliteBotMarketClubPrestige(club) * 10 }));
  }
  return rows;
}
function eliteBotMarketContext(){
  const rows = eliteBotMarketRankingRows();
  const rankByClub = new Map(rows.map(row => [Number(row.clubId || row.club?.id || 0), Math.max(1, Math.round(Number(row.rank || 999)))]));
  return { rows, rankByClub };
}
function eliteBotMarketClubPlan(club, context=eliteBotMarketContext()){
  if(!club) return null;
  const cfg = eliteBotMarketConfig();
  const clubId = Number(club.id || 0);
  if(!clubId || Number(game?.selectedClubId || 0) === clubId) return null;
  if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(club)) return null;
  if(club.specialCompetitionOnly || club.competitionOnly) return null;
  const rank = Number(context.rankByClub.get(clubId) || 999);
  const prestige = eliteBotMarketClubPrestige(club);
  if(rank <= cfg.topRankCount) return { tier:'top10', rank, prestige, target:cfg.topTarget, maximum:Math.max(cfg.topTarget, cfg.topMaximum) };
  if(prestige >= cfg.highPrestige) return { tier:'prestige', rank, prestige, target:cfg.prestigeTarget, maximum:Math.max(cfg.prestigeTarget, cfg.prestigeMaximum) };
  return null;
}
function eliteBotMarketClubSeasonSignings(clubId, state=ensureEliteBotMarketState()){
  return Math.max(0, Math.round(Number(state?.clubSeasonSignings?.[String(clubId)] || 0)));
}
function eliteBotMarketHasRosterSpace(clubId){
  if(typeof hasFirstTeamRosterSpace === 'function') return hasFirstTeamRosterSpace(clubId, 1);
  return eliteBotMarketSquad(clubId).length < Number(typeof MAX_PLAYERS_PER_CLUB !== 'undefined' ? MAX_PLAYERS_PER_CLUB : 40);
}
function eliteBotMarketFinancialCheck(club, player, fee, plan){
  const cfg = eliteBotMarketConfig();
  const strategy = typeof botMarketStrategyPolicyForClub === 'function' ? botMarketStrategyPolicyForClub(club) : null;
  const cash = eliteBotMarketClubCash(club);
  const safeFee = Math.max(0, Math.round(Number(fee || 0)));
  const salary = Math.max(0, Math.round(Number(player?.salary || 0)));
  const payrollAfter = eliteBotMarketAnnualPayroll(club.id) + salary;
  const cashAfter = cash - safeFee;
  if(cash <= 0 || cashAfter < 0) return { ok:false, cash, cashAfter, payrollAfter, reserve:0 };
  const reserveCashRate = Number.isFinite(Number(strategy?.reserveCashRate)) ? Number(strategy.reserveCashRate) : cfg.reserveCashRate;
  const payrollCoverage = Number.isFinite(Number(strategy?.payrollCoverage)) ? Number(strategy.payrollCoverage) : cfg.payrollCoverage;
  const reserve = Math.max(Math.round(cash * reserveCashRate), Math.round(payrollAfter * payrollCoverage));
  if(cashAfter < reserve) return { ok:false, cash, cashAfter, payrollAfter, reserve };
  const freeSalaryRate = strategy?.id === 'bargain' ? 0.10 : (strategy?.id === 'all_in' ? 0.24 : cfg.maxFreeSalaryCashRate);
  if(safeFee === 0 && salary > Math.round(cash * freeSalaryRate)) return { ok:false, cash, cashAfter, payrollAfter, reserve };
  if(safeFee > 0){
    const fallbackRate = plan?.tier === 'top10' ? cfg.maxTransferCashRateTop : cfg.maxTransferCashRateTop * 0.70;
    const feeRate = Number.isFinite(Number(strategy?.maxFeeCashRate)) ? Number(strategy.maxFeeCashRate) : fallbackRate;
    if(safeFee > Math.round(cash * feeRate)) return { ok:false, cash, cashAfter, payrollAfter, reserve };
  }
  return { ok:true, cash, cashAfter, payrollAfter, reserve };
}
function eliteBotMarketPlayerPool(){
  const map = new Map();
  (seed?.players || []).forEach(player => { if(player?.id) map.set(Number(player.id), player); });
  (game?.marketPlayers || []).forEach(player => { if(player?.id && !map.has(Number(player.id))) map.set(Number(player.id), player); });
  return Array.from(map.values());
}
function eliteBotMarketFreeStars(){
  const cfg = eliteBotMarketConfig();
  return eliteBotMarketPlayerPool().filter(player => {
    if(!player || player.retired || player.sold) return false;
    const free = Number(player.clubId || 0) === 0 || Boolean(player.freeAgent) || Boolean(player.youthFreeAgent);
    return free && eliteBotMarketOverall(player) >= cfg.starOverall && Number(player.age || 24) <= cfg.maximumAge;
  }).sort((a,b) => eliteBotMarketOverall(b)-eliteBotMarketOverall(a) || Number(a.age || 99)-Number(b.age || 99) || Number(a.id)-Number(b.id));
}
function eliteBotMarketRoleNeedScore(clubId, player){
  if(typeof playerRoleGroup !== 'function') return 0;
  const group = playerRoleGroup(player?.position);
  const counts = typeof rosterGroupCounts === 'function' ? rosterGroupCounts(eliteBotMarketSquad(clubId)) : {};
  const targets = { POR:3, DEF:8, MID:8, ATT:6 };
  return Math.max(0, Number(targets[group] || 0) - Number(counts[group] || 0)) * 9;
}
function eliteBotMarketCandidateClubsForFree(player, context, state){
  const cfg = eliteBotMarketConfig();
  return (seed?.clubs || []).map(club => {
    const plan = eliteBotMarketClubPlan(club, context);
    if(!plan || !eliteBotMarketHasRosterSpace(club.id)) return null;
    const currentStars = eliteBotMarketStarCount(club.id);
    if(currentStars >= plan.maximum) return null;
    const strategy = typeof botMarketStrategyPolicyForClub === 'function' ? botMarketStrategyPolicyForClub(club) : null;
    const signingLimit = Math.min(cfg.signingsPerClubSeason, Math.max(1, Math.round(Number(strategy?.maxSignings || cfg.signingsPerClubSeason))));
    if((typeof botMarketStrategyCombinedSignings === 'function' ? botMarketStrategyCombinedSignings(club.id) : eliteBotMarketClubSeasonSignings(club.id, state)) >= signingLimit) return null;
    const finance = eliteBotMarketFinancialCheck(club, player, 0, plan);
    if(!finance.ok) return null;
    const deficit = Math.max(0, plan.target - currentStars);
    const topPriority = plan.tier === 'top10'
      ? (deficit > 0 ? 10000 + deficit * 1200 + Math.max(0, cfg.topRankCount + 1 - plan.rank) * 80 : 1450 + Math.max(0, cfg.topRankCount + 1 - plan.rank) * 30)
      : 1000 + deficit * 260;
    const score = topPriority + plan.prestige * 12 + eliteBotMarketRoleNeedScore(club.id, player) + Math.round((finance.cashAfter - finance.reserve) / 1000000) + (typeof hashNumber === 'function' ? hashNumber(`elite-free-${game?.saveCode || ''}-${game?.currentDate || ''}-${player.id}-${club.id}`, 30) : 0);
    return { club, plan, currentStars, finance, score };
  }).filter(Boolean).sort((a,b) => b.score-a.score || Number(a.plan.rank)-Number(b.plan.rank) || Number(a.club.id)-Number(b.club.id));
}
function eliteBotMarketSyncPlayer(player){
  if(!player) return;
  if(!(seed?.players || []).some(item => Number(item.id) === Number(player.id))){
    seed.players = Array.isArray(seed?.players) ? seed.players : [];
    seed.players.push(player);
  }
  if(typeof invalidatePlayerIndexes === 'function') invalidatePlayerIndexes();
  if(Array.isArray(game?.marketPlayers)){
    const index = game.marketPlayers.findIndex(item => Number(item.id) === Number(player.id));
    if(index >= 0) game.marketPlayers[index] = { ...game.marketPlayers[index], ...player };
  }
}
function eliteBotMarketSetContract(player, clubId, salt=''){
  const season = Math.max(1, Math.round(Number(game?.seasonNumber || 1)));
  const extra = 2 + (typeof hashNumber === 'function' ? hashNumber(`elite-contract-${game?.saveCode || ''}-${season}-${player?.id || 0}-${clubId}-${salt}`, 3) : 1);
  player.contractStartSeason = season;
  player.contractEndSeason = season + extra;
  player.contractSignedDate = String(game?.currentDate || '');
  player.contractSource = 'elite_bot_market';
  player.contractRenewalAttempts = 0;
  player.contractRejectedUntil = '';
  player.contractNextDemandFactor = 1;
}
function eliteBotMarketFinalizePlayerMove(player, toClubId, salt=''){
  if(typeof setPlayerClubId === 'function') setPlayerClubId(player, Number(toClubId)); else player.clubId = Number(toClubId);
  player.freeAgent = false; player.youthFreeAgent = false; player.sold = false; player.transferListed = false; player.intransferible = false;
  player.salaryPaidCount = 0; player.lastSalaryPaidSeason = 0;
  eliteBotMarketSetContract(player, toClubId, salt);
  if(typeof refreshPlayerClause === 'function') refreshPlayerClause(player);
  eliteBotMarketSyncPlayer(player);
  if(game?.playerStats?.[player.id]) game.playerStats[player.id].clubId = Number(toClubId);
  if(game?.playerCareerStats?.[player.id]) game.playerCareerStats[player.id].clubId = Number(toClubId);
  game.playerCondition = game.playerCondition && typeof game.playerCondition === 'object' ? game.playerCondition : {};
  game.playerMorale = game.playerMorale && typeof game.playerMorale === 'object' ? game.playerMorale : {};
  if(!Number.isFinite(Number(game.playerCondition[player.id])) || Number(game.playerCondition[player.id]) < 20) game.playerCondition[player.id] = 28 + (typeof hashNumber === 'function' ? hashNumber(`elite-condition-${player.id}-${toClubId}`, 18) : 8);
  if(!Number.isFinite(Number(game.playerMorale[player.id])) || Number(game.playerMorale[player.id]) < 35) game.playerMorale[player.id] = 55 + (typeof hashNumber === 'function' ? hashNumber(`elite-morale-${player.id}-${toClubId}`, 21) : 10);
  if(typeof syncPlayerStarsWithClubs === 'function') syncPlayerStarsWithClubs(game);
}
function eliteBotMarketAddLog(state, item){
  state.log = Array.isArray(state.log) ? state.log : [];
  state.log.push({ season:Number(game?.seasonNumber || 1), date:String(game?.currentDate || ''), ...item });
  state.log = state.log.slice(-eliteBotMarketConfig().logLimit);
  const clubKey = String(item.toClubId || 0);
  state.clubSeasonSignings[clubKey] = eliteBotMarketClubSeasonSignings(item.toClubId, state) + 1;
}
function eliteBotMarketSignFreePlayer(player, candidate, state){
  const fromClubId = Number(player?.clubId || 0);
  eliteBotMarketFinalizePlayerMove(player, candidate.club.id, 'free');
  const overall = eliteBotMarketOverall(player);
  if(typeof recordTransferHistory === 'function') recordTransferHistory(player, { fromClubId:0, toClubId:Number(candidate.club.id), amount:0, kind:'bot_free_signing', source:'elite_bot_market', transactionKey:`elite-free-${game?.seasonNumber || 1}-${player.id}-${candidate.club.id}` });
  eliteBotMarketAddLog(state, { type:'free', playerId:Number(player.id), playerName:String(player.name || 'Jugador'), overall, fromClubId, toClubId:Number(candidate.club.id), amount:0, rank:Number(candidate.plan.rank || 0) });
  return { playerId:Number(player.id), clubId:Number(candidate.club.id), overall, type:'free' };
}
function processEliteBotFreeAgents(context, state){
  const cfg = eliteBotMarketConfig();
  const today = String(game?.currentDate || '');
  if(state.lastFreeReviewDate && typeof daysBetweenIsoDates === 'function' && daysBetweenIsoDates(state.lastFreeReviewDate, today) < cfg.freeReviewDays) return [];
  state.lastFreeReviewDate = today;
  const signed = [];
  for(const player of eliteBotMarketFreeStars()){
    if(signed.length >= cfg.freePerReview) break;
    const candidates = eliteBotMarketCandidateClubsForFree(player, context, state);
    if(!candidates.length) continue;
    signed.push(eliteBotMarketSignFreePlayer(player, candidates[0], state));
  }
  return signed;
}
function eliteBotMarketHasPortfolioRight(playerId){
  if(typeof managerPortfolioRights !== 'function') return false;
  try{ return managerPortfolioRights('active').some(right => Number(right?.playerId || 0) === Number(playerId)); }catch(_error){ return false; }
}
function eliteBotMarketTransferFee(player, buyerClubId){
  const cfg = eliteBotMarketConfig();
  const buyer = (seed?.clubs || []).find(club => Number(club.id) === Number(buyerClubId));
  const strategy = typeof botMarketStrategyPolicyForClub === 'function' ? botMarketStrategyPolicyForClub(buyer) : null;
  const minimumRate = Number.isFinite(Number(strategy?.minimumOfferRate)) ? Math.max(cfg.transferClauseMin, Number(strategy.minimumOfferRate)) : cfg.transferClauseMin;
  const maximumRate = Number.isFinite(Number(strategy?.maximumOfferRate)) ? Math.max(minimumRate, Number(strategy.maximumOfferRate)) : cfg.transferClauseMax;
  const clause = Math.max(1, Math.round(Number(typeof playerClauseFor === 'function' ? playerClauseFor(player) : player?.clause || player?.value || Number(player?.salary || 0) * 16 || 1)));
  const span = Math.max(0, maximumRate - minimumRate);
  const roll = typeof hashNumber === 'function' ? hashNumber(`elite-fee-${game?.saveCode || ''}-${game?.seasonNumber || 1}-${game?.currentDate || ''}-${player?.id || 0}-${buyerClubId}`, 1001) / 1000 : 0.5;
  const ageFactor = Number(player?.age || 24) >= 32 ? 0.86 : Number(player?.age || 24) <= 23 ? 1.05 : 1;
  return Math.max(1, Math.round(clause * (minimumRate + span * roll) * ageFactor / 100000) * 100000);
}
function eliteBotMarketSellerAllows(player, sellerClub, context){
  if(!sellerClub || Number(sellerClub.id) === Number(game?.selectedClubId || 0)) return false;
  if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(sellerClub)) return false;
  if(typeof hasFirstTeamRosterMinimumAfterRemoval === 'function' && !hasFirstTeamRosterMinimumAfterRemoval(sellerClub.id, 1)) return false;
  if(eliteBotMarketHasPortfolioRight(player.id)) return false;
  if(typeof hasPendingTransferOfferForPlayer === 'function' && hasPendingTransferOfferForPlayer(player.id)) return false;
  const sellerStars = eliteBotMarketStarCount(sellerClub.id);
  const sellerPlan = eliteBotMarketClubPlan(sellerClub, context);
  if(sellerPlan?.tier === 'top10' && sellerStars <= sellerPlan.target) return false;
  if(eliteBotMarketClubPrestige(sellerClub) >= eliteBotMarketConfig().highPrestige && sellerStars <= 2) return false;
  return true;
}
function eliteBotMarketPaidCandidates(buyer, plan, context){
  const cfg = eliteBotMarketConfig();
  const buyerClubId = Number(buyer.id);
  const buyerCountry = typeof clubCountry === 'function' ? String(clubCountry(buyer) || '') : '';
  return eliteBotMarketPlayerPool().map(player => {
    const sellerId = Number(player?.clubId || 0);
    if(!player || player.retired || player.sold || player.freeAgent || player.youthFreeAgent || sellerId <= 0 || sellerId === buyerClubId || sellerId === Number(game?.selectedClubId || 0)) return null;
    if(eliteBotMarketOverall(player) < cfg.starOverall || Number(player.age || 24) > cfg.maximumAge) return null;
    const seller = (seed?.clubs || []).find(club => Number(club.id) === sellerId);
    if(!eliteBotMarketSellerAllows(player, seller, context)) return null;
    const fee = eliteBotMarketTransferFee(player, buyerClubId);
    const finance = eliteBotMarketFinancialCheck(buyer, player, fee, plan);
    if(!finance.ok) return null;
    const sellerCountry = typeof clubCountry === 'function' ? String(clubCountry(seller) || '') : '';
    const countryBonus = buyerCountry && buyerCountry === sellerCountry ? 24 : 0;
    const ageBonus = Math.max(0, 31 - Number(player.age || 31)) * 3;
    const score = eliteBotMarketOverall(player) * 65 + ageBonus + countryBonus + eliteBotMarketRoleNeedScore(buyerClubId, player) - Math.round(fee / 10000000) + (typeof hashNumber === 'function' ? hashNumber(`elite-paid-score-${game?.currentDate || ''}-${player.id}-${buyerClubId}`, 40) : 0);
    return { player, seller, fee, finance, score };
  }).filter(Boolean).sort((a,b) => b.score-a.score || eliteBotMarketOverall(b.player)-eliteBotMarketOverall(a.player) || Number(a.player.id)-Number(b.player.id));
}
function eliteBotMarketCompletePaidTransfer(item, buyer, plan, state){
  const player = item.player;
  const seller = item.seller;
  const fee = Math.max(1, Math.round(Number(item.fee || 1)));
  game.clubBudgets = game.clubBudgets && typeof game.clubBudgets === 'object' && !Array.isArray(game.clubBudgets) ? game.clubBudgets : {};
  const buyerCash = eliteBotMarketClubCash(buyer);
  const sellerCash = eliteBotMarketClubCash(seller);
  if(buyerCash < fee) return null;
  const sellerReceipt = Math.max(0, Math.round(fee * (1 - eliteBotMarketConfig().sellerTaxRate)));
  game.clubBudgets[buyer.id] = buyerCash - fee;
  game.clubBudgets[seller.id] = sellerCash + sellerReceipt;
  const fromClubId = Number(seller.id);
  if(typeof resetPlayerCaptaincyProgress === 'function') resetPlayerCaptaincyProgress(player.id, fromClubId);
  eliteBotMarketFinalizePlayerMove(player, buyer.id, 'paid');
  const overall = eliteBotMarketOverall(player);
  if(typeof recordTransferHistory === 'function') recordTransferHistory(player, { fromClubId, toClubId:Number(buyer.id), amount:fee, kind:'bot_transfer', source:'elite_bot_market', transactionKey:`elite-paid-${game?.seasonNumber || 1}-${player.id}-${buyer.id}-${game?.currentDate || ''}` });
  eliteBotMarketAddLog(state, { type:'paid', playerId:Number(player.id), playerName:String(player.name || 'Jugador'), overall, fromClubId, toClubId:Number(buyer.id), amount:fee, rank:Number(plan.rank || 0) });
  return { playerId:Number(player.id), fromClubId, clubId:Number(buyer.id), overall, amount:fee, sellerReceipt, type:'paid' };
}
function processEliteBotTopTenTransfers(context, state){
  const cfg = eliteBotMarketConfig();
  if(typeof isTransferMarketOpen === 'function' && !isTransferMarketOpen(game)) return [];
  const today = String(game?.currentDate || '');
  if(state.lastTransferReviewDate && typeof daysBetweenIsoDates === 'function' && daysBetweenIsoDates(state.lastTransferReviewDate, today) < cfg.transferReviewDays) return [];
  state.lastTransferReviewDate = today;
  const buyers = (seed?.clubs || []).map(club => {
    const plan = eliteBotMarketClubPlan(club, context);
    if(!plan || plan.tier !== 'top10') return null;
    const strategy = typeof botMarketStrategyPolicyForClub === 'function' ? botMarketStrategyPolicyForClub(club) : null;
    if(strategy?.id === 'bargain') return null;
    const stars = eliteBotMarketStarCount(club.id);
    if(stars >= plan.target || !eliteBotMarketHasRosterSpace(club.id)) return null;
    const signingLimit = Math.min(cfg.signingsPerClubSeason, Math.max(1, Math.round(Number(strategy?.maxSignings || cfg.signingsPerClubSeason))));
    if((typeof botMarketStrategyCombinedSignings === 'function' ? botMarketStrategyCombinedSignings(club.id) : eliteBotMarketClubSeasonSignings(club.id, state)) >= signingLimit) return null;
    return { club, plan, stars, deficit:plan.target-stars };
  }).filter(Boolean).sort((a,b) => b.deficit-a.deficit || Number(a.plan.rank)-Number(b.plan.rank));
  const completed = [];
  for(const buyer of buyers){
    if(completed.length >= cfg.transfersPerReview) break;
    const candidates = eliteBotMarketPaidCandidates(buyer.club, buyer.plan, context);
    if(!candidates.length) continue;
    const transfer = eliteBotMarketCompletePaidTransfer(candidates[0], buyer.club, buyer.plan, state);
    if(transfer) completed.push(transfer);
  }
  return completed;
}
function processEliteBotMarketDaily(options={}){
  const cfg = eliteBotMarketConfig();
  if(!cfg.active || !game || !seed?.clubs?.length || !seed?.players?.length) return { active:false, free:[], paid:[] };
  const state = ensureEliteBotMarketState(game);
  const context = eliteBotMarketContext();
  const free = processEliteBotFreeAgents(context, state);
  const paid = processEliteBotTopTenTransfers(context, state);
  if((free.length || paid.length) && typeof ensurePlayerStateForAll === 'function') ensurePlayerStateForAll();
  return { active:true, free, paid, topCount:cfg.topRankCount, target:cfg.topTarget, reason:String(options.reason || 'daily') };
}

window.eliteBotMarket = {
  config:eliteBotMarketConfig,
  ensureState:ensureEliteBotMarketState,
  rankingRows:eliteBotMarketRankingRows,
  starCount:eliteBotMarketStarCount,
  clubPlan:eliteBotMarketClubPlan,
  financialCheck:eliteBotMarketFinancialCheck,
  processDaily:processEliteBotMarketDaily
};
