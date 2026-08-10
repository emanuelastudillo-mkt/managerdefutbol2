/* V8.94 · Objetivos, finanzas mensuales y amistosos. */
(function(){
  const VERSION = 'V8.94';

  function v894Number(value, fallback=0){
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }
  function v894Round(value){ return Math.round(v894Number(value, 0)); }
  function v894OneDecimal(value){ return Math.round(v894Number(value, 0) * 10) / 10; }
  function v894Clamp(value, min=0, max=100){ return Math.max(min, Math.min(max, v894Number(value, min))); }
  function v894Config(path, fallback){
    return typeof configValue === 'function' ? configValue(path, fallback) : fallback;
  }
  function v894Money(value){
    return typeof formatMoney === 'function' ? formatMoney(v894Round(value)) : String(v894Round(value));
  }
  function v894Escape(value){
    return typeof escapeHtml === 'function' ? escapeHtml(String(value ?? '')) : String(value ?? '');
  }
  function v894Player(playerId){
    if(typeof playerById === 'function') return playerById(playerId);
    return (seed?.players || []).find(player => Number(player?.id) === Number(playerId)) || null;
  }
  function v894ClubName(clubId){
    if(typeof clubName === 'function') return clubName(clubId);
    return String((seed?.clubs || []).find(club => Number(club?.id) === Number(clubId))?.name || `Club ${clubId}`);
  }
  function v894DateToMs(value){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return NaN;
    const [year, month, day] = String(value).split('-').map(Number);
    return Date.UTC(year, month - 1, day);
  }
  function v894DaysBetween(from, to){
    const a = v894DateToMs(from);
    const b = v894DateToMs(to);
    return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b - a) / 86400000) : 0;
  }

  function v894RecomputeDressingRoom(stint){
    if(!stint) return null;
    const activeEntries = Object.values(stint.playerTrust || {}).filter(entry => {
      const player = v894Player(entry?.playerId);
      return player && !player.retired && !player.sold && Number(player.clubId || 0) === Number(stint.clubId || 0);
    });
    const average = values => {
      const clean = values.map(Number).filter(Number.isFinite);
      return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 50;
    };
    const groups = {};
    ['starter','rotation','substitute','youth'].forEach(group => {
      const entries = activeEntries.filter(entry => String(entry.primaryGroup || '') === group);
      groups[group] = { value:v894OneDecimal(average(entries.map(entry => entry.value))), count:entries.length };
    });
    const referents = activeEntries.filter(entry => Array.isArray(entry.tags) && entry.tags.includes('referent'));
    groups.referent = { value:v894OneDecimal(average(referents.map(entry => entry.value))), count:referents.length };
    const weighted = activeEntries.reduce((sum, entry) => sum + v894Number(entry.value, 50) * (1 + v894Number(entry.influence, 0) / 100), 0);
    const weights = activeEntries.reduce((sum, entry) => sum + (1 + v894Number(entry.influence, 0) / 100), 0);
    stint.generalTrust = v894Clamp(v894OneDecimal(weights ? weighted / weights : 50), 0, 100);
    stint.groupTrust = groups;
    stint.leadershipEnd = v894Round(stint.generalTrust);
    stint.updatedAt = String(game?.currentDate || new Date().toISOString());
    return stint;
  }

  function v894ObjectiveTrustPlan(options={}){
    if(!game || game.seasonFinalized || Number(game.matchdayIndex || 0) < Number(game.fixtures?.length || 0)) return null;
    if(options?.managerAbsent || game?.gameOver?.active) return null;
    if(typeof currentGameIsFounderMode === 'function' && currentGameIsFounderMode()) return null;
    const season = Math.max(1, v894Round(game.seasonNumber || 1));
    const clubId = Number(game.selectedClubId || 0);
    if(!clubId) return null;
    game.v894ObjectiveTrustBonuses = game.v894ObjectiveTrustBonuses && typeof game.v894ObjectiveTrustBonuses === 'object' && !Array.isArray(game.v894ObjectiveTrustBonuses)
      ? game.v894ObjectiveTrustBonuses
      : {};
    const key = `${season}:${clubId}`;
    if(game.v894ObjectiveTrustBonuses[key]) return game.v894ObjectiveTrustBonuses[key];
    const currentSeason = game.managerStats?.currentSeason || {};
    const objective = Number.isFinite(Number(currentSeason.objectivePpg))
      ? Number(currentSeason.objectivePpg)
      : (typeof managerObjectiveForClubDivision === 'function' ? Number(managerObjectiveForClubDivision(clubId)) : NaN);
    const ppg = typeof ppgFromTotals === 'function'
      ? Number(ppgFromTotals(currentSeason))
      : Number(currentSeason.ppg || 0);
    if(!Number.isFinite(objective) || !Number.isFinite(ppg) || ppg < objective) return null;
    const objectiveDelta = typeof managerObjectiveResultDelta === 'function'
      ? Number(managerObjectiveResultDelta(ppg, objective))
      : Number((ppg - objective).toFixed(3));
    const broadThreshold = Math.max(0, v894Number(v894Config('manager.vestuario.objetivoSuperadoMargenPpg', 0.20), 0.20));
    const normalBonus = v894Number(v894Config('manager.vestuario.bonoConfianzaObjetivoCumplido', 4), 4);
    const broadBonus = v894Number(v894Config('manager.vestuario.bonoConfianzaObjetivoSuperado', 7), 7);
    const requestedBonus = objectiveDelta >= broadThreshold ? broadBonus : normalBonus;
    const stint = window.managerDressingRoom?.current ? window.managerDressingRoom.current() : null;
    if(!stint || Number(stint.clubId || 0) !== clubId) return null;
    const changes = [];
    Object.values(stint.playerTrust || {}).forEach(entry => {
      const player = v894Player(entry?.playerId);
      if(!player || player.retired || player.sold || Number(player.clubId || 0) !== clubId) return;
      const before = v894Number(entry.value, 50);
      const after = v894Clamp(v894OneDecimal(before + requestedBonus), 0, 100);
      const applied = v894OneDecimal(after - before);
      if(!applied) return;
      entry.value = after;
      entry.lastChange = applied;
      entry.lastReason = objectiveDelta >= broadThreshold ? 'Objetivo de temporada ampliamente superado' : 'Objetivo de temporada cumplido';
      entry.updatedAt = String(game.currentDate || new Date().toISOString());
      changes.push({ playerId:Number(entry.playerId || 0), delta:applied });
    });
    v894RecomputeDressingRoom(stint);
    stint.events = Array.isArray(stint.events) ? stint.events : [];
    stint.events.push({
      type:'season_objective',
      reason:objectiveDelta >= broadThreshold ? 'Objetivo ampliamente superado' : 'Objetivo cumplido',
      season,
      date:String(game.currentDate || new Date().toISOString()),
      changes:changes.slice(0, 50)
    });
    stint.events = stint.events.slice(-120);
    const summary = {
      version:VERSION,
      key,
      season,
      clubId,
      objective:Number(objective.toFixed(3)),
      ppg:Number(ppg.toFixed(3)),
      objectiveDelta:Number(objectiveDelta.toFixed(3)),
      broad:Boolean(objectiveDelta >= broadThreshold),
      requestedBonus,
      playersAffected:changes.length,
      generalTrust:v894Number(stint.generalTrust, 50),
      appliedAt:String(game.currentDate || new Date().toISOString())
    };
    game.v894ObjectiveTrustBonuses[key] = summary;
    return summary;
  }

  if(typeof normalizeGame === 'function'){
    const originalNormalizeGame = normalizeGame;
    normalizeGame = function(saved){
      const normalized = originalNormalizeGame(saved);
      normalized.v894ObjectiveTrustBonuses = normalized.v894ObjectiveTrustBonuses && typeof normalized.v894ObjectiveTrustBonuses === 'object' && !Array.isArray(normalized.v894ObjectiveTrustBonuses)
        ? normalized.v894ObjectiveTrustBonuses
        : {};
      return normalized;
    };
  }

  if(typeof finalizeSeasonIfNeeded === 'function'){
    const originalFinalizeSeasonIfNeeded = finalizeSeasonIfNeeded;
    finalizeSeasonIfNeeded = function(options={}){
      const trustBonus = v894ObjectiveTrustPlan(options);
      const result = originalFinalizeSeasonIfNeeded(options);
      if(trustBonus?.playersAffected){
        const record = game?.seasonTransition?.userRecord || null;
        if(record && Number(record.season || 0) === Number(trustBonus.season) && Number(record.clubId || 0) === Number(trustBonus.clubId)){
          record.managerTrustBonus = trustBonus.requestedBonus;
          record.managerTrustBonusBroad = trustBonus.broad;
          record.managerTrustAfterObjective = trustBonus.generalTrust;
        }
        const seasonRecord = (game?.managerStats?.seasons || []).find(item => Number(item?.season || 0) === Number(trustBonus.season) && Number(item?.clubId || 0) === Number(trustBonus.clubId));
        if(seasonRecord){
          seasonRecord.managerTrustBonus = trustBonus.requestedBonus;
          seasonRecord.managerTrustBonusBroad = trustBonus.broad;
          seasonRecord.managerTrustAfterObjective = trustBonus.generalTrust;
        }
        if(typeof pushGameMessage === 'function'){
          pushGameMessage({
            type:'empleados',
            priority:'high',
            title:trustBonus.broad ? 'El vestuario respalda plenamente tu trabajo' : 'El vestuario reconoce el objetivo cumplido',
            body:`La temporada de ${v894ClubName(trustBonus.clubId)} terminó con el objetivo ${trustBonus.broad ? 'ampliamente superado' : 'cumplido'}. La confianza de los jugadores en el mánager aumentó ${trustBonus.requestedBonus} puntos y quedó en ${v894Round(trustBonus.generalTrust)}/100.`,
            id:`objective-trust-v894-${trustBonus.key}`
          });
        }
      }
      return result;
    };
  }

  function v894FriendlyConfig(){
    return {
      split:v894Clamp(v894Number(v894Config('calendario.amistosos.repartoIngresosPorEquipoPct', 0.50), 0.50), 0, 1),
      win:v894Number(v894Config('calendario.amistosos.cohesionVictoria', 4), 4),
      draw:v894Number(v894Config('calendario.amistosos.cohesionEmpate', 2), 2),
      loss:v894Number(v894Config('calendario.amistosos.cohesionDerrota', -2), -2)
    };
  }
  function v894FriendlySettlement(match){
    if(!game || !match || !match.friendly || match.friendlySettlementV894) return match?.friendlySettlementV894 || null;
    const homeId = Number(match.homeId || 0);
    const awayId = Number(match.awayId || 0);
    if(!homeId || !awayId) return null;
    const cfg = v894FriendlyConfig();
    const gross = Math.max(0, v894Round(match?.matchContext?.ticketRevenue ?? match?.ticketRevenue ?? 0));
    const homeShare = Math.max(0, v894Round(gross * cfg.split));
    const awayShare = Math.max(0, gross - homeShare);
    if(gross > 0 && typeof window.applyClubCashChange === 'function'){
      window.applyClubCashChange(homeId, homeShare, 'Ingresos compartidos de partido amistoso', {
        type:'friendly_revenue_share', matchId:String(match.id || ''), opponentId:awayId, grossRevenue:gross, share:homeShare, splitPct:cfg.split, venueRole:'home'
      });
      window.applyClubCashChange(awayId, awayShare, 'Ingresos compartidos de partido amistoso', {
        type:'friendly_revenue_share', matchId:String(match.id || ''), opponentId:homeId, grossRevenue:gross, share:awayShare, splitPct:1 - cfg.split, venueRole:'away'
      });
    }
    if(typeof noteOwnMatchForMonthlyExpenses === 'function') noteOwnMatchForMonthlyExpenses(match);
    const homeGoals = v894Number(match.homeGoals, 0);
    const awayGoals = v894Number(match.awayGoals, 0);
    const homeRequested = homeGoals > awayGoals ? cfg.win : homeGoals < awayGoals ? cfg.loss : cfg.draw;
    const awayRequested = awayGoals > homeGoals ? cfg.win : awayGoals < homeGoals ? cfg.loss : cfg.draw;
    const homeCohesion = typeof adjustTeamCohesion === 'function' ? adjustTeamCohesion(homeId, homeRequested) : 0;
    const awayCohesion = typeof adjustTeamCohesion === 'function' ? adjustTeamCohesion(awayId, awayRequested) : 0;
    const selectedId = Number(game.selectedClubId || 0);
    const ownShare = selectedId === homeId ? homeShare : selectedId === awayId ? awayShare : 0;
    const ownCohesion = selectedId === homeId ? homeCohesion : selectedId === awayId ? awayCohesion : 0;
    const settlement = {
      version:VERSION,
      grossRevenue:gross,
      homeShare,
      awayShare,
      homeCohesion,
      awayCohesion,
      ownShare,
      ownCohesion,
      moraleAppliedByMatchSystem:true
    };
    match.friendlySettlementV894 = settlement;
    if(typeof pushGameMessage === 'function' && selectedId && (selectedId === homeId || selectedId === awayId)){
      const opponentId = selectedId === homeId ? awayId : homeId;
      const cohesionText = ownCohesion > 0 ? `La cohesión subió ${ownCohesion} punto(s).` : ownCohesion < 0 ? `La cohesión bajó ${Math.abs(ownCohesion)} punto(s).` : 'La cohesión no cambió.';
      pushGameMessage({
        type:'finanzas',
        priority:'normal',
        title:'Liquidación del amistoso',
        body:`La recaudación total ante ${v894ClubName(opponentId)} fue de ${v894Money(gross)} y se repartió entre ambos clubes. ${v894ClubName(selectedId)} recibió ${v894Money(ownShare)}. El resultado también modificó la moral del plantel. ${cohesionText}`,
        id:`friendly-settlement-v894-${String(match.id || `${game.seasonNumber}-${game.phaseTurn}-${homeId}-${awayId}`)}`
      });
    }
    return settlement;
  }

  if(typeof finalizePreseasonTurnAfterMatch === 'function'){
    const originalFinalizePreseason = finalizePreseasonTurnAfterMatch;
    finalizePreseasonTurnAfterMatch = function(context={}){
      if(context?.friendlyResult){
        context.friendlyResult.friendly = true;
        v894FriendlySettlement(context.friendlyResult);
      }
      return originalFinalizePreseason(context);
    };
  }

  if(typeof setPreseasonTurnSummary === 'function'){
    const originalSetPreseasonTurnSummary = setPreseasonTurnSummary;
    setPreseasonTurnSummary = function(friendlyResult, opponentId, canFriendly){
      const result = originalSetPreseasonTurnSummary(friendlyResult, opponentId, canFriendly);
      const settlement = friendlyResult?.friendlySettlementV894;
      if(settlement && game?.lastTurnSummary?.items){
        game.lastTurnSummary.items.splice(1, 0, {
          label:'Recaudación compartida',
          text:`El amistoso generó ${v894Money(settlement.grossRevenue)}. Tu club recibió ${v894Money(settlement.ownShare)}.`,
          tone:'ok'
        });
        const cohesionTone = Number(settlement.ownCohesion || 0) > 0 ? 'ok' : Number(settlement.ownCohesion || 0) < 0 ? 'bad' : 'info';
        game.lastTurnSummary.items.splice(2, 0, {
          label:'Moral y cohesión',
          text:`La moral fue actualizada según el resultado. Cohesión: ${Number(settlement.ownCohesion || 0) > 0 ? '+' : ''}${Number(settlement.ownCohesion || 0)}.`,
          tone:cohesionTone
        });
      }
      return result;
    };
  }

  function v894MonthlyFinanceSnapshot(){
    const rows = [];
    const add = (group, concept, frequency, amount, detail, options={}) => {
      const cleanAmount = Math.max(0, v894Round(amount));
      rows.push({ group, concept, frequency, amount:cleanAmount, detail, included:options.included !== false, tone:options.tone || (cleanAmount > 0 ? 'bad' : 'muted') });
      return cleanAmount;
    };
    let fixed = 0;
    let cycle = 0;
    let projection = 0;

    const contract = typeof managerJobContractForClubSeason === 'function'
      ? managerJobContractForClubSeason(game?.selectedClubId, game?.seasonNumber || 1)
      : game?.managerJobContract;
    const managerSalary = contract && typeof managerContractMonthlySalaryForSeason === 'function'
      ? managerContractMonthlySalaryForSeason(contract, game?.seasonNumber || 1)
      : Math.max(0, v894Round(contract?.monthlySalary || 0));
    if(managerSalary > 0) fixed += add('Fijos mensuales', 'Sueldo del mánager', 'Cada 30 días', managerSalary, 'Contrato laboral vigente.');

    const serviceApi = window.clubServicesV892;
    const serviceState = serviceApi?.ensure ? serviceApi.ensure(game?.selectedClubId) : null;
    const serviceLabels = { hotel:'Convenio con hotel', transport:'Convenio de transporte', press:'Oficina de prensa y marketing' };
    ['hotel','transport','press'].forEach(category => {
      const contractState = serviceState?.[category];
      const option = (serviceApi?.catalog?.[category] || []).find(item => String(item.id) === String(contractState?.optionId || ''));
      if(!option) return;
      const amount = serviceApi?.monthlyCost ? serviceApi.monthlyCost(option, game?.selectedClubId) : 0;
      fixed += add('Fijos mensuales', serviceLabels[category], 'Mensual', amount, option.name || 'Servicio activo.');
    });

    const scouting = typeof ensureScoutingCenterState === 'function' ? ensureScoutingCenterState() : (game?.scoutingCenter || {});
    const offices = Math.max(0, v894Round(scouting?.offices || 0));
    if(offices > 0 && typeof SCOUTING_OFFICE_MONTHLY_COST !== 'undefined'){
      fixed += add('Fijos mensuales', 'Oficinas de ojeo', 'Mensual', offices * SCOUTING_OFFICE_MONTHLY_COST, `${offices} oficina(s) alquilada(s).`);
    }
    const chiefType = scouting?.chief && typeof scoutingChiefType === 'function' ? scoutingChiefType(scouting.chief.type) : null;
    if(chiefType?.monthlySalary){
      fixed += add('Fijos mensuales', 'Jefe de ojeadores', 'Mensual', chiefType.monthlySalary, `${chiefType.name || 'Jefe'} contratado.`);
    }

    const monthlyState = typeof ensureMonthlyExpensesState === 'function' ? ensureMonthlyExpensesState() : (game?.monthlyExpenses || {});
    const today = String(game?.currentDate || '');
    const lastCharge = String(monthlyState?.lastChargeDate || today);
    const elapsed = Math.max(0, v894DaysBetween(lastCharge, today));
    const remainingDays = elapsed >= 30 ? 0 : Math.max(0, 30 - elapsed);
    const matches = Math.max(0, v894Round(monthlyState?.matchesPlayed || 0));
    const capacity = typeof clubStadiumCapacity === 'function' ? Math.max(0, v894Round(clubStadiumCapacity(game?.selectedClubId) || 0)) : 0;
    const fans = typeof clubFansCurrent === 'function' ? Math.max(0, v894Round(clubFansCurrent(game?.selectedClubId) || 0)) : 0;
    const tax = typeof MONTHLY_PROFIT_TAX_RATE !== 'undefined' ? Math.max(0, v894Round(Math.max(0, Number(game?.budget || 0)) * MONTHLY_PROFIT_TAX_RATE)) : 0;
    const electricity = typeof MONTHLY_ELECTRICITY_BASE_PER_MATCH !== 'undefined' && typeof MONTHLY_ELECTRICITY_CAPACITY_FACTOR !== 'undefined'
      ? Math.max(0, v894Round(matches * (MONTHLY_ELECTRICITY_BASE_PER_MATCH + capacity * MONTHLY_ELECTRICITY_CAPACITY_FACTOR)))
      : 0;
    const cleaning = typeof MONTHLY_CLEANING_PER_FAN_PER_MATCH !== 'undefined'
      ? Math.max(0, v894Round(MONTHLY_CLEANING_PER_FAN_PER_MATCH * matches * fans))
      : 0;
    cycle += add('Próximo cierre mensual', 'Impuesto mensual de riqueza', `En ${remainingDays} día(s)`, tax, 'Estimado sobre el presupuesto actual.');
    cycle += add('Próximo cierre mensual', 'Electricidad del club', `En ${remainingDays} día(s)`, electricity, `${matches} partido(s) acumulado(s) en el ciclo.`);
    cycle += add('Próximo cierre mensual', 'Limpieza general', `En ${remainingDays} día(s)`, cleaning, `${matches} partido(s) y ${fans.toLocaleString('es-AR')} hinchas registrados.`);

    const scouts = Math.max(0, v894Round(scouting?.scouts || 0));
    if(scouts > 0 && typeof SCOUTING_SCOUT_DAILY_COST !== 'undefined'){
      projection += add('Proyección próximos 30 días', 'Ojeadores contratados', 'Diario × 30', scouts * SCOUTING_SCOUT_DAILY_COST * 30, `${scouts} ojeador(es) activo(s).`);
    }
    if(scouting?.playerSearch?.enabled && typeof SCOUTING_PLAYER_SEARCH_DAILY_COST !== 'undefined'){
      projection += add('Proyección próximos 30 días', 'Búsqueda automática de jugadores', 'Diario × 30', SCOUTING_PLAYER_SEARCH_DAILY_COST * 30, 'Servicio de búsqueda activo.');
    }
    if(typeof founderAdministrativeCostsActive === 'function' && founderAdministrativeCostsActive() && typeof founderAdministrativeCostBreakdown === 'function'){
      const founder = founderAdministrativeCostBreakdown(game?.selectedClubId);
      projection += add('Proyección próximos 30 días', 'Costos administrativos del club fundador', 'Diario × 30', v894Number(founder?.total, 0) * 30, 'Estimación con la estructura actual.');
    }
    const loanState = typeof ensureBankLoanState === 'function' ? ensureBankLoanState() : game?.bankLoan;
    const loan = loanState?.active;
    if(loan && v894Number(loan.remainingDebt, 0) > 0){
      let due = 0;
      let dueCount = 0;
      let dueDate = String(loan.nextPaymentDate || '');
      const endMs = v894DateToMs(today) + 30 * 86400000;
      let remainingWeeks = Math.max(0, v894Round(loan.remainingWeeks || 0));
      let remainingDebt = Math.max(0, v894Round(loan.remainingDebt || 0));
      while(remainingWeeks > 0 && remainingDebt > 0 && Number.isFinite(v894DateToMs(dueDate)) && v894DateToMs(dueDate) <= endMs){
        const payment = Math.min(Math.max(1, v894Round(loan.weeklyPayment || 0)), remainingDebt);
        due += payment;
        remainingDebt -= payment;
        remainingWeeks -= 1;
        dueCount += 1;
        const nextMs = v894DateToMs(dueDate) + 7 * 86400000;
        dueDate = new Date(nextMs).toISOString().slice(0, 10);
      }
      projection += add('Proyección próximos 30 días', 'Cuotas del préstamo bancario', `${dueCount} cuota(s)`, due, `${v894Money(loan.remainingDebt)} de deuda restante.`);
    }

    const annualPayroll = typeof totalClubSalary === 'function' ? Math.max(0, v894Round(totalClubSalary(game?.selectedClubId))) : 0;
    if(annualPayroll > 0){
      add('Referencia anual', 'Sueldos del plantel profesional', 'Pago anual', annualPayroll, `Equivale a ${v894Money(annualPayroll / 12)} por mes, pero se liquida al cierre de temporada.`, { included:false, tone:'neutral' });
    }

    return {
      fixed,
      cycle,
      projection,
      estimated30:fixed + cycle + projection,
      rows,
      elapsedDays:elapsed,
      remainingDays,
      matches,
      annualPayroll
    };
  }

  function v894MonthlyFinanceMarkup(snapshot=v894MonthlyFinanceSnapshot()){
    const groups = ['Fijos mensuales','Próximo cierre mensual','Proyección próximos 30 días','Referencia anual'];
    const body = groups.map(group => {
      const groupRows = snapshot.rows.filter(row => row.group === group);
      if(!groupRows.length) return '';
      return `<tr class="finance-monthly-group"><th colspan="4">${v894Escape(group)}</th></tr>${groupRows.map(row => `<tr><td><strong>${v894Escape(row.concept)}</strong><span>${v894Escape(row.detail)}</span></td><td>${v894Escape(row.frequency)}</td><td class="finance-monthly-amount ${row.tone}">${row.amount > 0 ? `-${v894Money(row.amount)}` : v894Money(0)}</td><td>${row.included ? '<span class="pill bad-pill">Incluido</span>' : '<span class="pill">Informativo</span>'}</td></tr>`).join('')}`;
    }).join('');
    return `<section class="finance-monthly-overview" aria-label="Gastos mensuales del club">
      <div class="row finance-monthly-title"><div><p class="label">Control mensual</p><h3>Gastos y compromisos del club</h3><p class="muted small">Estimación actual. Los importes variables se actualizan con el presupuesto, los partidos y los servicios activos.</p></div><span class="pill">Cierre en ${snapshot.remainingDays} día(s)</span></div>
      <div class="finance-monthly-metrics">
        <div class="card"><p class="label">Fijos mensuales</p><strong class="bad">-${v894Money(snapshot.fixed)}</strong><span>Contratos y servicios</span></div>
        <div class="card"><p class="label">Ciclo mensual actual</p><strong class="bad">-${v894Money(snapshot.cycle)}</strong><span>${snapshot.matches} partido(s) contabilizado(s)</span></div>
        <div class="card"><p class="label">Diarios y semanales</p><strong class="bad">-${v894Money(snapshot.projection)}</strong><span>Proyección de 30 días</span></div>
        <div class="card finance-monthly-total"><p class="label">Salida estimada</p><strong class="bad">-${v894Money(snapshot.estimated30)}</strong><span>Próximos 30 días</span></div>
      </div>
      <div class="table-wrap finance-monthly-table-wrap"><table class="finance-monthly-table"><thead><tr><th>Concepto</th><th>Frecuencia</th><th>Importe estimado</th><th>Tipo</th></tr></thead><tbody>${body || '<tr><td colspan="4" class="muted">No hay gastos mensuales activos.</td></tr>'}</tbody></table></div>
      <p class="muted small finance-monthly-note">Los sueldos del plantel se muestran como referencia anual y no se suman a la salida de los próximos 30 días. Los importes reales se registran en Movimientos agrupados cuando se cobran.</p>
    </section>`;
  }

  if(typeof renderFinances === 'function'){
    const originalRenderFinances = renderFinances;
    renderFinances = function(){
      const result = originalRenderFinances();
      if(String(financeViewMode || 'main') !== 'main' || !view || game?.gameOver?.active) return result;
      const anchor = view.querySelector('.compact-team-stats');
      if(anchor && !view.querySelector('.finance-monthly-overview')){
        anchor.insertAdjacentHTML('afterend', v894MonthlyFinanceMarkup());
      }
      return result;
    };
  }

  window.gameV894 = {
    version:VERSION,
    applyObjectiveTrustBonus:v894ObjectiveTrustPlan,
    settleFriendly:v894FriendlySettlement,
    monthlyFinanceSnapshot:v894MonthlyFinanceSnapshot,
    monthlyFinanceMarkup:v894MonthlyFinanceMarkup
  };
})();
