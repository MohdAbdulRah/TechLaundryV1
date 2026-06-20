import { useEffect, useState, useMemo } from "react";
import { getToken } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

/* ── Types ── */
type StatusBreakdown = {
  started: number;
  collected_from_user: number;
  given_to_shops: number;
  service_done: number;
  collected_from_shops: number;
  given_to_user: number;
};

type UserEntry = {
  user: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    location: {
      type: string;
      coordinates: [number, number];
    };
  };
  analytics: {
    totalOrders: number;
    activeOrders: number;
    completedOrders: number;
    completionRate: number;
    statusBreakdown: StatusBreakdown;
  };
};

/* ── Helpers ── */
function UserAvatar({ first, last }: { first: string; last: string }) {
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return <div style={styles.userAvatar}>{initials}</div>;
}

/* ── Donut ring (same as AllShops) ── */
function DonutRing({ pct, accent }: { pct: number; accent: string }) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width={44} height={44} viewBox="0 0 44 44">
      <circle cx={22} cy={22} r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={5} />
      <circle
        cx={22}
        cy={22}
        r={r}
        fill="none"
        stroke={accent}
        strokeWidth={5}
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.6s ease" }}
      />
      <text
        x={22}
        y={26}
        textAnchor="middle"
        fill="var(--text-primary)"
        fontSize={9}
        fontWeight={700}
        fontFamily="var(--font-display)"
      >
        {pct}%
      </text>
    </svg>
  );
}

/* ── Pipeline status bar ── */
const STATUS_LABELS: { key: keyof StatusBreakdown; icon: string; label: string }[] = [
  { key: "started", icon: "🟡", label: "Started" },
  { key: "collected_from_user", icon: "🧺", label: "Collected" },
  { key: "given_to_shops", icon: "🏪", label: "At Shop" },
  { key: "service_done", icon: "✂️", label: "Done" },
  { key: "collected_from_shops", icon: "📦", label: "Ready" },
  { key: "given_to_user", icon: "✅", label: "Delivered" },
];

function PipelineBar({ breakdown }: { breakdown: StatusBreakdown }) {
  const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
  const colors = [
    "#f59e0b",
    "#06b6d4",
    "#8b5cf6",
    "#10b981",
    "#3b82f6",
    "var(--color-success)",
  ];

  return (
    <div style={styles.pipelineWrap}>
      {/* Segmented bar */}
      <div style={styles.pipelineTrack}>
        {STATUS_LABELS.map((s, i) => {
          const val = breakdown[s.key];
          const pct = total ? (val / total) * 100 : 0;
          if (!pct) return null;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${val}`}
              style={{
                width: `${pct}%`,
                height: "100%",
                background: colors[i],
                transition: "width 0.5s ease",
              }}
            />
          );
        })}
      </div>

      {/* Legend — only non-zero */}
      <div style={styles.pipelineLegend}>
        {STATUS_LABELS.map((s, i) => {
          const val = breakdown[s.key];
          if (!val) return null;
          return (
            <span key={s.key} style={styles.legendItem}>
              <span
                style={{
                  display: "inline-block",
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: colors[i],
                  flexShrink: 0,
                }}
              />
              {s.label}: <strong style={{ color: "var(--text-primary)" }}>{val}</strong>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ── User card ── */
function UserCard({ entry }: { entry: UserEntry }) {
  const { user, analytics } = entry;
  const pct = Math.round(analytics.completionRate);
  const accentColor =
    pct >= 80
      ? "var(--color-success)"
      : pct >= 50
      ? "var(--cyan-500)"
      : "#f59e0b";

  return (
    <div style={styles.card}>
      {/* Top accent */}
      <div style={{ ...styles.cardAccentLine, background: accentColor }} />

      {/* Header */}
      <div style={styles.cardHeader}>
        <UserAvatar first={user.firstName} last={user.lastName} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.userName}>
            {user.firstName} {user.lastName}
            <span style={styles.userHandle}> @{user.username}</span>
          </div>
          <div style={styles.userAddress}>📍 {user.address}</div>
        </div>
        <DonutRing pct={pct} accent={accentColor} />
      </div>

      {/* Contact row */}
      <div style={styles.contactRow}>
        <span style={styles.contactItem}>✉️ {user.email}</span>
        <span style={styles.contactDot}>·</span>
        <span style={styles.contactItem}>📞 {user.phone}</span>
      </div>

      {/* Stat pills */}
      <div style={styles.statRow}>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>🛍️</span>
          <span style={styles.statVal}>{analytics.totalOrders}</span>
          <span style={styles.statLbl}>Total</span>
        </div>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>🔄</span>
          <span
            style={{
              ...styles.statVal,
              color:
                analytics.activeOrders > 0
                  ? "var(--cyan-300)"
                  : "var(--text-secondary)",
            }}
          >
            {analytics.activeOrders}
          </span>
          <span style={styles.statLbl}>Active</span>
        </div>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>✅</span>
          <span style={styles.statVal}>{analytics.completedOrders}</span>
          <span style={styles.statLbl}>Done</span>
        </div>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>📊</span>
          <span style={{ ...styles.statVal, color: accentColor }}>{pct}%</span>
          <span style={styles.statLbl}>Rate</span>
        </div>
      </div>

      {/* Completion bar */}
      <div style={styles.progressWrap}>
        <div style={styles.progressMeta}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>
            Completion rate
          </span>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: accentColor }}>
            {pct}%
          </span>
        </div>
        <div style={styles.progressTrack}>
          <div
            style={{ ...styles.progressFill, width: `${pct}%`, background: accentColor }}
          />
        </div>
      </div>

      {/* Divider */}
      <div style={styles.cardDivider} />

      {/* Pipeline */}
      <div>
        <div
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--text-tertiary)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            fontWeight: "var(--weight-semibold)" as any,
            marginBottom: "var(--space-2)",
          }}
        >
          Order pipeline
        </div>
        <PipelineBar breakdown={analytics.statusBreakdown} />
      </div>
    </div>
  );
}

/* ── Summary bar ── */
function SummaryBar({ data }: { data: UserEntry[] }) {
  const totalOrders = data.reduce((s, e) => s + e.analytics.totalOrders, 0);
  const totalActive = data.reduce((s, e) => s + e.analytics.activeOrders, 0);
  const totalCompleted = data.reduce((s, e) => s + e.analytics.completedOrders, 0);
  const avgRate =
    data.length
      ? Math.round(data.reduce((s, e) => s + e.analytics.completionRate, 0) / data.length)
      : 0;

  return (
    <div style={styles.summaryBar}>
      {[
        { icon: "👥", val: data.length, label: "Total users" },
        { icon: "🛍️", val: totalOrders, label: "Total orders" },
        { icon: "🔄", val: totalActive, label: "Active" },
        { icon: "✅", val: totalCompleted, label: "Completed" },
        { icon: "📊", val: `${avgRate}%`, label: "Avg rate" },
      ].map((s, i, arr) => (
        <div
          key={i}
          style={{
            ...styles.summaryCell,
            borderRight:
              i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
          }}
        >
          <div style={styles.summaryVal}>
            {s.icon} {s.val}
          </div>
          <div style={styles.summaryLbl}>{s.label}</div>
        </div>
      ))}
    </div>
  );
}

/* ── Main page ── */
export default function AllUsers() {
  const [users, setUsers] = useState<UserEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"total" | "active" | "completed" | "rate">("total");

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/admin/user/user/analytics`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to fetch users");
        setUsers(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    const base = users.filter((e) => {
      if (!q) return true;
      return (
        (e.user.firstName ?? "").toLowerCase().includes(q) ||
        (e.user.lastName ?? "").toLowerCase().includes(q) ||
        (e.user.username ?? "").toLowerCase().includes(q) ||
        (e.user.email ?? "").toLowerCase().includes(q) ||
        (e.user.address ?? "").toLowerCase().includes(q)
      );
    });

    return [...base].sort((a, b) => {
      if (sort === "total") return b.analytics.totalOrders - a.analytics.totalOrders;
      if (sort === "active") return b.analytics.activeOrders - a.analytics.activeOrders;
      if (sort === "completed") return b.analytics.completedOrders - a.analytics.completedOrders;
      if (sort === "rate") return b.analytics.completionRate - a.analytics.completionRate;
      return 0;
    });
  }, [users, search, sort]);

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.centered}>
        <p style={{ color: "var(--color-danger)", fontSize: 14 }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={styles.root}>

      {/* ── Page header ── */}
      <div style={styles.pageHeader}>
        <div style={styles.pageHeaderBgGlow} />
        <div style={{ position: "relative" }}>
          <div style={styles.pageTitle}>All Users</div>
          <div style={styles.pageSubtitle}>
            {users.length} registered users · order analytics overview
          </div>
        </div>
      </div>

      {/* ── Summary ── */}
      <SummaryBar data={users} />

      {/* ── Controls ── */}
      <div style={styles.controls}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Search users, emails, addresses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.clearBtn} onClick={() => setSearch("")}>
              ✕
            </button>
          )}
        </div>

        <div style={styles.sortRow}>
          {(
            [
              { key: "total", label: "🛍️ Total" },
              { key: "active", label: "🔄 Active" },
              { key: "completed", label: "✅ Completed" },
              { key: "rate", label: "📊 Rate" },
            ] as { key: typeof sort; label: string }[]
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => setSort(opt.key)}
              style={{
                ...styles.sortBtn,
                ...(sort === opt.key ? styles.sortBtnActive : {}),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results meta ── */}
      {search && (
        <div style={styles.resultsMeta}>
          {filtered.length} result{filtered.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
        </div>
      )}

      {/* ── Grid ── */}
      {filtered.length === 0 ? (
        <div style={styles.emptyState}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔍</div>
          <div style={{ color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
            No users match your search.
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((entry) => (
            <UserCard key={entry.user._id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Styles — Ocean Midnight tokens (mirrors AllShops) ── */
const styles: Record<string, React.CSSProperties> = {
  root: {
    width: "100%",
    margin: "0 auto",
    fontFamily: "var(--font-sans)",
  },
  centered: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200,
  },
  spinner: {
    width: 32,
    height: 32,
    border: "3px solid rgba(0,180,216,0.2)",
    borderTop: "3px solid var(--cyan-500)",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },

  /* Page header */
  pageHeader: {
    background: "var(--navy-900)",
    borderRadius: "var(--radius-lg)",
    padding: "24px 28px",
    marginBottom: "var(--space-4)",
    position: "relative",
    overflow: "hidden",
  },
  pageHeaderBgGlow: {
    position: "absolute",
    top: -30,
    right: -30,
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,180,216,0.18) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  pageTitle: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-2xl)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-inverse)",
    lineHeight: "var(--leading-tight)",
    marginBottom: "var(--space-1)",
  },
  pageSubtitle: {
    fontSize: "var(--text-sm)",
    color: "rgba(255,255,255,0.4)",
  },

  /* Summary bar */
  summaryBar: {
    background: "var(--navy-900)",
    borderRadius: "var(--radius-lg)",
    display: "flex",
    marginBottom: "var(--space-4)",
    overflow: "hidden",
  },
  summaryCell: {
    flex: 1,
    textAlign: "center" as const,
    padding: "var(--space-4) var(--space-3)",
  },
  summaryVal: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-xl)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-inverse)",
    lineHeight: 1,
  },
  summaryLbl: {
    fontSize: "var(--text-xs)",
    color: "rgba(255,255,255,0.38)",
    marginTop: "var(--space-1)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.07em",
    fontWeight: "var(--weight-semibold)" as any,
  },

  /* Controls */
  controls: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "var(--space-3)",
    alignItems: "center",
    marginBottom: "var(--space-4)",
  },
  searchWrap: {
    flex: 1,
    minWidth: 220,
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-full)",
    padding: "0 14px",
    height: 38,
  },
  searchIcon: { fontSize: 13, opacity: 0.5 },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: "var(--text-sm)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-sans)",
  } as React.CSSProperties,
  clearBtn: {
    background: "none",
    border: "none",
    color: "var(--text-tertiary)",
    cursor: "pointer",
    fontSize: 11,
    padding: 0,
    lineHeight: 1,
  },
  sortRow: {
    display: "flex",
    gap: "var(--space-2)",
    flexWrap: "wrap" as const,
  },
  sortBtn: {
    padding: "6px 14px",
    borderRadius: "var(--radius-full)",
    border: "1px solid var(--border-subtle)",
    background: "var(--bg-surface)",
    color: "var(--text-secondary)",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "all 0.15s",
  },
  sortBtnActive: {
    background: "rgba(0,180,216,0.15)",
    border: "1px solid rgba(0,180,216,0.35)",
    color: "var(--cyan-300)",
  },

  resultsMeta: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    marginBottom: "var(--space-3)",
    paddingLeft: 4,
  },

  /* Grid */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: "var(--space-4)",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "60px 0",
  },

  /* Card */
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
    position: "relative",
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-3)",
    overflow: "hidden",
  },
  cardAccentLine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--space-3)",
    paddingTop: 4,
  },

  /* User avatar */
  userAvatar: {
    width: 44,
    height: 44,
    borderRadius: "var(--radius-full)",
    background: "linear-gradient(135deg, var(--navy-600), var(--navy-900))",
    border: "1px solid rgba(0,180,216,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    fontWeight: 700,
    color: "var(--cyan-300)",
    fontFamily: "var(--font-display)",
    flexShrink: 0,
  },
  userName: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-base)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    lineHeight: "var(--leading-tight)",
    marginBottom: 2,
  },
  userHandle: {
    fontWeight: "var(--weight-normal)" as any,
    color: "var(--text-tertiary)",
    fontSize: "var(--text-xs)",
  },
  userAddress: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },

  /* Contact */
  contactRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as const,
    gap: 0,
  },
  contactItem: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },
  contactDot: {
    color: "var(--border-subtle)",
    margin: "0 6px",
    fontSize: "var(--text-xs)",
  },

  /* Stat pills */
  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--space-2)",
  },
  statPill: {
    background: "var(--bg-inset)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-2)",
    display: "flex",
    flexDirection: "column" as const,
    alignItems: "center",
    gap: 2,
  },
  statIcon: { fontSize: 13 },
  statVal: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-base)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    lineHeight: 1,
  },
  statLbl: {
    fontSize: 10,
    color: "var(--text-tertiary)",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    fontWeight: "var(--weight-semibold)" as any,
  },

  /* Progress */
  progressWrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 4,
  },
  progressMeta: {
    display: "flex",
    justifyContent: "space-between",
  },
  progressTrack: {
    height: 5,
    background: "var(--bg-inset)",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "var(--radius-full)",
    transition: "width 0.5s ease",
  },

  cardDivider: {
    height: 1,
    background: "var(--border-subtle)",
  },

  /* Pipeline */
  pipelineWrap: {
    display: "flex",
    flexDirection: "column" as const,
    gap: "var(--space-2)",
  },
  pipelineTrack: {
    height: 7,
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
    display: "flex",
    background: "var(--bg-inset)",
  },
  pipelineLegend: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "6px 12px",
  },
  legendItem: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 10,
    color: "var(--text-tertiary)",
  },
};