/* V8.08 · Derechos económicos, cartera clickeable y nombres normalizados. */

function managerPortfolioConfigNumber(path, fallback, min=-Infinity, max=Infinity){
  if(typeof configNumber === 'function') return configNumber(`academia.derechosEconomicos.${path}`, fallback, min, max);
  return clamp(Number(fallback || 0), min, max);
}
function managerPortfolioConfigBoolean(path, fallback=true){
  if(typeof configBoolean === 'function') return configBoolean(`academia.derechosEconomicos.${path}`, fallback);
  return Boolean(fallback);
}
function managerPortfolioDefaultState(){
  return {
    version:1,
    rights:[],
    history:[],
    totalIncome:0,
    lastBotSaleCheckDate:'',
    lastSyncDate:''
  };
}
function normalizeManagerPlayerRight(raw, state=game){
  if(!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const statusOptions = ['active','paid','closed_free_agent','closed_retired','closed_missing','closed_untracked_transfer'];
  const playerId = Math.max(0, Math.round(Number(raw.playerId || 0)));
  const originClubId = Math.max(0, Math.round(Number(raw.originClubId || raw.clubId || 0)));
  const percent = clamp(Math.round(Number(raw.percent || raw.futureSalePercent || 0)), 0, 100);
  if(!playerId || !originClubId || !percent) return null;
  const player = typeof playerById === 'function' ? playerById(playerId) : null;
  const currentClubId = Math.round(Number(raw.currentClubId ?? player?.clubId ?? originClubId));
  const status = statusOptions.includes(String(raw.status || '')) ? String(raw.status) : 'active';
  return {
    ...raw,
    id:String(raw.id || `manager-player-right-${playerId}-${originClubId}-${raw.contractId || 'contract'}`),
    playerId,
    playerName:String(raw.playerName || player?.name || `Jugador ${playerId}`),
    position:String(raw.position || player?.position || ''),
    nationality:String(raw.nationality || player?.nationality || ''),
    ageAtPromotion:Math.max(0, Math.round(Number(raw.ageAtPromotion ?? player?.age ?? 0))),
    originClubId,
    originClubName:String(raw.originClubName || (typeof clubName === 'function' ? clubName(originClubId) : '')),
    originDivisionId:String(raw.originDivisionId || seed?.clubs?.find(item => Number(item.id) === originClubId)?.divisionId || ''),
    originDivisionName:String(raw.originDivisionName || (typeof clubDivision === 'function' ? clubDivision(originClubId)?.name : '') || ''),
    currentClubId,
    contractId:String(raw.contractId || ''),
    contractStartSeason:Math.max(1, Math.round(Number(raw.contractStartSeason || state?.seasonNumber || 1))),
    percent,
    promotedSeason:Math.max(1, Math.round(Number(raw.promotedSeason || state?.seasonNumber || 1))),
    promotedDate:validIsoDate(raw.promotedDate) ? raw.promotedDate : (validIsoDate(state?.currentDate) ? state.currentDate : ''),
    promotedTurn:Math.max(0, Math.round(Number(raw.promotedTurn || 0))),
    clauseAtPromotion:Math.max(0, Math.round(Number(raw.clauseAtPromotion || player?.clause || player?.value || 0))),
    status,
    paidDate:validIsoDate(raw.paidDate) ? raw.paidDate : '',
    paidSeason:Math.max(0, Math.round(Number(raw.paidSeason || 0))),
    buyerClubId:Math.round(Number(raw.buyerClubId || 0)),
    grossTransferAmount:Math.max(0, Math.round(Number(raw.grossTransferAmount || 0))),
    transferTaxAmount:Math.max(0, Math.round(Number(raw.transferTaxAmount || 0))),
    transferNetAmount:Math.max(0, Math.round(Number(raw.transferNetAmount || 0))),
    managerIncome:Math.max(0, Math.round(Number(raw.managerIncome || 0))),
    closureReason:String(raw.closureReason || '')
  };
}
function ensureManagerPlayerPortfolio(state=game){
  if(!state) return null;
  const src = state.managerPlayerPortfolio && typeof state.managerPlayerPortfolio === 'object' && !Array.isArray(state.managerPlayerPortfolio)
    ? state.managerPlayerPortfolio
    : managerPortfolioDefaultState();
  const rights = Array.isArray(src.rights) ? src.rights.map(item => normalizeManagerPlayerRight(item, state)).filter(Boolean) : [];
  const unique = [];
  const seen = new Set();
  rights.forEach(item => {
    const key = String(item.id || `${item.playerId}-${item.originClubId}-${item.contractId}`);
    if(seen.has(key)) return;
    seen.add(key);
    unique.push(item);
  });
  src.version = 1;
  src.rights = unique.slice(-500);
  src.history = Array.isArray(src.history) ? src.history.slice(-500) : [];
  src.totalIncome = Math.max(0, Math.round(Number(src.totalIncome || unique.reduce((sum,item)=>sum+Number(item.managerIncome || 0),0))));
  src.lastBotSaleCheckDate = validIsoDate(src.lastBotSaleCheckDate) ? src.lastBotSaleCheckDate : '';
  src.lastSyncDate = validIsoDate(src.lastSyncDate) ? src.lastSyncDate : '';
  state.managerPlayerPortfolio = src;
  return src;
}
function managerPortfolioRights(status=''){
  const portfolio = ensureManagerPlayerPortfolio(game);
  const list = portfolio?.rights || [];
  return status ? list.filter(item => item.status === status) : list.slice();
}
function managerPortfolioActiveRight(playerId, sellerClubId=0){
  return managerPortfolioRights('active').find(item => Number(item.playerId) === Number(playerId) && (!sellerClubId || Number(item.originClubId) === Number(sellerClubId))) || null;
}
function managerPortfolioCurrentPlayer(right){
  return right && typeof playerById === 'function' ? playerById(right.playerId) : null;
}
function managerPortfolioCurrentClause(right){
  const player = managerPortfolioCurrentPlayer(right);
  if(player && Number(player.clubId || 0) > 0 && typeof refreshPlayerClause === 'function') return Math.max(0, Math.round(Number(refreshPlayerClause(player) || 0)));
  return Math.max(0, Math.round(Number(right?.clauseAtPromotion || 0)));
}
function managerPortfolioEstimatedIncome(right){
  if(!right || right.status !== 'active') return 0;
  const clause = managerPortfolioCurrentClause(right);
  const taxRate = clamp(Number(typeof TRANSFER_AFA_TAX_RATE !== 'undefined' ? TRANSFER_AFA_TAX_RATE : 0.30), 0, 0.95);
  return Math.max(0, Math.round((clause * (1 - taxRate)) * (Number(right.percent || 0) / 100)));
}
function managerPortfolioRegisterPromotion(player, academyPlayer=null){
  if(!managerPortfolioConfigBoolean('activo', true) || !game || !player) return null;
  const contract = typeof normalizeManagerJobContract === 'function' ? normalizeManagerJobContract(game.managerJobContract, game) : game.managerJobContract;
  if(!contract || String(contract.status || 'active') !== 'active') return null;
  const clubId = Number(player.clubId || game.selectedClubId || 0);
  if(!clubId || Number(contract.clubId || 0) !== clubId) return null;
  const percent = clamp(Math.round(Number(contract.futureSalePercent || 0)), 5, typeof managerContractFutureSaleMaximum === 'function' ? managerContractFutureSaleMaximum() : 25);
  const portfolio = ensureManagerPlayerPortfolio(game);
  const contractId = String(contract.id || contract.offerId || `contract-${clubId}-${game.seasonNumber || 1}`);
  const id = `manager-player-right-${player.id}-${clubId}-${contractId}`;
  const existing = portfolio.rights.find(item => String(item.id) === id || (Number(item.playerId) === Number(player.id) && item.status === 'active'));
  if(existing) return existing;
  const right = normalizeManagerPlayerRight({
    id,
    playerId:player.id,
    playerName:player.name,
    position:player.position,
    nationality:player.nationality,
    ageAtPromotion:player.age,
    originClubId:clubId,
    originClubName:typeof clubName === 'function' ? clubName(clubId) : '',
    originDivisionId:seed?.clubs?.find(item => Number(item.id) === clubId)?.divisionId || '',
    originDivisionName:typeof clubDivision === 'function' ? clubDivision(clubId)?.name : '',
    currentClubId:clubId,
    contractId,
    contractStartSeason:contract.startSeason || game.seasonNumber || 1,
    percent,
    promotedSeason:game.seasonNumber || 1,
    promotedDate:game.currentDate || '',
    promotedTurn:typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0,
    clauseAtPromotion:typeof refreshPlayerClause === 'function' ? refreshPlayerClause(player) : Number(player.clause || player.value || 0),
    status:'active',
    academyPlayerId:academyPlayer?.id || player.id,
    academyExceptional:Boolean(academyPlayer?.exceptional)
  }, game);
  portfolio.rights.push(right);
  portfolio.rights = portfolio.rights.slice(-500);
  player.academyManagerOrigin = true;
  player.managerEconomicRightId = right.id;
  player.managerEconomicRightPercent = percent;
  if(typeof pushGameMessage === 'function') pushGameMessage({
    type:'academia',
    priority:'normal',
    title:'Derecho económico registrado',
    body:`Conservás ${percent}% sobre la primera transferencia pagada de ${player.name} desde ${clubName(clubId)}, después de impuestos de traspaso.`,
    id:`manager-player-right-created-${right.id}`
  });
  return right;
}
function managerPortfolioSettleRight(right, details={}){
  if(!right) return null;
  const rightId = String(right.id || '');
  const portfolio = ensureManagerPlayerPortfolio(game);
  right = portfolio?.rights?.find(item => String(item.id) === rightId) || portfolio?.rights?.find(item => Number(item.playerId) === Number(right.playerId) && Number(item.originClubId) === Number(right.originClubId) && item.status === 'active') || null;
  if(!right || right.status !== 'active') return null;
  const grossAmount = Math.max(0, Math.round(Number(details.grossAmount || 0)));
  if(grossAmount <= 0) return null;
  const taxRate = clamp(Number(details.taxRate ?? (typeof TRANSFER_AFA_TAX_RATE !== 'undefined' ? TRANSFER_AFA_TAX_RATE : 0.30)), 0, 0.95);
  const taxAmount = Math.max(0, Math.round(Number(details.taxAmount ?? grossAmount * taxRate)));
  const transferNetAmount = Math.max(0, Math.round(Number(details.transferNetAmount ?? grossAmount - taxAmount)));
  const managerIncome = Math.max(0, Math.round(transferNetAmount * (Number(right.percent || 0) / 100)));
  const today = validIsoDate(game?.currentDate) ? game.currentDate : '';
  right.status = 'paid';
  right.paidDate = today;
  right.paidSeason = Number(game?.seasonNumber || 1);
  right.buyerClubId = Math.round(Number(details.buyerClubId || 0));
  right.currentClubId = right.buyerClubId;
  right.grossTransferAmount = grossAmount;
  right.transferTaxAmount = taxAmount;
  right.transferNetAmount = transferNetAmount;
  right.managerIncome = managerIncome;
  right.closureReason = 'first_paid_transfer';
  const historyItem = {
    id:`manager-right-payment-${right.id}-${today || Date.now()}`,
    rightId:right.id,
    playerId:right.playerId,
    playerName:right.playerName,
    sellerClubId:right.originClubId,
    buyerClubId:right.buyerClubId,
    percent:right.percent,
    grossAmount,
    taxAmount,
    transferNetAmount,
    managerIncome,
    date:today,
    season:Number(game?.seasonNumber || 1),
    source:String(details.source || 'transfer')
  };
  portfolio.history.push(historyItem);
  portfolio.history = portfolio.history.slice(-500);
  portfolio.totalIncome = Math.max(0, Math.round(Number(portfolio.totalIncome || 0) + managerIncome));
  if(managerIncome > 0 && typeof recordManagerFinanceChange === 'function'){
    recordManagerFinanceChange(managerIncome, `Derecho económico: ${right.playerName}`, {
      type:'academy_future_sale_right', academyIncome:true, playerId:right.playerId, rightId:right.id,
      sellerClubId:right.originClubId, buyerClubId:right.buyerClubId, grossAmount, transferTax:taxAmount,
      transferNetAmount, percent:right.percent
    });
  }
  if(managerIncome > 0 && typeof recordAcademyCareerProgress === 'function') recordAcademyCareerProgress({ futureSaleBenefits:managerIncome });
  if(typeof pushGameMessage === 'function') pushGameMessage({
    type:'academia',
    priority:'high',
    title:'Cobro por jugador formado',
    body:`${right.playerName} fue transferido por ${formatMoney(grossAmount)}. Tras ${formatMoney(taxAmount)} de impuestos, tu ${right.percent}% generó ${formatMoney(managerIncome)} para la Cuenta Bancaria.`,
    id:`manager-right-paid-${right.id}`
  });
  return { right, grossAmount, taxAmount, transferNetAmount, managerIncome, sellerReceipt:Math.max(0, transferNetAmount-managerIncome) };
}
function managerPortfolioCloseRight(right, status, reason){
  if(!right || right.status !== 'active') return false;
  right.status = status;
  right.closureReason = String(reason || status);
  right.paidDate = validIsoDate(game?.currentDate) ? game.currentDate : '';
  right.paidSeason = Number(game?.seasonNumber || 1);
  return true;
}
function managerPortfolioSyncRights(options={}){
  const portfolio = ensureManagerPlayerPortfolio(game);
  if(!portfolio) return { updated:0, closed:0 };
  let updated = 0, closed = 0;
  portfolio.rights.forEach(right => {
    if(right.status !== 'active') return;
    const player = managerPortfolioCurrentPlayer(right);
    if(!player){
      if(options.closeMissing === true && managerPortfolioCloseRight(right, 'closed_missing', 'player_missing')) closed += 1;
      return;
    }
    right.playerName = String(player.name || right.playerName);
    right.position = String(player.position || right.position);
    right.currentClubId = Math.round(Number(player.clubId || 0));
    updated += 1;
    if(player.retired){ if(managerPortfolioCloseRight(right, 'closed_retired', 'player_retired')) closed += 1; return; }
    if(player.freeAgent || Number(player.clubId || 0) <= 0){ if(managerPortfolioCloseRight(right, 'closed_free_agent', 'left_as_free_agent')) closed += 1; return; }
    if(Number(player.clubId) !== Number(right.originClubId)){
      if(managerPortfolioCloseRight(right, 'closed_untracked_transfer', 'transfer_without_amount')) closed += 1;
    }
  });
  portfolio.lastSyncDate = validIsoDate(game?.currentDate) ? game.currentDate : portfolio.lastSyncDate;
  return { updated, closed };
}
function managerPortfolioRoleGroup(player){
  const group = typeof playerRoleGroup === 'function' ? playerRoleGroup(player?.position) : 'MID';
  return group === 'POR' ? 'POR' : group === 'DEF' ? 'DEF' : group === 'ATT' ? 'DEL' : 'MED';
}
function managerPortfolioBotBuyerCandidates(player, sellerClubId, grossAmount){
  const overall = clamp(Math.round(Number(typeof effectiveOverall === 'function' ? effectiveOverall(player) : player?.overall || 1)), 1, 99);
  const group = managerPortfolioRoleGroup(player);
  return (seed?.clubs || []).map(club => {
    if(Number(club.id) === Number(sellerClubId) || Number(club.id) === Number(game?.selectedClubId || 0)) return null;
    if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(club)) return null;
    if(typeof hasFirstTeamRosterSpace === 'function' && !hasFirstTeamRosterSpace(club.id, 1)) return null;
    const budget = Math.max(0, Math.round(Number(game?.clubBudgets?.[club.id] ?? club.budget ?? 0)));
    if(budget < grossAmount) return null;
    const need = typeof academyYouthBotNeedForGroup === 'function' ? academyYouthBotNeedForGroup(club, group) : 1;
    if(need <= 0) return null;
    const reputation = typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : 50;
    const minimum = clamp(Math.round(12 + reputation * 0.36), 12, 48);
    if(overall < minimum) return null;
    const sellerCountry = typeof clubCountry === 'function' ? clubCountry(seed?.clubs?.find(item=>Number(item.id)===Number(sellerClubId))) : '';
    const countryBonus = typeof clubCountry === 'function' && clubCountry(club) === sellerCountry ? 12 : 0;
    const fit = 100 - Math.abs((15 + reputation * 0.48) - overall);
    const score = need * 20 + fit + countryBonus + hashNumber(`portfolio-buyer-${game?.saveCode || ''}-${game?.currentDate || ''}-${player.id}-${club.id}`, 25);
    return { club, budget, need, score };
  }).filter(Boolean).sort((a,b)=>b.score-a.score || Number(a.club.id)-Number(b.club.id));
}
function managerPortfolioBotSaleAmount(player, right, today){
  const clause = Math.max(1, managerPortfolioCurrentClause(right));
  const minPct = clamp(Math.round(managerPortfolioConfigNumber('ofertaBotMinPctClausula', 60, 10, 100)), 10, 100);
  const maxPct = clamp(Math.round(managerPortfolioConfigNumber('ofertaBotMaxPctClausula', 100, minPct, 150)), minPct, 150);
  const pct = minPct + hashNumber(`portfolio-bot-sale-pct-${game?.saveCode || ''}-${today}-${player.id}`, Math.max(1, maxPct-minPct+1));
  return Math.max(1, Math.round(clause * pct / 100));
}
function processManagerPlayerPortfolioDaily(){
  if(!managerPortfolioConfigBoolean('activo', true) || !game) return { checked:false, sold:0, closed:0 };
  const sync = managerPortfolioSyncRights();
  const portfolio = ensureManagerPlayerPortfolio(game);
  const active = managerPortfolioRights('active');
  if(!active.length) return { checked:false, sold:0, closed:sync.closed };
  if(typeof isTransferMarketOpen === 'function' && !isTransferMarketOpen(game)){
    return { checked:false, sold:0, closed:sync.closed, marketClosed:true };
  }
  const today = validIsoDate(game.currentDate) ? game.currentDate : currentCalendarDate();
  const interval = Math.max(1, Math.round(managerPortfolioConfigNumber('diasEntreRevisionesBot', 30, 1, 365)));
  if(portfolio.lastBotSaleCheckDate && daysBetweenIsoDates(portfolio.lastBotSaleCheckDate, today) < interval) return { checked:false, sold:0, closed:sync.closed };
  portfolio.lastBotSaleCheckDate = today;
  const minTenure = Math.max(0, Math.round(managerPortfolioConfigNumber('diasMinimosAntesVentaBot', 180, 0, 3650)));
  const chance = clamp(managerPortfolioConfigNumber('probabilidadVentaBotPorRevision', 0.18, 0, 1), 0, 1);
  const candidates = active.map(right => ({ right, player:managerPortfolioCurrentPlayer(right) })).filter(item => {
    if(!item.player || Number(item.player.clubId || 0) !== Number(item.right.originClubId)) return false;
    if(Number(item.right.originClubId) === Number(game.selectedClubId || 0) && !(typeof managerWithoutClubActive === 'function' && managerWithoutClubActive())) return false;
    const tenure = validIsoDate(item.right.promotedDate) ? daysBetweenIsoDates(item.right.promotedDate, today) : minTenure;
    if(tenure < minTenure) return false;
    const roll = hashNumber(`portfolio-bot-sale-chance-${game?.saveCode || ''}-${today}-${item.player.id}`, 10000) / 10000;
    return roll < chance;
  }).sort((a,b)=>Number(b.player.overall || 0)-Number(a.player.overall || 0));
  for(const item of candidates){
    const grossAmount = managerPortfolioBotSaleAmount(item.player, item.right, today);
    const buyers = managerPortfolioBotBuyerCandidates(item.player, item.right.originClubId, grossAmount);
    if(!buyers.length) continue;
    const buyer = buyers[hashNumber(`portfolio-bot-buyer-pick-${game?.saveCode || ''}-${today}-${item.player.id}`, Math.min(3,buyers.length))] || buyers[0];
    game.clubBudgets = game.clubBudgets && typeof game.clubBudgets === 'object' && !Array.isArray(game.clubBudgets) ? game.clubBudgets : {};
    const sellerClub = seed.clubs.find(club => Number(club.id) === Number(item.right.originClubId));
    const sellerBudget = Math.round(Number(game.clubBudgets[item.right.originClubId] ?? sellerClub?.budget ?? 0));
    const buyerBudget = Math.round(Number(game.clubBudgets[buyer.club.id] ?? buyer.club.budget ?? 0));
    if(buyerBudget < grossAmount) continue;
    const settlement = managerPortfolioSettleRight(item.right, { grossAmount, buyerClubId:buyer.club.id, source:'bot_to_bot_transfer' });
    if(!settlement) continue;
    game.clubBudgets[buyer.club.id] = buyerBudget - grossAmount;
    game.clubBudgets[item.right.originClubId] = sellerBudget + settlement.sellerReceipt;
    if(typeof resetPlayerCaptaincyProgress === 'function') resetPlayerCaptaincyProgress(item.player.id, item.right.originClubId);
    setPlayerClubId(item.player, Number(buyer.club.id));
    item.player.freeAgent = false;
    item.player.sold = false;
    item.player.transferListed = false;
    item.player.intransferible = false;
    item.player.salaryPaidCount = 0;
    item.player.lastSalaryPaidSeason = 0;
    if(typeof refreshPlayerClause === 'function') refreshPlayerClause(item.player);
    if(game.playerStats?.[item.player.id]) game.playerStats[item.player.id].clubId = item.player.clubId;
    if(game.playerCareerStats?.[item.player.id]) game.playerCareerStats[item.player.id].clubId = item.player.clubId;
    if(typeof syncPlayerStarsWithClubs === 'function') syncPlayerStarsWithClubs(game);
    if(typeof recordTransferHistory === 'function') recordTransferHistory(item.player, { fromClubId:Number(item.right.originClubId), toClubId:Number(buyer.club.id), amount:grossAmount, kind:'bot_transfer', source:'manager_portfolio_bot_sale', transactionKey:`portfolio-transfer-${item.right.id}-${today}` });
    if(typeof pushGameMessage === 'function') pushGameMessage({
      type:'mercado', priority:'normal', title:'Transferencia de un jugador de tu cartera',
      body:`${item.player.name} pasó de ${clubName(item.right.originClubId)} a ${clubName(buyer.club.id)} por ${formatMoney(grossAmount)}. Tu derecho económico ya fue acreditado.`,
      id:`portfolio-bot-transfer-${item.right.id}-${today}`
    });
    return { checked:true, sold:1, closed:sync.closed, rightId:item.right.id, grossAmount };
  }
  return { checked:true, sold:0, closed:sync.closed };
}
function managerPortfolioStatusLabel(right){
  if(right.status === 'active') return { text:'Activo', cls:'ok' };
  if(right.status === 'paid') return { text:'Cobrado', cls:'ok' };
  if(right.status === 'closed_retired') return { text:'Retirado', cls:'muted' };
  if(right.status === 'closed_free_agent') return { text:'Sin venta', cls:'muted' };
  return { text:'Cerrado', cls:'muted' };
}
function managerAcademySubmenuMode(){
  if(!game) return 'players';
  game.academy = game.academy && typeof game.academy === 'object' && !Array.isArray(game.academy) ? game.academy : {};
  const mode = String(game.academy.submenu || 'players');
  game.academy.submenu = mode === 'portfolio' ? 'portfolio' : 'players';
  return game.academy.submenu;
}
function managerAcademySubmenuMarkup(mode=managerAcademySubmenuMode()){
  return `<div class="academy-submenu" role="tablist" aria-label="Secciones de Tu Academia">
    <button type="button" class="academy-submenu-btn ${mode === 'players' ? 'active' : ''}" data-academy-submenu="players" role="tab" aria-selected="${mode === 'players'}">Juveniles</button>
    <button type="button" class="academy-submenu-btn ${mode === 'portfolio' ? 'active' : ''}" data-academy-submenu="portfolio" role="tab" aria-selected="${mode === 'portfolio'}">Cartera de promocionados</button>
  </div>`;
}
function managerPortfolioRightById(rightId){
  const id = String(rightId || '');
  return managerPortfolioRights().find(item => String(item.id || '') === id) || null;
}
function showManagerPortfolioPlayer(rightId){
  const right = managerPortfolioRightById(rightId);
  if(!right) return;
  const player = managerPortfolioCurrentPlayer(right);
  if(player && typeof showPlayerModal === 'function'){
    showPlayerModal(player.id);
    return;
  }
  const status = managerPortfolioStatusLabel(right);
  const benefit = right.status === 'paid' ? Number(right.managerIncome || 0) : managerPortfolioEstimatedIncome(right);
  const currentClubId = Number(right.currentClubId || 0);
  const body = `<div class="player-modal-compact portfolio-archived-player">
    <div class="player-identity-card"><div><p class="label">Cartera de promocionados</p><h2>${escapeHtml(right.playerName)}</h2><p class="muted">${escapeHtml(right.nationality || 'Sin nacionalidad')} · ${escapeHtml(right.position || 'Sin posición')} · Promovido en T${Number(right.promotedSeason || 1)}</p></div></div>
    <div class="grid cols-2">
      <div class="card inner"><h3>Trayectoria registrada</h3><div class="stat-rank"><span>Club de promoción</span><strong>${escapeHtml(right.originClubName || clubName(right.originClubId) || '—')}</strong></div><div class="stat-rank"><span>Club registrado</span><strong>${currentClubId > 0 ? escapeHtml(clubName(currentClubId)) : 'Sin club'}</strong></div><div class="stat-rank"><span>Edad al promoverse</span><strong>${Number(right.ageAtPromotion || 0)}</strong></div></div>
      <div class="card inner"><h3>Derecho económico</h3><div class="stat-rank"><span>Porcentaje</span><strong>${Number(right.percent || 0)}%</strong></div><div class="stat-rank"><span>Estimado / cobrado</span><strong>${formatMoney(benefit)}</strong></div><div class="stat-rank"><span>Estado</span><strong class="${status.cls}">${escapeHtml(status.text)}</strong></div></div>
    </div>
  </div>`;
  openModal(body);
}
function bindManagerAcademySubmenu(){
  document.querySelectorAll('[data-academy-submenu]').forEach(button => button.addEventListener('click', () => {
    const next = button.dataset.academySubmenu === 'portfolio' ? 'portfolio' : 'players';
    if(managerAcademySubmenuMode() === next) return;
    game.academy.submenu = next;
    saveLocal(true);
    renderAcademy();
  }));
  document.querySelectorAll('[data-portfolio-right-id]').forEach(button => button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    showManagerPortfolioPlayer(button.dataset.portfolioRightId);
  }));
}
function managerPlayerPortfolioMarkup(){
  const portfolio = ensureManagerPlayerPortfolio(game);
  managerPortfolioSyncRights();
  const rights = portfolio.rights.slice().sort((a,b) => {
    if(a.status === 'active' && b.status !== 'active') return -1;
    if(a.status !== 'active' && b.status === 'active') return 1;
    return Number(b.promotedSeason || 0)-Number(a.promotedSeason || 0) || String(a.playerName).localeCompare(String(b.playerName));
  });
  const active = rights.filter(item => item.status === 'active');
  const paid = rights.filter(item => item.status === 'paid');
  const estimated = active.reduce((sum,item)=>sum+managerPortfolioEstimatedIncome(item),0);
  const received = paid.reduce((sum,item)=>sum+Number(item.managerIncome || 0),0);
  const rows = rights.map(right => {
    const player = managerPortfolioCurrentPlayer(right);
    const currentClubId = Number(player?.clubId ?? right.currentClubId ?? 0);
    const clause = right.status === 'paid' ? Number(right.grossTransferAmount || 0) : managerPortfolioCurrentClause(right);
    const status = managerPortfolioStatusLabel(right);
    const benefit = right.status === 'paid' ? Number(right.managerIncome || 0) : managerPortfolioEstimatedIncome(right);
    const playerName = escapeHtml(player?.name || right.playerName);
    const playerLink = `<button type="button" class="linklike portfolio-player-link" data-portfolio-right-id="${escapeHtml(right.id)}" title="Abrir ficha del jugador"><strong>${player ? availabilityIcons(player.id) : ''}${playerName}</strong></button>`;
    return `<tr class="clickable-player-row">
      <td>${playerLink}<br><span class="muted small">Promovido en T${Number(right.promotedSeason || 1)}</span></td>
      <td>${escapeHtml(player?.position || right.position || '—')}</td>
      <td>${Number(player?.age ?? right.ageAtPromotion ?? 0)}</td>
      <td>${currentClubId > 0 ? escapeHtml(clubName(currentClubId)) : 'Sin club'}</td>
      <td>${currentClubId > 0 ? escapeHtml(clubDivision(currentClubId)?.name || '—') : '—'}</td>
      <td>${formatMoney(clause)}</td>
      <td><strong>${Number(right.percent || 0)}%</strong></td>
      <td class="${right.status === 'paid' ? 'ok' : ''}">${formatMoney(benefit)}</td>
      <td><span class="pill ${status.cls}">${status.text}</span></td>
    </tr>`;
  }).join('');
  return `<section class="manager-player-portfolio" style="margin-top:14px">
    <div class="row section-title compact"><div><p class="label">Patrimonio deportivo</p><h3>Cartera de juveniles promocionados</h3><p class="muted small">Incluye los juveniles que promoviste al primer equipo de cualquier club y el porcentaje personal sobre su próxima transferencia pagada.</p></div><span class="pill">${active.length} derecho(s) activo(s)</span></div>
    <div class="grid cols-3 manager-portfolio-summary">
      <div class="card"><p class="label">Juveniles promocionados</p><div class="metric">${rights.length}</div></div>
      <div class="card"><p class="label">Beneficio estimado</p><div class="metric small">${formatMoney(estimated)}</div><p class="muted small">Estimación sobre cláusulas actuales y neto de impuestos.</p></div>
      <div class="card"><p class="label">Beneficios cobrados</p><div class="metric small">${formatMoney(received)}</div></div>
    </div>
    <div class="card" style="margin-top:12px"><div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Rol</th><th>Edad</th><th>Club</th><th>Liga</th><th>Cláusula / venta</th><th>Beneficio</th><th>Estimado / cobrado</th><th>Estado</th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">Todavía no promocionaste juveniles con un porcentaje de futura venta.</td></tr>'}</tbody></table></div></div>
  </section>`;
}

/* Registro automático al promover un juvenil. */
const promoteAcademyPlayerV767Portfolio = promoteAcademyPlayer;
promoteAcademyPlayer = function(playerId, exactPosition){
  const academySnapshot = game?.academy?.players?.find(item => Number(item.id) === Number(playerId) && item.status === 'academy');
  const copy = academySnapshot ? { ...academySnapshot } : null;
  promoteAcademyPlayerV767Portfolio(playerId, exactPosition);
  const professional = typeof playerById === 'function' ? playerById(playerId) : null;
  if(copy && professional && Number(professional.clubId || 0) === Number(game?.selectedClubId || 0)){
    const created = managerPortfolioRegisterPromotion(professional, copy);
    if(created){ saveLocal(true); if(activeTab === 'academy') renderAcademy(); }
  }
};

/* Cobro cuando el club dirigido vende al jugador mediante una oferta recibida. */
const completeTransferSaleFromMessageV767Portfolio = completeTransferSaleFromMessage;
completeTransferSaleFromMessage = function(msg, player, options={}){
  const sellerClubId = Number(player?.clubId || 0);
  const right = managerPortfolioActiveRight(player?.id, sellerClubId);
  const grossAmount = Math.max(0, Math.round(Number(msg?.action?.grossAmount ?? msg?.action?.amount ?? 0)));
  const buyerClubId = Math.round(Number(msg?.action?.sourceClubId || 0));
  const transferResult = completeTransferSaleFromMessageV767Portfolio(msg, player, options) || {};
  if(!transferResult.executed || !right || grossAmount <= 0) return transferResult;
  const settlement = managerPortfolioSettleRight(right, { grossAmount, buyerClubId, source:msg?.action?.origin || 'manager_sale' });
  if(!settlement) return transferResult;
  if(Number(sellerClubId) === Number(game?.selectedClubId || 0) && typeof recordBudgetChange === 'function'){
    recordBudgetChange(-settlement.managerIncome, `Derecho económico de ${right.playerName}`, {
      type:'academy_future_sale_share', playerId:right.playerId, rightId:right.id, grossAmount,
      transferNetAmount:settlement.transferNetAmount, managerIncome:settlement.managerIncome
    });
  }
  msg.action.managerEconomicRight = settlement.managerIncome;
  msg.action.managerEconomicRightPercent = right.percent;
  msg.body += ` Del neto, ${formatMoney(settlement.managerIncome)} correspondieron al ${right.percent}% personal del manager por formación.`;
  saveLocal(true);
  if(options.silent !== true && activeTab === 'messages') renderMessages();
  return transferResult;
};

/* Cobro si el manager compra desde su club a un jugador con derecho activo en un club bot. */
const processPendingTransfersV767Portfolio = processPendingTransfers;
processPendingTransfers = function(){
  const due = (game?.pendingTransfers || []).filter(item => String(item.type || 'incoming') === 'incoming' && typeof isPendingTransferReadyToExecute === 'function' && isPendingTransferReadyToExecute(item, game)).map(item => ({
    id:item.id, playerId:Number(item.playerId), sellerClubId:Number(item.fromClubId || 0), buyerClubId:Number(item.toClubId || 0), grossAmount:Math.max(0,Math.round(Number(item.amount || 0))),
    right:managerPortfolioActiveRight(item.playerId, item.fromClubId)
  }));
  const baseSummary = processPendingTransfersV767Portfolio();
  due.forEach(item => {
    const transfer = (game.pendingTransfers || []).find(entry => String(entry.id) === String(item.id));
    if(!item.right || transfer?.status !== 'arrived' || item.grossAmount <= 0) return;
    const settlement = managerPortfolioSettleRight(item.right, { grossAmount:item.grossAmount, buyerClubId:item.buyerClubId, source:'manager_purchase_from_bot' });
    if(!settlement) return;
    // La liquidación de caja queda centralizada en 05q. Guardar sólo el reparto
    // evita que el club vendedor reciba primero sellerReceipt y después el neto completo.
    transfer.managerEconomicRightSettlementV886 = {
      rightId:String(item.right.id || ''),
      sellerClubId:Number(item.sellerClubId || 0),
      buyerClubId:Number(item.buyerClubId || 0),
      grossAmount:Number(settlement.grossAmount || 0),
      taxAmount:Number(settlement.taxAmount || 0),
      transferNetAmount:Number(settlement.transferNetAmount || 0),
      managerIncome:Number(settlement.managerIncome || 0),
      sellerReceipt:Number(settlement.sellerReceipt || 0),
      settledDate:String(game?.currentDate || '')
    };
  });
  if(due.some(item => item.right)) saveLocal(true);
  return baseSummary;
};

/* La cartera se muestra como submenú independiente dentro de Tu Academia. */
const renderAcademyV767Portfolio = renderAcademy;
renderAcademy = function(){
  const mode = managerAcademySubmenuMode();
  if(mode === 'portfolio'){
    const view = $('view');
    if(!view) return;
    view.innerHTML = `${managerAcademySubmenuMarkup(mode)}${managerPlayerPortfolioMarkup()}`;
  }else{
    renderAcademyV767Portfolio();
    const view = $('view');
    if(view) view.insertAdjacentHTML('afterbegin', managerAcademySubmenuMarkup(mode));
  }
  bindManagerAcademySubmenu();
};

/* Migración y persistencia. No se generan derechos retroactivos. */
const normalizeGameV767Portfolio = normalizeGame;
normalizeGame = function(saved){
  const normalized = normalizeGameV767Portfolio(saved);
  const hadPortfolio = Boolean(normalized.managerPlayerPortfolio && typeof normalized.managerPlayerPortfolio === 'object' && !Array.isArray(normalized.managerPlayerPortfolio));
  ensureManagerPlayerPortfolio(normalized);
  const normalizedNames = typeof normalizeGamePlayerNamesToSpanishScript === 'function'
    ? normalizeGamePlayerNamesToSpanishScript(normalized, seed)
    : 0;
  if(!hadPortfolio || normalizedNames > 0) normalized._needsAutosave = true;
  return normalized;
};
const newGameV767Portfolio = newGame;
newGame = function(selectedClubId, options={}){
  newGameV767Portfolio(selectedClubId, options);
  if(game){ ensureManagerPlayerPortfolio(game); saveLocal(true); }
};
