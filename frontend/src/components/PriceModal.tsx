import React, { useEffect, useMemo, useState } from "react";
import ReactDOM from "react-dom";
import { getToken } from "../utils/auth";
import PriceDetailModal from "./PriceDetailModal";

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
interface Category {
  _id: string;
  name: string;
}
interface Price {
  _id: string;
  name: string;
  charge: number;
  picture?: string;
  icon?: string;
  category?: Category;
}
interface ShopResponse {
  _id: string;
  name: string;
  address: string;
  prices: Price[];
  location?: { type: string; coordinates: [number, number] };
}
interface Shop {
  _id: string;
  name: string;
  address: string;
  prices: Price[];
  location?: { type: string; coordinates: [number, number] };
}
interface SelectedItem {
  price: Price;
  shop: Shop;
}

async function authGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}

export default function PricesModal({
  shopId,
  shopName,
  onBack,
}: {
  shopId: string;
  shopName: string;
  onBack: () => void;
}) {
  const [shopData, setShopData] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    authGet<{ data: ShopResponse }>(`/api/general/shop/service/${shopId}`)
      .then((res) => setShopData(res.data))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [shopId]);

  const prices = shopData?.prices ?? [];

const categories = useMemo(() => {
  const map = new Map<string, string>();

  prices.forEach((p) => {
    if (p.category?._id) {
      map.set(p.category._id, p.category.name);
    }
  });

  return Array.from(map.entries()).map(([id, name]) => ({
    id,
    name,
  }));
}, [prices]);

  const stats = useMemo(() => {
    if (!prices.length) return { total: 0, avg: 0, max: 0 };
    const total = prices.length;
    const sum = prices.reduce((acc, p) => acc + Number(p.charge || 0), 0);
    return { total, avg: sum / total, max: Math.max(...prices.map(p => Number(p.charge || 0))) };
  }, [prices]);

const filteredPrices = useMemo(() => {
  if (!categoryFilter) return prices;

  return prices.filter(
    (p) => p.category?._id === categoryFilter
  );
}, [prices, categoryFilter]);

  return ReactDOM.createPortal(
    <>
      <style>{`
        @keyframes fadeIn  { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes cardIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        .pm-backdrop {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          background: rgba(2,9,20,0.80); backdrop-filter: blur(6px);
          animation: fadeIn 0.2s ease;
          padding: 16px;
        }
        .pm-sheet {
          background: var(--bg-page);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-xl);
          width: 100%; max-width: 980px;
          height: 90vh;
          display: flex; flex-direction: column;
          box-shadow: var(--shadow-xl);
          overflow: hidden;
          animation: slideUp 0.24s cubic-bezier(0.34,1.56,0.64,1);
        }
        .pm-header {
          display: flex; align-items: center; gap: 16px;
          padding: 22px 24px 20px;
          border-bottom: 1px solid var(--border-subtle);
          background: var(--bg-surface);
          flex-shrink: 0;
        }
        .pm-stats {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 12px;
          padding: 18px 24px 0;
          flex-shrink: 0;
        }
        .pm-stat-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          padding: 14px 16px;
          box-shadow: var(--shadow-xs);
        }
        .pm-filter-bar {
          padding: 14px 24px;
          display: flex; gap: 8px; align-items: center;
          flex-shrink: 0;
          overflow-x: auto;
          scrollbar-width: none;
        }
        .pm-filter-bar::-webkit-scrollbar { display: none; }
        .pm-chip {
          display: inline-flex; align-items: center;
          padding: 6px 14px;
          border-radius: var(--radius-full);
          font-size: var(--text-xs); font-weight: 600;
          border: 1.5px solid var(--border-default);
          background: var(--bg-surface);
          color: var(--text-secondary);
          cursor: pointer; white-space: nowrap;
          transition: all var(--ease-normal);
          outline: none;
        }
        .pm-chip:hover { border-color: var(--cyan-500); color: var(--cyan-500); background: rgba(0,180,216,0.06); }
        .pm-chip.active { background: var(--cyan-500); border-color: var(--cyan-500); color: var(--navy-900); box-shadow: var(--shadow-cyan); }
        .pm-body {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 12px 24px 24px;
        }
        .pm-body-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 14px;
          align-content: start;
        }
        .pm-body.pm-body--center {
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
        }
        .pm-body::-webkit-scrollbar { width: 8px; }
        .pm-body::-webkit-scrollbar-track { background: transparent; }
        .pm-body::-webkit-scrollbar-thumb { background: rgba(0,180,216,0.25); border-radius: 4px; }
        .pm-body::-webkit-scrollbar-thumb:hover { background: rgba(0,180,216,0.4); }

        /* ── Card box ── */
        .pm-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-lg);
          cursor: pointer;
          overflow: hidden;
          box-shadow: var(--shadow-xs);
          transition: all var(--ease-normal);
          display: flex; flex-direction: column;
          height: 100%;
        }
        .pm-card:hover {
          border-color: var(--cyan-500);
          box-shadow: var(--shadow-md), 0 0 0 1px rgba(0,180,216,0.15);
          transform: translateY(-2px);
        }
        .pm-card-img {
          width: 100%; 
          height: 200px;
          background: var(--bg-subtle);
          display: flex; align-items: center; justify-content: center;
          overflow: hidden; position: relative; flex-shrink: 0;
        }
        .pm-card-img img {
          width: 100%; height: 100%; object-fit: cover;
          transition: transform 0.35s ease;
        }
        .pm-card:hover .pm-card-img img { transform: scale(1.05); }
        .pm-card-body {
          padding: 12px 14px 14px;
          display: flex; flex-direction: column; gap: 6px;
          flex: 1;
        }

        @media (max-width: 768px) {
          .pm-sheet { max-width: 95vw; height: 95vh; }
          .pm-body-grid { grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 12px; }
          .pm-card-img { height: 180px; }
        }

        @media (max-width: 520px) {
          .pm-sheet { max-width: 100vw; height: 100vh; border-radius: 0; }
          .pm-body { padding: 10px 16px 20px; }
          .pm-body-grid { grid-template-columns: 1fr; gap: 10px; }
          .pm-card-img { height: 200px; }
          .pm-stats { grid-template-columns: repeat(3,1fr); gap: 8px; padding: 14px 16px 0; }
          .pm-stat-card { padding: 10px 12px; }
          .pm-header { padding: 16px; }
          .pm-filter-bar { padding: 12px 16px; }
        }
      `}</style>

      {selected && ReactDOM.createPortal(
        <PriceDetailModal item={selected} onClose={() => setSelected(null)} />,
        document.body
      )}

      <div className="pm-backdrop" onClick={e => { if (e.target === e.currentTarget) onBack(); }}>
        <div className="pm-sheet">

          {/* ── Header ── */}
          <div className="pm-header">
            <button
              onClick={onBack}
              style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--bg-subtle)', border: '1px solid var(--border-default)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, color: 'var(--text-secondary)',
                transition: 'all var(--ease-fast)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-inset)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'var(--bg-subtle)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
              </svg>
            </button>

            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{
                margin: 0, fontFamily: 'var(--font-display)',
                fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)',
                lineHeight: 'var(--leading-tight)',
              }}>
                Price List
              </h2>
              <div style={{
                marginTop: 3, fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', gap: 6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
                {shopName}
              </div>
            </div>

            {/* Services badge */}
            {!loading && (
              <div style={{
                background: 'rgba(0,180,216,0.1)', color: 'var(--cyan-500)',
                border: '1px solid rgba(0,180,216,0.2)',
                borderRadius: 'var(--radius-full)', padding: '4px 12px',
                fontSize: 'var(--text-xs)', fontWeight: 700, flexShrink: 0,
              }}>
                {stats.total} services
              </div>
            )}
          </div>

          {/* ── Stats ── */}
          {!loading && prices.length > 0 && (
            <div className="pm-stats">
              {[
                { label: 'Total Services', value: String(stats.total), accent: false },
                { label: 'Avg Rate', value: `₹${stats.avg.toFixed(0)}`, accent: false },
                { label: 'Highest', value: `₹${stats.max.toFixed(0)}`, accent: true },
              ].map(({ label, value, accent }) => (
                <div key={label} className="pm-stat-card">
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {label}
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', fontWeight: 700,
                    color: accent ? 'var(--cyan-500)' : 'var(--text-primary)',
                  }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Category chips ── */}
          {!loading && categories.length > 0 && (
            <div className="pm-filter-bar">
              <button
                className={`pm-chip${categoryFilter === '' ? ' active' : ''}`}
                onClick={() => setCategoryFilter('')}
              >
                All
              </button>
              {categories.map((cat) => (
  <button
    key={cat.id}
    className={`pm-chip${categoryFilter === cat.id ? ' active' : ''}`}
    onClick={() =>
      setCategoryFilter(
        cat.id === categoryFilter ? '' : cat.id
      )
    }
  >
    {cat.name}
  </button>
))}
            </div>
          )}

          {/* ── Body ── */}
          <div className={`pm-body${(loading || error || filteredPrices.length === 0) ? ' pm-body--center' : ''}`}>
            {loading ? (
              <div style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 14, color: 'var(--text-tertiary)',
                padding: '60px 0',
              }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--cyan-500)" strokeWidth="2"
                  style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                </svg>
                <span style={{ fontSize: 'var(--text-sm)' }}>Loading services…</span>
              </div>
            ) : error ? (
              <div style={{
                padding: '40px 24px', textAlign: 'center',
                background: 'var(--color-danger-light)', borderRadius: 'var(--radius-lg)',
                color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 600,
                width: '100%',
              }}>
                {error}
              </div>
            ) : filteredPrices.length === 0 ? (
              <div style={{
                padding: '60px 24px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 40 }}>🏷️</div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>No services found</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-tertiary)' }}>
                  {categoryFilter ? 'Try a different category.' : 'This shop has no prices listed yet.'}
                </div>
              </div>
            ) : (
              <div className="pm-body-grid">
                {filteredPrices.map((price, i) => (
                  <div
                    key={price._id}
                    className="pm-card"
                    onClick={() => shopData && setSelected({ price, shop: shopData })}
                    style={{ animation: `cardIn 0.25s ease both`, animationDelay: `${i * 30}ms` }}
                  >
                    {/* Image / Icon panel */}
                    <div className="pm-card-img">
                      {price.picture ? (
                        <img
                          src={price.picture} alt={price.name}
                          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : price.icon ? (
                        <span style={{ fontSize: 40 }}>{price.icon}</span>
                      ) : (
                        <span style={{ fontSize: 36 }}>🏷️</span>
                      )}

                      {/* Price badge overlaid on image */}
                      <div style={{
                        position: 'absolute', bottom: 8, right: 8,
                        background: 'var(--cyan-500)', color: 'var(--navy-900)',
                        borderRadius: 'var(--radius-full)', padding: '4px 12px',
                        fontSize: 'var(--text-sm)', fontWeight: 700,
                        boxShadow: 'var(--shadow-cyan)',
                      }}>
                        ₹{Number(price.charge).toFixed(2)}
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="pm-card-body">
                      <div style={{
                        fontWeight: 600, fontSize: 'var(--text-sm)',
                        color: 'var(--text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {price.name}
                      </div>

                      {price.category && (
                        <span style={{
                          display: 'inline-block',
                          fontSize: 10, color: 'var(--text-tertiary)',
                          background: 'var(--bg-subtle)',
                          borderRadius: 'var(--radius-full)', padding: '2px 8px',
                          textTransform: 'capitalize', width: 'fit-content',
                        }}>
                          {price.category.name}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>,
    document.body
  );
}