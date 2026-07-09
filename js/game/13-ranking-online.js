/* V4.08 · Ranking online en modo tabla pública. */

function rankingStoredEndpoint(){
  const configured = String(RANKING_APPS_SCRIPT_URL || '').trim();
  if(configured) return configured;
  try{ return localStorage.getItem('fmRankingEndpoint') || ''; }
  catch(_){ return ''; }
}
function rankingStoredManagerName(){
  try{ return (game?.rankingManagerName || localStorage.getItem('fmRankingManagerName') || '').trim(); }
  catch(_){ return (game?.rankingManagerName || '').trim(); }
}
function setRankingStoredEndpoint(value){
  try{ localStorage.setItem('fmRankingEndpoint', String(value || '').trim()); }catch(_){ /* sin almacenamiento */ }
}
function setRankingStoredManagerName(value){
  const clean = String(value || '').trim().slice(0, 40);
  try{ localStorage.setItem('fmRankingManagerName', clean); }catch(_){ /* sin almacenamiento */ }
  if(game) game.rankingManagerName = clean;
  return clean;
}

function rankingCurrentGameDate(){
  if(!game) return '';
  if(validIsoDate(game.currentDate)) return game.currentDate;
  const fallback = dateForSeasonState(game);
  return validIsoDate(fallback) ? fallback : '';
}
function rankingUploadCooldownInfo(){
  return { canUpload:false, elapsed:null, remaining:null, last:validIsoDate(game?.rankingLastUploadGameDate) ? game.rankingLastUploadGameDate : '', current:rankingCurrentGameDate() };
}
function rankingCooldownText(){
  return 'Carga manual bloqueada. El ranking se envía automáticamente al terminar temporada o al ser despedido.';
}

function normalizeRankingEndpoint(url){
  const configured = String(url || '').trim().replace(/\/+$/, '');
  if(configured) return configured;
  return 'https://rankingdemanagers.emanuelastudillo.workers.dev';
}
function rankingConfiguredPaths(kind){
  const cfg = (window.GAME_CONFIG && window.GAME_CONFIG.ranking) ? window.GAME_CONFIG.ranking : {};
  const raw = kind === 'submit' ? cfg.submitPaths : cfg.readPaths;
  const fallback = kind === 'submit' ? ['records','ranking'] : ['ranking','records'];
  const source = Array.isArray(raw) && raw.length ? raw : fallback;
  const seen = new Set();
  return source
    .map(path => String(path || '').trim().replace(/^\/+|\/+$/g, ''))
    .filter(path => {
      if(seen.has(path)) return false;
      seen.add(path);
      return true;
    });
}
function rankingApiUrl(endpoint, path, query=''){
  const base = normalizeRankingEndpoint(endpoint);
  const cleanPath = String(path || '').trim().replace(/^\/+|\/+$/g, '');
  const suffix = cleanPath ? `/${cleanPath}` : '';
  return `${base}${suffix}${query || ''}`;
}
function rankingStoredAuthToken(){
  const configured = String(RANKING_TOKEN || '').trim();
  if(configured) return configured;
  try{
    return String(localStorage.getItem('fmRankingAuthToken') || localStorage.getItem('fmRankingToken') || localStorage.getItem('rankingToken') || '').trim();
  }catch(_){ return ''; }
}
function rankingRequestHeaders(json=true){
  const headers = json ? { 'Content-Type':'application/json' } : {};
  const token = rankingStoredAuthToken();
  if(token){
    headers.Authorization = /^Bearer\s+/i.test(token) ? token : `Bearer ${token}`;
  }
  return headers;
}
function rankingResponseErrorMessage(data, response, fallback='Error al conectar con el ranking online.'){
  return String(data?.error || data?.message || data?.detail || (response ? `Error HTTP ${response.status}` : fallback) || fallback);
}
function rankingIsRouteMissing(message, response){
  return Number(response?.status || 0) === 404 || /ruta no encontrada|route not found|not found|no encontrado/i.test(String(message || ''));
}
const RANKING_AUTO_EVENT_LABELS = {
  season_end:'Temporada finalizada',
  dismissal:'Manager despedido',
  season_snapshot:'Resumen automático'
};
function rankingEventLabel(eventType){
  return RANKING_AUTO_EVENT_LABELS[String(eventType || '')] || 'Resumen automático';
}
function rankingSubmissionKey(payload, eventType=payload?.eventType || 'season_snapshot'){
  const event = String(eventType || 'season_snapshot');
  return `${payload?.saveCode || 'FM'}-T${payload?.season || 1}-C${payload?.clubId || 0}-${event}`;
}
function rankingSeasonInitialBudget(season){
  if(!game) return 0;
  const seasonNumber = Number(season || game.seasonNumber || 1);
  const explicit = Number(game.seasonBudgetStartBySeason?.[seasonNumber]);
  if(Number.isFinite(explicit)) return Math.max(0, Math.round(explicit));
  if(Number.isFinite(Number(game.seasonInitialBudget))) return Math.max(0, Math.round(Number(game.seasonInitialBudget)));
  const first = (game.budgetHistory || []).find(entry => Number(entry.season || seasonNumber) === seasonNumber && Number.isFinite(Number(entry.budget)));
  if(first) return Math.max(0, Math.round(Number(first.budget || 0) - Number(first.delta || 0)));
  return Math.max(0, Math.round(Number(game.budget || 0)));
}
function rankingCurrentSeasonRecord(){
  if(!game) return null;
  const transitionRecord = game.seasonTransition?.userRecord;
  if(transitionRecord) return { ...transitionRecord };
  const division = clubDivision(game.selectedClubId);
  const table = sortedStandings(division.id);
  const index = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId));
  const row = table[index] || game.standings?.[game.selectedClubId] || {};
  const position = index >= 0 ? index + 1 : null;
  return {
    season: game.seasonNumber || 1,
    clubId: game.selectedClubId,
    clubName: clubName(game.selectedClubId),
    divisionId: division.id,
    divisionName: division.name,
    position,
    pts: Number(row.pts || 0),
    pg: Number(row.pg || 0),
    pe: Number(row.pe || 0),
    pp: Number(row.pp || 0),
    gf: Number(row.gf || 0),
    gc: Number(row.gc || 0),
    title: position === 1
  };
}
function rankingDivisionBonus(record){
  const division = (seed?.divisions || []).find(d => d.id === record?.divisionId || d.name === record?.divisionName || d.name === record?.division);
  const order = Number(division?.order || clubDivision(record?.clubId).order || 1);
  if(order <= 1) return 80;
  if(order === 2) return 35;
  return 10;
}
function rankingPositionBonus(position){
  const pos = Number(position || 0);
  if(!pos) return 0;
  if(pos === 1) return 90;
  if(pos === 2) return 65;
  if(pos === 3) return 45;
  if(pos <= 6) return 25;
  if(pos <= 10) return 10;
  return 0;
}
function rankingBudgetScore(variation){
  const value = Number(variation || 0);
  return clamp(Math.round(value / 1000000), -50, 80);
}
function calculateManagerScore(payload){
  const pts = Number(payload.points || payload.pts || 0);
  const dg = Number(payload.goalDifference || payload.dg || 0);
  const titles = Number(payload.title ? 1 : 0);
  const budgetVariation = Number(payload.budgetVariation || 0);
  const negativePenalty = Number(payload.finalBudget || 0) < 0 ? -50 : 0;
  return Math.round(
    pts +
    rankingDivisionBonus(payload) +
    rankingPositionBonus(payload.position) +
    (titles * 80) +
    (dg * 2) +
    rankingBudgetScore(budgetVariation) +
    negativePenalty
  );
}
function buildRankingPayload(managerName, options={}){
  if(!game) return null;
  options = options && typeof options === 'object' ? options : {};
  const record = rankingCurrentSeasonRecord();
  if(!record) return null;
  const eventType = String(options.eventType || 'season_snapshot');
  const initialBudget = rankingSeasonInitialBudget(record.season);
  const finalBudget = Math.round(Number(game.budget || 0));
  const payload = {
    managerName: String(managerName || '').trim().slice(0, 40),
    clubId: Number(record.clubId || game.selectedClubId),
    club: record.clubName || clubName(game.selectedClubId),
    season: Number(record.season || game.seasonNumber || 1),
    divisionId: record.divisionId || clubDivision(game.selectedClubId).id,
    division: record.divisionName || clubDivision(game.selectedClubId).name,
    divisionOrder: Number(record.divisionOrder || clubDivision(record.clubId || game.selectedClubId).order || 1),
    position: Number(record.position || 0),
    points: Number(record.pts || 0),
    won: Number(record.pg || 0),
    drawn: Number(record.pe || 0),
    lost: Number(record.pp || 0),
    goalsFor: Number(record.gf || 0),
    goalsAgainst: Number(record.gc || 0),
    goalDifference: Number(record.gf || 0) - Number(record.gc || 0),
    initialBudget,
    finalBudget,
    budgetVariation: finalBudget - initialBudget,
    titles: Number(game.managerStats?.titles || 0),
    title: Boolean(record.title),
    submittedAt: new Date().toISOString(),
    gameDate: rankingCurrentGameDate(),
    seasonDay: seasonDayFromDate(rankingCurrentGameDate(), game.seasonYear || seasonYearForNumber(game.seasonNumber || 1)),
    saveCode: game.saveCode || generateSaveCode(),
    version: APP_VERSION,
    eventType,
    eventLabel: rankingEventLabel(eventType)
  };
  payload.managerScore = calculateManagerScore(payload);
  payload.submissionKey = rankingSubmissionKey(payload, eventType);
  return payload;
}
function rankingValue(row, ...keys){
  for(const key of keys){
    if(row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function rankingApiRowToGameRow(row){
  if(!row) return row;
  const mapped = { ...row };
  mapped.managerName = rankingValue(row, 'managerName', 'manager_name', 'manager');
  mapped.club = rankingValue(row, 'club', 'club_name', 'club_usado');
  mapped.division = rankingValue(row, 'division', 'division_name');
  mapped.season = rankingValue(row, 'season', 'temporada');
  mapped.points = rankingValue(row, 'matchPoints', 'match_points', 'pts', 'puntos', 'points');
  mapped.managerScore = rankingValue(row, 'managerScore', 'manager_score', 'puntaje_manager', 'points');
  mapped.initialBudget = rankingValue(row, 'initialBudget', 'initial_budget', 'presupuesto_inicial');
  mapped.finalBudget = rankingValue(row, 'finalBudget', 'final_budget', 'presupuesto_final');
  mapped.budgetVariation = rankingValue(row, 'budgetVariation', 'budget_variation', 'variacion_presupuesto');
  mapped.titles = rankingValue(row, 'titles', 'titulos');
  mapped.submittedAt = rankingValue(row, 'submittedAt', 'submitted_at', 'created_at', 'fecha_envio');
  mapped.saveCode = rankingValue(row, 'saveCode', 'save_code', 'codigo_partida');
  mapped.version = rankingValue(row, 'version', 'game_version');
  mapped.eventType = rankingValue(row, 'eventType', 'event_type', 'evento_tipo');
  mapped.eventLabel = rankingValue(row, 'eventLabel', 'event_label', 'evento');
  return mapped;
}
function rankingPayloadToApiBody(payload){
  const body = {
    manager_name: payload.managerName,
    club_name: payload.club,
    season: payload.season,
    division: payload.division,
    points: payload.managerScore,
    titles: payload.titles,
    initial_budget: payload.initialBudget,
    final_budget: payload.finalBudget,
    game_version: payload.version || APP_VERSION,
    event_type: payload.eventType || 'season_snapshot',
    event_label: payload.eventLabel || rankingEventLabel(payload.eventType),
    save_code: payload.saveCode || '',
    position: payload.position,
    match_points: payload.points,
    won: payload.won,
    drawn: payload.drawn,
    lost: payload.lost,
    goals_for: payload.goalsFor,
    goals_against: payload.goalsAgainst,
    goal_difference: payload.goalDifference,
    budget_variation: payload.budgetVariation
  };
  if(String(RANKING_TOKEN || '').trim()) body.token = String(RANKING_TOKEN).trim();
  return body;
}
function normalizeRankingRow(row){
  row = rankingApiRowToGameRow(row);
  const normalized = {
    managerName: String(rankingValue(row, 'managerName', 'Nombre del manager', 'nombre_manager', 'manager') || '').trim(),
    club: String(rankingValue(row, 'club', 'Club usado', 'club_usado') || '').trim(),
    season: Number(rankingValue(row, 'season', 'Temporada', 'temporada') || 0),
    division: String(rankingValue(row, 'division', 'División', 'division') || '').trim(),
    position: Number(rankingValue(row, 'position', 'Posición final', 'posicion_final') || 0),
    points: Number(rankingValue(row, 'points', 'Puntos', 'puntos') || 0),
    won: Number(rankingValue(row, 'won', 'Partidos ganados', 'ganados') || 0),
    drawn: Number(rankingValue(row, 'drawn', 'Partidos empatados', 'empatados') || 0),
    lost: Number(rankingValue(row, 'lost', 'Partidos perdidos', 'perdidos') || 0),
    goalsFor: Number(rankingValue(row, 'goalsFor', 'Goles a favor', 'gf', 'goals_for') || 0),
    goalsAgainst: Number(rankingValue(row, 'goalsAgainst', 'Goles en contra', 'gc', 'goals_against') || 0),
    goalDifference: Number(rankingValue(row, 'goalDifference', 'Diferencia de gol', 'dg', 'goal_difference') || 0),
    initialBudget: Number(rankingValue(row, 'initialBudget', 'Presupuesto inicial', 'presupuesto_inicial') || 0),
    finalBudget: Number(rankingValue(row, 'finalBudget', 'Presupuesto final', 'presupuesto_final') || 0),
    budgetVariation: Number(rankingValue(row, 'budgetVariation', 'Variación de presupuesto', 'variacion_presupuesto') || 0),
    titles: Number(rankingValue(row, 'titles', 'Cantidad de títulos', 'titulos') || 0),
    submittedAt: String(rankingValue(row, 'submittedAt', 'Fecha de envío', 'fecha_envio') || '').trim(),
    saveCode: String(rankingValue(row, 'saveCode', 'Código de partida', 'codigo_partida') || '').trim(),
    managerScore: Number(rankingValue(row, 'managerScore', 'Puntaje manager', 'puntaje_manager') || 0),
    eventType: String(rankingValue(row, 'eventType', 'evento_tipo') || '').trim(),
    eventLabel: String(rankingValue(row, 'eventLabel', 'evento') || '').trim()
  };
  if(!normalized.budgetVariation && normalized.finalBudget && normalized.initialBudget) normalized.budgetVariation = normalized.finalBudget - normalized.initialBudget;
  if(!normalized.managerScore) normalized.managerScore = calculateManagerScore(normalized);
  if(!normalized.eventLabel) normalized.eventLabel = rankingEventLabel(normalized.eventType || 'season_snapshot');
  return normalized;
}
function sortRankingRows(rows, sortKey=rankingSort){
  const [key, dir='desc'] = String(sortKey || '').split('_');
  const direction = dir === 'asc' ? 1 : -1;
  const getter = {
    managerScore: row => Number(row.managerScore || 0),
    division: row => String(row.division || ''),
    club: row => String(row.club || ''),
    points: row => Number(row.points || 0),
    finalBudget: row => Number(row.finalBudget || 0)
  }[key] || (row => Number(row.managerScore || 0));
  return rows.slice().sort((a,b)=>{
    const av = getter(a);
    const bv = getter(b);
    if(typeof av === 'string' || typeof bv === 'string'){
      const cmp = String(av).localeCompare(String(bv), 'es', { sensitivity:'base' });
      return cmp * direction || Number(b.managerScore || 0) - Number(a.managerScore || 0);
    }
    return ((av > bv ? 1 : av < bv ? -1 : 0) * direction) || Number(b.managerScore || 0) - Number(a.managerScore || 0);
  });
}
function rankingSortButton(key, label){
  const isActive = String(rankingSort || '').startsWith(`${key}_`);
  const currentDir = isActive ? String(rankingSort).split('_')[1] : 'desc';
  const nextDir = isActive && currentDir === 'desc' ? 'asc' : 'desc';
  const arrow = isActive ? (currentDir === 'asc' ? '↑' : '↓') : '';
  return `<button class="ranking-sort ${isActive ? 'active' : ''}" data-ranking-sort="${escapeHtml(key)}_${nextDir}" type="button">${escapeHtml(label)} ${arrow}</button>`;
}
function rankingRowMarkup(row, index){
  const budgetCls = Number(row.budgetVariation || 0) >= 0 ? 'ok' : 'bad';
  return `<tr>
    <td><strong>${index + 1}</strong></td>
    <td><strong>${escapeHtml(row.managerName || 'Manager')}</strong><br><span class="muted small">${escapeHtml(row.saveCode || '')}</span></td>
    <td>${escapeHtml(row.club || '—')}</td>
    <td>${escapeHtml(row.division || '—')}</td>
    <td>${Number(row.season || 0) || '—'}</td>
    <td>${row.position ? `${row.position}°` : '—'}</td>
    <td>${escapeHtml(row.eventLabel || rankingEventLabel(row.eventType || 'season_snapshot'))}</td>
    <td><strong>${Number(row.managerScore || 0)}</strong></td>
    <td>${Number(row.points || 0)}</td>
    <td>${Number(row.won || 0)}-${Number(row.drawn || 0)}-${Number(row.lost || 0)}</td>
    <td>${Number(row.goalDifference || 0) > 0 ? '+' : ''}${Number(row.goalDifference || 0)}</td>
    <td>${formatMoney(Number(row.finalBudget || 0))}<br><span class="${budgetCls} small">${Number(row.budgetVariation || 0) >= 0 ? '+' : ''}${formatMoney(Number(row.budgetVariation || 0))}</span></td>
  </tr>`;
}
function rankingRowsTable(rows){
  const sorted = sortRankingRows(rows).slice(0, RANKING_PAGE_SIZE);
  return `<div class="ranking-sortbar">
    ${rankingSortButton('managerScore','Puntaje')}
    ${rankingSortButton('division','División')}
    ${rankingSortButton('club','Club')}
    ${rankingSortButton('points','Puntos')}
    ${rankingSortButton('finalBudget','Presupuesto final')}
  </div>
  <div class="table-wrap ranking-table-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Manager</th><th>Club</th><th>División</th><th>Temp.</th><th>Pos.</th><th>Evento</th><th>Puntaje</th><th>Pts</th><th>G-E-P</th><th>DG</th><th>Presupuesto final</th></tr></thead><tbody>${sorted.length ? sorted.map(rankingRowMarkup).join('') : '<tr><td colspan="12" class="muted">Todavía no hay registros cargados.</td></tr>'}</tbody></table></div>`;
}
function rankingSeasonPreviewMarkup(payload){
  if(!payload) return '<p class="muted">No hay partida activa para calcular una temporada.</p>';
  return `<div class="ranking-preview-grid">
    <div><span>Manager</span><strong>${escapeHtml(payload.managerName || 'Manager')}</strong></div>
    <div><span>Evento previsto</span><strong>${escapeHtml(payload.eventLabel || rankingEventLabel(payload.eventType))}</strong></div>
    <div><span>Club</span><strong>${escapeHtml(payload.club)}</strong></div>
    <div><span>División</span><strong>${escapeHtml(payload.division)}</strong></div>
    <div><span>Posición</span><strong>${payload.position ? `${payload.position}°` : '—'}</strong></div>
    <div><span>Puntos</span><strong>${payload.points}</strong></div>
    <div><span>Presupuesto inicial</span><strong>${formatMoney(payload.initialBudget)}</strong></div>
    <div><span>Presupuesto final</span><strong>${formatMoney(payload.finalBudget)}</strong></div>
    <div><span>Variación</span><strong class="${payload.budgetVariation >= 0 ? 'ok' : 'bad'}">${payload.budgetVariation >= 0 ? '+' : ''}${formatMoney(payload.budgetVariation)}</strong></div>
    <div><span>Puntaje manager</span><strong>${payload.managerScore}</strong></div>
  </div>`;
}
function rankingEndpointPanelMarkup(endpoint){
  return '';
}
function rankingUploadEntries(){
  const uploads = game?.rankingUploads && typeof game.rankingUploads === 'object' && !Array.isArray(game.rankingUploads) ? game.rankingUploads : {};
  return Object.entries(uploads).map(([key, value]) => ({ key, ...(value || {}) })).sort((a,b)=> String(b.submittedAt || b.attemptedAt || '').localeCompare(String(a.submittedAt || a.attemptedAt || '')));
}
function rankingAutomaticStatusMarkup(){
  if(!game) return '<p class="small muted">No hay partida activa.</p>';
  const entries = rankingUploadEntries();
  if(!entries.length) return '<p class="small muted">Todavía no hay envíos automáticos registrados en esta partida.</p>';
  const latest = entries[0];
  const statusText = latest.status === 'success' ? 'Enviado' : latest.status === 'pending' ? 'Pendiente' : latest.status === 'error' ? 'Error' : 'Registrado';
  const statusClass = latest.status === 'success' ? 'ok' : latest.status === 'error' ? 'bad' : 'warn';
  return `<div class="ranking-auto-status">
    <p class="small muted">Último evento automático</p>
    <p><strong>${escapeHtml(latest.eventLabel || rankingEventLabel(latest.eventType))}</strong> · <span class="${statusClass}">${escapeHtml(statusText)}</span></p>
    <p class="small muted">${escapeHtml(latest.club || '')}${latest.season ? ` · Temporada ${Number(latest.season)}` : ''}${latest.error ? ` · ${escapeHtml(latest.error)}` : ''}</p>
  </div>`;
}
function rankingSubmitPanelMarkup(payload, endpoint){
  return `<div class="card ranking-submit-card">
    <div class="row"><div><p class="label">Carga automática</p><h3>Envío manual bloqueado</h3></div><span class="pill">${game ? `Temp. ${game.seasonNumber || 1}` : 'Sin partida'}</span></div>
    <p class="muted">El ranking se sube automáticamente cuando el manager es despedido o cuando se cierra una temporada. La pantalla queda sólo para consultar la tabla online.</p>
    ${endpoint ? '<p class="small muted">Endpoint configurado correctamente.</p>' : '<p class="small muted">Ranking online no disponible por el momento.</p>'}
    ${rankingAutomaticStatusMarkup()}
    ${rankingSeasonPreviewMarkup(payload)}
  </div>`;
}
function renderRankingOnline(){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  view.innerHTML = `<div class="section-title"><h2>${escapeHtml(RANKING_NAME)}</h2><p class="tagline">Tabla comunitaria online. Se muestran hasta ${RANKING_PAGE_SIZE} registros con los filtros actuales.</p></div>
    <div class="card ranking-list-card">
      <div class="row"><div><p class="label">Lectura pública</p><h3>Tabla online</h3></div><button id="refreshRanking" class="ghost" type="button">Actualizar ranking</button></div>
      <div id="rankingStatus" class="small muted">${endpoint ? `Listo para cargar hasta ${RANKING_PAGE_SIZE} registros.` : 'Ranking online no disponible por el momento.'}</div>
      <div id="rankingTableBox">${rankingRowsTable(rankingRowsCache)}</div>
    </div>`;
  $('refreshRanking')?.addEventListener('click', loadRankingOnline);
  document.querySelectorAll('[data-ranking-sort]').forEach(btn => btn.addEventListener('click', () => {
    rankingSort = btn.dataset.rankingSort;
    renderRankingOnline();
  }));
  if(endpoint && !rankingRowsCache.length && !rankingLoading){
    setTimeout(() => loadRankingOnline(true), 0);
  }
}
function validateRankingSubmit(payload, managerName, endpoint, options={}){
  if(!game) return 'No hay partida activa.';
  if(!endpoint) return 'Ranking online no disponible por el momento.';
  if(!managerName) return 'Ingresá un nombre de manager.';
  if(!payload?.position) return 'No se pudo calcular la posición actual.';
  if(options?.automatic){
    const previous = game.rankingUploads?.[payload.submissionKey];
    if(previous?.status === 'success' && !options.forceRetry) return 'Este evento ya fue enviado al ranking.';
    if(previous?.status === 'pending' && !options.forceRetry){
      const attemptedAt = Date.parse(previous.attemptedAt || 0);
      if(Number.isFinite(attemptedAt) && Date.now() - attemptedAt < 15000) return 'Este evento ya está pendiente de envío.';
    }
    return '';
  }
  return rankingCooldownText();
}
function submitCurrentSeasonToRanking(){
  showNotice(rankingCooldownText());
}
function rankingRecordUploadState(payload, status, extra={}){
  if(!game || !payload?.submissionKey) return;
  game.rankingUploads = game.rankingUploads && typeof game.rankingUploads === 'object' && !Array.isArray(game.rankingUploads) ? game.rankingUploads : {};
  const previous = game.rankingUploads[payload.submissionKey] || {};
  game.rankingUploads[payload.submissionKey] = {
    ...previous,
    status,
    eventType:payload.eventType || previous.eventType || 'season_snapshot',
    eventLabel:payload.eventLabel || previous.eventLabel || rankingEventLabel(payload.eventType),
    managerName:payload.managerName || previous.managerName || 'Manager',
    club:payload.club || previous.club || '',
    season:Number(payload.season || previous.season || 1),
    managerScore:Number(payload.managerScore || previous.managerScore || 0),
    gameDate:payload.gameDate || previous.gameDate || '',
    attemptedAt:extra.attemptedAt || previous.attemptedAt || new Date().toISOString(),
    submittedAt: status === 'success' ? (extra.submittedAt || payload.submittedAt || new Date().toISOString()) : (previous.submittedAt || ''),
    error: status === 'error' ? String(extra.error || '') : '',
    payload:{ ...payload }
  };
}
function submitRankingAutomatically(eventType='season_end', options={}){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const managerName = rankingStoredManagerName() || storedManagerName() || 'Manager';
  const payload = buildRankingPayload(managerName, { ...options, eventType });
  const error = validateRankingSubmit(payload, managerName, endpoint, { automatic:true });
  if(error){
    if(!/ya fue enviado|pendiente/.test(error) && options.notifyErrors) showNotice(error);
    return false;
  }
  rankingRecordUploadState(payload, 'pending', { attemptedAt:new Date().toISOString() });
  saveLocal(true);
  submitRankingToCloudflare(endpoint, payload, {
    onSuccess: () => {
      rankingRecordUploadState(payload, 'success', { submittedAt:new Date().toISOString() });
      game.rankingLastUploadGameDate = payload.gameDate || rankingCurrentGameDate();
      rankingRowsCache = [normalizeRankingRow(payload)].concat(rankingRowsCache.filter(row => row.saveCode !== payload.saveCode || Number(row.season) !== Number(payload.season) || row.eventType !== payload.eventType));
      if(typeof pushGameMessage === 'function'){
        pushGameMessage({ type:'sistema', priority:'normal', title:'Ranking actualizado', body:`${payload.eventLabel} enviado automáticamente al ranking online.`, id:`ranking-auto-ok-${payload.submissionKey}` });
      }
      saveLocal(true);
      if(activeTab === 'ranking') renderRankingOnline();
    },
    onError: (message) => {
      rankingRecordUploadState(payload, 'error', { error:message || 'Error al conectar con el ranking online.' });
      if(typeof pushGameMessage === 'function'){
        pushGameMessage({ type:'sistema', priority:'normal', title:'Ranking no enviado', body:`No se pudo enviar automáticamente el evento ${payload.eventLabel}: ${message || 'error de conexión'}.`, id:`ranking-auto-error-${payload.submissionKey}-${Date.now()}` });
      }
      saveLocal(true);
      if(activeTab === 'ranking') renderRankingOnline();
    }
  });
  return true;
}
async function submitRankingToCloudflare(endpoint, payload, handlers={}){
  const paths = rankingConfiguredPaths('submit');
  const apiBody = rankingPayloadToApiBody(payload);
  const requestBodies = [
    { label:'json', headers:rankingRequestHeaders(true), body:JSON.stringify(apiBody) },
    { label:'payload', headers:{ ...rankingRequestHeaders(false), 'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8' }, body:new URLSearchParams({ action:'submit', payload:JSON.stringify({ ...payload, ...apiBody }), token:String(RANKING_TOKEN || '') }).toString() }
  ];
  let lastMessage = '';
  for(let i = 0; i < paths.length; i++){
    const path = paths[i];
    for(let j = 0; j < requestBodies.length; j++){
      const req = requestBodies[j];
      try{
        const response = await fetch(rankingApiUrl(endpoint, path), {
          method:'POST',
          headers:req.headers,
          body:req.body
        });
        const data = await response.json().catch(() => ({}));
        if(!response.ok || data.ok === false){
          const message = rankingResponseErrorMessage(data, response);
          lastMessage = message;
          if(rankingIsRouteMissing(message, response) && i < paths.length - 1) break;
          if(j < requestBodies.length - 1) continue;
          throw new Error(message);
        }
        handlers.onSuccess?.(data);
        return;
      }catch(error){
        lastMessage = error?.message || lastMessage || 'Error al conectar con el ranking online.';
        if(rankingIsRouteMissing(lastMessage) && i < paths.length - 1) break;
        if(j < requestBodies.length - 1) continue;
        handlers.onError?.(lastMessage);
        return;
      }
    }
  }
  handlers.onError?.(lastMessage || 'No se encontró una ruta válida para subir el ranking.');
}
async function loadRankingOnline(silent=false){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const status = $('rankingStatus');
  if(!endpoint){ if(status) status.textContent = 'Ranking online no disponible por el momento.'; return; }
  if(rankingLoading) return;
  rankingLoading = true;
  if(status) status.textContent = 'Cargando ranking online...';
  let lastMessage = '';
  try{
    const paths = rankingConfiguredPaths('read');
    for(let i = 0; i < paths.length; i++){
      const path = paths[i];
      const response = await fetch(rankingApiUrl(endpoint, path, `?limit=${encodeURIComponent(RANKING_PAGE_SIZE)}`), {
        method:'GET',
        headers:rankingRequestHeaders(false)
      });
      const data = await response.json().catch(() => ({}));
      if(!response.ok || data.ok === false){
        const message = rankingResponseErrorMessage(data, response);
        lastMessage = message;
        if(rankingIsRouteMissing(message, response) && i < paths.length - 1) continue;
        throw new Error(message);
      }
      const rows = Array.isArray(data.ranking) ? data.ranking : Array.isArray(data.rows) ? data.rows : Array.isArray(data.records) ? data.records : [];
      rankingRowsCache = rows.map(normalizeRankingRow).filter(row => row.managerName || row.club || row.saveCode);
      const box = $('rankingTableBox');
      if(box) box.innerHTML = rankingRowsTable(rankingRowsCache);
      if(status) status.textContent = `${rankingRowsCache.length} registro(s) cargado(s).`;
      return;
    }
    throw new Error(lastMessage || 'No se encontró una ruta válida para leer el ranking.');
  }catch(error){
    if(status) status.textContent = 'No se pudo leer el ranking online.';
    if(!silent) showNotice(error?.message || 'No se pudo cargar el ranking online.');
  }finally{
    rankingLoading = false;
  }
}


function retryPendingAutomaticRankingUploads(){
  if(!game?.rankingUploads || typeof submitRankingAutomatically !== 'function') return 0;
  let count = 0;
  Object.values(game.rankingUploads).forEach(entry => {
    if(entry?.status !== 'pending' && entry?.status !== 'error') return;
    if(!['season_end','dismissal'].includes(String(entry.eventType || ''))) return;
    submitRankingAutomatically(entry.eventType, { notifyErrors:false, forceRetry:true });
    count += 1;
  });
  return count;
}
