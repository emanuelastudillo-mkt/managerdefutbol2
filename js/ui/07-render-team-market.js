/* Primer equipo, mercado y táctica: probabilidad de fichaje visible sólo si fue ojeada. */

let firstTeamPhysicalReportSort = 'risk_desc';

function firstTeamTabsMarkup(current){
  const tabs = [
    ['tactics','Táctica'],
    ['squad','Plantel'],
    ['physicalReport','Informe físico'],
    ['training','Entrenamiento'],
    ['playerStats','Estadísticas']
  ];
  return `<div class="card first-team-tabs"><div class="subtabs">${tabs.map(([key,label])=>`<button class="${current===key?'active':''}" data-first-team-tab="${key}">${label}</button>`).join('')}</div></div>`;
}
let firstTeamRenderRequest = 0;
function bindFirstTeamTabs(){
  if(!view || view.dataset.firstTeamTabsBound === '1') return;
  view.dataset.firstTeamTabsBound = '1';
  view.addEventListener('click', event => {
    const btn = event.target.closest('[data-first-team-tab]');
    if(!btn || !view.contains(btn)) return;
    const nextTab = btn.dataset.firstTeamTab || 'tactics';
    if(nextTab === firstTeamTab) return;
    firstTeamTab = nextTab;
    view.querySelectorAll('[data-first-team-tab]').forEach(item => item.classList.toggle('active', item === btn));
    const request = ++firstTeamRenderRequest;
    const run = () => { if(request === firstTeamRenderRequest && activeTab === 'firstTeam') renderFirstTeam(); };
    if(typeof requestAnimationFrame === 'function') requestAnimationFrame(run); else setTimeout(run, 0);
  });
}
function prependFirstTeamTabs(current){
  if(activeTab !== 'firstTeam') return;
  firstTeamTab = current;
  view.insertAdjacentHTML('afterbegin', firstTeamTabsMarkup(current));
  bindFirstTeamTabs();
}
function renderFirstTeam(){
  if(firstTeamTab === 'squad') return renderSquad();
  if(firstTeamTab === 'physicalReport') return renderFirstTeamPhysicalReport();
  if(firstTeamTab === 'training') return renderTraining();
  if(firstTeamTab === 'playerStats') return renderTeamPlayerStatistics();
  return renderTactics();
}

function marketTabsMarkup(){
  return `<div class="card market-tabs"><div class="subtabs"><button class="${marketSubTab==='free'?'active':''}" data-market-tab="free">Jugadores libres</button><button class="${marketSubTab==='contracted'?'active':''}" data-market-tab="contracted">Jugadores contratados</button><button class="${marketSubTab==='history'?'active':''}" data-market-tab="history">Registro anual</button></div></div>`;
}
function bindMarketTabs(){
  document.querySelectorAll('[data-market-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      marketSubTab = btn.dataset.marketTab || 'free';
      renderMarket();
    });
  });
}

function transferMarketStatusMarkup(){
  if(typeof transferMarketStatusInfo !== 'function') return '';
  const info = transferMarketStatusInfo(game);
  return `<div class="card transfer-market-status ${info.open ? 'open' : 'closed'}"><div><p class="label">Estado de transferencias</p><h3>${escapeHtml(info.title)}</h3><p class="muted small">${escapeHtml(info.detail)}</p></div><span class="pill ${info.open ? 'ok' : 'warn'}">Día ${Number(info.day || 1)}</span></div>`;
}

function playerHasScoutingReport(playerOrId){
  const id = typeof playerOrId === 'object' ? Number(playerOrId?.id || 0) : Number(playerOrId || 0);
  if(!id || !game?.scoutingCenter) return false;
  const state = game.scoutingCenter || {};
  if(Array.isArray(state.listedPlayerIds) && state.listedPlayerIds.map(Number).includes(id)) return true;
  const report = state.reports?.[String(id)];
  const visible = Array.isArray(report?.visibleSkills) ? report.visibleSkills.filter(Boolean) : [];
  return visible.length > 0;
}
function playerScoutingEyeMarkup(playerOrId){
  return playerHasScoutingReport(playerOrId) ? '<span class="scouted-eye" title="Jugador ojeado">👁</span>' : '';
}
function playerNameWithScoutingEye(player){
  const base = typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player?.name || 'Jugador');
  return `${base}${playerScoutingEyeMarkup(player)}`;
}
function marketDiscoveryKey(context='market'){
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game?.matchdayIndex || 0);
  const week = Math.floor(Math.max(0, Number(turn || 0)) / 7);
  return `${context}-${game?.saveCode || 'save'}-${game?.seasonNumber || 1}-w${week}-${game?.selectedClubId || 0}`;
}
function marketLocalCountry(){
  const selected = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId));
  if(!selected) return String(game?.selectedCountry || '').trim();
  return typeof clubCountry === 'function' ? clubCountry(selected) : String(selected.country || selected.pais || game?.selectedCountry || '').trim();
}
function marketIsLocalFreeAgent(player){
  const country = marketLocalCountry().toLowerCase();
  const nat = String(player?.nationality || '').trim().toLowerCase();
  return Boolean(country && nat && nat.includes(country));
}
function marketDiscoveryPool(players, context='free'){
  const all = Array.isArray(players) ? players.filter(Boolean) : [];
  const seen = new Set();
  const scouted = [];
  const addUnique = (list, player) => {
    const id = Number(player?.id || 0);
    if(!id || seen.has(id)) return false;
    seen.add(id);
    list.push(player);
    return true;
  };
  all.filter(playerHasScoutingReport).forEach(player => addUnique(scouted, player));
  const selectedClub = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId));
  const sameDivisionId = String(selectedClub?.divisionId || '');
  const unscouted = all.filter(p => !seen.has(Number(p?.id || 0)));
  const sameLocal = [];
  const other = [];
  unscouted.forEach(player => {
    const isLocal = context === 'contracted'
      ? String(seed?.clubs?.find(c => Number(c.id) === Number(player.clubId || 0))?.divisionId || '') === sameDivisionId
      : marketIsLocalFreeAgent(player);
    (isLocal ? sameLocal : other).push(player);
  });
  const key = marketDiscoveryKey(context);
  const byHash = salt => (a,b) => hashNumber(`${key}-${salt}-${a?.id || 0}`, 1000000) - hashNumber(`${key}-${salt}-${b?.id || 0}`, 1000000);
  sameLocal.sort(byHash('local'));
  other.sort(byHash('other'));
  const picked = [];
  const addPicked = player => addUnique(picked, player);
  const localQuota = 35;
  sameLocal.slice(0, localQuota).forEach(addPicked);
  other.slice(0, Math.max(0, 50 - picked.length)).forEach(addPicked);
  if(picked.length < 50) sameLocal.slice(localQuota).forEach(player => { if(picked.length < 50) addPicked(player); });
  return scouted.concat(picked);
}
function marketDiscoverySummary(total, visiblePool, context='free'){
  const scoutedCount = visiblePool.filter(playerHasScoutingReport).length;
  const extraCount = Math.max(0, visiblePool.length - scoutedCount);
  const localText = context === 'contracted' ? 'priorizando la misma liga/división del manager' : 'priorizando nacionalidad local del país del club';
  return `Mercado reducido: ${scoutedCount} ojeado(s) siempre visibles + ${extraCount} aleatorio(s), ${localText}. Total global disponible: ${total}.`;
}

function contractedMarketPlayers(){
  const all = seed.players
    .filter(p => !p.retired && !p.sold && Number(p.clubId || 0) > 0 && Number(p.clubId) !== Number(game.selectedClubId));
  return marketDiscoveryPool(all, 'contracted')
    .slice()
    .sort((a,b)=>marketScoutedOverallNumber(b)-marketScoutedOverallNumber(a) || visibleOverall(b)-visibleOverall(a) || a.name.localeCompare(b.name,'es'));
}
function contractedMarketAllPlayers(){
  return seed.players
    .filter(p => !p.retired && !p.sold && Number(p.clubId || 0) > 0 && Number(p.clubId) !== Number(game.selectedClubId));
}

function marketPositionOptions(){
  const options = [
    ['all','Todas'],
    ['POR','POR'],
    ['DEF','DEF'],
    ['LD','LD'],
    ['LI','LI'],
    ['DFC','DFC'],
    ['MED','MED'],
    ['MCD','MCD'],
    ['MC','MC'],
    ['MI','MI'],
    ['MD','MD'],
    ['MCO','MCO'],
    ['DEL','DEL'],
    ['ED','ED'],
    ['EI','EI'],
    ['DC','DC']
  ];
  return options.map(([value, label]) => `<option value="${value}" ${marketFilters.position===value?'selected':''}>${label}</option>`).join('');
}
function marketNumberFilterValue(key){
  const value = marketFilters?.[key];
  return value === undefined || value === null ? '' : String(value);
}
function marketPlayerPrice(player){
  return Number(player?.clause || player?.value || 0);
}

function marketOfferClubPrestige(){
  const club = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId));
  const rawPrestige = Number(club?.reputation ?? club?.prestigio ?? club?.prestige ?? 0);
  return clamp(Math.round(Number.isFinite(rawPrestige) ? rawPrestige : 0), 0, 99);
}
function probAceptarOferta(mediaJugador, prestigioClubOfertante){
  const media = Number(mediaJugador || 0);
  const prestige = Number(prestigioClubOfertante || 0);
  const diferencia = media - prestige;
  const puntos = [
    { d:-30, p:95 },
    { d:0, p:80 },
    { d:30, p:20 },
    { d:50, p:3 },
    { d:70, p:1 },
    { d:100, p:0.5 }
  ];
  if(diferencia <= puntos[0].d) return puntos[0].p;
  if(diferencia >= puntos[puntos.length - 1].d) return puntos[puntos.length - 1].p;
  for(let i=0; i<puntos.length - 1; i++){
    const a = puntos[i];
    const b = puntos[i + 1];
    if(diferencia >= a.d && diferencia <= b.d){
      const t = (diferencia - a.d) / (b.d - a.d);
      return a.p + t * (b.p - a.p);
    }
  }
  return 1;
}
function managerPrestigeSigningChanceBonus(){
  // +5 puntos porcentuales cada 10 de prestigio. Máximo +30.
  const prestige = typeof currentManagerPrestige === 'function' ? Number(currentManagerPrestige() || 0) : 0;
  const bonus = Math.max(0, Number.isFinite(prestige) ? prestige * 0.5 : 0);
  return clamp(Math.round(bonus * 10) / 10, 0, 30);
}
function marketPlayerAcceptanceChance(player=null){
  const media = player ? visibleOverall(player) : marketOfferClubPrestige();
  const chance = probAceptarOferta(media, marketOfferClubPrestige());
  const managerPrestigeBonus = managerPrestigeSigningChanceBonus();
  return clamp(Math.round((chance + managerPrestigeBonus) * 10) / 10, 0.5, 99.5);
}
function freeAgentAcceptanceChance(player=null){
  const base = marketPlayerAcceptanceChance(player);
  const bonus = typeof specialActiveBonus === 'function' ? Number(specialActiveBonus('especialista_libres') || 0) : 0;
  return clamp(Math.round((base + bonus) * 10) / 10, 0.5, 99.5);
}
function marketPlayerSigningChanceRevealed(player){
  return Boolean(player && typeof playerHasScoutedSigningChance === 'function' && playerHasScoutedSigningChance(player));
}
function marketAcceptanceLabel(player){
  if(marketPlayerSigningChanceRevealed(player) && typeof scoutingSigningChanceLabel === 'function') return `Prob. fichaje ${scoutingSigningChanceLabel(player)}`;
  return 'Interés oculto';
}
function marketAcceptanceToneClass(player){
  return marketPlayerSigningChanceRevealed(player) ? 'ok' : 'muted';
}
function marketAcceptanceHiddenHint(){
  return 'La probabilidad de fichaje funciona como un dato de ojeo: permanece oculta hasta que el Centro de Ojeo la revele en el informe del jugador.';
}
function marketPlayerRejectionBody(player=null){
  const playerName = player?.name || 'El jugador';
  const club = clubName(game?.selectedClubId);
  const clubPrestige = marketOfferClubPrestige();
  const managerPrestige = typeof currentManagerPrestige === 'function' ? Number(currentManagerPrestige() || 0) : 0;
  const playerLevel = player ? visibleOverall(player) : 0;
  if(managerPrestige > clubPrestige){
    return `${playerName} no le interesa jugar en tu club, y aunque le gusta tu estilo de llevar los equipos, no cree que sea buen momento. Queda bloqueado para tu club hasta la próxima temporada.`;
  }
  if(clubPrestige > playerLevel){
    return `${playerName} no ve con malos ojos jugar en ${club}, pero sí está seguro de que no le interesa ser dirigido por alguien sin ninguna reputación. Queda bloqueado para tu club hasta la próxima temporada.`;
  }
  return `${playerName} no tiene interés en jugar en tu club ni le gusta tu forma de dirigir. Queda bloqueado para tu club hasta la próxima temporada.`;
}
function marketScoutedOverallCell(player){
  if(typeof scoutedOverallLabel === 'function') return scoutedOverallLabel(player);
  return '<span class="muted">—</span>';
}
function marketScoutedOverallNumber(player){
  if(!player) return 0;
  if(typeof playerRequiresScouting === 'function' && !playerRequiresScouting(player)) return visibleOverall(player);
  if(typeof scoutingStatMap !== 'function' || typeof scoutingVisibleKeys !== 'function') return 0;
  const map = scoutingStatMap(player);
  const visible = scoutingVisibleKeys(player);
  const values = Object.entries(map).filter(([key]) => visible.has(key)).map(([,value]) => Number(value || 0)).filter(Number.isFinite);
  return values.length >= 2 ? clamp(Math.round(avg(values)), 1, 99) : 0;
}
function marketScoutedPhysicalCell(player){
  if(typeof scoutedPhysicalLabel === 'function') return scoutedPhysicalLabel(player);
  return '<span class="muted">—</span>';
}
function marketScoutedMoraleCell(player){
  if(typeof scoutedMoraleLabel === 'function') return scoutedMoraleLabel(player);
  return '<span class="muted">—</span>';
}
function marketScoutingHintText(){
  return 'Las estadísticas de jugadores libres y contratados están ocultas. Sólo aparecen habilidades reveladas por el Centro de Ojeo.';
}
function freeAgentOfferRecord(playerId){
  if(!game) return null;
  const key = String(playerId);
  const record = game.rejectedFreeAgentOffers?.[key] || null;
  if(!record) return null;
  if(Number(record.season || 0) !== Number(game.seasonNumber || 1)) return null;
  if(Number(record.clubId || 0) !== Number(game.selectedClubId || 0)) return null;
  return record;
}
function isFreeAgentOfferBlockedThisSeason(playerId){
  return Boolean(freeAgentOfferRecord(playerId));
}
function markFreeAgentOfferRejected(playerId, chance){
  if(!game) return;
  game.rejectedFreeAgentOffers = (game.rejectedFreeAgentOffers && typeof game.rejectedFreeAgentOffers === 'object' && !Array.isArray(game.rejectedFreeAgentOffers)) ? game.rejectedFreeAgentOffers : {};
  game.rejectedFreeAgentOffers[String(playerId)] = {
    playerId:Number(playerId),
    clubId:Number(game.selectedClubId || 0),
    season:Number(game.seasonNumber || 1),
    prestigeChance:Math.round(Number(chance || 0)),
    createdAt:Date.now()
  };
}
function freeAgentOfferButtonLabel(playerId){
  return isFreeAgentOfferBlockedThisSeason(playerId) ? 'Rechazó hasta próxima temp.' : 'Hacer oferta';
}
function marketPlayerMatchesPosition(player){
  const filter = String(marketFilters.position || 'all').toUpperCase();
  if(filter === 'ALL') return true;
  const pos = normalizePlayerPosition(player.position, player.id);
  const group = playerRoleGroup(pos);
  if(filter === 'DEF') return group === 'DEF';
  if(filter === 'MED') return group === 'MID';
  if(filter === 'DEL') return group === 'ATT';
  return pos === filter;
}
function marketPlayerMatchesFilters(player){
  const media = marketScoutedOverallNumber(player);
  const age = Number(player.age || 0);
  const price = marketPlayerPrice(player);
  const minMedia = Number(marketFilters.mediaMin || 0);
  const maxMedia = Number(marketFilters.mediaMax || 0);
  const minAge = Number(marketFilters.ageMin || 0);
  const maxAge = Number(marketFilters.ageMax || 0);
  const maxPrice = Number(marketFilters.priceMax || 0);
  if((minMedia || maxMedia) && !media) return false;
  if(minMedia && media < minMedia) return false;
  if(maxMedia && media > maxMedia) return false;
  if(minAge && age < minAge) return false;
  if(maxAge && age > maxAge) return false;
  if(maxPrice && price > maxPrice) return false;
  if(!marketPlayerMatchesPosition(player)) return false;
  return true;
}
function marketFiltersMarkup(total, shown){
  return `<div class="card market-filters-card">
    <div class="row market-filters-head"><div><p class="label">Buscar coincidencias</p><h3>Filtros de mercado</h3></div><span class="pill">${shown}/${total} jugador(es)</span></div>
    <div class="market-filter-grid">
      <label>Media desde<input data-market-filter="mediaMin" type="number" min="1" max="99" placeholder="Min. scouteada" value="${escapeHtml(marketNumberFilterValue('mediaMin'))}"></label>
      <label>Media hasta<input data-market-filter="mediaMax" type="number" min="1" max="99" placeholder="Max. scouteada" value="${escapeHtml(marketNumberFilterValue('mediaMax'))}"></label>
      <label>Edad desde<input data-market-filter="ageMin" type="number" min="15" max="45" placeholder="Min." value="${escapeHtml(marketNumberFilterValue('ageMin'))}"></label>
      <label>Edad hasta<input data-market-filter="ageMax" type="number" min="15" max="45" placeholder="Max." value="${escapeHtml(marketNumberFilterValue('ageMax'))}"></label>
      <label>Precio hasta<input data-market-filter="priceMax" type="number" min="0" step="100000" placeholder="Máximo" value="${escapeHtml(marketNumberFilterValue('priceMax'))}"></label>
      <label>Posición<select data-market-filter="position">${marketPositionOptions()}</select></label>
      <button id="clearMarketFilters" class="ghost" type="button">Limpiar filtros</button>
    </div>
  </div>`;
}
function bindMarketFilters(){
  document.querySelectorAll('[data-market-filter]').forEach(input => {
    input.addEventListener('change', () => {
      const key = input.dataset.marketFilter;
      if(!key) return;
      marketFilters[key] = input.value || (key === 'position' ? 'all' : '');
      marketVisibleLimit = 20;
      renderMarket();
    });
  });
  $('clearMarketFilters')?.addEventListener('click', () => {
    marketFilters = { mediaMin:'', mediaMax:'', ageMin:'', ageMax:'', priceMax:'', position:'all' };
    marketVisibleLimit = 20;
    renderMarket();
  });
}
function marketVisiblePlayers(players){
  const limit = Math.max(20, Number(marketVisibleLimit || 20));
  return players.slice(0, limit);
}
function marketMoreButtonMarkup(total, shown){
  if(shown >= total) return '';
  return `<div class="row market-more-row"><button id="marketLoadMoreBtn" class="ghost" type="button">Ver más</button><span class="small muted">Mostrando ${shown} de ${total}. Se agregan 20 jugadores por vez.</span></div>`;
}
function bindMarketMoreButton(){
  $('marketLoadMoreBtn')?.addEventListener('click', () => {
    marketVisibleLimit = Math.max(20, Number(marketVisibleLimit || 20)) + 20;
    renderMarket();
  });
}
function renderMarket(){
  mergeMarketPlayersIntoSeed(game.marketPlayers || []);
  ensurePlayerStateForAll();
  if(!['free','contracted','history'].includes(marketSubTab)) marketSubTab = 'free';
  if(marketSubTab === 'history' && typeof renderTransferHistoryMarket === 'function') return renderTransferHistoryMarket();
  if(marketSubTab === 'contracted') return renderContractedMarket();
  const freeAll = (game.marketPlayers || []).filter(p => Number(p.clubId || 0) === 0 && !p.sold);
  const freeBase = marketDiscoveryPool(freeAll, 'free').slice().sort((a,b)=>marketScoutedOverallNumber(b)-marketScoutedOverallNumber(a) || visibleOverall(b)-visibleOverall(a));
  const freeFiltered = freeBase.filter(marketPlayerMatchesFilters);
  const free = marketVisiblePlayers(freeFiltered);
  const rows = free.map(p => `<tr>
    <td>${faceImg(p, 'photo-thumb')}</td>
    <td><button class="linklike" data-player-id="${p.id}"><strong>${playerNameWithScoutingEye(p)}</strong></button></td>
    <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
    <td>${Number(p.age || 0) || '—'}</td>
    <td>${nationalityShortMarkup(p.nationality)}</td>
    <td>${marketScoutedOverallCell(p)}</td>
    <td>${marketScoutedPhysicalCell(p)}</td>
    <td>${marketScoutedMoraleCell(p)}</td>
    <td>${formatMoney(marketPlayerPrice(p))}</td>
    <td>${formatMoney(p.salary || 0)}</td>
    <td><button class="primary small-btn" data-hire-free-agent="${p.id}" ${isFreeAgentOfferBlockedThisSeason(p.id) ? 'disabled' : ''}>${escapeHtml(freeAgentOfferButtonLabel(p.id))}</button><br><span class="small ${marketAcceptanceToneClass(p)}">${marketAcceptanceLabel(p)}</span></td>
  </tr>`).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Mercado</h2><p class="tagline">Jugadores libres y jugadores contratados disponibles para negociar.</p></div>
    ${marketTabsMarkup()}
    ${transferMarketStatusMarkup()}
    ${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}
    ${marketFiltersMarkup(freeBase.length, freeFiltered.length)}
    <div class="market-limit-note small muted">${marketDiscoverySummary(freeAll.length, freeBase, 'free')} Se muestran ${free.length} jugador(es) que coinciden con el filtro. ${marketScoutingHintText()} ${marketAcceptanceHiddenHint()}</div>
    <div class="table-wrap"><table><thead><tr><th>Foto</th><th>Jugador</th><th>Rol</th><th>Edad</th><th>Nac.</th><th>Media scouteada</th><th>Físico</th><th>Moral</th><th>Valor</th><th>Sueldo</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="muted">No hay jugadores libres que coincidan con los filtros.</td></tr>'}</tbody></table></div>
    ${marketMoreButtonMarkup(freeFiltered.length, free.length)}`;
  bindMarketTabs();
  bindMarketFilters();
  bindMarketMoreButton();
  document.querySelectorAll('[data-hire-free-agent]').forEach(btn => btn.addEventListener('click', () => hireFreeAgent(Number(btn.dataset.hireFreeAgent))));
}
function renderContractedMarket(){
  const allContractedPlayers = contractedMarketAllPlayers();
  const basePlayers = contractedMarketPlayers();
  const filteredPlayers = basePlayers.filter(marketPlayerMatchesFilters);
  const players = marketVisiblePlayers(filteredPlayers);
  const rows = players.map(p => {
    const agreed = typeof hasActivePendingTransferForPlayer === 'function' && hasActivePendingTransferForPlayer(p.id);
    const blocked = agreed || (typeof isPurchaseOfferBlockedThisSeason === 'function' && isPurchaseOfferBlockedThisSeason(p.id));
    const label = agreed ? 'Transferencia acordada' : (blocked ? 'Rechazada hasta próxima temp.' : 'Hacer oferta');
    return `<tr>
    <td>${faceImg(p, 'photo-thumb')}</td>
    <td><button class="linklike" data-player-id="${p.id}"><strong>${playerNameWithScoutingEye(p)}</strong></button></td>
    <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
    <td>${Number(p.age || 0) || '—'}</td>
    <td>${nationalityShortMarkup(p.nationality)}</td>
    <td>${clubBadge(p.clubId)} ${escapeHtml(clubName(p.clubId))}</td>
    <td>${marketScoutedOverallCell(p)}</td>
    <td>${formatMoney(p.clause || p.value || 0)}</td>
    <td>${formatMoney(p.salary || 0)}</td>
    <td><span class="small ${marketAcceptanceToneClass(p)}">${marketAcceptanceLabel(p)}</span></td>
    <td><button class="primary small-btn" data-make-player-offer="${p.id}" ${blocked ? 'disabled' : ''}>${escapeHtml(label)}</button></td>
  </tr>`;
  }).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Mercado</h2><p class="tagline">Jugadores de otros clubes. Podés iniciar una negociación desde esta pestaña.</p></div>
    ${marketTabsMarkup()}
    ${transferMarketStatusMarkup()}
    ${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}
    ${marketFiltersMarkup(basePlayers.length, filteredPlayers.length)}
    <div class="market-limit-note small muted">${marketDiscoverySummary(allContractedPlayers.length, basePlayers, 'contracted')} Se muestran ${players.length} jugador(es) que coinciden con el filtro. ${marketScoutingHintText()}</div>
    <div class="table-wrap"><table><thead><tr><th>Foto</th><th>Jugador</th><th>Rol</th><th>Edad</th><th>Nac.</th><th>Equipo</th><th>Media scouteada</th><th>Cláusula</th><th>Sueldo</th><th>Aceptación</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="muted">No hay jugadores contratados que coincidan con los filtros.</td></tr>'}</tbody></table></div>
    ${marketMoreButtonMarkup(filteredPlayers.length, players.length)}`;
  bindMarketTabs();
  bindMarketFilters();
  bindMarketMoreButton();
  document.querySelectorAll('[data-make-player-offer]').forEach(btn => btn.addEventListener('click', () => openPurchaseOfferModal(Number(btn.dataset.makePlayerOffer))));
}

function hireFreeAgent(playerId){
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){ showNotice('No podés contratar jugadores mientras estás sin club.'); return; }
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('players')){ showNotice(managerChallengeBlockedMessage('players')); return; }
  const idx = (game.marketPlayers || []).findIndex(p => Number(p.id) === Number(playerId) && Number(p.clubId || 0) === 0 && !p.sold);
  if(idx < 0) return;
  if(isFreeAgentOfferBlockedThisSeason(playerId)){ showNotice('El jugador ya rechazó una oferta de este club. Podrás volver a intentar la próxima temporada.'); return; }
  if(!hasFirstTeamRosterSpace(game.selectedClubId, 1)){ showRosterLimitNotice(); return; }
  const chance = freeAgentAcceptanceChance(game.marketPlayers[idx]);
  const roll = Math.random() * 100;
  if(roll >= chance){
    const rejected = game.marketPlayers[idx];
    markFreeAgentOfferRejected(playerId, chance);
    pushGameMessage({ type:'mercado', title:'Libre rechazó la oferta', body:marketPlayerRejectionBody(rejected), priority:'normal' });
    saveLocal(true);
    showNotice(`${rejected?.name || 'Jugador'} rechazó la oferta.`);
    renderMarket();
    return;
  }
  game.marketPlayers[idx].clubId = game.selectedClubId;
  if(typeof invalidatePlayerIndexes === 'function') invalidatePlayerIndexes();
  game.marketPlayers[idx].freeAgent = false;
  game.marketPlayers[idx].transferListed = false;
  game.marketPlayers[idx].intransferible = false;
  mergeMarketPlayersIntoSeed(game.marketPlayers);
  const player = playerById(playerId);
  if(player){
    if(typeof syncPlayerOwnershipReferences === 'function'){
      syncPlayerOwnershipReferences(player, game.selectedClubId, { state:game, source:'manager_free_agent', freeAgent:false, sold:false, transferListed:false, intransferible:false, forceRevision:true });
    }else{
      setPlayerClubId(player, game.selectedClubId, { source:'manager_free_agent', forceRevision:true });
      player.freeAgent = false;
      player.transferListed = false;
      player.intransferible = false;
    }
    player.salaryPaidCount = 0;
    player.lastSalaryPaidSeason = 0;
    refreshPlayerClause(player);
  }
  game.marketPlayers[idx].salaryPaidCount = 0;
  game.marketPlayers[idx].lastSalaryPaidSeason = 0;
  refreshPlayerClause(game.marketPlayers[idx]);
  game.playerCondition[playerId] = clamp(game.playerCondition[playerId] || (15 + hashNumber(`free-cond-${playerId}`, 15)), 1, 29);
  if(!Number.isFinite(game.playerMorale[playerId])) game.playerMorale[playerId] = 35 + hashNumber(`free-morale-${playerId}`, 55);
  ensurePlayerStateForAll();
  if(typeof syncPlayerStarsWithClubs === 'function') syncPlayerStarsWithClubs(game);
  if(typeof recordTransferHistory === 'function') recordTransferHistory(player || game.marketPlayers[idx], { fromClubId:0, toClubId:Number(game.selectedClubId || 0), amount:0, kind:'free_signing', source:'manager_free_agent' });
  const cohesionChange = typeof adjustTeamCohesion === 'function' ? adjustTeamCohesion(game.selectedClubId, -TEAM_COHESION_SIGNING_LOSS) : 0;
  const cohesionText = cohesionChange ? ` Cohesión ${cohesionChange > 0 ? '+' : ''}${cohesionChange}.` : '';
  pushGameMessage({ type:'mercado', title:'Jugador libre contratado', body:`${player?.name || 'El jugador'} aceptó la oferta y se incorporó al plantel como agente libre.${cohesionText}`, priority:'normal' });
  saveLocal(true);
  showNotice(`${player?.name || 'Jugador'} contratado.${cohesionText}`);
  renderMarket();
}

const PLAYER_VISIBLE_SKILL_COLUMNS = ['Ataque/Salto','Defensa','Pase','Velocidad/Reflejos','Cabezazo/Mando','Tiro/Potencia','Resistencia'];

function playerStatValue(playerId, key){
  const stat = game?.playerStats?.[playerId] || {};
  const value = Math.max(0, Math.round(Number(stat?.[key] || 0)));
  return Number.isFinite(value) ? value : 0;
}

function squadAvailabilityIconMarkup(playerId){
  if(isSuspended(playerId)) return '<span class="squad-status-icon squad-status-suspended" title="Suspendido" aria-label="Suspendido">■</span>';
  if(isInjured(playerId)) return '<span class="squad-status-icon squad-status-injured" title="Lesionado" aria-label="Lesionado">✚</span>';
  return '<span class="squad-status-icon squad-status-available" title="Disponible" aria-label="Disponible">✓</span>';
}

function playerVisibleSkillValue(player, key){
  const cleanKey = PLAYER_VISIBLE_SKILL_COLUMNS.includes(key) ? key : 'Resistencia';
  if(typeof scoutingStatMap === 'function'){
    const map = scoutingStatMap(player);
    const value = Number(map?.[cleanKey]);
    return Number.isFinite(value) ? value : 0;
  }
  const stats = visibleStats(player);
  const fallback = {
    'Ataque/Salto': player?.position === 'POR' ? stats.Salto : stats.Ataque,
    'Defensa': stats.Defensa,
    'Pase': stats.Pase,
    'Velocidad/Reflejos': player?.position === 'POR' ? stats.Reflejos : stats.Velocidad,
    'Cabezazo/Mando': player?.position === 'POR' ? stats.Mando : stats.Cabezazo,
    'Tiro/Potencia': player?.position === 'POR' ? stats.Potencia : stats.Tiro,
    'Resistencia': stats.Resistencia
  };
  const value = Number(fallback[cleanKey]);
  return Number.isFinite(value) ? value : 0;
}

function sortPlayersForView(players, sortKey){
  const byName = (a,b) => a.name.localeCompare(b.name, 'es');
  const byNameDesc = (a,b) => b.name.localeCompare(a.name, 'es');
  const byNationality = (a,b) => a.nationality.localeCompare(b.nationality, 'es') || byName(a,b);
  const byNationalityDesc = (a,b) => b.nationality.localeCompare(a.nationality, 'es') || byName(a,b);
  const byValueAsc = (a,b) => (a.value || 0) - (b.value || 0) || byName(a,b);
  const byValueDesc = (a,b) => (b.value || 0) - (a.value || 0) || byName(a,b);
  const byAgeAsc = (a,b) => Number(a.age || 0) - Number(b.age || 0) || byName(a,b);
  const byAgeDesc = (a,b) => Number(b.age || 0) - Number(a.age || 0) || byName(a,b);
  const byDorsalAsc = (a,b) => jerseyNumber(a.id) - jerseyNumber(b.id) || byName(a,b);
  const byDorsalDesc = (a,b) => jerseyNumber(b.id) - jerseyNumber(a.id) || byName(a,b);
  const positionRank = (player) => {
    const group = playerRoleGroup(player.position);
    return { POR:1, DEF:2, MID:3, ATT:4 }[group] || 99;
  };
  const positionVariantRank = (player) => {
    const pos = normalizePlayerPosition(player.position, player.id);
    const order = { POR:1, LD:2, LI:3, DFC:4, MCD:5, MC:6, MI:7, MD:8, MCO:9, ED:10, EI:11, DC:12 };
    return order[pos] || 99;
  };
  const byPositionAsc = (a,b) => positionRank(a) - positionRank(b) || positionVariantRank(a) - positionVariantRank(b) || visibleOverall(b) - visibleOverall(a) || byName(a,b);
  const byPositionDesc = (a,b) => positionRank(b) - positionRank(a) || positionVariantRank(a) - positionVariantRank(b) || visibleOverall(b) - visibleOverall(a) || byName(a,b);
  const byStatusAvailable = (a,b) => Number(isUnavailable(a.id)) - Number(isUnavailable(b.id)) || byName(a,b);
  const byStatusUnavailable = (a,b) => Number(isUnavailable(b.id)) - Number(isUnavailable(a.id)) || byName(a,b);
  const sorters = {
    nombre_asc:byName,
    nombre_desc:byNameDesc,
    dorsal_asc:byDorsalAsc,
    dorsal_desc:byDorsalDesc,
    posicion_asc:byPositionAsc,
    posicion_desc:byPositionDesc,
    media_desc:(a,b)=>visibleOverall(b)-visibleOverall(a) || byName(a,b),
    media_asc:(a,b)=>visibleOverall(a)-visibleOverall(b) || byName(a,b),
    condicion_desc:(a,b)=>currentCondition(b.id)-currentCondition(a.id) || byName(a,b),
    condicion_asc:(a,b)=>currentCondition(a.id)-currentCondition(b.id) || byName(a,b),
    moral_desc:(a,b)=>currentMorale(b.id)-currentMorale(a.id) || byName(a,b),
    moral_asc:(a,b)=>currentMorale(a.id)-currentMorale(b.id) || byName(a,b),
    played_desc:(a,b)=>playerStatValue(b.id, 'played')-playerStatValue(a.id, 'played') || byName(a,b),
    played_asc:(a,b)=>playerStatValue(a.id, 'played')-playerStatValue(b.id, 'played') || byName(a,b),
    goals_desc:(a,b)=>playerStatValue(b.id, 'goals')-playerStatValue(a.id, 'goals') || byName(a,b),
    goals_asc:(a,b)=>playerStatValue(a.id, 'goals')-playerStatValue(b.id, 'goals') || byName(a,b),
    assists_desc:(a,b)=>playerStatValue(b.id, 'assists')-playerStatValue(a.id, 'assists') || byName(a,b),
    assists_asc:(a,b)=>playerStatValue(a.id, 'assists')-playerStatValue(b.id, 'assists') || byName(a,b),
    risk_desc:(a,b)=>firstTeamInjuryRiskScore(b)-firstTeamInjuryRiskScore(a) || currentCondition(a.id)-currentCondition(b.id) || byName(a,b),
    risk_asc:(a,b)=>firstTeamInjuryRiskScore(a)-firstTeamInjuryRiskScore(b) || currentCondition(b.id)-currentCondition(a.id) || byName(a,b),
    habilidad_desc:(a,b)=>playerVisibleSkillValue(b, squadSkillSortKey)-playerVisibleSkillValue(a, squadSkillSortKey) || byName(a,b),
    habilidad_asc:(a,b)=>playerVisibleSkillValue(a, squadSkillSortKey)-playerVisibleSkillValue(b, squadSkillSortKey) || byName(a,b),
    resistencia_desc:(a,b)=>playerVisibleSkillValue(b, 'Resistencia')-playerVisibleSkillValue(a, 'Resistencia') || byName(a,b),
    resistencia_asc:(a,b)=>playerVisibleSkillValue(a, 'Resistencia')-playerVisibleSkillValue(b, 'Resistencia') || byName(a,b),
    estado_disponible:byStatusAvailable,
    estado_no_disponible:byStatusUnavailable,
    valor_asc:byValueAsc,
    valor_desc:byValueDesc,
    edad_asc:byAgeAsc,
    edad_desc:byAgeDesc,
    nacionalidad_asc:byNationality,
    nacionalidad_desc:byNationalityDesc
  };
  return players.slice().sort(sorters[sortKey] || sorters.media_desc);
}
function sortedSquadPlayers(){
  return sortPlayersForView(playersByClub(game.selectedClubId), squadSort);
}
function sortedTrainingPlayers(){
  return sortPlayersForView(playersByClub(game.selectedClubId), trainingSort);
}
function sortOptionByDirection(options, direction){
  const suffix = direction === 'asc' ? '_asc' : '_desc';
  const exact = options.find(([value]) => String(value).endsWith(suffix));
  if(exact) return exact;
  return direction === 'asc' ? options[0] : (options[1] || options[0]);
}
function compactSortButtons(label, options, activeValue, attrName){
  const asc = sortOptionByDirection(options, 'asc');
  const desc = sortOptionByDirection(options, 'desc');
  const button = (item, symbol, title) => {
    if(!item) return '';
    const [value, text] = item;
    const active = activeValue === value ? ' active' : '';
    return `<button type="button" class="sort-arrow${active}" ${attrName}="${value}" title="${escapeHtml(title || text)}" aria-label="${escapeHtml(title || text)}">${symbol}</button>`;
  };
  return `<div class="th-filter compact-sort"><span>${label}</span><div class="sort-arrows">${button(asc, '↑', asc?.[1])}${button(desc, '↓', desc?.[1])}</div></div>`;
}
function columnSort(label, options){
  return compactSortButtons(label, options, squadSort, 'data-squad-sort');
}

function trainingColumnSort(label, options){
  return compactSortButtons(label, options, trainingSort, 'data-training-sort');
}
function squadSkillOptionsMarkup(){
  return PLAYER_VISIBLE_SKILL_COLUMNS.map(key => `<option value="${escapeHtml(key)}" ${squadSkillSortKey===key?'selected':''}>${escapeHtml(key)}</option>`).join('');
}
function skillColumnSort(label){
  return `<div class="th-filter compact-sort skill-sort"><span>${label}</span><select class="skill-sort-select" data-squad-skill-sort>${squadSkillOptionsMarkup()}</select><div class="sort-arrows"><button type="button" class="sort-arrow${squadSort==='habilidad_asc'?' active':''}" data-squad-sort="habilidad_asc" title="Menor a mayor" aria-label="Ordenar habilidad de menor a mayor">↑</button><button type="button" class="sort-arrow${squadSort==='habilidad_desc'?' active':''}" data-squad-sort="habilidad_desc" title="Mayor a menor" aria-label="Ordenar habilidad de mayor a menor">↓</button></div></div>`;
}


function firstTeamStatHeaderIconMarkup(type){
  if(type === 'goals'){
    return '<span class="first-team-stat-header-icon first-team-stat-header-goals" role="img" aria-label="Goles" title="Goles">⚽</span>';
  }
  return `<span class="first-team-stat-header-icon first-team-stat-header-assists" role="img" aria-label="Asistencias" title="Asistencias">
    <svg viewBox="0 0 28 20" aria-hidden="true" focusable="false">
      <path d="M3 13.2c1.9.1 3.7-.3 5.2-1.2 1.7-1 2.9-2.6 3.7-4.8l1.2-3.3 3.5 1.3-.8 2.4 6.8 3.4c1.5.8 2.4 2.3 2.4 4v1.2H3v-3z"></path>
      <path d="M7.2 16.2h17.7v1.9H5.1c-1.2 0-2.1-.8-2.1-1.9h4.2z"></path>
      <path d="M14.7 7.9l2.4 1.2M12.8 10l2.4 1.2" class="boot-laces"></path>
    </svg>
  </span>`;
}

function firstTeamInjuryRiskScore(player){
  if(!player) return 0;
  const playerId = Number(player.id || 0);
  let genetics = 50;
  try{
    const hidden = typeof hiddenStats === 'function' ? hiddenStats(player) : null;
    const value = Number(hidden?.genetics);
    if(Number.isFinite(value)) genetics = clamp(value, 1, 99);
  }catch(_){ /* cálculo orientativo con valor neutral */ }
  const condition = clamp(Number(typeof currentCondition === 'function' ? currentCondition(playerId) : 99) || 0, 0, 99);
  const played = Math.max(0, Number(typeof playerStatValue === 'function' ? playerStatValue(playerId, 'played') : 0) || 0);
  const reference = Math.max(1, Number(typeof HIGH_PARTICIPATION_REFERENCE_MATCHES !== 'undefined' ? HIGH_PARTICIPATION_REFERENCE_MATCHES : 34) || 34);
  const geneticRisk = clamp((99 - genetics) / 98 * 100, 0, 100);
  const physicalRisk = clamp((99 - condition) / 99 * 100, 0, 100);
  const participationRatio = played / reference;
  let participationRisk = 0;
  if(participationRatio <= 0.45) participationRisk = participationRatio / 0.45 * 25;
  else if(participationRatio <= 0.80) participationRisk = 25 + ((participationRatio - 0.45) / 0.35) * 35;
  else participationRisk = 60 + clamp((participationRatio - 0.80) / 0.40, 0, 1) * 40;
  let score = geneticRisk * 0.35 + physicalRisk * 0.45 + participationRisk * 0.20;
  if(typeof isInjured === 'function' && isInjured(playerId)) score = Math.max(score, 88);
  return clamp(Math.round(score), 0, 100);
}

function firstTeamInjuryRiskInfo(player){
  const score = firstTeamInjuryRiskScore(player);
  if(score < 20) return { score, label:'Muy bajo', className:'very-low' };
  if(score < 38) return { score, label:'Bajo', className:'low' };
  if(score < 58) return { score, label:'Normal', className:'normal' };
  if(score < 76) return { score, label:'Alto', className:'high' };
  return { score, label:'Muy alto', className:'very-high' };
}

function firstTeamInjuryRiskMarkup(player){
  const info = firstTeamInjuryRiskInfo(player);
  const injured = typeof isInjured === 'function' && isInjured(player.id);
  const title = injured
    ? 'El jugador está lesionado. La estimación combina genética interna, estado físico y participación acumulada.'
    : 'Estimación orientativa según genética interna, estado físico actual y partidos jugados.';
  return `<span class="injury-risk-badge injury-risk-${info.className}" title="${escapeHtml(title)}">${escapeHtml(info.label)}</span>`;
}

function firstTeamPhysicalColumnSort(label, options){
  return compactSortButtons(label, options, firstTeamPhysicalReportSort, 'data-physical-report-sort');
}

function renderFirstTeamPhysicalReport(){
  const players = sortPlayersForView(playersByClub(game.selectedClubId), firstTeamPhysicalReportSort);
  const goalIcon = firstTeamStatHeaderIconMarkup('goals');
  const assistIcon = firstTeamStatHeaderIconMarkup('assists');
  const rows = players.map(player => `
    <tr class="${isUnavailable(player.id) ? 'dim-row' : ''}">
      <td><button class="linklike" data-player-id="${player.id}"><strong>${playerNameWithScoutingEye(player)}</strong></button></td>
      <td><strong>${visibleOverall(player)}</strong></td>
      <td>${Number(player.age || 0) || '—'}</td>
      <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
      <td><strong>${playerStatValue(player.id, 'played')}</strong></td>
      <td><strong>${playerStatValue(player.id, 'goals')}</strong></td>
      <td><strong>${playerStatValue(player.id, 'assists')}</strong></td>
      <td>${conditionBar(player.id)}</td>
      <td>${firstTeamInjuryRiskMarkup(player)}</td>
    </tr>`).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Informe físico del plantel</h2><p class="tagline">Resumen para planificar rotaciones y cargas. El riesgo de lesión es orientativo y no representa una probabilidad exacta.</p></div>
    <div class="table-wrap first-team-physical-table-wrap"><table class="first-team-physical-table"><thead><tr>
      <th>${firstTeamPhysicalColumnSort('Jugador', [['nombre_asc','A-Z'],['nombre_desc','Z-A']])}</th>
      <th>${firstTeamPhysicalColumnSort('Media', [['media_desc','Mayor a menor'],['media_asc','Menor a mayor']])}</th>
      <th>${firstTeamPhysicalColumnSort('Edad', [['edad_asc','Menor a mayor'],['edad_desc','Mayor a menor']])}</th>
      <th>${firstTeamPhysicalColumnSort('POS', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th>
      <th>${firstTeamPhysicalColumnSort('PJ', [['played_desc','Mayor a menor'],['played_asc','Menor a mayor']])}</th>
      <th>${firstTeamPhysicalColumnSort(goalIcon, [['goals_desc','Más goles'],['goals_asc','Menos goles']])}</th>
      <th>${firstTeamPhysicalColumnSort(assistIcon, [['assists_desc','Más asistencias'],['assists_asc','Menos asistencias']])}</th>
      <th>${firstTeamPhysicalColumnSort('Estado físico', [['condicion_desc','Mayor a menor'],['condicion_asc','Menor a mayor']])}</th>
      <th>${firstTeamPhysicalColumnSort('Riesgo de lesión', [['risk_desc','Mayor riesgo'],['risk_asc','Menor riesgo']])}</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted">No hay jugadores en el plantel.</td></tr>'}</tbody></table></div>
    <div class="card inner first-team-physical-note"><p class="muted small">La estimación combina la genética interna del jugador, su estado físico actual y la participación acumulada en la temporada. Los valores se muestran como Muy bajo, Bajo, Normal, Alto o Muy alto.</p></div>
  `;
  prependFirstTeamTabs('physicalReport');
  document.querySelectorAll('[data-physical-report-sort]').forEach(button => {
    button.addEventListener('click', () => {
      if(button.dataset.physicalReportSort){
        firstTeamPhysicalReportSort = button.dataset.physicalReportSort;
        renderFirstTeamPhysicalReport();
      }
    });
  });
}


function teamPlayerStatsAverage(entry){
  const rated = Math.max(0, Number(entry?.ratedMatches || 0));
  return rated > 0 ? Number(entry.ratingTotal || 0) / rated : null;
}
function teamPlayerStatsSeasonOptions(state){
  return Object.values(state?.seasons || {}).sort((a,b)=>Number(b.seasonNumber || 0)-Number(a.seasonNumber || 0));
}
function teamPlayerStatsSortedEntries(entries){
  const list = entries.slice();
  const byName = (a,b)=>String(a.name || '').localeCompare(String(b.name || ''), 'es');
  const sorters = {
    rating_desc:(a,b)=>(teamPlayerStatsAverage(b) ?? -1)-(teamPlayerStatsAverage(a) ?? -1) || Number(b.played||0)-Number(a.played||0) || byName(a,b),
    played_desc:(a,b)=>Number(b.played||0)-Number(a.played||0) || byName(a,b),
    goals_desc:(a,b)=>Number(b.goals||0)-Number(a.goals||0) || byName(a,b),
    assists_desc:(a,b)=>Number(b.assists||0)-Number(a.assists||0) || byName(a,b),
    cards_desc:(a,b)=>(Number(b.red||0)*3+Number(b.yellow||0))-(Number(a.red||0)*3+Number(a.yellow||0)) || byName(a,b),
    injuries_desc:(a,b)=>Number(b.injuries||0)-Number(a.injuries||0) || byName(a,b),
    name_asc:byName
  };
  return list.sort(sorters[teamPlayerStatsSort] || sorters.rating_desc);
}
function renderTeamPlayerStatistics(){
  const state = managerPlayerStatsHistoryState();
  const currentSeason = Number(game?.seasonNumber || 1);
  const currentClub = Number(game?.selectedClubId || 0);
  const currentRecord = syncManagerPlayerStatsClubFromHistory(currentClub, currentSeason);
  ensureManagerPlayerStatsRoster(currentRecord, currentClub);
  const seasons = teamPlayerStatsSeasonOptions(state);
  if(!seasons.some(item => String(item.seasonNumber) === String(teamPlayerStatsSeasonSelection))){
    teamPlayerStatsSeasonSelection = String(currentSeason);
  }
  const season = state.seasons[String(teamPlayerStatsSeasonSelection)] || seasons[0] || managerPlayerStatsSeasonRecord(currentSeason, true);
  const clubs = Object.values(season?.clubs || {}).sort((a,b)=>String(a.clubName || '').localeCompare(String(b.clubName || ''), 'es'));
  const preferredClub = String(season?.seasonNumber) === String(currentSeason) && clubs.some(item => Number(item.clubId) === currentClub) ? String(currentClub) : String(clubs[0]?.clubId || '');
  if(!clubs.some(item => String(item.clubId) === String(teamPlayerStatsClubSelection))) teamPlayerStatsClubSelection = preferredClub;
  const clubRecord = season?.clubs?.[String(teamPlayerStatsClubSelection)] || clubs[0] || null;
  if(clubRecord && Number(season?.seasonNumber) === currentSeason && Number(clubRecord.clubId) === currentClub) ensureManagerPlayerStatsRoster(clubRecord, currentClub);
  const entries = clubRecord ? teamPlayerStatsSortedEntries(Object.values(clubRecord.players || {})) : [];
  const rows = entries.map(entry => {
    const player = playerById(entry.playerId);
    const avg = teamPlayerStatsAverage(entry);
    const rating = avg === null ? '<span class="muted">—</span>' : `<span class="team-player-rating ${avg >= 7.2 ? 'ok' : avg >= 6 ? 'warn' : 'bad'}">${avg.toFixed(2).replace('.', ',')}</span>`;
    return `<tr>
      <td>${player ? faceImg(player, 'photo-thumb') : '<span class="photo-thumb">?</span>'}</td>
      <td><button class="linklike" data-player-id="${entry.playerId}"><strong>${escapeHtml(entry.name || player?.name || 'Jugador')}</strong></button></td>
      <td><span class="pill role-pill">${escapeHtml(entry.position || player?.position || '—')}</span></td>
      <td><strong>${Number(entry.played || 0)}</strong></td>
      <td>${Number(entry.goals || 0)}</td>
      <td>${Number(entry.assists || 0)}</td>
      <td>${Number(entry.injuries || 0)}</td>
      <td><span class="yellow-card">■</span> ${Number(entry.yellow || 0)}</td>
      <td><span class="red-card">■</span> ${Number(entry.red || 0)}</td>
      <td>${rating}</td>
    </tr>`;
  }).join('');
  const totals = entries.reduce((acc, entry) => {
    acc.played += Number(entry.played || 0); acc.goals += Number(entry.goals || 0); acc.assists += Number(entry.assists || 0); acc.injuries += Number(entry.injuries || 0); return acc;
  }, { played:0, goals:0, assists:0, injuries:0 });
  const seasonOptions = seasons.map(item => `<option value="${item.seasonNumber}" ${String(item.seasonNumber)===String(season?.seasonNumber)?'selected':''}>${Number(item.year || seasonYearForNumber(item.seasonNumber))} · Temporada ${item.seasonNumber}</option>`).join('');
  const clubOptions = clubs.map(item => `<option value="${item.clubId}" ${String(item.clubId)===String(clubRecord?.clubId)?'selected':''}>${escapeHtml(item.clubName || clubName(item.clubId))}</option>`).join('');
  view.innerHTML = `
    <div class="row section-title"><div><h2>Estadísticas del plantel</h2><p class="tagline">Rendimiento individual por temporada. El puntaje promedio utiliza la calificación final de cada partido disputado.</p></div></div>
    <div class="card team-player-stats-toolbar">
      <label><span>Año</span><select id="teamPlayerStatsSeason">${seasonOptions}</select></label>
      <label><span>Club</span><select id="teamPlayerStatsClub" ${clubs.length <= 1 ? 'disabled' : ''}>${clubOptions}</select></label>
      <label><span>Ordenar</span><select id="teamPlayerStatsSort">
        <option value="rating_desc" ${teamPlayerStatsSort==='rating_desc'?'selected':''}>Puntaje promedio</option>
        <option value="played_desc" ${teamPlayerStatsSort==='played_desc'?'selected':''}>Partidos jugados</option>
        <option value="goals_desc" ${teamPlayerStatsSort==='goals_desc'?'selected':''}>Goles</option>
        <option value="assists_desc" ${teamPlayerStatsSort==='assists_desc'?'selected':''}>Asistencias</option>
        <option value="injuries_desc" ${teamPlayerStatsSort==='injuries_desc'?'selected':''}>Lesiones</option>
        <option value="cards_desc" ${teamPlayerStatsSort==='cards_desc'?'selected':''}>Tarjetas</option>
        <option value="name_asc" ${teamPlayerStatsSort==='name_asc'?'selected':''}>Nombre</option>
      </select></label>
    </div>
    <div class="grid cols-4 team-player-stats-summary">
      <div class="card"><p class="label">Club</p><strong>${clubRecord ? `${clubBadge(clubRecord.clubId)} ${escapeHtml(clubRecord.clubName)}` : '—'}</strong><span class="small muted">${escapeHtml(clubRecord?.divisionName || 'Sin datos')}</span></div>
      <div class="card"><p class="label">Año</p><strong>${Number(season?.year || seasonYearForNumber(season?.seasonNumber || currentSeason))}</strong><span class="small muted">Temporada ${Number(season?.seasonNumber || currentSeason)}</span></div>
      <div class="card"><p class="label">Producción</p><strong>${totals.goals} G · ${totals.assists} A</strong><span class="small muted">Suma del plantel registrado</span></div>
      <div class="card"><p class="label">Estado</p><strong>${clubRecord?.archived ? 'Temporada guardada' : 'En curso'}</strong><span class="small muted">${clubRecord?.completedDate ? escapeHtml(clubRecord.completedDate) : `${entries.length} jugadores`}</span></div>
    </div>
    <div class="table-wrap team-player-stats-table-wrap"><table class="team-player-stats-table"><thead><tr><th>Foto</th><th>Jugador</th><th>POS</th><th>PJ</th><th>Goles</th><th>Asist.</th><th>Lesiones</th><th>Amarillas</th><th>Rojas</th><th>Puntaje promedio</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="muted">Todavía no hay estadísticas registradas para esta temporada.</td></tr>'}</tbody></table></div>
    <div class="card inner team-player-stats-note"><p class="muted small">Las temporadas anteriores quedan archivadas con su año. Si una carrera existente comenzó antes de V7.58, la temporada actual se reconstruye desde el historial de partidos disponible; temporadas anteriores sin historial guardado no pueden recuperarse.</p></div>
  `;
  prependFirstTeamTabs('playerStats');
  $('teamPlayerStatsSeason')?.addEventListener('change', event => { teamPlayerStatsSeasonSelection = event.target.value; teamPlayerStatsClubSelection = 'current'; renderTeamPlayerStatistics(); });
  $('teamPlayerStatsClub')?.addEventListener('change', event => { teamPlayerStatsClubSelection = event.target.value; renderTeamPlayerStatistics(); });
  $('teamPlayerStatsSort')?.addEventListener('change', event => { teamPlayerStatsSort = event.target.value; renderTeamPlayerStatistics(); });
}

function renderSquad(){
  const players = sortedSquadPlayers();
  const rows = players.map(p=>`
    <tr class="${isUnavailable(p.id) ? 'dim-row' : ''}">
      <td>${faceImg(p, 'photo-thumb')}</td>
      <td><button class="linklike" data-player-id="${p.id}"><strong>${playerNameWithScoutingEye(p)}</strong></button></td>
      <td>#${jerseyNumber(p.id)}</td>
      <td>${Number(p.age || 0) || '—'}</td>
      <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
      <td>${nationalityShortMarkup(p.nationality)}</td>
      <td><strong>${visibleOverall(p)}</strong></td>
      <td><strong>${playerStatValue(p.id, 'played')}</strong></td>
      <td><strong>${playerStatValue(p.id, 'goals')}</strong></td>
      <td><strong>${playerStatValue(p.id, 'assists')}</strong></td>
      <td>${conditionBar(p.id)}</td>
      <td>${moraleBar(p.id)}</td>
      <td><strong>${playerVisibleSkillValue(p, squadSkillSortKey)}</strong></td>
      <td class="squad-status-cell">${squadAvailabilityIconMarkup(p.id)}</td>
      <td>${formatMoney(p.clause || p.value || 0)}</td>
    </tr>`).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Plantel</h2><p class="tagline">Cada jugador es clickeable. La media se calcula sólo con habilidades visibles. Los controles de orden están en la cabecera de cada columna.</p></div>
    <div class="squad-scroll-top" id="squadScrollTop"><div></div></div>
    <div class="table-wrap squad-table-wrap" id="squadTableWrap"><table class="squad-table"><thead><tr>
      <th>Foto</th>
      <th>${columnSort('Jugador', [['nombre_asc','A-Z'],['nombre_desc','Z-A']])}</th>
      <th>${columnSort('Dorsal', [['dorsal_asc','Menor a mayor'],['dorsal_desc','Mayor a menor']])}</th>
      <th>${columnSort('Edad', [['edad_asc','Menor a mayor'],['edad_desc','Mayor a menor']])}</th>
      <th>${columnSort('POS', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th>
      <th>${columnSort('Nacionalidad', [['nacionalidad_asc','A-Z'],['nacionalidad_desc','Z-A']])}</th>
      <th>${columnSort('Media', [['media_desc','Mayor a menor'],['media_asc','Menor a mayor']])}</th>
      <th>${columnSort('PJ', [['played_desc','Mayor a menor'],['played_asc','Menor a mayor']])}</th>
      <th>${columnSort(firstTeamStatHeaderIconMarkup('goals'), [['goals_desc','Mayor a menor'],['goals_asc','Menor a mayor']])}</th>
      <th>${columnSort(firstTeamStatHeaderIconMarkup('assists'), [['assists_desc','Mayor a menor'],['assists_asc','Menor a mayor']])}</th>
      <th>${columnSort('Estado físico', [['condicion_desc','Mayor a menor'],['condicion_asc','Menor a mayor']])}</th>
      <th>${columnSort('Moral', [['moral_desc','Mayor a menor'],['moral_asc','Menor a mayor']])}</th>
      <th>${skillColumnSort('Habilidad')}</th>
      <th>${columnSort('Estado', [['estado_disponible','Disponibles primero'],['estado_no_disponible','No disponibles primero']])}</th>
      <th>${columnSort('Cláusula', [['valor_desc','Mayor a menor'],['valor_asc','Menor a mayor']])}</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  `;
  prependFirstTeamTabs('squad');
  document.querySelectorAll('[data-squad-sort]').forEach(button => {
    button.addEventListener('click', () => {
      if(button.dataset.squadSort){ squadSort = button.dataset.squadSort; renderSquad(); }
    });
  });
  document.querySelector('[data-squad-skill-sort]')?.addEventListener('change', event => {
    squadSkillSortKey = PLAYER_VISIBLE_SKILL_COLUMNS.includes(event.target.value) ? event.target.value : 'Resistencia';
    if(!String(squadSort || '').startsWith('habilidad_')) squadSort = 'habilidad_desc';
    renderSquad();
  });
  bindSquadTopScrollbar();
}
function bindSquadTopScrollbar(){
  const top = $('squadScrollTop');
  const wrap = $('squadTableWrap');
  const table = wrap?.querySelector('table');
  if(!top || !wrap || !table) return;
  const inner = top.querySelector('div');
  if(inner) inner.style.width = `${table.scrollWidth}px`;
  let syncing = false;
  top.addEventListener('scroll', () => {
    if(syncing) return;
    syncing = true;
    wrap.scrollLeft = top.scrollLeft;
    syncing = false;
  });
  wrap.addEventListener('scroll', () => {
    if(syncing) return;
    syncing = true;
    top.scrollLeft = wrap.scrollLeft;
    syncing = false;
  });
}
function tacticSelectionClass(playerId){
  return tacticClickSelection && Number(tacticClickSelection.playerId) === Number(playerId) ? ' tactic-selected' : '';
}
function tacticMetricCircle(markup){
  return `<span class="tactic-metric-circle">${markup || ''}</span>`;
}
function tacticPlayerCard(p, extra='', zone='reserve', index=-1){
  const statusIcons = availabilityIcons(p.id);
  const unavailableClass = isUnavailable(p.id) ? 'injured-card' : '';
  const playableInjuredClass = canUseInjuredAsSub(p.id) ? 'playable-injured-card' : '';
  return `<button type="button" class="drag-player tactic-click-player ${playerGroupClass(p.position)} ${extra} ${unavailableClass} ${playableInjuredClass}${tacticSelectionClass(p.id)}" data-tactic-player="${p.id}" data-tactic-zone="${zone}" data-tactic-index="${index}" title="Click para seleccionar o intercambiar">
    ${faceImg(p, 'drag-face')}
    <span class="tactic-card-text"><strong>${statusIcons}${escapeHtml(playerLastName(p.name))}</strong><span class="tactic-card-meta">#${jerseyNumber(p.id)} · ${roleBadge(p.position)} · ${Number(p.age || 0) || '—'} años · Media ${visibleOverall(p)}</span></span>
    <span class="tactic-card-meters" aria-label="Estado físico y moral">${tacticMetricCircle(conditionBar(p.id))}${tacticMetricCircle(moraleBar(p.id))}</span>
  </button>`;
}
function tacticSelectionHint(){
  if(!tacticClickSelection?.playerId) return 'Click en un jugador para seleccionarlo. Después hacé click en otro jugador o en un puesto vacío para intercambiar.';
  const p = playerById(tacticClickSelection.playerId);
  return `${p ? escapeHtml(playerLastName(p.name)) : 'Jugador'} seleccionado. Hacé click en otro jugador para intercambiar, o volvé a hacer click para cancelar.`;
}
function bindTacticClickEvents(){
  document.querySelectorAll('[data-tactic-player]').forEach(el => {
    el.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const playerId = Number(el.dataset.tacticPlayer || 0);
      if(!playerId) return;
      if(el.classList.contains('player-chip') && el.dataset.tacticZone === 'starter'){
        game.tactic = applyStarterMentalities(game.tactic);
        setPlayerMentality(playerId, nextMentality(playerMentality(playerId)), game.tactic);
        tacticClickSelection = null;
        saveLocal(true);
        renderTactics();
        return;
      }
      if(!tacticClickSelection){
        tacticClickSelection = { playerId };
        renderTactics();
        return;
      }
      if(Number(tacticClickSelection.playerId) === playerId){
        tacticClickSelection = null;
        renderTactics();
        return;
      }
      swapTacticClickTargets(tacticLocationOfPlayer(tacticClickSelection.playerId), tacticLocationOfPlayer(playerId));
    });
  });
  document.querySelectorAll('[data-tactic-empty-slot]').forEach(el => {
    el.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if(!tacticClickSelection?.playerId){
        showNotice('Primero seleccioná un jugador y después elegí el puesto vacío.');
        return;
      }
      const index = Number(el.dataset.tacticEmptySlot || -1);
      if(index < 0) return;
      swapTacticClickTargets(tacticLocationOfPlayer(tacticClickSelection.playerId), { type:'starter', index, playerId:0 });
    });
  });
  document.querySelectorAll('[data-tactic-custom-cell]').forEach(el => {
    el.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if(!tacticClickSelection?.playerId){
        showNotice('Primero seleccioná un titular, suplente o reserva y después elegí una casilla.');
        return;
      }
      if(typeof customTacticMoveSelectedToCell === 'function') customTacticMoveSelectedToCell(el.dataset.tacticCustomCell || '');
    });
  });
  document.querySelectorAll('[data-custom-mentality-player]').forEach(el => {
    el.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const playerId = Number(el.dataset.customMentalityPlayer || 0);
      if(!playerId) return;
      game.tactic = applyStarterMentalities(game.tactic);
      setPlayerMentality(playerId, nextMentality(playerMentality(playerId)), game.tactic);
      tacticClickSelection = null;
      saveLocal(true);
      renderTactics();
    });
  });
}


function savedTacticsPanelMarkup(){
  const maxSlots = Number.isFinite(Number(typeof TACTIC_SAVE_SLOT_COUNT !== 'undefined' ? TACTIC_SAVE_SLOT_COUNT : 3)) ? Number(TACTIC_SAVE_SLOT_COUNT) : 3;
  const slots = [];
  for(let i=1; i<=maxSlots; i++){
    const info = typeof tacticSlotStatus === 'function' ? tacticSlotStatus(i) : { exists:false, label:'Vacía', details:'Sin táctica guardada.' };
    slots.push(`<div class="saved-tactic-slot ${info.exists ? 'filled' : 'empty'}">
      <div><strong>Táctica ${i}</strong><span>${escapeHtml(info.label)}</span><em>${escapeHtml(info.details)}</em></div>
      <div class="saved-tactic-actions">
        <button type="button" class="ghost" data-save-tactic-slot="${i}">Guardar ${i}</button>
        <button type="button" class="primary" data-load-tactic-slot="${i}" ${info.exists ? '' : 'disabled'}>Cargar ${i}</button>
      </div>
    </div>`);
  }
  return `<div class="card saved-tactics-card" style="margin-top:14px">
    <div class="row"><div><h3>Tácticas guardadas</h3></div></div>
    <div class="saved-tactics-grid">${slots.join('')}</div>
  </div>`;
}
function bindSavedTacticButtons(){
  document.querySelectorAll('[data-save-tactic-slot]').forEach(btn => {
    btn.addEventListener('click', () => saveCurrentTacticSlot(Number(btn.dataset.saveTacticSlot || 1)));
  });
  document.querySelectorAll('[data-load-tactic-slot]').forEach(btn => {
    btn.addEventListener('click', () => loadSavedTacticSlot(Number(btn.dataset.loadTacticSlot || 1)));
  });
}


function tacticSectorSkillVisors(){
  const slots = pitchSlots(game.tactic || DEFAULT_TACTIC);
  const groupPlayers = { defense:[], midfield:[], attack:[] };
  slots.forEach(slot => {
    if(!slot.player) return;
    const group = slotGroup(slot.slot);
    if(group === 'def') groupPlayers.defense.push(slot.player);
    else if(group === 'mid') groupPlayers.midfield.push(slot.player);
    else if(group === 'att') groupPlayers.attack.push(slot.player);
  });
  const stat = (players, type) => {
    if(!players.length) return 0;
    if(type === 'defense') return clamp(Math.round(avg(players.map(p => avg([Number(p.skills?.marca ?? 0), Number(p.skills?.entradas ?? 0), Number(p.skills?.posicionamiento ?? 0)])))), 0, 99);
    if(type === 'midfield') return clamp(Math.round(avg(players.map(p => avg([Number(p.skills?.paseCorto ?? 0), Number(p.skills?.paseLargo ?? 0), Number(p.skills?.vision ?? 0)])))), 0, 99);
    return clamp(Math.round(avg(players.map(p => avg([Number(p.skills?.remate ?? 0), Number(p.skills?.cabezazo ?? 0)])))), 0, 99);
  };
  const rows = [
    { key:'defense', label:'Defensa', value:stat(groupPlayers.defense, 'defense'), detail:'' },
    { key:'midfield', label:'Medios', value:stat(groupPlayers.midfield, 'midfield'), detail:'' },
    { key:'attack', label:'Delantera', value:stat(groupPlayers.attack, 'attack'), detail:'' }
  ];
  return `<div class="tactic-skill-visor-list">${rows.map(row => `<div class="tactic-skill-visor ${row.key}"><div class="row"><span>${escapeHtml(row.label)}</span><strong>${row.value}%</strong></div><div class="project-progress"><span style="width:${row.value}%"></span></div>${row.detail ? `<small class="muted">${escapeHtml(row.detail)}</small>` : ''}</div>`).join('')}</div>`;
}
function captainSelectOptionsMarkup(){
  const selected = Number(game?.tactic?.captainId || 0);
  const hierarchy = typeof designatedCaptainHierarchy === 'function' ? designatedCaptainHierarchy(game?.selectedClubId) : { captainId:0, viceCaptainId:0 };
  const starters = (game?.tactic?.starters || []).map(playerById).filter(Boolean);
  if(!starters.length) return '<option value="0">Sin titulares disponibles</option>';
  return starters.map(player => {
    const current = captaincyValue(player.id);
    const role = Number(player.id) === Number(hierarchy.captainId) ? ' · Capitán designado' : Number(player.id) === Number(hierarchy.viceCaptainId) ? ' · 2.º capitán' : '';
    return `<option value="${player.id}" ${selected === Number(player.id) ? 'selected' : ''}>${escapeHtml(playerLastName(player.name))} · ${roleBadge(player.position)} · Media ${visibleOverall(player)} · Capitanía ${current}%${role}</option>`;
  }).join('');
}
function tacticPlayerStatusIconsMarkup(player){
  if(!player) return '';
  const eye = playerScoutingEyeMarkup(player);
  const captain = Number(game?.tactic?.captainId || 0) === Number(player.id)
    ? '<span class="captain-marker inline" title="Capitán" aria-label="Capitán">C</span>'
    : '';
  if(!eye && !captain) return '';
  return `<span class="tactic-player-status-icons">${eye}${captain}</span>`;
}
function tacticPlayerNameWithStatus(player, lastNameOnly=false){
  if(!player) return '';
  const label = lastNameOnly
    ? escapeHtml(playerLastName(player.name))
    : (typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player.name || 'Jugador'));
  return `<span class="tactic-player-name-status"><span class="tactic-player-name-label">${label}</span>${tacticPlayerStatusIconsMarkup(player)}</span>`;
}
function captaincyCircleMarkup(value){
  const clean = clamp(Math.round(Number(value || 0)), 0, 99);
  const colorClass = clean < 40 ? 'low' : clean < 70 ? 'mid' : 'high';
  const deg = Math.round((clean / 99) * 360);
  return `<span class="value-circle performance-circle captaincy-circle ${colorClass}" style="--value-deg:${deg}deg" title="Rendimiento como capitán: ${clean}%"><strong>${clean}%</strong></span>`;
}
function tacticCaptainCardMarkup(){
  const captainId = Number(game?.tactic?.captainId || 0);
  const captain = playerById(captainId);
  if(!captain){
    return `<div class="card tactic-captain-card tactic-grid-card"><h3>Capitán</h3><p class="muted small">Armá el once titular para seleccionar al capitán.</p></div>`;
  }
  const current = captaincyValue(captain.id);
  const matches = captaincyMatches(captain.id);
  const effect = captaincyEffectForPercent(current);
  const hierarchy = typeof designatedCaptainHierarchy === 'function' ? designatedCaptainHierarchy(game?.selectedClubId) : { captainId:0, viceCaptainId:0 };
  const expected = typeof preferredCaptainForStarterIds === 'function' ? preferredCaptainForStarterIds(game?.tactic?.starters || [], game?.selectedClubId) : null;
  const exceptional = Boolean(expected && Number(expected.id) !== captainId);
  const targetMatches = typeof captaincyTargetMatchesForPlayer === 'function' ? captaincyTargetMatchesForPlayer(captain) : 60;
  const signed = value => Number(value) > 0 ? `+${Number(value)}` : String(Number(value));
  return `<div class="card tactic-captain-card tactic-grid-card">
    <div class="tactic-captain-title"><div><h3>Capitán del partido</h3><p class="muted small">El capitán y el 2.º capitán del vestuario tienen prioridad cuando son titulares.</p></div><span class="pill">${matches} PJ como capitán</span></div>
    <label class="tactic-captain-select-label" for="captainSelect">Jugador designado</label>
    <select id="captainSelect" class="tactic-captain-select">${captainSelectOptionsMarkup()}</select>
    <div class="tactic-captain-profile">
      ${faceImg(captain, 'captain-face')}
      <div class="tactic-captain-identity"><strong>${tacticPlayerNameWithStatus(captain, true)}</strong><span>${roleBadge(captain.position)} · Media ${visibleOverall(captain)}</span></div>
      <div class="tactic-captain-performance">${captaincyCircleMarkup(current)}</div>
    </div>
    ${exceptional ? `<div class="tactic-captain-exception"><strong>Designación excepcional</strong><span>${escapeHtml(expected?.name || 'El capitán designado')} tenía prioridad. Mantener otra elección puede generar tensión en el vestuario.</span></div>` : ''}
    <p class="muted small tactic-captain-development">Formación estimada: ${targetMatches} partidos como capitán para consolidar su experiencia. Los mayores de 28 años progresan más rápido.</p>
    <div class="tactic-captain-metrics">
      <div><span>Forma</span>${conditionBar(captain.id)}</div>
      <div><span>Moral</span>${moraleBar(captain.id)}</div>
    </div>
    <div class="tactic-captain-progress">
      <div class="row"><span>Rendimiento como capitán</span><strong>${current}%</strong></div>
      <div class="project-progress"><span style="width:${current}%"></span></div>
    </div>
    <div class="tactic-captain-effect ${effect.moral < 0 || effect.cohesion < 0 ? 'negative' : 'positive'}"><span>Impacto actual postpartido</span><strong>Moral ${signed(effect.moral)} · Cohesión ${signed(effect.cohesion)}</strong></div>
  </div>`;
}
function tacticOnlineCategorySummaryMarkup(){
  const fallbackIds = () => {
    const starters = (game?.tactic?.starters || []).slice(0,11).map(Number).filter(Boolean);
    const starterSet = new Set(starters);
    const bench = (game?.tactic?.bench || []).map(Number).filter(Boolean).filter(id => !starterSet.has(id)).slice(0,10);
    return { starters, bench };
  };
  const ids = typeof challengeSquadIds === 'function' ? challengeSquadIds() : fallbackIds();
  const starterPlayers = (ids.starters || []).map(playerById).filter(Boolean);
  const benchPlayers = (ids.bench || []).map(playerById).filter(Boolean);
  const salaryTotal = [...starterPlayers, ...benchPlayers].reduce((sum, player) => sum + Math.max(0, Math.round(Number(player?.salary || 0))), 0);
  let category = null;
  if(typeof challengeNaturalCategoryForSalary === 'function') category = challengeNaturalCategoryForSalary(salaryTotal);
  if(!category){
    const configured = Array.isArray(window.GAME_CONFIG?.desafiosOnline?.categoriasSalariales)
      ? window.GAME_CONFIG.desafiosOnline.categoriasSalariales
      : [];
    const normal = configured.filter(item => item?.libre !== true && String(item?.codigo || '').toUpperCase() !== 'L');
    const row = normal.find(item => salaryTotal >= Number(item?.minimo || 0) && salaryTotal <= Number(item?.maximo ?? Number.MAX_SAFE_INTEGER));
    category = row
      ? { code:String(row.codigo || '').toUpperCase(), name:String(row.nombre || 'Categoría'), minimum:Number(row.minimo || 0), maximum:Number(row.maximo || 0), free:false }
      : { code:'L', name:'Libre', minimum:0, maximum:null, free:true };
  }
  const badge = typeof challengeCategoryBadgeMarkup === 'function'
    ? challengeCategoryBadgeMarkup(category.code)
    : `<span class="challenge-category-badge challenge-category-${escapeHtml(String(category.code || 'L').toLowerCase())}"><b>${escapeHtml(category.code || 'L')}</b><span>${escapeHtml(category.name || 'Libre')}</span></span>`;
  const range = typeof challengeCategoryRangeLabel === 'function'
    ? challengeCategoryRangeLabel(category)
    : (category.free ? 'Sin límite salarial' : `Hasta ${formatMoney(category.maximum || 0)}`);
  const complete = starterPlayers.length === 11;
  const squadLabel = complete
    ? `${starterPlayers.length} titulares · ${benchPlayers.length} suplentes`
    : `${starterPlayers.length}/11 titulares · ${benchPlayers.length} suplentes`;
  return `<div class="tactic-online-category-summary ${complete ? '' : 'incomplete'}">
    <div class="tactic-online-category-head"><span class="label">Competencia online</span>${badge}</div>
    <div class="tactic-online-category-salary"><span>Suma de sueldos actual</span><strong>${formatMoney(salaryTotal)}</strong></div>
    <p class="muted small">${escapeHtml(squadLabel)} · ${escapeHtml(range)}.${complete ? ' También puede publicarse en Libre.' : ' Completá los 11 titulares para publicar.'}</p>
  </div>`;
}

function tacticModeControlsMarkup(){
  const custom = typeof isCustomTactic === 'function' && isCustomTactic(game?.tactic);
  return `<div class="tactic-mode-switch" role="group" aria-label="Tipo de táctica">
    <button type="button" id="presetTacticModeBtn" class="${custom ? 'ghost' : 'primary'}">Predefinida</button>
    <button type="button" id="customTacticModeBtn" class="${custom ? 'primary' : 'ghost'}">Personalizada</button>
  </div>`;
}
function presetTacticPitchMarkup(tactic){
  return pitchSlots(tactic).map(slot => {
    const fitLevel = slot.player ? playerTacticFitLevel(slot.player, slot.slot) : 'exact';
    const fitClass = fitLevel === 'zone' ? 'out-zone' : fitLevel === 'role' ? 'off-role' : '';
    const chip = slot.player ? `
      <button type="button" class="player-chip tactic-click-player mentality-${playerMentality(slot.player.id)} ${playerGroupClass(slot.player.position)} ${fitClass}${tacticSelectionClass(slot.player.id)}" data-tactic-player="${slot.player.id}" data-tactic-zone="starter" data-tactic-index="${slot.index}" title="${playerTacticFitTitle(slot.player, slot.slot)} · Click para cambiar estado: ${escapeHtml(mentalityLabel(playerMentality(slot.player.id)))}">
        <span class="jersey-dot">${jerseyNumber(slot.player.id)}</span>
        <span class="player-chip-name">${tacticPlayerNameWithStatus(slot.player, true)}</span>
        ${mentalityMarker(slot.mentality)}
      </button>` : `<button type="button" class="empty-slot ${slotGroup(slot.slot)} tactic-empty-slot" data-tactic-empty-slot="${slot.index}" title="Seleccioná un jugador y hacé click acá"><strong>${slot.slot}</strong><span>Vacío</span></button>`;
    return `<div class="pitch-slot" style="left:${slot.x}%; top:${slot.y}%">${chip}</div>`;
  }).join('');
}
function customTacticPitchMarkup(tactic){
  const activeSlots = typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(tactic?.customSlots, tactic) : [];
  const activeMap = new Map(activeSlots.map((cellId,index) => [cellId,index]));
  return (typeof CUSTOM_TACTIC_CELLS !== 'undefined' ? CUSTOM_TACTIC_CELLS : []).map(cell => {
    const index = activeMap.has(cell.id) ? activeMap.get(cell.id) : -1;
    const player = index >= 0 ? playerById(tactic?.starters?.[index]) : null;
    if(player){
      const fitLevel = playerTacticFitLevel(player,cell.role);
      const fitClass = fitLevel === 'zone' ? 'out-zone' : fitLevel === 'role' ? 'off-role' : '';
      return `<div class="custom-tactic-cell occupied" style="left:${cell.x}%;top:${cell.y}%" data-custom-role="${cell.role}">
        <button type="button" class="player-chip tactic-click-player mentality-${playerMentality(player.id)} ${playerGroupClass(player.position)} ${fitClass}${tacticSelectionClass(player.id)}" data-tactic-player="${player.id}" data-tactic-zone="custom" data-tactic-index="${index}" title="${playerTacticFitTitle(player,cell.role)} · Click para seleccionar o intercambiar">
          <span class="jersey-dot">${jerseyNumber(player.id)}</span>
          <span class="player-chip-name">${tacticPlayerNameWithStatus(player,true)}</span>
        </button>
        <button type="button" class="custom-mentality-toggle" data-custom-mentality-player="${player.id}" title="Cambiar mentalidad individual">${mentalityMarker(playerMentality(player.id))}</button>
        <span class="custom-cell-role">${cell.role}</span>
      </div>`;
    }
    const active = index >= 0;
    return `<button type="button" class="custom-tactic-cell-target ${active ? 'active-empty' : 'inactive'} ${slotGroup(cell.role)}" style="left:${cell.x}%;top:${cell.y}%" data-tactic-custom-cell="${cell.id}" title="${active ? `Casilla titular ${cell.role} vacía` : `Mover puesto a ${cell.role}`}"><strong>${cell.role}</strong><span>${active ? 'Vacío' : '+'}</span></button>`;
  }).join('');
}
function tacticPitchMarkup(tactic){
  return typeof isCustomTactic === 'function' && isCustomTactic(tactic) ? customTacticPitchMarkup(tactic) : presetTacticPitchMarkup(tactic);
}
function tacticStarterListMarkup(tactic){
  return pitchSlots(tactic).map(slot => {
    const p = slot.player;
    const fit = p ? playerFitsSlot(p,slot.slot) : false;
    const locationType = typeof isCustomTactic === 'function' && isCustomTactic(tactic) ? 'custom' : 'starter';
    return `<div class="lineup-row tactic-lineup-row ${p && !fit ? 'bad-zone' : ''}${p ? tacticSelectionClass(p.id) : ''}" ${p ? `data-tactic-player="${p.id}" data-tactic-zone="${locationType}" data-tactic-index="${slot.index}"` : (locationType === 'custom' ? `data-tactic-custom-cell="${slot.cellId || tactic.customSlots?.[slot.index] || ''}"` : `data-tactic-empty-slot="${slot.index}"`)}>
      <span class="pill">${slot.index+1}. ${slot.slot}</span>
      <span>${p ? `<strong>${tacticPlayerNameWithStatus(p)}</strong>` : '<span class="muted">Vacío</span>'}</span>
      <span class="lineup-center-cell">${p ? roleBadge(p.position) : '—'}</span>
      <span class="age-cell lineup-center-cell">${p ? (Number(p.age || 0) || '—') : '—'}</span>
      <span class="lineup-center-cell">${p ? `<strong>${visibleOverall(p)}</strong>` : '—'}</span>
      <span class="lineup-center-cell metric-only">${p ? tacticMetricCircle(conditionBar(p.id)) : ''}</span>
      <span class="lineup-center-cell metric-only">${p ? tacticMetricCircle(moraleBar(p.id)) : ''}</span>
      <span class="lineup-center-cell metric-only">${p ? tacticMetricCircle(tacticFitBar(p,slot.slot)) : ''}</span>
    </div>`;
  }).join('');
}
function customTacticBalanceMarkup(){
  if(typeof customTacticBalanceProfile !== 'function' || !isCustomTactic(game?.tactic)) return '';
  const profile = customTacticBalanceProfile(game.tactic);
  const pct = value => `${Math.round(Number(value || 1) * 100)}%`;
  const notes = profile.warnings.length
    ? profile.warnings.slice(0,5).map(item => `<li>${escapeHtml(item.text)}</li>`).join('')
    : '<li>Sin desequilibrios graves detectados.</li>';
  return `<div class="card custom-tactic-balance-card tactic-grid-card">
    <div class="custom-balance-head"><div><p class="label">Evaluación provisoria</p><h3>${escapeHtml(profile.label)}</h3></div><strong class="custom-balance-score">${profile.score}/100</strong></div>
    <div class="custom-balance-metrics"><span>Defensa <b>${pct(profile.defenseMultiplier)}</b></span><span>Medios <b>${pct(profile.midfieldMultiplier)}</b></span><span>Ataque <b>${pct(profile.attackMultiplier)}</b></span><span>Ocasiones <b>${pct(profile.chanceMultiplier)}</b></span></div>
    <p class="muted small">${profile.counts.def} DEF · ${profile.counts.mid} MED · ${profile.counts.att} ATA · Bandas ${profile.counts.left}/${profile.counts.right}</p>
    <ul class="custom-balance-notes">${notes}</ul>
  </div>`;
}

function renderTactics(){
  game.tactic = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic));
  const formationOptions = Object.keys(FORMATIONS).map(f=>`<option value="${f}" ${game.tactic.formation===f?'selected':''}>${f}</option>`).join('');
  const bench = game.tactic.bench.map(playerById).filter(Boolean);
  const starterSet = new Set(game.tactic.starters);
  const benchSet = new Set(game.tactic.bench);
  const reserves = playersByClub(game.selectedClubId)
    .filter(p => !starterSet.has(p.id) && !benchSet.has(p.id))
    .sort((a,b)=>positionOrder(a.position)-positionOrder(b.position) || visibleOverall(b)-visibleOverall(a));
  const pitch = tacticPitchMarkup(game.tactic);
  const starterList = tacticStarterListMarkup(game.tactic);
  const customMode = typeof isCustomTactic === 'function' && isCustomTactic(game.tactic);
  view.innerHTML = `
    <div class="section-title tactic-section-title"><h2>Táctica y convocatoria</h2></div>
    <div class="tactic-workspace ${customMode ? 'custom-layout-active' : ''}">
      <main class="tactic-left-stack">
        <div class="card tactic-board-card tactic-grid-card">
          <div class="tactic-board-headline"><div><h3>Cancha táctica</h3><p class="muted small">${customMode ? 'Personalizada · cada casilla define el rol' : `Formación ${game.tactic.formation}`}</p></div></div>
          ${tacticModeControlsMarkup()}
          <div class="tactic-click-help">${tacticSelectionHint()}</div>
          <div class="pitch-board-wrap">
            <div class="pitch-board centered ${customMode ? 'custom-tactic-board' : ''}">${pitch}</div>
            <div class="tactic-state-legend">
              <span>${mentalityMarker('muy_defensivo')} Muy defensivo</span>
              <span>${mentalityMarker('defensivo')} Defensivo</span>
              <span>${mentalityMarker('normal')} Normal</span>
              <span>${mentalityMarker('ofensivo')} Ofensivo</span>
              <span>${mentalityMarker('muy_ofensivo')} Muy ofensivo</span>
            </div>
          </div>
        </div>
        <div class="grid cols-2 tactic-lists tactic-grid-card">
          <div class="card tactic-lineup-card">
            <h3>Titulares</h3>
            <div class="lineup-row lineup-head tactic-lineup-head"><span>Pos.</span><span>Jugador</span><span class="lineup-center-cell">Rol</span><span class="lineup-center-cell">Edad</span><span class="lineup-center-cell">Media</span><span class="lineup-center-cell">Físico</span><span class="lineup-center-cell">Moral</span><span class="lineup-center-cell">Rendimiento</span></div>
            <div class="lineup-list">${starterList}</div>
          </div>
          <div class="card tactic-roster-card">
            <h3>Suplentes / reservas</h3>
            <div class="drop-pool" data-drop-pool="bench"><h4>Suplentes (${bench.length}/10)</h4><div class="drag-list">${bench.length ? bench.map((p,i)=>tacticPlayerCard(p,'bench-card','bench',i)).join('') : '<p class="muted small">Sin suplentes.</p>'}</div></div>
            <div class="drop-pool" data-drop-pool="reserve"><h4>Reservas</h4><div class="drag-list">${reserves.length ? reserves.map((p,i)=>tacticPlayerCard(p,'reserve-card','reserve',i)).join('') : '<p class="muted small">Sin reservas.</p>'}</div></div>
          </div>
        </div>
        <div class="card tactic-autosub-card tactic-grid-card">
          <h3>Cambios automáticos</h3>
          <p class="muted small">Elegí reglas simples: cansados, mejores suplentes o sólo cambios obligados por lesión.</p>
          <div class="autosub-grid">${[0,1,2,3,4].map(i => autoSubRow(i)).join('')}</div>
        </div>
      </main>
      <aside class="tactic-right-rail">
        <div class="card tactic-actions-card tactic-grid-card">
          <h3>Acciones</h3>
          <div class="formation-box"><label>Plantilla predefinida</label><select id="formation" ${customMode ? 'disabled' : ''}>${formationOptions}</select><small class="muted">En personalizada, las formaciones siguen disponibles al volver al modo predefinido.</small></div>
          ${tacticOnlineCategorySummaryMarkup()}
          <div class="tactic-autopick-row"><button id="autoPickBestBtn" class="ghost">Mejor once</button><button id="autoPickConditionBtn" class="ghost">Mejor condición física</button></div>
          <button id="saveTactic" class="primary full">Confirmar equipo</button>
          <span id="tacticErrors" class="bad small"></span>
        </div>
        ${tacticCaptainCardMarkup()}
        ${customTacticBalanceMarkup()}
        <div class="card tactic-board-side tactic-board-right tactic-sector-card tactic-grid-card">
          <h3>Visores tácticos</h3>
          <div class="tactic-board-visors" aria-label="Visores tácticos">${tacticSectorSkillVisors()}</div>
          <h3>Instrucciones zonales</h3>
          <p class="muted small">Defensa, medios y delanteros. Pueden contraponerse o no con la mentalidad individual de cada jugador.</p>
          <div class="sector-style-grid vertical">${sectorStyleControls()}</div>
          <h3>Creación de juego</h3>
          <p class="muted small">Estas opciones cambian qué acciones intenta el equipo. No agregan precisión artificial a los jugadores.</p>
          ${continuousBuildUpControlsV974()}
        </div>
        ${savedTacticsPanelMarkup()}
      </aside>
    </div>
  `;
  prependFirstTeamTabs('tactics');
  $('presetTacticModeBtn')?.addEventListener('click', () => switchTacticLayoutMode('preset'));
  $('customTacticModeBtn')?.addEventListener('click', () => switchTacticLayoutMode('custom'));
  $('formation').addEventListener('change', () => {
    const tentative = {...game.tactic, formation:$('formation').value};
    const autoStarters = autoSelectStarters(game.selectedClubId, tentative).map(p=>p.id);
    game.tactic.starters = autoStarters;
    game.tactic.bench = autoSelectBench(game.selectedClubId, autoStarters).map(p=>p.id);
    game.tactic.autoSubs = defaultAutoSubs(game.tactic.starters, game.tactic.bench);
    game.tactic.formation = tentative.formation;
    if(typeof customTacticSlotsFromPreset === 'function') game.tactic.customSlots = customTacticSlotsFromPreset(game.tactic);
    game.tactic = ensureTacticCaptain(applyStarterMentalities(game.tactic), game.selectedClubId);
    saveLocal(true);
    renderTactics();
  });
  $('autoPickBestBtn').addEventListener('click', () => {
    game.tactic.formation = $('formation').value;
    const starters = (typeof autoSelectStartersForTacticLayout === 'function' ? autoSelectStartersForTacticLayout(game.selectedClubId, game.tactic) : autoSelectStarters(game.selectedClubId, game.tactic)).map(p=>p.id);
    game.tactic.starters = starters;
    game.tactic.bench = autoSelectBench(game.selectedClubId, starters).map(p=>p.id);
    game.tactic.autoSubs = defaultAutoSubs(game.tactic.starters, game.tactic.bench);
    game.tactic = ensureTacticCaptain(applyStarterMentalities(game.tactic), game.selectedClubId);
    saveLocal(true);
    renderTactics();
  });
  $('autoPickConditionBtn').addEventListener('click', () => {
    game.tactic.formation = $('formation').value;
    const starters = (typeof autoSelectByBestConditionForTactic === 'function' ? autoSelectByBestConditionForTactic(game.selectedClubId, game.tactic) : autoSelectByBestCondition(game.selectedClubId)).map(p=>p.id);
    game.tactic.starters = starters;
    game.tactic.bench = autoSelectBenchByBestCondition(game.selectedClubId, starters).map(p=>p.id);
    game.tactic.autoSubs = defaultAutoSubs(game.tactic.starters, game.tactic.bench);
    game.tactic = ensureTacticCaptain(applyStarterMentalities(game.tactic), game.selectedClubId);
    saveLocal(true);
    renderTactics();
  });
  $('captainSelect')?.addEventListener('change', event => {
    const captainId = Number(event.target.value || 0);
    const preferredId = Number(typeof preferredCaptainForStarterIds === 'function' ? preferredCaptainForStarterIds(game?.tactic?.starters || [], game.selectedClubId)?.id || 0 : 0);
    const captainSelectionMode = captainId && captainId !== preferredId ? 'manual' : 'automatic';
    game.tactic = ensureTacticCaptain({ ...game.tactic, captainId, captainSelectionMode }, game.selectedClubId);
    saveLocal(true);
    renderTactics();
  });
  $('saveTactic').addEventListener('click', saveTacticFromScreen);
  bindSavedTacticButtons();
  bindTacticClickEvents();
}
function sectorStyleControls(){
  const current = typeof normalizeSectorStyles === 'function' ? normalizeSectorStyles(game.tactic?.sectorStyles) : (game.tactic?.sectorStyles || { defense:'posicional', midfield:'posicional', attack:'posicional' });
  const options = typeof TACTIC_SECTOR_STYLE_OPTIONS !== 'undefined' ? TACTIC_SECTOR_STYLE_OPTIONS : [
    { value:'presion_alta', label:'Presión alta', tone:'intense' },
    { value:'rotacion', label:'Rotación', tone:'massage' },
    { value:'posicional', label:'Posicional', tone:'tactical' },
    { value:'repliegue', label:'Repliegue', tone:'regen' }
  ];
  const descriptions = {
    defense:'',
    midfield:'',
    attack:''
  };
  const row = (key, label) => {
    const selected = current[key] || 'posicional';
    const selectedOption = options.find(opt => opt.value === selected) || options.find(opt => opt.value === 'posicional') || options[0];
    return `<div class="sector-style-control training-tone-${selectedOption?.tone || 'tactical'}">
      <label>${label}</label>
      <select class="training-individual-select training-tone-${selectedOption?.tone || 'tactical'}" data-sector-style="${key}">${options.map(opt=>`<option value="${opt.value}" ${selected===opt.value?'selected':''}>${opt.label}</option>`).join('')}</select>
      ${descriptions[key] ? `<span>${escapeHtml(descriptions[key] || '')}</span>` : ''}
    </div>`;
  };
  return row('defense','Defensa') + row('midfield','Medios') + row('attack','Delanteros');
}
function continuousBuildUpControlsV974(){
  const tactic = game?.tactic || {};
  const normalizeGk = window.Simulator20?.normalizeGoalkeeperDistribution || (value => ['short','long','varied'].includes(String(value || '')) ? String(value) : 'varied');
  const normalizeBuild = window.Simulator20?.normalizeBuildUpStyle || (value => ['possession','direct','counter','long_ball'].includes(String(value || '')) ? String(value) : 'possession');
  const goalkeeperDistribution = normalizeGk(tactic.goalkeeperDistribution);
  const buildUpStyle = normalizeBuild(tactic.buildUpStyle);
  const gkOptions = typeof TACTIC_GOALKEEPER_DISTRIBUTION_OPTIONS !== 'undefined' ? TACTIC_GOALKEEPER_DISTRIBUTION_OPTIONS : [
    { value:'short', label:'Siempre corto' }, { value:'long', label:'Siempre largo' }, { value:'varied', label:'Variado' }
  ];
  const buildOptions = typeof TACTIC_BUILD_UP_STYLE_OPTIONS !== 'undefined' ? TACTIC_BUILD_UP_STYLE_OPTIONS : [
    { value:'possession', label:'Posesión' }, { value:'direct', label:'Directo' }, { value:'counter', label:'Contraataque' }, { value:'long_ball', label:'Pelotazo' }
  ];
  return `<div class="sector-style-grid vertical continuous-build-controls-v974">
    <div class="sector-style-control training-tone-tactical">
      <label>Saque del arquero</label>
      <select class="training-individual-select training-tone-tactical" data-goalkeeper-distribution>${gkOptions.map(opt=>`<option value="${opt.value}" ${goalkeeperDistribution===opt.value?'selected':''}>${opt.label}</option>`).join('')}</select>
      <span class="muted small">Corto busca apoyos cercanos; largo intenta saltar líneas; variado decide por contexto.</span>
    </div>
    <div class="sector-style-control training-tone-tactical">
      <label>Creación</label>
      <select class="training-individual-select training-tone-tactical" data-build-up-style>${buildOptions.map(opt=>`<option value="${opt.value}" ${buildUpStyle===opt.value?'selected':''}>${opt.label}</option>`).join('')}</select>
      <span class="muted small">Posesión prioriza apoyo; Directo verticaliza; Contraataque acelera tras recuperar; Pelotazo salta el mediocampo.</span>
    </div>
  </div>`;
}

function autoSubRow(index){
  const rule = game.tactic.autoSubs[index] || { outId:0, inId:0, trigger:'tired' };
  const starterOpts = [`<option value="0">Sin cambio</option>`].concat(game.tactic.starters.map(id=>{
    const p = playerById(id);
    return `<option value="${id}" ${Number(rule.outId)===id?'selected':''}>${escapeHtml(p?.name || 'Jugador')} (${p?.position || ''})</option>`;
  })).join('');
  const benchOpts = [`<option value="0">Sin jugador</option>`].concat(game.tactic.bench.map(id=>{
    const p = playerById(id);
    return `<option value="${id}" ${Number(rule.inId)===id?'selected':''}>${escapeHtml(p?.name || 'Jugador')} (${p?.position || ''})</option>`;
  })).join('');
  const triggerOpts = SUB_TRIGGERS.map(t=>`<option value="${t.value}" ${rule.trigger===t.value?'selected':''}>${t.label}</option>`).join('');
  return `<div class="autosub-row">
    <span class="rank-num">${index+1}</span>
    <div><label>Sale</label><select data-sub-out="${index}">${starterOpts}</select></div>
    <div><label>Entra</label><select data-sub-in="${index}">${benchOpts}</select></div>
    <div><label>Tipo</label><select data-sub-trigger="${index}">${triggerOpts}</select></div>
  </div>`;
}
function saveTacticFromScreen(){
  const autoSubs = [0,1,2,3,4].map(i => ({
    outId: Number(document.querySelector(`[data-sub-out="${i}"]`)?.value || 0),
    inId: Number(document.querySelector(`[data-sub-in="${i}"]`)?.value || 0),
    trigger: document.querySelector(`[data-sub-trigger="${i}"]`)?.value || 'tired'
  }));
  const selectedInstructions = { winning:'normal', drawing:'normal', losing:'normal' };
  const selectedSectorStyles = typeof normalizeSectorStyles === 'function' ? normalizeSectorStyles({
    defense: document.querySelector('[data-sector-style="defense"]')?.value || 'posicional',
    midfield: document.querySelector('[data-sector-style="midfield"]')?.value || 'posicional',
    attack: document.querySelector('[data-sector-style="attack"]')?.value || 'posicional'
  }) : {
    defense: document.querySelector('[data-sector-style="defense"]')?.value || 'posicional',
    midfield: document.querySelector('[data-sector-style="midfield"]')?.value || 'posicional',
    attack: document.querySelector('[data-sector-style="attack"]')?.value || 'posicional'
  };
  const nextTactic = applyStarterMentalities({
    formation:$('formation')?.value || game.tactic.formation,
    layoutMode:typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(game.tactic.layoutMode) : 'preset',
    customSlots:typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(game.tactic.customSlots, game.tactic) : [],
    captainId:Number($('captainSelect')?.value || game.tactic.captainId || 0),
    captainSelectionMode:typeof normalizeCaptainSelectionMode === 'function' ? normalizeCaptainSelectionMode(game.tactic.captainSelectionMode) : 'automatic',
    starters:game.tactic.starters.slice(0,11),
    bench:game.tactic.bench.slice(0,10),
    autoSubs,
    playerMentalities:{ ...(game.playerMentalities || {}), ...(game.tactic.playerMentalities || {}) },
    matchInstructions: window.Simulator20?.normalizeMatchInstructions ? window.Simulator20.normalizeMatchInstructions(selectedInstructions) : selectedInstructions,
    sectorStyles:selectedSectorStyles,
    goalkeeperDistribution:window.Simulator20?.normalizeGoalkeeperDistribution ? window.Simulator20.normalizeGoalkeeperDistribution(document.querySelector('[data-goalkeeper-distribution]')?.value) : (document.querySelector('[data-goalkeeper-distribution]')?.value || 'varied'),
    buildUpStyle:window.Simulator20?.normalizeBuildUpStyle ? window.Simulator20.normalizeBuildUpStyle(document.querySelector('[data-build-up-style]')?.value) : (document.querySelector('[data-build-up-style]')?.value || 'possession')
  });
  const errors = validateTactic(nextTactic);
  if(errors.length){
    $('tacticErrors').textContent = errors.join(' ');
    showNotice('Equipo no confirmado. Corregí titulares, suplentes o jugadores no disponibles.');
    return;
  }
  game.tactic = nextTactic;
  game.mustReviewTactics = false;
  game.lastOwnProblems = [];
  saveLocal(true);
  showNotice('Equipo confirmado. Ya podés avanzar cuando termine el bloqueo.');
  renderAll();
}
function validateCurrentTactic(showErrors=true){
  const errors = validateTactic(game.tactic);
  if(showErrors && errors.length) showNotice(errors.join(' '));
  return errors;
}
function validateTactic(tactic){
  const errors = [];
  const starters = (tactic.starters || []).map(Number).filter(Boolean);
  const bench = (tactic.bench || []).map(Number).filter(Boolean);
  const uniqueStarters = new Set(starters);
  const uniqueBench = new Set(bench);
  if(starters.length !== 11 || uniqueStarters.size !== 11) errors.push('Necesitás exactamente 11 titulares.');
  if(bench.length !== 10 || uniqueBench.size !== 10) errors.push('Necesitás exactamente 10 suplentes.');
  const duplicated = [...uniqueStarters].filter(id => uniqueBench.has(id));
  if(duplicated.length) errors.push('Un jugador no puede ser titular y suplente a la vez.');
  const unavailableStarters = [...uniqueStarters].filter(id => !canBeStarter(id));
  if(unavailableStarters.length) errors.push('Hay lesionados o suspendidos entre los titulares.');
  const captainId = Number(tactic.captainId || 0);
  if(!captainId || !uniqueStarters.has(captainId)) errors.push('Elegí un capitán entre los once titulares.');
  const unavailableBench = [...uniqueBench].filter(id => !canBeBench(id));
  if(unavailableBench.length) errors.push('En el banco sólo se permiten disponibles o lesionados con recuperación menor a 70 días.');
  const slots = typeof tacticRoleSlots === 'function' ? tacticRoleSlots(tactic) : (FORMATIONS[tactic.formation] || FORMATIONS['4-4-2']);
  if(typeof isCustomTactic === 'function' && isCustomTactic(tactic)){
    const customSlots = typeof normalizeCustomTacticSlots === 'function' ? normalizeCustomTacticSlots(tactic.customSlots, tactic) : [];
    if(customSlots.length !== 11 || new Set(customSlots).size !== 11) errors.push('La táctica personalizada necesita exactamente 11 casillas diferentes.');
    if(slots.filter(slot => slot === 'POR').length !== 1) errors.push('La táctica personalizada debe incluir exactamente una casilla de portero.');
  }
  slots.forEach((slot, index) => {
    const player = playerById(starters[index]);
    if(player && !canAssignPlayerToSlot(player, slot)) errors.push(slot === 'POR' ? 'El titular en POR debe ser portero, salvo emergencia si el plantel no tiene ningún POR.' : 'Un portero no puede jugar como jugador de campo.');
  });
  (tactic.autoSubs || []).forEach((rule, i)=>{
    if(rule.outId || rule.inId){
      if(!uniqueStarters.has(Number(rule.outId))) errors.push(`Cambio ${i+1}: el jugador que sale debe ser titular.`);
      if(!uniqueBench.has(Number(rule.inId))) errors.push(`Cambio ${i+1}: el jugador que entra debe ser suplente.`);
      if(Number(rule.outId) === Number(rule.inId)) errors.push(`Cambio ${i+1}: entrada y salida no pueden ser el mismo jugador.`);
    }
  });
  return errors;
}
function positionOrder(pos){
  const order = {POR:1, LD:2, DFC:3, LI:4, MCD:5, MC:6, MCO:7, ED:8, EI:9, DC:10};
  return order[pos] || 99;
}

