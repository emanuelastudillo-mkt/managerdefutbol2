/* Sponsors especiales con condiciones, estadio, calendario, tabla, estadísticas y finanzas visuales. */

function randomInt(min,max){
  return Math.floor(rnd(min, max + 1));
}
function createInitialSponsorState(){
  return {
    active:[],
    offers:[],
    seasonPlan:[],
    seasonPlanSeason:0,
    seasonOfferTarget:0,
    generatedOfferCount:0,
    generatedLocalOfferCount:0,
    lastOfferTurn:-1,
    expiredOffers:0
  };
}
function sponsorTodayIso(){
  if(typeof validIsoDate === 'function' && validIsoDate(game?.currentDate)) return game.currentDate;
  if(typeof dateForSeasonState === 'function'){
    const date = dateForSeasonState(game);
    if(typeof validIsoDate === 'function' && validIsoDate(date)) return date;
  }
  return '';
}
function sponsorDefaultExpiryDate(createdDate, today=sponsorTodayIso()){
  const base = (typeof validIsoDate === 'function' && validIsoDate(createdDate)) ? createdDate : today;
  if(typeof validIsoDate !== 'function' || !validIsoDate(base) || typeof addDaysToIsoDate !== 'function') return '';
  return addDaysToIsoDate(base, SPONSOR_OFFER_EXPIRE_DAYS);
}
function normalizeSponsorOfferExpiry(offer={}, today=sponsorTodayIso()){
  const nowSeasonTurn = typeof currentSeasonTurnNumber === 'function' ? currentSeasonTurnNumber() : 1;
  const nowGlobalTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  const createdTurn = Number.isFinite(Number(offer.createdTurn)) ? Number(offer.createdTurn) : nowSeasonTurn;
  const createdGlobalTurn = Number.isFinite(Number(offer.createdGlobalTurn)) ? Number(offer.createdGlobalTurn) : nowGlobalTurn;
  const createdDate = (typeof validIsoDate === 'function' && validIsoDate(offer.createdDate)) ? offer.createdDate : today;
  let expiresDate = (typeof validIsoDate === 'function' && validIsoDate(offer.expiresDate)) ? offer.expiresDate : sponsorDefaultExpiryDate(createdDate, today);
  if(typeof validIsoDate === 'function' && validIsoDate(today) && validIsoDate(expiresDate)){
    const remainingDays = typeof daysBetweenIsoDates === 'function' ? daysBetweenIsoDates(today, expiresDate) : SPONSOR_OFFER_EXPIRE_DAYS;
    if(remainingDays > SPONSOR_OFFER_EXPIRE_DAYS){
      expiresDate = sponsorDefaultExpiryDate(today, today);
    }
  }
  const expiresTurn = Number.isFinite(Number(offer.expiresTurn))
    ? Number(offer.expiresTurn)
    : createdTurn + Math.max(1, daysToTurns(SPONSOR_OFFER_EXPIRE_DAYS)) - 1;
  const expiresGlobalTurn = Number.isFinite(Number(offer.expiresGlobalTurn))
    ? Number(offer.expiresGlobalTurn)
    : createdGlobalTurn + Math.max(1, daysToTurns(SPONSOR_OFFER_EXPIRE_DAYS));
  return { ...offer, createdTurn, expiresTurn, createdGlobalTurn, expiresGlobalTurn, createdDate, expiresDate };
}
function sponsorOfferIsExpired(offer={}, today=sponsorTodayIso()){
  const normalized = normalizeSponsorOfferExpiry(offer, today);
  if(typeof validIsoDate === 'function' && validIsoDate(today) && validIsoDate(normalized.expiresDate)){
    return daysBetweenIsoDates(normalized.expiresDate, today) > 0;
  }
  const nowGlobalTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  if(Number.isFinite(Number(normalized.expiresGlobalTurn))) return Number(normalized.expiresGlobalTurn) < nowGlobalTurn;
  const nowSeasonTurn = typeof currentSeasonTurnNumber === 'function' ? currentSeasonTurnNumber() : 1;
  return Number(normalized.expiresTurn || 0) < nowSeasonTurn;
}
function sponsorOfferDaysLeft(offer={}, today=sponsorTodayIso()){
  const normalized = normalizeSponsorOfferExpiry(offer, today);
  if(typeof validIsoDate === 'function' && validIsoDate(today) && validIsoDate(normalized.expiresDate)){
    return Math.max(0, daysBetweenIsoDates(today, normalized.expiresDate));
  }
  const nowGlobalTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  if(Number.isFinite(Number(normalized.expiresGlobalTurn))) return turnsToDays(Math.max(0, Number(normalized.expiresGlobalTurn) - nowGlobalTurn));
  const nowSeasonTurn = typeof currentSeasonTurnNumber === 'function' ? currentSeasonTurnNumber() : 1;
  return turnsToDays(Math.max(0, Number(normalized.expiresTurn || nowSeasonTurn) - nowSeasonTurn + 1));
}
function normalizeSponsorState(state){
  const base = createInitialSponsorState();
  const clean = { ...base, ...(state || {}) };
  clean.active = Array.isArray(clean.active) ? clean.active : [];
  clean.offers = Array.isArray(clean.offers) ? clean.offers : [];
  clean.seasonPlan = Array.isArray(clean.seasonPlan) ? clean.seasonPlan : [];
  clean.seasonPlanSeason = Number.isFinite(Number(clean.seasonPlanSeason)) ? Number(clean.seasonPlanSeason) : 0;
  clean.seasonOfferTarget = Number.isFinite(Number(clean.seasonOfferTarget)) ? Number(clean.seasonOfferTarget) : 0;
  clean.generatedOfferCount = Number.isFinite(Number(clean.generatedOfferCount)) ? Number(clean.generatedOfferCount) : 0;
  clean.generatedLocalOfferCount = Number.isFinite(Number(clean.generatedLocalOfferCount)) ? Number(clean.generatedLocalOfferCount) : 0;
  clean.lastOfferTurn = Number.isFinite(Number(clean.lastOfferTurn)) ? Number(clean.lastOfferTurn) : -1;
  clean.expiredOffers = Number.isFinite(Number(clean.expiredOffers)) ? Number(clean.expiredOffers) : 0;
  delete clean.matchesSinceOffer;
  delete clean.nextOfferAfter;
  delete clean.openingOffersSeason;
  const today = sponsorTodayIso();
  clean.offers = clean.offers.map(offer => normalizeSponsorOfferExpiry(offer, today));
  clean.active = clean.active.map(contract => {
    const turnsRemaining = Number.isFinite(Number(contract.turnsRemaining)) ? Number(contract.turnsRemaining) : daysToTurns(Number(contract.durationDays || contract.diasDuracion || 0));
    return { ...contract, turnsRemaining:Math.max(0, turnsRemaining), paidToDate:Math.round(Number(contract.paidToDate || 0)) };
  }).filter(contract => Number(contract.turnsRemaining || 0) > 0);
  return clean;
}
function ensureSponsorState(){
  if(!game) return;
  game.sponsors = normalizeSponsorState(game.sponsors);
}
function sponsorDivisionMultiplier(clubId=game?.selectedClubId){
  const club = seed.clubs.find(c => Number(c.id) === Number(clubId)) || {};
  const order = Number(club.divisionOrder || clubDivision(clubId).order || 1);
  if(order <= 1) return 3;
  if(order === 2) return 1.5;
  return 1;
}
function sponsorLeagueCountry(clubId=game?.selectedClubId){
  const club = (seed?.clubs || []).find(item => Number(item.id) === Number(clubId)) || {};
  const division = typeof clubDivision === 'function' ? clubDivision(clubId) : {};
  return String(club.country || club.pais || division?.country || division?.pais || game?.selectedCountry || '').trim();
}
function sponsorCountryKey(value=''){
  if(typeof countryNameKey === 'function') return countryNameKey(value);
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}
function sponsorCountries(sponsor={}){
  const explicit = Array.isArray(sponsor.paises_liga) ? sponsor.paises_liga : [];
  const single = sponsor.pais_liga || sponsor.pais_origen || sponsor.country || sponsor.pais || '';
  return [...explicit, single].map(sponsorCountryKey).filter(Boolean);
}
function sponsorIsLocalForCountry(sponsor={}, country=''){
  const target = sponsorCountryKey(country);
  return Boolean(target && sponsorCountries(sponsor).includes(target));
}
function sponsorPickForClub(clubId=game?.selectedClubId, options={}){
  const all = (sponsorsDatabase?.sponsors || []).filter(sponsor => sponsor.activo !== false);
  if(!all.length) return null;
  const opts = typeof options === 'string' ? { deterministicKey:options } : (options || {});
  const deterministicKey = String(opts.deterministicKey || '');
  const country = sponsorLeagueCountry(clubId);
  const local = all.filter(sponsor => sponsorIsLocalForCountry(sponsor, country));
  const foreignOrGlobal = all.filter(sponsor => !sponsorIsLocalForCountry(sponsor, country));
  const localRoll = deterministicKey
    ? hashNumber(`sponsor-local-roll-${deterministicKey}-${country}`, 10000) / 10000
    : Math.random();
  const requestedLocal = typeof opts.forceLocal === 'boolean' ? opts.forceLocal : localRoll < SPONSOR_LOCAL_OFFER_RATIO;
  const wantsLocal = local.length > 0 && requestedLocal;
  const pool = wantsLocal ? local : (foreignOrGlobal.length ? foreignOrGlobal : all);
  const index = deterministicKey
    ? hashNumber(`sponsor-brand-${deterministicKey}-${country}-${wantsLocal ? 'local' : 'general'}`, pool.length)
    : randomInt(0, pool.length - 1);
  const sponsor = pool[index] || all[0] || null;
  return sponsor ? { sponsor, country, local:Boolean(sponsorIsLocalForCountry(sponsor, country)) } : null;
}
function sponsorLeagueReputationValue(clubId=game?.selectedClubId){
  const division = typeof clubDivision === 'function' ? clubDivision(clubId) : null;
  if(!division?.id) return 50;
  if(typeof leagueSeasonEconomyForDivision === 'function'){
    const snapshot = leagueSeasonEconomyForDivision(division.id, game?.seasonNumber || 1);
    const value = Number(snapshot?.effectiveReputation ?? snapshot?.reputation);
    if(Number.isFinite(value)) return clamp(value, 0, 100);
  }
  const clubs = (seed?.clubs || []).filter(club => String(club.divisionId || '') === String(division.id));
  if(!clubs.length) return 50;
  const total = clubs.reduce((sum, club) => sum + Number(typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : (club.reputation || club.prestigio || 50)), 0);
  return clamp(total / clubs.length, 0, 100);
}
function sponsorLeagueReputationMultiplier(clubId=game?.selectedClubId){
  const reputation = sponsorLeagueReputationValue(clubId);
  if(reputation >= 50){
    return 1 + ((reputation - 50) / 50) * (SPONSOR_LEAGUE_REPUTATION_MULTIPLIER_MAX - 1);
  }
  return SPONSOR_LEAGUE_REPUTATION_MULTIPLIER_MIN + (reputation / 50) * (1 - SPONSOR_LEAGUE_REPUTATION_MULTIPLIER_MIN);
}
function sponsorTablePositionInfo(clubId=game?.selectedClubId){
  const division = typeof clubDivision === 'function' ? clubDivision(clubId) : null;
  const table = division?.id && typeof sortedStandings === 'function' ? sortedStandings(division.id) : [];
  const index = table.findIndex(row => Number(row.clubId) === Number(clubId));
  const hasPlayedMatches = table.some(row => Number(row.pj || row.played || 0) > 0);
  if(index < 0 || table.length <= 1 || !hasPlayedMatches) return { position:0, teams:table.length, multiplier:1 };
  const strength = (table.length - 1 - index) / (table.length - 1);
  const multiplier = SPONSOR_TABLE_POSITION_MULTIPLIER_MIN + strength * (SPONSOR_TABLE_POSITION_MULTIPLIER_MAX - SPONSOR_TABLE_POSITION_MULTIPLIER_MIN);
  return { position:index + 1, teams:table.length, multiplier };
}
function sponsorMoraleBonus(clubId=game?.selectedClubId){
  return (squadMoraleAverage(clubId) / 100) * 0.10;
}
function sponsorCohesionBonus(clubId=game?.selectedClubId){
  return (cohesionValue(clubId) / 100) * 0.10;
}
function sponsorSeasonWindowTurns(){
  const total = typeof totalSeasonTurnCount === 'function' ? totalSeasonTurnCount() : 365;
  return Math.max(30, Number(total || 365));
}
function sponsorPaymentTypeForDuration(durationDays=0){
  const days = Math.max(1, Math.round(Number(durationDays || 0)));
  if(days <= 60) return 'upfront';
  if(days <= 200) return 'mixed';
  return 'daily';
}
function sponsorPaymentLabel(paymentType='daily'){
  if(paymentType === 'upfront') return 'Todo al inicio';
  if(paymentType === 'mixed') return '20% al firmar + diario';
  return 'Diario';
}
function sponsorOfferValue(baseSponsor, lugar, clubId=game?.selectedClubId){
  const base = Number(baseSponsor?.valor_base_por_7_dias || 0);
  const place = Number(lugar?.multiplicador_lugar || 1);
  const specialBonusPct = typeof specialActiveBonus === 'function' ? specialActiveBonus('sponsors_extra') : 0;
  const leagueReputation = sponsorLeagueReputationValue(clubId);
  const leagueMultiplier = sponsorLeagueReputationMultiplier(clubId);
  const tableInfo = sponsorTablePositionInfo(clubId);
  const totalMultiplier = sponsorDivisionMultiplier(clubId) * place * leagueMultiplier * tableInfo.multiplier * (1 + sponsorMoraleBonus(clubId) + sponsorCohesionBonus(clubId)) * (1 + (specialBonusPct / 100));
  const valuePer7Days = Math.max(0, Math.round(base * SPONSOR_BASE_VALUE_FACTOR * totalMultiplier));
  const baseDailyAmount = Math.max(0, Math.round(valuePer7Days / 7));
  const durationDays = randomInt(SPONSOR_DURATION_MIN_DAYS, SPONSOR_DURATION_MAX_DAYS);
  const turns = Math.max(1, daysToTurns(durationDays));
  const paymentType = sponsorPaymentTypeForDuration(durationDays);
  const dailyTotal = Math.round(baseDailyAmount * durationDays);
  const upfrontAmount = paymentType === 'upfront'
    ? dailyTotal
    : paymentType === 'mixed'
      ? Math.round(dailyTotal * 0.20)
      : 0;
  const remainingDailyTotal = Math.max(0, dailyTotal - upfrontAmount);
  const dailyAmount = paymentType === 'upfront' ? 0 : Math.max(0, Math.round(remainingDailyTotal / durationDays));
  return {
    valuePer7Days,
    baseDailyAmount,
    dailyAmount,
    durationDays,
    turns,
    paymentType,
    total:dailyTotal,
    upfrontAmount,
    upfrontTotal:upfrontAmount,
    dailyTotal,
    remainingDailyTotal,
    leagueCountry:sponsorLeagueCountry(clubId),
    leagueReputation:Number(leagueReputation.toFixed(2)),
    leagueMultiplier:Number(leagueMultiplier.toFixed(4)),
    tablePosition:Number(tableInfo.position || 0),
    tableTeams:Number(tableInfo.teams || 0),
    tablePositionMultiplier:Number(tableInfo.multiplier.toFixed(4)),
    totalMultiplier:Number(totalMultiplier.toFixed(4))
  };
}
function sponsorSpecialConditionPool(){
  return (SPONSOR_SPECIAL_CONDITIONS || []).filter(item => item && item.id && item.descripcion);
}
function sponsorSpecialPickCondition(){
  const pool = sponsorSpecialConditionPool();
  if(!SPONSOR_SPECIAL_ENABLED || !pool.length || Math.random() >= SPONSOR_SPECIAL_CHANCE) return null;
  return pool[randomInt(0, pool.length - 1)] || null;
}
function sponsorLowLevelCandidate(condition={}){
  const squad = playersByClub(game?.selectedClubId || 0).filter(Boolean);
  if(!squad.length) return null;
  const maxOverall = Number(condition.mediaMaxima || 55);
  const low = squad.filter(player => Number(effectiveOverall(player) || player.overall || 0) <= maxOverall);
  const pool = low.length ? low : squad;
  return [...pool].sort((a,b) => Number(effectiveOverall(a) || a.overall || 0) - Number(effectiveOverall(b) || b.overall || 0))[0] || null;
}
function createSponsorSpecialChallenge(condition=null){
  const item = condition || sponsorSpecialPickCondition();
  if(!item) return null;
  const challenge = {
    id:String(item.id || ''),
    name:String(item.nombre || 'Sponsor especial'),
    description:String(item.descripcion || ''),
    status:'active',
    matchesObserved:0,
    wins:0,
    losses:0,
    cleanSheets:0,
    redCards:0,
    targetStarts:0,
    daysObserved:0,
    createdDate:game?.currentDate || '',
    createdTurn:currentTurnIndex(),
    fulfilledDate:'',
    failedDate:'',
    bonusMultiplier:Number(SPONSOR_SPECIAL_BONUS_MULTIPLIER || 3),
    specialBonusPaid:false,
    config:{ ...item }
  };
  if(challenge.id === 'low_player_starter_6_10'){
    const player = sponsorLowLevelCandidate(item);
    if(!player) return null;
    challenge.targetPlayerId = Number(player.id || 0);
    challenge.targetPlayerName = player.name || 'Jugador elegido';
    challenge.description = `${challenge.targetPlayerName} debe ser titular ${Number(item.titularesObjetivo || 6)} de los próximos ${Number(item.partidosObjetivo || 10)} partidos.`;
  }
  return challenge;
}
function sponsorSpecialProgressText(challenge={}){
  if(!challenge?.id) return '';
  if(challenge.status === 'fulfilled') return 'Cumplido';
  if(challenge.status === 'failed') return 'Fallido';
  const cfg = challenge.config || {};
  if(challenge.id === 'low_player_starter_6_10') return `${Number(challenge.targetStarts || 0)}/${Number(cfg.titularesObjetivo || 6)} titularidades · ${Number(challenge.matchesObserved || 0)}/${Number(cfg.partidosObjetivo || 10)} partidos`;
  if(challenge.id === 'clean_sheets_4') return `${Number(challenge.cleanSheets || 0)}/${Number(cfg.partidosObjetivo || 4)} vallas invictas`;
  if(challenge.id === 'win_4_5') return `${Number(challenge.wins || 0)}/${Number(cfg.victoriasObjetivo || 4)} victorias · ${Number(challenge.matchesObserved || 0)}/${Number(cfg.partidosObjetivo || 5)} partidos`;
  if(challenge.id === 'no_reds_5') return `${Number(challenge.matchesObserved || 0)}/${Number(cfg.partidosObjetivo || 5)} partidos sin rojas`;
  if(challenge.id === 'field_98_30') return `${Number(challenge.daysObserved || 0)}/${Number(cfg.diasObjetivo || 30)} días con campo > ${Number(cfg.minimoCampo || 98)}`;
  if(challenge.id === 'lose_5_5') return `${Number(challenge.losses || 0)}/${Number(cfg.derrotasObjetivo || 5)} derrotas · ${Number(challenge.matchesObserved || 0)}/${Number(cfg.partidosObjetivo || 5)} partidos`;
  return `${Number(challenge.matchesObserved || challenge.daysObserved || 0)} avances`;
}
function sponsorSpecialBonusPotential(source=null){
  const challenge = source?.specialChallenge || source || {};
  if(!challenge?.id) return 0;
  const base = Math.max(0, Math.round(Number(source?.total || source?.dailyTotal || source?.upfrontTotal || 0)));
  const multiplier = Number(challenge.bonusMultiplier || SPONSOR_SPECIAL_BONUS_MULTIPLIER || 3);
  return Math.max(0, Math.round(base * multiplier));
}
function sponsorSpecialChallengeMarkup(challenge=null, compact=false, source=null){
  if(!challenge?.id) return '';
  const tone = challenge.status === 'fulfilled' ? 'ok' : challenge.status === 'failed' ? 'danger' : 'warn';
  const label = compact ? sponsorSpecialProgressText(challenge) : challenge.description;
  const bonus = sponsorSpecialBonusPotential(source || challenge);
  const bonusLine = bonus > 0 ? ` · Bono si cumple: ${formatMoney(bonus)}` : '';
  return `<span class="pill ${tone}">Sponsor especial x${Number(challenge.bonusMultiplier || SPONSOR_SPECIAL_BONUS_MULTIPLIER || 3)}</span><span class="muted small">${escapeHtml(label || '')}${compact ? '' : ` · ${escapeHtml(sponsorSpecialProgressText(challenge))}`}${bonusLine}</span>`;
}
function ownMatchSponsorContext(match){
  const clubId = Number(game?.selectedClubId || 0);
  const isHome = Number(match?.homeId || 0) === clubId;
  const isAway = Number(match?.awayId || 0) === clubId;
  if(!clubId || (!isHome && !isAway)) return null;
  const gf = isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
  const gc = isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
  const starters = (isHome ? match.starterIdsHome : match.starterIdsAway) || [];
  const redCards = (match.cards || []).filter(card => Number(card.clubId || 0) === clubId && ['red','secondYellowRed'].includes(String(card.type || ''))).length;
  return { clubId, gf, gc, won:gf > gc, lost:gf < gc, drawn:gf === gc, starters:starters.map(Number), redCards };
}
function paySponsorSpecialBonus(contract, reason=''){
  if(!contract || contract.specialBonusPaid) return 0;
  const base = Math.max(0, Math.round(Number(contract.total || contract.dailyTotal || contract.upfrontTotal || 0)));
  const amount = Math.max(0, Math.round(base * Number(contract.specialChallenge?.bonusMultiplier || SPONSOR_SPECIAL_BONUS_MULTIPLIER || 3)));
  if(amount <= 0) return 0;
  recordBudgetChange(amount, `Bono sponsor especial: ${contract.sponsorName} / ${contract.placeName}`, { type:'sponsor_special_bonus', sponsorId:contract.sponsorId, placeId:contract.placeId, sponsorContractId:contract.id, challengeId:contract.specialChallenge?.id || '' });
  contract.specialBonusPaid = true;
  contract.paidToDate = Math.round(Number(contract.paidToDate || 0) + amount);
  pushGameMessage({ type:'finanzas', title:'Bono de sponsor especial', body:`${contract.sponsorName} pagó un bono de ${formatMoney(amount)} por cumplir: ${contract.specialChallenge?.description || reason || 'condición especial'}.`, priority:'high' });
  return amount;
}
function completeSponsorChallenge(contract, success, detail=''){
  if(!contract?.specialChallenge || contract.specialChallenge.status !== 'active') return;
  contract.specialChallenge.status = success ? 'fulfilled' : 'failed';
  if(success){
    contract.specialChallenge.fulfilledDate = game?.currentDate || '';
    paySponsorSpecialBonus(contract, detail);
  }else{
    contract.specialChallenge.failedDate = game?.currentDate || '';
    if(detail) contract.specialChallenge.failureReason = detail;
    pushGameMessage({ type:'finanzas', title:'Sponsor especial perdido', body:`${contract.sponsorName} no pagará bono especial: ${detail || contract.specialChallenge.description || 'condición incumplida'}.`, priority:'normal' });
  }
}
function processSponsorSpecialAfterOwnMatch(match){
  if(!game?.sponsors?.active?.length) return;
  const ctx = ownMatchSponsorContext(match);
  if(!ctx) return;
  (game.sponsors.active || []).forEach(contract => {
    const ch = contract.specialChallenge;
    if(!ch || ch.status !== 'active') return;
    const cfg = ch.config || {};
    if(ch.id === 'low_player_starter_6_10'){
      ch.matchesObserved = Number(ch.matchesObserved || 0) + 1;
      if(ctx.starters.includes(Number(ch.targetPlayerId || 0))) ch.targetStarts = Number(ch.targetStarts || 0) + 1;
      if(Number(ch.targetStarts || 0) >= Number(cfg.titularesObjetivo || 6)) completeSponsorChallenge(contract, true, 'titularidades cumplidas');
      else if(Number(ch.matchesObserved || 0) >= Number(cfg.partidosObjetivo || 10)) completeSponsorChallenge(contract, false, 'no se alcanzaron las titularidades requeridas');
    }else if(ch.id === 'clean_sheets_4'){
      ch.matchesObserved = Number(ch.matchesObserved || 0) + 1;
      if(ctx.gc > 0) completeSponsorChallenge(contract, false, 'el equipo recibió goles');
      else {
        ch.cleanSheets = Number(ch.cleanSheets || 0) + 1;
        if(Number(ch.cleanSheets || 0) >= Number(cfg.partidosObjetivo || 4)) completeSponsorChallenge(contract, true, 'valla invicta cumplida');
      }
    }else if(ch.id === 'win_4_5'){
      ch.matchesObserved = Number(ch.matchesObserved || 0) + 1;
      if(ctx.won) ch.wins = Number(ch.wins || 0) + 1;
      if(Number(ch.wins || 0) >= Number(cfg.victoriasObjetivo || 4)) completeSponsorChallenge(contract, true, 'racha ganadora cumplida');
      else if(Number(ch.matchesObserved || 0) >= Number(cfg.partidosObjetivo || 5)) completeSponsorChallenge(contract, false, 'no se alcanzaron las victorias requeridas');
    }else if(ch.id === 'no_reds_5'){
      ch.matchesObserved = Number(ch.matchesObserved || 0) + 1;
      ch.redCards = Number(ch.redCards || 0) + Number(ctx.redCards || 0);
      if(ctx.redCards > 0) completeSponsorChallenge(contract, false, 'el equipo recibió una tarjeta roja');
      else if(Number(ch.matchesObserved || 0) >= Number(cfg.partidosObjetivo || 5)) completeSponsorChallenge(contract, true, 'juego limpio cumplido');
    }else if(ch.id === 'lose_5_5'){
      ch.matchesObserved = Number(ch.matchesObserved || 0) + 1;
      if(ctx.lost) ch.losses = Number(ch.losses || 0) + 1;
      if(Number(ch.matchesObserved || 0) >= Number(cfg.partidosObjetivo || 5)){
        if(Number(ch.losses || 0) >= Number(cfg.derrotasObjetivo || 5)) completeSponsorChallenge(contract, true, 'derrotas requeridas cumplidas');
        else completeSponsorChallenge(contract, false, 'no se alcanzaron las derrotas requeridas');
      }
    }
  });
}
function processSponsorSpecialDaily(){
  if(!game?.sponsors?.active?.length) return;
  const today = game?.currentDate || String(currentTurnIndex());
  (game.sponsors.active || []).forEach(contract => {
    const ch = contract.specialChallenge;
    if(!ch || ch.status !== 'active' || ch.id !== 'field_98_30') return;
    if(ch.lastDailyCheckDate === today) return;
    ch.lastDailyCheckDate = today;
    const cfg = ch.config || {};
    const minField = Number(cfg.minimoCampo || 98);
    const score = fieldScoreForClub(game.selectedClubId);
    if(score <= minField){
      completeSponsorChallenge(contract, false, `el campo bajó a ${score}/100`);
      return;
    }
    ch.daysObserved = Number(ch.daysObserved || 0) + 1;
    if(Number(ch.daysObserved || 0) >= Number(cfg.diasObjetivo || 30)) completeSponsorChallenge(contract, true, 'campo impecable sostenido');
  });
}
function occupiedSponsorPlaces(){
  ensureSponsorState();
  return new Set((game.sponsors.active || []).filter(item => Number(item.turnsRemaining || 0) > 0).map(item => item.placeId));
}

const SPONSOR_BASE_PLACE_IDS = ['LUG001','LUG002','LUG003','LUG005','LUG006','LUG015','LUG016','LUG017'];
function sponsorPlacesOrdered(){
  const places = Array.isArray(sponsorsDatabase?.lugares_sponsor) ? sponsorsDatabase.lugares_sponsor : [];
  const baseOrder = new Map(SPONSOR_BASE_PLACE_IDS.map((id, index) => [id, index]));
  const orderValue = place => baseOrder.has(place.id_lugar) ? baseOrder.get(place.id_lugar) : 1000 + Math.max(0, Number(String(place.id_lugar || '').replace(/\D/g, '')) || 0);
  return places.slice().sort((a,b) => orderValue(a) - orderValue(b) || String(a.nombre || '').localeCompare(String(b.nombre || '')));
}
function sponsorUnlockedPlaceCount(clubId=game?.selectedClubId){
  const capacity = typeof clubStadiumCapacity === 'function' ? Number(clubStadiumCapacity(clubId) || 0) : 0;
  const count = 8 + Math.floor(Math.max(0, capacity) / 5000);
  return clamp(count, 8, 32);
}
function sponsorUnlockedPlaces(clubId=game?.selectedClubId){
  return sponsorPlacesOrdered().slice(0, sponsorUnlockedPlaceCount(clubId));
}
function initializeInheritedSponsorsForNewClub(clubId=game?.selectedClubId, options={}){
  if(!game || !clubId) return { count:0, totalPlaces:0, ratio:0 };
  ensureSponsorState();
  const cfg = window.GAME_BALANCE_MANAGER?.contratosManager?.mercadoLaboralRealista || {};
  const minRatio = clamp(Number(cfg.sponsorsActivosMinimo ?? 0.40), 0, 1);
  const maxRatio = clamp(Number(cfg.sponsorsActivosMaximo ?? 0.60), minRatio, 1);
  const places = sponsorUnlockedPlaces(clubId);
  const sponsors = (sponsorsDatabase?.sponsors || []).filter(sponsor => sponsor.activo !== false);
  if(!places.length || !sponsors.length) return { count:0, totalPlaces:places.length, ratio:0 };
  const minimum = Math.min(places.length, Math.ceil(places.length * minRatio));
  const maximum = Math.max(minimum, Math.min(places.length, Math.floor(places.length * maxRatio)));
  const key = `${game.saveCode || ''}-${game.seasonNumber || 1}-${game.globalTurn || 0}-${clubId}-${options.reason || 'new_job'}`;
  const target = minimum + hashNumber(`inherited-sponsor-count-${key}`, maximum - minimum + 1);
  const orderedPlaces = places
    .map((place,index) => ({ place, score:hashNumber(`inherited-sponsor-place-${key}-${place.id_lugar}-${index}`, 1000000) }))
    .sort((a,b) => a.score - b.score)
    .slice(0, target)
    .map(item => item.place);
  game.sponsors.active = [];
  game.sponsors.offers = [];
  const localTarget = Math.min(target, Math.max(0, Math.round(target * SPONSOR_LOCAL_OFFER_RATIO)));
  orderedPlaces.forEach((place,index) => {
    const picked = sponsorPickForClub(clubId, { deterministicKey:`${key}-${place.id_lugar}-${index}`, forceLocal:index < localTarget });
    const sponsor = picked?.sponsor;
    if(!sponsor) return;
    const value = sponsorOfferValue(sponsor, place, clubId);
    const remainingFactor = 0.35 + (hashNumber(`inherited-sponsor-remaining-${key}-${place.id_lugar}`, 61) / 100);
    const remainingDays = Math.max(14, Math.round(Number(value.durationDays || 30) * remainingFactor));
    const elapsedDays = Math.max(0, Math.round(Number(value.durationDays || remainingDays) - remainingDays));
    const paidToDate = value.paymentType === 'upfront'
      ? Math.max(0, Math.round(Number(value.total || 0)))
      : Math.max(0, Math.round(Number(value.upfrontAmount || 0) + (Number(value.dailyAmount || 0) * elapsedDays)));
    game.sponsors.active.push({
      id:`INHERITED-SPON-${game.seasonNumber || 1}-${clubId}-${place.id_lugar}-${hashNumber(`${key}-${sponsor.id_sponsor}`, 100000)}`,
      sponsorId:sponsor.id_sponsor,
      sponsorName:sponsor.nombre_marca,
      category:sponsor.categoria,
      sponsorCountry:picked?.country || sponsorLeagueCountry(clubId),
      localSponsor:Boolean(picked?.local),
      placeId:place.id_lugar,
      placeName:place.nombre,
      placeType:place.tipo,
      paymentType:value.paymentType,
      paymentLabel:sponsorPaymentLabel(value.paymentType),
      valuePer7Days:value.valuePer7Days,
      dailyAmount:value.dailyAmount,
      durationDays:value.durationDays,
      turns:value.turns,
      total:value.total,
      dailyTotal:value.dailyTotal,
      upfrontTotal:value.upfrontTotal,
      upfrontAmount:value.upfrontAmount,
      remainingDailyTotal:Math.max(0, Number(value.remainingDailyTotal || 0) - (Number(value.dailyAmount || 0) * elapsedDays)),
      leagueReputation:value.leagueReputation,
      leagueMultiplier:value.leagueMultiplier,
      tablePosition:value.tablePosition,
      tableTeams:value.tableTeams,
      tablePositionMultiplier:value.tablePositionMultiplier,
      totalMultiplier:value.totalMultiplier,
      acceptedTurn:Math.max(0, currentTurnIndex() - daysToTurns(elapsedDays)),
      acceptedDate:'',
      turnsRemaining:Math.max(1, daysToTurns(remainingDays)),
      paidToDate,
      inherited:true,
      inheritedAt:game.currentDate || '',
      season:game.seasonNumber || 1,
      specialChallenge:null
    });
  });
  game.sponsors.seasonPlan = [];
  game.sponsors.seasonPlanSeason = 0;
  game.sponsors.generatedOfferCount = 0;
  game.sponsors.generatedLocalOfferCount = 0;
  if(typeof buildSponsorSeasonPlan === 'function') buildSponsorSeasonPlan();
  return {
    count:game.sponsors.active.length,
    totalPlaces:places.length,
    ratio:places.length ? game.sponsors.active.length / places.length : 0
  };
}
function sponsorPlaceIsUnlocked(placeId, clubId=game?.selectedClubId){
  return sponsorUnlockedPlaces(clubId).some(place => String(place.id_lugar) === String(placeId));
}
function sponsorOfferPlacePool(){
  const occupied = occupiedSponsorPlaces();
  return sponsorUnlockedPlaces().filter(place => !occupied.has(place.id_lugar));
}
function sponsorPlaceTypeLabel(type=''){
  if(type === 'equipacion') return 'Equipación';
  if(type === 'estadio') return 'Estadio';
  return 'Club';
}
function sponsorPlacesMarkup(){
  const places = sponsorPlacesOrdered();
  if(!places.length) return '<p class="muted small">No hay lugares de sponsor cargados.</p>';
  const unlockedCount = sponsorUnlockedPlaceCount();
  const occupied = occupiedSponsorPlaces();
  return `<div class="sponsor-places-card"><div class="row"><div><h4>Lugares disponibles</h4><p class="muted small">Tenés ${unlockedCount} de 32 lugares habilitados. Las ampliaciones de estadio pueden abrir más espacios comerciales.</p></div></div><div class="sponsor-places-grid">${places.map((place, index) => {
    const unlocked = index < unlockedCount;
    const active = occupied.has(place.id_lugar);
    const tone = !unlocked ? 'locked' : active ? 'occupied' : 'available';
    const label = !unlocked ? 'No disponible, amplia tu estadio para conseguir más lugares para sponsors' : active ? 'Ocupado' : 'Disponible';
    return `<div class="sponsor-place-item ${tone}"><strong>${escapeHtml(place.nombre)}</strong><span>${sponsorPlaceTypeLabel(place.tipo)}</span><em>${escapeHtml(label)}</em></div>`;
  }).join('')}</div></div>`;
}
function sponsorArrivalGroupSize(remaining){
  if(remaining <= 1) return 1;
  if(remaining >= 3 && Math.random() < SPONSOR_TRIPLE_ARRIVAL_CHANCE) return 3;
  return Math.min(remaining, randomInt(SPONSOR_OFFERS_PER_ARRIVAL_MIN, SPONSOR_OFFERS_PER_ARRIVAL_MAX));
}
function buildSponsorSeasonPlan(){
  ensureSponsorState();
  const season = Number(game?.seasonNumber || 1);
  const totalOffers = randomInt(SPONSOR_SEASON_OFFERS_MIN, SPONSOR_SEASON_OFFERS_MAX);
  const plan = [];
  let remaining = totalOffers;
  const windowTurns = sponsorSeasonWindowTurns();
  const currentTurn = Math.max(1, Math.min(windowTurns, typeof currentSeasonTurnNumber === 'function' ? currentSeasonTurnNumber() : 1));
  let guard = 0;
  while(remaining > 0 && guard < 500){
    guard += 1;
    const count = Math.min(remaining, sponsorArrivalGroupSize(remaining));
    const latestArrival = Math.max(currentTurn, windowTurns - Math.max(0, daysToTurns(SPONSOR_OFFER_EXPIRE_DAYS)));
    const arrivalTurn = randomInt(currentTurn, latestArrival);
    plan.push({ id:`SPONPLAN-${season}-${plan.length + 1}-${hashNumber(String(Math.random()), 100000)}`, arrivalTurn, count, released:false });
    remaining -= count;
  }
  plan.sort((a,b) => Number(a.arrivalTurn || 0) - Number(b.arrivalTurn || 0));
  game.sponsors.seasonPlan = plan;
  game.sponsors.seasonPlanSeason = season;
  game.sponsors.seasonOfferTarget = totalOffers;
  game.sponsors.generatedOfferCount = 0;
  game.sponsors.generatedLocalOfferCount = 0;
  return plan;
}
function ensureSponsorSeasonPlan(){
  ensureSponsorState();
  const season = Number(game?.seasonNumber || 1);
  if(Number(game.sponsors.seasonPlanSeason || 0) !== season || !Array.isArray(game.sponsors.seasonPlan) || !game.sponsors.seasonPlan.length){
    buildSponsorSeasonPlan();
  }
  return game.sponsors.seasonPlan || [];
}
function createSponsorOfferFromPlan(planItem){
  const lugares = sponsorOfferPlacePool();
  const serial = Number(game.sponsors.generatedOfferCount || 0) + 1;
  const localBefore = Number(game.sponsors.generatedLocalOfferCount || 0);
  const localTargetAfter = Math.round(serial * SPONSOR_LOCAL_OFFER_RATIO);
  const picked = sponsorPickForClub(game?.selectedClubId, { forceLocal:localTargetAfter > localBefore });
  const sponsor = picked?.sponsor;
  if(!lugares.length || !sponsor) return null;
  const place = lugares[randomInt(0, lugares.length - 1)];
  if(!place) return null;
  const value = sponsorOfferValue(sponsor, place, game?.selectedClubId);
  const paymentType = value.paymentType;
  const specialChallenge = createSponsorSpecialChallenge();
  const createdTurn = currentSeasonTurnNumber();
  const createdGlobalTurn = typeof currentTurnIndex === 'function' ? currentTurnIndex() : 0;
  const createdDate = sponsorTodayIso();
  const expiresDate = sponsorDefaultExpiryDate(createdDate, createdDate);
  const expiresTurn = createdTurn + Math.max(1, daysToTurns(SPONSOR_OFFER_EXPIRE_DAYS)) - 1;
  const expiresGlobalTurn = createdGlobalTurn + Math.max(1, daysToTurns(SPONSOR_OFFER_EXPIRE_DAYS));
  game.sponsors.generatedOfferCount = serial;
  if(picked?.local) game.sponsors.generatedLocalOfferCount = localBefore + 1;
  return {
    id:`SPON-${game.seasonNumber || 1}-${serial}-${sponsor.id_sponsor}-${place.id_lugar}-${hashNumber(String(Math.random()), 100000)}`,
    sponsorId:sponsor.id_sponsor,
    sponsorName:sponsor.nombre_marca,
    category:sponsor.categoria,
    sponsorCountry:picked?.country || sponsorLeagueCountry(game?.selectedClubId),
    localSponsor:Boolean(picked?.local),
    placeId:place.id_lugar,
    placeName:place.nombre,
    placeType:place.tipo,
    paymentType,
    paymentLabel:sponsorPaymentLabel(paymentType),
    valuePer7Days:value.valuePer7Days,
    dailyAmount:value.dailyAmount,
    durationDays:value.durationDays,
    turns:value.turns,
    total:value.total,
    dailyTotal:value.dailyTotal,
    upfrontTotal:value.upfrontTotal,
    upfrontAmount:value.upfrontAmount,
    remainingDailyTotal:value.remainingDailyTotal,
    leagueReputation:value.leagueReputation,
    leagueMultiplier:value.leagueMultiplier,
    tablePosition:value.tablePosition,
    tableTeams:value.tableTeams,
    tablePositionMultiplier:value.tablePositionMultiplier,
    totalMultiplier:value.totalMultiplier,
    createdTurn,
    expiresTurn,
    createdGlobalTurn,
    expiresGlobalTurn,
    createdDate,
    expiresDate,
    arrivalPlanId:planItem?.id || '',
    season:game.seasonNumber || 1,
    specialChallenge
  };
}
function expireSponsorOffers(silent=true){
  ensureSponsorState();
  const today = sponsorTodayIso();
  const before = game.sponsors.offers.length;
  game.sponsors.offers = (game.sponsors.offers || [])
    .map(offer => normalizeSponsorOfferExpiry(offer, today))
    .filter(offer => !sponsorOfferIsExpired(offer, today));
  const expired = before - game.sponsors.offers.length;
  if(expired > 0){
    game.sponsors.expiredOffers = Number(game.sponsors.expiredOffers || 0) + expired;
    if(!silent) showNotice(`${expired} oferta(s) de sponsor vencieron.`);
  }
  return expired;
}
function releaseDueSponsorOffers(options={}){
  ensureSponsorSeasonPlan();
  expireSponsorOffers(true);
  const currentTurn = currentSeasonTurnNumber();
  const released = [];
  (game.sponsors.seasonPlan || []).forEach(planItem => {
    if(planItem.released) return;
    if(Number(planItem.arrivalTurn || 0) > currentTurn) return;
    planItem.released = true;
    const count = Math.max(1, Math.round(Number(planItem.count || 1)));
    for(let i=0;i<count;i+=1){
      const offer = createSponsorOfferFromPlan(planItem);
      if(offer) released.push(offer);
    }
  });
  if(released.length){
    game.sponsors.offers = [...(game.sponsors.offers || []), ...released];
    game.sponsors.lastOfferTurn = currentTurnIndex();
    if(options.silent !== true){
      pushGameMessage({
        type:'finanzas',
        title:'Nuevas ofertas de sponsors',
        body:`Llegaron ${released.length} oferta(s) de patrocinio. Tenés ${SPONSOR_OFFER_EXPIRE_DAYS} día(s) para aceptar o rechazar antes de que desaparezcan.`,
        priority:'normal'
      });
    }
  }
  return released;
}
function generateOpeningSponsorOffers(force=false){
  ensureSponsorSeasonPlan();
  return releaseDueSponsorOffers({ silent:!force });
}
function advanceSponsorMatchCounter(){
  // los sponsors se liberan por plan fijo de temporada.
  return releaseDueSponsorOffers({ silent:true });
}
function processSponsorContracts(){
  ensureSponsorState();
  releaseDueSponsorOffers({ silent:false });
  processSponsorSpecialDaily();
  const currentDate = game?.currentDate || '';
  const nextActive = [];
  (game.sponsors.active || []).forEach(contract => {
    const remaining = Math.max(0, Number(contract.turnsRemaining || 0));
    if(remaining <= 0) return;
    let updated = { ...contract };
    if(updated.paymentType === 'daily' || updated.paymentType === 'mixed'){
      const amount = Math.max(0, Math.round(Number(updated.dailyAmount || 0)));
      if(amount > 0){
        recordBudgetChange(amount, `Sponsor diario: ${updated.sponsorName} / ${updated.placeName}`, { type:'sponsor_daily', sponsorId:updated.sponsorId, placeId:updated.placeId, sponsorContractId:updated.id });
        updated.paidToDate = Math.round(Number(updated.paidToDate || 0) + amount);
        updated.lastDailyPaymentDate = currentDate;
      }
    }
    updated.turnsRemaining = Math.max(0, remaining - 1);
    if(updated.turnsRemaining > 0) nextActive.push(updated);
  });
  game.sponsors.active = nextActive;
}
function acceptSponsorOffer(offerId){
  ensureSponsorState();
  expireSponsorOffers(true);
  const index = game.sponsors.offers.findIndex(offer => offer.id === offerId);
  if(index < 0) return;
  const offer = game.sponsors.offers[index];
  if(!sponsorPlaceIsUnlocked(offer.placeId)){
    showNotice('Ese lugar todavía no está disponible. Ampliá el estadio para habilitar más sponsors.');
    return;
  }
  if(occupiedSponsorPlaces().has(offer.placeId)){
    showNotice('Ese lugar ya está ocupado por otro sponsor. Rechazá esta oferta o esperá a que finalice el contrato activo.');
    return;
  }
  game.sponsors.offers.splice(index, 1);
  const contract = {
    ...offer,
    acceptedTurn:currentTurnIndex(),
    acceptedDate:game?.currentDate || '',
    turnsRemaining:offer.turns,
    paidToDate:0
  };
  if(offer.paymentType === 'upfront'){
    contract.paidToDate = Math.round(Number(offer.total || 0));
    recordBudgetChange(contract.paidToDate, `Sponsor pago inicial: ${offer.sponsorName} / ${offer.placeName}`, { type:'sponsor_upfront', sponsorId:offer.sponsorId, placeId:offer.placeId, sponsorContractId:offer.id });
    pushGameMessage({ type:'finanzas', title:'Sponsor aceptado', body:`${offer.sponsorName} pagó ${formatMoney(contract.paidToDate)} al inicio por ${offer.placeName}.`, priority:'normal' });
  } else if(offer.paymentType === 'mixed'){
    const upfront = Math.max(0, Math.round(Number(offer.upfrontAmount || offer.upfrontTotal || 0)));
    contract.paidToDate = upfront;
    if(upfront > 0){
      recordBudgetChange(upfront, `Sponsor 20% inicial: ${offer.sponsorName} / ${offer.placeName}`, { type:'sponsor_upfront_partial', sponsorId:offer.sponsorId, placeId:offer.placeId, sponsorContractId:offer.id });
    }
    pushGameMessage({ type:'finanzas', title:'Sponsor aceptado', body:`${offer.sponsorName} pagó ${formatMoney(upfront)} al firmar y pagará ${formatMoney(offer.dailyAmount)} por día durante ${formatDays(offer.durationDays)} por ${offer.placeName}.`, priority:'normal' });
  } else {
    pushGameMessage({ type:'finanzas', title:'Sponsor aceptado', body:`${offer.sponsorName} pagará ${formatMoney(offer.dailyAmount)} por día durante ${formatDays(offer.durationDays)} por ${offer.placeName}.`, priority:'normal' });
  }
  game.sponsors.active.push(contract);
  saveLocal(true);
  showNotice(`Sponsor aceptado: ${offer.sponsorName}.`);
  renderStadium();
}
function rejectSponsorOffer(offerId){
  ensureSponsorState();
  game.sponsors.offers = (game.sponsors.offers || []).filter(offer => offer.id !== offerId);
  saveLocal(true);
  renderStadium();
}
function sponsorOffersMarkup(){
  ensureSponsorState();
  expireSponsorOffers(true);
  const offers = game.sponsors.offers || [];
  if(!offers.length){
    return `<p class="muted small">Sin ofertas disponibles. Las marcas enviarán entre ${SPONSOR_SEASON_OFFERS_MIN} y ${SPONSOR_SEASON_OFFERS_MAX} propuestas durante la temporada.</p>`;
  }
  const today = sponsorTodayIso();
  return `<div class="table-wrap"><table class="sponsor-table"><thead><tr><th>Marca</th><th>Lugar</th><th>Duración</th><th>Pago</th><th>Valor</th><th>Vence</th><th></th></tr></thead><tbody>${offers.map(rawOffer => {
    const offer = normalizeSponsorOfferExpiry(rawOffer, today);
    const daysLeft = sponsorOfferDaysLeft(offer, today);
    const valueText = offer.paymentType === 'upfront'
      ? `${formatMoney(offer.total)} total`
      : offer.paymentType === 'mixed'
        ? `${formatMoney(offer.upfrontAmount || offer.upfrontTotal || 0)} inicial + ${formatMoney(offer.dailyAmount)} / día`
        : `${formatMoney(offer.dailyAmount)} / día`;
    const payText = sponsorPaymentLabel(offer.paymentType);
    return `<tr>
      <td><strong>${escapeHtml(offer.sponsorName)}</strong><span class="muted small">${escapeHtml(offer.category || '')}</span>${offer.specialChallenge ? `<span class="sponsor-special-line">${sponsorSpecialChallengeMarkup(offer.specialChallenge, false, offer)}</span>` : ''}</td>
      <td>${escapeHtml(offer.placeName)}</td>
      <td>${formatDays(offer.durationDays || turnsToDays(offer.turns))}</td>
      <td><span class="pill ${offer.paymentType === 'daily' ? 'ok' : ''}">${payText}</span></td>
      <td><strong class="ok">${valueText}</strong><span class="muted small">Base: ${formatMoney(offer.valuePer7Days || 0)} cada 7 días</span></td>
      <td>${formatDays(daysLeft)}</td>
      <td><button class="primary small-btn" data-accept-sponsor="${escapeHtml(offer.id)}">Aceptar</button><button class="ghost small-btn" data-reject-sponsor="${escapeHtml(offer.id)}">Rechazar</button></td>
    </tr>`;
  }).join('')}</tbody></table></div>`;
}
function activeSponsorsMarkup(){
  ensureSponsorState();
  const active = game.sponsors.active || [];
  if(!active.length) return '<p class="muted small">Todavía no hay contratos activos.</p>';
  return `<div class="table-wrap"><table class="sponsor-table"><thead><tr><th>Marca</th><th>Lugar</th><th>Pago</th><th>Días restantes</th><th>Cobrado</th></tr></thead><tbody>${active.map(item => {
    const payment = item.paymentType === 'upfront' ? 'Todo al inicio' : item.paymentType === 'mixed' ? `${formatMoney(item.upfrontAmount || item.upfrontTotal || 0)} inicial + ${formatMoney(item.dailyAmount || 0)} / día` : `${formatMoney(item.dailyAmount || 0)} / día`;
    const special = item.specialChallenge ? `<span class="sponsor-special-line">${sponsorSpecialChallengeMarkup(item.specialChallenge, true, item)}</span>` : '';
    return `<tr><td><strong>${escapeHtml(item.sponsorName)}</strong>${special}</td><td>${escapeHtml(item.placeName)}</td><td>${payment}</td><td>${formatDaysFromTurns(item.turnsRemaining)}</td><td>${formatMoney(Number(item.paidToDate || 0))}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function fanDateKey(value){
  const d = new Date(value || game?.currentDate || '');
  if(Number.isNaN(d.getTime())) return String(value || game?.currentDate || '');
  return d.toISOString().slice(0,10);
}
function fanRecentStats(clubId=game?.selectedClubId){
  ensureFanState();
  const id = Number(clubId || 0);
  const todayKey = fanDateKey(game?.currentDate || '');
  const today = new Date(game?.currentDate || '');
  const minDate = new Date(today);
  if(!Number.isNaN(minDate.getTime())) minDate.setDate(minDate.getDate() - 29);
  let todayDelta = 0;
  let last30 = 0;
  const addIfRelevant = (entry) => {
    if(Number(entry?.clubId || 0) !== id) return;
    const delta = Math.round(Number(entry?.delta || 0));
    if(!delta) return;
    const key = fanDateKey(entry?.date || '');
    if(key === todayKey) todayDelta += delta;
    const d = new Date(entry?.date || '');
    if(Number.isNaN(today.getTime()) || Number.isNaN(d.getTime()) || d >= minDate) last30 += delta;
  };
  (game?.fans?.history || []).forEach(addIfRelevant);
  (game?.fans?.memberCampaignHistory || []).forEach(addIfRelevant);
  return { todayDelta, last30 };
}


function memberCampaignsMarkup(){
  ensureFanState();
  const active = typeof activeMemberCampaignsForClub === 'function' ? activeMemberCampaignsForClub(game.selectedClubId) : [];
  const options = (STADIUM_MEMBER_CAMPAIGNS || []).map(item => {
    const activeCampaign = active.find(campaign => String(campaign.templateId || '') === String(item.id));
    const canPay = Number(game?.budget || 0) >= Number(item.cost || 0);
    if(activeCampaign){
      const total = Math.max(1, Number(activeCampaign.durationDays || activeCampaign.daysLeft || item.durationDays || 1));
      const left = Math.max(0, Number(activeCampaign.daysLeft || 0));
      const progress = clamp(Math.round(((total - left) / total) * 100), 0, 100);
      return `<div class="member-campaign-option member-campaign-running">
        <div><strong>${escapeHtml(item.name || activeCampaign.name || 'Campaña de Marketing')}</strong><p class="muted small">Inversión ${formatMoney(item.cost || activeCampaign.investment || 0)} · Duración ${formatDays(item.durationDays || activeCampaign.durationDays || 0)}</p></div>
        <div class="member-campaign-progress-inline"><span class="pill ok">${formatDays(left)} restantes</span><div class="project-progress"><span style="width:${progress}%"></span></div></div>
      </div>`;
    }
    return `<div class="member-campaign-option ${canPay ? '' : 'dim-row'}">
      <div><strong>${escapeHtml(item.name || 'Campaña de Marketing')}</strong><p class="muted small">Inversión ${formatMoney(item.cost || 0)} · Duración ${formatDays(item.durationDays || 0)}</p></div>
      <button class="ghost small-btn" data-start-member-campaign="${escapeHtml(item.id)}" ${canPay ? '' : 'disabled'}>Iniciar</button>
    </div>`;
  }).join('');
  return `<div class="member-campaigns-box">
    <div class="row"><div><h4>Hacer campañas para sumar socios</h4><p class="muted small">Se muestra inversión, duración y progreso. La captación diaria exacta de cada campaña queda oculta.</p></div></div>
    <div class="stack">${options || '<p class="muted small">No hay campañas configuradas.</p>'}</div>
  </div>`;
}


function stadiumExpansionProjectMarkup(project){
  const total = Math.max(1, Number(project.totalDays || project.daysLeft || 1));
  const left = Math.max(0, Number(project.daysLeft || 0));
  const progress = clamp(Math.round(((total - left) / total) * 100), 0, 100);
  return `<div class="stadium-expansion-active">
    <div class="row"><div><strong>${escapeHtml(project.name)}</strong><p class="muted small">Slot ${escapeHtml(project.slot || '—')} · +${new Intl.NumberFormat('es-AR').format(project.capacityGain || 0)} lugares</p></div><span class="pill">${left} día(s)</span></div>
    <div class="project-progress"><span style="width:${progress}%"></span></div>
  </div>`;
}
function stadiumExpansionCard(expansion){
  const status = stadiumExpansionStartStatus(game.selectedClubId, expansion);
  const durationDays = typeof stadiumExpansionDurationDays === 'function' ? stadiumExpansionDurationDays(expansion) : Number(expansion.days || 1);
  return `<div class="stadium-expansion-option ${status.ok ? '' : 'dim-row'}">
    <div>
      <strong>#${expansion.id} · ${escapeHtml(expansion.name)}</strong>
      <p class="muted small">Siguiente etapa · objetivo estructural ${new Intl.NumberFormat('es-AR').format(expansion.targetCapacity)} · +${new Intl.NumberFormat('es-AR').format(expansion.capacityGain)} lugares · ${durationDays} día(s) · Slot ${escapeHtml(expansion.slot)}</p>
      <p class="small ${status.ok ? 'ok' : 'muted'}">${status.ok ? `Costo ${formatMoney(expansion.cost)}` : escapeHtml(status.reason)}</p>
    </div>
    <button class="primary" data-start-stadium-expansion="${expansion.id}" ${status.ok ? '' : 'disabled'}>Iniciar</button>
  </div>`;
}
function stadiumCapacityRepairProjectMarkup(project){
  const total = Math.max(1, Number(project?.totalDays || project?.daysLeft || 1));
  const left = Math.max(0, Number(project?.daysLeft || 0));
  const progress = clamp(Math.round(((total - left) / total) * 100), 0, 100);
  return `<div class="stadium-expansion-active">
    <div class="row"><div><strong>Reparación estructural del estadio</strong><p class="muted small">Recuperación prevista: ${new Intl.NumberFormat('es-AR').format(project.missingSeats || 0)} lugares · Costo ${formatMoney(project.cost || 0)}</p></div><span class="pill">${left} día(s)</span></div>
    <div class="project-progress"><span style="width:${progress}%"></span></div>
  </div>`;
}
function stadiumCapacityRepairMarkup(clubId){
  const activeRepair = activeStadiumCapacityRepairProject(clubId);
  if(activeRepair) return `<div class="maintenance-option"><div style="width:100%"><h4>Reparación de capacidad en curso</h4>${stadiumCapacityRepairProjectMarkup(activeRepair)}</div></div>`;
  const status = stadiumCapacityRepairStartStatus(clubId);
  const quote = status.quote;
  if(!quote || quote.missingSeats <= 0){
    return `<div class="maintenance-option"><div><strong>Capacidad estructural al día</strong><p class="muted small">No hay lugares perdidos por deterioro anual.</p></div><span class="pill ok">Sin reparaciones</span></div>`;
  }
  return `<div class="maintenance-option ${status.ok ? '' : 'dim-row'}">
    <div><strong>Reparar estadio</strong><p class="muted small">Recupera ${new Intl.NumberFormat('es-AR').format(quote.missingSeats)} lugares hasta volver a ${new Intl.NumberFormat('es-AR').format(quote.targetCapacity)}. Costo ${formatMoney(quote.cost)} · ${quote.days} día(s).</p><p class="small ${status.ok ? 'ok' : 'muted'}">${status.ok ? 'La reparación ocupa toda la estructura y bloquea nuevas ampliaciones hasta finalizar.' : escapeHtml(status.reason)}</p></div>
    <button id="btnRepairStadiumCapacity" class="ghost" ${status.ok ? '' : 'disabled'}>Reparar estadio</button>
  </div>`;
}
function stadiumExpansionsMarkup(){
  const clubId = game.selectedClubId;
  const capacity = clubStadiumCapacity(clubId);
  const structuralCapacity = clubStadiumStructuralCapacity(clubId);
  const projectedCapacity = projectedStadiumStructuralCapacity(clubId);
  const baseCapacity = baseStadiumCapacityForClub(clubId);
  const active = activeStadiumExpansionProjects(clubId);
  const activeRepair = activeStadiumCapacityRepairProject(clubId);
  const available = availableStadiumExpansionsForClub(clubId);
  const maxWorks = maxSimultaneousStadiumWorks(structuralCapacity);
  const penalty = stadiumConstructionAttendancePenalty(clubId);
  const nextExpansion = nextOrderedStadiumExpansionForClub(clubId);
  return `<div class="card stadium-card stadium-expansions-card" style="margin-top:14px">
    <div class="row"><div><h3>Ampliaciones y reparación</h3><p class="muted small">Las ampliaciones se habilitan en orden según la capacidad estructural alcanzada. El deterioro anual baja el aforo actual, pero ya no hace retroceder la etapa de construcción. La capacidad nueva cuenta cuando termina cada obra.</p></div><span class="pill">${active.length}/${maxWorks} ampliación(es) activa(s)${activeRepair ? ' · reparación activa' : ''}</span></div>
    <div class="grid cols-4 stadium-expansion-summary">
      <div><p class="label">Capacidad inicial</p><strong>${new Intl.NumberFormat('es-AR').format(baseCapacity)}</strong></div>
      <div><p class="label">Capacidad actual</p><strong>${new Intl.NumberFormat('es-AR').format(capacity)}</strong></div>
      <div><p class="label">Estructura alcanzada</p><strong>${new Intl.NumberFormat('es-AR').format(structuralCapacity)}</strong>${projectedCapacity > structuralCapacity ? `<span class="muted small">Proyectada: ${new Intl.NumberFormat('es-AR').format(projectedCapacity)}</span>` : ''}</div>
      <div><p class="label">Penalización asistencia</p><strong class="${penalty > 0 ? 'warn' : ''}">${Math.round(penalty * 100)}%</strong></div>
    </div>
    <h4 style="margin-top:14px">Mantenimiento de capacidad</h4>
    <div class="stack">${stadiumCapacityRepairMarkup(clubId)}</div>
    ${active.length ? `<h4 style="margin-top:14px">Ampliaciones en construcción</h4><div class="stack">${active.map(stadiumExpansionProjectMarkup).join('')}</div>` : '<p class="muted small">No hay ampliaciones activas.</p>'}
    <h4 style="margin-top:14px">Siguiente ampliación</h4>
    <div class="stack">${available.length ? available.map(stadiumExpansionCard).join('') : `<p class="muted small">${structuralCapacity >= STADIUM_EXPANSION_MAX_CAPACITY ? (capacity < structuralCapacity ? 'La estructura llegó al máximo. Repará el estadio para recuperar toda la capacidad.' : 'El estadio llegó al máximo de 120.000 espectadores.') : activeRepair ? 'La próxima ampliación estará disponible cuando finalice la reparación.' : nextExpansion ? 'La siguiente ampliación está temporalmente bloqueada por presupuesto, cupo de obras o sector ocupado.' : 'No quedan ampliaciones disponibles.'}</p>`}</div>
    <p class="muted small" style="margin-top:12px">Máximo estructural: ${new Intl.NumberFormat('es-AR').format(STADIUM_EXPANSION_MAX_CAPACITY)}. Duración de ampliaciones: x${STADIUM_EXPANSION_DAYS_MULTIPLIER} sobre la tabla base.</p>
  </div>`;
}
function facilityConstructionProgress(project){
  if(!project || Number(project.totalDays || 0) <= 0) return 0;
  return clamp(Math.round(((Number(project.totalDays) - Number(project.daysLeft || 0)) / Number(project.totalDays)) * 100), 0, 100);
}
function stadiumVisualAssetMarkup(src, alt, options={}){
  const modifier = String(options.modifier || '').replace(/[^a-z0-9_-]/gi, '');
  const badge = options.badge ? `<span class="game-visual-asset-badge">${escapeHtml(options.badge)}</span>` : '';
  const caption = options.caption ? `<figcaption>${escapeHtml(options.caption)}</figcaption>` : '';
  return `<figure class="game-visual-asset ${modifier}"><img src="${escapeHtml(src)}?v=8.73" alt="${escapeHtml(alt)}" loading="lazy">${badge}${caption}</figure>`;
}
function stadiumFieldVisualPath(score){
  const quality = clamp(Math.round(Number(score || 0)), 0, 100);
  if(quality >= 80) return 'assets/campo/campo-deterioro-01-excelente.webp';
  if(quality >= 60) return 'assets/campo/campo-deterioro-02-leve.webp';
  if(quality >= 40) return 'assets/campo/campo-deterioro-03-medio.webp';
  if(quality >= 20) return 'assets/campo/campo-deterioro-04-alto.webp';
  return 'assets/campo/campo-deterioro-05-critico.webp';
}
const STADIUM_VISUAL_CAPACITY_PHASES = [
  { phase:1, max:1999, label:'Campo municipal' },
  { phase:2, max:4999, label:'Estadio de barrio' },
  { phase:3, max:9999, label:'Estadio profesional pequeño' },
  { phase:4, max:19999, label:'Estadio regional' },
  { phase:5, max:29999, label:'Estadio profesional mediano' },
  { phase:6, max:44999, label:'Estadio de gran ciudad' },
  { phase:7, max:59999, label:'Estadio nacional' },
  { phase:8, max:74999, label:'Estadio internacional' },
  { phase:9, max:99999, label:'Estadio de élite' },
  { phase:10, max:STADIUM_EXPANSION_MAX_CAPACITY, label:'Estadio monumental' }
];
function stadiumStructuralVisualCapacity(clubId=game?.selectedClubId){
  const id = Number(clubId || 0);
  const availableCapacity = clubStadiumCapacity(id);
  const bankruptcyClub = Boolean(game?.bankruptcyMode && Number(game?.selectedClubId || 0) === id);
  const structuralBase = bankruptcyClub ? 0 : baseStadiumCapacityForClub(id);
  const completed = completedStadiumExpansionsForClub(id);
  const completedGain = (STADIUM_EXPANSIONS || []).reduce((sum, expansion) => {
    return sum + (completed?.[expansion.id] ? Math.max(0, Math.round(Number(expansion.capacityGain || 0))) : 0);
  }, 0);
  return clamp(Math.max(availableCapacity, structuralBase + completedGain), 0, STADIUM_EXPANSION_MAX_CAPACITY);
}
function stadiumVisualPhaseDefinition(capacity){
  const safeCapacity = clamp(Math.round(Number(capacity || 0)), 0, STADIUM_EXPANSION_MAX_CAPACITY);
  return STADIUM_VISUAL_CAPACITY_PHASES.find(item => safeCapacity <= item.max) || STADIUM_VISUAL_CAPACITY_PHASES.at(-1);
}
function stadiumMainVisualState(clubId=game?.selectedClubId){
  const structuralCapacity = stadiumStructuralVisualCapacity(clubId);
  const definition = stadiumVisualPhaseDefinition(structuralCapacity);
  const activeWorks = activeStadiumExpansionProjects(clubId).length;
  const suffix = activeWorks ? '-ampliacion' : '';
  const phaseToken = String(definition.phase).padStart(2,'0');
  const path = definition.phase === 8
    ? (activeWorks ? 'assets/estadio/estadio-remodelacion.webp' : 'assets/estadio/estadio-generico.webp')
    : `assets/estadio/estadio-fase-${phaseToken}${suffix}.webp`;
  return {
    path,
    phase:definition.phase,
    label:definition.label,
    structuralCapacity,
    activeWorks,
    alt:activeWorks
      ? `${definition.label} durante una ampliación`
      : `${definition.label} en condiciones normales`
  };
}
function stadiumMainVisualPath(clubId=game?.selectedClubId){
  return stadiumMainVisualState(clubId).path;
}
function youthTrainingVisualPath(level=0){
  const safeLevel = clamp(Math.round(Number(level || 0)), 0, 5);
  return `assets/juveniles/predio-juveniles-nivel-${String(safeLevel).padStart(2,'0')}.webp`;
}
function startPitchHeatingConstruction(){
  if(!game?.selectedClubId) return;
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('fieldMaintenance')){ showNotice(managerChallengeBlockedMessage('fieldMaintenance')); return; }
  const state = clubFacilitiesState(game.selectedClubId);
  const definition = pitchHeatingDefinition();
  if(state.heating.built){ showNotice('La calefacción de césped ya está construida.'); return; }
  if(state.heating.construction){ showNotice('La calefacción de césped ya está en construcción.'); return; }
  if((game.budget || 0) < definition.buildCost){ showNotice('Presupuesto insuficiente para construir la calefacción de césped.'); return; }
  recordBudgetChange(-definition.buildCost, 'Construcción de calefacción de césped', { type:'stadium_facility_heating_build', clubId:Number(game.selectedClubId) });
  state.heating.construction = { daysLeft:definition.buildDays, totalDays:definition.buildDays, startedDate:game.currentDate || '', startedSeason:Number(game.seasonNumber || 1) };
  saveLocal(true);
  renderStadium();
  showNotice(`Construcción iniciada. La calefacción estará lista en ${definition.buildDays} días.`);
}
function togglePitchHeating(){
  if(!game?.selectedClubId) return;
  if(typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('fieldMaintenance')){ showNotice(managerChallengeBlockedMessage('fieldMaintenance')); return; }
  const state = clubFacilitiesState(game.selectedClubId);
  if(!state.heating.built){ showNotice('Primero debés construir la calefacción de césped.'); renderStadium(); return; }
  state.heating.active = !state.heating.active;
  saveLocal(true);
  renderStadium();
  showNotice(`Calefacción de césped ${state.heating.active ? 'encendida' : 'apagada'}.`);
}
function startYouthTrainingGroundUpgrade(targetLevel){
  if(!game) return;
  const facilities = managerAcademyFacilitiesState();
  const state = facilities.youthTraining;
  const currentLevel = Math.max(0, Math.round(Number(state.level || 0)));
  const requested = Math.round(Number(targetLevel || currentLevel + 1));
  const definition = youthTrainingGroundLevelDefinition(requested);
  if(!definition){ showNotice('Nivel de predio inválido.'); return; }
  if(state.construction){ showNotice('Ya hay una mejora del predio juvenil en construcción.'); return; }
  if(requested !== currentLevel + 1){ showNotice('Los niveles del predio deben construirse en orden.'); return; }
  if(!managerCanAffordAcademy(definition.cost)){ showNotice('Saldo personal insuficiente para mejorar el predio juvenil.'); return; }
  recordAcademyPersonalExpense(definition.cost, `Predio juvenil nivel ${definition.level}: ${definition.name}`, { type:'academy_facility_youth_build', targetLevel:definition.level });
  state.construction = { targetLevel:definition.level, daysLeft:definition.buildDays, totalDays:definition.buildDays, startedDate:game.currentDate || '', startedSeason:Number(game.seasonNumber || 1) };
  facilities.lastProcessedDate = validIsoDate(game.currentDate) ? game.currentDate : facilities.lastProcessedDate;
  saveLocal(true);
  if(activeTab === 'careerImprovements' && typeof renderCareerImprovements === 'function') renderCareerImprovements();
  else renderAcademy();
  showNotice(`Obra iniciada: predio juvenil ${definition.name}. Duración: ${definition.buildDays} días.`);
  if(typeof showAcademyFirstActionIntroduction === 'function') showAcademyFirstActionIntroduction('academy_facility_youth_build');
}
function pitchHeatingFacilityMarkup(){
  const state = clubFacilitiesState(game.selectedClubId);
  const definition = pitchHeatingDefinition();
  const project = state.heating.construction;
  const blocked = typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('fieldMaintenance');
  const status = project ? 'En construcción' : state.heating.built ? (state.heating.active ? 'Encendida' : 'Apagada') : 'No construida';
  return `<div class="card stadium-facility-card">
    <div class="row facility-card-head"><div><p class="label">Instalación del campo</p><h3>${escapeHtml(definition.name)}</h3></div><span class="pill ${state.heating.active ? 'ok' : ''}">${escapeHtml(status)}</span></div>
    ${stadiumVisualAssetMarkup(`assets/instalaciones/calefaccion-cesped-${state.heating.active ? 'on' : 'off'}.webp`, `Calefacción de césped ${state.heating.active ? 'encendida' : 'apagada'}`, { modifier:'facility-visual', badge:state.heating.active ? 'ON' : 'OFF' })}
    <p class="muted small">Construcción ${formatMoney(definition.buildCost)} · ${definition.buildDays} días. Encendida cuesta ${formatMoney(definition.dailyCost)} por día y recupera +${definition.dailyFieldGain} de estado del campo.</p>
    ${project ? `<div class="facility-project"><div class="row"><strong>Obra activa</strong><span>${Number(project.daysLeft || 0)} día(s) restantes</span></div><div class="project-progress"><span style="width:${facilityConstructionProgress(project)}%"></span></div></div>` : ''}
    <div class="facility-actions">
      ${!state.heating.built && !project ? `<button id="btnBuildPitchHeating" class="primary" ${(game.budget || 0) < definition.buildCost || blocked ? 'disabled' : ''}>Construir calefacción</button>` : ''}
      ${state.heating.built ? `<label class="facility-switch-row" for="pitchHeatingSwitch"><span><strong>Funcionamiento diario</strong><small>${state.heating.active ? 'ON · cobra y mejora el campo cada día' : 'OFF · sin gasto ni mejora'}</small></span><input id="pitchHeatingSwitch" type="checkbox" ${state.heating.active ? 'checked' : ''} ${blocked ? 'disabled' : ''}><span class="facility-switch" aria-hidden="true"></span></label>` : ''}
    </div>
    ${blocked ? '<p class="small danger">La calefacción está bloqueada por las reglas del reto activo.</p>' : ''}
  </div>`;
}
function youthTrainingFacilityMarkup(){
  const state = managerAcademyFacilitiesState().youthTraining;
  const levels = youthTrainingGroundLevels();
  const currentLevel = Math.max(0, Math.round(Number(state.level || 0)));
  const currentDef = youthTrainingGroundLevelDefinition(currentLevel);
  const project = state.construction;
  const nextDef = youthTrainingGroundLevelDefinition(currentLevel + 1);
  const currentBonus = youthTrainingExceptionalBonus();
  const currentExceptionalTotal = clamp(1 + currentBonus, 1, 6);
  const currentResidenceLimit = typeof youthTrainingResidenceLimit === 'function' ? youthTrainingResidenceLimit() : currentLevel * 2;
  return `<div class="card stadium-facility-card youth-facility-card">
    <div class="row facility-card-head"><div><p class="label">Academia</p><h3>Predio de entrenamiento juvenil</h3></div><span class="pill ${currentLevel >= 5 ? 'ok' : ''}">${currentLevel ? `Nivel ${currentLevel} · ${escapeHtml(currentDef?.name || '')}` : 'Sin predio'}</span></div>
    ${stadiumVisualAssetMarkup(youthTrainingVisualPath(currentLevel), currentLevel ? `Predio juvenil nivel ${currentLevel} ${currentDef?.name || ''}` : 'Terreno inicial sin predio juvenil', { modifier:'facility-visual', badge:currentLevel ? `Nivel ${currentLevel}` : 'Sin predio' })}
    <p class="muted small">La primera captación de cada temporada entrega ${currentExceptionalTotal} juvenil(es) excepcional(es) en total: 1 base + ${currentBonus} por el nivel actual. El máximo es 6. También habilita espacio para ${currentResidenceLimit} residencia(s).</p>
    ${project ? `<div class="facility-project"><div class="row"><strong>Construyendo nivel ${Number(project.targetLevel || currentLevel + 1)}</strong><span>${Number(project.daysLeft || 0)} día(s) restantes</span></div><div class="project-progress"><span style="width:${facilityConstructionProgress(project)}%"></span></div></div>` : ''}
    <div class="facility-level-grid">${levels.map(level => {
      const completed = currentLevel >= level.level;
      const active = Number(project?.targetLevel || 0) === level.level;
      const available = !project && level.level === currentLevel + 1;
      return `<div class="facility-level ${completed ? 'completed' : ''} ${active ? 'active' : ''}">
        <div class="row"><strong>Nivel ${level.level} · ${escapeHtml(level.name)}</strong><span class="facility-level-badges"><span class="pill">${Math.min(6, 1 + level.exceptionalBonus)} en primera captación</span><span class="pill">${level.maxResidences} residencias</span></span></div>
        <p>${formatMoney(level.cost)} · ${level.buildDays} días</p>
        <small>${completed ? 'Construido' : active ? 'En construcción' : level.level < currentLevel + 1 ? 'Construido' : level.level > currentLevel + 1 ? 'Requiere nivel anterior' : 'Siguiente mejora disponible'}</small>
        ${available ? `<button class="primary small-btn" data-build-youth-facility="${level.level}" ${!managerCanAffordAcademy(level.cost) ? 'disabled' : ''}>Construir nivel ${level.level}</button>` : ''}
      </div>`;
    }).join('')}</div>
    ${!nextDef && !project ? '<p class="ok small">Predio Elite completado. La primera captación de cada temporada entrega 6 juveniles excepcionales y permite hasta 10 residencias juveniles.</p>' : ''}
  </div>`;
}
function renderStadiumFacilities(){
  ensureStadiumState();
  const score = fieldScoreForClub(game.selectedClubId);
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Instalaciones del estadio</h2><p class="tagline">Obras que pertenecen al club y afectan directamente al campo de juego.</p></div>
      <div class="row"><span class="pill">Presupuesto: ${formatMoney(game.budget || 0)}</span><button type="button" id="btnBackToStadium" class="ghost">Volver al estadio</button></div>
    </div>
    <div class="grid cols-2 facility-summary-grid">
      <div class="card"><p class="label">Campo actual</p><strong>${score}/100</strong></div>
      <div class="card"><p class="label">Propiedad</p><strong>${escapeHtml(clubName(game.selectedClubId))}</strong><p class="muted small">El Predio juvenil ahora pertenece al manager y se administra desde Tu Academia.</p></div>
    </div>
    <div class="stadium-facilities-grid">${pitchHeatingFacilityMarkup()}</div>`;
  document.querySelector('#btnBackToStadium')?.addEventListener('click', () => { stadiumViewMode = 'main'; renderStadium(); });
  document.querySelector('#btnBuildPitchHeating')?.addEventListener('click', startPitchHeatingConstruction);
  document.querySelector('#pitchHeatingSwitch')?.addEventListener('change', togglePitchHeating);
}


function bindSponsorCardActions(){
  document.querySelectorAll('[data-accept-sponsor]').forEach(btn => btn.addEventListener('click', () => acceptSponsorOffer(btn.dataset.acceptSponsor)));
  document.querySelectorAll('[data-reject-sponsor]').forEach(btn => btn.addEventListener('click', () => rejectSponsorOffer(btn.dataset.rejectSponsor)));
}
function renderStadiumSponsors(){
  ensureSponsorState();
  view.innerHTML = `<div class="row section-title"><div><h2>Sponsors</h2><p class="tagline">Ofertas, espacios disponibles y contratos activos del club.</p></div><div class="pill">Presupuesto: ${formatMoney(game.budget || 0)}</div></div>
    <div class="card sponsors-card">
      ${sponsorPlacesMarkup()}
      <h3>Ofertas disponibles</h3>
      ${sponsorOffersMarkup()}
      <h3 style="margin-top:14px">Contratos activos</h3>
      ${activeSponsorsMarkup()}
    </div>`;
  bindSponsorCardActions();
}
function renderStadiumFans(){
  ensureFanState();
  ensureStadiumState();
  const currentFans = clubFansCurrent(game.selectedClubId);
  const baseFans = clubFansBase(game.selectedClubId);
  const capacity = clubStadiumCapacity(game.selectedClubId);
  const ticketPrice = ticketPriceForClub(game.selectedClubId);
  const lastFanDelta = Math.round(Number(game?.fans?.clubs?.[game.selectedClubId]?.lastDelta || 0));
  const fanStats = fanRecentStats(game.selectedClubId);
  const campaignCount = (game?.fans?.memberCampaigns || []).filter(campaign => Number(campaign.clubId || 0) === Number(game.selectedClubId) && Number(campaign.daysLeft || 0) > 0).length;
  view.innerHTML = `<div class="row section-title"><div><h2>Hinchas y socios</h2><p class="tagline">Crecimiento de la hinchada, campañas y política de entradas.</p></div><span class="pill">Capacidad ${new Intl.NumberFormat('es-AR').format(capacity)}</span></div>
    ${stadiumVisualAssetMarkup('assets/hinchas/hinchas-generico.webp', 'Hinchas alentando en la tribuna', { modifier:'fans-visual', badge:`${new Intl.NumberFormat('es-AR').format(currentFans)} hinchas` })}
    <div class="card stadium-card">
      <div class="grid cols-3">
        <div><p class="label">Hinchas totales</p><strong>${new Intl.NumberFormat('es-AR').format(currentFans)}</strong></div>
        <div><p class="label">Vitalicios</p><strong>${new Intl.NumberFormat('es-AR').format(baseFans)}</strong></div>
        <div><p class="label">Último cambio</p><strong class="${lastFanDelta >= 0 ? 'ok' : 'bad'}">${lastFanDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('es-AR').format(lastFanDelta)}</strong></div>
        <div><p class="label">Cambio diario</p><strong class="${fanStats.todayDelta >= 0 ? 'ok' : 'bad'}">${fanStats.todayDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('es-AR').format(fanStats.todayDelta)}</strong></div>
        <div><p class="label">Últimos 30 días</p><strong class="${fanStats.last30 >= 0 ? 'ok' : 'bad'}">${fanStats.last30 >= 0 ? '+' : ''}${new Intl.NumberFormat('es-AR').format(fanStats.last30)}</strong></div>
        <div><p class="label">Campañas activas</p><strong>${new Intl.NumberFormat('es-AR').format(campaignCount)}</strong></div>
      </div>
      <label for="ticketPriceInput" style="margin-top:14px">Precio de entrada</label>
      <input id="ticketPriceInput" type="number" min="${TICKET_PRICE_MIN}" max="${TICKET_PRICE_MAX}" step="10" value="${ticketPrice}">
      <p class="muted small">Mínimo ${formatMoney(TICKET_PRICE_MIN)} y máximo ${formatMoney(TICKET_PRICE_MAX)}. El crecimiento prioriza rendimiento y posición; los vitalicios influyen como base secundaria.</p>
      ${memberCampaignsMarkup()}
    </div>`;
  $('ticketPriceInput')?.addEventListener('change', event => {
    const price = setTicketPriceForClub(game.selectedClubId, event.target.value);
    saveLocal(true);
    renderStadiumFans();
    showNotice(`Precio de entrada actualizado a ${formatMoney(price)}.`);
  });
  document.querySelectorAll('[data-start-member-campaign]').forEach(btn => btn.addEventListener('click', () => startMemberCampaign(btn.dataset.startMemberCampaign)));
}

function renderStadium(){
  if(stadiumViewMode === 'facilities'){ renderStadiumFacilities(); return; }
  if(stadiumViewMode === 'sponsors'){ renderStadiumSponsors(); return; }
  if(stadiumViewMode === 'fans'){ renderStadiumFans(); return; }
  ensureStadiumState();
  ensureSponsorState();
  const score = fieldScoreForClub(game.selectedClubId);
  const label = fieldConditionName(score);
  const project = stadiumProjectForClub(game.selectedClubId);
  ensureFanState();
  const currentFans = clubFansCurrent(game.selectedClubId);
  const baseFans = clubFansBase(game.selectedClubId);
  const capacity = clubStadiumCapacity(game.selectedClubId);
  const constructionPenalty = stadiumConstructionAttendancePenalty(game.selectedClubId);
  const effectiveCapacity = Math.max(0, Math.floor(capacity * (1 - constructionPenalty)));
  const ticketPrice = ticketPriceForClub(game.selectedClubId);
  const lastFanDelta = Math.round(Number(game?.fans?.clubs?.[game.selectedClubId]?.lastDelta || 0));
  const lastFanClass = lastFanDelta >= 0 ? 'ok' : 'bad';
  const fanStats = fanRecentStats(game.selectedClubId);
  const todayFanClass = fanStats.todayDelta >= 0 ? 'ok' : 'bad';
  const monthFanClass = fanStats.last30 >= 0 ? 'ok' : 'bad';
  const replantActive = project.replantingTurnsLeft > 0;
  const patchActive = project.patchingTurnsLeft > 0;
  const replantProgress = replantActive ? Math.round(((REPLANT_TURNS - project.replantingTurnsLeft) / REPLANT_TURNS) * 100) : 0;
  const patchProgress = patchActive ? Math.round(((PATCH_TURNS - project.patchingTurnsLeft) / PATCH_TURNS) * 100) : 0;
  const fieldMaintenanceBlocked = typeof managerChallengeBlocks === 'function' && managerChallengeBlocks('fieldMaintenance');
  const afaSanctionState = typeof afaFieldSanctionState === 'function' ? afaFieldSanctionState(game.selectedClubId) : null;
  const afaInterventionActive = Boolean((afaSanctionState?.status === 'pending' && validIsoDate(afaSanctionState.restoreDate)) || (typeof AFA_FIELD_SANCTION_THRESHOLD !== 'undefined' && score < AFA_FIELD_SANCTION_THRESHOLD));
  const lastCapacityDecay = Array.isArray(game?.stadium?.capacityDeteriorationHistory) ? game.stadium.capacityDeteriorationHistory.slice().reverse().find(item => Number(item.clubId || 0) === Number(game.selectedClubId)) : null;
  const activeExpansionCount = activeStadiumExpansionProjects(game.selectedClubId).length + (activeStadiumCapacityRepairProject(game.selectedClubId) ? 1 : 0);
  const stadiumVisual = stadiumMainVisualState(game.selectedClubId);
  view.innerHTML = `
    <div class="row section-title">
      <div>
        <h2>Estadio</h2>
        <p class="tagline">Estado del campo de ${escapeHtml(clubName(game.selectedClubId))}. Cada partido como local nuestro campo de juego empeora, dale mantenimiento para evitar lesiones y dificultades para dar pases precisos.</p>
      </div>
      <div class="row"><div class="pill">Presupuesto: ${formatMoney(game.budget || 0)}</div><button type="button" id="btnOpenStadiumFacilities" class="ghost">Instalaciones del estadio</button></div>
    </div>
    ${typeof afaFieldSanctionMarkup === 'function' ? afaFieldSanctionMarkup(game.selectedClubId) : ''}
    ${stadiumVisualAssetMarkup(stadiumVisual.path, stadiumVisual.alt, {
      modifier:'stadium-main-visual',
      badge:activeExpansionCount ? `${stadiumVisual.label} · ${activeExpansionCount} obra(s)` : stadiumVisual.label
    })}
    <div class="grid cols-2">
      <div class="card stadium-card">
        <div class="row" style="align-items:flex-start">
          <div>
            <h3>Campo de juego</h3>
            <p class="label">Estado actual</p>
          </div>
          <span class="pill">Mantenimiento</span>
        </div>
        ${stadiumVisualAssetMarkup(stadiumFieldVisualPath(score), `Campo de juego con ${100 - score}% de deterioro`, { modifier:'pitch-visual', badge:`Deterioro ${100 - score}%` })}
        <div class="stadium-score-row"><strong class="field-state ${fieldConditionClass(score)}">${escapeHtml(label)}</strong><span>${score}/100</span></div>
        ${fieldBar(score, label)}
        ${fieldMaintenanceBlocked ? '<p class="muted small danger">Reto activo: no se puede replantar ni reparar el campo.</p>' : ''}
        <p class="stadium-identity-line">${escapeHtml(clubStadiumName(game.selectedClubId))} · Capacidad ${new Intl.NumberFormat('es-AR').format(capacity)}${constructionPenalty > 0 ? ` · Aforo partido con obras ${new Intl.NumberFormat('es-AR').format(effectiveCapacity)}` : ''}</p>
        <p class="muted small">Deterioro anual del estadio: -${Number(STADIUM_CAPACITY_SEASON_DECAY_PCT || 0)}% de capacidad al cambiar de temporada.${lastCapacityDecay ? ` Último deterioro: -${new Intl.NumberFormat('es-AR').format(lastCapacityDecay.lost || 0)} lugares.` : ''}</p>
        <div class="stack" style="margin-top:14px">
          <div class="maintenance-option">
            <div><strong>Replantar todo</strong><p class="muted small">Costo ${formatMoney(REPLANT_COST)}. Durante 35 días el campo queda muy malo; al finalizar sube a 99.</p></div>
            <button id="btnReplant" class="primary" ${fieldMaintenanceBlocked || afaInterventionActive || replantActive || patchActive || (game.budget || 0) < REPLANT_COST ? 'disabled' : ''}>Replantar</button>
          </div>
          <div class="maintenance-option">
            <div><strong>Regar y parchar campo de juego</strong><p class="muted small">Costo ${formatMoney(PATCH_COST)}. Mejora el campo durante los próximos 21 días.</p></div>
            <button id="btnPatch" class="ghost" ${fieldMaintenanceBlocked || afaInterventionActive || replantActive || patchActive || (game.budget || 0) < PATCH_COST ? 'disabled' : ''}>Regar y parchar</button>
          </div>
        </div>
      </div>
      <div class="card stadium-card">
        <h3>Hinchada y entradas</h3>
        <div class="grid cols-3">
          <div><p class="label">Hinchas Totales</p><strong>${new Intl.NumberFormat('es-AR').format(currentFans)}</strong></div>
          <div><p class="label">Vitalicios</p><strong>${new Intl.NumberFormat('es-AR').format(baseFans)}</strong></div>
          <div><p class="label">Nuevos socios</p><strong class="${lastFanClass}">${lastFanDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('es-AR').format(lastFanDelta)}</strong></div>
          <div><p class="label">Nuevos socios diarios</p><strong class="${todayFanClass}">${fanStats.todayDelta >= 0 ? '+' : ''}${new Intl.NumberFormat('es-AR').format(fanStats.todayDelta)}</strong></div>
          <div><p class="label">Socios últimos 30 días</p><strong class="${monthFanClass}">${fanStats.last30 >= 0 ? '+' : ''}${new Intl.NumberFormat('es-AR').format(fanStats.last30)}</strong></div>
          <div><p class="label">Socios campaña activos</p><strong>${new Intl.NumberFormat('es-AR').format((game?.fans?.memberCampaigns || []).filter(campaign => Number(campaign.clubId || 0) === Number(game.selectedClubId) && Number(campaign.daysLeft || 0) > 0).length)}</strong></div>
        </div>
        <label for="ticketPriceInput" style="margin-top:14px">Precio de entrada</label>
        <input id="ticketPriceInput" type="number" min="${TICKET_PRICE_MIN}" max="${TICKET_PRICE_MAX}" step="10" value="${ticketPrice}">
        <p class="muted small">Mínimo ${formatMoney(TICKET_PRICE_MIN)} y máximo ${formatMoney(TICKET_PRICE_MAX)}. Entradas baratas amortiguan pérdidas; entradas caras limitan el crecimiento. Los clubes pequeños pueden crecer proporcionalmente más rápido.</p>
        ${memberCampaignsMarkup()}
      </div>
    </div>
    ${replantActive ? `<div class="card stadium-progress-card" style="margin-top:14px"><div class="row"><h3>Replantando</h3><span class="pill">${formatDaysFromTurns(project.replantingTurnsLeft)} restante(s)</span></div><div class="project-progress"><span style="width:${replantProgress}%"></span></div><p class="muted small">Durante el replante el campo se mantiene en estado muy malo. Al finalizar pasará a 99.</p></div>` : ''}
    ${patchActive ? `<div class="card stadium-progress-card" style="margin-top:14px"><div class="row"><h3>Regando y parchando campo de juego</h3><span class="pill">${formatDaysFromTurns(project.patchingTurnsLeft)} restante(s)</span></div><div class="project-progress"><span style="width:${patchProgress}%"></span></div><p class="muted small">El campo mejora progresivamente mientras dura el mantenimiento.</p></div>` : ''}
    ${stadiumExpansionsMarkup()}
  `;
  $('btnOpenStadiumFacilities')?.addEventListener('click', () => { stadiumViewMode = 'facilities'; renderStadium(); });
  $('ticketPriceInput')?.addEventListener('change', event => {
    const price = setTicketPriceForClub(game.selectedClubId, event.target.value);
    saveLocal(true);
    renderStadium();
    showNotice(`Precio de entrada actualizado a ${formatMoney(price)}.`);
  });
  $('btnReplant')?.addEventListener('click', startReplantingField);
  $('btnPatch')?.addEventListener('click', startPatchingField);
  document.querySelectorAll('[data-start-stadium-expansion]').forEach(btn => btn.addEventListener('click', () => startStadiumExpansion(btn.dataset.startStadiumExpansion)));
  $('btnRepairStadiumCapacity')?.addEventListener('click', startStadiumCapacityRepair);
  bindSponsorCardActions();
  document.querySelectorAll('[data-start-member-campaign]').forEach(btn => btn.addEventListener('click', () => startMemberCampaign(btn.dataset.startMemberCampaign)));
}

function promotionPlayoffTieForMatch(match){
  const tieId = String(match?.playoffTieId || '');
  if(!tieId) return null;
  const ties = game?.argentinaPlayoffs?.ties;
  return Array.isArray(ties) ? ties.find(tie => String(tie.id) === tieId) || null : null;
}
function matchVisibleInFixtureDivision(match, division){
  if(!match || !division) return false;
  const divisionId = String(division.id || '');
  const directDivisionId = String(match.divisionId || seed.clubs.find(c=>c.id===match.homeId)?.divisionId || 'default');
  if(directDivisionId === divisionId) return true;
  if(match.promotionPlayoff || match.playoffTieId){
    if(String(match.upperDivisionId || '') === divisionId || String(match.lowerDivisionId || '') === divisionId) return true;
    const tie = promotionPlayoffTieForMatch(match);
    if(tie && (String(tie.upperDivisionId || '') === divisionId || String(tie.lowerDivisionId || '') === divisionId)) return true;
  }
  return false;
}
function fixtureRoundTitle(round){
  if(round?.playoffRound || round?.matches?.some(m => m?.promotionPlayoff)){
    const stage = String(round.playoffStage || round.matches?.find(m => m?.promotionPlayoff)?.playoffStage || '').toUpperCase();
    if(stage.includes('VUELTA')) return 'Playoffs VUELTA';
    if(stage.includes('IDA')) return 'Playoffs IDA';
  }
  return round?.title || (typeof playoffRoundMatchdayLabel === 'function' ? playoffRoundMatchdayLabel(round?.matchday) : `Fecha ${round?.matchday || ''}`);
}
function fixtureRoundFirstScheduledDate(round){
  const dates = [];
  const addDate = value => { if(validIsoDate(value)) dates.push(value); };
  addDate(round?.date);
  addDate(round?.startDate);
  (round?.matches || []).forEach(match => {
    const scheduled = typeof scheduledDateForMatch === 'function' ? scheduledDateForMatch(match, round) : match?.date;
    addDate(scheduled);
    addDate(match?.date);
  });
  return dates.sort()[0] || '';
}
function fixtureRoundAscendingComparator(a, b){
  const dateA = fixtureRoundFirstScheduledDate(a);
  const dateB = fixtureRoundFirstScheduledDate(b);
  if(dateA && dateB && dateA !== dateB) return dateA.localeCompare(dateB);
  if(dateA && !dateB) return -1;
  if(!dateA && dateB) return 1;
  const matchdayA = Math.max(0, Math.round(Number(a?.leagueMatchday || a?.competitionMatchday || a?.matchday || 0)));
  const matchdayB = Math.max(0, Math.round(Number(b?.leagueMatchday || b?.competitionMatchday || b?.matchday || 0)));
  if(matchdayA !== matchdayB) return matchdayA - matchdayB;
  return String(fixtureRoundTitle(a) || '').localeCompare(String(fixtureRoundTitle(b) || ''), 'es', { sensitivity:'base' });
}

function renderFixture(){
  if(fixtureViewMode === 'clubWorldCup' && typeof ensureClubWorldCupCurrentSeason === 'function'){
    const ensured = ensureClubWorldCupCurrentSeason({ source:'calendar-world-cup-view' });
    if(ensured?.changed && typeof saveLocal === 'function') Promise.resolve(saveLocal(true)).catch(()=>{});
  }
  if(typeof repairClubWorldCupFixtureSchedule === 'function') repairClubWorldCupFixtureSchedule();
  else if(typeof repairClubWorldCupGroupFixtureDates === 'function') repairClubWorldCupGroupFixtureDates();
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const ownClubId = Number(game?.selectedClubId || 0);
  const showCup = fixtureViewMode === 'clubWorldCup';
  const showMine = fixtureViewMode !== 'league' && !showCup;
  const visibleDivisions = selectedFixtureDivision === 'all' ? divisions : divisions.filter(d => d.id === selectedFixtureDivision);
  if(showCup){
    const selectedCup = typeof selectedClubWorldCupEditionForDisplay === 'function' ? selectedClubWorldCupEditionForDisplay() : { edition:null, current:true };
    view.innerHTML = `
      <div class="row section-title fixture-title-row">
        <div><h2>Calendario</h2><p class="tagline">Mundial de Clubes: grupos de cuatro equipos, dos clasificados por grupo y cuadro eliminatorio.</p></div>
        <div class="fixture-controls row">
          <button type="button" id="btnMyFixture" class="ghost">Mi calendario</button>
          <button type="button" id="btnClubWorldCupFixture" class="primary">Mundial de Clubes</button>
          ${typeof clubWorldCupYearOptionsMarkup === 'function' ? clubWorldCupYearOptionsMarkup(selectedClubWorldCupYear) : ''}
          <div class="division-filter"><label for="fixtureDivisionFilter">Liga</label><select id="fixtureDivisionFilter">${divisionOptions(selectedFixtureDivision)}</select></div>
        </div>
      </div>
      <div class="stack cwc-edition-view">${typeof clubWorldCupEditionMarkup === 'function' ? clubWorldCupEditionMarkup(selectedCup.edition, { current:selectedCup.current, interactive:selectedCup.current, showStats:false }) : '<div class="card"><p class="muted">Sin datos del Mundial de Clubes.</p></div>'}</div>`;
    $('btnMyFixture')?.addEventListener('click', () => { fixtureViewMode = 'mine'; renderFixture(); });
    $('btnClubWorldCupFixture')?.addEventListener('click', () => { fixtureViewMode = 'clubWorldCup'; renderFixture(); });
    $('fixtureDivisionFilter')?.addEventListener('change', event => { selectedFixtureDivision = event.target.value; fixtureViewMode = 'league'; renderFixture(); });
    if(typeof bindClubWorldCupYearFilter === 'function') bindClubWorldCupYearFilter(renderFixture);
    return;
  }
  const fixtureRounds = showMine ? (game.fixtures || []).slice().sort(fixtureRoundAscendingComparator) : (game.fixtures || []);
  const html = fixtureRounds.map(round=>{
    if(showMine){
      const matches = round.matches.filter(m => Number(m.homeId) === ownClubId || Number(m.awayId) === ownClubId);
      if(!matches.length) return '';
      return `<div class="card own-fixture-round"><div class="row"><h3>${escapeHtml(fixtureRoundTitle(round))}</h3><span class="pill">${round.startDate && round.endDate && round.startDate !== round.endDate ? `${round.startDate} → ${round.endDate}` : round.date}</span></div><div class="grid cols-2">${matches.map(matchCard).join('')}</div></div>`;
    }
    const groups = visibleDivisions.map(division => {
      const matches = round.matches.filter(m => matchVisibleInFixtureDivision(m, division));
      if(!matches.length) return '';
      return `<div class="fixture-division-block"><h4>${escapeHtml(division.name)}</h4><div class="grid cols-2">${matches.map(matchCard).join('')}</div></div>`;
    }).join('');
    return `<div class="card"><div class="row"><h3>${escapeHtml(fixtureRoundTitle(round))}</h3><span class="pill">${round.startDate && round.endDate && round.startDate !== round.endDate ? `${round.startDate} → ${round.endDate}` : round.date}</span></div>${groups || '<p class="muted">Sin partidos para esta división.</p>'}</div>`;
  }).filter(Boolean).join('');
  view.innerHTML = `
    <div class="row section-title fixture-title-row">
      <div><h2>Calendario</h2><p class="tagline">Por defecto se muestra el calendario de tu club. Los partidos jugados son clickeables para ver estadísticas y eventos.</p></div>
      <div class="fixture-controls row">
        <button type="button" id="btnMyFixture" class="${showMine ? 'primary' : 'ghost'}">Mi calendario</button>
        <button type="button" id="btnClubWorldCupFixture" class="${showCup ? 'primary' : 'ghost'}">Mundial de Clubes</button>
        <div class="division-filter"><label for="fixtureDivisionFilter">Liga</label><select id="fixtureDivisionFilter">${divisionOptions(selectedFixtureDivision)}</select></div>
      </div>
    </div>
    <div class="stack">${html || '<div class="card"><p class="muted">Sin partidos para mostrar.</p></div>'}</div>`;
  $('btnMyFixture')?.addEventListener('click', () => { fixtureViewMode = 'mine'; renderFixture(); });
  $('btnClubWorldCupFixture')?.addEventListener('click', () => { fixtureViewMode = 'clubWorldCup'; renderFixture(); });
  $('fixtureDivisionFilter')?.addEventListener('change', event => { selectedFixtureDivision = event.target.value; fixtureViewMode = 'league'; renderFixture(); });
}
function matchCard(m){
  const events = game.matchHistory.find(x=>x.id===m.id);
  const clickable = m.played ? 'clickable' : '';
  const attr = m.played ? `data-match-id="${escapeHtml(m.id)}"` : '';
  const playoffNote = m.promotionPlayoff ? `<div class="match-date-line playoff-note">${escapeHtml(`Playoffs ${String(m.playoffStage || '').toUpperCase() || ''}`.trim())} · mismo partido en ambas ligas</div>` : '';
  const cupSeasonDay = m.clubWorldCup && typeof clubWorldCupAuthoritativeSeasonDay === 'function' ? Number(clubWorldCupAuthoritativeSeasonDay(m, null) || m.seasonDay || 0) : Number(m.seasonDay || 0);
  const cupMeta = m.clubWorldCup ? `${cupSeasonDay ? `Día ${cupSeasonDay} · ` : ''}${m.stadiumName || 'Sede neutral'}${m.clubWorldCupGroup ? ` · Grupo ${m.clubWorldCupGroup}` : ''}${m.clubWorldCupBracketKey ? ` · ${m.clubWorldCupBracketKey}` : ''}` : '';
  const cupNote = m.clubWorldCup ? `<div class="match-date-line playoff-note">${escapeHtml(cupMeta)}</div>` : '';
  const penaltyLine = m.penaltyShootout ? `<div class="penalty-result-line">${escapeHtml(typeof penaltyShootoutWinnerText === 'function' ? penaltyShootoutWinnerText(m) : `${clubName(Number(m.winnerClubId || 0))} gana ${Number(m.penaltyShootout.home || 0)}-${Number(m.penaltyShootout.away || 0)} por penales`)}</div>` : '';
  const foulsTie = m.clubWorldCupTiebreaker ? ` <span class="small muted">(desempate histórico por faltas ${Number(m.clubWorldCupTiebreaker.homeFouls || 0)}-${Number(m.clubWorldCupTiebreaker.awayFouls || 0)})</span>` : '';
  return `<button class="match-card ${clickable}" ${attr}>
    <div class="match-date-line">${escapeHtml(typeof matchDateLabel === 'function' ? matchDateLabel(m.date) : (m.date || ''))}</div>
    ${playoffNote}${cupNote}
    <div class="match-line">
      <div>${clubSpan(m.homeId)}</div>
      <strong class="score">${m.played ? `${m.homeGoals} - ${m.awayGoals}${foulsTie}` : 'vs'}</strong>
      <div>${clubSpan(m.awayId)}</div>
    </div>
    ${penaltyLine}
    ${events ? `<div class="events">${events.goals.slice(0,4).map(g=>`${g.minute}' ${escapeHtml(playerById(g.playerId)?.name || 'Jugador')}`).join(' · ')}${events.goals.length>4?' · ...':''}</div>` : ''}
  </button>`;
}

function standingsHistoryEntries(){
  const history = typeof normalizeStandingsHistoryState === 'function' ? normalizeStandingsHistoryState(game?.standingsHistory || {}) : (game?.standingsHistory || { seasons:[] });
  return Array.isArray(history.seasons) ? history.seasons.slice().sort((a,b)=>Number(b.year || 0)-Number(a.year || 0)) : [];
}
function currentStandingsYearKey(){
  return `current-${Number(game?.seasonYear || seasonYearForNumber?.(game?.seasonNumber || 1) || new Date().getFullYear())}`;
}
function standingsYearOptionsMarkup(selected){
  const currentYear = Number(game?.seasonYear || (typeof seasonYearForNumber === 'function' ? seasonYearForNumber(game?.seasonNumber || 1) : new Date().getFullYear()));
  const currentKey = currentStandingsYearKey();
  const opts = [`<option value="${escapeHtml(currentKey)}" ${selected === currentKey || selected === 'current' ? 'selected' : ''}>${currentYear} · actual</option>`];
  standingsHistoryEntries().forEach(entry => {
    const key = `history-${Number(entry.season || 0)}-${Number(entry.year || 0)}`;
    opts.push(`<option value="${escapeHtml(key)}" ${selected === key ? 'selected' : ''}>${Number(entry.year || 0)} · Temp. ${Number(entry.season || 0)}</option>`);
  });
  return `<div class="division-filter standings-year-filter"><label for="standingsYearFilter">Año</label><select id="standingsYearFilter">${opts.join('')}</select></div>`;
}
function selectedStandingsHistoryEntry(){
  const selected = String(selectedStandingsYear || 'current');
  if(!selected.startsWith('history-')) return null;
  const parts = selected.split('-');
  const season = Number(parts[1] || 0);
  const year = Number(parts[2] || 0);
  return standingsHistoryEntries().find(entry => Number(entry.season || 0) === season && Number(entry.year || 0) === year) || null;
}
function standingsRowsForDisplay(divisionId){
  const historical = selectedStandingsHistoryEntry();
  if(historical){
    return Array.isArray(historical.divisions?.[divisionId]) ? historical.divisions[divisionId].slice().sort((a,b)=>Number(a.position || 999)-Number(b.position || 999)) : [];
  }
  return sortedStandings(divisionId);
}
function standingsDisplaySubtitle(){
  const historical = selectedStandingsHistoryEntry();
  if(!historical) return '';
  return `<p class="muted small">Tabla histórica guardada al cierre de la temporada ${Number(historical.season || 0)}.</p>`;
}
function standingsSeasonContext(){
  const historical = selectedStandingsHistoryEntry();
  return {
    season:Number(historical?.season || game?.seasonNumber || 1),
    year:Number(historical?.year || game?.seasonYear || 0),
    historical:Boolean(historical)
  };
}
function standingsCountryKey(value){
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
}
function standingsContinentalRule(division){
  if(!division || Number(division.order || 0) !== 1) return null;
  const country = String(division.country || division.pais || '');
  const key = standingsCountryKey(country);
  const libertadoresFallback = { argentina:8, brasil:8, chile:4 };
  const championsFallback = { inglaterra:8, italia:6, espana:6, rumania:2 };
  if(Object.prototype.hasOwnProperty.call(libertadoresFallback, key)){
    const configured = typeof LIBERTADORES_CONFIG !== 'undefined' ? Number(LIBERTADORES_CONFIG.slots?.[country] || 0) : 0;
    return { id:'libertadores', label:'Libertadores', fullLabel:'Copa Libertadores', quota:Math.max(0, configured || libertadoresFallback[key]), rowClass:'libertadores-qualification-row', pillClass:'libertadores' };
  }
  if(Object.prototype.hasOwnProperty.call(championsFallback, key)){
    const configured = typeof CHAMPIONS_LEAGUE_CONFIG !== 'undefined' ? Number(CHAMPIONS_LEAGUE_CONFIG.slots?.[country] || 0) : 0;
    return { id:'champions-league', label:'Champions', fullLabel:'Champions League', quota:Math.max(0, configured || championsFallback[key]), rowClass:'champions-qualification-row', pillClass:'champions' };
  }
  return null;
}
function standingsChampionHistoryEntry(season, predicate){
  const entries = Array.isArray(game?.competitionChampionsHistory?.entries) ? game.competitionChampionsHistory.entries : [];
  return entries.slice().reverse().find(entry => Number(entry?.season || 0) === Number(season || 0) && predicate(entry)) || null;
}
function standingsCurrentInternationalChampion(rule, context){
  if(!rule || context.historical) return 0;
  if(rule.id === 'libertadores') return Number(game?.libertadores?.championId || 0);
  if(rule.id === 'champions-league') return Number(game?.championsLeague?.championId || 0);
  return 0;
}
function standingsProjectedContinentalQualifiers(division, tableRows=[]){
  const rule = standingsContinentalRule(division);
  if(!rule?.quota) return { rule:null, clubIds:new Set() };
  const context = standingsSeasonContext();
  const countryKey = standingsCountryKey(division.country || division.pais || '');
  const selected = [];
  const add = clubId => {
    const id = Number(clubId || 0);
    if(!id || selected.includes(id) || selected.length >= rule.quota) return;
    selected.push(id);
  };
  let internationalChampion = standingsCurrentInternationalChampion(rule, context);
  if(!internationalChampion){
    const internationalEntry = standingsChampionHistoryEntry(context.season, entry => {
      const id = String(entry?.competitionId || '');
      const name = String(entry?.competitionName || '');
      return rule.id === 'libertadores' ? (id === 'copa-libertadores' || /libertadores/i.test(name)) : (id === 'champions-league' || /champions\s*league/i.test(name));
    });
    internationalChampion = Number(internationalEntry?.championId || 0);
  }
  const internationalCountry = standingsCountryKey((seed?.clubs || []).find(club => Number(club?.id || 0) === internationalChampion)?.country || '');
  if(internationalCountry === countryKey) add(internationalChampion);
  const cupChampion = standingsChampionHistoryEntry(context.season, entry => {
    if(String(entry?.type || '') !== 'national_cup') return false;
    const championClub = (seed?.clubs || []).find(club => Number(club?.id || 0) === Number(entry?.championId || 0));
    return standingsCountryKey(championClub?.country || championClub?.pais || '') === countryKey;
  });
  add(cupChampion?.championId);
  (tableRows || []).forEach(row => add(row?.clubId));
  return { rule, clubIds:new Set(selected.slice(0, rule.quota)) };
}
function standingsQualificationInfo(division, row, index, continentalProjection){
  const items = [];
  const classes = [];
  const worldCupInfo = typeof clubWorldCupQualificationInfoForClub === 'function' ? clubWorldCupQualificationInfoForClub(Number(row?.clubId || 0)) : null;
  if(worldCupInfo){
    items.push({ label:'Mundial', title:`${worldCupInfo.qualified ? 'Clasificado' : 'Zona provisional'} al Mundial de Clubes ${worldCupInfo.year}${worldCupInfo.source ? ` · ${worldCupInfo.source}` : ''}`, className:'world-cup' });
  }
  if(continentalProjection?.rule && continentalProjection.clubIds?.has(Number(row?.clubId || 0))){
    items.push({ label:continentalProjection.rule.label, title:`Clasifica a ${continentalProjection.rule.fullLabel}`, className:continentalProjection.rule.pillClass });
    classes.push(continentalProjection.rule.rowClass);
  }
  return { items, classes, title:items.map(item => item.title).join(' · ') };
}
function standingsQualificationPills(items=[]){
  if(!items.length) return '<span class="standings-no-qualification">—</span>';
  return `<span class="standings-qualification-pills">${items.map(item => `<span class="standings-qualification-pill ${escapeHtml(item.className)}" title="${escapeHtml(item.title)}">${escapeHtml(item.label)}</span>`).join('')}</span>`;
}
function standingsQualificationLegend(division, continentalProjection, worldCupQuota){
  const pills = [];
  if(continentalProjection?.rule?.quota) pills.push(`<span class="standings-legend-item ${escapeHtml(continentalProjection.rule.pillClass)}">${escapeHtml(continentalProjection.rule.fullLabel)} · ${continentalProjection.rule.quota} cupos</span>`);
  if(worldCupQuota > 0){
    const targetYear=typeof clubWorldCupNextEditionYear === 'function' ? clubWorldCupNextEditionYear(Number(game?.seasonYear || currentSeasonYear()), true) : Number(game?.seasonYear || 0);
    pills.push(`<span class="standings-legend-item world-cup">Mundial de Clubes ${targetYear} · ${worldCupQuota} ${worldCupQuota === 1 ? 'club señalado' : 'clubes señalados'}</span>`);
  }
  if(!pills.length) return '';
  const note = continentalProjection?.rule?.quota ? '<span class="muted small">La copa nacional y el campeón vigente ocupan cupos de su país cuando corresponde.</span>' : '';
  return `<div class="standings-qualification-legend">${pills.join('')}${note}</div>`;
}


function competitionsNavMarkup(active='standings'){
  const current = String(active || 'standings');
  return `<div class="row competition-controls">
    <button type="button" id="btnCompetitionStandings" class="${current === 'standings' ? 'primary' : 'ghost'}">Tabla de posiciones</button>
    <button type="button" id="btnCompetitionStats" class="${current === 'stats' ? 'primary' : 'ghost'}">Estadísticas</button>
    <button type="button" id="btnCompetitionPlayerRanking" class="${current === 'player-ranking' ? 'primary' : 'ghost'}">Ranking de jugadores</button>
    <button type="button" id="btnCompetitionPlayerPalmares" class="${current === 'player-palmares' ? 'primary' : 'ghost'}">Palmarés de jugadores</button>
    <button type="button" id="btnCompetitionNationalCups" class="${current === 'national-cups' ? 'primary' : 'ghost'}">Copas nacionales</button>
    <button type="button" id="btnCompetitionLibertadores" class="${current === 'libertadores' ? 'primary' : 'ghost'}">Libertadores</button>
    <button type="button" id="btnCompetitionChampionsLeague" class="${current === 'champions-league' ? 'primary' : 'ghost'}">Champions League</button>
    <button type="button" id="btnCompetitionClubRanking" class="${current === 'club-ranking' ? 'primary' : 'ghost'}">Ranking FIFA</button>
    <button type="button" id="btnCompetitionChampions" class="${current === 'champions' ? 'primary' : 'ghost'}">Campeones</button>
  </div>`;
}
function bindCompetitionsNav(){
  $('btnCompetitionStandings')?.addEventListener('click', () => { selectedCompetitionView = 'standings'; renderStandings(); });
  $('btnCompetitionStats')?.addEventListener('click', () => { selectedCompetitionView = 'stats'; renderStandings(); });
  $('btnCompetitionPlayerRanking')?.addEventListener('click', () => { selectedCompetitionView = 'player-ranking'; renderStandings(); });
  $('btnCompetitionPlayerPalmares')?.addEventListener('click', () => { selectedCompetitionView = 'player-palmares'; renderStandings(); });
  $('btnCompetitionNationalCups')?.addEventListener('click', () => { selectedCompetitionView = 'national-cups'; renderStandings(); });
  $('btnCompetitionLibertadores')?.addEventListener('click', () => { selectedCompetitionView = 'libertadores'; renderStandings(); });
  $('btnCompetitionChampionsLeague')?.addEventListener('click', () => { selectedCompetitionView = 'champions-league'; renderStandings(); });
  $('btnCompetitionClubRanking')?.addEventListener('click', () => { selectedCompetitionView = 'club-ranking'; renderStandings(); });
  $('btnCompetitionChampions')?.addEventListener('click', () => { selectedCompetitionView = 'champions'; renderStandings(); });
}
function competitionChampionEntriesFromStandingsHistory(){
  const entries = [];
  standingsHistoryEntries().forEach(entry => {
    Object.entries(entry.divisions || {}).forEach(([divisionId, rows]) => {
      if(!Array.isArray(rows) || !rows.length) return;
      const champion = rows.slice().sort((a,b)=>Number(a.position || 999)-Number(b.position || 999))[0];
      if(!champion?.clubId) return;
      const division = (seed?.divisions || []).find(item => String(item.id || '') === String(divisionId));
      entries.push({
        season:Number(entry.season || 0),
        year:Number(entry.year || 0),
        type:'league',
        competitionId:String(divisionId),
        competitionName:division?.name || String(divisionId),
        championId:Number(champion.clubId || 0),
        championName:clubName(champion.clubId),
        createdAt:String(entry.createdAt || '')
      });
    });
  });
  return entries;
}
function competitionChampionsHistoryEntries(){
  const explicit = typeof normalizeCompetitionChampionsHistoryState === 'function'
    ? normalizeCompetitionChampionsHistoryState(game?.competitionChampionsHistory || {}).entries
    : (Array.isArray(game?.competitionChampionsHistory?.entries) ? game.competitionChampionsHistory.entries : []);
  const merged = [];
  const seen = new Set();
  [...explicit, ...competitionChampionEntriesFromStandingsHistory()].forEach(entry => {
    const season = Number(entry.season || 0);
    const competitionId = String(entry.competitionId || entry.divisionId || '');
    const championId = Number(entry.championId || entry.clubId || 0);
    if(!season || !competitionId || !championId) return;
    const key = `${season}-${competitionId}`;
    if(seen.has(key)) return;
    seen.add(key);
    merged.push({
      season,
      year:Number(entry.year || seasonYearForNumber(season)),
      type:String(entry.type || 'league'),
      competitionId,
      competitionName:String(entry.competitionName || entry.divisionName || competitionId),
      championId,
      championName:String(entry.championName || clubName(championId)),
      runnerUpId:Number(entry.runnerUpId || 0),
      runnerUpName:entry.runnerUpName ? String(entry.runnerUpName) : (entry.runnerUpId ? clubName(entry.runnerUpId) : ''),
      thirdPlaceId:Number(entry.thirdPlaceId || 0),
      thirdPlaceName:entry.thirdPlaceName ? String(entry.thirdPlaceName) : (entry.thirdPlaceId ? clubName(entry.thirdPlaceId) : '')
    });
  });
  merged.sort((a,b)=>(Number(b.year || 0)-Number(a.year || 0)) || (Number(b.season || 0)-Number(a.season || 0)) || String(a.competitionName || '').localeCompare(String(b.competitionName || '')));
  return merged;
}
function renderChampionsHistory(){
  const entries = competitionChampionsHistoryEntries();
  const grouped = new Map();
  entries.forEach(entry => {
    const key = `${Number(entry.year || 0)} · Temp. ${Number(entry.season || 0)}`;
    if(!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(entry);
  });
  const blocks = Array.from(grouped.entries()).map(([label, items]) => {
    const rows = items.map(entry => {
      const extra = entry.type === 'club_world_cup'
        ? `${entry.runnerUpId ? `Subcampeón: ${escapeHtml(entry.runnerUpName || clubName(entry.runnerUpId))}` : ''}${entry.thirdPlaceId ? `${entry.runnerUpId ? ' · ' : ''}3°: ${escapeHtml(entry.thirdPlaceName || clubName(entry.thirdPlaceId))}` : ''}`
        : entry.type === 'international_cup' && entry.runnerUpId
          ? `Subcampeón: ${escapeHtml(entry.runnerUpName || clubName(entry.runnerUpId))}`
          : '';
      return `<tr>
        <td>${escapeHtml(entry.competitionName)}</td>
        <td>${clubLink(entry.championId)}</td>
        <td>${entry.type === 'club_world_cup' ? 'Mundial de Clubes' : entry.type === 'international_cup' ? 'Copa internacional' : entry.type === 'national_cup' ? 'Copa nacional' : entry.type === 'national_supercup' ? 'Supercopa' : 'Liga'}</td>
        <td class="muted small">${extra || '—'}</td>
      </tr>`;
    }).join('');
    return `<div class="card"><div class="row"><h3>${escapeHtml(label)}</h3><span class="pill">${items.length} competición(es)</span></div><div class="table-wrap"><table><thead><tr><th>Competición</th><th>Campeón</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Competiciones</h2><p class="tagline">Histórico de palmarés: ligas, copas nacionales, Libertadores, Champions League, supercopas y Mundial de Clubes por temporada.</p></div>
      ${competitionsNavMarkup('champions')}
    </div>
    <div class="stack">${blocks || '<div class="card"><p class="muted">Todavía no hay campeones guardados. El palmarés se completa al cerrar temporadas y al finalizar las competiciones internacionales.</p></div>'}</div>`;
  bindCompetitionsNav();
}
function renderStandings(){
  if(String(selectedCompetitionView || 'standings') === 'libertadores'){
    view.innerHTML = typeof libertadoresCompetitionMarkup === 'function' ? libertadoresCompetitionMarkup() : '<div class="card"><p class="muted">El módulo de Copa Libertadores no está disponible.</p></div>';
    bindCompetitionsNav();
    if(typeof bindLibertadoresCompetition === 'function') bindLibertadoresCompetition();
    return;
  }
  if(String(selectedCompetitionView || 'standings') === 'champions-league'){
    view.innerHTML = typeof championsLeagueCompetitionMarkup === 'function' ? championsLeagueCompetitionMarkup() : '<div class="card"><p class="muted">El módulo de Champions League no está disponible.</p></div>';
    bindCompetitionsNav();
    if(typeof bindChampionsLeagueCompetition === 'function') bindChampionsLeagueCompetition();
    return;
  }
  if(String(selectedCompetitionView || 'standings') === 'national-cups'){
    view.innerHTML = typeof nationalCupsCompetitionMarkup === 'function' ? nationalCupsCompetitionMarkup() : '<div class="card"><p class="muted">El módulo de copas nacionales no está disponible.</p></div>';
    bindCompetitionsNav();
    document.querySelectorAll('[data-match-id]').forEach(element => element.addEventListener('click', () => showMatchModal(element.dataset.matchId)));
    return;
  }
  if(String(selectedCompetitionView || 'standings') === 'club-ranking'){
    if(typeof renderClubFifaRanking === 'function') renderClubFifaRanking();
    else view.innerHTML = '<div class="card"><p class="muted">El ranking mundial de clubes no está disponible.</p></div>';
    return;
  }
  if(String(selectedCompetitionView || 'standings') === 'champions'){ renderChampionsHistory(); return; }
  if(String(selectedCompetitionView || 'standings') === 'player-ranking'){ renderCompetitionPlayerRanking(); return; }
  if(String(selectedCompetitionView || 'standings') === 'player-palmares'){ renderCompetitionPlayerPalmares(); return; }
  if(String(selectedCompetitionView || 'standings') === 'stats'){ renderStats(); return; }
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const managerDivision = typeof managerCurrentDivisionId === 'function' ? managerCurrentDivisionId() : (game?.selectedLeagueId || divisions[0]?.id || 'default');
  const currentKey = currentStandingsYearKey();
  const validYearKeys = new Set([currentKey, 'current', ...standingsHistoryEntries().map(entry => `history-${Number(entry.season || 0)}-${Number(entry.year || 0)}`)]);
  if(!validYearKeys.has(String(selectedStandingsYear || 'current'))) selectedStandingsYear = currentKey;
  if(selectedStandingsDivision !== 'all' && !divisions.some(d => d.id === selectedStandingsDivision)){
    selectedStandingsDivision = managerDivision;
  }
  const visibleDivisions = selectedStandingsDivision === 'all' ? divisions : divisions.filter(d => d.id === selectedStandingsDivision);
  const blocks = visibleDivisions.map(division => {
    const tableRows = standingsRowsForDisplay(division.id);
    const worldCupQuota = typeof clubWorldCupQualifierCountForDivision === 'function'
      ? clubWorldCupQualifierCountForDivision(division.id)
      : 0;
    const continentalProjection = standingsProjectedContinentalQualifiers(division, tableRows);
    const rows = tableRows.map((s,i)=>{
      const movementClass = standingsStatusClass(division.id, i, tableRows.length);
      const qualification = standingsQualificationInfo(division, s, i, continentalProjection);
      const ownClass = Number(s.clubId) === Number(game.selectedClubId) ? 'own-club-row' : '';
      const rowClasses = [ownClass, movementClass, ...qualification.classes].filter(Boolean).join(' ');
      return `<tr class="${rowClasses}"${qualification.title ? ` title="${escapeHtml(qualification.title)}"` : ''}>
        <td><strong>${i+1}</strong></td><td>${clubLink(s.clubId)}</td><td>${s.pj}</td><td>${s.pg}</td><td>${s.pe}</td><td>${s.pp}</td><td>${s.gf}</td><td>${s.gc}</td><td>${s.dg}</td><td><strong>${s.pts}</strong></td><td class="standings-qualification-cell">${standingsQualificationPills(qualification.items)}</td>
      </tr>`;
    }).join('');
    const qualificationLegend = standingsQualificationLegend(division, continentalProjection, worldCupQuota);
    return `<div class="card standings-division-card"><div class="row standings-division-head"><h3>${escapeHtml(division.name)}</h3>${qualificationLegend}</div><div class="table-wrap"><table class="standings-table-with-qualification"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th><th>DG</th><th>PTS</th><th>Clasificación</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Competiciones</h2><p class="tagline">Tablas de posiciones por liga y temporada.</p>${standingsDisplaySubtitle()}</div>
      <div class="row filters-row">${competitionsNavMarkup('standings')}${standingsYearOptionsMarkup(selectedStandingsYear)}${divisionFilterMarkup('standingsDivisionFilter', selectedStandingsDivision)}</div>
    </div>
    <div class="stack">${blocks || '<div class="card"><p class="muted">Sin datos para esta división.</p></div>'}</div>`;
  bindCompetitionsNav();
  $('standingsYearFilter')?.addEventListener('change', event => { selectedStandingsYear = event.target.value; renderStandings(); });
  $('standingsDivisionFilter')?.addEventListener('change', event => { selectedStandingsDivision = event.target.value; renderStandings(); });
}


function standingsStatusClass(divisionId, index, total){
  if(typeof argentineStandingStatusClass === 'function'){
    const argClass = argentineStandingStatusClass(divisionId, index);
    if(argClass) return argClass;
  }
  const divisions = divisionOrderList();
  const current = divisions.findIndex(d => d.id === divisionId);
  if(index === 0) return current > 0 ? 'promotion-row' : 'champion-row';
  if(index === total - 1 && current >= 0 && current < divisions.length - 1) return 'relegation-row';
  return '';
}

function renderManagerStats(){
  game.managerStats = normalizeManagerStats(game.managerStats);
  const totals = game.managerStats.totals;
  const seasons = game.managerStats.seasons.slice().sort((a,b)=>(b.season || 0)-(a.season || 0));
  const career = (game.managerStats.careerHistory || []).slice().sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')));
  const localExperience = Number(game.managerStats.experience || 0);
  const experience = typeof currentManagerExperience === 'function' ? currentManagerExperience() : localExperience;
  const unlockedAchievements = typeof managerUnlockedAchievements === 'function' ? managerUnlockedAchievements() : [];
  const achievementCatalog = typeof managerAchievementsCatalog === 'function' ? managerAchievementsCatalog() : unlockedAchievements;
  const achievementTotal = achievementCatalog.length;
  const unlockedAchievementIds = new Set(unlockedAchievements.map(item => String(item.id || '')));
  const achievementValueLabel = (item, value) => {
    const metric = String(item?.metrica || '');
    if(metric === 'currentBudget' || metric === 'academyYouthBenefits') return formatMoney(value);
    if(metric === 'bestSeasonPpg') return Number(value || 0).toFixed(2);
    return formatPlainNumber(Math.max(0, Number(value || 0)));
  };
  const achievementRows = achievementCatalog.map(item => {
    const unlocked = unlockedAchievementIds.has(String(item.id || ''));
    const currentValue = typeof managerAchievementMetricValue === 'function' ? managerAchievementMetricValue(item.metrica) : 0;
    const targetValue = Number(item.objetivo || 0);
    const progress = targetValue > 0 ? Math.max(0, Math.min(100, (Number(currentValue || 0) / targetValue) * 100)) : (unlocked ? 100 : 0);
    return `<div class="achievement-card ${unlocked ? 'achievement-unlocked-card' : 'achievement-locked-card'}">
      <span class="achievement-icon">${escapeHtml(item.icono || '★')}</span>
      <div class="achievement-card-copy"><div class="row achievement-card-head"><strong>${escapeHtml(item.titulo || 'Hito')}</strong><span class="pill">${unlocked ? 'Conseguido' : 'Pendiente'}</span></div>
      <p class="small muted">${escapeHtml(item.descripcion || '')}</p>
      <div class="achievement-progress"><span style="width:${progress.toFixed(2)}%"></span></div>
      <div class="row achievement-card-meta"><span class="pill">${escapeHtml(item.categoria || 'Manager')}</span><span class="small muted">${achievementValueLabel(item, currentValue)} / ${achievementValueLabel(item, targetValue)}</span></div></div>
    </div>`;
  }).join('');
  const rows = seasons.map(item => {
    const objectiveName = item.objectiveLabel ? escapeHtml(item.objectiveLabel) : (Number.isFinite(Number(item.objectivePpg)) ? Number(item.objectivePpg).toFixed(2) : '—');
    const objectiveLabel = Number.isFinite(Number(item.objectivePpg)) ? `${objectiveName} ${item.objectiveAchieved ? '<span class="ok">✓</span>' : '<span class="muted">×</span>'}` : objectiveName;
    const deltaLabel = Number.isFinite(Number(item.objectiveDelta)) ? ` <span class="small muted">${Number(item.objectiveDelta) >= 0 ? '+' : ''}${Number(item.objectiveDelta).toFixed(2)}</span>` : '';
    return `<tr>
    <td>${item.season}</td>
    <td>${clubBadge(item.clubId)} ${escapeHtml(item.clubName || clubName(item.clubId))}</td>
    <td>${escapeHtml(item.divisionName || '—')}</td>
    <td><strong>${escapeHtml(item.label || (item.position === 1 ? 'Campeón' : `${item.position || '—'}°`))}</strong></td>
    <td>${objectiveLabel}${deltaLabel}</td>
    <td>${Number(item.ppg || 0).toFixed(2)}</td>
    <td>${item.pts || 0}</td><td>${item.pg || 0}</td><td>${item.pe || 0}</td><td>${item.pp || 0}</td><td>${item.gf || 0}</td><td>${item.gc || 0}</td>
  </tr>`;
  }).join('');
  const careerRows = career.map(item => `<tr>
    <td>${item.season || '—'}</td>
    <td>${clubBadge(item.clubId)} ${escapeHtml(item.clubName || clubName(item.clubId))}</td>
    <td>${escapeHtml(item.divisionName || '—')}</td>
    <td>${item.position ? `${item.position}°` : '—'}</td>
    <td>${item.played || 0}</td>
    <td>${Number(item.ppg || 0).toFixed(2)}</td>
    <td>${escapeHtml(item.type === 'dismissal' ? 'Despido' : item.type || 'Cambio')}</td>
  </tr>`).join('');
  if(String(managerStatsViewMode || 'profile') === 'achievements'){
    const onlineMedals = typeof challengeOnlineMedalShelfMarkup === 'function' ? challengeOnlineMedalShelfMarkup() : '';
    view.innerHTML = `<div class="row section-title"><div><h2>Hitos</h2><p class="tagline">Desafíos conseguidos y pendientes de la carrera del manager.</p></div><span class="pill">${unlockedAchievements.length}/${achievementTotal || 0}</span></div>
      ${onlineMedals}
      <div class="card manager-achievements-card"><p class="muted small">Los hitos conseguidos se destacan. Los pendientes permanecen visibles con colores oscuros y desaturados.</p><div class="manager-achievements-grid">${achievementRows || '<p class="muted">No hay hitos configurados.</p>'}</div></div>`;
    if(typeof challengeEnsureOnlineMedalsLoaded === 'function') setTimeout(() => challengeEnsureOnlineMedalsLoaded(), 0);
    return;
  }
  view.innerHTML = `<div class="row section-title"><div><h2>Estadísticas de la carrera</h2><p class="tagline">Resultados acumulados del mánager en esta partida.</p></div></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Partidos</p><strong>${totals.played || 0}</strong></div>
      <div class="card"><p class="label">Ganados</p><strong>${totals.won || 0}</strong></div>
      <div class="card"><p class="label">Empatados</p><strong>${totals.drawn || 0}</strong></div>
      <div class="card"><p class="label">Perdidos</p><strong>${totals.lost || 0}</strong></div>
      <div class="card"><p class="label">GF / GC</p><strong>${totals.gf || 0} / ${totals.gc || 0}</strong></div>
      <div class="card"><p class="label">Títulos obtenidos</p><strong>${game.managerStats.titles || 0}</strong></div>
      <div class="card"><p class="label">Puntos de experiencia</p><strong>${experience}</strong><span class="small muted">Experiencia acumulada del perfil.</span></div>
      <div class="card"><p class="label">Hitos personales</p><strong>${unlockedAchievements.length}/${achievementTotal || 0}</strong><span class="small muted">Conseguidos y pendientes.</span></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Finales de temporada</h3>
      <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Club</th><th>División</th><th>Posición</th><th>Objetivo</th><th>PPG</th><th>PTS</th><th>PG</th><th>PE</th><th>PP</th><th>GF</th><th>GC</th></tr></thead><tbody>${rows || '<tr><td colspan="12" class="muted">Aún no finalizaste ninguna temporada.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Carrera laboral</h3>
      <div class="table-wrap"><table><thead><tr><th>Temp.</th><th>Club</th><th>División</th><th>Posición</th><th>PJ</th><th>PPG</th><th>Evento</th></tr></thead><tbody>${careerRows || '<tr><td colspan="7" class="muted">Sin cambios de club todavía.</td></tr>'}</tbody></table></div>
    </div>`;
}


function competitionPlayerRankingAverage(stat){
  const ratedMatches = Math.max(0, Math.round(Number(stat?.ratedMatches || 0)));
  const ratingTotal = Math.max(0, Number(stat?.ratingTotal || 0));
  return ratedMatches > 0 ? ratingTotal / ratedMatches : null;
}
function competitionPlayerRankingScopeStats(scope=competitionPlayerRankingScope){
  const career = String(scope || 'season') === 'career';
  const source = career ? game?.playerCareerStats : game?.playerStats;
  return source && typeof source === 'object' && !Array.isArray(source) ? source : {};
}
function competitionPlayerRankingScopeLabel(scope=competitionPlayerRankingScope){
  return String(scope || 'season') === 'career' ? 'Toda la carrera' : 'Temporada actual';
}
function competitionPlayerRankingEntries(scope=competitionPlayerRankingScope){
  if(!game || !seed) return [];
  const statsByPlayer = competitionPlayerRankingScopeStats(scope);
  return (seed.players || []).map(player => {
    const playerId = Number(player?.id || 0);
    const clubId = Number(player?.clubId || 0);
    const stat = statsByPlayer[playerId] || null;
    const played = Math.max(0, Math.round(Number(stat?.played || 0)));
    if(!playerId || !clubId || played <= 0 || player?.freeAgent || player?.youthFreeAgent || player?.retired || player?.sold) return null;
    return {
      playerId,
      name:String(player?.name || 'Jugador'),
      clubId,
      clubName:clubName(clubId),
      played,
      goals:Math.max(0, Math.round(Number(stat?.goals || 0))),
      assists:Math.max(0, Math.round(Number(stat?.assists || 0))),
      rating:competitionPlayerRankingAverage(stat),
      ratedMatches:Math.max(0, Math.round(Number(stat?.ratedMatches || 0)))
    };
  }).filter(Boolean);
}
function competitionPlayerRankingSortComparator(sortKey='rating_desc'){
  const byName = (a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' });
  const byClub = (a,b) => String(a.clubName || '').localeCompare(String(b.clubName || ''), 'es', { sensitivity:'base' });
  const byRating = (a,b) => Number(b.rating ?? -1) - Number(a.rating ?? -1)
    || Number(b.ratedMatches || 0) - Number(a.ratedMatches || 0)
    || Number(b.played || 0) - Number(a.played || 0)
    || Number(b.goals || 0) - Number(a.goals || 0)
    || Number(b.assists || 0) - Number(a.assists || 0)
    || byName(a,b);
  const sorters = {
    rating_desc:byRating,
    played_desc:(a,b) => Number(b.played || 0) - Number(a.played || 0) || byRating(a,b),
    goals_desc:(a,b) => Number(b.goals || 0) - Number(a.goals || 0) || Number(b.assists || 0) - Number(a.assists || 0) || byRating(a,b),
    assists_desc:(a,b) => Number(b.assists || 0) - Number(a.assists || 0) || Number(b.goals || 0) - Number(a.goals || 0) || byRating(a,b),
    name_asc:(a,b) => byName(a,b) || byClub(a,b),
    club_asc:(a,b) => byClub(a,b) || byName(a,b)
  };
  return sorters[String(sortKey || 'rating_desc')] || byRating;
}
function competitionPlayerRankingScoreLabel(entry){
  return entry?.rating !== null && entry?.rating !== undefined && Number.isFinite(Number(entry.rating)) ? Number(entry.rating).toFixed(2).replace('.', ',') : '—';
}
function competitionPlayerRankingPositionMarkup(position){
  const rank = Math.max(1, Math.round(Number(position || 1)));
  const tone = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
  return `<span class="competition-player-rank-number ${tone}">${rank}</span>`;
}
function competitionPlayerRankingScopeMarkup(){
  const current = String(competitionPlayerRankingScope || 'season') === 'career' ? 'career' : 'season';
  return `<div class="competition-player-ranking-scope" role="group" aria-label="Período del ranking">
    <button type="button" data-player-ranking-scope="season" class="${current === 'season' ? 'primary' : 'ghost'}" aria-pressed="${current === 'season'}">Temporada</button>
    <button type="button" data-player-ranking-scope="career" class="${current === 'career' ? 'primary' : 'ghost'}" aria-pressed="${current === 'career'}">Toda la carrera</button>
  </div>`;
}
function renderCompetitionPlayerRanking(){
  const allowedSorts = new Set(['rating_desc','played_desc','goals_desc','assists_desc','name_asc','club_asc']);
  if(!allowedSorts.has(String(competitionPlayerRankingSort || ''))) competitionPlayerRankingSort = 'rating_desc';
  if(!['season','career'].includes(String(competitionPlayerRankingScope || ''))) competitionPlayerRankingScope = 'season';
  const scopeLabel = competitionPlayerRankingScopeLabel(competitionPlayerRankingScope);
  const allEntries = competitionPlayerRankingEntries(competitionPlayerRankingScope);
  const entries = allEntries.slice().sort(competitionPlayerRankingSortComparator(competitionPlayerRankingSort)).slice(0,100);
  const rows = entries.map((entry,index) => {
    const own = Number(entry.clubId) === Number(game?.selectedClubId || 0);
    return `<tr class="${own ? 'own-club-row competition-player-ranking-own' : ''}">
      <td>${competitionPlayerRankingPositionMarkup(index + 1)}</td>
      <td><button type="button" class="linklike" data-player-id="${entry.playerId}"><strong>${escapeHtml(entry.name)}</strong></button></td>
      <td>${clubLink(entry.clubId)}</td>
      <td><strong>${entry.played}</strong></td>
      <td><strong>${entry.goals}</strong></td>
      <td><strong>${entry.assists}</strong></td>
      <td class="competition-player-score"><strong>${competitionPlayerRankingScoreLabel(entry)}</strong><span>${entry.ratedMatches} partido(s) puntuado(s)</span></td>
    </tr>`;
  }).join('');
  const description = competitionPlayerRankingScope === 'career'
    ? 'Top 100 acumulado de toda la carrera de los jugadores activos. El puntaje general corresponde al promedio de todas sus calificaciones oficiales.'
    : 'Top 100 de la temporada actual. El puntaje general corresponde al promedio de las calificaciones obtenidas en los partidos disputados.';
  const emptyLabel = competitionPlayerRankingScope === 'career'
    ? 'Todavía no hay jugadores activos con partidos registrados en su carrera.'
    : 'Todavía no hay jugadores con partidos registrados en esta temporada.';
  view.innerHTML = `
    <div class="row section-title competition-player-ranking-title">
      <div><h2>Ranking de jugadores</h2><p class="tagline">${description}</p></div>
      <div class="row filters-row competition-player-ranking-controls">
        ${competitionsNavMarkup('player-ranking')}
        <label class="competition-player-ranking-sort"><span>Ordenar</span><select id="competitionPlayerRankingSort">
          <option value="rating_desc" ${competitionPlayerRankingSort === 'rating_desc' ? 'selected' : ''}>Puntaje general</option>
          <option value="played_desc" ${competitionPlayerRankingSort === 'played_desc' ? 'selected' : ''}>Partidos jugados</option>
          <option value="goals_desc" ${competitionPlayerRankingSort === 'goals_desc' ? 'selected' : ''}>Goles</option>
          <option value="assists_desc" ${competitionPlayerRankingSort === 'assists_desc' ? 'selected' : ''}>Asistencias</option>
          <option value="name_asc" ${competitionPlayerRankingSort === 'name_asc' ? 'selected' : ''}>Nombre</option>
          <option value="club_asc" ${competitionPlayerRankingSort === 'club_asc' ? 'selected' : ''}>Club actual</option>
        </select></label>
      </div>
    </div>
    <div class="card competition-player-ranking-card">
      <div class="row competition-player-ranking-summary">
        <div><h3>Top 100</h3><span class="small muted">${scopeLabel}</span></div>
        ${competitionPlayerRankingScopeMarkup()}
        <span class="pill">${entries.length} de ${allEntries.length} jugadores con partidos</span>
      </div>
      <div class="table-wrap"><table class="competition-player-ranking-table"><thead><tr><th>#</th><th>Nombre</th><th>Club actual</th><th>PJ</th><th>Goles</th><th>Asistencias</th><th>Puntaje general</th></tr></thead><tbody>${rows || `<tr><td colspan="7" class="muted">${emptyLabel}</td></tr>`}</tbody></table></div>
    </div>`;
  bindCompetitionsNav();
  $('competitionPlayerRankingSort')?.addEventListener('change', event => {
    competitionPlayerRankingSort = event.target.value;
    selectedCompetitionView = 'player-ranking';
    renderCompetitionPlayerRanking();
  });
  document.querySelectorAll('[data-player-ranking-scope]').forEach(button => {
    button.addEventListener('click', () => {
      const nextScope = String(button.dataset.playerRankingScope || 'season');
      if(!['season','career'].includes(nextScope) || nextScope === competitionPlayerRankingScope) return;
      competitionPlayerRankingScope = nextScope;
      selectedCompetitionView = 'player-ranking';
      renderCompetitionPlayerRanking();
    });
  });
}


function competitionPlayerPalmaresEntries(){
  if(!game || !seed) return [];
  game.playerPalmares = typeof normalizePlayerPalmaresState === 'function'
    ? normalizePlayerPalmaresState(game.playerPalmares || {})
    : (game.playerPalmares || { byPlayerId:{} });
  const activePlayers = new Map((seed.players || [])
    .filter(player => player && Number(player.id || 0) > 0 && !player.retired && !player.sold)
    .map(player => [Number(player.id), player]));
  return Object.values(game.playerPalmares.byPlayerId || {}).map(raw => {
    const playerId = Number(raw?.playerId || 0);
    const player = activePlayers.get(playerId);
    if(!player) return null;
    const record = typeof normalizePlayerPalmaresRecord === 'function' ? normalizePlayerPalmaresRecord(raw, playerId) : raw;
    const total = Math.max(0, Math.round(Number(record?.total || 0)));
    if(!record || total <= 0) return null;
    const clubId = Math.max(0, Math.round(Number(player.clubId || 0)));
    return {
      playerId,
      name:String(player.name || 'Jugador'),
      clubId,
      clubName:clubId > 0 ? clubName(clubId) : 'Libre',
      leagues:Math.max(0, Math.round(Number(record.leagues || 0))),
      nationalCups:Math.max(0, Math.round(Number(record.nationalCups || 0))),
      internationalCups:Math.max(0, Math.round(Number(record.internationalCups || 0))),
      clubWorldCups:Math.max(0, Math.round(Number(record.clubWorldCups || 0))),
      total,
      awards:Array.isArray(record.awards) ? record.awards.slice() : []
    };
  }).filter(Boolean);
}
function competitionPlayerPalmaresSortComparator(sortKey='total_desc'){
  const byName = (a,b) => String(a.name || '').localeCompare(String(b.name || ''), 'es', { sensitivity:'base' });
  const byClub = (a,b) => String(a.clubName || '').localeCompare(String(b.clubName || ''), 'es', { sensitivity:'base' });
  const byTotal = (a,b) => Number(b.total || 0) - Number(a.total || 0)
    || Number(b.clubWorldCups || 0) - Number(a.clubWorldCups || 0)
    || Number(b.internationalCups || 0) - Number(a.internationalCups || 0)
    || Number(b.leagues || 0) - Number(a.leagues || 0)
    || Number(b.nationalCups || 0) - Number(a.nationalCups || 0)
    || byName(a,b);
  const sorters = {
    total_desc:byTotal,
    leagues_desc:(a,b) => Number(b.leagues || 0) - Number(a.leagues || 0) || byTotal(a,b),
    national_cups_desc:(a,b) => Number(b.nationalCups || 0) - Number(a.nationalCups || 0) || byTotal(a,b),
    international_cups_desc:(a,b) => Number(b.internationalCups || 0) - Number(a.internationalCups || 0) || byTotal(a,b),
    club_world_cups_desc:(a,b) => Number(b.clubWorldCups || 0) - Number(a.clubWorldCups || 0) || byTotal(a,b),
    name_asc:(a,b) => byName(a,b) || byClub(a,b),
    club_asc:(a,b) => byClub(a,b) || byName(a,b)
  };
  return sorters[String(sortKey || 'total_desc')] || byTotal;
}
function competitionPlayerPalmaresClubMarkup(entry){
  return Number(entry?.clubId || 0) > 0 ? clubLink(entry.clubId) : '<span class="pill">Libre</span>';
}
function competitionPlayerPalmaresDetail(entry){
  return (entry?.awards || []).slice().sort((a,b)=>Number(b.year || 0)-Number(a.year || 0) || String(a.competitionName || '').localeCompare(String(b.competitionName || ''), 'es', { sensitivity:'base' }))
    .map(award => `${Number(award.year || award.season || 0)} · ${String(award.competitionName || award.competitionId || 'Título')}`)
    .join('\n');
}
function renderCompetitionPlayerPalmares(){
  const allowedSorts = new Set(['total_desc','leagues_desc','national_cups_desc','international_cups_desc','club_world_cups_desc','name_asc','club_asc']);
  if(!allowedSorts.has(String(competitionPlayerPalmaresSort || ''))) competitionPlayerPalmaresSort = 'total_desc';
  const allEntries = competitionPlayerPalmaresEntries();
  const entries = allEntries.slice().sort(competitionPlayerPalmaresSortComparator(competitionPlayerPalmaresSort)).slice(0,100);
  const rows = entries.map((entry,index) => {
    const own = Number(entry.clubId || 0) === Number(game?.selectedClubId || 0);
    const detail = competitionPlayerPalmaresDetail(entry);
    return `<tr class="${own ? 'own-club-row competition-player-palmares-own' : ''}">
      <td>${competitionPlayerRankingPositionMarkup(index + 1)}</td>
      <td><button type="button" class="linklike" data-player-id="${entry.playerId}"><strong>${escapeHtml(entry.name)}</strong></button></td>
      <td>${competitionPlayerPalmaresClubMarkup(entry)}</td>
      <td class="competition-player-palmares-total"><strong title="${escapeHtml(detail)}">${entry.total}</strong></td>
      <td>${entry.leagues}</td>
      <td>${entry.nationalCups}</td>
      <td>${entry.internationalCups}</td>
      <td>${entry.clubWorldCups}</td>
    </tr>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title competition-player-palmares-title">
      <div><h2>Palmarés de jugadores</h2><p class="tagline">Los 100 futbolistas activos con más títulos oficiales acumulados durante su carrera.</p></div>
      <div class="row filters-row competition-player-palmares-controls">
        ${competitionsNavMarkup('player-palmares')}
        <label class="competition-player-palmares-sort"><span>Ordenar</span><select id="competitionPlayerPalmaresSort">
          <option value="total_desc" ${competitionPlayerPalmaresSort === 'total_desc' ? 'selected' : ''}>Total de títulos</option>
          <option value="leagues_desc" ${competitionPlayerPalmaresSort === 'leagues_desc' ? 'selected' : ''}>Ligas</option>
          <option value="national_cups_desc" ${competitionPlayerPalmaresSort === 'national_cups_desc' ? 'selected' : ''}>Copas nacionales</option>
          <option value="international_cups_desc" ${competitionPlayerPalmaresSort === 'international_cups_desc' ? 'selected' : ''}>Copas internacionales</option>
          <option value="club_world_cups_desc" ${competitionPlayerPalmaresSort === 'club_world_cups_desc' ? 'selected' : ''}>Mundial de Clubes</option>
          <option value="name_asc" ${competitionPlayerPalmaresSort === 'name_asc' ? 'selected' : ''}>Nombre</option>
          <option value="club_asc" ${competitionPlayerPalmaresSort === 'club_asc' ? 'selected' : ''}>Club actual</option>
        </select></label>
      </div>
    </div>
    <div class="card competition-player-palmares-card">
      <div class="row competition-player-palmares-summary"><h3>Jugadores con más títulos</h3><span class="pill">${entries.length} de ${allEntries.length} campeones activos</span></div>
      <div class="table-wrap"><table class="competition-player-palmares-table"><thead><tr><th>#</th><th>Nombre</th><th>Club actual</th><th>Total</th><th>Ligas</th><th>Copas nacionales</th><th>Copas internacionales</th><th>Mundial de Clubes</th></tr></thead><tbody>${rows || '<tr><td colspan="8" class="muted">Todavía no hay títulos registrados para jugadores activos. El palmarés se completa cuando finaliza cada competición.</td></tr>'}</tbody></table></div>
      <p class="muted small competition-player-palmares-note">Los títulos se acreditan al plantel activo del club en el momento de la consagración. Al retirarse un jugador, su palmarés y sus estadísticas se eliminan; una futura reaparición juvenil comienza desde cero.</p>
    </div>`;
  bindCompetitionsNav();
  $('competitionPlayerPalmaresSort')?.addEventListener('change', event => {
    competitionPlayerPalmaresSort = event.target.value;
    selectedCompetitionView = 'player-palmares';
    renderCompetitionPlayerPalmares();
  });
}

function renderStats(){
  const divisions = seed.divisions || [{ id:'default', name:'Liga única' }];
  const managerDivision = typeof managerCurrentDivisionId === 'function' ? managerCurrentDivisionId() : (game?.selectedLeagueId || divisions[0]?.id || 'default');
  if(selectedStatsDivision !== 'all' && !divisions.some(d => d.id === selectedStatsDivision)){
    selectedStatsDivision = managerDivision;
  }
  const visibleDivisions = selectedStatsDivision === 'all' ? divisions : divisions.filter(d => d.id === selectedStatsDivision);
  const blocks = visibleDivisions.map(division => {
    const allowedClubs = new Set(seed.clubs.filter(c => (c.divisionId || 'default') === division.id).map(c => c.id));
    const stats = Object.values(game.playerStats).filter(s => allowedClubs.has(s.clubId));
    const scorers = stats.filter(s=>s.goals>0).sort((a,b)=>b.goals-a.goals).slice(0,20);
    const assists = stats.filter(s=>s.assists>0).sort((a,b)=>b.assists-a.assists).slice(0,20);
    const cards = stats.filter(s=>s.yellow>0 || s.red>0).sort((a,b)=>(b.red*3+b.yellow)-(a.red*3+a.yellow)).slice(0,20);
    const injuries = stats.filter(s=>s.injuries>0).sort((a,b)=>b.injuries-a.injuries).slice(0,20);
    return `<div class="card stats-division-block"><h3>${escapeHtml(division.name)}</h3><div class="grid cols-4">
      <div class="card inner"><h3>Goleadores</h3>${rankList(scorers,'goals')}</div>
      <div class="card inner"><h3>Asistidores</h3>${rankList(assists,'assists')}</div>
      <div class="card inner"><h3>Tarjetas</h3>${cardList(cards)}</div>
      <div class="card inner"><h3>Lesiones</h3>${rankList(injuries,'injuries')}</div>
    </div></div>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title">
      <div><h2>Estadísticas de competiciones</h2><p class="tagline">Goleadores, asistidores, tarjetas y lesiones por división.</p></div>
      <div class="row filters-row">${competitionsNavMarkup('stats')}${divisionFilterMarkup('statsDivisionFilter', selectedStatsDivision)}</div>
    </div>
    <div class="stack">${blocks || '<div class="card"><p class="muted">Sin datos para esta división.</p></div>'}</div>
  `;
  bindCompetitionsNav();
  $('statsDivisionFilter')?.addEventListener('change', event => { selectedStatsDivision = event.target.value; selectedCompetitionView = 'stats'; renderStats(); });
}
function rankList(list,key){
  if(!list.length) return '<p class="muted">Sin datos todavía.</p>';
  return list.map((s,i)=>{ const p=playerById(s.playerId); return `<div class="stat-rank ${s.clubId===game.selectedClubId ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span><button class="linklike" data-player-id="${s.playerId}">${escapeHtml(p?.name||'Jugador')}</button> <span class="pill ${s.clubId===game.selectedClubId ? 'club-pill-own' : ''}">${clubBadge(s.clubId)}</span></span><strong>${s[key]}</strong></div>`; }).join('');
}
function cardList(list){
  if(!list.length) return '<p class="muted">Sin tarjetas todavía.</p>';
  return list.map((s,i)=>{ const p=playerById(s.playerId); return `<div class="stat-rank ${s.clubId===game.selectedClubId ? 'own-player-rank' : ''}"><span><span class="rank-num">${i+1}</span><button class="linklike" data-player-id="${s.playerId}">${escapeHtml(p?.name||'Jugador')}</button> <span class="pill ${s.clubId===game.selectedClubId ? 'club-pill-own' : ''}">${clubBadge(s.clubId)}</span></span><strong><span class="yellow-card">■</span> ${s.yellow} / <span class="red-card">■</span> ${s.red}</strong></div>`; }).join('');
}
function sortedStandings(divisionId=null){
  if(!game) return [];
  const allowed = divisionId ? new Set(seed.clubs.filter(c => (c.divisionId || 'default') === divisionId).map(c => c.id)) : null;
  return Object.values(game.standings)
    .filter(s => !allowed || allowed.has(s.clubId))
    .sort((a,b)=> b.pts-a.pts || b.dg-a.dg || b.gf-a.gf || clubName(a.clubId).localeCompare(clubName(b.clubId)) );
}
