/* V8.80 · Ofertas laborales durante contratos activos.
   Extiende el mercado laboral existente sin reemplazar el perfil de carrera,
   la negociación contractual ni el flujo para managers sin club. */

(function(){
  'use strict';

  const EMPLOYED_OFFER_SOURCE = 'incoming_employed';

  function employedOfferConfig(){
    const source = window.GAME_BALANCE_MANAGER?.contratosManager?.mercadoLaboralRealista?.ofertasDuranteContrato;
    const cfg = source && typeof source === 'object' && !Array.isArray(source) ? source : {};
    return {
      active:cfg.activo !== false,
      initialMin:Math.max(10, Math.round(Number(cfg.esperaInicialMinDias ?? 25))),
      initialMax:Math.max(10, Math.round(Number(cfg.esperaInicialMaxDias ?? 55))),
      intervalMin:Math.max(15, Math.round(Number(cfg.esperaEntreOfertasMinDias ?? 35))),
      intervalMax:Math.max(15, Math.round(Number(cfg.esperaEntreOfertasMaxDias ?? 75))),
      maxPerSeason:Math.max(1, Math.round(Number(cfg.maximoPorTemporada ?? 4))),
      maxActive:Math.max(1, Math.round(Number(cfg.maximoActivas ?? 2))),
      deadlineMin:Math.max(5, Math.round(Number(cfg.plazoMinimoDias ?? 10))),
      deadlineMax:Math.max(10, Math.round(Number(cfg.plazoMaximoDias ?? 30)))
    };
  }

  function currentJobSeason(){
    return Math.max(1, Math.round(Number(game?.seasonNumber || 1)));
  }

  function employedOfferCountMap(raw={}){
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const clean = {};
    Object.entries(source).forEach(([seasonKey, value]) => {
      const season = Math.max(1, Math.round(Number(seasonKey || 0)));
      const count = Math.max(0, Math.round(Number(value || 0)));
      if(season && count) clean[String(season)] = count;
    });
    return clean;
  }

  function deterministicRange(minimum, maximum, key){
    const min = Math.min(minimum, maximum);
    const max = Math.max(minimum, maximum);
    const span = Math.max(1, max - min + 1);
    const offset = typeof hashNumber === 'function' ? hashNumber(String(key || ''), span) : 0;
    return min + offset;
  }

  function offerCalendarContext(day=typeof currentSeasonDayNumber === 'function' ? currentSeasonDayNumber() : 1){
    const value = Math.max(1, Math.round(Number(day || 1)));
    if(value <= 30) return { key:'preseason', label:'Pretemporada', pressure:4 };
    if(value >= 145 && value <= 180) return { key:'midseason', label:'Mitad de temporada', pressure:3 };
    if(value >= 285) return { key:'season_end', label:'Cierre de temporada', pressure:6 };
    return { key:'regular', label:'Temporada regular', pressure:0 };
  }

  function offerUrgency(clubOrId){
    const standing = typeof managerJobClubStandingProfile === 'function'
      ? managerJobClubStandingProfile(clubOrId)
      : { ratio:0.5, position:0, total:0 };
    const ratio = Math.max(0, Math.min(1, Number(standing?.ratio || 0.5)));
    if(ratio >= 0.85) return { key:'critical', label:'Urgencia crítica', level:3, reduction:10, standing };
    if(ratio >= 0.70) return { key:'high', label:'Urgencia alta', level:2, reduction:7, standing };
    if(ratio >= 0.55) return { key:'medium', label:'Urgencia media', level:1, reduction:4, standing };
    return { key:'normal', label:'Proyecto planificado', level:0, reduction:0, standing };
  }

  function employedOfferResponseTerms(clubOrId){
    const cfg = employedOfferConfig();
    const clubId = Number(typeof clubOrId === 'object' ? clubOrId?.id : clubOrId || 0);
    const urgency = offerUrgency(clubOrId);
    const calendar = offerCalendarContext();
    const jitter = deterministicRange(-2, 2, `job-deadline:${game?.saveCode || ''}:${currentJobSeason()}:${game?.globalTurn || 0}:${clubId}`);
    const days = Math.max(cfg.deadlineMin, Math.min(cfg.deadlineMax, cfg.deadlineMax - urgency.reduction - calendar.pressure + jitter));
    return { days, urgency, calendar };
  }
  window.managerJobEmployedOfferResponseTerms = employedOfferResponseTerms;

  if(typeof normalizeManagerJobMarketState === 'function'){
    const normalizeManagerJobMarketStateV880 = normalizeManagerJobMarketState;
    normalizeManagerJobMarketState = function(state={}){
      const raw = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
      const normalized = normalizeManagerJobMarketStateV880(state);
      const rawOffers = Array.isArray(raw.offers) ? raw.offers : [];
      normalized.offers = (normalized.offers || []).map(offer => {
        const previous = rawOffers.find(item => String(item?.id || '') === String(offer.id || '')) || {};
        const responseDays = Math.max(10, Math.min(30, Math.round(Number(previous.responseDays || offer.responseDays || (validIsoDate(offer.createdDate) && validIsoDate(offer.expiresDate) ? daysBetweenIsoDates(offer.createdDate, offer.expiresDate) : 20)))));
        return {
          ...offer,
          responseDays,
          urgencyKey:String(previous.urgencyKey || offer.urgencyKey || ''),
          urgencyLabel:String(previous.urgencyLabel || offer.urgencyLabel || ''),
          calendarContext:String(previous.calendarContext || offer.calendarContext || ''),
          currentClubAtOffer:Math.max(0, Math.round(Number(previous.currentClubAtOffer || offer.currentClubAtOffer || 0)))
        };
      });
      normalized.employedOffersGeneratedBySeason = employedOfferCountMap(raw.employedOffersGeneratedBySeason || normalized.employedOffersGeneratedBySeason);
      normalized.lastEmployedOfferDate = validIsoDate(raw.lastEmployedOfferDate) ? raw.lastEmployedOfferDate : null;
      normalized.lastEmployedClubId = Math.max(0, Math.round(Number(raw.lastEmployedClubId || 0)));
      return normalized;
    };
  }

  if(typeof managerJobScheduleNextIncomingOffer === 'function'){
    const managerJobScheduleNextIncomingOfferV880 = managerJobScheduleNextIncomingOffer;
    managerJobScheduleNextIncomingOffer = function(fromDate=typeof currentCalendarDate === 'function' ? currentCalendarDate() : game?.currentDate || ''){
      if(game?.gameOver?.active) return managerJobScheduleNextIncomingOfferV880(fromDate);
      const cfg = employedOfferConfig();
      if(!cfg.active || !game?.selectedClubId) return null;
      const state = ensureManagerJobMarketState();
      const season = currentJobSeason();
      const count = Number(state.employedOffersGeneratedBySeason?.[String(season)] || 0);
      if(count >= cfg.maxPerSeason){
        state.nextIncomingOfferDate = null;
        return null;
      }
      const base = validIsoDate(fromDate) ? fromDate : currentCalendarDate();
      const first = !validIsoDate(state.lastEmployedOfferDate);
      const minimum = first ? cfg.initialMin : cfg.intervalMin;
      const maximum = first ? cfg.initialMax : cfg.intervalMax;
      const offset = deterministicRange(minimum, maximum, `employed-job-wait:${game?.saveCode || ''}:${season}:${game?.globalTurn || 0}:${game?.selectedClubId || 0}:${base}:${count}`);
      state.nextIncomingOfferDate = addDaysToIsoDate(base, offset);
      return state.nextIncomingOfferDate;
    };
  }

  if(typeof managerJobCreateOffer === 'function'){
    const managerJobCreateOfferV880 = managerJobCreateOffer;
    managerJobCreateOffer = function(clubId, options={}){
      const employed = !game?.gameOver?.active;
      const response = employed && options.allowWhileEmployed === true
        ? (options.responseTerms || employedOfferResponseTerms(clubId))
        : null;
      const responseDays = Math.max(10, Math.min(30, Math.round(Number(options.responseDays || response?.days || 20))));
      const offer = managerJobCreateOfferV880(clubId, { ...options, responseDays });
      if(!offer) return offer;
      offer.responseDays = responseDays;
      if(response){
        offer.urgencyKey = response.urgency.key;
        offer.urgencyLabel = response.urgency.label;
        offer.calendarContext = response.calendar.label;
        offer.currentClubAtOffer = Number(game?.selectedClubId || 0);
        offer.expiresDate = addDaysToIsoDate(offer.createdDate || currentCalendarDate(), responseDays);
      }
      return offer;
    };
  }

  function expireEmployedOffers(state, today){
    let expired = 0;
    const expiredClubs = [];
    state.offers = (state.offers || []).filter(offer => {
      if(validIsoDate(offer.expiresDate) && daysBetweenIsoDates(offer.expiresDate, today) > 0){
        expired += 1;
        expiredClubs.push(clubName(offer.clubId));
        return false;
      }
      return true;
    });
    if(expired){
      pushGameMessage({
        type:'directiva',
        priority:'normal',
        title:expired === 1 ? 'El club retiró su propuesta' : 'Los clubes retiraron sus propuestas',
        body:expired === 1
          ? `${expiredClubs[0] || 'El club interesado'} decidió retirar la propuesta después de no recibir una respuesta dentro del plazo.`
          : `${expired} clubes decidieron retirar sus propuestas después de no recibir una respuesta dentro del plazo.`,
        id:`employed-job-offers-expired-${today}-${game?.globalTurn || 0}`
      });
    }
    return expired;
  }

  if(typeof processManagerJobMarketDaily === 'function'){
    const processManagerJobMarketDailyV880 = processManagerJobMarketDaily;
    processManagerJobMarketDaily = function(){
      if(game?.gameOver?.active) return processManagerJobMarketDailyV880();
      const cfg = employedOfferConfig();
      if(!cfg.active || !game?.selectedClubId) return { offers:0, expired:0, applications:0 };
      let state = ensureManagerJobMarketState();
      const today = currentCalendarDate();
      if(state.lastProcessedDate === today) return { offers:0, expired:0, applications:0, repeated:true };
      const previousOffers = state.offers.length;
      const expired = expireEmployedOffers(state, today);
      const season = currentJobSeason();
      state.employedOffersGeneratedBySeason = employedOfferCountMap(state.employedOffersGeneratedBySeason);
      Object.keys(state.employedOffersGeneratedBySeason).forEach(key => {
        if(Number(key) < season - 2) delete state.employedOffersGeneratedBySeason[key];
      });
      const generated = Number(state.employedOffersGeneratedBySeason[String(season)] || 0);
      const activeEmployed = state.offers.filter(offer => String(offer.source || '') === EMPLOYED_OFFER_SOURCE).length;
      if(!state.nextIncomingOfferDate && generated < cfg.maxPerSeason) managerJobScheduleNextIncomingOffer(today);

      let offers = 0;
      const due = validIsoDate(state.nextIncomingOfferDate) && daysBetweenIsoDates(state.nextIncomingOfferDate, today) >= 0;
      if(due){
        if(generated < cfg.maxPerSeason && activeEmployed < cfg.maxActive){
          const club = typeof managerJobIncomingOfferClub === 'function' ? managerJobIncomingOfferClub() : null;
          if(club){
            const responseTerms = employedOfferResponseTerms(club);
            const offer = managerJobCreateOffer(club.id, {
              source:EMPLOYED_OFFER_SOURCE,
              contractType:'normal',
              allowWhileEmployed:true,
              responseDays:responseTerms.days,
              responseTerms,
              note:'El club contactó al manager mientras tenía contrato vigente.'
            });
            if(offer){
              offers = 1;
              state = ensureManagerJobMarketState();
              state.employedOffersGeneratedBySeason = employedOfferCountMap(state.employedOffersGeneratedBySeason);
              state.employedOffersGeneratedBySeason[String(season)] = generated + 1;
              state.lastEmployedOfferDate = today;
              state.lastEmployedClubId = Number(game.selectedClubId || 0);
              pushGameMessage({
                type:'directiva',
                priority:'high',
                title:'Nueva oferta laboral',
                body:`${club.name} quiere contratarte aunque actualmente dirigís a ${clubName(game.selectedClubId)}. La propuesta responde a una situación de ${responseTerms.urgency.label.toLowerCase()} y vence en ${responseTerms.days} días (${offer.expiresDate}). Revisala en Carrera → Ofertas laborales.`,
                id:`employed-job-offer-${club.id}-${today}`
              });
            }
          }
        }
        state.nextIncomingOfferDate = null;
        managerJobScheduleNextIncomingOffer(today);
      }
      state = ensureManagerJobMarketState();
      state.lastProcessedDate = today;
      state.lastDailyResult = { offers, expired, applications:0, previousOffers };
      return state.lastDailyResult;
    };
  }

  if(typeof managerJobOfferCard === 'function'){
    const managerJobOfferCardV880 = managerJobOfferCard;
    managerJobOfferCard = function(offer){
      let html = managerJobOfferCardV880(offer);
      if(!html || String(offer?.source || '') !== EMPLOYED_OFFER_SOURCE) return html;
      const today = typeof currentCalendarDate === 'function' ? currentCalendarDate() : game?.currentDate || '';
      const remaining = validIsoDate(today) && validIsoDate(offer.expiresDate) ? Math.max(0, daysBetweenIsoDates(today, offer.expiresDate)) : Number(offer.responseDays || 0);
      const context = `<div class="job-offer-context"><span class="pill ${offer.urgencyKey === 'critical' ? 'danger' : offer.urgencyKey === 'high' ? 'warn' : 'neutral'}">${escapeHtml(offer.urgencyLabel || 'Oferta activa')}</span><span>${remaining} día${remaining === 1 ? '' : 's'} para responder</span><span>${escapeHtml(offer.calendarContext || 'Calendario regular')}</span></div>`;
      return html.replace('<p class="muted small">', `${context}<p class="muted small">`);
    };
  }

  if(typeof renderCareerJobs === 'function'){
    const renderCareerJobsV880 = renderCareerJobs;
    renderCareerJobs = function(){
      const result = renderCareerJobsV880();
      if(game?.gameOver?.active || !view) return result;
      const state = ensureManagerJobMarketState();
      const offers = (state.offers || []).slice().sort((a,b) => String(a.expiresDate || '').localeCompare(String(b.expiresDate || '')));
      const nextDate = state.nextIncomingOfferDate && validIsoDate(state.nextIncomingOfferDate) ? state.nextIncomingOfferDate : '';
      const content = offers.length
        ? `<div class="job-offers-employed-grid">${offers.map(offer => managerJobOfferCard(offer)).join('')}</div>`
        : `<div class="empty-office-box"><strong>No hay propuestas activas</strong><span>Los clubes evalúan tu prestigio, rendimiento reciente, capacidades, compatibilidad y su urgencia deportiva.${nextDate ? ` Próxima revisión estimada: ${escapeHtml(nextDate)}.` : ''}</span></div>`;
      view.insertAdjacentHTML('beforeend', `<section class="card employed-job-offers-panel"><div class="row"><div><p class="label">Mercado laboral activo</p><h3>Ofertas para cambiar de club</h3></div><span class="pill ${offers.length ? 'ok' : 'neutral'}">${offers.length} activa${offers.length === 1 ? '' : 's'}</span></div><p class="muted small">Podés recibir propuestas aunque tengas contrato. Aceptar una oferta termina el vínculo actual y la carrera continúa desde la misma fecha.</p>${content}</section>`);
      if(typeof bindManagerJobMarketActions === 'function') bindManagerJobMarketActions();
      return result;
    };
  }

  if(typeof acceptManagerJobOffer === 'function'){
    const acceptManagerJobOfferV880 = acceptManagerJobOffer;
    acceptManagerJobOffer = function(offerId, negotiationLevel='normal'){
      if(game?.gameOver?.active) return acceptManagerJobOfferV880(offerId, negotiationLevel);
      const state = ensureManagerJobMarketState();
      const offer = state.offers.find(item => String(item.id) === String(offerId));
      if(!offer){ showNotice('La oferta ya no está disponible.'); return false; }
      const club = seed?.clubs?.find(item => Number(item.id) === Number(offer.clubId));
      if(!club){ showNotice('El club de la oferta ya no está disponible.'); return false; }
      const confirmed = typeof window.confirm === 'function'
        ? window.confirm(`Aceptar la oferta de ${club.name} implica dejar ${clubName(game.selectedClubId)} inmediatamente.\n\nLa partida continuará en la misma fecha y temporada. ¿Confirmar el cambio de club?`)
        : true;
      if(!confirmed) return false;
      const previousClubId = Number(game.selectedClubId || 0);
      continueCareerAtClub(offer.clubId, {
        jobOffer:offer,
        contractNegotiationLevel:String(offer.contractType || '') === 'high_risk' ? 'ambicioso' : managerContractNegotiationLevel(negotiationLevel),
        allowHighRiskContract:String(offer.contractType || '') === 'high_risk',
        allowEmployedTransition:true
      });
      if(Number(game?.selectedClubId || 0) === Number(offer.clubId) && Number(game.selectedClubId) !== previousClubId){
        const updated = ensureManagerJobMarketState();
        updated.offers = [];
        updated.applications = [];
        updated.nextIncomingOfferDate = null;
        updated.lastProcessedDate = currentCalendarDate();
        managerJobScheduleNextIncomingOffer(currentCalendarDate());
        saveLocal(true);
        renderAll();
        return true;
      }
      return false;
    };
  }

  if(typeof advanceGlobalTurn === 'function'){
    const advanceGlobalTurnV880 = advanceGlobalTurn;
    advanceGlobalTurn = function(){
      const result = advanceGlobalTurnV880();
      if(game && !game.gameOver?.active && typeof processManagerJobMarketDaily === 'function') processManagerJobMarketDaily();
      return result;
    };
  }
})();
