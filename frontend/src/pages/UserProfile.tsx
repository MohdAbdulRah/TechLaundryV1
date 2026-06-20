import { useEffect, useState } from "react";
import { getToken } from "../utils/auth";

const BASE_URL = import.meta.env.VITE_API_URL ?? "";

type ShopInteracted = {
  shopId: string;
  shopName: string;
  servicesSelected: number;
};

type ProfileData = {
  user: {
    _id: string;
    username: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    role: string;
    address: string;
    location: {
      type: "Point";
      coordinates: [number, number];
    };
  };
  analytics: {
    totalOrders: number;
    totalShopsInteracted: number;
    totalServicesSelected: number;
    shopsInteracted: ShopInteracted[];
  };
};

const RANK_LABELS = ["🥇", "🥈", "🥉"];
const RANK_STYLES: React.CSSProperties[] = [
  { background: "rgba(234,179,8,0.15)", color: "#a16207" },
  { background: "rgba(148,163,184,0.15)", color: "#475569" },
  { background: "rgba(180,83,9,0.15)", color: "#92400e" },
];

/** Reverse-geocode [lat, lng] → human-readable address via OpenStreetMap Nominatim */
async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
    { headers: { "Accept-Language": "en" } }
  );
  const data = await res.json();
  return data.display_name ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
}

export default function UserProfile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Live-updated location & address (may differ from profile after a refresh)
  const [displayLat, setDisplayLat] = useState<number>(0);
  const [displayLng, setDisplayLng] = useState<number>(0);
  const [displayAddress, setDisplayAddress] = useState<string>("");

  // Reload-button state
  const [locLoading, setLocLoading] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/general/get/Profile`, {
          headers: { Authorization: `Bearer ${getToken()}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to fetch profile");
        const prof: ProfileData = data.data;
        setProfile(prof);

        const [lng, lat] = prof.user.location?.coordinates ?? [0, 0];
        setDisplayLat(Number(lat));
        setDisplayLng(Number(lng));
        setDisplayAddress(prof.user.address ?? "");
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  /** Get current GPS position, save to backend, reverse-geocode → update UI */
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
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? "Failed to update location");

        // Use address returned by backend — no second Nominatim call needed
        const newAddress = data.data.user.address ?? "";

        setDisplayLat(latitude);
        setDisplayLng(longitude);
        setDisplayAddress(newAddress);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                user: {
                  ...prev.user,
                  address: newAddress,
                  location: { type: "Point", coordinates: [longitude, latitude] },
                },
              }
            : prev
        );
      } catch (err: any) {
        setLocError(err.message);
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

  if (error || !profile) {
    return (
      <div style={styles.centered}>
        <p style={{ color: "var(--color-danger)", fontSize: 14 }}>
          {error ?? "Something went wrong."}
        </p>
      </div>
    );
  }

  const { user, analytics } = profile;
  const initials = `${user.firstName?.[0] ?? ""}${user.lastName?.[0] ?? ""}`.toUpperCase();
  const fullName = `${user.firstName} ${user.lastName}`;
  const maxServices = Math.max(...analytics.shopsInteracted.map((s) => s.servicesSelected), 1);

  return (
    <div style={styles.root}>

      {/* ── HERO ── */}
      <div style={styles.hero}>
        <div style={styles.heroBgGlow} />

        <div style={styles.heroTop}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={styles.avatar}>{initials}</div>
            <div style={styles.onlineDot} />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={styles.heroName}>{fullName}</div>
            <div style={styles.heroHandle}>@{user.username} · {user.email}</div>
            <div style={styles.chipRow}>
              <span style={{ ...styles.chip, ...styles.chipCyan }}>✓ Verified User</span>
              <span style={{ ...styles.chip, ...styles.chipSlate }}>📍 {displayAddress || user.address}</span>
              <span style={{ ...styles.chip, ...styles.chipSlate }}>📞 {user.phone}</span>
            </div>
          </div>
        </div>

        <div style={styles.heroDivider} />

        <div style={styles.heroStats}>
          {[
            { val: analytics.totalOrders, label: "Orders" },
            { val: analytics.totalShopsInteracted, label: "Shops" },
            { val: analytics.totalServicesSelected, label: "Services" },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                ...styles.heroStat,
                borderRight: i < 2 ? "1px solid rgba(255,255,255,0.07)" : "none",
              }}
            >
              <div style={styles.heroStatVal}>{s.val}</div>
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
          <InfoItem label="Username"  icon="@"  value={user.username} />
          <InfoItem label="Email"     icon="✉️" value={user.email} />
          <InfoItem label="Phone"     icon="📞" value={user.phone} />

          {/* ── Address row with refresh button ── */}
          <div style={{ gridColumn: "1 / -1" }}>
            <div style={styles.infoLabel}>Address</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
              <span style={styles.infoVal}>🏠 {displayAddress || user.address}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={styles.locBadge}>
                  📍 {parseFloat(String(displayLat)).toFixed(4)}°N · {parseFloat(String(displayLng)).toFixed(4)}°E
                </span>

                {/* Refresh / reload location button */}
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

            {locError && (
              <div style={styles.locErrorMsg}>{locError}</div>
            )}
          </div>
        </div>
      </div>

      {/* ── ANALYTICS ── */}
      <SectionHead label="Activity analytics" />

      <div style={styles.analyticsGrid}>
        <AnalyticCard icon="🛍️" val={analytics.totalOrders}          label="Total orders"  accent="var(--cyan-500)" />
        <AnalyticCard icon="🏪" val={analytics.totalShopsInteracted}  label="Shops visited" accent="var(--navy-600)" />
        <AnalyticCard icon="✅" val={analytics.totalServicesSelected} label="Services used" accent="var(--color-success)" />
      </div>

      {/* ── TOP SHOPS ── */}
      <SectionHead label="Top shops" />

      <div style={styles.shopCard}>
        {analytics.shopsInteracted.map((shop, i) => {
          const pct = Math.round((shop.servicesSelected / maxServices) * 100);
          return (
            <div
              key={shop.shopId}
              style={{
                ...styles.shopRow,
                borderBottom:
                  i < analytics.shopsInteracted.length - 1
                    ? "1px solid var(--border-subtle)"
                    : "none",
              }}
            >
              <div style={{ ...styles.shopRank, ...RANK_STYLES[i] }}>
                {RANK_LABELS[i]}
              </div>
              <div style={styles.shopName}>{shop.shopName}</div>
              <div style={styles.shopBarWrap}>
                <div style={{ ...styles.shopBarFill, width: `${pct}%` }} />
              </div>
              <div style={styles.shopCount}>{shop.servicesSelected} svc</div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

/* ── Sub-components ── */

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
  icon, val, label, accent,
}: {
  icon: string; val: number; label: string; accent: string;
}) {
  return (
    <div style={styles.analyticCard}>
      <div style={styles.analyticIcon}>{icon}</div>
      <div style={styles.analyticVal}>{val}</div>
      <div style={styles.analyticLabel}>{label}</div>
      <div
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: 3, background: accent,
          borderRadius: "0 0 12px 12px",
        }}
      />
    </div>
  );
}

/* ── Styles — ONLY Ocean Midnight tokens ── */

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

  /* ── Hero ── */
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
    background: "linear-gradient(135deg, var(--cyan-400), var(--cyan-500))",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "var(--font-display)",
    fontSize: 24,
    fontWeight: 700,
    color: "var(--navy-900)",
    border: "3px solid rgba(0,180,216,0.35)",
  },
  onlineDot: {
    position: "absolute",
    bottom: 4,
    right: 4,
    width: 14,
    height: 14,
    borderRadius: "var(--radius-full)",
    background: "var(--color-success)",
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
    background: "rgba(0,180,216,0.15)",
    color: "var(--cyan-300)",
    border: "1px solid rgba(0,180,216,0.25)",
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
    color: "var(--text-inverse)",
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

  /* ── Section head ── */
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

  /* ── Info card ── */
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

  /* ── Reload button ── */
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

  /* ── Analytics ── */
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
    color: "var(--text-primary)",
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

  /* ── Shops ── */
  shopCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-subtle)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    boxShadow: "var(--shadow-sm)",
  },
  shopRow: {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-3)",
    padding: "var(--space-4) var(--space-6)",
    transition: "background var(--ease-fast)",
    cursor: "default",
  },
  shopRank: {
    width: 28,
    height: 28,
    borderRadius: "var(--radius-full)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    flexShrink: 0,
  },
  shopName: {
    flex: 1,
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-medium)" as any,
    color: "var(--text-primary)",
  },
  shopBarWrap: {
    width: 120,
    height: 6,
    background: "var(--bg-inset)",
    borderRadius: "var(--radius-full)",
    overflow: "hidden",
  },
  shopBarFill: {
    height: "100%",
    borderRadius: "var(--radius-full)",
    background: "var(--cyan-500)",
    transition: "width var(--ease-slow)",
  },
  shopCount: {
    fontSize: "var(--text-sm)",
    fontWeight: "var(--weight-semibold)" as any,
    color: "var(--text-secondary)",
    minWidth: 40,
    textAlign: "right",
  },
};