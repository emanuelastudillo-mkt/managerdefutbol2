/* V3.44 · Primer equipo, mercado, plantel, táctica y validación de alineación. */

function firstTeamTabsMarkup(current){
  const tabs = [
    ['tactics','Táctica'],
    ['squad','Plantel'],
    ['training','Entrenamiento']
  ];
  return `<div class="card first-team-tabs"><div class="subtabs">${tabs.map(([key,label])=>`<button class="${current===key?'active':''}" data-first-team-tab="${key}">${label}</button>`).join('')}</div></div>`;
}
function bindFirstTeamTabs(){
  document.querySelectorAll('[data-first-team-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      firstTeamTab = btn.dataset.firstTeamTab || 'tactics';
      renderFirstTeam();
    });
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
  if(firstTeamTab === 'training') return renderTraining();
  return renderTactics();
}

function marketTabsMarkup(){
  return `<div class="card market-tabs"><div class="subtabs"><button class="${marketSubTab==='free'?'active':''}" data-market-tab="free">Jugadores libres</button><button class="${marketSubTab==='contracted'?'active':''}" data-market-tab="contracted">Jugadores contratados</button></div></div>`;
}
function bindMarketTabs(){
  document.querySelectorAll('[data-market-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      marketSubTab = btn.dataset.marketTab || 'free';
      renderMarket();
    });
  });
}
function contractedMarketPlayers(){
  return seed.players
    .filter(p => !p.retired && !p.sold && Number(p.clubId || 0) > 0 && Number(p.clubId) !== Number(game.selectedClubId))
    .slice()
    .sort((a,b)=>visibleOverall(b)-visibleOverall(a) || a.name.localeCompare(b.name,'es'));
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
function probRechazarOferta(mediaJugador, prestigioClubOfertante){
  return 100 - probAceptarOferta(mediaJugador, prestigioClubOfertante);
}
function marketPlayerAcceptanceChance(player=null){
  const media = player ? visibleOverall(player) : marketOfferClubPrestige();
  const chance = probAceptarOferta(media, marketOfferClubPrestige());
  return clamp(Math.round(chance * 10) / 10, 0.5, 95);
}
function marketPlayerRejectionChance(player=null){
  return clamp(Math.round(probRechazarOferta(player ? visibleOverall(player) : marketOfferClubPrestige(), marketOfferClubPrestige()) * 10) / 10, 5, 99.5);
}
function freeAgentAcceptanceChance(player=null){
  return marketPlayerAcceptanceChance(player);
}
function marketAcceptanceLabel(player=null){
  const chance = marketPlayerAcceptanceChance(player);
  return Number.isInteger(chance) ? String(chance) : chance.toFixed(1);
}
function marketAcceptanceHiddenLabel(){
  return 'Interés oculto';
}
function marketAcceptanceHiddenHint(){
  return 'El jugador puede aceptar o rechazar según su media real y el prestigio del club, pero la probabilidad exacta permanece oculta.';
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
function marketHasActiveFilters(){
  return Boolean(Number(marketFilters.mediaMin || 0) || Number(marketFilters.mediaMax || 0) || Number(marketFilters.ageMin || 0) || Number(marketFilters.ageMax || 0) || Number(marketFilters.priceMax || 0) || String(marketFilters.position || 'all') !== 'all');
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
  if(marketSubTab !== 'contracted') marketSubTab = 'free';
  if(marketSubTab === 'contracted') return renderContractedMarket();
  const freeBase = (game.marketPlayers || []).filter(p => Number(p.clubId || 0) === 0 && !p.sold).slice().sort((a,b)=>marketScoutedOverallNumber(b)-marketScoutedOverallNumber(a) || visibleOverall(b)-visibleOverall(a));
  const freeFiltered = freeBase.filter(marketPlayerMatchesFilters);
  const free = marketVisiblePlayers(freeFiltered);
  const rows = free.map(p => `<tr>
    <td>${faceImg(p, 'photo-thumb')}</td>
    <td><button class="linklike" data-player-id="${p.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(p) : escapeHtml(p.name)}</strong></button></td>
    <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
    <td>${Number(p.age || 0) || '—'}</td>
    <td>${nationalityShortMarkup(p.nationality)}</td>
    <td>${marketScoutedOverallCell(p)}</td>
    <td>${marketScoutedPhysicalCell(p)}</td>
    <td>${marketScoutedMoraleCell(p)}</td>
    <td>${formatMoney(marketPlayerPrice(p))}</td>
    <td>${formatMoney(p.salary || 0)}</td>
    <td><button class="primary small-btn" data-hire-free-agent="${p.id}" ${isFreeAgentOfferBlockedThisSeason(p.id) ? 'disabled' : ''}>${escapeHtml(freeAgentOfferButtonLabel(p.id))}</button><br><span class="small muted">${marketAcceptanceHiddenLabel()}</span></td>
  </tr>`).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Mercado</h2><p class="tagline">Jugadores libres y jugadores contratados disponibles para negociar.</p></div>
    ${marketTabsMarkup()}
    ${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}
    ${marketFiltersMarkup(freeBase.length, freeFiltered.length)}
    <div class="market-limit-note small muted">Se muestran ${free.length} jugador(es) que coinciden con el filtro. ${marketScoutingHintText()} ${marketAcceptanceHiddenHint()}</div>
    <div class="table-wrap"><table><thead><tr><th>Foto</th><th>Jugador</th><th>Rol</th><th>Edad</th><th>Nac.</th><th>Media scouteada</th><th>Físico</th><th>Moral</th><th>Valor</th><th>Sueldo</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="muted">No hay jugadores libres que coincidan con los filtros.</td></tr>'}</tbody></table></div>
    ${marketMoreButtonMarkup(freeFiltered.length, free.length)}`;
  bindMarketTabs();
  bindMarketFilters();
  bindMarketMoreButton();
  document.querySelectorAll('[data-hire-free-agent]').forEach(btn => btn.addEventListener('click', () => hireFreeAgent(Number(btn.dataset.hireFreeAgent))));
}
function renderContractedMarket(){
  const basePlayers = contractedMarketPlayers();
  const filteredPlayers = basePlayers.filter(marketPlayerMatchesFilters);
  const players = marketVisiblePlayers(filteredPlayers);
  const rows = players.map(p => {
    const blocked = typeof isPurchaseOfferBlockedThisSeason === 'function' && isPurchaseOfferBlockedThisSeason(p.id);
    const label = blocked ? 'Rechazada hasta próxima temp.' : 'Hacer oferta';
    return `<tr>
    <td>${faceImg(p, 'photo-thumb')}</td>
    <td><button class="linklike" data-player-id="${p.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(p) : escapeHtml(p.name)}</strong></button></td>
    <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
    <td>${Number(p.age || 0) || '—'}</td>
    <td>${nationalityShortMarkup(p.nationality)}</td>
    <td>${clubBadge(p.clubId)} ${escapeHtml(clubName(p.clubId))}</td>
    <td>${marketScoutedOverallCell(p)}</td>
    <td>${formatMoney(p.clause || p.value || 0)}</td>
    <td>${formatMoney(p.salary || 0)}</td>
    <td><span class="small muted">${marketAcceptanceHiddenLabel()}</span></td>
    <td><button class="primary small-btn" data-make-player-offer="${p.id}" ${blocked ? 'disabled' : ''}>${escapeHtml(label)}</button></td>
  </tr>`;
  }).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Mercado</h2><p class="tagline">Jugadores de otros clubes. Podés iniciar una negociación desde esta pestaña.</p></div>
    ${marketTabsMarkup()}
    ${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}
    ${marketFiltersMarkup(basePlayers.length, filteredPlayers.length)}
    <div class="market-limit-note small muted">Se muestran ${players.length} jugador(es) que coinciden con el filtro. ${marketScoutingHintText()}</div>
    <div class="table-wrap"><table><thead><tr><th>Foto</th><th>Jugador</th><th>Rol</th><th>Edad</th><th>Nac.</th><th>Equipo</th><th>Media scouteada</th><th>Cláusula</th><th>Sueldo</th><th>Aceptación</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="11" class="muted">No hay jugadores contratados que coincidan con los filtros.</td></tr>'}</tbody></table></div>
    ${marketMoreButtonMarkup(filteredPlayers.length, players.length)}`;
  bindMarketTabs();
  bindMarketFilters();
  bindMarketMoreButton();
  document.querySelectorAll('[data-make-player-offer]').forEach(btn => btn.addEventListener('click', () => openPurchaseOfferModal(Number(btn.dataset.makePlayerOffer))));
}

function hireFreeAgent(playerId){
  const idx = (game.marketPlayers || []).findIndex(p => Number(p.id) === Number(playerId) && Number(p.clubId || 0) === 0 && !p.sold);
  if(idx < 0) return;
  if(isFreeAgentOfferBlockedThisSeason(playerId)){ showNotice('El jugador ya rechazó una oferta de este club. Podrás volver a intentar la próxima temporada.'); return; }
  if(!hasFirstTeamRosterSpace(game.selectedClubId, 1)){ showRosterLimitNotice(); return; }
  const chance = freeAgentAcceptanceChance(game.marketPlayers[idx]);
  const roll = Math.random() * 100;
  if(roll >= chance){
    const rejected = game.marketPlayers[idx];
    markFreeAgentOfferRejected(playerId, chance);
    pushGameMessage({ type:'mercado', title:'Libre rechazó la oferta', body:`${rejected?.name || 'El jugador'} rechazó negociar con ${clubName(game.selectedClubId)}. La decisión depende de su media real y del prestigio del club. Podrás volver a intentar la próxima temporada.`, priority:'normal' });
    saveLocal(true);
    showNotice(`${rejected?.name || 'Jugador'} rechazó la oferta.`);
    renderMarket();
    return;
  }
  game.marketPlayers[idx].clubId = game.selectedClubId;
  game.marketPlayers[idx].freeAgent = false;
  game.marketPlayers[idx].transferListed = false;
  game.marketPlayers[idx].intransferible = false;
  mergeMarketPlayersIntoSeed(game.marketPlayers);
  const player = playerById(playerId);
  if(player){
    player.clubId = game.selectedClubId;
    player.freeAgent = false;
    player.transferListed = false;
    player.intransferible = false;
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
  pushGameMessage({ type:'mercado', title:'Jugador libre contratado', body:`${player?.name || 'El jugador'} aceptó la oferta y se incorporó al plantel como agente libre.`, priority:'normal' });
  saveLocal(true);
  showNotice(`${player?.name || 'Jugador'} contratado.`);
  renderMarket();
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
    resistencia_desc:(a,b)=>visibleStats(b).Resistencia-visibleStats(a).Resistencia || byName(a,b),
    resistencia_asc:(a,b)=>visibleStats(a).Resistencia-visibleStats(b).Resistencia || byName(a,b),
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
function columnSort(label, options){
  const opts = ['<option value="">—</option>'].concat(options.map(([value,text])=>`<option value="${value}" ${squadSort===value?'selected':''}>${text}</option>`)).join('');
  return `<div class="th-filter"><span>${label}</span><select data-squad-sort>${opts}</select></div>`;
}

function trainingColumnSort(label, options){
  const opts = ['<option value="">—</option>'].concat(options.map(([value,text])=>`<option value="${value}" ${trainingSort===value?'selected':''}>${text}</option>`)).join('');
  return `<div class="th-filter"><span>${label}</span><select data-training-sort>${opts}</select></div>`;
}

function worldPlayerTeamMarkup(player){
  const clubId = Number(player.clubId || 0);
  if(clubId > 0){
    return `<button class="linklike team-cell" data-club-id="${clubId}">${clubBadge(clubId)}<span>${escapeHtml(clubName(clubId))}</span></button>`;
  }
  if(clubId < 0 || player.sold) return '<span class="pill">Exterior</span>';
  return '<span class="pill">Agente libre</span>';
}
function worldPlayersPositionOptions(){
  const positions = ['all','POR','LD','LI','DFC','MCD','MC','MI','MD','MCO','ED','EI','DC'];
  return positions.map(pos => `<option value="${pos}" ${worldPlayersPositionFilter===pos?'selected':''}>${pos==='all'?'Todas':pos}</option>`).join('');
}
function worldPlayersClubOptions(){
  const clubs = (seed.clubs || []).slice().sort((a,b)=>a.name.localeCompare(b.name,'es'));
  const fixed = [
    `<option value="all" ${worldPlayersClubFilter==='all'?'selected':''}>Todos</option>`,
    `<option value="free" ${worldPlayersClubFilter==='free'?'selected':''}>Agentes libres</option>`,
    `<option value="foreign" ${worldPlayersClubFilter==='foreign'?'selected':''}>Exterior</option>`
  ];
  return fixed.concat(clubs.map(c => `<option value="${c.id}" ${String(worldPlayersClubFilter)===String(c.id)?'selected':''}>${escapeHtml(c.name)}</option>`)).join('');
}
function worldPlayerFilterList(players){
  return players.filter(player => {
    if(worldPlayersPositionFilter !== 'all' && player.position !== worldPlayersPositionFilter) return false;
    const clubId = Number(player.clubId || 0);
    if(worldPlayersClubFilter === 'free') return clubId === 0 && !player.sold;
    if(worldPlayersClubFilter === 'foreign') return clubId < 0 || player.sold;
    if(worldPlayersClubFilter !== 'all') return clubId === Number(worldPlayersClubFilter);
    return true;
  });
}
function worldPlayersColumnSort(label, options){
  const opts = ['<option value="">—</option>'].concat(options.map(([value,text])=>`<option value="${value}" ${worldPlayersSort===value?'selected':''}>${text}</option>`)).join('');
  return `<div class="th-filter"><span>${label}</span><select data-world-sort>${opts}</select></div>`;
}
function worldStatCell(player, key){
  const map = scoutingStatMap(player);
  const visible = scoutingVisibleKeys(player);
  return visible.has(key) ? `<strong>${map[key]}</strong>` : '<span class="muted">—</span>';
}
function worldPlayerRow(player){
  return `<tr class="${Number(player.clubId || 0) === game.selectedClubId ? 'own-player-row' : ''}">
    <td>${faceImg(player, 'photo-thumb')}</td>
    <td><button class="linklike" data-player-id="${player.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player.name)}</strong></button></td>
    <td><span class="pill role-pill">${roleBadge(player.position)}</span></td>
    <td>${Number(player.age || 0) || '—'}</td>
    <td>${worldPlayerTeamMarkup(player)}</td>
    <td>${formatMoney(player.clause || player.value || 0)}</td>
    <td>${formatMoney(player.salary || 0)}</td>
    <td>${worldStatCell(player,'Ataque/Salto')}</td>
    <td>${worldStatCell(player,'Defensa')}</td>
    <td>${worldStatCell(player,'Pase')}</td>
    <td>${worldStatCell(player,'Velocidad/Reflejos')}</td>
    <td>${worldStatCell(player,'Cabezazo/Mando')}</td>
    <td>${worldStatCell(player,'Tiro/Potencia')}</td>
    <td>${worldStatCell(player,'Resistencia')}</td>
  </tr>`;
}
function renderWorldPlayers(){
  mergeMarketPlayersIntoSeed(game.marketPlayers || []);
  ensurePlayerStateForAll();
  const basePlayers = seed.players.filter(p => !p.retired);
  const filtered = worldPlayerFilterList(basePlayers);
  const players = sortPlayersForView(filtered, worldPlayersSort);
  const rows = players.map(worldPlayerRow).join('');
  view.innerHTML = `
    <div class="section-title">
      <h2>Jugadores</h2>
      <p class="tagline">Listado mundial. Las habilidades externas sólo aparecen si fueron reveladas por el Centro de Ojeo.</p>
    </div>
    <div class="card world-player-filters">
      <label>Posición<select id="worldPositionFilter">${worldPlayersPositionOptions()}</select></label>
      <label>Equipo<select id="worldClubFilter">${worldPlayersClubOptions()}</select></label>
      <span class="pill">${players.length} jugador(es)</span>
    </div>
    <div class="table-wrap world-players-wrap"><table class="world-players-table"><thead><tr>
      <th>Foto</th>
      <th>${worldPlayersColumnSort('Nombre', [['nombre_asc','A-Z'],['nombre_desc','Z-A']])}</th>
      <th>${worldPlayersColumnSort('Pos.', [['posicion_asc','POR → DEF → MED → DEL'],['posicion_desc','DEL → MED → DEF → POR']])}</th>
      <th>${worldPlayersColumnSort('Edad', [['edad_asc','Menor'],['edad_desc','Mayor']])}</th>
      <th>Equipo</th>
      <th>${worldPlayersColumnSort('Cláusula', [['valor_desc','Mayor'],['valor_asc','Menor']])}</th>
      <th>Sueldo</th>
      <th>Ataque/Salto</th>
      <th>Defensa</th>
      <th>Pase</th>
      <th>Vel./Ref.</th>
      <th>Cab./Mando</th>
      <th>Tiro/Pot.</th>
      <th>Resist.</th>
    </tr></thead><tbody>${rows || '<tr><td colspan="14" class="muted">No hay jugadores para mostrar.</td></tr>'}</tbody></table></div>`;
  $('worldPositionFilter')?.addEventListener('change', event => { worldPlayersPositionFilter = event.target.value || 'all'; renderWorldPlayers(); });
  $('worldClubFilter')?.addEventListener('change', event => { worldPlayersClubFilter = event.target.value || 'all'; renderWorldPlayers(); });
  document.querySelectorAll('[data-world-sort]').forEach(select => {
    select.addEventListener('change', () => {
      if(select.value){ worldPlayersSort = select.value; renderWorldPlayers(); }
    });
  });
}

function renderSquad(){
  const players = sortedSquadPlayers();
  const rows = players.map(p=>`
    <tr class="${isUnavailable(p.id) ? 'dim-row' : ''}">
      <td>${faceImg(p, 'photo-thumb')}</td>
      <td><button class="linklike" data-player-id="${p.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(p) : escapeHtml(p.name)}</strong></button></td>
      <td>#${jerseyNumber(p.id)}</td>
      <td>${Number(p.age || 0) || '—'}</td>
      <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
      <td>${nationalityShortMarkup(p.nationality)}</td>
      <td><strong>${visibleOverall(p)}</strong></td>
      <td>${conditionBar(p.id)}</td>
      <td>${moraleBar(p.id)}</td>
      <td>${visibleStats(p).Resistencia}</td>
      <td>${availabilityStatusMarkup(p.id)}</td>
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
      <th>${columnSort('Estado físico', [['condicion_desc','Mayor a menor'],['condicion_asc','Menor a mayor']])}</th>
      <th>${columnSort('Moral', [['moral_desc','Mayor a menor'],['moral_asc','Menor a mayor']])}</th>
      <th>${columnSort('Resistencia', [['resistencia_desc','Mayor a menor'],['resistencia_asc','Menor a mayor']])}</th>
      <th>${columnSort('Estado', [['estado_disponible','Disponibles primero'],['estado_no_disponible','No disponibles primero']])}</th>
      <th>${columnSort('Cláusula', [['valor_desc','Mayor a menor'],['valor_asc','Menor a mayor']])}</th>
    </tr></thead><tbody>${rows}</tbody></table></div>
  `;
  prependFirstTeamTabs('squad');
  document.querySelectorAll('[data-squad-sort]').forEach(select => {
    select.addEventListener('change', e => {
      if(e.target.value){ squadSort = e.target.value; renderSquad(); }
    });
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
function tacticPlayerCard(p, extra='', zone='reserve', index=-1){
  const statusIcons = availabilityIcons(p.id);
  const unavailableClass = isUnavailable(p.id) ? 'injured-card' : '';
  const playableInjuredClass = canUseInjuredAsSub(p.id) ? 'playable-injured-card' : '';
  return `<button type="button" class="drag-player tactic-click-player ${playerGroupClass(p.position)} ${extra} ${unavailableClass} ${playableInjuredClass}${tacticSelectionClass(p.id)}" data-tactic-player="${p.id}" data-tactic-zone="${zone}" data-tactic-index="${index}" title="Click para seleccionar o intercambiar">
    ${faceImg(p, 'drag-face')}
    <span class="tactic-card-text"><strong>${statusIcons}${escapeHtml(playerLastName(p.name))}</strong><span>#${jerseyNumber(p.id)} · ${roleBadge(p.position)} · ${Number(p.age || 0) || '—'} años · ${visibleOverall(p)} · Fís. ${currentCondition(p.id)}/99 · Mor. ${currentMorale(p.id)}/99</span></span>
  </button>`;
}
function playerDragCard(p, extra=''){
  return tacticPlayerCard(p, extra);
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
    <div class="row"><div><h3>Tácticas personalizadas</h3></div></div>
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
function renderTactics(){
  game.tactic = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic));
  const formationOptions = Object.keys(FORMATIONS).map(f=>`<option value="${f}" ${game.tactic.formation===f?'selected':''}>${f}</option>`).join('');
  const starters = game.tactic.starters.map(playerById).filter(Boolean);
  const bench = game.tactic.bench.map(playerById).filter(Boolean);
  const starterSet = new Set(game.tactic.starters);
  const benchSet = new Set(game.tactic.bench);
  const reserves = playersByClub(game.selectedClubId)
    .filter(p => !starterSet.has(p.id) && !benchSet.has(p.id))
    .sort((a,b)=>positionOrder(a.position)-positionOrder(b.position) || visibleOverall(b)-visibleOverall(a));
  const pitch = pitchSlots(game.tactic).map(slot => {
    const fit = slot.player ? playerFitsSlot(slot.player, slot.slot) : true;
    const fitLevel = slot.player ? playerTacticFitLevel(slot.player, slot.slot) : 'exact';
    const fitClass = fitLevel === 'zone' ? 'out-zone' : fitLevel === 'role' ? 'off-role' : '';
    const chip = slot.player ? `
      <button type="button" class="player-chip tactic-click-player mentality-${playerMentality(slot.player.id)} ${playerGroupClass(slot.player.position)} ${fitClass}${tacticSelectionClass(slot.player.id)}" data-tactic-player="${slot.player.id}" data-tactic-zone="starter" data-tactic-index="${slot.index}" title="${playerTacticFitTitle(slot.player, slot.slot)} · Click para cambiar estado: ${escapeHtml(mentalityLabel(playerMentality(slot.player.id)))}">
        <span class="jersey-dot">${jerseyNumber(slot.player.id)}</span>
        <span class="player-chip-name">${escapeHtml(playerLastName(slot.player.name))}</span>
        ${mentalityMarker(slot.mentality)}
      </button>` : `<button type="button" class="empty-slot ${slotGroup(slot.slot)} tactic-empty-slot" data-tactic-empty-slot="${slot.index}" title="Seleccioná un jugador y hacé click acá"><strong>${slot.slot}</strong><span>Vacío</span></button>`;
    return `<div class="pitch-slot" style="left:${slot.x}%; top:${slot.y}%">${chip}</div>`;
  }).join('');
  const starterList = pitchSlots(game.tactic).map(slot => {
    const p = slot.player;
    const fit = p ? playerFitsSlot(p, slot.slot) : false;
    return `<div class="lineup-row tactic-lineup-row ${p && !fit ? 'bad-zone' : ''}${p ? tacticSelectionClass(p.id) : ''}" ${p ? `data-tactic-player="${p.id}" data-tactic-zone="starter" data-tactic-index="${slot.index}"` : `data-tactic-empty-slot="${slot.index}"`}>
      <span class="pill">${slot.index+1}. ${slot.slot}</span>
      <span>${p ? `<strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(p) : escapeHtml(p.name)}</strong>` : '<span class="muted">Vacío</span>'}</span>
      <span class="age-cell lineup-center-cell">${p ? `${Number(p.age || 0) || '—'} años` : '—'}</span>
      <span class="lineup-center-cell">${p ? `<strong>${visibleOverall(p)}</strong>` : '—'}</span>
      <span class="lineup-center-cell">${p ? conditionBar(p.id) : ''}</span>
      <span class="lineup-center-cell">${p ? moraleBar(p.id) : ''}</span>
      <strong class="lineup-center-cell">${p ? (isInjured(p.id) ? tacticStatusIcon(p.id) : playerTacticFitLabel(p, slot.slot)) : 'Click'}</strong>
    </div>`;
  }).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Táctica y convocatoria</h2></div>
    <div class="card tactic-board-card">
      <div class="row tactic-top-row"><div><h3>Cancha táctica</h3><p class="muted small">Formación ${game.tactic.formation}</p></div><div class="formation-box"><label>Formación</label><select id="formation">${formationOptions}</select></div><div class="tactic-autopick-row"><button id="autoPickBestBtn" class="ghost">Mejor once</button><button id="autoPickConditionBtn" class="ghost">Mejor condición física</button></div></div>
      <div class="tactic-click-help">${tacticSelectionHint()}</div>
      <div class="tactic-board-layout">
        <aside class="tactic-board-side tactic-board-left tactic-board-visors" aria-label="Visores tácticos">
          ${tacticSectorSkillVisors()}
        </aside>
        <div class="pitch-board-wrap">
          <div class="pitch-board centered">${pitch}</div>
          <div class="tactic-state-legend">
            <span>${mentalityMarker('muy_defensivo')} Muy defensivo</span>
            <span>${mentalityMarker('defensivo')} Defensivo</span>
            <span>${mentalityMarker('normal')} Normal</span>
            <span>${mentalityMarker('ofensivo')} Ofensivo</span>
            <span>${mentalityMarker('muy_ofensivo')} Muy ofensivo</span>
          </div>
        </div>
        <aside class="tactic-board-side tactic-board-right">
          <h3>Instrucciones zonales</h3>
          <p class="muted small">Defensa, medios y delanteros. Pueden contraponerse o no con la mentalidad individual de cada jugador.</p>
          <div class="sector-style-grid vertical">${sectorStyleControls()}</div>
        </aside>
      </div>
    </div>
    ${savedTacticsPanelMarkup()}
    <div class="grid cols-2 tactic-lists" style="margin-top:14px">
      <div class="card">
        <h3>Titulares</h3>
        <div class="lineup-row lineup-head"><span>Pos.</span><span>Jugador</span><span class="lineup-center-cell">Edad</span><span class="lineup-center-cell">Media</span><span class="lineup-center-cell">Físico</span><span class="lineup-center-cell">Moral</span><span class="lineup-center-cell">Estado</span></div>
        <div class="lineup-list">${starterList}</div>
      </div>
      <div class="card">
        <h3>Suplentes / reservas</h3>
        <div class="drop-pool" data-drop-pool="bench"><h4>Suplentes (${bench.length}/10)</h4><div class="drag-list">${bench.length ? bench.map((p,i)=>tacticPlayerCard(p,'bench-card','bench',i)).join('') : '<p class="muted small">Sin suplentes.</p>'}</div></div>
        <div class="drop-pool" data-drop-pool="reserve"><h4>Reservas</h4><div class="drag-list">${reserves.length ? reserves.map((p,i)=>tacticPlayerCard(p,'reserve-card','reserve',i)).join('') : '<p class="muted small">Sin reservas.</p>'}</div></div>
      </div>
    </div>
    <div class="card" style="margin-top:14px">
      <h3>Cambios automáticos</h3>
      <p class="muted small">Elegí reglas simples: cansados, mejores suplentes o sólo cambios obligados por lesión.</p>
      <div class="autosub-grid">${[0,1,2,3,4].map(i => autoSubRow(i)).join('')}</div>
    </div>
    <div class="row sticky-actions"><button id="saveTactic" class="primary">Confirmar equipo</button><span id="tacticErrors" class="bad small"></span></div>
  `;
  prependFirstTeamTabs('tactics');
  $('formation').addEventListener('change', () => {
    const tentative = {...game.tactic, formation:$('formation').value};
    const autoStarters = autoSelectStarters(game.selectedClubId, tentative).map(p=>p.id);
    game.tactic.starters = autoStarters;
    game.tactic.bench = autoSelectBench(game.selectedClubId, autoStarters).map(p=>p.id);
    game.tactic.autoSubs = defaultAutoSubs(game.tactic.starters, game.tactic.bench);
    game.tactic.formation = tentative.formation;
    game.tactic = applyStarterMentalities(game.tactic);
    saveLocal(true);
    renderTactics();
  });
  $('autoPickBestBtn').addEventListener('click', () => {
    game.tactic.formation = $('formation').value;
    const starters = autoSelectStarters(game.selectedClubId, game.tactic).map(p=>p.id);
    game.tactic.starters = starters;
    game.tactic.bench = autoSelectBench(game.selectedClubId, starters).map(p=>p.id);
    game.tactic.autoSubs = defaultAutoSubs(game.tactic.starters, game.tactic.bench);
    game.tactic = applyStarterMentalities(game.tactic);
    saveLocal(true);
    renderTactics();
  });
  $('autoPickConditionBtn').addEventListener('click', () => {
    game.tactic.formation = $('formation').value;
    const starters = autoSelectByBestCondition(game.selectedClubId).map(p=>p.id);
    game.tactic.starters = starters;
    game.tactic.bench = autoSelectBenchByBestCondition(game.selectedClubId, starters).map(p=>p.id);
    game.tactic.autoSubs = defaultAutoSubs(game.tactic.starters, game.tactic.bench);
    game.tactic = applyStarterMentalities(game.tactic);
    saveLocal(true);
    renderTactics();
  });
  $('saveTactic').addEventListener('click', saveTacticFromScreen);
  bindSavedTacticButtons();
  bindTacticClickEvents();
}
function tacticPlayerRow(p){
  const current = game.tactic.starters.includes(p.id) ? 'starter' : game.tactic.bench.includes(p.id) ? 'bench' : 'reserve';
  const unavailable = isUnavailable(p.id);
  const benchAllowed = canBeBench(p.id);
  const roleDisabled = isSuspended(p.id) || (isInjured(p.id) && !benchAllowed);
  const mentalityText = current === 'starter' ? playerMentality(p.id) : '—';
  return `<tr class="${unavailable ? 'dim-row' : ''}">
    <td><button class="linklike" data-player-id="${p.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(p) : escapeHtml(p.name)}</strong></button></td>
    <td>#${jerseyNumber(p.id)}</td>
    <td>${Number(p.age || 0) || '—'}</td>
    <td><span class="pill role-pill">${roleBadge(p.position)}</span></td>
    <td><strong>${visibleOverall(p)}</strong></td>
    <td>${currentCondition(p.id)}/99</td>
    <td>${availabilityStatusMarkup(p.id)}</td>
    <td><select class="role-select" data-role-player="${p.id}" ${roleDisabled ? 'disabled' : ''}>
      <option value="reserve" ${current==='reserve'?'selected':''}>Reserva</option>
      <option value="starter" ${current==='starter'?'selected':''}>Titular</option>
      <option value="bench" ${current==='bench'?'selected':''}>Suplente</option>
    </select></td>
    <td>${current === 'starter' ? mentalityMarker(mentalityText) + ' ' + escapeHtml(mentalityLabel(mentalityText)) : '<span class="muted">Sólo titulares</span>'}</td>
  </tr>`;
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
function matchInstructionControls(){
  const current = window.Simulator20?.normalizeMatchInstructions
    ? window.Simulator20.normalizeMatchInstructions(game.tactic?.matchInstructions)
    : { winning:'normal', drawing:'normal', losing:'normal' };
  const options = window.MATCH_INSTRUCTION_OPTIONS || [
    { value:'lower', label:'Bajar el ritmo' },
    { value:'normal', label:'Normal' },
    { value:'push', label:'Subir ritmo' }
  ];
  const row = (key, label) => `<div class="instruction-control"><label>${label}</label><select data-match-instruction="${key}">${options.map(opt=>`<option value="${opt.value}" ${current[key]===opt.value?'selected':''}>${opt.label}</option>`).join('')}</select></div>`;
  return row('winning','Ganando') + row('drawing','Empatando') + row('losing','Perdiendo');
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
    starters:game.tactic.starters.slice(0,11),
    bench:game.tactic.bench.slice(0,10),
    autoSubs,
    playerMentalities:{ ...(game.playerMentalities || {}), ...(game.tactic.playerMentalities || {}) },
    matchInstructions: window.Simulator20?.normalizeMatchInstructions ? window.Simulator20.normalizeMatchInstructions(selectedInstructions) : selectedInstructions,
    sectorStyles:selectedSectorStyles
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
  const unavailableBench = [...uniqueBench].filter(id => !canBeBench(id));
  if(unavailableBench.length) errors.push('En el banco sólo se permiten disponibles o lesionados con recuperación menor a 70 días.');
  const slots = FORMATIONS[tactic.formation] || FORMATIONS['4-4-2'];
  slots.forEach((slot, index) => {
    const player = playerById(starters[index]);
    if(player && !canAssignPlayerToSlot(player, slot)) errors.push(slot === 'POR' ? 'El titular en POR debe ser portero.' : 'Un portero no puede jugar como jugador de campo.');
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

