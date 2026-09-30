"""Charts for the research paper, drawn from the CSV files in data/."""
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
OUT = Path(__file__).parent
BLUE, AQUA, ORANGE, GREY = "#2a78d6", "#1baf7a", "#eb6834", "#b9b8b2"

y = pd.read_csv(ROOT / "data" / "fdi_inflows_by_year.csv")
fig, ax = plt.subplots(figsize=(8, 3.6))
lab = y.fiscal_year.str.slice(2)
ax.bar(lab, y.equity_inflow_usd_mn / 1000, color=BLUE, label="Equity")
ax.bar(lab, (y.total_fdi_inflow_usd_mn - y.equity_inflow_usd_mn) / 1000, bottom=y.equity_inflow_usd_mn / 1000, color=AQUA,
       label="Reinvested earnings and other capital")
ax.set_ylabel("US$ billion"); ax.tick_params(axis="x", rotation=90, labelsize=8)
ax.set_title("FDI inflows into India by financial year, 2000-01 to 2025-26", loc="left", fontsize=11, weight="bold")
ax.legend(frameon=False, fontsize=8, loc="upper left"); ax.spines[["top", "right"]].set_visible(False)
ax.text(len(y) - 1, y.total_fdi_inflow_usd_mn.iloc[-1] / 1000 + 1.5, f"{y.total_fdi_inflow_usd_mn.iloc[-1] / 1000:.1f}", ha="center", fontsize=8)
fig.text(0.01, 0.01, "Source: DPIIT; 2025-26 from DPIIT data as reported and the Ministry of Finance.", fontsize=7, color="#666")
fig.tight_layout(rect=(0, 0.03, 1, 1)); fig.savefig(OUT / "inflows.png", dpi=180)

n = pd.read_csv(ROOT / "data" / "net_fdi.csv")
fig, ax = plt.subplots(figsize=(8, 3.9))
x = range(len(n)); w = 0.2
for i, (col, name, c, sign) in enumerate([("gross_inflow_usd_bn", "Gross inflow", BLUE, 1), ("repatriation_usd_bn", "Repatriated by foreign investors", ORANGE, -1),
                                          ("outward_fdi_usd_bn", "Invested abroad by Indian firms", GREY, -1), ("net_fdi_usd_bn", "Net FDI", AQUA, 1)]):
    vals = sign * n[col]
    bars = ax.bar([k + (i - 1.5) * w for k in x], vals, w, color=c, label=name)
    for b, v in zip(bars, vals):
        ax.text(b.get_x() + w / 2, v + (1.5 if v >= 0 else -5), f"{abs(v):.1f}", ha="center", fontsize=7)
ax.axhline(0, color="#333", lw=0.8); ax.set_xticks(list(x), n.fiscal_year); ax.set_ylabel("US$ billion")
ax.set_title("Gross FDI, money going out, and net FDI", loc="left", fontsize=11, weight="bold")
ax.legend(frameon=False, fontsize=8, ncol=4, loc="upper center", bbox_to_anchor=(0.5, -0.12)); ax.set_ylim(-65, 110); ax.spines[["top", "right"]].set_visible(False)
fig.text(0.01, 0.01, "Source: RBI data as reported by Business Standard.", fontsize=7, color="#666")
fig.tight_layout(rect=(0, 0.03, 1, 1)); fig.savefig(OUT / "net.png", dpi=180)
