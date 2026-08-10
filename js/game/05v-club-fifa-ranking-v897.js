/* V8.97 · Ranking FIFA interno de clubes */

function clubFifaRankingConfig(){
  const source = window.GAME_CONFIG?.rankingClubes || {};
  const number = (key, fallback) => Number.isFinite(Number(source[key])) ? Number(source[key]) : fallback;
  return {
    active:source.activo !== false,
    min:Math.max(1, Math.round(number('puntajeMinimo', 1))),
    max:Math.max(100, Math.round(number('puntajeMaximo', 1500))),
    formSeasons:Math.max(1, Math.round(number('temporadasForma', 5))),
    clubReputationMultiplier:number('reputacionClubMultiplicador', 7.2),
    leagueReputationMultiplier:number('reputacionLigaMultiplicador', 4),
    leagueReputationBase:number('reputacionLigaBase', 35),
    leagueReputationMax:Math.max(0, number('reputacionLigaMaximo', 230)),
    leagueWin:number('puntosVictoriaLiga', 2.5),
    nationalCupWin:number('puntosVictoriaCopaNacional', 7),
    supercupWin:number('puntosVictoriaSupercopa', 12),
    libertadoresGroupWin:number('puntosVictoriaLibertadoresGrupos', 10),
    libertadoresR32Win:number('puntosVictoriaLibertadores16avos', 14),
    libertadoresR16Win:number('puntosVictoriaLibertadoresOctavos', 18),
    libertadoresQfWin:number('puntosVictoriaLibertadoresCuartos', 24),
    libertadoresSfWin:number('puntosVictoriaLibertadoresSemifinal', 32),
    libertadoresFinalWin:number('puntosVictoriaLibertadoresFinal', 45),
    championsGroupWin:number('puntosVictoriaChampionsGrupos', 10),
    championsR32Win:number('puntosVictoriaChampions16avos', 14),
    championsR16Win:number('puntosVictoriaChampionsOctavos', 18),
    championsQfWin:number('puntosVictoriaChampionsCuartos', 24),
    championsSfWin:number('puntosVictoriaChampionsSemifinal', 32),
    championsFinalWin:number('puntosVictoriaChampionsFinal', 45),
    cwcGroupWin:number('puntosVictoriaMundialGrupos', 22),
    cwcR16Win:number('puntosVictoriaMundialOctavos', 30),
    cwcQfWin:number('puntosVictoriaMundialCuartos', 36),
    cwcSfWin:number('puntosVictoriaMundialSemifinal', 44),
    cwcThirdWin:number('puntosVictoriaMundialTercerPuesto', 24),
    cwcFinalWin:number('puntosVictoriaMundialFinal', 55),
    topLeagueTitle:number('puntosTituloLigaPrimera', 75),
    lowerLeagueTitle:number('puntosTituloLigaAscenso', 30),
    nationalCupTitle:number('puntosTituloCopaNacional', 50),
    supercupTitle:number('puntosTituloSupercopa', 25),
    libertadoresTitle:number('puntosTituloLibertadores', 140),
    championsTitle:number('puntosTituloChampions', 140),
    cwcTitle:number('puntosTituloMundial', 190),
    seasonDecay:Math.min(1, Math.max(0.30, number('decaimientoTemporada', 0.82))),
    minimumTitleDecay:Math.min(1, Math.max(0, number('decaimientoMinimoTitulos', 0.25))),
    historyLimit:Math.max(2, Math.round(number('historialTemporadasMaximo', 12)))
  };
}
function clubFifaRankingClamp(value, min, max){
  return Math.max(min, Math.min(max, Number(value || 0)));
}
function clubFifaRankingCountryKey(value){
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function clubFifaRankingDivisionForClub(club){
  if(!club) return null;
  if(typeof clubDivision === 'function'){
    const current = clubDivision(club.id);
    if(current) return current;
  }
  return (seed?.divisions || []).find(item => String(item.id || '') === String(club.divisionId || '')) || null;
}
function clubFifaRankingClubCountry(club){
  const division = clubFifaRankingDivisionForClub(club);
  return String(division?.country || division?.pais || club?.country || club?.pais || 'Sin país');
}
function clubFifaRankingDivisionOrder(club){
  const division = clubFifaRankingDivisionForClub(club);
  return Math.max(1, Math.round(Number(division?.order || club?.divisionOrder || 1)));
}
function clubFifaRankingLeagueStrengthMap(){
  const clubs = (seed?.clubs || []).filter(club => !club?.specialCompetitionOnly && !club?.competitionOnly);
  const divisions = new Map();
  const countries = new Map();
  clubs.forEach(club => {
    const division = clubFifaRankingDivisionForClub(club);
    const divisionId = String(division?.id || club?.divisionId || '');
    const country = clubFifaRankingCountryKey(clubFifaRankingClubCountry(club));
    const reputation = clubFifaRankingClamp(Number(club?.reputation || 50), 1, 99);
    if(divisionId){
      const row = divisions.get(divisionId) || { total:0, count:0, order:clubFifaRankingDivisionOrder(club), country };
      row.total += reputation; row.count += 1;
      divisions.set(divisionId, row);
    }
    if(clubFifaRankingDivisionOrder(club) === 1 && country){
      const row = countries.get(country) || { total:0, count:0 };
      row.total += reputation; row.count += 1;
      countries.set(country, row);
    }
  });
  return { divisions, countries };
}
function clubFifaRankingLeagueStrength(club, maps=clubFifaRankingLeagueStrengthMap()){
  const division = clubFifaRankingDivisionForClub(club);
  const divisionId = String(division?.id || club?.divisionId || '');
  const country = clubFifaRankingCountryKey(clubFifaRankingClubCountry(club));
  const divisionRow = maps.divisions.get(divisionId);
  const countryRow = maps.countries.get(country);
  const divisionAverage = divisionRow?.count ? divisionRow.total / divisionRow.count : Number(club?.reputation || 50);
  const countryTopAverage = countryRow?.count ? countryRow.total / countryRow.count : divisionAverage;
  const order = clubFifaRankingDivisionOrder(club);
  const tierFactor = order === 1 ? 1 : order === 2 ? 0.70 : order === 3 ? 0.48 : 0.35;
  return clubFifaRankingClamp(((countryTopAverage * 0.72) + (divisionAverage * 0.28)) * tierFactor, 1, 99);
}
function normalizeClubFifaRankingState(value){
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const records = [];
  const seen = new Set();
  (Array.isArray(source.matchWins) ? source.matchWins : []).forEach(item => {
    const key = String(item?.key || '').trim();
    const clubId = Number(item?.clubId || 0);
    const season = Math.max(1, Math.round(Number(item?.season || 1)));
    const type = String(item?.type || '').trim();
    if(!key || !clubId || !type || seen.has(key)) return;
    seen.add(key);
    records.push({
      key, clubId, season,
      year:Math.round(Number(item?.year || 0)),
      type,
      stage:String(item?.stage || ''),
      competitionId:String(item?.competitionId || ''),
      createdAt:String(item?.createdAt || '')
    });
  });
  records.sort((a,b)=>Number(a.season || 0)-Number(b.season || 0) || String(a.key).localeCompare(String(b.key)));
  const cfg = clubFifaRankingConfig();
  const snapshots = (Array.isArray(source.snapshots) ? source.snapshots : []).map(item => ({
    season:Math.max(1, Math.round(Number(item?.season || 1))),
    year:Math.round(Number(item?.year || 0)),
    createdAt:String(item?.createdAt || ''),
    rows:(Array.isArray(item?.rows) ? item.rows : []).map(row => ({ clubId:Number(row?.clubId || 0), rank:Math.max(1, Math.round(Number(row?.rank || 1))), points:Math.max(1, Math.round(Number(row?.points || 1))) })).filter(row => row.clubId)
  })).filter(item => item.rows.length).sort((a,b)=>Number(a.season || 0)-Number(b.season || 0)).slice(-cfg.historyLimit);
  return { version:1, matchWins:records, snapshots };
}
function ensureClubFifaRankingState(){
  if(!game) return normalizeClubFifaRankingState({});
  game.clubFifaRanking = normalizeClubFifaRankingState(game.clubFifaRanking || {});
  return game.clubFifaRanking;
}
function clubFifaRankingWinnerId(match){
  if(!match?.played) return 0;
  const explicit = Number(match.winnerClubId || match.penaltyShootout?.winnerClubId || match.clubWorldCupTiebreaker?.winnerClubId || 0);
  if(explicit) return explicit;
  const home = Number(match.homeGoals ?? match.result?.homeGoals ?? match.result?.home ?? 0);
  const away = Number(match.awayGoals ?? match.result?.awayGoals ?? match.result?.away ?? 0);
  if(home > away) return Number(match.homeId || 0);
  if(away > home) return Number(match.awayId || 0);
  const homePens = Number(match.penaltyShootout?.home || 0);
  const awayPens = Number(match.penaltyShootout?.away || 0);
  if(homePens > awayPens) return Number(match.homeId || 0);
  if(awayPens > homePens) return Number(match.awayId || 0);
  return 0;
}
function clubFifaRankingMatchType(match){
  if(match?.clubWorldCup) return 'club_world_cup';
  if(match?.libertadores) return 'libertadores';
  if(match?.championsLeague) return 'champions_league';
  if(match?.nationalSupercup) return 'national_supercup';
  if(match?.nationalCup) return 'national_cup';
  return '';
}
function clubFifaRankingMatchKey(match, season, source='fixture'){
  const type = clubFifaRankingMatchType(match);
  const competitionId = String(match?.nationalCupId || (type === 'club_world_cup' ? 'club-world-cup' : type === 'libertadores' ? 'copa-libertadores' : type === 'champions_league' ? 'champions-league' : type));
  const id = String(match?.id || '').trim();
  if(id) return `match:${season}:${type}:${competitionId}:${id}`;
  return `match:${season}:${type}:${competitionId}:${Number(match?.homeId || 0)}:${Number(match?.awayId || 0)}:${String(match?.date || match?.seasonDay || '')}:${String(match?.clubWorldCupStage || match?.libertadoresStage || match?.championsLeagueStage || match?.nationalCupStage || '')}`;
}
function clubFifaRankingRecordMatch(match, season, year, source='fixture'){
  const type = clubFifaRankingMatchType(match);
  const winnerId = clubFifaRankingWinnerId(match);
  if(!type || !winnerId) return false;
  const state = ensureClubFifaRankingState();
  const key = clubFifaRankingMatchKey(match, season, source);
  if(state.matchWins.some(item => item.key === key)) return false;
  state.matchWins.push({
    key,
    clubId:winnerId,
    season:Math.max(1, Math.round(Number(season || game?.seasonNumber || 1))),
    year:Math.round(Number(year || game?.seasonYear || 0)),
    type,
    stage:String(match?.clubWorldCupStage || match?.libertadoresStage || match?.championsLeagueStage || match?.stage || match?.nationalCupStage || ''),
    competitionId:String(match?.nationalCupId || (type === 'club_world_cup' ? 'club-world-cup' : type === 'libertadores' ? 'copa-libertadores' : type === 'champions_league' ? 'champions-league' : type)),
    createdAt:new Date().toISOString()
  });
  return true;
}
function clubFifaRankingArchivedWorldCupMatches(){
  const matches = [];
  const editions = Array.isArray(game?.clubWorldCupHistory?.editions) ? game.clubWorldCupHistory.editions : [];
  editions.forEach(edition => {
    const season = Number(edition?.season || 1);
    const year = Number(edition?.year || 0);
    (Array.isArray(edition?.groups) ? edition.groups : []).forEach(group => (Array.isArray(group?.matches) ? group.matches : []).forEach(match => matches.push({ match:{ ...match, clubWorldCup:true, clubWorldCupStage:'groups', clubWorldCupGroup:group?.id || match?.groupId }, season, year, source:'cwc-history' })));
    Object.entries(edition?.stages || {}).forEach(([stage, stageMatches]) => (Array.isArray(stageMatches) ? stageMatches : []).forEach(match => matches.push({ match:{ ...match, clubWorldCup:true, clubWorldCupStage:stage }, season, year, source:'cwc-history' })));
  });
  return matches;
}

function clubFifaRankingArchivedLibertadoresMatches(){
  const matches = [];
  const editions = Array.isArray(game?.libertadoresHistory?.editions) ? game.libertadoresHistory.editions : [];
  editions.forEach(edition => {
    const season = Number(edition?.season || 1);
    const year = Number(edition?.year || 0);
    (Array.isArray(edition?.groups) ? edition.groups : []).forEach(group => (Array.isArray(group?.matches) ? group.matches : []).forEach(match => matches.push({ match:{ ...match, libertadores:true, internationalCup:true, continentalCup:true, libertadoresStage:'groups', libertadoresGroup:group?.id || match?.libertadoresGroup || '' }, season, year, source:'libertadores-history' })));
    Object.entries(edition?.stages || {}).forEach(([stage, stageMatches]) => (Array.isArray(stageMatches) ? stageMatches : []).forEach(match => matches.push({ match:{ ...match, libertadores:true, internationalCup:true, continentalCup:true, libertadoresStage:stage }, season, year, source:'libertadores-history' })));
  });
  return matches;
}
function clubFifaRankingArchivedChampionsLeagueMatches(){
  const matches = [];
  const editions = Array.isArray(game?.championsLeagueHistory?.editions) ? game.championsLeagueHistory.editions : [];
  editions.forEach(edition => {
    const season = Number(edition?.season || 1);
    const year = Number(edition?.year || 0);
    (Array.isArray(edition?.groups) ? edition.groups : []).forEach(group => (Array.isArray(group?.matches) ? group.matches : []).forEach(match => matches.push({ match:{ ...match, championsLeague:true, internationalCup:true, continentalCup:true, championsLeagueStage:'groups', championsLeagueGroup:group?.id || match?.championsLeagueGroup || '' }, season, year, source:'champions-league-history' })));
    Object.entries(edition?.stages || {}).forEach(([stage, stageMatches]) => (Array.isArray(stageMatches) ? stageMatches : []).forEach(match => matches.push({ match:{ ...match, championsLeague:true, internationalCup:true, continentalCup:true, championsLeagueStage:stage }, season, year, source:'champions-league-history' })));
  });
  return matches;
}
function syncClubFifaRankingMatchRecords(){
  if(!game || !clubFifaRankingConfig().active) return { changed:false, added:0 };
  ensureClubFifaRankingState();
  let added = 0;
  (game.fixtures || []).forEach(round => (round?.matches || []).forEach(match => {
    if(clubFifaRankingRecordMatch(match, game.seasonNumber || 1, game.seasonYear || 0, 'fixture')) added += 1;
  }));
  clubFifaRankingArchivedWorldCupMatches().forEach(item => {
    if(clubFifaRankingRecordMatch(item.match, item.season, item.year, item.source)) added += 1;
  });
  clubFifaRankingArchivedLibertadoresMatches().forEach(item => {
    if(clubFifaRankingRecordMatch(item.match, item.season, item.year, item.source)) added += 1;
  });
  clubFifaRankingArchivedChampionsLeagueMatches().forEach(item => {
    if(clubFifaRankingRecordMatch(item.match, item.season, item.year, item.source)) added += 1;
  });
  game.clubFifaRanking = normalizeClubFifaRankingState(game.clubFifaRanking);
  if(added > 0) game._needsAutosave = true;
  return { changed:added > 0, added };
}
function clubFifaRankingSeasonWeight(season, currentSeason=Number(game?.seasonNumber || 1), minimum=0){
  const cfg = clubFifaRankingConfig();
  const age = Math.max(0, currentSeason - Math.max(1, Number(season || currentSeason)));
  return Math.max(minimum, Math.pow(cfg.seasonDecay, age));
}
function clubFifaRankingLeagueWinRows(){
  const currentSeason = Number(game?.seasonNumber || 1);
  const rows = [];
  const historicalSeasons = new Set();
  const history = typeof normalizeStandingsHistoryState === 'function' ? normalizeStandingsHistoryState(game?.standingsHistory || {}).seasons : (game?.standingsHistory?.seasons || []);
  (history || []).forEach(entry => {
    const season = Number(entry?.season || 0);
    if(!season) return;
    historicalSeasons.add(season);
    Object.entries(entry?.divisions || {}).forEach(([divisionId, divisionRows]) => (divisionRows || []).forEach(row => {
      if(Number(row?.clubId || 0) && Number(row?.pg || 0) > 0) rows.push({ clubId:Number(row.clubId), season, divisionId:String(divisionId), wins:Number(row.pg || 0) });
    }));
  });
  if(!historicalSeasons.has(currentSeason)){
    (seed?.divisions || []).forEach(division => {
      const divisionRows = typeof sortedStandings === 'function' ? sortedStandings(division.id) : [];
      (divisionRows || []).forEach(row => {
        if(Number(row?.clubId || 0) && Number(row?.pg || 0) > 0) rows.push({ clubId:Number(row.clubId), season:currentSeason, divisionId:String(division.id), wins:Number(row.pg || 0) });
      });
    });
  }
  return rows;
}
function clubFifaRankingTitleEntries(){
  const explicit = typeof normalizeCompetitionChampionsHistoryState === 'function'
    ? normalizeCompetitionChampionsHistoryState(game?.competitionChampionsHistory || {}).entries
    : (game?.competitionChampionsHistory?.entries || []);
  const seen = new Set();
  return (explicit || []).filter(entry => {
    const key = `${Number(entry?.season || 0)}:${String(entry?.competitionId || entry?.divisionId || '')}:${Number(entry?.championId || entry?.clubId || 0)}`;
    if(seen.has(key)) return false;
    seen.add(key);
    return Number(entry?.championId || entry?.clubId || 0) > 0;
  });
}
function clubFifaRankingWorldCupWinPoints(record){
  const cfg = clubFifaRankingConfig();
  const stage = String(record?.stage || '').toLowerCase();
  if(stage === 'final') return cfg.cwcFinalWin;
  if(stage === 'sf' || stage.includes('semi')) return cfg.cwcSfWin;
  if(stage === 'qf' || stage.includes('cuarto')) return cfg.cwcQfWin;
  if(stage === 'r16' || stage.includes('octavo')) return cfg.cwcR16Win;
  if(stage === 'thirdplace' || stage === 'third_place' || stage.includes('tercer')) return cfg.cwcThirdWin;
  return cfg.cwcGroupWin;
}
function clubFifaRankingLibertadoresWinPoints(record){
  const cfg = clubFifaRankingConfig();
  const stage = String(record?.stage || '').toLowerCase();
  if(stage === 'final') return cfg.libertadoresFinalWin;
  if(stage === 'sf' || stage.includes('semi')) return cfg.libertadoresSfWin;
  if(stage === 'qf' || stage.includes('cuarto')) return cfg.libertadoresQfWin;
  if(stage === 'r16' || stage.includes('octavo')) return cfg.libertadoresR16Win;
  if(stage === 'r32' || stage.includes('16avo')) return cfg.libertadoresR32Win;
  return cfg.libertadoresGroupWin;
}
function clubFifaRankingChampionsWinPoints(record){
  const cfg = clubFifaRankingConfig();
  const stage = String(record?.stage || '').toLowerCase();
  if(stage === 'final') return cfg.championsFinalWin;
  if(stage === 'sf' || stage.includes('semi')) return cfg.championsSfWin;
  if(stage === 'qf' || stage.includes('cuarto')) return cfg.championsQfWin;
  if(stage === 'r16' || stage.includes('octavo')) return cfg.championsR16Win;
  if(stage === 'r32' || stage.includes('16avo')) return cfg.championsR32Win;
  return cfg.championsGroupWin;
}
function clubFifaRankingTitlePoints(entry, club){
  const cfg = clubFifaRankingConfig();
  const type = String(entry?.type || '').toLowerCase();
  const competitionId = String(entry?.competitionId || entry?.divisionId || '');
  if(type === 'club_world_cup' || competitionId === 'club-world-cup') return cfg.cwcTitle;
  if(competitionId === 'champions-league') return cfg.championsTitle;
  if(type === 'international_cup' || competitionId === 'copa-libertadores') return cfg.libertadoresTitle;
  if(type === 'national_supercup') return cfg.supercupTitle;
  if(type === 'national_cup') return cfg.nationalCupTitle;
  const division = (seed?.divisions || []).find(item => String(item.id || '') === competitionId);
  const order = Math.max(1, Number(division?.order || club?.divisionOrder || 1));
  return order === 1 ? cfg.topLeagueTitle : cfg.lowerLeagueTitle;
}
function clubFifaRankingComponents(){
  syncClubFifaRankingMatchRecords();
  const cfg = clubFifaRankingConfig();
  const currentSeason = Number(game?.seasonNumber || 1);
  const maps = clubFifaRankingLeagueStrengthMap();
  const byClub = new Map();
  const rankedSpecialClubIds = new Set();
  [game?.libertadores?.participantClubIds, game?.championsLeague?.participantClubIds, game?.clubWorldCup?.participantClubIds].forEach(ids => (Array.isArray(ids) ? ids : []).forEach(id => rankedSpecialClubIds.add(Number(id))));
  (game?.libertadoresHistory?.editions || []).forEach(edition => (edition?.participantClubIds || []).forEach(id => rankedSpecialClubIds.add(Number(id))));
  (game?.championsLeagueHistory?.editions || []).forEach(edition => (edition?.participantClubIds || []).forEach(id => rankedSpecialClubIds.add(Number(id))));
  (game?.clubWorldCupHistory?.editions || []).forEach(edition => (edition?.participantClubIds || []).forEach(id => rankedSpecialClubIds.add(Number(id))));
  (seed?.clubs || []).filter(club => (!club?.specialCompetitionOnly && !club?.competitionOnly) || rankedSpecialClubIds.has(Number(club?.id || 0))).forEach(club => {
    const reputation = clubFifaRankingClamp(Number(club?.reputation || 50), 1, 99);
    const leagueStrength = clubFifaRankingLeagueStrength(club, maps);
    const reputationPoints = reputation * cfg.clubReputationMultiplier;
    const leaguePoints = clubFifaRankingClamp((leagueStrength - cfg.leagueReputationBase) * cfg.leagueReputationMultiplier, 0, cfg.leagueReputationMax);
    byClub.set(Number(club.id), {
      clubId:Number(club.id), club, reputation, leagueStrength,
      reputationPoints, leaguePoints, leagueWinPoints:0, cupWinPoints:0, worldCupWinPoints:0, titlePoints:0,
      leagueWins:0, cupWins:0, worldCupWins:0, titles:0, worldCupTitles:0,
      country:clubFifaRankingClubCountry(club), division:clubFifaRankingDivisionForClub(club)
    });
  });
  clubFifaRankingLeagueWinRows().forEach(item => {
    const row = byClub.get(Number(item.clubId));
    if(!row) return;
    const age = Math.max(0, currentSeason - Number(item.season || currentSeason));
    if(age >= cfg.formSeasons) return;
    const weight = clubFifaRankingSeasonWeight(item.season, currentSeason, 0);
    row.leagueWins += Number(item.wins || 0);
    row.leagueWinPoints += Number(item.wins || 0) * cfg.leagueWin * weight;
  });
  ensureClubFifaRankingState().matchWins.forEach(record => {
    const row = byClub.get(Number(record.clubId));
    if(!row) return;
    const age = Math.max(0, currentSeason - Number(record.season || currentSeason));
    if(age >= cfg.formSeasons) return;
    const weight = clubFifaRankingSeasonWeight(record.season, currentSeason, 0);
    if(record.type === 'club_world_cup'){
      row.worldCupWins += 1;
      row.worldCupWinPoints += clubFifaRankingWorldCupWinPoints(record) * weight;
    }else{
      row.cupWins += 1;
      row.cupWinPoints += (record.type === 'champions_league' ? clubFifaRankingChampionsWinPoints(record) : record.type === 'libertadores' ? clubFifaRankingLibertadoresWinPoints(record) : record.type === 'national_supercup' ? cfg.supercupWin : cfg.nationalCupWin) * weight;
    }
  });
  clubFifaRankingTitleEntries().forEach(entry => {
    const clubId = Number(entry?.championId || entry?.clubId || 0);
    const row = byClub.get(clubId);
    if(!row) return;
    const weight = clubFifaRankingSeasonWeight(entry.season, currentSeason, cfg.minimumTitleDecay);
    const points = clubFifaRankingTitlePoints(entry, row.club) * weight;
    row.titlePoints += points;
    row.titles += 1;
    if(String(entry?.type || '') === 'club_world_cup' || String(entry?.competitionId || '') === 'club-world-cup') row.worldCupTitles += 1;
  });
  return Array.from(byClub.values()).map(row => {
    const performancePoints = row.leagueWinPoints + row.cupWinPoints + row.worldCupWinPoints + row.titlePoints;
    const rawPoints = row.reputationPoints + row.leaguePoints + performancePoints;
    return { ...row, performancePoints, rawPoints, points:Math.round(clubFifaRankingClamp(rawPoints, cfg.min, cfg.max)) };
  });
}
function clubFifaRankingPreviousSnapshot(){
  const state = ensureClubFifaRankingState();
  const currentSeason = Number(game?.seasonNumber || 1);
  return (state.snapshots || []).filter(item => Number(item.season || 0) < currentSeason).sort((a,b)=>Number(b.season || 0)-Number(a.season || 0))[0] || null;
}
function clubFifaRankingRows(){
  const previous = clubFifaRankingPreviousSnapshot();
  const previousByClub = new Map((previous?.rows || []).map(row => [Number(row.clubId), row]));
  const rows = clubFifaRankingComponents().sort((a,b)=>Number(b.points || 0)-Number(a.points || 0) || Number(b.worldCupWinPoints || 0)-Number(a.worldCupWinPoints || 0) || Number(b.reputation || 0)-Number(a.reputation || 0) || String(a.club?.name || '').localeCompare(String(b.club?.name || ''), 'es', { sensitivity:'base' }));
  return rows.map((row,index) => {
    const rank = index + 1;
    const previousRow = previousByClub.get(Number(row.clubId));
    return { ...row, rank, previousRank:Number(previousRow?.rank || 0), movement:previousRow ? Number(previousRow.rank || 0) - rank : null };
  });
}
function snapshotClubFifaRankingForCurrentSeason(options={}){
  if(!game || !clubFifaRankingConfig().active) return false;
  syncClubFifaRankingMatchRecords();
  const state = ensureClubFifaRankingState();
  const season = Math.max(1, Number(game.seasonNumber || 1));
  if(!options.force && state.snapshots.some(item => Number(item.season || 0) === season)) return false;
  const rows = clubFifaRankingRows().map(row => ({ clubId:Number(row.clubId), rank:Number(row.rank), points:Number(row.points) }));
  state.snapshots = state.snapshots.filter(item => Number(item.season || 0) !== season);
  state.snapshots.push({ season, year:Number(game.seasonYear || 0), createdAt:new Date().toISOString(), rows });
  state.snapshots = normalizeClubFifaRankingState(state).snapshots;
  game.clubFifaRanking = state;
  game._needsAutosave = true;
  return true;
}
function clubFifaRankingMovementMarkup(row){
  if(row.movement === null) return '<span class="ranking-movement new">Nuevo</span>';
  if(row.movement > 0) return `<span class="ranking-movement up">▲ ${row.movement}</span>`;
  if(row.movement < 0) return `<span class="ranking-movement down">▼ ${Math.abs(row.movement)}</span>`;
  return '<span class="ranking-movement same">—</span>';
}
function clubFifaRankingBreakdownMarkup(row){
  const fmt = value => Math.round(Number(value || 0));
  return `<div class="ranking-breakdown">
    <span title="Prestigio del club">Club ${fmt(row.reputationPoints)}</span>
    <span title="Reputación de la liga">Liga ${fmt(row.leaguePoints)}</span>
    <span title="Victorias de liga y copas nacionales">Resultados ${fmt(row.leagueWinPoints + row.cupWinPoints)}</span>
    <span title="Victorias en el Mundial de Clubes">Mundial ${fmt(row.worldCupWinPoints)}</span>
    <span title="Títulos oficiales">Títulos ${fmt(row.titlePoints)}</span>
  </div>`;
}
function clubFifaRankingMarkup(){
  const cfg = clubFifaRankingConfig();
  if(!cfg.active) return '<div class="card"><p class="muted">El ranking mundial de clubes está desactivado.</p></div>';
  const rows = clubFifaRankingRows();
  const countries = Array.from(new Set(rows.map(row => row.country).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'es',{sensitivity:'base'}));
  const countryOptions = ['<option value="all">Todos los países</option>', ...countries.map(country => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`)].join('');
  const tableRows = rows.map(row => `<tr class="${Number(row.clubId) === Number(game?.selectedClubId || 0) ? 'own-club-row' : ''}" data-ranking-country="${escapeHtml(row.country)}">
    <td class="ranking-position"><strong>${row.rank}</strong></td>
    <td>${clubLink(row.clubId)}${clubFifaRankingBreakdownMarkup(row)}</td>
    <td>${escapeHtml(row.country)}<div class="muted small">${escapeHtml(row.division?.name || row.club?.divisionName || 'Liga')}</div></td>
    <td class="ranking-points"><strong>${row.points}</strong><span>/ ${cfg.max}</span></td>
    <td>${clubFifaRankingMovementMarkup(row)}</td>
    <td>${Math.round(row.leagueStrength)}</td>
    <td>${Math.round(row.leagueWins)}</td>
    <td>${row.cupWins}</td>
    <td class="ranking-world-value"><strong>${row.worldCupWins}</strong>${row.worldCupTitles ? `<span>${row.worldCupTitles} título(s)</span>` : ''}</td>
    <td>${row.titles}</td>
  </tr>`).join('');
  return `<div class="ranking-club-view">
    <div class="row section-title">
      <div><h2>Ranking FIFA de clubes</h2><p class="tagline">Clasificación mundial interna de 1 a ${cfg.max} puntos. La reputación de la liga, los títulos y los partidos ganados forman el coeficiente; el Mundial de Clubes tiene el mayor peso.</p></div>
      ${typeof competitionsNavMarkup === 'function' ? competitionsNavMarkup('club-ranking') : ''}
    </div>
    <div class="ranking-summary-grid">
      <div class="metric-card"><span class="label">Líder mundial</span><strong class="viz-stat-value">${rows[0] ? escapeHtml(rows[0].club?.name || clubName(rows[0].clubId)) : '—'}</strong><span>${rows[0]?.points || 0} puntos</span></div>
      <div class="metric-card"><span class="label">Club del mánager</span><strong class="viz-stat-value">${(()=>{ const own=rows.find(row=>Number(row.clubId)===Number(game?.selectedClubId||0)); return own ? `#${own.rank}` : '—'; })()}</strong><span>${(()=>{ const own=rows.find(row=>Number(row.clubId)===Number(game?.selectedClubId||0)); return own ? `${own.points} puntos` : 'Sin club'; })()}</span></div>
      <div class="metric-card"><span class="label">Victoria Mundial</span><strong class="viz-stat-value">${cfg.cwcGroupWin}–${cfg.cwcFinalWin}</strong><span>según la ronda</span></div>
      <div class="metric-card"><span class="label">Campeón Mundial</span><strong class="viz-stat-value">${cfg.cwcTitle}</strong><span>puntos de título</span></div>
    </div>
    <div class="card ranking-formula-card"><p><strong>Criterio:</strong> prestigio estructural del club + fuerza de su liga + victorias recientes + títulos oficiales. Los resultados pierden peso gradualmente después de cada temporada; los títulos conservan una parte permanente de su valor.</p></div>
    <div class="row filters-row ranking-filters">
      <label>País <select id="clubFifaRankingCountryFilter">${countryOptions}</select></label>
      <label>Mostrar <select id="clubFifaRankingLimit"><option value="25">Top 25</option><option value="50">Top 50</option><option value="100">Top 100</option><option value="all">Todos</option></select></label>
      <label class="ranking-search-label">Buscar club <input id="clubFifaRankingSearch" type="search" placeholder="Nombre del club" /></label>
    </div>
    <div class="table-wrap ranking-table-wrap"><table class="club-fifa-ranking-table"><thead><tr><th>#</th><th>Club y composición</th><th>País / Liga</th><th>Puntos</th><th>Movimiento</th><th>Rep. liga</th><th>Victorias liga</th><th>Victorias copa</th><th>Victorias Mundial</th><th>Títulos</th></tr></thead><tbody>${tableRows}</tbody></table></div>
    <p id="clubFifaRankingVisibleCount" class="muted small"></p>
  </div>`;
}
function bindClubFifaRankingControls(){
  const country = document.getElementById('clubFifaRankingCountryFilter');
  const limit = document.getElementById('clubFifaRankingLimit');
  const search = document.getElementById('clubFifaRankingSearch');
  const update = () => {
    const rows = Array.from(document.querySelectorAll('.club-fifa-ranking-table tbody tr'));
    const selectedCountry = String(country?.value || 'all');
    const maxVisible = limit?.value === 'all' ? Infinity : Math.max(1, Number(limit?.value || 25));
    const term = String(search?.value || '').trim().toLowerCase();
    let visible = 0;
    rows.forEach(row => {
      const matchesCountry = selectedCountry === 'all' || String(row.dataset.rankingCountry || '') === selectedCountry;
      const matchesSearch = !term || String(row.textContent || '').toLowerCase().includes(term);
      const show = matchesCountry && matchesSearch && visible < maxVisible;
      row.hidden = !show;
      if(show) visible += 1;
    });
    const counter = document.getElementById('clubFifaRankingVisibleCount');
    if(counter) counter.textContent = `${visible} club(es) visibles de ${rows.length}.`;
  };
  country?.addEventListener('change', update);
  limit?.addEventListener('change', update);
  search?.addEventListener('input', update);
  update();
}
function renderClubFifaRanking(){
  if(!view) return;
  view.innerHTML = clubFifaRankingMarkup();
  if(typeof bindCompetitionsNav === 'function') bindCompetitionsNav();
  bindClubFifaRankingControls();
}

window.clubFifaRanking = {
  config:clubFifaRankingConfig,
  normalize:normalizeClubFifaRankingState,
  sync:syncClubFifaRankingMatchRecords,
  rows:clubFifaRankingRows,
  snapshot:snapshotClubFifaRankingForCurrentSeason,
  render:renderClubFifaRanking
};
