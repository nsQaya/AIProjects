import { money,shortMoney,dateText,signedMoney } from "../../Core/Formatting/formatters.js";
import { escapeHtml } from "../../Core/Security/html.js";
import { icon } from "../../DesignSystem/icons.js";

export function DashboardView(state){
  const income=Number(state.dashboard.month?.income)||0,expense=Number(state.dashboard.month?.expense)||0;
  const netWorth=state.accounts.filter(a=>!a.isArchived).reduce((sum,a)=>sum+a.balance,0);
  const openUpcoming=state.upcoming.filter(item=>item.status==="PENDING"||item.status==="OVERDUE");
  const rangeLabels={"1M":"1 ay","3M":"3 ay","6M":"6 ay",YTD:"Yıl başı", "1Y":"1 yıl","5Y":"5 yıl","10Y":"10 yıl"};
  return `<section class="hero-card"><div class="hero-copy"><span class="hero-label">Canlı net hesap bakiyesi</span><strong>${money(netWorth)}</strong><span class="positive-chip">${icon("sync")} Neon PostgreSQL verisi</span></div><div class="hero-orbit"><span></span><span></span><b>₺</b></div></section>
  <section class="metric-grid" aria-label="Aylık özet">
    <article class="metric-card"><span class="metric-icon income">↙</span><div><small>Bu ay gelir</small><strong>${money(income)}</strong><em>Kaydedilmiş işlemler</em></div></article>
    <article class="metric-card"><span class="metric-icon expense">↗</span><div><small>Bu ay gider</small><strong>${money(expense)}</strong><em>Kaydedilmiş işlemler</em></div></article>
    <article class="metric-card"><span class="metric-icon net">◎</span><div><small>Aylık net</small><strong>${money(income-expense)}</strong><em>Gelir eksi gider</em></div></article>
  </section>
  <section class="dashboard-grid"><article class="panel cashflow-panel"><header class="panel-head cashflow-head"><div><h2>Nakit akışı</h2><p>${rangeLabels[state.cashflowRange]||"6 ay"} için gelir, gider ve dönem sonu bakiyesi</p></div><div class="range-switch" aria-label="Nakit akışı tarih aralığı">${Object.entries(rangeLabels).map(([value,label])=>`<button type="button" data-cashflow-range="${value}" class="${state.cashflowRange===value?"active":""}" aria-pressed="${state.cashflowRange===value}">${label}</button>`).join("")}</div></header>${cashflowChart(state)}</article>
  <article class="panel upcoming-card"><header class="panel-head"><div><h2>Yaklaşan</h2><p>Ödeme ve tahsilatlar</p></div><a href="#/upcoming">Tümünü gör ${icon("arrow")}</a></header><div class="upcoming-list">${openUpcoming.slice(0,5).map(item=>`<div class="upcoming-row"><time><b>${item.date.slice(8)}</b><span>${new Intl.DateTimeFormat("tr-TR",{month:"short"}).format(new Date(`${item.date}T12:00:00`))}</span></time><div><strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.category||"Planlı işlem")}</small></div><b class="${item.kind}">${signedMoney(item.amount,item.kind)}</b></div>`).join("")||empty("Yaklaşan kayıt yok")}</div><div class="upcoming-total"><span>Beklenen net</span><strong>${money(openUpcoming.reduce((sum,x)=>sum+(x.kind==="income"?x.amount:-x.amount),0))}</strong></div></article></section>
  <section class="panel recent-panel"><header class="panel-head"><div><h2>Son işlemler</h2><p>Canlı defter hareketleri</p></div><a href="#/transactions">Tüm işlemler ${icon("arrow")}</a></header><div class="transaction-table"><div class="table-head"><span>İşlem</span><span>Kategori</span><span>Hesap</span><span>Tarih</span><span>Tutar</span></div>${state.transactions.slice(0,5).map(item=>row(item,state)).join("")||empty("Henüz işlem yok")}</div></section>`;
}

function cashflowChart(state){
  const items=state.cashflow||[],visible={income:true,expense:true,balance:true,...state.cashflowVisible};
  const accounts=state.accounts.filter(item=>!item.isArchived),selected=new Set(state.cashflowAccountIds||[]);
  const allSelected=accounts.length>0&&accounts.every(item=>selected.has(item.id));
  const width=920,height=286,left=64,right=72,top=18,bottom=42,plotWidth=width-left-right,plotHeight=height-top-bottom;
  const barValues=items.flatMap(item=>[visible.income?item.income:0,visible.expense?item.expense:0]);
  const barMax=Math.max(1,...barValues);
  const balanceValues=items.map(item=>Number(item.balance)||0);
  let balanceMin=Math.min(0,...balanceValues),balanceMax=Math.max(0,...balanceValues);
  if(balanceMax===balanceMin){const padding=Math.max(1,Math.abs(balanceMax)*.1);balanceMin-=padding;balanceMax+=padding;}
  const balanceRange=balanceMax-balanceMin;
  const step=items.length?plotWidth/items.length:plotWidth,barWidth=Math.max(3,Math.min(16,step*.27));
  const barSeriesCount=Number(visible.income)+Number(visible.expense);
  const barY=value=>top+plotHeight-(Math.max(0,value)/barMax)*plotHeight;
  const balanceY=value=>top+((balanceMax-value)/balanceRange)*plotHeight;
  const grid=[0,.25,.5,.75,1].map(ratio=>{const y=top+plotHeight*(1-ratio),leftValue=barMax*ratio,rightValue=balanceMin+balanceRange*ratio;return `<line class="chart-grid-line" x1="${left}" y1="${y}" x2="${width-right}" y2="${y}"/><text class="chart-axis-label" x="${left-10}" y="${y+3}" text-anchor="end">${escapeHtml(shortMoney(leftValue))}</text>${visible.balance?`<text class="chart-axis-label balance-axis-label" x="${width-right+10}" y="${y+3}" text-anchor="start">${escapeHtml(shortMoney(rightValue))}</text>`:""}`;}).join("");
  const bars=items.map((item,index)=>{const center=left+step*(index+.5),parts=[];if(visible.income){const x=center-(barSeriesCount===2?barWidth+2:barWidth/2),y=barY(item.income),h=Math.max(item.income?2:0,top+plotHeight-y);if(h)parts.push(`<rect class="cashflow-bar income-bar" x="${x}" y="${top+plotHeight-h}" width="${barWidth}" height="${h}" rx="3"/>`);}if(visible.expense){const x=center+(barSeriesCount===2?2:-barWidth/2),y=barY(item.expense),h=Math.max(item.expense?2:0,top+plotHeight-y);if(h)parts.push(`<rect class="cashflow-bar expense-bar" x="${x}" y="${top+plotHeight-h}" width="${barWidth}" height="${h}" rx="3"/>`);}return parts.join("");}).join("");
  const linePoints=items.map((item,index)=>`${left+step*(index+.5)},${balanceY(Number(item.balance)||0)}`).join(" ");
  const balanceLine=visible.balance&&items.length?`<polyline class="balance-line" points="${linePoints}"/>${items.map((item,index)=>`<circle class="balance-point" cx="${left+step*(index+.5)}" cy="${balanceY(Number(item.balance)||0)}" r="3"/>`).join("")}`:"";
  const labelEvery=Math.max(1,Math.ceil(items.length/10));
  const labels=items.map((item,index)=>(index%labelEvery===0||index===items.length-1)?`<text class="chart-period-label" x="${left+step*(index+.5)}" y="${height-14}" text-anchor="middle">${escapeHtml(item.label)}</text>`:"").join("");
  const hits=items.map((item,index)=>`<rect class="chart-hit" data-cashflow-index="${index}" tabindex="0" role="img" aria-label="${escapeHtml(`${item.label}: gelir ${money(item.income)}, gider ${money(item.expense)}, bakiye ${money(item.balance)}`)}" x="${left+step*index}" y="${top}" width="${step}" height="${plotHeight}"/>`).join("");
  return `<div class="cashflow-visual"><svg class="cashflow-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Gelir ve gider sütunları ile dönem sonu bakiye çizgisi">${grid}${bars}${balanceLine}${labels}${hits}</svg><div class="cashflow-tooltip" id="cashflow-tooltip" hidden><strong data-tooltip-label></strong><span data-tooltip-row="income">Gelir <b class="income" data-tooltip-income></b></span><span data-tooltip-row="expense">Gider <b class="expense" data-tooltip-expense></b></span><span data-tooltip-row="balance">Bakiye <b class="balance" data-tooltip-balance></b></span></div></div>
  <div class="cashflow-series-controls" aria-label="Grafikte gösterilecek değerler"><label><input type="checkbox" data-cashflow-series="income" ${visible.income?"checked":""}><i class="legend-income"></i>Gelir</label><label><input type="checkbox" data-cashflow-series="expense" ${visible.expense?"checked":""}><i class="legend-expense"></i>Gider</label><label><input type="checkbox" data-cashflow-series="balance" ${visible.balance?"checked":""}><i class="legend-balance"></i>Bakiye</label></div>
  ${visible.balance?`<div class="cashflow-account-selector"><div class="cashflow-account-head"><div><strong>Bakiyeye dahil hesaplar</strong><small>${selected.size} / ${accounts.length} hesap seçili</small></div><label><input type="checkbox" data-cashflow-account-all ${allSelected?"checked":""}>Tüm hesaplar</label></div><div class="cashflow-account-list">${accounts.map(item=>`<label><input type="checkbox" data-cashflow-account="${item.id}" ${selected.has(item.id)?"checked":""}><span>${escapeHtml(item.name)}</span></label>`).join("")||`<span class="muted">Seçilebilecek aktif hesap yok.</span>`}</div></div>`:""}`;
}
function empty(text){return `<div class="empty-state">${text}</div>`;}
function row(item,state){const category=state.categories.find(x=>x.id===item.categoryId),account=state.accounts.find(x=>x.id===item.accountId);return `<div class="table-row"><span class="transaction-name"><i style="--dot:#287b60">${item.kind==="income"?"↙":item.kind==="transfer"?"⇄":"↗"}</i><b>${escapeHtml(item.description)}</b></span><span>${escapeHtml(category?.name|| (item.kind==="transfer"?"Transfer":"—"))}</span><span>${escapeHtml(account?.name||item.accountName||"—")}</span><span>${dateText(item.date)}</span><strong class="${item.kind}">${signedMoney(item.amount,item.kind)}</strong></div>`;}
