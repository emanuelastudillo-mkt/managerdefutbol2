/* V3.17 · Ranking online con carga durante la temporada y cooldown. */

function rankingStoredEndpoint(){
  try{ return localStorage.getItem('fmRankingEndpoint') || RANKING_APPS_SCRIPT_URL || ''; }
  catch(_){ return RANKING_APPS_SCRIPT_URL || ''; }
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
  const last = validIsoDate(game?.rankingLastUploadGameDate) ? game.rankingLastUploadGameDate : '';
  const current = rankingCurrentGameDate();
  if(!last || !current || RANKING_UPLOAD_COOLDOWN_DAYS <= 0) return { canUpload:true, elapsed:null, remaining:0, last, current };
  const elapsed = Math.max(0, daysBetweenIsoDates(last, current));
  const remaining = Math.max(0, Math.ceil(RANKING_UPLOAD_COOLDOWN_DAYS - elapsed));
  return { canUpload:remaining <= 0, elapsed, remaining, last, current };
}
function rankingCooldownText(info=rankingUploadCooldownInfo()){
  if(!info?.last) return 'Primer envío disponible.';
  if(info.canUpload) return 'Envío disponible.';
  return `Próximo envío disponible en ${info.remaining} día(s).`;
}

function normalizeRankingEndpoint(url){
  const clean = String(url || '').trim();
  if(!clean) return '';
  return /^https:\/\/script\.google\.com\//.test(clean) || /^https:\/\/script\.googleusercontent\.com\//.test(clean) ? clean : clean;
}
function rankingSubmissionKey(payload){
  return `${payload.saveCode || 'FM'}-T${payload.season || 1}`;
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
function buildRankingPayload(managerName){
  if(!game) return null;
  const record = rankingCurrentSeasonRecord();
  if(!record) return null;
  const initialBudget = rankingSeasonInitialBudget(record.season);
  const finalBudget = Math.max(0, Math.round(Number(game.budget || 0)));
  const payload = {
    managerName: String(managerName || '').trim().slice(0, 40),
    clubId: Number(record.clubId || game.selectedClubId),
    club: record.clubName || clubName(game.selectedClubId),
    season: Number(record.season || game.seasonNumber || 1),
    divisionId: record.divisionId || clubDivision(game.selectedClubId).id,
    division: record.divisionName || clubDivision(game.selectedClubId).name,
    divisionOrder: Number(clubDivision(record.clubId || game.selectedClubId).order || 1),
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
    version: APP_VERSION
  };
  payload.managerScore = calculateManagerScore(payload);
  payload.submissionKey = rankingSubmissionKey(payload);
  return payload;
}
function rankingValue(row, ...keys){
  for(const key of keys){
    if(row && row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}
function normalizeRankingRow(row){
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
    goalsFor: Number(rankingValue(row, 'goalsFor', 'Goles a favor', 'gf') || 0),
    goalsAgainst: Number(rankingValue(row, 'goalsAgainst', 'Goles en contra', 'gc') || 0),
    goalDifference: Number(rankingValue(row, 'goalDifference', 'Diferencia de gol', 'dg') || 0),
    initialBudget: Number(rankingValue(row, 'initialBudget', 'Presupuesto inicial', 'presupuesto_inicial') || 0),
    finalBudget: Number(rankingValue(row, 'finalBudget', 'Presupuesto final', 'presupuesto_final') || 0),
    budgetVariation: Number(rankingValue(row, 'budgetVariation', 'Variación de presupuesto', 'variacion_presupuesto') || 0),
    titles: Number(rankingValue(row, 'titles', 'Cantidad de títulos', 'titulos') || 0),
    submittedAt: String(rankingValue(row, 'submittedAt', 'Fecha de envío', 'fecha_envio') || '').trim(),
    saveCode: String(rankingValue(row, 'saveCode', 'Código de partida', 'codigo_partida') || '').trim(),
    managerScore: Number(rankingValue(row, 'managerScore', 'Puntaje manager', 'puntaje_manager') || 0)
  };
  if(!normalized.managerScore) normalized.managerScore = calculateManagerScore(normalized);
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
  <div class="table-wrap ranking-table-wrap"><table class="ranking-table"><thead><tr><th>#</th><th>Manager</th><th>Club</th><th>División</th><th>Temp.</th><th>Pos.</th><th>Puntaje</th><th>Pts</th><th>G-E-P</th><th>DG</th><th>Presupuesto final</th></tr></thead><tbody>${sorted.length ? sorted.map(rankingRowMarkup).join('') : '<tr><td colspan="11" class="muted">Todavía no hay registros cargados.</td></tr>'}</tbody></table></div>`;
}
function rankingSeasonPreviewMarkup(payload){
  if(!payload) return '<p class="muted">No hay partida activa para calcular una temporada.</p>';
  return `<div class="ranking-preview-grid">
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
function rankingSubmitPanelMarkup(payload, endpoint){
  const managerName = rankingStoredManagerName();
  const cooldown = rankingUploadCooldownInfo();
  const canSubmit = Boolean(game && endpoint && payload && cooldown.canUpload);
  const disabledReason = !game ? 'Necesitás una partida para subir resultados.'
    : !endpoint ? 'Ranking online no disponible por el momento.'
    : !cooldown.canUpload ? rankingCooldownText(cooldown)
    : '';
  return `<div class="card ranking-submit-card">
    <div class="row"><div><p class="label">Subir resultado</p><h3>Resultado para el ranking</h3></div><span class="pill">${game ? `Temp. ${game.seasonNumber || 1}` : 'Sin partida'}</span></div>
    <label for="rankingManagerName">Nombre del manager</label>
    <div class="ranking-manager-row">
      <input id="rankingManagerName" maxlength="40" placeholder="Ej: Emanuel" value="${escapeHtml(managerName)}">
      <button id="submitRankingSeason" class="primary" type="button" ${canSubmit ? '' : 'disabled'}>Subir temporada al ranking</button>
    </div>
    ${disabledReason ? `<p class="small muted">${escapeHtml(disabledReason)}</p>` : '<p class="small muted">Se enviará una copia resumida del estado actual de la temporada. No se sube la partida completa.</p>'}
    ${game ? `<p class="small muted">${escapeHtml(rankingCooldownText(cooldown))}</p>` : ''}
    ${rankingSeasonPreviewMarkup(payload)}
  </div>`;
}
function renderRankingOnline(){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const payload = game ? buildRankingPayload(rankingStoredManagerName() || 'Manager') : null;
  view.innerHTML = `<div class="section-title"><h2>${escapeHtml(RANKING_NAME)}</h2><p class="tagline">Tabla comunitaria. Podés subir resultados durante la temporada con cooldown entre envíos.</p></div>
    <div class="ranking-layout">
      <div>${rankingSubmitPanelMarkup(payload, endpoint)}</div>
      <div class="card ranking-list-card">
        <div class="row"><div><p class="label">Lectura pública</p><h3>Tabla online</h3></div><button id="refreshRanking" class="ghost" type="button">Actualizar ranking</button></div>
        <div id="rankingStatus" class="small muted">${endpoint ? 'Listo para cargar registros.' : 'Ranking online no disponible por el momento.'}</div>
        <div id="rankingTableBox">${rankingRowsTable(rankingRowsCache)}</div>
      </div>
    </div>`;
  $('rankingManagerName')?.addEventListener('input', event => {
    setRankingStoredManagerName(event.target.value || '');
  });
  $('submitRankingSeason')?.addEventListener('click', submitCurrentSeasonToRanking);
  $('refreshRanking')?.addEventListener('click', loadRankingOnline);
  document.querySelectorAll('[data-ranking-sort]').forEach(btn => btn.addEventListener('click', () => {
    rankingSort = btn.dataset.rankingSort;
    renderRankingOnline();
  }));
  if(endpoint && !rankingRowsCache.length && !rankingLoading){
    setTimeout(() => loadRankingOnline(true), 0);
  }
}
function validateRankingSubmit(payload, managerName, endpoint){
  if(!game) return 'No hay partida activa.';
  if(!endpoint) return 'Ranking online no disponible por el momento.';
  if(!managerName) return 'Ingresá un nombre de manager.';
  if(!payload?.position) return 'No se pudo calcular la posición actual.';
  const cooldown = rankingUploadCooldownInfo();
  if(!cooldown.canUpload) return rankingCooldownText(cooldown);
  return '';
}
function submitCurrentSeasonToRanking(){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const managerName = setRankingStoredManagerName($('rankingManagerName')?.value || '');
  const payload = buildRankingPayload(managerName);
  const error = validateRankingSubmit(payload, managerName, endpoint);
  if(error){ showNotice(error); return; }
  const button = $('submitRankingSeason');
  if(button){ button.disabled = true; button.textContent = 'Enviando...'; }
  const body = { action:'submit', token:RANKING_TOKEN || '', payload };
  postRankingViaHiddenForm(endpoint, body);
  game.rankingUploads = game.rankingUploads || {};
  game.rankingUploads[payload.submissionKey] = { submittedAt:payload.submittedAt, gameDate:payload.gameDate, managerName, managerScore:payload.managerScore };
  game.rankingLastUploadGameDate = payload.gameDate || rankingCurrentGameDate();
  saveLocal(true);
  rankingRowsCache = [normalizeRankingRow(payload)].concat(rankingRowsCache.filter(row => row.saveCode !== payload.saveCode || Number(row.season) !== Number(payload.season)));
  showNotice('Resultado enviado al ranking. Puede tardar unos segundos en aparecer online.');
  setTimeout(()=>{ renderRankingOnline(); loadRankingOnline(true); }, 900);
}
function postRankingViaHiddenForm(endpoint, body){
  const iframeName = `fmRankingSubmit_${Date.now()}`;
  const iframe = document.createElement('iframe');
  iframe.name = iframeName;
  iframe.style.display = 'none';
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = endpoint;
  form.target = iframeName;
  form.style.display = 'none';
  Object.entries({ action:body.action, token:body.token || '', payload:JSON.stringify(body.payload || {}) }).forEach(([name, value]) => {
    const input = document.createElement('input');
    input.type = 'hidden';
    input.name = name;
    input.value = String(value ?? '');
    form.appendChild(input);
  });
  document.body.appendChild(iframe);
  document.body.appendChild(form);
  try{ form.submit(); }
  finally{
    setTimeout(()=>{ form.remove(); iframe.remove(); }, 6000);
  }
}
function loadRankingOnline(silent=false){
  const endpoint = normalizeRankingEndpoint(rankingStoredEndpoint());
  const status = $('rankingStatus');
  if(!endpoint){ if(status) status.textContent = 'Ranking online no disponible por el momento.'; return; }
  if(rankingLoading) return;
  rankingLoading = true;
  if(status) status.textContent = 'Cargando ranking online...';
  const callbackName = `fmRankingCallback_${Date.now()}_${hashNumber(Math.random(), 100000)}`.replace(/\W/g,'_');
  const script = document.createElement('script');
  const sep = endpoint.includes('?') ? '&' : '?';
  const timer = setTimeout(() => {
    cleanup();
    if(status) status.textContent = 'No se pudo leer el ranking online. Probá de nuevo más tarde.';
    if(!silent) showNotice('No se pudo cargar el ranking online.');
  }, 10000);
  function cleanup(){
    rankingLoading = false;
    clearTimeout(timer);
    try{ delete window[callbackName]; }catch(_){ window[callbackName] = undefined; }
    script.remove();
  }
  window[callbackName] = (response) => {
    const rows = Array.isArray(response?.rows) ? response.rows : Array.isArray(response) ? response : [];
    rankingRowsCache = rows.map(normalizeRankingRow).filter(row => row.managerName || row.club || row.saveCode);
    const box = $('rankingTableBox');
    if(box) box.innerHTML = rankingRowsTable(rankingRowsCache);
    if(status) status.textContent = `${rankingRowsCache.length} registro(s) cargado(s).`;
    cleanup();
  };
  script.onerror = () => {
    cleanup();
    if(status) status.textContent = 'Error al leer el ranking online.';
    if(!silent) showNotice('Error al leer el ranking online.');
  };
  script.src = `${endpoint}${sep}action=list&limit=${encodeURIComponent(RANKING_PAGE_SIZE)}&callback=${encodeURIComponent(callbackName)}&_=${Date.now()}`;
  document.body.appendChild(script);
}
