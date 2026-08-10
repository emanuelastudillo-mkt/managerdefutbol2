/* V8.76 · Integración y control de frecuencia del sistema de carrera.
   Motor central de decisiones, eventos automáticos, consecuencias diferidas y memoria narrativa. */

(function(){
  'use strict';

  const CAREER_EVENT_VERSION = 2;
  const CAPABILITIES = ['sporting','leadership','economy','development','crisis','stability'];
  const CAPABILITY_LABELS = {
    sporting:'Rendimiento deportivo', leadership:'Liderazgo', economy:'Gestión económica',
    development:'Desarrollo de jugadores', crisis:'Manejo de crisis', stability:'Estabilidad'
  };
  const GROUP_LABELS = { starter:'titulares', rotation:'rotación', substitute:'suplentes', youth:'jóvenes', referent:'referentes', all:'plantel' };

  function ceCfg(path, fallback){
    return typeof configValue === 'function' ? configValue(`manager.carrera.motorEventos.${path}`, fallback) : fallback;
  }
  function ceClamp(value, min, max){
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }
  function ceRound(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : Math.round(Number(fallback || 0));
  }
  function ceAverage(values=[]){
    const clean = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  }
  function ceNow(){
    return String(game?.currentDate || (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '') || new Date().toISOString().slice(0,10));
  }
  function ceDay(){
    return typeof currentGlobalDayNumber === 'function'
      ? Math.max(1, ceRound(currentGlobalDayNumber(), 1))
      : Math.max(1, ceRound(game?.globalTurn || game?.matchdayIndex || 1, 1));
  }
  function ceAddDays(date, days){
    if(typeof addDaysToIsoDate === 'function' && typeof validIsoDate === 'function' && validIsoDate(date)) return addDaysToIsoDate(date, days);
    const source = new Date(`${date || new Date().toISOString().slice(0,10)}T12:00:00Z`);
    source.setUTCDate(source.getUTCDate() + ceRound(days));
    return source.toISOString().slice(0,10);
  }
  function ceHash(key, max=1000000){
    if(typeof hashNumber === 'function') return hashNumber(String(key || ''), Math.max(1, max));
    let hash = 2166136261;
    for(const char of String(key || '')) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    return Math.abs(hash) % Math.max(1, max);
  }
  function ceClub(clubId){ return (seed?.clubs || []).find(club => Number(club.id) === Number(clubId)) || null; }
  function cePlayer(playerId){
    if(typeof playerById === 'function') return playerById(playerId);
    return (seed?.players || []).find(player => Number(player.id) === Number(playerId)) || null;
  }
  function cePlayers(clubId=game?.selectedClubId){
    if(typeof playersByClub === 'function') return playersByClub(clubId).filter(player => !player?.retired && !player?.sold);
    return (seed?.players || []).filter(player => Number(player.clubId) === Number(clubId) && !player?.retired && !player?.sold);
  }
  function ceCurrentStintKey(){
    const current = game?.managerStats?.currentSeason || {};
    if(current.careerStintId) return String(current.careerStintId);
    const season = Math.max(1, ceRound(game?.seasonNumber || current.season || 1));
    const clubId = Math.max(0, ceRound(game?.selectedClubId || current.clubId || 0));
    const baseline = Object.values(game?.managerCareerBaselines || {}).filter(item => Number(item?.season || 0) === season && Number(item?.clubId || 0) === clubId).sort((a,b) => Number(b?.joinedDay || 0) - Number(a?.joinedDay || 0))[0];
    const turn = Math.max(0, ceRound(game?.globalTurn || 0));
    const date = String(game?.currentDate || ceNow() || 'inicio').replace(/[^0-9A-Za-z_-]/g, '');
    const key = String(baseline?.key || `s${season}-c${clubId}-t${turn}-${date}`);
    current.careerStintId = key;
    if(game?.managerStats) game.managerStats.currentSeason = current;
    return key;
  }
  function ceActiveCareer(){
    return Boolean(game && !game?.gameOver?.active && !game?.seasonFinalized && Number(game?.selectedClubId || 0) > 0 && game?.managerStats?.currentSeason);
  }

  function ceNormalizeSignals(raw={}){
    return CAPABILITIES.reduce((result, key) => {
      result[key] = ceClamp(Number(raw?.[key] || 0), -20, 20);
      return result;
    }, {});
  }
  function ceNormalizeStint(raw={}, key=''){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      key:String(source.key || key || ''),
      season:Math.max(1, ceRound(source.season || game?.seasonNumber || 1)),
      clubId:Math.max(0, ceRound(source.clubId || game?.selectedClubId || 0)),
      boardConfidence:ceClamp(Number(source.boardConfidence ?? 50), 0, 100),
      initializedDate:String(source.initializedDate || ceNow()),
      initializedDay:Math.max(0, ceRound(source.initializedDay || 0)),
      startMatchCount:Math.max(0, ceRound(source.startMatchCount || 0)),
      lastProcessedDate:String(source.lastProcessedDate || ''),
      lastCheckDay:Math.max(0, ceRound(source.lastCheckDay || 0)),
      lastInteractiveDay:Math.max(0, ceRound(source.lastInteractiveDay || 0)),
      lastAutomaticDay:Math.max(0, ceRound(source.lastAutomaticDay || 0)),
      lastCategoryDays:source.lastCategoryDays && typeof source.lastCategoryDays === 'object' && !Array.isArray(source.lastCategoryDays) ? Object.fromEntries(Object.entries(source.lastCategoryDays).map(([category,day]) => [String(category), Math.max(0, ceRound(day || 0))])) : {},
      recentEventIds:Array.isArray(source.recentEventIds) ? source.recentEventIds.map(item => ({ id:String(item?.id || ''), day:Math.max(0, ceRound(item?.day || 0)) })).filter(item => item.id).slice(-36) : [],
      signals:ceNormalizeSignals(source.signals || {}),
      signalLog:Array.isArray(source.signalLog) ? source.signalLog.map(item => ({ capability:String(item?.capability || ''), delta:Number(item?.delta || 0), reason:String(item?.reason || ''), day:ceRound(item?.day || 0), date:String(item?.date || '') })).filter(item => CAPABILITIES.includes(item.capability)).slice(-80) : [],
      snapshot:source.snapshot && typeof source.snapshot === 'object' && !Array.isArray(source.snapshot) ? { ...source.snapshot } : {},
      finalizations:Array.isArray(source.finalizations) ? source.finalizations.map(String).slice(-8) : []
    };
  }
  function normalizeManagerCareerEvents(raw={}){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const stints = {};
    Object.entries(source.stints || {}).forEach(([key, value]) => { stints[String(key)] = ceNormalizeStint(value, key); });
    const records = (Array.isArray(source.records) ? source.records : []).map(item => ({
      id:String(item?.id || ''), source:String(item?.source || 'career_event'), kind:String(item?.kind || 'decision'),
      eventId:String(item?.eventId || ''), category:String(item?.category || ''), title:String(item?.title || ''),
      season:Math.max(1, ceRound(item?.season || 1)), clubId:Math.max(0, ceRound(item?.clubId || 0)), stintKey:String(item?.stintKey || ''),
      day:Math.max(0, ceRound(item?.day || 0)), date:String(item?.date || ''), status:String(item?.status || 'resolved'),
      optionId:String(item?.optionId || ''), optionText:String(item?.optionText || ''), result:String(item?.result || ''),
      resultText:String(item?.resultText || ''), importance:ceClamp(ceRound(item?.importance || 1), 1, 3),
      participantIds:Array.isArray(item?.participantIds) ? item.participantIds.map(Number).filter(Number.isFinite) : [],
      signal:item?.signal && typeof item.signal === 'object' ? { ...item.signal } : {}, consequenceId:String(item?.consequenceId || '')
    })).filter(item => item.id).slice(-Math.max(120, ceRound(ceCfg('maximoRegistros', 260), 260)));
    const consequences = (Array.isArray(source.consequences) ? source.consequences : []).map(item => ({
      id:String(item?.id || ''), decisionId:String(item?.decisionId || ''), messageId:String(item?.messageId || ''), eventId:String(item?.eventId || ''),
      season:Math.max(1, ceRound(item?.season || 1)), clubId:Math.max(0, ceRound(item?.clubId || 0)), stintKey:String(item?.stintKey || ''),
      playerId:Math.max(0, ceRound(item?.playerId || 0)), group:String(item?.group || ''), createdDay:Math.max(0, ceRound(item?.createdDay || 0)),
      dueDay:Math.max(1, ceRound(item?.dueDay || 1)), dueDate:String(item?.dueDate || ''), condition:String(item?.condition || 'results'),
      data:item?.data && typeof item.data === 'object' && !Array.isArray(item.data) ? { ...item.data } : {},
      successEffects:Array.isArray(item?.successEffects) ? item.successEffects.map(effect => ({ ...effect })) : [],
      failureEffects:Array.isArray(item?.failureEffects) ? item.failureEffects.map(effect => ({ ...effect })) : [],
      successText:String(item?.successText || ''), failureText:String(item?.failureText || ''),
      status:String(item?.status || 'pending'), result:String(item?.result || ''), resolvedDay:Math.max(0, ceRound(item?.resolvedDay || 0)), resolvedDate:String(item?.resolvedDate || '')
    })).filter(item => item.id).slice(-Math.max(80, ceRound(ceCfg('maximoConsecuencias', 160), 160)));
    return { version:CAREER_EVENT_VERSION, stints, records, consequences, lastProcessedDate:String(source.lastProcessedDate || '') };
  }
  window.normalizeManagerCareerEvents = normalizeManagerCareerEvents;

  function ceMergeCurrentStintAliases(state){
    if(!state || !ceActiveCareer()) return state;
    const stableKey = ceCurrentStintKey();
    const season = Math.max(1, ceRound(game?.seasonNumber || 1));
    const clubId = Math.max(0, ceRound(game?.selectedClubId || 0));
    const baseline = game?.managerCareerBaselines?.[stableKey] || null;
    const aliases = Object.entries(state.stints || {}).filter(([key,stint]) => key !== stableKey && Number(stint?.season || 0) === season && Number(stint?.clubId || 0) === clubId);
    const stable = state.stints[stableKey] ? ceNormalizeStint(state.stints[stableKey], stableKey) : ceNormalizeStint({ key:stableKey, season, clubId, initializedDate:String(baseline?.joinedDate || ceNow()), initializedDay:Math.max(1,ceRound(baseline?.joinedDay || ceDay())), startMatchCount:ceOfficialMatches().length }, stableKey);
    const candidates = [stable, ...aliases.map(([,stint]) => ceNormalizeStint(stint))].sort((a,b) => Number(a.lastCheckDay || 0) - Number(b.lastCheckDay || 0));
    const latest = candidates[candidates.length - 1] || stable;
    stable.boardConfidence = Number(latest.boardConfidence ?? stable.boardConfidence ?? 50);
    stable.lastProcessedDate = String(latest.lastProcessedDate || stable.lastProcessedDate || '');
    stable.lastCheckDay = Math.max(...candidates.map(item => Number(item.lastCheckDay || 0)), 0);
    stable.lastInteractiveDay = Math.max(...candidates.map(item => Number(item.lastInteractiveDay || 0)), 0);
    stable.lastAutomaticDay = Math.max(...candidates.map(item => Number(item.lastAutomaticDay || 0)), 0);
    const initializedDays = candidates.map(item => Number(item.initializedDay || 0)).filter(value => value > 0);
    stable.initializedDay = initializedDays.length ? Math.min(...initializedDays) : 0;
    stable.initializedDate = candidates.map(item => String(item.initializedDate || '')).filter(Boolean).sort()[0] || ceNow();
    const startMatchCounts = candidates.map(item => Number(item.startMatchCount || 0)).filter(value => value > 0);
    stable.startMatchCount = startMatchCounts.length ? Math.min(...startMatchCounts) : ceOfficialMatches().length;
    stable.recentEventIds = [...new Map(candidates.flatMap(item => item.recentEventIds || []).sort((a,b) => Number(a.day || 0) - Number(b.day || 0)).map(item => [`${item.id}:${item.day}`, item])).values()].slice(-36);
    stable.lastCategoryDays = {};
    candidates.forEach(item => Object.entries(item.lastCategoryDays || {}).forEach(([category,day]) => { stable.lastCategoryDays[category] = Math.max(Number(stable.lastCategoryDays[category] || 0), Number(day || 0)); }));
    stable.signals = ceNormalizeSignals(latest.signals || stable.signals || {});
    stable.signalLog = Array.isArray(latest.signalLog) ? latest.signalLog.slice(-80) : stable.signalLog;
    stable.snapshot = latest.snapshot && typeof latest.snapshot === 'object' ? { ...latest.snapshot } : stable.snapshot;
    stable.finalizations = [...new Set(candidates.flatMap(item => item.finalizations || []))].slice(-8);
    state.stints[stableKey] = stable;
    const aliasKeys = new Set(aliases.map(([key]) => key));
    state.records.forEach(item => { if(aliasKeys.has(String(item.stintKey || '')) || (Number(item.season || 0) === season && Number(item.clubId || 0) === clubId && !item.stintKey)) item.stintKey = stableKey; });
    state.consequences.forEach(item => { if(aliasKeys.has(String(item.stintKey || '')) || (Number(item.season || 0) === season && Number(item.clubId || 0) === clubId && !item.stintKey)) item.stintKey = stableKey; });
    (game?.messages || []).forEach(message => {
      const action = message?.action;
      if(action?.type !== 'managerCareerDecision') return;
      if(aliasKeys.has(String(action.stintKey || '')) || (Number(action.season || 0) === season && Number(action.clubId || 0) === clubId && !action.stintKey)) action.stintKey = stableKey;
    });
    aliases.forEach(([key]) => { delete state.stints[key]; });
    return state;
  }

  function ensureManagerCareerEvents(){
    if(!game) return normalizeManagerCareerEvents({});
    const current = game.managerCareerEvents;
    const valid = current && typeof current === 'object' && !Array.isArray(current)
      && Number(current.version || 0) === CAREER_EVENT_VERSION
      && current.stints && typeof current.stints === 'object' && !Array.isArray(current.stints)
      && Array.isArray(current.records) && Array.isArray(current.consequences);
    if(!valid) game.managerCareerEvents = normalizeManagerCareerEvents(current || {});
    ceMergeCurrentStintAliases(game.managerCareerEvents);
    return game.managerCareerEvents;
  }
  function ceInitialBoardConfidence(){
    const profile = game?.managerStats?.careerProfile || {};
    const stability = Number(profile.capabilities?.stability || 10);
    const moment = Number(profile.moment || 0);
    const prestige = typeof managerCareerPrestigeToClubScale === 'function' ? managerCareerPrestigeToClubScale(Number(profile.prestige || 0)) : Number(profile.prestige || 0) / 10;
    return ceClamp(48 + (stability - 50) * 0.12 + moment * 0.08 + (prestige - 40) * 0.05, 35, 68);
  }
  function ceStint(){
    if(!ceActiveCareer()) return null;
    const state = ensureManagerCareerEvents();
    const key = ceCurrentStintKey();
    if(!state.stints[key]){
      const baseline = game?.managerCareerBaselines?.[key] || null;
      state.stints[key] = ceNormalizeStint({
        key, season:game.seasonNumber || 1, clubId:game.selectedClubId || 0,
        boardConfidence:ceInitialBoardConfidence(), initializedDate:String(baseline?.joinedDate || ceNow()),
        initializedDay:Math.max(1, ceRound(baseline?.joinedDay || ceDay())), startMatchCount:ceOfficialMatches().length
      }, key);
    }
    const stint = state.stints[key];
    const baseline = game?.managerCareerBaselines?.[key] || null;
    if(!Number(stint.initializedDay || 0)) stint.initializedDay = Math.max(1, ceRound(baseline?.joinedDay || ceDay()));
    if(!Number.isFinite(Number(stint.startMatchCount))) stint.startMatchCount = ceOfficialMatches().length;
    return stint;
  }
  function ceBoard(delta, reason=''){ 
    const stint = ceStint();
    if(!stint || !Number.isFinite(Number(delta)) || Number(delta) === 0) return 0;
    const before = Number(stint.boardConfidence || 50);
    stint.boardConfidence = ceClamp(Number((before + Number(delta)).toFixed(1)), 0, 100);
    return Number((stint.boardConfidence - before).toFixed(1));
  }
  function ceSignal(capability, delta, reason=''){
    const stint = ceStint();
    if(!stint || !CAPABILITIES.includes(capability) || !Number.isFinite(Number(delta)) || Number(delta) === 0) return 0;
    const before = Number(stint.signals[capability] || 0);
    stint.signals[capability] = ceClamp(Number((before + Number(delta)).toFixed(1)), -20, 20);
    const applied = Number((stint.signals[capability] - before).toFixed(1));
    stint.signalLog.push({ capability, delta:applied, reason:String(reason || ''), day:ceDay(), date:ceNow() });
    stint.signalLog = stint.signalLog.slice(-80);
    return applied;
  }

  function ceDressing(){
    try{ return window.managerDressingRoom?.current?.() || null; }catch(_){ return null; }
  }
  function ceTrustEntries(){ return Object.values(ceDressing()?.playerTrust || {}); }
  function ceRecalculateDressing(stint){
    if(!stint) return;
    const usable = Object.values(stint.playerTrust || {}).filter(entry => {
      const player = cePlayer(entry.playerId);
      return player && Number(player.clubId || 0) === Number(stint.clubId || 0) && !player.retired && !player.sold;
    });
    const weighted = usable.reduce((sum, entry) => sum + Number(entry.value || 50) * (1 + Number(entry.influence || 0) / 100), 0);
    const weights = usable.reduce((sum, entry) => sum + (1 + Number(entry.influence || 0) / 100), 0);
    stint.generalTrust = ceClamp(Number((weights ? weighted / weights : 50).toFixed(1)), 0, 100);
    const groups = {};
    ['starter','rotation','substitute','youth'].forEach(group => {
      const list = usable.filter(entry => entry.primaryGroup === group);
      groups[group] = { value:Number(ceAverage(list.map(entry => entry.value)).toFixed(1)), count:list.length };
    });
    const referents = usable.filter(entry => Array.isArray(entry.tags) && entry.tags.includes('referent'));
    groups.referent = { value:Number(ceAverage(referents.map(entry => entry.value)).toFixed(1)), count:referents.length };
    stint.groupTrust = groups;
    stint.updatedAt = ceNow();
  }
  function ceTrustFilter(effect){
    const playerId = Number(effect.playerId || 0);
    const group = String(effect.group || 'all');
    return entry => {
      if(playerId) return Number(entry.playerId) === playerId;
      if(group === 'all') return true;
      if(group === 'referent') return Array.isArray(entry.tags) && entry.tags.includes('referent');
      if(group === 'captain') return Array.isArray(entry.tags) && entry.tags.includes('captain');
      return String(entry.primaryGroup || '') === group;
    };
  }
  function ceApplyTrust(effect, reason){
    const dressing = ceDressing();
    if(!dressing) return 0;
    let changed = 0;
    Object.values(dressing.playerTrust || {}).forEach(entry => {
      if(!ceTrustFilter(effect)(entry)) return;
      const before = Number(entry.value || 50);
      entry.value = ceClamp(Number((before + Number(effect.delta || 0)).toFixed(1)), 0, 100);
      entry.lastChange = Number((entry.value - before).toFixed(1));
      entry.lastReason = String(reason || effect.reason || 'Decisión del mánager');
      entry.updatedAt = ceNow();
      if(entry.lastChange) changed += 1;
    });
    ceRecalculateDressing(dressing);
    return changed;
  }
  function ceApplyRenewal(effect){
    const dressing = ceDressing();
    if(!dressing) return 0;
    let changed = 0;
    Object.values(dressing.playerTrust || {}).forEach(entry => {
      if(!ceTrustFilter(effect)(entry)) return;
      entry.renewal = entry.renewal && typeof entry.renewal === 'object' ? entry.renewal : {};
      entry.renewal.demandFactor = ceClamp(Number(entry.renewal.demandFactor || 1) + Number(effect.delta || 0), 0.85, 1.35);
      changed += 1;
    });
    return changed;
  }
  function ceApplyMorale(delta){
    const clubId = Number(game?.selectedClubId || 0);
    if(!clubId || !Number(delta)) return 0;
    if(typeof adjustSquadMorale === 'function') return adjustSquadMorale(clubId, Number(delta));
    game.playerMorale = game.playerMorale || {};
    cePlayers(clubId).forEach(player => {
      const current = typeof currentMorale === 'function' ? currentMorale(player.id) : Number(game.playerMorale[player.id] || 50);
      game.playerMorale[player.id] = ceClamp(ceRound(current + Number(delta)), 1, 99);
    });
    return cePlayers(clubId).length;
  }
  function ceApplyCohesion(delta){
    if(!Number(delta)) return 0;
    if(typeof adjustTeamCohesion === 'function') return adjustTeamCohesion(game?.selectedClubId, Number(delta));
    game.teamCohesion = game.teamCohesion || {};
    const clubId = Number(game?.selectedClubId || 0);
    game.teamCohesion[clubId] = ceClamp(Number(game.teamCohesion[clubId] || 50) + Number(delta), 0, 100);
    return Number(delta);
  }
  function ceApplyEffects(effects=[], context={}){
    const applied = [];
    (Array.isArray(effects) ? effects : []).forEach(effect => {
      const type = String(effect?.type || '');
      let value = 0;
      if(type === 'board') value = ceBoard(effect.delta, context.reason);
      else if(type === 'trust') value = ceApplyTrust(effect, context.reason);
      else if(type === 'morale') value = ceApplyMorale(effect.delta);
      else if(type === 'cohesion') value = ceApplyCohesion(effect.delta);
      else if(type === 'renewal') value = ceApplyRenewal(effect);
      else if(type === 'signal') value = ceSignal(effect.capability, effect.delta, context.reason);
      applied.push({ ...effect, applied:value });
    });
    return applied;
  }
  function ceEffectLabels(effects=[]){
    const labels = [];
    (effects || []).forEach(effect => {
      if(effect.type === 'board') labels.push(Number(effect.delta) >= 0 ? 'Mejoró el respaldo de la directiva' : 'La directiva quedó menos conforme');
      if(effect.type === 'trust') labels.push(`${Number(effect.delta) >= 0 ? 'Mejoró' : 'Bajó'} la confianza de ${GROUP_LABELS[effect.group] || (effect.playerId ? cePlayer(effect.playerId)?.name : 'un grupo') || 'un grupo'}`);
      if(effect.type === 'morale') labels.push(Number(effect.delta) >= 0 ? 'El ánimo del plantel recibió un impulso' : 'El ánimo del plantel se resintió');
      if(effect.type === 'cohesion') labels.push(Number(effect.delta) >= 0 ? 'La cohesión se fortaleció' : 'La cohesión quedó afectada');
      if(effect.type === 'renewal') labels.push(Number(effect.delta) > 0 ? 'Las próximas renovaciones serán más exigentes' : 'Mejoró la predisposición contractual');
      if(effect.type === 'signal') labels.push(`La decisión será considerada en ${CAPABILITY_LABELS[effect.capability] || 'el perfil profesional'}`);
    });
    return [...new Set(labels)].slice(0,5);
  }

  function ceOfficialMatches(clubId=game?.selectedClubId){
    return (Array.isArray(game?.matchHistory) ? game.matchHistory : []).filter(match => match?.played && !match?.friendly && (Number(match.homeId) === Number(clubId) || Number(match.awayId) === Number(clubId)));
  }
  function ceMatchPoints(match, clubId){
    const home = Number(match.homeId) === Number(clubId);
    const gf = Number(home ? match.homeGoals : match.awayGoals) || 0;
    const gc = Number(home ? match.awayGoals : match.homeGoals) || 0;
    return gf > gc ? 3 : gf === gc ? 1 : 0;
  }
  function ceRecentMatches(limit=5){ return ceOfficialMatches().slice(-Math.max(1, limit)); }
  function ceRecentPpg(limit=5){
    const matches = ceRecentMatches(limit);
    return matches.length ? matches.reduce((sum, match) => sum + ceMatchPoints(match, game.selectedClubId), 0) / matches.length : 1.25;
  }
  function ceStanding(){
    const clubId = Number(game?.selectedClubId || 0);
    let division = null;
    try{ division = typeof clubDivision === 'function' ? clubDivision(clubId) : null; }catch(_){ }
    let table = [];
    try{ table = typeof sortedStandings === 'function' ? sortedStandings(division?.id) : []; }catch(_){ }
    const index = table.findIndex(row => Number(row.clubId) === clubId);
    const total = Math.max(1, table.length || 1);
    const position = index >= 0 ? index + 1 : Math.ceil(total / 2);
    return { position, total, ratio:total > 1 ? (position - 1) / (total - 1) : 0.5 };
  }
  function ceBudget(){
    const club = ceClub(game?.selectedClubId);
    return Number(game?.clubBudgets?.[game?.selectedClubId] ?? club?.budget ?? 0);
  }
  function ceContext(){
    const current = game?.managerStats?.currentSeason || {};
    const dressing = ceDressing();
    const groups = dressing?.groupTrust || {};
    const objective = typeof managerObjectiveProgressInfo === 'function' ? managerObjectiveProgressInfo() : {};
    const standing = ceStanding();
    const budget = ceBudget();
    const baselineBudget = Number(current?.baseline?.budget ?? current?.startBudget ?? budget);
    const players = cePlayers();
    const youthEntries = ceTrustEntries().filter(entry => entry.primaryGroup === 'youth');
    const referents = ceTrustEntries().filter(entry => Array.isArray(entry.tags) && entry.tags.includes('referent'));
    return {
      current, dressing, groups, objective, standing, budget, baselineBudget, players, youthEntries, referents,
      played:Math.max(0, ceRound(current.played || objective.played || ceOfficialMatches().length)),
      ppg:Number(current.ppg || objective.ppg || (Number(current.played) ? Number(current.pts || 0) / Number(current.played) : 0)),
      recentPpg:ceRecentPpg(5),
      recentMatches:ceRecentMatches(5),
      stintMatches:Math.max(0, ceOfficialMatches().length - Number(ceStint()?.startMatchCount || 0)),
      generalTrust:Number(dressing?.generalTrust ?? 50),
      referentTrust:Number(groups?.referent?.value ?? 50),
      substituteTrust:Number(groups?.substitute?.value ?? 50),
      youthTrust:Number(groups?.youth?.value ?? 50)
    };
  }
  function cePlayerName(playerId){ return cePlayer(playerId)?.name || 'un jugador'; }
  function ceTopInfluential(group='referent', limit=2){
    return ceTrustEntries().filter(entry => group === 'all' || (group === 'referent' ? entry.tags?.includes('referent') : entry.primaryGroup === group))
      .sort((a,b) => Number(b.influence || 0) - Number(a.influence || 0) || Number(a.value || 50) - Number(b.value || 50)).slice(0, limit).map(entry => Number(entry.playerId));
  }
  function ceLowTrustPlayers(group='substitute', limit=2){
    return ceTrustEntries().filter(entry => group === 'all' || entry.primaryGroup === group)
      .sort((a,b) => Number(a.value || 50) - Number(b.value || 50) || Number(b.influence || 0) - Number(a.influence || 0)).slice(0, limit).map(entry => Number(entry.playerId));
  }

  const INTERACTIVE_EVENTS = [
    {
      id:'board_bad_run', category:'directiva', priority:3, title:'La directiva exige una reacción', type:'directiva',
      eligible:ctx => ctx.played >= 6 && ctx.recentPpg < 0.90 && Number(ctx.objective?.objective || 0) > 0 && ctx.ppg + 0.18 < Number(ctx.objective.objective || 0),
      body:ctx => `La última racha dejó al equipo por debajo del ritmo exigido. La directiva quiere saber cómo pensás responder antes de que la presión aumente.`,
      prompt:'¿Qué postura adoptás ante la directiva?',
      options:[
        { id:'take_responsibility', text:'Asumir la responsabilidad', hint:'Mejora el respaldo inmediato, pero deja tu palabra ligada a los próximos resultados.', result:'La directiva valoró que asumieras el momento y espera una reacción deportiva.', effects:[{type:'board',delta:3},{type:'morale',delta:1},{type:'signal',capability:'crisis',delta:1}], delayed:{ condition:'results', days:32, matches:5, minPpg:1.40, successText:'La reacción llegó y tu respuesta ante la crisis ganó credibilidad.', failureText:'La reacción prometida no llegó y la directiva perdió más confianza.', successEffects:[{type:'board',delta:5},{type:'signal',capability:'crisis',delta:2}], failureEffects:[{type:'board',delta:-7},{type:'signal',capability:'crisis',delta:-2}] } },
        { id:'defend_process', text:'Defender el proceso', hint:'Protege la relación con el vestuario, pero exige sostener el argumento con una mejora gradual.', result:'Defendiste el trabajo cotidiano y pediste que la evaluación considere el proceso completo.', effects:[{type:'board',delta:-2},{type:'trust',group:'referent',delta:1},{type:'signal',capability:'stability',delta:1}], delayed:{ condition:'results', days:35, matches:5, minPpg:1.15, successText:'La mejora gradual respaldó tu defensa del proceso.', failureText:'El equipo no mostró la evolución necesaria para sostener tu argumento.', successEffects:[{type:'board',delta:3},{type:'signal',capability:'stability',delta:2}], failureEffects:[{type:'board',delta:-4},{type:'signal',capability:'stability',delta:-1}] } },
        { id:'protect_squad', text:'Proteger al plantel de la presión', hint:'Eleva el ánimo interno, aunque la directiva interpreta que evitaste comprometerte.', result:'Trasladase la presión hacia vos y liberaste al plantel de la discusión pública.', effects:[{type:'board',delta:-4},{type:'morale',delta:2},{type:'cohesion',delta:1},{type:'signal',capability:'leadership',delta:1}], delayed:{ condition:'results', days:28, matches:4, minPpg:1.20, successText:'El plantel respondió al respaldo y la decisión quedó justificada.', failureText:'El respaldo no produjo una reacción y la directiva endureció su postura.', successEffects:[{type:'trust',group:'all',delta:1},{type:'board',delta:3}], failureEffects:[{type:'board',delta:-5},{type:'signal',capability:'leadership',delta:-1}] } }
      ],
      timeout:{ result:'La falta de respuesta fue interpretada como una señal de incertidumbre.', effects:[{type:'board',delta:-5},{type:'signal',capability:'stability',delta:-1}] }
    },
    {
      id:'board_good_run', category:'directiva', priority:2, title:'La buena racha abre una oportunidad', type:'directiva',
      eligible:ctx => ctx.played >= 6 && ctx.recentPpg >= 2.15 && ctx.standing.ratio <= 0.40,
      body:ctx => `El equipo atraviesa uno de sus mejores momentos y la directiva quiere definir si el proyecto debe elevar la ambición o sostener el plan original.`,
      prompt:'¿Cómo administrás el buen momento?',
      options:[
        { id:'raise_ambition', text:'Elevar la ambición', hint:'Impulsa al equipo y mejora tu imagen, pero aumenta el costo de una caída inmediata.', result:'Convertiste la buena racha en una exigencia interna mayor.', effects:[{type:'board',delta:2},{type:'morale',delta:2},{type:'signal',capability:'sporting',delta:1}], delayed:{ condition:'results', days:30, matches:4, minPpg:1.75, successText:'El equipo sostuvo el nivel y la ambición quedó respaldada.', failureText:'La exigencia adicional coincidió con una caída de rendimiento.', successEffects:[{type:'signal',capability:'sporting',delta:2},{type:'board',delta:3}], failureEffects:[{type:'morale',delta:-2},{type:'signal',capability:'sporting',delta:-1}] } },
        { id:'keep_calm', text:'Mantener el plan original', hint:'Reduce el riesgo de sobreexigencia y fortalece la estabilidad.', result:'Elegiste proteger el equilibrio del equipo y no modificar el discurso.', effects:[{type:'cohesion',delta:2},{type:'signal',capability:'stability',delta:1}], delayed:{ condition:'results', days:32, matches:4, minPpg:1.35, successText:'El equipo mantuvo la regularidad sin perder equilibrio.', failureText:'La cautela no evitó que la racha se agotara.', successEffects:[{type:'signal',capability:'stability',delta:2},{type:'board',delta:1}], failureEffects:[{type:'board',delta:-1}] } },
        { id:'share_opportunity', text:'Dar espacio a suplentes y jóvenes', hint:'Reparte oportunidades, aunque puede reducir la continuidad inmediata de los titulares.', result:'Utilizaste el buen momento para ampliar la participación del plantel.', effects:[{type:'trust',group:'substitute',delta:2},{type:'trust',group:'youth',delta:2},{type:'trust',group:'starter',delta:-1},{type:'signal',capability:'development',delta:1}], delayed:{ condition:'results', days:32, matches:4, minPpg:1.20, successText:'La rotación sostuvo los resultados y amplió las alternativas del plantel.', failureText:'La rotación coincidió con una pérdida de continuidad deportiva.', successEffects:[{type:'signal',capability:'development',delta:2},{type:'cohesion',delta:1}], failureEffects:[{type:'board',delta:-2},{type:'signal',capability:'sporting',delta:-1}] } }
      ],
      timeout:{ result:'La oportunidad pasó sin una definición clara y el club mantuvo el plan anterior.', effects:[{type:'signal',capability:'stability',delta:-0.5}] }
    },
    {
      id:'referents_request', category:'vestuario', priority:3, title:'Los referentes piden una definición', type:'vestuario',
      eligible:ctx => ctx.played >= 8 && ctx.stintMatches >= 5 && ctx.referents.length >= 2 && (ctx.generalTrust < 45 || ctx.referentTrust < 42),
      participants:() => ceTopInfluential('referent', 2),
      body:ctx => `${cePlayerName(ceTopInfluential('referent',2)[0])} y otros referentes creen que el vestuario necesita una señal concreta para ordenar el momento.`,
      prompt:'¿Cómo respondés al pedido de los referentes?',
      options:[
        { id:'listen_referents', text:'Escuchar a los referentes', hint:'Mejora su confianza, aunque los demás grupos pueden sentir que tienen menos peso.', result:'Abriste una mesa de diálogo con los líderes internos del plantel.', effects:[{type:'trust',group:'referent',delta:3},{type:'trust',group:'substitute',delta:-1},{type:'signal',capability:'leadership',delta:1}], delayed:{ condition:'trust', days:28, group:'referent', requiredDelta:3, successText:'El diálogo con los referentes ayudó a reconstruir el respaldo interno.', failureText:'Las reuniones no lograron cerrar las diferencias entre los referentes.', successEffects:[{type:'cohesion',delta:2},{type:'signal',capability:'leadership',delta:2}], failureEffects:[{type:'trust',group:'referent',delta:-2},{type:'signal',capability:'leadership',delta:-1}] } },
        { id:'support_captain', text:'Respaldar al capitán', hint:'Concentra el liderazgo en una figura y pone a prueba su influencia real.', result:'Ratificaste que el capitán será la principal voz del vestuario.', effects:[{type:'trust',group:'captain',delta:4},{type:'trust',group:'referent',delta:1},{type:'signal',capability:'leadership',delta:1}], delayed:{ condition:'results', days:28, matches:4, minPpg:1.30, successText:'Los resultados consolidaron la autoridad del capitán.', failureText:'La falta de resultados debilitó el respaldo concentrado en el capitán.', successEffects:[{type:'trust',group:'referent',delta:2},{type:'cohesion',delta:2}], failureEffects:[{type:'trust',group:'referent',delta:-3},{type:'cohesion',delta:-2}] } },
        { id:'assert_authority', text:'Marcar autoridad', hint:'Puede ordenar rápidamente el grupo si llegan resultados; sin ellos, aumenta la distancia con los referentes.', result:'Dejaste claro que las decisiones deportivas no serán negociadas por el vestuario.', effects:[{type:'trust',group:'referent',delta:-3},{type:'board',delta:2},{type:'signal',capability:'stability',delta:1}], delayed:{ condition:'results', days:30, matches:4, minPpg:1.60, successText:'Los resultados legitimaron tu postura firme.', failureText:'La postura firme quedó sin respaldo deportivo y profundizó la distancia interna.', successEffects:[{type:'trust',group:'referent',delta:2},{type:'signal',capability:'crisis',delta:2}], failureEffects:[{type:'trust',group:'referent',delta:-4},{type:'cohesion',delta:-3},{type:'signal',capability:'leadership',delta:-2}] } }
      ],
      timeout:{ result:'Los referentes no recibieron una respuesta y la tensión interna aumentó.', effects:[{type:'trust',group:'referent',delta:-3},{type:'cohesion',delta:-1},{type:'signal',capability:'leadership',delta:-1}] }
    },
    {
      id:'youth_plan', category:'desarrollo', priority:1, title:'Los jóvenes esperan un camino claro', type:'vestuario',
      eligible:ctx => ctx.played >= 7 && ctx.youthEntries.length >= 2 && ctx.youthEntries.filter(entry => Number(game?.playerStats?.[entry.playerId]?.played || 0) <= 1).length >= 2,
      participants:ctx => ctx.youthEntries.slice().sort((a,b) => Number(b.influence || 0) - Number(a.influence || 0)).slice(0,2).map(entry => Number(entry.playerId)),
      body:ctx => `Los jugadores jóvenes observan pocas oportunidades y quieren conocer qué lugar tendrán durante el resto de la temporada.`,
      prompt:'¿Qué camino les proponés?',
      options:[
        { id:'promise_minutes', text:'Prometer minutos', hint:'Eleva la confianza ahora, pero la promesa deberá verse reflejada en partidos oficiales.', result:'Prometiste que uno de los jóvenes tendrá una oportunidad concreta.', effects:[{type:'trust',group:'youth',delta:3},{type:'signal',capability:'development',delta:1}], delayed:{ condition:'player_minutes', days:30, matches:4, participantIndex:0, requiredAppearances:1, successText:'La oportunidad llegó y los jóvenes percibieron un camino real hacia el equipo.', failureText:'La promesa de minutos no se cumplió y los jóvenes perdieron confianza.', successEffects:[{type:'trust',group:'youth',delta:3},{type:'signal',capability:'development',delta:2}], failureEffects:[{type:'trust',group:'youth',delta:-5},{type:'signal',capability:'development',delta:-2}] } },
        { id:'gradual_plan', text:'Presentar un plan gradual', hint:'No promete una titularidad inmediata, pero sostiene la relación si el grupo evoluciona.', result:'Explicaste que las oportunidades dependerán de una progresión gradual.', effects:[{type:'trust',group:'youth',delta:1},{type:'cohesion',delta:1},{type:'signal',capability:'development',delta:1}], delayed:{ condition:'trust', days:35, group:'youth', requiredDelta:2, successText:'La evolución del grupo joven respaldó el plan gradual.', failureText:'El plan no produjo señales suficientes y las dudas continuaron.', successEffects:[{type:'signal',capability:'development',delta:2}], failureEffects:[{type:'trust',group:'youth',delta:-2}] } },
        { id:'prioritize_results', text:'Priorizar a los más preparados', hint:'Protege el rendimiento inmediato, pero reduce la confianza de los jóvenes.', result:'Aclaraste que la situación deportiva no permite garantizar oportunidades.', effects:[{type:'trust',group:'youth',delta:-3},{type:'trust',group:'starter',delta:1},{type:'board',delta:1},{type:'signal',capability:'sporting',delta:1}] }
      ],
      timeout:{ result:'La falta de una definición dejó a los jóvenes sin una expectativa clara.', effects:[{type:'trust',group:'youth',delta:-2},{type:'signal',capability:'development',delta:-1}] }
    },
    {
      id:'budget_pressure', category:'economia', priority:2, title:'La directiva pide ajustar el proyecto', type:'finance',
      eligible:ctx => ctx.played >= 5 && ctx.baselineBudget > 0 && ctx.budget < ctx.baselineBudget * 0.72,
      body:ctx => `El presupuesto disponible cayó con relación al inicio de la etapa. La directiva quiere una señal sobre cómo equilibrar el proyecto sin abandonar el objetivo deportivo.`,
      prompt:'¿Qué prioridad definís?',
      options:[
        { id:'accept_savings', text:'Aceptar un plan de ahorro', hint:'Mejora la relación institucional, aunque genera cautela en el vestuario.', result:'Aceptaste reducir compromisos y priorizar el equilibrio financiero.', effects:[{type:'board',delta:4},{type:'trust',group:'referent',delta:-1},{type:'signal',capability:'economy',delta:2}], delayed:{ condition:'budget', days:45, targetRatio:1.08, successText:'El presupuesto mostró una recuperación y el plan de ahorro fue valorado.', failureText:'El ajuste no logró recuperar el margen económico esperado.', successEffects:[{type:'board',delta:3},{type:'signal',capability:'economy',delta:2}], failureEffects:[{type:'board',delta:-3},{type:'signal',capability:'economy',delta:-1}] } },
        { id:'defend_squad', text:'Defender la competitividad del plantel', hint:'Mejora el respaldo interno, pero obliga a justificar el riesgo con resultados.', result:'Pediste sostener el plantel y asumir el riesgo económico de corto plazo.', effects:[{type:'board',delta:-3},{type:'trust',group:'referent',delta:2},{type:'signal',capability:'stability',delta:1}], delayed:{ condition:'results', days:35, matches:5, minPpg:1.55, successText:'Los resultados justificaron la decisión de sostener el plantel.', failureText:'El rendimiento no compensó el riesgo económico asumido.', successEffects:[{type:'board',delta:4},{type:'signal',capability:'sporting',delta:1}], failureEffects:[{type:'board',delta:-5},{type:'signal',capability:'economy',delta:-2}] } },
        { id:'conditional_sales', text:'Aceptar ventas sólo con buenas ofertas', hint:'Mantiene flexibilidad y deja el resultado condicionado a la mejora real del presupuesto.', result:'Acordaste evaluar salidas sin desarmar el plantel de forma anticipada.', effects:[{type:'board',delta:1},{type:'signal',capability:'economy',delta:1}], delayed:{ condition:'budget', days:50, targetRatio:1.04, successText:'El club recuperó margen sin deteriorar el proyecto deportivo.', failureText:'El presupuesto siguió ajustado y la solución quedó incompleta.', successEffects:[{type:'board',delta:2},{type:'signal',capability:'economy',delta:2}], failureEffects:[{type:'board',delta:-2}] } }
      ],
      timeout:{ result:'La directiva interpretó el silencio como falta de un plan económico.', effects:[{type:'board',delta:-4},{type:'signal',capability:'economy',delta:-1}] }
    },
    {
      id:'bench_unrest', category:'vestuario', priority:2, title:'Los suplentes pierden paciencia', type:'vestuario',
      eligible:ctx => ctx.played >= 9 && Number(ctx.groups?.substitute?.count || 0) >= 3 && ctx.substituteTrust < 40,
      participants:() => ceLowTrustPlayers('substitute', 2),
      body:ctx => `${cePlayerName(ceLowTrustPlayers('substitute',2)[0])} representa a un grupo de suplentes que siente que la competencia interna dejó de ofrecer oportunidades reales.`,
      prompt:'¿Cómo administrás el reclamo?',
      options:[
        { id:'open_rotation', text:'Abrir la rotación', hint:'Mejora la confianza de suplentes, pero algunos titulares pueden sentir amenazada su continuidad.', result:'Anunciaste una rotación más amplia para las próximas fechas.', effects:[{type:'trust',group:'substitute',delta:3},{type:'trust',group:'starter',delta:-1},{type:'cohesion',delta:1},{type:'signal',capability:'leadership',delta:1}], delayed:{ condition:'group_minutes', days:32, matches:4, group:'substitute', requiredAppearances:2, successText:'La rotación se cumplió y los suplentes recuperaron confianza.', failureText:'La rotación anunciada no se reflejó en suficientes participaciones.', successEffects:[{type:'trust',group:'substitute',delta:3},{type:'signal',capability:'leadership',delta:1}], failureEffects:[{type:'trust',group:'substitute',delta:-4},{type:'renewal',group:'substitute',delta:0.04},{type:'signal',capability:'leadership',delta:-1}] } },
        { id:'maintain_hierarchy', text:'Mantener la jerarquía actual', hint:'Refuerza a los titulares y evita cambios forzados, pero endurece las próximas renovaciones de suplentes.', result:'Ratificaste que los minutos dependerán exclusivamente del rendimiento.', effects:[{type:'trust',group:'starter',delta:2},{type:'trust',group:'substitute',delta:-3},{type:'renewal',group:'substitute',delta:0.03},{type:'board',delta:1},{type:'signal',capability:'sporting',delta:1}] },
        { id:'individual_talks', text:'Hablar individualmente', hint:'Busca una recuperación lenta de confianza sin prometer cambios masivos.', result:'Elegiste conversaciones individuales para ordenar expectativas.', effects:[{type:'trust',group:'substitute',delta:1},{type:'signal',capability:'leadership',delta:1}], delayed:{ condition:'trust', days:35, group:'substitute', requiredDelta:3, successText:'Las conversaciones mejoraron la relación con los suplentes.', failureText:'Las conversaciones no modificaron la percepción de falta de oportunidades.', successEffects:[{type:'cohesion',delta:1},{type:'signal',capability:'leadership',delta:1}], failureEffects:[{type:'renewal',group:'substitute',delta:0.03},{type:'signal',capability:'leadership',delta:-1}] } }
      ],
      timeout:{ result:'El reclamo quedó sin respuesta y los suplentes endurecieron su postura.', effects:[{type:'trust',group:'substitute',delta:-3},{type:'renewal',group:'substitute',delta:0.04},{type:'signal',capability:'leadership',delta:-1}] }
    }
  ];

  function ceFindEvent(eventId){ return INTERACTIVE_EVENTS.find(event => event.id === String(eventId || '')) || null; }
  function cePendingDecisionMessages(){
    return (Array.isArray(game?.messages) ? game.messages : []).filter(message => message?.action?.type === 'managerCareerDecision' && message.action.status === 'pending');
  }
  function ceClosePendingDecisions(reason='club_change'){
    if(!game) return 0;
    let closed = 0;
    cePendingDecisionMessages().forEach(message => {
      const action = message.action;
      action.status = reason === 'season_end' ? 'closed_season_end' : 'closed_club_change';
      action.resolvedDay = ceDay();
      action.resolvedDate = ceNow();
      action.resultText = reason === 'season_end'
        ? 'La temporada terminó antes de que la situación necesitara una respuesta.'
        : 'La situación quedó cerrada cuando dejaste el club.';
      const record = ensureManagerCareerEvents().records.find(item => item.id === `record:${message.id}`);
      if(record){ record.kind='decision'; record.status=action.status; record.result=reason; record.resultText=action.resultText; }
      closed += 1;
    });
    return closed;
  }
  function ceRecord(record){
    const state = ensureManagerCareerEvents();
    if(state.records.some(item => item.id === String(record.id || ''))) return state.records.find(item => item.id === String(record.id || ''));
    const item = {
      id:String(record.id || `career-record-${Date.now()}-${ceHash(Math.random(),100000)}`), source:String(record.source || 'career_event'),
      kind:String(record.kind || 'decision'), eventId:String(record.eventId || ''), category:String(record.category || ''), title:String(record.title || ''),
      season:Number(record.season || game?.seasonNumber || 1), clubId:Number(record.clubId || game?.selectedClubId || 0), stintKey:String(record.stintKey || ceCurrentStintKey()),
      day:Number(record.day || ceDay()), date:String(record.date || ceNow()), status:String(record.status || 'resolved'), optionId:String(record.optionId || ''),
      optionText:String(record.optionText || ''), result:String(record.result || ''), resultText:String(record.resultText || ''), importance:ceClamp(ceRound(record.importance || 1),1,3),
      participantIds:Array.isArray(record.participantIds) ? record.participantIds.map(Number).filter(Number.isFinite) : [],
      signal:record.signal && typeof record.signal === 'object' ? { ...record.signal } : {}, consequenceId:String(record.consequenceId || '')
    };
    state.records.push(item);
    state.records = state.records.slice(-Math.max(120, ceRound(ceCfg('maximoRegistros', 260), 260)));
    return item;
  }
  function ceEventMessageOccurrences(eventId=''){
    const season = Number(game?.seasonNumber || 1);
    const clubId = Number(game?.selectedClubId || 0);
    return (game?.messages || []).filter(message => message?.action?.type === 'managerCareerDecision' && String(message.action.eventId || '') === String(eventId || '') && Number(message.action.season || 0) === season && Number(message.action.clubId || 0) === clubId);
  }
  function ceEventOccurrenceCount(eventId=''){
    const ids = new Set();
    ceEventMessageOccurrences(eventId).forEach(message => ids.add(String(message.id || `${eventId}:${message.action?.createdDay || 0}`)));
    ensureManagerCareerEvents().records.filter(item => String(item.eventId || '') === String(eventId || '') && Number(item.season || 0) === Number(game?.seasonNumber || 1) && Number(item.clubId || 0) === Number(game?.selectedClubId || 0) && ['decision','decision_pending'].includes(String(item.kind || ''))).forEach(item => ids.add(String(item.id || `${eventId}:${item.day || 0}`).replace(/^record:/,'')));
    return ids.size;
  }
  function ceRecentEvent(stint, eventId, days){
    const day = ceDay();
    const inWindow = eventDay => {
      const delta = day - Number(eventDay || 0);
      return delta < 0 || delta < days;
    };
    if((stint.recentEventIds || []).some(item => item.id === eventId && inWindow(item.day))) return true;
    if(ceEventMessageOccurrences(eventId).some(message => inWindow(message.action?.createdDay))) return true;
    return ensureManagerCareerEvents().records.some(item => String(item.eventId || '') === String(eventId || '') && Number(item.season || 0) === Number(game?.seasonNumber || 1) && Number(item.clubId || 0) === Number(game?.selectedClubId || 0) && ['decision','decision_pending'].includes(String(item.kind || '')) && inWindow(item.day));
  }
  function ceRecentCategory(category='', days=30){
    const day = ceDay();
    const stint = ceStint();
    if(day - Number(stint?.lastCategoryDays?.[category] || 0) < days) return true;
    return ensureManagerCareerEvents().records.some(item => String(item.category || '') === String(category || '') && Number(item.season || 0) === Number(game?.seasonNumber || 1) && Number(item.clubId || 0) === Number(game?.selectedClubId || 0) && ['decision','decision_pending'].includes(String(item.kind || '')) && (day - Number(item.day || 0) < 0 || day - Number(item.day || 0) < days));
  }
  function ceCountRecent(kind, days=30){
    const day = ceDay();
    const key = ceCurrentStintKey();
    return ensureManagerCareerEvents().records.filter(item => item.stintKey === key && item.kind === kind && (day - Number(item.day || 0) < 0 || day - Number(item.day || 0) < days)).length;
  }
  function ceCountRecentDecisions(days=30){
    const day = ceDay();
    const ids = new Set();
    (game?.messages || []).filter(message => message?.action?.type === 'managerCareerDecision' && Number(message.action.season || 0) === Number(game?.seasonNumber || 1) && Number(message.action.clubId || 0) === Number(game?.selectedClubId || 0) && (day - Number(message.action.createdDay || 0) < 0 || day - Number(message.action.createdDay || 0) < days)).forEach(message => ids.add(String(message.id || '')));
    ensureManagerCareerEvents().records.filter(item => Number(item.season || 0) === Number(game?.seasonNumber || 1) && Number(item.clubId || 0) === Number(game?.selectedClubId || 0) && ['decision','decision_pending'].includes(String(item.kind || '')) && (day - Number(item.day || 0) < 0 || day - Number(item.day || 0) < days)).forEach(item => ids.add(String(item.id || '').replace(/^record:/,'')));
    return ids.size;
  }
  function ceSelectParticipants(event, ctx){
    try{ return Array.isArray(event.participants?.(ctx)) ? event.participants(ctx).map(Number).filter(Number.isFinite) : []; }catch(_){ return []; }
  }
  function ceCreateDecision(eventOrId, options={}){
    if(!ceActiveCareer() || ceCfg('activo', true) === false) return null;
    const event = typeof eventOrId === 'string' ? ceFindEvent(eventOrId) : eventOrId;
    if(!event || cePendingDecisionMessages().length >= Math.max(1, ceRound(ceCfg('maximoDecisionesPendientes', 1),1))) return null;
    const ctx = ceContext();
    if(options.force !== true && !event.eligible(ctx)) return null;
    const stint = ceStint();
    const maximumPerStint = Math.max(1, ceRound(event.maxPerStint ?? ceCfg('maximoMismoEventoPorEtapa', 1), 1));
    if(options.force !== true && ceEventOccurrenceCount(event.id) >= maximumPerStint) return null;
    const participants = ceSelectParticipants(event, ctx);
    const day = ceDay();
    const expiryDays = Math.max(2, ceRound(ceCfg('vencimientoDecisionDias', 5),5));
    const messageId = `career-decision-${event.id}-${game.seasonNumber || 1}-${game.selectedClubId || 0}-${day}`;
    if((game.messages || []).some(message => String(message.id) === messageId)) return null;
    const actionOptions = event.options.map(option => ({ id:option.id, text:option.text, hint:option.hint || '' }));
    const message = typeof pushGameMessage === 'function' ? pushGameMessage({
      id:messageId, type:event.type || 'directiva', priority:event.priority >= 3 ? 'high' : 'normal', title:event.title,
      body:typeof event.body === 'function' ? event.body(ctx) : String(event.body || ''), playerIds:participants,
      playerNames:participants.map(id => cePlayerName(id)),
      action:{
        type:'managerCareerDecision', status:'pending', eventId:event.id, category:event.category, prompt:event.prompt,
        options:actionOptions, participantIds:participants, createdDay:day, createdDate:ceNow(), dueDay:day + expiryDays,
        dueDate:ceAddDays(ceNow(), expiryDays), stintKey:stint.key, clubId:Number(game.selectedClubId || 0),
        season:Number(game.seasonNumber || 1), boardConfidenceAtStart:Number(stint.boardConfidence || 50)
      }
    }) : null;
    if(!message) return null;
    stint.lastInteractiveDay = day;
    stint.lastCategoryDays[event.category] = day;
    stint.recentEventIds.push({ id:event.id, day });
    stint.recentEventIds = stint.recentEventIds.slice(-24);
    ceRecord({ id:`record:${messageId}`, kind:'decision_pending', eventId:event.id, category:event.category, title:event.title, status:'pending', participantIds:participants, importance:event.priority || 2 });
    return message;
  }

  function ceConsequenceData(delayed, participants=[]){
    const condition = String(delayed?.condition || 'results');
    const data = { ...delayed };
    delete data.successEffects; delete data.failureEffects; delete data.successText; delete data.failureText; delete data.condition; delete data.days;
    if(condition === 'results') data.startMatchCount = ceOfficialMatches().length;
    if(condition === 'trust'){
      data.baselineTrust = Number(ceDressing()?.groupTrust?.[delayed.group]?.value ?? ceDressing()?.generalTrust ?? 50);
    }
    if(condition === 'player_minutes'){
      const playerId = Number(participants[Number(delayed.participantIndex || 0)] || delayed.playerId || 0);
      data.playerId = playerId;
      data.startPlayerMatches = Number(game?.playerStats?.[playerId]?.played || 0);
      data.startTeamMatches = ceOfficialMatches().length;
    }
    if(condition === 'group_minutes'){
      const ids = ceTrustEntries().filter(entry => entry.primaryGroup === delayed.group).map(entry => Number(entry.playerId));
      data.playerIds = ids;
      data.startAppearances = ids.reduce((sum,id) => sum + Number(game?.playerStats?.[id]?.played || 0), 0);
      data.startTeamMatches = ceOfficialMatches().length;
    }
    if(condition === 'budget') data.baselineBudget = ceBudget();
    return data;
  }
  function ceScheduleConsequence(message, event, option){
    const delayed = option?.delayed;
    if(!delayed) return null;
    const state = ensureManagerCareerEvents();
    const day = ceDay();
    const id = `career-consequence-${message.id}-${option.id}`;
    const item = {
      id, decisionId:`record:${message.id}`, messageId:message.id, eventId:event.id,
      season:Number(game.seasonNumber || 1), clubId:Number(game.selectedClubId || 0), stintKey:ceCurrentStintKey(),
      playerId:Number(message.action?.participantIds?.[Number(delayed.participantIndex || 0)] || delayed.playerId || 0), group:String(delayed.group || ''),
      createdDay:day, dueDay:day + Math.max(7, ceRound(delayed.days || 28)), dueDate:ceAddDays(ceNow(), Math.max(7, ceRound(delayed.days || 28))),
      condition:String(delayed.condition || 'results'), data:ceConsequenceData(delayed, message.action?.participantIds || []),
      successEffects:(delayed.successEffects || []).map(effect => ({ ...effect })), failureEffects:(delayed.failureEffects || []).map(effect => ({ ...effect })),
      successText:String(delayed.successText || 'La decisión terminó dando resultado.'), failureText:String(delayed.failureText || 'La decisión no produjo el resultado esperado.'),
      status:'pending', result:'', resolvedDay:0, resolvedDate:''
    };
    state.consequences.push(item);
    state.consequences = state.consequences.slice(-Math.max(80, ceRound(ceCfg('maximoConsecuencias',160),160)));
    return item;
  }
  function respondManagerCareerDecision(messageId, optionId, options={}){
    if(!game) return false;
    const message = (game.messages || []).find(item => String(item.id) === String(messageId || ''));
    if(!message || message.action?.type !== 'managerCareerDecision' || message.action.status !== 'pending') return false;
    const event = ceFindEvent(message.action.eventId);
    if(!event) return false;
    if(Number(message.action.clubId || 0) !== Number(game.selectedClubId || 0) || String(message.action.stintKey || '') !== ceCurrentStintKey()){
      message.action.status = 'closed_club_change';
      message.action.resultText = 'La situación quedó cerrada cuando cambiaste de club.';
      const record = ensureManagerCareerEvents().records.find(item => item.id === `record:${message.id}`);
      if(record){ record.kind='decision'; record.status='closed_club_change'; record.result='club_change'; record.resultText=message.action.resultText; }
      if(typeof saveLocal === 'function') saveLocal(true);
      if(typeof renderMessages === 'function' && typeof activeTab !== 'undefined' && activeTab === 'messages') renderMessages();
      return false;
    }
    const option = event.options.find(item => String(item.id) === String(optionId || ''));
    if(!option) return false;
    const reason = `${event.title}: ${option.text}`;
    const applied = ceApplyEffects(option.effects || [], { reason });
    const consequence = ceScheduleConsequence(message, event, option);
    message.action.status = 'resolved';
    message.action.selectedOptionId = option.id;
    message.action.selectedOptionText = option.text;
    message.action.resultText = option.result || 'La decisión fue comunicada.';
    message.action.resolvedDay = ceDay();
    message.action.resolvedDate = ceNow();
    message.action.appliedEffects = applied;
    message.action.effectLabels = ceEffectLabels(applied);
    message.action.consequenceId = consequence?.id || '';
    message.action.delayedStatus = consequence ? 'pending' : '';
    const pendingRecord = ensureManagerCareerEvents().records.find(item => item.id === `record:${message.id}`);
    if(pendingRecord){
      pendingRecord.kind = 'decision'; pendingRecord.status = consequence ? 'pending_consequence' : 'resolved';
      pendingRecord.optionId = option.id; pendingRecord.optionText = option.text; pendingRecord.result = 'chosen';
      pendingRecord.resultText = message.action.resultText; pendingRecord.consequenceId = consequence?.id || '';
    }
    if(typeof saveLocal === 'function') saveLocal(true);
    if(options.silent !== true){
      if(typeof renderMessages === 'function' && typeof activeTab !== 'undefined' && activeTab === 'messages') renderMessages();
      else if(typeof renderAll === 'function') renderAll();
      if(typeof showNotice === 'function') showNotice('Decisión de carrera registrada.');
    }
    return true;
  }
  window.respondManagerCareerDecision = respondManagerCareerDecision;

  function ceExpireDecisions(){
    if(!game) return 0;
    const day = ceDay();
    let expired = 0;
    (game.messages || []).forEach(message => {
      const action = message?.action;
      if(action?.type !== 'managerCareerDecision' || action.status !== 'pending') return;
      const event = ceFindEvent(action.eventId);
      const changedClub = Number(action.clubId || 0) !== Number(game.selectedClubId || 0) || String(action.stintKey || '') !== ceCurrentStintKey();
      if(!changedClub && day < Number(action.dueDay || 0)) return;
      action.status = changedClub ? 'closed_club_change' : 'expired';
      action.resolvedDay = day;
      action.resolvedDate = ceNow();
      if(changedClub){
        action.resultText = 'La situación quedó cerrada cuando cambiaste de club.';
      }else{
        const applied = ceApplyEffects(event?.timeout?.effects || [], { reason:`Sin respuesta: ${event?.title || action.eventId}` });
        action.resultText = event?.timeout?.result || 'La falta de respuesta tuvo consecuencias.';
        action.appliedEffects = applied;
        action.effectLabels = ceEffectLabels(applied);
      }
      const record = ensureManagerCareerEvents().records.find(item => item.id === `record:${message.id}`);
      if(record){ record.kind = 'decision'; record.status = action.status; record.result = changedClub ? 'club_change' : 'no_response'; record.resultText = action.resultText; }
      expired += 1;
    });
    return expired;
  }

  function ceConsequenceAssessment(item){
    if(game?.gameOver?.active || Number(item.clubId || 0) !== Number(game?.selectedClubId || 0)) return { ready:true, success:false, leftClub:true };
    const day = ceDay();
    const due = day >= Number(item.dueDay || 0);
    if(item.condition === 'results'){
      const matches = ceOfficialMatches().slice(Number(item.data?.startMatchCount || 0));
      const needed = Math.max(1, ceRound(item.data?.matches || 4));
      if(matches.length < needed && !due) return { ready:false };
      const sample = matches.slice(0, needed);
      const ppg = sample.length ? sample.reduce((sum,match) => sum + ceMatchPoints(match, item.clubId),0) / sample.length : 0;
      return { ready:true, success:sample.length >= Math.min(needed,1) && ppg >= Number(item.data?.minPpg || 1.25), metric:Number(ppg.toFixed(2)) };
    }
    if(item.condition === 'trust'){
      const current = Number(ceDressing()?.groupTrust?.[item.group]?.value ?? ceDressing()?.generalTrust ?? 50);
      const target = Number(item.data?.baselineTrust || 50) + Number(item.data?.requiredDelta || 2);
      if(current >= target) return { ready:true, success:true, metric:current };
      return due ? { ready:true, success:false, metric:current } : { ready:false };
    }
    if(item.condition === 'player_minutes'){
      const played = Number(game?.playerStats?.[item.data?.playerId]?.played || 0) - Number(item.data?.startPlayerMatches || 0);
      if(played >= Number(item.data?.requiredAppearances || 1)) return { ready:true, success:true, metric:played };
      return due ? { ready:true, success:false, metric:played } : { ready:false };
    }
    if(item.condition === 'group_minutes'){
      const current = (item.data?.playerIds || []).reduce((sum,id) => sum + Number(game?.playerStats?.[id]?.played || 0), 0);
      const appearances = current - Number(item.data?.startAppearances || 0);
      if(appearances >= Number(item.data?.requiredAppearances || 2)) return { ready:true, success:true, metric:appearances };
      return due ? { ready:true, success:false, metric:appearances } : { ready:false };
    }
    if(item.condition === 'budget'){
      const current = ceBudget();
      const target = Number(item.data?.baselineBudget || 0) * Number(item.data?.targetRatio || 1.05);
      if(current >= target) return { ready:true, success:true, metric:current };
      return due ? { ready:true, success:false, metric:current } : { ready:false };
    }
    return due ? { ready:true, success:false } : { ready:false };
  }
  function ceUpdateArchivedConsequence(item, resultText){
    const entries = Array.isArray(game?.managerStats?.seasonHistory) ? game.managerStats.seasonHistory : [];
    entries.filter(entry => Number(entry.season)===Number(item.season) && Number(entry.clubId)===Number(item.clubId)).forEach(entry => {
      if(entry.careerEvents){
        entry.careerEvents.pending = Math.max(0, Number(entry.careerEvents.pending || 0) - 1);
        entry.careerEvents.lastResolvedConsequence = { result:item.result, text:resultText, date:ceNow() };
      }
      if(entry.narrative){
        const remaining = ensureManagerCareerEvents().consequences.filter(consequence => Number(consequence.season)===Number(item.season) && Number(consequence.clubId)===Number(item.clubId) && consequence.status==='pending').length;
        entry.narrative.nextSeason = remaining ? `${remaining} consecuencia(s) de decisiones todavía pueden resolverse.` : `La última consecuencia pendiente se resolvió: ${resultText}`;
      }
    });
  }

  function ceResolveConsequences(){
    const state = ensureManagerCareerEvents();
    let resolved = 0;
    state.consequences.forEach(item => {
      if(item.status !== 'pending') return;
      const assessment = ceConsequenceAssessment(item);
      if(!assessment.ready) return;
      const leftClub = Boolean(assessment.leftClub);
      const success = Boolean(assessment.success) && !leftClub;
      const effects = leftClub ? [] : (success ? item.successEffects : item.failureEffects);
      const applied = ceApplyEffects(effects, { reason:`Consecuencia: ${item.eventId}` });
      item.status = leftClub ? 'left_club' : 'resolved';
      item.result = leftClub ? 'left_club' : (success ? 'success' : 'failure');
      item.resolvedDay = ceDay(); item.resolvedDate = ceNow(); item.appliedEffects = applied;
      const resultText = leftClub ? 'La consecuencia siguió su curso en el club anterior y no modifica tu plantel actual.' : (success ? item.successText : item.failureText);
      ceUpdateArchivedConsequence(item, resultText);
      const original = (game.messages || []).find(message => String(message.id) === String(item.messageId || ''));
      if(original?.action?.type === 'managerCareerDecision'){
        original.action.delayedStatus = item.result;
        original.action.delayedResult = resultText;
        original.action.delayedEffectLabels = ceEffectLabels(applied);
      }
      const record = state.records.find(entry => entry.id === item.decisionId);
      if(record){ record.status = item.status; record.result = item.result; record.resultText = resultText; }
      ceRecord({ id:`record:${item.id}`, kind:'consequence', eventId:item.eventId, category:'consequence', title:success ? 'Consecuencia favorable' : 'Consecuencia desfavorable', status:item.status, result:item.result, resultText, importance:success ? 2 : 3, consequenceId:item.id });
      if(!leftClub && typeof pushGameMessage === 'function'){
        pushGameMessage({ id:`message:${item.id}`, type:success ? 'deportivo' : 'warning', priority:success ? 'normal' : 'high', title:success ? 'Una decisión quedó respaldada' : 'Una decisión dejó consecuencias', body:resultText });
      }
      resolved += 1;
    });
    return resolved;
  }

  const AUTOMATIC_EVENTS = [
    {
      id:'automatic_bad_streak', category:'crisis', title:'La mala racha empieza a pesar', type:'deportivo', importance:2, notify:true,
      eligible:ctx => ctx.played >= 7 && ctx.recentMatches.length >= 4 && ctx.recentMatches.slice(-4).every(match => ceMatchPoints(match, game.selectedClubId) === 0),
      body:'La acumulación de derrotas empezó a afectar el clima cotidiano del plantel.',
      effects:[{type:'trust',group:'all',delta:-1},{type:'morale',delta:-1},{type:'signal',capability:'crisis',delta:-1}]
    },
    {
      id:'automatic_good_streak', category:'stability', title:'La buena racha fortalece el proyecto', type:'deportivo', importance:2, notify:true,
      eligible:ctx => ctx.played >= 7 && ctx.recentMatches.length >= 4 && ctx.recentMatches.slice(-4).filter(match => ceMatchPoints(match, game.selectedClubId) === 3).length >= 3 && ctx.recentMatches.slice(-4).every(match => ceMatchPoints(match, game.selectedClubId) > 0),
      body:'Los resultados recientes reforzaron la confianza interna y el respaldo institucional.',
      effects:[{type:'trust',group:'all',delta:1},{type:'board',delta:2},{type:'signal',capability:'stability',delta:1}]
    },
    {
      id:'automatic_bench_hardens', category:'vestuario', title:'Los suplentes endurecen su postura', type:'vestuario', importance:1, notify:false,
      eligible:ctx => ctx.played >= 10 && Number(ctx.groups?.substitute?.count || 0) >= 3 && ctx.substituteTrust < 33,
      body:'La falta de oportunidades comenzó a trasladarse a las futuras negociaciones contractuales.',
      effects:[{type:'renewal',group:'substitute',delta:0.03},{type:'signal',capability:'leadership',delta:-1}]
    },
    {
      id:'automatic_board_doubts', category:'directiva', title:'La directiva acumula dudas', type:'directiva', importance:1, notify:false,
      eligible:ctx => Number(ceStint()?.boardConfidence || 50) < 30 && ctx.played >= 8 && ctx.ppg < Number(ctx.objective?.objective || ctx.ppg),
      body:'El respaldo institucional siguió deteriorándose aunque no hubo una nueva comunicación formal.',
      effects:[{type:'signal',capability:'stability',delta:-1}]
    }
  ];
  function ceCreateAutomatic(event, ctx){
    const stint = ceStint();
    const day = ceDay();
    const applied = ceApplyEffects(event.effects || [], { reason:event.title });
    const record = ceRecord({ id:`automatic:${event.id}:${game.seasonNumber || 1}:${game.selectedClubId || 0}:${day}`, kind:'automatic', eventId:event.id, category:event.category, title:event.title, status:'resolved', result:'automatic', resultText:event.body, importance:event.importance || 1 });
    stint.lastAutomaticDay = day;
    stint.recentEventIds.push({ id:event.id, day }); stint.recentEventIds = stint.recentEventIds.slice(-24);
    if(event.notify && typeof pushGameMessage === 'function') pushGameMessage({ id:`message:${record.id}`, type:event.type || 'info', priority:event.importance >= 3 ? 'high' : 'normal', title:event.title, body:event.body });
    return { event:event.id, applied, record };
  }
  function ceCreateMidseasonInformation(ctx){
    const state = ensureManagerCareerEvents();
    const key = ceCurrentStintKey();
    if(ctx.played < 10 || state.records.some(item => item.stintKey === key && item.eventId === 'midseason_information')) return null;
    const position = ctx.standing.position ? `puesto ${ctx.standing.position}` : 'posición sin confirmar';
    const objective = ctx.objective?.label || ctx.current?.objectiveLabel || 'objetivo vigente';
    const board = ceRound(ceStint()?.boardConfidence || 50);
    const body = `La etapa llegó a un primer punto de balance: ${position}, ${objective} y respaldo de la directiva en ${board}/100. No requiere una respuesta.`;
    const record = ceRecord({ id:`information:midseason:${game.seasonNumber || 1}:${game.selectedClubId || 0}:${ceDay()}`, kind:'information', eventId:'midseason_information', category:'career', title:'Balance interno de la temporada', status:'resolved', result:'information', resultText:body, importance:1 });
    if(typeof pushGameMessage === 'function') pushGameMessage({ id:`message:${record.id}`, type:'info', priority:'normal', title:'Balance interno de la temporada', body });
    return record;
  }

  function ceSyncLegacyLockerRoomOutcomes(){
    const state = ensureManagerCareerEvents();
    (game?.messages || []).forEach(message => {
      if(message?.action?.type !== 'lockerRoomDecision' || message.action.status !== 'resolved') return;
      const id = `legacy-locker-room:${message.id}`;
      let record = state.records.find(item => item.id === id);
      if(!record){
        const outcome = String(message.action.outcome || 'neutral');
        record = ceRecord({ id, source:'locker_room', kind:'decision', eventId:String(message.action.eventId || 'locker_room'), category:'vestuario', title:String(message.title || 'Decisión de vestuario'), optionId:String(message.action.selectedOptionId || ''), optionText:String(message.action.selectedOptionText || ''), status:String(message.action.promiseStatus || '') === 'pending' ? 'pending_consequence' : 'resolved', result:outcome, resultText:String(message.action.resultText || ''), importance:2, participantIds:message.action.participantIds || message.playerIds || [] });
        if(outcome === 'success') ceSignal('leadership', 1, 'Resolución favorable de un problema de vestuario');
        if(outcome === 'failure') ceSignal('leadership', -1, 'Resolución desfavorable de un problema de vestuario');
      }
      const promiseStatus = String(message.action.promiseStatus || '');
      if(record && ['fulfilled','failed'].includes(promiseStatus) && !String(record.result || '').includes('promise_')){
        record.status = 'resolved'; record.result = `promise_${promiseStatus}`; record.resultText = String(message.action.promiseResult || record.resultText || '');
        ceSignal('leadership', promiseStatus === 'fulfilled' ? 1 : -1, promiseStatus === 'fulfilled' ? 'Promesa de vestuario cumplida' : 'Promesa de vestuario incumplida');
      }
    });
  }

  function ceCloseDuplicatePendingDecisions(){
    const groups = new Map();
    (game?.messages || []).filter(message => message?.action?.type === 'managerCareerDecision' && message.action.status === 'pending').forEach(message => {
      const key = `${message.action.season || 0}:${message.action.clubId || 0}:${message.action.eventId || ''}`;
      if(!groups.has(key)) groups.set(key, []);
      groups.get(key).push(message);
    });
    let closed = 0;
    groups.forEach(messages => {
      messages.sort((a,b) => Number(a.action?.createdDay || 0) - Number(b.action?.createdDay || 0));
      messages.slice(1).forEach(message => {
        message.action.status = 'duplicate_closed';
        message.action.resultText = 'La situación quedó unificada con una solicitud anterior del mismo grupo.';
        const record = ensureManagerCareerEvents().records.find(item => item.id === `record:${message.id}`);
        if(record){ record.kind='decision'; record.status='duplicate_closed'; record.result='duplicate'; record.resultText=message.action.resultText; }
        closed += 1;
      });
    });
    return closed;
  }

  function ceProcessEventChecks(){
    const stint = ceStint();
    if(!stint) return { checked:false };
    const day = ceDay();
    const interval = Math.max(3, ceRound(ceCfg('intervaloRevisionDias', 7),7));
    const graceDays = Math.max(0, ceRound(ceCfg('graciaAlLlegarDias', 21),21));
    const minimumMatches = Math.max(0, ceRound(ceCfg('partidosMinimosTrasLlegar', 4),4));
    const matchesSinceArrival = Math.max(0, ceOfficialMatches().length - Number(stint.startMatchCount || 0));
    if(day < Math.max(1, ceRound(ceCfg('primerDia', 20),20)) || day - Number(stint.initializedDay || day) < graceDays || matchesSinceArrival < minimumMatches || day - Number(stint.lastCheckDay || 0) < interval) return { checked:false, grace:true };
    stint.lastCheckDay = day;
    const ctx = ceContext();
    const repeatDays = Math.max(30, ceRound(ceCfg('repeticionEventoDias', 90),90));
    const categoryGap = Math.max(21, ceRound(ceCfg('esperaMismaCategoriaDias', 35),35));
    const minInteractiveGap = Math.max(14, ceRound(ceCfg('esperaEntreDecisionesDias', 21),21));
    const interactiveAllowed = !cePendingDecisionMessages().length
      && day - Number(stint.lastInteractiveDay || 0) >= minInteractiveGap
      && ceCountRecentDecisions(30) < Math.max(1, ceRound(ceCfg('maximoDecisionesCada30Dias',2),2));
    if(interactiveAllowed){
      const eligible = INTERACTIVE_EVENTS.filter(event => ceEventOccurrenceCount(event.id) < Math.max(1, ceRound(event.maxPerStint ?? ceCfg('maximoMismoEventoPorEtapa',1),1)) && !ceRecentEvent(stint,event.id,repeatDays) && !ceRecentCategory(event.category,categoryGap) && event.eligible(ctx));
      if(eligible.length){
        const highest = Math.max(...eligible.map(event => Number(event.priority || 1)));
        const pool = eligible.filter(event => Number(event.priority || 1) === highest);
        const selected = pool[ceHash(`career-event:${stint.key}:${day}:${pool.map(event=>event.id).join('|')}`, pool.length)];
        const message = ceCreateDecision(selected);
        if(message) return { checked:true, interactive:selected.id, messageId:message.id };
      }
    }
    const autoGap = Math.max(5, ceRound(ceCfg('esperaEntreAutomaticosDias', 10),10));
    const autoAllowed = day - Number(stint.lastAutomaticDay || 0) >= autoGap && ceCountRecent('automatic',30) < Math.max(1, ceRound(ceCfg('maximoAutomaticosCada30Dias',3),3));
    if(autoAllowed){
      const candidates = AUTOMATIC_EVENTS.filter(event => !ceRecentEvent(stint,event.id,Math.max(18,Math.floor(repeatDays*0.65))) && event.eligible(ctx));
      if(candidates.length){
        const selected = candidates[ceHash(`career-auto:${stint.key}:${day}:${candidates.map(event=>event.id).join('|')}`, candidates.length)];
        return { checked:true, automatic:ceCreateAutomatic(selected,ctx) };
      }
    }
    const information = ceCreateMidseasonInformation(ctx);
    return { checked:true, information };
  }

  function processManagerCareerEventsDaily(){
    if(!game || ceCfg('activo', true) === false) return { active:false };
    const state = ensureManagerCareerEvents();
    const today = ceNow();
    const duplicatesClosed = ceCloseDuplicatePendingDecisions();
    if(state.lastProcessedDate === today) return { active:ceActiveCareer(), duplicate:true, duplicatesClosed };
    state.lastProcessedDate = today;
    const expired = ceExpireDecisions();
    const resolved = ceResolveConsequences();
    ceSyncLegacyLockerRoomOutcomes();
    if(!ceActiveCareer()) return { active:false, duplicatesClosed, expired, resolved };
    const check = ceProcessEventChecks();
    const stint = ceStint();
    if(stint){
      const ctx = ceContext();
      stint.snapshot = { day:ceDay(), date:ceNow(), boardConfidence:Number(stint.boardConfidence || 50), generalTrust:Number(ctx.generalTrust || 50), ppg:Number(ctx.ppg || 0), position:Number(ctx.standing.position || 0), budget:Number(ctx.budget || 0) };
      stint.lastProcessedDate = today;
    }
    return { active:true, duplicatesClosed, expired, resolved, ...check };
  }
  window.processManagerCareerEventsDaily = processManagerCareerEventsDaily;

  function ceDecisionActionMarkup(message){
    const action = message?.action;
    if(action?.type !== 'managerCareerDecision') return '';
    const dueText = action.dueDate ? `Responder antes del ${action.dueDate}` : `Quedan ${Math.max(0,Number(action.dueDay||0)-ceDay())} días`;
    if(action.status === 'pending'){
      return `<div class="career-decision-panel"><div class="career-decision-deadline"><span>Decisión pendiente</span><strong>${escapeHtml(dueText)}</strong></div><p class="career-decision-prompt">${escapeHtml(action.prompt || '¿Qué decisión tomás?')}</p><div class="career-decision-options">${(action.options || []).map((option,index) => `<button type="button" class="${index===0?'primary':'ghost'} career-decision-option" data-career-decision-message="${escapeHtml(message.id)}" data-career-decision-choice="${escapeHtml(option.id)}"><strong>${escapeHtml(option.text)}</strong>${option.hint?`<small>${escapeHtml(option.hint)}</small>`:''}</button>`).join('')}</div><small class="muted">Si no respondés, el calendario continúa y la situación se resolverá sin intervención.</small></div>`;
    }
    const selected = action.selectedOptionText ? `<span class="pill message-status-pill">Decisión: ${escapeHtml(action.selectedOptionText)}</span>` : `<span class="pill message-status-pill">${action.status==='expired'?'Sin respuesta':'Situación cerrada'}</span>`;
    const effects = (action.effectLabels || []).length ? `<div class="career-decision-effects"><strong>Efectos inmediatos</strong><ul>${action.effectLabels.map(label=>`<li>${escapeHtml(label)}</li>`).join('')}</ul></div>` : '';
    const delayedPending = action.delayedStatus === 'pending' ? '<span class="pill warn message-status-pill">Consecuencia pendiente</span>' : '';
    const delayed = action.delayedResult ? `<div class="career-decision-delayed ${action.delayedStatus==='failure'?'is-negative':'is-positive'}"><strong>Resultado posterior</strong><p>${escapeHtml(action.delayedResult)}</p>${(action.delayedEffectLabels||[]).length?`<ul>${action.delayedEffectLabels.map(label=>`<li>${escapeHtml(label)}</li>`).join('')}</ul>`:''}</div>` : '';
    return `<div class="career-decision-closed"><div class="row career-decision-statuses">${selected}${delayedPending}</div>${action.resultText?`<div class="career-decision-result"><strong>Respuesta</strong><p>${escapeHtml(action.resultText)}</p></div>`:''}${effects}${delayed}</div>`;
  }
  function ceDecisionMessageCard(message){
    const tone = typeof messageToneClass === 'function' ? messageToneClass(message.type,message.priority) : '';
    const icon = typeof messageIcon === 'function' ? messageIcon(message.type) : '✉️';
    const typeLabel = typeof messageTypeLabel === 'function' ? messageTypeLabel(message.type || 'info') : String(message.type || 'Mensaje');
    const title = typeof messageTitleHtml === 'function' ? messageTitleHtml(message) : escapeHtml(message.title || 'Decisión');
    const body = typeof messageBodyHtml === 'function' ? messageBodyHtml(message) : escapeHtml(message.body || '');
    const related = typeof messageRelatedPlayersMarkup === 'function' ? messageRelatedPlayersMarkup({ ...message, type:'vestuario' }) : '';
    return `<div class="card message-card career-decision-message ${tone} ${message.read?'':'unread'}"><div class="message-card-accent"></div><div class="message-card-main"><div class="row message-card-head"><div class="message-head-left"><div class="message-meta-row"><span class="message-type-chip">${icon} ${escapeHtml(typeLabel)}</span><span class="message-date-chip">Temporada ${message.season||1} · Día ${((Number(message.turn||0))*(typeof DAYS_PER_ADVANCE==='number'?DAYS_PER_ADVANCE:1))+1}</span>${message.read?'':'<span class="message-unread-dot" title="Mensaje nuevo"></span>'}</div><h3>${title}</h3></div><span class="pill ${message.priority==='high'?'warn':''}">${message.priority==='high'?'Importante':'Normal'}</span></div><div class="message-paper"><p>${body}</p>${related}</div>${ceDecisionActionMarkup(message)}</div></div>`;
  }

  function ceCurrentSeasonRecords(){
    if(!game) return [];
    const key = ceCurrentStintKey();
    return ensureManagerCareerEvents().records.filter(item => item.stintKey === key);
  }
  function ceProfileMarkup(){
    const stint = ceStint();
    if(!stint) return '';
    const records = ceCurrentSeasonRecords();
    const decisions = records.filter(item => item.kind === 'decision').length;
    const pending = ensureManagerCareerEvents().consequences.filter(item => item.stintKey === stint.key && item.status === 'pending').length + cePendingDecisionMessages().filter(message => message.action.stintKey === stint.key).length;
    const strongest = CAPABILITIES.slice().sort((a,b)=>Math.abs(Number(stint.signals[b]||0))-Math.abs(Number(stint.signals[a]||0)))[0];
    const signalValue = Number(stint.signals[strongest] || 0);
    return `<section class="card career-event-profile-card"><div class="row"><div><h3>Decisiones y contexto</h3><p class="muted small">Las decisiones importantes se evalúan por sus resultados, no sólo por la respuesta elegida.</p></div><span class="pill">Motor de carrera</span></div><div class="career-event-profile-grid"><div><span>Confianza de la directiva</span><strong>${ceRound(stint.boardConfidence)}/100</strong></div><div><span>Decisiones registradas</span><strong>${decisions}</strong></div><div><span>Situaciones pendientes</span><strong>${pending}</strong></div><div><span>Huella principal</span><strong>${signalValue===0?'Sin definir':escapeHtml(CAPABILITY_LABELS[strongest])}</strong><small>${signalValue>0?'Tendencia favorable':signalValue<0?'Tendencia desfavorable':'La temporada todavía no dejó una tendencia clara'}</small></div></div></section>`;
  }

  function ceAttachSeasonSummary(status='season_end'){
    if(!game?.managerStats) return null;
    const history = Array.isArray(game.managerStats.seasonHistory) ? game.managerStats.seasonHistory : [];
    const entry = history.filter(item => Number(item.season)===Number(game.seasonNumber||1) && Number(item.clubId)===Number(game.selectedClubId||0) && String(item.status)===String(status)).sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))[0];
    if(!entry) return null;
    const state = ensureManagerCareerEvents();
    const stintKey = String(entry.careerStintId || ceCurrentStintKey());
    const stint = state.stints[stintKey] || ceStint();
    if(!stint) return entry;
    const records = state.records.filter(item => item.stintKey === stintKey);
    const pending = state.consequences.filter(item => item.stintKey===stintKey && item.status==='pending');
    const decisions = records.filter(item => item.kind==='decision');
    const automatic = records.filter(item => item.kind==='automatic');
    const important = records.slice().sort((a,b)=>Number(b.importance||1)-Number(a.importance||1)||Number(b.day||0)-Number(a.day||0))[0] || null;
    const finalizationKey = `${status}:${entry.key || entry.createdAt || entry.season}`;
    const capabilityDeltas = {};
    if(!stint.finalizations.includes(finalizationKey)){
      const profile = game.managerStats.careerProfile || {};
      profile.capabilities = profile.capabilities || {};
      CAPABILITIES.forEach(capability => {
        const signal = Number(stint.signals[capability] || 0);
        const current = ceRound(profile.capabilities[capability] ?? 35);
        const baseDelta = Number(entry.profileChange?.capabilityDeltas?.[capability] || 0);
        let delta = signal >= 5 ? 1 : signal <= -5 ? -1 : 0;
        if(delta > 0){
          const annualMaximum = signal >= 10 ? 5 : 3;
          if(baseDelta >= annualMaximum || current >= 90) delta = 0;
          else if(current >= 80 && signal < 8) delta = 0;
        }
        capabilityDeltas[capability] = delta;
        if(delta) profile.capabilities[capability] = ceClamp(current + delta, 0, 100);
      });
      game.managerStats.careerProfile = profile;
      stint.finalizations.push(finalizationKey); stint.finalizations = stint.finalizations.slice(-8);
    }
    entry.careerEvents = {
      version:CAREER_EVENT_VERSION, boardConfidence:Number(stint.boardConfidence || 50), decisions:decisions.length, automatic:automatic.length,
      pending:pending.length, signals:{ ...stint.signals }, capabilityDeltas, important:important ? { title:important.title, resultText:important.resultText, optionText:important.optionText, result:important.result } : null
    };
    entry.profileChange = entry.profileChange || {};
    entry.profileChange.capabilityDeltas = { ...(entry.profileChange.capabilityDeltas || {}) };
    Object.entries(capabilityDeltas).forEach(([key,delta]) => { entry.profileChange.capabilityDeltas[key] = Number(entry.profileChange.capabilityDeltas[key] || 0) + Number(delta || 0); });
    if(entry.narrative){
      if(important) entry.narrative.decisiveDecision = `${important.optionText ? `${important.optionText}: ` : ''}${important.resultText || important.title}`;
      entry.narrative.nextSeason = pending.length ? `${pending.length} consecuencia(s) de decisiones todavía pueden resolverse.` : 'No quedan consecuencias de decisiones pendientes.';
      entry.narrative.management = `${entry.narrative.management || ''} La relación final con la directiva quedó en ${ceRound(stint.boardConfidence)}/100.`.trim();
      entry.narrative.tags = [...new Set([...(entry.narrative.tags || []), decisions.length ? `${decisions.length} decisiones` : '', pending.length ? 'Consecuencias pendientes' : 'Decisiones cerradas'].filter(Boolean))];
    }
    const legacy = (game.managerStats.seasons || []).find(item => Number(item.season)===Number(entry.season) && Number(item.clubId)===Number(entry.clubId));
    if(legacy){ legacy.careerEvents=entry.careerEvents; legacy.narrative=entry.narrative; }
    return entry;
  }

  function installCareerEventHooks(){
    if(typeof messageCard === 'function'){
      const originalMessageCard = messageCard;
      messageCard = function(message){ return message?.action?.type === 'managerCareerDecision' ? ceDecisionMessageCard(message) : originalMessageCard(message); };
    }
    if(typeof messageHasPendingAction === 'function'){
      const originalPending = messageHasPendingAction;
      messageHasPendingAction = function(message){
        if(message?.action?.type === 'managerCareerDecision') return message.action.status === 'pending' || message.action.delayedStatus === 'pending';
        if(message?.action?.type === 'lockerRoomDecision' && message.action.status === 'pending') return true;
        return originalPending(message);
      };
    }
    if(typeof renderMessages === 'function'){
      const originalRenderMessages = renderMessages;
      renderMessages = function(){
        const result = originalRenderMessages();
        document.querySelectorAll('[data-career-decision-choice]').forEach(button => button.addEventListener('click', () => respondManagerCareerDecision(button.dataset.careerDecisionMessage, button.dataset.careerDecisionChoice)));
        return result;
      };
    }
    if(typeof renderManagerStats === 'function'){
      const originalRenderManagerStats = renderManagerStats;
      renderManagerStats = function(){
        const result = originalRenderManagerStats();
        const mode = typeof managerStatsViewMode !== 'undefined' ? managerStatsViewMode : window.managerStatsViewMode;
        if(String(mode || 'profile') === 'profile'){
          const target = document.querySelector('.career-profile-stage-one');
          if(target && !target.querySelector('.career-event-profile-card')) target.insertAdjacentHTML('beforeend', ceProfileMarkup());
        }
        return result;
      };
    }
    if(typeof processDailyCalendarState === 'function'){
      const originalProcessDaily = processDailyCalendarState;
      processDailyCalendarState = function(dateAfter='', options={}){
        const result = originalProcessDaily(dateAfter, options) || {};
        const careerEvents = processManagerCareerEventsDaily();
        return { ...result, managerCareerEvents:careerEvents };
      };
    }
    if(typeof respondLockerRoomDecision === 'function'){
      const originalLockerRoomResponse = respondLockerRoomDecision;
      respondLockerRoomDecision = function(messageId, optionId){
        const result = originalLockerRoomResponse(messageId, optionId);
        if(result){ ceSyncLegacyLockerRoomOutcomes(); if(typeof saveLocal === 'function') saveLocal(true); }
        return result;
      };
    }
    if(typeof finalizeSeasonIfNeeded === 'function'){
      const originalFinalize = finalizeSeasonIfNeeded;
      finalizeSeasonIfNeeded = function(options={}){
        const before = Boolean(game?.seasonFinalized);
        const result = originalFinalize(options);
        if(!before && game?.seasonFinalized){
          ceClosePendingDecisions('season_end');
          ceAttachSeasonSummary('season_end');
          if(typeof saveLocal === 'function') saveLocal(true);
        }
        return result;
      };
    }
    if(typeof recordDismissedCareerStep === 'function'){
      const originalRecordDismissed = recordDismissedCareerStep;
      recordDismissedCareerStep = function(){
        const status = game?.gameOver?.type === 'resignation' ? 'resignation' : 'dismissal';
        ceClosePendingDecisions(status);
        const result = originalRecordDismissed();
        ceAttachSeasonSummary(status);
        if(typeof saveLocal === 'function') saveLocal(true);
        return result;
      };
    }
    if(typeof normalizeGame === 'function'){
      const originalNormalizeGame = normalizeGame;
      normalizeGame = function(saved){
        const normalized = originalNormalizeGame(saved);
        normalized.managerCareerEvents = normalizeManagerCareerEvents(saved?.managerCareerEvents || normalized.managerCareerEvents || {});
        return normalized;
      };
    }
    if(typeof newGame === 'function'){
      const originalNewGame = newGame;
      newGame = function(selectedClubId, options={}){
        const result = originalNewGame(selectedClubId, options);
        if(game){ game.managerCareerEvents = normalizeManagerCareerEvents({}); ceStint(); }
        return result;
      };
    }
    if(typeof continueCareerAtClub === 'function'){
      const originalContinue = continueCareerAtClub;
      continueCareerAtClub = function(selectedClubId, options={}){
        const result = originalContinue(selectedClubId, options);
        if(game && !game?.gameOver?.active){ ensureManagerCareerEvents(); ceStint(); ceExpireDecisions(); }
        return result;
      };
    }
    if(typeof startNextSeason === 'function'){
      const originalNextSeason = startNextSeason;
      startNextSeason = function(selectedClubId, options={}){
        const result = originalNextSeason(selectedClubId, options);
        if(game && !game?.seasonFinalized){ ensureManagerCareerEvents(); ceStint(); ceExpireDecisions(); }
        return result;
      };
    }
  }

  installCareerEventHooks();
  window.managerCareerEvents = {
    version:CAREER_EVENT_VERSION,
    ensure:ensureManagerCareerEvents,
    current:ceStint,
    process:processManagerCareerEventsDaily,
    respond:respondManagerCareerDecision,
    trigger:(eventId,options={}) => ceCreateDecision(eventId,{ ...options, force:true }),
    definitions:() => INTERACTIVE_EVENTS.map(event => ({ id:event.id, title:event.title, category:event.category })),
    records:() => ceCurrentSeasonRecords()
  };
})();
