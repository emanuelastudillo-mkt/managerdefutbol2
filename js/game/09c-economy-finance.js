/* V8.08 · Presupuesto, finanzas, préstamos y economía de liga. Extraído de 09-simulation-economy-training.js. */

function recordBudgetChange(delta, concept, meta={}){
  if(!game) return;
  game.budgetHistory = game.budgetHistory || [];
  const safeDelta = Math.round(Number(delta) || 0);
  game.budget = Math.round(Number(game.budget || 0) + safeDelta);
  game.lastBudgetDelta = safeDelta;
  game.budgetHistory.push({
    season:game.seasonNumber || 1,
    matchdayIndex:game.matchdayIndex || 0,
    date:game.currentDate || '',
    concept:concept || 'Movimiento de presupuesto',
    delta:safeDelta,
    budget:game.budget,
    ...meta
  });
  if(Number(game.budget || 0) < 0 && typeof dismissAllStaffForFinancialCrisis === 'function') dismissAllStaffForFinancialCrisis({ silent:true });
}

function transferBudgetConfig(){
  return {
    active:configBoolean('mercado.presupuestoFichajesActivo', true),
    maxRate:configNumber('mercado.presupuestoFichajesMaximoPorcentaje', 0.50, 0, 1),
    baseD3:configNumber('mercado.presupuestoFichajesDivision3', 0.25, 0, 1),
    baseD2:configNumber('mercado.presupuestoFichajesDivision2', 0.35, 0, 1),
    baseD1:configNumber('mercado.presupuestoFichajesDivision1', 0.40, 0, 1),
    unlockObjective:configNumber('mercado.desbloqueoSuperarObjetivo', 0.05, 0, 1),
    unlockPpg15:configNumber('mercado.desbloqueoPromedio15', 0.05, 0, 1),
    unlockPpg19:configNumber('mercado.desbloqueoPromedio19', 0.10, 0, 1),
    unlockPromotion:configNumber('mercado.desbloqueoAscenso', 0.10, 0, 1),
    unlockChampion:configNumber('mercado.desbloqueoCampeon', 0.15, 0, 1),
    saleUnlockedRate:configNumber('mercado.porcentajeVentaLiberadoFichajes', 0.70, 0, 1)
  };
}
function transferBudgetBaseRateForClub(clubId){
  const cfg = transferBudgetConfig();
  const division = clubDivision(clubId || game?.selectedClubId);
  const order = Math.round(Number(division?.order || 3));
  if(order <= 1) return Math.min(cfg.maxRate, cfg.baseD1);
  if(order === 2) return Math.min(cfg.maxRate, cfg.baseD2);
  return Math.min(cfg.maxRate, cfg.baseD3);
}
function transferBudgetDefaultUnlocks(){
  return { objective:false, ppg15:false, ppg19:false, promotion:false, champion:false };
}
function createTransferBudgetState(clubId=game?.selectedClubId, season=game?.seasonNumber || 1, startingExtraRate=0){
  const cfg = transferBudgetConfig();
  const baseRate = transferBudgetBaseRateForClub(clubId);
  const extra = Math.max(0, Number(startingExtraRate || 0));
  return {
    active:cfg.active,
    season:Number(season || 1),
    clubId:Number(clubId || 0),
    baseRate,
    unlockedRate:Math.min(cfg.maxRate, extra),
    extraUnlockedAmount:0,
    spent:0,
    unlocks:transferBudgetDefaultUnlocks(),
    history:[]
  };
}
function normalizeTransferBudgetState(state, sourceGame=game){
  const season = Number(sourceGame?.seasonNumber || 1);
  const clubId = Number(sourceGame?.selectedClubId || 0);
  const cfg = transferBudgetConfig();
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : createTransferBudgetState(clubId, season, 0);
  const needsNewSeason = Number(src.season || 0) !== season || Number(src.clubId || 0) !== clubId;
  if(needsNewSeason){
    return createTransferBudgetState(clubId, season, 0);
  }
  const baseRate = Number.isFinite(Number(src.baseRate)) ? Number(src.baseRate) : transferBudgetBaseRateForClub(clubId);
  const unlockedRate = Math.max(0, Number(src.unlockedRate || 0));
  return {
    active:cfg.active,
    season,
    clubId,
    baseRate:Math.min(cfg.maxRate, Math.max(0, baseRate)),
    unlockedRate:Math.min(cfg.maxRate, unlockedRate),
    extraUnlockedAmount:Math.max(0, Math.round(Number(src.extraUnlockedAmount || 0))),
    spent:Math.max(0, Math.round(Number(src.spent || 0))),
    unlocks:{ ...transferBudgetDefaultUnlocks(), ...(src.unlocks || {}) },
    history:Array.isArray(src.history) ? src.history.slice(-80) : []
  };
}
function ensureTransferBudgetState(){
  if(!game) return null;
  game.transferBudget = normalizeTransferBudgetState(game.transferBudget, game);
  return game.transferBudget;
}
function transferBudgetRate(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return 1;
  const state = ensureTransferBudgetState();
  return clamp((Number(state?.baseRate || 0) + Number(state?.unlockedRate || 0)), 0, cfg.maxRate);
}
function transferBudgetMaximum(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return Math.max(0, Math.round(Number(game?.budget || 0)));
  return Math.max(0, Math.round(Number(game?.budget || 0) * cfg.maxRate));
}
function transferBudgetAuthorizedGross(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return Math.max(0, Math.round(Number(game?.budget || 0)));
  const state = ensureTransferBudgetState();
  const rateAmount = Math.round(Number(game?.budget || 0) * transferBudgetRate());
  const extra = Math.round(Number(state?.extraUnlockedAmount || 0));
  return Math.min(transferBudgetMaximum(), Math.max(0, rateAmount + extra));
}
function transferBudgetAvailable(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return Math.max(0, Math.round(Number(game?.budget || 0)));
  const state = ensureTransferBudgetState();
  return Math.max(0, Math.min(Number(game?.budget || 0), transferBudgetAuthorizedGross() - Math.round(Number(state?.spent || 0))));
}
function transferBudgetLockedAmount(){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return 0;
  return Math.max(0, Math.round(Number(game?.budget || 0) - transferBudgetAvailable()));
}
function transferBudgetPercentLabel(value){
  return `${Math.round(Number(value || 0) * 100)}%`;
}
function transferBudgetAddHistory(type, text, amount=0, rate=0){
  const state = ensureTransferBudgetState();
  if(!state) return;
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push({
    season:Number(game?.seasonNumber || 1),
    date:game?.currentDate || '',
    type:String(type || 'budget'),
    text:String(text || ''),
    amount:Math.round(Number(amount || 0)),
    rate:Number(rate || 0),
    createdAt:Date.now()
  });
  state.history = state.history.slice(-80);
}
function unlockTransferBudgetRate(key, rate, title, body){
  const cfg = transferBudgetConfig();
  if(!cfg.active) return false;
  const state = ensureTransferBudgetState();
  if(!state || state.unlocks?.[key]) return false;
  const current = Number(state.baseRate || 0) + Number(state.unlockedRate || 0);
  const add = Math.max(0, Math.min(Number(rate || 0), Math.max(0, cfg.maxRate - current)));
  state.unlocks[key] = true;
  if(add > 0){
    state.unlockedRate = Math.min(cfg.maxRate, Number(state.unlockedRate || 0) + add);
    transferBudgetAddHistory('unlock', title || 'Presupuesto liberado', 0, add);
    pushGameMessage({ type:'directiva', priority:'normal', title:title || 'Presupuesto de fichajes liberado', body:body || `La directiva liberó ${transferBudgetPercentLabel(add)} adicional para fichajes.` });
    return true;
  }
  return false;
}
function updateTransferBudgetPerformanceUnlocks(){
  const cfg = transferBudgetConfig();
  if(!cfg.active || !game) return false;
  const stats = ensureManagerCurrentSeasonStats(game.managerStats, game.seasonNumber, game.selectedClubId);
  game.managerStats = stats;
  const current = stats.currentSeason || {};
  const played = Number(current.played || 0);
  if(played <= 0) return false;
  const ppg = ppgFromTotals(current);
  const rawObjective = Number.isFinite(Number(current.objectivePpg)) ? Number(current.objectivePpg) : managerObjectiveForClubDivision(game.selectedClubId);
  const objective = Number.isFinite(Number(rawObjective)) ? Number(rawObjective) : null;
  let changed = false;
  if(!currentGameIsFounderMode() && Number.isFinite(objective) && ppg > objective){
    changed = unlockTransferBudgetRate('objective', cfg.unlockObjective, 'La directiva libera presupuesto', `El promedio de puntos superó el objetivo (${ppg.toFixed(2)} / ${objective.toFixed(2)}). Se habilitó ${transferBudgetPercentLabel(cfg.unlockObjective)} adicional para fichajes.`) || changed;
  }
  if(ppg > 1.5){
    changed = unlockTransferBudgetRate('ppg15', cfg.unlockPpg15, 'Buen rendimiento deportivo', `El promedio de puntos de la temporada superó 1,5. La directiva habilitó ${transferBudgetPercentLabel(cfg.unlockPpg15)} adicional para fichajes.`) || changed;
  }
  if(ppg > 1.9){
    changed = unlockTransferBudgetRate('ppg19', cfg.unlockPpg19, 'Rendimiento sobresaliente', `El promedio de puntos de la temporada superó 1,9. La directiva habilitó ${transferBudgetPercentLabel(cfg.unlockPpg19)} adicional para fichajes.`) || changed;
  }
  return changed;
}
function spendTransferBudget(amount, concept='Fichaje'){
  const state = ensureTransferBudgetState();
  const safe = Math.max(0, Math.round(Number(amount || 0)));
  if(!state || safe <= 0) return;
  state.spent = Math.max(0, Math.round(Number(state.spent || 0) + safe));
  transferBudgetAddHistory('spend', concept, safe, 0);
}
function unlockTransferBudgetFromSale(netAmount){
  const cfg = transferBudgetConfig();
  if(!cfg.active || !game) return 0;
  const state = ensureTransferBudgetState();
  const amount = Math.max(0, Math.round(Number(netAmount || 0) * cfg.saleUnlockedRate));
  if(amount <= 0) return 0;
  state.extraUnlockedAmount = Math.max(0, Math.round(Number(state.extraUnlockedAmount || 0) + amount));
  transferBudgetAddHistory('sale_unlock', 'Venta liberada para fichajes', amount, 0);
  return amount;
}
function queueNextSeasonTransferBudgetUnlock(key, rate, reason){
  const cfg = transferBudgetConfig();
  if(!cfg.active || !game) return 0;
  const safeRate = Math.max(0, Number(rate || 0));
  if(safeRate <= 0) return 0;
  game.nextSeasonTransferBudgetUnlock = game.nextSeasonTransferBudgetUnlock || { rate:0, reasons:[] };
  if(game.nextSeasonTransferBudgetUnlock.reasons?.some(r => r.key === key)) return 0;
  game.nextSeasonTransferBudgetUnlock.rate = Math.max(0, Number(game.nextSeasonTransferBudgetUnlock.rate || 0) + safeRate);
  game.nextSeasonTransferBudgetUnlock.reasons = Array.isArray(game.nextSeasonTransferBudgetUnlock.reasons) ? game.nextSeasonTransferBudgetUnlock.reasons : [];
  game.nextSeasonTransferBudgetUnlock.reasons.push({ key, rate:safeRate, reason:String(reason || '') });
  return safeRate;
}
function consumeNextSeasonTransferBudgetUnlock(){
  const queued = game?.nextSeasonTransferBudgetUnlock && typeof game.nextSeasonTransferBudgetUnlock === 'object' ? game.nextSeasonTransferBudgetUnlock : null;
  const rate = Math.max(0, Number(queued?.rate || 0));
  game.nextSeasonTransferBudgetUnlock = null;
  return { rate, reasons:Array.isArray(queued?.reasons) ? queued.reasons : [] };
}
function transferBudgetSummaryMarkup(){
  const cfg = transferBudgetConfig();
  const state = ensureTransferBudgetState();
  if(!cfg.active || !state) return '';
  const budget = Math.max(0, Math.round(Number(game?.budget || 0)));
  const available = transferBudgetAvailable();
  const max = transferBudgetMaximum();
  const rate = transferBudgetRate();
  const progress = max > 0 ? clamp(Math.round((available / max) * 100), 0, 100) : 0;
  return `<div class="card transfer-budget-card">
    <div class="row"><div><p class="label">Presupuesto para fichajes</p><h3>${formatMoney(available)}</h3></div><span class="pill">${transferBudgetPercentLabel(rate)} / ${transferBudgetPercentLabel(cfg.maxRate)}</span></div>
    <div class="bar transfer-budget-bar"><span style="width:${progress}%"></span></div>
    <p class="muted small">Presupuesto total: ${formatMoney(budget)} · Autorizado bruto: ${formatMoney(transferBudgetAuthorizedGross())} · Usado esta temporada: ${formatMoney(state.spent || 0)} · Bloqueado para fichajes: ${formatMoney(transferBudgetLockedAmount())}</p>
  </div>`;
}
function budgetConcept(entry){
  if(entry.concept) return entry.concept;
  if(entry.type === 'season_salary') return 'Pago anual de sueldos';
  if(entry.matchId) return 'Resultado de partido';
  return 'Movimiento de presupuesto';
}
function financeBudgetCategory(entry){
  const type = String(entry?.type || '').toLowerCase();
  const concept = String(entry?.concept || '').toLowerCase();
  if(type.includes('season_salary') || concept.includes('sueldo')) return 'Sueldos';
  if(type.includes('season_prize') || concept.includes('premio por campeonato') || concept.includes('premio por ascenso')) return 'Premios temporada';
  if(type.includes('bank_loan') || concept.includes('préstamo') || concept.includes('prestamo') || concept.includes('cuota semanal')) return 'Banco';
  if(type.includes('founder_admin') || concept.includes('costos administrativos diarios')) return 'Costos administrativos';
  if(type.includes('monthly_') || concept.includes('impuesto mensual') || concept.includes('electricidad mensual') || concept.includes('limpieza general')) return 'Gastos mensuales';
  if(type.includes('scouting_') || concept.includes('ojeador') || concept.includes('ojeo')) return 'Centro de Ojeo';
  if(type.includes('transfer_purchase') || type.includes('transfer_sale') || concept.includes('compra acordada') || concept.includes('venta de')) return 'Mercado';
  if(type.includes('stadium') || concept.includes('campo') || concept.includes('estadio')) return 'Estadio';
  if(type.includes('academy_residence') || concept.includes('residencia')) return 'Residencias juveniles';
  if(type.includes('academy') || concept.includes('academia') || concept.includes('captación') || concept.includes('juvenil')) return 'Academia';
  if(type.includes('staff') || concept.includes('contratación de')) return 'Empleados';
  if(type.includes('kinesiology') || concept.includes('médic') || concept.includes('tratamiento')) return 'Tratamientos médicos';
  if(type.includes('sponsor') || concept.includes('sponsor')) return 'Sponsors';
  if(type.includes('event') || concept.includes('evento') || concept.includes('compensación')) return 'Eventos';
  if(entry?.matchId || concept.includes('partido') || concept.includes('recaudación')) return 'Partidos y entradas';
  return 'Otros';
}
function financeAggregateKey(entry){
  const season = Number(entry?.season || game?.seasonNumber || 1);
  const type = String(entry?.type || 'budget');
  const concept = budgetConcept(entry);
  const sign = Number(entry?.delta || 0) >= 0 ? 'income' : 'expense';
  return `${season}|${sign}|${type}|${concept}`;
}
function financeGroupedEntries(entries){
  const groups = new Map();
  (entries || []).forEach((entry, order) => {
    const key = financeAggregateKey(entry);
    if(!groups.has(key)){
      groups.set(key, {
        ...entry,
        concept:budgetConcept(entry),
        delta:0,
        ticketRevenue:0,
        count:0,
        firstOrder:order,
        latestOrder:order,
        firstMatchdayIndex:Number(entry?.matchdayIndex || 0),
        lastMatchdayIndex:Number(entry?.matchdayIndex || 0),
        latestBudget:Number(entry?.budget || 0)
      });
    }
    const group = groups.get(key);
    group.delta += Number(entry?.delta || 0);
    group.ticketRevenue += Number(entry?.ticketRevenue || 0);
    group.count += 1;
    group.latestOrder = Math.min(group.latestOrder, order);
    const day = Number(entry?.matchdayIndex || 0);
    group.firstMatchdayIndex = Math.min(group.firstMatchdayIndex, day);
    group.lastMatchdayIndex = Math.max(group.lastMatchdayIndex, day);
  });
  return Array.from(groups.values()).sort((a,b) => a.firstOrder - b.firstOrder);
}
function financeDateLabel(entry){
  const count = Math.max(1, Number(entry?.count || 1));
  const first = Number(entry?.firstMatchdayIndex ?? entry?.matchdayIndex ?? 0) + 1;
  const last = Number(entry?.lastMatchdayIndex ?? entry?.matchdayIndex ?? 0) + 1;
  if(count <= 1) return `Fecha ${last}`;
  return first === last ? `Fecha ${last}` : `Fechas ${first}-${last}`;
}
function financeCountBadge(entry){
  const count = Math.max(1, Number(entry?.count || 1));
  return count > 1 ? ` <span class="pill finance-mini-pill">x${count}</span>` : '';
}
function financeCategoryRows(entries){
  return financeGroupedEntries(entries || []).map(entry => {
    const delta = Number(entry.delta || 0);
    const cls = delta > 0 ? 'ok' : delta < 0 ? 'bad' : 'muted';
    const extra = Number(entry.ticketRevenue || 0) > 0 ? ` <span class="pill finance-mini-pill">Entradas ${formatMoney(entry.ticketRevenue)}</span>` : '';
    return `<tr><td>${financeDateLabel(entry)}</td><td>${escapeHtml(budgetConcept(entry))}${financeCountBadge(entry)}${extra}</td><td><span class="${cls}">${delta > 0 ? '+' : ''}${formatMoney(delta)}</span></td><td><span class="${budgetTone(entry.latestBudget ?? entry.budget ?? 0)}">${formatMoney(entry.latestBudget ?? entry.budget ?? 0)}</span></td></tr>`;
  }).join('');
}
function financeExpensesByCategoryMarkup(){
  const season = game.seasonNumber || 1;
  const expenses = (game.budgetHistory || [])
    .filter(h => (h.season || season) === season && Number(h.delta || 0) < 0)
    .slice()
    .reverse();
  if(!expenses.length) return `<div class="card finance-category-card"><h3>Gastos por categoría</h3><p class="muted">Todavía no hay gastos registrados esta temporada.</p></div>`;
  const grouped = expenses.reduce((acc, entry) => {
    const category = financeBudgetCategory(entry);
    if(!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {});
  const order = ['Sueldos','Costos administrativos','Gastos mensuales','Banco','Mercado','Estadio','Residencias juveniles','Academia','Empleados','Tratamientos médicos','Eventos','Otros'];
  const details = order.filter(category => grouped[category]?.length).map((category, index) => {
    const entries = grouped[category];
    const groupedEntries = financeGroupedEntries(entries);
    const total = entries.reduce((sum, entry) => sum + Math.abs(Number(entry.delta || 0)), 0);
    const groupedLabel = groupedEntries.length === entries.length ? `${entries.length} mov.` : `${groupedEntries.length} grupos · ${entries.length} mov.`;
    return `<details class="finance-category-detail" ${index === 0 ? 'open' : ''}>
      <summary><span>${escapeHtml(category)}</span><strong class="bad">${formatMoney(total)}</strong><small>${groupedLabel}</small></summary>
      <div class="table-wrap compact-finance-table"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto agrupado</th><th>Presupuesto luego</th></tr></thead><tbody>${financeCategoryRows(entries)}</tbody></table></div>
    </details>`;
  }).join('');
  return `<div class="card finance-category-card"><div class="row"><div><h3>Gastos por categoría</h3><p class="muted small">Secciones minimizables y desplegables de la temporada actual.</p></div><span class="pill bad">${formatMoney(expenses.reduce((sum, entry) => sum + Math.abs(Number(entry.delta || 0)), 0))}</span></div>${details}</div>`;
}
function financeIncomeByCategoryMarkup(){
  const season = game.seasonNumber || 1;
  const income = (game.budgetHistory || [])
    .filter(h => (h.season || season) === season && Number(h.delta || 0) > 0)
    .slice()
    .reverse();
  if(!income.length) return '';
  const grouped = income.reduce((acc, entry) => {
    const category = financeBudgetCategory(entry);
    if(!acc[category]) acc[category] = [];
    acc[category].push(entry);
    return acc;
  }, {});
  const order = ['Partidos y entradas','Banco','Sponsors','Mercado','Eventos','Otros'];
  const details = order.filter(category => grouped[category]?.length).map((category, index) => {
    const entries = grouped[category];
    const groupedEntries = financeGroupedEntries(entries);
    const total = entries.reduce((sum, entry) => sum + Number(entry.delta || 0), 0);
    const groupedLabel = groupedEntries.length === entries.length ? `${entries.length} mov.` : `${groupedEntries.length} grupos · ${entries.length} mov.`;
    return `<details class="finance-category-detail finance-income-detail" ${index === 0 ? 'open' : ''}>
      <summary><span>${escapeHtml(category)}</span><strong class="ok">${formatMoney(total)}</strong><small>${groupedLabel}</small></summary>
      <div class="table-wrap compact-finance-table"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto agrupado</th><th>Presupuesto luego</th></tr></thead><tbody>${financeCategoryRows(entries)}</tbody></table></div>
    </details>`;
  }).join('');
  return `<div class="card finance-category-card"><div class="row"><div><h3>Ingresos por categoría</h3><p class="muted small">Incluye partidos, sponsors, ventas y recaudación de entradas.</p></div><span class="pill ok">${formatMoney(income.reduce((sum, entry) => sum + Number(entry.delta || 0), 0))}</span></div>${details}</div>`;
}
function financeSquadRows(){
  return playersByClub(game.selectedClubId)
    .slice()
    .sort((a,b)=>visibleOverall(b)-visibleOverall(a) || a.name.localeCompare(b.name,'es'))
    .map(p => `<tr><td><strong>${escapeHtml(p.name)}</strong></td><td>${nationalityShortMarkup(p.nationality)}</td><td>${Number(p.age || 0) || '—'}</td><td>${visibleOverall(p)}</td><td>${formatMoney(p.salary || 0)}</td></tr>`)
    .join('');
}
function loanPercentLabel(rate){ return `${Math.round(Number(rate || 0) * 100)}%`; }
function configuredLoanBanks(){
  return (BANK_LOAN_BANKS?.length ? BANK_LOAN_BANKS : [
    { id:1, name:'Banco Nación', interest:0.32 },
    { id:2, name:'Banco Provincia', interest:0.36 },
    { id:3, name:'Banco Galicia', interest:0.41 },
    { id:4, name:'Santander', interest:0.44 },
    { id:5, name:'BBVA', interest:0.43 },
    { id:6, name:'Banco Macro', interest:0.47 },
    { id:7, name:'Banco Credicoop', interest:0.34 },
    { id:8, name:'ICBC', interest:0.39 },
    { id:9, name:'Banco Supervielle', interest:0.46 },
    { id:10, name:'Banco Comafi', interest:0.50 }
  ]).map((bank, index) => ({ id:bank.id || index + 1, name:String(bank.name || bank.nombre || `Banco ${index + 1}`), interest:Math.max(0, Number(bank.interest ?? bank.interes ?? 0.40)) }));
}
function configuredLoanTiers(){
  return (BANK_LOAN_TIERS?.length ? BANK_LOAN_TIERS : [
    { id:1, amount:50000000, prestigeCost:1 },
    { id:2, amount:500000000, prestigeCost:5 },
    { id:3, amount:1500000000, prestigeCost:20 }
  ]).map((tier, index) => ({ id:tier.id || index + 1, amount:Math.max(0, Math.round(Number(tier.amount || tier.monto || 0))), prestigeCost:Math.max(0, Math.round(Number(tier.prestigeCost ?? tier.prestigio ?? 0))) })).filter(tier => tier.amount > 0);
}
function shuffledBySeed(list, seedKey){
  return (list || []).slice().sort((a,b)=>hashNumber(`${seedKey}-${a.id || a.name || a.amount}`, 1000000) - hashNumber(`${seedKey}-${b.id || b.name || b.amount}`, 1000000));
}
function createBankLoanOffers(season=game?.seasonNumber || 1){
  if(!BANK_LOANS_ENABLED) return [];
  const banks = shuffledBySeed(configuredLoanBanks(), `bank-loans-banks-${season}`).slice(0, 3);
  const tiers = shuffledBySeed(configuredLoanTiers(), `bank-loans-tiers-${season}`).slice(0, 3);
  const terms = BANK_LOAN_TERMS?.length ? BANK_LOAN_TERMS : [24,48,172];
  return tiers.map((tier, index) => {
    const bank = banks[index % banks.length];
    const weeks = terms[hashNumber(`bank-loan-term-${season}-${tier.id}-${bank.id}`, terms.length)];
    const interestRate = Math.max(0, Number(bank.interest || 0));
    const totalToRepay = Math.round(Number(tier.amount || 0) * (1 + interestRate));
    return {
      id:`loan-${season}-${tier.id}-${bank.id}`,
      season:Number(season || 1),
      bankId:bank.id,
      bankName:bank.name,
      amount:Math.round(Number(tier.amount || 0)),
      prestigeCost:Math.max(0, Math.round(Number(tier.prestigeCost || 0))),
      interestRate,
      weeks:Math.max(1, Math.round(Number(weeks || 1))),
      totalToRepay,
      weeklyPayment:Math.ceil(totalToRepay / Math.max(1, Number(weeks || 1)))
    };
  });
}
function createBankLoanState(season=game?.seasonNumber || 1){
  return { active:null, season:Number(season || 1), offers:createBankLoanOffers(season), history:[] };
}
function normalizeBankLoanActiveLoan(loan){
  if(!loan || typeof loan !== 'object' || Array.isArray(loan)) return null;
  const totalToRepay = Math.max(0, Math.round(Number(loan.totalToRepay || loan.remainingDebt || 0)));
  const paid = Math.max(0, Math.round(Number(loan.paid || 0)));
  const remainingDebt = Math.max(0, Math.round(Number(loan.remainingDebt ?? (totalToRepay - paid))));
  const weeks = Math.max(1, Math.round(Number(loan.weeks || loan.totalWeeks || 1)));
  const remainingWeeks = Math.max(0, Math.round(Number(loan.remainingWeeks ?? loan.weeksRemaining ?? weeks)));
  const today = validIsoDate(game?.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  const startedDate = validIsoDate(loan.startedDate) ? loan.startedDate : today;
  const legacyDaysSincePayment = Math.max(0, Math.round(Number(loan.daysSincePayment || 0)));
  const hasLegacyProgress = Number(loan.paid || 0) > 0 || Number(loan.remainingWeeks ?? weeks) < weeks;
  let lastPaymentDate = validIsoDate(loan.lastPaymentDate) ? loan.lastPaymentDate : (hasLegacyProgress ? today : startedDate);
  if(!validIsoDate(lastPaymentDate) && validIsoDate(today)) lastPaymentDate = today;
  let nextPaymentDate = validIsoDate(loan.nextPaymentDate) ? loan.nextPaymentDate : '';
  if(!nextPaymentDate && validIsoDate(lastPaymentDate)){
    nextPaymentDate = addDaysToIsoDate(lastPaymentDate, hasLegacyProgress ? 7 : Math.max(1, 7 - legacyDaysSincePayment));
  }
  return {
    id:String(loan.id || `loan-active-${Date.now()}`),
    season:Number(loan.season || game?.seasonNumber || 1),
    bankName:String(loan.bankName || 'Banco'),
    amount:Math.max(0, Math.round(Number(loan.amount || 0))),
    prestigeCost:Math.max(0, Math.round(Number(loan.prestigeCost || 0))),
    interestRate:Math.max(0, Number(loan.interestRate || 0)),
    weeks,
    totalWeeks:weeks,
    totalToRepay,
    weeklyPayment:Math.max(1, Math.round(Number(loan.weeklyPayment || Math.ceil(totalToRepay / weeks) || 1))),
    remainingWeeks,
    remainingDebt,
    paid,
    startedDate,
    startedTurn:Number(loan.startedTurn || game?.globalTurn || 0),
    lastPaymentDate:validIsoDate(lastPaymentDate) ? lastPaymentDate : '',
    nextPaymentDate:validIsoDate(nextPaymentDate) ? nextPaymentDate : '',
    lastScheduleCheckDate:validIsoDate(loan.lastScheduleCheckDate) ? loan.lastScheduleCheckDate : '',
    overchargeRepairAppliedAt:validIsoDate(loan.overchargeRepairAppliedAt) ? loan.overchargeRepairAppliedAt : '',
    overchargeRepairVersion:String(loan.overchargeRepairVersion || ''),
    daysSincePayment:legacyDaysSincePayment
  };
}
function normalizeBankLoanState(state, sourceGame=game){
  const season = Number(sourceGame?.seasonNumber || 1);
  const src = state && typeof state === 'object' && !Array.isArray(state) ? state : createBankLoanState(season);
  const active = normalizeBankLoanActiveLoan(src.active);
  if(active){
    return { active, season:Number(src.season || season), offers:[], history:Array.isArray(src.history) ? src.history.slice(-50) : [] };
  }
  if(Number(src.season || 0) !== season){
    return createBankLoanState(season);
  }
  const offers = Array.isArray(src.offers) && src.offers.length ? src.offers : createBankLoanOffers(season);
  return { active:null, season, offers, history:Array.isArray(src.history) ? src.history.slice(-50) : [] };
}
function refreshBankLoanOffersForSeason(state, season=game?.seasonNumber || 1){
  const normalized = normalizeBankLoanState(state, { seasonNumber:season });
  if(normalized.active) return normalized;
  if(Number(normalized.season || 0) !== Number(season || 1)) return createBankLoanState(season);
  if(!Array.isArray(normalized.offers) || normalized.offers.length !== 3){
    normalized.offers = createBankLoanOffers(season);
  }
  return normalized;
}
function ensureBankLoanState(){
  if(!game) return null;
  game.bankLoan = normalizeBankLoanState(game.bankLoan, game);
  return game.bankLoan;
}
function requestBankLoan(offerId){
  if(!game || !BANK_LOANS_ENABLED) return;
  const state = ensureBankLoanState();
  if(state.active){ showNotice('Ya hay un préstamo activo. No se pueden pedir nuevos préstamos hasta cancelarlo.'); return; }
  const offer = (state.offers || []).find(item => String(item.id) === String(offerId));
  if(!offer){ showNotice('La oferta bancaria ya no está disponible.'); return; }
  const prestige = currentManagerPrestige();
  if(prestige < offer.prestigeCost){ showNotice(`Prestigio insuficiente. Necesitás ${offer.prestigeCost} y tenés ${formatManagerPrestige(prestige)}.`); return; }
  const startDate = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  const active = normalizeBankLoanActiveLoan({ ...offer, totalWeeks:offer.weeks, remainingWeeks:offer.weeks, remainingDebt:offer.totalToRepay, paid:0, startedDate:startDate, startedTurn:game.globalTurn || 0, lastPaymentDate:startDate, nextPaymentDate:validIsoDate(startDate) ? addDaysToIsoDate(startDate, 7) : '' });
  addManagerPrestige(-offer.prestigeCost, `Préstamo tomado con ${offer.bankName}. Costo de prestigio: ${offer.prestigeCost}`);
  recordBudgetChange(offer.amount, `Préstamo bancario de ${offer.bankName}`, { type:'bank_loan_disbursement', bankName:offer.bankName, loanId:offer.id, prestigeCost:offer.prestigeCost, interestRate:offer.interestRate, weeks:offer.weeks, totalToRepay:offer.totalToRepay });
  state.active = active;
  state.offers = [];
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push({ type:'accepted', date:game.currentDate || '', bankName:offer.bankName, amount:offer.amount, totalToRepay:offer.totalToRepay, weeks:offer.weeks, prestigeCost:offer.prestigeCost });
  saveLocal(true);
  renderFinances();
  showNotice(`Préstamo aprobado por ${offer.bankName}. Se acreditaron ${formatMoney(offer.amount)}.`);
}
function processBankLoanWeeklyPayment(paymentDate=null){
  if(!game || !BANK_LOANS_ENABLED) return 0;
  const state = ensureBankLoanState();
  const loan = state?.active;
  if(!loan || loan.remainingDebt <= 0 || loan.remainingWeeks <= 0) return 0;
  const effectivePaymentDate = validIsoDate(paymentDate) ? paymentDate : (validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : ''));
  const amount = Math.min(Math.max(1, Math.round(Number(loan.weeklyPayment || 0))), Math.round(Number(loan.remainingDebt || 0)));
  loan.remainingDebt = Math.max(0, Math.round(Number(loan.remainingDebt || 0) - amount));
  loan.paid = Math.max(0, Math.round(Number(loan.paid || 0) + amount));
  loan.remainingWeeks = Math.max(0, Math.round(Number(loan.remainingWeeks || 0) - 1));
  loan.lastPaymentDate = validIsoDate(effectivePaymentDate) ? effectivePaymentDate : (loan.lastPaymentDate || '');
  loan.nextPaymentDate = validIsoDate(loan.lastPaymentDate) ? addDaysToIsoDate(loan.lastPaymentDate, 7) : '';
  loan.daysSincePayment = 0;
  recordBudgetChange(-amount, `Cuota semanal préstamo ${loan.bankName}`, { type:'bank_loan_payment', bankName:loan.bankName, loanId:loan.id, remainingDebt:loan.remainingDebt, remainingWeeks:loan.remainingWeeks, paymentDate:loan.lastPaymentDate, nextPaymentDate:loan.nextPaymentDate });
  if(loan.remainingDebt <= 0 || loan.remainingWeeks <= 0){
    state.history = Array.isArray(state.history) ? state.history : [];
    state.history.push({ type:'paid', date:game.currentDate || '', bankName:loan.bankName, amount:loan.amount, paid:loan.paid });
    state.active = null;
    state.offers = [];
    pushGameMessage({ type:'finanzas', title:'Préstamo cancelado', body:`El club terminó de pagar el préstamo de ${loan.bankName}. Las nuevas ofertas aparecerán en la próxima temporada.`, priority:'normal' });
  }
  return amount;
}
function payOffBankLoanFull(){
  if(!game || !BANK_LOANS_ENABLED) return;
  const state = ensureBankLoanState();
  const loan = state?.active;
  if(!loan || Number(loan.remainingDebt || 0) <= 0){ showNotice('No hay préstamo activo para cancelar.'); return; }
  const amount = Math.max(0, Math.round(Number(loan.remainingDebt || 0)));
  if(!confirm(`¿Pagar ahora la totalidad del préstamo? Se descontarán ${formatMoney(amount)} del presupuesto del club.`)) return;
  loan.remainingDebt = 0;
  loan.paid = Math.max(0, Math.round(Number(loan.paid || 0) + amount));
  loan.remainingWeeks = 0;
  recordBudgetChange(-amount, `Cancelación total préstamo ${loan.bankName}`, { type:'bank_loan_full_payment', bankName:loan.bankName, loanId:loan.id, remainingDebt:0, remainingWeeks:0 });
  state.history = Array.isArray(state.history) ? state.history : [];
  state.history.push({ type:'paid_full', date:game.currentDate || '', bankName:loan.bankName, amount:loan.amount, paid:loan.paid });
  state.active = null;
  state.offers = [];
  pushGameMessage({ type:'finanzas', title:'Préstamo cancelado', body:`El club pagó la totalidad restante del préstamo de ${loan.bankName}.`, priority:'normal' });
  saveLocal(true);
  renderFinances();
  showNotice('Préstamo cancelado por pago total.');
}
function bankLoanProgressMarkup(loan){
  const paid = Math.max(0, Math.round(Number(loan.paid || 0)));
  const total = Math.max(1, Math.round(Number(loan.totalToRepay || (paid + loan.remainingDebt) || 1)));
  const progress = clamp(Math.round((paid / total) * 100), 0, 100);
  const nextText = validIsoDate(loan.nextPaymentDate) ? ` · Próxima cuota: ${escapeHtml(loan.nextPaymentDate)}` : '';
  return `<div class="bank-loan-active"><div class="row"><div><p class="label">Préstamo activo</p><h3>${escapeHtml(loan.bankName)}</h3></div><span class="pill">${loan.remainingWeeks} semanas restantes</span></div><div class="bar transfer-budget-bar"><span style="width:${progress}%"></span></div><p class="muted small">Pagado: ${formatMoney(paid)} / ${formatMoney(total)} · Deuda restante: ${formatMoney(loan.remainingDebt)} · Cuota semanal: ${formatMoney(loan.weeklyPayment)}${nextText}</p><button class="ghost danger small" data-payoff-bank-loan>Cancelar préstamo completo</button></div>`;
}
function bankLoanOffersMarkup(){
  if(!BANK_LOANS_ENABLED) return '';
  const state = ensureBankLoanState();
  if(state.active){
    return `<div class="card bank-loan-card"><div class="row"><div><h3>Banco</h3><p class="muted small">Con un préstamo activo se bloquean nuevas solicitudes.</p></div></div>${bankLoanProgressMarkup(state.active)}</div>`;
  }
  const offers = state.offers || [];
  const prestige = currentManagerPrestige();
  const cards = offers.map(offer => {
    const locked = prestige < offer.prestigeCost;
    return `<div class="card bank-loan-offer"><div class="row"><div><p class="label">${escapeHtml(offer.bankName)}</p><h3>${formatMoney(offer.amount)}</h3></div><span class="pill ${locked ? 'bad-pill' : 'ok-pill'}">Prestigio ${offer.prestigeCost}</span></div><p class="muted small">Interés ${loanPercentLabel(offer.interestRate)} · ${offer.weeks} semanas · Total a devolver ${formatMoney(offer.totalToRepay)} · Cuota ${formatMoney(offer.weeklyPayment)}</p><button class="primary" data-request-bank-loan="${escapeHtml(offer.id)}" ${locked ? 'disabled' : ''}>Pedir préstamo</button></div>`;
  }).join('');
  return `<div class="card bank-loan-card"><div class="row"><div><h3>Banco</h3><p class="muted small">Tres ofertas por temporada. Tomar una resta prestigio al manager y suma el dinero al club.</p></div><span class="pill">Prestigio actual ${formatManagerPrestige(prestige)}</span></div><div class="grid cols-3 bank-loans-grid" style="margin-top:12px">${cards || '<p class="muted">No hay ofertas bancarias hasta la próxima temporada.</p>'}</div></div>`;
}
function financeRating(salaryTotal=0){
  const salaries = Math.max(1, Math.round(Number(salaryTotal || 0)));
  const budget = Math.max(0, Math.round(Number(game?.budget || 0)));
  const ratio = budget / salaries;
  if(ratio < 10) return { key:'destroyed', label:'economia destruida', tone:'bad', message:'La directiva alerta que el margen para sostener sueldos es crítico. Hay que vender, subir ingresos o recortar gastos.' };
  if(ratio < 20) return { key:'problems', label:'economia en problemas', tone:'bad', message:'La directiva ve riesgo financiero. El club puede competir, pero el margen es bajo.' };
  if(ratio < 40) return { key:'regular', label:'economia regular', tone:'warn', message:'La directiva considera que la economía está estable, aunque sin gran respaldo para errores.' };
  if(ratio < 50) return { key:'good', label:'economia buena', tone:'ok', message:'La directiva está conforme. Hay margen razonable para sostener el proyecto.' };
  return { key:'excellent', label:'economia excelente', tone:'ok', message:'La directiva está muy conforme. El club tiene una espalda financiera fuerte frente a la masa salarial.' };
}
function financeRatingMarkup(salaryTotal=0){
  const rating = financeRating(salaryTotal);
  const salaries = Math.max(1, Math.round(Number(salaryTotal || 0)));
  const budget = Math.max(0, Math.round(Number(game?.budget || 0)));
  return `<div class="card finance-rating-card"><div class="row"><div><p class="label">Calificación</p><h3 class="${rating.tone}">${escapeHtml(rating.label)}</h3></div><span class="pill">${Math.floor(budget / salaries)}x sueldos</span></div><p class="muted small">${escapeHtml(rating.message)}</p><p class="muted small">Referencia: presupuesto actual ${formatMoney(budget)} / sueldos anuales ${formatMoney(salaryTotal)}.</p></div>`;
}

function bindBankAccountActions(){
  document.querySelectorAll('[data-request-bank-loan]').forEach(btn => btn.addEventListener('click', () => requestBankLoan(btn.dataset.requestBankLoan)));
  document.querySelector('[data-payoff-bank-loan]')?.addEventListener('click', () => payOffBankLoanFull());
}
function renderBankAccount(){
  const finances = typeof ensureManagerFinancesState === 'function'
    ? ensureManagerFinancesState(game)
    : { balance:0, totalIncome:0, totalExpenses:0, totalSalaryIncome:0, history:[] };
  const contract = typeof managerJobContractForClubSeason === 'function'
    ? managerJobContractForClubSeason(game?.selectedClubId, game?.seasonNumber || 1)
    : null;
  const history = (Array.isArray(finances?.history) ? finances.history : []).slice().reverse();
  const rows = history.map(entry => {
    const delta = Number(entry.delta || 0);
    const cls = delta > 0 ? 'ok' : delta < 0 ? 'bad' : 'muted';
    return `<tr><td>${escapeHtml(entry.date || '—')}</td><td>${escapeHtml(entry.concept || 'Movimiento')}</td><td><span class="${cls}">${delta > 0 ? '+' : ''}${formatMoney(delta)}</span></td><td>${formatMoney(entry.balance || 0)}</td></tr>`;
  }).join('');
  const nextPayment = contract?.nextSalaryDate || 'Sin contrato activo';
  const salary = contract && typeof managerContractMonthlySalaryForSeason === 'function' ? managerContractMonthlySalaryForSeason(contract, game?.seasonNumber || 1) : Number(contract?.monthlySalary || 0);
  view.innerHTML = `<div class="row section-title"><div><h2>Cuenta Bancaria</h2><p class="tagline">Patrimonio personal del manager, separado del presupuesto de los clubes.</p></div><span class="pill">Saldo ${formatMoney(finances?.balance || 0)}</span></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Saldo personal</p><strong class="${budgetTone(finances?.balance || 0)}">${formatMoney(finances?.balance || 0)}</strong></div>
      <div class="card"><p class="label">Sueldos cobrados</p><strong class="ok">${formatMoney(finances?.totalSalaryIncome || 0)}</strong></div>
      <div class="card"><p class="label">Sueldo mensual actual</p><strong>${salary > 0 ? formatMoney(salary) : '—'}</strong></div>
      <div class="card"><p class="label">Próximo cobro</p><strong>${escapeHtml(nextPayment)}</strong></div>
    </div>
    <div class="card" style="margin-top:14px"><div class="row"><div><p class="label">Separación patrimonial</p><h3>El dinero personal no pertenece al club</h3></div></div><p class="muted small">Los sueldos salen de Finanzas del club e ingresan aquí cada 30 días. Todos los gastos de Tu Academia también se descuentan de esta cuenta. Los préstamos continúan perteneciendo al club.</p></div>
    <div class="card" style="margin-top:14px"><h3>Movimientos personales</h3><div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Concepto</th><th>Monto</th><th>Saldo</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Todavía no hay movimientos personales.</td></tr>'}</tbody></table></div></div>`;
}

function renderFinances(){
  if(String(financeViewMode || 'main') === 'bank'){ renderBankAccount(); return; }
  if(typeof managerWithoutClubActive === 'function' ? managerWithoutClubActive() : Boolean(game?.gameOver?.active)){
    view.innerHTML = `<div class="section-title compact-section-title"><h2>Finanzas</h2><p class="tagline">Sin club activo.</p></div><div class="card"><p class="label">Finanzas vacías</p><h3>Actualmente no gestionás ningún presupuesto</h3><p class="muted small">Al renunciar o ser despedido se vacían las finanzas del menú lateral. Cuando firmes con otro club se cargará la economía del nuevo equipo.</p></div>`;
    return;
  }
  const history = (game.budgetHistory || []).slice().reverse();
  const seasonExpenses = (game.budgetHistory || []).filter(h => (h.season || game.seasonNumber || 1) === (game.seasonNumber || 1) && Number(h.delta || 0) < 0).reduce((a,h)=>a+Math.abs(Number(h.delta || 0)),0);
  const seasonIncome = (game.budgetHistory || []).filter(h => (h.season || game.seasonNumber || 1) === (game.seasonNumber || 1) && Number(h.delta || 0) > 0).reduce((a,h)=>a+Number(h.delta || 0),0);
  const salaryTotal = totalClubSalary(game.selectedClubId);
  const groupedHistory = financeGroupedEntries(history).slice(0,80);
  const rows = groupedHistory.map(entry => {
    const delta = Number(entry.delta || 0);
    const cls = delta > 0 ? 'ok' : delta < 0 ? 'bad' : 'muted';
    const ticketText = Number(entry.ticketRevenue || 0) > 0 ? ` <span class="pill finance-mini-pill">Recaudación ${formatMoney(entry.ticketRevenue)}</span>` : '';
    return `<tr><td>Temp. ${entry.season || game.seasonNumber || 1}<br><span class="muted small">${financeDateLabel(entry)}</span></td><td>${escapeHtml(budgetConcept(entry))}${financeCountBadge(entry)}${ticketText}</td><td><span class="${cls}">${delta > 0 ? '+' : ''}${formatMoney(delta)}</span></td><td><span class="${budgetTone(entry.latestBudget ?? entry.budget ?? 0)}">${formatMoney(entry.latestBudget ?? entry.budget ?? 0)}</span></td></tr>`;
  }).join('');
  view.innerHTML = `
    <div class="row section-title"><div><h2>Finanzas</h2><p class="tagline">Detalle del presupuesto, sus movimientos registrados y la masa salarial del plantel.</p></div></div>
    <div class="grid cols-4 compact-team-stats">
      <div class="card"><p class="label">Presupuesto actual</p><strong class="${budgetTone(game.budget || 0)}">${formatMoney(game.budget || 0)}</strong></div>
      <div class="card"><p class="label">Ingresos temporada</p><strong class="ok">${formatMoney(seasonIncome)}</strong></div>
      <div class="card"><p class="label">Gastos temporada</p><strong class="bad">${formatMoney(seasonExpenses)}</strong></div>
      <div class="card"><p class="label">Sueldos anuales estimados</p><strong>${formatMoney(salaryTotal)}</strong></div>
    </div>
    <div class="grid cols-2" style="margin-top:14px">
      ${financeRatingMarkup(salaryTotal)}
      ${bankLoanOffersMarkup()}
    </div>
    <div style="margin-top:14px">${typeof transferBudgetSummaryMarkup === 'function' ? transferBudgetSummaryMarkup() : ''}</div>
    ${typeof founderAdministrativeCostsMarkup === 'function' ? founderAdministrativeCostsMarkup() : ''}
    <div class="grid cols-2 finance-category-grid" style="margin-top:14px">
      ${financeExpensesByCategoryMarkup()}
      ${financeIncomeByCategoryMarkup()}
    </div>
    <div class="card finance-salary-card" style="margin-top:14px"><h3>Plantel y sueldos</h3>
      <div class="table-wrap"><table><thead><tr><th>Jugador</th><th>Nac.</th><th>Edad</th><th>Media</th><th>Sueldo anual</th></tr></thead><tbody>${financeSquadRows() || '<tr><td colspan="5" class="muted">No hay jugadores en el plantel.</td></tr>'}</tbody></table></div>
    </div>
    <div class="card" style="margin-top:14px"><h3>Movimientos agrupados</h3><p class="muted small">Los conceptos iguales se consolidan para leer mejor el historial. La lista de sueldos del plantel queda siempre visible.</p>
      <div class="table-wrap"><table><thead><tr><th>Temporada</th><th>Concepto</th><th>Monto</th><th>Presupuesto luego</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="muted">Todavía no hay movimientos registrados.</td></tr>'}</tbody></table></div>
    </div>`;
  bindBankAccountActions();
}

function totalClubSalary(clubId){
  return playersByClub(clubId).reduce((sum,p)=>sum + Math.max(0, Number(p.salary || 0)), 0);
}
function hasPlayerSalaryPaid(player){
  return Number(player?.salaryPaidCount || 0) > 0 || Number(player?.lastSalaryPaidSeason || 0) > 0;
}
function markClubSalariesPaid(clubId){
  const season = Number(game?.seasonNumber || 1);
  playersByClub(clubId).forEach(player => {
    player.salaryPaidCount = Math.max(0, Number(player.salaryPaidCount || 0)) + 1;
    player.lastSalaryPaidSeason = season;
  });
}
function paySeasonSalaries(){
  const total = totalClubSalary(game.selectedClubId);
  if(total <= 0) return 0;
  markClubSalariesPaid(game.selectedClubId);
  recordBudgetChange(-total, `Pago anual de sueldos de ${clubName(game.selectedClubId)}`, { type:'season_salary' });
  return total;
}
function normalizeLeagueSeasonEconomyState(state={}){
  const source = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
  const seasons = source.seasons && typeof source.seasons === 'object' && !Array.isArray(source.seasons) ? source.seasons : {};
  return { version:1, seasons };
}
function leagueResultRoundMoney(value){
  const step = Math.max(1, Number(LEAGUE_RESULT_PAYMENT_ROUNDING || 1));
  return Math.max(0, Math.round(Number(value || 0) / step) * step);
}
function leagueSeasonEconomyDivisionSnapshot(division, season){
  if(!division?.id) return null;
  const clubs = (seed?.clubs || []).filter(club => {
    if(typeof isSpecialCompetitionOnlyClub === 'function' && isSpecialCompetitionOnlyClub(club)) return false;
    return String(club?.divisionId || '') === String(division.id);
  });
  if(!clubs.length) return null;
  const total = clubs.reduce((sum, club) => sum + Number(typeof clubPrestigeValue === 'function' ? clubPrestigeValue(club) : (club?.reputation || club?.prestigio || 0)), 0);
  const reputation = Number((total / clubs.length).toFixed(2));
  const effectiveReputation = clamp(reputation, LEAGUE_RESULT_REPUTATION_MIN, LEAGUE_RESULT_REPUTATION_MAX);
  const winAverageRaw = effectiveReputation * LEAGUE_RESULT_WIN_PER_REPUTATION;
  const drawAverageRaw = effectiveReputation * LEAGUE_RESULT_DRAW_PER_REPUTATION;
  return {
    season:Number(season || 1),
    divisionId:String(division.id),
    divisionName:String(division.name || division.id),
    country:String(division.country || division.pais || ''),
    clubCount:clubs.length,
    reputation,
    effectiveReputation:Number(effectiveReputation.toFixed(2)),
    victoryAverage:leagueResultRoundMoney(winAverageRaw),
    victoryMin:leagueResultRoundMoney(winAverageRaw * LEAGUE_RESULT_VARIATION_MIN),
    victoryMax:leagueResultRoundMoney(winAverageRaw * LEAGUE_RESULT_VARIATION_MAX),
    drawAverage:leagueResultRoundMoney(drawAverageRaw),
    drawMin:leagueResultRoundMoney(drawAverageRaw * LEAGUE_RESULT_VARIATION_MIN),
    drawMax:leagueResultRoundMoney(drawAverageRaw * LEAGUE_RESULT_VARIATION_MAX),
    lossPayment:Math.max(0, Number(LEAGUE_RESULT_LOSS_PAYMENT || 0))
  };
}
function ensureLeagueSeasonEconomyForSeason(targetGame=game, season=targetGame?.seasonNumber || 1, options={}){
  if(!targetGame) return null;
  targetGame.leagueSeasonEconomy = normalizeLeagueSeasonEconomyState(targetGame.leagueSeasonEconomy || {});
  const seasonKey = String(Math.max(1, Math.round(Number(season || 1))));
  const existing = targetGame.leagueSeasonEconomy.seasons[seasonKey];
  if(existing && !options.force) return existing;
  const divisions = {};
  (seed?.divisions || []).forEach(division => {
    const snapshot = leagueSeasonEconomyDivisionSnapshot(division, Number(seasonKey));
    if(snapshot) divisions[String(division.id)] = snapshot;
  });
  const entry = {
    season:Number(seasonKey),
    createdAt:new Date().toISOString(),
    reason:String(options.reason || 'season_start'),
    divisions
  };
  targetGame.leagueSeasonEconomy.seasons[seasonKey] = entry;
  return entry;
}
function leagueSeasonEconomyEntry(season=game?.seasonNumber || 1){
  return ensureLeagueSeasonEconomyForSeason(game, season) || null;
}
function leagueSeasonEconomyForDivision(divisionId, season=game?.seasonNumber || 1){
  const entry = leagueSeasonEconomyEntry(season);
  return entry?.divisions?.[String(divisionId || '')] || null;
}
function leagueEconomyDivisionIdForMatch(match){
  if(match?.clubWorldCup || match?.libertadores || match?.championsLeague || String(match?.divisionId || '') === 'club-world-cup') return '';
  const explicit = String(match?.divisionId || '').trim();
  if(explicit && (seed?.divisions || []).some(division => String(division.id) === explicit)) return explicit;
  const club = (seed?.clubs || []).find(item => Number(item.id) === Number(game?.selectedClubId));
  return String(club?.divisionId || '');
}
function leagueSeasonEconomyMessageForClub(clubId=game?.selectedClubId, season=game?.seasonNumber || 1){
  const club = (seed?.clubs || []).find(item => Number(item.id) === Number(clubId));
  const snapshot = leagueSeasonEconomyForDivision(club?.divisionId, season);
  if(!snapshot) return '';
  return `La reputación anual de ${snapshot.divisionName} quedó en ${snapshot.reputation}; una victoria paga entre ${formatMoney(snapshot.victoryMin)} y ${formatMoney(snapshot.victoryMax)}, y un empate entre ${formatMoney(snapshot.drawMin)} y ${formatMoney(snapshot.drawMax)}.`;
}
function leagueResultPaymentForMatch(match, gf, gc){
  if(!LEAGUE_RESULT_PAYMENTS_ENABLED) return { amount:0, result:'disabled', snapshot:null };
  const divisionId = leagueEconomyDivisionIdForMatch(match);
  const snapshot = divisionId ? leagueSeasonEconomyForDivision(divisionId) : null;
  if(!snapshot) return { amount:0, result:'unavailable', snapshot:null };
  const variation = rnd(LEAGUE_RESULT_VARIATION_MIN, LEAGUE_RESULT_VARIATION_MAX);
  if(gf > gc) return { amount:leagueResultRoundMoney(snapshot.effectiveReputation * LEAGUE_RESULT_WIN_PER_REPUTATION * variation), result:'victory', snapshot };
  if(gf === gc) return { amount:leagueResultRoundMoney(snapshot.effectiveReputation * LEAGUE_RESULT_DRAW_PER_REPUTATION * variation), result:'draw', snapshot };
  return { amount:Math.max(0, Math.round(Number(snapshot.lossPayment || 0))), result:'loss', snapshot };
}
function applyEconomyResult(match){
  noteOwnMatchForMonthlyExpenses(match);
  if(match?.clubWorldCup || match?.nationalCup || (match?.libertadores && match?.neutralVenue) || (match?.championsLeague && match?.neutralVenue) || String(match?.divisionId || '') === 'club-world-cup') return 0;
  const isHome = Number(match.homeId) === Number(game.selectedClubId);
  const gf = isHome ? Number(match.homeGoals || 0) : Number(match.awayGoals || 0);
  const gc = isHome ? Number(match.awayGoals || 0) : Number(match.homeGoals || 0);
  const payment = leagueResultPaymentForMatch(match, gf, gc);
  const resultPayment = Math.max(0, Math.round(Number(payment.amount || 0)));
  const ticketRevenue = isHome ? Math.max(0, Math.round(Number(match?.matchContext?.ticketRevenue || 0))) : 0;
  const totalDelta = resultPayment + ticketRevenue;
  if(totalDelta <= 0) return 0;
  const resultLabel = payment.result === 'victory' ? 'Victoria' : payment.result === 'draw' ? 'Empate' : payment.result === 'loss' ? 'Derrota' : 'Partido';
  const concept = resultPayment > 0 && ticketRevenue > 0
    ? `${resultLabel} + recaudación de entradas`
    : resultPayment > 0 ? `Pago por ${resultLabel.toLowerCase()}` : 'Recaudación de entradas';
  recordBudgetChange(totalDelta, concept, {
    matchId:match.id,
    divisionId:payment.snapshot?.divisionId || match?.divisionId || '',
    divisionName:payment.snapshot?.divisionName || match?.divisionName || '',
    leagueReputation:payment.snapshot?.reputation ?? null,
    effectiveLeagueReputation:payment.snapshot?.effectiveReputation ?? null,
    resultPayment,
    resultType:payment.result,
    ticketRevenue,
    ticketRevenueBeforeMarketing:match?.matchContext?.ticketRevenueBeforeMarketing || ticketRevenue,
    marketingRevenueBonus:match?.matchContext?.marketingRevenueBonus || 0,
    marketingBonusPct:match?.matchContext?.marketingBonusPct || 0,
    ticketPrice:match?.matchContext?.ticketPrice || 0,
    totalFans:match?.matchContext?.totalFans || 0,
    rivalPrestige:match?.matchContext?.rivalPrestige || 0,
    rivalPrestigeAttendanceBonusPct:match?.matchContext?.rivalPrestigeAttendanceBonusPct || 0
  });
  return totalDelta;
}
function afaFieldSanctionState(clubId=game?.selectedClubId){
  if(!game || !clubId) return null;
  ensureStadiumState();
  const id = Number(clubId);
  const raw = game.stadium.afaFieldSanctions[id] && typeof game.stadium.afaFieldSanctions[id] === 'object'
    ? game.stadium.afaFieldSanctions[id]
    : {};
  const clean = {
    status:String(raw.status || ''),
    chargedDate:validIsoDate(raw.chargedDate) ? raw.chargedDate : '',
    restoreDate:validIsoDate(raw.restoreDate) ? raw.restoreDate : '',
    restoredDate:validIsoDate(raw.restoredDate) ? raw.restoredDate : '',
    fieldBefore:Math.max(0, Math.round(Number(raw.fieldBefore || 0))),
    fine:Math.max(0, Math.round(Number(raw.fine || 0))),
    replantCost:Math.max(0, Math.round(Number(raw.replantCost || 0))),
    totalCharged:Math.max(0, Math.round(Number(raw.totalCharged || 0))),
    season:Math.max(0, Math.round(Number(raw.season || 0)))
  };
  game.stadium.afaFieldSanctions[id] = clean;
  return clean;
}
function processAfaFieldSanctionDaily(){
  const result = { sanctioned:false, restored:false, charged:0, clubId:Number(game?.selectedClubId || 0), restoreDate:'' };
  if(!AFA_FIELD_SANCTION_ENABLED || !game?.selectedClubId || game?.gameOver?.active) return result;
  const today = validIsoDate(game.currentDate) ? game.currentDate : (typeof currentCalendarDate === 'function' ? currentCalendarDate() : '');
  if(!validIsoDate(today)) return result;
  const clubId = Number(game.selectedClubId);
  const state = afaFieldSanctionState(clubId);
  if(!state) return result;
  const project = stadiumProjectForClub(clubId);
  if(state.status === 'pending' && validIsoDate(state.restoreDate) && today >= state.restoreDate){
    project.replantingTurnsLeft = 0;
    project.patchingTurnsLeft = 0;
    game.stadium.fields[clubId] = AFA_FIELD_RESTORED_SCORE;
    state.status = 'restored';
    state.restoredDate = today;
    result.restored = true;
    if(typeof pushGameMessage === 'function') pushGameMessage({
      type:'estadio',
      priority:'normal',
      title:'Replante obligatorio finalizado',
      body:`La AFA terminó el replante obligatorio y el campo quedó en ${AFA_FIELD_RESTORED_SCORE}/100.`,
      id:`afa-field-restored-${clubId}-${today}`
    });
  }
  const score = fieldScoreForClub(clubId);
  const alreadyPending = state.status === 'pending' && validIsoDate(state.restoreDate);
  if(score >= AFA_FIELD_SANCTION_THRESHOLD || alreadyPending || state.chargedDate === today) return result;
  project.replantingTurnsLeft = 0;
  project.patchingTurnsLeft = 0;
  const restoreDate = addDaysToIsoDate(today, AFA_FIELD_RESTORE_DAYS);
  if(AFA_FIELD_SANCTION_FINE > 0) recordBudgetChange(-AFA_FIELD_SANCTION_FINE, 'Multa AFA por campo en estado crítico', { type:'stadium_afa_field_fine', clubId, fieldScore:score, threshold:AFA_FIELD_SANCTION_THRESHOLD });
  if(AFA_FIELD_MANDATORY_REPLANT_COST > 0) recordBudgetChange(-AFA_FIELD_MANDATORY_REPLANT_COST, 'Replante obligatorio de césped impuesto por AFA', { type:'stadium_afa_mandatory_replant', clubId, fieldScore:score, restoreDate });
  state.status = 'pending';
  state.chargedDate = today;
  state.restoreDate = restoreDate;
  state.restoredDate = '';
  state.fieldBefore = score;
  state.fine = AFA_FIELD_SANCTION_FINE;
  state.replantCost = AFA_FIELD_MANDATORY_REPLANT_COST;
  state.totalCharged = AFA_FIELD_SANCTION_FINE + AFA_FIELD_MANDATORY_REPLANT_COST;
  state.season = Number(game.seasonNumber || 1);
  result.sanctioned = true;
  result.charged = state.totalCharged;
  result.restoreDate = restoreDate;
  if(typeof pushGameMessage === 'function') pushGameMessage({
    type:'estadio',
    priority:'high',
    title:'Sanción de AFA por el estado del campo',
    body:`El campo estaba en ${score}/100, por debajo del mínimo permitido. La AFA aplicó una multa de ${formatMoney(AFA_FIELD_SANCTION_FINE)} y cobró ${formatMoney(AFA_FIELD_MANDATORY_REPLANT_COST)} por un replante obligatorio. El césped quedará en ${AFA_FIELD_RESTORED_SCORE}/100 el ${restoreDate}.`,
    id:`afa-field-sanction-${clubId}-${today}`
  });
  return result;
}
function afaFieldInterventionActive(clubId=game?.selectedClubId){
  if(!AFA_FIELD_SANCTION_ENABLED || !game || !clubId) return false;
  const state = afaFieldSanctionState(clubId);
  return Boolean((state?.status === 'pending' && validIsoDate(state.restoreDate)) || fieldScoreForClub(clubId) < AFA_FIELD_SANCTION_THRESHOLD);
}
function afaFieldSanctionMarkup(clubId=game?.selectedClubId){
  if(!AFA_FIELD_SANCTION_ENABLED || !game || !clubId) return '';
  const state = afaFieldSanctionState(clubId);
  const score = fieldScoreForClub(clubId);
  if(state?.status === 'pending' && validIsoDate(state.restoreDate)){
    return `<div class="card blocker danger afa-field-sanction-card"><p class="label">Intervención de AFA</p><strong>Replante obligatorio en curso</strong><p class="muted small">Se cobraron ${formatMoney(state.totalCharged || (AFA_FIELD_SANCTION_FINE + AFA_FIELD_MANDATORY_REPLANT_COST))}. El campo quedará en ${AFA_FIELD_RESTORED_SCORE}/100 el ${escapeHtml(state.restoreDate)}.</p></div>`;
  }
  if(score < AFA_FIELD_SANCTION_THRESHOLD){
    return `<div class="card blocker danger afa-field-sanction-card"><p class="label">Campo en estado crítico</p><strong>La AFA sancionará al club al comenzar el próximo día</strong><p class="muted small">Multa: ${formatMoney(AFA_FIELD_SANCTION_FINE)} · replante obligatorio: ${formatMoney(AFA_FIELD_MANDATORY_REPLANT_COST)}.</p></div>`;
  }
  return '';
}

