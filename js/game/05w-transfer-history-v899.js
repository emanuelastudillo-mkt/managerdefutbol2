/* V8.99 · Registro anual de transferencias profesionales. */

let transferHistorySeasonFilter = 'current';

function transferHistoryCurrentSeason(state=game){
  return Math.max(1, Math.round(Number(state?.seasonNumber || 1)));
}
function transferHistoryCurrentYear(state=game, season=transferHistoryCurrentSeason(state)){
  if(Number(season) === Number(state?.seasonNumber || 1) && Number.isFinite(Number(state?.seasonYear))) return Math.round(Number(state.seasonYear));
  if(typeof seasonYearForNumber === 'function') return Math.round(Number(seasonYearForNumber(season) || 0));
  return Math.max(1, Math.round(Number(season || 1)));
}
function transferHistoryClubLabel(clubId, fallback=''){
  const id = Number(clubId || 0);
  if(id === 0) return 'Libre';
  const club = (seed?.clubs || []).find(item => Number(item?.id || 0) === id);
  if(club?.name) return String(club.name);
  if(String(fallback || '').trim()) return String(fallback).trim();
  return id < 0 ? 'Club del exterior' : `Club ${id}`;
}
function transferHistoryPlayerOverall(player){
  const raw = typeof visibleOverall === 'function' ? visibleOverall(player) : Number(player?.overall || 0);
  return Math.max(1, Math.min(99, Math.round(Number(raw || 1))));
}
function transferHistoryKindLabel(kind='transfer'){
  const labels = {
    purchase:'Compra', sale:'Venta', free_signing:'Libre contratado', release:'Jugador liberado',
    contract_expiry:'Fin de contrato', bot_transfer:'Transferencia', bot_free_signing:'Libre contratado',
    bot_release:'Jugador liberado', bankruptcy_release:'Liberado por bancarrota'
  };
  return labels[String(kind || '')] || 'Transferencia';
}
function transferHistoryNormalizeEntry(raw={}, index=0){
  const season = Math.max(1, Math.round(Number(raw.season || 1)));
  const playerId = Math.max(0, Math.round(Number(raw.playerId || 0)));
  const fromClubId = Math.round(Number(raw.fromClubId || 0));
  const toClubId = Math.round(Number(raw.toClubId || 0));
  const amount = Math.max(0, Math.round(Number(raw.amount ?? raw.paid ?? 0)));
  return {
    id:String(raw.id || `transfer-${season}-${playerId}-${index + 1}`),
    transactionKey:String(raw.transactionKey || ''),
    season,
    seasonYear:Math.round(Number(raw.seasonYear || transferHistoryCurrentYear(game, season) || season)),
    day:Math.max(0, Math.round(Number(raw.day || 0))),
    date:String(raw.date || ''),
    playerId,
    playerName:String(raw.playerName || raw.name || 'Jugador'),
    overall:Math.max(1, Math.min(99, Math.round(Number(raw.overall || raw.media || 1)))),
    amount,
    fromClubId,
    fromLabel:String(raw.fromLabel || transferHistoryClubLabel(fromClubId, raw.fromFallback || '')),
    toClubId,
    toLabel:String(raw.toLabel || transferHistoryClubLabel(toClubId, raw.toFallback || '')),
    kind:String(raw.kind || 'transfer'),
    source:String(raw.source || ''),
    createdAt:String(raw.createdAt || '')
  };
}
function transferHistoryRetiredIds(state=game){
  const ids = new Set();
  (state?.retiredPlayerPool || []).forEach(item => {
    const id = Number(item?.previousPlayerId || item?.id || 0);
    if(id > 0) ids.add(id);
  });
  (state?.manualRetiredPlayerIds || []).forEach(id => { if(Number(id) > 0) ids.add(Number(id)); });
  return ids;
}
function ensureTransferHistoryState(state=game){
  if(!state) return { version:'V8.99', nextId:1, entries:[] };
  const raw = state.transferHistory && typeof state.transferHistory === 'object' && !Array.isArray(state.transferHistory)
    ? state.transferHistory : {};
  const retiredIds = transferHistoryRetiredIds(state);
  const seenIds = new Set();
  const seenKeys = new Set();
  const entries = (Array.isArray(raw.entries) ? raw.entries : [])
    .map(transferHistoryNormalizeEntry)
    .filter(entry => {
      if(!entry.playerId || retiredIds.has(entry.playerId)) return false;
      if(seenIds.has(entry.id)) return false;
      if(entry.transactionKey && seenKeys.has(entry.transactionKey)) return false;
      seenIds.add(entry.id);
      if(entry.transactionKey) seenKeys.add(entry.transactionKey);
      return true;
    })
    .sort((a,b) => Number(a.season)-Number(b.season) || Number(a.day)-Number(b.day) || String(a.date).localeCompare(String(b.date)) || String(a.id).localeCompare(String(b.id)));
  const numericIds = entries.map(item => Number(String(item.id).match(/(\d+)$/)?.[1] || 0));
  const nextId = Math.max(1, Math.round(Number(raw.nextId || 1)), (numericIds.length ? Math.max(...numericIds) + 1 : 1));
  state.transferHistory = { version:'V8.99', nextId, entries };
  return state.transferHistory;
}
function recordTransferHistory(player, options={}){
  if(!game || !player) return null;
  const history = ensureTransferHistoryState(game);
  const playerId = Number(player.id || options.playerId || 0);
  if(!playerId) return null;
  const fromClubId = Math.round(Number(options.fromClubId || 0));
  const toClubId = Math.round(Number(options.toClubId || 0));
  if(fromClubId === toClubId) return null;
  const transactionKey = String(options.transactionKey || '');
  if(transactionKey && history.entries.some(entry => entry.transactionKey === transactionKey)) return null;
  const sequence = Math.max(1, Math.round(Number(history.nextId || 1)));
  const season = Math.max(1, Math.round(Number(options.season || game.seasonNumber || 1)));
  const entry = transferHistoryNormalizeEntry({
    id:`tr-${season}-${sequence}`,
    transactionKey,
    season,
    seasonYear:Number(options.seasonYear || transferHistoryCurrentYear(game, season)),
    day:Number(options.day ?? (typeof transferMarketSeasonDayForState === 'function' ? transferMarketSeasonDayForState(game) : game.matchdayIndex || 0)),
    date:String(options.date || game.currentDate || ''),
    playerId,
    playerName:String(options.playerName || player.name || 'Jugador'),
    overall:Number(options.overall || transferHistoryPlayerOverall(player)),
    amount:Number(options.amount || 0),
    fromClubId,
    fromLabel:transferHistoryClubLabel(fromClubId, options.fromLabel || options.fromFallback || ''),
    toClubId,
    toLabel:transferHistoryClubLabel(toClubId, options.toLabel || options.toFallback || ''),
    kind:String(options.kind || 'transfer'),
    source:String(options.source || ''),
    createdAt:new Date().toISOString()
  }, history.entries.length);
  history.entries.push(entry);
  history.nextId = sequence + 1;
  return entry;
}
function transferHistoryLatestEntryForPlayer(playerId, state=game){
  const id = Number(playerId || 0);
  const entries = ensureTransferHistoryState(state).entries.filter(entry => Number(entry.playerId || 0) === id);
  return entries.length ? entries[entries.length - 1] : null;
}
function repairCompletedIncomingTransferOwnership(state=game){
  if(!state || !Array.isArray(state.pendingTransfers) || !seed?.players) return { checked:0, repaired:0, synced:0, playerIds:[] };
  let checked = 0;
  let repaired = 0;
  let synced = 0;
  const playerIds = [];
  state.pendingTransfers.forEach(item => {
    if(String(item?.type || 'incoming') !== 'incoming' || String(item?.status || '') !== 'arrived') return;
    const playerId = Number(item.playerId || 0);
    const targetClubId = Number(item.toClubId || 0);
    if(!playerId || !targetClubId) return;
    checked += 1;
    const latest = transferHistoryLatestEntryForPlayer(playerId, state);
    const expectedKey = `pending-transfer-${item.id}`;
    const confirmsArrival = Boolean(latest
      && Number(latest.toClubId || 0) === targetClubId
      && String(latest.source || '') === 'pending_incoming'
      && (!latest.transactionKey || String(latest.transactionKey) === expectedKey));
    if(!confirmsArrival) return;
    const player = (seed.players || []).find(entry => Number(entry?.id || 0) === playerId);
    if(!player || player.retired) return;
    const wasWrong = Number(player.clubId || 0) !== targetClubId;
    const result = typeof syncPlayerOwnershipReferences === 'function'
      ? syncPlayerOwnershipReferences(player, targetClubId, {
          state,
          source:wasWrong ? 'v961_completed_purchase_repair' : 'v961_completed_purchase_sync',
          freeAgent:false,
          sold:false,
          transferListed:false,
          intransferible:false,
          clearAgreement:true,
          forceRevision:wasWrong
        })
      : null;
    if(wasWrong){
      if(!result) setPlayerClubId(player, targetClubId, { source:'v961_completed_purchase_repair', forceRevision:true });
      item.ownershipRepairV961 = true;
      item.ownershipRepairDateV961 = String(state.currentDate || '');
      repaired += 1;
      playerIds.push(playerId);
    }else if(result?.marketUpdated){
      synced += 1;
    }
  });
  return { checked, repaired, synced, playerIds };
}

function purgeTransferHistoryForRetiredPlayers(playerIds=[], state=game){
  if(!state) return 0;
  const history = ensureTransferHistoryState(state);
  const ids = new Set((Array.isArray(playerIds) ? playerIds : [playerIds]).map(Number).filter(id => id > 0));
  if(!ids.size) return 0;
  const before = history.entries.length;
  history.entries = history.entries.filter(entry => !ids.has(Number(entry.playerId || 0)));
  return before - history.entries.length;
}
function transferHistoryEntriesForSeason(season, state=game){
  const history = ensureTransferHistoryState(state);
  const selected = Math.max(1, Math.round(Number(season || transferHistoryCurrentSeason(state))));
  return history.entries.filter(entry => Number(entry.season) === selected).sort((a,b) => Number(b.day)-Number(a.day) || String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
}
function transferHistoryMoney(amount){
  const value = Math.max(0, Math.round(Number(amount || 0)));
  if(value <= 0) return '<span class="pill ok">Libre</span>';
  const full = typeof formatMoney === 'function' ? formatMoney(value) : `$${value.toLocaleString('es-AR')}`;
  if(typeof formatClubProfileMoney === 'function') return `<span title="${escapeHtml(full)}">${formatClubProfileMoney(value)}</span>`;
  return escapeHtml(full);
}
function transferHistoryDateLabel(entry){
  if(entry?.date) return escapeHtml(entry.date);
  return entry?.day ? `Día ${Number(entry.day)}` : '—';
}
function transferHistorySeasonOptions(selected){
  const history = ensureTransferHistoryState(game);
  const current = transferHistoryCurrentSeason(game);
  const seasons = Array.from(new Set([current, ...history.entries.map(entry => Number(entry.season || 0)).filter(Boolean)])).sort((a,b)=>b-a);
  return seasons.map(season => `<option value="${season}" ${Number(selected)===season?'selected':''}>Temporada ${season}${Number(transferHistoryCurrentYear(game, season)) ? ` · ${transferHistoryCurrentYear(game, season)}` : ''}</option>`).join('');
}
function renderTransferHistoryMarket(){
  const current = transferHistoryCurrentSeason(game);
  const selected = transferHistorySeasonFilter === 'current' ? current : Math.max(1, Math.round(Number(transferHistorySeasonFilter || current)));
  const entries = transferHistoryEntriesForSeason(selected, game);
  const paidTotal = entries.reduce((sum, entry) => sum + Number(entry.amount || 0), 0);
  const freeCount = entries.filter(entry => Number(entry.amount || 0) <= 0).length;
  const paidCount = entries.length - freeCount;
  const rows = entries.map(entry => `<tr>
    <td>${transferHistoryDateLabel(entry)}</td>
    <td><button class="linklike" data-player-id="${Number(entry.playerId)}"><strong>${escapeHtml(entry.playerName)}</strong></button></td>
    <td><span class="pill">${Number(entry.overall || 0)}</span></td>
    <td>${transferHistoryMoney(entry.amount)}</td>
    <td>${entry.fromClubId > 0 && typeof clubBadge === 'function' ? clubBadge(entry.fromClubId) : ''} ${escapeHtml(entry.fromLabel)}</td>
    <td>${entry.toClubId > 0 && typeof clubBadge === 'function' ? clubBadge(entry.toClubId) : ''} ${escapeHtml(entry.toLabel)}</td>
    <td><span class="pill transfer-history-kind">${escapeHtml(transferHistoryKindLabel(entry.kind))}</span></td>
  </tr>`).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Mercado</h2><p class="tagline">Registro anual de altas, bajas y transferencias de todos los clubes.</p></div>
    ${typeof marketTabsMarkup === 'function' ? marketTabsMarkup() : ''}
    <div class="card transfer-history-toolbar">
      <label>Temporada<select id="transferHistorySeasonSelect">${transferHistorySeasonOptions(selected)}</select></label>
      <p class="muted small">El historial conserva cada movimiento mientras el jugador permanezca activo. Al retirarse, todas sus operaciones se eliminan automáticamente.</p>
    </div>
    <div class="grid cols-4 transfer-history-summary">
      <div class="card"><p class="label">Movimientos</p><strong class="metric">${entries.length}</strong></div>
      <div class="card"><p class="label">Con pago</p><strong class="metric">${paidCount}</strong></div>
      <div class="card"><p class="label">Pases libres</p><strong class="metric">${freeCount}</strong></div>
      <div class="card"><p class="label">Dinero movilizado</p><strong class="metric">${transferHistoryMoney(paidTotal)}</strong></div>
    </div>
    <div class="table-wrap transfer-history-table-wrap"><table class="transfer-history-table"><thead><tr><th>Fecha</th><th>Jugador</th><th>Media</th><th>Pagado</th><th>Estado anterior</th><th>Destino</th><th>Movimiento</th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">Todavía no se registraron transferencias en esta temporada.</td></tr>'}</tbody></table></div>`;
  if(typeof bindMarketTabs === 'function') bindMarketTabs();
  document.getElementById('transferHistorySeasonSelect')?.addEventListener('change', event => {
    transferHistorySeasonFilter = String(event.target.value || current);
    renderTransferHistoryMarket();
  });
}

window.ensureTransferHistoryState = ensureTransferHistoryState;
window.recordTransferHistory = recordTransferHistory;
window.purgeTransferHistoryForRetiredPlayers = purgeTransferHistoryForRetiredPlayers;
window.renderTransferHistoryMarket = renderTransferHistoryMarket;
