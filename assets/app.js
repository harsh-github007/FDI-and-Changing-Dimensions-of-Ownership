import { loadAll, summary, likert } from './data.js';

const $ = id => document.getElementById(id);
const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
const hasCharts = () => typeof Chart !== 'undefined';
const bn = x => `$${x.toFixed(1)} bn`;
const fmtMn = x => `$${(x / 1000).toFixed(1)} bn`;
const pct = x => `${Math.round(x * 100)}%`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const narrow = () => matchMedia('(max-width: 600px)').matches;
const clip = (t, n) => (t.length > n ? t.slice(0, n - 1) + '…' : t);
const baseOpts = () => ({ responsive: true, maintainAspectRatio: false, animation: false });

function kpis(d) {
  const s = summary(d);
  $('kYearLabel').textContent = `Total FDI inflow, ${s.year}`;
  $('kTotal').textContent = bn(s.total);
  $('kGrowth').textContent = `${s.growth >= 0 ? 'up' : 'down'} ${pct(Math.abs(s.growth))} on the year${s.record ? ', a record' : ''}`;
  $('kEquity').textContent = bn(s.equity);
  $('kNet').textContent = bn(s.net);
  $('kNetNote').textContent = `${pct(s.netShare)} of gross inflows stayed`;
  $('kCum').textContent = `$${s.cumulative.toFixed(2)} trillion`;
}

function years(d) {
  const ys = d.years;
  $('yearTable').innerHTML = '<thead><tr><th>Financial year</th><th>Equity</th><th>Total FDI</th></tr></thead><tbody>' +
    ys.slice().reverse().map(y => `<tr><td>${y.fiscal_year}</td><td>${fmtMn(y.equity_inflow_usd_mn)}</td><td>${fmtMn(y.total_fdi_inflow_usd_mn)}</td></tr>`).join('') + '</tbody>';
  if (!hasCharts()) return;
  new Chart($('yearChart'), { type: 'bar', data: { labels: ys.map(y => y.fiscal_year.replace(/^20/, '')), datasets: [
    { label: 'Equity', data: ys.map(y => y.equity_inflow_usd_mn / 1000), backgroundColor: css('--blue'), borderRadius: 3, stack: 's' },
    { label: 'Reinvested earnings and other capital', data: ys.map(y => (y.total_fdi_inflow_usd_mn - y.equity_inflow_usd_mn) / 1000), backgroundColor: css('--aqua'), borderRadius: 3, stack: 's' },
  ] }, options: { ...baseOpts(), interaction: { mode: 'index', intersect: false },
    scales: { x: { stacked: true, grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true } }, y: { stacked: true, title: { display: true, text: 'US$ billion' } } },
    plugins: { tooltip: { callbacks: { title: i => `FY ${ys[i[0].dataIndex].fiscal_year}`, label: c => `${c.dataset.label}: ${bn(c.raw)}`,
      footer: i => `Total: ${fmtMn(ys[i[0].dataIndex].total_fdi_inflow_usd_mn)}` } } } } });
}

function net(d) {
  const n = d.net, last = n.at(-1), first = n[0];
  $('netResult').innerHTML = `In ${last.fiscal_year}, of <b>${bn(last.gross_inflow_usd_bn)}</b> that came in, foreign investors took <b>${bn(last.repatriation_usd_bn)}</b> back out and Indian companies invested <b>${bn(last.outward_fdi_usd_bn)}</b> abroad, leaving net FDI of <b>${bn(last.net_fdi_usd_bn)}</b>. ` +
    `In ${first.fiscal_year}, net FDI was ${bn(first.net_fdi_usd_bn)}. Much of what leaves is foreign owners selling Indian stakes at a profit, which the RBI calls a sign of a mature market.`;
  if (!hasCharts()) return;
  const lab = n.map(r => r.fiscal_year);
  new Chart($('netChart'), { type: 'bar', data: { labels: lab, datasets: [
    { label: 'Gross inflow', data: n.map(r => r.gross_inflow_usd_bn), backgroundColor: css('--blue'), borderRadius: 3 },
    { label: 'Repatriated by foreign investors', data: n.map(r => -r.repatriation_usd_bn), backgroundColor: css('--orange'), borderRadius: 3 },
    { label: 'Invested abroad by Indian firms', data: n.map(r => -r.outward_fdi_usd_bn), backgroundColor: css('--grey'), borderRadius: 3 },
    { label: 'Net FDI', data: n.map(r => r.net_fdi_usd_bn), backgroundColor: css('--aqua'), borderRadius: 3 },
  ] }, options: { ...baseOpts(), interaction: { mode: 'index', intersect: false },
    scales: { x: { grid: { display: false } }, y: { title: { display: true, text: 'US$ billion' } } },
    plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${bn(Math.abs(c.raw))}` } } } } });
}

function ranking(canvas, rows, keyName, chipsRoot) {
  if (!hasCharts()) return;
  const views = {
    cum: { rows: rows, value: r => r.cumulative_equity_usd_mn_apr2000_jun2025 / 1000, note: 'Equity, April 2000 to June 2025' },
    fy26: { rows: rows.filter(r => r.fy2025_26_usd_mn !== ''), value: r => r.fy2025_26_usd_mn / 1000, note: 'Equity, 2025-26' },
  };
  const make = v => {
    const rs = views[v].rows.slice().sort((a, b) => views[v].value(b) - views[v].value(a));
    return { labels: rs.map(r => r[keyName]), datasets: [{ label: views[v].note, data: rs.map(views[v].value), backgroundColor: css('--blue'), borderRadius: 3 }] };
  };
  const chart = new Chart(canvas, { type: 'bar', data: make('cum'), options: { ...baseOpts(), indexAxis: 'y',
    scales: { x: { title: { display: true, text: 'US$ billion' } }, y: { grid: { display: false }, ticks: { autoSkip: false, callback(v) { return clip(this.getLabelForValue(v), narrow() ? 20 : 40); } } } },
    plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.dataset.label}: ${bn(c.raw)}` } } } } });
  chipsRoot.querySelectorAll('.chip').forEach(b => b.addEventListener('click', () => {
    chipsRoot.querySelectorAll('.chip').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    chart.data = make(b.dataset.view); chart.update();
  }));
}

function caps(d) {
  const groups = [...new Set(d.caps.map(c => c.group))];
  $('capGroup').innerHTML += groups.map(g => `<option>${esc(g)}</option>`).join('');
  const draw = () => {
    const q = $('capSearch').value.trim().toLowerCase(), g = $('capGroup').value;
    const rows = d.caps.filter(c => (!g || c.group === g) && (!q || `${c.sector} ${c.group} ${c.note}`.toLowerCase().includes(q)));
    $('capTable').innerHTML = '<thead><tr><th>Sector</th><th>Foreign ownership allowed</th><th>Route</th><th>Note</th></tr></thead><tbody>' +
      rows.map(c => `<tr><td data-l="Sector">${esc(c.sector)}</td><td data-l="Allowed"><span class="cap${c.cap_pct === 0 ? ' none' : ''}"><b>${c.cap_pct === 0 ? 'None' : c.cap_pct + '%'}</b><i style="--w:${c.cap_pct}%"></i></span></td>` +
        `<td data-l="Route">${esc(c.route)}</td><td class="wrap-cell" data-l="Note">${esc(c.note)}</td></tr>`).join('') + '</tbody>';
    const full = d.caps.filter(c => c.cap_pct === 100 && c.route === 'Automatic').length;
    $('capCount').textContent = rows.length ? `Showing ${rows.length} of ${d.caps.length} sectors. ${full} of them allow 100% foreign ownership with no approval.` : 'No sector matches.';
  };
  $('capSearch').addEventListener('input', draw);
  $('capGroup').addEventListener('change', draw);
  draw();
  $('timeline').innerHTML = d.timeline.map(t => `<li><b>${t.year}</b><div><strong>${esc(t.sector)}.</strong> <span>${esc(t.change)}</span></div></li>`).join('');
}

const SHORT = { Q1: 'Makes domestic industry more competitive', Q2: 'Diversifies ownership', Q3: 'Brings technology and innovation',
  Q4: 'Foreign firms boost growth', Q5: "Undermines local firms' autonomy", Q6: 'Concentrates ownership in a few MNCs',
  Q7: 'Policy should favour FDI over protection', Q8: 'Transfers knowledge and skills', Q9: 'Displaces local businesses',
  Q10: 'Encourages partnerships', Q11: 'Loses control of key industries', Q12: 'Makes the economy more resilient',
  Q13: 'Opens global markets', Q14: 'Undermines national sovereignty' };

function survey(d) {
  if (!hasCharts()) return;
  const rows = d.survey.slice().sort((a, b) => (likert(b).agree - likert(b).disagree) - (likert(a).agree - likert(a).disagree));
  const label = r => `${r.theme === 'concern' ? '▲ ' : r.theme === 'benefit' ? '● ' : '◆ '}${SHORT[r.id]}`;
  const ds = (name, key, color, sign = 1) => ({ label: name, data: rows.map(r => sign * r[key]), backgroundColor: color, stack: 's', barPercentage: 0.8 });
  new Chart($('svChart'), { type: 'bar', data: { labels: rows.map(label), datasets: [
    ds('Disagree', 'disagree', '#e6907c', -1), ds('Strongly disagree', 'strongly_disagree', css('--red'), -1),
    ds('Neutral', 'neutral', css('--grey')), ds('Agree', 'agree', '#7fb2e5'), ds('Strongly agree', 'strongly_agree', css('--blue')),
  ] }, options: { ...baseOpts(), indexAxis: 'y',
    scales: { x: { stacked: true, min: -40, max: 100, ticks: { maxTicksLimit: narrow() ? 5 : 10, callback: v => `${Math.abs(v)}%` } },
      
      y: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, font: { size: narrow() ? 10 : 12 }, callback(v) { return clip(this.getLabelForValue(v), narrow() ? 24 : 60); } } } },
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } },
      tooltip: { callbacks: { title: i => { const r = rows[i[0].dataIndex]; return `${r.id}: ${r.statement}`; }, label: c => `${c.dataset.label}: ${Math.abs(c.raw)}%` } },
      subtitle: { display: true, text: '● benefit   ▲ concern   ◆ policy', align: 'start', padding: { bottom: 8 } } } } });
}

async function main() {
  if (hasCharts()) { Chart.defaults.font.family = css('--sans'); Chart.defaults.color = css('--muted'); Chart.defaults.borderColor = css('--line'); }
  let d;
  try { d = await loadAll('.'); }
  catch (e) { $('loadError').hidden = false; $('loadError').textContent = `The data could not be loaded (${e.message}). Open the page through a web server, not as a file.`; return; }
  kpis(d); years(d); net(d);
  ranking($('ctyChart'), d.countries, 'country', $('ctyHead').parentElement);
  ranking($('secChart'), d.sectors, 'sector', $('secHead').parentElement);
  caps(d); survey(d);
}
main();
