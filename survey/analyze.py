"""Analyse the 14-statement FDI survey (100 respondents, 5-point Likert scale).

Only the answer counts for each statement survive, not each person's full set of answers, so the
analysis works with the counts: shares agreeing with 95% Wilson intervals, mean scores, a sign test
of agree against disagree for each statement (Holm-adjusted for 14 tests), and the smallest number
of people who must have agreed with two statements at once.
"""
from math import comb, sqrt
from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

HERE = Path(__file__).parent
LEVELS = ["strongly_agree", "agree", "neutral", "disagree", "strongly_disagree"]
SCORES = dict(zip(LEVELS, [5, 4, 3, 2, 1]))
SHORT = {"Q1": "Makes domestic industry more competitive", "Q2": "Diversifies ownership", "Q3": "Brings technology and innovation",
         "Q4": "Foreign firms boost growth", "Q5": "Undermines local firms' autonomy", "Q6": "Concentrates ownership in a few MNCs",
         "Q7": "Policy should favour FDI over protection", "Q8": "Transfers knowledge and skills", "Q9": "Displaces local businesses",
         "Q10": "Encourages partnerships", "Q11": "Loses control of key industries", "Q12": "Makes the economy more resilient",
         "Q13": "Opens global markets", "Q14": "Undermines national sovereignty"}


def wilson(k, n, z=1.96):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return c - h, c + h


def sign_test(a, d):
    """Two-sided exact binomial test that agreeing and disagreeing are equally likely (neutral left out)."""
    n, k = a + d, min(a, d)
    p = sum(comb(n, i) for i in range(k + 1)) / 2 ** n
    return min(1.0, 2 * p)


def holm(p):
    order = sorted(range(len(p)), key=lambda i: p[i])
    out, running = [0.0] * len(p), 0.0
    for rank, i in enumerate(order):
        running = max(running, (len(p) - rank) * p[i])
        out[i] = min(1.0, running)
    return out


def main():
    df = pd.read_csv(HERE / "survey_counts.csv")
    df["n"] = df[LEVELS].sum(axis=1)
    df["agree_n"] = df.strongly_agree + df.agree
    df["disagree_n"] = df.disagree + df.strongly_disagree
    df["agree_pct"] = 100 * df.agree_n / df.n
    df["disagree_pct"] = 100 * df.disagree_n / df.n
    ci = [wilson(a, n) for a, n in zip(df.agree_n, df.n)]
    df["agree_lo"] = [100 * lo for lo, _ in ci]
    df["agree_hi"] = [100 * hi for _, hi in ci]
    df["mean"] = sum(df[l] * s for l, s in SCORES.items()) / df.n
    df["p"] = [sign_test(a, d) for a, d in zip(df.agree_n, df.disagree_n)]
    df["p_holm"] = holm(list(df.p))

    by_theme = df.groupby("theme").agg(statements=("id", "count"), mean_agree=("agree_pct", "mean"),
                                       min_agree=("agree_pct", "min"), max_agree=("agree_pct", "max"))

    # Fréchet lower bound: at least a + b - 100 people agreed with both statements.
    ben, con = df[df.theme == "benefit"], df[df.theme == "concern"]
    pairs = []
    for _, b in ben.iterrows():
        for _, c in con.iterrows():
            pairs.append((b.id, c.id, max(0, b.agree_n + c.agree_n - 100)))
    pairs.sort(key=lambda t: -t[2])

    lines = ["# Survey results", "",
             "100 employees of multinational companies in India, at associate level and above, rated 14 statements about FDI "
             "on a five-point scale. Only the counts for each statement survive, so the analysis works with those.", "",
             "| | Statement | Theme | Agree | 95% interval | Disagree | Mean (1–5) | Sign test p | Holm p |",
             "| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |"]
    for _, r in df.iterrows():
        p = "< 0.001" if r.p < 0.001 else f"{r.p:.3f}"
        ph = "< 0.001" if r.p_holm < 0.001 else f"{r.p_holm:.3f}"
        lines.append(f"| {r.id} | {r.statement} | {r.theme} | {r.agree_pct:.0f}% | {r.agree_lo:.0f}–{r.agree_hi:.0f}% | "
                     f"{r.disagree_pct:.0f}% | {r['mean']:.2f} | {p} | {ph} |")
    lines += ["", "## By theme", "", "| Theme | Statements | Average agreeing | Range |", "| --- | ---: | ---: | --- |"]
    for t, r in by_theme.iterrows():
        lines.append(f"| {t} | {int(r.statements)} | {r.mean_agree:.0f}% | {r.min_agree:.0f}–{r.max_agree:.0f}% |")
    lines += ["", "## Agreeing with a benefit and a concern at once", "",
              "If a% agreed with one statement and b% with another, at least a + b − 100% of respondents must have agreed "
              "with both. The largest overlaps between a benefit and a concern:", "",
              "| Benefit | Concern | Agreed with both, at least |", "| --- | --- | ---: |"]
    for b, c, k in pairs[:5]:
        lines.append(f"| {b} | {c} | {k}% |")
    lines += ["", f"Every one of the {len(pairs)} benefit–concern pairs has an overlap of at least "
              f"{min(k for *_, k in pairs)}%.", ""]
    (HERE / "results.md").write_text("\n".join(lines))

    # Diverging bar chart, statements ordered by net agreement.
    d = df.assign(net=df.agree_pct - df.disagree_pct).sort_values("net")
    colors = {"strongly_disagree": "#b2412b", "disagree": "#e6907c", "neutral": "#c9c9c9", "agree": "#7fb2e5", "strongly_agree": "#2a6fb8"}
    fig, ax = plt.subplots(figsize=(8.5, 5.8))
    y = range(len(d))
    left = -(d.disagree + d.strongly_disagree + d.neutral / 2)
    for level in ["strongly_disagree", "disagree", "neutral", "agree", "strongly_agree"]:
        ax.barh(y, d[level], left=left, color=colors[level], label=level.replace("_", " ").capitalize(), height=0.7)
        left = left + d[level]
    ax.axvline(0, color="#333", lw=0.8)
    short = {k: f"{k}  {v}" for k, v in SHORT.items()}
    ax.set_yticks(list(y), [short[i] for i in d.id], fontsize=9)
    for tick, theme in zip(ax.get_yticklabels(), d.theme):
        tick.set_color({"benefit": "#1d5c99", "concern": "#9c3a26", "policy": "#333"}[theme])
    ax.set_xlim(-50, 90); ax.set_xlabel("% of respondents (neutral split across zero)")
    fig.suptitle("Most respondents agreed with the benefits and the concerns alike", x=0.01, ha="left", fontsize=11, weight="bold")
    ax.legend(ncol=5, fontsize=8, loc="lower center", bbox_to_anchor=(0.4, -0.2), frameon=False)
    ax.spines[["top", "right"]].set_visible(False)
    fig.text(0.01, 0.01, "Blue labels: benefits of FDI. Red labels: concerns. n = 100.", fontsize=7.5, color="#555")
    fig.tight_layout()
    fig.savefig(HERE / "figures" / "likert.png", dpi=170)
    print((HERE / "results.md").read_text())


if __name__ == "__main__":
    main()
