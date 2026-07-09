/* V5.20 · Centro de Ojeo persistente: los informes revelados no se pierden al quitar jugadores de la lista. */

function createInitialScoutingCenterState(){
  return { listedPlayerIds:[], reports:{}, offices:0, scouts:0, chief:null, officeLastChargeDate:null, chiefLastChargeDate:null, scoutsLastChargeDate:null, lastDailyProcessDate:null };
}
function normalizeScoutingCenterState(state){
  const base = createInitialScoutingCenterState();
  const clean = { ...base, ...(state || {}) };
  clean.listedPlayerIds = Array.isArray(clean.listedPlayerIds) ? clean.listedPlayerIds.map(Number).filter(Boolean) : [];
  clean.listedPlayerIds = Array.from(new Set(clean.listedPlayerIds)).filter(id => {
    const p = typeof playerById === 'function' ? playerById(id) : null;
    return Boolean(p);
  });
  clean.reports = (clean.reports && typeof clean.reports === 'object' && !Array.isArray(clean.reports)) ? clean.reports : {};
  Object.entries({ ...clean.reports }).forEach(([id, report]) => {
    const numericId = Number(id);
    const player = typeof playerById === 'function' ? playerById(numericId) : null;
    if(!numericId || !player){ delete clean.reports[id]; return; }
    clean.reports[String(numericId)] = normalizeScoutingReport(numericId, report);
    if(String(id) !== String(numericId)) delete clean.reports[id];
  });
  clean.offices = Math.max(0, Math.round(Number(clean.offices || 0)));
  clean.scouts = Math.max(0, Math.round(Number(clean.scouts || 0)));
  clean.chief = clean.chief && typeof clean.chief === 'object' ? clean.chief : null;
  if(clean.chief && !scoutingChiefType(clean.chief.type)) clean.chief = null;
  clean.officeLastChargeDate = validIsoDate(clean.officeLastChargeDate) ? clean.officeLastChargeDate : null;
  clean.chiefLastChargeDate = validIsoDate(clean.chiefLastChargeDate) ? clean.chiefLastChargeDate : null;
  clean.scoutsLastChargeDate = validIsoDate(clean.scoutsLastChargeDate) ? clean.scoutsLastChargeDate : null;
  clean.lastDailyProcessDate = validIsoDate(clean.lastDailyProcessDate) ? clean.lastDailyProcessDate : null;
  const caps = scoutingCapacities(clean);
  clean.scouts = Math.min(clean.scouts, caps.scoutCapacity);
  clean.listedPlayerIds = clean.listedPlayerIds.slice(0, caps.playerCapacity);
  return clean;
}
function normalizeScoutingReport(playerId, report={}){
  const player = typeof playerById === 'function' ? playerById(playerId) : null;
  const visible = Array.isArray(report.visibleSkills) ? report.visibleSkills.map(String) : [];
  const allowed = new Set(player ? scoutingSkillKeys(player) : visible);
  const initialKnown = player ? scoutingInitialKnownSkillKeys(player) : [];
  return {
    playerId:Number(playerId),
    visibleSkills:Array.from(new Set([...initialKnown, ...visible])).filter(key => !allowed.size || allowed.has(key)),
    daysObserved:Math.max(0, Math.round(Number(report.daysObserved || 0))),
    lastUpdatedDate:validIsoDate(report.lastUpdatedDate) ? report.lastUpdatedDate : null,
    createdDate:validIsoDate(report.createdDate) ? report.createdDate : (game?.currentDate || currentCalendarDate())
  };
}
function ensureScoutingCenterState(){
  if(!game) return createInitialScoutingCenterState();
  game.scoutingCenter = normalizeScoutingCenterState(game.scoutingCenter || {});
  return game.scoutingCenter;
}
function scoutingChiefType(type){
  const key = String(type || '').toLowerCase();
  return (SCOUTING_CHIEF_TYPES || []).find(item => item.key === key) || null;
}
function scoutingCapacities(state=null){
  const clean = state || game?.scoutingCenter || {};
  const offices = Math.max(0, Math.round(Number(clean.offices || 0)));
  return {
    scoutCapacity:SCOUTING_BASE_SCOUTS + offices * SCOUTING_SCOUTS_PER_OFFICE,
    playerCapacity:SCOUTING_BASE_PLAYER_SLOTS + offices * SCOUTING_PLAYERS_PER_OFFICE
  };
}
function scoutingChiefMaxOffices(){
  const state = ensureScoutingCenterState();
  const type = scoutingChiefType(state.chief?.type);
  return type ? type.maxOffices : 0;
}
function scoutingIsOwnPlayer(player){
  return Boolean(player && game && Number(player.clubId || 0) === Number(game.selectedClubId || 0));
}
function scoutingVisibleStatMap(player){
  return typeof scoutingStatMap === 'function' ? scoutingStatMap(player) : (player?.skills || {});
}
function scoutingHiddenStatMap(player){
  if(!player || typeof hiddenStats !== 'function') return {};
  const stats = hiddenStats(player);
  return {
    'hidden.aggression': stats.aggression,
    'hidden.genetics': stats.genetics,
    'hidden.surprise': stats.surprise
  };
}
function scoutingFullStatMap(player){
  return { ...scoutingVisibleStatMap(player), ...scoutingHiddenStatMap(player) };
}
function scoutingHiddenSkillKeys(player){
  return Object.keys(scoutingHiddenStatMap(player) || {});
}
function scoutingVisibleSkillKeys(player){
  return Object.keys(scoutingVisibleStatMap(player) || {});
}
function scoutingInitialKnownSkillKeys(player){
  if(!scoutingIsOwnPlayer(player)) return [];
  return scoutingVisibleSkillKeys(player);
}
function scoutingSkillKeys(player){
  if(!player) return [];
  return Object.keys(scoutingFullStatMap(player) || {});
}
function scoutingKnownSet(playerId){
  const state = ensureScoutingCenterState();
  return new Set(state.reports[String(playerId)]?.visibleSkills || []);
}
function scoutingKnownCount(playerId){ return scoutingKnownSet(playerId).size; }
function scoutingReportForPlayer(playerId){
  const state = ensureScoutingCenterState();
  const key = String(playerId);
  if(!state.reports[key]) state.reports[key] = normalizeScoutingReport(playerId, {});
  return state.reports[key];
}
function addPlayerToScoutingCenter(playerId){
  if(!SCOUTING_CENTER_ENABLED || !game){ showNotice('El Centro de Ojeo no está disponible.'); return; }
  const player = playerById(playerId);
  if(!player){ showNotice('Jugador no encontrado.'); return; }
  const ownPlayer = scoutingIsOwnPlayer(player);
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  if(state.listedPlayerIds.includes(Number(playerId))){ showNotice(`${player.name} ya está en el Centro de Ojeo.`); activeTab='scouting'; renderAll(); return; }
  if(state.listedPlayerIds.length >= caps.playerCapacity){ showNotice('No hay cupos libres en la lista de ojeo. Alquilá oficinas o quitá jugadores.'); return; }
  state.listedPlayerIds.push(Number(playerId));
  state.reports[String(playerId)] = normalizeScoutingReport(playerId, state.reports[String(playerId)] || {});
  saveLocal(true);
  showNotice(ownPlayer ? `${player.name} fue agregado para revelar habilidades ocultas.` : `${player.name} fue agregado al Centro de Ojeo.`);
  activeTab='scouting';
  if(typeof closeModal === 'function') closeModal();
  renderAll();
}
function removePlayerFromScoutingCenter(playerId){
  const state = ensureScoutingCenterState();
  state.listedPlayerIds = state.listedPlayerIds.filter(id => Number(id) !== Number(playerId));
  // El informe queda archivado. Si ya se revelaron habilidades, la ficha del jugador debe seguir mostrándolas.
  if(state.reports[String(playerId)]) state.reports[String(playerId)] = normalizeScoutingReport(playerId, state.reports[String(playerId)]);
  saveLocal(true);
  renderScoutingCenter();
}
function hireScoutingChief(type){
  const chief = scoutingChiefType(type);
  if(!chief){ showNotice('Jefe de ojeadores inválido.'); return; }
  const state = ensureScoutingCenterState();
  if(state.chief){ showNotice('Ya tenés un jefe de ojeadores. Se va solo al finalizar la temporada.'); return; }
  state.chief = { type:chief.key, hiredDate:game.currentDate || currentCalendarDate(), season:game.seasonNumber || 1 };
  state.chiefLastChargeDate = game.currentDate || currentCalendarDate();
  recordBudgetChange(-chief.monthlySalary, `Primer mes jefe de ojeadores ${chief.name}`, { type:'scouting_chief_salary', chief:chief.key });
  saveLocal(true);
  renderScoutingCenter();
}
function rentScoutingOffice(){
  const state = ensureScoutingCenterState();
  const max = scoutingChiefMaxOffices();
  if(state.offices >= max){ showNotice(max > 0 ? 'Tu jefe de ojeadores no puede controlar más oficinas.' : 'Contratá un jefe de ojeadores antes de alquilar oficinas.'); return; }
  state.offices += 1;
  state.officeLastChargeDate = game.currentDate || currentCalendarDate();
  recordBudgetChange(-SCOUTING_OFFICE_MONTHLY_COST, 'Alquiler mensual de oficina de ojeo', { type:'scouting_office_rent', offices:state.offices });
  saveLocal(true);
  renderScoutingCenter();
}
function cancelScoutingOffice(){
  const state = ensureScoutingCenterState();
  if(state.offices <= 0){ showNotice('No hay oficinas de ojeo para cancelar.'); return; }
  const nextOffices = state.offices - 1;
  const nextCaps = scoutingCapacities({ ...state, offices:nextOffices });
  if(state.scouts > nextCaps.scoutCapacity){ showNotice('Primero despedí ojeadores. Con una oficina menos no alcanza el cupo actual.'); return; }
  if(state.listedPlayerIds.length > nextCaps.playerCapacity){ showNotice('Primero quitá jugadores de la lista de ojeo. Con una oficina menos no alcanza el cupo actual.'); return; }
  state.offices = nextOffices;
  if(state.offices <= 0) state.officeLastChargeDate = null;
  saveLocal(true);
  renderScoutingCenter();
}
function hireScoutingScout(){
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  if(state.scouts >= caps.scoutCapacity){ showNotice('No hay cupo para más ojeadores. Alquilá oficinas.'); return; }
  state.scouts += 1;
  state.scoutsLastChargeDate = game.currentDate || currentCalendarDate();
  recordBudgetChange(-SCOUTING_SCOUT_DAILY_COST, 'Contratación diaria de ojeador', { type:'scouting_scout_daily', scouts:state.scouts });
  saveLocal(true);
  renderScoutingCenter();
}
function dismissScoutingScout(){
  const state = ensureScoutingCenterState();
  if(state.scouts <= 0){ showNotice('No hay ojeadores contratados.'); return; }
  state.scouts -= 1;
  if(state.scouts <= 0) state.scoutsLastChargeDate = null;
  saveLocal(true);
  renderScoutingCenter();
}
function scoutingRevealOneSkill(attemptIndex=0, context='daily'){
  const state = ensureScoutingCenterState();
  const listed = state.listedPlayerIds.map(playerById).filter(Boolean);
  const candidates = [];
  listed.forEach(player => {
    const report = scoutingReportForPlayer(player.id);
    const known = new Set(report.visibleSkills || []);
    const ownPlayer = scoutingIsOwnPlayer(player);
    const revealPool = ownPlayer
      ? scoutingHiddenSkillKeys(player).filter(key => !known.has(key))
      : scoutingSkillKeys(player).filter(key => !known.has(key));
    if(revealPool.length) candidates.push({ player, hidden:revealPool, report, ownPlayer });
  });
  if(!candidates.length) return false;
  candidates.sort((a,b)=>{
    const ownDelta = Number(b.ownPlayer) - Number(a.ownPlayer);
    if(ownDelta) return ownDelta;
    const hiddenDelta = Number(a.hidden.length || 0) - Number(b.hidden.length || 0);
    if(hiddenDelta) return hiddenDelta;
    return a.player.name.localeCompare(b.player.name, 'es');
  });
  const seed = `scout-pick-${game.currentDate}-${currentTurnIndex()}-${attemptIndex}-${context}-${state.lastDailyProcessDate || ''}`;
  const pick = candidates[hashNumber(seed, candidates.length)];
  const skillSeed = `scout-skill-${pick.player.id}-${game.currentDate}-${attemptIndex}-${context}-${pick.hidden.join('|')}`;
  const key = pick.hidden[hashNumber(skillSeed, pick.hidden.length)];
  pick.report.visibleSkills = Array.from(new Set([...(pick.report.visibleSkills || []), key]));
  pick.report.daysObserved = Math.max(0, Number(pick.report.daysObserved || 0)) + 1;
  pick.report.lastUpdatedDate = game.currentDate || currentCalendarDate();
  return true;
}
function scoutingChiefDailyReveals(){
  const state = ensureScoutingCenterState();
  const type = scoutingChiefType(state.chief?.type);
  if(!type) return 0;
  if(type.revealMax <= type.revealMin) return type.revealMin;
  return type.revealMin + hashNumber(`scout-chief-${state.chief.type}-${game.currentDate}-${game.seasonNumber}`, (type.revealMax - type.revealMin) + 1);
}
function processScoutingCenterMonthlyCosts(){
  const state = ensureScoutingCenterState();
  const today = game.currentDate || currentCalendarDate();
  if(!validIsoDate(today)) return 0;
  let total = 0;
  if(state.offices > 0 && SCOUTING_OFFICE_MONTHLY_COST > 0){
    if(!state.officeLastChargeDate) state.officeLastChargeDate = today;
    const months = Math.floor(daysBetweenIsoDates(state.officeLastChargeDate, today) / 30);
    if(months > 0){
      const cost = state.offices * SCOUTING_OFFICE_MONTHLY_COST * months;
      recordBudgetChange(-cost, 'Alquiler mensual de oficinas de ojeo', { type:'scouting_office_monthly', offices:state.offices, months });
      state.officeLastChargeDate = addDaysToIsoDate(state.officeLastChargeDate, months * 30);
      total += cost;
    }
  }
  const chief = scoutingChiefType(state.chief?.type);
  if(chief){
    if(!state.chiefLastChargeDate) state.chiefLastChargeDate = today;
    const months = Math.floor(daysBetweenIsoDates(state.chiefLastChargeDate, today) / 30);
    if(months > 0){
      const cost = chief.monthlySalary * months;
      recordBudgetChange(-cost, `Sueldo mensual jefe de ojeadores ${chief.name}`, { type:'scouting_chief_monthly', chief:chief.key, months });
      state.chiefLastChargeDate = addDaysToIsoDate(state.chiefLastChargeDate, months * 30);
      total += cost;
    }
  }
  return total;
}
function processScoutingCenterDaily(options={}){
  if(!SCOUTING_CENTER_ENABLED || !game) return { reveals:0, costs:0 };
  const state = ensureScoutingCenterState();
  const today = game.currentDate || currentCalendarDate();
  const reason = String(options.reason || 'daily');
  if(state.lastDailyProcessDate === today) return { reveals:0, costs:0, skipped:true, date:today, reason };
  state.lastDailyProcessDate = today;
  let costs = 0;
  if(state.scouts > 0 && SCOUTING_SCOUT_DAILY_COST > 0){
    const cost = state.scouts * SCOUTING_SCOUT_DAILY_COST;
    recordBudgetChange(-cost, 'Pago diario de ojeadores', { type:'scouting_scout_daily', scouts:state.scouts });
    costs += cost;
  }
  costs += processScoutingCenterMonthlyCosts();
  const attempts = Math.max(0, state.scouts) + scoutingChiefDailyReveals();
  let reveals = 0;
  for(let i=0; i<attempts; i++){
    if(scoutingRevealOneSkill(i, reason)) reveals += 1;
  }
  game.lastScoutingDailyResult = { date:today, reason, attempts, reveals, costs };
  return { reveals, costs, attempts, date:today, reason };
}
function resetScoutingCenterForNewSeason(){
  if(!game) return;
  const state = ensureScoutingCenterState();
  state.chief = null;
  state.chiefLastChargeDate = null;
  state.lastDailyProcessDate = null;
  game.scoutingCenter = state;
}
function resetScoutingCenterForNewClub(){
  if(!game) return;
  const previous = ensureScoutingCenterState();
  // Cambiar de club vacía oficinas, jefe, ojeadores y lista activa, pero conserva los informes ya revelados.
  // La información ojeada es progreso del manager y debe seguir disponible en las fichas.
  game.scoutingCenter = { ...createInitialScoutingCenterState(), reports: previous.reports || {} };
}

function scoutingRepeatedIcons(icon, active=0, total=null, className=''){
  const safeActive = Math.max(0, Math.round(Number(active || 0)));
  const safeTotal = total === null ? safeActive : Math.max(0, Math.round(Number(total || 0)));
  const limit = Math.min(Math.max(safeTotal, safeActive), 24);
  const items = [];
  for(let i=0; i<limit; i++){
    const filled = i < safeActive;
    items.push(`<span class="${filled ? 'filled' : 'empty'}" aria-hidden="true">${icon}</span>`);
  }
  if(Math.max(safeTotal, safeActive) > limit) items.push(`<span class="more">+${Math.max(safeTotal, safeActive) - limit}</span>`);
  return `<div class="scouting-icon-stack ${className}">${items.join('')}</div>`;
}
function scoutingBinocularsIcon(extraClass=''){
  return `<span class="scouting-binoculars-icon ${extraClass}" aria-hidden="true"><span></span></span>`;
}
function scoutingSummaryTile({ label, value, hint='', icon='', extra='' }){
  return `<div class="card scouting-summary-tile ${extra}">
    <div class="scouting-summary-icon">${icon}</div>
    <div><p class="label">${escapeHtml(label)}</p><strong>${value}</strong>${hint ? `<small class="muted">${hint}</small>` : ''}</div>
  </div>`;
}

function scoutingPlayerSkillRows(player, map){
  const known = scoutingKnownSet(player.id);
  return Object.entries(map || {}).map(([key,value]) => {
    const label = typeof scoutingSkillDisplayLabel === 'function' ? scoutingSkillDisplayLabel(player, key) : key;
    return `<div class="stat-rank"><span>${escapeHtml(label)}</span><strong>${known.has(key) ? value : '—'}</strong></div>`;
  }).join('');
}
function scoutingPlayerKnownSkillRows(player){
  const visibleMap = scoutingVisibleStatMap(player);
  const hiddenMap = scoutingHiddenStatMap(player);
  const hiddenKnown = Object.keys(hiddenMap).filter(key => scoutingKnownSet(player.id).has(key)).length;
  return `
    <div class="scouting-known-section"><p class="label">Habilidades visibles</p><div class="scouting-known-grid">${scoutingPlayerSkillRows(player, visibleMap)}</div></div>
    <div class="scouting-known-section scouting-hidden-section"><p class="label">Habilidades ocultas ${hiddenKnown}/${Object.keys(hiddenMap).length}</p><div class="scouting-known-grid">${scoutingPlayerSkillRows(player, hiddenMap)}</div></div>`;
}
function scoutingPlayerCard(player){
  const report = scoutingReportForPlayer(player.id);
  const known = scoutingKnownCount(player.id);
  const total = scoutingSkillKeys(player).length || 1;
  const hiddenTotal = Object.keys(scoutingHiddenStatMap(player)).length;
  const hiddenKnown = Object.keys(scoutingHiddenStatMap(player)).filter(key => scoutingKnownSet(player.id).has(key)).length;
  const pct = clamp(Math.round((known / total) * 100), 0, 100);
  const ownPill = scoutingIsOwnPlayer(player) ? '<span class="pill ok">Propio · ocultas primero</span>' : '<span class="pill">Externo</span>';
  return `<div class="scouting-player-card card inner">
    <div class="scouting-player-head">
      ${faceImg(player, 'scouting-player-face')}
      <div><h3>${typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player.name)}</h3><p class="muted small">${escapeHtml(clubName(player.clubId))} · ${escapeHtml(player.nationality || '—')} · ${escapeHtml(player.position || '')}</p>${ownPill}</div>
      <button class="ghost small-btn" data-remove-scouting-player="${player.id}">Quitar</button>
    </div>
    <div class="project-progress scouting-report-progress"><span style="width:${pct}%"></span></div>
    <p class="muted small">Habilidades conocidas: ${known}/${total} · Ocultas reveladas: ${hiddenKnown}/${hiddenTotal} · Días observado: ${Number(report.daysObserved || 0)}</p>
    ${scoutingPlayerKnownSkillRows(player)}
  </div>`;
}
function scoutingChiefMarkup(){
  const state = ensureScoutingCenterState();
  if(state.chief){
    const type = scoutingChiefType(state.chief.type);
    const officeIcons = scoutingRepeatedIcons('🏢', state.offices, type?.maxOffices || 0, 'building-icons');
    return `<div class="card scouting-chief-card scouting-control-card">
      <div class="scouting-card-head">
        <div class="scouting-card-icon">${scoutingBinocularsIcon('small')}</div>
        <div><p class="label">Jefe de ojeadores</p><h3>${escapeHtml(type?.name || state.chief.type)}</h3></div>
        <span class="pill ok">Activo</span>
      </div>
      <p class="muted small">Sueldo mensual ${formatMoney(type?.monthlySalary || 0)} · controla hasta ${type?.maxOffices || 0} oficina(s) · se va al finalizar la temporada.</p>
      <div class="scouting-asset-strip"><span>Control de oficinas</span>${officeIcons}</div>
    </div>`;
  }
  const cards = (SCOUTING_CHIEF_TYPES || []).map(type => `<div class="card inner scouting-chief-option">
    <div class="scouting-chief-option-head"><strong>${escapeHtml(type.name)}</strong><span>${type.maxOffices} 🏢</span></div>
    <p class="muted small">${formatMoney(type.monthlySalary)} por mes · revela ${type.revealMin}-${type.revealMax} habilidad(es)/día.</p>
    <button class="primary small-btn" data-hire-scouting-chief="${escapeHtml(type.key)}">Contratar</button>
  </div>`).join('');
  return `<div class="card scouting-chief-card scouting-control-card">
    <div class="scouting-card-head">
      <div class="scouting-card-icon">${scoutingBinocularsIcon('small')}</div>
      <div><p class="label">Empleado contratable</p><h3>Jefe de ojeadores</h3></div>
    </div>
    <p class="muted small">No puede despedirse. Finaliza contrato al terminar la temporada.</p>
    <div class="scouting-chief-options">${cards}</div>
  </div>`;
}
function renderScoutingCenter(){
  if(!SCOUTING_CENTER_ENABLED){ view.innerHTML = '<div class="card"><h2>Centro de Ojeo</h2><p class="muted">El Centro de Ojeo está desactivado en config.js.</p></div>'; return; }
  const state = ensureScoutingCenterState();
  const caps = scoutingCapacities(state);
  const maxOffices = scoutingChiefMaxOffices();
  const listed = state.listedPlayerIds.map(playerById).filter(Boolean);
  const archivedReports = Object.keys(state.reports || {}).filter(id => !state.listedPlayerIds.map(Number).includes(Number(id))).length;
  const reportCount = Object.keys(state.reports || {}).length;
  const lastProcess = game?.lastScoutingDailyResult;
  const lastProcessText = lastProcess?.date ? `Último proceso: ${escapeHtml(lastProcess.date)} · intentos ${Number(lastProcess.attempts || 0)} · reveladas ${Number(lastProcess.reveals || 0)}` : 'Todavía no se procesó ningún día de ojeo.';
  const officeCost = state.offices > 0 ? `${formatMoney(SCOUTING_OFFICE_MONTHLY_COST)}/mes` : 'Sin alquileres activos';
  const scoutCost = state.scouts > 0 ? `${formatMoney(state.scouts * SCOUTING_SCOUT_DAILY_COST)}/día` : 'Sin ojeadores activos';
  view.innerHTML = `
    <div class="scouting-shell">
      <div class="card scouting-hero">
        <div class="scouting-hero-icon">${scoutingBinocularsIcon()}</div>
        <div>
          <p class="eyebrow">Departamento deportivo</p>
          <h2>Centro de Ojeo</h2>
          <p class="tagline">Agregá jugadores externos o propios desde su ficha individual. En jugadores propios las habilidades visibles ya están desbloqueadas y el ojeo avanza directo sobre las ocultas.</p>
        </div>
      </div>
      <div class="scouting-summary-grid">
        ${scoutingSummaryTile({ label:'Jugadores listados', value:`${listed.length}/${caps.playerCapacity}`, hint:'Cupo activo', icon:scoutingBinocularsIcon('mini') })}
        ${scoutingSummaryTile({ label:'Ojeadores', value:`${state.scouts}/${caps.scoutCapacity}`, hint:scoutCost, icon:'👤' })}
        ${scoutingSummaryTile({ label:'Oficinas', value:`${state.offices}/${maxOffices}`, hint:officeCost, icon:'🏢' })}
        ${scoutingSummaryTile({ label:'Informes guardados', value:reportCount, hint:`${archivedReports} archivado(s)`, icon:'▣' })}
      </div>
      <div class="scouting-workspace">
        <div class="scouting-main-stack">
          <div class="card scouting-list-card">
            <div class="scouting-card-head">
              <div><p class="label">Lista activa</p><h3>Jugadores en seguimiento</h3></div>
              <span class="pill">${listed.length}/${caps.playerCapacity}</span>
            </div>
            <p class="muted small">Los datos conocidos quedan guardados aunque quites al jugador de la lista activa. Fuera del Centro de Ojeo no se revelan habilidades nuevas.</p>
            <div class="scouting-player-list">${listed.length ? listed.map(scoutingPlayerCard).join('') : '<div class="scouting-empty-list"><div class="scouting-empty-icon">' + scoutingBinocularsIcon('empty') + '</div><p class="muted">Todavía no agregaste jugadores. Abrí la ficha de cualquier jugador y usá “Ojear”.</p></div>'}</div>
          </div>
        </div>
        <aside class="scouting-side-rail">
          ${scoutingChiefMarkup()}
          <div class="card scouting-office-card scouting-control-card">
            <div class="scouting-card-head">
              <div><p class="label">Infraestructura</p><h3>Oficinas</h3></div>
              <span class="pill">${state.offices}/${maxOffices}</span>
            </div>
            <div class="scouting-asset-strip"><span>Edificios activos</span>${scoutingRepeatedIcons('🏢', state.offices, maxOffices, 'building-icons')}</div>
            <p class="muted small">Base: ${SCOUTING_BASE_SCOUTS} ojeadores y ${SCOUTING_BASE_PLAYER_SLOTS} jugadores listados. Cada oficina agrega ${SCOUTING_SCOUTS_PER_OFFICE} ojeadores y ${SCOUTING_PLAYERS_PER_OFFICE} jugadores listados.</p>
            <div class="scouting-action-grid"><button class="primary" data-rent-scouting-office ${state.offices >= maxOffices ? 'disabled' : ''}>Alquilar oficina</button><button class="ghost" data-cancel-scouting-office ${state.offices <= 0 ? 'disabled' : ''}>Cancelar oficina</button></div>
          </div>
          <div class="card scouting-office-card scouting-control-card">
            <div class="scouting-card-head">
              <div><p class="label">Personal</p><h3>Ojeadores</h3></div>
              <span class="pill">${state.scouts}/${caps.scoutCapacity}</span>
            </div>
            <div class="scouting-asset-strip"><span>Equipo activo</span>${scoutingRepeatedIcons('👤', state.scouts, caps.scoutCapacity, 'person-icons')}</div>
            <p class="muted small">Ojeador: ${formatMoney(SCOUTING_SCOUT_DAILY_COST)}/día. Costo actual: <strong class="bad">${formatMoney(state.scouts * SCOUTING_SCOUT_DAILY_COST)}</strong>.</p>
            <div class="scouting-action-grid"><button class="primary" data-hire-scouting-scout ${state.scouts >= caps.scoutCapacity ? 'disabled' : ''}>Contratar ojeador</button><button class="ghost danger" data-dismiss-scouting-scout ${state.scouts <= 0 ? 'disabled' : ''}>Despedir ojeador</button></div>
          </div>
          <div class="card scouting-process-card scouting-control-card">
            <div class="scouting-card-head"><div><p class="label">Actividad diaria</p><h3>Proceso de ojeo</h3></div></div>
            <p class="muted small">${lastProcessText}</p>
          </div>
        </aside>
      </div>
    </div>`;
  document.querySelectorAll('[data-hire-scouting-chief]').forEach(btn => btn.addEventListener('click', () => hireScoutingChief(btn.dataset.hireScoutingChief)));
  document.querySelector('[data-rent-scouting-office]')?.addEventListener('click', rentScoutingOffice);
  document.querySelector('[data-cancel-scouting-office]')?.addEventListener('click', cancelScoutingOffice);
  document.querySelector('[data-hire-scouting-scout]')?.addEventListener('click', hireScoutingScout);
  document.querySelector('[data-dismiss-scouting-scout]')?.addEventListener('click', dismissScoutingScout);
  document.querySelectorAll('[data-remove-scouting-player]').forEach(btn => btn.addEventListener('click', () => removePlayerFromScoutingCenter(Number(btn.dataset.removeScoutingPlayer || 0))));
}
