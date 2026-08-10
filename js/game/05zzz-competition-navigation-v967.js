/* V9.67 · Navegación ordenada de competiciones y estadísticas aisladas por torneo. */
(() => {
  'use strict';

  if(typeof renderStandings !== 'function') return;

  const originalRenderStandingsV967 = renderStandings;
  const originalRenderCompetitionPlayerPalmaresV967 = typeof renderCompetitionPlayerPalmares === 'function' ? renderCompetitionPlayerPalmares : null;
  const originalSyncSidebarNavigationStateV967 = typeof syncSidebarNavigationState === 'function' ? syncSidebarNavigationState : null;

  function managedClubV967(){
    return (seed?.clubs || []).find(club => Number(club?.id || 0) === Number(game?.selectedClubId || 0)) || null;
  }
  function managedCountryV967(){
    const club = managedClubV967();
    return String(club?.country || club?.pais || game?.selectedCountry || '').trim();
  }
  function normalizedCountryV967(value){
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
  }
  function managedDivisionIdV967(){
    return typeof managerCurrentDivisionId === 'function'
      ? String(managerCurrentDivisionId() || '')
      : String(managedClubV967()?.divisionId || game?.selectedLeagueId || '');
  }
  function managedDivisionV967(){
    const id = managedDivisionIdV967();
    return (seed?.divisions || []).find(division => String(division?.id || '') === id) || null;
  }
  function nationalCupConfigV967(){
    return typeof nationalCupConfigForCountry === 'function' ? nationalCupConfigForCountry(managedCountryV967()) : null;
  }
  function continentalKindV967(){
    const country = normalizedCountryV967(managedCountryV967());
    if(['argentina','chile','brasil','brazil'].includes(country)) return 'libertadores';
    if(['inglaterra','england','espana','spain','italia','italy','rumania','romania'].includes(country)) return 'champions-league';
    return '';
  }
  function continentalNameV967(){
    return continentalKindV967() === 'libertadores' ? 'Copa Libertadores' : continentalKindV967() === 'champions-league' ? 'Champions League' : 'Competencia continental';
  }
  function currentCompetitionModeV967(){
    const mode = String(selectedCompetitionView || 'league');
    if(['standings','league'].includes(mode)) return 'league';
    if(['stats','league-stats'].includes(mode)) return 'league-stats';
    if(['national-cups','national-cup'].includes(mode)) return 'national-cup';
    if(mode === 'national-cup-stats') return mode;
    if(['libertadores','champions-league','continental'].includes(mode)) return 'continental';
    if(['continental-qualifiers','continental-stats'].includes(mode)) return mode;
    if(mode === 'club-world-cup' || mode === 'club-world-cup-qualifiers' || mode === 'club-world-cup-stats') return mode;
    if(['club-ranking','rankings','rankings-clubs'].includes(mode)) return 'rankings-clubs';
    if(['player-ranking','rankings-players'].includes(mode)) return 'rankings-players';
    if(['player-palmares','champions','rankings-palmares'].includes(mode)) return 'rankings-palmares';
    return 'league';
  }

  function refreshCompetitionSidebarV967(){
    const league = document.getElementById('navCompetitionLeague');
    const cup = document.getElementById('navCompetitionNationalCup');
    const continental = document.getElementById('navCompetitionContinental');
    const world = document.getElementById('navCompetitionClubWorldCup');
    const rankings = document.getElementById('navCompetitionRankings');
    const leagueName = managedDivisionV967()?.name || 'Liga';
    const cupConfig = nationalCupConfigV967();
    if(league){
      const span = league.querySelector('span');
      if(span) span.textContent = 'Liga';
      league.title = leagueName;
      league.hidden = false;
    }
    if(cup){
      const span = cup.querySelector('span');
      if(span) span.textContent = cupConfig?.name || 'Copa nacional';
      cup.hidden = !cupConfig;
    }
    if(continental){
      const kind = continentalKindV967();
      const span = continental.querySelector('span');
      if(span) span.textContent = continentalNameV967();
      continental.hidden = !kind;
    }
    if(world) world.hidden = false;
    if(rankings) rankings.hidden = false;
  }

  function navigationMarkupV967(active='league'){
    const current = String(active || currentCompetitionModeV967());
    const button = (mode, label, selected) => `<button type="button" data-v967-competition-view="${escapeHtml(mode)}" class="${selected ? 'primary' : 'ghost'}">${escapeHtml(label)}</button>`;
    if(['standings','stats','league','league-stats'].includes(current)){
      const stats = current === 'stats' || current === 'league-stats';
      return `<div class="row competition-controls competition-controls-local">${button('league','Tabla',!stats)}${button('league-stats','Estadísticas',stats)}</div>`;
    }
    if(['national-cups','national-cup','national-cup-stats'].includes(current)){
      const stats = current === 'national-cup-stats';
      return `<div class="row competition-controls competition-controls-local">${button('national-cup','Llave y calendario',!stats)}${button('national-cup-stats','Estadísticas',stats)}</div>`;
    }
    if(['libertadores','champions-league','continental','continental-qualifiers','continental-stats'].includes(current)){
      return `<div class="row competition-controls competition-controls-local">${button('continental','Torneo',current === 'libertadores' || current === 'champions-league' || current === 'continental')}${button('continental-qualifiers','Clasificados',current === 'continental-qualifiers')}${button('continental-stats','Estadísticas',current === 'continental-stats')}</div>`;
    }
    if(['club-world-cup','club-world-cup-qualifiers','club-world-cup-stats'].includes(current)){
      return `<div class="row competition-controls competition-controls-local">${button('club-world-cup','Torneo',current === 'club-world-cup')}${button('club-world-cup-qualifiers','Clasificados',current === 'club-world-cup-qualifiers')}${button('club-world-cup-stats','Estadísticas',current === 'club-world-cup-stats')}</div>`;
    }
    return `<div class="row competition-controls competition-controls-local">${button('rankings-clubs','Clubes',current === 'club-ranking' || current === 'rankings' || current === 'rankings-clubs')}${button('rankings-players','Jugadores',current === 'player-ranking' || current === 'rankings-players')}${button('rankings-palmares','Palmarés',current === 'player-palmares' || current === 'champions' || current === 'rankings-palmares')}</div>`;
  }

  function bindNavigationV967(){
    document.querySelectorAll('[data-v967-competition-view]').forEach(button => {
      button.addEventListener('click', () => {
        selectedCompetitionView = String(button.dataset.v967CompetitionView || 'league');
        activeTab = 'standings';
        renderStandings();
        if(typeof syncSidebarNavigationState === 'function') syncSidebarNavigationState();
      });
    });
  }

  competitionsNavMarkup = navigationMarkupV967;
  bindCompetitionsNav = bindNavigationV967;

  function isLeagueMatchV967(match, divisionId){
    if(!match?.played) return false;
    if(match.friendly || match.nationalCup || match.nationalSupercup || match.libertadores || match.championsLeague || match.clubWorldCup || match.promotionPlayoff || match.playoff) return false;
    return !divisionId || String(match.divisionId || '') === String(divisionId);
  }
  function historyMatchesV967(scope, options={}){
    const history = Array.isArray(game?.matchHistory) ? game.matchHistory : [];
    const divisionId = String(options.divisionId || managedDivisionIdV967());
    const cupId = String(options.cupId || nationalCupConfigV967()?.id || '');
    return history.filter(match => {
      if(scope === 'league') return isLeagueMatchV967(match, divisionId);
      if(scope === 'national-cup') return Boolean(match?.played && match?.nationalCup && (!cupId || String(match.nationalCupId || '') === cupId));
      if(scope === 'libertadores') return Boolean(match?.played && match?.libertadores);
      if(scope === 'champions-league') return Boolean(match?.played && match?.championsLeague);
      if(scope === 'club-world-cup') return Boolean(match?.played && match?.clubWorldCup);
      return false;
    });
  }
  function editionMatchesV967(edition){
    if(!edition) return [];
    const matches = [];
    const add = value => {
      if(Array.isArray(value)) value.forEach(add);
      else if(value && typeof value === 'object' && value.homeId && value.awayId) matches.push(value);
    };
    (edition.groups || []).forEach(group => add(group?.matches || []));
    Object.values(edition.stages || {}).forEach(add);
    add(edition.matches || []);
    const seen = new Set();
    return matches.filter(match => {
      const key = String(match?.id || `${match?.date}-${match?.homeId}-${match?.awayId}`);
      if(seen.has(key)) return false;
      seen.add(key);
      return Boolean(match?.played);
    });
  }
  function playerClubFromMatchV967(match, playerId, fallback=0){
    const id = Number(playerId || 0);
    const home = new Set([...(match?.playedIdsHome || []), ...(match?.starterIdsHome || [])].map(Number));
    const away = new Set([...(match?.playedIdsAway || []), ...(match?.starterIdsAway || [])].map(Number));
    if(home.has(id)) return Number(match.homeId || 0);
    if(away.has(id)) return Number(match.awayId || 0);
    return Number(fallback || playerById(id)?.clubId || 0);
  }
  function aggregateCompetitionStatsV967(matches=[]){
    const rows = new Map();
    const ensure = (playerId, clubId=0) => {
      const id = Number(playerId || 0);
      if(!id) return null;
      if(!rows.has(id)) rows.set(id, { playerId:id, clubId:Number(clubId || playerById(id)?.clubId || 0), played:0, goals:0, assists:0, yellow:0, red:0, injuries:0 });
      const row = rows.get(id);
      if(clubId) row.clubId = Number(clubId);
      return row;
    };
    matches.forEach(match => {
      const homeIds = [...new Set([...(match?.playedIdsHome || []), ...(match?.starterIdsHome || [])].map(Number).filter(Boolean))];
      const awayIds = [...new Set([...(match?.playedIdsAway || []), ...(match?.starterIdsAway || [])].map(Number).filter(Boolean))];
      homeIds.forEach(id => { const row=ensure(id, match.homeId); if(row) row.played += 1; });
      awayIds.forEach(id => { const row=ensure(id, match.awayId); if(row) row.played += 1; });
      (match?.goals || []).forEach(goal => {
        const scorer = Number(goal?.playerId || goal?.scorerId || 0);
        const clubId = Number(goal?.clubId || playerClubFromMatchV967(match, scorer));
        const scorerRow = ensure(scorer, clubId);
        if(scorerRow) scorerRow.goals += 1;
        const assist = Number(goal?.assistId || 0);
        const assistRow = ensure(assist, Number(goal?.clubId || playerClubFromMatchV967(match, assist)));
        if(assistRow) assistRow.assists += 1;
      });
      (match?.cards || []).forEach(card => {
        const id = Number(card?.playerId || 0);
        const row = ensure(id, Number(card?.clubId || playerClubFromMatchV967(match, id)));
        if(!row) return;
        const type = String(card?.type || '');
        if(type === 'yellow') row.yellow += 1;
        if(type === 'secondYellowRed'){ row.yellow += 1; row.red += 1; }
        if(type === 'red') row.red += 1;
      });
      (match?.injuries || []).forEach(injury => {
        const id = Number(injury?.playerId || 0);
        const row = ensure(id, Number(injury?.clubId || playerClubFromMatchV967(match, id)));
        if(row) row.injuries += 1;
      });
    });
    return Array.from(rows.values());
  }
  function competitionStatsMarkupV967(title, matches=[]){
    const stats = aggregateCompetitionStatsV967(matches);
    const scorers = stats.filter(item => item.goals > 0).sort((a,b)=>b.goals-a.goals || b.assists-a.assists).slice(0,20);
    const assists = stats.filter(item => item.assists > 0).sort((a,b)=>b.assists-a.assists || b.goals-a.goals).slice(0,20);
    const cards = stats.filter(item => item.yellow > 0 || item.red > 0).sort((a,b)=>(b.red*3+b.yellow)-(a.red*3+a.yellow)).slice(0,20);
    const injuries = stats.filter(item => item.injuries > 0).sort((a,b)=>b.injuries-a.injuries).slice(0,20);
    return `<div class="card stats-division-block"><div class="row"><div><p class="label">Solo esta competición</p><h3>${escapeHtml(title)}</h3></div><span class="pill">${matches.length} partido(s)</span></div><div class="grid cols-4">
      <div class="card inner"><h3>Goleadores</h3>${rankList(scorers,'goals')}</div>
      <div class="card inner"><h3>Asistidores</h3>${rankList(assists,'assists')}</div>
      <div class="card inner"><h3>Tarjetas</h3>${cardList(cards)}</div>
      <div class="card inner"><h3>Lesiones en partidos</h3>${rankList(injuries,'injuries')}</div>
    </div></div>`;
  }

  function renderLeagueTableV967(){
    const divisionId = managedDivisionIdV967();
    if(!selectedStandingsDivision || selectedStandingsDivision === 'all') selectedStandingsDivision = divisionId;
    const previousMode = selectedCompetitionView;
    selectedCompetitionView = 'standings';
    originalRenderStandingsV967();
    selectedCompetitionView = previousMode === 'standings' ? 'league' : previousMode;
    const filter = document.getElementById('standingsDivisionFilter');
    filter?.querySelector('option[value="all"]')?.remove();
    const title = document.querySelector('.section-title h2');
    if(title) title.textContent = 'Liga';
    const tagline = document.querySelector('.section-title .tagline');
    if(tagline) tagline.textContent = 'Tabla y estadísticas separadas para una sola liga.';
  }
  function renderLeagueStatsV967(){
    const divisionId = String(selectedStandingsDivision && selectedStandingsDivision !== 'all' ? selectedStandingsDivision : managedDivisionIdV967());
    selectedStandingsDivision = divisionId;
    const division = (seed?.divisions || []).find(item => String(item?.id || '') === divisionId);
    view.innerHTML = `<div class="row section-title"><div><h2>Liga</h2><p class="tagline">Las estadísticas no incluyen copas nacionales, torneos internacionales, amistosos ni playoffs.</p></div><div class="row filters-row">${navigationMarkupV967('league-stats')}${divisionFilterMarkup('v967LeagueStatsDivision', divisionId)}</div></div><div class="stack">${competitionStatsMarkupV967(division?.name || 'Liga', historyMatchesV967('league',{ divisionId }))}</div>`;
    document.getElementById('v967LeagueStatsDivision')?.querySelector('option[value="all"]')?.remove();
    bindNavigationV967();
    document.getElementById('v967LeagueStatsDivision')?.addEventListener('change', event => { selectedStandingsDivision = event.target.value; selectedCompetitionView = 'league-stats'; renderStandings(); });
  }

  function cupVerificationMarkupV967(config, edition){
    if(!config || !edition || typeof nationalCupVerificationPhase !== 'function') return '';
    const phase = nationalCupVerificationPhase(config, edition);
    const checkpoint = edition.verification?.checkpoints?.[phase] || null;
    const status = checkpoint?.status === 'ok' ? (checkpoint.repaired ? 'OK · reparado' : 'OK') : phase === 'completed' ? 'OK · finalizada' : phase === 'skipped' ? 'No disputada' : 'Pendiente';
    const tone = status.startsWith('OK') ? 'ok' : status === 'No disputada' ? 'bad' : 'warn';
    return `<div class="card national-cup-verification-card"><div class="row"><div><p class="label">Control por fase</p><h3>${escapeHtml(typeof nationalCupVerificationPhaseLabel === 'function' ? nationalCupVerificationPhaseLabel(config, phase) : phase)}</h3></div><b class="${tone}">${escapeHtml(status)}</b></div><p class="muted small">${checkpoint?.expected ? `${Number(checkpoint.actual || 0)}/${Number(checkpoint.expected || 0)} partidos verificados. ` : ''}Una fase correcta no vuelve a revisarse hasta que cambie su estructura o finalice.</p></div>`;
  }
  function managedSupercupMarkupV967(config, state){
    const key = typeof nationalCupCountryKey === 'function' ? nationalCupCountryKey(config?.country) : normalizedCountryV967(config?.country);
    const item = state?.supercups?.[key];
    if(!item) return '';
    const match = typeof nationalSupercupMatches === 'function' ? nationalSupercupMatches(config.country)?.[0] : null;
    const result = match?.played ? `${clubName(match.homeId)} ${match.homeGoals}-${match.awayGoals} ${clubName(match.awayId)}` : item?.participantClubIds?.length ? `${clubName(item.participantClubIds[0])} vs ${clubName(item.participantClubIds[1])}` : 'Pendiente';
    return `<div class="card"><div class="row"><div><p class="label">Día 300</p><h3>${escapeHtml(item.name || `Supercopa ${config.country}`)}</h3></div><span class="pill">${escapeHtml(item.status || 'pendiente')}</span></div><p>${escapeHtml(result)}</p>${item.championId ? `<p class="muted small">Campeón: ${clubLink(item.championId)}</p>` : ''}</div>`;
  }
  function renderNationalCupV967(statsOnly=false){
    const config = nationalCupConfigV967();
    if(!config){ view.innerHTML = '<div class="card"><p class="muted">El país del club no tiene una copa nacional configurada.</p></div>'; return; }
    const state = typeof ensureNationalCupsState === 'function' ? ensureNationalCupsState() : null;
    const edition = state?.editions?.[config.id] || null;
    const nav = navigationMarkupV967(statsOnly ? 'national-cup-stats' : 'national-cup');
    const content = statsOnly
      ? competitionStatsMarkupV967(config.name, historyMatchesV967('national-cup',{ cupId:config.id }))
      : `${cupVerificationMarkupV967(config, edition)}${typeof nationalCupEditionMarkup === 'function' ? nationalCupEditionMarkup(edition) : ''}${managedSupercupMarkupV967(config, state)}`;
    view.innerHTML = `<div class="row section-title"><div><h2>${escapeHtml(config.name)}</h2><p class="tagline">Llave, calendario y estadísticas exclusivas de la copa del país del club.</p></div>${nav}</div><div class="stack">${content || '<div class="card"><p class="muted">La edición todavía no fue generada.</p></div>'}</div>`;
    bindNavigationV967();
    document.querySelectorAll('[data-match-id]').forEach(element => element.addEventListener('click', () => showMatchModal(element.dataset.matchId)));
  }

  function continentalSelectedV967(kind){
    if(kind === 'libertadores' && typeof libertadoresSelectedEdition === 'function') return libertadoresSelectedEdition();
    if(kind === 'champions-league' && typeof championsLeagueSelectedEdition === 'function') return championsLeagueSelectedEdition();
    return { edition:null, current:true };
  }
  function qualifierMarkupV967(edition, title){
    const sources = Array.isArray(edition?.qualificationSources) ? edition.qualificationSources : [];
    const grouped = sources.reduce((map,item) => {
      const country = String(item?.country || 'Otros');
      if(!map[country]) map[country] = [];
      map[country].push(item);
      return map;
    },{});
    const blocks = Object.entries(grouped).map(([country,items]) => `<div class="card inner"><h3>${escapeHtml(country)}</h3>${items.map(item => `<p class="small"><strong>${clubLink(item.clubId)}</strong><br><span class="muted">${escapeHtml(item.source || 'Clasificado')}</span></p>`).join('')}</div>`).join('');
    return `<div class="card"><div class="row"><div><p class="label">Vías de acceso</p><h3>Clasificados a ${escapeHtml(title)}</h3></div><span class="pill">${sources.length} clubes</span></div><div class="grid cols-3">${blocks || '<p class="muted">La clasificación todavía no fue confirmada.</p>'}</div></div>`;
  }
  function renderContinentalV967(mode='continental'){
    const kind = continentalKindV967();
    if(!kind){ view.innerHTML = '<div class="card"><p class="muted">El club no pertenece a una región con competencia continental disponible.</p></div>'; return; }
    const name = continentalNameV967();
    const selected = continentalSelectedV967(kind);
    const yearFilter = kind === 'libertadores' && typeof libertadoresYearFilterMarkup === 'function' ? libertadoresYearFilterMarkup() : kind === 'champions-league' && typeof championsLeagueYearFilterMarkup === 'function' ? championsLeagueYearFilterMarkup() : '';
    let content = '';
    if(mode === 'continental-qualifiers') content = qualifierMarkupV967(selected.edition, name);
    else if(mode === 'continental-stats'){
      const matches = selected.current ? historyMatchesV967(kind) : editionMatchesV967(selected.edition);
      content = competitionStatsMarkupV967(name, matches);
    }else if(kind === 'libertadores' && typeof libertadoresEditionMarkup === 'function') content = libertadoresEditionMarkup(selected.edition,{ interactive:selected.current });
    else if(kind === 'champions-league' && typeof championsLeagueEditionMarkup === 'function') content = championsLeagueEditionMarkup(selected.edition,{ interactive:selected.current });
    view.innerHTML = `<div class="row section-title"><div><h2>${escapeHtml(name)}</h2><p class="tagline">Torneo, clasificados y estadísticas se consultan por separado.</p></div><div class="row">${yearFilter}${navigationMarkupV967(mode)}</div></div><div class="stack">${content || '<div class="card"><p class="muted">La edición todavía no fue sorteada.</p></div>'}</div>`;
    bindNavigationV967();
    const year = document.getElementById(kind === 'libertadores' ? 'libertadoresYearFilter' : 'championsLeagueYearFilter');
    year?.addEventListener('change', event => {
      if(kind === 'libertadores') selectedLibertadoresYear = event.target.value;
      else selectedChampionsLeagueYear = event.target.value;
      renderStandings();
    });
    document.querySelectorAll('[data-match-id]').forEach(element => element.addEventListener('click', () => showMatchModal(element.dataset.matchId)));
  }

  function renderClubWorldCupV967(mode='club-world-cup'){
    if(typeof ensureClubWorldCupCurrentSeason === 'function') ensureClubWorldCupCurrentSeason({ source:'v967-competition-menu' });
    const selected = typeof selectedClubWorldCupEditionForDisplay === 'function' ? selectedClubWorldCupEditionForDisplay() : { edition:null, current:true };
    let content = '';
    if(mode === 'club-world-cup-qualifiers') content = typeof clubWorldCupQualificationMarkup === 'function' ? clubWorldCupQualificationMarkup(selected.edition) : '';
    else if(mode === 'club-world-cup-stats') content = competitionStatsMarkupV967('Mundial de Clubes', selected.current ? historyMatchesV967('club-world-cup') : editionMatchesV967(selected.edition));
    else content = typeof clubWorldCupEditionMarkup === 'function' ? clubWorldCupEditionMarkup(selected.edition,{ current:selected.current, interactive:selected.current, showStats:false }) : '';
    view.innerHTML = `<div class="row section-title"><div><h2>Mundial de Clubes</h2><p class="tagline">Torneo cuatrienal, clasificación continental y estadísticas propias.</p></div><div class="row">${typeof clubWorldCupYearOptionsMarkup === 'function' ? clubWorldCupYearOptionsMarkup(selectedClubWorldCupYear) : ''}${navigationMarkupV967(mode)}</div></div><div class="stack cwc-edition-view">${content || '<div class="card"><p class="muted">No hay una edición disponible.</p></div>'}</div>`;
    bindNavigationV967();
    if(typeof bindClubWorldCupYearFilter === 'function') bindClubWorldCupYearFilter(renderStandings);
    document.querySelectorAll('[data-match-id]').forEach(element => element.addEventListener('click', () => showMatchModal(element.dataset.matchId)));
  }

  function championsHistoryMarkupV967(){
    const entries = typeof competitionChampionsHistoryEntries === 'function' ? competitionChampionsHistoryEntries().slice(0,80) : [];
    const rows = entries.map(entry => `<tr><td>${Number(entry.year || 0)}</td><td>${escapeHtml(entry.competitionName || '')}</td><td>${clubLink(entry.championId)}</td><td>${entry.runnerUpId ? clubLink(entry.runnerUpId) : '—'}</td></tr>`).join('');
    return `<div class="card"><div class="row"><div><p class="label">Historial global</p><h3>Campeones por competición</h3></div><span class="pill">${entries.length} registros</span></div><div class="table-wrap"><table><thead><tr><th>Año</th><th>Competición</th><th>Campeón</th><th>Subcampeón</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Todavía no hay campeones registrados.</td></tr>'}</tbody></table></div></div>`;
  }
  if(originalRenderCompetitionPlayerPalmaresV967){
    renderCompetitionPlayerPalmares = function(){
      originalRenderCompetitionPlayerPalmaresV967();
      if(['rankings-palmares','player-palmares','champions'].includes(String(selectedCompetitionView || ''))){
        const title = document.querySelector('.competition-player-palmares-title');
        if(title && !document.querySelector('[data-v967-champions-history]')) title.insertAdjacentHTML('afterend', `<div data-v967-champions-history>${championsHistoryMarkupV967()}</div>`);
      }
    };
  }

  function renderRankingsV967(mode='rankings-clubs'){
    if(mode === 'rankings-players'){
      selectedCompetitionView = 'rankings-players';
      renderCompetitionPlayerRanking();
      return;
    }
    if(mode === 'rankings-palmares'){
      selectedCompetitionView = 'rankings-palmares';
      renderCompetitionPlayerPalmares();
      return;
    }
    selectedCompetitionView = 'rankings-clubs';
    if(typeof renderClubFifaRanking === 'function') renderClubFifaRanking();
    else view.innerHTML = '<div class="card"><p class="muted">El ranking de clubes no está disponible.</p></div>';
  }

  renderStandings = function(){
    refreshCompetitionSidebarV967();
    const mode = currentCompetitionModeV967();
    if(mode === 'league') return renderLeagueTableV967();
    if(mode === 'league-stats') return renderLeagueStatsV967();
    if(mode === 'national-cup') return renderNationalCupV967(false);
    if(mode === 'national-cup-stats') return renderNationalCupV967(true);
    if(['continental','continental-qualifiers','continental-stats'].includes(mode)) return renderContinentalV967(mode);
    if(['club-world-cup','club-world-cup-qualifiers','club-world-cup-stats'].includes(mode)) return renderClubWorldCupV967(mode);
    return renderRankingsV967(mode);
  };

  renderStats = function(){
    activeTab = 'standings';
    selectedCompetitionView = 'league-stats';
    renderStandings();
  };

  if(originalSyncSidebarNavigationStateV967){
    syncSidebarNavigationState = function(){
      refreshCompetitionSidebarV967();
      return originalSyncSidebarNavigationStateV967();
    };
  }

  window.competitionNavigationV967 = {
    refresh:refreshCompetitionSidebarV967,
    aggregate:aggregateCompetitionStatsV967,
    matches:historyMatchesV967
  };
})();
