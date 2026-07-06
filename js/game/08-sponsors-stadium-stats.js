/* V3.14 · Sponsors, estadio, calendario, tabla, estadísticas y finanzas visuales. */

function randomInt(min,max){
  return Math.floor(rnd(min, max + 1));
}
function createInitialSponsorState(){
  return { active:[], offers:[], matchesSinceOffer:0, nextOfferAfter:randomInt(SPONSOR_OFFER_MATCH_MIN, SPONSOR_OFFER_MATCH_MAX), lastOfferTurn:-1, openingOffersSeason:0 };
}
function normalizeSponsorState(state){
  const base = createInitialSponsorState();
  const clean = { ...base, ...(state || {}) };
  clean.active = Array.isArray(clean.active) ? clean.active : [];
  clean.offers = Array.isArray(clean.offers) ? clean.offers : [];
  clean.matchesSinceOffer = Number.isFinite(clean.matchesSinceOffer) ? clean.matchesSinceOffer : 0;
  clean.nextOfferAfter = Number.isFinite(clean.nextOfferAfter) ? clean.nextOfferAfter : randomInt(SPONSOR_OFFER_MATCH_MIN, SPONSOR_OFFER_MATCH_MAX);
  clean.lastOfferTurn = Number.isFinite(clean.lastOfferTurn) ? clean.lastOfferTurn : -1;
  clean.openingOffersSeason = Number.isFinite(clean.openingOffersSeason) ? clean.openingOffersSeason : 0;
  return clean;
}
function ensureSponsorState(){
  if(!game) return;
  game.sponsors = normalizeSponsorState(game.sponsors);
}
function sponsorDivisionMultiplier(){
  const club = seed.clubs.find(c => c.id === game.selectedClubId) || {};
  const order = Number(club.divisionOrder || clubDivision(game.selectedClubId).order || 1);
  if(order <= 1) return 10;
  if(order === 2) return 4;
  return 1;
}
function sponsorPositionBonus(){
  const division = clubDivision(game.selectedClubId);
  const table = sortedStandings(division.id);
  const index = table.findIndex(row => row.clubId === game.selectedClubId);
  if(index < 0 || table.length <= 1) return 0;
  return ((table.length - (index + 1)) / (table.length - 1)) * 0.20;
}
function sponsorMoraleBonus(){
  return (squadMoraleAverage(game.selectedClubId) / 100) * 0.10;
}
function sponsorCohesionBonus(){
  return (cohesionValue(game.selectedClubId) / 100) * 0.10;
}
function sponsorOfferValue(baseSponsor, lugar){
  const base = Number(baseSponsor?.valor_base_por_7_dias || 0);
  const place = Number(lugar?.multiplicador_lugar || 1);
  const totalMultiplier = sponsorDivisionMultiplier() * place * (1 + sponsorPositionBonus() + sponsorMoraleBonus() + sponsorCohesionBonus());
  const perTurn = Math.round(base * SPONSOR_BASE_VALUE_FACTOR * totalMultiplier);
  const durationDays = Number(baseSponsor?.dias_duracion_oferta || 0);
  const turns = clamp(Math.round(durationDays > 0 ? durationDays / DAYS_PER_ADVANCE : randomInt(3,35)), 3, 35);
  return { perTurn, turns, total:perTurn * turns };
}
function occupiedSponsorPlaces(){
  ensureSponsorState();
  return new Set((game.sponsors.active || []).filter(item => Number(item.turnsRemaining || 0) > 0).map(item => item.placeId));
}
function sponsorPlaceById(id){
  return (sponsorsDatabase?.lugares_sponsor || []).find(place => place.id_lugar === id) || null;
}
function sponsorBrandById(id){
  return (sponsorsDatabase?.sponsors || []).find(sponsor => sponsor.id_sponsor === id) || null;
}
function generateSponsorOffers(forcedCount=null, options={}){
  ensureSponsorState();
  const lugares = (sponsorsDatabase?.lugares_sponsor || []).filter(place => !occupiedSponsorPlaces().has(place.id_lugar));
  const sponsors = (sponsorsDatabase?.sponsors || []).filter(sponsor => sponsor.activo !== false);
  if(!lugares.length || !sponsors.length) return [];
  const requestedCount = Number.isFinite(Number(forcedCount)) ? Number(forcedCount) : randomInt(SPONSOR_OFFER_COUNT_MIN, SPONSOR_OFFER_COUNT_MAX);
  const count = Math.min(Math.max(1, Math.round(requestedCount)), lugares.length, sponsors.length);
  const usedPlaces = new Set();
  const usedSponsors = new Set();
  const offers = [];
  let guard = 0;
  while(offers.length < count && guard < 200){
    guard += 1;
    const sponsor = sponsors[randomInt(0, sponsors.length - 1)];
    const place = lugares[randomInt(0, lugares.length - 1)];
    if(!sponsor || !place || usedSponsors.has(sponsor.id_sponsor) || usedPlaces.has(place.id_lugar)) continue;
    usedSponsors.add(sponsor.id_sponsor);
    usedPlaces.add(place.id_lugar);
    const value = sponsorOfferValue(sponsor, place);
    offers.push({
      id:`SPON-${game.seasonNumber || 1}-${currentSeasonTurnNumber()}-${sponsor.id_sponsor}-${place.id_lugar}-${hashNumber(String(Math.random()), 100000)}`,
      sponsorId:sponsor.id_sponsor,
      sponsorName:sponsor.nombre_marca,
      category:sponsor.categoria,
      placeId:place.id_lugar,
      placeName:place.nombre,
      placeType:place.tipo,
      perTurn:value.perTurn,
      turns:value.turns,
      total:value.total,
      createdTurn:currentTurnIndex(),
      season:game.seasonNumber || 1
    });
  }
  game.sponsors.offers = offers;
  game.sponsors.matchesSinceOffer = 0;
  game.sponsors.nextOfferAfter = randomInt(SPONSOR_OFFER_MATCH_MIN, SPONSOR_OFFER_MATCH_MAX);
  game.sponsors.lastOfferTurn = currentTurnIndex();
  if(offers.length && options.silent !== true){
    pushGameMessage({
      type:'finanzas',
      title:options.title || 'Nuevas ofertas de sponsors',
      body:options.body || `Llegaron ${offers.length} oferta(s) de patrocinio para el club.`,
      priority:options.priority || 'normal'
    });
  }
  return offers;
}
function generateOpeningSponsorOffers(force=false){
  ensureSponsorState();
  const season = Number(game?.seasonNumber || 1);
  if(!force && Number(game.sponsors.openingOffersSeason || 0) === season) return game.sponsors.offers || [];
  const offers = generateSponsorOffers(SPONSOR_OPENING_OFFER_COUNT, {
    title:'Ofertas iniciales de sponsors',
    body:'Llegaron 2 ofertas de patrocinio para el inicio de temporada.'
  });
  if(offers.length){
    game.sponsors.openingOffersSeason = season;
    game.sponsors.matchesSinceOffer = 0;
    game.sponsors.nextOfferAfter = randomInt(SPONSOR_OFFER_MATCH_MIN, SPONSOR_OFFER_MATCH_MAX);
  }
  return offers;
}
function advanceSponsorMatchCounter(){
  ensureSponsorState();
  game.sponsors.matchesSinceOffer = Number(game.sponsors.matchesSinceOffer || 0) + 1;
  if(game.sponsors.matchesSinceOffer >= Number(game.sponsors.nextOfferAfter || SPONSOR_OFFER_MATCH_MIN)){
    generateSponsorOffers();
  }
}
function processSponsorContracts(){
  ensureSponsorState();
  game.sponsors.active = (game.sponsors.active || []).map(contract => ({ ...contract, turnsRemaining:Math.max(0, Number(contract.turnsRemaining || 0) - 1) })).filter(contract => Number(contract.turnsRemaining || 0) > 0);
}
function acceptSponsorOffer(offerId){
  ensureSponsorState();
  const index = game.sponsors.offers.findIndex(offer => offer.id === offerId);
  if(index < 0) return;
  const offer = game.sponsors.offers[index];
  if(occupiedSponsorPlaces().has(offer.placeId)){
    showNotice('Ese lugar ya está ocupado por otro sponsor.');
    return;
  }
  game.sponsors.offers.splice(index, 1);
  game.sponsors.active.push({
    ...offer,
    acceptedTurn:currentTurnIndex(),
    turnsRemaining:offer.turns
  });
  recordBudgetChange(offer.total, `Sponsor: ${offer.sponsorName} / ${offer.placeName}`, { type:'sponsor', sponsorId:offer.sponsorId, placeId:offer.placeId });
  pushGameMessage({ type:'finanzas', title:'Sponsor aceptado', body:`${offer.sponsorName} pagó ${formatMoney(offer.total)} por ${offer.placeName}.`, priority:'normal' });
  saveLocal(true);
  showNotice(`Sponsor aceptado: ${offer.sponsorName}.`);
  renderStadium();
}
function rejectSponsorOffer(offerId){
  ensureSponsorState();
  game.sponsors.offers = (game.sponsors.offers || []).filter(offer => offer.id !== offerId);
  saveLocal(true);
  renderStadium();
}
function sponsorOffersMarkup(){
  ensureSponsorState();
  const offers = game.sponsors.offers || [];
  if(!offers.length){
    return `<p class="muted small">Sin ofertas disponibles. Intenta ganar partidos para tentar a las marcas a anunciarse con nosotros.</p>`;
  }
  return `<div class="table-wrap"><table class="sponsor-table"><thead><tr><th>Marca</th><th>Lugar</th><th>Días</th><th>Por 7 días</th><th>Pago inmediato</th><th></th></tr></thead><tbody>${offers.map(offer => `<tr>
    <td><strong>${escapeHtml(offer.sponsorName)}</strong><span class="muted small">${escapeHtml(offer.category || '')}</span></td>
    <td>${escapeHtml(offer.placeName)}</td>
    <td>${formatDaysFromTurns(offer.turns)}</td>
    <td>${formatMoney(offer.perTurn)}</td>
    <td><strong class="ok">${formatMoney(offer.total)}</strong></td>
    <td><button class="primary small-btn" data-accept-sponsor="${escapeHtml(offer.id)}">Aceptar</button><button class="ghost small-btn" data-reject-sponsor="${escapeHtml(offer.id)}">Rechazar</button></td>
  </tr>`).join('')}</tbody></table></div>`;
}
function activeSponsorsMarkup(){
  ensureSponsorState();
  const active = game.sponsors.active || [];
  if(!active.length) return '<p class="muted small">Todavía no hay contratos activos.</p>';
  return `<div class="table-wrap"><table class="sponsor-table"><thead><tr><th>Marca</th><th>Lugar</th><th>Días restantes</th><th>Pago recibido</th></tr></thead><tbody>${active.map(item => `<tr><td><strong>${escapeHtml(item.sponsorName)}</strong></td><td>${escapeHtml(item.placeName)}</td><td>${formatDaysFromTurns(item.turnsRemaining)}</td><td>${formatMoney(item.total || 0)}</td></tr>`).join('')}</tbody></table></div>`;
}


function renderStadium(){
  ensureStadiumState();
  ensureSponsorState();
  const club = seed.clubs.find(c=>c.id===game.selectedClubId);
  const score = fieldScoreForClub(game.selectedClubId);
  const label = fieldConditionName(score);
  const project = stadiumProjectForClub(game.selectedClubId);
  const replantActive = project.replantingTurnsLeft > 0;
  const patchActive = project.patchingTurnsLeft > 0;
  const replantProgress = replantActive ? Math.round(((REPLANT_TURNS - project.replantingTurnsLeft) / REPLANT_TURNS) * 100) : 0;
  const patchProgress = patchActive ? Math.round(((PATCH_TURNS - project.patchingTurnsLeft) / PATCH_TURNS) * 100) : 0;
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Estadio</h2>
        <p class="tagline">Estado del campo de ${escapeHtml(clubName(game.selectedClubId))}. Cada partido como local nuestro campo de juego empeora, dale mantenimiento para evitar lesiones y dificultades para dar pases precisos.</p>
      </div>
      <div class="pill">Presupuesto: ${formatMoney(game.budget || 0)}</div>
    </div>
    <div class="grid cols-2">
      <div class="card stadium-card">
        <h3>Campo de juego</h3>
        <p class="label">Estado actual</p>
        <div class="stadium-score-row"><strong class="field-state ${fieldConditionClass(score)}">${escapeHtml(label)}</strong><span>${score}/100</span></div>
        ${fieldBar(score, label)}

      </div>
      <div class="card stadium-card">
        <h3>Mantenimiento</h3>
        <div class="stack">
          <div class="maintenance-option">
            <div><strong>Replantar todo</strong><p class="muted small">Costo ${formatMoney(REPLANT_COST)}. Durante 35 días el campo queda muy malo; al finalizar sube a 99.</p></div>
            <button id="btnReplant" class="primary" ${replantActive || patchActive || (game.budget || 0) < REPLANT_COST ? 'disabled' : ''}>Replantar</button>
          </div>
          <div class="maintenance-option">
            <div><strong>Regar y parchar campo de juego</strong><p class="muted small">Costo ${formatMoney(PATCH_COST)}. Mejora el campo durante los próximos 21 días.</p></div>
            <button id="btnPatch" class="ghost" ${replantActive || patchActive || (game.budget || 0) < PATCH_COST ? 'disabled' : ''}>Regar y parchar</button>
          </div>
        </div>
      </div>
    </div>
    ${replantActive ? `<div class="card stadium-progress-card" style="margin-top:14px"><div class="row"><h3>Replantando</h3><span class="pill">${formatDaysFromTurns(project.replantingTurnsLeft)} restante(s)</span></div><div class="project-progress"><span style="width:${replantProgress}%"></span></div><p class="muted small">Durante el replante el campo se mantiene en estado muy malo. Al finalizar pasará a 99.</p></div>` : ''}
    ${patchActive ? `<div class="card stadium-progress-card" style="margin-top:14px"><div class="row"><h3>Regando y parchando campo de juego</h3><span class="pill">${formatDaysFromTurns(project.patchingTurnsLeft)} restante(s)</span></div><div class="project-progress"><span style="width:${patchProgress}%"></span></div><p class="muted small">El campo mejora progresivamente mientras dura el mantenimiento.</p></div>` : ''}
    <div class="card sponsors-card" style="margin-top:14px">
      <div class="row"><div><h3>Sponsors</h3><p class="muted small">Cada algunos partidos tendras ofertas publicitarias. El pago se recibe completo al aceptar.</p></div></div>
      <h4>Ofertas disponibles</h4>
      ${sponsorOffersMarkup()}
      <h4 style="margin-top:14px">Contratos activos</h4>
      ${activeSponsorsMarkup()}
    </div>
  `;
  $('btnReplant')?.addEventListener('click', startReplantingField);
  $('btnPatch')?.addEventListener('click', startPatchingField);
  document.querySelectorAll('[data-accept-sponsor]').forEach(btn => btn.addEventListener('click', () => acceptSponsorOffer(btn.dataset.acceptSponsor)));
  document.querySelectorAll('[data-reject-sponsor]').forEach(btn => btn.addEventListener('click', () => rejectSponsorOffer(btn.dataset.rejectSponsor)));
}

function renderFixture(){
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const visibleDivisions = selectedFixtureDivision === 'all' ? divisions : divisions.filter(d => d.id === selectedFixtureDivision);
  const html = game.fixtures.map(round=>{
    const groups = visibleDivisions.map(division => {
      const matches = round.matches.filter(m => (m.divisionId || seed.clubs.find(c=>c.id===m.homeId)?.divisionId || 'default') === division.id);
      if(!matches.length) return '';
      return `<div class="fixture-division-block"><h4>${escapeHtml(division.name)}</h4><div class="grid cols-2">${matches.map(matchCard).join('')}</div></div>`;
    }).join('');
    return `<div class="card"><div class="row"><h3>Fecha ${round.matchday}</h3><span class="pill">${round.date}</span></div>${groups || '<p class="muted">Sin partidos para esta división.</p>'}</div>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Calendario</h2><p class="tagline">Los partidos jugados son clickeables para ver estadísticas y eventos.</p></div>
      ${divisionFilterMarkup('fixtureDivisionFilter', selectedFixtureDivision)}
    </div>
    <div class="stack">${html}</div>`;
  $('fixtureDivisionFilter')?.addEventListener('change', event => { selectedFixtureDivision = event.target.value; renderFixture(); });
}
function matchCard(m){
  const events = game.matchHistory.find(x=>x.id===m.id);
  const clickable = m.played ? 'clickable' : '';
  const attr = m.played ? `data-match-id="${escapeHtml(m.id)}"` : '';
  return `<button class="match-card ${clickable}" ${attr}>
    <div class="match-line">
      <div>${clubSpan(m.homeId)}</div>
      <strong class="score">${m.played ? `${m.homeGoals} - ${m.awayGoals}` : 'vs'}</strong>
      <div>${clubSpan(m.awayId)}</div>
    </div>
    ${events ? `<div class="events">${events.goals.slice(0,4).map(g=>`${g.minute}' ${escapeHtml(playerById(g.playerId)?.name || 'Jugador')}`).join(' · ')}${events.goals.length>4?' · ...':''}</div>` : ''}
  </button>`;
}
function renderStandings(){
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const visibleDivisions = selectedStandingsDivision === 'all' ? divisions : divisions.filter(d => d.id === selectedStandingsDivision);
  const blocks = visibleDivisions.map(division => {
    const tableRows = sortedStandings(division.id);
    const rows = tableRows.map((s,i)=>{
      const statusClass = standingsStatusClass(division.id, i, tableRows.length);
      const ownClass = s.clubId===game.selectedClubId ? 'own-club-row' : '';
      return `<tr class="${ownClass} ${statusClass}">
        <td><strong>${i+1}</strong></td><td>${clubLink(s.clubId)}</td><td>${s.pj}</td><td>${s.pg}</td><td>${s.pe}</td><td>${s.pp}</td><td>${s.gf}</td><td>${s.gc}</td><td>${s.dg}</td><td><strong>${s.pts}</strong></td>
      </tr>`;
    }).join('');
    return `<div class="card"><div class="row"><h3>${escapeHtml(division.name)}</h3></div><div class="table-wrap"><table><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Tabla de posiciones</h2></div>
      ${divisionFilterMarkup('standingsDivisionFilter', selectedStandingsDivision)}
    </div>
    <div class="stack">${blocks || '<div class="card"><p class="muted">Sin datos para esta división.</p></div>'}</div>`;
  $('standingsDivisionFilter')?.addEventListener('change', event => { selectedStandingsDivision = event.target.value; renderStandings(); });
}


function standingsStatusClass(divisionId, index, total){
  const divisions = divisionOrderList();
  const current = divisions.findIndex(d => d.id === divisionId);
  if(index === 0) return current > 0 ? 'promotion-row' : 'champion-row';
  if(index === total - 1 && current >= 0 && current < divisions.length - 1) return 'relegation-row';
  return '';
}

function renderManagerStats(){
  game.managerStats = normalizeManagerStats(game.managerStats);
  const totals = game.managerStats.totals;
  const seasons = game.managerStats.seasons.slice().sort((a,b)=>(b.season || 0)-(a.season || 0));
  const rows = seasons.map(item => `<tr>
    <td>${item.season}</td>
    <td>${clubBadge(item.clubId)} ${escapeHtml(item.clubName || clubName(item.clubId))}</td>
    <td>${escapeHtml(item.divisionName || '—')}</td>
    <td><strong>${escapeHtml(item.label || (item.position === 1 ? 'Campeón' : `${item.position || '—'}°`))}</strong></td>
    <td>${item.pts || 0}</td><td>${item.pg || 0}</td><td>${item.pe || 0}</td><td>${item.pp || 0}</td><td>${item.gf || 0}</td><td>${item.gc || 0}</td>
  </tr>`).join('');
  view.innerHTML = `<div class="row section-title"><div><h2>Tus estadísticas</h2><p class="tagline">Historial acumulado del manager.</p></div></div>
    <div class="grid cols-6 compact-team-stats">
      <div class="card"><p class="label">Partidos</p><strong>${totals.played || 0}</strong></div>
      <div class="card"><p class="label">Ganados</p><strong>${totals.won || 0}</strong></div>
      <div class="card"><p class="label">Empatados</p><strong>${totals.drawn || 0}</strong></div>
      <div class="card"><p class="label">Perdidos</p><strong>${totals.lost || 0}</strong></div>
      <div class="card"><p class="label">GF / GC</p><strong>${totals.gf || 0} / ${totals.gc || 0}</strong></div>
      <div class="card"><p class="label">Títulos obtenidos</p><strong>${game.managerStats.titles || 0}</strong></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Finales de temporada</h3>
      <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Club</th><th>División</th><th>Posición</th><th>PTS</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="muted">Aún no finalizaste ninguna temporada.</td></tr>'}</tbody></table></div>
    </div>`;
}

function renderStats(){
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const visibleDivisions = selectedStatsDivision === 'all' ? divisions : divisions.filter(d => d.id === selectedStatsDivision);
  const blocks = visibleDivisions.map(division => {
    const allowedClubs = new Set(seed.clubs.filter(c => (c.divisionId || 'default') === division.id).map(c => c.id));
    const stats = Object.values(game.playerStats).filter(s => allowedClubs.has(s.clubId));
    const scorers = stats.filter(s=>s.goals>0).sort((a,b)=>b.goals-a.goals).slice(0,20);
    const assists = stats.filter(s=>s.assists>0).sort((a,b)=>b.assists-a.assists).slice(0,20);
    const cards = stats.filter(s=>s.yellow>0 || s.red>0).sort((a,b)=>(b.red*3+b.yellow)-(a.red*3+a.yellow)).slice(0,20);
    const injuries = stats.filter(s=>s.injuries>0).sort((a,b)=>b.injuries-a.injuries).slice(0,20);
    return `<div class="card stats-division-block"><h3>${escapeHtml(division.name)}</h3><div class="grid cols-4">
      <div class="card inner"><h3>Goleadores</h3>${rankList(scorers,'goals')}</div>
      <div class="card inner"><h3>Asistidores</h3>${rankList(assists,'assists')}</div>
      <div class="card inner"><h3>Tarjetas</h3>${cardList(cards)}</div>
      <div class="card inner"><h3>Lesiones</h3>${rankList(injuries,'injuries')}</div>
    </div></div>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Estadísticas</h2><p class="tagline">Rankings separados por división.</p></div>
      ${divisionFilterMarkup('statsDivisionFilter', selectedStatsDivision)}
    </div>
    <div class="stack">${blocks || '<div class="card"><p class="muted">Sin datos para esta división.</p></div>'}</div>
  `;
  $('statsDivisionFilter')?.addEventListener('change', event => { selectedStatsDivision = event.target.value; renderStats(); });
}
function rankList(list,key){
  if(!list.length) return '<p class="muted">Sin datos todavía.</p>';
  return list.map((s,i)=>{ const p=playerById(s.playerId); return `<div class="stat-rank ${s.clubId===game.selectedClubId ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span><button class="linklike" data-player-id="${s.playerId}">${escapeHtml(p?.name||'Jugador')}</button> <span class="pill ${s.clubId===game.selectedClubId ? 'club-pill-own' : ''}">${clubBadge(s.clubId)}</span></span><strong>${s[key]}</strong></div>`; }).join('');
}
function cardList(list){
  if(!list.length) return '<p class="muted">Sin tarjetas todavía.</p>';
  return list.map((s,i)=>{ const p=playerById(s.playerId); return `<div class="stat-rank ${s.clubId===game.selectedClubId ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span><button class="linklike" data-player-id="${s.playerId}">${escapeHtml(p?.name||'Jugador')}</button> <span class="pill ${s.clubId===game.selectedClubId ? 'club-pill-own' : ''}">${clubBadge(s.clubId)}</span></span><strong><span class="yellow-card">■</span> ${s.yellow} / <span class="red-card">■</span> ${s.red}</strong></div>`; }).join('');
}
function sortedStandings(divisionId=null){
  if(!game) return [];
  const allowed = divisionId ? new Set(seed.clubs.filter(c => (c.divisionId || 'default') === divisionId).map(c => c.id)) : null;
  return Object.values(game.standings)
    .filter(s => !allowed || allowed.has(s.clubId))
    .sort((a,b)=> b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || clubName(a.clubId).localeCompare(clubName(b.clubId)) );
}

