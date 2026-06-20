import { useEffect, useState } from 'react';
import { getUser, getToken } from '../utils/auth';
import { usePageTitle } from '../components/DashboardLayout';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Summary {
  totalUsers: number;
  totalShopOwners: number;
  totalDeliveryBoys: number;
  totalShops: number;
  totalServices: number;
  totalDeliveries: number;
  activeDeliveries: number;
  completedDeliveries: number;
}

interface StatusBreakdown {
  started: number;
  collected_from_user: number;
  given_to_shops: number;
  service_done: number;
  collected_from_shops: number;
  given_to_user: number;
}

interface TopShop {
  _id: string;
  name: string;
  rating?: number;
  ratingCount?: number;
  totalOrders?: number;
  avgDeliveryTime?: number;
}

interface TopService {
  _id: string;
  name: string;
  charge?: number;
  timesOrdered?: number;
  avgReview?: number;
  expressAvailable?: boolean;
  category?: { name?: string };
}

interface TopDeliveryBoy {
  _id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  inDelivery?: number;
}

interface RecentDelivery {
  _id: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  user?: { username?: string; firstName?: string; lastName?: string };
}

interface DashboardData {
  summary: Summary;
  deliveryStatusBreakdown: StatusBreakdown;
  topShops: TopShop[];
  topServices: TopService[];
  topDeliveryBoys: TopDeliveryBoy[];
  recentDeliveries: RecentDelivery[];
}

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

function getInitials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const STATUS_LABELS: Record<keyof StatusBreakdown, string> = {
  started: 'Started',
  collected_from_user: 'Collected from User',
  given_to_shops: 'Given to Shop',
  service_done: 'Service Done',
  collected_from_shops: 'Collected from Shop',
  given_to_user: 'Delivered',
};

const STATUS_COLORS: Record<keyof StatusBreakdown, string> = {
  started: 'var(--cyan-400)',
  collected_from_user: 'var(--blue-400, #60a5fa)',
  given_to_shops: 'var(--amber-400, #fbbf24)',
  service_done: 'var(--purple-400, #c084fc)',
  collected_from_shops: 'var(--orange-400, #fb923c)',
  given_to_user: 'var(--green-400, #4ade80)',
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
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

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  icon: string;
  accent?: string;
}) {
  return (
    <div
      className="card"
      style={{
        padding: '20px 22px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 'var(--radius-md)',
          background: accent ? `${accent}1A` : 'var(--cyan-50)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            marginBottom: 4,
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-2xl)',
            fontWeight: 'var(--weight-semibold)',
            color: 'var(--text-primary)',
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

function StatusBar({
  data,
  total,
}: {
  data: StatusBreakdown;
  total: number;
}) {
  const entries = Object.entries(data) as [keyof StatusBreakdown, number][];

  return (
    <div className="card" style={{ padding: '24px 26px' }}>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          margin: '0 0 20px',
        }}
      >
        Delivery Status Breakdown
      </h3>

      {/* Stacked bar */}
      <div
        style={{
          display: 'flex',
          width: '100%',
          height: 12,
          borderRadius: 'var(--radius-full, 999px)',
          overflow: 'hidden',
          marginBottom: 20,
          background: 'var(--bg-subtle, #f1f5f9)',
        }}
      >
        {entries.map(([key, val]) => {
          const pct = total > 0 ? (val / total) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              title={`${STATUS_LABELS[key]}: ${val}`}
              style={{
                width: `${pct}%`,
                background: STATUS_COLORS[key],
                transition: 'width 0.4s ease',
              }}
            />
          );
        })}
      </div>

      {/* Legend grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {entries.map(([key, val]) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: STATUS_COLORS[key],
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', flex: 1 }}>
              {STATUS_LABELS[key]}
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--weight-semibold)',
                color: 'var(--text-primary)',
              }}
            >
              {val}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  title,
  icon,
  children,
  empty,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
  empty?: boolean;
}) {
  return (
    <div className="card" style={{ padding: '24px 26px', height: '100%' }}>
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          margin: '0 0 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>{icon}</span> {title}
      </h3>
      {empty ? (
        <div
          style={{
            textAlign: 'center',
            padding: '32px 0',
            color: 'var(--text-tertiary)',
            fontSize: 'var(--text-sm)',
          }}
        >
          No data yet
        </div>
      ) : (
        children
      )}
    </div>
  );
}

function RankBadge({ rank }: { rank: number }) {
  const colors = ['var(--cyan-500)', 'var(--text-secondary)', 'var(--text-tertiary)'];
  return (
    <span
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        background: rank < 3 ? colors[rank] : 'var(--bg-subtle, #f1f5f9)',
        color: rank < 3 ? '#fff' : 'var(--text-secondary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: 'var(--text-xs)',
        fontWeight: 'var(--weight-semibold)',
        flexShrink: 0,
      }}
    >
      {rank + 1}
    </span>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AdminDashboardOverview() {
  const user = getUser();
  usePageTitle('Dashboard');

  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await authGet<{ data: DashboardData }>('/api/admin/user/user/dashboard');
        setData(res.data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <LoadingBlock message="Loading dashboard…" />;

  if (error || !data) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div className="card card-elevated" style={{ maxWidth: 400, textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Something went wrong</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error || 'No data'}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  const { summary, deliveryStatusBreakdown, topShops, topServices, topDeliveryBoys, recentDeliveries } = data;

  return (
    <>
      <style>{`
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .anim { animation: fadeUp 0.35s ease both; }
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
          <span className="badge badge-cyan" style={{ marginBottom: 10 }}>🛠 Admin</span>
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
            Here's what's happening across the platform today
          </p>
        </div>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div
            className="stat-card"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 110 }}
          >
            <div className="stat-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Active</div>
            <div className="stat-value" style={{ color: 'var(--cyan-400)', fontSize: 'var(--text-2xl)' }}>
              {summary.activeDeliveries}
            </div>
          </div>
          <div
            className="stat-card"
            style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', minWidth: 110 }}
          >
            <div className="stat-label" style={{ color: 'rgba(255,255,255,0.45)' }}>Completed</div>
            <div className="stat-value" style={{ color: '#fff', fontSize: 'var(--text-2xl)' }}>
              {summary.completedDeliveries}
            </div>
          </div>
        </div>
      </div>

      {/* Top stats grid */}
      <div
        className="anim"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <StatCard label="Total Users" value={summary.totalUsers} icon="👥" accent="#00b4d8" />
        <StatCard label="Shop Owners" value={summary.totalShopOwners} icon="🏪" accent="#fbbf24" />
        <StatCard label="Delivery Boys" value={summary.totalDeliveryBoys} icon="🛵" accent="#4ade80" />
        <StatCard label="Shops" value={summary.totalShops} icon="🏬" accent="#c084fc" />
        <StatCard label="Services" value={summary.totalServices} icon="🧾" accent="#fb923c" />
        <StatCard label="Deliveries" value={summary.totalDeliveries} icon="📦" accent="#60a5fa" />
      </div>

      {/* Status breakdown */}
      <div className="anim" style={{ marginBottom: 24 }}>
        <StatusBar data={deliveryStatusBreakdown} total={summary.totalDeliveries} />
      </div>

      {/* Three-column grid: top shops / services / delivery boys */}
      <div
        className="anim"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: 18,
          marginBottom: 24,
        }}
      >
        {/* Top Shops */}
        <SectionCard title="Top Shops" icon="🏪" empty={topShops.length === 0}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topShops.map((shop, i) => (
              <div key={shop._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RankBadge rank={i} />
                <div
                  className="avatar"
                  style={{
                    width: 32, height: 32,
                    background: 'var(--navy-800)',
                    color: 'var(--cyan-300)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                    flexShrink: 0,
                  }}
                >
                  {getInitials(shop.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {shop.name}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {shop.totalOrders ?? 0} orders
                    {shop.rating ? ` · ⭐ ${shop.rating.toFixed(1)}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Top Services */}
        <SectionCard title="Top Services" icon="🧾" empty={topServices.length === 0}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topServices.map((svc, i) => (
              <div key={svc._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <RankBadge rank={i} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {svc.name}
                    {svc.expressAvailable && (
                      <span className="badge badge-cyan" style={{ marginLeft: 8, fontSize: 10, padding: '2px 6px' }}>
                        ⚡ Express
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    {svc.category?.name ?? 'General'} · {svc.timesOrdered ?? 0} orders
                  </div>
                </div>
                {svc.charge != null && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--text-primary)', fontWeight: 'var(--weight-semibold)' }}>
                    ₹{svc.charge}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Top Delivery Boys */}
        <SectionCard title="Top Delivery Boys" icon="🛵" empty={topDeliveryBoys.length === 0}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {topDeliveryBoys.map((boy, i) => {
              const fullName = [boy.firstName, boy.lastName].filter(Boolean).join(' ') || boy.username || 'Unknown';
              return (
                <div key={boy._id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <RankBadge rank={i} />
                  <div
                    className="avatar"
                    style={{
                      width: 32, height: 32,
                      background: 'var(--navy-800)',
                      color: 'var(--cyan-300)',
                      borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 'var(--text-xs)', fontWeight: 'var(--weight-semibold)',
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(fullName)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--weight-semibold)', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {fullName}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {boy.phone ?? boy.email ?? ''}
                    </div>
                  </div>
                  <span className="badge badge-success" style={{ flexShrink: 0 }}>
                    {boy.inDelivery ?? 0} active
                  </span>
                </div>
              );
            })}
          </div>
        </SectionCard>
      </div>

      {/* Recent Deliveries */}
      <div className="anim card" style={{ padding: '24px 26px' }}>
        <h3
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
            margin: '0 0 18px',
          }}
        >
          Recent Deliveries
        </h3>

        {recentDeliveries.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-tertiary)', fontSize: 'var(--text-sm)' }}>
            No deliveries yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)' }}>User</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)' }}>Status</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)' }}>Created</th>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-semibold)' }}>Updated</th>
                </tr>
              </thead>
              <tbody>
                {recentDeliveries.map((d) => {
                  const name = [d.user?.firstName, d.user?.lastName].filter(Boolean).join(' ') || d.user?.username || '—';
                  const statusKey = d.status as keyof StatusBreakdown;
                  return (
                    <tr key={d._id} style={{ borderBottom: '1px solid var(--border-subtle, #f1f5f9)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--text-primary)' }}>{name}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span
                          className="badge"
                          style={{
                            background: `${STATUS_COLORS[statusKey] ?? 'var(--text-tertiary)'}1A`,
                            color: STATUS_COLORS[statusKey] ?? 'var(--text-secondary)',
                          }}
                        >
                          {STATUS_LABELS[statusKey] ?? d.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{timeAgo(d.createdAt)}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{timeAgo(d.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}