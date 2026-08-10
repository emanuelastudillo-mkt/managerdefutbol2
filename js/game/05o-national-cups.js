/* V9.07 · Copas nacionales: los avisos de sorteos y cruces se limitan al país del club dirigido. */

const NATIONAL_CUP_VERSION = 4;
const NATIONAL_CUP_VERIFIER_VERSION = 2;
const NATIONAL_CUP_COUNTRIES = ['Argentina','Chile','España','Rumania','Inglaterra','Brasil','Italia'];
const NATIONAL_CUP_CONFIGS = [
  {
    id:'copa-argentina', name:'Copa Argentina', country:'Argentina', drawDay:20,
    directSeeds:10,
    stages:[
      { id:'preliminary', label:'Fase previa', month:3, matches:22, ticketPrice:200 },
      { id:'r32', label:'16avos', month:5, matches:16, ticketPrice:250 },
      { id:'r16', label:'8vos', month:6, matches:8, ticketPrice:300 },
      { id:'qf', label:'4tos', month:8, matches:4, ticketPrice:350 },
      { id:'sf', label:'Semifinal', month:9, matches:2, ticketPrice:500 },
      { id:'final', label:'Final', month:10, matches:1, ticketPrice:1000 }
    ]
  },
  ...[
    ['copa-chile','Copa Chile','Chile',21],
    ['copa-del-rey','Copa del Rey','España',22],
    ['copa-rumana','Copa Rumana','Rumania',23],
    ['fa-cup','FA Cup','Inglaterra',24],
    ['copa-brasil','Copa Brasil','Brasil',25],
    ['copa-italia','Copa Italia','Italia',26]
  ].map(([id,name,country,drawDay]) => ({
    id,name,country,drawDay,directSeeds:14,
    stages:[
      { id:'preliminary', label:'Fase previa', month:5, matches:2, ticketPrice:200 },
      { id:'r16', label:'8vos', month:6, matches:8, ticketPrice:300 },
      { id:'qf', label:'4tos', month:8, matches:4, ticketPrice:350 },
      { id:'sf', label:'Semifinal', month:9, matches:2, ticketPrice:500 },
      { id:'final', label:'Final', month:10, matches:1, ticketPrice:1000 }
    ]
  }))
];

function nationalCupCountryKey(value){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}
function nationalCupConfig(id){ return NATIONAL_CUP_CONFIGS.find(item => item.id === String(id || '')) || null; }
function nationalCupConfigForCountry(country){
  const key = nationalCupCountryKey(country);
  return NATIONAL_CUP_CONFIGS.find(item => nationalCupCountryKey(item.country) === key) || null;
}
function nationalCupManagedCountryKey(){
  const selectedClubId = Number(game?.selectedClubId || 0);
  if(!selectedClubId) return '';
  const selectedClub = (seed?.clubs || []).find(club => Number(club?.id || 0) === selectedClubId);
  const country = selectedClub
    ? (typeof clubCountry === 'function' ? clubCountry(selectedClub) : (selectedClub.country || selectedClub.pais || game?.selectedCountry || ''))
    : (game?.selectedCountry || '');
  return nationalCupCountryKey(country);
}
function nationalCupShouldNotifyManager(country){
  const managedCountry = nationalCupManagedCountryKey();
  return Boolean(managedCountry && managedCountry === nationalCupCountryKey(country));
}
function nationalCupFirstWednesday(year, month){
  const date = new Date(Date.UTC(Number(year), Math.max(0, Number(month) - 1), 1));
  const offset = (3 - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + offset);
  return isoDateFromUtc(date);
}
function nationalCupStageDate(config, stageId, year=currentSeasonYear()){
  const stage = config?.stages?.find(item => item.id === String(stageId || ''));
  return stage ? nationalCupFirstWednesday(year, stage.month) : '';
}
function nationalCupStageSeasonDay(config, stageId, year=currentSeasonYear()){
  const date = nationalCupStageDate(config, stageId, year);
  return validIsoDate(date) ? seasonDayFromDate(date, year) : 0;
}
function nationalCupSupercupDate(year=currentSeasonYear()){
  return addDaysToIsoDate(seasonStartDateForYear(year), 299);
}
function nationalCupDeterministicSort(ids, token){
  return (ids || []).map(Number).filter(Boolean).slice().sort((a,b) => {
    const ah = hashNumber(`${token}-${a}`, 1000000000);
    const bh = hashNumber(`${token}-${b}`, 1000000000);
    return ah - bh || a - b;
  });
}
function normalizeNationalCupVerification(raw){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const checkpoints = src.checkpoints && typeof src.checkpoints === 'object' && !Array.isArray(src.checkpoints) ? src.checkpoints : {};
  const clean = {};
  Object.entries(checkpoints).slice(-24).forEach(([key,value]) => {
    if(!value || typeof value !== 'object' || Array.isArray(value)) return;
    clean[String(key)] = {
      phase:String(value.phase || key),
      status:String(value.status || 'pending'),
      signature:String(value.signature || ''),
      checkedDate:String(value.checkedDate || ''),
      checkedDay:Math.max(0, Math.round(Number(value.checkedDay || 0))),
      expected:Math.max(0, Math.round(Number(value.expected || 0))),
      actual:Math.max(0, Math.round(Number(value.actual || 0))),
      repaired:Boolean(value.repaired),
      note:String(value.note || '')
    };
  });
  return {
    version:NATIONAL_CUP_VERIFIER_VERSION,
    phase:String(src.phase || ''),
    lastCheckedDate:String(src.lastCheckedDate || ''),
    lastCheckedDay:Math.max(0, Math.round(Number(src.lastCheckedDay || 0))),
    checkpoints:clean,
    repairs:Math.max(0, Math.round(Number(src.repairs || 0)))
  };
}
function nationalCupVerificationState(edition){
  if(!edition) return normalizeNationalCupVerification({});
  edition.verification = normalizeNationalCupVerification(edition.verification);
  return edition.verification;
}
function nationalCupWednesdayOnOrAfter(iso){
  if(!validIsoDate(iso)) return '';
  const date = new Date(`${iso}T00:00:00Z`);
  const offset = (3 - date.getUTCDay() + 7) % 7;
  date.setUTCDate(date.getUTCDate() + offset);
  return isoDateFromUtc(date);
}
function nationalCupMaxDate(left, right){
  if(!validIsoDate(left)) return validIsoDate(right) ? right : '';
  if(!validIsoDate(right)) return left;
  return left >= right ? left : right;
}
function nationalCupPrepareRecoveryDates(config, edition, startStageId, minimumDate){
  const startIndex = Math.max(0, config.stages.findIndex(stage => stage.id === String(startStageId || '')));
  let previous = '';
  config.stages.forEach((stage,index) => {
    const state = edition.stages?.[stage.id];
    if(!state) return;
    if(index < startIndex){
      previous = validIsoDate(state.date) ? state.date : nationalCupStageDate(config, stage.id, edition.year);
      return;
    }
    const planned = validIsoDate(state.date) ? state.date : nationalCupStageDate(config, stage.id, edition.year);
    let floor = index === startIndex
      ? nationalCupWednesdayOnOrAfter(minimumDate)
      : nationalCupWednesdayOnOrAfter(addDaysToIsoDate(previous, 14));
    const chosen = nationalCupMaxDate(planned, floor);
    state.date = chosen;
    state.seasonDay = validIsoDate(chosen) ? seasonDayFromDate(chosen, edition.year) : 0;
    previous = chosen;
  });
}
function normalizeNationalCupEdition(raw, config, season, year){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const stages = {};
  (config?.stages || []).forEach(stage => {
    const old = src.stages?.[stage.id] || {};
    stages[stage.id] = {
      id:stage.id,
      label:stage.label,
      date:validIsoDate(old.date) ? old.date : nationalCupStageDate(config, stage.id, year),
      seasonDay:Math.max(0, Math.round(Number(old.seasonDay || nationalCupStageSeasonDay(config, stage.id, year)))),
      status:String(old.status || 'pending'),
      roundId:String(old.roundId || ''),
      matchIds:Array.isArray(old.matchIds) ? old.matchIds.map(String) : []
    };
  });
  return {
    version:NATIONAL_CUP_VERSION,
    id:config.id,
    name:config.name,
    country:config.country,
    season,
    year,
    drawDay:config.drawDay,
    drawn:Boolean(src.drawn),
    status:String(src.status || 'pending_draw'),
    createdAt:Number(src.createdAt || 0),
    participantClubIds:Array.isArray(src.participantClubIds) ? src.participantClubIds.map(Number).filter(Boolean) : [],
    directSeedClubIds:Array.isArray(src.directSeedClubIds) ? src.directSeedClubIds.map(Number).filter(Boolean) : [],
    preliminaryClubIds:Array.isArray(src.preliminaryClubIds) ? src.preliminaryClubIds.map(Number).filter(Boolean) : [],
    championId:Number(src.championId || 0),
    runnerUpId:Number(src.runnerUpId || 0),
    stages,
    skippedReason:String(src.skippedReason || ''),
    verification:normalizeNationalCupVerification(src.verification)
  };
}
function normalizeNationalSupercup(raw, country, season, year){
  const src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  return {
    version:NATIONAL_CUP_VERSION,
    id:`supercopa-${nationalCupCountryKey(country).replace(/\s+/g,'-')}`,
    name:`Supercopa ${country}`,
    country,
    season,
    year,
    date:validIsoDate(src.date) ? src.date : nationalCupSupercupDate(year),
    seasonDay:300,
    status:String(src.status || 'pending'),
    matchId:String(src.matchId || ''),
    leagueChampionId:Number(src.leagueChampionId || 0),
    cupChampionId:Number(src.cupChampionId || 0),
    participantClubIds:Array.isArray(src.participantClubIds) ? src.participantClubIds.map(Number).filter(Boolean) : [],
    championId:Number(src.championId || 0),
    runnerUpId:Number(src.runnerUpId || 0)
  };
}
function normalizeNationalCupsState(src, season=game?.seasonNumber || 1, year=game?.seasonYear || currentSeasonYear()){
  const raw = src && typeof src === 'object' && !Array.isArray(src) ? src : {};
  const editions = {};
  NATIONAL_CUP_CONFIGS.forEach(config => { editions[config.id] = normalizeNationalCupEdition(raw.editions?.[config.id], config, season, year); });
  const supercups = {};
  NATIONAL_CUP_COUNTRIES.forEach(country => { supercups[nationalCupCountryKey(country)] = normalizeNationalSupercup(raw.supercups?.[nationalCupCountryKey(country)], country, season, year); });
  return {
    version:NATIONAL_CUP_VERSION,
    season,
    year,
    editions,
    supercups,
    history:Array.isArray(raw.history) ? raw.history.slice(-120) : [],
    migrationNoticeShown:Boolean(raw.migrationNoticeShown)
  };
}
function ensureNationalCupsState(target=game){
  if(!target) return null;
  const season = Math.max(1, Math.round(Number(target.seasonNumber || 1)));
  const year = Math.round(Number(target.seasonYear || seasonYearForNumber(season)));
  const same = Number(target.nationalCups?.season || 0) === season && Number(target.nationalCups?.year || 0) === year;
  target.nationalCups = normalizeNationalCupsState(same ? target.nationalCups : {}, season, year);
  return target.nationalCups;
}
function nationalCupCountryClubs(country){
  const key = nationalCupCountryKey(country);
  return (seed?.clubs || []).filter(club => nationalCupCountryKey(club.country || club.pais) === key && !club.specialCompetitionOnly && !club.competitionOnly);
}
function nationalCupPreviousSeasonRows(country){
  const season = Math.max(1, Number(game?.seasonNumber || 1) - 1);
  const entry = (game?.standingsHistory?.seasons || []).find(item => Number(item.season || 0) === season);
  if(!entry) return [];
  const divisions = (seed?.divisions || []).filter(division => nationalCupCountryKey(division.country || division.pais) === nationalCupCountryKey(country));
  const rows = [];
  divisions.forEach(division => {
    const list = Array.isArray(entry.divisions?.[division.id]) ? entry.divisions[division.id] : [];
    list.forEach(row => rows.push({ ...row, divisionId:division.id, divisionOrder:Number(division.order || 1) }));
  });
  return rows;
}
function nationalCupRankedClubIds(config){
  const clubs = nationalCupCountryClubs(config.country);
  const byId = new Map(clubs.map(club => [Number(club.id), club]));
  const previous = nationalCupPreviousSeasonRows(config.country).filter(row => byId.has(Number(row.clubId)));
  if(previous.length){
    if(config.country === 'Argentina'){
      return previous.slice().sort((a,b)=>Number(a.divisionOrder || 9)-Number(b.divisionOrder || 9) || Number(a.position || 999)-Number(b.position || 999) || clubPrestigeValue(b.clubId)-clubPrestigeValue(a.clubId)).map(row => Number(row.clubId));
    }
    return previous.slice().sort((a,b)=>Number(a.position || 999)-Number(b.position || 999) || clubPrestigeValue(b.clubId)-clubPrestigeValue(a.clubId)).map(row => Number(row.clubId));
  }
  return clubs.slice().sort((a,b)=>Number(b.reputation || 0)-Number(a.reputation || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' })).map(club => Number(club.id));
}
function nationalCupExpectedParticipantCount(config){
  return nationalCupCountryKey(config?.country) === nationalCupCountryKey('Argentina') ? 54 : 18;
}
function nationalCupUniqueClubIds(ids=[]){
  return [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Boolean))];
}
function nationalCupParticipantAllocationValid(config, edition){
  if(!config || !edition) return false;
  const expected = nationalCupExpectedParticipantCount(config);
  const validClubIds = new Set(nationalCupCountryClubs(config.country).map(club => Number(club.id)).filter(Boolean));
  const participants = nationalCupUniqueClubIds(edition.participantClubIds);
  const direct = nationalCupUniqueClubIds(edition.directSeedClubIds);
  const preliminary = nationalCupUniqueClubIds(edition.preliminaryClubIds);
  if(participants.length !== expected || direct.length !== Number(config.directSeeds || 0) || preliminary.length !== expected - Number(config.directSeeds || 0)) return false;
  if([...participants, ...direct, ...preliminary].some(id => !validClubIds.has(id))) return false;
  const participantSet = new Set(participants);
  if(direct.some(id => !participantSet.has(id)) || preliminary.some(id => !participantSet.has(id))) return false;
  if(new Set([...direct, ...preliminary]).size !== expected) return false;
  return true;
}
function nationalCupRepairParticipantAllocation(config, edition, options={}){
  if(!config || !edition) return { repaired:false, expected:0, actual:0, reason:'Sin edición' };
  const expected = nationalCupExpectedParticipantCount(config);
  const ranked = nationalCupUniqueClubIds(nationalCupRankedClubIds(config));
  if(ranked.length < expected) return { repaired:false, expected, actual:ranked.length, reason:`Participantes insuficientes: ${ranked.length}/${expected}` };
  if(nationalCupParticipantAllocationValid(config, edition)) return { repaired:false, expected, actual:expected, reason:'Participantes confirmados' };
  const hasAllocationData = ['participantClubIds','directSeedClubIds','preliminaryClubIds'].some(key => Array.isArray(edition?.[key]) && edition[key].length > 0);
  const hasScheduledStage = (config.stages || []).some(stage => ['scheduled','completed'].includes(String(edition?.stages?.[stage.id]?.status || '')));
  const recoverableState = Boolean(edition.drawn || hasAllocationData || hasScheduledStage || ['skipped'].includes(String(edition.status || '')) || (config.stages || []).some(stage => stage.id === String(edition.status || '')));
  if(!recoverableState || (options.allowCreate === false && !edition.drawn)) return { repaired:false, expected, actual:0, reason:'Sorteo todavía no habilitado' };
  const participants = ranked.slice(0, expected);
  edition.participantClubIds = participants;
  edition.directSeedClubIds = participants.slice(0, Number(config.directSeeds || 0));
  edition.preliminaryClubIds = participants.slice(Number(config.directSeeds || 0));
  edition.drawn = true;
  edition.createdAt = Number(edition.createdAt || Date.now());
  edition.skippedReason = '';
  const validStatuses = new Set((config.stages || []).map(stage => stage.id).concat(['completed']));
  if(!validStatuses.has(String(edition.status || '')) || ['pending_draw','skipped'].includes(String(edition.status || ''))){
    edition.status = config.stages?.[0]?.id || 'preliminary';
  }
  return { repaired:true, expected, actual:participants.length, reason:'Participantes y accesos reconstruidos' };
}
function nationalCupFixtureDate(round){
  const dates = (round?.matches || []).map(match => validIsoDate(match?.date) ? match.date : '').filter(Boolean);
  if(dates.length) return dates.sort()[0];
  return validIsoDate(round?.date) ? round.date : '9999-12-31';
}
function sortFixturesAfterNationalCupChange(){
  if(!game?.fixtures) return;
  game.fixtures.sort((a,b) => {
    const ad = nationalCupFixtureDate(a);
    const bd = nationalCupFixtureDate(b);
    return daysBetweenIsoDates(ad, bd) || Number(a.matchday || 0)-Number(b.matchday || 0);
  });
  game.fixtures.forEach((round,index) => {
    round.matchday = index + 1;
    (round.matches || []).forEach(match => { match.matchday = index + 1; });
  });
  if(typeof repairFixtureCursorForState === 'function') repairFixtureCursorForState(game, { reason:'national_cup_calendar_sort' });
  else{
    const firstIncomplete = game.fixtures.findIndex(round => (round.matches || []).some(match => !match.played));
    game.matchdayIndex = firstIncomplete >= 0 ? firstIncomplete : game.fixtures.length;
  }
}
function nationalCupVenueCandidates(country, excluded=[]){
  const excludedSet = new Set((excluded || []).map(Number));
  return nationalCupCountryClubs(country).filter(club => !excludedSet.has(Number(club.id))).sort((a,b)=>Number(b.reputation || 0)-Number(a.reputation || 0) || clubStadiumCapacity(b.id)-clubStadiumCapacity(a.id));
}
function nationalCupVenueForMatch(config, homeId, awayId, index=0, largest=false){
  let candidates = largest
    ? nationalCupCountryClubs(config.country).slice().sort((a,b)=>clubStadiumCapacity(b.id)-clubStadiumCapacity(a.id) || Number(b.reputation || 0)-Number(a.reputation || 0))
    : nationalCupVenueCandidates(config.country, [homeId, awayId]);
  if(!candidates.length) candidates = nationalCupCountryClubs(config.country).slice().sort((a,b)=>clubStadiumCapacity(b.id)-clubStadiumCapacity(a.id));
  if(!largest) candidates = candidates.slice(0, Math.max(1, Math.min(8, candidates.length)));
  return candidates[Math.abs(index) % candidates.length] || null;
}
function nationalCupCreateMatch(config, stage, homeId, awayId, index, options={}){
  const season = Number(game?.seasonNumber || 1);
  const year = Number(game?.seasonYear || currentSeasonYear());
  const date = options.date || nationalCupStageDate(config, stage.id, year);
  const venue = nationalCupVenueForMatch(config, homeId, awayId, index, Boolean(options.largestVenue));
  const competitionId = String(options.competitionId || config.id);
  return {
    id:`nc-s${season}-${competitionId}-${stage.id}-${index}-${homeId}-${awayId}`,
    divisionId:competitionId,
    divisionName:String(options.competitionName || config.name),
    homeId:Number(homeId),
    awayId:Number(awayId),
    played:false,
    date,
    roundDate:date,
    seasonDay:seasonDayFromDate(date, year),
    neutral:true,
    neutralVenue:true,
    knockout:true,
    requiresWinner:true,
    tieBreakMode:'penalties',
    nationalCup:true,
    nationalCupId:config.id,
    nationalCupStage:stage.id,
    nationalCupStageLabel:stage.label,
    nationalCupCountry:config.country,
    nationalSupercup:Boolean(options.supercup),
    ticketPrice:Math.max(0, Math.round(Number(options.ticketPrice ?? stage.ticketPrice ?? 0))),
    stadiumClubId:Number(venue?.id || 0),
    stadiumName:venue ? clubStadiumName(venue.id) : 'Estadio neutral',
    stadiumCapacity:venue ? clubStadiumCapacity(venue.id) : 0,
    competitionRules:{ requiresWinner:true, tieBreakMode:'penalties', neutralVenue:true }
  };
}
function appendNationalCupRound(config, stage, pairs, options={}){
  if(!game?.fixtures || !pairs?.length) return null;
  const date = options.date || nationalCupStageDate(config, stage.id, currentSeasonYear());
  const matches = pairs.map((pair,index) => nationalCupCreateMatch(config, stage, pair[0], pair[1], index, options));
  const roundId = `national-cup-${game.seasonNumber}-${options.competitionId || config.id}-${stage.id}`;
  const round = {
    matchday:game.fixtures.length + 1,
    id:roundId,
    date,
    startDate:date,
    endDate:date,
    roundDate:date,
    seasonDay:seasonDayFromDate(date, currentSeasonYear()),
    title:`${options.competitionName || config.name} · ${stage.label}`,
    nationalCupRound:true,
    nationalCupId:config.id,
    nationalCupStage:stage.id,
    nationalSupercup:Boolean(options.supercup),
    matches
  };
  game.fixtures.push(round);
  sortFixturesAfterNationalCupChange();
  return round;
}
function nationalCupPair(ids, token){
  const shuffled = nationalCupDeterministicSort(ids, token);
  const pairs = [];
  for(let index=0; index+1<shuffled.length; index+=2) pairs.push([shuffled[index], shuffled[index+1]]);
  return pairs;
}
function nationalCupStageMatches(cupId, stageId){
  const unique = new Map();
  (game?.fixtures || []).flatMap(round => round?.matches || []).forEach(match => {
    if(!match?.nationalCup || match?.nationalSupercup || String(match.nationalCupId) !== String(cupId) || String(match.nationalCupStage) !== String(stageId)) return;
    const key = String(match.id || `${match.homeId}-${match.awayId}-${match.date || ''}`);
    const previous = unique.get(key);
    if(!previous || (!previous.played && match.played)) unique.set(key, match);
  });
  return [...unique.values()];
}
function nationalSupercupMatches(country){
  return (game?.fixtures || []).flatMap(round => round?.matches || []).filter(match => match?.nationalSupercup && nationalCupCountryKey(match.nationalCupCountry) === nationalCupCountryKey(country));
}
function nationalCupMatchWinner(match){
  if(!match?.played) return 0;
  if(Number(match.winnerClubId || 0)) return Number(match.winnerClubId);
  if(Number(match.homeGoals || 0) > Number(match.awayGoals || 0)) return Number(match.homeId || 0);
  if(Number(match.awayGoals || 0) > Number(match.homeGoals || 0)) return Number(match.awayId || 0);
  const shootout = match.penaltyShootout || {};
  return Number(shootout.home || 0) > Number(shootout.away || 0) ? Number(match.homeId || 0) : Number(match.awayId || 0);
}
function nationalCupStageComplete(cupId, stageId){
  const matches = nationalCupStageMatches(cupId, stageId);
  return matches.length > 0 && matches.every(match => match.played && nationalCupMatchWinner(match));
}
function nationalCupExpectedStageParticipants(config, edition, stageId){
  const stageIndex = config.stages.findIndex(stage => stage.id === String(stageId || ''));
  if(stageIndex < 0) return [];
  if(stageIndex === 0) return (edition.preliminaryClubIds || []).map(Number).filter(Boolean);
  const previousStage = config.stages[stageIndex - 1];
  if(!nationalCupStageComplete(config.id, previousStage.id)) return [];
  let participants = nationalCupStageMatches(config.id, previousStage.id).map(nationalCupMatchWinner).filter(Boolean);
  if(previousStage.id === 'preliminary') participants = (edition.directSeedClubIds || []).concat(participants);
  return nationalCupDeterministicSort(participants, `${config.id}-${game.seasonNumber}-${stageId}`);
}
function nationalCupExpectedStagePairs(config, edition, stage){
  const participants = nationalCupExpectedStageParticipants(config, edition, stage.id);
  return nationalCupPair(participants, `${config.id}-${game.seasonNumber}-${stage.id}-pairs`);
}
function nationalCupStageRound(config, stageId){
  return (game?.fixtures || []).find(round =>
    round?.nationalCupRound && !round?.nationalSupercup &&
    String(round.nationalCupId || '') === String(config.id) &&
    String(round.nationalCupStage || '') === String(stageId)
  ) || null;
}
function nationalCupEnsureStageFixtures(config, edition, stage, options={}){
  const stageState = edition?.stages?.[stage.id];
  if(!stageState || !game?.fixtures) return { repaired:false, expected:0, actual:0, reason:'Sin estado de fase' };
  const pairs = nationalCupExpectedStagePairs(config, edition, stage);
  const expected = Math.max(0, Math.round(Number(stage.matches || pairs.length)));
  if(pairs.length !== expected) return { repaired:false, expected, actual:nationalCupStageMatches(config.id, stage.id).length, reason:`Participantes incompletos: ${pairs.length * 2}/${expected * 2}` };
  const date = validIsoDate(stageState.date) ? stageState.date : nationalCupStageDate(config, stage.id, edition.year);
  const expectedMatches = pairs.map((pair,index) => nationalCupCreateMatch(config, stage, pair[0], pair[1], index, { date }));
  const expectedIds = expectedMatches.map(match => String(match.id));
  const expectedSet = new Set(expectedIds);
  let round = nationalCupStageRound(config, stage.id);
  let repaired = false;
  if(!round){
    round = {
      matchday:game.fixtures.length + 1,
      id:stageState.roundId || `national-cup-${game.seasonNumber}-${config.id}-${stage.id}`,
      date,
      startDate:date,
      endDate:date,
      roundDate:date,
      seasonDay:seasonDayFromDate(date, edition.year),
      title:`${config.name} · ${stage.label}`,
      nationalCupRound:true,
      nationalCupId:config.id,
      nationalCupStage:stage.id,
      matches:[]
    };
    game.fixtures.push(round);
    repaired = true;
  }
  const entriesById = new Map();
  (game.fixtures || []).forEach(containerRound => {
    (containerRound?.matches || []).forEach(match => {
      const key = String(match?.id || '');
      if(!key) return;
      if(!entriesById.has(key)) entriesById.set(key, []);
      entriesById.get(key).push({ round:containerRound, match });
    });
  });
  expectedMatches.forEach(expectedMatch => {
    const key = String(expectedMatch.id);
    const entries = entriesById.get(key) || [];
    const primary = entries.find(entry => entry.match?.played) || entries[0] || null;
    if(!primary){
      round.matches.push(expectedMatch);
      entriesById.set(key, [{ round, match:expectedMatch }]);
      repaired = true;
      return;
    }
    const existing = primary.match;
    if(!existing.played){
      ['date','roundDate','seasonDay','divisionId','divisionName','nationalCup','nationalCupId','nationalCupStage','nationalCupStageLabel','nationalCupCountry'].forEach(field => {
        if(existing[field] !== expectedMatch[field]){
          existing[field] = expectedMatch[field];
          repaired = true;
        }
      });
    }
    if(primary.round !== round && !existing.played){
      primary.round.matches = (primary.round.matches || []).filter(match => match !== existing);
      if(!(round.matches || []).some(match => String(match?.id || '') === key)) round.matches.push(existing);
      repaired = true;
    }
    entries.forEach(entry => {
      if(entry === primary || entry.match?.played) return;
      entry.round.matches = (entry.round.matches || []).filter(match => entry.match !== match);
      repaired = true;
    });
  });
  const seenExpected = new Set();
  round.matches = (round.matches || []).filter(match => {
    if(!match?.nationalCup || String(match.nationalCupId) !== String(config.id) || String(match.nationalCupStage) !== String(stage.id)) return true;
    const key = String(match.id || '');
    if(!expectedSet.has(key)) return Boolean(match.played);
    if(seenExpected.has(key) && !match.played){ repaired = true; return false; }
    seenExpected.add(key);
    return true;
  });
  round.date = date;
  round.startDate = date;
  round.endDate = date;
  round.roundDate = date;
  round.seasonDay = seasonDayFromDate(date, edition.year);
  stageState.status = nationalCupStageComplete(config.id, stage.id) ? 'completed' : 'scheduled';
  stageState.roundId = String(round.id || '');
  stageState.matchIds = expectedIds;
  sortFixturesAfterNationalCupChange();
  const actual = nationalCupStageMatches(config.id, stage.id).filter(match => expectedSet.has(String(match.id))).length;
  return { repaired, expected, actual, reason:actual === expected ? 'Fase confirmada' : `Cruces incompletos: ${actual}/${expected}` };
}

function nationalCupVerificationPhase(config, edition){
  const status = String(edition?.status || '');
  if(!edition?.drawn || (status === 'skipped' && /superado la primera ronda|activó esta copa/i.test(String(edition?.skippedReason || '')))) return 'draw';
  if(['completed','skipped'].includes(status)) return status || 'completed';
  return `stage:${status || config.stages[0]?.id || 'preliminary'}`;
}
function nationalCupVerificationSignature(config, edition, phase){
  if(phase === 'draw'){
    return [edition.drawn ? 1 : 0, edition.status, edition.participantClubIds?.length || 0, nationalCupCountryClubs(config.country).length, edition.skippedReason || ''].join('|');
  }
  if(phase.startsWith('stage:')){
    const stageId = phase.slice(6);
    const stage = config.stages.find(item => item.id === stageId);
    const state = edition.stages?.[stageId] || {};
    const matches = nationalCupStageMatches(config.id, stageId);
    const participantSignature = stageId === config.stages?.[0]?.id
      ? [edition.participantClubIds?.length || 0, edition.directSeedClubIds?.length || 0, edition.preliminaryClubIds?.length || 0, (edition.preliminaryClubIds || []).map(Number).sort((a,b)=>a-b).join(',')].join(':')
      : '';
    return [edition.status, state.status, state.date, state.matchIds?.length || 0, matches.length, matches.map(match => `${match.id}@${match.date || ''}`).sort().join(','), participantSignature].join('|');
  }
  return [edition.status, edition.championId || 0].join('|');
}
function nationalCupRecordCheckpoint(config, edition, phase, result, day){
  const verification = nationalCupVerificationState(edition);
  const signature = nationalCupVerificationSignature(config, edition, phase);
  verification.phase = phase;
  verification.lastCheckedDate = String(game?.currentDate || '');
  verification.lastCheckedDay = day;
  verification.checkpoints[phase] = {
    phase,
    status:String(result.status || 'pending'),
    signature,
    checkedDate:verification.lastCheckedDate,
    checkedDay:day,
    expected:Math.max(0, Math.round(Number(result.expected || 0))),
    actual:Math.max(0, Math.round(Number(result.actual || 0))),
    repaired:Boolean(result.repaired),
    note:String(result.note || '')
  };
  if(result.repaired) verification.repairs += 1;
  return verification.checkpoints[phase];
}
function verifyNationalCupEdition(config, options={}){
  const state = options.state || ensureNationalCupsState();
  let edition = state?.editions?.[config.id];
  if(!edition) return { ran:false, status:'missing' };
  const day = Math.max(1, Math.round(Number(seasonDayFromDate(game.currentDate || dateForSeasonState(game), currentSeasonYear()) || 1)));
  const participantRepair = nationalCupRepairParticipantAllocation(config, edition, { allowCreate:day >= Number(config.drawDay || 1) || Boolean(edition.drawn) });
  let repaired = Boolean(participantRepair.repaired);
  let phase = nationalCupVerificationPhase(config, edition);
  const verification = nationalCupVerificationState(edition);
  const signature = nationalCupVerificationSignature(config, edition, phase);
  const previous = verification.checkpoints?.[phase];
  const phaseCompleted = phase.startsWith('stage:') && nationalCupStageComplete(config.id, phase.slice(6));
  if(options.force !== true && previous?.signature === signature){
    if(previous.status === 'ok' && !phaseCompleted) return { ran:false, skipped:true, phase, status:'ok', expected:previous.expected, actual:previous.actual };
    if(previous.status === 'waiting' && day < Number(config.drawDay || 1)) return { ran:false, skipped:true, phase, status:'waiting', expected:previous.expected, actual:previous.actual };
  }
  let created = false;
  let note = '';
  let expected = 0;
  let actual = 0;
  if(phase === 'draw'){
    if(day < Number(config.drawDay || 1)){
      nationalCupRecordCheckpoint(config, edition, phase, { status:'waiting', note:`Sorteo previsto para el día ${config.drawDay}` }, day);
      return { ran:true, phase, status:'waiting' };
    }
    const firstStage = config.stages[0];
    const firstPlanned = edition.stages?.[firstStage.id]?.date || nationalCupStageDate(config, firstStage.id, edition.year);
    const missedWindow = validIsoDate(firstPlanned) && String(game.currentDate || '') > firstPlanned;
    let recoveryAction = missedWindow;
    if(edition.status === 'skipped' && /superado la primera ronda|activó esta copa/i.test(String(edition.skippedReason || ''))){
      edition.status = 'pending_draw';
      edition.skippedReason = '';
      recoveryAction = true;
    }
    if(!edition.drawn){
      if(recoveryAction){
        const recoveryStart = nationalCupWednesdayOnOrAfter(addDaysToIsoDate(game.currentDate, 3));
        nationalCupPrepareRecoveryDates(config, edition, firstStage.id, recoveryStart);
      }
      const drawnNow = nationalCupDrawEdition(config, { state, silent:recoveryAction ? true : Boolean(options.silent), verifierRecovery:recoveryAction });
      if(drawnNow){
        created = true;
        if(recoveryAction) repaired = true;
      }
    }
    phase = nationalCupVerificationPhase(config, edition);
  }
  if(phase.startsWith('stage:')){
    const stageId = phase.slice(6);
    const stage = config.stages.find(item => item.id === stageId);
    if(stage){
      const stageState = edition.stages?.[stage.id];
      const stageDate = stageState?.date || nationalCupStageDate(config, stage.id, edition.year);
      if(validIsoDate(stageDate) && String(game.currentDate || '') > stageDate && !nationalCupStageMatches(config.id, stage.id).some(match => match.played)){
        const recoveryStart = nationalCupWednesdayOnOrAfter(addDaysToIsoDate(game.currentDate, 3));
        nationalCupPrepareRecoveryDates(config, edition, stage.id, recoveryStart);
      }
      const ensured = nationalCupEnsureStageFixtures(config, edition, stage, options);
      repaired = repaired || ensured.repaired;
      expected = ensured.expected;
      actual = ensured.actual;
      note = ensured.reason;

    }
  }
  const finalPhase = nationalCupVerificationPhase(config, edition);
  if(finalPhase.startsWith('stage:')){
    const stageId = finalPhase.slice(6);
    const stage = config.stages.find(item => item.id === stageId);
    const matches = nationalCupStageMatches(config.id, stageId);
    const expectedIds = new Set((edition.stages?.[stageId]?.matchIds || []).map(String));
    expected = Math.max(0, Math.round(Number(stage?.matches || 0)));
    actual = expectedIds.size ? matches.filter(match => expectedIds.has(String(match.id))).length : matches.length;
    note = actual === expected ? 'Fase confirmada' : `Cruces incompletos: ${actual}/${expected}`;
  }
  const status = ['completed','skipped'].includes(finalPhase) || (expected > 0 && actual === expected) ? 'ok' : 'pending';
  const checkpoint = nationalCupRecordCheckpoint(config, edition, finalPhase, { status, expected, actual, repaired, note }, day);
  if(repaired && options.silent !== true && nationalCupShouldNotifyManager(config.country) && typeof pushGameMessage === 'function'){
    pushGameMessage({
      id:`national-cup-verifier-${game.seasonNumber}-${config.id}-${finalPhase}-${day}`,
      type:'federación', priority:'high', inbox:'always', title:`${config.name} · programación recuperada`,
      body:`La federación detectó que faltaba confirmar ${created ? 'el sorteo y la fase previa' : 'una fase'} y reconstruyó la programación. ${note || 'Los cruces ya figuran en el calendario.'}`
    });
  }
  return { ran:true, phase:finalPhase, status:checkpoint.status, expected, actual, repaired, created, note };
}
function verifyNationalCupCheckpoints(options={}){
  if(!game || (typeof NATIONAL_CUPS_ENABLED !== 'undefined' && !NATIONAL_CUPS_ENABLED)) return { ran:0, repaired:0, ok:0, pending:0, results:[] };
  const state = options.state || ensureNationalCupsState();
  const results = NATIONAL_CUP_CONFIGS.map(config => verifyNationalCupEdition(config, { ...options, state }));
  return {
    ran:results.filter(result => result.ran).length,
    repaired:results.filter(result => result.repaired).length,
    ok:results.filter(result => result.status === 'ok').length,
    pending:results.filter(result => result.status === 'pending' || result.status === 'waiting').length,
    results
  };
}
function nationalCupDrawEdition(config, options={}){
  const state = options.state || ensureNationalCupsState();
  const edition = state?.editions?.[config.id];
  if(!edition || edition.drawn) return false;
  const ranked = nationalCupRankedClubIds(config);
  const expected = nationalCupExpectedParticipantCount(config);
  const participants = ranked.slice(0, expected);
  if(participants.length < expected){
    edition.status = 'skipped';
    edition.skippedReason = `Participantes insuficientes: ${participants.length}/${expected}`;
    return false;
  }
  edition.participantClubIds = participants;
  edition.directSeedClubIds = participants.slice(0, config.directSeeds);
  edition.preliminaryClubIds = participants.slice(config.directSeeds);
  edition.drawn = true;
  edition.status = 'preliminary';
  edition.createdAt = Date.now();
  const preliminary = config.stages[0];
  const ensured = nationalCupEnsureStageFixtures(config, edition, preliminary, options);
  if(!ensured.actual){
    edition.drawn = false;
    edition.status = 'pending_draw';
    edition.skippedReason = ensured.reason || 'No se pudieron generar los cruces de la fase previa.';
    return false;
  }
  if(typeof pushGameMessage === 'function' && options.silent !== true && nationalCupShouldNotifyManager(config.country)){
    pushGameMessage({
      id:`national-cup-${game.seasonNumber}-${config.id}-draw`,
      type:'deportivo', priority:'normal', inbox:'always', title:`Sorteo de ${config.name}`,
      body:config.country === 'Argentina'
        ? 'Los mejores 10 equipos avanzaron directamente a 16avos. Los otros 44 disputarán la fase previa en estadios neutrales.'
        : 'Los mejores 14 equipos avanzaron directamente a 8vos. Los últimos 4 disputarán la fase previa en estadios neutrales.'
    });
  }
  return true;
}
function nationalCupCreateNextStage(config, edition){
  const activeStage = config.stages.find(stage => stage.id === edition.status) || config.stages.find(stage => edition.stages?.[stage.id]?.status === 'scheduled' && nationalCupStageComplete(config.id, stage.id));
  if(!activeStage || !nationalCupStageComplete(config.id, activeStage.id)) return false;
  edition.stages[activeStage.id].status = 'completed';
  const winners = nationalCupStageMatches(config.id, activeStage.id).map(nationalCupMatchWinner).filter(Boolean);
  const stageIndex = config.stages.findIndex(stage => stage.id === activeStage.id);
  if(stageIndex === config.stages.length - 1){
    const final = nationalCupStageMatches(config.id, 'final')[0];
    const championId = nationalCupMatchWinner(final);
    const runnerUpId = championId === Number(final?.homeId) ? Number(final?.awayId) : Number(final?.homeId);
    edition.championId = championId;
    edition.runnerUpId = runnerUpId;
    edition.status = 'completed';
    recordCompetitionChampion({
      season:game.seasonNumber,
      year:game.seasonYear,
      type:'national_cup',
      competitionId:config.id,
      competitionName:config.name,
      championId,
      runnerUpId
    });
    if(Number(game.selectedClubId || 0) === championId){
      recordManagerOfficialTitleForState(game, { season:game.seasonNumber, year:game.seasonYear, type:'national_cup', competitionId:config.id, competitionName:config.name, clubId:championId, clubName:clubName(championId) });
    }
    if(typeof pushGameMessage === 'function' && nationalCupShouldNotifyManager(config.country)) pushGameMessage({ id:`national-cup-${game.seasonNumber}-${config.id}-champion`, type:'deportivo', priority:'high', title:`Campeón de ${config.name}`, body:`${clubName(championId)} ganó la ${config.name}.` });
    return true;
  }
  const nextStage = config.stages[stageIndex + 1];
  edition.status = nextStage.id;
  const ensured = nationalCupEnsureStageFixtures(config, edition, nextStage, { silent:true });
  if(!ensured.actual){
    edition.status = activeStage.id;
    edition.stages[activeStage.id].status = 'completed';
    return false;
  }
  const nextDate = edition.stages?.[nextStage.id]?.date || nationalCupStageDate(config, nextStage.id, currentSeasonYear());
  if(typeof pushGameMessage === 'function' && nationalCupShouldNotifyManager(config.country)) pushGameMessage({ id:`national-cup-${game.seasonNumber}-${config.id}-${nextStage.id}`, type:'deportivo', priority:'normal', inbox:'always', title:`${config.name} · ${nextStage.label}`, body:`Se definieron los cruces de ${nextStage.label}. Se jugarán el ${matchDateLabel(nextDate)}.` });
  return true;
}
function advanceNationalCupsIfNeeded(){
  const state = ensureNationalCupsState();
  if(!state) return false;
  let changed = false;
  let guard = 0;
  do{
    let cycle = false;
    NATIONAL_CUP_CONFIGS.forEach(config => {
      const edition = state.editions[config.id];
      if(!edition?.drawn || ['completed','skipped'].includes(edition.status)) return;
      if(nationalCupCreateNextStage(config, edition)){ cycle = true; changed = true; }
    });
    guard += 1;
    if(!cycle) break;
  }while(guard < 8);
  return changed;
}
function nationalCupLeagueChampion(country){
  const divisions = (seed?.divisions || []).filter(division => nationalCupCountryKey(division.country || division.pais) === nationalCupCountryKey(country)).sort((a,b)=>Number(a.order || 9)-Number(b.order || 9));
  const topDivision = divisions[0];
  if(!topDivision) return { championId:0, runnerUpId:0 };
  const rows = sortedStandings(topDivision.id);
  return { championId:Number(rows[0]?.clubId || 0), runnerUpId:Number(rows[1]?.clubId || 0), divisionId:topDivision.id };
}
function createNationalSupercupIfNeeded(country){
  const state = ensureNationalCupsState();
  const config = nationalCupConfigForCountry(country);
  const edition = config ? state?.editions?.[config.id] : null;
  const supercup = state?.supercups?.[nationalCupCountryKey(country)];
  if(!config || !edition || !supercup || supercup.status !== 'pending' || !edition.championId) return false;
  const league = nationalCupLeagueChampion(country);
  if(!league.championId) return false;
  const leagueChampionId = league.championId;
  const cupChampionId = Number(edition.championId);
  const rivalId = leagueChampionId === cupChampionId ? Number(league.runnerUpId || 0) : cupChampionId;
  if(!rivalId || rivalId === leagueChampionId) return false;
  const stage = { id:'supercup', label:'Final', ticketPrice:1000 };
  const date = nationalCupSupercupDate(currentSeasonYear());
  const competitionId = supercup.id;
  const round = appendNationalCupRound(config, stage, [[leagueChampionId, rivalId]], {
    supercup:true,
    date,
    largestVenue:true,
    ticketPrice:1000,
    competitionId,
    competitionName:supercup.name
  });
  supercup.leagueChampionId = leagueChampionId;
  supercup.cupChampionId = cupChampionId;
  supercup.participantClubIds = [leagueChampionId, rivalId];
  supercup.matchId = round?.matches?.[0]?.id || '';
  supercup.status = 'scheduled';
  if(typeof pushGameMessage === 'function' && nationalCupShouldNotifyManager(country)) pushGameMessage({ id:`national-supercup-${game.seasonNumber}-${nationalCupCountryKey(country)}`, type:'deportivo', priority:'normal', inbox:'always', title:supercup.name, body:`${clubName(leagueChampionId)} y ${clubName(rivalId)} disputarán la ${supercup.name} en el estadio más grande del país.` });
  return true;
}
function advanceNationalSupercupsIfNeeded(){
  const state = ensureNationalCupsState();
  if(!state) return false;
  let changed = false;
  NATIONAL_CUP_COUNTRIES.forEach(country => {
    const supercup = state.supercups[nationalCupCountryKey(country)];
    if(!supercup) return;
    if(supercup.status === 'pending' && createNationalSupercupIfNeeded(country)) changed = true;
    if(supercup.status === 'scheduled'){
      const match = nationalSupercupMatches(country)[0];
      if(match?.played){
        const championId = nationalCupMatchWinner(match);
        const runnerUpId = championId === Number(match.homeId) ? Number(match.awayId) : Number(match.homeId);
        supercup.championId = championId;
        supercup.runnerUpId = runnerUpId;
        supercup.status = 'completed';
        recordCompetitionChampion({ season:game.seasonNumber, year:game.seasonYear, type:'national_supercup', competitionId:supercup.id, competitionName:supercup.name, championId, runnerUpId });
        if(Number(game.selectedClubId || 0) === championId){
          recordManagerOfficialTitleForState(game, { season:game.seasonNumber, year:game.seasonYear, type:'national_supercup', competitionId:supercup.id, competitionName:supercup.name, clubId:championId, clubName:clubName(championId) });
        }
        if(typeof pushGameMessage === 'function' && nationalCupShouldNotifyManager(country)) pushGameMessage({ id:`national-supercup-${game.seasonNumber}-${nationalCupCountryKey(country)}-champion`, type:'deportivo', priority:'normal', inbox:'always', title:`Campeón de ${supercup.name}`, body:`${clubName(championId)} ganó la ${supercup.name}. Es un título oficial de valor menor.` });
        changed = true;
      }
    }
  });
  return changed;
}
function processNationalCupsDaily(options={}){
  if((typeof NATIONAL_CUPS_ENABLED !== 'undefined' && !NATIONAL_CUPS_ENABLED) || !game || game.seasonFinalized) return { drawn:0, stages:0, supercups:0, skipped:0 };
  const state = ensureNationalCupsState();
  const day = Math.max(1, Math.round(Number(seasonDayFromDate(game.currentDate || dateForSeasonState(game), currentSeasonYear()) || 1)));
  const verification = verifyNationalCupCheckpoints({ state, silent:Boolean(options.silent), source:options.source || 'daily_calendar' });
  const drawn = verification.results.filter(result => result.created).length;
  const skipped = verification.results.filter(result => result.status === 'skipped').length;
  const stages = advanceNationalCupsIfNeeded() ? 1 : 0;
  const phaseVerification = stages ? verifyNationalCupCheckpoints({ state, silent:true, source:'phase_change' }) : null;
  let supercups = 0;
  if(day >= 300){
    NATIONAL_CUP_COUNTRIES.forEach(country => { if(createNationalSupercupIfNeeded(country)) supercups += 1; });
  }
  if(advanceNationalSupercupsIfNeeded()) supercups += 1;
  return { drawn, stages, supercups, skipped, verification, phaseVerification };
}
function nationalCupAttendanceAllocation(match){
  const capacity = Math.max(0, Math.round(Number(match?.stadiumCapacity || (match?.stadiumClubId ? clubStadiumCapacity(match.stadiumClubId) : 0) || 0)));
  const homeFans = Math.max(0, Math.round(Number(typeof clubFansCurrent === 'function' ? clubFansCurrent(match.homeId) : 0)));
  const awayFans = Math.max(0, Math.round(Number(typeof clubFansCurrent === 'function' ? clubFansCurrent(match.awayId) : 0)));
  const halfHome = Math.ceil(capacity / 2);
  const halfAway = capacity - halfHome;
  let homeAttendance = Math.min(homeFans, halfHome);
  let awayAttendance = Math.min(awayFans, halfAway);
  let remaining = Math.max(0, capacity - homeAttendance - awayAttendance);
  const homeExtra = Math.max(0, homeFans - homeAttendance);
  const awayExtra = Math.max(0, awayFans - awayAttendance);
  const homeTake = Math.min(remaining, homeExtra);
  homeAttendance += homeTake;
  remaining -= homeTake;
  const awayTake = Math.min(remaining, awayExtra);
  awayAttendance += awayTake;
  return { capacity, homeAttendance, awayAttendance, attendance:homeAttendance + awayAttendance };
}
function nationalCupCreditWinner(match, result){
  const fixture = match || {};
  if(fixture.nationalCupRevenuePaid || result?.nationalCupRevenuePaid) return false;
  const winnerId = Number(result?.winnerClubId || nationalCupMatchWinner(result) || 0);
  const revenue = Math.max(0, Math.round(Number(result?.ticketRevenue || 0)));
  if(!winnerId || revenue <= 0) return false;
  game.clubBudgets = game.clubBudgets || {};
  if(Number(game.selectedClubId || 0) === winnerId){
    recordBudgetChange(revenue, fixture.nationalSupercup ? `Recaudación ganada · ${fixture.divisionName}` : `Recaudación ganada · ${fixture.divisionName}`, {
      type:fixture.nationalSupercup ? 'national_supercup_revenue' : 'national_cup_revenue',
      matchId:fixture.id,
      competitionId:fixture.divisionId,
      competitionName:fixture.divisionName,
      ticketRevenue:revenue,
      ticketPrice:Number(result.ticketPrice || fixture.ticketPrice || 0),
      attendance:Number(result.attendance || 0),
      stadiumName:String(result.stadiumName || fixture.stadiumName || '')
    });
    game.clubBudgets[winnerId] = Math.round(Number(game.budget || 0));
  }else{
    game.clubBudgets[winnerId] = Math.round(Number(game.clubBudgets[winnerId] || seed?.clubs?.find(club => Number(club.id) === winnerId)?.budget || 0) + revenue);
  }
  fixture.nationalCupRevenuePaid = true;
  result.nationalCupRevenuePaid = true;
  return true;
}
function finalizeNationalCupMatchResult(match, result){
  if(!match?.nationalCup || !result) return result;
  let out = { ...result, nationalCup:true, nationalCupId:match.nationalCupId, nationalCupStage:match.nationalCupStage, nationalCupCountry:match.nationalCupCountry, nationalSupercup:Boolean(match.nationalSupercup), neutralVenue:true };
  if(typeof finalizeWinnerRequiredMatchResult === 'function') out = finalizeWinnerRequiredMatchResult({ ...match, requiresWinner:true, tieBreakMode:'penalties', neutralVenue:true }, out);
  const allocation = nationalCupAttendanceAllocation(match);
  const ticketPrice = Math.max(0, Math.round(Number(match.ticketPrice || 0)));
  const ticketRevenue = Math.max(0, allocation.attendance * ticketPrice);
  out.attendance = allocation.attendance;
  out.homeAttendance = allocation.homeAttendance;
  out.awayAttendance = allocation.awayAttendance;
  out.ticketPrice = ticketPrice;
  out.ticketRevenue = ticketRevenue;
  out.stadiumClubId = Number(match.stadiumClubId || 0);
  out.stadiumName = String(match.stadiumName || 'Estadio neutral');
  out.stadiumCapacity = allocation.capacity;
  out.matchContext = {
    ...(out.matchContext || {}),
    neutralVenue:true,
    stadiumName:out.stadiumName,
    stadiumCapacity:allocation.capacity,
    totalFans:allocation.attendance,
    attendance:allocation.attendance,
    homeAttendance:allocation.homeAttendance,
    awayAttendance:allocation.awayAttendance,
    ticketPrice,
    ticketRevenue
  };
  nationalCupCreditWinner(match, out);
  return out;
}
function nationalCupAllMatches(edition){
  if(!edition) return [];
  return (game?.fixtures || []).flatMap(round => round?.matches || []).filter(match => match?.nationalCup && String(match.nationalCupId || '') === String(edition.id || ''));
}
function nationalCupEditionMarkup(edition){
  const config = nationalCupConfig(edition?.id);
  if(!edition || !config) return '';
  const stages = config.stages.map(stage => {
    const matches = nationalCupStageMatches(config.id, stage.id);
    const played = matches.filter(match => match.played).length;
    const rows = matches.map(match => {
      const score = match.played ? `${Number(match.homeGoals || 0)}-${Number(match.awayGoals || 0)}` : 'vs';
      const pens = match.played && match.penaltyShootout ? `<span class="small muted"> (${Number(match.penaltyShootout.home || 0)}-${Number(match.penaltyShootout.away || 0)} pen.)</span>` : '';
      return `<div class="cwc-group-result ${match.played ? 'clickable' : ''}" ${match.played ? `data-match-id="${escapeHtml(match.id)}"` : ''}><span>${clubBadge(match.homeId)} ${escapeHtml(clubName(match.homeId))}</span><strong>${score}${pens}</strong><span>${escapeHtml(clubName(match.awayId))} ${clubBadge(match.awayId)}</span></div>`;
    }).join('');
    const scheduledDate = edition.stages?.[stage.id]?.date || nationalCupStageDate(config, stage.id, edition.year);
    return `<div class="card inner"><div class="row"><h3>${escapeHtml(stage.label)}</h3><span class="pill">${played}/${matches.length || stage.matches}</span></div><p class="muted small">${escapeHtml(matchDateLabel(scheduledDate))} · Entrada ${formatMoney(stage.ticketPrice)} · sede neutral</p>${rows || '<p class="muted">Cruces todavía no definidos.</p>'}</div>`;
  }).join('');
  const champion = edition.championId ? `<div class="card"><p class="label">Campeón</p><h3>${clubLink(edition.championId)}</h3></div>` : '';
  return `<div class="card"><div class="row"><div><h2>${escapeHtml(config.name)}</h2><p class="muted">${escapeHtml(config.country)} · sorteo día ${config.drawDay}</p></div><span class="pill">${escapeHtml(edition.status)}</span></div></div>${champion}<div class="grid cols-2">${stages}</div>`;
}
function nationalCupVerificationPhaseLabel(config, phase){
  if(phase === 'draw') return 'Sorteo';
  if(phase === 'completed') return 'Competición terminada';
  if(phase === 'skipped') return 'No disputada';
  if(String(phase || '').startsWith('stage:')){
    const stageId = String(phase).slice(6);
    return config.stages.find(stage => stage.id === stageId)?.label || stageId;
  }
  return 'Pendiente';
}
function nationalCupVerificationListMarkup(state){
  const rows = NATIONAL_CUP_CONFIGS.map(config => {
    const edition = state?.editions?.[config.id];
    if(!edition) return '';
    const phase = nationalCupVerificationPhase(config, edition);
    const checkpoint = edition.verification?.checkpoints?.[phase] || null;
    let tone = 'warn';
    let status = 'Pendiente';
    if(checkpoint?.status === 'ok'){
      tone = 'ok';
      status = checkpoint.repaired ? 'OK · reparado' : 'OK';
    }else if(checkpoint?.status === 'waiting'){
      status = `Pendiente · día ${config.drawDay}`;
    }else if(phase === 'completed'){
      tone = 'ok';
      status = 'OK · finalizada';
    }else if(phase === 'skipped'){
      tone = 'bad';
      status = 'No disputada';
    }
    const counts = checkpoint?.expected ? ` · ${checkpoint.actual}/${checkpoint.expected} partidos` : '';
    return `<div class="national-cup-verification-row"><span><strong>${escapeHtml(config.name)}</strong><small>${escapeHtml(nationalCupVerificationPhaseLabel(config, phase))}${escapeHtml(counts)}</small></span><b class="${tone}">${escapeHtml(status)}</b></div>`;
  }).filter(Boolean).join('');
  return `<div class="card national-cup-verification-card"><div class="row"><div><p class="label">Control por fases</p><h3>Estado de programación</h3></div><span class="pill">Solo se revisa si cambia</span></div><div class="national-cup-verification-list">${rows}</div></div>`;
}
function nationalCupsCompetitionMarkup(){
  const state = ensureNationalCupsState();
  const editions = NATIONAL_CUP_CONFIGS.map(config => state?.editions?.[config.id]).filter(Boolean);
  const cupBlocks = editions.map(nationalCupEditionMarkup).join('');
  const superRows = NATIONAL_CUP_COUNTRIES.map(country => {
    const item = state?.supercups?.[nationalCupCountryKey(country)];
    const match = nationalSupercupMatches(country)[0];
    const result = match?.played ? `${clubName(match.homeId)} ${match.homeGoals}-${match.awayGoals} ${clubName(match.awayId)}` : item?.participantClubIds?.length ? `${clubName(item.participantClubIds[0])} vs ${clubName(item.participantClubIds[1])}` : 'Pendiente';
    return `<tr><td>${escapeHtml(item?.name || `Supercopa ${country}`)}</td><td>Día 300</td><td>${escapeHtml(result)}</td><td>${item?.championId ? clubLink(item.championId) : '—'}</td></tr>`;
  }).join('');
  return `<div class="row section-title"><div><h2>Copas nacionales</h2><p class="tagline">Sorteos, llaves, estadios neutrales, recaudación y supercopas.</p></div>${typeof competitionsNavMarkup === 'function' ? competitionsNavMarkup('national-cups') : ''}</div><div class="stack">${nationalCupVerificationListMarkup(state)}${cupBlocks}<div class="card"><h3>Supercopas · día 300</h3><div class="table-wrap"><table><thead><tr><th>Competición</th><th>Fecha</th><th>Partido</th><th>Campeón</th></tr></thead><tbody>${superRows}</tbody></table></div></div></div>`;
}
