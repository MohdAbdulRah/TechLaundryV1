import { useEffect, useState } from "react";
import { getToken } from "../utils/auth";

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
  Tooltip,
  Cell,
  PieChart,
  Pie,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ── Types ──────────────────────────────────────────────────────────────────────
type OverviewData = {
  shop: {
    id: string;
    name: string;
    address: string;
    rating: number;
    ratingCount: number;
    totalOrders: number;
    avgDeliveryTime: number;
  };
  statistics: {
    totalPrices: number;
    totalCategories: number;
    totalServicesProcessed: number;
  };
  deliveries: {
    total: number;
    started: number;
    collected_from_user: number;
    given_to_shops: number;
    service_done: number;
    marked_for_delivery: number;
    collected_from_shops: number;
    given_to_user: number;
  };
};

// ── Delivery pipeline stages ───────────────────────────────────────────────────
const PIPELINE_STAGES = [
  { key: "started",              label: "Started",              color: "#f59e0b", icon: "🚀" },
  { key: "collected_from_user",  label: "Collected from User",  color: "#06b6d4", icon: "📦" },
  { key: "given_to_shops",       label: "Given to Shop",        color: "#8b5cf6", icon: "🏪" },
  { key: "service_done",         label: "Service Done",         color: "#10b981", icon: "✅" },
  { key: "marked_for_delivery",  label: "Marked for Delivery",  color: "#f97316", icon: "🏷️" },
  { key: "collected_from_shops", label: "Collected from Shop",  color: "#ec4899", icon: "🛍️" },
  { key: "given_to_user",        label: "Delivered",            color: "#22c55e", icon: "🎉" },
] as const;

// ── Star rating ────────────────────────────────────────────────────────────────
function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = rating >= s;
        const half   = !filled && rating >= s - 0.5;
        return (
          <span key={s} style={{ fontSize: 16, color: filled || half ? "#f59e0b" : "rgba(255,255,255,0.15)" }}>
            {half ? "½" : "★"}
          </span>
        );
      })}
    </div>
  );
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────────
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "var(--navy-900)",
      border: "1px solid var(--border-subtle)",
      borderRadius: 8,
      padding: "8px 14px",
      fontSize: 12,
      color: "var(--text-primary)",
      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
    }}>
      <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--cyan-400)" }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color ?? "var(--text-secondary)" }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── Section head (reuse pattern from UserProfile) ──────────────────────────────
function SectionHead({ label }: { label: string }) {
  return (
    <div style={s.sectionHead}>
      <span style={s.sectionLabel}>{label}</span>
      <div style={s.sectionLine} />
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({
  icon, value, label, accent, suffix = "",
}: {
  icon: string; value: number | string; label: string; accent: string; suffix?: string;
}) {
  return (
    <div style={{ ...s.statCard, "--accent": accent } as any}>
      <div style={s.statIcon}>{icon}</div>
      <div style={s.statValue}>{value}{suffix && <span style={{ fontSize: "0.55em", marginLeft: 3, color: "var(--text-tertiary)" }}>{suffix}</span>}</div>
      <div style={s.statLabel}>{label}</div>
      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: accent, borderRadius: "0 0 12px 12px" }} />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function ShopOverview() {
  const [data, setData]       = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/shop/price/overview`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to fetch overview");
        setData(json.data);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={s.centered}>
        <div style={s.spinner} />
        <span style={{ color: "var(--text-tertiary)", fontSize: 13, marginTop: 12 }}>Loading overview…</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={s.centered}>
        <p style={{ color: "var(--color-danger)", fontSize: 14 }}>{error ?? "Something went wrong."}</p>
      </div>
    );
  }

  const { shop, statistics, deliveries } = data;

  // Completion rate
  const completionRate = deliveries.total > 0
    ? Math.round((deliveries.given_to_user / deliveries.total) * 100)
    : 0;

  // Active (in-flight) deliveries
  const activeDeliveries = deliveries.total - deliveries.given_to_user;

  // Pie chart — pipeline distribution
  const pieData = PIPELINE_STAGES.map((st) => ({
    name:  st.label,
    value: deliveries[st.key],
    color: st.color,
  })).filter((d) => d.value > 0);

  // Bar chart — pipeline stages
  const barData = PIPELINE_STAGES.map((st) => ({
    name:  st.label.split(" ")[0], // short label
    full:  st.label,
    value: deliveries[st.key],
    fill:  st.color,
  }));

  // Radial for completion rate
  const radialData = [{ name: "Completion", value: completionRate, fill: "#22c55e" }];

  return (
    <div style={s.root}>

      {/* ── HERO BANNER ─────────────────────────────────────────────────────── */}
      <div style={s.hero}>
        <div style={s.heroBgGlow} />
        <div style={s.heroBgGlow2} />

        <div style={s.heroInner}>
          {/* Shop identity */}
          <div style={s.heroLeft}>
            <div style={s.shopBadge}>🏪 Shop Dashboard</div>
            <h1 style={s.heroName}>{shop.name}</h1>
            <p style={s.heroAddress}>📍 {shop.address}</p>
            <div style={s.heroMeta}>
              <StarRating rating={shop.rating} />
              <span style={s.ratingText}>{shop.rating}</span>
              <span style={s.ratingCount}>({shop.ratingCount} reviews)</span>
            </div>
          </div>

          {/* Quick KPIs */}
          <div style={s.heroKpis}>
            {[
              { val: shop.totalOrders,       lbl: "Total Orders",    icon: "📋" },
              { val: `${shop.avgDeliveryTime}m`, lbl: "Avg Delivery", icon: "⏱️" },
              { val: `${completionRate}%`,    lbl: "Completion Rate", icon: "🎯" },
              { val: activeDeliveries,        lbl: "Active Now",      icon: "🔄" },
            ].map((kpi, i) => (
              <div
                key={i}
                style={{
                  ...s.heroKpi,
                  borderRight: i < 3 ? "1px solid rgba(255,255,255,0.07)" : "none",
                }}
              >
                <div style={s.heroKpiIcon}>{kpi.icon}</div>
                <div style={s.heroKpiVal}>{kpi.val}</div>
                <div style={s.heroKpiLbl}>{kpi.lbl}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ──────────────────────────────────────────────────────── */}
      <SectionHead label="Shop statistics" />
      <div style={s.statGrid}>
        <StatCard icon="💰" value={statistics.totalPrices}          label="Price Listings"      accent="var(--cyan-500)" />
        <StatCard icon="🗂️" value={statistics.totalCategories}      label="Categories"          accent="#8b5cf6" />
        <StatCard icon="⚙️" value={statistics.totalServicesProcessed} label="Services Processed" accent="#f59e0b" />
        <StatCard icon="📦" value={deliveries.total}                 label="Total Deliveries"    accent="#10b981" />
      </div>

      {/* ── CHARTS ROW ──────────────────────────────────────────────────────── */}
      <SectionHead label="Delivery analytics" />
      <div style={s.chartsRow}>

        {/* Completion radial */}
        <div style={s.chartCard}>
          <div style={s.chartTitle}>Completion Rate</div>
          <div style={{ position: "relative", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%" cy="50%"
                innerRadius="55%" outerRadius="80%"
                startAngle={90} endAngle={-270}
                data={[{ name: "bg", value: 100, fill: "rgba(255,255,255,0.05)" }, ...radialData]}
              >
                <RadialBar dataKey="value" cornerRadius={8} background={false} />
                <Tooltip content={<CustomTooltip />} />
              </RadialBarChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: "#22c55e", lineHeight: 1 }}>{completionRate}%</span>
              <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>delivered</span>
            </div>
          </div>
          <div style={s.radialLegend}>
            <div style={s.radialLegendItem}><span style={{ ...s.dot, background: "#22c55e" }} />Completed</div>
            <div style={s.radialLegendItem}><span style={{ ...s.dot, background: "rgba(255,255,255,0.1)" }} />Remaining</div>
          </div>
        </div>

        {/* Pie — stage distribution */}
        <div style={{ ...s.chartCard, flex: 1.4 }}>
          <div style={s.chartTitle}>Stage Distribution</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 180, height: 200, flexShrink: 0 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="50%"
                    innerRadius={50} outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={s.pieLegend}>
              {pieData.map((d) => (
                <div key={d.name} style={s.pieLegendRow}>
                  <span style={{ ...s.dot, background: d.color, flexShrink: 0 }} />
                  <span style={s.pieLegendName}>{d.name}</span>
                  <span style={s.pieLegendVal}>{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── BAR CHART — full pipeline ────────────────────────────────────────── */}
      <div style={s.chartCard}>
        <div style={s.chartTitle}>Delivery Pipeline Breakdown</div>
        <div style={{ height: 220, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} barSize={28} margin={{ top: 0, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: "var(--text-tertiary)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
              <Bar dataKey="value" name="Orders" radius={[6, 6, 0, 0]}>
                {barData.map((entry, index) => (
                  <Cell key={index} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── PIPELINE TABLE ───────────────────────────────────────────────────── */}
      <SectionHead label="Pipeline stages" />
      <div style={s.pipelineCard}>
        {PIPELINE_STAGES.map((stage, i) => {
          const count = deliveries[stage.key];
          const pct   = deliveries.total > 0 ? (count / deliveries.total) * 100 : 0;
          return (
            <div
              key={stage.key}
              style={{
                ...s.pipelineRow,
                borderBottom: i < PIPELINE_STAGES.length - 1
                  ? "1px solid var(--border-subtle)"
                  : "none",
              }}
            >
              <div style={{ ...s.pipelineDot, background: stage.color }} />
              <span style={s.pipelineIcon}>{stage.icon}</span>
              <span style={s.pipelineLabel}>{stage.label}</span>
              <div style={s.pipelineBarWrap}>
                <div style={{ ...s.pipelineBarFill, width: `${pct}%`, background: stage.color }} />
              </div>
              <span style={s.pipelineCount}>{count}</span>
              <span style={s.pipelinePct}>{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  root: {
    width: "100%",
    fontFamily: "var(--font-sans)",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-3)",
  },
  centered: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 300,
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid rgba(0,180,216,0.15)",
    borderTop: "3px solid var(--cyan-500)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  /* Hero */
  hero: {
    background: "var(--navy-900)",
    borderRadius: "var(--radius-lg)",
    padding: "28px 32px",
    position: "relative",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-5)",
  },
  heroBgGlow: {
    position: "absolute", top: -60, right: -60,
    width: 280, height: 280, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,180,216,0.15) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  heroBgGlow2: {
    position: "absolute", bottom: -80, left: 100,
    width: 200, height: 200, borderRadius: "50%",
    background: "radial-gradient(circle, rgba(139,92,246,0.1) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  heroInner: {
    display: "flex",
    flexDirection: "column",
    gap: "var(--space-5)",
    position: "relative",
  },
  heroLeft: { display: "flex", flexDirection: "column", gap: 6 },
  shopBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "rgba(0,180,216,0.12)",
    border: "1px solid rgba(0,180,216,0.25)",
    borderRadius: "var(--radius-full)",
    padding: "3px 12px",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--cyan-400)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    width: "fit-content",
  },
  heroName: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-inverse)",
    margin: 0,
    lineHeight: 1.1,
  },
  heroAddress: {
    fontSize: "var(--text-sm)",
    color: "rgba(255,255,255,0.4)",
    margin: 0,
  },
  heroMeta: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  ratingText: {
    fontWeight: 700,
    fontSize: "var(--text-sm)",
    color: "#f59e0b",
  },
  ratingCount: {
    fontSize: "var(--text-xs)",
    color: "rgba(255,255,255,0.3)",
  },
  heroKpis: {
    display: "flex",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "var(--radius-md)",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  heroKpi: {
    flex: 1,
    textAlign: "center",
    padding: "14px 8px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
  },
  heroKpiIcon: { fontSize: 18 },
  heroKpiVal: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-2xl)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-inverse)",
    lineHeight: 1,
  },
  heroKpiLbl: {
    fontSize: "var(--text-xs)",
    color: "rgba(255,255,255,0.35)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    fontWeight: "var(--weight-semibold)" as any,
  },

  /* Section head */
  sectionHead: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    margin: "var(--space-3) 0 var(--space-2)",
  },
  sectionLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-bold)" as any,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    whiteSpace: "nowrap",
  },
  sectionLine: { flex: 1, height: 1, background: "var(--border-subtle)" },

  /* Stat cards */
  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--space-3)",
  },
  statCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
    position: "relative",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
  },
  statIcon: { fontSize: 22, marginBottom: "var(--space-2)" },
  statValue: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-tertiary)",
    marginTop: "var(--space-1)",
  },

  /* Charts */
  chartsRow: {
    display: "flex",
    gap: "var(--space-3)",
    alignItems: "stretch",
  },
  chartCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5) var(--space-5) var(--space-4)",
    boxShadow: "var(--shadow-sm)",
    flex: 1,
  },
  chartTitle: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    marginBottom: "var(--space-3)",
    letterSpacing: "0.01em",
  },

  /* Radial legend */
  radialLegend: {
    display: "flex",
    justifyContent: "center",
    gap: 16,
    marginTop: "var(--space-3)",
  },
  radialLegendItem: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  dot: {
    display: "inline-block",
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },

  /* Pie legend */
  pieLegend: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 7,
    overflow: "hidden",
  },
  pieLegendRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  pieLegendName: {
    flex: 1,
    fontSize: "var(--text-xs)",
    color: "var(--text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  pieLegendVal: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    minWidth: 24,
    textAlign: "right",
  },

  /* Pipeline table */
  pipelineCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
  },
  pipelineRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "14px var(--space-6)",
    transition: "background 0.15s",
  },
  pipelineDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    flexShrink: 0,
  },
  pipelineIcon: { fontSize: 16, flexShrink: 0 },
  pipelineLabel: {
    flex: 1,
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-medium)" as any,
    color: "var(--text-primary)",
    minWidth: 160,
  },
  pipelineBarWrap: {
    width: 140,
    height: 6,
    background: "var(--bg-inset)",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    flexShrink: 0,
  },
  pipelineBarFill: {
    height: "100%",
    borderRadius: "var(--radius-full)",
    transition: "width 0.6s ease",
  },
  pipelineCount: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    minWidth: 28,
    textAlign: "right",
  },
  pipelinePct: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    minWidth: 42,
    textAlign: "right",
  },
};