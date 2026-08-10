/* V8.86 · Caja persistente por club y liquidación económica.
   La recuperación de calendario se delega de forma exclusiva en 05r. */

(function(){
  const VERSION = 1;

  function v883Number(value, fallback=0){
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }
  function v883Round(value){ return Math.round(v883Number(value, 0)); }
  function v883State(target=game){ return target && typeof target === 'object' ? target : null; }
  function v883Club(target, clubId){ return (seed?.clubs || []).find(club => Number(club.id) === Number(clubId)) || null; }
  function v883EnsureClubCash(target=game){
    const state = v883State(target);
    if(!state) return {};
    state.clubBudgets = state.clubBudgets && typeof state.clubBudgets === 'object' && !Array.isArray(state.clubBudgets) ? state.clubBudgets : {};
    (seed?.clubs || []).forEach(club => {
      if(!Number.isFinite(Number(state.clubBudgets[club.id]))) state.clubBudgets[club.id] = v883Round(club.budget || 0);
    });
    const selectedId = Number(state.selectedClubId || 0);
    const managerHasClub = !Boolean(state.gameOver?.active);
    if(selectedId > 0 && managerHasClub){
      const selectedStored = Number(state.clubBudgets[selectedId]);
      if(Number.isFinite(Number(state.budget))) state.clubBudgets[selectedId] = v883Round(state.budget);
      else if(Number.isFinite(selectedStored)) state.budget = v883Round(selectedStored);
    }
    state.clubBudgetHistory = Array.isArray(state.clubBudgetHistory) ? state.clubBudgetHistory.slice(-1200) : [];
    state.clubEconomyState = state.clubEconomyState && typeof state.clubEconomyState === 'object' && !Array.isArray(state.clubEconomyState) ? state.clubEconomyState : {};
    state.clubEconomyState.version = VERSION;
    return state.clubBudgets;
  }
  function v883ClubCash(clubId, target=game){
    const state = v883State(target);
    if(!state) return 0;
    v883EnsureClubCash(state);
    if(Number(clubId) === Number(state.selectedClubId) && Number.isFinite(Number(state.budget))) return v883Round(state.budget);
    return v883Round(state.clubBudgets?.[clubId] ?? v883Club(state, clubId)?.budget ?? 0);
  }
  function v883RecordClubCashHistory(clubId, delta, concept, meta={}, target=game){
    const state = v883State(target);
    if(!state) return;
    state.clubBudgetHistory = Array.isArray(state.clubBudgetHistory) ? state.clubBudgetHistory : [];
    const balance = v883ClubCash(clubId, state);
    state.clubBudgetHistory.push({
      season:Number(state.seasonNumber || 1),
      date:String(state.currentDate || ''),
      clubId:Number(clubId || 0),
      concept:String(concept || 'Movimiento de caja'),
      delta:v883Round(delta),
      balance,
      ...meta
    });
    state.clubBudgetHistory = state.clubBudgetHistory.slice(-1200);
  }
  function v883ApplyClubCashChange(clubId, delta, concept='Movimiento de caja', meta={}, target=game){
    const state = v883State(target);
    const cleanClubId = Number(clubId || 0);
    if(!state || !cleanClubId) return 0;
    v883EnsureClubCash(state);
    const safeDelta = v883Round(delta);
    if(cleanClubId === Number(state.selectedClubId) && state === game && typeof recordBudgetChange === 'function'){
      recordBudgetChange(safeDelta, concept, meta);
      return v883ClubCash(cleanClubId, state);
    }
    state.clubBudgets[cleanClubId] = v883Round(v883ClubCash(cleanClubId, state) + safeDelta);
    v883RecordClubCashHistory(cleanClubId, safeDelta, concept, meta, state);
    return state.clubBudgets[cleanClubId];
  }
  window.ensurePersistentClubCashState = v883EnsureClubCash;
  window.clubCashAvailable = v883ClubCash;
  window.applyClubCashChange = v883ApplyClubCashChange;

  if(typeof recordBudgetChange === 'function'){
    const originalRecordBudgetChange = recordBudgetChange;
    recordBudgetChange = function(delta, concept, meta={}){
      const before = Number(game?.budget || 0);
      const result = originalRecordBudgetChange(delta, concept, meta);
      if(game){
        v883EnsureClubCash(game);
        const clubId = Number(game.selectedClubId || 0);
        if(clubId){
          game.clubBudgets[clubId] = v883Round(game.budget || 0);
          v883RecordClubCashHistory(clubId, Number(game.budget || 0) - before, concept, { ...meta, managerClub:true }, game);
        }
      }
      return result;
    };
  }

  function v883TransferTaxRate(){
    if(typeof TRANSFER_AFA_TAX_RATE !== 'undefined') return Math.max(0, Number(TRANSFER_AFA_TAX_RATE || 0));
    return Math.max(0, Number(window.GAME_CONFIG?.mercado?.impuestoAfaTraspasos || 0));
  }
  function v883IncomingTransferCandidates(){
    if(!game || !Array.isArray(game.pendingTransfers)) return [];
    return game.pendingTransfers.filter(item => {
      if(String(item?.type || 'incoming') !== 'incoming') return false;
      if(item?.cashSettlementV883) return false;
      if(typeof isActivePendingTransfer === 'function' && !isActivePendingTransfer(item)) return false;
      if(typeof isPendingTransferReadyToExecute === 'function' && !isPendingTransferReadyToExecute(item, game)) return false;
      return Number(item?.fromClubId || 0) > 0 && Number(item?.amount || 0) > 0;
    }).map(item => ({ id:String(item.id || ''), sellerClubId:Number(item.fromClubId || 0), buyerClubId:Number(item.toClubId || game.selectedClubId || 0), gross:v883Round(item.amount || 0) }));
  }
  if(typeof processPendingTransfers === 'function'){
    const originalProcessPendingTransfers = processPendingTransfers;
    processPendingTransfers = function(...args){
      const candidates = v883IncomingTransferCandidates();
      const result = originalProcessPendingTransfers.apply(this, args);
      candidates.forEach(candidate => {
        const transfer = (game?.pendingTransfers || []).find(item => String(item.id || '') === candidate.id);
        if(!transfer || String(transfer.status || '') !== 'arrived' || transfer.cashSettlementV883) return;
        const tax = v883Round(candidate.gross * v883TransferTaxRate());
        const net = Math.max(0, candidate.gross - tax);
        const rightSettlement = transfer.managerEconomicRightSettlementV886 && typeof transfer.managerEconomicRightSettlementV886 === 'object'
          ? transfer.managerEconomicRightSettlementV886
          : null;
        const managerIncome = Math.max(0, Math.min(net, v883Round(rightSettlement?.managerIncome || 0)));
        const sellerReceipt = Math.max(0, net - managerIncome);
        v883ApplyClubCashChange(candidate.sellerClubId, sellerReceipt, `Venta de jugador a ${clubName(candidate.buyerClubId)}`, {
          type:'transfer_sale_bot_credit', transferId:candidate.id, buyerClubId:candidate.buyerClubId,
          grossAmount:candidate.gross, taxAmount:tax, netAmount:net, managerEconomicRight:managerIncome
        });
        transfer.cashSettlementV883 = {
          sellerCredited:true,
          gross:candidate.gross,
          tax,
          net,
          sellerReceipt,
          managerEconomicRight:managerIncome,
          date:game.currentDate || ''
        };
      });
      return result;
    };
  }
  if(typeof completeTransferSaleFromMessage === 'function'){
    const originalCompleteTransferSale = completeTransferSaleFromMessage;
    completeTransferSaleFromMessage = function(msg, player, options={}){
      const action = msg?.action || {};
      const buyerClubId = Number(action.sourceClubId || 0);
      const gross = v883Round(action.grossAmount ?? action.amount ?? 0);
      const alreadySettled = Boolean(action.buyerCashDebitedV883);
      const result = originalCompleteTransferSale.call(this, msg, player, options);
      if(result?.executed && buyerClubId > 0 && gross > 0 && !alreadySettled && !action.buyerCashDebitedV883){
        v883ApplyClubCashChange(buyerClubId, -gross, `Compra de ${player?.name || 'jugador'}`, {
          type:'transfer_purchase_bot_debit', playerId:Number(player?.id || 0), sellerClubId:Number(action.ownerClubId || game?.selectedClubId || 0), grossAmount:gross
        });
        action.buyerCashDebitedV883 = true;
        action.buyerCashDebitedDate = String(game?.currentDate || '');
      }
      return result;
    };
  }

  function v883AwardLeagueChampionPrizes(){
    if(!game?.seasonFinalized || typeof sortedStandings !== 'function' || typeof seasonChampionPrizeAmount !== 'function') return { awarded:0, total:0 };
    v883EnsureClubCash(game);
    game.clubPrizeAwards = game.clubPrizeAwards && typeof game.clubPrizeAwards === 'object' && !Array.isArray(game.clubPrizeAwards) ? game.clubPrizeAwards : {};
    const season = Number(game.seasonNumber || 1);
    let awarded = 0;
    let total = 0;
    (seed?.divisions || []).forEach(division => {
      const champion = sortedStandings(division.id)?.[0];
      const clubId = Number(champion?.clubId || 0);
      if(!clubId) return;
      const key = `league:${season}:${division.id}:${clubId}`;
      if(game.clubPrizeAwards[key]) return;
      const amount = Math.max(0, v883Round(seasonChampionPrizeAmount(division)));
      const managerAward = game.seasonPrizeAwards?.[`${season}-${clubId}`];
      if(clubId === Number(game.selectedClubId) && Number(managerAward?.champion || 0) > 0){
        game.clubPrizeAwards[key] = { amount:Number(managerAward.champion || amount), mirroredManagerAward:true, date:game.currentDate || '' };
        return;
      }
      if(amount > 0){
        v883ApplyClubCashChange(clubId, amount, `Premio por campeonato: ${division.name || division.id}`, {
          type:'season_prize_champion', competitionType:'league', divisionId:String(division.id), season
        });
        awarded += 1;
        total += amount;
      }
      game.clubPrizeAwards[key] = { amount, date:game.currentDate || '' };
    });
    return { awarded, total };
  }
  window.awardAllLeagueChampionPrizes = v883AwardLeagueChampionPrizes;
  if(typeof finalizeSeasonIfNeeded === 'function'){
    const originalFinalizeSeason = finalizeSeasonIfNeeded;
    finalizeSeasonIfNeeded = function(...args){
      const result = originalFinalizeSeason.apply(this, args);
      v883AwardLeagueChampionPrizes();
      return result;
    };
  }

  if(typeof awardClubWorldCupPrizeIfManaged === 'function'){
    awardClubWorldCupPrizeIfManaged = function(clubId, stage){
      if(!game || !stage) return false;
      const cleanClubId = Number(clubId || 0);
      const state = typeof clubWorldCupState === 'function' ? clubWorldCupState() : game.clubWorldCup;
      if(!cleanClubId || !state || (typeof clubWorldCupClubParticipates === 'function' && !clubWorldCupClubParticipates(cleanClubId, state))) return false;
      const amount = Number(typeof CLUB_WORLD_CUP_CONFIG !== 'undefined' ? CLUB_WORLD_CUP_CONFIG.prizes?.[stage] : 0) || 0;
      if(amount <= 0) return false;
      state.prizesPaid = state.prizesPaid || {};
      const paid = state.prizesPaid[cleanClubId] || {};
      if(paid[String(stage)]) return false;
      paid[String(stage)] = amount;
      state.prizesPaid[cleanClubId] = paid;
      v883ApplyClubCashChange(cleanClubId, amount, `Premio Mundial de Clubes: ${stage}`, {
        type:'club_world_cup_prize', stage:String(stage), competition:'club-world-cup', season:Number(state.season || game.seasonNumber || 1)
      });
      if(cleanClubId === Number(game.selectedClubId)){
        const labels = { participate:'Participación', groups:'Pasar grupos', qf:'Cuartos', sf:'Semifinal', runnerUp:'Subcampeón', champion:'Campeón' };
        pushGameMessage({
          type:'finanzas', priority:'normal', title:`Premio ${CLUB_WORLD_CUP_CONFIG.name}`,
          body:`${labels[String(stage)] || stage}: ${formatMoney(amount)} acreditados a ${clubName(cleanClubId)}.`,
          id:`club-world-cup-prize-${state.season}-${cleanClubId}-${String(stage)}`
        });
      }
      return true;
    };
  }

  // V8.85: la recuperación de calendario queda centralizada en 05r.
  // Se conserva un puente para compatibilidad con llamadas antiguas, pero esta
  // capa económica ya no envuelve el avance diario ni reprograma encuentros.
  window.recoverOverdueMatchesOnTuesdays = function(target=game, options={}){
    if(typeof window.runCalendarIntegrityAudit === 'function'){
      return window.runCalendarIntegrityAudit(target, options);
    }
    return { ran:false, deferred:true, repairedRounds:0, repairedMatches:0, restoredMissing:0, rescheduled:0, dates:[] };
  };

  if(typeof normalizeGame === 'function'){
    const originalNormalizeGame = normalizeGame;
    normalizeGame = function(saved){
      const normalized = originalNormalizeGame.call(this, saved);
      v883EnsureClubCash(normalized);
      return normalized;
    };
  }
  if(typeof newGame === 'function'){
    const originalNewGame = newGame;
    newGame = function(...args){
      const result = originalNewGame.apply(this, args);
      v883EnsureClubCash(game);
      return result;
    };
  }
  if(typeof startNextSeason === 'function'){
    const originalStartNextSeason = startNextSeason;
    startNextSeason = function(...args){
      if(game) v883EnsureClubCash(game);
      const result = originalStartNextSeason.apply(this, args);
      if(game) v883EnsureClubCash(game);
      return result;
    };
  }
  if(typeof continueCareerAtClub === 'function'){
    const originalContinueCareerAtClub = continueCareerAtClub;
    continueCareerAtClub = function(...args){
      if(game) v883EnsureClubCash(game);
      const result = originalContinueCareerAtClub.apply(this, args);
      if(game) v883EnsureClubCash(game);
      return result;
    };
  }

  window.requestAdvanceCalendarOneStep = function(){
    if(!game || typeof advanceCalendarOneStep !== 'function') return;
    if(typeof isAdvanceLocked === 'function' && isAdvanceLocked()){
      showNotice(`Avance bloqueado por ${formatClock(advanceLockLeftMs())}.`);
      return;
    }
    const duration = Math.max(1200, Number(typeof DAY_ADVANCE_LOCK_MS !== 'undefined' ? DAY_ADVANCE_LOCK_MS : (typeof ADVANCE_LOCK_MS !== 'undefined' ? ADVANCE_LOCK_MS : 20000)) || 20000);
    if(typeof setAdvanceLock === 'function') setAdvanceLock(duration);
    if(typeof updateAdvanceButtonState === 'function') updateAdvanceButtonState();
    const button = document.getElementById('advanceUnifiedBtn') || document.getElementById('advanceMatchBtn') || document.getElementById('advanceDayBtn');
    if(button){ button.disabled = true; button.textContent = `Espera ${typeof formatClock === 'function' ? formatClock(duration) : ''}`.trim(); }
    requestAnimationFrame(() => setTimeout(() => {
      if(!game) return;
      // Permite que el núcleo ejecute sus validaciones; la UI ya mostró primero el bloqueo.
      game.advanceLockedUntil = 0;
      game.advanceLockDurationMs = 0;
      try{ advanceCalendarOneStep(); }
      catch(error){
        console.error('Error al avanzar después del bloqueo visual:', error);
        if(typeof setAdvanceLock === 'function') setAdvanceLock(0);
        if(typeof updateAdvanceButtonState === 'function') updateAdvanceButtonState();
        throw error;
      }
    }, 25));
  };
})();
