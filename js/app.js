// js/app.js
// Простая клиентская симуляция торгов для GitHub Pages (localStorage)
// Изменения: удалён stop-loss; добавлена минимальная интеграция с Telegram Web App

// --- Настройки начальные ---
const DEFAULT_BALANCE = 1000;
const COINS = {
  BTC: { price: 0.023, name: "BTC", volatility: 0.002 },
  ETH: { price: 0.0065, name: "ETH", volatility: 0.003 },
  XRP: { price: 0.0008, name: "XRP", volatility: 0.004 }
};
const PRICES_HISTORY_LENGTH = 100;

// --- State в localStorage ---
const STORAGE_KEYS = {
  BALANCE: 'tg_trade_balance_v1',
  HISTORY: 'tg_trade_history_v1',
  RANKING: 'tg_trade_ranking_v1',
  STATE: 'tg_trade_state_v1'
};

let state = {
  balance: DEFAULT_BALANCE,
  free: DEFAULT_BALANCE,
  history: [],
  ranking: [],
  prices: {},
  active: null
};

// --- UI элементы ---
const balanceDisplay = document.getElementById('balanceDisplay');
const freeDisplay = document.getElementById('freeDisplay');
const entryInfo = coin => document.getElementById(`entry-${coin}`);
const priceElem = coin => document.getElementById(`price-${coin}`);
const changeElem = coin => document.getElementById(`change-${coin}`);
const historyList = document.getElementById('historyList');
const rankingList = document.getElementById('rankingList');
const activePositionDiv = document.getElementById('activePosition');

const marginInput = document.getElementById('marginInput');
const tradeCoinSel = document.getElementById('tradeCoin');
const leverageSel = document.getElementById('leverage');
const sideSel = document.getElementById('side');
const takeInput = document.getElementById('takeInput');
const openBtn = document.getElementById('openBtn');
const closeBtn = document.getElementById('closeBtn');

const pnlBox = document.getElementById('pnl');
const liqBox = document.getElementById('liq');

const applyBalanceBtn = document.getElementById('applyBalanceBtn');
const startBalanceInput = document.getElementById('startBalance');
const resetBtn = document.getElementById('resetBtn');

// tabs
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click', ()=> {
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    const tab = btn.dataset.tab;
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById(tab).classList.add('active');
  });
});

// open trade from mini card
document.querySelectorAll('.open-trade').forEach(b=>{
  b.addEventListener('click', e=>{
    tradeCoinSel.value = e.target.dataset.coin;
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="trade"]').classList.add('active');
    document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
    document.getElementById('trade').classList.add('active');
    window.scrollTo(0,0);
  })
})

// --- Storage helpers ---
function saveState(){
  localStorage.setItem(STORAGE_KEYS.BALANCE, JSON.stringify({balance: state.balance, free: state.free}));
  localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(state.history));
  localStorage.setItem(STORAGE_KEYS.RANKING, JSON.stringify(state.ranking));
  localStorage.setItem(STORAGE_KEYS.STATE, JSON.stringify(state.active));
}
function loadState(){
  try{
    const b = JSON.parse(localStorage.getItem(STORAGE_KEYS.BALANCE));
    const h = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY));
    const r = JSON.parse(localStorage.getItem(STORAGE_KEYS.RANKING));
    const s = JSON.parse(localStorage.getItem(STORAGE_KEYS.STATE));
    if(b && typeof b.balance === 'number'){ state.balance = b.balance; state.free = b.free; }
    else { state.balance = DEFAULT_BALANCE; state.free = DEFAULT_BALANCE; }
    state.history = Array.isArray(h)?h: [];
    state.ranking = Array.isArray(r)?r: [];
    state.active = s || null;
  } catch(e){ console.warn('load failed', e) }
}

// --- Price simulation ---
function initPrices(){
  Object.keys(COINS).forEach(key=>{
    const start = COINS[key].price;
    state.prices[key] = Array(PRICES_HISTORY_LENGTH).fill().map((_,i)=> start * (1 + 0.001*Math.sin(i/5)));
  });
}
function tickPrices(){
  Object.keys(COINS).forEach(key=>{
    const vol = COINS[key].volatility;
    const last = state.prices[key][state.prices[key].length-1];
    const change = (Math.random() - 0.5) * vol * (1 + (Math.random()-0.5)*0.5);
    let next = Math.max(0.000001, last * (1 + change));
    state.prices[key].push(next);
    if(state.prices[key].length > PRICES_HISTORY_LENGTH) state.prices[key].shift();
  });
}

// --- Charts (Chart.js) ---
const miniCharts = {};
const bigChartCtx = document.getElementById('bigChart').getContext('2d');
let bigChart;
function createMiniCharts(){
  Object.keys(COINS).forEach(key=>{
    const ctx = document.getElementById(`chart-${key}`).getContext('2d');
    miniCharts[key] = new Chart(ctx, {
      type: 'line',
      data: { labels: state.prices[key].map((_,i)=>i), datasets:[{data: state.prices[key], borderWidth:1, tension:0.25, pointRadius:0}]},
      options:{responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{x:{display:false}, y:{display:false}}}
    });
  });
}
function updateMiniCharts(){
  Object.keys(miniCharts).forEach(key=>{
    const ch = miniCharts[key];
    ch.data.datasets[0].data = state.prices[key];
    ch.update('none');
    const last = state.prices[key][state.prices[key].length-1];
    priceElem(key).textContent = numberFormat(last) + ' $';
    const prev = state.prices[key][state.prices[key].length-2] || last;
    const diff = (last - prev)/prev*100;
    changeElem(key).textContent = (diff>=0?'+':'')+diff.toFixed(2)+'%';
    changeElem(key).style.color = diff>=0 ? '#7be495' : '#ff9b99';
  });
}
function createBigChart(){
  bigChart = new Chart(bigChartCtx, {
    type: 'line',
    data: { labels: state.prices.BTC.map((_,i)=>i), datasets:[{label:'Price', data: state.prices.BTC, borderWidth:1, tension:0.2, pointRadius:0}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}},
      scales:{x:{display:true}, y:{display:true}}
    }
  });
}
function updateBigChart(coin){
  if(!bigChart) createBigChart();
  bigChart.data.labels = state.prices[coin].map((_,i)=>i);
  bigChart.data.datasets[0].data = state.prices[coin];
  bigChart.update('none');
}

// --- Utils ---
function numberFormat(n){ return (Math.round(n*1000000)/1000000).toFixed(6).replace(/\.?0+$/,'') }

// --- Trade logic ---
// Open position: margin from free balance is reserved. position object stored in state.active
function openPosition({coin, margin, leverage, side, take}){
  margin = Number(margin);
  leverage = Number(leverage);
  if(!coin || margin <= 0 || margin > state.free) return {ok:false, msg:'Неверная маржа'};
  const price = state.prices[coin][state.prices[coin].length-1];
  const positionSize = margin * leverage; // в USD
  const quantity = positionSize / price; // количество монеты
  state.free -= margin;
  state.active = {
    coin, margin, leverage, side, entryPrice: price, positionSize, quantity,
    take: take || null, openedAt: Date.now()
  };
  saveState();
  pushHistory({type:'open', coin, side, margin, leverage, price, time:Date.now()});
  renderAll();
  return {ok:true};
}

function closePosition(closedBy='manual', closePrice=null){
  if(!state.active) return;
  const p = state.active;
  const price = closePrice || state.prices[p.coin][state.prices[p.coin].length-1];
  const pnlPercent = (price - p.entryPrice) / p.entryPrice;
  const rawPL = p.positionSize * pnlPercent * (p.side === 'long' ? 1 : -1);
  const profit = Math.round(rawPL * 100) / 100;
  const marginReturn = p.margin + profit;
  if(marginReturn <= 0){
    state.balance = 0;
    state.free = 0;
  } else {
    state.free += marginReturn;
    state.balance = Math.max(0, state.free);
  }

  pushHistory({
    type: closedBy === 'liquidation' ? 'liquidation' : 'close',
    coin: p.coin, side: p.side, entry: p.entryPrice, close: price, pnl: profit, margin: p.margin, leverage: p.leverage, time: Date.now()
  });

  updateRanking();

  state.active = null;
  saveState();
  renderAll();
}

function checkTakeAndLiquidation(){
  if(!state.active) return;
  const p = state.active;
  const last = state.prices[p.coin][state.prices[p.coin].length-1];

  // check take
  if(p.take){
    if((p.side === 'long' && last >= p.take) || (p.side === 'short' && last <= p.take)){
      closePosition('take', last);
      return;
    }
  }
  // check liquidation
  const pnlPercent = (last - p.entryPrice) / p.entryPrice;
  const rawPL = p.positionSize * pnlPercent * (p.side === 'long' ? 1 : -1);
  const loss = -Math.min(0, rawPL);
  if(loss >= p.margin){
    closePosition('liquidation', last);
    return;
  }
}

// --- History & ranking helpers ---
function pushHistory(item){
  state.history.unshift(item);
  if(state.history.length > 200) state.history.length = 200;
  saveState();
}

function updateRanking(){
  const player = {name: "You", balance: state.balance, updated: Date.now()};
  const idx = state.ranking.findIndex(r=>r.name===player.name);
  if(idx>=0) state.ranking[idx] = player;
  else state.ranking.push(player);
  state.ranking.sort((a,b)=>b.balance - a.balance);
  if(state.ranking.length>50) state.ranking.length=50;
  saveState();
}

// --- Render UI ---
function renderBalance(){
  balanceDisplay.textContent = state.balance.toFixed(2);
  freeDisplay.textContent = state.free.toFixed(2);
}
function renderHistory(){
  historyList.innerHTML = '';
  if(state.history.length===0) historyList.textContent = 'Нет сделок';
  state.history.forEach(h=>{
    const div = document.createElement('div');
    div.className='history-item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${h.type.toUpperCase()}</strong> ${h.coin || ''} ${h.side?(' '+h.side):''}`;
    const right = document.createElement('div');
    if(h.type==='open') right.textContent = `${h.margin}$ ${h.leverage}x @${numberFormat(h.price)}$`;
    else if(h.type==='close' || h.type==='liquidation') right.textContent = `${h.pnl>=0?'+':''}${h.pnl}$ @${numberFormat(h.close)}$`;
    else right.textContent = '';
    div.appendChild(left); div.appendChild(right);
    historyList.appendChild(div);
  });
}
function renderRanking(){
  rankingList.innerHTML = '';
  if(state.ranking.length===0) rankingList.textContent = 'Рейтинг пуст';
  state.ranking.forEach((r,i)=>{
    const div = document.createElement('div');
    div.className = 'history-item';
    div.innerHTML = `<div>#${i+1} ${r.name}</div><div>${r.balance.toFixed(2)}$</div>`;
    rankingList.appendChild(div);
  });
}
function renderActive(){
  const p = state.active;
  if(!p){
    activePositionDiv.innerHTML = 'Нет открытой позиции.';
    closeBtn.disabled = true;
    pnlBox.textContent = '—';
    liqBox.textContent = '—';
    Object.keys(COINS).forEach(c=> entryInfo(c).textContent = 'Нет позиций');
    return;
  }
  closeBtn.disabled = false;
  const last = state.prices[p.coin][state.prices[p.coin].length-1];
  const pnlPercent = (last - p.entryPrice) / p.entryPrice;
  const rawPL = p.positionSize * pnlPercent * (p.side === 'long' ? 1 : -1);
  const profit = Math.round(rawPL * 100) / 100;
  pnlBox.textContent = `${profit >=0?'+':''}${profit}$ (${(pnlPercent*100*(p.side==='long'?1:-1)).toFixed(2)}%)`;

  let liqPrice;
  if(p.side === 'long'){
    const frac = -p.margin / p.positionSize;
    liqPrice = p.entryPrice * (1 + frac);
    liqPrice = Math.max(0.000001, liqPrice);
  } else {
    const frac = -p.margin / p.positionSize;
    liqPrice = p.entryPrice * (1 - frac);
  }
  liqBox.textContent = `${numberFormat(liqPrice)}$`;
  activePositionDiv.innerHTML = `
    <div><strong>${p.coin}</strong> ${p.side.toUpperCase()} ${p.leverage}x</div>
    <div>Вход: ${numberFormat(p.entryPrice)}$ • Кол-во: ${numberFormat(p.quantity)}</div>
    <div>Маржа: ${p.margin}$ • Позиция: ${p.positionSize}$</div>
    <div>Take: ${p.take ? numberFormat(p.take)+'$' : '—'}</div>
    <div>Тек. цена: ${numberFormat(last)}$ • P&L: <strong>${profit>=0?'+':''}${profit}$</strong></div>
  `;
  Object.keys(COINS).forEach(c=>{
    if(p.coin===c) entryInfo(c).textContent = `Открыта: ${p.side} ${p.leverage}x, P&L ${profit>=0?'+':''}${profit}$`;
  });
}

function renderAll(){
  renderBalance();
  updateMiniCharts();
  renderHistory();
  renderRanking();
  renderActive();
  updateBigChart(tradeCoinSel.value);
}

// --- Events ---
openBtn.addEventListener('click', ()=>{
  const coin = tradeCoinSel.value;
  const margin = Number(marginInput.value);
  const leverage = Number(leverageSel.value);
  const side = sideSel.value;
  const take = Number(takeInput.value) || null;
  if(margin <= 0){ alert('Укажите маржу > 0'); return;}
  if(margin > state.free){ alert('Недостаточно свободного баланса'); return;}
  const res = openPosition({coin, margin, leverage, side, take});
  if(!res.ok) alert(res.msg || 'Ошибка');
});

closeBtn.addEventListener('click', ()=>{
  if(!state.active) return;
  if(!confirm('Закрыть открытую позицию сейчас?')) return;
  closePosition('manual');
});

applyBalanceBtn.addEventListener('click', ()=>{
  const v = Number(startBalanceInput.value);
  if(v <= 0) return alert('Баланс должен быть > 0');
  state.balance = v;
  state.free = v;
  saveState();
  updateRanking();
  renderAll();
});

resetBtn.addEventListener('click', ()=>{
  if(!confirm('Сбросить все данные игры? Это удалит историю и рейтинг.')) return;
  localStorage.clear();
  location.reload();
});

// --- Main loop ---
function mainTick(){
  tickPrices();
  checkTakeAndLiquidation();
  renderAll();
}

// --- Telegram Web App integration (минимальная) ---
let tg = null;
function initTelegramWebApp(){
  try {
    if(window.Telegram && window.Telegram.WebApp){
      tg = window.Telegram.WebApp;
      tg.ready();
      // Пример использования: показываем название и баланс в MainButton
      try {
        tg.MainButton.setText(`Баланс: ${state.balance.toFixed(2)}$`);
        tg.MainButton.show();
      } catch(e){}
      // Можно реагировать на нажатие MainButton:
      tg.onEvent('mainButtonClicked', () => {
        // по нажатию кнопки в Telegram можно открыть вкладку рейтинга
        document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="ranking"]').classList.add('active');
        document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
        document.getElementById('ranking').classList.add('active');
      });
    }
  } catch(e){
    console.warn('Telegram WebApp init failed', e);
  }
}

// --- Init ---
function init(){
  loadState();
  if(typeof state.balance !== 'number') state.balance = DEFAULT_BALANCE;
  if(!state.prices || Object.keys(state.prices).length===0) initPrices();
  Object.keys(COINS).forEach(k=>{
    if(!state.prices[k]) state.prices[k] = Array(PRICES_HISTORY_LENGTH).fill(COINS[k].price);
  });
  createMiniCharts();
  createBigChart();
  renderAll();

  initTelegramWebApp();

  setInterval(mainTick, 1000);
}

init();
