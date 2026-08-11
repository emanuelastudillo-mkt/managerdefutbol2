/* V8.08 · Estado central, normalización, nueva partida, estadísticas y competiciones nacionales. */

function normalizeStandingsHistoryState(src){
  const obj = (src && typeof src === 'object' && !Array.isArray(src)) ? src : {};
  const seasons = Array.isArray(obj.seasons) ? obj.seasons : [];
  const clean = seasons.map(item => {
    const divisions = {};
    Object.entries(item?.divisions || {}).forEach(([divisionId, rows]) => {
      if(!Array.isArray(rows)) return;
      divisions[divisionId] = rows.map(row => ({
        clubId:Number(row.clubId || 0),
        pj:Number(row.pj || 0), pg:Number(row.pg || 0), pe:Number(row.pe || 0), pp:Number(row.pp || 0),
        gf:Number(row.gf || 0), gc:Number(row.gc || 0), dg:Number(row.dg || 0), pts:Number(row.pts || 0),
        position:Number(row.position || 0)
      })).filter(row => row.clubId);
    });
    return { season:Number(item?.season || 0), year:Number(item?.year || 0), createdAt:String(item?.createdAt || ''), divisions };
  }).filter(item => item.season && item.year && item.divisions && Object.keys(item.divisions).length);
  return { seasons:clean };
}

function normalizeCompetitionChampionsHistoryState(src){
  const obj = (src && typeof src === 'object' && !Array.isArray(src)) ? src : {};
  const entries = Array.isArray(obj.entries) ? obj.entries : (Array.isArray(obj.champions) ? obj.champions : []);
  const clean = [];
  const seen = new Set();
  entries.forEach(item => {
    const season = Math.max(1, Math.round(Number(item?.season || 0)) || 0);
    const year = Math.round(Number(item?.year || 0)) || (season ? seasonYearForNumber(season) : 0);
    const competitionId = String(item?.competitionId || item?.divisionId || item?.id || '').trim();
    const championId = Number(item?.championId || item?.clubId || 0);
    if(!season || !year || !competitionId || !championId) return;
    const key = `${season}-${competitionId}`;
    if(seen.has(key)) return;
    seen.add(key);
    clean.push({
      season,
      year,
      type:String(item?.type || 'league'),
      competitionId,
      competitionName:String(item?.competitionName || item?.divisionName || item?.name || competitionId),
      championId,
      championName:String(item?.championName || item?.clubName || clubName(championId)),
      runnerUpId:Number(item?.runnerUpId || 0),
      runnerUpName:item?.runnerUpName ? String(item.runnerUpName) : (item?.runnerUpId ? clubName(item.runnerUpId) : ''),
      thirdPlaceId:Number(item?.thirdPlaceId || 0),
      thirdPlaceName:item?.thirdPlaceName ? String(item.thirdPlaceName) : (item?.thirdPlaceId ? clubName(item.thirdPlaceId) : ''),
      createdAt:String(item?.createdAt || new Date().toISOString())
    });
  });
  clean.sort((a,b)=>(Number(b.year || 0)-Number(a.year || 0)) || (Number(b.season || 0)-Number(a.season || 0)) || String(a.competitionName || '').localeCompare(String(b.competitionName || '')));
  return { entries:clean };
}

function normalizePlayerPalmaresAward(raw={}, fallbackKey=''){
  const season = Math.max(1, Math.round(Number(raw.season || 1)) || 1);
  const year = Math.round(Number(raw.year || 0)) || (typeof seasonYearForNumber === 'function' ? seasonYearForNumber(season) : season);
  const type = String(raw.type || 'league');
  const competitionId = String(raw.competitionId || raw.divisionId || '').trim();
  const clubId = Math.max(0, Math.round(Number(raw.clubId || raw.championId || 0)));
  const key = String(raw.key || fallbackKey || `player-title-${season}-${type}-${competitionId}-${clubId}`).trim();
  const category = String(raw.category || playerPalmaresCategoryForCompetition(type, competitionId));
  if(!key || !competitionId || !clubId || !['leagues','nationalCups','internationalCups','clubWorldCups'].includes(category)) return null;
  return {
    key,
    season,
    year,
    type,
    category,
    competitionId,
    competitionName:String(raw.competitionName || raw.divisionName || competitionId),
    clubId,
    clubName:String(raw.clubName || (typeof clubName === 'function' ? clubName(clubId) : `Club ${clubId}`)),
    awardedAt:String(raw.awardedAt || raw.createdAt || '')
  };
}
function playerPalmaresCategoryForCompetition(type='', competitionId=''){
  const raw = `${String(type || '')} ${String(competitionId || '')}`.toLowerCase();
  if(raw.includes('club_world_cup') || raw.includes('club-world-cup') || raw.includes('mundial de clubes')) return 'clubWorldCups';
  if(raw.includes('champions') || raw.includes('libertadores') || raw.includes('international') || raw.includes('internacional') || raw.includes('continental')) return 'internationalCups';
  if(raw.includes('national_cup') || raw.includes('national-cup') || raw.includes('national_supercup') || raw.includes('national-supercup') || raw.includes('copa nacional') || raw.includes('supercopa')) return 'nationalCups';
  if(raw.includes('league') || raw.includes('liga')) return 'leagues';
  return '';
}
function normalizePlayerPalmaresRecord(raw={}, playerId=0){
  const cleanId = Math.max(0, Math.round(Number(raw.playerId || playerId || 0)));
  if(!cleanId) return null;
  const awards = [];
  const seen = new Set();
  (Array.isArray(raw.awards) ? raw.awards : []).forEach((award,index) => {
    const clean = normalizePlayerPalmaresAward(award, `legacy-player-title-${cleanId}-${index + 1}`);
    if(!clean || seen.has(clean.key)) return;
    seen.add(clean.key);
    awards.push(clean);
  });
  awards.sort((a,b)=>Number(a.season || 0)-Number(b.season || 0) || String(a.competitionName || '').localeCompare(String(b.competitionName || ''), 'es', { sensitivity:'base' }));
  const counts = { leagues:0, nationalCups:0, internationalCups:0, clubWorldCups:0 };
  awards.forEach(award => { if(Object.prototype.hasOwnProperty.call(counts, award.category)) counts[award.category] += 1; });
  return {
    playerId:cleanId,
    leagues:counts.leagues,
    nationalCups:counts.nationalCups,
    internationalCups:counts.internationalCups,
    clubWorldCups:counts.clubWorldCups,
    total:counts.leagues + counts.nationalCups + counts.internationalCups + counts.clubWorldCups,
    awards
  };
}
function normalizePlayerPalmaresState(src={}){
  const obj = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
  const byPlayerId = {};
  Object.entries(obj.byPlayerId && typeof obj.byPlayerId === 'object' && !Array.isArray(obj.byPlayerId) ? obj.byPlayerId : {}).forEach(([key,value]) => {
    const record = normalizePlayerPalmaresRecord(value, key);
    if(record) byPlayerId[record.playerId] = record;
  });
  const processedCompetitions = {};
  Object.entries(obj.processedCompetitions && typeof obj.processedCompetitions === 'object' && !Array.isArray(obj.processedCompetitions) ? obj.processedCompetitions : {}).forEach(([key,value]) => {
    const cleanKey = String(key || '').trim();
    if(!cleanKey) return;
    processedCompetitions[cleanKey] = value && typeof value === 'object' && !Array.isArray(value)
      ? {
          key:cleanKey,
          season:Math.max(1, Math.round(Number(value.season || 1)) || 1),
          year:Math.round(Number(value.year || 0)),
          type:String(value.type || ''),
          competitionId:String(value.competitionId || ''),
          competitionName:String(value.competitionName || ''),
          championId:Math.max(0, Math.round(Number(value.championId || 0))),
          playerCount:Math.max(0, Math.round(Number(value.playerCount || 0))),
          recordedAt:String(value.recordedAt || '')
        }
      : { key:cleanKey, season:1, year:0, type:'', competitionId:'', competitionName:'', championId:0, playerCount:0, recordedAt:'' };
  });
  return {
    version:1,
    trackingStartedVersion:String(obj.trackingStartedVersion || ''),
    trackingStartedSeason:Math.max(0, Math.round(Number(obj.trackingStartedSeason || 0))),
    migrationVersion:Math.max(0, Math.round(Number(obj.migrationVersion || 0))),
    byPlayerId,
    processedCompetitions
  };
}
function playerPalmaresCompetitionKey(entry={}){
  const season = Math.max(1, Math.round(Number(entry.season || game?.seasonNumber || 1)) || 1);
  const type = String(entry.type || 'league').trim() || 'league';
  const competitionId = String(entry.competitionId || entry.divisionId || '').trim();
  const championId = Math.max(0, Math.round(Number(entry.championId || entry.clubId || 0)));
  return `player-title-${season}-${type}-${competitionId}-${championId}`;
}
function playerPalmaresChampionSquad(championId){
  const clubId = Math.max(0, Math.round(Number(championId || 0)));
  if(!clubId) return [];
  return (seed?.players || []).filter(player => player
    && Number(player.clubId || 0) === clubId
    && !player.retired
    && !player.sold
    && !player.freeAgent
    && !player.youthFreeAgent);
}
function awardPlayerPalmaresForCompetitionChampion(entry={}, targetGame=game){
  if(!targetGame || !entry) return 0;
  const category = playerPalmaresCategoryForCompetition(entry.type, entry.competitionId || entry.divisionId);
  const competitionId = String(entry.competitionId || entry.divisionId || '').trim();
  const championId = Math.max(0, Math.round(Number(entry.championId || entry.clubId || 0)));
  if(!category || !competitionId || !championId) return 0;
  targetGame.playerPalmares = normalizePlayerPalmaresState(targetGame.playerPalmares || {});
  const key = playerPalmaresCompetitionKey(entry);
  if(targetGame.playerPalmares.processedCompetitions[key]) return 0;
  const squad = playerPalmaresChampionSquad(championId);
  if(!squad.length) return 0;
  const season = Math.max(1, Math.round(Number(entry.season || targetGame.seasonNumber || 1)) || 1);
  const year = Math.round(Number(entry.year || targetGame.seasonYear || (typeof seasonYearForNumber === 'function' ? seasonYearForNumber(season) : season))) || season;
  const competitionName = String(entry.competitionName || entry.divisionName || competitionId);
  const awardedAt = String(entry.createdAt || new Date().toISOString());
  squad.forEach(player => {
    const playerId = Number(player.id || 0);
    if(!playerId) return;
    const current = normalizePlayerPalmaresRecord(targetGame.playerPalmares.byPlayerId[playerId] || {}, playerId) || normalizePlayerPalmaresRecord({}, playerId);
    if(current.awards.some(award => award.key === key)) return;
    current.awards.push({
      key,
      season,
      year,
      type:String(entry.type || 'league'),
      category,
      competitionId,
      competitionName,
      clubId:championId,
      clubName:String(entry.championName || entry.clubName || (typeof clubName === 'function' ? clubName(championId) : `Club ${championId}`)),
      awardedAt
    });
    targetGame.playerPalmares.byPlayerId[playerId] = normalizePlayerPalmaresRecord(current, playerId);
  });
  targetGame.playerPalmares.processedCompetitions[key] = {
    key,
    season,
    year,
    type:String(entry.type || 'league'),
    competitionId,
    competitionName,
    championId,
    playerCount:squad.length,
    recordedAt:awardedAt
  };
  return squad.length;
}
function migrateCurrentSeasonPlayerPalmares(targetGame=game){
  if(!targetGame) return { migrated:0, competitions:0, initialized:false };
  targetGame.playerPalmares = normalizePlayerPalmaresState(targetGame.playerPalmares || {});
  if(Number(targetGame.playerPalmares.migrationVersion || 0) >= 1) return { migrated:0, competitions:0, initialized:false };
  const currentSeason = Math.max(1, Math.round(Number(targetGame.seasonNumber || 1)) || 1);
  let migrated = 0;
  let competitions = 0;
  (targetGame.competitionChampionsHistory?.entries || []).filter(entry => Number(entry?.season || 0) === currentSeason).forEach(entry => {
    const awarded = awardPlayerPalmaresForCompetitionChampion(entry, targetGame);
    if(awarded > 0){ migrated += awarded; competitions += 1; }
  });
  targetGame.playerPalmares.migrationVersion = 1;
  targetGame.playerPalmares.trackingStartedVersion = targetGame.playerPalmares.trackingStartedVersion || 'V9.22';
  targetGame.playerPalmares.trackingStartedSeason = targetGame.playerPalmares.trackingStartedSeason || currentSeason;
  return { migrated, competitions, initialized:true };
}

function recordCompetitionChampion(entry){
  if(!game || !entry) return false;
  const season = Math.max(1, Math.round(Number(entry.season || game.seasonNumber || 1)) || 1);
  const year = Math.round(Number(entry.year || game.seasonYear || seasonYearForNumber(season))) || seasonYearForNumber(season);
  const competitionId = String(entry.competitionId || entry.divisionId || '').trim();
  const championId = Number(entry.championId || entry.clubId || 0);
  if(!competitionId || !championId) return false;
  game.competitionChampionsHistory = normalizeCompetitionChampionsHistoryState(game.competitionChampionsHistory || {});
  const clean = {
    season,
    year,
    type:String(entry.type || 'league'),
    competitionId,
    competitionName:String(entry.competitionName || entry.divisionName || competitionId),
    championId,
    championName:String(entry.championName || clubName(championId)),
    runnerUpId:Number(entry.runnerUpId || 0),
    runnerUpName:entry.runnerUpName ? String(entry.runnerUpName) : (entry.runnerUpId ? clubName(entry.runnerUpId) : ''),
    thirdPlaceId:Number(entry.thirdPlaceId || 0),
    thirdPlaceName:entry.thirdPlaceName ? String(entry.thirdPlaceName) : (entry.thirdPlaceId ? clubName(entry.thirdPlaceId) : ''),
    createdAt:String(entry.createdAt || new Date().toISOString())
  };
  const key = `${season}-${competitionId}`;
  const entries = (game.competitionChampionsHistory.entries || []).filter(item => `${Number(item.season || 0)}-${String(item.competitionId || '')}` !== key);
  entries.push(clean);
  game.competitionChampionsHistory = normalizeCompetitionChampionsHistoryState({ entries });
  awardPlayerPalmaresForCompetitionChampion(clean, game);
  return true;
}
function recordLeagueChampionsForCurrentSeason(){
  if(!game || !seed?.divisions?.length) return 0;
  let count = 0;
  const season = Number(game.seasonNumber || 1);
  const year = Number(game.seasonYear || seasonYearForNumber(season));
  (seed.divisions || []).forEach(division => {
    const rows = sortedStandings(division.id);
    const champion = rows && rows[0];
    if(!champion?.clubId) return;
    if(recordCompetitionChampion({
      season,
      year,
      type:'league',
      competitionId:division.id,
      competitionName:division.name,
      championId:Number(champion.clubId),
      championName:clubName(champion.clubId)
    })) count += 1;
  });
  return count;
}
function snapshotStandingsHistoryForCurrentSeason(){
  if(!game || !seed?.divisions?.length) return false;
  game.standingsHistory = normalizeStandingsHistoryState(game.standingsHistory || {});
  const season = Number(game.seasonNumber || 1);
  const year = Number(game.seasonYear || seasonYearForNumber(season));
  const divisions = {};
  (seed.divisions || []).forEach(division => {
    const rows = sortedStandings(division.id).map((row,index) => ({
      clubId:Number(row.clubId || 0),
      pj:Number(row.pj || 0), pg:Number(row.pg || 0), pe:Number(row.pe || 0), pp:Number(row.pp || 0),
      gf:Number(row.gf || 0), gc:Number(row.gc || 0), dg:Number(row.dg || 0), pts:Number(row.pts || 0),
      position:index + 1
    }));
    divisions[division.id] = rows;
  });
  const entry = { season, year, createdAt:new Date().toISOString(), divisions };
  game.standingsHistory.seasons = (game.standingsHistory.seasons || []).filter(item => !(Number(item.season) === season || Number(item.year) === year));
  game.standingsHistory.seasons.push(entry);
  game.standingsHistory.seasons.sort((a,b)=>Number(b.year || 0)-Number(a.year || 0));
  return true;
}

function deriveSeasonInitialBudgetFromHistory(saved, season){
  const history = Array.isArray(saved?.budgetHistory) ? saved.budgetHistory : [];
  const currentSeason = Number(season || saved?.seasonNumber || 1);
  const first = history.find(entry => Number(entry.season || currentSeason) === currentSeason && Number.isFinite(Number(entry.budget)));
  if(first){
    return Math.round(Number(first.budget || 0) - Number(first.delta || 0));
  }
  if(currentSeason === 1){
    const club = seed?.clubs?.find(c => Number(c.id) === Number(saved?.selectedClubId));
    if(club && Number.isFinite(Number(club.budget))) return Math.round(Number(club.budget));
  }
  return Math.round(Number(saved?.budget || 0));
}
function firstIncompleteFixtureIndexForState(state){
  const fixtures = Array.isArray(state?.fixtures) ? state.fixtures : [];
  const index = fixtures.findIndex(round => (round?.matches || []).some(match => !match?.played));
  return index >= 0 ? index : fixtures.length;
}
function repairFixtureCursorForState(state, options={}){
  if(!state || !Array.isArray(state.fixtures)) return { changed:false, previous:0, next:0, recoveredPending:0 };
  const previous = Math.min(Math.max(0, Math.round(Number(state.matchdayIndex || 0))), state.fixtures.length);
  const next = firstIncompleteFixtureIndexForState(state);
  const recoveredPending = state.fixtures.slice(0, previous).reduce((total, round) => total + (round?.matches || []).filter(match => !match?.played).length, 0);
  const changed = previous !== next;
  if(changed){
    state.matchdayIndex = next;
    state._needsAutosave = true;
    state.fixtureCursorRepair = {
      version:1,
      season:Number(state.seasonNumber || 1),
      previous,
      next,
      recoveredPending,
      reason:String(options.reason || 'calendar_reorder'),
      repairedAt:new Date().toISOString()
    };
  }
  return { changed, previous, next, recoveredPending };
}
function normalizeGame(saved){
  const normalized = {...saved};
  normalized.version = APP_VERSION;
  normalized.saveSlotId = typeof normalizeSaveSlotId === 'function' ? normalizeSaveSlotId(normalized.saveSlotId || currentSaveSlotId || SAVE_SLOT_CAREER) : (normalized.saveSlotId || 'career');
  normalized.seedSignature = normalized.seedSignature || seed?.meta?.signature || '';
  normalized.tactic = normalizeTactic(normalized.selectedClubId, normalized.tactic || DEFAULT_TACTIC);
  normalized.captaincyProgress = normalizeCaptaincyProgressState(normalized.captaincyProgress || {});
  normalized.captaincyAppliedMatches = (normalized.captaincyAppliedMatches && typeof normalized.captaincyAppliedMatches === 'object' && !Array.isArray(normalized.captaincyAppliedMatches)) ? normalized.captaincyAppliedMatches : {};
  normalized.lastCaptaincyEffect = normalized.lastCaptaincyEffect && typeof normalized.lastCaptaincyEffect === 'object' ? normalized.lastCaptaincyEffect : null;
  normalized.savedTactics = normalizeSavedTacticsState(normalized.savedTactics || {});
  normalized.savedTrainingPlans = normalizeSavedTrainingPlansState(normalized.savedTrainingPlans || {});
  normalized.standingsHistory = normalizeStandingsHistoryState(normalized.standingsHistory || {});
  normalized.competitionChampionsHistory = normalizeCompetitionChampionsHistoryState(normalized.competitionChampionsHistory || {});
  normalized.playerPalmares = normalizePlayerPalmaresState(normalized.playerPalmares || {});
  normalized.playerStatus = normalized.playerStatus || {};
  normalized.manualRetiredPlayerIds = Array.from(new Set((Array.isArray(normalized.manualRetiredPlayerIds) ? normalized.manualRetiredPlayerIds : (Array.isArray(normalized.retiredManualPlayerIds) ? normalized.retiredManualPlayerIds : [])).map(id => Number(id)).filter(id => Number.isFinite(id) && id > 0)));
  normalized.retiredPlayerPool = normalizeRetiredPlayerPool(normalized.retiredPlayerPool || []);
  const surnameVarietyMigration = typeof migrateGamePlayerSurnameVariety === 'function' ? migrateGamePlayerSurnameVariety(normalized, seed) : { changed:0, references:0 };
  if(Number(surnameVarietyMigration?.changed || 0) > 0 || Number(surnameVarietyMigration?.references || 0) > 0) normalized._needsAutosave = true;
  const professionalQualityMigration = typeof migrateProfessionalQualityScaleForState === 'function' ? migrateProfessionalQualityScaleForState(normalized, seed?.players || []) : { changed:0 };
  if(Number(professionalQualityMigration?.changed || 0) > 0) normalized._needsAutosave = true;
  normalized.statusRebases = (normalized.statusRebases && typeof normalized.statusRebases === 'object' && !Array.isArray(normalized.statusRebases)) ? normalized.statusRebases : {};
  normalized.injuryRecoveryTurnsBySeason = (normalized.injuryRecoveryTurnsBySeason && typeof normalized.injuryRecoveryTurnsBySeason === 'object' && !Array.isArray(normalized.injuryRecoveryTurnsBySeason)) ? normalized.injuryRecoveryTurnsBySeason : {};
  normalized.lastOwnProblems = normalized.lastOwnProblems || [];
  normalized.lastTurnSummary = normalized.lastTurnSummary || null;
  normalized.mustReviewTactics = Boolean(normalized.mustReviewTactics);
  normalized.advanceLockedUntil = normalized.advanceLockedUntil || 0;
  normalized.advanceLockDurationMs = Number.isFinite(Number(normalized.advanceLockDurationMs)) ? Number(normalized.advanceLockDurationMs) : ADVANCE_LOCK_MS;
  normalized.matchHistory = normalized.matchHistory || [];
  normalized.disciplineProcessedMatches = (normalized.disciplineProcessedMatches && typeof normalized.disciplineProcessedMatches === 'object' && !Array.isArray(normalized.disciplineProcessedMatches)) ? normalized.disciplineProcessedMatches : {};
  if(typeof migrateLegacyCompetitionSuspensionsForState === 'function'){
    const disciplineMigration = migrateLegacyCompetitionSuspensionsForState(normalized);
    if(Number(disciplineMigration?.changed || 0) > 0){
      normalized._needsAutosave = true;
      normalized.disciplineMigrationV914 = {
        version:1,
        migrated:Number(disciplineMigration.migrated || 0),
        normalized:Number(disciplineMigration.normalized || 0)
      };
    }
  }
  normalized.seasonNumber = Number.isFinite(normalized.seasonNumber) ? normalized.seasonNumber : 1;
  normalized.seasonYear = Math.round(Number(normalized.seasonYear || 0)) || seasonYearForNumber(normalized.seasonNumber || 1);
  const playerPalmaresMigration = migrateCurrentSeasonPlayerPalmares(normalized);
  if(Boolean(playerPalmaresMigration?.initialized) || Number(playerPalmaresMigration?.migrated || 0) > 0) normalized._needsAutosave = true;
  normalized.calendarVersion = normalized.calendarVersion || '';
  normalized.saveCode = normalized.saveCode || generateSaveCode();
  normalized.rankingUploads = (normalized.rankingUploads && typeof normalized.rankingUploads === 'object' && !Array.isArray(normalized.rankingUploads)) ? normalized.rankingUploads : {};
  normalized.rankingManagerName = normalized.rankingManagerName || storedManagerName() || '';
  normalized.rankingLastUploadGameDate = validIsoDate(normalized.rankingLastUploadGameDate) ? normalized.rankingLastUploadGameDate : '';
  normalized.rankingLastManualUploadGameDate = validIsoDate(normalized.rankingLastManualUploadGameDate) ? normalized.rankingLastManualUploadGameDate : '';
  normalized.rankingLastAutomaticUploadGameDate = validIsoDate(normalized.rankingLastAutomaticUploadGameDate) ? normalized.rankingLastAutomaticUploadGameDate : '';
  normalized.rankingScheduledCareerUploads = (normalized.rankingScheduledCareerUploads && typeof normalized.rankingScheduledCareerUploads === 'object' && !Array.isArray(normalized.rankingScheduledCareerUploads)) ? normalized.rankingScheduledCareerUploads : { version:2, events:{} };
  normalized.rankingScheduledCareerUploads.version = 2;
  normalized.rankingScheduledCareerUploads.events = (normalized.rankingScheduledCareerUploads.events && typeof normalized.rankingScheduledCareerUploads.events === 'object' && !Array.isArray(normalized.rankingScheduledCareerUploads.events)) ? normalized.rankingScheduledCareerUploads.events : {};
  normalized.rankingCareerActivitySync = (normalized.rankingCareerActivitySync && typeof normalized.rankingCareerActivitySync === 'object' && !Array.isArray(normalized.rankingCareerActivitySync)) ? normalized.rankingCareerActivitySync : { version:1, status:'idle' };
  normalized.rankingCareerActivitySync.version = 1;
  normalized.rankingCareerActivitySync.status = String(normalized.rankingCareerActivitySync.status || 'idle');
  normalized.rankingCareerActivitySync.lastSuccessGameDate = validIsoDate(normalized.rankingCareerActivitySync.lastSuccessGameDate) ? normalized.rankingCareerActivitySync.lastSuccessGameDate : '';
  normalized.rankingCareerActivitySync.lastSuccessAt = String(normalized.rankingCareerActivitySync.lastSuccessAt || '');
  normalized.rankingCareerActivitySync.lastFingerprint = String(normalized.rankingCareerActivitySync.lastFingerprint || '');
  normalized.rankingCareerActivitySync.lastAttemptAt = String(normalized.rankingCareerActivitySync.lastAttemptAt || '');
  normalized.rankingCareerActivitySync.lastAttemptGameDate = validIsoDate(normalized.rankingCareerActivitySync.lastAttemptGameDate) ? normalized.rankingCareerActivitySync.lastAttemptGameDate : '';
  normalized.rankingCareerActivitySync.lastReason = String(normalized.rankingCareerActivitySync.lastReason || '');
  normalized.rankingCareerActivitySync.error = String(normalized.rankingCareerActivitySync.error || '');
  normalized.rankingCareerActivitySync.attempts = Math.max(0, Math.round(Number(normalized.rankingCareerActivitySync.attempts || 0)));
  normalized.rankingCareerActivitySync.loginPromptSent = Boolean(normalized.rankingCareerActivitySync.loginPromptSent);
  normalized.selectedCountry = normalized.selectedCountry || clubCountry(seed?.clubs?.find(c => Number(c.id) === Number(normalized.selectedClubId))) || 'Argentina';
  normalized.selectedLeagueId = normalized.selectedLeagueId || (seed?.clubs?.find(c => Number(c.id) === Number(normalized.selectedClubId))?.divisionId || 'default');
  normalized.playerMentalities = (normalized.playerMentalities && typeof normalized.playerMentalities === 'object' && !Array.isArray(normalized.playerMentalities)) ? normalized.playerMentalities : {};
  normalized.playerMentalities = { ...(normalized.tactic?.playerMentalities || {}), ...normalized.playerMentalities };
  Object.keys(normalized.playerMentalities).forEach(id => {
    const cleanId = Number(id);
    if(!cleanId) delete normalized.playerMentalities[id];
    else normalized.playerMentalities[cleanId] = normalizeMentality(normalized.playerMentalities[id]);
  });
  normalized.tactic.playerMentalities = { ...normalized.playerMentalities, ...(normalized.tactic?.playerMentalities || {}) };
  normalized.seasonBudgetStartBySeason = (normalized.seasonBudgetStartBySeason && typeof normalized.seasonBudgetStartBySeason === 'object' && !Array.isArray(normalized.seasonBudgetStartBySeason)) ? normalized.seasonBudgetStartBySeason : {};
  if(!Number.isFinite(Number(normalized.seasonBudgetStartBySeason[normalized.seasonNumber]))){
    normalized.seasonBudgetStartBySeason[normalized.seasonNumber] = deriveSeasonInitialBudgetFromHistory(normalized, normalized.seasonNumber);
  }
  normalized.seasonInitialBudget = Number.isFinite(Number(normalized.seasonInitialBudget)) ? Math.round(Number(normalized.seasonInitialBudget)) : Math.round(Number(normalized.seasonBudgetStartBySeason[normalized.seasonNumber] ?? deriveSeasonInitialBudgetFromHistory(normalized, normalized.seasonNumber)));
  const hadCareerInitialBudget = Number.isFinite(Number(normalized.careerInitialBudget));
  const orderedBudgetStarts = Object.entries(normalized.seasonBudgetStartBySeason).map(([season, value]) => ({ season:Number(season), value:Number(value) })).filter(item => Number.isFinite(item.season) && Number.isFinite(item.value)).sort((a,b)=>a.season-b.season);
  normalized.careerInitialBudget = hadCareerInitialBudget ? Math.round(Number(normalized.careerInitialBudget)) : Math.round(Number(orderedBudgetStarts[0]?.value ?? normalized.seasonInitialBudget ?? normalized.budget ?? 0));
  if(!hadCareerInitialBudget) normalized._needsAutosave = true;
  normalized.seasonFinalized = Boolean(normalized.seasonFinalized);
  normalized.seasonTransition = normalized.seasonTransition || null;
  normalized.argentinaPlayoffs = (normalized.argentinaPlayoffs && typeof normalized.argentinaPlayoffs === 'object' && !Array.isArray(normalized.argentinaPlayoffs)) ? normalized.argentinaPlayoffs : null;
  normalized.clubWorldCup = (normalized.clubWorldCup && typeof normalized.clubWorldCup === 'object' && !Array.isArray(normalized.clubWorldCup)) ? normalized.clubWorldCup : null;
  normalized.clubWorldCupHistory = normalizeClubWorldCupHistoryState(normalized.clubWorldCupHistory || {});
  normalized.nationalCups = typeof normalizeNationalCupsState === 'function' ? normalizeNationalCupsState(normalized.nationalCups || {}, normalized.seasonNumber, normalized.seasonYear) : (normalized.nationalCups || null);
  normalized.libertadores = typeof normalizeLibertadoresState === 'function' ? normalizeLibertadoresState(normalized.libertadores || {}, normalized.seasonNumber, normalized.seasonYear) : (normalized.libertadores || null);
  normalized.libertadoresHistory = typeof normalizeLibertadoresHistoryState === 'function' ? normalizeLibertadoresHistoryState(normalized.libertadoresHistory || {}) : (normalized.libertadoresHistory || { version:1, editions:[] });
  normalized.championsLeague = typeof normalizeChampionsLeagueState === 'function' ? normalizeChampionsLeagueState(normalized.championsLeague || {}, normalized.seasonNumber, normalized.seasonYear) : (normalized.championsLeague || null);
  normalized.championsLeagueHistory = typeof normalizeChampionsLeagueHistoryState === 'function' ? normalizeChampionsLeagueHistoryState(normalized.championsLeagueHistory || {}) : (normalized.championsLeagueHistory || { version:1, editions:[] });
  if(normalized.clubWorldCup && typeof ensureClubWorldCupInvitedData === 'function') ensureClubWorldCupInvitedData();
  if(syncClubWorldCupHistoryForState(normalized)) normalized._needsAutosave = true;
  if(typeof syncLibertadoresHistoryForState === 'function' && syncLibertadoresHistoryForState(normalized)) normalized._needsAutosave = true;
  if(typeof syncChampionsLeagueHistoryForState === 'function' && syncChampionsLeagueHistoryForState(normalized)) normalized._needsAutosave = true;
  normalized.seasonPhase = normalized.seasonPhase || (normalized.seasonFinalized ? 'finalized' : 'regular');
  normalized.phaseTurn = Number.isFinite(normalized.phaseTurn) ? normalized.phaseTurn : 0;
  normalized.globalTurn = Number.isFinite(normalized.globalTurn) ? normalized.globalTurn : ((Math.max(1, normalized.seasonNumber || 1) - 1) * 53 + (normalized.matchdayIndex || 0));
  normalized.preseasonFriendliesPlayed = Number.isFinite(normalized.preseasonFriendliesPlayed) ? normalized.preseasonFriendliesPlayed : 0;
  normalized.pendingFriendlyOpponentId = Number.isFinite(normalized.pendingFriendlyOpponentId) ? normalized.pendingFriendlyOpponentId : 0;
  const rawDivisionOverrides = (normalized.clubDivisionOverrides && typeof normalized.clubDivisionOverrides === 'object' && !Array.isArray(normalized.clubDivisionOverrides)) ? normalized.clubDivisionOverrides : {};
  normalized.clubDivisionOverrides = sanitizeClubDivisionOverrides(rawDivisionOverrides);
  const removedSpecialOverrides = Object.keys(rawDivisionOverrides).length !== Object.keys(normalized.clubDivisionOverrides).length;
  const economySeasonKey = String(Math.max(1, Math.round(Number(normalized.seasonNumber || 1))));
  const hadLeagueEconomySnapshot = Boolean(normalized.leagueSeasonEconomy?.seasons?.[economySeasonKey]);
  if(typeof ensureLeagueSeasonEconomyForSeason === 'function') ensureLeagueSeasonEconomyForSeason(normalized, normalized.seasonNumber, { reason:'save_migration' });
  if(removedSpecialOverrides || !hadLeagueEconomySnapshot) normalized._needsAutosave = true;
  const previousTitleHistoryCount = Array.isArray(normalized.managerStats?.titleHistory) ? normalized.managerStats.titleHistory.length : 0;
  normalized.managerStats = ensureManagerCurrentSeasonStats(normalized.managerStats, normalized.seasonNumber, normalized.selectedClubId);
  const hadManagerPhilosophy = Boolean(normalized.managerPhilosophy && typeof normalized.managerPhilosophy === 'object');
  normalized.managerPhilosophy = typeof normalizeManagerPhilosophyState === 'function'
    ? normalizeManagerPhilosophyState(normalized.managerPhilosophy)
    : (normalized.managerPhilosophy || null);
  if(!hadManagerPhilosophy) normalized._needsAutosave = true;
  const hadAssistantCoachAnalysis = Boolean(normalized.assistantCoachAnalysis && typeof normalized.assistantCoachAnalysis === 'object');
  normalized.assistantCoachAnalysis = typeof normalizeAssistantCoachAnalysisState === 'function'
    ? normalizeAssistantCoachAnalysisState(normalized.assistantCoachAnalysis)
    : (normalized.assistantCoachAnalysis || null);
  if(!hadAssistantCoachAnalysis) normalized._needsAutosave = true;
  const titlesRebuilt = syncManagerOfficialTitles(normalized);
  if(titlesRebuilt || Number(normalized.managerStats?.titleHistory?.length || 0) !== previousTitleHistoryCount) normalized._needsAutosave = true;
  normalized.managerSharedProfile = (normalized.managerSharedProfile && typeof normalized.managerSharedProfile === 'object' && !Array.isArray(normalized.managerSharedProfile)) ? {
    version:String(normalized.managerSharedProfile.version || 'V6.24'),
    experience:Math.max(0, Math.round(Number(normalized.managerSharedProfile.experience || 0))),
    careerHistory:Array.isArray(normalized.managerSharedProfile.careerHistory) ? normalized.managerSharedProfile.careerHistory : [],
    updatedAt:normalized.managerSharedProfile.updatedAt || null
  } : null;
  normalized.gameOver = normalizeGameOverState(normalized.gameOver);
  normalized.managerJobMarket = typeof normalizeManagerJobMarketState === 'function' ? normalizeManagerJobMarketState(normalized.managerJobMarket || {}) : (normalized.managerJobMarket || {});
  normalized.managerJobContract = (normalized.managerJobContract && typeof normalized.managerJobContract === 'object' && !Array.isArray(normalized.managerJobContract)) ? normalized.managerJobContract : null;
  normalized.founderMode = Boolean(normalized.founderMode || isFoundedClubId(normalized.selectedClubId));
  normalized.founderClubId = normalized.founderMode ? Number(normalized.founderClubId || normalized.selectedClubId || 0) : 0;
  normalized.founderReplacedClub = normalized.founderReplacedClub || null;
  normalized.founderGoals = normalized.founderMode && normalized.founderGoals && typeof normalized.founderGoals === 'object' && !Array.isArray(normalized.founderGoals) ? normalized.founderGoals : (normalized.founderMode ? {} : null);
  normalized.founderAdministrativeCosts = typeof normalizeFounderAdministrativeCostsState === 'function' ? normalizeFounderAdministrativeCostsState(normalized.founderAdministrativeCosts || {}) : (normalized.founderAdministrativeCosts || {});
  normalized.bankruptcyMode = Boolean(normalized.bankruptcyMode);
  normalized.bankruptcy = normalized.bankruptcy && typeof normalized.bankruptcy === 'object' && !Array.isArray(normalized.bankruptcy) ? normalized.bankruptcy : null;
  normalized.messages = Array.isArray(normalized.messages) ? normalized.messages : [];
  normalized.messages = normalized.messages.filter(msg => !String(msg?.body || '').includes('La liga ajustó la preparación de'));
  if(typeof compactMessageInboxForState === 'function'){
    const inboxMigration = compactMessageInboxForState(normalized, { migration:true });
    if(Boolean(inboxMigration?.changed)) normalized._needsAutosave = true;
  }
  normalized.specialClauseOffers = (normalized.specialClauseOffers && typeof normalized.specialClauseOffers === 'object' && !Array.isArray(normalized.specialClauseOffers)) ? normalized.specialClauseOffers : null;
  normalized.eventLog = Array.isArray(normalized.eventLog) ? normalized.eventLog : [];
  normalized.playerStars = normalizePlayerStarsState(normalized.playerStars || {});
  normalized.playerImpactWindows = normalizePlayerImpactWindows(normalized.playerImpactWindows || {});
  syncPlayerStarsWithClubs(normalized);
  const hadFirstVictoryQolMarker = Boolean(saved?.special?.recompensas_calidad_vida && Object.prototype.hasOwnProperty.call(saved.special.recompensas_calidad_vida, 'primera_victoria'));
  normalized.special = typeof normalizeSpecialState === 'function' ? normalizeSpecialState(normalized.special, normalized.rankingManagerName || storedManagerName() || 'Manager') : (normalized.special || null);
  if(normalized.special && typeof normalized.special === 'object'){
    normalized.special.recompensas_calidad_vida = normalized.special.recompensas_calidad_vida && typeof normalized.special.recompensas_calidad_vida === 'object' && !Array.isArray(normalized.special.recompensas_calidad_vida)
      ? { version:1, ...normalized.special.recompensas_calidad_vida }
      : { version:1, primera_victoria:false };
    if(!hadFirstVictoryQolMarker){
      // V9.72: todas las carreras quedan habilitadas para cobrar el premio en su próxima victoria oficial.
      normalized.special.recompensas_calidad_vida.primera_victoria = false;
      normalized.special.recompensas_calidad_vida.migrada_v972 = true;
      normalized.special.recompensas_calidad_vida.premio_retroactivo_pendiente = Math.max(0, Math.round(Number(normalized.managerStats?.totals?.won || 0))) > 0;
      normalized._needsAutosave = true;
    }else{
      const rewardState = normalized.special.recompensas_calidad_vida;
      const rewardLogged = Array.isArray(normalized.special.puntos_log) && normalized.special.puntos_log.some(entry => String(entry?.actionId || '') === 'primera_victoria_manager');
      const rewardActuallyPaid = Boolean(rewardLogged || rewardState.primera_victoria_fecha || rewardState.primera_victoria_partido);
      if(rewardState.primera_victoria && !rewardActuallyPaid){
        // V9.71 podía marcar carreras antiguas como cobradas sin acreditar los 5.000 puntos. Se reabre el premio.
        rewardState.primera_victoria = false;
        rewardState.migrada_v972 = true;
        rewardState.premio_retroactivo_pendiente = true;
        normalized._needsAutosave = true;
      }
    }
  }
  normalized.marketPlayers = Array.isArray(normalized.marketPlayers) ? normalized.marketPlayers : generateMarketPlayers(MARKET_FREE_AGENT_COUNT);
  const hadTransferHistory = Boolean(normalized.transferHistory && typeof normalized.transferHistory === 'object' && !Array.isArray(normalized.transferHistory));
  const previousTransferHistoryCount = Array.isArray(normalized.transferHistory?.entries) ? normalized.transferHistory.entries.length : 0;
  if(typeof ensureTransferHistoryState === 'function') ensureTransferHistoryState(normalized);
  else normalized.transferHistory = hadTransferHistory ? normalized.transferHistory : { version:'V8.99', nextId:1, entries:[] };
  if(!hadTransferHistory || Number(normalized.transferHistory?.entries?.length || 0) !== previousTransferHistoryCount) normalized._needsAutosave = true;
  const hadEliteBotMarket = Boolean(normalized.eliteBotMarket && typeof normalized.eliteBotMarket === 'object' && !Array.isArray(normalized.eliteBotMarket));
  normalized.eliteBotMarket = typeof normalizeEliteBotMarketState === 'function' ? normalizeEliteBotMarketState(normalized.eliteBotMarket || {}, normalized) : (normalized.eliteBotMarket || { version:'V9.00', season:Number(normalized.seasonNumber || 1), lastFreeReviewDate:'', lastTransferReviewDate:'', clubSeasonSignings:{}, log:[] });
  if(!hadEliteBotMarket) normalized._needsAutosave = true;
  const manualReferenceRepair = typeof synchronizeManualPlayerReferences === 'function'
    ? synchronizeManualPlayerReferences(normalized, seed, { retiredManualPlayerIds:normalized?.manualRetiredPlayerIds || normalized?.retiredManualPlayerIds || [] })
    : { changed:false };
  if(manualReferenceRepair.changed) normalized._needsAutosave = true;
  const rawPendingTransfers = Array.isArray(normalized.pendingTransfers) ? normalized.pendingTransfers : [];
  const normalizedPendingTransfers = rawPendingTransfers
    .map(item => typeof normalizePendingTransferMarketEntry === 'function' ? normalizePendingTransferMarketEntry(item, normalized) : item)
    .filter(Boolean);
  if(JSON.stringify(rawPendingTransfers) !== JSON.stringify(normalizedPendingTransfers)) normalized._needsAutosave = true;
  normalized.pendingTransfers = normalizedPendingTransfers;
  if(typeof repairCompletedIncomingTransferOwnership === 'function'){
    const ownershipRepair = repairCompletedIncomingTransferOwnership(normalized);
    if(Number(ownershipRepair?.repaired || 0) > 0 || Number(ownershipRepair?.synced || 0) > 0) normalized._needsAutosave = true;
    if(Number(ownershipRepair?.repaired || 0) > 0){
      const repairedNames = (ownershipRepair.playerIds || []).map(id => seed?.players?.find(player => Number(player?.id || 0) === Number(id))?.name || `Jugador ${id}`);
      normalized.messages.unshift({
        id:`ownership-repair-v961-${Date.now()}`,
        type:'mercado',
        title:'Compra recuperada',
        body:`Se restauró ${repairedNames.length === 1 ? repairedNames[0] : `${repairedNames.length} jugadores`} al club porque el historial confirmaba una compra ya pagada. No se realizó un nuevo cobro.`,
        priority:'high',
        read:false,
        createdAt:new Date().toISOString()
      });
    }
  }
  normalized.rejectedPurchaseOffers = (normalized.rejectedPurchaseOffers && typeof normalized.rejectedPurchaseOffers === 'object' && !Array.isArray(normalized.rejectedPurchaseOffers)) ? normalized.rejectedPurchaseOffers : {};
  normalized.rejectedFreeAgentOffers = (normalized.rejectedFreeAgentOffers && typeof normalized.rejectedFreeAgentOffers === 'object' && !Array.isArray(normalized.rejectedFreeAgentOffers)) ? normalized.rejectedFreeAgentOffers : {};
  normalized.scoutingCenter = (normalized.scoutingCenter && typeof normalized.scoutingCenter === 'object' && !Array.isArray(normalized.scoutingCenter)) ? normalized.scoutingCenter : {};
  normalized.monthlyExpenses = (normalized.monthlyExpenses && typeof normalized.monthlyExpenses === 'object' && !Array.isArray(normalized.monthlyExpenses)) ? normalized.monthlyExpenses : {};
  normalized.lastOwnPlayerOffer = normalized.lastOwnPlayerOffer || null;
  // Limpia búsquedas pendientes creadas por la compilación retirada de V7.07.
  if(Object.prototype.hasOwnProperty.call(normalized, 'forcedOwnPlayerOffers')) delete normalized.forcedOwnPlayerOffers;
  normalized.seasonEndPlayerOffers = normalized.seasonEndPlayerOffers || null;
  mergeMarketPlayersIntoSeed(normalized.marketPlayers);
  normalizeAllPlayerPositions();
  normalized.marketPlayers.forEach((p, index) => {
    if(typeof removeCustomPlayerPhotoFields === 'function') removeCustomPlayerPhotoFields(p);
    p.position = normalizePlayerPosition(p.position, p.id);
    p.transferListed = Boolean(p.transferListed);
    p.intransferible = Boolean(p.intransferible);
    if(p.intransferible) p.transferListed = false;
    if(Number(p.clubId || 0) === 0 || p.freeAgent){
      p.nationality = freeAgentNationalityForIndex(index, `market-normalized-${normalized.seasonNumber || 1}`);
      p.freeAgent = true;
    }
    ensurePlayerEconomics(p, p.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : MARKET_FREE_AGENT_SALARY_FACTOR);
  });
  normalized.marketPlayers = pruneFreeAgentMarketArrayToHardMax(normalized.marketPlayers, MARKET_FREE_AGENT_HARD_MAX);
  syncSeedFreeAgentCleanup(normalized.marketPlayers);
  mergeMarketPlayersIntoSeed(normalized.marketPlayers);
  seed.players.forEach(p => { p.transferListed = Boolean(p.transferListed); p.intransferible = Boolean(p.intransferible); if(p.intransferible) p.transferListed = false; ensurePlayerEconomics(p, p.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : 1); });
  applyClubDivisionOverrides(normalized.clubDivisionOverrides);
  if(typeof restoreClubDivisionsFromSeasonFixtures === 'function'){
    const divisionRepair = restoreClubDivisionsFromSeasonFixtures(normalized, { reason:'load_v964', message:true });
    if(Number(divisionRepair?.repaired || 0) > 0) normalized._needsAutosave = true;
  }
  const embeddedFixtureSeedIndex = (normalized.fixtures || []).map(round => typeof leagueFixtureSeedIndexFromRound === 'function' ? leagueFixtureSeedIndexFromRound(round) : null).find(value => value !== null && value !== undefined);
  const savedFixtureSeedIndex = typeof normalizeLeagueFixtureSeedIndex === 'function' ? normalizeLeagueFixtureSeedIndex(normalized.leagueFixtureSeedIndex) : null;
  normalized.leagueFixtureSeedIndex = savedFixtureSeedIndex !== null ? savedFixtureSeedIndex : (embeddedFixtureSeedIndex !== undefined ? embeddedFixtureSeedIndex : null);
  normalized.leagueFixtureSeedVersion = normalized.leagueFixtureSeedIndex === null
    ? 'legacy-v969'
    : (typeof LEAGUE_FIXTURE_SEED_VERSION !== 'undefined' ? LEAGUE_FIXTURE_SEED_VERSION : 'v970-20-seeds');
  normalized.leagueFixtureSeedHistory = normalized.leagueFixtureSeedHistory && typeof normalized.leagueFixtureSeedHistory === 'object' && !Array.isArray(normalized.leagueFixtureSeedHistory)
    ? normalized.leagueFixtureSeedHistory
    : {};
  if(normalized.leagueFixtureSeedIndex !== null) normalized.leagueFixtureSeedHistory[normalized.seasonNumber] = normalized.leagueFixtureSeedIndex;
  const previousCalendarVersion = normalized.calendarVersion;
  const previousFixtureCount = Array.isArray(normalized.fixtures) ? normalized.fixtures.length : 0;
  normalized.fixtures = normalizeSeasonFixtures(normalized.fixtures || structuredClone(seed.fixtures), normalized.seasonNumber, normalized.seasonYear, { fixtureSeedIndex:normalized.leagueFixtureSeedIndex });
  repairPromotionPlayoffScheduleForState(normalized);
  const calendarExpanded = previousCalendarVersion !== SEASON_CALENDAR_VERSION && previousFixtureCount > 0 && normalized.fixtures.length > previousFixtureCount;
  normalized.matchdayIndex = Math.min(Math.max(0, Number(normalized.matchdayIndex || 0)), normalized.fixtures.length);
  const fixtureCursorRepair = repairFixtureCursorForState(normalized, { reason:calendarExpanded ? 'calendar_expanded' : 'calendar_normalized' });
  if(fixtureCursorRepair.recoveredPending > 0 && ['postseason','finalizing'].includes(normalized.seasonPhase)){
    normalized.seasonPhase = 'regular';
    normalized.phaseTurn = 0;
    normalized.seasonFinalized = false;
    normalized.seasonTransition = null;
  }
  if(calendarExpanded && normalized.matchdayIndex < normalized.fixtures.length && ['postseason','finalizing','finalized'].includes(normalized.seasonPhase)){
    normalized.seasonPhase = 'regular';
    normalized.phaseTurn = 0;
    normalized.seasonFinalized = false;
    normalized.seasonTransition = null;
  }
  if(previousCalendarVersion !== SEASON_CALENDAR_VERSION || !validIsoDate(normalized.currentDate) || String(normalized.currentDate).slice(0,4) !== String(normalized.seasonYear)){
    normalized.currentDate = dateForSeasonState(normalized);
  }
  normalized.lastCalendarDate = validIsoDate(normalized.lastCalendarDate) ? normalized.lastCalendarDate : null;
  if(normalized.lastCalendarDate && validIsoDate(normalized.currentDate) && daysBetweenIsoDates(normalized.currentDate, normalized.lastCalendarDate) > 0){
    normalized.currentDate = normalized.lastCalendarDate;
    normalized._calendarRegressionRepaired = true;
  }
  if(normalized.seasonPhase === 'postseason' && typeof ensurePostseasonCalendar === 'function'){
    const postseasonCalendar = ensurePostseasonCalendar(normalized);
    const expectedPostseasonDate = dateForSeasonState(normalized);
    if(validIsoDate(expectedPostseasonDate) && (!validIsoDate(normalized.currentDate) || daysBetweenIsoDates(normalized.currentDate, expectedPostseasonDate) >= 0)){
      normalized.currentDate = expectedPostseasonDate;
      normalized.lastCalendarDate = expectedPostseasonDate;
    }
    normalized._postseasonCalendarRepaired = Boolean(postseasonCalendar?.repaired || normalized._postseasonCalendarRepaired);
  }
  normalized.calendarVersion = SEASON_CALENDAR_VERSION;
  normalized.standings = normalized.standings || createInitialStandings();
  normalized.playerStats = normalized.playerStats || createInitialPlayerStats();
  normalized.playerCareerStats = normalizePlayerCareerStats(normalized.playerCareerStats, normalized.playerStats);
  normalized.managerPlayerStatsHistory = normalizeManagerPlayerStatsHistory(normalized.managerPlayerStatsHistory);
  normalized.clubBudgets = (normalized.clubBudgets && typeof normalized.clubBudgets === 'object' && !Array.isArray(normalized.clubBudgets)) ? normalized.clubBudgets : {};
  seed.clubs.forEach(c => { if(!Number.isFinite(Number(normalized.clubBudgets[c.id]))) normalized.clubBudgets[c.id] = Math.round(Number(c.budget || 0)); });
  const normalizedManagerHasClub = !Boolean(normalized.gameOver?.active);
  if(normalizedManagerHasClub){
    normalized.budget = Number.isFinite(normalized.budget) ? normalized.budget : (Number(normalized.clubBudgets[normalized.selectedClubId]) || seed.clubs.find(c=>c.id===normalized.selectedClubId)?.budget || 0);
    normalized.clubBudgets[normalized.selectedClubId] = Math.round(Number(normalized.budget || 0));
  }else{
    normalized.budget = 0;
  }
  normalized.lastBudgetDelta = Number.isFinite(normalized.lastBudgetDelta) ? normalized.lastBudgetDelta : 0;
  normalized.budgetHistory = normalized.budgetHistory || [];
  normalized.transferBudget = typeof normalizeTransferBudgetState === 'function' ? normalizeTransferBudgetState(normalized.transferBudget, normalized) : (normalized.transferBudget || null);
  normalized.bankLoan = typeof normalizeBankLoanState === 'function' ? normalizeBankLoanState(normalized.bankLoan, normalized) : (normalized.bankLoan || null);
  normalized.nextSeasonTransferBudgetUnlock = (normalized.nextSeasonTransferBudgetUnlock && typeof normalized.nextSeasonTransferBudgetUnlock === 'object' && !Array.isArray(normalized.nextSeasonTransferBudgetUnlock)) ? normalized.nextSeasonTransferBudgetUnlock : null;
  normalized.playerCondition = normalized.playerCondition || {};
  seed.players.forEach(p => {
    if(Number(p.clubId || 0) === 0 || p.freeAgent) normalized.playerCondition[p.id] = 5;
    else if(!Number.isFinite(normalized.playerCondition[p.id])) normalized.playerCondition[p.id] = 99;
  });
  normalized.playerMorale = normalized.playerMorale || {};
  seed.players.forEach(p => {
    if(Number(p.clubId || 0) === 0 || p.freeAgent) normalized.playerMorale[p.id] = 5;
    else if(!Number.isFinite(normalized.playerMorale[p.id])) normalized.playerMorale[p.id] = PLAYER_MORALE_START;
  });
  normalized.playerSkillBoosts = normalized.playerSkillBoosts || {};
  normalized.playerAgeSkillPenalties = (normalized.playerAgeSkillPenalties && typeof normalized.playerAgeSkillPenalties === 'object' && !Array.isArray(normalized.playerAgeSkillPenalties)) ? normalized.playerAgeSkillPenalties : {};
  normalized.trainingPlan = normalized.trainingPlan || {};
  normalized.trainingSchedule = normalizeTrainingSchedule(normalized.trainingSchedule);
  seed.players.forEach(p => {
    const agePenalty = Math.round(Number(p.age || 18)) < PLAYER_AGE_DECAY_START_AGE
      ? 0
      : clamp(Math.round(Number(normalized.playerAgeSkillPenalties[p.id] || 0)), 0, PLAYER_AGE_DECAY_CAP);
    if(agePenalty > 0) normalized.playerAgeSkillPenalties[p.id] = agePenalty;
    else delete normalized.playerAgeSkillPenalties[p.id];
    normalized.trainingPlan[p.id] = safeIndividualTrainingType(normalized.trainingPlan[p.id]);
  });
  const skillBoostRepair = repairPlayerSkillBoostsForState(normalized, seed.players);
  const agePenaltyRepair = repairPlayerAgeSkillPenaltiesForState(normalized, seed.players);
  if(skillBoostRepair.normalized || skillBoostRepair.pruned || agePenaltyRepair.cleared || agePenaltyRepair.normalized || agePenaltyRepair.pruned) normalized._needsAutosave = true;
  normalized.staffActions = normalized.staffActions || {};
  normalized.staffContracts = normalizeStaffContracts(normalized.staffContracts || {});
  normalized.academy = normalizeAcademyState(normalized.academy);
  if(normalized.staffActions.motivationalTalk && !Number.isFinite(normalized.staffActions.motivationalTalk.globalTurn)){
    normalized.staffActions.motivationalTalk.globalTurn = ((Math.max(1, normalized.staffActions.motivationalTalk.season || normalized.seasonNumber || 1) - 1) * 53) + Number(normalized.staffActions.motivationalTalk.matchdayIndex || 0);
  }
  normalized.stadium = normalized.stadium || createInitialStadiumState();
  normalized.fans = normalized.fans || createInitialFanState();
  ensureFanState(normalized);
  if(normalized.founderMode && isFoundedClubId(normalized.selectedClubId)){
    const clubId = Number(normalized.selectedClubId);
    const club = seed.clubs.find(c => Number(c.id) === clubId);
    if(club){
      club.stadiumCapacity = Number.isFinite(Number(club.stadiumCapacity)) ? Math.round(Number(club.stadiumCapacity)) : FOUNDER_CLUB_INITIAL_CAPACITY;
      club.fansBase = Number.isFinite(Number(club.fansBase)) ? Math.round(Number(club.fansBase)) : FOUNDER_CLUB_INITIAL_FANS;
      club.budget = Number.isFinite(Number(club.budget)) ? Math.round(Number(club.budget)) : FOUNDER_CLUB_INITIAL_BUDGET;
    }
    normalized.fans.clubs[clubId] = normalized.fans.clubs[clubId] || { base:FOUNDER_CLUB_INITIAL_FANS, current:FOUNDER_CLUB_INITIAL_FANS, lastDelta:0, lastReason:'Modo fundador' };
  }
  if(normalized.bankruptcyMode){
    const clubId = Number(normalized.selectedClubId);
    const club = seed.clubs.find(c => Number(c.id) === clubId);
    if(club){
      const prestige = Number(normalized.bankruptcy?.reducedPrestige || club.reputation || 1);
      club.reputation = clamp(Math.round(prestige), 1, 99);
      club.managerPrestige = clamp(Math.round(prestige), 1, 99);
      club.stadiumCapacity = BANKRUPTCY_INITIAL_CAPACITY;
      club.budget = Number.isFinite(Number(normalized.clubBudgets?.[clubId])) ? Math.round(Number(normalized.clubBudgets[clubId])) : BANKRUPTCY_INITIAL_BUDGET;
      club.fieldConditionScore = Number.isFinite(Number(club.fieldConditionScore)) ? Math.round(Number(club.fieldConditionScore)) : BANKRUPTCY_INITIAL_FIELD;
    }
    normalized.fans.clubs[clubId] = normalized.fans.clubs[clubId] || { base:0, current:0, lastDelta:0, lastReason:'Modo Bancarrota' };
    if(normalized.stadium){
      normalized.stadium.capacityOverrides = normalized.stadium.capacityOverrides || {};
      normalized.stadium.capacityOverrides[clubId] = Number.isFinite(Number(normalized.stadium.capacityOverrides[clubId])) ? Math.round(Number(normalized.stadium.capacityOverrides[clubId])) : BANKRUPTCY_INITIAL_CAPACITY;
      normalized.stadium.fields = normalized.stadium.fields || {};
      normalized.stadium.fields[clubId] = Number.isFinite(Number(normalized.stadium.fields[clubId])) ? Math.round(Number(normalized.stadium.fields[clubId])) : BANKRUPTCY_INITIAL_FIELD;
    }
  }
  normalized.sponsors = normalizeSponsorState(normalized.sponsors);
  normalized.teamCohesion = normalized.teamCohesion || {};
  normalized.lastMatchTactics = normalized.lastMatchTactics || {};
  const normalizedSeasonForDifficulty = Math.max(1, Math.round(Number(normalized.seasonNumber || 1)));
  if(!normalized.managerTacticalAdaptation || typeof normalized.managerTacticalAdaptation !== 'object' || Array.isArray(normalized.managerTacticalAdaptation) || Number(normalized.managerTacticalAdaptation.season || normalizedSeasonForDifficulty) !== normalizedSeasonForDifficulty){
    normalized.managerTacticalAdaptation = { season:normalizedSeasonForDifficulty, signature:'', streak:0, lastBonus:0, lastProspectiveStreak:0 };
  }
  if(!normalized.playerBenchedStreak || typeof normalized.playerBenchedStreak !== 'object' || Array.isArray(normalized.playerBenchedStreak) || Number(normalized.playerBenchedStreak.season || normalizedSeasonForDifficulty) !== normalizedSeasonForDifficulty){
    normalized.playerBenchedStreak = { season:normalizedSeasonForDifficulty, players:{} };
  }
  if(!normalized.playerBenchedStreak.players || typeof normalized.playerBenchedStreak.players !== 'object' || Array.isArray(normalized.playerBenchedStreak.players)){
    normalized.playerBenchedStreak.players = {};
  }
  normalized.botRosterRepairLog = Array.isArray(normalized.botRosterRepairLog) ? normalized.botRosterRepairLog : [];
  normalized.botBalanceLog = Array.isArray(normalized.botBalanceLog) ? normalized.botBalanceLog : [];
  seed.clubs.forEach(c => { if(!Number.isFinite(normalized.teamCohesion[c.id])) normalized.teamCohesion[c.id] = TEAM_COHESION_START; });
  if(!normalized.stadium.fields) normalized.stadium.fields = {};
  if(!normalized.stadium.projects) normalized.stadium.projects = {};
  if(!normalized.stadium.ticketPrices) normalized.stadium.ticketPrices = {};
  if(!normalized.stadium.capacityOverrides || typeof normalized.stadium.capacityOverrides !== 'object' || Array.isArray(normalized.stadium.capacityOverrides)) normalized.stadium.capacityOverrides = {};
  if(!Array.isArray(normalized.stadium.capacityDeteriorationHistory)) normalized.stadium.capacityDeteriorationHistory = [];
  if(!normalized.stadium.capacityRepairProjects || typeof normalized.stadium.capacityRepairProjects !== 'object' || Array.isArray(normalized.stadium.capacityRepairProjects)) normalized.stadium.capacityRepairProjects = {};
  if(!normalized.stadium.facilities || typeof normalized.stadium.facilities !== 'object' || Array.isArray(normalized.stadium.facilities)) normalized.stadium.facilities = {};
  if(typeof migrateManagerAcademyOwnershipForState === 'function') migrateManagerAcademyOwnershipForState(normalized);
  Object.keys(normalized.stadium.facilities).forEach(clubId => { normalized.stadium.facilities[clubId] = normalizeClubFacilitiesState(normalized.stadium.facilities[clubId]); });
  seed.clubs.forEach(c => {
    if(!Number.isFinite(normalized.stadium.fields[c.id])) normalized.stadium.fields[c.id] = Number.isFinite(c.fieldConditionScore) ? c.fieldConditionScore : initialFieldScore(c);
    if(!Number.isFinite(Number(normalized.stadium.ticketPrices[c.id]))) normalized.stadium.ticketPrices[c.id] = TICKET_PRICE_INITIAL;
    normalized.stadium.ticketPrices[c.id] = clamp(Math.round(Number(normalized.stadium.ticketPrices[c.id])), TICKET_PRICE_MIN, TICKET_PRICE_MAX);
  });
  repairInvalidBotFieldStates(normalized, 'normalize_game', { message:true });
  repairInvalidClubWorldCupParticipationPrizeForState(normalized);
  Object.values(normalized.playerStats).forEach(stat => normalizePlayerStatRecord(stat));
  Object.values(normalized.playerCareerStats || {}).forEach(stat => normalizePlayerStatRecord(stat));
  repairLegacySeasonStartAvailability(normalized);
  return normalized;
}

function ensurePlayerStateForAll(){
  if(!game) return;
  normalizeAllPlayerPositions();
  game.playerCondition = game.playerCondition || {};
  game.playerMorale = game.playerMorale || {};
  game.playerSkillBoosts = game.playerSkillBoosts || {};
  game.playerAgeSkillPenalties = (game.playerAgeSkillPenalties && typeof game.playerAgeSkillPenalties === 'object' && !Array.isArray(game.playerAgeSkillPenalties)) ? game.playerAgeSkillPenalties : {};
  game.trainingPlan = game.trainingPlan || {};
  game.trainingSchedule = normalizeTrainingSchedule(game.trainingSchedule);
  game.playerStats = game.playerStats || {};
  game.playerCareerStats = game.playerCareerStats && typeof game.playerCareerStats === 'object' && !Array.isArray(game.playerCareerStats) ? game.playerCareerStats : {};
  seed.players.forEach(p => {
    ensurePlayerEconomics(p, p.youthFreeAgent ? FREE_YOUTH_SALARY_FACTOR : (p.freeAgent ? MARKET_FREE_AGENT_SALARY_FACTOR : 1));
    if(Number(p.clubId || 0) === 0 || p.freeAgent){ game.playerCondition[p.id] = 5; }
    else if(!Number.isFinite(game.playerCondition[p.id])) game.playerCondition[p.id] = 99;
    if(Number(p.clubId || 0) === 0 || p.freeAgent){ game.playerMorale[p.id] = 5; }
    else if(!Number.isFinite(game.playerMorale[p.id])) game.playerMorale[p.id] = PLAYER_MORALE_START;
    const agePenalty = Math.round(Number(p.age || 18)) < PLAYER_AGE_DECAY_START_AGE
      ? 0
      : clamp(Math.round(Number(game.playerAgeSkillPenalties[p.id] || 0)), 0, PLAYER_AGE_DECAY_CAP);
    if(agePenalty > 0) game.playerAgeSkillPenalties[p.id] = agePenalty;
    else delete game.playerAgeSkillPenalties[p.id];
    game.trainingPlan[p.id] = safeIndividualTrainingType(game.trainingPlan[p.id]);
    if(!game.playerStats[p.id]) game.playerStats[p.id] = createEmptyPlayerStat(p);
    normalizePlayerStatRecord(game.playerStats[p.id], p);
    if(game.playerCareerStats[p.id]) normalizePlayerStatRecord(game.playerCareerStats[p.id], p);
  });
  const skillBoostRepair = repairPlayerSkillBoostsForState(game, seed.players);
  const agePenaltyRepair = repairPlayerAgeSkillPenaltiesForState(game, seed.players);
  if(skillBoostRepair.normalized || skillBoostRepair.pruned || agePenaltyRepair.cleared || agePenaltyRepair.normalized || agePenaltyRepair.pruned) game._needsAutosave = true;
}

function tacticLocationOfPlayer(playerId){
  game.tactic = normalizeTactic(game.selectedClubId, game.tactic);
  const id = Number(playerId || 0);
  const starterIndex = (game.tactic.starters || []).map(Number).indexOf(id);
  if(starterIndex >= 0){
    if(typeof isCustomTactic === 'function' && isCustomTactic(game.tactic)){
      return { type:'custom', index:starterIndex, cellId:String(game.tactic.customSlots?.[starterIndex] || ''), playerId:id };
    }
    return { type:'starter', index:starterIndex, playerId:id };
  }
  const benchIndex = (game.tactic.bench || []).map(Number).indexOf(id);
  if(benchIndex >= 0) return { type:'bench', index:benchIndex, playerId:id };
  return { type:'reserve', index:-1, playerId:id };
}
function tacticLocationLabel(location){
  if(!location) return '';
  if(location.type === 'starter' || location.type === 'custom') return `titular ${Number(location.index || 0) + 1}`;
  if(location.type === 'bench') return `suplente ${Number(location.index || 0) + 1}`;
  return 'reserva';
}
function targetSlotLabel(location){
  if(!location) return '';
  if(location.type === 'custom' || location.type === 'custom-cell'){
    const role = typeof customTacticCellRole === 'function' ? customTacticCellRole(location.cellId || game?.tactic?.customSlots?.[location.index]) : 'puesto';
    return `${role} ${Number(location.index || 0) + 1}`;
  }
  if(location.type === 'starter'){
    const slot = (FORMATIONS[game?.tactic?.formation] || FORMATIONS['4-4-2'])[location.index] || 'puesto';
    return `${slot} ${Number(location.index || 0) + 1}`;
  }
  return tacticLocationLabel(location);
}
function validateTacticPlacement(playerId, location){
  const id = Number(playerId || 0);
  if(!id || !location) return '';
  if(location.type === 'starter' || location.type === 'custom' || location.type === 'custom-cell'){
    if(!canBeStarter(id)) return 'Los lesionados no pueden ser titulares. Los de recuperación menor a 70 días sólo pueden ir al banco.';
    const player = playerById(id);
    const slot = location.type === 'starter'
      ? (FORMATIONS[game?.tactic?.formation] || FORMATIONS['4-4-2'])[location.index]
      : (typeof customTacticCellRole === 'function' ? customTacticCellRole(location.cellId || game?.tactic?.customSlots?.[location.index]) : 'MC');
    if(!canAssignPlayerToSlot(player, slot)) return slot === 'POR' ? 'El puesto de portero sólo acepta porteros, salvo emergencia real cuando el plantel no tiene ningún POR.' : 'Los porteros sólo pueden ocupar el puesto de portero.';
  }
  if(location.type === 'bench' && !canBeBench(id)) return 'Sólo se pueden convocar al banco jugadores disponibles o lesionados con recuperación menor a 70 días.';
  return '';
}
function setTacticPlayerAt(location, playerId){
  const id = Number(playerId || 0);
  if(location.type === 'starter' || location.type === 'custom'){
    while(game.tactic.starters.length < 11) game.tactic.starters.push(0);
    game.tactic.starters[location.index] = id;
  } else if(location.type === 'bench'){
    while(game.tactic.bench.length <= location.index) game.tactic.bench.push(0);
    game.tactic.bench[location.index] = id;
  }
}
function clearTacticLocation(location){
  if(!location) return;
  if(location.type === 'starter' || location.type === 'custom'){
    while(game.tactic.starters.length < 11) game.tactic.starters.push(0);
    game.tactic.starters[location.index] = 0;
  } else if(location.type === 'bench'){
    while(game.tactic.bench.length <= location.index) game.tactic.bench.push(0);
    game.tactic.bench[location.index] = 0;
  }
}
function cleanupTacticAfterClickSwap(){
  const starterIds = new Set((game.tactic.starters || []).map(Number).filter(Boolean));
  game.tactic.bench = (game.tactic.bench || [])
    .map(Number)
    .filter((id, index, arr) => id && !starterIds.has(id) && arr.indexOf(id) === index)
    .slice(0,10);
  game.tactic.autoSubs = (game.tactic.autoSubs || []).map(rule => ({
    ...rule,
    outId:game.tactic.starters.includes(Number(rule.outId)) ? Number(rule.outId) : 0,
    inId:game.tactic.bench.includes(Number(rule.inId)) ? Number(rule.inId) : 0
  }));
  game.tactic = ensureTacticCaptain(applyStarterMentalities(game.tactic), game.selectedClubId);
}
function swapTacticClickTargets(source, target){
  if(!game || !source || !target || !source.playerId) return false;
  game.tactic = applyStarterMentalities(normalizeTactic(game.selectedClubId, game.tactic));
  if(target.type === 'custom-cell' && typeof customTacticMoveSelectedToCell === 'function') return customTacticMoveSelectedToCell(target.cellId);
  const sourcePlayerId = Number(source.playerId || 0);
  const targetPlayerId = Number(target.playerId || 0);
  if(sourcePlayerId && targetPlayerId && sourcePlayerId === targetPlayerId){
    tacticClickSelection = null;
    renderTactics();
    return false;
  }
  if(source.type === 'reserve' && target.type === 'reserve'){
    showNotice('Ambos jugadores ya están en reserva. Elegí un titular o suplente para intercambiarlos.');
    tacticClickSelection = null;
    renderTactics();
    return false;
  }
  const sourceCurrent = tacticLocationOfPlayer(sourcePlayerId);
  const targetCurrent = targetPlayerId ? tacticLocationOfPlayer(targetPlayerId) : target;
  const sourceError = validateTacticPlacement(sourcePlayerId, targetCurrent);
  if(sourceError){ showNotice(sourceError); return false; }
  const targetError = targetPlayerId ? validateTacticPlacement(targetPlayerId, sourceCurrent) : '';
  if(targetError){ showNotice(targetError); return false; }
  clearTacticLocation(sourceCurrent);
  clearTacticLocation(targetCurrent);
  setTacticPlayerAt(targetCurrent, sourcePlayerId);
  if(targetPlayerId) setTacticPlayerAt(sourceCurrent, targetPlayerId);
  cleanupTacticAfterClickSwap();
  saveLocal(true);
  const sourceName = playerLastName(playerById(sourcePlayerId)?.name || 'Jugador');
  const targetName = targetPlayerId ? playerLastName(playerById(targetPlayerId)?.name || 'jugador') : targetSlotLabel(targetCurrent);
  showNotice(`${sourceName} intercambió lugar con ${targetName}. Guardá la táctica para confirmar.`);
  tacticClickSelection = null;
  renderTactics();
  return true;
}
function normalizeTactic(clubId, tactic){
  const base = {...DEFAULT_TACTIC, ...(tactic || {})};
  const layoutMode = typeof normalizeTacticLayoutMode === 'function' ? normalizeTacticLayoutMode(base.layoutMode) : 'preset';
  const formation = FORMATIONS[base.formation] ? base.formation : DEFAULT_TACTIC.formation;
  const squad = playersByClub(clubId);
  const squadIds = new Set(squad.map(p => p.id));
  const rawStarters = Array.isArray(base.starters) ? base.starters.map(Number) : [];
  let starters = rawStarters.length >= 11
    ? rawStarters.slice(0,11).map(id => squadIds.has(id) ? id : 0)
    : autoSelectStarters(clubId, { ...base, formation }).map(p => p.id);
  while(starters.length < 11) starters.push(0);
  const customSlots = typeof normalizeCustomTacticSlots === 'function'
    ? normalizeCustomTacticSlots(base.customSlots, { ...base, formation, starters })
    : [];
  let bench = (base.bench || []).map(Number).filter(id => squadIds.has(id) && !starters.includes(id));
  if(bench.length !== 10){ bench = autoSelectBench(clubId, starters.filter(Boolean)).map(p => p.id); }
  let autoSubs = Array.isArray(base.autoSubs) ? base.autoSubs.slice(0,5) : [];
  autoSubs = autoSubs.map(rule => {
    const legacy = ['winning','losing','drawing'].includes(rule.trigger) ? 'best' : rule.trigger;
    return {
      outId: Number(rule.outId || 0),
      inId: Number(rule.inId || 0),
      trigger: SUB_TRIGGERS.some(t => t.value === legacy) ? legacy : 'tired'
    };
  }).filter(rule => starters.includes(rule.outId) && bench.includes(rule.inId));
  while(autoSubs.length < 5){ autoSubs.push({ outId:0, inId:0, trigger:'tired' }); }
  const matchInstructions = window.Simulator20?.normalizeMatchInstructions
    ? window.Simulator20.normalizeMatchInstructions(base.matchInstructions)
    : { winning:'normal', drawing:'normal', losing:'normal' };
  const sectorStyles = normalizeSectorStyles(base.sectorStyles);
  const goalkeeperDistribution = window.Simulator20?.normalizeGoalkeeperDistribution
    ? window.Simulator20.normalizeGoalkeeperDistribution(base.goalkeeperDistribution)
    : (['short','long','varied'].includes(String(base.goalkeeperDistribution || '')) ? String(base.goalkeeperDistribution) : 'varied');
  const buildUpStyle = window.Simulator20?.normalizeBuildUpStyle
    ? window.Simulator20.normalizeBuildUpStyle(base.buildUpStyle)
    : (['possession','direct','counter','long_ball'].includes(String(base.buildUpStyle || '')) ? String(base.buildUpStyle) : 'possession');
  const captainSelectionMode = typeof normalizeCaptainSelectionMode === 'function' ? normalizeCaptainSelectionMode(base.captainSelectionMode) : 'automatic';
  const normalized = { formation, layoutMode, customSlots, captainId:0, captainSelectionMode, starters, bench, autoSubs, playerMentalities:{ ...(game?.playerMentalities || {}), ...(base.playerMentalities || {}) }, matchInstructions, sectorStyles, goalkeeperDistribution, buildUpStyle };
  normalized.captainId = normalizedCaptainIdForTactic(clubId, { ...normalized, captainId:base.captainId, captainSelectionMode });
  return applyStarterMentalities(normalized);
}


function bankruptcyModeEnabled(){ return Boolean(BANKRUPTCY_MODE_ENABLED); }
function currentGameIsBankruptcyMode(){ return Boolean(game?.bankruptcyMode || game?.bankruptcy?.active); }
function bankruptcyReducedPrestige(originalPrestige){
  const value = Math.max(1, Math.round(Number(originalPrestige || 0) * (1 - Number(BANKRUPTCY_PRESTIGE_REDUCTION || 0))));
  return clamp(value, 1, 99);
}
function bankruptcyReleasePlayer(player, reason='Modo Bancarrota'){
  if(!player) return null;
  const previousClubId = Number(player.clubId || 0);
  if(typeof setPlayerClubId === 'function') setPlayerClubId(player, 0);
  else player.clubId = 0;
  player.freeAgent = true;
  player.bankruptcyReleased = true;
  player.origin = player.origin || reason;
  if(typeof refreshPlayerClause === 'function') refreshPlayerClause(player);
  if(typeof recordTransferHistory === 'function') recordTransferHistory(player, { fromClubId:previousClubId, toClubId:0, amount:0, kind:'bankruptcy_release', source:'bankruptcy' });
  return { ...player };
}
function bankruptcyPositionPriority(position){
  const group = typeof playerRoleGroup === 'function' ? playerRoleGroup(position) : String(position || '');
  if(group === 'POR') return 0;
  if(group === 'DEF') return 1;
  if(group === 'MID') return 2;
  return 3;
}
function selectBankruptcyLoyalPlayers(clubId){
  const squad = playersByClub(clubId).slice().sort((a,b)=>
    bankruptcyPositionPriority(a.position)-bankruptcyPositionPriority(b.position) ||
    visibleOverall(b)-visibleOverall(a) ||
    Number(a.salary || 0)-Number(b.salary || 0) ||
    Number(a.id)-Number(b.id)
  );
  const keep = new Set();
  const keepByGroup = (group, count) => {
    squad.filter(p => (typeof playerRoleGroup === 'function' ? playerRoleGroup(p.position) : '') === group && !keep.has(Number(p.id))).slice(0, count).forEach(p => keep.add(Number(p.id)));
  };
  keepByGroup('POR', BANKRUPTCY_LOYAL_GK_MIN);
  keepByGroup('DEF', 4);
  keepByGroup('MID', 4);
  keepByGroup('ATT', 3);
  squad.filter(p => !keep.has(Number(p.id))).sort((a,b)=>visibleOverall(b)-visibleOverall(a) || Number(a.salary || 0)-Number(b.salary || 0)).forEach(player => {
    if(keep.size < BANKRUPTCY_LOYAL_FIRST_TEAM_PLAYERS) keep.add(Number(player.id));
  });
  return keep;
}
function trimBankruptcyFirstTeam(clubId){
  const loyal = selectBankruptcyLoyalPlayers(clubId);
  const released = [];
  (seed?.players || []).forEach(player => {
    if(Number(player.clubId || 0) !== Number(clubId)) return;
    if(loyal.has(Number(player.id))){
      player.bankruptcyLoyal = true;
      player.joinedClubSeason = game?.seasonNumber || 1;
      return;
    }
    const free = bankruptcyReleasePlayer(player, 'Liberado por quiebra del club');
    if(free) released.push(free);
  });
  if(Array.isArray(game?.marketPlayers)){
    const existing = new Set(game.marketPlayers.map(p => Number(p.id)));
    released.forEach(player => { if(!existing.has(Number(player.id))){ game.marketPlayers.push({ ...player }); existing.add(Number(player.id)); } });
  }
  return { kept:loyal.size, released:released.length };
}
function bankruptcyAcademyGroupForIndex(index){
  if(index < BANKRUPTCY_ACADEMY_GK_MIN) return 'POR';
  const pattern = ['DEF','MED','DEL','DEF','MED','DEL','MED','DEF','DEL'];
  return pattern[(index - BANKRUPTCY_ACADEMY_GK_MIN) % pattern.length];
}
function createBankruptcyAcademyPlayers(count=BANKRUPTCY_ACADEMY_PLAYERS){
  const created = [];
  if(!game?.academy || typeof nextAcademyPlayerId !== 'function') return created;
  let id = nextAcademyPlayerId();
  for(let i=0;i<count;i++, id++){
    const group = bankruptcyAcademyGroupForIndex(i);
    const nationality = typeof academyNationality === 'function' ? academyNationality(id, { local:true }) : 'Argentina';
    const overall = typeof academyOverallRoll === 'function' ? academyOverallRoll(id, 16) : 10;
    const raw = {
      id,
      name:typeof academyName === 'function' ? academyName(id, nationality) : `Juvenil ${id}`,
      nationality,
      age:16,
      group,
      overall,
      skills:typeof academySkillsFor === 'function' ? academySkillsFor(group, overall, id) : {},
      status:'academy',
      source:'modo_bancarrota_renacer',
      bankruptcyYouth:true,
      joinedSeason:game?.seasonNumber || 1,
      joinedTurn:typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0
    };
    created.push(typeof normalizeAcademyPlayer === 'function' ? normalizeAcademyPlayer(raw) : raw);
  }
  game.academy.players.push(...created);
  created.forEach(player => { game.academy.trainingPlan[player.id] = game.academy.trainingPlan[player.id] || (typeof safeIndividualTrainingType === 'function' ? safeIndividualTrainingType(TRAINING_INDIVIDUAL_INITIAL) : 'balanced'); });
  return created;
}
function applyBankruptcyModeSetup(selectedClubId){
  if(!game || !bankruptcyModeEnabled()) return null;
  const club = seed.clubs.find(c => Number(c.id) === Number(selectedClubId));
  if(!club) return null;
  const original = {
    reputation:clubPrestigeValue(club),
    budget:Number(club.budget || 0),
    stadiumCapacity:typeof clubStadiumCapacity === 'function' ? clubStadiumCapacity(selectedClubId) : Number(club.stadiumCapacity || 0),
    fans:typeof clubFansCurrent === 'function' ? clubFansCurrent(selectedClubId) : Number(club.fansBase || 0),
    players:playersByClub(selectedClubId).length
  };
  const reducedPrestige = bankruptcyReducedPrestige(original.reputation);
  club.reputation = reducedPrestige;
  club.managerPrestige = reducedPrestige;
  club.budget = BANKRUPTCY_INITIAL_BUDGET;
  club.stadiumCapacity = BANKRUPTCY_INITIAL_CAPACITY;
  club.fieldConditionScore = BANKRUPTCY_INITIAL_FIELD;
  club.fieldCondition = typeof fieldConditionName === 'function' ? fieldConditionName(BANKRUPTCY_INITIAL_FIELD) : 'Óptimo';
  game.bankruptcyMode = true;
  game.bankruptcy = { active:true, label:'Bancarrota, Renacer', startedAt:{ season:game.seasonNumber || 1, date:game.currentDate || '', turn:game.globalTurn || 0 }, original, reducedPrestige, initialDebt:BANKRUPTCY_INITIAL_BUDGET };
  game.clubBudgets[selectedClubId] = BANKRUPTCY_INITIAL_BUDGET;
  game.budget = BANKRUPTCY_INITIAL_BUDGET;
  game.seasonInitialBudget = BANKRUPTCY_INITIAL_BUDGET;
  game.careerInitialBudget = BANKRUPTCY_INITIAL_BUDGET;
  game.seasonBudgetStartBySeason = { 1:BANKRUPTCY_INITIAL_BUDGET };
  if(game.stadium){
    game.stadium.capacityOverrides = game.stadium.capacityOverrides || {};
    game.stadium.fields = game.stadium.fields || {};
    game.stadium.capacityOverrides[selectedClubId] = BANKRUPTCY_INITIAL_CAPACITY;
    game.stadium.fields[selectedClubId] = BANKRUPTCY_INITIAL_FIELD;
  }
  if(typeof ensureFanState === 'function') ensureFanState(game);
  const reducedFans = Math.max(0, Math.round(Number(original.fans || 0) * (1 - Number(BANKRUPTCY_FANS_REDUCTION || 0))));
  if(game.fans?.clubs){
    game.fans.clubs[selectedClubId] = { ...(game.fans.clubs[selectedClubId] || {}), base:reducedFans, current:reducedFans, lastDelta:reducedFans - Number(original.fans || 0), lastReason:'Modo Bancarrota' };
  }
  const roster = trimBankruptcyFirstTeam(selectedClubId);
  const academyPlayers = createBankruptcyAcademyPlayers(BANKRUPTCY_ACADEMY_PLAYERS);
  game.bankruptcy.roster = roster;
  game.bankruptcy.academyPlayers = academyPlayers.length;
  game.tactic = normalizeTactic(selectedClubId, DEFAULT_TACTIC);
  if(game.managerStats){
    game.managerStats.currentSeason = applyManagerObjectiveSeasonFields(game.managerStats.currentSeason || {}, game.managerStats, 1, selectedClubId);
  }
  return game.bankruptcy;
}

function newGame(selectedClubId, options={}){
  const newGameSurnameVariety = typeof prepareNewGameSurnameVariety === 'function' ? prepareNewGameSurnameVariety(seed) : null;
  const selectedClub = seed.clubs.find(c => Number(c.id) === Number(selectedClubId)) || {};
  if(!options.ignorePrestige && !managerCanSelectClub(selectedClub, currentManagerPrestige())){
    showNotice(`Ese club requiere prestigio ${clubPrestigeValue(selectedClub)}. Tu prestigio actual es ${formatManagerPrestige(currentManagerPrestige())}.`);
    return;
  }
  const managerName = persistManagerName(options.managerName || storedManagerName());
  const saveSlotId = typeof normalizeSaveSlotId === 'function' ? normalizeSaveSlotId(options.saveSlotId || currentSaveSlotId || (options.challengeId ? SAVE_SLOT_CAMPO_DESTRUIDO : SAVE_SLOT_CAREER)) : (options.challengeId ? 'challenge:campo_destruido' : 'career');
  if(typeof setCurrentSaveSlot === 'function') setCurrentSaveSlot(saveSlotId);
  const tactic = normalizeTactic(selectedClubId, DEFAULT_TACTIC);
  const initialFixtureSeedIndex = typeof leagueFixtureSeedIndexForSeasonNumber === 'function' ? leagueFixtureSeedIndexForSeasonNumber(1) : 0;
  game = {
    version:APP_VERSION,
    saveSlotId,
    seedSignature:seed?.meta?.signature || '',
    selectedClubId,
    selectedCountry: options.country || clubCountry(selectedClub),
    selectedLeagueId: options.leagueId || selectedClub.divisionId || 'default',
    playerMentalities: {},
    savedTactics: normalizeSavedTacticsState({}),
    savedTrainingPlans: normalizeSavedTrainingPlansState({}),
    standingsHistory: normalizeStandingsHistoryState({}),
    competitionChampionsHistory: normalizeCompetitionChampionsHistoryState({}),
    playerPalmares: normalizePlayerPalmaresState({ trackingStartedVersion:'V9.22', trackingStartedSeason:1, migrationVersion:1 }),
    clubWorldCupHistory: normalizeClubWorldCupHistoryState({}),
    libertadoresHistory: typeof normalizeLibertadoresHistoryState === 'function' ? normalizeLibertadoresHistoryState({}) : { version:1, editions:[] },
    libertadores: typeof normalizeLibertadoresState === 'function' ? normalizeLibertadoresState({}, 1, seasonYearForNumber(1)) : null,
    championsLeagueHistory: typeof normalizeChampionsLeagueHistoryState === 'function' ? normalizeChampionsLeagueHistoryState({}) : { version:1, editions:[] },
    championsLeague: typeof normalizeChampionsLeagueState === 'function' ? normalizeChampionsLeagueState({}, 1, seasonYearForNumber(1)) : null,
    saveCode: generateSaveCode(),
    rankingUploads: {},
    rankingManagerName: managerName,
    rankingLastUploadGameDate: '',
    rankingLastManualUploadGameDate: '',
    rankingLastAutomaticUploadGameDate: '',
    rankingScheduledCareerUploads: { version:2, events:{} },
    rankingCareerActivitySync: { version:1, status:'idle', lastSuccessGameDate:'', lastSuccessAt:'', lastFingerprint:'', lastAttemptAt:'', lastAttemptGameDate:'', lastReason:'', error:'', attempts:0, loginPromptSent:false },
    manualRetiredPlayerIds: [],
    retiredPlayerPool: [],
    surnameVarietyVersion: typeof PLAYER_SURNAME_VARIETY_VERSION !== 'undefined' ? PLAYER_SURNAME_VARIETY_VERSION : 'V8.17-surnames-x10',
    surnameVarietyAppliedAtSeason: 1,
    surnameVarietySummary: newGameSurnameVariety ? { changed:Number(newGameSurnameVariety.changed || 0), excluded:Number(newGameSurnameVariety.excluded || 0), references:0 } : null,
    professionalQualityScaleVersion: typeof PROFESSIONAL_QUALITY_SCALE_VERSION !== 'undefined' ? PROFESSIONAL_QUALITY_SCALE_VERSION : 'V8.08',
    professionalQualityScaleAppliedAtSeason: 1,
    seasonNumber: 1,
    seasonYear: seasonYearForNumber(1),
    calendarVersion: SEASON_CALENDAR_VERSION,
    leagueFixtureSeedIndex: initialFixtureSeedIndex,
    leagueFixtureSeedVersion: typeof LEAGUE_FIXTURE_SEED_VERSION !== 'undefined' ? LEAGUE_FIXTURE_SEED_VERSION : 'v970-20-seeds',
    leagueFixtureSeedHistory: { 1:initialFixtureSeedIndex },
    seasonFinalized: false,
    seasonTransition: null,
    seasonPhase: 'preseason',
    phaseTurn: 0,
    postseasonStartDate: '',
    postseasonTotalTurns: 0,
    globalTurn: 0,
    preseasonFriendliesPlayed: 0,
    pendingFriendlyOpponentId: 0,
    clubDivisionOverrides: {},
    leagueSeasonEconomy: { version:1, seasons:{} },
    managerStats: ensureManagerCurrentSeasonStats(createInitialManagerStats(), 1, selectedClubId),
    managerPhilosophy: typeof createInitialManagerPhilosophyState === 'function' ? createInitialManagerPhilosophyState() : null,
    assistantCoachAnalysis: typeof createInitialAssistantCoachAnalysisState === 'function' ? createInitialAssistantCoachAnalysisState() : null,
    gameOver: null,
    messages: [],
    eventLog: [],
    playerStars: createInitialPlayerStarsState(),
    playerImpactWindows: {},
    special: typeof createInitialSpecialState === 'function' ? createInitialSpecialState(managerName) : null,
    marketPlayers: [],
    transferHistory: { version:'V8.99', nextId:1, entries:[] },
    eliteBotMarket: { version:'V9.00', season:1, lastFreeReviewDate:'', lastTransferReviewDate:'', clubSeasonSignings:{}, log:[] },
    pendingTransfers: [],
    rejectedPurchaseOffers: {},
    rejectedFreeAgentOffers: {},
    scoutingCenter: {},
    monthlyExpenses: {},
    lastOwnPlayerOffer: null,
    seasonEndPlayerOffers: null,
    specialClauseOffers: null,
    currentDate: firstAdvanceDateForSeason(seasonYearForNumber(1)),
    matchdayIndex: 0,
    tactic,
    captaincyProgress: {},
    captaincyAppliedMatches: {},
    lastCaptaincyEffect: null,
    standings: createInitialStandings(),
    playerStats: createInitialPlayerStats(),
    playerCareerStats: createInitialPlayerCareerStats(),
    managerPlayerStatsHistory: createInitialManagerPlayerStatsHistory(),
    playerStatus: {},
    statusRebases: {},
    injuryRecoveryTurnsBySeason: {},
    matchHistory: [],
    fixtures: generateFixturesForDivisions(seed.clubs, divisionOrderList(), { seasonYear:seasonYearForNumber(1), fixtureSeedIndex:initialFixtureSeedIndex }),
    advanceLockedUntil: 0,
    advanceLockDurationMs: ADVANCE_LOCK_MS,
    mustReviewTactics: false,
    lastOwnProblems: [],
    lastTurnSummary: null,
    clubBudgets: Object.fromEntries(seed.clubs.map(c => [c.id, Math.round(Number(c.budget || 0))])),
    budget: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0,
    seasonInitialBudget: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0,
    careerInitialBudget: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0,
    seasonBudgetStartBySeason: { 1: seed.clubs.find(c=>c.id===selectedClubId)?.budget || 0 },
    lastBudgetDelta: 0,
    budgetHistory: [],
    transferBudget: typeof createTransferBudgetState === 'function' ? createTransferBudgetState(selectedClubId, 1, 0) : null,
    bankLoan: typeof createBankLoanState === 'function' ? createBankLoanState(1) : null,
    nextSeasonTransferBudgetUnlock: null,
    playerCondition: Object.fromEntries(seed.players.map(p => [p.id, 99])),
    playerMorale: Object.fromEntries(seed.players.map(p => [p.id, PLAYER_MORALE_START])),
    playerSkillBoosts: {},
    playerAgeSkillPenalties: {},
    trainingPlan: Object.fromEntries(seed.players.map(p => [p.id, safeIndividualTrainingType(TRAINING_INDIVIDUAL_INITIAL)])),
    trainingSchedule: defaultTrainingSchedule(),
    staffActions: {},
    staffContracts: {},
    academy: createInitialAcademyState(),
    stadium: createInitialStadiumState(),
    fans: createInitialFanState(),
    sponsors: createInitialSponsorState(),
    teamCohesion: Object.fromEntries(seed.clubs.map(c => [c.id, TEAM_COHESION_START])),
    lastMatchTactics: {},
    managerTacticalAdaptation: { season:1, signature:'', streak:0, lastBonus:0, lastProspectiveStreak:0 },
    playerBenchedStreak: { season:1, players:{} },
    founderMode: Boolean(options.founderMode),
    founderClubId: options.founderMode ? Number(selectedClubId) : 0,
    founderReplacedClub: options.founderReplacedClub || null,
    founderGoals: null,
    founderAdministrativeCosts: {},
    bankruptcyMode: Boolean(options.bankruptcyMode),
    bankruptcy: null,
    challenge: null
  };
  if(typeof applySharedManagerProfileToGame === 'function') applySharedManagerProfileToGame({ reason:'new_game' });
  const newClubSpecialReset = typeof resetActiveSpecialCardsToReserveForNewClub === 'function' ? resetActiveSpecialCardsToReserveForNewClub({ reason:'new_game' }) : null;
  assignInitialBotFieldStates(selectedClubId);
  if(options.founderMode){
    const selected = seed.clubs.find(c => Number(c.id) === Number(selectedClubId));
    if(selected){
      selected.budget = FOUNDER_CLUB_INITIAL_BUDGET;
      selected.stadiumCapacity = FOUNDER_CLUB_INITIAL_CAPACITY;
      selected.fansBase = FOUNDER_CLUB_INITIAL_FANS;
      selected.reputation = FOUNDER_CLUB_REPUTATION;
      selected.managerPrestige = FOUNDER_CLUB_REPUTATION;
    }
    game.clubBudgets[selectedClubId] = FOUNDER_CLUB_INITIAL_BUDGET;
    game.budget = FOUNDER_CLUB_INITIAL_BUDGET;
    game.seasonInitialBudget = FOUNDER_CLUB_INITIAL_BUDGET;
    game.careerInitialBudget = FOUNDER_CLUB_INITIAL_BUDGET;
    game.seasonBudgetStartBySeason = { 1: FOUNDER_CLUB_INITIAL_BUDGET };
    game.stadium.capacityOverrides[selectedClubId] = FOUNDER_CLUB_INITIAL_CAPACITY;
    game.stadium.fields[selectedClubId] = FOUNDER_CLUB_INITIAL_FIELD;
    game.fans.clubs[selectedClubId] = { base:FOUNDER_CLUB_INITIAL_FANS, current:FOUNDER_CLUB_INITIAL_FANS, lastDelta:0, lastReason:'Modo fundador' };
  }
  game.marketPlayers = generateMarketPlayers(MARKET_FREE_AGENT_COUNT);
  if(options.bankruptcyMode) applyBankruptcyModeSetup(selectedClubId, options);
  if(options.founderMode) ensureFounderFreeAgentPool(options.founderReleasedPlayers || []);
  else mergeMarketPlayersIntoSeed(game.marketPlayers);
  ensurePlayerStateForAll();
  repairBotRosters({ reason: options.founderMode ? 'founder_new_game' : (options.challengeId ? 'challenge_new_game' : 'new_game') });
  if(options.challengeId && typeof applyChallengePreset === 'function') applyChallengePreset(options.challengeId, selectedClubId);
  if(typeof ensureLeagueSeasonEconomyForSeason === 'function') ensureLeagueSeasonEconomyForSeason(game, 1, { force:true, reason:'new_game' });
  generateOpeningSponsorOffers(true);
  if(options.founderMode){
    ensureFounderGoalsState();
    pushGameMessage({ type:'fundador', title:'Club fundado desde cero', body:`Fundaste ${clubName(selectedClubId)}. El club empieza sin jugadores, sin presupuesto, con estadio de capacidad 0, prestigio ${FOUNDER_CLUB_REPUTATION} y ${formatPlainNumber(FOUNDER_CLUB_INITIAL_FANS)} hinchas. No tendrás objetivos de directiva ni riesgo de despido.`, priority:'high' });
    pushGameMessage({ type:'fundador', title:`Primera meta: ${game.founderGoals.current.title}`, body:game.founderGoals.current.description, priority:'normal' });
  } else if(options.bankruptcyMode) {
    const info = game.bankruptcy || {};
    pushGameMessage({ type:'directiva', title:'Bancarrota, Renacer', body:`Aceptaste refundar ${clubName(selectedClubId)} tras la quiebra. El club quedó con deuda extrema, sin estadio disponible, menor prestigio, menos hinchas, un plantel reducido de jugadores leales y una camada de juveniles de 16 años en Academia. La primera temporada la directiva sólo exige no descender.`, priority:'high' });
    if(info.roster){
      pushGameMessage({ type:'mercado', title:'Plantel reducido por la crisis', body:'Parte del plantel se marchó como agente libre. Los jugadores que permanecieron serán la base deportiva inmediata mientras formás juveniles y recuperás ingresos.', priority:'normal' });
    }
  } else if(options.challengeId) {
    pushGameMessage({ type:'reto', title:'Reto activo', body:'La partida empezó desde un escenario predeterminado. Revisá las reglas del reto en Inicio antes de avanzar.', priority:'high' });
  } else {
    pushGameMessage({ type:'directiva', title:'La directiva te da la bienvenida', body:'La temporada está por comenzar. La dirigencia espera que revises la táctica, el mercado y la situación del plantel antes del debut.', priority:'normal' });
  }
  const initialLeagueEconomyText = typeof leagueSeasonEconomyMessageForClub === 'function' ? leagueSeasonEconomyMessageForClub(selectedClubId, 1) : '';
  if(initialLeagueEconomyText){
    pushGameMessage({ type:'finanzas', title:'Economía anual de la liga', body:initialLeagueEconomyText, priority:'normal', id:`league-economy-1-${selectedClubId}` });
  }
  if(newClubSpecialReset?.returned){
    pushGameMessage({ type:'especial', title:'Cartas activas devueltas', body:`Al comenzar en un nuevo club, ${newClubSpecialReset.returned} carta(s) activa(s) volvieron a la reserva. Los usos consumidos se conservaron.`, priority:'normal' });
  }
  if(typeof queueInitialAssistantAdviceMessages === 'function') queueInitialAssistantAdviceMessages();
  if(typeof runScheduledSeasonGameVerifier === 'function') runScheduledSeasonGameVerifier({ reason:'new_game_day_1', scheduledDay:1, silent:true });
  activeTab = 'home';
  closeModal();
  renderAll();
  if(typeof saveLocal === 'function') saveLocal(true).catch?.(()=>{});
  showNotice(options.founderMode ? 'Club fundado. Armá el plantel desde Mercado antes de competir.' : (options.bankruptcyMode ? 'Modo Bancarrota iniciado. Revisá Finanzas, Academia, Estadio y Táctica antes de avanzar.' : (options.challengeId ? 'Reto creado. Dirigí los 5 partidos y buscá el campeonato.' : 'Carrera creada. Revisá táctica, titulares y mentalidades antes de avanzar.')));
}

function createInitialStandings(){
  const obj = {};
  seed.clubs.forEach(c => obj[c.id] = { clubId:c.id, pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 });
  return obj;
}
function createEmptyPlayerStat(player={}){
  return {
    playerId:Math.max(0, Math.round(Number(player.id || player.playerId || 0))),
    clubId:Math.max(0, Math.round(Number(player.clubId || 0))),
    played:0,
    starts:0,
    minutes:0,
    goals:0,
    assists:0,
    yellow:0,
    red:0,
    injuries:0,
    keySaves:0,
    goalsConceded:0,
    cleanSheets:0,
    errors:0,
    goalErrors:0,
    ratingTotal:0,
    ratedMatches:0,
    lastRating:0
  };
}
const PLAYER_STAT_INTEGER_FIELDS = ['played','starts','minutes','goals','assists','yellow','red','injuries','keySaves','goalsConceded','cleanSheets','errors','goalErrors','ratedMatches'];
function normalizePlayerStatRecord(stat, player=null){
  if(!stat || typeof stat !== 'object' || Array.isArray(stat)) return stat;
  const fallbackPlayer = player || playerById(stat.playerId);
  stat.playerId = Math.max(0, Math.round(Number(stat.playerId || fallbackPlayer?.id || 0)));
  stat.clubId = Math.max(0, Math.round(Number(fallbackPlayer?.clubId ?? stat.clubId ?? 0)));
  PLAYER_STAT_INTEGER_FIELDS.forEach(key => {
    stat[key] = Math.max(0, Math.round(Number(stat[key] || 0)));
  });
  stat.ratingTotal = Math.round(Math.max(0, Number(stat.ratingTotal || 0)) * 1000) / 1000;
  stat.lastRating = Number.isFinite(Number(stat.lastRating)) ? Math.round(clamp(Number(stat.lastRating), 0, 10) * 10) / 10 : 0;
  return stat;
}
function createInitialPlayerStats(){
  const obj = {};
  seed.players.forEach(p => obj[p.id] = createEmptyPlayerStat(p));
  return obj;
}
function playerCareerStatFromSeason(player, seasonStat=null){
  const record = { ...createEmptyPlayerStat(player), ...(seasonStat && typeof seasonStat === 'object' ? seasonStat : {}) };
  record.playerId = Number(player?.id || record.playerId || 0);
  record.clubId = Number(player?.clubId ?? record.clubId ?? 0);
  return normalizePlayerStatRecord(record, player);
}
function playerStatHasActivity(stat){
  if(!stat || typeof stat !== 'object' || Array.isArray(stat)) return false;
  return PLAYER_STAT_INTEGER_FIELDS.some(key => Number(stat[key] || 0) > 0)
    || Number(stat.ratingTotal || 0) > 0
    || Number(stat.lastRating || 0) > 0;
}
function createInitialPlayerCareerStats(){
  return {};
}
function normalizePlayerCareerStats(raw, seasonStats={}){
  const validRaw = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const migrateFromCurrentSeason = Object.keys(validRaw).length === 0;
  const activeById = new Map(seed.players.map(player => [Number(player.id), player]));
  const out = {};
  Object.entries(validRaw).forEach(([key, value]) => {
    const player = activeById.get(Number(value?.playerId || key || 0));
    if(!player || !playerStatHasActivity(value)) return;
    out[player.id] = playerCareerStatFromSeason(player, value);
  });
  if(migrateFromCurrentSeason){
    Object.entries(seasonStats || {}).forEach(([key, value]) => {
      const player = activeById.get(Number(value?.playerId || key || 0));
      if(!player || !playerStatHasActivity(value)) return;
      out[player.id] = playerCareerStatFromSeason(player, value);
    });
  }
  return out;
}
function createInitialManagerPlayerStatsHistory(){
  return { version:1, seasons:{} };
}
function normalizeManagerPlayerStatsEntry(raw, fallbackId=0){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const playerId = Math.max(0, Math.round(Number(src.playerId || fallbackId || 0)));
  return {
    playerId,
    name:String(src.name || src.playerName || playerById(playerId)?.name || 'Jugador'),
    position:String(src.position || playerById(playerId)?.position || '—'),
    played:Math.max(0, Math.round(Number(src.played || 0))),
    goals:Math.max(0, Math.round(Number(src.goals || 0))),
    assists:Math.max(0, Math.round(Number(src.assists || 0))),
    injuries:Math.max(0, Math.round(Number(src.injuries || 0))),
    yellow:Math.max(0, Math.round(Number(src.yellow || 0))),
    red:Math.max(0, Math.round(Number(src.red || 0))),
    ratingTotal:Math.max(0, Number(src.ratingTotal || 0)),
    ratedMatches:Math.max(0, Math.round(Number(src.ratedMatches || 0))),
    lastRating:Number.isFinite(Number(src.lastRating)) ? Number(src.lastRating) : 0
  };
}
function normalizeManagerPlayerStatsHistory(raw){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const out = { version:1, seasons:{} };
  Object.entries(src.seasons || {}).forEach(([seasonKey, seasonRaw]) => {
    if(!seasonRaw || typeof seasonRaw !== 'object' || Array.isArray(seasonRaw)) return;
    const seasonNumber = Math.max(1, Math.round(Number(seasonRaw.seasonNumber || seasonKey || 1)));
    const year = Math.round(Number(seasonRaw.year || seasonYearForNumber(seasonNumber) || 0));
    const season = { seasonNumber, year, clubs:{} };
    Object.entries(seasonRaw.clubs || {}).forEach(([clubKey, clubRaw]) => {
      if(!clubRaw || typeof clubRaw !== 'object' || Array.isArray(clubRaw)) return;
      const clubId = Math.max(0, Math.round(Number(clubRaw.clubId || clubKey || 0)));
      if(!clubId) return;
      const club = {
        clubId,
        clubName:String(clubRaw.clubName || clubName(clubId)),
        divisionName:String(clubRaw.divisionName || clubDivision(clubId)?.name || '—'),
        archived:Boolean(clubRaw.archived),
        completedDate:String(clubRaw.completedDate || ''),
        players:{},
        recordedMatchKeys:{}
      };
      Object.entries(clubRaw.players || {}).forEach(([playerKey, playerRaw]) => {
        const entry = normalizeManagerPlayerStatsEntry(playerRaw, playerKey);
        if(entry.playerId) club.players[String(entry.playerId)] = entry;
      });
      if(Array.isArray(clubRaw.recordedMatchKeys)) clubRaw.recordedMatchKeys.forEach(key => { if(key) club.recordedMatchKeys[String(key)] = true; });
      else if(clubRaw.recordedMatchKeys && typeof clubRaw.recordedMatchKeys === 'object') Object.keys(clubRaw.recordedMatchKeys).forEach(key => { if(key) club.recordedMatchKeys[String(key)] = true; });
      season.clubs[String(clubId)] = club;
    });
    out.seasons[String(seasonNumber)] = season;
  });
  return out;
}
function managerPlayerStatsHistoryState(){
  if(!game) return createInitialManagerPlayerStatsHistory();
  const current = game.managerPlayerStatsHistory;
  if(!current || typeof current !== 'object' || Array.isArray(current) || Number(current.version || 0) !== 1 || !current.seasons || typeof current.seasons !== 'object' || Array.isArray(current.seasons)){
    game.managerPlayerStatsHistory = normalizeManagerPlayerStatsHistory(current);
  }
  return game.managerPlayerStatsHistory;
}
function managerPlayerStatsSeasonRecord(seasonNumber=game?.seasonNumber || 1, create=true){
  const state = managerPlayerStatsHistoryState();
  const season = Math.max(1, Math.round(Number(seasonNumber || 1)));
  const key = String(season);
  if(!state.seasons[key] && create){
    state.seasons[key] = { seasonNumber:season, year:Number(game?.seasonNumber) === season ? Number(game?.seasonYear || seasonYearForNumber(season)) : Number(seasonYearForNumber(season)), clubs:{} };
  }
  return state.seasons[key] || null;
}
function managerPlayerStatsClubRecord(clubId=game?.selectedClubId, seasonNumber=game?.seasonNumber || 1, create=true){
  const id = Math.max(0, Math.round(Number(clubId || 0)));
  if(!id) return null;
  const season = managerPlayerStatsSeasonRecord(seasonNumber, create);
  if(!season) return null;
  const key = String(id);
  if(!season.clubs[key] && create){
    season.clubs[key] = { clubId:id, clubName:clubName(id), divisionName:clubDivision(id)?.name || '—', archived:false, completedDate:'', players:{}, recordedMatchKeys:{} };
  }
  return season.clubs[key] || null;
}
function ensureManagerPlayerStatsEntry(clubRecord, playerId){
  if(!clubRecord) return null;
  const id = Math.max(0, Math.round(Number(playerId || 0)));
  if(!id) return null;
  const key = String(id);
  if(!clubRecord.players[key]) clubRecord.players[key] = normalizeManagerPlayerStatsEntry({ playerId:id }, id);
  const player = playerById(id);
  if(player){
    clubRecord.players[key].name = String(player.name || clubRecord.players[key].name || 'Jugador');
    clubRecord.players[key].position = String(player.position || clubRecord.players[key].position || '—');
  }
  return clubRecord.players[key];
}
function managerPlayerStatsMatchKey(result){
  if(!result) return '';
  const explicit = String(result.id || result.matchId || '').trim();
  if(explicit) return explicit;
  return [result.season || game?.seasonNumber || 1, result.date || result.currentDate || '', result.seasonDay || '', result.round || result.matchday || '', result.homeId || 0, result.awayId || 0, result.engine || '', result.homeGoals ?? '', result.awayGoals ?? ''].join('|');
}
function managerPlayerStatsEventSummary(result, playerId){
  const id = Number(playerId || 0);
  const summary = { goals:0, assists:0, injuries:0, yellow:0, red:0, saves:0, errors:0, goalErrors:0 };
  (result?.goals || []).forEach(goal => {
    if(Number(goal.playerId || goal.scorerId || 0) === id) summary.goals += 1;
    if(Number(goal.assistId || 0) === id) summary.assists += 1;
  });
  (result?.cards || []).forEach(card => {
    if(Number(card.playerId || 0) !== id) return;
    if(card.type === 'yellow') summary.yellow += 1;
    else if(card.type === 'secondYellowRed'){ summary.yellow += 1; summary.red += 1; }
    else if(card.type === 'red') summary.red += 1;
  });
  (result?.injuries || []).forEach(injury => { if(Number(injury.playerId || 0) === id) summary.injuries += 1; });
  (result?.keySaves || []).forEach(save => { if(Number(save.playerId || save.goalkeeperId || 0) === id) summary.saves += 1; });
  (result?.errors || []).forEach(error => {
    if(Number(error.playerId || 0) !== id) return;
    summary.errors += 1;
    if(error.goal) summary.goalErrors += 1;
  });
  return summary;
}
function managerPlayerStoredRating(result, playerId){
  const id = Number(playerId || 0);
  const list = Array.isArray(result?.playerRatings) ? result.playerRatings : [];
  const found = list.find(item => Number(item?.playerId || item?.id || 0) === id);
  const value = Number(found?.rating);
  return Number.isFinite(value) ? clamp(value, 3, 10) : null;
}
function managerPlayerFallbackRating(result, clubId, playerId, events){
  const player = playerById(playerId);
  if(!player) return 6;
  const overall = clamp(Number(typeof effectiveOverall === 'function' ? effectiveOverall(player) : player.overall || 50), 1, 99);
  const condition = clamp(Number(typeof currentCondition === 'function' ? currentCondition(playerId) : 75), 1, 100);
  const morale = clamp(Number(typeof currentMorale === 'function' ? currentMorale(playerId) : 55), 1, 100);
  const home = Number(clubId) === Number(result?.homeId);
  const ownGoals = home ? Number(result?.homeGoals || 0) : Number(result?.awayGoals || 0);
  const rivalGoals = home ? Number(result?.awayGoals || 0) : Number(result?.homeGoals || 0);
  let rating = 6.05 + (overall - 62) * 0.012 + (morale - 55) * 0.006 + (condition - 70) * 0.005;
  rating += Number(events.goals || 0) * 0.82 + Number(events.assists || 0) * 0.48 + Number(events.saves || 0) * 0.24;
  rating -= Number(events.yellow || 0) * 0.22 + Number(events.red || 0) * 1.10 + Number(events.errors || 0) * 0.32 + Number(events.goalErrors || 0) * 0.42 + Number(events.injuries || 0) * 0.18;
  rating += clamp(ownGoals - rivalGoals, -3, 3) * 0.08;
  return clamp(rating, 3, 10);
}
function recordManagerPlayerMatchStatistics(clubId, playedIds=[], result=null, options={}){
  if(!game || !result || result.friendly || !result.played) return null;
  const id = Number(clubId || 0);
  if(!id || (!options.force && id !== Number(game.selectedClubId || 0))) return null;
  const seasonNumber = Math.max(1, Math.round(Number(options.seasonNumber || game.seasonNumber || 1)));
  const clubRecord = managerPlayerStatsClubRecord(id, seasonNumber, true);
  if(!clubRecord) return null;
  const matchKey = managerPlayerStatsMatchKey(result);
  if(matchKey && clubRecord.recordedMatchKeys[matchKey]) return clubRecord;
  const uniquePlayed = [...new Set((playedIds || []).map(Number).filter(Boolean))];
  uniquePlayed.forEach(playerId => {
    const entry = ensureManagerPlayerStatsEntry(clubRecord, playerId);
    if(!entry) return;
    const events = managerPlayerStatsEventSummary(result, playerId);
    entry.played += 1;
    entry.goals += events.goals;
    entry.assists += events.assists;
    entry.injuries += events.injuries;
    entry.yellow += events.yellow;
    entry.red += events.red;
    const stored = managerPlayerStoredRating(result, playerId);
    const rating = stored === null ? managerPlayerFallbackRating(result, id, playerId, events) : stored;
    entry.ratingTotal = Number(entry.ratingTotal || 0) + rating;
    entry.ratedMatches = Number(entry.ratedMatches || 0) + 1;
    entry.lastRating = rating;
  });
  if(matchKey) clubRecord.recordedMatchKeys[matchKey] = true;
  clubRecord.clubName = clubName(id);
  clubRecord.divisionName = clubDivision(id)?.name || clubRecord.divisionName || '—';
  return clubRecord;
}
function managerPlayerPlayedIdsForResult(result, clubId){
  const home = Number(clubId) === Number(result?.homeId);
  const explicit = home ? result?.playedIdsHome : result?.playedIdsAway;
  if(Array.isArray(explicit) && explicit.length) return [...new Set(explicit.map(Number).filter(Boolean))];
  const starters = home ? (result?.starterIdsHome || []) : (result?.starterIdsAway || []);
  const ins = (result?.substitutions || []).filter(sub => Number(sub.clubId || 0) === Number(clubId)).map(sub => Number(sub.inId || 0));
  return [...new Set(starters.concat(ins).map(Number).filter(Boolean))];
}
function syncManagerPlayerStatsClubFromHistory(clubId=game?.selectedClubId, seasonNumber=game?.seasonNumber || 1){
  if(!game) return null;
  const id = Number(clubId || 0);
  const clubRecord = managerPlayerStatsClubRecord(id, seasonNumber, true);
  if(!clubRecord) return null;
  if(Number(seasonNumber) === Number(game.seasonNumber || 1)){
    (game.matchHistory || []).filter(result => result?.played && !result?.friendly && (Number(result.homeId) === id || Number(result.awayId) === id)).forEach(result => {
      recordManagerPlayerMatchStatistics(id, managerPlayerPlayedIdsForResult(result, id), result, { force:true, seasonNumber });
    });
  }
  return clubRecord;
}
function ensureManagerPlayerStatsRoster(clubRecord, clubId){
  if(!clubRecord) return clubRecord;
  playersByClub(clubId).filter(player => !player.retired).forEach(player => ensureManagerPlayerStatsEntry(clubRecord, player.id));
  return clubRecord;
}
function archiveManagerPlayerStatsClub(clubId=game?.selectedClubId, options={}){
  if(!game) return null;
  const id = Number(clubId || 0);
  if(!id) return null;
  const clubRecord = syncManagerPlayerStatsClubFromHistory(id, game.seasonNumber || 1);
  ensureManagerPlayerStatsRoster(clubRecord, id);
  if(clubRecord){
    clubRecord.archived = options.final !== false;
    clubRecord.completedDate = String(game.currentDate || '');
  }
  return clubRecord;
}

function createInitialPlayerStarsState(){
  return { byPlayerId:{} };
}
function normalizePlayerStarsState(state){
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const byPlayerId = src.byPlayerId && typeof src.byPlayerId === 'object' && !Array.isArray(src.byPlayerId) ? src.byPlayerId : src;
  const out = { byPlayerId:{} };
  Object.entries(byPlayerId || {}).forEach(([id, rec]) => {
    if(!rec || typeof rec !== 'object') return;
    const playerId = Number(rec.playerId || id);
    const clubId = Number(rec.clubId || 0);
    if(!Number.isFinite(playerId) || !Number.isFinite(clubId) || !playerId || !clubId) return;
    out.byPlayerId[playerId] = {
      playerId,
      clubId,
      type:String(rec.type || 'referencia'),
      reason:String(rec.reason || ''),
      earnedSeason:Number(rec.earnedSeason || rec.season || game?.seasonNumber || 1),
      earnedTurn:Number(rec.earnedTurn || rec.turn || 0),
      earnedDate:rec.earnedDate || rec.date || '',
      locked:true
    };
  });
  return out;
}
function normalizePlayerImpactWindows(windows){
  const src = windows && typeof windows === 'object' && !Array.isArray(windows) ? windows : {};
  const out = {};
  Object.entries(src).forEach(([id, list]) => {
    const playerId = Number(id);
    if(!Number.isFinite(playerId) || !Array.isArray(list)) return;
    out[playerId] = list
      .filter(item => item && typeof item === 'object')
      .map(item => ({
        matchId:String(item.matchId || ''),
        season:Number(item.season || 0),
        clubId:Number(item.clubId || 0),
        goals:Number(item.goals || 0),
        assists:Number(item.assists || 0),
        keySaves:Number(item.keySaves || 0),
        played:Boolean(item.played !== false)
      }))
      .filter(item => item.clubId > 0)
      .slice(-PLAYER_STARS_WINDOW_MATCHES);
  });
  return out;
}
function syncPlayerStarsWithClubs(targetGame=game){
  if(!targetGame) return 0;
  targetGame.playerStars = normalizePlayerStarsState(targetGame.playerStars || {});
  targetGame.playerImpactWindows = normalizePlayerImpactWindows(targetGame.playerImpactWindows || {});
  let removed = 0;
  Object.entries(targetGame.playerStars.byPlayerId).forEach(([id, rec]) => {
    const player = typeof playerById === 'function' ? playerById(id) : (seed?.players || []).find(p => Number(p.id) === Number(id));
    if(!player || Number(player.clubId || 0) !== Number(rec.clubId || 0)){
      delete targetGame.playerStars.byPlayerId[id];
      if(targetGame.playerImpactWindows) delete targetGame.playerImpactWindows[id];
      removed++;
    }
  });
  return removed;
}
function playerStarRecord(playerOrId){
  if(!game) return null;
  const id = Number(typeof playerOrId === 'object' ? playerOrId?.id : playerOrId);
  const player = typeof playerOrId === 'object' ? playerOrId : playerById(id);
  const rec = game.playerStars?.byPlayerId?.[id];
  if(!rec || !player) return null;
  if(Number(player.clubId || 0) !== Number(rec.clubId || 0)){
    delete game.playerStars.byPlayerId[id];
    if(game.playerImpactWindows) delete game.playerImpactWindows[id];
    game._needsAutosave = true;
    return null;
  }
  return rec;
}
function playerStarLabel(type){
  const map = { goleador:'Referencia goleadora', arquero:'Arquero decisivo', asistidor:'Cerebro asistidor', referencia:'Jugador referencia' };
  return map[String(type || '')] || 'Jugador referencia';
}
function playerStarMarkup(playerOrId){
  const rec = playerStarRecord(playerOrId);
  if(!rec) return '';
  return `<span class="player-star" title="${escapeHtml(playerStarLabel(rec.type))}">★</span>`;
}
function isTransferListedPlayer(playerOrId){
  const player = typeof playerOrId === 'object' ? playerOrId : playerById(playerOrId);
  return Boolean(player?.transferListed);
}
function isPlayerUntransferable(playerOrId){
  const player = typeof playerOrId === 'object' ? playerOrId : playerById(playerOrId);
  return Boolean(player?.intransferible);
}
function transferListedMarkup(playerOrId){
  return isTransferListedPlayer(playerOrId) ? '<span class="transfer-listed-badge" title="Jugador transferible">EN VENTA</span>' : '';
}
function untransferableMarkup(playerOrId){
  return isPlayerUntransferable(playerOrId) ? '<span class="untransferable-lock" title="Jugador intransferible: sólo se escuchan ofertas por cláusula completa" aria-label="Jugador intransferible">🔒</span>' : '';
}
function playerNameWithStar(player){
  return `${playerStarMarkup(player)}${escapeHtml(player?.name || 'Jugador')}${transferListedMarkup(player)}${untransferableMarkup(player)}`;
}
function playerStarReferenceMultiplier(player, action='general'){
  const rec = playerStarRecord(player);
  if(!rec) return 1;
  const type = String(rec.type || 'referencia');
  const kind = String(action || 'general');
  let multiplier = 1 + PLAYER_STAR_REFERENCE_BONUS;
  if((type === 'goleador' && kind === 'goal') || (type === 'arquero' && kind === 'save') || (type === 'asistidor' && kind === 'assist')){
    multiplier += PLAYER_STAR_REFERENCE_BONUS * 0.35;
  }
  return clamp(multiplier, 1, 3);
}
function activeStarsForClub(clubId, targetGame=game){
  if(!targetGame) return [];
  syncPlayerStarsWithClubs(targetGame);
  return Object.values(targetGame.playerStars?.byPlayerId || {}).filter(rec => Number(rec.clubId || 0) === Number(clubId || 0));
}
function compactStarReason(type, metrics){
  if(type === 'arquero') return `${metrics.keySaveMatches}/${PLAYER_STARS_WINDOW_MATCHES} partidos con tapada clave`;
  if(type === 'asistidor') return `${metrics.assists}/${PLAYER_STARS_WINDOW_MATCHES} asistencias recientes`;
  if(type === 'goleador') return `${metrics.goalMatches}/${PLAYER_STARS_WINDOW_MATCHES} partidos convirtiendo`;
  return 'Rendimiento destacado';
}
function evaluatePlayerStarEligibility(player, window){
  if(!player || !Array.isArray(window) || !window.length) return null;
  const recent = window.slice(-PLAYER_STARS_WINDOW_MATCHES).filter(item => Number(item.clubId || 0) === Number(player.clubId || 0));
  const metrics = {
    goalMatches:recent.filter(item => Number(item.goals || 0) > 0).length,
    keySaveMatches:recent.filter(item => Number(item.keySaves || 0) > 0).length,
    assists:recent.reduce((sum, item) => sum + Number(item.assists || 0), 0)
  };
  const group = playerRoleGroup(player.position);
  if(String(player.position || '').toUpperCase() === 'POR' && metrics.keySaveMatches >= PLAYER_STAR_KEY_SAVE_MATCHES_REQUIRED){
    return { type:'arquero', metrics };
  }
  if(group === 'MID' && metrics.assists >= PLAYER_STAR_MID_ASSISTS_REQUIRED){
    return { type:'asistidor', metrics };
  }
  if(String(player.position || '').toUpperCase() !== 'POR' && metrics.goalMatches >= PLAYER_STAR_GOAL_MATCHES_REQUIRED){
    return { type:'goleador', metrics };
  }
  return null;
}
function awardPlayerStar(player, eligibility){
  if(!game || !player || !eligibility) return false;
  syncPlayerStarsWithClubs(game);
  const clubId = Number(player.clubId || 0);
  if(!clubId) return false;
  if(game.playerStars?.byPlayerId?.[player.id]) return false;
  if(activeStarsForClub(clubId).length >= PLAYER_STARS_MAX_PER_CLUB) return false;
  const reason = compactStarReason(eligibility.type, eligibility.metrics || {});
  game.playerStars.byPlayerId[player.id] = {
    playerId:Number(player.id),
    clubId,
    type:eligibility.type,
    reason,
    earnedSeason:Number(game.seasonNumber || 1),
    earnedTurn:currentTurnIndex(),
    earnedDate:game.currentDate || '',
    locked:true
  };
  if(clubId === Number(game.selectedClubId)){
    pushGameMessage({
      type:'deportivo',
      priority:'high',
      title:`${player.name} ganó una estrella`,
      body:`${player.name} se convirtió en ${playerStarLabel(eligibility.type).toLowerCase()} del equipo. ${reason}.`
    });
  }
  return true;
}
function updatePlayerStarTrackingForMatch(result){
  if(!game || !result || result.friendly) return;
  syncPlayerStarsWithClubs(game);
  game.playerImpactWindows = normalizePlayerImpactWindows(game.playerImpactWindows || {});
  const goalStats = {};
  (result.goals || []).forEach(goal => {
    const scorerId = Number(goal.playerId || 0);
    const assistId = Number(goal.assistId || 0);
    if(scorerId){ goalStats[scorerId] = goalStats[scorerId] || { goals:0, assists:0 }; goalStats[scorerId].goals += 1; }
    if(assistId){ goalStats[assistId] = goalStats[assistId] || { goals:0, assists:0 }; goalStats[assistId].assists += 1; }
  });
  const saveStats = {};
  (result.keySaves || []).forEach(save => {
    const id = Number(save.playerId || 0);
    if(!id) return;
    saveStats[id] = (saveStats[id] || 0) + 1;
  });
  const playersBySide = [
    { clubId:Number(result.homeId || 0), ids:result.playedIdsHome || result.starterIdsHome || [] },
    { clubId:Number(result.awayId || 0), ids:result.playedIdsAway || result.starterIdsAway || [] }
  ];
  playersBySide.forEach(side => {
    [...new Set((side.ids || []).map(Number).filter(Boolean))].forEach(id => {
      const player = playerById(id);
      if(!player || Number(player.clubId || 0) !== side.clubId) return;
      const key = String(id);
      const previous = (game.playerImpactWindows[key] || []).filter(item => Number(item.clubId || 0) === side.clubId);
      previous.push({
        matchId:String(result.id || `${game.seasonNumber || 1}-${game.matchdayIndex || 0}`),
        season:Number(game.seasonNumber || 1),
        clubId:side.clubId,
        goals:Number(goalStats[id]?.goals || 0),
        assists:Number(goalStats[id]?.assists || 0),
        keySaves:Number(saveStats[id] || 0),
        played:true
      });
      game.playerImpactWindows[key] = previous.slice(-PLAYER_STARS_WINDOW_MATCHES);
      const eligibility = evaluatePlayerStarEligibility(player, game.playerImpactWindows[key]);
      if(eligibility) awardPlayerStar(player, eligibility);
    });
  });
}

function normalizeManagerTitleHistory(items=[]){
  const source = Array.isArray(items) ? items : [];
  const clean = [];
  const seen = new Set();
  source.forEach(item => {
    const season = Math.max(1, Math.round(Number(item?.season || 0)) || 1);
    const type = String(item?.type || 'league').trim() || 'league';
    const competitionId = String(item?.competitionId || item?.divisionId || item?.id || `${type}-${season}`).trim();
    const clubId = Number(item?.clubId || item?.championId || 0);
    const key = `${season}:${type}:${competitionId}`;
    if(seen.has(key)) return;
    seen.add(key);
    clean.push({
      key,
      season,
      year:Math.round(Number(item?.year || 0)) || seasonYearForNumber(season),
      type,
      competitionId,
      competitionName:String(item?.competitionName || item?.divisionName || item?.name || competitionId),
      clubId,
      clubName:String(item?.clubName || (clubId ? clubName(clubId) : '')),
      createdAt:String(item?.createdAt || new Date().toISOString())
    });
  });
  clean.sort((a,b)=>Number(a.season || 0)-Number(b.season || 0) || String(a.competitionName || '').localeCompare(String(b.competitionName || ''), 'es', { sensitivity:'base' }));
  return clean;
}
function recordManagerOfficialTitleForState(targetGame, entry={}){
  if(!targetGame || !entry) return false;
  targetGame.managerStats = normalizeManagerStats(targetGame.managerStats || createInitialManagerStats());
  const stats = targetGame.managerStats;
  const season = Math.max(1, Math.round(Number(entry.season || targetGame.seasonNumber || 1)) || 1);
  const type = String(entry.type || 'league').trim() || 'league';
  const competitionId = String(entry.competitionId || entry.divisionId || `${type}-${season}`).trim();
  const key = `${season}:${type}:${competitionId}`;
  stats.titleHistory = normalizeManagerTitleHistory(stats.titleHistory || []);
  if(stats.titleHistory.some(item => item.key === key)) return false;
  const previousTitles = Math.max(0, Math.round(Number(stats.titles || 0)));
  stats.titleHistory.push({
    key,
    season,
    year:Math.round(Number(entry.year || targetGame.seasonYear || 0)) || seasonYearForNumber(season),
    type,
    competitionId,
    competitionName:String(entry.competitionName || entry.divisionName || competitionId),
    clubId:Number(entry.clubId || entry.championId || targetGame.selectedClubId || 0),
    clubName:String(entry.clubName || clubName(entry.clubId || entry.championId || targetGame.selectedClubId)),
    createdAt:String(entry.createdAt || new Date().toISOString())
  });
  stats.titleHistory = normalizeManagerTitleHistory(stats.titleHistory);
  stats.titles = Math.max(previousTitles + 1, stats.titleHistory.length);
  targetGame.managerStats = stats;
  return true;
}
function syncManagerOfficialTitles(targetGame=game){
  if(!targetGame) return false;
  targetGame.managerStats = normalizeManagerStats(targetGame.managerStats || createInitialManagerStats());
  const stats = targetGame.managerStats;
  let changed = false;
  (stats.seasons || []).filter(item => Boolean(item?.title) || Number(item?.position || 0) === 1).forEach(item => {
    if(recordManagerOfficialTitleForState(targetGame, {
      season:item.season,
      year:item.year,
      type:'league',
      competitionId:item.divisionId || `league-${item.season}`,
      competitionName:item.divisionName || 'Liga',
      clubId:item.clubId,
      clubName:item.clubName
    })) changed = true;
  });
  const managedBySeason = new Map();
  (targetGame.managerStats?.seasons || []).forEach(item => {
    const season = Number(item?.season || 0);
    const clubId = Number(item?.clubId || 0);
    if(season && clubId){
      if(!managedBySeason.has(season)) managedBySeason.set(season, new Set());
      managedBySeason.get(season).add(clubId);
    }
  });
  if(Number(targetGame.selectedClubId || 0)){
    const season = Number(targetGame.seasonNumber || 1);
    if(!managedBySeason.has(season)) managedBySeason.set(season, new Set());
    managedBySeason.get(season).add(Number(targetGame.selectedClubId));
  }
  const entries = normalizeCompetitionChampionsHistoryState(targetGame.competitionChampionsHistory || {}).entries || [];
  entries.filter(item => String(item.type || '') !== 'league').forEach(item => {
    const clubs = managedBySeason.get(Number(item.season || 0));
    if(!clubs || !clubs.has(Number(item.championId || 0))) return;
    if(recordManagerOfficialTitleForState(targetGame, {
      season:item.season,
      year:item.year,
      type:item.type || 'official_competition',
      competitionId:item.competitionId,
      competitionName:item.competitionName,
      clubId:item.championId,
      clubName:item.championName,
      createdAt:item.createdAt
    })) changed = true;
  });
  return changed;
}

function createInitialManagerStats(){
  return {
    totals:{ played:0, won:0, drawn:0, lost:0, gf:0, gc:0 },
    currentSeason:{ season:1, clubId:0, played:0, won:0, drawn:0, lost:0, gf:0, gc:0 },
    seasons:[],
    titles:0,
    titleHistory:[],
    experience:0,
    prestige:0,
    prestigeWinMilestones:0,
    prestigeAdjustments:[],
    objectivePrestigeAwards:[],
    careerHistory:[],
    achievements:{ unlocked:{}, lastCheckedDate:null }
  };
}
function normalizeManagerStats(stats){
  const base = createInitialManagerStats();
  const src = stats || {};
  const totals = { ...base.totals, ...(src.totals || {}) };
  Object.keys(totals).forEach(key => { totals[key] = Number.isFinite(Number(totals[key])) ? Number(totals[key]) : 0; });
  const currentRaw = src.currentSeason && typeof src.currentSeason === 'object' ? src.currentSeason : {};
  const currentSeason = { ...base.currentSeason, ...currentRaw };
  Object.keys(currentSeason).forEach(key => { currentSeason[key] = Number.isFinite(Number(currentSeason[key])) ? Number(currentSeason[key]) : 0; });
  const prestigeWinMilestones = Math.max(0, Math.round(Number(src.prestigeWinMilestones || 0)));
  const experience = Math.max(0, Math.round(Number(src.experience || 0)));
  const prestigeAdjustments = Array.isArray(src.prestigeAdjustments) ? src.prestigeAdjustments : [];
  const seasons = Array.isArray(src.seasons) ? src.seasons : [];
  const legacyLeagueTitles = seasons.filter(item => Boolean(item?.title) || Number(item?.position || 0) === 1).map(item => ({
    season:Number(item?.season || 1),
    year:Number(item?.year || 0) || seasonYearForNumber(item?.season || 1),
    type:'league',
    competitionId:String(item?.divisionId || `league-${Number(item?.season || 1)}`),
    competitionName:String(item?.divisionName || 'Liga'),
    clubId:Number(item?.clubId || 0),
    clubName:String(item?.clubName || '')
  }));
  const titleHistory = normalizeManagerTitleHistory([...(Array.isArray(src.titleHistory) ? src.titleHistory : []), ...legacyLeagueTitles]);
  const normalized = {
    totals,
    currentSeason,
    seasons,
    titles:Math.max(Number.isFinite(Number(src.titles)) ? Number(src.titles) : 0, titleHistory.length, legacyLeagueTitles.length),
    titleHistory,
    experience,
    prestige:0,
    prestigeWinMilestones,
    prestigeAdjustments,
    objectivePrestigeAwards:Array.isArray(src.objectivePrestigeAwards) ? src.objectivePrestigeAwards : [],
    careerHistory:Array.isArray(src.careerHistory) ? src.careerHistory : [],
    achievements:normalizeManagerAchievementsState(src.achievements)
  };
  normalized.prestige = managerPrestigeBreakdown(normalized).total;
  return normalized;
}


const MANAGER_GLOBAL_PROFILE_STORAGE_KEY = 'futbolManager.managerProfileGlobal.v1';

function managerProfileStatsHasProgress(stats=null){
  const src = stats || {};
  const totals = src.totals || {};
  return Boolean(
    Number(src.experience || 0) > 0
    || Number(src.titles || 0) > 0
    || Number(totals.played || 0) > 0
    || (Array.isArray(src.seasons) && src.seasons.length > 0)
    || (Array.isArray(src.careerHistory) && src.careerHistory.length > 0)
    || (Array.isArray(src.prestigeAdjustments) && src.prestigeAdjustments.length > 0)
    || (src.achievements?.unlocked && Object.keys(src.achievements.unlocked || {}).length > 0)
  );
}
function normalizeManagerChallengeRewardsState(value=null){
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = {};
  Object.entries(raw).forEach(([id, item]) => {
    const key = String(id || '').trim();
    if(!key) return;
    const src = item && typeof item === 'object' && !Array.isArray(item) ? item : {};
    clean[key] = {
      completions:Math.max(0, Math.round(Number(src.completions || 0))),
      successfulCompletions:Math.max(0, Math.round(Number(src.successfulCompletions || 0))),
      rewardClaimed:Boolean(src.rewardClaimed),
      rewardAmount:Math.max(0, Math.round(Number(src.rewardAmount || 0))),
      rewardClaimedAt:src.rewardClaimedAt || null,
      lastCompletedAt:src.lastCompletedAt || null
    };
  });
  return clean;
}
function managerChallengeRewardRecord(challengeId=''){
  const id = String(challengeId || '').trim();
  if(!id) return null;
  const profile = readManagerGlobalProfileState();
  return profile?.challengeRewards?.[id] || null;
}
function managerChallengeRewardAlreadyClaimed(challengeId=''){
  return Boolean(managerChallengeRewardRecord(challengeId)?.rewardClaimed);
}
function recordManagerChallengeCompletion(challengeId='', options={}){
  const id = String(challengeId || '').trim();
  if(!id) return null;
  const profile = readManagerGlobalProfileState();
  const rewards = normalizeManagerChallengeRewardsState(profile?.challengeRewards);
  const previous = rewards[id] || { completions:0, successfulCompletions:0, rewardClaimed:false, rewardAmount:0, rewardClaimedAt:null, lastCompletedAt:null };
  const success = options.success === true;
  const rewardClaimedNow = options.rewardClaimed === true;
  rewards[id] = {
    completions:Math.max(0, Number(previous.completions || 0)) + 1,
    successfulCompletions:Math.max(0, Number(previous.successfulCompletions || 0)) + (success ? 1 : 0),
    rewardClaimed:Boolean(previous.rewardClaimed || rewardClaimedNow),
    rewardAmount:Math.max(Number(previous.rewardAmount || 0), Math.max(0, Math.round(Number(options.rewardAmount || 0)))),
    rewardClaimedAt:previous.rewardClaimedAt || (rewardClaimedNow ? new Date().toISOString() : null),
    lastCompletedAt:new Date().toISOString()
  };
  return writeManagerGlobalProfileState({ ...profile, challengeRewards:rewards });
}

function normalizeManagerGlobalProfile(profile=null){
  const raw = profile && typeof profile === 'object' && !Array.isArray(profile) ? profile : {};
  const stats = normalizeManagerStats(raw.managerStats || createInitialManagerStats());
  const skillPoints = Math.max(0, Math.round(Number(raw.skillPoints ?? raw.puntos_habilidad ?? raw.puntosHabilidad ?? 0)));
  const managerCourses = typeof normalizeManagerCoursesState === 'function'
    ? normalizeManagerCoursesState(raw.managerCourses || raw.cursosManager)
    : (raw.managerCourses || raw.cursosManager || null);
  const coursesProgress = typeof managerCoursesHasProgress === 'function' ? managerCoursesHasProgress(managerCourses) : Boolean(managerCourses);
  const empty = !managerProfileStatsHasProgress(stats) && skillPoints <= 0 && !raw.saveCode && !raw.managerName && !coursesProgress;
  return {
    version:'V8.27',
    managerName:String(raw.managerName || raw.nombre_manager || storedManagerName() || ''),
    saveCode:String(raw.saveCode || raw.manager_id || ''),
    managerStats:stats,
    skillPoints,
    challengeRewards:normalizeManagerChallengeRewardsState(raw.challengeRewards || raw.recompensasRetos),
    managerCourses,
    updatedAt:raw.updatedAt || null,
    empty
  };
}
function readManagerGlobalProfileState(){
  try{
    const raw = localStorage.getItem(MANAGER_GLOBAL_PROFILE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return normalizeManagerGlobalProfile(parsed);
  }catch(err){ console.warn('No se pudo leer el perfil global del manager.', err); }
  return normalizeManagerGlobalProfile(null);
}
function writeManagerGlobalProfileState(profile){
  try{
    const clean = normalizeManagerGlobalProfile(profile);
    clean.version = 'V8.27';
    clean.updatedAt = new Date().toISOString();
    clean.empty = false;
    localStorage.setItem(MANAGER_GLOBAL_PROFILE_STORAGE_KEY, JSON.stringify(clean));
    return clean;
  }catch(err){ console.warn('No se pudo guardar el perfil global del manager.', err); return null; }
}
function applySharedManagerProfileToGame(){
  if(!game) return { changed:false };
  const profile = readManagerGlobalProfileState();
  if(!profile || profile.empty) return { changed:false };
  const season = Math.max(1, Math.round(Number(game.seasonNumber || 1)));
  const clubId = Number(game.selectedClubId || 0);
  // no reemplazar managerStats por el perfil global.
  // managerStats contiene el prestigio de esta carrera/slot; si se pisa, el prestigio se comparte.
  const previousStats = normalizeManagerStats(game.managerStats || createInitialManagerStats());
  game.managerStats = ensureManagerCurrentSeasonStats(previousStats, season, clubId);
  const profileStats = normalizeManagerStats(profile.managerStats || createInitialManagerStats());
  game.managerSharedProfile = {
    version:'V8.27',
    experience:Math.max(0, Math.round(Number(profileStats.experience || 0))),
    careerHistory:Array.isArray(profileStats.careerHistory) ? profileStats.careerHistory.slice() : [],
    updatedAt:profile.updatedAt || null
  };
  if(profile.managerName && !game.rankingManagerName) game.rankingManagerName = profile.managerName;
  if(profile.saveCode && !game.saveCode) game.saveCode = profile.saveCode;
  if(typeof normalizeSpecialState === 'function'){
    game.special = normalizeSpecialState(game.special || createInitialSpecialState(game.rankingManagerName || profile.managerName || storedManagerName() || 'Manager'), game.rankingManagerName || profile.managerName || storedManagerName() || 'Manager');
  } else if(!game.special) {
    game.special = { puntos_habilidad:0, cartas_activas:[], cartas_reserva:[] };
  }
  if(game.special && typeof game.special === 'object'){
    game.special.puntos_habilidad = Math.max(0, Math.round(Number(profile.skillPoints || 0)));
    game.special.manager_id = String(game.saveCode || profile.saveCode || game.special.manager_id || '');
    game.special.nombre_manager = String(game.rankingManagerName || profile.managerName || game.special.nombre_manager || storedManagerName() || 'Manager');
  }
  return { changed:true, profile };
}
function persistSharedManagerProfileFromGame(){
  if(!game) return null;
  const stats = normalizeManagerStats(game.managerStats || createInitialManagerStats());
  let special = game.special;
  if(typeof ensureSpecialState === 'function') special = ensureSpecialState();
  const existingProfile = readManagerGlobalProfileState();
  const profile = {
    version:'V8.27',
    managerName:String(game.rankingManagerName || storedManagerName() || ''),
    saveCode:String(game.saveCode || ''),
    managerStats:stats,
    skillPoints:Math.max(0, Math.round(Number(special?.puntos_habilidad || 0))),
    challengeRewards:normalizeManagerChallengeRewardsState(existingProfile?.challengeRewards),
    managerCourses:typeof normalizeManagerCoursesState === 'function' ? normalizeManagerCoursesState(existingProfile?.managerCourses) : existingProfile?.managerCourses,
    updatedAt:new Date().toISOString()
  };
  return writeManagerGlobalProfileState(profile);
}

function managerGlobalProfileScore(profile=null){
  const clean = normalizeManagerGlobalProfile(profile);
  const stats = clean.managerStats || {};
  const totals = stats.totals || {};
  const completedCourses = typeof normalizeManagerCoursesState === 'function'
    ? Object.values(normalizeManagerCoursesState(clean.managerCourses).completed || {}).filter(Boolean).length
    : 0;
  return (Number(stats.experience || 0) * 1000)
    + (Number(totals.played || 0) * 25)
    + ((Array.isArray(stats.seasons) ? stats.seasons.length : 0) * 500)
    + ((Array.isArray(stats.careerHistory) ? stats.careerHistory.length : 0) * 200)
    + (Number(stats.titles || 0) * 1000)
    + (completedCourses * 100)
    + Number(clean.skillPoints || 0);
}
async function migrateAllSavedManagerProfilesToGlobal(){
  if(typeof readLocalSaveRecord !== 'function') return false;
  const candidates = [];
  const currentGlobal = readManagerGlobalProfileState();
  if(currentGlobal && !currentGlobal.empty) candidates.push(currentGlobal);
  const slotIds = [];
  if(typeof careerSaveSlotIds === 'function') slotIds.push(...careerSaveSlotIds());
  else slotIds.push(typeof SAVE_SLOT_CAREER !== 'undefined' ? SAVE_SLOT_CAREER : 'career:1');
  if(typeof SAVE_SLOT_CAMPO_DESTRUIDO !== 'undefined') slotIds.push(SAVE_SLOT_CAMPO_DESTRUIDO);
  for(const rawSlot of Array.from(new Set(slotIds))){
    const slotId = typeof normalizeSaveSlotId === 'function' ? normalizeSaveSlotId(rawSlot) : rawSlot;
    const record = await readLocalSaveRecord(slotId).catch(()=>null);
    if(!record || typeof record !== 'object') continue;
    const profile = normalizeManagerGlobalProfile({
      managerName:record.rankingManagerName || storedManagerName() || '',
      saveCode:record.saveCode || '',
      managerStats:record.managerStats || createInitialManagerStats(),
      skillPoints:Math.max(0, Math.round(Number(record.special?.puntos_habilidad || 0)))
    });
    if(!profile.empty) candidates.push(profile);
  }
  if(!candidates.length) return false;
  candidates.sort((a,b) => managerGlobalProfileScore(b) - managerGlobalProfileScore(a));
  const best = candidates[0];
  const currentScore = managerGlobalProfileScore(currentGlobal);
  if(currentGlobal && !currentGlobal.empty && currentScore >= managerGlobalProfileScore(best)) return false;
  writeManagerGlobalProfileState({
    ...best,
    challengeRewards:normalizeManagerChallengeRewardsState(currentGlobal?.challengeRewards),
    managerCourses:typeof normalizeManagerCoursesState === 'function'
      ? normalizeManagerCoursesState(currentGlobal?.managerCourses || best?.managerCourses)
      : (currentGlobal?.managerCourses || best?.managerCourses)
  });
  return true;
}

function normalizeManagerAchievementsState(state){
  const clean = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const unlockedRaw = clean.unlocked && typeof clean.unlocked === 'object' && !Array.isArray(clean.unlocked) ? clean.unlocked : {};
  const unlocked = {};
  Object.entries(unlockedRaw).forEach(([id, item]) => {
    if(!id) return;
    unlocked[String(id)] = {
      id:String(id),
      unlockedAt:item?.unlockedAt || item?.date || null,
      season:Number(item?.season || 0),
      value:Number.isFinite(Number(item?.value)) ? Number(item.value) : 0
    };
  });
  return { unlocked, lastCheckedDate:clean.lastCheckedDate || null };
}
function managerAchievementsCatalog(){
  const db = managerAchievementsDatabase && typeof managerAchievementsDatabase === 'object' ? managerAchievementsDatabase : null;
  return Array.isArray(db?.hitos) ? db.hitos : [];
}
function managerAchievementCareerSummary(statsInput=null){
  const stats = normalizeManagerStats(statsInput || game?.managerStats || createInitialManagerStats());
  const seasons = Array.isArray(stats.seasons) ? stats.seasons : [];
  const career = Array.isArray(stats.careerHistory) ? stats.careerHistory : [];
  const titles = Array.isArray(stats.titleHistory) ? stats.titleHistory : [];
  const managedClubIds = new Set();
  seasons.forEach(item => { const id = Number(item?.clubId || 0); if(id) managedClubIds.add(id); });
  career.forEach(item => { const id = Number(item?.clubId || 0); if(id) managedClubIds.add(id); });
  const currentClubId = Number(game?.selectedClubId || 0);
  if(currentClubId) managedClubIds.add(currentClubId);

  const leagueTitles = titles.filter(item => String(item?.type || '') === 'league');
  const leagueClubIds = new Set();
  const leagueIds = new Set();
  const leagueCountries = new Set();
  const topDivisionCountries = new Set();
  leagueTitles.forEach(item => {
    const clubId = Number(item?.clubId || 0);
    if(clubId) leagueClubIds.add(clubId);
    const competitionId = String(item?.competitionId || '').trim();
    if(competitionId) leagueIds.add(competitionId);
    else if(item?.competitionName) leagueIds.add(String(item.competitionName).trim().toLowerCase());
    const club = (seed?.clubs || []).find(candidate => Number(candidate.id) === clubId);
    const division = (seed?.divisions || []).find(candidate => String(candidate.id || '') === competitionId);
    const country = String(division?.country || division?.pais || club?.country || club?.pais || '').trim();
    if(country) leagueCountries.add(country.toLowerCase());
    const divisionOrder = Number(division?.order || (String(club?.divisionId || '') === competitionId ? club?.divisionOrder : 0) || 0);
    if(country && divisionOrder === 1) topDivisionCountries.add(country.toLowerCase());
  });
  const clubWorldCupTitles = titles.filter(item => String(item?.type || '') === 'club_world_cup' || String(item?.competitionId || '') === 'club-world-cup').length;
  return {
    managedClubs:managedClubIds.size,
    dismissals:career.filter(item => String(item?.type || '') === 'dismissal').length,
    resignations:career.filter(item => String(item?.type || '') === 'resignation').length,
    leagueTitleClubs:leagueClubIds.size,
    leagueTitleLeagues:leagueIds.size,
    leagueTitleCountries:leagueCountries.size,
    topDivisionTitleCountries:topDivisionCountries.size,
    clubWorldCupTitles
  };
}
function managerAchievementMetricValue(metric){
  const stats = normalizeManagerStats(game?.managerStats || createInitialManagerStats());
  const totals = stats.totals || {};
  const seasons = Array.isArray(stats.seasons) ? stats.seasons : [];
  const key = String(metric || '');
  if(['managedClubs','dismissals','resignations','leagueTitleClubs','leagueTitleLeagues','leagueTitleCountries','topDivisionTitleCountries','clubWorldCupTitles'].includes(key)){
    return Number(managerAchievementCareerSummary(stats)[key] || 0);
  }
  if(key === 'totals.played') return Number(totals.played || 0);
  if(key === 'totals.won') return Number(totals.won || 0);
  if(key === 'totals.drawn') return Number(totals.drawn || 0);
  if(key === 'totals.lost') return Number(totals.lost || 0);
  if(key === 'totals.gf') return Number(totals.gf || 0);
  if(key === 'totals.gc') return Number(totals.gc || 0);
  if(key === 'goalDiff') return Number(totals.gf || 0) - Number(totals.gc || 0);
  if(key === 'titles') return Number(stats.titles || 0);
  if(key === 'experience') return Number(stats.experience || 0);
  if(key === 'prestige') return Number(stats.prestige || 0);
  if(key === 'seasonsCompleted') return seasons.length;
  if(key === 'objectivesAchieved') return seasons.filter(item => item?.objectiveAchieved === true).length;
  if(key === 'bestSeasonPpg') return seasons.reduce((max, item) => Math.max(max, Number(item.ppg || 0)), 0);
  if(key === 'bestSeasonPoints') return seasons.reduce((max, item) => Math.max(max, Number(item.pts || 0)), 0);
  if(key === 'currentBudget') return Math.max(0, Math.round(Number(game?.budget || 0)));
  if(key === 'stadiumCapacity') return typeof clubStadiumCapacity === 'function' ? clubStadiumCapacity(game?.selectedClubId) : 0;
  if(key === 'fans') return typeof clubFansCurrent === 'function' ? clubFansCurrent(game?.selectedClubId) : 0;
  if(key === 'skillPoints') return Math.max(0, Math.round(Number(game?.special?.puntos_habilidad || 0)));
  if(key === 'activeSpecialCards') return Array.isArray(game?.special?.activeCards) ? game.special.activeCards.length : 0;
  if(key === 'savedScoutingReports') return game?.scoutingCenter?.reports && typeof game.scoutingCenter.reports === 'object' ? Object.keys(game.scoutingCenter.reports).length : 0;
  if(key === 'archivedScoutingReports'){
    const listed = new Set(Array.isArray(game?.scoutingCenter?.listedPlayerIds) ? game.scoutingCenter.listedPlayerIds.map(Number) : []);
    return game?.scoutingCenter?.reports && typeof game.scoutingCenter.reports === 'object' ? Object.keys(game.scoutingCenter.reports).filter(id => !listed.has(Number(id))).length : 0;
  }
  if(key === 'scoutedTeams') return game?.scoutingCenter?.teamReports && typeof game.scoutingCenter.teamReports === 'object' ? Object.keys(game.scoutingCenter.teamReports).length : 0;
  if(key === 'academyPlayers') return Array.isArray(game?.academy?.players) ? game.academy.players.length : 0;
  if(['academyTrainingPoints','academyConsultations','academyPromotions','academyYouthSales','academyYouthBenefits'].includes(key)){
    const academyStats = typeof academyCareerStatsState === 'function' ? academyCareerStatsState({ reconcile:true }) : (game?.academy?.careerStats || {});
    if(key === 'academyTrainingPoints') return Number(academyStats.trainingPoints || 0);
    if(key === 'academyConsultations') return Number(academyStats.consultations || 0);
    if(key === 'academyPromotions') return Number(academyStats.promotions || 0);
    if(key === 'academyYouthSales') return Number(academyStats.sales || 0);
    if(key === 'academyYouthBenefits') return Number(academyStats.directSaleIncome || 0) + Number(academyStats.futureSaleBenefits || 0);
  }
  if(key === 'employeesCount') return ['psychologist','kinesiologist','youthPreparer'].filter(key => game?.employees?.[key]).length;
  return 0;
}
function checkManagerAchievements(options={}){
  if(!game?.managerStats) return [];
  game.managerStats = normalizeManagerStats(game.managerStats);
  const state = game.managerStats.achievements || normalizeManagerAchievementsState();
  const catalog = managerAchievementsCatalog();
  const unlockedNow = [];
  catalog.forEach(item => {
    const id = String(item.id || '');
    if(!id || state.unlocked[id]) return;
    const value = managerAchievementMetricValue(item.metrica);
    const target = Number(item.objetivo || 0);
    if(Number(value) >= target){
      state.unlocked[id] = { id, unlockedAt:currentCalendarDate(), season:Number(game.seasonNumber || 1), value:Number(value || 0) };
      unlockedNow.push({ ...item, value:Number(value || 0) });
    }
  });
  state.lastCheckedDate = currentCalendarDate();
  game.managerStats.achievements = state;
  if(unlockedNow.length && options.silent !== true){
    const first = unlockedNow[0];
    pushGameMessage({
      type:'asistente',
      priority:'normal',
      title:'Nuevo hito desbloqueado',
      body:`${first.titulo}${unlockedNow.length > 1 ? ` y ${unlockedNow.length - 1} hito(s) más` : ''}. Revisalo en Hitos.`,
      id:`manager-achievement-${game.seasonNumber || 1}-${game.globalTurn || 0}-${first.id}`,
      action:{ type:'openManagerAchievements', label:'Ver hitos' }
    });
  }
  return unlockedNow;
}
function managerUnlockedAchievements(){
  if(!game?.managerStats) return [];
  game.managerStats = normalizeManagerStats(game.managerStats);
  checkManagerAchievements({ silent:true });
  const state = game.managerStats.achievements || normalizeManagerAchievementsState();
  const catalog = managerAchievementsCatalog();
  return catalog
    .filter(item => state.unlocked?.[String(item.id || '')])
    .map(item => ({ ...item, unlocked:state.unlocked[String(item.id || '')] }))
    .sort((a,b)=>String(b.unlocked?.unlockedAt || '').localeCompare(String(a.unlocked?.unlockedAt || '')) || String(a.categoria || '').localeCompare(String(b.categoria || '')));
}

function addManagerPrestige(points, reason=''){
  if(!game?.managerStats || Number(points || 0) === 0) return 0;
  game.managerStats = normalizeManagerStats(game.managerStats);
  const legacyPoints = Number(points || 0);
  const careerDelta = Math.round(legacyPoints * 4);
  if(typeof normalizeManagerCareerProfile === 'function'){
    const profile = normalizeManagerCareerProfile(game.managerStats.careerProfile || {}, game.managerStats);
    const before = Number(profile.prestige || 0);
    profile.prestige = clamp(before + careerDelta, 0, Number(typeof configValue === 'function' ? configValue('manager.carrera.prestigioMaximo', 1000) : 1000));
    profile.progression = Array.isArray(profile.progression) ? profile.progression : [];
    profile.progression.push({
      key:`adjustment:${game.seasonNumber || 1}:${game.selectedClubId || 0}:${game.globalTurn || 0}:${reason || 'prestigio'}`,
      season:Number(game.seasonNumber || 1), clubId:Number(game.selectedClubId || 0), evaluationScore:50,
      prestigeBefore:before, prestigeDelta:careerDelta, prestigeAfter:profile.prestige,
      momentBefore:Number(profile.moment || 0), momentAfter:Number(profile.moment || 0), capabilityDeltas:{},
      weight:0, status:'adjustment', createdAt:new Date().toISOString()
    });
    profile.progression = profile.progression.slice(-120);
    game.managerStats.careerProfile = profile;
  }else{
    game.managerStats.prestigeAdjustments = Array.isArray(game.managerStats.prestigeAdjustments) ? game.managerStats.prestigeAdjustments : [];
    game.managerStats.prestigeAdjustments.push({ points:legacyPoints, reason:String(reason || 'Ajuste de prestigio'), season:Number(game.seasonNumber || 1), clubId:Number(game.selectedClubId || 0), createdAt:new Date().toISOString() });
  }
  if(reason){
    const careerTotal = Number(game.managerStats?.careerProfile?.prestige || 0);
    pushGameMessage({ type:'directiva', priority:careerDelta > 0 ? 'normal' : 'high', title:careerDelta > 0 ? 'Prestigio de carrera aumentado' : 'Prestigio de carrera reducido', body:`${reason}. Prestigio de carrera: ${careerTotal}/1000.`, id:`manager-prestige-${game.seasonNumber || 1}-${game.globalTurn || 0}-${reason}` });
  }
  return careerDelta;
}
function updateManagerPrestigeFromWins(){
  // V8.73: las victorias ya forman parte de la evaluación anual y no otorgan un segundo prestigio paralelo.
  if(!game?.managerStats) return 0;
  game.managerStats = normalizeManagerStats(game.managerStats);
  const wins = Math.max(0, Math.round(Number(game.managerStats.totals?.won || 0)));
  const step = Math.max(1, Number(MANAGER_PRESTIGE_WINS_STEP || 10));
  game.managerStats.prestigeWinMilestones = Math.max(Number(game.managerStats.prestigeWinMilestones || 0), Math.floor(wins / step));
  return 0;
}
function emptyManagerSeasonStats(season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  return { season:Number(season || 1), clubId:Number(clubId || 0), played:0, won:0, drawn:0, lost:0, gf:0, gc:0 };
}
function managerBalanceObjectiveConfig(){
  return (window.GAME_BALANCE_MANAGER && window.GAME_BALANCE_MANAGER.objetivos) ? window.GAME_BALANCE_MANAGER.objetivos : {};
}
function normalizeObjectiveText(value=''){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function managerObjectiveDivisionKey(order=3){
  const value = Math.round(Number(order || 3));
  if(value <= 1) return 'primera';
  if(value === 2) return 'segunda';
  return 'tercera';
}
function managerObjectiveLeagueClubs(clubId){
  const targetClubId = Number(clubId || game?.selectedClubId || 0);
  const club = seed?.clubs?.find(c => Number(c.id) === targetClubId);
  if(!club) return [];
  const divisionId = String(club.divisionId || 'default');
  return (seed?.clubs || []).filter(item => String(item.divisionId || 'default') === divisionId);
}
function managerObjectiveAverageLeaguePrestige(clubId){
  const clubs = managerObjectiveLeagueClubs(clubId);
  if(!clubs.length) return clubPrestigeValue(clubId);
  const total = clubs.reduce((sum, item) => sum + clubPrestigeValue(item), 0);
  return total / clubs.length;
}
function managerObjectiveEntryForValue(list=[], value=0){
  const n = Number(value || 0);
  const items = Array.isArray(list) ? list : [];
  const deltaRule = items.find(item => Number.isFinite(Number(item.minDelta)) && n >= Number(item.minDelta));
  if(deltaRule) return deltaRule;
  return items.find(item => n >= Number(item.min ?? -999) && n <= Number(item.max ?? 999)) || null;
}
function managerObjectiveBaseValueForDivision(division={}, clubId=0){
  const cfg = managerBalanceObjectiveConfig();
  const bases = cfg.basesPorDivision || {};
  const order = Math.round(Number(division?.order || 3));
  if(order <= 1){
    const club = seed?.clubs?.find(c => Number(c.id) === Number(clubId || game?.selectedClubId || 0));
    const country = normalizeObjectiveText(division?.country || division?.pais || clubCountry(club));
    const strongCountries = Array.isArray(cfg.paisesPrimeraFuerte) ? cfg.paisesPrimeraFuerte.map(normalizeObjectiveText) : [];
    return Number(strongCountries.includes(country) ? (bases.primeraFuerte ?? 1.25) : (bases.primeraMedia ?? 1.20));
  }
  if(order === 2) return Number(bases.segunda ?? 1.05);
  return Number(bases.tercera ?? 0.90);
}
function managerObjectiveLimitsForDivision(division={}){
  const cfg = managerBalanceObjectiveConfig();
  const key = managerObjectiveDivisionKey(division?.order || 3);
  const limits = (cfg.limitesPorDivision || {})[key] || {};
  const fallback = key === 'primera' ? { min:0.95, max:2.10 } : key === 'segunda' ? { min:0.80, max:2.00 } : { min:0.70, max:1.90 };
  return {
    min:Number.isFinite(Number(limits.min)) ? Number(limits.min) : fallback.min,
    max:Number.isFinite(Number(limits.max)) ? Number(limits.max) : fallback.max
  };
}
function managerObjectiveManagerPrestigePressure(clubId){
  const cfg = typeof configValue === 'function' ? configValue('manager.carrera.progresionLarga.presionExpectativas', {}) : {};
  if(cfg?.activo === false) return { bonus:0, careerPrestige:0, accessPrestige:0, advantage:0 };
  const careerPrestige = Number(typeof currentManagerCareerPrestige === 'function'
    ? currentManagerCareerPrestige(game)
    : game?.managerStats?.careerProfile?.prestige || 0);
  const accessPrestige = Number(typeof managerCareerPrestigeToClubScale === 'function'
    ? managerCareerPrestigeToClubScale(careerPrestige)
    : currentManagerPrestige());
  const advantage = accessPrestige - clubPrestigeValue(clubId);
  const fromPrestige = Number(cfg?.prestigioCarreraDesde ?? 600);
  const fromAdvantage = Number(cfg?.ventajaAccesoDesde ?? 10);
  if(careerPrestige < fromPrestige || advantage < fromAdvantage) return { bonus:0, careerPrestige, accessPrestige, advantage };
  const prestigeFactor = clamp((careerPrestige - fromPrestige) / Math.max(1, 1000 - fromPrestige), 0, 1);
  const advantageFactor = clamp((advantage - fromAdvantage) / 30, 0, 1);
  const maxBonus = Math.max(0, Number(cfg?.bonusPpgMaximo ?? 0.18));
  const bonus = clamp(maxBonus * (prestigeFactor * 0.60 + advantageFactor * 0.40), 0, maxBonus);
  return { bonus:Number(bonus.toFixed(3)), careerPrestige, accessPrestige, advantage };
}
function managerObjectiveBreakdownForClubDivision(clubId){
  const targetClubId = clubId || game?.selectedClubId;
  if(isFoundedClubId(targetClubId)) return { active:false, objective:null, reason:'fundador' };
  const cfg = managerBalanceObjectiveConfig();
  const division = clubDivision(targetClubId);
  const manualAllowed = cfg.respetarObjetivoManualConfig !== false;
  if(manualAllowed && Number.isFinite(Number(MANAGER_OBJECTIVE_PPG)) && Number(MANAGER_OBJECTIVE_PPG) >= 0.3 && Number(MANAGER_OBJECTIVE_PPG) <= 2){
    const limits = managerObjectiveLimitsForDivision(division);
    const manualObjective = clamp(Number(MANAGER_OBJECTIVE_PPG), limits.min, limits.max);
    return {
      active:true,
      source:'manual',
      objective:Number(manualObjective.toFixed(3)),
      basePpg:Number(manualObjective.toFixed(3)),
      modifierPpg:0,
      prestige:clubPrestigeValue(targetClubId),
      leagueAveragePrestige:managerObjectiveAverageLeaguePrestige(targetClubId),
      prestigeRelative:0,
      expectation:'Objetivo manual',
      divisionKey:managerObjectiveDivisionKey(division?.order || 3),
      minLimit:limits.min,
      maxLimit:limits.max
    };
  }
  if(cfg.activo === false || cfg.usarPrestigioRelativo === false){
    const order = Math.round(Number(division?.order || 3));
    const legacy = order <= 1 ? Number(MANAGER_OBJECTIVE_DIVISION_1 || 1.4) : order === 2 ? Number(MANAGER_OBJECTIVE_DIVISION_2 || 1.1) : Number(MANAGER_OBJECTIVE_DIVISION_3 || 0.9);
    return { active:true, source:'legacy', objective:Number(legacy.toFixed(3)), basePpg:Number(legacy.toFixed(3)), modifierPpg:0, prestige:clubPrestigeValue(targetClubId), leagueAveragePrestige:managerObjectiveAverageLeaguePrestige(targetClubId), prestigeRelative:0, expectation:'Objetivo por división', divisionKey:managerObjectiveDivisionKey(division?.order || 3) };
  }
  const prestige = clubPrestigeValue(targetClubId);
  const avg = managerObjectiveAverageLeaguePrestige(targetClubId);
  const relative = Math.round(prestige - avg);
  const base = managerObjectiveBaseValueForDivision(division, targetClubId);
  const modEntry = managerObjectiveEntryForValue(cfg.modificadoresPrestigioRelativo, relative);
  const modifier = Number(modEntry?.ppg || 0);
  const managerPressure = managerObjectiveManagerPrestigePressure(targetClubId);
  const limits = managerObjectiveLimitsForDivision(division);
  const raw = base + modifier + Number(managerPressure.bonus || 0);
  const objective = clamp(raw, limits.min, limits.max);
  const expectationEntry = managerObjectiveEntryForValue(cfg.expectativasPrestigioRelativo, relative);
  return {
    active:true,
    source:'prestigio_relativo',
    objective:Number(objective.toFixed(3)),
    basePpg:Number(base.toFixed(3)),
    modifierPpg:Number(modifier.toFixed(3)),
    rawPpg:Number(raw.toFixed(3)),
    prestige,
    leagueAveragePrestige:Number(avg.toFixed(2)),
    prestigeRelative:relative,
    managerExpectationBonusPpg:Number(managerPressure.bonus || 0),
    managerCareerPrestige:Number(managerPressure.careerPrestige || 0),
    expectation:managerPressure.bonus > 0 ? `${expectationEntry?.texto || 'Mitad de tabla'} · exigencia adicional por prestigio del mánager` : (expectationEntry?.texto || 'Mitad de tabla'),
    divisionKey:managerObjectiveDivisionKey(division?.order || 3),
    minLimit:limits.min,
    maxLimit:limits.max
  };
}
function managerObjectiveBaseForClubDivision(clubId){
  const info = managerObjectiveBreakdownForClubDivision(clubId);
  return Number.isFinite(Number(info?.objective)) ? Number(Number(info.objective).toFixed(3)) : null;
}
function managerObjectiveReductionForClub(clubId){
  const targetClubId = clubId || game?.selectedClubId;
  if(Number(targetClubId) === Number(game?.selectedClubId || 0) && typeof specialActiveBonus === 'function'){
    return clamp(Number(specialActiveBonus('objetivo_mas_bajo') || 0), 0, 80);
  }
  return 0;
}
function applyManagerObjectiveReduction(baseObjective, clubId){
  const base = Number(baseObjective);
  if(!Number.isFinite(base)) return null;
  const reduction = managerObjectiveReductionForClub(clubId);
  const objective = reduction > 0 ? base * (1 - reduction / 100) : base;
  return Number(objective.toFixed(3));
}
function managerObjectiveForClubDivision(clubId){
  return applyManagerObjectiveReduction(managerObjectiveBaseForClubDivision(clubId), clubId);
}
function managerObjectiveMinMatchesForObjective(objective){
  const cfg = managerBalanceObjectiveConfig();
  const rules = Array.isArray(cfg.partidosMinimosEvaluacion) ? cfg.partidosMinimosEvaluacion : [];
  const value = Number(objective || 0);
  const rule = rules.find(item => value <= Number(item.maxObjetivo ?? 9.99));
  if(rule && Number.isFinite(Number(rule.partidos))) return Math.max(1, Math.round(Number(rule.partidos)));
  return Math.max(1, Number(MANAGER_OBJECTIVE_MIN_MATCHES || 5));
}
function bankruptcyFirstSeasonObjectiveActive(season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  return currentGameIsBankruptcyMode() && Number(season || 1) === 1 && Number(clubId || 0) === Number(game?.selectedClubId || 0);
}
function buildBankruptcyFirstSeasonObjectiveFields(stats, season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  const normalized = normalizeManagerStats(stats);
  const generalPpg = ppgFromTotals(normalized.totals || {});
  const division = clubDivision(clubId);
  const limits = managerObjectiveLimitsForDivision(division);
  const objective = Number(Number(limits.min || 0.8).toFixed(3));
  const baseMatches = managerObjectiveMinMatchesForObjective(objective);
  return {
    objectiveBasePpg:objective,
    objectivePpg:objective,
    objectiveBonusReduction:0,
    objectiveBaseMatches:baseMatches,
    objectiveExtraMatches:0,
    objectiveMinMatches:baseMatches,
    objectiveGeneralPpgAtStart:generalPpg,
    objectiveSeason:Number(season || 1),
    objectiveClubId:Number(clubId || 0),
    objectiveSource:'bancarrota',
    objectiveExpectation:'No descender',
    objectiveLabel:'No descender',
    objectiveFixed:true,
    objectivePrestigeRelative:null,
    objectiveClubPrestige:clubPrestigeValue(clubId),
    objectiveLeagueAveragePrestige:Number(managerObjectiveAverageLeaguePrestige(clubId).toFixed(2)),
    objectiveModifierPpg:0,
    objectiveDivisionKey:managerObjectiveDivisionKey(division?.order || 3)
  };
}
function managerObjectiveResultDelta(ppg, objective){
  const a = Number(ppg || 0);
  const b = Number(objective || 0);
  return Number.isFinite(a) && Number.isFinite(b) ? Number((a - b).toFixed(3)) : 0;
}
function managerObjectiveBoardState(delta){
  const cfg = managerBalanceObjectiveConfig();
  const entry = managerObjectiveEntryForValue(cfg.estadosDirectiva, Number(delta || 0));
  return entry || { estado:'Cumple', clase:'ok', despido:false };
}
function managerObjectivePrestigeRewardForDelta(delta){
  const cfg = managerBalanceObjectiveConfig();
  const entry = managerObjectiveEntryForValue(cfg.prestigioPorResultado, Number(delta || 0));
  if(!entry) return { points:0, label:'Sin ajuste por objetivo' };
  return { points:Math.round(Number(entry.puntos || 0)), label:String(entry.etiqueta || 'Resultado de objetivo') };
}
function managerObjectiveBadSeasonPenalty({ relegated=false, last=false }={}){
  const cfg = managerBalanceObjectiveConfig();
  const penalties = cfg.penalizacionesTemporada || {};
  const raw = (relegated ? Number(penalties.descenso ?? -8) : 0) + (last ? Number(penalties.ultimoPuestoAdicional ?? -5) : 0);
  return Math.max(0, Math.abs(Math.round(raw)));
}
function buildManagerObjectiveSeasonFields(stats, season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  if(bankruptcyFirstSeasonObjectiveActive(season, clubId)) return buildBankruptcyFirstSeasonObjectiveFields(stats, season, clubId);
  const normalized = normalizeManagerStats(stats);
  const generalPpg = ppgFromTotals(normalized.totals || {});
  const dynamicInfo = managerObjectiveBreakdownForClubDivision(clubId);
  const baseObjective = Number.isFinite(Number(dynamicInfo?.objective)) ? Number(dynamicInfo.objective) : managerObjectiveBaseForClubDivision(clubId);
  const objective = applyManagerObjectiveReduction(baseObjective, clubId);
  const baseMatches = managerObjectiveMinMatchesForObjective(objective);
  const extraMatches = 0;
  const fields = {
    objectiveBasePpg:Number.isFinite(Number(baseObjective)) ? Number(baseObjective) : null,
    objectivePpg:Number.isFinite(Number(objective)) ? objective : null,
    objectiveBonusReduction:managerObjectiveReductionForClub(clubId),
    objectiveBaseMatches:baseMatches,
    objectiveExtraMatches:extraMatches,
    objectiveMinMatches:baseMatches + extraMatches,
    objectiveGeneralPpgAtStart:generalPpg,
    objectiveSeason:Number(season || 1),
    objectiveClubId:Number(clubId || 0),
    objectiveSource:dynamicInfo?.source || 'division',
    objectiveExpectation:dynamicInfo?.expectation || '',
    objectivePrestigeRelative:Number.isFinite(Number(dynamicInfo?.prestigeRelative)) ? Number(dynamicInfo.prestigeRelative) : null,
    objectiveClubPrestige:Number.isFinite(Number(dynamicInfo?.prestige)) ? Number(dynamicInfo.prestige) : null,
    objectiveLeagueAveragePrestige:Number.isFinite(Number(dynamicInfo?.leagueAveragePrestige)) ? Number(dynamicInfo.leagueAveragePrestige) : null,
    objectiveModifierPpg:Number.isFinite(Number(dynamicInfo?.modifierPpg)) ? Number(dynamicInfo.modifierPpg) : 0,
    objectiveDivisionKey:dynamicInfo?.divisionKey || ''
  };
  return typeof applyManagerJobContractToObjectiveFields === 'function' ? applyManagerJobContractToObjectiveFields(fields, clubId, season) : fields;
}
function applyManagerObjectiveSeasonFields(current, stats, season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  const clean = { ...(current || {}) };
  if(bankruptcyFirstSeasonObjectiveActive(season, clubId)){
    Object.assign(clean, buildBankruptcyFirstSeasonObjectiveFields(stats, season, clubId));
    return clean;
  }
  const needsRefresh = !MANAGER_OBJECTIVE_FREEZE_BY_SEASON
    || !Number.isFinite(Number(clean.objectiveMinMatches || 0))
    || !Number.isFinite(Number(clean.objectivePpg || 0))
    || Number(clean.objectiveSeason || 0) !== Number(season || 1)
    || Number(clean.objectiveClubId || 0) !== Number(clubId || 0);
  if(needsRefresh){
    Object.assign(clean, buildManagerObjectiveSeasonFields(stats, season, clubId));
  } else {
    const dynamicInfo = managerObjectiveBreakdownForClubDivision(clubId);
    const baseObjective = Number.isFinite(Number(clean.objectiveBasePpg)) ? Number(clean.objectiveBasePpg) : managerObjectiveBaseForClubDivision(clubId);
    clean.objectiveBasePpg = Number.isFinite(Number(baseObjective)) ? Number(baseObjective) : null;
    clean.objectiveBonusReduction = managerObjectiveReductionForClub(clubId);
    clean.objectivePpg = applyManagerObjectiveReduction(clean.objectiveBasePpg, clubId);
    clean.objectiveExpectation = clean.objectiveExpectation || dynamicInfo?.expectation || '';
    clean.objectivePrestigeRelative = Number.isFinite(Number(clean.objectivePrestigeRelative)) ? Number(clean.objectivePrestigeRelative) : (Number.isFinite(Number(dynamicInfo?.prestigeRelative)) ? Number(dynamicInfo.prestigeRelative) : null);
    clean.objectiveClubPrestige = Number.isFinite(Number(clean.objectiveClubPrestige)) ? Number(clean.objectiveClubPrestige) : (Number.isFinite(Number(dynamicInfo?.prestige)) ? Number(dynamicInfo.prestige) : null);
    clean.objectiveLeagueAveragePrestige = Number.isFinite(Number(clean.objectiveLeagueAveragePrestige)) ? Number(clean.objectiveLeagueAveragePrestige) : (Number.isFinite(Number(dynamicInfo?.leagueAveragePrestige)) ? Number(dynamicInfo.leagueAveragePrestige) : null);
    clean.objectiveModifierPpg = Number.isFinite(Number(clean.objectiveModifierPpg)) ? Number(clean.objectiveModifierPpg) : (Number.isFinite(Number(dynamicInfo?.modifierPpg)) ? Number(dynamicInfo.modifierPpg) : 0);
    clean.objectiveSource = clean.objectiveSource || dynamicInfo?.source || 'division';
  }
  return typeof applyManagerJobContractToObjectiveFields === 'function' ? applyManagerJobContractToObjectiveFields(clean, clubId, season) : clean;
}
function ensureManagerCurrentSeasonStats(stats, season=game?.seasonNumber || 1, clubId=game?.selectedClubId || 0){
  const normalized = normalizeManagerStats(stats);
  const current = normalized.currentSeason || {};
  if(Number(current.season || 0) !== Number(season || 1) || Number(current.clubId || 0) !== Number(clubId || 0)){
    normalized.currentSeason = applyManagerObjectiveSeasonFields(emptyManagerSeasonStats(season, clubId), normalized, season, clubId);
  } else {
    normalized.currentSeason = applyManagerObjectiveSeasonFields(current, normalized, season, clubId);
  }
  return normalized;
}
function normalizeGameOverState(state){
  if(!state || typeof state !== 'object') return null;
  const active = Boolean(state.active);
  if(!active) return null;
  return {
    active:true,
    type:String(state.type || 'dismissal'),
    reason:String(state.reason || 'Objetivo deportivo no cumplido'),
    triggeredAt:state.triggeredAt || new Date().toISOString(),
    objective:Number(state.objective || 0),
    ppg:Number(state.ppg || 0),
    matches:Number(state.matches || 0),
    snapshot:state.snapshot && typeof state.snapshot === 'object' ? state.snapshot : null
  };
}
function managerObjectiveForCurrentDivision(){
  return managerObjectiveForClubDivision(game?.selectedClubId);
}
function managerObjectiveIsActive(){
  if(currentGameIsFounderMode()) return false;
  const objective = managerObjectiveForCurrentDivision();
  return Number.isFinite(objective) && objective >= 0.3 && objective <= 3;
}
function managerOfficialTotals(){
  return normalizeManagerStats(game?.managerStats).totals;
}
function managerSeasonObjectiveTotals(){
  game.managerStats = ensureManagerCurrentSeasonStats(game?.managerStats, game?.seasonNumber || 1, game?.selectedClubId || 0);
  return game.managerStats.currentSeason || emptyManagerSeasonStats(game?.seasonNumber || 1, game?.selectedClubId || 0);
}
function ppgFromTotals(totals){
  const played = Number(totals?.played || 0);
  const points = (Number(totals?.won || 0) * 3) + Number(totals?.drawn || 0);
  return played > 0 ? points / played : 0;
}
function managerGeneralPPG(){
  return ppgFromTotals(managerOfficialTotals());
}
function managerCurrentPPG(){
  return ppgFromTotals(managerSeasonObjectiveTotals());
}
function managerObjectiveProgressInfo(){
  const seasonTotals = managerSeasonObjectiveTotals();
  const played = Number(seasonTotals.played || 0);
  const ppg = managerCurrentPPG();
  const objective = managerObjectiveIsActive() ? Number(seasonTotals.objectivePpg ?? managerObjectiveForCurrentDivision()) : null;
  const baseMinMatches = Math.max(1, Number(seasonTotals.objectiveBaseMatches || MANAGER_OBJECTIVE_MIN_MATCHES || 5));
  const extraMatches = Math.max(0, Number(seasonTotals.objectiveExtraMatches || 0));
  const minMatches = Math.max(baseMinMatches, Number(seasonTotals.objectiveMinMatches || (baseMinMatches + extraMatches)));
  const generalPpg = Number.isFinite(Number(seasonTotals.objectiveGeneralPpgAtStart)) ? Number(seasonTotals.objectiveGeneralPpgAtStart) : managerGeneralPPG();
  const confidence = objective ? clamp((ppg / objective) * 100, 0, 140) : 0;
  const delta = objective !== null ? managerObjectiveResultDelta(ppg, objective) : 0;
  const boardState = managerObjectiveBoardState(delta);
  return {
    active:objective !== null,
    objective,
    baseMinMatches,
    extraMatches,
    minMatches,
    played,
    ppg,
    generalPpg,
    progress:confidence,
    confidence,
    delta,
    boardState:boardState.estado,
    boardClass:boardState.clase,
    expectation:seasonTotals.objectiveExpectation || '',
    label:seasonTotals.objectiveLabel || '',
    prestigeRelative:seasonTotals.objectivePrestigeRelative,
    clubPrestige:seasonTotals.objectiveClubPrestige,
    leagueAveragePrestige:seasonTotals.objectiveLeagueAveragePrestige,
    modifierPpg:seasonTotals.objectiveModifierPpg,
    bonusReduction:Math.max(0, Number(seasonTotals.objectiveBonusReduction || 0)),
    contractObjective:Number.isFinite(Number(seasonTotals.objectiveContractPpg)) ? Number(seasonTotals.objectiveContractPpg) : null,
    remainingMatches:Math.max(0, minMatches - played),
    failed:objective !== null && played >= minMatches && Boolean(boardState.despido)
  };
}

function queueAutomaticRankingSubmission(eventType='season_end'){
  if(!game) return false;
  game.rankingUploads = game.rankingUploads && typeof game.rankingUploads === 'object' && !Array.isArray(game.rankingUploads) ? game.rankingUploads : {};
  const label = typeof rankingEventLabel === 'function' ? rankingEventLabel(eventType) : (eventType === 'dismissal' ? 'Carrera cerrada por despido' : 'Carrera actualizada');
  const capturedPayload = String(eventType || '') === 'dismissal' && game?.gameOver?.snapshot
    ? { ...game.gameOver.snapshot, eventType:'dismissal', eventLabel:label, submittedAt:new Date().toISOString() }
    : (typeof buildRankingPayload === 'function' ? buildRankingPayload(game?.rankingManagerName || storedManagerName() || 'Manager', { eventType, eventLabel:label }) : null);
  const run = () => {
    if(typeof submitRankingAutomatically === 'function'){
      submitRankingAutomatically(eventType, { notifyErrors:false, forceRetry:true, payload:capturedPayload, eventLabel:label });
    }else if(typeof pushGameMessage === 'function'){
      pushGameMessage({ type:'sistema', priority:'normal', title:'Ranking pendiente', body:'El módulo de ranking no estaba listo. Volvé a abrir la partida o la pantalla Ranking para reintentar el envío automático.', id:`ranking-module-missing-${eventType}-${game.seasonNumber || 1}` });
      if(typeof saveLocal === 'function') saveLocal(true);
    }
  };
  setTimeout(run, 0);
  return true;
}

function gameOverSnapshot(){
  if(typeof buildRankingPayload === 'function'){
    const payload = buildRankingPayload(game?.rankingManagerName || storedManagerName() || 'Manager');
    if(payload) return payload;
  }
  const totals = managerOfficialTotals();
  const division = clubDivision(game?.selectedClubId);
  const table = sortedStandings(division.id);
  const index = table.findIndex(row => Number(row.clubId) === Number(game?.selectedClubId));
  const row = table[index] || game?.standings?.[game?.selectedClubId] || {};
  return {
    managerName:game?.rankingManagerName || storedManagerName() || 'Manager',
    club:clubName(game?.selectedClubId),
    season:Number(game?.seasonNumber || 1),
    division:division.name,
    position:index >= 0 ? index + 1 : 0,
    points:Number(row.pts || 0),
    won:Number(totals.won || 0),
    drawn:Number(totals.drawn || 0),
    lost:Number(totals.lost || 0),
    goalsFor:Number(totals.gf || 0),
    goalsAgainst:Number(totals.gc || 0),
    goalDifference:Number(totals.gf || 0) - Number(totals.gc || 0),
    finalBudget:Number(game?.budget || 0),
    titles:Number(game?.managerStats?.titles || 0),
    managerScore:0,
    saveCode:game?.saveCode || ''
  };
}
function checkManagerObjectiveGameOver(){
  if(typeof managerChallengeIs === 'function' && managerChallengeIs()) return false;
  if(!game || game.gameOver?.active || !managerObjectiveIsActive()) return false;
  const info = managerObjectiveProgressInfo();
  if(!info.failed) return false;
  game.gameOver = {
    active:true,
    type:'dismissal',
    reason:`La directiva perdió confianza: promedio ${info.ppg.toFixed(2)} / objetivo ${info.objective.toFixed(2)} (${info.delta.toFixed(2)}) tras ${info.played} partidos oficiales de la temporada.`,
    triggeredAt:new Date().toISOString(),
    objective:info.objective,
    ppg:info.ppg,
    matches:info.played,
    snapshot:gameOverSnapshot()
  };
  game.mustReviewTactics = false;
  if(typeof archiveManagerPlayerStatsClub === 'function') archiveManagerPlayerStatsClub(game.selectedClubId, { final:true });
  if(typeof clearScoutedSigningChances === 'function') clearScoutedSigningChances();
  prepareManagerWithoutClubUi('dismissal');
  recordDismissedCareerStep();
  if(typeof resetOutgoingClubStateAfterManagerExit === 'function') resetOutgoingClubStateAfterManagerExit(game.selectedClubId, 'dismissal');
  pushGameMessage({ type:'directiva', priority:'high', title:'Despido del manager', body:`La directiva decidió terminar el ciclo por falta de resultados y pérdida de confianza. El impacto profesional se calculará dentro de la evaluación integral de esta etapa. Podés buscar otro club sin reiniciar el mundo de la partida.`, id:`dismissal-${game.seasonNumber || 1}-${game.selectedClubId}-${info.played}` });
  queueAutomaticRankingSubmission('dismissal');
  return true;
}
function ensureClubBudgetsState(){
  if(!game) return {};
  game.clubBudgets = (game.clubBudgets && typeof game.clubBudgets === 'object' && !Array.isArray(game.clubBudgets)) ? game.clubBudgets : {};
  seed.clubs.forEach(c => { if(!Number.isFinite(Number(game.clubBudgets[c.id]))) game.clubBudgets[c.id] = Math.round(Number(c.budget || 0)); });
  if(Number.isFinite(Number(game.selectedClubId))) game.clubBudgets[game.selectedClubId] = Math.round(Number(game.budget || game.clubBudgets[game.selectedClubId] || 0));
  return game.clubBudgets;
}
function budgetForCareerClub(clubId){
  ensureClubBudgetsState();
  return Math.max(0, Math.round(Number(game?.clubBudgets?.[clubId] ?? seed.clubs.find(c => Number(c.id) === Number(clubId))?.budget ?? 0)));
}
function recordDismissedCareerStep(){
  if(!game?.managerStats || !game?.gameOver?.active) return;
  game.managerStats = normalizeManagerStats(game.managerStats);
  const eventType = game.gameOver.type === 'resignation' ? 'resignation' : 'dismissal';
  const key = `${game.gameOver.triggeredAt || ''}-${game.selectedClubId}-${eventType}`;
  if(game.managerStats.careerHistory.some(item => item.key === key)) return;
  const division = clubDivision(game.selectedClubId);
  const table = sortedStandings(division.id);
  const position = table.findIndex(row => Number(row.clubId) === Number(game.selectedClubId)) + 1;
  const season = managerSeasonObjectiveTotals();
  game.managerStats.careerHistory.push({
    key,
    type:eventType,
    season:Number(game.seasonNumber || 1),
    clubId:Number(game.selectedClubId || 0),
    clubName:clubName(game.selectedClubId),
    divisionName:division.name,
    position:position || 0,
    played:Number(season.played || 0),
    won:Number(season.won || 0),
    drawn:Number(season.drawn || 0),
    lost:Number(season.lost || 0),
    ppg:ppgFromTotals(season),
    reason:game.gameOver.reason || (eventType === 'resignation' ? 'Renuncia del manager' : 'Despido por objetivo no cumplido'),
    date:game.currentDate || '',
    createdAt:new Date().toISOString()
  });
  game.managerStats = normalizeManagerStats(game.managerStats);
  if(typeof checkManagerAchievements === 'function') checkManagerAchievements({ silent:false });
}
function resetClubSpecificCareerStateForNewClub(newClubId){
  if(!game) return;
  game.staffActions = {};
  game.staffContracts = {};
  if(typeof resetScoutingCenterForNewClub === 'function') resetScoutingCenterForNewClub(newClubId);
  game.monthlyExpenses = {};
  game.academy = normalizeAcademyState(game.academy);
  game.lastOwnPlayerOffer = null;
  if(typeof closeTransferOfferMessagesForClubExit === 'function') closeTransferOfferMessagesForClubExit();
  if(typeof clearPendingTransferAgreementFlags === 'function') clearPendingTransferAgreementFlags(game);
  game.pendingTransfers = [];
  game.rejectedPurchaseOffers = {};
  game.rejectedFreeAgentOffers = {};
  game.specialClauseOffers = null;
  if(typeof createBankLoanState === 'function'){
    game.bankLoan = createBankLoanState(game.seasonNumber || 1);
  }else{
    game.bankLoan = null;
  }
  if(typeof createInitialSponsorState === 'function'){
    game.sponsors = createInitialSponsorState();
  }else if(typeof normalizeSponsorState === 'function'){
    game.sponsors = normalizeSponsorState({});
  }else{
    game.sponsors = {};
  }
  game.playerMentalities = {};
  if(game.tactic){
    game.tactic = typeof applyStarterMentalities === 'function' ? applyStarterMentalities({ ...game.tactic, playerMentalities:{} }) : { ...game.tactic, playerMentalities:{} };
  }
}

function resignCurrentClub(){
  if(!game || game.gameOver?.active) return;
  const ok = window.confirm('Vas a renunciar al club actual. La partida no se reinicia, pero quedarás sin cargo hasta buscar otro club.');
  if(!ok) return;
  game.gameOver = {
    active:true,
    type:'resignation',
    reason:'Renunciaste al cargo. Podés buscar otro club disponible según tu prestigio.',
    triggeredAt:new Date().toISOString(),
    objective:managerObjectiveForCurrentDivision(),
    ppg:managerCurrentPPG(),
    matches:Number(managerSeasonObjectiveTotals().played || 0),
    snapshot:gameOverSnapshot()
  };
  game.mustReviewTactics = false;
  if(typeof archiveManagerPlayerStatsClub === 'function') archiveManagerPlayerStatsClub(game.selectedClubId, { final:true });
  if(typeof clearScoutedSigningChances === 'function') clearScoutedSigningChances();
  prepareManagerWithoutClubUi('resignation');
  recordDismissedCareerStep();
  if(typeof resetOutgoingClubStateAfterManagerExit === 'function') resetOutgoingClubStateAfterManagerExit(game.selectedClubId, 'resignation');
  pushGameMessage({ type:'directiva', priority:'high', title:'Renuncia del manager', body:'Presentaste la renuncia. El mundo de la partida sigue activo y podés buscar otro club.', id:`resignation-${game.seasonNumber || 1}-${game.selectedClubId}-${game.globalTurn || 0}` });
  saveLocal(true);
  renderAll();
  showNotice('Renuncia registrada. Usá Buscar club para continuar tu carrera.');
}
function continueCareerAtClub(selectedClubId, options={}){
  const employedTransition = Boolean(options.allowEmployedTransition && game && !game.gameOver?.active && Number(game.selectedClubId || 0) !== Number(selectedClubId || 0));
  if(!game?.gameOver?.active && !employedTransition){ showNotice('Sólo podés buscar otro club cuando estás sin cargo o aceptar una oferta laboral activa.'); return; }
  const previousClubId = Number(game?.selectedClubId || 0);
  const newClub = seed.clubs.find(c => Number(c.id) === Number(selectedClubId));
  if(!newClub){ showNotice('Club no encontrado.'); return; }
  if(typeof managerClubCareerEligible === 'function' && !managerClubCareerEligible(newClub)){
    showNotice('Ese equipo no pertenece a una liga jugable y no puede contratar managers.');
    return;
  }
  const rehireBlock = managerClubRehireBlockInfo(newClub);
  if(rehireBlock.blocked){
    const cause = rehireBlock.type === 'resignation' ? 'renuncia' : 'despido';
    showNotice(`${newClub.name} no acepta tu regreso todavía: bloqueo por ${cause} hasta la temporada ${rehireBlock.untilSeason}.`);
    return;
  }
  const canSignNormally = managerCanSelectClub(newClub, currentManagerPrestige());
  const highRiskOffer = options.jobOffer && String(options.jobOffer.contractType || '') === 'high_risk';
  if(!canSignNormally && !(options.allowHighRiskContract && highRiskOffer)){
    showNotice(`Ese club requiere prestigio ${clubPrestigeValue(newClub)}. Tu prestigio actual es ${formatManagerPrestige(currentManagerPrestige())}.`);
    return;
  }
  ensureClubBudgetsState();
  if(employedTransition){
    if(typeof archiveManagerPlayerStatsClub === 'function') archiveManagerPlayerStatsClub(previousClubId, { final:true });
    if(typeof clearScoutedSigningChances === 'function') clearScoutedSigningChances();
    if(typeof managerCareerFinalizeCurrentStint === 'function'){
      managerCareerFinalizeCurrentStint({
        status:'club_change',
        partial:true,
        key:`club_change:${game.seasonNumber || 1}:${previousClubId}:${game.managerStats?.currentSeason?.careerStintId || game.globalTurn || 0}`
      });
    }
    if(typeof resetOutgoingClubStateAfterManagerExit === 'function') resetOutgoingClubStateAfterManagerExit(previousClubId, 'job_offer');
  }else{
    recordDismissedCareerStep();
  }
  // La caja del club saliente ya quedó persistida antes de limpiar el estado del mánager.
  game.selectedClubId = Number(newClub.id);
  game.selectedCountry = clubCountry(newClub);
  game.selectedLeagueId = newClub.divisionId || 'default';
  const newClubSpecialReset = typeof resetActiveSpecialCardsToReserveForNewClub === 'function' ? resetActiveSpecialCardsToReserveForNewClub({ reason:'new_job' }) : null;
  game.budget = budgetForCareerClub(newClub.id);
  game.seasonInitialBudget = Math.round(Number(game.budget || 0));
  game.lastBudgetDelta = 0;
  game.tactic = normalizeTactic(newClub.id, DEFAULT_TACTIC);
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, newClub.id);
  game.transferBudget = typeof createTransferBudgetState === 'function' ? createTransferBudgetState(newClub.id, game.seasonNumber || 1, 0) : game.transferBudget;
  resetClubSpecificCareerStateForNewClub(newClub.id);
  const inheritedSponsors = typeof initializeInheritedSponsorsForNewClub === 'function'
    ? initializeInheritedSponsorsForNewClub(newClub.id, { reason:employedTransition ? 'job_offer' : (game.gameOver?.type || 'new_job') })
    : { count:0, totalPlaces:0, ratio:0 };
  const inheritedCaptains = typeof initializeCaptaincyExperienceForNewClub === 'function'
    ? initializeCaptaincyExperienceForNewClub(newClub.id, { reason:employedTransition ? 'job_offer' : (game.gameOver?.type || 'new_job') })
    : { count:0, players:[] };
  if(highRiskOffer){
    game.managerJobContract = {
      clubId:Number(newClub.id),
      season:Number(game.seasonNumber || 1),
      contractType:'high_risk',
      signedDate:game.currentDate || '',
      objectiveBonus:Number(options.jobOffer.objectiveBonus || 0.25),
      transferBudgetRate:Number(options.jobOffer.transferBudgetRate || 0.05),
      source:String(options.jobOffer.source || 'application')
    };
    if(game.transferBudget && typeof game.transferBudget === 'object'){
      game.transferBudget.baseRate = Math.min(Number(game.transferBudget.baseRate || 1), Number(game.managerJobContract.transferBudgetRate || 0.05));
      game.transferBudget.unlockedRate = 0;
      game.transferBudget.history = Array.isArray(game.transferBudget.history) ? game.transferBudget.history : [];
      game.transferBudget.history.push({ type:'job_restriction', text:'Contrato exigente: presupuesto de fichajes muy restringido', amount:0, rate:game.transferBudget.baseRate, date:game.currentDate || '' });
    }
  }else{
    game.managerJobContract = null;
  }
  game.managerStats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber || 1, newClub.id);
  if(typeof checkManagerAchievements === 'function') checkManagerAchievements({ silent:false });
  if(typeof removeManagerJobOffer === 'function' && options.jobOffer?.id) removeManagerJobOffer(options.jobOffer.id);
  if(game.managerJobMarket){ game.managerJobMarket.applications = []; }
  game.gameOver = null;
  game.mustReviewTactics = true;
  activeTab = 'home';
  closeModal();
  const specialResetText = newClubSpecialReset?.returned ? ` ${newClubSpecialReset.returned} carta(s) activa(s) volvieron a la reserva.` : '';
  const inheritedStateText = ` El club conserva ${Number(inheritedSponsors.count || 0)} sponsor(s) activo(s) de ${Number(inheritedSponsors.totalPlaces || 0)} espacios habilitados y ${Number(inheritedCaptains.count || 0)} jugador(es) con experiencia previa de capitanía.`;
  const acceptedTitle = employedTransition ? 'Cambio de club confirmado' : 'Nuevo cargo aceptado';
  const acceptedBody = highRiskOffer
    ? `Firmaste con ${newClub.name} con contrato exigente: objetivo superior al normal y fichajes muy restringidos. La partida continúa desde la misma temporada.${inheritedStateText}${specialResetText}`
    : employedTransition
      ? `Aceptaste la propuesta de ${newClub.name} y dejaste ${clubName(previousClubId)}. La carrera continúa desde la misma fecha y temporada. Se reiniciaron empleados, acciones de staff, préstamos y cooldowns vinculados al club anterior.${inheritedStateText}${specialResetText}`
      : `Firmaste con ${newClub.name}. La partida continúa desde la misma temporada. Se reiniciaron empleados, acciones de staff, préstamos y cooldowns vinculados al club anterior.${inheritedStateText}${specialResetText}`;
  pushGameMessage({ type:'directiva', priority:'high', title:acceptedTitle, body:acceptedBody, id:`new-job-${game.seasonNumber || 1}-${newClub.id}-${game.globalTurn || 0}` });
  saveLocal(true);
  renderAll();
  showNotice(`Contrato firmado con ${newClub.name}. La carrera continúa desde la misma partida. Revisá la táctica antes de avanzar.`);
}
function updateManagerMatchStats(match){
  if(match?.friendly) return;
  game.managerStats = normalizeManagerStats(game.managerStats);
  const isHome = match.homeId === game.selectedClubId;
  const gf = isHome ? match.homeGoals : match.awayGoals;
  const gc = isHome ? match.awayGoals : match.homeGoals;
  const totals = game.managerStats.totals;
  const seasonTotals = game.managerStats.currentSeason || emptyManagerSeasonStats(game.seasonNumber || 1, game.selectedClubId || 0);
  totals.played += 1;
  totals.gf += gf;
  totals.gc += gc;
  seasonTotals.played += 1;
  seasonTotals.gf += gf;
  seasonTotals.gc += gc;
  let xpGain = MANAGER_XP_DRAW;
  if(gf > gc){ totals.won += 1; seasonTotals.won += 1; xpGain = MANAGER_XP_WIN; }
  else if(gf < gc){ totals.lost += 1; seasonTotals.lost += 1; xpGain = MANAGER_XP_LOSS; }
  else { totals.drawn += 1; seasonTotals.drawn += 1; xpGain = MANAGER_XP_DRAW; }
  game.managerStats.experience = Math.max(0, Math.round(Number(game.managerStats.experience || 0))) + Math.max(0, Math.round(Number(xpGain || 0)));
  game.managerStats.currentSeason = seasonTotals;
  updateManagerPrestigeFromWins();
  if(typeof updateTransferBudgetPerformanceUnlocks === 'function') updateTransferBudgetPerformanceUnlocks();
  if(typeof processSponsorSpecialAfterOwnMatch === 'function') processSponsorSpecialAfterOwnMatch(match);
  if(typeof managerChallengeAfterOwnMatch === 'function') managerChallengeAfterOwnMatch(match);
  if(currentGameIsFounderMode()) evaluateFounderGoals({ silent:false });
  checkManagerAchievements({ silent:false });
  checkManagerObjectiveGameOver();
}
function divisionOrderList(){
  return (seed.divisions || [{ id:'default', name:'Liga única', order:1 }]).slice().sort((a,b)=>(a.order || 0)-(b.order || 0));
}
function clubDivision(clubId){
  const club = seed.clubs.find(c=>c.id===Number(clubId));
  return club ? { id:club.divisionId || 'default', name:club.divisionName || 'Liga única', order:club.divisionOrder || 1 } : { id:'default', name:'Liga única', order:1 };
}
function applyClubDivisionOverrides(overrides={}){
  if(!seed?.clubs) return;
  const divisions = divisionOrderList();
  const byId = Object.fromEntries(divisions.map(d => [d.id, d]));
  seed.clubs.forEach(club => {
    if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(club)) return;
    const override = overrides[club.id];
    const currentDivision = byId[club.divisionId] || divisions.find(d => d.name === club.divisionName);
    let division = currentDivision || null;
    if(override){
      division = byId[override.divisionId] || divisions.find(d => d.name === override.divisionName) || division;
    }
    const clubCountry = clubCountryKeyForIntegrity(club);
    const divisionCountry = division ? divisionCountryKey(division) : '';
    if(!division || (clubCountry && divisionCountry && clubCountry !== divisionCountry)){
      division = nativeTargetDivisionForClub(club, currentDivision || division);
    }
    if(!division) return;
    setClubIntegrityDivision(club, division);
  });
}
function sanitizeClubDivisionOverrides(overrides={}){
  if(!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) return {};
  return Object.fromEntries(Object.entries(overrides).filter(([clubId]) => {
    const club = (seed?.clubs || []).find(item => Number(item.id) === Number(clubId));
    return !(club && isSpecialCompetitionOnlyClub(club));
  }));
}
function snapshotClubDivisionOverrides(){
  return Object.fromEntries((seed.clubs || [])
    .filter(club => !isSpecialCompetitionOnlyClub(club))
    .map(club => [club.id, { divisionId:club.divisionId || 'default', divisionName:club.divisionName || 'Liga única' }]));
}
function playoffRoundMatchdayLabel(index){
  const regularCount = regularFixtureLength();
  const relative = Number(index || 0) - regularCount;
  if(relative === 1) return 'Playoffs IDA';
  if(relative === 2) return 'Playoffs VUELTA';
  return Number(index || 0) > regularCount ? `Playoffs ${relative}` : `Fecha ${Number(index || 0)}`;
}
function isPromotionPlayoffMatch(match){
  return Boolean(match?.playoff || match?.promotionPlayoff || match?.playoffTieId);
}
function isPromotionPlayoffRound(round){
  return Boolean(round?.playoffRound || (round?.matches || []).some(isPromotionPlayoffMatch));
}
function isClubWorldCupRound(round){
  return Boolean(round?.clubWorldCupRound || (round?.matches || []).some(match => match?.clubWorldCup));
}
function isNationalCupRound(round){
  return Boolean(round?.nationalCupRound || (round?.matches || []).some(match => match?.nationalCup));
}
function isLibertadoresRound(round){
  return Boolean(round?.libertadoresRound || (round?.matches || []).some(match => match?.libertadores));
}
function isChampionsLeagueRound(round){
  return Boolean(round?.championsLeagueRound || (round?.matches || []).some(match => match?.championsLeague));
}
function isPostRegularRound(round){
  return isPromotionPlayoffRound(round) || isClubWorldCupRound(round);
}
function isRegularLeagueRound(round){
  return Boolean(round) && !isPromotionPlayoffRound(round) && !isClubWorldCupRound(round) && !isNationalCupRound(round) && !isLibertadoresRound(round) && !isChampionsLeagueRound(round);
}
function regularFixtureRounds(fixtures=game?.fixtures || []){
  return (Array.isArray(fixtures) ? fixtures : []).filter(isRegularLeagueRound);
}
function regularFixtureLength(fixtures=game?.fixtures || []){
  return regularFixtureRounds(fixtures).length;
}
function argentinaDivisions(){
  return divisionOrderList().filter(division => normalizeScheduleText(division.country || '') === 'argentina').sort((a,b)=>(a.order || 0)-(b.order || 0));
}
function argentinaDivisionByOrder(order){
  return argentinaDivisions().find(division => Number(division.order || 0) === Number(order));
}
function standingAtPosition(divisionId, position){
  const table = sortedStandings(divisionId);
  return table[Math.max(0, Number(position || 1) - 1)] || null;
}
function movementRecord(type, clubId, fromDivision, toDivision, reason=''){
  return {
    type,
    clubId:Number(clubId),
    fromDivisionId:fromDivision?.id,
    fromDivisionName:fromDivision?.name || '',
    toDivisionId:toDivision?.id,
    toDivisionName:toDivision?.name || '',
    reason
  };
}
function addUniqueMovement(list, movement){
  if(!movement?.clubId || !movement.fromDivisionId || !movement.toDivisionId) return;
  if(String(movement.fromDivisionId) === String(movement.toDivisionId)) return;
  const key = `${movement.clubId}-${movement.fromDivisionId}-${movement.toDivisionId}`;
  if(list.some(item => `${item.clubId}-${item.fromDivisionId}-${item.toDivisionId}` === key)) return;
  list.push(movement);
}
function createArgentinePlayoffTie(id, upperDivision, lowerDivision, upperPosition, lowerPosition){
  const upperRow = standingAtPosition(upperDivision?.id, upperPosition);
  const lowerRow = standingAtPosition(lowerDivision?.id, lowerPosition);
  if(!upperRow || !lowerRow) return null;
  return {
    id,
    upperClubId:Number(upperRow.clubId),
    lowerClubId:Number(lowerRow.clubId),
    upperClubName:clubName(upperRow.clubId),
    lowerClubName:clubName(lowerRow.clubId),
    upperPosition,
    lowerPosition,
    upperDivisionId:upperDivision.id,
    upperDivisionName:upperDivision.name,
    lowerDivisionId:lowerDivision.id,
    lowerDivisionName:lowerDivision.name,
    advantageClubId:Number(upperRow.clubId),
    matchIds:[]
  };
}
function buildArgentinePlayoffTies(){
  const first = argentinaDivisionByOrder(1);
  const second = argentinaDivisionByOrder(2);
  const third = argentinaDivisionByOrder(3);
  const ties = [];
  if(first && second){
    [
      createArgentinePlayoffTie('primera-15-vs-segunda-4', first, second, 15, 4),
      createArgentinePlayoffTie('primera-16-vs-segunda-3', first, second, 16, 3)
    ].forEach(tie => { if(tie) ties.push(tie); });
  }
  if(second && third){
    [
      createArgentinePlayoffTie('segunda-15-vs-tercera-4', second, third, 15, 4),
      createArgentinePlayoffTie('segunda-16-vs-tercera-3', second, third, 16, 3)
    ].forEach(tie => { if(tie) ties.push(tie); });
  }
  return ties;
}
function playoffFixtureMatch(tie, leg, date, matchday){
  const lowerHome = Number(leg) === 1;
  const homeId = lowerHome ? tie.lowerClubId : tie.upperClubId;
  const awayId = lowerHome ? tie.upperClubId : tie.lowerClubId;
  const id = `arg-playoff-s${game?.seasonNumber || 1}-${tie.id}-${leg}`;
  return {
    id,
    matchday,
    leg:Number(leg),
    playoff:true,
    promotionPlayoff:true,
    playoffTieId:tie.id,
    playoffStage:Number(leg) === 1 ? 'IDA' : 'VUELTA',
    upperDivisionId:tie.upperDivisionId,
    upperDivisionName:tie.upperDivisionName,
    lowerDivisionId:tie.lowerDivisionId,
    lowerDivisionName:tie.lowerDivisionName,
    divisionId:tie.upperDivisionId,
    divisionName:`Promoción ${tie.upperDivisionName}`,
    date,
    roundDate:date,
    homeId,
    awayId,
    played:false
  };
}
function lastRegularFixtureDate(state=game){
  const fixtures = regularFixtureRounds(state?.fixtures || []);
  const dates = [];
  fixtures.forEach(round => {
    if(validIsoDate(round?.endDate)) dates.push(round.endDate);
    if(validIsoDate(round?.date)) dates.push(round.date);
    (round?.matches || []).forEach(match => { if(validIsoDate(match.date)) dates.push(match.date); });
  });
  if(!dates.length) return validIsoDate(state?.currentDate) ? state.currentDate : dateForSeasonState(state);
  return dates.sort((a,b)=>daysBetweenIsoDates(b,a))[dates.length - 1];
}
function repairPromotionPlayoffScheduleForState(state){
  if(!state || !Array.isArray(state.fixtures)) return false;
  const playoffRounds = state.fixtures.filter(isPromotionPlayoffRound);
  if(!playoffRounds.length) return false;
  const playoffMatches = playoffRounds.flatMap(round => round.matches || []).filter(isPromotionPlayoffMatch);
  if(!playoffMatches.length || playoffMatches.some(match => match.played)) return false;
  const regularEndDate = lastRegularFixtureDate(state);
  if(!validIsoDate(regularEndDate)) return false;
  const expectedDates = {
    IDA:addDaysToIsoDate(regularEndDate, 7),
    VUELTA:addDaysToIsoDate(regularEndDate, 14)
  };
  let changed = false;
  playoffRounds.forEach((round, index) => {
    const stage = String(round?.playoffStage || round?.matches?.[0]?.playoffStage || (index === 0 ? 'IDA' : 'VUELTA')).toUpperCase();
    const expectedDate = expectedDates[stage];
    if(!validIsoDate(expectedDate)) return;
    if(round.date !== expectedDate || round.startDate !== expectedDate || round.endDate !== expectedDate) changed = true;
    round.date = expectedDate;
    round.startDate = expectedDate;
    round.endDate = expectedDate;
    (round.matches || []).forEach(match => {
      if(!isPromotionPlayoffMatch(match)) return;
      if(match.date !== expectedDate || match.roundDate !== expectedDate) changed = true;
      match.date = expectedDate;
      match.roundDate = expectedDate;
    });
  });
  if(state.argentinaPlayoffs?.created){
    if(state.argentinaPlayoffs.firstLegDate !== expectedDates.IDA || state.argentinaPlayoffs.secondLegDate !== expectedDates.VUELTA) changed = true;
    state.argentinaPlayoffs.firstLegDate = expectedDates.IDA;
    state.argentinaPlayoffs.secondLegDate = expectedDates.VUELTA;
  }
  if(changed) state._needsAutosave = true;
  return changed;
}
function regularFixturesComplete(){
  const rounds = regularFixtureRounds();
  return rounds.length > 0 && rounds.every(round => (round.matches || []).every(match => match.played));
}
function createArgentinePromotionPlayoffsIfNeeded(){
  if(!game || game.seasonFinalized || !Array.isArray(game.fixtures)) return false;
  const season = Number(game.seasonNumber || 1);
  const regularCount = regularFixtureLength();
  if(game.fixtures.some(isPromotionPlayoffRound)) return false;
  if(game.argentinaPlayoffs?.season === season && game.argentinaPlayoffs?.created) return false;
  if(!regularFixturesComplete()) return false;
  const ties = buildArgentinePlayoffTies();
  if(!ties.length) return false;
  const firstLegDate = addDaysToIsoDate(lastRegularFixtureDate(), 7);
  const secondLegDate = addDaysToIsoDate(firstLegDate, 7);
  const firstMatchday = regularCount + 1;
  const secondMatchday = regularCount + 2;
  const firstLegMatches = ties.map(tie => playoffFixtureMatch(tie, 1, firstLegDate, firstMatchday));
  const secondLegMatches = ties.map(tie => playoffFixtureMatch(tie, 2, secondLegDate, secondMatchday));
  ties.forEach(tie => {
    tie.matchIds = [`arg-playoff-s${season}-${tie.id}-1`, `arg-playoff-s${season}-${tie.id}-2`];
  });
  game.fixtures.push({
    matchday:firstMatchday,
    date:firstLegDate,
    startDate:firstLegDate,
    endDate:firstLegDate,
    playoffRound:true,
    playoffStage:'IDA',
    title:'Playoffs IDA',
    matches:firstLegMatches
  });
  game.fixtures.push({
    matchday:secondMatchday,
    date:secondLegDate,
    startDate:secondLegDate,
    endDate:secondLegDate,
    playoffRound:true,
    playoffStage:'VUELTA',
    title:'Playoffs VUELTA',
    matches:secondLegMatches
  });
  if(typeof sortFixturesAfterNationalCupChange === 'function') sortFixturesAfterNationalCupChange();
  else repairFixtureCursorForState(game, { reason:'promotion_playoffs_created' });
  game.argentinaPlayoffs = { season, created:true, regularFixtureCount:regularCount, firstLegDate, secondLegDate, ties };
  pushGameMessage({
    type:'deportivo',
    priority:'high',
    title:'Playoffs de promoción creados',
    body:'Terminó la liga argentina. Se agregaron Playoffs IDA y Playoffs VUELTA entre Primera/Segunda y Segunda/Tercera. Asciende quien haga más goles en el global; si empatan, cada club permanece en su liga actual.',
    id:`arg-playoffs-${season}`
  });

  return true;
}
