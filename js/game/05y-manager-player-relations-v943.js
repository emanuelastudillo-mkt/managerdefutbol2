/* V9.43 · Relaciones persistentes entre el mánager y sus jugadores.
   Selecciona hasta dos vínculos nuevos al cierre de cada temporada,
   conserva la afinidad entre clubes y los convierte en objetivos especiales de mercado. */

(function(){
  const RELATIONS_VERSION = 2;
  const MAX_NEW_RELATIONS_PER_SEASON = 2;
  const MIN_TRUST_STANDARD = 64;
  const MIN_MATCHES_STANDARD = 7;
  const MIN_TRUST_REGULAR = 58;
  const MIN_MATCHES_REGULAR = 14;
  const MIN_TRUST_EXCEPTIONAL = 76;
  const MIN_MATCHES_EXCEPTIONAL = 2;
  const MIN_SELECTION_SCORE = 60;

  function relClamp(value, min=0, max=100){
    const number = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(number) ? number : min));
  }
  function relRound(value, fallback=0){
    const number = Number(value);
    return Number.isFinite(number) ? Math.round(number) : Math.round(Number(fallback || 0));
  }
  function relEscape(value){
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  }
  function relNow(){ return String(game?.currentDate || new Date().toISOString()); }
  function relSeason(){ return Math.max(1, relRound(game?.seasonNumber || 1, 1)); }
  function relYear(){ return relRound(game?.seasonYear || 0); }
  function relManagerClubId(){ return Number(game?.selectedClubId || 0); }
  function relClubName(clubId){
    if(typeof clubName === 'function') return String(clubName(clubId) || '');
    return String(seed?.clubs?.find(club => Number(club.id) === Number(clubId))?.name || '');
  }
  function relPlayer(playerId){
    const id = Number(playerId || 0);
    if(!id) return null;
    if(typeof playerById === 'function'){
      const found = playerById(id);
      if(found) return found;
    }
    return (seed?.players || []).find(player => Number(player?.id || 0) === id)
      || (game?.marketPlayers || []).find(player => Number(player?.id || 0) === id)
      || null;
  }
  function relPlayerStats(playerId){
    const stat = game?.playerStats?.[Number(playerId)] || {};
    return {
      played:Math.max(0, relRound(stat.played || 0)),
      starts:Math.max(0, relRound(stat.starts || 0)),
      goals:Math.max(0, relRound(stat.goals || 0)),
      assists:Math.max(0, relRound(stat.assists || 0))
    };
  }
  function relPlayerOverall(player){
    if(!player) return 0;
    return typeof visibleOverall === 'function' ? relRound(visibleOverall(player) || 0) : relRound(player.overall || 0);
  }
  function relPlayerPosition(player){
    return String(player?.position || '—');
  }

  function normalizeRelationHistoryItem(raw={}){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    return {
      season:Math.max(1, relRound(source.season || 1, 1)),
      year:relRound(source.year || 0),
      clubId:Number(source.clubId || 0),
      clubName:String(source.clubName || ''),
      trust:relClamp(relRound(source.trust || 0), 0, 100),
      affinity:relClamp(relRound(source.affinity || 0), 0, 100),
      matches:Math.max(0, relRound(source.matches || 0)),
      influence:relClamp(relRound(source.influence || 0), 0, 100),
      type:String(source.type || 'season')
    };
  }
  function normalizeRelationEntry(raw={}, playerId=0){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const id = Number(playerId || source.playerId || 0);
    return {
      playerId:id,
      playerName:String(source.playerName || ''),
      position:String(source.position || ''),
      nationality:String(source.nationality || ''),
      addedSeason:Math.max(1, relRound(source.addedSeason || 1, 1)),
      addedYear:relRound(source.addedYear || 0),
      addedClubId:Number(source.addedClubId || 0),
      addedClubName:String(source.addedClubName || ''),
      trustAtSelection:relClamp(relRound(source.trustAtSelection || 0), 0, 100),
      selectionScore:Math.max(0, relRound(source.selectionScore || 0)),
      affinity:relClamp(relRound(source.affinity || source.trustAtSelection || 65), 0, 100),
      sharedSeasons:Math.max(1, relRound(source.sharedSeasons || 1, 1)),
      sharedMatches:Math.max(0, relRound(source.sharedMatches || 0)),
      sharedMatchesKnown:source.sharedMatchesKnown !== false,
      lastSharedSeason:Math.max(1, relRound(source.lastSharedSeason || source.addedSeason || 1, 1)),
      lastSharedClubId:Number(source.lastSharedClubId || source.addedClubId || 0),
      currentClubId:Number(source.currentClubId || 0),
      reunions:Math.max(0, relRound(source.reunions || 0)),
      wasSeparated:Boolean(source.wasSeparated),
      lastAppliedStintKey:String(source.lastAppliedStintKey || ''),
      history:(Array.isArray(source.history) ? source.history : []).map(normalizeRelationHistoryItem).slice(-20),
      createdAt:String(source.createdAt || ''),
      updatedAt:String(source.updatedAt || '')
    };
  }
  function normalizeRelationsState(raw={}){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const entries = {};
    Object.entries(source.entries || {}).forEach(([key, value]) => {
      const id = Number(key || value?.playerId || 0);
      if(id) entries[id] = normalizeRelationEntry(value, id);
    });
    const processedSeasons = {};
    Object.entries(source.processedSeasons || {}).forEach(([key, value]) => { if(key) processedSeasons[key] = Boolean(value); });
    return {
      version:RELATIONS_VERSION,
      entries,
      processedSeasons,
      longTermRecovery:source.longTermRecovery && typeof source.longTermRecovery === 'object' && !Array.isArray(source.longTermRecovery) ? { ...source.longTermRecovery } : {},
      lastTargetMessageKey:String(source.lastTargetMessageKey || ''),
      log:Array.isArray(source.log) ? source.log.slice(-80) : []
    };
  }
  function ensureRelationsState(targetGame=game){
    if(!targetGame) return normalizeRelationsState({});
    const current = targetGame.managerPlayerRelations;
    if(current && Number(current.version || 0) === RELATIONS_VERSION && current.entries && typeof current.entries === 'object' && !Array.isArray(current.entries) && current.processedSeasons && typeof current.processedSeasons === 'object' && !Array.isArray(current.processedSeasons)) return current;
    targetGame.managerPlayerRelations = normalizeRelationsState(current || {});
    return targetGame.managerPlayerRelations;
  }
  function relationEntry(playerId, targetGame=game){
    return ensureRelationsState(targetGame).entries?.[Number(playerId)] || null;
  }
  function relationEntries(targetGame=game){
    return Object.values(ensureRelationsState(targetGame).entries || {}).filter(entry => Number(entry.playerId || 0) > 0);
  }

  function relationPlayerStatus(entry){
    const player = relPlayer(entry?.playerId);
    if(!player) return { key:'missing', label:'Sin datos actuales', tone:'muted', clubId:Number(entry?.currentClubId || 0), player:null };
    const clubId = Number(player.clubId || 0);
    if(player.retired) return { key:'retired', label:'Retirado', tone:'muted', clubId, player };
    if(player.sold) return { key:'unavailable', label:'Fuera del mercado', tone:'muted', clubId, player };
    if(clubId === relManagerClubId() && clubId > 0) return { key:'together', label:'En tu plantel', tone:'ok', clubId, player };
    if(clubId <= 0 || player.freeAgent) return { key:'free', label:'Jugador libre', tone:'warn', clubId:0, player };
    return { key:'contracted', label:relClubName(clubId) || 'Otro club', tone:'info', clubId, player };
  }
  function relationIsMarketTarget(playerOrId){
    const playerId = typeof playerOrId === 'object' ? Number(playerOrId?.id || 0) : Number(playerOrId || 0);
    const entry = relationEntry(playerId);
    if(!entry) return false;
    const status = relationPlayerStatus(entry);
    return status.key === 'free' || status.key === 'contracted';
  }
  function relationInterestBonus(playerOrId){
    const playerId = typeof playerOrId === 'object' ? Number(playerOrId?.id || 0) : Number(playerOrId || 0);
    const entry = relationEntry(playerId);
    if(!entry || !relationIsMarketTarget(playerId)) return 0;
    return relClamp(relRound(8 + Math.max(0, Number(entry.affinity || 0) - 60) * 0.40), 8, 24);
  }
  function relationAffinityLabel(value){
    const affinity = relClamp(relRound(value || 0), 0, 100);
    if(affinity >= 90) return 'Vínculo excepcional';
    if(affinity >= 82) return 'Muy afín';
    if(affinity >= 74) return 'Relación fuerte';
    if(affinity >= 66) return 'Buena relación';
    return 'Relación positiva';
  }

  function refreshRelationLocations(options={}){
    const state = ensureRelationsState();
    const managerClubId = relManagerClubId();
    const reunited = [];
    let changed = false;
    relationEntries().forEach(entry => {
      const player = relPlayer(entry.playerId);
      if(!player) return;
      const currentClubId = Number(player.clubId || 0);
      if(Number(entry.currentClubId || 0) !== currentClubId){ entry.currentClubId = currentClubId; changed = true; }
      const together = Boolean(managerClubId && currentClubId === managerClubId && !player.retired && !player.sold);
      const separatedBefore = Boolean(entry.wasSeparated);
      if(together && separatedBefore){
        entry.reunions = Math.max(0, relRound(entry.reunions || 0)) + 1;
        entry.affinity = relClamp(relRound(entry.affinity || 0) + 3, 0, 100);
        entry.updatedAt = relNow();
        reunited.push(entry);
        changed = true;
      }
      const nextSeparated = !together;
      if(entry.wasSeparated !== nextSeparated){ entry.wasSeparated = nextSeparated; changed = true; }
    });
    if(reunited.length && options.announce !== false && typeof pushGameMessage === 'function'){
      const names = reunited.map(entry => entry.playerName || relPlayer(entry.playerId)?.name || 'Jugador').slice(0, 3);
      pushGameMessage({
        type:'mercado',
        priority:'high',
        title:'Reencuentro profesional',
        body:`${names.join(', ')} ${names.length === 1 ? 'volvió' : 'volvieron'} a trabajar con vos. La relación previa se conserva y mejora su confianza inicial en el nuevo ciclo.`,
        id:`manager-relations-reunion-${relSeason()}-${relManagerClubId()}-${names.join('-')}`
      });
    }
    if(changed && options.save === true && typeof saveLocal === 'function') saveLocal(true);
    return { changed, reunited };
  }

  function applyPersistentTrust(options={}){
    if(!game || game?.gameOver?.active || !relManagerClubId() || !window.managerDressingRoom?.current) return { changed:false, applied:[] };
    const state = ensureRelationsState();
    const locationResult = refreshRelationLocations({ announce:options.announce !== false, save:false });
    const stint = window.managerDressingRoom.current();
    if(!stint?.playerTrust) return { changed:locationResult.changed, applied:[] };
    const stintKey = String(stint.key || `${relSeason()}:${relManagerClubId()}:${stint.stintId || ''}`);
    const applied = [];
    relationEntries().forEach(entry => {
      const status = relationPlayerStatus(entry);
      if(status.key !== 'together') return;
      const trustEntry = stint.playerTrust?.[Number(entry.playerId)];
      if(!trustEntry || String(entry.lastAppliedStintKey || '') === stintKey) return;
      const floor = relClamp(relRound(45 + Number(entry.affinity || 0) * 0.42), 60, 88);
      if(Number(trustEntry.value || 0) < floor){
        trustEntry.lastChange = relRound(floor - Number(trustEntry.value || 0));
        trustEntry.value = floor;
        trustEntry.lastReason = entry.reunions > 0 ? 'Reencuentro con un mánager afín' : 'Relación profesional persistente';
        trustEntry.updatedAt = relNow();
      }
      entry.lastAppliedStintKey = stintKey;
      entry.updatedAt = relNow();
      applied.push({ playerId:entry.playerId, trust:floor });
    });
    const changed = locationResult.changed || applied.length > 0;
    if(changed && options.save !== false && typeof saveLocal === 'function') saveLocal(true);
    return { changed, applied };
  }

  function relationContinuity(playerId, clubId=relManagerClubId(), season=relSeason()){
    const stints = Object.values(game?.managerDressingRoom?.stints || {})
      .filter(stint => Number(stint?.clubId || 0) === Number(clubId) && Number(stint?.season || 0) <= Number(season) && stint?.playerTrust?.[Number(playerId)])
      .sort((a,b) => Number(a?.season || 0) - Number(b?.season || 0));
    const bySeason = new Map();
    stints.forEach(stint => bySeason.set(Number(stint.season || 0), stint.playerTrust[Number(playerId)]));
    const items = [...bySeason.entries()].map(([stintSeason, entry]) => ({ season:stintSeason, entry }));
    const previous = items.filter(item => Number(item.season) < Number(season));
    const values = previous.map(item => relClamp(relRound(item.entry?.value || 0), 0, 100));
    const influences = previous.map(item => relClamp(relRound(item.entry?.influence || 0), 0, 100));
    const tags = previous.flatMap(item => Array.isArray(item.entry?.tags) ? item.entry.tags.map(String) : []);
    return {
      sharedSeasons:items.length,
      previousSeasons:previous.length,
      averageTrust:values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0,
      maximumTrust:values.length ? Math.max(...values) : 0,
      latestTrust:values.length ? values[values.length - 1] : 0,
      averageInfluence:influences.length ? influences.reduce((sum, value) => sum + value, 0) / influences.length : 0,
      tags
    };
  }

  function relationSelectionCandidate(trustEntry, options={}){
    const player = relPlayer(trustEntry?.playerId);
    if(!player || player.retired || player.sold || Number(player.clubId || 0) !== relManagerClubId()) return null;
    if(relationEntry(player.id)) return null;
    const stats = relPlayerStats(player.id);
    const trust = relClamp(relRound(trustEntry?.value || 0), 0, 100);
    const influence = relClamp(relRound(trustEntry?.influence || 0), 0, 100);
    const tags = Array.isArray(trustEntry?.tags) ? trustEntry.tags.map(String) : [];
    const continuity = relationContinuity(player.id);
    const continuityTrustBonus = Math.min(8, continuity.previousSeasons * 2);
    const effectiveTrust = relClamp(trust + continuityTrustBonus, 0, 100);
    const qualifies = (effectiveTrust >= MIN_TRUST_STANDARD && stats.played >= MIN_MATCHES_STANDARD)
      || (effectiveTrust >= MIN_TRUST_REGULAR && stats.played >= MIN_MATCHES_REGULAR)
      || (trust >= MIN_TRUST_EXCEPTIONAL && stats.played >= MIN_MATCHES_EXCEPTIONAL)
      || (continuity.sharedSeasons >= 3 && trust >= 56 && stats.played >= 6);
    const roleBonus = tags.includes('captain') ? 5 : tags.includes('viceCaptain') ? 3 : tags.includes('referent') ? 2 : 0;
    const participationScore = Math.min(20, stats.played * 1.25);
    const continuityScore = Math.min(18, continuity.previousSeasons * 6);
    const selectionScore = trust * 0.58 + influence * 0.10 + participationScore + continuityScore + roleBonus;
    if(!options.includeDeveloping && (!qualifies || selectionScore < MIN_SELECTION_SCORE)) return null;
    const affinity = relClamp(relRound(trust * 0.70 + Math.min(14, stats.played * 0.80) + influence * 0.08 + Math.min(10, continuity.previousSeasons * 3) + roleBonus), 62, 96);
    return { player, stats, trust, influence, tags, roleBonus, continuity, effectiveTrust, qualifies, selectionScore:relRound(selectionScore), affinity };
  }

  function recoverLongTermRelationships(){
    if(!game || game?.gameOver?.active || !relManagerClubId()) return [];
    const state = ensureRelationsState();
    const clubId = relManagerClubId();
    const recoveryKey = `v962:${clubId}`;
    if(state.longTermRecovery?.[recoveryKey]) return [];
    const currentStint = window.managerDressingRoom?.current ? window.managerDressingRoom.current() : null;
    if(!currentStint?.playerTrust) return [];
    const availableSlots = Math.max(0, MAX_NEW_RELATIONS_PER_SEASON - relationEntries().filter(entry => Number(entry.addedSeason || 0) === relSeason()).length);
    state.longTermRecovery[recoveryKey] = true;
    if(!availableSlots) return [];
    const candidates = Object.values(currentStint.playerTrust || {}).map(trustEntry => {
      const player = relPlayer(trustEntry?.playerId);
      if(!player || player.retired || player.sold || relationEntry(player.id) || Number(player.clubId || 0) !== clubId) return null;
      const continuity = relationContinuity(player.id, clubId, relSeason());
      if(continuity.previousSeasons < 3 || continuity.averageTrust < 60 || continuity.maximumTrust < 65 || continuity.latestTrust < 56) return null;
      const currentTrust = relClamp(relRound(trustEntry?.value || continuity.latestTrust), 0, 100);
      const currentInfluence = relClamp(relRound(trustEntry?.influence || continuity.averageInfluence), 0, 100);
      const tags = [...new Set([...(continuity.tags || []), ...(Array.isArray(trustEntry?.tags) ? trustEntry.tags.map(String) : [])])];
      const roleBonus = tags.includes('captain') ? 5 : tags.includes('viceCaptain') ? 3 : tags.includes('referent') ? 2 : 0;
      const score = continuity.averageTrust * 0.62 + continuity.averageInfluence * 0.12 + Math.min(20, continuity.previousSeasons * 5) + roleBonus;
      if(score < 62) return null;
      return { player, continuity, currentTrust, currentInfluence, roleBonus, score, affinity:relClamp(relRound(continuity.averageTrust * 0.72 + continuity.maximumTrust * 0.12 + Math.min(10, continuity.previousSeasons * 3) + roleBonus), 65, 94) };
    }).filter(Boolean).sort((a,b) => b.score - a.score || b.continuity.averageTrust - a.continuity.averageTrust || Number(a.player.id) - Number(b.player.id)).slice(0, availableSlots);
    const recovered = candidates.map(candidate => {
      const player = candidate.player;
      const entry = normalizeRelationEntry({
        playerId:Number(player.id), playerName:String(player.name || 'Jugador'), position:relPlayerPosition(player), nationality:String(player.nationality || ''),
        addedSeason:relSeason(), addedYear:relYear(), addedClubId:clubId, addedClubName:relClubName(clubId),
        trustAtSelection:candidate.currentTrust, selectionScore:relRound(candidate.score), affinity:candidate.affinity,
        sharedSeasons:candidate.continuity.previousSeasons, sharedMatches:0, sharedMatchesKnown:false,
        lastSharedSeason:Math.max(1, relSeason() - 1), lastSharedClubId:clubId, currentClubId:Number(player.clubId || 0), reunions:0, wasSeparated:false,
        history:[{ season:Math.max(1, relSeason() - 1), year:Math.max(0, relYear() - 1), clubId, clubName:relClubName(clubId), trust:relRound(candidate.continuity.latestTrust), affinity:candidate.affinity, matches:0, influence:relRound(candidate.continuity.averageInfluence), type:'continuity_recovery' }],
        createdAt:relNow(), updatedAt:relNow()
      }, player.id);
      state.entries[player.id] = entry;
      return entry;
    });
    if(recovered.length && typeof pushGameMessage === 'function'){
      pushGameMessage({ type:'vestuario', priority:'high', title:'Relaciones reconocidas por continuidad', body:`La trayectoria compartida permitió reconocer vínculos duraderos con ${recovered.map(entry => entry.playerName).join(' y ')}. La relación se conserva desde ahora en tu perfil.`, id:`manager-relations-continuity-${recoveryKey}` });
    }
    if(typeof saveLocal === 'function') saveLocal(true);
    return recovered;
  }

  function developingRelations(){
    const stint = window.managerDressingRoom?.current ? window.managerDressingRoom.current() : null;
    if(!stint?.playerTrust) return [];
    return Object.values(stint.playerTrust).map(entry => relationSelectionCandidate(entry, { includeDeveloping:true })).filter(Boolean)
      .sort((a,b) => b.selectionScore - a.selectionScore || b.trust - a.trust || b.stats.played - a.stats.played)
      .slice(0, 4);
  }

  function updateExistingSeasonRelationships(stint, season, clubId){
    const updated = [];
    relationEntries().forEach(entry => {
      const trustEntry = stint?.playerTrust?.[Number(entry.playerId)];
      const player = relPlayer(entry.playerId);
      if(!trustEntry || !player || Number(player.clubId || 0) !== Number(clubId)) return;
      if(Number(entry.lastSharedSeason || 0) === Number(season)) return;
      const stats = relPlayerStats(entry.playerId);
      const trust = relClamp(relRound(trustEntry.value || 0), 0, 100);
      const influence = relClamp(relRound(trustEntry.influence || 0), 0, 100);
      entry.affinity = relClamp(relRound(Number(entry.affinity || 65) * 0.68 + trust * 0.32 + Math.min(3, stats.played / 12)), 0, 100);
      entry.sharedSeasons = Math.max(1, relRound(entry.sharedSeasons || 1)) + 1;
      entry.sharedMatches = Math.max(0, relRound(entry.sharedMatches || 0)) + stats.played;
      entry.lastSharedSeason = season;
      entry.lastSharedClubId = clubId;
      entry.currentClubId = Number(player.clubId || 0);
      entry.wasSeparated = false;
      entry.history = (Array.isArray(entry.history) ? entry.history : []).concat([normalizeRelationHistoryItem({
        season,
        year:relYear(),
        clubId,
        clubName:relClubName(clubId),
        trust,
        affinity:entry.affinity,
        matches:stats.played,
        influence,
        type:'reinforced'
      })]).slice(-20);
      entry.updatedAt = relNow();
      updated.push(entry);
    });
    return updated;
  }

  function addSeasonRelationships(){
    if(!game || game?.gameOver?.active) return { added:[], updated:[], processed:false };
    const state = ensureRelationsState();
    const season = relSeason();
    const clubId = relManagerClubId();
    const processKey = `${season}:${clubId}`;
    if(state.processedSeasons[processKey]) return { added:[], updated:[], processed:false };
    const stint = window.managerDressingRoom?.current ? window.managerDressingRoom.current() : null;
    if(!stint || Number(stint.clubId || 0) !== clubId){
      state.processedSeasons[processKey] = true;
      return { added:[], updated:[], processed:true };
    }

    const updated = updateExistingSeasonRelationships(stint, season, clubId);
    const alreadyAddedThisSeason = relationEntries().filter(entry => Number(entry.addedSeason || 0) === season).length;
    const remainingSlots = Math.max(0, MAX_NEW_RELATIONS_PER_SEASON - alreadyAddedThisSeason);
    const candidates = Object.values(stint.playerTrust || {})
      .map(relationSelectionCandidate)
      .filter(Boolean)
      .sort((a,b) => b.selectionScore - a.selectionScore || b.trust - a.trust || b.stats.played - a.stats.played || Number(a.player.id) - Number(b.player.id))
      .slice(0, remainingSlots);

    const added = candidates.map(candidate => {
      const player = candidate.player;
      const entry = normalizeRelationEntry({
        playerId:Number(player.id),
        playerName:String(player.name || 'Jugador'),
        position:relPlayerPosition(player),
        nationality:String(player.nationality || ''),
        addedSeason:season,
        addedYear:relYear(),
        addedClubId:clubId,
        addedClubName:relClubName(clubId),
        trustAtSelection:candidate.trust,
        selectionScore:candidate.selectionScore,
        affinity:candidate.affinity,
        sharedSeasons:1,
        sharedMatches:candidate.stats.played,
        sharedMatchesKnown:true,
        lastSharedSeason:season,
        lastSharedClubId:clubId,
        currentClubId:Number(player.clubId || 0),
        reunions:0,
        wasSeparated:false,
        history:[{
          season,
          year:relYear(),
          clubId,
          clubName:relClubName(clubId),
          trust:candidate.trust,
          affinity:candidate.affinity,
          matches:candidate.stats.played,
          influence:candidate.influence,
          type:'selected'
        }],
        createdAt:relNow(),
        updatedAt:relNow()
      }, player.id);
      state.entries[player.id] = entry;
      return entry;
    });

    state.processedSeasons[processKey] = true;
    state.log.push({
      type:'season_selection',
      season,
      clubId,
      added:added.map(entry => entry.playerId),
      updated:updated.map(entry => entry.playerId),
      date:relNow()
    });
    state.log = state.log.slice(-80);

    const seasonHistory = Array.isArray(game?.managerStats?.seasonHistory) ? game.managerStats.seasonHistory : [];
    const historyEntry = seasonHistory.filter(item => Number(item?.season || 0) === season && Number(item?.clubId || 0) === clubId).slice(-1)[0];
    if(historyEntry) historyEntry.playerRelationsAdded = added.map(entry => entry.playerId);
    const simpleSeason = (game?.managerStats?.seasons || []).find(item => Number(item?.season || 0) === season && Number(item?.clubId || 0) === clubId);
    if(simpleSeason) simpleSeason.playerRelationsAdded = added.map(entry => entry.playerId);

    if(added.length && typeof pushGameMessage === 'function'){
      const descriptions = added.map(entry => `${entry.playerName} (${relationAffinityLabel(entry.affinity)})`);
      pushGameMessage({
        type:'vestuario',
        priority:'high',
        title:'Nuevas relaciones profesionales',
        body:`La temporada dejó vínculos duraderos con ${descriptions.join(' y ')}. Estas relaciones permanecerán aunque cambies de club y podrán convertirse en objetivos especiales de mercado.`,
        id:`manager-relations-season-${processKey}`
      });
    }
    if(typeof saveLocal === 'function') saveLocal(true);
    return { added, updated, processed:true };
  }

  function announceMarketTargets(){
    if(!game || game?.gameOver?.active) return false;
    const state = ensureRelationsState();
    refreshRelationLocations({ announce:true, save:false });
    const key = `${relSeason()}:${relManagerClubId()}`;
    if(state.lastTargetMessageKey === key) return false;
    const targets = relationEntries().filter(entry => relationIsMarketTarget(entry.playerId)).sort((a,b) => Number(b.affinity || 0) - Number(a.affinity || 0));
    state.lastTargetMessageKey = key;
    if(!targets.length){ if(typeof saveLocal === 'function') saveLocal(true); return false; }
    const names = targets.slice(0, 4).map(entry => entry.playerName || relPlayer(entry.playerId)?.name || 'Jugador');
    if(typeof pushGameMessage === 'function'){
      pushGameMessage({
        type:'mercado',
        priority:'normal',
        title:'Jugadores afines disponibles',
        body:`${names.join(', ')} ${names.length === 1 ? 'mantiene' : 'mantienen'} una relación profesional con vos. Aparecen en Mercado → Relaciones y tienen mayor predisposición a volver a trabajar bajo tu dirección.`,
        id:`manager-relations-targets-${key}`
      });
    }
    if(typeof saveLocal === 'function') saveLocal(true);
    return true;
  }

  function relationStatusMarkup(entry){
    const status = relationPlayerStatus(entry);
    if(status.key === 'contracted') return `${typeof clubBadge === 'function' ? clubBadge(status.clubId) : ''} ${relEscape(status.label)}`;
    return `<span class="pill ${status.tone}">${relEscape(status.label)}</span>`;
  }
  function relationOriginMarkup(entry){
    const badge = typeof clubBadge === 'function' ? clubBadge(entry.addedClubId) : '';
    return `${badge} ${relEscape(entry.addedClubName || relClubName(entry.addedClubId) || 'Club')}<small>Temporada ${entry.addedSeason}${entry.addedYear ? ` · ${entry.addedYear}` : ''}</small>`;
  }
  function relationPlayerMarkup(entry){
    const player = relPlayer(entry.playerId);
    const photo = player && typeof faceImg === 'function' ? faceImg(player, 'photo-thumb') : '<span class="relation-player-placeholder">●</span>';
    const currentName = player?.name || entry.playerName || 'Jugador';
    const position = player ? relPlayerPosition(player) : entry.position || '—';
    const overall = player ? relPlayerOverall(player) : 0;
    return `<div class="manager-relation-player">${photo}<div><button class="linklike" data-relation-player-id="${entry.playerId}"><strong>${relEscape(currentName)}</strong></button><span>${relEscape(position)}${overall ? ` · Media ${overall}` : ''}</span></div></div>`;
  }
  function relationMarketActionMarkup(entry){
    const status = relationPlayerStatus(entry);
    if(status.key === 'together') return '<span class="pill ok">Trabajando juntos</span>';
    if(status.key === 'free') return `<button class="primary small-btn" data-relation-hire="${entry.playerId}">Ofertar como libre</button>`;
    if(status.key === 'contracted') return `<button class="primary small-btn" data-relation-offer="${entry.playerId}">Hacer oferta</button>`;
    return '<span class="muted small">No disponible</span>';
  }
  function bindRelationCommonActions(){
    document.querySelectorAll('[data-relation-player-id]').forEach(button => button.addEventListener('click', () => {
      if(typeof showPlayerModal === 'function') showPlayerModal(Number(button.dataset.relationPlayerId));
    }));
    document.querySelectorAll('[data-relation-open-market]').forEach(button => button.addEventListener('click', () => {
      activeTab = 'market';
      marketSubTab = 'relations';
      if(typeof renderAll === 'function') renderAll();
    }));
    document.querySelectorAll('[data-relation-hire]').forEach(button => button.addEventListener('click', () => {
      if(typeof hireFreeAgent === 'function') hireFreeAgent(Number(button.dataset.relationHire));
    }));
    document.querySelectorAll('[data-relation-offer]').forEach(button => button.addEventListener('click', () => {
      if(typeof openPurchaseOfferModal === 'function') openPurchaseOfferModal(Number(button.dataset.relationOffer));
    }));
  }

  function renderManagerRelations(){
    ensureRelationsState();
    recoverLongTermRelationships();
    refreshRelationLocations({ announce:false, save:false });
    const entries = relationEntries().sort((a,b) => {
      const statusOrder = { together:0, free:1, contracted:2, retired:3, unavailable:4, missing:5 };
      const statusA = relationPlayerStatus(a).key;
      const statusB = relationPlayerStatus(b).key;
      return Number(statusOrder[statusA] ?? 9) - Number(statusOrder[statusB] ?? 9) || Number(b.affinity || 0) - Number(a.affinity || 0) || String(a.playerName || '').localeCompare(String(b.playerName || ''), 'es');
    });
    const together = entries.filter(entry => relationPlayerStatus(entry).key === 'together').length;
    const targets = entries.filter(entry => relationIsMarketTarget(entry.playerId)).length;
    const retired = entries.filter(entry => ['retired','unavailable','missing'].includes(relationPlayerStatus(entry).key)).length;
    const rows = entries.map(entry => `<tr>
      <td>${relationPlayerMarkup(entry)}</td>
      <td><strong>${entry.affinity}/100</strong><small>${relEscape(relationAffinityLabel(entry.affinity))}</small></td>
      <td>${relationOriginMarkup(entry)}</td>
      <td>${relationStatusMarkup(entry)}</td>
      <td><strong>${entry.sharedSeasons}</strong><small>${entry.sharedMatchesKnown === false ? 'PJ históricos sin registro exacto' : `${entry.sharedMatches} PJ compartidos`}</small></td>
      <td><strong>+${relationInterestBonus(entry.playerId)} p.p.</strong><small>${relationIsMarketTarget(entry.playerId) ? 'Predisposición a reunirse' : 'Sin oferta pendiente'}</small></td>
      <td>${relationMarketActionMarkup(entry)}</td>
    </tr>`).join('');
    const developing = developingRelations();
    const developingRows = developing.map(candidate => {
      const readiness = candidate.qualifies && candidate.selectionScore >= MIN_SELECTION_SCORE ? 'Listo para evaluación' : candidate.selectionScore >= 56 ? 'Muy cerca' : candidate.selectionScore >= 48 ? 'En crecimiento' : 'Vínculo inicial';
      return `<tr><td>${relationPlayerMarkup({ playerId:candidate.player.id, playerName:candidate.player.name, position:candidate.player.position })}</td><td><strong>${candidate.trust}/100</strong><small>Confianza actual</small></td><td><strong>${candidate.stats.played}</strong><small>Partidos esta temporada</small></td><td><strong>${candidate.continuity.sharedSeasons}</strong><small>Temporadas juntos</small></td><td><span class="pill ${candidate.qualifies ? 'ok' : 'info'}">${readiness}</span></td></tr>`;
    }).join('');
    view.innerHTML = `<div class="row section-title"><div><h2>Relaciones</h2><p class="tagline">Jugadores que construyeron una relación profesional persistente con el mánager.</p></div><span class="pill">${entries.length} vínculo(s)</span></div>
      <div class="grid cols-4 manager-relations-summary">
        <div class="card"><p class="label">Relaciones totales</p><strong>${entries.length}</strong></div>
        <div class="card"><p class="label">En tu plantel</p><strong>${together}</strong></div>
        <div class="card"><p class="label">Objetivos de mercado</p><strong>${targets}</strong></div>
        <div class="card"><p class="label">Históricas o inactivas</p><strong>${retired}</strong></div>
      </div>
      <div class="card manager-relations-explanation"><h3>Cómo se forman</h3><p>Al cerrar una temporada pueden incorporarse hasta dos jugadores nuevos. La selección considera confianza, participación, influencia y continuidad: trabajar varias temporadas con el mismo jugador facilita de forma progresiva la creación del vínculo. El vínculo permanece al cambiar de club y aumenta la predisposición a volver a trabajar juntos.</p></div>
      <div class="card manager-relations-table-card"><div class="row"><div><h3>Vínculos en formación</h3><p class="muted small">Seguimiento orientativo de los jugadores más próximos a consolidar una relación al cierre de temporada.</p></div></div><div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Confianza</th><th>Participación</th><th>Continuidad</th><th>Estado</th></tr></thead><tbody>${developingRows || '<tr><td colspan="5" class="muted">Todavía no hay candidatos con progreso suficiente.</td></tr>'}</tbody></table></div></div>
      <div class="card manager-relations-table-card"><div class="row"><div><h3>Red profesional</h3><p class="muted small">Los jugadores afines activos también aparecen en Mercado → Relaciones.</p></div>${targets ? '<button class="ghost small-btn" data-relation-open-market="1">Ver objetivos de mercado</button>' : ''}</div><div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Afinidad</th><th>Origen</th><th>Situación actual</th><th>Trayectoria juntos</th><th>Interés futuro</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted">Todavía no se formaron relaciones persistentes. La primera evaluación se realizará al finalizar una temporada.</td></tr>'}</tbody></table></div></div>`;
    bindRelationCommonActions();
  }

  function renderRelationsMarket(){
    if(typeof mergeMarketPlayersIntoSeed === 'function') mergeMarketPlayersIntoSeed(game?.marketPlayers || []);
    ensureRelationsState();
    refreshRelationLocations({ announce:false, save:false });
    const entries = relationEntries().sort((a,b) => {
      const order = { free:0, contracted:1, together:2, retired:3, unavailable:4, missing:5 };
      return Number(order[relationPlayerStatus(a).key] ?? 9) - Number(order[relationPlayerStatus(b).key] ?? 9) || Number(b.affinity || 0) - Number(a.affinity || 0);
    });
    const rows = entries.map(entry => {
      const status = relationPlayerStatus(entry);
      const player = status.player;
      const price = player ? Number(player.clause || player.value || 0) : 0;
      const salary = player ? Number(player.salary || 0) : 0;
      return `<tr class="manager-relation-market-row ${relationIsMarketTarget(entry.playerId) ? 'active-target' : ''}">
        <td>${relationPlayerMarkup(entry)}</td>
        <td><strong>${entry.affinity}/100</strong><small>${relEscape(relationAffinityLabel(entry.affinity))}</small></td>
        <td>${relationStatusMarkup(entry)}</td>
        <td>${player && typeof marketScoutedOverallCell === 'function' ? marketScoutedOverallCell(player) : '<span class="muted">—</span>'}</td>
        <td>${price && typeof formatMoney === 'function' ? formatMoney(price) : '—'}</td>
        <td>${salary && typeof formatMoney === 'function' ? formatMoney(salary) : '—'}</td>
        <td><span class="pill ok">+${relationInterestBonus(entry.playerId)} p.p.</span><small>Bonus de interés del jugador</small></td>
        <td>${relationMarketActionMarkup(entry)}</td>
      </tr>`;
    }).join('');
    view.innerHTML = `<div class="section-title"><h2>Mercado</h2><p class="tagline">Jugadores ligados a tu trayectoria y con mayor predisposición a volver a trabajar con vos.</p></div>
      ${typeof marketTabsMarkup === 'function' ? marketTabsMarkup() : ''}
      ${typeof transferMarketStatusMarkup === 'function' ? transferMarketStatusMarkup() : ''}
      ${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}
      <div class="card manager-relations-market-note"><strong>Objetivos especiales</strong><p>La afinidad mejora la probabilidad de aceptación personal. El club propietario conserva el derecho a rechazar ofertas inferiores a la cláusula y el fichaje sigue limitado por presupuesto, cupo y apertura del mercado.</p></div>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Afinidad</th><th>Situación</th><th>Media scouteada</th><th>Valor</th><th>Sueldo</th><th>Interés</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="muted">No hay relaciones persistentes registradas.</td></tr>'}</tbody></table></div>`;
    if(typeof bindMarketTabs === 'function') bindMarketTabs();
    bindRelationCommonActions();
  }

  function relationPlayerProfileCard(player){
    const entry = relationEntry(player?.id);
    if(!entry) return '';
    const status = relationPlayerStatus(entry);
    const marketText = relationIsMarketTarget(entry.playerId)
      ? `Tiene +${relationInterestBonus(entry.playerId)} puntos porcentuales de predisposición a aceptar una oferta de tu club.`
      : status.key === 'together' ? 'La relación previa eleva su confianza inicial cuando trabaja nuevamente con vos.' : 'El vínculo permanece registrado en la carrera.';
    return `<div class="card inner player-manager-relation-card"><div class="row"><div><p class="label">Relación con el mánager</p><h3>${relEscape(relationAffinityLabel(entry.affinity))}</h3></div><span class="pill ok">${entry.affinity}/100</span></div><p class="muted small">Se formó en ${relEscape(entry.addedClubName || relClubName(entry.addedClubId))}, temporada ${entry.addedSeason}. ${entry.sharedSeasons} temporada(s) y ${entry.sharedMatches} partidos compartidos.</p><p class="small">${relEscape(marketText)}</p></div>`;
  }

  function installRelationsHooks(){
    if(typeof normalizeGame === 'function'){
      const originalNormalizeGame = normalizeGame;
      normalizeGame = function(saved){
        const normalized = originalNormalizeGame(saved);
        normalized.managerPlayerRelations = normalizeRelationsState(normalized.managerPlayerRelations || saved?.managerPlayerRelations || {});
        return normalized;
      };
    }
    if(typeof newGame === 'function'){
      const originalNewGame = newGame;
      newGame = function(...args){
        const result = originalNewGame.apply(this, args);
        if(game) game.managerPlayerRelations = normalizeRelationsState({});
        return result;
      };
    }
    if(typeof finalizeSeasonIfNeeded === 'function'){
      const originalFinalizeSeason = finalizeSeasonIfNeeded;
      finalizeSeasonIfNeeded = function(options={}){
        const before = Boolean(game?.seasonFinalized);
        const result = originalFinalizeSeason(options);
        if(!before && game?.seasonFinalized && !options?.managerAbsent && !game?.gameOver?.active) addSeasonRelationships();
        return result;
      };
    }
    if(typeof startNextSeason === 'function'){
      const originalStartNextSeason = startNextSeason;
      startNextSeason = function(...args){
        if(game?.seasonFinalized && !game?.gameOver?.active) addSeasonRelationships();
        const result = originalStartNextSeason.apply(this, args);
        if(game && !game?.seasonFinalized && !game?.gameOver?.active){
          applyPersistentTrust({ announce:true, save:true });
          recoverLongTermRelationships();
          announceMarketTargets();
        }
        return result;
      };
    }
    if(typeof continueCareerAtClub === 'function'){
      const originalContinueCareer = continueCareerAtClub;
      continueCareerAtClub = function(...args){
        const result = originalContinueCareer.apply(this, args);
        if(game && !game?.gameOver?.active){
          applyPersistentTrust({ announce:true, save:true });
          recoverLongTermRelationships();
          announceMarketTargets();
        }
        return result;
      };
    }
    if(typeof processPendingTransfers === 'function'){
      const originalProcessTransfers = processPendingTransfers;
      processPendingTransfers = function(...args){
        const result = originalProcessTransfers.apply(this, args);
        if(result?.changed) applyPersistentTrust({ announce:true, save:true });
        return result;
      };
    }
    if(typeof hireFreeAgent === 'function'){
      const originalHireFreeAgent = hireFreeAgent;
      hireFreeAgent = function(playerId){
        const result = originalHireFreeAgent(playerId);
        const player = relPlayer(playerId);
        if(player && Number(player.clubId || 0) === relManagerClubId()) applyPersistentTrust({ announce:true, save:true });
        return result;
      };
    }
    if(typeof marketDiscoveryPool === 'function'){
      const originalDiscoveryPool = marketDiscoveryPool;
      marketDiscoveryPool = function(players, context='free'){
        const source = Array.isArray(players) ? players : [];
        const base = originalDiscoveryPool(source, context) || [];
        const availableIds = new Set(source.map(player => Number(player?.id || 0)).filter(Boolean));
        const related = relationEntries()
          .filter(entry => availableIds.has(Number(entry.playerId)) && relationIsMarketTarget(entry.playerId))
          .sort((a,b) => Number(b.affinity || 0) - Number(a.affinity || 0))
          .map(entry => source.find(player => Number(player?.id || 0) === Number(entry.playerId)))
          .filter(Boolean);
        const relatedIds = new Set(related.map(player => Number(player.id)));
        return related.concat(base.filter(player => !relatedIds.has(Number(player?.id || 0))));
      };
    }
    if(typeof marketPlayerAcceptanceChance === 'function'){
      const originalAcceptanceChance = marketPlayerAcceptanceChance;
      marketPlayerAcceptanceChance = function(player=null){
        const base = Number(originalAcceptanceChance(player) || 0);
        const bonus = relationInterestBonus(player);
        return relClamp(Math.round((base + bonus) * 10) / 10, 0.5, 99.5);
      };
    }
    if(typeof marketAcceptanceLabel === 'function'){
      const originalAcceptanceLabel = marketAcceptanceLabel;
      marketAcceptanceLabel = function(player){
        const entry = relationEntry(player?.id);
        if(entry && relationIsMarketTarget(player)) return `Jugador afín · +${relationInterestBonus(player)} p.p. de interés`;
        return originalAcceptanceLabel(player);
      };
    }
    if(typeof marketAcceptanceToneClass === 'function'){
      const originalAcceptanceTone = marketAcceptanceToneClass;
      marketAcceptanceToneClass = function(player){ return relationIsMarketTarget(player) ? 'ok' : originalAcceptanceTone(player); };
    }
    if(typeof marketPlayerRejectionBody === 'function'){
      const originalRejectionBody = marketPlayerRejectionBody;
      marketPlayerRejectionBody = function(player=null){
        const entry = relationEntry(player?.id);
        if(entry){
          return `${player?.name || entry.playerName || 'El jugador'} conserva una buena relación profesional con vos, pero considera que este club o este momento no son adecuados. La afinidad permanece registrada y podrás volver a intentarlo la próxima temporada.`;
        }
        return originalRejectionBody(player);
      };
    }
    if(typeof playerNameWithScoutingEye === 'function'){
      const originalPlayerName = playerNameWithScoutingEye;
      playerNameWithScoutingEye = function(player){
        const base = originalPlayerName(player);
        return relationEntry(player?.id) ? `${base}<span class="manager-relation-inline-badge" title="Relación persistente con el mánager">Afín</span>` : base;
      };
    }
    if(typeof marketTabsMarkup === 'function'){
      const originalMarketTabs = marketTabsMarkup;
      marketTabsMarkup = function(){
        const html = originalMarketTabs();
        const button = `<button class="${marketSubTab === 'relations' ? 'active' : ''}" data-market-tab="relations">Relaciones</button>`;
        return html.replace('<button class="' + (marketSubTab === 'history' ? 'active' : '') + '" data-market-tab="history">Registro anual</button>', `${button}<button class="${marketSubTab === 'history' ? 'active' : ''}" data-market-tab="history">Registro anual</button>`);
      };
    }
    if(typeof renderMarket === 'function'){
      const originalRenderMarket = renderMarket;
      renderMarket = function(){
        if(String(marketSubTab || '') === 'relations') return renderRelationsMarket();
        return originalRenderMarket();
      };
    }
    if(typeof renderManagerStats === 'function'){
      const originalRenderManagerStats = renderManagerStats;
      renderManagerStats = function(){
        if(String(managerStatsViewMode || 'profile') === 'relations') return renderManagerRelations();
        return originalRenderManagerStats();
      };
    }
    if(typeof openPurchaseOfferModal === 'function'){
      const originalOpenOffer = openPurchaseOfferModal;
      openPurchaseOfferModal = function(playerId){
        const result = originalOpenOffer(playerId);
        const entry = relationEntry(playerId);
        const modal = document.querySelector('.purchase-offer-modal');
        if(entry && modal && !modal.querySelector('.manager-relation-offer-note')){
          modal.querySelector('h2')?.insertAdjacentHTML('afterend', `<div class="manager-relation-offer-note"><strong>Jugador afín al mánager</strong><span>Afinidad ${entry.affinity}/100 · +${relationInterestBonus(playerId)} p.p. en la aceptación personal.</span></div>`);
        }
        return result;
      };
    }
    if(typeof showPlayerModal === 'function'){
      const originalShowPlayerModal = showPlayerModal;
      showPlayerModal = function(playerId){
        const result = originalShowPlayerModal(playerId);
        const player = relPlayer(playerId);
        const card = relationPlayerProfileCard(player);
        const stack = document.querySelector('.player-modal-grid .stack');
        if(card && stack && !stack.querySelector('.player-manager-relation-card')) stack.insertAdjacentHTML('beforeend', card);
        return result;
      };
    }
    if(typeof renderHome === 'function'){
      const originalRenderHome = renderHome;
      renderHome = function(){
        applyPersistentTrust({ announce:false, save:false });
        recoverLongTermRelationships();
        return originalRenderHome();
      };
    }
  }

  installRelationsHooks();
  window.managerPlayerRelations = {
    version:RELATIONS_VERSION,
    ensure:ensureRelationsState,
    entries:relationEntries,
    get:relationEntry,
    isTarget:relationIsMarketTarget,
    interestBonus:relationInterestBonus,
    processSeason:addSeasonRelationships,
    recoverLongTerm:recoverLongTermRelationships,
    developing:developingRelations,
    applyTrust:applyPersistentTrust,
    render:renderManagerRelations,
    renderMarket:renderRelationsMarket
  };
})();
