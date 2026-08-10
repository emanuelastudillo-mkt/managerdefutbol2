/* V9.45 · Herramientas privadas de revisión para la cuenta confirmada Emanukk.
   La navegación se crea dinámicamente y no deja ningún elemento visible para otras cuentas. */

const PRIVATE_MANAGER_TOOLS_USERNAME = 'Emanukk';
const PRIVATE_MANAGER_TOOLS_BACKUP_PREFIX = 'private-tools-v945:';
const privateManagerToolsState = {
  enabled:false,
  revealHidden:false,
  skipAdvanceCooldown:false,
  busy:false,
  backupCreated:false
};

function privateManagerToolsConfirmedUsername(){
  return typeof rankingRuntimeConfirmedUsername === 'function' ? rankingRuntimeConfirmedUsername() : '';
}

function privateManagerToolsAuthorized(){
  const token = typeof rankingStoredAuthToken === 'function' ? String(rankingStoredAuthToken() || '').trim() : '';
  return Boolean(token && privateManagerToolsConfirmedUsername() === PRIVATE_MANAGER_TOOLS_USERNAME);
}
function privateManagerToolsActive(){
  return privateManagerToolsAuthorized() && privateManagerToolsState.enabled;
}
function privateManagerToolsCanMutate(){
  return privateManagerToolsActive() && Boolean(game) && !privateManagerToolsState.busy;
}
function privateManagerToolsBackupKey(){
  const slot = typeof gameSlotId === 'function' ? gameSlotId() : String(game?.saveSlotId || 'career');
  const saveCode = String(game?.saveCode || 'sin-codigo').replace(/[^a-zA-Z0-9_-]/g, '').slice(0,80) || 'sin-codigo';
  return `${PRIVATE_MANAGER_TOOLS_BACKUP_PREFIX}${slot}:${saveCode}`;
}
function privateManagerToolsLog(){
  if(!game) return [];
  game.privateReviewTools = game.privateReviewTools && typeof game.privateReviewTools === 'object' ? game.privateReviewTools : {};
  game.privateReviewTools.log = Array.isArray(game.privateReviewTools.log) ? game.privateReviewTools.log : [];
  return game.privateReviewTools.log;
}
function privateManagerToolsRecord(label, details=''){
  if(!game) return;
  const log = privateManagerToolsLog();
  log.unshift({
    label:String(label || 'Ajuste de revisión'),
    details:String(details || ''),
    gameDate:String(game.currentDate || ''),
    season:Number(game.seasonNumber || 1),
    at:new Date().toISOString()
  });
  game.privateReviewTools.log = log.slice(0,80);
  game.privateReviewTools.modified = true;
  game.privateReviewTools.modifiedAt = new Date().toISOString();
  game.privateReviewTools.modifiedBy = PRIVATE_MANAGER_TOOLS_USERNAME;
  game.privateReviewTools.rankingBlocked = true;
}
function privateManagerToolsIsModified(){
  return Boolean(game?.privateReviewTools?.modified || game?.privateReviewTools?.rankingBlocked);
}
function privateManagerToolsBannerSync(){
  let banner = document.getElementById('privateManagerToolsBanner');
  if(!privateManagerToolsActive()){
    banner?.remove();
    document.body.classList.remove('private-manager-tools-active');
    return;
  }
  document.body.classList.add('private-manager-tools-active');
  if(!banner){
    banner = document.createElement('div');
    banner.id = 'privateManagerToolsBanner';
    banner.className = 'private-manager-tools-banner';
    banner.textContent = 'Modo de revisión activo · las modificaciones bloquean el ranking de esta partida';
    document.body.appendChild(banner);
  }
}
function privateManagerToolsRemoveNavigation(){
  document.querySelector('[data-private-manager-tools-nav]')?.remove();
  if(typeof activeTab !== 'undefined' && activeTab === 'admin'){
    activeTab = 'home';
    if(typeof renderAll === 'function') renderAll();
  }
  privateManagerToolsState.enabled = false;
  privateManagerToolsState.revealHidden = false;
  privateManagerToolsState.skipAdvanceCooldown = false;
  privateManagerToolsBannerSync();
}
function privateManagerToolsOpen(){
  if(!privateManagerToolsAuthorized()) return false;
  activeTab = 'admin';
  if(typeof renderAll === 'function') renderAll();
  return true;
}
function syncPrivateManagerToolsNavigation(){
  if(!privateManagerToolsAuthorized()){
    privateManagerToolsRemoveNavigation();
    return false;
  }
  const nav = document.querySelector('.sidebar-nav');
  if(!nav) return false;
  let button = nav.querySelector('[data-private-manager-tools-nav]');
  if(!button){
    button = document.createElement('button');
    button.type = 'button';
    button.dataset.tab = 'admin';
    button.dataset.privateManagerToolsNav = 'true';
    button.className = 'sidebar-private-tools-link';
    button.innerHTML = '<span>Administración</span>';
    button.addEventListener('click', privateManagerToolsOpen);
    nav.appendChild(button);
  }
  button.classList.toggle('active', typeof activeTab !== 'undefined' && activeTab === 'admin');
  return true;
}

async function privateManagerToolsWriteRecord(key, value){
  if(typeof openDb !== 'function') throw new Error('Almacenamiento local no disponible.');
  const db = await openDb();
  await new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('No se pudo escribir la copia.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló la copia.'));
  });
}
async function privateManagerToolsDeleteRecord(key){
  if(typeof openDb !== 'function') return false;
  const db = await openDb();
  await new Promise((resolve,reject)=>{
    const tx = db.transaction(DB_STORE, 'readwrite');
    tx.objectStore(DB_STORE).delete(key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error || new Error('No se pudo eliminar la copia.'));
    tx.onabort = () => reject(tx.error || new Error('Se canceló la eliminación de la copia.'));
  });
  return true;
}

async function privateManagerToolsEnsureBackup(){
  if(!game) throw new Error('No hay partida activa.');
  const key = privateManagerToolsBackupKey();
  const existing = typeof readSaveRecordByKey === 'function' ? await readSaveRecordByKey(key).catch(()=>null) : null;
  if(existing){ privateManagerToolsState.backupCreated = true; return key; }
  if(typeof currentSavePayload !== 'function') throw new Error('No se pudo preparar la copia de seguridad.');
  const record = {
    version:typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'V9.49',
    createdAt:new Date().toISOString(),
    save:currentSavePayload(),
    sharedProfile:typeof readManagerGlobalProfileState === 'function' ? readManagerGlobalProfileState() : null
  };
  await privateManagerToolsWriteRecord(key, record);
  privateManagerToolsState.backupCreated = true;
  return key;
}
async function privateManagerToolsRestoreBackup(){
  if(!privateManagerToolsAuthorized() || !game || privateManagerToolsState.busy) return false;
  if(!confirm('¿Restaurar la copia creada antes de la primera modificación administrativa? Se perderán los cambios posteriores de esta partida.')) return false;
  privateManagerToolsState.busy = true;
  try{
    const record = await readSaveRecordByKey(privateManagerToolsBackupKey());
    if(!record?.save) throw new Error('No existe una copia administrativa para esta partida.');
    const restored = typeof cloneSaveRecord === 'function' ? cloneSaveRecord(record.save) : structuredClone(record.save);
    game = normalizeGame(applySavedDatabaseSnapshots(restored));
    if(record.sharedProfile && typeof writeManagerGlobalProfileState === 'function') writeManagerGlobalProfileState(record.sharedProfile);
    activeTab = 'admin';
    await saveLocal(false);
    await privateManagerToolsDeleteRecord(privateManagerToolsBackupKey()).catch(()=>false);
    privateManagerToolsState.backupCreated = false;
    showNotice('Copia previa a las modificaciones restaurada. La próxima prueba generará una copia nueva.');
    renderAll();
    return true;
  }catch(error){
    showNotice(error?.message || 'No se pudo restaurar la copia administrativa.');
    return false;
  }finally{
    privateManagerToolsState.busy = false;
  }
}
async function privateManagerToolsMutation(label, details, callback){
  if(!privateManagerToolsCanMutate()){
    showNotice(privateManagerToolsActive() ? 'No hay una partida disponible para modificar.' : 'Activá el modo de revisión antes de usar esta herramienta.');
    return false;
  }
  privateManagerToolsState.busy = true;
  try{
    await privateManagerToolsEnsureBackup();
    const result = await callback();
    if(result === false) return false;
    privateManagerToolsRecord(label, details);
    if(typeof persistSharedManagerProfileFromGame === 'function') persistSharedManagerProfileFromGame({ reason:'private_tools' });
    await saveLocal(true);
    showNotice(label);
    activeTab = 'admin';
    renderAdminTools();
    return true;
  }catch(error){
    console.error('Herramienta privada falló', error);
    showNotice(error?.message || 'No se pudo aplicar la herramienta.');
    return false;
  }finally{
    privateManagerToolsState.busy = false;
  }
}

function privateManagerToolsOwnPlayers(){
  if(!game || typeof playersByClub !== 'function') return [];
  return playersByClub(game.selectedClubId).slice().sort((a,b)=>String(a.name || '').localeCompare(String(b.name || ''), 'es'));
}
function privateManagerToolsPlayerOptions(){
  const players = privateManagerToolsOwnPlayers();
  return players.length
    ? players.map(player => `<option value="${Number(player.id)}">${escapeHtml(player.name)} · ${escapeHtml(player.position || '')} · ${Number(typeof visibleOverall === 'function' ? visibleOverall(player) : player.overall || 0)}</option>`).join('')
    : '<option value="">Sin jugadores</option>';
}
function privateManagerToolsSelectedPlayer(){
  const id = Number(document.getElementById('privateToolsPlayer')?.value || 0);
  return privateManagerToolsOwnPlayers().find(player => Number(player.id) === id) || null;
}
function privateManagerToolsStatusRows(){
  if(!game) return '<p class="muted">No hay partida activa.</p>';
  const clubId = Number(game.selectedClubId || 0);
  const squad = privateManagerToolsOwnPlayers();
  const avgCondition = squad.length && typeof currentCondition === 'function' ? Math.round(avg(squad.map(player => currentCondition(player.id)))) : 0;
  const avgMorale = squad.length && typeof currentMorale === 'function' ? Math.round(avg(squad.map(player => currentMorale(player.id)))) : 0;
  const relations = Array.isArray(game?.managerPlayerRelations?.entries) ? game.managerPlayerRelations.entries.length : (Array.isArray(game?.managerPlayerRelations) ? game.managerPlayerRelations.length : 0);
  const pendingMessages = Array.isArray(game.messages) ? game.messages.filter(message => message?.action?.status === 'pending').length : 0;
  return `<div class="private-tools-inspector-grid">
    <div><span>Cuenta confirmada</span><strong>${escapeHtml(privateManagerToolsConfirmedUsername())}</strong></div>
    <div><span>Club</span><strong>${escapeHtml(typeof clubName === 'function' ? clubName(clubId) : String(clubId || '—'))}</strong></div>
    <div><span>Fecha</span><strong>${escapeHtml(String(game.currentDate || '—'))}</strong></div>
    <div><span>Temporada</span><strong>${Number(game.seasonNumber || 1)}</strong></div>
    <div><span>Presupuesto</span><strong>${typeof formatMoney === 'function' ? formatMoney(Number(game.budget || 0)) : Number(game.budget || 0)}</strong></div>
    <div><span>Prestigio</span><strong>${typeof currentManagerPrestige === 'function' ? currentManagerPrestige() : '—'}</strong></div>
    <div><span>Puntos de habilidad</span><strong>${Number(game?.special?.puntos_habilidad || 0).toLocaleString('es-AR')}</strong></div>
    <div><span>Cohesión</span><strong>${typeof cohesionValue === 'function' ? cohesionValue(clubId) : Number(game?.teamCohesion?.[clubId] || 0)}%</strong></div>
    <div><span>Físico promedio</span><strong>${avgCondition}</strong></div>
    <div><span>Moral promedio</span><strong>${avgMorale}</strong></div>
    <div><span>Relaciones</span><strong>${relations}</strong></div>
    <div><span>Acciones pendientes</span><strong>${pendingMessages}</strong></div>
  </div>`;
}
function privateManagerToolsLogMarkup(){
  const log = game ? privateManagerToolsLog() : [];
  if(!log.length) return '<p class="muted">Todavía no se realizaron modificaciones desde esta vista.</p>';
  return `<div class="private-tools-log">${log.slice(0,20).map(item => `<div><strong>${escapeHtml(item.label || '')}</strong><span>${escapeHtml(item.gameDate || '')} · Temp. ${Number(item.season || 1)}</span>${item.details ? `<small>${escapeHtml(item.details)}</small>` : ''}</div>`).join('')}</div>`;
}
function privateManagerToolsSwitchMarkup(key, label, description, checked, disabled=false){
  return `<label class="private-tools-switch ${disabled ? 'is-disabled' : ''}"><span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(description)}</small></span><input type="checkbox" data-private-tools-toggle="${escapeHtml(key)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}></label>`;
}
function renderAdminTools(){
  if(!privateManagerToolsAuthorized()){
    privateManagerToolsRemoveNavigation();
    return;
  }
  syncPrivateManagerToolsNavigation();
  privateManagerToolsBannerSync();
  if(typeof view === 'undefined' || !view) return;
  const enabled = privateManagerToolsActive();
  const modified = privateManagerToolsIsModified();
  const backupKey = game ? privateManagerToolsBackupKey() : '';
  view.innerHTML = `<div class="section-title private-tools-title"><div><p class="label">Acceso privado</p><h2>Administración</h2><p class="tagline">Herramientas de revisión local. Todas comienzan desactivadas.</p></div><span class="pill ${enabled ? 'ok' : ''}">${enabled ? 'Modo activo' : 'Modo normal'}</span></div>
    <div class="card private-tools-master-card">
      ${privateManagerToolsSwitchMarkup('enabled','Modo de revisión','Habilita controles especiales. Al apagarlo, la carrera vuelve a comportarse normalmente.', enabled)}
      ${modified ? '<p class="small warn"><strong>Partida modificada:</strong> el ranking online quedó bloqueado para este guardado.</p>' : '<p class="small ok">La partida todavía no fue modificada. Las herramientas visuales no bloquean el ranking.</p>'}
    </div>
    <div class="grid cols-2 private-tools-layout">
      <div class="card"><p class="label">Visualización</p><h3>Información interna</h3>
        ${privateManagerToolsSwitchMarkup('revealHidden','Revelar información oculta','Muestra habilidades, potencial, físico y moral sin depender del ojeo.', privateManagerToolsState.revealHidden, !enabled)}
        ${privateManagerToolsSwitchMarkup('skipCooldown','Ignorar bloqueo entre avances','Permite avanzar sin esperar el contador local.', privateManagerToolsState.skipAdvanceCooldown, !enabled)}
      </div>
      <div class="card"><p class="label">Estado de la partida</p><h3>Inspector</h3>${privateManagerToolsStatusRows()}</div>
    </div>
    <div class="card private-tools-actions-card"><p class="label">Acciones rápidas</p><h3>Calendario y recuperación</h3><div class="private-tools-action-grid">
      <button class="ghost" data-private-tool-action="advance-day" ${enabled && game ? '' : 'disabled'}>Avanzar un día</button>
      <button class="ghost" data-private-tool-action="advance-match" ${enabled && game ? '' : 'disabled'}>Ir al próximo partido</button>
      <button class="ghost" data-private-tool-action="recover-squad" ${enabled && game ? '' : 'disabled'}>Recuperar plantel</button>
      <button class="ghost" data-private-tool-action="add-youth" ${enabled && game ? '' : 'disabled'}>Agregar juveniles de prueba</button>
    </div></div>
    <div class="grid cols-2 private-tools-layout">
      <div class="card"><p class="label">Recursos</p><h3>Ajustes controlados</h3>
        <div class="private-tools-field"><label>Presupuesto del club</label><input id="privateToolsBudgetAmount" type="number" step="1000000" value="10000000"><button class="primary" data-private-tool-action="budget" ${enabled && game ? '' : 'disabled'}>Aplicar diferencia</button></div>
        <div class="private-tools-field"><label>Puntos de habilidad</label><input id="privateToolsSkillAmount" type="number" step="1000" value="10000"><button class="primary" data-private-tool-action="skill" ${enabled && game ? '' : 'disabled'}>Aplicar diferencia</button></div>
        <div class="private-tools-field"><label>Prestigio del mánager</label><input id="privateToolsPrestigeAmount" type="number" step="1" value="5"><button class="primary" data-private-tool-action="prestige" ${enabled && game ? '' : 'disabled'}>Aplicar diferencia</button></div>
      </div>
      <div class="card"><p class="label">Jugador seleccionado</p><h3>Situaciones de prueba</h3>
        <select id="privateToolsPlayer" ${enabled && game ? '' : 'disabled'}>${privateManagerToolsPlayerOptions()}</select>
        <div class="private-tools-action-grid compact">
          <button class="ghost" data-private-tool-action="injury" ${enabled && game ? '' : 'disabled'}>Generar lesión</button>
          <button class="ghost" data-private-tool-action="clear-injury" ${enabled && game ? '' : 'disabled'}>Dar alta</button>
          <button class="ghost" data-private-tool-action="offer" ${enabled && game ? '' : 'disabled'}>Generar oferta</button>
        </div>
      </div>
    </div>
    <div class="grid cols-2 private-tools-layout">
      <div class="card"><p class="label">Seguridad</p><h3>Copia previa</h3><p class="muted small">Se crea automáticamente antes de la primera modificación. Es independiente de la copia normal del guardado.</p><p class="small"><code>${escapeHtml(backupKey || 'Sin partida')}</code></p><button class="danger ghost" data-private-tool-action="restore" ${game ? '' : 'disabled'}>Restaurar copia previa</button></div>
      <div class="card"><p class="label">Registro</p><h3>Últimas modificaciones</h3>${privateManagerToolsLogMarkup()}</div>
    </div>`;
  bindPrivateManagerToolsView();
}

function privateManagerToolsToggle(key, checked){
  if(key === 'enabled'){
    privateManagerToolsState.enabled = Boolean(checked);
    if(!checked){
      privateManagerToolsState.revealHidden = false;
      privateManagerToolsState.skipAdvanceCooldown = false;
    }
  }else if(key === 'revealHidden' && privateManagerToolsActive()) privateManagerToolsState.revealHidden = Boolean(checked);
  else if(key === 'skipCooldown' && privateManagerToolsActive()){
    privateManagerToolsState.skipAdvanceCooldown = Boolean(checked);
    if(checked && typeof setAdvanceLock === 'function') setAdvanceLock(0);
  }
  privateManagerToolsBannerSync();
  renderAdminTools();
}
function privateManagerToolsReadNumber(id){
  const value = Number(document.getElementById(id)?.value || 0);
  return Number.isFinite(value) ? Math.round(value) : 0;
}
async function privateManagerToolsAction(action){
  if(action === 'restore') return privateManagerToolsRestoreBackup();
  if(action === 'advance-day'){
    return privateManagerToolsMutation('Día avanzado desde Administración', 'Avance manual del calendario', async()=>{
      if(typeof setAdvanceLock === 'function') setAdvanceLock(0);
      if(typeof advanceCalendarOneStep !== 'function') throw new Error('El avance diario no está disponible.');
      advanceCalendarOneStep();
      return true;
    });
  }
  if(action === 'advance-match'){
    return privateManagerToolsMutation('Calendario avanzado al próximo partido', 'Autoavance iniciado desde Administración', async()=>{
      if(typeof setAdvanceLock === 'function') setAdvanceLock(0);
      if(typeof startAutoAdvanceToNextOwnMatch !== 'function') throw new Error('El autoavance no está disponible.');
      startAutoAdvanceToNextOwnMatch();
      return true;
    });
  }
  if(action === 'recover-squad'){
    return privateManagerToolsMutation('Plantel recuperado', 'Estado físico y moral restaurados', async()=>{
      game.playerCondition = game.playerCondition || {};
      game.playerMorale = game.playerMorale || {};
      privateManagerToolsOwnPlayers().forEach(player => {
        game.playerCondition[player.id] = typeof maxConditionForPlayer === 'function' ? maxConditionForPlayer(player.id) : 99;
        game.playerMorale[player.id] = 99;
      });
      return true;
    });
  }
  if(action === 'add-youth'){
    return privateManagerToolsMutation('Juveniles de prueba agregados', 'Se agregaron juveniles directamente a la Academia', async()=>{
      if(typeof normalizeAcademyState !== 'function' || typeof createAcademyBatch !== 'function') throw new Error('La Academia no está disponible.');
      game.academy = normalizeAcademyState(game.academy);
      const slots = typeof academyAvailableSlots === 'function' ? academyAvailableSlots() : 0;
      const count = Math.min(3, Math.max(0, slots));
      if(count <= 0) throw new Error('No hay cupos libres en la Academia.');
      const batch = createAcademyBatch(count);
      game.academy.players.push(...batch);
      batch.forEach(player => {
        game.academy.trainingPlan[player.id] = game.academy.trainingPlan[player.id] || 'technical';
        game.academy.unlockedStats[player.id] = game.academy.unlockedStats[player.id] || [];
      });
      return true;
    });
  }
  if(action === 'budget'){
    const delta = privateManagerToolsReadNumber('privateToolsBudgetAmount');
    return privateManagerToolsMutation('Presupuesto ajustado', `${delta >= 0 ? '+' : ''}${delta}`, async()=>{
      const before = Math.max(0, Math.round(Number(game.budget || 0)));
      const appliedDelta = Math.max(-before, delta);
      if(typeof recordBudgetChange === 'function') recordBudgetChange(appliedDelta, 'Ajuste desde la vista privada de revisión', { type:'private_review' });
      else game.budget = Math.max(0, before + appliedDelta);
      game.clubBudgets = game.clubBudgets || {};
      game.clubBudgets[game.selectedClubId] = game.budget;
      return true;
    });
  }
  if(action === 'skill'){
    const delta = privateManagerToolsReadNumber('privateToolsSkillAmount');
    return privateManagerToolsMutation('Puntos de habilidad ajustados', `${delta >= 0 ? '+' : ''}${delta}`, async()=>{
      if(typeof ensureSpecialState === 'function') ensureSpecialState();
      game.special = game.special || {};
      game.special.puntos_habilidad = Math.max(0, Math.round(Number(game.special.puntos_habilidad || 0) + delta));
      return true;
    });
  }
  if(action === 'prestige'){
    const delta = privateManagerToolsReadNumber('privateToolsPrestigeAmount');
    return privateManagerToolsMutation('Prestigio del mánager ajustado', `${delta >= 0 ? '+' : ''}${delta}`, async()=>{
      if(typeof addManagerPrestige !== 'function') throw new Error('El prestigio no está disponible.');
      addManagerPrestige(delta * 2.5, 'Ajuste desde la vista privada de revisión');
      return true;
    });
  }
  const player = privateManagerToolsSelectedPlayer();
  if(!player){ showNotice('Elegí un jugador del plantel.'); return false; }
  if(action === 'injury'){
    return privateManagerToolsMutation(`Lesión generada para ${player.name}`, 'Lesión muscular de 21 días', async()=>{
      game.playerStatus = game.playerStatus || {};
      const duration = 21;
      game.playerStatus[player.id] = {
        ...(game.playerStatus[player.id] || {}),
        injuredAtTurn:typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game.globalTurn || 0),
        injuredUntilTurn:(typeof currentTurnIndex === 'function' ? currentTurnIndex() : Number(game.globalTurn || 0)) + duration,
        injuredThrough:Number(game.matchdayIndex || 0) + Math.max(1, Math.ceil(duration / Math.max(1, Number(typeof LEAGUE_ROUND_INTERVAL_DAYS !== 'undefined' ? LEAGUE_ROUND_INTERVAL_DAYS : 7)))),
        injuryLabel:'Lesión muscular de prueba',
        injuryChance:1
      };
      return true;
    });
  }
  if(action === 'clear-injury'){
    return privateManagerToolsMutation(`Alta médica para ${player.name}`, 'Lesión eliminada manualmente', async()=>{
      const status = game.playerStatus?.[player.id] || {};
      const { injuredThrough, injuredUntilTurn, injuredAtTurn, injuredAtMatchday, injuryLabel, injuryChance, ...rest } = status;
      game.playerStatus = game.playerStatus || {};
      game.playerStatus[player.id] = rest;
      return true;
    });
  }
  if(action === 'offer'){
    return privateManagerToolsMutation(`Oferta generada por ${player.name}`, 'Oferta de transferencia de prueba', async()=>{
      if(typeof buildTransferOfferFinancials !== 'function' || typeof botTransferOfferClub !== 'function' || typeof pushGameMessage !== 'function') throw new Error('El sistema de ofertas no está disponible.');
      if(typeof hasPendingTransferOfferForPlayer === 'function' && hasPendingTransferOfferForPlayer(player.id)) throw new Error('Ese jugador ya tiene una oferta pendiente.');
      const pct = 80;
      const financials = buildTransferOfferFinancials(player, pct);
      const source = botTransferOfferClub(player);
      pushGameMessage({
        type:'mercado', priority:'high', title:`Oferta de prueba por ${typeof playerLastName === 'function' ? playerLastName(player.name) : player.name}`,
        body:typeof transferOfferBody === 'function' ? transferOfferBody(source, player, financials, pct, 'Oferta creada desde la vista privada de revisión.') : `${source.name} presentó una oferta de ${formatMoney(financials.grossAmount)}.`,
        action:{ type:'transferOffer', status:'pending', origin:'private_review', playerId:player.id, amount:financials.grossAmount, grossAmount:financials.grossAmount, taxAmount:financials.taxAmount, netAmount:financials.netAmount, foreignClub:source.name, sourceClubId:source.id, pct }
      });
      return true;
    });
  }
  return false;
}
function bindPrivateManagerToolsView(){
  document.querySelectorAll('[data-private-tools-toggle]').forEach(input => input.addEventListener('change', () => privateManagerToolsToggle(input.dataset.privateToolsToggle, input.checked)));
  document.querySelectorAll('[data-private-tool-action]').forEach(button => button.addEventListener('click', () => privateManagerToolsAction(button.dataset.privateToolAction)));
}

/* La revelación es visual y no modifica el guardado. */
(function installPrivateManagerToolsVisualHooks(){
  if(typeof window === 'undefined') return;
  const originalPlayerRequiresScouting = typeof playerRequiresScouting === 'function' ? playerRequiresScouting : null;
  if(originalPlayerRequiresScouting){
    window.playerRequiresScouting = function(player){
      if(privateManagerToolsActive() && privateManagerToolsState.revealHidden) return false;
      return originalPlayerRequiresScouting(player);
    };
  }
  const originalScoutingKnownSet = typeof scoutingKnownSet === 'function' ? scoutingKnownSet : null;
  if(originalScoutingKnownSet){
    window.scoutingKnownSet = function(playerId){
      if(privateManagerToolsActive() && privateManagerToolsState.revealHidden){
        const player = typeof playerById === 'function' ? playerById(Number(playerId || 0)) : null;
        const keys = new Set();
        if(player && typeof scoutingDetailedStatMap === 'function') Object.keys(scoutingDetailedStatMap(player) || {}).forEach(key => keys.add(key));
        if(player && typeof scoutingHiddenStatMap === 'function') Object.keys(scoutingHiddenStatMap(player) || {}).forEach(key => keys.add(key));
        if(typeof SCOUTING_SIGNING_CHANCE_KEY !== 'undefined') keys.add(SCOUTING_SIGNING_CHANCE_KEY);
        return keys;
      }
      return originalScoutingKnownSet(playerId);
    };
  }
  const originalAdvanceLockLeftMs = typeof advanceLockLeftMs === 'function' ? advanceLockLeftMs : null;
  if(originalAdvanceLockLeftMs){
    window.advanceLockLeftMs = function(){
      if(privateManagerToolsActive() && privateManagerToolsState.skipAdvanceCooldown) return 0;
      return originalAdvanceLockLeftMs();
    };
  }
  const originalIsAdvanceLocked = typeof isAdvanceLocked === 'function' ? isAdvanceLocked : null;
  if(originalIsAdvanceLocked){
    window.isAdvanceLocked = function(){
      if(privateManagerToolsActive() && privateManagerToolsState.skipAdvanceCooldown) return false;
      return originalIsAdvanceLocked();
    };
  }
})();


async function privateManagerToolsVerifyExistingSession(){
  if(privateManagerToolsAuthorized()) return true;
  const token = typeof rankingStoredAuthToken === 'function' ? String(rankingStoredAuthToken() || '').trim() : '';
  const storedUser = typeof rankingStoredAuthUsername === 'function' ? String(rankingStoredAuthUsername() || '').trim() : '';
  if(!token || storedUser !== PRIVATE_MANAGER_TOOLS_USERNAME || typeof checkRankingSession !== 'function') return false;
  try{ return await checkRankingSession({ automatic:true }); }
  catch(_error){ return false; }
}

window.addEventListener('fm:auth-changed', () => syncPrivateManagerToolsNavigation());
window.addEventListener('storage', event => {
  if(['fmRankingAuthToken','fmRankingAuthUser'].includes(String(event.key || ''))) {
    if(!rankingStoredAuthToken()) privateManagerToolsRemoveNavigation();
    else privateManagerToolsVerifyExistingSession().then(syncPrivateManagerToolsNavigation);
  }
});
window.addEventListener('DOMContentLoaded', () => {
  syncPrivateManagerToolsNavigation();
  setTimeout(() => privateManagerToolsVerifyExistingSession().then(syncPrivateManagerToolsNavigation), 0);
});
