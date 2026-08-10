/* V9.55 · Champions League: 32 clubes, grupos ida/vuelta, eliminatorias a dos partidos y final neutral. */

const CHAMPIONS_LEAGUE_VERSION = 1;
const CHAMPIONS_LEAGUE_CONFIG = Object.freeze({
  id:'champions-league',
  name:'Champions League',
  enabled:configBoolean('calendario.championsLeague.activa', true),
  slots:Object.freeze({ Inglaterra:8, Italia:6, España:6, Rumania:2, pool:10 }),
  groupCount:8,
  teamsPerGroup:4,
  groupMatchdays:6,
  drawLeadDays:Math.max(1, Math.round(configNumber('calendario.championsLeague.diasAntesSorteo', 7, 1, 30))),
  finalTicketPrice:Math.max(0, Math.round(configNumber('calendario.championsLeague.precioEntradaFinal', 3000, 0, 1000000))),
  finalRevenueShare:configClamp(configNumber('calendario.championsLeague.repartoFinalPorClub', 0.50, 0, 1), 0, 1),
  finalBeforeWorldCupDrawDays:Math.max(1, Math.round(configNumber('calendario.championsLeague.diasAntesSorteoMundial', 1, 1, 30)))
});
const CHAMPIONS_LEAGUE_STAGE_LABELS = Object.freeze({
  groups:'Fase de grupos',
  r32:'16avos de final',
  r16:'8vos de final',
  qf:'4tos de final',
  sf:'Semifinales',
  final:'Final'
});
const CHAMPIONS_LEAGUE_GROUP_IDS = Object.freeze(['A','B','C','D','E','F','G','H']);
let selectedChampionsLeagueYear = 'current';

function championsLeagueCountryKey(value){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}
function championsLeagueClubCountry(clubId){
  const club = (seed?.clubs || []).find(item => Number(item?.id || 0) === Number(clubId || 0));
  return String(club?.country || club?.pais || '');
}
function championsLeagueClubReputation(clubId){
  const club = (seed?.clubs || []).find(item => Number(item?.id || 0) === Number(clubId || 0));
  return Math.max(0, Math.round(Number(club?.reputation || 0)));
}
function championsLeagueSeasonToken(suffix=''){
  return `championsLeague-s${Number(game?.seasonNumber || 1)}-${String(suffix || '')}`;
}
function championsLeagueDeterministicSort(values=[], token=''){
  return (values || []).slice().sort((a,b) => {
    const aid = Number(typeof a === 'object' ? a.clubId ?? a.id : a) || 0;
    const bid = Number(typeof b === 'object' ? b.clubId ?? b.id : b) || 0;
    const ah = typeof hashNumber === 'function' ? hashNumber(`${token}-${aid}`, 1000000000) : aid;
    const bh = typeof hashNumber === 'function' ? hashNumber(`${token}-${bid}`, 1000000000) : bid;
    return ah - bh || aid - bid;
  });
}
function championsLeagueWorldCupDrawDate(year=currentSeasonYear()){
  const day = typeof clubWorldCupFixtureReadySeasonDay === 'function'
    ? clubWorldCupFixtureReadySeasonDay()
    : Math.max(1, Math.round(Number(configValue('calendario.mundialClubes.diaSorteo', 295))));
  return addDaysToIsoDate(seasonStartDateForYear(year), day - 1);
}
function championsLeagueReservedNationalCupDates(year=currentSeasonYear()){
  const dates = new Set();
  if(typeof NATIONAL_CUP_CONFIGS !== 'undefined' && typeof nationalCupStageDate === 'function'){
    NATIONAL_CUP_CONFIGS
      .filter(config => ['inglaterra','italia','espana','rumania'].includes(championsLeagueCountryKey(config.country)))
      .forEach(config => (config.stages || []).forEach(stage => {
        const date = nationalCupStageDate(config, stage.id, year);
        if(validIsoDate(date)) dates.add(date);
      }));
  }
  return dates;
}
function championsLeagueWednesdaysBetween(startDate, endDate, year=currentSeasonYear(), options={}){
  if(!validIsoDate(startDate) || !validIsoDate(endDate) || daysBetweenIsoDates(startDate, endDate) < 0) return [];
  const reserved = championsLeagueReservedNationalCupDates(year);
  const excludeBreak = options.excludeBreak !== false;
  const dates = [];
  for(let date=startDate; daysBetweenIsoDates(date, endDate) >= 0; date=addDaysToIsoDate(date, 1)){
    const utc = new Date(`${date}T00:00:00Z`);
    if(utc.getUTCDay() !== 3) continue;
    if(reserved.has(date)) continue;
    if(excludeBreak && typeof isMidseasonVacationDate === 'function' && isMidseasonVacationDate(date, year)) continue;
    dates.push(date);
  }
  return dates;
}
function championsLeagueCalendarForYear(year=currentSeasonYear()){
  const seasonStart = seasonStartDateForYear(year);
  const preseasonEnd = addDaysToIsoDate(seasonStart, Math.max(0, PRESEASON_TURNS * DAYS_PER_ADVANCE));
  const breakStart = midseasonBreakStartsForSeason(year);
  const breakEnd = midseasonBreakEndsForSeason(year);
  const worldDraw = championsLeagueWorldCupDrawDate(year);
  const finalDeadline = addDaysToIsoDate(worldDraw, -CHAMPIONS_LEAGUE_CONFIG.finalBeforeWorldCupDrawDays);
  const beforeBreakEnd = validIsoDate(breakStart) ? addDaysToIsoDate(breakStart, -1) : finalDeadline;
  const groupCandidates = championsLeagueWednesdaysBetween(preseasonEnd, beforeBreakEnd, year);
  const groupDates = groupCandidates.slice(-CHAMPIONS_LEAGUE_CONFIG.groupMatchdays);
  const knockoutStart = validIsoDate(breakEnd) ? addDaysToIsoDate(breakEnd, 1) : addDaysToIsoDate(groupDates[groupDates.length - 1] || preseasonEnd, 1);
  const knockoutCandidates = championsLeagueWednesdaysBetween(knockoutStart, finalDeadline, year);
  const knockoutDates = knockoutCandidates.slice(-9);
  const complete = groupDates.length === 6 && knockoutDates.length === 9;
  const stages = complete ? {
    r32:[knockoutDates[0], knockoutDates[1]],
    r16:[knockoutDates[2], knockoutDates[3]],
    qf:[knockoutDates[4], knockoutDates[5]],
    sf:[knockoutDates[6], knockoutDates[7]],
    final:knockoutDates[8]
  } : { r32:[], r16:[], qf:[], sf:[], final:'' };
  const firstGroupDate = groupDates[0] || '';
  const drawDate = firstGroupDate ? addDaysToIsoDate(firstGroupDate, -CHAMPIONS_LEAGUE_CONFIG.drawLeadDays) : '';
  return {
    year,
    complete,
    drawDate,
    drawSeasonDay:validIsoDate(drawDate) ? seasonDayFromDate(drawDate, year) : 0,
    groupDates,
    groupSeasonDays:groupDates.map(date => seasonDayFromDate(date, year)),
    stages,
    stageSeasonDays:{
      r32:(stages.r32 || []).map(date => seasonDayFromDate(date, year)),
      r16:(stages.r16 || []).map(date => seasonDayFromDate(date, year)),
      qf:(stages.qf || []).map(date => seasonDayFromDate(date, year)),
      sf:(stages.sf || []).map(date => seasonDayFromDate(date, year)),
      final:validIsoDate(stages.final) ? seasonDayFromDate(stages.final, year) : 0
    },
    breakStart,
    breakEnd,
    worldCupDrawDate:worldDraw,
    finalDeadline
  };
}
function normalizeChampionsLeagueCalendar(raw, year=currentSeasonYear()){
  const calculated = championsLeagueCalendarForYear(year);
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const groupDates = Array.isArray(src.groupDates) && src.groupDates.length === 6 && src.groupDates.every(validIsoDate) ? src.groupDates.slice(0,6) : calculated.groupDates;
  const rawStages = src.stages && typeof src.stages === 'object' && !Array.isArray(src.stages) ? src.stages : {};
  const stagePair = key => Array.isArray(rawStages[key]) && rawStages[key].length === 2 && rawStages[key].every(validIsoDate) ? rawStages[key].slice(0,2) : calculated.stages[key];
  const final = validIsoDate(rawStages.final) ? rawStages.final : calculated.stages.final;
  const drawDate = validIsoDate(src.drawDate) ? src.drawDate : calculated.drawDate;
  return {
    ...calculated,
    drawDate,
    drawSeasonDay:validIsoDate(drawDate) ? seasonDayFromDate(drawDate, year) : calculated.drawSeasonDay,
    groupDates,
    groupSeasonDays:groupDates.map(date => seasonDayFromDate(date, year)),
    stages:{ r32:stagePair('r32'), r16:stagePair('r16'), qf:stagePair('qf'), sf:stagePair('sf'), final },
    stageSeasonDays:{
      r32:stagePair('r32').map(date => seasonDayFromDate(date, year)),
      r16:stagePair('r16').map(date => seasonDayFromDate(date, year)),
      qf:stagePair('qf').map(date => seasonDayFromDate(date, year)),
      sf:stagePair('sf').map(date => seasonDayFromDate(date, year)),
      final:validIsoDate(final) ? seasonDayFromDate(final, year) : 0
    }
  };
}
function normalizeChampionsLeagueTie(raw={}, index=0){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    id:String(src.id || `tie-${index + 1}`),
    stage:String(src.stage || ''),
    clubIds:Array.isArray(src.clubIds) ? src.clubIds.map(Number).filter(Boolean).slice(0,2) : [],
    betterSeedClubId:Number(src.betterSeedClubId || 0),
    matchIds:Array.isArray(src.matchIds) ? src.matchIds.map(String).filter(Boolean).slice(0,2) : [],
    winnerId:Number(src.winnerId || 0),
    aggregateHome:Number(src.aggregateHome || 0),
    aggregateAway:Number(src.aggregateAway || 0)
  };
}
function normalizeChampionsLeagueState(raw={}, season=game?.seasonNumber || 1, year=game?.seasonYear || currentSeasonYear()){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const same = Number(src.season || 0) === Number(season) && Number(src.year || 0) === Number(year);
  const base = same ? src : {};
  const groups = Array.isArray(base.groups) ? base.groups.slice(0,8).map((group,index) => ({
    id:String(group?.id || CHAMPIONS_LEAGUE_GROUP_IDS[index] || ''),
    clubIds:Array.isArray(group?.clubIds) ? group.clubIds.map(Number).filter(Boolean).slice(0,4) : []
  })) : [];
  const ties = {};
  ['r32','r16','qf','sf'].forEach(stage => {
    ties[stage] = Array.isArray(base.ties?.[stage]) ? base.ties[stage].map(normalizeChampionsLeagueTie) : [];
  });
  return {
    version:CHAMPIONS_LEAGUE_VERSION,
    season:Number(season),
    year:Number(year),
    name:CHAMPIONS_LEAGUE_CONFIG.name,
    status:String(base.status || 'pending_draw'),
    drawn:Boolean(base.drawn),
    createdAt:Number(base.createdAt || 0),
    calendar:normalizeChampionsLeagueCalendar(base.calendar || {}, year),
    participantClubIds:Array.isArray(base.participantClubIds) ? base.participantClubIds.map(Number).filter(Boolean).slice(0,32) : [],
    qualificationSources:Array.isArray(base.qualificationSources) ? base.qualificationSources.map(item => ({ clubId:Number(item?.clubId || 0), country:String(item?.country || ''), source:String(item?.source || '') })).filter(item => item.clubId) : [],
    pots:Array.isArray(base.pots) ? base.pots.slice(0,4).map(pot => Array.isArray(pot) ? pot.map(Number).filter(Boolean).slice(0,8) : []) : [],
    groups,
    clubSeeds:base.clubSeeds && typeof base.clubSeeds === 'object' && !Array.isArray(base.clubSeeds) ? { ...base.clubSeeds } : {},
    ties,
    finalMatchId:String(base.finalMatchId || ''),
    championId:Number(base.championId || 0),
    runnerUpId:Number(base.runnerUpId || 0),
    skippedReason:String(base.skippedReason || ''),
    finalRevenuePaid:Boolean(base.finalRevenuePaid)
  };
}
function normalizeChampionsLeagueHistoryState(raw={}){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const editions = (Array.isArray(src.editions) ? src.editions : []).map(item => {
    const season = Math.max(1, Math.round(Number(item?.season || 1)));
    const year = Math.round(Number(item?.year || seasonYearForNumber(season)));
    return {
      version:CHAMPIONS_LEAGUE_VERSION,
      season,
      year,
      name:String(item?.name || CHAMPIONS_LEAGUE_CONFIG.name),
      status:String(item?.status || ''),
      participantClubIds:Array.isArray(item?.participantClubIds) ? item.participantClubIds.map(Number).filter(Boolean) : [],
      qualificationSources:Array.isArray(item?.qualificationSources) ? item.qualificationSources.map(source => ({ clubId:Number(source?.clubId || 0), country:String(source?.country || ''), source:String(source?.source || '') })).filter(source => source.clubId) : [],
      pots:Array.isArray(item?.pots) ? item.pots.slice(0,4).map(pot => Array.isArray(pot) ? pot.map(Number).filter(Boolean).slice(0,8) : []) : [],
      calendar:normalizeChampionsLeagueCalendar(item?.calendar || {}, year),
      groups:Array.isArray(item?.groups) ? item.groups.map(group => ({ id:String(group?.id || ''), clubIds:Array.isArray(group?.clubIds) ? group.clubIds.map(Number).filter(Boolean) : [], standings:Array.isArray(group?.standings) ? group.standings.map(row => ({ ...row })) : [], matches:Array.isArray(group?.matches) ? group.matches.map(match => ({ ...match })) : [] })) : [],
      stages:item?.stages && typeof item.stages === 'object' && !Array.isArray(item.stages) ? Object.fromEntries(Object.entries(item.stages).map(([key,matches]) => [key, Array.isArray(matches) ? matches.map(match => ({ ...match })) : []])) : {},
      championId:Number(item?.championId || 0),
      runnerUpId:Number(item?.runnerUpId || 0),
      archivedAt:String(item?.archivedAt || '')
    };
  }).filter(item => item.season && item.year).sort((a,b)=>Number(a.year)-Number(b.year) || Number(a.season)-Number(b.season)).slice(-30);
  return { version:CHAMPIONS_LEAGUE_VERSION, editions };
}
function ensureChampionsLeagueState(target=game){
  if(!target) return null;
  const season = Math.max(1, Math.round(Number(target.seasonNumber || 1)));
  const year = Math.round(Number(target.seasonYear || seasonYearForNumber(season)));
  const current = target.championsLeague;
  const validCurrent = Boolean(
    current && typeof current === 'object' && !Array.isArray(current)
    && Number(current.version || 0) === CHAMPIONS_LEAGUE_VERSION
    && Number(current.season || 0) === season
    && Number(current.year || 0) === year
    && current.calendar && typeof current.calendar === 'object'
    && current.ties && typeof current.ties === 'object'
  );
  if(!validCurrent) target.championsLeague = normalizeChampionsLeagueState(current || {}, season, year);
  if(!target.championsLeagueHistory || Number(target.championsLeagueHistory.version || 0) !== CHAMPIONS_LEAGUE_VERSION || !Array.isArray(target.championsLeagueHistory.editions)){
    target.championsLeagueHistory = normalizeChampionsLeagueHistoryState(target.championsLeagueHistory || {});
  }
  return target.championsLeague;
}
function championsLeagueState(){ return ensureChampionsLeagueState(game); }
function championsLeagueRound(round){ return Boolean(round?.championsLeagueRound || (round?.matches || []).some(match => match?.championsLeague)); }
function championsLeagueAllMatches(state=game){
  const season = Number(state?.championsLeague?.season || state?.seasonNumber || 0);
  return (state?.fixtures || []).filter(championsLeagueRound).flatMap(round => round?.matches || []).filter(match => match?.championsLeague && (!season || Number(match.championsLeagueSeason || season) === season));
}
function championsLeagueStageMatches(stage, state=game){
  return championsLeagueAllMatches(state).filter(match => String(match.championsLeagueStage || '') === String(stage || ''));
}
function championsLeagueMatchById(id){
  const key = String(id || '');
  return championsLeagueAllMatches().find(match => String(match.id || '') === key) || null;
}
function championsLeaguePreviousSeasonStandings(country){
  const previousSeason = Math.max(0, Number(game?.seasonNumber || 1) - 1);
  if(!previousSeason) return [];
  const history = (game?.standingsHistory?.seasons || []).find(item => Number(item?.season || 0) === previousSeason);
  if(!history) return [];
  const topDivision = (seed?.divisions || [])
    .filter(division => championsLeagueCountryKey(division.country || division.pais) === championsLeagueCountryKey(country))
    .sort((a,b)=>Number(a.order || 99)-Number(b.order || 99))[0];
  if(!topDivision) return [];
  return (Array.isArray(history.divisions?.[topDivision.id]) ? history.divisions[topDivision.id] : [])
    .slice().sort((a,b)=>Number(a.position || 999)-Number(b.position || 999)).map(row => Number(row.clubId || 0)).filter(Boolean);
}
function championsLeaguePreviousChampionEntry(type, country=''){
  const season = Math.max(0, Number(game?.seasonNumber || 1) - 1);
  if(!season) return null;
  const entries = Array.isArray(game?.competitionChampionsHistory?.entries) ? game.competitionChampionsHistory.entries : [];
  return entries.slice().reverse().find(entry => {
    if(Number(entry?.season || 0) !== season) return false;
    if(type === 'championsLeague') return String(entry?.competitionId || '') === CHAMPIONS_LEAGUE_CONFIG.id || /champions\s*league/i.test(String(entry?.competitionName || ''));
    if(type === 'national') return String(entry?.type || '') === 'national_cup' && championsLeagueCountryKey(championsLeagueClubCountry(entry?.championId)) === championsLeagueCountryKey(country);
    return false;
  }) || null;
}
function championsLeagueCurrentTopDivisionClubIds(country){
  const topDivision = (seed?.divisions || [])
    .filter(division => championsLeagueCountryKey(division.country || division.pais) === championsLeagueCountryKey(country))
    .sort((a,b)=>Number(a.order || 99)-Number(b.order || 99))[0];
  if(!topDivision) return [];
  return (seed?.clubs || []).filter(club => String(club?.divisionId || '') === String(topDivision.id) && !club?.specialCompetitionOnly)
    .slice().sort((a,b)=>championsLeagueClubReputation(b.id)-championsLeagueClubReputation(a.id) || String(a.name || '').localeCompare(String(b.name || ''), 'es')).map(club => Number(club.id));
}
function championsLeagueCountryQualifiers(country, count){
  const output = [];
  const sources = [];
  const add = (clubId, source) => {
    const id = Number(clubId || 0);
    if(!id || output.includes(id) || championsLeagueCountryKey(championsLeagueClubCountry(id)) !== championsLeagueCountryKey(country) || output.length >= count) return;
    output.push(id);
    sources.push({ clubId:id, country, source });
  };
  const defending = championsLeaguePreviousChampionEntry('championsLeague');
  if(defending && championsLeagueCountryKey(championsLeagueClubCountry(defending.championId)) === championsLeagueCountryKey(country)) add(defending.championId, 'Campeón vigente de Champions League');
  const cupChampion = championsLeaguePreviousChampionEntry('national', country);
  if(cupChampion) add(cupChampion.championId, `Campeón de ${cupChampion.competitionName || 'copa nacional'}`);
  championsLeaguePreviousSeasonStandings(country).forEach((clubId,index) => add(clubId, `${index + 1}° de liga`));
  championsLeagueCurrentTopDivisionClubIds(country).forEach((clubId,index) => add(clubId, `Clasificación inicial por reputación ${index + 1}`));
  return { clubIds:output.slice(0,count), sources:sources.slice(0,count) };
}
function championsLeagueSelectPoolParticipants(count=10){
  if(typeof ensureChampionsTeamPoolData === 'function') ensureChampionsTeamPoolData({ markAutosave:true });
  const available = typeof championsPoolClubIds === 'function' ? championsPoolClubIds({ ensure:true, markAutosave:true }) : [];
  const defendingId = Number(championsLeaguePreviousChampionEntry('championsLeague')?.championId || 0);
  const selected = [];
  if(defendingId && available.includes(defendingId)) selected.push(defendingId);
  const ordered = available.filter(id => Number(id) !== defendingId).slice().sort((a,b) => {
    const repDiff = championsLeagueClubReputation(b)-championsLeagueClubReputation(a);
    const aRotation = typeof hashNumber === 'function' ? hashNumber(`${championsLeagueSeasonToken('pool')}-${a}`, 18) : 0;
    const bRotation = typeof hashNumber === 'function' ? hashNumber(`${championsLeagueSeasonToken('pool')}-${b}`, 18) : 0;
    return (repDiff * 2) + (bRotation-aRotation) || Number(a)-Number(b);
  });
  ordered.forEach(clubId => { if(selected.length < count) selected.push(Number(clubId)); });
  return selected.slice(0,count);
}
function championsLeagueParticipants(){
  const clubIds = [];
  const sources = [];
  [['Inglaterra',8],['Italia',6],['España',6],['Rumania',2]].forEach(([country,count]) => {
    const selected = championsLeagueCountryQualifiers(country, count);
    clubIds.push(...selected.clubIds);
    sources.push(...selected.sources);
  });
  championsLeagueSelectPoolParticipants(CHAMPIONS_LEAGUE_CONFIG.slots.pool).forEach(clubId => {
    clubIds.push(Number(clubId));
    sources.push({ clubId:Number(clubId), country:championsLeagueClubCountry(clubId), source:'Selección de la bolsa Champions' });
  });
  return { clubIds:[...new Set(clubIds)].slice(0,32), sources };
}
function championsLeagueSeededParticipants(clubIds=[]){
  const defendingId = Number(championsLeaguePreviousChampionEntry('championsLeague')?.championId || 0);
  return (clubIds || []).slice().sort((a,b) => {
    if(Number(a) === defendingId && Number(b) !== defendingId) return -1;
    if(Number(b) === defendingId && Number(a) !== defendingId) return 1;
    return championsLeagueClubReputation(b)-championsLeagueClubReputation(a)
      || (typeof hashNumber === 'function' ? hashNumber(`${championsLeagueSeasonToken('seed')}-${a}`, 1000000)-hashNumber(`${championsLeagueSeasonToken('seed')}-${b}`, 1000000) : Number(a)-Number(b));
  });
}
function championsLeagueAssignPotToGroups(pot=[], groups=[], token=''){
  const ordered = championsLeagueDeterministicSort(pot, token);
  const assignment = new Array(groups.length).fill(0);
  const used = new Set();
  const recurse = depth => {
    if(depth >= groups.length) return true;
    const candidatesByGroup = [];
    for(let groupIndex=0; groupIndex<groups.length; groupIndex+=1){
      if(assignment[groupIndex]) continue;
      const countries = new Set((groups[groupIndex].clubIds || []).map(championsLeagueClubCountry).map(championsLeagueCountryKey));
      const candidates = ordered.filter(clubId => !used.has(Number(clubId)) && !countries.has(championsLeagueCountryKey(championsLeagueClubCountry(clubId))));
      candidatesByGroup.push({ groupIndex, candidates });
    }
    candidatesByGroup.sort((a,b)=>a.candidates.length-b.candidates.length || a.groupIndex-b.groupIndex);
    const target = candidatesByGroup[0];
    if(!target || !target.candidates.length) return false;
    for(const clubId of target.candidates){
      assignment[target.groupIndex] = Number(clubId);
      used.add(Number(clubId));
      if(recurse(depth + 1)) return true;
      used.delete(Number(clubId));
      assignment[target.groupIndex] = 0;
    }
    return false;
  };
  if(!recurse(0)){
    ordered.forEach((clubId,index) => { assignment[index] = Number(clubId); });
  }
  assignment.forEach((clubId,index) => { if(clubId) groups[index].clubIds.push(clubId); });
  return groups;
}
function championsLeagueDrawGroups(clubIds=[]){
  const seeded = championsLeagueSeededParticipants(clubIds);
  const pots = [seeded.slice(0,8),seeded.slice(8,16),seeded.slice(16,24),seeded.slice(24,32)];
  const groups = CHAMPIONS_LEAGUE_GROUP_IDS.map(id => ({ id, clubIds:[] }));
  pots.forEach((pot,index) => championsLeagueAssignPotToGroups(pot, groups, championsLeagueSeasonToken(`pot-${index + 1}`)));
  return { pots, groups };
}
function championsLeagueGroupRoundPairs(clubIds=[]){
  const t = clubIds.map(Number);
  if(t.length !== 4) return [];
  return [
    [[t[0],t[3]],[t[1],t[2]]],
    [[t[2],t[0]],[t[3],t[1]]],
    [[t[0],t[1]],[t[2],t[3]]],
    [[t[3],t[0]],[t[2],t[1]]],
    [[t[0],t[2]],[t[1],t[3]]],
    [[t[1],t[0]],[t[3],t[2]]]
  ];
}
function championsLeagueFixtureMatch({ stage, date, homeId, awayId, groupId='', roundNumber=1, tieId='', leg=0, betterSeedClubId=0, neutral=false, matchIndex=0 }){
  const season = Number(game?.seasonNumber || 1);
  const finalVenue = neutral ? championsLeagueFinalVenue([homeId, awayId]) : null;
  const secondLeg = Number(leg) === 2;
  const final = stage === 'final';
  return {
    id:`ucl-s${season}-${stage}-${groupId || tieId || 'match'}-${roundNumber}-${matchIndex}-${homeId}-${awayId}`,
    divisionId:CHAMPIONS_LEAGUE_CONFIG.id,
    divisionName:CHAMPIONS_LEAGUE_CONFIG.name,
    competitionType:'international_cup',
    competitionName:CHAMPIONS_LEAGUE_CONFIG.name,
    internationalCup:true,
    continentalCup:true,
    championsLeague:true,
    championsLeagueSeason:season,
    championsLeagueStage:stage,
    championsLeagueStageLabel:CHAMPIONS_LEAGUE_STAGE_LABELS[stage] || stage,
    championsLeagueGroup:groupId,
    championsLeagueRound:Number(roundNumber || 1),
    championsLeagueTieId:tieId,
    betterSeedClubId:Number(betterSeedClubId || 0),
    homeId:Number(homeId),
    awayId:Number(awayId),
    date,
    roundDate:date,
    seasonDay:seasonDayFromDate(date, currentSeasonYear()),
    played:false,
    knockout:stage !== 'groups',
    twoLegged:Boolean(leg),
    leg:Number(leg || 0),
    secondLeg,
    requiresWinner:Boolean(secondLeg || final),
    tieBreakMode:secondLeg || final ? 'penalties' : 'none',
    allowDraw:!(secondLeg || final),
    neutral:Boolean(neutral),
    neutralVenue:Boolean(neutral),
    stadiumClubId:Number(finalVenue?.id || 0),
    stadiumName:finalVenue ? clubStadiumName(finalVenue.id) : '',
    stadiumCapacity:finalVenue ? clubStadiumCapacity(finalVenue.id) : 0,
    ticketPrice:final ? CHAMPIONS_LEAGUE_CONFIG.finalTicketPrice : 0,
    competitionRules:{
      twoLegged:Boolean(leg),
      leg:Number(leg || 0),
      requiresWinner:Boolean(secondLeg || final),
      tieBreakMode:secondLeg || final ? 'penalties' : 'none',
      allowDraw:!(secondLeg || final),
      neutralVenue:Boolean(neutral)
    }
  };
}
function championsLeagueAppendRound(stage, label, date, matches=[], options={}){
  if(!game?.fixtures || !validIsoDate(date) || !matches.length) return null;
  const round = {
    id:`championsLeague-s${game.seasonNumber}-${stage}-${options.roundNumber || 1}`,
    matchday:game.fixtures.length + 1,
    date,
    startDate:date,
    endDate:date,
    roundDate:date,
    seasonDay:seasonDayFromDate(date, currentSeasonYear()),
    title:`${CHAMPIONS_LEAGUE_CONFIG.name} · ${label}`,
    championsLeagueRound:true,
    championsLeagueStage:stage,
    championsLeagueStageLabel:label,
    championsLeagueLeg:Number(options.leg || 0),
    matches
  };
  game.fixtures.push(round);
  if(typeof sortFixturesAfterNationalCupChange === 'function') sortFixturesAfterNationalCupChange();
  return round;
}
function championsLeagueCreateGroupFixtures(state){
  const dates = state?.calendar?.groupDates || [];
  if(dates.length !== 6 || state.groups.length !== 8) return false;
  for(let roundIndex=0; roundIndex<6; roundIndex+=1){
    const matches = [];
    state.groups.forEach((group,groupIndex) => {
      const pairs = championsLeagueGroupRoundPairs(group.clubIds)[roundIndex] || [];
      pairs.forEach((pair,pairIndex) => matches.push(championsLeagueFixtureMatch({
        stage:'groups', date:dates[roundIndex], groupId:group.id, roundNumber:roundIndex + 1,
        homeId:pair[0], awayId:pair[1], matchIndex:groupIndex * 2 + pairIndex
      })));
    });
    championsLeagueAppendRound('groups', `Grupos ${roundIndex + 1}/6`, dates[roundIndex], matches, { roundNumber:roundIndex + 1 });
  }
  return true;
}
function championsLeagueDrawEdition(options={}){
  const state = championsLeagueState();
  if(!state || state.drawn || !CHAMPIONS_LEAGUE_CONFIG.enabled) return false;
  if(!state.calendar.complete){
    state.status = 'skipped';
    state.skippedReason = 'No fue posible ubicar las 15 fechas necesarias antes del sorteo del Mundial.';
    return false;
  }
  const participants = championsLeagueParticipants();
  if(participants.clubIds.length !== 32){
    state.status = 'skipped';
    state.skippedReason = `Participantes insuficientes: ${participants.clubIds.length}/32.`;
    return false;
  }
  const draw = championsLeagueDrawGroups(participants.clubIds);
  if(draw.groups.some(group => group.clubIds.length !== 4)){
    state.status = 'skipped';
    state.skippedReason = 'No fue posible completar el sorteo de grupos.';
    return false;
  }
  state.participantClubIds = participants.clubIds;
  state.qualificationSources = participants.sources;
  state.pots = draw.pots;
  state.groups = draw.groups;
  state.clubSeeds = {};
  state.groups.forEach(group => group.clubIds.forEach((clubId,index) => { state.clubSeeds[clubId] = { groupId:group.id, drawSlot:index + 1, groupPosition:0 }; }));
  state.drawn = true;
  state.status = 'groups';
  state.createdAt = Date.now();
  championsLeagueCreateGroupFixtures(state);
  if(options.silent !== true && typeof pushGameMessage === 'function'){
    const participates = state.participantClubIds.includes(Number(game.selectedClubId || 0));
    pushGameMessage({
      id:`championsLeague-${state.season}-draw`, type:'deportivo', priority:participates ? 'high' : 'normal', inbox:participates ? 'always' : 'never',
      title:`Sorteo de ${CHAMPIONS_LEAGUE_CONFIG.name}`,
      body:`Se sortearon 8 grupos de 4 equipos para la Champions League. Cada club jugará seis partidos y todos avanzarán a 16avos; la posición del grupo definirá rival y localía.`
    });
  }
  return true;
}
function championsLeagueGroupMatches(groupId, state=game){
  return championsLeagueStageMatches('groups', state).filter(match => String(match.championsLeagueGroup || '') === String(groupId || ''));
}
function championsLeagueGroupStandings(groupId, state=game){
  const edition = state?.championsLeague || game?.championsLeague;
  const group = (edition?.groups || []).find(item => String(item.id) === String(groupId));
  const rows = new Map((group?.clubIds || []).map(clubId => [Number(clubId), { clubId:Number(clubId), pj:0, pg:0, pe:0, pp:0, gf:0, gc:0, dg:0, pts:0 }]));
  championsLeagueGroupMatches(groupId, state).filter(match => match.played).forEach(match => {
    const home = rows.get(Number(match.homeId));
    const away = rows.get(Number(match.awayId));
    if(!home || !away) return;
    const hg = Number(match.homeGoals || 0), ag = Number(match.awayGoals || 0);
    home.pj += 1; away.pj += 1; home.gf += hg; home.gc += ag; away.gf += ag; away.gc += hg;
    if(hg > ag){ home.pg += 1; away.pp += 1; home.pts += 3; }
    else if(ag > hg){ away.pg += 1; home.pp += 1; away.pts += 3; }
    else { home.pe += 1; away.pe += 1; home.pts += 1; away.pts += 1; }
    home.dg = home.gf-home.gc; away.dg = away.gf-away.gc;
  });
  return Array.from(rows.values()).sort((a,b)=>b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || b.pg-a.pg || championsLeagueClubReputation(b.clubId)-championsLeagueClubReputation(a.clubId) || Number(a.clubId)-Number(b.clubId)).map((row,index)=>({ ...row, position:index + 1 }));
}
function championsLeagueStageComplete(stage){
  const matches = championsLeagueStageMatches(stage);
  if(stage === 'groups') return matches.length === 96 && matches.every(match => match.played);
  if(stage === 'final') return matches.length === 1 && matches[0].played && Number(matches[0].winnerClubId || 0);
  const state = championsLeagueState();
  const ties = state?.ties?.[stage] || [];
  return ties.length > 0 && ties.every(tie => Number(championsLeagueTieWinner(tie) || 0));
}
function championsLeagueTieMatches(tie){
  return (tie?.matchIds || []).map(championsLeagueMatchById).filter(Boolean).sort((a,b)=>Number(a.leg || 0)-Number(b.leg || 0));
}
function championsLeagueSyncTieAggregate(tie){
  const matches = championsLeagueTieMatches(tie);
  const first = matches.find(match => Number(match.leg || 0) === 1);
  const second = matches.find(match => Number(match.leg || 0) === 2);
  if(!first?.played || !second || second.played) return false;
  const aggregateBefore = { home:Number(first.awayGoals || 0), away:Number(first.homeGoals || 0) };
  second.aggregateBefore = aggregateBefore;
  second.competitionRules = { ...(second.competitionRules || {}), aggregateBefore, twoLegged:true, leg:2, requiresWinner:true, tieBreakMode:'penalties' };
  return true;
}
function championsLeagueSyncAllAggregates(){
  const state = championsLeagueState();
  let changed = false;
  ['r32','r16','qf','sf'].forEach(stage => (state?.ties?.[stage] || []).forEach(tie => { if(championsLeagueSyncTieAggregate(tie)) changed = true; }));
  return changed;
}
function championsLeagueTieWinner(tie){
  if(Number(tie?.winnerId || 0)) return Number(tie.winnerId);
  const matches = championsLeagueTieMatches(tie);
  const first = matches.find(match => Number(match.leg || 0) === 1);
  const second = matches.find(match => Number(match.leg || 0) === 2);
  if(!first?.played || !second?.played) return 0;
  const winner = Number(second.winnerClubId || 0);
  if(winner){ tie.winnerId = winner; return winner; }
  const homeAggregate = Number(first.awayGoals || 0) + Number(second.homeGoals || 0);
  const awayAggregate = Number(first.homeGoals || 0) + Number(second.awayGoals || 0);
  const resolved = homeAggregate > awayAggregate ? Number(second.homeId) : awayAggregate > homeAggregate ? Number(second.awayId) : 0;
  if(resolved) tie.winnerId = resolved;
  return resolved;
}
function championsLeagueSeedForClub(clubId){
  const state = championsLeagueState();
  const seedInfo = state?.clubSeeds?.[Number(clubId)] || {};
  return { clubId:Number(clubId), groupId:String(seedInfo.groupId || ''), groupPosition:Math.max(1, Math.round(Number(seedInfo.groupPosition || 4))) };
}
function championsLeaguePairEntries(entries=[], stage='r16'){
  const pairs = [];
  for(let index=0; index+1<entries.length; index+=2) pairs.push([entries[index],entries[index + 1]]);
  return pairs;
}
function championsLeagueCreateTwoLegStage(stage, pairs=[]){
  const state = championsLeagueState();
  const dates = state?.calendar?.stages?.[stage] || [];
  if(dates.length !== 2 || !pairs.length || championsLeagueStageMatches(stage).length) return false;
  const ties = [];
  const firstMatches = [];
  const secondMatches = [];
  pairs.forEach((pair,index) => {
    const a = typeof pair[0] === 'object' ? pair[0] : championsLeagueSeedForClub(pair[0]);
    const b = typeof pair[1] === 'object' ? pair[1] : championsLeagueSeedForClub(pair[1]);
    const aBetter = Number(a.groupPosition || 4) < Number(b.groupPosition || 4)
      || (Number(a.groupPosition || 4) === Number(b.groupPosition || 4) && championsLeagueClubReputation(a.clubId) >= championsLeagueClubReputation(b.clubId));
    const better = aBetter ? a : b;
    const other = aBetter ? b : a;
    const tieId = `${stage}-${index + 1}`;
    const first = championsLeagueFixtureMatch({ stage, date:dates[0], homeId:other.clubId, awayId:better.clubId, roundNumber:1, tieId, leg:1, betterSeedClubId:better.clubId, matchIndex:index });
    const second = championsLeagueFixtureMatch({ stage, date:dates[1], homeId:better.clubId, awayId:other.clubId, roundNumber:2, tieId, leg:2, betterSeedClubId:better.clubId, matchIndex:index });
    ties.push({ id:tieId, stage, clubIds:[a.clubId,b.clubId], betterSeedClubId:better.clubId, matchIds:[first.id,second.id], winnerId:0, aggregateHome:0, aggregateAway:0 });
    firstMatches.push(first); secondMatches.push(second);
  });
  state.ties[stage] = ties;
  championsLeagueAppendRound(stage, `${CHAMPIONS_LEAGUE_STAGE_LABELS[stage]} · ida`, dates[0], firstMatches, { roundNumber:1, leg:1 });
  championsLeagueAppendRound(stage, `${CHAMPIONS_LEAGUE_STAGE_LABELS[stage]} · vuelta`, dates[1], secondMatches, { roundNumber:2, leg:2 });
  state.status = stage;
  const participates = pairs.flat().some(item => Number(item?.clubId ?? item) === Number(game.selectedClubId || 0));
  if(typeof pushGameMessage === 'function') pushGameMessage({
    id:`championsLeague-${state.season}-${stage}`, type:'deportivo', priority:participates ? 'high' : 'normal', inbox:participates ? 'always' : 'never',
    title:`${CHAMPIONS_LEAGUE_CONFIG.name} · ${CHAMPIONS_LEAGUE_STAGE_LABELS[stage]}`,
    body:`Los partidos de ida se jugarán el ${matchDateLabel(dates[0])} y las vueltas el ${matchDateLabel(dates[1])}.`
  });
  return true;
}
function championsLeagueCreateRoundOf32(){
  const state = championsLeagueState();
  if(!state || !championsLeagueStageComplete('groups') || championsLeagueStageMatches('r32').length) return false;
  const pairs = [];
  for(let groupIndex=0; groupIndex<8; groupIndex+=2){
    const firstGroup = state.groups[groupIndex];
    const secondGroup = state.groups[groupIndex + 1];
    const a = championsLeagueGroupStandings(firstGroup.id);
    const b = championsLeagueGroupStandings(secondGroup.id);
    a.forEach(row => { state.clubSeeds[row.clubId] = { ...(state.clubSeeds[row.clubId] || {}), groupId:firstGroup.id, groupPosition:row.position }; });
    b.forEach(row => { state.clubSeeds[row.clubId] = { ...(state.clubSeeds[row.clubId] || {}), groupId:secondGroup.id, groupPosition:row.position }; });
    pairs.push(
      [championsLeagueSeedForClub(a[0]?.clubId),championsLeagueSeedForClub(b[3]?.clubId)],
      [championsLeagueSeedForClub(a[1]?.clubId),championsLeagueSeedForClub(b[2]?.clubId)],
      [championsLeagueSeedForClub(b[0]?.clubId),championsLeagueSeedForClub(a[3]?.clubId)],
      [championsLeagueSeedForClub(b[1]?.clubId),championsLeagueSeedForClub(a[2]?.clubId)]
    );
  }
  return championsLeagueCreateTwoLegStage('r32', pairs.filter(pair => pair.every(item => item.clubId)));
}
function championsLeagueWinnerEntries(stage){
  const state = championsLeagueState();
  return (state?.ties?.[stage] || []).map(tie => championsLeagueTieWinner(tie)).filter(Boolean).map(championsLeagueSeedForClub);
}
function championsLeagueCreateNextKnockoutStage(previousStage, nextStage){
  if(!championsLeagueStageComplete(previousStage) || championsLeagueStageMatches(nextStage).length) return false;
  return championsLeagueCreateTwoLegStage(nextStage, championsLeaguePairEntries(championsLeagueWinnerEntries(previousStage), nextStage));
}
function championsLeagueFinalVenue(excluded=[]){
  const excludedSet = new Set((excluded || []).map(Number));
  const european = new Set(['inglaterra','italia','espana','rumania','alemania','francia','portugal','rusia','paises bajos','grecia','belgica','escocia','dinamarca','republica checa']);
  let candidates = (seed?.clubs || []).filter(club => !excludedSet.has(Number(club?.id || 0)) && !club?.noOwnStadium && !club?.specialCompetitionOnly && european.has(championsLeagueCountryKey(club?.country || club?.pais)));
  candidates = candidates.sort((a,b)=>clubStadiumCapacity(b.id)-clubStadiumCapacity(a.id) || championsLeagueClubReputation(b.id)-championsLeagueClubReputation(a.id));
  if(!candidates.length) candidates = (seed?.clubs || []).filter(club => !excludedSet.has(Number(club?.id || 0)) && !club?.noOwnStadium).sort((a,b)=>clubStadiumCapacity(b.id)-clubStadiumCapacity(a.id));
  return candidates[0] || null;
}
function championsLeagueCreateFinal(){
  const state = championsLeagueState();
  if(!championsLeagueStageComplete('sf') || championsLeagueStageMatches('final').length) return false;
  const finalists = championsLeagueWinnerEntries('sf');
  if(finalists.length !== 2) return false;
  const date = state.calendar.stages.final;
  const match = championsLeagueFixtureMatch({ stage:'final', date, homeId:finalists[0].clubId, awayId:finalists[1].clubId, roundNumber:1, neutral:true, matchIndex:0 });
  const round = championsLeagueAppendRound('final', 'Final', date, [match], { roundNumber:1 });
  state.finalMatchId = round?.matches?.[0]?.id || match.id;
  state.status = 'final';
  if(typeof pushGameMessage === 'function') pushGameMessage({
    id:`championsLeague-${state.season}-final`, type:'deportivo', priority:finalists.some(item => Number(item.clubId) === Number(game.selectedClubId || 0)) ? 'high' : 'normal', inbox:finalists.some(item => Number(item.clubId) === Number(game.selectedClubId || 0)) ? 'always' : 'never',
    title:`${CHAMPIONS_LEAGUE_CONFIG.name} · Final`,
    body:`${clubName(finalists[0].clubId)} y ${clubName(finalists[1].clubId)} jugarán la final a partido único el ${matchDateLabel(date)} en ${match.stadiumName || 'un estadio neutral'}.`
  });
  return true;
}
function championsLeagueFinalMatch(){ return championsLeagueStageMatches('final')[0] || null; }
function championsLeagueCreditFinalRevenue(match, result){
  const state = championsLeagueState();
  if(!match?.championsLeague || match.championsLeagueStage !== 'final' || state?.finalRevenuePaid || result?.championsLeagueFinalRevenuePaid) return false;
  const revenue = Math.max(0, Math.round(Number(result?.ticketRevenue || 0)));
  if(revenue <= 0) return false;
  const share = Math.max(0, Math.round(revenue * CHAMPIONS_LEAGUE_CONFIG.finalRevenueShare));
  [Number(match.homeId),Number(match.awayId)].forEach(clubId => {
    if(!clubId || share <= 0) return;
    game.clubBudgets = game.clubBudgets || {};
    if(Number(game.selectedClubId || 0) === clubId){
      if(typeof recordBudgetChange === 'function') recordBudgetChange(share, `Recaudación final · ${CHAMPIONS_LEAGUE_CONFIG.name}`, { type:'championsLeague_final_revenue', matchId:match.id, competitionId:CHAMPIONS_LEAGUE_CONFIG.id, ticketRevenue:revenue, share });
      game.clubBudgets[clubId] = Math.round(Number(game.budget || 0));
    }else game.clubBudgets[clubId] = Math.round(Number(game.clubBudgets[clubId] || 0) + share);
  });
  state.finalRevenuePaid = true;
  result.championsLeagueFinalRevenuePaid = true;
  return true;
}
function finalizeChampionsLeagueMatchResult(match, result){
  if(!match?.championsLeague || !result) return result;
  if(Number(match.leg || 0) === 2){
    const state = championsLeagueState();
    const tie = (state?.ties?.[match.championsLeagueStage] || []).find(item => String(item.id) === String(match.championsLeagueTieId));
    if(tie) championsLeagueSyncTieAggregate(tie);
  }
  let out = { ...result, championsLeague:true, internationalCup:true, continentalCup:true, championsLeagueStage:match.championsLeagueStage, championsLeagueGroup:match.championsLeagueGroup || '', championsLeagueTieId:match.championsLeagueTieId || '', leg:Number(match.leg || 0) };
  if(Number(match.leg || 0) === 2 || match.championsLeagueStage === 'final'){
    if(typeof finalizeWinnerRequiredMatchResult === 'function') out = finalizeWinnerRequiredMatchResult(match, out);
  }
  if(match.championsLeagueStage === 'final'){
    const allocation = typeof nationalCupAttendanceAllocation === 'function' ? nationalCupAttendanceAllocation(match) : { capacity:Number(match.stadiumCapacity || 0), attendance:0, homeAttendance:0, awayAttendance:0 };
    const ticketPrice = CHAMPIONS_LEAGUE_CONFIG.finalTicketPrice;
    out.attendance = allocation.attendance;
    out.homeAttendance = allocation.homeAttendance;
    out.awayAttendance = allocation.awayAttendance;
    out.ticketPrice = ticketPrice;
    out.ticketRevenue = Math.max(0, allocation.attendance * ticketPrice);
    out.stadiumClubId = Number(match.stadiumClubId || 0);
    out.stadiumName = String(match.stadiumName || 'Estadio neutral');
    out.stadiumCapacity = allocation.capacity;
    out.matchContext = { ...(out.matchContext || {}), neutralVenue:true, stadiumName:out.stadiumName, stadiumCapacity:allocation.capacity, totalFans:allocation.attendance, attendance:allocation.attendance, homeAttendance:allocation.homeAttendance, awayAttendance:allocation.awayAttendance, ticketPrice, ticketRevenue:out.ticketRevenue };
    championsLeagueCreditFinalRevenue(match, out);
  }
  return out;
}
function championsLeagueCompleteEdition(){
  const state = championsLeagueState();
  const final = championsLeagueFinalMatch();
  if(!state || state.status === 'completed' || !final?.played || !Number(final.winnerClubId || 0)) return false;
  const championId = Number(final.winnerClubId);
  const runnerUpId = championId === Number(final.homeId) ? Number(final.awayId) : Number(final.homeId);
  state.championId = championId;
  state.runnerUpId = runnerUpId;
  state.status = 'completed';
  if(typeof recordCompetitionChampion === 'function') recordCompetitionChampion({ season:state.season, year:state.year, type:'international_cup', competitionId:CHAMPIONS_LEAGUE_CONFIG.id, competitionName:CHAMPIONS_LEAGUE_CONFIG.name, championId, runnerUpId });
  if(Number(game.selectedClubId || 0) === championId && typeof recordManagerOfficialTitleForState === 'function'){
    recordManagerOfficialTitleForState(game, { season:state.season, year:state.year, type:'international_cup', competitionId:CHAMPIONS_LEAGUE_CONFIG.id, competitionName:CHAMPIONS_LEAGUE_CONFIG.name, clubId:championId, clubName:clubName(championId) });
  }
  if(typeof pushGameMessage === 'function') pushGameMessage({ id:`championsLeague-${state.season}-champion`, type:'deportivo', priority:'high', title:`Campeón de ${CHAMPIONS_LEAGUE_CONFIG.name}`, body:`${clubName(championId)} ganó la ${CHAMPIONS_LEAGUE_CONFIG.name}.` });
  archiveChampionsLeagueEditionForState(game, { allowIncomplete:false });
  return true;
}
function advanceChampionsLeagueIfNeeded(){
  const state = championsLeagueState();
  if(!state || !state.drawn || ['pending_draw','skipped','completed'].includes(state.status)) return false;
  championsLeagueSyncAllAggregates();
  if(state.status === 'groups' && championsLeagueStageComplete('groups')) return championsLeagueCreateRoundOf32();
  if(state.status === 'r32' && championsLeagueStageComplete('r32')) return championsLeagueCreateNextKnockoutStage('r32','r16');
  if(state.status === 'r16' && championsLeagueStageComplete('r16')) return championsLeagueCreateNextKnockoutStage('r16','qf');
  if(state.status === 'qf' && championsLeagueStageComplete('qf')) return championsLeagueCreateNextKnockoutStage('qf','sf');
  if(state.status === 'sf' && championsLeagueStageComplete('sf')) return championsLeagueCreateFinal();
  if(state.status === 'final' && championsLeagueStageComplete('final')) return championsLeagueCompleteEdition();
  return false;
}
function processChampionsLeagueDaily(options={}){
  if(!CHAMPIONS_LEAGUE_CONFIG.enabled || !game || game.seasonFinalized) return { drawn:false, advanced:false, skipped:false };
  const state = championsLeagueState();
  championsLeagueSyncAllAggregates();
  const current = validIsoDate(game.currentDate) ? game.currentDate : dateForSeasonState(game);
  const day = seasonDayFromDate(current, currentSeasonYear());
  let drawn = false;
  let skipped = false;
  if(!state.drawn && state.status === 'pending_draw'){
    const drawDay = Number(state.calendar.drawSeasonDay || 0);
    const firstGroupDay = Number(state.calendar.groupSeasonDays?.[0] || 0);
    if(drawDay && day >= drawDay && (!firstGroupDay || day <= firstGroupDay)) drawn = championsLeagueDrawEdition({ silent:Boolean(options.silent) });
    else if(firstGroupDay && day > firstGroupDay){
      state.status = 'skipped';
      state.skippedReason = 'La versión se activó después de la primera fecha de grupos. La competencia comenzará la próxima temporada.';
      skipped = true;
    }
  }
  const advanced = advanceChampionsLeagueIfNeeded();
  return { drawn, advanced, skipped };
}
function championsLeagueSnapshotForState(targetState=game){
  const state = targetState?.championsLeague;
  if(!targetState || !state?.drawn) return null;
  const groups = (state.groups || []).map(group => ({
    id:group.id,
    clubIds:[...(group.clubIds || [])],
    standings:championsLeagueGroupStandings(group.id, targetState),
    matches:championsLeagueGroupMatches(group.id, targetState).map(match => ({ ...match }))
  }));
  const stages = {};
  ['r32','r16','qf','sf','final'].forEach(stage => { stages[stage] = championsLeagueStageMatches(stage, targetState).map(match => ({ ...match })); });
  return {
    version:CHAMPIONS_LEAGUE_VERSION,
    season:Number(state.season || targetState.seasonNumber || 1),
    year:Number(state.year || targetState.seasonYear || currentSeasonYear()),
    name:CHAMPIONS_LEAGUE_CONFIG.name,
    status:String(state.status || ''),
    participantClubIds:[...(state.participantClubIds || [])],
    qualificationSources:(state.qualificationSources || []).map(source => ({ ...source })),
    pots:(state.pots || []).map(pot => [...pot]),
    calendar:normalizeChampionsLeagueCalendar(state.calendar || {}, state.year),
    groups,
    stages,
    championId:Number(state.championId || 0),
    runnerUpId:Number(state.runnerUpId || 0),
    archivedAt:new Date().toISOString()
  };
}
function archiveChampionsLeagueEditionForState(targetState=game, options={}){
  if(!targetState?.championsLeague?.drawn) return false;
  if(options.allowIncomplete !== true && targetState.championsLeague.status !== 'completed') return false;
  const snapshot = championsLeagueSnapshotForState(targetState);
  if(!snapshot) return false;
  targetState.championsLeagueHistory = normalizeChampionsLeagueHistoryState(targetState.championsLeagueHistory || {});
  const key = `${snapshot.season}-${snapshot.year}`;
  targetState.championsLeagueHistory.editions = (targetState.championsLeagueHistory.editions || []).filter(item => `${item.season}-${item.year}` !== key);
  targetState.championsLeagueHistory.editions.push(snapshot);
  targetState.championsLeagueHistory = normalizeChampionsLeagueHistoryState(targetState.championsLeagueHistory);
  return true;
}
function syncChampionsLeagueHistoryForState(targetState=game){
  if(!targetState) return false;
  const before = JSON.stringify(targetState.championsLeagueHistory || {});
  targetState.championsLeagueHistory = normalizeChampionsLeagueHistoryState(targetState.championsLeagueHistory || {});
  if(targetState.championsLeague?.status === 'completed') archiveChampionsLeagueEditionForState(targetState, { allowIncomplete:false });
  return JSON.stringify(targetState.championsLeagueHistory || {}) !== before;
}
function championsLeagueHistoryEntries(){
  if(!game) return [];
  syncChampionsLeagueHistoryForState(game);
  return (game.championsLeagueHistory?.editions || []).slice().sort((a,b)=>Number(b.year)-Number(a.year) || Number(b.season)-Number(a.season));
}
function championsLeagueCurrentEditionForDisplay(){
  const state = championsLeagueState();
  if(!state?.drawn) return null;
  return championsLeagueSnapshotForState(game);
}
function championsLeagueSelectedEdition(){
  if(selectedChampionsLeagueYear === 'current') return { edition:championsLeagueCurrentEditionForDisplay(), current:true };
  const match = String(selectedChampionsLeagueYear || '').match(/^history-(\d+)-(\d+)$/);
  if(!match) return { edition:championsLeagueCurrentEditionForDisplay(), current:true };
  const edition = championsLeagueHistoryEntries().find(item => Number(item.season) === Number(match[1]) && Number(item.year) === Number(match[2])) || null;
  return edition ? { edition, current:false } : { edition:championsLeagueCurrentEditionForDisplay(), current:true };
}
function championsLeagueYearFilterMarkup(){
  const currentYear = Number(game?.seasonYear || currentSeasonYear());
  const options = [`<option value="current" ${selectedChampionsLeagueYear === 'current' ? 'selected' : ''}>${currentYear} · actual</option>`];
  championsLeagueHistoryEntries().forEach(item => {
    const key = `history-${item.season}-${item.year}`;
    options.push(`<option value="${key}" ${selectedChampionsLeagueYear === key ? 'selected' : ''}>${item.year} · Temp. ${item.season}</option>`);
  });
  return `<div class="division-filter"><label for="championsLeagueYearFilter">Año</label><select id="championsLeagueYearFilter">${options.join('')}</select></div>`;
}
function championsLeagueScore(match){
  if(!match?.played) return 'vs';
  return `${Number(match.homeGoals || 0)}-${Number(match.awayGoals || 0)}`;
}
function championsLeaguePenaltyText(match){
  return match?.played && match?.penaltyShootout ? ` · pen. ${Number(match.penaltyShootout.home || 0)}-${Number(match.penaltyShootout.away || 0)}` : '';
}
function championsLeagueMatchRow(match, interactive=false){
  const clickable = interactive && match?.played;
  return `<div class="cwc-group-result ${clickable ? 'clickable' : ''}" ${clickable ? `data-match-id="${escapeHtml(match.id)}"` : ''}>
    <span>${clubBadge(match.homeId)} ${escapeHtml(clubName(match.homeId))}</span>
    <strong>${escapeHtml(championsLeagueScore(match))}<small>${escapeHtml(championsLeaguePenaltyText(match))}</small></strong>
    <span>${escapeHtml(clubName(match.awayId))} ${clubBadge(match.awayId)}</span>
  </div>`;
}
function championsLeagueGroupMarkup(group, edition, interactive=false){
  const standings = Array.isArray(group?.standings) ? group.standings : (edition === championsLeagueCurrentEditionForDisplay() ? championsLeagueGroupStandings(group.id) : []);
  const matches = Array.isArray(group?.matches) ? group.matches : [];
  const rows = standings.map(row => `<tr><td>${row.position}</td><td>${clubLink(row.clubId)}</td><td>${row.pj}</td><td>${row.pg}</td><td>${row.pe}</td><td>${row.pp}</td><td>${row.gf}</td><td>${row.gc}</td><td>${row.dg}</td><td><strong>${row.pts}</strong></td></tr>`).join('');
  return `<div class="card cwc-group-card"><div class="row"><h3>Grupo ${escapeHtml(group.id)}</h3><span class="pill">Todos avanzan</span></div>
    <div class="table-wrap"><table><thead><tr><th>#</th><th>Club</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>Pts</th></tr></thead><tbody>${rows}</tbody></table></div>
    <details><summary>Partidos y resultados</summary><div class="cwc-group-result-list">${matches.map(match => championsLeagueMatchRow(match, interactive)).join('')}</div></details>
  </div>`;
}
function championsLeagueTieMarkup(matches=[], interactive=false){
  const ordered = matches.slice().sort((a,b)=>Number(a.leg || 0)-Number(b.leg || 0));
  const first = ordered[0], second = ordered[1];
  const aggregate = first?.played && second?.played ? `${clubName(second.homeId)} ${Number(first.awayGoals || 0)+Number(second.homeGoals || 0)}-${Number(first.homeGoals || 0)+Number(second.awayGoals || 0)} ${clubName(second.awayId)}` : 'Global pendiente';
  return `<div class="card inner championsLeague-tie"><p class="label">${escapeHtml(aggregate)}</p>${ordered.map(match => `<p class="muted small">${Number(match.leg) === 1 ? 'Ida' : 'Vuelta'} · ${escapeHtml(matchDateLabel(match.date))}</p>${championsLeagueMatchRow(match, interactive)}`).join('')}</div>`;
}
function championsLeagueEditionMarkup(edition, options={}){
  if(!edition){
    const state = championsLeagueState();
    return `<div class="card"><h2>${CHAMPIONS_LEAGUE_CONFIG.name}</h2><p class="muted">La edición de Champions League todavía no fue sorteada.</p><p class="small muted">Sorteo previsto: ${state?.calendar?.drawDate ? matchDateLabel(state.calendar.drawDate) : 'sin fecha'}.${state?.skippedReason ? ` ${escapeHtml(state.skippedReason)}` : ''}</p></div>`;
  }
  const groups = (edition.groups || []).map(group => championsLeagueGroupMarkup(group, edition, Boolean(options.interactive))).join('');
  const stageBlocks = ['r32','r16','qf','sf'].map(stage => {
    const matches = Array.isArray(edition.stages?.[stage]) ? edition.stages[stage] : [];
    const tieIds = [...new Set(matches.map(match => String(match.championsLeagueTieId || '')).filter(Boolean))];
    return `<section class="championsLeague-stage"><div class="row"><h3>${CHAMPIONS_LEAGUE_STAGE_LABELS[stage]}</h3><span class="pill">Ida y vuelta</span></div><div class="grid cols-2">${tieIds.length ? tieIds.map(id => championsLeagueTieMarkup(matches.filter(match => String(match.championsLeagueTieId) === id), Boolean(options.interactive))).join('') : '<div class="card inner"><p class="muted">Pendiente.</p></div>'}</div></section>`;
  }).join('');
  const finalMatches = Array.isArray(edition.stages?.final) ? edition.stages.final : [];
  const finalBlock = `<section class="championsLeague-stage"><div class="row"><h3>Final</h3><span class="pill">Partido único · sede neutral</span></div>${finalMatches.length ? finalMatches.map(match => `<div class="card inner"><p class="muted small">${escapeHtml(matchDateLabel(match.date))} · ${escapeHtml(match.stadiumName || 'Estadio neutral')} · ${formatPlainNumber(match.stadiumCapacity || 0)} lugares</p>${championsLeagueMatchRow(match, Boolean(options.interactive))}</div>`).join('') : '<div class="card inner"><p class="muted">Pendiente.</p></div>'}</section>`;
  const calendar = edition.calendar || {};
  const dates = [...(calendar.groupDates || []),...(calendar.stages?.r32 || []),...(calendar.stages?.r16 || []),...(calendar.stages?.qf || []),...(calendar.stages?.sf || []),calendar.stages?.final].filter(validIsoDate);
  const champion = Number(edition.championId || 0);
  const qualificationRows = (edition.qualificationSources || []).reduce((groups, item) => {
    const country = String(item?.country || championsLeagueClubCountry(item?.clubId) || 'Otros');
    if(!groups[country]) groups[country] = [];
    groups[country].push(item);
    return groups;
  }, {});
  const qualificationMarkup = Object.keys(qualificationRows).length ? `<div class="card"><details><summary>Clubes clasificados y vía de acceso</summary><div class="grid cols-3 championsLeague-qualifiers">${Object.entries(qualificationRows).map(([country,items]) => `<div class="card inner"><h4>${escapeHtml(country)}</h4>${items.map(item => `<p class="small"><strong>${clubLink(item.clubId)}</strong><br><span class="muted">${escapeHtml(item.source || 'Clasificado')}</span></p>`).join('')}</div>`).join('')}</div></details></div>` : '';
  return `<div class="stack championsLeague-view">
    <div class="grid cols-3"><div class="card inner"><p class="label">Participantes</p><h3>32 clubes</h3><p class="muted small">8 Inglaterra · 6 Italia · 6 España · 2 Rumania · 10 bolsa</p></div><div class="card inner"><p class="label">Formato</p><h3>8 grupos de 4</h3><p class="muted small">6 partidos por club · todos avanzan a 16avos</p></div><div class="card inner"><p class="label">Calendario</p><h3>${dates.length} miércoles</h3><p class="muted small">Sin copas nacionales ni descanso de mitad de temporada</p></div></div>
    ${champion ? `<div class="card champion-card"><p class="label">Campeón ${edition.year}</p><h2>${clubBadge(champion)} ${escapeHtml(clubName(champion))}</h2><p class="muted">Subcampeón: ${escapeHtml(clubName(edition.runnerUpId))}</p></div>` : ''}
    <div class="card"><h3>Calendario de la edición</h3><p class="muted small">Sorteo: ${calendar.drawDate ? escapeHtml(matchDateLabel(calendar.drawDate)) : '—'} · Grupos: ${(calendar.groupDates || []).map(matchDateLabel).map(escapeHtml).join(' · ')}.</p><p class="muted small">16avos: ${(calendar.stages?.r32 || []).map(matchDateLabel).map(escapeHtml).join(' / ')} · 8vos: ${(calendar.stages?.r16 || []).map(matchDateLabel).map(escapeHtml).join(' / ')} · 4tos: ${(calendar.stages?.qf || []).map(matchDateLabel).map(escapeHtml).join(' / ')} · Semifinales: ${(calendar.stages?.sf || []).map(matchDateLabel).map(escapeHtml).join(' / ')} · Final: ${calendar.stages?.final ? escapeHtml(matchDateLabel(calendar.stages.final)) : '—'}.</p></div>
    ${qualificationMarkup}
    <div class="grid cols-2 championsLeague-groups">${groups}</div>
    ${stageBlocks}${finalBlock}
  </div>`;
}
function championsLeagueCompetitionMarkup(){
  const selected = championsLeagueSelectedEdition();
  return `<div class="row section-title"><div><h2>${CHAMPIONS_LEAGUE_CONFIG.name}</h2><p class="tagline">Fase de grupos ida y vuelta, cuatro eliminatorias a dos partidos y final neutral.</p></div><div class="row">${championsLeagueYearFilterMarkup()}${typeof competitionsNavMarkup === 'function' ? competitionsNavMarkup('championsLeague') : ''}</div></div>${championsLeagueEditionMarkup(selected.edition, { interactive:selected.current })}`;
}
function bindChampionsLeagueCompetition(){
  $('championsLeagueYearFilter')?.addEventListener('change', event => { selectedChampionsLeagueYear = event.target.value; if(typeof renderStandings === 'function') renderStandings(); });
  document.querySelectorAll('[data-match-id]').forEach(element => element.addEventListener('click', () => showMatchModal(element.dataset.matchId)));
}
