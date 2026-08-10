/* V8.70 · Segunda etapa del sistema integral de carrera del manager.
   Confianza individual, grupos del vestuario, referentes, capitanes,
   efectos sobre moral/cohesión/renovaciones y evaluación de Liderazgo. */

(function(){
  const DRESSING_ROOM_VERSION = 2;
  let dressingRoomSort = 'influence_desc';
  const GROUP_LABELS = {
    starter:'Titulares',
    rotation:'Rotación',
    substitute:'Suplentes',
    youth:'Jóvenes',
    referent:'Referentes'
  };

  function drConfig(path, fallback){
    return typeof configValue === 'function' ? configValue(`manager.vestuario.${path}`, fallback) : fallback;
  }
  function drClamp(value, min=0, max=100){
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }
  function drRound(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : Math.round(Number(fallback || 0));
  }
  function drOneDecimal(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number * 10) / 10 : Number(fallback || 0);
  }
  function drAverage(values=[]){
    const clean = (Array.isArray(values) ? values : []).map(Number).filter(Number.isFinite);
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 50;
  }
  function drHash(key, max=1000){
    if(typeof hashNumber === 'function') return hashNumber(String(key || ''), Math.max(1, max));
    let hash = 0;
    String(key || '').split('').forEach(char => { hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0; });
    return Math.abs(hash) % Math.max(1, max);
  }
  function drNow(){ return String(game?.currentDate || new Date().toISOString()); }
  function drCurrentClubId(){ return Number(game?.selectedClubId || 0); }
  function drCurrentSeason(){ return Math.max(1, drRound(game?.seasonNumber || 1, 1)); }
  function drCurrentStintId(){
    const current = game?.managerStats?.currentSeason || {};
    if(current.careerStintId) return String(current.careerStintId);
    return `s${drCurrentSeason()}-c${drCurrentClubId()}-t${Math.max(0, drRound(game?.globalTurn || 0))}`;
  }
  function drStintKey(targetGame=game){
    const season = Math.max(1, drRound(targetGame?.seasonNumber || 1, 1));
    const clubId = Number(targetGame?.selectedClubId || 0);
    const stint = String(targetGame?.managerStats?.currentSeason?.careerStintId || `s${season}-c${clubId}-t${Math.max(0, drRound(targetGame?.globalTurn || 0))}`);
    return `${season}:${clubId}:${stint}`;
  }
  function drPlayerById(id){ return typeof playerById === 'function' ? playerById(id) : (seed?.players || []).find(player => Number(player.id) === Number(id)); }
  function drPlayersByClub(clubId){
    if(typeof playersByClub === 'function') return playersByClub(clubId).filter(player => !player?.retired && !player?.sold);
    return (seed?.players || []).filter(player => Number(player?.clubId || 0) === Number(clubId) && !player?.retired && !player?.sold);
  }
  function drCurrentLeadership(){
    return drClamp(game?.managerStats?.careerProfile?.capabilities?.leadership ?? drConfig('confianzaInicial', 50), 0, 100);
  }
  function drCurrentPrestige(){
    return drClamp(Number(game?.managerStats?.careerProfile?.prestige || 0) / 10, 0, 100);
  }
  function drCurrentMoment(){
    return drClamp((Number(game?.managerStats?.careerProfile?.moment || 0) + 100) / 2, 0, 100);
  }
  function drLeadershipCandidates(players=drPlayersByClub(drCurrentClubId())){
    return (players || []).slice().sort((a,b) => {
      const currentA = typeof captaincyValue === 'function' ? Number(captaincyValue(a.id) || 0) : 0;
      const currentB = typeof captaincyValue === 'function' ? Number(captaincyValue(b.id) || 0) : 0;
      const maxA = typeof captaincyMaximum === 'function' ? Number(captaincyMaximum(a) || 0) : Number(a?.skills?.liderazgo || 0);
      const maxB = typeof captaincyMaximum === 'function' ? Number(captaincyMaximum(b) || 0) : Number(b?.skills?.liderazgo || 0);
      return currentB - currentA || maxB - maxA || Number(b.age || 0) - Number(a.age || 0) || Number(b.skills?.liderazgo || 0) - Number(a.skills?.liderazgo || 0) || Number(a.id) - Number(b.id);
    });
  }
  function drValidLeadershipPlayer(playerId, clubId=drCurrentClubId()){
    const player = drPlayerById(playerId);
    return Boolean(player && !player.retired && !player.sold && Number(player.clubId || 0) === Number(clubId || 0));
  }
  function drEnsureLeadershipHierarchy(stint, players=drPlayersByClub(stint?.clubId || drCurrentClubId())){
    if(!stint) return { captainId:0, viceCaptainId:0 };
    const ranked = drLeadershipCandidates(players);
    let captainId = Number(stint.captainId || 0);
    if(!drValidLeadershipPlayer(captainId, stint.clubId)){
      const tacticCaptain = Number(game?.tactic?.captainId || 0);
      captainId = drValidLeadershipPlayer(tacticCaptain, stint.clubId) ? tacticCaptain : Number(ranked[0]?.id || 0);
    }
    let viceCaptainId = Number(stint.viceCaptainId || 0);
    if(!drValidLeadershipPlayer(viceCaptainId, stint.clubId) || viceCaptainId === captainId){
      viceCaptainId = Number(ranked.find(player => Number(player.id) !== captainId)?.id || 0);
    }
    stint.captainId = captainId;
    stint.viceCaptainId = viceCaptainId;
    return { captainId, viceCaptainId };
  }

  function normalizePlayerTrustEntry(raw={}, playerId=0, clubId=0){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      playerId:Number(playerId || source.playerId || 0),
      clubId:Number(clubId || source.clubId || 0),
      value:drClamp(drOneDecimal(source.value, drConfig('confianzaInicial', 50)), 0, 100),
      primaryGroup:['starter','rotation','substitute','youth'].includes(String(source.primaryGroup || '')) ? String(source.primaryGroup) : 'substitute',
      tags:Array.isArray(source.tags) ? source.tags.map(String).filter(Boolean).slice(0, 8) : [],
      influence:drClamp(drRound(source.influence || 0), 0, 100),
      unusedStreak:Math.max(0, drRound(source.unusedStreak || 0)),
      matchesTracked:Math.max(0, drRound(source.matchesTracked || 0)),
      renewal:source.renewal && typeof source.renewal === 'object' ? {
        season:Math.max(0, drRound(source.renewal.season || 0)),
        disposition:String(source.renewal.disposition || ''),
        status:String(source.renewal.status || ''),
        demandFactor:Math.max(0.5, Number(source.renewal.demandFactor || 1)),
        requestedTransfer:Boolean(source.renewal.requestedTransfer),
        salaryBefore:Math.max(0, drRound(source.renewal.salaryBefore || 0)),
        salaryAfter:Math.max(0, drRound(source.renewal.salaryAfter || 0))
      } : null,
      lastChange:drOneDecimal(source.lastChange || 0),
      lastReason:String(source.lastReason || ''),
      updatedAt:String(source.updatedAt || '')
    };
  }
  function normalizeDressingRoomStint(raw={}, key=''){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const clubId = Number(source.clubId || 0);
    const trust = {};
    Object.entries(source.playerTrust || {}).forEach(([id, entry]) => {
      const playerId = Number(id || entry?.playerId || 0);
      if(playerId) trust[playerId] = normalizePlayerTrustEntry(entry, playerId, clubId);
    });
    const matchKeys = {};
    Object.entries(source.matchKeys || {}).slice(-500).forEach(([matchKey, value]) => { if(matchKey) matchKeys[matchKey] = Boolean(value); });
    return {
      key:String(source.key || key || ''),
      season:Math.max(1, drRound(source.season || 1, 1)),
      clubId,
      stintId:String(source.stintId || ''),
      initializedAt:String(source.initializedAt || ''),
      initialGeneralTrust:drClamp(drOneDecimal(source.initialGeneralTrust, 50), 0, 100),
      playerTrust:trust,
      referentIds:Array.isArray(source.referentIds) ? source.referentIds.map(Number).filter(Boolean).slice(0, 8) : [],
      captainId:Number(source.captainId || 0),
      viceCaptainId:Number(source.viceCaptainId || 0),
      previousCaptainId:Number(source.previousCaptainId || 0),
      previousViceCaptainId:Number(source.previousViceCaptainId || 0),
      generalTrust:drClamp(drOneDecimal(source.generalTrust, 50), 0, 100),
      groupTrust:source.groupTrust && typeof source.groupTrust === 'object' ? { ...source.groupTrust } : {},
      events:Array.isArray(source.events) ? source.events.slice(-120) : [],
      matchKeys,
      leadershipStart:drClamp(drRound(source.leadershipStart || 50), 0, 100),
      leadershipEnd:drClamp(drRound(source.leadershipEnd || source.leadershipStart || 50), 0, 100),
      updatedAt:String(source.updatedAt || '')
    };
  }
  function normalizeDressingRoomState(raw={}){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const stints = {};
    Object.entries(source.stints || {}).forEach(([key, value]) => { stints[key] = normalizeDressingRoomStint(value, key); });
    return {
      version:DRESSING_ROOM_VERSION,
      activeKey:String(source.activeKey || ''),
      stints,
      archive:Array.isArray(source.archive) ? source.archive.slice(-80) : []
    };
  }

  function drPlayerAppearanceData(player){
    const stat = game?.playerStats?.[player?.id] || {};
    return {
      played:Math.max(0, drRound(stat.played || 0)),
      starts:Math.max(0, drRound(stat.starts || 0))
    };
  }
  function drInfluenceScore(player, previousReferents=new Set()){
    const appearances = drPlayerAppearanceData(player);
    const captainMaximum = typeof captaincyMaximum === 'function' ? Number(captaincyMaximum(player) || 0) : Number(player?.skills?.liderazgo || 50);
    const captainProgress = typeof captaincyValue === 'function' ? Number(captaincyValue(player.id) || 0) : 0;
    const overall = typeof visibleOverall === 'function' ? Number(visibleOverall(player) || 0) : Number(player?.overall || 0);
    const age = Number(player?.age || 18);
    const ageInfluence = age >= 27 && age <= 34 ? 100 : age >= 24 && age <= 37 ? 78 : age >= 21 ? 48 : 20;
    const appearanceInfluence = drClamp(appearances.starts * 4 + appearances.played * 1.5, 0, 100);
    const continuity = previousReferents.has(Number(player.id)) ? 6 : 0;
    return drClamp(drRound(captainMaximum * 0.32 + captainProgress * 0.22 + overall * 0.18 + ageInfluence * 0.16 + appearanceInfluence * 0.12 + continuity), 0, 100);
  }
  function drDetermineReferents(players, stint){
    const previous = new Set((stint?.referentIds || []).map(Number));
    const min = drClamp(drRound(drConfig('referentesMinimo', 2), 2), 1, 6);
    const max = drClamp(drRound(drConfig('referentesMaximo', 4), 4), min, 7);
    const countRange = Math.max(1, max - min + 1);
    const target = Math.min(players.length, min + drHash(`${stint?.key || ''}:referents`, countRange));
    const hierarchy = drEnsureLeadershipHierarchy(stint, players);
    const captainId = Number(hierarchy.captainId || 0);
    const viceCaptainId = Number(hierarchy.viceCaptainId || 0);
    const ranked = players.map(player => ({ player, score:drInfluenceScore(player, previous) }))
      .sort((a,b) => b.score - a.score || Number(b.player.age || 0) - Number(a.player.age || 0) || Number(a.player.id) - Number(b.player.id));
    const selected = [];
    const captain = ranked.find(item => Number(item.player.id) === captainId);
    const viceCaptain = ranked.find(item => Number(item.player.id) === viceCaptainId);
    if(captain) selected.push(captain.player);
    if(viceCaptain && selected.length < target) selected.push(viceCaptain.player);
    ranked.forEach(item => {
      if(selected.length >= target || selected.some(player => Number(player.id) === Number(item.player.id))) return;
      selected.push(item.player);
    });
    return selected.map(player => Number(player.id));
  }
  function drPrimaryGroup(player, referentIds=[]){
    const id = Number(player?.id || 0);
    const stats = drPlayerAppearanceData(player);
    const played = Math.max(1, stats.played);
    const starterRatio = stats.starts / played;
    const starters = new Set((game?.tactic?.starters || []).map(Number).filter(Boolean));
    const bench = new Set((game?.tactic?.bench || []).map(Number).filter(Boolean));
    const youthAge = Math.max(16, drRound(drConfig('edadMaximaJoven', 21), 21));
    if(Number(player?.age || 99) <= youthAge && !starters.has(id) && starterRatio < 0.5) return 'youth';
    if(starters.has(id) || (stats.played >= 4 && starterRatio >= 0.55)) return 'starter';
    if(bench.has(id) || stats.played >= 5 || starterRatio >= 0.20) return 'rotation';
    return 'substitute';
  }
  function drInitialTrust(player, group, tags, stint){
    const leadership = drCurrentLeadership();
    const prestige = drCurrentPrestige();
    const moment = drCurrentMoment();
    let value = Number(drConfig('confianzaInicial', 50)) + (leadership - 50) * 0.18 + (prestige - 50) * 0.08 + (moment - 50) * 0.05;
    if(group === 'starter') value += 3;
    if(group === 'rotation') value += 1;
    if(group === 'substitute') value -= 2;
    if(group === 'youth') value += 2;
    if(tags.includes('captain')) value += 4;
    if(tags.includes('viceCaptain')) value += 2;
    if(tags.includes('referent')) value += prestige >= 45 ? 1 : -2;
    value += (drHash(`${stint?.key || ''}:${player?.id}:trust`, 81) - 40) / 10;
    return drClamp(drOneDecimal(value), 28, 78);
  }
  function drTrustStatus(value){
    const trust = Number(value || 0);
    if(trust >= Number(drConfig('confianzaRespaldo', 70))) return { code:'support', label:'Respaldo', tone:'ok' };
    if(trust >= Number(drConfig('confianzaEstable', 50))) return { code:'stable', label:'Estable', tone:'neutral' };
    if(trust >= Number(drConfig('confianzaDudas', 35))) return { code:'doubts', label:'Dudas', tone:'warn' };
    if(trust >= Number(drConfig('confianzaTension', 20))) return { code:'tension', label:'Tensión', tone:'danger' };
    return { code:'fractured', label:'Fracturado', tone:'danger' };
  }
  function drRenewalDisposition(value, entry=null){
    if(entry?.renewal?.requestedTransfer) return { code:'exit', label:'Pidió salir', factor:Number(entry.renewal.demandFactor || 1.15), tone:'danger' };
    const trust = Number(value || 0);
    const cfg = {
      ready:Number(drConfig('renovaciones.predispuestoDesde', 70)),
      open:Number(drConfig('renovaciones.abiertoDesde', 50)),
      doubts:Number(drConfig('renovaciones.dudasDesde', 35)),
      hard:Number(drConfig('renovaciones.dificilDesde', 20))
    };
    if(trust >= 85) return { code:'excellent', label:'Muy predispuesto', factor:.98, tone:'ok' };
    if(trust >= cfg.ready) return { code:'ready', label:'Predispuesto', factor:1, tone:'ok' };
    if(trust >= cfg.open) return { code:'open', label:'Abierto a renovar', factor:1, tone:'neutral' };
    if(trust >= cfg.doubts) return { code:'doubts', label:'Tiene dudas', factor:1 + Number(drConfig('renovaciones.aumentoDudasPct', 5)) / 100, tone:'warn' };
    if(trust >= cfg.hard) return { code:'hard', label:'Renovación difícil', factor:1 + Number(drConfig('renovaciones.aumentoDificilPct', 10)) / 100, tone:'danger' };
    return { code:'refusal', label:'No quiere renovar', factor:1 + Number(drConfig('renovaciones.aumentoRupturaPct', 15)) / 100, tone:'danger' };
  }
  function managerDressingRoomRenewalDisposition(playerId){
    const entry = drFastEntry(playerId);
    return drRenewalDisposition(entry?.value ?? 50, entry);
  }
  window.managerDressingRoomRenewalDisposition = managerDressingRoomRenewalDisposition;

  function drUpdateGroupSummary(stint){
    if(!stint) return null;
    const activeEntries = Object.values(stint.playerTrust || {}).filter(entry => Number(drPlayerById(entry.playerId)?.clubId || 0) === Number(stint.clubId));
    const groupTrust = {};
    ['starter','rotation','substitute','youth'].forEach(group => {
      const entries = activeEntries.filter(entry => entry.primaryGroup === group);
      groupTrust[group] = { value:drOneDecimal(drAverage(entries.map(entry => entry.value))), count:entries.length };
    });
    const referents = activeEntries.filter(entry => entry.tags.includes('referent'));
    groupTrust.referent = { value:drOneDecimal(drAverage(referents.map(entry => entry.value))), count:referents.length };
    const weighted = activeEntries.reduce((sum, entry) => sum + entry.value * (1 + entry.influence / 100), 0);
    const weights = activeEntries.reduce((sum, entry) => sum + (1 + entry.influence / 100), 0);
    stint.generalTrust = drClamp(drOneDecimal(weights ? weighted / weights : 50), 0, 100);
    stint.groupTrust = groupTrust;
    stint.leadershipEnd = drClamp(drRound(stint.generalTrust), 0, 100);
    stint.updatedAt = drNow();
    return groupTrust;
  }
  function drRosterSyncSignature(stint, players=[]){
    const stats = game?.playerStats || {};
    const lineup = [...(game?.tactic?.starters || []), '|', ...(game?.tactic?.bench || [])].join(',');
    const roster = (players || []).map(player => {
      const stat = stats[player.id] || {};
      return `${Number(player.id)}:${Number(player.age || 0)}:${Number(player.overall || 0)}:${Number(stat.played || 0)}:${Number(stat.starts || 0)}`;
    }).join(';');
    return `${drCurrentSeason()}:${drCurrentClubId()}:${String(game?.currentDate || '')}:${Number(game?.globalTurn || 0)}:${Number(stint?.captainId || 0)}:${Number(stint?.viceCaptainId || 0)}:${lineup}:${roster}`;
  }
  function drSyncRoster(stint, options={}){
    if(!stint) return null;
    const players = drPlayersByClub(stint.clubId);
    const signature = drRosterSyncSignature(stint, players);
    if(options.force !== true && stint.__runtimeRosterSyncSignature === signature) return stint;
    const hierarchy = drEnsureLeadershipHierarchy(stint, players);
    const referentIds = drDetermineReferents(players, stint);
    const referentSet = new Set(referentIds);
    const captainId = Number(hierarchy.captainId || 0);
    const viceCaptainId = Number(hierarchy.viceCaptainId || 0);
    const nextTrust = {};
    players.forEach(player => {
      const id = Number(player.id);
      const group = drPrimaryGroup(player, referentIds);
      const tags = [];
      if(referentSet.has(id)) tags.push('referent');
      if(id === captainId) tags.push('captain');
      if(id === viceCaptainId) tags.push('viceCaptain');
      const influence = drInfluenceScore(player, new Set(stint.referentIds || []));
      const previous = stint.playerTrust?.[id];
      const entry = previous ? normalizePlayerTrustEntry(previous, id, stint.clubId) : normalizePlayerTrustEntry({}, id, stint.clubId);
      entry.primaryGroup = group;
      entry.tags = tags;
      entry.influence = influence;
      if(!previous){
        entry.value = drInitialTrust(player, group, tags, stint);
        entry.lastReason = 'Llegada del mánager';
        entry.updatedAt = drNow();
      }
      nextTrust[id] = entry;
    });
    stint.playerTrust = nextTrust;
    stint.referentIds = referentIds;
    stint.previousCaptainId = Number(stint.previousCaptainId || stint.captainId || captainId || 0);
    stint.previousViceCaptainId = Number(stint.previousViceCaptainId || stint.viceCaptainId || viceCaptainId || 0);
    stint.captainId = captainId;
    stint.viceCaptainId = viceCaptainId;
    drUpdateGroupSummary(stint);
    try{ Object.defineProperty(stint, '__runtimeRosterSyncSignature', { value:drRosterSyncSignature(stint, players), writable:true, configurable:true, enumerable:false }); }
    catch(_){ stint.__runtimeRosterSyncSignature = drRosterSyncSignature(stint, players); }
    return stint;
  }
  function drPreviousContinuationStint(clubId, season){
    const state = game?.managerDressingRoom;
    if(!state?.stints) return null;
    return Object.values(state.stints)
      .filter(item => Number(item?.clubId || 0) === Number(clubId) && Number(item?.season || 0) === Number(season) - 1)
      .sort((a,b) => String(b?.updatedAt || b?.initializedAt || '').localeCompare(String(a?.updatedAt || a?.initializedAt || '')))[0] || null;
  }
  function drCarryTrustFromPrevious(previous, clubId){
    if(!previous) return {};
    const carried = {};
    Object.values(previous.playerTrust || {}).forEach(entry => {
      const player = drPlayerById(entry.playerId);
      if(!player || Number(player.clubId || 0) !== Number(clubId)) return;
      const clean = normalizePlayerTrustEntry(entry, entry.playerId, clubId);
      clean.value = drClamp(drOneDecimal(50 + (Number(clean.value || 50) - 50) * 0.78), 0, 100);
      clean.renewal = null;
      clean.lastChange = 0;
      clean.lastReason = 'Confianza heredada de la temporada anterior';
      clean.updatedAt = drNow();
      clean.unusedStreak = 0;
      clean.matchesTracked = 0;
      carried[clean.playerId] = clean;
    });
    return carried;
  }

  function ensureDressingRoom(options={}){
    if(!game || !drCurrentClubId() || game?.gameOver?.active) return null;
    if(!game.managerDressingRoom || typeof game.managerDressingRoom !== 'object' || Number(game.managerDressingRoom.version || 0) !== DRESSING_ROOM_VERSION || !game.managerDressingRoom.stints || typeof game.managerDressingRoom.stints !== 'object'){
      game.managerDressingRoom = normalizeDressingRoomState(game.managerDressingRoom || {});
    }
    const key = drStintKey(game);
    let stint = game.managerDressingRoom.stints[key];
    if(!stint){
      const previous = drPreviousContinuationStint(drCurrentClubId(), drCurrentSeason());
      stint = normalizeDressingRoomStint({
        key,
        season:drCurrentSeason(),
        clubId:drCurrentClubId(),
        stintId:drCurrentStintId(),
        initializedAt:drNow(),
        leadershipStart:drCurrentLeadership(),
        leadershipEnd:drCurrentLeadership(),
        initialGeneralTrust:previous ? Number(previous.generalTrust || 50) : drConfig('confianzaInicial', 50),
        playerTrust:drCarryTrustFromPrevious(previous, drCurrentClubId()),
        referentIds:previous?.referentIds || [],
        captainId:Number(previous?.captainId || game?.tactic?.captainId || 0),
        viceCaptainId:Number(previous?.viceCaptainId || 0),
        previousCaptainId:Number(previous?.captainId || 0),
        previousViceCaptainId:Number(previous?.viceCaptainId || 0)
      }, key);
      game.managerDressingRoom.stints[key] = stint;
    }
    game.managerDressingRoom.activeKey = key;
    drSyncRoster(stint);
    if(options.save === true && typeof saveLocal === 'function') saveLocal(true);
    return stint;
  }
  function drCurrentDressingRoomFast(){
    if(!game?.managerDressingRoom || typeof game.managerDressingRoom !== 'object' || Number(game.managerDressingRoom.version || 0) !== DRESSING_ROOM_VERSION) return null;
    return game.managerDressingRoom.stints?.[drStintKey(game)] || null;
  }
  function currentDressingRoom(){
    const existing = drCurrentDressingRoomFast();
    return existing ? drSyncRoster(existing) : ensureDressingRoom();
  }
  function drFastEntry(playerId){
    const id = Number(playerId || 0);
    if(!id) return null;
    let stint = drCurrentDressingRoomFast() || ensureDressingRoom();
    let entry = stint?.playerTrust?.[id] || null;
    if(!entry && drValidLeadershipPlayer(id, stint?.clubId || drCurrentClubId())){
      stint = drSyncRoster(stint, { force:true });
      entry = stint?.playerTrust?.[id] || null;
    }
    return entry;
  }
  function drEntry(playerId, create=true){
    const stint = currentDressingRoom();
    const id = Number(playerId || 0);
    if(!stint || !id) return null;
    if(!stint.playerTrust[id] && create) drSyncRoster(stint);
    return stint.playerTrust[id] || null;
  }

  function drRecordEvent(stint, type, reason, changes=[]){
    if(!stint) return;
    stint.events = Array.isArray(stint.events) ? stint.events : [];
    stint.events.push({
      type:String(type || 'relationship'),
      reason:String(reason || ''),
      season:drCurrentSeason(),
      date:drNow(),
      changes:(changes || []).filter(item => Number(item?.delta || 0) !== 0).slice(0, 40)
    });
    stint.events = stint.events.slice(-120);
  }
  function drApplyTrustChange(playerId, delta, reason='', options={}){
    const entry = drEntry(playerId, true);
    if(!entry || !Number.isFinite(Number(delta)) || Number(delta) === 0) return 0;
    const before = Number(entry.value || 0);
    const after = drClamp(drOneDecimal(before + Number(delta)), 0, 100);
    const applied = drOneDecimal(after - before);
    entry.value = after;
    entry.lastChange = applied;
    entry.lastReason = String(reason || 'Cambio de confianza');
    entry.updatedAt = drNow();
    if(options.morale !== false && Math.abs(applied) >= 1.5 && game?.playerMorale){
      const moraleDelta = applied > 0 ? 1 : -1;
      const current = typeof currentMorale === 'function' ? Number(currentMorale(playerId) || 50) : Number(game.playerMorale[playerId] || 50);
      game.playerMorale[playerId] = drClamp(drRound(current + moraleDelta), 1, 99);
    }
    return applied;
  }
  function drApplyGroupChange(filter, delta, reason='', options={}){
    const stint = currentDressingRoom();
    if(!stint) return [];
    const changes = [];
    Object.values(stint.playerTrust).forEach(entry => {
      const player = drPlayerById(entry.playerId);
      if(!player || Number(player.clubId || 0) !== Number(stint.clubId)) return;
      if(typeof filter === 'function' && !filter(entry, player)) return;
      const applied = drApplyTrustChange(entry.playerId, delta, reason, options);
      if(applied) changes.push({ playerId:entry.playerId, delta:applied });
    });
    drUpdateGroupSummary(stint);
    if(changes.length && options.record !== false) drRecordEvent(stint, options.type || 'group', reason, changes);
    return changes;
  }

  function drMatchKey(match){
    return `${drCurrentSeason()}:${String(match?.id || `${match?.date || drNow()}-${match?.homeId || 0}-${match?.awayId || 0}-${match?.homeGoals ?? 'x'}-${match?.awayGoals ?? 'x'}`)}`;
  }
  function drMatchParticipants(match, clubId){
    const isHome = Number(match?.homeId || 0) === Number(clubId);
    const starters = new Set(((isHome ? match?.starterIdsHome : match?.starterIdsAway) || []).map(Number).filter(Boolean));
    const played = new Set(starters);
    (match?.substitutions || []).filter(sub => Number(sub?.clubId || 0) === Number(clubId)).forEach(sub => {
      const inId = Number(sub?.inId || 0);
      const outId = Number(sub?.outId || 0);
      if(inId) played.add(inId);
      if(outId) played.add(outId);
    });
    const captainId = Number(isHome ? match?.captainIdHome : match?.captainIdAway) || Number(game?.tactic?.captainId || 0);
    return { isHome, starters, played, captainId };
  }
  function drProcessCaptainChange(stint, participants, changes){
    const actualCaptainId = Number(participants.captainId || 0);
    const hierarchy = drEnsureLeadershipHierarchy(stint);
    const designatedCaptainId = Number(hierarchy.captainId || 0);
    const viceCaptainId = Number(hierarchy.viceCaptainId || 0);
    if(!actualCaptainId) return;
    const designatedStarts = participants.starters.has(designatedCaptainId);
    const viceStarts = participants.starters.has(viceCaptainId);
    const expectedCaptainId = designatedStarts ? designatedCaptainId : viceStarts ? viceCaptainId : actualCaptainId;
    if(actualCaptainId === expectedCaptainId) return;
    const omittedId = expectedCaptainId;
    const omittedIsCaptain = omittedId === designatedCaptainId;
    const omittedDelta = Number(drConfig(omittedIsCaptain ? 'cambiosPartido.capitanDesignadoOmitido' : 'cambiosPartido.segundoCapitanOmitido', omittedIsCaptain ? -4 : -2));
    const omittedReason = omittedIsCaptain ? 'Fue omitido como capitán pese a ser titular' : 'Fue omitido como 2.º capitán pese a tener prioridad';
    const omittedApplied = drApplyTrustChange(omittedId, omittedDelta, omittedReason);
    if(omittedApplied) changes.push({ playerId:omittedId, delta:omittedApplied });
    const refDelta = Number(drConfig('cambiosPartido.referentesPorCapitanExcepcional', -1));
    Object.values(stint.playerTrust).filter(entry => entry.tags.includes('referent') && Number(entry.playerId) !== omittedId && Number(entry.playerId) !== actualCaptainId).forEach(entry => {
      const applied = drApplyTrustChange(entry.playerId, refDelta, 'La elección excepcional del capitán generó dudas');
      if(applied) changes.push({ playerId:entry.playerId, delta:applied });
    });
  }
  function processDressingRoomAfterMatch(match){
    if(!game || !match || match?.friendly || game?.gameOver?.active) return null;
    const clubId = drCurrentClubId();
    if(Number(match.homeId || 0) !== clubId && Number(match.awayId || 0) !== clubId) return null;
    const stint = ensureDressingRoom();
    if(!stint) return null;
    const key = drMatchKey(match);
    if(stint.matchKeys[key]) return null;
    stint.matchKeys[key] = true;
    const keys = Object.keys(stint.matchKeys);
    if(keys.length > 500) keys.slice(0, keys.length - 500).forEach(matchKey => delete stint.matchKeys[matchKey]);
    drSyncRoster(stint);
    const participants = drMatchParticipants(match, clubId);
    const gf = participants.isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
    const gc = participants.isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
    const won = gf > gc;
    const lost = gf < gc;
    const broadDefeat = lost && gc - gf >= 3;
    const changes = [];
    drProcessCaptainChange(stint, participants, changes);
    Object.values(stint.playerTrust).forEach(entry => {
      const id = Number(entry.playerId);
      const player = drPlayerById(id);
      if(!player || Number(player.clubId || 0) !== clubId) return;
      const started = participants.starters.has(id);
      const played = participants.played.has(id);
      let delta = 0;
      if(won) delta += Number(drConfig(started ? 'cambiosPartido.victoriaTitular' : 'cambiosPartido.victoriaResto', started ? 2 : 1));
      else if(!lost && started) delta += Number(drConfig('cambiosPartido.empateTitular', 1));
      else if(lost) delta += Number(drConfig(started ? 'cambiosPartido.derrotaTitular' : 'cambiosPartido.derrotaResto', -1));
      if(broadDefeat) delta += Number(drConfig('cambiosPartido.derrotaAmpliaExtra', -1));
      if(entry.primaryGroup === 'starter' && !started && !(typeof isUnavailable === 'function' && isUnavailable(id))){
        delta += Number(drConfig('cambiosPartido.titularNoUtilizado', -1));
      }
      if(entry.primaryGroup === 'rotation' && !played && !(typeof isUnavailable === 'function' && isUnavailable(id))){
        entry.unusedStreak += 1;
        if(entry.unusedStreak >= 3){
          delta += Number(drConfig('cambiosPartido.rotacionTresPartidosSinJugar', -1));
          entry.unusedStreak = 0;
        }
      }else if(played){ entry.unusedStreak = 0; }
      if(entry.primaryGroup === 'substitute' && played) delta += Number(drConfig('cambiosPartido.suplenteUtilizado', 1));
      if(entry.primaryGroup === 'youth' && played) delta += Number(drConfig('cambiosPartido.jovenUtilizado', 1));
      if(id === Number(participants.captainId || 0)) delta += Number(drConfig('cambiosPartido.capitanElegido', 1));
      entry.matchesTracked += 1;
      const applied = drApplyTrustChange(id, delta, won ? 'Resultado y participación en una victoria' : lost ? 'Resultado y participación en una derrota' : 'Resultado y participación en un empate');
      if(applied) changes.push({ playerId:id, delta:applied });
    });
    drSyncRoster(stint);
    const general = Number(stint.generalTrust || 50);
    let cohesionDelta = 0;
    if(won && general >= Number(drConfig('confianzaRespaldo', 70))) cohesionDelta = 1;
    else if(lost && general < Number(drConfig('confianzaDudas', 35))) cohesionDelta = -1;
    if(general < Number(drConfig('confianzaTension', 20))) cohesionDelta = Math.min(cohesionDelta, -1);
    if(cohesionDelta && typeof adjustTeamCohesion === 'function') adjustTeamCohesion(clubId, cohesionDelta);
    drRecordEvent(stint, 'match', `${won ? 'Victoria' : lost ? 'Derrota' : 'Empate'} ${gf}-${gc}`, changes);
    if(typeof saveLocal === 'function') saveLocal(true);
    return { generalTrust:stint.generalTrust, changes:changes.length, cohesionDelta };
  }

  function drRenewalDemandForTrust(entry){ return drRenewalDisposition(entry?.value || 0, entry); }
  function applyDressingRoomRenewals(originalResult, salaryBefore){
    const stint = currentDressingRoom();
    if(!stint || !salaryBefore) return originalResult;
    // V8.75: la confianza prepara la negociación, pero no renueva ni cambia
    // salarios automáticamente en el club dirigido.
    Object.values(stint.playerTrust).forEach(entry => {
      const player = drPlayerById(entry.playerId);
      if(!player || Number(player.clubId || 0) !== Number(stint.clubId)) return;
      const before = Math.max(0, Number(salaryBefore.get(Number(player.id)) || player.salary || 0));
      const disposition = drRenewalDemandForTrust(entry);
      entry.renewal = {
        season:drCurrentSeason(),
        disposition:disposition.code,
        status:'manual_pending',
        demandFactor:disposition.factor,
        requestedTransfer:Boolean(player.transferRequest),
        salaryBefore:drRound(before),
        salaryAfter:drRound(Number(player.salary || before))
      };
    });
    drSyncRoster(stint);
    return originalResult;
  }

  function drHandleImportantDeparture(playerId, kind='sale', entrySnapshot=null){
    const stint = currentDressingRoom();
    const entry = entrySnapshot || stint?.playerTrust?.[Number(playerId || 0)];
    if(!stint || !entry) return;
    const wasCaptain = entry.tags.includes('captain');
    const wasViceCaptain = entry.tags.includes('viceCaptain');
    const wasReferent = entry.tags.includes('referent');
    if(!wasCaptain && !wasViceCaptain && !wasReferent) return;
    const reason = kind === 'dismissal' ? 'Despido de un referente del vestuario' : 'Venta de un referente del vestuario';
    const changes = [];
    Object.values(stint.playerTrust).forEach(other => {
      if(Number(other.playerId) === Number(playerId)) return;
      const player = drPlayerById(other.playerId);
      if(!player || Number(player.clubId || 0) !== Number(stint.clubId)) return;
      let delta = wasCaptain ? -2 : wasViceCaptain ? -1 : -1;
      if(other.tags.includes('referent')) delta -= kind === 'dismissal' ? 2 : 1;
      const applied = drApplyTrustChange(other.playerId, delta, reason);
      if(applied) changes.push({ playerId:other.playerId, delta:applied });
    });
    drSyncRoster(stint);
    drRecordEvent(stint, kind, reason, changes);
  }

  function drSnapshot(stint=currentDressingRoom()){
    if(!stint) return null;
    drUpdateGroupSummary(stint);
    return {
      season:Number(stint.season || drCurrentSeason()),
      clubId:Number(stint.clubId || drCurrentClubId()),
      generalTrust:drOneDecimal(stint.generalTrust || 50),
      groupTrust:JSON.parse(JSON.stringify(stint.groupTrust || {})),
      referentIds:[...(stint.referentIds || [])],
      captainId:Number(stint.captainId || 0),
      viceCaptainId:Number(stint.viceCaptainId || 0),
      leadershipScore:null,
      recordedAt:drNow()
    };
  }
  function drAttachSnapshotToSeasonHistory(status='season_end', snapshot=null){
    if(!snapshot || !game?.managerStats) return false;
    const history = Array.isArray(game.managerStats.seasonHistory) ? game.managerStats.seasonHistory : [];
    const candidates = history.filter(item => Number(item?.season || 0) === Number(snapshot.season) && Number(item?.clubId || 0) === Number(snapshot.clubId));
    const preferred = candidates.filter(item => String(item?.status || '') === String(status)).slice(-1)[0] || candidates.slice(-1)[0];
    if(!preferred) return false;
    snapshot.leadershipScore = managerDressingRoomLeadershipScore(snapshot.clubId);
    preferred.dressingRoom = snapshot;
    if(preferred.components && Number.isFinite(Number(snapshot.leadershipScore))) preferred.components.leadership = Number(snapshot.leadershipScore);
    return true;
  }

  function managerDressingRoomLeadershipScore(clubId=drCurrentClubId()){
    if(Number(clubId || 0) !== drCurrentClubId()) return null;
    const stint = currentDressingRoom();
    if(!stint) return null;
    const general = Number(stint.generalTrust || 50);
    const referents = Number(stint.groupTrust?.referent?.value || general);
    const morale = typeof squadMoraleAverage === 'function' ? Number(squadMoraleAverage(clubId) || 50) / 99 * 100 : 50;
    const cohesion = typeof cohesionValue === 'function' ? Number(cohesionValue(clubId) || 50) : 50;
    let score = general * 0.45 + referents * 0.20 + morale * 0.20 + cohesion * 0.15;
    if(general < Number(drConfig('confianzaTension', 20))) score -= 8;
    return drClamp(drRound(score), 0, 100);
  }
  window.managerDressingRoomLeadershipScore = managerDressingRoomLeadershipScore;
  window.managerDressingRoomTrust = function(playerId){ return Number(drFastEntry(playerId)?.value || 0); };
  window.managerDressingRoomState = function(){ return currentDressingRoom(); };

  function drTrustBar(value){
    const trust = drClamp(Number(value || 0), 0, 100);
    const status = drTrustStatus(trust);
    return `<div class="dressing-trust-cell"><div class="dressing-trust-head"><strong>${drRound(trust)}</strong><span class="${status.tone}">${escapeHtml(status.label)}</span></div><div class="dressing-trust-track"><i style="width:${trust}%"></i></div></div>`;
  }
  function drTagMarkup(entry){
    const tags = [];
    if(entry?.tags?.includes('captain')) tags.push('<span class="pill ok">Capitán</span>');
    if(entry?.tags?.includes('viceCaptain')) tags.push('<span class="pill warn">2.º capitán</span>');
    if(entry?.tags?.includes('referent')) tags.push('<span class="pill">Referente</span>');
    return tags.join(' ') || '<span class="muted small">—</span>';
  }
  function drGroupCard(group, data){
    const status = drTrustStatus(data?.value || 0);
    return `<div class="card dressing-group-card"><p class="label">${escapeHtml(GROUP_LABELS[group] || group)}</p><strong>${drRound(data?.value || 0)}</strong><span class="${status.tone}">${escapeHtml(status.label)}</span><small>${drRound(data?.count || 0)} jugador(es)</small></div>`;
  }
  function drRenewalSortValue(entry){
    const disposition = drRenewalDisposition(entry?.value || 0, entry);
    return { refusal:0, exit:0, hard:1, doubts:2, open:3, ready:4, excellent:5 }[disposition.code] ?? 2;
  }
  function drGroupSortValue(group){
    return { starter:1, rotation:2, substitute:3, youth:4 }[String(group || '')] || 9;
  }
  function drRoleSortValue(entry){
    return entry?.tags?.includes('captain') ? 0 : entry?.tags?.includes('viceCaptain') ? 1 : entry?.tags?.includes('referent') ? 2 : 3;
  }
  function drSortedPlayers(stint){
    const items = Object.values(stint.playerTrust).map(entry => ({ entry, player:drPlayerById(entry.playerId) })).filter(item => item.player);
    const byName = (a,b) => String(a.player.name || '').localeCompare(String(b.player.name || ''), 'es');
    const morale = item => typeof currentMorale === 'function' ? Number(currentMorale(item.player.id) || 0) : Number(game?.playerMorale?.[item.player.id] || 0);
    const sorters = {
      name_asc:byName, name_desc:(a,b)=>-byName(a,b),
      group_asc:(a,b)=>drGroupSortValue(a.entry.primaryGroup)-drGroupSortValue(b.entry.primaryGroup)||byName(a,b),
      group_desc:(a,b)=>drGroupSortValue(b.entry.primaryGroup)-drGroupSortValue(a.entry.primaryGroup)||byName(a,b),
      role_asc:(a,b)=>drRoleSortValue(a.entry)-drRoleSortValue(b.entry)||byName(a,b),
      role_desc:(a,b)=>drRoleSortValue(b.entry)-drRoleSortValue(a.entry)||byName(a,b),
      trust_asc:(a,b)=>Number(a.entry.value||0)-Number(b.entry.value||0)||byName(a,b),
      trust_desc:(a,b)=>Number(b.entry.value||0)-Number(a.entry.value||0)||byName(a,b),
      influence_asc:(a,b)=>Number(a.entry.influence||0)-Number(b.entry.influence||0)||byName(a,b),
      influence_desc:(a,b)=>Number(b.entry.influence||0)-Number(a.entry.influence||0)||byName(a,b),
      renewal_asc:(a,b)=>drRenewalSortValue(a.entry)-drRenewalSortValue(b.entry)||byName(a,b),
      renewal_desc:(a,b)=>drRenewalSortValue(b.entry)-drRenewalSortValue(a.entry)||byName(a,b),
      age_asc:(a,b)=>Number(a.player.age||0)-Number(b.player.age||0)||byName(a,b),
      age_desc:(a,b)=>Number(b.player.age||0)-Number(a.player.age||0)||byName(a,b),
      overall_asc:(a,b)=>(typeof visibleOverall==='function'?visibleOverall(a.player):Number(a.player.overall||0))-(typeof visibleOverall==='function'?visibleOverall(b.player):Number(b.player.overall||0))||byName(a,b),
      overall_desc:(a,b)=>(typeof visibleOverall==='function'?visibleOverall(b.player):Number(b.player.overall||0))-(typeof visibleOverall==='function'?visibleOverall(a.player):Number(a.player.overall||0))||byName(a,b),
      morale_asc:(a,b)=>morale(a)-morale(b)||byName(a,b),
      morale_desc:(a,b)=>morale(b)-morale(a)||byName(a,b)
    };
    return items.sort(sorters[dressingRoomSort] || sorters.influence_desc);
  }
  function drColumnSort(label, asc, desc){
    if(typeof compactSortButtons === 'function') return compactSortButtons(label, [[asc,'Menor a mayor'],[desc,'Mayor a menor']], dressingRoomSort, 'data-dressing-sort');
    return label;
  }

  function drLeadershipOptionMarkup(player, selectedId, excludedId=0){
    const current = typeof captaincyValue === 'function' ? Number(captaincyValue(player.id) || 0) : 0;
    const target = typeof captaincyTargetMatchesForPlayer === 'function' ? Number(captaincyTargetMatchesForPlayer(player) || 0) : 60;
    const disabled = Number(player.id) === Number(excludedId || 0) ? 'disabled' : '';
    return `<option value="${Number(player.id)}" ${Number(player.id) === Number(selectedId) ? 'selected' : ''} ${disabled}>${escapeHtml(player.name || '')} · ${player.position || ''} · Capitanía ${current}% · ${target} PJ aprox.</option>`;
  }
  function drLeadershipCardMarkup(stint){
    const hierarchy = drEnsureLeadershipHierarchy(stint);
    const players = drLeadershipCandidates(drPlayersByClub(stint.clubId));
    const captain = drPlayerById(hierarchy.captainId);
    const vice = drPlayerById(hierarchy.viceCaptainId);
    return `<div class="card dressing-leadership-card">
      <div class="dressing-leadership-head"><div><h3>Capitanía del plantel</h3><p>El capitán tiene prioridad si es titular. En su ausencia, la prioridad pasa al 2.º capitán. Podés elegir otro jugador para un partido, pero la decisión puede generar tensión.</p></div><span class="pill">Valores en %</span></div>
      <div class="dressing-leadership-selectors">
        <label><span>Capitán</span><select id="dressingCaptainSelect">${players.map(player => drLeadershipOptionMarkup(player, hierarchy.captainId, hierarchy.viceCaptainId)).join('')}</select></label>
        <label><span>2.º capitán</span><select id="dressingViceCaptainSelect">${players.map(player => drLeadershipOptionMarkup(player, hierarchy.viceCaptainId, hierarchy.captainId)).join('')}</select></label>
      </div>
      <div class="dressing-leadership-current">
        <div><strong>${escapeHtml(captain?.name || 'Sin capitán')}</strong><span>Capitanía ${typeof captaincyValue === 'function' ? captaincyValue(captain?.id) : 0}% · ${typeof captaincyMatches === 'function' ? captaincyMatches(captain?.id) : 0} PJ como capitán</span></div>
        <div><strong>${escapeHtml(vice?.name || 'Sin 2.º capitán')}</strong><span>Capitanía ${typeof captaincyValue === 'function' ? captaincyValue(vice?.id) : 0}% · ${typeof captaincyMatches === 'function' ? captaincyMatches(vice?.id) : 0} PJ como capitán</span></div>
      </div>
      <button id="saveDressingLeadership" class="primary">Guardar jerarquía</button>
      <p class="muted small">El progreso requiere aproximadamente entre una y tres temporadas. Los jugadores de 28 años o más se forman más rápido.</p>
    </div>`;
  }
  function drSetLeadership(captainId, viceCaptainId, options={}){
    const stint = currentDressingRoom() || ensureDressingRoom();
    if(!stint) return { ok:false, error:'Vestuario no disponible.' };
    const newCaptainId = Number(captainId || 0);
    const newViceCaptainId = Number(viceCaptainId || 0);
    if(!drValidLeadershipPlayer(newCaptainId, stint.clubId) || !drValidLeadershipPlayer(newViceCaptainId, stint.clubId)) return { ok:false, error:'Los dos jugadores deben pertenecer al plantel.' };
    if(newCaptainId === newViceCaptainId) return { ok:false, error:'Capitán y 2.º capitán deben ser jugadores diferentes.' };
    const oldCaptainId = Number(stint.captainId || 0);
    const oldViceCaptainId = Number(stint.viceCaptainId || 0);
    const changes = [];
    if(oldCaptainId !== newCaptainId){
      if(drValidLeadershipPlayer(oldCaptainId, stint.clubId)){
        const delta = Number(drConfig('cambiosPartido.exCapitanSinJustificacion', -4));
        const applied = drApplyTrustChange(oldCaptainId, delta, 'Dejó de ser capitán del plantel');
        if(applied) changes.push({ playerId:oldCaptainId, delta:applied });
      }
      const applied = drApplyTrustChange(newCaptainId, Number(drConfig('cambiosPartido.nuevoCapitan', 2)), 'Fue nombrado capitán del plantel');
      if(applied) changes.push({ playerId:newCaptainId, delta:applied });
    }
    if(oldViceCaptainId !== newViceCaptainId){
      if(drValidLeadershipPlayer(oldViceCaptainId, stint.clubId) && oldViceCaptainId !== newCaptainId){
        const delta = Number(drConfig('cambiosPartido.exSegundoCapitanSinJustificacion', -2));
        const applied = drApplyTrustChange(oldViceCaptainId, delta, 'Dejó de ser 2.º capitán');
        if(applied) changes.push({ playerId:oldViceCaptainId, delta:applied });
      }
      const applied = drApplyTrustChange(newViceCaptainId, Number(drConfig('cambiosPartido.nuevoSegundoCapitan', 1)), 'Fue nombrado 2.º capitán');
      if(applied) changes.push({ playerId:newViceCaptainId, delta:applied });
    }
    stint.previousCaptainId = oldCaptainId;
    stint.previousViceCaptainId = oldViceCaptainId;
    stint.captainId = newCaptainId;
    stint.viceCaptainId = newViceCaptainId;
    drSyncRoster(stint);
    if(game?.tactic){
      const preferred = typeof preferredCaptainForStarterIds === 'function' ? preferredCaptainForStarterIds(game.tactic.starters || [], stint.clubId) : null;
      game.tactic = typeof ensureTacticCaptain === 'function'
        ? ensureTacticCaptain({ ...game.tactic, captainId:Number(preferred?.id || 0), captainSelectionMode:'automatic' }, stint.clubId)
        : { ...game.tactic, captainId:Number(preferred?.id || 0), captainSelectionMode:'automatic' };
    }
    drRecordEvent(stint, 'leadership', 'Nueva jerarquía de capitanes', changes);
    if(options.save !== false && typeof saveLocal === 'function') saveLocal(true);
    return { ok:true, captainId:newCaptainId, viceCaptainId:newViceCaptainId, changes };
  }

  function renderDressingRoom(){
    const stint = ensureDressingRoom();
    if(!stint){
      view.innerHTML = '<div class="empty"><h2>Vestuario no disponible</h2><p>Necesitás estar dirigiendo un club.</p></div>';
      if(typeof prependFirstTeamTabs === 'function') prependFirstTeamTabs('dressingRoom');
      return;
    }
    const generalStatus = drTrustStatus(stint.generalTrust);
    const leadershipScore = managerDressingRoomLeadershipScore(stint.clubId);
    const rows = drSortedPlayers(stint).map(({ entry, player }) => {
        const renewal = drRenewalDisposition(entry.value, entry);
        const overall = typeof visibleOverall === 'function' ? visibleOverall(player) : Number(player.overall || 0);
        return `<tr><td>${typeof faceImg === 'function' ? faceImg(player, 'photo-thumb') : ''}</td><td><button class="linklike" data-player-id="${player.id}"><strong>${typeof playerNameWithStar === 'function' ? playerNameWithStar(player) : escapeHtml(player.name || '')}</strong></button></td><td><strong>${Number(player.age || 0)}</strong></td><td><strong>${overall}</strong></td><td><strong>${escapeHtml(GROUP_LABELS[entry.primaryGroup] || entry.primaryGroup)}</strong></td><td>${drTagMarkup(entry)}</td><td>${drTrustBar(entry.value)}</td><td><strong>${drRound(entry.influence)}</strong><small>Influencia</small></td><td><span class="${renewal.tone}">${escapeHtml(renewal.label)}</span>${entry.renewal?.salaryAfter ? `<small>${formatMoney(entry.renewal.salaryAfter)}</small>` : ''}</td><td>${typeof moraleBar === 'function' ? moraleBar(player.id) : '—'}</td></tr>`;
      }).join('');
    view.innerHTML = `<div class="section-title"><h2>Vestuario</h2><p class="tagline">La confianza se forma con resultados, participación, capitanía y decisiones sobre referentes. No sustituye la calidad deportiva del plantel.</p></div>
      <div class="dressing-summary-grid"><div class="dressing-main-summary"><span>Confianza general</span><strong>${drRound(stint.generalTrust)}</strong><em class="${generalStatus.tone}">${escapeHtml(generalStatus.label)}</em></div><div class="dressing-main-summary"><span>Evaluación de Liderazgo</span><strong>${drRound(leadershipScore)}</strong><em>Se utiliza al cerrar la temporada.</em></div><div class="dressing-main-summary"><span>Referentes</span><strong>${stint.referentIds.length}</strong><em>${stint.referentIds.map(id => playerLastName(drPlayerById(id)?.name || '')).filter(Boolean).join(' · ') || 'Sin referentes'}</em></div></div>
      <div class="dressing-groups-grid">${['referent','starter','rotation','substitute','youth'].map(group => drGroupCard(group, stint.groupTrust[group])).join('')}</div>
      ${drLeadershipCardMarkup(stint)}
      <div class="card dressing-explanation"><p><strong>Efectos activos:</strong> la confianza modifica la recuperación de moral, puede sumar o restar cohesión tras los partidos y cambia las exigencias salariales y la duración posible en una negociación contractual.</p></div>
      ${typeof starPlayerDressingRoomSummaryMarkup === 'function' ? starPlayerDressingRoomSummaryMarkup() : ''}
      <div class="table-wrap dressing-table-wrap"><table class="dressing-table"><thead><tr><th>Foto</th><th>${drColumnSort('Jugador','name_asc','name_desc')}</th><th>${drColumnSort('Edad','age_asc','age_desc')}</th><th>${drColumnSort('Media','overall_asc','overall_desc')}</th><th>${drColumnSort('Grupo','group_asc','group_desc')}</th><th>${drColumnSort('Rol interno','role_asc','role_desc')}</th><th>${drColumnSort('Confianza','trust_asc','trust_desc')}</th><th>${drColumnSort('Peso','influence_asc','influence_desc')}</th><th>${drColumnSort('Renovación','renewal_asc','renewal_desc')}</th><th>${drColumnSort('Moral','morale_asc','morale_desc')}</th></tr></thead><tbody>${rows || '<tr><td colspan="10" class="muted">No hay jugadores disponibles.</td></tr>'}</tbody></table></div>`;
    document.querySelectorAll('[data-dressing-sort]').forEach(button => button.addEventListener('click', () => { dressingRoomSort = button.dataset.dressingSort || 'influence_desc'; renderDressingRoom(); }));
    document.getElementById('saveDressingLeadership')?.addEventListener('click', () => {
      const result = drSetLeadership(Number(document.getElementById('dressingCaptainSelect')?.value || 0), Number(document.getElementById('dressingViceCaptainSelect')?.value || 0));
      if(!result.ok){ if(typeof showNotice === 'function') showNotice(result.error || 'No se pudo guardar la jerarquía.'); return; }
      if(typeof showNotice === 'function') showNotice('Capitán y 2.º capitán designados.');
      renderDressingRoom();
    });
    if(typeof prependFirstTeamTabs === 'function') prependFirstTeamTabs('dressingRoom');
  }
  window.renderDressingRoom = renderDressingRoom;

  function playerDressingRoomCardMarkup(player){
    if(!player || Number(player.clubId || 0) !== drCurrentClubId()) return '';
    const entry = drEntry(player.id, true);
    if(!entry) return '';
    const status = drTrustStatus(entry.value);
    const renewal = drRenewalDisposition(entry.value, entry);
    return `<div class="card inner player-dressing-room-card"><h3>Vestuario</h3><div class="stat-rank"><span>Confianza en el mánager</span><strong class="${status.tone}">${drRound(entry.value)} · ${escapeHtml(status.label)}</strong></div><div class="stat-rank"><span>Grupo</span><strong>${escapeHtml(GROUP_LABELS[entry.primaryGroup] || entry.primaryGroup)}</strong></div><div class="stat-rank"><span>Rol interno</span><strong>${entry.tags.includes('captain') ? 'Capitán' : entry.tags.includes('viceCaptain') ? '2.º capitán' : entry.tags.includes('referent') ? 'Referente' : 'Sin liderazgo especial'}</strong></div><div class="stat-rank"><span>Predisposición a renovar</span><strong class="${renewal.tone}">${escapeHtml(renewal.label)}</strong></div>${entry.lastReason ? `<p class="muted small-copy">Último cambio: ${entry.lastChange > 0 ? '+' : ''}${entry.lastChange} · ${escapeHtml(entry.lastReason)}</p>` : ''}</div>`;
  }

  function installDressingRoomHooks(){
    if(typeof normalizeGame === 'function'){
      const original = normalizeGame;
      normalizeGame = function(saved){
        const normalized = original(saved);
        normalized.managerDressingRoom = normalizeDressingRoomState(normalized.managerDressingRoom || {});
        return normalized;
      };
    }
    if(typeof newGame === 'function'){
      const originalNewGame = newGame;
      newGame = function(...args){
        const result = originalNewGame.apply(this, args);
        if(game && !game.gameOver?.active) ensureDressingRoom({ save:true });
        return result;
      };
    }
    if(typeof startNextSeason === 'function'){
      const originalStartNextSeason = startNextSeason;
      startNextSeason = function(...args){
        const result = originalStartNextSeason.apply(this, args);
        if(game && !game.gameOver?.active) ensureDressingRoom({ save:true });
        return result;
      };
    }
    if(typeof continueCareerAtClub === 'function'){
      const originalContinueCareerAtClub = continueCareerAtClub;
      continueCareerAtClub = function(...args){
        const result = originalContinueCareerAtClub.apply(this, args);
        if(game && !game.gameOver?.active) ensureDressingRoom({ save:true });
        return result;
      };
    }
    if(typeof updateManagerMatchStats === 'function'){
      const original = updateManagerMatchStats;
      updateManagerMatchStats = function(match){
        const result = original(match);
        processDressingRoomAfterMatch(match);
        return result;
      };
    }
    if(typeof applySeasonSalaryAdjustments === 'function'){
      const original = applySeasonSalaryAdjustments;
      applySeasonSalaryAdjustments = function(){
        const salaryBefore = new Map((seed?.players || []).map(player => [Number(player.id), Number(player.salary || 0)]));
        const result = original();
        return applyDressingRoomRenewals(result, salaryBefore);
      };
    }
    if(typeof firstTeamTabsMarkup === 'function'){
      const original = firstTeamTabsMarkup;
      firstTeamTabsMarkup = function(current){
        const html = original(current);
        const button = `<button class="${current === 'dressingRoom' ? 'active' : ''}" data-first-team-tab="dressingRoom">Vestuario</button>`;
        return html.replace('</div></div>', `${button}</div></div>`);
      };
    }
    if(typeof renderFirstTeam === 'function'){
      const original = renderFirstTeam;
      renderFirstTeam = function(){
        if(firstTeamTab === 'dressingRoom') return renderDressingRoom();
        return original();
      };
    }
    if(typeof showPlayerModal === 'function'){
      const original = showPlayerModal;
      showPlayerModal = function(playerId){
        const result = original(playerId);
        const player = drPlayerById(playerId);
        const card = playerDressingRoomCardMarkup(player);
        const starCard = typeof starPlayerProfileCardMarkup === 'function' ? starPlayerProfileCardMarkup(player) : '';
        const stack = document.querySelector('.player-modal-grid .stack');
        if(card && stack && !stack.querySelector('.player-dressing-room-card')) stack.insertAdjacentHTML('beforeend', card);
        if(starCard && stack && !stack.querySelector('.player-star-discipline-card')) stack.insertAdjacentHTML('beforeend', starCard);
        return result;
      };
    }
    if(typeof toggleTransferListed === 'function'){
      const original = toggleTransferListed;
      toggleTransferListed = function(playerId, value){
        const entry = drEntry(playerId, false);
        const result = original(playerId, value);
        if(value && entry?.tags?.includes('referent')){
          drApplyTrustChange(playerId, -3, 'Fue declarado transferible');
          drApplyGroupChange(other => other.tags.includes('referent') && Number(other.playerId) !== Number(playerId), -1, 'Un referente fue declarado transferible', { type:'transfer_list' });
        }
        return result;
      };
    }
    if(typeof dismissOwnPlayer === 'function'){
      const original = dismissOwnPlayer;
      dismissOwnPlayer = function(playerId){
        const entry = drEntry(playerId, false) ? { ...drEntry(playerId, false), tags:[...(drEntry(playerId, false)?.tags || [])] } : null;
        const clubBefore = Number(drPlayerById(playerId)?.clubId || 0);
        const result = original(playerId);
        const left = clubBefore && Number(drPlayerById(playerId)?.clubId || 0) !== clubBefore;
        if(left && entry && (entry.tags.includes('referent') || entry.tags.includes('captain') || entry.tags.includes('viceCaptain'))) drHandleImportantDeparture(playerId, 'dismissal', entry);
        return result;
      };
    }
    if(typeof completeTransferSaleFromMessage === 'function'){
      const original = completeTransferSaleFromMessage;
      completeTransferSaleFromMessage = function(msg, player, options={}){
        const playerId = Number(player?.id || msg?.action?.playerId || 0);
        const entry = drEntry(playerId, false) ? { ...drEntry(playerId, false), tags:[...(drEntry(playerId, false)?.tags || [])] } : null;
        const result = original(msg, player, options);
        if(result?.executed && entry && (entry.tags.includes('referent') || entry.tags.includes('captain') || entry.tags.includes('viceCaptain'))) drHandleImportantDeparture(playerId, 'sale', entry);
        return result;
      };
    }
    if(typeof processPendingTransfers === 'function'){
      const original = processPendingTransfers;
      processPendingTransfers = function(){
        const result = original();
        if(result?.changed) ensureDressingRoom({ save:false });
        return result;
      };
    }
    if(typeof finalizeSeasonIfNeeded === 'function'){
      const originalFinalizeSeasonIfNeeded = finalizeSeasonIfNeeded;
      finalizeSeasonIfNeeded = function(options={}){
        const snapshot = drSnapshot(currentDressingRoom());
        const result = originalFinalizeSeasonIfNeeded(options);
        if(drAttachSnapshotToSeasonHistory('season_end', snapshot) && typeof saveLocal === 'function') saveLocal(true);
        return result;
      };
    }
    if(typeof recordDismissedCareerStep === 'function'){
      const originalRecordDismissedCareerStep = recordDismissedCareerStep;
      recordDismissedCareerStep = function(){
        const snapshot = drSnapshot(currentDressingRoom());
        const status = game?.gameOver?.type === 'resignation' ? 'resignation' : 'dismissal';
        const result = originalRecordDismissedCareerStep();
        if(drAttachSnapshotToSeasonHistory(status, snapshot) && typeof saveLocal === 'function') saveLocal(true);
        return result;
      };
    }
    if(typeof renderHome === 'function'){
      const original = renderHome;
      renderHome = function(){
        ensureDressingRoom();
        return original();
      };
    }
  }

  installDressingRoomHooks();
  window.managerDressingRoom = {
    version:DRESSING_ROOM_VERSION,
    ensure:ensureDressingRoom,
    current:currentDressingRoom,
    trust:playerId => Number(drFastEntry(playerId)?.value || 0),
    leadershipScore:managerDressingRoomLeadershipScore,
    renewal:playerId => {
      const entry = drFastEntry(playerId);
      return drRenewalDisposition(entry?.value || 0, entry);
    },
    processMatch:processDressingRoomAfterMatch,
    changeTrust:(playerId, delta, reason='Relación con el mánager', options={}) => {
      const applied = drApplyTrustChange(playerId, delta, reason, options);
      drUpdateGroupSummary(currentDressingRoom());
      return applied;
    },
    changeGroup:(filter, delta, reason='Relación con el mánager', options={}) => {
      const changes = drApplyGroupChange(filter, delta, reason, options);
      drUpdateGroupSummary(currentDressingRoom());
      return changes;
    },
    refresh:() => drUpdateGroupSummary(currentDressingRoom()),
    hierarchy:(clubId=drCurrentClubId()) => {
      if(Number(clubId || 0) !== drCurrentClubId()) return { captainId:0, viceCaptainId:0 };
      const stint = drCurrentDressingRoomFast() || ensureDressingRoom();
      const captainId = Number(stint?.captainId || 0);
      const viceCaptainId = Number(stint?.viceCaptainId || 0);
      if(drValidLeadershipPlayer(captainId, clubId) && drValidLeadershipPlayer(viceCaptainId, clubId) && captainId !== viceCaptainId) return { captainId, viceCaptainId };
      return drEnsureLeadershipHierarchy(stint);
    },
    setLeadership:(captainId, viceCaptainId, options={}) => drSetLeadership(captainId, viceCaptainId, options)
  };
})();
