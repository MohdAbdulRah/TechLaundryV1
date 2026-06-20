import React, { useEffect, useState } from 'react';
import { getToken } from '../utils/auth';
import PriceDetailModal from '../components/PriceDetailModal';

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
// ─── Types ────────────────────────────────────────────────────────────────────


interface Shop {
  _id: string;
  name: string;
  address: string;
  prices: Price[];
  location?: {
    type: string;
    coordinates: [number, number];
  };
}

interface SelectedItem {
  price: Price;
  shop: Shop;
}

// ─── API ──────────────────────────────────────────────────────────────────────
async function authGet<T>(path: string): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message ?? `Request failed (${res.status})`);
  return data as T;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <span style={{
      display: 'inline-block', width: 20, height: 20,
      border: '2px solid var(--border-default)',
      borderTopColor: 'var(--cyan-500)',
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  );
}

// ─── Price Card ───────────────────────────────────────────────────────────────
function PriceCard({
  price,
  shopName,
  onClick
}: {
  price: Price;
  shopName: string;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: 'var(--shadow-sm)',
        cursor: 'pointer',
      }}
    >
      {/* Icon / Image */}
      <div style={{
        width: '100%', height: 100,
        borderRadius: 'var(--radius-md)',
        background: 'var(--bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {price.picture ? (
          <img
            src={price.picture}
            alt={price.name}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : price.icon ? (
          <span style={{ fontSize: 36 }}>{price.icon}</span>
        ) : (
          <span style={{ fontSize: 32 }}>🏷️</span>
        )}
      </div>

      {/* Name + Charge */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
      }}>
        <div style={{
          fontWeight: 600,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {price.name}
        </div>

        <div style={{
          background: 'var(--cyan-50)',
          color: 'var(--cyan-800)',
          borderRadius: '999px',
          padding: '2px 10px',
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
        }}>
          ₹{Number(price.charge).toFixed(2)}
        </div>
      </div>

      {/* Category */}
      <div style={{
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
        textTransform: 'capitalize',
      }}>
        {price.category?.name ?? 'Other'}
      </div>

      {/* Shop */}
      <div style={{
        borderTop: '1px solid var(--border-subtle)',
        paddingTop: 10,
        fontSize: 'var(--text-xs)',
        color: 'var(--text-tertiary)',
      }}>
        🏪 {shopName}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
const PricesUser = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<SelectedItem | null>(null);

  useEffect(() => {
    authGet<{ data: Shop[] }>('/api/general/all/shops')
      .then(res => setShops(res.data ?? []))
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // flatten
  const allPrices = shops.flatMap(shop =>
    (shop.prices ?? []).map(price => ({ price, shop }))
  );

  // unique categories
  const categories = Array.from(
  new Map(
    allPrices
      .filter((p) => p.price.category?._id)
      .map((p) => [
        p.price.category!._id,
        p.price.category!,
      ])
  ).values()
);

  // filtering
  const filtered = allPrices.filter(({ price, shop }) => {
    const matchSearch =
      !search ||
      price.name.toLowerCase().includes(search.toLowerCase()) ||
      shop.name.toLowerCase().includes(search.toLowerCase());

    const matchCategory =
  !categoryFilter ||
  price.category?._id === categoryFilter;

    return matchSearch && matchCategory;
  });

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {selected && (
        <PriceDetailModal
          item={selected}
          onClose={() => setSelected(null)}
        />
      )}

      <div style={{ padding: 32, maxWidth: 960, margin: '0 auto' }}>

        {/* Header */}
        <h1 style={{ fontSize: 28, fontWeight: 700 }}>
          Services & Prices
        </h1>

        {/* Search + Filter */}
        <div style={{ display: 'flex', gap: 12, margin: '20px 0', flexWrap: 'wrap' }}>

          <input
            className="input"
            placeholder="Search services or shop..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            className="input"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>

{categories.map((cat) => (
  <option key={cat._id} value={cat._id}>
    {cat.name}
  </option>
))}
          </select>

          {categoryFilter && (
            <button
              className="btn btn-ghost"
              onClick={() => setCategoryFilter('')}
            >
              Clear
            </button>
          )}
        </div>

        {/* States */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            <Spinner />
          </div>
        ) : error ? (
          <div className="alert alert-danger">{error}</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60 }}>
            No services found
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}>
            {filtered.map(({ price, shop }, i) => (
              <div
                key={price._id}
                style={{
                  animation: `cardIn 0.25s ease both`,
                  animationDelay: `${i * 20}ms`,
                }}
              >
                <PriceCard
                  price={price}
                  shopName={shop.name}
                  onClick={() => setSelected({ price, shop })}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default PricesUser;