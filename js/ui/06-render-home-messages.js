/* V3.16 · Render general, inicio, calendario anual, mensajes y ofertas de venta recibidas. */

function renderAll(){
  document.querySelectorAll('.tabs button').forEach(btn=>btn.classList.toggle('active', btn.dataset.tab === activeTab));
  if(game){
    $('managerClub').innerHTML = `${clubBadge(game.selectedClubId)}<span>${escapeHtml(clubName(game.selectedClubId))}</span>`;
    $('managerClub').classList.add('side-club-name');
  }else{
    $('managerClub').textContent = 'Sin partida';
    $('managerClub').classList.remove('side-club-name');
  }
  refreshSidebarDate();
  $('btnSave').disabled = !game;
  if(!game){
    hideNotice();
    if(activeTab === 'ranking' && typeof renderRankingOnline === 'function'){
      renderRankingOnline();
      return;
    }
    view.innerHTML = $('emptyState').innerHTML;
    return;
  }
  repairBotRosters({ reason:'render' });
  if(activeTab === 'players') activeTab = 'market';
  const renderers = { home:renderHome, messages:renderMessages, market:renderMarket, academy:renderAcademy, firstTeam:renderFirstTeam, squad:renderSquad, tactics:renderTactics, training:renderTraining, stadium:renderStadium, employees:renderEmployees, fixture:renderFixture, standings:renderStandings, stats:renderStats, mystats:renderManagerStats, finance:renderFinances, ranking:renderRankingOnline };
  (renderers[activeTab] || renderers.home)();
}
function renderClubRequirementsWarning(){
  const invalid = invalidClubRequirements();
  const rows = invalid.map(item => {
    const squad = playersByClub(item.club.id);
    const keepers = squad.filter(p=>p.position==='POR').length;
    return `<tr><td><strong>${escapeHtml(item.club.name)}</strong></td><td>${squad.length}</td><td>${keepers}</td><td><span class="bad">${escapeHtml(item.issues.join(' · '))}</span></td></tr>`;
  }).join('');
  view.innerHTML = `
    <div class="card blocker requirement-warning">
      <h2>Advertencia de estructura de planteles</h2>
      <p>Cada club debe tener como mínimo <strong>${MIN_PLAYERS_PER_CLUB} jugadores</strong>, <strong>${BOT_MIN_GOALKEEPERS} porteros</strong>, <strong>${BOT_MIN_DEFENDERS} defensores</strong>, <strong>${BOT_MIN_MIDFIELDERS} mediocampistas</strong> y <strong>${BOT_MIN_ATTACKERS} delanteros</strong>. Los bots se reparan automáticamente; esta advertencia sólo debería quedar para el club del usuario si su plantel queda incompleto.</p>
      <div class="table-wrap"><table><thead><tr><th>Club</th><th>Jugadores</th><th>Porteros</th><th>Problema</th></tr></thead><tbody>${rows}</tbody></table></div>
    </div>`;
}
function getNextMatchForSelected(){
  if(!game || game.matchdayIndex >= game.fixtures.length) return null;
  const round = game.fixtures[game.matchdayIndex];
  return round.matches.find(m => m.homeId === game.selectedClubId || m.awayId === game.selectedClubId);
}
function turnModePanelMarkup(){
  if(!game || game.seasonFinalized) return '';
  if(isPreseason()){
    const remaining = Math.max(0, MAX_PRESEASON_FRIENDLIES - preseasonFriendliesPlayed());
    const options = seed.clubs
      .filter(c => c.id !== game.selectedClubId)
      .map(c => `<option value="${c.id}" ${Number(game.pendingFriendlyOpponentId || 0)===c.id?'selected':''}>${escapeHtml(c.name)} · ${escapeHtml(clubDivision(c.id).name)}</option>`)
      .join('');
    return `<div class="card preseason-card">
      <div class="row"><div><p class="label">Pretemporada</p><h3>${phaseDayRangeLabel(game.phaseTurn || 0, PRESEASON_TURNS)}</h3></div><span class="pill">Amistosos restantes: ${remaining}</span></div>
      <p class="muted">Usá estos días para entrenar, recuperar forma física y preparar el plantel antes del inicio oficial.</p>
      <div class="grid cols-2" style="margin-top:10px">
        <div><label for="friendlyOpponentSelect">Amistoso opcional de esta semana</label><select id="friendlyOpponentSelect" ${remaining <= 0 ? 'disabled' : ''}><option value="0">Sin amistoso</option>${options}</select></div>
        <div class="row" style="align-items:end"><button id="btnClearFriendly" class="ghost" ${Number(game.pendingFriendlyOpponentId || 0) ? '' : 'disabled'}>Quitar amistoso</button></div>
      </div>
    </div>`;
  }
  if(isPostseason()){
    return `<div class="card preseason-card"><div class="row"><div><p class="label">Postemporada</p><h3>${phaseDayRangeLabel(game.phaseTurn || 0, postseasonTurnsForCurrentSeason())}</h3></div><span class="pill">Sin partidos oficiales</span></div><p class="muted">Últimos días del año para entrenamiento y recuperación antes del cierre formal de temporada.</p></div>`;
  }
  return '';
}

function featuredPlayerCard(type, player, label, valueText){
  if(!player){
    return `<div class="card featured-player-card empty"><p class="label">${escapeHtml(label)}</p><p class="muted">Sin jugador destacado todavía.</p></div>`;
  }
  const stats = game?.playerStats?.[player.id] || {};
  return `<button class="card featured-player-card clickable" data-player-id="${player.id}" type="button">
    ${faceImg(player, 'featured-player-face')}
    <div class="featured-player-info">
      <span class="featured-badge ${escapeHtml(type)}">${escapeHtml(label)}</span>
      <strong>${escapeHtml(player.name)}</strong>
      <span>${roleBadge(player.position)} · ${Number(player.age || 0) || '—'} años</span>
      <div class="featured-player-meta">
        <span>Media <b>${visibleOverall(player)}</b></span>
        ${valueText ? `<span>${valueText}</span>` : ''}
      </div>
    </div>
  </button>`;
}
function homeFeaturedPlayers(clubId, teamAverage){
  const squad = playersByClub(clubId);
  const stats = game?.playerStats || {};
  const scorer = squad.slice().sort((a,b)=>(Number(stats[b.id]?.goals || 0) - Number(stats[a.id]?.goals || 0)) || visibleOverall(b)-visibleOverall(a))[0] || null;
  const star = squad.slice().sort((a,b)=>visibleOverall(b)-visibleOverall(a) || currentMorale(b.id)-currentMorale(a.id))[0] || null;
  const promisePool = squad.filter(p => Number(p.age || 99) <= 23 && visibleOverall(p) > teamAverage);
  const promise = (promisePool.length ? promisePool : squad.filter(p => Number(p.age || 99) <= 23)).sort((a,b)=>visibleOverall(b)-visibleOverall(a) || a.age-b.age)[0] || null;
  return {
    scorer,
    star,
    promise,
    scorerText: scorer ? `Goles <b>${Number(stats[scorer.id]?.goals || 0)}</b>` : '',
    starText: star ? `Media general <b>${visibleOverall(star)}</b>` : '',
    promiseText: promise ? (visibleOverall(promise) > teamAverage ? `Promedio equipo <b>${teamAverage}</b>` : `En desarrollo`) : ''
  };
}


function statusTone(value, good=70, warning=45){
  const n = Math.round(Number(value) || 0);
  if(n >= good) return 'ok';
  if(n >= warning) return 'warn';
  return 'bad';
}
function miniStatusBar(label, value, max=100){
  const n = clamp(Math.round(Number(value) || 0), 0, max);
  const pct = max ? clamp(Math.round((n / max) * 100), 0, 100) : 0;
  return `<div class="mini-status-row ${statusTone(pct)}"><div><span>${escapeHtml(label)}</span><strong>${n}</strong></div><i><b style="width:${pct}%"></b></i></div>`;
}
function visualAlertItems(){
  if(!game) return [];
  const items = [];
  const tacticErrors = isRegularSeason() ? validateCurrentTactic(false) : [];
  const injured = injuredPlayersByClub(game.selectedClubId);
  const pendingTransferOffers = (game.messages || []).filter(m => m.action?.type === 'transferOffer' && m.action.status === 'pending').length;
  const sponsorOffers = game.sponsors?.offers?.length || 0;
  const scoutingJobs = (game.academy?.scoutingJobs || []).filter(j => j.status === 'pending');
  const squadCount = playersByClub(game.selectedClubId).length;
  const salaryPressure = totalClubSalary(game.selectedClubId);
  if(game.mustReviewTactics){
    items.push({ tone:'bad', icon:'!', title:'Táctica a revisar', text:'Hay lesionados o suspendidos propios fuera de la convocatoria válida.', tab:'tactics' });
  }else if(tacticErrors.length){
    items.push({ tone:'bad', icon:'11', title:'Once incompleto', text:tacticErrors.slice(0,2).join(' '), tab:'tactics' });
  }
  if(injured.length){
    items.push({ tone:'warn', icon:'+', title:`${injured.length} lesionado(s)`, text:'Revisá disponibilidad antes del próximo partido.', tab:'firstTeam' });
  }
  const unread = unreadMessagesCount();
  if(unread){
    items.push({ tone:'info', icon:'✉', title:`${unread} mensaje(s) nuevo(s)`, text:'Hay eventos pendientes para leer.', tab:'messages' });
  }
  if(pendingTransferOffers){
    items.push({ tone:'warn', icon:'$', title:`${pendingTransferOffers} oferta(s) por jugadores`, text:'Podés aceptar o rechazar desde Mensajes.', tab:'messages' });
  }
  if(sponsorOffers){
    items.push({ tone:'ok', icon:'S', title:`${sponsorOffers} sponsor(s) disponibles`, text:'Hay ingresos inmediatos posibles.', tab:'stadium' });
  }
  if(scoutingJobs.length){
    const nextDue = Math.min(...scoutingJobs.map(j => Number(j.dueTurn || 0)));
    const left = daysUntilTurn(nextDue);
    items.push({ tone:'info', icon:'A', title:'Captación en curso', text:`Informe de academia en ${formatDays(left)}.`, tab:'academy' });
  }
  if(squadCount >= MAX_PLAYERS_PER_CLUB){
    items.push({ tone:'warn', icon:'42', title:'Plantel completo', text:`Tenés ${squadCount}/${MAX_PLAYERS_PER_CLUB} jugadores. No podés fichar ni subir juveniles.`, tab:'firstTeam' });
  } else if(squadCount <= MIN_PLAYERS_PER_CLUB){
    items.push({ tone:'bad', icon:'18', title:'Plantel mínimo', text:`Tenés ${squadCount}/${MAX_PLAYERS_PER_CLUB} jugadores. No conviene vender ni despedir.`, tab:'firstTeam' });
  }
  if(salaryPressure > 0 && (game.budget || 0) < salaryPressure * 0.25){
    items.push({ tone:'bad', icon:'$', title:'Presupuesto presionado', text:'El presupuesto actual está bajo contra la masa salarial anual.', tab:'finance' });
  }
  if(!items.length){
    items.push({ tone:'ok', icon:'✓', title:'Sin urgencias', text:'No hay bloqueos críticos para el próximo avance.', tab:null });
  }
  return items.slice(0,6);
}
function visualAlertsMarkup(){
  const items = visualAlertItems();
  return `<div class="manager-alert-grid">${items.map(item => `<button class="manager-alert ${escapeHtml(item.tone)} ${item.tab ? 'clickable' : ''}" ${item.tab ? `data-go-tab="${escapeHtml(item.tab)}"` : ''} type="button"><span class="manager-alert-icon">${escapeHtml(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.text)}</em></span></button>`).join('')}</div>`;
}
function managerOfficeMarkup({ next, position, clubPlayers, avgOverall, avgFitness, avgMorale, cohesion, deltaClass, deltaText }){
  const activeSponsors = (game.sponsors?.active || []).filter(s => Number(s.turnsRemaining || 0) > 0).length;
  const phase = phaseLabel();
  const nextBox = next
    ? `<div class="office-next-match"><p class="label">Próximo compromiso</p>${matchPreview(next)}</div>`
    : `<div class="office-next-match"><p class="label">Próximo compromiso</p><div class="empty-office-box"><strong>Sin partido confirmado</strong><span>${escapeHtml(phase)}</span></div></div>`;
  return `<div class="manager-office">
    <div class="office-main-card">
      <div class="office-club-head">
        ${clubBadge(game.selectedClubId)}
        <div><p class="label">Oficina del manager</p><h2>${escapeHtml(clubName(game.selectedClubId))}</h2><p class="tagline">${escapeHtml(phase)} · Fecha de liga ${Math.min(Number(game.matchdayIndex || 0) + 1, game.fixtures?.length || 0)}</p></div>
      </div>
      <div class="office-mini-grid">
        <div><span>Posición</span><strong>${position || '—'}°</strong></div>
        <div><span>Plantel</span><strong>${clubPlayers.length}/${MAX_PLAYERS_PER_CLUB}</strong></div>
        <div><span>Presupuesto</span><strong>${formatMoney(game.budget || 0)}</strong><em class="${deltaClass}">${deltaText}</em></div>
        <div><span>Sponsors activos</span><strong>${activeSponsors}</strong></div>
      </div>
      <div class="office-status-bars">
        ${miniStatusBar('Media', avgOverall, 99)}
        ${miniStatusBar('Físico', avgFitness, 99)}
        ${miniStatusBar('Moral', avgMorale, 99)}
        ${miniStatusBar('Cohesión', cohesion, 100)}
      </div>
    </div>
    <div class="office-side-card">
      ${nextBox}
      <div class="advance-control office-advance"><button id="advanceBtn" class="primary">Avanzar 7 días</button><div id="advanceProgressBox">${advanceProgressMarkup()}</div></div>
    </div>
  </div>`;
}
function lastTurnSummaryMarkup(){
  const summary = game?.lastTurnSummary;
  if(!summary) return '';
  const items = Array.isArray(summary.items) ? summary.items.slice(0,5) : [];
  return `<div class="card turn-summary-card ${escapeHtml(summary.tone || 'info')}">
    <div class="row"><div><p class="label">Resumen del último avance</p><h3>${escapeHtml(summary.title || 'Último avance')}</h3></div><span class="pill">${escapeHtml(summary.phase || '')}</span></div>
    ${summary.result ? `<div class="turn-result-line">${escapeHtml(summary.result)}</div>` : ''}
    <div class="turn-summary-list">${items.map(item => `<div class="turn-summary-item ${escapeHtml(item.tone || 'info')}"><strong>${escapeHtml(item.label || 'Evento')}</strong><span>${escapeHtml(item.text || '')}</span></div>`).join('')}</div>
  </div>`;
}

function renderHome(){
  const next = getNextMatchForSelected();
  const clubPlayers = playersByClub(game.selectedClubId);
  const avgOverall = Math.round(avg(clubPlayers.map(p=>visibleOverall(p))));
  const avgFitness = squadFitnessAverage(game.selectedClubId);
  const avgMorale = squadMoraleAverage(game.selectedClubId);
  const cohesion = cohesionValue(game.selectedClubId);
  const featured = homeFeaturedPlayers(game.selectedClubId, avgOverall);
  const injuredList = injuredPlayersByClub(game.selectedClubId);
  const myStanding = game.standings[game.selectedClubId] || { pts:0, pg:0, pe:0, pp:0, gf:0, gc:0 };
  const selectedClub = seed.clubs.find(c=>c.id===game.selectedClubId);
  const position = sortedStandings(selectedClub?.divisionId || null).findIndex(s=>s.clubId===game.selectedClubId)+1;
  const lastMatches = game.matchHistory.filter(m=>m.homeId===game.selectedClubId || m.awayId===game.selectedClubId).slice(-5).reverse();
  const problems = game.lastOwnProblems || [];
  const deltaClass = game.lastBudgetDelta > 0 ? 'ok' : game.lastBudgetDelta < 0 ? 'bad' : 'muted';
  const deltaText = game.lastBudgetDelta ? `${game.lastBudgetDelta > 0 ? '+' : ''}${formatMoney(game.lastBudgetDelta)}` : '—';
  const problemBox = problems.length ? `<div class="card blocker"><h3>Revisión obligatoria</h3><p>Hubo lesionados o expulsados propios en el último partido. Entrá a Táctica, reemplazalos y guardá una alineación válida.</p><div class="problem-list">${problems.map(problemItem).join('')}</div><button class="primary" data-go-tactics>Ir a táctica</button></div>` : '';
  const seasonBox = game.seasonFinalized ? seasonEndPanelMarkup() : '';
  view.innerHTML = `
    <div class="home-message-strip section-title">${homeMessagesSummary()}</div>
    ${problemBox}
    ${seasonBox}
    ${turnModePanelMarkup()}
    ${managerOfficeMarkup({ next, position, clubPlayers, avgOverall, avgFitness, avgMorale, cohesion, deltaClass, deltaText })}
    ${visualAlertsMarkup()}
    ${lastTurnSummaryMarkup()}
    <div class="card featured-players-panel" style="margin-top:14px">
      <div class="row"><h3>Tus jugadores destacados</h3><span class="pill">Plantel actual</span></div>
      <div class="grid cols-3 featured-player-grid">
        ${featuredPlayerCard('scorer', featured.scorer, 'Goleador', featured.scorerText)}
        ${featuredPlayerCard('star', featured.star, 'Estrella', featured.starText)}
        ${featuredPlayerCard('promise', featured.promise, 'Promesa', featured.promiseText)}
      </div>
    </div>
    ${typeof staffContractsPanelMarkup === 'function' ? staffContractsPanelMarkup() : ''}
    <div class="grid cols-3" style="margin-top:14px">
      <div class="card"><p class="label">Posición</p><div class="metric">${position || '—'}°</div></div>
      <div class="card"><p class="label">Jugadores</p><div class="metric">${clubPlayers.length}</div></div>
      <div class="card"><p class="label">Presupuesto</p><div class="metric small">${formatMoney(game.budget || 0)}</div><p class="small ${deltaClass}">Último balance: ${deltaText}</p></div>
    </div>
    <div class="card own-team-stats-card" style="margin-top:14px">
      <h3>Estadísticas de mi equipo</h3>
      <div class="grid cols-6 compact-team-stats">
        <div><p class="label">Puntos</p><strong>${myStanding.pts}</strong></div>
        <div><p class="label">Ganados</p><strong>${myStanding.pg}</strong></div>
        <div><p class="label">Empatados</p><strong>${myStanding.pe}</strong></div>
        <div><p class="label">Perdidos</p><strong>${myStanding.pp}</strong></div>
        <div><p class="label">GF</p><strong>${myStanding.gf}</strong></div>
        <div><p class="label">GC</p><strong>${myStanding.gc}</strong></div>
      </div>
    </div>
    <div class="card injury-home-card" style="margin-top:14px">
      <div class="row"><h3>Jugadores lesionados</h3><span class="pill">${injuredList.length} activo(s)</span></div>
      ${injuredList.length ? `<div class="injured-home-list">${injuredList.map(item => injuredHomeCard(item)).join('')}</div>` : '<p class="muted">No hay jugadores lesionados en el plantel.</p>'}
    </div>
    <div class="split" style="margin-top:14px">
      <div class="card">
        <h3>Próximo partido</h3>
        ${next ? matchPreview(next) : (isPostseason() ? '<p class="muted">Postemporada en curso. No hay partidos oficiales.</p>' : '<p class="muted">Temporada finalizada.</p>')}
      </div>
      <div class="card">
        <h3>Últimos partidos</h3>
        <div class="timeline">${lastMatches.length ? lastMatches.map(compactMatch).join('') : '<p class="muted">Aún no hay partidos jugados.</p>'}</div>
      </div>
    </div>

  `;
  $('advanceBtn')?.addEventListener('click', simulateNextMatchday);
  document.querySelector('[data-go-tactics]')?.addEventListener('click',()=>{ activeTab='tactics'; renderAll(); });
  document.querySelector('[data-continue-season]')?.addEventListener('click',()=>startNextSeason(game.selectedClubId));
  document.querySelector('[data-open-season-modal]')?.addEventListener('click',()=>openSeasonEndModal());
  document.querySelectorAll('.featured-player-card[data-player-id]').forEach(card => card.addEventListener('click',()=>showPlayerModal(Number(card.dataset.playerId))));
  document.querySelectorAll('[data-go-tab]').forEach(btn => btn.addEventListener('click',()=>{ activeTab = btn.dataset.goTab; renderAll(); }));
  $('friendlyOpponentSelect')?.addEventListener('change', (event)=>{ game.pendingFriendlyOpponentId = Number(event.target.value || 0); saveLocal(true); renderHome(); });
  $('btnClearFriendly')?.addEventListener('click', ()=>{ game.pendingFriendlyOpponentId = 0; saveLocal(true); renderHome(); });
  updateAdvanceButtonState();
}
function updateAdvanceButtonState(){
  const btn = $('advanceBtn');
  if(!btn || !game) return;
  const lockLeft = Math.max(0, (game.advanceLockedUntil || 0) - Date.now());
  const seasonEnded = game.seasonFinalized || seasonPhase() === 'finalized';
  const invalid = validateCurrentTactic(false);
  let text = isPreseason() ? 'Avanzar 7 días de pretemporada' : isPostseason() ? 'Avanzar 7 días de postemporada' : 'Domingo · jugar partido';
  let disabled = false;
  if(seasonEnded){ text = 'Temporada finalizada'; disabled = true; }
  else if(lockLeft > 0){ text = `${currentWeekdayLabel()} · semana en curso`; disabled = true; }
  else if(isRegularSeason() && game.mustReviewTactics){ text = 'Reemplazar lesionados/suspendidos'; disabled = true; }
  else if(isRegularSeason() && invalid.length){ text = 'Táctica incompleta'; disabled = true; }
  btn.textContent = text;
  btn.disabled = disabled;
  updateAdvanceProgressBox();
}
function updateAdvanceProgressBox(){
  const progressBox = $('advanceProgressBox');
  if(!progressBox) return;
  if(!progressBox.querySelector('[data-advance-progress-fill]')){
    progressBox.innerHTML = advanceProgressMarkup();
  }
  const fill = progressBox.querySelector('[data-advance-progress-fill]');
  if(fill) fill.style.width = `${advanceProgressPercent()}%`;
  const phraseEl = progressBox.querySelector('[data-advance-phrase]');
  if(phraseEl){
    const phrase = advanceStatusPhrase();
    if(phraseEl.textContent !== phrase){
      phraseEl.textContent = phrase;
      phraseEl.classList.remove('is-changing');
      void phraseEl.offsetWidth;
      phraseEl.classList.add('is-changing');
    }
  }
}
function advanceProgressPercent(){
  if(!game) return 0;
  const lockLeft = Math.max(0, (game.advanceLockedUntil || 0) - Date.now());
  if(lockLeft <= 0) return 100;
  return clamp(Math.round(((ADVANCE_LOCK_MS - lockLeft) / ADVANCE_LOCK_MS) * 100), 0, 100);
}
function advanceProgressMarkup(){
  if(!game) return '';
  const pct = advanceProgressPercent();
  return `<div class="advance-progress"><div class="project-progress"><span data-advance-progress-fill style="width:${pct}%"></span></div><p class="small muted advance-phrase" data-advance-phrase>${escapeHtml(advanceStatusPhrase())}</p></div>`;
}
function advanceStatusPhrase(){
  const fallback = ['Revisando planillas de entrenamiento'];
  const phrases = (Array.isArray(ADVANCE_STATUS_PHRASES) && ADVANCE_STATUS_PHRASES.length) ? ADVANCE_STATUS_PHRASES : fallback;
  const now = Date.now();
  const currentSlot = Math.floor(now / ADVANCE_STATUS_PHRASE_INTERVAL_MS);
  if(!window.__fmAdvancePhraseState || window.__fmAdvancePhraseState.slot !== currentSlot){
    const previous = window.__fmAdvancePhraseState?.index;
    let index = Math.floor(Math.random() * phrases.length);
    if(phrases.length > 1 && index === previous) index = (index + 1) % phrases.length;
    window.__fmAdvancePhraseState = { slot: currentSlot, index };
  }
  return phrases[window.__fmAdvancePhraseState.index] || fallback[0];
}
function formatClock(ms){
  const total = Math.ceil(ms/1000);
  const m = Math.floor(total/60);
  const s = String(total%60).padStart(2,'0');
  return `${m}:${s}`;
}
function currentWeekdayLabel(){
  if(!game) return '—';
  const lockLeft = Math.max(0, (game.advanceLockedUntil || 0) - Date.now());
  if(lockLeft <= 0) return 'Domingo';
  const elapsed = clamp(ADVANCE_LOCK_MS - lockLeft, 0, ADVANCE_LOCK_MS);
  const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const index = clamp(Math.floor(elapsed / (ADVANCE_LOCK_MS / days.length)), 0, days.length - 1);
  return days[index];
}
function refreshSidebarDate(){
  if(!game){
    $('currentSeason') && ($('currentSeason').textContent = 'Temporada: —');
    $('currentDate').textContent = 'Fecha: —';
    $('currentRound').textContent = 'Calendario: —';
    return;
  }
  $('currentSeason') && ($('currentSeason').textContent = `Temporada: ${game.seasonNumber || 1}`);
  $('currentDate').textContent = `Día: ${currentWeekdayLabel()} · Fecha: ${game.currentDate}`;
  $('currentRound').textContent = phaseLabel();
}
function problemItem(problem){
  const p = playerById(problem.playerId);
  const type = problem.type === 'injury' ? 'Lesión' : 'Expulsión';
  return `<span class="pill ${problem.type === 'injury' ? 'warn' : 'bad'}">${type}: ${escapeHtml(p?.name || 'Jugador')}</span>`;
}
function matchPreview(match){
  return `<button class="next-match clickable" data-match-id="${escapeHtml(match.id)}">
    <div><div class="team-name">${clubSpan(match.homeId)}</div></div>
    <div class="vs">VS<br><span class="small">${escapeHtml(match.date)}</span></div>
    <div><div class="team-name">${clubSpan(match.awayId)}</div></div>
  </button>`;
}
function compactMatch(m){
  const isHome = m.homeId === game.selectedClubId;
  const gf = isHome ? m.homeGoals : m.awayGoals;
  const gc = isHome ? m.awayGoals : m.homeGoals;
  const cls = gf > gc ? 'ok' : gf < gc ? 'bad' : 'warn';
  return `<button class="stat-rank clickable plain" data-match-id="${escapeHtml(m.id)}"><span>${clubBadge(m.homeId)} ${m.homeGoals} - ${m.awayGoals} ${clubBadge(m.awayId)}</span><strong class="${cls}">${gf > gc ? 'G' : gf < gc ? 'P' : 'E'}</strong></button>`;
}


function unreadMessagesCount(){
  return (game?.messages || []).filter(m => !m.read).length;
}
function pushGameMessage(message){
  if(!game) return null;
  game.messages = Array.isArray(game.messages) ? game.messages : [];
  const item = {
    id: message.id || `msg-${Date.now()}-${hashNumber(`${message.title || ''}-${game.messages.length}-${Math.random()}`, 1000000)}`,
    turn: game.matchdayIndex || 0,
    season: game.seasonNumber || 1,
    date: game.currentDate || '',
    read: false,
    priority: message.priority || 'normal',
    type: message.type || 'info',
    title: message.title || 'Mensaje',
    body: message.body || '',
    action: message.action || null,
    createdAt: Date.now()
  };
  game.messages.unshift(item);
  return item;
}
function markMessagesRead(){
  if(!game?.messages) return;
  game.messages.forEach(m => { m.read = true; });
}
function latestMessages(limit=3){
  return (game?.messages || []).slice(0, limit);
}
function homeMessagesSummary(){
  const items = latestMessages(3);
  const count = unreadMessagesCount();
  if(!items.length){
    return `<div class="home-messages-summary"><p class="label">Mensajes / eventos</p><h2>Sin mensajes nuevos</h2><p class="tagline">Los avisos deportivos, ofertas y eventos del club aparecerán acá.</p></div>`;
  }
  return `<div class="home-messages-summary clickable" data-open-messages>
    <div class="row"><div><p class="label">Mensajes / eventos</p><h2>${escapeHtml(items[0].title)}</h2></div>${count ? `<span class="pill warn">${count} nuevo(s)</span>` : '<span class="pill">Ver mensajes</span>'}</div>
    <p class="tagline">${escapeHtml(items[0].body)}</p>
  </div>`;
}
function renderMessages(){
  markMessagesRead();
  const rows = (game.messages || []).map(m => messageCard(m)).join('');
  view.innerHTML = `
    <div class="section-title"><h2>Mensajes</h2><p class="tagline">Eventos importantes, ofertas y avisos del club.</p></div>
    <div class="message-list">${rows || '<div class="card"><p class="muted">No hay mensajes todavía.</p></div>'}</div>`;
  document.querySelectorAll('[data-accept-offer]').forEach(btn => btn.addEventListener('click', () => acceptTransferOffer(btn.dataset.acceptOffer)));
  document.querySelectorAll('[data-reject-offer]').forEach(btn => btn.addEventListener('click', () => rejectTransferOffer(btn.dataset.rejectOffer)));
  saveLocal(true);
}
function messageCard(m){
  const action = m.action?.type === 'transferOffer' && m.action.status === 'pending'
    ? `<div class="row message-actions"><button class="primary" data-accept-offer="${escapeHtml(m.id)}">Aceptar oferta</button><button class="ghost" data-reject-offer="${escapeHtml(m.id)}">Rechazar</button></div>`
    : (m.action?.status ? `<span class="pill">${m.action.status === 'accepted' ? 'Aceptada' : 'Rechazada'}</span>` : '');
  return `<div class="card message-card ${m.read ? '' : 'unread'}">
    <div class="row"><div><p class="label">Temporada ${m.season || 1} · Día ${((Number(m.turn || 0)) * DAYS_PER_ADVANCE) + 1}</p><h3>${escapeHtml(m.title)}</h3></div><span class="pill ${m.priority === 'high' ? 'warn' : ''}">${escapeHtml(m.type || 'info')}</span></div>
    <p>${escapeHtml(m.body)}</p>
    ${action}
  </div>`;
}
function hasPendingTransferOfferForPlayer(playerId){
  const id = Number(playerId);
  return (game?.messages || []).some(m => m.action?.type === 'transferOffer' && m.action.status === 'pending' && Number(m.action.playerId) === id);
}
function maybeGenerateTransferOffer(match){
  if(!game || !match) return;
  const roll = Math.random();
  if(roll > 0.28) return;
  const candidates = playersByClub(game.selectedClubId).filter(p => playerClauseFor(p) > 0 && !isUnavailable(p.id) && !hasPendingTransferOfferForPlayer(p.id));
  if(!candidates.length) return;
  candidates.sort((a,b)=>visibleOverall(b)-visibleOverall(a));
  const pool = candidates.slice(0, Math.min(12, candidates.length));
  const player = pool[hashNumber(`offer-${game.seasonNumber}-${game.matchdayIndex}-${match.id}`, pool.length)];
  const pct = 20 + hashNumber(`offer-pct-${player.id}-${Date.now()}`, 81);
  const amount = Math.round(refreshPlayerClause(player) * pct / 100);
  const foreignClub = FOREIGN_CLUBS[hashNumber(`foreign-${player.id}-${game.matchdayIndex}`, FOREIGN_CLUBS.length)];
  pushGameMessage({
    type:'mercado',
    priority:'high',
    title:`Oferta por ${playerLastName(player.name)}`,
    body:`${foreignClub} ofrece ${formatMoney(amount)} por ${player.name}. La oferta equivale al ${pct}% de su cláusula. Si aceptás, el jugador se va del club.`,
    action:{ type:'transferOffer', status:'pending', playerId:player.id, amount, foreignClub, pct }
  });
}
function seasonEndOfferScore(player){
  const st = game?.playerStats?.[player.id] || {};
  const goals = Number(st.goals || 0);
  const assists = Number(st.assists || 0);
  return (visibleOverall(player) * 2) + (goals * 18) + (assists * 14) + hashNumber(`season-end-score-${game?.seasonNumber || 1}-${player.id}`, 9);
}
function generateSeasonEndPlayerOffers(){
  if(!game || !isPostseason()) return [];
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){
    const season = game.seasonNumber || 1;
    game.seasonEndPlayerOffers = { season, generatedAt:turnStamp({ action:'seasonEndPlayerOffers' }), count:0 };
    return [];
  }
  const season = game.seasonNumber || 1;
  if(game.seasonEndPlayerOffers?.season === season) return [];
  const candidates = playersByClub(game.selectedClubId)
    .filter(p => playerClauseFor(p) > 0 && !isUnavailable(p.id) && !hasPendingTransferOfferForPlayer(p.id));
  if(!candidates.length){
    game.seasonEndPlayerOffers = { season, generatedAt:turnStamp({ action:'seasonEndPlayerOffers' }), count:0 };
    return [];
  }
  const stats = game.playerStats || {};
  const byScore = candidates.slice().sort((a,b)=>seasonEndOfferScore(b)-seasonEndOfferScore(a));
  const byGoals = candidates.slice().sort((a,b)=>Number(stats[b.id]?.goals || 0)-Number(stats[a.id]?.goals || 0) || visibleOverall(b)-visibleOverall(a));
  const byAssists = candidates.slice().sort((a,b)=>Number(stats[b.id]?.assists || 0)-Number(stats[a.id]?.assists || 0) || visibleOverall(b)-visibleOverall(a));
  const map = new Map();
  [...byScore.slice(0,12), ...byGoals.slice(0,8), ...byAssists.slice(0,8)].forEach(p => map.set(p.id, p));
  const pool = Array.from(map.values()).sort((a,b)=>seasonEndOfferScore(b)-seasonEndOfferScore(a));
  const targetCount = Math.min(pool.length, randomInt(SEASON_END_TRANSFER_OFFERS_MIN, SEASON_END_TRANSFER_OFFERS_MAX));
  const created = [];
  for(const player of pool){
    if(created.length >= targetCount) break;
    const st = stats[player.id] || {};
    const productionBonus = clamp((Number(st.goals || 0) + Number(st.assists || 0)) * 2, 0, 15);
    const pct = clamp(78 + hashNumber(`season-end-pct-${season}-${player.id}-${Date.now()}`, 43) + productionBonus, 78, 125);
    const amount = Math.round(refreshPlayerClause(player) * pct / 100);
    const foreignClub = FOREIGN_CLUBS[hashNumber(`season-end-foreign-${season}-${player.id}-${created.length}`, FOREIGN_CLUBS.length)];
    const msg = pushGameMessage({
      type:'mercado',
      priority:'high',
      title:`Oferta por ${playerLastName(player.name)}`,
      body:`${foreignClub} acercó una buena oferta de ${formatMoney(amount)} por ${player.name}. Si aceptás, el jugador se va del club.`,
      action:{ type:'transferOffer', status:'pending', playerId:player.id, amount, foreignClub, pct, origin:'season_end' }
    });
    if(msg) created.push(msg);
  }
  game.seasonEndPlayerOffers = { season, generatedAt:turnStamp({ action:'seasonEndPlayerOffers' }), count:created.length };
  return created;
}
function acceptTransferOffer(messageId){
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending') return;
  const player = playerById(msg.action.playerId);
  if(!player || player.clubId !== game.selectedClubId){ showNotice('La oferta ya no está disponible.'); return; }
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){ showRosterMinimumNotice(); return; }
  recordBudgetChange(msg.action.amount || 0, `Venta de ${player.name}`, { type:'transfer_sale', playerId:player.id });
  player.clubId = -1;
  game.marketPlayers = (game.marketPlayers || []).map(p => p.id === player.id ? { ...p, clubId:-1, sold:true } : p);
  removePlayerFromCurrentTactic(player.id);
  msg.action.status = 'accepted';
  msg.body += ' Oferta aceptada.';
  saveLocal(true);
  showNotice(`${player.name} fue vendido por ${formatMoney(msg.action.amount || 0)}.`);
  renderMessages();
}
function rejectTransferOffer(messageId){
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending') return;
  msg.action.status = 'rejected';
  saveLocal(true);
  renderMessages();
}
function removePlayerFromCurrentTactic(playerId){
  if(!game?.tactic) return;
  const id = Number(playerId);
  const starters = (game.tactic.starters || []).map(x => Number(x) === id ? 0 : x);
  const bench = (game.tactic.bench || []).filter(x => Number(x) !== id);
  const autoSubs = (game.tactic.autoSubs || []).map(rule => ({...rule, outId:Number(rule.outId)===id?0:rule.outId, inId:Number(rule.inId)===id?0:rule.inId}));
  game.tactic = applyStarterMentalities({ ...game.tactic, starters, bench, autoSubs });
}
function generateMarketPlayers(count=50){
  const startId = Math.max(0, ...(seed?.players || []).map(p => Number(p.id) || 0)) + 1000;
  const activePlayers = (seed?.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
  const generationContext = createPlayerGenerationContext(activePlayers.length + count, activePlayers);
  const players = [];
  for(let i=0;i<count;i++){
    const id = startId + i;
    const group = pickPositionGroupForGeneration(id, 'market', generationContext);
    const position = pickPositionFromGroup(group, id, 'market');
    const player = generatedPlayerFactory({
      id,
      position,
      clubId:0,
      age:18 + hashNumber(`market-age-${id}`, 18),
      prestige:52,
      nameContext:'Mercado Libre',
      divisionName:'Mercado',
      generationContext,
      salaryFactor:MARKET_FREE_AGENT_SALARY_FACTOR,
      freeAgent:true
    });
    players.push(player);
  }
  return players;
}
function mergeMarketPlayersIntoSeed(players=[]){
  if(!seed?.players) return;
  const existing = new Set(seed.players.map(p => Number(p.id)));
  players.forEach(p => {
    if(!existing.has(Number(p.id))){ seed.players.push(p); existing.add(Number(p.id)); }
    else {
      const idx = seed.players.findIndex(x => Number(x.id) === Number(p.id));
      if(idx >= 0) seed.players[idx] = { ...seed.players[idx], ...p };
    }
  });
}

