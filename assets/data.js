// Loads the CSV files in data/ and survey/ so the page and the research use the same numbers.

/** Parse CSV text with quoted fields into an array of objects; numeric-looking fields become numbers. */
export function parseCSV(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some(v => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); if (row.some(v => v !== '')) rows.push(row); }
  const [head, ...body] = rows;
  return body.map(r => Object.fromEntries(head.map((h, j) => {
    const v = r[j] ?? '';
    return [h, v !== '' && /^-?\d+(\.\d+)?$/.test(v) ? Number(v) : v];
  })));
}

export async function loadAll(base = '.') {
  const files = { years: 'data/fdi_inflows_by_year.csv', net: 'data/net_fdi.csv', countries: 'data/top_countries.csv',
    sectors: 'data/top_sectors.csv', caps: 'data/sector_caps.csv', timeline: 'data/policy_timeline.csv', survey: 'survey/survey_counts.csv' };
  const entries = await Promise.all(Object.entries(files).map(async ([k, f]) => {
    const r = await fetch(`${base}/${f}`);
    if (!r.ok) throw new Error(`Could not load ${f}`);
    return [k, parseCSV(await r.text())];
  }));
  return Object.fromEntries(entries);
}

/** Headline figures derived from the data. */
export function summary({ years, net }) {
  const last = years.at(-1), prev = years.at(-2);
  const n = net.at(-1);
  const peakBefore = Math.max(...years.slice(0, -1).map(y => y.total_fdi_inflow_usd_mn));
  return {
    year: last.fiscal_year,
    total: last.total_fdi_inflow_usd_mn / 1000,
    equity: last.equity_inflow_usd_mn / 1000,
    growth: last.total_fdi_inflow_usd_mn / prev.total_fdi_inflow_usd_mn - 1,
    record: last.total_fdi_inflow_usd_mn > peakBefore,
    cumulative: years.reduce((s, y) => s + y.total_fdi_inflow_usd_mn, 0) / 1e6,
    net: n.net_fdi_usd_bn,
    repatriationShare: n.repatriation_usd_bn / n.gross_inflow_usd_bn,
    netShare: n.net_fdi_usd_bn / n.gross_inflow_usd_bn,
  };
}

/** Survey shares for one statement. */
export function likert(r) {
  const n = r.strongly_agree + r.agree + r.neutral + r.disagree + r.strongly_disagree;
  return { n, agree: (r.strongly_agree + r.agree) / n, disagree: (r.disagree + r.strongly_disagree) / n, neutral: r.neutral / n };
}
