import React, { useState, useEffect } from "react";
import { getUser, getToken } from '../utils/auth';
import PricesModal from "./PriceModal";

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

interface Price {
  _id: string;
  name: string;
  charge: number;
}

interface UserRating {
  _id: string;
  ratingNumber: number;
  comment?: string;
}

interface ShopDetail {
  _id: string;
  name: string;
  address: string;
  prices: Price[];
  rating?: number;
  ratingCount?: number;
  avgDeliveryTime?: number;
  currentUserRating?: UserRating | null;
  location?: {
    type: string;
    coordinates: [number, number];
  };
}
function getInitials(name: string) {
  return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}
function formatDeliveryTime(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function Spinner({ size = 20 }: { size?: number }) {
  return (
    <span style={{
      display: 'inline-block',
      width: size,
      height: size,
      border: `2px solid rgba(255,255,255,0.1)`,
      borderTopColor: '#22d3ee',
      borderRadius: '50%',
      animation: 'sm-spin 0.7s linear infinite',
      flexShrink: 0,
    }} />
  );
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

async function authPost<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? 'Request failed');
  return data;
}

async function authDelete<T>(path: string, body: unknown): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message ?? 'Request failed');
  return data;
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '2px 3px',
            fontSize: 22,
            lineHeight: 1,
            transition: 'transform 0.12s',
            transform: hovered >= star ? 'scale(1.18)' : 'scale(1)',
            color: (hovered || value) >= star ? '#fbbf24' : 'rgba(255,255,255,0.2)',
            filter: (hovered || value) >= star ? 'drop-shadow(0 0 4px #f59e0b88)' : 'none',
          }}
          aria-label={`${star} star`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function ShopModal({
  shopId,
  onClose,
}: {
  shopId: string;
  onClose: () => void;
}) {
  const [shop, setShop] = useState<ShopDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showPrices, setShowPrices] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  useEffect(() => {
    authGet<{ data: ShopDetail }>(`/api/general/shop/${shopId}`)
      .then((res) => setShop(res.data))
      .catch((err) => setError((err as Error).message))
      .finally(() => setLoading(false));
  }, [shopId]);

  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const [lng, lat] = shop?.location?.coordinates ?? [];

  const handleRatingSubmit = async () => {
    if (!shop) return;
    try {
      setRatingLoading(true);
      await authPost('/api/rating/give', { shopId: shop._id, ratingNumber: rating, comment });
      const refreshed = await authGet<{ data: ShopDetail }>(`/api/general/shop/${shop._id}`);
      setShop(refreshed.data);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRatingLoading(false);
    }
  };

  const handleDeleteRating = async () => {
    if (!shop?.currentUserRating) return;
    try {
      setRatingLoading(true);
      await authDelete('/api/rating/delete', { ratingId: shop.currentUserRating._id });
      const refreshed = await authGet<{ data: ShopDetail }>(`/api/general/shop/${shop._id}`);
      setShop(refreshed.data);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRatingLoading(false);
    }
  };

  const ratingDisplay = shop?.rating != null
    ? Number(shop.rating).toFixed(1)
    : '—';

  return (
    <>
      <style>{`
        @keyframes sm-spin { to { transform: rotate(360deg); } }
        @keyframes sm-backdropIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes sm-slideUp {
          from { opacity: 0; transform: translateY(32px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes sm-shimmer {
          0%   { background-position: -400px 0; }
          100% { background-position: 400px 0; }
        }

        .sm-backdrop {
          position: fixed; inset: 0;
          background: rgba(2, 8, 18, 0.80);
          backdrop-filter: blur(8px) saturate(0.8);
          z-index: 1000;
          display: flex; align-items: center; justify-content: center;
          padding: 16px;
          animation: sm-backdropIn 0.2s ease both;
        }

        .sm-modal {
          background: #0d1422;
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          width: 100%;
          max-width: 480px;
          max-height: 92dvh;
          overflow-y: auto;
          box-shadow:
            0 0 0 1px rgba(34,211,238,0.08),
            0 24px 64px rgba(0,0,0,0.6),
            0 8px 24px rgba(0,0,0,0.4);
          animation: sm-slideUp 0.3s cubic-bezier(0.34, 1.46, 0.64, 1) both;
          scroll-behavior: smooth;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }

        .sm-modal::-webkit-scrollbar { width: 4px; }
        .sm-modal::-webkit-scrollbar-track { background: transparent; }
        .sm-modal::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 99px; }

        /* ── Header ── */
        .sm-header {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 24px 24px 20px;
          position: relative;
        }

        .sm-header::after {
          content: '';
          position: absolute;
          bottom: 0; left: 24px; right: 24px;
          height: 1px;
          background: linear-gradient(90deg, rgba(34,211,238,0.3), rgba(255,255,255,0.06) 60%, transparent);
        }

        .sm-avatar {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: linear-gradient(135deg, #0e2a33, #0a1f2e);
          border: 1px solid rgba(34,211,238,0.25);
          color: #22d3ee;
          display: flex; align-items: center; justify-content: center;
          font-size: 17px; font-weight: 800;
          letter-spacing: -0.03em;
          flex-shrink: 0;
          box-shadow: 0 0 16px rgba(34,211,238,0.12);
        }

        .sm-title {
          font-size: 18px;
          font-weight: 700;
          color: #f1f5f9;
          margin: 0 0 5px;
          line-height: 1.25;
          letter-spacing: -0.02em;
        }

        .sm-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          background: rgba(34,211,238,0.1);
          border: 1px solid rgba(34,211,238,0.22);
          color: #67e8f9;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 2px 8px;
          border-radius: 99px;
        }

        .sm-close {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 8px;
          width: 32px; height: 32px;
          cursor: pointer;
          color: #64748b;
          font-size: 16px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, color 0.15s, border-color 0.15s;
        }
        .sm-close:hover {
          background: rgba(255,255,255,0.1);
          border-color: rgba(255,255,255,0.18);
          color: #f1f5f9;
        }

        /* ── Body ── */
        .sm-body { padding: 20px 24px 0; }

        .sm-section {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sm-section:last-child { border-bottom: none; }

        .sm-icon {
          width: 36px; height: 36px;
          border-radius: 10px;
          background: rgba(34,211,238,0.07);
          border: 1px solid rgba(34,211,238,0.12);
          display: flex; align-items: center; justify-content: center;
          font-size: 15px;
          flex-shrink: 0;
          margin-top: 1px;
        }

        .sm-label {
          font-size: 10px;
          color: #475569;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }

        .sm-value {
          font-size: 14px;
          color: #cbd5e1;
          font-weight: 500;
          line-height: 1.45;
        }
        /* Delivery time pill */
        .sm-delivery-pill {
          display: inline-flex; align-items: center; gap: 6px;
          background: rgba(34,197,94,0.08);
          border: 1px solid rgba(34,197,94,0.18);
          border-radius: 99px; padding: 4px 12px; margin-top: 4px;
        }
        .sm-delivery-time {
          font-size: 16px; font-weight: 800;
          color: #4ade80; letter-spacing: -0.02em;
        }
        .sm-delivery-label {
          font-size: 11px; color: #4b5563; font-weight: 500;
        }
        .sm-delivery-na {
          font-size: 14px; color: #334155; font-weight: 500; margin-top: 4px;
        }
        /* ── Rating display ── */
        .sm-rating-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(251,191,36,0.08);
          border: 1px solid rgba(251,191,36,0.18);
          border-radius: 99px;
          padding: 4px 12px;
          margin-top: 4px;
        }

        .sm-rating-score {
          font-size: 16px;
          font-weight: 800;
          color: #fbbf24;
          letter-spacing: -0.02em;
        }

        .sm-rating-count {
          font-size: 11px;
          color: #78716c;
          font-weight: 500;
        }

        /* ── User rating box ── */
        .sm-user-rating {
          margin-top: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px 16px;
        }

        .sm-user-rating-label {
          font-size: 11px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .sm-user-stars {
          color: #fbbf24;
          font-size: 18px;
          letter-spacing: 1px;
        }

        .sm-user-comment {
          margin-top: 8px;
          font-size: 13px;
          color: #94a3b8;
          font-style: italic;
          line-height: 1.5;
          padding-left: 10px;
          border-left: 2px solid rgba(148,163,184,0.2);
        }

        /* ── Rate form ── */
        .sm-rate-form {
          margin-top: 12px;
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(255,255,255,0.07);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .sm-textarea {
          width: 100%;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09);
          border-radius: 9px;
          color: #e2e8f0;
          font-size: 13px;
          padding: 10px 12px;
          min-height: 76px;
          resize: vertical;
          outline: none;
          font-family: inherit;
          transition: border-color 0.15s, box-shadow 0.15s;
          box-sizing: border-box;
        }
        .sm-textarea::placeholder { color: #334155; }
        .sm-textarea:focus {
          border-color: rgba(34,211,238,0.35);
          box-shadow: 0 0 0 3px rgba(34,211,238,0.08);
        }

        /* ── Buttons ── */
        .sm-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 16px;
          border-radius: 9px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          letter-spacing: 0.01em;
        }
        .sm-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .sm-btn-primary {
          background: linear-gradient(135deg, #0891b2, #0e7490);
          color: #fff;
          border: 1px solid rgba(34,211,238,0.3);
          box-shadow: 0 2px 8px rgba(8,145,178,0.3);
        }
        .sm-btn-primary:not(:disabled):hover {
          background: linear-gradient(135deg, #0ea5e9, #0891b2);
          box-shadow: 0 4px 16px rgba(8,145,178,0.45);
          transform: translateY(-1px);
        }

        .sm-btn-danger {
          background: rgba(239,68,68,0.1);
          color: #f87171;
          border: 1px solid rgba(239,68,68,0.2);
        }
        .sm-btn-danger:not(:disabled):hover {
          background: rgba(239,68,68,0.18);
          border-color: rgba(239,68,68,0.35);
        }

        .sm-btn-ghost {
          background: rgba(255,255,255,0.05);
          color: #94a3b8;
          border: 1px solid rgba(255,255,255,0.09);
        }
        .sm-btn-ghost:hover {
          background: rgba(255,255,255,0.09);
          color: #e2e8f0;
        }

        .sm-btn-map {
          background: rgba(34,211,238,0.08);
          color: #22d3ee;
          border: 1px solid rgba(34,211,238,0.2);
          text-decoration: none;
        }
        .sm-btn-map:hover {
          background: rgba(34,211,238,0.15);
          border-color: rgba(34,211,238,0.35);
          transform: translateY(-1px);
        }

        .sm-btn-prices {
          background: rgba(139,92,246,0.1);
          color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.22);
        }
        .sm-btn-prices:hover {
          background: rgba(139,92,246,0.18);
          border-color: rgba(139,92,246,0.38);
        }

        /* ── Footer ── */
        .sm-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
          padding: 20px 24px 24px;
          margin-top: 4px;
        }

        /* ── Loading skeleton ── */
        .sm-skeleton {
          height: 14px;
          border-radius: 6px;
          background: linear-gradient(90deg, rgba(255,255,255,0.05) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.05) 75%);
          background-size: 400px 100%;
          animation: sm-shimmer 1.4s infinite;
        }

        /* ── Responsive ── */
        @media (max-width: 520px) {
          .sm-modal { border-radius: 16px; max-height: 95dvh; }
          .sm-header { padding: 18px 18px 16px; }
          .sm-body { padding: 16px 18px 0; }
          .sm-footer { padding: 16px 18px 20px; }
          .sm-title { font-size: 16px; }
          .sm-btn { padding: 8px 13px; font-size: 12px; }
        }
      `}</style>

      <div className="sm-backdrop" onClick={handleBackdrop}>
        <div className="sm-modal" role="dialog" aria-modal="true" aria-label="Shop details">

          {/* ── Header ── */}
          <div className="sm-header">
            {loading ? (
              <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />
            ) : shop ? (
              <div className="sm-avatar">{getInitials(shop.name)}</div>
            ) : null}

            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 6 }}>
                  <Spinner size={18} />
                  <span style={{ color: '#475569', fontSize: 13 }}>Loading shop details…</span>
                </div>
              ) : error ? (
                <p style={{ color: '#f87171', margin: 0, fontSize: 13 }}>⚠️ {error}</p>
              ) : shop ? (
                <>
                  <h2 className="sm-title">{shop.name}</h2>
                  <span className="sm-badge">🏪 Shop</span>
                </>
              ) : null}
            </div>

            <button className="sm-close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {/* ── Body ── */}
          {!loading && !error && shop && (
            <div className="sm-body">

              {/* Address */}
              <div className="sm-section">
                <div className="sm-icon">📍</div>
                <div>
                  <div className="sm-label">Address</div>
                  <div className="sm-value">{shop.address}</div>
                </div>
              </div>

              {/* Prices */}
              <div className="sm-section">
                <div className="sm-icon">💰</div>
                <div style={{ width: '100%' }}>
                  <div className="sm-label">Price Listings</div>
                  {shop.prices.length > 0 ? (
                    <button
                      className="sm-btn sm-btn-prices"
                      style={{ marginTop: 8 }}
                      onClick={() => setShowPrices(true)}
                    >
                      🏷 View Prices
                      <span style={{
                        background: 'rgba(139,92,246,0.2)',
                        borderRadius: 99,
                        padding: '1px 7px',
                        fontSize: 11,
                        fontWeight: 700,
                      }}>
                        {shop.prices.length}
                      </span>
                    </button>
                  ) : (
                    <div className="sm-value" style={{ color: '#334155' }}>
                      No prices listed yet
                    </div>
                  )}
                </div>
              </div>
 {/* Avg Delivery Time */}
              <div className="sm-section">
                <div className="sm-icon">🕐</div>
                <div>
                  <div className="sm-label">Avg. Delivery Time</div>
                  {shop.avgDeliveryTime ? (
                    <div className="sm-delivery-pill">
                      <span style={{ color: '#4ade80', fontSize: 14 }}>⚡</span>
                      <span className="sm-delivery-time">{formatDeliveryTime(shop.avgDeliveryTime)}</span>
                      <span className="sm-delivery-label">avg. delivery</span>
                    </div>
                  ) : (
                    <div className="sm-delivery-na">Not available</div>
                  )}
                </div>
              </div>
              {/* Rating */}
              <div className="sm-section">
                <div className="sm-icon">⭐</div>
                <div style={{ width: '100%' }}>
                  <div className="sm-label">Rating</div>

                  <div className="sm-rating-pill">
                    <span style={{ color: '#fbbf24', fontSize: 14 }}>★</span>
                    <span className="sm-rating-score">{ratingDisplay}</span>
                    <span className="sm-rating-count">
                      {shop.ratingCount ?? 0} {shop.ratingCount === 1 ? 'rating' : 'ratings'}
                    </span>
                  </div>

                  {shop.currentUserRating ? (
                    <div className="sm-user-rating">
                      <div className="sm-user-rating-label">Your Review</div>
                      <div className="sm-user-stars">
                        {'★'.repeat(shop.currentUserRating.ratingNumber)}
                        <span style={{ color: 'rgba(255,255,255,0.12)' }}>
                          {'★'.repeat(5 - shop.currentUserRating.ratingNumber)}
                        </span>
                      </div>
                      {shop.currentUserRating.comment && (
                        <div className="sm-user-comment">
                          {shop.currentUserRating.comment}
                        </div>
                      )}
                      <button
                        className="sm-btn sm-btn-danger"
                        style={{ marginTop: 12 }}
                        onClick={handleDeleteRating}
                        disabled={ratingLoading}
                      >
                        {ratingLoading ? <><Spinner size={13} /> Removing…</> : '🗑 Delete Rating'}
                      </button>
                    </div>
                  ) : (
                    <div className="sm-rate-form">
                      <div>
                        <div style={{ fontSize: 11, color: '#475569', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 8 }}>
                          Your Rating
                        </div>
                        <StarRating value={rating} onChange={setRating} />
                      </div>
                      <textarea
                        className="sm-textarea"
                        placeholder="Share your experience (optional)…"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                      />
                      <button
                        className="sm-btn sm-btn-primary"
                        style={{ alignSelf: 'flex-start' }}
                        onClick={handleRatingSubmit}
                        disabled={ratingLoading}
                      >
                        {ratingLoading ? <><Spinner size={13} /> Submitting…</> : '★ Submit Rating'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ── Footer ── */}
          <div className="sm-footer">
            <button className="sm-btn sm-btn-ghost" onClick={onClose}>
              Close
            </button>
            {shop?.location && (
              <a
                href={`https://maps.google.com/?q=${lat},${lng}`}
                target="_blank"
                rel="noreferrer"
                className="sm-btn sm-btn-map"
              >
                📍 Open in Maps
              </a>
            )}
          </div>

        </div>
      </div>

      {showPrices && shop && (
        <PricesModal
          shopId={shop._id}
          shopName={shop.name}
          onBack={() => setShowPrices(false)}
        />
      )}
    </>
  );
}