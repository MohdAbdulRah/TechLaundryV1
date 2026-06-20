import { useEffect, useState } from 'react';
import { getUser, getToken } from '../utils/auth';
import { usePageTitle } from '../components/DashboardLayout';
import ShopModal from '../components/ShopModal';
// ─── Types ────────────────────────────────────────────────────────────────────

interface Shop {
  _id: string;
  name: string;
  address: string;
  prices: unknown[];
  location?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };
}

type LocationPhase =
  | 'checking'       // calling getLocation API
  | 'requesting'     // browser geolocation prompt
  | 'saving'         // calling addLocation API
  | 'loading-shops'  // calling all shops API
  | 'done'
  | 'error';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function authGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: `2px solid var(--border-default)`,
        borderTopColor: 'var(--cyan-500)',
        borderRadius: '50%',
        animation: 'spin 0.7s linear infinite',
        flexShrink: 0,
      }}
    />
  );
}

// Centered loading — fits inside the layout content area (no full-page override)
function LoadingBlock({ message }: { message: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        padding: '80px 20px',
      }}
    >
      <Spinner size={36} />
      <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)', margin: 0 }}>
        {message}
      </p>
    </div>
  );
}

function LocationPrompt({
  onAllow,
  onDeny,
  loading,
}: {
  onAllow: () => void;
  onDeny: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 16px',
      }}
    >
      <div
        className="card card-elevated"
        style={{
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
          padding: '52px 40px',
          borderTop: '3px solid var(--cyan-500)',
        }}
      >
        {/* Icon */}
        <div style={{ marginBottom: 28 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              background: 'var(--cyan-50)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 36,
              boxShadow: '0 0 0 12px rgba(0,180,216,0.08)',
              margin: '0 auto',
            }}
          >
            📍
          </div>
        </div>

        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            color: 'var(--text-primary)',
            margin: '0 0 10px',
          }}
        >
          Enable Location
        </h2>
        <p style={{ color: 'var(--text-secondary)', margin: '0 0 32px', lineHeight: 'var(--leading-relaxed)' }}>
          Allow location access to discover shops near you. You can still browse without it.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            className="btn btn-primary btn-lg"
            onClick={onAllow}
            disabled={loading}
            style={{ flex: 1 }}
          >
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                <Spinner size={16} /> Saving…
              </span>
            ) : (
              '📍 Allow Location'
            )}
          </button>
          <button
            className="btn btn-secondary btn-lg"
            onClick={onDeny}
            disabled={loading}
            style={{ flex: 1 }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}

function ShopCard({ shop , onClick}: { shop: Shop; onClick: () => void }) {
  const hasLocation = !!shop.location?.coordinates;
  const [lng, lat] = shop.location?.coordinates ?? [];

  return (
    <div
      className="card"
      style={{
        padding: '20px 22px',
        transition: 'box-shadow var(--ease-normal), transform var(--ease-normal)',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-md)';
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
        (e.currentTarget as HTMLDivElement).style.transform = '';
      }}
      onClick={onClick}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 14 }}>
        <div
          className="avatar avatar-lg"
          style={{
            background: 'var(--navy-800)',
            color: 'var(--cyan-300)',
            borderRadius: 'var(--radius-md)',
            flexShrink: 0,
          }}
        >
          {getInitials(shop.name)}
        </div>
        <div style={{ minWidth: 0 }}>
          <h3
            style={{
              margin: '0 0 4px',
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-base)',
              fontWeight: 'var(--weight-semibold)',
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {shop.name}
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            📍 {shop.address}
          </p>
        </div>
      </div>

      {/* Divider */}
      <div className="divider" style={{ margin: '12px 0' }} />

      {/* Footer row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className={`badge ${hasLocation ? 'badge-success' : 'badge-neutral'}`}>
          {hasLocation ? '🛰 Location on' : '⚪ No location'}
        </span>
        {/* {hasLocation && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {lat?.toFixed(4)}, {lng?.toFixed(4)}
          </span>
        )} */}
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function UserDashboard() {
  const user = getUser();

  // Push page title into the DashboardLayout topbar
  usePageTitle('Shops');

  const [phase, setPhase] = useState<LocationPhase>('checking');
  const [shops, setShops] = useState<Shop[]>([]);
  const [error, setError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  // ── Step 1: on mount, check if user already has a location ──────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await authGet<{ data: { user: { location?: unknown } } }>(
          '/api/users/getLocation'
        );
        const hasLocation = !!res?.data?.user?.location;
        if (hasLocation) {
          await fetchShops();
        } else {
          setPhase('requesting');
        }
      } catch {
        await fetchShops();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Step 2: fetch all shops ──────────────────────────────────────────────────
  async function fetchShops() {
    setPhase('loading-shops');
    try {
      const res = await authGet<{ data: Shop[] }>('/api/general/all/shops');
      setShops(res.data ?? []);
      setPhase('done');
    } catch (err) {
      setError((err as Error).message);
      setPhase('error');
    }
  }

  // ── Allow: get browser coords → addLocation → fetchShops ────────────────────
  async function handleAllow() {
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { longitude, latitude } = pos.coords;
        try {
          setPhase('saving');
          await authPost('/api/users/addLocation', {
            location: { type: 'Point', coordinates: [longitude, latitude] },
          });
        } catch {
          // If save fails, still proceed
        }
        setLocationLoading(false);
        await fetchShops();
      },
      async () => {
        setLocationLoading(false);
        await fetchShops();
      }
    );
  }

  // ── Deny: skip location → fetchShops ────────────────────────────────────────
  async function handleDeny() {
    await fetchShops();
  }

  const filteredShops = shops.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.address.toLowerCase().includes(search.toLowerCase())
  );

  // ── Render phases ────────────────────────────────────────────────────────────

  if (phase === 'checking') {
    return <LoadingBlock message="Checking your location…" />;
  }

  if (phase === 'requesting') {
    return <LocationPrompt onAllow={handleAllow} onDeny={handleDeny} loading={locationLoading} />;
  }

  if (phase === 'saving' || phase === 'loading-shops') {
    return (
      <LoadingBlock
        message={phase === 'saving' ? 'Saving your location…' : 'Fetching nearby shops…'}
      />
    );
  }

  if (phase === 'error') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px 20px',
        }}
      >
        <div className="card card-elevated" style={{ maxWidth: 400, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Done: shops view ─────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .shop-card-anim { animation: fadeUp 0.35s ease both; }
      `}</style>

      {/* Welcome hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--navy-800) 0%, var(--navy-600) 100%)',
          borderRadius: 'var(--radius-xl)',
          padding: '32px 36px',
          marginBottom: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 20,
          boxShadow: 'var(--shadow-navy)',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Decorative blob */}
        <div
          style={{
            position: 'absolute',
            right: -40, top: -40,
            width: 220, height: 220,
            borderRadius: '50%',
            background: 'rgba(0,180,216,0.12)',
            pointerEvents: 'none',
          }}
        />

        <div>
          <span className="badge badge-cyan" style={{ marginBottom: 10 }}>👤 User</span>
          <h1
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: 'var(--text-3xl)',
              color: '#fff',
              margin: '4px 0 8px',
            }}
          >
            Welcome back{user ? `, ${(user as any).firstName ?? user.username}` : ''}!
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.55)', margin: 0, fontSize: 'var(--text-sm)' }}>
            {shops.length} shop{shops.length !== 1 ? 's' : ''} available near you
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div
            className="stat-card"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 100 }}
          >
            <div className="stat-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Shops</div>
            <div className="stat-value" style={{ color: '#fff', fontSize: 'var(--text-2xl)' }}>
              {shops.length}
            </div>
          </div>
          <div
            className="stat-card"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 100 }}
          >
            <div className="stat-label" style={{ color: 'rgba(255,255,255,0.45)' }}>With Location</div>
            <div className="stat-value" style={{ color: 'var(--cyan-400)', fontSize: 'var(--text-2xl)' }}>
              {shops.filter((s) => s.location).length}
            </div>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: 28 }}>
        <div className="input-wrap" style={{ maxWidth: 420 }}>
          <span className="input-icon">🔍</span>
          <input
            className="input"
            placeholder="Search shops by name or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Section heading */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 20,
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-xl)',
            color: 'var(--text-primary)',
            margin: 0,
          }}
        >
          All Shops
        </h2>
        {search && (
          <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            {filteredShops.length} result{filteredShops.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Shop grid */}
      {filteredShops.length === 0 ? (
        <div
          className="card"
          style={{ textAlign: 'center', padding: '60px 32px', color: 'var(--text-secondary)' }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏪</div>
          <p style={{ margin: 0 }}>
            {search ? 'No shops match your search.' : 'No shops found.'}
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 18,
          }}
        >
          {filteredShops.map((shop, i) => (
            <div
              key={shop._id}
              className="shop-card-anim"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <ShopCard shop={shop} onClick={() => setSelectedShopId(shop._id)}/>
            </div>
          ))}
        </div>
      )}
      {selectedShopId && (
  <ShopModal shopId={selectedShopId} onClose={() => setSelectedShopId(null)} />
)}
    </>
  );
}