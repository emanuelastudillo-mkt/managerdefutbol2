/* V9.13 · Cola cooperativa para mantenimiento no crítico y diagnósticos de rendimiento. */

const PERFORMANCE_BACKGROUND_ENABLED = configBoolean('rendimiento.procesamientoSegundoPlano', true);
const PERFORMANCE_IDLE_TIMEOUT_MS = Math.max(100, Math.round(configNumber('rendimiento.timeoutTareaSegundoPlanoMs', 1200, 100, 10000)));
const PERFORMANCE_FALLBACK_DELAY_MS = Math.max(0, Math.round(configNumber('rendimiento.pausaEntreTareasMs', 24, 0, 500)));
const PERFORMANCE_MAX_TASKS_PER_SLICE = Math.max(1, Math.round(configNumber('rendimiento.tareasPorBloque', 1, 1, 10)));
const PERFORMANCE_CALENDAR_AUDIT_DAYS = Math.max(1, Math.round(configNumber('rendimiento.auditoriaCalendarioCompletaCadaDias', 7, 1, 60)));
const PERFORMANCE_MATCH_STATS_AUDIT_DAYS = Math.max(1, Math.round(configNumber('rendimiento.integridadEstadisticasCompletaCadaDias', 7, 1, 60)));
const PERFORMANCE_BOT_ROSTER_DAYS = Math.max(1, Math.round(configNumber('rendimiento.reparacionPlantelesBotsCadaDias', 7, 1, 60)));
const PERFORMANCE_CONTRACT_NORMALIZE_DAYS = Math.max(1, Math.round(configNumber('rendimiento.normalizacionContratosCadaDias', 30, 1, 365)));

const performanceTaskQueue = [];
const performanceQueuedKeys = new Set();
const performanceSessionMarks = new Set();
const performancePendingMaintenance = new Set();
const performanceDiagnostics = [];
let performanceQueueScheduled = false;
let performanceQueueRunning = false;
let performanceQueueNeedsSave = false;

function performanceIsoDate(value){
  const clean = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(clean) ? clean : '';
}
function performanceCurrentDate(){
  const direct = performanceIsoDate(game?.currentDate);
  if(direct) return direct;
  try{
    const fallback = typeof currentCalendarDate === 'function' ? currentCalendarDate() : '';
    return performanceIsoDate(fallback);
  }catch(_error){ return ''; }
}
function performanceDateNumber(value){
  const clean = performanceIsoDate(value);
  if(!clean) return NaN;
  const [year, month, day] = clean.split('-').map(Number);
  return Date.UTC(year, month - 1, day) / 86400000;
}
function performanceDaysBetween(fromDate, toDate){
  const from = performanceDateNumber(fromDate);
  const to = performanceDateNumber(toDate);
  return Number.isFinite(from) && Number.isFinite(to) ? Math.round(to - from) : 0;
}
function performanceMaintenanceState(){
  if(!game) return null;
  const state = game.performanceMaintenance && typeof game.performanceMaintenance === 'object' && !Array.isArray(game.performanceMaintenance)
    ? game.performanceMaintenance
    : {};
  state.version = 1;
  state.tasks = state.tasks && typeof state.tasks === 'object' && !Array.isArray(state.tasks) ? state.tasks : {};
  game.performanceMaintenance = state;
  return state;
}
function performanceTaskDue(taskName, everyDays, date=performanceCurrentDate()){
  if(!game || !taskName || !performanceIsoDate(date)) return false;
  if(performancePendingMaintenance.has(String(taskName))) return false;
  const state = performanceMaintenanceState();
  const previous = state?.tasks?.[taskName];
  const season = Number(game?.seasonNumber || 1);
  if(!previous || Number(previous.season || 0) !== season) return true;
  const lastDate = performanceIsoDate(previous.date);
  if(!lastDate) return true;
  return performanceDaysBetween(lastDate, date) >= Math.max(1, Number(everyDays || 1));
}
function performanceMarkTask(taskName, date=performanceCurrentDate(), details={}){
  const state = performanceMaintenanceState();
  if(!state || !taskName) return;
  state.tasks[taskName] = {
    date:performanceIsoDate(date),
    season:Number(game?.seasonNumber || 1),
    turn:Number(game?.globalTurn || 0),
    durationMs:Math.max(0, Math.round(Number(details.durationMs || 0))),
    changed:Boolean(details.changed)
  };
}
function performanceResultChanged(result){
  if(result === true) return true;
  if(!result || typeof result !== 'object') return false;
  const direct = ['changed','repaired','created','restored','dismissed','sanctioned'].some(key => result[key] === true);
  if(direct) return true;
  return ['fixed','created','converted','signedFreeAgents','normalized','restoredMissing','restoredPlayed','duplicatesRemoved','rescheduled','resetFutureDates','structureMoves','fixturesRebuilt']
    .some(key => Number(result[key] || 0) > 0);
}
function performanceRecordDiagnostic(entry){
  performanceDiagnostics.push({ ...entry, recordedAt:new Date().toISOString() });
  if(performanceDiagnostics.length > 40) performanceDiagnostics.splice(0, performanceDiagnostics.length - 40);
}
function performanceYield(){
  return new Promise(resolve => setTimeout(resolve, PERFORMANCE_FALLBACK_DELAY_MS));
}
function performanceScheduleRunner(){
  if(performanceQueueScheduled || performanceQueueRunning || !performanceTaskQueue.length) return;
  performanceQueueScheduled = true;
  const run = deadline => {
    performanceQueueScheduled = false;
    performanceRunQueue(deadline).catch(error => console.warn('V9.13: tarea de segundo plano interrumpida', error));
  };
  if(PERFORMANCE_BACKGROUND_ENABLED && typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout:PERFORMANCE_IDLE_TIMEOUT_MS });
  else setTimeout(() => run({ didTimeout:true, timeRemaining:() => 0 }), PERFORMANCE_FALLBACK_DELAY_MS);
}
async function performanceRunQueue(deadline){
  if(performanceQueueRunning) return;
  performanceQueueRunning = true;
  let processed = 0;
  try{
    while(performanceTaskQueue.length && processed < PERFORMANCE_MAX_TASKS_PER_SLICE){
      if(processed > 0 && deadline && !deadline.didTimeout && typeof deadline.timeRemaining === 'function' && deadline.timeRemaining() < 5) break;
      const task = performanceTaskQueue.shift();
      performanceQueuedKeys.delete(task.key);
      if(!task || (task.requiresGame !== false && !game)){
        if(task?.maintenanceName) performancePendingMaintenance.delete(task.maintenanceName);
        continue;
      }
      if(task.gameRef && task.gameRef !== game){
        if(task.maintenanceName) performancePendingMaintenance.delete(task.maintenanceName);
        continue;
      }
      const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      let result = null;
      let error = null;
      try{ result = await Promise.resolve(task.run()); }
      catch(caught){ error = caught; console.warn(`V9.13: falló la tarea ${task.key}`, caught); }
      const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
      const durationMs = Math.max(0, ended - started);
      const changed = !error && performanceResultChanged(result);
      if(task.maintenanceName){
        performancePendingMaintenance.delete(task.maintenanceName);
        if(!error) performanceMarkTask(task.maintenanceName, performanceCurrentDate() || task.date, { durationMs, changed });
      }
      performanceQueueNeedsSave = performanceQueueNeedsSave || changed || Boolean(game?._needsAutosave) || Boolean(task.markState);
      performanceRecordDiagnostic({ key:task.key, durationMs:Math.round(durationMs), changed, error:error ? String(error?.message || error) : '' });
      processed += 1;
      if(performanceTaskQueue.length) await performanceYield();
    }
  }finally{
    performanceQueueRunning = false;
  }
  if(!performanceTaskQueue.length && performanceQueueNeedsSave && game && typeof saveLocal === 'function'){
    performanceQueueNeedsSave = false;
    Promise.resolve(saveLocal(true)).catch(()=>{});
  }
  if(performanceTaskQueue.length) performanceScheduleRunner();
}
function scheduleBackgroundGameTask(key, run, options={}){
  const cleanKey = String(key || '').trim();
  if(!cleanKey || typeof run !== 'function') return false;
  if(performanceQueuedKeys.has(cleanKey)) return false;
  performanceQueuedKeys.add(cleanKey);
  if(options.maintenanceName) performancePendingMaintenance.add(String(options.maintenanceName));
  performanceTaskQueue.push({
    key:cleanKey,
    run,
    maintenanceName:String(options.maintenanceName || ''),
    date:performanceIsoDate(options.date || performanceCurrentDate()),
    markState:Boolean(options.markState),
    requiresGame:options.requiresGame !== false,
    gameRef:options.requiresGame === false ? null : game
  });
  performanceScheduleRunner();
  return true;
}
function scheduleRenderMaintenance(){
  if(!game || game?.gameOver?.active) return false;
  const date = performanceCurrentDate() || `turn-${Number(game?.globalTurn || 0)}`;
  const key = `render-maintenance:${String(game?.saveSlotId || 'game')}:${Number(game?.seasonNumber || 1)}:${Number(game?.selectedClubId || 0)}:${date}`;
  if(performanceSessionMarks.has(key)) return false;
  performanceSessionMarks.add(key);
  if(performanceSessionMarks.size > 500){
    const oldest = performanceSessionMarks.values().next().value;
    if(oldest) performanceSessionMarks.delete(oldest);
  }
  return scheduleBackgroundGameTask(key, () => {
    let changed = false;
    if(typeof syncPlayerStarsWithClubs === 'function') changed = Number(syncPlayerStarsWithClubs(game) || 0) > 0 || changed;
    if(typeof refreshAssistantCoachAnalysisAvailability === 'function') changed = Boolean(refreshAssistantCoachAnalysisAvailability({ notify:true, save:false })) || changed;
    if(typeof ensureClubWorldCupCurrentSeason === 'function') changed = Boolean(ensureClubWorldCupCurrentSeason({ source:'background_render_v913' })?.changed) || changed;
    return { changed };
  }, { date });
}
function performanceTaskOverdueScore(taskName, everyDays, date){
  const previous = performanceMaintenanceState()?.tasks?.[taskName];
  if(!previous || Number(previous.season || 0) !== Number(game?.seasonNumber || 1)) return Number.MAX_SAFE_INTEGER;
  const elapsed = performanceDaysBetween(previous.date, date);
  return Math.max(0, elapsed - Math.max(1, Number(everyDays || 1))) / Math.max(1, Number(everyDays || 1));
}
function scheduleDailyBackgroundMaintenance(reason='daily'){
  if(!game) return false;
  const date = performanceCurrentDate();
  if(!date) return false;
  const season = Number(game?.seasonNumber || 1);
  const scope = String(game?.saveSlotId || game?.saveCode || 'game').replace(/[^a-z0-9:_-]+/gi,'-');
  const maintenanceState = performanceMaintenanceState();
  if(reason === 'load'){
    // La carga ya normaliza contratos, repara planteles y ejecuta la auditoría de calendario.
    // Se registran esas tareas para no repetirlas inmediatamente al entrar a la partida.
    if(performanceTaskDue('calendar_full_audit', PERFORMANCE_CALENDAR_AUDIT_DAYS, date)) performanceMarkTask('calendar_full_audit', date, { changed:false });
    if(performanceTaskDue('bot_roster_full_repair', PERFORMANCE_BOT_ROSTER_DAYS, date)) performanceMarkTask('bot_roster_full_repair', date, { changed:false });
    if(performanceTaskDue('contracts_normalization', PERFORMANCE_CONTRACT_NORMALIZE_DAYS, date)) performanceMarkTask('contracts_normalization', date, { changed:false });
    performanceQueueNeedsSave = true;
  }

  // Como máximo se programa un mantenimiento pesado por fecha del juego. Si varias
  // tareas vencen juntas, las restantes se reparten automáticamente en días sucesivos.
  if(performanceIsoDate(maintenanceState?.lastHeavyScheduleDate) === date) return false;
  const candidates = [
    {
      name:'calendar_full_audit', every:PERFORMANCE_CALENDAR_AUDIT_DAYS, priority:1,
      available:typeof window.runCalendarIntegrityAudit === 'function',
      key:`calendar-full-audit:${scope}:${season}:${date}`,
      run:() => { const auditDate=performanceCurrentDate() || date; return window.runCalendarIntegrityAudit(game, { referenceDate:auditDate, reason:`background_${reason}_v913`, force:true }); }
    },
    {
      name:'match_stats_full_audit', every:PERFORMANCE_MATCH_STATS_AUDIT_DAYS, priority:2,
      available:typeof runDailyMatchStatsIntegrityRepair === 'function',
      key:`match-stats-full-audit:${scope}:${season}:${date}`,
      run:() => runDailyMatchStatsIntegrityRepair({ reason:`background_${reason}_v913`, force:true, silent:true })
    },
    {
      name:'bot_roster_full_repair', every:PERFORMANCE_BOT_ROSTER_DAYS, priority:3,
      available:typeof repairBotRosters === 'function',
      key:`bot-roster-full-repair:${scope}:${season}:${date}`,
      run:() => repairBotRosters({ reason:`background_${reason}_v913`, force:true })
    },
    {
      name:'contracts_normalization', every:PERFORMANCE_CONTRACT_NORMALIZE_DAYS, priority:4,
      available:typeof ensureAllPlayerContracts === 'function',
      key:`contracts-normalization:${scope}:${season}:${date}`,
      run:() => ensureAllPlayerContracts(game, { force:true })
    }
  ].filter(task => task.available && performanceTaskDue(task.name, task.every, date));
  if(!candidates.length) return false;
  candidates.sort((a,b) => {
    const overdueDiff = performanceTaskOverdueScore(b.name,b.every,date) - performanceTaskOverdueScore(a.name,a.every,date);
    return overdueDiff || a.priority - b.priority;
  });
  const selected = candidates[0];
  maintenanceState.lastHeavyScheduleDate = date;
  maintenanceState.lastHeavyScheduleTask = selected.name;
  performanceQueueNeedsSave = true;
  const scheduled = scheduleBackgroundGameTask(selected.key, selected.run, { maintenanceName:selected.name, date, markState:true });
  if(!scheduled){
    maintenanceState.lastHeavyScheduleDate = '';
    maintenanceState.lastHeavyScheduleTask = '';
  }
  return scheduled;
}
function getPerformanceDiagnostics(){
  return {
    queued:performanceTaskQueue.map(task => task.key),
    running:performanceQueueRunning,
    recent:performanceDiagnostics.slice(-20),
    maintenance:game?.performanceMaintenance || null
  };
}

window.scheduleBackgroundGameTask = scheduleBackgroundGameTask;
window.scheduleRenderMaintenance = scheduleRenderMaintenance;
window.scheduleDailyBackgroundMaintenance = scheduleDailyBackgroundMaintenance;
window.getPerformanceDiagnostics = getPerformanceDiagnostics;
