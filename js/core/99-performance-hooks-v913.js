/* V9.13 · Enganche final: el mantenimiento pesado no bloquea el avance diario. */
(function installPerformanceHooksV913(){
  if(typeof processDailyCalendarState === 'function' && !processDailyCalendarState.__performanceV913){
    const originalProcessDailyCalendarState = processDailyCalendarState;
    const wrapped = function(dateAfter='', options={}){
      const result = originalProcessDailyCalendarState.call(this, dateAfter, options) || {};
      if(typeof scheduleDailyBackgroundMaintenance === 'function') scheduleDailyBackgroundMaintenance(options.managerWithoutClub ? 'managerless_day' : 'daily_advance');
      return result;
    };
    wrapped.__performanceV913 = true;
    processDailyCalendarState = wrapped;
  }
  if(typeof renderAll === 'function' && !renderAll.__performanceV913){
    const originalRenderAll = renderAll;
    const wrapped = function(...args){
      const result = originalRenderAll.apply(this, args);
      if(game && typeof scheduleRenderMaintenance === 'function') scheduleRenderMaintenance();
      return result;
    };
    wrapped.__performanceV913 = true;
    renderAll = wrapped;
  }
  if(typeof loadLocal === 'function' && !loadLocal.__performanceV913){
    const originalLoadLocal = loadLocal;
    const wrapped = async function(...args){
      const result = await originalLoadLocal.apply(this, args);
      if(result && typeof scheduleDailyBackgroundMaintenance === 'function') scheduleDailyBackgroundMaintenance('load');
      return result;
    };
    wrapped.__performanceV913 = true;
    loadLocal = wrapped;
  }
})();
