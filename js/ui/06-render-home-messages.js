/* Render general, inicio, calendario anual, mensajes y ofertas de venta recibidas. */

function renderWelcomeScreen(){
  const countryCount = new Set((seed?.clubs || []).map(club => clubCountry(club))).size;
  const divisionCount = (seed?.divisions || []).length;
  const challengeDefinition = typeof campoDestruidoChallengeDefinition === 'function' ? campoDestruidoChallengeDefinition() : null;
  const challengeVisible = typeof CAMPO_DESTRUIDO_OPTION_VISIBLE === 'undefined' ? false : Boolean(CAMPO_DESTRUIDO_OPTION_VISIBLE);
  const challengeAvailable = challengeVisible && typeof campoDestruidoChallengeAvailable === 'function' && campoDestruidoChallengeAvailable();
  const careerIds = typeof careerSaveSlotIds === 'function' ? careerSaveSlotIds() : [SAVE_SLOT_CAREER];
  const careerCards = careerIds.map(slotId => {
    const base = typeof baseSaveSlotLabel === 'function' ? baseSaveSlotLabel(slotId) : 'Carrera';
    return `
        <div class="card save-slot-card" data-save-slot-card="${escapeHtml(slotId)}">
          <div class="save-slot-main">
            <p class="label">Carrera normal</p>
            <h3 data-save-slot-title>${escapeHtml(base)} · Revisando...</h3>
            <p class="muted" data-save-slot-detail>Buscando datos del slot guardado.</p>
          </div>
          <div class="save-slot-actions">
            <button class="primary" data-slot-continue="${escapeHtml(slotId)}">Entrar</button>
            <button class="ghost danger" data-slot-new="${escapeHtml(slotId)}">Nueva</button>
          </div>
        </div>`;
  }).join('');
  view.innerHTML = `
    <section class="welcome-screen save-slots-screen">
      <div class="welcome-hero card">
        <div class="welcome-brand-column">
          <img class="game-brand-logo game-brand-logo-welcome" src="assets/logo-banner.png?v=8.73" alt="Una vida de manager" />
          <p class="label welcome-brand-kicker">Juego de fútbol online</p>
          <h2>Dirigí tu club y construí una carrera</h2>
          <p class="tagline">Juego de manager de fútbol para navegador con temporadas completas, tácticas, mercado de pases, juveniles, finanzas y competencias online. Tu carrera se guarda localmente en este navegador.</p>
        </div>
        <div class="welcome-summary">
          <div><span>Países</span><strong>${formatPlainNumber(countryCount)}</strong></div>
          <div><span>Ligas</span><strong>${formatPlainNumber(divisionCount)}</strong></div>
          <div><span>Carrera</span><strong>${formatPlainNumber(careerIds.length)}</strong></div>
        </div>
      </div>

      <div class="save-slot-grid">
        ${careerCards}

        ${challengeVisible ? `<div class="card save-slot-card save-slot-challenge ${challengeAvailable ? '' : 'blocker'}">
          <div class="save-slot-main">
            <p class="label">Reto predeterminado</p>
            <h3>${escapeHtml(challengeDefinition?.nombre || 'Campo destruido')}</h3>
            <p class="muted">${escapeHtml(challengeDefinition?.textos?.descripcionTarjeta || 'Reto no disponible.')}</p>
          </div>
          <div class="save-slot-actions">
            <button id="btnSlotCampoNew" class="primary" ${challengeAvailable ? '' : 'disabled'}>Iniciar reto</button>
            <button id="btnSlotCampoContinue" class="ghost" ${challengeAvailable ? '' : 'disabled'}>Continuar reto</button>
          </div>
        </div>` : ''}
      </div>

      <section class="welcome-about card" aria-labelledby="welcomeAboutTitle">
        <div>
          <p class="label">Una vida de manager · Juego de fútbol en navegador</p>
          <h3 id="welcomeAboutTitle">Gestioná el club dentro y fuera de la cancha</h3>
          <p class="muted">Elegí una liga, prepará el once, entrená al plantel, negociá contratos y transferencias, desarrollá tu Academia y avanzá temporada a temporada. También podés publicar desafíos y competir por categorías salariales en el ranking online.</p>
        </div>
        <div class="welcome-about-points" aria-label="Características principales">
          <span>Carrera y contratos</span>
          <span>Tácticas y simulación</span>
          <span>Mercado y juveniles</span>
          <span>Rankings y desafíos online</span>
        </div>
      </section>

      <div class="welcome-features">
        <span>1 carrera normal</span>
        <span>Guardado local</span>
        <span>Copas nacionales</span>
        <span>Competencias online</span>
      </div>
    </section>`;
  document.querySelectorAll('[data-slot-continue]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotId = btn.getAttribute('data-slot-continue') || SAVE_SLOT_CAREER;
      if(typeof loadCareerSlotOrNew === 'function') loadCareerSlotOrNew(slotId); else openNewGameModal(true);
    });
  });
  document.querySelectorAll('[data-slot-new]').forEach(btn => {
    btn.addEventListener('click', () => {
      const slotId = btn.getAttribute('data-slot-new') || SAVE_SLOT_CAREER;
      if(typeof startNewCareerFromSlot === 'function') startNewCareerFromSlot(slotId); else openNewGameModal(true);
    });
  });
  $('btnSlotCampoNew')?.addEventListener('click', () => { if(typeof startNewCampoDestruidoSlot === 'function') startNewCampoDestruidoSlot(); else openCampoDestruidoChallengeModal(); });
  $('btnSlotCampoContinue')?.addEventListener('click', () => { if(typeof continueCampoDestruidoSlot === 'function') continueCampoDestruidoSlot(); });
  if(typeof hydrateCareerSlotCards === 'function') hydrateCareerSlotCards().catch(()=>{});
}

function renderAll(){
  applySelectedClubTheme(game?.selectedClubId || 0);
  if(game && currentGameIsFounderMode()) evaluateFounderGoals({ silent:false });
  if(game?.gameOver?.active && isManagerWithoutClubBlockedTab(activeTab)) activeTab = 'home';
  if(typeof refreshManagerWithoutClubTabState === 'function') refreshManagerWithoutClubTabState();
  else if(typeof syncSidebarNavigationState === 'function') syncSidebarNavigationState();
  else document.querySelectorAll('.tabs [data-tab]').forEach(btn=>btn.classList.toggle('active', btn.dataset.tab === activeTab));

  if(game){
    const managerClubNode = $('managerClub');
    if(game.gameOver?.active){
      const identityKey = `without-club|${Number(game.selectedClubId || 0)}|${clubName(game.selectedClubId)}`;
      if(managerClubNode?.dataset.clubIdentityKey !== identityKey){
        managerClubNode.innerHTML = `<span>Sin club</span><small class="muted">Último: ${escapeHtml(clubName(game.selectedClubId))}</small>`;
        managerClubNode.dataset.clubIdentityKey = identityKey;
      }
      managerClubNode?.classList.add('side-club-name');
    }else{
      if(typeof renderPersistentClubIdentity === 'function') renderPersistentClubIdentity(managerClubNode, game.selectedClubId, clubName(game.selectedClubId));
      else managerClubNode.innerHTML = `${clubBadge(game.selectedClubId)}<span>${escapeHtml(clubName(game.selectedClubId))}</span>`;
      managerClubNode?.classList.add('side-club-name');
    }
  }else{
    const managerClubNode = $('managerClub');
    if(managerClubNode?.dataset.clubIdentityKey !== 'no-game') managerClubNode.textContent = 'Sin partida';
    if(managerClubNode) managerClubNode.dataset.clubIdentityKey = 'no-game';
    managerClubNode?.classList.remove('side-club-name');
  }
  refreshSidebarDate();
  $('btnSave').disabled = !game;
  if(typeof challengeScheduleOnlineHeaderRefresh === 'function') challengeScheduleOnlineHeaderRefresh();
  updateAssistantMessagesToggle();
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
  // V9.13: las revisiones que no modifican la vista actual se ejecutan en la cola ociosa.
  // Esto evita recorrer planteles, contratos y competiciones en cada cambio de pestaña.
  if(activeTab === 'players') activeTab = 'market';
  const renderers = { home:renderHome, messages:renderMessages, market:renderMarket, academy:renderAcademy, careerImprovements:renderCareerImprovements, firstTeam:renderFirstTeam, squad:renderSquad, tactics:renderTactics, training:renderTraining, stadium:renderStadium, employees:renderEmployees, scouting:renderScoutingCenter, fixture:renderFixture, clubWorldCup:renderClubWorldCup, standings:renderStandings, stats:renderStats, mystats:renderManagerStats, philosophy:renderManagerPhilosophy, careerJobs:renderCareerJobs, finance:renderFinances, ranking:renderRankingOnline, challenges:renderOnlineChallenges, special:renderSpecial, playerCareer:renderPlayerCareer, admin:typeof renderAdminTools === 'function' ? renderAdminTools : renderHome };
  if(game.gameOver?.active){
    if(isManagerWithoutClubBlockedTab(activeTab)) activeTab = 'home';
    if(typeof refreshManagerWithoutClubTabState === 'function') refreshManagerWithoutClubTabState();
    if(activeTab === 'home' || !renderers[activeTab]){
      renderGameOverScreen();
      return;
    }
  }
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
    view.innerHTML = `<div class="card blocker"><h2>No se pudo abrir esta sección</h2><p>La partida no se borró. Volvé a Inicio; los controles automáticos continuarán revisando la estructura del guardado.</p><p class="muted small">Detalle técnico: ${escapeHtml(err?.message || String(err || 'error'))}</p><div class="row"><button class="primary" data-render-fallback-home>Ir a Inicio</button></div></div>`;
    document.querySelector('[data-render-fallback-home]')?.addEventListener('click', () => { activeTab = 'home'; renderAll(); });
  }
}
function getNextMatchForSelected(){
  if(!game || !Array.isArray(game.fixtures)) return null;
  if(typeof nextOwnMatchInfo === 'function') return nextOwnMatchInfo()?.match || null;
  for(let roundIndex=0; roundIndex<game.fixtures.length; roundIndex++){
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

function homeLeagueOverallContext(clubId=game?.selectedClubId, teamOverall=0){
  const selectedDivision = typeof clubDivision === 'function' ? clubDivision(clubId) : null;
  const divisionId = String(selectedDivision?.id || seed?.clubs?.find(club => Number(club.id) === Number(clubId))?.divisionId || '');
  const divisionName = String(selectedDivision?.name || seed?.clubs?.find(club => Number(club.id) === Number(clubId))?.divisionName || 'la liga');
  const rows = (seed?.clubs || []).map(club => {
    const division = typeof clubDivision === 'function' ? clubDivision(club.id) : null;
    if(String(division?.id || club.divisionId || '') !== divisionId) return null;
    const squad = typeof playersByClub === 'function' ? playersByClub(club.id) : [];
    if(!squad.length) return null;
    return { clubId:Number(club.id), overall:Number(avg(squad.map(player => visibleOverall(player))) || 0) };
  }).filter(Boolean).sort((a,b) => b.overall - a.overall || a.clubId - b.clubId);
  const leagueAverage = rows.length ? Number(avg(rows.map(row => row.overall)).toFixed(1)) : Number(teamOverall || 0);
  const ownIndex = rows.findIndex(row => Number(row.clubId) === Number(clubId));
  return {
    divisionId,
    divisionName,
    leagueAverage,
    difference:Number((Number(teamOverall || 0) - leagueAverage).toFixed(1)),
    rank:ownIndex >= 0 ? ownIndex + 1 : 0,
    total:rows.length
  };
}
function homeEmptyEmployeeProfileMarkup(role='Empleado'){
  return `<span class="home-status-empty-profile" role="img" aria-label="${escapeHtml(`${role}: puesto vacante`)}"><svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="23" r="12"></circle><path d="M13 55c2-13 9-20 19-20s17 7 19 20"></path></svg></span>`;
}
function homeStatusAdvisorProfile(staffId){
  const active = typeof staffActive === 'function' && staffActive(staffId);
  const definition = typeof staffDefinition === 'function' ? staffDefinition(staffId) : null;
  const contract = active && typeof staffContract === 'function' ? staffContract(staffId) : null;
  const categoryId = String(contract?.category || 'regular');
  const category = active && typeof staffCategoryFor === 'function' ? staffCategoryFor(staffId, categoryId) : null;
  const roleName = String(definition?.nombre || (staffId === 'psychologist' ? 'Psicólogo' : staffId === 'kinesiologist' ? 'Kinesiólogo' : 'Segundo entrenador'));
  return {
    active,
    roleName,
    categoryName:String(category?.nombre || ''),
    image:active && typeof staffImageMarkup === 'function'
      ? staffImageMarkup(staffId, categoryId, 'home-status-advisor-photo')
      : homeEmptyEmployeeProfileMarkup(roleName),
    label:active ? `${roleName}${category?.nombre ? ` · ${category.nombre}` : ''}` : `Sin ${roleName.toLowerCase()}`
  };
}
function homeOverallDiagnosis(value, context){
  const diff = Number(context?.difference || 0);
  if(diff >= 6) return `La calidad del plantel está muy por encima de ${context.divisionName}. Tenemos nivel para asumir protagonismo.`;
  if(diff >= 3) return `El plantel supera la media de ${context.divisionName}. La base es competitiva para pelear arriba.`;
  if(diff > -2.5) return `La calidad está alineada con ${context.divisionName}. Los detalles tácticos y la regularidad pueden marcar la diferencia.`;
  if(diff > -6) return `Estamos algo por debajo de la media de ${context.divisionName}. Conviene reforzar puestos concretos.`;
  return `El plantel está claramente por debajo de ${context.divisionName}. Necesitamos mejorar calidad o compensar con una estructura muy sólida.`;
}
function homePhysicalDiagnosis(value, hasStaff){
  const n = Number(value || 0);
  if(n >= 92) return hasStaff ? 'El plantel está en condiciones excelentes. Podemos sostener la carga actual.' : 'El físico es excelente, aunque no hay kinesiólogo para sostener tratamientos y trabajos diferenciados.';
  if(n >= 82) return hasStaff ? 'La condición general es buena. Solo vigilaría a quienes acumulan más minutos.' : 'La condición es buena, pero falta apoyo especializado para prevenir y tratar sobrecargas.';
  if(n >= 70) return hasStaff ? 'El estado es aceptable. Recomiendo rotar a los más exigidos y cuidar la recuperación.' : 'Hay desgaste moderado y no contamos con kinesiólogo. Conviene bajar cargas y rotar.';
  if(n >= 55) return hasStaff ? 'Veo fatiga acumulada. Hay que reducir cargas y recuperar titulares antes de exigirlos.' : 'El físico está comprometido y no hay kinesiólogo. Evitá forzar jugadores y reducí las cargas.';
  return hasStaff ? 'El plantel está muy exigido. Forzar ahora eleva claramente el riesgo de lesión.' : 'La condición física es crítica y no hay kinesiólogo. La prioridad debe ser recuperar al plantel.';
}
function homeMoraleDiagnosis(value, hasStaff){
  const n = Number(value || 0);
  if(n >= 90) return hasStaff ? 'El vestuario está muy motivado. Es un buen momento para sostener confianza y exigencia.' : 'La moral es excelente, aunque no hay psicólogo para acompañar posibles cambios de ánimo.';
  if(n >= 80) return hasStaff ? 'El ánimo general es alto. El grupo responde bien al contexto actual.' : 'El vestuario está animado, pero no cuenta con apoyo psicológico especializado.';
  if(n >= 65) return hasStaff ? 'La moral es estable. Conviene atender pronto a suplentes y jugadores disconformes.' : 'La moral es estable, aunque sin psicólogo será más difícil corregir una caída rápida.';
  if(n >= 50) return hasStaff ? 'El ánimo es frágil. Recomiendo intervenir antes de que aparezcan conflictos.' : 'La moral es frágil y no hay psicólogo. Cuidá decisiones, promesas y reparto de minutos.';
  return hasStaff ? 'El vestuario atraviesa una crisis de confianza. Necesitamos una intervención inmediata.' : 'La moral está en crisis y no hay psicólogo. Evitá decisiones bruscas y buscá recuperar confianza.';
}
function homeCohesionDiagnosis(value, hasStaff){
  const n = Number(value || 0);
  if(n >= 85) return hasStaff ? 'El equipo funciona como un bloque y asimila bien las instrucciones.' : 'La cohesión es excelente, aunque no hay Segundo entrenador para seguir su evolución.';
  if(n >= 70) return hasStaff ? 'La coordinación colectiva es buena. Podemos profundizar automatismos.' : 'El grupo está bien coordinado, pero falta un Segundo entrenador que analice desajustes.';
  if(n >= 55) return hasStaff ? 'La cohesión es irregular. Hay que sostener una base táctica y evitar demasiados cambios.' : 'La cohesión es irregular y no hay Segundo entrenador. Conviene mantener roles y estructura.';
  if(n >= 40) return hasStaff ? 'El equipo todavía no funciona como un bloque. Recomiendo trabajo táctico y continuidad.' : 'El equipo está poco conectado y no hay Segundo entrenador. Priorizá entrenamiento táctico.';
  return hasStaff ? 'El grupo está fragmentado. La prioridad es reconstruir asociaciones y confianza colectiva.' : 'La cohesión es crítica y no hay Segundo entrenador. Reducir cambios y trabajar táctica es urgente.';
}
function homeStatusAdvisorCard({ label, value, max=100, profile, message, meta='', tone=null, iconMarkup='' }){
  const n = clamp(Math.round(Number(value) || 0), 0, max);
  const pct = max ? clamp(Math.round((n / max) * 100), 0, 100) : 0;
  const resolvedTone = tone || statusTone(pct);
  return `<article class="home-status-advisor-card ${escapeHtml(resolvedTone)}">
    <div class="home-status-advisor-head">
      <div class="home-status-advisor-profile">${iconMarkup || profile.image}</div>
      <div class="home-status-advisor-value"><span>${escapeHtml(label)}</span><strong>${n}</strong><small>${escapeHtml(meta)}</small></div>
    </div>
    <div class="home-status-advisor-source"><strong>${escapeHtml(profile.label)}</strong></div>
    <p>${escapeHtml(message)}</p>
    <i class="home-status-advisor-progress" aria-hidden="true"><b style="width:${pct}%"></b></i>
  </article>`;
}
function homeStatusAdvisorsMarkup({ avgOverall, avgFitness, avgMorale, cohesion }){
  const league = homeLeagueOverallContext(game.selectedClubId, avgOverall);
  const physical = homeStatusAdvisorProfile('kinesiologist');
  const morale = homeStatusAdvisorProfile('psychologist');
  const group = homeStatusAdvisorProfile('assistant_coach');
  const leagueMeta = `${league.divisionName} · media ${league.leagueAverage.toFixed(1)}${league.rank && league.total ? ` · ${league.rank}° de ${league.total}` : ''}`;
  const overallTone = league.difference >= 3 ? 'ok' : league.difference > -3 ? 'warn' : 'bad';
  const teamProfile = { label:'Comparación de liga', image:'' };
  return `<div class="office-status-advisors">
    ${homeStatusAdvisorCard({ label:'Media', value:avgOverall, max:99, profile:teamProfile, message:homeOverallDiagnosis(avgOverall, league), meta:leagueMeta, tone:overallTone, iconMarkup:`<span class="home-status-team-badge">${clubBadge(game.selectedClubId)}</span>` })}
    ${homeStatusAdvisorCard({ label:'Físico', value:avgFitness, max:99, profile:physical, message:homePhysicalDiagnosis(avgFitness, physical.active), meta:physical.active ? 'Informe del cuerpo médico' : 'Puesto vacante' })}
    ${homeStatusAdvisorCard({ label:'Moral', value:avgMorale, max:99, profile:morale, message:homeMoraleDiagnosis(avgMorale, morale.active), meta:morale.active ? 'Informe de vestuario' : 'Puesto vacante' })}
    ${homeStatusAdvisorCard({ label:'Cohesión', value:cohesion, max:100, profile:group, message:homeCohesionDiagnosis(cohesion, group.active), meta:group.active ? 'Análisis colectivo' : 'Puesto vacante' })}
  </div>`;
}
function visualAlertItems(){
  if(!game) return [];
  const items = [];
  const marketStatus = typeof transferMarketStatusInfo === 'function' ? transferMarketStatusInfo(game) : null;
  if(marketStatus){
    items.push({ tone:marketStatus.open ? 'ok' : 'warn', icon:'M', title:marketStatus.title, text:marketStatus.detail, tab:'market' });
  }
  const tacticErrors = isRegularSeason() ? validateCurrentTactic(false) : [];
  const injured = injuredPlayersByClub(game.selectedClubId);
  const pendingTransferOffers = (game.messages || []).filter(m => m.action?.type === 'transferOffer' && m.action.status === 'pending').length;
  const sponsorOffers = game.sponsors?.offers?.length || 0;
  const scoutingJobs = (game.academy?.scoutingJobs || []).filter(j => j.status === 'pending');
  const academyYouthOffers = (game.academy?.youthTransferOffers || []).filter(item => item.status === 'pending');
  const squadCount = playersByClub(game.selectedClubId).length;
  const salaryPressure = totalClubSalary(game.selectedClubId);
  if(game.mustReviewTactics){
    items.push({ tone:'bad', icon:'!', title:'Debes confirmar tu equipo', text:'Hay lesionados o suspendidos propios fuera de la convocatoria válida.', tab:'tactics' });
  }else if(tacticErrors.length){
    items.push({ tone:'bad', icon:'11', title:'Debes confirmar tu equipo', text:tacticErrors.slice(0,2).join(' '), tab:'tactics' });
  }
  if(injured.length){
    items.push({ tone:'warn', icon:'+', title:`${injured.length} lesionado(s)`, text:'Abrí Empleados para aplicar tratamientos y revisar la recuperación.', tab:'employees' });
  }
  const assistantUnread = unreadAssistantMessagesCount();
  if(assistantUnread){
    items.push({ tone:'assistant', icon:String(assistantUnread), title:`Tenés ${assistantUnread} mensaje(s) del asistente`, text:'Consejo nuevo pendiente de lectura.', tab:'messages' });
  }
  const unread = unreadMessagesCount();
  if(unread && !assistantUnread){
    items.push({ tone:'info', icon:'✉', title:`${unread} mensaje(s) nuevo(s)`, text:'Hay eventos pendientes para leer.', tab:'messages' });
  }
  if(pendingTransferOffers){
    items.push({ tone:'warn', icon:'$', title:`${pendingTransferOffers} oferta(s) por jugadores`, text:'Gestioná las ofertas desde Mensajes.', tab:'messages' });
  }
  if(sponsorOffers){
    items.push({ tone:'ok', icon:'S', title:`${sponsorOffers} sponsor(s) disponibles`, text:'Tenés ofertas con vencimiento para aceptar o rechazar.', tab:'stadium', mode:'sponsors' });
  }
  if(scoutingJobs.length){
    const nextDue = Math.min(...scoutingJobs.map(j => Number(j.dueTurn || 0)));
    const left = daysUntilTurn(nextDue);
    items.push({ tone:'info', icon:'A', title:'Captación en curso', text:`Informe de academia en ${formatDays(left)}.`, tab:'academy' });
  }
  if(academyYouthOffers.length){
    items.push({ tone:'ok', icon:'J', title:`${academyYouthOffers.length} oferta(s) por juveniles`, text:'Aceptá o rechazá las propuestas desde Tu Academia.', tab:'academy' });
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
  return `<div class="manager-alert-grid">${items.map(item => `<button class="manager-alert ${escapeHtml(item.tone)} ${item.tab ? 'clickable' : ''}" ${item.tab ? `data-go-tab="${escapeHtml(item.tab)}"` : ''}${item.mode ? ` data-go-mode="${escapeHtml(item.mode)}"` : ''} type="button"><span class="manager-alert-icon">${escapeHtml(item.icon)}</span><span><strong>${escapeHtml(item.title)}</strong><em>${escapeHtml(item.text)}</em></span></button>`).join('')}</div>`;
}

function daysUntilNextOwnMatchLabel(){
  if(!game) return '';
  if(!isRegularSeason()){
    const remaining = isPreseason() ? Math.max(0, PRESEASON_TURNS - Number(game.phaseTurn || 0)) : isPostseason() ? Math.max(0, postseasonTurnsForCurrentSeason() - Number(game.phaseTurn || 0)) : 0;
    if(remaining > 0) return `<div class="office-days-remaining"><span>Próximo compromiso en</span><strong>${remaining}</strong></div>`;
    return '';
  }
  const info = typeof nextOwnMatchInfo === 'function' ? nextOwnMatchInfo() : null;
  if(!info?.date || typeof daysBetweenIsoDates !== 'function' || typeof currentCalendarDate !== 'function') return '';
  const days = Math.max(0, daysBetweenIsoDates(currentCalendarDate(), info.date));
  return `<div class="office-days-remaining"><span>Próximo compromiso en</span><strong>${days}</strong></div>`;
}

function dailySkillPointsTracker(){
  if(!game || typeof currentCalendarDate !== 'function') return null;
  const special = typeof ensureSpecialState === 'function' ? ensureSpecialState() : game.special;
  if(!special || typeof special !== 'object') return null;
  const currentDate = String(currentCalendarDate() || game.currentDate || '');
  const currentSerial = Math.max(0, Math.round(Number(special.puntos_log_secuencia || 0)));
  const log = Array.isArray(special.puntos_log) ? special.puntos_log : [];
  let tracker = game.dailySkillPointsAnimation;
  if(!tracker || typeof tracker !== 'object'){
    tracker = { date:currentDate, lastSerial:currentSerial, pending:null };
    game.dailySkillPointsAnimation = tracker;
    return tracker;
  }
  tracker.lastSerial = Math.max(0, Math.round(Number(tracker.lastSerial || 0)));
  if(!tracker.date){
    tracker.date = currentDate;
    tracker.lastSerial = currentSerial;
    tracker.pending = null;
    return tracker;
  }
  if(String(tracker.date) !== currentDate){
    const newEntries = log
      .filter(entry => Math.max(0, Math.round(Number(entry?.serial || 0))) > tracker.lastSerial)
      .filter(entry => Number(entry?.points || 0) > 0)
      .sort((a,b) => Number(a.serial || 0) - Number(b.serial || 0));
    const total = newEntries.reduce((sum, entry) => sum + Math.max(0, Math.round(Number(entry.points || 0))), 0);
    tracker.pending = total > 0 ? {
      id:`daily-skill-${Date.now()}-${currentSerial}`,
      points:total,
      entries:newEntries.map(entry => ({ points:Math.max(0, Math.round(Number(entry.points || 0))), actionId:String(entry.actionId || '') })).slice(-8),
      fromDate:String(tracker.date || ''),
      date:currentDate,
      totalPoints:Math.max(0, Math.round(Number(special.puntos_habilidad || 0))),
      rendered:false
    } : null;
    tracker.date = currentDate;
    tracker.lastSerial = currentSerial;
  }else if(currentSerial < tracker.lastSerial){
    tracker.lastSerial = currentSerial;
    tracker.pending = null;
  }
  return tracker;
}
function dailySkillPointsEquation(entries=[], total=0){
  const values = (Array.isArray(entries) ? entries : []).map(entry => Math.max(0, Math.round(Number(entry?.points || 0)))).filter(Boolean);
  if(values.length <= 1) return 'Puntos obtenidos desde el último avance';
  if(values.length <= 4) return `${values.join(' + ')} = ${Math.max(0, Math.round(Number(total || 0)))}`;
  return `${values.length} recompensas acumuladas`;
}
function dailySkillPointsAnimationMarkup(){
  const tracker = dailySkillPointsTracker();
  const pending = tracker?.pending;
  if(!pending || pending.rendered) return '';
  pending.rendered = true;
  const points = Math.max(0, Math.round(Number(pending.points || 0)));
  return `<div class="daily-skill-points-animation" data-daily-skill-animation="${escapeHtml(pending.id)}" aria-live="polite">
    <span>Puntos del día</span>
    <strong data-daily-skill-count data-target="${points}">+0</strong>
    <small>${escapeHtml(dailySkillPointsEquation(pending.entries, points))}</small>
    <em>Total ${formatPlainNumber(pending.totalPoints || 0)}</em>
  </div>`;
}
function startDailySkillPointsAnimation(){
  const element = document.querySelector('[data-daily-skill-animation]');
  if(!element) return;
  const counter = element.querySelector('[data-daily-skill-count]');
  const target = Math.max(0, Math.round(Number(counter?.dataset?.target || 0)));
  const duration = 850;
  const startAt = performance.now();
  requestAnimationFrame(() => element.classList.add('is-visible'));
  function tick(now){
    const progress = Math.min(1, Math.max(0, (now - startAt) / duration));
    const eased = 1 - Math.pow(1 - progress, 3);
    if(counter) counter.textContent = `+${formatPlainNumber(Math.round(target * eased))}`;
    if(progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  setTimeout(() => element.classList.add('is-exiting'), 2450);
  setTimeout(() => {
    element.remove();
    if(game?.dailySkillPointsAnimation?.pending?.id === element.dataset.dailySkillAnimation){
      game.dailySkillPointsAnimation.pending = null;
    }
  }, 2900);
}

function managerOfficeMarkup({ next, position, clubPlayers, avgOverall, avgFitness, avgMorale, cohesion, deltaClass, deltaText }){
  const objectiveInfo = typeof managerObjectiveProgressInfo === 'function' ? managerObjectiveProgressInfo() : { active:false, objective:null, played:0, ppg:0, progress:0, minMatches:10, remainingMatches:10 };
  const ppg = objectiveInfo.ppg || managerPointsPerGame();
  const founderMode = currentGameIsFounderMode();
  const objectiveReduction = typeof managerObjectiveReductionForClub === 'function' ? managerObjectiveReductionForClub(game.selectedClubId) : 0;
  const objectiveLabelParts = String(objectiveInfo.label || '').split('·').map(part => part.trim()).filter(Boolean);
  const objectiveMeta = founderMode
    ? ''
    : (objectiveLabelParts.find(part => !/^\d+(?:[.,]\d+)?$/.test(part) && !/^carta\b/i.test(part)) || '');
  const objectiveValue = founderMode ? 'Fundador' : (objectiveInfo.active ? Number(objectiveInfo.objective || 0).toFixed(2) : '—');
  const objectiveReductionText = !founderMode && objectiveInfo.active && objectiveReduction > 0 ? `(-${objectiveReduction}%)` : '';
  const extraText = objectiveInfo.extraMatches > 0 ? ` Prórroga fija de ${objectiveInfo.extraMatches} partido(s) por promedio general histórico ${objectiveInfo.generalPpg.toFixed(2)} al inicio de temporada.` : '';
  const objectiveStateText = objectiveInfo.boardState || (objectiveInfo.ppg >= objectiveInfo.objective ? 'Cumple' : 'Riesgo');
  const objectiveGapText = objectiveInfo.active ? ` Diferencia actual: ${(Number(objectiveInfo.delta || 0) >= 0 ? '+' : '')}${Number(objectiveInfo.delta || 0).toFixed(2)} PPG.` : '';
  const objectiveExpectationText = objectiveInfo.expectation ? ` Expectativa: ${escapeHtml(objectiveInfo.expectation)}.` : '';
  const hiddenDeadlineCfg = typeof managerHiddenObjectiveConfig === 'function' ? managerHiddenObjectiveConfig() : { warningDay:200, evaluationDay:250 };
  const currentSeasonDay = typeof currentGlobalDayNumber === 'function' ? Math.max(1, Number(currentGlobalDayNumber() || 1)) : 1;
  const belowObjective = objectiveInfo.active && Number(objectiveInfo.ppg || 0) < Number(objectiveInfo.objective || 0);
  const objectiveProgressText = objectiveInfo.played < objectiveInfo.minMatches
    ? `Se evaluará tu rendimiento tras los próximos ${objectiveInfo.remainingMatches} partido(s).${objectiveExpectationText}${objectiveGapText}${extraText}`
    : belowObjective && currentSeasonDay < hiddenDeadlineCfg.warningDay
      ? `${escapeHtml(objectiveStateText)}.${objectiveExpectationText}${objectiveGapText} La advertencia formal de continuidad se activa en el día ${hiddenDeadlineCfg.warningDay}.`
      : belowObjective && currentSeasonDay < hiddenDeadlineCfg.evaluationDay
        ? `${escapeHtml(objectiveStateText)}.${objectiveExpectationText}${objectiveGapText} La decisión sobre tu continuidad se resolverá en el día ${hiddenDeadlineCfg.evaluationDay}.`
        : `${escapeHtml(objectiveStateText)}.${objectiveExpectationText}${objectiveGapText}`;
  const objectiveProgress = founderMode
    ? founderGoalProgressMarkup()
    : (objectiveInfo.active ? `<div class="manager-objective-progress ${escapeHtml(objectiveInfo.boardClass || (objectiveInfo.ppg >= objectiveInfo.objective ? 'ok' : 'warn'))}"><div class="manager-objective-progress-head"><span>Confianza de la directiva</span><strong>${Math.round(objectiveInfo.confidence || objectiveInfo.progress)}%</strong></div><div class="manager-objective-bar"><span style="width:${Math.min(100, Math.max(0, objectiveInfo.confidence || objectiveInfo.progress))}%"></span></div><p>${objectiveProgressText}</p></div>` : '');
  const phase = phaseLabel();
  const daysRemainingBox = daysUntilNextOwnMatchLabel();
  const nextBox = next
    ? `<div class="office-next-match">${daysRemainingBox}${matchPreview(next)}</div>`
    : `<div class="office-next-match">${daysRemainingBox}<div class="empty-office-box"><strong>Sin partido confirmado</strong><span>${escapeHtml(phase)}</span></div></div>`;
  return `<div class="manager-office">
    <div class="office-main-card">
      <p class="label">Oficina del manager</p>
      <div class="office-mini-grid">
        <div><span>Posición</span><strong>${position || '—'}°</strong></div>
        <div><span>Plantel</span><strong>${clubPlayers.length}/${MAX_PLAYERS_PER_CLUB}</strong></div>
        <div><span>Presupuesto</span><strong class="office-budget-compact ${budgetTone(game.budget || 0)}">${typeof formatBudgetMillions === 'function' ? formatBudgetMillions(game.budget || 0) : formatMoney(game.budget || 0)}</strong><em class="${deltaClass}">${deltaText}</em></div>
        <div><span>Prom. pts/partido</span><strong>${ppg ? ppg.toFixed(2) : '0.00'}</strong><em>Temporada</em></div>
        <div class="office-objective-card"><span>Objetivo</span><strong>${escapeHtml(objectiveValue)}</strong>${objectiveMeta || objectiveReductionText ? `<em class="office-objective-meta">${objectiveMeta ? `<span>${escapeHtml(objectiveMeta)}</span>` : ''}${objectiveReductionText ? `<small>${escapeHtml(objectiveReductionText)}</small>` : ''}</em>` : ''}</div>
      </div>
      ${objectiveProgress}
      ${homeStatusAdvisorsMarkup({ avgOverall, avgFitness, avgMorale, cohesion })}
    </div>
    <div class="office-side-card">
      ${nextBox}
      <div class="advance-control office-advance"><div class="advance-buttons advance-buttons-single"><div class="advance-main-row"><button id="advanceUnifiedBtn" class="primary">Avanzar día</button>${dailySkillPointsAnimationMarkup()}</div><div class="auto-advance-switch-panel"><p class="label">Avance automático</p><button id="advanceAutoClickerBtn" class="auto-advance-switch is-off" type="button" aria-pressed="false"><span class="auto-advance-switch-track"><i></i></span><strong data-auto-advance-state>OFF</strong></button></div></div><div id="advanceProgressBox">${advanceProgressMarkup()}</div></div>
    </div>
  </div>`;
}
function lastTurnSummaryMarkup(){
  const summary = game?.lastTurnSummary;
  if(!summary) return '';
  const items = Array.isArray(summary.items) ? summary.items.slice(0,5) : [];
  const itemMarkup = items.map(item => `<span class="turn-summary-compact-item ${escapeHtml(item.tone || 'info')}"><strong>${escapeHtml(item.label || 'Evento')}:</strong> ${escapeHtml(item.text || '')}</span>`).join('');
  return `<div class="turn-summary-compact ${escapeHtml(summary.tone || 'info')}" role="status" aria-label="Resumen del último avance">
    <span class="turn-summary-compact-title">${escapeHtml(summary.title || 'Último avance')}</span>
    ${summary.phase ? `<span class="turn-summary-compact-phase">${escapeHtml(summary.phase)}</span>` : ''}
    ${summary.result ? `<span class="turn-summary-compact-result">${escapeHtml(summary.result)}</span>` : ''}
    ${itemMarkup}
  </div>`;
}


const MANAGER_WITHOUT_CLUB_BLOCKED_TABS = new Set(['firstTeam','employees','scouting','stadium','market','finance']);
function isManagerWithoutClubBlockedTab(tab){
  const key = String(tab || '');
  if(game?.gameOver?.active && key === 'finance' && String(financeViewMode || 'main') === 'bank') return false;
  return Boolean(game?.gameOver?.active && MANAGER_WITHOUT_CLUB_BLOCKED_TABS.has(key));
}
function managerWithoutClubBlockedNotice(tab){
  const labels = { firstTeam:'Primer Equipo', academy:'Academia', employees:'Empleados', scouting:'Centro de Ojeo', stadium:'Estadio', market:'Mercado', finance:'Finanzas' };
  return `${labels[String(tab || '')] || 'Esta sección'} está bloqueada mientras el manager está sin club.`;
}
function refreshManagerWithoutClubTabState(){
  document.querySelectorAll('.tabs [data-tab]').forEach(btn => {
    const tab = String(btn.dataset.tab || '');
    const mode = String(btn.dataset.navMode || '');
    const blocked = game?.gameOver?.active && tab === 'finance'
      ? mode !== 'bank'
      : isManagerWithoutClubBlockedTab(tab);
    btn.disabled = blocked;
    btn.classList.toggle('tab-disabled', blocked);
  });
  if(typeof syncSidebarNavigationState === 'function') syncSidebarNavigationState();
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
  const title = state.type === 'resignation' ? 'Renunciaste al club' : 'Actualmente estás sin club';
  const fallbackReason = state.type === 'resignation' ? 'Renunciaste al cargo. El mundo de la partida sigue activo.' : 'Tu contrato terminó y podés continuar la carrera en otro equipo.';
  const displayReason = state.type === 'resignation' ? (state.reason || fallbackReason) : fallbackReason;
  view.innerHTML = `<div class="game-over-screen">
    <div class="card game-over-card">
      <p class="label">Inicio · Sin club</p>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(displayReason)}</p>
      <p class="muted small">La partida no se reinicia. Podés navegar el calendario, tablas, estadísticas, tus estadísticas y ranking online. Las áreas operativas del club quedan bloqueadas hasta firmar con otro equipo.</p>
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
        <div class="game-over-advance-wrap"><button class="primary" id="advanceUnifiedBtn">Avanzar día</button>${dailySkillPointsAnimationMarkup()}</div>
        <button class="ghost" id="btnGameOverNewGame">Buscar otro club</button>
        ${typeof founderModeEnabled === 'function' && founderModeEnabled() ? '<button class="ghost" id="btnGameOverFounder">Fundar club</button>' : ''}
        <button class="ghost" id="btnGameOverScoutingArchive">Archivo de jugadores ojeados</button>
        <button class="ghost" id="btnGameOverSave">Guardar carrera</button>
      </div>
      <div id="advanceProgressBox" style="margin-top:10px">${typeof advanceProgressMarkup === 'function' ? advanceProgressMarkup() : ''}</div>
      ${typeof managerJobMarketMarkup === 'function' ? managerJobMarketMarkup() : ''}
      ${lastTurnSummaryMarkup()}
    </div>
    ${typeof managerAvailableClubsPanelMarkup === 'function' ? managerAvailableClubsPanelMarkup({ context:'game-over', selectable:false }) : ''}
  </div>`;
  $('advanceUnifiedBtn')?.addEventListener('click', typeof requestAdvanceCalendarOneStep === 'function' ? requestAdvanceCalendarOneStep : advanceCalendarOneStep);
  startDailySkillPointsAnimation();
  $('btnGameOverNewGame')?.addEventListener('click', () => { if(typeof forceCloseModal === 'function') forceCloseModal(); openNewGameModal(true); });
  $('btnGameOverFounder')?.addEventListener('click', () => { if(typeof forceCloseModal === 'function') forceCloseModal(); openFounderModeModal(); });
  $('btnGameOverScoutingArchive')?.addEventListener('click', () => { if(typeof openScoutingReportsModal === 'function') openScoutingReportsModal('all'); else showNotice('El archivo de ojeo no está disponible todavía.'); });
  $('btnGameOverSave')?.addEventListener('click', saveLocal);
  document.querySelectorAll('[data-accept-job-offer]').forEach(btn => btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if(typeof acceptManagerJobOffer === 'function') acceptManagerJobOffer(btn.dataset.acceptJobOffer || '');
  }));
  document.querySelectorAll('[data-reject-job-offer]').forEach(btn => btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if(typeof rejectManagerJobOffer === 'function') rejectManagerJobOffer(btn.dataset.rejectJobOffer || '');
  }));
  document.querySelectorAll('[data-apply-job-club]').forEach(btn => btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if(typeof applyForManagerJob === 'function') applyForManagerJob(Number(btn.dataset.applyJobClub || 0));
  }));
  if(typeof updateAdvanceButtonState === 'function') updateAdvanceButtonState();
  document.querySelectorAll('[data-open-job-club]').forEach(btn => btn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const clubId = Number(btn.dataset.openJobClub || 0);
    if(clubId && typeof openNewGameModal === 'function') openNewGameModal(false, { selectedClubId:clubId });
  }));
}


function homeWeekCalendarLeagueMatchday(match, round=null){
  const explicitCandidates = [
    match?.leagueMatchday,
    match?.competitionMatchday,
    match?.originalMatchday,
    round?.leagueMatchday,
    round?.competitionMatchday,
    round?.originalMatchday
  ];
  for(const candidate of explicitCandidates){
    const value = Math.round(Number(candidate || 0));
    if(value > 0) return value;
  }

  // Los partidos regulares se crean con IDs del tipo "division-j14-local-visitante".
  // El campo matchday puede convertirse después en la posición global del calendario
  // al intercalar copas, por lo que el ID conserva la fecha real de la liga.
  const idMatch = String(match?.id || '').match(/(?:^|[-_])j(\d+)(?=[-_]|$)/i);
  const idMatchday = Math.round(Number(idMatch?.[1] || 0));
  if(idMatchday > 0) return idMatchday;

  const fallback = Math.round(Number(match?.matchday || round?.matchday || 0));
  return fallback > 0 ? fallback : 0;
}
function competitionLogoInfo(match, round=null){
  const label = homeWeekCalendarCompetitionLabel(match, round);
  if(match?.libertadores) return { path:'img/competiciones/copa_libertadores.svg', alt:'Copa Libertadores', label };
  if(match?.championsLeague) return { path:'img/competiciones/champions_league.png', alt:'Champions League', label };
  if(match?.clubWorldCup) return { path:'img/competiciones/fifa_mundial_clubes.svg', alt:'Mundial de Clubes', label };
  return { path:'', alt:'', label };
}
function competitionLogoImageMarkup(match, round=null, className='competition-logo'){
  const info = competitionLogoInfo(match, round);
  if(!info.path) return '';
  return `<img class="${escapeHtml(className)}" src="${escapeHtml(info.path)}" alt="${escapeHtml(info.alt || info.label || 'Competición')}" loading="lazy">`;
}
function competitionLogoLineMarkup(match, round=null){
  const info = competitionLogoInfo(match, round);
  if(!info.path) return '';
  return `<div class="next-match-competition-line">${competitionLogoImageMarkup(match, round, 'competition-logo competition-logo-large')}<span>${escapeHtml(info.label || '')}</span></div>`;
}
function homeWeekCalendarCompetitionLabel(match, round=null){
  const divisionName = String(match?.divisionName || round?.title || 'Liga').trim() || 'Liga';
  if(match?.nationalSupercup){
    const stage = String(match.nationalCupStageLabel || 'Final').trim() || 'Final';
    return `${stage} · Supercopa`;
  }
  if(match?.nationalCup){
    const stage = String(match.nationalCupStageLabel || match.nationalCupStage || 'Copa').trim() || 'Copa';
    return `${stage} · ${divisionName || 'Copa nacional'}`;
  }
  if(match?.libertadores){
    const stage = String(match.libertadoresStageLabel || ({ groups:'Fase de grupos', r32:'16avos de final', r16:'8vos de final', qf:'4tos de final', sf:'Semifinales', final:'Final' }[String(match.libertadoresStage || '')]) || 'Copa Libertadores');
    const group = match.libertadoresGroup ? ` · Grupo ${String(match.libertadoresGroup)}` : '';
    const leg = Number(match.leg || 0) === 1 ? ' · Ida' : Number(match.leg || 0) === 2 ? ' · Vuelta' : '';
    return `${stage}${group}${leg} · Copa Libertadores`;
  }
  if(match?.championsLeague){
    const stage = String(match.championsLeagueStageLabel || ({ groups:'Fase de grupos', r32:'16avos de final', r16:'8vos de final', qf:'4tos de final', sf:'Semifinales', final:'Final' }[String(match.championsLeagueStage || '')]) || 'Champions League');
    const group = match.championsLeagueGroup ? ` · Grupo ${String(match.championsLeagueGroup)}` : '';
    const leg = Number(match.leg || 0) === 1 ? ' · Ida' : Number(match.leg || 0) === 2 ? ' · Vuelta' : '';
    return `${stage}${group}${leg} · Champions League`;
  }
  if(match?.clubWorldCup){
    const labels = {
      groups:'Fase de grupos',
      r16:'Octavos',
      qf:'Cuartos',
      sf:'Semifinales',
      thirdPlace:'3.er puesto',
      final:'Final'
    };
    const stage = labels[String(match.clubWorldCupStage || '')] || 'Mundial de Clubes';
    return stage === 'Mundial de Clubes' ? stage : `${stage} · Mundial de Clubes`;
  }
  if(match?.friendly) return 'Partido amistoso';
  if(match?.promotionPlayoff || match?.playoff){
    const stage = String(match.playoffStage || round?.playoffStage || '').trim();
    return stage ? `Playoffs · ${stage}` : 'Playoffs de promoción';
  }
  const matchday = homeWeekCalendarLeagueMatchday(match, round);
  return matchday ? `Fecha ${matchday} · ${divisionName}` : divisionName;
}
function homeWeekCalendarOutcome(match){
  const ownId = Number(game?.selectedClubId || 0);
  const isHome = Number(match?.homeId || 0) === ownId;
  const opponentId = isHome ? Number(match?.awayId || 0) : Number(match?.homeId || 0);
  const opponent = clubName(opponentId) || 'Rival por confirmar';
  const venue = isHome ? 'Local' : 'Visitante';
  if(!match?.played){
    return { tone:'scheduled', main:`vs ${opponent}`, detail:venue, opponentId };
  }
  const rawOwnGoals = Number(isHome ? match.homeGoals : match.awayGoals);
  const rawRivalGoals = Number(isHome ? match.awayGoals : match.homeGoals);
  const ownGoals = Number.isFinite(rawOwnGoals) ? rawOwnGoals : 0;
  const rivalGoals = Number.isFinite(rawRivalGoals) ? rawRivalGoals : 0;
  const penalties = match?.penaltyShootout;
  let ownPens = null;
  let rivalPens = null;
  if(penalties){
    ownPens = Number(isHome ? penalties.home : penalties.away);
    rivalPens = Number(isHome ? penalties.away : penalties.home);
  }
  const wonOnPenalties = ownGoals === rivalGoals && Number.isFinite(ownPens) && Number.isFinite(rivalPens) && ownPens > rivalPens;
  const lostOnPenalties = ownGoals === rivalGoals && Number.isFinite(ownPens) && Number.isFinite(rivalPens) && ownPens < rivalPens;
  const result = ownGoals > rivalGoals || wonOnPenalties ? 'Victoria' : ownGoals < rivalGoals || lostOnPenalties ? 'Derrota' : 'Empate';
  const tone = result === 'Victoria' ? 'win' : result === 'Derrota' ? 'loss' : 'draw';
  const penaltyText = Number.isFinite(ownPens) && Number.isFinite(rivalPens) ? ` · pen. ${ownPens}-${rivalPens}` : '';
  return { tone, main:`${result} ${ownGoals}-${rivalGoals}${penaltyText}`, detail:`vs ${opponent} · ${venue}`, opponentId };
}
function homeWeekCalendarEventsByDate(dates=[]){
  const result = new Map((Array.isArray(dates) ? dates : []).filter(validIsoDate).map(date => [date, new Map()]));
  if(!game || !result.size) return new Map();
  const ownId = Number(game.selectedClubId || 0);
  const historyById = new Map((game.matchHistory || []).map(item => [String(item?.id || ''), item]));
  (game.fixtures || []).forEach(round => {
    (round?.matches || []).forEach(match => {
      if(Number(match?.homeId || 0) !== ownId && Number(match?.awayId || 0) !== ownId) return;
      const date = typeof scheduledDateForMatch === 'function'
        ? scheduledDateForMatch(match, round)
        : (validIsoDate(match?.date) ? match.date : round?.date);
      const dateEvents = result.get(date);
      if(!dateEvents) return;
      const history = historyById.get(String(match?.id || ''));
      const key = String(match.id || `${date}-${match.homeId}-${match.awayId}`);
      dateEvents.set(key, { match:{ ...match, ...(history || {}) }, round, date });
    });
  });
  (game.matchHistory || []).forEach(match => {
    if(Number(match?.homeId || 0) !== ownId && Number(match?.awayId || 0) !== ownId) return;
    const date = validIsoDate(match?.date) ? match.date : '';
    const dateEvents = result.get(date);
    if(!dateEvents) return;
    const key = String(match.id || `${date}-${match.homeId}-${match.awayId}`);
    if(!dateEvents.has(key)) dateEvents.set(key, { match:{ ...match, played:true }, round:null, date });
  });
  return new Map([...result.entries()].map(([date, events]) => [date, [...events.values()].sort((a,b) => {
    const aPlayed = a.match?.played ? 1 : 0;
    const bPlayed = b.match?.played ? 1 : 0;
    return bPlayed - aPlayed || homeWeekCalendarCompetitionLabel(a.match, a.round).localeCompare(homeWeekCalendarCompetitionLabel(b.match, b.round), 'es', { sensitivity:'base' });
  })]));
}
function homeWeekCalendarMatchTone(match){
  if(match?.clubWorldCup || match?.internationalCup || match?.continentalCup) return 'tone-international';
  if(match?.nationalCup || match?.nationalSupercup) return 'tone-cup';
  if(match?.friendly) return 'tone-friendly';
  return 'tone-league';
}
function homeWeekCalendarSeasonYearForIso(iso){
  const currentYear = typeof currentSeasonYear === 'function'
    ? Math.round(Number(currentSeasonYear() || 0))
    : Math.round(Number(game?.seasonYear || new Date(`${iso}T00:00:00Z`).getUTCFullYear()));
  if(!validIsoDate(iso) || !currentYear || typeof seasonStartDateForYear !== 'function' || typeof seasonEndDateForYear !== 'function'){
    return new Date(`${iso}T00:00:00Z`).getUTCFullYear();
  }
  const start = seasonStartDateForYear(currentYear);
  const end = seasonEndDateForYear(currentYear);
  if(validIsoDate(start) && iso < start) return currentYear - 1;
  if(validIsoDate(end) && iso > end) return currentYear + 1;
  return currentYear;
}
function homeWeekCalendarMarketInfo(iso){
  const seasonYear = homeWeekCalendarSeasonYearForIso(iso);
  const day = typeof seasonDayFromDate === 'function' ? seasonDayFromDate(iso, seasonYear) : 1;
  const open = typeof isTransferMarketOpenDay === 'function' ? isTransferMarketOpenDay(day) : false;
  return { open, day, label:open ? 'Mercado abierto' : 'Mercado cerrado' };
}
function homeWeekCalendarTransferActivityByDate(dates=[]){
  const validDates = (Array.isArray(dates) ? dates : []).filter(validIsoDate);
  const result = new Map(validDates.map(date => [date, { incoming:new Set(), outgoing:new Set() }]));
  if(!game || !result.size) return new Map();
  const ownId = Number(game.selectedClubId || 0);
  const keyFor = (item, index=0) => String(Number(item?.playerId || 0) || item?.id || `transfer-${index}`);
  const add = (date, direction, item, index=0) => {
    const activity = result.get(date);
    if(!activity || !activity[direction]) return;
    activity[direction].add(keyFor(item, index));
  };
  (game.pendingTransfers || []).forEach((item, index) => {
    if(!item) return;
    const active = typeof isActivePendingTransfer === 'function'
      ? isActivePendingTransfer(item)
      : ['pending','pending_market','agreed_pending_market'].includes(String(item.status || 'pending'));
    const completed = ['arrived','departed'].includes(String(item.status || ''));
    if(!active && !completed) return;
    let date = active ? String(item.executeDate || '') : String(item.executedDate || '');
    if(!validIsoDate(date) && active && Number(item.executeSeason || 0) > 0 && Number(item.executeDay || 0) > 0 && typeof transferMarketDateForSeasonDay === 'function'){
      date = transferMarketDateForSeasonDay(item.executeSeason, item.executeDay);
    }
    if(!result.has(date)) return;
    const type = String(item.type || (Number(item.toClubId || 0) === ownId ? 'incoming' : 'outgoing'));
    if(type === 'incoming' && Number(item.toClubId || 0) === ownId) add(date, 'incoming', item, index);
    if(type === 'outgoing' && Number(item.fromClubId || 0) === ownId) add(date, 'outgoing', item, index);
  });
  const history = Array.isArray(game.transferHistory?.entries) ? game.transferHistory.entries : [];
  history.forEach((entry, index) => {
    const date = String(entry?.date || '');
    if(!result.has(date)) return;
    const kind = String(entry?.kind || '');
    if(Number(entry?.toClubId || 0) === ownId && ['purchase','free_signing'].includes(kind)) add(date, 'incoming', entry, index);
    if(Number(entry?.fromClubId || 0) === ownId && kind === 'sale') add(date, 'outgoing', entry, index);
  });
  return new Map([...result.entries()].map(([date, activity]) => [date, {
    incoming:activity.incoming.size,
    outgoing:activity.outgoing.size
  }]));
}
function homeWeekCalendarDayTone(events=[], transferActivity={}, marketInfo={}){
  const tones = new Set((events || []).map(event => homeWeekCalendarMatchTone(event?.match)));
  if(tones.has('tone-international')) return 'tone-international';
  if(tones.has('tone-cup')) return 'tone-cup';
  if(tones.has('tone-league')) return 'tone-league';
  if(tones.has('tone-friendly')) return 'tone-friendly';
  if(Number(transferActivity.incoming || 0) || Number(transferActivity.outgoing || 0)) return 'tone-transfer';
  return marketInfo.open ? 'tone-market-open' : 'tone-market-closed';
}
function homeWeekCalendarDayMetaMarkup(marketInfo={}, transferActivity={}){
  const incoming = Math.max(0, Math.round(Number(transferActivity.incoming || 0)));
  const outgoing = Math.max(0, Math.round(Number(transferActivity.outgoing || 0)));
  const transferLabels = [];
  if(outgoing) transferLabels.push(`<span class="home-week-calendar-transfer is-outgoing">${outgoing === 1 ? '1 jugador se marcha' : `${outgoing} jugadores se marchan`}</span>`);
  if(incoming) transferLabels.push(`<span class="home-week-calendar-transfer is-incoming">${incoming === 1 ? 'Llega 1 refuerzo' : `Llegan ${incoming} refuerzos`}</span>`);
  return `<div class="home-week-calendar-meta">
    <span class="home-week-calendar-market ${marketInfo.open ? 'is-open' : 'is-closed'}">${escapeHtml(marketInfo.label || 'Mercado cerrado')}</span>
    ${transferLabels.join('')}
  </div>`;
}
function homeWeekCalendarDayMarkup(iso, offset, events=[], transferActivity={ incoming:0, outgoing:0 }){
  const relation = offset === -1 ? 'Ayer' : offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : `En ${offset} días`;
  const marketInfo = homeWeekCalendarMarketInfo(iso);
  const classes = ['home-week-calendar-day', homeWeekCalendarDayTone(events, transferActivity, marketInfo)];
  if(offset === -1) classes.push('is-yesterday');
  if(offset === 0) classes.push('is-today');
  if(events.length) classes.push('has-match');
  if(marketInfo.open) classes.push('market-is-open');
  if(Number(transferActivity.incoming || 0) || Number(transferActivity.outgoing || 0)) classes.push('has-transfer-activity');
  const shownEvents = events.slice(0, 2);
  const eventMarkup = shownEvents.length ? shownEvents.map(({ match, round }) => {
    const outcome = homeWeekCalendarOutcome(match);
    const competition = homeWeekCalendarCompetitionLabel(match, round);
    const attrs = match.played
      ? `data-match-id="${escapeHtml(match.id)}"`
      : 'data-go-tab="fixture"';
    return `<button class="home-week-calendar-event ${escapeHtml(outcome.tone)}" type="button" ${attrs} aria-label="${escapeHtml(`${competition}. ${outcome.main}. ${outcome.detail}`)}">
      <span class="home-week-calendar-rival-badge" aria-hidden="true">${outcome.opponentId ? clubBadge(outcome.opponentId) : ''}</span>
      <span class="home-week-calendar-event-copy">
        <span class="home-week-calendar-competition-line">${competitionLogoImageMarkup(match, round, 'competition-logo competition-logo-small')}<span class="home-week-calendar-competition">${escapeHtml(competition)}</span></span>
        <strong>${escapeHtml(outcome.main)}</strong>
        <small>${escapeHtml(outcome.detail)}</small>
      </span>
    </button>`;
  }).join('') : `<div class="home-week-calendar-empty"><span>Sin partido</span><small>Sin compromiso programado</small></div>`;
  const remaining = events.length > shownEvents.length ? `<span class="home-week-calendar-more">+${events.length - shownEvents.length} partido(s)</span>` : '';
  return `<article class="${classes.join(' ')}" ${offset === 0 ? 'aria-current="date"' : ''}>
    <div class="home-week-calendar-day-head">
      <span>${escapeHtml(relation)}</span>
      ${events.length ? `<b aria-hidden="true">⚽${events.length > 1 ? ` ${events.length}` : ''}</b>` : '<b class="no-match" aria-hidden="true">·</b>'}
    </div>
    <strong class="home-week-calendar-weekday">${escapeHtml(weekdayLabelFromIso(iso))}</strong>
    <time datetime="${escapeHtml(iso)}">Fecha: ${escapeHtml(iso)}</time>
    ${homeWeekCalendarDayMetaMarkup(marketInfo, transferActivity)}
    <div class="home-week-calendar-events">${eventMarkup}${remaining}</div>
  </article>`;
}
function homeWeekCalendarMarkup(){
  if(!game || typeof currentCalendarDate !== 'function') return '';
  const today = currentCalendarDate();
  if(!validIsoDate(today)) return '';
  const dateEntries = [];
  for(let offset=-1; offset<=5; offset++) dateEntries.push({ iso:addDaysToIsoDate(today, offset), offset });
  const dates = dateEntries.map(item => item.iso);
  const eventsByDate = homeWeekCalendarEventsByDate(dates);
  const transfersByDate = homeWeekCalendarTransferActivityByDate(dates);
  const days = dateEntries.map(item => homeWeekCalendarDayMarkup(
    item.iso,
    item.offset,
    eventsByDate.get(item.iso) || [],
    transfersByDate.get(item.iso) || { incoming:0, outgoing:0 }
  ));
  return `<section class="card home-week-calendar" aria-label="Calendario semanal de siete días">
    <div class="home-week-calendar-grid">${days.join('')}</div>
  </section>`;
}

function renderHome(){
  if(Number(game?.budget || 0) < 0 && typeof dismissAllStaffForFinancialCrisis === 'function') dismissAllStaffForFinancialCrisis({ silent:true });
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
  const homeHtml = `
    ${homeWeekCalendarMarkup()}
    ${homeInboxButtonMarkup()}
    ${seasonBox}
    ${turnModePanelMarkup()}
    ${typeof managerChallengeHomeMarkup === 'function' ? managerChallengeHomeMarkup() : ''}
    ${managerOfficeMarkup({ next, position, clubPlayers, avgOverall, avgFitness, avgMorale, cohesion, deltaClass, deltaText })}
    <div class="home-alerts-block">${visualAlertsMarkup()}</div>
    ${problemBox}
    <div id="homeOnlineRankingBox">${typeof challengeHomeOnlineRankingMarkup === 'function' ? challengeHomeOnlineRankingMarkup() : ''}</div>
    <div id="homeDiscordCommunityBox">${typeof discordCommunityHomeMarkup === 'function' ? discordCommunityHomeMarkup() : ''}</div>
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
      <div class="card compact-standings-card">
        <div class="row"><h3>Tabla cercana</h3><span class="pill">Tu zona</span></div>
        ${compactHomeStandingsMarkup()}
      </div>
      <div class="card">
        <h3>Últimos partidos</h3>
        <div class="timeline">${lastMatches.length ? lastMatches.map(compactMatch).join('') : '<p class="muted">Aún no hay partidos jugados.</p>'}</div>
      </div>
    </div>
    ${lastTurnSummaryMarkup()}

  `;
  if(typeof replaceHtmlPreservingClubBadges === 'function') replaceHtmlPreservingClubBadges(view, homeHtml);
  else view.innerHTML = homeHtml;
  $('advanceUnifiedBtn')?.addEventListener('click', typeof requestAdvanceCalendarOneStep === 'function' ? requestAdvanceCalendarOneStep : advanceCalendarOneStep);
  $('advanceAutoClickerBtn')?.addEventListener('click', () => { if(typeof toggleAdvanceAutoClicker === 'function') toggleAdvanceAutoClicker(); });
  document.querySelector('[data-go-tactics]')?.addEventListener('click',()=>{ activeTab='tactics'; renderAll(); });
  document.querySelector('[data-continue-season]')?.addEventListener('click',()=>startNextSeason(game.selectedClubId));
  document.querySelectorAll('.featured-player-card[data-player-id]').forEach(card => card.addEventListener('click',()=>showPlayerModal(Number(card.dataset.playerId))));
  document.querySelectorAll('[data-go-tab]').forEach(btn => btn.addEventListener('click',()=>{
    const tab = btn.dataset.goTab;
    const mode = btn.dataset.goMode || '';
    if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation(tab, mode);
    else if(tab === 'stadium' && mode) stadiumViewMode = mode;
    activeTab = tab;
    renderAll();
  }));
  $('friendlyOpponentSelect')?.addEventListener('change', (event)=>{ game.pendingFriendlyOpponentId = Number(event.target.value || 0); saveLocal(true); renderHome(); });
  $('btnClearFriendly')?.addEventListener('click', ()=>{ game.pendingFriendlyOpponentId = 0; saveLocal(true); renderHome(); });
  if(typeof bindStaffDismissButtons === 'function') bindStaffDismissButtons(renderHome);
  if(typeof challengeRefreshHomeOnlineSummary === 'function') challengeRefreshHomeOnlineSummary();
  if(typeof discordCommunityHydrateHome === 'function') discordCommunityHydrateHome();
  updateAdvanceButtonState();
  startDailySkillPointsAnimation();
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
    text = 'Avanzar día';
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
  if(typeof updateAdvanceAutoClickerButton === 'function') updateAdvanceAutoClickerButton();
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
    ${competitionLogoLineMarkup(match)}
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

function compactHomeStandingsMarkup(){
  const club = seed.clubs.find(c => Number(c.id) === Number(game.selectedClubId));
  const table = sortedStandings(club?.divisionId || null);
  if(!Array.isArray(table) || !table.length) return '<p class="muted">La tabla todavía no está disponible.</p>';
  const ownIndex = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId));
  if(ownIndex < 0) return '<p class="muted">Tu club aún no aparece en la tabla.</p>';
  const windowSize = Math.min(3, table.length);
  const start = Math.max(0, Math.min(ownIndex - 1, table.length - windowSize));
  const rows = table.slice(start, start + windowSize);
  return `<div class="compact-standings-list">${rows.map((row, index) => {
    const pos = start + index + 1;
    const own = Number(row.clubId) === Number(game.selectedClubId);
    const dg = Number(row.dg || 0);
    return `<button class="stat-rank clickable plain compact-standing-row ${own ? 'own-club-row' : ''}" data-club-id="${escapeHtml(row.clubId)}"><span><span class="rank-num">${pos}°</span>${clubBadge(row.clubId)} ${escapeHtml(clubName(row.clubId))}</span><strong>${Number(row.pts || 0)} pts <span class="muted small">DG ${dg >= 0 ? '+' : ''}${dg}</span></strong></button>`;
  }).join('')}</div>`;
}


function unreadMessagesCount(){
  return (game?.messages || []).filter(m => !m.read).length;
}
function unreadAssistantMessagesCount(){
  return (game?.messages || []).filter(m => !m.read && String(m.type || '').toLowerCase() === 'asistente').length;
}
function homeInboxButtonMarkup(){
  const unread = unreadMessagesCount();
  const total = Array.isArray(game?.messages) ? game.messages.length : 0;
  const label = unread
    ? `Abrir bandeja: ${unread} mensaje${unread === 1 ? '' : 's'} sin leer`
    : `Abrir bandeja de mensajes${total ? `: ${total} en total` : ''}`;
  return `<div class="home-inbox-row">
    <button type="button" class="home-inbox-button ${unread ? 'has-unread' : ''}" data-open-messages aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}">
      <span class="home-inbox-envelope" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false"><path d="M3.75 6.75h16.5v10.5H3.75z"></path><path d="m4.5 7.5 7.5 5.25 7.5-5.25"></path></svg>
      </span>
      ${unread ? `<strong class="home-inbox-count">${unread > 99 ? '99+' : unread}</strong>` : '<span class="home-inbox-empty-dot" aria-hidden="true"></span>'}
    </button>
  </div>`;
}
function assistantMessagesEnabled(){
  return !game || game.assistantMessagesEnabled !== false;
}
function assistantMessagesButtonLabel(){
  return assistantMessagesEnabled() ? 'Recibir mensajes de tu ayudante' : 'No recibir mensajes del ayudante';
}
function updateAssistantMessagesToggle(){
  const btn = document.getElementById('btnAssistantMessagesToggle');
  if(!btn) return;
  btn.textContent = assistantMessagesButtonLabel();
  btn.disabled = !game;
}
const MESSAGE_INBOX_POLICY_VERSION = 946;
const MESSAGE_INBOX_MAX_READ_CLOSED = 80;
const MESSAGE_INBOX_IMPORTANT_TITLE_PATTERNS = [
  /alta m[eé]dica|parte m[eé]dico|lesionad|lesi[oó]n/i,
  /contratos? finalizados?|plantel insuficiente|plantel incompleto/i,
  /n[uú]meros rojos|sanci[oó]n|bancarrota|despido|continuidad est[aá] en riesgo/i,
  /nuevas ofertas de sponsors|sponsor especial perdido/i,
  /oferta laboral|oferta para dirigir|solicitud aceptada|solicitud rechazada|retir[oó] su propuesta/i,
  /informe de captaci[oó]n recibido|b[uú]squeda completada/i,
  /obra finalizada|campa[nñ]a de socios finalizada|predio juvenil nivel|replante obligatorio finalizado|calefacci[oó]n de c[eé]sped finalizada|deterioro anual del estadio|deterioro por edad aplicado/i,
  /oferta por juvenil|juveniles dejaron la academia|juveniles? excepcionales? incorporados?|retiros al finalizar la temporada/i,
  /ranking no enviado|ranking pendiente|actualizaci[oó]n de carrera pendiente/i,
  /objetivo cumplido: contrato negociable|acuerdo para la pr[oó]xima temporada|presupuesto de fichajes liberado/i,
  /cupo de bonus disponible/i,
  /derecho econ[oó]mico registrado|cobro por jugador formado|transferencia de un jugador de tu cartera/i
];
const MESSAGE_INBOX_ATTENTION_BODY_PATTERN = /ten[eé]s?\s+\d+\s+d[ií]as|requiere(?:n)?\s+(?:tu\s+)?respuesta|aceptar\s+o\s+rechazar|eleg[ií]\s+una\s+opci[oó]n|revisi[oó]n obligatoria/i;
function messageActionRequiresAttention(message){
  const action = message?.action;
  if(!action || typeof action !== 'object') return false;
  const status = String(action.status || '').toLowerCase();
  const type = String(action.type || '').toLowerCase();
  if(['openmanagerachievements','openemployees'].includes(type)) return true;
  if(['pending','agreed_pending_market','auto_agreed_pending_market','forced_sale_pending_market'].includes(status)) return true;
  if(['transferoffer','lockerroomdecision','managercareerdecision'].includes(type) && !status) return true;
  return false;
}
function messageShouldEnterInbox(message, options={}){
  if(!message || typeof message !== 'object') return false;
  const explicit = message.inbox;
  if(explicit === false || explicit === 'never') return false;
  if(explicit === true || explicit === 'always') return true;
  if(String(message.priority || 'normal').toLowerCase() === 'high') return true;
  if(messageActionRequiresAttention(message)) return true;
  const type = String(message.type || 'info').toLowerCase();
  if(['warning','reto','fundador','vestuario','medico'].includes(type)) return true;
  if(type === 'asistente') return options?.targetGame?.assistantMessagesEnabled !== false;
  const title = String(message.title || '');
  const body = String(message.body || '');
  if(MESSAGE_INBOX_IMPORTANT_TITLE_PATTERNS.some(pattern => pattern.test(title))) return true;
  if(MESSAGE_INBOX_ATTENTION_BODY_PATTERN.test(body)) return true;
  return false;
}
function compactMessageInboxForState(targetGame, options={}){
  if(!targetGame || typeof targetGame !== 'object') return { changed:false, removed:0, trimmed:0 };
  const source = Array.isArray(targetGame.messages) ? targetGame.messages : [];
  const seenIds = new Set();
  let removed = 0;
  let trimmed = 0;
  let readClosedKept = 0;
  const kept = [];
  source.forEach(message => {
    const id = String(message?.id || '');
    if(id && seenIds.has(id)){ removed += 1; return; }
    if(id) seenIds.add(id);
    if(!messageShouldEnterInbox(message, { existing:true, targetGame })){ removed += 1; return; }
    const pending = messageActionRequiresAttention(message);
    if(message?.read && !pending){
      if(readClosedKept >= MESSAGE_INBOX_MAX_READ_CLOSED){ trimmed += 1; return; }
      readClosedKept += 1;
    }
    kept.push(message);
  });
  const previousVersion = Number(targetGame.messageInboxPolicyVersion || 0);
  const changed = kept.length !== source.length || previousVersion !== MESSAGE_INBOX_POLICY_VERSION;
  targetGame.messages = kept;
  targetGame.messageInboxPolicyVersion = MESSAGE_INBOX_POLICY_VERSION;
  targetGame.messageInboxStats = targetGame.messageInboxStats && typeof targetGame.messageInboxStats === 'object' && !Array.isArray(targetGame.messageInboxStats) ? targetGame.messageInboxStats : {};
  if(removed || trimmed){
    targetGame.messageInboxStats.compacted = Math.max(0, Number(targetGame.messageInboxStats.compacted || 0)) + removed + trimmed;
    targetGame.messageInboxStats.lastCompactionAt = Date.now();
  }
  return { changed, removed, trimmed };
}
function noteSuppressedInboxMessage(targetGame, message){
  if(!targetGame) return;
  targetGame.messageInboxStats = targetGame.messageInboxStats && typeof targetGame.messageInboxStats === 'object' && !Array.isArray(targetGame.messageInboxStats) ? targetGame.messageInboxStats : {};
  targetGame.messageInboxStats.suppressed = Math.max(0, Number(targetGame.messageInboxStats.suppressed || 0)) + 1;
  targetGame.messageInboxStats.lastSuppressedType = String(message?.type || 'info');
}
function pushGameMessage(message){
  if(!game) return null;
  game.messages = Array.isArray(game.messages) ? game.messages : [];
  if(!messageShouldEnterInbox(message, { targetGame:game })){
    noteSuppressedInboxMessage(game, message);
    return null;
  }
  const id = message.id || `msg-${Date.now()}-${hashNumber(`${message.title || ''}-${game.messages.length}-${Math.random()}`, 1000000)}`;
  const duplicate = game.messages.find(item => String(item?.id || '') === String(id));
  if(duplicate) return duplicate;
  const item = {
    id,
    turn: game.matchdayIndex || 0,
    season: game.seasonNumber || 1,
    date: game.currentDate || '',
    read: false,
    priority: message.priority || 'normal',
    type: message.type || 'info',
    title: message.title || 'Mensaje',
    body: message.body || '',
    action: message.action || null,
    inbox: message.inbox === true || message.inbox === 'always' ? 'always' : null,
    playerIds: Array.isArray(message.playerIds) ? [...new Set(message.playerIds.map(Number).filter(Number.isFinite))] : [],
    playerNames: Array.isArray(message.playerNames) ? message.playerNames.map(name => String(name || '')).filter(Boolean) : [],
    createdAt: Date.now()
  };
  game.messages.unshift(item);
  compactMessageInboxForState(game);
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
  if(cfg.activo === false || game.assistantMessagesEnabled === false) return null;
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
  if(!game?.messages) return 0;
  let changed = 0;
  game.messages.forEach(m => {
    if(!m.read){ m.read = true; changed += 1; }
  });
  return changed;
}
function markAllMessagesRead(){
  const changed = markMessagesRead();
  if(!changed){ showNotice('No hay mensajes pendientes de lectura.'); return; }
  compactMessageInboxForState(game);
  saveLocal(true);
  renderMessages();
  showNotice(`${changed} mensaje${changed === 1 ? '' : 's'} marcado${changed === 1 ? '' : 's'} como leído${changed === 1 ? '' : 's'}.`);
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
  const latest = items[0];
  const assistantClass = String(latest.type || '').toLowerCase() === 'asistente' ? ' assistant-message-summary' : '';
  const assistantUnread = unreadAssistantMessagesCount();
  const badge = assistantUnread ? `<span class="pill danger">${assistantUnread} mensaje asistente</span>` : (count ? `<span class="pill warn">${count} nuevo(s)</span>` : '<span class="pill">Ver mensajes</span>');
  const openAttribute = latest.action?.type === 'openManagerAchievements'
    ? 'data-open-manager-achievements'
    : (latest.action?.type === 'openEmployees' ? 'data-open-employees' : 'data-open-messages');
  return `<div class="home-messages-summary clickable${assistantClass}" ${openAttribute}>
    <div class="row"><div><p class="label">Mensajes / eventos</p><h2>${escapeHtml(latest.title)}</h2></div>${badge}</div>
    <p class="tagline">${escapeHtml(latest.body)}</p>
  </div>`;
}
function openManagerAchievementsFromMessage(){
  if(!game) return false;
  if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('mystats', 'achievements');
  else managerStatsViewMode = 'achievements';
  activeTab = 'mystats';
  renderAll();
  return true;
}
function openEmployeesFromMessage(){
  if(!game) return false;
  activeTab = 'employees';
  if(typeof prepareSidebarNavigation === 'function') prepareSidebarNavigation('employees');
  renderAll();
  return true;
}
function activeTransferMessageStatuses(){
  return new Set(['pending','agreed_pending_market','auto_agreed_pending_market','forced_sale_pending_market']);
}
function transferMessagePendingEntry(message){
  const action = message?.action;
  if(action?.type !== 'transferOffer') return null;
  const pending = Array.isArray(game?.pendingTransfers) ? game.pendingTransfers : [];
  return pending.find(item => {
    if(typeof isActivePendingTransfer === 'function' && !isActivePendingTransfer(item)) return false;
    if(String(action.transferPendingId || '') && String(item.id || '') === String(action.transferPendingId)) return true;
    if(String(item.messageId || '') && String(item.messageId || '') === String(message.id || '')) return true;
    return Number(item.playerId || 0) > 0 && Number(item.playerId || 0) === Number(action.playerId || 0) && String(item.type || '') === 'outgoing';
  }) || null;
}
function transferMessageSchedulePassed(action){
  const executeSeason = Math.max(0, Math.round(Number(action?.executeSeason || 0)));
  const executeDay = Math.max(0, Math.round(Number(action?.executeDay || 0)));
  if(!executeSeason || !executeDay) return false;
  const currentSeason = Math.max(1, Math.round(Number(game?.seasonNumber || 1)));
  const currentDay = typeof transferMarketSeasonDayForState === 'function'
    ? Math.max(1, Math.round(Number(transferMarketSeasonDayForState(game) || 1)))
    : Math.max(1, ((Number(game?.matchdayIndex || 0) * Number(DAYS_PER_ADVANCE || 1)) + 1));
  return currentSeason > executeSeason || (currentSeason === executeSeason && currentDay > executeDay);
}
function closeTransferMessageAction(message, status, suffix=''){
  const action = message?.action;
  if(action?.type !== 'transferOffer') return false;
  if(String(action.status || '') === String(status || '')) return false;
  action.status = String(status || 'closed_stale_transfer');
  action.closedSeason = Number(game?.seasonNumber || 1);
  action.closedDay = typeof transferMarketSeasonDayForState === 'function' ? transferMarketSeasonDayForState(game) : 0;
  action.closedDate = game?.currentDate || '';
  if(suffix && !action.closedResolutionAdded){
    message.body = `${String(message.body || '').trim()} ${suffix}`.trim();
    action.closedResolutionAdded = true;
  }
  return true;
}
function reconcileTransferOfferMessageState(message){
  const action = message?.action;
  if(action?.type !== 'transferOffer') return false;
  const status = String(action.status || '');
  if(!activeTransferMessageStatuses().has(status)) return false;
  const ownerClubId = Number(action.ownerClubId || 0);
  const selectedClubId = Number(game?.selectedClubId || 0);
  const player = typeof playerById === 'function' ? playerById(Number(action.playerId || 0)) : null;
  if(ownerClubId && selectedClubId && ownerClubId !== selectedClubId){
    return closeTransferMessageAction(message, 'cancelled_club_change', 'La operación quedó cerrada cuando el manager dejó el club que había recibido la oferta.');
  }
  if(status === 'pending'){
    if(!player || (selectedClubId && Number(player.clubId || 0) !== selectedClubId)){
      return closeTransferMessageAction(message, 'expired_player_unavailable', 'La oferta quedó cerrada porque el jugador ya no pertenece al club.');
    }
    return false;
  }
  const pendingEntry = transferMessagePendingEntry(message);
  if(pendingEntry) return false;
  if(!player || (ownerClubId && Number(player.clubId || 0) !== ownerClubId) || (!ownerClubId && selectedClubId && Number(player.clubId || 0) !== selectedClubId)){
    return closeTransferMessageAction(message, 'expired_player_unavailable', 'La operación ya no está pendiente porque el jugador dejó de pertenecer al club vendedor.');
  }
  if(transferMessageSchedulePassed(action) || !pendingEntry){
    return closeTransferMessageAction(message, 'closed_stale_transfer', 'La operación dejó de estar pendiente y el mensaje quedó archivado.');
  }
  return false;
}
function reconcileTransferOfferMessages(){
  let changed = 0;
  (game?.messages || []).forEach(message => { if(reconcileTransferOfferMessageState(message)) changed += 1; });
  return changed;
}
function closeTransferOfferMessagesForClubExit(outgoingClubId=0){
  if(!game) return 0;
  let changed = 0;
  const clubId = Number(outgoingClubId || 0);
  (game.messages || []).forEach(message => {
    const action = message?.action;
    if(action?.type !== 'transferOffer' || !activeTransferMessageStatuses().has(String(action.status || ''))) return;
    const ownerClubId = Number(action.ownerClubId || clubId || game.selectedClubId || 0);
    if(clubId && ownerClubId && ownerClubId !== clubId) return;
    if(closeTransferMessageAction(message, 'cancelled_club_change', 'La operación quedó cerrada cuando el manager dejó el club que había recibido la oferta.')) changed += 1;
  });
  return changed;
}
function messageHasPendingAction(message){
  reconcileTransferOfferMessageState(message);
  const status = String(message?.action?.status || '');
  if(message?.action?.type === 'lockerRoomDecision' && String(message.action.promiseStatus || '') === 'pending') return true;
  return Boolean(message?.action && activeTransferMessageStatuses().has(status));
}
function deletableOldMessages(){
  return (game?.messages || []).filter(message => Boolean(message?.read) && !messageHasPendingAction(message));
}
function deleteOldMessages(){
  if(!game) return;
  const deletable = deletableOldMessages();
  if(!deletable.length){ showNotice('No hay mensajes leídos y cerrados para borrar.'); return; }
  const deletableIds = new Set(deletable.map(message => String(message?.id || '')));
  const ok = window.confirm(`Se borrarán ${deletable.length} mensaje(s) leídos. Las ofertas y decisiones pendientes se conservarán. ¿Continuar?`);
  if(!ok) return;
  game.messages = (game.messages || []).filter(message => !deletableIds.has(String(message?.id || '')));
  saveLocal(true);
  renderMessages();
  showNotice(`${deletable.length} mensaje${deletable.length === 1 ? '' : 's'} leído${deletable.length === 1 ? '' : 's'} eliminado${deletable.length === 1 ? '' : 's'}.`);
}
function messageSortTimestamp(message){
  const created = Number(message?.createdAt || 0);
  if(Number.isFinite(created) && created > 0) return created;
  const season = Math.max(1, Number(message?.season || 1));
  const turn = Math.max(0, Number(message?.turn || 0));
  return (season * 1000000) + turn;
}
function orderedInboxMessages(){
  return [...(Array.isArray(game?.messages) ? game.messages : [])].sort((a,b) => {
    const unreadOrder = Number(Boolean(a?.read)) - Number(Boolean(b?.read));
    if(unreadOrder) return unreadOrder;
    return messageSortTimestamp(b) - messageSortTimestamp(a);
  });
}
function markMessageReadById(messageId){
  const message = (game?.messages || []).find(item => String(item?.id || '') === String(messageId || ''));
  if(!message || message.read) return false;
  message.read = true;
  saveLocal(true);
  renderMessages();
  return true;
}
function renderMessages(){
  compactMessageInboxForState(game);
  if(typeof ensurePendingSpecialClauseAutoAcceptanceMetadata === 'function') ensurePendingSpecialClauseAutoAcceptanceMetadata();
  const reconciledTransfers = reconcileTransferOfferMessages();
  if(reconciledTransfers > 0 && typeof saveLocal === 'function') saveLocal(true);
  const messages = orderedInboxMessages();
  const unread = messages.filter(m => !m.read).length;
  const pendingOffers = messages.filter(m => m.action?.type === 'transferOffer' && m.action.status === 'pending').length;
  const highPriority = messages.filter(m => m.priority === 'high').length;
  const unreadMessages = messages.filter(m => !m.read);
  const readMessages = messages.filter(m => m.read);
  const unreadRows = unreadMessages.map(m => messageCard(m)).join('');
  const readRows = readMessages.map(m => messageCard(m)).join('');
  const rows = messages.length ? `${unreadRows ? `<section class="message-inbox-section message-inbox-unread"><div class="message-inbox-section-head"><strong>Pendientes de lectura</strong><span>${unreadMessages.length}</span></div>${unreadRows}</section>` : ''}${readRows ? `<section class="message-inbox-section message-inbox-read"><div class="message-inbox-section-head"><strong>Leídos</strong><span>${readMessages.length}</span></div>${readRows}</section>` : ''}` : '';
  const deletableCount = deletableOldMessages().length;
  view.innerHTML = `
    <div class="row section-title compact-section-title messages-section-title"><div><h2>Mensajes</h2><p class="tagline">La bandeja conserva decisiones, alertas y cambios relevantes. Los avisos rutinarios se resumen durante el avance y no generan mensajes.</p></div><div class="row messages-bulk-actions"><button type="button" id="btnMarkAllMessagesRead" class="ghost" ${unread ? '' : 'disabled'}>Marcar todos como leídos${unread ? ` (${unread})` : ''}</button><button type="button" id="btnDeleteOldMessages" class="ghost" ${deletableCount ? '' : 'disabled'}>Borrar leídos${deletableCount ? ` (${deletableCount})` : ''}</button></div></div>
    <div class="messages-shell">
      <div class="messages-toolbar card">
        <div class="messages-toolbar-item"><p class="label">Bandeja</p><strong>${messages.length}</strong><span>Total</span></div>
        <div class="messages-toolbar-item"><p class="label">Nuevos</p><strong>${unread}</strong><span>Sin leer</span></div>
        <div class="messages-toolbar-item"><p class="label">Ofertas</p><strong>${pendingOffers}</strong><span>Pendientes</span></div>
        <div class="messages-toolbar-item"><p class="label">Importantes</p><strong>${highPriority}</strong><span>Prioridad alta</span></div>
      </div>
      <div class="message-list">${rows || '<div class="card message-empty-card"><p class="muted">No hay mensajes todavía.</p></div>'}</div>
    </div>`;
  document.querySelector('#btnMarkAllMessagesRead')?.addEventListener('click', markAllMessagesRead);
  document.querySelector('#btnDeleteOldMessages')?.addEventListener('click', deleteOldMessages);
  document.querySelectorAll('[data-mark-message-read]').forEach(btn => btn.addEventListener('click', () => markMessageReadById(btn.dataset.markMessageRead)));
  if(!(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active))){
    document.querySelectorAll('[data-accept-offer]').forEach(btn => btn.addEventListener('click', () => acceptTransferOffer(btn.dataset.acceptOffer)));
    document.querySelectorAll('[data-convince-player]').forEach(btn => btn.addEventListener('click', () => convinceSpecialClausePlayer(btn.dataset.convincePlayer)));
    document.querySelectorAll('[data-reject-offer]').forEach(btn => btn.addEventListener('click', () => rejectTransferOffer(btn.dataset.rejectOffer)));
    document.querySelectorAll('[data-locker-room-choice]').forEach(btn => btn.addEventListener('click', () => {
      if(typeof respondLockerRoomDecision === 'function') respondLockerRoomDecision(btn.dataset.lockerRoomMessage, btn.dataset.lockerRoomChoice);
    }));
  }
  saveLocal(true);
}
function messageIcon(type){
  const map = { transferOffer:'💰', evento:'⚽', finance:'💵', finanzas:'💵', staff:'🧑‍💼', empleados:'🩺', warning:'⚠️', info:'✉️', noticia:'📰', directiva:'🏛️', federación:'🏛️', federacion:'🏛️', asistente:'🎧', vestuario:'🗣️', system:'⚙️', sistema:'⚙️' };
  return map[String(type || '').trim()] || '✉️';
}
function messageToneClass(type, priority){
  if(priority === 'high') return 'message-tone-high';
  const key = String(type || '').toLowerCase();
  if(['transferoffer','finance','finanzas'].includes(key)) return 'message-tone-money';
  if(['evento','noticia'].includes(key)) return 'message-tone-sport';
  if(['warning'].includes(key)) return 'message-tone-alert';
  if(['staff','empleados','directiva','federación','federacion'].includes(key)) return 'message-tone-board';
  if(['vestuario'].includes(key)) return 'message-tone-locker-room';
  if(['asistente'].includes(key)) return 'message-tone-assistant';
  return 'message-tone-info';
}
function messageTypeLabel(type){
  const raw = String(type || 'info').trim();
  if(!raw) return 'Info';
  const key=raw.toLowerCase();
  const labels={ system:'Sistema', sistema:'Sistema', federacion:'Federación', 'federación':'Federación', empleados:'Empleados', finanzas:'Finanzas' };
  return labels[key] || raw.charAt(0).toUpperCase() + raw.slice(1);
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
function messageRelatedPlayers(message){
  const ids = [];
  const transferPlayer = messageTransferPlayer(message);
  if(transferPlayer?.id) ids.push(Number(transferPlayer.id));
  if(Array.isArray(message?.playerIds)) ids.push(...message.playerIds.map(Number));
  if(Array.isArray(message?.action?.participantIds)) ids.push(...message.action.participantIds.map(Number));
  if(Number.isFinite(Number(message?.action?.playerId))) ids.push(Number(message.action.playerId));
  const eventEntry = (game?.eventLog || []).find(entry => String(entry?.occurrenceId || entry?.details?.messageId || '') === String(message?.id || ''));
  if(Array.isArray(eventEntry?.details?.participantIds)) ids.push(...eventEntry.details.participantIds.map(Number));
  const unique = [...new Set(ids.filter(Number.isFinite))];
  return unique.map(id => playerById(id)).filter(Boolean);
}
function messageLinkedPlayerText(text='', players=[]){
  let html = escapeHtml(text || '');
  const ordered = [...players]
    .filter(player => player?.name)
    .sort((a,b) => String(b.name).length - String(a.name).length || Number(a.id) - Number(b.id));
  const replacedNames = new Set();
  ordered.forEach(player => {
    const safeName = escapeHtml(player.name);
    if(!safeName || replacedNames.has(safeName)) return;
    replacedNames.add(safeName);
    if(html.includes(safeName)) html = html.split(safeName).join(messagePlayerLink(player, player.name));
  });
  return html;
}
function messageRelatedPlayersMarkup(message){
  if(message?.action?.type !== 'lockerRoomDecision' && String(message?.type || '').toLowerCase() !== 'vestuario') return '';
  const players = messageRelatedPlayers(message);
  if(!players.length) return '';
  return `<div class="message-event-player-list"><span>Jugadores implicados</span>${players.map(player => messagePlayerLink(player, player.name)).join('')}</div>`;
}
function messageTitleHtml(m){
  const player = messageTransferPlayer(m);
  if(player) return `Oferta por ${messagePlayerLink(player, playerLastName(player.name))}`;
  return messageLinkedPlayerText(m.title, messageRelatedPlayers(m));
}
function messageBodyHtml(m){
  const player = messageTransferPlayer(m);
  const relatedPlayers = messageRelatedPlayers(m);
  const linkedBody = messageLinkedPlayerText(m.body || '', relatedPlayers);
  if(!player?.name) return linkedBody;
  if(linkedBody.includes('data-player-id=')) return linkedBody;
  return `${linkedBody} <span class="message-player-inline">Jugador: ${messagePlayerLink(player, player.name)}</span>`;
}
function transferOfferStatusLabel(status){
  const map = {
    accepted:'Aceptada',
    rejected:'Rechazada',
    blocked_by_board:'Bloqueada por directiva',
    auto_rejected_intransferible:'Rechazada: intransferible',
    convinced:'Jugador convencido',
    forced_sale:'Venta ejecutada',
    auto_accepted_no_response:'Aceptada automáticamente: sin respuesta',
    agreed_pending_market:'Transferencia acordada: espera mercado',
    auto_agreed_pending_market:'Cláusula aceptada: espera mercado',
    forced_sale_pending_market:'Salida decidida: espera mercado',
    cancelled_club_change:'Cerrada: cambiaste de club',
    expired_player_unavailable:'Cerrada: jugador no disponible',
    closed_stale_transfer:'Cerrada: operación archivada'
  };
  return map[status] || String(status || 'Cerrada');
}
function lockerRoomDecisionActionMarkup(message){
  const action = message?.action;
  if(action?.type !== 'lockerRoomDecision') return '';
  const players = messageRelatedPlayers(message);
  const linked = text => messageLinkedPlayerText(text || '', players);
  if(action.status === 'pending'){
    const options = Array.isArray(action.options) ? action.options : [];
    return `<div class="locker-room-decision-panel">
      <p class="locker-room-decision-prompt">${linked(action.prompt || '¿Cómo respondés?')}</p>
      <div class="row message-actions locker-room-choice-list">${options.map((option, index) => `<button type="button" class="${index === 0 ? 'primary' : 'ghost'}" data-locker-room-message="${escapeHtml(message.id)}" data-locker-room-choice="${escapeHtml(option.id)}">${escapeHtml(option.text)}</button>`).join('')}</div>
    </div>`;
  }
  const selected = action.selectedOptionText ? `<span class="pill message-status-pill">Decisión: ${linked(action.selectedOptionText)}</span>` : '<span class="pill message-status-pill">Respondido</span>';
  const promiseStatus = String(action.promiseStatus || '');
  const promise = promiseStatus === 'pending'
    ? '<span class="pill warn message-status-pill">Promesa pendiente</span>'
    : (action.promiseResult ? `<div class="locker-room-promise-result ${promiseStatus === 'failed' ? 'is-failed' : 'is-fulfilled'}"><strong>${promiseStatus === 'failed' ? 'Promesa incumplida' : 'Promesa cumplida'}</strong><p>${linked(action.promiseResult)}</p></div>` : '');
  const result = action.resultText ? `<div class="locker-room-decision-result"><strong>Consecuencia</strong><p>${linked(action.resultText)}</p></div>` : '';
  const effectItems = typeof lockerRoomEffectSummaryItems === 'function' ? lockerRoomEffectSummaryItems(action.appliedEffects || [], action) : [];
  const effects = effectItems.length ? `<div class="locker-room-effect-summary"><strong>Efectos en el equipo</strong><ul>${effectItems.map(item => `<li class="is-${escapeHtml(item.tone || 'neutral')}">${linked(item.text || '')}</li>`).join('')}</ul></div>` : '';
  return `<div class="locker-room-decision-closed"><div class="row locker-room-decision-statuses">${selected}${promiseStatus === 'pending' ? promise : ''}</div>${result}${effects}${promiseStatus !== 'pending' ? promise : ''}</div>`;
}
function managerAchievementsMessageActionMarkup(message){
  if(message?.action?.type !== 'openManagerAchievements') return '';
  const label = String(message.action.label || 'Ver hitos').trim() || 'Ver hitos';
  return `<div class="row message-actions"><button type="button" class="primary" data-open-manager-achievements>${escapeHtml(label)}</button></div>`;
}
function employeesMessageActionMarkup(message){
  if(message?.action?.type !== 'openEmployees') return '';
  const label = String(message.action.label || 'Ir a Empleados').trim() || 'Ir a Empleados';
  return `<div class="row message-actions"><button type="button" class="primary" data-open-employees>${escapeHtml(label)}</button></div>`;
}
function messageCard(m){
  const isSpecialClauseOffer = m.action?.type === 'transferOffer' && transferOfferReachesFullClause(m);
  const isWithoutClub = typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active);
  const action = m.action?.type === 'lockerRoomDecision'
    ? lockerRoomDecisionActionMarkup(m)
    : (m.action?.type === 'openManagerAchievements'
      ? managerAchievementsMessageActionMarkup(m)
      : (m.action?.type === 'openEmployees'
        ? employeesMessageActionMarkup(m)
        : (m.action?.type === 'transferOffer' && m.action.status === 'pending'
      ? (isWithoutClub
        ? '<span class="pill message-status-pill">Acción bloqueada: manager sin club</span>'
        : `<div class="row message-actions"><button class="primary" data-accept-offer="${escapeHtml(m.id)}">Aceptar oferta</button>${isSpecialClauseOffer ? `<button class="ghost" data-convince-player="${escapeHtml(m.id)}">Convencer al jugador de quedarse</button>` : `<button class="ghost" data-reject-offer="${escapeHtml(m.id)}">Rechazar</button>`}</div>`)
      : (m.action?.status ? `<span class="pill message-status-pill">${escapeHtml(transferOfferStatusLabel(m.action.status))}</span>` : ''))));
  const toneClass = messageToneClass(m.type, m.priority);
  const isAssistant = String(m.type || '').toLowerCase() === 'asistente';
  const unreadMark = m.read ? '' : '<span class="message-unread-dot" title="Mensaje nuevo"></span>';
  const assistantBadge = isAssistant && !m.read ? '<span class="assistant-message-badge">Tenés 1 mensaje</span>' : '';
  const readAction = m.read ? '' : `<div class="row message-read-action"><button type="button" class="ghost mini" data-mark-message-read="${escapeHtml(m.id)}">Marcar como leído</button></div>`;
  return `<div class="card message-card ${toneClass} ${isAssistant ? 'assistant-message-card' : ''} ${m.read ? '' : 'unread'}" data-message-card-id="${escapeHtml(m.id)}">
    <div class="message-card-accent"></div>
    <div class="message-card-main">
      <div class="row message-card-head">
        <div class="message-head-left">
          <div class="message-meta-row">
            <span class="message-type-chip">${messageIcon(m.type)} ${escapeHtml(messageTypeLabel(m.type || 'info'))}</span>
            <span class="message-date-chip">Temporada ${m.season || 1} · Día ${((Number(m.turn || 0)) * DAYS_PER_ADVANCE) + 1}</span>
            ${unreadMark}
            ${assistantBadge}
          </div>
          <h3>${messageTitleHtml(m)}</h3>
        </div>
        <span class="pill ${m.priority === 'high' ? 'warn' : ''}">${m.priority === 'high' ? 'Importante' : 'Normal'}</span>
      </div>
      <div class="message-paper"><p>${messageBodyHtml(m)}</p>${messageRelatedPlayersMarkup(m)}</div>
      ${action}
      ${readAction}
    </div>
  </div>`;
}
function hasPendingTransferOfferForPlayer(playerId){
  const id = Number(playerId);
  const pendingMessage = (game?.messages || []).some(m => m.action?.type === 'transferOffer'
    && ['pending','agreed_pending_market','auto_agreed_pending_market','forced_sale_pending_market'].includes(String(m.action.status || ''))
    && Number(m.action.playerId) === id);
  return pendingMessage || (typeof hasActivePendingTransferForPlayer === 'function' && hasActivePendingTransferForPlayer(id));
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
function playerOfferSeasonPerformancePercent(player){
  const st = playerSeasonStatsForOffers(player);
  const played = Math.max(0, Number(st.played || 0));
  if(played <= 0) return 0;
  const group = typeof playerGroup === 'function' ? playerGroup(player?.position) : String(player?.position || '');
  let contribution = 0;
  if(group === 'gk'){
    contribution = (st.keySaves * 1.8) + (st.assists * 1.2) + (st.goals * 3);
  }else if(group === 'def'){
    contribution = (st.goals * 2.3) + (st.assists * 1.8) + (st.keySaves * 0.4);
  }else if(group === 'mid'){
    contribution = (st.goals * 2.1) + (st.assists * 2.5) + (st.keySaves * 0.3);
  }else{
    contribution = (st.goals * 2.8) + (st.assists * 1.8) + (st.keySaves * 0.2);
  }
  const reliability = Math.max(0, 1 - ((st.red * 0.08) + (st.goalErrors * 0.12) + (st.errors * 0.025) + (st.injuries * 0.02)));
  const productionPerMatch = contribution / played;
  const activity = Math.min(1, played / 12);
  return clamp(Math.round((35 + (productionPerMatch * 34) + (activity * 22)) * reliability), 0, 100);
}
function playerOfferScoutingPercent(player){
  if(!player || !game) return 0;
  const report = game?.scoutingCenter?.reports?.[String(Number(player.id || 0))];
  const known = new Set(Array.isArray(report?.visibleSkills) ? report.visibleSkills.map(String) : []);
  const hiddenKeys = typeof scoutingHiddenSkillKeys === 'function'
    ? scoutingHiddenSkillKeys(player)
    : ['hidden.aggression','hidden.genetics','hidden.surprise'];
  const uniqueHidden = Array.from(new Set((hiddenKeys || []).map(String))).filter(Boolean);
  if(!uniqueHidden.length) return 0;
  const revealed = uniqueHidden.filter(key => known.has(key)).length;
  return clamp(Math.round((revealed / uniqueHidden.length) * 100), 0, 100);
}
function playerOfferValueFactors(player){
  const st = playerSeasonStatsForOffers(player);
  const played = Math.max(0, Number(st.played || 0));
  const goals = Math.max(0, Number(st.goals || 0));
  const assists = Math.max(0, Number(st.assists || 0));
  const performancePercent = playerOfferSeasonPerformancePercent(player);
  const scoutingPercent = playerOfferScoutingPercent(player);
  const matchesBonus = Math.min(Number(PLAYER_OFFER_MATCH_BONUS_MAX || 0), (played / Math.max(1, Number(PLAYER_OFFER_MATCHES_FOR_MAX_BONUS || 24))) * Number(PLAYER_OFFER_MATCH_BONUS_MAX || 0));
  const goalsBonus = Math.min(Number(PLAYER_OFFER_GOAL_BONUS_MAX || 0), goals * Number(PLAYER_OFFER_GOAL_BONUS || 0));
  const assistsBonus = Math.min(Number(PLAYER_OFFER_ASSIST_BONUS_MAX || 0), assists * Number(PLAYER_OFFER_ASSIST_BONUS || 0));
  const performanceBonus = (performancePercent / 100) * Number(PLAYER_OFFER_PERFORMANCE_BONUS_MAX || 0);
  const scoutingBonus = (scoutingPercent / 100) * Number(PLAYER_OFFER_SCOUTING_BONUS_MAX || 0);
  const sportingDirectorBonus = typeof specialActiveBonus === 'function'
    ? Math.max(0, Number(specialActiveBonus('director_deportivo') || 0))
    : 0;
  return {
    played,
    goals,
    assists,
    performancePercent,
    scoutingPercent,
    matchesBonus,
    goalsBonus,
    assistsBonus,
    performanceBonus,
    scoutingBonus,
    sportingDirectorBonus,
    totalBonus:matchesBonus + goalsBonus + assistsBonus + performanceBonus + scoutingBonus + sportingDirectorBonus
  };
}
function playerOfferRange(player){
  const profile = playerOfferProfile(player);
  // Las ofertas por cláusula completa mantienen su flujo separado.
  if(profile === 'star') return { min:70, max:100 };
  if(profile === 'young_good') return { min:36, max:70 };
  if(profile === 'transfer_listed') return { min:12, max:36 };
  const minRate = Number(PLAYER_OFFER_MIN_CLAUSE_RATE || 0.10);
  const maxRate = Number(PLAYER_OFFER_MAX_CLAUSE_RATE || 0.30);
  return { min:Math.round(minRate * 100), max:Math.max(Math.round(minRate * 100), Math.round(maxRate * 100)) };
}
function playerOfferPercent(player, salt=''){
  const range = playerOfferRange(player);
  const minPct = Math.max(1, Math.round(range.min || 5));
  const maxPct = Math.max(minPct, Math.round(range.max || 15));
  const span = Math.max(0, maxPct - minPct);
  const factors = playerOfferValueFactors(player);
  const randomRoom = Math.min(4, Math.max(0, Math.floor(span * 0.20)));
  const noise = randomRoom > 0 ? hashNumber(`player-offer-pct-${player?.id}-${salt}-${game?.seasonNumber || 1}`, randomRoom + 1) : 0;
  const sportingDirectorBonus = Math.max(0, Math.round(Number(factors.sportingDirectorBonus || 0)));
  const earnedBonus = Math.max(0, Math.round(Number(factors.totalBonus || 0) - sportingDirectorBonus));
  const basePercent = clamp(minPct + noise + earnedBonus, minPct, Math.min(100, maxPct));
  return clamp(basePercent + sportingDirectorBonus, minPct, 100);
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
  if(!clubs.length) return { name:'Club interesado', id:-1 };
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
function transferOfferReachesFullClause(message, player=null){
  const action = message?.action;
  if(action?.type !== 'transferOffer') return false;
  if(action.origin === 'special_clause' || action.canConvince === true) return true;
  if(Number(action.pct || 0) >= 100) return true;
  const targetPlayer = player || (typeof playerById === 'function' ? playerById(Number(action.playerId || 0)) : null);
  const clause = Math.max(0, Number(action.clauseAmount || action.playerClause || (targetPlayer && typeof playerClauseFor === 'function' ? playerClauseFor(targetPlayer) : 0)));
  const amount = Math.max(0, Number(action.grossAmount ?? action.amount ?? 0));
  const tolerance = Math.max(1, Math.round(clause * 0.001));
  return clause > 0 && amount + tolerance >= clause;
}
function normalizeFullClauseTransferOffer(message, player=null){
  if(!transferOfferReachesFullClause(message, player)) return false;
  const action = message.action;
  if(action.origin !== 'special_clause') action.originalOrigin = action.originalOrigin || action.origin || 'regular_offer';
  action.origin = 'special_clause';
  action.canConvince = true;
  action.pct = Math.max(100, Number(action.pct || 0));
  action.ownerClubId = Number(action.ownerClubId || game?.selectedClubId || player?.clubId || 0);
  return true;
}
function isPendingSpecialClauseOfferMessage(message){
  return Boolean(message?.action?.type === 'transferOffer'
    && message.action.status === 'pending'
    && transferOfferReachesFullClause(message));
}
function specialClauseOfferCreatedSeasonDay(message){
  const stored = Number(message?.action?.createdSeasonDay || 0);
  if(stored > 0) return stored;
  const season = Math.max(1, Math.round(Number(message?.season || game?.seasonNumber || 1)));
  const year = typeof seasonYearForNumber === 'function' ? seasonYearForNumber(season) : currentSeasonYear();
  const date = validIsoDate(message?.date) ? message.date : (game?.currentDate || '');
  const calculated = typeof seasonDayFromDate === 'function' ? Number(seasonDayFromDate(date, year) || 0) : 0;
  return Math.max(1, calculated || (typeof currentGlobalDayNumber === 'function' ? Number(currentGlobalDayNumber() || 1) : 1));
}
function specialClauseOfferCreatedDate(message){
  if(validIsoDate(message?.action?.createdDate)) return message.action.createdDate;
  if(validIsoDate(message?.date)) return message.date;
  const season = Math.max(1, Math.round(Number(message?.season || game?.seasonNumber || 1)));
  const day = specialClauseOfferCreatedSeasonDay(message);
  return typeof transferMarketDateForSeasonDay === 'function'
    ? transferMarketDateForSeasonDay(season, day)
    : (game?.currentDate || '');
}
function specialClauseAutomaticAcceptanceDate(message){
  const createdDate = specialClauseOfferCreatedDate(message);
  return validIsoDate(createdDate) ? addDaysToIsoDate(createdDate, Number(SPECIAL_CLAUSE_RESPONSE_DAYS || 5)) : '';
}
function specialClauseAutoAcceptanceWarning(dueDate){
  const days = Math.max(1, Math.round(Number(SPECIAL_CLAUSE_RESPONSE_DAYS || 5)));
  const dueLabel = validIsoDate(dueDate) ? dueDate : 'la fecha indicada';
  return `Tenés ${days} días completos para aceptar la oferta o intentar convencer al jugador. Si no respondés, la cláusula se aceptará automáticamente el ${dueLabel}. El cierre del mercado no acorta este plazo.`;
}
function ensureSpecialClauseAutoAcceptanceMetadata(message, options={}){
  if(!isPendingSpecialClauseOfferMessage(message)) return null;
  const player = typeof playerById === 'function' ? playerById(Number(message?.action?.playerId || 0)) : null;
  normalizeFullClauseTransferOffer(message, player);
  const createdSeasonDay = specialClauseOfferCreatedSeasonDay(message);
  const createdDate = specialClauseOfferCreatedDate(message);
  const responseDueDate = validIsoDate(message.action.responseDueDate)
    ? message.action.responseDueDate
    : specialClauseAutomaticAcceptanceDate(message);
  message.action.createdSeasonDay = createdSeasonDay;
  message.action.createdDate = createdDate;
  message.action.responseDays = Number(SPECIAL_CLAUSE_RESPONSE_DAYS || 5);
  message.action.responseDueDate = responseDueDate;
  message.action.ownerClubId = Number(message.action.ownerClubId || game?.selectedClubId || 0);
  if(Object.prototype.hasOwnProperty.call(message.action, 'autoAcceptSeasonDay')) delete message.action.autoAcceptSeasonDay;
  const cleanBody = String(message.body || '')
    .replace(/\s*Si no respondés ni hablás con el jugador, la cláusula se aceptará automáticamente el día \d+\./g, '')
    .replace(/\s*Tenés \d+ días completos para aceptar la oferta o intentar convencer al jugador\.[^]*?El cierre del mercado no acorta este plazo\./g, '')
    .trim();
  if(options.addWarning !== false){
    const warning = specialClauseAutoAcceptanceWarning(responseDueDate);
    message.body = `${cleanBody} ${warning}`.trim();
    message.action.autoAcceptWarningAdded = true;
  }
  return message.action;
}
function ensurePendingSpecialClauseAutoAcceptanceMetadata(){
  if(!game) return 0;
  let changed = 0;
  (game.messages || []).forEach(message => {
    if(!isPendingSpecialClauseOfferMessage(message)) return;
    const before = JSON.stringify(message.action || {});
    const beforeBody = String(message.body || '');
    ensureSpecialClauseAutoAcceptanceMetadata(message);
    if(before !== JSON.stringify(message.action || {}) || beforeBody !== String(message.body || '')) changed += 1;
  });
  return changed;
}
function specialClauseNoResponseMessages(player, managerName){
  const playerName = player?.name || 'Jugador';
  const clubNameValue = clubName(player?.clubId || game?.selectedClubId) || 'el club';
  const manager = managerName || 'Manager';
  return [
    `${manager}, esperé una respuesta sobre mi futuro y nunca llegó. Ni siquiera tuvimos una charla. No voy a seguir en un club que ignora una decisión tan importante: acepto la cláusula y mi salida queda acordada.`,
    `Soy ${playerName}. La oferta estuvo cinco días sobre la mesa y nadie se comunicó conmigo. Ese silencio me dejó claro el lugar que ocupaba en ${clubNameValue}. Acepto la transferencia y continuaré mi carrera en el club comprador cuando el mercado lo permita.`,
    `${manager}, no esperaba promesas, pero sí una conversación. Como nadie respondió ni explicó qué quería hacer conmigo, decidí aceptar la cláusula. Mi salida queda confirmada para la próxima fecha habilitada.`,
    `La cláusula fue pagada y esperé que ${clubNameValue} se acercara a hablar. No ocurrió. Sentí indiferencia en un momento decisivo para mi carrera, así que doy por terminado mi ciclo y acepto la operación.`,
    `${manager}, el problema no fue la oferta: fue no recibir una sola respuesta. Después de esperar sin que nadie hablara conmigo, ya no tengo motivos para rechazarla. La transferencia queda acordada.`
  ];
}
function processUnansweredSpecialClauseOffers(options={}){
  const result = { checked:0, accepted:0, scheduled:0, closed:0, messages:[], seasonDay:0 };
  if(!game) return result;
  ensurePendingSpecialClauseAutoAcceptanceMetadata();
  const currentDay = typeof currentGlobalDayNumber === 'function'
    ? Math.max(1, Math.round(Number(currentGlobalDayNumber() || 1)))
    : Math.max(1, Math.round(Number(seasonDayFromDate(game.currentDate, currentSeasonYear()) || 1)));
  const currentDate = validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
  result.seasonDay = currentDay;
  const managerName = game?.rankingManagerName || storedManagerName() || 'Manager';
  const pending = (game.messages || []).filter(isPendingSpecialClauseOfferMessage);
  for(const msg of pending){
    result.checked += 1;
    const action = ensureSpecialClauseAutoAcceptanceMetadata(msg);
    if(!action) continue;
    const dueDate = validIsoDate(action.responseDueDate) ? action.responseDueDate : specialClauseAutomaticAcceptanceDate(msg);
    const overdue = validIsoDate(dueDate) && validIsoDate(currentDate) && daysBetweenIsoDates(dueDate, currentDate) >= 0;
    if(!overdue) continue;
    const player = playerById(Number(action.playerId || 0));
    const ownerClubId = Number(action.ownerClubId || game.selectedClubId || 0);
    if(ownerClubId && ownerClubId !== Number(game.selectedClubId || 0)){
      action.status = 'cancelled_club_change';
      action.closedAutomaticallyAtSeasonDay = currentDay;
      action.closedAutomaticallyAtDate = currentDate;
      msg.body += ' La oferta quedó cerrada porque el manager ya no dirige al club que recibió la propuesta.';
      result.closed += 1;
      continue;
    }
    if(!player || Number(player.clubId || 0) !== Number(game.selectedClubId || 0)){
      action.status = 'expired_player_unavailable';
      action.closedAutomaticallyAtSeasonDay = currentDay;
      action.closedAutomaticallyAtDate = currentDate;
      msg.body += ' La oferta quedó cerrada porque el jugador ya no pertenece al club.';
      result.closed += 1;
      continue;
    }
    const variants = specialClauseNoResponseMessages(player, managerName);
    const text = variants[hashNumber(`special-clause-no-response-${msg.id}-${player.id}-${dueDate}`, variants.length)];
    action.autoAcceptedAtSeasonDay = currentDay;
    action.autoAcceptedAtDate = currentDate;
    action.noResponseMessage = text;
    const transferResult = completeTransferSaleFromMessage(msg, player, {
      status:'auto_accepted_no_response',
      bodyPrefix:`La oferta se aceptó automáticamente al cumplirse los ${Number(SPECIAL_CLAUSE_RESPONSE_DAYS || 5)} días sin respuesta. ${text}`,
      notice:`${player.name} ejecutó la cláusula después de no recibir respuesta.`,
      silent:true
    }) || {};
    const schedule = transferResult.schedule;
    const departureMessage = pushGameMessage({
      type:'mercado',
      priority:'high',
      title:transferResult.scheduled ? `Salida acordada de ${playerLastName(player.name)}` : `${playerLastName(player.name)} se marchó sin recibir respuesta`,
      body:transferResult.scheduled
        ? `${text} La transferencia quedó acordada y se ejecutará en la temporada ${schedule?.season || game.seasonNumber}, día ${schedule?.day || '—'}, cuando el mercado vuelva a abrir.`
        : text,
      id:`special-clause-no-response-${msg.season || game.seasonNumber}-${player.id}-${String(dueDate || '').replace(/-/g,'')}`
    });
    if(departureMessage) result.messages.push(departureMessage.id);
    result.accepted += 1;
    if(transferResult.scheduled) result.scheduled += 1;
  }
  if(result.accepted || result.closed){
    saveLocal(true);
    if(!options.silent && result.accepted){
      const scheduledText = result.scheduled ? ` ${result.scheduled} quedaron programada(s) para la próxima apertura del mercado.` : '';
      showNotice(`${result.accepted} oferta(s) por cláusula se aceptaron automáticamente por falta de respuesta.${scheduledText}`);
    }
  }
  return result;
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
  const createdSeasonDay = typeof currentGlobalDayNumber === 'function' ? currentGlobalDayNumber() : seasonDayFromDate(game.currentDate, currentSeasonYear());
  const createdDate = validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
  const responseDueDate = addDaysToIsoDate(createdDate, Number(SPECIAL_CLAUSE_RESPONSE_DAYS || 5));
  const body = `${source.name}, club de tu misma liga, comunicó que está dispuesto a pagar la cláusula completa de ${player.name}. La oferta es de ${formatMoney(financials.grossAmount)}. ${federation} retiene ${formatMoney(financials.taxAmount)}; el club recibiría ${formatMoney(financials.netAmount)} netos. Podés aceptar la venta o intentar convencer al jugador de quedarse. ${specialClauseAutoAcceptanceWarning(responseDueDate)}`;
  const msg = pushGameMessage({
    type:'mercado',
    priority:'high',
    title:`Oferta de cláusula por ${playerLastName(player.name)}`,
    body,
    action:{ type:'transferOffer', status:'pending', origin:'special_clause', playerId:player.id, amount:financials.grossAmount, grossAmount:financials.grossAmount, taxAmount:financials.taxAmount, netAmount:financials.netAmount, foreignClub:source.name, sourceClubId:source.id, ownerClubId:Number(game.selectedClubId || 0), pct:100, canConvince:true, createdSeasonDay, createdDate, responseDays:Number(SPECIAL_CLAUSE_RESPONSE_DAYS || 5), responseDueDate, autoAcceptWarningAdded:true }
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
  const source = botTransferOfferClub(player);
  const note = player.transferListed ? 'El jugador figura como transferible, por eso la oferta es más probable pero tiende a ser menor.' : 'Si aceptás con el mercado cerrado, la salida quedará acordada para la próxima apertura.';
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
    const source = botTransferOfferClub(player);
    const msg = pushGameMessage({
      type:'mercado',
      priority:'high',
      title:`Oferta por ${playerLastName(player.name)}`,
      body:transferOfferBody(source, player, financials, pct, 'Si aceptás con el mercado cerrado, la salida quedará acordada para la próxima apertura.'),
      action:{ type:'transferOffer', status:'pending', playerId:player.id, amount:financials.grossAmount, grossAmount:financials.grossAmount, taxAmount:financials.taxAmount, netAmount:financials.netAmount, foreignClub:source.name, sourceClubId:source.id, pct, origin:'season_end' }
    });
    if(msg) created.push(msg);
  }
  game.seasonEndPlayerOffers = { season, generatedAt:turnStamp({ action:'seasonEndPlayerOffers' }), count:created.length };
  return created;
}
function queueOutgoingTransferFromMessage(msg, player, options={}){
  game.pendingTransfers = Array.isArray(game.pendingTransfers) ? game.pendingTransfers : [];
  const schedule = transferMarketScheduleForCurrentState(game);
  const existing = game.pendingTransfers.find(item => isActivePendingTransfer(item)
    && String(item.type || '') === 'outgoing'
    && (String(item.messageId || '') === String(msg.id || '') || Number(item.playerId || 0) === Number(player.id)));
  const finalStatus = options.status || 'accepted';
  const pendingStatus = finalStatus === 'auto_accepted_no_response'
    ? 'auto_agreed_pending_market'
    : finalStatus === 'forced_sale' ? 'forced_sale_pending_market' : 'agreed_pending_market';
  const item = existing || {
    id:`outgoing-${player.id}-${Date.now()}`,
    type:'outgoing',
    playerId:Number(player.id),
    fromClubId:Number(game.selectedClubId || player.clubId || 0),
    toClubId:Number(msg.action.sourceClubId || -1),
    messageId:String(msg.id || ''),
    status:'pending'
  };
  item.amount = Math.max(0, Math.round(Number(msg.action.grossAmount ?? msg.action.amount ?? 0)));
  item.grossAmount = item.amount;
  item.taxAmount = Math.max(0, Math.round(Number(msg.action.taxAmount || 0)));
  item.netAmount = Math.max(0, Math.round(Number(msg.action.netAmount || item.amount - item.taxAmount)));
  item.executeSeason = schedule.season;
  item.executeDay = schedule.day;
  item.executeDate = schedule.date;
  item.agreedSeason = Number(game.seasonNumber || 1);
  item.agreedDay = transferMarketSeasonDayForState(game);
  item.agreedDate = game.currentDate || '';
  item.finalStatus = finalStatus;
  item.bodyPrefix = options.bodyPrefix || '';
  item.notice = options.notice || '';
  if(!existing) game.pendingTransfers.push(item);
  msg.action.status = pendingStatus;
  msg.action.ownerClubId = Number(msg.action.ownerClubId || item.fromClubId || game.selectedClubId || player.clubId || 0);
  msg.action.finalStatus = finalStatus;
  msg.action.transferPendingId = item.id;
  msg.action.executeSeason = schedule.season;
  msg.action.executeDay = schedule.day;
  msg.action.executeDate = schedule.date;
  player.transferAgreed = true;
  player.transferListed = false;
  player.transferAgreedToClubId = item.toClubId;
  player.transferScheduledDate = schedule.date;
  if(!msg.action.marketAgreementTextAdded){
    const prefix = options.bodyPrefix ? ` ${options.bodyPrefix}` : ' Oferta aceptada.';
    msg.body += `${prefix} Como el mercado está cerrado, el jugador continuará en el club hasta la temporada ${schedule.season}, día ${schedule.day}. El dinero se acreditará cuando se ejecute la transferencia.`;
    msg.action.marketAgreementTextAdded = true;
  }
  if(options.skipSave !== true) saveLocal(true);
  if(options.silent !== true){
    showNotice(`${player.name}: salida acordada para la temporada ${schedule.season}, día ${schedule.day}.`);
    renderMessages();
  }
  return { scheduled:true, executed:false, schedule, transfer:item };
}
function completeTransferSaleFromMessage(msg, player, options={}){
  if(!msg?.action || !player) return { scheduled:false, executed:false };
  const forceExecute = Boolean(options.forceExecute);
  if(!forceExecute && typeof isTransferMarketOpen === 'function' && !isTransferMarketOpen(game)){
    return queueOutgoingTransferFromMessage(msg, player, options);
  }
  const grossAmount = Number(msg.action.grossAmount ?? msg.action.amount ?? 0);
  const taxAmount = Number(msg.action.taxAmount ?? Math.round(grossAmount * Number(TRANSFER_AFA_TAX_RATE || 0)));
  const netAmount = Number(msg.action.netAmount ?? Math.max(0, grossAmount - taxAmount));
  const saleFederation = transferTaxFederationForSource({ id:msg.action.sourceClubId, name:msg.action.foreignClub });
  recordBudgetChange(netAmount, `Venta de ${player.name} (neto ${saleFederation})`, { type:'transfer_sale', playerId:player.id, grossAmount, taxAmount, netAmount, federation:saleFederation, origin:msg.action.origin || 'offer' });
  const unlockedForTransfers = typeof unlockTransferBudgetFromSale === 'function' ? unlockTransferBudgetFromSale(netAmount) : 0;
  const destinationClubId = Number(msg.action.sourceClubId || -1);
  const sellerClubId = Number(player.clubId || game.selectedClubId || 0);
  if(typeof resetPlayerCaptaincyProgress === 'function') resetPlayerCaptaincyProgress(player.id, sellerClubId);
  setPlayerClubId(player, destinationClubId > 0 ? destinationClubId : -1);
  player.transferListed = false;
  player.intransferible = false;
  player.transferAgreed = false;
  delete player.transferAgreedToClubId;
  delete player.transferScheduledDate;
  game.marketPlayers = (game.marketPlayers || []).map(p => p.id === player.id ? { ...p, clubId:destinationClubId > 0 ? destinationClubId : -1, transferListed:false, intransferible:false, sold:destinationClubId > 0 ? false : true, transferAgreed:false } : p);
  removePlayerFromCurrentTactic(player.id);
  if(typeof syncPlayerStarsWithClubs === 'function') syncPlayerStarsWithClubs(game);
  if(typeof recordTransferHistory === 'function') recordTransferHistory(player, { fromClubId:sellerClubId, toClubId:destinationClubId, toLabel:msg.action.foreignClub || '', amount:grossAmount, kind:'sale', source:'manager_sale', transactionKey:`outgoing-transfer-${msg.action.transferPendingId || msg.id || player.id}-${Number(game.seasonNumber || 1)}` });
  const cohesionChange = typeof adjustTeamCohesion === 'function' ? adjustTeamCohesion(sellerClubId, -TEAM_COHESION_SALE_LOSS) : 0;
  const finalStatus = options.status || msg.action.finalStatus || 'accepted';
  msg.action.status = finalStatus;
  msg.action.grossAmount = grossAmount;
  msg.action.taxAmount = taxAmount;
  msg.action.netAmount = netAmount;
  msg.action.executedSeason = Number(game.seasonNumber || 1);
  msg.action.executedDay = transferMarketSeasonDayForState(game);
  msg.action.executedDate = game.currentDate || '';
  const federation = transferTaxFederationForSource({ id:msg.action.sourceClubId, name:msg.action.foreignClub });
  const cohesionText = cohesionChange ? ` Cohesión ${cohesionChange > 0 ? '+' : ''}${cohesionChange}.` : '';
  const defaultSuffix = ` Ingreso neto recibido: ${formatMoney(netAmount)}. Impuesto ${federation}: ${formatMoney(taxAmount)}.${unlockedForTransfers ? ` La directiva liberó ${formatMoney(unlockedForTransfers)} para futuros fichajes.` : ''}${cohesionText}`;
  if(msg.action.marketAgreementTextAdded){
    msg.body += ` Transferencia ejecutada durante el mercado abierto.${defaultSuffix}`;
  }else{
    msg.body += `${options.bodyPrefix ? ' ' + options.bodyPrefix : ' Oferta aceptada.'}${defaultSuffix}`;
  }
  const pending = (game.pendingTransfers || []).find(item => String(item.id || '') === String(msg.action.transferPendingId || ''));
  if(pending){
    pending.status = 'departed';
    pending.executedSeason = Number(game.seasonNumber || 1);
    pending.executedDay = transferMarketSeasonDayForState(game);
    pending.executedDate = game.currentDate || '';
  }
  if(options.skipSave !== true) saveLocal(true);
  if(options.silent !== true){
    showNotice(options.notice || `${player.name} fue vendido. Neto recibido: ${formatMoney(netAmount)}.`);
    renderMessages();
  }
  return { scheduled:false, executed:true, grossAmount, taxAmount, netAmount, destinationClubId };
}
function acceptTransferOffer(messageId){
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){ showNotice('No podés aceptar ofertas de jugadores mientras estás sin club.'); return; }
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending') return;
  const player = playerById(msg.action.playerId);
  if(!player || player.clubId !== game.selectedClubId){ showNotice('La oferta ya no está disponible.'); return; }
  const isFullClause = transferOfferReachesFullClause(msg, player);
  if(isFullClause) normalizeFullClauseTransferOffer(msg, player);
  const pct = Number(msg.action.pct || 0);
  if(isPlayerUntransferable(player) && !isFullClause){
    msg.action.status = 'auto_rejected_intransferible';
    msg.body += ` Oferta rechazada automáticamente: ${player.name} está marcado como intransferible y sólo se aceptan propuestas por la cláusula completa.`;
    saveLocal(true);
    showNotice('Oferta rechazada automáticamente: jugador intransferible.');
    renderMessages();
    return;
  }
  if(!isFullClause && !hasFirstTeamRosterMinimumAfterRemoval(game.selectedClubId, 1)){ showRosterMinimumNotice(); return; }
  if(!isFullClause && typeof playerStarRecord === 'function' && playerStarRecord(player) && pct < Number(STAR_PLAYER_DIRECTIVE_MIN_OFFER_PCT || 40)){
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
  const playerName = player?.name || 'Jugador';
  const clubNameValue = clubName(game?.selectedClubId) || 'el club';
  const manager = managerName || 'Manager';
  return [
    `${manager}, soy ${playerName}. Estaba esperando que me llamaras. No quiero irme: sé que ${clubNameValue} necesita el dinero, pero prefiero quedarme a pelear por algo importante. Nos vemos en el entrenamiento.`,
    `Gracias por hablar conmigo, ${manager}. La oferta era fuerte, pero todavía tengo una historia pendiente en ${clubNameValue}. Contá conmigo: me quedo.`,
    `Me llamó el otro club, sí, pero necesitaba escuchar al mío. Si vos me querés acá, sigo compitiendo con esta camiseta. Mañana estoy en la práctica, ${manager}.`,
    `No voy a negar que el pago de la cláusula me hizo pensar. Pero quiero ser importante en ${clubNameValue}. Guardá la lapicera: ${playerName} se queda.`,
    `Tenía miedo de que quisieran venderme sin hablar conmigo. Si me pedís que siga, sigo. Quiero pelearla con este equipo, ${manager}.`,
    `${manager}, valoro que hayas venido de frente. El dinero es importante, pero también lo es sentir respaldo. Me quedo para demostrar que todavía puedo darle mucho a ${clubNameValue}.`,
    `La propuesta me tentó, no te voy a mentir, ${manager}. Pero después de esta charla entendí que todavía soy parte del proyecto de ${clubNameValue}. Deciles que no preparen el contrato: me quedo.`,
    `Soy ${playerName} y mi decisión está tomada: continúo en ${clubNameValue}. Quiero que esta temporada termine con nosotros peleando juntos, no mirando desde otro vestuario.`,
    `Gracias por confiar en mí, ${manager}. No necesito promesas imposibles; necesitaba saber que cuento para vos. Rechazo la salida y sigo entrenando con el grupo.`,
    `La cláusula podía sacar a ${playerName} del club, pero esta conversación cambió todo. Me quedo por mis compañeros, por la gente de ${clubNameValue} y porque todavía creo en lo que estamos construyendo.`
  ];
}
function specialClauseLeaveMessages(player, managerName){
  const playerName = player?.name || 'Jugador';
  const clubNameValue = clubName(game?.selectedClubId) || 'el club';
  const manager = managerName || 'Manager';
  return [
    `${manager}, soy ${playerName}. El rendimiento del equipo no es lo que esperaba y tengo aspiraciones más altas. Me deja tranquilo saber que ${clubNameValue} recibe un buen dinero. Te agradezco, pero me voy.`,
    `Lo pensé mucho, ${manager}. El equipo no está en el lugar donde imaginaba competir y esta oportunidad no la puedo dejar pasar. Gracias por todo; la cláusula también deja una suma importante al club.`,
    `${manager}, me cuesta decirlo, pero necesito otro desafío. El presente deportivo no acompaña mis objetivos. Ojalá este dinero ayude a ${clubNameValue}. Gracias por intentarlo.`,
    `Te escuché y respeto tu postura, ${manager}, pero ya tomé una decisión. Quiero competir por objetivos más altos y hoy siento que en ${clubNameValue} no los tengo cerca. Me voy agradecido.`,
    `Aprecio que me hayas llamado, ${manager}. La propuesta es importante y el rendimiento del equipo no coincide con mis aspiraciones. Me voy con respeto y gratitud.`,
    `No es una decisión contra vos. Siento que llegó el momento de cambiar de club y probarme en otro nivel. ${clubNameValue} recibe la cláusula completa y yo voy a aceptar el nuevo desafío.`,
    `${manager}, agradezco que hayas intentado convencerme, pero mi ciclo está terminado. Necesito salir ahora y no quiero prometer una continuidad que no voy a sentir.`,
    `Soy ${playerName} y prefiero ser claro: elegí marcharme. La oferta deportiva me convence más y creo que es el paso correcto para mi carrera.`,
    `La charla fue sincera, ${manager}, pero no cambió mi decisión. Quiero otro entorno competitivo y ya di mi palabra. Espero que el ingreso por la cláusula ayude a reconstruir el plantel de ${clubNameValue}.`,
    `Me llevo buenos recuerdos de ${clubNameValue}, ${manager}, pero esta oportunidad no vuelve todos los días. La cláusula fue pagada y voy a continuar mi carrera en el otro club.`
  ];
}
function showSpecialClauseResponseModal(player, text, status='stay'){
  if(typeof openModal !== 'function') return;
  const clubId = Number(game?.selectedClubId || player?.clubId || 0);
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
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){ showNotice('No podés intervenir ofertas de jugadores mientras estás sin club.'); return; }
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending') return;
  const player = playerById(msg.action.playerId);
  if(!player || player.clubId !== game.selectedClubId){ showNotice('La oferta ya no está disponible.'); return; }
  if(!transferOfferReachesFullClause(msg, player)){ showNotice('Esta oferta no alcanza la cláusula completa.'); return; }
  normalizeFullClauseTransferOffer(msg, player);
  const position = currentManagerLeaguePosition();
  const failureChance = clamp((Number(position || 20) * 2) / 100, 0.02, 0.95);
  const managerName = game?.rankingManagerName || storedManagerName() || 'Manager';
  const roll = Math.random();
  if(roll < failureChance){
    const variants = specialClauseLeaveMessages(player, managerName);
    const text = variants[hashNumber(`special-clause-leave-${player.id}-${Date.now()}`, variants.length)];
    const transferResult = completeTransferSaleFromMessage(msg, player, { status:'forced_sale', bodyPrefix:text, notice:`${player.name} decidió irse. La cláusula fue ejecutada.` }) || {};
    if(transferResult.scheduled) showNotice(`${player.name} decidió irse. La salida quedó acordada para la temporada ${transferResult.schedule?.season || game.seasonNumber}, día ${transferResult.schedule?.day || '—'}.`);
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
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){ showNotice('No podés gestionar ofertas de jugadores mientras estás sin club.'); return; }
  const msg = (game.messages || []).find(m => m.id === messageId);
  if(!msg || msg.action?.type !== 'transferOffer' || msg.action.status !== 'pending') return;
  const player = typeof playerById === 'function' ? playerById(Number(msg.action.playerId || 0)) : null;
  if(transferOfferReachesFullClause(msg, player)){
    normalizeFullClauseTransferOffer(msg, player);
    showNotice('Una oferta por la cláusula completa no puede rechazarse. Podés aceptarla o intentar convencer al jugador.');
    saveLocal(true);
    renderMessages();
    return;
  }
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
  const captainId = Number(game.tactic.captainId || 0) === id ? 0 : Number(game.tactic.captainId || 0);
  game.tactic = ensureTacticCaptain(applyStarterMentalities({ ...game.tactic, captainId, starters, bench, autoSubs }), game.selectedClubId);
}


function canBotDismissPlayer(player){
  if(!player || Number(player.clubId || 0) === Number(game?.selectedClubId)) return false;
  if(player.emergencyLocked || player.emergencyBot || player.transferAgreed) return false;
  if(typeof hasActivePendingTransferForPlayer === 'function' && hasActivePendingTransferForPlayer(player.id)) return false;
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
      setPlayerClubId(player, 0);
      player.freeAgent = true;
      player.transferListed = false;
      player.salaryPaidCount = 0;
      player.lastSalaryPaidSeason = 0;
      refreshPlayerClause(player);
      if(typeof recordTransferHistory === 'function') recordTransferHistory(player, { fromClubId:Number(club.id), toClubId:0, amount:0, kind:'bot_release', source:'bot_dismissal' });
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
  const total = Math.max(0, Math.round(Number(count || 0)));
  const retiredReservedMax = Math.max(0, ...((game?.retiredPlayerPool || []).map(item => Number(item?.previousPlayerId || item?.id || 0))));
  const requestedStart = Number.isFinite(Number(options.startId))
    ? Math.max(1, Math.round(Number(options.startId)))
    : (typeof nextPlayerId === 'function' ? nextPlayerId() : Math.max(0, ...(seed?.players || []).map(p => Number(p.id) || 0)) + 1000);
  const startId = Math.max(requestedStart, retiredReservedMax + 1);
  const label = options.label || 'market';
  const nameContext = options.nameContext || 'Mercado Libre';
  const activePlayers = (seed?.players || []).filter(player => player && !player.retired && !player.sold && Number(player.clubId || 0) >= 0);
  const generationContext = createPlayerGenerationContext(activePlayers.length + total, activePlayers);
  const balancedGroups = buildBalancedFreeAgentPositionGroups(total, label);
  const players = typeof takeRetiredPlayersAsFreeAgents === 'function'
    ? takeRetiredPlayersAsFreeAgents(total, {
        generationContext,
        prestige:52,
        nameContext,
        divisionName:'Mercado',
        salaryFactor:MARKET_FREE_AGENT_SALARY_FACTOR,
        youthFreeAgent:false,
        mediaMin:MARKET_FREE_AGENT_MEDIA_MIN,
        mediaMax:MARKET_FREE_AGENT_MEDIA_MAX
      })
    : [];
  const remaining = Math.max(0, total - players.length);
  const generatedStartId = Math.max(startId, ...players.map(player => Number(player.id || 0) + 1), 1);
  for(let i=0;i<remaining;i++){
    const id = generatedStartId + i;
    const groupIndex = players.length + i;
    const group = balancedGroups[groupIndex] || pickPositionGroupForGeneration(id, label, generationContext);
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
      nationalityOverride:freeAgentNationalityForIndex(groupIndex, label)
    });
    players.push(player);
  }
  return players;
}

function mergeMarketPlayersIntoSeed(players=[]){
  if(!seed?.players) return { changed:false, inserted:0, updated:0, deduplicated:0, canonicalized:0 };
  const manualById = typeof manualDatabasePlayersById === 'function' ? manualDatabasePlayersById(seed) : new Map();
  const signature = player => typeof manualPlayerCanonicalSignature === 'function'
    ? manualPlayerCanonicalSignature(player)
    : JSON.stringify([player?.name, player?.position, player?.nationality, player?.overall, player?.skills]);
  const canonicalize = player => {
    if(!player || typeof player !== 'object') return player;
    const manual = manualById.get(Number(player.id || 0));
    let refreshed = player;
    if(manual && typeof refreshExistingManualPlayerFromDatabase === 'function') refreshed = refreshExistingManualPlayerFromDatabase(player, manual);
    else if(typeof refreshManualRecycledIdentity === 'function') refreshed = refreshManualRecycledIdentity(player, manualById);
    return signature(player) === signature(refreshed) ? player : refreshed;
  };
  let changed = false;
  let inserted = 0;
  let updated = 0;
  let deduplicated = 0;
  let canonicalized = 0;

  const normalizedMarket = [];
  const marketIndexById = new Map();
  (Array.isArray(players) ? players : []).forEach(rawPlayer => {
    if(!rawPlayer || typeof rawPlayer !== 'object') return;
    const id = Number(rawPlayer.id || 0);
    if(!Number.isFinite(id) || id <= 0) return;
    let next = canonicalize(rawPlayer);
    if(signature(rawPlayer) !== signature(next)) canonicalized += 1;
    if(marketIndexById.has(id)){
      const index = marketIndexById.get(id);
      next = canonicalize({ ...normalizedMarket[index], ...next });
      normalizedMarket[index] = next;
      deduplicated += 1;
      changed = true;
      return;
    }
    marketIndexById.set(id, normalizedMarket.length);
    normalizedMarket.push(next);
  });
  if(Array.isArray(players)){
    const marketChanged = players.length !== normalizedMarket.length || players.some((player,index) => normalizedMarket[index] !== player);
    if(marketChanged){
      players.splice(0, players.length, ...normalizedMarket);
      changed = true;
    }
  }

  const dedupedSeed = [];
  const seedIndexById = new Map();
  seed.players.forEach(rawPlayer => {
    if(!rawPlayer || typeof rawPlayer !== 'object') return;
    const id = Number(rawPlayer.id || 0);
    if(!Number.isFinite(id) || id <= 0) return;
    let next = canonicalize(rawPlayer);
    if(signature(rawPlayer) !== signature(next)) canonicalized += 1;
    if(seedIndexById.has(id)){
      const index = seedIndexById.get(id);
      next = canonicalize({ ...dedupedSeed[index], ...next });
      dedupedSeed[index] = next;
      deduplicated += 1;
      changed = true;
      return;
    }
    seedIndexById.set(id, dedupedSeed.length);
    dedupedSeed.push(next);
  });
  if(seed.players.length !== dedupedSeed.length || seed.players.some((player,index) => dedupedSeed[index] !== player)){
    seed.players = dedupedSeed;
    changed = true;
  }

  normalizedMarket.forEach(incoming => {
    const id = Number(incoming.id || 0);
    const index = seedIndexById.get(id);
    if(!Number.isInteger(index)){
      seedIndexById.set(id, seed.players.length);
      seed.players.push(incoming);
      inserted += 1;
      changed = true;
      return;
    }
    const existing = seed.players[index];
    const mergedRaw = canonicalize({ ...existing, ...incoming });
    const merged = typeof preserveAuthoritativeOwnership === 'function'
      ? preserveAuthoritativeOwnership(existing, incoming, mergedRaw)
      : mergedRaw;
    const before = JSON.stringify(existing);
    const after = JSON.stringify(merged);
    if(before !== after){
      seed.players[index] = merged;
      updated += 1;
      changed = true;
    }
  });
  if(changed && typeof invalidatePlayerIndexes === 'function') invalidatePlayerIndexes();
  return { changed, inserted, updated, deduplicated, canonicalized };
}
