import { useEffect, useState, useMemo } from "react";
import { getToken } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

/* ── Types ── */
type ShopEntry = {
  shop: {
    _id: string;
    name: string;
    address: string;
    rating: number;
    ratingCount: number;
    totalOrders: number;
    avgDeliveryTime: number;
    servicesCount: number;
  };
  owner: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  };
  analytics: {
    totalDeliveries: number;
    completedDeliveries: number;
    pendingDeliveries: number;
  };
};

/* ── Helpers ── */
function completionRate(a: ShopEntry["analytics"]): number {
  if (!a.totalDeliveries) return 0;
  return Math.round((a.completedDeliveries / a.totalDeliveries) * 100);
}

function RatingStars({ rating }: { rating: number }) {
  return (
    <span style={{ display: "inline-flex", gap: 1, fontSize: 11 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          style={{
            color: n <= Math.round(rating) ? "#f59e0b" : "rgba(255,255,255,0.15)",
          }}
        >
          ★
        </span>
      ))}
    </span>
  );
}

/* ── Donut chart (SVG) ── */
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

/* ── Owner avatar initials ── */
function OwnerAvatar({ first, last }: { first: string; last: string }) {
  const initials = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return <div style={styles.ownerAvatar}>{initials}</div>;
}

/* ── Shop card ── */
function ShopCard({ entry }: { entry: ShopEntry }) {
  const { shop, owner, analytics } = entry;
  const rate = completionRate(analytics);
  const accentColor =
    rate >= 90
      ? "var(--color-success)"
      : rate >= 70
      ? "var(--cyan-500)"
      : "#f59e0b";

  return (
    <div style={styles.card}>
      {/* Top accent line */}
      <div style={{ ...styles.cardAccentLine, background: accentColor }} />

      {/* Card header */}
      <div style={styles.cardHeader}>
        <div style={styles.shopIconWrap}>
          <span style={{ fontSize: 22 }}>🏪</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={styles.shopName}>{shop.name}</div>
          <div style={styles.shopAddress}>📍 {shop.address}</div>
        </div>
        <DonutRing pct={rate} accent={accentColor} />
      </div>

      {/* Rating row */}
      <div style={styles.ratingRow}>
        <RatingStars rating={shop.rating} />
        <span style={styles.ratingVal}>{shop.rating.toFixed(1)}</span>
        <span style={styles.ratingCount}>({shop.ratingCount})</span>
        <span style={styles.deliveryBadge}>⏱ {shop.avgDeliveryTime} min</span>
      </div>

      {/* Stat pills */}
      <div style={styles.statRow}>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>🛍️</span>
          <span style={styles.statVal}>{shop.totalOrders}</span>
          <span style={styles.statLbl}>Orders</span>
        </div>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>✅</span>
          <span style={styles.statVal}>{analytics.completedDeliveries}</span>
          <span style={styles.statLbl}>Done</span>
        </div>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>⏳</span>
          <span style={{ ...styles.statVal, color: analytics.pendingDeliveries > 0 ? "#f59e0b" : "var(--text-secondary)" }}>
            {analytics.pendingDeliveries}
          </span>
          <span style={styles.statLbl}>Pending</span>
        </div>
        <div style={styles.statPill}>
          <span style={styles.statIcon}>🧺</span>
          <span style={styles.statVal}>{shop.servicesCount}</span>
          <span style={styles.statLbl}>Services</span>
        </div>
      </div>

      {/* Delivery progress bar */}
      <div style={styles.progressWrap}>
        <div style={styles.progressMeta}>
          <span style={{ fontSize: "var(--text-xs)", color: "var(--text-tertiary)" }}>Completion rate</span>
          <span style={{ fontSize: "var(--text-xs)", fontWeight: 700, color: accentColor }}>{rate}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${rate}%`, background: accentColor }} />
        </div>
      </div>

      {/* Divider */}
      <div style={styles.cardDivider} />

      {/* Owner row */}
      <div style={styles.ownerRow}>
        <OwnerAvatar first={owner.firstName} last={owner.lastName} />
        <div style={{ minWidth: 0 }}>
          <div style={styles.ownerName}>
            {owner.firstName} {owner.lastName}
            <span style={styles.ownerHandle}> @{owner.username}</span>
          </div>
          <div style={styles.ownerContact}>
            <span>✉️ {owner.email}</span>
            <span style={{ color: "var(--border-subtle)", margin: "0 6px" }}>·</span>
            <span>📞 {owner.phone}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Summary bar ── */
function SummaryBar({ data }: { data: ShopEntry[] }) {
  const totalOrders = data.reduce((s, e) => s + (e.shop.totalOrders ?? 0), 0);
  const totalCompleted = data.reduce((s, e) => s + e.analytics.completedDeliveries, 0);
  const totalPending = data.reduce((s, e) => s + e.analytics.pendingDeliveries, 0);
  const avgRating =
    data.length ? (data.reduce((s, e) => s + e.shop.rating, 0) / data.length).toFixed(1) : "–";

  return (
    <div style={styles.summaryBar}>
      {[
        { icon: "🏪", val: data.length, label: "Total shops" },
        { icon: "🛍️", val: totalOrders, label: "Total orders" },
        { icon: "✅", val: totalCompleted, label: "Completed" },
        { icon: "⏳", val: totalPending, label: "Pending" },
        { icon: "⭐", val: avgRating, label: "Avg rating" },
      ].map((s, i, arr) => (
        <div
          key={i}
          style={{
            ...styles.summaryCell,
            borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
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
export default function AllShops() {
  const [shops, setShops] = useState<ShopEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"rating" | "orders" | "completion" | "pending">("rating");

  useEffect(() => {
    const fetchShops = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/admin/shop/shops/analytics`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to fetch shops");
        setShops(data.data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchShops();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return shops
      .filter(
        (e) =>
          e.shop.name.toLowerCase().includes(q) ||
          e.shop.address.toLowerCase().includes(q) ||
          e.owner.firstName.toLowerCase().includes(q) ||
          e.owner.lastName.toLowerCase().includes(q) ||
          e.owner.username.toLowerCase().includes(q)
      )
      .sort((a, b) => {
            if (sort === "rating") return b.shop.ratingCount - a.shop.ratingCount;        // ← by number of ratings
            if (sort === "orders") return (b.shop.totalOrders ?? 0) - (a.shop.totalOrders ?? 0);  // ← guard NaN
            if (sort === "completion") return b.analytics.completedDeliveries - a.analytics.completedDeliveries; // ← by done count
            if (sort === "pending") return b.analytics.pendingDeliveries - a.analytics.pendingDeliveries;
            return 0;
        });
  }, [shops, search, sort]);

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
          <div style={styles.pageTitle}>All Shops</div>
          <div style={styles.pageSubtitle}>
            {shops.length} registered shops · analytics overview
          </div>
        </div>
      </div>

      {/* ── Summary ── */}
      <SummaryBar data={shops} />

      {/* ── Controls ── */}
      <div style={styles.controls}>
        {/* Search */}
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            style={styles.searchInput}
            placeholder="Search shops, owners, addresses…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button style={styles.clearBtn} onClick={() => setSearch("")}>✕</button>
          )}
        </div>

        {/* Sort tabs */}
        <div style={styles.sortRow}>
          {(
            [
              { key: "rating", label: "⭐ Rating" },
              { key: "orders", label: "🛍️ Orders" },
              { key: "completion", label: "✅ Completion" },
              { key: "pending", label: "⏳ Pending" },
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
            No shops match your search.
          </div>
        </div>
      ) : (
        <div style={styles.grid}>
          {filtered.map((entry) => (
            <ShopCard key={entry.shop._id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Styles — Ocean Midnight tokens ── */
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

  /* ── Page header ── */
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

  /* ── Summary bar ── */
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

  /* ── Controls ── */
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

  /* ── Grid ── */
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
    gap: "var(--space-4)",
  },
  emptyState: {
    textAlign: "center" as const,
    padding: "60px 0",
  },

  /* ── Card ── */
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
    paddingTop: 4, // clear accent line
  },
  shopIconWrap: {
    width: 44,
    height: 44,
    borderRadius: "var(--radius-md)",
    background: "rgba(0,180,216,0.1)",
    border: "1px solid rgba(0,180,216,0.2)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  shopName: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-base)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-primary)",
    lineHeight: "var(--leading-tight)",
    marginBottom: 2,
  },
  shopAddress: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
  },

  ratingRow: {
    display: "flex",
    alignItems: "center",
    gap: 6,
  },
  ratingVal: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-bold)" as any,
    color: "#f59e0b",
  },
  ratingCount: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    flex: 1,
  },
  deliveryBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    background: "rgba(0,180,216,0.1)",
    border: "1px solid rgba(0,180,216,0.2)",
    borderRadius: "var(--radius-full)",
    padding: "2px 10px",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
    color: "var(--cyan-300)",
  },

  statRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "var(--space-2)",
  },
  statPill: {
    background: "var(--bg-inset)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-2) var(--space-2)",
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

  ownerRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
  },
  ownerAvatar: {
    width: 34,
    height: 34,
    borderRadius: "var(--radius-full)",
    background: "linear-gradient(135deg, var(--navy-600), var(--navy-900))",
    border: "1px solid rgba(0,180,216,0.25)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--cyan-300)",
    fontFamily: "var(--font-display)",
    flexShrink: 0,
  },
  ownerName: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-semibold)" as any,
    color: "var(--text-primary)",
    marginBottom: 2,
  },
  ownerHandle: {
    fontWeight: "var(--weight-normal)" as any,
    color: "var(--text-tertiary)",
    fontSize: "var(--text-xs)",
  },
  ownerContact: {
    fontSize: "var(--text-xs)",
    color: "var(--text-tertiary)",
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap" as const,
  },
};