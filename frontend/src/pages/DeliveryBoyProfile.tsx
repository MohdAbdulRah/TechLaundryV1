import { useEffect, useState, useRef } from "react";
import { getToken } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

type DeliveryBoyProfileData = {
  profile: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    location: {
      type: "Point";
      coordinates: [number, number];
    };
    inDelivery: boolean;
     avail: boolean;
  };
  analytics: {
    totalDeliveries: number;
    completedDeliveries: number;
    pendingDeliveries: number;
    userToShopTrips: number;
    shopToUserTrips: number;
    completionRate: number;
    lastCompletedDelivery: string | null;
    activeDelivery: string | null;
  };
};

// ─────────────────────────────────────────────
// Donut Chart (SVG, no lib)
// ─────────────────────────────────────────────

function DonutChart({
  segments,
  size = 120,
  stroke = 14,
  label,
  sublabel,
}: {
  segments: { value: number; color: string; label: string }[];
  size?: number;
  stroke?: number;
  label: string;
  sublabel: string;
}) {
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  let offset = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {/* Track */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
          />
          {segments.map((seg, i) => {
            const pct = seg.value / total;
            const dash = pct * circumference;
            const gap = circumference - dash;
            const el = (
              <circle
                key={i}
                cx={cx} cy={cy} r={r}
                fill="none"
                stroke={seg.color}
                strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset * circumference}
                strokeLinecap="round"
                style={{ transition: "stroke-dasharray 0.8s ease" }}
              />
            );
            offset += pct;
            return el;
          })}
        </svg>
        {/* Centre label */}
        <div style={{
          position: "absolute", inset: 0,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
        }}>
          <span style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", lineHeight: 1 }}>{label}</span>
          <span style={{ fontSize: 10, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".05em", marginTop: 3 }}>{sublabel}</span>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5, width: "100%" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--text-secondary)", flex: 1 }}>{seg.label}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{seg.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Horizontal Bar Chart
// ─────────────────────────────────────────────

function HBarChart({
  bars,
}: {
  bars: { label: string; value: number; max: number; color: string; icon: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {bars.map((bar, i) => {
        const pct = Math.min(100, Math.round((bar.value / bar.max) * 100));
        return (
          <div key={i}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 13, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 6 }}>
                <span>{bar.icon}</span>
                {bar.label}
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>{bar.value}</span>
            </div>
            <div style={{
              height: 8, borderRadius: 99,
              background: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}>
              <div style={{
                height: "100%",
                width: `${pct}%`,
                borderRadius: 99,
                background: bar.color,
                transition: "width 1s cubic-bezier(.4,0,.2,1)",
              }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────
// Gauge / Arc for completion rate
// ─────────────────────────────────────────────

function GaugeChart({ pct }: { pct: number }) {
  const size = 140;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  // Half-arc: use a 180° sweep
  const arcLength = Math.PI * r; // half circumference
  const filled = (pct / 100) * arcLength;

  const color =
    pct >= 90 ? "#22c55e" :
    pct >= 70 ? "#f59e0b" :
                "#ef4444";

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <div style={{ position: "relative", width: size, height: size / 2 + stroke / 2, overflow: "hidden" }}>
        <svg
          width={size}
          height={size}
          style={{ position: "absolute", top: 0, left: 0 }}
          viewBox={`0 0 ${size} ${size}`}
        >
          {/* Track arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={stroke}
            strokeDasharray={`${arcLength} ${999}`}
            strokeDashoffset={0}
            transform={`rotate(180 ${cx} ${cy})`}
            strokeLinecap="round"
          />
          {/* Filled arc */}
          <circle
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={`${filled} ${999}`}
            strokeDashoffset={0}
            transform={`rotate(180 ${cx} ${cy})`}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 1s ease, stroke 0.4s" }}
          />
        </svg>
        {/* Value label */}
        <div style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          textAlign: "center",
        }}>
          <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{pct.toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>
        Completion Rate
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────

function SectionHead({ label }: { label: string }) {
  return (
    <div style={styles.sectionHead}>
      <span style={styles.sectionLabel}>{label}</span>
      <div style={styles.sectionLine} />
    </div>
  );
}

function InfoItem({ label, icon, value }: { label: string; icon: string; value: string }) {
  return (
    <div>
      <div style={styles.infoLabel}>{label}</div>
      <div style={styles.infoVal}>{icon} {value}</div>
    </div>
  );
}

function AnalyticCard({
  icon, val, label, accent, sub,
}: {
  icon: string; val: string | number; label: string; accent: string; sub?: string;
}) {
  return (
    <div style={styles.analyticCard}>
      <div style={styles.analyticIcon}>{icon}</div>
      <div style={{ ...styles.analyticVal, color: accent }}>{val}</div>
      <div style={styles.analyticLabel}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 4 }}>{sub}</div>}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0,
        height: 3, background: accent,
        borderRadius: "0 0 12px 12px",
      }} />
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function DeliveryBoyProfile() {
  const [data, setData] = useState<DeliveryBoyProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [displayLat, setDisplayLat] = useState(0);
  const [displayLng, setDisplayLng] = useState(0);
  const [displayAddress, setDisplayAddress] = useState("");

  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);
  const [updatingAvail, setUpdatingAvail] = useState(false);

const handleAvailToggle = async () => {
  if (!data) return;

  try {
    setUpdatingAvail(true);

    const newAvail = !data.profile.avail;

    const res = await fetch(
      `${BASE_URL}/api/boy/delivery-boy/avail`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`
        },
        body: JSON.stringify({
          avail: newAvail
        })
      }
    );

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json.message);
    }

    setData(prev =>
      prev
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              avail: newAvail
            }
          }
        : prev
    );
  } catch (err: any) {
    alert(err.message);
  } finally {
    setUpdatingAvail(false);
  }
};
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/boy/delivery-boy/profile`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.message ?? "Failed to fetch profile");
        const d: DeliveryBoyProfileData = json.data;
        setData(d);
        const [lng, lat] = d.profile.location?.coordinates ?? [0, 0];
        setDisplayLat(Number(lat));
        setDisplayLng(Number(lng));
        setDisplayAddress(d.profile.address ?? "");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleRefreshLocation = () => {
    if (!navigator.geolocation) {
      setLocError("Geolocation is not supported by your browser.");
      return;
    }
    setLocLoading(true);
    setLocError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(`${BASE_URL}/api/users/addLocation`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${getToken()}`,
            },
            body: JSON.stringify({
              location: { type: "Point", coordinates: [longitude, latitude] },
            }),
          });
          const json = await res.json();
          if (!res.ok) throw new Error(json.message ?? "Failed to update location");

          const newAddress = json.data.user.address ?? "";
          setDisplayLat(latitude);
          setDisplayLng(longitude);
          setDisplayAddress(newAddress);
          setData((prev) =>
            prev
              ? {
                  ...prev,
                  profile: {
                    ...prev.profile,
                    address: newAddress,
                    location: { type: "Point", coordinates: [longitude, latitude] },
                  },
                }
              : prev
          );
        } catch (e: any) {
          setLocError(e.message);
        } finally {
          setLocLoading(false);
        }
      },
      (geoErr) => {
        setLocError(
          geoErr.code === 1
            ? "Location permission denied. Please allow access in your browser."
            : "Unable to determine your location. Please try again."
        );
        setLocLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  if (loading) {
    return (
      <div style={styles.centered}>
        <div style={styles.spinner} />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={styles.centered}>
        <p style={{ color: "var(--color-danger)", fontSize: 14 }}>
          {error ?? "Something went wrong."}
        </p>
      </div>
    );
  }

  const { profile, analytics } = data;
  const initials = `${profile.firstName?.[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase();
  const fullName = `${profile.firstName} ${profile.lastName}`;

  const lastDeliveryStr = analytics.lastCompletedDelivery
    ? new Date(analytics.lastCompletedDelivery).toLocaleDateString("en-IN", {
        day: "2-digit", month: "short", year: "numeric",
      })
    : "—";

  return (
    <div style={styles.root}>

      {/* ── HERO ── */}
      <div style={styles.hero}>
        <div style={styles.heroBgGlow} />
        {/* Extra decorative ring */}
        <div style={styles.heroBgGlow2} />

        <div style={styles.heroTop}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={styles.avatar}>{initials}</div>
            <div style={{
              ...styles.statusDot,
              background: profile.inDelivery ? "#f59e0b" : "#22c55e",
            }} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.heroName}>{fullName}</div>
            <div style={styles.heroHandle}>@{profile.username} · {profile.email}</div>
            <div style={styles.chipRow}>
              <span style={{ ...styles.chip, ...styles.chipCyan }}>🚴 Delivery Agent</span>
              <span style={{
                ...styles.chip,
                background: profile.inDelivery ? "rgba(245,158,11,.15)" : "rgba(34,197,94,.15)",
                color: profile.inDelivery ? "#f59e0b" : "#22c55e",
                border: `1px solid ${profile.inDelivery ? "rgba(245,158,11,.3)" : "rgba(34,197,94,.3)"}`,
              }}>
                {profile.inDelivery ? "🔄 In Delivery" : "Not In Delivery"}
              </span>
              <span style={{ ...styles.chip, ...styles.chipSlate }}>📞 {profile.phone}</span>
            </div>
            <div
  style={{
    marginTop: 12,
    display: "flex",
    alignItems: "center",
    gap: 12
  }}
>
  <span
    style={{
      fontSize: 14,
      fontWeight: 600,
      color: data.profile.avail
        ? "#22c55e"
        : "#ef4444"
    }}
  >
    {data.profile.avail
      ? "🟢 Available"
      : "🔴 Not Available"}
  </span>

  <button
    onClick={handleAvailToggle}
    disabled={updatingAvail}
    style={{
      width: 56,
      height: 30,
      borderRadius: 999,
      border: "none",
      cursor: "pointer",
      position: "relative",
      background: data.profile.avail
        ? "#22c55e"
        : "#6b7280",
      transition: "0.3s"
    }}
  >
    <div
      style={{
        position: "absolute",
        top: 3,
        left: data.profile.avail ? 30 : 3,
        width: 24,
        height: 24,
        borderRadius: "50%",
        background: "#fff",
        transition: "0.3s"
      }}
    />
  </button>
</div>
          </div>
        </div>

        <div style={styles.heroDivider} />

        <div style={styles.heroStats}>
          {[
            { val: analytics.totalDeliveries,    label: "Total" },
            { val: analytics.completedDeliveries, label: "Done" },
            { val: analytics.pendingDeliveries,  label: "Pending" },
            { val: `${analytics.completionRate.toFixed(0)}%`, label: "Rate" },
          ].map((s, i, arr) => (
            <div
              key={i}
              style={{
                ...styles.heroStat,
                borderRight: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <div style={{
                ...styles.heroStatVal,
                color: i === 3
                  ? analytics.completionRate >= 90 ? "#22c55e"
                  : analytics.completionRate >= 70 ? "#f59e0b" : "#ef4444"
                  : "var(--text-inverse)",
              }}>{s.val}</div>
              <div style={styles.heroStatLbl}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── ACCOUNT DETAILS ── */}
      <SectionHead label="Account details" />

      <div style={styles.infoCard}>
        <div style={styles.infoGrid}>
          <InfoItem label="Full name" icon="👤" value={fullName} />
          <InfoItem label="Username"  icon="@"  value={profile.username} />
          <InfoItem label="Email"     icon="✉️" value={profile.email} />
          <InfoItem label="Phone"     icon="📞" value={profile.phone} />

          {/* Address row with refresh */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={styles.infoLabel}>Address</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={styles.infoVal}>🏠 {displayAddress || profile.address}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.locBadge}>
                  📍 {parseFloat(String(displayLat)).toFixed(4)}°N · {parseFloat(String(displayLng)).toFixed(4)}°E
                </span>
                <button
                  onClick={handleRefreshLocation}
                  disabled={locLoading}
                  style={{
                    ...styles.reloadBtn,
                    ...(locLoading ? styles.reloadBtnLoading : {}),
                  }}
                  title="Update to current location"
                >
                  {locLoading
                    ? <span style={styles.reloadSpinner} />
                    : <span style={{ fontSize: 16, lineHeight: 1 }}>⟳</span>
                  }
                </button>
              </div>
            </div>
            {locError && <div style={styles.locErrorMsg}>{locError}</div>}
          </div>
        </div>
      </div>

      {/* ── STAT CARDS ── */}
      <SectionHead label="Performance overview" />

      <div style={styles.analyticsGrid}>
        <AnalyticCard
          icon="🚚"
          val={analytics.totalDeliveries}
          label="Total Deliveries"
          accent="var(--cyan-500)"
        />
        <AnalyticCard
          icon="✅"
          val={analytics.completedDeliveries}
          label="Completed"
          accent="#22c55e"
          sub={`Last: ${lastDeliveryStr}`}
        />
        <AnalyticCard
          icon="⏳"
          val={analytics.pendingDeliveries}
          label="Pending"
          accent="#f59e0b"
          sub={analytics.activeDelivery ? "Active delivery ongoing" : "No active delivery"}
        />
      </div>

      {/* ── CHARTS ROW ── */}
      <SectionHead label="Delivery analytics" />

      <div style={styles.chartsRow}>

        {/* Donut: completed vs pending */}
        <div style={styles.chartCard}>
          <div style={styles.chartCardTitle}>Delivery Status</div>
          <DonutChart
            size={140}
            stroke={16}
            label={String(analytics.totalDeliveries)}
            sublabel="total"
            segments={[
              { value: analytics.completedDeliveries, color: "#22c55e",  label: "Completed" },
              { value: analytics.pendingDeliveries,   color: "#f59e0b",  label: "Pending" },
            ]}
          />
        </div>

        {/* Donut: trip types */}
        <div style={styles.chartCard}>
          <div style={styles.chartCardTitle}>Trip Direction</div>
          <DonutChart
            size={140}
            stroke={16}
            label={String(analytics.userToShopTrips + analytics.shopToUserTrips)}
            sublabel="trips"
            segments={[
              { value: analytics.userToShopTrips,  color: "var(--cyan-500)", label: "User → Shop" },
              { value: analytics.shopToUserTrips,  color: "#a78bfa",         label: "Shop → User" },
            ]}
          />
        </div>

        {/* Gauge: completion rate */}
        <div style={styles.chartCard}>
          <div style={styles.chartCardTitle}>Efficiency</div>
          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10 }}>
            <GaugeChart pct={analytics.completionRate} />
          </div>
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--text-tertiary)", textAlign: "center" }}>
            {analytics.completionRate >= 90
              ? "🏆 Excellent performance"
              : analytics.completionRate >= 70
              ? "👍 Good performance"
              : "⚠️ Needs improvement"}
          </div>
        </div>
      </div>

      {/* ── TRIP BREAKDOWN ── */}
      <SectionHead label="Trip breakdown" />

      <div style={styles.infoCard}>
        <HBarChart
          bars={[
            {
              label: "User → Shop trips",
              value: analytics.userToShopTrips,
              max: analytics.totalDeliveries || 1,
              color: "var(--cyan-500)",
              icon: "🏪",
            },
            {
              label: "Shop → User trips",
              value: analytics.shopToUserTrips,
              max: analytics.totalDeliveries || 1,
              color: "#a78bfa",
              icon: "🏠",
            },
            {
              label: "Completed deliveries",
              value: analytics.completedDeliveries,
              max: analytics.totalDeliveries || 1,
              color: "#22c55e",
              icon: "✅",
            },
            {
              label: "Pending deliveries",
              value: analytics.pendingDeliveries,
              max: analytics.totalDeliveries || 1,
              color: "#f59e0b",
              icon: "⏳",
            },
          ]}
        />
      </div>

    </div>
  );
}

// ─────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────

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

  /* Hero */
  hero: {
    background: "var(--navy-900)",
    borderRadius: "var(--radius-lg)",
    padding: "28px 28px 0",
    position: "relative",
    overflow: "hidden",
  },
  heroBgGlow: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(0,180,216,0.18) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  heroBgGlow2: {
    position: "absolute",
    bottom: -60,
    left: -30,
    width: 180,
    height: 180,
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(167,139,250,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  heroTop: {
    display: "flex",
    alignItems: "flex-start",
    gap: "var(--space-4)",
    marginBottom: "var(--space-5)",
    position: "relative",
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: "var(--radius-full)",
    background: "linear-gradient(135deg, #f59e0b, #ef4444)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontSize: 24,
    fontWeight: 700,
    color: "#fff",
    border: "3px solid rgba(245,158,11,0.4)",
  },
  statusDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: "var(--radius-full)",
    border: "2px solid var(--navy-900)",
  },
  heroName: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-2xl)",
    fontWeight: "var(--weight-bold)" as any,
    color: "var(--text-inverse)",
    lineHeight: "var(--leading-tight)",
    marginBottom: "var(--space-1)",
  },
  heroHandle: {
    fontSize: "var(--text-sm)",
    color: "rgba(255,255,255,0.45)",
    marginBottom: "var(--space-2)",
  },
  chipRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "var(--space-2)",
  },
  chip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-1)",
    padding: "3px 10px",
    borderRadius: "var(--radius-full)",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
  },
  chipCyan: {
    background: "rgba(245,158,11,0.15)",
    color: "#f59e0b",
    border: "1px solid rgba(245,158,11,0.3)",
  },
  chipSlate: {
    background: "var(--bg-sidebar-hover)",
    color: "var(--sidebar-text)",
    border: "1px solid var(--sidebar-border)",
  },
  heroDivider: {
    height: 1,
    background: "var(--sidebar-border)",
    margin: "0 -28px",
  },
  heroStats: {
    display: "flex",
    padding: "var(--space-4) 0",
  },
  heroStat: {
    flex: 1,
    textAlign: "center",
    padding: "0 var(--space-3)",
  },
  heroStatVal: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-2xl)",
    fontWeight: "var(--weight-bold)" as any,
    lineHeight: 1,
  },
  heroStatLbl: {
    fontSize: "var(--text-xs)",
    color: "rgba(255,255,255,0.38)",
    marginTop: "var(--space-1)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    fontWeight: "var(--weight-semibold)" as any,
  },

  /* Section head */
  sectionHead: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    margin: "var(--space-6) 0 var(--space-3)",
  },
  sectionLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-bold)" as any,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
    color: "var(--text-tertiary)",
    whiteSpace: "nowrap",
  },
  sectionLine: {
    flex: 1,
    height: 1,
    background: "var(--border-subtle)",
  },

  /* Info card */
  infoCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5) var(--space-6)",
    boxShadow: "var(--shadow-sm)",
  },
  infoGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "var(--space-4) var(--space-6)",
  },
  infoLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
    color: "var(--text-tertiary)",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    marginBottom: "var(--space-1)",
  },
  infoVal: {
    fontSize: "var(--text-sm)",
    color: "var(--text-primary)",
    fontWeight: "var(--weight-medium)" as any,
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2)",
  },
  locBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "var(--space-1)",
    background: "var(--color-info-light)",
    border: "1px solid var(--border-accent)",
    borderRadius: "var(--radius-full)",
    padding: "4px 12px",
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
    color: "var(--color-info-dark)",
  },
  reloadBtn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: "var(--radius-full)",
    border: "1px solid var(--border-accent)",
    background: "var(--color-info-light)",
    color: "var(--color-info-dark)",
    cursor: "pointer",
    transition: "background 0.15s, transform 0.15s",
    flexShrink: 0,
    padding: 0,
    outline: "none",
  },
  reloadBtnLoading: {
    opacity: 0.6,
    cursor: "not-allowed",
  },
  reloadSpinner: {
    display: "inline-block",
    width: 14,
    height: 14,
    border: "2px solid rgba(0,180,216,0.25)",
    borderTop: "2px solid var(--cyan-500)",
    borderRadius: "50%",
    animation: "spin 0.7s linear infinite",
  },
  locErrorMsg: {
    marginTop: 6,
    fontSize: "var(--text-xs)",
    color: "var(--color-danger)",
  },

  /* Stat cards */
  analyticsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "var(--space-3)",
  },
  analyticCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
    position: "relative",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
  },
  analyticIcon: {
    fontSize: 22,
    marginBottom: "var(--space-2)",
  },
  analyticVal: {
    fontFamily: "var(--font-display)",
    fontSize: "var(--text-3xl)",
    fontWeight: "var(--weight-bold)" as any,
    lineHeight: 1,
  },
  analyticLabel: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-semibold)" as any,
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    color: "var(--text-tertiary)",
    marginTop: "var(--space-1)",
  },

  /* Charts row */
  chartsRow: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "var(--space-3)",
  },
  chartCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-5)",
    boxShadow: "var(--shadow-sm)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  chartCardTitle: {
    fontSize: "var(--text-xs)",
    fontWeight: "var(--weight-bold)" as any,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--text-tertiary)",
  },
};