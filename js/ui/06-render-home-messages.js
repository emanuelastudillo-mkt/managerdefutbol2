/* V3.47 · Render general, inicio, calendario anual, mensajes y ofertas de venta recibidas. */

function renderWelcomeScreen(){
  const prestige = currentManagerPrestige();
  const prestigeLabel = formatManagerPrestige(prestige);
  const clubs = availableManagerClubs(prestige);
  const countryCount = new Set((seed?.clubs || []).map(club => clubCountry(club))).size;
  const divisionCount = (seed?.divisions || []).length;
  view.innerHTML = `
    <section class="welcome-screen">
      <div class="welcome-hero card">
        <div>
          <p class="label">Nueva carrera</p>
          <h2>Bienvenido a Manager de Fútbol</h2>
          <p class="tagline">Empezás con prestigio ${escapeHtml(prestigeLabel)}. Elegí un club que acepte tu perfil, armá el plantel, definí la táctica, administrá finanzas, sponsors, estadio, academia, empleados y mercado durante la temporada.</p>
        </div>
        <div class="welcome-summary">
          <div><span>Países</span><strong>${formatPlainNumber(countryCount)}</strong></div>
          <div><span>Ligas</span><strong>${formatPlainNumber(divisionCount)}</strong></div>
          <div><span>Clubes disponibles</span><strong>${formatPlainNumber(clubs.length)}</strong></div>
        </div>
      </div>
      <div class="welcome-features">
        <span>Plantel y táctica</span>
        <span>Mercado</span>
        <span>Finanzas y sponsors</span>
        <span>Estadio e hinchas</span>
        <span>Academia</span>
        <span>Empleados</span>
        <span>Mensajes</span>
        <span>Sistema ESPECIAL</span>
      </div>
      <div class="founder-mode-card card">
        <div>
          <p class="label">Modo alternativo</p>
          <h3>Fundar tu propio club</h3>
          <p class="muted">Empezás sin jugadores, sin dinero, con estadio de capacidad 0, prestigio 10 y 500 hinchas. No tendrás objetivos de directiva ni despidos, pero deberás construir todo desde Mercado, Estadio y Finanzas.</p>
          <p class="warn small"><strong>Modo no recomendado para tu primera partida.</strong></p>
        </div>
        <button id="welcomeFounderMode" class="primary" type="button">Modo Fundador</button>
      </div>
      <div class="row welcome-section-title">
        <div>
          <p class="label">Clubes que aceptan tu prestigio actual</p>
          <h3>Opciones disponibles para empezar</h3>
        </div>
        <button id="welcomeOpenSearch" class="ghost">Abrir búsqueda completa</button>
      </div>
      ${clubs.length ? `<div class="starter-club-grid">${clubs.map(club => starterClubCardMarkup(club, { prestige, compact:true, buttonDataAttr:'data-welcome-club', buttonLabel:'Empezar' })).join('')}</div>` : '<div class="card"><p class="muted">No hay clubes disponibles con tu prestigio actual.</p></div>'}
    </section>`;
  $('welcomeOpenSearch')?.addEventListener('click', () => openNewGameModal(true));
  $('welcomeFounderMode')?.addEventListener('click', () => openFounderModeModal());
  document.querySelectorAll('[data-welcome-club]').forEach(button => {
    button.addEventListener('click', () => openNewGameModal(false, { selectedClubId:Number(button.dataset.welcomeClub || 0) }));
  });
}

function renderAll(){
  applySelectedClubTheme(game?.selectedClubId || 0);
  if(game && currentGameIsFounderMode()) evaluateFounderGoals({ silent:false });
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
  if($('topResignClubBtn')){
    $('topResignClubBtn').disabled = !game || game.gameOver?.active;
    $('topResignClubBtn').classList.toggle('hidden', !game || game.gameOver?.active);
  }
  if(!game){
    hideNotice();
    if(activeTab === 'ranking' && typeof renderRankingOnline === 'function'){
      renderRankingOnline();
      return;
    }
    renderWelcomeScreen();
    return;
  }
  if(typeof syncPlayerStarsWithClubs === 'function') syncPlayerStarsWithClubs(game);
  if(game.gameOver?.active){
    renderGameOverScreen();
    return;
  }
  repairBotRosters({ reason:'render' });
  if(activeTab === 'players') activeTab = 'market';
  const renderers = { home:renderHome, messages:renderMessages, market:renderMarket, academy:renderAcademy, firstTeam:renderFirstTeam, squad:renderSquad, tactics:renderTactics, training:renderTraining, stadium:renderStadium, employees:renderEmployees, scouting:renderScoutingCenter, fixture:renderFixture, standings:renderStandings, stats:renderStats, mystats:renderManagerStats, finance:renderFinances, ranking:renderRankingOnline, special:renderSpecial };
  const renderer = renderers[activeTab] || renderers.home;
  try{
    renderer();
  }catch(err){
    console.error('Error renderizando pestaña', activeTab, err);
    if(activeTab === 'firstTeam' && firstTeamTab !== 'tactics'){
      try{
        firstTeamTab = 'tactics';
        renderFirstTeam();
        showNotice('Se detectó un problema en una subpestaña de Primer Equipo. Se volvió a Táctica.');
        return;
      }catch(fallbackErr){
        console.error('Error en fallback de Primer Equipo', fallbackErr);
      }
    }
    view.innerHTML = `<div class="card blocker"><h2>No se pudo abrir esta sección</h2><p>La partida no se borró. Probá volver a Inicio o usar el verificador.</p><p class="muted small">Detalle técnico: ${escapeHtml(err?.message || String(err || 'error'))}</p><div class="row"><button class="primary" data-render-fallback-home>Ir a Inicio</button><button class="ghost" data-render-fallback-verify>Verificar que todo esté bien</button></div></div>`;
    document.querySelector('[data-render-fallback-home]')?.addEventListener('click', () => { activeTab = 'home'; renderAll(); });
    document.querySelector('[data-render-fallback-verify]')?.addEventListener('click', () => { if(typeof openIntegrityChecker === 'function') openIntegrityChecker(); });
  }
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
  if(typeof nextOwnMatchInfo === 'function') return nextOwnMatchInfo()?.match || null;
  for(let roundIndex=Math.max(0, Number(game.matchdayIndex || 0)); roundIndex<game.fixtures.length; roundIndex++){
    const round = game.fixtures[roundIndex];
    const match = (round.matches || []).find(m => !m.played && (m.homeId === game.selectedClubId || m.awayId === game.selectedClubId));
    if(match) return match;
  }
  return null;
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
    items.push({ tone:'bad', icon:'!', title:'Debes confirmar tu equipo', text:'Hay lesionados o suspendidos propios fuera de la convocatoria válida.', tab:'tactics' });
  }else if(tacticErrors.length){
    items.push({ tone:'bad', icon:'11', title:'Debes confirmar tu equipo', text:tacticErrors.slice(0,2).join(' '), tab:'tactics' });
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

function daysUntilNextOwnMatchLabel(){
  if(!game) return '';
  if(!isRegularSeason()){
    const remaining = isPreseason() ? Math.max(0, PRESEASON_TURNS - Number(game.phaseTurn || 0)) : isPostseason() ? Math.max(0, postseasonTurnsForCurrentSeason() - Number(game.phaseTurn || 0)) : 0;
    if(remaining > 0) return `<div class="office-days-remaining"><span>Días restantes</span><strong>${remaining}</strong></div>`;
    return '';
  }
  const info = typeof nextOwnMatchInfo === 'function' ? nextOwnMatchInfo() : null;
  if(!info?.date || typeof daysBetweenIsoDates !== 'function' || typeof currentCalendarDate !== 'function') return '';
  const days = Math.max(0, daysBetweenIsoDates(currentCalendarDate(), info.date));
  return `<div class="office-days-remaining"><span>Días restantes</span><strong>${days}</strong></div>`;
}

function managerOfficeMarkup({ next, position, clubPlayers, avgOverall, avgFitness, avgMorale, cohesion, deltaClass, deltaText }){
  const activeSponsors = (game.sponsors?.active || []).filter(s => Number(s.turnsRemaining || 0) > 0).length;
  const objectiveInfo = typeof managerObjectiveProgressInfo === 'function' ? managerObjectiveProgressInfo() : { active:false, objective:null, played:0, ppg:0, progress:0, minMatches:10, remainingMatches:10 };
  const ppg = objectiveInfo.ppg || managerPointsPerGame();
  const founderMode = currentGameIsFounderMode();
  const objectiveReduction = typeof managerObjectiveReductionForClub === 'function' ? managerObjectiveReductionForClub(game.selectedClubId) : 0;
  const objectiveText = founderMode ? 'Fundador' : (objectiveInfo.active ? `${objectiveInfo.objective.toFixed(2)}${objectiveReduction > 0 ? ` (-${objectiveReduction}%)` : ''}` : '—');
  const extraText = objectiveInfo.extraMatches > 0 ? ` Prórroga fija de ${objectiveInfo.extraMatches} partido(s) por promedio general histórico ${objectiveInfo.generalPpg.toFixed(2)} al inicio de temporada.` : '';
  const objectiveProgressText = objectiveInfo.played < objectiveInfo.minMatches
    ? `Se evaluará tu continuidad en los próximos ${objectiveInfo.remainingMatches} partido(s).${extraText}`
    : (objectiveInfo.ppg > objectiveInfo.objective ? 'La confianza de la directiva se sostiene por ahora.' : 'La directiva evalúa despedirte.');
  const objectiveProgress = founderMode
    ? founderGoalProgressMarkup()
    : (objectiveInfo.active ? `<div class="manager-objective-progress ${objectiveInfo.ppg > objectiveInfo.objective ? 'ok' : 'warn'}"><div class="manager-objective-progress-head"><span>Confianza de la directiva</span><strong>${Math.round(objectiveInfo.confidence || objectiveInfo.progress)}%</strong></div><div class="manager-objective-bar"><span style="width:${Math.min(100, Math.max(0, objectiveInfo.confidence || objectiveInfo.progress))}%"></span></div><p>${objectiveProgressText}</p></div>` : '');
  const phase = phaseLabel();
  const daysRemainingBox = daysUntilNextOwnMatchLabel();
  const nextBox = next
    ? `<div class="office-next-match">${daysRemainingBox}<p class="label">Próximo compromiso</p>${matchPreview(next)}</div>`
    : `<div class="office-next-match">${daysRemainingBox}<p class="label">Próximo compromiso</p><div class="empty-office-box"><strong>Sin partido confirmado</strong><span>${escapeHtml(phase)}</span></div></div>`;
  return `<div class="manager-office">
    <div class="office-main-card">
      <div class="office-club-head">
        ${clubBadge(game.selectedClubId)}
        <div><p class="label">Oficina del manager</p><h2>${escapeHtml(clubName(game.selectedClubId))}</h2><p class="tagline">${escapeHtml(phase)} · Fecha de liga ${Math.min(Number(game.matchdayIndex || 0) + 1, game.fixtures?.length || 0)}</p></div>
      </div>
      <div class="office-mini-grid">
        <div><span>Posición</span><strong>${position || '—'}°</strong></div>
        <div><span>Plantel</span><strong>${clubPlayers.length}/${MAX_PLAYERS_PER_CLUB}</strong></div>
        <div><span>Presupuesto</span><strong class="office-budget-compact ${budgetTone(game.budget || 0)}">${typeof formatBudgetMillions === 'function' ? formatBudgetMillions(game.budget || 0) : formatMoney(game.budget || 0)}</strong><em class="${deltaClass}">${deltaText}</em></div>
        <div><span>Prom. pts/partido</span><strong>${ppg ? ppg.toFixed(2) : '0.00'}</strong><em>Temporada</em></div>
        <div><span>Objetivo</span><strong>${objectiveText}</strong></div>
        <div><span>Sponsors activos</span><strong>${activeSponsors}</strong></div>
      </div>
      ${objectiveProgress}
      <div class="office-status-bars">
        ${miniStatusBar('Media', avgOverall, 99)}
        ${miniStatusBar('Físico', avgFitness, 99)}
        ${miniStatusBar('Moral', avgMorale, 99)}
        ${miniStatusBar('Cohesión', cohesion, 100)}
      </div>
    </div>
    <div class="office-side-card">
      ${nextBox}
      <div class="advance-control office-advance"><div class="advance-buttons advance-buttons-single"><button id="advanceUnifiedBtn" class="primary">Avanzar día</button></div><div id="advanceProgressBox">${advanceProgressMarkup()}</div></div>
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

function gameOverStatCard(label, value){
  return `<div class="card"><p class="label">${escapeHtml(label)}</p><strong>${escapeHtml(String(value ?? '—'))}</strong></div>`;
}
function renderGameOverScreen(){
  const state = game?.gameOver || {};
  const snapshot = state.snapshot || (typeof gameOverSnapshot === 'function' ? gameOverSnapshot() : {});
  const ppg = Number(state.ppg || (typeof managerCurrentPPG === 'function' ? managerCurrentPPG() : 0));
  const objective = Number(state.objective || MANAGER_OBJECTIVE_PPG || 0);
  const budget = Number(snapshot.finalBudget || game?.budget || 0);
  const score = Number(snapshot.managerScore || 0);
  const prestige = typeof currentManagerPrestige === 'function' ? currentManagerPrestige() : Number(game?.managerStats?.prestige || 0);
  const prestigeLabel = typeof formatManagerPrestige === 'function' ? formatManagerPrestige(prestige) : String(prestige);
  const xp = typeof currentManagerExperience === 'function' ? currentManagerExperience() : Number(game?.managerStats?.experience || 0);
  view.innerHTML = `<div class="game-over-screen">
    <div class="card game-over-card">
      <p class="label">Sin club</p>
      <h1>La directiva te despidió</h1>
      <p>${escapeHtml(state.reason || 'La directiva decidió terminar tu ciclo por no cumplir el objetivo deportivo.')}</p>
      <p class="muted small">La partida no se reinicia. El mundo sigue igual y podés buscar otro club disponible según tu prestigio.</p>
      <div class="game-over-objective">
        <div><span>Prom. pts/partido</span><strong>${ppg.toFixed(2)}</strong></div>
        <div><span>Objetivo</span><strong>${objective ? objective.toFixed(2) : '—'}</strong></div>
        <div><span>Partidos oficiales</span><strong>${Number(state.matches || snapshot.won + snapshot.drawn + snapshot.lost || 0)}</strong></div>
      </div>
      <div class="grid cols-6 compact-team-stats game-over-stats">
        ${gameOverStatCard('Manager', snapshot.managerName || game?.rankingManagerName || 'Manager')}
        ${gameOverStatCard('Prestigio', prestigeLabel)}
        ${gameOverStatCard('Experiencia', xp)}
        ${gameOverStatCard('Club saliente', snapshot.club || clubName(game?.selectedClubId))}
        ${gameOverStatCard('Temporada', snapshot.season || game?.seasonNumber || 1)}
        ${gameOverStatCard('División', snapshot.division || clubDivision(game?.selectedClubId).name)}
        ${gameOverStatCard('Posición', snapshot.position ? `${snapshot.position}°` : '—')}
        ${gameOverStatCard('Puntos ranking', score)}
        ${gameOverStatCard('PTS', snapshot.points || 0)}
        ${gameOverStatCard('PG', snapshot.won || 0)}
        ${gameOverStatCard('PE', snapshot.drawn || 0)}
        ${gameOverStatCard('PP', snapshot.lost || 0)}
        ${gameOverStatCard('GF / GC', `${snapshot.goalsFor || 0} / ${snapshot.goalsAgainst || 0}`)}
        ${gameOverStatCard('Presupuesto final', formatMoney(budget))}
      </div>
      <div class="row game-over-actions">
        <button class="primary" id="btnGameOverNewGame">Buscar otro club</button>
        <button class="ghost" id="btnGameOverSave">Guardar carrera</button>
      </div>
    </div>
  </div>`;
  $('btnGameOverNewGame')?.addEventListener('click', () => openNewGameModal(true));
  $('btnGameOverSave')?.addEventListener('click', saveLocal);
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
      <div class="card"><p class="label">Presupuesto</p><div class="metric small ${budgetTone(game.budget || 0)}">${formatMoney(game.budget || 0)}</div><p class="small ${deltaClass}">Último balance: ${deltaText}</p></div>
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
    ${lastTurnSummaryMarkup()}

  `;
  $('advanceUnifiedBtn')?.addEventListener('click', advanceCalendarOneStep);
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
  const btn = $('advanceUnifiedBtn') || $('advanceMatchBtn') || $('advanceDayBtn');
  if(!btn || !game) return;
  const lockLeft = typeof advanceLockLeftMs === 'function' ? advanceLockLeftMs() : Math.max(0, (game.advanceLockedUntil || 0) - Date.now());
  const seasonEnded = game.seasonFinalized || seasonPhase() === 'finalized';
  const ownInfo = typeof nextOwnMatchInfo === 'function' ? nextOwnMatchInfo() : null;
  const ownDueToday = Boolean(isRegularSeason() && ownInfo?.date && typeof isCurrentDateOnOrAfterIso === 'function' && isCurrentDateOnOrAfterIso(ownInfo.date));
  const invalid = ownDueToday ? validateCurrentTactic(false) : [];
  let text = 'Avanzar día';
  let disabled = false;
  btn.classList.remove('secondary');
  btn.classList.add('primary');
  if(seasonEnded){
    text = 'Temporada finalizada';
    disabled = true;
  }else if(lockLeft > 0){
    text = `Espera ${formatClock(lockLeft)}`;
    disabled = true;
  }else if(game.gameOver?.active){
    text = 'Buscar club';
    disabled = false;
  }else if(isRegularSeason() && ownDueToday){
    text = 'Jugar partido de hoy';
    if(game.mustReviewTactics){
      text = 'Revisar táctica';
      disabled = true;
    }else if(invalid.length){
      text = 'Táctica incompleta';
      disabled = true;
    }
  }else if(isPreseason()){
    const opponentId = Number(game.pendingFriendlyOpponentId || 0);
    text = opponentId && typeof canPlayPreseasonFriendly === 'function' && canPlayPreseasonFriendly() ? 'Jugar amistoso' : 'Avanzar día';
  }else if(isPostseason()){
    text = 'Avanzar día';
  }
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
  const lockLeft = typeof advanceLockLeftMs === 'function' ? advanceLockLeftMs() : Math.max(0, (game.advanceLockedUntil || 0) - Date.now());
  if(lockLeft <= 0) return 100;
  const duration = Math.max(1, Number(game.advanceLockDurationMs || ADVANCE_LOCK_MS || lockLeft));
  return clamp(Math.round(((duration - lockLeft) / duration) * 100), 0, 100);
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
function weekdayLabelFromIso(iso){
  if(!validIsoDate(iso)) return '—';
  const labels = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  const date = new Date(`${iso}T00:00:00Z`);
  return labels[date.getUTCDay()] || '—';
}
function currentWeekdayLabel(){
  if(!game) return '—';
  const iso = validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
  return weekdayLabelFromIso(iso);
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
    <div class="vs">VS<br><span class="small">${escapeHtml(typeof matchDateLabel === 'function' ? matchDateLabel(match.date) : match.date)}</span></div>
    <div><div class="team-name">${clubSpan(match.awayId)}</div></div>
    ${matchFieldSummaryMarkup(match)}
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

function assistantAdvicePool(){
  const cfg = window.GAME_CONFIG?.mensajesAsistente || {};
  return Array.isArray(cfg.consejos) ? cfg.consejos.filter(Boolean) : [];
}
function assistantAdviceManagerName(){
  return String(game?.rankingManagerName || (typeof storedManagerName === 'function' ? storedManagerName() : '') || 'Míster').trim() || 'Míster';
}
function assistantAdviceText(raw){
  const managerName = assistantAdviceManagerName();
  return String(raw || '')
    .replaceAll('#usuario#', managerName)
    .replaceAll('#manager#', managerName)
    .replaceAll('{{usuario}}', managerName)
    .replaceAll('{{manager}}', managerName);
}
function ensureAssistantAdviceState(){
  if(!game) return null;
  game.assistantAdviceState = game.assistantAdviceState && typeof game.assistantAdviceState === 'object' && !Array.isArray(game.assistantAdviceState) ? game.assistantAdviceState : {};
  game.assistantAdviceState.used = Array.isArray(game.assistantAdviceState.used) ? game.assistantAdviceState.used.map(Number).filter(Number.isFinite) : [];
  game.assistantAdviceState.lastTurn = Number.isFinite(Number(game.assistantAdviceState.lastTurn)) ? Number(game.assistantAdviceState.lastTurn) : -99999;
  game.assistantAdviceState.count = Math.max(0, Math.round(Number(game.assistantAdviceState.count || 0)));
  return game.assistantAdviceState;
}
function pickAssistantAdviceIndex(pool, state, reason='daily'){
  if(!pool.length) return -1;
  const used = new Set((state?.used || []).map(Number));
  if(used.size >= pool.length){
    state.used = [];
    used.clear();
  }
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game?.matchdayIndex || 0);
  let idx = typeof hashNumber === 'function' ? hashNumber(`assistant-advice-${reason}-${game?.seasonNumber || 1}-${turn}-${state?.count || 0}`, pool.length) : Math.floor(Math.random() * pool.length);
  for(let i=0; i<pool.length; i++){
    const candidate = (idx + i) % pool.length;
    if(!used.has(candidate)) return candidate;
  }
  return idx;
}
function maybePushAssistantAdviceMessage(reason='daily', options={}){
  if(!game) return null;
  const cfg = window.GAME_CONFIG?.mensajesAsistente || {};
  if(cfg.activo === false) return null;
  const pool = assistantAdvicePool();
  if(!pool.length) return null;
  const state = ensureAssistantAdviceState();
  if(!state) return null;
  const force = Boolean(options.force || reason === 'new_game');
  const turn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game.matchdayIndex || 0);
  const interval = Math.max(1, Math.round(Number(cfg.frecuenciaDias || 12)));
  if(!force && turn - Number(state.lastTurn || -99999) < interval) return null;
  const idx = pickAssistantAdviceIndex(pool, state, reason);
  if(idx < 0) return null;
  state.used.push(idx);
  state.lastTurn = turn;
  state.count += 1;
  return pushGameMessage({
    type:'asistente',
    priority:'normal',
    title: cfg.titulo || 'Consejo del asistente',
    body: assistantAdviceText(pool[idx])
  });
}
function queueInitialAssistantAdviceMessages(){
  return maybePushAssistantAdviceMessage('new_game', { force:true });
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
  const messages = Array.isArray(game.messages) ? game.messages : [];
  const unread = messages.filter(m => !m.read).length;
  const pendingOffers = messages.filter(m => m.action?.type === 'transferOffer' && m.action.status === 'pending').length;
  const highPriority = messages.filter(m => m.priority === 'high').length;
  const rows = messages.map(m => messageCard(m)).join('');
  view.innerHTML = `
    <div class="section-title compact-section-title"><h2>Mensajes</h2><p class="tagline">Bandeja compacta de avisos del club.</p></div>
    <div class="messages-shell">
      <div class="messages-toolbar card">
        <div class="messages-toolbar-item"><p class="label">Bandeja</p><strong>${messages.length}</strong><span>Total</span></div>
        <div class="messages-toolbar-item"><p class="label">Nuevos</p><strong>${unread}</strong><span>Sin leer</span></div>
        <div class="messages-toolbar-item"><p class="label">Ofertas</p><strong>${pendingOffers}</strong><span>Pendientes</span></div>
        <div class="messages-toolbar-item"><p class="label">Importantes</p><strong>${highPriority}</strong><span>Prioridad alta</span></div>
      </div>
      <div class="message-list">${rows || '<div class="card message-empty-card"><p class="muted">No hay mensajes todavía.</p></div>'}</div>
    </div>`;
  document.querySelectorAll('[data-accept-offer]').forEach(btn => btn.addEventListener('click', () => acceptTransferOffer(btn.dataset.acceptOffer)));
  document.querySelectorAll('[data-convince-player]').forEach(btn => btn.addEventListener('click', () => convinceSpecialClausePlayer(btn.dataset.convincePlayer)));
  document.querySelectorAll('[data-reject-offer]').forEach(btn => btn.addEventListener('click', () => rejectTransferOffer(btn.dataset.rejectOffer)));
  saveLocal(true);
}
function messageIcon(type){
  const map = { transferOffer:'💰', evento:'⚽', finance:'💵', staff:'🧑‍💼', warning:'⚠️', info:'✉️', noticia:'📰', directiva:'🏛️', asistente:'🎧' };
  return map[String(type || '').trim()] || '✉️';
}
function messageToneClass(type, priority){
  if(priority === 'high') return 'message-tone-high';
  const key = String(type || '').toLowerCase();
  if(['transferoffer','finance'].includes(key)) return 'message-tone-money';
  if(['evento','noticia'].includes(key)) return 'message-tone-sport';
  if(['warning'].includes(key)) return 'message-tone-alert';
  if(['staff','directiva'].includes(key)) return 'message-tone-board';
  return 'message-tone-info';
}
function messageTypeLabel(type){
  const raw = String(type || 'info').trim();
  if(!raw) return 'Info';
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}
function messageTransferPlayer(m){
  if(m?.action?.type !== 'transferOffer') return null;
  return playerById(Number(m.action.playerId || 0));
}
function messagePlayerLink(player, label=null){
  if(!player) return '';
  const text = label || player.name || 'Jugador';
  return `<button type="button" class="linklike message-player-link" data-player-id="${Number(player.id)}" title="Abrir ficha del jugador">${escapeHtml(text)}</button>`;
}
function messageTitleHtml(m){
  const player = messageTransferPlayer(m);
  if(player) return `Oferta por ${messagePlayerLink(player, playerLastName(player.name))}`;
  return escapeHtml(m.title);
}
function messageBodyHtml(m){
  const player = messageTransferPlayer(m);
  const safeBody = escapeHtml(m.body || '');
  if(!player?.name) return safeBody;
  const safeName = escapeHtml(player.name);
  const link = messagePlayerLink(player, player.name);
  if(safeBody.includes(safeName)) return safeBody.split(safeName).join(link);
  return `${safeBody} <span class="message-player-inline">Jugador: ${link}</span>`;
}
function transferOfferStatusLabel(status){
  const map = {
    accepted:'Aceptada',
    rejected:'Rechazada',
    blocked_by_board:'Bloqueada por directiva',
    auto_rejected_intransferible:'Rechazada: intransferible',
    convinced:'Jugador convencido',
    forced_sale:'Venta ejecutada'
  };
  return map[status] || String(status || 'Cerrada');
}
function messageCard(m){
  const isSpecialClauseOffer = m.action?.type === 'transferOffer' && m.action?.origin === 'special_clause';
  const action = m.action?.type === 'transferOffer' && m.action.status === 'pending'
    ? `<div class="row message-actions"><button class="primary" data-accept-offer="${escapeHtml(m.id)}">Aceptar oferta</button>${isSpecialClauseOffer ? `<button class="ghost" data-convince-player="${escapeHtml(m.id)}">Convencer al jugador de quedarse</button>` : ''}<button class="ghost" data-reject-offer="${escapeHtml(m.id)}">Rechazar</button></div>`
    : (m.action?.status ? `<span class="pill message-status-pill">${escapeHtml(transferOfferStatusLabel(m.action.status))}</span>` : '');
  const toneClass = messageToneClass(m.type, m.priority);
  const unreadMark = m.read ? '' : '<span class="message-unread-dot" title="Mensaje nuevo"></span>';
  return `<div class="card message-card ${toneClass} ${m.read ? '' : 'unread'}">
    <div class="message-card-accent"></div>
    <div class="message-card-main">
      <div class="row message-card-head">
        <div class="message-head-left">
          <div class="message-meta-row">
            <span class="message-type-chip">${messageIcon(m.type)} ${escapeHtml(messageTypeLabel(m.type || 'info'))}</span>
            <span class="message-date-chip">Temporada ${m.season || 1} · Día ${((Number(m.turn || 0)) * DAYS_PER_ADVANCE) + 1}</span>
            ${unreadMark}
          </div>
          <h3>${messageTitleHtml(m)}</h3>
        </div>
        <span class="pill ${m.priority === 'high' ? 'warn' : ''}">${m.priority === 'high' ? 'Importante' : 'Normal'}</span>
      </div>
      <div class="message-paper"><p>${messageBodyHtml(m)}</p></div>
      ${action}
    </div>
  </div>`;
}
function hasPendingTransferOfferForPlayer(playerId){
  const id = Number(playerId);
  return (game?.messages || []).some(m => m.action?.type === 'transferOffer' && m.action.status === 'pending' && Number(m.action.playerId) === id);
}
function playerSeasonStatsForOffers(player){
  const st = game?.playerStats?.[player?.id] || {};
  return {
    played:Number(st.played || 0),
    goals:Number(st.goals || 0),
    assists:Number(st.assists || 0),
    injuries:Number(st.injuries || 0),
    red:Number(st.red || 0),
    goalErrors:Number(st.goalErrors || 0),
    errors:Number(st.errors || 0),
    keySaves:Number(st.keySaves || 0)
  };
}
function playerQualifiesForTransferOffers(player){
  if(!player) return false;
  const st = playerSeasonStatsForOffers(player);
  const played = Number(st.played || 0);
  const directProduction = Number(st.goals || 0) + Number(st.assists || 0) + Number(st.keySaves || 0);
  const isStar = typeof playerStarRecord === 'function' && Boolean(playerStarRecord(player));
  const young = Number(player.age || 99) <= 23;
  const goodYoungProfile = young && visibleOverall(player) >= 58 && played >= 2;
  const transferListed = Boolean(player.transferListed);
  if(isStar && played > 0) return true;
  if(goodYoungProfile && directProduction > 0) return true;
  if(transferListed && hasPlayerSalaryPaid(player) && played > 0) return true;
  if(PLAYER_OFFERS_REQUIRE_MATCHES && played <= 0) return false;
  if(PLAYER_OFFERS_REQUIRE_GOAL_OR_ASSIST && (st.goals + st.assists) <= 0) return false;
  return true;
}
function playerOfferProfile(player){
  const st = playerSeasonStatsForOffers(player);
  const isStar = typeof playerStarRecord === 'function' && Boolean(playerStarRecord(player));
  const young = Number(player.age || 99) <= 23;
  const production = Number(st.goals || 0) + Number(st.assists || 0) + Number(st.keySaves || 0);
  if(isStar) return 'star';
  if(young && visibleOverall(player) >= 58 && (production > 0 || Number(st.played || 0) >= 5)) return 'young_good';
  if(Boolean(player.transferListed)) return 'transfer_listed';
  return 'standard';
}
function playerOfferPerformanceScore(player){
  const st = playerSeasonStatsForOffers(player);
  const profile = playerOfferProfile(player);
  const production = (st.goals * 24) + (st.assists * 18) + (st.keySaves * 14);
  const youthBonus = Number(player.age || 99) <= 21 ? 22 : Number(player.age || 99) <= 23 ? 12 : 0;
  const starBonus = profile === 'star' ? 55 : 0;
  const listedPenalty = profile === 'transfer_listed' ? 18 : 0;
  const reliabilityPenalty = (st.injuries * 10) + (st.red * 12) + (st.goalErrors * 18) + (st.errors * 4);
  return Math.max(0, (visibleOverall(player) * 0.42) + (st.played * 2) + production + youthBonus + starBonus - listedPenalty - reliabilityPenalty);
}
function playerOfferRange(player){
  const profile = playerOfferProfile(player);
  if(profile === 'star') return { min:35, max:60 };
  if(profile === 'young_good') return { min:18, max:35 };
  if(profile === 'transfer_listed') return { min:6, max:18 };
  const minRate = Number(PLAYER_OFFER_MIN_CLAUSE_RATE || 0.05);
  const maxRate = Number(PLAYER_OFFER_MAX_CLAUSE_RATE || 0.15);
  return { min:Math.round(minRate * 100), max:Math.max(Math.round(minRate * 100), Math.round(maxRate * 100)) };
}
function playerOfferPercent(player, salt=''){
  const range = playerOfferRange(player);
  const minPct = Math.max(1, Math.round(range.min || 5));
  const maxPct = Math.max(minPct, Math.round(range.max || 15));
  const span = Math.max(0, maxPct - minPct);
  const score = playerOfferPerformanceScore(player);
  const scoreBonus = Math.min(span, Math.floor(score / 42));
  const noise = span > 0 ? hashNumber(`player-offer-pct-${player?.id}-${salt}-${game?.seasonNumber || 1}`, span + 1) : 0;
  return clamp(minPct + Math.max(scoreBonus, Math.floor(noise * 0.55)), minPct, maxPct);
}
function buildTransferOfferFinancials(player, pct){
  const clause = refreshPlayerClause(player);
  const grossAmount = Math.max(0, Math.round(clause * Number(pct || 0) / 100));
  const taxAmount = Math.round(grossAmount * Number(TRANSFER_AFA_TAX_RATE || 0));
  const netAmount = Math.max(0, grossAmount - taxAmount);
  return { clause, grossAmount, taxAmount, netAmount };
}
function normalizeFederationKey(value){
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function transferTaxFederationByCountry(country){
  const key = normalizeFederationKey(country);
  const configured = typeof TRANSFER_TAX_FEDERATIONS === 'object' && TRANSFER_TAX_FEDERATIONS ? TRANSFER_TAX_FEDERATIONS : {};
  const map = Object.fromEntries(Object.entries(configured).map(([countryName, federation]) => [normalizeFederationKey(countryName), String(federation || '').trim() || 'Federación']));
  const aliases = { brazil:'Brasil', england:'Inglaterra', spain:'España', espana:'España', italy:'Italia', romania:'Rumania' };
  return map[key] || map[normalizeFederationKey(aliases[key])] || 'Federación';
}
function transferTaxFederationForSource(source){
  const sourceObj = typeof source === 'object' && source ? source : { name:String(source || '') };
  const sourceClubId = Number(sourceObj.id || sourceObj.sourceClubId || 0);
  if(sourceClubId > 0){
    const sourceClub = seed?.clubs?.find(c => Number(c.id) === sourceClubId);
    if(sourceClub) return transferTaxFederationByCountry(clubCountry(sourceClub));
  }
  const nameKey = normalizeFederationKey(sourceObj.name || sourceObj.club || sourceObj.foreignClub || source);
  const genericClubFederations = [
    { keys:['lisboa', 'porto'], value:'FPF' },
    { keys:['london'], value:'FA' },
    { keys:['milano'], value:'FIGC' },
    { keys:['paris'], value:'FFF' },
    { keys:['berlin'], value:'DFB' },
    { keys:['madrid'], value:'RFEF' },
    { keys:['amsterdam'], value:'KNVB' },
    { keys:['montevideo'], value:'AUF' },
    { keys:['santos'], value:'CBF' }
  ];
  const found = genericClubFederations.find(item => item.keys.some(key => nameKey.includes(key)));
  if(found) return found.value;
  const selectedClub = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId));
  return transferTaxFederationByCountry(selectedClub ? clubCountry(selectedClub) : game?.selectedCountry || 'Argentina');
}
function transferOfferBody(source, player, financials, pct, suffix=''){
  const sourceObj = typeof source === 'object' && source ? source : { name:String(source || 'Club interesado') };
  const foreignClub = sourceObj.name || 'Club interesado';
  const federation = sourceObj.federation || transferTaxFederationForSource(sourceObj);
  return `${foreignClub} ofrece ${formatMoney(financials.grossAmount)} por ${player.name}. La oferta equivale al ${pct}% de su cláusula. ${federation} retiene ${formatMoney(financials.taxAmount)} en impuestos de traspaso; el club recibiría ${formatMoney(financials.netAmount)} netos.${suffix ? ' ' + suffix : ''}`;
}
function managerPointsPerGame(){
  return typeof managerCurrentPPG === 'function' ? managerCurrentPPG() : 0;
}
function botTransferOfferClub(player){
  const clubs = (seed?.clubs || []).filter(c => Number(c.id) !== Number(game?.selectedClubId));
  if(!clubs.length) return { name:FOREIGN_CLUBS[0] || 'Club interesado', id:-1 };
  const sameDivision = clubs.filter(c => String(c.divisionId || '') === String(seed.clubs.find(x => Number(x.id) === Number(game?.selectedClubId))?.divisionId || ''));
  const pool = sameDivision.length ? sameDivision : clubs;
  const club = pool[hashNumber(`bot-offer-club-${player.id}-${game?.seasonNumber || 1}-${game?.matchdayIndex || 0}`, pool.length)];
  return { name:club?.name || 'Club interesado', id:Number(club?.id || -1) };
}

function currentManagerLeaguePosition(){
  const divisionId = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId))?.divisionId || null;
  const table = typeof sortedStandings === 'function' ? sortedStandings(divisionId) : [];
  const index = table.findIndex(row => Number(row.clubId) === Number(game?.selectedClubId));
  return index >= 0 ? index + 1 : 20;
}
function specialClauseOfferScheduleState(){
  if(!game || !SPECIAL_CLAUSE_OFFER_ENABLED) return null;
  const season = Number(game.seasonNumber || 1);
  const clubId = Number(game.selectedClubId || 0);
  const total = Number(game.fixtures?.length || 0);
  if(!clubId || total <= 0) return null;
  const start = Math.max(0, total - Number(SPECIAL_CLAUSE_OFFER_LAST_MATCHDAYS || 10));
  const minCount = Number(SPECIAL_CLAUSE_OFFER_MIN_PER_SEASON || 1);
  const maxCount = Math.max(minCount, Number(SPECIAL_CLAUSE_OFFER_MAX_PER_SEASON || 2));
  const targetCount = Math.max(0, Math.min(maxCount, minCount + hashNumber(`special-clause-count-${season}-${clubId}`, Math.max(1, maxCount - minCount + 1))));
  const candidates = [];
  for(let i=start; i<total; i++) candidates.push(i);
  candidates.sort((a,b)=>hashNumber(`special-clause-date-${season}-${clubId}-${a}`, 100000)-hashNumber(`special-clause-date-${season}-${clubId}-${b}`, 100000));
  const scheduled = candidates.slice(0, targetCount).sort((a,b)=>a-b);
  const state = game.specialClauseOffers;
  if(!state || Number(state.season || 0) !== season || Number(state.clubId || 0) !== clubId){
    game.specialClauseOffers = { season, clubId, targetCount, scheduled, generated:[], skipped:[] };
  }else{
    game.specialClauseOffers.targetCount = Number.isFinite(Number(state.targetCount)) ? Number(state.targetCount) : targetCount;
    game.specialClauseOffers.scheduled = Array.isArray(state.scheduled) && state.scheduled.length ? state.scheduled : scheduled;
    game.specialClauseOffers.generated = Array.isArray(state.generated) ? state.generated : [];
    game.specialClauseOffers.skipped = Array.isArray(state.skipped) ? state.skipped : [];
  }
  return game.specialClauseOffers;
}
function sameLeagueClauseOfferClub(player){
  const selectedClub = seed?.clubs?.find(c => Number(c.id) === Number(game?.selectedClubId));
  const clubs = (seed?.clubs || []).filter(c => Number(c.id) !== Number(game?.selectedClubId) && String(c.divisionId || '') === String(selectedClub?.divisionId || ''));
  const pool = clubs.length ? clubs : (seed?.clubs || []).filter(c => Number(c.id) !== Number(game?.selectedClubId));
  if(!pool.length) return { name:'Club interesado', id:-1 };
  const club = pool[hashNumber(`special-clause-club-${game?.seasonNumber || 1}-${game?.matchdayIndex || 0}-${player?.id || 0}`, pool.length)];
  return { name:club?.name || 'Club interesado', id:Number(club?.id || -1) };
}
function maybeGenerateSpecialClauseOffer(match){
  if(!game || !match || !SPECIAL_CLAUSE_OFFER_ENABLED || !isRegularSeason()) return null;
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)) return null;
  const state = specialClauseOfferScheduleState();
  if(!state) return null;
  const matchday = Number(game.matchdayIndex || 0);
  const scheduled = Array.isArray(state.scheduled) ? state.scheduled.map(Number) : [];
  const generated = Array.isArray(state.generated) ? state.generated.map(Number) : [];
  const skipped = Array.isArray(state.skipped) ? state.skipped.map(Number) : [];
  if(!scheduled.includes(matchday) || generated.includes(matchday) || skipped.includes(matchday)) return null;
  const topPlayers = playersByClub(game.selectedClubId)
    .filter(p => playerClauseFor(p) > 0 && !hasPendingTransferOfferForPlayer(p.id))
    .sort((a,b)=>visibleOverall(b)-visibleOverall(a) || refreshPlayerClause(b)-refreshPlayerClause(a) || a.age-b.age)
    .slice(0, Math.max(1, Number(SPECIAL_CLAUSE_OFFER_TOP_PLAYERS || 3)));
  if(!topPlayers.length){
    state.skipped.push(matchday);
    return null;
  }
  const player = topPlayers[hashNumber(`special-clause-player-${state.season}-${state.clubId}-${matchday}`, topPlayers.length)];
  const source = sameLeagueClauseOfferClub(player);
  const financials = buildTransferOfferFinancials(player, 100);
  const federation = transferTaxFederationForSource(source);
  const body = `${source.name}, club de tu misma liga, comunicó que está dispuesto a pagar la cláusula completa de ${player.name}. La oferta es de ${formatMoney(financials.grossAmount)}. ${federation} retiene ${formatMoney(financials.taxAmount)}; el club recibiría ${formatMoney(financials.netAmount)} netos. Podés aceptar la venta o intentar convencer al jugador de quedarse.`;
  const msg = pushGameMessage({
    type:'mercado',
    priority:'high',
    title:`Oferta de cláusula por ${playerLastName(player.name)}`,
    body,
    action:{ type:'transferOffer', status:'pending', origin:'special_clause', playerId:player.id, amount:financials.grossAmount, grossAmount:financials.grossAmount, taxAmount:financials.taxAmount, netAmount:financials.netAmount, foreignClub:source.name, sourceClubId:source.id, pct:100, canConvince:true }
  });
  state.generated.push(matchday);
  return msg;
}
function maybeGenerateTransferOffer(match){
  if(!game || !match) return;
  maybeGenerateSpecialClauseOffer(match);
  const ownPlayers = playersByClub(game.selectedClubId);
  const listedCount = ownPlayers.filter(p => Boolean(p.transferListed)).length;
  const chance = clamp(Number(BOT_TRANSFER_OFFER_BASE_CHANCE || 0.28) + Math.min(Number(BOT_TRANSFER_LISTED_EXTRA_CHANCE || 0.22), listedCount * 0.045), 0, 0.72);
  if(Math.random() > chance) return;
  const candidates = ownPlayers
    .filter(p => playerClauseFor(p) > 0 && !isUnavailable(p.id) && !hasPendingTransferOfferForPlayer(p.id) && !isPlayerUntransferable(p) && playerQualifiesForTransferOffers(p));
  if(!candidates.length) return;
  candidates.sort((a,b)=>{
    const listedDelta = Number(Boolean(b.transferListed)) - Number(Boolean(a.transferListed));
    if(listedDelta) return listedDelta;
    return playerOfferPerformanceScore(b)-playerOfferPerformanceScore(a) || visibleOverall(b)-visibleOverall(a);
  });
  const listedPool = candidates.filter(p => Boolean(p.transferListed));
  const basePool = listedPool.length && Math.random() < 0.70 ? listedPool : candidates.slice(0, Math.min(14, candidates.length));
  const player = basePool[hashNumber(`offer-${game.seasonNumber}-${game.matchdayIndex}-${match.id}-${Date.now()}`, basePool.length)];
  const pct = playerOfferPercent(player, `auto-${match.id || game.matchdayIndex}-${Date.now()}`);
  const financials = buildTransferOfferFinancials(player, pct);
  const source = Math.random() < 0.78 ? botTransferOfferClub(player) : { name:FOREIGN_CLUBS[hashNumber(`foreign-${player.id}-${game.matchdayIndex}`, FOREIGN_CLUBS.length)], id:-1 };
  const note = player.transferListed ? 'El jugador figura como transferible, por eso la oferta es más probable pero tiende a ser menor.' : 'Si aceptás, el jugador se va del club.';
  pushGameMessage({
    type:'mercado',
    priority:'high',
    title:`Oferta por ${playerLastName(player.name)}`,
    body:transferOfferBody(source, player, financials, pct, note),
    action:{ type:'transferOffer', status:'pending', playerId:player.id, amount:financials.grossAmount, grossAmount:financials.grossAmount, taxAmount:financials.taxAmount, netAmount:financials.netAmount, foreignClub:source.name, sourceClubId:source.id, pct }
  });
}
function seasonEndOfferScore(player){
  return playerOfferPerformanceScore(player) + hashNumber(`season-end-score-${game?.seasonNumber || 1}-${player.id}`, 9);
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
    .filter(p => playerClauseFor(p) > 0 && !isUnavailable(p.id) && !hasPendingTransferOfferForPlayer(p.id) && !isPlayerUntransferable(p) && playerQualifiesForTransferOffers(p));
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
    const pct = playerOfferPercent(player, `season-end-${season}-${created.length}-${Date.now()}`);
    const financials = buildTransferOfferFinancials(player, pct);
    const foreignClub = FOREIGN_CLUBS[hashNumber(`season-end-foreign-${season}-${player.id}-${created.length}`, FOREIGN_CLUBS.length)];
    const msg = pushGameMessage({
      type:'mercado',
      priority:'high',
      title:`Oferta por ${playerLastName(player.name)}`,
      body:transferOfferBody({ name:foreignClub }, player, financials, pct, 'Si aceptás, el jugador se va del club.'),
      action:{ type:'transferOffer', status:'pending', playerId:player.id, amount:financials.grossAmount, grossAmount:financials.grossAmount, taxAmount:financials.taxAmount, netAmount:financials.netAmount, foreignClub, pct, origin:'season_end' }
    });
    if(msg) created.push(msg);
  }
  game.seasonEndPlayerOffers = { season, generatedAt:turnStamp({ action:'seasonEndPlayerOffers' }), count:created.length };
  return created;
}
function completeTransferSaleFromMessage(msg, player, options={}){
  const grossAmount = Number(msg.action.grossAmount ?? msg.action.amount ?? 0);
  const taxAmount = Number(msg.action.taxAmount ?? Math.round(grossAmount * Number(TRANSFER_AFA_TAX_RATE || 0)));
  const netAmount = Number(msg.action.netAmount ?? Math.max(0, grossAmount - taxAmount));
  const saleFederation = transferTaxFederationForSource({ id:msg.action.sourceClubId, name:msg.action.foreignClub });
  recordBudgetChange(netAmount, `Venta de ${player.name} (neto ${saleFederation})`, { type:'transfer_sale', playerId:player.id, grossAmount, taxAmount, netAmount, federation:saleFederation, origin:msg.action.origin || 'offer' });
  const unlockedForTransfers = typeof unlockTransferBudgetFromSale === 'function' ? unlockTransferBudgetFromSale(netAmount) : 0;
  const destinationClubId = Number(msg.action.sourceClubId || -1);
  player.clubId = destinationClubId > 0 ? destinationClubId : -1;
  player.transferListed = false;
  player.intransferible = false;
  game.marketPlayers = (game.marketPlayers || []).map(p => p.id === player.id ? { ...p, clubId:destinationClubId > 0 ? destinationClubId : -1, transferListed:false, intransferible:false, sold:destinationClubId > 0 ? false : true } : p);
  removePlayerFromCurrentTactic(player.id);
  if(typeof syncPlayerStarsWithClubs === 'function') syncPlayerStarsWithClubs(game);
  msg.action.status = options.status || 'accepted';
  msg.action.grossAmount = grossAmount;
  msg.action.taxAmount = taxAmount;
  msg.action.netAmount = netAmount;
  const federation = transferTaxFederationForSource({ id:msg.action.sourceClubId, name:msg.action.foreignClub });
  const defaultSuffix = ` Ingreso neto recibido: ${formatMoney(netAmount)}. Impuesto ${federation}: ${formatMoney(taxAmount)}.${unlockedForTransfers ? ` La directiva liberó ${formatMoney(unlockedForTransfers)} para futuros fichajes.` : ''}`;
  msg.body += `${options.bodyPrefix ? ' ' + options.bodyPrefix : ' Oferta aceptada.'}${defaultSuffix}`;
  saveLocal(true);
  showNotice(options.notice || `${player.name} fue vendido. Neto recibido: ${formatMoney(netAmount)}.`);
  renderMessages();
}
function acceptTransferOffer(messageId){
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending') return;
  const player = playerById(msg.action.playerId);
  if(!player || player.clubId !== game.selectedClubId){ showNotice('La oferta ya no está disponible.'); return; }
  const pct = Number(msg.action.pct || 0);
  if(isPlayerUntransferable(player) && pct < 100){
    msg.action.status = 'auto_rejected_intransferible';
    msg.body += ` Oferta rechazada automáticamente: ${player.name} está marcado como intransferible y sólo se aceptan propuestas por la cláusula completa.`;
    saveLocal(true);
    showNotice('Oferta rechazada automáticamente: jugador intransferible.');
    renderMessages();
    return;
  }
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){ showRosterMinimumNotice(); return; }
  if(typeof playerStarRecord === 'function' && playerStarRecord(player) && pct < Number(STAR_PLAYER_DIRECTIVE_MIN_OFFER_PCT || 40)){
    msg.action.status = 'blocked_by_board';
    msg.body += ` La directiva bloqueó la venta porque es un jugador muy importante para el club. Para una estrella exige una oferta superior al ${STAR_PLAYER_DIRECTIVE_MIN_OFFER_PCT}% de su cláusula.`;
    saveLocal(true);
    showNotice('La directiva bloqueó la venta porque es un jugador muy importante para el club.');
    renderMessages();
    return;
  }
  completeTransferSaleFromMessage(msg, player);
}
function specialClauseStayMessages(player, managerName){
  return [
    `Estaba esperando que me llamaras, ${managerName}. No quiero irme. Sé que el club necesita el dinero, pero quiero quedarme a pelear por cosas grandes. Nos vemos en el entrenamiento.`,
    `Gracias por hablar conmigo, ${managerName}. La oferta era fuerte, pero este club todavía tiene algo pendiente conmigo. Me quedo.`,
    `Me llamó el otro club, sí, pero necesitaba escuchar al mío. Si vos me querés acá, me quedo a competir. Nos vemos mañana en la práctica, ${managerName}.`,
    `No voy a negar que la cláusula me hizo pensar, ${managerName}. Pero quiero ser importante acá. Guardá la lapicera, todavía no firmo nada afuera.`,
    `Tenía miedo de que el club quisiera venderme sin decirme nada. Si me pedís que me quede, me quedo. Quiero pelearla con esta camiseta, ${managerName}.`
  ];
}
function specialClauseLeaveMessages(player, managerName){
  return [
    `${managerName}, el rendimiento del equipo no es lo que esperaba y tengo mejores aspiraciones. Me da felicidad saber que el club recibe un buen dinero por mi venta. Te agradezco y me voy.`,
    `Míster, lo pensé mucho. El equipo no está en el lugar donde imaginaba competir y siento que esta oportunidad no la puedo dejar pasar. Gracias por todo; me voy tranquilo porque al club le entra una suma importante.`,
    `${managerName}, me cuesta decirlo, pero necesito otro desafío. El presente deportivo no acompaña mis objetivos. Ojalá este dinero ayude al club. Gracias por intentarlo.`,
    `Te escuché, pero ya tomé una decisión. Quiero competir por objetivos más altos y hoy siento que acá no los tengo cerca. Me voy agradecido y con la tranquilidad de dejarle dinero al club.`,
    `Aprecio que me hayas llamado, ${managerName}. Pero la propuesta es importante y el rendimiento del equipo no coincide con mis aspiraciones. Me voy con respeto y gratitud.`
  ];
}
function showSpecialClauseResponseModal(player, text, status='stay'){
  if(typeof openModal !== 'function') return;
  const clubId = Number(game?.selectedClubId || player?.clubId || 0);
  const title = status === 'leave' ? 'El jugador decidió irse' : 'El jugador se queda';
  const tone = status === 'leave' ? 'leave' : 'stay';
  const html = `<div class="special-clause-response-modal ${tone}">
    ${clubBadge(clubId)}
    <p class="label">Respuesta a la charla</p>
    <h2>${escapeHtml(player?.name || 'Jugador')}</h2>
    <blockquote>${escapeHtml(text || '')}</blockquote>
    <button class="primary" data-close-modal>Continuar</button>
  </div>`;
  openModal(html);
}
function convinceSpecialClausePlayer(messageId){
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending' || msg.action.origin !== 'special_clause') return;
  const player = playerById(msg.action.playerId);
  if(!player || player.clubId !== game.selectedClubId){ showNotice('La oferta ya no está disponible.'); return; }
  if(!hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){ showRosterMinimumNotice(); return; }
  const position = currentManagerLeaguePosition();
  const failureChance = clamp((Number(position || 20) * 2) / 100, 0.02, 0.95);
  const managerName = game?.rankingManagerName || storedManagerName() || 'Manager';
  const roll = Math.random();
  if(roll < failureChance){
    const variants = specialClauseLeaveMessages(player, managerName);
    const text = variants[hashNumber(`special-clause-leave-${player.id}-${Date.now()}`, variants.length)];
    completeTransferSaleFromMessage(msg, player, { status:'forced_sale', bodyPrefix:text, notice:`${player.name} decidió irse. La cláusula fue ejecutada.` });
    showSpecialClauseResponseModal(player, text, 'leave');
    return;
  }
  const variants = specialClauseStayMessages(player, managerName);
  const text = variants[hashNumber(`special-clause-stay-${player.id}-${Date.now()}`, variants.length)];
  msg.action.status = 'convinced';
  msg.body += ` ${text}`;
  game.playerMorale[player.id] = clamp(currentMorale(player.id) + 4, 1, 99);
  saveLocal(true);
  showNotice(`${player.name} aceptó quedarse en el club.`);
  renderMessages();
  showSpecialClauseResponseModal(player, text, 'stay');
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


function canBotDismissPlayer(player){
  if(!player || Number(player.clubId || 0) === Number(game?.selectedClubId)) return false;
  if(player.emergencyLocked || player.emergencyBot) return false;
  const clubId = Number(player.clubId || 0);
  const squad = playersByClub(clubId);
  if(squad.length <= Math.max(MIN_PLAYERS_PER_CLUB, 20)) return false;
  const group = playerRoleGroup(player.position);
  const counts = rosterGroupCounts(squad);
  const req = minimumRosterRequirements();
  return (counts[group] || 0) > (req[group] || 0) + 1;
}
function processBotDismissals(){
  if(!game || !seed?.clubs?.length) return 0;
  if(Math.random() > Number(BOT_DISMISS_CHECK_CHANCE || 0.38)) return 0;
  let dismissed = 0;
  seed.clubs.forEach(club => {
    if(Number(club.id) === Number(game.selectedClubId)) return;
    const squad = playersByClub(club.id).filter(canBotDismissPlayer).sort((a,b)=>visibleOverall(a)-visibleOverall(b) || Number(b.age||0)-Number(a.age||0));
    const maxCuts = playersByClub(club.id).length > MAX_PLAYERS_PER_CLUB ? 2 : 1;
    for(let i=0; i<Math.min(maxCuts, squad.length); i++){
      const player = squad[i];
      if(hashNumber(`bot-dismiss-${game.seasonNumber}-${game.matchdayIndex}-${club.id}-${player.id}`, 100) > 42) continue;
      player.clubId = 0;
      player.freeAgent = true;
      player.transferListed = false;
      player.salaryPaidCount = 0;
      player.lastSalaryPaidSeason = 0;
      refreshPlayerClause(player);
      game.marketPlayers = game.marketPlayers || [];
      const idx = game.marketPlayers.findIndex(p => Number(p.id) === Number(player.id));
      const copy = { ...player, clubId:0, freeAgent:true, sold:false, transferListed:false };
      if(idx >= 0) game.marketPlayers[idx] = { ...game.marketPlayers[idx], ...copy };
      else game.marketPlayers.push(copy);
      dismissed += 1;
    }
  });
  if(dismissed && typeof repairBotRosters === 'function') repairBotRosters({ reason:'bot_dismissals' });
  return dismissed;
}

function buildBalancedFreeAgentPositionGroups(count, label='market'){
  const total = Math.max(0, Math.round(Number(count) || 0));
  if(total <= 0) return [];
  const rules = (Array.isArray(MARKET_FREE_AGENT_POSITION_GROUPS) && MARKET_FREE_AGENT_POSITION_GROUPS.length)
    ? MARKET_FREE_AGENT_POSITION_GROUPS
    : PLAYER_GENERATION_POSITION_GROUPS;
  const weighted = rules.map(rule => ({ ...rule, probability:Math.max(0, Number(rule.probability || 0)) }));
  const weightTotal = weighted.reduce((acc, rule) => acc + rule.probability, 0) || 1;
  const quotas = weighted.map(rule => {
    const exact = total * (rule.probability || 0) / weightTotal;
    return { rule, exact, count:Math.floor(exact), rest:exact - Math.floor(exact) };
  });
  let assigned = quotas.reduce((acc, item) => acc + item.count, 0);
  quotas.slice().sort((a,b) => b.rest - a.rest || String(a.rule.id).localeCompare(String(b.rule.id))).forEach(item => {
    if(assigned < total){ item.count += 1; assigned += 1; }
  });
  const groups = [];
  quotas.forEach(item => { for(let i=0;i<item.count;i++) groups.push(item.rule.id); });
  return groups.sort((a,b) => hashNumber(`${label}-${a}-pos-order`, 100000) - hashNumber(`${label}-${b}-pos-order`, 100000));
}
function pickFreeAgentPositionFromGroup(groupId, id, label){
  const rules = (Array.isArray(MARKET_FREE_AGENT_POSITION_GROUPS) && MARKET_FREE_AGENT_POSITION_GROUPS.length)
    ? MARKET_FREE_AGENT_POSITION_GROUPS
    : PLAYER_GENERATION_POSITION_GROUPS;
  const group = rules.find(item => item.id === groupId) || PLAYER_GENERATION_POSITION_GROUPS.find(item => item.id === groupId) || PLAYER_GENERATION_POSITION_GROUPS[2];
  const pool = group.positions || ['MC'];
  return pool[hashNumber(`${label}-${id}-free-pos`, pool.length)];
}

function generateMarketPlayers(count=50, options={}){
  const startId = Number.isFinite(Number(options.startId))
    ? Math.max(1, Math.round(Number(options.startId)))
    : Math.max(0, ...(seed?.players || []).map(p => Number(p.id) || 0)) + 1000;
  const label = options.label || 'market';
  const nameContext = options.nameContext || 'Mercado Libre';
  const activePlayers = (seed?.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
  const generationContext = createPlayerGenerationContext(activePlayers.length + count, activePlayers);
  const balancedGroups = buildBalancedFreeAgentPositionGroups(count, label);
  const players = [];
  for(let i=0;i<count;i++){
    const id = startId + i;
    const group = balancedGroups[i] || pickPositionGroupForGeneration(id, label, generationContext);
    const position = pickFreeAgentPositionFromGroup(group, id, label);
    const player = generatedPlayerFactory({
      id,
      position,
      clubId:0,
      age:MARKET_FREE_AGENT_AGE_MIN + hashNumber(`${label}-age-${id}`, Math.max(1, MARKET_FREE_AGENT_AGE_MAX - MARKET_FREE_AGENT_AGE_MIN + 1)),
      prestige:52,
      nameContext,
      divisionName:'Mercado',
      generationContext,
      salaryFactor:MARKET_FREE_AGENT_SALARY_FACTOR,
      freeAgent:true,
      mediaMin:MARKET_FREE_AGENT_MEDIA_MIN,
      mediaMax:MARKET_FREE_AGENT_MEDIA_MAX,
      nationalityOverride:freeAgentNationalityForIndex(i, label)
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

